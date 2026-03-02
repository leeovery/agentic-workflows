#!/bin/bash
#
# Discovers the current state of research, discussions, and cache
# for the /start-discussion command.
#
# Uses manifest CLI to enumerate work units and their discussion phase state.
# Outputs structured YAML that the command can consume directly.
#

set -eo pipefail

MANIFEST_CLI="node .claude/skills/workflow-manifest/scripts/manifest.js"
CACHE_FILE=".workflows/.state/research-analysis.md"

# Helper: Extract a frontmatter field value from a file
# Usage: extract_field <file> <field_name>
extract_field() {
    local file="$1"
    local field="$2"
    local value=""

    if head -1 "$file" 2>/dev/null | grep -q "^---$"; then
        value=$(sed -n '2,/^---$/p' "$file" 2>/dev/null | \
            grep -i -m1 "^${field}:" | \
            sed -E "s/^${field}:[[:space:]]*//i" || true)
    fi

    echo "$value"
}

# Fetch all active work units as JSON array
json=$($MANIFEST_CLI list --status active 2>/dev/null || echo '[]')

# Start YAML output
echo "# Discussion Command State Discovery"
echo "# Generated: $(date -Iseconds)"
echo ""

#
# RESEARCH FILES (scan research dirs within work units)
#
echo "research:"

research_files=()
for wu_dir in .workflows/*/; do
    [ -d "$wu_dir" ] || continue
    wu_name=$(basename "$wu_dir")
    # Skip dot-prefixed directories
    case "$wu_name" in .*) continue ;; esac

    research_dir="${wu_dir}research"
    [ -d "$research_dir" ] || continue

    for file in "$research_dir"/*.md; do
        [ -f "$file" ] || continue
        research_files+=("$file")
    done
done

if [ ${#research_files[@]} -gt 0 ]; then
    echo "  exists: true"
    echo "  files:"
    for file in "${research_files[@]}"; do
        name=$(basename "$file" .md)
        topic=$(extract_field "$file" "topic")
        topic=${topic:-"$name"}

        echo "    - name: \"$name\""
        echo "      topic: \"$topic\""
    done

    # Compute checksum of all research files (deterministic via sorted glob)
    research_checksum=$(cat "${research_files[@]}" 2>/dev/null | md5sum | cut -d' ' -f1)
    echo "  checksum: \"$research_checksum\""
else
    echo "  exists: false"
    echo "  files: []"
    echo "  checksum: null"
fi

echo ""

#
# DISCUSSIONS (from manifest CLI)
#
echo "discussions:"

node -e "
  const manifests = JSON.parse(process.argv[1]);
  const fs = require('fs');
  const path = require('path');

  // Collect all discussion entries across work units
  const discussions = [];

  for (const m of manifests) {
    const dp = m.phases && m.phases.discussion;
    if (!dp) continue;

    if (m.work_type === 'epic') {
      // Epic: multiple discussion items under phases.discussion.items
      const items = dp.items || {};
      for (const [itemName, itemData] of Object.entries(items)) {
        discussions.push({
          name: itemName,
          work_unit: m.name,
          work_type: m.work_type,
          status: itemData.status || 'unknown',
        });
      }
      // Also check for top-level discussion status (epic with no items yet)
      if (Object.keys(items).length === 0 && dp.status) {
        discussions.push({
          name: m.name,
          work_unit: m.name,
          work_type: m.work_type,
          status: dp.status,
        });
      }
    } else {
      // Feature/bugfix: single discussion per work unit
      if (dp.status) {
        discussions.push({
          name: m.name,
          work_unit: m.name,
          work_type: m.work_type,
          status: dp.status,
        });
      }
    }
  }

  if (discussions.length === 0) {
    console.log('  exists: false');
    console.log('  files: []');
    console.log('  counts:');
    console.log('    in_progress: 0');
    console.log('    concluded: 0');
  } else {
    let inProgress = 0;
    let concluded = 0;

    console.log('  exists: true');
    console.log('  files:');
    for (const d of discussions) {
      console.log('    - name: \"' + d.name + '\"');
      console.log('      work_unit: \"' + d.work_unit + '\"');
      console.log('      status: \"' + d.status + '\"');
      console.log('      work_type: \"' + d.work_type + '\"');

      if (d.status === 'in-progress') inProgress++;
      else if (d.status === 'concluded') concluded++;
    }
    console.log('  counts:');
    console.log('    in_progress: ' + inProgress);
    console.log('    concluded: ' + concluded);
  }
" "$json"

echo ""

#
# CACHE STATE
#
# status: "valid" | "stale" | "none"
#   - valid: cache exists and checksums match
#   - stale: cache exists but research has changed
#   - none: no cache file exists
#
echo "cache:"

if [ -f "$CACHE_FILE" ]; then
    cached_checksum=$(extract_field "$CACHE_FILE" "checksum")
    cached_date=$(extract_field "$CACHE_FILE" "generated")

    # Determine status based on checksum comparison
    # Collect all research files across work units
    _cache_research_files=()
    for _wu_dir in .workflows/*/; do
        [ -d "$_wu_dir" ] || continue
        _wu_name=$(basename "$_wu_dir")
        case "$_wu_name" in .*) continue ;; esac
        [ -d "${_wu_dir}research" ] || continue
        for _rf in "${_wu_dir}research"/*.md; do
            [ -f "$_rf" ] && _cache_research_files+=("$_rf")
        done
    done

    if [ ${#_cache_research_files[@]} -gt 0 ]; then
        current_checksum=$(cat "${_cache_research_files[@]}" 2>/dev/null | md5sum | cut -d' ' -f1)

        if [ "$cached_checksum" = "$current_checksum" ]; then
            echo "  status: \"valid\""
            echo "  reason: \"checksums match\""
        else
            echo "  status: \"stale\""
            echo "  reason: \"research has changed since cache was generated\""
        fi
    else
        echo "  status: \"stale\""
        echo "  reason: \"no research files to compare\""
    fi

    echo "  checksum: \"${cached_checksum:-unknown}\""
    echo "  generated: \"${cached_date:-unknown}\""

    # Extract cached research files list
    echo "  research_files:"
    files_found=false
    while IFS= read -r file; do
        file=$(echo "$file" | sed 's/^[[:space:]]*-[[:space:]]*//' | tr -d ' ')
        if [ -n "$file" ]; then
            echo "    - \"$file\""
            files_found=true
        fi
    done < <(sed -n '/^research_files:/,/^---$/p' "$CACHE_FILE" 2>/dev/null | grep "^[[:space:]]*-" || true)

    if [ "$files_found" = false ]; then
        echo "    []  # No research files in cache"
    fi
else
    echo "  status: \"none\""
    echo "  reason: \"no cache exists\""
    echo "  checksum: null"
    echo "  generated: null"
    echo "  research_files: []"
fi

echo ""

#
# WORKFLOW STATE SUMMARY
#
echo "state:"

research_exists="false"
discussions_exist="false"

# Check for research files across all work units
for _wu_dir in .workflows/*/; do
    [ -d "$_wu_dir" ] || continue
    _wu_name=$(basename "$_wu_dir")
    case "$_wu_name" in .*) continue ;; esac
    if [ -d "${_wu_dir}research" ] && [ -n "$(ls -A "${_wu_dir}research" 2>/dev/null)" ]; then
        research_exists="true"
        break
    fi
done

# Check discussions via manifest data already fetched
disc_count=$(node -e "
  const manifests = JSON.parse(process.argv[1]);
  let count = 0;
  for (const m of manifests) {
    const dp = m.phases && m.phases.discussion;
    if (!dp) continue;
    if (m.work_type === 'epic') {
      count += Object.keys(dp.items || {}).length;
      if (Object.keys(dp.items || {}).length === 0 && dp.status) count++;
    } else if (dp.status) {
      count++;
    }
  }
  console.log(count);
" "$json")

if [ "$disc_count" -gt 0 ] 2>/dev/null; then
    discussions_exist="true"
fi

echo "  has_research: $research_exists"
echo "  has_discussions: $discussions_exist"

# Determine workflow state for routing
if [ "$research_exists" = "false" ] && [ "$discussions_exist" = "false" ]; then
    echo "  scenario: \"fresh\""
elif [ "$research_exists" = "true" ] && [ "$discussions_exist" = "false" ]; then
    echo "  scenario: \"research_only\""
elif [ "$research_exists" = "false" ] && [ "$discussions_exist" = "true" ]; then
    echo "  scenario: \"discussions_only\""
else
    echo "  scenario: \"research_and_discussions\""
fi
