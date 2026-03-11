#!/bin/bash
#
# Tests migration 023-clear-research-analysis-cache.sh
# Validates removal of old-format analysis caches and manifest cleanup.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/023-clear-research-analysis-cache.sh"

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

create_state_file() {
    local name="$1"
    local content="$2"
    mkdir -p "$TEST_DIR/.workflows/$name/.state"
    echo "$content" > "$TEST_DIR/.workflows/$name/.state/research-analysis.md"
}

# Stub report_update for migration script
export -f report_update 2>/dev/null || true
report_update() { echo "updated: $1 — $2"; }
export -f report_update

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

echo -e "${YELLOW}Test: deletes .state/research-analysis.md${NC}"
setup_fixture

create_manifest "my-feat" '{"work_type":"feature","status":"in-progress","phases":{"research":{}}}'
create_state_file "my-feat" "# Research Analysis Cache\n\n## Topics\n\n### Theme\n- old format"

output=$(run_migration)

assert_file_not_exists "$TEST_DIR/.workflows/my-feat/.state/research-analysis.md" "State file deleted"
assert_contains "$output" "removed old-format research analysis cache" "Reports file removal"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: clears analysis_cache from manifest${NC}"
setup_fixture

create_manifest "cached-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {
        "checksum": "abc123",
        "generated": "2026-01-15T10:00:00Z",
        "files": ["intro.md", "deep-dive.md"]
      }
    }
  }
}'

output=$(run_migration)

assert_equals "$(get_field "cached-feat" "phases.research.analysis_cache")" "undefined" "analysis_cache removed from manifest"
assert_equals "$(get_field "cached-feat" "phases.research.status")" "completed" "Research status preserved"
assert_contains "$output" "removed analysis_cache from manifest" "Reports manifest cleanup"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: both file and manifest cleaned together${NC}"
setup_fixture

create_manifest "both" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "xyz789", "generated": "2026-02-01", "files": ["a.md"]}
    }
  }
}'
create_state_file "both" "# old cache content"

output=$(run_migration)

assert_file_not_exists "$TEST_DIR/.workflows/both/.state/research-analysis.md" "State file deleted"
assert_equals "$(get_field "both" "phases.research.analysis_cache")" "undefined" "analysis_cache removed"
assert_equals "$(get_field "both" "phases.research.status")" "completed" "Research status preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: manifest without analysis_cache unchanged${NC}"
setup_fixture

create_manifest "no-cache" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {"status": "completed"},
    "discussion": {"status": "in-progress"}
  }
}'

output=$(run_migration)

assert_equals "$(get_field "no-cache" "phases.research.status")" "completed" "Research status unchanged"
assert_equals "$(get_field "no-cache" "phases.discussion.status")" "in-progress" "Discussion status unchanged"
assert_not_contains "$output" "removed analysis_cache" "No manifest update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: manifest without research phase unchanged${NC}"
setup_fixture

create_manifest "no-research" '{"work_type":"bugfix","status":"in-progress","phases":{"investigation":{"status":"in-progress"}}}'

output=$(run_migration)

assert_equals "$(get_field "no-research" "phases.investigation.status")" "in-progress" "Investigation unchanged"
assert_not_contains "$output" "updated" "No update reported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo '{"phases":{"research":{"analysis_cache":{"checksum":"old"}}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
create_manifest "real" '{"work_type":"feature","status":"in-progress","phases":{"research":{"analysis_cache":{"checksum":"old"}}}}'

run_migration > /dev/null

assert_equals "$(get_field "real" "phases.research.analysis_cache")" "undefined" "Real manifest cleaned"
dot_cache=$(node -e "
  const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(m.phases.research.analysis_cache ? 'present' : 'absent');
" "$TEST_DIR/.workflows/.state/manifest.json")
assert_equals "$dot_cache" "present" "Dot-dir manifest not touched"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — running twice produces same result${NC}"
setup_fixture

create_manifest "idem" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "abc", "generated": "2026-01-01", "files": ["x.md"]}
    }
  }
}'
create_state_file "idem" "# old cache"

run_migration > /dev/null
output=$(run_migration)

assert_file_not_exists "$TEST_DIR/.workflows/idem/.state/research-analysis.md" "State file still gone"
assert_equals "$(get_field "idem" "phases.research.analysis_cache")" "undefined" "analysis_cache still gone"
assert_not_contains "$output" "removed" "No updates on second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: preserves other manifest fields${NC}"
setup_fixture

create_manifest "preserve" '{
  "name": "preserve",
  "work_type": "feature",
  "status": "in-progress",
  "created": "2026-01-15",
  "phases": {
    "research": {
      "status": "completed",
      "analysis_cache": {"checksum": "abc"}
    },
    "discussion": {"status": "in-progress"}
  }
}'

run_migration > /dev/null

assert_equals "$(get_field "preserve" "name")" "preserve" "Name preserved"
assert_equals "$(get_field "preserve" "work_type")" "feature" "Work type preserved"
assert_equals "$(get_field "preserve" "created")" "2026-01-15" "Created date preserved"
assert_equals "$(get_field "preserve" "phases.research.status")" "completed" "Research status preserved"
assert_equals "$(get_field "preserve" "phases.discussion.status")" "in-progress" "Discussion status preserved"
assert_equals "$(get_field "preserve" "phases.research.analysis_cache")" "undefined" "analysis_cache removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple work units processed${NC}"
setup_fixture

create_manifest "feat-a" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed", "analysis_cache": {"checksum": "a1"}}}
}'
create_state_file "feat-a" "# cache a"

create_manifest "feat-b" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed", "analysis_cache": {"checksum": "b2"}}}
}'

create_manifest "feat-c" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"research": {"status": "completed"}}
}'

run_migration > /dev/null

assert_file_not_exists "$TEST_DIR/.workflows/feat-a/.state/research-analysis.md" "feat-a state file deleted"
assert_equals "$(get_field "feat-a" "phases.research.analysis_cache")" "undefined" "feat-a cache cleared"
assert_equals "$(get_field "feat-b" "phases.research.analysis_cache")" "undefined" "feat-b cache cleared"
assert_equals "$(get_field "feat-c" "phases.research.analysis_cache")" "undefined" "feat-c had no cache, still none"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no .workflows directory — exits cleanly${NC}"
setup_fixture

output=$(run_migration)

assert_not_contains "$output" "removed" "No updates without .workflows dir"

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
