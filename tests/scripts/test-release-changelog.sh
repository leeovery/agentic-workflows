#!/bin/bash
# Tests for the changelog integration: the release script's update_changelog
# and compose_tag_message helpers, plus the backfill-changelog.sh generator.
# Run: bash tests/scripts/test-release-changelog.sh

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RELEASE_SCRIPT="$REPO_DIR/release"
BACKFILL_SCRIPT="$REPO_DIR/scripts/backfill-changelog.sh"

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

# --- Test 5: backfill generates newest-first from tags, honouring overrides ---
test_backfill_from_tags() {
  setup
  local repo="$TEST_DIR/repo"
  mkdir -p "$repo/changelog.d"
  cd "$repo"
  git init -q
  git config user.email "t@example.com"; git config user.name "T"
  git config commit.gpgsign false

  echo a > f; git add .; git commit -q -m c1
  git tag -a v0.1.0 -m "$(printf '🔖 Release v0.1.0\n\n- Older feature')"
  echo b > f; git commit -q -am c2
  # Empty-body tag (no notes) — should pick up the override below.
  git tag -a v0.2.0 -m "🔖 Release v0.2.0"
  echo c > f; git commit -q -am c3
  git tag -a v0.3.0 -m "$(printf '🔖 Release v0.3.0\n\n- Newest feature')"

  # Override for the noteless v0.2.0.
  printf -- '- Recovered note for 0.2.0\n' > changelog.d/0.2.0.md

  bash "$BACKFILL_SCRIPT" >/dev/null
  local cl="$repo/CHANGELOG.md"

  assert_eq "backfill wrote CHANGELOG.md" "true" "$([ -f "$cl" ] && echo true || echo false)"
  # Ordering: 0.3.0 before 0.2.0 before 0.1.0
  local l3 l2 l1
  l3=$(line_of '## [0.3.0]' "$cl"); l2=$(line_of '## [0.2.0]' "$cl"); l1=$(line_of '## [0.1.0]' "$cl")
  assert_eq "newest-first ordering" "true" \
    "$([ "$l3" -lt "$l2" ] && [ "$l2" -lt "$l1" ] && echo true || echo false)"
  assert_eq "tag bodies harvested" "true" "$(file_contains '- Newest feature' "$cl")"
  assert_eq "override wins over empty tag body" "true" "$(file_contains '- Recovered note for 0.2.0' "$cl")"
  assert_eq "no placeholder when override present" "false" "$(file_contains 'Maintenance release' "$cl")"
  teardown
}

# --- Test 6: backfill is idempotent (re-running reproduces the file) ---
test_backfill_idempotent() {
  setup
  local repo="$TEST_DIR/repo"
  mkdir -p "$repo"
  cd "$repo"
  git init -q
  git config user.email "t@example.com"; git config user.name "T"
  git config commit.gpgsign false
  echo a > f; git add .; git commit -q -m c1
  git tag -a v0.1.0 -m "$(printf '🔖 Release v0.1.0\n\n- A feature')"

  bash "$BACKFILL_SCRIPT" >/dev/null
  local first; first=$(cat "$repo/CHANGELOG.md")
  bash "$BACKFILL_SCRIPT" >/dev/null
  local second; second=$(cat "$repo/CHANGELOG.md")

  assert_eq "re-running produces identical output" "true" \
    "$([ "$first" = "$second" ] && echo true || echo false)"
  teardown
}

echo "Running release-changelog tests..."
echo ""

test_update_creates_file
test_update_prepends
test_update_empty_body_placeholder
test_compose_tag_message
test_backfill_from_tags
test_backfill_idempotent

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
