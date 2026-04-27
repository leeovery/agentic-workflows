#!/bin/bash
#
# Tests for migration 013: discussion-work-type
#
# Run: bash tests/scripts/test-migration-013.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/013-discussion-work-type.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-013-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows/discussion"
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

  cat > "$TEST_DIR/.workflows/discussion/auth-flow.md" <<'EOF'
---
topic: auth-flow
status: completed
---

# Auth Flow Discussion
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/discussion/auth-flow.md" && echo true || echo false)"
  assert_eq "status preserved" "true" "$(grep -q '^status: completed' "$TEST_DIR/.workflows/discussion/auth-flow.md" && echo true || echo false)"
  assert_eq "topic preserved" "true" "$(grep -q '^topic: auth-flow' "$TEST_DIR/.workflows/discussion/auth-flow.md" && echo true || echo false)"

  teardown
}

# --- Test 2: Skips when work_type already present ---
test_skips_existing() {
  setup

  cat > "$TEST_DIR/.workflows/discussion/billing.md" <<'EOF'
---
topic: billing
status: in-progress
work_type: greenfield
---

# Billing
EOF

  run

  local count
  count=$(grep -c '^work_type:' "$TEST_DIR/.workflows/discussion/billing.md")
  assert_eq "no duplicate work_type" "1" "$count"

  teardown
}

# --- Test 3: Skips files without frontmatter ---
test_skips_no_frontmatter() {
  setup

  cat > "$TEST_DIR/.workflows/discussion/plain.md" <<'EOF'
# Plain file without frontmatter
EOF

  run

  assert_eq "no work_type added" "false" "$(grep -q 'work_type' "$TEST_DIR/.workflows/discussion/plain.md" && echo true || echo false)"

  teardown
}

# --- Test 4: Skips when no discussion directory ---
test_no_discussion_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows/discussion"

  run

  assert_eq "no error" "true" "true"

  teardown
}

# --- Test 5: Adds work_type at end if no status field ---
test_no_status_field() {
  setup

  cat > "$TEST_DIR/.workflows/discussion/minimal.md" <<'EOF'
---
topic: minimal
---

# Minimal
EOF

  run

  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/discussion/minimal.md" && echo true || echo false)"

  teardown
}

# --- Test 6: Body content with --- preserved ---
test_body_preserved() {
  setup

  cat > "$TEST_DIR/.workflows/discussion/complex.md" <<'EOF'
---
topic: complex
status: completed
---

# Complex

Some content here.

---

More content after horizontal rule.
EOF

  run

  assert_eq "body preserved" "true" "$(grep -q 'More content after horizontal rule.' "$TEST_DIR/.workflows/discussion/complex.md" && echo true || echo false)"
  assert_eq "work_type added" "true" "$(grep -q '^work_type: greenfield' "$TEST_DIR/.workflows/discussion/complex.md" && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 013 tests..."
echo ""

test_adds_work_type
test_skips_existing
test_skips_no_frontmatter
test_no_discussion_dir
test_no_status_field
test_body_preserved

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
