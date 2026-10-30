#!/usr/bin/env bash
#
# 018-remove-stale-environment-setup.sh
#
# Removes stale .workflows/environment-setup.md if already present in .state/.
# Migration 012 moved this file, but if 012 ran before the fix was deployed,
# the original may still exist alongside the copy.
#
# Idempotent: safe to run multiple times.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update
#   - report_skip

STALE_FILE=".workflows/environment-setup.md"
STATE_FILE=".workflows/.state/environment-setup.md"

if [ -f "$STALE_FILE" ] && [ -f "$STATE_FILE" ]; then
    rm "$STALE_FILE"
    report_update
elif [ -f "$STALE_FILE" ] && [ ! -f "$STATE_FILE" ]; then
    # State copy doesn't exist — run the original migration logic
    mkdir -p "$(dirname "$STATE_FILE")"
    mv "$STALE_FILE" "$STATE_FILE"
    report_update
else
    report_skip
fi
