'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's bugfix scenarios, each replaying the calls the
// investigation's skill makes, in its order, from start this work: the
// investigation entered at its one topic, the hunt logged on its entries,
// the plan and check-in gates, the live server's permission asked at the
// investigation's own level, both validations briefed and taken in — the
// root cause's finding asked of the person as what the product should do,
// the fix's raised replacing the fix, each surfaced as what it was raised
// as and its report closed, the board saying which validation raised it,
// the fix validated again — the fix direction raised and logged once
// decided, and the conclude gate's yes handing off into the spec —
// reopened by a gap before the spec, entered again with its resume's reads
// and concluded again, its recap naming this time the unit whose code the
// bug is in; then the specification, into the build. And a bugfix moved to
// a feature from its
// investigation, its cause in the design: the root cause's validation taken
// in, the fix direction reworking the area as a feature with no validation
// of its own, start this work's screen and its yes, the feature's
// discussion reading the investigation as its earlier log at its first
// opening. And a bugfix whose investigation's gates the person has always
// said yes at, the decision point stepping them as it will once the learned
// gates are switched on: the plan, the check-in and the conclude each run as
// a learned step, logged as one, the conclude's yes standing over a call the
// person changed, and ready to build, its count as long, stopping before any
// code; then the replay of a lower threshold, which would have stopped at
// each of those steps.
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
const {
  Sim, startUnit, enterEntry, handoff, answerGate, gatesAnswered, continueUnit, startRow, startNew, specToBuild,
  investigationCache, rootCaused, reported, validated, fixDirected, concluded,
} = require('./pipeline-world.cjs');
const { history, lines, DAY } = require('./trust-world.cjs');
const { trustLines } = require('./pipeline-oracle.cjs');
const decisionPoint = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/decision-point.cjs'));
const { TRUST_LOG } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/trust-log.cjs'));

const CLAUDES = Object.freeze({ by: 'claude', who_moved_whom: 'none' });

/** A call raised to the person, a row for each key, the first its lean. @param {string} question @param {string[]} keys */
const callOf = (question, keys) => JSON.stringify({
  question,
  rows: keys.map((key) => ({ key, name: `Option ${key}`, text: `The save does ${key}`, notice: `a save does ${key}` })),
  lean: keys[0], why: 'It stops the crash at its cause.', sort: 'one', mechanism: 'The save checks the field.', product_wide: false,
});

/** What raised each wait on the conversation's board. @param {Sim} sim */
const raisersOn = (sim) => sim.run(['board', sim.env.CLAUDE_CODE_SESSION_ID]).view.waiting.map((/** @type {{raised_by: string|null}} */ { raised_by: by }) => by);

/**
 * The hunt with each validation finding what reaches the person (19.4.7,
 * 19.4.10, 20.S18): the root cause's finding landed, asked as a question
 * of what the product should do and surfaced as it, its report closed; the
 * fix direction; the fix's finding landed, raised replacing the fix and
 * surfaced as that replacement, its report closed; the fix validated
 * again. Each answered with Claude's lean. Answers what the board said
 * raised each, while it waited.
 * @param {Sim} sim @param {string} wu
 */
async function huntedAsking(sim, wu) {
  const at = `${wu}.investigation.${wu}`;
  const landed = (/** @type {string} */ text) => sim.run(['ledger', 'find', at], null, JSON.stringify({ ...CLAUDES, text, how: 'Read the save path.', known: 'read' })).id;
  await rootCaused(sim, wu, { live: true });
  const rootCheck = reported(sim, wu, 'root-cause', ['F1']);
  landed('A crash mid-save leaves a half-written file.');
  const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...CLAUDES, text: 'Should a crashed save keep the half-written file?' })).id;
  const kept = (await sim.runAsync(['raise', at, '--answers', asked], null, callOf('Should a crashed save keep the half-written file?', ['hold', 'drop']))).raise;
  sim.run(['agent', 'surface', wu, 'investigation', wu, rootCheck, 'F1', '--question', asked]);
  sim.run(['agent', 'incorporate', wu, 'investigation', wu, rootCheck]);
  const byRoot = raisersOn(sim);
  sim.run(['raise', 'answer', kept, '--pick', 'hold'], null, JSON.stringify({ why: 'A half file shows what was lost.' }));
  sim.run(['investigation-log', 'validation', wu, 'root-cause', '--found', 'A crash mid-save leaves a half file', '--did', 'Asked you']);

  await fixDirected(sim, wu);
  const fix = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions.find((/** @type {{text: string}} */ d) => d.text === 'Check the field before the save writes it').id;
  const fixCheck = reported(sim, wu, 'fix', ['F1']);
  const cause = landed('Checking the field leaves the half-written file a crash makes.');
  const replaced = (await sim.runAsync(['raise', at, '--replaces', fix, '--reason', 'new-fact', '--cause', cause], null, callOf('Should the fix also write the save atomically?', ['atomic', 'check']))).raise;
  sim.run(['agent', 'surface', wu, 'investigation', wu, fixCheck, 'F1', '--replaces', fix, '--reason', 'new-fact']);
  sim.run(['agent', 'incorporate', wu, 'investigation', wu, fixCheck]);
  const byFix = raisersOn(sim);
  sim.run(['raise', 'answer', replaced, '--pick', 'atomic'], null, JSON.stringify({ why: 'No half file at all.' }));
  sim.run(['investigation-log', 'validation', wu, 'fix', '--found', 'Checking alone leaves a half file', '--did', 'Asked you']);
  validated(sim, wu, 'fix');
  return [byRoot, byFix];
}

describe('pipeline simulation: bugfix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('bugfix (19.S8, 22.S21, 24.S17, 11.S19): the investigation through its own verbs to its conclude → a gap answered before the spec, concluded again → the spec, entered at the unit, to ready to build', async () => {
    const wu = 'crash-fix';
    startUnit(sim, 'feature', 'saving', 'Saving the file');
    startNew(sim);
    const started = startUnit(sim, 'bugfix', wu, 'Fix the crash');
    assert.deepStrictEqual(started.next, { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', wu] });

    handoff(sim, `/leeway-investigation-process bugfix ${wu}`);
    assert.deepStrictEqual(await huntedAsking(sim, wu), [['root-cause'], ['fix']], 'the board says which validation raised each');
    const { decisions, findings } = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual([findings.map((f) => f.text), decisions.map((d) => d.text)], [
      ['The save writes a null field on every crash.', 'A crash mid-save leaves a half-written file.', 'Checking the field leaves the half-written file a crash makes.'],
      ['The save writes a null that nothing checks.', 'The save does hold', 'The save does atomic'],
    ], 'the hunt\'s findings, its root cause, the person\'s answer and the fix as replaced stand on the topic\'s record (19.S8), and the live server\'s permission never does');
    concluded(sim, wu);
    // A session that stops here carries on from the start menu, the bugfix's
    // row saying where it stands, and its Continue hands off where the
    // conclude does.
    assert.strictEqual(startRow(sim, wu), 'Continue bugfix: Crash Fix — *specification*');
    assert.strictEqual(continueUnit(sim, wu).line, `→ Specification · ${wu}`);
    // The knowledge base reaches the root cause through the topic's record
    // (22.6.8).
    const query = async (/** @type {string} */ terms) => (await sim.engineAsync(['knowledge', 'query', terms])).stdout;
    assert.match(await query('null nothing checks'), /^\[record \| crash-fix\/crash-fix \| /m);

    // A gap routed back before the spec lands in the topic's mailbox, waiting
    // for its investigation: the delivery reopens the item, and the start
    // menu's row has the bugfix back in its investigation, mail waiting.
    sim.write('.leeway/.cache/scratch/gap-message.md', 'Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/gap-message.md', '--slug', 'retry-semantics']);
    assert.strictEqual(gapLand.reopened, true);
    assert.strictEqual(startRow(sim, wu), 'Continue bugfix: Crash Fix — *investigation* · mail waiting');

    // The investigation entered again raises the message first, and makes
    // its resume's reads; the message's question goes on the map and the
    // message comes off the mailbox; the person's answer decides it, and the
    // investigation concludes again.
    enterEntry(sim, wu, 'investigation');
    assert.match(sim.sections, /^=== DISPLAY: waiting mail /m);
    for (const view of ['product', 'record', 'map']) sim.read(['ledger', view, wu, wu]);
    await query('save crash');
    const gapMailbox = sim.run(['topic', 'mailbox', wu, wu]);
    assert.deepStrictEqual(gapMailbox.files, [path.join(sim.dir, `.leeway/${wu}/topics/${wu}/mail/001-retry-semantics.md`)]);
    const gapQuestion = sim.run(['ledger', 'ask', `${wu}.investigation.${wu}`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What are the retry semantics?' }));
    sim.run(['topic', 'answered', wu, wu, '001-retry-semantics', '--entry', gapQuestion.id]);
    assert.strictEqual(sim.run(['topic', 'mailbox', wu, wu]).files.length, 0);
    sim.run(['ledger', 'decide', `${wu}.investigation.${wu}`, '--answers', gapQuestion.id], null,
      JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'Retry twice, then fail.', why: 'The spec needs a bound.' }));
    const record = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual(record.decisions.filter((d) => d.answers === gapQuestion.id).map((d) => d.text), ['Retry twice, then fail.'],
      'the question the message raised stands decided on the topic\'s record');
    concluded(sim, wu, { fixes: 'saving' });

    // The spec, entered at the unit — its route naming no topic — through its
    // corridor to ready to build's pick; the spec is never indexed (11.1.2).
    assert.strictEqual(continueUnit(sim, wu).line, `→ Specification · ${wu}`);
    specToBuild(sim, wu, [wu]);
    assert.doesNotMatch(await query('holds as decided'), /^\[specification \|/m);
    // A build by its cut leaves nothing to revisit — never the spec
    // (11.9.1), nor the investigation the spec closed (4.11.2).
    sim.refuses(['render', 'revisit-phases', wu], /"crash-fix" has no completed earlier phase to revisit/);
  });

  it('bugfix moved to a feature from its investigation (19.S30, 19.4.22): the fix direction reworking the area as a feature, logged as it is picked → start this work\'s screen and its yes re-typing the unit → its discussion, at its first opening, reading the investigation\'s log and record as its earlier ones', async () => {
    const wu = 'save-crash';
    startNew(sim);
    startUnit(sim, 'bugfix', wu, 'Fix the crash');
    handoff(sim, `/leeway-investigation-process bugfix ${wu}`);
    await rootCaused(sim, wu);
    validated(sim, wu, 'root-cause');
    await fixDirected(sim, wu, { pick: 'rework', design: true });
    const hunt = fs.readFileSync(path.join(sim.dir, `.leeway/${wu}/topics/${wu}/log.md`), 'utf8');
    assert.match(hunt, /^## Fix direction\n\n- How should the save stop crashing\? \[\w+\]\n {4}The save was right for the fields it knew/m,
      'the fix direction is logged once it is decided, carrying what the step back found');

    // The move, as the skill stages it once the root cause's validation is
    // taken in and with none of the fix's: the feature's brief drafted from
    // the investigation, start this work's screen, the person's yes.
    const brief = sim.write(investigationCache(wu, 'brief.md'), '# Saving\n\nThe save meets a null it was never built for.\n');
    sim.run(['workunit', 'move', wu, '--to', 'feature', '--file', sim.write(investigationCache(wu, 'move.json'), {
      description: 'Rework saving', reason: 'The crash is the design\'s: saving meets fields it was never built for.', brief,
    })]);
    const { next } = sim.run(answerGate(sim, 'start this work', '--pick', 'y').next.argv);
    const route = `/leeway-discussion-process feature ${wu}`;
    assert.strictEqual([`/${next.skill}`, ...next.args].join(' '), route, 'the move hands off into the feature\'s discussion');
    handoff(sim, route);

    // Its first opening reads the investigation as its earlier log, and the
    // root cause on its earlier record, never changed.
    enterEntry(sim, wu, 'discussion', wu);
    const earlier = Object.fromEntries([...sim.sections.matchAll(/^(earlier [a-z]+): (.*)$/gm)].map(([, key, value]) => [key, value]));
    assert.deepStrictEqual(Object.keys(earlier), ['earlier record', 'earlier log']);
    assert.strictEqual(fs.readFileSync(earlier['earlier log'], 'utf8'), hunt);
    assert.deepStrictEqual(JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions.map((d) => d.text), ['The save writes a null that nothing checks.', 'Rework saving as a feature']);
  });

  it('a bugfix whose investigation\'s gates the person always says yes at (19.S17, 16.10.11, 3.S4): the plan, check-in and conclude gates each run as a learned step, nothing answered at them, each logged as a step, the conclude\'s yes standing over the fix the person changed; ready to build, as long answered alike, still stops before any code; and a lower threshold\'s replay would have stopped at each step', async (t) => {
    // Each showing told by its place alone, so the run draws as the unit's
    // name says, whatever time its recap is staged at: none blind here.
    const wu = 'save-null';
    const { project_id: project } = JSON.parse(fs.readFileSync(path.join(sim.dir, '.leeway/manifest.json'), 'utf8'));
    const seeded = history({ project, start: Date.now() - DAY });
    for (const gate of ['plan gate', 'check-in gate', 'conclude gate']) for (let i = 0; i < 13; i += 1) seeded.gate(gate, { picked: 'y' });
    for (let i = 0; i < 13; i += 1) seeded.gate('ready to build', { picked: 's' });
    fs.writeFileSync(path.join(sim.configDir, TRUST_LOG), lines(...seeded.events));
    t.mock.method(decisionPoint, 'gateStep', (/** @type {string} */ name, /** @type {any} */ at) => decisionPoint.learned(name, { ...at, key: null }));

    startNew(sim);
    startUnit(sim, 'bugfix', wu, 'Fix the crash');
    handoff(sim, `/leeway-investigation-process bugfix ${wu}`);
    await rootCaused(sim, wu);
    validated(sim, wu, 'root-cause');
    await fixDirected(sim, wu, { pick: '2' });
    validated(sim, wu, 'fix');
    concluded(sim, wu);

    specToBuild(sim, wu, [wu]);
    assert.deepStrictEqual(gatesAnswered(sim).slice(seeded.events.length), ['start menu', 'start this work', 'ready to build']);
    const steps = [...new Map(trustLines(sim).map((line) => JSON.parse(line)).filter(({ type }) => type === 'step').map((step) => [step.id, [step.gate, step.row]])).values()];
    assert.deepStrictEqual(steps, [['plan gate', 'y'], ['check-in gate', 'y'], ['conclude gate', 'y']]);
    const replayed = sim.render(['matrix-replay', '--threshold', '15'], { expect: 'content' }).replace(/\s+/g, ' ');
    assert.ok(replayed.includes('at the gates that learn from your answers, 15% would have stopped at 3 of the 3 stops I went on past.'), replayed);
  });
});
