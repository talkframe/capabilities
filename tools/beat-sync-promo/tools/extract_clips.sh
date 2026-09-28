#!/usr/bin/env bash
# Cut real footage into the 30 fps 540x960 JPEG sequences the template plays.
#   tools/extract_clips.sh clips.txt
# clips.txt: <id> <video> <start_s> <centre_x 0..1 | -1 already vertical> [top 0..1 = 0.14] [seconds = 10]
# Quote paths that contain spaces: hero "my footage/river.mp4" 12 0.74
# Landscape sources are cut to the centre 72% of their height (drops half-cropped titles and
# caption bars), then to 9:16 around centre_x. Ids the template uses: c01, c03..c15 and hero.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; LIST="${1:-$ROOT/clips.txt}"
mkdir -p "$ROOT/build/clips"
while IFS=$'\t' read -r id src t cx yy dur; do
  yy=${yy:-0.14}; dur=${dur:-10}; out="$ROOT/build/clips/$id"; rm -rf "$out"; mkdir -p "$out"
  [[ "$src" = /* ]] || src="$ROOT/$src"
  W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$src")
  H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$src")
  if [ "$cx" = "-1" ]; then vf="scale=540:960:force_original_aspect_ratio=increase,crop=540:960"
  else vf=$(python3 -c "W,H=$W,$H;h=int(H*.72);w=int(h*9/16);y=int(H*$yy);x=max(0,min(W-w,int($cx*W-w/2)));print(f'crop={w}:{h}:{x}:{y},scale=540:960:flags=lanczos')"); fi
  ffmpeg -v error -y -ss "$t" -i "$src" -t "$dur" -vf "fps=30,$vf" -q:v 3 "$out/%04d.jpg"
  echo "$id $(ls "$out" | wc -l | tr -d ' ') frames"
done < <(python3 -c "import shlex,sys
for l in open(sys.argv[1]):
    if l.strip() and not l.lstrip().startswith('#'): print('\t'.join(shlex.split(l)))" "$LIST")
python3 "$ROOT/tools/clip_counts.py"
