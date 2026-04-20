#!/bin/bash
# Tests for the release-script build integration (knowledge-base phase 8, task 8-1).
# Run: bash tests/scripts/test-release-build.sh

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RELEASE_SCRIPT="$REPO_DIR/release"

PASS=0
FAIL=0

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

# Piping `git log ... | grep -q` under `set -o pipefail` causes SIGPIPE (141)
# when grep closes its stdin early. Capture first, then match.
file_contains() {
  local pattern="$1" file="$2"
  local content
  content=$(cat "$file" 2>/dev/null || true)
  case "$content" in
    *"$pattern"*) echo true ;;
    *) echo false ;;
  esac
}

git_log_contains() {
  local pattern="$1"
  local log
  log=$(cd "$REPO" && git log --oneline 2>/dev/null || true)
  case "$log" in
    *"$pattern"*) echo true ;;
    *) echo false ;;
  esac
}

# Create a self-contained throwaway git repo with a committed bundle,
# npm/git stubs, and a function-only copy of the real release script
# (main "$@" stripped so sourcing does not execute a release).
setup() {
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/release-build-test.XXXXXX")
  REPO="$TEST_DIR/repo"
  STUBS="$TEST_DIR/stubs"
  CALLS="$TEST_DIR/calls.log"
  RELEASE_FUNCS="$TEST_DIR/release-funcs.sh"
  mkdir -p "$REPO" "$STUBS"

  cd "$REPO"
  git init -q
  git config user.email "test@example.com"
  git config user.name "Test"
  git config commit.gpgsign false

  mkdir -p skills/workflow-knowledge/scripts
  echo "// initial bundle" > skills/workflow-knowledge/scripts/knowledge.cjs
  echo '{"name":"stub","version":"0.0.0"}' > package.json
  echo "0.0.0" > release.txt
  git add .
  git commit -q -m "initial"

  # Stub npm: install is a no-op; build optionally fails or mutates the bundle
  # based on env vars set by the individual test.
  cat > "$STUBS/npm" << 'NPMEOF'
#!/bin/bash
echo "npm $*" >> "$CALLS"
case "$1" in
  install)
    if [ "${STUB_NPM_INSTALL_FAIL:-0}" = "1" ]; then
      echo "stub: npm install failed" >&2
      exit 1
    fi
    exit 0
    ;;
  run)
    if [ "$2" = "build" ]; then
      if [ "${STUB_NPM_BUILD_FAIL:-0}" = "1" ]; then
        echo "stub: npm run build failed" >&2
        exit 1
      fi
      if [ "${STUB_NPM_BUILD_MODIFIES:-0}" = "1" ]; then
        echo "// rebuilt by stub $(date +%s%N)" > skills/workflow-knowledge/scripts/knowledge.cjs
      fi
      exit 0
    fi
    exit 0
    ;;
esac
exit 0
NPMEOF
  chmod +x "$STUBS/npm"

  # Strip the main invocation so sourcing defines functions without running.
  grep -v '^main "\$@"$' "$RELEASE_SCRIPT" > "$RELEASE_FUNCS"

  export PATH="$STUBS:$PATH"
  export CALLS
}

teardown() {
  cd "$REPO_DIR"
  rm -rf "$TEST_DIR"
  unset STUB_NPM_INSTALL_FAIL STUB_NPM_BUILD_FAIL STUB_NPM_BUILD_MODIFIES
}

# Run perform_release in a subshell with git tag/push stubbed so tests never
# tag or push. git add/commit pass through to the real repo so we can observe
# whether a bundle commit lands.
run_release() {
  local version="$1" current="$2" strategy="${3:-none}"
  (
    cd "$REPO"
    source "$RELEASE_FUNCS"
    VERSION_STRATEGY="$strategy"

    update_version_file() { :; }
    generate_release_commit_message() { echo "🔖 Release v$1"; }

    git() {
      case "$1" in
        tag|push)
          echo "git $*" >> "$CALLS"
          return 0
          ;;
        *)
          command git "$@"
          ;;
      esac
    }

    perform_release "$version" "$current" "true"
  ) > "$TEST_DIR/out.log" 2>&1
}

# --- Test 1: happy path — bundle changes, bundle commit lands, tag called ---
test_happy_path_bundle_changes() {
  setup
  export STUB_NPM_BUILD_MODIFIES=1

  local rc=0
  run_release "1.0.0" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits 0 on clean build" "0" "$rc"
  assert_eq "npm install was invoked" "true" "$(file_contains 'npm install' "$CALLS")"
  assert_eq "npm run build was invoked" "true" "$(file_contains 'npm run build' "$CALLS")"
  assert_eq "bundle commit was created" "true" "$(git_log_contains 'rebuild knowledge bundle for v1.0.0')"
  assert_eq "tag was called after build" "true" "$(file_contains 'git tag' "$CALLS")"

  teardown
}

# --- Test 2: bundle unchanged — no bundle commit ---
test_bundle_unchanged_skips_commit() {
  setup
  # STUB_NPM_BUILD_MODIFIES unset → build does not touch the bundle

  local rc=0
  run_release "1.0.0" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits 0 when bundle unchanged" "0" "$rc"
  assert_eq "no bundle commit was created" "false" "$(git_log_contains 'rebuild knowledge bundle')"
  assert_eq "tag was still called" "true" "$(file_contains 'git tag' "$CALLS")"

  teardown
}

# --- Test 3: VERSION_STRATEGY=none still commits bundle when it changes ---
test_version_none_commits_bundle() {
  setup
  export STUB_NPM_BUILD_MODIFIES=1

  local rc=0
  run_release "1.2.3" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits 0 in none strategy" "0" "$rc"
  assert_eq "bundle commit occurs even with VERSION_STRATEGY=none" "true" \
    "$(git_log_contains 'rebuild knowledge bundle for v1.2.3')"

  teardown
}

# --- Test 4: VERSION_STRATEGY=file also commits bundle when it changes ---
test_version_file_commits_bundle() {
  setup
  export STUB_NPM_BUILD_MODIFIES=1

  local rc=0
  run_release "1.2.3" "0.0.0" "file" || rc=$?

  assert_eq "perform_release exits 0 in file strategy" "0" "$rc"
  assert_eq "bundle commit occurs with VERSION_STRATEGY=file" "true" \
    "$(git_log_contains 'rebuild knowledge bundle for v1.2.3')"

  teardown
}

# --- Test 5: build failure aborts before tagging ---
test_build_failure_aborts() {
  setup
  export STUB_NPM_BUILD_FAIL=1

  local rc=0
  run_release "1.0.0" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits non-zero on build failure" "true" \
    "$([ "$rc" -ne 0 ] && echo true || echo false)"
  assert_eq "tag was NOT called after build failure" "false" "$(file_contains 'git tag' "$CALLS")"
  assert_eq "error message mentions build failure" "true" \
    "$(file_contains 'npm run build failed' "$TEST_DIR/out.log")"

  teardown
}

# --- Test 6: npm install failure aborts ---
test_install_failure_aborts() {
  setup
  export STUB_NPM_INSTALL_FAIL=1

  local rc=0
  run_release "1.0.0" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits non-zero on install failure" "true" \
    "$([ "$rc" -ne 0 ] && echo true || echo false)"
  assert_eq "npm run build was NOT invoked after install failure" "false" \
    "$(file_contains 'npm run build' "$CALLS")"
  assert_eq "tag was NOT called after install failure" "false" "$(file_contains 'git tag' "$CALLS")"

  teardown
}

# --- Test 7: dirty working tree gate still fires before build ---
test_dirty_tree_gate_fires() {
  setup
  # Introduce an unrelated uncommitted change
  echo "dirty" > "$REPO/README.md"

  local rc=0
  run_release "1.0.0" "0.0.0" "none" || rc=$?

  assert_eq "perform_release exits non-zero on dirty tree" "true" \
    "$([ "$rc" -ne 0 ] && echo true || echo false)"
  assert_eq "dirty-tree error message emitted" "true" \
    "$(file_contains 'working directory is dirty' "$TEST_DIR/out.log")"
  assert_eq "npm was NOT invoked when tree dirty" "false" "$(file_contains 'npm' "$CALLS")"

  teardown
}

# --- Test 8: build runs before tag in the call ordering ---
test_build_runs_before_tag() {
  setup
  export STUB_NPM_BUILD_MODIFIES=1

  run_release "1.0.0" "0.0.0" "none"

  # Read CALLS log, find line numbers via awk to avoid SIGPIPE from grep -q
  local calls_content build_line tag_line
  calls_content=$(cat "$CALLS")
  build_line=$(echo "$calls_content" | awk '/^npm run build$/ {print NR; exit}')
  tag_line=$(echo "$calls_content" | awk '/^git tag/ {print NR; exit}')

  assert_eq "both build and tag recorded" "true" \
    "$([ -n "$build_line" ] && [ -n "$tag_line" ] && echo true || echo false)"
  assert_eq "build runs before tag" "true" \
    "$([ -n "$build_line" ] && [ -n "$tag_line" ] && [ "$build_line" -lt "$tag_line" ] && echo true || echo false)"

  teardown
}

# --- Run all tests ---
echo "Running release-build integration tests..."
echo ""

test_happy_path_bundle_changes
test_bundle_unchanged_skips_commit
test_version_none_commits_bundle
test_version_file_commits_bundle
test_build_failure_aborts
test_install_failure_aborts
test_dirty_tree_gate_fires
test_build_runs_before_tag

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
