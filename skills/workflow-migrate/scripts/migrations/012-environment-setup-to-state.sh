#!/usr/bin/env bash
#
# 012-environment-setup-to-state.sh
#
# Moves environment-setup.md into .state/ directory.
# This file is project state, not a workflow artifact.
#
# Idempotent: safe to run multiple times.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update
#   - report_skip

OLD_FILE=".workflows/environment-setup.md"
NEW_FILE=".workflows/.state/environment-setup.md"

if [ -f "$OLD_FILE" ]; then
    mkdir -p "$(dirname "$NEW_FILE")"
    mv "$OLD_FILE" "$NEW_FILE"
    report_update
elif [ -f "$NEW_FILE" ]; then
    report_skip
fi
