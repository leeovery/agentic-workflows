#!/bin/bash
#
# Tests for migration 039: move-gap-analysis-cache
#
# Run: bash tests/scripts/test-migration-039.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/039-move-gap-analysis-cache.sh"

PASS=0
FAIL=0

report_update() { : ; }
report_skip() { : ; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label"
    echo "  expected: $expected"
    echo "  actual:   $actual"
  fi
}

setup() {
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-039-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Legacy cache present → removed from discussion ---
test_legacy_cache_removed() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-a"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-a",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {"foo": {"status": "completed"}},
      "gap_analysis_cache": {"checksum": "abc123", "generated": "2025-01-01"}
    }
  }
}
JSON

  source "$MIGRATION"

  local has_legacy=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.discussion && m.phases.discussion.gap_analysis_cache));
  ")
  assert_eq "legacy cache removed from discussion" "false" "$has_legacy"

  local has_items=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.discussion && m.phases.discussion.items && m.phases.discussion.items.foo));
  ")
  assert_eq "discussion items preserved" "true" "$has_items"

  local has_new=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception && m.phases.inception.gap_analysis_cache));
  ")
  assert_eq "new location NOT pre-populated" "false" "$has_new"

  teardown
}

# --- Test 2: No legacy cache → no-op ---
test_no_legacy_cache_noop() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-b"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-b",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {"items": {"foo": {"status": "completed"}}}
  }
}
JSON

  local before=$(cat "$wu_dir/manifest.json")

  source "$MIGRATION"

  local after=$(cat "$wu_dir/manifest.json")
  assert_eq "no-op when no legacy cache" "true" "$([ "$before" = "$after" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Idempotent — runs twice safely ---
test_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-c"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-c",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "gap_analysis_cache": {"checksum": "abc123"}
    }
  }
}
JSON

  source "$MIGRATION"
  local after_first=$(cat "$wu_dir/manifest.json")

  source "$MIGRATION"
  local after_second=$(cat "$wu_dir/manifest.json")

  assert_eq "idempotent: second run matches first" "true" "$([ "$after_first" = "$after_second" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Non-epic work units untouched ---
test_non_epic_untouched() {
  setup

  local wu_dir="$TEST_DIR/.workflows/feat-x"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-x",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "gap_analysis_cache": {"checksum": "xyz"}
    }
  }
}
JSON

  source "$MIGRATION"

  local has_legacy=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.discussion && m.phases.discussion.gap_analysis_cache));
  ")
  assert_eq "non-epic feature untouched" "true" "$has_legacy"

  teardown
}

test_legacy_cache_removed
test_no_legacy_cache_noop
test_idempotent
test_non_epic_untouched

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
