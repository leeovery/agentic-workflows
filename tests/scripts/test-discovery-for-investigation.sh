#!/bin/bash
#
# Tests the discovery script for start-investigation.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-investigation/scripts/discovery.sh"
MANIFEST_CLI="$SCRIPT_DIR/../../.claude/skills/workflow-manifest/scripts/manifest.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
    mkdir -p "$TEST_DIR/.workflows"
}

# Create a manifest.json for a work unit
create_manifest() {
    local name="$1"
    local work_type="$2"
    local inv_status="$3"  # empty string means no investigation phase

    mkdir -p "$TEST_DIR/.workflows/$name"

    local phases='{}'
    if [ -n "$inv_status" ]; then
        phases="{\"investigation\": {\"status\": \"$inv_status\"}}"
    fi

    cat > "$TEST_DIR/.workflows/$name/manifest.json" << EOFMANIFEST
{
  "name": "$name",
  "work_type": "$work_type",
  "status": "active",
  "description": "Test work unit: $name",
  "phases": $phases
}
EOFMANIFEST
}

run_discovery() {
    cd "$TEST_DIR"
    /bin/bash "$DISCOVERY_SCRIPT" 2>/dev/null
}

assert_contains() {
    local output="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$output" | grep -qF -- "$expected"; then
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
    local output="$1"
    local pattern="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if ! echo "$output" | grep -qF -- "$pattern"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Did not expect to find: $pattern"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ──────────────────────────────────────
# Tests
# ──────────────────────────────────────

test_fresh_state() {
    echo -e "${YELLOW}Test: Fresh state (no work units)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'investigations:' "Has investigations section"
    assert_contains "$output" 'exists: false' "No investigations exist"
    assert_contains "$output" 'total: 0' "Total count is 0"
    assert_contains "$output" 'in_progress: 0' "In-progress count is 0"
    assert_contains "$output" 'concluded: 0' "Concluded count is 0"
    assert_contains "$output" 'scenario: "fresh"' "Scenario is fresh"
    echo ""
}

test_single_in_progress() {
    echo -e "${YELLOW}Test: Single in-progress investigation${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" "in-progress"

    local output=$(run_discovery)

    assert_contains "$output" 'exists: true' "Investigations exist"
    assert_contains "$output" 'work_unit: "login-crash"' "Found login-crash work unit"
    assert_contains "$output" 'status: "in-progress"' "Status is in-progress"
    assert_contains "$output" 'work_type: "bugfix"' "Work type is bugfix"
    assert_contains "$output" 'total: 1' "Total count is 1"
    assert_contains "$output" 'in_progress: 1' "In-progress count is 1"
    assert_contains "$output" 'concluded: 0' "Concluded count is 0"
    assert_contains "$output" 'scenario: "has_investigations"' "Scenario is has_investigations"
    echo ""
}

test_single_concluded() {
    echo -e "${YELLOW}Test: Single concluded investigation${NC}"
    setup_fixture

    create_manifest "null-pointer" "bugfix" "concluded"

    local output=$(run_discovery)

    assert_contains "$output" 'status: "concluded"' "Status is concluded"
    assert_contains "$output" 'total: 1' "Total count is 1"
    assert_contains "$output" 'in_progress: 0' "In-progress count is 0"
    assert_contains "$output" 'concluded: 1' "Concluded count is 1"
    echo ""
}

test_multiple_mixed() {
    echo -e "${YELLOW}Test: Multiple investigations with mixed statuses${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" "in-progress"
    create_manifest "null-pointer" "bugfix" "concluded"
    create_manifest "timeout-error" "bugfix" "in-progress"

    local output=$(run_discovery)

    assert_contains "$output" 'total: 3' "Total count is 3"
    assert_contains "$output" 'in_progress: 2' "In-progress count is 2"
    assert_contains "$output" 'concluded: 1' "Concluded count is 1"
    assert_contains "$output" 'work_unit: "login-crash"' "Found login-crash"
    assert_contains "$output" 'work_unit: "null-pointer"' "Found null-pointer"
    assert_contains "$output" 'work_unit: "timeout-error"' "Found timeout-error"
    echo ""
}

test_bugfix_without_investigation_phase() {
    echo -e "${YELLOW}Test: Bugfix work unit with no investigation phase yet${NC}"
    setup_fixture

    create_manifest "new-bug" "bugfix" ""

    local output=$(run_discovery)

    # Bugfix exists but has no investigation phase status — still fresh
    assert_contains "$output" 'total: 0' "Total count is 0 (no investigation phase)"
    assert_contains "$output" 'scenario: "fresh"' "Scenario is fresh"
    echo ""
}

test_feature_work_units_excluded() {
    echo -e "${YELLOW}Test: Feature work units are excluded${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" ""
    create_manifest "login-crash" "bugfix" "in-progress"

    local output=$(run_discovery)

    assert_not_contains "$output" 'auth-flow' "Feature work unit excluded"
    assert_contains "$output" 'work_unit: "login-crash"' "Bugfix work unit included"
    assert_contains "$output" 'total: 1' "Total count is 1 (bugfix only)"
    echo ""
}

test_epic_work_units_excluded() {
    echo -e "${YELLOW}Test: Epic work units are excluded${NC}"
    setup_fixture

    create_manifest "big-project" "epic" ""
    create_manifest "timeout-bug" "bugfix" "in-progress"

    local output=$(run_discovery)

    assert_not_contains "$output" 'big-project' "Epic work unit excluded"
    assert_contains "$output" 'work_unit: "timeout-bug"' "Bugfix work unit included"
    echo ""
}

test_empty_workflows_dir() {
    echo -e "${YELLOW}Test: Empty .workflows directory${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'exists: false' "No investigations exist"
    assert_contains "$output" 'scenario: "fresh"' "Scenario is fresh"
    echo ""
}

# ──────────────────────────────────────
# Run all tests
# ──────────────────────────────────────

echo "=========================================="
echo "Running discovery-for-investigation tests"
echo "=========================================="
echo ""

test_fresh_state
test_single_in_progress
test_single_concluded
test_multiple_mixed
test_bugfix_without_investigation_phase
test_feature_work_units_excluded
test_epic_work_units_excluded
test_empty_workflows_dir

#
# Summary
#
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total:  $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
