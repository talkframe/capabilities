#!/usr/bin/env bash
# Synthetic moving footage for trying the pipeline without your own videos.
# The method asks for real footage in anything you publish; these are only a stand-in.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; mkdir -p "$ROOT/build/clips"
ids=(c01 c03 c04 c05 c06 c07 c08 c09 c10 c11 c12 c13 c14 c15 hero)
for i in "${!ids[@]}"; do
  id=${ids[$i]}; out="$ROOT/build/clips/$id"; rm -rf "$out"; mkdir -p "$out"
  case $((i % 4)) in
    0) src="gradients=s=540x960:n=3:speed=0.02:seed=$((i*7+1)):type=radial" ;;
    1) src="gradients=s=540x960:n=4:speed=0.015:seed=$((i*5+3)):type=linear" ;;
    2) src="mandelbrot=s=540x960:start_scale=$((2+i%3)):end_scale=0.3:inner=convergence" ;;
    3) src="life=s=135x240:mold=10:r=30:ratio=0.1:death_color=#10131a:life_color=#c9f65a,scale=540:960:flags=neighbor" ;;
  esac
  ffmpeg -v error -y -f lavfi -i "$src" -t 10 -vf "fps=30,eq=saturation=0.35:brightness=-0.06:contrast=0.9,format=yuv420p" -q:v 4 "$out/%04d.jpg"
  echo "$id $(ls "$out" | wc -l | tr -d ' ') frames (synthetic)"
done
python3 "$ROOT/tools/clip_counts.py"
