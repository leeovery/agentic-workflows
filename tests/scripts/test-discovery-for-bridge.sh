#!/bin/bash
#
# Tests the bridge discovery script against various workflow states.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# The bridge discovery takes a work_unit name as argument and outputs its
# manifest state with computed next_phase.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/workflow-bridge/scripts/discovery.sh"

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
    shift 2

    mkdir -p "$TEST_DIR/.workflows/$name"

    local phases='{}'
    if [ -n "$1" ]; then
        phases="$1"
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

# Create a phase artifact file in work-unit-first layout
create_phase_file() {
    local wu_name="$1"
    local phase="$2"
    local filename="$3"
    local content="$4"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/$phase"
    echo "$content" > "$TEST_DIR/.workflows/$wu_name/$phase/$filename"
}

run_discovery() {
    local work_unit="$1"
    cd "$TEST_DIR"
    /bin/bash "$DISCOVERY_SCRIPT" "$work_unit" 2>/dev/null
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
# Feature pipeline tests
# ──────────────────────────────────────

test_feature_discussion_in_progress() {
    echo -e "${YELLOW}Test: Feature - discussion in progress${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'
    create_phase_file "auth-flow" "discussion" "discussion.md" "---\nstatus: in-progress\n---\n# Discussion"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'work_unit: "auth-flow"' "Work unit name"
    assert_contains "$output" 'work_type: "feature"' "Work type is feature"
    assert_contains "$output" 'next_phase: "discussion"' "Next phase is discussion"
    echo ""
}

test_feature_discussion_concluded() {
    echo -e "${YELLOW}Test: Feature - discussion concluded${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'
    create_phase_file "auth-flow" "discussion" "discussion.md" "---\nstatus: concluded\n---\n# Discussion"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    echo ""
}

test_feature_spec_concluded() {
    echo -e "${YELLOW}Test: Feature - spec concluded, no plan${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}}'
    create_phase_file "auth-flow" "discussion" "discussion.md" "---\nstatus: concluded\n---"
    create_phase_file "auth-flow" "specification" "specification.md" "---\nstatus: concluded\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    echo ""
}

test_feature_plan_concluded() {
    echo -e "${YELLOW}Test: Feature - plan concluded${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}}'
    create_phase_file "auth-flow" "planning" "planning.md" "---\nstatus: concluded\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    echo ""
}

test_feature_plan_in_progress() {
    echo -e "${YELLOW}Test: Feature - in-progress plan${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "in-progress"}}'
    create_phase_file "auth-flow" "planning" "planning.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    echo ""
}

test_feature_impl_in_progress() {
    echo -e "${YELLOW}Test: Feature - in-progress implementation${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"planning": {"status": "concluded"}, "implementation": {"status": "in-progress"}}'
    create_phase_file "auth-flow" "planning" "planning.md" "---\nstatus: concluded\n---"
    create_phase_file "auth-flow" "implementation" "implementation.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    echo ""
}

test_feature_impl_completed_no_review() {
    echo -e "${YELLOW}Test: Feature - completed impl, no review${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"planning": {"status": "concluded"}, "implementation": {"status": "completed"}}'
    create_phase_file "auth-flow" "implementation" "implementation.md" "---\nstatus: completed\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "review"' "Next phase is review"
    echo ""
}

test_feature_impl_completed_with_review() {
    echo -e "${YELLOW}Test: Feature - completed impl + review = done${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"planning": {"status": "concluded"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'
    create_phase_file "auth-flow" "implementation" "implementation.md" "---\nstatus: completed\n---"
    mkdir -p "$TEST_DIR/.workflows/auth-flow/review/r1"
    echo -e "---\ntopic: auth-flow\n---\n# Review" > "$TEST_DIR/.workflows/auth-flow/review/r1/review.md"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "done"' "Next phase is done"
    echo ""
}

test_feature_spec_in_progress() {
    echo -e "${YELLOW}Test: Feature - concluded discussion + in-progress spec${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "in-progress"}}'
    create_phase_file "auth-flow" "discussion" "discussion.md" "---\nstatus: concluded\n---"
    create_phase_file "auth-flow" "specification" "specification.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    echo ""
}

# ──────────────────────────────────────
# Bugfix pipeline tests
# ──────────────────────────────────────

test_bugfix_investigation_in_progress() {
    echo -e "${YELLOW}Test: Bugfix - investigation in progress${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "in-progress"}}'
    create_phase_file "login-crash" "investigation" "investigation.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'work_unit: "login-crash"' "Work unit name"
    assert_contains "$output" 'work_type: "bugfix"' "Work type is bugfix"
    assert_contains "$output" 'next_phase: "investigation"' "Next phase is investigation"
    echo ""
}

test_bugfix_investigation_concluded() {
    echo -e "${YELLOW}Test: Bugfix - investigation concluded${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}}'
    create_phase_file "login-crash" "investigation" "investigation.md" "---\nstatus: concluded\n---"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    echo ""
}

test_bugfix_spec_in_progress() {
    echo -e "${YELLOW}Test: Bugfix - concluded investigation + in-progress spec${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "in-progress"}}'
    create_phase_file "login-crash" "investigation" "investigation.md" "---\nstatus: concluded\n---"
    create_phase_file "login-crash" "specification" "specification.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    echo ""
}

test_bugfix_spec_concluded() {
    echo -e "${YELLOW}Test: Bugfix - concluded spec, no plan${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}}'
    create_phase_file "login-crash" "investigation" "investigation.md" "---\nstatus: concluded\n---"
    create_phase_file "login-crash" "specification" "specification.md" "---\nstatus: concluded\n---"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    echo ""
}

test_bugfix_full_pipeline() {
    echo -e "${YELLOW}Test: Bugfix - implementation completed → review${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}}'
    create_phase_file "login-crash" "implementation" "implementation.md" "---\nstatus: completed\n---"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'next_phase: "review"' "Next phase is review"
    echo ""
}

test_bugfix_impl_completed_with_review() {
    echo -e "${YELLOW}Test: Bugfix - completed impl + review = done${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'
    create_phase_file "login-crash" "implementation" "implementation.md" "---\nstatus: completed\n---"
    mkdir -p "$TEST_DIR/.workflows/login-crash/review/r1"
    echo -e "---\ntopic: login-crash\n---\n# Review" > "$TEST_DIR/.workflows/login-crash/review/r1/review.md"

    local output=$(run_discovery "login-crash")

    assert_contains "$output" 'next_phase: "done"' "Next phase is done"
    echo ""
}

# ──────────────────────────────────────
# Phase existence tests
# ──────────────────────────────────────

test_phase_exists_flags() {
    echo -e "${YELLOW}Test: Phase exists flags${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "in-progress"}}'
    create_phase_file "auth-flow" "discussion" "discussion.md" "---\nstatus: concluded\n---"
    create_phase_file "auth-flow" "specification" "specification.md" "---\nstatus: in-progress\n---"

    local output=$(run_discovery "auth-flow")

    assert_contains "$output" 'phases:' "Has phases section"
    assert_contains "$output" 'discussion:' "Has discussion phase"
    assert_contains "$output" 'specification:' "Has specification phase"
    assert_contains "$output" 'planning:' "Has planning phase"
    echo ""
}

# ──────────────────────────────────────
# Epic tests
# ──────────────────────────────────────

test_epic_interactive_next_phase() {
    echo -e "${YELLOW}Test: Epic - next_phase is interactive${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "in-progress"}, "discussion": {"status": "in-progress"}}'

    local output=$(run_discovery "big-project")

    assert_contains "$output" 'work_type: "epic"' "Work type is epic"
    assert_contains "$output" 'next_phase: "interactive"' "Next phase is interactive for epic"
    echo ""
}

test_epic_detail_section() {
    echo -e "${YELLOW}Test: Epic - epic_detail section${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "concluded"}, "discussion": {"status": "in-progress", "items": {"auth-design": {"status": "concluded"}, "data-model": {"status": "in-progress"}}}}'

    local output=$(run_discovery "big-project")

    assert_contains "$output" 'epic_detail:' "Has epic_detail section"
    assert_contains "$output" 'name: "auth-design"' "Found auth-design item"
    assert_contains "$output" 'name: "data-model"' "Found data-model item"
    echo ""
}

# ──────────────────────────────────────
# Run all tests
# ──────────────────────────────────────

echo "=========================================="
echo "Running bridge discovery script tests"
echo "=========================================="
echo ""

# Feature pipeline
test_feature_discussion_in_progress
test_feature_discussion_concluded
test_feature_spec_concluded
test_feature_spec_in_progress
test_feature_plan_concluded
test_feature_plan_in_progress
test_feature_impl_in_progress
test_feature_impl_completed_no_review
test_feature_impl_completed_with_review

# Bugfix pipeline
test_bugfix_investigation_in_progress
test_bugfix_investigation_concluded
test_bugfix_spec_in_progress
test_bugfix_spec_concluded
test_bugfix_full_pipeline
test_bugfix_impl_completed_with_review

# Phase existence
test_phase_exists_flags

# Epic
test_epic_interactive_next_phase
test_epic_detail_section

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
