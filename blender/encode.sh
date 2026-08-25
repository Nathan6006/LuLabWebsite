#!/bin/sh
# PNG sequences from Blender -> WebP for the page.
#
# cwebp rather than ffmpeg: the Homebrew ffmpeg bottle is built without
# libwebp, so `-c:v libwebp` fails with "Unknown encoder". cwebp is the
# reference encoder anyway and handles the alpha channel properly.
#
# Settings found by measurement, not guesswork. Colour quality barely moves the
# file size here — a shell of several thousand distinct spheres is genuinely
# high-entropy — but the ALPHA channel dominates it, and a near-lossless alpha
# over that spiky silhouette cost more than the image. Dropping alpha_q from
# 100 to 28 and the source from 800px to 640px takes a frame from ~190KB to
# ~80KB with no visible change at the size this is displayed.
#
# It never touches page load: nothing is fetched until you scroll near the
# section, and below 1024px nothing is fetched at all.
set -e
SRC=blender/out
DST=public/journey
mkdir -p "$DST"
rm -f "$DST"/*.webp
n=0
for f in "$SRC"/*.png; do
  base=$(basename "$f" .png)
  cwebp -quiet -q 70 -alpha_q 28 -m 6 -resize 640 640 "$f" -o "$DST/$base.webp"
  n=$((n + 1))
done
echo "encoded $n frames"
du -sh "$DST"
