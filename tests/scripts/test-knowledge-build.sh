#!/bin/bash
# Tests for the knowledge CLI build pipeline (knowledge-base phase 1, task 1-1).
# Run: bash tests/scripts/test-knowledge-build.sh

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUNDLE="$REPO_DIR/skills/workflow-knowledge/scripts/knowledge.cjs"
MAX_BUNDLE_BYTES=153600  # 150 KB
LOG_DIR="${TMPDIR:-/tmp}"

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

# --- Test 1: npm run build exits 0 ---
test_build_exits_clean() {
  cd "$REPO_DIR"
  if npm run build > "$LOG_DIR/knowledge-build.log" 2>&1; then
    build_status=0
  else
    build_status=$?
  fi
  assert_eq "npm run build exits with code 0" "0" "$build_status"
}

# --- Test 2: bundle exists ---
test_bundle_exists() {
  assert_eq "bundle file exists at expected path" \
    "true" \
    "$([ -f "$BUNDLE" ] && echo true || echo false)"
}

# --- Test 3: bundle under 150KB ---
test_bundle_under_threshold() {
  local size
  size=$(/usr/bin/stat -f '%z' "$BUNDLE" 2>/dev/null || stat -c '%s' "$BUNDLE")
  if [ "$size" -lt "$MAX_BUNDLE_BYTES" ]; then
    under=true
  else
    under=false
    echo "  bundle size: $size bytes (threshold: $MAX_BUNDLE_BYTES)"
  fi
  assert_eq "bundle size under 150KB" "true" "$under"
}

# --- Test 4: bundle runs (no-command prints usage, exits 1 — expected CLI behaviour) ---
test_bundle_runs() {
  local stderr_out
  stderr_out=$(node "$BUNDLE" 2>&1 || true)
  assert_eq "no-command prints usage" \
    "true" \
    "$(echo "$stderr_out" | grep -q 'Usage:' && echo true || echo false)"
}

# --- Test 5: check command exits 0 (CLI is functional) ---
test_check_exits_clean() {
  # Check without setup → not-ready, but exit 0.
  if node "$BUNDLE" check > "$LOG_DIR/knowledge-check.log" 2>&1; then
    run_status=0
  else
    run_status=$?
  fi
  assert_eq "check command exits with code 0" "0" "$run_status"
}

# --- Run all tests ---
echo "Running knowledge build tests..."
echo ""

test_build_exits_clean
test_bundle_exists
test_bundle_under_threshold
test_bundle_runs
test_check_exits_clean

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
