#!/bin/bash
# Tests for migration 009: review-per-plan-storage
# Run: bash tests/scripts/test-migration-009.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/009-review-per-plan-storage.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-009-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/review"
  REVIEW_DIR="$TEST_DIR/docs/workflow/review"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Product assessment files deleted ---
test_product_assessment_deleted() {
  setup

  mkdir -p "$REVIEW_DIR/tick-core/r1"
  cat > "$REVIEW_DIR/tick-core/r1/review.md" << 'EOF'
# Review
EOF
  cat > "$REVIEW_DIR/tick-core/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: tick-core
ROBUSTNESS: Good
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "product assessment deleted" "false" "$([ -f "$REVIEW_DIR/tick-core/r1/product-assessment.md" ] && echo true || echo false)"
  assert_eq "review.md preserved" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/review.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Multiple product assessments all deleted ---
test_multiple_product_assessments() {
  setup

  mkdir -p "$REVIEW_DIR/plan-a/r1"
  cat > "$REVIEW_DIR/plan-a/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: plan-a
EOF

  mkdir -p "$REVIEW_DIR/plan-b/r1"
  cat > "$REVIEW_DIR/plan-b/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: plan-b
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "plan-a PA deleted" "false" "$([ -f "$REVIEW_DIR/plan-a/r1/product-assessment.md" ] && echo true || echo false)"
  assert_eq "plan-b PA deleted" "false" "$([ -f "$REVIEW_DIR/plan-b/r1/product-assessment.md" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Multi-plan QA subdirs moved to per-plan dirs ---
test_multi_plan_qa_moved() {
  setup

  mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/installation"
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/review.md" << 'EOF'
# Aggregate Review
EOF
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" << 'EOF'
# QA 1
EOF
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-2.md" << 'EOF'
# QA 2
EOF

  mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/migration"
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "installation QA 1 moved to per-plan dir" "true" "$([ -f "$REVIEW_DIR/installation/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "installation QA 2 moved to per-plan dir" "true" "$([ -f "$REVIEW_DIR/installation/r1/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "migration QA 1 moved to per-plan dir" "true" "$([ -f "$REVIEW_DIR/migration/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "source QA removed" "false" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "aggregate review.md preserved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/review.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Orphaned QA files at topic root moved into r1/ ---
test_orphaned_qa_moved() {
  setup

  mkdir -p "$REVIEW_DIR/doctor-validation"
  cat > "$REVIEW_DIR/doctor-validation/qa-task-1.md" << 'EOF'
# QA 1
EOF
  cat > "$REVIEW_DIR/doctor-validation/qa-task-2.md" << 'EOF'
# QA 2
EOF
  cat > "$REVIEW_DIR/doctor-validation/qa-task-3.md" << 'EOF'
# QA 3
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "r1/ created" "true" "$([ -d "$REVIEW_DIR/doctor-validation/r1" ] && echo true || echo false)"
  assert_eq "QA 1 moved to r1/" "true" "$([ -f "$REVIEW_DIR/doctor-validation/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "QA 2 moved to r1/" "true" "$([ -f "$REVIEW_DIR/doctor-validation/r1/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "QA 3 moved to r1/" "true" "$([ -f "$REVIEW_DIR/doctor-validation/r1/qa-task-3.md" ] && echo true || echo false)"
  assert_eq "original QA removed" "false" "$([ -f "$REVIEW_DIR/doctor-validation/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Skip if r1/ already exists ---
test_skip_existing_r1() {
  setup

  mkdir -p "$REVIEW_DIR/already-done/r1"
  cat > "$REVIEW_DIR/already-done/r1/qa-task-1.md" << 'EOF'
# Already in r1
EOF

  cat > "$REVIEW_DIR/already-done/qa-task-99.md" << 'EOF'
# Stale
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  local content
  content=$(cat "$REVIEW_DIR/already-done/r1/qa-task-1.md")
  assert_eq "existing r1/ content unchanged" "# Already in r1" "$content"
  assert_eq "stale file untouched when r1/ exists" "true" "$([ -f "$REVIEW_DIR/already-done/qa-task-99.md" ] && echo true || echo false)"

  teardown
}

# --- Test 6: No review directory — early return ---
test_no_review_dir() {
  setup
  rm -rf "$TEST_DIR/docs"
  mkdir -p "$TEST_DIR/docs/workflow"

  cd "$TEST_DIR"
  source "$MIGRATION"

  # If we get here without error, migration handled missing dir gracefully
  assert_eq "no error when review directory missing" "true" "true"

  teardown
}

# --- Test 7: Idempotency — running migration twice ---
test_idempotency() {
  setup

  mkdir -p "$REVIEW_DIR/idem"
  cat > "$REVIEW_DIR/idem/qa-task-1.md" << 'EOF'
# QA 1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  local first_content
  first_content=$(cat "$REVIEW_DIR/idem/r1/qa-task-1.md")

  source "$MIGRATION"
  local second_content
  second_content=$(cat "$REVIEW_DIR/idem/r1/qa-task-1.md")

  assert_eq "second run produces same result" "$first_content" "$second_content"

  teardown
}

# --- Test 8: All three phases together ---
test_all_phases() {
  setup

  # Multi-plan review with aggregate + per-plan subdirs
  mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/installation"
  mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/migration"
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/review.md" << 'EOF'
# Aggregate
EOF
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" << 'EOF'
# Install QA 1
EOF
  cat > "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

  # Single-plan review (already correct structure)
  mkdir -p "$REVIEW_DIR/tick-core/r1"
  cat > "$REVIEW_DIR/tick-core/r1/review.md" << 'EOF'
# Tick Core Review
EOF
  cat > "$REVIEW_DIR/tick-core/r1/qa-task-1.md" << 'EOF'
# TC QA 1
EOF

  # Orphaned per-plan dirs
  mkdir -p "$REVIEW_DIR/doctor-validation"
  cat > "$REVIEW_DIR/doctor-validation/qa-task-1.md" << 'EOF'
# DV QA 1
EOF
  cat > "$REVIEW_DIR/doctor-validation/qa-task-2.md" << 'EOF'
# DV QA 2
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  # Phase 2: multi-plan QA moved to per-plan
  assert_eq "installation QA moved" "true" "$([ -f "$REVIEW_DIR/installation/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "migration QA moved" "true" "$([ -f "$REVIEW_DIR/migration/r1/qa-task-1.md" ] && echo true || echo false)"

  # Phase 3: orphaned QA moved into r1/
  assert_eq "orphaned DV QA 1 moved to r1/" "true" "$([ -f "$REVIEW_DIR/doctor-validation/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "orphaned DV QA 2 moved to r1/" "true" "$([ -f "$REVIEW_DIR/doctor-validation/r1/qa-task-2.md" ] && echo true || echo false)"

  # Already-correct single-plan review untouched
  assert_eq "tick-core review.md preserved" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/review.md" ] && echo true || echo false)"
  assert_eq "tick-core QA preserved" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 009 tests..."
echo ""

test_product_assessment_deleted
test_multiple_product_assessments
test_multi_plan_qa_moved
test_orphaned_qa_moved
test_skip_existing_r1
test_no_review_dir
test_idempotency
test_all_phases

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
