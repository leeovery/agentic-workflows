'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a discussion on the board (20.7) — This session in a
// discussion, a started topic's page, and any entry of a unit read in full —
// drawn from the topic's map and Claude's calls since the person last
// looked in one read of the ledger (topic-map.cjs, ledger-since.cjs), and
// the topics' mailboxes (mail.cjs).
//
// - Never a look (5.8.14, 9.5.11): the calls since the person last looked
//   are read as `ledger since` reads them, the mark left where it stands.
// - The person's questions are their rows, open, decided by them or gone on;
//   decided are theirs, Claude's — handed over among them — and those
//   carried over, as the map counts them (9.5.3).
// - Its reviews are its review agent's rounds (agent-state.cjs), newest
//   first, each since it was dispatched: one in flight where the store
//   stands it — running, its report in and not yet taken, or lost with the
//   conversation that sent it — and one read with the findings its report
//   gave, those taken in and those still waiting.
// - What the topic sent is every message the state's history shows added to
//   another topic's mailbox of the unit naming it as its sender, as the
//   screens title it (10.4.2) — newest first, each still waiting where its
//   file is still in that mailbox.
// - A message waiting, and a review's report, open in full (20.7.3).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readShown, answerMap } = require('../ledger-read.cjs');
const { answerSince } = require('../ledger-since.cjs');
const { carrying } = require('../ledger.cjs');
const { rowStanding, claudesCalls } = require('../topic-map.cjs');
const { waitingMessages } = require('../mail.cjs');
const { agentRows, agentDir, inFlightStandings } = require('../agent-state.cjs');
const { sentMail } = require('../state-history.cjs');
const { dayBefore } = require('../dates.cjs');
const { withUnitEntries } = require('../unit-entries.cjs');
const { topicTitle, topicKey, mailboxFiles } = require('../derivations.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').DiscussionView} DiscussionView */
/** @typedef {import('../board-model.cjs').CallLine} CallLine */
/** @typedef {import('../topic-map.cjs').Row} Row */

/** The line naming a message's sender and day, as the mail heads it: `From {sender} · {day}`. @param {string} line */
function sentBy(line) {
  const [from = '', when = ''] = line.replace(/^From\s+/, '').split(' · ');
  return { from: from.trim(), when: when.trim() };
}

/**
 * Claude's calls since the person last looked, each with the question it
 * answers on the map, as the map draws them.
 * @param {Row[]} rows @param {{id: string, text: string}[]} calls @returns {CallLine[]}
 */
function callLines(rows, calls) {
  const questions = new Map(claudesCalls(rows).map((call) => [call.answer.id, call.question]));
  return calls.map(({ id, text }) => ({ id, text, question: questions.get(id) ?? null }));
}

/** The topic's review rounds, newest first (the header's). @param {BoardAt} at @param {string} topic @returns {import('../board-model.cjs').ReviewLine[]} */
function reviewsOf(at, topic) {
  const standings = inFlightStandings(at.cwd, at.unit, 'discussion', topic);
  return agentRows(at.cwd, at.unit, 'discussion', topic)
    .filter(({ kind }) => kind === 'review')
    .sort((a, b) => b.created.localeCompare(a.created) || b.id.localeCompare(a.id))
    .map(({ id, set, status, created, findings, surfaced, remaining }) => ({
      id, round: Number(set), state: status === 'in-flight' ? /** @type {'landed'|'running'|'lost'} */ (standings.get(id)) : 'read', since: created, findings: findings.length, taken: surfaced.length, waiting: remaining.length,
    }));
}

/**
 * Every message the topic sent, newest first (the header's).
 * @param {BoardAt} at @param {string} topic @param {string} title @returns {import('../board-model.cjs').DiscussionView['sent']}
 */
function sentFrom(at, topic, title) {
  return sentMail(at.cwd, at.unit, dayBefore(at.manifest.created))
    .filter(({ to, from }) => to !== topic && sentBy(from).from === title)
    .map(({ to, file, title: sent, at: when }) => ({ title: sent, to: topicTitle(at.manifest, to), file, at: when, waiting: mailboxFiles(at.root, at.unit, to).includes(file) }));
}

/**
 * A discussion's This session, or a started topic's page (the header's).
 * @param {BoardAt} at @param {string} [said] the topic, the session's where none is named
 * @returns {{view: DiscussionView}}
 */
function discussionView(at, said = /** @type {string} */ (at.place.topic)) {
  const topic = topicKey(at.manifest, said);
  const place = { unit: at.unit, topic };
  const { rows, since } = carryingWarnings(at, () => readShown(at.root, at.warnings, (shower) => ({
    rows: /** @type {Row[]} */ (answerMap(shower, place, at.root).questions),
    since: /** @type {{id: string, text: string}[]} */ (/** @type {unknown} */ (answerSince(shower, place, at.root, at.warnings).calls)),
  })));
  const title = topicTitle(at.manifest, topic);
  /** @type {DiscussionView['open']} */
  const open = [];
  /** @type {DiscussionView['decided']} */
  const decided = [];
  let moved = 0;
  for (const row of rows) {
    const standing = rowStanding(row);
    if (standing === 'open') open.push({ id: row.id, text: row.text, from: row.moved_from === null ? null : topicTitle(at.manifest, row.moved_from), experiment: row.waiting_on === null ? null : { id: row.waiting_on.experiment, running: row.waiting_on.running } });
    else if (standing === 'moved') moved += 1;
    else decided.push({ id: row.id, text: row.text, who: standing === 'claudes' ? 'claude' : standing });
  }
  const yours = decided.filter(({ who }) => who === 'yours').length;
  return {
    view: {
      kind: 'discussion',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      topic,
      topic_title: title,
      progress: { decided: yours, yours: yours + open.length + moved, calls: claudesCalls(rows).length },
      open,
      messages: waitingMessages(at.cwd, at.unit, topic).map((message) => ({ file: path.basename(message.path), title: message.title, ...sentBy(message.from) })),
      since: callLines(rows, since),
      reviews: reviewsOf(at, topic),
      decided,
      sent: sentFrom(at, topic, title),
    },
  };
}

/** `read` with the warnings it gathered carried on its refusal. @template T @param {BoardAt} at @param {() => T} read @returns {T} */
function carryingWarnings(at, read) {
  try {
    return read();
  } catch (err) {
    throw carrying(err, at.warnings);
  }
}

/**
 * The banner's facts in a discussion (20.2.4): the topic, how many of the
 * person's questions are open, and the messages waiting.
 * @param {DiscussionView} view @returns {{state: 'running', facts: {text: string, needs: boolean}[]}}
 */
function discussionBanner({ type, topic_title: title, open, messages }) {
  const fact = (/** @type {string} */ text) => ({ text, needs: false });
  return {
    state: 'running',
    facts: [
      fact(type), fact('discussion'), fact(title),
      fact(open.length === 0 ? 'nothing of yours open' : `${open.length} of yours open`),
      ...(messages.length === 0 ? [] : [fact(`${messages.length} ${messages.length === 1 ? 'message' : 'messages'} waiting`)]),
    ],
  };
}

/**
 * An entry of the unit read in full, by its short id or whole: what it is,
 * whose, its words and why, and the question it answers; refused where the
 * unit holds no current entry of that id.
 * @param {BoardAt} at @param {string} id @returns {import('../board-model.cjs').EntryPage}
 */
function entryPage(at, id) {
  return withUnitEntries(at.cwd, at.unit, at.warnings, ({ entries }) => {
    const found = [...entries].find(([whole, { short }]) => short === id || whole === id);
    if (found === undefined) throw new Error(`${at.unit} holds no current entry ${id}`);
    const [, { short, kind, line }] = found;
    const answers = typeof line.answers === 'string' ? entries.get(line.answers) : undefined;
    return {
      kind: 'entry',
      unit: at.unit,
      id: short,
      entry: kind,
      by: String(line.by),
      text: String(line.text),
      why: typeof line.why === 'string' ? line.why : null,
      question: answers === undefined ? null : String(answers.line.text),
    };
  });
}

/**
 * A message waiting in a topic's mailbox read in full (20.7.3), by its
 * file; refused where none such waits.
 * @param {BoardAt} at @param {string} said @param {string} file @returns {import('../board-model.cjs').MessagePage}
 */
function messagePage(at, said, file) {
  const topic = topicKey(at.manifest, said);
  const message = waitingMessages(at.cwd, at.unit, topic).find((waiting) => path.basename(waiting.path) === file);
  if (message === undefined) throw new Error(`no message ${file} waits in ${topicTitle(at.manifest, topic)}'s mailbox`);
  return { kind: 'message', unit: at.unit, topic, file, title: message.title, ...sentBy(message.from), text: message.body };
}

/**
 * A round of a topic's review read in full (20.7.3), by its agent's id;
 * refused where the topic's review holds no report of that id.
 * @param {BoardAt} at @param {string} said @param {string} id @returns {import('../board-model.cjs').ReviewReportPage}
 */
function reviewReportPage(at, said, id) {
  const topic = topicKey(at.manifest, said);
  const row = agentRows(at.cwd, at.unit, 'discussion', topic).find((held) => held.kind === 'review' && held.id === id);
  const file = path.join(agentDir(at.cwd, at.unit, 'discussion', topic), `${id}.md`);
  if (row === undefined || !fs.existsSync(file)) throw new Error(`${topicTitle(at.manifest, topic)}'s review holds no report ${id}`);
  return { kind: 'review-report', unit: at.unit, topic, id, round: Number(row.set), text: fs.readFileSync(file, 'utf8') };
}

module.exports = { discussionView, discussionBanner, entryPage, messagePage, reviewReportPage };
