#!/bin/bash
#
# Tests for migration 043: mark legacy umbrellas handled + re-stamp analysis caches
#
# Run: bash tests/scripts/test-migration-043.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/043-handled-umbrellas-and-restamp-caches.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-043-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# Read a manifest field via node; prints the JS-stringified value.
field() {
  local manifest="$1" expr="$2"
  node -e "
    const m = JSON.parse(require('fs').readFileSync('$manifest', 'utf8'));
    const v = (function(m){ return $expr; })(m);
    console.log(v === undefined ? 'undefined' : v);
  "
}

# --- Test 1: legacy umbrella marked handled ---
test_umbrella_marked() {
  setup
  local wu="$TEST_DIR/.workflows/epic-a"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth talk" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-a", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "umbrella marked handled" "true" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 2: user-authored umbrella (not migration-seeded) untouched ---
test_user_authored_untouched() {
  setup
  local wu="$TEST_DIR/.workflows/epic-b"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-b", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "discovery", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "user-authored umbrella not handled" "undefined" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 3: dismissed name skipped ---
test_dismissed_skipped() {
  setup
  local wu="$TEST_DIR/.workflows/epic-c"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-c", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": {
      "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } },
      "dismissed": ["umbrella"]
    },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "dismissed umbrella not handled" "undefined" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 4: genuine 1:1 (same-named completed discussion) untouched ---
test_same_named_discussion_untouched() {
  setup
  local wu="$TEST_DIR/.workflows/epic-d"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "umbrella talk" > "$wu/discussion/umbrella.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-d", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "umbrella": { "status": "completed" } } },
    "planning": { "items": { "umbrella": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "same-named-discussion umbrella not handled" "undefined" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 5: no other completed discussions → untouched ---
test_no_other_discussions_untouched() {
  setup
  local wu="$TEST_DIR/.workflows/epic-e"
  mkdir -p "$wu/research" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-e", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "planning": { "items": { "umbrella": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "no-other-discussion umbrella not handled" "undefined" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 6: cache re-stamp when both absent + quiescent + past-planning ---
test_cache_restamp() {
  setup
  local wu="$TEST_DIR/.workflows/epic-f"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research umbrella" > "$wu/research/umbrella.md"
  echo "auth discussion" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-f", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  # Research cache present + byte-matches md5 of research/umbrella.md.
  local research_match=$(node -e "
    const fs = require('fs'), crypto = require('crypto');
    const m = JSON.parse(fs.readFileSync('$wu/manifest.json', 'utf8'));
    const c = m.phases.research.analysis_cache;
    const exp = crypto.createHash('md5').update(fs.readFileSync('$wu/research/umbrella.md')).digest('hex');
    console.log(!!c && c.checksum === exp);
  ")
  assert_eq "research cache byte-matches read side" "true" "$research_match"

  # Gap cache present + byte-matches md5 of full-path-sorted [discussion/auth, research/umbrella].
  local gap_match=$(node -e "
    const fs = require('fs'), crypto = require('crypto');
    const m = JSON.parse(fs.readFileSync('$wu/manifest.json', 'utf8'));
    const c = m.phases.discovery.gap_analysis_cache;
    const paths = ['$wu/discussion/auth.md', '$wu/research/umbrella.md'].sort();
    const h = crypto.createHash('md5');
    for (const p of paths) h.update(fs.readFileSync(p));
    console.log(!!c && c.checksum === h.digest('hex'));
  ")
  assert_eq "gap cache byte-matches read side" "true" "$gap_match"

  # files / input_files are sorted basenames.
  assert_eq "research files basenames" "umbrella.md" "$(field "$wu/manifest.json" 'm.phases.research.analysis_cache.files.join(",")')"
  assert_eq "gap input_files basenames" "auth.md,umbrella.md" "$(field "$wu/manifest.json" 'm.phases.discovery.gap_analysis_cache.input_files.join(",")')"
  teardown
}

# --- Test 7: present (stale) caches not clobbered ---
test_present_cache_not_clobbered() {
  setup
  local wu="$TEST_DIR/.workflows/epic-g"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-g", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": {
      "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } },
      "gap_analysis_cache": { "checksum": "GAPSTALE", "generated": "old", "input_files": ["gone.md"] }
    },
    "research": {
      "items": { "umbrella": { "status": "completed" } },
      "analysis_cache": { "checksum": "RESEARCHSTALE", "generated": "old", "files": ["gone.md"] }
    },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "research cache not clobbered" "RESEARCHSTALE" "$(field "$wu/manifest.json" 'm.phases.research.analysis_cache.checksum')"
  assert_eq "gap cache not clobbered" "GAPSTALE" "$(field "$wu/manifest.json" 'm.phases.discovery.gap_analysis_cache.checksum')"
  # Job 1 still runs even with present caches.
  assert_eq "umbrella still marked handled" "true" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 8: in-discovery epic (a fresh topic remains) left with absent caches ---
test_in_discovery_left_absent() {
  setup
  local wu="$TEST_DIR/.workflows/epic-h"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-h", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": {
      "items": {
        "umbrella": { "source": "migration-seeded", "routing": "research" },
        "pending": { "source": "discovery", "routing": "research" }
      }
    },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  # Job 1 still marks the qualifying umbrella.
  assert_eq "umbrella handled even in-discovery" "true" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  # But quiescence fails (pending is fresh) → caches stay absent.
  assert_eq "research cache stays absent" "true" "$(field "$wu/manifest.json" '!m.phases.research.analysis_cache')"
  assert_eq "gap cache stays absent" "true" "$(field "$wu/manifest.json" '!m.phases.discovery.gap_analysis_cache')"
  teardown
}

# --- Test 9: past-planning false (spec only) → no restamp ---
test_past_planning_false_no_restamp() {
  setup
  local wu="$TEST_DIR/.workflows/epic-i"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/specification"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-i", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "specification": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  # Spec is not a stop — no planning/impl/review → no restamp.
  assert_eq "research cache absent (spec only)" "true" "$(field "$wu/manifest.json" '!m.phases.research.analysis_cache')"
  assert_eq "gap cache absent (spec only)" "true" "$(field "$wu/manifest.json" '!m.phases.discovery.gap_analysis_cache')"
  # Job 1 still independent of Job 2.
  assert_eq "umbrella handled regardless" "true" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.handled')"
  teardown
}

# --- Test 10: zero completed inputs → stays absent (not stale) ---
test_zero_inputs_stays_absent() {
  setup
  local wu="$TEST_DIR/.workflows/epic-j"
  mkdir -p "$wu/planning"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-j", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": {} },
    "planning": { "items": { "x": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "research cache absent (zero inputs)" "true" "$(field "$wu/manifest.json" '!m.phases.research || !m.phases.research.analysis_cache')"
  assert_eq "gap cache absent (zero inputs)" "true" "$(field "$wu/manifest.json" '!m.phases.discovery.gap_analysis_cache')"
  teardown
}

# --- Test 11: idempotency (run twice, bytes identical) ---
test_idempotent() {
  setup
  local wu="$TEST_DIR/.workflows/epic-k"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-k", "work_type": "epic", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"
  local after_first=$(cat "$wu/manifest.json")
  source "$MIGRATION"
  local after_second=$(cat "$wu/manifest.json")

  assert_eq "idempotent manifest bytes" "true" "$([ "$after_first" = "$after_second" ] && echo true || echo false)"
  teardown
}

# --- Test 12: non-epic untouched ---
test_non_epic_untouched() {
  setup
  local wu="$TEST_DIR/.workflows/feat-a"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "feat-a", "work_type": "feature", "status": "in-progress",
  "phases": {
    "discovery": { "items": { "umbrella": { "source": "migration-seeded", "routing": "research" } } },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  local before=$(cat "$wu/manifest.json")
  source "$MIGRATION"
  local after=$(cat "$wu/manifest.json")

  assert_eq "non-epic manifest unchanged" "true" "$([ "$before" = "$after" ] && echo true || echo false)"
  teardown
}

# --- Test 13: no .workflows directory → no-op ---
test_no_workflows_noop() {
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-043-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  # No .workflows created.

  local rc=0
  source "$MIGRATION" || rc=$?
  assert_eq "returns cleanly with no .workflows" "0" "$rc"
  rm -rf "$TEST_DIR"
}

# --- Test 14: unrelated fields preserved ---
test_unrelated_fields_preserved() {
  setup
  local wu="$TEST_DIR/.workflows/epic-l"
  mkdir -p "$wu/research" "$wu/discussion" "$wu/planning"
  echo "research" > "$wu/research/umbrella.md"
  echo "auth" > "$wu/discussion/auth.md"
  cat > "$wu/manifest.json" << 'JSON'
{
  "name": "epic-l", "work_type": "epic", "status": "in-progress",
  "description": "keep me", "seeds": [{"path": "seeds/x.md"}],
  "phases": {
    "discovery": {
      "items": { "umbrella": { "source": "migration-seeded", "routing": "research", "summary": "preserve" } },
      "dismissed": ["ghost"]
    },
    "research": { "items": { "umbrella": { "status": "completed" } } },
    "discussion": { "items": { "auth": { "status": "completed" } } },
    "planning": { "items": { "auth": { "status": "completed" } } }
  }
}
JSON

  source "$MIGRATION"

  assert_eq "description preserved" "keep me" "$(field "$wu/manifest.json" 'm.description')"
  assert_eq "seeds preserved" "seeds/x.md" "$(field "$wu/manifest.json" 'm.seeds[0].path')"
  assert_eq "summary preserved" "preserve" "$(field "$wu/manifest.json" 'm.phases.discovery.items.umbrella.summary')"
  assert_eq "dismissed preserved" "ghost" "$(field "$wu/manifest.json" 'm.phases.discovery.dismissed.join(",")')"
  teardown
}

test_umbrella_marked
test_user_authored_untouched
test_dismissed_skipped
test_same_named_discussion_untouched
test_no_other_discussions_untouched
test_cache_restamp
test_present_cache_not_clobbered
test_in_discovery_left_absent
test_past_planning_false_no_restamp
test_zero_inputs_stays_absent
test_idempotent
test_non_epic_untouched
test_no_workflows_noop
test_unrelated_fields_preserved

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
