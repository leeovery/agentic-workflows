'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a conversation carries on in a topic from (9.2) — the
// topic's record, read through `ledger record`, and its log,
// `topics/{topic}/log.md` — named alike by the entry (enter.cjs) and the
// recovery note (position.cjs); and the line a conversation opens its first
// write to a log with (8.14.8): the date, its session id and its
// transcript's path. The line is owed until the log names the conversation,
// which is read from the log itself, so a conversation that has not written
// to it yet is told again wherever it is told what to read.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { ENGINE_COMMAND } = require('../kernel/call.cjs');
const { todayStamp } = require('./dates.cjs');

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
 * product, of the unit and of the topic.
 * @param {string} unit @param {string} topic
 */
function productCall(unit, topic) {
  return `${ENGINE_COMMAND} ledger product ${unit} ${topic}`;
}

/**
 * The line the conversation `sessionId` opens its first write to the log at
 * `file` with — today's date, the session id, and the transcript where one
 * was found — or null where the log names the conversation already, or no
 * session id names it.
 * @param {string} file absolute @param {string|null} sessionId @param {string|null} transcript
 * @returns {string|null}
 */
function owedHeader(file, sessionId, transcript) {
  if (sessionId === null) return null;
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { /* not written yet */ }
  if (text.includes(sessionId)) return null;
  return [`## ${todayStamp()}`, `session ${sessionId}`, ...(transcript === null ? [] : [`transcript ${transcript}`])].join(' · ');
}

module.exports = { topicLog, ledgerView, recordCall, productCall, owedHeader };
