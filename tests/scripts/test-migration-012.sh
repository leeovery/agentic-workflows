#!/bin/bash
# Tests for migration 012: environment-setup-to-state
# Run: bash tests/scripts/test-migration-012.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/012-environment-setup-to-state.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-012-test.XXXXXX)
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Move environment-setup.md to .state/ ---
test_move_to_state() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "environment content" > "$TEST_DIR/.workflows/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "file moved to .state/" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq "file removed from root" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq "content preserved" "environment content" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Test 2: Already in .state/ — no-op ---
test_already_in_state() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "already there" > "$TEST_DIR/.workflows/.state/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "file still in .state/" "true" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"
  assert_eq "content unchanged" "already there" "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")"

  teardown
}

# --- Test 3: No environment-setup.md — no-op ---
test_no_file() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "no file created at root" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"
  assert_eq "no file created in .state/" "false" "$([ -f "$TEST_DIR/.workflows/.state/environment-setup.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Idempotency — running twice ---
test_idempotency() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo "content" > "$TEST_DIR/.workflows/environment-setup.md"

  cd "$TEST_DIR"
  source "$MIGRATION"
  local first_content
  first_content=$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")

  source "$MIGRATION"
  local second_content
  second_content=$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")

  assert_eq "content same after second run" "$first_content" "$second_content"
  assert_eq "root file still gone" "false" "$([ -f "$TEST_DIR/.workflows/environment-setup.md" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 012 tests..."
echo ""

test_move_to_state
test_already_in_state
test_no_file
test_idempotency

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
