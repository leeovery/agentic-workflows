'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the inbox as its files hold it, live and archived — each
// folder's items with their dates and titles, read from their file names
// and their content — which triage reads (inbox-set.cjs). Pure over the
// project's state: same files, same answer.
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

module.exports = { discoverInbox, titleOf };
