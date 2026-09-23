"""Import AI Voice Generator clips for the table-v2 pack.

Usage: python3 apps/web/scripts/importTableVoices.py generation-results.json
Input maps each clip name to its create_audio structuredContent. Generate each
phrase in table-v1/manifest.json with voice_id=deep and preview_transcript equal
to the full phrase. Provider previews expire; imported game assets do not.
Requires ffmpeg. Leaves table-v1 unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("results", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / "public/audio"
old = root / "table-v1"
destination = root / "table-v2"
manifest = json.loads((old / "manifest.json").read_text())
results = json.loads(args.results.read_text())
assert set(results) == set(manifest["phrases"]), "All 35 voices are required"
assert all(r["status"] == "ready" and r["voice_id"] == "deep" for r in results.values())
assert all(r["preview_transcript"] == manifest["phrases"][name] for name, r in results.items())

# Finish every download and decode before making the new pack available.
with tempfile.TemporaryDirectory(prefix="chan-voices-") as directory:
    stage = Path(directory)
    sources = {}
    for name, result in results.items():
        source = stage / "source.mp3"
        with urllib.request.urlopen(result["preview_url"], timeout=45) as response:
            source.write_bytes(response.read())
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-af", "silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,loudnorm=I=-20:TP=-3:LRA=7,apad=pad_dur=0.08",
            "-ar", "24000", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k",
            "-threads", "1", str(stage / f"{name}.mp3"),
        ], check=True)
        duration = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(stage / f"{name}.mp3")
        ]))
        assert .15 < duration < 8, f"Unexpected duration: {name}: {duration}"
        sources[name] = {"context_id": result["context_id"], "sha256": hashlib.sha256((stage / f"{name}.mp3").read_bytes()).hexdigest()}
        print(f"Prepared {name}: {duration:.2f}s", flush=True)
    for name in ["draw", "discard", "claim", "four", "celebrate"]:
        shutil.copyfile(old / f"{name}.mp3", stage / f"{name}.mp3")
    manifest.update(version=3, voice="AI Voice Generator, deep preset, synthetic Vietnamese speech",
                    direction="User-approved audition direction toward family Bắc 54 accent; not a named speaker clone or certified dialect model.",
                    sources=sources)
    (stage / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    destination.mkdir(exist_ok=True)
    for path in stage.iterdir():
        if path.name != "source.mp3": shutil.copyfile(path, destination / path.name)
print(f"Installed 35 voices and 5 preserved effects in {destination}")
