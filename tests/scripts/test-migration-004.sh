#!/bin/bash
# Tests for migration 004: sources-object-format
# Run: bash tests/scripts/test-migration-004.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/004-sources-object-format.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-004-test.XXXXXX)
  mkdir -p "$TEST_DIR/docs/workflow/specification"
  mkdir -p "$TEST_DIR/docs/workflow/discussion"
  SPEC_DIR="$TEST_DIR/docs/workflow/specification"
  DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
}

teardown() {
  rm -rf "$TEST_DIR"
}

run_migration() {
  cd "$TEST_DIR"
  SPEC_DIR="$TEST_DIR/docs/workflow/specification"
  DISCUSSION_DIR="$TEST_DIR/docs/workflow/discussion"
  source "$MIGRATION"
}

# --- Test 1: Single source conversion ---
test_single_source() {
  setup

  cat > "$SPEC_DIR/single-source.md" << 'EOF'
---
topic: single-source
status: concluded
type: feature
date: 2024-01-15
sources:
  - auth-flow
---

# Specification: Single Source

## Overview

Content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/single-source.md")

  assert_eq "Source name converted to object" "true" "$(echo "$content" | grep -qF -- '- name: auth-flow' && echo true || echo false)"
  assert_eq "Status set to incorporated" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"

  teardown
}

# --- Test 2: Multiple sources conversion ---
test_multiple_sources() {
  setup

  cat > "$SPEC_DIR/multi-source.md" << 'EOF'
---
topic: multi-source
status: in-progress
type: feature
date: 2024-02-20
sources:
  - topic-a
  - topic-b
  - topic-c
---

# Specification: Multi Source

## Overview

Content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/multi-source.md")

  assert_eq "First source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-a' && echo true || echo false)"
  assert_eq "Second source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-b' && echo true || echo false)"
  assert_eq "Third source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-c' && echo true || echo false)"
  assert_eq "Status set to incorporated" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"

  teardown
}

# --- Test 3: Sources with quotes ---
test_quoted_sources() {
  setup

  cat > "$SPEC_DIR/quoted-sources.md" << 'EOF'
---
topic: quoted-sources
status: concluded
type: feature
date: 2024-03-10
sources:
  - "quoted-topic"
  - "another-topic"
---

# Specification: Quoted Sources

## Overview

Content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/quoted-sources.md")

  assert_eq "Quoted source name extracted" "true" "$(echo "$content" | grep -qF -- '- name: quoted-topic' && echo true || echo false)"
  assert_eq "Second quoted source extracted" "true" "$(echo "$content" | grep -qF -- '- name: another-topic' && echo true || echo false)"

  teardown
}

# --- Test 4: Already migrated (object format) - should skip ---
test_already_migrated() {
  setup

  cat > "$SPEC_DIR/already-migrated.md" << 'EOF'
---
topic: already-migrated
status: concluded
type: feature
date: 2024-04-01
sources:
  - name: existing-topic
    status: incorporated
  - name: another-topic
    status: pending
---

# Specification: Already Migrated

## Overview

Content here.
EOF

  original_content=$(cat "$SPEC_DIR/already-migrated.md")
  run_migration
  new_content=$(cat "$SPEC_DIR/already-migrated.md")

  assert_eq "File with object format unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 5: No sources field WITH matching discussion ---
test_no_sources_with_discussion() {
  setup

  cat > "$DISCUSSION_DIR/has-discussion.md" << 'EOF'
---
topic: has-discussion
status: concluded
date: 2024-05-15
---

# Discussion: Has Discussion

Some discussion content.
EOF

  cat > "$SPEC_DIR/has-discussion.md" << 'EOF'
---
topic: has-discussion
status: in-progress
type: feature
date: 2024-05-15
---

# Specification: Has Discussion

## Overview

Content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/has-discussion.md")

  assert_eq "Sources field added" "true" "$(echo "$content" | grep -qF 'sources:' && echo true || echo false)"
  assert_eq "Matching discussion added as source" "true" "$(echo "$content" | grep -qF -- '- name: has-discussion' && echo true || echo false)"
  assert_eq "Status set to incorporated" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"

  teardown
}

# --- Test 6: No sources field WITHOUT matching discussion ---
test_no_sources_no_discussion() {
  setup

  cat > "$SPEC_DIR/no-discussion.md" << 'EOF'
---
topic: no-discussion
status: in-progress
type: feature
date: 2024-05-15
---

# Specification: No Discussion

## Overview

Content here.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/no-discussion.md")

  assert_eq "Empty sources array added" "true" "$(echo "$content" | grep -qF 'sources: []' && echo true || echo false)"

  teardown
}

# --- Test 7: No frontmatter - should skip ---
test_no_frontmatter() {
  setup

  cat > "$SPEC_DIR/no-frontmatter.md" << 'EOF'
# Specification: No Frontmatter

## Overview

This file has no YAML frontmatter.
EOF

  original_content=$(cat "$SPEC_DIR/no-frontmatter.md")
  run_migration
  new_content=$(cat "$SPEC_DIR/no-frontmatter.md")

  assert_eq "File without frontmatter unchanged" "$original_content" "$new_content"

  teardown
}

# --- Test 8: Idempotency (running migration twice) ---
test_idempotency() {
  setup

  cat > "$SPEC_DIR/idempotent.md" << 'EOF'
---
topic: idempotent
status: concluded
type: feature
date: 2024-06-01
sources:
  - source-one
  - source-two
---

# Specification: Idempotent

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

# --- Test 9: Content preservation after migration ---
test_content_preservation() {
  setup

  cat > "$SPEC_DIR/preserve-content.md" << 'EOF'
---
topic: preserve-content
status: concluded
type: feature
date: 2024-07-01
sources:
  - discussion-one
  - discussion-two
---

# Specification: Preserve Content

## Overview

This is the overview content.

## Architecture

### Component A

Details about component A.

### Component B

Details about component B.

## Edge Cases

- Edge case 1
- Edge case 2
- Edge case 3

## Dependencies

None.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/preserve-content.md")

  assert_eq "H1 heading preserved" "true" "$(echo "$content" | grep -qF '# Specification: Preserve Content' && echo true || echo false)"
  assert_eq "Overview section preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Architecture section preserved" "true" "$(echo "$content" | grep -qF '## Architecture' && echo true || echo false)"
  assert_eq "Nested heading preserved" "true" "$(echo "$content" | grep -qF '### Component A' && echo true || echo false)"
  assert_eq "Edge Cases section preserved" "true" "$(echo "$content" | grep -qF '## Edge Cases' && echo true || echo false)"
  assert_eq "List content preserved" "true" "$(echo "$content" | grep -qF -- '- Edge case 1' && echo true || echo false)"
  assert_eq "Dependencies section preserved" "true" "$(echo "$content" | grep -qF '## Dependencies' && echo true || echo false)"

  teardown
}

# --- Test 10: Other frontmatter fields preserved ---
test_other_fields_preserved() {
  setup

  cat > "$SPEC_DIR/other-fields.md" << 'EOF'
---
topic: other-fields
status: concluded
type: feature
date: 2024-08-01
sources:
  - topic-x
superseded_by: newer-spec
---

# Specification: Other Fields

## Overview

Content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/other-fields.md")

  assert_eq "Topic field preserved" "true" "$(echo "$content" | grep -qF 'topic: other-fields' && echo true || echo false)"
  assert_eq "Status field preserved" "true" "$(echo "$content" | grep -qF 'status: concluded' && echo true || echo false)"
  assert_eq "Type field preserved" "true" "$(echo "$content" | grep -qF 'type: feature' && echo true || echo false)"
  assert_eq "Date field preserved" "true" "$(echo "$content" | grep -qF 'date: 2024-08-01' && echo true || echo false)"
  assert_eq "Superseded_by field preserved" "true" "$(echo "$content" | grep -qF 'superseded_by: newer-spec' && echo true || echo false)"
  assert_eq "Source converted to object" "true" "$(echo "$content" | grep -qF -- '- name: topic-x' && echo true || echo false)"

  teardown
}

# --- Test 11: Empty sources array - should skip ---
test_empty_sources() {
  setup

  cat > "$SPEC_DIR/empty-sources.md" << 'EOF'
---
topic: empty-sources
status: in-progress
type: feature
date: 2024-09-01
sources:
---

# Specification: Empty Sources

## Overview

Content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/empty-sources.md")

  assert_eq "Frontmatter delimiters present" "true" "$(echo "$content" | grep -q '^---$' && echo true || echo false)"
  assert_eq "Topic preserved" "true" "$(echo "$content" | grep -qF 'topic: empty-sources' && echo true || echo false)"

  teardown
}

# --- Test 12: Sources is last field in frontmatter ---
test_sources_last() {
  setup

  cat > "$SPEC_DIR/sources-last.md" << 'EOF'
---
topic: sources-last
status: concluded
type: feature
date: 2024-10-01
sources:
  - final-topic
---

# Specification: Sources Last

## Overview

Content.
EOF

  run_migration
  content=$(cat "$SPEC_DIR/sources-last.md")

  assert_eq "Source converted when last in frontmatter" "true" "$(echo "$content" | grep -qF -- '- name: final-topic' && echo true || echo false)"
  assert_eq "Status added" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"

  teardown
}

# --- Test 13: Sources last with --- horizontal rules in body ---
test_sources_last_with_hr_body() {
  setup

  cat > "$SPEC_DIR/body-with-hr.md" << 'TESTEOF'
---
topic: body-with-hr
status: concluded
type: feature
date: 2024-11-01
sources:
  - my-discussion
---

# Specification: Body With HR

## Overview

Some content here.

---

## Dependencies

| Dep | Reason |
|-----|--------|
| core | Needed first |

### Notes

- The plugin architecture itself can be designed in parallel
- Item two

---

## More content after second HR

Final paragraph.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/body-with-hr.md")

  assert_eq "Source converted with HR in body" "true" "$(echo "$content" | grep -qF -- '- name: my-discussion' && echo true || echo false)"
  assert_eq "Status added with HR in body" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"
  assert_eq "Overview section preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Dependencies section preserved" "true" "$(echo "$content" | grep -qF '## Dependencies' && echo true || echo false)"
  assert_eq "Content after second HR preserved" "true" "$(echo "$content" | grep -qF '## More content after second HR' && echo true || echo false)"
  assert_eq "Final paragraph preserved" "true" "$(echo "$content" | grep -qF 'Final paragraph.' && echo true || echo false)"
  assert_eq "List item in body preserved" "true" "$(echo "$content" | grep -qF 'The plugin architecture' && echo true || echo false)"

  teardown
}

# --- Test 14: Multiple sources last with rich body content ---
test_rich_body() {
  setup

  cat > "$SPEC_DIR/rich-body.md" << 'TESTEOF'
---
topic: rich-body
status: concluded
type: feature
date: 2024-11-01
sources:
  - topic-one
  - topic-two
  - topic-three
---

# Specification: Rich Body

## Overview

Content with various markdown:

- List item one
- List item two with `code`

### Subsection

```bash
echo "code block"
tick create "Task with quotes" --priority 1
```

---

## Another Section

**Bold** and *italic* text.

| Column A | Column B |
|----------|----------|
| value    | other    |
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/rich-body.md")

  assert_eq "First source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-one' && echo true || echo false)"
  assert_eq "Second source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-two' && echo true || echo false)"
  assert_eq "Third source converted" "true" "$(echo "$content" | grep -qF -- '- name: topic-three' && echo true || echo false)"
  assert_eq "Overview preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Code block with quotes preserved" "true" "$(echo "$content" | grep -qF 'tick create "Task with quotes"' && echo true || echo false)"
  assert_eq "Section after HR preserved" "true" "$(echo "$content" | grep -qF '## Another Section' && echo true || echo false)"
  assert_eq "Table preserved" "true" "$(echo "$content" | grep -qF 'Column A' && echo true || echo false)"

  teardown
}

# --- Test 15: No sources with matching discussion and --- in body ---
test_no_sources_with_discussion_and_hr() {
  setup

  cat > "$DISCUSSION_DIR/has-hr-body.md" << 'EOF'
---
topic: has-hr-body
status: concluded
date: 2024-11-01
---

# Discussion: Has HR Body

## Content
EOF

  cat > "$SPEC_DIR/has-hr-body.md" << 'TESTEOF'
---
topic: has-hr-body
status: in-progress
type: feature
date: 2024-11-01
---

# Specification: Has HR Body

## Overview

Content here.

---

## Dependencies

More content here.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/has-hr-body.md")

  assert_eq "Matching discussion added" "true" "$(echo "$content" | grep -qF -- '- name: has-hr-body' && echo true || echo false)"
  assert_eq "Status set" "true" "$(echo "$content" | grep -qF 'status: incorporated' && echo true || echo false)"
  assert_eq "Overview preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Dependencies preserved" "true" "$(echo "$content" | grep -qF '## Dependencies' && echo true || echo false)"
  assert_eq "Content after HR preserved" "true" "$(echo "$content" | grep -qF 'More content here.' && echo true || echo false)"

  teardown
}

# --- Test 16: Real-world pattern - many sources + body with lists, tables, code, HR ---
test_real_world_many_sources() {
  setup

  cat > "$SPEC_DIR/tick-core-pattern.md" << 'TESTEOF'
---
topic: tick-core-pattern
status: concluded
type: feature
date: 2026-01-25
sources:
  - project-fundamentals
  - data-schema-design
  - freshness-dual-write
  - id-format-implementation
  - hierarchy-dependency-model
  - cli-command-structure-ux
  - toon-output-format
  - tui
---

# Specification: Tick Core Pattern

## Overview

Tick uses a dual-storage architecture:

- **JSONL** (`tasks.jsonl`) - Source of truth
- **SQLite** (`.tick/cache.db`) - Query cache

### Task Schema

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes |
| `title` | string | Yes |
| `status` | enum | Yes |

#### Field Constraints

- **status**: Only valid transitions enforced
- **priority**: Integer 0-4 only
- **blocked_by**: Must reference existing task IDs

### CLI Commands

```bash
tick create "Setup authentication" --priority 1
tick create "Login endpoint" --blocked-by tick-a1b2
```

**Example output:**
```
$ tick show tick-xyz
Error: Task 'tick-xyz' not found
```

---

## Dependencies

Prerequisites:

| Dependency | Why Blocked |
|------------|-------------|
| **core** | Needed first |

### Notes

- The plugin architecture can be designed in parallel
- Provider implementation requires understanding the format

---

## More Content

Final section with content.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/tick-core-pattern.md")

  assert_eq "First of 8 sources converted" "true" "$(echo "$content" | grep -qF -- '- name: project-fundamentals' && echo true || echo false)"
  assert_eq "Last of 8 sources converted" "true" "$(echo "$content" | grep -qF -- '- name: tui' && echo true || echo false)"
  assert_eq "Overview preserved" "true" "$(echo "$content" | grep -qF '## Overview' && echo true || echo false)"
  assert_eq "Inline code preserved" "true" "$(echo "$content" | grep -qF '`tasks.jsonl`' && echo true || echo false)"
  assert_eq "Table preserved" "true" "$(echo "$content" | grep -qF '| Field | Type | Required |' && echo true || echo false)"
  assert_eq "Code block with quotes preserved" "true" "$(echo "$content" | grep -qF 'tick create "Setup authentication"' && echo true || echo false)"
  assert_eq "Dependencies after HR preserved" "true" "$(echo "$content" | grep -qF '## Dependencies' && echo true || echo false)"
  assert_eq "Content after second HR preserved" "true" "$(echo "$content" | grep -qF '## More Content' && echo true || echo false)"
  assert_eq "Final paragraph preserved" "true" "$(echo "$content" | grep -qF 'Final section with content.' && echo true || echo false)"

  teardown
}

# --- Test 17: Real-world pattern - legacy spec without frontmatter (should skip) ---
test_legacy_no_frontmatter() {
  setup

  cat > "$SPEC_DIR/evvi-pattern.md" << 'TESTEOF'
# Specification: API Design

**Status**: Complete
**Last Updated**: 2026-01-17

---

## API Philosophy

Content here with **bold** and `code`.

---

## More Content

Final content.
TESTEOF

  run_migration
  content=$(cat "$SPEC_DIR/evvi-pattern.md")

  assert_eq "Legacy H1 unchanged" "true" "$(echo "$content" | grep -qF '# Specification: API Design' && echo true || echo false)"
  assert_eq "Legacy status line present" "true" "$(echo "$content" | grep -qF 'Status' && echo true || echo false)"
  assert_eq "Body unchanged" "true" "$(echo "$content" | grep -qF '## API Philosophy' && echo true || echo false)"
  assert_eq "More content unchanged" "true" "$(echo "$content" | grep -qF '## More Content' && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 004 tests..."
echo ""

test_single_source
test_multiple_sources
test_quoted_sources
test_already_migrated
test_no_sources_with_discussion
test_no_sources_no_discussion
test_no_frontmatter
test_idempotency
test_content_preservation
test_other_fields_preserved
test_empty_sources
test_sources_last
test_sources_last_with_hr_body
test_rich_body
test_no_sources_with_discussion_and_hr
test_real_world_many_sources
test_legacy_no_frontmatter

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
