#!/bin/bash
#
# Tests migration 019-status-rename.sh
# Validates renaming of work unit statuses: active → in-progress, archived → cancelled.
# Also validates auto-detection of completed pipelines → concluded.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/019-status-rename.sh"

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
# Helper functions
#

REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows" "$TEST_DIR/.claude"
    # Symlink .claude/skills → repo skills/ so the migration can find the manifest CLI
    mkdir -p "$TEST_DIR/.claude"
    ln -sfn "$REPO_DIR/skills" "$TEST_DIR/.claude/skills"
}

create_manifest() {
    local name="$1"
    local content="$2"
    mkdir -p "$TEST_DIR/.workflows/$name"
    echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

run_migration() {
    cd "$TEST_DIR"
    PROJECT_DIR="$TEST_DIR" bash "$MIGRATION_SCRIPT" 2>&1
}

get_status() {
    local name="$1"
    node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/$name/manifest.json"
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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: active → in-progress${NC}"
setup_fixture

create_manifest "my-feature" '{"work_type":"feature","status":"active","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "my-feature")" "in-progress" "Status changed to in-progress"
assert_contains "$output" "updated" "Reports update"
assert_contains "$output" "in-progress" "Reports new status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: archived → cancelled${NC}"
setup_fixture

create_manifest "old-feature" '{"work_type":"feature","status":"archived","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "old-feature")" "cancelled" "Status changed to cancelled"
assert_contains "$output" "updated" "Reports update"
assert_contains "$output" "cancelled" "Reports new status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: in-progress unchanged (already correct)${NC}"
setup_fixture

create_manifest "current" '{"work_type":"feature","status":"in-progress","phases":{}}'

output=$(run_migration)
status=$(get_status "current")

assert_equals "$status" "in-progress" "Status remains in-progress"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: concluded unchanged${NC}"
setup_fixture

create_manifest "done-feature" '{"work_type":"feature","status":"concluded","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "done-feature")" "concluded" "Status remains concluded"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: cancelled unchanged${NC}"
setup_fixture

create_manifest "dead-feature" '{"work_type":"feature","status":"cancelled","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "dead-feature")" "cancelled" "Status remains cancelled"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: feature with completed review → concluded${NC}"
setup_fixture

create_manifest "done-but-active" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "concluded"},
    "review": {"status": "completed"}
  }
}'

output=$(run_migration)

assert_equals "$(get_status "done-but-active")" "concluded" "Completed pipeline detected and set to concluded"
assert_contains "$output" "concluded" "Reports concluded status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: feature in-progress with completed review → concluded${NC}"
setup_fixture

create_manifest "done-in-progress" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "review": {"status": "completed"}
  }
}'

output=$(run_migration)

assert_equals "$(get_status "done-in-progress")" "concluded" "In-progress with completed review set to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: feature with incomplete review stays in-progress${NC}"
setup_fixture

create_manifest "mid-review" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "review": {"status": "in-progress"}
  }
}'

output=$(run_migration)

assert_equals "$(get_status "mid-review")" "in-progress" "Incomplete review stays in-progress (not concluded)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: feature with no review phase stays in-progress${NC}"
setup_fixture

create_manifest "no-review" '{
  "work_type": "feature",
  "status": "active",
  "phases": {
    "discussion": {"status": "concluded"}
  }
}'

output=$(run_migration)

assert_equals "$(get_status "no-review")" "in-progress" "No review phase stays in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic with all review items completed → concluded${NC}"
setup_fixture

create_manifest "done-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "review": {
      "items": {
        "topic-a": {"status": "completed"},
        "topic-b": {"status": "completed"}
      }
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_status "done-epic")" "concluded" "Epic with all review items completed set to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic with some review items incomplete stays in-progress${NC}"
setup_fixture

create_manifest "partial-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "review": {
      "items": {
        "topic-a": {"status": "completed"},
        "topic-b": {"status": "in-progress"}
      }
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_status "partial-epic")" "in-progress" "Epic with incomplete review items stays in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic with no review items stays in-progress${NC}"
setup_fixture

create_manifest "no-review-epic" '{
  "work_type": "epic",
  "status": "active",
  "phases": {
    "discussion": {
      "items": {
        "topic-a": {"status": "concluded"}
      }
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_status "no-review-epic")" "in-progress" "Epic with no review items stays in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: bugfix with completed review → concluded${NC}"
setup_fixture

create_manifest "fixed-bug" '{
  "work_type": "bugfix",
  "status": "active",
  "phases": {
    "review": {"status": "completed"}
  }
}'

output=$(run_migration)

assert_equals "$(get_status "fixed-bug")" "concluded" "Bugfix with completed review set to concluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple work units processed${NC}"
setup_fixture

create_manifest "feat-a" '{"work_type":"feature","status":"active","phases":{}}'
create_manifest "feat-b" '{"work_type":"feature","status":"archived","phases":{}}'
create_manifest "feat-c" '{"work_type":"feature","status":"in-progress","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "feat-a")" "in-progress" "First work unit: active → in-progress"
assert_equals "$(get_status "feat-b")" "cancelled" "Second work unit: archived → cancelled"
assert_equals "$(get_status "feat-c")" "in-progress" "Third work unit: in-progress unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"status":"active"}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"work_type":"feature","status":"active","phases":{}}'

output=$(run_migration)

assert_equals "$(get_status "real")" "in-progress" "Real work unit updated"
assert_equals "$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/.state/manifest.json")" "active" "Dot-dir manifest not touched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{"work_type":"feature","status":"active","phases":{}}'

run_migration > /dev/null
before=$(get_json "idem")
output=$(run_migration)
after=$(get_json "idem")

assert_equals "$after" "$before" "JSON unchanged after second run"
assert_not_contains "$output" "updated" "No update on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "updated" "No updates without .workflows dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: preserves other manifest fields${NC}"
setup_fixture

create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "active",
  "created": "2026-01-15",
  "description": "test feature",
  "phases": {
    "discussion": {"status": "concluded"}
  }
}'

run_migration > /dev/null

json=$(get_json "preserve")

assert_contains "$json" '"name": "preserve"' "Name preserved"
assert_contains "$json" '"work_type": "feature"' "Work type preserved"
assert_contains "$json" '"created": "2026-01-15"' "Created date preserved"
assert_contains "$json" '"description": "test feature"' "Description preserved"
assert_contains "$json" '"status": "concluded"' "Discussion phase status preserved"

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
