#!/usr/bin/env bash
#
# 014-specification-work-type.sh
#
# Adds work_type: greenfield to specification documents that don't have the field.
#
# Existing specifications without work_type are assumed to be greenfield work.
# New specifications will have work_type set by the skill that creates them.
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="014"
SPEC_DIR=".workflows/specification"

# Skip if no specification directory
if [ ! -d "$SPEC_DIR" ]; then
    return 0
fi

# Helper: Extract frontmatter safely (between first pair of --- delimiters)
extract_frontmatter() {
    local file="$1"
    awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null
}

# Helper: Extract content after frontmatter (preserving all body ---)
extract_content() {
    local file="$1"
    awk '/^---$/ && c<2 {c++; next} c>=2 {print}' "$file" 2>/dev/null
}

# Process each specification file
for file in "$SPEC_DIR"/*/specification.md; do
    [ -f "$file" ] || continue

    # Check if file has YAML frontmatter
    if ! head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        report_skip "$file"
        continue
    fi

    # Check if work_type already exists
    frontmatter=$(extract_frontmatter "$file")
    if echo "$frontmatter" | grep -q "^work_type:"; then
        report_skip "$file"
        continue
    fi

    # Add work_type: greenfield after type field
    content=$(extract_content "$file")

    # Build new frontmatter with work_type after type
    new_frontmatter=$(echo "$frontmatter" | awk '
        /^type:/ { print; print "work_type: greenfield"; next }
        { print }
    ')

    # If type wasn't found, add work_type at the end
    if ! echo "$new_frontmatter" | grep -q "^work_type:"; then
        new_frontmatter="$frontmatter
work_type: greenfield"
    fi

    # Write updated file
    {
        echo "---"
        echo "$new_frontmatter"
        echo "---"
        echo "$content"
    } > "$file"

    report_update "$file" "added work_type: greenfield"
done
