'use strict';

// ---------------------------------------------------------------------------
// Kernel: the workflows' system config directory — one per user, beside no
// project: `LEEWAY_CONFIG_DIR` when set, else `~/.config/leeway` — and
// the settings file in it, which several parts share, each under a key of
// its own: the knowledge base's provider settings (knowledge/config.cjs),
// the ask rule's (trust-settings.cjs). A change merges into the file, every
// key it does not name kept as the file holds it, and never writes over a
// file that does not read as a JSON object.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isObject, writeJsonAtomic } = require('./manifest-io.cjs');
const { messageOf } = require('./call.cjs');

/** The settings file in the system config directory (knowledge/config.cjs). */
const SETTINGS_FILE = 'config.json';

/** @returns {string} */
function systemConfigDir() {
  return process.env.LEEWAY_CONFIG_DIR || path.join(os.homedir(), '.config', 'leeway');
}

/**
 * Set `values` under the settings file's key `key`, made where the file or
 * the key is missing: every other setting under it, and every other key, as
 * the file holds them. Refuses, writing nothing, a file that does not read
 * as a JSON object, or whose `key` holds no object.
 * @param {string} key @param {Record<string, unknown>} values
 */
function changeSettings(key, values) {
  const file = path.join(systemConfigDir(), SETTINGS_FILE);
  /** @type {Record<string, unknown>} */
  let held = {};
  if (fs.existsSync(file)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`the settings file ${file} does not read — ${messageOf(err)}: put it right, and nothing in it is written over`);
    }
    if (!isObject(parsed)) throw new Error(`the settings file ${file} holds no JSON object: put it right, and nothing in it is written over`);
    held = parsed;
  }
  const under = held[key] ?? {};
  if (!isObject(under)) throw new Error(`the settings file ${file}'s ${key} key holds no object: put it right, and nothing in it is written over`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { ...held, [key]: { ...under, ...values } });
}

module.exports = { SETTINGS_FILE, systemConfigDir, changeSettings };
