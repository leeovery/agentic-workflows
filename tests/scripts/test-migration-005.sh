#!/bin/bash
# Tests for migration 005: plan-external-deps-frontmatter
# Run: bash tests/scripts/test-migration-005.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/005-plan-external-deps-frontmatter.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-005-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/planning"
  PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Unresolved dependency ---
test_unresolved_dep() {
  setup

  cat > "$PLAN_DIR/billing.md" << 'EOF'
---
topic: billing
status: in-progress
date: 2024-01-15
format: local-markdown
specification: billing.md
---

# Implementation Plan: Billing

## Overview

Plan content here.

## External Dependencies

- payment-gateway: Payment processing for checkout

## Phase 1: Setup

Setup tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/billing.md")

  assert_eq "external_dependencies added to frontmatter" "true" "$(echo "$content" | grep -q 'external_dependencies:' && echo true || echo false)"
  assert_eq "Dep topic extracted" "true" "$(echo "$content" | grep -q 'topic: payment-gateway' && echo true || echo false)"
  assert_eq "Dep description extracted" "true" "$(echo "$content" | grep -q 'description: Payment processing for checkout' && echo true || echo false)"
  assert_eq "State set to unresolved" "true" "$(echo "$content" | grep -q 'state: unresolved' && echo true || echo false)"
  assert_eq "Body section removed" "false" "$(echo "$content" | grep -qF '## External Dependencies' && echo true || echo false)"
  assert_eq "Other body sections preserved" "true" "$(echo "$content" | grep -qF '## Phase 1: Setup' && echo true || echo false)"

  teardown
}

# --- Test 2: Resolved dependency with arrow and task_id ---
test_resolved_dep() {
  setup

  cat > "$PLAN_DIR/auth.md" << 'EOF'
---
topic: auth
status: in-progress
date: 2024-02-20
format: local-markdown
specification: auth.md
---

# Implementation Plan: Auth

## Overview

Auth plan.

## External Dependencies

- user-service: User context for permissions → auth-1-3

## Phase 1: Core

Core tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/auth.md")

  assert_eq "Resolved dep topic extracted" "true" "$(echo "$content" | grep -q 'topic: user-service' && echo true || echo false)"
  assert_eq "Resolved dep description extracted" "true" "$(echo "$content" | grep -q 'description: User context for permissions' && echo true || echo false)"
  assert_eq "State set to resolved" "true" "$(echo "$content" | grep -q 'state: resolved' && echo true || echo false)"
  assert_eq "Task ID extracted" "true" "$(echo "$content" | grep -q 'task_id: auth-1-3' && echo true || echo false)"

  teardown
}

# --- Test 3: Resolved dependency with (resolved) suffix ---
test_resolved_suffix() {
  setup

  cat > "$PLAN_DIR/api.md" << 'EOF'
---
topic: api
status: in-progress
date: 2024-03-10
format: local-markdown
specification: api.md
---

# Implementation Plan: API

## Overview

API plan.

## External Dependencies

- data-layer: Database access → db-2-1 (resolved)

## Phase 1: Endpoints

Tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/api.md")

  assert_eq "Resolved state detected" "true" "$(echo "$content" | grep -q 'state: resolved' && echo true || echo false)"
  assert_eq "Task ID extracted with (resolved) suffix stripped" "true" "$(echo "$content" | grep -q 'task_id: db-2-1' && echo true || echo false)"

  teardown
}

# --- Test 4: Satisfied externally dependency ---
test_satisfied_externally() {
  setup

  cat > "$PLAN_DIR/checkout.md" << 'EOF'
---
topic: checkout
status: in-progress
date: 2024-04-01
format: local-markdown
specification: checkout.md
---

# Implementation Plan: Checkout

## Overview

Checkout plan.

## External Dependencies

- ~~payment-gateway: Payment processing~~ → satisfied externally

## Phase 1: Cart

Cart tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/checkout.md")

  assert_eq "Satisfied dep topic extracted" "true" "$(echo "$content" | grep -q 'topic: payment-gateway' && echo true || echo false)"
  assert_eq "Satisfied dep description extracted" "true" "$(echo "$content" | grep -q 'description: Payment processing' && echo true || echo false)"
  assert_eq "State set to satisfied_externally" "true" "$(echo "$content" | grep -q 'state: satisfied_externally' && echo true || echo false)"

  teardown
}

# --- Test 5: Mixed dependency types ---
test_mixed_deps() {
  setup

  cat > "$PLAN_DIR/mixed.md" << 'EOF'
---
topic: mixed
status: in-progress
date: 2024-05-15
format: local-markdown
specification: mixed.md
---

# Implementation Plan: Mixed

## Overview

Mixed plan.

## External Dependencies

- billing-system: Invoice generation for order completion
- user-authentication: User context for permissions → auth-1-3
- ~~payment-gateway: Payment processing~~ → satisfied externally

## Phase 1: Core

Core tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/mixed.md")

  assert_eq "Unresolved dep present" "true" "$(echo "$content" | grep -q 'topic: billing-system' && echo true || echo false)"
  assert_eq "Unresolved state present" "true" "$(echo "$content" | grep -q 'state: unresolved' && echo true || echo false)"
  assert_eq "Resolved dep present" "true" "$(echo "$content" | grep -q 'topic: user-authentication' && echo true || echo false)"
  assert_eq "Resolved state present" "true" "$(echo "$content" | grep -q 'state: resolved' && echo true || echo false)"
  assert_eq "Task ID present" "true" "$(echo "$content" | grep -q 'task_id: auth-1-3' && echo true || echo false)"
  assert_eq "Satisfied dep present" "true" "$(echo "$content" | grep -q 'topic: payment-gateway' && echo true || echo false)"
  assert_eq "Satisfied state present" "true" "$(echo "$content" | grep -q 'state: satisfied_externally' && echo true || echo false)"
  assert_eq "Body section removed" "false" "$(echo "$content" | grep -qF '## External Dependencies' && echo true || echo false)"
  assert_eq "Other sections preserved" "true" "$(echo "$content" | grep -qF '## Phase 1: Core' && echo true || echo false)"

  teardown
}

# --- Test 6: No External Dependencies section — empty array ---
test_no_deps_section() {
  setup

  cat > "$PLAN_DIR/no-deps.md" << 'EOF'
---
topic: no-deps
status: in-progress
date: 2024-06-01
format: local-markdown
specification: no-deps.md
---

# Implementation Plan: No Deps

## Overview

No deps plan.

## Phase 1: Core

Core tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/no-deps.md")

  assert_eq "Empty array added when no section" "true" "$(echo "$content" | grep -q 'external_dependencies: \[\]' && echo true || echo false)"
  assert_eq "Body preserved" "true" "$(echo "$content" | grep -qF '## Phase 1: Core' && echo true || echo false)"

  teardown
}

# --- Test 7: Already has external_dependencies in frontmatter — skip ---
test_already_has_deps() {
  setup

  cat > "$PLAN_DIR/already-done.md" << 'EOF'
---
topic: already-done
status: in-progress
date: 2024-07-01
format: local-markdown
specification: already-done.md
external_dependencies:
  - topic: some-dep
    description: Already migrated
    state: unresolved
---

# Implementation Plan: Already Done

## Overview

Already done.
EOF

  original_content=$(cat "$PLAN_DIR/already-done.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$PLAN_DIR/already-done.md")

  assert_eq "File with existing external_dependencies unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 8: No frontmatter — skip ---
test_no_frontmatter() {
  setup

  cat > "$PLAN_DIR/no-frontmatter.md" << 'EOF'
# Implementation Plan: No Frontmatter

## External Dependencies

- some-dep: Something

## Phase 1: Core

Tasks.
EOF

  original_content=$(cat "$PLAN_DIR/no-frontmatter.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$PLAN_DIR/no-frontmatter.md")

  assert_eq "File without frontmatter unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 9: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$PLAN_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: in-progress
date: 2024-08-01
format: local-markdown
specification: idempotent.md
---

# Implementation Plan: Idempotent

## Overview

Content.

## External Dependencies

- dep-a: Description A

## Phase 1: Core

Tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  first_run=$(cat "$PLAN_DIR/idempotent.md")

  cd "$TEST_DIR"
  source "$MIGRATION"
  second_run=$(cat "$PLAN_DIR/idempotent.md")

  assert_eq "Second migration run produces same result" "$first_run" "$second_run"

  teardown
}

# --- Test 10: Body with --- horizontal rules preserved ---
test_hr_body() {
  setup

  cat > "$PLAN_DIR/hr-body.md" << 'TESTEOF'
---
topic: hr-body
status: in-progress
date: 2024-09-01
format: local-markdown
specification: hr-body.md
---

# Implementation Plan: HR Body

## Overview

Plan overview.

---

## External Dependencies

- some-dep: A dependency

---

## Phase 1: Setup

Setup tasks.

---

## Phase 2: Core

Core tasks.
TESTEOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/hr-body.md")

  assert_eq "Dep extracted from body" "true" "$(echo "$content" | grep -q 'topic: some-dep' && echo true || echo false)"
  assert_eq "Deps section removed" "false" "$(echo "$content" | grep -qF '## External Dependencies' && echo true || echo false)"
  assert_eq "Overview preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Phase 1 preserved" "true" "$(echo "$content" | grep -qF '## Phase 1: Setup' && echo true || echo false)"
  assert_eq "Phase 2 preserved" "true" "$(echo "$content" | grep -qF '## Phase 2: Core' && echo true || echo false)"

  teardown
}

# --- Test 11: Review/tracking files skipped ---
test_review_files_skipped() {
  setup

  cat > "$PLAN_DIR/topic-review-traceability.md" << 'EOF'
---
topic: topic
review: true
---

# Review

Content.
EOF

  original_content=$(cat "$PLAN_DIR/topic-review-traceability.md")
  cd "$TEST_DIR"
  source "$MIGRATION"
  new_content=$(cat "$PLAN_DIR/topic-review-traceability.md")

  assert_eq "Review file unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 12: Arrow with -> syntax ---
test_arrow_alt_syntax() {
  setup

  cat > "$PLAN_DIR/arrow-alt.md" << 'EOF'
---
topic: arrow-alt
status: in-progress
date: 2024-10-01
format: local-markdown
specification: arrow-alt.md
---

# Implementation Plan: Arrow Alt

## Overview

Content.

## External Dependencies

- data-service: Data access -> data-1-2

## Phase 1: Core

Tasks.
EOF

  cd "$TEST_DIR"
  source "$MIGRATION"
  content=$(cat "$PLAN_DIR/arrow-alt.md")

  assert_eq "Resolved with -> syntax" "true" "$(echo "$content" | grep -q 'state: resolved' && echo true || echo false)"
  assert_eq "Task ID extracted with -> syntax" "true" "$(echo "$content" | grep -q 'task_id: data-1-2' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 005 tests..."
echo ""

test_unresolved_dep
test_resolved_dep
test_resolved_suffix
test_satisfied_externally
test_mixed_deps
test_no_deps_section
test_already_has_deps
test_no_frontmatter
test_idempotency
test_hr_body
test_review_files_skipped
test_arrow_alt_syntax

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
