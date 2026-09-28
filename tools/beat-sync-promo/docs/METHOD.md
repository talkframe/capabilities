# Method

A promo film cut to music works when two things hold together: every change lands on the song's
real beat, and nothing changes faster than people can read. This file is the checklist behind
the template. [METHOD.zh.md](METHOD.zh.md) is the Chinese version.

## 1. Measure the grid, never trust the nominal BPM

- `prepare_music.py` estimates tempo from spectral flux, refines it on the kick band, then fits
  `t = t0 + k·P` by least squares to the measured kick onsets around the drop. A track labelled
  120 BPM measured 121.99: at 120 the cuts would drift half a beat by bar 12.
- Keep the median residual under ~10 ms (less than one 60 fps frame). On the synthetic test
  songs the fit lands within 0.2-0.4 ms of the grid and 11-15 ms of the true onset.
- Do not time-stretch licensed music (most free licences forbid remixing). Fit the film to the song.
- Cut the excerpt so the drop lands on a planned bar line. The template puts it on bar 3 beat 1,
  the moment the circle opens from the button.
- Tempo folds so a bar lasts 1.5-3 s (80-160 BPM grid). A 300 BPM reading of a 150 BPM track is
  folded back; very slow or very fast songs change the film length, and the script says so.

## 2. Express every time as `bt(bar, beat)`

No literal seconds in the timeline. That is what makes a new song re-time the whole film.

- Cuts land on downbeats; UI interactions on beats, eighths or sixteenths (typing on sixteenths).
- Motion *starts* on the beat: reveals use outExpo and are ~80% done in 0.1 s, so they read as
  hits. Big moves invert this: peak speed between beats, **coming to rest on the next downbeat**
  (the carousel whip lands the hero clip exactly on bar 8).
- One idea per shot; a big move may take two bars (one of drift, one of whip).
- One slow push-in per shot (scale 1.00 → 1.03, inOutSine). No shake, no bounce.

## 3. Pacing budget: the beat says *when* things may change, the budget says *whether*

The first cut of the reference film changed the picture seven times in four seconds (three hard
cuts, then a word roller). Every change was on a beat and it still felt frantic: at 122 BPM a beat
is under half a second. `node tools/render.mjs lint` checks the page's `PACING` manifest against:

| Rule | Minimum |
|---|---|
| hard cut to hard cut | 1 bar (~2 s) |
| replacing content in place (word roller, card flip) | 2 beats (~1 s) |
| time a text stays readable | 0.25 s + 0.1 s per CJK character, number or Latin word |

- **Adding is not switching.** Items that join the same frame on beats 1, 2, 3 are fine, because
  earlier items stay. Prefer "add" to "replace" when you want to hit beats.
- **Budget before you storyboard.** Sum the minimum holds; if they exceed the length, drop the
  shot that says least (the reference cut its word roller). Never solve it by cutting faster.
- The lint is advice by default (exit 0); `--strict` makes it a gate for CI.

## 4. Sound

- SFX are synthesized in `tools/sfx.py` (no samples, no rights to clear).
- Place each sound by its **measured peak**, not its file start: a whoosh peaks at the whip's top
  speed, a click on the press.
- Keep every cue under the music where it lands: gains are capped at -3 dB against the local
  music level, which ducks them automatically in quiet intros.
- Loudness: two-pass loudnorm to -14 LUFS, then a limiter; AAC adds ~0.3 dB of true peak, so the
  mix aims at -1.9 dBFS.

## 5. Picture

- The page is a pure function of time. `renderAt(t, ft)`: `t` (the sub-frame) drives motion, `ft`
  (the frame centre) picks the shot, so sub-frame blur never ghosts across a hard cut.
- Three sub-frames (t ± 1/240 s) blended with `tmix` give real motion blur at 60 fps. They are not
  enough for large fast edges: the expanding circle got grey rings until its edge was feathered
  by the distance it travels within one sub-frame span. The whip adds a horizontal SVG blur that
  follows angular speed, on a non-3D wrapper.
- Measure match-cut positions at runtime (hook word → file chip, button → circle, hero card →
  phone screen).
- Never put `opacity` or `filter` on a `preserve-3d` element; it flattens and both faces show.
  Fade and blur the wrapper.
- Clips are JPEG sequences swapped per frame; `await img.decode()` before the screenshot.
- Frames are independent, so several pages render slices in parallel (4,500 sub-frames in about a
  minute on an M-series Mac). Delete a range of `build/subframes` to re-render just that range.

## 6. Content rules

- **Real footage only** in anything you publish. `make_test_clips.sh` is a stand-in for trying the
  pipeline.
- Numbers on screen must be verifiable and about what the product gives its users (templates,
  licensed tracks, where it runs), not a developer machine's history. Record the source of each.
- If "on device" has an exception, say so on screen.
- No full stops on screen. One accent colour; on a light background use it as a block behind dark
  text, not as text colour.
- Cropping landscape footage to 9:16: take the centre 72% of the height so slide titles and caption
  bars never appear half cut; skip end cards and other brands' logos.

## 7. Pitfalls we hit

| Symptom | Cause / fix |
|---|---|
| grey rings on the expanding circle | 3 sub-frames under-sample big fast edges; feather the edge analytically |
| flying text, cursor or circle invisible | sections had z-index, overlays did not |
| next shot's fade-in hidden | previous shot's background covered it; use a separate paper layer |
| wordmark over the mark | move the mark first, reveal the word 0.3 s later |
| silent music excerpt | output-side `-ss` leaves `afade` on the song clock; trim with `atrim,asetpts` |
| loudnorm reports TP > 0 | the mix clipped in int16 before normalising; scale it down first |
| `$var:linear` truncated in zsh | zsh history modifiers; write `${var}` |
| Playwright cannot find a browser | `render.mjs` tries installed Chrome, then `npx playwright install chromium` |
