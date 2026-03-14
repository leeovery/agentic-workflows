#!/usr/bin/env bash
#
# 005-plan-external-deps-frontmatter.sh
#
# Migrates external dependencies from body markdown section to plan frontmatter.
#
# Previous format (body section):
#   ## External Dependencies
#
#   - billing-system: Invoice generation for order completion
#   - user-authentication: User context for permissions → auth-1-3 (resolved)
#   - ~~payment-gateway: Payment processing~~ → satisfied externally
#
# New format (frontmatter):
#   external_dependencies:
#     - topic: billing-system
#       description: Invoice generation for order completion
#       state: unresolved
#     - topic: user-authentication
#       description: User context for permissions
#       state: resolved
#       task_id: auth-1-3
#     - topic: payment-gateway
#       description: Payment processing
#       state: satisfied_externally
#
# Body formats handled:
#   - "- {topic}: {description}" → state: unresolved
#   - "- {topic}: {description} → {task-id}" or with "(resolved)" → state: resolved, task_id
#   - "- ~~{topic}: {description}~~ → satisfied externally" → state: satisfied_externally
#
# This script is sourced by migrate.sh and has access to:
#   - report_update "filepath" "description"
#   - report_skip "filepath"
#

MIGRATION_ID="005"
PLAN_DIR="docs/workflow/planning"

# Skip if no planning directory
if [ ! -d "$PLAN_DIR" ]; then
    return 0
fi

# Helper: Extract ONLY the frontmatter content (between first pair of --- delimiters)
extract_frontmatter_005() {
    local file="$1"
    awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file" 2>/dev/null
}

# Helper: Extract content after frontmatter (preserving all body ---)
extract_body_005() {
    local file="$1"
    awk '/^---$/ && c<2 {c++; next} c>=2 {print}' "$file"
}

# Helper: Extract the External Dependencies section from body content
# Returns only the direct content (list items, "None." text) — stops at subsections (###) or next section (##)
extract_ext_deps_section() {
    local body="$1"
    echo "$body" | awk '
/^## External Dependencies/ { found=1; next }
found && /^## [^#]/ { exit }
found && /^### / { exit }
found { print }
'
}

# Helper: Parse a single dependency line into topic, description, state, task_id
# Sets global variables: DEP_TOPIC, DEP_DESC, DEP_STATE, DEP_TASK_ID
parse_dep_line() {
    local line="$1"
    DEP_TOPIC=""
    DEP_DESC=""
    DEP_STATE=""
    DEP_TASK_ID=""

    # Strip leading "- " or "  - "
    line=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//')

    # Check for satisfied_externally: ~~{topic}: {description}~~ → satisfied externally
    if echo "$line" | grep -q '^\~\~.*\~\~.*satisfied externally'; then
        # Remove ~~ markers
        local inner
        inner=$(echo "$line" | sed 's/^\~\~//' | sed 's/\~\~.*//')
        DEP_TOPIC=$(echo "$inner" | sed 's/:.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        DEP_DESC=$(echo "$inner" | sed 's/^[^:]*:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        DEP_STATE="satisfied_externally"
        return 0
    fi

    # Check for resolved: {topic}: {description} → {task-id} (with optional "(resolved)")
    if echo "$line" | grep -qE '→|->'; then
        local before_arrow after_arrow
        # Split on → or ->
        before_arrow=$(echo "$line" | sed -E 's/[[:space:]]*(→|->).*//')
        after_arrow=$(echo "$line" | sed -E 's/.*[[:space:]]*(→|->)[[:space:]]*//')
        # Remove "(resolved)" suffix if present
        after_arrow=$(echo "$after_arrow" | sed 's/[[:space:]]*(resolved)[[:space:]]*$//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        DEP_TOPIC=$(echo "$before_arrow" | sed 's/:.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        DEP_DESC=$(echo "$before_arrow" | sed 's/^[^:]*:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        DEP_STATE="resolved"
        DEP_TASK_ID="$after_arrow"
        return 0
    fi

    # Unresolved: {topic}: {description}
    DEP_TOPIC=$(echo "$line" | sed 's/:.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    DEP_DESC=$(echo "$line" | sed 's/^[^:]*:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    DEP_STATE="unresolved"
    return 0
}

# Process each plan file
for file in "$PLAN_DIR"/*.md; do
    [ -f "$file" ] || continue

    # Skip tracking/review files — only process plan documents
    case "$(basename "$file")" in
        *-review-*|*-tracking*) continue ;;
    esac

    # Check if file has YAML frontmatter
    if ! head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        report_skip "$file"
        continue
    fi

    # Check if external_dependencies already exists in frontmatter
    frontmatter=$(extract_frontmatter_005 "$file")
    if echo "$frontmatter" | grep -q "^external_dependencies:"; then
        report_skip "$file"
        continue
    fi

    # Extract body and look for External Dependencies section
    body=$(extract_body_005 "$file")
    deps_section=$(extract_ext_deps_section "$body")

    # Build the new frontmatter field
    new_deps_block=""
    has_deps=false

    # Check if section exists and has content beyond "No external dependencies."
    if [ -n "$deps_section" ]; then
        # Get only lines that look like list items
        dep_lines=$(echo "$deps_section" | grep -E '^[[:space:]]*-[[:space:]]' || true)

        if [ -n "$dep_lines" ]; then
            new_deps_block="external_dependencies:"
            while IFS= read -r dep_line; do
                [ -z "$dep_line" ] && continue
                parse_dep_line "$dep_line"
                if [ -n "$DEP_TOPIC" ]; then
                    has_deps=true
                    new_deps_block="${new_deps_block}
  - topic: $DEP_TOPIC
    description: $DEP_DESC
    state: $DEP_STATE"
                    if [ -n "$DEP_TASK_ID" ]; then
                        new_deps_block="${new_deps_block}
    task_id: $DEP_TASK_ID"
                    fi
                fi
            done <<< "$dep_lines"
        fi
    fi

    # If no deps found, use empty array
    if ! $has_deps; then
        new_deps_block="external_dependencies: []"
    fi

    # Remove the External Dependencies body section
    # Only remove the h2 heading and its direct content (list items, "None."/"No external dependencies.")
    # Preserve any subsections (### headings) that may follow within the section
    new_body=$(echo "$body" | awk '
/^## External Dependencies/ { skip=1; next }
skip && /^## [^#]/ { skip=0 }
skip && /^### / { skip=0 }
skip { next }
{ print }
')

    # Clean up: remove consecutive blank lines left from section removal (keep max 1)
    new_body=$(echo "$new_body" | awk '
/^$/ { blank++; if (blank <= 1) print; next }
{ blank=0; print }
')

    # Remove existing external_dependencies from frontmatter if somehow partially there
    new_frontmatter=$(echo "$frontmatter" | awk '
/^external_dependencies:/ { skip=1; next }
/^[a-z_]+:/ && skip { skip=0 }
skip == 0 { print }
')

    # Insert external_dependencies before the planning: block (or at end if no planning:)
    if echo "$new_frontmatter" | grep -q "^planning:"; then
        # Split at planning: line, insert deps block before it
        before_planning=$(echo "$new_frontmatter" | sed -n '/^planning:/q;p')
        planning_block=$(echo "$new_frontmatter" | sed -n '/^planning:/,$ p')
        final_frontmatter="${before_planning}
${new_deps_block}
${planning_block}"
    else
        final_frontmatter="${new_frontmatter}
${new_deps_block}"
    fi

    # Write the updated file
    {
        echo "---"
        echo "$final_frontmatter"
        echo "---"
        echo "$new_body"
    } > "$file"

    if $has_deps; then
        report_update "$file" "migrated external dependencies to frontmatter"
    else
        report_update "$file" "added empty external_dependencies to frontmatter"
    fi
done
