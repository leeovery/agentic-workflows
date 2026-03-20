#!/bin/bash
#
# Tests for migration 033: rename-inbox-to-dotinbox
#
# Run: bash tests/scripts/test-migration-033.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/033-rename-inbox-to-dotinbox.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-033-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Renames inbox/ to .inbox/ ---
test_simple_rename() {
  setup

  mkdir -p "$TEST_DIR/.workflows/inbox/ideas"
  mkdir -p "$TEST_DIR/.workflows/inbox/bugs"
  echo "# Smart Retry" > "$TEST_DIR/.workflows/inbox/ideas/2026-03-19--smart-retry.md"
  echo "# Login Bug" > "$TEST_DIR/.workflows/inbox/bugs/2026-03-18--login-timeout.md"

  source "$MIGRATION"

  assert_eq "old inbox removed" "false" "$([ -d "$TEST_DIR/.workflows/inbox" ] && echo true || echo false)"
  assert_eq ".inbox exists" "true" "$([ -d "$TEST_DIR/.workflows/.inbox" ] && echo true || echo false)"
  assert_eq "idea file moved" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/ideas/2026-03-19--smart-retry.md" ] && echo true || echo false)"
  assert_eq "bug file moved" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/bugs/2026-03-18--login-timeout.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Skips when no inbox/ exists ---
test_no_inbox() {
  setup

  source "$MIGRATION"

  assert_eq "no .inbox created" "false" "$([ -d "$TEST_DIR/.workflows/.inbox" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Skips when only .inbox/ exists (already migrated) ---
test_already_migrated() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.inbox/ideas"
  echo "# Existing" > "$TEST_DIR/.workflows/.inbox/ideas/2026-03-20--existing.md"

  source "$MIGRATION"

  assert_eq ".inbox still exists" "true" "$([ -d "$TEST_DIR/.workflows/.inbox" ] && echo true || echo false)"
  assert_eq "existing file intact" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/ideas/2026-03-20--existing.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Merges when both inbox/ and .inbox/ exist ---
test_merge() {
  setup

  mkdir -p "$TEST_DIR/.workflows/inbox/ideas"
  mkdir -p "$TEST_DIR/.workflows/.inbox/ideas"
  echo "# Old Idea" > "$TEST_DIR/.workflows/inbox/ideas/2026-03-18--old-idea.md"
  echo "# New Idea" > "$TEST_DIR/.workflows/.inbox/ideas/2026-03-19--new-idea.md"

  source "$MIGRATION"

  assert_eq "old inbox removed" "false" "$([ -d "$TEST_DIR/.workflows/inbox" ] && echo true || echo false)"
  assert_eq "old idea merged" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/ideas/2026-03-18--old-idea.md" ] && echo true || echo false)"
  assert_eq "new idea preserved" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/ideas/2026-03-19--new-idea.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Merge does not overwrite existing files in .inbox/ ---
test_merge_no_overwrite() {
  setup

  mkdir -p "$TEST_DIR/.workflows/inbox/ideas"
  mkdir -p "$TEST_DIR/.workflows/.inbox/ideas"
  echo "# Old Version" > "$TEST_DIR/.workflows/inbox/ideas/2026-03-18--same-name.md"
  echo "# New Version" > "$TEST_DIR/.workflows/.inbox/ideas/2026-03-18--same-name.md"

  source "$MIGRATION"

  local content
  content=$(cat "$TEST_DIR/.workflows/.inbox/ideas/2026-03-18--same-name.md")
  assert_eq "existing file not overwritten" "# New Version" "$content"

  teardown
}

# --- Test 6: Archived subdirectory is moved too ---
test_archived_moved() {
  setup

  mkdir -p "$TEST_DIR/.workflows/inbox/.archived/ideas"
  echo "# Archived" > "$TEST_DIR/.workflows/inbox/.archived/ideas/2026-03-17--archived-idea.md"

  source "$MIGRATION"

  assert_eq "archived dir moved" "true" "$([ -f "$TEST_DIR/.workflows/.inbox/.archived/ideas/2026-03-17--archived-idea.md" ] && echo true || echo false)"
  assert_eq "old inbox removed" "false" "$([ -d "$TEST_DIR/.workflows/inbox" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 033 tests..."
echo ""

test_simple_rename
test_no_inbox
test_already_migrated
test_merge
test_merge_no_overwrite
test_archived_moved

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
