#!/bin/bash
# Tests for migration 002: specification-frontmatter
# Run: bash tests/scripts/test-migration-002.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/002-specification-frontmatter.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-002-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/specification"
  SPEC_DIR="$TEST_DIR/docs/workflow/specification"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run_migration() {
  cd "$TEST_DIR"
  SPEC_DIR="$TEST_DIR/docs/workflow/specification"
  source "$MIGRATION"
}

# --- Test 1: Legacy format with Building specification status ---
test_building_specification() {
  setup

  cat > "$SPEC_DIR/user-auth.md" << 'EOF'
# Specification: User Authentication

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-01-15

## Overview

This is the spec content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/user-auth.md")

  assert_eq "File starts with frontmatter delimiter" "---" "$(head -1 "$SPEC_DIR/user-auth.md")"
  assert_eq "Topic extracted from filename" "true" "$(echo "$content" | grep -q '^topic: user-auth$' && echo true || echo false)"
  assert_eq "Status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "Type preserved as feature" "true" "$(echo "$content" | grep -q '^type: feature$' && echo true || echo false)"
  assert_eq "Date extracted from Last Updated" "true" "$(echo "$content" | grep -q '^date: 2024-01-15$' && echo true || echo false)"
  assert_eq "H1 heading preserved" "true" "$(echo "$content" | grep -q '^# Specification: User Authentication$' && echo true || echo false)"
  assert_eq "Content sections preserved" "true" "$(echo "$content" | grep -q '^## Overview$' && echo true || echo false)"

  teardown
}

# --- Test 2: Legacy format with Complete status ---
test_complete_status() {
  setup

  cat > "$SPEC_DIR/billing-system.md" << 'EOF'
# Specification: Billing System

**Status**: Complete
**Type**: cross-cutting
**Last Updated**: 2024-02-20

## Overview

Billing content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/billing-system.md")

  assert_eq "Complete status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"
  assert_eq "Type preserved as cross-cutting" "true" "$(echo "$content" | grep -q '^type: cross-cutting$' && echo true || echo false)"

  teardown
}

# --- Test 3: Legacy format with Completed status (variant) ---
test_completed_status() {
  setup

  cat > "$SPEC_DIR/api-design.md" << 'EOF'
# Specification: API Design

**Status**: Completed
**Type**: feature
**Date**: 2024-03-10

## Overview

API content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/api-design.md")

  assert_eq "Completed status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"
  assert_eq "Date extracted from Date field" "true" "$(echo "$content" | grep -q '^date: 2024-03-10$' && echo true || echo false)"

  teardown
}

# --- Test 4: Legacy format with Building status (short form) ---
test_building_short() {
  setup

  cat > "$SPEC_DIR/caching.md" << 'EOF'
# Specification: Caching Strategy

**Status**: Building
**Type**: cross-cutting
**Last Updated**: 2024-04-01

## Overview

Caching content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/caching.md")

  assert_eq "Building status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  teardown
}

# --- Test 5: Legacy format without Type field ---
test_no_type_field() {
  setup

  cat > "$SPEC_DIR/notifications.md" << 'EOF'
# Specification: Notifications

**Status**: Building specification
**Last Updated**: 2024-05-15

## Overview

Notification content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/notifications.md")

  assert_eq "Type left empty when not found" "true" "$(echo "$content" | grep -q '^type: *$' && echo true || echo false)"

  teardown
}

# --- Test 6: Legacy format without date field ---
test_no_date_field() {
  setup

  cat > "$SPEC_DIR/logging.md" << 'EOF'
# Specification: Logging

**Status**: Building specification
**Type**: cross-cutting

## Overview

Logging content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/logging.md")
  today=$(date +%Y-%m-%d)

  assert_eq "Date defaults to today when not found" "true" "$(echo "$content" | grep -q "^date: $today$" && echo true || echo false)"

  teardown
}

# --- Test 7: File already has frontmatter (should skip) ---
test_already_has_frontmatter() {
  setup

  cat > "$SPEC_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
type: feature
date: 2024-01-01
---

# Specification: Existing

## Overview

Already migrated content.
EOF

  original_content=$(cat "$SPEC_DIR/existing.md")
  run_migration
  new_content=$(cat "$SPEC_DIR/existing.md")

  assert_eq "File with frontmatter unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 8: File without legacy format (should skip) ---
test_no_legacy_format() {
  setup

  cat > "$SPEC_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status or type fields.

## Section

Content here.
EOF

  original_content=$(cat "$SPEC_DIR/weird.md")
  run_migration
  new_content=$(cat "$SPEC_DIR/weird.md")

  assert_eq "File without legacy format unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 9: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$SPEC_DIR/idempotent.md" << 'EOF'
# Specification: Idempotent Test

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-06-01

## Overview

Content.
EOF

  run_migration
  first_run=$(cat "$SPEC_DIR/idempotent.md")

  run_migration
  second_run=$(cat "$SPEC_DIR/idempotent.md")

  assert_eq "Second migration run produces same result" "$first_run" "$second_run"

  teardown
}

# --- Test 10: Status variation - Draft ---
test_draft_status() {
  setup

  cat > "$SPEC_DIR/draft-spec.md" << 'EOF'
# Specification: Draft Spec

**Status**: Draft
**Type**: feature
**Last Updated**: 2024-07-01

## Overview

Draft content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/draft-spec.md")

  assert_eq "Draft status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  teardown
}

# --- Test 11: Status variation - Done ---
test_done_status() {
  setup

  cat > "$SPEC_DIR/done-spec.md" << 'EOF'
# Specification: Done Spec

**Status**: Done
**Type**: feature
**Last Updated**: 2024-08-01

## Overview

Done content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/done-spec.md")

  assert_eq "Done status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 12: Content preservation (multiple sections) ---
test_content_preservation() {
  setup

  cat > "$SPEC_DIR/full-spec.md" << 'EOF'
# Specification: Full Spec

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-09-01

## Overview

Overview content.

## Architecture

Architecture details.

## Edge Cases

- Case 1
- Case 2

## Dependencies

None.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/full-spec.md")

  assert_eq "Overview section preserved" "true" "$(echo "$content" | grep -q '^## Overview$' && echo true || echo false)"
  assert_eq "Architecture section preserved" "true" "$(echo "$content" | grep -q '^## Architecture$' && echo true || echo false)"
  assert_eq "Edge Cases section preserved" "true" "$(echo "$content" | grep -q '^## Edge Cases$' && echo true || echo false)"
  assert_eq "List content preserved" "true" "$(echo "$content" | grep -qF -- '- Case 1' && echo true || echo false)"
  assert_eq "Dependencies section preserved" "true" "$(echo "$content" | grep -q '^## Dependencies$' && echo true || echo false)"

  teardown
}

# --- Test 13: Kebab-case topic from filename ---
test_kebab_case_topic() {
  setup

  cat > "$SPEC_DIR/user-profile-settings.md" << 'EOF'
# Specification: User Profile Settings

**Status**: Building specification
**Type**: feature
**Last Updated**: 2024-10-01

## Overview

Content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/user-profile-settings.md")

  assert_eq "Topic uses kebab-case from filename" "true" "$(echo "$content" | grep -q '^topic: user-profile-settings$' && echo true || echo false)"

  teardown
}

# --- Test 14: Sources field with single source ---
test_single_source() {
  setup

  cat > "$SPEC_DIR/migration-spec.md" << 'EOF'
# Specification: Migration

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-01-25
**Sources**: migration-subcommand

---

## Specification

### Overview

The migration command imports task data.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/migration-spec.md")

  assert_eq "Sources field present in frontmatter" "true" "$(echo "$content" | grep -q '^sources:$' && echo true || echo false)"
  assert_eq "Single source preserved as YAML list item" "true" "$(echo "$content" | grep -q '^  - migration-subcommand$' && echo true || echo false)"

  teardown
}

# --- Test 15: Sources field with multiple sources ---
test_multiple_sources() {
  setup

  cat > "$SPEC_DIR/tick-core.md" << 'EOF'
# Specification: Tick Core

**Status**: Complete
**Type**: feature
**Last Updated**: 2026-01-24
**Sources**: project-fundamentals, data-schema-design, freshness-dual-write, id-format-implementation, hierarchy-dependency-model, cli-command-structure-ux, toon-output-format, tui

---

## Specification

### Vision & Scope

Tick is a minimal task tracker.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/tick-core.md")

  assert_eq "Sources field present in frontmatter" "true" "$(echo "$content" | grep -q '^sources:$' && echo true || echo false)"
  assert_eq "First source preserved" "true" "$(echo "$content" | grep -q '^  - project-fundamentals$' && echo true || echo false)"
  assert_eq "Second source preserved" "true" "$(echo "$content" | grep -q '^  - data-schema-design$' && echo true || echo false)"
  assert_eq "Last source preserved" "true" "$(echo "$content" | grep -q '^  - tui$' && echo true || echo false)"

  teardown
}

# --- Test 16: Specification without Sources field ---
test_no_sources_field() {
  setup

  cat > "$SPEC_DIR/no-sources.md" << 'EOF'
# Specification: No Sources

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-01-24

---

## Overview

This spec has no sources.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/no-sources.md")

  assert_eq "No sources field when source not present" "false" "$(echo "$content" | grep -q '^sources:' && echo true || echo false)"

  teardown
}

# --- Test 17: Body with --- horizontal rules preserved ---
test_body_horizontal_rules() {
  setup

  cat > "$SPEC_DIR/hr-body.md" << 'TESTEOF'
# Specification: Test

**Status**: Complete
**Last Updated**: 2024-01-01

---

## Overview

Content here.

---

## Dependencies

More content.

---

## Final Section

End content.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/hr-body.md")

  assert_eq "Frontmatter status correct" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"
  assert_eq "Frontmatter date correct" "true" "$(echo "$content" | grep -q '^date: 2024-01-01$' && echo true || echo false)"

  body=$(sed -n '/^## /,$p' "$SPEC_DIR/hr-body.md")
  assert_eq "Overview section preserved" "true" "$(echo "$body" | grep -q '^## Overview$' && echo true || echo false)"
  assert_eq "Dependencies section preserved" "true" "$(echo "$body" | grep -q '^## Dependencies$' && echo true || echo false)"
  assert_eq "Final Section preserved" "true" "$(echo "$body" | grep -q '^## Final Section$' && echo true || echo false)"

  teardown
}

# --- Test 18: Exact body content preservation ---
test_exact_body_preservation() {
  setup

  cat > "$SPEC_DIR/exact-body.md" << 'TESTEOF'
# Specification: Exact Body

**Status**: Complete
**Type**: feature
**Last Updated**: 2024-03-15

---

## Overview

Content with **bold** and `code`.

---

## Data Model

| Column | Type | Notes |
|--------|------|-------|
| id     | int  | PK    |
| name   | text | required |

## Code Example

```php
$value = "hello";
echo $value;
```

## Edge Cases

- Item with "quotes"
- Item with `backticks`
- Item with *emphasis*

---

## Final Notes

Done.
TESTEOF

  body_before=$(sed -n '/^## /,$p' "$SPEC_DIR/exact-body.md")
  run_migration
  body_after=$(sed -n '/^## /,$p' "$SPEC_DIR/exact-body.md")

  assert_eq "Body content exactly preserved after migration" "$body_before" "$body_after"

  teardown
}

# --- Test 19: Building specification status with complex body ---
test_building_complex_body() {
  setup

  cat > "$SPEC_DIR/building-complex.md" << 'TESTEOF'
# Specification: Building Complex

**Status**: Building specification
**Type**: cross-cutting
**Last Updated**: 2024-06-10

---

## Overview

Webhook processing system.

| Event | Handler | Priority |
|-------|---------|----------|
| create | onCreate | high |
| update | onUpdate | medium |

---

## Watchers

Content about watchers.

---

## Integration

Final integration notes.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/building-complex.md")

  assert_eq "Building specification maps to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  body=$(sed -n '/^## /,$p' "$SPEC_DIR/building-complex.md")
  assert_eq "Overview section preserved" "true" "$(echo "$body" | grep -q '^## Overview$' && echo true || echo false)"
  assert_eq "Watchers section preserved" "true" "$(echo "$body" | grep -q '^## Watchers$' && echo true || echo false)"
  assert_eq "Integration section preserved" "true" "$(echo "$body" | grep -q '^## Integration$' && echo true || echo false)"
  assert_eq "Table content preserved" "true" "$(echo "$body" | grep -qF '| create | onCreate | high |' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 002 tests..."
echo ""

test_building_specification
test_complete_status
test_completed_status
test_building_short
test_no_type_field
test_no_date_field
test_already_has_frontmatter
test_no_legacy_format
test_idempotency
test_draft_status
test_done_status
test_content_preservation
test_kebab_case_topic
test_single_source
test_multiple_sources
test_no_sources_field
test_body_horizontal_rules
test_exact_body_preservation
test_building_complex_body

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
