'use strict';

// ---------------------------------------------------------------------------
// Kernel: every process the engine starts that is not git — a driver's tool,
// the Claude call, a project's own command, `ps`, `tmux`, the migrations'
// runner, a launched job — started here alone, each as `child_process` starts
// it. What the running verb has read of git goes first (kernel/git-reads):
// the process may change what git would answer. git's own runs are
// kernel/git's and kernel/isolated-git's.
// ---------------------------------------------------------------------------

const childProcess = require('child_process');
const { dropReads } = require('./git-reads.cjs');

/**
 * The `child_process` function `which` names, the verb's reads of git
 * dropped before each start. It is looked up at each start, so a test that
 * stands in for it sees every one.
 * @template {'spawnSync'|'spawn'|'execFileSync'} K @param {K} which
 * @returns {typeof childProcess[K]}
 */
function dropping(which) {
  return /** @type {typeof childProcess[K]} */ (/** @type {unknown} */ ((/** @type {any[]} */ ...args) => {
    dropReads();
    return /** @type {Function} */ (childProcess[which])(...args);
  }));
}

const spawnSync = dropping('spawnSync');
const spawn = dropping('spawn');
const execFileSync = dropping('execFileSync');

module.exports = { spawnSync, spawn, execFileSync };
