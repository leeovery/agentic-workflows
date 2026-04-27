#!/bin/bash
# Tests for migration 018: remove-stale-environment-setup
# Run: bash tests/scripts/test-migration-018.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/018-remove-stale-environment-setup.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-018-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Both exist — removes stale root copy, keeps .state/ ---
test_both_exist() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "stale content" > "$TEST_DIR/.workflows/environment-setup.md"
  echo "real content" > "$TEST_DIR/.workflows/.state/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Stale root file removed" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq ".state/ copy preserved" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq ".state/ content unchanged" "real content" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Test 2: Only root exists — moves to .state/ ---
test_only_root() {
  setup

  echo "needs moving" > "$TEST_DIR/.workflows/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Root file removed" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq "File moved to .state/" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq "Content preserved" "needs moving" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Test 3: Only .state/ exists — no-op ---
test_only_state() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "already correct" > "$TEST_DIR/.workflows/.state/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq ".state/ copy still exists" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq "No root file created" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq "Content unchanged" "already correct" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Test 4: Neither exists — no-op ---
test_neither_exists() {
  setup

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "No root file created" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq "No .state/ file created" "false" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Idempotency — running twice with both files ---
test_idempotency() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "stale" > "$TEST_DIR/.workflows/environment-setup.md"
  echo "canonical" > "$TEST_DIR/.workflows/.state/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"
  source "$MIGRATION"

  assert_eq "Root file still gone after second run" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq ".state/ copy still exists" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq "Content unchanged after second run" "canonical" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Run all tests ---
echo "Running migration 018 tests..."
echo ""

test_both_exist
test_only_root
test_only_state
test_neither_exists
test_idempotency

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
