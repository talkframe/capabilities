#!/usr/bin/env python3
"""Synthesize the SFX from build/cues.json and mix them under build/music.wav.

Each cue's *measured* peak (4 ms smoothed envelope argmax), not its file start, is placed on the
cue time. Gains are relative to the music's RMS and capped at -3 dB under the music around the
cue (quiet intros duck the SFX automatically); the script reports, per cue, how far the SFX sit
below the music in a 50 ms window and fails if any cue is louder than the music there.
All sounds are generated here (no samples), so they carry no third-party rights.
"""
import json, os, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
SR = 48000
WIN = 1200   # +-25 ms: the window used both to cap each cue and to check it
rng = np.random.default_rng(7)


def rd(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x.reshape(-1, w.getnchannels())


def wr(p, x):
    w = wave.open(p, 'wb'); w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()


def seconds(d): return np.arange(int(d * SR)) / SR


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y


def hp(x, fc): return x - lp(x, fc)


def env(n, att, dec):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(att, 1e-4)) * np.exp(-np.maximum(0, t - att) / dec)


def tick(f=2600, d=.05, **_):
    t = seconds(d)
    return np.sin(2 * np.pi * f * t) * env(len(t), .001, .012) + .3 * hp(rng.standard_normal(len(t)), 4000) * env(len(t), .0005, .004)


def key(**_):
    t = seconds(.04)
    return lp(hp(rng.standard_normal(len(t)), 1800), 7000) * env(len(t), .0008, .006) * .9 + np.sin(2 * np.pi * 1400 * t) * env(len(t), .001, .008) * .3


def click(**_):
    t = seconds(.06)
    return lp(hp(rng.standard_normal(len(t)), 900), 5000) * env(len(t), .0005, .005) + np.sin(2 * np.pi * 900 * t) * env(len(t), .001, .01) * .5


def swish(d=.35, f0=800, f1=5000, peak=.6, **_):
    n = int(d * SR); t = np.arange(n) / SR
    return hp(lp(rng.standard_normal(n), f1), f0) * np.exp(-((t / d - peak) / .22) ** 2)


def boom(**_):
    t = seconds(1.2); f = 38 + 40 * np.exp(-t / .08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .004, .35) + .25 * lp(rng.standard_normal(len(t)), 200) * env(len(t), .002, .05)


def thud(**_):
    t = seconds(.5); f = 60 + 50 * np.exp(-t / .04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .003, .12)


def ping(f=1318.5, **_):
    t = seconds(.7)
    return (np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * np.sin(2 * np.pi * 3.01 * f * t)) * env(len(t), .002, .16)


def whoosh(d=1.0, **_):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    return (lp(x, 600) * .8 + hp(lp(x, 3500), 600)) * np.exp(-((t / d - .5) / .18) ** 2)


SOUNDS = dict(tick=tick, key=key, click=click, swish=swish, boom=boom, thud=thud, ping=ping, whoosh=whoosh)


def peak_idx(x):
    k = int(.004 * SR); return int(np.argmax(np.convolve(np.abs(x), np.ones(k) / k, 'same')))


def main():
    cues = json.load(open(os.path.join(BUILD, 'cues.json')))
    m = rd(os.path.join(BUILD, 'music.wav')); N = len(m); mono = m.mean(1)
    body = mono[int(min(4, N / SR / 4) * SR):int(N * .92)]
    music_rms = float(np.sqrt(np.mean(body ** 2)))
    bus = np.zeros(N, np.float32); rows = []
    for c in cues:
        x = SOUNDS[c['type']](**{k: v for k, v in c.items() if k not in ('t', 'type', 'gain')})
        x = x / np.max(np.abs(x)); pi = peak_idx(x); start = int(round(c['t'] * SR)) - pi
        g = 10 ** (c['gain'] / 20) * music_rms * 2.2
        # never louder than the music where it lands: cap at -3 dB against the local music level
        i = int(c['t'] * SR); w = slice(max(0, i - WIN), min(N, i + WIN)); wx = slice(max(0, pi - WIN), pi + WIN)
        local = np.sqrt(np.mean(mono[w] ** 2)) + 1e-9; own = np.sqrt(np.mean(x[wx] ** 2)) + 1e-9
        g = min(g, local * 10 ** (-3 / 20) / own)
        a, b = max(0, start), min(N, start + len(x))
        if a < b: bus[a:b] += g * x[a - start:b - start]
        rows.append([c['type'], c['t'], (start + pi) / SR])
    worst = -99
    for r in rows:
        i = int(r[1] * SR); w = slice(max(0, i - WIN), i + WIN)
        db = 20 * np.log10((np.sqrt(np.mean(bus[w] ** 2)) + 1e-9) / (np.sqrt(np.mean(mono[w] ** 2)) + 1e-9))
        r.append(db); worst = max(worst, db)
    wr(os.path.join(BUILD, 'sfx.wav'), np.stack([bus, bus], 1))
    wr(os.path.join(BUILD, 'mix_pre.wav'), (m + np.stack([bus, bus], 1)) * .6)   # headroom before loudnorm
    for t, at, peak, db in rows: print(f'{t:7s} cue {at:7.3f}s  peak {peak:7.3f}s  {db:6.1f} dB vs music')
    print(f'{len(rows)} cues, loudest {worst:.1f} dB relative to the music')
    if worst >= 0: sys.exit('an SFX is louder than the music around its cue; lower its gain in the page CUES')


if __name__ == '__main__':
    main()
