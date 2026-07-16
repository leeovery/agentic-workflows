#!/bin/bash
#
# Tests for migration 046: remove-workflows-write-rule
#
# Run: bash tests/scripts/test-migration-046.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/046-remove-workflows-write-rule.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-046-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Removes the Write rule, keeps Edit and other rules ---
test_removes_write_rule() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Write(.workflows/**)", "Edit(.workflows/**)", "Bash(mv .workflows/:*)"]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "Write rule removed, others kept" '["Bash(mv .workflows/:*)","Edit(.workflows/**)"]' "$(read_allow "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Test 2: No settings file — no-op, nothing created ---
test_no_settings_file() {
  setup

  source "$MIGRATION"

  assert_eq "no file created" "false" "$([ -f "$TEST_DIR/.claude/settings.json" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Rule absent — skips without rewriting the file ---
test_rule_absent_skips() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Edit(.workflows/**)"]
  }
}
EOF

  local mtime_before
  mtime_before=$(stat --format="%Y" "$TEST_DIR/.claude/settings.json" 2>/dev/null || stat -f "%m" "$TEST_DIR/.claude/settings.json")

  source "$MIGRATION"

  local mtime_after
  mtime_after=$(stat --format="%Y" "$TEST_DIR/.claude/settings.json" 2>/dev/null || stat -f "%m" "$TEST_DIR/.claude/settings.json")
  assert_eq "file not modified" "$mtime_before" "$mtime_after"
  assert_eq "Edit rule untouched" '["Edit(.workflows/**)"]' "$(read_allow "$TEST_DIR/.claude/settings.json")"

  teardown
}

# --- Test 4: Unrelated settings and rules preserved ---
test_content_preserved() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "showClearContextOnPlanAccept": true,
  "permissions": {
    "allow": ["Bash(git status:*)", "Write(.workflows/**)", "Edit(.workflows/**)"],
    "deny": ["Bash(rm:*)"]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "other allow rules preserved" '["Bash(git status:*)","Edit(.workflows/**)"]' "$(read_allow "$TEST_DIR/.claude/settings.json")"

  local other
  other=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(s.showClearContextOnPlanAccept)" "$TEST_DIR/.claude/settings.json")
  assert_eq "unrelated setting preserved" "true" "$other"

  local deny
  deny=$(node -e "const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(JSON.stringify(s.permissions.deny))" "$TEST_DIR/.claude/settings.json")
  assert_eq "deny list preserved" '["Bash(rm:*)"]' "$deny"

  teardown
}

# --- Test 5: Idempotent — running twice yields the same result ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Write(.workflows/**)", "Edit(.workflows/**)"]
  }
}
EOF

  source "$MIGRATION"
  source "$MIGRATION"

  assert_eq "Write rule gone after two runs" "0" "$(count_rule "$TEST_DIR/.claude/settings.json" 'Write(.workflows/**)')"
  assert_eq "Edit rule intact after two runs" "1" "$(count_rule "$TEST_DIR/.claude/settings.json" 'Edit(.workflows/**)')"

  teardown
}

# --- Test 6: Removes duplicate Write rules in one pass ---
test_removes_duplicates() {
  setup

  mkdir -p "$TEST_DIR/.claude"
  cat > "$TEST_DIR/.claude/settings.json" <<'EOF'
{
  "permissions": {
    "allow": ["Write(.workflows/**)", "Edit(.workflows/**)", "Write(.workflows/**)"]
  }
}
EOF

  source "$MIGRATION"

  assert_eq "all Write occurrences removed" "0" "$(count_rule "$TEST_DIR/.claude/settings.json" 'Write(.workflows/**)')"

  teardown
}

# --- Run all tests ---
echo "Running migration 046 tests..."
echo ""

test_removes_write_rule
test_no_settings_file
test_rule_absent_skips
test_content_preserved
test_idempotent
test_removes_duplicates

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
