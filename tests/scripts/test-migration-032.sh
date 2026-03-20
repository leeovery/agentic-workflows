#!/bin/bash
#
# Tests for migration 032: promote-cross-cutting-specs
#
# Run: bash tests/scripts/test-migration-032.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/032-promote-cross-cutting-specs.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-031-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
  echo '{"work_units":{}}' > "$TEST_DIR/.workflows/manifest.json"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Epic with cc spec gets promoted ---
test_epic_promotion() {
  setup

  local wu_dir="$TEST_DIR/.workflows/my-epic"
  mkdir -p "$wu_dir/discussion"
  mkdir -p "$wu_dir/specification/caching"

  echo "# Discussion about caching" > "$wu_dir/discussion/caching-discussion.md"
  echo "# Specification: Caching" > "$wu_dir/specification/caching/specification.md"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "my-epic",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "discussion": {
      "items": {
        "caching-discussion": { "status": "completed" }
      }
    },
    "specification": {
      "items": {
        "caching": {
          "status": "completed",
          "type": "cross-cutting",
          "sources": {
            "caching-discussion": { "status": "incorporated" }
          }
        }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  # Check cc work unit was created
  assert_eq "cc manifest exists" "true" "$([ -f "$TEST_DIR/.workflows/caching/manifest.json" ] && echo true || echo false)"

  local cc_wt=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/caching/manifest.json', 'utf8'));
    console.log(m.work_type);
  ")
  assert_eq "cc work_type" "cross-cutting" "$cc_wt"

  local cc_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/caching/manifest.json', 'utf8'));
    console.log(m.status);
  ")
  assert_eq "cc status" "completed" "$cc_status"

  local cc_source=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/caching/manifest.json', 'utf8'));
    console.log(m.source_work_unit);
  ")
  assert_eq "cc source_work_unit" "my-epic" "$cc_source"

  # Check discussion moved
  assert_eq "discussion moved" "true" "$([ -f "$TEST_DIR/.workflows/caching/discussion/caching-discussion.md" ] && echo true || echo false)"
  assert_eq "discussion removed from epic" "false" "$([ -f "$wu_dir/discussion/caching-discussion.md" ] && echo true || echo false)"

  # Check spec moved
  assert_eq "spec moved" "true" "$([ -f "$TEST_DIR/.workflows/caching/specification/caching/specification.md" ] && echo true || echo false)"
  assert_eq "spec removed from epic" "false" "$([ -d "$wu_dir/specification/caching" ] && echo true || echo false)"

  # Check epic manifest updated
  local epic_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.caching.status);
  ")
  assert_eq "epic spec status" "promoted" "$epic_status"

  local epic_promoted=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.caching.promoted_to);
  ")
  assert_eq "epic promoted_to" "caching" "$epic_promoted"

  # Check type field removed
  local has_type=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('type' in m.phases.specification.items.caching);
  ")
  assert_eq "epic type field removed" "false" "$has_type"

  # Check project manifest
  local proj_wt=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8'));
    console.log(m.work_units.caching.work_type);
  ")
  assert_eq "project manifest updated" "cross-cutting" "$proj_wt"

  teardown
}

# --- Test 2: Feature with type field gets stripped ---
test_feature_type_strip() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed",
          "type": "feature"
        }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local has_type=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('type' in m.phases.specification.items.auth);
  ")
  assert_eq "feature type field removed" "false" "$has_type"

  # Status should not change
  local status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.auth.status);
  ")
  assert_eq "feature status unchanged" "completed" "$status"

  teardown
}

# --- Test 3: Idempotent — cc work unit already exists ---
test_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/my-epic"
  mkdir -p "$wu_dir"

  # Epic with promoted spec
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "my-epic",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "specification": {
      "items": {
        "caching": {
          "status": "completed",
          "type": "cross-cutting"
        }
      }
    }
  }
}
JSON

  # CC work unit already exists
  mkdir -p "$TEST_DIR/.workflows/caching"
  cat > "$TEST_DIR/.workflows/caching/manifest.json" << 'JSON'
{"name":"caching","work_type":"cross-cutting","status":"completed","phases":{}}
JSON

  source "$MIGRATION"

  # Should mark as promoted and remove type
  local epic_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.caching.status);
  ")
  assert_eq "idempotent: epic status promoted" "promoted" "$epic_status"

  local has_type=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('type' in m.phases.specification.items.caching);
  ")
  assert_eq "idempotent: type removed" "false" "$has_type"

  teardown
}

# --- Test 4: Clean data — no type fields ---
test_clean_data() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed"
        }
      }
    }
  }
}
JSON

  source "$MIGRATION"

  # Should not crash, manifest unchanged
  local status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.auth.status);
  ")
  assert_eq "clean data: status unchanged" "completed" "$status"

  teardown
}

# --- Run all tests ---
echo "Running migration 032 tests..."
echo ""

test_epic_promotion
test_feature_type_strip
test_idempotent
test_clean_data

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
