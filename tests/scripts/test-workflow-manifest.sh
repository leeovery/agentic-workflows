#!/bin/bash
#
# Tests for the workflow manifest CLI (manifest.js)
# Validates init, get, set, list, add-item, archive commands.
# Uses domain-aware flag syntax (--phase, --topic).
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_JS="$SCRIPT_DIR/../../skills/workflow-manifest/scripts/manifest.js"

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
        TESTS_PASSED=$((TESTS_PASSED + 1))
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
assert_contains "$content" '"status": "active"' "status defaults to active"
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

assert_equals "$output" "active" "Scalar value output raw"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get subtree at work-unit level${NC}"
setup_fixture
run_cli init subtree-test --work-type feature --description "Subtree" >/dev/null 2>&1
run_cli add-item subtree-test --phase discussion --topic subtree-test >/dev/null 2>&1
output=$(run_cli_stdout get subtree-test --phase discussion)

assert_contains "$output" '"status": "in-progress"' "Subtree output as JSON"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase-level value for feature (flat routing)${NC}"
setup_fixture
run_cli init feat-get --work-type feature --description "Get test" >/dev/null 2>&1
run_cli add-item feat-get --phase discussion --topic feat-get >/dev/null 2>&1
output=$(run_cli_stdout get feat-get --phase discussion --topic feat-get status)

assert_equals "$output" "in-progress" "Feature phase-level get returns flat status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase-level value for epic (items routing)${NC}"
setup_fixture
run_cli init epic-get --work-type epic --description "Get test" >/dev/null 2>&1
run_cli add-item epic-get --phase discussion --topic my-topic >/dev/null 2>&1
output=$(run_cli_stdout get epic-get --phase discussion --topic my-topic status)

assert_equals "$output" "in-progress" "Epic phase-level get routes through items"

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

echo -e "${YELLOW}Test: set phase-level value for feature${NC}"
setup_fixture
run_cli init feat-set --work-type feature --description "Set" >/dev/null 2>&1
run_cli add-item feat-set --phase discussion --topic feat-set >/dev/null 2>&1
run_cli set feat-set --phase discussion --topic feat-set status concluded >/dev/null 2>&1
output=$(run_cli_stdout get feat-set --phase discussion --topic feat-set status)

assert_equals "$output" "concluded" "Feature phase-level set works (flat routing)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set phase-level value for epic${NC}"
setup_fixture
run_cli init epic-set --work-type epic --description "Set" >/dev/null 2>&1
run_cli add-item epic-set --phase discussion --topic my-topic >/dev/null 2>&1
run_cli set epic-set --phase discussion --topic my-topic status concluded >/dev/null 2>&1
output=$(run_cli_stdout get epic-set --phase discussion --topic my-topic status)

assert_equals "$output" "concluded" "Epic phase-level set routes through items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set auto-creates intermediate keys${NC}"
setup_fixture
run_cli init intermediate --work-type feature --description "Intermediate" >/dev/null 2>&1
run_cli set intermediate --phase discussion --topic intermediate status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get intermediate --phase discussion --topic intermediate status)

assert_equals "$output" "in-progress" "Intermediate keys auto-created"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set --phase without --topic (topicless phase)${NC}"
setup_fixture
run_cli init topicless --work-type feature --description "Topicless" >/dev/null 2>&1
run_cli set topicless --phase research status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get topicless --phase research status)

assert_equals "$output" "in-progress" "Set phase without topic routes to phases.<phase>"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set --phase without --topic concludes research${NC}"
setup_fixture
run_cli init topicless2 --work-type epic --description "Topicless epic" >/dev/null 2>&1
run_cli set topicless2 --phase research status in-progress >/dev/null 2>&1
run_cli set topicless2 --phase research status concluded >/dev/null 2>&1
output=$(run_cli_stdout get topicless2 --phase research status)

assert_equals "$output" "concluded" "Topicless set works for epic too"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get --phase without --topic returns whole phase${NC}"
setup_fixture
run_cli init topicless3 --work-type feature --description "Topicless get" >/dev/null 2>&1
run_cli set topicless3 --phase research status concluded >/dev/null 2>&1
output=$(run_cli_stdout get topicless3 --phase research)

assert_contains "$output" '"status": "concluded"' "Get phase without topic returns phase object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase names${NC}"
setup_fixture
run_cli init phase-check --work-type feature --description "Phase" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase rejected" set phase-check --phase cooking --topic phase-check status in-progress

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase status${NC}"
setup_fixture
run_cli init status-check --work-type feature --description "Status" >/dev/null 2>&1
assert_exit_nonzero "Invalid status for discussion rejected" set status-check --phase discussion --topic status-check status completed
assert_exit_nonzero "Invalid status for implementation rejected" set status-check --phase implementation --topic status-check status concluded

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set validates correct phase statuses${NC}"
setup_fixture
run_cli init valid-status --work-type feature --description "Valid" >/dev/null 2>&1
run_cli set valid-status --phase discussion --topic valid-status status concluded >/dev/null 2>&1
run_cli set valid-status --phase implementation --topic valid-status status completed >/dev/null 2>&1

disc_status=$(run_cli_stdout get valid-status --phase discussion --topic valid-status status)
impl_status=$(run_cli_stdout get valid-status --phase implementation --topic valid-status status)

assert_equals "$disc_status" "concluded" "Discussion accepts concluded"
assert_equals "$impl_status" "completed" "Implementation accepts completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid gate modes${NC}"
setup_fixture
run_cli init gate-check --work-type feature --description "Gate" >/dev/null 2>&1
assert_exit_nonzero "Invalid gate mode rejected" set gate-check --phase planning --topic gate-check task_gate_mode manual

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set accepts valid gate modes${NC}"
setup_fixture
run_cli init gate-valid --work-type feature --description "Gate" >/dev/null 2>&1
run_cli set gate-valid --phase planning --topic gate-valid task_gate_mode auto >/dev/null 2>&1
output=$(run_cli_stdout get gate-valid --phase planning --topic gate-valid task_gate_mode)

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
run_cli set json-parse --phase specification --topic json-parse sources '[{"name":"auth","status":"pending"}]' >/dev/null 2>&1
output=$(run_cli_stdout get json-parse --phase specification --topic json-parse sources)

assert_contains "$output" '"name": "auth"' "JSON array parsed and stored"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set nested field path with dots${NC}"
setup_fixture
run_cli init dotpath --work-type feature --description "Dots" >/dev/null 2>&1
run_cli set dotpath --phase specification --topic dotpath sources.auth-api.status incorporated >/dev/null 2>&1
output=$(run_cli_stdout get dotpath --phase specification --topic dotpath sources.auth-api.status)

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
run_cli init archived-one --work-type feature --description "Archived" >/dev/null 2>&1
run_cli set archived-one status archived >/dev/null 2>&1
output=$(run_cli_stdout list --status active)

assert_contains "$output" '"name": "active-one"' "Active work unit listed"
assert_not_contains "$output" '"name": "archived-one"' "Archived work unit excluded"

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
{"name":"old-thing","work_type":"feature","status":"archived"}
EOF
mkdir -p "$TEST_DIR/.workflows/.cache"
mkdir -p "$TEST_DIR/.workflows/.state"
output=$(run_cli_stdout list)

assert_contains "$output" '"name": "visible"' "Visible work unit listed"
assert_not_contains "$output" '"name": "old-thing"' "Dot-prefixed directory skipped"

echo ""

# ============================================================================
# ADD-ITEM TESTS
# ============================================================================

echo -e "${YELLOW}Test: add-item for epic creates item with in-progress status${NC}"
setup_fixture
run_cli init my-epic --work-type epic --description "My Epic" >/dev/null 2>&1
run_cli add-item my-epic --phase discussion --topic payment-processing >/dev/null 2>&1
output=$(run_cli_stdout get my-epic --phase discussion --topic payment-processing status)

assert_equals "$output" "in-progress" "Epic item created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item for feature creates flat phase status${NC}"
setup_fixture
run_cli init my-feat --work-type feature --description "My Feature" >/dev/null 2>&1
run_cli add-item my-feat --phase discussion --topic my-feat >/dev/null 2>&1
output=$(run_cli_stdout get my-feat --phase discussion --topic my-feat status)

assert_equals "$output" "in-progress" "Feature phase created with in-progress status"

# Verify internal structure is flat (no items key)
content=$(cat "$TEST_DIR/.workflows/my-feat/manifest.json")
assert_not_contains "$content" '"items"' "Feature manifest has no items key"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item for bugfix creates flat phase status${NC}"
setup_fixture
run_cli init my-bug --work-type bugfix --description "My Bug" >/dev/null 2>&1
run_cli add-item my-bug --phase investigation --topic my-bug >/dev/null 2>&1
output=$(run_cli_stdout get my-bug --phase investigation --topic my-bug status)

assert_equals "$output" "in-progress" "Bugfix phase created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item rejects duplicate epic items${NC}"
setup_fixture
run_cli init dup-epic --work-type epic --description "Dup" >/dev/null 2>&1
run_cli add-item dup-epic --phase discussion --topic my-item >/dev/null 2>&1
output=$(run_cli add-item dup-epic --phase discussion --topic my-item || true)

assert_contains "$output" "already exists" "Duplicate epic item rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item rejects duplicate feature phase${NC}"
setup_fixture
run_cli init dup-feat --work-type feature --description "Dup" >/dev/null 2>&1
run_cli add-item dup-feat --phase discussion --topic dup-feat >/dev/null 2>&1
output=$(run_cli add-item dup-feat --phase discussion --topic dup-feat || true)

assert_contains "$output" "already exists" "Duplicate feature phase rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item rejects invalid phase${NC}"
setup_fixture
run_cli init bad-phase-epic --work-type epic --description "Bad" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase in add-item rejected" add-item bad-phase-epic --phase cooking --topic soup

echo ""

# ============================================================================
# ARCHIVE TESTS
# ============================================================================

echo -e "${YELLOW}Test: archive moves directory and updates status${NC}"
setup_fixture
run_cli init to-archive --work-type feature --description "Archive me" >/dev/null 2>&1
# Add some content to verify it moves
mkdir -p "$TEST_DIR/.workflows/to-archive/discussion"
echo "# Test" > "$TEST_DIR/.workflows/to-archive/discussion/to-archive.md"

run_cli archive to-archive >/dev/null 2>&1

assert_dir_not_exists "$TEST_DIR/.workflows/to-archive" "Original directory removed"
assert_dir_exists "$TEST_DIR/.workflows/.archive/to-archive" "Archive directory created"
assert_file_exists "$TEST_DIR/.workflows/.archive/to-archive/manifest.json" "Manifest in archive"
assert_file_exists "$TEST_DIR/.workflows/.archive/to-archive/discussion/to-archive.md" "Content preserved in archive"

# Check status updated
archived_content=$(cat "$TEST_DIR/.workflows/.archive/to-archive/manifest.json")
assert_contains "$archived_content" '"status": "archived"' "Status set to archived"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: archive errors on missing work unit${NC}"
setup_fixture
assert_exit_nonzero "Archive of missing work unit fails" archive nonexistent

echo ""

# ============================================================================
# DOMAIN ROUTING TESTS
# ============================================================================

echo -e "${YELLOW}Test: feature get/set routes to flat structure${NC}"
setup_fixture
run_cli init routing-feat --work-type feature --description "Routing" >/dev/null 2>&1
run_cli add-item routing-feat --phase discussion --topic routing-feat >/dev/null 2>&1
run_cli set routing-feat --phase discussion --topic routing-feat status concluded >/dev/null 2>&1

# Verify internal structure is flat
content=$(cat "$TEST_DIR/.workflows/routing-feat/manifest.json")
assert_contains "$content" '"discussion"' "Discussion phase exists"
assert_contains "$content" '"status": "concluded"' "Status set to concluded"
assert_not_contains "$content" '"items"' "No items in feature manifest"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic get/set routes through items${NC}"
setup_fixture
run_cli init routing-epic --work-type epic --description "Routing" >/dev/null 2>&1
run_cli add-item routing-epic --phase discussion --topic topic-a >/dev/null 2>&1
run_cli add-item routing-epic --phase discussion --topic topic-b >/dev/null 2>&1
run_cli set routing-epic --phase discussion --topic topic-a status concluded >/dev/null 2>&1

# Verify internal structure has items
content=$(cat "$TEST_DIR/.workflows/routing-epic/manifest.json")
assert_contains "$content" '"items"' "Epic manifest has items"
assert_contains "$content" '"topic-a"' "topic-a exists"
assert_contains "$content" '"topic-b"' "topic-b exists"

# Get specific item
topic_a=$(run_cli_stdout get routing-epic --phase discussion --topic topic-a status)
topic_b=$(run_cli_stdout get routing-epic --phase discussion --topic topic-b status)
assert_equals "$topic_a" "concluded" "topic-a status is concluded"
assert_equals "$topic_b" "in-progress" "topic-b status is in-progress"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase without topic returns whole phase object${NC}"
setup_fixture
run_cli init phase-obj --work-type epic --description "Phase obj" >/dev/null 2>&1
run_cli add-item phase-obj --phase discussion --topic topic-x >/dev/null 2>&1
output=$(run_cli_stdout get phase-obj --phase discussion)

assert_contains "$output" '"items"' "Phase object contains items"
assert_contains "$output" '"topic-x"' "Phase object contains topic-x"

echo ""

# ============================================================================
# EDGE CASES
# ============================================================================

echo -e "${YELLOW}Test: set on missing work unit errors${NC}"
setup_fixture
assert_exit_nonzero "Set on nonexistent work unit fails" set ghost status archived

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
run_cli add-item epic-validation --phase discussion --topic my-topic >/dev/null 2>&1
assert_exit_nonzero "Invalid item status rejected" set epic-validation --phase discussion --topic my-topic status completed

# Valid item status should work
run_cli set epic-validation --phase discussion --topic my-topic status concluded >/dev/null 2>&1
output=$(run_cli_stdout get epic-validation --phase discussion --topic my-topic status)
assert_equals "$output" "concluded" "Valid item status accepted"

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
