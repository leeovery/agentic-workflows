#!/bin/bash
#
# Tests for migration 029: backfill-task-map
#
# Run: bash tests/scripts/test-migration-029.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/029-backfill-task-map.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-029-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Single phase, single task table ---
test_single_phase() {
  setup
  local wu_dir="$TEST_DIR/.workflows/portal"
  mkdir -p "$wu_dir/planning/portal"

  cat > "$wu_dir/manifest.json" << 'MANIFEST'
{
  "name": "portal",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "portal": {
          "status": "completed",
          "format": "tick"
        }
      }
    }
  }
}
MANIFEST

  cat > "$wu_dir/planning/portal/planning.md" << 'PLAN'
# Plan: Portal

### Phase 1: Walking Skeleton
status: approved
external_id: tick-abc123
approved_at: 2026-03-15

**Goal**: Build the basics

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| portal-1-1  | Setup DB | none | authored | tick-def456 |
| portal-1-2  | Add routes | error handling | authored | tick-ghi789 |
PLAN

  source "$MIGRATION"

  local task_map=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(m.phases.planning.items.portal.task_map));
  ")

  assert_eq "single phase: portal-1 mapped" "tick-abc123" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['portal-1'])")"
  assert_eq "single phase: portal-1-1 mapped" "tick-def456" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['portal-1-1'])")"
  assert_eq "single phase: portal-1-2 mapped" "tick-ghi789" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['portal-1-2'])")"

  teardown
}

# --- Test 2: Empty external IDs skipped ---
test_empty_external_ids() {
  setup
  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir/planning/auth"

  cat > "$wu_dir/manifest.json" << 'MANIFEST'
{
  "name": "auth",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "auth": {
          "status": "in-progress",
          "format": "tick"
        }
      }
    }
  }
}
MANIFEST

  cat > "$wu_dir/planning/auth/planning.md" << 'PLAN'
# Plan: Auth

### Phase 1: Setup
status: draft
external_id:

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| auth-1-1    | Models | none | authored | tick-x1 |
| auth-1-2    | Routes | none | pending |  |
PLAN

  source "$MIGRATION"

  local task_map=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    const tm = m.phases.planning.items.auth.task_map || {};
    console.log(JSON.stringify(tm));
  ")

  assert_eq "empty ext: auth-1-1 mapped" "tick-x1" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['auth-1-1'])")"
  assert_eq "empty ext: auth-1-2 not mapped" "undefined" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['auth-1-2'])")"
  # Phase external_id was empty, so portal-1 should not be in task_map
  assert_eq "empty ext: phase not mapped" "undefined" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['auth-1'])")"

  teardown
}

# --- Test 3: Multi-phase plan ---
test_multi_phase() {
  setup
  local wu_dir="$TEST_DIR/.workflows/billing"
  mkdir -p "$wu_dir/planning/billing"

  cat > "$wu_dir/manifest.json" << 'MANIFEST'
{
  "name": "billing",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "items": {
        "billing": {
          "status": "completed",
          "format": "tick"
        }
      }
    }
  }
}
MANIFEST

  cat > "$wu_dir/planning/billing/planning.md" << 'PLAN'
# Plan: Billing

### Phase 1: Foundation
status: approved
external_id: tick-p1
approved_at: 2026-03-10

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| billing-1-1 | Schema | none | authored | tick-t1 |

### Phase 2: Integration
status: approved
external_id: tick-p2
approved_at: 2026-03-11

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| billing-2-1 | Stripe | errors | authored | tick-t2 |
| billing-2-2 | Webhooks | retries | authored | tick-t3 |
PLAN

  source "$MIGRATION"

  local task_map=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(m.phases.planning.items.billing.task_map));
  ")

  assert_eq "multi: billing-1 mapped" "tick-p1" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['billing-1'])")"
  assert_eq "multi: billing-2 mapped" "tick-p2" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['billing-2'])")"
  assert_eq "multi: billing-1-1 mapped" "tick-t1" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['billing-1-1'])")"
  assert_eq "multi: billing-2-2 mapped" "tick-t3" "$(echo "$task_map" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))['billing-2-2'])")"

  teardown
}

# --- Test 4: Idempotent — task_map already exists ---
test_idempotent() {
  setup
  local wu_dir="$TEST_DIR/.workflows/done"
  mkdir -p "$wu_dir/planning/done"

  cat > "$wu_dir/manifest.json" << 'MANIFEST'
{
  "name": "done",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "planning": {
      "items": {
        "done": {
          "status": "completed",
          "format": "tick",
          "task_map": {
            "done-1-1": "tick-existing"
          }
        }
      }
    }
  }
}
MANIFEST

  cat > "$wu_dir/planning/done/planning.md" << 'PLAN'
# Plan: Done

### Phase 1: Only
status: approved
external_id: tick-phase

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| done-1-1    | Task | none | authored | tick-different |
PLAN

  source "$MIGRATION"

  local ext_id=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.planning.items.done.task_map['done-1-1']);
  ")

  assert_eq "idempotent: original value preserved" "tick-existing" "$ext_id"

  teardown
}

# --- Test 5: Cache directory migration ---
test_cache_migration() {
  setup
  local cache_old="$TEST_DIR/.workflows/.cache/planning/myapp/portal"
  mkdir -p "$cache_old"
  echo "scratch content" > "$cache_old/phase-1.md"

  # Need a manifest for the migration to run
  local wu_dir="$TEST_DIR/.workflows/myapp"
  mkdir -p "$wu_dir"
  echo '{"name":"myapp","work_type":"feature","status":"in-progress","phases":{}}' > "$wu_dir/manifest.json"

  source "$MIGRATION"

  local new_file="$TEST_DIR/.workflows/.cache/myapp/planning/portal/phase-1.md"
  if [ -f "$new_file" ]; then
    assert_eq "cache: file moved" "scratch content" "$(cat "$new_file")"
  else
    assert_eq "cache: file exists" "true" "false"
  fi

  if [ -d "$TEST_DIR/.workflows/.cache/planning" ]; then
    assert_eq "cache: old dir removed" "false" "true"
  else
    assert_eq "cache: old dir removed" "true" "true"
  fi

  teardown
}

# --- Test 6: No planning topic in manifest ---
test_no_topic() {
  setup
  local wu_dir="$TEST_DIR/.workflows/orphan"
  mkdir -p "$wu_dir/planning/orphan"

  cat > "$wu_dir/manifest.json" << 'MANIFEST'
{
  "name": "orphan",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {}
}
MANIFEST

  cat > "$wu_dir/planning/orphan/planning.md" << 'PLAN'
# Plan: Orphan

### Phase 1: Only
status: approved
external_id: tick-p1

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| orphan-1-1  | Task | none | authored | tick-t1 |
PLAN

  source "$MIGRATION"

  # Should not crash — just skip since topic doesn't exist in manifest
  local has_task_map=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!((m.phases.planning || {}).items || {}).orphan);
  ")

  assert_eq "no topic: skipped gracefully" "false" "$has_task_map"

  teardown
}

# --- Test 7: Cache move carries dot-prefixed files (glob no longer skips them) ---
# The old unquoted glob skipped dotfiles but rm -rf deleted the source dir,
# losing them. The move must carry dotfiles too.
test_cache_migration_dotfiles() {
  setup
  local cache_old="$TEST_DIR/.workflows/.cache/planning/myapp/portal"
  mkdir -p "$cache_old"
  echo "scratch" > "$cache_old/phase-1.md"
  echo "hidden scratch" > "$cache_old/.notes"

  local wu_dir="$TEST_DIR/.workflows/myapp"
  mkdir -p "$wu_dir"
  echo '{"name":"myapp","work_type":"feature","status":"in-progress","phases":{}}' > "$wu_dir/manifest.json"

  source "$MIGRATION"

  local new_dir="$TEST_DIR/.workflows/.cache/myapp/planning/portal"
  assert_eq "cache: regular file moved" "true" "$([ -f "$new_dir/phase-1.md" ] && echo true || echo false)"
  assert_eq "cache: dotfile moved" "true" "$([ -f "$new_dir/.notes" ] && echo true || echo false)"
  assert_eq "cache: old dir removed" "false" "$([ -d "$TEST_DIR/.workflows/.cache/planning" ] && echo true || echo false)"

  teardown
}

# --- Test 8: A failed copy must not destroy the source cache ---
# When any cp fails, the source dir must be left intact rather than rm -rf'd.
test_cache_migration_copy_failure_preserves_source() {
  setup
  local cache_old="$TEST_DIR/.workflows/.cache/planning/myapp/portal"
  mkdir -p "$cache_old"
  echo "keep me" > "$cache_old/phase-1.md"
  echo "unreadable" > "$cache_old/locked.md"
  chmod 000 "$cache_old/locked.md"

  local wu_dir="$TEST_DIR/.workflows/myapp"
  mkdir -p "$wu_dir"
  echo '{"name":"myapp","work_type":"feature","status":"in-progress","phases":{}}' > "$wu_dir/manifest.json"

  source "$MIGRATION"

  assert_eq "source dir preserved on copy failure" "true" "$([ -d "$cache_old" ] && echo true || echo false)"
  assert_eq "readable file still in source" "true" "$([ -f "$cache_old/phase-1.md" ] && echo true || echo false)"

  chmod 644 "$cache_old/locked.md" 2>/dev/null || true
  teardown
}

# --- Run all tests ---
echo "Running migration 029 tests..."
echo ""

test_single_phase
test_empty_external_ids
test_multi_phase
test_idempotent
test_cache_migration
test_no_topic
test_cache_migration_dotfiles
test_cache_migration_copy_failure_preserves_source

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
