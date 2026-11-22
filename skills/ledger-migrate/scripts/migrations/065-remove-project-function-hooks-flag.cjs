'use strict';

//
// Migration 065: Remove the function-hooks flag from the project's settings
//
// The gate mod loads only with function hooks enabled, and boot used to
// enable them with `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1"` in the
// project's committed `.claude/settings.json`. Claude Code no longer lets
// project settings set that key — it drops it with a warning at every
// start — so boot keeps it in the user's own settings instead. Where the
// project's flag reads `"1"`, the value the workflows wrote, it is removed,
// and `env` with it when nothing else is left there; any other value is the
// project's own and stands. Everything else in the file stands, in the
// format the engine writes settings in.
//
// A file that is absent or does not parse holds nothing to remove.
//
// Idempotent: once removed, there is no flag left to remove.
//

const fs = require('fs');
const path = require('path');

const SETTINGS = path.join('.claude', 'settings.json');
const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * The settings, or null where the file is absent or does not parse to an
 * object.
 * @param {string} file
 * @returns {Record<string, any>|null}
 */
function readSettings(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Remove the workflows' flag in place.
 * @param {Record<string, any>} settings
 * @returns {boolean} whether anything changed
 */
function removeFlag(settings) {
  const env = settings.env;
  if (!isObject(env) || env[FLAG] !== '1') return false;
  delete env[FLAG];
  if (Object.keys(env).length === 0) delete settings.env;
  return true;
}

module.exports = {
  id: '065',
  description: 'remove the function-hooks flag the workflows wrote into the project settings — Claude Code no longer reads it there',
  run({ projectDir, reportUpdate, reportSkip }) {
    const file = path.join(projectDir, SETTINGS);
    const settings = readSettings(file);
    if (!settings || !removeFlag(settings)) {
      reportSkip();
      return;
    }
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
    reportUpdate();
  },
};
