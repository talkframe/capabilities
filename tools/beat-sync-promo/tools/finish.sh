#!/usr/bin/env bash
# Music excerpt + synthesized SFX -> -14 LUFS mix; 3 sub-frames per frame -> tmix -> 60 fps H.264.
# Reads build/grid.json (from prepare_music.py) and build/subframes (from render.mjs full).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; B="$ROOT/build"; cd "$ROOT"
read -r START TOTAL FADE SONG < <(python3 -c "import json,sys;g=json.load(open(sys.argv[1]));print(g['start'],g['total'],g['fadeStart'],g['song'])" "$B/grid.json")
FADE_D=$(python3 -c "print(round($TOTAL-$FADE,3))")
# trim inside the filter graph: an output-side -ss would leave afade on the song's own clock (silent result)
ffmpeg -v error -y -i "$SONG" -af "aresample=48000,atrim=start=$START:duration=$TOTAL,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.012,afade=t=out:st=$FADE:d=$FADE_D" -ac 2 "$B/music.wav"
node tools/render.mjs cues
python3 tools/sfx.py | tail -1
# two-pass loudnorm, then a 4x-oversampled limiter at -1.9 dBFS: dynamic songs can defeat linear
# loudnorm's peak target, and AAC encoding adds ~0.3 dB of true peak
J=$(ffmpeg -hide_banner -i "$B/mix_pre.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
MI=$(echo "$J" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -v error -y -i "$B/mix_pre.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11:${MI}:linear=true,aresample=192000,alimiter=limit=0.8:attack=1:release=60:level=disabled,aresample=48000" -ar 48000 "$B/mix.wav"
# frame n = mean of sub-frames (t-1/240, t, t+1/240)
ffmpeg -v error -y -framerate 180 -i "$B/subframes/s%05d.jpg" -i "$B/mix.wav" \
  -filter_complex "[0:v]tmix=frames=3:weights='1 1 1',select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),format=yuv420p[v]" \
  -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 15 -profile:v high -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 320k -shortest "$B/promo.mp4"
ffmpeg -hide_banner -i "$B/promo.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E " I:| Peak:" || true
echo "-> build/promo.mp4 ($(python3 -c "print($TOTAL)") s)"
