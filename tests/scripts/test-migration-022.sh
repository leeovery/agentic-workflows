#!/bin/bash
#
# Tests for migration 022: remove-session-state
#
# Run: bash tests/scripts/test-migration-022.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/022-remove-session-state.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-022-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Removes sessions directory ---
test_removes_sessions() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.cache/sessions"
  echo "session: 1" > "$TEST_DIR/.workflows/.cache/sessions/sess-001.yml"

  source "$MIGRATION"

  assert_eq "sessions dir removed" "false" "$([ -d "$TEST_DIR/.workflows/.cache/sessions" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Cleans hook entries from settings.json ---
test_cleans_hooks() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "command": "bash .workflows/session-env.sh" },
          { "command": "bash .workflows/compact-recovery.sh" }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          { "command": "bash .workflows/session-cleanup.sh" }
        ]
      }
    ]
  },
  "permissions": {
    "allow": ["Bash(git status:*)"]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "hooks removed" "false" "$(node -e "
    const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(s.hooks ? 'true' : 'false');
  " "$TEST_DIR/.claude/settings.json")"
  assert_eq "permissions preserved" "true" "$(node -e "
    const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(s.permissions ? 'true' : 'false');
  " "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Test 3: Removes settings.json entirely if empty after cleanup ---
test_removes_empty_settings() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "command": "bash .workflows/session-env.sh" }
        ]
      }
    ]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "settings.json removed" "false" "$([ -f "$TEST_DIR/.claude/settings.json" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Skips when no sessions dir and no hook entries ---
test_nothing_to_clean() {
  setup

  source "$MIGRATION"

  assert_eq "no error" "true" "true"

  teardown
}

# --- Test 5: Skips settings.json without workflow hooks ---
test_unrelated_hooks() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "command": "echo hello" }
        ]
      }
    ]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "unrelated hooks preserved" "true" "$(node -e "
    const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(s.hooks && s.hooks.SessionStart ? 'true' : 'false');
  " "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Test 6: Handles both sessions dir and hooks together ---
test_both_cleanups() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.cache/sessions"
  echo "data" > "$TEST_DIR/.workflows/.cache/sessions/sess.yml"

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "command": "bash .workflows/session-env.sh" }
        ]
      }
    ]
  },
  "other": "kept"
}
EOF

  source "$MIGRATION"

  assert_eq "sessions dir removed" "false" "$([ -d "$TEST_DIR/.workflows/.cache/sessions" ] && echo true || echo false)"
  assert_eq "other setting preserved" "kept" "$(node -e "
    const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(s.other || 'missing');
  " "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Run all tests ---
echo "Running migration 022 tests..."
echo ""

test_removes_sessions
test_cleans_hooks
test_removes_empty_settings
test_nothing_to_clean
test_unrelated_hooks
test_both_cleanups

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
