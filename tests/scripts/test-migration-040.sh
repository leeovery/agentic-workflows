#!/bin/bash
#
# Tests for migration 040: rename inception phase to discovery
#
# Run: bash tests/scripts/test-migration-040.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/040-rename-inception-to-discovery.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-040-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: phases.inception renamed to phases.discovery ---
test_phase_renamed() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-a"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-a",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {"foo": {"source": "inception", "summary": "x"}},
      "dismissed": ["bar"],
      "active_session": "002",
      "gap_analysis_cache": {"checksum": "abc"}
    }
  }
}
JSON

  source "$MIGRATION"

  local has_old=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception));
  ")
  assert_eq "phases.inception removed" "false" "$has_old"

  local has_new=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.discovery));
  ")
  assert_eq "phases.discovery created" "true" "$has_new"

  local items_preserved=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.foo.summary === 'x');
  ")
  assert_eq "items subtree preserved" "true" "$items_preserved"

  local dismissed_preserved=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(m.phases.discovery.dismissed) === '[\"bar\"]');
  ")
  assert_eq "dismissed preserved" "true" "$dismissed_preserved"

  local active_preserved=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.active_session === '002');
  ")
  assert_eq "active_session preserved" "true" "$active_preserved"

  local cache_preserved=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.gap_analysis_cache.checksum === 'abc');
  ")
  assert_eq "gap_analysis_cache preserved" "true" "$cache_preserved"

  teardown
}

# --- Test 2: source values 'inception' → 'discovery' (single) ---
test_source_single() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-b"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-b",
  "work_type": "epic",
  "phases": {
    "inception": {
      "items": {
        "foo": {"source": "inception"},
        "bar": {"source": "research-analysis"},
        "baz": {"source": "migration-seeded"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local foo_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.foo.source);
  ")
  assert_eq "source 'inception' → 'discovery'" "discovery" "$foo_src"

  local bar_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.bar.source);
  ")
  assert_eq "source 'research-analysis' unchanged" "research-analysis" "$bar_src"

  local baz_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.baz.source);
  ")
  assert_eq "source 'migration-seeded' unchanged" "migration-seeded" "$baz_src"

  teardown
}

# --- Test 3: multi-source comma-accumulated values ---
test_source_multi() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-c"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-c",
  "work_type": "epic",
  "phases": {
    "inception": {
      "items": {
        "foo": {"source": "inception,research-analysis"},
        "bar": {"source": "research-analysis,inception"},
        "baz": {"source": "inception,gap-analysis"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local foo_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.foo.source);
  ")
  assert_eq "multi-source prefix rewritten" "discovery,research-analysis" "$foo_src"

  local bar_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.bar.source);
  ")
  assert_eq "multi-source suffix rewritten" "research-analysis,discovery" "$bar_src"

  local baz_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.discovery.items.baz.source);
  ")
  assert_eq "multi-source pair rewritten" "discovery,gap-analysis" "$baz_src"

  teardown
}

# --- Test 4: inception/ directory renamed to discovery/ ---
test_directory_renamed() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-d"
  mkdir -p "$wu_dir/inception"
  echo "log" > "$wu_dir/inception/session-001.md"
  cat > "$wu_dir/manifest.json" << 'JSON'
{"name": "epic-d", "work_type": "epic", "phases": {}}
JSON

  source "$MIGRATION"

  local old_gone="true"
  [ -d "$wu_dir/inception" ] && old_gone="false"
  assert_eq "inception/ removed" "true" "$old_gone"

  local new_exists="false"
  [ -d "$wu_dir/discovery" ] && new_exists="true"
  assert_eq "discovery/ created" "true" "$new_exists"

  local session_preserved="false"
  [ -f "$wu_dir/discovery/session-001.md" ] && session_preserved="true"
  assert_eq "session log moved" "true" "$session_preserved"

  teardown
}

# --- Test 5: state cache file renamed ---
test_state_file_renamed() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-e"
  mkdir -p "$wu_dir/.state"
  echo "# gap analysis" > "$wu_dir/.state/inception-gap-analysis.md"
  cat > "$wu_dir/manifest.json" << 'JSON'
{"name": "epic-e", "work_type": "epic", "phases": {}}
JSON

  source "$MIGRATION"

  local old_gone="true"
  [ -f "$wu_dir/.state/inception-gap-analysis.md" ] && old_gone="false"
  assert_eq "old state file removed" "true" "$old_gone"

  local new_exists="false"
  [ -f "$wu_dir/.state/discovery-gap-analysis.md" ] && new_exists="true"
  assert_eq "new state file created" "true" "$new_exists"

  teardown
}

# --- Test 6: Idempotent — runs twice safely ---
test_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-f"
  mkdir -p "$wu_dir/inception"
  echo "log" > "$wu_dir/inception/session-001.md"
  mkdir -p "$wu_dir/.state"
  echo "# gap" > "$wu_dir/.state/inception-gap-analysis.md"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-f",
  "work_type": "epic",
  "phases": {
    "inception": {"items": {"foo": {"source": "inception"}}}
  }
}
JSON

  source "$MIGRATION"
  local after_first=$(cat "$wu_dir/manifest.json")

  source "$MIGRATION"
  local after_second=$(cat "$wu_dir/manifest.json")

  assert_eq "idempotent manifest" "true" "$([ "$after_first" = "$after_second" ] && echo true || echo false)"

  local new_dir_exists="false"
  [ -d "$wu_dir/discovery" ] && new_dir_exists="true"
  assert_eq "directory still present after rerun" "true" "$new_dir_exists"

  teardown
}

# --- Test 7: no inception phase — no-op ---
test_noop_when_absent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-g"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-g",
  "work_type": "epic",
  "phases": {"discussion": {"items": {}}}
}
JSON

  local before=$(cat "$wu_dir/manifest.json")
  source "$MIGRATION"
  local after=$(cat "$wu_dir/manifest.json")

  assert_eq "no-op when no inception field" "true" "$([ "$before" = "$after" ] && echo true || echo false)"

  teardown
}

# --- Test 8: phases.discovery already exists (partial prior run) — no clobber ---
# A shallow Object.assign would let discovery's items overwrite inception's,
# silently dropping inception's items (here: foo). The fix skips the merge when
# discovery already exists, leaving both phases intact for the admin to
# reconcile — no data loss either way.
test_partial_already_migrated() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-h"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-h",
  "work_type": "epic",
  "phases": {
    "inception": {"items": {"foo": {"source": "inception"}}},
    "discovery": {"items": {"bar": {"source": "discovery"}}}
  }
}
JSON

  source "$MIGRATION"

  local has_inception=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!m.phases.inception);
  ")
  assert_eq "inception left in place (not clobbered)" "true" "$has_inception"

  local foo_survives=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception && m.phases.inception.items && m.phases.inception.items.foo));
  ")
  assert_eq "inception item 'foo' survives (no data loss)" "true" "$foo_survives"

  local bar_survives=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.discovery && m.phases.discovery.items && m.phases.discovery.items.bar));
  ")
  assert_eq "discovery item 'bar' survives" "true" "$bar_survives"

  teardown
}

test_phase_renamed
test_source_single
test_source_multi
test_directory_renamed
test_state_file_renamed
test_idempotent
test_noop_when_absent
test_partial_already_migrated

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
