#!/usr/bin/env bash
# Draw a world's screen from Ledger's engine directly, with no Claude Code
# session, as the tape's session will: boot, then the render named. Run it
# after demo/world.sh and before a recording, so a session is never spent on
# a world that does not boot to its screen. Boot's answer is printed whole:
# its `gates` must be empty, and its `go` `menu` for the bare `/ledger`, or
# `route` where the tape types words after it, or the session would ask a
# setup question first.
#
# Usage:  demo/check.sh <render args>...
#         demo/check.sh start-menu
#         WORDS="launch core" demo/check.sh epic-menu launch-core
#         demo/check.sh --engine <verb> <args>...   any other engine call
# WORDS are the words typed after /ledger, which boot routes; none by default.
# The width is the tape's: COLUMNS, 100 by default, less Claude Code's gutter.
set -euo pipefail

world="${DEMO_WORLD:-/tmp/ledger-demo}"
# shellcheck disable=SC1091 # the world's, written by world.sh
source "$world/profile.sh" >/dev/null
export CLAUDE_CODE_SESSION_ID="00000000-0000-4000-8000-0000000000c4"
export LEDGER_DISPLAY_WIDTH="${LEDGER_DISPLAY_WIDTH:-$((${COLUMNS:-100} - 6))}"

engine() {
	node .claude/skills/ledger-engine/scripts/engine.cjs "$@"
}

echo "--- boot"
printf '%s\n' "${WORDS:-}" | engine boot
echo
if [ "${1:-}" = "--engine" ]; then
	shift
	echo "--- $*"
	engine "$@"
else
	echo "--- render $*"
	engine render "$@"
fi
