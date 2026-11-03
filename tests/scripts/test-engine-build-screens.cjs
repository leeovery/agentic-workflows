'use strict';

// ---------------------------------------------------------------------------
// The build's screens that report (leeway-engine/scripts/domain/
// build-screens.cjs, drawn by domain/projections/build.cjs): a task's landing
// summary, its account printed when asked, the headline as tasks start, the
// build's phases and tasks, and the stop report. The gates in step are
// test-engine-build-gates.cjs; step's one task at a time,
// test-engine-build-step.cjs.
//
// Layer: verb. Worlds, each built once and copied: the build screens' world
// (build-screens-world.cjs), and a second made from it with its five
// questions parked — Q1 and Q5 on task 1.1, Q2 and Q4 on 1.2, Q3 on 2.1 —
// which the tests of five questions waiting copy. The review's fix phases
// on these screens: test-engine-review-fix-phases.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, refusedPristine, git, writeState, readManifest, layout, cleanupFixture, sectionOf } = require('./engine-harness.cjs');
const { createManifest, templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { UNIT, QUESTIONS, CALL, ACCOUNT_DRAWN, taskText, reportOf, buildScreensWorld, buildScreenHelpers } = require('./build-screens-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { titlecase } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = buildScreensWorld();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-screens-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const { env, screen, refused, position, parkOn } = buildScreenHelpers(() => dir, () => config);

/** The product's name as running it is said. */
const product = () => titlecase(path.basename(dir)).toUpperCase();

/** Where the world's five questions park: Q1 and Q5 task 1.1, Q2 and Q4 task 1.2, Q3 task 2.1. */
const FIVE = Object.freeze([['1.1'], ['1.2'], ['2.1'], ['1.2'], ['1.1']]);

/** The world with its five questions parked as FIVE says, made once. @type {{template: string|null}} */
const fiveParked = { template: null };

/** The test's project made a copy of the world with its five questions parked. */
async function parkFive() {
  if (fiveParked.template === null) {
    const template = buildScreensWorld(templateFolder('engine-build-screens-five-template-'));
    for (const [at, tasks] of FIVE.entries()) await parkOn(tasks, at, template);
    fiveParked.template = template;
  }
  cleanupFixture(dir);
  dir = copyWorld(fiveParked.template, fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-screens-five-')));
}

describe('the landing summary (12.12.5, 12.12.6)', () => {
  it('says what changed, the criteria its tests prove, what running the product proved with the proof a press away, the pair\'s verdict and rounds and the task\'s calls — and beneath it the questions waiting, none here (12.S26, 12.S54, 12.S55)', () => {
    const out = screen(['task-landed', UNIT, '1.1']);

    assert.strictEqual(sectionOf(out, 'DISPLAY: task landed'), [
      '▪ Take a card (task 1.1)',
      '',
      '✓ Landed — its reviewer pair passed it in round 2, after 1',
      '  round of fixes · 1 call went to the ledger',
      '',
      'WHAT CHANGED',
      '  A card is taken at the till, and the receipt line names its',
      '  last four digits.',
      '',
      'ITS TESTS PROVE (2)',
      '  ├─ A card is taken at the till.',
      '  └─ A taken card shows its last four digits.',
      '',
      `RUNNING ${product()} PROVED 1 OF 1`,
      '  ↳ The proof is on 1.1\'s page on the board.',
      '',
      'NO QUESTIONS WAITING FOR YOU',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /The digits show whole|Verdict:|=== MENU/, 'no review report, and no gate (12.12.6)');
  });

  it('beneath it, every question waiting: their count, then a line each with the tasks it parks (12.S26, 12.13.7)', async () => {
    await parkOn(['1.2', '1.3']);
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf('1 QUESTION WAITING FOR YOU')), ['1 QUESTION WAITING FOR YOU', `  └─ ⚑ Q1 ${CALL.question} · parks 1.2 and 1 more`, '']);
  });

  it('with five questions waiting, the count reads five and each has its line (12.S26)', async () => {
    await parkFive();
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf('5 QUESTIONS WAITING FOR YOU')), [
      '5 QUESTIONS WAITING FOR YOU',
      `  ├─ ⚑ Q1 ${QUESTIONS[0]} · parks 1.1`,
      `  ├─ ⚑ Q2 ${QUESTIONS[1]} · parks 1.2`,
      `  ├─ ⚑ Q3 ${QUESTIONS[2]} · parks 2.1`,
      `  ├─ ⚑ Q4 ${QUESTIONS[3]} · parks 1.2`,
      `  └─ ⚑ Q5 ${QUESTIONS[4]} · parks 1.1`,
      '',
    ]);
  });

  it('a task whose last round the orchestrator settled says so, and one no run proves reads not proven', () => {
    const lines = sectionOf(screen(['task-landed', UNIT, '1.2']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual([lines.slice(2, 4), lines.slice(lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`), lines.indexOf('NO QUESTIONS WAITING FOR YOU'))], [
      ['✓ Landed — the orchestrator settled its review in round 1 · 1', '  call went to the ledger'],
      [`RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Not proven: A charge prints its receipt.', ''],
    ]);
  });

  it('a scenario its runs no longer prove at the task\'s code reads not proven, in its criterion\'s words', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S1/run-002.json'), JSON.stringify({ ...run, verdict: 'fail', at: '2026-12-01T00:00:00.000Z' }));
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');
    const at = lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`);

    assert.deepStrictEqual(lines.slice(at, at + 3), [`RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Not proven: A card is taken at the till.', '  ↳ The proof is on 1.1\'s page on the board.']);
  });

  it('a run at code the task\'s branch does not hold — another task\'s — never counts for it, however late', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    const elsewhere = git(dir, ['rev-parse', taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Show a receipt')]).trim();
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S1/run-002.json'), JSON.stringify({ ...run, verdict: 'fail', at: '2026-12-01T00:00:00.000Z', commits: [{ repo: '.', commit: elsewhere }] }));

    assert.ok(sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').includes(`RUNNING ${product()} PROVED 1 OF 1\n`));
  });

  it('a scenario whose only run at the task\'s code was skipped reads named, not run, and no proof is pointed to', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    const tip = git(dir, ['rev-parse', taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Show a receipt')]).trim();
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S2/run-001.json'), JSON.stringify({ ...run, verdict: 'skipped', task: '1.2', commits: [{ repo: '.', commit: tip }] }));
    const lines = sectionOf(screen(['task-landed', UNIT, '1.2']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`), lines.indexOf('NO QUESTIONS WAITING FOR YOU')), [
      `RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Named, not run: A charge prints its receipt.', '',
    ]);
  });

  it('is refused before the task\'s account is taken, for a task the tracker lacks, and for a unit the project lacks, writing nothing', () => {
    assert.deepStrictEqual([refused(['task-landed', UNIT, '1.3']), refused(['task-landed', UNIT, '1.9']), refused(['task-landed', 'nothing', '1.1'])], [
      'render task-landed: task 1.3 of pay has no account taken — it lands once its account is: task account pay 1.3',
      'render task-landed: task 1.9 of pay is not in the tracker',
      'render task-landed: there is no work unit "nothing"',
    ]);
  });
});

describe('a task\'s account, printed when asked (12.14.1, 12.14.2)', () => {
  it('any task\'s: its description and account with its diagrams, and each round\'s summary under its heading, a settlement\'s among them; nothing differing said so; one not yet landed says no account is written', () => {
    const printed = ['1.1', '1.2', '1.3'].map((task) => sectionOf(screen(['task-account', UNIT, task]), 'DISPLAY: task account'));

    assert.deepStrictEqual(printed, [
      [
        ACCOUNT_DRAWN,
        '',
        'REVIEWS',
        '  Round 1',
        '    The digits were shown whole; the builder masked them.',
        '  Round 2',
        '    Passed.',
        '',
      ].join('\n'),
      [
        '▪ Show a receipt (task 1.2)',
        '',
        '✓ Settled by the orchestrator in round 1',
        '',
        '- Phase: 1 — Cards',
        '- Position: 2 of 3 in phase',
        '',
        'WHAT IT DOES',
        '  Show a receipt works at the till, and the customer sees it.',
        '',
        'WHAT WAS DONE',
        '  A charge prints its receipt.',
        '  · src/receipt.js',
        '  · A charge prints one receipt.',
        '  ✓ Proves 1 criterion · 1 file changed · +1 −0',
        '',
        'DIFFERS FROM THE TASK',
        '  Nothing: it was built as the task was written.',
        '',
        'REVIEWS',
        '  Round 1',
        '    A void charge printed a receipt.',
        '  Settled',
        '    A void charge is the refunds phase\'s.',
        '',
      ].join('\n'),
      [
        '▪ Mail the receipt (task 1.3)',
        '',
        '- Phase: 1 — Cards',
        '- Position: 3 of 3 in phase',
        '',
        'WHAT IT DOES',
        '  Mail the receipt works at the till, and the customer sees it.',
        '',
        '  No account is written yet: its builder writes it as the task lands.',
        '',
      ].join('\n'),
    ]);
  });

  it('a task closed keeps its place among every task of its phase, and with no account says it closed without one', () => {
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Folded into 1.1.'], { env: env() });
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Mailing waits for later.'], { env: env() });
    const [receipt, mail] = ['1.2', '1.3'].map((task) => sectionOf(screen(['task-account', UNIT, task]), 'DISPLAY: task account').split('\n'));
    const place = (/** @type {string[]} */ lines) => lines.find((line) => line.startsWith('- Position'));

    assert.deepStrictEqual([place(receipt), place(mail), mail.at(-2)], ['- Position: 2 of 3 in phase', '- Position: 3 of 3 in phase', '  No account was written: it closed without one.']);
  });
});

describe('the headline (12.12.4)', () => {
  it('names the tasks started together in one block, each with its number, title and phase, what it is about to change and what to watch, under the build\'s step marker (12.S25, 3.3.10)', () => {
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    const payload = writeState(dir, layout.cache(UNIT, 'headline.json'), JSON.stringify({
      tasks: [
        { task: '1.1', changes: 'The till takes a card.', watch: 'The last four digits on the receipt.' },
        { task: '1.2', changes: 'A charge prints its receipt.', watch: 'The receipt prints once a charge, never twice.' },
      ],
    }));
    const out = screen(['build-headline', UNIT, '--file', payload]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Build (phase 1 of 3) · auto`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build headline'), [
      '▪ Starting 2 tasks',
      '',
      '  ├─ 1.1 Take a card',
      '  │     Phase 1 · Cards',
      '  │     About to change: The till takes a card.',
      '  │     Watch when it lands: The last four digits on the',
      '  │       receipt.',
      '  │',
      '  └─ 1.2 Show a receipt',
      '        Phase 1 · Cards',
      '        About to change: A charge prints its receipt.',
      '        Watch when it lands: The receipt prints once a charge,',
      '          never twice.',
      '',
    ].join('\n'));
  });

  it('is refused for a task not started, a task named twice, no task, and a payload of another shape, writing nothing', () => {
    const payload = (/** @type {unknown} */ given) => writeState(dir, layout.cache(UNIT, 'headline.json'), JSON.stringify(given));
    const named = (/** @type {string} */ task) => ({ task, changes: 'A change.', watch: 'A thing.' });
    const refusals = [
      { tasks: [named('1.2')] }, { tasks: [named('1.1'), named('1.1')] }, { tasks: [] }, { tasks: [{ ...named('1.1'), changes: ' ' }] }, { tasks: [named('1.1')], more: 1 },
    ].map((given) => refused(['build-headline', UNIT, '--file', payload(given)]));

    assert.deepStrictEqual([...refusals, refused(['build-headline', UNIT])], [
      'render build-headline: task 1.2 of pay is not started — the headline names tasks as they start: task start pay 1.2',
      'render build-headline: the payload names task 1.1 twice',
      'render build-headline: the payload names the tasks started together, one at least',
      'render build-headline: tasks[0]\'s task, changes and watch are each words',
      'render build-headline: the payload must be {tasks}',
      'render build-headline: Usage: engine render build-headline <work-unit> --file <payload.json>',
    ]);
  });
});

describe('the build\'s phases and tasks, printed when asked (12.12.11, 7.4.2)', () => {
  it('each phase of the cut with its state, its tasks with theirs and what holds them — a task at its gate, not running, a task after another, a phase after one it relies on — and a phase not yet written drawn from the cut, under the step marker naming the position (12.S51, 3.S19, 12.7.9)', () => {
    const out = screen(['build-progress', UNIT]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Build (phase 1 of 3) · step`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build progress'), [
      '0 of 4 tasks done · 0 running',
      '',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  ├─ ● 1.1 Take a card         [at its gate]',
      '  │  ├─ ○ 1.2 Show a receipt      [not started]',
      '  │  └─ ○ 1.3 Mail the receipt    [after 1.2]',
      '  │',
      '  ├─ Phase 2 of 3 · Refunds       [written · after phase 1]',
      '  │  └─ ○ 2.1 Refund a card       [not started]',
      '  │',
      '  └─ Phase 3 of 3 · Reports       [not yet written]',
      '',
    ].join('\n'));
  });

  it('a task a question parks waits on it and runs no more, and a phase whose review owes fixes says so in the standing\'s words; the marker names the position it was switched to (3.S19)', async () => {
    await parkOn(['1.1', '1.2']);
    for (const [letter, findings] of /** @type {Array<[string, Array<[string, string]>]>} */ ([['a', []], ['b', [['bug', 'A refund on a closed till.']]]])) {
      writeState(dir, layout.unit(UNIT, `build/phases/phase-1/review-${letter}.md`), reportOf(findings));
    }
    position('auto');
    const auto = sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build marker');
    position('step');
    const out = screen(['build-progress', UNIT]);

    assert.deepStrictEqual([auto, sectionOf(out, 'DISPLAY: build marker')], ['**`□ Build (phase 1 of 3) · auto`**\n', '**`□ Build (phase 1 of 3) · step`**\n']);
    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: build progress').split('\n').slice(0, 9), [
      '0 of 4 tasks done · 0 running',
      '',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  │  ⚑ fixes owed: phase 1\'s review failed, and no',
      '  │  │    settlement answers it — write its fixes as tasks of the',
      '  │  │    phase, then settle it, naming them: task settle pay',
      '  │  │    --phase 1 --file <why> [--fixes <task>,…]',
      '  │  ├─ ⚑ 1.1 Take a card         [waits on Q1]',
      '  │  ├─ ⚑ 1.2 Show a receipt      [waits on Q1]',
    ]);
  });

  it('a phase waits after another unit it relies on only while that unit is not finished', () => {
    const manifest = readManifest(dir, UNIT);
    manifest.cut.phases[1].relies_on = ['billing'];
    writeState(dir, layout.manifest(UNIT), JSON.stringify(manifest, null, 2));
    const tagged = () => sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build progress').split('\n').find((line) => line.includes('Refunds'));
    const before = tagged();
    createManifest(dir, 'billing', { status: 'completed' });

    assert.deepStrictEqual([before, tagged()], ['  ├─ Phase 2 of 3 · Refunds       [written · after billing]', '  ├─ Phase 2 of 3 · Refunds       [written]']);
  });
});

describe('a task linked after another (12.6.4)', () => {
  it('waits after it only while it is not done', () => {
    const tagged = () => sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build progress').split('\n').find((line) => line.includes('1.3 Mail the receipt'));
    const before = tagged();
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: env() });

    assert.deepStrictEqual([before, tagged()], ['  │  └─ ○ 1.3 Mail the receipt    [after 1.2]', '  │  └─ ○ 1.3 Mail the receipt    [not started]']);
  });
});

describe('the stop report (12.12.9, 12.13.22)', () => {
  it('when every task left is parked or waits after one that is: the build stopped, the five questions waiting first with a line each, what was built, and what each answer lets run (12.S38, 12.S26)', async () => {
    await parkFive();
    const out = screen(['build-stop', UNIT]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build stop'), '⚑ The build has stopped: nothing more can be built until you answer\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build stop report'), [
      '5 QUESTIONS WAITING FOR YOU',
      `  ├─ ⚑ Q1 ${QUESTIONS[0]} · parks 1.1`,
      `  ├─ ⚑ Q2 ${QUESTIONS[1]} · parks 1.2`,
      `  ├─ ⚑ Q3 ${QUESTIONS[2]} · parks 2.1`,
      `  ├─ ⚑ Q4 ${QUESTIONS[3]} · parks 1.2`,
      `  └─ ⚑ Q5 ${QUESTIONS[4]} · parks 1.1`,
      '',
      'WHAT WAS BUILT',
      '  0 of 4 tasks done · 0 running',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  ├─ ⚑ 1.1 Take a card         [waits on Q1, Q5]',
      '  │  ├─ ⚑ 1.2 Show a receipt      [waits on Q2, Q4]',
      '  │  └─ ○ 1.3 Mail the receipt    [after 1.2]',
      '  │',
      '  ├─ Phase 2 of 3 · Refunds       [written · after phase 1]',
      '  │  └─ ⚑ 2.1 Refund a card       [waits on Q3]',
      '  │',
      '  └─ Phase 3 of 3 · Reports       [not yet written]',
      '',
      'WHAT RUNS ONCE YOU ANSWER',
      '  ├─ Q1',
      '  │     1.1 Take a card',
      '  ├─ Q2',
      '  │     1.2 Show a receipt',
      '  │     then 1.3',
      '  ├─ Q3',
      '  │     2.1 Refund a card',
      '  ├─ Q4',
      '  │     1.2 Show a receipt',
      '  │     then 1.3',
      '  └─ Q5',
      '        1.1 Take a card',
      '',
    ].join('\n'));
  });

  it('is refused while no question waits, and while a task can still be built — one in progress, or one ready that task start would take, that no question parks — writing nothing (12.12.9, 12.13.22)', async () => {
    const none = refused(['build-stop', UNIT]);
    await parkOn(['1.2']);
    const running = refused(['build-stop', UNIT]);
    await parkOn(['1.1'], 1);
    fs.writeFileSync(path.join(config, 'task.md'), taskText('Void a charge', ['A void charge prints nothing.']));
    ok(dir, ['task', 'create', UNIT, '1', '--file', path.join(config, 'task.md')], { env: env() });

    assert.deepStrictEqual([none, running, refused(['build-stop', UNIT])], [
      'render build-stop: no question waits on the person in pay\'s build — it stops only where nothing can go on without their answer (12.13.22)',
      'render build-stop: pay\'s build goes on with task 1.1, which no question parks — it stops only where nothing can go on without the person\'s answer (12.13.22)',
      'render build-stop: pay\'s build goes on with task 1.4, which no question parks — it stops only where nothing can go on without the person\'s answer (12.13.22)',
    ]);
  });

  it('stops where the only task ready is of a phase whose start the engine holds — Refunds relying on Cards, written ahead, which task start refuses — and is refused once only Claude\'s own items stand before that start, Refunds relying on nothing (12.7.7, 12.7.5, 6.4.8)', async () => {
    await parkOn(['1.2']);
    await parkOn(['1.1'], 1);
    const stopped = sectionOf(screen(['build-stop', UNIT]), 'DISPLAY: build stop');
    const start = refusedPristine(dir, ['task', 'start', UNIT, '2.1'], { env: env() }).error;
    const manifest = readManifest(dir, UNIT);
    manifest.cut.phases[1].relies_on = [];
    createManifest(dir, UNIT, manifest);

    assert.strictEqual(stopped, '⚑ The build has stopped: nothing more can be built until you answer\n');
    assert.strictEqual(start, 'task start: phase 2 of pay has not started — its tasks start once its start checklist closes: checklist close phase-start pay 2');
    assert.strictEqual(refused(['build-stop', UNIT]),
      'render build-stop: pay\'s build goes on with task 2.1, which no question parks — it stops only where nothing can go on without the person\'s answer (12.13.22)');
  });
});
