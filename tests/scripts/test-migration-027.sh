#!/bin/bash
#
# Tests migration 027-rename-external-deps-task-id.sh
# Validates renaming of task_id → internal_id in external_dependencies entries.
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_SCRIPT="$SCRIPT_DIR/../../skills/workflow-migrate/scripts/migrations/027-rename-external-deps-task-id.sh"

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

echo -e "${YELLOW}Test: renames task_id to internal_id in epic topic items${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/my-epic"
cat > "$TEST_DIR/.workflows/my-epic/manifest.json" << 'EOF'
{
  "name": "my-epic",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "status": "completed",
          "external_dependencies": {
            "auth": {
              "description": "User authentication",
              "state": "resolved",
              "task_id": "auth-1-3"
            },
            "billing": {
              "description": "Invoice API",
              "state": "unresolved"
            }
          }
        }
      }
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/my-epic/manifest.json")

assert_contains "$content" '"internal_id": "auth-1-3"' "task_id renamed to internal_id"
assert_not_contains "$content" '"task_id"' "task_id field removed"
assert_contains "$content" '"state": "resolved"' "state preserved"
assert_contains "$content" '"description": "User authentication"' "description preserved"
assert_contains "$content" '"state": "unresolved"' "unresolved dep unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: already has internal_id — unchanged (idempotent)${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/already-done"
cat > "$TEST_DIR/.workflows/already-done/manifest.json" << 'EOF'
{
  "name": "already-done",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "status": "completed",
          "external_dependencies": {
            "auth": {
              "state": "resolved",
              "internal_id": "auth-1-3"
            }
          }
        }
      }
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")

assert_equals "$after" "$before" "Already-migrated manifest unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no external_dependencies field — unchanged${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/no-deps"
cat > "$TEST_DIR/.workflows/no-deps/manifest.json" << 'EOF'
{
  "name": "no-deps",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "status": "completed"
        }
      }
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")

assert_equals "$after" "$before" "No external_dependencies field left unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: empty object external_dependencies — unchanged${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/empty-deps"
cat > "$TEST_DIR/.workflows/empty-deps/manifest.json" << 'EOF'
{
  "name": "empty-deps",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "status": "completed",
          "external_dependencies": {}
        }
      }
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/empty-deps/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/empty-deps/manifest.json")

assert_equals "$after" "$before" "Empty external_dependencies unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: skips dot-prefixed directories${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/.archive"
cat > "$TEST_DIR/.workflows/.archive/manifest.json" << 'EOF'
{
  "name": "archived",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "external_dependencies": {
            "auth": { "state": "resolved", "task_id": "auth-1" }
          }
        }
      }
    }
  }
}
EOF
before=$(cat "$TEST_DIR/.workflows/.archive/manifest.json")
run_migration
after=$(cat "$TEST_DIR/.workflows/.archive/manifest.json")

assert_equals "$after" "$before" "Dot-prefixed directory skipped"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: mixed — some deps have task_id, some already internal_id${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/mixed"
cat > "$TEST_DIR/.workflows/mixed/manifest.json" << 'EOF'
{
  "name": "mixed",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "external_dependencies": {
            "auth": {
              "state": "resolved",
              "task_id": "auth-1-3"
            },
            "billing": {
              "state": "resolved",
              "internal_id": "billing-2-1"
            },
            "payments": {
              "state": "unresolved"
            }
          }
        }
      }
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/mixed/manifest.json")

assert_contains "$content" '"internal_id": "auth-1-3"' "task_id renamed to internal_id"
assert_contains "$content" '"internal_id": "billing-2-1"' "existing internal_id preserved"
assert_not_contains "$content" '"task_id"' "no task_id fields remain"
assert_contains "$content" '"state": "unresolved"' "unresolved dep unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: multiple phases with deps — all processed${NC}"
setup_fixture
mkdir -p "$TEST_DIR/.workflows/multi-phase"
cat > "$TEST_DIR/.workflows/multi-phase/manifest.json" << 'EOF'
{
  "name": "multi-phase",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "core": {
          "external_dependencies": {
            "auth": { "state": "resolved", "task_id": "auth-1" }
          }
        },
        "advanced": {
          "external_dependencies": {
            "core": { "state": "resolved", "task_id": "core-2-3" }
          }
        }
      }
    },
    "implementation": {
      "items": {
        "core": {
          "external_dependencies": {
            "billing": { "state": "resolved", "task_id": "billing-1-2" }
          }
        }
      }
    }
  }
}
EOF
run_migration
content=$(cat "$TEST_DIR/.workflows/multi-phase/manifest.json")

assert_contains "$content" '"internal_id": "auth-1"' "planning.core dep renamed"
assert_contains "$content" '"internal_id": "core-2-3"' "planning.advanced dep renamed"
assert_contains "$content" '"internal_id": "billing-1-2"' "implementation.core dep renamed"
assert_not_contains "$content" '"task_id"' "no task_id fields remain across phases"

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
