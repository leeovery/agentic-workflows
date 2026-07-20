#!/bin/bash
#
# Tests for migration 048: strip-discovery-item-status
#
# Run: bash tests/scripts/test-migration-048.sh
#
set -euo pipefail

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/048-strip-discovery-item-status.sh"

report_update() { :; }
report_skip() { :; }

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
  TEST_DIR=$(mktemp -d /tmp/migration-048-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
  unset PROJECT_DIR
}

write_manifest() {
  local wu="$1" json="$2"
  mkdir -p "$TEST_DIR/.workflows/$wu"
  printf '%s\n' "$json" > "$TEST_DIR/.workflows/$wu/manifest.json"
}

# --- Test 1: Happy path — status stripped, other fields preserved ---
test_strips_status() {
  setup
  write_manifest "epic-a" '{"name":"epic-a","work_type":"epic","phases":{"discovery":{"items":{"topic-x":{"status":"in-progress","routing":"research","source":"discovery","summary":"s","order":2},"topic-y":{"routing":"discussion","source":"discovery"}}}}}'
  source "$MIGRATION"
  local m; m=$(cat "$TEST_DIR/.workflows/epic-a/manifest.json")
  assert_eq "status removed" "false" "$(echo "$m" | grep -q '"status"' && echo true || echo false)"
  assert_eq "routing preserved" "true" "$(echo "$m" | grep -q '"routing": "research"' && echo true || echo false)"
  assert_eq "order preserved" "true" "$(echo "$m" | grep -q '"order": 2' && echo true || echo false)"
  assert_eq "summary preserved" "true" "$(echo "$m" | grep -q '"summary": "s"' && echo true || echo false)"
  teardown
}

# --- Test 2: Skip — no discovery items carry status ---
test_skip_clean_manifest() {
  setup
  write_manifest "epic-b" '{"name":"epic-b","work_type":"epic","phases":{"discovery":{"items":{"topic-z":{"routing":"research","source":"discovery"}}}}}'
  local before; before=$(cat "$TEST_DIR/.workflows/epic-b/manifest.json")
  source "$MIGRATION"
  local after; after=$(cat "$TEST_DIR/.workflows/epic-b/manifest.json")
  assert_eq "clean manifest untouched" "$before" "$after"
  teardown
}

# --- Test 3: Skip — no discovery phase at all ---
test_skip_no_discovery() {
  setup
  write_manifest "feat-c" '{"name":"feat-c","work_type":"feature","phases":{"discussion":{"items":{"feat-c":{"status":"in-progress"}}}}}'
  source "$MIGRATION"
  local m; m=$(cat "$TEST_DIR/.workflows/feat-c/manifest.json")
  assert_eq "phase-item status untouched" "true" "$(echo "$m" | grep -q '"status":"in-progress"' && echo true || echo false)"
  teardown
}

# --- Test 4: Idempotency — second run changes nothing ---
test_idempotent() {
  setup
  write_manifest "epic-d" '{"name":"epic-d","work_type":"epic","phases":{"discovery":{"items":{"t":{"status":"in-progress","routing":"research","source":"discovery"}}}}}'
  source "$MIGRATION"
  local first; first=$(cat "$TEST_DIR/.workflows/epic-d/manifest.json")
  source "$MIGRATION"
  local second; second=$(cat "$TEST_DIR/.workflows/epic-d/manifest.json")
  assert_eq "second run identical" "$first" "$second"
  teardown
}

# --- Test 5: Defensive — unparseable manifest untouched ---
test_defensive_corrupt() {
  setup
  mkdir -p "$TEST_DIR/.workflows/broken"
  printf 'not json{' > "$TEST_DIR/.workflows/broken/manifest.json"
  source "$MIGRATION"
  assert_eq "corrupt manifest untouched" "not json{" "$(cat "$TEST_DIR/.workflows/broken/manifest.json")"
  teardown
}

# --- Test 6: Content preservation — dismissed list and sibling phases survive ---
test_preserves_siblings() {
  setup
  write_manifest "epic-e" '{"name":"epic-e","work_type":"epic","phases":{"discovery":{"items":{"t":{"status":"in-progress","routing":"research","source":"discovery"}},"dismissed":["old-idea"]},"research":{"items":{"t":{"status":"completed"}}}}}'
  source "$MIGRATION"
  local m; m=$(cat "$TEST_DIR/.workflows/epic-e/manifest.json")
  assert_eq "dismissed preserved" "true" "$(echo "$m" | grep -q '"old-idea"' && echo true || echo false)"
  assert_eq "research status preserved" "true" "$(echo "$m" | grep -q '"status": "completed"' && echo true || echo false)"
  teardown
}

test_strips_status
test_skip_clean_manifest
test_skip_no_discovery
test_idempotent
test_defensive_corrupt
test_preserves_siblings

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
