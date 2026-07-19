'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the manage detail — one work unit's lifecycle-action
// availability, computed for the manage action menu. Which actions the menu
// offers is manifest state (work type, phase presence, implementation
// completion, in-progress epics for absorption), so it is derived here, in one
// place, never re-derived by the session. Pure over the project's
// `.workflows/` tree: same files, same answer.
// ---------------------------------------------------------------------------

const { loadManifest, loadActiveManifests } = require('./reads.cjs');
const { phaseItems } = require('./derivations.cjs');

/**
 * @typedef {object} PlanningTopic
 * @property {string} name
 * @property {string} status
 */

/**
 * @typedef {object} ManageDetail
 * @property {string} work_unit
 * @property {string} work_type
 * @property {string} status
 * @property {boolean} implementation_completed  any implementation item completed → `done` offered
 * @property {boolean} has_plan                  planning phase present → `view-plan` offered
 * @property {boolean} has_spec                  specification phase present (absorb guard)
 * @property {boolean} has_discussion            discussion phase present (absorb guard)
 * @property {string[]} available_epics          in-progress epic names — absorb targets
 * @property {boolean} absorb_available          feature, no spec, has discussion, ≥1 epic target
 * @property {PlanningTopic[]} planning_topics   the view-plan topic choices (epics)
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
  const hasSpec = phasePresent(manifest, 'specification');
  const hasDiscussion = phasePresent(manifest, 'discussion');
  const availableEpics = loadActiveManifests(cwd)
    .filter((m) => m.work_type === 'epic' && m.name !== workUnit)
    .map((m) => m.name);

  return {
    work_unit: workUnit,
    work_type: workType,
    status: manifest.status,
    implementation_completed: phaseItems(manifest, 'implementation').some((i) => i.status === 'completed'),
    has_plan: phasePresent(manifest, 'planning'),
    has_spec: hasSpec,
    has_discussion: hasDiscussion,
    available_epics: availableEpics,
    absorb_available: workType === 'feature' && !hasSpec && hasDiscussion && availableEpics.length > 0,
    planning_topics: phaseItems(manifest, 'planning').map((i) => ({ name: i.name, status: i.status || 'in-progress' })),
  };
}

module.exports = { manageDetail };
