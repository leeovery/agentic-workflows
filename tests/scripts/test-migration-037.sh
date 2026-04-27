#!/bin/bash
#
# Tests for migration 037: Close the completed_at gap between Phase 4 and Phase 5
#
# Run: bash tests/scripts/test-migration-037.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/037-completed-at-gap.sh"

PASS=0
FAIL=0

report_update() { REPORT_CALLED=update; }
report_skip() { REPORT_CALLED=skip; }

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
  TEST_DIR=$(mktemp -d /tmp/migration-037-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
  REPORT_CALLED=""
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Happy path — completed work unit without completed_at gets backfilled ---
test_happy_path() {
  setup

  mkdir -p "$TEST_DIR/.workflows/alpha/discussion"
  cat > "$TEST_DIR/.workflows/alpha/manifest.json" <<'JSON'
{
  "name": "alpha",
  "work_type": "feature",
  "status": "completed",
  "phases": {}
}
JSON

  echo "content" > "$TEST_DIR/.workflows/alpha/discussion/alpha.md"
  touch -t 202501150930 "$TEST_DIR/.workflows/alpha/discussion/alpha.md"

  source "$MIGRATION"

  local has_field
  has_field=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.completed_at !== undefined && m.completed_at !== null)")
  assert_eq "completed_at set" "true" "$has_field"

  local value
  value=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.completed_at)")
  assert_eq "completed_at is ISO date" "2025-01-15" "$value"

  teardown
}

# --- Test 2: Skip — already has completed_at (036 already set it) ---
test_skip_existing() {
  setup

  mkdir -p "$TEST_DIR/.workflows/beta/discussion"
  cat > "$TEST_DIR/.workflows/beta/manifest.json" <<'JSON'
{
  "name": "beta",
  "work_type": "feature",
  "status": "completed",
  "completed_at": "2025-03-01",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/beta/discussion/beta.md"

  local before
  before=$(cat "$TEST_DIR/.workflows/beta/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/beta/manifest.json")
  assert_eq "manifest unchanged" "$before" "$after"

  teardown
}

# --- Test 3: Skip — in-progress work unit ---
test_skip_in_progress() {
  setup

  mkdir -p "$TEST_DIR/.workflows/gamma/discussion"
  cat > "$TEST_DIR/.workflows/gamma/manifest.json" <<'JSON'
{
  "name": "gamma",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/gamma/discussion/gamma.md"

  local before
  before=$(cat "$TEST_DIR/.workflows/gamma/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/gamma/manifest.json")
  assert_eq "in-progress not modified" "$before" "$after"

  teardown
}

# --- Test 4: Skip — cancelled work unit ---
test_skip_cancelled() {
  setup

  mkdir -p "$TEST_DIR/.workflows/delta/discussion"
  cat > "$TEST_DIR/.workflows/delta/manifest.json" <<'JSON'
{
  "name": "delta",
  "work_type": "feature",
  "status": "cancelled",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/delta/discussion/delta.md"

  local before
  before=$(cat "$TEST_DIR/.workflows/delta/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/delta/manifest.json")
  assert_eq "cancelled not modified" "$before" "$after"

  teardown
}

# --- Test 5: Idempotent — running twice produces same result ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/echo/specification/echo"
  cat > "$TEST_DIR/.workflows/echo/manifest.json" <<'JSON'
{
  "name": "echo",
  "work_type": "feature",
  "status": "completed",
  "phases": {}
}
JSON
  echo "spec" > "$TEST_DIR/.workflows/echo/specification/echo/specification.md"
  touch -t 202502200800 "$TEST_DIR/.workflows/echo/specification/echo/specification.md"

  source "$MIGRATION"

  local after_first
  after_first=$(cat "$TEST_DIR/.workflows/echo/manifest.json")

  source "$MIGRATION"

  local after_second
  after_second=$(cat "$TEST_DIR/.workflows/echo/manifest.json")
  assert_eq "idempotent" "$after_first" "$after_second"

  teardown
}

# --- Test 6: Multiple work units — only completed without completed_at ---
test_multiple() {
  setup

  mkdir -p "$TEST_DIR/.workflows/one/discussion"
  cat > "$TEST_DIR/.workflows/one/manifest.json" <<'JSON'
{
  "name": "one",
  "work_type": "feature",
  "status": "completed",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/one/discussion/one.md"
  touch -t 202503100000 "$TEST_DIR/.workflows/one/discussion/one.md"

  mkdir -p "$TEST_DIR/.workflows/two/discussion"
  cat > "$TEST_DIR/.workflows/two/manifest.json" <<'JSON'
{
  "name": "two",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/two/discussion/two.md"

  local two_before
  two_before=$(cat "$TEST_DIR/.workflows/two/manifest.json")

  source "$MIGRATION"

  local one_has
  one_has=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/one/manifest.json','utf8')); console.log(m.completed_at)")
  assert_eq "one backfilled" "2025-03-10" "$one_has"

  local two_after
  two_after=$(cat "$TEST_DIR/.workflows/two/manifest.json")
  assert_eq "two unchanged" "$two_before" "$two_after"

  teardown
}

# --- Test 7: Content preservation — other fields intact ---
test_content_preservation() {
  setup

  mkdir -p "$TEST_DIR/.workflows/foxtrot/research"
  cat > "$TEST_DIR/.workflows/foxtrot/manifest.json" <<'JSON'
{
  "name": "foxtrot",
  "work_type": "epic",
  "status": "completed",
  "description": "Important project",
  "custom_field": 42,
  "phases": {
    "research": {
      "items": { "topic-a": { "status": "completed" } }
    }
  }
}
JSON
  echo "research" > "$TEST_DIR/.workflows/foxtrot/research/topic-a.md"
  touch -t 202504010000 "$TEST_DIR/.workflows/foxtrot/research/topic-a.md"

  source "$MIGRATION"

  local desc
  desc=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.description)")
  assert_eq "description preserved" "Important project" "$desc"

  local custom
  custom=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.custom_field)")
  assert_eq "custom_field preserved" "42" "$custom"

  local topic_status
  topic_status=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.phases.research.items['topic-a'].status)")
  assert_eq "topic status preserved" "completed" "$topic_status"

  teardown
}

# --- Test 8: No workflows dir ---
test_no_workflows() {
  TEST_DIR=$(mktemp -d /tmp/migration-037-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"

  source "$MIGRATION"

  assert_eq "no crash" "true" "true"

  teardown
}

# --- Test 9: Empty work unit (no artifact files) — skip ---
test_empty_work_unit() {
  setup

  mkdir -p "$TEST_DIR/.workflows/ghost"
  cat > "$TEST_DIR/.workflows/ghost/manifest.json" <<'JSON'
{
  "name": "ghost",
  "work_type": "feature",
  "status": "completed",
  "phases": {}
}
JSON

  local before
  before=$(cat "$TEST_DIR/.workflows/ghost/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/ghost/manifest.json")
  assert_eq "empty work unit unchanged" "$before" "$after"

  teardown
}

# --- Test 10: Counter accuracy — update path calls report_update ---
test_counter_reports_update_when_modified() {
  setup

  mkdir -p "$TEST_DIR/.workflows/needs-backfill/discussion"
  cat > "$TEST_DIR/.workflows/needs-backfill/manifest.json" <<'JSON'
{
  "name": "needs-backfill",
  "work_type": "feature",
  "status": "completed",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/needs-backfill/discussion/topic.md"
  touch -t 202501150930 "$TEST_DIR/.workflows/needs-backfill/discussion/topic.md"

  source "$MIGRATION"

  assert_eq "report_update called when modified" "update" "$REPORT_CALLED"

  teardown
}

# --- Test 11: Counter accuracy — no-op path calls report_skip ---
test_counter_reports_skip_when_nothing_to_do() {
  setup

  # Only an already-backfilled WU exists — migration has nothing to do.
  mkdir -p "$TEST_DIR/.workflows/already-done/discussion"
  cat > "$TEST_DIR/.workflows/already-done/manifest.json" <<'JSON'
{
  "name": "already-done",
  "work_type": "feature",
  "status": "completed",
  "completed_at": "2025-03-01",
  "phases": {}
}
JSON
  echo "content" > "$TEST_DIR/.workflows/already-done/discussion/topic.md"

  source "$MIGRATION"

  assert_eq "report_skip called when nothing modified" "skip" "$REPORT_CALLED"

  teardown
}

# --- Test 12: Counter accuracy — empty workflows dir calls report_skip ---
test_counter_reports_skip_on_empty_workflows() {
  setup

  # No work units at all.
  source "$MIGRATION"

  assert_eq "report_skip on empty workflows" "skip" "$REPORT_CALLED"

  teardown
}

# --- Run all tests ---
echo "Running migration 037 tests..."
echo ""

test_happy_path
test_skip_existing
test_skip_in_progress
test_skip_cancelled
test_idempotent
test_multiple
test_content_preservation
test_no_workflows
test_empty_work_unit
test_counter_reports_update_when_modified
test_counter_reports_skip_when_nothing_to_do
test_counter_reports_skip_on_empty_workflows

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
