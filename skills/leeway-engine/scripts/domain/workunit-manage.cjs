'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the manage detail — one work unit's lifecycle-action
// availability, computed for the manage action menu. Which actions the menu
// offers is the unit's state (work type, phase presence, whether it is past
// its spec, implementation completion, a build by its cut, in-progress epics
// before their spec for absorption), so it is derived here, in one place,
// never re-derived by the session. Pure over the project's
// state: same files, same answer.
// ---------------------------------------------------------------------------

const { loadManifest, loadActiveManifests } = require('./reads.cjs');
const { phaseItems, buildByCut } = require('./derivations.cjs');
const { pastItsSpec } = require('./spec-standing.cjs');

/**
 * @typedef {object} ManageDetail
 * @property {string} work_unit
 * @property {string} work_type
 * @property {string} status
 * @property {boolean} implementation_completed  any implementation item completed → `done` offered
 * @property {boolean} has_build                 a build by its cut → `view-build` offered (12.12.11)
 * @property {boolean} has_spec                  past its spec, written or concluded (absorb guard)
 * @property {boolean} has_discussion            discussion phase present (absorb guard)
 * @property {string[]} available_epics          in-progress epic names before their spec — absorb targets
 * @property {boolean} absorb_available          feature, no spec, has discussion, ≥1 epic target
 */

/** @param {object} manifest @param {string} phase */
function phasePresent(manifest, phase) {
  return Object.prototype.hasOwnProperty.call(manifest.phases || {}, phase);
}

/**
 * Build the manage detail for one work unit.
 * @param {string} cwd
 * @param {string} workUnit
 * @returns {ManageDetail|null} null when the manifest is missing or unreadable
 */
function manageDetail(cwd, workUnit) {
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) return null;

  const workType = manifest.work_type || 'feature';
  const hasSpec = pastItsSpec(cwd, manifest);
  const hasDiscussion = phasePresent(manifest, 'discussion');
  const availableEpics = loadActiveManifests(cwd)
    .filter((m) => m.work_type === 'epic' && m.name !== workUnit && !pastItsSpec(cwd, m))
    .map((m) => m.name);

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    implementation_completed: phaseItems(manifest, 'implementation').some((i) => i.status === 'completed'),
    has_build: buildByCut(manifest),
    has_spec: hasSpec,
    has_discussion: hasDiscussion,
    available_epics: availableEpics,
    absorb_available: workType === 'feature' && !hasSpec && hasDiscussion && availableEpics.length > 0,
  };
}

module.exports = { manageDetail };
