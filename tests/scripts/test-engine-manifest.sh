#!/bin/bash
#
# Contract suite for the engine's manifest field surface (`engine manifest …`,
# skills/workflow-engine/scripts/domain/fields.cjs).
# Validates get, set, list, push, pull, delete, exists, key-of, resolve.
# Uses dot-path syntax: <work-unit>[.<phase>[.<topic>]]
#
# Output contract: reads print bare stdout; mutations answer with the
# engine's one-line JSON response ({"ok":true,…} on stdout; {"ok":false,…}
# on stderr, exit 1).
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_JS="$SCRIPT_DIR/../../skills/workflow-engine/scripts/engine.cjs"

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

# Fixture: create a work unit on disk — the same document `engine workunit
# create` writes (identity fields, in-progress, empty phases) plus the
# project-manifest registration. Work-unit creation is the engine's workunit
# verb, not a field op — the fixture writes directly so this suite exercises
# only the field surface.
create_wu() {
    local name="$1" type="$2" desc="${3:-}"
    cd "$TEST_DIR"
    node -e '
      const fs = require("fs"), path = require("path");
      const [name, type, desc] = process.argv.slice(1);
      const dir = path.join(".workflows", name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({
        name, work_type: type, status: "in-progress",
        created: new Date().toISOString().slice(0, 10),
        description: desc, phases: {},
      }, null, 2) + "\n");
      const projPath = path.join(".workflows", "manifest.json");
      const proj = fs.existsSync(projPath) ? JSON.parse(fs.readFileSync(projPath, "utf8")) : {};
      proj.work_units = proj.work_units || {};
      proj.work_units[name] = { work_type: type };
      fs.writeFileSync(projPath, JSON.stringify(proj, null, 2) + "\n");
    ' "$name" "$type" "$desc"
}

run_cli() {
    cd "$TEST_DIR"
    node "$ENGINE_JS" manifest "$@" 2>&1
}

run_cli_stdout() {
    cd "$TEST_DIR"
    node "$ENGINE_JS" manifest "$@" 2>/dev/null
}

run_cli_exit_code() {
    cd "$TEST_DIR"
    node "$ENGINE_JS" manifest "$@" >/dev/null 2>&1
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

assert_exit_nonzero() {
    local description="$1"
    shift

    TESTS_RUN=$((TESTS_RUN + 1))

    cd "$TEST_DIR"
    if node "$ENGINE_JS" manifest "$@" >/dev/null 2>&1; then
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

# Assert the EXACT exit code, not merely non-zero — the read contract splits an
# expected miss (exit 2) from a real error (exit 1), and mutations always fail
# exit 1. Pinning the code distinctly means a regression collapsing 2 into 1
# (or vice-versa) fails here instead of passing a lax non-zero check.
assert_exit_code() {
    local expected="$1"
    local description="$2"
    shift 2

    TESTS_RUN=$((TESTS_RUN + 1))

    cd "$TEST_DIR"
    # `|| actual=$?` keeps a non-zero exit from tripping `set -e` and captures it.
    local actual=0
    node "$ENGINE_JS" manifest "$@" >/dev/null 2>&1 || actual=$?
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        echo -e "    Expected exit: $expected"
        echo -e "    Actual exit:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# WORK-UNIT DOCUMENT + RETIRED VERBS
# ============================================================================

echo -e "${YELLOW}Test: work-unit document shape (asserted against the ENGINE-created manifest)${NC}"
setup_fixture
# Real contract: the engine writes the document; the assertions read what it
# wrote. A git repo is required — workunit create commits.
cd "$TEST_DIR"
git init -q -b main . >/dev/null 2>&1
git config user.email test@example.com && git config user.name Test && git config commit.gpgsign false
node "$ENGINE_JS" workunit create dark-mode feature --description "Add dark mode" --no-session-log >/dev/null

assert_file_exists "$TEST_DIR/.workflows/dark-mode/manifest.json" "manifest.json created by the engine"
content=$(cat "$TEST_DIR/.workflows/dark-mode/manifest.json")
assert_contains "$content" '"name": "dark-mode"' "name field set"
assert_contains "$content" '"work_type": "feature"' "work_type field set"
assert_contains "$content" '"status": "in-progress"' "status defaults to in-progress"
assert_contains "$content" '"description": "Add dark mode"' "description set"
assert_contains "$content" '"phases": {}' "phases initialized empty"
# Fixture↔engine equivalence, enforced: create_wu's document must match the
# engine's byte-for-byte (modulo nothing — both stamp today's date).
create_wu dark-mode-fixture feature "Add dark mode"
engine_doc=$(sed 's/dark-mode/UNIT/g' "$TEST_DIR/.workflows/dark-mode/manifest.json")
fixture_doc=$(sed 's/dark-mode-fixture/UNIT/g' "$TEST_DIR/.workflows/dark-mode-fixture/manifest.json")
assert_equals "$engine_doc" "$fixture_doc" "create_wu fixture matches the engine-created document byte-for-byte"
rm -rf "$TEST_DIR/.git"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: retired CLI commands are not ported${NC}"
setup_fixture
output=$(run_cli init dark-mode --work-type feature --description "x" || true)
assert_contains "$output" "Usage: engine manifest" "init refused — not ported"
output=$(run_cli init-phase dark-mode.discussion.dark-mode || true)
assert_contains "$output" "Usage: engine manifest" "init-phase refused — not ported"
output=$(run_cli project list || true)
assert_contains "$output" "Usage: engine manifest" "project refused — not ported"
output=$(run_cli create-discovery-topic dark-mode foo || true)
assert_contains "$output" "Usage: engine manifest" "create-discovery-topic refused — not ported"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: mutation failures are the engine JSON contract${NC}"
setup_fixture
exit_code=$(run_cli_exit_code set ghost status completed)
assert_equals "$exit_code" "1" "failed mutation exits 1"
output=$(run_cli set ghost status completed || true)
assert_contains "$output" '"ok":false' "failed mutation emits ok:false JSON on stderr"

echo ""

# ============================================================================
# GET TESTS
# ============================================================================

echo -e "${YELLOW}Test: get full manifest${NC}"
setup_fixture
create_wu test-get feature "Test get"
output=$(run_cli_stdout get test-get)

assert_contains "$output" '"name": "test-get"' "Full manifest contains name"
assert_contains "$output" '"work_type": "feature"' "Full manifest contains work_type"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get scalar value at work-unit level (raw output)${NC}"
setup_fixture
create_wu scalar-test bugfix "Scalar"
output=$(run_cli_stdout get scalar-test status)

assert_equals "$output" "in-progress" "Scalar value output raw"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get subtree at phase level (2-segment path)${NC}"
setup_fixture
create_wu subtree-test feature "Subtree"
run_cli set subtree-test.discussion.subtree-test status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get subtree-test.discussion)

assert_contains "$output" '"status": "in-progress"' "Subtree output as JSON"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get topic-level value for feature${NC}"
setup_fixture
create_wu feat-get feature "Get test"
run_cli set feat-get.discussion.feat-get status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get feat-get.discussion.feat-get status)

assert_equals "$output" "in-progress" "Feature topic-level get returns status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get topic-level value for epic${NC}"
setup_fixture
create_wu epic-get epic "Get test"
run_cli set epic-get.discussion.my-topic status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get epic-get.discussion.my-topic status)

assert_equals "$output" "in-progress" "Epic topic-level get routes through items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get returns empty on missing path${NC}"
setup_fixture
create_wu missing-path feature "Missing"
output=$(run_cli_stdout get missing-path nonexistent.deep.path)
assert_equals "$output" "" "Missing field returns empty stdout"
run_cli_stdout get missing-path nonexistent.deep.path >/dev/null
assert_equals "$?" "0" "Missing field exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get returns empty on missing work unit${NC}"
setup_fixture
output=$(run_cli_stdout get does-not-exist)
assert_equals "$output" "" "Missing work unit returns empty stdout"
run_cli_stdout get does-not-exist >/dev/null
assert_equals "$?" "0" "Missing work unit exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get wildcard returns empty when no items${NC}"
setup_fixture
create_wu empty-wc epic "Empty wildcard"
output=$(run_cli_stdout get 'empty-wc.discussion.*' status)
assert_equals "$output" "" "Wildcard with no items returns empty stdout"
run_cli_stdout get 'empty-wc.discussion.*' status >/dev/null
assert_equals "$?" "0" "Wildcard with no items exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get distinguishes present-null from missing via exists${NC}"
setup_fixture
create_wu null-test feature "Null test"
run_cli set null-test some_field 'null' >/dev/null 2>&1
present_output=$(run_cli_stdout get null-test some_field)
missing_output=$(run_cli_stdout get null-test no_such_field)
assert_equals "$present_output" "null" "Present null prints literal null"
assert_equals "$missing_output" "" "Missing field prints empty"
present_exists=$(run_cli_stdout exists null-test some_field)
missing_exists=$(run_cli_stdout exists null-test no_such_field)
assert_equals "$present_exists" "true" "exists differentiates present-null"
assert_equals "$missing_exists" "false" "exists differentiates missing"

echo ""

# ============================================================================
# SET TESTS
# ============================================================================

echo -e "${YELLOW}Test: set work-unit-level value${NC}"
setup_fixture
create_wu set-test feature "Set test"
run_cli set set-test description "Updated description" >/dev/null 2>&1
output=$(run_cli_stdout get set-test description)

assert_equals "$output" "Updated description" "Work-unit level value set"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set parses a bare tilde as null${NC}"
setup_fixture
create_wu tilde-test feature "Tilde test"
response=$(run_cli set tilde-test.planning.tilde-test task '~' 2>/dev/null)
stored=$(node -e "const m=require(process.argv[1]); console.log(JSON.stringify(m.phases.planning.items['tilde-test'].task))" "$TEST_DIR/.workflows/tilde-test/manifest.json")

assert_equals "$response" '{"ok":true,"path":"tilde-test.planning.tilde-test","set":{"task":null}}' "Response reports null for a bare tilde"
assert_equals "$stored" "null" "Manifest stores JSON null, not the literal string"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: batch pair parses a bare tilde as null${NC}"
setup_fixture
create_wu tilde-batch feature "Tilde batch"
run_cli set tilde-batch.planning.tilde-batch task='~' plan_format=local-markdown current='~' >/dev/null 2>&1
stored=$(node -e "const i=require(process.argv[1]).phases.planning.items['tilde-batch']; console.log(JSON.stringify([i.task, i.plan_format, i.current]))" "$TEST_DIR/.workflows/tilde-batch/manifest.json")

assert_equals "$stored" '[null,"local-markdown",null]' "Positional and batch tildes both land as null"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level value for feature${NC}"
setup_fixture
create_wu feat-set feature "Set"
run_cli set feat-set.discussion.feat-set status in-progress >/dev/null 2>&1
run_cli set feat-set.discussion.feat-set status completed >/dev/null 2>&1
output=$(run_cli_stdout get feat-set.discussion.feat-set status)

assert_equals "$output" "completed" "Feature topic-level set works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level value for epic${NC}"
setup_fixture
create_wu epic-set epic "Set"
run_cli set epic-set.discussion.my-topic status in-progress >/dev/null 2>&1
run_cli set epic-set.discussion.my-topic status completed >/dev/null 2>&1
output=$(run_cli_stdout get epic-set.discussion.my-topic status)

assert_equals "$output" "completed" "Epic topic-level set routes through items"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set auto-creates intermediate keys${NC}"
setup_fixture
create_wu intermediate feature "Intermediate"
run_cli set intermediate.discussion.intermediate status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get intermediate.discussion.intermediate status)

assert_equals "$output" "in-progress" "Intermediate keys auto-created"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level research with topic works${NC}"
setup_fixture
create_wu topicful feature "Topic research"
run_cli set topicful.research.exploration status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get topicful.research.exploration status)

assert_equals "$output" "in-progress" "Set research with topic routes correctly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set topic-level research for epic uses items${NC}"
setup_fixture
create_wu topicful2 epic "Topic research epic"
run_cli set topicful2.research.exploration status in-progress >/dev/null 2>&1
run_cli set topicful2.research.exploration status completed >/dev/null 2>&1
output=$(run_cli_stdout get topicful2.research.exploration status)

assert_equals "$output" "completed" "Epic research with topic uses items path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get phase-level (2-segment) returns whole phase object${NC}"
setup_fixture
create_wu topicful3 feature "Topic get"
run_cli set topicful3.research.exploration status completed >/dev/null 2>&1
output=$(run_cli_stdout get topicful3.research)

assert_contains "$output" '"status": "completed"' "Get phase-level returns phase object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set phase-level field (2-segment path)${NC}"
setup_fixture
create_wu phase-set feature "Phase set"
run_cli set phase-set.planning format local-markdown >/dev/null 2>&1
output=$(run_cli_stdout get phase-set.planning format)

assert_equals "$output" "local-markdown" "Phase-level set works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase names${NC}"
setup_fixture
create_wu phase-check feature "Phase"
assert_exit_code 1 "Invalid phase rejected" set phase-check.cooking.phase-check status in-progress

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid phase status${NC}"
setup_fixture
create_wu status-check feature "Status"
assert_exit_code 1 "Invalid status for discussion rejected" set status-check.discussion.status-check status concluded
assert_exit_code 1 "Invalid status for implementation rejected" set status-check.implementation.status-check status concluded

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set validates correct phase statuses${NC}"
setup_fixture
create_wu valid-status feature "Valid"
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
create_wu gate-check feature "Gate"
assert_exit_code 1 "Invalid gate mode rejected" set gate-check.planning.gate-check task_gate_mode manual

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set accepts valid gate modes${NC}"
setup_fixture
create_wu gate-valid feature "Gate"
run_cli set gate-valid.planning.gate-valid task_gate_mode auto >/dev/null 2>&1
output=$(run_cli_stdout get gate-valid.planning.gate-valid task_gate_mode)

assert_equals "$output" "auto" "Gate mode set to auto"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work_type${NC}"
setup_fixture
create_wu wt-check feature "WT"
assert_exit_code 1 "Invalid work_type on set rejected" set wt-check work_type project

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set rejects invalid work unit status${NC}"
setup_fixture
create_wu ws-check feature "WS"
assert_exit_code 1 "Invalid work unit status rejected" set ws-check status deleted

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set parses JSON values${NC}"
setup_fixture
create_wu json-parse feature "JSON"
run_cli set json-parse.specification.json-parse sources '[{"name":"auth","status":"pending"}]' >/dev/null 2>&1
output=$(run_cli_stdout get json-parse.specification.json-parse sources)

assert_contains "$output" '"name": "auth"' "JSON array parsed and stored"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set nested field path with dots${NC}"
setup_fixture
create_wu dotpath feature "Dots"
run_cli set dotpath.specification.dotpath sources.auth-api.status incorporated >/dev/null 2>&1
output=$(run_cli_stdout get dotpath.specification.dotpath sources.auth-api.status)

assert_equals "$output" "incorporated" "Nested dot-path field set and get works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: consult_references round-trips like sources${NC}"
setup_fixture
create_wu consult epic "Consult"
run_cli set consult.specification.release-engine consult_references.cli-presentation.status pending >/dev/null 2>&1
output=$(run_cli_stdout get consult.specification.release-engine consult_references.cli-presentation.status)
assert_equals "$output" "pending" "consult reference status set and get works"
run_cli set consult.specification.release-engine consult_references.cli-presentation.status addressed >/dev/null 2>&1
output=$(run_cli_stdout get consult.specification.release-engine consult_references.cli-presentation.status)
assert_equals "$output" "addressed" "consult reference status updates to addressed"

echo ""

# ============================================================================
# MUTATION JSON RESPONSES + SET BATCHING
# ============================================================================

echo -e "${YELLOW}Test: mutation responses are one-line JSON; set batches field=value pairs${NC}"
setup_fixture
create_wu json-resp feature "JSON contract"
output=$(run_cli_stdout set json-resp description="updated" note=hello)
assert_contains "$output" '"ok":true' "set responds with an ok:true JSON line"
landed=$(run_cli_stdout get json-resp note)
assert_equals "$landed" "hello" "batched field=value pair landed in the same write"

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
create_wu alpha feature "Alpha"
create_wu beta bugfix "Beta"
create_wu gamma epic "Gamma"
output=$(run_cli_stdout list)

assert_contains "$output" '"name": "alpha"' "Lists alpha"
assert_contains "$output" '"name": "beta"' "Lists beta"
assert_contains "$output" '"name": "gamma"' "Lists gamma"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list filters by status${NC}"
setup_fixture
create_wu active-one feature "Active"
create_wu completed-one feature "Completed"
run_cli set completed-one status completed >/dev/null 2>&1
output=$(run_cli_stdout list --status in-progress)

assert_contains "$output" '"name": "active-one"' "In-progress work unit listed"
assert_not_contains "$output" '"name": "completed-one"' "Completed work unit excluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list filters by work-type${NC}"
setup_fixture
create_wu feat feature "Feature"
create_wu bug bugfix "Bugfix"
output=$(run_cli_stdout list --work-type feature)

assert_contains "$output" '"name": "feat"' "Feature listed"
assert_not_contains "$output" '"name": "bug"' "Bugfix excluded"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: list skips dot-prefixed directories${NC}"
setup_fixture
create_wu visible feature "Visible"
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
# TOPIC ITEM CREATION (set auto-creates phase items)
# ============================================================================

echo -e "${YELLOW}Test: set creates epic item with in-progress status${NC}"
setup_fixture
create_wu my-epic epic "My Epic"
run_cli set my-epic.discussion.payment-processing status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get my-epic.discussion.payment-processing status)

assert_equals "$output" "in-progress" "Epic item created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set creates feature items structure${NC}"
setup_fixture
create_wu my-feat feature "My Feature"
run_cli set my-feat.discussion.my-feat status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get my-feat.discussion.my-feat status)

assert_equals "$output" "in-progress" "Feature phase created with in-progress status"

# Verify internal structure uses items (unified with epic)
content=$(cat "$TEST_DIR/.workflows/my-feat/manifest.json")
assert_contains "$content" '"items"' "Feature manifest has items key"
assert_contains "$content" '"my-feat"' "Feature items key matches work unit name"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set creates bugfix items structure${NC}"
setup_fixture
create_wu my-bug bugfix "My Bug"
run_cli set my-bug.investigation.my-bug status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get my-bug.investigation.my-bug status)

assert_equals "$output" "in-progress" "Bugfix phase created with in-progress status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: item creation rejects invalid phase${NC}"
setup_fixture
create_wu bad-phase-epic epic "Bad"
assert_exit_code 1 "Invalid phase in item creation rejected" set bad-phase-epic.cooking.soup status in-progress

echo ""

# ============================================================================
# PUSH TESTS
# ============================================================================

echo -e "${YELLOW}Test: push to non-existent field creates array${NC}"
setup_fixture
create_wu push-new feature "Push new"
run_cli set push-new.implementation.push-new status in-progress >/dev/null 2>&1
run_cli push push-new.implementation.push-new completed_tasks "task-1" >/dev/null 2>&1
output=$(run_cli_stdout get push-new.implementation.push-new completed_tasks)

assert_contains "$output" '"task-1"' "Push creates array with value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push to existing array appends${NC}"
setup_fixture
create_wu push-append feature "Push append"
run_cli set push-append.implementation.push-append status in-progress >/dev/null 2>&1
run_cli push push-append.implementation.push-append completed_tasks "task-1" >/dev/null 2>&1
run_cli push push-append.implementation.push-append completed_tasks "task-2" >/dev/null 2>&1
output=$(run_cli_stdout get push-append.implementation.push-append completed_tasks)

assert_contains "$output" '"task-1"' "First value present"
assert_contains "$output" '"task-2"' "Second value appended"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push to non-array field errors${NC}"
setup_fixture
create_wu push-bad feature "Push bad"
run_cli set push-bad.implementation.push-bad status in-progress >/dev/null 2>&1
output=$(run_cli push push-bad.implementation.push-bad status "value" || true)

assert_contains "$output" "not an array" "Push to non-array errors"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push topic-level for feature${NC}"
setup_fixture
create_wu push-feat feature "Push feat"
run_cli set push-feat.implementation.push-feat status in-progress >/dev/null 2>&1
run_cli push push-feat.implementation.push-feat completed_phases 1 >/dev/null 2>&1
output=$(run_cli_stdout get push-feat.implementation.push-feat completed_phases)

assert_contains "$output" "1" "Push numeric value to feature"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push topic-level for epic${NC}"
setup_fixture
create_wu push-epic epic "Push epic"
run_cli set push-epic.implementation.my-topic status in-progress >/dev/null 2>&1
run_cli push push-epic.implementation.my-topic completed_tasks "task-a" >/dev/null 2>&1
output=$(run_cli_stdout get push-epic.implementation.my-topic completed_tasks)

assert_contains "$output" '"task-a"' "Push routes through items for epic"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push at work-unit level${NC}"
setup_fixture
create_wu push-wu feature "Push WU"
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
create_wu routing-feat feature "Routing"
run_cli set routing-feat.discussion.routing-feat status in-progress >/dev/null 2>&1
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
create_wu routing-epic epic "Routing"
run_cli set routing-epic.discussion.topic-a status in-progress >/dev/null 2>&1
run_cli set routing-epic.discussion.topic-b status in-progress >/dev/null 2>&1
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
create_wu phase-obj epic "Phase obj"
run_cli set phase-obj.discussion.topic-x status in-progress >/dev/null 2>&1
output=$(run_cli_stdout get phase-obj.discussion)

assert_contains "$output" '"items"' "Phase object contains items"
assert_contains "$output" '"topic-x"' "Phase object contains topic-x"

echo ""

# ============================================================================
# EDGE CASES
# ============================================================================

echo -e "${YELLOW}Test: set on missing work unit errors${NC}"
setup_fixture
assert_exit_code 1 "Set on nonexistent work unit fails" set ghost status cancelled

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
assert_exit_code 1 "Unknown command rejected" destroy everything

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: epic item-level status validation${NC}"
setup_fixture
create_wu epic-validation epic "Validate items"
run_cli set epic-validation.discussion.my-topic status in-progress >/dev/null 2>&1
assert_exit_code 1 "Invalid item status rejected" set epic-validation.discussion.my-topic status concluded

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
create_wu exists-test feature "Exists"
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
create_wu exists-field feature "Field"
output=$(run_cli_stdout exists exists-field work_type)
exit_code=$(run_cli_exit_code exists exists-field work_type)

assert_equals "$output" "true" "Existing field returns true"
assert_equals "$exit_code" "0" "Existing field exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with field that does not exist${NC}"
setup_fixture
create_wu exists-nofield feature "No field"
output=$(run_cli_stdout exists exists-nofield nonexistent.deep.path)
exit_code=$(run_cli_exit_code exists exists-nofield nonexistent.deep.path)

assert_equals "$output" "false" "Non-existent field returns false"
assert_equals "$exit_code" "0" "Non-existent field exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with topic-level path that exists${NC}"
setup_fixture
create_wu exists-phase epic "Phase"
run_cli set exists-phase.discussion.my-topic status in-progress >/dev/null 2>&1
output=$(run_cli_stdout exists exists-phase.discussion.my-topic)
exit_code=$(run_cli_exit_code exists exists-phase.discussion.my-topic)

assert_equals "$output" "true" "Existing phase/topic returns true"
assert_equals "$exit_code" "0" "Existing phase/topic exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with topic-level path that does not exist${NC}"
setup_fixture
create_wu exists-nophase epic "No phase"
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
assert_exit_code 1 "exists with no args fails" exists

echo ""

# ============================================================================
# WILDCARD TOPIC
# ============================================================================

echo -e "${YELLOW}Test: get with wildcard topic on epic returns all items${NC}"
setup_fixture
create_wu wc-epic epic "Wildcard"
run_cli set wc-epic.implementation.auth-flow status in-progress >/dev/null 2>&1
run_cli set wc-epic.implementation.billing status in-progress >/dev/null 2>&1
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
create_wu wc-feat feature "Wildcard"
run_cli set wc-feat.implementation.wc-feat status in-progress >/dev/null 2>&1
run_cli set wc-feat.implementation.wc-feat status completed >/dev/null 2>&1
output=$(run_cli_stdout get wc-feat.implementation.* status)
assert_contains "$output" '"topic": "wc-feat"' "Wildcard get on feature includes topic"
assert_contains "$output" '"value": "completed"' "Wildcard get on feature shows value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get with wildcard topic on empty phase returns empty${NC}"
setup_fixture
create_wu wc-empty epic "Empty"
# The field surface refuses phases.-prefixed writes (shadow guard), so the
# empty-phase fixture is written directly.
node -e "
const fs = require('fs');
const p = process.argv[1];
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
m.phases = m.phases || {};
m.phases.implementation = {};
fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
" "$TEST_DIR/.workflows/wc-empty/manifest.json"
output=$(run_cli_stdout get wc-empty.implementation.* status)
assert_equals "$output" "" "Wildcard on empty phase returns empty stdout"
run_cli_stdout get wc-empty.implementation.* status >/dev/null
assert_equals "$?" "0" "Wildcard on empty phase exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with wildcard topic returns true when items exist${NC}"
setup_fixture
create_wu wc-exists epic "Exists"
run_cli set wc-exists.implementation.topic-a status in-progress >/dev/null 2>&1
output=$(run_cli_stdout exists wc-exists.implementation.* status)
exit_code=$?
assert_equals "$output" "true" "Wildcard exists returns true when items have field"
assert_equals "$exit_code" "0" "Wildcard exists exits 0"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists with wildcard topic returns false when no items${NC}"
setup_fixture
create_wu wc-noitems epic "No items"
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
create_wu del-wu feature "Delete WU"
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
create_wu del-feat feature "Delete feat"
run_cli set del-feat.planning.del-feat status in-progress >/dev/null 2>&1
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
create_wu del-epic epic "Delete epic"
run_cli set del-epic.implementation.auth status in-progress >/dev/null 2>&1
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
create_wu del-nested feature "Nested"
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
create_wu del-tree feature "Tree"
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
create_wu del-missing feature "Missing"
assert_exit_code 1 "Delete missing path errors" delete del-missing nonexistent.deep.path

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete errors on missing work unit${NC}"
setup_fixture
assert_exit_code 1 "Delete missing work unit errors" delete ghost-unit some.field

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete phase-level field (2-segment path)${NC}"
setup_fixture
create_wu del-phase feature "Phase del"
run_cli set del-phase.research analysis_cache '{"checksum":"abc"}' >/dev/null 2>&1
run_cli delete del-phase.research analysis_cache >/dev/null 2>&1
output=$(run_cli_stdout exists del-phase.research analysis_cache)

assert_equals "$output" "false" "Phase-level delete works"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete rejects invalid phase${NC}"
setup_fixture
create_wu del-badphase feature "Bad phase"
assert_exit_code 1 "Delete invalid phase errors" delete del-badphase.cooking.del-badphase status

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push phase-level (2-segment path)${NC}"
setup_fixture
create_wu push-phase feature "Phase push"
run_cli push push-phase.research analysis_cache.files "a.md" >/dev/null 2>&1
output=$(run_cli_stdout get push-phase.research analysis_cache.files)

assert_contains "$output" '"a.md"' "Phase-level push works"

echo ""

# ============================================================================
# KEY-OF COMMAND
# ============================================================================

echo -e "${YELLOW}Test: key-of finds key by value${NC}"
setup_fixture
create_wu key-of-test feature "Key-of test"
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
create_wu key-of-miss feature "Key-of miss"
run_cli set key-of-miss.planning.key-of-miss task_map.t-1 ext-1 >/dev/null 2>&1

exit_code=$(run_cli_exit_code key-of key-of-miss.planning.key-of-miss task_map ext-notfound)
assert_equals "$exit_code" "2" "key-of value-not-found exits 2 (expected miss)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: key-of errors on non-object path${NC}"
setup_fixture
create_wu key-of-scalar feature "Key-of scalar"
run_cli set key-of-scalar.planning.key-of-scalar format tick >/dev/null 2>&1

exit_code=$(run_cli_exit_code key-of key-of-scalar.planning.key-of-scalar format tick)
assert_equals "$exit_code" "1" "key-of errors when path is not an object"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: key-of works at work-unit level${NC}"
setup_fixture
create_wu key-of-wu feature "Key-of work unit"
run_cli set key-of-wu custom_map '{"a":"x","b":"y"}' >/dev/null 2>&1

output=$(run_cli_stdout key-of key-of-wu custom_map y)
assert_equals "$output" "b" "key-of works at work-unit level"

echo ""

# ============================================================================
# PROJECT DOT-PATH TESTS
# ============================================================================

echo -e "${YELLOW}Test: bare 'project' path refuses a set (reserved prefix routes to the project manifest)${NC}"
setup_fixture
output=$(run_cli set project 2>&1 || true)
assert_contains "$output" "Usage" "set project without a field path shows usage"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: set and get project.defaults.plan_format${NC}"
setup_fixture
create_wu my-proj feature "Setup"
run_cli set project.defaults.plan_format local-markdown >/dev/null 2>&1

output=$(run_cli_stdout get project.defaults.plan_format)
assert_equals "$output" "local-markdown" "Get project default plan_format"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists project.defaults.plan_format${NC}"
setup_fixture
create_wu ex-proj feature "Setup"
run_cli set project.defaults.plan_format tick >/dev/null 2>&1

output=$(run_cli_stdout exists project.defaults.plan_format)
assert_equals "$output" "true" "Exists returns true for set default"

output=$(run_cli_stdout exists project.defaults.nonexistent)
assert_equals "$output" "false" "Exists returns false for missing default"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete project.defaults.plan_format${NC}"
setup_fixture
create_wu del-proj feature "Setup"
run_cli set project.defaults.plan_format linear >/dev/null 2>&1
run_cli delete project.defaults.plan_format >/dev/null 2>&1

output=$(run_cli_stdout exists project.defaults.plan_format)
assert_equals "$output" "false" "Deleted project default no longer exists"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push project.defaults.project_skills${NC}"
setup_fixture
create_wu push-proj feature "Setup"
run_cli push project.defaults.project_skills ".claude/skills/golang-pro" >/dev/null 2>&1
run_cli push project.defaults.project_skills ".claude/skills/react-patterns" >/dev/null 2>&1

output=$(run_cli_stdout get project.defaults.project_skills)
assert_contains "$output" "golang-pro" "Push first skill present"
assert_contains "$output" "react-patterns" "Push second skill appended"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project returns full project manifest${NC}"
setup_fixture
create_wu full-proj epic "Full test"

output=$(run_cli_stdout get project)
assert_contains "$output" "work_units" "Full project manifest has work_units"
assert_contains "$output" "full-proj" "Full project manifest has work unit name"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project.work_units returns work_units object${NC}"
setup_fixture
create_wu wu-proj feature "WU test"

output=$(run_cli_stdout get project.work_units)
assert_contains "$output" "wu-proj" "Work units object has expected entry"
assert_contains "$output" "feature" "Work units entry has work_type"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: exists project returns true when manifest exists${NC}"
setup_fixture
create_wu exists-proj feature "Exists test"

output=$(run_cli_stdout exists project)
assert_equals "$output" "true" "Exists project returns true with content"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get project.defaults returns empty when not set${NC}"
setup_fixture
create_wu err-proj feature "Error test"

output=$(run_cli_stdout get project.defaults.plan_format)
assert_equals "$output" "" "Missing project default returns empty stdout"
run_cli_stdout get project.defaults.plan_format >/dev/null
assert_equals "$?" "0" "Missing project default exits 0"

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
# PULL COMMAND TESTS
# ============================================================================

echo -e "${YELLOW}Test: pull removes value from array${NC}"
setup_fixture
create_wu pull-basic feature "Pull basic"
run_cli set pull-basic.implementation.pull-basic status in-progress >/dev/null 2>&1
run_cli push pull-basic.implementation.pull-basic completed_tasks "task-1" >/dev/null 2>&1
run_cli push pull-basic.implementation.pull-basic completed_tasks "task-2" >/dev/null 2>&1
run_cli pull pull-basic.implementation.pull-basic completed_tasks "task-1" >/dev/null 2>&1
output=$(run_cli_stdout get pull-basic.implementation.pull-basic completed_tasks)

assert_not_contains "$output" "task-1" "Pull removed the value"
assert_contains "$output" "task-2" "Pull kept other values"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull is no-op when value not in array${NC}"
setup_fixture
create_wu pull-miss feature "Pull miss"
run_cli set pull-miss.implementation.pull-miss status in-progress >/dev/null 2>&1
run_cli push pull-miss.implementation.pull-miss completed_tasks "task-1" >/dev/null 2>&1
run_cli pull pull-miss.implementation.pull-miss completed_tasks "task-99" >/dev/null 2>&1
output=$(run_cli_stdout get pull-miss.implementation.pull-miss completed_tasks)

assert_contains "$output" "task-1" "Pull no-op preserves existing value"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull is no-op when field is not an array${NC}"
setup_fixture
create_wu pull-noarr feature "Pull noarr"
run_cli set pull-noarr.implementation.pull-noarr status in-progress >/dev/null 2>&1
exit_code=$(run_cli_exit_code pull pull-noarr.implementation.pull-noarr status "in-progress")

assert_equals "$exit_code" "0" "Pull on non-array exits cleanly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull is no-op when field does not exist${NC}"
setup_fixture
create_wu pull-nofld feature "Pull nofld"
run_cli set pull-nofld.implementation.pull-nofld status in-progress >/dev/null 2>&1
exit_code=$(run_cli_exit_code pull pull-nofld.implementation.pull-nofld nonexistent "value")

assert_equals "$exit_code" "0" "Pull on missing field exits cleanly"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull at phase level${NC}"
setup_fixture
create_wu pull-phase epic "Pull phase"
run_cli set pull-phase.research surfaced_topics '["topic-a","topic-b","topic-c"]' >/dev/null 2>&1
run_cli pull pull-phase.research surfaced_topics "topic-b" >/dev/null 2>&1
output=$(run_cli_stdout get pull-phase.research surfaced_topics)

assert_contains "$output" "topic-a" "Phase-level pull kept topic-a"
assert_not_contains "$output" "topic-b" "Phase-level pull removed topic-b"
assert_contains "$output" "topic-c" "Phase-level pull kept topic-c"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull at work-unit level${NC}"
setup_fixture
create_wu pull-wu feature "Pull WU"
run_cli push pull-wu tags "v1" >/dev/null 2>&1
run_cli push pull-wu tags "v2" >/dev/null 2>&1
run_cli pull pull-wu tags "v1" >/dev/null 2>&1
output=$(run_cli_stdout get pull-wu tags)

assert_not_contains "$output" "v1" "Work-unit-level pull removed v1"
assert_contains "$output" "v2" "Work-unit-level pull kept v2"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull from project manifest${NC}"
setup_fixture
create_wu pull-proj feature "Pull proj"
run_cli push project.defaults.project_skills "skill-a" >/dev/null 2>&1
run_cli push project.defaults.project_skills "skill-b" >/dev/null 2>&1
run_cli pull project.defaults.project_skills "skill-a" >/dev/null 2>&1
output=$(run_cli_stdout get project.defaults.project_skills)

assert_not_contains "$output" "skill-a" "Project-level pull removed skill-a"
assert_contains "$output" "skill-b" "Project-level pull kept skill-b"

# ============================================================================
# CANCELLED STATUS TESTS
# ============================================================================

echo -e "${YELLOW}Test: cancelled accepted as valid status for discussion${NC}"
setup_fixture
create_wu cancel-disc epic "Cancel disc"
run_cli set cancel-disc.discussion.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-disc.discussion.my-topic status cancelled >/dev/null 2>&1
output=$(run_cli_stdout get cancel-disc.discussion.my-topic status)

assert_equals "$output" "cancelled" "Discussion accepts cancelled status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: superseded accepted as valid status for research${NC}"
setup_fixture
create_wu supersede-research epic "Supersede research"
run_cli set supersede-research.research.broad-topic status in-progress >/dev/null 2>&1
run_cli set supersede-research.research.broad-topic status superseded >/dev/null 2>&1
output=$(run_cli_stdout get supersede-research.research.broad-topic status)

assert_equals "$output" "superseded" "Research accepts superseded status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: cancelled accepted as valid status for specification${NC}"
setup_fixture
create_wu cancel-spec epic "Cancel spec"
run_cli set cancel-spec.specification.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-spec.specification.my-topic status cancelled >/dev/null 2>&1
output=$(run_cli_stdout get cancel-spec.specification.my-topic status)

assert_equals "$output" "cancelled" "Specification accepts cancelled status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: cancelled accepted as valid status for planning${NC}"
setup_fixture
create_wu cancel-plan epic "Cancel plan"
run_cli set cancel-plan.planning.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-plan.planning.my-topic status cancelled >/dev/null 2>&1
output=$(run_cli_stdout get cancel-plan.planning.my-topic status)

assert_equals "$output" "cancelled" "Planning accepts cancelled status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: cancelled accepted as valid status for implementation${NC}"
setup_fixture
create_wu cancel-impl epic "Cancel impl"
run_cli set cancel-impl.implementation.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-impl.implementation.my-topic status cancelled >/dev/null 2>&1
output=$(run_cli_stdout get cancel-impl.implementation.my-topic status)

assert_equals "$output" "cancelled" "Implementation accepts cancelled status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: previous_status field set alongside cancelled${NC}"
setup_fixture
create_wu cancel-prev epic "Cancel prev"
run_cli set cancel-prev.discussion.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-prev.discussion.my-topic previous_status in-progress >/dev/null 2>&1
run_cli set cancel-prev.discussion.my-topic status cancelled >/dev/null 2>&1
prev=$(run_cli_stdout get cancel-prev.discussion.my-topic previous_status)
status=$(run_cli_stdout get cancel-prev.discussion.my-topic status)

assert_equals "$prev" "in-progress" "previous_status preserved alongside cancelled"
assert_equals "$status" "cancelled" "Status is cancelled"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: previous_status deleted on reactivation${NC}"
setup_fixture
create_wu cancel-react epic "Cancel react"
run_cli set cancel-react.discussion.my-topic status in-progress >/dev/null 2>&1
run_cli set cancel-react.discussion.my-topic previous_status in-progress >/dev/null 2>&1
run_cli set cancel-react.discussion.my-topic status cancelled >/dev/null 2>&1

# Reactivate: restore previous status and delete previous_status field
run_cli set cancel-react.discussion.my-topic status in-progress >/dev/null 2>&1
run_cli delete cancel-react.discussion.my-topic previous_status >/dev/null 2>&1
status=$(run_cli_stdout get cancel-react.discussion.my-topic status)
prev_exists=$(run_cli_stdout exists cancel-react.discussion.my-topic previous_status)

assert_equals "$status" "in-progress" "Status restored to in-progress"
assert_equals "$prev_exists" "false" "previous_status deleted after reactivation"

echo ""

# ============================================================================
# PROPOSED STATUS TESTS (spec groupings)
# ============================================================================

echo -e "${YELLOW}Test: proposed accepted as valid status for specification${NC}"
setup_fixture
create_wu prop-spec epic "Proposed spec"
run_cli set prop-spec.specification.auth-flow status proposed >/dev/null 2>&1
output=$(run_cli_stdout get prop-spec.specification.auth-flow status)

assert_equals "$output" "proposed" "Specification accepts proposed status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: bogus specification status rejected${NC}"
setup_fixture
create_wu bogus-spec epic "Bogus"
assert_exit_code 1 "Invalid specification status rejected" \
    set bogus-spec.specification.auth-flow status bogus

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: re-upserting proposed status is idempotent${NC}"
setup_fixture
create_wu flip-spec epic "Flip"
run_cli set flip-spec.specification.auth-flow status proposed >/dev/null 2>&1
run_cli set flip-spec.specification.auth-flow status proposed >/dev/null 2>&1
output=$(run_cli_stdout get flip-spec.specification.auth-flow status)
assert_equals "$output" "proposed" "Second proposed write leaves the item proposed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: upsert proposed item builds the exact shape${NC}"
setup_fixture
create_wu upsert-spec epic "Upsert"
run_cli set upsert-spec.specification.auth-flow status proposed >/dev/null 2>&1
run_cli set upsert-spec.specification.auth-flow sources.auth-design.status pending >/dev/null 2>&1
run_cli set upsert-spec.specification.auth-flow sources.session-mgmt.status pending >/dev/null 2>&1
status=$(run_cli_stdout get upsert-spec.specification.auth-flow status)
src1=$(run_cli_stdout get upsert-spec.specification.auth-flow sources.auth-design.status)
src2=$(run_cli_stdout get upsert-spec.specification.auth-flow sources.session-mgmt.status)
rc_exists=$(run_cli_stdout exists upsert-spec.specification.auth-flow review_cycle)

assert_equals "$status" "proposed" "Proposed item status set"
assert_equals "$src1" "pending" "First source pending"
assert_equals "$src2" "pending" "Second source pending"
assert_equals "$rc_exists" "false" "Proposed item carries no review_cycle (invariant)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete whole proposed spec item${NC}"
setup_fixture
create_wu del-spec epic "Delete"
run_cli set del-spec.specification.auth-flow status proposed >/dev/null 2>&1
run_cli set del-spec.specification.auth-flow sources.auth-design.status pending >/dev/null 2>&1
run_cli delete del-spec.specification items.auth-flow >/dev/null 2>&1
exists_after=$(run_cli_stdout exists del-spec.specification.auth-flow)

assert_equals "$exists_after" "false" "Whole proposed item removed by delete items.{topic}"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: flip proposed to in-progress preserves sources${NC}"
setup_fixture
create_wu flip2-spec epic "Flip2"
run_cli set flip2-spec.specification.auth-flow status proposed >/dev/null 2>&1
run_cli set flip2-spec.specification.auth-flow sources.auth-design.status pending >/dev/null 2>&1
run_cli set flip2-spec.specification.auth-flow status in-progress >/dev/null 2>&1
status=$(run_cli_stdout get flip2-spec.specification.auth-flow status)
src=$(run_cli_stdout get flip2-spec.specification.auth-flow sources.auth-design.status)

assert_equals "$status" "in-progress" "Flip sets in-progress"
assert_equals "$src" "pending" "Flip preserves source rows"

echo ""

# ============================================================================
# DISCOVERY PHASE TESTS
# ============================================================================

echo -e "${YELLOW}Test: discovery status writes are refused with the map-item explanation${NC}"
setup_fixture
create_wu incept-init epic "Discovery init"
exit_code=$(run_cli_exit_code set incept-init.discovery.foo status in-progress)
output=$(run_cli set incept-init.discovery.foo status in-progress 2>&1 || true)

assert_equals "$exit_code" "1" "Discovery status write exits non-zero"
assert_contains "$output" "carry no status field" "Error explains map items carry no status"
assert_contains "$output" "computed at render time" "Error explains lifecycle is computed at render time"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discovery refuses every status write (empty vocabulary)${NC}"
setup_fixture
create_wu incept-status epic "Discovery status"
run_cli set incept-status.discovery.foo routing research >/dev/null 2>&1

for status in in-progress completed cancelled; do
    exit_code=$(run_cli_exit_code set incept-status.discovery.foo status "$status")
    assert_equals "$exit_code" "1" "Set status $status exits non-zero"
done
output=$(run_cli set incept-status.discovery.foo status in-progress 2>&1 || true)
assert_contains "$output" "carry no status field" "Error explains map items carry no status"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discovery accepts free-form routing field${NC}"
setup_fixture
create_wu incept-route epic "Discovery routing"
run_cli set incept-route.discovery.foo routing research >/dev/null 2>&1
output=$(run_cli_stdout get incept-route.discovery.foo routing)

assert_equals "$output" "research" "Routing field stored unchanged"

# Discussion routing also accepted (no validation enforced)
run_cli set incept-route.discovery.foo routing discussion >/dev/null 2>&1
output=$(run_cli_stdout get incept-route.discovery.foo routing)
assert_equals "$output" "discussion" "Routing can be updated to discussion"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discovery accepts summary field${NC}"
setup_fixture
create_wu incept-sum epic "Discovery summary"
run_cli set incept-sum.discovery.foo summary "A short summary of the topic" >/dev/null 2>&1
output=$(run_cli_stdout get incept-sum.discovery.foo summary)

assert_equals "$output" "A short summary of the topic" "Summary stored unchanged"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get returns full discovery item${NC}"
setup_fixture
create_wu incept-get epic "Discovery get"
run_cli set incept-get.discovery.foo summary "A topic" >/dev/null 2>&1
run_cli set incept-get.discovery.foo routing research >/dev/null 2>&1
output=$(run_cli_stdout get incept-get.discovery.foo)

assert_not_contains "$output" '"status"' "Item JSON carries no status field"
assert_contains "$output" '"summary": "A topic"' "Item JSON includes summary"
assert_contains "$output" '"routing": "research"' "Item JSON includes routing"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: delete hard-removes discovery item${NC}"
setup_fixture
create_wu incept-del epic "Discovery delete"
run_cli set incept-del.discovery.foo summary "to be deleted" >/dev/null 2>&1
# Hard-delete the entire item via the items.<topic> field path (existing convention)
run_cli delete incept-del.discovery items.foo >/dev/null 2>&1
exists_after=$(run_cli_stdout exists incept-del.discovery.foo)

assert_equals "$exists_after" "false" "Discovery item gone after hard-delete"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: wildcard get on discovery phase${NC}"
setup_fixture
create_wu incept-wild epic "Discovery wildcard"
run_cli set incept-wild.discovery.alpha routing research >/dev/null 2>&1
run_cli set incept-wild.discovery.beta routing discussion >/dev/null 2>&1
output=$(run_cli_stdout get 'incept-wild.discovery.*' routing)

assert_contains "$output" '"topic": "alpha"' "Wildcard returns alpha topic"
assert_contains "$output" '"topic": "beta"' "Wildcard returns beta topic"
assert_contains "$output" '"value": "research"' "Wildcard returns alpha routing"

echo ""

# ============================================================================
# IMPORTS[] FIELD TESTS
# ============================================================================

echo -e "${YELLOW}Test: push creates imports[] array on first call${NC}"
setup_fixture
create_wu imp-create epic "Imports create"
run_cli push imp-create imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
output=$(run_cli_stdout get imp-create imports)

assert_contains "$output" '"path": "imports/seed.md"' "First push creates array with entry"
assert_contains "$output" '"imported_at": "2026-05-09T10:00:00Z"' "Entry preserves imported_at"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push appends subsequent entries to imports[]${NC}"
setup_fixture
create_wu imp-append epic "Imports append"
run_cli push imp-append imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
run_cli push imp-append imports '{"path":"imports/notes.md","imported_at":"2026-05-09T11:00:00Z"}' >/dev/null 2>&1
output=$(run_cli_stdout get imp-append imports)

assert_contains "$output" "imports/seed.md" "First entry preserved after append"
assert_contains "$output" "imports/notes.md" "Second entry appended"

# Verify it's a proper array of length 2
length=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/imp-append/manifest.json','utf8')); console.log(m.imports.length)")
assert_equals "$length" "2" "imports[] has two entries after two pushes"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull removes a single imports[] entry by deep equality${NC}"
setup_fixture
create_wu imp-pull epic "Imports pull"
run_cli push imp-pull imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
run_cli push imp-pull imports '{"path":"imports/notes.md","imported_at":"2026-05-09T11:00:00Z"}' >/dev/null 2>&1
run_cli pull imp-pull imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
output=$(run_cli_stdout get imp-pull imports)

assert_not_contains "$output" "imports/seed.md" "Pull removed seed.md entry"
assert_contains "$output" "imports/notes.md" "Pull kept notes.md entry"

length=$(node -e "const m=JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/imp-pull/manifest.json','utf8')); console.log(m.imports.length)")
assert_equals "$length" "1" "imports[] has one entry after pull"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: pull is no-op when entry shape does not match${NC}"
setup_fixture
create_wu imp-pull-miss epic "Imports pull miss"
run_cli push imp-pull-miss imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
run_cli pull imp-pull-miss imports '{"path":"imports/seed.md","imported_at":"2026-05-09T99:99:99Z"}' >/dev/null 2>&1
output=$(run_cli_stdout get imp-pull-miss imports)

assert_contains "$output" "imports/seed.md" "Non-matching pull preserved entry"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: push onto non-array imports field fails${NC}"
setup_fixture
create_wu imp-bad epic "Imports bad"
# Set imports to a non-array value first
run_cli set imp-bad imports '"not-an-array"' >/dev/null 2>&1
combined=$(cd "$TEST_DIR" && node "$ENGINE_JS" manifest push imp-bad imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' 2>&1; echo "__EXIT__=$?")
exit_code=$(echo "$combined" | grep -o '__EXIT__=[0-9]*' | tail -1 | cut -d= -f2)
output=$(echo "$combined" | grep -v '__EXIT__=')

assert_equals "$exit_code" "1" "Push onto non-array exits non-zero"
assert_contains "$output" "not an array" "Error mentions not an array"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: imports[] round-trip preserves entry shape${NC}"
setup_fixture
create_wu imp-roundtrip epic "Imports round-trip"
run_cli push imp-roundtrip imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}' >/dev/null 2>&1
output=$(run_cli_stdout get imp-roundtrip imports)

# Parse the JSON and confirm shape
parsed=$(echo "$output" | node -e "
let s='';
process.stdin.on('data',c=>s+=c);
process.stdin.on('end',()=>{
  const arr = JSON.parse(s);
  if (!Array.isArray(arr)) { console.log('not-array'); return; }
  if (arr.length !== 1) { console.log('wrong-length'); return; }
  const e = arr[0];
  if (e.path === 'imports/seed.md' && e.imported_at === '2026-05-09T10:00:00Z') {
    console.log('shape-ok');
  } else {
    console.log('shape-wrong');
  }
});
")
assert_equals "$parsed" "shape-ok" "Round-tripped entry has expected fields"

echo ""

# ============================================================================
# RESOLVE COMMAND TESTS
# ============================================================================

echo -e "${YELLOW}Test: resolve discussion file path${NC}"
setup_fixture
create_wu auth-flow feature "Auth"
output=$(run_cli_stdout resolve auth-flow.discussion.auth-flow)

assert_contains "$output" "auth-flow/discussion/auth-flow.md" "Resolves discussion path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve specification file path${NC}"
setup_fixture
create_wu auth-flow feature "Auth"
output=$(run_cli_stdout resolve auth-flow.specification.auth-flow)

assert_contains "$output" "auth-flow/specification/auth-flow/specification.md" "Resolves spec path with nested topic dir"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve investigation file path${NC}"
setup_fixture
create_wu auth-flow bugfix "Bug"
output=$(run_cli_stdout resolve auth-flow.investigation.auth-flow)

assert_contains "$output" "auth-flow/investigation/auth-flow.md" "Resolves investigation path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve single research file path (3-segment)${NC}"
setup_fixture
create_wu payments epic "Payments"
run_cli set payments.research.exploration status in-progress >/dev/null 2>&1
output=$(run_cli_stdout resolve payments.research.exploration)

assert_contains "$output" "payments/research/exploration.md" "Resolves single research item path"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve all research files (2-segment, from manifest items)${NC}"
setup_fixture
create_wu payments epic "Payments"
run_cli set payments.research.exploration status in-progress >/dev/null 2>&1
run_cli set payments.research.networking status in-progress >/dev/null 2>&1
output=$(run_cli_stdout resolve payments.research)

assert_contains "$output" "payments/research/exploration.md" "Lists exploration research item"
assert_contains "$output" "payments/research/networking.md" "Lists networking research item"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve does NOT include unlisted research files${NC}"
setup_fixture
create_wu payments epic "Payments"
run_cli set payments.research.tracked status in-progress >/dev/null 2>&1
# Create an untracked file on disk that is NOT in the manifest
mkdir -p "$TEST_DIR/.workflows/payments/research"
echo "untracked" > "$TEST_DIR/.workflows/payments/research/rogue.md"
output=$(run_cli_stdout resolve payments.research)

assert_contains "$output" "payments/research/tracked.md" "Includes tracked research item"
assert_not_contains "$output" "rogue" "Does not include untracked research file"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve errors for non-existent work unit${NC}"
setup_fixture
exit_code=$(run_cli_exit_code resolve nonexistent.discussion.foo)

assert_equals "$exit_code" "2" "Non-existent work unit exits 2 (expected miss)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve errors for non-indexed phase${NC}"
setup_fixture
create_wu auth-flow feature "Auth"
exit_code=$(run_cli_exit_code resolve auth-flow.planning.auth-flow)
output=$(run_cli resolve auth-flow.planning.auth-flow 2>&1 || true)

assert_equals "$exit_code" "1" "Non-indexed phase exits 1"
assert_contains "$output" "not indexed" "Error mentions not indexed"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve errors for insufficient segments${NC}"
setup_fixture
create_wu auth-flow feature "Auth"
exit_code=$(run_cli_exit_code resolve auth-flow)
output=$(run_cli resolve auth-flow 2>&1 || true)

assert_equals "$exit_code" "1" "Single segment exits 1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: resolve outputs correct path even when file does not exist on disk${NC}"
setup_fixture
create_wu auth-flow feature "Auth"
# Don't create the file on disk — resolve should still output the path
output=$(run_cli_stdout resolve auth-flow.discussion.auth-flow)

assert_contains "$output" "auth-flow/discussion/auth-flow.md" "Path returned even without file on disk"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: corrupt project manifest aborts with clear error (no silent clobber)${NC}"
setup_fixture
# Write a corrupt project manifest — invalid JSON with a trailing comma
# (the exact pattern that silently wiped tick's work_units).
cat > "$TEST_DIR/.workflows/manifest.json" <<'BADJSON'
{
  "work_units": {
    "existing-unit": {
      "work_type": "feature"
    },
  }
}
BADJSON

combined=$(cd "$TEST_DIR" && node "$ENGINE_JS" manifest set project.defaults.plan_format tick 2>&1; echo "__EXIT__=$?")
exit_code=$(echo "$combined" | grep -o '__EXIT__=[0-9]*' | tail -1 | cut -d= -f2)
output=$(echo "$combined" | grep -v '__EXIT__=')

assert_equals "$exit_code" "1" "Corrupt manifest exits 1"
assert_contains "$output" "not valid JSON" "Error mentions invalid JSON"
assert_contains "$output" "by hand" "Error tells user to fix manually"

# Verify the corrupt manifest was NOT overwritten — the trailing comma
# should still be on disk.
manifest_still_corrupt=$(cat "$TEST_DIR/.workflows/manifest.json" | node -e "let s=''; process.stdin.on('data',c=>s+=c); process.stdin.on('end',()=>{try{JSON.parse(s);console.log('parsed');}catch(e){console.log('still-corrupt');}});")
assert_equals "$manifest_still_corrupt" "still-corrupt" "Corrupt manifest preserved on disk (not clobbered)"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: missing project manifest is treated as first-write (not an error)${NC}"
setup_fixture
# No manifest.json on disk — a project write should create it fresh.
exit_code=$(run_cli_exit_code set project.defaults.plan_format tick)
assert_equals "$exit_code" "0" "First project write succeeds without existing manifest"
written=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TEST_DIR/.workflows/manifest.json', 'utf8')).defaults.plan_format)" 2>/dev/null)
assert_equals "$written" "tick" "Manifest created with the written default"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: get exit codes — missing is exit 0, real errors are exit 1${NC}"
setup_fixture
# Missing work unit → empty + exit 0.
exit_code=$(run_cli_exit_code get nonexistent status)
assert_equals "$exit_code" "0" "Missing work unit → exit 0"

create_wu real feature "Real"
# Missing path inside existing manifest → empty + exit 0.
exit_code=$(run_cli_exit_code get real nonexistent_field)
assert_equals "$exit_code" "0" "Missing path in existing manifest → exit 0"

# Invalid work_type → validation error → exit 1.
exit_code=$(run_cli_exit_code set real work_type bogus)
assert_equals "$exit_code" "1" "Invalid work-type → exit 1"

# Corrupt manifest JSON → real error → exit 1.
mkdir -p "$TEST_DIR/.workflows/corrupt-wu"
echo "{not valid json" > "$TEST_DIR/.workflows/corrupt-wu/manifest.json"
exit_code=$(run_cli_exit_code get corrupt-wu status)
assert_equals "$exit_code" "1" "Corrupt work-unit JSON → exit 1"

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: read/mutation exit-code contract, pinned distinctly (miss=2, error/mutation=1)${NC}"
setup_fixture
create_wu codes feature "Codes"
run_cli set codes.planning.codes task_map.codes-1-1 ext-1 >/dev/null 2>&1

# Reads — an EXPECTED miss is exit 2, distinct from a real error's exit 1. A
# regression collapsing 2 into 1 must fail here, not slip past a non-zero check.
assert_exit_code 2 "key-of value-not-found → exit 2 (expected miss)" \
    key-of codes.planning.codes task_map ext-absent
assert_exit_code 2 "resolve on a missing work unit → exit 2 (expected miss)" \
    resolve ghost.discussion.ghost

# Reads — a real error is exit 1, never 2.
assert_exit_code 1 "get on an invalid phase → exit 1 (real error)" \
    get codes.cooking.codes status
assert_exit_code 1 "resolve on a non-indexed phase → exit 1 (real error)" \
    resolve codes.planning.codes
assert_exit_code 1 "key-of on a non-object path → exit 1 (real error)" \
    key-of codes work_type feature

# Mutations — always exit 1, whatever the underlying error's own code.
assert_exit_code 1 "set invalid work_type → exit 1" set codes work_type bogus
assert_exit_code 1 "set NON-string status → exit 1" set codes status 123
assert_exit_code 1 "set on a missing work unit → exit 1" set ghost status completed
assert_exit_code 1 "delete a missing path → exit 1" delete codes nope.deep.path
assert_exit_code 1 "unknown command → exit 1" destroy everything

echo ""

# ============================================================================
# DISCOVERY PHASE CROSS-WORK-TYPE TESTS
# ============================================================================
#
# Universal Discovery entry requires that phases.discovery is writable for
# every work type, not just epic. These tests pin that contract so a future
# schema tightening can't silently regress it.

echo -e "${YELLOW}Test: phases.discovery accepts writes for every work type${NC}"
setup_fixture
for wt in epic feature bugfix quick-fix cross-cutting; do
    name="${wt//-/_}-disc"
    create_wu "$name" "$wt" "Discovery cross-type $wt"
    run_cli set "$name.discovery" active_session 1 >/dev/null 2>&1
    run_cli set "$name.discovery" session_number 1 >/dev/null 2>&1
    run_cli set "$name.discovery" next_session_number 2 >/dev/null 2>&1

    active=$(run_cli_stdout get "$name.discovery" active_session)
    session=$(run_cli_stdout get "$name.discovery" session_number)
    next=$(run_cli_stdout get "$name.discovery" next_session_number)

    assert_equals "$active" "1" "$wt: active_session writes"
    assert_equals "$session" "1" "$wt: session_number writes"
    assert_equals "$next" "2" "$wt: next_session_number writes"
done

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discovery status refusal names the map contract for every work type${NC}"
setup_fixture
for wt in epic feature bugfix quick-fix cross-cutting; do
    name="${wt//-/_}-disc-item"
    create_wu "$name" "$wt" "Discovery item $wt"
    output=$(run_cli set "$name.discovery.topic-one" status in-progress 2>&1 || true)
    assert_contains "$output" "carry no status field" "$wt: discovery status write refused with the map explanation"
done

echo ""

# ----------------------------------------------------------------------------

echo -e "${YELLOW}Test: discovery item status writes refused for every work type${NC}"
setup_fixture
for wt in epic feature bugfix quick-fix cross-cutting; do
    name="${wt//-/_}-disc-guard"
    create_wu "$name" "$wt" "Guard $wt"
    assert_exit_code 1 "$wt: discovery item status completed rejected" \
        set "$name.discovery.topic-one" status completed
    assert_exit_code 1 "$wt: discovery item status in-progress rejected" \
        set "$name.discovery.topic-one" status in-progress
done

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
