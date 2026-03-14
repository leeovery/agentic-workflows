#!/bin/bash
#
# Tests migration 007-tasks-subdirectory.sh
# Validates moving task files into tasks/ subdirectory within plan topics.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/007-tasks-subdirectory.sh"

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
    mkdir -p "$TEST_DIR/docs/workflow/planning"
    PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

run_migration() {
    cd "$TEST_DIR"
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

echo -e "${YELLOW}Test: Single task file moved to tasks/${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/user-auth"
cat > "$PLAN_DIR/user-auth/plan.md" << 'EOF'
---
topic: user-auth
status: in-progress
format: local-markdown
---

# Plan: User Auth
EOF

cat > "$PLAN_DIR/user-auth/user-auth-1-1.md" << 'EOF'
# Task 1-1

Task content.
EOF

run_migration

assert_dir_exists "$PLAN_DIR/user-auth/tasks" "tasks/ subdirectory created"
assert_file_exists "$PLAN_DIR/user-auth/tasks/user-auth-1-1.md" "Task file moved to tasks/"
assert_file_not_exists "$PLAN_DIR/user-auth/user-auth-1-1.md" "Original task file removed"
assert_file_exists "$PLAN_DIR/user-auth/plan.md" "plan.md untouched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple task files moved${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/billing"
cat > "$PLAN_DIR/billing/plan.md" << 'EOF'
---
topic: billing
status: in-progress
format: local-markdown
---

# Plan: Billing
EOF

cat > "$PLAN_DIR/billing/billing-1-1.md" << 'EOF'
# Task 1-1
EOF

cat > "$PLAN_DIR/billing/billing-1-2.md" << 'EOF'
# Task 1-2
EOF

cat > "$PLAN_DIR/billing/billing-2-1.md" << 'EOF'
# Task 2-1
EOF

run_migration

assert_file_exists "$PLAN_DIR/billing/tasks/billing-1-1.md" "First task moved"
assert_file_exists "$PLAN_DIR/billing/tasks/billing-1-2.md" "Second task moved"
assert_file_exists "$PLAN_DIR/billing/tasks/billing-2-1.md" "Third task moved"
assert_file_not_exists "$PLAN_DIR/billing/billing-1-1.md" "First original removed"
assert_file_not_exists "$PLAN_DIR/billing/billing-1-2.md" "Second original removed"
assert_file_not_exists "$PLAN_DIR/billing/billing-2-1.md" "Third original removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review/tracking files NOT moved${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/api"
cat > "$PLAN_DIR/api/plan.md" << 'EOF'
---
topic: api
status: in-progress
format: local-markdown
---

# Plan: API
EOF

cat > "$PLAN_DIR/api/api-1-1.md" << 'EOF'
# Task 1-1
EOF

cat > "$PLAN_DIR/api/review-traceability-tracking-c1.md" << 'EOF'
# Review Tracking

Tracking content.
EOF

run_migration

assert_file_exists "$PLAN_DIR/api/tasks/api-1-1.md" "Task file moved"
assert_file_exists "$PLAN_DIR/api/review-traceability-tracking-c1.md" "Review file stays in place"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No task files — skip${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/beads-plan"
cat > "$PLAN_DIR/beads-plan/plan.md" << 'EOF'
---
topic: beads-plan
status: in-progress
format: beads
---

# Plan: Beads Plan
EOF

output=$(run_migration 2>&1)

assert_contains "$output" "SKIP" "Skipped when no task files"
assert_file_exists "$PLAN_DIR/beads-plan/plan.md" "plan.md untouched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No plan.md — skip entirely${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/orphan"
cat > "$PLAN_DIR/orphan/orphan-1-1.md" << 'EOF'
# Orphan task
EOF

run_migration

# Task file should NOT be moved since there's no plan.md
assert_file_exists "$PLAN_DIR/orphan/orphan-1-1.md" "Task file stays when no plan.md"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Tasks already in tasks/ — idempotent skip${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/done/tasks"
cat > "$PLAN_DIR/done/plan.md" << 'EOF'
---
topic: done
status: concluded
format: local-markdown
---

# Plan: Done
EOF

cat > "$PLAN_DIR/done/tasks/done-1-1.md" << 'EOF'
# Task 1-1
EOF

output=$(run_migration 2>&1)

assert_contains "$output" "SKIP" "Skipped when tasks already moved"
assert_file_exists "$PLAN_DIR/done/tasks/done-1-1.md" "Existing task file untouched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Task content preserved after move${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/preserve"
cat > "$PLAN_DIR/preserve/plan.md" << 'EOF'
---
topic: preserve
status: in-progress
format: local-markdown
---

# Plan: Preserve
EOF

cat > "$PLAN_DIR/preserve/preserve-1-1.md" << 'TESTEOF'
---
task_id: preserve-1-1
title: Setup Database
status: pending
phase: 1
priority: 1
---

# Task: Setup Database

## Description

Create the database schema with tables:

| Table | Purpose |
|-------|---------|
| users | User accounts |
| sessions | Active sessions |

## Acceptance Criteria

- [ ] Schema created
- [ ] Migrations run
- [ ] Seeds loaded

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);
```
TESTEOF

original_content=$(cat "$PLAN_DIR/preserve/preserve-1-1.md")
run_migration
moved_content=$(cat "$PLAN_DIR/preserve/tasks/preserve-1-1.md")

assert_equals "$moved_content" "$original_content" "Task file content exactly preserved after move"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
mkdir -p "$PLAN_DIR/idem"
cat > "$PLAN_DIR/idem/plan.md" << 'EOF'
---
topic: idem
status: in-progress
format: local-markdown
---

# Plan: Idem
EOF

cat > "$PLAN_DIR/idem/idem-1-1.md" << 'EOF'
# Task 1-1
EOF

run_migration
first_content=$(cat "$PLAN_DIR/idem/tasks/idem-1-1.md")

# Run again — should skip
run_migration
second_content=$(cat "$PLAN_DIR/idem/tasks/idem-1-1.md")

assert_equals "$second_content" "$first_content" "Second run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple topics processed independently${NC}"
setup_fixture

mkdir -p "$PLAN_DIR/topic-a"
cat > "$PLAN_DIR/topic-a/plan.md" << 'EOF'
---
topic: topic-a
format: local-markdown
---
# Plan A
EOF
cat > "$PLAN_DIR/topic-a/topic-a-1-1.md" << 'EOF'
# Task A-1-1
EOF

mkdir -p "$PLAN_DIR/topic-b"
cat > "$PLAN_DIR/topic-b/plan.md" << 'EOF'
---
topic: topic-b
format: local-markdown
---
# Plan B
EOF
cat > "$PLAN_DIR/topic-b/topic-b-1-1.md" << 'EOF'
# Task B-1-1
EOF
cat > "$PLAN_DIR/topic-b/topic-b-1-2.md" << 'EOF'
# Task B-1-2
EOF

run_migration

assert_file_exists "$PLAN_DIR/topic-a/tasks/topic-a-1-1.md" "Topic A task moved"
assert_file_exists "$PLAN_DIR/topic-b/tasks/topic-b-1-1.md" "Topic B first task moved"
assert_file_exists "$PLAN_DIR/topic-b/tasks/topic-b-1-2.md" "Topic B second task moved"

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
