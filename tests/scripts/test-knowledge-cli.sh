#!/usr/bin/env bash
# CLI dispatch and command tests for the knowledge base bundle.
# Tests against the built bundle (knowledge.cjs).

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE="$SCRIPT_DIR/../../skills/workflow-knowledge/scripts/knowledge.cjs"
MANIFEST_JS="$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.cjs"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    echo "    expected: $expected"
    echo "    actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

# Create a temp dir as the project root for each test group.
TEST_ROOT=""
setup_project() {
  TEST_ROOT=$(mktemp -d)
  mkdir -p "$TEST_ROOT/.workflows/.knowledge"
}

teardown_project() {
  [ -n "$TEST_ROOT" ] && rm -rf "$TEST_ROOT"
  TEST_ROOT=""
}

# Create a work unit via the manifest CLI.
create_work_unit() {
  local name="$1" type="$2" desc="$3"
  cd "$TEST_ROOT"
  node "$MANIFEST_JS" init "$name" --work-type "$type" --description "$desc" >/dev/null 2>&1
}

# Write a stub config for the knowledge base.
write_stub_config() {
  mkdir -p "$TEST_ROOT/.workflows/.knowledge"
  cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128 } }
CONF
}

# Write a keyword-only config (no provider).
write_keyword_config() {
  mkdir -p "$TEST_ROOT/.workflows/.knowledge"
  cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": {} }
CONF
}

# Create a discussion artifact file with some markdown content.
create_discussion_file() {
  local wu="$1" topic="$2"
  mkdir -p "$TEST_ROOT/.workflows/$wu/discussion"
  cat > "$TEST_ROOT/.workflows/$wu/discussion/$topic.md" <<'MD'
---
status: completed
---

# Discussion

## Topic One

Some content about topic one that has enough text to exceed the
keep_whole_below threshold of the chunking config.

More paragraphs to bulk up the content. This needs to be above
50 lines to trigger normal chunking behaviour.

Line after line of content to ensure we get past the threshold.
Line 10. Line 11. Line 12. Line 13. Line 14. Line 15.
Line 16. Line 17. Line 18. Line 19. Line 20.
Line 21. Line 22. Line 23. Line 24. Line 25.
Line 26. Line 27. Line 28. Line 29. Line 30.
Line 31. Line 32. Line 33. Line 34. Line 35.
Line 36. Line 37. Line 38. Line 39. Line 40.
Line 41. Line 42. Line 43. Line 44. Line 45.
Line 46. Line 47. Line 48. Line 49. Line 50.

## Topic Two

More content about topic two.
More lines here as well.
MD
}

# Create a specification artifact file.
create_spec_file() {
  local wu="$1" topic="$2"
  mkdir -p "$TEST_ROOT/.workflows/$wu/specification/$topic"
  cat > "$TEST_ROOT/.workflows/$wu/specification/$topic/specification.md" <<'MD'
# Specification

## Overview

This is a specification document.

## Requirements

Requirement details here. Enough content to be chunked.
Line after line. More content.
MD
}

# Create a research artifact file.
create_research_file() {
  local wu="$1" filename="$2"
  mkdir -p "$TEST_ROOT/.workflows/$wu/research"
  cat > "$TEST_ROOT/.workflows/$wu/research/$filename.md" <<'MD'
# Research

Some research content.
MD
}

# Run the knowledge CLI from the test project root.
run_kb() {
  cd "$TEST_ROOT"
  node "$BUNDLE" "$@"
}

# ============================================================================
# DISPATCH TESTS
# ============================================================================

echo "=== Dispatch Tests ==="

# --- Test 1: No command prints usage and exits 1 ---
echo "Test 1: No command prints usage"
output=$(node "$BUNDLE" 2>&1 || true)
exit_code=0
node "$BUNDLE" 2>/dev/null || exit_code=$?
assert_eq "exits with code 1" "1" "$exit_code"
assert_eq "prints usage" "true" "$(echo "$output" | grep -q 'Usage:' && echo true || echo false)"

# --- Test 2: Unknown command prints error and exits 1 ---
echo "Test 2: Unknown command"
output=$(node "$BUNDLE" foobar 2>&1 || true)
exit_code=0
node "$BUNDLE" foobar 2>/dev/null || exit_code=$?
assert_eq "exits with code 1" "1" "$exit_code"
assert_eq "mentions unknown command" "true" "$(echo "$output" | grep -q 'Unknown command' && echo true || echo false)"

# --- Test 3: setup aborts when stdin is not a TTY ---
echo "Test 3: setup requires an interactive terminal"
exit_code=0
output=$(echo '' | node "$BUNDLE" setup 2>&1 || true)
echo '' | node "$BUNDLE" setup 2>/dev/null || exit_code=$?
assert_eq "setup exits non-zero without a TTY" "1" "$exit_code"
assert_eq "setup mentions interactive terminal" "true" "$(echo "$output" | grep -q 'interactive terminal' && echo true || echo false)"

# --- Test 4: Known Phase 3 commands dispatch without unknown-command error ---
echo "Test 4: Phase 3 commands dispatch correctly"
for cmd in index query check; do
  output=$(node "$BUNDLE" "$cmd" 2>&1 || true)
  assert_eq "$cmd does not say unknown command" "false" "$(echo "$output" | grep -q 'Unknown command' && echo true || echo false)"
done

# --- Test 4b: setup dispatches (not an unknown command) ---
echo "Test 4b: setup routes to the wizard handler"
output=$(echo '' | node "$BUNDLE" setup 2>&1 || true)
assert_eq "setup does not say unknown command" "false" "$(echo "$output" | grep -q 'Unknown command' && echo true || echo false)"
assert_eq "setup does not say not yet implemented" "false" "$(echo "$output" | grep -q 'not yet implemented' && echo true || echo false)"

# ============================================================================
# INDEX COMMAND TESTS
# ============================================================================

echo ""
echo "=== Index Command Tests ==="

# --- Test 5: Index a discussion file and report chunk count ---
echo "Test 5: Index a discussion file"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1)
assert_eq "reports indexed chunks" "true" "$(echo "$output" | grep -q 'Indexed.*chunks from' && echo true || echo false)"
assert_eq "metadata.json created" "true" "$([ -f "$TEST_ROOT/.workflows/.knowledge/metadata.json" ] && echo true || echo false)"
assert_eq "store.msp created" "true" "$([ -f "$TEST_ROOT/.workflows/.knowledge/store.msp" ] && echo true || echo false)"
teardown_project

# --- Test 6: Index a specification file (nested path) ---
echo "Test 6: Index a specification file"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_spec_file "auth-flow" "auth-flow"
output=$(run_kb index .workflows/auth-flow/specification/auth-flow/specification.md 2>&1)
assert_eq "indexes spec file" "true" "$(echo "$output" | grep -q 'Indexed.*chunks from' && echo true || echo false)"
teardown_project

# --- Test 7: Index a research file ---
echo "Test 7: Index a research file"
setup_project
create_work_unit "payments" "epic" "Payments"
write_stub_config
create_research_file "payments" "exploration"
output=$(run_kb index .workflows/payments/research/exploration.md 2>&1)
assert_eq "indexes research file" "true" "$(echo "$output" | grep -q 'Indexed.*chunks from' && echo true || echo false)"
teardown_project

# --- Test 8: Re-index replaces previous chunks (not duplicates) ---
echo "Test 8: Re-index replaces previous chunks"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
output1=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1)
count1=$(echo "$output1" | grep -oE 'Indexed [0-9]+' | grep -oE '[0-9]+')
output2=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1)
count2=$(echo "$output2" | grep -oE 'Indexed [0-9]+' | grep -oE '[0-9]+')
assert_eq "chunk count stays same on re-index" "$count1" "$count2"
teardown_project

# --- Test 9: Provider mismatch is refused (case 2) ---
echo "Test 9: Provider mismatch refused"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
# Index with stub provider to populate metadata.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Now change the metadata to simulate a different provider.
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.provider = 'openai';
  m.model = 'text-embedding-3-small';
  m.dimensions = 1536;
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
exit_code=0
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1 || true)
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1 || exit_code=$?
assert_eq "exits non-zero on mismatch" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "mentions rebuild" "true" "$(echo "$output" | grep -q 'rebuild' && echo true || echo false)"
teardown_project

# --- Test 10: No provider in config but store has vectors (case 3) ---
echo "Test 10: No provider in config but store has vectors"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Switch to keyword-only config.
write_keyword_config
exit_code=0
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1 || true)
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1 || exit_code=$?
assert_eq "exits non-zero on downgrade" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "mentions rebuild" "true" "$(echo "$output" | grep -q 'rebuild' && echo true || echo false)"
teardown_project

# --- Test 11: Keyword-only store indexes WITHOUT vectors when config has provider (case 4) ---
echo "Test 11: Keyword-only store with provider in config (case 4)"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
# First index in keyword-only mode.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Verify metadata has null provider.
meta_provider=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(String(m.provider))")
assert_eq "metadata.provider is null" "null" "$meta_provider"
# Now switch to stub config and re-index — should succeed (case 4).
write_stub_config
exit_code=0
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1)
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1 || exit_code=$?
assert_eq "succeeds in case 4" "0" "$exit_code"
# Verify metadata provider NOT upgraded.
meta_provider2=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(String(m.provider))")
assert_eq "metadata.provider still null after case 4" "null" "$meta_provider2"
teardown_project

# --- Test 12: Keyword-only mode from scratch ---
echo "Test 12: Keyword-only mode from scratch"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
exit_code=0
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1)
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1 || exit_code=$?
assert_eq "succeeds in keyword-only from scratch" "0" "$exit_code"
assert_eq "reports chunks" "true" "$(echo "$output" | grep -q 'Indexed.*chunks from' && echo true || echo false)"
teardown_project

# --- Test 13: Error for file not in .workflows/ ---
echo "Test 13: Error for file not in .workflows/"
setup_project
echo "hello" > "$TEST_ROOT/random.md"
exit_code=0
cd "$TEST_ROOT"
node "$BUNDLE" index random.md 2>/dev/null || exit_code=$?
assert_eq "rejects non-workflow file" "1" "$exit_code"
teardown_project

# --- Test 14: Error for non-indexed phase ---
echo "Test 14: Error for non-indexed phase"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/auth-flow/planning/auth-flow"
echo "# Plan" > "$TEST_ROOT/.workflows/auth-flow/planning/auth-flow/planning.md"
exit_code=0
cd "$TEST_ROOT"
output=$(node "$BUNDLE" index .workflows/auth-flow/planning/auth-flow/planning.md 2>&1 || true)
node "$BUNDLE" index .workflows/auth-flow/planning/auth-flow/planning.md 2>/dev/null || exit_code=$?
assert_eq "rejects non-indexed phase" "1" "$exit_code"
teardown_project

# --- Test 15: metadata.json created with empty pending array on first index ---
echo "Test 15: metadata.json has empty pending array on first index"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(JSON.stringify(m.pending))")
assert_eq "pending is empty array" "[]" "$pending"
teardown_project

# --- Test 16: last_indexed updated; catch-up removes nonexistent pending items ---
echo "Test 16: last_indexed updated, catch-up cleans nonexistent pending"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Inject a pending item with a nonexistent file — catch-up will remove it.
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.pending = [{file: 'test.md', failed_at: '2026-01-01T00:00:00Z', error: 'test'}];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
# Re-index — catch-up runs and cleans nonexistent pending file.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(JSON.stringify(m.pending))")
assert_eq "nonexistent pending item removed by catch-up" '[]' "$pending"
teardown_project

# ============================================================================
# QUERY COMMAND TESTS
# ============================================================================

echo ""
echo "=== Query Command Tests ==="

# --- Test 17: Query returns formatted results ---
echo "Test 17: Query returns formatted results"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" 2>&1)
assert_eq "has result count" "true" "$(echo "$output" | grep -qE '\[[0-9]+ results\]' && echo true || echo false)"
assert_eq "has provenance line" "true" "$(echo "$output" | grep -q 'discussion | auth-flow/auth-flow' && echo true || echo false)"
assert_eq "has source line" "true" "$(echo "$output" | grep -q 'Source:' && echo true || echo false)"
teardown_project

# --- Test 18: Query returns [0 results] for non-matching query ---
echo "Test 18: Zero results"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "xyznonexistent123" 2>&1)
assert_eq "shows 0 results" "true" "$(echo "$output" | grep -q '\[0 results\]' && echo true || echo false)"
teardown_project

# --- Test 19: Query filters by --phase ---
echo "Test 19: Filter by --phase"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/auth-flow/specification/auth-flow/specification.md >/dev/null 2>&1
output=$(run_kb query "content" --phase specification 2>&1)
assert_eq "only spec results" "false" "$(echo "$output" | grep -q 'discussion |' && echo true || echo false)"
teardown_project

# --- Test 20: Query respects --limit ---
echo "Test 20: Respects --limit"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" --limit 1 2>&1)
assert_eq "limited to 1 result" "true" "$(echo "$output" | grep -q '\[1 results\]' && echo true || echo false)"
teardown_project

# --- Test 21: Keyword-only mode shows stub note ---
echo "Test 21: Keyword-only mode stub note"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" 2>&1)
assert_eq "shows keyword-only note" "true" "$(echo "$output" | grep -q 'keyword-only mode' && echo true || echo false)"
teardown_project

# --- Test 22: Query refuses provider mismatch ---
echo "Test 22: Provider mismatch refused"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Modify metadata to simulate different provider.
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.provider = 'openai';
  m.model = 'text-embedding-3-small';
  m.dimensions = 1536;
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
exit_code=0
output=$(run_kb query "topic" 2>&1 || true)
run_kb query "topic" >/dev/null 2>&1 || exit_code=$?
assert_eq "query refuses mismatch" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "mentions rebuild" "true" "$(echo "$output" | grep -q 'rebuild' && echo true || echo false)"
teardown_project

# --- Test 23: Stub-to-full upgrade note ---
echo "Test 23: Stub-to-full upgrade note"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Now switch config to have a provider.
write_stub_config
output=$(run_kb query "topic" 2>&1)
assert_eq "shows upgrade note" "true" "$(echo "$output" | grep -q 'keyword-only mode' && echo true || echo false)"
teardown_project

# --- Test 24: Query on empty store returns [0 results] ---
echo "Test 24: Empty store"
setup_project
write_stub_config
output=$(run_kb query "anything" 2>&1)
assert_eq "0 results on empty store" "true" "$(echo "$output" | grep -q '\[0 results\]' && echo true || echo false)"
teardown_project

# --- Test 25: Output format has provenance, content, source ---
echo "Test 25: Output format"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" --limit 1 2>&1)
# Check the provenance line format: [phase | wu/topic | confidence | date]
assert_eq "provenance format" "true" "$(echo "$output" | grep -qE '\[discussion \| auth-flow/auth-flow \| .* \| [0-9]{4}-[0-9]{2}-[0-9]{2}\]' && echo true || echo false)"
teardown_project

# --- Test 26: Nested path rejected for discussion ---
echo "Test 26: Nested discussion path rejected"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/auth-flow/discussion/sub"
echo "# Nested" > "$TEST_ROOT/.workflows/auth-flow/discussion/sub/topic.md"
exit_code=0
cd "$TEST_ROOT"
node "$BUNDLE" index .workflows/auth-flow/discussion/sub/topic.md 2>/dev/null || exit_code=$?
assert_eq "rejects nested discussion path" "1" "$exit_code"
teardown_project

# --- Test 27: File not found for valid workflow path ---
echo "Test 27: File not found for valid workflow path"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
exit_code=0
cd "$TEST_ROOT"
node "$BUNDLE" index .workflows/auth-flow/discussion/auth-flow.md 2>/dev/null || exit_code=$?
assert_eq "rejects missing file" "1" "$exit_code"
teardown_project

# --- Test 28: Index no-args runs bulk mode ---
echo "Test 28: Index no-args runs bulk mode"
setup_project
write_stub_config
exit_code=0
output=$(run_kb index 2>&1 || true)
run_kb index 2>/dev/null || exit_code=$?
assert_eq "index no-args exits 0 (bulk mode)" "0" "$exit_code"
assert_eq "index no-args shows summary" "true" "$(echo "$output" | grep -q 'already indexed' && echo true || echo false)"
teardown_project

# --- Test 29: Query no-args prints usage ---
echo "Test 29: Query no-args prints usage"
setup_project
write_stub_config
exit_code=0
output=$(run_kb query 2>&1 || true)
run_kb query 2>/dev/null || exit_code=$?
assert_eq "query no-args exits 1" "1" "$exit_code"
assert_eq "query no-args shows usage" "true" "$(echo "$output" | grep -q 'Usage:' && echo true || echo false)"
teardown_project

# --- Test 30: Query filters by --work-type comma-separated ---
echo "Test 30: Query filters by --work-type comma-separated"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
create_work_unit "payments" "epic" "Payments"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_research_file "payments" "exploration"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/payments/research/exploration.md >/dev/null 2>&1
output=$(run_kb query "content" --work-type "feature,epic" 2>&1)
assert_eq "comma work-type returns results" "false" "$(echo "$output" | grep -q '\[0 results\]' && echo true || echo false)"
# Filter to only feature — should exclude epic research
output2=$(run_kb query "content" --work-type feature 2>&1)
assert_eq "single work-type filters" "false" "$(echo "$output2" | grep -q 'research |' && echo true || echo false)"
teardown_project

# --- Test 31: Work-unit proximity re-ranking changes order ---
echo "Test 31: Work-unit proximity re-ranking"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
create_work_unit "data-model" "feature" "Data"
write_stub_config
# Create two discussions with similar content so they both match the same query.
mkdir -p "$TEST_ROOT/.workflows/auth-flow/discussion"
mkdir -p "$TEST_ROOT/.workflows/data-model/discussion"
cat > "$TEST_ROOT/.workflows/auth-flow/discussion/auth-flow.md" <<'MD'
# Auth Discussion

## Token Refresh Design

Token refresh intervals must be configured. Rate limiting applies.
The design covers refresh, rotation, and expiry edge cases.
Line padding for chunking threshold. Line 10. Line 11.
Line 12. Line 13. Line 14. Line 15. Line 16. Line 17.
Line 18. Line 19. Line 20. Line 21. Line 22. Line 23.
Line 24. Line 25. Line 26. Line 27. Line 28. Line 29.
Line 30. Line 31. Line 32. Line 33. Line 34. Line 35.
Line 36. Line 37. Line 38. Line 39. Line 40. Line 41.
Line 42. Line 43. Line 44. Line 45. Line 46. Line 47.
Line 48. Line 49. Line 50. Line 51. Line 52. Line 53.
MD
cat > "$TEST_ROOT/.workflows/data-model/discussion/data-model.md" <<'MD'
# Data Model Discussion

## Token Storage Design

Token refresh intervals stored in the data model. Rate limiting applies.
The schema covers refresh, rotation, and expiry edge cases.
Line padding for chunking threshold. Line 10. Line 11.
Line 12. Line 13. Line 14. Line 15. Line 16. Line 17.
Line 18. Line 19. Line 20. Line 21. Line 22. Line 23.
Line 24. Line 25. Line 26. Line 27. Line 28. Line 29.
Line 30. Line 31. Line 32. Line 33. Line 34. Line 35.
Line 36. Line 37. Line 38. Line 39. Line 40. Line 41.
Line 42. Line 43. Line 44. Line 45. Line 46. Line 47.
Line 48. Line 49. Line 50. Line 51. Line 52. Line 53.
MD
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/data-model/discussion/data-model.md >/dev/null 2>&1
# Query with --work-unit auth-flow: auth-flow results should appear first.
output=$(run_kb query "token refresh" --work-unit auth-flow --limit 2 2>&1)
# Extract the first provenance line's work_unit.
first_wu=$(echo "$output" | grep -m1 '^\[discussion' | sed 's/.*| \([^/]*\)\/.*/\1/')
assert_eq "boosted work-unit appears first" "auth-flow" "$first_wu"
teardown_project

# --- Test 32: Query errors when metadata missing but store exists ---
echo "Test 32: Query errors on missing metadata"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
rm "$TEST_ROOT/.workflows/.knowledge/metadata.json"
exit_code=0
output=$(run_kb query "topic" 2>&1 || true)
run_kb query "topic" >/dev/null 2>&1 || exit_code=$?
assert_eq "errors on missing metadata" "1" "$exit_code"
assert_eq "mentions rebuild" "true" "$(echo "$output" | grep -q 'rebuild' && echo true || echo false)"
teardown_project

# ============================================================================
# CHECK COMMAND TESTS
# ============================================================================

echo ""
echo "=== Check Command Tests ==="

# --- Test 33: Check outputs ready when all three conditions met ---
echo "Test 33: Check ready"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb check 2>&1)
exit_code=0
run_kb check >/dev/null 2>&1 || exit_code=$?
assert_eq "outputs ready" "ready" "$(echo "$output" | tr -d '\n')"
assert_eq "exits 0" "0" "$exit_code"
teardown_project

# --- Test 34: Check outputs not-ready when directory is missing ---
echo "Test 34: Check not-ready (missing directory)"
setup_project
rm -rf "$TEST_ROOT/.workflows/.knowledge"
output=$(run_kb check 2>&1)
exit_code=0
run_kb check >/dev/null 2>&1 || exit_code=$?
assert_eq "outputs not-ready" "not-ready" "$(echo "$output" | tr -d '\n')"
assert_eq "exits 0" "0" "$exit_code"
teardown_project

# --- Test 35: Check outputs not-ready when config is missing ---
echo "Test 35: Check not-ready (missing config)"
setup_project
# Directory exists but no config.json.
output=$(run_kb check 2>&1)
exit_code=0
run_kb check >/dev/null 2>&1 || exit_code=$?
assert_eq "outputs not-ready" "not-ready" "$(echo "$output" | tr -d '\n')"
assert_eq "exits 0" "0" "$exit_code"
teardown_project

# --- Test 36: Check outputs not-ready when store is missing ---
echo "Test 36: Check not-ready (missing store)"
setup_project
write_stub_config
# Config exists but no store.msp.
output=$(run_kb check 2>&1)
exit_code=0
run_kb check >/dev/null 2>&1 || exit_code=$?
assert_eq "outputs not-ready" "not-ready" "$(echo "$output" | tr -d '\n')"
assert_eq "exits 0" "0" "$exit_code"
teardown_project

# --- Test 37: Check outputs not-ready when store is corrupted ---
echo "Test 37: Check not-ready (corrupted store)"
setup_project
write_stub_config
echo "this is garbage data not msgpack" > "$TEST_ROOT/.workflows/.knowledge/store.msp"
output=$(run_kb check 2>&1)
exit_code=0
run_kb check >/dev/null 2>&1 || exit_code=$?
assert_eq "outputs not-ready" "not-ready" "$(echo "$output" | tr -d '\n')"
assert_eq "exits 0" "0" "$exit_code"
teardown_project

# ============================================================================
# REMOVE COMMAND TESTS
# ============================================================================

echo ""
echo "=== Remove Command Tests ==="

# --- Test 38: Remove all chunks for a work unit ---
echo "Test 38: Remove all chunks for a work unit"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
create_work_unit "data-model" "feature" "Data"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
create_discussion_file "data-model" "data-model"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/auth-flow/specification/auth-flow/specification.md >/dev/null 2>&1
run_kb index .workflows/data-model/discussion/data-model.md >/dev/null 2>&1
output=$(run_kb remove --work-unit auth-flow 2>&1)
assert_eq "reports removed chunks" "true" "$(echo "$output" | grep -qE 'Removed [1-9][0-9]* chunks for auth-flow' && echo true || echo false)"
# Verify data-model chunks still exist.
query_output=$(run_kb query "content" --limit 10 2>&1)
assert_eq "data-model chunks unaffected" "true" "$(echo "$query_output" | grep -q 'data-model' && echo true || echo false)"
assert_eq "auth-flow chunks gone" "false" "$(echo "$query_output" | grep -q 'auth-flow/auth-flow' && echo true || echo false)"
teardown_project

# --- Test 39: Remove chunks for a work unit + phase ---
echo "Test 39: Remove chunks for work unit + phase"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/auth-flow/specification/auth-flow/specification.md >/dev/null 2>&1
output=$(run_kb remove --work-unit auth-flow --phase discussion 2>&1)
assert_eq "reports removed" "true" "$(echo "$output" | grep -qE 'Removed [1-9][0-9]* chunks for auth-flow/discussion' && echo true || echo false)"
# Spec chunks should still exist.
query_output=$(run_kb query "specification" --limit 10 2>&1)
assert_eq "spec chunks unaffected" "true" "$(echo "$query_output" | grep -q 'specification |' && echo true || echo false)"
teardown_project

# --- Test 40: Remove chunks for specific identity (work unit + phase + topic) ---
echo "Test 40: Remove specific identity"
setup_project
create_work_unit "payments" "epic" "Payments"
write_stub_config
create_spec_file "payments" "billing"
create_spec_file "payments" "invoicing"
run_kb index .workflows/payments/specification/billing/specification.md >/dev/null 2>&1
run_kb index .workflows/payments/specification/invoicing/specification.md >/dev/null 2>&1
output=$(run_kb remove --work-unit payments --phase specification --topic billing 2>&1)
assert_eq "reports removed" "true" "$(echo "$output" | grep -qE 'Removed [1-9][0-9]* chunks for payments/specification/billing' && echo true || echo false)"
# Invoicing chunks should still exist.
query_output=$(run_kb query "specification" --limit 10 2>&1)
assert_eq "invoicing chunks unaffected" "true" "$(echo "$query_output" | grep -q 'invoicing' && echo true || echo false)"
assert_eq "billing chunks gone" "false" "$(echo "$query_output" | grep -q 'billing' && echo true || echo false)"
teardown_project

# --- Test 41: Remove reports 0 when no chunks match ---
echo "Test 41: Remove 0 when no match"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb remove --work-unit nonexistent 2>&1)
assert_eq "reports 0 removed" "true" "$(echo "$output" | grep -q 'Removed 0 chunks' && echo true || echo false)"
teardown_project

# --- Test 42: Remove errors when --topic given without --phase ---
echo "Test 42: Error --topic without --phase"
setup_project
write_stub_config
exit_code=0
output=$(run_kb remove --work-unit auth-flow --topic auth-flow 2>&1 || true)
run_kb remove --work-unit auth-flow --topic auth-flow 2>/dev/null || exit_code=$?
assert_eq "exits 1" "1" "$exit_code"
assert_eq "mentions requires phase" "true" "$(echo "$output" | grep -q 'requires --phase' && echo true || echo false)"
teardown_project

# --- Test 43: Remove errors when --work-unit missing ---
echo "Test 43: Error missing --work-unit"
setup_project
write_stub_config
exit_code=0
output=$(run_kb remove 2>&1 || true)
run_kb remove 2>/dev/null || exit_code=$?
assert_eq "exits 1" "1" "$exit_code"
assert_eq "shows usage" "true" "$(echo "$output" | grep -q 'Usage:' && echo true || echo false)"
teardown_project

# --- Test 44: Remove from empty store reports 0 ---
echo "Test 44: Remove from empty/nonexistent store"
setup_project
write_stub_config
output=$(run_kb remove --work-unit auth-flow 2>&1)
assert_eq "reports 0 removed" "true" "$(echo "$output" | grep -q 'Removed 0 chunks' && echo true || echo false)"
teardown_project

# ============================================================================
# BULK INDEX TESTS
# ============================================================================

echo ""
echo "=== Bulk Index Tests ==="

# Helper: initialize a phase topic in the manifest.
init_phase_topic() {
  local wu="$1" phase="$2" topic="$3" status="$4"
  cd "$TEST_ROOT"
  node "$MANIFEST_JS" init-phase "$wu.$phase.$topic" >/dev/null 2>&1
  if [ -n "$status" ]; then
    node "$MANIFEST_JS" set "$wu.$phase.$topic" status "$status" >/dev/null 2>&1
  fi
}

# --- Test 45: Bulk index discovers and indexes completed artifacts ---
echo "Test 45: Bulk index discovers completed artifacts"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
init_phase_topic "auth-flow" "discussion" "auth-flow" "completed"
output=$(run_kb index 2>&1)
assert_eq "discovers and indexes" "true" "$(echo "$output" | grep -q 'Indexing' && echo true || echo false)"
assert_eq "shows summary" "true" "$(echo "$output" | grep -qE 'Indexed [1-9]' && echo true || echo false)"
teardown_project

# --- Test 46: Bulk index skips already-indexed artifacts ---
echo "Test 46: Bulk index skips already indexed"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
init_phase_topic "auth-flow" "discussion" "auth-flow" "completed"
# Index once.
run_kb index >/dev/null 2>&1
# Index again — should skip.
output=$(run_kb index 2>&1)
assert_eq "skips already indexed" "true" "$(echo "$output" | grep -q '1 already indexed' && echo true || echo false)"
teardown_project

# --- Test 47: Bulk index with no completed artifacts ---
echo "Test 47: Bulk index no completed artifacts"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
init_phase_topic "auth-flow" "discussion" "auth-flow" "in-progress"
output=$(run_kb index 2>&1)
assert_eq "0 files indexed" "true" "$(echo "$output" | grep -q 'Indexed 0 files' && echo true || echo false)"
teardown_project

# ============================================================================
# PENDING QUEUE TESTS
# ============================================================================

echo ""
echo "=== Pending Queue Tests ==="

# --- Test 48: Catch-up processes pending items after single-file index ---
echo "Test 48: Catch-up processes pending items"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
# Index the file first to create store.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Create a spec file and inject it as a pending item.
create_spec_file "auth-flow" "auth-flow"
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.pending = [{file: '.workflows/auth-flow/specification/auth-flow/specification.md', failed_at: '2026-01-01T00:00:00Z', error: 'transient'}];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
# Re-index discussion — catch-up should process the pending spec file.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(JSON.stringify(m.pending))")
assert_eq "pending item caught up" '[]' "$pending"
# Verify spec chunks now exist.
query_output=$(run_kb query "specification" --limit 10 2>&1)
assert_eq "spec chunks indexed by catch-up" "true" "$(echo "$query_output" | grep -q 'specification |' && echo true || echo false)"
teardown_project

# ============================================================================
# COMPACT COMMAND TESTS
# ============================================================================

echo ""
echo "=== Compact Command Tests ==="

# Helper: set completed status and completed_at on a work unit.
set_completed_with_date() {
  local wu="$1" date="$2"
  cd "$TEST_ROOT"
  node "$MANIFEST_JS" set "$wu" status completed >/dev/null 2>&1
  node "$MANIFEST_JS" set "$wu" completed_at "$date" >/dev/null 2>&1
}

# Helper: write config with custom decay_months.
write_config_with_decay() {
  local decay="$1"
  mkdir -p "$TEST_ROOT/.workflows/.knowledge"
  cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<CONF
{ "knowledge": { "provider": "stub", "dimensions": 128, "decay_months": $decay } }
CONF
}

# --- Test 49: Compact removes expired non-spec chunks ---
echo "Test 49: Compact removes expired non-spec chunks"
setup_project
create_work_unit "old-project" "feature" "Old"
write_config_with_decay 6
create_discussion_file "old-project" "old-project"
create_spec_file "old-project" "old-project"
run_kb index .workflows/old-project/discussion/old-project.md >/dev/null 2>&1
run_kb index .workflows/old-project/specification/old-project/specification.md >/dev/null 2>&1
set_completed_with_date "old-project" "2024-01-01"
output=$(run_kb compact 2>&1)
assert_eq "reports compacted chunks" "true" "$(echo "$output" | grep -q 'Compacted:' && echo true || echo false)"
assert_eq "mentions discussion phase" "true" "$(echo "$output" | grep -q '• .*discussion' && echo true || echo false)"
# Spec chunks should still exist.
query_output=$(run_kb query "specification" --limit 10 2>&1)
assert_eq "spec chunks preserved" "true" "$(echo "$query_output" | grep -q 'specification |' && echo true || echo false)"
# Discussion chunks should be gone.
query_output2=$(run_kb query "topic" --limit 10 2>&1)
assert_eq "discussion chunks removed" "false" "$(echo "$query_output2" | grep -q 'discussion |' && echo true || echo false)"
teardown_project

# --- Test 50: Compact preserves in-progress work unit chunks ---
echo "Test 50: Compact preserves in-progress chunks"
setup_project
create_work_unit "active" "feature" "Active"
write_config_with_decay 6
create_discussion_file "active" "active"
run_kb index .workflows/active/discussion/active.md >/dev/null 2>&1
# Work unit is in-progress (default) — compact should not touch it.
output=$(run_kb compact 2>&1)
assert_eq "no output (nothing to compact)" "" "$output"
query_output=$(run_kb query "topic" --limit 10 2>&1)
assert_eq "chunks preserved" "true" "$(echo "$query_output" | grep -q 'active' && echo true || echo false)"
teardown_project

# --- Test 51: Compact preserves recently completed chunks ---
echo "Test 51: Compact preserves recent chunks"
setup_project
create_work_unit "recent" "feature" "Recent"
write_config_with_decay 6
create_discussion_file "recent" "recent"
run_kb index .workflows/recent/discussion/recent.md >/dev/null 2>&1
# Completed yesterday — within TTL.
set_completed_with_date "recent" "$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d '1 day ago' +%Y-%m-%d)"
output=$(run_kb compact 2>&1)
assert_eq "no output (within TTL)" "" "$output"
teardown_project

# --- Test 52: Dry-run shows plan without removing ---
echo "Test 52: Dry-run shows plan without removing"
setup_project
create_work_unit "old2" "feature" "Old2"
write_config_with_decay 6
create_discussion_file "old2" "old2"
run_kb index .workflows/old2/discussion/old2.md >/dev/null 2>&1
set_completed_with_date "old2" "2024-01-01"
output=$(run_kb compact --dry-run 2>&1)
assert_eq "shows dry-run prefix" "true" "$(echo "$output" | grep -q '\[dry-run\]' && echo true || echo false)"
# Chunks should still exist.
query_output=$(run_kb query "topic" --limit 10 2>&1)
assert_eq "chunks not removed in dry-run" "true" "$(echo "$query_output" | grep -q 'old2' && echo true || echo false)"
teardown_project

# --- Test 53: decay_months: false disables compaction ---
echo "Test 53: decay_months false disables compaction"
setup_project
create_work_unit "disabled" "feature" "Disabled"
mkdir -p "$TEST_ROOT/.workflows/.knowledge"
cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128, "decay_months": false } }
CONF
create_discussion_file "disabled" "disabled"
run_kb index .workflows/disabled/discussion/disabled.md >/dev/null 2>&1
set_completed_with_date "disabled" "2020-01-01"
output=$(run_kb compact 2>&1)
assert_eq "shows disabled" "true" "$(echo "$output" | grep -q 'disabled' && echo true || echo false)"
teardown_project

# --- Test 54: decay_months: 0 expires immediately ---
echo "Test 54: decay_months 0 expires immediately"
setup_project
create_work_unit "immediate" "feature" "Immediate"
write_config_with_decay 0
create_discussion_file "immediate" "immediate"
run_kb index .workflows/immediate/discussion/immediate.md >/dev/null 2>&1
set_completed_with_date "immediate" "$(date +%Y-%m-%d)"
output=$(run_kb compact 2>&1)
assert_eq "removes with decay 0" "true" "$(echo "$output" | grep -q 'Compacted:' && echo true || echo false)"
teardown_project

# ============================================================================
# STATUS COMMAND TESTS
# ============================================================================

echo ""
echo "=== Status Command Tests ==="

# --- Test 55: Status reports chunk counts ---
echo "Test 55: Status reports chunk counts"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb status 2>&1)
assert_eq "shows total chunks" "true" "$(echo "$output" | grep -q 'Total chunks:' && echo true || echo false)"
assert_eq "shows work unit breakdown" "true" "$(echo "$output" | grep -q 'auth-flow:' && echo true || echo false)"
assert_eq "shows store size" "true" "$(echo "$output" | grep -q 'Store size:' && echo true || echo false)"
teardown_project

# --- Test 56: Status reports pending queue ---
echo "Test 56: Status reports pending items"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Inject a pending item.
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.pending = [{file: 'test.md', failed_at: '2026-01-01T00:00:00Z', error: 'API timeout'}];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
output=$(run_kb status 2>&1)
assert_eq "shows pending count" "true" "$(echo "$output" | grep -q 'Pending items: 1' && echo true || echo false)"
assert_eq "shows pending details" "true" "$(echo "$output" | grep -q 'API timeout' && echo true || echo false)"
teardown_project

# --- Test 57: Status on empty store ---
echo "Test 57: Status on empty store"
setup_project
write_stub_config
output=$(run_kb status 2>&1)
assert_eq "shows not initialized" "true" "$(echo "$output" | grep -q 'not initialized' && echo true || echo false)"
teardown_project

# --- Test 58: Status detects orphaned chunks ---
echo "Test 58: Status detects orphaned chunks"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Delete the source file.
rm "$TEST_ROOT/.workflows/auth-flow/discussion/auth-flow.md"
output=$(run_kb status 2>&1)
assert_eq "detects orphans" "true" "$(echo "$output" | grep -q 'Orphaned' && echo true || echo false)"
teardown_project

# --- Test 59: Status detects unindexed artifacts ---
echo "Test 59: Status detects unindexed artifacts"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
init_phase_topic "auth-flow" "discussion" "auth-flow" "completed"
init_phase_topic "auth-flow" "specification" "auth-flow" "completed"
# Index only discussion, not spec.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb status 2>&1)
assert_eq "detects unindexed" "true" "$(echo "$output" | grep -q 'Unindexed' && echo true || echo false)"
teardown_project

# --- Test 60: Status detects cancelled work unit still indexed ---
echo "Test 60: Status detects cancelled still indexed"
setup_project
create_work_unit "cancelled-wu" "feature" "Cancelled"
write_stub_config
create_discussion_file "cancelled-wu" "cancelled-wu"
run_kb index .workflows/cancelled-wu/discussion/cancelled-wu.md >/dev/null 2>&1
cd "$TEST_ROOT" && node "$MANIFEST_JS" set cancelled-wu status cancelled >/dev/null 2>&1
output=$(run_kb status 2>&1)
assert_eq "detects cancelled" "true" "$(echo "$output" | grep -q 'Cancelled work unit still indexed' && echo true || echo false)"
teardown_project

# --- Test 61: Status shows keyword-only mode ---
echo "Test 61: Status shows keyword-only mode"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb status 2>&1)
assert_eq "shows keyword-only" "true" "$(echo "$output" | grep -q 'Keyword-only' && echo true || echo false)"
teardown_project

# ============================================================================
# REBUILD COMMAND TESTS
# ============================================================================

echo ""
echo "=== Rebuild Command Tests ==="

# --- Test 62: Rebuild aborts on wrong confirmation ---
echo "Test 62: Rebuild aborts on wrong confirmation"
setup_project
write_stub_config
exit_code=0
output=$(echo "no" | run_kb rebuild 2>&1 || true)
echo "no" | run_kb rebuild >/dev/null 2>&1 || exit_code=$?
assert_eq "rebuild aborts" "1" "$exit_code"
assert_eq "shows aborted" "true" "$(echo "$output" | grep -q 'Aborted' && echo true || echo false)"
teardown_project

# --- Test 63: Rebuild aborts on empty input ---
echo "Test 63: Rebuild aborts on empty stdin"
setup_project
write_stub_config
exit_code=0
output=$(echo "" | run_kb rebuild 2>&1 || true)
echo "" | run_kb rebuild >/dev/null 2>&1 || exit_code=$?
assert_eq "rebuild aborts empty" "1" "$exit_code"
teardown_project

# ============================================================================
# BATCH QUERY TESTS
# ============================================================================

echo ""
echo "=== Batch Query Tests ==="

# --- Test 64: Batch query merges results from multiple terms ---
echo "Test 64: Batch query merges results"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/auth-flow/specification/auth-flow/specification.md >/dev/null 2>&1
output=$(run_kb query "topic" "specification" --limit 10 2>&1)
assert_eq "has results" "true" "$(echo "$output" | grep -qE '\[[1-9][0-9]* results\]' && echo true || echo false)"
teardown_project

# --- Test 65: Batch query with limit ---
echo "Test 65: Batch query respects limit"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
create_spec_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
run_kb index .workflows/auth-flow/specification/auth-flow/specification.md >/dev/null 2>&1
output=$(run_kb query "topic" "content" --limit 1 2>&1)
assert_eq "limited to 1 result" "true" "$(echo "$output" | grep -q '\[1 results\]' && echo true || echo false)"
teardown_project

# --- Test 66: Batch query with one empty term ---
echo "Test 66: Batch query one term no results"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" "xyznonexistent123" --limit 10 2>&1)
# Should still have results from the first term.
assert_eq "still has results" "true" "$(echo "$output" | grep -qE '\[[1-9][0-9]* results\]' && echo true || echo false)"
teardown_project

# ============================================================================
# STUB-TO-FULL UPGRADE NOTE TESTS
# ============================================================================

echo ""
echo "=== Stub-to-Full Upgrade Note Tests ==="

# --- Test 67: Shows upgrade note when config has provider but store is keyword-only ---
echo "Test 67: Upgrade note on query"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Switch to stub config.
write_stub_config
output=$(run_kb query "topic" 2>&1)
assert_eq "shows upgrade note" "true" "$(echo "$output" | grep -q 'embedding provider configured' && echo true || echo false)"
teardown_project

# --- Test 68: No upgrade note when store and config match ---
echo "Test 68: No upgrade note when matching"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" 2>&1)
assert_eq "no upgrade note" "false" "$(echo "$output" | grep -q 'embedding provider configured' && echo true || echo false)"
teardown_project

# --- Test 69: No upgrade note in pure keyword mode ---
echo "Test 69: No upgrade note in pure keyword mode"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_keyword_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
output=$(run_kb query "topic" 2>&1)
assert_eq "no upgrade note pure keyword" "false" "$(echo "$output" | grep -q 'embedding provider configured' && echo true || echo false)"
teardown_project

# ============================================================================
# REVIEW-DRIVEN FIX TESTS
# ============================================================================

echo ""
echo "=== Review-Driven Fix Tests ==="

# --- Test 70: Query --topic actually filters ---
echo "Test 70: Query --topic filters"
setup_project
create_work_unit "payments" "epic" "Payments"
write_stub_config
create_spec_file "payments" "billing"
create_spec_file "payments" "invoicing"
run_kb index .workflows/payments/specification/billing/specification.md >/dev/null 2>&1
run_kb index .workflows/payments/specification/invoicing/specification.md >/dev/null 2>&1
output=$(run_kb query "specification" --topic billing --limit 10 2>&1)
assert_eq "only billing in results" "false" "$(echo "$output" | grep -q 'invoicing' && echo true || echo false)"
assert_eq "billing present" "true" "$(echo "$output" | grep -q 'billing' && echo true || echo false)"
teardown_project

# --- Test 71: Indexing empty file is rejected ---
echo "Test 71: Empty file rejected"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/auth-flow/discussion"
echo "" > "$TEST_ROOT/.workflows/auth-flow/discussion/auth-flow.md"
exit_code=0
output=$(run_kb index .workflows/auth-flow/discussion/auth-flow.md 2>&1 || true)
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1 || exit_code=$?
assert_eq "rejects empty file" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "explains refusal" "true" "$(echo "$output" | grep -q 'No chunks produced' && echo true || echo false)"
teardown_project

# --- Test 72: First-ever bulk index failure tracks in pending queue ---
echo "Test 72: First-ever failure goes to pending queue"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/auth-flow/discussion"
echo "" > "$TEST_ROOT/.workflows/auth-flow/discussion/auth-flow.md"
init_phase_topic "auth-flow" "discussion" "auth-flow" "completed"
run_kb index >/dev/null 2>&1 || true
[ -f "$TEST_ROOT/.workflows/.knowledge/metadata.json" ]
exists=$?
assert_eq "metadata.json created on first failure" "0" "$exists"
if [ "$exists" = "0" ]; then
  pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(String(m.pending.length))")
  assert_eq "pending has 1 item" "1" "$pending"
fi
teardown_project

# ============================================================================
# THIRD-PASS REVIEW FIXES
# ============================================================================

echo ""
echo "=== Third-Pass Review Fix Tests ==="

# --- Test 73: Invalid decay_months rejected ---
echo "Test 73: Invalid decay_months rejected"
setup_project
create_work_unit "alpha" "feature" "Alpha"
mkdir -p "$TEST_ROOT/.workflows/.knowledge"
cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128, "decay_months": -6 } }
CONF
create_discussion_file "alpha" "alpha"
run_kb index .workflows/alpha/discussion/alpha.md >/dev/null 2>&1
exit_code=0
output=$(run_kb compact 2>&1 || true)
run_kb compact >/dev/null 2>&1 || exit_code=$?
assert_eq "negative decay exits non-zero" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "mentions invalid decay" "true" "$(echo "$output" | grep -q 'Invalid decay_months' && echo true || echo false)"
teardown_project

# --- Test 74: String decay_months rejected ---
echo "Test 74: String decay_months rejected"
setup_project
create_work_unit "alpha" "feature" "Alpha"
mkdir -p "$TEST_ROOT/.workflows/.knowledge"
cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128, "decay_months": "6" } }
CONF
create_discussion_file "alpha" "alpha"
run_kb index .workflows/alpha/discussion/alpha.md >/dev/null 2>&1
exit_code=0
output=$(run_kb compact 2>&1 || true)
run_kb compact >/dev/null 2>&1 || exit_code=$?
assert_eq "string decay exits non-zero" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
teardown_project

# --- Test 75: Non-integer decay_months rejected ---
echo "Test 75: Non-integer decay_months rejected"
setup_project
create_work_unit "alpha" "feature" "Alpha"
mkdir -p "$TEST_ROOT/.workflows/.knowledge"
cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128, "decay_months": 6.5 } }
CONF
create_discussion_file "alpha" "alpha"
run_kb index .workflows/alpha/discussion/alpha.md >/dev/null 2>&1
exit_code=0
run_kb compact >/dev/null 2>&1 || exit_code=$?
assert_eq "non-integer decay exits non-zero" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
teardown_project

# --- Test 76: Pending queue preserved across re-index (no lost update) ---
echo "Test 76: Pending queue preserved across re-index"
setup_project
create_work_unit "auth-flow" "feature" "Auth"
write_stub_config
create_discussion_file "auth-flow" "auth-flow"
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
# Inject a pending item for a non-existent file (so catch-up will drop it,
# but only after index uses re-read metadata — proves lock + re-read works).
# Use a file that DOES exist but isn't a valid workflow artifact so deriveIdentity fails.
node -e "
  const fs = require('fs');
  const mp = '$TEST_ROOT/.workflows/.knowledge/metadata.json';
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.pending = [{file: 'not-a-real-file-for-test.md', failed_at: '2026-01-01T00:00:00Z', error: 'test'}];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
# Re-index: the inner indexSingleFile must re-read metadata and preserve the pending
# entry, not overwrite with its stale pre-lock snapshot. Then catch-up removes it
# because the file doesn't exist. Net: pending should be empty.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(JSON.stringify(m.pending))")
assert_eq "pending cleaned after re-index" '[]' "$pending"
teardown_project

# --- Test 77: Path-traversal via .. rejected ---
echo "Test 77: Path-traversal rejected"
setup_project
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/valid/discussion"
echo "content" > "$TEST_ROOT/.workflows/valid/discussion/valid.md"
# Crafted path with .. — deriveIdentity should reject it.
exit_code=0
cd "$TEST_ROOT"
node "$BUNDLE" index ".workflows/../etc/discussion/foo.md" 2>/dev/null || exit_code=$?
assert_eq "rejects traversal" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
teardown_project

# --- Test 78: Hidden work unit name rejected ---
echo "Test 78: Hidden work unit rejected"
setup_project
write_stub_config
mkdir -p "$TEST_ROOT/.workflows/.hidden/discussion"
echo "content" > "$TEST_ROOT/.workflows/.hidden/discussion/foo.md"
exit_code=0
cd "$TEST_ROOT"
node "$BUNDLE" index ".workflows/.hidden/discussion/foo.md" 2>/dev/null || exit_code=$?
assert_eq "rejects hidden wu" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
teardown_project

# --- Test 79: Rebuild handles multi-chunk stdin correctly ---
echo "Test 79: Rebuild multi-chunk stdin"
setup_project
write_stub_config
# Pipe "rebuild\n" — a single chunk is fine, but the new impl waits for newline.
# Verify the happy path still works via piped input.
# NOTE: This test verifies the abort path for partial input still works.
exit_code=0
output=$(printf "re" | run_kb rebuild 2>&1 || true)
printf "re" | run_kb rebuild >/dev/null 2>&1 || exit_code=$?
# "re" without newline → end fires → finish() resolves with "re" → aborts.
assert_eq "partial input aborts" "true" "$([ "$exit_code" -ne 0 ] && echo true || echo false)"
assert_eq "shows aborted" "true" "$(echo "$output" | grep -q 'Aborted' && echo true || echo false)"
teardown_project

# --- Test 80: Bulk index skips cancelled work units ---
echo "Test 80: Bulk index skips cancelled work units"
setup_project
create_work_unit "cancelled-wu" "feature" "Cancelled"
write_stub_config
create_discussion_file "cancelled-wu" "cancelled-wu"
cd "$TEST_ROOT" && node "$MANIFEST_JS" init-phase cancelled-wu.discussion.cancelled-wu >/dev/null 2>&1
cd "$TEST_ROOT" && node "$MANIFEST_JS" set cancelled-wu.discussion.cancelled-wu status completed >/dev/null 2>&1
run_kb index .workflows/cancelled-wu/discussion/cancelled-wu.md >/dev/null 2>&1
cd "$TEST_ROOT" && node "$MANIFEST_JS" set cancelled-wu status cancelled >/dev/null 2>&1
run_kb remove --work-unit cancelled-wu >/dev/null 2>&1
# After cancel + remove, bulk index must NOT re-add the chunks.
output=$(run_kb index 2>&1)
status_output=$(run_kb status 2>&1)
assert_eq "bulk index skipped cancelled wu" "true" "$(echo "$status_output" | grep -q 'cancelled-wu' && echo false || echo true)"
teardown_project

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
