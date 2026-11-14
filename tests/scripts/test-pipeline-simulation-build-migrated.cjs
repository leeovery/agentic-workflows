'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build of a unit the migration cut, as its
// skill's prose runs it (21.8.6–21.8.8): a feature shaped as the person's
// own projects leave one mid-build — its first phase built, its second
// partly, a task of it done before the migration and one in progress, its
// third not started — carried on by today's build in step from the
// migration on, to the review. Each adopted phase's tasks are written, so
// its start closes; a task of the old plan's builder is briefed on the area
// its text cites by the old spec's path, or, citing none, on its phase's
// sections and scenarios; the task done before the migration counts as
// passed and landed at the phase's close, with no round, figure or landing
// of its own, the stack the tasks built since; and the review reads the
// whole unit, the joined spec's area its area.
//
// Layer: simulation. World: this file's own — a project in the layout from
// before Leeway, the old plan in the project's tracker, moved by the real
// move (078) and cut by `cut --migrating`, the migration's commit made —
// built once and copied per scenario, which replays the engine calls the
// build's prose makes, in order, the oracle (pipeline-oracle.cjs) auditing
// the whole state after every mutation. The tracker is the default task
// driver's, its side the one place it is named.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, git, initRepo, createFile, statePath } = require('./engine-harness.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { SESSION } = require('./migration-world.cjs');
const {
  Sim, readyForSim, startPhase, startRow, briefOf, landed, placeIn, answerGate, buildLoop, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const MOVE = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');

const DRIVER = /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (listDrivers('task').find(({ isDefault }) => isDefault));
const SIDE = require(path.join(__dirname, '../drivers', DRIVER.name, 'task.cjs'));

const WU = 'folio';

/** The old spec, as the workflows from before Leeway wrote it. */
const OLD_SPEC = '# Specification: Folio\n\n## Pages\n\nA page holds a title and its text.\n\n## Search\n\nA page is found by any word it holds.\n';

/** The area the move joins the old spec into. */
const AREA = '## 1. Folio\n\n#### Pages\n\nA page holds a title and its text.\n\n#### Search\n\nA page is found by any word it holds.';

const SCENARIOS = [
  'Given a page, when its text is edited, then the page holds the new text.',
  'Given pages, when a word is searched for, then each page holding it is found.',
];

/** An old task's text, as the plan from before Leeway wrote it, citing the old spec by its path where `cites`. @param {string} problem @param {boolean} cites */
const oldTask = (problem, cites) => [
  `**Problem**: ${problem}`, '', '**Solution**: Build it.', '', '### Acceptance Criteria', '', '- It works.',
  ...(cites ? ['', `**Spec Reference**: \`.workflows/${WU}/specification/${WU}/specification.md\` — §Pages`] : []),
].join('\n');

const OLD = {
  'README.md': '# Folio\n',
  '.workflows/manifest.json': jsonText({ work_units: { [WU]: { work_type: 'feature' } } }),
  [`.workflows/${WU}/manifest.json`]: jsonText({
    name: WU, work_type: 'feature', status: 'in-progress', description: 'Folio', created: '2026-01-01',
    phases: {
      discussion: { items: { [WU]: { status: 'completed' } } },
      specification: { items: { [WU]: { status: 'completed' } } },
      planning: { items: { [WU]: { status: 'completed', format: 'tick' } } },
      implementation: { items: { [WU]: { status: 'in-progress', completed_tasks: [`${WU}-1-1`, `${WU}-1-2`, `${WU}-2-1`] } } },
    },
  }),
  [`.workflows/${WU}/discussion/${WU}.md`]: '# Discussion: Folio\n',
  [`.workflows/${WU}/specification/${WU}/specification.md`]: OLD_SPEC,
};

/** The project from before Leeway, moved and cut, the migration's commit made: built once. */
function buildWorld(/** @type {string} */ dir) {
  initRepo(dir);
  for (const [rel, text] of Object.entries(OLD)) createFile(dir, rel, text);
  SIDE.projectStore(dir);
  const [built, editing, search] = SIDE.oldPlan(dir, WU, [
    { title: 'Pages', tasks: ['Keep a page', 'Show a page'] },
    { title: 'Editing', tasks: [{ title: 'Edit a title', tags: [] }, { title: 'Edit the text', text: oldTask('A page\'s text is fixed once written.', true) }, { title: 'Undo an edit', text: oldTask('An edit is lost for good.', false) }] },
    { title: 'Search', tasks: [{ title: 'Index the pages', text: oldTask('Nothing knows a page\'s words.', true) }, { title: 'Find by a word', text: oldTask('A page is found only by its title.', false) }] },
  ]).phases;
  for (const [act, title] of [['done', 'Keep a page'], ['done', 'Show a page'], ['done', 'Edit a title'], ['start', 'Edit the text']]) SIDE.taskByHand(dir, act, title);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  const plan = path.join(path.dirname(dir), 'plan.json');
  fs.writeFileSync(plan, JSON.stringify({
    phases: [
      { name: 'Pages', goal: 'A page is kept.', built: true, tracker: built },
      { name: 'Editing', goal: 'A page is edited.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: editing },
      { name: 'Search', goal: 'A page is found.', scenarios: ['1.S2'], sections: ['1'], relies_on: [2], tracker: search },
    ],
    scenarios: { 1: SCENARIOS },
  }));
  ok(dir, ['cut', WU, '--migrating', '--file', plan], { env: SESSION });
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s state']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the migration']);
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

  /** The task's account of `rounds`, the landing summary and the gate, answered yes: the chain's `next`. @param {string} task @param {string[]} rounds */
  const throughItsGate = (task, rounds) => {
    loop.accounted(task, rounds);
    sim.render(['task-landed', WU, task], { expect: 'content' });
    sim.render(['step-gate', WU, task], { expect: 'content' });
    assert.deepStrictEqual(answerGate(sim, 'step gate', '--pick', 'y').next, { kind: 'continue' });
    return loop.landedTask(task);
  };

  /** A phase's review passing, its stack merged at its gate, and its close. @param {number} phase */
  const closed = (phase) => {
    for (const letter of ['a', 'b']) landed(placeIn(sim, loop.brief(['phase-review', WU, String(phase), '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
    sim.render(['phase-merge-gate', WU, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
    sim.run(['checklist', 'close', 'phase-close', WU, String(phase)]);
  };

  it('21.8.6–21.8.8: a feature cut mid-build carried on by today\'s build to its review — each adopted phase\'s tasks written; an old task\'s builder briefed on the area its text cites, or its phase\'s sections and scenarios; the task done before the migration passed and landed at its phase\'s close, the stack the tasks built since', () => {
    assert.strictEqual(sim.run(['enter', 'implementation', WU]).entered, true);
    assert.deepStrictEqual(sim.sections.split('\n').filter((line) => line.startsWith('phase: ')), [
      'phase: phase 1 of 3, "Pages": merged — tasks 1.1 done, 1.2 done',
      'phase: phase 2 of 3, "Editing": written — tasks 2.1 done, 2.2 in progress, 2.3 not started',
      'phase: phase 3 of 3, "Search": written — tasks 3.1 not started, 3.2 not started',
    ]);
    startPhase(sim, WU, 2);
    assert.match(startRow(sim, WU), /build, phase 2 of 3\*/, 'the start menu\'s progress: the phase written');
    sim.run(['enter', 'implementation', WU]);
    assert.ok(sim.sections.includes('phase: phase 2 of 3, "Editing": running'), 'the build\'s standing agrees');

    // 2.2, in progress when the migration came: its builder carries on, on
    // the area its old text cites by the old spec's path.
    const builder = loop.brief(['builder', WU, '2.2']);
    assert.ok(briefOf(sim, builder).includes(`# The spec's sections it cites\n\n${AREA}\n`), 'the old citation read through its area');
    const editing = loop.isolated('2.2');
    loop.committed(editing, '2.2', { ...VERIFY_FILES, 'src/edit.js': 'export const edit = 1;\n' });
    loop.setUp(editing, builder, '1.S1');
    loop.pairRound('2.2');
    assert.strictEqual(throughItsGate('2.2', ['Passed.']), undefined);

    // 2.3 cites nothing: its phase's sections and scenarios stand for it.
    sim.run(['task', 'start', WU, '2.3']);
    const undo = briefOf(sim, loop.brief(['builder', WU, '2.3']));
    assert.ok(undo.includes(`task 2.3 of ${WU} cites no section of the spec, so its phase's stand for it, with its phase's scenarios:\n\n${AREA}\n\n- 1.S1: ${SCENARIOS[0]}`), 'the phase\'s cut entry stands for its sections');
    const undoing = loop.isolated('2.3');
    loop.committed(undoing, '2.3', { 'src/undo.js': 'export const undo = 1;\n' });
    loop.pairRound('2.3');
    assert.deepStrictEqual(throughItsGate('2.3', ['Passed.'])?.argv, ['verify', 'mutants', WU, '2']);

    // The phase's close: 2.1, done before the migration, passed and landed
    // with no round, figure or landing of its own.
    const items = JSON.parse(sim.read(['checklist', 'show', 'phase-close', WU, '2'])).items;
    assert.deepStrictEqual(['tasks-passed', 'stack-merged'].map((key) => items.find((/** @type {{key: string}} */ item) => item.key === key).state), ['done', 'done']);
    assert.ok(!git(sim.dir, ['log', 'main', '--format=%B']).includes(`${WU}-2-1`), 'no landing names the task done before the migration');
    closed(2);

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
});
