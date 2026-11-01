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
  Sim, startUnit, handoffEntry, handoff, linearMenu, linearPick, backToStart, startNew, walkDeliveryPhases,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: bugfix', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('bugfix: investigation → spec (source pinned to topic) → delivery → complete', async () => {
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

    // The bugfix spec source name is pinned to the topic.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });
    // The bugfix review hop offers all three rows — investigation, spec and
    // planning sit behind it as revisit candidates.
    const bfGate = sim.render(['next-phase-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    assert.match(bfGate, /\*\*`d\/done`\*\* +→ Complete without review/);
    assert.match(bfGate, /\*\*`r\/revisit`\*\* → Revisit an earlier phase/);

    // The investigation hop takes the same reverse join as a discussion's: a
    // gap routed back reopens the investigation, stales the spec row naming
    // it, and the entry gate refuses until the investigation re-concludes.
    const invReopen = sim.run(['topic', 'reopen', wu, 'investigation', wu]);
    assert.deepStrictEqual(invReopen.sources_staled, [wu]);
    const bugSpec = sim.manifest(wu).phases.specification.items[wu];
    assert.strictEqual(bugSpec.sources[wu].status, 'stale');
    assert.strictEqual(bugSpec.reconcile_needed, 'investigation');
    // The reopened investigation's chunks stay live, a query marking them
    // reopened; the spec's stay unmarked — still the concluded record.
    const provenance = async () => (await sim.engineAsync(['knowledge', 'query', 'investigation', 'spec'])).stdout;
    const reopenedLine = /^\[investigation \| crash-fix\/crash-fix \| medium \| \d{4}-\d{2}-\d{2} \| reopened\]$/m;
    const concludedLine = /^\[investigation \| crash-fix\/crash-fix \| medium \| \d{4}-\d{2}-\d{2}\]$/m;
    const whileReopened = await provenance();
    assert.match(whileReopened, reopenedLine);
    assert.match(whileReopened, /^\[specification \| crash-fix\/crash-fix \| high \| \d{4}-\d{2}-\d{2}\]$/m);
    sim.refuses(['topic', 'complete', wu, 'specification', wu], /unresolved source rows|completed/);
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    assert.match(await provenance(), concludedLine, 'the marker goes as the topic concludes again');
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);
    sim.render(['entry-gate', `${wu}.specification.${wu}`], { expect: 'empty' });

    // A spec-routed gap lands in the topic's mailbox, waiting for its
    // investigation: the delivery reopens the item and stales the spec row;
    // the mailbox answers; the question it raised answers it, and the
    // pipeline re-concludes.
    sim.write('.leeway/.cache/scratch/gap-message.md', 'Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'send', wu, wu, '--from', wu, '--content', '.leeway/.cache/scratch/gap-message.md', '--slug', 'retry-semantics']);
    assert.strictEqual(gapLand.reopened, true);
    assert.deepStrictEqual(gapLand.sources_staled, [wu]);
    assert.match(await provenance(), reopenedLine, 'a landing that reopens marks it as a reopen does');
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
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);

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
