#!/usr/bin/env python3
"""Fit the 12-bar template to a song.

    python3 tools/prepare_music.py song.mp3 [--target 25] [--drop 62.9] [--bpm 122]

1. estimate tempo from spectral flux, refine it on the kick band
2. fold half/double time so one bar lands between ~1.5 s and ~3 s
3. find the drop (largest low-band energy jump between bars) unless --drop is given
4. least-squares fit of the beat grid to the measured kick hits around the drop
5. cut the excerpt so the drop lands on bar 3, beat 1, and size the film around 12 bars

Writes build/grid.json and build/grid.js. The page, the SFX and finish.sh all read it, so
changing the song re-times every cut, click and reveal. Needs ffmpeg and numpy.
"""
import argparse, json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
BARS, PRE_BARS = 12, 2          # template structure: 12 bars, drop on bar 3
SR = 44100


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def spectra(x, n, hop):
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1))
    f = np.fft.rfftfreq(n, 1 / SR)
    t = (np.arange(len(S)) * hop + n / 2) / SR
    return S, f, t


def pos(v): return np.maximum(v, 0)


def detrend(v, k=32): return pos(v - np.convolve(v, np.ones(k) / k, 'same'))


def estimate_tempo(x):
    S, f, t = spectra(x, 1024, 512)
    fps = SR / 512
    flux = detrend(np.r_[0, pos(np.diff(np.log1p(S * 10), axis=0)).sum(1)])
    ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]
    lags = np.arange(len(ac)); bpms = 60 * fps / np.maximum(lags, 1)
    m = (bpms >= 70) & (bpms <= 190)
    bpm = float(bpms[m][np.argmax(ac[m])])
    low = S[:, (f >= 35) & (f <= 130)].sum(1)
    kick = detrend(np.r_[0, pos(np.diff(np.log1p(low * 10)))])
    best = (0, bpm)
    for b in np.arange(bpm * .98, bpm * 1.02, .01):   # refine on the kick comb
        ph = (t % (60 / b)) / (60 / b) * 2 * np.pi
        z = abs((kick * np.exp(1j * ph)).sum())
        if z > best[0]: best = (z, b)
    return best[1], S, f, t, low, kick


def fold(bpm):
    """Grid beat so that a 4-beat bar is ~1.5-3 s (80-160 BPM)."""
    factor = 1.0
    while bpm / factor > 160: factor *= 2
    while bpm / factor < 80: factor /= 2
    return bpm / factor, factor


def beat_phase(t, kick, beat):
    """Offset of the beat grid that collects the most kick onsets."""
    cands = np.arange(0, beat, .004)
    score = [kick[np.searchsorted(t, np.arange(c, t[-1], beat)).clip(0, len(t) - 1)].sum() for c in cands]
    return float(cands[int(np.argmax(score))])


def find_drop(t, low, beat, dur, phase0):
    bar = 4 * beat
    lowE = low / (low.max() + 1e-9)
    best = None
    for phase in range(4):  # which beat of the bar is the downbeat
        edges = np.arange(phase0 + phase * beat, dur - bar, bar)
        e = [lowE[(t >= a) & (t < a + bar)].mean() for a in edges]
        for i in range(2, len(e)):
            a = edges[i]
            if a < PRE_BARS * bar or a + (BARS - PRE_BARS) * bar > dur: continue
            jump = e[i] - (e[i - 1] + e[i - 2]) / 2
            if best is None or jump > best[0]: best = (jump, a)
    return best[1] if best else None


def calibrate(x, drop, beat, win=.06):
    """Fit t = t0 + k * P to kick onsets near the drop; returns t0 (drop downbeat), P, residuals."""
    w0, w1 = max(0.0, drop - 14), drop + 28
    xs = x[int(w0 * SR):int(w1 * SR)]
    S, f, t = spectra(xs, 2048, 64)
    t = t + w0
    low = S[:, (f >= 35) & (f <= 120)].sum(1)
    lf = np.r_[0, pos(np.diff(np.log1p(low)))]
    obs, strength = [], []
    for k in range(-int((drop - w0) / beat), int((w1 - drop) / beat)):
        bt = drop + k * beat; m = (t > bt - win) & (t < bt + win)
        if not m.any(): continue
        i = np.argmax(lf[m]); obs.append((k, t[m][i])); strength.append(lf[m][i])
    obs, strength = np.array(obs), np.array(strength)
    use = (obs[:, 0] >= 0) & (strength > np.percentile(strength, 40))
    A = np.c_[np.ones(use.sum()), obs[use, 0]]
    (t0, P), *_ = np.linalg.lstsq(A, obs[use, 1], rcond=None)
    res = obs[use, 1] - (t0 + P * obs[use, 0])
    return float(t0), float(P), res, int(use.sum())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('song'); ap.add_argument('--target', type=float, default=25.0)
    ap.add_argument('--drop', type=float, help='drop time in seconds (skip detection)')
    ap.add_argument('--bpm', type=float, help='tempo hint (skip estimation)')
    a = ap.parse_args()
    x = decode(a.song); dur = len(x) / SR
    bpm, S, f, t, low, kick = estimate_tempo(x)
    if a.bpm: bpm = a.bpm
    grid_bpm, factor = fold(bpm)
    beat = 60 / grid_bpm
    phase0 = beat_phase(t, kick, beat)
    drop = a.drop if a.drop is not None else find_drop(t, low, beat, dur, phase0)
    if drop is None: sys.exit('no drop found with 2 bars before and 10 bars after it; pass --drop SECONDS')
    # two passes: a wide window finds the kicks, a tight one fits the grid to them
    t0, P, _, _ = calibrate(x, drop, beat, win=beat * .3)
    t0, P, res, n = calibrate(x, t0, P)
    P_song = P * factor
    bar = 4 * P
    start = t0 - PRE_BARS * bar
    body = BARS * bar
    tail = min(2.5, max(.9, a.target - body))
    total = round(body + tail, 3)
    fade = round(total - min(.9, tail), 3)
    grid = dict(song=os.path.abspath(a.song), bpmMeasured=round(60 / P_song, 3), gridBpm=round(60 / P, 3), fold=factor,
                P=P, t0=t0, start=start, bar=bar, bars=BARS, drop=t0, total=total, fadeStart=fade,
                kicksFitted=n, residualMedianMs=round(float(np.median(np.abs(res)) * 1000), 1),
                residualMaxMs=round(float(np.abs(res).max() * 1000), 1))
    os.makedirs(BUILD, exist_ok=True)
    sub = os.path.join(BUILD, 'subframes')
    if os.path.isdir(sub):   # frame timings changed; stale sub-frames would be reused by render.mjs full
        import shutil; shutil.rmtree(sub); print('removed stale build/subframes')
    json.dump(grid, open(os.path.join(BUILD, 'grid.json'), 'w'), indent=1)
    open(os.path.join(BUILD, 'grid.js'), 'w').write('window.GRID=' + json.dumps({k: grid[k] for k in ('P', 'start', 'total', 'fadeStart', 'bar')}) + ';\n')
    print(f"tempo {grid['bpmMeasured']} BPM -> grid {grid['gridBpm']} BPM (fold x{factor:g}), bar {bar:.3f}s")
    print(f"drop at {t0:.3f}s in the song; excerpt starts {start:.3f}s; film {total}s (12 bars {body:.2f}s + tail {tail:.2f}s)")
    print(f"grid fit on {n} kicks: residual median {grid['residualMedianMs']} ms, max {grid['residualMaxMs']} ms")
    warn = []
    if start < 0: warn.append('the drop is too early for 2 bars of lead-in; pass --drop for a later one')
    if start + total > dur: warn.append('the song ends before the film does')
    if abs(total - a.target) > .5: warn.append(f'film is {total}s, not {a.target}s: at {grid["gridBpm"]} BPM twelve bars take {body:.1f}s')
    if grid['residualMedianMs'] > 12: warn.append('kick fit is loose (>12 ms); check --bpm or --drop')
    for w in warn: print('WARNING:', w)
    print('next: node tools/render.mjs lint')


if __name__ == '__main__':
    main()
