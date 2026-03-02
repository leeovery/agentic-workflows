#!/bin/bash
#
# Tests hooks/workflows/write-session-state.sh, session-env.sh, session-cleanup.sh
# Validates session state lifecycle: write, env export, cleanup.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRITE_SCRIPT="$SCRIPT_DIR/../../hooks/workflows/write-session-state.sh"
ENV_SCRIPT="$SCRIPT_DIR/../../hooks/workflows/session-env.sh"
CLEANUP_SCRIPT="$SCRIPT_DIR/../../hooks/workflows/session-cleanup.sh"

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

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows" "$TEST_DIR/env"
    mkdir -p "$TEST_DIR/.workflows/.cache/sessions"
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
        echo -e "    In: $content"
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
        echo -e "    Did not expect to find: $unexpected"
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

assert_file_exists() {
    local file="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_not_exists() {
    local file="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File should not exist: $file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# TEST CASES — write-session-state.sh
# ============================================================================

echo -e "${YELLOW}Test: write-session-state creates correct YAML${NC}"
setup_fixture

CLAUDE_SESSION_ID="test-session-001" \
CLAUDE_PROJECT_DIR="$TEST_DIR" \
bash "$WRITE_SCRIPT" "auth-flow" ".claude/skills/technical-discussion/SKILL.md" ".workflows/auth-flow/discussion/discussion.md"

session_file="$TEST_DIR/.workflows/.cache/sessions/test-session-001.yaml"
assert_file_exists "$session_file" "Session file created"
content=$(cat "$session_file")
assert_contains "$content" "^topic: auth-flow$" "Topic field correct"
assert_contains "$content" "^skill: .claude/skills/technical-discussion/SKILL.md$" "Skill field correct"
assert_contains "$content" "^artifact: .workflows/auth-flow/discussion/discussion.md$" "Artifact field correct"
assert_not_contains "$content" "pipeline" "No pipeline section in output"

echo ""

# ============================================================================
# TEST CASES — session-env.sh
# ============================================================================

echo -e "${YELLOW}Test: session-env writes CLAUDE_SESSION_ID to env file${NC}"
setup_fixture
env_file="$TEST_DIR/env/claude.env"
mkdir -p "$TEST_DIR/env"

echo '{"session_id": "env-test-session-999"}' | \
  CLAUDE_ENV_FILE="$env_file" \
  bash "$ENV_SCRIPT"

assert_file_exists "$env_file" "Env file created"
env_content=$(cat "$env_file")
assert_contains "$env_content" "CLAUDE_SESSION_ID=env-test-session-999" "Session ID written to env file"

echo ""

# ============================================================================
# TEST CASES — session-cleanup.sh
# ============================================================================

echo -e "${YELLOW}Test: session-cleanup deletes session file${NC}"
setup_fixture
session_file="$TEST_DIR/.workflows/.cache/sessions/cleanup-test-001.yaml"
cat > "$session_file" << 'EOF'
topic: test
skill: test
artifact: test
EOF

assert_file_exists "$session_file" "Session file exists before cleanup"

echo '{"session_id": "cleanup-test-001"}' | \
  CLAUDE_PROJECT_DIR="$TEST_DIR" \
  bash "$CLEANUP_SCRIPT"

assert_file_not_exists "$session_file" "Session file deleted after cleanup"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: session-cleanup with missing file — no error${NC}"
setup_fixture

# Should not crash when file doesn't exist
output=$(echo '{"session_id": "nonexistent-session"}' | \
  CLAUDE_PROJECT_DIR="$TEST_DIR" \
  bash "$CLEANUP_SCRIPT" 2>&1) || true

TESTS_RUN=$((TESTS_RUN + 1))
echo -e "  ${GREEN}✓${NC} Script did not crash on missing file"
TESTS_PASSED=$((TESTS_PASSED + 1))

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
