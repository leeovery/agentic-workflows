'use strict';

// ---------------------------------------------------------------------------
// Domain ring: experiment projections — pure renderers over one topic's
// series rows (`phases.experiment.items.{topic}.experiments`, resolved by the
// surface handlers in domain/render.cjs and by the laboratory's entry,
// experiment-entry.cjs). Like every sibling projection they take a detail
// and return a string; state resolution and refusals live with their
// callers.
//
// The register is the series' one readout, off the manifest, never a
// hand-maintained file: one row per experiment, conceived to verdict,
// sub-experiments nested under their parent, abandoned rows kept with their
// reason. It is drawn above the pick the laboratory's entry asks where
// several records are live, and above the next experiment's gate. The
// approval gate is the briefing confirm that freezes a design before
// anything is measured. The spawn gate is the spawning conversation's
// now-or-later choice right after a spawn, a learned process gate (24.1.2).
// Every row of each gate declares where it leads.
// ---------------------------------------------------------------------------

const { renderTree } = require('../../kernel/render.cjs');
const { isParentExperimentId } = require('../../kernel/manifest-schema.cjs');
const { TREE_WIDTH, treeHeader, title, stateNote } = require('../conventions.cjs');
const { section, menu, cmdOption, promptOption, CONTINUE_INSTRUCTION, MENU_INSTRUCTION } = require('./surfaces.cjs');

/** @typedef {import('./surfaces.cjs').Next} Next */

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
 * The series register — the topic's full measurement history, drawn over a
 * series holding a live record.
 * @param {string} named the topic as screens title it @param {SeriesRow[]} rows
 * @returns {string}
 */
function experimentRegister(named, rows) {
  const n = rows.length;
  const head = treeHeader(`Experiments — ${named} (${n} experiment${n === 1 ? '' : 's'})`);
  return section('DISPLAY: experiment register', CONTINUE_INSTRUCTION, `${head}\n${renderTree(registerNodes(rows), { width: TREE_WIDTH, gap: true })}`);
}

/**
 * The briefing gate — the user-confirmed freeze between a written design and
 * the first measurement. Rendered after the design is presented
 * conversationally; yes records the freeze (`experiment approve`), abandon
 * carries the conversation on to take the reason the record ends with, its
 * row kept, and an amendment folds in before the freeze.
 * @param {{unit: string, topic: string, id: string}} record
 * @returns {string}
 */
function experimentApprovalGate({ unit, topic, id }) {
  return section('MENU: experiment approval gate', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', 'Freeze the design and start measuring', { next: { kind: 'engine', argv: ['experiment', 'approve', unit, topic, id] } }),
    cmdOption('b', 'abandon', `Abandon ${id} — recorded with its reason; the register keeps the row`, { next: { kind: 'continue' } }),
    promptOption('Amend', 'Tell me what to change — the design folds it in before the freeze'),
  ], { question: `Approve ${id}'s design?` }));
}

/**
 * The record picker under the register — the several-live-records path the
 * laboratory's entry asks: the register shows the series, this menu takes
 * the pick, one row per live top-level record keyed by its id, each leading
 * where `into` says; its back leads where `back` says.
 * @param {SeriesRow[]} live  live top-level rows, id order
 * @param {{into: (id: string) => Next, back: Next}} ways
 * @returns {string}
 */
function experimentPick(live, { into, back }) {
  return section('MENU: experiment pick', MENU_INSTRUCTION, menu('Which experiment?', [
    ...live.map((r) => cmdOption(r.id, null, { head: r.slug, tail: r.status }, { next: into(r.id) })),
    cmdOption('b', 'back', 'Leave without picking one', { next: back }),
  ]));
}

/**
 * The return leg's gate — a record just closed and the series still holds
 * live experiments: work the next one in this session, where `next` leads,
 * or back to the menu, where `leave` leads.
 * @param {SeriesRow[]} live  live top-level rows, id order
 * @param {{next: Next, leave: Next}} ways
 * @returns {string}
 */
function experimentNextGate(live, { next, leave }) {
  const names = live.map((r) => `${r.id} ${r.slug}`).join(', ');
  const statement = `The series still holds ${names}.`;
  return section('MENU: experiment next gate', MENU_INSTRUCTION, menu(statement, [
    cmdOption('y', 'yes', 'Work the next experiment', { next }),
    cmdOption('m', 'menu', 'Back to the menu', { next: leave }),
  ], { question: 'Work the next experiment?' }));
}

/**
 * The now-or-later gate — rendered by the spawning session right after the
 * spawn is recorded, while the conversation still holds the knowledge. Yes
 * pauses the conversation and hands off to the laboratory for the topic, the
 * experiment it just spawned named, as every spawn worked now does; later
 * carries the conversation on, the question the experiment measures waiting
 * on its result unless the person answers it first (9.1.11).
 * @param {{phase: string, id: string, unit: string, topic: string, workType: string}} spawn
 * @param {import('../learned-gates.cjs').GateStep} step the gate's, a learned one
 * @returns {string}
 */
function experimentSpawnGate({ phase, id, unit, topic, workType }, step) {
  return section('MENU: experiment spawn gate', MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', `Pause this ${phase} here and open the laboratory for ${id}`,
      { next: { kind: 'handoff', skill: 'ledger-experiment-process', args: [workType, unit, topic, id] } }),
    cmdOption('l', 'later', `Keep the conversation going — the question ${id} measures waits for its result, unless you answer it first`, { next: { kind: 'continue' } }),
  ], { question: `Work ${id} now?` }), step);
}

module.exports = { experimentRegister, experimentApprovalGate, experimentPick, experimentNextGate, experimentSpawnGate };
