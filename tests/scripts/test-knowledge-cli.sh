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

# --- Test 3: Not-yet-implemented commands exit 1 ---
echo "Test 3: Not-yet-implemented commands"
for cmd in status remove compact rebuild setup; do
  exit_code=0
  output=$(node "$BUNDLE" "$cmd" 2>&1 || true)
  node "$BUNDLE" "$cmd" 2>/dev/null || exit_code=$?
  assert_eq "$cmd exits with code 1" "1" "$exit_code"
  assert_eq "$cmd mentions not yet implemented" "true" "$(echo "$output" | grep -q 'not yet implemented' && echo true || echo false)"
done

# --- Test 4: Known Phase 3 commands dispatch without unknown-command error ---
echo "Test 4: Phase 3 commands dispatch correctly"
for cmd in index query check; do
  output=$(node "$BUNDLE" "$cmd" 2>&1 || true)
  assert_eq "$cmd does not say unknown command" "false" "$(echo "$output" | grep -q 'Unknown command' && echo true || echo false)"
done

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

# --- Test 16: last_indexed updated without touching pending ---
echo "Test 16: last_indexed updated, pending untouched"
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
  m.pending = [{file: 'test.md', failed_at: '2026-01-01T00:00:00Z', error: 'test'}];
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
"
# Re-index.
run_kb index .workflows/auth-flow/discussion/auth-flow.md >/dev/null 2>&1
pending=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_ROOT/.workflows/.knowledge/metadata.json','utf8'));process.stdout.write(JSON.stringify(m.pending))")
assert_eq "pending preserved after re-index" '[{"file":"test.md","failed_at":"2026-01-01T00:00:00Z","error":"test"}]' "$pending"
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
assert_eq "shows upgrade note" "true" "$(echo "$output" | grep -q 'keyword-only mode store' && echo true || echo false)"
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

# --- Test 28: Index no-args prints usage ---
echo "Test 28: Index no-args prints usage"
setup_project
write_stub_config
exit_code=0
output=$(run_kb index 2>&1 || true)
run_kb index 2>/dev/null || exit_code=$?
assert_eq "index no-args exits 1" "1" "$exit_code"
assert_eq "index no-args shows usage" "true" "$(echo "$output" | grep -q 'Usage:' && echo true || echo false)"
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

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
