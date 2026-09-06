'use strict';

// ---------------------------------------------------------------------------
// Domain ring: experiment projections — pure renderers over one topic's
// series rows (`phases.experiment.items.{topic}.experiments`, resolved by the
// surface handlers in domain/render.cjs). Like every sibling projection they
// take a detail and return a string; state resolution and refusals live with
// the handlers.
//
// The register is the series' one readout — a render surface off the
// manifest, never a hand-maintained file: one row per experiment, conceived
// to verdict, sub-experiments nested under their parent, abandoned rows kept
// with their reason. The approval gate is the briefing confirm that freezes
// a design before anything is measured. The spawn gate is the spawning
// conversation's now-or-later choice right after a spawn; the blocked-
// conclusion gate over every wait lives in wait.cjs.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { isParentExperimentId } = require('../../kernel/manifest-schema.cjs');
const { TREE_WIDTH, treeHeader, titlecase, title, stateNote } = require('../conventions.cjs');
const { section, menu, menuFrame, cmdOption, promptOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/**
 * @typedef {object} SeriesRow
 * @property {string} id        `E1`, `E2`, … — sub-experiments `E1.1`, `E1.2`, …
 * @property {string} slug
 * @property {string} status    one of the record vocabulary
 * @property {string} [verdict] concluded rows — the decision rule's outcome
 * @property {string} [reason]  abandoned rows — why the row was abandoned
 */

// One register row: `E{n} {slug}`. A terminal row carries no tag — its state
// rides the `↳` line with the verdict or reason (body-bearing rows spell
// state beneath, never in the tag column); a live row keeps the status tag.
/** @param {SeriesRow} r */
function registerNode(r) {
  const note = r.status === 'concluded' ? `concluded — ${r.verdict}`
    : r.status === 'abandoned' ? `abandoned — ${r.reason}`
    : null;
  return {
    title: title({ label: `${r.id} ${r.slug}` }),
    ...(note ? { body: [stateNote(note)] } : { tag: r.status }),
  };
}

// Register rows as kernel tree nodes: top-level experiments as siblings,
// each parent's sub-experiments nested beneath it.
/** @param {SeriesRow[]} rows */
function registerNodes(rows) {
  return rows
    .filter((r) => isParentExperimentId(r.id))
    .map((parent) => {
      const subs = rows.filter((r) => r.id.startsWith(`${parent.id}.`));
      const node = registerNode(parent);
      return subs.length ? { ...node, children: subs.map(registerNode) } : node;
    });
}

/**
 * The series register — the topic's full measurement history. Renders the
 * none-yet line over an empty series, so no caller needs a branch.
 * @param {string} topic @param {SeriesRow[]} rows
 * @returns {string}
 */
function experimentRegister(topic, rows) {
  const n = rows.length;
  const head = treeHeader(`Experiments — ${titlecase(topic)} (${n} experiment${n === 1 ? '' : 's'})`);
  const body = n === 0
    ? head + '\n  (none yet — the series starts at E1)'
    : head + '\n' + renderTree(registerNodes(rows), { width: TREE_WIDTH, gap: true });
  return section('DISPLAY: experiment register', CONTINUE_INSTRUCTION, body);
}

/**
 * The briefing gate — the user-confirmed freeze between a written design and
 * the first measurement. Rendered after the design is presented
 * conversationally; approve records the freeze (`experiment approve`), abandon
 * ends the record with its reason and the row kept, an amendment folds in
 * before the freeze.
 * @param {string} id
 * @returns {string}
 */
function experimentApprovalGate(id) {
  return section('MENU: experiment approval gate', MENU_INSTRUCTION, menu('', [
    cmdOption('a', 'approve', 'Freeze the design and start measuring'),
    cmdOption('b', 'abandon', `Abandon ${id} — recorded with its reason; the register keeps the row`),
    promptOption('Amend', 'Tell me what to change — the design folds it in before the freeze'),
  ], { question: `Approve ${id}'s design?` }));
}

/**
 * The record picker under the register — the several-live-records path: the
 * register shows the series, this menu takes the pick.
 * @returns {string}
 */
function experimentPick() {
  const body = menuFrame(['Which experiment? (enter its id — E1, E2, …, or **`b/back`**)']);
  return section('MENU: experiment pick', MENU_INSTRUCTION, body);
}

/**
 * The return leg's gate — a record just closed and the series still holds
 * live experiments: work the next one in this session, or back to the menu.
 * @param {SeriesRow[]} live  live top-level rows, id order
 * @returns {string}
 */
function experimentNextGate(live) {
  const names = live.map((r) => `${r.id} ${r.slug}`).join(', ');
  const statement = `The series still holds ${names}.`;
  return section('MENU: experiment next gate', MENU_INSTRUCTION, menu(statement, [
    cmdOption('n', 'next', 'Work the next experiment'),
    cmdOption('m', 'menu', 'Back to the menu'),
  ], { question: 'Work the next experiment?' }));
}

/**
 * The now-or-later gate — rendered by the spawning session right after the
 * spawn is recorded, while the conversation still holds the knowledge. Both
 * roads end at the menu with the experiment queued; the choice is which turn
 * comes first.
 * @param {string} phase the spawning phase — `research` or `discussion`
 * @param {string} id
 * @returns {string}
 */
function experimentSpawnGate(phase, id) {
  return section('MENU: experiment spawn gate', MENU_INSTRUCTION, menu('', [
    cmdOption('n', 'now', `Pause this ${phase} here — the session ends and the menu takes over with ${id} queued`),
    cmdOption('l', 'later', `Keep the conversation going — this ${phase} cannot conclude until ${id}'s evidence lands`),
  ], { question: `Work ${id} now?` }));
}

module.exports = { experimentRegister, experimentApprovalGate, experimentPick, experimentNextGate, experimentSpawnGate };
