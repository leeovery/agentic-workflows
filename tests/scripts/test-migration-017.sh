#!/bin/bash
#
# Tests migration 017-external-deps-object.sh
# Validates conversion of external_dependencies from array to object format.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/017-external-deps-object.sh"

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

assert_equals() {
    local actual="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected: $expected"
        echo -e "    Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

assert_contains() {
    local content="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -q -- "$expected"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected to find: $expected"
        echo -e "    In: $content"
        TESTS_FAILED=$((TESTS_FAILED + 1))
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
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
}

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows"
    mkdir -p "$TEST_DIR/.workflows"
}

run_migration() {
    cd "$TEST_DIR"
    source "$MIGRATION_SCRIPT"
}

# ============================================================================
# TESTS
# ============================================================================

echo -e "${YELLOW}Test: converts array to object for feature${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/auth"
cat > "$TEST_DIR/.workflows/auth/manifest.json" << 'EOF'
{
  "name": "auth",
  "work_type": "feature",
  "status": "active",
  "phases": {
    "planning": {
      "status": "concluded",
      "external_dependencies": [
        { "topic": "billing", "state": "unresolved", "description": "Invoice API" },
        { "topic": "payments", "state": "resolved", "task_id": "pay-1" }
      ]
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/auth/manifest.json")

assert_contains "$content" '"billing"' "billing key exists"
assert_contains "$content" '"state": "unresolved"' "billing state preserved"
assert_contains "$content" '"description": "Invoice API"' "billing description preserved"
assert_contains "$content" '"payments"' "payments key exists"
assert_contains "$content" '"task_id": "pay-1"' "payments task_id preserved"
assert_not_contains "$content" '"topic"' "topic field removed from values"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: converts empty array to empty object${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/simple"
cat > "$TEST_DIR/.workflows/simple/manifest.json" << 'EOF'
{
  "name": "simple",
  "work_type": "feature",
  "status": "active",
  "phases": {
    "planning": {
      "status": "concluded",
      "external_dependencies": []
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/simple/manifest.json")

# Empty array should become empty object
result=$(node -e "
  const d = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/simple/manifest.json','utf8'));
  const deps = d.phases.planning.external_dependencies;
  console.log(typeof deps === 'object' && !Array.isArray(deps) ? 'object' : 'not_object');
")
assert_equals "$result" "object" "Empty array converted to object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: converts array in epic items${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/my-epic"
cat > "$TEST_DIR/.workflows/my-epic/manifest.json" << 'EOF'
{
  "name": "my-epic",
  "work_type": "epic",
  "status": "active",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "status": "concluded",
          "external_dependencies": [
            { "topic": "auth", "state": "resolved", "task_id": "auth-1" }
          ]
        }
      }
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/my-epic/manifest.json")

assert_contains "$content" '"auth"' "auth key exists in epic item"
assert_contains "$content" '"state": "resolved"' "state preserved"
assert_not_contains "$content" '"topic"' "topic field removed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: idempotent — already object format unchanged${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/already-done"
cat > "$TEST_DIR/.workflows/already-done/manifest.json" << 'EOF'
{
  "name": "already-done",
  "work_type": "feature",
  "status": "active",
  "phases": {
    "planning": {
      "status": "concluded",
      "external_dependencies": {
        "billing": { "state": "unresolved" }
      }
    }
  }
}
EOF
# Save content before migration
before=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")

assert_equals "$after" "$before" "Already-object format unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/.archive/old"
cat > "$TEST_DIR/.workflows/.archive/old/manifest.json" << 'EOF'
{
  "name": "old",
  "work_type": "feature",
  "status": "archived",
  "phases": {
    "planning": {
      "external_dependencies": [
        { "topic": "x", "state": "unresolved" }
      ]
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/.archive/old/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/.archive/old/manifest.json")

assert_equals "$after" "$before" "Dot-prefixed directory skipped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no external_dependencies field left unchanged${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/no-deps"
cat > "$TEST_DIR/.workflows/no-deps/manifest.json" << 'EOF'
{
  "name": "no-deps",
  "work_type": "feature",
  "status": "active",
  "phases": {
    "planning": {
      "status": "concluded"
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")

assert_equals "$after" "$before" "No external_dependencies field left unchanged"

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
