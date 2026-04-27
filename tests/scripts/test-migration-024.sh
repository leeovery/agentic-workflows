#!/bin/bash
#
# Tests for migration 024: backfill-and-flatten-review
#
# Run: bash tests/scripts/test-migration-024.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/024-backfill-and-flatten-review.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-024-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

create_manifest() {
  local name="$1"
  local content="$2"
  mkdir -p "$TEST_DIR/.workflows/$name"
  echo "$content" > "$TEST_DIR/.workflows/$name/manifest.json"
}

create_implementation_file() {
  local wu="$1"
  local topic="$2"
  local content="$3"
  mkdir -p "$TEST_DIR/.workflows/$wu/implementation/$topic"
  printf '%s' "$content" > "$TEST_DIR/.workflows/$wu/implementation/$topic/implementation.md"
}

create_plan_file() {
  local wu="$1"
  local topic="$2"
  local content="$3"
  mkdir -p "$TEST_DIR/.workflows/$wu/planning/$topic"
  printf '%s' "$content" > "$TEST_DIR/.workflows/$wu/planning/$topic/planning.md"
}

create_review_file() {
  local wu="$1"
  local topic="$2"
  local subdir="$3"
  local filename="$4"
  local content="${5:-# review content}"
  mkdir -p "$TEST_DIR/.workflows/$wu/review/$topic/$subdir"
  echo "$content" > "$TEST_DIR/.workflows/$wu/review/$topic/$subdir/$filename"
}

get_field() {
  local name="$1"
  local field="$2"
  node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const parts = process.argv[2].split('.');
    let v = m;
    for (const p of parts) v = (v || {})[p];
    console.log(v === undefined ? 'undefined' : (typeof v === 'object' ? JSON.stringify(v) : v));
  " "$TEST_DIR/.workflows/$name/manifest.json" "$field"
}

get_json() {
  local name="$1"
  cat "$TEST_DIR/.workflows/$name/manifest.json"
}

run_migration() {
  cd "$TEST_DIR"
  bash "$MIGRATION" 2>&1
}

# --- Test 1: Backfills completed_tasks from inline YAML array ---
test_backfill_inline_array() {
  setup

  create_manifest "my-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
  create_implementation_file "my-feat" "my-feat" '---
completed_tasks: [my-feat-1-1, my-feat-1-2, my-feat-2-1]
completed_phases: [1, 2]
---
# Implementation
'

  run_migration > /dev/null

  assert_eq "completed_tasks backfilled from inline array" '["my-feat-1-1","my-feat-1-2","my-feat-2-1"]' "$(get_field "my-feat" "phases.implementation.completed_tasks")"
  assert_eq "completed_phases backfilled" '[1,2]' "$(get_field "my-feat" "phases.implementation.completed_phases")"

  teardown
}

# --- Test 2: Backfills completed_tasks from multi-line YAML list ---
test_backfill_multiline() {
  setup

  create_manifest "ml-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
  create_implementation_file "ml-feat" "ml-feat" '---
completed_tasks:
  - ml-feat-1-1
  - ml-feat-1-2
  - ml-feat-2-1
completed_phases:
  - 1
  - 2
---
# Implementation
'

  run_migration > /dev/null

  assert_eq "completed_tasks backfilled from multi-line list" '["ml-feat-1-1","ml-feat-1-2","ml-feat-2-1"]' "$(get_field "ml-feat" "phases.implementation.completed_tasks")"
  assert_eq "completed_phases backfilled from multi-line list" '[1,2]' "$(get_field "ml-feat" "phases.implementation.completed_phases")"

  teardown
}

# --- Test 3: Does not overwrite existing completed_tasks ---
test_no_overwrite_existing() {
  setup

  create_manifest "existing" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {
      "completed_tasks": ["existing-1-1"],
      "completed_phases": [1]
    }
  }
}'
  create_implementation_file "existing" "existing" '---
completed_tasks: [existing-1-1, existing-1-2, existing-2-1]
completed_phases: [1, 2]
---
# Implementation
'

  run_migration > /dev/null

  assert_eq "existing completed_tasks not overwritten" '["existing-1-1"]' "$(get_field "existing" "phases.implementation.completed_tasks")"
  assert_eq "existing completed_phases not overwritten" '[1]' "$(get_field "existing" "phases.implementation.completed_phases")"

  teardown
}

# --- Test 4: Backfills epic items separately ---
test_backfill_epic_items() {
  setup

  create_manifest "my-epic" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "implementation": {
      "items": {
        "auth": {},
        "billing": {}
      }
    }
  }
}'
  create_implementation_file "my-epic" "auth" '---
completed_tasks: [auth-1-1, auth-1-2]
completed_phases: [1]
---
# Auth Implementation
'
  create_implementation_file "my-epic" "billing" '---
completed_tasks: [billing-1-1]
completed_phases: [1]
---
# Billing Implementation
'

  run_migration > /dev/null

  assert_eq "epic auth item backfilled" '["auth-1-1","auth-1-2"]' "$(get_field "my-epic" "phases.implementation.items.auth.completed_tasks")"
  assert_eq "epic auth phases backfilled" '[1]' "$(get_field "my-epic" "phases.implementation.items.auth.completed_phases")"
  assert_eq "epic billing item backfilled" '["billing-1-1"]' "$(get_field "my-epic" "phases.implementation.items.billing.completed_tasks")"

  teardown
}

# --- Test 5: Skips work units with no implementation phase ---
test_skips_no_implementation() {
  setup

  create_manifest "no-impl" '{
  "work_type": "bugfix",
  "status": "in-progress",
  "phases": {
    "investigation": {"status": "in-progress"}
  }
}'

  run_migration > /dev/null

  teardown
}

# --- Test 6: Normalises tick IDs to internal IDs via plan table ---
test_normalise_tick_ids() {
  setup

  create_manifest "tick-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
  create_implementation_file "tick-feat" "tick-feat" '---
completed_tasks: [tick-abc123, tick-def456]
completed_phases: [1]
---
# Implementation
'
  create_plan_file "tick-feat" "tick-feat" '# Plan: Tick Feat

### Phase 1: Core
status: approved
ext_id: tick-parent1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| tick-feat-1-1 | First Task | none | authored | tick-abc123 |
| tick-feat-1-2 | Second Task | none | authored | tick-def456 |
'

  run_migration > /dev/null

  assert_eq "tick IDs normalised to internal IDs" '["tick-feat-1-1","tick-feat-1-2"]' "$(get_field "tick-feat" "phases.implementation.completed_tasks")"

  teardown
}

# --- Test 7: Leaves internal IDs unchanged when no ext map match ---
test_internal_ids_unchanged() {
  setup

  create_manifest "internal-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
  create_implementation_file "internal-feat" "internal-feat" '---
completed_tasks: [internal-feat-1-1, internal-feat-1-2]
completed_phases: [1]
---
# Implementation
'
  create_plan_file "internal-feat" "internal-feat" '# Plan: Internal Feat

### Phase 1: Core
status: approved
ext_id:

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| internal-feat-1-1 | First Task | none | authored | |
| internal-feat-1-2 | Second Task | none | authored | |
'

  run_migration > /dev/null

  assert_eq "internal IDs left unchanged" '["internal-feat-1-1","internal-feat-1-2"]' "$(get_field "internal-feat" "phases.implementation.completed_tasks")"

  teardown
}

# --- Test 8: Normalises with already-renamed External ID column ---
test_normalise_renamed_column() {
  setup

  create_manifest "renamed-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "implementation": {}
  }
}'
  create_implementation_file "renamed-feat" "renamed-feat" '---
completed_tasks: [tick-aaa, tick-bbb]
completed_phases: [1]
---
# Implementation
'
  create_plan_file "renamed-feat" "renamed-feat" '# Plan: Renamed Feat

### Phase 1: Core
status: approved
external_id: tick-parent1

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| renamed-feat-1-1 | First Task | none | authored | tick-aaa |
| renamed-feat-1-2 | Second Task | none | authored | tick-bbb |
'

  run_migration > /dev/null

  assert_eq "normalisation works with already-renamed columns" '["renamed-feat-1-1","renamed-feat-1-2"]' "$(get_field "renamed-feat" "phases.implementation.completed_tasks")"

  teardown
}

# --- Test 9: Flattens r1/ directory ---
test_flatten_r1() {
  setup

  create_manifest "single-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
  create_review_file "single-review" "single-review" "r1" "review.md" "# Review v1"
  create_review_file "single-review" "single-review" "r1" "qa-task-1.md" "# QA 1"

  run_migration > /dev/null

  assert_eq "review.md moved up" "true" "$([ -f "$TEST_DIR/.workflows/single-review/review/single-review/review.md" ] && echo true || echo false)"
  assert_eq "qa-task-1.md moved up" "true" "$([ -f "$TEST_DIR/.workflows/single-review/review/single-review/qa-task-1.md" ] && echo true || echo false)"
  assert_eq "r1/ removed" "false" "$([ -d "$TEST_DIR/.workflows/single-review/review/single-review/r1" ] && echo true || echo false)"

  teardown
}

# --- Test 10: Keeps highest r{N} when multiple exist ---
test_flatten_keeps_highest() {
  setup

  create_manifest "multi-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
  create_review_file "multi-review" "multi-review" "r1" "review.md" "# Review v1"
  create_review_file "multi-review" "multi-review" "r1" "qa-task-1.md" "# QA old"
  create_review_file "multi-review" "multi-review" "r2" "review.md" "# Review v2"
  create_review_file "multi-review" "multi-review" "r2" "qa-task-1.md" "# QA new"
  create_review_file "multi-review" "multi-review" "r2" "qa-task-2.md" "# QA 2 new"

  run_migration > /dev/null

  local review_content
  review_content=$(cat "$TEST_DIR/.workflows/multi-review/review/multi-review/review.md")
  assert_eq "kept r2 content (not r1)" "# Review v2" "$review_content"
  assert_eq "r2 qa-task-2.md present" "true" "$([ -f "$TEST_DIR/.workflows/multi-review/review/multi-review/qa-task-2.md" ] && echo true || echo false)"
  assert_eq "r1/ removed" "false" "$([ -d "$TEST_DIR/.workflows/multi-review/review/multi-review/r1" ] && echo true || echo false)"
  assert_eq "r2/ removed" "false" "$([ -d "$TEST_DIR/.workflows/multi-review/review/multi-review/r2" ] && echo true || echo false)"

  teardown
}

# --- Test 11: Skips already-flat review directories ---
test_skips_flat_review() {
  setup

  create_manifest "flat-review" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"review": {}}
}'
  mkdir -p "$TEST_DIR/.workflows/flat-review/review/flat-review"
  echo "# Review" > "$TEST_DIR/.workflows/flat-review/review/flat-review/review.md"

  run_migration > /dev/null

  assert_eq "flat review unchanged" "true" "$([ -f "$TEST_DIR/.workflows/flat-review/review/flat-review/review.md" ] && echo true || echo false)"

  teardown
}

# --- Test 12: Flattens epic review directories per topic ---
test_flatten_epic_reviews() {
  setup

  create_manifest "epic-review" '{
  "work_type": "epic",
  "status": "in-progress",
  "phases": {"review": {"items": {"auth": {}, "billing": {}}}}
}'
  create_review_file "epic-review" "auth" "r1" "review.md" "# Auth review"
  create_review_file "epic-review" "auth" "r1" "qa-task-1.md" "# Auth QA"
  create_review_file "epic-review" "billing" "r1" "review.md" "# Billing review"
  create_review_file "epic-review" "billing" "r2" "review.md" "# Billing review v2"

  run_migration > /dev/null

  assert_eq "auth review flattened" "true" "$([ -f "$TEST_DIR/.workflows/epic-review/review/auth/review.md" ] && echo true || echo false)"
  assert_eq "auth r1/ removed" "false" "$([ -d "$TEST_DIR/.workflows/epic-review/review/auth/r1" ] && echo true || echo false)"
  local billing_content
  billing_content=$(cat "$TEST_DIR/.workflows/epic-review/review/billing/review.md")
  assert_eq "billing kept r2 content" "# Billing review v2" "$billing_content"
  assert_eq "billing r1/ removed" "false" "$([ -d "$TEST_DIR/.workflows/epic-review/review/billing/r1" ] && echo true || echo false)"
  assert_eq "billing r2/ removed" "false" "$([ -d "$TEST_DIR/.workflows/epic-review/review/billing/r2" ] && echo true || echo false)"

  teardown
}

# --- Test 13: Renames ext_id in manifest JSON ---
test_rename_ext_id_manifest() {
  setup

  create_manifest "ext-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "ext_id": "tick-parent1",
      "status": "completed"
    }
  }
}'

  run_migration > /dev/null

  assert_eq "ext_id renamed to external_id in manifest" "tick-parent1" "$(get_field "ext-feat" "phases.planning.external_id")"
  assert_eq "old ext_id removed" "undefined" "$(get_field "ext-feat" "phases.planning.ext_id")"

  teardown
}

# --- Test 14: Renames Ext ID in plan table headers and ext_id: in phase entries ---
test_rename_ext_id_plan() {
  setup

  create_manifest "plan-rename" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
  create_plan_file "plan-rename" "plan-rename" '# Plan: Plan Rename

### Phase 1: Core
status: approved
ext_id: tick-parent1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| plan-rename-1-1 | First Task | none | authored | tick-abc |
'

  run_migration > /dev/null

  local plan_content
  plan_content=$(cat "$TEST_DIR/.workflows/plan-rename/planning/plan-rename/planning.md")
  assert_eq "Ext ID renamed to External ID in table header" "true" "$(echo "$plan_content" | grep -qF 'External ID' && echo true || echo false)"
  assert_eq "no Ext ID remaining" "false" "$(echo "$plan_content" | grep -qF 'Ext ID' && echo true || echo false)"
  assert_eq "ext_id: renamed to external_id: in phase entry" "true" "$(echo "$plan_content" | grep -qF 'external_id:' && echo true || echo false)"
  assert_eq "no ext_id: remaining" "false" "$(echo "$plan_content" | grep -qF 'ext_id:' && echo true || echo false)"

  teardown
}

# --- Test 15: Skips manifest already using external_id ---
test_skips_already_external_id() {
  setup

  create_manifest "already-renamed" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "external_id": "tick-parent1",
      "status": "completed"
    }
  }
}'

  run_migration > /dev/null

  assert_eq "external_id preserved" "tick-parent1" "$(get_field "already-renamed" "phases.planning.external_id")"

  teardown
}

# --- Test 16: Renames | ID | to | Internal ID | in task table ---
test_rename_id_to_internal_id() {
  setup

  create_manifest "id-rename" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
  create_plan_file "id-rename" "id-rename" '# Plan: ID Rename

### Phase 1: Core
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| id-rename-1-1 | First Task | none | authored | |
'

  run_migration > /dev/null

  local plan_content
  plan_content=$(cat "$TEST_DIR/.workflows/id-rename/planning/id-rename/planning.md")
  assert_eq "ID renamed to Internal ID in header" "true" "$(echo "$plan_content" | grep -qF '| Internal ID |' && echo true || echo false)"
  assert_eq "separator widened for Internal ID" "true" "$(echo "$plan_content" | grep -qF '|-------------|' && echo true || echo false)"
  assert_eq "no | ID | remaining" "false" "$(echo "$plan_content" | grep -qF '| ID |' && echo true || echo false)"
  assert_eq "data rows unchanged" "true" "$(echo "$plan_content" | grep -qF '| id-rename-1-1 |' && echo true || echo false)"

  teardown
}

# --- Test 17: Skips plan already using Internal ID ---
test_skips_already_internal_id() {
  setup

  create_manifest "already-internal" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
  create_plan_file "already-internal" "already-internal" '# Plan: Already Internal

### Phase 1: Core
status: approved
external_id:

#### Tasks
| Internal ID | Name | Edge Cases | Status | External ID |
|-------------|------|------------|--------|-------------|
| already-internal-1-1 | First Task | none | authored | |
'

  run_migration > /dev/null

  teardown
}

# --- Test 18: Renames across multiple phases in same plan ---
test_rename_multiple_phases() {
  setup

  create_manifest "multi-phase" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {"planning": {}}
}'
  create_plan_file "multi-phase" "multi-phase" '# Plan: Multi Phase

### Phase 1: Foundation
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| multi-phase-1-1 | First | none | authored | |

### Phase 2: Features
status: approved
external_id:

#### Tasks
| ID | Name | Edge Cases | Status | External ID |
|----|------|------------|--------|-------------|
| multi-phase-2-1 | Second | none | authored | |
'

  run_migration > /dev/null

  local plan_content id_count old_id_count
  plan_content=$(cat "$TEST_DIR/.workflows/multi-phase/planning/multi-phase/planning.md")
  id_count=$(echo "$plan_content" | grep -c '| Internal ID |')
  assert_eq "both phase tables renamed" "2" "$id_count"
  old_id_count=$(echo "$plan_content" | grep -c '| ID |' || true)
  assert_eq "no | ID | remaining" "0" "$old_id_count"

  teardown
}

# --- Test 19: All steps run together on same work unit ---
test_all_steps_together() {
  setup

  create_manifest "full-feat" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {
      "ext_id": "tick-plan1"
    },
    "implementation": {},
    "review": {}
  }
}'
  create_implementation_file "full-feat" "full-feat" '---
completed_tasks: [tick-aaa, tick-bbb]
completed_phases: [1]
---
# Implementation
'
  create_plan_file "full-feat" "full-feat" '# Plan: Full Feat

### Phase 1: Core
status: approved
ext_id: tick-phase1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| full-feat-1-1 | First | none | authored | tick-aaa |
| full-feat-1-2 | Second | none | authored | tick-bbb |
'
  create_review_file "full-feat" "full-feat" "r1" "review.md" "# Old review"
  create_review_file "full-feat" "full-feat" "r2" "review.md" "# New review"

  run_migration > /dev/null

  # Step 1+2: backfill + normalise
  assert_eq "backfilled and normalised" '["full-feat-1-1","full-feat-1-2"]' "$(get_field "full-feat" "phases.implementation.completed_tasks")"
  assert_eq "phases backfilled" '[1]' "$(get_field "full-feat" "phases.implementation.completed_phases")"

  # Step 3: flatten
  local review_content
  review_content=$(cat "$TEST_DIR/.workflows/full-feat/review/full-feat/review.md")
  assert_eq "review flattened to r2" "# New review" "$review_content"
  assert_eq "r1/ removed" "false" "$([ -d "$TEST_DIR/.workflows/full-feat/review/full-feat/r1" ] && echo true || echo false)"
  assert_eq "r2/ removed" "false" "$([ -d "$TEST_DIR/.workflows/full-feat/review/full-feat/r2" ] && echo true || echo false)"

  # Step 4: ext_id rename
  assert_eq "manifest ext_id -> external_id" "tick-plan1" "$(get_field "full-feat" "phases.planning.external_id")"
  local plan_content
  plan_content=$(cat "$TEST_DIR/.workflows/full-feat/planning/full-feat/planning.md")
  assert_eq "plan table: Ext ID -> External ID" "true" "$(echo "$plan_content" | grep -qF 'External ID' && echo true || echo false)"
  assert_eq "plan phase: ext_id: -> external_id:" "true" "$(echo "$plan_content" | grep -qF 'external_id:' && echo true || echo false)"

  # Step 5: ID -> Internal ID
  assert_eq "plan table: ID -> Internal ID" "true" "$(echo "$plan_content" | grep -qF '| Internal ID |' && echo true || echo false)"
  assert_eq "no old | ID | remaining" "false" "$(echo "$plan_content" | grep -qF '| ID |' && echo true || echo false)"

  teardown
}

# --- Test 20: Skips dot-prefixed directories ---
test_skips_dot_dirs() {
  setup

  mkdir -p "$TEST_DIR/.workflows/.state"
  echo '{"phases":{"planning":{"ext_id":"old"}}}' > "$TEST_DIR/.workflows/.state/manifest.json"
  create_manifest "real" '{"work_type":"feature","status":"in-progress","phases":{"planning":{"ext_id":"tick-1"}}}'

  run_migration > /dev/null

  local dot_extid
  dot_extid=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).phases.planning.ext_id)" "$TEST_DIR/.workflows/.state/manifest.json")
  assert_eq "dot-dir manifest not touched" "old" "$dot_extid"
  assert_eq "real manifest updated" "tick-1" "$(get_field "real" "phases.planning.external_id")"

  teardown
}

# --- Test 21: Idempotent — running twice produces same result ---
test_idempotent() {
  setup

  create_manifest "idem" '{
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "planning": {"ext_id": "tick-plan"},
    "implementation": {},
    "review": {}
  }
}'
  create_implementation_file "idem" "idem" '---
completed_tasks: [tick-aaa]
completed_phases: [1]
---
# Implementation
'
  create_plan_file "idem" "idem" '# Plan

### Phase 1: Core
status: approved
ext_id: tick-p1

#### Tasks
| ID | Name | Edge Cases | Status | Ext ID |
|----|------|------------|--------|--------|
| idem-1-1 | First | none | authored | tick-aaa |
'
  create_review_file "idem" "idem" "r1" "review.md" "# Review"

  run_migration > /dev/null
  local before_manifest before_plan
  before_manifest=$(get_json "idem")
  before_plan=$(cat "$TEST_DIR/.workflows/idem/planning/idem/planning.md")
  run_migration > /dev/null
  local after_manifest after_plan
  after_manifest=$(get_json "idem")
  after_plan=$(cat "$TEST_DIR/.workflows/idem/planning/idem/planning.md")

  assert_eq "manifest unchanged on second run" "$before_manifest" "$after_manifest"
  assert_eq "plan file unchanged on second run" "$before_plan" "$after_plan"

  teardown
}

# --- Test 22: No .workflows directory — exits cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  run_migration > /dev/null

  teardown
}

# --- Run all tests ---
echo "Running migration 024 tests..."
echo ""

test_backfill_inline_array
test_backfill_multiline
test_no_overwrite_existing
test_backfill_epic_items
test_skips_no_implementation
test_normalise_tick_ids
test_internal_ids_unchanged
test_normalise_renamed_column
test_flatten_r1
test_flatten_keeps_highest
test_skips_flat_review
test_flatten_epic_reviews
test_rename_ext_id_manifest
test_rename_ext_id_plan
test_skips_already_external_id
test_rename_id_to_internal_id
test_skips_already_internal_id
test_rename_multiple_phases
test_all_steps_together
test_skips_dot_dirs
test_idempotent
test_no_workflows_dir

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
