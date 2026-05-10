#!/bin/bash
#
# Tests for migration 038: drop surfaced_topics and gap_topics from manifests
#
# Run: bash tests/scripts/test-migration-038.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/038-drop-surfaced-and-gap-topics.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-038-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
  REPORT_CALLED=""
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Happy path — surfaced_topics deleted ---
test_drop_surfaced_topics() {
  setup

  mkdir -p "$TEST_DIR/.workflows/alpha"
  cat > "$TEST_DIR/.workflows/alpha/manifest.json" <<'JSON'
{
  "name": "alpha",
  "work_type": "epic",
  "phases": {
    "research": {
      "surfaced_topics": ["auth", "billing"],
      "analysis_cache": { "checksum": "abc", "generated": "2026-01-01" }
    }
  }
}
JSON

  source "$MIGRATION"

  local has_field
  has_field=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.research, 'surfaced_topics'))")
  assert_eq "surfaced_topics deleted" "false" "$has_field"

  local cache_intact
  cache_intact=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.research.analysis_cache.checksum)")
  assert_eq "analysis_cache preserved" "abc" "$cache_intact"

  assert_eq "report_update called" "update" "$REPORT_CALLED"

  teardown
}

# --- Test 2: Happy path — gap_topics deleted ---
test_drop_gap_topics() {
  setup

  mkdir -p "$TEST_DIR/.workflows/beta"
  cat > "$TEST_DIR/.workflows/beta/manifest.json" <<'JSON'
{
  "name": "beta",
  "work_type": "epic",
  "phases": {
    "discussion": {
      "gap_topics": ["integration", "caching"],
      "gap_analysis_cache": { "checksum": "xyz" }
    }
  }
}
JSON

  source "$MIGRATION"

  local has_field
  has_field=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/beta/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.discussion, 'gap_topics'))")
  assert_eq "gap_topics deleted" "false" "$has_field"

  local cache_intact
  cache_intact=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/beta/manifest.json','utf8')); console.log(m.phases.discussion.gap_analysis_cache.checksum)")
  assert_eq "gap_analysis_cache preserved" "xyz" "$cache_intact"

  teardown
}

# --- Test 3: Happy path — both fields deleted in same manifest ---
test_drop_both_fields() {
  setup

  mkdir -p "$TEST_DIR/.workflows/gamma"
  cat > "$TEST_DIR/.workflows/gamma/manifest.json" <<'JSON'
{
  "name": "gamma",
  "work_type": "epic",
  "phases": {
    "research": { "surfaced_topics": ["t1"] },
    "discussion": { "gap_topics": ["g1"] }
  }
}
JSON

  source "$MIGRATION"

  local r_has g_has
  r_has=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/gamma/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.research, 'surfaced_topics'))")
  g_has=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/gamma/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.discussion, 'gap_topics'))")
  assert_eq "surfaced_topics deleted" "false" "$r_has"
  assert_eq "gap_topics deleted" "false" "$g_has"

  teardown
}

# --- Test 4: No-op when fields are absent ---
test_noop_when_absent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/delta"
  cat > "$TEST_DIR/.workflows/delta/manifest.json" <<'JSON'
{
  "name": "delta",
  "work_type": "epic",
  "phases": {
    "research": { "analysis_cache": { "checksum": "abc" } },
    "discussion": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  local before
  before=$(cat "$TEST_DIR/.workflows/delta/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/delta/manifest.json")
  assert_eq "manifest unchanged when fields absent" "$before" "$after"
  assert_eq "report_update not called when no-op" "" "$REPORT_CALLED"

  teardown
}

# --- Test 5: Idempotent ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/echo"
  cat > "$TEST_DIR/.workflows/echo/manifest.json" <<'JSON'
{
  "name": "echo",
  "work_type": "epic",
  "phases": {
    "research": { "surfaced_topics": ["t1"], "analysis_cache": { "checksum": "abc" } },
    "discussion": { "gap_topics": ["g1"] }
  }
}
JSON

  source "$MIGRATION"
  local after_first
  after_first=$(cat "$TEST_DIR/.workflows/echo/manifest.json")

  source "$MIGRATION"
  local after_second
  after_second=$(cat "$TEST_DIR/.workflows/echo/manifest.json")

  assert_eq "idempotent" "$after_first" "$after_second"

  teardown
}

# --- Test 6: Content preservation — other fields and phases intact ---
test_content_preservation() {
  setup

  mkdir -p "$TEST_DIR/.workflows/foxtrot"
  cat > "$TEST_DIR/.workflows/foxtrot/manifest.json" <<'JSON'
{
  "name": "foxtrot",
  "work_type": "epic",
  "status": "in-progress",
  "description": "Important project",
  "custom_field": 42,
  "phases": {
    "inception": { "items": { "topic-a": { "status": "in-progress", "summary": "s", "routing": "research", "source": "inception" } } },
    "research": {
      "surfaced_topics": ["legacy"],
      "items": { "topic-a": { "status": "completed" } },
      "analysis_cache": { "checksum": "abc", "generated": "2026-01-01", "files": ["topic-a.md"] }
    },
    "discussion": {
      "gap_topics": ["legacy-gap"],
      "items": { "topic-b": { "status": "in-progress" } },
      "gap_analysis_cache": { "checksum": "xyz", "discussion_files": ["topic-b.md"] }
    }
  }
}
JSON

  source "$MIGRATION"

  local desc custom inception_summary research_item discussion_item cache_files gap_files
  desc=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.description)")
  custom=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.custom_field)")
  inception_summary=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.phases.inception.items['topic-a'].summary)")
  research_item=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.phases.research.items['topic-a'].status)")
  discussion_item=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(m.phases.discussion.items['topic-b'].status)")
  cache_files=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(JSON.stringify(m.phases.research.analysis_cache.files))")
  gap_files=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/foxtrot/manifest.json','utf8')); console.log(JSON.stringify(m.phases.discussion.gap_analysis_cache.discussion_files))")

  assert_eq "description preserved" "Important project" "$desc"
  assert_eq "custom_field preserved" "42" "$custom"
  assert_eq "inception item preserved" "s" "$inception_summary"
  assert_eq "research item preserved" "completed" "$research_item"
  assert_eq "discussion item preserved" "in-progress" "$discussion_item"
  assert_eq "analysis_cache.files preserved" '["topic-a.md"]' "$cache_files"
  assert_eq "gap_analysis_cache.discussion_files preserved" '["topic-b.md"]' "$gap_files"

  teardown
}

# --- Test 7: Multiple work units — only those with fields modified ---
test_multiple_work_units() {
  setup

  mkdir -p "$TEST_DIR/.workflows/with-fields"
  cat > "$TEST_DIR/.workflows/with-fields/manifest.json" <<'JSON'
{ "name": "with-fields", "work_type": "epic", "phases": { "research": { "surfaced_topics": ["x"] } } }
JSON

  mkdir -p "$TEST_DIR/.workflows/no-fields"
  cat > "$TEST_DIR/.workflows/no-fields/manifest.json" <<'JSON'
{ "name": "no-fields", "work_type": "epic", "phases": { "research": { "items": { "y": { "status": "completed" } } } } }
JSON

  local no_fields_before
  no_fields_before=$(cat "$TEST_DIR/.workflows/no-fields/manifest.json")

  source "$MIGRATION"

  local with_has
  with_has=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/with-fields/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.research, 'surfaced_topics'))")
  assert_eq "with-fields cleared" "false" "$with_has"

  local no_fields_after
  no_fields_after=$(cat "$TEST_DIR/.workflows/no-fields/manifest.json")
  assert_eq "no-fields unchanged" "$no_fields_before" "$no_fields_after"

  teardown
}

# --- Test 8: Skips dot-prefixed dirs ---
test_skips_dot_prefixed() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.cache"
  cat > "$TEST_DIR/.workflows/.cache/manifest.json" <<'JSON'
{ "phases": { "research": { "surfaced_topics": ["should-stay"] } } }
JSON

  source "$MIGRATION"

  local has_field
  has_field=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/.cache/manifest.json','utf8')); console.log(Object.prototype.hasOwnProperty.call(m.phases.research, 'surfaced_topics'))")
  assert_eq "dot-prefixed dir skipped" "true" "$has_field"

  teardown
}

# --- Test 9: No workflows dir ---
test_no_workflows_dir() {
  TEST_DIR=$(mktemp -d /tmp/migration-038-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  REPORT_CALLED=""

  source "$MIGRATION"

  assert_eq "no crash when workflows dir missing" "true" "true"

  teardown
}

# --- Run all tests ---
echo "Running migration 038 tests..."
echo ""

test_drop_surfaced_topics
test_drop_gap_topics
test_drop_both_fields
test_noop_when_absent
test_idempotent
test_content_preservation
test_multiple_work_units
test_skips_dot_prefixed
test_no_workflows_dir

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
