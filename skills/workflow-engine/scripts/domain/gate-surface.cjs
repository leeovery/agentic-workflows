'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the gate surface — the opt-in that lets the `workflow-gates`
// mod draw the engine's gates as pressable rows above the prompt instead of
// leaving the model to reproduce the menu. Claude Code loads the mod only
// where function hooks are enabled for the project, so the opt-in drives one
// line: `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` in the project's committed
// `.claude/settings.json`.
//
// The choice is the project manifest's `defaults.gate_surface` boolean —
// absent means never asked, which is what workflow-start's one-time prompt
// keys on (boot reports it via `gateSurfaceStatus`); a prose-test world
// stamps `false` so a walk never meets the question. Per project by nature:
// no system config holds it, and no migration carries it.
//
// The flag is synced only against a recorded choice. A project that was
// never asked is left exactly as it is — the flag turns function hooks on
// for every plugin in the project, so one set by hand for something else is
// never ours to remove.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { commitTailPathspec, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { SETTINGS_SPEC, isObject, readProjectSettings, writeProjectSettings } = require('./settings.cjs');

/** Claude Code's early-access switch — the mod loads only where it is set. */
const FUNCTION_HOOKS_ENV = 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS';
const FUNCTION_HOOKS_ON = '1';

/**
 * The opt-in for this project — `defaults.gate_surface` when it is a
 * boolean; null when never asked, or when the project manifest is absent,
 * unreadable, or carries no defaults.
 * @param {string} cwd @returns {boolean|null}
 */
function resolveEnabled(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', 'manifest.json'), 'utf8'));
    const v = isObject(parsed) && isObject(parsed.defaults) ? parsed.defaults.gate_surface : undefined;
    if (typeof v === 'boolean') return v;
  } catch { /* no project manifest */ }
  return null;
}

/**
 * Record the opt-in as the project manifest's `defaults.gate_surface`,
 * every other key preserved — under the project lock, the manifest's own
 * atomic write. A manifest that does not parse refuses loudly through the
 * kernel read: silently replacing it would drop every registered work unit.
 * @param {string} cwd @param {boolean} value
 */
function setGateSurfaceConfig(cwd, value) {
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const defaults = isObject(manifest.defaults) ? manifest.defaults : {};
    manifest.defaults = { ...defaults, gate_surface: value };
    writeProjectManifestAtomic(cwd, manifest);
  });
}

/**
 * Ensure `env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` in the project's
 * `.claude/settings.json` matches the opt-in: `"1"` while on, the key gone
 * while off. Every other env key and every other setting stands, and an
 * `env` block emptied by the removal goes. A settings file that does not
 * parse is left untouched and reported rather than thrown: neither caller
 * may fail over plumbing it cannot read.
 * @param {string} cwd @param {boolean} enabled
 * @returns {{changed: boolean, error?: string}}
 */
function syncGateSurfaceFlag(cwd, enabled) {
  const read = readProjectSettings(cwd);
  if (read.error) return { changed: false, error: read.error };
  const settings = read.settings;
  const env = isObject(settings.env) ? settings.env : {};
  if (env[FUNCTION_HOOKS_ENV] === (enabled ? FUNCTION_HOOKS_ON : undefined)) return { changed: false };
  const nextEnv = { ...env };
  if (enabled) nextEnv[FUNCTION_HOOKS_ENV] = FUNCTION_HOOKS_ON;
  else delete nextEnv[FUNCTION_HOOKS_ENV];
  const next = { ...settings };
  if (Object.keys(nextEnv).length > 0) next.env = nextEnv;
  else delete next.env;
  writeProjectSettings(cwd, next);
  return { changed: true };
}

/**
 * workflow-start's one-time answer: record the opt-in, sync the flag to
 * match, and commit the two together, confined. The choice is recorded
 * either way: a settings file the sync could not read, or a commit git
 * refused, comes back as a warning — boot re-syncs, and the state is saved.
 * @param {string} cwd @param {boolean} value
 * @returns {{gate_surface: boolean, warnings?: string[]}}
 */
function recordGateSurfaceChoice(cwd, value) {
  setGateSurfaceConfig(cwd, value);
  /** @type {string[]} */
  const warnings = [];
  const specs = [PROJECT_MANIFEST_SPEC];
  // Sequential with setGateSurfaceConfig's own hold, never nested: the lock
  // is a file lock, not reentrant.
  const sync = withProjectLock(cwd, () => syncGateSurfaceFlag(cwd, value));
  if (sync.error) warnings.push(`gate surface not synced: ${sync.error}`);
  if (sync.changed) specs.push(SETTINGS_SPEC);
  commitTailPathspec(cwd, specs, 'chore: record gate-surface choice', warnings);
  return warnings.length > 0 ? { gate_surface: value, warnings } : { gate_surface: value };
}

/**
 * Boot's report for workflow-start's one-time prompt: `on`/`off` (recorded
 * on the project manifest), `prompt` (never asked).
 * @param {string} cwd
 * @returns {'on'|'off'|'prompt'}
 */
function gateSurfaceStatus(cwd) {
  const v = resolveEnabled(cwd);
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'prompt';
}

module.exports = { resolveEnabled, gateSurfaceStatus, syncGateSurfaceFlag, recordGateSurfaceChoice, FUNCTION_HOOKS_ENV };
