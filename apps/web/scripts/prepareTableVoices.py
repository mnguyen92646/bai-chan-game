"""Build table-v3 from two AI Voice Generator result manifests.

Usage: python3 apps/web/scripts/prepareTableVoices.py male.json female.json
Uses original provider audio, pitch-preserving tempo adjustment and gentle EQ.
Requires ffmpeg. Downloads are staged; existing packs are left intact.
"""
import array
import concurrent.futures
import hashlib
import json
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave

root = Path(__file__).resolve().parents[1] / "public/audio"
phrases = json.loads((root / "table-v1/manifest.json").read_text())["phrases"]
results = {voice: json.loads(Path(path).read_text()) for voice, path in zip(("male", "female"), sys.argv[1:], strict=True)}
for voice, entries in results.items():
    assert set(entries) == set(phrases), f"Missing clips for {voice}"
    assert all(r["status"] == "ready" and r["preview_transcript"] == phrases[n] for n, r in entries.items())

def ffmpeg(source, target, filters):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-af", filters,
                    "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "128k", "-threads", "1", str(target)], check=True)

with tempfile.TemporaryDirectory(prefix="chan-clear-voices-") as directory:
    stage = Path(directory)
    sources = {}
    def prepare(item):
        voice, name, result = item
        folder = stage / voice
        folder.mkdir(exist_ok=True)
        source = folder / f"{name}-source.mp3"
        with urllib.request.urlopen(result["preview_url"], timeout=60) as response:
            source.write_bytes(response.read())
        target = folder / f"{name}.mp3"
        tempo = .65 if name in ("chiu", "win", "chiu-win") else .9
        ffmpeg(source, target, f"highpass=f=75,equalizer=f=280:t=q:w=0.8:g=-2.5,equalizer=f=2800:t=q:w=0.7:g=3,atempo={tempo},loudnorm=I=-19:TP=-2:LRA=7,afade=t=in:d=0.008,apad=pad_dur=0.1")
        duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(target)]))
        assert .2 < duration < 10, (voice, name, duration)
        source.unlink()
        return f"{voice}/{name}", {"context_id": result["context_id"], "preset": result["voice_id"], "tempo": tempo, "duration": duration, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for name, info in pool.map(prepare, [(v, n, r) for v, entries in results.items() for n, r in entries.items()]):
            sources[name] = info
            print(f"Prepared {name}: {info['duration']:.2f}s", flush=True)

    # A broad, soft paper rustle: no percussive click, bell, or hard onset.
    rate = 44100
    for name, contacts in [("claim", [0]), ("four", [0, .13, .26, .39])]:
        samples = [0.] * int((contacts[-1] + .36) * rate)
        rng = random.Random(92646)
        for at in contacts:
            low = body = 0.
            for i in range(int(.34 * rate)):
                low += .13 * (rng.uniform(-1, 1) - low)
                body += .018 * (low - body)
                envelope = math.sin(math.pi * i / (.34 * rate)) ** 2
                samples[int(at * rate) + i] += .3 * (low - body) * envelope
        wav = stage / f"{name}.wav"
        with wave.open(str(wav), "wb") as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(rate)
            output.writeframes(array.array("h", [int(max(-.95, min(.95, s)) * 32767) for s in samples]).tobytes())
        ffmpeg(wav, stage / f"{name}.mp3", "anull")
        wav.unlink()
    for name in ["draw", "discard", "celebrate"]:
        shutil.copyfile(root / "table-v2" / f"{name}.mp3", stage / f"{name}.mp3")
    manifest = {"version": 4, "phrases": phrases, "sources": sources,
                "voices": {"male": "AI Voice Generator deep preset (Minh)", "female": "AI Voice Generator crisp preset (Lan, Mai)"},
                "direction": "Synthetic stock voices; deep preserves the approved direction. No named-person cloning or certified regional dialect model.",
                "processing": "Original sources; gentle presence EQ, pitch-preserving 0.65x Chíu/Ù and 0.9x other calls; 44.1kHz/128kbps output.",
                "effects": "Original soft paper claim/four rustles; preserved paper draw/discard and celebration."}
    (stage / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    shutil.copytree(stage, root / "table-v3", dirs_exist_ok=True)
print("Installed 70 voice clips and 5 effects in table-v3")
