'use strict';

// ---------------------------------------------------------------------------
// Domain ring: experiment projections — pure renderers over one topic's
// series rows (`phases.experiment.items.{topic}.experiments`, resolved by the
// surface handlers in domain/render.cjs). Like every sibling projection they
// take a detail and return a string; state resolution and refusals live with
// the handlers.
//
// The register is the series' one readout — a render surface off the
// manifest, never a hand-maintained file: id, slug, status per row, a
// concluded row carrying its verdict and an abandoned row its reason (the
// row persists — abandonment is a first-class terminal). The two gates
// bracket an experiment's life: the approval gate is the briefing confirm
// that freezes a design before anything is measured, and the conclude gate
// is the phase's closing consent, blocked while any row is unfinished.
// ---------------------------------------------------------------------------

const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote } = require('../conventions.cjs');
const { section, menu, cmdOption, promptOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/**
 * @typedef {object} SeriesRow
 * @property {string} id        `E1`, `E2`, …
 * @property {string} slug
 * @property {string} status    one of the series vocabulary
 * @property {string} [verdict] concluded rows — the decision rule's outcome
 * @property {string} [reason]  abandoned rows — why the row was put down
 */

// Register rows as kernel tree nodes: `E{n} {slug}` with the status as the
// tag; the verdict or abandonment reason rides the `↳` line beneath.
/** @param {SeriesRow[]} rows */
function registerNodes(rows) {
  return rows.map((r) => {
    const note = r.status === 'concluded' ? r.verdict : r.status === 'abandoned' ? r.reason : undefined;
    return {
      title: title({ label: `${r.id} ${r.slug}` }),
      tag: r.status,
      ...(note ? { body: [stateNote(note)] } : {}),
    };
  });
}

/**
 * The series register — one row per experiment, conceived to verdict,
 * abandoned rows kept with their reason. Renders the none-yet line before E1
 * exists, so session entry needs no branch.
 * @param {string} topic @param {SeriesRow[]} rows
 * @returns {string}
 */
function experimentRegister(topic, rows) {
  const head = treeHeader(`EXPERIMENTS — ${titlecase(topic)} (${rows.length})`);
  const body = rows.length === 0
    ? head + '\n  (none yet — the series starts at E1)'
    : head + '\n' + renderTree(registerNodes(rows), { width: TREE_WIDTH });
  return section('DISPLAY: experiment register', CONTINUE_INSTRUCTION, body);
}

/**
 * The briefing gate — the user-confirmed freeze between a written design and
 * the first measurement. Rendered after the design is presented
 * conversationally; approve records the freeze (`experiment approve`), an
 * amendment folds in before it, park abandons with the row kept.
 * @param {string} id
 * @returns {string}
 */
function experimentApprovalGate(id) {
  return section('MENU: experiment approval gate', MENU_INSTRUCTION, menu('', [
    cmdOption('a', 'approve', 'Freeze the design and start measuring — changes before results are dated amendments re-confirmed here; once results are visible the design is frozen for good'),
    promptOption('Amend', 'Tell me what to change — the design folds it in before the freeze'),
    cmdOption('p', 'park', `Put ${id} down — abandoned with its reason; the register keeps the row`),
  ], { question: `Approve ${id}'s design?` }));
}

/**
 * The conclude gate's blocked shape — unfinished rows on screen instead of a
 * dead-end: the phase closes only over a truthful register.
 * @param {SeriesRow[]} unfinished
 * @returns {string}
 */
function experimentConcludeBlocked(unfinished) {
  const opener = wrapWithPrefix(
    "The series isn't finished — every experiment ends concluded (with its verdict) or abandoned (with its reason) before the phase closes:",
    { width: TREE_WIDTH, prefix: '' },
  ).join('\n');
  return section(
    'DISPLAY: experiment conclude blocked',
    CONTINUE_INSTRUCTION,
    opener + '\n' + renderTree(registerNodes(unfinished), { width: TREE_WIDTH }),
  );
}

/**
 * The phase's conclude consent — the user judges the series has enough
 * evidence to feed the discussion; the dead-end row renders only when the
 * session's own conclusion is that nothing carries forward (the judgment
 * travels as the caller's flag, never derived here — research's rule).
 * @param {boolean} deadEnd
 * @returns {string}
 */
function experimentConcludeGate(deadEnd) {
  const options = [
    cmdOption('c', 'conclude', 'Mark this topic as complete — the evidence is ready for discussion'),
  ];
  if (deadEnd) {
    options.push(cmdOption('d', 'dead-end', 'Close it as a dead end — completed and kept as record, no discussion owed; reversible from the map'));
  }
  options.push(cmdOption('k', 'keep', "Keep the series going — there's more to measure"));
  return section('MENU: experiment conclude gate', MENU_INSTRUCTION,
    menu('', options, { question: 'This series looks ready to conclude.' }));
}

module.exports = { experimentRegister, experimentApprovalGate, experimentConcludeBlocked, experimentConcludeGate };
