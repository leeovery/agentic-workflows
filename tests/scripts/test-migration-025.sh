#!/bin/bash
#
# Tests for migration 025: unify-manifest-items
#
# Run: bash tests/scripts/test-migration-025.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/025-unify-manifest-items.sh"

PASS=0
FAIL=0

report_update() { : ; }
report_skip() { : ; }
export -f report_update report_skip

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
  TEST_DIR=$(mktemp -d /tmp/migration-025-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

create_manifest() {
  local name="$1"
  local content="$2"
  mkdir -p "$TEST_DIR/.workflows/$name"
  echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
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

run_migration() {
  cd "$TEST_DIR"
  bash "$MIGRATION" 2>&1
}

# --- Test 1: Feature flat discussion wrapped into items ---
test_feature_discussion_wrapped() {
  setup

  create_manifest "my-feat" '{
  "name": "my-feat",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

  run_migration > /dev/null

  assert_eq "status moved into items" "completed" "$(get_field "my-feat" "phases.discussion.items.my-feat.status")"

  teardown
}

# --- Test 2: Feature planning with extra fields wrapped correctly ---
test_feature_planning_wrapped() {
  setup

  create_manifest "plan-feat" '{
  "name": "plan-feat",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": { "status": "completed", "format": "local-markdown", "task_list_gate_mode": "gated" }
  }
}'

  run_migration > /dev/null

  assert_eq "status in items" "completed" "$(get_field "plan-feat" "phases.planning.items.plan-feat.status")"
  assert_eq "format in items" "local-markdown" "$(get_field "plan-feat" "phases.planning.items.plan-feat.format")"
  assert_eq "gate mode in items" "gated" "$(get_field "plan-feat" "phases.planning.items.plan-feat.task_list_gate_mode")"

  teardown
}

# --- Test 3: analysis_cache preserved at phase level ---
test_analysis_cache_preserved() {
  setup

  create_manifest "cached" '{
  "name": "cached",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed", "analysis_cache": { "checksum": "abc123" } }
  }
}'

  run_migration > /dev/null

  assert_eq "analysis_cache stays at phase level" "abc123" "$(get_field "cached" "phases.research.analysis_cache.checksum")"
  assert_eq "status moved to items" "completed" "$(get_field "cached" "phases.research.items.cached.status")"

  teardown
}

# --- Test 4: Bugfix investigation wrapped into items ---
test_bugfix_investigation_wrapped() {
  setup

  create_manifest "my-bug" '{
  "name": "my-bug",
  "work_type": "bugfix",
  "status": "in-progress",
  "phases": {
    "investigation": { "status": "in-progress" }
  }
}'

  run_migration > /dev/null

  assert_eq "bugfix investigation wrapped" "in-progress" "$(get_field "my-bug" "phases.investigation.items.my-bug.status")"

  teardown
}

# --- Test 5: Epic manifests are skipped ---
test_epic_skipped() {
  setup

  create_manifest "my-epic" '{
  "name": "my-epic",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "auth": { "status": "completed" } } }
  }
}'

  run_migration > /dev/null

  assert_eq "epic items unchanged" "completed" "$(get_field "my-epic" "phases.discussion.items.auth.status")"

  teardown
}

# --- Test 6: Phases already with items are skipped ---
test_already_has_items() {
  setup

  create_manifest "already-items" '{
  "name": "already-items",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "already-items": { "status": "completed" } } },
    "specification": { "status": "in-progress" }
  }
}'

  run_migration > /dev/null

  assert_eq "existing items untouched" "completed" "$(get_field "already-items" "phases.discussion.items.already-items.status")"
  assert_eq "flat phase wrapped" "in-progress" "$(get_field "already-items" "phases.specification.items.already-items.status")"

  teardown
}

# --- Test 7: Multiple phases wrapped in one manifest ---
test_multiple_phases_wrapped() {
  setup

  create_manifest "multi" '{
  "name": "multi",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" },
    "specification": { "status": "completed" },
    "planning": { "status": "in-progress", "format": "local-markdown" },
    "implementation": { "status": "in-progress", "completed_tasks": ["multi-1-1"] }
  }
}'

  run_migration > /dev/null

  assert_eq "discussion wrapped" "completed" "$(get_field "multi" "phases.discussion.items.multi.status")"
  assert_eq "specification wrapped" "completed" "$(get_field "multi" "phases.specification.items.multi.status")"
  assert_eq "planning format in items" "local-markdown" "$(get_field "multi" "phases.planning.items.multi.format")"
  assert_eq "implementation tasks in items" '["multi-1-1"]' "$(get_field "multi" "phases.implementation.items.multi.completed_tasks")"

  teardown
}

# --- Test 8: Idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{
  "name": "idem",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

  run_migration > /dev/null
  run_migration > /dev/null

  assert_eq "items still correct" "completed" "$(get_field "idem" "phases.discussion.items.idem.status")"

  teardown
}

# --- Test 9: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"name":".state","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"name":"real","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}'

  run_migration > /dev/null

  assert_eq "real manifest migrated" "completed" "$(get_field "real" "phases.discussion.items.real.status")"
  local dot_status
  dot_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(m.phases.discussion.status || 'missing');
  " "$TEST_DIR/.workflows/.state/manifest.json")
  assert_eq "dot-dir manifest untouched" "completed" "$dot_status"

  teardown
}

# --- Test 10: Empty phases object unchanged ---
test_empty_phases() {
  setup

  create_manifest "empty" '{"name":"empty","work_type":"feature","status":"in-progress","phases":{}}'

  run_migration > /dev/null

  teardown
}

# --- Test 11: No .workflows directory — exits cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  run_migration > /dev/null

  teardown
}

# --- Test 12: Preserves other manifest fields ---
test_preserves_fields() {
  setup

  create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "in-progress",
  "created": "2026-03-01",
  "description": "Test preservation",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

  run_migration > /dev/null

  assert_eq "name preserved" "preserve" "$(get_field "preserve" "name")"
  assert_eq "work type preserved" "feature" "$(get_field "preserve" "work_type")"
  assert_eq "created date preserved" "2026-03-01" "$(get_field "preserve" "created")"
  assert_eq "description preserved" "Test preservation" "$(get_field "preserve" "description")"

  teardown
}

# --- Run all tests ---
echo "Running migration 025 tests..."
echo ""

test_feature_discussion_wrapped
test_feature_planning_wrapped
test_analysis_cache_preserved
test_bugfix_investigation_wrapped
test_epic_skipped
test_already_has_items
test_multiple_phases_wrapped
test_idempotent
test_skips_dot_dirs
test_empty_phases
test_no_workflows_dir
test_preserves_fields

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
