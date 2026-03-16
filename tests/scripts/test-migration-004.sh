#!/bin/bash
#
# Tests migration 004-sources-object-format.sh
# Validates conversion from simple sources array to object format with status.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/004-sources-object-format.sh"

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
    echo "updated"
}

report_skip() {
    echo "skipped"
}

# Export functions for sourced script
export -f report_update report_skip

#
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/docs"
    mkdir -p "$TEST_DIR/docs/workflow/specification"
    mkdir -p "$TEST_DIR/docs/workflow/discussion"
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
    DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
}

run_migration() {
    cd "$TEST_DIR"
    # Source the migration script (it uses SPEC_DIR and DISCUSSION_DIR variables)
    SPEC_DIR="$TEST_DIR/docs/workflow/specification"
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

echo -e "${YELLOW}Test: Single source conversion${NC}"
setup_fixture
cat > "$SPEC_DIR/single-source.md" << 'EOF'
---
topic: single-source
status: concluded
type: feature
date: 2024-01-15
sources:
  - auth-flow
---

# Specification: Single Source

## Overview

Content here.
EOF

run_migration
content=$(cat "$SPEC_DIR/single-source.md")

assert_contains "$content" "- name: auth-flow" "Source name converted to object"
assert_contains "$content" "status: incorporated" "Status set to incorporated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple sources conversion${NC}"
setup_fixture
cat > "$SPEC_DIR/multi-source.md" << 'EOF'
---
topic: multi-source
status: in-progress
type: feature
date: 2024-02-20
sources:
  - topic-a
  - topic-b
  - topic-c
---

# Specification: Multi Source

## Overview

Content here.
EOF

run_migration
content=$(cat "$SPEC_DIR/multi-source.md")

assert_contains "$content" "- name: topic-a" "First source converted"
assert_contains "$content" "- name: topic-b" "Second source converted"
assert_contains "$content" "- name: topic-c" "Third source converted"
# All should have incorporated status
assert_contains "$content" "status: incorporated" "Status set to incorporated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Sources with quotes${NC}"
setup_fixture
cat > "$SPEC_DIR/quoted-sources.md" << 'EOF'
---
topic: quoted-sources
status: concluded
type: feature
date: 2024-03-10
sources:
  - "quoted-topic"
  - "another-topic"
---

# Specification: Quoted Sources

## Overview

Content here.
EOF

run_migration
content=$(cat "$SPEC_DIR/quoted-sources.md")

assert_contains "$content" "- name: quoted-topic" "Quoted source name extracted"
assert_contains "$content" "- name: another-topic" "Second quoted source extracted"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Already migrated (object format) - should skip${NC}"
setup_fixture
cat > "$SPEC_DIR/already-migrated.md" << 'EOF'
---
topic: already-migrated
status: concluded
type: feature
date: 2024-04-01
sources:
  - name: existing-topic
    status: incorporated
  - name: another-topic
    status: pending
---

# Specification: Already Migrated

## Overview

Content here.
EOF

original_content=$(cat "$SPEC_DIR/already-migrated.md")
run_migration
new_content=$(cat "$SPEC_DIR/already-migrated.md")

assert_equals "$new_content" "$original_content" "File with object format unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No sources field WITH matching discussion${NC}"
setup_fixture

# Create a matching discussion file
cat > "$DISCUSSION_DIR/has-discussion.md" << 'EOF'
---
topic: has-discussion
status: concluded
date: 2024-05-15
---

# Discussion: Has Discussion

Some discussion content.
EOF

# Create spec without sources field
cat > "$SPEC_DIR/has-discussion.md" << 'EOF'
---
topic: has-discussion
status: in-progress
type: feature
date: 2024-05-15
---

# Specification: Has Discussion

## Overview

Content here.
EOF

run_migration
content=$(cat "$SPEC_DIR/has-discussion.md")

assert_contains "$content" "sources:" "Sources field added"
assert_contains "$content" "- name: has-discussion" "Matching discussion added as source"
assert_contains "$content" "status: incorporated" "Status set to incorporated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No sources field WITHOUT matching discussion${NC}"
setup_fixture

# Create spec without sources field and no matching discussion
cat > "$SPEC_DIR/no-discussion.md" << 'EOF'
---
topic: no-discussion
status: in-progress
type: feature
date: 2024-05-15
---

# Specification: No Discussion

## Overview

Content here.
EOF

output=$(run_migration 2>&1)
content=$(cat "$SPEC_DIR/no-discussion.md")

assert_contains "$content" "sources: \[\]" "Empty sources array added"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No frontmatter - should skip${NC}"
setup_fixture
cat > "$SPEC_DIR/no-frontmatter.md" << 'EOF'
# Specification: No Frontmatter

## Overview

This file has no YAML frontmatter.
EOF

original_content=$(cat "$SPEC_DIR/no-frontmatter.md")
run_migration
new_content=$(cat "$SPEC_DIR/no-frontmatter.md")

assert_equals "$new_content" "$original_content" "File without frontmatter unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency (running migration twice)${NC}"
setup_fixture
cat > "$SPEC_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: concluded
type: feature
date: 2024-06-01
sources:
  - source-one
  - source-two
---

# Specification: Idempotent

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

echo -e "${YELLOW}Test: Content preservation after migration${NC}"
setup_fixture
cat > "$SPEC_DIR/preserve-content.md" << 'EOF'
---
topic: preserve-content
status: concluded
type: feature
date: 2024-07-01
sources:
  - discussion-one
  - discussion-two
---

# Specification: Preserve Content

## Overview

This is the overview content.

## Architecture

### Component A

Details about component A.

### Component B

Details about component B.

## Edge Cases

- Edge case 1
- Edge case 2
- Edge case 3

## Dependencies

None.
EOF

run_migration
content=$(cat "$SPEC_DIR/preserve-content.md")

assert_contains "$content" "# Specification: Preserve Content" "H1 heading preserved"
assert_contains "$content" "## Overview" "Overview section preserved"
assert_contains "$content" "## Architecture" "Architecture section preserved"
assert_contains "$content" "### Component A" "Nested heading preserved"
assert_contains "$content" "## Edge Cases" "Edge Cases section preserved"
assert_contains "$content" "- Edge case 1" "List content preserved"
assert_contains "$content" "## Dependencies" "Dependencies section preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Other frontmatter fields preserved${NC}"
setup_fixture
cat > "$SPEC_DIR/other-fields.md" << 'EOF'
---
topic: other-fields
status: concluded
type: feature
date: 2024-08-01
sources:
  - topic-x
superseded_by: newer-spec
---

# Specification: Other Fields

## Overview

Content.
EOF

run_migration
content=$(cat "$SPEC_DIR/other-fields.md")

assert_contains "$content" "topic: other-fields" "Topic field preserved"
assert_contains "$content" "status: concluded" "Status field preserved"
assert_contains "$content" "type: feature" "Type field preserved"
assert_contains "$content" "date: 2024-08-01" "Date field preserved"
assert_contains "$content" "superseded_by: newer-spec" "Superseded_by field preserved"
assert_contains "$content" "- name: topic-x" "Source converted to object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Empty sources array - should skip${NC}"
setup_fixture
cat > "$SPEC_DIR/empty-sources.md" << 'EOF'
---
topic: empty-sources
status: in-progress
type: feature
date: 2024-09-01
sources:
---

# Specification: Empty Sources

## Overview

Content.
EOF

# This is a bit tricky - file has sources: but no actual items
# Migration should recognize this and not break the file
run_migration
content=$(cat "$SPEC_DIR/empty-sources.md")

# File should still be valid YAML
assert_contains "$content" "^---$" "Frontmatter delimiters present"
assert_contains "$content" "topic: empty-sources" "Topic preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Sources is last field in frontmatter${NC}"
setup_fixture
cat > "$SPEC_DIR/sources-last.md" << 'EOF'
---
topic: sources-last
status: concluded
type: feature
date: 2024-10-01
sources:
  - final-topic
---

# Specification: Sources Last

## Overview

Content.
EOF

run_migration
content=$(cat "$SPEC_DIR/sources-last.md")

assert_contains "$content" "- name: final-topic" "Source converted when last in frontmatter"
assert_contains "$content" "status: incorporated" "Status added"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Sources last with --- horizontal rules in body${NC}"
setup_fixture
cat > "$SPEC_DIR/body-with-hr.md" << 'TESTEOF'
---
topic: body-with-hr
status: concluded
type: feature
date: 2024-11-01
sources:
  - my-discussion
---

# Specification: Body With HR

## Overview

Some content here.

---

## Dependencies

| Dep | Reason |
|-----|--------|
| core | Needed first |

### Notes

- The plugin architecture itself can be designed in parallel
- Item two

---

## More content after second HR

Final paragraph.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/body-with-hr.md")

assert_contains "$content" "- name: my-discussion" "Source converted with HR in body"
assert_contains "$content" "status: incorporated" "Status added with HR in body"
assert_contains "$content" "## Overview" "Overview section preserved"
assert_contains "$content" "## Dependencies" "Dependencies section preserved"
assert_contains "$content" "## More content after second HR" "Content after second HR preserved"
assert_contains "$content" "Final paragraph." "Final paragraph preserved"
assert_contains "$content" "The plugin architecture" "List item in body preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Multiple sources last with rich body content${NC}"
setup_fixture
cat > "$SPEC_DIR/rich-body.md" << 'TESTEOF'
---
topic: rich-body
status: concluded
type: feature
date: 2024-11-01
sources:
  - topic-one
  - topic-two
  - topic-three
---

# Specification: Rich Body

## Overview

Content with various markdown:

- List item one
- List item two with `code`

### Subsection

```bash
echo "code block"
tick create "Task with quotes" --priority 1
```

---

## Another Section

**Bold** and *italic* text.

| Column A | Column B |
|----------|----------|
| value    | other    |
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/rich-body.md")

assert_contains "$content" "- name: topic-one" "First source converted"
assert_contains "$content" "- name: topic-two" "Second source converted"
assert_contains "$content" "- name: topic-three" "Third source converted"
assert_contains "$content" "## Overview" "Overview preserved"
assert_contains "$content" 'tick create "Task with quotes"' "Code block with quotes preserved"
assert_contains "$content" "## Another Section" "Section after HR preserved"
assert_contains "$content" "Column A" "Table preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No sources with matching discussion and --- in body${NC}"
setup_fixture
cat > "$DISCUSSION_DIR/has-hr-body.md" << 'EOF'
---
topic: has-hr-body
status: concluded
date: 2024-11-01
---

# Discussion: Has HR Body

## Content
EOF

cat > "$SPEC_DIR/has-hr-body.md" << 'TESTEOF'
---
topic: has-hr-body
status: in-progress
type: feature
date: 2024-11-01
---

# Specification: Has HR Body

## Overview

Content here.

---

## Dependencies

More content here.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/has-hr-body.md")

assert_contains "$content" "- name: has-hr-body" "Matching discussion added"
assert_contains "$content" "status: incorporated" "Status set"
assert_contains "$content" "## Overview" "Overview preserved"
assert_contains "$content" "## Dependencies" "Dependencies preserved"
assert_contains "$content" "More content here." "Content after HR preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Real-world pattern - many sources + body with lists, tables, code, HR${NC}"
setup_fixture
cat > "$SPEC_DIR/tick-core-pattern.md" << 'TESTEOF'
---
topic: tick-core-pattern
status: concluded
type: feature
date: 2026-01-25
sources:
  - project-fundamentals
  - data-schema-design
  - freshness-dual-write
  - id-format-implementation
  - hierarchy-dependency-model
  - cli-command-structure-ux
  - toon-output-format
  - tui
---

# Specification: Tick Core Pattern

## Overview

Tick uses a dual-storage architecture:

- **JSONL** (`tasks.jsonl`) - Source of truth
- **SQLite** (`.tick/cache.db`) - Query cache

### Task Schema

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `title` | string | Yes |
| `status` | enum | Yes |

#### Field Constraints

- **status**: Only valid transitions enforced
- **priority**: Integer 0-4 only
- **blocked_by**: Must reference existing task IDs

### CLI Commands

```bash
tick create "Setup authentication" --priority 1
tick create "Login endpoint" --blocked-by tick-a1b2
```

**Example output:**
```
$ tick show tick-xyz
Error: Task 'tick-xyz' not found
```

---

## Dependencies

Prerequisites:

| Dependency | Why Blocked |
|------------|-------------|
| **core** | Needed first |

### Notes

- The plugin architecture can be designed in parallel
- Provider implementation requires understanding the format

---

## More Content

Final section with content.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/tick-core-pattern.md")

assert_contains "$content" "- name: project-fundamentals" "First of 8 sources converted"
assert_contains "$content" "- name: tui" "Last of 8 sources converted"
assert_contains "$content" "## Overview" "Overview preserved"
assert_contains "$content" '`tasks.jsonl`' "Inline code preserved"
assert_contains "$content" "| Field | Type | Required |" "Table preserved"
assert_contains "$content" 'tick create "Setup authentication"' "Code block with quotes preserved"
assert_contains "$content" "## Dependencies" "Dependencies after HR preserved"
assert_contains "$content" "## More Content" "Content after second HR preserved"
assert_contains "$content" "Final section with content." "Final paragraph preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Real-world pattern - legacy spec without frontmatter (should skip)${NC}"
setup_fixture
cat > "$SPEC_DIR/evvi-pattern.md" << 'TESTEOF'
# Specification: API Design

**Status**: Complete
**Last Updated**: 2026-01-17

---

## API Philosophy

Content here with **bold** and `code`.

---

## More Content

Final content.
TESTEOF

run_migration
content=$(cat "$SPEC_DIR/evvi-pattern.md")

# Should be unchanged (no frontmatter = skip)
assert_contains "$content" "# Specification: API Design" "Legacy H1 unchanged"
assert_contains "$content" "Status" "Legacy status line present"
assert_contains "$content" "## API Philosophy" "Body unchanged"
assert_contains "$content" "## More Content" "More content unchanged"

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
