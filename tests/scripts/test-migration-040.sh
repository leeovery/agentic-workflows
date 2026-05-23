#!/bin/bash
#
# Tests for migration 040: cleanup-premature-inception-items
#
# Run: bash tests/scripts/test-migration-040.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/040-cleanup-premature-inception-items.sh"

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
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/migration-040-test.XXXXXX")
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Orphan deleted ---
test_orphan_deleted() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-a"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-a",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "orphan-topic": {"routing": "discussion", "source": "research-analysis"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items && m.phases.inception.items['orphan-topic']));
  ")
  assert_eq "orphan inception item deleted" "false" "$exists"

  local dismissed_has=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    const d = (m.phases.inception && m.phases.inception.dismissed) || [];
    console.log(d.includes('orphan-topic'));
  ")
  assert_eq "orphan NOT added to dismissed" "false" "$dismissed_has"

  teardown
}

# --- Test 2: Sibling research preserves item ---
test_sibling_research_preserves() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-b"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-b",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "auth": {"routing": "discussion", "source": "research-analysis"}
      }
    },
    "research": {
      "items": {"auth": {"status": "in-progress"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items && m.phases.inception.items.auth));
  ")
  assert_eq "sibling research preserves inception" "true" "$exists"

  teardown
}

# --- Test 3: Sibling discussion preserves item ---
test_sibling_discussion_preserves() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-c"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-c",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "billing": {"routing": "discussion", "source": "research-analysis"}
      }
    },
    "discussion": {
      "items": {"billing": {"status": "in-progress"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items.billing));
  ")
  assert_eq "sibling discussion preserves inception" "true" "$exists"

  teardown
}

# --- Test 4: Downstream item preserves ---
test_downstream_preserves() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-d"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-d",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "api-spec": {"routing": "discussion", "source": "research-analysis"}
      }
    },
    "specification": {
      "items": {"api-spec": {"status": "in-progress"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items['api-spec']));
  ")
  assert_eq "downstream specification preserves inception" "true" "$exists"

  teardown
}

# --- Test 5: Non-research-analysis source untouched ---
test_other_source_untouched() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-e"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-e",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "user-named": {"routing": "discussion", "source": "inception"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items['user-named']));
  ")
  assert_eq "non-research-analysis source untouched" "true" "$exists"

  teardown
}

# --- Test 6: Comma-joined source containing research-analysis is treated ---
test_comma_joined_source() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-f"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-f",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "mixed": {"routing": "discussion", "source": "inception,research-analysis"}
      }
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items.mixed));
  ")
  assert_eq "comma-joined source: orphan still deleted" "false" "$exists"

  teardown
}

# --- Test 7: Idempotent ---
test_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/epic-g"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "epic-g",
  "work_type": "epic",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {
        "orphan": {"routing": "discussion", "source": "research-analysis"},
        "kept": {"routing": "discussion", "source": "inception"}
      }
    }
  }
}
JSON

  source "$MIGRATION"
  local after_first=$(cat "$wu_dir/manifest.json")

  source "$MIGRATION"
  local after_second=$(cat "$wu_dir/manifest.json")

  assert_eq "idempotent: second run matches first" "true" "$([ "$after_first" = "$after_second" ] && echo true || echo false)"

  teardown
}

# --- Test 8: Non-epic work units untouched ---
test_non_epic_untouched() {
  setup

  local wu_dir="$TEST_DIR/.workflows/feat-x"
  mkdir -p "$wu_dir"
  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "feat-x",
  "work_type": "feature",
  "status": "in-progress",
  "phases": {
    "inception": {
      "items": {"x": {"source": "research-analysis"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items && m.phases.inception.items.x));
  ")
  assert_eq "non-epic untouched" "true" "$exists"

  teardown
}

# --- Test 9: Completed/cancelled epics untouched ---
test_completed_and_cancelled_epics_untouched() {
  setup

  local completed_dir="$TEST_DIR/.workflows/epic-done"
  mkdir -p "$completed_dir"
  cat > "$completed_dir/manifest.json" << 'JSON'
{
  "name": "epic-done",
  "work_type": "epic",
  "status": "completed",
  "phases": {
    "inception": {
      "items": {"orphan": {"routing": "discussion", "source": "research-analysis"}}
    }
  }
}
JSON

  local cancelled_dir="$TEST_DIR/.workflows/epic-cancel"
  mkdir -p "$cancelled_dir"
  cat > "$cancelled_dir/manifest.json" << 'JSON'
{
  "name": "epic-cancel",
  "work_type": "epic",
  "status": "cancelled",
  "phases": {
    "inception": {
      "items": {"orphan": {"routing": "discussion", "source": "research-analysis"}}
    }
  }
}
JSON

  source "$MIGRATION"

  local completed_exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$completed_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items.orphan));
  ")
  assert_eq "completed epic untouched" "true" "$completed_exists"

  local cancelled_exists=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$cancelled_dir/manifest.json', 'utf8'));
    console.log(!!(m.phases.inception.items.orphan));
  ")
  assert_eq "cancelled epic untouched" "true" "$cancelled_exists"

  teardown
}

test_orphan_deleted
test_sibling_research_preserves
test_sibling_discussion_preserves
test_downstream_preserves
test_other_source_untouched
test_comma_joined_source
test_idempotent
test_non_epic_untouched
test_completed_and_cancelled_epics_untouched

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
