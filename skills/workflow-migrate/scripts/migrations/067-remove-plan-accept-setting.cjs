'use strict';

//
// Migration 067: Remove the plan-mode setting from the project's settings
//
// Migration 034 set `showClearContextOnPlanAccept: true` in the project's
// `.claude/settings.json` — plan mode's option to clear context on approving
// a plan, which carried the work from one phase to the next. The workflows
// no longer use plan mode, so where the key reads `true`, the value 034
// wrote, it is removed; a `false` is the project's own and stands.
// Everything else in the file stands, in the format the engine writes
// settings in.
//
// Where the project's last commit already carried the key set `true`, the
// person may have kept it for plan mode of their own, so the run hands back
// a notice saying it was removed and how to add it back. A new project,
// whose key 034 wrote moments earlier in the same run, loses it silently, as
// does a project with no history to read: outside a git work tree, or before
// a first commit.
//
// A file that is absent or does not parse holds nothing to remove.
//
// Idempotent: once removed, there is no key left to remove.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SETTINGS = '.claude/settings.json';
const KEY = 'showClearContextOnPlanAccept';

const NOTICE = `Removed \`${KEY}\` from \`${SETTINGS}\` — the workflows no longer use plan mode. `
  + `Add \`"${KEY}": true\` back if you want plan mode's option to clear context when you approve a plan.`;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Settings text parsed, or null where it does not parse to an object.
 * @param {string} text
 * @returns {Record<string, any>|null}
 */
function parseSettings(text) {
  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Whether the project's last commit carried the key set `true` — read
 * relative to the project, so a project inside a larger repository reads
 * its own file.
 * @param {string} projectDir
 * @returns {boolean}
 */
function committedOn(projectDir) {
  const res = spawnSync('git', ['show', `HEAD:./${SETTINGS}`], { cwd: projectDir, encoding: 'utf8' });
  if (res.error || res.status !== 0) return false;
  const committed = parseSettings(res.stdout);
  return committed !== null && committed[KEY] === true;
}

module.exports = {
  id: '067',
  description: 'remove the plan-mode setting the workflows no longer use from the project settings',
  run({ projectDir, reportUpdate, reportSkip }) {
    const file = path.join(projectDir, SETTINGS);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      reportSkip();
      return;
    }
    const settings = parseSettings(text);
    if (!settings || settings[KEY] !== true) {
      reportSkip();
      return;
    }
    delete settings[KEY];
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
    reportUpdate();
    return committedOn(projectDir) ? { notice: NOTICE } : undefined;
  },
};
