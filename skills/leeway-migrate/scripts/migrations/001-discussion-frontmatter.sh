#!/usr/bin/env bash
#
# 001-discussion-frontmatter.sh
#
# Migrates discussion documents from legacy markdown header format to YAML frontmatter.
#
# Legacy format:
#   # Discussion: {Topic}
#
#   **Date**: YYYY-MM-DD
#   **Status**: Exploring | Deciding | Concluded | Complete | ✅ Complete
#   **Status:** Concluded  (alternate: colon outside bold)
#
# New format:
#   ---
#   topic: {topic-name}
#   status: in-progress | concluded
#   date: YYYY-MM-DD
#   ---
#
#   # Discussion: {Topic}
#
# Status mapping:
#   Exploring, Deciding → in-progress
#   Concluded, Complete, ✅ Complete → concluded
#
# This script is sourced by migrate.sh and has access to:
#   - report_update
#   - report_skip
#

MIGRATION_ID="001"
DISCUSSION_DIR="docs/workflow/discussion"

# Skip if no discussion directory
if [ ! -d "$DISCUSSION_DIR" ]; then
    return 0
fi

# Process each discussion file
for file in "$DISCUSSION_DIR"/*.md; do
    [ -f "$file" ] || continue

    # Check if file already has YAML frontmatter
    if head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        report_skip
        continue
    fi

    # Check if file has legacy format (look for **Status**: or **Status:** or **Date**: or **Started:**)
    if ! grep -q '^\*\*Status\*\*:\|^\*\*Status:\*\*\|^\*\*Date\*\*:\|^\*\*Started:\*\*' "$file" 2>/dev/null; then
        report_skip
        continue
    fi

    #
    # Extract values from legacy format
    #

    # Use filename as topic (canonical identifier throughout the workflow)
    topic_kebab=$(basename "$file" .md)

    # Extract date from **Date**: YYYY-MM-DD or **Started:** YYYY-MM-DD
    date_value=$(grep -m1 '^\*\*Date\*\*:\|^\*\*Started:\*\*' "$file" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")

    # Extract status from **Status**: Value or **Status:** Value (colon inside or outside bold)
    # First extract the line, then remove all variations of the prefix.
    # Guard the pipeline: a file that matched line 51 on **Date**/**Started**
    # alone has no Status line, and under `set -eo pipefail` the failed grep
    # would otherwise abort the whole migration chain.
    status_raw=$(grep -m1 '^\*\*Status' "$file" | sed 's/^\*\*Status\*\*:[[:space:]]*//' | sed 's/^\*\*Status:\*\*[[:space:]]*//' | tr '[:upper:]' '[:lower:]' || true)
    # Remove any emoji characters (like ✅) and trim whitespace
    status_raw=$(echo "$status_raw" | sed 's/✅//g' | xargs)

    # Map legacy status to new values
    case "$status_raw" in
        exploring|deciding)
            status_new="in-progress"
            ;;
        concluded|complete)
            status_new="concluded"
            ;;
        *)
            status_new="in-progress"  # Default for unknown
            ;;
    esac

    # Use today's date if none found
    if [ -z "$date_value" ]; then
        date_value=$(date +%Y-%m-%d)
    fi

    #
    # Build new file content
    #

    # Create frontmatter
    frontmatter="---
topic: $topic_kebab
status: $status_new
date: $date_value
---"

    # Extract H1 heading (preserve original). Guarded so a heading-less file
    # can't abort the run under `set -eo pipefail`.
    h1_heading=$(grep -m1 "^# " "$file" || true)

    # Find line number of first ## heading (start of real content). Guarded: a
    # file with no ## section must not fail the pipeline under pipefail.
    first_section_line=$(grep -n "^## " "$file" | head -1 | cut -d: -f1 || true)

    # Get content from first ## onwards (preserves all content including **Status:** in decisions)
    if [ -n "$first_section_line" ]; then
        content=$(tail -n +"$first_section_line" "$file")
    else
        # No ## found — preserve the body verbatim instead of dropping it.
        # Skip the leading H1, the legacy **…** metadata lines, and blank lines,
        # then emit everything from the first real body line onward.
        content=$(awk '
            seen { print; next }
            /^# / { next }
            /^\*\*/ { next }
            /^[[:space:]]*$/ { next }
            { seen = 1; print }
        ' "$file")
    fi

    # Write new content: frontmatter + H1 + blank line + content.
    # Write to a temp file in the same directory then rename, so a mid-write
    # kill can't leave a truncated file that the frontmatter skip-check would
    # then treat as already migrated.
    tmp_file="$file.tmp.$$"
    {
        echo "$frontmatter"
        echo ""
        echo "$h1_heading"
        echo ""
        echo "$content"
    } > "$tmp_file"
    mv "$tmp_file" "$file"

    report_update
done
