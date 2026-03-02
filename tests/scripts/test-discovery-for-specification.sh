#!/bin/bash
#
# Tests the discovery script for start-specification.
# Creates temporary fixtures with manifest.json files and validates YAML output.
#
# Specification discovery reads:
# - Discussions from work-unit dirs (.workflows/{wu}/discussion/)
# - Specifications from work-unit dirs (.workflows/{wu}/specification/)
# - Cache state from .workflows/.state/discussion-consolidation-analysis.md
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVERY_SCRIPT="$SCRIPT_DIR/../../skills/start-specification/scripts/discovery.sh"

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
}

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

create_discussion_file() {
    local wu_name="$1"
    local filename="$2"
    local content="$3"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/discussion"
    cat > "$TEST_DIR/.workflows/$wu_name/discussion/$filename" << EOF
$content
EOF
}

create_spec_file() {
    local wu_name="$1"
    local content="$2"

    mkdir -p "$TEST_DIR/.workflows/$wu_name/specification"
    cat > "$TEST_DIR/.workflows/$wu_name/specification/specification.md" << EOF
$content
EOF
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
# Test: Fresh state (no discussions or specs)
#
test_fresh_state() {
    echo -e "${YELLOW}Test: Fresh state (no discussions or specs)${NC}"
    setup_fixture

    local output=$(run_discovery)

    assert_contains "$output" 'discussions:' "Has discussions section"
    assert_contains "$output" '[]  # No discussions found' "Discussions empty"
    assert_contains "$output" 'specifications:' "Has specifications section"
    assert_contains "$output" '[]  # No specifications found' "Specifications empty"
    assert_contains "$output" 'status: "none"' "Cache status is none"
    assert_contains "$output" 'concluded_count: 0' "Concluded count is 0"
    assert_contains "$output" 'discussion_count: 0' "Discussion count is 0"
    assert_contains "$output" 'in_progress_count: 0' "In-progress count is 0"
    assert_contains "$output" 'spec_count: 0' "Spec count is 0"
    assert_contains "$output" 'has_discussions: false' "has_discussions is false"
    assert_contains "$output" 'has_concluded: false' "has_concluded is false"
    assert_contains "$output" 'has_specs: false' "has_specs is false"

    echo ""
}

#
# Test: Discussions only (feature work units with discussion phase)
#
test_discussions_only() {
    echo -e "${YELLOW}Test: Discussions only (no specs)${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: in-progress
---
# Discussion: Auth Flow"

    create_manifest "api-design" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "api-design" "discussion.md" "---
status: concluded
---
# Discussion: API Design"

    local output=$(run_discovery)

    assert_contains "$output" 'name: "auth-flow"' "Found auth-flow discussion"
    assert_contains "$output" 'name: "api-design"' "Found api-design discussion"
    assert_contains "$output" 'status: "in-progress"' "Found in-progress status"
    assert_contains "$output" 'status: "concluded"' "Found concluded status"
    assert_contains "$output" 'has_individual_spec: false' "No individual spec exists"
    assert_contains "$output" 'has_discussions: true' "has_discussions is true"
    assert_contains "$output" 'has_specs: false' "has_specs is false"

    echo ""
}

#
# Test: Specifications only
#
test_specifications_only() {
    echo -e "${YELLOW}Test: Specifications only (no discussions)${NC}"
    setup_fixture

    create_manifest "auth-system" "feature" '{"specification": {"status": "in-progress"}}'
    create_spec_file "auth-system" "---
status: in-progress
type: feature
---
# Specification: Auth System"

    local output=$(run_discovery)

    assert_contains "$output" '[]  # No discussions found' "Discussions empty"
    assert_contains "$output" 'name: "auth-system"' "Found auth-system spec"
    assert_contains "$output" 'status: "in-progress"' "Status is in-progress"

    echo ""
}

#
# Test: Discussion with corresponding spec
#
test_discussion_with_spec() {
    echo -e "${YELLOW}Test: Discussion with corresponding spec${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "in-progress"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: concluded
---
# Discussion: Auth Flow"
    create_spec_file "auth-flow" "---
status: in-progress
type: feature
---
# Specification: Auth Flow"

    local output=$(run_discovery)

    assert_contains "$output" 'has_individual_spec: true' "Discussion has corresponding spec"
    assert_contains "$output" 'spec_status: "in-progress"' "Spec status is in-progress"

    echo ""
}

#
# Test: Discussion with concluded spec
#
test_discussion_with_concluded_spec() {
    echo -e "${YELLOW}Test: Discussion with corresponding concluded spec${NC}"
    setup_fixture

    create_manifest "billing" "feature" '{"discussion": {"status": "concluded"}, "specification": {"status": "concluded"}}'
    create_discussion_file "billing" "discussion.md" "---
status: concluded
---
# Discussion: Billing"
    create_spec_file "billing" "---
status: concluded
type: feature
---
# Specification: Billing"

    local output=$(run_discovery)

    assert_contains "$output" 'has_individual_spec: true' "Discussion has corresponding spec"
    assert_contains "$output" 'spec_status: "concluded"' "Spec status is concluded"

    echo ""
}

#
# Test: Discussion without spec
#
test_discussion_without_spec_no_status() {
    echo -e "${YELLOW}Test: Discussion without spec has no spec_status${NC}"
    setup_fixture

    create_manifest "standalone" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "standalone" "discussion.md" "---
status: concluded
---
# Discussion: Standalone"

    local output=$(run_discovery)

    assert_contains "$output" 'has_individual_spec: false' "Discussion has no spec"
    assert_not_contains "$output" 'spec_status:' "No spec_status field when no spec exists"

    echo ""
}

#
# Test: Cache status none
#
test_cache_none() {
    echo -e "${YELLOW}Test: Cache status none${NC}"
    setup_fixture

    create_manifest "test" "feature" '{"discussion": {"status": "in-progress"}}'
    create_discussion_file "test" "discussion.md" "---
status: in-progress
---
# Discussion: Test"

    local output=$(run_discovery)

    assert_contains "$output" 'status: "none"' "Cache status is none"
    assert_contains "$output" 'reason: "no cache exists"' "Reason is no cache exists"
    assert_contains "$output" 'checksum: null' "Checksum is null"
    assert_contains "$output" 'anchored_names: []' "No anchored names"

    echo ""
}

#
# Test: Cache status valid
#
test_cache_valid() {
    echo -e "${YELLOW}Test: Cache status valid${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: concluded
---
# Discussion: Auth Flow"

    mkdir -p "$TEST_DIR/.workflows/.state"

    # Compute the checksum of all discussion files
    local checksum=$(find "$TEST_DIR/.workflows" -path "*/discussion/*.md" -print0 2>/dev/null | sort -z | xargs -0 cat 2>/dev/null | md5sum | cut -d' ' -f1)

    cat > "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md" << EOF
---
checksum: $checksum
generated: 2026-01-20T10:00:00
research_files:
  - auth-flow.md
---

# Discussion Consolidation Analysis
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "valid"' "Cache status is valid"
    assert_contains "$output" 'reason: "checksums match"' "Reason is checksums match"

    echo ""
}

#
# Test: Cache status stale
#
test_cache_stale() {
    echo -e "${YELLOW}Test: Cache status stale${NC}"
    setup_fixture

    create_manifest "auth-flow" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "auth-flow" "discussion.md" "---
status: concluded
---
# Discussion: Auth Flow"

    mkdir -p "$TEST_DIR/.workflows/.state"

    # Use a different checksum to make cache stale
    cat > "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md" << 'EOF'
---
checksum: oldchecksum123
generated: 2026-01-19T10:00:00
research_files:
  - auth-flow.md
---

# Discussion Consolidation Analysis
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "stale"' "Cache status is stale"
    assert_contains "$output" 'reason: "discussions have changed' "Reason mentions discussions changed"

    echo ""
}

#
# Test: Cache stale when no discussions exist
#
test_cache_stale_no_discussions() {
    echo -e "${YELLOW}Test: Cache stale when no discussions${NC}"
    setup_fixture

    mkdir -p "$TEST_DIR/.workflows/.state"

    cat > "$TEST_DIR/.workflows/.state/discussion-consolidation-analysis.md" << 'EOF'
---
checksum: abc123
generated: 2026-01-20T10:00:00
research_files:
  - auth-flow.md
---

# Discussion Consolidation Analysis
EOF

    local output=$(run_discovery)

    assert_contains "$output" 'status: "stale"' "Cache status is stale"
    assert_contains "$output" 'reason: "no discussions to compare"' "Reason is no discussions to compare"

    echo ""
}

#
# Test: Current state with discussions checksum
#
test_current_state_checksum() {
    echo -e "${YELLOW}Test: Current state with discussions checksum${NC}"
    setup_fixture

    create_manifest "test" "feature" '{"discussion": {"status": "concluded"}}'
    create_discussion_file "test" "discussion.md" "---
status: concluded
---
# Discussion: Test"

    local output=$(run_discovery)

    assert_contains "$output" 'current_state:' "Has current_state section"
    assert_contains "$output" 'discussions_checksum:' "Has discussions_checksum"
    assert_not_contains "$output" 'discussions_checksum: null' "Checksum is not null"

    echo ""
}

#
# Run all tests
#
echo "=========================================="
echo "Running discovery-for-specification.sh tests"
echo "=========================================="
echo ""

test_fresh_state
test_discussions_only
test_specifications_only
test_discussion_with_spec
test_discussion_with_concluded_spec
test_discussion_without_spec_no_status
test_cache_none
test_cache_valid
test_cache_stale
test_current_state_checksum
test_cache_stale_no_discussions

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
