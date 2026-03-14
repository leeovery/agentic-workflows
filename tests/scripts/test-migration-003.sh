#!/bin/bash
#
# Tests migration 003-planning-frontmatter.sh
# Validates conversion from legacy plan format to full YAML frontmatter.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/003-planning-frontmatter.sh"

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
    # Source the migration script (it uses PLAN_DIR variable)
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

assert_file_starts_with() {
    local file="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    local first_line=$(head -1 "$file")
    if [ "$first_line" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected first line: $expected"
        echo -e "    Actual first line:   $first_line"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Legacy format with partial frontmatter and Draft status${NC}"
setup_fixture
cat > "$PLAN_DIR/user-auth.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: User Authentication

**Date**: 2024-01-15
**Status**: Draft
**Specification**: `docs/workflow/specification/user-auth.md`

## Overview

Plan content here.
EOF

run_migration
content=$(cat "$PLAN_DIR/user-auth.md")

assert_file_starts_with "$PLAN_DIR/user-auth.md" "---" "File starts with frontmatter delimiter"
assert_contains "$content" "^topic: user-auth$" "Topic extracted from filename"
assert_contains "$content" "^status: in-progress$" "Draft status mapped to in-progress"
assert_contains "$content" "^date: 2024-01-15$" "Date extracted"
assert_contains "$content" "^format: local-markdown$" "Format preserved"
assert_contains "$content" "^specification: user-auth.md$" "Specification filename extracted"
assert_contains "$content" "^# Implementation Plan: User Authentication$" "H1 heading preserved"
assert_contains "$content" "^## Overview$" "Content sections preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Ready status${NC}"
setup_fixture
cat > "$PLAN_DIR/api-endpoints.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: API Endpoints

**Date**: 2024-02-20
**Status**: Ready
**Specification**: `docs/workflow/specification/api-endpoints.md`

## Overview

Ready to implement.
EOF

run_migration
content=$(cat "$PLAN_DIR/api-endpoints.md")

assert_contains "$content" "^status: in-progress$" "Ready status mapped to in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with In Progress status${NC}"
setup_fixture
cat > "$PLAN_DIR/caching.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Caching

**Date**: 2024-03-10
**Status**: In Progress
**Specification**: `docs/workflow/specification/caching.md`

## Overview

Work in progress.
EOF

run_migration
content=$(cat "$PLAN_DIR/caching.md")

assert_contains "$content" "^status: in-progress$" "In Progress status mapped to in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Completed status${NC}"
setup_fixture
cat > "$PLAN_DIR/database.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Database Setup

**Date**: 2024-04-01
**Status**: Completed
**Specification**: `docs/workflow/specification/database.md`

## Overview

Implementation complete.
EOF

run_migration
content=$(cat "$PLAN_DIR/database.md")

assert_contains "$content" "^status: concluded$" "Completed status mapped to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without partial frontmatter (inline only)${NC}"
setup_fixture
cat > "$PLAN_DIR/no-frontmatter.md" << 'EOF'
# Implementation Plan: No Frontmatter

**Date**: 2024-05-15
**Status**: Draft
**Specification**: `docs/workflow/specification/no-frontmatter.md`

## Overview

No frontmatter at all.
EOF

run_migration
content=$(cat "$PLAN_DIR/no-frontmatter.md")

assert_file_starts_with "$PLAN_DIR/no-frontmatter.md" "---" "Frontmatter added"
assert_contains "$content" "^topic: no-frontmatter$" "Topic extracted from filename"
assert_contains "$content" "^format: MISSING$" "Missing format flagged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without date field${NC}"
setup_fixture
cat > "$PLAN_DIR/no-date.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Date

**Status**: Draft
**Specification**: `docs/workflow/specification/no-date.md`

## Overview

Missing date.
EOF

run_migration
content=$(cat "$PLAN_DIR/no-date.md")
today=$(date +%Y-%m-%d)

assert_contains "$content" "^date: $today$" "Date defaults to today when not found"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without specification field${NC}"
setup_fixture
cat > "$PLAN_DIR/no-spec.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Spec

**Date**: 2024-06-01
**Status**: Draft

## Overview

Missing specification.
EOF

run_migration
content=$(cat "$PLAN_DIR/no-spec.md")

assert_contains "$content" "^specification: no-spec.md$" "Specification defaults to topic.md"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Specification path extraction (full path to filename)${NC}"
setup_fixture
cat > "$PLAN_DIR/billing.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Billing

**Date**: 2024-07-01
**Status**: Draft
**Specification**: `docs/workflow/specification/billing-system.md`

## Overview

Billing plan.
EOF

run_migration
content=$(cat "$PLAN_DIR/billing.md")

assert_contains "$content" "^specification: billing-system.md$" "Specification filename extracted from path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Different format value (beads)${NC}"
setup_fixture
cat > "$PLAN_DIR/beads-plan.md" << 'EOF'
---
format: beads
---

# Implementation Plan: Beads Plan

**Date**: 2024-08-01
**Status**: Draft
**Specification**: `docs/workflow/specification/beads-plan.md`

## Overview

Using beads format.
EOF

run_migration
content=$(cat "$PLAN_DIR/beads-plan.md")

assert_contains "$content" "^format: beads$" "Non-default format preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File already has full frontmatter (should skip)${NC}"
setup_fixture
cat > "$PLAN_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-01-01
format: local-markdown
specification: existing.md
---

# Implementation Plan: Existing

## Overview

Already migrated content.
EOF

original_content=$(cat "$PLAN_DIR/existing.md")
run_migration
new_content=$(cat "$PLAN_DIR/existing.md")

assert_equals "$new_content" "$original_content" "File with full frontmatter unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File without legacy format (should skip)${NC}"
setup_fixture
cat > "$PLAN_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status, date, or specification fields.

## Section

Content here.
EOF

original_content=$(cat "$PLAN_DIR/weird.md")
run_migration
new_content=$(cat "$PLAN_DIR/weird.md")

assert_equals "$new_content" "$original_content" "File without legacy format unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$PLAN_DIR/idempotent.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Idempotent Test

**Date**: 2024-09-01
**Status**: Draft
**Specification**: `docs/workflow/specification/idempotent.md`

## Overview

Content.
EOF

run_migration
first_run=$(cat "$PLAN_DIR/idempotent.md")

# Run again
run_migration
second_run=$(cat "$PLAN_DIR/idempotent.md")

assert_equals "$second_run" "$first_run" "Second migration run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preservation (multiple phases)${NC}"
setup_fixture
cat > "$PLAN_DIR/full-plan.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Full Plan

**Date**: 2024-10-01
**Status**: In Progress
**Specification**: `docs/workflow/specification/full-plan.md`

## Overview

Plan overview.

## Phase 1: Setup

Phase 1 tasks.

## Phase 2: Core

Phase 2 tasks.

## Phase 3: Polish

Phase 3 tasks.
EOF

run_migration
content=$(cat "$PLAN_DIR/full-plan.md")

assert_contains "$content" "^## Overview$" "Overview section preserved"
assert_contains "$content" "^## Phase 1: Setup$" "Phase 1 section preserved"
assert_contains "$content" "^## Phase 2: Core$" "Phase 2 section preserved"
assert_contains "$content" "^## Phase 3: Polish$" "Phase 3 section preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Kebab-case topic from filename${NC}"
setup_fixture
cat > "$PLAN_DIR/user-profile-settings.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: User Profile Settings

**Date**: 2024-11-01
**Status**: Draft
**Specification**: `docs/workflow/specification/user-profile-settings.md`

## Overview

Content.
EOF

run_migration
content=$(cat "$PLAN_DIR/user-profile-settings.md")

assert_contains "$content" "^topic: user-profile-settings$" "Topic uses kebab-case from filename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Beads format with epic → plan_id${NC}"
setup_fixture
cat > "$PLAN_DIR/docman-python-sdk.md" << 'EOF'
---
format: beads
epic: docman-api-python-0c8
---

# Plan Reference: DocMan Python SDK

**Specification**: `docs/workflow/specification/docman-python-sdk.md`
**Created**: 2026-01-12

## About This Plan

This plan is managed via Beads.
EOF

run_migration
content=$(cat "$PLAN_DIR/docman-python-sdk.md")

assert_contains "$content" "^format: beads$" "Beads format preserved"
assert_contains "$content" "^plan_id: docman-api-python-0c8$" "Epic migrated to plan_id"
assert_contains "$content" "^date: 2026-01-12$" "Date extracted from Created field"

# Should NOT have epic field anymore
TESTS_RUN=$((TESTS_RUN + 1))
if ! echo "$content" | grep -q "^epic:"; then
    echo -e "  ${GREEN}✓${NC} Epic field removed (migrated to plan_id)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} Epic field removed (migrated to plan_id)"
    echo -e "    Found epic field when it should be plan_id"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Linear/Backlog format with project → plan_id${NC}"
setup_fixture
cat > "$PLAN_DIR/linear-plan.md" << 'EOF'
---
format: linear
project: my-linear-project
---

# Plan Reference: Linear Plan

**Specification**: `docs/workflow/specification/linear-plan.md`
**Created**: 2026-01-18

## About This Plan

This plan is managed via Linear.
EOF

run_migration
content=$(cat "$PLAN_DIR/linear-plan.md")

assert_contains "$content" "^format: linear$" "Linear format preserved"
assert_contains "$content" "^plan_id: my-linear-project$" "Project migrated to plan_id"

# Should NOT have project field anymore
TESTS_RUN=$((TESTS_RUN + 1))
if ! echo "$content" | grep -q "^project:"; then
    echo -e "  ${GREEN}✓${NC} Project field removed (migrated to plan_id)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} Project field removed (migrated to plan_id)"
    echo -e "    Found project field when it should be plan_id"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Created field as alternative to Date${NC}"
setup_fixture
cat > "$PLAN_DIR/created-field.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Created Field Test

**Created**: 2026-01-15
**Status**: Draft
**Specification**: `docs/workflow/specification/created-field.md`

## Overview

Uses Created instead of Date.
EOF

run_migration
content=$(cat "$PLAN_DIR/created-field.md")

assert_contains "$content" "^date: 2026-01-15$" "Date extracted from Created field (alternative)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No plan_id when original has no epic/project${NC}"
setup_fixture
cat > "$PLAN_DIR/no-plan-id.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Plan ID

**Specification**: `docs/workflow/specification/no-plan-id.md`
**Date**: 2026-01-20

## Overview

Local markdown format, no external ID.
EOF

run_migration
content=$(cat "$PLAN_DIR/no-plan-id.md")

# Should NOT have a plan_id field since original didn't have epic/project
TESTS_RUN=$((TESTS_RUN + 1))
if ! echo "$content" | grep -q "^plan_id:"; then
    echo -e "  ${GREEN}✓${NC} No plan_id when original had no epic/project"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} No plan_id when original had no epic/project"
    echo -e "    Found plan_id field when it shouldn't exist"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

echo -e "${YELLOW}Test: Body with --- horizontal rules preserved${NC}"
setup_fixture
cat > "$PLAN_DIR/hr-rules.md" << 'TESTEOF'
---
format: local-markdown
---

# Implementation Plan: HR Rules

**Date**: 2024-12-01
**Status**: Draft
**Specification**: `docs/workflow/specification/hr-rules.md`

## Phase 1: Setup

Setup tasks here.

---

## Phase 2: Core

Core tasks here.

---

## Phase 3: Cleanup

Cleanup tasks here.
TESTEOF

run_migration
content=$(cat "$PLAN_DIR/hr-rules.md")

assert_contains "$content" "^format: local-markdown$" "Format preserved in frontmatter"
assert_contains "$content" "^topic: hr-rules$" "Topic extracted from filename"
assert_contains "$content" "^status: in-progress$" "Status mapped correctly"

body_after=$(sed -n '/^## /,$p' "$PLAN_DIR/hr-rules.md")
assert_contains "$body_after" "^## Phase 1: Setup$" "Phase 1 section preserved"
assert_contains "$body_after" "^## Phase 2: Core$" "Phase 2 section preserved"
assert_contains "$body_after" "^## Phase 3: Cleanup$" "Phase 3 section preserved"
assert_contains "$body_after" "^---$" "Horizontal rules preserved in body"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Exact body content preservation${NC}"
setup_fixture
cat > "$PLAN_DIR/exact-body.md" << 'TESTEOF'
---
format: beads
epic: PROJ-123
---

# Plan Reference: Exact Body

**Specification**: `docs/workflow/specification/exact-body.md`
**Created**: 2026-01-10

## Overview

Plan overview paragraph.

---

## Phase 1: Database

| Task | Status | Notes |
|------|--------|-------|
| Create migrations | pending | Schema first |
| Seed data | pending | After migrations |

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
});
```

---

## Phase 2: API

| Task | Status | Notes |
|------|--------|-------|
| REST endpoints | pending | CRUD |
| Auth middleware | pending | JWT |
TESTEOF

body_before=$(sed -n '/^## /,$p' "$PLAN_DIR/exact-body.md")

run_migration

body_after=$(sed -n '/^## /,$p' "$PLAN_DIR/exact-body.md")

assert_equals "$body_after" "$body_before" "Body content exactly preserved after migration"

content=$(cat "$PLAN_DIR/exact-body.md")
assert_contains "$content" "^format: beads$" "Format preserved"
assert_contains "$content" "^plan_id: PROJ-123$" "Epic migrated to plan_id"

echo ""

# ----------------------------------------------------------------------------

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
