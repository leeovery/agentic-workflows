#!/bin/bash
# Tests for migration 016: work-unit-restructure
# Run: bash tests/scripts/test-migration-016.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/016-work-unit-restructure.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-016-test.XXXXXX)
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: No .workflows directory — skip cleanly ---
test_no_workflows_dir() {
  setup
  rm -rf "$TEST_DIR/.workflows"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "no updates without .workflows dir" "false" "$([ -d "$TEST_DIR/.workflows" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Single feature — artifacts grouped correctly ---
test_single_feature() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/dark-mode"
  mkdir -p "$TEST_DIR/.workflows/planning/dark-mode"

  cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode

## Context

We need dark mode.
EOF

  cat > "$TEST_DIR/.workflows/specification/dark-mode/specification.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
type: feature
review_cycle: 1
---

# Specification: Dark Mode

## Requirements

Dark mode everywhere.
EOF

  cat > "$TEST_DIR/.workflows/planning/dark-mode/plan.md" << 'EOF'
---
topic: dark-mode
status: in-progress
work_type: feature
format: local-markdown
---

# Plan: Dark Mode

## Phases

Phase 1 here.
EOF

  mkdir -p "$TEST_DIR/.workflows/planning/dark-mode/tasks"
  echo "task 1" > "$TEST_DIR/.workflows/planning/dark-mode/tasks/task-1.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "manifest.json created" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/manifest.json" ] && echo true || echo false)"
  assert_eq "discussion moved as {name}.md" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/discussion/dark-mode.md" ] && echo true || echo false)"
  assert_eq "specification in topic subdir" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/specification/dark-mode/specification.md" ] && echo true || echo false)"
  assert_eq "plan.md renamed to planning.md in topic subdir" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/planning/dark-mode/planning.md" ] && echo true || echo false)"
  assert_eq "tasks directory in topic subdir" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/planning/dark-mode/tasks/task-1.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
  assert_eq "manifest has correct work_type" "true" "$(echo "$manifest" | grep -qF '"work_type": "feature"' && echo true || echo false)"
  assert_eq "manifest has correct name" "true" "$(echo "$manifest" | grep -qF '"name": "dark-mode"' && echo true || echo false)"
  assert_eq "manifest has active status" "true" "$(echo "$manifest" | grep -qF '"status": "active"' && echo true || echo false)"

  assert_eq "discussion phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/discussion" ] && echo true || echo false)"
  assert_eq "specification phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/specification" ] && echo true || echo false)"
  assert_eq "planning phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Single bugfix — investigation path handled ---
test_single_bugfix() {
  setup
  mkdir -p "$TEST_DIR/.workflows/investigation/login-timeout"

  cat > "$TEST_DIR/.workflows/investigation/login-timeout/investigation.md" << 'EOF'
---
topic: login-timeout
status: concluded
work_type: bugfix
date: 2026-02-01
---

# Investigation: Login Timeout

## Root Cause

Session expiry.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "manifest.json created" "true" "$([ -f "$TEST_DIR/.workflows/login-timeout/manifest.json" ] && echo true || echo false)"
  assert_eq "investigation moved as {name}.md" "true" "$([ -f "$TEST_DIR/.workflows/login-timeout/investigation/login-timeout.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/login-timeout/manifest.json")
  assert_eq "manifest has bugfix work_type" "true" "$(echo "$manifest" | grep -qF '"work_type": "bugfix"' && echo true || echo false)"
  assert_eq "manifest has investigation phase" "true" "$(echo "$manifest" | grep -qF '"investigation"' && echo true || echo false)"

  teardown
}

# --- Test 4: Multiple features — each gets own work unit ---
test_multiple_features() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"

  for topic in auth-flow dark-mode api-keys; do
    cat > "$TEST_DIR/.workflows/discussion/$topic.md" << EOF
---
topic: $topic
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: $topic
EOF
  done

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "auth-flow manifest created" "true" "$([ -f "$TEST_DIR/.workflows/auth-flow/manifest.json" ] && echo true || echo false)"
  assert_eq "dark-mode manifest created" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/manifest.json" ] && echo true || echo false)"
  assert_eq "api-keys manifest created" "true" "$([ -f "$TEST_DIR/.workflows/api-keys/manifest.json" ] && echo true || echo false)"

  assert_eq "auth-flow discussion moved" "true" "$([ -f "$TEST_DIR/.workflows/auth-flow/discussion/auth-flow.md" ] && echo true || echo false)"
  assert_eq "dark-mode discussion moved" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/discussion/dark-mode.md" ] && echo true || echo false)"
  assert_eq "api-keys discussion moved" "true" "$([ -f "$TEST_DIR/.workflows/api-keys/discussion/api-keys.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: Greenfield with multiple discussions — creates v1 epic ---
test_greenfield_epic() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"

  cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

  cat > "$TEST_DIR/.workflows/discussion/refund-handling.md" << 'EOF'
---
topic: refund-handling
status: in-progress
work_type: greenfield
date: 2026-01-12
---

# Discussion: Refund Handling
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "v1 epic manifest created" "true" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"
  assert_eq "epic discussion preserved name" "true" "$([ -f "$TEST_DIR/.workflows/v1/discussion/payment-processing.md" ] && echo true || echo false)"
  assert_eq "second epic discussion preserved" "true" "$([ -f "$TEST_DIR/.workflows/v1/discussion/refund-handling.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  assert_eq "greenfield mapped to epic" "true" "$(echo "$manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"

  teardown
}

# --- Test 6: Mixed (features + bugfix + greenfield) — correct classification ---
test_mixed_types() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/investigation/crash-fix"

  cat > "$TEST_DIR/.workflows/discussion/notifications.md" << 'EOF'
---
topic: notifications
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: Notifications
EOF

  cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

  cat > "$TEST_DIR/.workflows/investigation/crash-fix/investigation.md" << 'EOF'
---
topic: crash-fix
status: in-progress
work_type: bugfix
date: 2026-02-01
---

# Investigation: Crash Fix
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "feature work unit created" "true" "$([ -f "$TEST_DIR/.workflows/notifications/manifest.json" ] && echo true || echo false)"
  assert_eq "epic work unit created" "true" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"
  assert_eq "bugfix work unit created" "true" "$([ -f "$TEST_DIR/.workflows/crash-fix/manifest.json" ] && echo true || echo false)"

  feat_manifest=$(cat "$TEST_DIR/.workflows/notifications/manifest.json")
  epic_manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  bug_manifest=$(cat "$TEST_DIR/.workflows/crash-fix/manifest.json")

  assert_eq "notifications is feature" "true" "$(echo "$feat_manifest" | grep -qF '"work_type": "feature"' && echo true || echo false)"
  assert_eq "v1 is epic" "true" "$(echo "$epic_manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"
  assert_eq "crash-fix is bugfix" "true" "$(echo "$bug_manifest" | grep -qF '"work_type": "bugfix"' && echo true || echo false)"

  teardown
}

# --- Test 7: Idempotency — running twice produces same result ---
test_idempotency() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"

  cat > "$TEST_DIR/.workflows/discussion/idempotent-test.md" << 'EOF'
---
topic: idempotent-test
status: concluded
work_type: feature
date: 2026-01-01
---

# Discussion: Idempotent Test
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  first_manifest=$(cat "$TEST_DIR/.workflows/idempotent-test/manifest.json")
  first_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/idempotent-test.md")

  source "$MIGRATION"

  second_manifest=$(cat "$TEST_DIR/.workflows/idempotent-test/manifest.json")
  second_discussion=$(cat "$TEST_DIR/.workflows/idempotent-test/discussion/idempotent-test.md")

  assert_eq "Manifest unchanged on second run" "$first_manifest" "$second_manifest"
  assert_eq "Discussion unchanged on second run" "$first_discussion" "$second_discussion"

  teardown
}

# --- Test 8: Frontmatter preserved intact in migrated artifacts ---
test_frontmatter_preserved() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"

  cat > "$TEST_DIR/.workflows/discussion/preserved.md" << 'EOF'
---
topic: preserved
status: concluded
work_type: feature
date: 2026-03-01
research_source: exploration.md
---

# Discussion: Preserved

## Context

Content with special chars: "quotes", 'apostrophes', $variables.

---

## Section Two

More content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  content=$(cat "$TEST_DIR/.workflows/preserved/discussion/preserved.md")
  assert_eq "Frontmatter delimiters preserved" "true" "$(echo "$content" | grep -q '^---$' && echo true || echo false)"
  assert_eq "topic field preserved" "true" "$(echo "$content" | grep -q '^topic: preserved$' && echo true || echo false)"
  assert_eq "status field preserved" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"
  assert_eq "work_type field preserved" "true" "$(echo "$content" | grep -q '^work_type: feature$' && echo true || echo false)"
  assert_eq "Body content preserved" "true" "$(echo "$content" | grep -qF 'Content with special chars' && echo true || echo false)"
  assert_eq "Sections after --- preserved" "true" "$(echo "$content" | grep -qF '## Section Two' && echo true || echo false)"

  teardown
}

# --- Test 10: Manifest contains expected fields from frontmatter ---
test_manifest_fields() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/full-test"
  mkdir -p "$TEST_DIR/.workflows/planning/full-test"
  mkdir -p "$TEST_DIR/.workflows/planning/full-test/tasks"

  cat > "$TEST_DIR/.workflows/discussion/full-test.md" << 'EOF'
---
topic: full-test
status: concluded
work_type: feature
date: 2026-02-15
research_source: exploration.md
---

# Discussion: Full Test
EOF

  cat > "$TEST_DIR/.workflows/specification/full-test/specification.md" << 'EOF'
---
topic: full-test
status: concluded
work_type: feature
type: feature
review_cycle: 2
finding_gate_mode: auto
---

# Specification: Full Test
EOF

  cat > "$TEST_DIR/.workflows/planning/full-test/plan.md" << 'EOF'
---
topic: full-test
status: in-progress
work_type: feature
format: local-markdown
task_gate_mode: gated
finding_gate_mode: gated
author_gate_mode: auto
---

# Plan: Full Test
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  manifest=$(cat "$TEST_DIR/.workflows/full-test/manifest.json")

  assert_eq "discussion status in manifest" "true" "$(echo "$manifest" | grep -qF '"status": "concluded"' && echo true || echo false)"
  assert_eq "research_source in manifest" "true" "$(echo "$manifest" | grep -qF '"research_source": "exploration.md"' && echo true || echo false)"
  assert_eq "spec type in manifest" "true" "$(echo "$manifest" | grep -qF '"type": "feature"' && echo true || echo false)"
  assert_eq "review_cycle in manifest" "true" "$(echo "$manifest" | grep -qF '"review_cycle": 2' && echo true || echo false)"
  assert_eq "plan format in manifest" "true" "$(echo "$manifest" | grep -qF '"format": "local-markdown"' && echo true || echo false)"
  assert_eq "task_gate_mode in manifest" "true" "$(echo "$manifest" | grep -qF '"task_gate_mode": "gated"' && echo true || echo false)"
  assert_eq "author_gate_mode in manifest" "true" "$(echo "$manifest" | grep -qF '"author_gate_mode": "auto"' && echo true || echo false)"

  teardown
}

# --- Test 11: Empty phase directories cleaned up ---
test_empty_phase_dirs() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification"
  mkdir -p "$TEST_DIR/.workflows/planning"

  cat > "$TEST_DIR/.workflows/discussion/cleanup-test.md" << 'EOF'
---
topic: cleanup-test
status: in-progress
work_type: feature
date: 2026-01-01
---

# Discussion: Cleanup Test
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "empty discussion dir removed" "false" "$([ -d "$TEST_DIR/.workflows/discussion" ] && echo true || echo false)"
  assert_eq "empty specification dir removed" "false" "$([ -d "$TEST_DIR/.workflows/specification" ] && echo true || echo false)"
  assert_eq "empty planning dir removed" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"

  teardown
}

# --- Test 12: greenfield to epic mapping in manifest ---
test_greenfield_to_epic() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"

  cat > "$TEST_DIR/.workflows/discussion/epic-mapping.md" << 'EOF'
---
topic: epic-mapping
status: in-progress
work_type: greenfield
date: 2026-01-01
---

# Discussion: Epic Mapping
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  assert_eq "greenfield mapped to epic in manifest" "true" "$(echo "$manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"
  assert_eq "no greenfield reference in manifest" "false" "$(echo "$manifest" | grep -qF '"greenfield"' && echo true || echo false)"

  teardown
}

# --- Test 13: Implementation tracking.md to implementation.md rename ---
test_tracking_rename() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/implementation/impl-rename"

  cat > "$TEST_DIR/.workflows/discussion/impl-rename.md" << 'EOF'
---
topic: impl-rename
status: concluded
work_type: feature
date: 2026-01-01
---

# Discussion
EOF

  cat > "$TEST_DIR/.workflows/implementation/impl-rename/tracking.md" << 'EOF'
---
topic: impl-rename
status: in-progress
work_type: feature
format: local-markdown
task_gate_mode: gated
fix_gate_mode: gated
---

# Implementation: Impl Rename

## Progress

Some progress here.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "tracking.md renamed to implementation.md in topic subdir" "true" "$([ -f "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/implementation.md" ] && echo true || echo false)"
  assert_eq "old tracking.md not present" "false" "$([ -f "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/tracking.md" ] && echo true || echo false)"

  content=$(cat "$TEST_DIR/.workflows/impl-rename/implementation/impl-rename/implementation.md")
  assert_eq "implementation content preserved" "true" "$(echo "$content" | grep -qF 'Some progress here' && echo true || echo false)"

  teardown
}

# --- Test 14: Research with Discussion-ready marker ---
test_research_discussion_ready() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/research"

  cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

  cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research: Exploration

Some research content here.

> **Discussion-ready**: The data model approach is well-understood. Key decisions around normalization are ready for discussion.

More content after the marker.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  research_status=$(node -e "var m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
  assert_eq "research with Discussion-ready marker gets concluded status" "concluded" "$research_status"

  teardown
}

# --- Test 15: Research without Discussion-ready marker ---
test_research_no_marker() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/research"

  cat > "$TEST_DIR/.workflows/discussion/api-design.md" << 'EOF'
---
topic: api-design
status: in-progress
work_type: greenfield
date: 2026-01-08
---

# Discussion: API Design
EOF

  cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research: Exploration

Some research content here. Still exploring options.
No discussion-ready marker in this file.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  research_status=$(node -e "var m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
  assert_eq "research concluded when later phases (discussion) exist" "concluded" "$research_status"

  teardown
}

# --- Test 16: Epic with spec/plan/impl/review — all phases migrated ---
test_epic_all_phases() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/payment-processing"
  mkdir -p "$TEST_DIR/.workflows/planning/payment-processing/tasks"
  mkdir -p "$TEST_DIR/.workflows/implementation/payment-processing"
  mkdir -p "$TEST_DIR/.workflows/review/payment-processing/r1"

  cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

  cat > "$TEST_DIR/.workflows/specification/payment-processing/specification.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
type: feature
review_cycle: 1
finding_gate_mode: gated
---

# Specification: Payment Processing
EOF

  cat > "$TEST_DIR/.workflows/planning/payment-processing/plan.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
format: local-markdown
task_gate_mode: gated
author_gate_mode: auto
---

# Plan: Payment Processing
EOF

  echo "task content" > "$TEST_DIR/.workflows/planning/payment-processing/tasks/task-1.md"

  cat > "$TEST_DIR/.workflows/implementation/payment-processing/tracking.md" << 'EOF'
---
topic: payment-processing
status: in-progress
work_type: greenfield
format: local-markdown
task_gate_mode: gated
fix_gate_mode: gated
analysis_cycle: 2
current_phase: phase-1
current_task: task-3
---

# Implementation: Payment Processing
EOF

  echo "review content" > "$TEST_DIR/.workflows/review/payment-processing/r1/review.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "v1 manifest created" "true" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"
  assert_eq "epic discussion moved" "true" "$([ -f "$TEST_DIR/.workflows/v1/discussion/payment-processing.md" ] && echo true || echo false)"
  assert_eq "epic spec moved to topic subdir" "true" "$([ -f "$TEST_DIR/.workflows/v1/specification/payment-processing/specification.md" ] && echo true || echo false)"
  assert_eq "epic plan.md renamed to planning.md" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/payment-processing/planning.md" ] && echo true || echo false)"
  assert_eq "epic tasks dir moved" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/payment-processing/tasks/task-1.md" ] && echo true || echo false)"
  assert_eq "epic tracking.md renamed to implementation.md" "true" "$([ -f "$TEST_DIR/.workflows/v1/implementation/payment-processing/implementation.md" ] && echo true || echo false)"
  assert_eq "epic review moved" "true" "$([ -f "$TEST_DIR/.workflows/v1/review/payment-processing/r1/review.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  assert_eq "manifest has epic work_type" "true" "$(echo "$manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"

  spec_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var s=m.phases.specification; console.log(s && s.items && s.items['payment-processing'] ? s.items['payment-processing'].status : 'missing')")
  assert_eq "manifest spec items has correct status" "concluded" "$spec_status"

  spec_type=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var s=m.phases.specification; console.log(s && s.items && s.items['payment-processing'] ? s.items['payment-processing'].type : 'missing')")
  assert_eq "manifest spec items has type field" "feature" "$spec_type"

  plan_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var p=m.phases.planning; console.log(p && p.items && p.items['payment-processing'] ? p.items['payment-processing'].status : 'missing')")
  assert_eq "manifest plan items has correct status" "concluded" "$plan_status"

  plan_format=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var p=m.phases.planning; console.log(p && p.items && p.items['payment-processing'] ? p.items['payment-processing'].format : 'missing')")
  assert_eq "manifest plan items has format field" "local-markdown" "$plan_format"

  impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var i=m.phases.implementation; console.log(i && i.items && i.items['payment-processing'] ? i.items['payment-processing'].status : 'missing')")
  assert_eq "manifest impl items has correct status" "in-progress" "$impl_status"

  impl_cycle=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var i=m.phases.implementation; console.log(i && i.items && i.items['payment-processing'] ? i.items['payment-processing'].analysis_cycle : 'missing')")
  assert_eq "manifest impl items has analysis_cycle field" "2" "$impl_cycle"

  review_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var r=m.phases.review; console.log(r && r.items && r.items['payment-processing'] ? r.items['payment-processing'].status : 'missing')")
  assert_eq "manifest review items has completed status" "completed" "$review_status"

  assert_eq "discussion phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/discussion" ] && echo true || echo false)"
  assert_eq "spec phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/specification" ] && echo true || echo false)"
  assert_eq "planning phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"
  assert_eq "impl phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/implementation" ] && echo true || echo false)"
  assert_eq "review phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/review" ] && echo true || echo false)"

  teardown
}

# --- Test 17: discussion-consolidation-analysis.md moved to v1/.state/ ---
test_state_file_moved() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/.state"

  cat > "$TEST_DIR/.workflows/discussion/some-topic.md" << 'EOF'
---
topic: some-topic
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Some Topic
EOF

  echo "consolidation analysis content" > "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "discussion-consolidation-analysis.md moved to v1/.state/" "true" "$([ -f "$TEST_DIR/.workflows/v1/.state/discussion-consolidation-analysis.md" ] && echo true || echo false)"
  assert_eq "original state file removed" "false" "$([ -f "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md" ] && echo true || echo false)"

  content=$(cat "$TEST_DIR/.workflows/v1/.state/discussion-consolidation-analysis.md")
  assert_eq "state file content preserved" "true" "$(echo "$content" | grep -qF 'consolidation analysis content' && echo true || echo false)"

  teardown
}

# --- Test 18: Unmatched review topic routes to v1 ---
test_unmatched_review() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/review/doctor-installation-migration/r1"

  cat > "$TEST_DIR/.workflows/discussion/data-model.md" << 'EOF'
---
topic: data-model
status: concluded
work_type: greenfield
date: 2026-01-05
---

# Discussion: Data Model
EOF

  echo "review findings" > "$TEST_DIR/.workflows/review/doctor-installation-migration/r1/review.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "unmatched review topic moved to v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/review/doctor-installation-migration/r1/review.md" ] && echo true || echo false)"
  assert_eq "review phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/review" ] && echo true || echo false)"

  teardown
}

# --- Test 19: Mixed feature + epic with all phases ---
test_mixed_feature_epic() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/dark-mode"
  mkdir -p "$TEST_DIR/.workflows/specification/payment-processing"
  mkdir -p "$TEST_DIR/.workflows/planning/payment-processing/tasks"

  cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode
EOF

  cat > "$TEST_DIR/.workflows/specification/dark-mode/specification.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
type: feature
---

# Specification: Dark Mode
EOF

  cat > "$TEST_DIR/.workflows/discussion/payment-processing.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Payment Processing
EOF

  cat > "$TEST_DIR/.workflows/specification/payment-processing/specification.md" << 'EOF'
---
topic: payment-processing
status: concluded
work_type: greenfield
type: feature
---

# Specification: Payment Processing
EOF

  cat > "$TEST_DIR/.workflows/planning/payment-processing/plan.md" << 'EOF'
---
topic: payment-processing
status: in-progress
work_type: greenfield
format: local-markdown
---

# Plan: Payment Processing
EOF

  echo "task content" > "$TEST_DIR/.workflows/planning/payment-processing/tasks/task-1.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "feature manifest created" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/manifest.json" ] && echo true || echo false)"
  assert_eq "feature spec in own work unit" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/specification/dark-mode/specification.md" ] && echo true || echo false)"
  assert_eq "v1 epic manifest created" "true" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"
  assert_eq "epic spec in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/specification/payment-processing/specification.md" ] && echo true || echo false)"
  assert_eq "epic plan in v1 (renamed)" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/payment-processing/planning.md" ] && echo true || echo false)"
  assert_eq "epic tasks in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/payment-processing/tasks/task-1.md" ] && echo true || echo false)"

  feat_manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
  epic_manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  assert_eq "dark-mode is feature" "true" "$(echo "$feat_manifest" | grep -qF '"work_type": "feature"' && echo true || echo false)"
  assert_eq "v1 is epic" "true" "$(echo "$epic_manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"

  assert_eq "discussion phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/discussion" ] && echo true || echo false)"
  assert_eq "spec phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/specification" ] && echo true || echo false)"
  assert_eq "planning phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"

  teardown
}

# --- Test 20: Epic with multiple topics across phases ---
test_epic_multiple_topics() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/auth-flow"
  mkdir -p "$TEST_DIR/.workflows/specification/billing"
  mkdir -p "$TEST_DIR/.workflows/planning/auth-flow/tasks"
  mkdir -p "$TEST_DIR/.workflows/implementation/auth-flow"

  cat > "$TEST_DIR/.workflows/discussion/auth-flow.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/discussion/billing.md" << 'EOF'
---
topic: billing
status: in-progress
work_type: greenfield
date: 2026-01-12
---

# Discussion: Billing
EOF

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
type: feature
review_cycle: 2
---

# Specification: Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/specification/billing/specification.md" << 'EOF'
---
topic: billing
status: in-progress
work_type: greenfield
type: feature
---

# Specification: Billing
EOF

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: greenfield
format: local-markdown
---

# Plan: Auth Flow
EOF

  echo "task content" > "$TEST_DIR/.workflows/planning/auth-flow/tasks/task-1.md"

  cat > "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" << 'EOF'
---
topic: auth-flow
status: in-progress
work_type: greenfield
format: local-markdown
current_phase: phase-1
---

# Implementation: Auth Flow
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "auth-flow spec in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/specification/auth-flow/specification.md" ] && echo true || echo false)"
  assert_eq "billing spec in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/specification/billing/specification.md" ] && echo true || echo false)"
  assert_eq "auth-flow plan renamed in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/auth-flow/planning.md" ] && echo true || echo false)"
  assert_eq "auth-flow tasks in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/planning/auth-flow/tasks/task-1.md" ] && echo true || echo false)"
  assert_eq "auth-flow impl renamed in v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/implementation/auth-flow/implementation.md" ] && echo true || echo false)"

  auth_spec=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification && m.phases.specification.items && m.phases.specification.items['auth-flow'] ? m.phases.specification.items['auth-flow'].status : 'missing')")
  billing_spec=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification && m.phases.specification.items && m.phases.specification.items['billing'] ? m.phases.specification.items['billing'].status : 'missing')")
  auth_plan=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning && m.phases.planning.items && m.phases.planning.items['auth-flow'] ? m.phases.planning.items['auth-flow'].status : 'missing')")
  billing_plan=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning && m.phases.planning.items ? (m.phases.planning.items['billing'] ? 'found' : 'absent') : 'no-items')")

  assert_eq "manifest spec items: auth-flow concluded" "concluded" "$auth_spec"
  assert_eq "manifest spec items: billing in-progress" "in-progress" "$billing_spec"
  assert_eq "manifest plan items: auth-flow concluded" "concluded" "$auth_plan"
  assert_eq "manifest plan items: billing absent (no plan)" "absent" "$billing_plan"

  assert_eq "spec phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/specification" ] && echo true || echo false)"
  assert_eq "planning phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"
  assert_eq "impl phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/implementation" ] && echo true || echo false)"

  teardown
}

# --- Test 21: Feature with review — manifest has review phase ---
test_feature_with_review() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/review/dark-mode/r1"

  cat > "$TEST_DIR/.workflows/discussion/dark-mode.md" << 'EOF'
---
topic: dark-mode
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Dark Mode
EOF

  echo "review findings" > "$TEST_DIR/.workflows/review/dark-mode/r1/review.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "feature review moved" "true" "$([ -f "$TEST_DIR/.workflows/dark-mode/review/dark-mode/r1/review.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
  assert_eq "manifest has review phase" "true" "$(echo "$manifest" | grep -qF '"review"' && echo true || echo false)"
  assert_eq "manifest review status is completed" "true" "$(echo "$manifest" | grep -qF '"status": "completed"' && echo true || echo false)"

  teardown
}

# --- Test 22: research-analysis.md moves to v1/.state/ (regression) ---
test_research_analysis_state() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/.state"

  cat > "$TEST_DIR/.workflows/discussion/some-topic.md" << 'EOF'
---
topic: some-topic
status: concluded
work_type: greenfield
date: 2026-01-10
---

# Discussion: Some Topic
EOF

  echo "research analysis content" > "$TEST_DIR/.workflows/.state/research-analysis.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "research-analysis.md moved to v1/.state/" "true" "$([ -f "$TEST_DIR/.workflows/v1/.state/research-analysis.md" ] && echo true || echo false)"
  assert_eq "original research-analysis.md removed" "false" "$([ -f "$TEST_DIR/.workflows/.state/research-analysis.md" ] && echo true || echo false)"

  content=$(cat "$TEST_DIR/.workflows/v1/.state/research-analysis.md")
  assert_eq "research-analysis.md content preserved" "true" "$(echo "$content" | grep -qF 'research analysis content' && echo true || echo false)"

  teardown
}

# --- Test 23: Review-only triggers v1 (no discussion needed) ---
test_review_only_v1() {
  setup
  mkdir -p "$TEST_DIR/.workflows/review/orphan-topic/r1"

  echo "review findings" > "$TEST_DIR/.workflows/review/orphan-topic/r1/review.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "v1 created from review-only" "true" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"
  assert_eq "review-only topic moved to v1" "true" "$([ -f "$TEST_DIR/.workflows/v1/review/orphan-topic/r1/review.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/v1/manifest.json")
  assert_eq "v1 is epic" "true" "$(echo "$manifest" | grep -qF '"work_type": "epic"' && echo true || echo false)"

  review_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); var r=m.phases.review; console.log(r && r.items && r.items['orphan-topic'] ? r.items['orphan-topic'].status : 'missing')")
  assert_eq "review-only topic in manifest items" "completed" "$review_status"

  assert_eq "review phase dir cleaned up" "false" "$([ -d "$TEST_DIR/.workflows/review" ] && echo true || echo false)"

  teardown
}

# --- Test 24: Implementation without work_type falls back to prior registration ---
test_impl_no_worktype_feature() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/auth-flow"
  mkdir -p "$TEST_DIR/.workflows/planning/auth-flow"
  mkdir -p "$TEST_DIR/.workflows/implementation/auth-flow"

  cat > "$TEST_DIR/.workflows/discussion/auth-flow.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
date: 2026-01-15
---

# Discussion: Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/specification/auth-flow/specification.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
type: feature
---

# Specification: Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/planning/auth-flow/plan.md" << 'EOF'
---
topic: auth-flow
status: concluded
work_type: feature
format: tick
ext_id: tick-abc123
---

# Plan: Auth Flow
EOF

  cat > "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" << 'EOF'
---
topic: auth-flow
status: completed
format: tick
task_gate_mode: auto
fix_gate_mode: gated
fix_attempts: 0
analysis_cycle: 2
current_phase: 3
current_task: ~
---

# Implementation: Auth Flow
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "manifest created" "true" "$([ -f "$TEST_DIR/.workflows/auth-flow/manifest.json" ] && echo true || echo false)"
  assert_eq "implementation moved to feature work unit" "true" "$([ -f "$TEST_DIR/.workflows/auth-flow/implementation/auth-flow/implementation.md" ] && echo true || echo false)"
  assert_eq "old implementation file removed" "false" "$([ -f "$TEST_DIR/.workflows/implementation/auth-flow/tracking.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/auth-flow/manifest.json")
  assert_eq "work unit is feature" "true" "$(echo "$manifest" | grep -qF '"work_type": "feature"' && echo true || echo false)"

  impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/auth-flow/manifest.json','utf8')); console.log(m.phases.implementation ? m.phases.implementation.status : 'missing')")
  assert_eq "implementation status in manifest" "completed" "$impl_status"

  assert_eq "no v1 epic created" "false" "$([ -f "$TEST_DIR/.workflows/v1/manifest.json" ] && echo true || echo false)"

  teardown
}

# --- Test 25: Implementation without work_type — bugfix falls back correctly ---
test_impl_no_worktype_bugfix() {
  setup
  mkdir -p "$TEST_DIR/.workflows/investigation/fix-crash"
  mkdir -p "$TEST_DIR/.workflows/specification/fix-crash"
  mkdir -p "$TEST_DIR/.workflows/planning/fix-crash"
  mkdir -p "$TEST_DIR/.workflows/implementation/fix-crash"

  cat > "$TEST_DIR/.workflows/investigation/fix-crash/investigation.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
---

# Investigation: Fix Crash
EOF

  cat > "$TEST_DIR/.workflows/specification/fix-crash/specification.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
type: feature
---

# Specification: Fix Crash
EOF

  cat > "$TEST_DIR/.workflows/planning/fix-crash/plan.md" << 'EOF'
---
topic: fix-crash
status: concluded
work_type: bugfix
format: local-markdown
---

# Plan: Fix Crash
EOF

  cat > "$TEST_DIR/.workflows/implementation/fix-crash/tracking.md" << 'EOF'
---
topic: fix-crash
status: completed
format: local-markdown
task_gate_mode: auto
---

# Implementation: Fix Crash
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "bugfix implementation moved to own work unit" "true" "$([ -f "$TEST_DIR/.workflows/fix-crash/implementation/fix-crash/implementation.md" ] && echo true || echo false)"

  manifest=$(cat "$TEST_DIR/.workflows/fix-crash/manifest.json")
  assert_eq "work unit is bugfix" "true" "$(echo "$manifest" | grep -qF '"work_type": "bugfix"' && echo true || echo false)"

  impl_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/fix-crash/manifest.json','utf8')); console.log(m.phases.implementation ? m.phases.implementation.status : 'missing')")
  assert_eq "implementation status in bugfix manifest" "completed" "$impl_status"

  teardown
}

# --- Test 26: Non-standard status values are normalized ---
test_status_normalization() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/widget"
  mkdir -p "$TEST_DIR/.workflows/planning/widget"

  cat > "$TEST_DIR/.workflows/discussion/widget.md" << 'EOF'
---
topic: widget
status: concluded
work_type: feature
---

# Discussion: Widget
EOF

  cat > "$TEST_DIR/.workflows/specification/widget/specification.md" << 'EOF'
---
topic: widget
status: concluded
work_type: feature
type: feature
---

# Specification: Widget
EOF

  cat > "$TEST_DIR/.workflows/planning/widget/plan.md" << 'EOF'
---
topic: widget
status: planning
work_type: feature
format: tick
---

# Plan: Widget
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  plan_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/widget/manifest.json','utf8')); console.log(m.phases.planning.status)")
  assert_eq "non-standard 'planning' status normalized to 'in-progress'" "in-progress" "$plan_status"

  teardown
}

# --- Test 27: Status normalization — completed/concluded crossover ---
test_status_crossover() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/crossover"

  cat > "$TEST_DIR/.workflows/discussion/crossover.md" << 'EOF'
---
topic: crossover
status: completed
work_type: feature
---

# Discussion: Crossover
EOF

  cat > "$TEST_DIR/.workflows/specification/crossover/specification.md" << 'EOF'
---
topic: crossover
status: completed
work_type: feature
type: feature
---

# Specification: Crossover
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  disc_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/crossover/manifest.json','utf8')); console.log(m.phases.discussion.status)")
  assert_eq "discussion 'completed' normalized to 'concluded'" "concluded" "$disc_status"

  spec_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/crossover/manifest.json','utf8')); console.log(m.phases.specification.status)")
  assert_eq "specification 'completed' normalized to 'concluded'" "concluded" "$spec_status"

  teardown
}

# --- Test 28: Research status inferred from later phases ---
test_research_inferred() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/research"

  cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research Exploration

Some research content without any Discussion-ready marker.
EOF

  cat > "$TEST_DIR/.workflows/discussion/topic-a.md" << 'EOF'
---
topic: topic-a
status: concluded
work_type: greenfield
---

# Discussion: Topic A
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  research_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
  assert_eq "research concluded when later phases exist" "concluded" "$research_status"

  teardown
}

# --- Test 29: Research status stays in-progress when no later phases ---
test_research_in_progress() {
  setup
  mkdir -p "$TEST_DIR/.workflows/research"

  cat > "$TEST_DIR/.workflows/research/exploration.md" << 'EOF'
# Research Exploration

Early research, nothing else exists yet.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  research_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.research ? m.phases.research.status : 'missing')")
  assert_eq "research stays in-progress when no later phases" "in-progress" "$research_status"

  phase_count=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(Object.keys(m.phases).length)")
  assert_eq "only research phase in manifest" "1" "$phase_count"

  teardown
}

# --- Test 30: Specification path references updated for new directory depth ---
test_spec_path_references() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/my-feature"
  mkdir -p "$TEST_DIR/.workflows/planning/my-feature"

  cat > "$TEST_DIR/.workflows/discussion/my-feature.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
---

# Discussion: My Feature
EOF

  cat > "$TEST_DIR/.workflows/specification/my-feature/specification.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
type: feature
---

# Specification: My Feature
EOF

  cat > "$TEST_DIR/.workflows/planning/my-feature/plan.md" << 'EOF'
---
topic: my-feature
status: concluded
work_type: feature
format: local-markdown
specification: ../specification/my-feature/specification.md
spec_commit: abc123
---

# Plan: My Feature
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  spec_ref=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/my-feature/manifest.json','utf8')); console.log(m.phases.planning.specification)")
  assert_eq "spec path gets extra ../ for new directory depth" "../../specification/my-feature/specification.md" "$spec_ref"

  resolved="$TEST_DIR/.workflows/my-feature/planning/my-feature/$spec_ref"
  assert_eq "spec path resolves to actual file" "true" "$([ -f "$(cd "$(dirname "$resolved")" && pwd)/$(basename "$resolved")" ] && echo true || echo false)"

  teardown
}

# --- Test 31: Epic spec path references also updated ---
test_epic_spec_path() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/billing"
  mkdir -p "$TEST_DIR/.workflows/planning/billing"

  cat > "$TEST_DIR/.workflows/discussion/billing.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
---

# Discussion: Billing
EOF

  cat > "$TEST_DIR/.workflows/specification/billing/specification.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
type: feature
---

# Specification: Billing
EOF

  cat > "$TEST_DIR/.workflows/planning/billing/plan.md" << 'EOF'
---
topic: billing
status: concluded
work_type: greenfield
format: tick
ext_id: tick-abc
specification: ../specification/billing/specification.md
spec_commit: def456
---

# Plan: Billing
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  epic_spec_ref=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.planning.items.billing.specification)")
  assert_eq "epic spec path gets extra ../" "../../specification/billing/specification.md" "$epic_spec_ref"

  teardown
}

# --- Test 32: Superseded specification status preserved ---
test_superseded_spec() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/specification/payments"
  mkdir -p "$TEST_DIR/.workflows/specification/payments-v2"

  cat > "$TEST_DIR/.workflows/discussion/payments.md" << 'EOF'
---
topic: payments
status: concluded
work_type: greenfield
---

# Discussion: Payments
EOF

  cat > "$TEST_DIR/.workflows/specification/payments/specification.md" << 'EOF'
---
topic: payments
status: superseded
superseded_by: payments-v2
type: feature
work_type: greenfield
---

# Specification: Payments (superseded)
EOF

  cat > "$TEST_DIR/.workflows/specification/payments-v2/specification.md" << 'EOF'
---
topic: payments-v2
status: concluded
type: feature
work_type: greenfield
---

# Specification: Payments v2
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  superseded_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification.items.payments.status)")
  assert_eq "superseded spec status preserved" "superseded" "$superseded_status"

  v2_status=$(node -e "var m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/v1/manifest.json','utf8')); console.log(m.phases.specification.items['payments-v2'].status)")
  assert_eq "non-superseded spec status preserved" "concluded" "$v2_status"

  teardown
}

# --- Test 33: Research subdirectories migrated to v1 epic ---
test_research_subdirs() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/research/sync-engine"
  mkdir -p "$TEST_DIR/.workflows/research/multi-tenancy"

  cat > "$TEST_DIR/.workflows/discussion/core.md" << 'EOF'
---
topic: core
status: concluded
work_type: greenfield
---

# Discussion: Core
EOF

  cat > "$TEST_DIR/.workflows/research/overview.md" << 'EOF'
---
topic: overview
---

# Research overview
EOF

  echo "# Sync architecture" > "$TEST_DIR/.workflows/research/sync-engine/architecture.md"
  echo "# Sync API design" > "$TEST_DIR/.workflows/research/sync-engine/api-design.md"
  echo "# MT overview" > "$TEST_DIR/.workflows/research/multi-tenancy/overview.md"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "research subdir sync-engine migrated" "true" "$([ -d "$TEST_DIR/.workflows/v1/research/sync-engine" ] && echo true || echo false)"
  assert_eq "research subdir file migrated" "true" "$([ -f "$TEST_DIR/.workflows/v1/research/sync-engine/architecture.md" ] && echo true || echo false)"
  assert_eq "research subdir multi-tenancy migrated" "true" "$([ -d "$TEST_DIR/.workflows/v1/research/multi-tenancy" ] && echo true || echo false)"
  assert_eq "flat research file also migrated" "true" "$([ -f "$TEST_DIR/.workflows/v1/research/overview.md" ] && echo true || echo false)"
  assert_eq "old research dir removed" "false" "$([ -d "$TEST_DIR/.workflows/research" ] && echo true || echo false)"

  teardown
}

# --- Test 34: .gitkeep-only directories treated as empty ---
test_gitkeep_empty() {
  setup
  mkdir -p "$TEST_DIR/.workflows/discussion"
  mkdir -p "$TEST_DIR/.workflows/planning"

  cat > "$TEST_DIR/.workflows/discussion/widget.md" << 'EOF'
---
topic: widget
status: concluded
work_type: greenfield
---

# Discussion: Widget
EOF

  touch "$TEST_DIR/.workflows/planning/.gitkeep"

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq ".gitkeep-only planning dir removed" "false" "$([ -d "$TEST_DIR/.workflows/planning" ] && echo true || echo false)"
  assert_eq "discussion still migrated correctly" "true" "$([ -d "$TEST_DIR/.workflows/v1/discussion" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 016 tests..."
echo ""

test_no_workflows_dir
test_single_feature
test_single_bugfix
test_multiple_features
test_greenfield_epic
test_mixed_types
test_idempotency
test_frontmatter_preserved
test_manifest_fields
test_empty_phase_dirs
test_greenfield_to_epic
test_tracking_rename
test_research_discussion_ready
test_research_no_marker
test_epic_all_phases
test_state_file_moved
test_unmatched_review
test_mixed_feature_epic
test_epic_multiple_topics
test_feature_with_review
test_research_analysis_state
test_review_only_v1
test_impl_no_worktype_feature
test_impl_no_worktype_bugfix
test_status_normalization
test_status_crossover
test_research_inferred
test_research_in_progress
test_spec_path_references
test_epic_spec_path
test_superseded_spec
test_research_subdirs
test_gitkeep_empty

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
