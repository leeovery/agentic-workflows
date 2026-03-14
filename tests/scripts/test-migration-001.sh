#!/bin/bash
#
# Tests migration 001-discussion-frontmatter.sh
# Validates conversion from legacy markdown header format to YAML frontmatter.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/001-discussion-frontmatter.sh"

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
    mkdir -p "$TEST_DIR/docs/workflow/discussion"
    DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
}

run_migration() {
    cd "$TEST_DIR"
    # Source the migration script (it uses DISCUSSION_DIR variable)
    DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
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

echo -e "${YELLOW}Test: Legacy format with Exploring status${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/api-design.md" << 'EOF'
# Discussion: API Design

**Date**: 2024-01-15
**Status**: Exploring

## Context

We need to design the API.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/api-design.md")

assert_file_starts_with "$DISCUSSION_DIR/api-design.md" "---" "File starts with frontmatter delimiter"
assert_contains "$content" "^topic: api-design$" "Topic extracted from filename"
assert_contains "$content" "^status: in-progress$" "Exploring status mapped to in-progress"
assert_contains "$content" "^date: 2024-01-15$" "Date extracted"
assert_contains "$content" "^# Discussion: API Design$" "H1 heading preserved"
assert_contains "$content" "^## Context$" "Content sections preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Deciding status${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/auth-flow.md" << 'EOF'
# Discussion: Auth Flow

**Date**: 2024-02-20
**Status**: Deciding

## Options

Option A or B.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/auth-flow.md")

assert_contains "$content" "^status: in-progress$" "Deciding status mapped to in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Concluded status${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/caching.md" << 'EOF'
# Discussion: Caching Strategy

**Date**: 2024-03-10
**Status**: Concluded

## Decision

We chose Redis.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/caching.md")

assert_contains "$content" "^status: concluded$" "Concluded status mapped to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Complete status${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/database.md" << 'EOF'
# Discussion: Database Choice

**Date**: 2024-04-01
**Status**: Complete

## Decision

PostgreSQL selected.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/database.md")

assert_contains "$content" "^status: concluded$" "Complete status mapped to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with emoji status (✅ Complete)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/logging.md" << 'EOF'
# Discussion: Logging

**Date**: 2024-05-15
**Status**: ✅ Complete

## Decision

Structured logging with JSON.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/logging.md")

assert_contains "$content" "^status: concluded$" "✅ Complete status mapped to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with alternate colon placement (Status:)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/testing.md" << 'EOF'
# Discussion: Testing Strategy

**Date**: 2024-06-01
**Status:** Concluded

## Decision

TDD approach.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/testing.md")

assert_contains "$content" "^status: concluded$" "Alternate colon format handled"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format with Started field instead of Date${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/deployment.md" << 'EOF'
# Discussion: Deployment

**Started:** 2024-07-01
**Status**: Exploring

## Context

Deployment options.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/deployment.md")

assert_contains "$content" "^date: 2024-07-01$" "Date extracted from Started field"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Legacy format without date field${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/no-date.md" << 'EOF'
# Discussion: No Date

**Status**: Exploring

## Context

Missing date.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/no-date.md")
today=$(date +%Y-%m-%d)

assert_contains "$content" "^date: $today$" "Date defaults to today when not found"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File already has frontmatter (should skip)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-01-01
---

# Discussion: Existing

## Overview

Already migrated content.
EOF

original_content=$(cat "$DISCUSSION_DIR/existing.md")
run_migration
new_content=$(cat "$DISCUSSION_DIR/existing.md")

assert_equals "$new_content" "$original_content" "File with frontmatter unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: File without legacy format (should skip)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status or date fields.

## Section

Content here.
EOF

original_content=$(cat "$DISCUSSION_DIR/weird.md")
run_migration
new_content=$(cat "$DISCUSSION_DIR/weird.md")

assert_equals "$new_content" "$original_content" "File without legacy format unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/idempotent.md" << 'EOF'
# Discussion: Idempotent Test

**Date**: 2024-08-01
**Status**: Exploring

## Context

Content.
EOF

run_migration
first_run=$(cat "$DISCUSSION_DIR/idempotent.md")

# Run again
run_migration
second_run=$(cat "$DISCUSSION_DIR/idempotent.md")

assert_equals "$second_run" "$first_run" "Second migration run produces same result"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Content preservation (multiple sections)${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/full-discussion.md" << 'EOF'
# Discussion: Full Discussion

**Date**: 2024-09-01
**Status**: Concluded

## Context

Background info.

## Options

- Option A
- Option B

## Decision

We chose Option A.

## Consequences

Some impacts.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/full-discussion.md")

assert_contains "$content" "^## Context$" "Context section preserved"
assert_contains "$content" "^## Options$" "Options section preserved"
assert_contains "$content" "^## Decision$" "Decision section preserved"
assert_contains "$content" "^## Consequences$" "Consequences section preserved"
assert_contains "$content" "Option A" "List content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Kebab-case topic from filename${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/user-authentication-flow.md" << 'EOF'
# Discussion: User Authentication Flow

**Date**: 2024-10-01
**Status**: Exploring

## Context

Content.
EOF

run_migration
content=$(cat "$DISCUSSION_DIR/user-authentication-flow.md")

assert_contains "$content" "^topic: user-authentication-flow$" "Topic uses kebab-case from filename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Body with multiple --- horizontal rules preserved${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/multi-hr.md" << 'TESTEOF'
# Discussion: Multi HR

**Date**: 2024-11-01
**Status**: Exploring

## Questions

What is the approach?

---

## Answers

We do X.

---

## Follow-up

More questions here.

---

## Final Notes

Wrap up.
TESTEOF

body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/multi-hr.md")
run_migration
content=$(cat "$DISCUSSION_DIR/multi-hr.md")
body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/multi-hr.md")

assert_contains "$content" "^status: in-progress$" "Frontmatter status is correct"
assert_contains "$content" "^topic: multi-hr$" "Frontmatter topic is correct"
assert_equals "$body_after" "$body_before" "All body --- horizontal rules preserved exactly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Body with code blocks, tables, and special characters${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/special-chars.md" << 'TESTEOF'
# Discussion: Special Chars

**Date**: 2024-11-02
**Status**: Deciding

## Overview

Here is a table:

| Column A | Column B | Column C |
|----------|----------|----------|
| value1   | value2   | value3   |

## Code Example

```go
func main() {
	fmt.Println("hello \"world\"")
	path := "C:\\Users\\test"
}
```

## Inline Code

Use `grep -E "pattern|other"` to search.

Also check `$HOME/.config` for settings.
TESTEOF

body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/special-chars.md")
run_migration
content=$(cat "$DISCUSSION_DIR/special-chars.md")
body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/special-chars.md")

assert_contains "$content" "^status: in-progress$" "Frontmatter status correct"
assert_equals "$body_after" "$body_before" "Body with code blocks, tables, and special chars preserved exactly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Exact body content preservation after migration${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/exact-body.md" << 'TESTEOF'
# Discussion: Exact Body

**Date**: 2024-11-03
**Status**: Concluded

## Context

This discussion can't be simplified. It has "quoted text" and backslashes: C:\path\to\file.

---

## Options

- Option A: Use `redis-cli --scan`
- Option B: Use the API

| Approach | Pros | Cons |
|----------|------|------|
| A        | Fast | Complex |
| B        | Simple | Slow |

---

## Decision

```bash
#!/bin/bash
echo "We chose option A"
VAR='single quotes'
VAR2="double \"escaped\" quotes"
```

---

## Implementation Notes

1. First step
2. Second step
   - Sub-item with special chars: @#$%^&*()
   - Another sub-item

Final paragraph with apostrophes: don't, won't, can't.
TESTEOF

body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/exact-body.md")
run_migration
content=$(cat "$DISCUSSION_DIR/exact-body.md")
body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/exact-body.md")

assert_contains "$content" "^status: concluded$" "Frontmatter status correct"
assert_contains "$content" "^topic: exact-body$" "Frontmatter topic correct"
assert_equals "$body_after" "$body_before" "Complex body content preserved exactly after migration"

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
