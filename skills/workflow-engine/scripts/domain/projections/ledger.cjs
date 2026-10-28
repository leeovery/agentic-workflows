'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's stops on the ledger. Pure renderers over the
// stop the engine kept: a ledger changed other than at its end (5.4.4) —
// the first line not as the state branch last committed it, and the line
// found there, or that the ledger ends before it — and a ledger holding
// entries a newer release wrote, with the version they carry and the one
// the engine reads.
// ---------------------------------------------------------------------------

const { NBSP, section, emitAs, clipped } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { ID_LENGTH } = require('../ledger-ids.cjs');

const FOUND_MAX = 60;
const ID_IN_LINE = new RegExp(`"id":"([0-9A-Za-z]{${ID_LENGTH}})"`);

/** The entry id a ledger line shows, or null. @param {string} line @returns {string|null} */
function idInLine(line) {
  return ID_IN_LINE.exec(line)?.[1] ?? null;
}

/**
 * The line found, as the screen shows it: its id in short form, cut short.
 * @param {string} found @param {string|null} short the short form of the id it shows
 */
function shownLine(found, short) {
  if (found.trim() === '') return '*a blank line*';
  const id = idInLine(found);
  const line = short !== null && id !== null && short.length < id.length ? found.replace(ID_IN_LINE, `"id":"${short}…"`) : found;
  return escapeMarkdown(clipped(line, FOUND_MAX));
}

/** @param {string} title @param {string[]} account */
function stopScreen(title, account) {
  return [
    section('DISPLAY: ledger stop', emitAs('properties'), `⚑ The engine stopped: ${title}`),
    section('DISPLAY: ledger account', emitAs('markdown'), account.map((line) => (line === '' ? '>' : `> ${line}`)).join('\n')),
  ].join('\n');
}

/**
 * The stop on a ledger line not as committed.
 * @param {string} project the project's name
 * @param {import('../ledger-check.cjs').LedgerChange} change
 * @param {string|null} short the short form of the id the line found shows
 * @returns {string}
 */
function ledgerStop(project, { line, found }, short) {
  const name = escapeMarkdown(project);
  const at = line.toLocaleString('en-US');
  const what = found === null
    ? [`${name}'s ledger only grows at its end, and it ends before line ${at}, which the state branch last committed.`]
    : [
      `${name}'s ledger only grows at its end, and line ${at} isn't the line the state branch last committed there. The line it found:`,
      `${NBSP}${NBSP}${shownLine(found, short)}`,
    ];
  return stopScreen("a ledger line isn't as it was committed", [
    ...what,
    'Something outside the engine changed, removed or reordered the ledger, so the engine stops here.',
  ]);
}

/**
 * The stop on a ledger a newer release wrote to.
 * @param {string} project the project's name
 * @param {{version: number, reads: number}} versions the version the ledger's entries carry, and the one the engine reads
 * @returns {string}
 */
function ledgerNewerStop(project, { version, reads }) {
  return stopScreen('the ledger holds entries a newer Leeway wrote', [
    `${escapeMarkdown(project)}'s ledger holds entries at schema version ${version}, and the workflows on this machine read up to version ${reads}, so the engine reads none of it.`,
    '',
    "Update the workflows on this machine — pull the project's code — and start again.",
  ]);
}

module.exports = { idInLine, ledgerStop, ledgerNewerStop };
