'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a project opt-in — a yes/no workflow-start asks once per
// project, recorded as a boolean under the project manifest's `defaults`,
// whose effect lives in the project's committed `.claude/settings.json`.
// The session labels (`tmux_labels`) and the gate surface (`gate_surface`)
// are two. Each brings its own settings sync, warning and commit message;
// this module owns what they share: the read (absent means never asked),
// the status boot reports, and the record — the answer, its sync, and one
// confined commit.
// ---------------------------------------------------------------------------

const { readProjectManifest, withProjectLock, writeProjectManifestAtomic } = require('../kernel/manifest.cjs');
const { commitTailPathspec, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { SETTINGS_SPEC, isObject } = require('./settings.cjs');

/** @typedef {{changed: boolean, error?: string}} SettingsSync */

/**
 * @typedef {object} ProjectOptIn
 * @property {string} key the `defaults` key the answer is recorded under
 * @property {(cwd: string, value: boolean) => SettingsSync} sync brings the
 *   project's settings in line with an answer
 * @property {string} unsynced the warning's lead when the sync could not
 *   read the settings file
 * @property {string} message the record's commit subject
 */

/**
 * The recorded answer — `defaults[key]` when it is a boolean; null when
 * never asked, or when the project manifest is absent, unreadable, or
 * carries no defaults. Corruption surfaces loudly at the next manifest
 * write, never here: boot and every label call must stay usable.
 * @param {string} cwd @param {string} key
 * @returns {boolean|null}
 */
function optInValue(cwd, key) {
  /** @type {unknown} */
  let manifest;
  try {
    manifest = readProjectManifest(cwd);
  } catch {
    return null;
  }
  const value = isObject(manifest) && isObject(manifest.defaults) ? manifest.defaults[key] : undefined;
  return typeof value === 'boolean' ? value : null;
}

/**
 * Boot's report for workflow-start's one-time prompt: `on`/`off`
 * (recorded), `prompt` (never asked).
 * @param {string} cwd @param {string} key
 * @returns {'on'|'off'|'prompt'}
 */
function optInStatus(cwd, key) {
  const value = optInValue(cwd, key);
  if (value === null) return 'prompt';
  return value ? 'on' : 'off';
}

/**
 * workflow-start's one-time answer: record it under the project manifest's
 * `defaults`, every other key preserved, then run the opt-in's sync, and
 * commit the two together, confined — the settings file only when the sync
 * changed it. Each write holds the project lock on its own, never nested:
 * the lock is a file lock, not reentrant. A manifest that does not parse
 * refuses loudly through the kernel read, before anything is written:
 * silently replacing it would drop every registered work unit. After the
 * record the answer stands: a settings file the sync could not read, or a
 * commit git refused, comes back as a warning.
 * @param {string} cwd @param {ProjectOptIn} optIn @param {boolean} value
 * @returns {Record<string, boolean|string[]>}
 */
function recordOptIn(cwd, optIn, value) {
  withProjectLock(cwd, () => {
    const manifest = readProjectManifest(cwd);
    const defaults = isObject(manifest.defaults) ? manifest.defaults : {};
    manifest.defaults = { ...defaults, [optIn.key]: value };
    writeProjectManifestAtomic(cwd, manifest);
  });
  /** @type {string[]} */
  const warnings = [];
  const specs = [PROJECT_MANIFEST_SPEC];
  const sync = withProjectLock(cwd, () => optIn.sync(cwd, value));
  if (sync.error) warnings.push(`${optIn.unsynced}: ${sync.error}`);
  if (sync.changed) specs.push(SETTINGS_SPEC);
  commitTailPathspec(cwd, specs, optIn.message, warnings);
  return warnings.length > 0 ? { [optIn.key]: value, warnings } : { [optIn.key]: value };
}

module.exports = { optInValue, optInStatus, recordOptIn };
