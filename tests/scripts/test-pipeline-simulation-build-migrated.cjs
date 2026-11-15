'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build of a unit the migration cut, as its
// skill's prose runs it (21.8.6–21.8.8): a feature shaped as the person's
// own projects leave one mid-build — its first phase built, its second
// partly, a task of it done before the migration and one in progress, its
// third not started — carried on by today's build in step from the
// migration on, to its review's entry. Each adopted phase's tasks are
// written, so its start closes and the start menu says so; a task of the
// old plan, its text opening on no title, is briefed under its title, on
// the area the cut found its text citing by the old spec's path with its
// phase's scenarios, or, citing none, on its phase's sections and
// scenarios, its figures counting no criteria and its account saying they
// are in its text, and its phase review reads its text where it holds no
// criteria; the task done before the migration counts as passed and landed
// at the phase's close, with no round, figure, account or landing of its
// own — its phase review drawing it as landed before, outside the range,
// with no criteria to hold, and the area its built phase placed as first
// built there — the merge gate naming it on the default branch already and
// the stack the tasks built since; and the review reads the whole unit, the
// joined spec's area its area. A phase whose every task since was closed,
// its others done before, passes its review with nothing to read and runs
// no mutants. The review itself is test-pipeline-simulation-review-migrated-
// feature.cjs's and -epic.cjs's.
//
// Layer: simulation. World: this file's own — a project in the layout from
// before Leeway, the old plan in the project's tracker, moved by the real
// move (078) and cut by `cut --migrating`, the migration's commit made
// (migrated-world.cjs) — built once and copied per scenario, which replays
// the engine calls the build's prose makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const {
  Sim, readyForSim, startPhase, startRow, briefOf, landed, placeIn, answerGate, buildLoop, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const {
  oldTask, oldSpecPath, buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted,
} = require('./migrated-world.cjs');

const WU = 'folio';

/** The old spec, as the workflows from before Leeway wrote it. */
const OLD_SPEC = '# Specification: Folio\n\n## Pages\n\nA page holds a title and its text.\n\n## Search\n\nA page is found by any word it holds.\n';

/** The area the move joins the old spec into. */
const AREA = '## 1. Folio\n\n#### Pages\n\nA page holds a title and its text.\n\n#### Search\n\nA page is found by any word it holds.';

const SCENARIOS = [
  'Given a page, when its text is edited, then the page holds the new text.',
  'Given pages, when a word is searched for, then each page holding it is found.',
];

/** The project from before Leeway, moved and cut, the migration's commit made: built once. */
function buildWorld(/** @type {string} */ dir) {
  const cites = oldSpecPath(WU, WU);
  const { [WU]: { phases: [built, editing, search] } } = movedProject(dir, oldFiles([{ manifest: buildingUnit(WU, 'feature', [WU], 'in-progress'), specs: { [WU]: OLD_SPEC } }]), {
    [WU]: [
      { title: 'Pages', tasks: ['Keep a page', 'Show a page'] },
      { title: 'Editing', tasks: [{ title: 'Edit a title', tags: [] }, { title: 'Edit the text', text: oldTask('A page\'s text is fixed once written.', cites) }, { title: 'Undo an edit', text: oldTask('An edit is lost for good.') }] },
      { title: 'Search', tasks: [{ title: 'Index the pages', text: oldTask('Nothing knows a page\'s words.', cites) }, { title: 'Find by a word', text: oldTask('A page is found only by its title.') }] },
    ],
  }, [['done', 'Keep a page'], ['done', 'Show a page'], ['done', 'Edit a title'], ['start', 'Edit the text']]);
  migratedCut(dir, WU, {
    phases: [
      { name: 'Pages', goal: 'A page is kept.', sections: ['1'], built: true, tracker: built },
      { name: 'Editing', goal: 'A page is edited.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: editing },
      { name: 'Search', goal: 'A page is found.', scenarios: ['1.S2'], sections: ['1'], relies_on: [2], tracker: search },
    ],
    scenarios: { 1: SCENARIOS },
  });
  migrationCommitted(dir);
  readyForSim(dir);
}

/** @type {string|null} */
let template = null;

/** The world at a fresh folder. */
function world() {
  if (template === null) {
    template = path.join(templateFolder('pipeline-build-migrated-template-'), WU);
    buildWorld(template);
  }
  return copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-build-migrated-')), WU));
}

describe('pipeline simulation: the build of a unit the migration cut', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  beforeEach(() => {
    sim = new Sim(world);
    loop = buildLoop(sim, WU);
  });
  afterEach(() => {
    loop.cleared();
    sim.destroy();
  });

  /** The step gate the last task through it showed. */
  let gate = '';

  /** The task's account of `rounds`, the landing summary and the gate, answered yes: the chain's `next`. @param {string} task @param {string[]} rounds */
  const throughItsGate = (task, rounds) => {
    loop.accounted(task, rounds);
    sim.render(['task-landed', WU, task], { expect: 'content' });
    gate = sim.render(['step-gate', WU, task], { expect: 'content' });
    assert.deepStrictEqual(answerGate(sim, 'step gate', '--pick', 'y').next, { kind: 'continue' });
    return loop.landedTask(task);
  };

  /** A phase's review passing, its stack merged at its gate, and its close: the first reviewer's brief and the merge gate. @param {number} phase */
  const closed = (phase) => {
    const briefs = ['a', 'b'].map((letter) => loop.brief(['phase-review', WU, String(phase), '--letter', letter]));
    for (const brief of briefs) landed(placeIn(sim, brief, 'Where your report goes'), PASSED_REPORT);
    const merge = sim.render(['phase-merge-gate', WU, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
    sim.run(['checklist', 'close', 'phase-close', WU, String(phase)]);
    return { review: briefOf(sim, briefs[0]), merge };
  };

  /** What a task's account screen says of an account not written. @param {string} task */
  const unaccounted = (task) => /No account (?:was|is) written[^\n]*/.exec(sim.render(['task-account', WU, task], { expect: 'content' }))?.[0];

  it('21.8.6–21.8.8: a feature cut mid-build carried on by today\'s build to its review — each adopted phase\'s tasks written; an old task\'s builder briefed under its title on the area its text cites with its phase\'s scenarios, or its phase\'s sections and scenarios; its step gate showing its text for what it does and for the criteria it proves, its phase review given its text for its criteria and the built phase it relies on as in the product already; the task done before the migration passed and landed at its phase\'s close, drawn as landed before and with no account, the stack the tasks built since and the rest on the default branch already', () => {
    assert.strictEqual(sim.run(['enter', 'implementation', WU]).entered, true);
    assert.deepStrictEqual(sim.sections.split('\n').filter((line) => line.startsWith('phase: ')), [
      'phase: phase 1 of 3, "Pages": merged — tasks 1.1 done, 1.2 done',
      'phase: phase 2 of 3, "Editing": written — tasks 2.1 done, 2.2 in progress, 2.3 not started',
      'phase: phase 3 of 3, "Search": written — tasks 3.1 not started, 3.2 not started',
    ]);
    assert.match(startRow(sim, WU), /build, phase 2 of 3\*/, 'the start menu\'s progress: the adopted phase written before its start');
    startPhase(sim, WU, 2);
    sim.run(['enter', 'implementation', WU]);
    assert.ok(sim.sections.includes('phase: phase 2 of 3, "Editing": running'), 'the build\'s standing agrees');

    // 2.2, in progress when the migration came: its builder carries on, on
    // the area the cut found its old text citing, with its phase's scenarios.
    const builder = loop.brief(['builder', WU, '2.2']);
    const editBrief = briefOf(sim, builder);
    assert.ok(editBrief.includes(`# The spec's sections it cites\n\n${AREA}\n\nIts phase's scenarios:\n\n- 1.S1: ${SCENARIOS[0]}\n`), 'the old citation read through its area, the phase\'s scenarios beside it');
    assert.ok(editBrief.includes('# Your task\n\n## Edit the text\n\n**Problem**: A page\'s text is fixed once written.'), 'an old task\'s text drawn under its title');
    const editing = loop.isolated('2.2');
    loop.committed(editing, '2.2', { ...VERIFY_FILES, 'src/edit.js': 'export const edit = 1;\n' });
    loop.setUp(editing, builder, '1.S1');
    loop.pairRound('2.2');
    assert.strictEqual(throughItsGate('2.2', ['Passed.']), undefined);
    assert.match(gate, /WHAT IT DOES\n+ +\*\*Problem\*\*: A page's text is fixed once written\./, 'an old task, holding no Outcome, shown by its text');
    assert.match(gate, /✓ Proves the criteria in its text · /, 'an old task\'s criteria, which its figures count none of, in its text');
    const { view: page } = sim.board(['--tab', 'unit', '--unit', WU, '--page', 'task:2.2']);
    assert.deepStrictEqual([page.criteria, page.account.figures.criteria], [null, null], 'the board\'s task page counting none either');

    // 2.3 cites nothing: its phase's sections and scenarios stand for it.
    sim.run(['task', 'start', WU, '2.3']);
    const undo = briefOf(sim, loop.brief(['builder', WU, '2.3']));
    assert.ok(undo.includes(`task 2.3 of ${WU} cites no section of the spec, so its phase's stand for it, with its phase's scenarios:\n\n${AREA}\n\n- 1.S1: ${SCENARIOS[0]}`), 'the phase\'s cut entry stands for its sections');
    const undoing = loop.isolated('2.3');
    loop.committed(undoing, '2.3', { 'src/undo.js': 'export const undo = 1;\n' });
    loop.pairRound('2.3');
    assert.deepStrictEqual(throughItsGate('2.3', ['Passed.'])?.argv, ['verify', 'mutants', WU, '2']);

    // The phase's close: 2.1, done before the migration, passed and landed
    // with no round, figure or landing of its own, its consolidation reading
    // it as landed before.
    assert.ok(briefOf(sim, loop.brief(['consolidation', WU, '2', '--base', 'main'])).includes('## 2.1 Edit a title\n\nIt landed before the migration cut the unit: its work stands in the product already, and the phase\'s range holds none of it.'), 'the task done before the migration drawn as landed before');
    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '2'])).items;
    assert.deepStrictEqual(['tasks-passed', 'stack-merged'].map((key) => items.find((/** @type {{key: string}} */ item) => item.key === key).state), ['done', 'done']);
    assert.ok(!git(sim.dir, ['log', 'main', '--format=%B']).includes(`${WU}-2-1`), 'no landing names the task done before the migration');
    const { review, merge } = closed(2);
    assert.ok(review.includes('## 2.2 Edit the text\n\n**Problem**: A page\'s text is fixed once written.'), 'the phase review reads an old task\'s text for the criteria it holds none of');
    assert.ok(review.includes('## Phase 1: Pages\n\nA page is kept.\n\nIts sections: §1 — built before the migration cut the unit, its work in the product already\n\nIts tasks:'), 'the built phase it relies on read as in the product already');
    assert.ok(review.includes('- §1, first built in phase 1, before the migration cut the unit'), 'the area first built by the phase built before the migration');
    const criteria = review.slice(review.indexOf('# Its tasks\' criteria'), review.indexOf('# What it relies on'));
    assert.ok(criteria.includes('## 2.3 ') && !criteria.includes('## 2.1 '), 'no criteria held of the task done before the migration');
    assert.match(merge, /its tasks built since the migration cut the unit land on the default branch as one stack — 2\.1 is on it already\./);
    assert.deepStrictEqual([unaccounted('2.1'), unaccounted('1.1')], Array(2).fill('No account was written: it landed before the migration cut the unit.'));

    startPhase(sim, WU, 3);
    for (const [task, file] of [['3.1', 'src/index.js'], ['3.2', 'src/find.js']]) {
      sim.run(['task', 'start', WU, task]);
      loop.brief(['builder', WU, task]);
      const tree = loop.isolated(task);
      loop.committed(tree, task, { [file]: 'export const found = 1;\n' });
      if (task === '3.2') sim.runIn(tree, ['verify', 'run', WU, '1.S2']);
      loop.pairRound(task);
      throughItsGate(task, ['Passed.']);
    }
    closed(3);

    assert.strictEqual(sim.run(['enter', 'review', WU]).entered, true, 'every phase merged, the review phase is entered');
    assert.deepStrictEqual(sim.sections.split('\n').filter((line) => line.startsWith('area: ')), [`area: 1-${WU} — §1 Folio`]);
  });

  it('21.8.8: a phase whose every task since the migration was closed, the rest done before it, passes its review with nothing to read, its last close naming no mutation run', () => {
    sim.run(['enter', 'implementation', WU]);
    startPhase(sim, WU, 2);
    sim.run(['enter', 'implementation', WU]);
    const builder = loop.brief(['builder', WU, '2.2']);
    const editing = loop.isolated('2.2');
    loop.committed(editing, '2.2', VERIFY_FILES);
    loop.setUp(editing, builder, '1.S1');
    sim.run(['task', 'close', WU, '2.2', '--reason', 'Editing waits for the page\'s history.']);
    sim.run(['task', 'start', WU, '2.3']);
    assert.strictEqual(sim.run(['task', 'close', WU, '2.3', '--reason', 'Undo waits for the page\'s history.']).next, undefined, 'nothing built since to run mutants over');

    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '2'])).items;
    assert.strictEqual(items.find((/** @type {{key: string}} */ item) => item.key === 'phase-review-passed').state, 'done');
    sim.refuses(['brief', 'phase-review', WU, '2', '--letter', 'a'], /phase 2 of folio has nothing built since the migration cut the unit — each task of it landed before or was closed — so its review passes with nothing to read/);
  });
});
