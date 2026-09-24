#!/usr/bin/env python3
"""Five laser sounds for KONDRITE, synthesised from nothing.

    python3 projects/kondrite/sounds/make-lasers.py

Writes 16-bit mono .wav files next to this script. Standard library only —
`wave` does the file, `math` and `random` do the sound; no numpy, no samples,
nothing downloaded. Run it again and you get the same bytes (the noise is
seeded), so a regenerated file is a real change and not churn.

Each sound belongs to a gun in the game (`WEAPONS` in index.html):

    laser-cannon   the cannon every ship carries, and every bot's gun
    laser-beam     the industrial beam — a hauler's cutter
    laser-scatter  SCATTER GUN and WAR FAN, several rounds at once
    laser-seeker   SEEKER RACK, WARDEN'S SWARM and BURST CHARGE leaving the rack
    laser-lance    RAIL LANCE — charge, then one heavy slug

The cannon fires several times a second, so it is the shortest and quietest;
the lance fires once every few seconds and is allowed to be the biggest.
"""

import math
import random
import wave
from pathlib import Path

RATE = 44100
PEAK = 0.89          # about -1 dBFS, so nothing clips on playback
HERE = Path(__file__).resolve().parent


# ── building blocks ─────────────────────────────────────────────────────────

def sweep(f0, f1, t, dur):
    """Exponential pitch glide: the laser 'pew' is a pitch falling fast."""
    return f0 * (f1 / f0) ** min(1.0, t / dur)


def square(phase, freq, harmonics=13):
    """Band-limited square from odd harmonics, stopping short of Nyquist so a
    high sweep does not fold back into a whistle."""
    out, k = 0.0, 1
    while k <= harmonics and k * freq < RATE / 2:
        out += math.sin(phase * k) / k
        k += 2
    return out * (4 / math.pi)


def saw(phase, freq, harmonics=16):
    out = 0.0
    for k in range(1, harmonics + 1):
        if k * freq >= RATE / 2:
            break
        out += math.sin(phase * k) / k
    return out * (2 / math.pi)


def env(t, attack, decay):
    """Fast attack, exponential tail."""
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


class Noise:
    """Seeded white noise through a one-pole low-pass, so it can be a hiss
    (high cut-off) or a rumble (low)."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.y = 0.0

    def next(self, cutoff):
        a = 1 - math.exp(-2 * math.pi * cutoff / RATE)
        self.y += a * (self.rng.uniform(-1, 1) - self.y)
        return self.y


def render(dur, voice):
    """Run `voice(t, dt)` once per sample and collect the result."""
    n = int(dur * RATE)
    return [voice(i / RATE, 1 / RATE) for i in range(n)]


def finish(samples):
    """Normalise to PEAK and fade the last few ms so the file never ends on a
    click."""
    top = max(abs(s) for s in samples) or 1.0
    fade = int(0.004 * RATE)
    out = []
    for i, s in enumerate(samples):
        g = PEAK / top
        if i < 32:
            g *= i / 32
        if i > len(samples) - fade:
            g *= (len(samples) - i) / fade
        out.append(s * g)
    return out


def write(name, samples):
    frames = bytearray()
    for s in finish(samples):
        v = max(-32768, min(32767, int(round(s * 32767))))
        frames += v.to_bytes(2, "little", signed=True)
    path = HERE / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)          # 16-bit
        w.setframerate(RATE)
        w.writeframes(bytes(frames))
    print(f"{name:20s} {len(samples) / RATE:5.2f}s  {path.stat().st_size / 1024:5.1f} KB")


# ── the five guns ───────────────────────────────────────────────────────────

def cannon():
    """Short, bright, falling zap. Fired constantly, so it stays small."""
    dur, phase = 0.13, 0.0
    hiss = Noise(1)

    def v(t, dt):
        nonlocal phase
        f = sweep(1500, 220, t, dur * 0.8)
        phase += 2 * math.pi * f * dt
        tone = square(phase, f, 5) * 0.5 + math.sin(phase * 0.5) * 0.4
        crack = hiss.next(3500) * math.exp(-t / 0.01) * 0.5
        return (tone + crack) * env(t, 0.002, 0.04)
    return render(dur, v)


def beam():
    """A hum, not a shot: two detuned saws with a fast wobble. The beam is an
    industrial's cannon and fires at the cannon's rate, three to eight times a
    second, so it has to be over before the next one starts — a long hum
    stacked eight deep is a drone, and a drone is the most annoying sound a
    game can make."""
    dur, p1, p2 = 0.17, 0.0, 0.0
    hiss = Noise(2)

    def v(t, dt):
        nonlocal p1, p2
        wob = 1 + 0.03 * math.sin(2 * math.pi * 34 * t)
        f = sweep(520, 360, t, dur) * wob
        p1 += 2 * math.pi * f * dt
        p2 += 2 * math.pi * f * 1.012 * dt
        tone = saw(p1, f, 8) * 0.5 + saw(p2, f * 1.012, 8) * 0.5
        tone += math.sin(p1 * 0.5) * 0.35
        fizz = hiss.next(2500) * 0.1
        return (tone + fizz) * env(t, 0.008, 0.05)
    return render(dur, v)


def scatter():
    """Three rounds at once: three short chirps a hair apart, each a little
    off pitch from the others, over a crackle."""
    dur = 0.24
    # Lower than they started out: three bright squares at 2.6-3 kHz sat right
    # where hearing is most sensitive and measured as the harshest thing here.
    shots = [(0.000, 1500, 1.00), (0.022, 1300, 0.85), (0.041, 1700, 0.75)]
    phases = [0.0, 0.0, 0.0]
    hiss = Noise(3)

    def v(t, dt):
        out = 0.0
        for i, (start, f0, level) in enumerate(shots):
            u = t - start
            if u < 0:
                continue
            f = sweep(f0, 300, u, 0.09)
            phases[i] += 2 * math.pi * f * dt
            tone = square(phases[i], f, 3) * 0.5 + math.sin(phases[i]) * 0.5
            out += tone * env(u, 0.0015, 0.03) * level
        out += hiss.next(2500) * math.exp(-t / 0.03) * 0.3
        return out
    return render(dur, v)


def seeker():
    """A missile leaving the rack: a rising whoosh with a warble, so it reads
    as something that is going to keep going."""
    dur, phase = 0.55, 0.0
    air = Noise(4)

    def v(t, dt):
        nonlocal phase
        f = sweep(260, 1500, t, dur * 0.7)
        f *= 1 + 0.06 * math.sin(2 * math.pi * 17 * t)
        phase += 2 * math.pi * f * dt
        tone = saw(phase, f, 10) * 0.45
        whoosh = air.next(600 + 2400 * min(1.0, t / 0.3)) * 0.9
        thump = math.sin(2 * math.pi * 70 * t) * math.exp(-t / 0.04) * 0.8
        shape = min(1.0, t / 0.03) * math.exp(-max(0.0, t - 0.12) / 0.16)
        return (tone + whoosh) * shape + thump
    return render(dur, v)


def lance():
    """Charge, then crack. A rising whine for a tenth of a second, then a huge
    falling discharge with a noise burst under it."""
    charge, dur = 0.12, 0.7
    phase, sub = 0.0, 0.0
    crack = Noise(5)
    rumble = Noise(6)

    def v(t, dt):
        nonlocal phase, sub
        if t < charge:
            f = sweep(420, 2200, t, charge)
            phase += 2 * math.pi * f * dt
            return math.sin(phase) * (t / charge) * 0.35
        u = t - charge
        f = sweep(2200, 70, u, 0.35)
        phase += 2 * math.pi * f * dt
        sub += 2 * math.pi * 55 * dt
        tone = square(phase, f, 5) * 0.5 * env(u, 0.001, 0.1)
        body = math.sin(sub) * 0.7 * env(u, 0.004, 0.2)
        snap = crack.next(3500) * math.exp(-u / 0.015) * 1.0
        roll = rumble.next(300) * math.exp(-u / 0.25) * 2.5
        return tone + body + snap + roll
    return render(dur, v)


if __name__ == "__main__":
    write("laser-cannon.wav", cannon())
    write("laser-beam.wav", beam())
    write("laser-scatter.wav", scatter())
    write("laser-seeker.wav", seeker())
    write("laser-lance.wav", lance())
