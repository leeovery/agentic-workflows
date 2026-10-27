'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the engine's stop on a ledger changed other than at its end
// (5.4.4). Pure renderer over what the append-only check found: the first
// line not as the state branch last committed it, and the line found there
// — or that the ledger ends before it.
// ---------------------------------------------------------------------------

const { section, emitAs, clipped } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');

const FOUND_MAX = 60;

/**
 * The stop's screen.
 * @param {string} project the project's name
 * @param {import('../ledger-check.cjs').LedgerChange} change
 * @returns {string}
 */
function ledgerStop(project, { line, found }) {
  const name = escapeMarkdown(project);
  const at = line.toLocaleString('en-US');
  const what = found === null
    ? [`> ${name}'s ledger only grows at its end, and it ends before line ${at}, which the state branch last committed.`]
    : [
      `> ${name}'s ledger only grows at its end, and line ${at} isn't the line the state branch last committed there. The line it found:`,
      '>',
      `> ${found.trim() === '' ? '*a blank line*' : escapeMarkdown(clipped(found, FOUND_MAX))}`,
    ];
  const account = [...what, '>', '> Something outside the engine changed, removed or reordered the ledger, so the engine stops here.'];
  return [
    section('DISPLAY: ledger stop', emitAs('properties'), "⚑ The engine stopped: a ledger line isn't as it was committed"),
    section('DISPLAY: ledger account', emitAs('markdown'), account.join('\n')),
  ].join('\n');
}

module.exports = { ledgerStop };
