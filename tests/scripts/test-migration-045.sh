#!/bin/bash
#
# Tests for migration 045: move discovery session logs into discovery/sessions/
#
# Run: bash tests/scripts/test-migration-045.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/045-move-discovery-sessions.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-045-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# Create a discovery session log directly under discovery/ (the pre-migration layout).
# Args: work_unit, filename, content
seed_log() {
  local wu="$1" name="$2" content="$3"
  mkdir -p "$TEST_DIR/.workflows/$wu/discovery"
  printf '%s\n' "$content" > "$TEST_DIR/.workflows/$wu/discovery/$name"
}

exists() { [ -f "$1" ] && echo true || echo false; }

# --- Test 1: Happy path — an epic's logs move into discovery/sessions/ ---
test_happy_path() {
  setup

  seed_log "payments" "session-001.md" "first session"
  seed_log "payments" "session-002.md" "second session"

  source "$MIGRATION"

  local disc="$TEST_DIR/.workflows/payments/discovery"
  assert_eq "session-001 moved into sessions/" "true" "$(exists "$disc/sessions/session-001.md")"
  assert_eq "session-002 moved into sessions/" "true" "$(exists "$disc/sessions/session-002.md")"
  assert_eq "session-001 no longer at discovery/" "false" "$(exists "$disc/session-001.md")"
  assert_eq "session-002 no longer at discovery/" "false" "$(exists "$disc/session-002.md")"

  teardown
}

# --- Test 2: Content preserved through the move ---
test_content_preserved() {
  setup

  seed_log "payments" "session-001.md" "exploration notes here"

  source "$MIGRATION"

  local moved="$TEST_DIR/.workflows/payments/discovery/sessions/session-001.md"
  assert_eq "content preserved" "true" "$(grep -q 'exploration notes here' "$moved" && echo true || echo false)"

  teardown
}

# --- Test 3: Idempotent — running twice yields the same result, no error ---
test_idempotent() {
  setup

  seed_log "payments" "session-001.md" "first session"

  source "$MIGRATION"
  source "$MIGRATION"

  local disc="$TEST_DIR/.workflows/payments/discovery"
  assert_eq "log present in sessions/ after two runs" "true" "$(exists "$disc/sessions/session-001.md")"
  assert_eq "content intact after two runs" "true" "$(grep -q 'first session' "$disc/sessions/session-001.md" && echo true || echo false)"
  assert_eq "no nested sessions/sessions/" "false" "$([ -d "$disc/sessions/sessions" ] && echo true || echo false)"

  teardown
}

# --- Test 4: No-op when logs already live under sessions/ ---
test_no_op_already_moved() {
  setup

  mkdir -p "$TEST_DIR/.workflows/payments/discovery/sessions"
  printf '%s\n' "already moved" > "$TEST_DIR/.workflows/payments/discovery/sessions/session-001.md"

  source "$MIGRATION"

  local disc="$TEST_DIR/.workflows/payments/discovery"
  assert_eq "log stays in sessions/" "true" "$(exists "$disc/sessions/session-001.md")"
  assert_eq "content untouched" "true" "$(grep -q 'already moved' "$disc/sessions/session-001.md" && echo true || echo false)"
  assert_eq "no nested sessions/sessions/" "false" "$([ -d "$disc/sessions/sessions" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Multiple work units all migrate ---
test_multi_work_unit() {
  setup

  seed_log "payments" "session-001.md" "payments"
  seed_log "billing" "session-001.md" "billing"
  seed_log "billing" "session-002.md" "billing two"

  source "$MIGRATION"

  assert_eq "payments moved" "true" "$(exists "$TEST_DIR/.workflows/payments/discovery/sessions/session-001.md")"
  assert_eq "billing 001 moved" "true" "$(exists "$TEST_DIR/.workflows/billing/discovery/sessions/session-001.md")"
  assert_eq "billing 002 moved" "true" "$(exists "$TEST_DIR/.workflows/billing/discovery/sessions/session-002.md")"

  teardown
}

# --- Test 6: Single-phase work unit (one session-001.md) migrates identically ---
test_single_phase_work_unit() {
  setup

  seed_log "auth-flow" "session-001.md" "feature seed"

  source "$MIGRATION"

  local disc="$TEST_DIR/.workflows/auth-flow/discovery"
  assert_eq "single-phase log moved" "true" "$(exists "$disc/sessions/session-001.md")"
  assert_eq "single-phase log gone from discovery/" "false" "$(exists "$disc/session-001.md")"

  teardown
}

# --- Test 7: Non-session files in discovery/ are left in place ---
test_non_session_files_left() {
  setup

  seed_log "payments" "session-001.md" "session"
  printf '%s\n' "notes" > "$TEST_DIR/.workflows/payments/discovery/notes.md"

  source "$MIGRATION"

  local disc="$TEST_DIR/.workflows/payments/discovery"
  assert_eq "session log moved" "true" "$(exists "$disc/sessions/session-001.md")"
  assert_eq "notes.md left in place" "true" "$(exists "$disc/notes.md")"
  assert_eq "notes.md not moved into sessions/" "false" "$(exists "$disc/sessions/notes.md")"

  teardown
}

# --- Test 8: No session logs anywhere — clean no-op ---
test_no_logs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/payments/discovery"

  source "$MIGRATION"

  assert_eq "no sessions/ created when nothing to move" "false" "$([ -d "$TEST_DIR/.workflows/payments/discovery/sessions" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 045 tests..."
echo ""

test_happy_path
test_content_preserved
test_idempotent
test_no_op_already_moved
test_multi_work_unit
test_single_phase_work_unit
test_non_session_files_left
test_no_logs

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
