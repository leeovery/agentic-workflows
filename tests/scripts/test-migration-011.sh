#!/bin/bash
# Tests for migration 011: rename-workflow-directory
# Run: bash tests/scripts/test-migration-011.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/011-rename-workflow-directory.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-011-test.XXXXXX)
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Full migration — docs/workflow/ to .workflows/ ---
test_full_migration() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  mkdir -p "$TEST_DIR/docs/workflow/specification/auth"
  mkdir -p "$TEST_DIR/docs/workflow/.state"
  mkdir -p "$TEST_DIR/docs/workflow/.cache/sessions"
  echo "discussion content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
  echo "spec content" > "$TEST_DIR/docs/workflow/specification/auth/specification.md"
  echo "state data" > "$TEST_DIR/docs/workflow/.state/migrations"
  echo "cache data" > "$TEST_DIR/docs/workflow/.cache/sessions/abc.yaml"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "discussion file moved" "true" "$([ -f "$TEST_DIR/.workflows/discussion/auth.md" ] && echo true || echo false)"
  assert_eq "discussion content preserved" "discussion content" "$(cat "$TEST_DIR/.workflows/discussion/auth.md")"
  assert_eq "spec file moved" "true" "$([ -f "$TEST_DIR/.workflows/specification/auth/specification.md" ] && echo true || echo false)"
  assert_eq "spec content preserved" "spec content" "$(cat "$TEST_DIR/.workflows/specification/auth/specification.md")"
  assert_eq "hidden .state/ dir moved" "true" "$([ -f "$TEST_DIR/.workflows/.state/migrations" ] && echo true || echo false)"
  assert_eq ".state content preserved" "state data" "$(cat "$TEST_DIR/.workflows/.state/migrations")"
  assert_eq "hidden .cache/ dir moved" "true" "$([ -f "$TEST_DIR/.workflows/.cache/sessions/abc.yaml" ] && echo true || echo false)"
  assert_eq "old directory removed" "false" "$([ -d "$TEST_DIR/docs/workflow" ] && echo true || echo false)"
  assert_eq "empty docs/ removed" "false" "$([ -d "$TEST_DIR/docs" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Already migrated — only .workflows/ exists ---
test_already_migrated() {
  setup

  mkdir -p "$TEST_DIR/.workflows/discussion"
  echo "existing" > "$TEST_DIR/.workflows/discussion/auth.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "existing files untouched" "true" "$([ -f "$TEST_DIR/.workflows/discussion/auth.md" ] && echo true || echo false)"
  assert_eq "content unchanged" "existing" "$(cat "$TEST_DIR/.workflows/discussion/auth.md")"

  teardown
}

# --- Test 3: Fresh install — neither directory exists ---
test_fresh_install() {
  setup

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq ".workflows/ not created unnecessarily" "false" "$([ -d "$TEST_DIR/.workflows" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Gitignore updated — docs/workflow/.cache/ to .workflows/.cache/ ---
test_gitignore_updated() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/
.env
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  local content
  content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "new gitignore entry present" "true" "$(echo "$content" | grep -qF '.workflows/.cache/' && echo true || echo false)"
  assert_eq "old gitignore entry removed" "false" "$(echo "$content" | grep -qF 'docs/workflow/.cache/' && echo true || echo false)"
  assert_eq "node_modules/ preserved" "true" "$(echo "$content" | grep -qF 'node_modules/' && echo true || echo false)"
  assert_eq ".env preserved" "true" "$(echo "$content" | grep -qF '.env' && echo true || echo false)"

  teardown
}

# --- Test 5: Gitignore already has .workflows/.cache/ — no-op ---
test_gitignore_already_correct() {
  setup

  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
.workflows/.cache/
.env
EOF

  local original
  original=$(cat "$TEST_DIR/.gitignore")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local new_content
  new_content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "gitignore unchanged" "$original" "$new_content"

  teardown
}

# --- Test 6: docs/ preserved if has other contents ---
test_docs_preserved() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  mkdir -p "$TEST_DIR/docs/api"
  echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
  echo "api docs" > "$TEST_DIR/docs/api/readme.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "old workflow dir removed" "false" "$([ -d "$TEST_DIR/docs/workflow" ] && echo true || echo false)"
  assert_eq "other docs/ contents preserved" "true" "$([ -d "$TEST_DIR/docs/api" ] && echo true || echo false)"
  assert_eq "non-workflow file preserved" "true" "$([ -f "$TEST_DIR/docs/api/readme.md" ] && echo true || echo false)"
  assert_eq "workflow files moved" "true" "$([ -f "$TEST_DIR/.workflows/discussion/auth.md" ] && echo true || echo false)"

  teardown
}

# --- Test 7: Hidden directories (.state/, .cache/) moved correctly ---
test_hidden_dirs_moved() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/.state"
  mkdir -p "$TEST_DIR/docs/workflow/.cache"
  echo "state" > "$TEST_DIR/docs/workflow/.state/migrations"
  echo "cache" > "$TEST_DIR/docs/workflow/.cache/data"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq ".state/ directory moved" "true" "$([ -d "$TEST_DIR/.workflows/.state" ] && echo true || echo false)"
  assert_eq ".cache/ directory moved" "true" "$([ -d "$TEST_DIR/.workflows/.cache" ] && echo true || echo false)"
  assert_eq ".state file moved" "true" "$([ -f "$TEST_DIR/.workflows/.state/migrations" ] && echo true || echo false)"
  assert_eq ".cache file moved" "true" "$([ -f "$TEST_DIR/.workflows/.cache/data" ] && echo true || echo false)"
  assert_eq ".state content preserved" "state" "$(cat "$TEST_DIR/.workflows/.state/migrations")"
  assert_eq ".cache content preserved" "cache" "$(cat "$TEST_DIR/.workflows/.cache/data")"

  teardown
}

# --- Test 8: Partial migration — item already at destination is skipped ---
test_partial_migration() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  mkdir -p "$TEST_DIR/.workflows/discussion"
  echo "old" > "$TEST_DIR/docs/workflow/discussion/auth.md"
  echo "new" > "$TEST_DIR/.workflows/discussion/auth.md"
  echo "other" > "$TEST_DIR/docs/workflow/discussion/billing.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "existing destination not overwritten" "new" "$(cat "$TEST_DIR/.workflows/discussion/auth.md")"

  teardown
}

# --- Test 9: Idempotency — running twice produces same result ---
test_idempotency() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
  cat > "$TEST_DIR/.gitignore" << 'EOF'
docs/workflow/.cache/
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  local first_content first_gitignore
  first_content=$(cat "$TEST_DIR/.workflows/discussion/auth.md")
  first_gitignore=$(cat "$TEST_DIR/.gitignore")

  source "$MIGRATION"
  local second_content second_gitignore
  second_content=$(cat "$TEST_DIR/.workflows/discussion/auth.md")
  second_gitignore=$(cat "$TEST_DIR/.gitignore")

  assert_eq "file content same after second run" "$first_content" "$second_content"
  assert_eq "gitignore same after second run" "$first_gitignore" "$second_gitignore"

  teardown
}

# --- Run all tests ---
echo "Running migration 011 tests..."
echo ""

test_full_migration
test_already_migrated
test_fresh_install
test_gitignore_updated
test_gitignore_already_correct
test_docs_preserved
test_hidden_dirs_moved
test_partial_migration
test_idempotency

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
