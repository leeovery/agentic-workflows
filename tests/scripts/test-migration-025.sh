#!/bin/bash
#
# Tests migration 025-unify-manifest-items.sh
# Validates wrapping flat feature/bugfix phase data into items[name].
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/025-unify-manifest-items.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Create a temporary directory for test fixtures
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "Test directory: $TEST_DIR"
echo ""

#
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows"
}

create_manifest() {
    local name="$1"
    local content="$2"
    mkdir -p "$TEST_DIR/.workflows/$name"
    echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

# Stub report_update for migration script
report_update() { echo "updated: $1 — $2"; }
export -f report_update

run_migration() {
    cd "$TEST_DIR"
    PROJECT_DIR="$TEST_DIR" bash "$MIGRATION_SCRIPT" 2>&1
}

get_field() {
    local name="$1"
    local field="$2"
    node -e "
      const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const parts = process.argv[2].split('.');
      let v = m;
      for (const p of parts) v = (v || {})[p];
      console.log(v === undefined ? 'undefined' : (typeof v === 'object' ? JSON.stringify(v) : v));
    " "$TEST_DIR/.workflows/$name/manifest.json" "$field"
}

assert_equals() {
    local actual="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected: $expected"
        echo -e "    Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_contains() {
    local content="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -qF -- "$expected"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected to find: $expected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_not_contains() {
    local content="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -qF -- "$expected"; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Should not find: $expected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
}

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: feature flat discussion wrapped into items${NC}"
setup_fixture

create_manifest "my-feat" '{
  "name": "my-feat",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "my-feat" "phases.discussion.items.my-feat.status")" "completed" "Status moved into items"
assert_contains "$output" "unified to items structure" "Reports update"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: feature planning with extra fields wrapped correctly${NC}"
setup_fixture

create_manifest "plan-feat" '{
  "name": "plan-feat",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": { "status": "completed", "format": "local-markdown", "task_list_gate_mode": "gated" }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "plan-feat" "phases.planning.items.plan-feat.status")" "completed" "Status in items"
assert_equals "$(get_field "plan-feat" "phases.planning.items.plan-feat.format")" "local-markdown" "Format in items"
assert_equals "$(get_field "plan-feat" "phases.planning.items.plan-feat.task_list_gate_mode")" "gated" "Gate mode in items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: analysis_cache preserved at phase level${NC}"
setup_fixture

create_manifest "cached" '{
  "name": "cached",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed", "analysis_cache": { "checksum": "abc123" } }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "cached" "phases.research.analysis_cache.checksum")" "abc123" "analysis_cache stays at phase level"
assert_equals "$(get_field "cached" "phases.research.items.cached.status")" "completed" "Status moved to items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: bugfix investigation wrapped into items${NC}"
setup_fixture

create_manifest "my-bug" '{
  "name": "my-bug",
  "work_type": "bugfix",
  "status": "in-progress",
  "phases": {
    "investigation": { "status": "in-progress" }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "my-bug" "phases.investigation.items.my-bug.status")" "in-progress" "Bugfix investigation wrapped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic manifests are skipped${NC}"
setup_fixture

create_manifest "my-epic" '{
  "name": "my-epic",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "auth": { "status": "completed" } } }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "my-epic" "phases.discussion.items.auth.status")" "completed" "Epic items unchanged"
assert_not_contains "$output" "unified" "No update for epic"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: phases already with items are skipped${NC}"
setup_fixture

create_manifest "already-items" '{
  "name": "already-items",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "already-items": { "status": "completed" } } },
    "specification": { "status": "in-progress" }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "already-items" "phases.discussion.items.already-items.status")" "completed" "Existing items untouched"
assert_equals "$(get_field "already-items" "phases.specification.items.already-items.status")" "in-progress" "Flat phase wrapped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple phases wrapped in one manifest${NC}"
setup_fixture

create_manifest "multi" '{
  "name": "multi",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" },
    "specification": { "status": "completed" },
    "planning": { "status": "in-progress", "format": "local-markdown" },
    "implementation": { "status": "in-progress", "completed_tasks": ["multi-1-1"] }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "multi" "phases.discussion.items.multi.status")" "completed" "Discussion wrapped"
assert_equals "$(get_field "multi" "phases.specification.items.multi.status")" "completed" "Specification wrapped"
assert_equals "$(get_field "multi" "phases.planning.items.multi.format")" "local-markdown" "Planning format in items"
assert_equals "$(get_field "multi" "phases.implementation.items.multi.completed_tasks")" '["multi-1-1"]' "Implementation tasks in items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{
  "name": "idem",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

run_migration > /dev/null
output=$(run_migration)

assert_equals "$(get_field "idem" "phases.discussion.items.idem.status")" "completed" "Items still correct"
assert_not_contains "$output" "unified" "No update on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"name":".state","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"name":"real","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}'

run_migration > /dev/null

assert_equals "$(get_field "real" "phases.discussion.items.real.status")" "completed" "Real manifest migrated"
# Dot-dir manifest should still have flat status
dot_status=$(node -e "
  const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(m.phases.discussion.status || 'missing');
" "$TEST_DIR/.workflows/.state/manifest.json")
assert_equals "$dot_status" "completed" "Dot-dir manifest untouched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: empty phases object unchanged${NC}"
setup_fixture

create_manifest "empty" '{"name":"empty","work_type":"feature","status":"in-progress","phases":{}}'

output=$(run_migration)

assert_not_contains "$output" "unified" "No update for empty phases"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "updated" "No updates without .workflows dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: preserves other manifest fields${NC}"
setup_fixture

create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "in-progress",
  "created": "2026-03-01",
  "description": "Test preservation",
  "phases": {
    "discussion": { "status": "completed" }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "preserve" "name")" "preserve" "Name preserved"
assert_equals "$(get_field "preserve" "work_type")" "feature" "Work type preserved"
assert_equals "$(get_field "preserve" "created")" "2026-03-01" "Created date preserved"
assert_equals "$(get_field "preserve" "description")" "Test preservation" "Description preserved"

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================"
echo -e "Tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================"

if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi
