'use strict';

// ---------------------------------------------------------------------------
// Domain ring: Claude Code's settings files — the project's committed
// `.claude/settings.json`, which carries the session hooks
// (`session-label.cjs`), and the user's own, which carries the
// function-hooks flag the gate mod loads under (`gate-surface.cjs`). Reading
// is tolerant by contract: an absent file is an empty document, and one that
// cannot be read is reported rather than thrown, because no sync may fail
// over plumbing it cannot read. Each caller reconciles its own keys and
// leaves every other one standing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');

/** The project's settings file, as a pathspec — what a confined commit names. */
const SETTINGS_SPEC = '.claude/settings.json';

/** @typedef {{changed: boolean, error?: string}} SettingsSync */

/**
 * Whether the test harness holds the settings files still — its hermeticity
 * switch, which keeps a recipe's boot out of a world's settings and the
 * user's. Real projects never set it: what the syncs write is
 * infrastructure, not a setting.
 * @returns {boolean}
 */
function settingsHeld() {
  return Boolean(process.env.WORKFLOWS_HOLD_PROJECT_SETTINGS);
}

/**
 * Claude Code's user settings file — in its config directory,
 * `CLAUDE_CONFIG_DIR` when set, else `~/.claude`.
 * @returns {string}
 */
function userSettingsPath() {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');
}

/** @param {unknown} err @returns {string} */
function reason(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * A settings document: the parsed object, and the reason it could not be
 * read where it could not, the file named as `label`. An absent file reads
 * `{}` — the first-write state — as does an unreadable one, which every
 * caller refuses on `error` before touching it.
 * @param {string} file @param {string} [label]
 * @returns {{settings: Record<string, any>, error?: string}}
 */
function readSettings(file, label = file) {
  if (!fs.existsSync(file)) return { settings: {} };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { settings: {}, error: `${label} could not be read — ${reason(err)}` };
  }
  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed)) throw new Error('root is not an object');
    return { settings: parsed };
  } catch (err) {
    return { settings: {}, error: `${label} is not valid JSON — ${reason(err)}` };
  }
}

/**
 * Where a write to `file` lands: the end of its symlink chain, a link to a
 * file not yet made included, so the link stands.
 * @param {string} file @returns {string}
 */
function writeTarget(file) {
  try {
    return fs.realpathSync(file);
  } catch { /* absent, or a link to nothing yet */ }
  try {
    return path.resolve(path.dirname(file), fs.readlinkSync(file));
  } catch {
    return file;
  }
}

/**
 * Write a settings document whole, its directory made first — the kernel's
 * atomic write, so a reader never meets a half-written file — through a
 * symlink to the file it names, an existing file keeping its mode.
 * @param {string} file @param {Record<string, any>} settings
 */
function writeSettings(file, settings) {
  const target = writeTarget(file);
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : undefined;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeJsonAtomic(target, settings, { mode });
}

/** @param {string} cwd @returns {{settings: Record<string, any>, error?: string}} */
function readProjectSettings(cwd) {
  return readSettings(path.join(cwd, SETTINGS_SPEC), SETTINGS_SPEC);
}

/** @param {string} cwd @param {Record<string, any>} settings */
function writeProjectSettings(cwd, settings) {
  writeSettings(path.join(cwd, SETTINGS_SPEC), settings);
}

module.exports = { SETTINGS_SPEC, settingsHeld, userSettingsPath, readSettings, writeSettings, readProjectSettings, writeProjectSettings };
