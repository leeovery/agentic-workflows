'use strict';

// ---------------------------------------------------------------------------
// Kernel: the workflows' system config directory — one per user, beside no
// project: `WORKFLOWS_CONFIG_DIR` when set, else `~/.config/workflows`. The
// knowledge CLI resolves the same directory by the same rule.
// ---------------------------------------------------------------------------

const os = require('os');
const path = require('path');

/** @returns {string} */
function systemConfigDir() {
  return process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');
}

module.exports = { systemConfigDir };
