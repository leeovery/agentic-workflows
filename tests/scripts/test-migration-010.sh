#!/bin/bash
# Tests for migration 010: gitignore-sessions
# Run: bash tests/scripts/test-migration-010.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/010-gitignore-sessions.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-010-test.XXXXXX)
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Move analysis files from .cache/ to .state/ ---
test_move_analysis_files() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/.cache"
  echo "analysis content" > "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md"
  echo "research content" > "$TEST_DIR/docs/workflow/.cache/research-analysis.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "discussion-consolidation-analysis.md moved to .state/" "true" "$([ -f "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md" ] && echo true || echo false)"
  assert_eq "research-analysis.md moved to .state/" "true" "$([ -f "$TEST_DIR/docs/workflow/.state/research-analysis.md" ] && echo true || echo false)"
  assert_eq "discussion-consolidation-analysis.md removed from .cache/" "false" "$([ -f "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md" ] && echo true || echo false)"
  assert_eq "research-analysis.md removed from .cache/" "false" "$([ -f "$TEST_DIR/docs/workflow/.cache/research-analysis.md" ] && echo true || echo false)"
  assert_eq "discussion content preserved" "analysis content" "$(cat "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md")"
  assert_eq "research content preserved" "research content" "$(cat "$TEST_DIR/docs/workflow/.state/research-analysis.md")"

  teardown
}

# --- Test 2: Clean up orphaned migration tracking in .cache/ ---
test_cleanup_migration_tracking() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/.cache"
  echo "001" > "$TEST_DIR/docs/workflow/.cache/migrations"
  echo "001" > "$TEST_DIR/docs/workflow/.cache/migrations.log"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "migrations file removed from .cache/" "false" "$([ -f "$TEST_DIR/docs/workflow/.cache/migrations" ] && echo true || echo false)"
  assert_eq "migrations.log file removed from .cache/" "false" "$([ -f "$TEST_DIR/docs/workflow/.cache/migrations.log" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Add docs/workflow/.cache/ to .gitignore ---
test_add_gitignore_entry() {
  setup

  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
.env
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  local content
  content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "existing node_modules/ preserved" "true" "$(echo "$content" | grep -qF 'node_modules/' && echo true || echo false)"
  assert_eq "existing .env preserved" "true" "$(echo "$content" | grep -qF '.env' && echo true || echo false)"
  assert_eq ".cache/ entry appended" "true" "$(echo "$content" | grep -qF 'docs/workflow/.cache/' && echo true || echo false)"

  teardown
}

# --- Test 4: Remove old sessions/ entry from .gitignore ---
test_remove_old_sessions_entry() {
  setup

  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/sessions/
.env
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  local content
  content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "old sessions/ entry removed" "false" "$(echo "$content" | grep -qF 'docs/workflow/.cache/sessions/' && echo true || echo false)"
  assert_eq "new .cache/ entry added" "true" "$(echo "$content" | grep -qF 'docs/workflow/.cache/' && echo true || echo false)"
  assert_eq "node_modules/ preserved" "true" "$(echo "$content" | grep -qF 'node_modules/' && echo true || echo false)"
  assert_eq ".env preserved" "true" "$(echo "$content" | grep -qF '.env' && echo true || echo false)"

  teardown
}

# --- Test 5: No .gitignore exists — creates and adds entry ---
test_no_gitignore() {
  setup

  cd "$TEST_DIR"
  source "$MIGRATION"
  local content
  content=$(cat "$TEST_DIR/.gitignore")

  assert_eq ".cache/ entry added to new .gitignore" "true" "$(echo "$content" | grep -qF 'docs/workflow/.cache/' && echo true || echo false)"

  teardown
}

# --- Test 6: Idempotent — .cache/ already in .gitignore, no files to move ---
test_already_correct() {
  setup

  cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/
.env
EOF

  local original
  original=$(cat "$TEST_DIR/.gitignore")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local new_content
  new_content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "file unchanged when already correct" "$original" "$new_content"

  teardown
}

# --- Test 7: Idempotency — running migration twice ---
test_idempotency() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/.cache"
  echo "analysis" > "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md"

  cd "$TEST_DIR"
  source "$MIGRATION"
  local first_gitignore
  first_gitignore=$(cat "$TEST_DIR/.gitignore")

  source "$MIGRATION"
  local second_gitignore
  second_gitignore=$(cat "$TEST_DIR/.gitignore")

  assert_eq "second run produces same .gitignore" "$first_gitignore" "$second_gitignore"
  local cache_count
  cache_count=$(echo "$second_gitignore" | grep -cF "docs/workflow/.cache/" || true)
  assert_eq ".cache/ entry appears exactly once" "1" "$cache_count"
  assert_eq "file still in .state/ after second run" "true" "$([ -f "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md" ] && echo true || echo false)"

  teardown
}

# --- Test 8: Files already in .state/ — no double move ---
test_no_double_move() {
  setup

  mkdir -p "$TEST_DIR/docs/workflow/.state"
  echo "existing state content" > "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "existing .state/ file not overwritten" "existing state content" "$(cat "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md")"

  teardown
}

# --- Test 9: .gitignore with no trailing newline — entry on its own line ---
test_no_trailing_newline() {
  setup

  printf 'node_modules/\n.claude/settings.local.json' > "$TEST_DIR/.gitignore"

  cd "$TEST_DIR"
  source "$MIGRATION"
  local content
  content=$(cat "$TEST_DIR/.gitignore")

  assert_eq "original last line preserved intact" "true" "$(echo "$content" | grep -qF '.claude/settings.local.json' && echo true || echo false)"
  assert_eq "no concatenation with appended entry" "false" "$(echo "$content" | grep -qF '.claude/settings.local.jsondocs' && echo true || echo false)"
  assert_eq ".cache/ entry present" "true" "$(echo "$content" | grep -qF 'docs/workflow/.cache/' && echo true || echo false)"
  local line_count
  line_count=$(wc -l < "$TEST_DIR/.gitignore" | tr -d ' ')
  assert_eq "entry appended as separate line (3 lines total)" "3" "$line_count"

  teardown
}

# --- Run all tests ---
echo "Running migration 010 tests..."
echo ""

test_move_analysis_files
test_cleanup_migration_tracking
test_add_gitignore_entry
test_remove_old_sessions_entry
test_no_gitignore
test_already_correct
test_idempotency
test_no_double_move
test_no_trailing_newline

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
