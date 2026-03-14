#!/bin/bash
#
# Tests migration 020-normalise-terminal-status.sh
# Validates concluded → completed for phase statuses and work unit status.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/020-normalise-terminal-status.sh"

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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: work unit status concluded → completed${NC}"
setup_fixture

create_manifest "done-feat" '{"work_type":"feature","status":"concluded","phases":{}}'

output=$(run_migration)

assert_equals "$(get_field "done-feat" "status")" "completed" "Work unit status changed to completed"
assert_contains "$output" "updated" "Reports update"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: in-progress work unit unchanged${NC}"
setup_fixture

create_manifest "active-feat" '{"work_type":"feature","status":"in-progress","phases":{}}'

output=$(run_migration)

assert_equals "$(get_field "active-feat" "status")" "in-progress" "Status remains in-progress"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: cancelled work unit unchanged${NC}"
setup_fixture

create_manifest "dead-feat" '{"work_type":"feature","status":"cancelled","phases":{}}'

output=$(run_migration)

assert_equals "$(get_field "dead-feat" "status")" "cancelled" "Status remains cancelled"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: completed work unit unchanged${NC}"
setup_fixture

create_manifest "already-done" '{"work_type":"feature","status":"completed","phases":{}}'

output=$(run_migration)

assert_equals "$(get_field "already-done" "status")" "completed" "Status remains completed"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: flat phase statuses concluded → completed${NC}"
setup_fixture

create_manifest "phases-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {"status": "concluded"},
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "completed"},
    "review": {"status": "in-progress"}
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "phases-feat" "phases.research.status")" "completed" "Research status → completed"
assert_equals "$(get_field "phases-feat" "phases.discussion.status")" "completed" "Discussion status → completed"
assert_equals "$(get_field "phases-feat" "phases.specification.status")" "completed" "Specification status → completed"
assert_equals "$(get_field "phases-feat" "phases.planning.status")" "completed" "Planning status → completed"
assert_equals "$(get_field "phases-feat" "phases.implementation.status")" "completed" "Implementation status unchanged"
assert_equals "$(get_field "phases-feat" "phases.review.status")" "in-progress" "Review in-progress unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: in-progress phase statuses unchanged${NC}"
setup_fixture

create_manifest "ip-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "discussion": {"status": "in-progress"}
  }
}'

output=$(run_migration)

assert_equals "$(get_field "ip-feat" "phases.discussion.status")" "in-progress" "In-progress stays in-progress"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: superseded specification unchanged${NC}"
setup_fixture

create_manifest "super-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "specification": {"status": "superseded"}
  }
}'

output=$(run_migration)

assert_equals "$(get_field "super-feat" "phases.specification.status")" "superseded" "Superseded stays superseded"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic item-level statuses concluded → completed${NC}"
setup_fixture

create_manifest "my-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "auth": {"status": "concluded"},
        "billing": {"status": "in-progress"}
      }
    },
    "specification": {
      "items": {
        "auth": {"status": "concluded"}
      }
    },
    "planning": {
      "items": {
        "auth": {"status": "concluded"}
      }
    },
    "implementation": {
      "items": {
        "auth": {"status": "completed"}
      }
    }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "my-epic" "phases.discussion.items.auth.status")" "completed" "Epic discussion item → completed"
assert_equals "$(get_field "my-epic" "phases.discussion.items.billing.status")" "in-progress" "In-progress item unchanged"
assert_equals "$(get_field "my-epic" "phases.specification.items.auth.status")" "completed" "Epic spec item → completed"
assert_equals "$(get_field "my-epic" "phases.planning.items.auth.status")" "completed" "Epic planning item → completed"
assert_equals "$(get_field "my-epic" "phases.implementation.items.auth.status")" "completed" "Implementation item unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: bugfix phases concluded → completed${NC}"
setup_fixture

create_manifest "my-bug" '{
  "work_type": "bugfix",
  "status": "concluded",
  "phases": {
    "investigation": {"status": "concluded"},
    "specification": {"status": "concluded"},
    "planning": {"status": "concluded"},
    "implementation": {"status": "completed"},
    "review": {"status": "completed"}
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "my-bug" "status")" "completed" "Bugfix work unit status → completed"
assert_equals "$(get_field "my-bug" "phases.investigation.status")" "completed" "Investigation → completed"
assert_equals "$(get_field "my-bug" "phases.specification.status")" "completed" "Specification → completed"
assert_equals "$(get_field "my-bug" "phases.planning.status")" "completed" "Planning → completed"
assert_equals "$(get_field "my-bug" "phases.implementation.status")" "completed" "Implementation unchanged"
assert_equals "$(get_field "my-bug" "phases.review.status")" "completed" "Review unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"status":"concluded"}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"work_type":"feature","status":"concluded","phases":{}}'

run_migration > /dev/null

assert_equals "$(get_field "real" "status")" "completed" "Real work unit updated"
dot_status=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$TEST_DIR/.workflows/.state/manifest.json")
assert_equals "$dot_status" "concluded" "Dot-dir manifest not touched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{
  "work_type": "feature",
  "status": "concluded",
  "phases": {
    "discussion": {"status": "concluded"},
    "specification": {"status": "concluded"}
  }
}'

run_migration > /dev/null
before=$(get_json "idem")
output=$(run_migration)
after=$(get_json "idem")

assert_equals "$after" "$before" "JSON unchanged after second run"
assert_not_contains "$output" "updated" "No update on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: preserves other manifest fields${NC}"
setup_fixture

create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "concluded",
  "created": "2026-01-15",
  "description": "test feature",
  "phases": {
    "discussion": {"status": "concluded", "analysis_cache": {"checksum": "abc123"}}
  }
}'

run_migration > /dev/null

json=$(get_json "preserve")

assert_contains "$json" '"name": "preserve"' "Name preserved"
assert_contains "$json" '"work_type": "feature"' "Work type preserved"
assert_contains "$json" '"created": "2026-01-15"' "Created date preserved"
assert_contains "$json" '"description": "test feature"' "Description preserved"
assert_contains "$json" '"checksum": "abc123"' "Analysis cache preserved"
assert_equals "$(get_field "preserve" "phases.discussion.status")" "completed" "Phase status updated"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "updated" "No updates without .workflows dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple work units processed${NC}"
setup_fixture

create_manifest "feat-a" '{"work_type":"feature","status":"concluded","phases":{"discussion":{"status":"concluded"}}}'
create_manifest "feat-b" '{"work_type":"feature","status":"in-progress","phases":{"discussion":{"status":"concluded"}}}'
create_manifest "feat-c" '{"work_type":"feature","status":"cancelled","phases":{}}'

run_migration > /dev/null

assert_equals "$(get_field "feat-a" "status")" "completed" "First: work unit concluded → completed"
assert_equals "$(get_field "feat-a" "phases.discussion.status")" "completed" "First: phase concluded → completed"
assert_equals "$(get_field "feat-b" "status")" "in-progress" "Second: in-progress unchanged"
assert_equals "$(get_field "feat-b" "phases.discussion.status")" "completed" "Second: phase concluded → completed"
assert_equals "$(get_field "feat-c" "status")" "cancelled" "Third: cancelled unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: mixed epic with concluded and completed items${NC}"
setup_fixture

create_manifest "mixed-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "auth": {"status": "concluded"},
        "billing": {"status": "concluded"}
      }
    },
    "implementation": {
      "items": {
        "auth": {"status": "completed"}
      }
    },
    "review": {
      "items": {
        "auth": {"status": "completed"}
      }
    }
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "mixed-epic" "phases.discussion.items.auth.status")" "completed" "Discussion auth → completed"
assert_equals "$(get_field "mixed-epic" "phases.discussion.items.billing.status")" "completed" "Discussion billing → completed"
assert_equals "$(get_field "mixed-epic" "phases.implementation.items.auth.status")" "completed" "Impl auth unchanged"
assert_equals "$(get_field "mixed-epic" "phases.review.items.auth.status")" "completed" "Review auth unchanged"

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
