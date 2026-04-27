#!/bin/bash
# Tests for migration 007: tasks-subdirectory
# Run: bash tests/scripts/test-migration-007.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/007-tasks-subdirectory.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-007-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/planning"
  PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Single task file moved to tasks/ ---
test_single_task_moved() {
  setup

  mkdir -p "$PLAN_DIR/user-auth"
  cat > "$PLAN_DIR/user-auth/plan.md" << 'EOF'
---
topic: user-auth
status: in-progress
format: local-markdown
---

# Plan: User Auth
EOF

  cat > "$PLAN_DIR/user-auth/user-auth-1-1.md" << 'EOF'
# Task 1-1

Task content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "tasks/ subdirectory created" "true" "$([ -d "$PLAN_DIR/user-auth/tasks" ] && echo true || echo false)"
  assert_eq "Task file moved to tasks/" "true" "$([ -f "$PLAN_DIR/user-auth/tasks/user-auth-1-1.md" ] && echo true || echo false)"
  assert_eq "Original task file removed" "false" "$([ -f "$PLAN_DIR/user-auth/user-auth-1-1.md" ] && echo true || echo false)"
  assert_eq "plan.md untouched" "true" "$([ -f "$PLAN_DIR/user-auth/plan.md" ] && echo true || echo false)"

  teardown
}

# --- Test 2: Multiple task files moved ---
test_multiple_tasks_moved() {
  setup

  mkdir -p "$PLAN_DIR/billing"
  cat > "$PLAN_DIR/billing/plan.md" << 'EOF'
---
topic: billing
status: in-progress
format: local-markdown
---

# Plan: Billing
EOF

  cat > "$PLAN_DIR/billing/billing-1-1.md" << 'EOF'
# Task 1-1
EOF

  cat > "$PLAN_DIR/billing/billing-1-2.md" << 'EOF'
# Task 1-2
EOF

  cat > "$PLAN_DIR/billing/billing-2-1.md" << 'EOF'
# Task 2-1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "First task moved" "true" "$([ -f "$PLAN_DIR/billing/tasks/billing-1-1.md" ] && echo true || echo false)"
  assert_eq "Second task moved" "true" "$([ -f "$PLAN_DIR/billing/tasks/billing-1-2.md" ] && echo true || echo false)"
  assert_eq "Third task moved" "true" "$([ -f "$PLAN_DIR/billing/tasks/billing-2-1.md" ] && echo true || echo false)"
  assert_eq "First original removed" "false" "$([ -f "$PLAN_DIR/billing/billing-1-1.md" ] && echo true || echo false)"
  assert_eq "Second original removed" "false" "$([ -f "$PLAN_DIR/billing/billing-1-2.md" ] && echo true || echo false)"
  assert_eq "Third original removed" "false" "$([ -f "$PLAN_DIR/billing/billing-2-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 3: Review/tracking files NOT moved ---
test_review_files_not_moved() {
  setup

  mkdir -p "$PLAN_DIR/api"
  cat > "$PLAN_DIR/api/plan.md" << 'EOF'
---
topic: api
status: in-progress
format: local-markdown
---

# Plan: API
EOF

  cat > "$PLAN_DIR/api/api-1-1.md" << 'EOF'
# Task 1-1
EOF

  cat > "$PLAN_DIR/api/review-traceability-tracking-c1.md" << 'EOF'
# Review Tracking

Tracking content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Task file moved" "true" "$([ -f "$PLAN_DIR/api/tasks/api-1-1.md" ] && echo true || echo false)"
  assert_eq "Review file stays in place" "true" "$([ -f "$PLAN_DIR/api/review-traceability-tracking-c1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 4: No task files — skip ---
test_no_task_files() {
  setup

  mkdir -p "$PLAN_DIR/beads-plan"
  cat > "$PLAN_DIR/beads-plan/plan.md" << 'EOF'
---
topic: beads-plan
status: in-progress
format: beads
---

# Plan: Beads Plan
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "plan.md untouched" "true" "$([ -f "$PLAN_DIR/beads-plan/plan.md" ] && echo true || echo false)"

  teardown
}

# --- Test 5: No plan.md — skip entirely ---
test_no_plan_md() {
  setup

  mkdir -p "$PLAN_DIR/orphan"
  cat > "$PLAN_DIR/orphan/orphan-1-1.md" << 'EOF'
# Orphan task
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Task file stays when no plan.md" "true" "$([ -f "$PLAN_DIR/orphan/orphan-1-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 6: Tasks already in tasks/ — idempotent skip ---
test_already_moved() {
  setup

  mkdir -p "$PLAN_DIR/done/tasks"
  cat > "$PLAN_DIR/done/plan.md" << 'EOF'
---
topic: done
status: concluded
format: local-markdown
---

# Plan: Done
EOF

  cat > "$PLAN_DIR/done/tasks/done-1-1.md" << 'EOF'
# Task 1-1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Existing task file untouched" "true" "$([ -f "$PLAN_DIR/done/tasks/done-1-1.md" ] && echo true || echo false)"

  teardown
}

# --- Test 7: Task content preserved after move ---
test_content_preserved() {
  setup

  mkdir -p "$PLAN_DIR/preserve"
  cat > "$PLAN_DIR/preserve/plan.md" << 'EOF'
---
topic: preserve
status: in-progress
format: local-markdown
---

# Plan: Preserve
EOF

  cat > "$PLAN_DIR/preserve/preserve-1-1.md" << 'TESTEOF'
---
task_id: preserve-1-1
title: Setup Database
status: pending
phase: 1
priority: 1
---

# Task: Setup Database

## Description

Create the database schema with tables:

| Table | Purpose |
|-------|---------|
| users | User accounts |
| sessions | Active sessions |

## Acceptance Criteria

- [ ] Schema created
- [ ] Migrations run
- [ ] Seeds loaded

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);
```
TESTEOF

  original_content=$(cat "$PLAN_DIR/preserve/preserve-1-1.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  moved_content=$(cat "$PLAN_DIR/preserve/tasks/preserve-1-1.md")

  assert_eq "Task file content exactly preserved after move" "$original_content" "$moved_content"

  teardown
}

# --- Test 8: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  mkdir -p "$PLAN_DIR/idem"
  cat > "$PLAN_DIR/idem/plan.md" << 'EOF'
---
topic: idem
status: in-progress
format: local-markdown
---

# Plan: Idem
EOF

  cat > "$PLAN_DIR/idem/idem-1-1.md" << 'EOF'
# Task 1-1
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  first_content=$(cat "$PLAN_DIR/idem/tasks/idem-1-1.md")

  cd "$TEST_DIR"
  source "$MIGRATION"
  second_content=$(cat "$PLAN_DIR/idem/tasks/idem-1-1.md")

  assert_eq "Second run produces same result" "$first_content" "$second_content"

  teardown
}

# --- Test 9: Multiple topics processed independently ---
test_multiple_topics() {
  setup

  mkdir -p "$PLAN_DIR/topic-a"
  cat > "$PLAN_DIR/topic-a/plan.md" << 'EOF'
---
topic: topic-a
format: local-markdown
---
# Plan A
EOF
  cat > "$PLAN_DIR/topic-a/topic-a-1-1.md" << 'EOF'
# Task A-1-1
EOF

  mkdir -p "$PLAN_DIR/topic-b"
  cat > "$PLAN_DIR/topic-b/plan.md" << 'EOF'
---
topic: topic-b
format: local-markdown
---
# Plan B
EOF
  cat > "$PLAN_DIR/topic-b/topic-b-1-1.md" << 'EOF'
# Task B-1-1
EOF
  cat > "$PLAN_DIR/topic-b/topic-b-1-2.md" << 'EOF'
# Task B-1-2
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Topic A task moved" "true" "$([ -f "$PLAN_DIR/topic-a/tasks/topic-a-1-1.md" ] && echo true || echo false)"
  assert_eq "Topic B first task moved" "true" "$([ -f "$PLAN_DIR/topic-b/tasks/topic-b-1-1.md" ] && echo true || echo false)"
  assert_eq "Topic B second task moved" "true" "$([ -f "$PLAN_DIR/topic-b/tasks/topic-b-1-2.md" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 007 tests..."
echo ""

test_single_task_moved
test_multiple_tasks_moved
test_review_files_not_moved
test_no_task_files
test_no_plan_md
test_already_moved
test_content_preserved
test_idempotency
test_multiple_topics

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
