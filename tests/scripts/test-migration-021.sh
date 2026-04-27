#!/bin/bash
#
# Tests for migration 021: research-filename-rename
#
# Run: bash tests/scripts/test-migration-021.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/021-research-filename-rename.sh"

PASS=0
FAIL=0

report_update() { : ; }
report_skip() { : ; }
export -f report_update report_skip

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
  TEST_DIR=$(mktemp -d /tmp/migration-021-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

create_work_unit() {
  local name="$1" work_type="$2"
  mkdir -p "$TEST_DIR/.workflows/$name/research"
  cat > "$TEST_DIR/.workflows/$name/manifest.json" <<EOF
{"name":"$name","work_type":"$work_type","status":"in-progress","phases":{}}
EOF
}

# --- Test 1: Renames exploration.md to {work_unit}.md for features ---
test_feature_rename() {
  setup

  create_work_unit "auth-flow" "feature"
  echo "# Research" > "$TEST_DIR/.workflows/auth-flow/research/exploration.md"

  bash "$MIGRATION"

  assert_eq "renamed" "true" "$([ -f "$TEST_DIR/.workflows/auth-flow/research/auth-flow.md" ] && echo true || echo false)"
  assert_eq "old removed" "false" "$([ -f "$TEST_DIR/.workflows/auth-flow/research/exploration.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Skips epic work units ---
test_skips_epic() {
  setup

  create_work_unit "payments" "epic"
  echo "# Research" > "$TEST_DIR/.workflows/payments/research/exploration.md"

  bash "$MIGRATION"

  assert_eq "exploration untouched" "true" "$([ -f "$TEST_DIR/.workflows/payments/research/exploration.md" ] && echo true || echo false)"
  assert_eq "no renamed file" "false" "$([ -f "$TEST_DIR/.workflows/payments/research/payments.md" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Skips when exploration.md doesn't exist ---
test_no_exploration() {
  setup

  create_work_unit "billing" "feature"

  bash "$MIGRATION"

  assert_eq "no file created" "false" "$([ -f "$TEST_DIR/.workflows/billing/research/billing.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: Skips when target already exists ---
test_target_exists() {
  setup

  create_work_unit "data-sync" "feature"
  echo "# Old" > "$TEST_DIR/.workflows/data-sync/research/exploration.md"
  echo "# New" > "$TEST_DIR/.workflows/data-sync/research/data-sync.md"

  bash "$MIGRATION"

  local content
  content=$(cat "$TEST_DIR/.workflows/data-sync/research/data-sync.md")
  assert_eq "target not overwritten" "# New" "$content"
  assert_eq "exploration still exists" "true" "$([ -f "$TEST_DIR/.workflows/data-sync/research/exploration.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.cache/research"
  cat > "$TEST_DIR/.workflows/.cache/manifest.json" <<'EOF'
{"name":".cache","work_type":"feature","status":"in-progress","phases":{}}
EOF
  echo "# Scratch" > "$TEST_DIR/.workflows/.cache/research/exploration.md"

  bash "$MIGRATION"

  assert_eq "dot dir untouched" "true" "$([ -f "$TEST_DIR/.workflows/.cache/research/exploration.md" ] && echo true || echo false)"

  teardown
}

# --- Test 6: No .workflows directory ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  bash "$MIGRATION"

  assert_eq "no error" "true" "true"

  teardown
}

# --- Run all tests ---
echo "Running migration 021 tests..."
echo ""

test_feature_rename
test_skips_epic
test_no_exploration
test_target_exists
test_skips_dot_dirs
test_no_workflows_dir

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
