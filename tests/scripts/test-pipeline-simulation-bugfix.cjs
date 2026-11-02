'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's bugfix scenario: investigation, the
// specification with its source pinned to the topic, delivery, and the
// unit complete.
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
  Sim, startUnit, handoffEntry, handoff, linearMenu, linearPick, backToStart, startNew, walkDeliveryPhases, specToBuild,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: bugfix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('bugfix: investigation → a gap answered before the spec → the spec, entered at the unit, to ready to build → delivery → complete', async () => {
    const wu = 'crash-fix';
    startNew(sim, 'bugfix');
    const started = startUnit(sim, 'bugfix', wu, 'Fix the crash');
    assert.deepStrictEqual(started.next, { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', wu] });

    handoff(sim, `/leeway-investigation-process bugfix ${wu}`);
    handoffEntry(sim, wu, 'investigation', wu);
    sim.run(['topic', 'start', wu, 'investigation', wu]);
    sim.write(`.leeway/${wu}/investigation/${wu}.md`, `# Investigation — ${wu}\n`);

    // A synchronous validation: dispatch, the foreground agent lands its
    // verdict, scan promotes, the row closes consumed — never surfaced.
    const val = sim.run(['agent', 'dispatch', wu, 'investigation', wu, '--kind', 'root-cause-validation']);
    sim.write(val.file, '# Verdict\n\nSTATUS: validated\n');
    sim.run(['agent', 'scan', wu, 'investigation', wu]);
    const closed = sim.run(['agent', 'incorporate', wu, 'investigation', wu, val.id]);
    assert.strictEqual(closed.status, 'incorporated');

    // The findings sign-off (findings-signoff B) is read from the
    // investigation file, and the gate refuses a topic that has none.
    assert.match(sim.render(['findings-signoff-gate', `${wu}.investigation.${wu}`], { expect: 'content' }),
      /◆ Do these findings match your understanding\?/);
    sim.refuses(['render', 'findings-signoff-gate', `${wu}.investigation.never-traced`],
      /no investigation file for "never-traced" — the sign-off is read from the record/);

    sim.run(['commit', wu, '-m', `investigation(${wu}): root cause`, '--topic', `investigation/${wu}`]);
    sim.render(['conclude-gate', `${wu}.investigation.${wu}`], { expect: 'content' });
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    // A session that stops here resumes from the bugfix's continue menu, which
    // hands off where the bridge does — or goes back to the start menu, where
    // the bugfix is still the row it was picked from.
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    assert.ok(backToStart(sim, linearMenu(sim, wu).keys)
      .some((k) => k.action === 'continue_work_unit' && k.route === `/leeway-continue-linear ${wu}`));

    // A gap routed back before the spec lands in the topic's mailbox, waiting
    // for its investigation: the delivery reopens the item, the question it
    // raised answers it, and the investigation re-concludes.
    const provenance = async () => (await sim.engineAsync(['knowledge', 'query', 'investigation', 'spec'])).stdout;
    const reopenedLine = /^\[investigation \| crash-fix\/crash-fix \| medium \| \d{4}-\d{2}-\d{2} \| reopened\]$/m;
    const concludedLine = /^\[investigation \| crash-fix\/crash-fix \| medium \| \d{4}-\d{2}-\d{2}\]$/m;
    sim.write('.leeway/.cache/scratch/gap-message.md', 'Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/gap-message.md', '--slug', 'retry-semantics']);
    assert.strictEqual(gapLand.reopened, true);
    assert.match(await provenance(), reopenedLine, 'a landing that reopens marks the topic reopened');
    // The reopened investigation's rows say what waits — the start menu
    // entry and the bugfix pipeline row — and answering it retires the cue.
    const startRow = () => startMenu(START_GATEWAY.discover(sim.dir)).keys
      .map((k) => drawLabel(k.label)).find((label) => label.startsWith('Continue "Crash Fix"'));
    const bugfixUnit = () => LIB.detail.activeWorkUnit(sim.dir, wu).unit;
    assert.strictEqual(startRow(), 'Continue "Crash Fix" — *bugfix, investigation (in-progress)* · mail waiting');
    assert.deepStrictEqual(bugfixUnit().mail_phases, ['investigation']);
    assert.match(workUnitStatus('bugfix', bugfixUnit()), /◐ Investigation +\[in-progress · mail waiting\]/);
    const gapMailbox = sim.run(['topic', 'mailbox', wu, wu]);
    assert.deepStrictEqual(gapMailbox.files, [path.join(sim.dir, `.leeway/${wu}/topics/${wu}/mail/001-retry-semantics.md`)]);
    // Until investigation writes entries of its own (29.15), the decision the
    // spec cites is written on the investigation's place (E9).
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
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    assert.match(await provenance(), concludedLine, 'the marker goes as the topic concludes again');

    // The spec, entered at the unit — its route naming no topic — through its
    // corridor to ready to build's pick; the spec is never indexed (11.1.2).
    assert.strictEqual(linearPick(sim, wu, 'continue').line, `→ Specification · ${wu}`);
    specToBuild(sim, wu, [wu]);
    assert.doesNotMatch(await provenance(), /^\[specification \|/m);
    walkDeliveryPhases(sim, wu, wu);
    // The bugfix review hop offers all three rows; what a revisit reaches is
    // the delivery behind it — never the spec (11.9.1), nor the
    // investigation the spec closed (4.11.2).
    const bfGate = sim.render(['next-phase-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    assert.match(bfGate, /\*\*`d\/done`\*\* +→ Complete without review/);
    assert.match(bfGate, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);
    assert.deepStrictEqual([...sim.render(['revisit-phases', wu], { expect: 'content' }).matchAll(/→ (\w+) — \*completed\*/g)].map((m) => m[1]), ['Planning', 'Implementation', 'Review']);
    // Past its spec the investigation is not reopened: a change is settled
    // in the spec.
    sim.refuses(['topic', 'reopen', wu, 'investigation', wu], /^crash-fix has its spec — a topic exists only before it/);

    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    // Completed, the unit takes no message and opens no topic, each refusal
    // naming the way on, the message's scratch kept.
    sim.write('.leeway/.cache/scratch/late-message.md', 'A late thought\n');
    sim.refuses(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/late-message.md', '--slug', 'late-thought'], /^crash-fix is completed — new work starts from the start menu$/);
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway/.cache/scratch/late-message.md')), 'the refused send keeps its scratch');
    sim.refuses(['handoff', 'topic', wu, wu], /^crash-fix is completed — new work starts from the start menu$/);
  });
});
