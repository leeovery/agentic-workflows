'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the workflow-start detail — the one structured object the
// start overview, menu, and reasoning surfaces derive from.
//
// Collates every active work unit by type (with next-phase state), the inbox
// (live and archived), and the completed/cancelled sets. Pure over the
// project's `.workflows/` tree: same files, same answer. Shared manifest
// semantics come from domain/reads and domain/derivations — never duplicated
// here.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, loadAllManifests } = require('./reads.cjs');
const {
  phaseStatus,
  phaseItems,
  computeNextPhase,
  computeInProgressPhases,
} = require('./derivations.cjs');

const EPIC_PHASES = ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];

const ALL_PHASES = ['research', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review'];

/**
 * @typedef {object} WorkUnitEntry
 * @property {string} name
 * @property {string} next_phase
 * @property {string} phase_label
 * @property {boolean} finalising        pipeline finished (`next_phase: done`), no phase in
 *                                       flight, but the unit is still in-progress — `workunit
 *                                       complete` never ran
 * @property {string[]} [active_phases]  epics only — phases that have items
 */

/**
 * @typedef {object} TypeGroup
 * @property {WorkUnitEntry[]} work_units
 * @property {number} count
 */

/**
 * @typedef {object} ClosedEntry
 * @property {string} name
 * @property {string} work_type
 * @property {string} status
 * @property {string|null} last_phase
 */

/**
 * @typedef {object} InboxItem
 * @property {string} slug
 * @property {string} date
 * @property {string} title
 * @property {string} file
 */

/**
 * @typedef {object} InboxScan
 * @property {InboxItem[]} ideas
 * @property {InboxItem[]} bugs
 * @property {InboxItem[]} quickfixes
 * @property {number} idea_count
 * @property {number} bug_count
 * @property {number} quickfix_count
 * @property {number} total_count
 */

/** @typedef {InboxScan & {archived: InboxScan}} InboxDetail */

/**
 * @typedef {object} StartState
 * @property {boolean} has_any_work
 * @property {number} epic_count
 * @property {number} feature_count
 * @property {number} bugfix_count
 * @property {number} quickfix_count
 * @property {number} cross_cutting_count
 * @property {boolean} has_inbox
 * @property {number} inbox_count
 * @property {boolean} has_archived
 * @property {number} archived_count
 */

/**
 * @typedef {object} StartDetail
 * @property {TypeGroup} epics
 * @property {TypeGroup} features
 * @property {TypeGroup} bugfixes
 * @property {TypeGroup} quick_fixes
 * @property {TypeGroup} cross_cutting
 * @property {ClosedEntry[]} completed
 * @property {ClosedEntry[]} cancelled
 * @property {number} completed_count
 * @property {number} cancelled_count
 * @property {InboxDetail} inbox
 * @property {StartState} state
 */

/**
 * Last phase with a completed item (epic) or completed aggregate status
 * (single-topic types), in pipeline order. Null when nothing completed.
 * @param {object} manifest
 * @returns {string|null}
 */
function lastCompletedPhase(manifest) {
  let last = null;
  if (manifest.work_type === 'epic') {
    for (const phase of ALL_PHASES) {
      const items = phaseItems(manifest, phase);
      if (items.length > 0 && items.some(i => i.status === 'completed')) {
        last = phase;
      }
    }
  } else {
    for (const phase of ALL_PHASES) {
      const s = phaseStatus(manifest, phase);
      if (s === 'completed') last = phase;
    }
  }
  return last;
}

/** First markdown H1, or null. @param {string} filePath @returns {string|null} */
function readTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/** Parse `YYYY-MM-DD--slug.md`, or null on a non-conforming name. @param {string} filename @returns {{date: string, slug: string}|null} */
function parseInboxFile(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})--(.+)\.md$/);
  if (!match) return null;
  return { date: match[1], slug: match[2] };
}

/**
 * Scan one inbox layout root (`{ideas,bugs,quickfixes}/` beneath it).
 * @param {string} baseDir
 * @returns {InboxScan}
 */
function scanInboxDir(baseDir) {
  /** @type {InboxItem[]} */
  const ideas = [];
  /** @type {InboxItem[]} */
  const bugs = [];
  /** @type {InboxItem[]} */
  const quickfixes = [];

  for (const type of ['ideas', 'bugs', 'quickfixes']) {
    const dir = path.join(baseDir, type);
    /** @type {string[]} */
    let files;
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    } catch {
      files = [];
    }
    for (const f of files) {
      const parsed = parseInboxFile(f);
      if (!parsed) continue;
      const title = readTitle(path.join(dir, f)) || parsed.slug;
      const item = { slug: parsed.slug, date: parsed.date, title, file: f };
      if (type === 'ideas') ideas.push(item);
      else if (type === 'bugs') bugs.push(item);
      else quickfixes.push(item);
    }
  }

  return {
    ideas,
    bugs,
    quickfixes,
    idea_count: ideas.length,
    bug_count: bugs.length,
    quickfix_count: quickfixes.length,
    total_count: ideas.length + bugs.length + quickfixes.length,
  };
}

/**
 * Live inbox plus the `.archived/` store nested beneath it.
 * @param {string} cwd
 * @returns {InboxDetail}
 */
function discoverInbox(cwd) {
  const inboxDir = path.join(cwd, '.workflows', '.inbox');
  const inbox = scanInboxDir(inboxDir);
  return { ...inbox, archived: scanInboxDir(path.join(inboxDir, '.archived')) };
}

/**
 * Build the full workflow-start detail for one project.
 * @param {string} cwd  project root (the directory containing `.workflows/`)
 * @returns {StartDetail}
 */
function startDetail(cwd) {
  const manifests = loadActiveManifests(cwd);
  /** @type {WorkUnitEntry[]} */
  const epics = [];
  /** @type {WorkUnitEntry[]} */
  const features = [];
  /** @type {WorkUnitEntry[]} */
  const bugfixes = [];
  /** @type {WorkUnitEntry[]} */
  const quick_fixes = [];
  /** @type {WorkUnitEntry[]} */
  const cross_cutting = [];

  for (const m of manifests) {
    const state = computeNextPhase(m);

    // A finished pipeline on a still-in-progress unit is surfaced, never
    // hidden: the unit sat between the last topic completion and `workunit
    // complete` when the flow stopped, and finalising is its only way out.
    // But a reopened earlier phase means the unit is mid-revisit, not
    // finalising — the phase in flight is the next action. (ALL_PHASES is
    // safe across types: phases outside a type's pipeline have no items.)
    let nextPhase = state.next_phase;
    let phaseLabel = state.phase_label;
    if (nextPhase === 'done') {
      const inProgress = computeInProgressPhases(m, ALL_PHASES);
      if (inProgress.length > 0) {
        nextPhase = inProgress[0];
        phaseLabel = `${inProgress[0]} (in-progress)`;
      }
    }
    /** @type {WorkUnitEntry} */
    const unit = {
      name: m.name,
      next_phase: nextPhase,
      phase_label: phaseLabel,
      finalising: nextPhase === 'done',
    };

    if (m.work_type === 'epic') {
      // For epics, include list of phases that have items
      const activePhases = [];
      for (const phase of EPIC_PHASES) {
        const items = phaseItems(m, phase);
        if (items.length > 0) {
          activePhases.push(phase);
        }
      }
      unit.active_phases = activePhases;
      epics.push(unit);
    } else if (m.work_type === 'bugfix') {
      bugfixes.push(unit);
    } else if (m.work_type === 'quick-fix') {
      quick_fixes.push(unit);
    } else if (m.work_type === 'cross-cutting') {
      cross_cutting.push(unit);
    } else {
      features.push(unit);
    }
  }

  // Load completed/cancelled work units across all types
  const allManifests = loadAllManifests(cwd);
  /** @type {ClosedEntry[]} */
  const completed = [];
  /** @type {ClosedEntry[]} */
  const cancelled = [];

  for (const m of allManifests) {
    if (m.status === 'completed') {
      completed.push({ name: m.name, work_type: m.work_type, status: m.status, last_phase: lastCompletedPhase(m) });
    } else if (m.status === 'cancelled') {
      cancelled.push({ name: m.name, work_type: m.work_type, status: m.status, last_phase: lastCompletedPhase(m) });
    }
  }

  const inbox = discoverInbox(cwd);

  return {
    epics: { work_units: epics, count: epics.length },
    features: { work_units: features, count: features.length },
    bugfixes: { work_units: bugfixes, count: bugfixes.length },
    quick_fixes: { work_units: quick_fixes, count: quick_fixes.length },
    cross_cutting: { work_units: cross_cutting, count: cross_cutting.length },
    completed,
    cancelled,
    completed_count: completed.length,
    cancelled_count: cancelled.length,
    inbox,
    state: {
      has_any_work: (epics.length + features.length + bugfixes.length + quick_fixes.length + cross_cutting.length) > 0,
      epic_count: epics.length,
      feature_count: features.length,
      bugfix_count: bugfixes.length,
      quickfix_count: quick_fixes.length,
      cross_cutting_count: cross_cutting.length,
      has_inbox: inbox.total_count > 0,
      inbox_count: inbox.total_count,
      has_archived: inbox.archived.total_count > 0,
      archived_count: inbox.archived.total_count,
    },
  };
}

module.exports = { startDetail };
