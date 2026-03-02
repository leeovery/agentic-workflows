#!/bin/bash
#
# Tests the discovery script for start-discussion.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Discussion discovery reads:
# - Research files from .workflows/{work_unit}/research/ directories
# - Discussions from manifest CLI + discussion files in work-unit dirs
# - Cache state from .workflows/.state/research-analysis.md
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-discussion/scripts/discovery.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Create a temporary directory for test fixtures
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "Test directory: $TEST_DIR"
echo ""

#
# Helper functions
#

setup_fixture() {
    rm -rf "$TEST_DIR/.workflows"
    mkdir -p "$TEST_DIR/.workflows"

    # Set up manifest CLI so discovery scripts can find it
    if [ ! -f "$TEST_DIR/.claude/skills/workflow-manifest/scripts/manifest.js" ]; then
        mkdir -p "$TEST_DIR/.claude/skills/workflow-manifest/scripts"
        ln -sf "$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.js" \
            "$TEST_DIR/.claude/skills/workflow-manifest/scripts/manifest.js"
    fi
}

# Create a manifest.json for a work unit
create_manifest() {
    local name="$1"
    local work_type="$2"
    shift 2

    mkdir -p "$TEST_DIR/.workflows/$name"

    local phases='{}'
    if [ -n "$1" ]; then
        phases="$1"
    fi

    cat > "$TEST_DIR/.workflows/$name/manifest.json" << EOFMANIFEST
{
  "name": "$name",
  "work_type": "$work_type",
  "status": "active",
  "description": "Test work unit: $name",
  "phases": $phases
}
EOFMANIFEST
}

# Create a research file in a work unit directory
create_research_file() {
    local wu_name="$1"
    local filename="$2"
    local content="$3"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/research"
    echo "$content" > "$TEST_DIR/.workflows/$wu_name/research/$filename"
}

# Create a discussion file in the work-unit-first layout
create_discussion_file() {
    local wu_name="$1"
    local filename="$2"
    local content="$3"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/discussion"
    echo "$content" > "$TEST_DIR/.workflows/$wu_name/discussion/$filename"
}

run_discovery() {
    cd "$TEST_DIR"
    /bin/bash "$DISCOVERY_SCRIPT" 2>/dev/null
}

assert_contains() {
    local output="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$output" | grep -qF -- "$expected"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected to find: $expected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_not_contains() {
    local output="$1"
    local pattern="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if ! echo "$output" | grep -qF -- "$pattern"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Did not expect to find: $pattern"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

#
# Test: Fresh state (no research, no discussions)
#
test_fresh_state() {
    echo -e "${YELLOW}Test: Fresh state (no research, no discussions)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'research:' "Has research section"
    assert_contains "$output" 'exists: false' "Research exists: false"
    assert_contains "$output" 'discussions:' "Has discussions section"
    assert_contains "$output" 'scenario: "fresh"' "Scenario is fresh"
    assert_contains "$output" 'status: "none"' "Cache status is none"

    echo ""
}

#
# Test: Research only (no discussions)
#
test_research_only() {
    echo -e "${YELLOW}Test: Research only (no discussions)${NC}"
    setup_fixture

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-21
---

# Research: Initial Exploration

Exploring ideas for the new feature."

    local output=$(run_discovery)

    assert_contains "$output" 'exists: true' "Research exists: true"
    assert_contains "$output" 'name: "exploration"' "Found exploration.md"
    assert_contains "$output" 'topic: "exploration"' "Extracted topic from frontmatter"
    assert_contains "$output" 'checksum:' "Has research checksum"
    assert_contains "$output" 'scenario: "research_only"' "Scenario is research_only"
    assert_contains "$output" 'has_research: true' "has_research is true"
    assert_contains "$output" 'has_discussions: false' "has_discussions is false"

    echo ""
}

#
# Test: Discussions only (from manifest — feature work unit with discussion phase)
#
test_discussions_only() {
    echo -e "${YELLOW}Test: Discussions only (no research)${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: in-progress
---

# Discussion: Auth Flow"

    local output=$(run_discovery)

    assert_contains "$output" 'exists: false' "Research exists: false"
    assert_contains "$output" 'name: "auth-flow"' "Found auth-flow discussion"
    assert_contains "$output" 'status: "in-progress"' "Status is in-progress"
    assert_contains "$output" 'work_type: "feature"' "Work type is feature"
    assert_contains "$output" 'in_progress: 1' "in_progress count is 1"
    assert_contains "$output" 'concluded: 0' "concluded count is 0"
    assert_contains "$output" 'scenario: "discussions_only"' "Scenario is discussions_only"

    echo ""
}

#
# Test: Research and discussions
#
test_research_and_discussions() {
    echo -e "${YELLOW}Test: Research and discussions${NC}"
    setup_fixture

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-18
---

# Research: Exploration"

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: concluded
---

# Discussion: Auth Flow"

    create_manifest "data-model" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "data-model" "discussion.md" "---
status: in-progress
---

# Discussion: Data Model"

    local output=$(run_discovery)

    assert_contains "$output" 'scenario: "research_and_discussions"' "Scenario is research_and_discussions"
    assert_contains "$output" 'has_research: true' "has_research is true"
    assert_contains "$output" 'has_discussions: true' "has_discussions is true"
    assert_contains "$output" 'in_progress: 1' "in_progress count is 1"
    assert_contains "$output" 'concluded: 1' "concluded count is 1"

    echo ""
}

#
# Test: Multiple discussions with mixed statuses
#
test_multiple_discussions() {
    echo -e "${YELLOW}Test: Multiple discussions with mixed statuses${NC}"
    setup_fixture

    create_manifest "topic-a" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "topic-a" "discussion.md" "---
status: concluded
---
# Discussion: Topic A"

    create_manifest "topic-b" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "topic-b" "discussion.md" "---
status: concluded
---
# Discussion: Topic B"

    create_manifest "topic-c" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "topic-c" "discussion.md" "---
status: in-progress
---
# Discussion: Topic C"

    create_manifest "topic-d" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "topic-d" "discussion.md" "---
status: in-progress
---
# Discussion: Topic D"

    local output=$(run_discovery)

    assert_contains "$output" 'in_progress: 2' "in_progress count is 2"
    assert_contains "$output" 'concluded: 2' "concluded count is 2"
    assert_contains "$output" 'name: "topic-a"' "Found topic-a"
    assert_contains "$output" 'name: "topic-b"' "Found topic-b"
    assert_contains "$output" 'name: "topic-c"' "Found topic-c"
    assert_contains "$output" 'name: "topic-d"' "Found topic-d"

    echo ""
}

#
# Test: Cache status "none" (no cache file)
#
test_cache_none() {
    echo -e "${YELLOW}Test: Cache status none (no cache file)${NC}"
    setup_fixture

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-21
---
# Research"

    local output=$(run_discovery)

    assert_contains "$output" 'status: "none"' "Cache status is none"
    assert_contains "$output" 'reason: "no cache exists"' "Reason is no cache exists"
    assert_contains "$output" 'checksum: null' "Cache checksum is null"
    assert_contains "$output" 'generated: null' "Cache generated is null"

    echo ""
}

#
# Test: Cache status "valid" (cache matches current research)
#
test_cache_valid() {
    echo -e "${YELLOW}Test: Cache status valid (checksums match)${NC}"
    setup_fixture

    mkdir -p "$TEST_DIR/.workflows/.state"

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-21
---
# Research: Exploration"

    # Compute the checksum of the research file
    local checksum=$(cat "$TEST_DIR/.workflows/research-project/research"/*.md | md5sum | cut -d' ' -f1)

    # Create cache with matching checksum
    cat > "$TEST_DIR/.workflows/.state/research-analysis.md" << EOF
---
checksum: $checksum
generated: 2026-01-21T10:00:00
research_files:
  - exploration.md
---

# Research Analysis Cache
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "valid"' "Cache status is valid"
    assert_contains "$output" 'reason: "checksums match"' "Reason is checksums match"
    assert_contains "$output" "checksum: \"$checksum\"" "Cache checksum matches"
    assert_contains "$output" 'generated: "2026-01-21T10:00:00"' "Cache generated date present"
    assert_contains "$output" '"exploration.md"' "Cache research_files contains exploration.md"

    echo ""
}

#
# Test: Cache status "stale" (research has changed)
#
test_cache_stale() {
    echo -e "${YELLOW}Test: Cache status stale (research changed)${NC}"
    setup_fixture

    mkdir -p "$TEST_DIR/.workflows/.state"

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-21
---
# Research: Exploration

This content is different from when cache was created."

    # Create cache with OLD checksum (doesn't match current)
    cat > "$TEST_DIR/.workflows/.state/research-analysis.md" << 'EOF'
---
checksum: old_checksum_that_doesnt_match
generated: 2026-01-20T10:00:00
research_files:
  - exploration.md
---

# Research Analysis Cache
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "stale"' "Cache status is stale"
    assert_contains "$output" 'reason: "research has changed since cache was generated"' "Reason explains research changed"

    echo ""
}

#
# Test: Research files without frontmatter (fallback to filename)
#
test_research_no_frontmatter() {
    echo -e "${YELLOW}Test: Research files without frontmatter${NC}"
    setup_fixture

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "market-analysis.md" "# Market Analysis

No frontmatter here, just content."

    local output=$(run_discovery)

    assert_contains "$output" 'name: "market-analysis"' "Found market-analysis.md"
    assert_contains "$output" 'topic: "market-analysis"' "Topic falls back to filename"

    echo ""
}

#
# Test: Multiple research files
#
test_multiple_research_files() {
    echo -e "${YELLOW}Test: Multiple research files${NC}"
    setup_fixture

    create_manifest "research-project" "epic" '{}'
    create_research_file "research-project" "exploration.md" "---
topic: exploration
date: 2026-01-18
---
# Exploration"

    create_research_file "research-project" "market-landscape.md" "---
topic: market-landscape
date: 2026-01-19
---
# Market Landscape"

    create_research_file "research-project" "technical-feasibility.md" "---
topic: technical-feasibility
date: 2026-01-20
---
# Technical Feasibility"

    local output=$(run_discovery)

    assert_contains "$output" 'name: "exploration"' "Found exploration.md"
    assert_contains "$output" 'name: "market-landscape"' "Found market-landscape.md"
    assert_contains "$output" 'name: "technical-feasibility"' "Found technical-feasibility.md"
    assert_contains "$output" 'topic: "market-landscape"' "Extracted market-landscape topic"
    assert_contains "$output" 'topic: "technical-feasibility"' "Extracted technical-feasibility topic"

    echo ""
}

#
# Test: Discussion work_type field
#
test_discussion_work_type() {
    echo -e "${YELLOW}Test: Discussion work_type field${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: in-progress
---
# Discussion: Auth Flow"

    create_manifest "big-project" "epic" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "big-project" "discussion.md" "---
status: in-progress
---
# Discussion: Big Project"

    local output=$(run_discovery)

    assert_contains "$output" 'work_type: "feature"' "work_type feature present"
    assert_contains "$output" 'work_type: "epic"' "work_type epic present"

    echo ""
}

#
# Test: Cache stale when no research files exist
#
test_cache_stale_no_research() {
    echo -e "${YELLOW}Test: Cache stale when no research files${NC}"
    setup_fixture

    mkdir -p "$TEST_DIR/.workflows/.state"

    cat > "$TEST_DIR/.workflows/.state/research-analysis.md" << 'EOF'
---
checksum: abc123
generated: 2026-01-20T10:00:00
research_files:
  - exploration.md
---

# Research Analysis Cache
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "stale"' "Cache status is stale"
    assert_contains "$output" 'reason: "no research files to compare"' "Reason is no research files to compare"

    echo ""
}

#
# Test: Empty research directory
#
test_empty_research_dir() {
    echo -e "${YELLOW}Test: Empty research directory${NC}"
    setup_fixture

    # Create a work unit with an empty research dir
    create_manifest "research-project" "epic" '{}'
    mkdir -p "$TEST_DIR/.workflows/research-project/research"

    local output=$(run_discovery)

    assert_contains "$output" 'exists: false' "Research exists: false for empty dir"

    echo ""
}

#
# Test: Epic with multiple discussion items
#
test_epic_multiple_discussions() {
    echo -e "${YELLOW}Test: Epic with multiple discussion items${NC}"
    setup_fixture

    create_manifest "big-project" "epic" '{"discussion": {"status": "in-progress", "items": {"auth-design": {"status": "concluded"}, "data-model": {"status": "in-progress"}}}}'
    mkdir -p "$TEST_DIR/.workflows/big-project/discussion"
    cat > "$TEST_DIR/.workflows/big-project/discussion/auth-design.md" << 'EOF'
---
status: concluded
---
# Auth Design
EOF
    cat > "$TEST_DIR/.workflows/big-project/discussion/data-model.md" << 'EOF'
---
status: in-progress
---
# Data Model
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'name: "auth-design"' "Found auth-design item"
    assert_contains "$output" 'name: "data-model"' "Found data-model item"
    assert_contains "$output" 'work_unit: "big-project"' "Work unit is big-project"
    assert_contains "$output" 'in_progress: 1' "in_progress count is 1"
    assert_contains "$output" 'concluded: 1' "concluded count is 1"

    echo ""
}

#
# Run all tests
#
echo "=========================================="
echo "Running discovery-for-discussion.sh tests"
echo "=========================================="
echo ""

test_fresh_state
test_research_only
test_discussions_only
test_research_and_discussions
test_multiple_discussions
test_cache_none
test_cache_valid
test_cache_stale
test_research_no_frontmatter
test_multiple_research_files
test_discussion_work_type
test_cache_stale_no_research
test_empty_research_dir
test_epic_multiple_discussions

#
# Summary
#
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total:  $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
