#!/bin/bash
#
# Tests the discovery script for /status command against various workflow states.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Status discovery reads:
# - All active work units via manifest CLI
# - Per-unit phase details from manifest + file reads
# - Aggregated counts by work type and phase
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/status/scripts/discovery.sh"

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

create_spec_file() {
    local wu_name="$1"
    local content="$2"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/specification"
    cat > "$TEST_DIR/.workflows/$wu_name/specification/specification.md" << EOF
$content
EOF
}

create_planning_file() {
    local wu_name="$1"
    local content="$2"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/planning"
    cat > "$TEST_DIR/.workflows/$wu_name/planning/planning.md" << EOF
$content
EOF
}

create_implementation_file() {
    local wu_name="$1"
    local content="$2"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/implementation"
    cat > "$TEST_DIR/.workflows/$wu_name/implementation/implementation.md" << EOF
$content
EOF
}

create_task_file() {
    local wu_name="$1"
    local task_id="$2"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/planning/tasks"
    cat > "$TEST_DIR/.workflows/$wu_name/planning/tasks/${task_id}.md" << EOF
---
task_id: $task_id
---
Task
EOF
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
# Test: Empty state (no work units)
#
test_empty_state() {
    echo -e "${YELLOW}Test: Empty state (no work units)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'work_units: []' "Work units empty"
    assert_contains "$output" 'has_any_work: false' "has_any_work is false"

    echo ""
}

#
# Test: Single feature work unit with discussion
#
test_single_feature_discussion() {
    echo -e "${YELLOW}Test: Single feature work unit with discussion${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'name: "auth-flow"' "Found auth-flow"
    assert_contains "$output" 'work_type: "feature"' "Work type is feature"
    assert_contains "$output" 'has_any_work: true' "has_any_work is true"
    assert_contains "$output" 'feature: 1' "Feature count is 1"

    echo ""
}

#
# Test: Specification with sources from file frontmatter
#
test_spec_with_sources() {
    echo -e "${YELLOW}Test: Specification with sources from file frontmatter${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'
    create_spec_file "auth-system" "---
topic: auth-system
status: concluded
type: feature
sources:
  - name: auth-flow
    status: incorporated
  - name: session-management
    status: incorporated
---

# Auth System Specification"

    local output=$(run_discovery)

    assert_contains "$output" 'name: "auth-system"' "Found auth-system work unit"
    assert_contains "$output" 'name: "auth-flow"' "Source auth-flow found"
    assert_contains "$output" 'name: "session-management"' "Source session-management found"
    assert_contains "$output" 'status: "incorporated"' "Sources marked incorporated"

    echo ""
}

#
# Test: Specification with pending source
#
test_spec_pending_source() {
    echo -e "${YELLOW}Test: Specification with pending source${NC}"
    setup_fixture

    create_manifest "billing" "feature" '{"specification": {"status": "in-progress", "type": "feature"}}'
    create_spec_file "billing" "---
topic: billing
status: in-progress
type: feature
sources:
  - name: payment-processing
    status: incorporated
  - name: rate-limiting
    status: pending
---

# Billing Specification"

    local output=$(run_discovery)

    assert_contains "$output" 'status: "pending"' "Pending source detected"
    assert_contains "$output" 'status: "incorporated"' "Incorporated source detected"

    echo ""
}

#
# Test: Cross-cutting specification
#
test_crosscutting_spec() {
    echo -e "${YELLOW}Test: Cross-cutting specification${NC}"
    setup_fixture

    create_manifest "caching-policy" "feature" '{"specification": {"status": "concluded", "type": "cross-cutting"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'type: "cross-cutting"' "Type is cross-cutting"
    assert_contains "$output" 'crosscutting: 1' "Cross-cutting count is 1"

    echo ""
}

#
# Test: Superseded specification
#
test_superseded_spec() {
    echo -e "${YELLOW}Test: Superseded specification${NC}"
    setup_fixture

    create_manifest "old-auth" "feature" '{"specification": {"status": "superseded", "type": "feature", "superseded_by": "auth-system"}}'
    create_manifest "auth-system" "feature" '{"specification": {"status": "concluded", "type": "feature"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'superseded_by: "auth-system"' "Superseded_by field extracted"

    echo ""
}

#
# Test: Plan with external dependencies from file frontmatter
#
test_plan_with_deps() {
    echo -e "${YELLOW}Test: Plan with external dependencies${NC}"
    setup_fixture

    create_manifest "billing" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
    create_planning_file "billing" "---
topic: billing
status: concluded
format: local-markdown
external_dependencies:
  - topic: auth-system
    description: User authentication
    state: unresolved
---

# Billing Plan"

    local output=$(run_discovery)

    assert_contains "$output" 'has_unresolved_deps: true' "Unresolved deps detected"
    assert_contains "$output" 'topic: "auth-system"' "Dep topic extracted"
    assert_contains "$output" 'state: "unresolved"' "Dep state extracted"

    echo ""
}

#
# Test: Plan with resolved dependencies
#
test_plan_resolved_deps() {
    echo -e "${YELLOW}Test: Plan with resolved dependencies${NC}"
    setup_fixture

    create_manifest "billing" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
    create_planning_file "billing" "---
topic: billing
status: concluded
format: local-markdown
external_dependencies:
  - topic: auth-system
    description: User authentication
    state: resolved
    task_id: auth-system-1-3
---

# Billing Plan"

    local output=$(run_discovery)

    assert_contains "$output" 'has_unresolved_deps: false' "No unresolved deps"
    assert_contains "$output" 'state: "resolved"' "Resolved state extracted"
    assert_contains "$output" 'task_id: "auth-system-1-3"' "Task ID extracted"

    echo ""
}

#
# Test: Implementation tracking with task counts
#
test_implementation_tracking() {
    echo -e "${YELLOW}Test: Implementation tracking${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress", "current_phase": 1}}'
    create_planning_file "auth-system" "---
topic: auth-system
status: concluded
format: local-markdown
---

# Auth System Plan"
    create_task_file "auth-system" "auth-system-1-1"
    create_task_file "auth-system" "auth-system-1-2"
    create_task_file "auth-system" "auth-system-1-3"

    create_implementation_file "auth-system" "---
status: in-progress
current_phase: 1
current_task: auth-system-1-2
completed_tasks:
  - auth-system-1-1
completed_phases: []
---

# Auth System Implementation"

    local output=$(run_discovery)

    assert_contains "$output" 'completed_tasks: 1' "1 completed task"
    assert_contains "$output" 'total_tasks: 3' "3 total tasks from plan"

    echo ""
}

#
# Test: Completed implementation
#
test_completed_implementation() {
    echo -e "${YELLOW}Test: Completed implementation${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'
    create_planning_file "auth-system" "---
topic: auth-system
status: concluded
format: local-markdown
---

# Auth System Plan"
    create_task_file "auth-system" "auth-system-1-1"

    create_implementation_file "auth-system" "---
status: completed
current_phase: ~
current_task: ~
completed_tasks:
  - auth-system-1-1
completed_phases:
  - 1
---

# Auth System Implementation"

    local output=$(run_discovery)

    assert_contains "$output" 'completed: 1' "Completed count is 1"

    echo ""
}

#
# Test: Full workflow state across all phases
#
test_full_workflow() {
    echo -e "${YELLOW}Test: Full workflow state across all phases${NC}"
    setup_fixture

    # Feature with discussion concluded
    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'

    # Feature with discussion in-progress
    create_manifest "caching" "feature" '{"discussion": {"status": "in-progress"}}'

    # Feature with concluded spec and sources
    create_manifest "auth-system" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded", "type": "feature"}, "planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress", "current_phase": 1}}'
    create_spec_file "auth-system" "---
topic: auth-system
status: concluded
type: feature
sources:
  - name: auth-flow
    status: incorporated
  - name: session-mgmt
    status: incorporated
---
Spec"
    create_planning_file "auth-system" "---
topic: auth-system
status: concluded
format: local-markdown
---
Plan"
    create_task_file "auth-system" "auth-system-1-1"
    create_task_file "auth-system" "auth-system-1-2"
    create_implementation_file "auth-system" "---
status: in-progress
current_phase: 1
completed_tasks:
  - auth-system-1-1
---
Tracking"

    # Cross-cutting spec (in-progress)
    create_manifest "caching-policy" "feature" '{"specification": {"status": "in-progress", "type": "cross-cutting"}}'

    local output=$(run_discovery)

    # Work type counts
    assert_contains "$output" 'feature: 4' "4 feature work units"

    # Discussion counts
    assert_contains "$output" 'concluded: 2' "2 concluded discussions"

    # Spec counts
    assert_contains "$output" 'crosscutting: 1' "1 cross-cutting spec"

    # Implementation
    assert_contains "$output" 'completed_tasks: 1' "1 completed task"
    assert_contains "$output" 'total_tasks: 2' "2 total tasks"

    echo ""
}

#
# Test: Plan status counts
#
test_plan_status_counts() {
    echo -e "${YELLOW}Test: Plan status counts${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
    create_manifest "billing" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'concluded: 1' "1 concluded plan"
    assert_contains "$output" 'in_progress: 1' "1 in-progress plan"

    echo ""
}

#
# Test: By work type counts
#
test_by_work_type_counts() {
    echo -e "${YELLOW}Test: By work type counts${NC}"
    setup_fixture

    create_manifest "feature-a" "feature" '{"discussion": {"status": "in-progress"}}'
    create_manifest "feature-b" "feature" '{"discussion": {"status": "concluded"}}'
    create_manifest "bug-a" "bugfix" '{"investigation": {"status": "in-progress"}}'
    create_manifest "big-project" "epic" '{"research": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'epic: 1' "1 epic work unit"
    assert_contains "$output" 'feature: 2' "2 feature work units"
    assert_contains "$output" 'bugfix: 1' "1 bugfix work unit"
    assert_contains "$output" 'has_any_work: true' "has_any_work is true"

    echo ""
}

#
# Test: Spec defaults to feature type when not specified
#
test_spec_default_type() {
    echo -e "${YELLOW}Test: Spec defaults to feature type when type not in manifest${NC}"
    setup_fixture

    create_manifest "legacy" "feature" '{"specification": {"status": "concluded"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'type: "feature"' "Defaults to feature"

    echo ""
}

#
# Test: Bugfix with investigation phase
#
test_bugfix_investigation() {
    echo -e "${YELLOW}Test: Bugfix with investigation phase${NC}"
    setup_fixture

    create_manifest "login-crash" "bugfix" '{"investigation": {"status": "in-progress"}}'

    local output=$(run_discovery)

    assert_contains "$output" 'work_type: "bugfix"' "Work type is bugfix"
    assert_contains "$output" 'bugfix: 1' "Bugfix count is 1"

    echo ""
}

#
# Test: Epic with research phase
#
test_epic_research() {
    echo -e "${YELLOW}Test: Epic with research phase${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"research": {"status": "in-progress"}}'
    # Create a research file for the file_count
    mkdir -p "$TEST_DIR/.workflows/big-project/research"
    echo "# Research" > "$TEST_DIR/.workflows/big-project/research/exploration.md"

    local output=$(run_discovery)

    assert_contains "$output" 'work_type: "epic"' "Work type is epic"
    assert_contains "$output" 'epic: 1' "Epic count is 1"

    echo ""
}

#
# Run all tests
#
echo "=========================================="
echo "Running discovery-for-status.sh tests"
echo "=========================================="
echo ""

test_empty_state
test_single_feature_discussion
test_spec_with_sources
test_spec_pending_source
test_crosscutting_spec
test_superseded_spec
test_plan_with_deps
test_plan_resolved_deps
test_implementation_tracking
test_completed_implementation
test_full_workflow
test_plan_status_counts
test_by_work_type_counts
test_spec_default_type
test_bugfix_investigation
test_epic_research

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
