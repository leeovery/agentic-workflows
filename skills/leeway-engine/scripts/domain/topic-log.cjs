'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a conversation carries on in a place from (9.2), named
// alike by the entry (enter.cjs) and the recovery note (position.cjs) — a
// topic's record, read through `ledger record`, and its log,
// `topics/{topic}/log.md`; the product record, through `ledger product`; an
// epic's map — and the line a conversation opens its first write to a log
// with (8.14.8): the date, its session id and its transcript's path. The
// line is owed until the log's last conversation line is the conversation's
// own — on its first write, and again after another conversation wrote —
// which is read from the log itself, so a conversation that has not written
// since is told again wherever it is told what to read; and a log's last
// conversation line names the conversation that wrote it last.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { todayStamp } = require('./dates.cjs');

/** A conversation's line in a log: its date, its session id, and its transcript where one was found. */
const HEADER = /^## (\d{4}-\d{2}-\d{2}) · session (\S+)(?: · transcript (.+))?$/;

/** A topic's log, state-relative. @param {string} unit @param {string} topic */
function topicLog(unit, topic) {
  return `${unit}/topics/${topic}/log.md`;
}

/**
 * The call that reads one of a topic's views of the ledger: its record, its
 * map, or the entries a replacement changed under it.
 * @param {'record'|'map'|'affected'} view @param {string} unit @param {string} topic
 */
function ledgerView(view, unit, topic) {
  return `${ENGINE_COMMAND} ledger ${view} ${unit} ${topic}`;
}

/** The call that reads a topic's record. @param {string} unit @param {string} topic */
function recordCall(unit, topic) {
  return ledgerView('record', unit, topic);
}

/**
 * The call that reads the product record, and what discovery found of the
 * product — and of the unit and the topic, each where it is named.
 * @param {...string} scope the unit, then the topic
 */
function productCall(...scope) {
  return [ENGINE_COMMAND, 'ledger', 'product', ...scope].join(' ');
}

/** The call that reads an epic's map: its topics, in their order, and the names struck from it. @param {string} unit */
function mapCall(unit) {
  return `${ENGINE_COMMAND} render discovery-map ${unit}`;
}

/**
 * The line the conversation `sessionId` opens its next write to the log at
 * `file` with — today's date, the session id, and the transcript where one
 * was found — or null where the log's last conversation line is its own
 * already, or no session id names it.
 * @param {string} file absolute @param {string|null} sessionId @param {string|null} transcript
 * @returns {string|null}
 */
function owedHeader(file, sessionId, transcript) {
  if (sessionId === null || namedConversations(file).at(-1)?.session === sessionId) return null;
  return [`## ${todayStamp()}`, `session ${sessionId}`, ...(transcript === null ? [] : [`transcript ${transcript}`])].join(' · ');
}

/**
 * A conversation a log names, by a line it opened a write with.
 * @typedef {{date: string, session: string, transcript: string|null}} Conversation
 */

/**
 * The conversations the log at `file` names, a line for each turn one took
 * writing it, in order; none where it is not written yet.
 * @param {string} file absolute @returns {Conversation[]}
 */
function namedConversations(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return text.split('\n').flatMap((line) => {
    const m = HEADER.exec(line);
    return m === null ? [] : [{ date: m[1], session: m[2], transcript: m[3] ?? null }];
  });
}

/** Whether a log's line is a conversation's own line. @param {string} line */
const isHeader = (line) => HEADER.test(line);

/**
 * Write a line the engine keeps in a log at its end, a paragraph of its own.
 * @param {string} file absolute @param {string} line
 */
function appendLine(file, line) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { /* not written yet */ }
  const gap = text === '' || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  fs.appendFileSync(file, `${gap}${line}\n`);
}

module.exports = { topicLog, ledgerView, recordCall, productCall, mapCall, owedHeader, namedConversations, isHeader, appendLine };
