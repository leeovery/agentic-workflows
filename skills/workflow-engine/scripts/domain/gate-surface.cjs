'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the opt-in that lets the `workflow-gates`
// mod draw the engine's gates as buttons above the prompt instead of leaving
// the model to reproduce the menu. The answer is the project manifest's
// `defaults.gate_surface` boolean, a project opt-in (`project-opt-in.cjs`):
// absent means never asked, which is what workflow-start's one-time prompt
// keys on; a prose-test world stamps `false` so a walk never meets the
// question. The mod reads the answer at session start and announces itself
// to the engine only on `true`, so the manifest alone turns it on and off.
//
// Claude Code loads the mod only where function hooks are enabled, so a
// `true` also writes `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` into the
// project's committed `.claude/settings.json`, and every boot under a
// recorded `true` puts it back if it went. Nothing ever takes it out: the
// flag turns function hooks on for every plugin in the project, so a
// recorded `false`, like a project never asked, leaves it as it is.
// ---------------------------------------------------------------------------

const { optInStatus, recordOptIn } = require('./project-opt-in.cjs');
const { isObject, readProjectSettings, writeProjectSettings } = require('./settings.cjs');

/** Claude Code's early-access switch — the mod loads only where it is set. */
const FUNCTION_HOOKS_ENV = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const FUNCTION_HOOKS_ON = '1';

/**
 * Ensure `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is `"1"` in the project's
 * `.claude/settings.json`, every other env key and every other setting
 * standing. A settings file that does not parse is left untouched and
 * reported rather than thrown: neither caller may fail over plumbing it
 * cannot read.
 * @param {string} cwd
 * @returns {import('./project-opt-in.cjs').SettingsSync}
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

/** @type {import('./project-opt-in.cjs').ProjectOptIn} */
const GATE_SURFACE = {
  key: 'gate_surface',
  sync: (cwd, value) => (value ? enableFunctionHooks(cwd) : { changed: false }),
  unsynced: 'gate surface not synced',
  message: 'chore: record gate-surface choice',
};

/**
 * workflow-start's one-time answer, recorded and committed confined.
 * @param {string} cwd @param {boolean} value
 */
function recordGateSurfaceChoice(cwd, value) {
  return recordOptIn(cwd, GATE_SURFACE, value);
}

/**
 * Boot's report for workflow-start's one-time prompt.
 * @param {string} cwd
 * @returns {'on'|'off'|'prompt'}
 */
function gateSurfaceStatus(cwd) {
  return optInStatus(cwd, GATE_SURFACE.key);
}

module.exports = { gateSurfaceStatus, enableFunctionHooks, recordGateSurfaceChoice };
