#!/bin/bash
#
# Tests the discovery script for workflow-start (unified entry point).
# Creates temporary fixtures with manifest.json files and validates YAML output.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/workflow-start/scripts/discovery.sh"

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

    # Set up manifest CLI so discovery scripts can find it
    if [ ! -f "$TEST_DIR/.claude/skills/workflow-manifest/scripts/manifest.js" ]; then
        mkdir -p "$TEST_DIR/.claude/skills/workflow-manifest/scripts"
        ln -sf "$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.js" \
            "$TEST_DIR/.claude/skills/workflow-manifest/scripts/manifest.js"
    fi
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
# Fresh state
# ──────────────────────────────────────

test_fresh_state() {
    echo -e "${YELLOW}Test: Fresh state (no artifacts)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'epic:' "Has epic section"
    assert_contains "$output" 'features:' "Has features section"
    assert_contains "$output" 'bugfixes:' "Has bugfixes section"
    assert_contains "$output" 'has_any_work: false' "No work exists"
    assert_contains "$output" 'feature_count: 0' "Feature count is 0"
    assert_contains "$output" 'bugfix_count: 0' "Bugfix count is 0"
    assert_contains "$output" 'epic_count: 0' "Epic count is 0"
    echo ""
}

# ──────────────────────────────────────
# Epic section
# ──────────────────────────────────────

test_epic_with_research() {
    echo -e "${YELLOW}Test: Epic with research phase${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'epic_count: 1' "Epic count is 1"
    assert_contains "$output" 'has_any_work: true' "Has work"
    assert_contains "$output" 'name: "big-project"' "Found big-project"
    assert_contains "$output" 'next_phase: "research"' "Next phase is research"
    assert_contains "$output" 'phase_label: "research (in-progress)"' "Phase label correct"
    echo ""
}

test_epic_with_discussion() {
    echo -e "${YELLOW}Test: Epic with concluded research, in-progress discussion${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "concluded"}, "discussion": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "discussion"' "Next phase is discussion"
    assert_contains "$output" 'phase_label: "discussion (in-progress)"' "Phase label correct"
    echo ""
}

test_epic_with_spec_and_plan() {
    echo -e "${YELLOW}Test: Epic with concluded spec and in-progress plan${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "concluded"}, "discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    assert_contains "$output" 'phase_label: "planning (in-progress)"' "Phase label correct"
    echo ""
}

# ──────────────────────────────────────
# Features section
# ──────────────────────────────────────

test_feature_discussion_in_progress() {
    echo -e "${YELLOW}Test: Feature with in-progress discussion${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature_count: 1' "Feature count is 1"
    assert_contains "$output" 'name: "auth-flow"' "Found auth-flow topic"
    assert_contains "$output" 'next_phase: "discussion"' "Next phase is discussion"
    assert_contains "$output" 'phase_label: "discussion (in-progress)"' "Phase label correct"
    echo ""
}

test_feature_discussion_concluded() {
    echo -e "${YELLOW}Test: Feature with concluded discussion${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    assert_contains "$output" 'phase_label: "ready for specification"' "Phase label correct"
    echo ""
}

test_feature_multi_phase() {
    echo -e "${YELLOW}Test: Feature topic with multiple phases${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature_count: 1' "Feature count is 1"
    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    assert_contains "$output" 'phase_label: "planning (in-progress)"' "Phase label correct"
    echo ""
}

test_feature_concluded_plan() {
    echo -e "${YELLOW}Test: Feature with concluded plan → ready for implementation${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    assert_contains "$output" 'phase_label: "ready for implementation"' "Phase label correct"
    echo ""
}

test_feature_impl_in_progress() {
    echo -e "${YELLOW}Test: Feature impl in-progress${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    assert_contains "$output" 'phase_label: "implementation (in-progress)"' "Phase label correct"
    echo ""
}

test_feature_impl_completed_no_review() {
    echo -e "${YELLOW}Test: Feature with completed impl, no review → ready for review${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "review"' "Next phase is review"
    assert_contains "$output" 'phase_label: "ready for review"' "Phase label correct"
    echo ""
}

test_feature_pipeline_complete() {
    echo -e "${YELLOW}Test: Feature with completed review → done${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "done"' "Next phase is done"
    assert_contains "$output" 'phase_label: "pipeline complete"' "Phase label correct"
    echo ""
}

test_feature_ready_for_spec() {
    echo -e "${YELLOW}Test: Feature spec concluded, no plan → ready for planning${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    assert_contains "$output" 'phase_label: "ready for planning"' "Phase label correct"
    echo ""
}

test_feature_spec_in_progress() {
    echo -e "${YELLOW}Test: Feature spec in-progress${NC}"
    setup_fixture

    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    assert_contains "$output" 'phase_label: "specification (in-progress)"' "Phase label correct"
    echo ""
}

# ──────────────────────────────────────
# Bugfixes section
# ──────────────────────────────────────

test_bugfix_investigation_in_progress() {
    echo -e "${YELLOW}Test: Bugfix with in-progress investigation${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'bugfix_count: 1' "Bugfix count is 1"
    assert_contains "$output" 'name: "login-crash"' "Found login-crash bugfix"
    assert_contains "$output" 'next_phase: "investigation"' "Next phase is investigation"
    assert_contains "$output" 'phase_label: "investigation (in-progress)"' "Phase label correct"
    echo ""
}

test_bugfix_concluded_investigation() {
    echo -e "${YELLOW}Test: Bugfix with concluded investigation${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "specification"' "Next phase is specification"
    assert_contains "$output" 'phase_label: "ready for specification"' "Phase label correct"
    echo ""
}

test_bugfix_full_pipeline() {
    echo -e "${YELLOW}Test: Bugfix through full pipeline → done${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "done"' "Next phase is done"
    assert_contains "$output" 'phase_label: "pipeline complete"' "Phase label correct"
    echo ""
}

test_bugfix_ready_for_planning() {
    echo -e "${YELLOW}Test: Bugfix spec concluded, no plan → ready for planning${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "planning"' "Next phase is planning"
    assert_contains "$output" 'phase_label: "ready for planning"' "Phase label correct"
    echo ""
}

test_bugfix_ready_for_impl() {
    echo -e "${YELLOW}Test: Bugfix plan concluded → ready for implementation${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    assert_contains "$output" 'phase_label: "ready for implementation"' "Phase label correct"
    echo ""
}

test_bugfix_impl_in_progress() {
    echo -e "${YELLOW}Test: Bugfix impl in-progress${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "implementation"' "Next phase is implementation"
    assert_contains "$output" 'phase_label: "implementation (in-progress)"' "Phase label correct"
    echo ""
}

test_bugfix_ready_for_review() {
    echo -e "${YELLOW}Test: Bugfix impl completed → ready for review${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "concluded"}, "specification": {"status": "concluded"}, "planning": {"status": "concluded"}, "implementation": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'next_phase: "review"' "Next phase is review"
    assert_contains "$output" 'phase_label: "ready for review"' "Phase label correct"
    echo ""
}

# ──────────────────────────────────────
# Mixed work types
# ──────────────────────────────────────

test_mixed_work_types() {
    echo -e "${YELLOW}Test: Mixed epic, feature, and bugfix work units${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "in-progress"}}'
    create_manifest "search" "feature" '{"discussion": {"status": "concluded"}}'
    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'epic_count: 1' "One epic"
    assert_contains "$output" 'feature_count: 1' "One feature"
    assert_contains "$output" 'bugfix_count: 1' "One bugfix"
    assert_contains "$output" 'has_any_work: true' "Has work"
    echo ""
}

test_multiple_features() {
    echo -e "${YELLOW}Test: Multiple feature work units${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'
    create_manifest "billing" "feature" '{"discussion": {"status": "in-progress"}}'
    create_manifest "search" "feature" '{"specification": {"status": "concluded"}, "planning": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature_count: 3' "Feature count is 3"
    assert_contains "$output" 'name: "auth-flow"' "Found auth-flow"
    assert_contains "$output" 'name: "billing"' "Found billing"
    assert_contains "$output" 'name: "search"' "Found search"
    echo ""
}

test_no_workflows_dir() {
    echo -e "${YELLOW}Test: No .workflows directory at all${NC}"
    rm -rf "$TEST_DIR/.workflows"

    local output=$(run_discovery)

    assert_contains "$output" 'has_any_work: false' "No work exists"
    assert_contains "$output" 'feature_count: 0' "Feature count is 0"
    assert_contains "$output" 'bugfix_count: 0' "Bugfix count is 0"
    assert_contains "$output" 'epic_count: 0' "Epic count is 0"
    echo ""
}

# ──────────────────────────────────────
# Run all tests
# ──────────────────────────────────────

echo "=========================================="
echo "Running discovery-for-start tests"
echo "=========================================="
echo ""

# Fresh state
test_fresh_state

# Epic
test_epic_with_research
test_epic_with_discussion
test_epic_with_spec_and_plan

# Features
test_feature_discussion_in_progress
test_feature_discussion_concluded
test_feature_multi_phase
test_feature_concluded_plan
test_feature_impl_in_progress
test_feature_impl_completed_no_review
test_feature_pipeline_complete
test_feature_ready_for_spec
test_feature_spec_in_progress

# Bugfixes
test_bugfix_investigation_in_progress
test_bugfix_concluded_investigation
test_bugfix_full_pipeline
test_bugfix_ready_for_planning
test_bugfix_ready_for_impl
test_bugfix_impl_in_progress
test_bugfix_ready_for_review

# Mixed
test_mixed_work_types
test_multiple_features
test_no_workflows_dir

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
