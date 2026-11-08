'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's bugfix scenarios, each replaying the calls the
// investigation's skill makes, in its order, from start this work: the
// investigation entered at its one topic, the hunt logged on its entries,
// the plan and check-in gates, the live server's permission asked at the
// investigation's own level, both validations briefed and taken in, the
// fix direction raised and logged once decided, and the conclude gate's
// yes handing off into the spec — reopened by a gap before the spec,
// entered again with its resume's reads and concluded again, its recap
// naming this time the unit whose code the bug is in; then the
// specification, into the build. And a bugfix moved to a feature from its
// investigation, its cause in the design: the root cause's validation taken
// in, the fix direction reworking the area as a feature with no validation
// of its own, start this work's screen and its yes, the feature's
// discussion reading the investigation as its earlier log at its first
// opening.
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
  Sim, startUnit, enterEntry, handoff, answerGate, linearMenu, linearPick, backToStart, startNew, specToBuild,
  investigationCache, rootCaused, validated, fixDirected, hunted, concluded,
} = require('./pipeline-world.cjs');

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
    await hunted(sim, wu, { live: true });
    const { decisions, findings } = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual([findings.map((f) => f.text), decisions.map((d) => d.text)], [
      ['The save writes a null field on every crash.'],
      ['The save writes a null that nothing checks.', 'Check the field before the save writes it'],
    ], 'the hunt\'s finding, its root cause and its fix stand on the topic\'s record (19.S8), and the live server\'s permission never does');
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
    // for its investigation: the delivery reopens the item, and the start
    // menu's row and the bugfix's pipeline row say what waits.
    sim.write('.leeway/.cache/scratch/gap-message.md', 'Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/gap-message.md', '--slug', 'retry-semantics']);
    assert.strictEqual(gapLand.reopened, true);
    const startRow = () => startMenu(START_GATEWAY.discover(sim.dir)).keys
      .map((k) => drawLabel(k.label)).find((label) => label.startsWith('Continue "Crash Fix"'));
    const bugfixUnit = () => LIB.detail.activeWorkUnit(sim.dir, wu).unit;
    assert.strictEqual(startRow(), 'Continue "Crash Fix" — *bugfix, investigation (in-progress)* · mail waiting');
    assert.deepStrictEqual(bugfixUnit().mail_phases, ['investigation']);
    assert.match(workUnitStatus('bugfix', bugfixUnit()), /◐ Investigation +\[in-progress · mail waiting\]/);

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
    assert.strictEqual(startRow(), 'Continue "Crash Fix" — *bugfix, investigation (in-progress)*', 'the answered mailbox retires the cue');
    assert.strictEqual(bugfixUnit().mail_phases, undefined);
    sim.run(['ledger', 'decide', `${wu}.investigation.${wu}`, '--answers', gapQuestion.id], null,
      JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'Retry twice, then fail.', why: 'The spec needs a bound.' }));
    const record = JSON.parse(sim.read(['ledger', 'record', wu, wu]));
    assert.deepStrictEqual(record.decisions.filter((d) => d.answers === gapQuestion.id).map((d) => d.text), ['Retry twice, then fail.'],
      'the question the message raised stands decided on the topic\'s record');
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

  it('bugfix moved to a feature from its investigation (19.S30, 19.4.22): the fix direction reworking the area as a feature, logged as it is picked → start this work\'s screen and its yes re-typing the unit → its discussion, at its first opening, reading the investigation\'s log and record as its earlier ones', async () => {
    const wu = 'save-crash';
    startNew(sim, 'bugfix');
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
});
