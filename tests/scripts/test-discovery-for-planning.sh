#!/bin/bash
#
# Tests the discovery script for start-planning.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Planning discovery reads:
# - Specifications from manifest CLI (phases.specification.status, .type)
# - Plans from manifest CLI (phases.planning.status, .format, .plan_id)
# - Implementation state from manifest CLI (phases.implementation.status)
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-planning/scripts/discovery.sh"

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

#
# Test: No specifications (fresh state)
#
test_no_specs() {
    echo -e "${YELLOW}Test: No specifications (fresh state)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'specifications:' "Has specifications section"
    assert_contains "$output" 'exists: false' "Specifications exists: false"
    assert_contains "$output" 'scenario: "no_specs"' "Scenario is no_specs"
    assert_contains "$output" 'feature: 0' "Feature count is 0"
    assert_contains "$output" 'feature_ready: 0' "Feature ready count is 0"

    echo ""
}

#
# Test: Single feature specification (in-progress)
#
test_single_spec_in_progress() {
    echo -e "${YELLOW}Test: Single feature specification (in-progress)${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'exists: true' "Specifications exist"
    assert_contains "$output" 'name: "auth-system"' "Found auth-system spec"
    assert_contains "$output" 'status: "in-progress"' "Status is in-progress"
    assert_contains "$output" 'has_plan: false' "No plan exists"
    assert_contains "$output" 'feature: 1' "Feature count is 1"
    assert_contains "$output" 'feature_ready: 0' "Feature ready count is 0"
    assert_contains "$output" 'scenario: "nothing_actionable"' "Scenario is nothing_actionable"

    echo ""
}

#
# Test: Single feature specification (concluded, no plan)
#
test_single_spec_concluded_no_plan() {
    echo -e "${YELLOW}Test: Single feature specification (concluded, no plan)${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'status: "concluded"' "Status is concluded"
    assert_contains "$output" 'has_plan: false' "No plan exists"
    assert_contains "$output" 'feature_ready: 1' "Feature ready count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: Single feature specification (concluded, has plan)
#
test_single_spec_concluded_with_plan() {
    echo -e "${YELLOW}Test: Single feature specification (concluded, has plan)${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'has_plan: true' "Plan exists"
    assert_contains "$output" 'plan_status: "in-progress"' "Plan status extracted"
    assert_contains "$output" 'feature_ready: 0' "Feature ready count is 0 (has plan)"
    assert_contains "$output" 'feature_with_plan: 1' "Feature with plan count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options (plan exists to continue)"
    assert_contains "$output" 'has_plans: true' "has_plans is true"

    echo ""
}

#
# Test: Multiple feature specifications
#
test_multiple_feature_specs() {
    echo -e "${YELLOW}Test: Multiple feature specifications${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'
    create_manifest "dashboard" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'name: "auth-system"' "Found auth-system"
    assert_contains "$output" 'name: "billing"' "Found billing"
    assert_contains "$output" 'name: "dashboard"' "Found dashboard"
    assert_contains "$output" 'feature: 3' "Feature count is 3"
    assert_contains "$output" 'feature_ready: 2' "Feature ready count is 2"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: Cross-cutting specifications
#
test_crosscutting_specs() {
    echo -e "${YELLOW}Test: Cross-cutting specifications${NC}"
    setup_fixture

    create_manifest "caching-strategy" "feature" '{"specification": {"status": "concluded", "type": "cross-cutting"}}'
    create_manifest "rate-limiting" "feature" '{"specification": {"status": "concluded", "type": "cross-cutting"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'name: "caching-strategy"' "Found caching-strategy"
    assert_contains "$output" 'name: "rate-limiting"' "Found rate-limiting"
    assert_contains "$output" 'crosscutting: 2' "Crosscutting count is 2"
    assert_contains "$output" 'feature: 0' "Feature count is 0"
    assert_contains "$output" 'scenario: "nothing_actionable"' "Scenario is nothing_actionable"

    echo ""
}

#
# Test: Mixed feature and cross-cutting
#
test_mixed_specs() {
    echo -e "${YELLOW}Test: Mixed feature and cross-cutting specifications${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'
    create_manifest "caching-strategy" "feature" '{"specification": {"status": "concluded", "type": "cross-cutting"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 1' "Feature count is 1"
    assert_contains "$output" 'crosscutting: 1' "Crosscutting count is 1"
    assert_contains "$output" 'feature_ready: 1' "Feature ready count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: Plans section
#
test_plans_section() {
    echo -e "${YELLOW}Test: Plans section${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "linear"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'plans:' "Has plans section"
    assert_contains "$output" 'format: "local-markdown"' "Found local-markdown format"
    assert_contains "$output" 'format: "linear"' "Found linear format"
    assert_contains "$output" 'common_format: ""' "Mixed formats yield empty common_format"

    echo ""
}

#
# Test: Plan without format shows MISSING
#
test_plan_missing_format() {
    echo -e "${YELLOW}Test: Plan without format shows MISSING${NC}"
    setup_fixture

    create_manifest "old-plan" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'format: "MISSING"' "Missing format flagged"
    assert_contains "$output" 'common_format: ""' "Only MISSING formats yield empty common_format"

    echo ""
}

#
# Test: Plan with plan_id
#
test_plan_with_plan_id() {
    echo -e "${YELLOW}Test: Plan with plan_id${NC}"
    setup_fixture

    create_manifest "with-plan-id" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "beads", "plan_id": "my-epic-abc123"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'plan_id: "my-epic-abc123"' "Plan ID extracted when present"

    echo ""
}

#
# Test: Concluded plan shows plan_status concluded and is actionable
#
test_concluded_plan_is_actionable() {
    echo -e "${YELLOW}Test: Concluded plan is actionable (review/revise)${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'has_plan: true' "Plan exists"
    assert_contains "$output" 'plan_status: "concluded"' "Plan status is concluded"
    assert_contains "$output" 'feature_with_plan: 1' "Feature with plan count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options (concluded plan is reviewable)"

    echo ""
}

#
# Test: Mix of ready specs and existing plans
#
test_mixed_ready_and_plans() {
    echo -e "${YELLOW}Test: Mix of ready specs and existing plans${NC}"
    setup_fixture

    # Ready spec (concluded, no plan)
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'

    # Spec with in-progress plan
    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'

    # In-progress spec (not ready)
    create_manifest "dashboard" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 3' "Feature count is 3"
    assert_contains "$output" 'feature_ready: 1' "Feature ready count is 1"
    assert_contains "$output" 'feature_with_plan: 1' "Feature with plan count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: All specs in-progress with no plans is nothing_actionable
#
test_all_in_progress_nothing_actionable() {
    echo -e "${YELLOW}Test: All specs in-progress with no plans${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'
    create_manifest "billing" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 2' "Feature count is 2"
    assert_contains "$output" 'feature_ready: 0' "Feature ready count is 0"
    assert_contains "$output" 'feature_with_plan: 0' "Feature with plan count is 0"
    assert_contains "$output" 'scenario: "nothing_actionable"' "Scenario is nothing_actionable"

    echo ""
}

#
# Test: common_format empty when no plans exist
#
test_common_format_no_plans() {
    echo -e "${YELLOW}Test: common_format empty when no plans exist${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'common_format: ""' "No plans yields empty common_format"

    echo ""
}

#
# Test: common_format with single plan
#
test_common_format_single_plan() {
    echo -e "${YELLOW}Test: common_format with single plan${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'common_format: "local-markdown"' "Single plan format becomes common_format"

    echo ""
}

#
# Test: common_format with multiple same format
#
test_common_format_multiple_same() {
    echo -e "${YELLOW}Test: common_format with multiple same format${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "beads"}}'
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "beads"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'common_format: "beads"' "Multiple same format yields common_format"

    echo ""
}

#
# Test: common_format empty with mixed formats
#
test_common_format_mixed() {
    echo -e "${YELLOW}Test: common_format empty with mixed formats${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "linear"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'common_format: ""' "Mixed formats yield empty common_format"

    echo ""
}

#
# Test: Spec with completed implementation
#
test_spec_with_completed_implementation() {
    echo -e "${YELLOW}Test: Spec with completed implementation${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'has_impl: true' "Implementation tracking exists"
    assert_contains "$output" 'impl_status: "completed"' "Implementation status is completed"
    assert_contains "$output" 'feature_implemented: 1' "Feature implemented count is 1"
    assert_contains "$output" 'feature_actionable_with_plan: 0' "Feature actionable with plan is 0 (implemented)"

    echo ""
}

#
# Test: Spec with in-progress implementation
#
test_spec_with_in_progress_implementation() {
    echo -e "${YELLOW}Test: Spec with in-progress implementation${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'has_impl: true' "Implementation tracking exists"
    assert_contains "$output" 'impl_status: "in-progress"' "Implementation status is in-progress"
    assert_contains "$output" 'feature_implemented: 0' "Feature implemented count is 0"
    assert_contains "$output" 'feature_actionable_with_plan: 1' "Feature actionable with plan is 1 (not completed)"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: All specs implemented yields nothing_actionable
#
test_all_specs_implemented() {
    echo -e "${YELLOW}Test: All specs implemented yields nothing_actionable${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature_ready: 0' "No specs ready for new plans"
    assert_contains "$output" 'feature_actionable_with_plan: 0' "No actionable specs with plans"
    assert_contains "$output" 'scenario: "nothing_actionable"' "Scenario is nothing_actionable"

    echo ""
}

#
# Test: Mix of implemented and ready specs
#
test_mix_implemented_and_ready() {
    echo -e "${YELLOW}Test: Mix of implemented and ready specs${NC}"
    setup_fixture

    # Implemented spec
    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'

    # Ready spec (no plan)
    create_manifest "billing" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 2' "Feature count is 2"
    assert_contains "$output" 'feature_ready: 1' "Feature ready count is 1"
    assert_contains "$output" 'feature_implemented: 1' "Feature implemented count is 1"
    assert_contains "$output" 'scenario: "has_options"' "Scenario is has_options"

    echo ""
}

#
# Test: Superseded feature spec excluded
#
test_superseded_feature_spec_excluded() {
    echo -e "${YELLOW}Test: Superseded feature spec excluded from counts${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'
    create_manifest "old-auth" "feature" '{"specification": {"status": "superseded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 1' "Only active feature spec counted"
    assert_contains "$output" 'feature_ready: 1' "Only active spec is ready"
    assert_not_contains "$output" 'name: "old-auth"' "Superseded spec not listed"
    assert_contains "$output" 'name: "auth-system"' "Active spec listed"
    echo ""
}

#
# Test: Superseded cross-cutting spec excluded
#
test_superseded_crosscutting_spec_excluded() {
    echo -e "${YELLOW}Test: Superseded cross-cutting spec excluded from counts${NC}"
    setup_fixture

    create_manifest "caching-v2" "feature" '{"specification": {"status": "concluded", "type": "cross-cutting"}}'
    create_manifest "caching-v1" "feature" '{"specification": {"status": "superseded", "type": "cross-cutting"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'crosscutting: 1' "Only active cross-cutting spec counted"
    assert_not_contains "$output" 'name: "caching-v1"' "Superseded cross-cutting spec not listed"
    assert_contains "$output" 'name: "caching-v2"' "Active cross-cutting spec listed"
    echo ""
}

#
# Test: Only superseded specs yields nothing_actionable
#
test_superseded_spec_nothing_actionable() {
    echo -e "${YELLOW}Test: Only superseded specs yields nothing_actionable scenario${NC}"
    setup_fixture

    create_manifest "old-feature" "feature" '{"specification": {"status": "superseded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature: 0' "Superseded spec not counted"
    assert_contains "$output" 'scenario: "nothing_actionable"' "Nothing actionable with only superseded specs"
    echo ""
}

#
# Test: Spec work_type output
#
test_spec_work_type_output() {
    echo -e "${YELLOW}Test: Spec work_type output${NC}"
    setup_fixture

    create_manifest "typed-spec" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'work_type: "feature"' "work_type feature in spec output"

    echo ""
}

#
# Test: Plan work_type output
#
test_plan_work_type_output() {
    echo -e "${YELLOW}Test: Plan work_type output${NC}"
    setup_fixture

    create_manifest "bugfix-plan" "bugfix" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "in-progress", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'work_type: "bugfix"' "work_type bugfix in plan output"

    echo ""
}

#
# Test: feature_actionable_with_plan count
#
test_feature_actionable_with_plan_count() {
    echo -e "${YELLOW}Test: feature_actionable_with_plan count${NC}"
    setup_fixture

    create_manifest "actionable-topic" "feature" '{"specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'feature_actionable_with_plan: 1' "feature_actionable_with_plan is 1"

    echo ""
}

#
# Run all tests
#
echo "=========================================="
echo "Running discovery-for-planning.sh tests"
echo "=========================================="
echo ""

test_no_specs
test_single_spec_in_progress
test_single_spec_concluded_no_plan
test_single_spec_concluded_with_plan
test_multiple_feature_specs
test_crosscutting_specs
test_mixed_specs
test_plans_section
test_plan_missing_format
test_plan_with_plan_id
test_concluded_plan_is_actionable
test_mixed_ready_and_plans
test_all_in_progress_nothing_actionable
test_common_format_no_plans
test_common_format_single_plan
test_common_format_multiple_same
test_common_format_mixed
test_spec_with_completed_implementation
test_spec_with_in_progress_implementation
test_all_specs_implemented
test_mix_implemented_and_ready
test_superseded_feature_spec_excluded
test_superseded_crosscutting_spec_excluded
test_superseded_spec_nothing_actionable
test_spec_work_type_output
test_plan_work_type_output
test_feature_actionable_with_plan_count

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
