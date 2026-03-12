#!/bin/bash
#
# Tests migration 024-backfill-and-flatten-review.sh
# Validates:
#   Step 1: Backfill completed_tasks / completed_phases from frontmatter
#   Step 2: Normalise external IDs to internal IDs via plan table mapping
#   Step 3: Flatten review/{topic}/r{N}/ directories
#   Step 4: Rename ext_id → external_id in manifests and plan files
#   Step 5: Rename ID → Internal ID in plan index task table headers
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/024-backfill-and-flatten-review.sh"

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
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows"
}

create_manifest() {
    local name="$1"
    local content="$2"
    mkdir -p "$TEST_DIR/.workflows/$name"
    echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

create_implementation_file() {
    local wu="$1"
    local topic="$2"
    local content="$3"
    mkdir -p "$TEST_DIR/.workflows/$wu/implementation/$topic"
    printf '%s' "$content" > "$TEST_DIR/.workflows/$wu/implementation/$topic/implementation.md"
}

create_plan_file() {
    local wu="$1"
    local topic="$2"
    local content="$3"
    mkdir -p "$TEST_DIR/.workflows/$wu/planning/$topic"
    printf '%s' "$content" > "$TEST_DIR/.workflows/$wu/planning/$topic/planning.md"
}

create_review_file() {
    local wu="$1"
    local topic="$2"
    local subdir="$3"
    local filename="$4"
    local content="${5:-# review content}"
    mkdir -p "$TEST_DIR/.workflows/$wu/review/$topic/$subdir"
    echo "$content" > "$TEST_DIR/.workflows/$wu/review/$topic/$subdir/$filename"
}

# Stub report_update for migration script
export -f report_update 2>/dev/null || true
report_update() { echo "updated: $1 — $2"; }
export -f report_update
report_skip() { :; }
export -f report_skip

run_migration() {
    cd "$TEST_DIR"
    PROJECT_DIR="$TEST_DIR" bash "$MIGRATION_SCRIPT" 2>&1
}

get_field() {
    local name="$1"
    local field="$2"
    node -e "
      const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const parts = process.argv[2].split('.');
      let v = m;
      for (const p of parts) v = (v || {})[p];
      console.log(v === undefined ? 'undefined' : (typeof v === 'object' ? JSON.stringify(v) : v));
    " "$TEST_DIR/.workflows/$name/manifest.json" "$field"
}

get_json() {
    local name="$1"
    cat "$TEST_DIR/.workflows/$name/manifest.json"
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

    if echo "$content" | grep -qF -- "$expected"; then
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
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -qF -- "$expected"; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Should not find: $expected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
}

assert_file_exists() {
    local path="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$path" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_not_exists() {
    local path="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -f "$path" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File should not exist: $path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_not_exists() {
    local path="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -d "$path" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory should not exist: $path"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# STEP 1: Backfill completed_tasks / completed_phases
# ============================================================================

echo -e "${YELLOW}=== Step 1: Backfill from frontmatter ===${NC}"
echo ""

echo -e "${YELLOW}Test: backfills completed_tasks from inline YAML array${NC}"
setup_fixture

create_manifest "my-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
create_implementation_file "my-feat" "my-feat" '---
completed_tasks: [my-feat-1-1, my-feat-1-2, my-feat-2-1]
completed_phases: [1, 2]
---
# Implementation
'

run_migration > /dev/null

assert_equals "$(get_field "my-feat" "phases.implementation.completed_tasks")" '["my-feat-1-1","my-feat-1-2","my-feat-2-1"]' "completed_tasks backfilled from inline array"
assert_equals "$(get_field "my-feat" "phases.implementation.completed_phases")" '[1,2]' "completed_phases backfilled"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: backfills completed_tasks from multi-line YAML list${NC}"
setup_fixture

create_manifest "ml-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
create_implementation_file "ml-feat" "ml-feat" '---
completed_tasks:
  - ml-feat-1-1
  - ml-feat-1-2
  - ml-feat-2-1
completed_phases:
  - 1
  - 2
---
# Implementation
'

run_migration > /dev/null

assert_equals "$(get_field "ml-feat" "phases.implementation.completed_tasks")" '["ml-feat-1-1","ml-feat-1-2","ml-feat-2-1"]' "completed_tasks backfilled from multi-line list"
assert_equals "$(get_field "ml-feat" "phases.implementation.completed_phases")" '[1,2]' "completed_phases backfilled from multi-line list"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: does not overwrite existing completed_tasks${NC}"
setup_fixture

create_manifest "existing" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {
      "completed_tasks": ["existing-1-1"],
      "completed_phases": [1]
    }
  }
}'
create_implementation_file "existing" "existing" '---
completed_tasks: [existing-1-1, existing-1-2, existing-2-1]
completed_phases: [1, 2]
---
# Implementation
'

run_migration > /dev/null

assert_equals "$(get_field "existing" "phases.implementation.completed_tasks")" '["existing-1-1"]' "Existing completed_tasks not overwritten"
assert_equals "$(get_field "existing" "phases.implementation.completed_phases")" '[1]' "Existing completed_phases not overwritten"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: backfills epic items separately${NC}"
setup_fixture

create_manifest "my-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "implementation": {
      "items": {
        "auth": {},
        "billing": {}
      }
    }
  }
}'
create_implementation_file "my-epic" "auth" '---
completed_tasks: [auth-1-1, auth-1-2]
completed_phases: [1]
---
# Auth Implementation
'
create_implementation_file "my-epic" "billing" '---
completed_tasks: [billing-1-1]
completed_phases: [1]
---
# Billing Implementation
'

run_migration > /dev/null

assert_equals "$(get_field "my-epic" "phases.implementation.items.auth.completed_tasks")" '["auth-1-1","auth-1-2"]' "Epic auth item backfilled"
assert_equals "$(get_field "my-epic" "phases.implementation.items.auth.completed_phases")" '[1]' "Epic auth phases backfilled"
assert_equals "$(get_field "my-epic" "phases.implementation.items.billing.completed_tasks")" '["billing-1-1"]' "Epic billing item backfilled"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips work units with no implementation phase${NC}"
setup_fixture

create_manifest "no-impl" '{
  "work_type": "bugfix",
  "status": "in-progress",
  "phases": {
    "investigation": {"status": "in-progress"}
  }
}'

output=$(run_migration)

assert_not_contains "$output" "backfilled" "No backfill reported for work unit without implementation"

echo ""

# ============================================================================
# STEP 2: Normalise external IDs to internal IDs
# ============================================================================

echo -e "${YELLOW}=== Step 2: Normalise external IDs ===${NC}"
echo ""

echo -e "${YELLOW}Test: normalises tick IDs to internal IDs via plan table${NC}"
setup_fixture

create_manifest "tick-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
create_implementation_file "tick-feat" "tick-feat" '---
completed_tasks: [tick-abc123, tick-def456]
completed_phases: [1]
---
# Implementation
'
create_plan_file "tick-feat" "tick-feat" '# Plan: Tick Feat

### Phase 1: Core
status: approved
ext_id: tick-parent1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| tick-feat-1-1 | First Task | none | authored | tick-abc123 |
| tick-feat-1-2 | Second Task | none | authored | tick-def456 |
'

run_migration > /dev/null

assert_equals "$(get_field "tick-feat" "phases.implementation.completed_tasks")" '["tick-feat-1-1","tick-feat-1-2"]' "Tick IDs normalised to internal IDs"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: leaves internal IDs unchanged when no ext map match${NC}"
setup_fixture

create_manifest "internal-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
create_implementation_file "internal-feat" "internal-feat" '---
completed_tasks: [internal-feat-1-1, internal-feat-1-2]
completed_phases: [1]
---
# Implementation
'
create_plan_file "internal-feat" "internal-feat" '# Plan: Internal Feat

### Phase 1: Core
status: approved
ext_id:

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| internal-feat-1-1 | First Task | none | authored | |
| internal-feat-1-2 | Second Task | none | authored | |
'

run_migration > /dev/null

assert_equals "$(get_field "internal-feat" "phases.implementation.completed_tasks")" '["internal-feat-1-1","internal-feat-1-2"]' "Internal IDs left unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: normalises with already-renamed External ID column${NC}"
setup_fixture

create_manifest "renamed-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
create_implementation_file "renamed-feat" "renamed-feat" '---
completed_tasks: [tick-aaa, tick-bbb]
completed_phases: [1]
---
# Implementation
'
create_plan_file "renamed-feat" "renamed-feat" '# Plan: Renamed Feat

### Phase 1: Core
status: approved
external_id: tick-parent1

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| renamed-feat-1-1 | First Task | none | authored | tick-aaa |
| renamed-feat-1-2 | Second Task | none | authored | tick-bbb |
'

run_migration > /dev/null

assert_equals "$(get_field "renamed-feat" "phases.implementation.completed_tasks")" '["renamed-feat-1-1","renamed-feat-1-2"]' "Normalisation works with already-renamed columns"

echo ""

# ============================================================================
# STEP 3: Flatten review directories
# ============================================================================

echo -e "${YELLOW}=== Step 3: Flatten review directories ===${NC}"
echo ""

echo -e "${YELLOW}Test: flattens r1/ directory${NC}"
setup_fixture

create_manifest "single-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
create_review_file "single-review" "single-review" "r1" "review.md" "# Review v1"
create_review_file "single-review" "single-review" "r1" "qa-task-1.md" "# QA 1"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/single-review/review/single-review/review.md" "review.md moved up"
assert_file_exists "$TEST_DIR/.workflows/single-review/review/single-review/qa-task-1.md" "qa-task-1.md moved up"
assert_dir_not_exists "$TEST_DIR/.workflows/single-review/review/single-review/r1" "r1/ removed"
assert_contains "$output" "kept r1" "Reports keeping r1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: keeps highest r{N} when multiple exist${NC}"
setup_fixture

create_manifest "multi-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
create_review_file "multi-review" "multi-review" "r1" "review.md" "# Review v1"
create_review_file "multi-review" "multi-review" "r1" "qa-task-1.md" "# QA old"
create_review_file "multi-review" "multi-review" "r2" "review.md" "# Review v2"
create_review_file "multi-review" "multi-review" "r2" "qa-task-1.md" "# QA new"
create_review_file "multi-review" "multi-review" "r2" "qa-task-2.md" "# QA 2 new"

output=$(run_migration)

review_content=$(cat "$TEST_DIR/.workflows/multi-review/review/multi-review/review.md")
assert_equals "$review_content" "# Review v2" "Kept r2 content (not r1)"
assert_file_exists "$TEST_DIR/.workflows/multi-review/review/multi-review/qa-task-2.md" "r2 qa-task-2.md present"
assert_dir_not_exists "$TEST_DIR/.workflows/multi-review/review/multi-review/r1" "r1/ removed"
assert_dir_not_exists "$TEST_DIR/.workflows/multi-review/review/multi-review/r2" "r2/ removed"
assert_contains "$output" "kept r2" "Reports keeping r2"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips already-flat review directories${NC}"
setup_fixture

create_manifest "flat-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
mkdir -p "$TEST_DIR/.workflows/flat-review/review/flat-review"
echo "# Review" > "$TEST_DIR/.workflows/flat-review/review/flat-review/review.md"

output=$(run_migration)

assert_file_exists "$TEST_DIR/.workflows/flat-review/review/flat-review/review.md" "Flat review unchanged"
assert_not_contains "$output" "flattened" "No flattening reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: flattens epic review directories per topic${NC}"
setup_fixture

create_manifest "epic-review" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {"review": {"items": {"auth": {}, "billing": {}}}}
}'
create_review_file "epic-review" "auth" "r1" "review.md" "# Auth review"
create_review_file "epic-review" "auth" "r1" "qa-task-1.md" "# Auth QA"
create_review_file "epic-review" "billing" "r1" "review.md" "# Billing review"
create_review_file "epic-review" "billing" "r2" "review.md" "# Billing review v2"

run_migration > /dev/null

assert_file_exists "$TEST_DIR/.workflows/epic-review/review/auth/review.md" "Auth review flattened"
assert_dir_not_exists "$TEST_DIR/.workflows/epic-review/review/auth/r1" "Auth r1/ removed"
billing_content=$(cat "$TEST_DIR/.workflows/epic-review/review/billing/review.md")
assert_equals "$billing_content" "# Billing review v2" "Billing kept r2 content"
assert_dir_not_exists "$TEST_DIR/.workflows/epic-review/review/billing/r1" "Billing r1/ removed"
assert_dir_not_exists "$TEST_DIR/.workflows/epic-review/review/billing/r2" "Billing r2/ removed"

echo ""

# ============================================================================
# STEP 4: Rename ext_id → external_id
# ============================================================================

echo -e "${YELLOW}=== Step 4: Rename ext_id → external_id ===${NC}"
echo ""

echo -e "${YELLOW}Test: renames ext_id in manifest JSON${NC}"
setup_fixture

create_manifest "ext-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "ext_id": "tick-parent1",
      "status": "completed"
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "ext-feat" "phases.planning.external_id")" "tick-parent1" "ext_id renamed to external_id in manifest"
assert_equals "$(get_field "ext-feat" "phases.planning.ext_id")" "undefined" "Old ext_id removed"
assert_contains "$output" "renamed ext_id to external_id" "Reports manifest rename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: renames Ext ID in plan table headers and ext_id: in phase entries${NC}"
setup_fixture

create_manifest "plan-rename" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
create_plan_file "plan-rename" "plan-rename" '# Plan: Plan Rename

### Phase 1: Core
status: approved
ext_id: tick-parent1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| plan-rename-1-1 | First Task | none | authored | tick-abc |
'

run_migration > /dev/null

plan_content=$(cat "$TEST_DIR/.workflows/plan-rename/planning/plan-rename/planning.md")
assert_contains "$plan_content" "External ID" "Ext ID renamed to External ID in table header"
assert_not_contains "$plan_content" "Ext ID" "No Ext ID remaining"
assert_contains "$plan_content" "external_id:" "ext_id: renamed to external_id: in phase entry"
assert_not_contains "$plan_content" "ext_id:" "No ext_id: remaining"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips manifest already using external_id${NC}"
setup_fixture

create_manifest "already-renamed" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "external_id": "tick-parent1",
      "status": "completed"
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "already-renamed" "phases.planning.external_id")" "tick-parent1" "external_id preserved"
assert_not_contains "$output" "renamed ext_id" "No rename reported"

echo ""

# ============================================================================
# STEP 5: Rename ID → Internal ID in plan table headers
# ============================================================================

echo -e "${YELLOW}=== Step 5: Rename ID → Internal ID in plan tables ===${NC}"
echo ""

echo -e "${YELLOW}Test: renames | ID | to | Internal ID | in task table${NC}"
setup_fixture

create_manifest "id-rename" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
create_plan_file "id-rename" "id-rename" '# Plan: ID Rename

### Phase 1: Core
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| id-rename-1-1 | First Task | none | authored | |
'

output=$(run_migration)

plan_content=$(cat "$TEST_DIR/.workflows/id-rename/planning/id-rename/planning.md")
assert_contains "$plan_content" "| Internal ID |" "ID renamed to Internal ID in header"
assert_contains "$plan_content" "|-------------|" "Separator widened for Internal ID"
assert_not_contains "$plan_content" "| ID |" "No | ID | remaining"
assert_contains "$plan_content" "| id-rename-1-1 |" "Data rows unchanged"
assert_contains "$output" "renamed ID to Internal ID" "Reports table header rename"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips plan already using Internal ID${NC}"
setup_fixture

create_manifest "already-internal" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
create_plan_file "already-internal" "already-internal" '# Plan: Already Internal

### Phase 1: Core
status: approved
external_id:

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| already-internal-1-1 | First Task | none | authored | |
'

output=$(run_migration)

assert_not_contains "$output" "renamed ID to Internal ID" "No rename reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: renames across multiple phases in same plan${NC}"
setup_fixture

create_manifest "multi-phase" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
create_plan_file "multi-phase" "multi-phase" '# Plan: Multi Phase

### Phase 1: Foundation
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| multi-phase-1-1 | First | none | authored | |

### Phase 2: Features
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| multi-phase-2-1 | Second | none | authored | |
'

run_migration > /dev/null

plan_content=$(cat "$TEST_DIR/.workflows/multi-phase/planning/multi-phase/planning.md")
id_count=$(echo "$plan_content" | grep -c '| Internal ID |')
assert_equals "$id_count" "2" "Both phase tables renamed"
old_id_count=$(echo "$plan_content" | grep -c '| ID |' || true)
assert_equals "$old_id_count" "0" "No | ID | remaining"

echo ""

# ============================================================================
# CROSS-CUTTING CONCERNS
# ============================================================================

echo -e "${YELLOW}=== Cross-cutting ===${NC}"
echo ""

echo -e "${YELLOW}Test: all steps run together on same work unit${NC}"
setup_fixture

create_manifest "full-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "ext_id": "tick-plan1"
    },
    "implementation": {},
    "review": {}
  }
}'
create_implementation_file "full-feat" "full-feat" '---
completed_tasks: [tick-aaa, tick-bbb]
completed_phases: [1]
---
# Implementation
'
create_plan_file "full-feat" "full-feat" '# Plan: Full Feat

### Phase 1: Core
status: approved
ext_id: tick-phase1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| full-feat-1-1 | First | none | authored | tick-aaa |
| full-feat-1-2 | Second | none | authored | tick-bbb |
'
create_review_file "full-feat" "full-feat" "r1" "review.md" "# Old review"
create_review_file "full-feat" "full-feat" "r2" "review.md" "# New review"

run_migration > /dev/null

# Step 1+2: backfill + normalise
assert_equals "$(get_field "full-feat" "phases.implementation.completed_tasks")" '["full-feat-1-1","full-feat-1-2"]' "Backfilled and normalised"
assert_equals "$(get_field "full-feat" "phases.implementation.completed_phases")" '[1]' "Phases backfilled"

# Step 3: flatten
review_content=$(cat "$TEST_DIR/.workflows/full-feat/review/full-feat/review.md")
assert_equals "$review_content" "# New review" "Review flattened to r2"
assert_dir_not_exists "$TEST_DIR/.workflows/full-feat/review/full-feat/r1" "r1/ removed"
assert_dir_not_exists "$TEST_DIR/.workflows/full-feat/review/full-feat/r2" "r2/ removed"

# Step 4: ext_id rename
assert_equals "$(get_field "full-feat" "phases.planning.external_id")" "tick-plan1" "Manifest ext_id → external_id"
plan_content=$(cat "$TEST_DIR/.workflows/full-feat/planning/full-feat/planning.md")
assert_contains "$plan_content" "External ID" "Plan table: Ext ID → External ID"
assert_contains "$plan_content" "external_id:" "Plan phase: ext_id: → external_id:"

# Step 5: ID → Internal ID
assert_contains "$plan_content" "| Internal ID |" "Plan table: ID → Internal ID"
assert_not_contains "$plan_content" "| ID |" "No old | ID | remaining"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"phases":{"planning":{"ext_id":"old"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"work_type":"feature","status":"in-progress","phases":{"planning":{"ext_id":"tick-1"}}}'

run_migration > /dev/null

dot_extid=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).phases.planning.ext_id)" "$TEST_DIR/.workflows/.state/manifest.json")
assert_equals "$dot_extid" "old" "Dot-dir manifest not touched"
assert_equals "$(get_field "real" "phases.planning.external_id")" "tick-1" "Real manifest updated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {"ext_id": "tick-plan"},
    "implementation": {},
    "review": {}
  }
}'
create_implementation_file "idem" "idem" '---
completed_tasks: [tick-aaa]
completed_phases: [1]
---
# Implementation
'
create_plan_file "idem" "idem" '# Plan

### Phase 1: Core
status: approved
ext_id: tick-p1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| idem-1-1 | First | none | authored | tick-aaa |
'
create_review_file "idem" "idem" "r1" "review.md" "# Review"

run_migration > /dev/null
before_manifest=$(get_json "idem")
before_plan=$(cat "$TEST_DIR/.workflows/idem/planning/idem/planning.md")
output=$(run_migration)
after_manifest=$(get_json "idem")
after_plan=$(cat "$TEST_DIR/.workflows/idem/planning/idem/planning.md")

assert_equals "$after_manifest" "$before_manifest" "Manifest unchanged on second run"
assert_equals "$after_plan" "$before_plan" "Plan file unchanged on second run"
assert_not_contains "$output" "updated" "No updates on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "updated" "No updates without .workflows dir"

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
