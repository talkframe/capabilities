#!/usr/bin/env python3
"""Synthesize a test track with a known tempo and a known drop (for trying the pipeline, not for release).

    python3 tools/make_test_song.py --bpm 122 --out build/test/song-122.wav

Eight bars of build (hats, a rising noise sweep, snare roll), then a four-on-the-floor drop with
kick, off-beat bass, claps and a pad. Prints the ground truth so prepare_music.py can be checked.
Everything is generated here, so the file carries no third-party rights.
"""
import argparse, json, os, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(3)


def env(n, att, dec):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(att, 1e-4)) * np.exp(-np.maximum(0, t - att) / dec)


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y


def add(buf, x, at):
    i = int(round(at * SR)); j = min(len(buf), i + len(x))
    if 0 <= i < len(buf): buf[i:j] += x[:j - i]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--bpm', type=float, default=122)
    ap.add_argument('--build-bars', type=int, default=8); ap.add_argument('--drop-bars', type=int, default=14)
    ap.add_argument('--offset', type=float, default=.37); ap.add_argument('--out', default='build/test/song.wav')
    a = ap.parse_args()
    beat = 60 / a.bpm; bar = 4 * beat
    drop = a.offset + a.build_bars * bar
    dur = drop + a.drop_bars * bar + 2
    L = np.zeros(int(dur * SR)); R = np.zeros_like(L)
    n = lambda s: int(s * SR)
    hat = lp(rng.standard_normal(n(.05)), 12000) - lp(rng.standard_normal(n(.05)), 6000); hat *= env(len(hat), .001, .012)
    t = np.arange(n(.45)) / SR
    kick = np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-t / .03)) / SR) * env(len(t), .002, .16)
    clap = lp(rng.standard_normal(n(.2)), 5000) * env(n(.2), .002, .05)
    snare = lp(rng.standard_normal(n(.15)), 7000) * env(n(.15), .001, .04)
    # build: eighth-note hats, snare roll in the last bar, noise sweep
    for k in range(a.build_bars * 8):
        add(L, .18 * hat, a.offset + k * beat / 2); add(R, .18 * hat, a.offset + k * beat / 2)
    for k in range(16):
        s = .05 + .25 * k / 16; at = drop - bar + k * beat / 4
        add(L, s * snare, at); add(R, s * snare, at)
    sweep_len = n(2 * bar); sw = rng.standard_normal(sweep_len)
    sw = lp(sw, 3000) * np.linspace(0, .12, sweep_len)
    add(L, sw, drop - 2 * bar); add(R, sw, drop - 2 * bar)
    # drop: kick on every beat, bass on the off-beats, claps on 2 and 4, a pad per bar
    for k in range(a.drop_bars * 4):
        at = drop + k * beat
        add(L, .9 * kick, at); add(R, .9 * kick, at)
        tb = np.arange(n(beat / 2)) / SR
        bass = lp(np.sign(np.sin(2 * np.pi * 55 * tb)), 400) * env(len(tb), .005, .12) * .35
        add(L, bass, at + beat / 2); add(R, bass, at + beat / 2)
        if k % 4 in (1, 3): add(L, .35 * clap, at); add(R, .35 * clap, at)
        add(L, .14 * hat, at + beat / 2); add(R, .14 * hat, at + beat / 2)
    for b in range(a.drop_bars):
        tp = np.arange(n(bar)) / SR
        chord = sum(np.sin(2 * np.pi * f0 * tp) for f0 in (220, 277.2, 329.6)) * env(len(tp), .05, 1.2) * .05
        add(L, chord, drop + b * bar); add(R, chord * .9, drop + b * bar)
    st = np.stack([L, R], 1); st /= np.abs(st).max() * 1.12
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    w = wave.open(a.out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes()); w.close()
    print(json.dumps({'file': a.out, 'bpm': a.bpm, 'drop': round(drop, 4), 'duration': round(dur, 2)}))


if __name__ == '__main__':
    main()
