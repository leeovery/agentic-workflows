#!/bin/bash
# Tests for migration 008: review-directory-structure
# Run: bash tests/scripts/test-migration-008.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/008-review-directory-structure.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-008-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/review"
  REVIEW_DIR="$TEST_DIR/docs/workflow/review"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Simple review — summary + QA files moved to r1/ ---
test_simple_review() {
  setup

  cat > "$REVIEW_DIR/tick-core.md" << 'EOF'
# Review: Tick Core

Summary of the review.
EOF

  mkdir -p "$REVIEW_DIR/tick-core"
  cat > "$REVIEW_DIR/tick-core/qa-task-1.md" << 'EOF'
# QA Task 1
Findings.
EOF
  cat > "$REVIEW_DIR/tick-core/qa-task-2.md" << 'EOF'
# QA Task 2
More findings.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "r1/ directory created" "true" "$([ -d "$REVIEW_DIR/tick-core/r1" ] && echo true || echo false)"
  assert_eq "Summary moved to r1/review.md" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/review.md" ] && echo true || echo false)"
  assert_eq "QA task 1 moved to r1/" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "QA task 2 moved to r1/" "true" "$([ -f "$REVIEW_DIR/tick-core/r1/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "Original summary removed" "false" "$([ -f "$REVIEW_DIR/tick-core.md" ] && echo true || echo false)"

  content=$(cat "$REVIEW_DIR/tick-core/r1/review.md")
  assert_eq "Summary content preserved" "true" "$(echo "$content" | grep -qF 'Summary of the review' && echo true || echo false)"

  teardown
}

# --- Test 2: Review with product-assessment.md ---
test_product_assessment() {
  setup

  cat > "$REVIEW_DIR/installation.md" << 'EOF'
# Review: Installation
Summary.
EOF

  mkdir -p "$REVIEW_DIR/installation"
  cat > "$REVIEW_DIR/installation/qa-task-1.md" << 'EOF'
# QA 1
EOF
  cat > "$REVIEW_DIR/installation/product-assessment.md" << 'EOF'
# Product Assessment
Assessment content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Summary moved" "true" "$([ -f "$REVIEW_DIR/installation/r1/review.md" ] && echo true || echo false)"
  assert_eq "QA task moved" "true" "$([ -f "$REVIEW_DIR/installation/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "Product assessment moved to r1/" "true" "$([ -f "$REVIEW_DIR/installation/r1/product-assessment.md" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Multi-plan review — per-plan QA subdirectories moved ---
test_multi_plan_review() {
  setup

  cat > "$REVIEW_DIR/doctor-installation-migration.md" << 'EOF'
# Review: Doctor + Installation + Migration
Multi-plan summary.
EOF

  mkdir -p "$REVIEW_DIR/doctor-installation-migration"
  cat > "$REVIEW_DIR/doctor-installation-migration/product-assessment.md" << 'EOF'
# Product Assessment
EOF

  mkdir -p "$REVIEW_DIR/doctor-installation-migration/installation"
  cat > "$REVIEW_DIR/doctor-installation-migration/installation/qa-task-1.md" << 'EOF'
# Installation QA 1
EOF
  cat > "$REVIEW_DIR/doctor-installation-migration/installation/qa-task-2.md" << 'EOF'
# Installation QA 2
EOF

  mkdir -p "$REVIEW_DIR/doctor-installation-migration/migration"
  cat > "$REVIEW_DIR/doctor-installation-migration/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Summary moved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/review.md" ] && echo true || echo false)"
  assert_eq "Product assessment moved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/product-assessment.md" ] && echo true || echo false)"
  assert_eq "Per-plan subdir moved to r1/" "true" "$([ -d "$REVIEW_DIR/doctor-installation-migration/r1/installation" ] && echo true || echo false)"
  assert_eq "Subdir QA file preserved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "Subdir QA file 2 preserved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "Second per-plan subdir moved" "true" "$([ -d "$REVIEW_DIR/doctor-installation-migration/r1/migration" ] && echo true || echo false)"
  assert_eq "Second subdir QA preserved" "true" "$([ -f "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Summary file without matching directory ---
test_standalone_summary() {
  setup

  cat > "$REVIEW_DIR/standalone.md" << 'EOF'
# Review: Standalone
Just a summary, no QA directory.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "r1/ created even without pre-existing dir" "true" "$([ -d "$REVIEW_DIR/standalone/r1" ] && echo true || echo false)"
  assert_eq "Summary moved to r1/review.md" "true" "$([ -f "$REVIEW_DIR/standalone/r1/review.md" ] && echo true || echo false)"
  assert_eq "Original summary removed" "false" "$([ -f "$REVIEW_DIR/standalone.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: r1/ already exists — idempotent skip ---
test_already_migrated() {
  setup

  mkdir -p "$REVIEW_DIR/done/r1"
  cat > "$REVIEW_DIR/done/r1/review.md" << 'EOF'
# Review: Done
Already migrated.
EOF

  cat > "$REVIEW_DIR/done.md" << 'EOF'
# Stale summary
EOF

  original_r1=$(cat "$REVIEW_DIR/done/r1/review.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_r1=$(cat "$REVIEW_DIR/done/r1/review.md")

  assert_eq "Existing r1/ content unchanged" "$original_r1" "$new_r1"

  teardown
}

# --- Test 6: No review directory — early return ---
test_no_review_dir() {
  setup
  rm -rf "$TEST_DIR/docs/workflow/review"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "No error when review directory missing" "true" "true"

  teardown
}

# --- Test 7: Idempotency — running migration twice ---
test_idempotency() {
  setup

  cat > "$REVIEW_DIR/idem.md" << 'EOF'
# Review: Idempotent Test
Summary content.
EOF

  mkdir -p "$REVIEW_DIR/idem"
  cat > "$REVIEW_DIR/idem/qa-task-1.md" << 'EOF'
# QA 1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  first_content=$(cat "$REVIEW_DIR/idem/r1/review.md")

  cd "$TEST_DIR"
  source "$MIGRATION"
  second_content=$(cat "$REVIEW_DIR/idem/r1/review.md")

  assert_eq "Second run produces same result" "$first_content" "$second_content"

  teardown
}

# --- Test 8: Many QA files moved correctly ---
test_many_qa_files() {
  setup

  cat > "$REVIEW_DIR/big-review.md" << 'EOF'
# Review: Big Review
Many tasks.
EOF

  mkdir -p "$REVIEW_DIR/big-review"
  for i in $(seq 1 20); do
    cat > "$REVIEW_DIR/big-review/qa-task-${i}.md" << EOF
# QA Task $i
Finding $i.
EOF
  done

  cd "$TEST_DIR"
  source "$MIGRATION"

  for i in $(seq 1 20); do
    assert_eq "QA task $i moved to r1/" "true" "$([ -f "$REVIEW_DIR/big-review/r1/qa-task-${i}.md" ] && echo true || echo false)"
  done

  content=$(cat "$REVIEW_DIR/big-review/r1/qa-task-15.md")
  assert_eq "QA task 15 content preserved" "true" "$(echo "$content" | grep -qF 'Finding 15' && echo true || echo false)"

  teardown
}

# --- Test 9: Content preservation — complex review file ---
test_complex_content_preserved() {
  setup

  cat > "$REVIEW_DIR/complex.md" << 'TESTEOF'
# Review: Complex

## Summary

The implementation covers **all 38 tasks** across 8 phases.

| Phase | Tasks | Status |
|-------|-------|--------|
| 1     | 7     | done   |
| 2     | 3     | done   |

---

## Findings

```bash
tick create "test task" --priority 1
```

- Finding with `backticks` and "quotes"
- Finding with special chars: @#$%
TESTEOF

  mkdir -p "$REVIEW_DIR/complex"
  original=$(cat "$REVIEW_DIR/complex.md")

  cd "$TEST_DIR"
  source "$MIGRATION"
  moved=$(cat "$REVIEW_DIR/complex/r1/review.md")

  assert_eq "Complex content exactly preserved" "$original" "$moved"

  teardown
}

# --- Test 10: Multiple reviews processed in one run ---
test_multiple_reviews() {
  setup

  cat > "$REVIEW_DIR/review-a.md" << 'EOF'
# Review A
EOF
  mkdir -p "$REVIEW_DIR/review-a"
  cat > "$REVIEW_DIR/review-a/qa-task-1.md" << 'EOF'
# QA A-1
EOF

  cat > "$REVIEW_DIR/review-b.md" << 'EOF'
# Review B
EOF
  mkdir -p "$REVIEW_DIR/review-b"
  cat > "$REVIEW_DIR/review-b/qa-task-1.md" << 'EOF'
# QA B-1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Review A migrated" "true" "$([ -f "$REVIEW_DIR/review-a/r1/review.md" ] && echo true || echo false)"
  assert_eq "Review A QA moved" "true" "$([ -f "$REVIEW_DIR/review-a/r1/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "Review B migrated" "true" "$([ -f "$REVIEW_DIR/review-b/r1/review.md" ] && echo true || echo false)"
  assert_eq "Review B QA moved" "true" "$([ -f "$REVIEW_DIR/review-b/r1/qa-task-1.md" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 008 tests..."
echo ""

test_simple_review
test_product_assessment
test_multi_plan_review
test_standalone_summary
test_already_migrated
test_no_review_dir
test_idempotency
test_many_qa_files
test_complex_content_preserved
test_multiple_reviews

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
