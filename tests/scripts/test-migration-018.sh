#!/bin/bash
#
# Tests migration 018-remove-stale-environment-setup.sh
# Validates cleanup of stale environment-setup.md from workflows root.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/migrate/scripts/migrations/018-remove-stale-environment-setup.sh"

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
    rm -rf "$TEST_DIR/.workflows"
}

run_migration() {
    cd "$TEST_DIR"
    source "$MIGRATION_SCRIPT"
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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Both exist — removes stale root copy, keeps .state/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo "stale content" > "$TEST_DIR/.workflows/environment-setup.md"
echo "real content" > "$TEST_DIR/.workflows/.state/environment-setup.md"

output=$(run_migration 2>&1)

assert_file_not_exists "$TEST_DIR/.workflows/environment-setup.md" "Stale root file removed"
assert_file_exists "$TEST_DIR/.workflows/.state/environment-setup.md" ".state/ copy preserved"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")" "real content" ".state/ content unchanged"
assert_contains "$output" "removed stale copy" "Reports removal"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Only root exists — moves to .state/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows"
echo "needs moving" > "$TEST_DIR/.workflows/environment-setup.md"

output=$(run_migration 2>&1)

assert_file_not_exists "$TEST_DIR/.workflows/environment-setup.md" "Root file removed"
assert_file_exists "$TEST_DIR/.workflows/.state/environment-setup.md" "File moved to .state/"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")" "needs moving" "Content preserved"
assert_contains "$output" "moved from workflows root" "Reports move"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Only .state/ exists — no-op${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo "already correct" > "$TEST_DIR/.workflows/.state/environment-setup.md"

output=$(run_migration 2>&1)

assert_file_exists "$TEST_DIR/.workflows/.state/environment-setup.md" ".state/ copy still exists"
assert_file_not_exists "$TEST_DIR/.workflows/environment-setup.md" "No root file created"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")" "already correct" "Content unchanged"
assert_contains "$output" "SKIP" "Reports skip"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Neither exists — no-op${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows"

output=$(run_migration 2>&1)

assert_file_not_exists "$TEST_DIR/.workflows/environment-setup.md" "No root file created"
assert_file_not_exists "$TEST_DIR/.workflows/.state/environment-setup.md" "No .state/ file created"
assert_contains "$output" "SKIP" "Reports skip"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency — running twice with both files${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/.state"
echo "stale" > "$TEST_DIR/.workflows/environment-setup.md"
echo "canonical" > "$TEST_DIR/.workflows/.state/environment-setup.md"

run_migration
run_migration

assert_file_not_exists "$TEST_DIR/.workflows/environment-setup.md" "Root file still gone after second run"
assert_file_exists "$TEST_DIR/.workflows/.state/environment-setup.md" ".state/ copy still exists"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/environment-setup.md")" "canonical" "Content unchanged after second run"

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
