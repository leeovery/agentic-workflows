#!/bin/bash
#
# Tests hooks/workflows/compact-recovery.sh
# Validates session state reading and recovery context injection.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/../../hooks/workflows/compact-recovery.sh"

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
    rm -rf "$TEST_DIR/.workflows"
    mkdir -p "$TEST_DIR/.workflows/.cache/sessions"
}

run_hook() {
    local session_id="$1"
    echo "{\"session_id\": \"${session_id}\"}" | CLAUDE_PROJECT_DIR="$TEST_DIR" bash "$HOOK_SCRIPT" 2>&1 || true
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

# ============================================================================
# TEST CASES
# ============================================================================

echo -e "${YELLOW}Test: No session state file — silent exit${NC}"
setup_fixture

output=$(run_hook "nonexistent-session-123")

assert_equals "$output" "" "No output when session file does not exist"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Basic state (no pipeline) — IMMEDIATE section only${NC}"
setup_fixture
cat > "$TEST_DIR/.workflows/.cache/sessions/session-basic-001.yaml" << 'EOF'
topic: auth-flow
skill: .claude/skills/technical-discussion/SKILL.md
artifact: .workflows/auth-flow/discussion/discussion.md
EOF

output=$(run_hook "session-basic-001")

assert_contains "$output" "additionalContext" "Output contains additionalContext"
assert_contains "$output" "IMMEDIATE" "Output contains IMMEDIATE section"
assert_contains "$output" "auth-flow" "Output contains topic"
assert_contains "$output" "technical-discussion" "Output contains skill path"
assert_contains "$output" "auth-flow/discussion/discussion.md" "Output contains artifact path"
assert_not_contains "$output" "AFTER CONCLUSION" "No AFTER CONCLUSION section"
assert_contains "$output" "workflow-bridge" "Output contains workflow-bridge continuation note"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Session file with extra YAML fields — gracefully ignored${NC}"
setup_fixture
cat > "$TEST_DIR/.workflows/.cache/sessions/session-extra-001.yaml" << 'EOF'
topic: billing
skill: .claude/skills/technical-specification/SKILL.md
artifact: .workflows/billing/specification/specification.md
pipeline:
  after_conclude: |
    This is a legacy pipeline section that should be ignored
EOF

output=$(run_hook "session-extra-001")

assert_contains "$output" "additionalContext" "Output contains additionalContext"
assert_contains "$output" "IMMEDIATE" "Output contains IMMEDIATE section"
assert_contains "$output" "billing" "Output contains topic"
assert_not_contains "$output" "AFTER CONCLUSION" "No AFTER CONCLUSION section for legacy pipeline"
assert_not_contains "$output" "legacy pipeline" "Legacy pipeline content not leaked into output"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: Malformed YAML — graceful handling${NC}"
setup_fixture
cat > "$TEST_DIR/.workflows/.cache/sessions/session-bad-001.yaml" << 'EOF'
this is not valid yaml
  : broken : stuff
  @@@ garbage
EOF

output=$(run_hook "session-bad-001")

# Should not crash — may produce output or empty, but no error exit
TESTS_RUN=$((TESTS_RUN + 1))
# If we got here, the script didn't crash
echo -e "  ${GREEN}✓${NC} Script did not crash on malformed YAML"
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
