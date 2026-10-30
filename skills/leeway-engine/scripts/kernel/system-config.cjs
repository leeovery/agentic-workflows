'use strict';

// ---------------------------------------------------------------------------
// Kernel: the workflows' system config directory — one per user, beside no
// project: `LEEWAY_CONFIG_DIR` when set, else `~/.config/leeway` — and
// the settings file in it.
// ---------------------------------------------------------------------------

const os = require('os');
const path = require('path');

/** The settings file in the system config directory (knowledge/config.cjs). */
const SETTINGS_FILE = 'config.json';

/** @returns {string} */
function systemConfigDir() {
  return process.env.LEEWAY_CONFIG_DIR || path.join(os.homedir(), '.config', 'leeway');
}

module.exports = { SETTINGS_FILE, systemConfigDir };
