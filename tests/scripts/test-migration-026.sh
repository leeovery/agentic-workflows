#!/bin/bash
#
# Tests for migration 026: rename-review-artifacts
#
# Run: bash tests/scripts/test-migration-026.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/026-rename-review-artifacts.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-026-test.XXXXXX)
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

create_plan_with_tasks() {
  local wu="$1"
  local topic="$2"
  shift 2
  local ids=("$@")

  mkdir -p "$TEST_DIR/.workflows/$wu/planning/$topic"
  local plan="$TEST_DIR/.workflows/$wu/planning/$topic/planning.md"

  echo "# Plan" > "$plan"
  echo "" >> "$plan"
  echo "| Internal ID | Task | Phase |" >> "$plan"
  echo "|-------------|------|-------|" >> "$plan"
  for id in "${ids[@]}"; do
    echo "| $id | Task description | Phase 1 |" >> "$plan"
  done
}

create_review_files() {
  local wu="$1"
  local topic="$2"
  shift 2

  mkdir -p "$TEST_DIR/.workflows/$wu/review/$topic"

  echo "# Review" > "$TEST_DIR/.workflows/$wu/review/$topic/review.md"

  local n=1
  for _ in "$@"; do
    echo "QA findings for task $n" > "$TEST_DIR/.workflows/$wu/review/$topic/qa-task-${n}.md"
    n=$((n + 1))
  done
}

run_migration() {
  cd "$TEST_DIR"
  bash "$MIGRATION" 2>&1
}

# --- Test 1: Feature — review.md renamed to report.md, qa-task files renamed ---
test_feature_rename() {
  setup

  create_manifest "my-feat" '{"name":"my-feat","work_type":"feature","status":"in-progress","phases":{}}'
  create_plan_with_tasks "my-feat" "my-feat" "my-feat-1-1" "my-feat-1-2" "my-feat-2-1"
  create_review_files "my-feat" "my-feat" t1 t2 t3

  run_migration > /dev/null

  assert_eq "review.md renamed to report.md" "true" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/report.md" ] && echo true || echo false)"
  assert_eq "old review.md removed" "false" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/review.md" ] && echo true || echo false)"
  assert_eq "qa-task-1.md -> report-1-1.md" "true" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/report-1-1.md" ] && echo true || echo false)"
  assert_eq "qa-task-2.md -> report-1-2.md" "true" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/report-1-2.md" ] && echo true || echo false)"
  assert_eq "qa-task-3.md -> report-2-1.md" "true" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/report-2-1.md" ] && echo true || echo false)"
  assert_eq "old qa-task-1.md removed" "false" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "old qa-task-2.md removed" "false" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "old qa-task-3.md removed" "false" "$([ -f "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-3.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Epic with multiple topics ---
test_epic_multiple_topics() {
  setup

  create_manifest "my-epic" '{"name":"my-epic","work_type":"epic","status":"in-progress","phases":{}}'
  create_plan_with_tasks "my-epic" "auth" "auth-1-1" "auth-1-2"
  create_plan_with_tasks "my-epic" "billing" "billing-1-1"
  create_review_files "my-epic" "auth" t1 t2
  create_review_files "my-epic" "billing" t1

  run_migration > /dev/null

  assert_eq "auth: review.md -> report.md" "true" "$([ -f "$TEST_DIR/.workflows/my-epic/review/auth/report.md" ] && echo true || echo false)"
  assert_eq "auth: qa-task-1 -> report-1-1" "true" "$([ -f "$TEST_DIR/.workflows/my-epic/review/auth/report-1-1.md" ] && echo true || echo false)"
  assert_eq "auth: qa-task-2 -> report-1-2" "true" "$([ -f "$TEST_DIR/.workflows/my-epic/review/auth/report-1-2.md" ] && echo true || echo false)"
  assert_eq "billing: review.md -> report.md" "true" "$([ -f "$TEST_DIR/.workflows/my-epic/review/billing/report.md" ] && echo true || echo false)"
  assert_eq "billing: qa-task-1 -> report-1-1" "true" "$([ -f "$TEST_DIR/.workflows/my-epic/review/billing/report-1-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Already migrated — skip gracefully ---
test_already_migrated() {
  setup

  create_manifest "done" '{"name":"done","work_type":"feature","status":"completed","phases":{}}'
  mkdir -p "$TEST_DIR/.workflows/done/review/done"
  echo "# Report" > "$TEST_DIR/.workflows/done/review/done/report.md"
  echo "findings" > "$TEST_DIR/.workflows/done/review/done/report-1-1.md"

  run_migration > /dev/null

  assert_eq "report.md still exists" "true" "$([ -f "$TEST_DIR/.workflows/done/review/done/report.md" ] && echo true || echo false)"
  assert_eq "report-1-1.md still exists" "true" "$([ -f "$TEST_DIR/.workflows/done/review/done/report-1-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: No plan exists — review.md renamed, qa-task files skipped ---
test_no_plan() {
  setup

  create_manifest "no-plan" '{"name":"no-plan","work_type":"feature","status":"in-progress","phases":{}}'
  mkdir -p "$TEST_DIR/.workflows/no-plan/review/no-plan"
  echo "# Review" > "$TEST_DIR/.workflows/no-plan/review/no-plan/review.md"
  echo "findings" > "$TEST_DIR/.workflows/no-plan/review/no-plan/qa-task-1.md"

  run_migration > /dev/null

  assert_eq "review.md still renamed" "true" "$([ -f "$TEST_DIR/.workflows/no-plan/review/no-plan/report.md" ] && echo true || echo false)"
  assert_eq "qa-task-1 preserved (no plan)" "true" "$([ -f "$TEST_DIR/.workflows/no-plan/review/no-plan/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Count mismatch — qa-task files skipped ---
test_count_mismatch() {
  setup

  create_manifest "mismatch" '{"name":"mismatch","work_type":"feature","status":"in-progress","phases":{}}'
  create_plan_with_tasks "mismatch" "mismatch" "mismatch-1-1" "mismatch-1-2"
  mkdir -p "$TEST_DIR/.workflows/mismatch/review/mismatch"
  echo "# Review" > "$TEST_DIR/.workflows/mismatch/review/mismatch/review.md"
  echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-1.md"
  echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-2.md"
  echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-3.md"

  run_migration > /dev/null

  assert_eq "review.md still renamed" "true" "$([ -f "$TEST_DIR/.workflows/mismatch/review/mismatch/report.md" ] && echo true || echo false)"
  assert_eq "qa-task-1 preserved (mismatch)" "true" "$([ -f "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "qa-task-2 preserved (mismatch)" "true" "$([ -f "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "qa-task-3 preserved (mismatch)" "true" "$([ -f "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-3.md" ] && echo true || echo false)"

  teardown
}

# --- Test 6: Topic with hyphens — suffix derived correctly ---
test_hyphenated_topic() {
  setup

  create_manifest "auto-cascade-parent-status" '{"name":"auto-cascade-parent-status","work_type":"feature","status":"in-progress","phases":{}}'
  create_plan_with_tasks "auto-cascade-parent-status" "auto-cascade-parent-status" \
    "auto-cascade-parent-status-1-1" "auto-cascade-parent-status-1-2"
  create_review_files "auto-cascade-parent-status" "auto-cascade-parent-status" t1 t2

  run_migration > /dev/null

  assert_eq "hyphenated topic: correct suffix 1-1" "true" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-1.md" ] && echo true || echo false)"
  assert_eq "hyphenated topic: correct suffix 1-2" "true" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-2.md" ] && echo true || echo false)"

  teardown
}

# --- Test 7: Abbreviated ID prefix — suffix still derived correctly ---
test_abbreviated_prefix() {
  setup

  create_manifest "auto-cascade-parent-status" '{"name":"auto-cascade-parent-status","work_type":"feature","status":"in-progress","phases":{}}'
  create_plan_with_tasks "auto-cascade-parent-status" "auto-cascade-parent-status" \
    "acps-1-1" "acps-1-2" "acps-2-1"
  create_review_files "auto-cascade-parent-status" "auto-cascade-parent-status" t1 t2 t3

  run_migration > /dev/null

  assert_eq "abbreviated prefix: correct suffix 1-1" "true" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-1.md" ] && echo true || echo false)"
  assert_eq "abbreviated prefix: correct suffix 1-2" "true" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-2.md" ] && echo true || echo false)"
  assert_eq "abbreviated prefix: correct suffix 2-1" "true" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-2-1.md" ] && echo true || echo false)"
  assert_eq "old qa-task-1 removed" "false" "$([ -f "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 8: Plan with changelog dates — dates not mistaken for task IDs ---
test_changelog_dates() {
  setup

  create_manifest "with-log" '{"name":"with-log","work_type":"feature","status":"in-progress","phases":{}}'
  mkdir -p "$TEST_DIR/.workflows/with-log/planning/with-log"
  cat > "$TEST_DIR/.workflows/with-log/planning/with-log/planning.md" <<'PLAN'
# Plan

| Internal ID | Task | Phase |
|-------------|------|-------|
| with-log-1-1 | First task | Phase 1 |
| with-log-1-2 | Second task | Phase 1 |

## Changelog

| Date | Note |
|------|------|
| 2026-01-27 | Created from specification |
| 2026-01-30 | Migrated to updated plan format |
| 2026-02-10 | Phase 2 added |
PLAN

  create_review_files "with-log" "with-log" t1 t2

  run_migration > /dev/null

  assert_eq "task 1 renamed correctly" "true" "$([ -f "$TEST_DIR/.workflows/with-log/review/with-log/report-1-1.md" ] && echo true || echo false)"
  assert_eq "task 2 renamed correctly" "true" "$([ -f "$TEST_DIR/.workflows/with-log/review/with-log/report-1-2.md" ] && echo true || echo false)"
  assert_eq "old file removed" "false" "$([ -f "$TEST_DIR/.workflows/with-log/review/with-log/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 9: Idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{"name":"idem","work_type":"feature","status":"in-progress","phases":{}}'
  create_plan_with_tasks "idem" "idem" "idem-1-1"
  create_review_files "idem" "idem" t1

  run_migration > /dev/null
  run_migration > /dev/null

  assert_eq "report.md still correct" "true" "$([ -f "$TEST_DIR/.workflows/idem/review/idem/report.md" ] && echo true || echo false)"
  assert_eq "report-1-1.md still correct" "true" "$([ -f "$TEST_DIR/.workflows/idem/review/idem/report-1-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 10: No .workflows directory — exits cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  run_migration > /dev/null

  teardown
}

# --- Test 11: No review directory — skips work unit ---
test_no_review_dir() {
  setup

  create_manifest "no-review" '{"name":"no-review","work_type":"feature","status":"in-progress","phases":{}}'

  run_migration > /dev/null

  teardown
}

# --- Test 12: review.md only, no qa-task files — just renames review.md ---
test_review_only() {
  setup

  create_manifest "review-only" '{"name":"review-only","work_type":"feature","status":"in-progress","phases":{}}'
  mkdir -p "$TEST_DIR/.workflows/review-only/review/review-only"
  echo "# Review" > "$TEST_DIR/.workflows/review-only/review/review-only/review.md"

  run_migration > /dev/null

  assert_eq "review.md renamed" "true" "$([ -f "$TEST_DIR/.workflows/review-only/review/review-only/report.md" ] && echo true || echo false)"
  assert_eq "old review.md gone" "false" "$([ -f "$TEST_DIR/.workflows/review-only/review/review-only/review.md" ] && echo true || echo false)"

  teardown
}

# --- Test 13: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state/review/topic"
  echo '{"name":".state"}' > "$TEST_DIR/.workflows/.state/manifest.json"
  echo "# Review" > "$TEST_DIR/.workflows/.state/review/topic/review.md"

  run_migration > /dev/null

  assert_eq "dot-dir review.md untouched" "true" "$([ -f "$TEST_DIR/.workflows/.state/review/topic/review.md" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 026 tests..."
echo ""

test_feature_rename
test_epic_multiple_topics
test_already_migrated
test_no_plan
test_count_mismatch
test_hyphenated_topic
test_abbreviated_prefix
test_changelog_dates
test_idempotent
test_no_workflows_dir
test_no_review_dir
test_review_only
test_skips_dot_dirs

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
