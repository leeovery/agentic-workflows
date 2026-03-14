#!/bin/bash
#
# Tests migration 010-cache-state-restructure.sh
# Validates the full .cache/ → .state/ + .cache/ restructure.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/010-gitignore-sessions.sh"

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
    rm -rf "$TEST_DIR/.gitignore"
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

assert_line_count() {
    local content="$1"
    local pattern="$2"
    local expected_count="$3"
    local description="$4"

    TESTS_RUN=$((TESTS_RUN + 1))

    local actual_count
    actual_count=$(echo "$content" | grep -cF -- "$pattern" || true)

    if [ "$actual_count" = "$expected_count" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected count: $expected_count"
        echo -e "    Actual count:   $actual_count"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: Move analysis files from .cache/ to .state/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/.cache"
echo "analysis content" > "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md"
echo "research content" > "$TEST_DIR/docs/workflow/.cache/research-analysis.md"

run_migration

assert_file_exists "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md" "discussion-consolidation-analysis.md moved to .state/"
assert_file_exists "$TEST_DIR/docs/workflow/.state/research-analysis.md" "research-analysis.md moved to .state/"
assert_file_not_exists "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md" "discussion-consolidation-analysis.md removed from .cache/"
assert_file_not_exists "$TEST_DIR/docs/workflow/.cache/research-analysis.md" "research-analysis.md removed from .cache/"
assert_equals "$(cat "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md")" "analysis content" "Content preserved after move"
assert_equals "$(cat "$TEST_DIR/docs/workflow/.state/research-analysis.md")" "research content" "Content preserved after move"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Clean up orphaned migration tracking in .cache/${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/.cache"
echo "001" > "$TEST_DIR/docs/workflow/.cache/migrations"
echo "001" > "$TEST_DIR/docs/workflow/.cache/migrations.log"

run_migration

assert_file_not_exists "$TEST_DIR/docs/workflow/.cache/migrations" "migrations file removed from .cache/"
assert_file_not_exists "$TEST_DIR/docs/workflow/.cache/migrations.log" "migrations.log file removed from .cache/"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Add docs/workflow/.cache/ to .gitignore${NC}"
setup_fixture
cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
.env
EOF

run_migration
content=$(cat "$TEST_DIR/.gitignore")

assert_contains "$content" "node_modules/" "Existing entry preserved"
assert_contains "$content" ".env" "Existing entry preserved"
assert_contains "$content" "docs/workflow/.cache/" ".cache/ entry appended"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Remove old sessions/ entry from .gitignore${NC}"
setup_fixture
cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/sessions/
.env
EOF

run_migration
content=$(cat "$TEST_DIR/.gitignore")

assert_not_contains "$content" "docs/workflow/.cache/sessions/" "Old sessions/ entry removed"
assert_contains "$content" "docs/workflow/.cache/" "New .cache/ entry added"
assert_contains "$content" "node_modules/" "Other entries preserved"
assert_contains "$content" ".env" "Other entries preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: No .gitignore exists — creates and adds entry${NC}"
setup_fixture

run_migration
content=$(cat "$TEST_DIR/.gitignore")

assert_contains "$content" "docs/workflow/.cache/" ".cache/ entry added to new .gitignore"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotent — .cache/ already in .gitignore, no files to move${NC}"
setup_fixture
cat > "$TEST_DIR/.gitignore" << 'EOF'
node_modules/
docs/workflow/.cache/
.env
EOF

original=$(cat "$TEST_DIR/.gitignore")
output=$(run_migration 2>&1)
new_content=$(cat "$TEST_DIR/.gitignore")

assert_equals "$new_content" "$original" "File unchanged when already correct"
assert_contains "$output" "SKIP" "Reported skip for .gitignore"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Idempotency — running migration twice${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/.cache"
echo "analysis" > "$TEST_DIR/docs/workflow/.cache/discussion-consolidation-analysis.md"

run_migration
first_gitignore=$(cat "$TEST_DIR/.gitignore")

run_migration
second_gitignore=$(cat "$TEST_DIR/.gitignore")

assert_equals "$second_gitignore" "$first_gitignore" "Second run produces same .gitignore"
assert_line_count "$second_gitignore" "docs/workflow/.cache/" "1" ".cache/ entry appears exactly once"
assert_file_exists "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md" "File still in .state/ after second run"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Files already in .state/ — no double move${NC}"
setup_fixture

mkdir -p "$TEST_DIR/docs/workflow/.state"
echo "existing state content" > "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md"

run_migration

assert_equals "$(cat "$TEST_DIR/docs/workflow/.state/discussion-consolidation-analysis.md")" "existing state content" "Existing .state/ file not overwritten"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: .gitignore with no trailing newline — entry on its own line${NC}"
setup_fixture
printf 'node_modules/\n.claude/settings.local.json' > "$TEST_DIR/.gitignore"

run_migration
content=$(cat "$TEST_DIR/.gitignore")

assert_contains "$content" ".claude/settings.local.json" "Original last line preserved intact"
assert_not_contains "$content" ".claude/settings.local.jsondocs" "No concatenation with appended entry"
assert_contains "$content" "docs/workflow/.cache/" ".cache/ entry present"
# Verify each entry is on its own line
line_count=$(wc -l < "$TEST_DIR/.gitignore" | tr -d ' ')
assert_equals "$line_count" "3" "Entry appended as separate line (3 lines total)"

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
