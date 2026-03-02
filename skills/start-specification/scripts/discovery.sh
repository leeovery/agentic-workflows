#!/bin/bash
#
# Discovers the current state of discussions, specifications, and cache
# for the /start-specification command.
#
# Uses the manifest CLI for work unit state. Scans discussion files
# within work unit directories for source-level detail.
#
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"
WORKFLOWS_DIR=".workflows"
CACHE_FILE=".workflows/.state/discussion-consolidation-analysis.md"

# Helper: Extract a frontmatter field value from a file
# Usage: extract_field <file> <field_name>
extract_field() {
    local file="$1"
    local field="$2"
    local value=""

    # Extract from YAML frontmatter (file must start with ---)
    if head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        value=$(sed -n '2,/^---$/p' "$file" 2>/dev/null | \
            grep -i -m1 "^${field}:" | \
            sed -E "s/^${field}:[[:space:]]*//i" || true)
    fi

    echo "$value"
}

# Start YAML output
echo "# Specification Command State Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

# Get all active work units into a temp file for reuse
tmp_units=$(mktemp)
trap 'rm -f "$tmp_units"' EXIT

$MANIFEST list --status active 2>/dev/null > "$tmp_units" || echo "[]" > "$tmp_units"

work_unit_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$tmp_units','utf8')).length)" 2>/dev/null || echo "0")

# Parse work units into name/type pairs
tmp_pairs=$(mktemp)
trap 'rm -f "$tmp_units" "$tmp_pairs"' EXIT

if [ "$work_unit_count" -gt 0 ]; then
    node -e "
        const units = JSON.parse(require('fs').readFileSync('$tmp_units', 'utf8'));
        for (const u of units) {
            console.log(u.name + ' ' + u.work_type);
        }
    " 2>/dev/null > "$tmp_pairs"
fi

#
# DISCUSSIONS
#
echo "discussions:"

discussion_found=false

while IFS=' ' read -r wu_name wu_type; do
    [ -z "$wu_name" ] && continue
    disc_dir="$WORKFLOWS_DIR/$wu_name/discussion"
    [ -d "$disc_dir" ] || continue

    if [ "$wu_type" = "epic" ]; then
        # Epic: multiple discussion files
        for file in "$disc_dir"/*.md; do
            [ -f "$file" ] || continue
            name=$(basename "$file" .md)
            status=$(extract_field "$file" "status")
            status=${status:-"unknown"}

            # Check if this discussion is tracked as a spec source via manifest
            has_individual_spec="false"
            spec_status=""
            spec_phase_status=$($MANIFEST get "$wu_name".phases.specification.status 2>/dev/null || echo "")
            if [ -n "$spec_phase_status" ] && [ "$spec_phase_status" != "undefined" ]; then
                # Check if there's a sources entry for this discussion
                source_check=$($MANIFEST get "$wu_name".phases.specification.sources."$name".status 2>/dev/null || echo "")
                if [ -n "$source_check" ] && [ "$source_check" != "undefined" ]; then
                    has_individual_spec="true"
                    spec_status="$spec_phase_status"
                fi
            fi

            echo "  - name: \"$name\""
            echo "    work_unit: \"$wu_name\""
            echo "    status: \"$status\""
            echo "    work_type: \"$wu_type\""
            echo "    has_individual_spec: $has_individual_spec"
            if [ "$has_individual_spec" = "true" ]; then
                echo "    spec_status: \"$spec_status\""
            fi
            discussion_found=true
        done
    else
        # Feature/bugfix: single discussion file
        file="$disc_dir/discussion.md"
        [ -f "$file" ] || continue
        status=$(extract_field "$file" "status")
        status=${status:-"unknown"}

        # Check specification status via manifest
        has_individual_spec="false"
        spec_status=""
        spec_phase_status=$($MANIFEST get "$wu_name".phases.specification.status 2>/dev/null || echo "")
        if [ -n "$spec_phase_status" ] && [ "$spec_phase_status" != "undefined" ]; then
            has_individual_spec="true"
            spec_status="$spec_phase_status"
        fi

        echo "  - name: \"$wu_name\""
        echo "    work_unit: \"$wu_name\""
        echo "    status: \"$status\""
        echo "    work_type: \"$wu_type\""
        echo "    has_individual_spec: $has_individual_spec"
        if [ "$has_individual_spec" = "true" ]; then
            echo "    spec_status: \"$spec_status\""
        fi
        discussion_found=true
    fi
done < "$tmp_pairs"

if [ "$discussion_found" = false ]; then
    echo "  []  # No discussions found"
fi

echo ""

#
# SPECIFICATIONS
#
echo "specifications:"

spec_found=false

while IFS=' ' read -r wu_name wu_type; do
    [ -z "$wu_name" ] && continue
    spec_file="$WORKFLOWS_DIR/$wu_name/specification/specification.md"
    [ -f "$spec_file" ] || continue

    spec_status=$($MANIFEST get "$wu_name".phases.specification.status 2>/dev/null || echo "")
    [ -z "$spec_status" ] && spec_status=$(extract_field "$spec_file" "status")
    spec_status=${spec_status:-"in-progress"}

    # Check for superseded status in frontmatter
    superseded_by=$(extract_field "$spec_file" "superseded_by")

    echo "  - name: \"$wu_name\""
    echo "    work_unit: \"$wu_name\""
    echo "    status: \"$spec_status\""
    echo "    work_type: \"$wu_type\""

    if [ -n "$superseded_by" ]; then
        echo "    superseded_by: \"$superseded_by\""
    fi

    # Extract sources from manifest with discussion_status lookup
    sources_json=$($MANIFEST get "$wu_name".phases.specification.sources 2>/dev/null || echo "")
    if [ -n "$sources_json" ] && [ "$sources_json" != "undefined" ]; then
        echo "    sources:"
        # Emit each source with its discussion_status
        node -e "
            const sources = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            for (const [name] of Object.entries(sources)) { console.log(name); }
        " <<< "$sources_json" 2>/dev/null | while IFS= read -r src_name; do
            src_status=$(node -e "
                const sources = JSON.parse('$(echo "$sources_json" | sed "s/'/\\\\'/g")');
                const info = sources['$src_name'];
                console.log(typeof info === 'object' ? (info.status || 'incorporated') : 'incorporated');
            " 2>/dev/null || echo "incorporated")

            echo "      - name: \"$src_name\""
            echo "        status: \"$src_status\""

            # Look up discussion file for discussion_status
            if [ "$wu_type" = "epic" ]; then
                disc_file="$WORKFLOWS_DIR/$wu_name/discussion/${src_name}.md"
            else
                disc_file="$WORKFLOWS_DIR/$wu_name/discussion/discussion.md"
            fi
            if [ -f "$disc_file" ]; then
                disc_status=$(extract_field "$disc_file" "status")
                echo "        discussion_status: \"${disc_status:-unknown}\""
            else
                echo "        discussion_status: \"not-found\""
            fi
        done
    fi

    spec_found=true
done < "$tmp_pairs"

if [ "$spec_found" = false ]; then
    echo "  []  # No specifications found"
fi

echo ""

#
# CACHE STATE
#
# status: "valid" | "stale" | "none"
#   - valid: cache exists and checksums match
#   - stale: cache exists but discussions have changed
#   - none: no cache file exists
#
echo "cache:"

if [ -f "$CACHE_FILE" ]; then
    cached_checksum=$(extract_field "$CACHE_FILE" "checksum")
    cached_date=$(extract_field "$CACHE_FILE" "generated")

    # Compute current checksum across all discussion files in all work units
    all_discussion_files=$(find "$WORKFLOWS_DIR" -path "*/.archive" -prune -o -path "*/discussion/*.md" -print 2>/dev/null | sort)

    if [ -n "$all_discussion_files" ]; then
        current_checksum=$(echo "$all_discussion_files" | xargs cat 2>/dev/null | md5sum | cut -d' ' -f1)

        if [ "$cached_checksum" = "$current_checksum" ]; then
            echo "  status: \"valid\""
            echo "  reason: \"checksums match\""
        else
            echo "  status: \"stale\""
            echo "  reason: \"discussions have changed since cache was generated\""
        fi
    else
        echo "  status: \"stale\""
        echo "  reason: \"no discussions to compare\""
    fi

    echo "  checksum: \"${cached_checksum:-unknown}\""
    echo "  generated: \"${cached_date:-unknown}\""

    # Extract anchored names (groupings that have existing specs)
    echo "  anchored_names:"

    anchored_found=false
    while IFS= read -r grouping_name; do
        # Clean the name (remove any trailing annotations, lowercase, spaces to hyphens)
        clean_name=$(echo "$grouping_name" | sed 's/[[:space:]]*(.*)//' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
        if [ -d "$WORKFLOWS_DIR/$clean_name/specification" ] && [ -f "$WORKFLOWS_DIR/$clean_name/specification/specification.md" ]; then
            echo "    - \"$clean_name\""
            anchored_found=true
        fi
    done < <(grep "^### " "$CACHE_FILE" 2>/dev/null | sed 's/^### //' || true)

    if [ "$anchored_found" = false ]; then
        echo "    []  # No anchored names found"
    fi
else
    echo "  status: \"none\""
    echo "  reason: \"no cache exists\""
    echo "  checksum: null"
    echo "  generated: null"
    echo "  anchored_names: []"
fi

echo ""

#
# CURRENT STATE
#
echo "current_state:"

# Gather all discussion files across work units
all_disc_files=$(find "$WORKFLOWS_DIR" -path "*/.archive" -prune -o -path "*/discussion/*.md" -print 2>/dev/null | sort)

if [ -n "$all_disc_files" ]; then
    current_checksum=$(echo "$all_disc_files" | xargs cat 2>/dev/null | md5sum | cut -d' ' -f1)
    echo "  discussions_checksum: \"$current_checksum\""

    # Count discussions by status
    discussion_count=0
    concluded_count=0
    in_progress_count=0
    while IFS= read -r file; do
        [ -f "$file" ] || continue
        discussion_count=$((discussion_count + 1))
        status=$(extract_field "$file" "status")
        if [ "$status" = "concluded" ]; then
            concluded_count=$((concluded_count + 1))
        elif [ "$status" = "in-progress" ]; then
            in_progress_count=$((in_progress_count + 1))
        fi
    done <<< "$all_disc_files"
    echo "  discussion_count: $discussion_count"
    echo "  concluded_count: $concluded_count"
    echo "  in_progress_count: $in_progress_count"

    # Count non-superseded specifications
    spec_count=0
    while IFS=' ' read -r wu_name wu_type; do
        [ -z "$wu_name" ] && continue
        spec_file="$WORKFLOWS_DIR/$wu_name/specification/specification.md"
        [ -f "$spec_file" ] || continue
        file_status=$(extract_field "$spec_file" "status")
        if [ "$file_status" != "superseded" ]; then
            spec_count=$((spec_count + 1))
        fi
    done < "$tmp_pairs"
    echo "  spec_count: $spec_count"

    # Boolean helpers
    echo "  has_discussions: true"
    if [ "$concluded_count" -gt 0 ]; then
        echo "  has_concluded: true"
    else
        echo "  has_concluded: false"
    fi
    if [ "$spec_count" -gt 0 ]; then
        echo "  has_specs: true"
    else
        echo "  has_specs: false"
    fi
else
    echo "  discussions_checksum: null"
    echo "  discussion_count: 0"
    echo "  concluded_count: 0"
    echo "  in_progress_count: 0"
    echo "  spec_count: 0"
    echo "  has_discussions: false"
    echo "  has_concluded: false"
    echo "  has_specs: false"
fi
