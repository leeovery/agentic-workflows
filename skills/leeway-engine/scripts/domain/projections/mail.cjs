'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the mail screens (§10), each drawn from the messages as their
// senders wrote them, a message's first line its title (mail.cjs):
// - the send report (10.3.4): where the message landed — the target's
//   mailbox, where a postponed topic's waits for its return, ending with
//   the command that opens the target (10.3.3); or the inbox, a cancelled
//   topic's or unit's, said in one line naming which (10.1.8);
// - the waiting mail (10.4.2), raised at a topic's opening before anything
//   else: each message headed by who sent it and when, its title over what
//   follows it.
// Known edge: the send report's `/leeway {unit} {topic}` carries the names
// unquoted, as the person's arguments are passed.
// ---------------------------------------------------------------------------

const { section, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');

const INDENT = '  ';

/** Where a message landed: its mailbox, its mailbox while its topic is postponed, or the inbox. @typedef {'mailbox'|'postponed'|'inbox'} Landing */

/** What the waiting line says of each landing in a mailbox. @type {Record<'mailbox'|'postponed', string>} */
const WAITING = {
  mailbox: '↳ Waiting in its mailbox, with my reasoning',
  postponed: '↳ Postponed — waiting in its mailbox for its return',
};

/** A line of a message, wrapped under `INDENT`, a `↳` line hanging under its text. @param {string} line @param {number} width */
function indented(line, width) {
  if (line.trim() === '') return [''];
  return wrapWithPrefix(line.trim(), { width, prefix: INDENT, hang: line.trimStart().startsWith('↳ ') ? 2 : 0 });
}

/**
 * The send report: where the message landed, and for a mailbox the command
 * that opens the target topic.
 * @param {{unit: string, topic: string, title: string, landing: Landing, cancelled: string}} sent  `cancelled` the unit or topic whose cancel sent it to the inbox
 * @param {{width?: number}} [opts]
 * @returns {string}
 */
function sendReport({ unit, topic, title, landing, cancelled }, { width = displayWidth() } = {}) {
  if (landing === 'inbox') return section('DISPLAY: send report', CONTINUE_INSTRUCTION, `${titlecase(cancelled)} is cancelled, so the message went to the inbox as an idea`);
  const to = topic === unit ? titlecase(unit) : `${titlecase(topic)}, on ${titlecase(unit)}`;
  return section('DISPLAY: send report', CONTINUE_INSTRUCTION, [
    `Sent to ${to}`,
    ...indented(title, width),
    ...indented(WAITING[landing], width),
    '',
    `/leeway ${unit} ${topic}`,
  ].join('\n'));
}

/**
 * The waiting mail, raised at a topic's opening: how many messages wait,
 * then each, headed by who sent it and when, its title over what follows it.
 * @param {{title: string, from: string, body: string}[]} messages in the order they landed — one at least
 * @param {{width?: number}} [opts]
 * @returns {string}
 */
function waitingMail(messages, { width = displayWidth() } = {}) {
  const count = messages.length === 1 ? '1 message waiting' : `${messages.length} messages waiting`;
  return section('DISPLAY: waiting mail', CONTINUE_INSTRUCTION, [
    `${count} — raised before anything else`,
    ...messages.flatMap(({ title, from, body }) => ['', from, title, ...(body === '' ? [] : body.split('\n').flatMap((line) => indented(line, width)))]),
  ].join('\n'));
}

module.exports = { sendReport, waitingMail };
