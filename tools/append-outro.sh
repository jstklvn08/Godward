#!/bin/bash
# Append the channel outro to a rendered episode without re-rendering it.
#   tools/append-outro.sh videos/<slug>/<slug>-vertical.mp4   -> writes <slug>-vertical-outro.mp4 next to it
# The outro (videos/_kit/outro/godward-outro-9x16.mp4, 1080x1920, 30 fps) is re-encoded once to match the
# episode's H.264/AAC settings, then both are joined with stream copy (no quality loss on the episode).
set -e
cd "$(dirname "$0")/.."
FF=tools/node_modules/ffmpeg-static/ffmpeg
IN="$1"; OUT="${IN%.mp4}-outro.mp4"
SRC=videos/_kit/outro/godward-outro-9x16.mp4
TMP=$(mktemp -d)
$FF -v error -y -i "$SRC" -vf "fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 16 -profile:v high -video_track_timescale 15360 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 "$TMP/outro.mp4" < /dev/null
printf "file '%s'\nfile '%s'\n" "$(realpath "$IN")" "$TMP/outro.mp4" > "$TMP/list.txt"
$FF -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT" < /dev/null
rm -rf "$TMP"
$FF -hide_banner -i "$OUT" < /dev/null 2>&1 | grep -E "Duration" || true
echo "$OUT"
