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
  # Both exist — merge old into new
  cp -rn "$OLD_INBOX/"* "$NEW_INBOX/" 2>/dev/null || true
  cp -rn "$OLD_INBOX/".* "$NEW_INBOX/" 2>/dev/null || true
  rm -rf "$OLD_INBOX"
  report_update
else
  mv "$OLD_INBOX" "$NEW_INBOX"
  report_update
fi
