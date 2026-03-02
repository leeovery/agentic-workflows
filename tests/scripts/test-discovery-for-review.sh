#!/bin/bash
#
# Tests the discovery script for /start-review against various workflow states.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Review discovery reads:
# - Plans from manifest CLI (phases.planning)
# - Implementation state from manifest CLI (phases.implementation)
# - Review dirs from .workflows/{name}/review/r*/review.md
# - planning.md from work-unit dirs
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-review/scripts/discovery.sh"

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

create_review_file() {
    local wu_name="$1"
    local version="$2"
    local content="$3"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/review/r${version}"
    cat > "$TEST_DIR/.workflows/$wu_name/review/r${version}/review.md" << EOF
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

create_manifest "user-auth" "feature" '{"planning": {"status": "in-progress", "format": "local-markdown"}}'
create_planning_file "user-auth" "---
topic: user-auth
status: in-progress
format: local-markdown
---

# Implementation Plan: User Authentication"

output=$(run_discovery)

assert_contains "$output" "exists: true" "Plans exist"
assert_contains "$output" "count: 1" "Plan count is 1"
assert_contains "$output" 'name: "user-auth"' "Plan name extracted"
assert_contains "$output" 'planning_status: "in-progress"' "Planning status extracted"
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

echo -e "${YELLOW}Test: Plan with no review${NC}"
setup_fixture

create_manifest "no-review" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "no-review" "---
topic: no-review
status: concluded
format: local-markdown
---

# Plan: No Review"

output=$(run_discovery)

assert_contains "$output" "review_count: 0" "Review count is 0 when no review exists"
assert_not_contains "$output" "latest_review_version:" "No latest_review_version when unreviewed"
assert_not_contains "$output" "latest_review_verdict:" "No latest_review_verdict when unreviewed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with single review${NC}"
setup_fixture

create_manifest "single-review" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "review": {"status": "completed"}}'
create_planning_file "single-review" "---
topic: single-review
status: concluded
format: local-markdown
---

# Plan: Single Review"

create_review_file "single-review" "1" "---
topic: single-review
---

**QA Verdict**: Approve

# Review: Single Review"

output=$(run_discovery)

assert_contains "$output" "review_count: 1" "Review count is 1"
assert_contains "$output" "latest_review_version: 1" "Latest review version is 1"
assert_contains "$output" 'latest_review_verdict: "Approve"' "Latest verdict is Approve"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with multiple reviews${NC}"
setup_fixture

create_manifest "multi-review" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "review": {"status": "completed"}}'
create_planning_file "multi-review" "---
topic: multi-review
status: concluded
format: local-markdown
---

# Plan: Multi Review"

create_review_file "multi-review" "1" "---
topic: multi-review
---

**QA Verdict**: Request Changes

# Review: Multi Review r1"

create_review_file "multi-review" "2" "---
topic: multi-review
---

**QA Verdict**: Approve

# Review: Multi Review r2"

output=$(run_discovery)

assert_contains "$output" "review_count: 2" "Review count is 2"
assert_contains "$output" "latest_review_version: 2" "Latest review version is 2"
assert_contains "$output" 'latest_review_verdict: "Approve"' "Latest verdict from r2 (not r1)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review dir exists but no review.md files${NC}"
setup_fixture

create_manifest "empty-review" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "empty-review" "---
topic: empty-review
status: concluded
format: local-markdown
---

# Plan: Empty Review"

# r1 directory exists but no review.md inside it
mkdir -p "$TEST_DIR/.workflows/empty-review/review/r1"

output=$(run_discovery)

assert_contains "$output" "review_count: 0" "Review count is 0 when review dir has no review.md"
assert_not_contains "$output" "latest_review_version:" "No latest_review_version for empty review dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review script does not output implementation-specific sections${NC}"
setup_fixture

create_manifest "test" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "test" "---
topic: test
status: concluded
format: local-markdown
---

# Plan: Test"

output=$(run_discovery)

assert_not_contains "$output" "dependency_resolution:" "No dependency_resolution section"
assert_not_contains "$output" "environment:" "No environment section"
assert_not_contains "$output" "plans_concluded_count:" "No plans_concluded_count"
assert_not_contains "$output" "plans_ready_count:" "No plans_ready_count"
assert_not_contains "$output" "plans_in_progress_count:" "No plans_in_progress_count"
assert_not_contains "$output" "plans_completed_count:" "No plans_completed_count"
assert_not_contains "$output" "external_deps:" "No external_deps"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with implementation in-progress${NC}"
setup_fixture

create_manifest "impl-wip" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress"}}'
create_planning_file "impl-wip" "---
topic: impl-wip
status: concluded
format: local-markdown
---

# Plan: Impl WIP"

output=$(run_discovery)

assert_contains "$output" 'implementation_status: "in-progress"' "Implementation status is in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with implementation completed${NC}"
setup_fixture

create_manifest "impl-done" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'
create_planning_file "impl-done" "---
topic: impl-done
status: concluded
format: local-markdown
---

# Plan: Impl Done"

output=$(run_discovery)

assert_contains "$output" 'implementation_status: "completed"' "Implementation status is completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Implemented count with mixed plans${NC}"
setup_fixture

create_manifest "has-impl" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "in-progress"}}'
create_planning_file "has-impl" "---
topic: has-impl
status: concluded
format: local-markdown
---

# Plan: Has Impl"

create_manifest "no-impl" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "no-impl" "---
topic: no-impl
status: concluded
format: local-markdown
---

# Plan: No Impl"

output=$(run_discovery)

assert_contains "$output" "implemented_count: 1" "Implemented count is 1 (one plan with impl)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Reviewed plan count${NC}"
setup_fixture

create_manifest "reviewed-topic" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "review": {"status": "completed"}}'
create_planning_file "reviewed-topic" "---
topic: reviewed-topic
status: concluded
format: local-markdown
---

# Plan: Reviewed Topic"
create_review_file "reviewed-topic" "1" "---
topic: reviewed-topic
---

**QA Verdict**: Approve

# Review"

create_manifest "unreviewed-topic" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "unreviewed-topic" "---
topic: unreviewed-topic
status: concluded
format: local-markdown
---

# Plan: Unreviewed Topic"

output=$(run_discovery)

assert_contains "$output" "reviewed_plan_count: 1" "Reviewed plan count is 1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: All reviewed true${NC}"
setup_fixture

create_manifest "all-rev" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'
create_planning_file "all-rev" "---
topic: all-rev
status: concluded
format: local-markdown
---

# Plan"
create_review_file "all-rev" "1" "---
topic: all-rev
---

**QA Verdict**: Approve

# Review"

output=$(run_discovery)

assert_contains "$output" "all_reviewed: true" "All reviewed is true when all implemented plans are reviewed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: All reviewed false${NC}"
setup_fixture

create_manifest "rev-yes" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}, "review": {"status": "completed"}}'
create_planning_file "rev-yes" "---
topic: rev-yes
status: concluded
format: local-markdown
---

# Plan"
create_review_file "rev-yes" "1" "---
topic: rev-yes
---

**QA Verdict**: Approve

# Review"

create_manifest "rev-no" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "implementation": {"status": "completed"}}'
create_planning_file "rev-no" "---
topic: rev-no
status: concluded
format: local-markdown
---

# Plan"

output=$(run_discovery)

assert_contains "$output" "all_reviewed: false" "All reviewed is false when not all implemented plans are reviewed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Reviews section with existing review${NC}"
setup_fixture

create_manifest "rev-section" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}, "review": {"status": "completed"}}'
create_planning_file "rev-section" "---
topic: rev-section
status: concluded
format: local-markdown
---

# Plan"
create_review_file "rev-section" "1" "---
topic: rev-section
---

**QA Verdict**: Approve

# Review"

output=$(run_discovery)

assert_contains "$output" "reviews:" "Reviews section exists"
assert_contains "$output" "exists: true" "Reviews exists is true"
assert_contains "$output" 'name: "rev-section"' "Review topic appears in reviews section"
assert_contains "$output" "latest_version: 1" "Latest version is 1"
assert_contains "$output" "Approve" "Latest verdict contains Approve"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Reviews section empty (no review dir)${NC}"
setup_fixture

create_manifest "no-rev-dir" "feature" '{"planning": {"status": "concluded", "format": "local-markdown"}}'
create_planning_file "no-rev-dir" "---
topic: no-rev-dir
status: concluded
format: local-markdown
---

# Plan"

output=$(run_discovery)

assert_contains "$output" "reviews:" "Reviews section exists"
assert_not_contains "$output" "entries:" "No entries in reviews section"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan with plan_id${NC}"
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

echo -e "${YELLOW}Test: Plan without plan_id${NC}"
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
