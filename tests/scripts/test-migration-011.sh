#!/bin/bash
#
# Tests migration 011-rename-workflow-directory.sh
# Validates moving docs/workflow/ → .workflows/
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/011-rename-workflow-directory.sh"

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
    rm -rf "$TEST_DIR/.workflows"
    rm -rf "$TEST_DIR/.gitignore"
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
    local unexpected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -qF -- "$unexpected"; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Did not expect to find: $unexpected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
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

echo -e "${YELLOW}Test: Full migration — docs/workflow/ → .workflows/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/discussion"
mkdir -p "$TEST_DIR/docs/workflow/specification/auth"
mkdir -p "$TEST_DIR/docs/workflow/.state"
mkdir -p "$TEST_DIR/docs/workflow/.cache/sessions"
echo "discussion content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
echo "spec content" > "$TEST_DIR/docs/workflow/specification/auth/specification.md"
echo "state data" > "$TEST_DIR/docs/workflow/.state/migrations"
echo "cache data" > "$TEST_DIR/docs/workflow/.cache/sessions/abc.yaml"

run_migration

assert_file_exists "$TEST_DIR/.workflows/discussion/auth.md" "Discussion file moved"
assert_equals "$(cat "$TEST_DIR/.workflows/discussion/auth.md")" "discussion content" "Discussion content preserved"
assert_file_exists "$TEST_DIR/.workflows/specification/auth/specification.md" "Spec file moved"
assert_equals "$(cat "$TEST_DIR/.workflows/specification/auth/specification.md")" "spec content" "Spec content preserved"
assert_file_exists "$TEST_DIR/.workflows/.state/migrations" "Hidden .state/ dir moved"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/migrations")" "state data" ".state content preserved"
assert_file_exists "$TEST_DIR/.workflows/.cache/sessions/abc.yaml" "Hidden .cache/ dir moved"
assert_dir_not_exists "$TEST_DIR/docs/workflow" "Old directory removed"
assert_dir_not_exists "$TEST_DIR/docs" "Empty docs/ removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Already migrated — only .workflows/ exists${NC}"
setup_fixture

mkdir -p "$TEST_DIR/.workflows/discussion"
echo "existing" > "$TEST_DIR/.workflows/discussion/auth.md"

output=$(run_migration 2>&1)

assert_contains "$output" "SKIP" "Reports skip when nothing to migrate"
assert_file_exists "$TEST_DIR/.workflows/discussion/auth.md" "Existing files untouched"
assert_equals "$(cat "$TEST_DIR/.workflows/discussion/auth.md")" "existing" "Content unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Fresh install — neither directory exists${NC}"
setup_fixture

output=$(run_migration 2>&1)

assert_contains "$output" "SKIP" "Reports skip for fresh install"
assert_dir_not_exists "$TEST_DIR/.workflows" ".workflows/ not created unnecessarily"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Gitignore updated — docs/workflow/.cache/ → .workflows/.cache/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/discussion"
echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/
.env
EOF

run_migration
content=$(cat "$TEST_DIR/.gitignore")

assert_contains "$content" ".workflows/.cache/" "New gitignore entry present"
assert_not_contains "$content" "docs/workflow/.cache/" "Old gitignore entry removed"
assert_contains "$content" "node_modules/" "Other entries preserved"
assert_contains "$content" ".env" "Other entries preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Gitignore already has .workflows/.cache/ — no-op${NC}"
setup_fixture

cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
.workflows/.cache/
.env
EOF

original=$(cat "$TEST_DIR/.gitignore")
output=$(run_migration 2>&1)
new_content=$(cat "$TEST_DIR/.gitignore")

assert_equals "$new_content" "$original" "Gitignore unchanged"
assert_contains "$output" "SKIP" "Reports skip for gitignore"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: docs/ preserved if has other contents${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/discussion"
mkdir -p "$TEST_DIR/docs/api"
echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
echo "api docs" > "$TEST_DIR/docs/api/readme.md"

run_migration

assert_dir_not_exists "$TEST_DIR/docs/workflow" "Old workflow dir removed"
assert_dir_exists "$TEST_DIR/docs/api" "Other docs/ contents preserved"
assert_file_exists "$TEST_DIR/docs/api/readme.md" "Non-workflow file preserved"
assert_file_exists "$TEST_DIR/.workflows/discussion/auth.md" "Workflow files moved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Hidden directories (.state/, .cache/) moved correctly${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/.state"
mkdir -p "$TEST_DIR/docs/workflow/.cache"
echo "state" > "$TEST_DIR/docs/workflow/.state/migrations"
echo "cache" > "$TEST_DIR/docs/workflow/.cache/data"

run_migration

assert_dir_exists "$TEST_DIR/.workflows/.state" ".state/ directory moved"
assert_dir_exists "$TEST_DIR/.workflows/.cache" ".cache/ directory moved"
assert_file_exists "$TEST_DIR/.workflows/.state/migrations" ".state file moved"
assert_file_exists "$TEST_DIR/.workflows/.cache/data" ".cache file moved"
assert_equals "$(cat "$TEST_DIR/.workflows/.state/migrations")" "state" ".state content preserved"
assert_equals "$(cat "$TEST_DIR/.workflows/.cache/data")" "cache" ".cache content preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Partial migration — item already at destination is skipped${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/discussion"
mkdir -p "$TEST_DIR/.workflows/discussion"
echo "old" > "$TEST_DIR/docs/workflow/discussion/auth.md"
echo "new" > "$TEST_DIR/.workflows/discussion/auth.md"
echo "other" > "$TEST_DIR/docs/workflow/discussion/billing.md"

output=$(run_migration 2>&1)

assert_contains "$output" "SKIP" "Reports skip for existing item"
assert_equals "$(cat "$TEST_DIR/.workflows/discussion/auth.md")" "new" "Existing destination not overwritten"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency — running twice produces same result${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/discussion"
echo "content" > "$TEST_DIR/docs/workflow/discussion/auth.md"
cat > "$TEST_DIR/.gitignore" << 'EOF'
docs/workflow/.cache/
EOF

run_migration
first_content=$(cat "$TEST_DIR/.workflows/discussion/auth.md")
first_gitignore=$(cat "$TEST_DIR/.gitignore")

run_migration
second_content=$(cat "$TEST_DIR/.workflows/discussion/auth.md")
second_gitignore=$(cat "$TEST_DIR/.gitignore")

assert_equals "$second_content" "$first_content" "File content same after second run"
assert_equals "$second_gitignore" "$first_gitignore" "Gitignore same after second run"

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
