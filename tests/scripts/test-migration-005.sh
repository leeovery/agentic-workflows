#!/bin/bash
#
# Tests migration 005-plan-external-deps-frontmatter.sh
# Validates migration of external dependencies from body section to frontmatter.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/005-plan-external-deps-frontmatter.sh"

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

assert_not_contains() {
    local content="$1"
    local unexpected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if ! echo "$content" | grep -q -- "$unexpected"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Should NOT find: $unexpected"
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

echo -e "${YELLOW}Test: Unresolved dependency${NC}"
setup_fixture
cat > "$PLAN_DIR/billing.md" << 'EOF'
---
topic: billing
status: in-progress
date: 2024-01-15
format: local-markdown
specification: billing.md
---

# Implementation Plan: Billing

## Overview

Plan content here.

## External Dependencies

- payment-gateway: Payment processing for checkout

## Phase 1: Setup

Setup tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/billing.md")

assert_contains "$content" "external_dependencies:" "external_dependencies added to frontmatter"
assert_contains "$content" "topic: payment-gateway" "Dep topic extracted"
assert_contains "$content" "description: Payment processing for checkout" "Dep description extracted"
assert_contains "$content" "state: unresolved" "State set to unresolved"
assert_not_contains "$content" "## External Dependencies" "Body section removed"
assert_contains "$content" "## Phase 1: Setup" "Other body sections preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Resolved dependency with arrow and task_id${NC}"
setup_fixture
cat > "$PLAN_DIR/auth.md" << 'EOF'
---
topic: auth
status: in-progress
date: 2024-02-20
format: local-markdown
specification: auth.md
---

# Implementation Plan: Auth

## Overview

Auth plan.

## External Dependencies

- user-service: User context for permissions → auth-1-3

## Phase 1: Core

Core tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/auth.md")

assert_contains "$content" "topic: user-service" "Resolved dep topic extracted"
assert_contains "$content" "description: User context for permissions" "Resolved dep description extracted"
assert_contains "$content" "state: resolved" "State set to resolved"
assert_contains "$content" "task_id: auth-1-3" "Task ID extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Resolved dependency with (resolved) suffix${NC}"
setup_fixture
cat > "$PLAN_DIR/api.md" << 'EOF'
---
topic: api
status: in-progress
date: 2024-03-10
format: local-markdown
specification: api.md
---

# Implementation Plan: API

## Overview

API plan.

## External Dependencies

- data-layer: Database access → db-2-1 (resolved)

## Phase 1: Endpoints

Tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/api.md")

assert_contains "$content" "state: resolved" "Resolved state detected"
assert_contains "$content" "task_id: db-2-1" "Task ID extracted with (resolved) suffix stripped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Satisfied externally dependency${NC}"
setup_fixture
cat > "$PLAN_DIR/checkout.md" << 'EOF'
---
topic: checkout
status: in-progress
date: 2024-04-01
format: local-markdown
specification: checkout.md
---

# Implementation Plan: Checkout

## Overview

Checkout plan.

## External Dependencies

- ~~payment-gateway: Payment processing~~ → satisfied externally

## Phase 1: Cart

Cart tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/checkout.md")

assert_contains "$content" "topic: payment-gateway" "Satisfied dep topic extracted"
assert_contains "$content" "description: Payment processing" "Satisfied dep description extracted"
assert_contains "$content" "state: satisfied_externally" "State set to satisfied_externally"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Mixed dependency types${NC}"
setup_fixture
cat > "$PLAN_DIR/mixed.md" << 'EOF'
---
topic: mixed
status: in-progress
date: 2024-05-15
format: local-markdown
specification: mixed.md
---

# Implementation Plan: Mixed

## Overview

Mixed plan.

## External Dependencies

- billing-system: Invoice generation for order completion
- user-authentication: User context for permissions → auth-1-3
- ~~payment-gateway: Payment processing~~ → satisfied externally

## Phase 1: Core

Core tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/mixed.md")

assert_contains "$content" "topic: billing-system" "Unresolved dep present"
assert_contains "$content" "state: unresolved" "Unresolved state present"
assert_contains "$content" "topic: user-authentication" "Resolved dep present"
assert_contains "$content" "state: resolved" "Resolved state present"
assert_contains "$content" "task_id: auth-1-3" "Task ID present"
assert_contains "$content" "topic: payment-gateway" "Satisfied dep present"
assert_contains "$content" "state: satisfied_externally" "Satisfied state present"
assert_not_contains "$content" "## External Dependencies" "Body section removed"
assert_contains "$content" "## Phase 1: Core" "Other sections preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No External Dependencies section — empty array${NC}"
setup_fixture
cat > "$PLAN_DIR/no-deps.md" << 'EOF'
---
topic: no-deps
status: in-progress
date: 2024-06-01
format: local-markdown
specification: no-deps.md
---

# Implementation Plan: No Deps

## Overview

No deps plan.

## Phase 1: Core

Core tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/no-deps.md")

assert_contains "$content" "external_dependencies: \[\]" "Empty array added when no section"
assert_contains "$content" "## Phase 1: Core" "Body preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Already has external_dependencies in frontmatter — skip${NC}"
setup_fixture
cat > "$PLAN_DIR/already-done.md" << 'EOF'
---
topic: already-done
status: in-progress
date: 2024-07-01
format: local-markdown
specification: already-done.md
external_dependencies:
  - topic: some-dep
    description: Already migrated
    state: unresolved
---

# Implementation Plan: Already Done

## Overview

Already done.
EOF

original_content=$(cat "$PLAN_DIR/already-done.md")
run_migration
new_content=$(cat "$PLAN_DIR/already-done.md")

assert_equals "$new_content" "$original_content" "File with existing external_dependencies unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No frontmatter — skip${NC}"
setup_fixture
cat > "$PLAN_DIR/no-frontmatter.md" << 'EOF'
# Implementation Plan: No Frontmatter

## External Dependencies

- some-dep: Something

## Phase 1: Core

Tasks.
EOF

original_content=$(cat "$PLAN_DIR/no-frontmatter.md")
run_migration
new_content=$(cat "$PLAN_DIR/no-frontmatter.md")

assert_equals "$new_content" "$original_content" "File without frontmatter unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$PLAN_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: in-progress
date: 2024-08-01
format: local-markdown
specification: idempotent.md
---

# Implementation Plan: Idempotent

## Overview

Content.

## External Dependencies

- dep-a: Description A

## Phase 1: Core

Tasks.
EOF

run_migration
first_run=$(cat "$PLAN_DIR/idempotent.md")

# Run again
run_migration
second_run=$(cat "$PLAN_DIR/idempotent.md")

assert_equals "$second_run" "$first_run" "Second migration run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Body with --- horizontal rules preserved${NC}"
setup_fixture
cat > "$PLAN_DIR/hr-body.md" << 'TESTEOF'
---
topic: hr-body
status: in-progress
date: 2024-09-01
format: local-markdown
specification: hr-body.md
---

# Implementation Plan: HR Body

## Overview

Plan overview.

---

## External Dependencies

- some-dep: A dependency

---

## Phase 1: Setup

Setup tasks.

---

## Phase 2: Core

Core tasks.
TESTEOF

run_migration
content=$(cat "$PLAN_DIR/hr-body.md")

assert_contains "$content" "topic: some-dep" "Dep extracted from body"
assert_not_contains "$content" "## External Dependencies" "Deps section removed"
assert_contains "$content" "## Overview" "Overview preserved"
assert_contains "$content" "## Phase 1: Setup" "Phase 1 preserved"
assert_contains "$content" "## Phase 2: Core" "Phase 2 preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review/tracking files skipped${NC}"
setup_fixture
cat > "$PLAN_DIR/topic-review-traceability.md" << 'EOF'
---
topic: topic
review: true
---

# Review

Content.
EOF

original_content=$(cat "$PLAN_DIR/topic-review-traceability.md")
run_migration
new_content=$(cat "$PLAN_DIR/topic-review-traceability.md")

assert_equals "$new_content" "$original_content" "Review file unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Arrow with -> syntax${NC}"
setup_fixture
cat > "$PLAN_DIR/arrow-alt.md" << 'EOF'
---
topic: arrow-alt
status: in-progress
date: 2024-10-01
format: local-markdown
specification: arrow-alt.md
---

# Implementation Plan: Arrow Alt

## Overview

Content.

## External Dependencies

- data-service: Data access -> data-1-2

## Phase 1: Core

Tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/arrow-alt.md")

assert_contains "$content" "state: resolved" "Resolved with -> syntax"
assert_contains "$content" "task_id: data-1-2" "Task ID extracted with -> syntax"

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
