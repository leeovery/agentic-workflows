'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the `workflow-gates` mod, part of the
// workflows, which draws the engine's gates as buttons above the prompt
// instead of leaving the model to reproduce the menu. It runs only in
// Claude Code's terminal app, from 2.1.282, in a project that installed it.
// Anywhere else boot touches no settings file: a terminal app older than
// the mod is reported outdated, and everywhere else the workflows carry on
// with the text menus. Where it can run, Claude Code loads it only with
// function hooks enabled, and only the user's own settings can enable them
// — project and local settings cannot set the key — so every such boot
// makes `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` `"1"` there. Whether the mod
// is running, the mod says itself: it announces the gate surface at session
// start, and every command the session runs inherits the announcement.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { gateSurfaceAnnounced } = require('./projections/surfaces.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { readSettings, settingsHeld, userSettingsPath, writeSettings } = require('./settings.cjs');

/** Claude Code's early-access switch — the mod loads only where it is set. */
const FUNCTION_HOOKS_ENV = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const FUNCTION_HOOKS_ON = '1';

/** Where an install puts the mod, relative to the project root. */
const MOD_DIR = path.join('.claude', 'skills', 'workflow-gates');

/** The oldest Claude Code the mod runs on. */
const MIN_VERSION = [2, 1, 282];

/** @typedef {'on'|'restart'|'not-running'|'settings-unreadable'|'outdated'|'unavailable'} GateSurface */

/**
 * @typedef {object} GateSurfaceSync
 * @property {GateSurface} status
 * @property {string} [settings] the user settings file the sync read and wrote — absent where it touched none
 * @property {string} [error] why that file could not be read or written
 */

/**
 * The running Claude Code's version, read off the agent identity it hands
 * every command (`AI_AGENT=claude-code_2-1-282_agent`); null where that is
 * absent or reads otherwise.
 * @param {string|undefined} agent
 * @returns {number[]|null}
 */
function claudeCodeVersion(agent) {
  const m = /^claude-code_(\d+)-(\d+)-(\d+)_agent$/.exec(agent || '');
  return m ? m.slice(1).map(Number) : null;
}

/** @param {number[]} version @returns {boolean} */
function supported(version) {
  for (let i = 0; i < MIN_VERSION.length; i++) {
    if (version[i] !== MIN_VERSION[i]) return version[i] > MIN_VERSION[i];
  }
  return true;
}

/**
 * Where the mod stands before any file is touched: `unavailable` outside
 * Claude Code's terminal app — on the web, another entrypoint — in a
 * project that did not install it, under the test harness's settings hold,
 * or at a version that does not read; `outdated` at a release before the
 * mod's; null where it can run.
 * @param {string} cwd
 * @returns {'unavailable'|'outdated'|null}
 */
function footing(cwd) {
  if (settingsHeld() || process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_CODE_ENTRYPOINT !== 'cli') return 'unavailable';
  if (!fs.existsSync(path.join(cwd, MOD_DIR))) return 'unavailable';
  const version = claudeCodeVersion(process.env.AI_AGENT);
  if (!version) return 'unavailable';
  return supported(version) ? null : 'outdated';
}

/**
 * Make `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` exactly `"1"` in the settings
 * at `file`, every other env key and every other setting standing. A file
 * that cannot be read is left untouched, and it and a write that fails are
 * reported rather than thrown: boot may not fail over plumbing it cannot
 * reach.
 * @param {string} file
 * @returns {import('./settings.cjs').SettingsSync}
 */
function enableFunctionHooks(file) {
  const read = readSettings(file);
  if (read.error) return { changed: false, error: read.error };
  const env = isObject(read.settings.env) ? read.settings.env : {};
  if (env[FUNCTION_HOOKS_ENV] === FUNCTION_HOOKS_ON) return { changed: false };
  try {
    writeSettings(file, { ...read.settings, env: { ...env, [FUNCTION_HOOKS_ENV]: FUNCTION_HOOKS_ON } });
  } catch (err) {
    return { changed: false, error: `${file} could not be written — ${err instanceof Error ? err.message : String(err)}` };
  }
  return { changed: true };
}

/**
 * Where the mod stands once the flag is synced: `on` where it is running,
 * its announcement in this process's environment, whatever the sync did;
 * otherwise `settings-unreadable` where the file could not be read or
 * written, `restart` where this boot changed it — Claude Code reads its
 * settings only at startup — and `not-running` where the flag was already
 * there.
 * @param {import('./settings.cjs').SettingsSync} sync
 * @returns {GateSurface}
 */
function standing(sync) {
  if (gateSurfaceAnnounced()) return 'on';
  if (sync.error) return 'settings-unreadable';
  return sync.changed ? 'restart' : 'not-running';
}

/**
 * Boot's footing for the mod, and its report: where it can run, the flag
 * made `"1"` in the user's settings and the file named; elsewhere, and
 * where Claude Code is older than the mod, no file touched.
 * @param {string} cwd
 * @returns {GateSurfaceSync}
 */
function syncGateSurface(cwd) {
  const before = footing(cwd);
  if (before) return { status: before };
  const settings = userSettingsPath();
  const sync = enableFunctionHooks(settings);
  return { status: standing(sync), settings, error: sync.error };
}

module.exports = { MOD_DIR, syncGateSurface };
