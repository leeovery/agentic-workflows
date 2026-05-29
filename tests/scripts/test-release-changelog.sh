#!/bin/bash
# Tests for the changelog integration: the release script's update_changelog
# and compose_tag_message helpers.
# Run: bash tests/scripts/test-release-changelog.sh

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RELEASE_SCRIPT="$REPO_DIR/release"

PASS=0
FAIL=0

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

file_contains() {
  local pattern="$1" file="$2"
  local content
  content=$(cat "$file" 2>/dev/null || true)
  case "$content" in
    *"$pattern"*) echo true ;;
    *) echo false ;;
  esac
}

# Line number of the first occurrence of a literal pattern in a file.
line_of() {
  local pattern="$1" file="$2"
  awk -v p="$pattern" 'index($0, p) { print NR; exit }' "$file"
}

setup() {
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/release-changelog-test.XXXXXX")
  RELEASE_FUNCS="$TEST_DIR/release-funcs.sh"
  # Strip the main invocation so sourcing defines functions without running.
  grep -v '^main "\$@"$' "$RELEASE_SCRIPT" > "$RELEASE_FUNCS"
}

teardown() {
  cd "$REPO_DIR"
  rm -rf "$TEST_DIR"
}

# --- Test 1: update_changelog creates the file with a header when missing ---
test_update_creates_file() {
  setup
  (
    cd "$TEST_DIR"
    source "$RELEASE_FUNCS"
    update_changelog "1.0.0" "- First thing"
  )
  assert_eq "creates CHANGELOG.md" "true" "$([ -f "$TEST_DIR/CHANGELOG.md" ] && echo true || echo false)"
  assert_eq "has Keep a Changelog header" "true" "$(file_contains 'Keep a Changelog' "$TEST_DIR/CHANGELOG.md")"
  assert_eq "has the version heading" "true" "$(file_contains '## [1.0.0] - ' "$TEST_DIR/CHANGELOG.md")"
  assert_eq "has the body bullet" "true" "$(file_contains '- First thing' "$TEST_DIR/CHANGELOG.md")"
  teardown
}

# --- Test 2: a second entry is prepended above the first ---
test_update_prepends() {
  setup
  (
    cd "$TEST_DIR"
    source "$RELEASE_FUNCS"
    update_changelog "1.0.0" "- Old release"
    update_changelog "1.1.0" "- New release"
  )
  local cl="$TEST_DIR/CHANGELOG.md"
  local new_line old_line
  new_line=$(line_of '## [1.1.0]' "$cl")
  old_line=$(line_of '## [1.0.0]' "$cl")
  assert_eq "newer entry appears before older" "true" \
    "$([ -n "$new_line" ] && [ -n "$old_line" ] && [ "$new_line" -lt "$old_line" ] && echo true || echo false)"
  # Header must remain at the very top, above both entries.
  local header_line
  header_line=$(line_of '# Changelog' "$cl")
  assert_eq "header stays above entries" "true" \
    "$([ "$header_line" -lt "$new_line" ] && echo true || echo false)"
  teardown
}

# --- Test 3: empty body falls back to the maintenance placeholder ---
test_update_empty_body_placeholder() {
  setup
  (
    cd "$TEST_DIR"
    source "$RELEASE_FUNCS"
    update_changelog "1.0.0" ""
  )
  assert_eq "placeholder used for empty body" "true" \
    "$(file_contains 'Maintenance release (no notes recorded).' "$TEST_DIR/CHANGELOG.md")"
  teardown
}

# --- Test 4: compose_tag_message with and without a body ---
test_compose_tag_message() {
  setup
  local with without
  with=$(cd "$TEST_DIR"; source "$RELEASE_FUNCS"; compose_tag_message "2.0.0" "- A change")
  without=$(cd "$TEST_DIR"; source "$RELEASE_FUNCS"; compose_tag_message "2.0.0" "")

  assert_eq "with-body has the release subject" "true" \
    "$(echo "$with" | grep -qF '🔖 Release v2.0.0' && echo true || echo false)"
  assert_eq "with-body includes the bullet" "true" \
    "$(echo "$with" | grep -qF -- '- A change' && echo true || echo false)"
  assert_eq "no-body is just the subject line" "🔖 Release v2.0.0" "$without"
  teardown
}

echo "Running release-changelog tests..."
echo ""

test_update_creates_file
test_update_prepends
test_update_empty_body_placeholder
test_compose_tag_message

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
