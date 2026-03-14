#!/usr/bin/env bash
#
# 010-cache-state-restructure.sh
#
# Restructures docs/workflow/.cache/ → .state/ + .cache/:
#   - .state/ = committed persistent workflow state (analysis files)
#   - .cache/ = gitignored ephemeral runtime data (sessions)
#
# Steps:
#   1. Move analysis files from .cache/ → .state/ (if they exist)
#   2. Clean up orphaned .cache/migrations / .cache/migrations.log
#   3. Add docs/workflow/.cache/ to .gitignore
#   4. Remove old docs/workflow/.cache/sessions/ entry from .gitignore
#
# Idempotent: safe to run multiple times.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"

STATE_DIR="docs/workflow/.state"
CACHE_DIR="docs/workflow/.cache"
GITIGNORE=".gitignore"
NEW_ENTRY="docs/workflow/.cache/"
OLD_ENTRY="docs/workflow/.cache/sessions/"

# --- Step 1: Move analysis files from .cache/ to .state/ ---

ANALYSIS_FILES=(
    "discussion-consolidation-analysis.md"
    "research-analysis.md"
)

for file in "${ANALYSIS_FILES[@]}"; do
    if [ -f "$CACHE_DIR/$file" ]; then
        mkdir -p "$STATE_DIR"
        mv "$CACHE_DIR/$file" "$STATE_DIR/$file"
        report_update "$STATE_DIR/$file" "moved from .cache/"
    fi
done

# --- Step 2: Clean up orphaned migration tracking in .cache/ ---

for old_file in "$CACHE_DIR/migrations" "$CACHE_DIR/migrations.log"; do
    if [ -f "$old_file" ]; then
        rm "$old_file"
        report_update "$old_file" "removed orphaned tracking file"
    fi
done

# --- Step 3: Add docs/workflow/.cache/ to .gitignore ---

if [ -f "$GITIGNORE" ] && grep -qxF "$NEW_ENTRY" "$GITIGNORE"; then
    report_skip "$GITIGNORE"
else
    # Ensure file ends with newline before appending
    [ -f "$GITIGNORE" ] && [ -n "$(tail -c 1 "$GITIGNORE")" ] && echo >> "$GITIGNORE"
    echo "$NEW_ENTRY" >> "$GITIGNORE"
    report_update "$GITIGNORE" "added .cache/ to gitignore"
fi

# --- Step 4: Remove old sessions/ entry from .gitignore (now redundant) ---

if [ -f "$GITIGNORE" ] && grep -qF "$OLD_ENTRY" "$GITIGNORE"; then
    # Remove the old entry (and its comment if present)
    grep -vF "$OLD_ENTRY" "$GITIGNORE" > "${GITIGNORE}.tmp"
    mv "${GITIGNORE}.tmp" "$GITIGNORE"
    report_update "$GITIGNORE" "removed redundant sessions/ entry"
fi
