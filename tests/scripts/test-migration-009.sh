#!/bin/bash
#
# Tests migration 009-review-per-plan-storage.sh
# Validates restructuring of review directories to per-plan storage.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/009-review-per-plan-storage.sh"

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
# Mock migration helper functions
#

report_update() {
    local file="$1"
    local description="$2"
    echo "[UPDATE] $file: $description"
}

report_skip() {
    local file="$1"
    echo "[SKIP] $file"
}

# Export functions for sourced script
export -f report_update report_skip

#
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/docs"
    mkdir -p "$TEST_DIR/docs/workflow/review"
    REVIEW_DIR="$TEST_DIR/docs/workflow/review"
}

run_migration() {
    cd "$TEST_DIR"
    REVIEW_DIR="$TEST_DIR/docs/workflow/review"
    source "$MIGRATION_SCRIPT"
}

assert_file_exists() {
    local file="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_not_exists() {
    local file="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File should not exist: $file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_exists() {
    local dir="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory not found: $dir"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Phase 1 — Product assessment files deleted${NC}"
setup_fixture

mkdir -p "$REVIEW_DIR/tick-core/r1"
cat > "$REVIEW_DIR/tick-core/r1/review.md" << 'EOF'
# Review
EOF
cat > "$REVIEW_DIR/tick-core/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: tick-core
ROBUSTNESS: Good
EOF

run_migration

assert_file_not_exists "$REVIEW_DIR/tick-core/r1/product-assessment.md" "Product assessment deleted"
assert_file_exists "$REVIEW_DIR/tick-core/r1/review.md" "review.md preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Phase 1 — Multiple product assessments all deleted${NC}"
setup_fixture

mkdir -p "$REVIEW_DIR/plan-a/r1"
cat > "$REVIEW_DIR/plan-a/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: plan-a
EOF

mkdir -p "$REVIEW_DIR/plan-b/r1"
cat > "$REVIEW_DIR/plan-b/r1/product-assessment.md" << 'EOF'
PLANS_REVIEWED: plan-b
EOF

run_migration

assert_file_not_exists "$REVIEW_DIR/plan-a/r1/product-assessment.md" "plan-a PA deleted"
assert_file_not_exists "$REVIEW_DIR/plan-b/r1/product-assessment.md" "plan-b PA deleted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Phase 2 — Multi-plan QA subdirs moved to per-plan dirs${NC}"
setup_fixture

# Simulate: review/doctor-installation-migration/r1/{plan}/qa-task-*.md
mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/installation"
cat > "$REVIEW_DIR/doctor-installation-migration/r1/review.md" << 'EOF'
# Aggregate Review
EOF
cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" << 'EOF'
# QA 1
EOF
cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-2.md" << 'EOF'
# QA 2
EOF

mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/migration"
cat > "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

run_migration

assert_file_exists "$REVIEW_DIR/installation/r1/qa-task-1.md" "installation QA 1 moved to per-plan dir"
assert_file_exists "$REVIEW_DIR/installation/r1/qa-task-2.md" "installation QA 2 moved to per-plan dir"
assert_file_exists "$REVIEW_DIR/migration/r1/qa-task-1.md" "migration QA 1 moved to per-plan dir"
assert_file_not_exists "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" "Source QA removed"
# Aggregate review.md stays (historical artifact)
assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/review.md" "Aggregate review.md preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Phase 3 — Orphaned QA files at topic root moved into r1/${NC}"
setup_fixture

# Simulate: review/doctor-validation/qa-task-*.md (no r1/)
mkdir -p "$REVIEW_DIR/doctor-validation"
cat > "$REVIEW_DIR/doctor-validation/qa-task-1.md" << 'EOF'
# QA 1
EOF
cat > "$REVIEW_DIR/doctor-validation/qa-task-2.md" << 'EOF'
# QA 2
EOF
cat > "$REVIEW_DIR/doctor-validation/qa-task-3.md" << 'EOF'
# QA 3
EOF

run_migration

assert_dir_exists "$REVIEW_DIR/doctor-validation/r1" "r1/ created"
assert_file_exists "$REVIEW_DIR/doctor-validation/r1/qa-task-1.md" "QA 1 moved to r1/"
assert_file_exists "$REVIEW_DIR/doctor-validation/r1/qa-task-2.md" "QA 2 moved to r1/"
assert_file_exists "$REVIEW_DIR/doctor-validation/r1/qa-task-3.md" "QA 3 moved to r1/"
assert_file_not_exists "$REVIEW_DIR/doctor-validation/qa-task-1.md" "Original QA removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Phase 3 — Skip if r1/ already exists${NC}"
setup_fixture

mkdir -p "$REVIEW_DIR/already-done/r1"
cat > "$REVIEW_DIR/already-done/r1/qa-task-1.md" << 'EOF'
# Already in r1
EOF

# Stale QA file at root — should NOT be touched since r1/ exists
cat > "$REVIEW_DIR/already-done/qa-task-99.md" << 'EOF'
# Stale
EOF

run_migration

# r1 content unchanged
content=$(cat "$REVIEW_DIR/already-done/r1/qa-task-1.md")
assert_equals "$content" "# Already in r1" "Existing r1/ content unchanged"
# Stale file stays (r1/ exists, so phase 3 skips)
assert_file_exists "$REVIEW_DIR/already-done/qa-task-99.md" "Stale file untouched when r1/ exists"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No review directory — early return${NC}"
rm -rf "$TEST_DIR/docs"
mkdir -p "$TEST_DIR/docs/workflow"

REVIEW_DIR="$TEST_DIR/docs/workflow/review"
cd "$TEST_DIR"
source "$MIGRATION_SCRIPT"

TESTS_RUN=$((TESTS_RUN + 1))
echo -e "  ${GREEN}✓${NC} No error when review directory missing"
TESTS_PASSED=$((TESTS_PASSED + 1))

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency — running migration twice${NC}"
setup_fixture

mkdir -p "$REVIEW_DIR/idem"
cat > "$REVIEW_DIR/idem/qa-task-1.md" << 'EOF'
# QA 1
EOF

run_migration
first_content=$(cat "$REVIEW_DIR/idem/r1/qa-task-1.md")

# Run again — r1/ exists now, should skip
run_migration
second_content=$(cat "$REVIEW_DIR/idem/r1/qa-task-1.md")

assert_equals "$second_content" "$first_content" "Second run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Tick-like scenario — all three phases together${NC}"
setup_fixture

# Multi-plan review with aggregate + per-plan subdirs
mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/installation"
mkdir -p "$REVIEW_DIR/doctor-installation-migration/r1/migration"
cat > "$REVIEW_DIR/doctor-installation-migration/r1/review.md" << 'EOF'
# Aggregate
EOF
cat > "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" << 'EOF'
# Install QA 1
EOF
cat > "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

# Single-plan review (already correct structure)
mkdir -p "$REVIEW_DIR/tick-core/r1"
cat > "$REVIEW_DIR/tick-core/r1/review.md" << 'EOF'
# Tick Core Review
EOF
cat > "$REVIEW_DIR/tick-core/r1/qa-task-1.md" << 'EOF'
# TC QA 1
EOF
# Orphaned per-plan dirs
mkdir -p "$REVIEW_DIR/doctor-validation"
cat > "$REVIEW_DIR/doctor-validation/qa-task-1.md" << 'EOF'
# DV QA 1
EOF
cat > "$REVIEW_DIR/doctor-validation/qa-task-2.md" << 'EOF'
# DV QA 2
EOF

run_migration

# Phase 2: multi-plan QA moved to per-plan
assert_file_exists "$REVIEW_DIR/installation/r1/qa-task-1.md" "installation QA moved"
assert_file_exists "$REVIEW_DIR/migration/r1/qa-task-1.md" "migration QA moved"

# Phase 3: orphaned QA moved into r1/
assert_file_exists "$REVIEW_DIR/doctor-validation/r1/qa-task-1.md" "orphaned DV QA 1 moved to r1/"
assert_file_exists "$REVIEW_DIR/doctor-validation/r1/qa-task-2.md" "orphaned DV QA 2 moved to r1/"

# Already-correct single-plan review untouched
assert_file_exists "$REVIEW_DIR/tick-core/r1/review.md" "tick-core review.md preserved"
assert_file_exists "$REVIEW_DIR/tick-core/r1/qa-task-1.md" "tick-core QA preserved"

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
