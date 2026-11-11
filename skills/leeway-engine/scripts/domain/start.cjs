'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the leeway detail — what the start skill's sub-views read
// (projections/start.cjs): the inbox, live and archived, for triage. Pure
// over the project's state: same files, same answer. The start menu reads
// the project itself (start-menu.cjs), and manage and the closed units
// theirs (projections/manage.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { INBOX, ARCHIVED } = require('./inbox.cjs');
const { statePath } = require('../kernel/state-root.cjs');

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

/** @typedef {{inbox: InboxDetail}} StartDetail */

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

/**
 * The leeway detail for one project (the header's).
 * @param {string} cwd
 * @returns {StartDetail}
 */
function startDetail(cwd) {
  return { inbox: discoverInbox(cwd) };
}

module.exports = { startDetail, discoverInbox, titleOf };
