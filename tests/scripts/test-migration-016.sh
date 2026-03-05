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
    FILES_UPDATED=0
    FILES_SKIPPED=0
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
assert_file_exists "$TEST_DIR/.workflows/dark-mode/discussion/dark-mode.md" "discussion moved as {name}.md"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/specification/dark-mode/specification.md" "specification in topic subdir"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/planning/dark-mode/planning.md" "plan.md renamed to planning.md in topic subdir"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/planning/dark-mode/tasks/task-1.md" "tasks directory in topic subdir"

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
assert_file_exists "$TEST_DIR/.workflows/login-timeout/investigation/login-timeout.md" "investigation moved as {name}.md"

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

assert_file_exists "$TEST_DIR/.workflows/auth-flow/discussion/auth-flow.md" "auth-flow discussion moved"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/discussion/dark-mode.md" "dark-mode discussion moved"
assert_file_exists "$TEST_DIR/.workflows/api-keys/discussion/api-keys.md" "api-keys discussion moved"

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
first_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/idempotent-test.md")

# Reset counters and run again
FILES_UPDATED=0
FILES_SKIPPED=0
run_migration

second_manifest=$(cat "$TEST_DIR/.workflows/idempotent-test/manifest.json")
second_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/idempotent-test.md")

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

content=$(cat "$TEST_DIR/.workflows/preserved/discussion/preserved.md")
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

assert_file_exists "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/implementation.md" "tracking.md renamed to implementation.md in topic subdir"
assert_file_not_exists "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/tracking.md" "old tracking.md not present"

# Verify content preserved
content=$(cat "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/implementation.md")
assert_contains "$content" "Some progress here" "implementation content preserved"

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Research with Discussion-ready marker → concluded status${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/research"

cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research: Exploration

Some research content here.

> **Discussion-ready**: The data model approach is well-understood. Key decisions around normalization are ready for discussion.

More content after the marker.
EOF

run_migration

research_status=$(node -e "var m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
assert_equals "$research_status" "concluded" "research with Discussion-ready marker gets concluded status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Research without Discussion-ready marker → in-progress status${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/research"

cat > "$TEST_DIR/.workflows/discussion/api-design.md" << 'EOF'
---
topic: api-design
status: in-progress
work_type: greenfield
date: 2026-01-08
---

# Discussion: API Design
EOF

cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research: Exploration

Some research content here. Still exploring options.
No discussion-ready marker in this file.
EOF

run_migration

research_status=$(node -e "var m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
assert_equals "$research_status" "concluded" "research concluded when later phases (discussion) exist"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Epic with spec/plan/impl/review — all phases migrated${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/payment-processing"
mkdir -p "$TEST_DIR/.workflows/planning/payment-processing/tasks"
mkdir -p "$TEST_DIR/.workflows/implementation/payment-processing"
mkdir -p "$TEST_DIR/.workflows/review/payment-processing/r1"

cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

cat > "$TEST_DIR/.workflows/specification/payment-processing/specification.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
type: feature
review_cycle: 1
finding_gate_mode: gated
---

# Specification: Payment Processing
EOF

cat > "$TEST_DIR/.workflows/planning/payment-processing/plan.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
format: local-markdown
task_gate_mode: gated
author_gate_mode: auto
---

# Plan: Payment Processing
EOF

echo "task content" > "$TEST_DIR/.workflows/planning/payment-processing/tasks/task-1.md"

cat > "$TEST_DIR/.workflows/implementation/payment-processing/tracking.md" << 'EOF'
---
topic: payment-processing
status: in-progress
work_type: greenfield
format: local-markdown
task_gate_mode: gated
fix_gate_mode: gated
analysis_cycle: 2
current_phase: phase-1
current_task: task-3
---

# Implementation: Payment Processing
EOF

echo "review content" > "$TEST_DIR/.workflows/review/payment-processing/r1/review.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/manifest.json" "v1 manifest created"
assert_file_exists "$TEST_DIR/.workflows/v1/discussion/payment-processing.md" "epic discussion moved"
assert_file_exists "$TEST_DIR/.workflows/v1/specification/payment-processing/specification.md" "epic spec moved to topic subdir"
assert_file_exists "$TEST_DIR/.workflows/v1/planning/payment-processing/planning.md" "epic plan.md renamed to planning.md"
assert_file_exists "$TEST_DIR/.workflows/v1/planning/payment-processing/tasks/task-1.md" "epic tasks dir moved"
assert_file_exists "$TEST_DIR/.workflows/v1/implementation/payment-processing/implementation.md" "epic tracking.md renamed to implementation.md"
assert_file_exists "$TEST_DIR/.workflows/v1/review/payment-processing/r1/review.md" "epic review moved"

# Verify manifest items structure
manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
assert_contains "$manifest" '"work_type": "epic"' "manifest has epic work_type"

# Spec items
spec_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var s=m.phases.specification; console.log(s && s.items && s.items['payment-processing'] ? s.items['payment-processing'].status : 'missing')")
assert_equals "$spec_status" "concluded" "manifest spec items has correct status"

spec_type=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var s=m.phases.specification; console.log(s && s.items && s.items['payment-processing'] ? s.items['payment-processing'].type : 'missing')")
assert_equals "$spec_type" "feature" "manifest spec items has type field"

# Plan items
plan_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var p=m.phases.planning; console.log(p && p.items && p.items['payment-processing'] ? p.items['payment-processing'].status : 'missing')")
assert_equals "$plan_status" "concluded" "manifest plan items has correct status"

plan_format=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var p=m.phases.planning; console.log(p && p.items && p.items['payment-processing'] ? p.items['payment-processing'].format : 'missing')")
assert_equals "$plan_format" "local-markdown" "manifest plan items has format field"

# Impl items
impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var i=m.phases.implementation; console.log(i && i.items && i.items['payment-processing'] ? i.items['payment-processing'].status : 'missing')")
assert_equals "$impl_status" "in-progress" "manifest impl items has correct status"

impl_cycle=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var i=m.phases.implementation; console.log(i && i.items && i.items['payment-processing'] ? i.items['payment-processing'].analysis_cycle : 'missing')")
assert_equals "$impl_cycle" "2" "manifest impl items has analysis_cycle field"

# Review items
review_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var r=m.phases.review; console.log(r && r.items && r.items['payment-processing'] ? r.items['payment-processing'].status : 'missing')")
assert_equals "$review_status" "completed" "manifest review items has completed status"

# Source dirs cleaned up
assert_dir_not_exists "$TEST_DIR/.workflows/discussion" "discussion phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/specification" "spec phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/planning" "planning phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/implementation" "impl phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/review" "review phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discussion-consolidation-analysis.md moved to v1/.state/${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/.state"

cat > "$TEST_DIR/.workflows/discussion/some-topic.md" << 'EOF'
---
topic: some-topic
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Some Topic
EOF

echo "consolidation analysis content" > "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/.state/discussion-consolidation-analysis.md" "discussion-consolidation-analysis.md moved to v1/.state/"
assert_file_not_exists "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md" "original state file removed"

# Verify content preserved
content=$(cat "$TEST_DIR/.workflows/v1/.state/discussion-consolidation-analysis.md")
assert_contains "$content" "consolidation analysis content" "state file content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Unmatched review topic routes to v1${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/review/doctor-installation-migration/r1"

# Epic discussion to trigger v1 creation
cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

# Review dir with no matching topic in other phases
echo "review findings" > "$TEST_DIR/.workflows/review/doctor-installation-migration/r1/review.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/review/doctor-installation-migration/r1/review.md" "unmatched review topic moved to v1"
assert_dir_not_exists "$TEST_DIR/.workflows/review" "review phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Mixed feature + epic with all phases${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/dark-mode"
mkdir -p "$TEST_DIR/.workflows/specification/payment-processing"
mkdir -p "$TEST_DIR/.workflows/planning/payment-processing/tasks"

# Feature
cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode
EOF

cat > "$TEST_DIR/.workflows/specification/dark-mode/specification.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
type: feature
---

# Specification: Dark Mode
EOF

# Epic
cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

cat > "$TEST_DIR/.workflows/specification/payment-processing/specification.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
type: feature
---

# Specification: Payment Processing
EOF

cat > "$TEST_DIR/.workflows/planning/payment-processing/plan.md" << 'EOF'
---
topic: payment-processing
status: in-progress
work_type: greenfield
format: local-markdown
---

# Plan: Payment Processing
EOF

echo "task content" > "$TEST_DIR/.workflows/planning/payment-processing/tasks/task-1.md"

run_migration

# Feature goes to its own work unit
assert_file_exists "$TEST_DIR/.workflows/dark-mode/manifest.json" "feature manifest created"
assert_file_exists "$TEST_DIR/.workflows/dark-mode/specification/dark-mode/specification.md" "feature spec in own work unit"

# Epic goes to v1
assert_file_exists "$TEST_DIR/.workflows/v1/manifest.json" "v1 epic manifest created"
assert_file_exists "$TEST_DIR/.workflows/v1/specification/payment-processing/specification.md" "epic spec in v1"
assert_file_exists "$TEST_DIR/.workflows/v1/planning/payment-processing/planning.md" "epic plan in v1 (renamed)"
assert_file_exists "$TEST_DIR/.workflows/v1/planning/payment-processing/tasks/task-1.md" "epic tasks in v1"

# Manifests correct
feat_manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
epic_manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
assert_contains "$feat_manifest" '"work_type": "feature"' "dark-mode is feature"
assert_contains "$epic_manifest" '"work_type": "epic"' "v1 is epic"

# Source phase dirs cleaned up
assert_dir_not_exists "$TEST_DIR/.workflows/discussion" "discussion phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/specification" "spec phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/planning" "planning phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Epic with multiple topics across phases${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/auth-flow"
mkdir -p "$TEST_DIR/.workflows/specification/billing"
mkdir -p "$TEST_DIR/.workflows/planning/auth-flow/tasks"
mkdir -p "$TEST_DIR/.workflows/implementation/auth-flow"

# Two epic discussions
cat > "$TEST_DIR/.workflows/discussion/auth-flow.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Auth Flow
EOF

cat > "$TEST_DIR/.workflows/discussion/billing.md" << 'EOF'
---
topic: billing
status: in-progress
work_type: greenfield
date: 2026-01-12
---

# Discussion: Billing
EOF

# Both have specs
cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
type: feature
review_cycle: 2
---

# Specification: Auth Flow
EOF

cat > "$TEST_DIR/.workflows/specification/billing/specification.md" << 'EOF'
---
topic: billing
status: in-progress
work_type: greenfield
type: feature
---

# Specification: Billing
EOF

# Only auth-flow has plan + impl
cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
format: local-markdown
---

# Plan: Auth Flow
EOF

echo "task content" > "$TEST_DIR/.workflows/planning/auth-flow/tasks/task-1.md"

cat > "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" << 'EOF'
---
topic: auth-flow
status: in-progress
work_type: greenfield
format: local-markdown
current_phase: phase-1
---

# Implementation: Auth Flow
EOF

run_migration

# Both specs moved to v1
assert_file_exists "$TEST_DIR/.workflows/v1/specification/auth-flow/specification.md" "auth-flow spec in v1"
assert_file_exists "$TEST_DIR/.workflows/v1/specification/billing/specification.md" "billing spec in v1"

# Only auth-flow has plan+impl
assert_file_exists "$TEST_DIR/.workflows/v1/planning/auth-flow/planning.md" "auth-flow plan renamed in v1"
assert_file_exists "$TEST_DIR/.workflows/v1/planning/auth-flow/tasks/task-1.md" "auth-flow tasks in v1"
assert_file_exists "$TEST_DIR/.workflows/v1/implementation/auth-flow/implementation.md" "auth-flow impl renamed in v1"

# Manifest has items for both spec topics but only auth-flow in plan/impl
manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
auth_spec=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification && m.phases.specification.items && m.phases.specification.items['auth-flow'] ? m.phases.specification.items['auth-flow'].status : 'missing')")
billing_spec=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification && m.phases.specification.items && m.phases.specification.items['billing'] ? m.phases.specification.items['billing'].status : 'missing')")
auth_plan=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning && m.phases.planning.items && m.phases.planning.items['auth-flow'] ? m.phases.planning.items['auth-flow'].status : 'missing')")
billing_plan=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning && m.phases.planning.items ? (m.phases.planning.items['billing'] ? 'found' : 'absent') : 'no-items')")

assert_equals "$auth_spec" "concluded" "manifest spec items: auth-flow concluded"
assert_equals "$billing_spec" "in-progress" "manifest spec items: billing in-progress"
assert_equals "$auth_plan" "concluded" "manifest plan items: auth-flow concluded"
assert_equals "$billing_plan" "absent" "manifest plan items: billing absent (no plan)"

# Source dirs cleaned up
assert_dir_not_exists "$TEST_DIR/.workflows/specification" "spec phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/planning" "planning phase dir cleaned up"
assert_dir_not_exists "$TEST_DIR/.workflows/implementation" "impl phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Feature with review — manifest has review phase${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/review/dark-mode/r1"

cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode
EOF

echo "review findings" > "$TEST_DIR/.workflows/review/dark-mode/r1/review.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/dark-mode/review/dark-mode/r1/review.md" "feature review moved"

manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
assert_contains "$manifest" '"review"' "manifest has review phase"
assert_contains "$manifest" '"status": "completed"' "manifest review status is completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: research-analysis.md moves to v1/.state/ (regression)${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/.state"

cat > "$TEST_DIR/.workflows/discussion/some-topic.md" << 'EOF'
---
topic: some-topic
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Some Topic
EOF

echo "research analysis content" > "$TEST_DIR/.workflows/.state/research-analysis.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/.state/research-analysis.md" "research-analysis.md moved to v1/.state/"
assert_file_not_exists "$TEST_DIR/.workflows/.state/research-analysis.md" "original research-analysis.md removed"

content=$(cat "$TEST_DIR/.workflows/v1/.state/research-analysis.md")
assert_contains "$content" "research analysis content" "research-analysis.md content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Review-only triggers v1 (no discussion needed)${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/review/orphan-topic/r1"

echo "review findings" > "$TEST_DIR/.workflows/review/orphan-topic/r1/review.md"

run_migration

assert_file_exists "$TEST_DIR/.workflows/v1/manifest.json" "v1 created from review-only"
assert_file_exists "$TEST_DIR/.workflows/v1/review/orphan-topic/r1/review.md" "review-only topic moved to v1"

manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
assert_contains "$manifest" '"work_type": "epic"' "v1 is epic"

review_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var r=m.phases.review; console.log(r && r.items && r.items['orphan-topic'] ? r.items['orphan-topic'].status : 'missing')")
assert_equals "$review_status" "completed" "review-only topic in manifest items"

assert_dir_not_exists "$TEST_DIR/.workflows/review" "review phase dir cleaned up"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Implementation without work_type falls back to prior registration${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/auth-flow"
mkdir -p "$TEST_DIR/.workflows/planning/auth-flow"
mkdir -p "$TEST_DIR/.workflows/implementation/auth-flow"

cat > "$TEST_DIR/.workflows/discussion/auth-flow.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Auth Flow
EOF

cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
type: feature
---

# Specification: Auth Flow
EOF

cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
format: tick
ext_id: tick-abc123
---

# Plan: Auth Flow
EOF

# Implementation has frontmatter but NO work_type (the gap 013-015 missed)
cat > "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" << 'EOF'
---
topic: auth-flow
status: completed
format: tick
task_gate_mode: auto
fix_gate_mode: gated
fix_attempts: 0
analysis_cycle: 2
current_phase: 3
current_task: ~
---

# Implementation: Auth Flow
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/auth-flow/manifest.json" "manifest created"
assert_file_exists "$TEST_DIR/.workflows/auth-flow/implementation/auth-flow/implementation.md" "implementation moved to feature work unit"
assert_file_not_exists "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" "old implementation file removed"

manifest=$(cat "$TEST_DIR/.workflows/auth-flow/manifest.json")
assert_contains "$manifest" '"work_type": "feature"' "work unit is feature"

impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/auth-flow/manifest.json','utf8')); console.log(m.phases.implementation ? m.phases.implementation.status : 'missing')")
assert_equals "$impl_status" "completed" "implementation status in manifest"

# Verify no v1 epic was created (all artifacts belong to the feature)
assert_file_not_exists "$TEST_DIR/.workflows/v1/manifest.json" "no v1 epic created"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Implementation without work_type — bugfix falls back correctly${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/investigation/fix-crash"
mkdir -p "$TEST_DIR/.workflows/specification/fix-crash"
mkdir -p "$TEST_DIR/.workflows/planning/fix-crash"
mkdir -p "$TEST_DIR/.workflows/implementation/fix-crash"

cat > "$TEST_DIR/.workflows/investigation/fix-crash/investigation.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
---

# Investigation: Fix Crash
EOF

cat > "$TEST_DIR/.workflows/specification/fix-crash/specification.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
type: feature
---

# Specification: Fix Crash
EOF

cat > "$TEST_DIR/.workflows/planning/fix-crash/plan.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
format: local-markdown
---

# Plan: Fix Crash
EOF

# No work_type in implementation
cat > "$TEST_DIR/.workflows/implementation/fix-crash/tracking.md" << 'EOF'
---
topic: fix-crash
status: completed
format: local-markdown
task_gate_mode: auto
---

# Implementation: Fix Crash
EOF

run_migration

assert_file_exists "$TEST_DIR/.workflows/fix-crash/implementation/fix-crash/implementation.md" "bugfix implementation moved to own work unit"

manifest=$(cat "$TEST_DIR/.workflows/fix-crash/manifest.json")
assert_contains "$manifest" '"work_type": "bugfix"' "work unit is bugfix"

impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/fix-crash/manifest.json','utf8')); console.log(m.phases.implementation ? m.phases.implementation.status : 'missing')")
assert_equals "$impl_status" "completed" "implementation status in bugfix manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Non-standard status values are normalized${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/widget"
mkdir -p "$TEST_DIR/.workflows/planning/widget"

cat > "$TEST_DIR/.workflows/discussion/widget.md" << 'EOF'
---
topic: widget
status: concluded
work_type: feature
---

# Discussion: Widget
EOF

cat > "$TEST_DIR/.workflows/specification/widget/specification.md" << 'EOF'
---
topic: widget
status: concluded
work_type: feature
type: feature
---

# Specification: Widget
EOF

# Non-standard status: "planning" instead of "in-progress"
cat > "$TEST_DIR/.workflows/planning/widget/plan.md" << 'EOF'
---
topic: widget
status: planning
work_type: feature
format: tick
---

# Plan: Widget
EOF

run_migration

plan_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/widget/manifest.json','utf8')); console.log(m.phases.planning.status)")
assert_equals "$plan_status" "in-progress" "non-standard 'planning' status normalized to 'in-progress'"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Status normalization — completed/concluded crossover${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/crossover"

cat > "$TEST_DIR/.workflows/discussion/crossover.md" << 'EOF'
---
topic: crossover
status: completed
work_type: feature
---

# Discussion: Crossover
EOF

cat > "$TEST_DIR/.workflows/specification/crossover/specification.md" << 'EOF'
---
topic: crossover
status: completed
work_type: feature
type: feature
---

# Specification: Crossover
EOF

run_migration

disc_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/crossover/manifest.json','utf8')); console.log(m.phases.discussion.status)")
assert_equals "$disc_status" "concluded" "discussion 'completed' normalized to 'concluded'"

spec_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/crossover/manifest.json','utf8')); console.log(m.phases.specification.status)")
assert_equals "$spec_status" "concluded" "specification 'completed' normalized to 'concluded'"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Research status inferred from later phases${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/research"

# Research with no Discussion-ready marker
cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research Exploration

Some research content without any Discussion-ready marker.
EOF

# Greenfield discussion exists — proves research was concluded
cat > "$TEST_DIR/.workflows/discussion/topic-a.md" << 'EOF'
---
topic: topic-a
status: concluded
work_type: greenfield
---

# Discussion: Topic A
EOF

run_migration

research_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
assert_equals "$research_status" "concluded" "research concluded when later phases exist"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Research status stays in-progress when no later phases${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/research"

# Research only — no other phases, no Discussion-ready marker
cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research Exploration

Early research, nothing else exists yet.
EOF

# Need a greenfield discussion to trigger v1 epic creation... but we want ONLY research.
# Research without any other phase and without a marker: the file is greenfield (no work_type),
# so it triggers V1_EPIC_NEEDED. The v1 manifest should have only research, in-progress.
run_migration

# v1 should exist with research only
research_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
assert_equals "$research_status" "in-progress" "research stays in-progress when no later phases"

# No other phases should exist
phase_count=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(Object.keys(m.phases).length)")
assert_equals "$phase_count" "1" "only research phase in manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Specification path references updated for new directory depth${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/my-feature"
mkdir -p "$TEST_DIR/.workflows/planning/my-feature"

cat > "$TEST_DIR/.workflows/discussion/my-feature.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
---

# Discussion: My Feature
EOF

cat > "$TEST_DIR/.workflows/specification/my-feature/specification.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
type: feature
---

# Specification: My Feature
EOF

cat > "$TEST_DIR/.workflows/planning/my-feature/plan.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
format: local-markdown
specification: ../specification/my-feature/specification.md
spec_commit: abc123
---

# Plan: My Feature
EOF

run_migration

spec_ref=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/my-feature/manifest.json','utf8')); console.log(m.phases.planning.specification)")
assert_equals "$spec_ref" "../../specification/my-feature/specification.md" "spec path gets extra ../ for new directory depth"

# Verify the path actually resolves
resolved="$TEST_DIR/.workflows/my-feature/planning/my-feature/$spec_ref"
assert_file_exists "$(cd "$(dirname "$resolved")" && pwd)/$(basename "$resolved")" "spec path resolves to actual file"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Epic spec path references also updated${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/billing"
mkdir -p "$TEST_DIR/.workflows/planning/billing"

cat > "$TEST_DIR/.workflows/discussion/billing.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
---

# Discussion: Billing
EOF

cat > "$TEST_DIR/.workflows/specification/billing/specification.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
type: feature
---

# Specification: Billing
EOF

cat > "$TEST_DIR/.workflows/planning/billing/plan.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
format: tick
ext_id: tick-abc
specification: ../specification/billing/specification.md
spec_commit: def456
---

# Plan: Billing
EOF

run_migration

epic_spec_ref=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning.items.billing.specification)")
assert_equals "$epic_spec_ref" "../../specification/billing/specification.md" "epic spec path gets extra ../"

# ============================================================================
echo -e "${YELLOW}TEST: Superseded specification status preserved${NC}"
# ============================================================================

setup_fixture

mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/specification/payments"
mkdir -p "$TEST_DIR/.workflows/specification/payments-v2"

cat > "$TEST_DIR/.workflows/discussion/payments.md" << 'EOF'
---
topic: payments
status: concluded
work_type: greenfield
---

# Discussion: Payments
EOF

cat > "$TEST_DIR/.workflows/specification/payments/specification.md" << 'EOF'
---
topic: payments
status: superseded
superseded_by: payments-v2
type: feature
work_type: greenfield
---

# Specification: Payments (superseded)
EOF

cat > "$TEST_DIR/.workflows/specification/payments-v2/specification.md" << 'EOF'
---
topic: payments-v2
status: concluded
type: feature
work_type: greenfield
---

# Specification: Payments v2
EOF

run_migration

superseded_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification.items.payments.status)")
assert_equals "$superseded_status" "superseded" "superseded spec status preserved"

v2_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification.items['payments-v2'].status)")
assert_equals "$v2_status" "concluded" "non-superseded spec status preserved"

# ============================================================================
echo -e "${YELLOW}TEST: Research subdirectories migrated to v1 epic${NC}"
# ============================================================================

setup_fixture

mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/research/sync-engine"
mkdir -p "$TEST_DIR/.workflows/research/multi-tenancy"

cat > "$TEST_DIR/.workflows/discussion/core.md" << 'EOF'
---
topic: core
status: concluded
work_type: greenfield
---

# Discussion: Core
EOF

cat > "$TEST_DIR/.workflows/research/overview.md" << 'EOF'
---
topic: overview
---

# Research overview
EOF

echo "# Sync architecture" > "$TEST_DIR/.workflows/research/sync-engine/architecture.md"
echo "# Sync API design" > "$TEST_DIR/.workflows/research/sync-engine/api-design.md"
echo "# MT overview" > "$TEST_DIR/.workflows/research/multi-tenancy/overview.md"

run_migration

assert_equals "$([ -d "$TEST_DIR/.workflows/v1/research/sync-engine" ] && echo yes)" "yes" "research subdir sync-engine migrated"
assert_equals "$([ -f "$TEST_DIR/.workflows/v1/research/sync-engine/architecture.md" ] && echo yes)" "yes" "research subdir file migrated"
assert_equals "$([ -d "$TEST_DIR/.workflows/v1/research/multi-tenancy" ] && echo yes)" "yes" "research subdir multi-tenancy migrated"
assert_equals "$([ -f "$TEST_DIR/.workflows/v1/research/overview.md" ] && echo yes)" "yes" "flat research file also migrated"
assert_equals "$([ -d "$TEST_DIR/.workflows/research" ] && echo yes || echo no)" "no" "old research dir removed"

echo ""

# ============================================================================
echo -e "${YELLOW}TEST: .gitkeep-only directories treated as empty${NC}"
# ============================================================================

setup_fixture

mkdir -p "$TEST_DIR/.workflows/discussion"
mkdir -p "$TEST_DIR/.workflows/planning"

cat > "$TEST_DIR/.workflows/discussion/widget.md" << 'EOF'
---
topic: widget
status: concluded
work_type: greenfield
---

# Discussion: Widget
EOF

touch "$TEST_DIR/.workflows/planning/.gitkeep"

run_migration

assert_equals "$([ -d "$TEST_DIR/.workflows/planning" ] && echo yes || echo no)" "no" ".gitkeep-only planning dir removed"
assert_equals "$([ -d "$TEST_DIR/.workflows/v1/discussion" ] && echo yes)" "yes" "discussion still migrated correctly"

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
