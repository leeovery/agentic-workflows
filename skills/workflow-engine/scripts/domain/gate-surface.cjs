'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the `workflow-gates` mod, part of the
// workflows, which draws the engine's gates as buttons above the prompt
// instead of leaving the model to reproduce the menu. It runs only in
// Claude Code's terminal app, from 2.1.282, in a project that installed it;
// anywhere else boot leaves the settings alone and the workflows carry on
// with the text menus. Where it can run, Claude Code loads it only with
// function hooks enabled, so every boot puts
// `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` into the project's committed
// `.claude/settings.json` wherever it is not already `"1"`. Nothing ever
// takes it out: the flag turns function hooks on for every plugin in the
// project, and it can come from the user's own settings or the shell as
// well, so the file cannot say whether the mod is running. The mod says so
// itself: it announces the gate surface at session start, and every command
// the session runs inherits the announcement.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { gateSurfaceAnnounced } = require('./projections/surfaces.cjs');
const { isObject, readProjectSettings, settingsHeld, writeProjectSettings } = require('./settings.cjs');

/** Claude Code's early-access switch — the mod loads only where it is set. */
const FUNCTION_HOOKS_ENV = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const FUNCTION_HOOKS_ON = '1';

/** Where an install puts the mod, relative to the project root. */
const MOD_DIR = path.join('.claude', 'skills', 'workflow-gates');

/** The oldest Claude Code the mod runs on. */
const MIN_VERSION = [2, 1, 282];

/** @typedef {'on'|'restart'|'not-running'|'unavailable'} GateSurface */

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
 * Whether the mod can run here: Claude Code's terminal app — not on the
 * web, not another entrypoint — at a version the mod runs on, in a project
 * that installed it.
 * @param {string} cwd
 * @returns {boolean}
 */
function modApplies(cwd) {
  if (process.env.CLAUDE_CODE_REMOTE) return false;
  if (process.env.CLAUDE_CODE_ENTRYPOINT !== 'cli') return false;
  const version = claudeCodeVersion(process.env.AI_AGENT);
  if (!version || !supported(version)) return false;
  return fs.existsSync(path.join(cwd, MOD_DIR));
}

/**
 * Ensure `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is `"1"` in the project's
 * `.claude/settings.json`, every other env key and every other setting
 * standing. A settings file that does not parse is left untouched and
 * reported rather than thrown: boot may not fail over plumbing it cannot
 * read.
 * @param {string} cwd
 * @returns {import('./settings.cjs').SettingsSync}
 */
function enableFunctionHooks(cwd) {
  const read = readProjectSettings(cwd);
  if (read.error) return { changed: false, error: read.error };
  const settings = read.settings;
  const env = isObject(settings.env) ? settings.env : {};
  if (env[FUNCTION_HOOKS_ENV] === FUNCTION_HOOKS_ON) return { changed: false };
  writeProjectSettings(cwd, { ...settings, env: { ...env, [FUNCTION_HOOKS_ENV]: FUNCTION_HOOKS_ON } });
  return { changed: true };
}

/**
 * Boot's footing for the mod, and its report. Where the mod cannot run
 * here, or the test harness holds the settings file still, nothing is read
 * or written: `unavailable`. Elsewhere the flag is made `"1"`, and the
 * report says where the mod stands — `on` where it is running, its
 * announcement in this process's environment; `restart` where this boot
 * wrote the flag, since Claude Code reads its settings only at startup;
 * `not-running` where the flag was already there and the mod is not
 * running. A settings file that does not parse holds no flag boot can read
 * or write, so it too reads `unavailable`, beside its error.
 * @param {string} cwd
 * @returns {import('./settings.cjs').SettingsSync & {status: GateSurface}}
 */
function syncGateSurface(cwd) {
  if (settingsHeld() || !modApplies(cwd)) return { changed: false, status: 'unavailable' };
  const sync = enableFunctionHooks(cwd);
  if (gateSurfaceAnnounced()) return { ...sync, status: 'on' };
  if (sync.changed) return { ...sync, status: 'restart' };
  return { ...sync, status: sync.error ? 'unavailable' : 'not-running' };
}

module.exports = { MOD_DIR, syncGateSurface };
