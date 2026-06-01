#!/bin/bash
#
# Tests for migration 038: add-inception-phase
#
# Run: bash tests/scripts/test-migration-038.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/038-add-inception-phase.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-038-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Empty epic — no items → no inception phase ---
test_empty_epic() {
  setup

  local wu_dir="$TEST_DIR/.workflows/empty"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "empty",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {}
}
JSON

  source "$MIGRATION"

  local has_inception=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases && m.phases.inception));
  ")
  assert_eq "empty epic: no inception phase added" "false" "$has_inception"

  teardown
}

# --- Test 2: Research items → routing:research, source:migration-seeded ---
test_research_only() {
  setup

  local wu_dir="$TEST_DIR/.workflows/research-only"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "research-only",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "items": {
        "auth": {"status": "completed"},
        "billing": {"status": "in-progress"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local auth_routing=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.routing);
  ")
  assert_eq "research-only: auth routing=research" "research" "$auth_routing"

  local auth_source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.source);
  ")
  assert_eq "research-only: auth source=migration-seeded" "migration-seeded" "$auth_source"

  local auth_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.status);
  ")
  assert_eq "research-only: auth status=in-progress" "in-progress" "$auth_status"

  local has_summary=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('summary' in m.phases.inception.items.auth);
  ")
  assert_eq "research-only: no summary field" "false" "$has_summary"

  teardown
}

# --- Test 3: Discussion items only → routing:discussion, source:migration-seeded ---
test_discussion_only() {
  setup

  local wu_dir="$TEST_DIR/.workflows/disc-only"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "disc-only",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "caching": {"status": "in-progress"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local routing=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.caching.routing);
  ")
  assert_eq "disc-only: routing=discussion" "discussion" "$routing"

  local source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.caching.source);
  ")
  assert_eq "disc-only: source=migration-seeded" "migration-seeded" "$source"

  teardown
}

# --- Test 4: Same topic in both research and discussion → single item, research wins ---
test_research_and_discussion() {
  setup

  local wu_dir="$TEST_DIR/.workflows/both"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "both",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "items": {"auth": {"status": "completed"}}
    },
    "discussion": {
      "items": {"auth": {"status": "in-progress"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local count=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(Object.keys(m.phases.inception.items).length);
  ")
  assert_eq "both: single inception item" "1" "$count"

  local routing=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.routing);
  ")
  assert_eq "both: research wins on dedup" "research" "$routing"

  teardown
}

# --- Test 5: surfaced_topics / gap_topics arrays are NOT migrated ---
test_legacy_arrays_not_migrated() {
  setup

  local wu_dir="$TEST_DIR/.workflows/arrays"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "arrays",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "items": {"auth": {"status": "completed"}},
      "surfaced_topics": ["data-model"]
    },
    "discussion": {
      "items": {},
      "gap_topics": ["error-handling"]
    }
  }
}
JSON

  source "$MIGRATION"

  # Only auth (from research.items) should be migrated
  local count=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(Object.keys(m.phases.inception.items).length);
  ")
  assert_eq "arrays: only research/discussion items migrated" "1" "$count"

  local has_dm=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('data-model' in m.phases.inception.items);
  ")
  assert_eq "arrays: surfaced_topics not migrated" "false" "$has_dm"

  local has_eh=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('error-handling' in m.phases.inception.items);
  ")
  assert_eq "arrays: gap_topics not migrated" "false" "$has_eh"

  # Arrays themselves stay in place (inert legacy data)
  local surf=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(m.phases.research.surfaced_topics));
  ")
  assert_eq "arrays: surfaced_topics preserved" '["data-model"]' "$surf"

  local gaps=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(m.phases.discussion.gap_topics));
  ")
  assert_eq "arrays: gap_topics preserved" '["error-handling"]' "$gaps"

  teardown
}

# --- Test 6: Cross-cutting work unit skipped ---
test_cross_cutting_skipped() {
  setup

  local wu_dir="$TEST_DIR/.workflows/cross"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "cross",
  "work_type": "cross-cutting",
  "status": "in-progress",
  "phases": {
    "research": {"items": {"foo": {"status": "in-progress"}}}
  }
}
JSON

  source "$MIGRATION"

  local has_inception=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases && m.phases.inception));
  ")
  assert_eq "cross-cutting: no inception phase" "false" "$has_inception"

  teardown
}

# --- Test 7: Feature/bugfix/quick-fix all skipped ---
test_non_epic_skipped() {
  setup

  for wt in feature bugfix quick-fix; do
    local name="wu-$wt"
    local wu_dir="$TEST_DIR/.workflows/$name"
    mkdir -p "$wu_dir"
    cat > "$wu_dir/manifest.json" << JSON
{
  "name": "$name",
  "work_type": "$wt",
  "status": "in-progress",
  "phases": {
    "discussion": {"items": {"foo": {"status": "in-progress"}}}
  }
}
JSON
  done

  source "$MIGRATION"

  for wt in feature bugfix quick-fix; do
    local name="wu-$wt"
    local wu_dir="$TEST_DIR/.workflows/$name"
    local has_inception=$(node -e "
      const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
      console.log(!!(m.phases && m.phases.inception));
    ")
    assert_eq "$wt: no inception phase" "false" "$has_inception"
  done

  teardown
}

# --- Test 8: Completed epic skipped ---
test_completed_epic_skipped() {
  setup

  local wu_dir="$TEST_DIR/.workflows/done-epic"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "done-epic",
  "work_type": "epic",
  "status": "completed",
  "phases": {
    "research": {"items": {"foo": {"status": "completed"}}}
  }
}
JSON

  source "$MIGRATION"

  local has_inception=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases && m.phases.inception));
  ")
  assert_eq "completed epic: no inception phase" "false" "$has_inception"

  teardown
}

# --- Test 9: Cancelled epic skipped ---
test_cancelled_epic_skipped() {
  setup

  local wu_dir="$TEST_DIR/.workflows/cancelled-epic"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "cancelled-epic",
  "work_type": "epic",
  "status": "cancelled",
  "phases": {
    "research": {"items": {"foo": {"status": "in-progress"}}}
  }
}
JSON

  source "$MIGRATION"

  local has_inception=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases && m.phases.inception));
  ")
  assert_eq "cancelled epic: no inception phase" "false" "$has_inception"

  teardown
}

# --- Test 10: Partial migration — pre-existing inception item is preserved, missing topic added ---
test_partial_migration_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/partial"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "partial",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "items": {
        "auth": {"status": "completed"},
        "billing": {"status": "in-progress"}
      }
    },
    "inception": {
      "items": {
        "auth": {
          "status": "in-progress",
          "routing": "research",
          "source": "inception",
          "summary": "user-curated summary"
        }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  # auth must not be overwritten — user-curated values preserved
  local auth_source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.source);
  ")
  assert_eq "partial: existing auth source preserved" "inception" "$auth_source"

  local auth_summary=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.auth.summary);
  ")
  assert_eq "partial: existing auth summary preserved" "user-curated summary" "$auth_summary"

  # billing should be added
  local billing_source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.billing.source);
  ")
  assert_eq "partial: billing added with migration-seeded" "migration-seeded" "$billing_source"

  teardown
}

# --- Test 11: Re-run on fully-migrated epic is a no-op ---
test_full_rerun_noop() {
  setup

  local wu_dir="$TEST_DIR/.workflows/full"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "full",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {"items": {"auth": {"status": "completed"}}}
  }
}
JSON

  source "$MIGRATION"
  local first_manifest=$(cat "$wu_dir/manifest.json")
  local first_session=$(cat "$wu_dir/inception/session-001.md")

  source "$MIGRATION"
  local second_manifest=$(cat "$wu_dir/manifest.json")
  local second_session=$(cat "$wu_dir/inception/session-001.md")

  assert_eq "rerun: manifest byte-identical" "$first_manifest" "$second_manifest"
  assert_eq "rerun: session-001 byte-identical" "$first_session" "$second_session"

  teardown
}

# --- Test 12: session-001.md back-filled when missing ---
test_session_back_fill() {
  setup

  local wu_dir="$TEST_DIR/.workflows/sess"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "sess",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {"items": {"auth": {"status": "completed"}}},
    "discussion": {"items": {"caching": {"status": "in-progress"}}}
  }
}
JSON

  source "$MIGRATION"

  assert_eq "session: file created" "true" "$([ -f "$wu_dir/inception/session-001.md" ] && echo true || echo false)"

  local content
  content=$(cat "$wu_dir/inception/session-001.md")
  assert_eq "session: contains migration heading" "true" "$(echo "$content" | grep -qF -- 'Initial Framing — Pre-Inception Migration' && echo true || echo false)"
  assert_eq "session: counts items" "true" "$(echo "$content" | grep -qF -- '2 topic(s) found in existing research/discussion items' && echo true || echo false)"
  assert_eq "session: mentions workflow-start" "true" "$(echo "$content" | grep -qF -- '/workflow-start' && echo true || echo false)"

  teardown
}

# --- Test 13: Pre-existing session-001.md content unchanged ---
test_session_preserved() {
  setup

  local wu_dir="$TEST_DIR/.workflows/has-sess"
  mkdir -p "$wu_dir/inception"
  cat > "$wu_dir/inception/session-001.md" << 'MD'
# Custom Session

The user wrote this. Do not touch.
MD

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "has-sess",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {"items": {"auth": {"status": "in-progress"}}}
  }
}
JSON

  source "$MIGRATION"

  local content
  content=$(cat "$wu_dir/inception/session-001.md")
  assert_eq "preserved: starts with custom heading" "true" "$(echo "$content" | grep -qF -- '# Custom Session' && echo true || echo false)"
  assert_eq "preserved: no migration heading" "false" "$(echo "$content" | grep -qF -- 'Pre-Inception Migration' && echo true || echo false)"

  teardown
}

# --- Test 14: Legacy 'exploration' topic preserved as research-routed inception item ---
test_legacy_exploration() {
  setup

  local wu_dir="$TEST_DIR/.workflows/legacy"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "legacy",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {"items": {"exploration": {"status": "completed"}}}
  }
}
JSON

  source "$MIGRATION"

  local routing=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.exploration.routing);
  ")
  assert_eq "legacy: exploration routing=research" "research" "$routing"

  local source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.inception.items.exploration.source);
  ")
  assert_eq "legacy: exploration source=migration-seeded" "migration-seeded" "$source"

  teardown
}

# --- Run all tests ---
echo "Running migration 038 tests..."
echo ""

test_empty_epic
test_research_only
test_discussion_only
test_research_and_discussion
test_legacy_arrays_not_migrated
test_cross_cutting_skipped
test_non_epic_skipped
test_completed_epic_skipped
test_cancelled_epic_skipped
test_partial_migration_idempotent
test_full_rerun_noop
test_session_back_fill
test_session_preserved
test_legacy_exploration

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
