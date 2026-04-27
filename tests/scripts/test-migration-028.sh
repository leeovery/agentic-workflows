#!/bin/bash
#
# Tests for migration 028: remove-phase-level-status
#
# Run: bash tests/scripts/test-migration-028.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/028-remove-phase-level-status.sh"

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

create_manifest() {
  local name="$1"
  local content="$2"
  mkdir -p "$TEST_DIR/.workflows/$name"
  echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

create_research_file() {
  local wu_name="$1"
  local filename="$2"
  mkdir -p "$TEST_DIR/.workflows/$wu_name/research"
  echo "# Research: $filename" > "$TEST_DIR/.workflows/$wu_name/research/$filename"
}

get_field() {
  local name="$1"
  local field="$2"
  node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const parts = process.argv[2].split('.');
    let v = m;
    for (const p of parts) v = (v || {})[p];
    console.log(v === undefined ? 'undefined' : (typeof v === 'object' ? JSON.stringify(v) : v));
  " "$TEST_DIR/.workflows/$name/manifest.json" "$field"
}

setup() {
  TEST_DIR=$(mktemp -d /tmp/migration-028-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: research with flat status backfilled from disk files ---
test_research_backfill() {
  setup

  create_manifest "v1" '{
  "name": "v1",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" },
    "discussion": { "items": { "auth": { "status": "completed" } } }
  }
}'
  create_research_file "v1" "exploration.md"
  create_research_file "v1" "architecture.md"

  source "$MIGRATION"

  assert_eq "exploration backfilled as item" "completed" "$(get_field "v1" "phases.research.items.exploration.status")"
  assert_eq "architecture backfilled as item" "completed" "$(get_field "v1" "phases.research.items.architecture.status")"
  assert_eq "flat status removed" "undefined" "$(get_field "v1" "phases.research.status")"
  assert_eq "existing items untouched" "completed" "$(get_field "v1" "phases.discussion.items.auth.status")"

  teardown
}

# --- Test 2: research flat status with no files on disk ---
test_research_no_files() {
  setup

  create_manifest "orphan" '{
  "name": "orphan",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" }
  }
}'

  source "$MIGRATION"

  assert_eq "empty phase object removed" "undefined" "$(get_field "orphan" "phases.research")"

  teardown
}

# --- Test 3: flat status alongside existing items — just removes status ---
test_flat_status_with_items() {
  setup

  create_manifest "mixed" '{
  "name": "mixed",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "status": "completed",
      "items": { "auth": { "status": "completed" }, "billing": { "status": "in-progress" } }
    }
  }
}'

  source "$MIGRATION"

  assert_eq "flat status removed" "undefined" "$(get_field "mixed" "phases.discussion.status")"
  assert_eq "auth item preserved" "completed" "$(get_field "mixed" "phases.discussion.items.auth.status")"
  assert_eq "billing item preserved" "in-progress" "$(get_field "mixed" "phases.discussion.items.billing.status")"

  teardown
}

# --- Test 4: non-research phase with flat status and no items ---
test_non_research_flat_status() {
  setup

  create_manifest "flat-disc" '{
  "name": "flat-disc",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" },
    "specification": { "status": "in-progress" }
  }
}'

  source "$MIGRATION"

  assert_eq "empty discussion phase removed" "undefined" "$(get_field "flat-disc" "phases.discussion")"
  assert_eq "empty specification phase removed" "undefined" "$(get_field "flat-disc" "phases.specification")"

  teardown
}

# --- Test 5: manifest with no flat statuses — unchanged ---
test_clean_manifest() {
  setup

  create_manifest "clean" '{
  "name": "clean",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "clean": { "status": "completed" } } }
  }
}'

  source "$MIGRATION"

  assert_eq "items untouched" "completed" "$(get_field "clean" "phases.discussion.items.clean.status")"

  teardown
}

# --- Test 6: multiple phases with flat status in one manifest ---
test_multiple_flat_statuses() {
  setup

  create_manifest "multi" '{
  "name": "multi",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" },
    "discussion": { "status": "completed" },
    "planning": { "status": "in-progress" }
  }
}'
  create_research_file "multi" "exploration.md"

  source "$MIGRATION"

  assert_eq "research backfilled" "completed" "$(get_field "multi" "phases.research.items.exploration.status")"
  assert_eq "research flat status removed" "undefined" "$(get_field "multi" "phases.research.status")"
  assert_eq "discussion orphan removed" "undefined" "$(get_field "multi" "phases.discussion")"
  assert_eq "planning orphan removed" "undefined" "$(get_field "multi" "phases.planning")"

  teardown
}

# --- Test 7: idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{
  "name": "idem",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" }
  }
}'
  create_research_file "idem" "exploration.md"

  source "$MIGRATION"
  source "$MIGRATION"

  assert_eq "items still correct" "completed" "$(get_field "idem" "phases.research.items.exploration.status")"

  teardown
}

# --- Test 8: skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"name":".state","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"name":"real","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}'

  source "$MIGRATION"

  local dot_status
  dot_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(m.phases.discussion.status || 'missing');
  " "$TEST_DIR/.workflows/.state/manifest.json")
  assert_eq "dot-dir manifest untouched" "completed" "$dot_status"

  teardown
}

# --- Test 9: no .workflows directory — exits cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  source "$MIGRATION"

  assert_eq "no crash without .workflows" "true" "true"

  teardown
}

# --- Test 10: preserves other manifest fields ---
test_preserves_fields() {
  setup

  create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "epic",
  "status": "in-progress",
  "created": "2026-03-01",
  "description": "Test preservation",
  "phases": {
    "research": { "status": "completed" }
  }
}'
  create_research_file "preserve" "exploration.md"

  source "$MIGRATION"

  assert_eq "name preserved" "preserve" "$(get_field "preserve" "name")"
  assert_eq "work type preserved" "epic" "$(get_field "preserve" "work_type")"
  assert_eq "created date preserved" "2026-03-01" "$(get_field "preserve" "created")"
  assert_eq "description preserved" "Test preservation" "$(get_field "preserve" "description")"

  teardown
}

# --- Run all tests ---
echo "Running migration 028 tests..."
echo ""

test_research_backfill
test_research_no_files
test_flat_status_with_items
test_non_research_flat_status
test_clean_manifest
test_multiple_flat_statuses
test_idempotent
test_skips_dot_dirs
test_no_workflows_dir
test_preserves_fields

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
