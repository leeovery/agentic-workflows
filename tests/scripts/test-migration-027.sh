#!/bin/bash
#
# Tests for migration 027: rename-external-deps-task-id
#
# Run: bash tests/scripts/test-migration-027.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/027-rename-external-deps-task-id.sh"

PASS=0
FAIL=0

report_update() { : ; }
report_skip() { : ; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $label"
    echo "  expected: $expected"
    echo "  actual:   $actual"
  fi
}

setup() {
  TEST_DIR=$(mktemp -d /tmp/migration-027-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: renames task_id to internal_id in epic topic items ---
test_renames_task_id() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  local content
  content=$(cat "$TEST_DIR/.workflows/my-epic/manifest.json")

  assert_eq "task_id renamed to internal_id" "true" "$(echo "$content" | grep -qF '"internal_id": "auth-1-3"' && echo true || echo false)"
  assert_eq "task_id field removed" "false" "$(echo "$content" | grep -qF '"task_id"' && echo true || echo false)"
  assert_eq "state preserved" "true" "$(echo "$content" | grep -qF '"state": "resolved"' && echo true || echo false)"
  assert_eq "description preserved" "true" "$(echo "$content" | grep -qF '"description": "User authentication"' && echo true || echo false)"
  assert_eq "unresolved dep unchanged" "true" "$(echo "$content" | grep -qF '"state": "unresolved"' && echo true || echo false)"

  teardown
}

# --- Test 2: already has internal_id — unchanged (idempotent) ---
test_already_migrated() {
  setup

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

  local before
  before=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")

  assert_eq "already-migrated manifest unchanged" "$before" "$after"

  teardown
}

# --- Test 3: no external_dependencies field — unchanged ---
test_no_deps() {
  setup

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

  local before
  before=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")

  assert_eq "no external_dependencies field left unchanged" "$before" "$after"

  teardown
}

# --- Test 4: empty object external_dependencies — unchanged ---
test_empty_deps() {
  setup

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

  local before
  before=$(cat "$TEST_DIR/.workflows/empty-deps/manifest.json")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/empty-deps/manifest.json")

  assert_eq "empty external_dependencies unchanged" "$before" "$after"

  teardown
}

# --- Test 5: skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

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

  local before
  before=$(cat "$TEST_DIR/.workflows/.archive/manifest.json")

  cd "$TEST_DIR"
  source "$MIGRATION"

  local after
  after=$(cat "$TEST_DIR/.workflows/.archive/manifest.json")

  assert_eq "dot-prefixed directory skipped" "$before" "$after"

  teardown
}

# --- Test 6: mixed — some deps have task_id, some already internal_id ---
test_mixed_deps() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  local content
  content=$(cat "$TEST_DIR/.workflows/mixed/manifest.json")

  assert_eq "task_id renamed to internal_id" "true" "$(echo "$content" | grep -qF '"internal_id": "auth-1-3"' && echo true || echo false)"
  assert_eq "existing internal_id preserved" "true" "$(echo "$content" | grep -qF '"internal_id": "billing-2-1"' && echo true || echo false)"
  assert_eq "no task_id fields remain" "false" "$(echo "$content" | grep -qF '"task_id"' && echo true || echo false)"
  assert_eq "unresolved dep unchanged" "true" "$(echo "$content" | grep -qF '"state": "unresolved"' && echo true || echo false)"

  teardown
}

# --- Test 7: multiple phases with deps — all processed ---
test_multiple_phases() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  local content
  content=$(cat "$TEST_DIR/.workflows/multi-phase/manifest.json")

  assert_eq "planning.core dep renamed" "true" "$(echo "$content" | grep -qF '"internal_id": "auth-1"' && echo true || echo false)"
  assert_eq "planning.advanced dep renamed" "true" "$(echo "$content" | grep -qF '"internal_id": "core-2-3"' && echo true || echo false)"
  assert_eq "implementation.core dep renamed" "true" "$(echo "$content" | grep -qF '"internal_id": "billing-1-2"' && echo true || echo false)"
  assert_eq "no task_id fields remain across phases" "false" "$(echo "$content" | grep -qF '"task_id"' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 027 tests..."
echo ""

test_renames_task_id
test_already_migrated
test_no_deps
test_empty_deps
test_skips_dot_dirs
test_mixed_deps
test_multiple_phases

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
