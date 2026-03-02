#!/bin/bash
#
# Tests migration 016-work-unit-restructure.sh
# Validates phase-first → work-unit-first directory restructuring.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/016-work-unit-restructure.sh"

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
# Mock migration helper functions
#

FILES_UPDATED=0
FILES_SKIPPED=0

report_update() {
    local file="$1"
    local description="$2"
    FILES_UPDATED=$((FILES_UPDATED + 1))
}

report_skip() {
    local file="$1"
    FILES_SKIPPED=$((FILES_SKIPPED + 1))
}

# No export needed — migration is sourced in the same shell

#
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows"
    rm -rf "$TEST_DIR/.claude"
    FILES_UPDATED=0
    FILES_SKIPPED=0
    # Link the manifest CLI so node can find it
    mkdir -p "$TEST_DIR/.claude/skills/workflow-manifest/scripts"
    cp "$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.js" \
       "$TEST_DIR/.claude/skills/workflow-manifest/scripts/manifest.js"
}

run_migration() {
    cd "$TEST_DIR"
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

    if echo "$content" | grep -q -- "$unexpected"; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Unexpectedly found: $unexpected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
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

assert_file_exists() {
    local filepath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$filepath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $filepath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_not_exists() {
    local filepath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -f "$filepath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File should not exist: $filepath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_exists() {
    local dirpath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -d "$dirpath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory not found: $dirpath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_not_exists() {
    local dirpath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -d "$dirpath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory should not exist: $dirpath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test 1: No .workflows directory — skip cleanly${NC}"
setup_fixture
# Don't create .workflows
run_migration

assert_equals "$FILES_UPDATED" "0" "No files updated"
assert_equals "$FILES_SKIPPED" "0" "No files skipped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 2: Single feature — artifacts grouped correctly${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/dark-mode"
mkdir -p "$TEST_DIR/.workflows/planning/dark-mode"

cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode

## Context

We need dark mode.
EOF

cat > "$TEST_DIR/.workflows/specification/dark-mode/specification.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
type: feature
review_cycle: 1
---

# Specification: Dark Mode

## Requirements

Dark mode everywhere.
EOF

cat > "$TEST_DIR/.workflows/planning/dark-mode/plan.md" << 'EOF'
---
topic: dark-mode
status: in-progress
work_type: feature
format: local-markdown
---

# Plan: Dark Mode

## Phases

Phase 1 here.
EOF

mkdir -p "$TEST_DIR/.workflows/planning/dark-mode/tasks"
echo "task 1" > "$TEST_DIR/.workflows/planning/dark-mode/tasks/task-1.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/dark-mode/manifest.json" "manifest.json created"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/discussion/discussion.md" "discussion moved and renamed"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/specification/specification.md" "specification moved"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/planning/planning.md" "plan.md renamed to planning.md"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/planning/tasks/task-1.md" "tasks directory moved"

# Verify manifest content
manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
assert_contains "$manifest" '"work_type": "feature"' "manifest has correct work_type"
assert_contains "$manifest" '"name": "dark-mode"' "manifest has correct name"
assert_contains "$manifest" '"status": "active"' "manifest has active status"

# Verify empty phase dirs cleaned up
assert_dir_not_exists "$TEST_DIR/.workflows/discussion" "discussion phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/specification" "specification phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/planning" "planning phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 3: Single bugfix — investigation path handled${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/investigation/login-timeout"

cat > "$TEST_DIR/.workflows/investigation/login-timeout/investigation.md" << 'EOF'
---
topic: login-timeout
status: concluded
work_type: bugfix
date: 2026-02-01
---

# Investigation: Login Timeout

## Root Cause

Session expiry.
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/login-timeout/manifest.json" "manifest.json created"
assert_file_exists "$TEST_DIR/.workflows/login-timeout/investigation/investigation.md" "investigation moved"

manifest=$(cat "$TEST_DIR/.workflows/login-timeout/manifest.json")
assert_contains "$manifest" '"work_type": "bugfix"' "manifest has bugfix work_type"
assert_contains "$manifest" '"investigation"' "manifest has investigation phase"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 4: Multiple features — each gets own work unit${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"

for topic in auth-flow dark-mode api-keys; do
    cat > "$TEST_DIR/.workflows/discussion/$topic.md" << EOF
---
topic: $topic
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: $topic
EOF
done

run_migration

assert_file_exists "$TEST_DIR/.workflows/auth-flow/manifest.json" "auth-flow manifest created"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/manifest.json" "dark-mode manifest created"
assert_file_exists "$TEST_DIR/.workflows/api-keys/manifest.json" "api-keys manifest created"

assert_file_exists "$TEST_DIR/.workflows/auth-flow/discussion/discussion.md" "auth-flow discussion moved"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/discussion/discussion.md" "dark-mode discussion moved"
assert_file_exists "$TEST_DIR/.workflows/api-keys/discussion/discussion.md" "api-keys discussion moved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 5: Greenfield with multiple discussions — creates v1 epic${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"

cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

cat > "$TEST_DIR/.workflows/discussion/refund-handling.md" << 'EOF'
---
topic: refund-handling
status: in-progress
work_type: greenfield
date: 2026-01-12
---

# Discussion: Refund Handling
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/manifest.json" "v1 epic manifest created"
assert_file_exists "$TEST_DIR/.workflows/v1/discussion/payment-processing.md" "epic discussion preserved name"
assert_file_exists "$TEST_DIR/.workflows/v1/discussion/refund-handling.md" "second epic discussion preserved"

manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
assert_contains "$manifest" '"work_type": "epic"' "greenfield mapped to epic"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 6: Mixed (features + bugfix + greenfield) — correct classification${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/investigation/crash-fix"

# Feature
cat > "$TEST_DIR/.workflows/discussion/notifications.md" << 'EOF'
---
topic: notifications
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: Notifications
EOF

# Greenfield (goes to v1 epic)
cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

# Bugfix
cat > "$TEST_DIR/.workflows/investigation/crash-fix/investigation.md" << 'EOF'
---
topic: crash-fix
status: in-progress
work_type: bugfix
date: 2026-02-01
---

# Investigation: Crash Fix
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/notifications/manifest.json" "feature work unit created"
assert_file_exists "$TEST_DIR/.workflows/v1/manifest.json" "epic work unit created"
assert_file_exists "$TEST_DIR/.workflows/crash-fix/manifest.json" "bugfix work unit created"

feat_manifest=$(cat "$TEST_DIR/.workflows/notifications/manifest.json")
epic_manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
bug_manifest=$(cat "$TEST_DIR/.workflows/crash-fix/manifest.json")

assert_contains "$feat_manifest" '"work_type": "feature"' "notifications is feature"
assert_contains "$epic_manifest" '"work_type": "epic"' "v1 is epic"
assert_contains "$bug_manifest" '"work_type": "bugfix"' "crash-fix is bugfix"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 7: Idempotency — running twice produces same result${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"

cat > "$TEST_DIR/.workflows/discussion/idempotent-test.md" << 'EOF'
---
topic: idempotent-test
status: concluded
work_type: feature
date: 2026-01-01
---

# Discussion: Idempotent Test
EOF

run_migration
first_manifest=$(cat "$TEST_DIR/.workflows/idempotent-test/manifest.json")
first_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/discussion.md")

# Reset counters and run again
FILES_UPDATED=0
FILES_SKIPPED=0
run_migration

second_manifest=$(cat "$TEST_DIR/.workflows/idempotent-test/manifest.json")
second_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/discussion.md")

assert_equals "$second_manifest" "$first_manifest" "Manifest unchanged on second run"
assert_equals "$second_discussion" "$first_discussion" "Discussion unchanged on second run"
# Second run exits early — no phase dirs remain, manifest exists
# Either skips at the early exit or report_skip runs in the loop
assert_equals "$FILES_UPDATED" "0" "No files updated on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 8: Frontmatter preserved intact in migrated artifacts${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"

cat > "$TEST_DIR/.workflows/discussion/preserved.md" << 'EOF'
---
topic: preserved
status: concluded
work_type: feature
date: 2026-03-01
research_source: exploration.md
---

# Discussion: Preserved

## Context

Content with special chars: "quotes", 'apostrophes', $variables.

---

## Section Two

More content.
EOF

run_migration

content=$(cat "$TEST_DIR/.workflows/preserved/discussion/discussion.md")
assert_contains "$content" "^---$" "Frontmatter delimiters preserved"
assert_contains "$content" "^topic: preserved$" "topic field preserved"
assert_contains "$content" "^status: concluded$" "status field preserved"
assert_contains "$content" "^work_type: feature$" "work_type field preserved"
assert_contains "$content" "Content with special chars" "Body content preserved"
assert_contains "$content" "## Section Two" "Sections after --- preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 10: Manifest contains expected fields from frontmatter${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/full-test"
mkdir -p "$TEST_DIR/.workflows/planning/full-test"
mkdir -p "$TEST_DIR/.workflows/planning/full-test/tasks"

cat > "$TEST_DIR/.workflows/discussion/full-test.md" << 'EOF'
---
topic: full-test
status: concluded
work_type: feature
date: 2026-02-15
research_source: exploration.md
---

# Discussion: Full Test
EOF

cat > "$TEST_DIR/.workflows/specification/full-test/specification.md" << 'EOF'
---
topic: full-test
status: concluded
work_type: feature
type: feature
review_cycle: 2
finding_gate_mode: auto
---

# Specification: Full Test
EOF

cat > "$TEST_DIR/.workflows/planning/full-test/plan.md" << 'EOF'
---
topic: full-test
status: in-progress
work_type: feature
format: local-markdown
task_gate_mode: gated
finding_gate_mode: gated
author_gate_mode: auto
---

# Plan: Full Test
EOF

run_migration

manifest=$(cat "$TEST_DIR/.workflows/full-test/manifest.json")

# Discussion fields
assert_contains "$manifest" '"status": "concluded"' "discussion status in manifest"
assert_contains "$manifest" '"research_source": "exploration.md"' "research_source in manifest"

# Specification fields
assert_contains "$manifest" '"type": "feature"' "spec type in manifest"
assert_contains "$manifest" '"review_cycle": 2' "review_cycle in manifest"

# Planning fields
assert_contains "$manifest" '"format": "local-markdown"' "plan format in manifest"
assert_contains "$manifest" '"task_gate_mode": "gated"' "task_gate_mode in manifest"
assert_contains "$manifest" '"author_gate_mode": "auto"' "author_gate_mode in manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 11: Empty phase directories cleaned up${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification"
mkdir -p "$TEST_DIR/.workflows/planning"

# Only one discussion, spec/plan dirs are empty
cat > "$TEST_DIR/.workflows/discussion/cleanup-test.md" << 'EOF'
---
topic: cleanup-test
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: Cleanup Test
EOF

run_migration

assert_dir_not_exists "$TEST_DIR/.workflows/discussion" "empty discussion dir removed"
assert_dir_not_exists "$TEST_DIR/.workflows/specification" "empty specification dir removed"
assert_dir_not_exists "$TEST_DIR/.workflows/planning" "empty planning dir removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 12: greenfield → epic mapping in manifest${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"

cat > "$TEST_DIR/.workflows/discussion/epic-mapping.md" << 'EOF'
---
topic: epic-mapping
status: in-progress
work_type: greenfield
date: 2026-01-01
---

# Discussion: Epic Mapping
EOF

run_migration

manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
assert_contains "$manifest" '"work_type": "epic"' "greenfield mapped to epic in manifest"
assert_not_contains "$manifest" '"greenfield"' "no greenfield reference in manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test 13: Implementation tracking.md → implementation.md rename${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/implementation/impl-rename"

cat > "$TEST_DIR/.workflows/discussion/impl-rename.md" << 'EOF'
---
topic: impl-rename
status: concluded
work_type: feature
date: 2026-01-01
---

# Discussion
EOF

cat > "$TEST_DIR/.workflows/implementation/impl-rename/tracking.md" << 'EOF'
---
topic: impl-rename
status: in-progress
work_type: feature
format: local-markdown
task_gate_mode: gated
fix_gate_mode: gated
---

# Implementation: Impl Rename

## Progress

Some progress here.
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/impl-rename/implementation/implementation.md" "tracking.md renamed to implementation.md"
assert_file_not_exists "$TEST_DIR/.workflows/impl-rename/implementation/tracking.md" "old tracking.md not present"

# Verify content preserved
content=$(cat "$TEST_DIR/.workflows/impl-rename/implementation/implementation.md")
assert_contains "$content" "Some progress here" "implementation content preserved"

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
