#!/bin/bash
#
# Tests for migration 014: specification-work-type
#
# Run: bash tests/scripts/test-migration-014.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/014-specification-work-type.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-014-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows/specification/auth-flow"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run() {
  cd "$TEST_DIR"
  source "$MIGRATION"
}

# --- Test 1: Adds work_type after type ---
test_adds_work_type() {
  setup

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" <<'EOF'
---
topic: auth-flow
type: feature
status: completed
---

# Auth Flow Specification
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/specification/auth-flow/specification.md" && echo true || echo false)"
  assert_eq "type preserved" "true" "$(grep -q '^type: feature' "$TEST_DIR/.workflows/specification/auth-flow/specification.md" && echo true || echo false)"

  teardown
}

# --- Test 2: Skips when work_type already present ---
test_skips_existing() {
  setup

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" <<'EOF'
---
topic: auth-flow
type: feature
work_type: greenfield
status: completed
---

# Auth Flow
EOF

  run

  local count
  count=$(grep -c '^work_type:' "$TEST_DIR/.workflows/specification/auth-flow/specification.md")
  assert_eq "no duplicate work_type" "1" "$count"

  teardown
}

# --- Test 3: Skips files without frontmatter ---
test_skips_no_frontmatter() {
  setup

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" <<'EOF'
# Plain file without frontmatter
EOF

  run

  assert_eq "no work_type added" "false" "$(grep -q 'work_type' "$TEST_DIR/.workflows/specification/auth-flow/specification.md" && echo true || echo false)"

  teardown
}

# --- Test 4: Skips when no specification directory ---
test_no_spec_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows/specification"

  run

  assert_eq "no error" "true" "true"

  teardown
}

# --- Test 5: Adds work_type at end if no type field ---
test_no_type_field() {
  setup

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" <<'EOF'
---
topic: auth-flow
status: completed
---

# Auth Flow
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/specification/auth-flow/specification.md" && echo true || echo false)"

  teardown
}

# --- Test 6: Multiple specs processed ---
test_multiple_specs() {
  setup
  mkdir -p "$TEST_DIR/.workflows/specification/billing"

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" <<'EOF'
---
topic: auth-flow
type: feature
status: completed
---

# Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/specification/billing/specification.md" <<'EOF'
---
topic: billing
type: feature
status: in-progress
---

# Billing
EOF

  run

  assert_eq "auth-flow has work_type" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/specification/auth-flow/specification.md" && echo true || echo false)"
  assert_eq "billing has work_type" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/specification/billing/specification.md" && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 014 tests..."
echo ""

test_adds_work_type
test_skips_existing
test_skips_no_frontmatter
test_no_spec_dir
test_no_type_field
test_multiple_specs

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
