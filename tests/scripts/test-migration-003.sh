#!/bin/bash
# Tests for migration 003: planning-frontmatter
# Run: bash tests/scripts/test-migration-003.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/003-planning-frontmatter.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-003-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/planning"
  PLAN_DIR="$TEST_DIR/docs/workflow/planning"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run_migration() {
  cd "$TEST_DIR"
  PLAN_DIR="$TEST_DIR/docs/workflow/planning"
  source "$MIGRATION"
}

# --- Test 1: Legacy format with partial frontmatter and Draft status ---
test_draft_with_partial_frontmatter() {
  setup

  cat > "$PLAN_DIR/user-auth.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: User Authentication

**Date**: 2024-01-15
**Status**: Draft
**Specification**: `docs/workflow/specification/user-auth.md`

## Overview

Plan content here.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/user-auth.md")

  assert_eq "File starts with frontmatter delimiter" "---" "$(head -1 "$PLAN_DIR/user-auth.md")"
  assert_eq "Topic extracted from filename" "true" "$(echo "$content" | grep -q '^topic: user-auth$' && echo true || echo false)"
  assert_eq "Draft status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "Date extracted" "true" "$(echo "$content" | grep -q '^date: 2024-01-15$' && echo true || echo false)"
  assert_eq "Format preserved" "true" "$(echo "$content" | grep -q '^format: local-markdown$' && echo true || echo false)"
  assert_eq "Specification filename extracted" "true" "$(echo "$content" | grep -q '^specification: user-auth.md$' && echo true || echo false)"
  assert_eq "H1 heading preserved" "true" "$(echo "$content" | grep -q '^# Implementation Plan: User Authentication$' && echo true || echo false)"
  assert_eq "Content sections preserved" "true" "$(echo "$content" | grep -q '^## Overview$' && echo true || echo false)"

  teardown
}

# --- Test 2: Legacy format with Ready status ---
test_ready_status() {
  setup

  cat > "$PLAN_DIR/api-endpoints.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: API Endpoints

**Date**: 2024-02-20
**Status**: Ready
**Specification**: `docs/workflow/specification/api-endpoints.md`

## Overview

Ready to implement.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/api-endpoints.md")

  assert_eq "Ready status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  teardown
}

# --- Test 3: Legacy format with In Progress status ---
test_in_progress_status() {
  setup

  cat > "$PLAN_DIR/caching.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Caching

**Date**: 2024-03-10
**Status**: In Progress
**Specification**: `docs/workflow/specification/caching.md`

## Overview

Work in progress.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/caching.md")

  assert_eq "In Progress status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  teardown
}

# --- Test 4: Legacy format with Completed status ---
test_completed_status() {
  setup

  cat > "$PLAN_DIR/database.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Database Setup

**Date**: 2024-04-01
**Status**: Completed
**Specification**: `docs/workflow/specification/database.md`

## Overview

Implementation complete.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/database.md")

  assert_eq "Completed status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 5: Legacy format without partial frontmatter (inline only) ---
test_no_partial_frontmatter() {
  setup

  cat > "$PLAN_DIR/no-frontmatter.md" << 'EOF'
# Implementation Plan: No Frontmatter

**Date**: 2024-05-15
**Status**: Draft
**Specification**: `docs/workflow/specification/no-frontmatter.md`

## Overview

No frontmatter at all.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/no-frontmatter.md")

  assert_eq "Frontmatter added" "---" "$(head -1 "$PLAN_DIR/no-frontmatter.md")"
  assert_eq "Topic extracted from filename" "true" "$(echo "$content" | grep -q '^topic: no-frontmatter$' && echo true || echo false)"
  assert_eq "Missing format flagged" "true" "$(echo "$content" | grep -q '^format: MISSING$' && echo true || echo false)"

  teardown
}

# --- Test 6: Legacy format without date field ---
test_no_date_field() {
  setup

  cat > "$PLAN_DIR/no-date.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Date

**Status**: Draft
**Specification**: `docs/workflow/specification/no-date.md`

## Overview

Missing date.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/no-date.md")
  today=$(date +%Y-%m-%d)

  assert_eq "Date defaults to today when not found" "true" "$(echo "$content" | grep -q "^date: $today$" && echo true || echo false)"

  teardown
}

# --- Test 7: Legacy format without specification field ---
test_no_spec_field() {
  setup

  cat > "$PLAN_DIR/no-spec.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Spec

**Date**: 2024-06-01
**Status**: Draft

## Overview

Missing specification.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/no-spec.md")

  assert_eq "Specification defaults to topic.md" "true" "$(echo "$content" | grep -q '^specification: no-spec.md$' && echo true || echo false)"

  teardown
}

# --- Test 8: Specification path extraction (full path to filename) ---
test_spec_path_extraction() {
  setup

  cat > "$PLAN_DIR/billing.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Billing

**Date**: 2024-07-01
**Status**: Draft
**Specification**: `docs/workflow/specification/billing-system.md`

## Overview

Billing plan.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/billing.md")

  assert_eq "Specification filename extracted from path" "true" "$(echo "$content" | grep -q '^specification: billing-system.md$' && echo true || echo false)"

  teardown
}

# --- Test 9: Different format value (beads) ---
test_beads_format() {
  setup

  cat > "$PLAN_DIR/beads-plan.md" << 'EOF'
---
format: beads
---

# Implementation Plan: Beads Plan

**Date**: 2024-08-01
**Status**: Draft
**Specification**: `docs/workflow/specification/beads-plan.md`

## Overview

Using beads format.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/beads-plan.md")

  assert_eq "Non-default format preserved" "true" "$(echo "$content" | grep -q '^format: beads$' && echo true || echo false)"

  teardown
}

# --- Test 10: File already has full frontmatter (should skip) ---
test_already_has_full_frontmatter() {
  setup

  cat > "$PLAN_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-01-01
format: local-markdown
specification: existing.md
---

# Implementation Plan: Existing

## Overview

Already migrated content.
EOF

  original_content=$(cat "$PLAN_DIR/existing.md")
  run_migration
  new_content=$(cat "$PLAN_DIR/existing.md")

  assert_eq "File with full frontmatter unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 11: File without legacy format (should skip) ---
test_no_legacy_format() {
  setup

  cat > "$PLAN_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status, date, or specification fields.

## Section

Content here.
EOF

  original_content=$(cat "$PLAN_DIR/weird.md")
  run_migration
  new_content=$(cat "$PLAN_DIR/weird.md")

  assert_eq "File without legacy format unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 12: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$PLAN_DIR/idempotent.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Idempotent Test

**Date**: 2024-09-01
**Status**: Draft
**Specification**: `docs/workflow/specification/idempotent.md`

## Overview

Content.
EOF

  run_migration
  first_run=$(cat "$PLAN_DIR/idempotent.md")

  run_migration
  second_run=$(cat "$PLAN_DIR/idempotent.md")

  assert_eq "Second migration run produces same result" "$first_run" "$second_run"

  teardown
}

# --- Test 13: Content preservation (multiple phases) ---
test_content_preservation() {
  setup

  cat > "$PLAN_DIR/full-plan.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Full Plan

**Date**: 2024-10-01
**Status**: In Progress
**Specification**: `docs/workflow/specification/full-plan.md`

## Overview

Plan overview.

## Phase 1: Setup

Phase 1 tasks.

## Phase 2: Core

Phase 2 tasks.

## Phase 3: Polish

Phase 3 tasks.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/full-plan.md")

  assert_eq "Overview section preserved" "true" "$(echo "$content" | grep -q '^## Overview$' && echo true || echo false)"
  assert_eq "Phase 1 section preserved" "true" "$(echo "$content" | grep -q '^## Phase 1: Setup$' && echo true || echo false)"
  assert_eq "Phase 2 section preserved" "true" "$(echo "$content" | grep -q '^## Phase 2: Core$' && echo true || echo false)"
  assert_eq "Phase 3 section preserved" "true" "$(echo "$content" | grep -q '^## Phase 3: Polish$' && echo true || echo false)"

  teardown
}

# --- Test 14: Kebab-case topic from filename ---
test_kebab_case_topic() {
  setup

  cat > "$PLAN_DIR/user-profile-settings.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: User Profile Settings

**Date**: 2024-11-01
**Status**: Draft
**Specification**: `docs/workflow/specification/user-profile-settings.md`

## Overview

Content.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/user-profile-settings.md")

  assert_eq "Topic uses kebab-case from filename" "true" "$(echo "$content" | grep -q '^topic: user-profile-settings$' && echo true || echo false)"

  teardown
}

# --- Test 15: Beads format with epic -> plan_id ---
test_epic_to_plan_id() {
  setup

  cat > "$PLAN_DIR/docman-python-sdk.md" << 'EOF'
---
format: beads
epic: docman-api-python-0c8
---

# Plan Reference: DocMan Python SDK

**Specification**: `docs/workflow/specification/docman-python-sdk.md`
**Created**: 2026-01-12

## About This Plan

This plan is managed via Beads.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/docman-python-sdk.md")

  assert_eq "Beads format preserved" "true" "$(echo "$content" | grep -q '^format: beads$' && echo true || echo false)"
  assert_eq "Epic migrated to plan_id" "true" "$(echo "$content" | grep -q '^plan_id: docman-api-python-0c8$' && echo true || echo false)"
  assert_eq "Date extracted from Created field" "true" "$(echo "$content" | grep -q '^date: 2026-01-12$' && echo true || echo false)"
  assert_eq "Epic field removed" "false" "$(echo "$content" | grep -q '^epic:' && echo true || echo false)"

  teardown
}

# --- Test 16: Linear format with project -> plan_id ---
test_project_to_plan_id() {
  setup

  cat > "$PLAN_DIR/linear-plan.md" << 'EOF'
---
format: linear
project: my-linear-project
---

# Plan Reference: Linear Plan

**Specification**: `docs/workflow/specification/linear-plan.md`
**Created**: 2026-01-18

## About This Plan

This plan is managed via Linear.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/linear-plan.md")

  assert_eq "Linear format preserved" "true" "$(echo "$content" | grep -q '^format: linear$' && echo true || echo false)"
  assert_eq "Project migrated to plan_id" "true" "$(echo "$content" | grep -q '^plan_id: my-linear-project$' && echo true || echo false)"
  assert_eq "Project field removed" "false" "$(echo "$content" | grep -q '^project:' && echo true || echo false)"

  teardown
}

# --- Test 17: Created field as alternative to Date ---
test_created_field() {
  setup

  cat > "$PLAN_DIR/created-field.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: Created Field Test

**Created**: 2026-01-15
**Status**: Draft
**Specification**: `docs/workflow/specification/created-field.md`

## Overview

Uses Created instead of Date.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/created-field.md")

  assert_eq "Date extracted from Created field" "true" "$(echo "$content" | grep -q '^date: 2026-01-15$' && echo true || echo false)"

  teardown
}

# --- Test 18: No plan_id when original has no epic/project ---
test_no_plan_id() {
  setup

  cat > "$PLAN_DIR/no-plan-id.md" << 'EOF'
---
format: local-markdown
---

# Implementation Plan: No Plan ID

**Specification**: `docs/workflow/specification/no-plan-id.md`
**Date**: 2026-01-20

## Overview

Local markdown format, no external ID.
EOF

  run_migration
  content=$(cat "$PLAN_DIR/no-plan-id.md")

  assert_eq "No plan_id when original had no epic/project" "false" "$(echo "$content" | grep -q '^plan_id:' && echo true || echo false)"

  teardown
}

# --- Test 19: Body with --- horizontal rules preserved ---
test_body_horizontal_rules() {
  setup

  cat > "$PLAN_DIR/hr-rules.md" << 'TESTEOF'
---
format: local-markdown
---

# Implementation Plan: HR Rules

**Date**: 2024-12-01
**Status**: Draft
**Specification**: `docs/workflow/specification/hr-rules.md`

## Phase 1: Setup

Setup tasks here.

---

## Phase 2: Core

Core tasks here.

---

## Phase 3: Cleanup

Cleanup tasks here.
TESTEOF

  run_migration
  content=$(cat "$PLAN_DIR/hr-rules.md")

  assert_eq "Format preserved in frontmatter" "true" "$(echo "$content" | grep -q '^format: local-markdown$' && echo true || echo false)"
  assert_eq "Topic extracted from filename" "true" "$(echo "$content" | grep -q '^topic: hr-rules$' && echo true || echo false)"
  assert_eq "Status mapped correctly" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  body_after=$(sed -n '/^## /,$p' "$PLAN_DIR/hr-rules.md")
  assert_eq "Phase 1 section preserved" "true" "$(echo "$body_after" | grep -q '^## Phase 1: Setup$' && echo true || echo false)"
  assert_eq "Phase 2 section preserved" "true" "$(echo "$body_after" | grep -q '^## Phase 2: Core$' && echo true || echo false)"
  assert_eq "Phase 3 section preserved" "true" "$(echo "$body_after" | grep -q '^## Phase 3: Cleanup$' && echo true || echo false)"
  assert_eq "Horizontal rules preserved in body" "true" "$(echo "$body_after" | grep -q '^---$' && echo true || echo false)"

  teardown
}

# --- Test 20: Exact body content preservation ---
test_exact_body_preservation() {
  setup

  cat > "$PLAN_DIR/exact-body.md" << 'TESTEOF'
---
format: beads
epic: PROJ-123
---

# Plan Reference: Exact Body

**Specification**: `docs/workflow/specification/exact-body.md`
**Created**: 2026-01-10

## Overview

Plan overview paragraph.

---

## Phase 1: Database

| Task | Status | Notes |
|------|--------|-------|
| Create migrations | pending | Schema first |
| Seed data | pending | After migrations |

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
});
```

---

## Phase 2: API

| Task | Status | Notes |
|------|--------|-------|
| REST endpoints | pending | CRUD |
| Auth middleware | pending | JWT |
TESTEOF

  body_before=$(sed -n '/^## /,$p' "$PLAN_DIR/exact-body.md")
  run_migration
  body_after=$(sed -n '/^## /,$p' "$PLAN_DIR/exact-body.md")

  assert_eq "Body content exactly preserved after migration" "$body_before" "$body_after"

  content=$(cat "$PLAN_DIR/exact-body.md")
  assert_eq "Format preserved" "true" "$(echo "$content" | grep -q '^format: beads$' && echo true || echo false)"
  assert_eq "Epic migrated to plan_id" "true" "$(echo "$content" | grep -q '^plan_id: PROJ-123$' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 003 tests..."
echo ""

test_draft_with_partial_frontmatter
test_ready_status
test_in_progress_status
test_completed_status
test_no_partial_frontmatter
test_no_date_field
test_no_spec_field
test_spec_path_extraction
test_beads_format
test_already_has_full_frontmatter
test_no_legacy_format
test_idempotency
test_content_preservation
test_kebab_case_topic
test_epic_to_plan_id
test_project_to_plan_id
test_created_field
test_no_plan_id
test_body_horizontal_rules
test_exact_body_preservation

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
