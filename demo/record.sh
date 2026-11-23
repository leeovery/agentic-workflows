#!/usr/bin/env bash
# Record the README's demos and make their art: the tapes named, or every
# one, through vhs, then finalize.sh. A tape whose first line is
# "# art: still" makes a still; any other makes a clip. Run it from
# anywhere; it works from the repository's root, where the tapes' paths
# start. Each tape builds the world it records in (demo/world.sh).
#
# Every tape runs a real Claude Code session, signed in as you, and spends
# the turns its header says: name the tapes you mean to remake.
#
# vhs records a tape's frames into a directory under $TMPDIR, then moves it
# to the tape's Output. Where $TMPDIR is on another volume than the
# repository, the move fails without a word and no frames come, so vhs is
# given a TMPDIR in demo/out. A tape's old frames are deleted first, so a
# recording that fails without a word can't leave them to be taken for new.
#
# vhs's browser reaches ttyd over loopback: run this with an agent's
# sandbox off.
#
# Usage:  demo/record.sh                       every tape
#         demo/record.sh start-menu roadmap    the tapes named
set -euo pipefail

cd "$(dirname "$0")/.."

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
	for tape in demo/*.tape; do
		name="$(basename "$tape" .tape)"
		[ "$name" = look ] || names+=("$name")
	done
fi

mkdir -p demo/out/.vhs
for name in "${names[@]}"; do
	[ -f "demo/$name.tape" ] && [ "$name" != look ] || {
		echo "no tape demo/$name.tape" >&2
		exit 1
	}
	rm -rf "demo/out/$name"
	TMPDIR="$PWD/demo/out/.vhs" vhs --quiet "demo/$name.tape"
	if head -n1 "demo/$name.tape" | grep -q '^# art: still'; then
		# A tape's "# art: from <colour>" or "# art: from-last <colour>" line
		# cuts its still above that band of rows, or with "+<n>" after it, the
		# terminal row n below it (finalize.sh).
		from=()
		line="$(sed -n 's/^# art: \(from\(-last\)\{0,1\} #[0-9A-Fa-f]\{6\}\( +[0-9]\{1,\}\)\{0,1\}\)$/\1/p' "demo/$name.tape" | head -n1)"
		if [ -n "$line" ]; then
			read -r kind colour rows <<<"$line"
			from=(--"$kind" "$colour" --rows "${rows:-0}")
		fi
		demo/finalize.sh --still ${from[@]+"${from[@]}"} "$name"
	else
		demo/finalize.sh "$name"
	fi
done
