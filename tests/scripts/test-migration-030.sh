#!/bin/bash
#
# Tests for migration 030: backfill-spec-sources
#
# Run: bash tests/scripts/test-migration-030.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION="$REPO_DIR/skills/workflow-migrate/scripts/migrations/030-backfill-spec-sources.sh"

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
  TEST_DIR=$(mktemp -d /tmp/migration-030-test.XXXXXX)
  export PROJECT_DIR="$TEST_DIR"
  mkdir -p "$TEST_DIR/.workflows"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# --- Test 1: Single source backfilled from frontmatter ---
test_single_source() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir/specification/auth"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed"
        }
      }
    }
  }
}
JSON

  cat > "$wu_dir/specification/auth/specification.md" << 'SPEC'
---
topic: auth
status: concluded
type: feature
date: 2026-03-01
sources:
  - name: auth-discussion
    status: incorporated
---

# Specification: Auth
SPEC

  source "$MIGRATION"

  local src_status=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.auth.sources['auth-discussion'].status);
  ")
  assert_eq "single source: backfilled" "incorporated" "$src_status"

  teardown
}

# --- Test 2: Multiple sources backfilled ---
test_multiple_sources() {
  setup

  local wu_dir="$TEST_DIR/.workflows/v1"
  mkdir -p "$wu_dir/specification/core"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "v1",
  "work_type": "epic",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "core": {
          "status": "completed"
        }
      }
    }
  }
}
JSON

  cat > "$wu_dir/specification/core/specification.md" << 'SPEC'
---
topic: core
status: concluded
sources:
  - name: architecture
    status: incorporated
  - name: data-model
    status: incorporated
  - name: api-design
    status: pending
---

# Specification: Core
SPEC

  source "$MIGRATION"

  local src_count=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(Object.keys(m.phases.specification.items.core.sources).length);
  ")
  assert_eq "multi source: count=3" "3" "$src_count"

  local arch=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.core.sources.architecture.status);
  ")
  assert_eq "multi source: architecture=incorporated" "incorporated" "$arch"

  local api=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(m.phases.specification.items.core.sources['api-design'].status);
  ")
  assert_eq "multi source: api-design=pending" "pending" "$api"

  teardown
}

# --- Test 3: Skips if manifest already has sources ---
test_idempotent() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir/specification/auth"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed",
          "sources": {
            "existing-source": { "status": "incorporated" }
          }
        }
      }
    }
  }
}
JSON

  cat > "$wu_dir/specification/auth/specification.md" << 'SPEC'
---
topic: auth
sources:
  - name: different-source
    status: incorporated
---

# Spec
SPEC

  source "$MIGRATION"

  # Should keep existing, not overwrite with frontmatter
  local src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(JSON.stringify(Object.keys(m.phases.specification.items.auth.sources)));
  ")
  assert_eq "idempotent: kept existing" '["existing-source"]' "$src"

  teardown
}

# --- Test 4: Skips spec with no frontmatter sources ---
test_no_frontmatter_sources() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir/specification/auth"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed"
        }
      }
    }
  }
}
JSON

  cat > "$wu_dir/specification/auth/specification.md" << 'SPEC'
---
topic: auth
status: concluded
---

# Spec
SPEC

  source "$MIGRATION"

  local has_sources=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('sources' in m.phases.specification.items.auth);
  ")
  assert_eq "no fm sources: no sources added" "false" "$has_sources"

  teardown
}

# --- Test 5: Handles missing spec file gracefully ---
test_missing_spec_file() {
  setup

  local wu_dir="$TEST_DIR/.workflows/auth"
  mkdir -p "$wu_dir"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "auth",
  "work_type": "feature",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "auth": {
          "status": "completed"
        }
      }
    }
  }
}
JSON

  # No spec file exists
  source "$MIGRATION"

  local has_sources=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log('sources' in m.phases.specification.items.auth);
  ")
  assert_eq "missing file: no crash, no sources" "false" "$has_sources"

  teardown
}

# --- Test 6: Epic with multiple spec items ---
test_epic_multi_specs() {
  setup

  local wu_dir="$TEST_DIR/.workflows/v1"
  mkdir -p "$wu_dir/specification/feat-a"
  mkdir -p "$wu_dir/specification/feat-b"

  cat > "$wu_dir/manifest.json" << 'JSON'
{
  "name": "v1",
  "work_type": "epic",
  "status": "completed",
  "phases": {
    "specification": {
      "items": {
        "feat-a": { "status": "completed" },
        "feat-b": { "status": "completed" }
      }
    }
  }
}
JSON

  cat > "$wu_dir/specification/feat-a/specification.md" << 'SPEC'
---
topic: feat-a
sources:
  - name: disc-a
    status: incorporated
---

# Spec A
SPEC

  cat > "$wu_dir/specification/feat-b/specification.md" << 'SPEC'
---
topic: feat-b
sources:
  - name: disc-b1
    status: incorporated
  - name: disc-b2
    status: incorporated
---

# Spec B
SPEC

  source "$MIGRATION"

  local a_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(Object.keys(m.phases.specification.items['feat-a'].sources).length);
  ")
  assert_eq "epic multi: feat-a has 1 source" "1" "$a_src"

  local b_src=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$wu_dir/manifest.json', 'utf8'));
    console.log(Object.keys(m.phases.specification.items['feat-b'].sources).length);
  ")
  assert_eq "epic multi: feat-b has 2 sources" "2" "$b_src"

  teardown
}

# --- Run all tests ---
echo "Running migration 030 tests..."
echo ""

test_single_source
test_multiple_sources
test_idempotent
test_no_frontmatter_sources
test_missing_spec_file
test_epic_multi_specs

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
