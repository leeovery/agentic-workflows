#!/usr/bin/env bash
# Inbox-promotion → seed carry-through tests.
#
# When an inbox item (idea/bug/quick-fix logged via /workflow-log-*) is
# promoted, discovery's confirm-trigger (section D) lands it as the work
# unit's SEED — its origin — by MOVING .workflows/.inbox/{folder}/{file} into
# the work unit's seeds/, registering manifest.seeds[] with a source tag, and
# KB-indexing it under the `seeds` phase. A seed is distinct from an import:
# the trigger the work was spawned from, not reference material it pulled in.
# It is moved (not copied, not archived) so the captured item travels into the
# work unit and its verbatim content reaches every downstream phase.
#
# This test executes that documented promotion sequence against the real
# manifest.cjs and knowledge.cjs CLIs and asserts the end state for every
# inbox type (idea / bug / quick-fix) and a representative spread of resulting
# work types (feature / epic / bugfix / quick-fix). It also runs the
# downstream-surfacing path check — a paraphrased, work-unit-boosted query
# exactly like the contextual-query step every consuming phase runs — and
# confirms the result carries a readable Source: path, so two-step retrieval
# (and the single-phase direct read) can reach the verbatim seed.

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

# Isolate from the developer's real ~/.config/workflows/ so a real OpenAI
# config can't leak in and break the stub-only knowledge calls.
FAKE_HOME=$(mktemp -d)
export HOME="$FAKE_HOME"
trap 'rm -rf "$FAKE_HOME"' EXIT

TEST_ROOT=""
setup_project() {
  TEST_ROOT=$(mktemp -d)
  mkdir -p "$TEST_ROOT/.workflows/.knowledge"
  cat > "$TEST_ROOT/.workflows/.knowledge/config.json" <<'CONF'
{ "knowledge": { "provider": "stub", "dimensions": 128 } }
CONF
}

teardown_project() {
  [ -n "$TEST_ROOT" ] && rm -rf "$TEST_ROOT"
  TEST_ROOT=""
}

# Normalise an inbox basename the way land-seed.md section A does:
# lowercase, non-[alnum.-] → '-', collapse repeated '-', ensure .md.
# For the date-prefixed inbox names this collapses the '--' separator.
normalise_filename() {
  local base="$1"
  base=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')
  base=$(printf '%s' "$base" | sed -E 's/[^a-z0-9.-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//')
  case "$base" in
    *.md) ;;
    *) base="${base}.md" ;;
  esac
  printf '%s' "$base"
}

# Map an inbox folder to its seed source type.
seed_type_for_folder() {
  case "$1" in
    bugs) echo "bug" ;;
    quickfixes) echo "quickfix" ;;
    ideas) echo "idea" ;;
  esac
}

# Perform the documented promotion (confirm-trigger D → land-seed.md) for a
# single inbox item, then assert the full end state.
#
# Args: label folder work_type work_unit inbox_basename content query_phrase
promote_and_assert() {
  local label="$1" folder="$2" work_type="$3" work_unit="$4"
  local basename="$5" content="$6" query_phrase="$7"

  setup_project
  cd "$TEST_ROOT"

  local type
  type=$(seed_type_for_folder "$folder")

  # Arrange: a logged inbox item.
  mkdir -p ".workflows/.inbox/$folder"
  printf '%s\n' "$content" > ".workflows/.inbox/$folder/$basename"

  # confirm-trigger A/B: name resolved + work unit created.
  node "$MANIFEST_JS" init "$work_unit" --work-type "$work_type" \
    --description "promoted from inbox" >/dev/null 2>&1

  # confirm-trigger D → land-seed.md (move into seeds/, track, index).
  local dest
  dest=$(normalise_filename "$basename")
  mkdir -p ".workflows/$work_unit/seeds/"
  mv ".workflows/.inbox/$folder/$basename" ".workflows/$work_unit/seeds/$dest"
  node "$MANIFEST_JS" push "$work_unit" seeds \
    "{\"path\":\"seeds/$dest\",\"source\":\"inbox:$type\",\"seeded_at\":\"2026-06-02T00:00:00Z\"}" >/dev/null 2>&1
  node "$BUNDLE" index ".workflows/$work_unit/seeds/$dest" >/dev/null 2>&1

  # Assert: landed in seeds/ (not imports/).
  assert_eq "$label: file lands in seeds/" "true" \
    "$([ -f ".workflows/$work_unit/seeds/$dest" ] && echo true || echo false)"
  assert_eq "$label: NOT landed in imports/" "false" \
    "$([ -e ".workflows/$work_unit/imports/$dest" ] && echo true || echo false)"

  # Assert: removed from the inbox (moved, not copied).
  assert_eq "$label: removed from .inbox/" "false" \
    "$([ -f ".workflows/.inbox/$folder/$basename" ] && echo true || echo false)"

  # Assert: NOT archived (.archived is reserved for declined items).
  assert_eq "$label: not archived to .inbox/.archived/" "false" \
    "$([ -e ".workflows/.inbox/.archived/$folder/$basename" ] && echo true || echo false)"

  # Assert: registered in manifest.seeds[] with the right source tag,
  # and NOT in manifest.imports[].
  local seeds_json imports_json
  seeds_json=$(node "$MANIFEST_JS" get "$work_unit" seeds 2>&1)
  assert_eq "$label: manifest.seeds[] has the entry" "true" \
    "$(printf '%s' "$seeds_json" | grep -qF "seeds/$dest" && echo true || echo false)"
  assert_eq "$label: seed tagged source inbox:$type" "true" \
    "$(printf '%s' "$seeds_json" | grep -qF "inbox:$type" && echo true || echo false)"
  imports_json=$(node "$MANIFEST_JS" get "$work_unit" imports 2>&1)
  assert_eq "$label: NOT recorded in manifest.imports[]" "false" \
    "$(printf '%s' "$imports_json" | grep -qF "$dest" && echo true || echo false)"

  # Assert: KB-indexed under the seeds phase and surfaces via the SAME query
  # the consuming phase runs — paraphrased phrase + work-unit BOOST.
  local query_out
  query_out=$(node "$BUNDLE" query "$query_phrase" --boost:work-unit "$work_unit" 2>&1)
  assert_eq "$label: seed surfaces via contextual-style query" "false" \
    "$(printf '%s' "$query_out" | grep -q '\[0 results\]' && echo true || echo false)"
  assert_eq "$label: query result carries seeds provenance" "true" \
    "$(printf '%s' "$query_out" | grep -q "seeds | $work_unit/" && echo true || echo false)"
  assert_eq "$label: result carries readable Source path for the seed read" "true" \
    "$(printf '%s' "$query_out" | grep -q "Source: .workflows/$work_unit/seeds/$dest" && echo true || echo false)"

  teardown_project
}

echo "=== Inbox Promotion → Seed Carry-Through ==="

# --- bug → bugfix → investigation ---
echo "Test: bug promoted to a bugfix"
promote_and_assert "bug→bugfix" "bugs" "bugfix" "login-timeout" \
  "2026-03-18--login-timeout.md" \
  "# Login times out
The auth callback throws RequestTimeoutError after 30s. Stack trace:
  at refreshSession (auth/session.js:42)
Repro: log in with an expired refresh token on a throttled connection." \
  "auth callback timeout when refreshing an expired session token"

# --- quick-fix → quick-fix → scoping ---
echo "Test: quick-fix promoted to a quick-fix"
promote_and_assert "quickfix→quick-fix" "quickfixes" "quick-fix" "replace-interface" \
  "2026-03-28--replace-interface.md" \
  "# Replace deprecated interface
Global rename of LegacyClient to PlatformClient across the gateway module.
Mechanical find-and-replace, no logic change." \
  "rename the deprecated client interface in the gateway module"

# --- idea → feature → research/discussion ---
echo "Test: idea promoted to a feature"
promote_and_assert "idea→feature" "ideas" "feature" "smart-retry" \
  "2026-03-19--smart-retry.md" \
  "# Smart retry backoff
Idea: replace fixed retry delays with decorrelated jitter. Cap at 20s.
Open question: how to surface retry budget exhaustion to the caller." \
  "improve retry backoff delays with jitter"

# --- idea → epic → topic curation then per-topic phases ---
echo "Test: idea promoted to an epic"
promote_and_assert "idea→epic" "ideas" "epic" "billing-overhaul" \
  "2026-04-02--billing-overhaul.md" \
  "# Billing overhaul
Rework metering, invoicing, and dunning into one pipeline.
Migrate legacy proration records without downtime." \
  "rework the billing metering and invoicing pipeline"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
