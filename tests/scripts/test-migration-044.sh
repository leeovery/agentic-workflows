#!/bin/bash
#
# Tests for migration 044: allow-workflows-mv
#
# Run: bash tests/scripts/test-migration-044.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/044-allow-workflows-mv.sh"

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

# Read permissions.allow as a sorted JSON array (order-independent comparison).
read_allow() {
  node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(JSON.stringify(((s.permissions && s.permissions.allow) || []).slice().sort()))" "$1"
}

# Count occurrences of a rule in permissions.allow.
count_rule() {
  node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); const a = (s.permissions && s.permissions.allow) || []; console.log(a.filter(r => r === process.argv[2]).length)" "$1" "$2"
}

setup() {
  TEST_DIR=$(mktemp -d /tmp/migration-044-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Creates settings.json from scratch with the rule ---
test_no_settings_file() {
  setup

  source "$MIGRATION"

  assert_eq "file created" "true" "$([ -f "$TEST_DIR/.claude/settings.json" ] && echo true || echo false)"
  assert_eq "rule present" '["Bash(mv .workflows/:*)"]' "$(read_allow "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Test 2: Merges into existing settings, preserving other content ---
test_existing_settings_preserved() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "showClearContextOnPlanAccept": true,
  "permissions": {
    "allow": ["Write(.workflows/**)", "Edit(.workflows/**)"]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "rule merged with existing allow" '["Bash(mv .workflows/:*)","Edit(.workflows/**)","Write(.workflows/**)"]' "$(read_allow "$TEST_DIR/.claude/settings.json")"

  local other
  other=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(s.showClearContextOnPlanAccept)" "$TEST_DIR/.claude/settings.json")
  assert_eq "unrelated setting preserved" "true" "$other"

  teardown
}

# --- Test 3: Skips (no rewrite) when the rule is already present ---
test_already_present_skips() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Bash(mv .workflows/:*)"]
  }
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

# --- Test 4: Idempotent — running twice yields no duplicates ---
test_idempotent() {
  setup

  source "$MIGRATION"
  source "$MIGRATION"

  assert_eq "rule not duplicated" "1" "$(count_rule "$TEST_DIR/.claude/settings.json" 'Bash(mv .workflows/:*)')"

  teardown
}

# --- Test 5: Creates .claude directory if missing ---
test_no_claude_dir() {
  setup

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
  printf '{\n  "permissions": {\n    "allow": ["Bash(git status:*)"],\n  }\n}\n' > "$TEST_DIR/.claude/settings.json"
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
echo "Running migration 044 tests..."
echo ""

test_no_settings_file
test_existing_settings_preserved
test_already_present_skips
test_idempotent
test_no_claude_dir
test_unparseable_settings_skips

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
