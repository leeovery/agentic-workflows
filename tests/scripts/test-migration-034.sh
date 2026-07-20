#!/bin/bash
#
# Tests for migration 034: show-clear-context-on-plan-accept
#
# Run: bash tests/scripts/test-migration-034.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/034-show-clear-context-on-plan-accept.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-034-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Creates settings.json from scratch ---
test_no_settings_file() {
  setup

  source "$MIGRATION"

  assert_eq "file created" "true" "$([ -f "$TEST_DIR/.claude/settings.json" ] && echo true || echo false)"
  local val
  val=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(s.showClearContextOnPlanAccept)" "$TEST_DIR/.claude/settings.json")
  assert_eq "setting is true" "true" "$val"

  teardown
}

# --- Test 2: Merges into existing settings.json ---
test_existing_settings() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Bash(git status:*)"]
  }
}
EOF

  source "$MIGRATION"

  local val
  val=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(s.showClearContextOnPlanAccept)" "$TEST_DIR/.claude/settings.json")
  assert_eq "setting added" "true" "$val"

  local perms
  perms=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(JSON.stringify(s.permissions.allow))" "$TEST_DIR/.claude/settings.json")
  assert_eq "existing settings preserved" '["Bash(git status:*)"]' "$perms"

  teardown
}

# --- Test 3: Skips when setting already true ---
test_already_set() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "showClearContextOnPlanAccept": true,
  "other": "value"
}
EOF

  local mtime_before
  mtime_before=$(stat --format="%Y" "$TEST_DIR/.claude/settings.json" 2>/dev/null || stat -f "%m" "$TEST_DIR/.claude/settings.json")

  source "$MIGRATION"

  local mtime_after
  mtime_after=$(stat --format="%Y" "$TEST_DIR/.claude/settings.json" 2>/dev/null || stat -f "%m" "$TEST_DIR/.claude/settings.json")
  assert_eq "file not modified" "$mtime_before" "$mtime_after"

  teardown
}

# --- Test 4: Overwrites when setting is false ---
test_setting_false() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "showClearContextOnPlanAccept": false
}
EOF

  source "$MIGRATION"

  local val
  val=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(s.showClearContextOnPlanAccept)" "$TEST_DIR/.claude/settings.json")
  assert_eq "setting corrected to true" "true" "$val"

  teardown
}

# --- Test 5: Creates .claude directory if missing ---
test_no_claude_dir() {
  setup

  # Don't create .claude dir — migration should handle it
  source "$MIGRATION"

  assert_eq ".claude dir created" "true" "$([ -d "$TEST_DIR/.claude" ] && echo true || echo false)"
  assert_eq "file created" "true" "$([ -f "$TEST_DIR/.claude/settings.json" ] && echo true || echo false)"

  teardown
}

# --- Unparseable settings.json (trailing comma) — skip, never crash ---
# A hand-edited settings.json with a trailing comma must not brick the migration
# chain. The migration skips (leaving the file untouched) rather than crashing.
test_unparseable_settings_skips() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  printf '{\n  "showClearContextOnPlanAccept": true,\n}\n' > "$TEST_DIR/.claude/settings.json"
  local before
  before=$(cat "$TEST_DIR/.claude/settings.json")

  local rc=0
  ( source "$MIGRATION" ) || rc=$?
  assert_eq "unparseable settings skipped without error" "0" "$rc"

  local after
  after=$(cat "$TEST_DIR/.claude/settings.json")
  assert_eq "unparseable settings left byte-identical" "$before" "$after"

  teardown
}

# --- Run all tests ---
echo "Running migration 034 tests..."
echo ""

test_no_settings_file
test_existing_settings
test_already_set
test_setting_false
test_no_claude_dir
test_unparseable_settings_skips

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
