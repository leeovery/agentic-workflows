'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build-phase scenario: a phase of a unit's cut as
// the build runs it — the task writer briefed from the cut and the phase's
// tasks written through the `task` verbs; its task's builder laying the task
// out in the worktree its isolation made, building the verify setup there,
// its mutation tool among it, committing it through the door, recording it
// once it ran end to end and proving the task's scenario by running it from
// that worktree; a note for later banked; the pair's reports and the
// builder's account each written as the agents write them — a `.txt` beside
// the file their brief names, renamed to it — and taken from there; then the
// mutation tool run once over the phase, and the consolidation agent's
// report and the phase review's landing where their readers find them.
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
  Sim, startUnit, discussed, specToBuild, writePhaseTasks, worldFrom,
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

/**
 * The file a brief names under its heading `heading`, read from the brief the
 * conversation stored. @param {Sim} sim @param {{id: string}} res @param {string} heading
 */
function placeIn(sim, res, heading) {
  const brief = withEnv({ LEEWAY_CONFIG_DIR: sim.configDir }, () => fs.readFileSync(briefPath(sim.env.CLAUDE_CODE_SESSION_ID, res.id), 'utf8'));
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

  it('the task writer briefed from the cut writes the phase\'s tasks; the builder, in its task\'s worktree, builds the verify setup and proves the task\'s scenario by running it; the pair\'s reports, the account and the consolidation report land where their readers find them; the phase review reads the runs and the survivors at the phase\'s HEAD', () => {
    const wu = WU;
    assert.strictEqual(sim.run(['brief', 'task-writer', wu, '1']).agent, 'leeway-task-writer');
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger' }]);
    sim.run(['task', 'start', wu, '1.1']);
    const account = placeIn(sim, sim.run(['brief', 'builder', wu, '1.1']), 'Where your account goes');

    // The builder lays its task out in the worktree its isolation made, and
    // builds, commits and proves it there (12.7.10, 15.2.14).
    const tree = path.join(builders, 'agent-1');
    git(sim.dir, ['worktree', 'add', '-q', '-b', 'worktree-agent-1', tree]);
    sim.runIn(tree, ['task', 'worktree', wu, '1.1']);
    fs.mkdirSync(path.join(tree, 'verify'));
    fs.writeFileSync(path.join(tree, 'verify', 'features.md'), '# Features\n');
    fs.writeFileSync(path.join(tree, 'verify', 'drive.sh'), '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n', { mode: 0o755 });
    sim.runIn(tree, ['commit', '--paths', 'verify/features.md', 'verify/drive.sh', '--task', wu, '1.1', '-m', 'feat(ledger): the verify setup']);
    const setup = path.join(sim.dir, sim.write(`.leeway/.cache/${wu}/build/verify-setup.json`, {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      mutation: 'echo "[]" > "$LEEWAY_RUN/survivors.json"',
    }));
    sim.runIn(tree, ['verify', 'setup', wu, '--file', setup, '--scenario', '1.S1']);
    const run = sim.runIn(tree, ['verify', 'run', wu, '1.S1']);
    const ranFor = JSON.parse(fs.readFileSync(path.join(sim.dir, '.leeway', run.run), 'utf8')).task;
    assert.deepStrictEqual([run.standing, ranFor], ['proven', '1.1'], 'the run from the task\'s worktree proves its scenario, for the task');
    sim.run(['task', 'note', wu, '--file', sim.write(`.leeway/.cache/${wu}/build/note.md`, 'Reading the ledger back never checks its hash.\n')]);

    // The pair report, the builder writes its account, and the account is
    // taken from where each was written (13.5.9, 12.14).
    for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', wu, '1.1', '--base', 'main', '--letter', letter]), 'Where your report goes'), PASSED);
    landed(account, [
      '## What was done', 'The ledger is written.', '## Where in the code', '- verify/', '## What the tests prove', '- 1.S1: proven, by its run.',
      '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
    ].join('\n\n'));
    assert.deepStrictEqual(sim.run(['task', 'account', wu, '1.1']).rounds, 1, 'the account and the round\'s reports are read where the agents wrote them');
    sim.run(['task', 'done', wu, '1.1']);

    // The phase's end: the tool run once from the checkout holding the
    // phase's commits, the consolidation agent's report, then the pair.
    const head = git(tree, ['rev-parse', 'HEAD']).trim();
    assert.deepStrictEqual(sim.runIn(tree, ['verify', 'mutants', wu, '1']).survivors, [], 'the mutation tool runs once, before the pair is briefed');
    const consolidation = placeIn(sim, sim.run(['brief', 'consolidation', wu, '1', '--base', 'main']), 'Where the report goes');
    landed(consolidation, '## The notes\n\n- Note 1: dropped — the ledger checks its hash on read.\n');
    assert.deepStrictEqual(consolidationFaults(sim.dir, wu, 1), [], 'the report is read where the agent wrote it, its note taken');
    for (const letter of ['a', 'b']) {
      const review = sim.run(['brief', 'phase-review', wu, '1', '--base', 'main', '--head', head, '--letter', letter]);
      landed(placeIn(sim, review, 'Where your report goes'), PASSED);
    }
    assert.deepStrictEqual(['a', 'b'].map((letter) => fs.existsSync(path.join(sim.dir, `.leeway/${wu}/build/phases/phase-1/review-${letter}.md`))), [true, true]);
  });
});
