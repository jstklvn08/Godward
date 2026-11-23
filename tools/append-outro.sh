#!/bin/bash
# Append the channel outro to a rendered episode.
#   tools/append-outro.sh videos/<slug>/<slug>-vertical.mp4   -> writes <slug>-vertical-outro.mp4 next to it
# Episode and outro are joined with ffmpeg's concat filter and re-encoded in ONE pass with render.js's hq settings (render.js writes a near-lossless intermediate, so this is the only
# lossy encode),
# so the result is a single uniform H.264/AAC stream that every player opens (a stream-copy join of two differently
# encoded files would not open on some phones/QuickTime).
set -e
cd "$(dirname "$0")/.."
FF=tools/node_modules/ffmpeg-static/ffmpeg
IN="$1"; OUT="${IN%.mp4}-outro.mp4"
SRC=videos/_kit/outro/godward-outro-9x16.mp4
$FF -v error -y -i "$IN" -i "$SRC" -filter_complex \
  "[0:v]fps=30,format=yuv420p,setsar=1[v0];[1:v]fps=30,format=yuv420p,setsar=1,scale=1080:1920[v1];[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 16 -preset slow -tune animation -maxrate 40M -bufsize 80M \
  -c:a aac -b:a 192k -movflags +faststart "$OUT" < /dev/null
$FF -hide_banner -i "$OUT" < /dev/null 2>&1 | grep -E "Duration" || true
echo "$OUT"
