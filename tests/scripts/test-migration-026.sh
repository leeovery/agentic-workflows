#!/bin/bash
#
# Tests migration 026-rename-review-artifacts.sh
# Validates renaming review.md → report.md and qa-task-{N}.md → report-{phase_id}-{task_id}.md
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/026-rename-review-artifacts.sh"

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

create_plan_with_tasks() {
    local wu="$1"
    local topic="$2"
    shift 2
    local ids=("$@")

    mkdir -p "$TEST_DIR/.workflows/$wu/planning/$topic"
    local plan="$TEST_DIR/.workflows/$wu/planning/$topic/planning.md"

    echo "# Plan" > "$plan"
    echo "" >> "$plan"
    echo "| Internal ID | Task | Phase |" >> "$plan"
    echo "|-------------|------|-------|" >> "$plan"
    for id in "${ids[@]}"; do
        echo "| $id | Task description | Phase 1 |" >> "$plan"
    done
}

create_review_files() {
    local wu="$1"
    local topic="$2"
    shift 2

    mkdir -p "$TEST_DIR/.workflows/$wu/review/$topic"

    # Create review.md
    echo "# Review" > "$TEST_DIR/.workflows/$wu/review/$topic/review.md"

    # Create qa-task files
    local n=1
    for _ in "$@"; do
        echo "QA findings for task $n" > "$TEST_DIR/.workflows/$wu/review/$topic/qa-task-${n}.md"
        n=$((n + 1))
    done
}

# Stub report functions for migration script
report_update() { echo "updated: $1 — $2"; }
report_skip() { echo "skipped: $1 — $2"; }
export -f report_update
export -f report_skip

run_migration() {
    cd "$TEST_DIR"
    PROJECT_DIR="$TEST_DIR" bash "$MIGRATION_SCRIPT" 2>&1
}

assert_file_exists() {
    local path="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$path" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_not_exists() {
    local path="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -f "$path" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File should not exist: $path"
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

echo -e "${YELLOW}Test: feature — review.md renamed to report.md, qa-task files renamed${NC}"
setup_fixture

create_manifest "my-feat" '{"name":"my-feat","work_type":"feature","status":"in-progress","phases":{}}'
create_plan_with_tasks "my-feat" "my-feat" "my-feat-1-1" "my-feat-1-2" "my-feat-2-1"
create_review_files "my-feat" "my-feat" t1 t2 t3

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/report.md" "review.md renamed to report.md"
assert_file_not_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/review.md" "old review.md removed"
assert_file_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/report-1-1.md" "qa-task-1.md → report-1-1.md"
assert_file_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/report-1-2.md" "qa-task-2.md → report-1-2.md"
assert_file_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/report-2-1.md" "qa-task-3.md → report-2-1.md"
assert_file_not_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-1.md" "old qa-task-1.md removed"
assert_file_not_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-2.md" "old qa-task-2.md removed"
assert_file_not_exists "$TEST_DIR/.workflows/my-feat/review/my-feat/qa-task-3.md" "old qa-task-3.md removed"
assert_contains "$output" "renamed review.md" "Reports review.md rename"
assert_contains "$output" "report-1-1.md" "Reports qa-task rename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic with multiple topics${NC}"
setup_fixture

create_manifest "my-epic" '{"name":"my-epic","work_type":"epic","status":"in-progress","phases":{}}'
create_plan_with_tasks "my-epic" "auth" "auth-1-1" "auth-1-2"
create_plan_with_tasks "my-epic" "billing" "billing-1-1"
create_review_files "my-epic" "auth" t1 t2
create_review_files "my-epic" "billing" t1

run_migration > /dev/null

assert_file_exists "$TEST_DIR/.workflows/my-epic/review/auth/report.md" "auth: review.md → report.md"
assert_file_exists "$TEST_DIR/.workflows/my-epic/review/auth/report-1-1.md" "auth: qa-task-1 → report-1-1"
assert_file_exists "$TEST_DIR/.workflows/my-epic/review/auth/report-1-2.md" "auth: qa-task-2 → report-1-2"
assert_file_exists "$TEST_DIR/.workflows/my-epic/review/billing/report.md" "billing: review.md → report.md"
assert_file_exists "$TEST_DIR/.workflows/my-epic/review/billing/report-1-1.md" "billing: qa-task-1 → report-1-1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: already migrated — skip gracefully${NC}"
setup_fixture

create_manifest "done" '{"name":"done","work_type":"feature","status":"completed","phases":{}}'
mkdir -p "$TEST_DIR/.workflows/done/review/done"
echo "# Report" > "$TEST_DIR/.workflows/done/review/done/report.md"
echo "findings" > "$TEST_DIR/.workflows/done/review/done/report-1-1.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/done/review/done/report.md" "report.md still exists"
assert_file_exists "$TEST_DIR/.workflows/done/review/done/report-1-1.md" "report-1-1.md still exists"
assert_not_contains "$output" "renamed" "No renames reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no plan exists — review.md renamed, qa-task files skipped${NC}"
setup_fixture

create_manifest "no-plan" '{"name":"no-plan","work_type":"feature","status":"in-progress","phases":{}}'
mkdir -p "$TEST_DIR/.workflows/no-plan/review/no-plan"
echo "# Review" > "$TEST_DIR/.workflows/no-plan/review/no-plan/review.md"
echo "findings" > "$TEST_DIR/.workflows/no-plan/review/no-plan/qa-task-1.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/no-plan/review/no-plan/report.md" "review.md still renamed"
assert_file_exists "$TEST_DIR/.workflows/no-plan/review/no-plan/qa-task-1.md" "qa-task-1 preserved (no plan)"
assert_contains "$output" "no plan found" "Reports skip reason"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: count mismatch — qa-task files skipped${NC}"
setup_fixture

create_manifest "mismatch" '{"name":"mismatch","work_type":"feature","status":"in-progress","phases":{}}'
create_plan_with_tasks "mismatch" "mismatch" "mismatch-1-1" "mismatch-1-2"
mkdir -p "$TEST_DIR/.workflows/mismatch/review/mismatch"
echo "# Review" > "$TEST_DIR/.workflows/mismatch/review/mismatch/review.md"
echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-1.md"
echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-2.md"
echo "findings" > "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-3.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/mismatch/review/mismatch/report.md" "review.md still renamed"
assert_file_exists "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-1.md" "qa-task-1 preserved (mismatch)"
assert_file_exists "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-2.md" "qa-task-2 preserved (mismatch)"
assert_file_exists "$TEST_DIR/.workflows/mismatch/review/mismatch/qa-task-3.md" "qa-task-3 preserved (mismatch)"
assert_contains "$output" "qa-task count (3) != plan task count (2)" "Reports mismatch"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: topic with hyphens — suffix derived correctly${NC}"
setup_fixture

create_manifest "auto-cascade-parent-status" '{"name":"auto-cascade-parent-status","work_type":"feature","status":"in-progress","phases":{}}'
create_plan_with_tasks "auto-cascade-parent-status" "auto-cascade-parent-status" \
    "auto-cascade-parent-status-1-1" "auto-cascade-parent-status-1-2"
create_review_files "auto-cascade-parent-status" "auto-cascade-parent-status" t1 t2

run_migration > /dev/null

assert_file_exists "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-1.md" "Hyphenated topic: correct suffix 1-1"
assert_file_exists "$TEST_DIR/.workflows/auto-cascade-parent-status/review/auto-cascade-parent-status/report-1-2.md" "Hyphenated topic: correct suffix 1-2"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{"name":"idem","work_type":"feature","status":"in-progress","phases":{}}'
create_plan_with_tasks "idem" "idem" "idem-1-1"
create_review_files "idem" "idem" t1

run_migration > /dev/null
output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/idem/review/idem/report.md" "report.md still correct"
assert_file_exists "$TEST_DIR/.workflows/idem/review/idem/report-1-1.md" "report-1-1.md still correct"
assert_not_contains "$output" "renamed" "No renames on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "updated" "No updates without .workflows dir"
assert_not_contains "$output" "renamed" "No renames without .workflows dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no review directory — skips work unit${NC}"
setup_fixture

create_manifest "no-review" '{"name":"no-review","work_type":"feature","status":"in-progress","phases":{}}'

output=$(run_migration)

assert_not_contains "$output" "renamed" "No renames without review dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: review.md only, no qa-task files — just renames review.md${NC}"
setup_fixture

create_manifest "review-only" '{"name":"review-only","work_type":"feature","status":"in-progress","phases":{}}'
mkdir -p "$TEST_DIR/.workflows/review-only/review/review-only"
echo "# Review" > "$TEST_DIR/.workflows/review-only/review/review-only/review.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/review-only/review/review-only/report.md" "review.md renamed"
assert_file_not_exists "$TEST_DIR/.workflows/review-only/review/review-only/review.md" "old review.md gone"
assert_contains "$output" "renamed review.md" "Reports rename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state/review/topic"
echo '{"name":".state"}' > "$TEST_DIR/.workflows/.state/manifest.json"
echo "# Review" > "$TEST_DIR/.workflows/.state/review/topic/review.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/.state/review/topic/review.md" "Dot-dir review.md untouched"
assert_not_contains "$output" "renamed" "No renames for dot dirs"

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
