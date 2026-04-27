#!/bin/bash
#
# Tests for migration 023: clear-research-analysis-cache
#
# Run: bash tests/scripts/test-migration-023.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/023-clear-research-analysis-cache.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-023-test.XXXXXX)
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

create_state_file() {
  local name="$1"
  local content="$2"
  mkdir -p "$TEST_DIR/.workflows/$name/.state"
  echo "$content" > "$TEST_DIR/.workflows/$name/.state/research-analysis.md"
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

# --- Test 1: Deletes .state/research-analysis.md ---
test_deletes_state_file() {
  setup

  create_manifest "my-feat" '{"work_type":"feature","status":"in-progress","phases":{"research":{}}}'
  create_state_file "my-feat" "# Research Analysis Cache\n\n## Topics\n\n### Theme\n- old format"

  run_migration > /dev/null

  assert_eq "state file deleted" "false" "$([ -f "$TEST_DIR/.workflows/my-feat/.state/research-analysis.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Clears analysis_cache from manifest ---
test_clears_analysis_cache() {
  setup

  create_manifest "cached-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {
        "checksum": "abc123",
        "generated": "2026-01-15T10:00:00Z",
        "files": ["intro.md", "deep-dive.md"]
      }
    }
  }
}'

  run_migration > /dev/null

  assert_eq "analysis_cache removed from manifest" "undefined" "$(get_field "cached-feat" "phases.research.analysis_cache")"
  assert_eq "research status preserved" "completed" "$(get_field "cached-feat" "phases.research.status")"

  teardown
}

# --- Test 3: Both file and manifest cleaned together ---
test_both_cleaned() {
  setup

  create_manifest "both" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "xyz789", "generated": "2026-02-01", "files": ["a.md"]}
    }
  }
}'
  create_state_file "both" "# old cache content"

  run_migration > /dev/null

  assert_eq "state file deleted" "false" "$([ -f "$TEST_DIR/.workflows/both/.state/research-analysis.md" ] && echo true || echo false)"
  assert_eq "analysis_cache removed" "undefined" "$(get_field "both" "phases.research.analysis_cache")"
  assert_eq "research status preserved" "completed" "$(get_field "both" "phases.research.status")"

  teardown
}

# --- Test 4: Manifest without analysis_cache unchanged ---
test_no_cache_unchanged() {
  setup

  create_manifest "no-cache" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {"status": "completed"},
    "discussion": {"status": "in-progress"}
  }
}'

  run_migration > /dev/null

  assert_eq "research status unchanged" "completed" "$(get_field "no-cache" "phases.research.status")"
  assert_eq "discussion status unchanged" "in-progress" "$(get_field "no-cache" "phases.discussion.status")"

  teardown
}

# --- Test 5: Manifest without research phase unchanged ---
test_no_research_phase() {
  setup

  create_manifest "no-research" '{"work_type":"bugfix","status":"in-progress","phases":{"investigation":{"status":"in-progress"}}}'

  run_migration > /dev/null

  assert_eq "investigation unchanged" "in-progress" "$(get_field "no-research" "phases.investigation.status")"

  teardown
}

# --- Test 6: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"phases":{"research":{"analysis_cache":{"checksum":"old"}}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"work_type":"feature","status":"in-progress","phases":{"research":{"analysis_cache":{"checksum":"old"}}}}'

  run_migration > /dev/null

  assert_eq "real manifest cleaned" "undefined" "$(get_field "real" "phases.research.analysis_cache")"
  local dot_cache
  dot_cache=$(node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(m.phases.research.analysis_cache ? 'present' : 'absent');
  " "$TEST_DIR/.workflows/.state/manifest.json")
  assert_eq "dot-dir manifest not touched" "present" "$dot_cache"

  teardown
}

# --- Test 7: Idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "abc", "generated": "2026-01-01", "files": ["x.md"]}
    }
  }
}'
  create_state_file "idem" "# old cache"

  run_migration > /dev/null
  run_migration > /dev/null

  assert_eq "state file still gone" "false" "$([ -f "$TEST_DIR/.workflows/idem/.state/research-analysis.md" ] && echo true || echo false)"
  assert_eq "analysis_cache still gone" "undefined" "$(get_field "idem" "phases.research.analysis_cache")"

  teardown
}

# --- Test 8: Preserves other manifest fields ---
test_preserves_fields() {
  setup

  create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "in-progress",
  "created": "2026-01-15",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "abc"}
    },
    "discussion": {"status": "in-progress"}
  }
}'

  run_migration > /dev/null

  assert_eq "name preserved" "preserve" "$(get_field "preserve" "name")"
  assert_eq "work type preserved" "feature" "$(get_field "preserve" "work_type")"
  assert_eq "created date preserved" "2026-01-15" "$(get_field "preserve" "created")"
  assert_eq "research status preserved" "completed" "$(get_field "preserve" "phases.research.status")"
  assert_eq "discussion status preserved" "in-progress" "$(get_field "preserve" "phases.discussion.status")"
  assert_eq "analysis_cache removed" "undefined" "$(get_field "preserve" "phases.research.analysis_cache")"

  teardown
}

# --- Test 9: Multiple work units processed ---
test_multiple_work_units() {
  setup

  create_manifest "feat-a" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed", "analysis_cache": {"checksum": "a1"}}}
}'
  create_state_file "feat-a" "# cache a"

  create_manifest "feat-b" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed", "analysis_cache": {"checksum": "b2"}}}
}'

  create_manifest "feat-c" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed"}}
}'

  run_migration > /dev/null

  assert_eq "feat-a state file deleted" "false" "$([ -f "$TEST_DIR/.workflows/feat-a/.state/research-analysis.md" ] && echo true || echo false)"
  assert_eq "feat-a cache cleared" "undefined" "$(get_field "feat-a" "phases.research.analysis_cache")"
  assert_eq "feat-b cache cleared" "undefined" "$(get_field "feat-b" "phases.research.analysis_cache")"
  assert_eq "feat-c had no cache, still none" "undefined" "$(get_field "feat-c" "phases.research.analysis_cache")"

  teardown
}

# --- Test 10: No .workflows directory — exits cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  run_migration > /dev/null

  teardown
}

# --- Run all tests ---
echo "Running migration 023 tests..."
echo ""

test_deletes_state_file
test_clears_analysis_cache
test_both_cleaned
test_no_cache_unchanged
test_no_research_phase
test_skips_dot_dirs
test_idempotent
test_preserves_fields
test_multiple_work_units
test_no_workflows_dir

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
