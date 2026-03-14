#!/usr/bin/env bash
#
# 003-planning-frontmatter.sh
#
# Migrates plan documents from legacy format to full YAML frontmatter.
#
# Legacy format (partial frontmatter + inline metadata):
#   ---
#   format: {format}
#   ---
#
#   # Implementation Plan: {Feature/Project Name}
#
#   **Date**: YYYY-MM-DD
#   **Status**: Draft | Ready | In Progress | Completed
#   **Specification**: `docs/workflow/specification/{topic}.md`
#
# New format (all metadata in frontmatter):
#   ---
#   topic: {topic-name}
#   status: in-progress | concluded
#   date: YYYY-MM-DD
#   format: {format}         # Required - no default, MISSING if not present
#   specification: {topic}.md
#   plan_id: {id}            # Optional - migrated from 'epic' or 'project' fields
#   ---
#
#   # Implementation Plan: {Feature/Project Name}
#
# Status mapping (normalized across all document types):
#   Draft, Ready, In Progress → in-progress
#   Completed, Done → concluded
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="003"
PLAN_DIR="docs/workflow/planning"

# Skip if no planning directory
if [ ! -d "$PLAN_DIR" ]; then
    return 0
fi

# Process each plan file
for file in "$PLAN_DIR"/*.md; do
    [ -f "$file" ] || continue

    # Skip tracking/review files — only process plan documents
    case "$(basename "$file")" in
        *-review-*|*-tracking*) continue ;;
    esac

    # Check if file already has full frontmatter (topic field present)
    if head -10 "$file" 2>/dev/null | grep -q "^topic:"; then
        report_skip "$file"
        continue
    fi

    # Check if file has legacy format indicators
    # Legacy format has partial frontmatter (format:) OR inline **Date**/**Status**/**Specification**
    has_partial_frontmatter=$(head -5 "$file" 2>/dev/null | grep -c "^format:" || true)
    has_inline_metadata=$(grep -c '^\*\*Date\*\*:\|^\*\*Status\*\*:\|^\*\*Specification\*\*:' "$file" 2>/dev/null || true)

    if [ "${has_partial_frontmatter:-0}" = "0" ] && [ "${has_inline_metadata:-0}" = "0" ]; then
        report_skip "$file"
        continue
    fi

    #
    # Extract values from legacy format
    #

    # Use filename as topic (canonical identifier throughout the workflow)
    topic_kebab=$(basename "$file" .md)

    # Extract format from existing frontmatter (if present)
    # Use awk to extract only the first frontmatter block (between first pair of --- delimiters)
    # This avoids matching --- horizontal rules in body content
    format_value=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null | grep "^format:" | sed 's/^format:[[:space:]]*//' | xargs || echo "")
    if [ -z "$format_value" ]; then
        format_value="MISSING"  # No default - missing format is an error
    fi

    # Extract plan_id from existing frontmatter - could be 'epic' (beads) or 'project' (linear/backlog)
    # These are migrated to a unified 'plan_id' field
    plan_id_value=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null | grep "^epic:" | sed 's/^epic:[[:space:]]*//' | xargs || echo "")
    if [ -z "$plan_id_value" ]; then
        plan_id_value=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null | grep "^project:" | sed 's/^project:[[:space:]]*//' | xargs || echo "")
    fi

    # Extract status from **Status**: Value
    status_raw=$(grep -m1 '^\*\*Status\*\*:' "$file" 2>/dev/null | \
        sed 's/^\*\*Status\*\*:[[:space:]]*//' | \
        tr '[:upper:]' '[:lower:]' | \
        xargs || echo "")

    # Map legacy status to normalized values
    case "$status_raw" in
        "draft"|"ready"|"in progress"|"in-progress")
            status_new="in-progress"
            ;;
        "completed"|"complete"|"done"|"concluded")
            status_new="concluded"
            ;;
        *)
            status_new="in-progress"  # Default for unknown
            ;;
    esac

    # Extract date from **Date**: YYYY-MM-DD or **Created**: YYYY-MM-DD
    date_value=$(grep -m1 '^\*\*Date\*\*:\|^\*\*Created\*\*:' "$file" 2>/dev/null | \
        grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")

    # Use today's date if none found
    if [ -z "$date_value" ]; then
        date_value=$(date +%Y-%m-%d)
    fi

    # Extract specification from **Specification**: `docs/workflow/specification/{topic}.md`
    # We just want the filename, not the full path
    spec_raw=$(grep -m1 '^\*\*Specification\*\*:' "$file" 2>/dev/null | \
        sed 's/^\*\*Specification\*\*:[[:space:]]*//' | \
        sed 's/`//g' | \
        xargs || echo "")

    # Extract just the filename from the path
    if [ -n "$spec_raw" ]; then
        spec_value=$(basename "$spec_raw")
    else
        spec_value="${topic_kebab}.md"  # Default to topic name
    fi

    #
    # Build new file content
    #

    # Create frontmatter (conditionally include plan_id if present)
    if [ -n "$plan_id_value" ]; then
        frontmatter="---
topic: $topic_kebab
status: $status_new
date: $date_value
format: $format_value
specification: $spec_value
plan_id: $plan_id_value
---"
    else
        frontmatter="---
topic: $topic_kebab
status: $status_new
date: $date_value
format: $format_value
specification: $spec_value
---"
    fi

    # Extract H1 heading (preserve original)
    h1_heading=$(grep -m1 "^# " "$file")

    # Find line number of first ## heading (start of real content after metadata)
    first_section_line=$(grep -n "^## " "$file" | head -1 | cut -d: -f1)

    # Get content from first ## onwards (preserves all content)
    if [ -n "$first_section_line" ]; then
        content=$(tail -n +$first_section_line "$file")
    else
        # No ## found - might be empty or malformed
        content=""
    fi

    # Write new content: frontmatter + H1 + blank line + content
    {
        echo "$frontmatter"
        echo ""
        echo "$h1_heading"
        echo ""
        echo "$content"
    } > "$file"

    report_update "$file" "added full frontmatter (status: $status_new, format: $format_value)"
done
