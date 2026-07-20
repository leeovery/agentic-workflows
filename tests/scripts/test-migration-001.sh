#!/bin/bash
# Tests for migration 001: discussion-frontmatter
# Run: bash tests/scripts/test-migration-001.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/001-discussion-frontmatter.sh"

PASS=0
FAIL=0

report_update() { : ; }
report_skip() { : ; }

# Portable inode read: GNU coreutils (stat -c) or BSD/macOS (stat -f).
_file_inode() { stat -c %i "$1" 2>/dev/null || stat -f %i "$1" 2>/dev/null; }

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
  TEST_DIR=$(mktemp -d /tmp/migration-001-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run_migration() {
  cd "$TEST_DIR"
  DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
  source "$MIGRATION"
}

# --- Test 1: Legacy format with Exploring status ---
test_legacy_exploring() {
  setup

  cat > "$DISCUSSION_DIR/api-design.md" << 'EOF'
# Discussion: API Design

**Date**: 2024-01-15
**Status**: Exploring

## Context

We need to design the API.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/api-design.md")

  assert_eq "File starts with frontmatter delimiter" "---" "$(head -1 "$DISCUSSION_DIR/api-design.md")"
  assert_eq "Topic extracted from filename" "true" "$(echo "$content" | grep -q '^topic: api-design$' && echo true || echo false)"
  assert_eq "Exploring status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "Date extracted" "true" "$(echo "$content" | grep -q '^date: 2024-01-15$' && echo true || echo false)"
  assert_eq "H1 heading preserved" "true" "$(echo "$content" | grep -q '^# Discussion: API Design$' && echo true || echo false)"
  assert_eq "Content sections preserved" "true" "$(echo "$content" | grep -q '^## Context$' && echo true || echo false)"

  teardown
}

# --- Test 2: Legacy format with Deciding status ---
test_legacy_deciding() {
  setup

  cat > "$DISCUSSION_DIR/auth-flow.md" << 'EOF'
# Discussion: Auth Flow

**Date**: 2024-02-20
**Status**: Deciding

## Options

Option A or B.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/auth-flow.md")

  assert_eq "Deciding status mapped to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"

  teardown
}

# --- Test 3: Legacy format with Concluded status ---
test_legacy_concluded() {
  setup

  cat > "$DISCUSSION_DIR/caching.md" << 'EOF'
# Discussion: Caching Strategy

**Date**: 2024-03-10
**Status**: Concluded

## Decision

We chose Redis.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/caching.md")

  assert_eq "Concluded status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 4: Legacy format with Complete status ---
test_legacy_complete() {
  setup

  cat > "$DISCUSSION_DIR/database.md" << 'EOF'
# Discussion: Database Choice

**Date**: 2024-04-01
**Status**: Complete

## Decision

PostgreSQL selected.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/database.md")

  assert_eq "Complete status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 5: Legacy format with emoji status ---
test_legacy_emoji_status() {
  setup

  cat > "$DISCUSSION_DIR/logging.md" << 'EOF'
# Discussion: Logging

**Date**: 2024-05-15
**Status**: ✅ Complete

## Decision

Structured logging with JSON.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/logging.md")

  assert_eq "Emoji Complete status mapped to concluded" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 6: Legacy format with alternate colon placement ---
test_alternate_colon() {
  setup

  cat > "$DISCUSSION_DIR/testing.md" << 'EOF'
# Discussion: Testing Strategy

**Date**: 2024-06-01
**Status:** Concluded

## Decision

TDD approach.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/testing.md")

  assert_eq "Alternate colon format handled" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"

  teardown
}

# --- Test 7: Legacy format with Started field instead of Date ---
test_started_field() {
  setup

  cat > "$DISCUSSION_DIR/deployment.md" << 'EOF'
# Discussion: Deployment

**Started:** 2024-07-01
**Status**: Exploring

## Context

Deployment options.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/deployment.md")

  assert_eq "Date extracted from Started field" "true" "$(echo "$content" | grep -q '^date: 2024-07-01$' && echo true || echo false)"

  teardown
}

# --- Test 8: Legacy format without date field ---
test_no_date() {
  setup

  cat > "$DISCUSSION_DIR/no-date.md" << 'EOF'
# Discussion: No Date

**Status**: Exploring

## Context

Missing date.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/no-date.md")
  today=$(date +%Y-%m-%d)

  assert_eq "Date defaults to today when not found" "true" "$(echo "$content" | grep -q "^date: $today$" && echo true || echo false)"

  teardown
}

# --- Test 9: File already has frontmatter (should skip) ---
test_already_has_frontmatter() {
  setup

  cat > "$DISCUSSION_DIR/existing.md" << 'EOF'
---
topic: existing
status: concluded
date: 2024-01-01
---

# Discussion: Existing

## Overview

Already migrated content.
EOF

  original_content=$(cat "$DISCUSSION_DIR/existing.md")
  run_migration
  new_content=$(cat "$DISCUSSION_DIR/existing.md")

  assert_eq "File with frontmatter unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 10: File without legacy format (should skip) ---
test_no_legacy_format() {
  setup

  cat > "$DISCUSSION_DIR/weird.md" << 'EOF'
# Some Random Document

This has no status or date fields.

## Section

Content here.
EOF

  original_content=$(cat "$DISCUSSION_DIR/weird.md")
  run_migration
  new_content=$(cat "$DISCUSSION_DIR/weird.md")

  assert_eq "File without legacy format unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 11: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$DISCUSSION_DIR/idempotent.md" << 'EOF'
# Discussion: Idempotent Test

**Date**: 2024-08-01
**Status**: Exploring

## Context

Content.
EOF

  run_migration
  first_run=$(cat "$DISCUSSION_DIR/idempotent.md")

  run_migration
  second_run=$(cat "$DISCUSSION_DIR/idempotent.md")

  assert_eq "Second migration run produces same result" "$first_run" "$second_run"

  teardown
}

# --- Test 12: Content preservation (multiple sections) ---
test_content_preservation() {
  setup

  cat > "$DISCUSSION_DIR/full-discussion.md" << 'EOF'
# Discussion: Full Discussion

**Date**: 2024-09-01
**Status**: Concluded

## Context

Background info.

## Options

- Option A
- Option B

## Decision

We chose Option A.

## Consequences

Some impacts.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/full-discussion.md")

  assert_eq "Context section preserved" "true" "$(echo "$content" | grep -q '^## Context$' && echo true || echo false)"
  assert_eq "Options section preserved" "true" "$(echo "$content" | grep -q '^## Options$' && echo true || echo false)"
  assert_eq "Decision section preserved" "true" "$(echo "$content" | grep -q '^## Decision$' && echo true || echo false)"
  assert_eq "Consequences section preserved" "true" "$(echo "$content" | grep -q '^## Consequences$' && echo true || echo false)"
  assert_eq "List content preserved" "true" "$(echo "$content" | grep -qF 'Option A' && echo true || echo false)"

  teardown
}

# --- Test 13: Kebab-case topic from filename ---
test_kebab_case_topic() {
  setup

  cat > "$DISCUSSION_DIR/user-authentication-flow.md" << 'EOF'
# Discussion: User Authentication Flow

**Date**: 2024-10-01
**Status**: Exploring

## Context

Content.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/user-authentication-flow.md")

  assert_eq "Topic uses kebab-case from filename" "true" "$(echo "$content" | grep -q '^topic: user-authentication-flow$' && echo true || echo false)"

  teardown
}

# --- Test 14: Body with multiple --- horizontal rules preserved ---
test_body_horizontal_rules() {
  setup

  cat > "$DISCUSSION_DIR/multi-hr.md" << 'TESTEOF'
# Discussion: Multi HR

**Date**: 2024-11-01
**Status**: Exploring

## Questions

What is the approach?

---

## Answers

We do X.

---

## Follow-up

More questions here.

---

## Final Notes

Wrap up.
TESTEOF

  body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/multi-hr.md")
  run_migration
  content=$(cat "$DISCUSSION_DIR/multi-hr.md")
  body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/multi-hr.md")

  assert_eq "Frontmatter status is correct" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "Frontmatter topic is correct" "true" "$(echo "$content" | grep -q '^topic: multi-hr$' && echo true || echo false)"
  assert_eq "All body --- horizontal rules preserved exactly" "$body_before" "$body_after"

  teardown
}

# --- Test 15: Body with code blocks, tables, and special characters ---
test_special_chars() {
  setup

  cat > "$DISCUSSION_DIR/special-chars.md" << 'TESTEOF'
# Discussion: Special Chars

**Date**: 2024-11-02
**Status**: Deciding

## Overview

Here is a table:

| Column A | Column B | Column C |
|----------|----------|----------|
| value1   | value2   | value3   |

## Code Example

```go
func main() {
	fmt.Println("hello \"world\"")
	path := "C:\\Users\\test"
}
```

## Inline Code

Use `grep -E "pattern|other"` to search.

Also check `$HOME/.config` for settings.
TESTEOF

  body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/special-chars.md")
  run_migration
  content=$(cat "$DISCUSSION_DIR/special-chars.md")
  body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/special-chars.md")

  assert_eq "Frontmatter status correct" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "Body with code blocks, tables, and special chars preserved exactly" "$body_before" "$body_after"

  teardown
}

# --- Test 16: Exact body content preservation after migration ---
test_exact_body_preservation() {
  setup

  cat > "$DISCUSSION_DIR/exact-body.md" << 'TESTEOF'
# Discussion: Exact Body

**Date**: 2024-11-03
**Status**: Concluded

## Context

This discussion can't be simplified. It has "quoted text" and backslashes: C:\path\to\file.

---

## Options

- Option A: Use `redis-cli --scan`
- Option B: Use the API

| Approach | Pros | Cons |
|----------|------|------|
| A        | Fast | Complex |
| B        | Simple | Slow |

---

## Decision

```bash
#!/bin/bash
echo "We chose option A"
VAR='single quotes'
VAR2="double \"escaped\" quotes"
```

---

## Implementation Notes

1. First step
2. Second step
   - Sub-item with special chars: @#$%^&*()
   - Another sub-item

Final paragraph with apostrophes: don't, won't, can't.
TESTEOF

  body_before=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/exact-body.md")
  run_migration
  content=$(cat "$DISCUSSION_DIR/exact-body.md")
  body_after=$(sed -n '/^## /,$p' "$DISCUSSION_DIR/exact-body.md")

  assert_eq "Frontmatter status correct" "true" "$(echo "$content" | grep -q '^status: concluded$' && echo true || echo false)"
  assert_eq "Frontmatter topic correct" "true" "$(echo "$content" | grep -q '^topic: exact-body$' && echo true || echo false)"
  assert_eq "Complex body content preserved exactly after migration" "$body_before" "$body_after"

  teardown
}

# --- Hostile: Date present but no Status line — must not crash the chain ---
# The file matches the legacy check on **Date** but has no **Status**. Under
# `set -eo pipefail` the unguarded status grep used to abort the run.
test_date_only_no_status() {
  setup

  cat > "$DISCUSSION_DIR/date-only.md" << 'EOF'
# Discussion: Date Only

**Date**: 2024-03-01

## Context

Some content.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/date-only.md")

  assert_eq "date-only: migrated to frontmatter" "---" "$(head -1 "$DISCUSSION_DIR/date-only.md")"
  assert_eq "date-only: status defaulted to in-progress" "true" "$(echo "$content" | grep -q '^status: in-progress$' && echo true || echo false)"
  assert_eq "date-only: date preserved" "true" "$(echo "$content" | grep -q '^date: 2024-03-01$' && echo true || echo false)"
  assert_eq "date-only: body section preserved" "true" "$(echo "$content" | grep -q '^## Context$' && echo true || echo false)"

  teardown
}

# --- Hostile: no ## heading, but a body — the body must be preserved ---
# The old no-section fallback set content="" and rewrote the file as
# frontmatter + H1 only, deleting the document body.
test_no_section_preserves_body() {
  setup

  cat > "$DISCUSSION_DIR/no-section.md" << 'EOF'
# Discussion: No Section

**Date**: 2024-03-02
**Status**: Concluded

This is body prose with no section heading.

More body content that must survive migration.
EOF

  run_migration
  content=$(cat "$DISCUSSION_DIR/no-section.md")

  assert_eq "no-section: first body line preserved" "true" "$(echo "$content" | grep -qF 'This is body prose with no section heading.' && echo true || echo false)"
  assert_eq "no-section: later body line preserved" "true" "$(echo "$content" | grep -qF 'More body content that must survive migration.' && echo true || echo false)"
  assert_eq "no-section: H1 preserved" "true" "$(echo "$content" | grep -q '^# Discussion: No Section$' && echo true || echo false)"

  teardown
}

# --- Hostile (crash-safety): file replaced via tmp + atomic rename ---
# The old `> "$file"` truncates in place (a mid-write kill leaves a truncated
# file the skip-check treats as migrated). tmp-then-mv replaces the file with a
# new inode atomically — the destination is never observed half-written.
test_atomic_write_new_inode() {
  setup

  cat > "$DISCUSSION_DIR/atomic.md" << 'EOF'
# Discussion: Atomic

**Status**: Exploring

## Context

Body.
EOF

  local inode_before inode_after
  inode_before=$(_file_inode "$DISCUSSION_DIR/atomic.md")
  run_migration
  inode_after=$(_file_inode "$DISCUSSION_DIR/atomic.md")

  assert_eq "atomic: file replaced via tmp+rename (inode changes)" "true" "$([ "$inode_before" != "$inode_after" ] && echo true || echo false)"
  assert_eq "atomic: no temp residue left" "false" "$(ls "$DISCUSSION_DIR"/*.tmp.* >/dev/null 2>&1 && echo true || echo false)"
  assert_eq "atomic: content migrated" "---" "$(head -1 "$DISCUSSION_DIR/atomic.md")"

  teardown
}

# --- Run all tests ---
echo "Running migration 001 tests..."
echo ""

test_legacy_exploring
test_legacy_deciding
test_legacy_concluded
test_legacy_complete
test_legacy_emoji_status
test_alternate_colon
test_started_field
test_no_date
test_already_has_frontmatter
test_no_legacy_format
test_idempotency
test_content_preservation
test_kebab_case_topic
test_body_horizontal_rules
test_special_chars
test_exact_body_preservation
test_date_only_no_status
test_no_section_preserves_body
test_atomic_write_new_inode

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
