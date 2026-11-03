'use strict';

// ---------------------------------------------------------------------------
// A build phase's close, as the engine checks it (leeway-engine/scripts/
// domain/phase-checks.cjs, through checklist.cjs), each item worked out at
// each call (6.4.9): its tasks passed by their pairs, a settled round among
// them (13.4.6); each scenario proven at the phase's tips or reported not
// proven in every report (15.4.3, 12.S6, 11.S6); its notes consolidated; its
// stack merged, or in step its merge waiting at its gate holding every task
// of the phase (7.2.4, 7.S7); phase 1's close refused until the verify setup
// is recorded (12.3.3, 12.S5); and a close committing every record its
// phase's folder holds. Its review's item and the settlement are
// test-engine-build-checklists-review.cjs; a phase's start, -start.cjs; the
// land verbs' refusals, test-engine-land-verbs.cjs; the checklists' verbs
// and their records, test-engine-checklist.cjs.
//
// Layer: verb. World: the build checklists' world (build-checklists-world.cjs),
// built once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, git, stateGit, writeState, statePath, touched, layout, cleanupFixture,
} = require('./engine-harness.cjs');
const {
  UNIT, SESSION, DROPS_CENTS, branchOf, taskFile, world, checklistHelpers,
} = require('./build-checklists-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const landingGit = require(path.join(SCRIPTS, 'domain/landing-git.cjs'));

/**
 * What `act` answers, and how many times the landing read the branches of a
 * repository while it ran.
 * @template T @param {() => T} act @returns {[T, number]}
 */
function branchReads(act) {
  const { branches } = landingGit;
  let reads = 0;
  landingGit.branches = (/** @type {string} */ root) => {
    reads += 1;
    return branches(root);
  };
  try {
    return [act(), reads];
  } finally {
    landingGit.branches = branches;
  }
}

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

const {
  show, item, manifestWith, landed, round, phaseReport, settle, ran, tipOf, everyItem, verifySetUp,
} = checklistHelpers(() => dir);

describe('a phase\'s close (6.4.9)', () => {
  it('reads its tasks passed once each task not closed passed its pair — every reviewer of a round, or the round settled — a report that does not read said as a warning (13.4.6)', () => {
    const passed = () => item('phase-close', 1, 'tasks-passed');
    const seen = [passed()];
    round('1.1', 1, ['pass', 'pass']);
    round('1.2', 1, ['pass', 'fail']);
    seen.push(passed());
    writeState(dir, layout.unit(UNIT, 'build', 'tasks', '1.2', 'round-1-settled.md'), 'The finding came back fixed; settled.\n');
    seen.push(passed());
    writeState(dir, layout.unit(UNIT, 'build', 'tasks', '1.2', 'round-2-a.md'), '# Review\n\nNo verdict.\n');
    const unread = show('phase-close', 1);
    fs.rmSync(path.join(dir, '.leeway', UNIT, 'build', 'tasks', '1.2'), { recursive: true });
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);

    assert.deepStrictEqual([...seen, unread.items[0].state, passed()], ['open', 'open', 'done', 'open', 'done']);
    assert.match(unread.warnings.join('\n'), /pay\/build\/tasks\/1\.2\/round-2-a\.md does not read as a reviewer's report/);
  });

  it('reads each scenario proven by its runs at the phase\'s tips, or reported not proven, in those words, in every report of its review — a run at code the tips do not hold proving nothing (15.4.3, 12.S6, 11.S6)', () => {
    const reported = () => item('phase-close', 1, 'scenarios-reported');
    const tip = tipOf(branchOf('1.2'));
    const seen = [reported()];
    ran('1.S1', tip, 'pass');
    ran('1.S2', tip, 'pass');
    seen.push(reported());
    ran('1.S2', tip, 'fail');
    phaseReport(1, 'a', ['- serious: 1.S2 not proven — its run fails\n  Scenario: an unknown brand offered'], 'fail');
    phaseReport(1, 'b', [], 'pass');
    seen.push(reported());
    phaseReport(1, 'b', ['- serious: 1.S2 fails at the tips\n  Scenario: an unknown brand offered'], 'fail');
    seen.push(reported());
    phaseReport(1, 'b', ['- serious: 1.S2 reads not proven at the tips\n  Scenario: an unknown brand offered'], 'fail');
    seen.push(reported());
    ran('1.S1', tipOf(branchOf('2.1')), 'pass');

    assert.deepStrictEqual([...seen, reported()], ['open', 'done', 'open', 'open', 'done', 'open']);
  });

  it('proves nothing where the phase\'s tips cannot be read, said as a warning', () => {
    ran('1.S1', tipOf(branchOf('1.2')), 'pass');
    ran('1.S2', tipOf(branchOf('1.2')), 'pass');
    git(dir, ['branch', '-q', '-D', branchOf('1.2'), branchOf('1.1')]);
    const answer = show('phase-close', 1);

    assert.strictEqual(answer.items.find((/** @type {{key: string}} */ shown) => shown.key === 'scenarios-reported').state, 'open');
    assert.match(answer.warnings.join('\n'), /^phase 1 of pay's scenarios are judged at its stack's tips, which cannot be read — no repository of the project holds work on phase 1 of pay's tasks$/m);
  });

  it('reads its notes consolidated once a note waiting is taken by the consolidation\'s record', () => {
    const consolidated = () => item('phase-close', 1, 'notes-consolidated');
    const seen = [consolidated()];
    ok(dir, ['task', 'note', UNIT, '--file', writeState(dir, layout.cache(UNIT, 'note.md'), 'The total is never rounded.\n')], { env: SESSION });
    seen.push(consolidated());
    writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', 'consolidation.md'), '## The notes\n\n- Note 1: dropped — the total is rounded on display.\n');

    assert.deepStrictEqual([...seen, consolidated()], ['done', 'open', 'done']);
  });

  it('reads its stack merged once every task not closed landed on the default branch (7.S7)', () => {
    const merged = () => item('phase-close', 1, 'stack-merged');
    const seen = [merged()];
    landed(['1.1']);
    seen.push(merged());
    landed(['1.2']);

    assert.deepStrictEqual([...seen, merged()], ['open', 'open', 'done']);
  });

  it('in step, reads its stack merged once its merge waits at its gate holding every task of the phase not closed, each opened into it, the stacks read once for all of them — one not, one whose landing cannot be read, said as a warning, or no task at all holding it open (7.2.4)', () => {
    manifestWith({ build: { position: 'step' } });
    const merged = () => item('phase-close', 1, 'stack-merged');
    const seen = [merged()];
    ok(dir, ['land', 'open', UNIT, '1.1'], { env: SESSION });
    seen.push(merged());
    ok(dir, ['land', 'open', UNIT, '1.2'], { env: SESSION });
    const [both, reads] = branchReads(merged);
    seen.push(both);
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Mask a card', ['A card is masked.'])]);
    const unbranched = show('phase-close', 1);
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Folded into 1.1.']);
    seen.push(unbranched.items.find((/** @type {{key: string}} */ shown) => shown.key === 'stack-merged').state, merged(), item('phase-close', 3, 'stack-merged'));
    manifestWith({ build: { position: 'auto' } });

    assert.deepStrictEqual([...seen, merged()], ['open', 'open', 'done', 'open', 'done', 'open', 'open'], 'a phase with no task holds no stack; in auto a stack waits at no gate, merged once landed');
    assert.match(unbranched.warnings.join('\n'), /^land: task 1\.3 has no branch feat\/pay-1\.3-mask-a-card, /m);
    assert.strictEqual(reads, 1, 'the one repository\'s stacks are read once for both tasks');
  });

  it('closes phase 1 only once the verify setup is recorded, every item holding (12.3.3, 12.S5); a later phase\'s close asks none', () => {
    everyItem(1, ['1.1', '1.2'], ['1.S1', '1.S2']);
    everyItem(2, ['2.1'], ['2.S1']);
    const items = show('phase-close', 1).items.map((/** @type {{key: string, state: string}} */ shown) => `${shown.key} ${shown.state}`);
    const refusal = refusedPristine(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION }).error;
    assert.strictEqual(ok(dir, ['checklist', 'close', 'phase-close', UNIT, '2'], { env: SESSION }).checklist, 'phase-2-close');
    verifySetUp();

    assert.deepStrictEqual(items, ['tasks-passed done', 'phase-review-passed done', 'scenarios-reported done', 'notes-consolidated done', 'stack-merged done']);
    assert.strictEqual(refusal, 'checklist close: phase 1 of pay closes once the verify setup is recorded — the first phase gets the product running and drivable: verify setup pay --file <setup.json> --scenario <scenario>');
    assert.strictEqual(ok(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION }).checklist, 'phase-1-close');
  });

  it('commits, at its close, every record its folder holds beside the manifest — its review\'s reports and its consolidation report, never a file the layout does not place, which the person\'s gitignore may cover — so a second clone reads a passing review and a settled one as this clone does', () => {
    everyItem(2, ['2.1'], ['2.S1']);
    writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-2', 'consolidation.md'), '## The notes\n\nNone.\n');
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '*.swp\n');
    for (const stray of ['.review-a.md.swp', 'review-a.txt', '.DS_Store']) writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-2', stray), 'stray\n');
    const { committed } = ok(dir, ['checklist', 'close', 'phase-close', UNIT, '2'], { env: SESSION });
    const closing = touched(statePath(dir), 'HEAD');
    everyItem(1, ['1.1', '1.2'], ['1.S1', '1.S2']);
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    settle([]);
    verifySetUp();
    ok(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION });

    assert.notStrictEqual(committed, null, 'the close commits');
    assert.deepStrictEqual(closing, ['A\tpay/build/phases/phase-2/consolidation.md', 'A\tpay/build/phases/phase-2/review-a.md', 'A\tpay/build/phases/phase-2/review-b.md', 'M\tpay/manifest.json']);
    assert.deepStrictEqual(stateGit(dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${UNIT}/build/phases`]).trim().split('\n'), [
      'pay/build/phases/phase-1/review-a.md', 'pay/build/phases/phase-1/review-b.md', 'pay/build/phases/phase-1/settlement.json',
      'pay/build/phases/phase-2/consolidation.md', 'pay/build/phases/phase-2/review-a.md', 'pay/build/phases/phase-2/review-b.md',
    ]);
  });
});
