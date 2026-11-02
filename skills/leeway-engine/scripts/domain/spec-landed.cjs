'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the landed spec — the unit's `spec.md` as the state branch
// holds it, committed by `spec land`. Ready to build stands on that text
// alone (11.8.1): its close seals it, its screen draws its outline from it,
// and the close, the screen and the yes each refuse while the file on disk
// differs from it, or none has landed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { SPEC_FILE, specPath } = require('./spec-sections.cjs');

/** The unit's spec as it last landed, or null where none has. @param {string} cwd @param {string} unit @returns {string|null} */
function landedSpec(cwd, unit) {
  return isolatedGit(stateRoot(cwd)).tryRun(['show', `HEAD:${unit}/${SPEC_FILE}`]);
}

/**
 * Why `landed`, the unit's spec as it last landed, is not the one on disk,
 * or null: none has landed, or the file holds changes that have not.
 * @param {string} cwd @param {string} unit @param {string|null} landed @returns {string|null}
 */
function refusalOf(cwd, unit, landed) {
  if (landed === null) return `${unit}'s spec has not landed — land it: spec land ${unit}`;
  const file = specPath(cwd, unit);
  const disk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  return disk === landed ? null : `${unit}'s spec has changes that haven't landed — land them: spec land ${unit}`;
}

/**
 * Why the unit's landed spec is not the one on disk, or null: none has
 * landed, or the file holds changes that have not.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function unlandedRefusal(cwd, unit) {
  return refusalOf(cwd, unit, landedSpec(cwd, unit));
}

/** The unit's landed spec, refused while it is not the one on disk. @param {string} cwd @param {string} unit @returns {string} */
function readLandedSpec(cwd, unit) {
  const landed = landedSpec(cwd, unit);
  const refused = refusalOf(cwd, unit, landed);
  if (refused !== null) throw new Error(refused);
  return /** @type {string} */ (landed);
}

module.exports = { landedSpec, unlandedRefusal, readLandedSpec };
