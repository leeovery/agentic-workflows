#!/bin/bash
#
# Tests for migration 015: plan-work-type
#
# Run: bash tests/scripts/test-migration-015.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/015-plan-work-type.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-015-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows/planning/auth-flow"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run() {
  cd "$TEST_DIR"
  source "$MIGRATION"
}

# --- Test 1: Adds work_type after status ---
test_adds_work_type() {
  setup

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" <<'EOF'
---
topic: auth-flow
status: completed
---

# Auth Flow Plan
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/planning/auth-flow/plan.md" && echo true || echo false)"
  assert_eq "status preserved" "true" "$(grep -q '^status: completed' "$TEST_DIR/.workflows/planning/auth-flow/plan.md" && echo true || echo false)"

  teardown
}

# --- Test 2: Skips when work_type already present ---
test_skips_existing() {
  setup

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" <<'EOF'
---
topic: auth-flow
status: completed
work_type: greenfield
---

# Auth Flow
EOF

  run

  local count
  count=$(grep -c '^work_type:' "$TEST_DIR/.workflows/planning/auth-flow/plan.md")
  assert_eq "no duplicate work_type" "1" "$count"

  teardown
}

# --- Test 3: Skips files without frontmatter ---
test_skips_no_frontmatter() {
  setup

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" <<'EOF'
# Plain file without frontmatter
EOF

  run

  assert_eq "no work_type added" "false" "$(grep -q 'work_type' "$TEST_DIR/.workflows/planning/auth-flow/plan.md" && echo true || echo false)"

  teardown
}

# --- Test 4: Skips when no planning directory ---
test_no_plan_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows/planning"

  run

  assert_eq "no error" "true" "true"

  teardown
}

# --- Test 5: Adds work_type at end if no status field ---
test_no_status_field() {
  setup

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" <<'EOF'
---
topic: auth-flow
---

# Auth Flow
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/planning/auth-flow/plan.md" && echo true || echo false)"

  teardown
}

# --- Test 6: Multiple plans processed ---
test_multiple_plans() {
  setup
  mkdir -p "$TEST_DIR/.workflows/planning/billing"

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" <<'EOF'
---
topic: auth-flow
status: completed
---

# Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/planning/billing/plan.md" <<'EOF'
---
topic: billing
status: in-progress
---

# Billing
EOF

  run

  assert_eq "auth-flow has work_type" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/planning/auth-flow/plan.md" && echo true || echo false)"
  assert_eq "billing has work_type" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/planning/billing/plan.md" && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 015 tests..."
echo ""

test_adds_work_type
test_skips_existing
test_skips_no_frontmatter
test_no_plan_dir
test_no_status_field
test_multiple_plans

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
