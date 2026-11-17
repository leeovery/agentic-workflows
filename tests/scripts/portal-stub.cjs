'use strict';

//
// A PATH stub standing in for `portal`, for the suites that drive the
// engine's session labels inside a Portal session: the session named by
// `$ZMX_SESSION`, its label held in a state file beside the stub, every
// invocation logged. `current` prints the label; `rename -- <text>` sets it,
// and `rename` with no text resets it to the session's name. Failure
// switches ride the environment — PORTAL_STUB_FAIL (every call),
// PORTAL_STUB_FAIL_RENAME.
//
// Every call that sets `$ZMX_SESSION` runs on `pinnedPath`, which holds the
// stub, links to git and node, and the system's own folders, and nothing else, so
// the engine never reaches a `portal` the machine has.
//

const fs = require('fs');
const os = require('os');
const path = require('path');

const PORTAL_STUB = `#!/bin/bash
printf '%s\\n' "$*" >> "$PORTAL_STUB_LOG"
[ -n "$PORTAL_STUB_FAIL" ] && exit 1
cmd="$1"; shift
case "$cmd" in
  current) cat "$PORTAL_STUB_STATE" ;;
  rename)
    [ -n "$PORTAL_STUB_FAIL_RENAME" ] && exit 1
    [ "$1" = "--" ] && shift
    if [ $# -eq 0 ]; then echo "$ZMX_SESSION" > "$PORTAL_STUB_STATE"; else echo "$*" > "$PORTAL_STUB_STATE"; fi ;;
  *) exit 2 ;;
esac
exit 0
`;

/** The system's own folders, where no `portal` is installed. */
const SYSTEM_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];

/** @type {string|null} */
let toolLinks = null;

/** A folder linking the git and the node the suite runs on, made once a run. */
function toolFolder() {
  if (toolLinks !== null) return toolLinks;
  const found = (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, 'git')).find((file) => fs.existsSync(file));
  if (!found) throw new Error('no git on the PATH');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-path-'));
  fs.symlinkSync(found, path.join(dir, 'git'));
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  toolLinks = dir;
  return dir;
}

/**
 * A PATH of the stub's folder, where given, a folder linking the git and
 * the node the suite runs on, and the system's own folders — nothing else
 * the machine has on its PATH. Refuses where a `portal` other than the stub
 * would answer on it.
 * @param {string|null} stubDir @returns {string}
 */
function pinnedPath(stubDir) {
  const dirs = [...(stubDir ? [stubDir] : []), toolFolder(), ...SYSTEM_PATH];
  const answering = dirs.filter((dir) => fs.existsSync(path.join(dir, 'portal')));
  if (answering.join() !== (stubDir ?? '')) throw new Error(`a portal other than the stub is on the pinned PATH: ${answering.join(', ')}`);
  return dirs.join(path.delimiter);
}

/**
 * Install the stub in a fresh temp dir with its session's label seeded.
 * @param {string} label @returns {string} the stub dir
 */
function installPortalStub(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-stub-'));
  fs.writeFileSync(path.join(dir, 'portal'), PORTAL_STUB, { mode: 0o755 });
  setPortalStubLabel(dir, label);
  fs.writeFileSync(path.join(dir, 'log'), '');
  return dir;
}

/**
 * The environment entries that put the stub on a pinned PATH and point it
 * at its state files, inside the session `session`.
 * @param {string} dir @param {string} session
 */
function portalStubEnv(dir, session) {
  return {
    PATH: pinnedPath(dir),
    ZMX_SESSION: session,
    PORTAL_STUB_STATE: path.join(dir, 'state'),
    PORTAL_STUB_LOG: path.join(dir, 'log'),
  };
}

/** The stub session's label now. @param {string} dir */
function portalStubLabel(dir) {
  return fs.readFileSync(path.join(dir, 'state'), 'utf8').replace(/\n$/, '');
}

/** Label the stub session from outside the engine — the person's own label. @param {string} dir @param {string} label */
function setPortalStubLabel(dir, label) {
  fs.writeFileSync(path.join(dir, 'state'), `${label}\n`);
}

/** Every call the stub was asked for, its arguments space-joined. @param {string} dir */
function portalStubCalls(dir) {
  return fs.readFileSync(path.join(dir, 'log'), 'utf8').split('\n').filter(Boolean);
}

module.exports = { installPortalStub, portalStubEnv, portalStubLabel, setPortalStubLabel, portalStubCalls, pinnedPath };
