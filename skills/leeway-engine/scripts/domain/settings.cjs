'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's committed Claude Code settings
// (`.claude/settings.json` in the code root), which carry the session hooks
// (`session-label.cjs`). Reading is tolerant by contract: an absent file is
// an empty document, and one that cannot be read is reported rather than
// thrown, because the sync may not fail over plumbing it cannot read. The
// caller reconciles its own keys and leaves every other one standing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');

/** The project's settings file, as a pathspec — what a confined commit names. */
const SETTINGS_SPEC = '.claude/settings.json';

/**
 * A sync's outcome: whether it wrote, why it could not read the file, and
 * the operation git holds open that it waits on.
 * @typedef {{changed: boolean, error?: string, waiting?: string}} SettingsSync
 */

/**
 * Whether the test harness holds the settings file still — its hermeticity
 * switch, which keeps a recipe's boot out of a world's settings. Real
 * projects never set it: what the sync writes is infrastructure, not a
 * setting.
 * @returns {boolean}
 */
function settingsHeld() {
  return Boolean(process.env.LEEWAY_HOLD_PROJECT_SETTINGS);
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
  return parseSettings(text, label);
}

/**
 * A settings document from its text, read as `readSettings` reads a file.
 * @param {string} text @param {string} [label]
 * @returns {{settings: Record<string, any>, error?: string}}
 */
function parseSettings(text, label = SETTINGS_SPEC) {
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
  return readSettings(path.join(codeRoot(cwd), SETTINGS_SPEC), SETTINGS_SPEC);
}

/** @param {string} cwd @param {Record<string, any>} settings */
function writeProjectSettings(cwd, settings) {
  writeSettings(path.join(codeRoot(cwd), SETTINGS_SPEC), settings);
}

module.exports = { SETTINGS_SPEC, settingsHeld, parseSettings, readProjectSettings, writeProjectSettings };
