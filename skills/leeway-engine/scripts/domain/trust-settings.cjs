'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ask rule's settings (16.4.6, 16.4.7, 16.13.7, 16.20.1) —
// the defaults the release ships, each a named constant, the procedure's own
// (16.16.1); and the person's settings over them, read from the settings
// file in the system config directory, `config.json`, under its `trust` key,
// beside the knowledge base's: the threshold, a fraction, and its raise
// mid-build where a question blocks build work, null until the person picks
// one (16.4.7). It only reads: the person's pick from a replay writes them
// (16.15). A settings file that does not read as JSON, or a `trust` key
// holding no setting's value, is refused, naming the file; a key under it no
// setting of this engine's names is another release's, and passed over.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { SETTINGS_FILE, systemConfigDir } = require('../kernel/system-config.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');

// 16.20.1's defaults.
const THRESHOLD = 0.2;
// Factors of the threshold: where a change would be hard to undo (16.4.8),
// and where a quiet kind asks again (16.6.1).
const HARD_TO_UNDO = 0.5;
const ASK_AGAIN = 1.25;
const PERCENTILE = 0.95;
// In answers' weight (16.14.3).
const PRIOR_CAP = 10;
const AGED_AFTER_MS = 183 * 24 * 60 * 60 * 1000;
const AGED_WEIGHT = 0.5;
const INHERITED_WEIGHT = 0.5;
// The share of Claude's silent calls drawn as blind questions (16.17.3), and
// the share while a count's range is wide: while it holds fewer than
// WIDE_UNTIL answers of the project's own at the session's model (16.17.9).
const BLIND_SHARE = 0.1;
const WIDE_BLIND_SHARE = 0.2;
const WIDE_UNTIL = 20;
// How many of a kind's latest answers a blind question's reveal compares
// Claude's picks with (16.17.7, P9).
const REVEAL_LAST = 25;
// How many agreements in a row in a topic Claude offers to settle the rest
// after (16.8.1, P13).
const CONVERGENCE_RUN = 8;

// The settings file's key the ask rule's settings sit under.
const TRUST = 'trust';

/**
 * The person's settings: the threshold, and its raise mid-build, null until
 * picked.
 * @typedef {{threshold: number, build_threshold: number|null}} Settings
 */

/** What the release ships, the person having changed nothing. @type {Readonly<Settings>} */
const DEFAULTS = Object.freeze({ threshold: THRESHOLD, build_threshold: null });

/** Whether `value` is a threshold: a fraction above none and below all. @param {unknown} value */
const isRate = (value) => typeof value === 'number' && value > 0 && value < 1;

/** What each setting may hold. @type {Readonly<Record<keyof Settings, {test: (value: unknown) => boolean, is: string}>>} */
const SETTINGS = Object.freeze({
  threshold: { test: isRate, is: 'a fraction above 0 and below 1' },
  build_threshold: { test: (value) => value === null || isRate(value), is: 'null or a fraction above 0 and below 1' },
});

/** The settings file. */
const settingsPath = () => path.join(systemConfigDir(), SETTINGS_FILE);

/**
 * The settings file's `trust` key, or none where the file or the key is
 * missing. Refuses a file that does not read as a JSON object.
 * @param {string} file
 * @returns {Record<string, unknown>|undefined}
 */
function trustKeyOf(file) {
  if (!fs.existsSync(file)) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the settings file ${file} does not read — ${messageOf(err)}: the ask rule's settings are under its ${TRUST} key`);
  }
  if (!isObject(parsed)) throw new Error(`the settings file ${file} holds no JSON object — the ask rule's settings are under its ${TRUST} key`);
  if (parsed[TRUST] !== undefined && !isObject(parsed[TRUST])) throw new Error(`the settings file ${file}'s ${TRUST} key is not an object of the ask rule's settings`);
  return /** @type {Record<string, unknown>|undefined} */ (parsed[TRUST]);
}

/**
 * The person's settings, each the default where they set none. Refuses a
 * settings file that does not read, and a setting holding what it cannot.
 * @returns {Settings}
 */
function trustSettings() {
  const file = settingsPath();
  const given = trustKeyOf(file) ?? {};
  const settings = { ...DEFAULTS };
  for (const name of /** @type {(keyof Settings)[]} */ (Object.keys(SETTINGS))) {
    if (!Object.hasOwn(given, name)) continue;
    if (!SETTINGS[name].test(given[name])) throw new Error(`the settings file ${file}'s ${TRUST}.${name} is not ${SETTINGS[name].is}: ${JSON.stringify(given[name])}`);
    settings[name] = /** @type {any} */ (given[name]);
  }
  return settings;
}

module.exports = {
  THRESHOLD, HARD_TO_UNDO, ASK_AGAIN, PERCENTILE, PRIOR_CAP, AGED_AFTER_MS, AGED_WEIGHT, INHERITED_WEIGHT, BLIND_SHARE, WIDE_BLIND_SHARE, WIDE_UNTIL, REVEAL_LAST, DEFAULTS, trustSettings,
  CONVERGENCE_RUN,
};
