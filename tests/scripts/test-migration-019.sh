#!/bin/bash
# Tests for migration 019: status-rename
# Run: bash tests/scripts/test-migration-019.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/019-status-rename.sh"

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

create_manifest() {
  local name="$1"
  local content="$2"
  mkdir -p "$TEST_DIR/.workflows/$name"
  echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

get_status() {
  local name="$1"
  node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/$name/manifest.json"
}

get_json() {
  local name="$1"
  cat "$TEST_DIR/.workflows/$name/manifest.json"
}

setup() {
  TEST_DIR=$(mktemp -d /tmp/migration-019-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
  mkdir -p "$TEST_DIR/.claude"
  ln -sfn "$REPO_DIR/skills" "$TEST_DIR/.claude/skills"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: active to in-progress ---
test_active_to_in_progress() {
  setup

  create_manifest "my-feature" '{"work_type":"feature","status":"active","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status changed to in-progress" "in-progress" "$(get_status "my-feature")"

  teardown
}

# --- Test 2: archived to cancelled ---
test_archived_to_cancelled() {
  setup

  create_manifest "old-feature" '{"work_type":"feature","status":"archived","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status changed to cancelled" "cancelled" "$(get_status "old-feature")"

  teardown
}

# --- Test 3: in-progress unchanged (already correct) ---
test_in_progress_unchanged() {
  setup

  create_manifest "current" '{"work_type":"feature","status":"in-progress","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains in-progress" "in-progress" "$(get_status "current")"

  teardown
}

# --- Test 4: concluded unchanged ---
test_concluded_unchanged() {
  setup

  create_manifest "done-feature" '{"work_type":"feature","status":"concluded","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains concluded" "concluded" "$(get_status "done-feature")"

  teardown
}

# --- Test 5: cancelled unchanged ---
test_cancelled_unchanged() {
  setup

  create_manifest "dead-feature" '{"work_type":"feature","status":"cancelled","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains cancelled" "cancelled" "$(get_status "dead-feature")"

  teardown
}

# --- Test 6: feature with completed review to concluded ---
test_feature_completed_review() {
  setup

  create_manifest "done-but-active" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "concluded"},
    "review": {"status": "completed"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Completed pipeline detected and set to concluded" "concluded" "$(get_status "done-but-active")"

  teardown
}

# --- Test 7: feature in-progress with completed review to concluded ---
test_in_progress_completed_review() {
  setup

  create_manifest "done-in-progress" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "review": {"status": "completed"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "In-progress with completed review set to concluded" "concluded" "$(get_status "done-in-progress")"

  teardown
}

# --- Test 8: feature with incomplete review stays in-progress ---
test_incomplete_review() {
  setup

  create_manifest "mid-review" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "review": {"status": "in-progress"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Incomplete review stays in-progress (not concluded)" "in-progress" "$(get_status "mid-review")"

  teardown
}

# --- Test 9: feature with no review phase stays in-progress ---
test_no_review_phase() {
  setup

  create_manifest "no-review" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "discussion": {"status": "concluded"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "No review phase stays in-progress" "in-progress" "$(get_status "no-review")"

  teardown
}

# --- Test 10: epic with all review items completed to concluded ---
test_epic_all_review_completed() {
  setup

  create_manifest "done-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "review": {
      "items": {
        "topic-a": {"status": "completed"},
        "topic-b": {"status": "completed"}
      }
    }
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Epic with all review items completed set to concluded" "concluded" "$(get_status "done-epic")"

  teardown
}

# --- Test 11: epic with some review items incomplete stays in-progress ---
test_epic_partial_review() {
  setup

  create_manifest "partial-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "review": {
      "items": {
        "topic-a": {"status": "completed"},
        "topic-b": {"status": "in-progress"}
      }
    }
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Epic with incomplete review items stays in-progress" "in-progress" "$(get_status "partial-epic")"

  teardown
}

# --- Test 12: epic with no review items stays in-progress ---
test_epic_no_review() {
  setup

  create_manifest "no-review-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "discussion": {
      "items": {
        "topic-a": {"status": "concluded"}
      }
    }
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Epic with no review items stays in-progress" "in-progress" "$(get_status "no-review-epic")"

  teardown
}

# --- Test 13: bugfix with completed review to concluded ---
test_bugfix_completed_review() {
  setup

  create_manifest "fixed-bug" '{
  "work_type": "bugfix",
  "status": "active",
  "phases": {
    "review": {"status": "completed"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Bugfix with completed review set to concluded" "concluded" "$(get_status "fixed-bug")"

  teardown
}

# --- Test 14: multiple work units processed ---
test_multiple_work_units() {
  setup

  create_manifest "feat-a" '{"work_type":"feature","status":"active","phases":{}}'
  create_manifest "feat-b" '{"work_type":"feature","status":"archived","phases":{}}'
  create_manifest "feat-c" '{"work_type":"feature","status":"in-progress","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "First work unit: active to in-progress" "in-progress" "$(get_status "feat-a")"
  assert_eq "Second work unit: archived to cancelled" "cancelled" "$(get_status "feat-b")"
  assert_eq "Third work unit: in-progress unchanged" "in-progress" "$(get_status "feat-c")"

  teardown
}

# --- Test 15: skips dot-prefixed directories ---
test_skip_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"status":"active"}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"work_type":"feature","status":"active","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Real work unit updated" "in-progress" "$(get_status "real")"
  assert_eq "Dot-dir manifest not touched" "active" "$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/.state/manifest.json")"

  teardown
}

# --- Test 16: idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{"work_type":"feature","status":"active","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null
  before=$(get_json "idem")
  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null
  after=$(get_json "idem")

  assert_eq "JSON unchanged after second run" "$before" "$after"

  teardown
}

# --- Test 17: no .workflows directory — exits cleanly ---
test_no_workflows() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "exits cleanly" "true" "true"

  teardown
}

# --- Test 18: preserves other manifest fields ---
test_preserves_fields() {
  setup

  create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "active",
  "created": "2026-01-15",
  "description": "test feature",
  "phases": {
    "discussion": {"status": "concluded"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  json=$(get_json "preserve")

  assert_eq "Name preserved" "true" "$(echo "$json" | grep -qF '"name": "preserve"' && echo true || echo false)"
  assert_eq "Work type preserved" "true" "$(echo "$json" | grep -qF '"work_type": "feature"' && echo true || echo false)"
  assert_eq "Created date preserved" "true" "$(echo "$json" | grep -qF '"created": "2026-01-15"' && echo true || echo false)"
  assert_eq "Description preserved" "true" "$(echo "$json" | grep -qF '"description": "test feature"' && echo true || echo false)"
  assert_eq "Discussion phase status preserved" "true" "$(echo "$json" | grep -qF '"status": "concluded"' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 019 tests..."
echo ""

test_active_to_in_progress
test_archived_to_cancelled
test_in_progress_unchanged
test_concluded_unchanged
test_cancelled_unchanged
test_feature_completed_review
test_in_progress_completed_review
test_incomplete_review
test_no_review_phase
test_epic_all_review_completed
test_epic_partial_review
test_epic_no_review
test_bugfix_completed_review
test_multiple_work_units
test_skip_dot_dirs
test_idempotent
test_no_workflows
test_preserves_fields

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
