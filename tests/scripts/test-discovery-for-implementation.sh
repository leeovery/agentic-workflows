#!/bin/bash
#
# Tests the discovery script for /start-implementation against various workflow states.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Implementation discovery reads:
# - Plans from manifest CLI (phases.planning)
# - Implementation state from manifest CLI (phases.implementation)
# - planning.md and implementation.md from work-unit dirs
# - External dependencies from manifest CLI
# - Environment setup from .workflows/environment-setup.md
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-implementation/scripts/discovery.sh"

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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: No work units (no plans)${NC}"
setup_fixture

output=$(run_discovery)

assert_contains "$output" "plans:" "Has plans section"
assert_contains "$output" "exists: false" "Plans don't exist"
assert_contains "$output" "count: 0" "Plan count is 0"
assert_contains "$output" 'scenario: "no_plans"' "Scenario is no_plans"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Single plan with full manifest data${NC}"
setup_fixture

create_manifest "user-auth" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}, "specification": {"status": "concluded"}}'
create_planning_file "user-auth" "---
topic: user-auth
status: in-progress
format: local-markdown
specification: user-auth/specification/specification.md
---

# Implementation Plan: User Authentication"

output=$(run_discovery)

assert_contains "$output" "exists: true" "Plans exist"
assert_contains "$output" "count: 1" "Plan count is 1"
assert_contains "$output" 'name: "user-auth"' "Plan name extracted"
assert_contains "$output" 'topic: "user-auth"' "Topic extracted"
assert_contains "$output" 'status: "in-progress"' "Status extracted"
assert_contains "$output" 'format: "local-markdown"' "Format extracted"
assert_contains "$output" 'scenario: "single_plan"' "Scenario is single_plan"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple plans${NC}"
setup_fixture

create_manifest "feature-a" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "feature-a" "---
topic: feature-a
status: in-progress
format: local-markdown
---

# Implementation Plan: Feature A"

create_manifest "feature-b" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "feature-b" "---
topic: feature-b
status: concluded
format: local-markdown
---

# Implementation Plan: Feature B"

output=$(run_discovery)

assert_contains "$output" "count: 2" "Plan count is 2"
assert_contains "$output" 'name: "feature-a"' "First plan found"
assert_contains "$output" 'name: "feature-b"' "Second plan found"
assert_contains "$output" 'scenario: "multiple_plans"' "Scenario is multiple_plans"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with concluded status${NC}"
setup_fixture

create_manifest "completed-feature" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "completed-feature" "---
topic: completed-feature
status: concluded
format: local-markdown
---

# Implementation Plan: Completed Feature"

output=$(run_discovery)

assert_contains "$output" 'status: "concluded"' "Concluded status preserved"
assert_contains "$output" 'scenario: "single_plan"' "Concluded plans still shown"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with linked specification that exists${NC}"
setup_fixture

create_manifest "with-spec" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}, "specification": {"status": "concluded"}}'
create_planning_file "with-spec" "---
topic: with-spec
status: in-progress
format: local-markdown
---

# Implementation Plan: With Spec"
mkdir -p "$TEST_DIR/.workflows/with-spec/specification"
echo "# Spec" > "$TEST_DIR/.workflows/with-spec/specification/specification.md"

output=$(run_discovery)

assert_contains "$output" "specification_exists: true" "Specification exists flag is true"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with linked specification that doesn't exist${NC}"
setup_fixture

create_manifest "no-spec" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "no-spec" "---
topic: no-spec
status: in-progress
format: local-markdown
---

# Implementation Plan: No Spec"

output=$(run_discovery)

assert_contains "$output" "specification_exists: false" "Specification exists flag is false"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Environment setup file exists with setup required${NC}"
setup_fixture

create_manifest "test" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "test" "---
topic: test
status: in-progress
format: local-markdown
---

# Implementation Plan: Test"

cat > "$TEST_DIR/.workflows/environment-setup.md" << 'EOF'
# Environment Setup

Run the following commands:

1. npm install
2. cp .env.example .env
EOF

output=$(run_discovery)

assert_contains "$output" "setup_file_exists: true" "Setup file exists"
assert_contains "$output" "requires_setup: true" "Setup is required"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Environment setup file with no special setup required${NC}"
setup_fixture

create_manifest "test" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "test" "---
topic: test
status: in-progress
format: local-markdown
---

# Implementation Plan: Test"

cat > "$TEST_DIR/.workflows/environment-setup.md" << 'EOF'
# Environment Setup

No special setup required.
EOF

output=$(run_discovery)

assert_contains "$output" "setup_file_exists: true" "Setup file exists"
assert_contains "$output" "requires_setup: false" "No setup required"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No environment setup file${NC}"
setup_fixture

create_manifest "test" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "test" "---
topic: test
status: in-progress
format: local-markdown
---

# Implementation Plan: Test"

output=$(run_discovery)

assert_contains "$output" "setup_file_exists: false" "Setup file doesn't exist"
assert_contains "$output" "requires_setup: unknown" "Setup requirement unknown"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with plan_id (beads format)${NC}"
setup_fixture

create_manifest "with-plan-id" "feature" '{"planning": {"status": "in-progress", "format": "beads", "plan_id": "my-project-abc123"}}'
create_planning_file "with-plan-id" "---
topic: with-plan-id
status: in-progress
format: beads
plan_id: my-project-abc123
---

# Implementation Plan: With Plan ID"

output=$(run_discovery)

assert_contains "$output" 'plan_id: "my-project-abc123"' "Plan ID extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan without plan_id (local-markdown)${NC}"
setup_fixture

create_manifest "no-plan-id" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "no-plan-id" "---
topic: no-plan-id
status: in-progress
format: local-markdown
---

# Implementation Plan: No Plan ID"

output=$(run_discovery)

assert_not_contains "$output" "plan_id:" "No plan_id when not present"

echo ""

# ============================================================================
# EXTERNAL DEPENDENCIES FROM MANIFEST
# ============================================================================

echo -e "${YELLOW}Test: Plan with empty external_dependencies${NC}"
setup_fixture

create_manifest "no-deps" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": []}}'
create_planning_file "no-deps" "---
topic: no-deps
status: concluded
format: local-markdown
---

# Plan: No Deps"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: false" "No unresolved deps with empty array"
assert_contains "$output" "unresolved_dep_count: 0" "Unresolved dep count is 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with unresolved dependency${NC}"
setup_fixture

create_manifest "has-unresolved" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "billing-system", "description": "Invoice generation for order completion", "state": "unresolved"}]}}'
create_planning_file "has-unresolved" "---
topic: has-unresolved
status: concluded
format: local-markdown
---

# Plan: Has Unresolved"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: true" "Has unresolved deps"
assert_contains "$output" "unresolved_dep_count: 1" "Unresolved dep count is 1"
assert_contains "$output" 'topic: "billing-system"' "Unresolved dep topic extracted"
assert_contains "$output" 'state: "unresolved"' "Unresolved dep state extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with resolved dependency${NC}"
setup_fixture

create_manifest "has-resolved" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "authentication", "description": "User context for permissions", "state": "resolved", "task_id": "auth-1-3"}]}}'
create_planning_file "has-resolved" "---
topic: has-resolved
status: concluded
format: local-markdown
---

# Plan: Has Resolved"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: false" "No unresolved deps"
assert_contains "$output" 'topic: "authentication"' "Resolved dep topic extracted"
assert_contains "$output" 'state: "resolved"' "Resolved dep state extracted"
assert_contains "$output" 'task_id: "auth-1-3"' "Resolved dep task_id extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with satisfied_externally dependency${NC}"
setup_fixture

create_manifest "has-external" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "payment-gateway", "description": "Payment processing", "state": "satisfied_externally"}]}}'
create_planning_file "has-external" "---
topic: has-external
status: concluded
format: local-markdown
---

# Plan: Has External"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: false" "No unresolved deps for externally satisfied"
assert_contains "$output" 'state: "satisfied_externally"' "Externally satisfied state extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with mixed dependencies${NC}"
setup_fixture

create_manifest "mixed-deps" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "billing-system", "description": "Invoice generation", "state": "unresolved"}, {"topic": "authentication", "description": "User context", "state": "resolved", "task_id": "auth-1-3"}, {"topic": "payment-gateway", "description": "Payment processing", "state": "satisfied_externally"}]}}'
create_planning_file "mixed-deps" "---
topic: mixed-deps
status: concluded
format: local-markdown
---

# Plan: Mixed Deps"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: true" "Has unresolved deps in mixed"
assert_contains "$output" "unresolved_dep_count: 1" "Only 1 unresolved in mixed"
assert_contains "$output" 'topic: "billing-system"' "First dep topic"
assert_contains "$output" 'topic: "authentication"' "Second dep topic"
assert_contains "$output" 'topic: "payment-gateway"' "Third dep topic"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan without external_dependencies field${NC}"
setup_fixture

create_manifest "legacy" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "legacy" "---
topic: legacy
status: concluded
format: local-markdown
---

# Plan: Legacy"

output=$(run_discovery)

assert_contains "$output" "has_unresolved_deps: false" "No unresolved deps for legacy plan"
assert_contains "$output" "unresolved_dep_count: 0" "Zero unresolved for legacy plan"

echo ""

# ============================================================================
# IMPLEMENTATION TRACKING
# ============================================================================

echo -e "${YELLOW}Test: No implementation directory${NC}"
setup_fixture

create_manifest "test" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "test" "---
topic: test
status: concluded
format: local-markdown
---

# Plan: Test"

output=$(run_discovery)

assert_contains "$output" "implementation:" "Has implementation section"
assert_contains "$output" "exists: false" "Implementation does not exist"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Implementation tracking file - in-progress${NC}"
setup_fixture

create_manifest "core-features" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress", "current_phase": 2, "completed_phases": [1], "completed_tasks": ["core-1-1", "core-1-2", "core-1-3", "core-2-1", "core-2-2"]}}'
create_planning_file "core-features" "---
topic: core-features
status: concluded
format: local-markdown
---

# Plan: Core Features"
create_implementation_file "core-features" "---
topic: core-features
status: in-progress
current_phase: 2
---

# Implementation: Core Features"

output=$(run_discovery)

assert_contains "$output" 'topic: "core-features"' "Tracking file topic extracted"
assert_contains "$output" 'status: "in-progress"' "Tracking file status extracted"
assert_contains "$output" "current_phase: 2" "Current phase extracted"
assert_contains "$output" "completed_phases: [1]" "Completed phases extracted"
assert_contains "$output" '"core-1-1"' "Completed task extracted"
assert_contains "$output" '"core-2-2"' "Last completed task extracted"
assert_contains "$output" "plans_in_progress_count: 1" "In-progress count is 1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Implementation tracking file - completed${NC}"
setup_fixture

create_manifest "user-auth" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed", "current_phase": 3, "completed_phases": [1, 2, 3], "completed_tasks": ["auth-1-1", "auth-1-2", "auth-1-3", "auth-2-1"]}}'
create_planning_file "user-auth" "---
topic: user-auth
status: concluded
format: local-markdown
---

# Plan: User Auth"
create_implementation_file "user-auth" "---
topic: user-auth
status: completed
---

# Implementation: User Auth"

output=$(run_discovery)

assert_contains "$output" 'status: "completed"' "Completed status extracted"
assert_contains "$output" "completed_phases: [1, 2, 3]" "All completed phases extracted"
assert_contains "$output" '"auth-1-3"' "Specific completed task in list"
assert_contains "$output" "plans_completed_count: 1" "Completed count is 1"

echo ""

# ============================================================================
# DEPENDENCY RESOLUTION
# ============================================================================

echo -e "${YELLOW}Test: Resolved dep with task in completed_tasks${NC}"
setup_fixture

# billing plan depends on user-auth task auth-1-3
create_manifest "billing" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "user-auth", "description": "User context for permissions", "state": "resolved", "task_id": "auth-1-3"}]}}'
create_planning_file "billing" "---
topic: billing
status: concluded
format: local-markdown
---

# Plan: Billing"

# user-auth has completed the required task
create_manifest "user-auth" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed", "completed_phases": [1, 2, 3], "completed_tasks": ["auth-1-1", "auth-1-2", "auth-1-3"]}}'
create_planning_file "user-auth" "---
topic: user-auth
status: concluded
format: local-markdown
---

# Plan: User Auth"
create_implementation_file "user-auth" "---
topic: user-auth
status: completed
---

# Implementation: User Auth"

output=$(run_discovery)

assert_contains "$output" "deps_satisfied: true" "Deps satisfied when task completed"
assert_contains "$output" "plans_ready_count: 1" "Plan is ready"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Resolved dep with task NOT in completed_tasks${NC}"
setup_fixture

# billing plan depends on core-features task core-2-3
create_manifest "billing" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "core-features", "description": "Core logic needed", "state": "resolved", "task_id": "core-2-3"}]}}'
create_planning_file "billing" "---
topic: billing
status: concluded
format: local-markdown
---

# Plan: Billing"

# core-features is in progress, task core-2-3 NOT completed yet
create_manifest "core-features" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress", "current_phase": 2, "completed_phases": [1], "completed_tasks": ["core-1-1", "core-2-1", "core-2-2"]}}'
create_planning_file "core-features" "---
topic: core-features
status: concluded
format: local-markdown
---

# Plan: Core Features"
create_implementation_file "core-features" "---
topic: core-features
status: in-progress
---

# Implementation: Core Features"

output=$(run_discovery)

assert_contains "$output" "deps_satisfied: false" "Deps not satisfied when task incomplete"
assert_contains "$output" 'task_id: "core-2-3"' "Blocking task_id listed"
assert_contains "$output" "task not yet completed" "Blocking reason given"
assert_contains "$output" "plans_ready_count: 0" "Plan is not ready"

echo ""

# ============================================================================
# STATE SUMMARY COUNTS
# ============================================================================

echo -e "${YELLOW}Test: State summary counts with multiple plans${NC}"
setup_fixture

# Concluded plan, no deps, no impl -> ready
create_manifest "feature-a" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": []}}'
create_planning_file "feature-a" "---
topic: feature-a
status: concluded
format: local-markdown
---

# Plan: Feature A"

# Concluded plan with unresolved dep -> not ready
create_manifest "feature-b" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "feature-c", "description": "Needs feature C", "state": "unresolved"}]}}'
create_planning_file "feature-b" "---
topic: feature-b
status: concluded
format: local-markdown
---

# Plan: Feature B"

# In-progress plan -> not concluded
create_manifest "feature-c" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown", "external_dependencies": []}}'
create_planning_file "feature-c" "---
topic: feature-c
status: in-progress
format: local-markdown
---

# Plan: Feature C"

# Concluded with completed impl
create_manifest "feature-d" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": []}, "implementation": {"status": "completed", "completed_phases": [1, 2], "completed_tasks": ["d-1-1", "d-2-1"]}}'
create_planning_file "feature-d" "---
topic: feature-d
status: concluded
format: local-markdown
---

# Plan: Feature D"
create_implementation_file "feature-d" "---
topic: feature-d
status: completed
---

# Implementation: Feature D"

output=$(run_discovery)

assert_contains "$output" "plan_count: 4" "Total plan count is 4"
assert_contains "$output" "plans_concluded_count: 3" "Concluded count is 3"
assert_contains "$output" "plans_with_unresolved_deps: 1" "Plans with unresolved deps is 1"
assert_contains "$output" "plans_ready_count: 2" "Plans ready count is 2 (A and D)"
assert_contains "$output" "plans_completed_count: 1" "Plans completed count is 1"

echo ""

# ============================================================================
# WORK TYPE
# ============================================================================

echo -e "${YELLOW}Test: Plan work_type output${NC}"
setup_fixture

create_manifest "typed-plan" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "typed-plan" "---
topic: typed-plan
status: in-progress
format: local-markdown
---

# Implementation Plan: Typed Plan"

output=$(run_discovery)

assert_contains "$output" 'work_type: "feature"' "work_type feature in plan output"

echo ""

# ============================================================================
# RESOLVED DEP WITHOUT TRACKING FILE
# ============================================================================

echo -e "${YELLOW}Test: Resolved dep with no tracking file for dep topic${NC}"
setup_fixture

create_manifest "needs-foo" "feature" '{"planning": {"status": "concluded", "format": "local-markdown", "external_dependencies": [{"topic": "foo", "description": "Needs foo completed", "state": "resolved", "task_id": "foo-1-1"}]}}'
create_planning_file "needs-foo" "---
topic: needs-foo
status: concluded
format: local-markdown
---

# Plan: Needs Foo"

output=$(run_discovery)

assert_contains "$output" "deps_satisfied: false" "Deps not satisfied when no tracking file"
assert_contains "$output" "plans_ready_count: 0" "Plan not ready when dep tracking missing"

echo ""

# ============================================================================
# HAS_PLANS STATE FIELD
# ============================================================================

echo -e "${YELLOW}Test: has_plans false when no work units${NC}"
setup_fixture

output=$(run_discovery)

assert_contains "$output" "has_plans: false" "has_plans false with no plans"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: has_plans true when plans exist${NC}"
setup_fixture

create_manifest "some-plan" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "some-plan" "---
topic: some-plan
status: in-progress
format: local-markdown
---

# Implementation Plan: Some Plan"

output=$(run_discovery)

assert_contains "$output" "has_plans: true" "has_plans true with plans"

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
