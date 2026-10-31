'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the files a log links (9.10.11) — the spikes and shared files
// a session's log points at, which nothing else links while nothing is
// decided, so a commit that takes the log takes them too (state-worktree.cjs).
//
// A link is a markdown link's target, `[text](target)` or `[text](<target>)`,
// its fragment and query dropped. It names a file or folder read from the
// log's own folder, as a reader of the log follows it, or failing that from
// the state root, as the asset verbs name one. It counts where what it names
// is on disk and sits below an asset home of the layout's, or is a spike's
// folder (layout.cjs); every other link — a web address, a file elsewhere in
// the state, a path out of it — is passed over.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { assetHome } = require('./layout.cjs');

const LINK = /\]\(\s*(?:<([^>]*)>|([^)\s]+))/g;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A link's target as a path, or null for a web address or an absolute path.
 * @param {string} target
 * @returns {string|null}
 */
function linkedPath(target) {
  const bare = target.replace(/[#?].*$/, '');
  if (bare === '' || SCHEME.test(bare) || bare.startsWith('/')) return null;
  try {
    return decodeURI(bare);
  } catch {
    return bare;
  }
}

/**
 * Where a link's path leads, state-relative and written plain: from the
 * log's folder, then from the state root — each only where it stays in the
 * state.
 * @param {string} log state-relative @param {string} linked
 * @returns {string[]}
 */
function readings(log, linked) {
  return [path.posix.join(path.posix.dirname(log), linked), path.posix.normalize(linked)]
    .map((rel) => rel.replace(/\/+$/, ''))
    .filter((rel) => rel !== '' && rel !== '.' && rel !== '..' && !rel.startsWith('../'));
}

/**
 * The files and folders the logs at `logs` link that sit in a spike or the
 * assets and are on disk, state-relative, each once; a log not on disk links
 * nothing.
 * @param {string} root the state root @param {string[]} logs state-relative
 * @returns {string[]}
 */
function logLinks(root, logs) {
  /** @type {Set<string>} */
  const linked = new Set();
  for (const log of logs) {
    let text;
    try {
      text = fs.readFileSync(path.join(root, log), 'utf8');
    } catch {
      continue;
    }
    for (const [, angled, plain] of text.matchAll(LINK)) {
      const target = linkedPath(angled ?? plain);
      if (target === null) continue;
      const at = readings(log, target).find((rel) => assetHome(rel) !== null && fs.existsSync(path.join(root, rel)));
      if (at !== undefined) linked.add(at);
    }
  }
  return [...linked];
}

module.exports = { logLinks };
