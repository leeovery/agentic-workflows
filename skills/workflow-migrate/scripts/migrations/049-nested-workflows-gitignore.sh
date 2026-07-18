#!/bin/bash
#
# Migration 049: Nested .workflows/.gitignore
#
# Migrations 010/011 wrote the cache ignore rule into the repo-root
# .gitignore, which no engine commit scope can ever stage (every scope lives
# under .workflows/) — it stayed untracked forever. The ignore rules belong
# inside the tree the engine commits: .workflows/.gitignore, which also
# covers orphaned atomic-write temp files (.manifest.json.<pid>.tmp) a
# crashed writer can leave behind.
#
# Steps:
#   1. Ensure .workflows/.gitignore carries the .cache/ and temp-file rules
#   2. Remove the exact .workflows/.cache/ line from the repo-root .gitignore
#   3. Delete the root .gitignore only when that rule was its only content
#
# Idempotent: rules already present are skipped; a root .gitignore without
# the rule is untouched.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update
#   - report_skip

PROJECT_ROOT="${PROJECT_DIR:-.}"
WORKFLOWS_DIR="$PROJECT_ROOT/.workflows"
NESTED_GITIGNORE="$WORKFLOWS_DIR/.gitignore"
ROOT_GITIGNORE="$PROJECT_ROOT/.gitignore"
ROOT_ENTRY=".workflows/.cache/"

# --- Step 1: Ensure the nested .workflows/.gitignore carries both rules ---

mkdir -p "$WORKFLOWS_DIR"

nested_changed=false
for rule in ".cache/" ".manifest.json.*.tmp"; do
    if [ -f "$NESTED_GITIGNORE" ] && grep -qxF "$rule" "$NESTED_GITIGNORE"; then
        continue
    fi
    # Ensure file ends with newline before appending
    if [ -f "$NESTED_GITIGNORE" ] && [ -n "$(tail -c 1 "$NESTED_GITIGNORE")" ]; then
        echo >> "$NESTED_GITIGNORE"
    fi
    echo "$rule" >> "$NESTED_GITIGNORE"
    nested_changed=true
done

if [ "$nested_changed" = true ]; then
    report_update
else
    report_skip
fi

# --- Steps 2+3: Retire the repo-root rule; drop the file only when the rule
# --- was all it held ---

if [ -f "$ROOT_GITIGNORE" ] && grep -qxF "$ROOT_ENTRY" "$ROOT_GITIGNORE"; then
    grep -vxF "$ROOT_ENTRY" "$ROOT_GITIGNORE" > "${ROOT_GITIGNORE}.tmp" || true
    if [ -s "${ROOT_GITIGNORE}.tmp" ]; then
        mv "${ROOT_GITIGNORE}.tmp" "$ROOT_GITIGNORE"
    else
        rm "${ROOT_GITIGNORE}.tmp" "$ROOT_GITIGNORE"
    fi
    report_update
else
    report_skip
fi

return 0
