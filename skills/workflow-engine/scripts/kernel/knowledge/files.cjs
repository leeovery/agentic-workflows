'use strict';

// ---------------------------------------------------------------------------
// Kernel: the knowledge directory's files — the one home for their names. The
// directory is local to each checkout and never committed: the store, its
// metadata and the knowledge config setup wrote, beside the store's lock and
// the vector fill's claim.
// ---------------------------------------------------------------------------

const path = require('path');

const KNOWLEDGE_DIR = '.workflows/.knowledge';

/** The files a checkout sets up, by their names in the directory. */
const NAMES = { store: 'store.bin', metadata: 'metadata.json', config: 'config.json' };

/** The files a checkout sets up, project-relative — the ones a new worktree is given a copy of. */
const STORE_FILES = Object.values(NAMES).map((name) => `${KNOWLEDGE_DIR}/${name}`);

/**
 * @typedef {object} KnowledgeFiles  absolute paths
 * @property {string} dir
 * @property {string} store
 * @property {string} metadata
 * @property {string} config
 * @property {string} lock  held by every store write
 * @property {string} fill  held by the vector fill while it works
 */

/**
 * @param {string} root  the project root
 * @returns {KnowledgeFiles}
 */
function knowledgeFiles(root) {
  const dir = path.join(root, KNOWLEDGE_DIR);
  return {
    dir,
    store: path.join(dir, NAMES.store),
    metadata: path.join(dir, NAMES.metadata),
    config: path.join(dir, NAMES.config),
    lock: path.join(dir, '.lock'),
    fill: path.join(dir, '.fill'),
  };
}

module.exports = { KNOWLEDGE_DIR, STORE_FILES, knowledgeFiles };
