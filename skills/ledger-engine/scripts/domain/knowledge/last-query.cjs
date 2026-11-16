'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's last knowledge query (22.6.10, 22.6.17) —
// what the plain-search helper is briefed from, so a search the knowledge
// base did not answer in depth carries on from the query it follows, never
// from a word of the conversation (6.5.6). `knowledge query` keeps it in the
// conversation's folder (conversation.cjs), `knowledge-query.json`, before
// it runs — its terms and its filters, each filter as its flag gives it —
// and settles what it came to after: what it returned, or that it failed
// and why. One left unsettled is a query that never finished. A query with
// no conversation keeps nothing. It writes the conversation's folder alone,
// under no lock, as a raise's seal does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { conversationDir } = require('../conversation.cjs');
const { writeJsonAtomic } = require('../../kernel/manifest-io.cjs');
const { messageOf } = require('../../kernel/call.cjs');

const FILE = 'knowledge-query.json';

/**
 * What a query came to: what it returned, or why it failed.
 * @typedef {{returned: string}|{failed: string}} Outcome
 */

/**
 * The conversation's last query: its terms, its filters, and what it came
 * to, null while it runs or where it never finished.
 * @typedef {{terms: string[], filters: string[], outcome: Outcome|null}} LastQuery
 */

/** @param {string} session */
const queryFile = (session) => path.join(conversationDir(session), FILE);

/** The query kept as the conversation's last, before it runs. @param {string} session @param {string[]} terms @param {string[]} filters */
function keepQuery(session, terms, filters) {
  fs.mkdirSync(conversationDir(session), { recursive: true });
  writeJsonAtomic(queryFile(session), { terms, filters, outcome: null });
}

/**
 * The conversation's last query, null where it has run none; refused where
 * the file is not one.
 * @param {string} session @returns {LastQuery|null}
 */
function lastQuery(session) {
  const file = queryFile(session);
  if (!fs.existsSync(file)) return null;
  let kept;
  try {
    kept = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the conversation's last knowledge query, ${file}, cannot be read — ${messageOf(err)}`);
  }
  if (!Array.isArray(kept?.terms) || !Array.isArray(kept.filters)) throw new Error(`the conversation's last knowledge query, ${file}, holds no query`);
  return kept;
}

/** The last query settled with what it came to. @param {string} session @param {Outcome} outcome */
function settleQuery(session, outcome) {
  const kept = lastQuery(session);
  if (kept !== null) writeJsonAtomic(queryFile(session), { ...kept, outcome });
}

module.exports = { keepQuery, lastQuery, settleQuery };
