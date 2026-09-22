'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's committed Claude Code settings
// (`.claude/settings.json`) — the one file two opt-ins keep in sync, the
// session hooks (`session-label.cjs`) and the gate surface's function-hook
// flag (`gate-surface.cjs`). Reading is tolerant by contract: an absent file
// is an empty document, and one that does not parse is reported rather than
// thrown, because neither opt-in may fail over plumbing it cannot read. Each
// caller reconciles its own keys and leaves every other one standing.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');

/** The settings file, as a pathspec — what a confined commit names. */
const SETTINGS_SPEC = '.claude/settings.json';

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * The project's settings: the parsed document, and the reason it could not
 * be read where it could not. An absent file reads `{}` — the first-write
 * state — as does an unreadable one, which every caller refuses on `error`
 * before touching it.
 * @param {string} cwd
 * @returns {{settings: Record<string, any>, error?: string}}
 */
function readProjectSettings(cwd) {
  const file = path.join(cwd, SETTINGS_SPEC);
  if (!fs.existsSync(file)) return { settings: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isObject(parsed)) throw new Error('root is not an object');
    return { settings: parsed };
  } catch (err) {
    return { settings: {}, error: `${SETTINGS_SPEC} is not valid JSON — ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Write the settings document whole, its directory made first — the
 * kernel's atomic write, so a reader never meets a half-written file.
 * @param {string} cwd @param {Record<string, any>} settings
 */
function writeProjectSettings(cwd, settings) {
  const file = path.join(cwd, SETTINGS_SPEC);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, settings);
}

module.exports = { SETTINGS_SPEC, isObject, readProjectSettings, writeProjectSettings };
