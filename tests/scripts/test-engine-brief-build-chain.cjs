'use strict';

// ---------------------------------------------------------------------------
// The builder's and the reviewer's briefs beside the rounds (leeway-engine/
// scripts/domain/brief-records.cjs): the reviewer's scratch worktree laid
// out as the builder's worktree held each repository, and the calls laying
// it out at those commits (13.2.2); where the
// verify setup goes (15.2.11); the builder's own call among the decided
// calls its reviewers read (13.S17); and the builder's branch against its
// phase's chain, the merge back it owes where the chain moved past it —
// each repository's merged and committed through the door, children first,
// a child's pointer staged at its merged tip — then the task, its account
// or the report that it merged, by how far the task stands; and the
// mutation run named once for the phase, by whatever ends its last task
// once its notes are consolidated, else by the phase review's brief
// (12.7.10, 15.6.3).
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { initRepo, commitCode, addSubmodule, accountTaken } = require('./engine-harness.cjs');
const {
  UNIT,
  NESTED,
  VERIFY,
  branchOf,
  commitFile,
  useWorld,
  issued,
  scratchCalls,
  refusedUnissued,
  taskText,
  pathDrawn,
  decidedDrawn,
  ok,
  layout,
  writeState,
  git,
} = require('./brief-build-world.cjs');

/** @type {string} */
let dir;

describe('the reviewer\'s scratch worktree (13.2.2)', () => {
  useWorld((at) => { dir = at; });

  /** The scratch worktree's layout task 1.2's reviewer is briefed with: its list, and the calls laying it out. */
  const laidOut = () => /# Laying out your scratch worktree\n\n([^#]*?)\n\n(Lay it out[^#]*)\n\n#/.exec(issued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a']).brief)?.slice(1);

  it('a task touching the project\'s repository alone lays out every repository, as the builder\'s worktree held them: the project\'s at the range\'s tip, a submodule at the commit that tip points it at, a clone on the task\'s branch, or the branch it lands on where that is not made there', () => {
    const source = initRepo(path.join(dir, '..', 'ext-source'));
    fs.writeFileSync(path.join(source, 'one.txt'), 'one\n');
    commitCode(source, 'one');
    const first = git(source, ['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(path.join(source, 'two.txt'), 'two\n');
    commitCode(source, 'two');
    addSubmodule(dir, 'ext', source);
    const pinning = path.join(dir, '..', 'pinning');
    git(dir, ['worktree', 'add', '-q', pinning, branchOf(1, 2)]);
    git(pinning, ['update-index', '--add', '--cacheinfo', `160000,${first},ext`]);
    git(pinning, ['commit', '-q', '-m', 'ext pinned']);
    git(dir, ['worktree', 'remove', '--force', pinning]);
    const nested = path.join(dir, NESTED);
    git(nested, ['branch', branchOf(1, 2), 'main']);

    const own = `- the project's repository: \`${branchOf(1, 2)}\` — the range's tip there`;
    const ext = `- \`ext\`: \`${first}\` — a submodule, at the commit the project's repository points it at as laid out`;
    const commitOf = (/** @type {string} */ at, /** @type {string} */ rev) => git(at, ['rev-parse', rev]).trim();
    const calls = (/** @type {string} */ held) => scratchCalls(`${UNIT}-1.2-a`, commitOf(dir, branchOf(1, 2)), [`ext=${first}`, `${NESTED}=${commitOf(nested, held)}`]);
    assert.deepStrictEqual(laidOut(), [[own, ext, `- \`${NESTED}\`: \`${branchOf(1, 2)}\` — the task's branch`].join('\n'), calls(branchOf(1, 2))]);
    git(nested, ['branch', '-D', branchOf(1, 2)]);
    assert.deepStrictEqual(laidOut(), [[own, ext, `- \`${NESTED}\`: \`main\` — the branch it lands on, the task's branch not made there`].join('\n'), calls('main')]);
  });
});

describe('where the verify setup goes (15.2.11)', () => {
  useWorld((at) => { dir = at; });

  it('the builder\'s file starts from the setup recorded now, drawn whole but for its run, so a builder changing it never undoes a change recorded since', () => {
    const { ran: _ran, ...parts } = VERIFY;
    const { brief } = issued(['builder', UNIT, '1.2']);

    assert.ok(brief.includes(`# Where the verify setup goes\n\n${pathDrawn('.cache/pay/build/verify-setup.json')}\n\nThe verify setup recorded now, which the file starts from:\n\n\`\`\`json\n${JSON.stringify(parts, null, 2)}\n\`\`\`\n\n#`), brief);
  });
});

describe('the builder\'s calls (13.11.10)', () => {
  useWorld((at) => { dir = at; });

  it('13.S17: a call the builder took, recorded in the build, is among the decided calls the builder\'s brief and its reviewers\' carry', () => {
    const builder = issued(['builder', UNIT, '1.2']).brief;
    const reviewer = issued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a']).brief;

    for (const brief of [builder, reviewer]) assert.ok(brief.includes(`# The decided calls\n\n${decidedDrawn()}\n`), brief);
  });
});

describe('the builder\'s branch and its phase\'s chain (12.7.10, 15.6.3)', () => {
  useWorld((at) => { dir = at; });

  /** The builder's brief for task `task`, from its section on where its branch stands to the next. @param {string} task */
  const standsAt = (task) => /# Where your branch stands\n\n([^#]*)\n\n#/.exec(issued(['builder', UNIT, task]).brief)?.[1];

  /** What the builder does once the merge is committed, by how far its task stands towards landing. */
  const THEN = Object.freeze({
    building: 'Then go on with the task as the rest of this brief says.',
    owed: 'Then write the task\'s account, as **Where your account goes** says, and report **accounted**.',
    taken: 'Then report **merged**.',
  });

  /**
   * What the chain slot asks of task `task`: the merges listed, the pointers staged, the door's call, then what comes after.
   * @param {string} task @param {string[]} merges @param {{pointers?: string[], then?: string}} [options]
   */
  const mergedBack = (task, merges, { pointers = [], then = THEN.building } = {}) => [
    'Your phase\'s chain has moved on past your branch. Merge its tip back before anything else, from your task\'s worktree, one repository at a time in this order, each merge committed before the next starts:',
    merges.map((merge) => `- \`${merge}\``).join('\n'),
    `Resolve what conflicts as your task and the chained work both need${pointers.length === 0 ? '' : ` — a child repository's pointer at that repository's merged tip, ${pointers.map((pointer) => `\`${pointer}\``).join(', ')}`}, then commit the merge through the door, naming each file you resolved — or, where nothing conflicted, any file the merge changed: the engine's \`commit --paths {file}… --task pay ${task} -m "{message}"\`, which finishes it.`,
    then,
  ].join('\n\n');

  /** Task 1.1's branch moved past 1.2's in the project's repository: a nit fixed on it. */
  const nitBelow = () => {
    git(dir, ['checkout', '-q', branchOf(1, 1)]);
    commitFile(dir, 'src/card-nit.js', `${UNIT}-1-1`);
    git(dir, ['checkout', '-q', 'main']);
  };

  it('a branch its chain moved past since — a nit fixed on 1.1\'s branch below 1.2\'s — is told to merge that tip back, never another branch below it, the merge committed through the door, then to go on with the task; before, it holds the chain', () => {
    const before = standsAt('1.2');
    nitBelow();

    assert.strictEqual(before, 'Your branch holds its phase\'s chain as it stands.');
    assert.strictEqual(standsAt('1.2'), mergedBack('1.2', [`git merge --no-ff --no-commit ${branchOf(1, 1)}`]));
  });

  it('12.14: once the merge is committed, the builder goes on by how far the task stands — with the task while its review runs, with its account once it passed, and reports merged once its account is taken, so its landing goes on at land open and draws nothing again', () => {
    nitBelow();
    const building = standsAt('1.2');
    for (const letter of ['a', 'b']) writeState(dir, `pay/build/tasks/1.2/round-1-${letter}.md`, '## Findings\n\nNone.\n\nVerdict: pass\n');
    const owed = standsAt('1.2');
    accountTaken(dir, UNIT, '1.2');
    const taken = standsAt('1.2');

    const merges = [`git merge --no-ff --no-commit ${branchOf(1, 1)}`];
    assert.deepStrictEqual([building, owed, taken], [mergedBack('1.2', merges), mergedBack('1.2', merges, { then: THEN.owed }), mergedBack('1.2', merges, { then: THEN.taken })]);
  });

  it('a child repository and the project\'s both moved past: the child merged first, with -C, then the project\'s, its pointer at the child\'s merged tip staged', () => {
    const source = initRepo(path.join(dir, '..', 'ext-source'));
    fs.writeFileSync(path.join(source, 'one.txt'), 'one\n');
    commitCode(source, 'one');
    const ext = addSubmodule(dir, 'ext', source);
    for (const n of [1, 2]) git(ext, ['branch', branchOf(1, n), 'HEAD']);
    git(ext, ['checkout', '-q', branchOf(1, 1)]);
    commitFile(ext, 'nit.js', `${UNIT}-1-1`);
    git(ext, ['checkout', '-q', '--detach']);
    nitBelow();

    assert.strictEqual(standsAt('1.2'), mergedBack('1.2', [`git -C ext merge --no-ff --no-commit ${branchOf(1, 1)}`, `git merge --no-ff --no-commit ${branchOf(1, 1)}`], { pointers: ['git add ext'] }));
  });

  it('two tasks below it moved past it, one stacked on the other: only the chain\'s tip is merged back', () => {
    accountTaken(dir, UNIT, '1.2');
    ok(dir, ['task', 'done', UNIT, '1.2']);
    git(dir, ['checkout', '-q', branchOf(1, 1)]);
    commitFile(dir, 'src/card-nit.js', `${UNIT}-1-1`);
    git(dir, ['checkout', '-q', branchOf(1, 2)]);
    git(dir, ['merge', '-q', '--no-edit', branchOf(1, 1)]);
    git(dir, ['checkout', '-q', 'main']);

    assert.strictEqual(standsAt('1.4'), mergedBack('1.4', [`git merge --no-ff --no-commit ${branchOf(1, 2)}`]));
  });

  it('the clone\'s chain moved past its branch there: its merge runs in the clone, with -C', () => {
    const lib = path.join(dir, NESTED);
    git(lib, ['branch', branchOf(1, 2), branchOf(1, 1)]);
    git(lib, ['checkout', '-q', branchOf(1, 1)]);
    commitFile(lib, 'card/nit.js', `${UNIT}-1-1`);
    git(lib, ['checkout', '-q', 'main']);

    assert.strictEqual(standsAt('1.2'), mergedBack('1.2', [`git -C ${NESTED} merge --no-ff --no-commit ${branchOf(1, 1)}`]));
  });

  /** The `next` of task `task` given up. @param {string} task */
  const closed = (task) => ok(dir, ['task', 'close', UNIT, task, '--reason', 'not wanted']).next;

  /** The phase's consolidation report written, each of its notes as `taken`. @param {string} taken */
  const consolidated = (taken) => writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', 'consolidation.md'), `## The notes\n\n${taken}\n`);

  const RUN = Object.freeze({ kind: 'engine', argv: ['verify', 'mutants', UNIT, '1'] });

  it('N4 (15.6.3): the last of a phase to end names no mutation run while its notes wait — consolidated writing no task, the phase review\'s brief names it, once; closed while another is open, or in a phase none of whose tasks is done, names none', () => {
    const ended = [closed('1.2'), closed('1.4'), closed('2.1')];
    consolidated('- Note 1, Note 3: dropped — the expiry is read with the card.');

    assert.deepStrictEqual(ended, [undefined, undefined, undefined]);
    refusedUnissued(['phase-review', UNIT, '1', '--base', 'main', '--letter', 'a'], /— engine verify mutants pay 1 runs it$/);
  });

  it('N4 (15.6.3): consolidated writing a task, the phase\'s mutation run is named once, by the end of that task, the last', () => {
    closed('1.2');
    const before = closed('1.4');
    ok(dir, ['task', 'create', UNIT, '1', '--file', writeState(dir, '.cache/pay/build/task.md', taskText('Merge the card helpers', '§1.1'))]);
    consolidated('- Note 1: dropped — the expiry is read with the card.\n- Note 3: a task — Merge the card helpers');

    assert.deepStrictEqual([before, closed('1.5')], [undefined, RUN]);
  });
});
