#!/bin/bash
#
# Tests migration 028-remove-phase-level-status.sh
# Validates removal of flat phase-level status and backfilling of research items from disk.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/028-remove-phase-level-status.sh"

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

create_research_file() {
    local wu_name="$1"
    local filename="$2"
    mkdir -p "$TEST_DIR/.workflows/$wu_name/research"
    echo "# Research: $filename" > "$TEST_DIR/.workflows/$wu_name/research/$filename"
}

# Stub report_update for migration script
report_update() { echo "updated"; }
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

echo -e "${YELLOW}Test: research with flat status backfilled from disk files${NC}"
setup_fixture

create_manifest "v1" '{
  "name": "v1",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" },
    "discussion": { "items": { "auth": { "status": "completed" } } }
  }
}'
create_research_file "v1" "exploration.md"
create_research_file "v1" "architecture.md"

output=$(run_migration)

assert_equals "$(get_field "v1" "phases.research.items.exploration.status")" "completed" "exploration backfilled as item"
assert_equals "$(get_field "v1" "phases.research.items.architecture.status")" "completed" "architecture backfilled as item"
assert_equals "$(get_field "v1" "phases.research.status")" "undefined" "Flat status removed"
assert_equals "$(get_field "v1" "phases.discussion.items.auth.status")" "completed" "Existing items untouched"
assert_contains "$output" "updated" "Reports update"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: research flat status with no files on disk${NC}"
setup_fixture

create_manifest "orphan" '{
  "name": "orphan",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "orphan" "phases.research")" "undefined" "Empty phase object removed"
assert_contains "$output" "updated" "Reports update"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: flat status alongside existing items — just removes status${NC}"
setup_fixture

create_manifest "mixed" '{
  "name": "mixed",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "status": "completed",
      "items": { "auth": { "status": "completed" }, "billing": { "status": "in-progress" } }
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "mixed" "phases.discussion.status")" "undefined" "Flat status removed"
assert_equals "$(get_field "mixed" "phases.discussion.items.auth.status")" "completed" "Items preserved"
assert_equals "$(get_field "mixed" "phases.discussion.items.billing.status")" "in-progress" "Items preserved"
assert_contains "$output" "updated" "Reports update"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: non-research phase with flat status and no items${NC}"
setup_fixture

create_manifest "flat-disc" '{
  "name": "flat-disc",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "status": "completed" },
    "specification": { "status": "in-progress" }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "flat-disc" "phases.discussion")" "undefined" "Empty discussion phase removed"
assert_equals "$(get_field "flat-disc" "phases.specification")" "undefined" "Empty specification phase removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: manifest with no flat statuses — unchanged${NC}"
setup_fixture

create_manifest "clean" '{
  "name": "clean",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": { "items": { "clean": { "status": "completed" } } }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "clean" "phases.discussion.items.clean.status")" "completed" "Items untouched"
assert_not_contains "$output" "updated" "No update for clean manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple phases with flat status in one manifest${NC}"
setup_fixture

create_manifest "multi" '{
  "name": "multi",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" },
    "discussion": { "status": "completed" },
    "planning": { "status": "in-progress" }
  }
}'
create_research_file "multi" "exploration.md"

output=$(run_migration)

assert_equals "$(get_field "multi" "phases.research.items.exploration.status")" "completed" "Research backfilled"
assert_equals "$(get_field "multi" "phases.research.status")" "undefined" "Research flat status removed"
assert_equals "$(get_field "multi" "phases.discussion")" "undefined" "Discussion orphan removed"
assert_equals "$(get_field "multi" "phases.planning")" "undefined" "Planning orphan removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{
  "name": "idem",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": { "status": "completed" }
  }
}'
create_research_file "idem" "exploration.md"

run_migration > /dev/null
output=$(run_migration)

assert_equals "$(get_field "idem" "phases.research.items.exploration.status")" "completed" "Items still correct"
assert_not_contains "$output" "updated" "No update on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"name":".state","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"name":"real","work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"completed"}}}'

run_migration > /dev/null

# Dot-dir manifest should still have flat status
dot_status=$(node -e "
  const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(m.phases.discussion.status || 'missing');
" "$TEST_DIR/.workflows/.state/manifest.json")
assert_equals "$dot_status" "completed" "Dot-dir manifest untouched"

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
  "work_type": "epic",
  "status": "in-progress",
  "created": "2026-03-01",
  "description": "Test preservation",
  "phases": {
    "research": { "status": "completed" }
  }
}'
create_research_file "preserve" "exploration.md"

run_migration > /dev/null

assert_equals "$(get_field "preserve" "name")" "preserve" "Name preserved"
assert_equals "$(get_field "preserve" "work_type")" "epic" "Work type preserved"
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
