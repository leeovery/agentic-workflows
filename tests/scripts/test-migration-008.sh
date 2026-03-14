#!/bin/bash
#
# Tests migration 008-review-directory-structure.sh
# Validates moving flat review files into versioned r1/ directory structure.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/008-review-directory-structure.sh"

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

assert_contains() {
    local content="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -q -- "$expected"; then
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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Simple review — summary + QA files moved to r1/${NC}"
setup_fixture

cat > "$REVIEW_DIR/tick-core.md" << 'EOF'
# Review: Tick Core

Summary of the review.
EOF

mkdir -p "$REVIEW_DIR/tick-core"
cat > "$REVIEW_DIR/tick-core/qa-task-1.md" << 'EOF'
# QA Task 1
Findings.
EOF
cat > "$REVIEW_DIR/tick-core/qa-task-2.md" << 'EOF'
# QA Task 2
More findings.
EOF

run_migration

assert_dir_exists "$REVIEW_DIR/tick-core/r1" "r1/ directory created"
assert_file_exists "$REVIEW_DIR/tick-core/r1/review.md" "Summary moved to r1/review.md"
assert_file_exists "$REVIEW_DIR/tick-core/r1/qa-task-1.md" "QA task 1 moved to r1/"
assert_file_exists "$REVIEW_DIR/tick-core/r1/qa-task-2.md" "QA task 2 moved to r1/"
assert_file_not_exists "$REVIEW_DIR/tick-core.md" "Original summary removed"

# Content preserved
content=$(cat "$REVIEW_DIR/tick-core/r1/review.md")
assert_contains "$content" "Summary of the review" "Summary content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review with product-assessment.md${NC}"
setup_fixture

cat > "$REVIEW_DIR/installation.md" << 'EOF'
# Review: Installation
Summary.
EOF

mkdir -p "$REVIEW_DIR/installation"
cat > "$REVIEW_DIR/installation/qa-task-1.md" << 'EOF'
# QA 1
EOF
cat > "$REVIEW_DIR/installation/product-assessment.md" << 'EOF'
# Product Assessment
Assessment content.
EOF

run_migration

assert_file_exists "$REVIEW_DIR/installation/r1/review.md" "Summary moved"
assert_file_exists "$REVIEW_DIR/installation/r1/qa-task-1.md" "QA task moved"
assert_file_exists "$REVIEW_DIR/installation/r1/product-assessment.md" "Product assessment moved to r1/"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multi-plan review — per-plan QA subdirectories moved${NC}"
setup_fixture

cat > "$REVIEW_DIR/doctor-installation-migration.md" << 'EOF'
# Review: Doctor + Installation + Migration
Multi-plan summary.
EOF

mkdir -p "$REVIEW_DIR/doctor-installation-migration"
cat > "$REVIEW_DIR/doctor-installation-migration/product-assessment.md" << 'EOF'
# Product Assessment
EOF

mkdir -p "$REVIEW_DIR/doctor-installation-migration/installation"
cat > "$REVIEW_DIR/doctor-installation-migration/installation/qa-task-1.md" << 'EOF'
# Installation QA 1
EOF
cat > "$REVIEW_DIR/doctor-installation-migration/installation/qa-task-2.md" << 'EOF'
# Installation QA 2
EOF

mkdir -p "$REVIEW_DIR/doctor-installation-migration/migration"
cat > "$REVIEW_DIR/doctor-installation-migration/migration/qa-task-1.md" << 'EOF'
# Migration QA 1
EOF

run_migration

assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/review.md" "Summary moved"
assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/product-assessment.md" "Product assessment moved"
assert_dir_exists "$REVIEW_DIR/doctor-installation-migration/r1/installation" "Per-plan subdir moved to r1/"
assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-1.md" "Subdir QA file preserved"
assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/installation/qa-task-2.md" "Subdir QA file 2 preserved"
assert_dir_exists "$REVIEW_DIR/doctor-installation-migration/r1/migration" "Second per-plan subdir moved"
assert_file_exists "$REVIEW_DIR/doctor-installation-migration/r1/migration/qa-task-1.md" "Second subdir QA preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Summary file without matching directory${NC}"
setup_fixture

cat > "$REVIEW_DIR/standalone.md" << 'EOF'
# Review: Standalone
Just a summary, no QA directory.
EOF

run_migration

assert_dir_exists "$REVIEW_DIR/standalone/r1" "r1/ created even without pre-existing dir"
assert_file_exists "$REVIEW_DIR/standalone/r1/review.md" "Summary moved to r1/review.md"
assert_file_not_exists "$REVIEW_DIR/standalone.md" "Original summary removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: r1/ already exists — idempotent skip${NC}"
setup_fixture

mkdir -p "$REVIEW_DIR/done/r1"
cat > "$REVIEW_DIR/done/r1/review.md" << 'EOF'
# Review: Done
Already migrated.
EOF

# Put a stale .md at root level — should be ignored since r1/ exists
cat > "$REVIEW_DIR/done.md" << 'EOF'
# Stale summary
EOF

original_r1=$(cat "$REVIEW_DIR/done/r1/review.md")
output=$(run_migration 2>&1)

new_r1=$(cat "$REVIEW_DIR/done/r1/review.md")
assert_equals "$new_r1" "$original_r1" "Existing r1/ content unchanged"
assert_contains "$output" "SKIP" "Skipped when r1/ exists"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No review directory — early return${NC}"
rm -rf "$TEST_DIR/docs"
mkdir -p "$TEST_DIR/docs/workflow"
# No review dir at all

REVIEW_DIR="$TEST_DIR/docs/workflow/review"
cd "$TEST_DIR"
source "$MIGRATION_SCRIPT"
# Should not error — early return 0

TESTS_RUN=$((TESTS_RUN + 1))
echo -e "  ${GREEN}✓${NC} No error when review directory missing"
TESTS_PASSED=$((TESTS_PASSED + 1))

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency — running migration twice${NC}"
setup_fixture

cat > "$REVIEW_DIR/idem.md" << 'EOF'
# Review: Idempotent Test
Summary content.
EOF

mkdir -p "$REVIEW_DIR/idem"
cat > "$REVIEW_DIR/idem/qa-task-1.md" << 'EOF'
# QA 1
EOF

run_migration
first_content=$(cat "$REVIEW_DIR/idem/r1/review.md")

# Run again
run_migration
second_content=$(cat "$REVIEW_DIR/idem/r1/review.md")

assert_equals "$second_content" "$first_content" "Second run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Many QA files moved correctly${NC}"
setup_fixture

cat > "$REVIEW_DIR/big-review.md" << 'EOF'
# Review: Big Review
Many tasks.
EOF

mkdir -p "$REVIEW_DIR/big-review"
for i in $(seq 1 20); do
    cat > "$REVIEW_DIR/big-review/qa-task-${i}.md" << EOF
# QA Task $i
Finding $i.
EOF
done

run_migration

for i in $(seq 1 20); do
    assert_file_exists "$REVIEW_DIR/big-review/r1/qa-task-${i}.md" "QA task $i moved to r1/"
done

# Verify content of a sample
content=$(cat "$REVIEW_DIR/big-review/r1/qa-task-15.md")
assert_contains "$content" "Finding 15" "QA task 15 content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preservation — complex review file${NC}"
setup_fixture

cat > "$REVIEW_DIR/complex.md" << 'TESTEOF'
# Review: Complex

## Summary

The implementation covers **all 38 tasks** across 8 phases.

| Phase | Tasks | Status |
|-------|-------|--------|
| 1     | 7     | done   |
| 2     | 3     | done   |

---

## Findings

```bash
tick create "test task" --priority 1
```

- Finding with `backticks` and "quotes"
- Finding with special chars: @#$%
TESTEOF

mkdir -p "$REVIEW_DIR/complex"
original=$(cat "$REVIEW_DIR/complex.md")

run_migration

moved=$(cat "$REVIEW_DIR/complex/r1/review.md")
assert_equals "$moved" "$original" "Complex content exactly preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple reviews processed in one run${NC}"
setup_fixture

cat > "$REVIEW_DIR/review-a.md" << 'EOF'
# Review A
EOF
mkdir -p "$REVIEW_DIR/review-a"
cat > "$REVIEW_DIR/review-a/qa-task-1.md" << 'EOF'
# QA A-1
EOF

cat > "$REVIEW_DIR/review-b.md" << 'EOF'
# Review B
EOF
mkdir -p "$REVIEW_DIR/review-b"
cat > "$REVIEW_DIR/review-b/qa-task-1.md" << 'EOF'
# QA B-1
EOF

run_migration

assert_file_exists "$REVIEW_DIR/review-a/r1/review.md" "Review A migrated"
assert_file_exists "$REVIEW_DIR/review-a/r1/qa-task-1.md" "Review A QA moved"
assert_file_exists "$REVIEW_DIR/review-b/r1/review.md" "Review B migrated"
assert_file_exists "$REVIEW_DIR/review-b/r1/qa-task-1.md" "Review B QA moved"

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
