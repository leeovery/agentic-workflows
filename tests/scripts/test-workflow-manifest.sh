#!/bin/bash
#
# Tests for the workflow manifest CLI (manifest.cjs)
# Validates init, get, set, list, init-phase, push, exists commands.
# Uses dot-path syntax: <work-unit>[.<phase>[.<topic>]]
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_JS="$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.cjs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

run_cli() {
    cd "$TEST_DIR"
    node "$MANIFEST_JS" "$@" 2>&1
}

run_cli_stdout() {
    cd "$TEST_DIR"
    node "$MANIFEST_JS" "$@" 2>/dev/null
}

run_cli_exit_code() {
    cd "$TEST_DIR"
    node "$MANIFEST_JS" "$@" >/dev/null 2>&1
    echo $?
}

assert_contains() {
    local content="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -q -- "$expected"; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected to find: $expected"
        echo -e "    In: $content"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_not_contains() {
    local content="$1"
    local unexpected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if echo "$content" | grep -q -- "$unexpected"; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Unexpectedly found: $unexpected"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
}

assert_equals() {
    local actual="$1"
    local expected="$2"
    local description="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected: $expected"
        echo -e "    Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_exists() {
    local filepath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -f "$filepath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    File not found: $filepath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_exists() {
    local dirpath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ -d "$dirpath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory not found: $dirpath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_not_exists() {
    local dirpath="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [ ! -d "$dirpath" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSES=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Directory should not exist: $dirpath"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_exit_nonzero() {
    local description="$1"
    shift

    TESTS_RUN=$((TESTS_RUN + 1))

    cd "$TEST_DIR"
    if node "$MANIFEST_JS" "$@" >/dev/null 2>&1; then
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected non-zero exit code but got 0"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    else
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    fi
}

# ============================================================================
# INIT TESTS
# ============================================================================

echo -e "${YELLOW}Test: init creates valid manifest${NC}"
setup_fixture
output=$(run_cli init dark-mode --work-type feature --description "Add dark mode")

assert_file_exists "$TEST_DIR/.workflows/dark-mode/manifest.json" "manifest.json created"
content=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
assert_contains "$content" '"name": "dark-mode"' "name field set"
assert_contains "$content" '"work_type": "feature"' "work_type field set"
assert_contains "$content" '"status": "in-progress"' "status defaults to in-progress"
assert_contains "$content" '"description": "Add dark mode"' "description set"
assert_contains "$content" '"phases": {}' "phases initialized empty"
assert_contains "$content" '"created":' "created date set"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init rejects duplicate names${NC}"
setup_fixture
run_cli init my-feature --work-type feature --description "First" >/dev/null 2>&1
output=$(run_cli init my-feature --work-type feature --description "Second" || true)

assert_contains "$output" "already exists" "Duplicate name rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init rejects invalid work_type${NC}"
setup_fixture
assert_exit_nonzero "Invalid work_type rejected" init bad-type --work-type invalid --description "Bad"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init rejects missing work_type${NC}"
setup_fixture
assert_exit_nonzero "Missing work_type rejected" init no-type --description "No type"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init rejects dots in work unit name${NC}"
setup_fixture
assert_exit_nonzero "Dot in name rejected" init foo.bar --work-type feature --description "Bad name"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init rejects phase name as work unit name${NC}"
setup_fixture
assert_exit_nonzero "Phase name as work unit rejected" init discussion --work-type feature --description "Bad name"
assert_exit_nonzero "Phase name as work unit rejected (research)" init research --work-type feature --description "Bad name"

echo ""

# ============================================================================
# GET TESTS
# ============================================================================

echo -e "${YELLOW}Test: get full manifest${NC}"
setup_fixture
run_cli init test-get --work-type feature --description "Test get" >/dev/null 2>&1
output=$(run_cli_stdout get test-get)

assert_contains "$output" '"name": "test-get"' "Full manifest contains name"
assert_contains "$output" '"work_type": "feature"' "Full manifest contains work_type"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get scalar value at work-unit level (raw output)${NC}"
setup_fixture
run_cli init scalar-test --work-type bugfix --description "Scalar" >/dev/null 2>&1
output=$(run_cli_stdout get scalar-test status)

assert_equals "$output" "in-progress" "Scalar value output raw"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get subtree at phase level (2-segment path)${NC}"
setup_fixture
run_cli init subtree-test --work-type feature --description "Subtree" >/dev/null 2>&1
run_cli init-phase subtree-test.discussion.subtree-test >/dev/null 2>&1
output=$(run_cli_stdout get subtree-test.discussion)

assert_contains "$output" '"status": "in-progress"' "Subtree output as JSON"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get topic-level value for feature${NC}"
setup_fixture
run_cli init feat-get --work-type feature --description "Get test" >/dev/null 2>&1
run_cli init-phase feat-get.discussion.feat-get >/dev/null 2>&1
output=$(run_cli_stdout get feat-get.discussion.feat-get status)

assert_equals "$output" "in-progress" "Feature topic-level get returns status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get topic-level value for epic${NC}"
setup_fixture
run_cli init epic-get --work-type epic --description "Get test" >/dev/null 2>&1
run_cli init-phase epic-get.discussion.my-topic >/dev/null 2>&1
output=$(run_cli_stdout get epic-get.discussion.my-topic status)

assert_equals "$output" "in-progress" "Epic topic-level get routes through items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get error on missing path${NC}"
setup_fixture
run_cli init missing-path --work-type feature --description "Missing" >/dev/null 2>&1
assert_exit_nonzero "Missing path returns error" get missing-path nonexistent.deep.path

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get error on missing work unit${NC}"
setup_fixture
assert_exit_nonzero "Missing work unit returns error" get does-not-exist

echo ""

# ============================================================================
# SET TESTS
# ============================================================================

echo -e "${YELLOW}Test: set work-unit-level value${NC}"
setup_fixture
run_cli init set-test --work-type feature --description "Set test" >/dev/null 2>&1
run_cli set set-test description "Updated description" >/dev/null 2>&1
output=$(run_cli_stdout get set-test description)

assert_equals "$output" "Updated description" "Work-unit level value set"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level value for feature${NC}"
setup_fixture
run_cli init feat-set --work-type feature --description "Set" >/dev/null 2>&1
run_cli init-phase feat-set.discussion.feat-set >/dev/null 2>&1
run_cli set feat-set.discussion.feat-set status completed >/dev/null 2>&1
output=$(run_cli_stdout get feat-set.discussion.feat-set status)

assert_equals "$output" "completed" "Feature topic-level set works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level value for epic${NC}"
setup_fixture
run_cli init epic-set --work-type epic --description "Set" >/dev/null 2>&1
run_cli init-phase epic-set.discussion.my-topic >/dev/null 2>&1
run_cli set epic-set.discussion.my-topic status completed >/dev/null 2>&1
output=$(run_cli_stdout get epic-set.discussion.my-topic status)

assert_equals "$output" "completed" "Epic topic-level set routes through items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set auto-creates intermediate keys${NC}"
setup_fixture
run_cli init intermediate --work-type feature --description "Intermediate" >/dev/null 2>&1
run_cli set intermediate.discussion.intermediate status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get intermediate.discussion.intermediate status)

assert_equals "$output" "in-progress" "Intermediate keys auto-created"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level research with topic works${NC}"
setup_fixture
run_cli init topicful --work-type feature --description "Topic research" >/dev/null 2>&1
run_cli set topicful.research.exploration status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get topicful.research.exploration status)

assert_equals "$output" "in-progress" "Set research with topic routes correctly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level research for epic uses items${NC}"
setup_fixture
run_cli init topicful2 --work-type epic --description "Topic research epic" >/dev/null 2>&1
run_cli init-phase topicful2.research.exploration >/dev/null 2>&1
run_cli set topicful2.research.exploration status completed >/dev/null 2>&1
output=$(run_cli_stdout get topicful2.research.exploration status)

assert_equals "$output" "completed" "Epic research with topic uses items path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase-level (2-segment) returns whole phase object${NC}"
setup_fixture
run_cli init topicful3 --work-type feature --description "Topic get" >/dev/null 2>&1
run_cli set topicful3.research.exploration status completed >/dev/null 2>&1
output=$(run_cli_stdout get topicful3.research)

assert_contains "$output" '"status": "completed"' "Get phase-level returns phase object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set phase-level field (2-segment path)${NC}"
setup_fixture
run_cli init phase-set --work-type feature --description "Phase set" >/dev/null 2>&1
run_cli set phase-set.planning format local-markdown >/dev/null 2>&1
output=$(run_cli_stdout get phase-set.planning format)

assert_equals "$output" "local-markdown" "Phase-level set works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase names${NC}"
setup_fixture
run_cli init phase-check --work-type feature --description "Phase" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase rejected" set phase-check.cooking.phase-check status in-progress

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase status${NC}"
setup_fixture
run_cli init status-check --work-type feature --description "Status" >/dev/null 2>&1
assert_exit_nonzero "Invalid status for discussion rejected" set status-check.discussion.status-check status concluded
assert_exit_nonzero "Invalid status for implementation rejected" set status-check.implementation.status-check status concluded

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set validates correct phase statuses${NC}"
setup_fixture
run_cli init valid-status --work-type feature --description "Valid" >/dev/null 2>&1
run_cli set valid-status.discussion.valid-status status completed >/dev/null 2>&1
run_cli set valid-status.implementation.valid-status status completed >/dev/null 2>&1

disc_status=$(run_cli_stdout get valid-status.discussion.valid-status status)
impl_status=$(run_cli_stdout get valid-status.implementation.valid-status status)

assert_equals "$disc_status" "completed" "Discussion accepts completed"
assert_equals "$impl_status" "completed" "Implementation accepts completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid gate modes${NC}"
setup_fixture
run_cli init gate-check --work-type feature --description "Gate" >/dev/null 2>&1
assert_exit_nonzero "Invalid gate mode rejected" set gate-check.planning.gate-check task_gate_mode manual

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set accepts valid gate modes${NC}"
setup_fixture
run_cli init gate-valid --work-type feature --description "Gate" >/dev/null 2>&1
run_cli set gate-valid.planning.gate-valid task_gate_mode auto >/dev/null 2>&1
output=$(run_cli_stdout get gate-valid.planning.gate-valid task_gate_mode)

assert_equals "$output" "auto" "Gate mode set to auto"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work_type${NC}"
setup_fixture
run_cli init wt-check --work-type feature --description "WT" >/dev/null 2>&1
assert_exit_nonzero "Invalid work_type on set rejected" set wt-check work_type project

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work unit status${NC}"
setup_fixture
run_cli init ws-check --work-type feature --description "WS" >/dev/null 2>&1
assert_exit_nonzero "Invalid work unit status rejected" set ws-check status deleted

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set parses JSON values${NC}"
setup_fixture
run_cli init json-parse --work-type feature --description "JSON" >/dev/null 2>&1
run_cli set json-parse.specification.json-parse sources '[{"name":"auth","status":"pending"}]' >/dev/null 2>&1
output=$(run_cli_stdout get json-parse.specification.json-parse sources)

assert_contains "$output" '"name": "auth"' "JSON array parsed and stored"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set nested field path with dots${NC}"
setup_fixture
run_cli init dotpath --work-type feature --description "Dots" >/dev/null 2>&1
run_cli set dotpath.specification.dotpath sources.auth-api.status incorporated >/dev/null 2>&1
output=$(run_cli_stdout get dotpath.specification.dotpath sources.auth-api.status)

assert_equals "$output" "incorporated" "Nested dot-path field set and get works"

echo ""

# ============================================================================
# LIST TESTS
# ============================================================================

echo -e "${YELLOW}Test: list returns empty array when no work units${NC}"
setup_fixture
output=$(run_cli_stdout list)

assert_equals "$output" "[]" "Empty list returns []"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list returns all work units${NC}"
setup_fixture
run_cli init alpha --work-type feature --description "Alpha" >/dev/null 2>&1
run_cli init beta --work-type bugfix --description "Beta" >/dev/null 2>&1
run_cli init gamma --work-type epic --description "Gamma" >/dev/null 2>&1
output=$(run_cli_stdout list)

assert_contains "$output" '"name": "alpha"' "Lists alpha"
assert_contains "$output" '"name": "beta"' "Lists beta"
assert_contains "$output" '"name": "gamma"' "Lists gamma"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list filters by status${NC}"
setup_fixture
run_cli init active-one --work-type feature --description "Active" >/dev/null 2>&1
run_cli init completed-one --work-type feature --description "Completed" >/dev/null 2>&1
run_cli set completed-one status completed >/dev/null 2>&1
output=$(run_cli_stdout list --status in-progress)

assert_contains "$output" '"name": "active-one"' "In-progress work unit listed"
assert_not_contains "$output" '"name": "completed-one"' "Completed work unit excluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list filters by work-type${NC}"
setup_fixture
run_cli init feat --work-type feature --description "Feature" >/dev/null 2>&1
run_cli init bug --work-type bugfix --description "Bugfix" >/dev/null 2>&1
output=$(run_cli_stdout list --work-type feature)

assert_contains "$output" '"name": "feat"' "Feature listed"
assert_not_contains "$output" '"name": "bug"' "Bugfix excluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list skips dot-prefixed directories${NC}"
setup_fixture
run_cli init visible --work-type feature --description "Visible" >/dev/null 2>&1
# Create dot-prefixed directories that should be skipped
mkdir -p "$TEST_DIR/.workflows/.archive/old-thing"
cat > "$TEST_DIR/.workflows/.archive/old-thing/manifest.json" << 'EOF'
{"name":"old-thing","work_type":"feature","status":"cancelled"}
EOF
mkdir -p "$TEST_DIR/.workflows/.cache"
mkdir -p "$TEST_DIR/.workflows/.state"
output=$(run_cli_stdout list)

assert_contains "$output" '"name": "visible"' "Visible work unit listed"
assert_not_contains "$output" '"name": "old-thing"' "Dot-prefixed directory skipped"

echo ""

# ============================================================================
# INIT-PHASE TESTS
# ============================================================================

echo -e "${YELLOW}Test: init-phase for epic creates item with in-progress status${NC}"
setup_fixture
run_cli init my-epic --work-type epic --description "My Epic" >/dev/null 2>&1
run_cli init-phase my-epic.discussion.payment-processing >/dev/null 2>&1
output=$(run_cli_stdout get my-epic.discussion.payment-processing status)

assert_equals "$output" "in-progress" "Epic item created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init-phase for feature creates items structure${NC}"
setup_fixture
run_cli init my-feat --work-type feature --description "My Feature" >/dev/null 2>&1
run_cli init-phase my-feat.discussion.my-feat >/dev/null 2>&1
output=$(run_cli_stdout get my-feat.discussion.my-feat status)

assert_equals "$output" "in-progress" "Feature phase created with in-progress status"

# Verify internal structure uses items (unified with epic)
content=$(cat "$TEST_DIR/.workflows/my-feat/manifest.json")
assert_contains "$content" '"items"' "Feature manifest has items key"
assert_contains "$content" '"my-feat"' "Feature items key matches work unit name"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init-phase for bugfix creates items structure${NC}"
setup_fixture
run_cli init my-bug --work-type bugfix --description "My Bug" >/dev/null 2>&1
run_cli init-phase my-bug.investigation.my-bug >/dev/null 2>&1
output=$(run_cli_stdout get my-bug.investigation.my-bug status)

assert_equals "$output" "in-progress" "Bugfix phase created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init-phase rejects duplicate epic items${NC}"
setup_fixture
run_cli init dup-epic --work-type epic --description "Dup" >/dev/null 2>&1
run_cli init-phase dup-epic.discussion.my-item >/dev/null 2>&1
output=$(run_cli init-phase dup-epic.discussion.my-item || true)

assert_contains "$output" "already exists" "Duplicate epic item rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init-phase rejects duplicate feature phase${NC}"
setup_fixture
run_cli init dup-feat --work-type feature --description "Dup" >/dev/null 2>&1
run_cli init-phase dup-feat.discussion.dup-feat >/dev/null 2>&1
output=$(run_cli init-phase dup-feat.discussion.dup-feat || true)

assert_contains "$output" "already exists" "Duplicate feature phase rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: init-phase rejects invalid phase${NC}"
setup_fixture
run_cli init bad-phase-epic --work-type epic --description "Bad" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase in init-phase rejected" init-phase bad-phase-epic.cooking.soup

echo ""

# ============================================================================
# PUSH TESTS
# ============================================================================

echo -e "${YELLOW}Test: push to non-existent field creates array${NC}"
setup_fixture
run_cli init push-new --work-type feature --description "Push new" >/dev/null 2>&1
run_cli init-phase push-new.implementation.push-new >/dev/null 2>&1
run_cli push push-new.implementation.push-new completed_tasks "task-1" >/dev/null 2>&1
output=$(run_cli_stdout get push-new.implementation.push-new completed_tasks)

assert_contains "$output" '"task-1"' "Push creates array with value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push to existing array appends${NC}"
setup_fixture
run_cli init push-append --work-type feature --description "Push append" >/dev/null 2>&1
run_cli init-phase push-append.implementation.push-append >/dev/null 2>&1
run_cli push push-append.implementation.push-append completed_tasks "task-1" >/dev/null 2>&1
run_cli push push-append.implementation.push-append completed_tasks "task-2" >/dev/null 2>&1
output=$(run_cli_stdout get push-append.implementation.push-append completed_tasks)

assert_contains "$output" '"task-1"' "First value present"
assert_contains "$output" '"task-2"' "Second value appended"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push to non-array field errors${NC}"
setup_fixture
run_cli init push-bad --work-type feature --description "Push bad" >/dev/null 2>&1
run_cli init-phase push-bad.implementation.push-bad >/dev/null 2>&1
output=$(run_cli push push-bad.implementation.push-bad status "value" || true)

assert_contains "$output" "not an array" "Push to non-array errors"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push topic-level for feature${NC}"
setup_fixture
run_cli init push-feat --work-type feature --description "Push feat" >/dev/null 2>&1
run_cli init-phase push-feat.implementation.push-feat >/dev/null 2>&1
run_cli push push-feat.implementation.push-feat completed_phases 1 >/dev/null 2>&1
output=$(run_cli_stdout get push-feat.implementation.push-feat completed_phases)

assert_contains "$output" "1" "Push numeric value to feature"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push topic-level for epic${NC}"
setup_fixture
run_cli init push-epic --work-type epic --description "Push epic" >/dev/null 2>&1
run_cli init-phase push-epic.implementation.my-topic >/dev/null 2>&1
run_cli push push-epic.implementation.my-topic completed_tasks "task-a" >/dev/null 2>&1
output=$(run_cli_stdout get push-epic.implementation.my-topic completed_tasks)

assert_contains "$output" '"task-a"' "Push routes through items for epic"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push at work-unit level${NC}"
setup_fixture
run_cli init push-wu --work-type feature --description "Push WU" >/dev/null 2>&1
run_cli push push-wu tags "v1" >/dev/null 2>&1
run_cli push push-wu tags "v2" >/dev/null 2>&1
output=$(run_cli_stdout get push-wu tags)

assert_contains "$output" '"v1"' "First tag present"
assert_contains "$output" '"v2"' "Second tag appended"

echo ""

# ============================================================================
# DOMAIN ROUTING TESTS
# ============================================================================

echo -e "${YELLOW}Test: feature get/set routes through items (unified)${NC}"
setup_fixture
run_cli init routing-feat --work-type feature --description "Routing" >/dev/null 2>&1
run_cli init-phase routing-feat.discussion.routing-feat >/dev/null 2>&1
run_cli set routing-feat.discussion.routing-feat status completed >/dev/null 2>&1

# Verify internal structure uses items (same as epic)
content=$(cat "$TEST_DIR/.workflows/routing-feat/manifest.json")
assert_contains "$content" '"discussion"' "Discussion phase exists"
assert_contains "$content" '"items"' "Feature manifest has items key"
assert_contains "$content" '"routing-feat"' "Items key matches work unit name"
assert_contains "$content" '"status": "completed"' "Status set to completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic get/set routes through items${NC}"
setup_fixture
run_cli init routing-epic --work-type epic --description "Routing" >/dev/null 2>&1
run_cli init-phase routing-epic.discussion.topic-a >/dev/null 2>&1
run_cli init-phase routing-epic.discussion.topic-b >/dev/null 2>&1
run_cli set routing-epic.discussion.topic-a status completed >/dev/null 2>&1

# Verify internal structure has items
content=$(cat "$TEST_DIR/.workflows/routing-epic/manifest.json")
assert_contains "$content" '"items"' "Epic manifest has items"
assert_contains "$content" '"topic-a"' "topic-a exists"
assert_contains "$content" '"topic-b"' "topic-b exists"

# Get specific item
topic_a=$(run_cli_stdout get routing-epic.discussion.topic-a status)
topic_b=$(run_cli_stdout get routing-epic.discussion.topic-b status)
assert_equals "$topic_a" "completed" "topic-a status is completed"
assert_equals "$topic_b" "in-progress" "topic-b status is in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase-level returns whole phase object${NC}"
setup_fixture
run_cli init phase-obj --work-type epic --description "Phase obj" >/dev/null 2>&1
run_cli init-phase phase-obj.discussion.topic-x >/dev/null 2>&1
output=$(run_cli_stdout get phase-obj.discussion)

assert_contains "$output" '"items"' "Phase object contains items"
assert_contains "$output" '"topic-x"' "Phase object contains topic-x"

echo ""

# ============================================================================
# EDGE CASES
# ============================================================================

echo -e "${YELLOW}Test: set on missing work unit errors${NC}"
setup_fixture
assert_exit_nonzero "Set on nonexistent work unit fails" set ghost status cancelled

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: no command shows usage${NC}"
setup_fixture
output=$(run_cli || true)
assert_contains "$output" "Usage" "No command shows usage"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: unknown command errors${NC}"
setup_fixture
assert_exit_nonzero "Unknown command rejected" destroy everything

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic item-level status validation${NC}"
setup_fixture
run_cli init epic-validation --work-type epic --description "Validate items" >/dev/null 2>&1
run_cli init-phase epic-validation.discussion.my-topic >/dev/null 2>&1
assert_exit_nonzero "Invalid item status rejected" set epic-validation.discussion.my-topic status concluded

# Valid item status should work
run_cli set epic-validation.discussion.my-topic status completed >/dev/null 2>&1
output=$(run_cli_stdout get epic-validation.discussion.my-topic status)
assert_equals "$output" "completed" "Valid item status accepted"

echo ""

# ============================================================================
# EXISTS TESTS
# ============================================================================

echo -e "${YELLOW}Test: exists returns true for existing work unit${NC}"
setup_fixture
run_cli init exists-test --work-type feature --description "Exists" >/dev/null 2>&1
output=$(run_cli_stdout exists exists-test)
exit_code=$(run_cli_exit_code exists exists-test)

assert_equals "$output" "true" "Existing work unit returns true"
assert_equals "$exit_code" "0" "Existing work unit exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists returns false for non-existent work unit${NC}"
setup_fixture
output=$(run_cli_stdout exists nonexistent-unit)
exit_code=$(run_cli_exit_code exists nonexistent-unit)

assert_equals "$output" "false" "Non-existent work unit returns false"
assert_equals "$exit_code" "0" "Non-existent work unit exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with field that exists${NC}"
setup_fixture
run_cli init exists-field --work-type feature --description "Field" >/dev/null 2>&1
output=$(run_cli_stdout exists exists-field work_type)
exit_code=$(run_cli_exit_code exists exists-field work_type)

assert_equals "$output" "true" "Existing field returns true"
assert_equals "$exit_code" "0" "Existing field exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with field that does not exist${NC}"
setup_fixture
run_cli init exists-nofield --work-type feature --description "No field" >/dev/null 2>&1
output=$(run_cli_stdout exists exists-nofield nonexistent.deep.path)
exit_code=$(run_cli_exit_code exists exists-nofield nonexistent.deep.path)

assert_equals "$output" "false" "Non-existent field returns false"
assert_equals "$exit_code" "0" "Non-existent field exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with topic-level path that exists${NC}"
setup_fixture
run_cli init exists-phase --work-type epic --description "Phase" >/dev/null 2>&1
run_cli init-phase exists-phase.discussion.my-topic >/dev/null 2>&1
output=$(run_cli_stdout exists exists-phase.discussion.my-topic)
exit_code=$(run_cli_exit_code exists exists-phase.discussion.my-topic)

assert_equals "$output" "true" "Existing phase/topic returns true"
assert_equals "$exit_code" "0" "Existing phase/topic exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with topic-level path that does not exist${NC}"
setup_fixture
run_cli init exists-nophase --work-type epic --description "No phase" >/dev/null 2>&1
output=$(run_cli_stdout exists exists-nophase.discussion.missing-topic)
exit_code=$(run_cli_exit_code exists exists-nophase.discussion.missing-topic)

assert_equals "$output" "false" "Non-existent phase/topic returns false"
assert_equals "$exit_code" "0" "Non-existent phase/topic exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with non-existent work unit and deep path returns false${NC}"
setup_fixture
output=$(run_cli_stdout exists ghost-unit work_type)
exit_code=$(run_cli_exit_code exists ghost-unit work_type)

assert_equals "$output" "false" "Non-existent work unit + deep path returns false"
assert_equals "$exit_code" "0" "Non-existent work unit + deep path exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with no args returns non-zero exit${NC}"
setup_fixture
assert_exit_nonzero "exists with no args fails" exists

echo ""

# ============================================================================
# WILDCARD TOPIC
# ============================================================================

echo -e "${YELLOW}Test: get with wildcard topic on epic returns all items${NC}"
setup_fixture
run_cli init wc-epic --work-type epic --description "Wildcard" >/dev/null 2>&1
run_cli init-phase wc-epic.implementation.auth-flow >/dev/null 2>&1
run_cli init-phase wc-epic.implementation.billing >/dev/null 2>&1
run_cli set wc-epic.implementation.auth-flow status completed >/dev/null 2>&1
output=$(run_cli_stdout get wc-epic.implementation.* status)
assert_contains "$output" '"topic": "auth-flow"' "Wildcard get includes auth-flow"
assert_contains "$output" '"value": "completed"' "Wildcard get shows completed value"
assert_contains "$output" '"topic": "billing"' "Wildcard get includes billing"
assert_contains "$output" '"value": "in-progress"' "Wildcard get shows in-progress value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get with wildcard topic on feature returns single item${NC}"
setup_fixture
run_cli init wc-feat --work-type feature --description "Wildcard" >/dev/null 2>&1
run_cli init-phase wc-feat.implementation.wc-feat >/dev/null 2>&1
run_cli set wc-feat.implementation.wc-feat status completed >/dev/null 2>&1
output=$(run_cli_stdout get wc-feat.implementation.* status)
assert_contains "$output" '"topic": "wc-feat"' "Wildcard get on feature includes topic"
assert_contains "$output" '"value": "completed"' "Wildcard get on feature shows value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get with wildcard topic on empty phase fails${NC}"
setup_fixture
run_cli init wc-empty --work-type epic --description "Empty" >/dev/null 2>&1
run_cli set wc-empty phases.implementation '{}' >/dev/null 2>&1
assert_exit_nonzero "Wildcard on empty phase returns error" get wc-empty.implementation.* status

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with wildcard topic returns true when items exist${NC}"
setup_fixture
run_cli init wc-exists --work-type epic --description "Exists" >/dev/null 2>&1
run_cli init-phase wc-exists.implementation.topic-a >/dev/null 2>&1
output=$(run_cli_stdout exists wc-exists.implementation.* status)
exit_code=$?
assert_equals "$output" "true" "Wildcard exists returns true when items have field"
assert_equals "$exit_code" "0" "Wildcard exists exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with wildcard topic returns false when no items${NC}"
setup_fixture
run_cli init wc-noitems --work-type epic --description "No items" >/dev/null 2>&1
output=$(run_cli_stdout exists wc-noitems.implementation.* status)
exit_code=$?
assert_equals "$output" "false" "Wildcard exists returns false when no items"
assert_equals "$exit_code" "0" "Wildcard exists on empty exits 0"

echo ""

# ============================================================================
# DELETE TESTS
# ============================================================================

echo -e "${YELLOW}Test: delete work-unit-level field${NC}"
setup_fixture
run_cli init del-wu --work-type feature --description "Delete WU" >/dev/null 2>&1
run_cli set del-wu.research analysis_cache '{"checksum":"abc","generated":"2026-01-01"}' >/dev/null 2>&1
run_cli delete del-wu.research analysis_cache >/dev/null 2>&1
output=$(run_cli_stdout exists del-wu.research analysis_cache)

assert_equals "$output" "false" "Deleted field no longer exists"

# Verify sibling fields preserved
run_cli set del-wu.research status completed >/dev/null 2>&1

# Re-create and delete to check siblings
run_cli set del-wu.research analysis_cache '{"checksum":"xyz"}' >/dev/null 2>&1
run_cli delete del-wu.research analysis_cache >/dev/null 2>&1
research_status=$(run_cli_stdout get del-wu.research status)

assert_equals "$research_status" "completed" "Sibling fields preserved after delete"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete topic-level field for feature${NC}"
setup_fixture
run_cli init del-feat --work-type feature --description "Delete feat" >/dev/null 2>&1
run_cli init-phase del-feat.planning.del-feat >/dev/null 2>&1
run_cli set del-feat.planning.del-feat task_gate_mode auto >/dev/null 2>&1
run_cli delete del-feat.planning.del-feat task_gate_mode >/dev/null 2>&1
output=$(run_cli_stdout exists del-feat.planning.del-feat task_gate_mode)

assert_equals "$output" "false" "Deleted topic-level field gone"

# Verify status preserved
plan_status=$(run_cli_stdout get del-feat.planning.del-feat status)
assert_equals "$plan_status" "in-progress" "Phase status preserved after delete"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete topic-level field for epic${NC}"
setup_fixture
run_cli init del-epic --work-type epic --description "Delete epic" >/dev/null 2>&1
run_cli init-phase del-epic.implementation.auth >/dev/null 2>&1
run_cli push del-epic.implementation.auth completed_tasks "task-1" >/dev/null 2>&1
run_cli delete del-epic.implementation.auth completed_tasks >/dev/null 2>&1
output=$(run_cli_stdout exists del-epic.implementation.auth completed_tasks)

assert_equals "$output" "false" "Deleted epic item field gone"

# Verify status preserved
impl_status=$(run_cli_stdout get del-epic.implementation.auth status)
assert_equals "$impl_status" "in-progress" "Epic item status preserved after delete"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete nested dot-path field${NC}"
setup_fixture
run_cli init del-nested --work-type feature --description "Nested" >/dev/null 2>&1
run_cli set del-nested.research analysis_cache.checksum "abc123" >/dev/null 2>&1
run_cli set del-nested.research analysis_cache.generated "2026-01-01" >/dev/null 2>&1
run_cli delete del-nested.research analysis_cache.checksum >/dev/null 2>&1

checksum_exists=$(run_cli_stdout exists del-nested.research analysis_cache.checksum)
generated_exists=$(run_cli_stdout exists del-nested.research analysis_cache.generated)

assert_equals "$checksum_exists" "false" "Nested field deleted"
assert_equals "$generated_exists" "true" "Sibling nested field preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete entire subtree${NC}"
setup_fixture
run_cli init del-tree --work-type feature --description "Tree" >/dev/null 2>&1
run_cli set del-tree.research analysis_cache '{"checksum":"abc","generated":"2026-01-01","files":["a.md","b.md"]}' >/dev/null 2>&1
run_cli delete del-tree.research analysis_cache >/dev/null 2>&1

cache_exists=$(run_cli_stdout exists del-tree.research analysis_cache)
research_exists=$(run_cli_stdout exists del-tree.research)

assert_equals "$cache_exists" "false" "Entire subtree deleted"
assert_equals "$research_exists" "true" "Parent key preserved"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete errors on missing path${NC}"
setup_fixture
run_cli init del-missing --work-type feature --description "Missing" >/dev/null 2>&1
assert_exit_nonzero "Delete missing path errors" delete del-missing nonexistent.deep.path

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete errors on missing work unit${NC}"
setup_fixture
assert_exit_nonzero "Delete missing work unit errors" delete ghost-unit some.field

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete phase-level field (2-segment path)${NC}"
setup_fixture
run_cli init del-phase --work-type feature --description "Phase del" >/dev/null 2>&1
run_cli set del-phase.research analysis_cache '{"checksum":"abc"}' >/dev/null 2>&1
run_cli delete del-phase.research analysis_cache >/dev/null 2>&1
output=$(run_cli_stdout exists del-phase.research analysis_cache)

assert_equals "$output" "false" "Phase-level delete works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete rejects invalid phase${NC}"
setup_fixture
run_cli init del-badphase --work-type feature --description "Bad phase" >/dev/null 2>&1
assert_exit_nonzero "Delete invalid phase errors" delete del-badphase.cooking.del-badphase status

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push phase-level (2-segment path)${NC}"
setup_fixture
run_cli init push-phase --work-type feature --description "Phase push" >/dev/null 2>&1
run_cli push push-phase.research analysis_cache.files "a.md" >/dev/null 2>&1
output=$(run_cli_stdout get push-phase.research analysis_cache.files)

assert_contains "$output" '"a.md"' "Phase-level push works"

echo ""

# ============================================================================
# KEY-OF COMMAND
# ============================================================================

echo -e "${YELLOW}Test: key-of finds key by value${NC}"
setup_fixture
run_cli init key-of-test --work-type feature --description "Key-of test" >/dev/null 2>&1
run_cli init-phase key-of-test.planning.key-of-test >/dev/null 2>&1
run_cli set key-of-test.planning.key-of-test task_map.portal-1-1 tick-abc >/dev/null 2>&1
run_cli set key-of-test.planning.key-of-test task_map.portal-1-2 tick-def >/dev/null 2>&1

output=$(run_cli_stdout key-of key-of-test.planning.key-of-test task_map tick-abc)
assert_equals "$output" "portal-1-1" "key-of returns correct key for first value"

output=$(run_cli_stdout key-of key-of-test.planning.key-of-test task_map tick-def)
assert_equals "$output" "portal-1-2" "key-of returns correct key for second value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: key-of errors on missing value${NC}"
setup_fixture
run_cli init key-of-miss --work-type feature --description "Key-of miss" >/dev/null 2>&1
run_cli init-phase key-of-miss.planning.key-of-miss >/dev/null 2>&1
run_cli set key-of-miss.planning.key-of-miss task_map.t-1 ext-1 >/dev/null 2>&1

exit_code=$(run_cli_exit_code key-of key-of-miss.planning.key-of-miss task_map ext-notfound)
assert_equals "$exit_code" "1" "key-of errors when value not found"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: key-of errors on non-object path${NC}"
setup_fixture
run_cli init key-of-scalar --work-type feature --description "Key-of scalar" >/dev/null 2>&1
run_cli init-phase key-of-scalar.planning.key-of-scalar >/dev/null 2>&1
run_cli set key-of-scalar.planning.key-of-scalar format tick >/dev/null 2>&1

exit_code=$(run_cli_exit_code key-of key-of-scalar.planning.key-of-scalar format tick)
assert_equals "$exit_code" "1" "key-of errors when path is not an object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: key-of works at work-unit level${NC}"
setup_fixture
run_cli init key-of-wu --work-type feature --description "Key-of work unit" >/dev/null 2>&1
run_cli set key-of-wu custom_map '{"a":"x","b":"y"}' >/dev/null 2>&1

output=$(run_cli_stdout key-of key-of-wu custom_map y)
assert_equals "$output" "b" "key-of works at work-unit level"

echo ""

# ============================================================================
# PROJECT DOT-PATH TESTS
# ============================================================================

echo -e "${YELLOW}Test: init rejects reserved name 'project'${NC}"
setup_fixture
output=$(run_cli init project --work-type feature --description "Bad name" 2>&1 || true)
assert_contains "$output" "reserved" "Reserved name rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set and get project.defaults.plan_format${NC}"
setup_fixture
run_cli init my-proj --work-type feature --description "Setup" >/dev/null 2>&1
run_cli set project.defaults.plan_format local-markdown >/dev/null 2>&1

output=$(run_cli_stdout get project.defaults.plan_format)
assert_equals "$output" "local-markdown" "Get project default plan_format"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists project.defaults.plan_format${NC}"
setup_fixture
run_cli init ex-proj --work-type feature --description "Setup" >/dev/null 2>&1
run_cli set project.defaults.plan_format tick >/dev/null 2>&1

output=$(run_cli_stdout exists project.defaults.plan_format)
assert_equals "$output" "true" "Exists returns true for set default"

output=$(run_cli_stdout exists project.defaults.nonexistent)
assert_equals "$output" "false" "Exists returns false for missing default"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete project.defaults.plan_format${NC}"
setup_fixture
run_cli init del-proj --work-type feature --description "Setup" >/dev/null 2>&1
run_cli set project.defaults.plan_format linear >/dev/null 2>&1
run_cli delete project.defaults.plan_format >/dev/null 2>&1

output=$(run_cli_stdout exists project.defaults.plan_format)
assert_equals "$output" "false" "Deleted project default no longer exists"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push project.defaults.project_skills${NC}"
setup_fixture
run_cli init push-proj --work-type feature --description "Setup" >/dev/null 2>&1
run_cli push project.defaults.project_skills ".claude/skills/golang-pro" >/dev/null 2>&1
run_cli push project.defaults.project_skills ".claude/skills/react-patterns" >/dev/null 2>&1

output=$(run_cli_stdout get project.defaults.project_skills)
assert_contains "$output" "golang-pro" "Push first skill present"
assert_contains "$output" "react-patterns" "Push second skill appended"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project returns full project manifest${NC}"
setup_fixture
run_cli init full-proj --work-type epic --description "Full test" >/dev/null 2>&1

output=$(run_cli_stdout get project)
assert_contains "$output" "work_units" "Full project manifest has work_units"
assert_contains "$output" "full-proj" "Full project manifest has work unit name"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project.work_units returns work_units object${NC}"
setup_fixture
run_cli init wu-proj --work-type feature --description "WU test" >/dev/null 2>&1

output=$(run_cli_stdout get project.work_units)
assert_contains "$output" "wu-proj" "Work units object has expected entry"
assert_contains "$output" "feature" "Work units entry has work_type"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists project returns true when manifest exists${NC}"
setup_fixture
run_cli init exists-proj --work-type feature --description "Exists test" >/dev/null 2>&1

output=$(run_cli_stdout exists project)
assert_equals "$output" "true" "Exists project returns true with content"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project.defaults errors when not set${NC}"
setup_fixture
run_cli init err-proj --work-type feature --description "Error test" >/dev/null 2>&1

output=$(run_cli get project.defaults.plan_format 2>&1 || true)
assert_contains "$output" "not found" "Get missing project default errors"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set project.defaults without value errors${NC}"
setup_fixture
output=$(run_cli set project.defaults.plan_format 2>&1 || true)
assert_contains "$output" "Usage" "Set without value shows usage"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: project set does not require work unit to exist${NC}"
setup_fixture
run_cli set project.defaults.plan_format tick >/dev/null 2>&1
output=$(run_cli_stdout get project.defaults.plan_format)
assert_equals "$output" "tick" "Can set project default without any work units"

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "========================================"
echo -e "Tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================"

if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi
