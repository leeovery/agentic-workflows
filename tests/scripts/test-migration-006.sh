#!/bin/bash
#
# Tests migration 006-directory-restructure.sh
# Validates restructuring from flat files to topic directories.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/006-directory-restructure.sh"

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
    mkdir -p "$TEST_DIR/docs/workflow/specification"
    mkdir -p "$TEST_DIR/docs/workflow/planning"
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
    PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

run_migration() {
    cd "$TEST_DIR"
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
    PLAN_DIR="$TEST_DIR/docs/workflow/planning"
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

echo -e "${YELLOW}Test: Specification flat file → topic directory${NC}"
setup_fixture
cat > "$SPEC_DIR/user-auth.md" << 'EOF'
---
topic: user-auth
status: concluded
type: feature
date: 2024-01-15
---

# Specification: User Auth

## Overview

Content.
EOF

run_migration

assert_dir_exists "$SPEC_DIR/user-auth" "Topic directory created"
assert_file_exists "$SPEC_DIR/user-auth/specification.md" "Spec moved to specification.md"
assert_file_not_exists "$SPEC_DIR/user-auth.md" "Original flat file removed"

content=$(cat "$SPEC_DIR/user-auth/specification.md")
assert_contains "$content" "topic: user-auth" "Content preserved after move"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Planning flat file → topic directory${NC}"
setup_fixture
cat > "$PLAN_DIR/billing.md" << 'EOF'
---
topic: billing
status: in-progress
date: 2024-02-20
format: local-markdown
specification: billing.md
---

# Implementation Plan: Billing

## Overview

Plan content.
EOF

run_migration

assert_dir_exists "$PLAN_DIR/billing" "Topic directory created"
assert_file_exists "$PLAN_DIR/billing/plan.md" "Plan moved to plan.md"
assert_file_not_exists "$PLAN_DIR/billing.md" "Original flat file removed"

content=$(cat "$PLAN_DIR/billing/plan.md")
assert_contains "$content" "topic: billing" "Content preserved after move"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preserved through spec restructure${NC}"
setup_fixture
cat > "$SPEC_DIR/api-design.md" << 'TESTEOF'
---
topic: api-design
status: concluded
type: feature
date: 2024-03-10
---

# Specification: API Design

## Overview

Content with **bold** and `code`.

---

## Dependencies

| Dep | Reason |
|-----|--------|
| core | Needed first |
TESTEOF

original_content=$(cat "$SPEC_DIR/api-design.md")
run_migration
moved_content=$(cat "$SPEC_DIR/api-design/specification.md")

assert_equals "$moved_content" "$original_content" "Spec content exactly preserved through restructure"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preserved through plan restructure${NC}"
setup_fixture
cat > "$PLAN_DIR/caching.md" << 'TESTEOF'
---
topic: caching
status: in-progress
date: 2024-04-01
format: local-markdown
specification: caching.md
---

# Plan: Caching

## Overview

Plan content.

## Phase 1: Setup

- Task 1
- Task 2
TESTEOF

original_content=$(cat "$PLAN_DIR/caching.md")
run_migration
moved_content=$(cat "$PLAN_DIR/caching/plan.md")

# Content same except specification field gets updated by Phase 3
assert_contains "$moved_content" "topic: caching" "Topic preserved"
assert_contains "$moved_content" "## Phase 1: Setup" "Body preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Already restructured spec — skip${NC}"
setup_fixture
mkdir -p "$SPEC_DIR/existing"
cat > "$SPEC_DIR/existing/specification.md" << 'EOF'
---
topic: existing
status: concluded
type: feature
date: 2024-05-15
---

# Specification: Existing

## Overview

Already restructured.
EOF

original_content=$(cat "$SPEC_DIR/existing/specification.md")
run_migration
new_content=$(cat "$SPEC_DIR/existing/specification.md")

assert_equals "$new_content" "$original_content" "Already restructured spec unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Already restructured plan — skip${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/existing"
cat > "$PLAN_DIR/existing/plan.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-06-01
format: local-markdown
specification: existing/specification.md
---

# Plan: Existing

## Overview

Already restructured.
EOF

original_content=$(cat "$PLAN_DIR/existing/plan.md")
run_migration
new_content=$(cat "$PLAN_DIR/existing/plan.md")

assert_equals "$new_content" "$original_content" "Already restructured plan unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Plan frontmatter specification field updated${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/user-auth"
cat > "$PLAN_DIR/user-auth/plan.md" << 'EOF'
---
topic: user-auth
status: in-progress
date: 2024-07-01
format: local-markdown
specification: user-auth.md
---

# Plan: User Auth

## Overview

Content.
EOF

run_migration
content=$(cat "$PLAN_DIR/user-auth/plan.md")

assert_contains "$content" "specification: user-auth/specification.md" "Specification field updated to directory path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Specification field already updated — no change${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/already-updated"
cat > "$PLAN_DIR/already-updated/plan.md" << 'EOF'
---
topic: already-updated
status: in-progress
date: 2024-08-01
format: local-markdown
specification: already-updated/specification.md
---

# Plan: Already Updated

## Overview

Content.
EOF

original_content=$(cat "$PLAN_DIR/already-updated/plan.md")
run_migration
new_content=$(cat "$PLAN_DIR/already-updated/plan.md")

assert_equals "$new_content" "$original_content" "Already-updated specification field unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple specs and plans restructured together${NC}"
setup_fixture

cat > "$SPEC_DIR/topic-a.md" << 'EOF'
---
topic: topic-a
status: concluded
type: feature
date: 2024-09-01
---

# Spec A
EOF

cat > "$SPEC_DIR/topic-b.md" << 'EOF'
---
topic: topic-b
status: in-progress
type: cross-cutting
date: 2024-09-02
---

# Spec B
EOF

cat > "$PLAN_DIR/topic-a.md" << 'EOF'
---
topic: topic-a
status: in-progress
date: 2024-09-03
format: local-markdown
specification: topic-a.md
---

# Plan A
EOF

run_migration

assert_file_exists "$SPEC_DIR/topic-a/specification.md" "Spec A restructured"
assert_file_exists "$SPEC_DIR/topic-b/specification.md" "Spec B restructured"
assert_file_exists "$PLAN_DIR/topic-a/plan.md" "Plan A restructured"
assert_file_not_exists "$SPEC_DIR/topic-a.md" "Spec A flat file removed"
assert_file_not_exists "$SPEC_DIR/topic-b.md" "Spec B flat file removed"
assert_file_not_exists "$PLAN_DIR/topic-a.md" "Plan A flat file removed"

# Verify the plan's spec field was updated
content=$(cat "$PLAN_DIR/topic-a/plan.md")
assert_contains "$content" "specification: topic-a/specification.md" "Plan A spec field updated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$SPEC_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: concluded
type: feature
date: 2024-10-01
---

# Spec: Idempotent
EOF

run_migration
first_content=$(cat "$SPEC_DIR/idempotent/specification.md")

# Run again — should skip since directory already exists
run_migration
second_content=$(cat "$SPEC_DIR/idempotent/specification.md")

assert_equals "$second_content" "$first_content" "Second run produces same result"

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
