'use strict';

//
// A PATH stub standing in for tmux, shared by the suites that drive the
// engine's session-label verbs: one session, its name and id held in state
// files beside the stub (a test rewrites the id to simulate a server restart
// that carried the name across), every invocation logged. Failure switches
// ride the environment — TMUX_STUB_FAIL (every call), TMUX_STUB_FAIL_RENAME,
// TMUX_STUB_FAIL_LS. The engine only ever sees the stub.
//

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMUX_STUB = `#!/bin/bash
echo "$@" >> "$TMUX_STUB_LOG"
[ -n "$TMUX_STUB_FAIL" ] && exit 1
if [ "$1" = "-S" ]; then shift 2; fi
cmd="$1"; shift
name=$(cat "$TMUX_STUB_STATE")
id=$(cat "$TMUX_STUB_ID")
target=""; positional=""
while [ $# -gt 0 ]; do
  case "$1" in
    -t) target="$2"; shift 2 ;;
    -p|-F) shift ;;
    *) positional="$1"; shift ;;
  esac
done
case "$target" in
  '$'*) [ "$target" != "$id" ] && exit 1 ;;
esac
if [ "$cmd" = "display-message" ]; then
  if [ "$positional" = '#{session_id}|#{session_name}' ]; then
    echo "$id|$name"
  elif [ "$positional" = '#{session_name}' ]; then
    echo "$name"
  fi
elif [ "$cmd" = "list-sessions" ]; then
  [ -n "$TMUX_STUB_FAIL_LS" ] && exit 1
  echo "$id|$name"
elif [ "$cmd" = "rename-session" ]; then
  [ -n "$TMUX_STUB_FAIL_RENAME" ] && exit 1
  echo "$positional" > "$TMUX_STUB_STATE"
fi
exit 0
`;

/**
 * Install the stub in a fresh temp dir with its one session seeded.
 * @param {{name?: string, id?: string}} [session]
 * @returns {string} the stub dir — first on PATH via `tmuxStubEnv`
 */
function installTmuxStub({ name = 'proj-abc', id = '$7' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmux-stub-'));
  fs.writeFileSync(path.join(dir, 'tmux'), TMUX_STUB, { mode: 0o755 });
  setTmuxStubName(dir, name);
  setTmuxStubId(dir, id);
  fs.writeFileSync(path.join(dir, 'log'), '');
  return dir;
}

/**
 * The environment entries that put the stub on PATH and point it at its
 * state files.
 * @param {string} dir @param {string} [basePath] the PATH to prepend to
 */
function tmuxStubEnv(dir, basePath = process.env.PATH) {
  return {
    PATH: `${dir}:${basePath}`,
    TMUX_STUB_STATE: path.join(dir, 'state'),
    TMUX_STUB_ID: path.join(dir, 'id'),
    TMUX_STUB_LOG: path.join(dir, 'log'),
  };
}

/** The stub session's current name. @param {string} dir */
function tmuxStubName(dir) {
  return fs.readFileSync(path.join(dir, 'state'), 'utf8').trim();
}

/** Rename the stub session from outside the engine — a user's own rename. @param {string} dir @param {string} name */
function setTmuxStubName(dir, name) {
  fs.writeFileSync(path.join(dir, 'state'), `${name}\n`);
}

/** Renumber the stub session — a server restart that kept the name. @param {string} dir @param {string} id */
function setTmuxStubId(dir, id) {
  fs.writeFileSync(path.join(dir, 'id'), `${id}\n`);
}

module.exports = { installTmuxStub, tmuxStubEnv, tmuxStubName, setTmuxStubName, setTmuxStubId };
