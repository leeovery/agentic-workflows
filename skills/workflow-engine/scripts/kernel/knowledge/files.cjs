'use strict';

// ---------------------------------------------------------------------------
// Kernel: the knowledge directory's files — the one home for their names. The
// directory sits in the state, local to the machine and never committed: the
// store, its metadata and the knowledge config setup wrote, beside the
// store's lock and the vector fill's claim; and the copies rendered from the
// ledger, under a lock of their own — each record's, which the store indexes, and the product record's,
// which it never does (4.11.10).
// ---------------------------------------------------------------------------

const path = require('path');

/** The knowledge directory, state-relative. */
const KNOWLEDGE_DIR = '.knowledge';

/** The records' rendered copies, state-relative. */
const RECORDS_DIR = `${KNOWLEDGE_DIR}/records`;

/** The product record's rendered file, state-relative (8.9.13). */
const PRODUCT_FILE = `${KNOWLEDGE_DIR}/product.md`;

/** The files a checkout sets up, by their names in the directory. */
const NAMES = { store: 'store.bin', metadata: 'metadata.json', config: 'config.json' };

/**
 * @typedef {object} KnowledgeFiles  absolute paths
 * @property {string} root  the state root the directory is in
 * @property {string} dir
 * @property {string} store
 * @property {string} metadata
 * @property {string} config
 * @property {string} lock  held by every store write
 * @property {string} fill  held by the vector fill while it works
 * @property {string} copies  held by a render of the ledger's copies
 */

/**
 * @param {string} root  the state root
 * @returns {KnowledgeFiles}
 */
function knowledgeFiles(root) {
  const dir = path.join(root, KNOWLEDGE_DIR);
  return {
    root,
    dir,
    store: path.join(dir, NAMES.store),
    metadata: path.join(dir, NAMES.metadata),
    config: path.join(dir, NAMES.config),
    lock: path.join(dir, '.lock'),
    fill: path.join(dir, '.fill'),
    copies: path.join(dir, '.copies'),
  };
}

module.exports = { KNOWLEDGE_DIR, RECORDS_DIR, PRODUCT_FILE, knowledgeFiles };
