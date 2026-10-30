#!/bin/bash
#
# Migration 033: Rename inbox/ to .inbox/
#
# Moves .workflows/inbox/ to .workflows/.inbox/ so the inbox directory
# follows the dot-prefix convention used by .cache/ and .state/.
#
# Idempotent: skips if .workflows/inbox/ does not exist.
# If both exist, merges inbox/ contents into .inbox/ then removes inbox/.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"
OLD_INBOX="$WORKFLOWS_DIR/inbox"
NEW_INBOX="$WORKFLOWS_DIR/.inbox"

[ -d "$OLD_INBOX" ] || return 0

if [ -d "$NEW_INBOX" ]; then
  # Both exist — merge old into new. Iterate entries (regular + dot-prefixed)
  # and copy each, skipping . and ..: on bash 3.2 the `.*` glob matches `.`
  # and `..`, which would recursively copy OLD_INBOX into itself and drag the
  # parent tree along. Same skip pattern as migration 011.
  for item in "$OLD_INBOX"/* "$OLD_INBOX"/.*; do
    base=$(basename "$item")
    [ "$base" = "." ] || [ "$base" = ".." ] && continue
    [ ! -e "$item" ] && continue
    cp -rn "$item" "$NEW_INBOX/" 2>/dev/null || true
  done
  rm -rf "$OLD_INBOX"
  report_update
else
  mv "$OLD_INBOX" "$NEW_INBOX"
  report_update
fi
