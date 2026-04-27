#!/bin/bash
# Tests for migration 017: external-deps-object
# Run: bash tests/scripts/test-migration-017.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/017-external-deps-object.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-017-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Converts array to object for feature ---
test_array_to_object_feature() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  content=$(cat "$TEST_DIR/.workflows/auth/manifest.json")

  assert_eq "billing key exists" "true" "$(echo "$content" | grep -qF '"billing"' && echo true || echo false)"
  assert_eq "billing state preserved" "true" "$(echo "$content" | grep -qF '"state": "unresolved"' && echo true || echo false)"
  assert_eq "billing description preserved" "true" "$(echo "$content" | grep -qF '"description": "Invoice API"' && echo true || echo false)"
  assert_eq "payments key exists" "true" "$(echo "$content" | grep -qF '"payments"' && echo true || echo false)"
  assert_eq "payments task_id preserved" "true" "$(echo "$content" | grep -qF '"task_id": "pay-1"' && echo true || echo false)"
  assert_eq "topic field removed from values" "false" "$(echo "$content" | grep -qF '"topic"' && echo true || echo false)"

  teardown
}

# --- Test 2: Converts empty array to empty object ---
test_empty_array_to_object() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  result=$(node -e "
    const d = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/simple/manifest.json','utf8'));
    const deps = d.phases.planning.external_dependencies;
    console.log(typeof deps === 'object' && !Array.isArray(deps) ? 'object' : 'not_object');
  ")
  assert_eq "Empty array converted to object" "object" "$result"

  teardown
}

# --- Test 3: Converts array in epic items ---
test_epic_items() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  content=$(cat "$TEST_DIR/.workflows/my-epic/manifest.json")

  assert_eq "auth key exists in epic item" "true" "$(echo "$content" | grep -qF '"auth"' && echo true || echo false)"
  assert_eq "state preserved" "true" "$(echo "$content" | grep -qF '"state": "resolved"' && echo true || echo false)"
  assert_eq "topic field removed" "false" "$(echo "$content" | grep -qF '"topic"' && echo true || echo false)"

  teardown
}

# --- Test 4: Idempotent — already object format unchanged ---
test_idempotent() {
  setup

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

  before=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")

  cd "$TEST_DIR"
  source "$MIGRATION"

  after=$(cat "$TEST_DIR/.workflows/already-done/manifest.json")
  assert_eq "Already-object format unchanged" "$before" "$after"

  teardown
}

# --- Test 5: Skips dot-prefixed directories ---
test_skip_dot_dirs() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  after=$(cat "$TEST_DIR/.workflows/.archive/old/manifest.json")
  assert_eq "Dot-prefixed directory skipped" "$before" "$after"

  teardown
}

# --- Test 6: No external_dependencies field left unchanged ---
test_no_deps_unchanged() {
  setup

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

  cd "$TEST_DIR"
  source "$MIGRATION"

  after=$(cat "$TEST_DIR/.workflows/no-deps/manifest.json")
  assert_eq "No external_dependencies field left unchanged" "$before" "$after"

  teardown
}

# --- Run all tests ---
echo "Running migration 017 tests..."
echo ""

test_array_to_object_feature
test_empty_array_to_object
test_epic_items
test_idempotent
test_skip_dot_dirs
test_no_deps_unchanged

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
