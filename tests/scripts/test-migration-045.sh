#!/bin/bash
#
# Tests for migration 045: discussion-map-to-manifest
#
# Run: bash tests/scripts/test-migration-045.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/045-discussion-map-to-manifest.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-045-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# Write a manifest with one discussion item of the given status.
write_manifest() {
  local wu="$1" status="$2"
  mkdir -p "$TEST_DIR/.workflows/$wu/discussion"
  cat > "$TEST_DIR/.workflows/$wu/manifest.json" <<EOF
{
  "name": "$wu",
  "work_type": "epic",
  "status": "in-progress",
  "description": "Test epic",
  "phases": {
    "discussion": {
      "items": {
        "auth-flow": {
          "status": "$status"
        }
      }
    }
  }
}
EOF
}

# Read a JSON path from a work unit's manifest (empty output when absent).
read_manifest() {
  local wu="$1" expr="$2"
  node -e "
    const m = JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/$wu/manifest.json', 'utf8'));
    const v = $expr;
    console.log(v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v));
  "
}

# A discussion file with a Discussion Map section (mixed states, nested children).
write_discussion_with_map() {
  local wu="$1"
  cat > "$TEST_DIR/.workflows/$wu/discussion/auth-flow.md" <<'EOF'
# Discussion: Auth Flow

## Context

Why we are discussing.

## Discussion Map

A living index of subtopics.

### States

- **pending** (`○`) — identified but not yet explored

### Map

  Discussion Map — Auth Flow (4 subtopics — 1 decided · 1 converging · 1 exploring · 1 pending)

  ┌─ ✓ Subsystem Prefix Taxonomy [decided]
  ├─ → Token Refresh [converging]
  │  ├─ ◐ Refresh Rotation [exploring]
  │  └─ ○ Grace Window [pending]
  └─ ○ Session Storage [pending]

---

## Subsystem Prefix Taxonomy

### Decision
We decided.

## Summary

### Open Threads
- (none)

## Triage

(none)
EOF
}

# --- Test 1: Happy path — map rows land as manifest subtopics ---
test_happy_path() {
  setup

  write_manifest epic-a in-progress
  write_discussion_with_map epic-a

  source "$MIGRATION"

  assert_eq "subtopics written" \
    '{"subsystem-prefix-taxonomy":{"status":"decided","parent":null},"token-refresh":{"status":"converging","parent":null},"refresh-rotation":{"status":"exploring","parent":"token-refresh"},"grace-window":{"status":"pending","parent":"token-refresh"},"session-storage":{"status":"pending","parent":null}}' \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics")"

  teardown
}

# --- Test 2: Nested children — parent linkage from gutter indentation ---
test_nested_children() {
  setup

  write_manifest epic-a in-progress
  write_discussion_with_map epic-a

  source "$MIGRATION"

  assert_eq "child parent set" "token-refresh" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics['refresh-rotation'].parent")"
  assert_eq "last parent's child (no gutter bar) nested" "token-refresh" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics['grace-window'].parent")"
  assert_eq "top-level row has null parent" "null" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics['session-storage'].parent")"

  teardown
}

# --- Test 3: No-op — discussion file without a map section ---
test_no_map_section() {
  setup

  write_manifest epic-a in-progress
  cat > "$TEST_DIR/.workflows/epic-a/discussion/auth-flow.md" <<'EOF'
# Discussion: Auth Flow

## Context

No map here.

## Summary
EOF

  source "$MIGRATION"

  assert_eq "no subtopics written" "" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics")"

  teardown
}

# --- Test 4: No-op — completed discussion item is skipped entirely ---
test_completed_item_skipped() {
  setup

  write_manifest epic-a completed
  write_discussion_with_map epic-a

  source "$MIGRATION"

  assert_eq "completed item untouched" "" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics")"

  teardown
}

# --- Test 5: Idempotency — run twice, same result, existing subtopics never overwritten ---
test_idempotency() {
  setup

  write_manifest epic-a in-progress
  write_discussion_with_map epic-a

  source "$MIGRATION"
  local first
  first="$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics")"

  # Hand-advance a state between runs — a second run must not clobber it.
  node -e "
    const fs = require('fs');
    const p = '$TEST_DIR/.workflows/epic-a/manifest.json';
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    m.phases.discussion.items['auth-flow'].subtopics['session-storage'].status = 'decided';
    fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  "

  source "$MIGRATION"

  assert_eq "first run parsed rows" "true" "$([ -n "$first" ] && echo true || echo false)"
  assert_eq "second run preserved the advanced state" "decided" \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics['session-storage'].status")"

  teardown
}

# --- Test 6: Content preservation — unrelated manifest fields untouched ---
test_content_preservation() {
  setup

  write_manifest epic-a in-progress
  node -e "
    const fs = require('fs');
    const p = '$TEST_DIR/.workflows/epic-a/manifest.json';
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    m.seeds = [{ path: 'seeds/x.md', source: 'inbox:idea' }];
    m.phases.research = { items: { 'auth-flow': { status: 'completed' } } };
    fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  "
  write_discussion_with_map epic-a
  local file_before
  file_before="$(cat "$TEST_DIR/.workflows/epic-a/discussion/auth-flow.md")"

  source "$MIGRATION"

  assert_eq "work_type preserved" "epic" "$(read_manifest epic-a "m.work_type")"
  assert_eq "seeds preserved" '[{"path":"seeds/x.md","source":"inbox:idea"}]' "$(read_manifest epic-a "m.seeds")"
  assert_eq "research phase preserved" '{"items":{"auth-flow":{"status":"completed"}}}' "$(read_manifest epic-a "m.phases.research")"
  assert_eq "item status preserved" "in-progress" "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].status")"
  assert_eq "discussion file untouched" "true" \
    "$([ "$file_before" = "$(cat "$TEST_DIR/.workflows/epic-a/discussion/auth-flow.md")" ] && echo true || echo false)"

  teardown
}

# --- Test 7: Unparseable rows are skipped, clean rows still land ---
test_unparseable_row_skip() {
  setup

  write_manifest epic-a in-progress
  cat > "$TEST_DIR/.workflows/epic-a/discussion/auth-flow.md" <<'EOF'
# Discussion: Auth Flow

## Discussion Map

  Discussion Map — Auth Flow (3 subtopics)

  ┌─ ✓ Good Row [decided]
  ├─ broken row without a state tag
  ├─ ◐ Strange State [finished]
  └─ ○ Another Good Row [pending]

## Summary
EOF

  source "$MIGRATION"

  assert_eq "only clean rows written" \
    '{"good-row":{"status":"decided","parent":null},"another-good-row":{"status":"pending","parent":null}}' \
    "$(read_manifest epic-a "m.phases.discussion.items['auth-flow'].subtopics")"

  teardown
}

# --- Test 8: All rows unparseable — item left untouched (parse doubt) ---
test_all_rows_unparseable() {
  setup

  write_manifest epic-a in-progress
  cat > "$TEST_DIR/.workflows/epic-a/discussion/auth-flow.md" <<'EOF'
# Discussion: Auth Flow

## Discussion Map

  ┌─ no tag here
  └─ also no tag

## Summary
EOF

  local before
  before="$(cat "$TEST_DIR/.workflows/epic-a/manifest.json")"

  source "$MIGRATION"

  assert_eq "manifest untouched on parse doubt" "true" \
    "$([ "$before" = "$(cat "$TEST_DIR/.workflows/epic-a/manifest.json")" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running migration 045 tests..."
echo ""

test_happy_path
test_nested_children
test_no_map_section
test_completed_item_skipped
test_idempotency
test_content_preservation
test_unparseable_row_skip
test_all_rows_unparseable

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
