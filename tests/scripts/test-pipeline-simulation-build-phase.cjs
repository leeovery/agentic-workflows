'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build-phase scenario: a phase of a unit's cut as
// the build runs it — the build entered once ready to build's yes began it,
// its phase not yet written, the build's log appended and carried by the
// state's commits; the task writer briefed from the cut and the phase's
// tasks written through the `task` verbs, a task refused its start until the
// phase's start checklist closes; its task's builder laying the task
// out in the worktree its isolation made, building the verify setup there,
// its mutation tool among it, committing it through the door, recording it
// once it ran end to end and proving the task's scenario by running it from
// that worktree, its evidence kept; a note for later banked; the pair's reports and the
// builder's account each written as the agents write them — a `.txt` beside
// the file their brief names, renamed to it — and taken from there; the
// task opened and chained into its phase's stack; then the
// mutation tool run once over the phase, and the consolidation agent's
// report and the phase review's landing where their readers find them, one
// reviewer failing it, its fixes owed until the orchestrator settles it; the
// stack merged and the phase's close taken on the engine's items alone.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase — a copy per scenario,
// which replays the engine calls the build makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateGit, git, withEnv } = require('./engine-harness.cjs');
const {
  Sim, startUnit, discussed, specToBuild, buildEntry, startPhase, writePhaseTasks, worldFrom, carryOn,
} = require('./pipeline-world.cjs');

const DOMAIN = path.join(__dirname, '../../skills/leeway-engine/scripts/domain');
const { briefPath } = require(path.join(DOMAIN, 'brief-names.cjs'));
const { consolidationFaults } = require(path.join(DOMAIN, 'notes.cjs'));

const WU = 'ledger';

/** A feature through its spec to ready to build's pick: its cut, one phase. */
const builtWorld = worldFrom('pipeline-build-phase-', (sim) => {
  startUnit(sim, 'feature', WU, 'A ledger');
  discussed(sim, WU, WU);
  specToBuild(sim, WU, [WU], 'a');
});

/** A brief as the conversation stored it. @param {Sim} sim @param {{id: string}} res */
const briefOf = (sim, res) => withEnv({ LEEWAY_CONFIG_DIR: sim.configDir }, () => fs.readFileSync(briefPath(sim.env.CLAUDE_CODE_SESSION_ID, res.id), 'utf8'));

/** The file a brief names under its heading `heading`. @param {Sim} sim @param {{id: string}} res @param {string} heading */
function placeIn(sim, res, heading) {
  const brief = briefOf(sim, res);
  return /`([^`]+)`/.exec(brief.slice(brief.indexOf(`# ${heading}\n`)))?.[1] ?? '';
}

/** A file written as a build agent writes it: a `.txt` beside it, renamed to it. @param {string} file @param {string} text */
function landed(file, text) {
  const staged = `${file.slice(0, -'.md'.length)}.txt`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(staged, text);
  fs.renameSync(staged, file);
}

const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';
const OFF_PHASE = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';

describe('pipeline simulation: a phase of the cut', () => {
  let sim;
  /** @type {string} */ let builders;
  beforeEach(() => {
    sim = new Sim(builtWorld);
    builders = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-builders-')));
  });
  afterEach(() => {
    sim.destroy();
    fs.rmSync(builders, { recursive: true, force: true });
  });

  it('the build entered; the task writer briefed from the cut writes the phase\'s tasks and the phase starts; the builder, in its task\'s worktree, builds the verify setup and proves the task\'s scenario by running it; the pair\'s reports, the account and the consolidation report land where their readers find them; the task chains into the phase\'s stack; the phase review reads the runs and the survivors at the phase\'s tips; the stack merges and the phase closes', () => {
    const wu = WU;
    const entered = buildEntry(sim, wu);
    assert.deepStrictEqual(entered.filter((line) => line.startsWith('phase: ')), ['phase: phase 1 of 1, "The work": not yet written'], 'a phase not yet written reads so (7.4.2)');
    sim.write(`.leeway/${wu}/build/log.md`, '# The build\n\nPhase 1: its tasks are being written.\n');
    assert.strictEqual(sim.run(['brief', 'task-writer', wu, '1']).agent, 'leeway-task-writer');
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
    sim.refuses(['task', 'start', wu, '1.1'], /^task start: phase 1 of ledger has not started — /);
    startPhase(sim, wu, 1);
    assert.ok(stateGit(sim.dir, ['ls-files', '--', `${wu}/build/log.md`]).trim() !== '', 'the build\'s log rides the state\'s commits (12.2.3)');
    assert.ok(carryOn(sim).text.includes(path.join(sim.dir, `.leeway/${wu}/build/log.md`)), 'a compaction re-reads the build\'s log (12.S4)');
    sim.run(['task', 'start', wu, '1.1']);
    const builder = sim.run(['brief', 'builder', wu, '1.1']);
    const account = placeIn(sim, builder, 'Where your account goes');

    // The builder lays its task out in the worktree its isolation made, and
    // builds, commits and proves it there (12.7.10, 15.2.14).
    const tree = path.join(builders, 'agent-1');
    git(sim.dir, ['worktree', 'add', '-q', '-b', 'worktree-agent-1', tree]);
    sim.runIn(tree, ['task', 'worktree', wu, '1.1']);
    fs.mkdirSync(path.join(tree, 'verify'));
    fs.writeFileSync(path.join(tree, 'verify', 'features.md'), '# Features\n');
    fs.writeFileSync(path.join(tree, 'verify', 'drive.sh'), '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n', { mode: 0o755 });
    sim.runIn(tree, ['commit', '--paths', 'verify/features.md', 'verify/drive.sh', '--task', wu, '1.1', '-m', 'feat(ledger): the verify setup']);
    const setup = placeIn(sim, builder, 'Where the verify setup goes');
    fs.mkdirSync(path.dirname(setup), { recursive: true });
    fs.writeFileSync(setup, JSON.stringify({
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh',
      evidence: 'mkdir -p "$LEEWAY_RUN/evidence" && echo read back > "$LEEWAY_RUN/evidence/screen.txt"', cleanup: 'true',
      mutation: 'echo "[]" > "$LEEWAY_RUN/survivors.json"',
    }));
    sim.runIn(tree, ['verify', 'setup', wu, '--file', setup, '--scenario', '1.S1']);
    const run = sim.runIn(tree, ['verify', 'run', wu, '1.S1']);
    const recorded = JSON.parse(fs.readFileSync(path.join(sim.dir, '.leeway', run.run), 'utf8'));
    assert.deepStrictEqual([run.standing, recorded.task, recorded.evidence.map((/** @type {{name: string}} */ kept) => kept.name)], ['proven', '1.1', ['screen.txt']],
      'the run from the task\'s worktree proves its scenario, for the task, its evidence kept (15.S1, 15.S4)');
    sim.run(['task', 'note', wu, '--file', sim.write(`.leeway/.cache/${wu}/build/note.md`, 'Reading the ledger back never checks its hash.\n')]);

    // The pair report, the builder writes its account, and the account is
    // taken from where each was written (13.5.9, 12.14).
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', wu, '1.1', '--base', 'main', '--letter', letter]), 'Where your report goes'), PASSED);
    landed(account, [
      '## What was done', 'The ledger is written.', '## Where in the code', '- verify/', '## What the tests prove', '- 1.S1, run through verify: its drive writes an entry and reads it back.',
      '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
    ].join('\n\n'));
    assert.deepStrictEqual(sim.run(['task', 'account', wu, '1.1']).rounds, 1, 'the account and the round\'s reports are read where the agents wrote them');
    sim.run(['land', 'open', wu, '1.1']);
    sim.run(['land', 'chain', wu, '1.1']);
    sim.run(['task', 'done', wu, '1.1']);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', 'manifest.json', `${wu}/build`]), '', 'the setup and the run are on the state branch');

    // The phase's end: the tool run once from a checkout at the phase's
    // tips, the consolidation agent's report, then the pair.
    assert.deepStrictEqual(sim.runIn(tree, ['verify', 'mutants', wu, '1']).survivors, [], 'the mutation tool runs once, before the pair is briefed');
    const consolidation = placeIn(sim, sim.run(['brief', 'consolidation', wu, '1', '--base', 'main']), 'Where the report goes');
    landed(consolidation, '## The notes\n\n- Note 1: dropped — the ledger checks its hash on read.\n');
    assert.deepStrictEqual(consolidationFaults(sim.dir, wu, 1), [], 'the report is read where the agent wrote it, its note taken');
    for (const letter of ['a', 'b']) {
      const review = sim.run(['brief', 'phase-review', wu, '1', '--base', 'main', '--letter', letter]);
      assert.ok(briefOf(sim, review).includes('# Its scenarios\' runs, at the phase\'s tips\n\n- 1.S1: proven\n'), 'the run from the task\'s worktree proves the scenario at the phase\'s tips');
      landed(placeIn(sim, review, 'Where your report goes'), letter === 'a' ? PASSED : OFF_PHASE);
    }
    assert.deepStrictEqual(['a', 'b'].map((letter) => fs.existsSync(path.join(sim.dir, `.leeway/${wu}/build/phases/phase-1/review-${letter}.md`))), [true, true]);

    // One reviewer failed it, on a finding outside the phase: its fixes are
    // owed, and the stack waits, until the orchestrator settles the review
    // naming none (13.10.1).
    assert.ok(buildEntry(sim, wu).some((line) => line.startsWith('fixes owed: phase 1\'s review failed, and no settlement answers it')), 'the standing says the fixes are owed');
    sim.refuses(['land', 'phase', wu, '1'], /— phase 1's review failed, and no settlement answers it — /);
    sim.run(['task', 'settle', wu, '--phase', '1', '--file', sim.write(`.leeway/.cache/${wu}/build/why.md`, 'Checking the hash on read is the next phase\'s.\n')]);

    // The phase review settled, its stack merges, and the phase closes on
    // the engine's items alone (7.2.4, 6.4.9).
    sim.run(['land', 'phase', wu, '1']);
    sim.run(['checklist', 'close', 'phase-close', wu, '1']);
    assert.deepStrictEqual(buildEntry(sim, wu).filter((line) => line.startsWith('phase: ')), ['phase: phase 1 of 1, "The work": merged — tasks 1.1 done'],
      'the build\'s one phase reads merged');
  });
});
