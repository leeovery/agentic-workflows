#!/bin/bash
#
# Tests for the workflow manifest CLI (manifest.js)
# Validates init, get, set, list, add-item, archive commands.
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

echo -e "${YELLOW}Test: get scalar value (raw output)${NC}"
setup_fixture
run_cli init scalar-test --work-type bugfix --description "Scalar" >/dev/null 2>&1
output=$(run_cli_stdout get scalar-test.status)

assert_equals "$output" "active" "Scalar value output raw"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get subtree as JSON${NC}"
setup_fixture
run_cli init subtree-test --work-type epic --description "Subtree" >/dev/null 2>&1
run_cli set subtree-test.phases.discussion.status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get subtree-test.phases.discussion)

assert_contains "$output" '"status": "in-progress"' "Subtree output as JSON"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get error on missing path${NC}"
setup_fixture
run_cli init missing-path --work-type feature --description "Missing" >/dev/null 2>&1
assert_exit_nonzero "Missing path returns error" get missing-path.nonexistent.deep.path

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get error on missing work unit${NC}"
setup_fixture
assert_exit_nonzero "Missing work unit returns error" get does-not-exist

echo ""

# ============================================================================
# SET TESTS
# ============================================================================

echo -e "${YELLOW}Test: set simple value${NC}"
setup_fixture
run_cli init set-test --work-type feature --description "Set test" >/dev/null 2>&1
run_cli set set-test.description "Updated description" >/dev/null 2>&1
output=$(run_cli_stdout get set-test.description)

assert_equals "$output" "Updated description" "Simple value set"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set auto-creates intermediate keys${NC}"
setup_fixture
run_cli init intermediate --work-type feature --description "Intermediate" >/dev/null 2>&1
run_cli set intermediate.phases.discussion.status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get intermediate.phases.discussion.status)

assert_equals "$output" "in-progress" "Intermediate keys auto-created"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase names${NC}"
setup_fixture
run_cli init phase-check --work-type feature --description "Phase" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase rejected" set phase-check.phases.cooking.status in-progress

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase status${NC}"
setup_fixture
run_cli init status-check --work-type feature --description "Status" >/dev/null 2>&1
assert_exit_nonzero "Invalid status for discussion rejected" set status-check.phases.discussion.status completed
assert_exit_nonzero "Invalid status for implementation rejected" set status-check.phases.implementation.status concluded

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set validates correct phase statuses${NC}"
setup_fixture
run_cli init valid-status --work-type feature --description "Valid" >/dev/null 2>&1
run_cli set valid-status.phases.discussion.status concluded >/dev/null 2>&1
run_cli set valid-status.phases.implementation.status completed >/dev/null 2>&1

disc_status=$(run_cli_stdout get valid-status.phases.discussion.status)
impl_status=$(run_cli_stdout get valid-status.phases.implementation.status)

assert_equals "$disc_status" "concluded" "Discussion accepts concluded"
assert_equals "$impl_status" "completed" "Implementation accepts completed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid gate modes${NC}"
setup_fixture
run_cli init gate-check --work-type feature --description "Gate" >/dev/null 2>&1
assert_exit_nonzero "Invalid gate mode rejected" set gate-check.phases.planning.task_gate_mode manual

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set accepts valid gate modes${NC}"
setup_fixture
run_cli init gate-valid --work-type feature --description "Gate" >/dev/null 2>&1
run_cli set gate-valid.phases.planning.task_gate_mode auto >/dev/null 2>&1
output=$(run_cli_stdout get gate-valid.phases.planning.task_gate_mode)

assert_equals "$output" "auto" "Gate mode set to auto"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work_type${NC}"
setup_fixture
run_cli init wt-check --work-type feature --description "WT" >/dev/null 2>&1
assert_exit_nonzero "Invalid work_type on set rejected" set wt-check.work_type project

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work unit status${NC}"
setup_fixture
run_cli init ws-check --work-type feature --description "WS" >/dev/null 2>&1
assert_exit_nonzero "Invalid work unit status rejected" set ws-check.status deleted

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set parses JSON values${NC}"
setup_fixture
run_cli init json-parse --work-type feature --description "JSON" >/dev/null 2>&1
run_cli set json-parse.phases.specification.sources '[{"name":"auth","status":"pending"}]' >/dev/null 2>&1
output=$(run_cli_stdout get json-parse.phases.specification.sources)

assert_contains "$output" '"name": "auth"' "JSON array parsed and stored"

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
run_cli set archived-one.status archived >/dev/null 2>&1
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

echo -e "${YELLOW}Test: add-item creates item with in-progress status${NC}"
setup_fixture
run_cli init my-epic --work-type epic --description "My Epic" >/dev/null 2>&1
run_cli add-item my-epic discussion payment-processing >/dev/null 2>&1
output=$(run_cli_stdout get my-epic.phases.discussion.items.payment-processing.status)

assert_equals "$output" "in-progress" "Item created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item rejects duplicate items${NC}"
setup_fixture
run_cli init dup-epic --work-type epic --description "Dup" >/dev/null 2>&1
run_cli add-item dup-epic discussion my-item >/dev/null 2>&1
output=$(run_cli add-item dup-epic discussion my-item || true)

assert_contains "$output" "already exists" "Duplicate item rejected"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: add-item rejects invalid phase${NC}"
setup_fixture
run_cli init bad-phase-epic --work-type epic --description "Bad" >/dev/null 2>&1
assert_exit_nonzero "Invalid phase in add-item rejected" add-item bad-phase-epic cooking soup

echo ""

# ============================================================================
# ARCHIVE TESTS
# ============================================================================

echo -e "${YELLOW}Test: archive moves directory and updates status${NC}"
setup_fixture
run_cli init to-archive --work-type feature --description "Archive me" >/dev/null 2>&1
# Add some content to verify it moves
mkdir -p "$TEST_DIR/.workflows/to-archive/discussion"
echo "# Test" > "$TEST_DIR/.workflows/to-archive/discussion/discussion.md"

run_cli archive to-archive >/dev/null 2>&1

assert_dir_not_exists "$TEST_DIR/.workflows/to-archive" "Original directory removed"
assert_dir_exists "$TEST_DIR/.workflows/.archive/to-archive" "Archive directory created"
assert_file_exists "$TEST_DIR/.workflows/.archive/to-archive/manifest.json" "Manifest in archive"
assert_file_exists "$TEST_DIR/.workflows/.archive/to-archive/discussion/discussion.md" "Content preserved in archive"

# Check status updated
archived_status=$(cd "$TEST_DIR" && node "$MANIFEST_JS" get to-archive 2>/dev/null | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).status))" 2>/dev/null || echo "read-failed")
# Since work unit was moved to archive, regular get won't find it — check the file directly
archived_content=$(cat "$TEST_DIR/.workflows/.archive/to-archive/manifest.json")
assert_contains "$archived_content" '"status": "archived"' "Status set to archived"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: archive errors on missing work unit${NC}"
setup_fixture
assert_exit_nonzero "Archive of missing work unit fails" archive nonexistent

echo ""

# ============================================================================
# EDGE CASES
# ============================================================================

echo -e "${YELLOW}Test: set on missing work unit errors${NC}"
setup_fixture
assert_exit_nonzero "Set on nonexistent work unit fails" set ghost.status archived

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

echo -e "${YELLOW}Test: item-level status validation in epic phases${NC}"
setup_fixture
run_cli init epic-validation --work-type epic --description "Validate items" >/dev/null 2>&1
run_cli add-item epic-validation discussion my-topic >/dev/null 2>&1
assert_exit_nonzero "Invalid item status rejected" set epic-validation.phases.discussion.items.my-topic.status completed

# Valid item status should work
run_cli set epic-validation.phases.discussion.items.my-topic.status concluded >/dev/null 2>&1
output=$(run_cli_stdout get epic-validation.phases.discussion.items.my-topic.status)
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
