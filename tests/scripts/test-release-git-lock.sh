#!/bin/bash
# Tests for git_safe — the release script's git-lock-resilience wrapper.
# Run: bash tests/scripts/test-release-git-lock.sh

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

file_contains() {
  local pattern="$1" file="$2"
  local content
  content=$(cat "$file" 2>/dev/null || true)
  case "$content" in
    *"$pattern"*) echo true ;;
    *) echo false ;;
  esac
}

# A self-contained throwaway repo plus a `git` shell-function override that the
# release functions call. git_safe invokes `git "$@"`, so overriding git as a
# function (after sourcing) lets each case simulate lock collisions, stale
# locks, and genuine errors without touching a real repository.
setup() {
  TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/release-gitlock-test.XXXXXX")
  REPO="$TEST_DIR/repo"
  RELEASE_FUNCS="$TEST_DIR/release-funcs.sh"
  GIT_OVERRIDE="$TEST_DIR/git-override.sh"
  COUNTER="$TEST_DIR/counter"
  LOCKFILE="$TEST_DIR/index.lock"
  ERRFILE="$TEST_DIR/err.log"
  mkdir -p "$REPO"

  cd "$REPO"
  git init -q
  git config user.email t@t.t
  git config user.name t

  # Strip the main invocation so sourcing defines functions without running.
  grep -v '^main "\$@"$' "$RELEASE_SCRIPT" > "$RELEASE_FUNCS"

  # git override, driven by STUB_MODE. Every invocation bumps $COUNTER so a
  # test can assert whether git_safe retried or returned immediately.
  cat > "$GIT_OVERRIDE" << OVREOF
git() {
  local n
  n=\$(cat "$COUNTER" 2>/dev/null || echo 0)
  echo \$((n + 1)) > "$COUNTER"
  case "\${STUB_MODE:-ok}" in
    ok)
      echo "ok-stdout"; return 0 ;;
    lock_then_ok)
      if [ "\$n" -lt "\${STUB_FAIL_TIMES:-1}" ]; then
        echo "fatal: Unable to create '$LOCKFILE': File exists." >&2
        return 128
      fi
      echo "ok-after-retry"; return 0 ;;
    stale)
      if [ -e "$LOCKFILE" ]; then
        echo "fatal: Unable to create '$LOCKFILE': File exists." >&2
        return 128
      fi
      echo "ok-stale-cleared"; return 0 ;;
    genuine)
      echo "fatal: pathspec 'foo' did not match any files" >&2
      return 1 ;;
  esac
}
OVREOF
}

teardown() {
  cd "$REPO_DIR"
  rm -rf "$TEST_DIR"
  unset STUB_MODE STUB_FAIL_TIMES GIT_LOCK_WAIT_SECONDS
}

# Run git_safe in a subshell with the override sourced. Captures stdout into
# $STDOUT, stderr into $ERRFILE, exit status into $RC, retries into $COUNTER.
run_git_safe() {
  rm -f "$COUNTER"
  set +e
  STDOUT=$(
    {
      cd "$REPO"
      source "$RELEASE_FUNCS"
      source "$GIT_OVERRIDE"
      git_safe add foo
    } 2> "$ERRFILE"
  )
  RC=$?
  set -e
}

# --- Test 1: Clean pass-through (no lock) ---
test_passthrough_success() {
  setup
  export STUB_MODE=ok GIT_LOCK_WAIT_SECONDS=3
  run_git_safe
  assert_eq "clean command returns 0" "0" "$RC"
  assert_eq "stdout is forwarded" "true" "$(case "$STDOUT" in *ok-stdout*) echo true ;; *) echo false ;; esac)"
  assert_eq "no retry on success" "1" "$(cat "$COUNTER")"
  teardown
}

# --- Test 2: Lock collision, then succeeds on retry (error stays silent) ---
test_lock_then_succeeds() {
  setup
  export STUB_MODE=lock_then_ok STUB_FAIL_TIMES=2 GIT_LOCK_WAIT_SECONDS=10
  run_git_safe
  assert_eq "retried command returns 0" "0" "$RC"
  assert_eq "success stdout forwarded" "true" "$(case "$STDOUT" in *ok-after-retry*) echo true ;; *) echo false ;; esac)"
  assert_eq "lock error is suppressed (not surfaced)" "false" "$(file_contains "File exists" "$ERRFILE")"
  assert_eq "it retried past the failures" "3" "$(cat "$COUNTER")"
  teardown
}

# --- Test 3: Persistent lock is cleared as stale, then succeeds ---
test_stale_lock_cleared() {
  setup
  : > "$LOCKFILE"
  export STUB_MODE=stale GIT_LOCK_WAIT_SECONDS=2
  run_git_safe
  assert_eq "stale-cleared command returns 0" "0" "$RC"
  assert_eq "stale lock file removed" "false" "$([ -e "$LOCKFILE" ] && echo true || echo false)"
  assert_eq "logged the stale-lock clearance" "true" "$(file_contains "Clearing stale git lock" "$ERRFILE")"
  assert_eq "final attempt stdout forwarded" "true" "$(case "$STDOUT" in *ok-stale-cleared*) echo true ;; *) echo false ;; esac)"
  teardown
}

# --- Test 4: Genuine (non-lock) error surfaces immediately, no retry ---
test_genuine_error_passthrough() {
  setup
  export STUB_MODE=genuine GIT_LOCK_WAIT_SECONDS=10
  run_git_safe
  assert_eq "genuine error returns non-zero" "true" "$([ "$RC" -ne 0 ] && echo true || echo false)"
  assert_eq "genuine error is surfaced on stderr" "true" "$(file_contains "did not match any files" "$ERRFILE")"
  assert_eq "no retry on a non-lock error" "1" "$(cat "$COUNTER")"
  teardown
}

echo "Running release git-lock resilience tests..."
echo

test_passthrough_success
test_lock_then_succeeds
test_stale_lock_cleared
test_genuine_error_passthrough

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
