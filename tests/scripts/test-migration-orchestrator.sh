#!/bin/bash
#
# Tests for the migration orchestrator (migrate.sh)
#
# Covers the hardening that lets the fleet boot on stock macOS bash 3.2:
#   - no `mapfile` (bash 4+) — the script discovery uses a 3.2-safe read loop
#   - PROJECT_DIR is pinned to "." so a user-exported PROJECT_DIR can't redirect
#     migrations at a different tree
#
# Run: bash tests/scripts/test-migration-orchestrator.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATE="$REPO_DIR/skills/workflow-migrate/scripts/migrate.sh"

# Prefer the stock /bin/bash (3.2 on macOS) when available — that is the whole
# point of the mapfile fix. Fall back to whatever `bash` resolves to elsewhere.
SYSTEM_BASH="/bin/bash"
[ -x "$SYSTEM_BASH" ] || SYSTEM_BASH="bash"

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

setup() {
  TEST_DIR=$(mktemp -d /tmp/migrate-orchestrator-test.XXXXXX)
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Runs to completion under stock bash 3.2 (no mapfile) ---
test_runs_under_system_bash() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"

  local out rc
  out=$(cd "$TEST_DIR" && "$SYSTEM_BASH" "$MIGRATE" 2>&1) && rc=0 || rc=$?

  assert_eq "orchestrator exits cleanly under system bash" "0" "$rc"
  assert_eq "no mapfile failure" "false" "$(echo "$out" | grep -qiE 'mapfile|command not found' && echo true || echo false)"
  assert_eq "tracking file written" "true" "$([ -f "$TEST_DIR/.workflows/.state/migrations" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Idempotent — a second run makes no changes ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"

  (cd "$TEST_DIR" && "$SYSTEM_BASH" "$MIGRATE" >/dev/null 2>&1)
  local out
  out=$(cd "$TEST_DIR" && "$SYSTEM_BASH" "$MIGRATE" 2>&1)

  assert_eq "second run reports no changes" "true" "$(echo "$out" | grep -qF '[SKIP] No changes needed' && echo true || echo false)"

  teardown
}

# --- Test 3: PROJECT_DIR is pinned to "." — a hostile export can't redirect ---
# Migration 019 renames a work-unit status active -> in-progress. With PROJECT_DIR
# exported to a decoy tree, an unpinned orchestrator would migrate the decoy and
# leave the real project untouched. The pin forces every migration onto ".".
test_project_dir_pinned() {
  setup

  # Real project (cwd) — status active, must be migrated.
  mkdir -p "$TEST_DIR/proj/.workflows/wu/phases"
  printf '{"name":"wu","work_type":"feature","status":"active","phases":{}}\n' \
    > "$TEST_DIR/proj/.workflows/wu/manifest.json"

  # Decoy tree — status active, must be left untouched.
  mkdir -p "$TEST_DIR/decoy/.workflows/wu2/phases"
  printf '{"name":"wu2","work_type":"feature","status":"active","phases":{}}\n' \
    > "$TEST_DIR/decoy/.workflows/wu2/manifest.json"

  (cd "$TEST_DIR/proj" && PROJECT_DIR="$TEST_DIR/decoy" "$SYSTEM_BASH" "$MIGRATE" >/dev/null 2>&1)

  local proj_status decoy_status
  proj_status=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/proj/.workflows/wu/manifest.json")
  decoy_status=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/decoy/.workflows/wu2/manifest.json")

  assert_eq "real project migrated (active -> in-progress)" "in-progress" "$proj_status"
  assert_eq "decoy tree untouched (still active)" "active" "$decoy_status"

  teardown
}

# --- Run all tests ---
echo "Running migration orchestrator tests..."
echo "  (system bash: $("$SYSTEM_BASH" --version 2>/dev/null | head -1))"
echo ""

test_runs_under_system_bash
test_idempotent
test_project_dir_pinned

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
