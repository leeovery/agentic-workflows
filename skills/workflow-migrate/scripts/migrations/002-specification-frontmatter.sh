#!/usr/bin/env bash
#
# 002-specification-frontmatter.sh
#
# Migrates specification documents from legacy markdown header format to YAML frontmatter.
#
# Legacy format:
#   # Specification: {Topic}
#
#   **Status**: Building specification | Complete
#   **Type**: feature | cross-cutting
#   **Last Updated**: YYYY-MM-DD
#
# New format:
#   ---
#   topic: {topic-name}
#   status: in-progress | concluded
#   type: feature | cross-cutting | (empty if unknown)
#   date: YYYY-MM-DD
#   sources:              # Optional - only if Sources field exists
#     - discussion-one
#     - discussion-two
#   ---
#
#   # Specification: {Topic}
#
# Status mapping (normalized across all document types):
#   Building specification, Building, Draft → in-progress
#   Complete, Completed, Done → concluded
#
# Type handling:
#   feature → feature
#   cross-cutting → cross-cutting
#   (not found or unrecognized) → empty (requires manual review)
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="002"
SPEC_DIR="docs/workflow/specification"

# Skip if no specification directory
if [ ! -d "$SPEC_DIR" ]; then
    return 0
fi

# Process each specification file
for file in "$SPEC_DIR"/*.md; do
    [ -f "$file" ] || continue

    # Skip tracking/review files — only process specification documents
    case "$(basename "$file")" in
        *-review-*|*-tracking*) continue ;;
    esac

    # Check if file already has YAML frontmatter
    if head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        report_skip "$file"
        continue
    fi

    # Check if file has legacy format (look for **Status**: or **Status:** or **Type**: or **Last Updated**:)
    if ! grep -q '^\*\*Status\*\*:\|^\*\*Status:\*\*\|^\*\*Type\*\*:\|^\*\*Last Updated\*\*:' "$file" 2>/dev/null; then
        report_skip "$file"
        continue
    fi

    #
    # Extract values from legacy format
    #

    # Use filename as topic (canonical identifier throughout the workflow)
    topic_kebab=$(basename "$file" .md)

    # Extract status from **Status**: Value or **Status:** Value
    # Handle variations: "Building specification", "Building", "Complete", "Completed", etc.
    status_raw=$(grep -m1 '^\*\*Status\*\*:\|^\*\*Status:\*\*' "$file" | \
        sed 's/^\*\*Status\*\*:[[:space:]]*//' | \
        sed 's/^\*\*Status:\*\*[[:space:]]*//' | \
        tr '[:upper:]' '[:lower:]' | \
        xargs)

    # Map legacy status to normalized values (consistent across all document types)
    case "$status_raw" in
        "building specification"|"building"|"draft"|"in progress"|"in-progress"|"exploring"|"deciding")
            status_new="in-progress"
            ;;
        "complete"|"completed"|"done"|"finished"|"concluded")
            status_new="concluded"
            ;;
        *)
            status_new="in-progress"  # Default for unknown
            ;;
    esac

    # Extract type from **Type**: Value (may not exist in legacy files)
    type_raw=$(grep -m1 '^\*\*Type\*\*:\|^\*\*Type:\*\*' "$file" 2>/dev/null | \
        sed 's/^\*\*Type\*\*:[[:space:]]*//' | \
        sed 's/^\*\*Type:\*\*[[:space:]]*//' | \
        tr '[:upper:]' '[:lower:]' | \
        xargs || echo "")

    # Normalize type (leave empty if not found or unrecognized - requires manual review)
    case "$type_raw" in
        "feature")
            type_new="feature"
            ;;
        "cross-cutting"|"crosscutting"|"cross cutting")
            type_new="cross-cutting"
            ;;
        *)
            type_new=""  # Empty - requires manual classification
            ;;
    esac

    # Extract date from **Last Updated**: YYYY-MM-DD or **Date**: YYYY-MM-DD
    date_value=$(grep -m1 '^\*\*Last Updated\*\*:\|^\*\*Date\*\*:' "$file" | \
        grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")

    # Use today's date if none found
    if [ -z "$date_value" ]; then
        date_value=$(date +%Y-%m-%d)
    fi

    # Extract sources from **Sources**: source1, source2, ... (comma-separated list of discussion names)
    # These link the specification back to the discussions that informed it
    sources_raw=$(grep -m1 '^\*\*Sources\*\*:' "$file" 2>/dev/null | \
        sed 's/^\*\*Sources\*\*:[[:space:]]*//' | \
        xargs || echo "")

    # Convert comma-separated list to array
    sources_array=()
    if [ -n "$sources_raw" ]; then
        IFS=',' read -ra sources_parts <<< "$sources_raw"
        for src in "${sources_parts[@]}"; do
            # Trim whitespace
            src=$(echo "$src" | xargs)
            if [ -n "$src" ]; then
                sources_array+=("$src")
            fi
        done
    fi

    #
    # Build new file content
    #

    # Create frontmatter (conditionally include sources if present)
    if [ ${#sources_array[@]} -gt 0 ]; then
        sources_yaml=""
        for src in "${sources_array[@]}"; do
            sources_yaml="${sources_yaml}
  - $src"
        done
        frontmatter="---
topic: $topic_kebab
status: $status_new
type: $type_new
date: $date_value
sources:$sources_yaml
---"
    else
        frontmatter="---
topic: $topic_kebab
status: $status_new
type: $type_new
date: $date_value
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
        # No ## found - take everything after the metadata block
        # Find first blank line after the metadata, then take from there
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

    report_update "$file" "added frontmatter (status: $status_new, type: $type_new)"
done
