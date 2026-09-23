"""Build the first table sound pack. Requires macOS Linh voice, say and ffmpeg.

Voices are synthesized Vietnamese, not recordings or imitations of family members.
Effects are original procedural percussion/chimes. No downloaded samples.
Run: python3 apps/web/scripts/generateTableAudio.py
"""
from pathlib import Path
import array
import argparse
import json
import math
import random
import subprocess
import tempfile
import wave

DEST = Path(__file__).resolve().parents[1] / "public/audio/table-v1"
DEST.mkdir(parents=True, exist_ok=True)
RATE = 24000
random.seed(92646)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--only", nargs="+", help="Regenerate only these named clips")
selected = parser.parse_args().only

def encode(source, target, voice=False):
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source)]
    if voice:
        args += ["-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08"]
    args += ["-ar", str(RATE), "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", "-threads", "1", str(DEST / f"{target}.mp3")]
    subprocess.run(args, check=True)

calls = {"boc": ("Bốc!", 190), "an": ("Ăn!", 205), "chiu": ("Chíu!", 185), "win": ("Ù! Ù rồi!", 190), "chiu-win": ("Chíu! Ù luôn!", 195)}
ranks = ["Nhất", "Nhì", "Tam", "Tứ", "Ngũ", "Lục", "Thất", "Bát", "Cửu"]
for rank, name in enumerate(ranks, 1):
    for suit, label in [("van", "Vạn"), ("vanh", "Văn"), ("sach", "Sách")]:
        calls[f"card-{rank}_{suit}"] = (f"{name} {label}.", 200)
calls.update({"card-chi": ("Chi Chi.", 200), "card-lao": ("Lão.", 200), "card-thang": ("Thang.", 200)})

def percussion(samples, at, gain, frequency=1300, length=0.12):
    start = int(at * RATE)
    for i in range(int(length * RATE)):
        t = i / RATE
        # A short, dry tile-on-table sound with a softer low body.
        sample = (0.65 * random.uniform(-1, 1) + 0.35 * math.sin(2 * math.pi * frequency * t)) * math.exp(-t * 65)
        if start + i < len(samples): samples[start + i] += gain * sample * min(1, t * 2500)

def bell(samples, at, frequency, gain=0.1, length=0.4):
    start = int(at * RATE)
    for i in range(int(length * RATE)):
        t = i / RATE
        sample = (math.sin(2 * math.pi * frequency * t) + 0.2 * math.sin(2 * math.pi * frequency * 2 * t)) * math.exp(-t * 8) * min(1, t * 180)
        if start + i < len(samples): samples[start + i] += gain * sample

def paper_card(samples, flip=True):
    """Filtered paper rustle, then a damped, soft card landing on wood."""
    rng = random.Random(92646)  # Reproducible even when generating just this clip.
    low = body = 0.0
    landing = .285 if flip else .012
    for i in range(len(samples)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low += .24 * (noise - low)
        body += .045 * (noise - body)
        if flip and .015 < t < .34:
            phase = (t - .015) / .325
            sweep = math.sin(math.pi * phase) ** 1.6
            flutter = .7 + .3 * math.sin(2 * math.pi * (19 * t + 28 * t * t)) ** 2
            samples[i] += .24 * (low - body) * sweep * flutter
        age = t - landing
        if age >= 0:
            envelope = (1 - math.exp(-age * 650)) * math.exp(-age * 38)
            wood = .55 * math.sin(2 * math.pi * 185 * age) + .22 * math.sin(2 * math.pi * 310 * age)
            samples[i] += .14 * (wood + .65 * low) * envelope

with tempfile.TemporaryDirectory(prefix="chan-audio-") as temporary:
    tmp = Path(temporary)
    for name, (phrase, speed) in calls.items():
        if selected and name not in selected: continue
        source = tmp / "voice.aiff"
        subprocess.run(["say", "-v", "Linh", "-r", str(speed), "-o", str(source), phrase], check=True)
        encode(source, name, voice=True)
    for name, seconds in [("draw", .48), ("discard", .22), ("claim", .4), ("four", .7), ("celebrate", 1.65)]:
        if selected and name not in selected: continue
        samples = [0.0] * int(seconds * RATE)
        if name == "draw": paper_card(samples)
        if name == "discard": paper_card(samples, flip=False)
        if name == "claim":
            for at in [0, .07]: percussion(samples, at, .34)
            bell(samples, .1, 880, .06, .25)
        if name == "four":
            for at in [0, .055, .12, .19]: percussion(samples, at, .42, 1100)
            for at, hz in [(.12, 660), (.24, 880)]: bell(samples, at, hz, .09)
        if name == "celebrate":
            for at, hz in [(0, 523.25), (.12, 659.25), (.24, 783.99), (.4, 1046.5)]: bell(samples, at, hz, .13, .65)
            for i in range(13): percussion(samples, .42 + i * .074 + random.uniform(0, .035), .14, 1500, .1)
        source = tmp / "effect.wav"
        pcm = array.array("h", [int(max(-.95, min(.95, v)) * 32767) for v in samples])
        with wave.open(str(source), "wb") as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(RATE); output.writeframes(pcm.tobytes())
        encode(source, name)

(DEST / "manifest.json").write_text(json.dumps({"version": 2, "voice": "macOS Linh (vi_VN), synthetic speech", "effects": "Original procedural paper flips, soft wood landings, percussion and chimes", "phrases": {name: phrase for name, (phrase, _) in calls.items()}}, ensure_ascii=False, indent=2) + "\n")
print(f"Generated {', '.join(selected) if selected else 'all Vietnamese clips and effects'} in {DEST}")
