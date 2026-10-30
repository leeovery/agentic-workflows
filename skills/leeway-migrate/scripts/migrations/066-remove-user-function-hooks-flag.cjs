'use strict';

//
// Migration 066: Remove the function-hooks flag from the user's Claude Code
// settings
//
// Earlier releases of the workflows wrote
// `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: "1"` into the user's own Claude
// Code settings to switch the gate mod on. Mods are on by default from
// Claude Code 2.1.287, which ignores that key whatever its value, so it is
// removed — and `env` with it when nothing else is left there. Everything
// else in the file stands. The file is `settings.json` in `CLAUDE_CONFIG_DIR`
// when that is set and non-empty, else `~/.claude/settings.json`, resolved
// at run time; a symlinked file is written at the file it names, the link
// standing, an existing file keeps its mode, and the write is atomic, in the
// format Claude Code writes settings in.
//
// The one migration that writes outside the project: the user's own Claude
// Code settings, never staged or committed. The review gate's diff cannot
// show the change, so a run that removes the key hands the session an
// addendum naming it for the summary.
//
// A file that is absent, does not parse to an object, or holds no key has
// nothing to remove. A file that cannot be written is left as found and the
// run skips: boot never fails over a file outside the project.
//
// Idempotent: once removed, there is no key left to remove.
//

const fs = require('fs');
const os = require('os');
const path = require('path');

const FLAG = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The user's Claude Code settings file, resolved now. @returns {string} */
function settingsPath() {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');
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
 * Remove the key in place, whatever its value.
 * @param {Record<string, any>} settings
 * @returns {boolean} whether anything changed
 */
function removeFlag(settings) {
  const env = settings.env;
  if (!isObject(env) || !Object.prototype.hasOwnProperty.call(env, FLAG)) return false;
  delete env[FLAG];
  if (Object.keys(env).length === 0) delete settings.env;
  return true;
}

/**
 * Where a write to `file` lands: the end of its symlink chain.
 * @param {string} file @returns {string}
 */
function writeTarget(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

/**
 * Write the settings whole at the file `file` names, keeping its mode: a
 * temp file beside the target, renamed over it.
 * @param {string} file @param {Record<string, any>} settings
 */
function writeSettings(file, settings) {
  const target = writeTarget(file);
  const mode = fs.statSync(target).mode & 0o777;
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { encoding: 'utf8', mode });
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

module.exports = {
  id: '066',
  description: 'remove the function-hooks flag the workflows wrote into the user\'s Claude Code settings — Claude Code 2.1.287 and later ignore it',
  info: 'Earlier releases of the workflows wrote env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS into the user\'s own Claude Code settings (settings.json in CLAUDE_CONFIG_DIR, else ~/.claude/settings.json) to switch the gate mod on. Claude Code 2.1.287 and later turn mods on by default and ignore that key, so this migration removes it, and env with it when nothing else is left there. The file is outside the project: the change is never staged or committed, and the review diff does not show it.',
  run({ reportUpdate, reportSkip }) {
    const file = settingsPath();
    const settings = readSettings(file);
    if (!settings || !removeFlag(settings)) {
      reportSkip();
      return undefined;
    }
    try {
      writeSettings(file, settings);
    } catch {
      reportSkip();
      return undefined;
    }
    reportUpdate();
    return { verify: `This migration removed CLAUDE_CODE_ENABLE_FUNCTION_HOOKS from ${file} — the user's own Claude Code settings, outside this project. Nothing to check or fix in the project: the change is in neither the diff nor the commit, so say in the summary that the workflows removed the line they once wrote into the person's Claude Code settings.` };
  },
};
