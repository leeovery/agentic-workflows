'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the `workflow-gates` mod, part of the
// workflows, which draws the engine's gates as buttons above the prompt
// instead of leaving the model to reproduce the menu. Claude Code loads the
// mod only where function hooks are enabled, so every boot puts
// `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` into the project's committed
// `.claude/settings.json` where it is missing. Nothing ever takes it out: the
// flag turns function hooks on for every plugin in the project, and it can
// come from the user's own settings or the shell as well, so the file cannot
// say whether the mod is running. The mod says so itself: it announces the
// gate surface at session start, and every command the session runs
// inherits the announcement.
// ---------------------------------------------------------------------------

const { gateSurfaceAnnounced } = require('./projections/surfaces.cjs');
const { isObject, readProjectSettings, settingsHeld, writeProjectSettings } = require('./settings.cjs');

/** Claude Code's early-access switch — the mod loads only where it is set. */
const FUNCTION_HOOKS_ENV = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const FUNCTION_HOOKS_ON = '1';

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
  if (settingsHeld()) return { changed: false };
  const read = readProjectSettings(cwd);
  if (read.error) return { changed: false, error: read.error };
  const settings = read.settings;
  const env = isObject(settings.env) ? settings.env : {};
  if (env[FUNCTION_HOOKS_ENV] === FUNCTION_HOOKS_ON) return { changed: false };
  writeProjectSettings(cwd, { ...settings, env: { ...env, [FUNCTION_HOOKS_ENV]: FUNCTION_HOOKS_ON } });
  return { changed: true };
}

/**
 * Boot's report: `on` where the mod is running — its announcement in this
 * process's environment; `restart` where this boot wrote the flag and the
 * mod is not running, since Claude Code reads its settings only at startup;
 * `off` otherwise — a Claude Code without function hooks, or a flag that
 * arrived mid-session.
 * @param {boolean} wrote this boot wrote the flag
 * @returns {'on'|'restart'|'off'}
 */
function gateSurfaceStatus(wrote) {
  if (gateSurfaceAnnounced()) return 'on';
  return wrote ? 'restart' : 'off';
}

module.exports = { FUNCTION_HOOKS_ENV, enableFunctionHooks, gateSurfaceStatus };
