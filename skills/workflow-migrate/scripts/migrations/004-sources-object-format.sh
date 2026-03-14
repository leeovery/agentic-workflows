#!/usr/bin/env bash
#
# 004-sources-object-format.sh
#
# Migrates specification sources from simple array format to object format
# with status tracking. Also ensures all specs have a sources field.
#
# Previous format (from 002-specification-frontmatter.sh):
#   sources:
#     - topic-a
#     - topic-b
#
# New format:
#   sources:
#     - name: topic-a
#       status: incorporated
#     - name: topic-b
#       status: incorporated
#
# Status values:
#   - pending: Source selected but content not yet extracted
#   - incorporated: Source content has been fully woven into the specification
#
# For existing sources, we assume "incorporated" since they were part of
# the specification when it was created/worked on.
#
# For specs WITHOUT a sources field:
#   - If a matching discussion exists (same filename), add it as incorporated
#   - If no matching discussion, add empty sources: [] and report for user review
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="004"
SPEC_DIR="docs/workflow/specification"
DISCUSSION_DIR="docs/workflow/discussion"

# Skip if no specification directory
if [ ! -d "$SPEC_DIR" ]; then
    return 0
fi

# Helper: Extract ONLY the frontmatter content (between first pair of --- delimiters)
# Documents may contain --- elsewhere (horizontal rules), so sed range matching
# can return content beyond frontmatter. Use awk for precise first-block extraction.
extract_frontmatter() {
    local file="$1"
    awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null
}

# Helper: Check if sources are already in object format
# Returns 0 if already migrated (has "name:" entries), 1 if not
sources_already_object_format() {
    local file="$1"
    # Look for "- name:" pattern within the sources block (frontmatter only)
    # This indicates the new object format
    # Using subshell with || false to ensure proper exit code without pipefail issues
    ( extract_frontmatter "$file" | \
        sed -n '/^sources:/,/^[a-z_]*:/p' | \
        grep -q "^[[:space:]]*-[[:space:]]*name:" 2>/dev/null ) || return 1
    return 0
}

# Helper: Extract sources array items (simple string format)
# Returns space-separated list of source names
extract_simple_sources() {
    local file="$1"
    # Extract sources from frontmatter only, then find the sources block
    extract_frontmatter "$file" | \
        sed -n '/^sources:/,/^[a-z_]*:/p' | \
        grep -v "^sources:" | \
        grep -v "^[a-z_]*:" | \
        { grep "^[[:space:]]*-[[:space:]]" || true; } | \
        { grep -v "name:" || true; } | \
        sed 's/^[[:space:]]*-[[:space:]]*//' | \
        sed 's/^"//' | \
        sed 's/"$//' | \
        tr '\n' ' ' | \
        sed 's/[[:space:]]*$//' || true
}

# Process each specification file
for file in "$SPEC_DIR"/*.md; do
    [ -f "$file" ] || continue

    # Skip tracking/review files — only process specification documents
    case "$(basename "$file")" in
        *-review-*|*-tracking*) continue ;;
    esac

    # Check if file has YAML frontmatter
    if ! head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        report_skip "$file"
        continue
    fi

    # Check if file has sources field at all
    has_sources_field=false
    if grep -q "^sources:" "$file" 2>/dev/null; then
        has_sources_field=true
    fi

    # If sources field exists, check if already in object format
    if $has_sources_field && sources_already_object_format "$file"; then
        report_skip "$file"
        continue
    fi

    #
    # Build new sources block in object format
    #
    new_sources_block="sources:"
    sources_added=false

    if $has_sources_field; then
        # Extract existing sources from simple array format
        sources=$(extract_simple_sources "$file")

        for src in $sources; do
            # Clean the source name (trim whitespace, sed avoids xargs quote issues)
            src=$(echo "$src" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [ -n "$src" ]; then
                new_sources_block="${new_sources_block}
  - name: $src
    status: incorporated"
                sources_added=true
            fi
        done
    else
        # No sources field - check for matching discussion by filename
        spec_name=$(basename "$file" .md)
        discussion_file="$DISCUSSION_DIR/${spec_name}.md"

        if [ -f "$discussion_file" ]; then
            # Matching discussion found - add it as incorporated
            new_sources_block="${new_sources_block}
  - name: $spec_name
    status: incorporated"
            sources_added=true
        fi
    fi

    # If no sources were added, use empty array format
    if ! $sources_added; then
        new_sources_block="sources: []"
        # Echo info for Claude to prompt user about unmatched specs
        spec_name=$(basename "$file" .md)
        echo "MIGRATION_INFO: Specification '$spec_name' has no matching discussion. Sources field set to empty - please review and add sources manually."
    fi

    #
    # Update sources block in file
    #

    # Extract frontmatter (only the first block between --- delimiters)
    frontmatter=$(extract_frontmatter "$file")

    if $has_sources_field; then
        # Remove old sources block from frontmatter
        # First, remove lines from "sources:" until the next top-level field or end of frontmatter
        new_frontmatter=$(echo "$frontmatter" | awk '
/^sources:/ { skip=1; next }
/^[a-z_]+:/ && skip { skip=0 }
skip == 0 { print }
')
    else
        # No existing sources field - use frontmatter as-is
        new_frontmatter="$frontmatter"
    fi

    # Add new sources block at the end
    new_frontmatter="${new_frontmatter}
${new_sources_block}"

    # Extract content after frontmatter (everything after the second ---)
    # Uses awk to skip only the first two --- delimiters, preserving any --- in body content
    content=$(awk '/^---$/ && c<2 {c++; next} c>=2 {print}' "$file")

    # Write new file
    {
        echo "---"
        echo "$new_frontmatter"
        echo "---"
        echo "$content"
    } > "$file"

    # Report appropriate message based on what was done
    if $has_sources_field; then
        report_update "$file" "converted sources to object format"
    elif $sources_added; then
        report_update "$file" "added sources field with matching discussion"
    else
        report_update "$file" "added empty sources field (no matching discussion found)"
    fi
done
