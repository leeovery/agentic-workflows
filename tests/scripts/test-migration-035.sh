#!/bin/bash
#
# Tests for migration 035: Remove phase-level format, project_skills, and linters
#
# Run: bash tests/scripts/test-migration-035.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/035-phase-to-project-defaults.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-035-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Happy path — all phase-level keys removed ---
test_happy_path() {
  setup

  mkdir -p "$TEST_DIR/.workflows/alpha"
  cat > "$TEST_DIR/.workflows/alpha/manifest.json" <<'JSON'
{
  "name": "alpha",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "format": "local-markdown",
      "items": { "alpha": { "status": "completed", "format": "local-markdown" } }
    },
    "implementation": {
      "project_skills": [".claude/skills/golang-pro"],
      "linters": [{"name": "eslint", "command": "npx eslint"}],
      "items": { "alpha": { "status": "in-progress", "project_skills": [".claude/skills/golang-pro"] } }
    }
  }
}
JSON

  source "$MIGRATION"

  # Phase-level keys should be removed
  local has_format
  has_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "planning format removed" "true" "$has_format"

  local has_skills
  has_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.implementation.project_skills === undefined)")
  assert_eq "implementation project_skills removed" "true" "$has_skills"

  local has_linters
  has_linters=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.implementation.linters === undefined)")
  assert_eq "implementation linters removed" "true" "$has_linters"

  # Topic-level values should be preserved
  local topic_format
  topic_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.planning.items.alpha.format)")
  assert_eq "topic format preserved" "local-markdown" "$topic_format"

  local topic_skills
  topic_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(JSON.stringify(m.phases.implementation.items.alpha.project_skills))")
  assert_eq "topic project_skills preserved" '[".claude/skills/golang-pro"]' "$topic_skills"

  teardown
}

# --- Test 2: No-op — no phase-level keys to remove ---
test_noop() {
  setup

  mkdir -p "$TEST_DIR/.workflows/beta"
  cat > "$TEST_DIR/.workflows/beta/manifest.json" <<'JSON'
{
  "name": "beta",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": { "topic-a": { "status": "completed", "format": "tick" } }
    }
  }
}
JSON

  local before
  before=$(cat "$TEST_DIR/.workflows/beta/manifest.json")

  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/beta/manifest.json")

  assert_eq "manifest unchanged" "$before" "$after"

  teardown
}

# --- Test 3: Idempotent — run twice, same result ---
test_idempotent() {
  setup

  mkdir -p "$TEST_DIR/.workflows/gamma"
  cat > "$TEST_DIR/.workflows/gamma/manifest.json" <<'JSON'
{
  "name": "gamma",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "format": "tick",
      "items": { "gamma": { "status": "in-progress" } }
    }
  }
}
JSON

  source "$MIGRATION"

  local after_first
  after_first=$(cat "$TEST_DIR/.workflows/gamma/manifest.json")

  source "$MIGRATION"

  local after_second
  after_second=$(cat "$TEST_DIR/.workflows/gamma/manifest.json")

  assert_eq "idempotent" "$after_first" "$after_second"

  local has_format
  has_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/gamma/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "format still removed after second run" "true" "$has_format"

  teardown
}

# --- Test 4: Multiple work units — all phase keys removed ---
test_multiple_work_units() {
  setup

  mkdir -p "$TEST_DIR/.workflows/first"
  cat > "$TEST_DIR/.workflows/first/manifest.json" <<'JSON'
{
  "name": "first",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "planning": { "format": "local-markdown", "items": {} }
  }
}
JSON

  mkdir -p "$TEST_DIR/.workflows/second"
  cat > "$TEST_DIR/.workflows/second/manifest.json" <<'JSON'
{
  "name": "second",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": { "format": "tick", "items": {} },
    "implementation": { "linters": [], "items": {} }
  }
}
JSON

  source "$MIGRATION"

  local first_removed
  first_removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/first/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "first phase format removed" "true" "$first_removed"

  local second_format_removed
  second_format_removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/second/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "second phase format removed" "true" "$second_format_removed"

  local second_linters_removed
  second_linters_removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/second/manifest.json','utf8')); console.log(m.phases.implementation.linters === undefined)")
  assert_eq "second phase linters removed" "true" "$second_linters_removed"

  teardown
}

# --- Test 5: Other phase fields preserved ---
test_content_preservation() {
  setup

  mkdir -p "$TEST_DIR/.workflows/delta"
  cat > "$TEST_DIR/.workflows/delta/manifest.json" <<'JSON'
{
  "name": "delta",
  "work_type": "feature",
  "status": "in-progress",
  "description": "Test delta",
  "phases": {
    "planning": {
      "format": "tick",
      "items": { "delta": { "status": "completed", "format": "tick", "spec_commit": "abc123" } }
    },
    "research": {
      "analysis_cache": { "checksum": "abc", "generated": "2025-01-01" }
    }
  }
}
JSON

  source "$MIGRATION"

  # Phase-level format removed
  local has_format
  has_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/delta/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "phase format removed" "true" "$has_format"

  # Topic-level fields preserved
  local spec_commit
  spec_commit=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/delta/manifest.json','utf8')); console.log(m.phases.planning.items.delta.spec_commit)")
  assert_eq "spec_commit preserved" "abc123" "$spec_commit"

  # analysis_cache preserved (not a phase-level default)
  local cache
  cache=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/delta/manifest.json','utf8')); console.log(m.phases.research.analysis_cache.checksum)")
  assert_eq "analysis_cache preserved" "abc" "$cache"

  # Work unit fields preserved
  local desc
  desc=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/delta/manifest.json','utf8')); console.log(m.description)")
  assert_eq "description preserved" "Test delta" "$desc"

  teardown
}

# --- Test 6: No workflows dir ---
test_no_workflows() {
  TEST_DIR=$(mktemp -d /tmp/migration-035-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"

  source "$MIGRATION"

  assert_eq "no crash" "true" "true"

  teardown
}

# --- Test 7: Dot-prefixed directories skipped ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  mkdir -p "$TEST_DIR/.workflows/.cache"
  mkdir -p "$TEST_DIR/.workflows/real"
  cat > "$TEST_DIR/.workflows/real/manifest.json" <<'JSON'
{
  "name": "real",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": { "format": "tick", "items": {} }
  }
}
JSON

  source "$MIGRATION"

  local removed
  removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/real/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "real work unit processed" "true" "$removed"

  teardown
}

# --- Run all tests ---
echo "Running migration 035 tests..."
echo ""

test_happy_path
test_noop
test_idempotent
test_multiple_work_units
test_content_preservation
test_no_workflows
test_skips_dot_dirs

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
