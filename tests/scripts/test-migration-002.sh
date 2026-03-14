#!/bin/bash
#
# Tests migration 002-specification-frontmatter.sh
# Validates conversion from legacy markdown header format to YAML frontmatter.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/002-specification-frontmatter.sh"

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
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
}

run_migration() {
    cd "$TEST_DIR"
    # Source the migration script (it uses SPEC_DIR variable)
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
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

get_frontmatter_value() {
    local file="$1"
    local key="$2"
    # Extract value from frontmatter (between first --- and second ---)
    sed -n '/^---$/,/^---$/p' "$file" | grep "^$key:" | sed "s/^$key:[[:space:]]*//"
}

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Legacy format with Building specification status${NC}"
setup_fixture
cat > "$SPEC_DIR/user-auth.md" << 'EOF'
# Specification: User Authentication

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-01-15

## Overview

This is the spec content.
EOF

run_migration
content=$(cat "$SPEC_DIR/user-auth.md")

assert_file_starts_with "$SPEC_DIR/user-auth.md" "---" "File starts with frontmatter delimiter"
assert_contains "$content" "^topic: user-auth$" "Topic extracted from filename"
assert_contains "$content" "^status: in-progress$" "Status mapped to in-progress"
assert_contains "$content" "^type: feature$" "Type preserved as feature"
assert_contains "$content" "^date: 2024-01-15$" "Date extracted from Last Updated"
assert_contains "$content" "^# Specification: User Authentication$" "H1 heading preserved"
assert_contains "$content" "^## Overview$" "Content sections preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Complete status${NC}"
setup_fixture
cat > "$SPEC_DIR/billing-system.md" << 'EOF'
# Specification: Billing System

**Status**: Complete
**Type**: cross-cutting
**Last Updated**: 2024-02-20

## Overview

Billing content here.
EOF

run_migration
content=$(cat "$SPEC_DIR/billing-system.md")

assert_contains "$content" "^status: concluded$" "Complete status mapped to concluded"
assert_contains "$content" "^type: cross-cutting$" "Type preserved as cross-cutting"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Completed status (variant)${NC}"
setup_fixture
cat > "$SPEC_DIR/api-design.md" << 'EOF'
# Specification: API Design

**Status**: Completed
**Type**: feature
**Date**: 2024-03-10

## Overview

API content.
EOF

run_migration
content=$(cat "$SPEC_DIR/api-design.md")

assert_contains "$content" "^status: concluded$" "Completed status mapped to concluded"
assert_contains "$content" "^date: 2024-03-10$" "Date extracted from Date field"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Building status (short form)${NC}"
setup_fixture
cat > "$SPEC_DIR/caching.md" << 'EOF'
# Specification: Caching Strategy

**Status**: Building
**Type**: cross-cutting
**Last Updated**: 2024-04-01

## Overview

Caching content.
EOF

run_migration
content=$(cat "$SPEC_DIR/caching.md")

assert_contains "$content" "^status: in-progress$" "Building status mapped to in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without Type field${NC}"
setup_fixture
cat > "$SPEC_DIR/notifications.md" << 'EOF'
# Specification: Notifications

**Status**: Building specification
**Last Updated**: 2024-05-15

## Overview

Notification content.
EOF

run_migration
content=$(cat "$SPEC_DIR/notifications.md")

assert_contains "$content" "^type: *$" "Type left empty when not found (requires manual review)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without date field${NC}"
setup_fixture
cat > "$SPEC_DIR/logging.md" << 'EOF'
# Specification: Logging

**Status**: Building specification
**Type**: cross-cutting

## Overview

Logging content.
EOF

run_migration
content=$(cat "$SPEC_DIR/logging.md")
today=$(date +%Y-%m-%d)

assert_contains "$content" "^date: $today$" "Date defaults to today when not found"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File already has frontmatter (should skip)${NC}"
setup_fixture
cat > "$SPEC_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
type: feature
date: 2024-01-01
---

# Specification: Existing

## Overview

Already migrated content.
EOF

original_content=$(cat "$SPEC_DIR/existing.md")
run_migration
new_content=$(cat "$SPEC_DIR/existing.md")

assert_equals "$new_content" "$original_content" "File with frontmatter unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File without legacy format (should skip)${NC}"
setup_fixture
cat > "$SPEC_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status or type fields.

## Section

Content here.
EOF

original_content=$(cat "$SPEC_DIR/weird.md")
run_migration
new_content=$(cat "$SPEC_DIR/weird.md")

assert_equals "$new_content" "$original_content" "File without legacy format unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$SPEC_DIR/idempotent.md" << 'EOF'
# Specification: Idempotent Test

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-06-01

## Overview

Content.
EOF

run_migration
first_run=$(cat "$SPEC_DIR/idempotent.md")

# Run again
run_migration
second_run=$(cat "$SPEC_DIR/idempotent.md")

assert_equals "$second_run" "$first_run" "Second migration run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Status variation - Draft${NC}"
setup_fixture
cat > "$SPEC_DIR/draft-spec.md" << 'EOF'
# Specification: Draft Spec

**Status**: Draft
**Type**: feature
**Last Updated**: 2024-07-01

## Overview

Draft content.
EOF

run_migration
content=$(cat "$SPEC_DIR/draft-spec.md")

assert_contains "$content" "^status: in-progress$" "Draft status mapped to in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Status variation - Done${NC}"
setup_fixture
cat > "$SPEC_DIR/done-spec.md" << 'EOF'
# Specification: Done Spec

**Status**: Done
**Type**: feature
**Last Updated**: 2024-08-01

## Overview

Done content.
EOF

run_migration
content=$(cat "$SPEC_DIR/done-spec.md")

assert_contains "$content" "^status: concluded$" "Done status mapped to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preservation (multiple sections)${NC}"
setup_fixture
cat > "$SPEC_DIR/full-spec.md" << 'EOF'
# Specification: Full Spec

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-09-01

## Overview

Overview content.

## Architecture

Architecture details.

## Edge Cases

- Case 1
- Case 2

## Dependencies

None.
EOF

run_migration
content=$(cat "$SPEC_DIR/full-spec.md")

assert_contains "$content" "^## Overview$" "Overview section preserved"
assert_contains "$content" "^## Architecture$" "Architecture section preserved"
assert_contains "$content" "^## Edge Cases$" "Edge Cases section preserved"
assert_contains "$content" "- Case 1" "List content preserved"
assert_contains "$content" "^## Dependencies$" "Dependencies section preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Kebab-case topic from filename${NC}"
setup_fixture
cat > "$SPEC_DIR/user-profile-settings.md" << 'EOF'
# Specification: User Profile Settings

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-10-01

## Overview

Content.
EOF

run_migration
content=$(cat "$SPEC_DIR/user-profile-settings.md")

assert_contains "$content" "^topic: user-profile-settings$" "Topic uses kebab-case from filename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Sources field with single source${NC}"
setup_fixture
cat > "$SPEC_DIR/migration-spec.md" << 'EOF'
# Specification: Migration

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-01-25
**Sources**: migration-subcommand

---

## Specification

### Overview

The migration command imports task data.
EOF

run_migration
content=$(cat "$SPEC_DIR/migration-spec.md")

assert_contains "$content" "^sources:$" "Sources field present in frontmatter"
assert_contains "$content" "^  - migration-subcommand$" "Single source preserved as YAML list item"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Sources field with multiple sources (tick-core pattern)${NC}"
setup_fixture
cat > "$SPEC_DIR/tick-core.md" << 'EOF'
# Specification: Tick Core

**Status**: Complete
**Type**: feature
**Last Updated**: 2026-01-24
**Sources**: project-fundamentals, data-schema-design, freshness-dual-write, id-format-implementation, hierarchy-dependency-model, cli-command-structure-ux, toon-output-format, tui

---

## Specification

### Vision & Scope

Tick is a minimal task tracker.
EOF

run_migration
content=$(cat "$SPEC_DIR/tick-core.md")

assert_contains "$content" "^sources:$" "Sources field present in frontmatter"
assert_contains "$content" "^  - project-fundamentals$" "First source preserved"
assert_contains "$content" "^  - data-schema-design$" "Second source preserved"
assert_contains "$content" "^  - tui$" "Last source preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Specification without Sources field${NC}"
setup_fixture
cat > "$SPEC_DIR/no-sources.md" << 'EOF'
# Specification: No Sources

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-01-24

---

## Overview

This spec has no sources.
EOF

run_migration
content=$(cat "$SPEC_DIR/no-sources.md")

# Should NOT have a sources field
TESTS_RUN=$((TESTS_RUN + 1))
if ! echo "$content" | grep -q "^sources:"; then
    echo -e "  ${GREEN}✓${NC} No sources field when source not present"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "  ${RED}✗${NC} No sources field when source not present"
    echo -e "    Found sources field when it shouldn't exist"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Body with --- horizontal rules preserved${NC}"
setup_fixture
cat > "$SPEC_DIR/hr-body.md" << 'TESTEOF'
# Specification: Test

**Status**: Complete
**Last Updated**: 2024-01-01

---

## Overview

Content here.

---

## Dependencies

More content.

---

## Final Section

End content.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/hr-body.md")

assert_contains "$content" "^status: concluded$" "Frontmatter status correct"
assert_contains "$content" "^date: 2024-01-01$" "Frontmatter date correct"

body=$(sed -n '/^## /,$p' "$SPEC_DIR/hr-body.md")
assert_contains "$body" "^## Overview$" "Overview section preserved"
assert_contains "$body" "^## Dependencies$" "Dependencies section preserved"
assert_contains "$body" "^## Final Section$" "Final Section preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Exact body content preservation${NC}"
setup_fixture
cat > "$SPEC_DIR/exact-body.md" << 'TESTEOF'
# Specification: Exact Body

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-03-15

---

## Overview

Content with **bold** and `code`.

---

## Data Model

| Column | Type | Notes |
|--------|------|-------|
| id     | int  | PK    |
| name   | text | required |

## Code Example

```php
$value = "hello";
echo $value;
```

## Edge Cases

- Item with "quotes"
- Item with `backticks`
- Item with *emphasis*

---

## Final Notes

Done.
TESTEOF

body_before=$(sed -n '/^## /,$p' "$SPEC_DIR/exact-body.md")
run_migration
body_after=$(sed -n '/^## /,$p' "$SPEC_DIR/exact-body.md")

assert_equals "$body_after" "$body_before" "Body content exactly preserved after migration"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Building specification status with complex body${NC}"
setup_fixture
cat > "$SPEC_DIR/building-complex.md" << 'TESTEOF'
# Specification: Building Complex

**Status**: Building specification
**Type**: cross-cutting
**Last Updated**: 2024-06-10

---

## Overview

Webhook processing system.

| Event | Handler | Priority |
|-------|---------|----------|
| create | onCreate | high |
| update | onUpdate | medium |

---

## Watchers

Content about watchers.

---

## Integration

Final integration notes.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/building-complex.md")

assert_contains "$content" "^status: in-progress$" "Building specification maps to in-progress"

body=$(sed -n '/^## /,$p' "$SPEC_DIR/building-complex.md")
assert_contains "$body" "^## Overview$" "Overview section preserved"
assert_contains "$body" "^## Watchers$" "Watchers section preserved"
assert_contains "$body" "^## Integration$" "Integration section preserved"
assert_contains "$body" "| create | onCreate | high |" "Table content preserved"

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
