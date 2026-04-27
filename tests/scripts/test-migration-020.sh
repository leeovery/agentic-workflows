#!/bin/bash
# Tests for migration 020: normalise-terminal-status
# Run: bash tests/scripts/test-migration-020.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/020-normalise-terminal-status.sh"

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

get_json() {
  local name="$1"
  cat "$TEST_DIR/.workflows/$name/manifest.json"
}

setup() {
  TEST_DIR=$(mktemp -d /tmp/migration-020-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: work unit status concluded to completed ---
test_wu_concluded_to_completed() {
  setup

  create_manifest "done-feat" '{"work_type":"feature","status":"concluded","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Work unit status changed to completed" "completed" "$(get_field "done-feat" "status")"

  teardown
}

# --- Test 2: in-progress work unit unchanged ---
test_in_progress_unchanged() {
  setup

  create_manifest "active-feat" '{"work_type":"feature","status":"in-progress","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains in-progress" "in-progress" "$(get_field "active-feat" "status")"

  teardown
}

# --- Test 3: cancelled work unit unchanged ---
test_cancelled_unchanged() {
  setup

  create_manifest "dead-feat" '{"work_type":"feature","status":"cancelled","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains cancelled" "cancelled" "$(get_field "dead-feat" "status")"

  teardown
}

# --- Test 4: completed work unit unchanged ---
test_completed_unchanged() {
  setup

  create_manifest "already-done" '{"work_type":"feature","status":"completed","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Status remains completed" "completed" "$(get_field "already-done" "status")"

  teardown
}

# --- Test 5: flat phase statuses concluded to completed ---
test_flat_phase_statuses() {
  setup

  create_manifest "phases-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {"status": "concluded"},
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "completed"},
    "review": {"status": "in-progress"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "Research status to completed" "completed" "$(get_field "phases-feat" "phases.research.status")"
  assert_eq "Discussion status to completed" "completed" "$(get_field "phases-feat" "phases.discussion.status")"
  assert_eq "Specification status to completed" "completed" "$(get_field "phases-feat" "phases.specification.status")"
  assert_eq "Planning status to completed" "completed" "$(get_field "phases-feat" "phases.planning.status")"
  assert_eq "Implementation status unchanged" "completed" "$(get_field "phases-feat" "phases.implementation.status")"
  assert_eq "Review in-progress unchanged" "in-progress" "$(get_field "phases-feat" "phases.review.status")"

  teardown
}

# --- Test 6: in-progress phase statuses unchanged ---
test_in_progress_phase() {
  setup

  create_manifest "ip-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": {"status": "in-progress"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "In-progress stays in-progress" "in-progress" "$(get_field "ip-feat" "phases.discussion.status")"

  teardown
}

# --- Test 7: superseded specification unchanged ---
test_superseded_unchanged() {
  setup

  create_manifest "super-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "specification": {"status": "superseded"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "Superseded stays superseded" "superseded" "$(get_field "super-feat" "phases.specification.status")"

  teardown
}

# --- Test 8: epic item-level statuses concluded to completed ---
test_epic_item_statuses() {
  setup

  create_manifest "my-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "auth": {"status": "concluded"},
        "billing": {"status": "in-progress"}
      }
    },
    "specification": {
      "items": {
        "auth": {"status": "concluded"}
      }
    },
    "planning": {
      "items": {
        "auth": {"status": "concluded"}
      }
    },
    "implementation": {
      "items": {
        "auth": {"status": "completed"}
      }
    }
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "Epic discussion item to completed" "completed" "$(get_field "my-epic" "phases.discussion.items.auth.status")"
  assert_eq "In-progress item unchanged" "in-progress" "$(get_field "my-epic" "phases.discussion.items.billing.status")"
  assert_eq "Epic spec item to completed" "completed" "$(get_field "my-epic" "phases.specification.items.auth.status")"
  assert_eq "Epic planning item to completed" "completed" "$(get_field "my-epic" "phases.planning.items.auth.status")"
  assert_eq "Implementation item unchanged" "completed" "$(get_field "my-epic" "phases.implementation.items.auth.status")"

  teardown
}

# --- Test 9: bugfix phases concluded to completed ---
test_bugfix_phases() {
  setup

  create_manifest "my-bug" '{
  "work_type": "bugfix",
  "status": "concluded",
  "phases": {
    "investigation": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "completed"},
    "review": {"status": "completed"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "Bugfix work unit status to completed" "completed" "$(get_field "my-bug" "status")"
  assert_eq "Investigation to completed" "completed" "$(get_field "my-bug" "phases.investigation.status")"
  assert_eq "Specification to completed" "completed" "$(get_field "my-bug" "phases.specification.status")"
  assert_eq "Planning to completed" "completed" "$(get_field "my-bug" "phases.planning.status")"
  assert_eq "Implementation unchanged" "completed" "$(get_field "my-bug" "phases.implementation.status")"
  assert_eq "Review unchanged" "completed" "$(get_field "my-bug" "phases.review.status")"

  teardown
}

# --- Test 10: skips dot-prefixed directories ---
test_skip_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"status":"concluded"}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"work_type":"feature","status":"concluded","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "Real work unit updated" "completed" "$(get_field "real" "status")"
  dot_status=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/.state/manifest.json")
  assert_eq "Dot-dir manifest not touched" "concluded" "$dot_status"

  teardown
}

# --- Test 11: idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{
  "work_type": "feature",
  "status": "concluded",
  "phases": {
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null
  before=$(get_json "idem")
  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null
  after=$(get_json "idem")

  assert_eq "JSON unchanged after second run" "$before" "$after"

  teardown
}

# --- Test 12: preserves other manifest fields ---
test_preserves_fields() {
  setup

  create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "concluded",
  "created": "2026-01-15",
  "description": "test feature",
  "phases": {
    "discussion": {"status": "concluded", "analysis_cache": {"checksum": "abc123"}}
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  json=$(get_json "preserve")

  assert_eq "Name preserved" "true" "$(echo "$json" | grep -qF '"name": "preserve"' && echo true || echo false)"
  assert_eq "Work type preserved" "true" "$(echo "$json" | grep -qF '"work_type": "feature"' && echo true || echo false)"
  assert_eq "Created date preserved" "true" "$(echo "$json" | grep -qF '"created": "2026-01-15"' && echo true || echo false)"
  assert_eq "Description preserved" "true" "$(echo "$json" | grep -qF '"description": "test feature"' && echo true || echo false)"
  assert_eq "Analysis cache preserved" "true" "$(echo "$json" | grep -qF '"checksum": "abc123"' && echo true || echo false)"
  assert_eq "Phase status updated" "completed" "$(get_field "preserve" "phases.discussion.status")"

  teardown
}

# --- Test 13: no .workflows directory — exits cleanly ---
test_no_workflows() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION"

  assert_eq "exits cleanly" "true" "true"

  teardown
}

# --- Test 14: multiple work units processed ---
test_multiple_work_units() {
  setup

  create_manifest "feat-a" '{"work_type":"feature","status":"concluded","phases":{"discussion":{"status":"concluded"}}}'
  create_manifest "feat-b" '{"work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"concluded"}}}'
  create_manifest "feat-c" '{"work_type":"feature","status":"cancelled","phases":{}}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "First: work unit concluded to completed" "completed" "$(get_field "feat-a" "status")"
  assert_eq "First: phase concluded to completed" "completed" "$(get_field "feat-a" "phases.discussion.status")"
  assert_eq "Second: in-progress unchanged" "in-progress" "$(get_field "feat-b" "status")"
  assert_eq "Second: phase concluded to completed" "completed" "$(get_field "feat-b" "phases.discussion.status")"
  assert_eq "Third: cancelled unchanged" "cancelled" "$(get_field "feat-c" "status")"

  teardown
}

# --- Test 15: mixed epic with concluded and completed items ---
test_mixed_epic() {
  setup

  create_manifest "mixed-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "auth": {"status": "concluded"},
        "billing": {"status": "concluded"}
      }
    },
    "implementation": {
      "items": {
        "auth": {"status": "completed"}
      }
    },
    "review": {
      "items": {
        "auth": {"status": "completed"}
      }
    }
  }
}'

  PROJECT_DIR="$TEST_DIR" bash "$MIGRATION" > /dev/null

  assert_eq "Discussion auth to completed" "completed" "$(get_field "mixed-epic" "phases.discussion.items.auth.status")"
  assert_eq "Discussion billing to completed" "completed" "$(get_field "mixed-epic" "phases.discussion.items.billing.status")"
  assert_eq "Impl auth unchanged" "completed" "$(get_field "mixed-epic" "phases.implementation.items.auth.status")"
  assert_eq "Review auth unchanged" "completed" "$(get_field "mixed-epic" "phases.review.items.auth.status")"

  teardown
}

# --- Run all tests ---
echo "Running migration 020 tests..."
echo ""

test_wu_concluded_to_completed
test_in_progress_unchanged
test_cancelled_unchanged
test_completed_unchanged
test_flat_phase_statuses
test_in_progress_phase
test_superseded_unchanged
test_epic_item_statuses
test_bugfix_phases
test_skip_dot_dirs
test_idempotent
test_preserves_fields
test_no_workflows
test_multiple_work_units
test_mixed_epic

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
