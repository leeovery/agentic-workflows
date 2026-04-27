#!/bin/bash
# Tests for migration 006: directory-restructure
# Run: bash tests/scripts/test-migration-006.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/006-directory-restructure.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-006-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/specification"
  mkdir -p "$TEST_DIR/docs/workflow/planning"
  SPEC_DIR="$TEST_DIR/docs/workflow/specification"
  PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Specification flat file to topic directory ---
test_spec_restructure() {
  setup

  cat > "$SPEC_DIR/user-auth.md" << 'EOF'
---
topic: user-auth
status: concluded
type: feature
date: 2024-01-15
---

# Specification: User Auth

## Overview

Content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Topic directory created" "true" "$([ -d "$SPEC_DIR/user-auth" ] && echo true || echo false)"
  assert_eq "Spec moved to specification.md" "true" "$([ -f "$SPEC_DIR/user-auth/specification.md" ] && echo true || echo false)"
  assert_eq "Original flat file removed" "false" "$([ -f "$SPEC_DIR/user-auth.md" ] && echo true || echo false)"

  content=$(cat "$SPEC_DIR/user-auth/specification.md")
  assert_eq "Content preserved after move" "true" "$(echo "$content" | grep -q 'topic: user-auth' && echo true || echo false)"

  teardown
}

# --- Test 2: Planning flat file to topic directory ---
test_plan_restructure() {
  setup

  cat > "$PLAN_DIR/billing.md" << 'EOF'
---
topic: billing
status: in-progress
date: 2024-02-20
format: local-markdown
specification: billing.md
---

# Implementation Plan: Billing

## Overview

Plan content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Topic directory created" "true" "$([ -d "$PLAN_DIR/billing" ] && echo true || echo false)"
  assert_eq "Plan moved to plan.md" "true" "$([ -f "$PLAN_DIR/billing/plan.md" ] && echo true || echo false)"
  assert_eq "Original flat file removed" "false" "$([ -f "$PLAN_DIR/billing.md" ] && echo true || echo false)"

  content=$(cat "$PLAN_DIR/billing/plan.md")
  assert_eq "Content preserved after move" "true" "$(echo "$content" | grep -q 'topic: billing' && echo true || echo false)"

  teardown
}

# --- Test 3: Content preserved through spec restructure ---
test_spec_content_preserved() {
  setup

  cat > "$SPEC_DIR/api-design.md" << 'TESTEOF'
---
topic: api-design
status: concluded
type: feature
date: 2024-03-10
---

# Specification: API Design

## Overview

Content with **bold** and `code`.

---

## Dependencies

| Dep | Reason |
|-----|--------|
| core | Needed first |
TESTEOF

  original_content=$(cat "$SPEC_DIR/api-design.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  moved_content=$(cat "$SPEC_DIR/api-design/specification.md")

  assert_eq "Spec content exactly preserved through restructure" "$original_content" "$moved_content"

  teardown
}

# --- Test 4: Content preserved through plan restructure ---
test_plan_content_preserved() {
  setup

  cat > "$PLAN_DIR/caching.md" << 'TESTEOF'
---
topic: caching
status: in-progress
date: 2024-04-01
format: local-markdown
specification: caching.md
---

# Plan: Caching

## Overview

Plan content.

## Phase 1: Setup

- Task 1
- Task 2
TESTEOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  moved_content=$(cat "$PLAN_DIR/caching/plan.md")

  assert_eq "Topic preserved" "true" "$(echo "$moved_content" | grep -q 'topic: caching' && echo true || echo false)"
  assert_eq "Body preserved" "true" "$(echo "$moved_content" | grep -qF '## Phase 1: Setup' && echo true || echo false)"

  teardown
}

# --- Test 5: Already restructured spec — skip ---
test_already_restructured_spec() {
  setup

  mkdir -p "$SPEC_DIR/existing"
  cat > "$SPEC_DIR/existing/specification.md" << 'EOF'
---
topic: existing
status: concluded
type: feature
date: 2024-05-15
---

# Specification: Existing

## Overview

Already restructured.
EOF

  original_content=$(cat "$SPEC_DIR/existing/specification.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$SPEC_DIR/existing/specification.md")

  assert_eq "Already restructured spec unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 6: Already restructured plan — skip ---
test_already_restructured_plan() {
  setup

  mkdir -p "$PLAN_DIR/existing"
  cat > "$PLAN_DIR/existing/plan.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-06-01
format: local-markdown
specification: existing/specification.md
---

# Plan: Existing

## Overview

Already restructured.
EOF

  original_content=$(cat "$PLAN_DIR/existing/plan.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$PLAN_DIR/existing/plan.md")

  assert_eq "Already restructured plan unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 7: Plan frontmatter specification field updated ---
test_spec_field_updated() {
  setup

  mkdir -p "$PLAN_DIR/user-auth"
  cat > "$PLAN_DIR/user-auth/plan.md" << 'EOF'
---
topic: user-auth
status: in-progress
date: 2024-07-01
format: local-markdown
specification: user-auth.md
---

# Plan: User Auth

## Overview

Content.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/user-auth/plan.md")

  assert_eq "Specification field updated to directory path" "true" "$(echo "$content" | grep -q 'specification: user-auth/specification.md' && echo true || echo false)"

  teardown
}

# --- Test 8: Specification field already updated — no change ---
test_spec_field_already_updated() {
  setup

  mkdir -p "$PLAN_DIR/already-updated"
  cat > "$PLAN_DIR/already-updated/plan.md" << 'EOF'
---
topic: already-updated
status: in-progress
date: 2024-08-01
format: local-markdown
specification: already-updated/specification.md
---

# Plan: Already Updated

## Overview

Content.
EOF

  original_content=$(cat "$PLAN_DIR/already-updated/plan.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$PLAN_DIR/already-updated/plan.md")

  assert_eq "Already-updated specification field unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 9: Multiple specs and plans restructured together ---
test_multiple_restructured() {
  setup

  cat > "$SPEC_DIR/topic-a.md" << 'EOF'
---
topic: topic-a
status: concluded
type: feature
date: 2024-09-01
---

# Spec A
EOF

  cat > "$SPEC_DIR/topic-b.md" << 'EOF'
---
topic: topic-b
status: in-progress
type: cross-cutting
date: 2024-09-02
---

# Spec B
EOF

  cat > "$PLAN_DIR/topic-a.md" << 'EOF'
---
topic: topic-a
status: in-progress
date: 2024-09-03
format: local-markdown
specification: topic-a.md
---

# Plan A
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"

  assert_eq "Spec A restructured" "true" "$([ -f "$SPEC_DIR/topic-a/specification.md" ] && echo true || echo false)"
  assert_eq "Spec B restructured" "true" "$([ -f "$SPEC_DIR/topic-b/specification.md" ] && echo true || echo false)"
  assert_eq "Plan A restructured" "true" "$([ -f "$PLAN_DIR/topic-a/plan.md" ] && echo true || echo false)"
  assert_eq "Spec A flat file removed" "false" "$([ -f "$SPEC_DIR/topic-a.md" ] && echo true || echo false)"
  assert_eq "Spec B flat file removed" "false" "$([ -f "$SPEC_DIR/topic-b.md" ] && echo true || echo false)"
  assert_eq "Plan A flat file removed" "false" "$([ -f "$PLAN_DIR/topic-a.md" ] && echo true || echo false)"

  content=$(cat "$PLAN_DIR/topic-a/plan.md")
  assert_eq "Plan A spec field updated" "true" "$(echo "$content" | grep -q 'specification: topic-a/specification.md' && echo true || echo false)"

  teardown
}

# --- Test 10: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$SPEC_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: concluded
type: feature
date: 2024-10-01
---

# Spec: Idempotent
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  first_content=$(cat "$SPEC_DIR/idempotent/specification.md")

  cd "$TEST_DIR"
  source "$MIGRATION"
  second_content=$(cat "$SPEC_DIR/idempotent/specification.md")

  assert_eq "Second run produces same result" "$first_content" "$second_content"

  teardown
}

# --- Run all tests ---
echo "Running migration 006 tests..."
echo ""

test_spec_restructure
test_plan_restructure
test_spec_content_preserved
test_plan_content_preserved
test_already_restructured_spec
test_already_restructured_plan
test_spec_field_updated
test_spec_field_already_updated
test_multiple_restructured
test_idempotency

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
