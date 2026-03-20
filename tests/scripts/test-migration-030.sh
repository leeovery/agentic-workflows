#!/bin/bash
#
# Tests for migration 030: project-manifest
#
# Run: bash tests/scripts/test-migration-030.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/030-project-manifest.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-030-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Builds project manifest from work units ---
test_builds_manifest() {
  setup

  mkdir -p "$TEST_DIR/.workflows/auth"
  cat > "$TEST_DIR/.workflows/auth/manifest.json" << 'JSON'
{"name":"auth","work_type":"feature","status":"in-progress","phases":{}}
JSON

  mkdir -p "$TEST_DIR/.workflows/v1"
  cat > "$TEST_DIR/.workflows/v1/manifest.json" << 'JSON'
{"name":"v1","work_type":"epic","status":"in-progress","phases":{}}
JSON

  source "$MIGRATION"

  local wt_auth=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8'));
    console.log(m.work_units.auth.work_type);
  ")
  assert_eq "auth registered" "feature" "$wt_auth"

  local wt_v1=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8'));
    console.log(m.work_units.v1.work_type);
  ")
  assert_eq "v1 registered" "epic" "$wt_v1"

  teardown
}

# --- Test 2: Idempotent — already registered ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/auth"
  cat > "$TEST_DIR/.workflows/auth/manifest.json" << 'JSON'
{"name":"auth","work_type":"feature","status":"in-progress","phases":{}}
JSON

  cat > "$TEST_DIR/.workflows/manifest.json" << 'JSON'
{"work_units":{"auth":{"work_type":"feature"}}}
JSON

  source "$MIGRATION"

  local count=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8'));
    console.log(Object.keys(m.work_units).length);
  ")
  assert_eq "idempotent: no new entries" "1" "$count"

  teardown
}

# --- Test 3: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  mkdir -p "$TEST_DIR/.workflows/.cache"
  mkdir -p "$TEST_DIR/.workflows/auth"
  cat > "$TEST_DIR/.workflows/auth/manifest.json" << 'JSON'
{"name":"auth","work_type":"feature","status":"in-progress","phases":{}}
JSON

  source "$MIGRATION"

  local count=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8'));
    console.log(Object.keys(m.work_units).length);
  ")
  assert_eq "dot dirs skipped" "1" "$count"

  teardown
}

# --- Test 4: No workflows dir ---
test_no_workflows() {
  TEST_DIR=$(mktemp -d /tmp/migration-030-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"

  source "$MIGRATION"

  assert_eq "no crash" "true" "true"

  teardown
}

# --- Run all tests ---
echo "Running migration 030 tests..."
echo ""

test_builds_manifest
test_idempotent
test_skips_dot_dirs
test_no_workflows

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
