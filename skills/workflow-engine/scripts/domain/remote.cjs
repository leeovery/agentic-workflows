'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's remote, read for whatever asks where the
// project's code is hosted — the drivers' landing default, the code host's
// driver for setup's rule, and the default branch the landing reads off the
// remote. The remote is the one the state goes to (state-worktree.cjs). Its
// name and URL are read here; which host a URL names is its driver's to say
// (drivers.cjs), and nothing here acts on a host.
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { stateRemoteName, stateRemoteUrl } = require('./state-worktree.cjs');

/**
 * The name of the project's remote, or null where it has none chosen.
 * @param {string} cwd
 * @returns {string|null}
 */
function remoteName(cwd) {
  return stateRemoteName(stateRoot(cwd));
}

/**
 * The URL of the project's remote, or null where it has none chosen.
 * @param {string} cwd
 * @returns {string|null}
 */
function remoteUrl(cwd) {
  return stateRemoteUrl(stateRoot(cwd));
}

module.exports = { remoteName, remoteUrl };
