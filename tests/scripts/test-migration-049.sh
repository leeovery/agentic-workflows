#!/bin/bash
#
# Tests for migration 049: nested-workflows-gitignore
#
# Run: bash tests/scripts/test-migration-049.sh
#
set -euo pipefail

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/049-nested-workflows-gitignore.sh"

report_update() { :; }
report_skip() { :; }

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
  TEST_DIR=$(mktemp -d /tmp/migration-049-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
  unset PROJECT_DIR
}

# --- Test 1: Happy path — nested rules created, root rule removed, other root lines kept ---
test_happy_path() {
  setup
  printf 'node_modules/\n.workflows/.cache/\n.env\n' > "$TEST_DIR/.gitignore"
  source "$MIGRATION"
  local nested; nested=$(cat "$TEST_DIR/.workflows/.gitignore")
  assert_eq "nested gitignore created" "true" "$([ -f "$TEST_DIR/.workflows/.gitignore" ] && echo true || echo false)"
  assert_eq "nested carries cache rule" "true" "$(echo "$nested" | grep -qxF '.cache/' && echo true || echo false)"
  assert_eq "nested carries tmp rule" "true" "$(echo "$nested" | grep -qxF '.manifest.json.*.tmp' && echo true || echo false)"
  local root; root=$(cat "$TEST_DIR/.gitignore")
  assert_eq "root rule removed" "false" "$(echo "$root" | grep -qxF '.workflows/.cache/' && echo true || echo false)"
  assert_eq "other root lines preserved" "$(printf 'node_modules/\n.env')" "$root"
  teardown
}

# --- Test 2: Root .gitignore holding only the rule is deleted ---
test_root_deleted_when_only_rule() {
  setup
  printf '.workflows/.cache/\n' > "$TEST_DIR/.gitignore"
  source "$MIGRATION"
  assert_eq "root gitignore deleted" "false" "$([ -f "$TEST_DIR/.gitignore" ] && echo true || echo false)"
  assert_eq "nested gitignore created" "true" "$([ -f "$TEST_DIR/.workflows/.gitignore" ] && echo true || echo false)"
  teardown
}

# --- Test 3: Skip — no root .gitignore; nested still created, no root file conjured ---
test_no_root_gitignore() {
  setup
  source "$MIGRATION"
  assert_eq "no root gitignore conjured" "false" "$([ -f "$TEST_DIR/.gitignore" ] && echo true || echo false)"
  local nested; nested=$(cat "$TEST_DIR/.workflows/.gitignore")
  assert_eq "nested carries cache rule" "true" "$(echo "$nested" | grep -qxF '.cache/' && echo true || echo false)"
  assert_eq "nested carries tmp rule" "true" "$(echo "$nested" | grep -qxF '.manifest.json.*.tmp' && echo true || echo false)"
  teardown
}

# --- Test 4: Existing nested .gitignore — rules appended, user content preserved, no newline mangling ---
test_existing_nested_preserved() {
  setup
  printf 'my-scratch/\n' > "$TEST_DIR/.workflows/.gitignore"
  source "$MIGRATION"
  local nested; nested=$(cat "$TEST_DIR/.workflows/.gitignore")
  assert_eq "user rule preserved" "true" "$(echo "$nested" | grep -qxF 'my-scratch/' && echo true || echo false)"
  assert_eq "cache rule appended" "true" "$(echo "$nested" | grep -qxF '.cache/' && echo true || echo false)"
  assert_eq "tmp rule appended" "true" "$(echo "$nested" | grep -qxF '.manifest.json.*.tmp' && echo true || echo false)"
  assert_eq "exact content" "$(printf 'my-scratch/\n.cache/\n.manifest.json.*.tmp')" "$nested"
  teardown
}

# --- Test 5: Idempotency — second run changes nothing, no duplicate rules ---
test_idempotent() {
  setup
  printf 'node_modules/\n.workflows/.cache/\n' > "$TEST_DIR/.gitignore"
  source "$MIGRATION"
  local nested_first; nested_first=$(cat "$TEST_DIR/.workflows/.gitignore")
  local root_first; root_first=$(cat "$TEST_DIR/.gitignore")
  source "$MIGRATION"
  assert_eq "nested identical after second run" "$nested_first" "$(cat "$TEST_DIR/.workflows/.gitignore")"
  assert_eq "root identical after second run" "$root_first" "$(cat "$TEST_DIR/.gitignore")"
  assert_eq "cache rule appears once" "1" "$(grep -cxF '.cache/' "$TEST_DIR/.workflows/.gitignore")"
  assert_eq "tmp rule appears once" "1" "$(grep -cxF '.manifest.json.*.tmp' "$TEST_DIR/.workflows/.gitignore")"
  teardown
}

# --- Test 6: Missing .workflows/ — directory and nested gitignore created ---
test_creates_workflows_dir() {
  setup
  rmdir "$TEST_DIR/.workflows"
  source "$MIGRATION"
  assert_eq "workflows dir created" "true" "$([ -d "$TEST_DIR/.workflows" ] && echo true || echo false)"
  assert_eq "nested gitignore created" "true" "$([ -f "$TEST_DIR/.workflows/.gitignore" ] && echo true || echo false)"
  teardown
}

# --- Test 7: Root file without newline terminator — removal still exact-line ---
test_root_no_trailing_newline() {
  setup
  printf 'node_modules/\n.workflows/.cache/' > "$TEST_DIR/.gitignore"
  source "$MIGRATION"
  local root; root=$(cat "$TEST_DIR/.gitignore")
  assert_eq "root rule removed" "false" "$(echo "$root" | grep -qxF '.workflows/.cache/' && echo true || echo false)"
  assert_eq "other root line preserved" "node_modules/" "$root"
  teardown
}

test_happy_path
test_root_deleted_when_only_rule
test_no_root_gitignore
test_existing_nested_preserved
test_idempotent
test_creates_workflows_dir
test_root_no_trailing_newline

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
