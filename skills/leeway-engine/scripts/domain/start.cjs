'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the leeway detail — what the start skill's sub-views read
// (projections/start.cjs): the units in progress by type, for manage's list;
// the completed and the cancelled ones, for the view; and the inbox, live
// and archived, for triage. Pure over the project's state: same files, same
// answer. The start menu reads the project itself (start-menu.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadActiveManifests, loadAllManifests } = require('./reads.cjs');
const { INBOX, ARCHIVED } = require('./inbox.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { lastCompletedPhase } = require('./derivations.cjs');
const { VALID_PHASES, LEGACY_PHASES } = require('../kernel/manifest-schema.cjs');

// Every pipeline phase across all work types, the old plan's planning after
// the spec — the closed-unit last-phase scan.
const ALL_PHASES = VALID_PHASES.filter((p) => p !== 'discovery').flatMap((p) => (p === 'specification' ? [p, ...LEGACY_PHASES] : [p]));

/** @typedef {{name: string, work_type: string}} WorkUnitEntry */

/** @typedef {{work_units: WorkUnitEntry[]}} TypeGroup */

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
 * @property {string} path  absolute
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
 * @typedef {object} StartDetail
 * @property {TypeGroup} epics
 * @property {TypeGroup} features  a retired type's units among them
 * @property {TypeGroup} bugfixes
 * @property {TypeGroup} quick_fixes
 * @property {ClosedEntry[]} completed
 * @property {ClosedEntry[]} cancelled
 * @property {InboxDetail} inbox
 */

/** An inbox item's title: its content's first markdown H1, or null. @param {string} content @returns {string|null} */
function titleOf(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** The title of the file at `filePath`, or null. @param {string} filePath @returns {string|null} */
function readTitle(filePath) {
  try {
    return titleOf(fs.readFileSync(filePath, 'utf8'));
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
      const item = { slug: parsed.slug, date: parsed.date, title, file: f, path: path.join(dir, f) };
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
  const inbox = scanInboxDir(statePath(cwd, INBOX));
  return { ...inbox, archived: scanInboxDir(statePath(cwd, ARCHIVED)) };
}

/** The group each type of unit in progress is listed in; a type not here, retired by the reshape, with the features. @type {Readonly<Record<string, 'epics'|'bugfixes'|'quick_fixes'>>} */
const GROUP_OF = Object.freeze({ epic: 'epics', bugfix: 'bugfixes', 'quick-fix': 'quick_fixes' });

/** A closed unit as the view lists it. @param {Record<string, any>} m @returns {ClosedEntry} */
const closedEntry = (m) => ({ name: m.name, work_type: m.work_type, status: m.status, last_phase: lastCompletedPhase(m, ALL_PHASES) });

/**
 * The leeway detail for one project (the header's).
 * @param {string} cwd
 * @returns {StartDetail}
 */
function startDetail(cwd) {
  /** @type {Record<'epics'|'features'|'bugfixes'|'quick_fixes', TypeGroup>} */
  const groups = { epics: { work_units: [] }, features: { work_units: [] }, bugfixes: { work_units: [] }, quick_fixes: { work_units: [] } };
  for (const m of loadActiveManifests(cwd)) groups[GROUP_OF[m.work_type] ?? 'features'].work_units.push({ name: m.name, work_type: m.work_type });
  const all = loadAllManifests(cwd);
  return {
    ...groups,
    completed: all.filter((m) => m.status === 'completed').map(closedEntry),
    cancelled: all.filter((m) => m.status === 'cancelled').map(closedEntry),
    inbox: discoverInbox(cwd),
  };
}

module.exports = { startDetail, discoverInbox, titleOf };
