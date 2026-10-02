'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the `workflow-gates` mod, part of the
// workflows, which draws the engine's gates as buttons above the prompt
// instead of leaving the model to reproduce the menu. It runs only in
// Claude Code's terminal app, from 2.1.287, in a project that installed it,
// and there Claude Code loads it by default. Boot reads where it stands and
// writes nothing for it: a terminal app older than the mod is reported
// outdated, and everywhere else the workflows carry on with the text menus.
// Whether the mod is running, the mod says itself: it announces the gate
// surface at session start, and every command the session runs inherits the
// announcement.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { gateSurfaceAnnounced } = require('./projections/surfaces.cjs');

/** Where an install puts the mod, relative to the project root. */
const MOD_DIR = path.join('.claude', 'skills', 'workflow-gates');

/** The oldest Claude Code the mod runs on. */
const MIN_VERSION = [2, 1, 287];

/** @typedef {'on'|'not-running'|'outdated'|'unavailable'} GateSurface */

/**
 * The running Claude Code's version, read off the agent identity it hands
 * every command (`AI_AGENT=claude-code_2-1-287_agent`); null where that is
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
 * Where the mod stands, for boot's report: `unavailable` outside Claude
 * Code's terminal app — on the web, another entrypoint — in a project that
 * did not install it, or at a version that does not read; `outdated` at a
 * release before the mod's. Where it can run, `on` where it is running, its
 * announcement in this process's environment, and `not-running` where it is
 * not.
 * @param {string} cwd
 * @returns {GateSurface}
 */
function gateSurface(cwd) {
  if (process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_CODE_ENTRYPOINT !== 'cli') return 'unavailable';
  if (!fs.existsSync(path.join(cwd, MOD_DIR))) return 'unavailable';
  const version = claudeCodeVersion(process.env.AI_AGENT);
  if (!version) return 'unavailable';
  if (!supported(version)) return 'outdated';
  return gateSurfaceAnnounced() ? 'on' : 'not-running';
}

module.exports = { MOD_DIR, gateSurface };
