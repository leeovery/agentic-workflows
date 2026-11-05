'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's bugfix scenario: the investigation through its
// own verbs — entered at its one topic, the hunt logged on its entries, the
// plan and check-in gates, both validations briefed and taken in, the fix
// direction raised, and the conclude gate's yes handing off into the spec —
// reopened by a gap before the spec and concluded again, its recap naming
// this time the unit whose code the bug is in; then the specification with
// its source pinned to the topic, into the build.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const START_GATEWAY = require(path.join(ROOT, 'skills/leeway/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { startMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/start.cjs'));
const { workUnitStatus } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/workunit.cjs'));
const { drawLabel } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  Sim, startUnit, enterEntry, handoff, answerGate, placeIn, landed, linearMenu, linearPick, backToStart, startNew, specToBuild,
} = require('./pipeline-world.cjs');

const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });

/**
 * Claude's recap of the hunt, staged for the conclude gate, with what the
 * bug is in where `bug` names it.
 * @param {import('./pipeline-world.cjs').Sim} sim @param {{fixes?: string}} [bug]
 */
const recap = (sim, bug = {}) => sim.write('.leeway/.cache/scratch/recap.json', { hunt: 'Two hypotheses; the save wrote a null on every crash, and nothing checked it.', ...bug });

/**
 * A validation of `kind` as the investigation runs it (19.4.7): dispatched,
 * briefed, its report written where the brief says, scanned and taken in, and
 * what it found logged.
 * @param {import('./pipeline-world.cjs').Sim} sim @param {string} wu @param {'root-cause'|'fix'} which
 */
function validated(sim, wu, which) {
  const kind = `${which}-validation`;
  const { id } = sim.run(['agent', 'dispatch', wu, 'investigation', wu, '--kind', kind]);
  landed(placeIn(sim, sim.run(['brief', kind, wu, '--agent', id]), 'Your report'), `# Validation — ${id}\n\n## Summary\n\nIt holds.\n\n## Findings\n\nNone identified.\n`);
  sim.run(['agent', 'scan', wu, 'investigation', wu]);
  sim.run(['agent', 'ack', wu, 'investigation', wu, id, '--clean']);
  sim.run(['investigation-log', 'validation', wu, which, '--found', 'It holds', '--did', 'Carried on']);
}

/**
 * The hunt as the investigation works it: entered, the symptom and the
 * hypotheses logged and the plan agreed at its gate; an experiment's
 * finding settling them at the check-in; the root cause decided and
 * validated; the step back and the fix direction raised and picked, then
 * validated.
 * @param {import('./pipeline-world.cjs').Sim} sim @param {string} wu
 */
async function hunted(sim, wu) {
  const at = `${wu}.investigation.${wu}`;
  const log = (/** @type {string} */ kind, /** @type {string[]} */ args) => sim.run(['investigation-log', kind, wu, ...args]);
  const ledger = (/** @type {string} */ verb, /** @type {string[]} */ flags, /** @type {object} */ content) => sim.run(['ledger', verb, at, ...flags], null, JSON.stringify(content)).id;
  enterEntry(sim, wu, 'investigation', wu);
  log('symptom', ['--text', 'The app crashes when I save']);
  log('hypothesis', ['--title', 'The save writes a null']);
  log('hypothesis', ['--title', 'The disk is full']);
  sim.render(['investigation-plan', wu, '--file', sim.write('.leeway/.cache/scratch/plan.json', { order: [{ hypothesis: 'H1', check: 'Trace the save' }, { hypothesis: 'H2', check: 'Read the disk' }] })], { expect: 'content' });
  answerGate(sim, 'plan gate', '--pick', 'y');
  const finding = ledger('find', [], { ...CLAUDE, text: 'The save writes a null field on every crash.', how: 'Traced save() to write().', known: 'read' });
  log('experiment', ['--title', 'Trace the save', '--showed', 'a null on every crash', '--entry', finding]);
  log('hypothesis', ['H1', '--state', 'confirmed']);
  log('hypothesis', ['H2', '--state', 'ruled-out']);
  sim.render(['investigation-check-in', wu, '--file', sim.write('.leeway/.cache/scratch/check-in.json', { resolved: ['H1', 'H2'], next: 'Name the root cause' })], { expect: 'content' });
  answerGate(sim, 'check-in gate', '--pick', 'y');
  const cause = ledger('ask', [], { ...CLAUDE, text: 'What crashes the save?' });
  log('root-cause', ['--entry', ledger('decide', ['--answers', cause], { ...CLAUDE, text: 'The save writes a null that nothing checks.', why: 'The trace showed it.' })]);
  validated(sim, wu, 'root-cause');
  const fix = ledger('ask', [], { ...CLAUDE, text: 'How should the save stop crashing?' });
  const { raise } = await sim.runAsync(['raise', at, '--answers', fix], null, JSON.stringify({
    question: 'How should the save stop crashing?',
    rows: [
      { key: '1', name: 'Check', text: 'Check the field before the save writes it', notice: 'a save never crashes' },
      { key: '2', name: 'Default', text: 'Write a default in place of the null', notice: 'a save keeps a placeholder' },
    ],
    lean: '1', why: 'The null is the cause.', sort: 'one', mechanism: 'The save checks the field.', product_wide: false,
    stepped_back: ['The save was right for the fields it knew; a null is a case it never met.'],
  }));
  sim.run(['raise', 'answer', raise, '--pick', '1'], null, JSON.stringify({ why: 'It stops the crash at its cause.' }));
  log('fix-direction', ['--question', fix]);
  validated(sim, wu, 'fix');
}

/**
 * The conclude as the investigation closes (19.4.23): the recap staged at
 * its gate, with what the bug is in where `bug` names it, and the yes run,
 * handing off into the spec (24.S17).
 * @param {import('./pipeline-world.cjs').Sim} sim @param {string} wu @param {{fixes?: string}} [bug]
 */
function concluded(sim, wu, bug) {
  sim.render(['conclude', wu, '--file', recap(sim, bug)], { expect: 'content' });
  const { next } = sim.run(answerGate(sim, 'conclude gate', '--pick', 'y').next.argv);
  const route = `/leeway-specification-process bugfix ${wu}`;
  assert.strictEqual([`/${next.skill}`, ...next.args].join(' '), route, 'the conclude hands off into the spec');
  handoff(sim, route);
}

describe('pipeline simulation: bugfix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('bugfix (19.S8, 22.S21, 24.S17, 11.S19): the investigation through its own verbs to its conclude → a gap answered before the spec, concluded again → the spec, entered at the unit, to ready to build', async () => {
    const wu = 'crash-fix';
    startUnit(sim, 'feature', 'saving', 'Saving the file');
    startNew(sim, 'bugfix');
    const started = startUnit(sim, 'bugfix', wu, 'Fix the crash');
    assert.deepStrictEqual(started.next, { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', wu] });

    handoff(sim, `/leeway-investigation-process bugfix ${wu}`);
    await hunted(sim, wu);
    const { decisions, findings } = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual([findings.map((f) => f.text), decisions.map((d) => d.text)], [
      ['The save writes a null field on every crash.'],
      ['The save writes a null that nothing checks.', 'Check the field before the save writes it'],
    ], 'the hunt\'s finding, its root cause and its fix stand on the topic\'s record (19.S8)');
    concluded(sim, wu);
    // A session that stops here resumes from the bugfix's continue menu, which
    // hands off where the conclude does — or goes back to the start menu,
    // where the bugfix is still the row it was picked from.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    assert.ok(backToStart(sim, linearMenu(sim, wu).keys)
      .some((k) => k.action === 'continue_work_unit' && k.route === `/leeway-continue-linear ${wu}`));
    // The knowledge base reaches the root cause through the topic's record
    // (22.6.8).
    const query = async (/** @type {string} */ terms) => (await sim.engineAsync(['knowledge', 'query', terms])).stdout;
    assert.match(await query('null nothing checks'), /^\[record \| crash-fix\/crash-fix \| /m);

    // A gap routed back before the spec lands in the topic's mailbox, waiting
    // for its investigation: the delivery reopens the item, the question it
    // raised answers it, and the investigation concludes again.
    sim.write('.leeway/.cache/scratch/gap-message.md', 'Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/gap-message.md', '--slug', 'retry-semantics']);
    assert.strictEqual(gapLand.reopened, true);
    // The reopened investigation's rows say what waits — the start menu
    // entry and the bugfix pipeline row — and answering it retires the cue.
    const startRow = () => startMenu(START_GATEWAY.discover(sim.dir)).keys
      .map((k) => drawLabel(k.label)).find((label) => label.startsWith('Continue "Crash Fix"'));
    const bugfixUnit = () => LIB.detail.activeWorkUnit(sim.dir, wu).unit;
    assert.strictEqual(startRow(), 'Continue "Crash Fix" — *bugfix, investigation (in-progress)* · mail waiting');
    assert.deepStrictEqual(bugfixUnit().mail_phases, ['investigation']);
    assert.match(workUnitStatus('bugfix', bugfixUnit()), /◐ Investigation +\[in-progress · mail waiting\]/);
    sim.refuses(['render', 'conclude', wu, '--file', recap(sim)], /message\(s\) wait in its mailbox/);
    const gapMailbox = sim.run(['topic', 'mailbox', wu, wu]);
    assert.deepStrictEqual(gapMailbox.files, [path.join(sim.dir, `.leeway/${wu}/topics/${wu}/mail/001-retry-semantics.md`)]);
    const gapQuestion = sim.run(['ledger', 'ask', `${wu}.investigation.${wu}`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What are the retry semantics?' }));
    sim.run(['ledger', 'decide', `${wu}.investigation.${wu}`, '--answers', gapQuestion.id], null,
      JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'Retry twice, then fail.', why: 'The spec needs a bound.' }));
    sim.run(['topic', 'answered', wu, wu, '001-retry-semantics', '--entry', gapQuestion.id]);
    const record = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual(record.decisions.filter((d) => d.answers === gapQuestion.id).map((d) => d.text), ['Retry twice, then fail.'],
      'the question the message raised stands decided on the topic\'s record');
    assert.strictEqual(sim.run(['topic', 'mailbox', wu, wu]).files.length, 0);
    assert.strictEqual(startRow(), 'Continue "Crash Fix" — *bugfix, investigation (in-progress)*', 'the answered mailbox retires the cue');
    assert.strictEqual(bugfixUnit().mail_phases, undefined);
    sim.refuses(['enter', 'specification', wu], /^crash-fix's spec waits until its investigation concludes/);
    enterEntry(sim, wu, 'investigation', wu);
    concluded(sim, wu, { fixes: 'saving' });

    // The spec, entered at the unit — its route naming no topic — through its
    // corridor to ready to build's pick; the spec is never indexed (11.1.2).
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    specToBuild(sim, wu, [wu]);
    assert.doesNotMatch(await query('holds as decided'), /^\[specification \|/m);
    // A build by its cut leaves nothing to revisit — never the spec
    // (11.9.1), nor the investigation the spec closed (4.11.2).
    sim.refuses(['render', 'revisit-phases', wu], /"crash-fix" has no completed earlier phase to revisit/);
    // Past its spec the investigation is not reopened: a change is settled
    // in the spec.
    sim.refuses(['topic', 'reopen', wu, 'investigation', wu], /^crash-fix has its spec — a topic exists only before it/);
  });
});
