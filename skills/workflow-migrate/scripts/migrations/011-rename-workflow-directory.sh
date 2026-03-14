#!/usr/bin/env bash
#
# 011-rename-workflow-directory.sh
#
# Moves docs/workflow/ → .workflows/ at project root.
# Workflow artefacts aren't documentation — the dot-prefixed directory
# better communicates their role as planning artefacts.
#
# Steps:
#   1. Skip if docs/workflow/ doesn't exist (fresh install or already migrated)
#   2. Create .workflows/ if needed
#   3. Move all contents preserving structure (including .state/, .cache/)
#   4. Update .gitignore: docs/workflow/.cache/ → .workflows/.cache/
#   5. Remove docs/workflow/ and docs/ if empty
#
# Idempotent: safe to run multiple times.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"

OLD_DIR="docs/workflow"
NEW_DIR=".workflows"
GITIGNORE=".gitignore"
OLD_GITIGNORE_ENTRY="docs/workflow/.cache/"
NEW_GITIGNORE_ENTRY=".workflows/.cache/"

# --- Step 1: Skip if nothing to migrate ---

if [ ! -d "$OLD_DIR" ]; then
    report_skip "$OLD_DIR (not found)"
else
    # --- Step 2: Create destination ---
    mkdir -p "$NEW_DIR"

    # --- Step 3: Move contents ---
    # Use find to get all top-level items (including hidden dirs like .state/, .cache/)
    for item in "$OLD_DIR"/* "$OLD_DIR"/.*; do
        basename_item=$(basename "$item")
        # Skip . and ..
        [ "$basename_item" = "." ] || [ "$basename_item" = ".." ] && continue
        # Skip if glob didn't match anything
        [ ! -e "$item" ] && continue

        if [ -e "$NEW_DIR/$basename_item" ]; then
            report_skip "$basename_item (already exists at destination)"
        else
            mv "$item" "$NEW_DIR/$basename_item"
            report_update "$NEW_DIR/$basename_item" "moved from $OLD_DIR/"
        fi
    done

    # --- Step 4: Remove old directory ---
    rmdir "$OLD_DIR" 2>/dev/null && report_update "$OLD_DIR" "removed empty directory" || true

    # Remove docs/ if empty
    if [ -d "docs" ]; then
        rmdir "docs" 2>/dev/null && report_update "docs" "removed empty directory" || true
    fi
fi

# --- Step 5: Update .gitignore ---

if [ -f "$GITIGNORE" ] && grep -qF "$OLD_GITIGNORE_ENTRY" "$GITIGNORE"; then
    # Replace old entry with new
    awk -v old="$OLD_GITIGNORE_ENTRY" -v new="$NEW_GITIGNORE_ENTRY" '{
        if ($0 == old) print new; else print
    }' "$GITIGNORE" > "${GITIGNORE}.tmp"
    mv "${GITIGNORE}.tmp" "$GITIGNORE"
    report_update "$GITIGNORE" "updated .cache/ path"
elif [ -f "$GITIGNORE" ] && grep -qxF "$NEW_GITIGNORE_ENTRY" "$GITIGNORE"; then
    report_skip "$GITIGNORE (already has new entry)"
fi
