#!/bin/bash
#
# Tests for migration 041: split the overloaded analysis_cycle counter
#
# Run: bash tests/scripts/test-migration-041.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/041-split-analysis-cycle-counter.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-041-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

field() {
  # $1 = manifest path, $2 = topic, $3 = field
  node -e "
    const m = JSON.parse(require('fs').readFileSync('$1', 'utf8'));
    const it = m.phases.implementation.items['$2'];
    const v = it && Object.prototype.hasOwnProperty.call(it, '$3') ? it['$3'] : 'missing';
    console.log(v);
  "
}

# --- Test 1: analysis_cycle renamed to total, session seeded to 0 ---
test_happy_path() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-a"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-a",
  "work_type": "feature",
  "phases": {
    "implementation": {
      "items": {
        "feat-a": { "status": "in-progress", "analysis_cycle": 5, "fix_attempts": 0 }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "analysis_cycle removed" "missing" "$(field "$wu_dir/manifest.json" feat-a analysis_cycle)"
  assert_eq "total seeded from old value" "5" "$(field "$wu_dir/manifest.json" feat-a analysis_cycle_total)"
  assert_eq "session seeded to 0" "0" "$(field "$wu_dir/manifest.json" feat-a analysis_cycle_session)"
  assert_eq "sibling field preserved" "0" "$(field "$wu_dir/manifest.json" feat-a fix_attempts)"

  teardown
}

# --- Test 2: zero-valued analysis_cycle migrates correctly ---
test_zero_value() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-z"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-z",
  "phases": { "implementation": { "items": { "feat-z": { "analysis_cycle": 0 } } } }
}
JSON

  source "$MIGRATION"

  assert_eq "analysis_cycle removed" "missing" "$(field "$wu_dir/manifest.json" feat-z analysis_cycle)"
  assert_eq "total seeded to 0" "0" "$(field "$wu_dir/manifest.json" feat-z analysis_cycle_total)"
  assert_eq "session seeded to 0" "0" "$(field "$wu_dir/manifest.json" feat-z analysis_cycle_session)"

  teardown
}

# --- Test 3: epic with multiple implementation topics ---
test_multiple_topics() {
  setup
  local wu_dir="$TEST_DIR/.workflows/epic-m"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-m",
  "work_type": "epic",
  "phases": {
    "implementation": {
      "items": {
        "topic-one": { "analysis_cycle": 2 },
        "topic-two": { "analysis_cycle": 7 }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "topic-one total" "2" "$(field "$wu_dir/manifest.json" topic-one analysis_cycle_total)"
  assert_eq "topic-one session" "0" "$(field "$wu_dir/manifest.json" topic-one analysis_cycle_session)"
  assert_eq "topic-two total" "7" "$(field "$wu_dir/manifest.json" topic-two analysis_cycle_total)"
  assert_eq "topic-two session" "0" "$(field "$wu_dir/manifest.json" topic-two analysis_cycle_session)"

  teardown
}

# --- Test 4: idempotent (run twice, same result) ---
test_idempotent() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-i"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-i",
  "phases": { "implementation": { "items": { "feat-i": { "analysis_cycle": 4 } } } }
}
JSON

  source "$MIGRATION"
  # Simulate session having advanced before a second migration run.
  node -e "
    const p = '$wu_dir/manifest.json';
    const m = JSON.parse(require('fs').readFileSync(p, 'utf8'));
    m.phases.implementation.items['feat-i'].analysis_cycle_session = 2;
    require('fs').writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  "
  source "$MIGRATION"

  assert_eq "analysis_cycle still absent" "missing" "$(field "$wu_dir/manifest.json" feat-i analysis_cycle)"
  assert_eq "total unchanged" "4" "$(field "$wu_dir/manifest.json" feat-i analysis_cycle_total)"
  assert_eq "session not clobbered on re-run" "2" "$(field "$wu_dir/manifest.json" feat-i analysis_cycle_session)"

  teardown
}

# --- Test 5: no-op when already migrated ---
test_already_migrated() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-done"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-done",
  "phases": {
    "implementation": {
      "items": { "feat-done": { "analysis_cycle_total": 3, "analysis_cycle_session": 1 } }
    }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "total preserved" "3" "$(field "$wu_dir/manifest.json" feat-done analysis_cycle_total)"
  assert_eq "session preserved" "1" "$(field "$wu_dir/manifest.json" feat-done analysis_cycle_session)"
  assert_eq "no analysis_cycle introduced" "missing" "$(field "$wu_dir/manifest.json" feat-done analysis_cycle)"

  teardown
}

# --- Test 6: partial prior run (total present, session missing) ---
test_partial_adds_session() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-partial"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-partial",
  "phases": {
    "implementation": { "items": { "feat-partial": { "analysis_cycle_total": 6 } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "total preserved" "6" "$(field "$wu_dir/manifest.json" feat-partial analysis_cycle_total)"
  assert_eq "session backfilled to 0" "0" "$(field "$wu_dir/manifest.json" feat-partial analysis_cycle_session)"

  teardown
}

# --- Test 7: completed impl (stored 0) infers total from on-disk files ---
test_infers_total_from_disk() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-c"
  local impl_dir="$wu_dir/implementation/feat-c"
  mkdir -p "$impl_dir"
  # conclude-implementation reset the old counter to 0, but 5 cycles ran.
  for n in 1 2 3 4 5; do
    touch "$impl_dir/analysis-duplication-c$n.md"
    touch "$impl_dir/analysis-standards-c$n.md"
    touch "$impl_dir/analysis-architecture-c$n.md"
  done
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-c",
  "phases": { "implementation": { "items": { "feat-c": { "status": "completed", "analysis_cycle": 0 } } } }
}
JSON

  source "$MIGRATION"

  assert_eq "total inferred from disk max" "5" "$(field "$wu_dir/manifest.json" feat-c analysis_cycle_total)"
  assert_eq "session seeded to 0" "0" "$(field "$wu_dir/manifest.json" feat-c analysis_cycle_session)"

  teardown
}

# --- Test 8: disk max beats a lower stored value ---
test_disk_max_beats_stored() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-d"
  local impl_dir="$wu_dir/implementation/feat-d"
  mkdir -p "$impl_dir"
  for n in 1 2 3 4; do touch "$impl_dir/analysis-standards-c$n.md"; done
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-d",
  "phases": { "implementation": { "items": { "feat-d": { "analysis_cycle": 2 } } } }
}
JSON

  source "$MIGRATION"

  assert_eq "disk max (4) beats stored (2)" "4" "$(field "$wu_dir/manifest.json" feat-d analysis_cycle_total)"

  teardown
}

# --- Test 9: stored beats disk when a cycle bumped but never wrote files ---
test_stored_beats_disk() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-s"
  local impl_dir="$wu_dir/implementation/feat-s"
  mkdir -p "$impl_dir"
  for n in 1 2 3 4 5; do touch "$impl_dir/analysis-architecture-c$n.md"; done
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-s",
  "phases": { "implementation": { "items": { "feat-s": { "analysis_cycle": 6 } } } }
}
JSON

  source "$MIGRATION"

  assert_eq "stored (6) beats disk max (5)" "6" "$(field "$wu_dir/manifest.json" feat-s analysis_cycle_total)"

  teardown
}

# --- Test 10: no implementation phase → untouched ---
test_no_implementation_phase() {
  setup
  local wu_dir="$TEST_DIR/.workflows/feat-early"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-early",
  "phases": { "discussion": { "items": { "feat-early": { "status": "in-progress" } } } }
}
JSON

  source "$MIGRATION"

  local has_impl=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!m.phases.implementation);
  ")
  assert_eq "implementation phase not created" "false" "$has_impl"

  teardown
}

test_happy_path
test_zero_value
test_multiple_topics
test_idempotent
test_already_migrated
test_partial_adds_session
test_infers_total_from_disk
test_disk_max_beats_stored
test_stored_beats_disk
test_no_implementation_phase

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
