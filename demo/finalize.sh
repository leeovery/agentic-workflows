#!/usr/bin/env bash
# Make the README's art from the frames a tape in demo/ recorded: for a clip,
# an animated WebP, which GitHub shows inline, and an MP4; for a still, a
# lossless WebP of its last frame, cropped to what it drew, and with --from
# or --from-last, cut above the first or last band of rows drawn in that
# colour, or the terminal rows --rows names below it.
#
# vhs writes each frame it shows, a layer of text and one of the cursor,
# exactly as the terminal drew them. The art is made from those, not from a
# video vhs encodes: a video's compression shifts every pixel a little from
# frame to frame, which an animated WebP then has to store whole, where from
# the frames themselves it stores only what changed, losslessly.
#
# Usage:  demo/finalize.sh <name>...                    a clip each
#         demo/finalize.sh --still [--from|--from-last <#rrggbb> [--rows <n>]] <name>...
#                                                       a still each
# Input:  demo/out/<name>/   the frames vhs demo/<name>.tape wrote
# Output: art/<name>.webp, and for a clip, art/<name>.mp4
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
art="$(dirname "$here")/art"
fps=30 # the tapes' Framerate
pad=40 # the margin round the screen, in px
row=37 # a terminal row at look.tape's FontSize 28, in px

still=false
from="" which=first below_rows=0
if [ "${1:-}" = "--still" ]; then
	still=true
	shift
fi
if $still && { [ "${1:-}" = "--from" ] || [ "${1:-}" = "--from-last" ]; }; then
	[ "$1" = "--from" ] || which=last
	from="$(echo "${2:-}" | tr -d '#' | tr 'A-F' 'a-f')"
	shift 2
	if [ "${1:-}" = "--rows" ]; then
		below_rows="${2:-0}"
		shift 2
	fi
fi
[ $# -gt 0 ] || {
	echo "usage: demo/finalize.sh [--still [--from|--from-last <#rrggbb> [--rows <n>]]] <name>..." >&2
	exit 2
}

# drawn_rows <frame> <width> <height> prints the first and last rows of the
# frame with anything drawn on them, counted from 0: rows holding a pixel
# unlike the frame's top-left one, its margin. Every such pixel is made
# non-zero and the rest zero, then each byte is read. Exact to the pixel,
# where ffmpeg's cropdetect is not: it averages a row, so the few pixels of a
# row holding only the prompt read as none.
drawn_rows() {
	local frame="$1" width="$2" height="$3"
	ffmpeg -v error -i "$frame" \
		-filter_complex "[0]format=gbrp,split[f][c];[c]crop=1:1:0:0,scale=$width:$height:flags=neighbor[bg];[f][bg]blend=all_mode=difference,lutrgb=r='if(val,255,0)':g='if(val,255,0)':b='if(val,255,0)',format=gray" \
		-f rawvideo -pix_fmt gray - |
		od -An -v -tu1 |
		awk -v width="$width" '
			/[1-9]/ {
				for (i = 1; i <= NF; i++) if ($i) {
					at = 16 * (NR - 1) + i - 1
					if (first == "") first = at
					last = at
				}
			}
			END { print int(first / width), int(last / width) }'
}

# colour_row <frame> <x> <rrggbb> <first|last> prints where the first, or
# the last, run of rows starts whose pixel in column x is the colour, counted
# from 0, or nothing where there is none. Each pixel's three bytes are read
# in turn down the one column.
colour_row() {
	local frame="$1" x="$2" want="$3" which="$4"
	ffmpeg -v error -i "$frame" -vf "crop=1:ih:$x:0" -f rawvideo -pix_fmt rgb24 - |
		od -An -v -tx1 |
		awk -v want="$want" -v which="$which" '
			{
				for (i = 1; i <= NF; i++) {
					hex = hex $i
					if (++n % 3 == 0) {
						row = n / 3 - 1
						if (hex == want && !inside) {
							start = row
							if (which == "first") { print start; exit }
						}
						inside = hex == want
						hex = ""
					}
				}
			}
			END { if (which == "last" && start != "") print start }'
}

frames="$(mktemp -d)"
trap 'rm -rf "$frames"' EXIT
mkdir -p "$art"

for name in "$@"; do
	src="$here/out/$name"
	[ -f "$src/frame-text-00001.png" ] || {
		echo "no frames in demo/out/$name: run 'demo/record.sh $name' first" >&2
		exit 1
	}
	rm -f "$frames"/*.png
	size="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$src/frame-text-00001.png")"
	w="${size%,*}" h="${size#*,}"

	# The cursor's layer over the text's, on a margin of the theme's
	# background, read from the screen's top-right pixel.
	ffmpeg -v error -y -framerate "$fps" -i "$src/frame-text-%05d.png" -framerate "$fps" -i "$src/frame-cursor-%05d.png" \
		-filter_complex "[0][1]overlay=format=rgb,split[screen][corner];[corner]crop=1:1:$((w - 1)):0,scale=$((w + 2 * pad)):$((h + 2 * pad)):flags=neighbor[margin];[margin][screen]overlay=$pad:$pad:format=rgb" \
		-pix_fmt rgb24 "$frames/f%05d.png"

	echo "==> $name"
	if $still; then
		# The screen is as tall as the run's tallest moment, so its last frame
		# can end in empty rows: cut them, leaving under the last row drawn the
		# margin above the first.
		shot=("$frames"/f*.png)
		last="${shot[${#shot[@]} - 1]}"
		rows="$(drawn_rows "$last" $((w + 2 * pad)) $((h + 2 * pad)))"
		read -r top bottom <<<"$rows"
		y=0 below=$top
		# With --from, the still starts at the first row drawn in that colour,
		# read three-quarters of the way across, such as the band Claude Code
		# draws a sent prompt on, and with --from-last at the last such band,
		# or with --rows at the terminal row that many below it: everything
		# above it is cut. The margin left above it is a few pixels short of a
		# row, so the row before it, which must be a blank one, shows nothing
		# of what is above that.
		if [ -n "$from" ]; then
			at="$(colour_row "$last" $(((w + 2 * pad) * 3 / 4)) "$from" "$which")"
			[ -n "$at" ] || {
				echo "demo/out/$name: no row drawn in #$from to start the still at" >&2
				exit 1
			}
			at=$((at + below_rows * row))
			y=$((at > 34 ? at - 34 : 0))
			below=$((at - y))
		fi
		# The margin under the last row matches the one above the first, as far
		# as the frame reaches.
		end=$((bottom + 1 + below))
		end=$((end < h + 2 * pad ? end : h + 2 * pad))
		cwebp -quiet -lossless -m 6 -crop 0 "$y" $((w + 2 * pad)) $((end - y)) "$last" -o "$art/$name.webp"
		printf "   %-30s %s\n" "art/$name.webp" "$(du -h "$art/$name.webp" | cut -f1)"
		continue
	fi
	img2webp -loop 0 -lossless -q 80 -m 6 -d $((1000 / fps)) "$frames"/f*.png -o "$art/$name.webp" >/dev/null
	ffmpeg -v error -y -framerate "$fps" -i "$frames/f%05d.png" \
		-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$art/$name.mp4"
	for f in "$name.webp" "$name.mp4"; do
		printf "   %-30s %s\n" "art/$f" "$(du -h "$art/$f" | cut -f1)"
	done
done
