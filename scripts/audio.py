#!/usr/bin/env python3
"""Synthesize the original, five-second Pip score (MIT).

No samples, sound libraries, downloaded music or model services are used.
Every oscillator, noise transient and room tap below is made in this script.

    python3 scripts/audio.py
    python3 scripts/audio.py --out assets/audio/sample.wav

Requires NumPy. The output is deterministic stereo PCM16, 48 kHz, exactly 5 s.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import wave

import numpy as np


SR = 48_000
DURATION = 5.0
RNG = np.random.default_rng(24_1107)


def fade(signal: np.ndarray, attack: float = 0.002, release: float = 0.02) -> np.ndarray:
    """Sinusoidal end ramps prevent clicks without flattening the transients."""
    result = signal.copy()
    na = min(len(result), max(1, round(attack * SR)))
    nr = min(len(result), max(1, round(release * SR)))
    result[:na] *= np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    result[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return result


def samples(seconds: float) -> np.ndarray:
    return np.arange(round(seconds * SR), dtype=np.float64) / SR


def note(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def mallet(midi: float, duration: float = 0.65) -> np.ndarray:
    """A soft, rounded wooden bar: a warm fundamental and brief overtones."""
    t = samples(duration)
    f = note(midi)
    body = (
        np.sin(2 * np.pi * f * t) * np.exp(-7.5 * t)
        + 0.24 * np.sin(2 * np.pi * f * 2.003 * t) * np.exp(-15 * t)
        + 0.10 * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-28 * t)
        + 0.035 * np.sin(2 * np.pi * f * 9.0 * t) * np.exp(-70 * t)
    )
    # A felt-covered mallet head; no sharp sine-wave-only onset.
    noise = RNG.normal(0, 1, len(t))
    noise = np.convolve(noise, np.ones(11) / 11, mode="same")
    body += noise * np.exp(-110 * t) * 0.08
    return fade(body, 0.003, 0.045)


def wood(duration: float = 0.2, weight: float = 1.0) -> np.ndarray:
    t = samples(duration)
    noise = RNG.normal(0, 1, len(t))
    noise = np.convolve(noise, np.ones(9) / 9, mode="same")
    body = (
        0.48 * np.sin(2 * np.pi * (176 * t + 9 * (1 - np.exp(-45 * t))))
        * np.exp(-38 * t)
        + 0.32 * np.sin(2 * np.pi * 404 * t) * np.exp(-70 * t)
        + 0.14 * noise * np.exp(-65 * t)
    )
    return fade(body * weight, 0.0008, 0.025)


def kick(duration: float = 0.36) -> np.ndarray:
    t = samples(duration)
    # A short soft drum, with a glide from 91 to 48 Hz.
    phase = 2 * np.pi * (48 * t + 43 / 32 * (1 - np.exp(-32 * t)))
    body = np.sin(phase) * np.exp(-13 * t)
    return fade(body, 0.004, 0.06)


def shaker(duration: float = 0.085) -> np.ndarray:
    t = samples(duration)
    noise = RNG.normal(0, 1, len(t))
    # Gentle high-pass-ish difference; the mix keeps it low enough to feel tactile.
    high = noise - np.convolve(noise, np.ones(13) / 13, mode="same")
    return fade(high * np.exp(-56 * t), 0.006, 0.025)


def glass(midi: float, duration: float = 0.65) -> np.ndarray:
    t = samples(duration)
    f = note(midi)
    s = (
        0.48 * np.sin(2 * np.pi * f * t) * np.exp(-6.0 * t)
        + 0.22 * np.sin(2 * np.pi * f * 2.756 * t) * np.exp(-11 * t)
        + 0.085 * np.sin(2 * np.pi * f * 5.404 * t) * np.exp(-18 * t)
    )
    return fade(s, 0.0025, 0.06)


def sweep(duration: float = 0.45) -> np.ndarray:
    t = samples(duration)
    noise = RNG.normal(0, 1, len(t))
    dark = np.convolve(noise, np.ones(17) / 17, mode="same")
    bright = noise - np.convolve(noise, np.ones(5) / 5, mode="same")
    u = t / duration
    s = (dark * (1 - u) + bright * u * 0.14) * np.sin(np.pi * u) ** 1.5
    return fade(s, 0.03, 0.09)


def main() -> None:
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=project / "assets/audio/sample.wav")
    args = parser.parse_args()
    n = round(DURATION * SR)
    dry = np.zeros((n, 2), np.float64)
    events: list[dict] = []

    def add(start: float, sound: np.ndarray, gain: float, pan: float, name: str) -> None:
        # Equal-power pan in [-1, 1]. The whole palette shares this single room.
        offset = round(start * SR)
        angle = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        stereo = np.column_stack((sound * math.cos(angle), sound * math.sin(angle))) * gain
        end = min(n, offset + len(stereo))
        if offset < n and offset >= 0:
            dry[offset:end] += stereo[: end - offset]
        events.append({"t": start, "name": name, "pan": pan})

    # The pocket is 120 BPM; scene contacts are more prominent than the beat.
    for i, t in enumerate([0.25, 1.25, 2.25, 3.25]):
        add(t, kick(), [0.20, 0.15, 0.12, 0.12][i], 0, "muted kick")
    for i, t in enumerate([0.50, 1.00, 1.50, 2.75, 3.75]):
        add(t, shaker(), 0.022 if i % 2 else 0.032, (-1) ** i * 0.25, "soft shaker")

    # A short original D-major pentatonic answer, kept sparse under the foley.
    for t, pitch, gain, pan in [
        (0.25, 62, 0.14, -0.28),
        (1.00, 66, 0.085, -0.12),
        (1.75, 69, 0.10, 0.12),
        (2.50, 71, 0.10, 0.26),
        (3.50, 69, 0.075, 0.12),
    ]:
        add(t, mallet(pitch), gain, pan, "felt mallet")

    # Character → ideas → unfolding → three rows → final physical stamp.
    add(0.25, wood(0.22), 0.45, -0.63, "Pip landing")
    for t, pitch, pan in [(0.75, 74, -0.35), (1.25, 78, -0.08), (1.75, 81, 0.18)]:
        add(t, wood(0.14, 0.7), 0.30, pan, "idea chip contact")
        add(t + 0.014, glass(pitch, 0.33), 0.055, pan, "idea chip shimmer")
    add(1.92, sweep(0.48), 0.10, 0.12, "Inbox unfurl air")
    add(2.0, wood(0.18, 0.75), 0.25, 0.12, "Inbox hinge")
    add(2.5, glass(78, 0.72), 0.16, 0.20, "card opens")
    for t, pitch, pan in [(3.0, 74, -0.12), (3.25, 78, 0.05), (3.5, 81, 0.23)]:
        add(t, wood(0.11, 0.65), 0.16, pan, "plan row settles")
        add(t, mallet(pitch, 0.4), 0.055, pan, "plan row tone")
    add(4.15, kick(0.40), 0.22, 0.20, "stamp body")
    add(4.15, wood(0.22, 1.15), 0.48, 0.20, "final check stamp")
    for t, pitch, pan in [(4.17, 74, -0.12), (4.20, 78, 0.12), (4.23, 81, 0.30)]:
        add(t, glass(pitch, 0.70), 0.09, pan, "resolved check chord")

    # Compact early reflections: one shared room, no feedback/no swelling tail.
    mix = dry.copy()
    for delay, level, cross in [
        (0.019, 0.12, False),
        (0.037, 0.085, True),
        (0.061, 0.055, False),
        (0.101, 0.035, True),
        (0.163, 0.018, False),
    ]:
        d = round(delay * SR)
        source = dry[:, ::-1] if cross else dry
        mix[d:] += source[:-d] * level

    # Smooth limiter (usually barely touched), remove DC, reserve AAC headroom.
    mix = np.tanh(mix * 1.15) / 1.15
    mix -= mix.mean(axis=0, keepdims=True)
    mix[: round(0.15 * SR)] = 0
    fade_start = round(4.72 * SR)
    mix[fade_start:] *= np.cos(np.linspace(0, np.pi / 2, n - fade_start))[:, None] ** 2
    peak = np.max(np.abs(mix))
    mix *= (10 ** (-3.2 / 20)) / max(peak, 1e-12)
    pcm = np.rint(np.clip(mix, -1, 1) * 32767).astype("<i2")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.out), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())

    stats = {
        "file": str(args.out.resolve().relative_to(Path(__file__).resolve().parents[1])) if args.out.resolve().is_relative_to(Path(__file__).resolve().parents[1]) else args.out.name,
        "duration_seconds": len(pcm) / SR,
        "sample_rate": SR,
        "channels": 2,
        "frames": len(pcm),
        "peak_dbfs": round(float(20 * np.log10(np.max(np.abs(pcm.astype(float))) / 32768)), 2),
        "rms_dbfs": round(float(20 * np.log10(np.sqrt(np.mean((pcm.astype(float) / 32768) ** 2)))), 2),
        "clipped_samples": int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        "seed": 241107,
        "bpm": 120,
        "events": sorted(events, key=lambda e: e["t"]),
    }
    args.out.with_suffix(".json").write_text(json.dumps(stats, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in stats.items() if k != "events"}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
