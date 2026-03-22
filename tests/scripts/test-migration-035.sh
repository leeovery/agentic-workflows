#!/bin/bash
#
# Tests for migration 035: Move phase-level format and project_skills to project defaults
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

# --- Test 1: Happy path — phase-level values migrated to project defaults ---
test_happy_path() {
  setup

  # Create project manifest
  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "alpha": { "work_type": "feature" }
  }
}
JSON

  # Create work unit manifest with phase-level format and project_skills
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
      "items": { "alpha": { "status": "in-progress", "project_skills": [".claude/skills/golang-pro"] } }
    }
  }
}
JSON

  source "$MIGRATION"

  # Project defaults should be set
  local proj_format
  proj_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(m.defaults.plan_format)")
  assert_eq "project default plan_format" "local-markdown" "$proj_format"

  local proj_skills
  proj_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(JSON.stringify(m.defaults.project_skills))")
  assert_eq "project default project_skills" '[".claude/skills/golang-pro"]' "$proj_skills"

  # Phase-level keys should be removed
  local has_planning_format
  has_planning_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "planning format removed" "true" "$has_planning_format"

  local has_impl_skills
  has_impl_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.implementation.project_skills === undefined)")
  assert_eq "implementation project_skills removed" "true" "$has_impl_skills"

  # Topic-level values should be preserved
  local topic_format
  topic_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(m.phases.planning.items.alpha.format)")
  assert_eq "topic format preserved" "local-markdown" "$topic_format"

  local topic_skills
  topic_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/alpha/manifest.json','utf8')); console.log(JSON.stringify(m.phases.planning.items.alpha.status))")
  assert_eq "topic status preserved" '"completed"' "$topic_skills"

  teardown
}

# --- Test 2: No-op — no phase-level keys to migrate ---
test_noop() {
  setup

  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "beta": { "work_type": "epic" }
  }
}
JSON

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

  source "$MIGRATION"

  # No defaults should be created
  local has_defaults
  has_defaults=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(m.defaults === undefined)")
  assert_eq "no defaults created" "true" "$has_defaults"

  teardown
}

# --- Test 3: Idempotent — run twice, same result ---
test_idempotent() {
  setup

  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "gamma": { "work_type": "feature" }
  }
}
JSON

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
  source "$MIGRATION"

  local proj_format
  proj_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(m.defaults.plan_format)")
  assert_eq "idempotent project default" "tick" "$proj_format"

  local has_planning_format
  has_planning_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/gamma/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "idempotent phase format removed" "true" "$has_planning_format"

  teardown
}

# --- Test 4: Multiple work units — first value wins, all phase keys removed ---
test_multiple_work_units() {
  setup

  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "first": { "work_type": "feature" },
    "second": { "work_type": "feature" }
  }
}
JSON

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
    "planning": { "format": "tick", "items": {} }
  }
}
JSON

  source "$MIGRATION"

  # First value wins
  local proj_format
  proj_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(m.defaults.plan_format)")
  assert_eq "first value wins" "local-markdown" "$proj_format"

  # Both phase-level keys removed
  local first_removed
  first_removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/first/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "first phase format removed" "true" "$first_removed"

  local second_removed
  second_removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/second/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "second phase format removed" "true" "$second_removed"

  teardown
}

# --- Test 5: Existing project defaults not overwritten ---
test_existing_defaults_preserved() {
  setup

  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "delta": { "work_type": "feature" }
  },
  "defaults": {
    "plan_format": "linear"
  }
}
JSON

  mkdir -p "$TEST_DIR/.workflows/delta"
  cat > "$TEST_DIR/.workflows/delta/manifest.json" <<'JSON'
{
  "name": "delta",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": { "format": "tick", "items": {} }
  }
}
JSON

  source "$MIGRATION"

  # Existing default preserved
  local proj_format
  proj_format=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(m.defaults.plan_format)")
  assert_eq "existing default preserved" "linear" "$proj_format"

  # Phase-level key still removed
  local removed
  removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/delta/manifest.json','utf8')); console.log(m.phases.planning.format === undefined)")
  assert_eq "phase format still removed" "true" "$removed"

  teardown
}

# --- Test 6: Empty project_skills array handled correctly ---
test_empty_skills_array() {
  setup

  cat > "$TEST_DIR/.workflows/manifest.json" <<'JSON'
{
  "work_units": {
    "epsilon": { "work_type": "feature" }
  }
}
JSON

  mkdir -p "$TEST_DIR/.workflows/epsilon"
  cat > "$TEST_DIR/.workflows/epsilon/manifest.json" <<'JSON'
{
  "name": "epsilon",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": { "project_skills": [], "items": {} }
  }
}
JSON

  source "$MIGRATION"

  local proj_skills
  proj_skills=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json','utf8')); console.log(JSON.stringify(m.defaults.project_skills))")
  assert_eq "empty array migrated" "[]" "$proj_skills"

  local removed
  removed=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/epsilon/manifest.json','utf8')); console.log(m.phases.implementation.project_skills === undefined)")
  assert_eq "empty array removed from phase" "true" "$removed"

  teardown
}

# --- Test 7: No workflows dir ---
test_no_workflows() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  source "$MIGRATION"

  assert_eq "no crash without workflows" "true" "true"

  teardown
}

# --- Run all tests ---
echo "Running migration 035 tests..."
echo ""

test_happy_path
test_noop
test_idempotent
test_multiple_work_units
test_existing_defaults_preserved
test_empty_skills_array
test_no_workflows

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
