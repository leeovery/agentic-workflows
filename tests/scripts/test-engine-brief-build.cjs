'use strict';

// ---------------------------------------------------------------------------
// The build's briefs (leeway-engine/scripts/domain/brief.cjs, its records
// domain/brief-records.cjs, the templates content/briefs/) and the build's
// agents (agents/leeway-{builder,reviewer,task-writer,consolidation}.md):
// `engine brief <role> <unit> <N> [--base <branch>]` for a phase of the
// unit's cut. The task writer's brief — the phase from the cut, its
// sections verbatim and which of them it builds first, never the rest of
// the spec (12.S9, 11.S17), its scenarios, the notes held for it, its tasks
// written so far, the earlier phases' unfinished tasks, the calls made in
// the build, the entries a replacement affects, and where its task files go
// — and its template: the six principles, the task template, one `task
// create` per task linked after what it waits on, every scenario given to a
// task, shared design settled while writing, an invariant's check in the
// phase that first builds it (12.3–12.5, 7.S3, 15.S12). The consolidation
// agent's brief — the notes the phase takes, its tasks whole, its range
// across repositories to its stack's tip, and where its report goes — its
// template's rules, report and task examples reading by their grammars
// (12.S23, 13.S12, 15.8.5). The builder's template: its task laid out with
// `task worktree` first and committed only there (12.7.10), each scenario
// proven by running it (15.2.14), its account written where its brief says,
// its ask rule and its answer to reviewers who disagree (13.S7); the
// reviewer's report placed, its notes for later a section before its
// findings, and its final message the nits, the notes and the verdict
// (13.5.9, 12.10.1); and the task's and the phase's reviewers told that a wrong
// result is a finding even where its fix reaches beyond the task (13.S11).
// No template tells an agent to break a task down, keep a to-do
// list, check its own work or leave no stubs (12.3.8), or names a model, an
// effort or a project skill's path (15.S15). The refusals, nothing written
// and no brief stored. Each build agent's definition: Opus at medium, the
// builder and the reviewer with the Skill tool (15.S22), and no
// higher-effort variant on the roster (26.S7, 27.S7). The phase review's
// briefs are test-engine-brief-build-review.cjs's.
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  AGENTS,
  UNIT,
  LINTERS,
  NESTED,
  AREA_1,
  AREA_2,
  PART_1_2,
  PART_2_1,
  CUT,
  taskText,
  TASKS,
  branchOf,
  commitFile,
  tipOf,
  calls,
  useWorld,
  issued,
  template,
  filledTemplate,
  refusedUnissued,
  pathDrawn,
  rangeDrawn,
  ok,
  statePath,
  layout,
  writeState,
  readState,
  commitAll,
  git,
  SPEC_FILE,
  readTaskText,
  readConsolidation,
} = require('./brief-build-world.cjs');

/** @type {string} */
let dir;

describe('the task writer\'s brief (12.5, 12.S9, 11.S17)', () => {
  useWorld((at) => { dir = at; });

  it('for a phase not yet written: the phase, its sections and which an earlier phase built, its scenarios, the note held for it, the earlier phases\' unfinished tasks, the calls made in the build, the entries a replacement affects, and where its files go', () => {
    const { res, brief, whose } = issued(['task-writer', UNIT, '3']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'task-writer', agent: 'leeway-task-writer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'task-writer', agent: 'leeway-task-writer', unit: UNIT, task: null, topic: null });
    const { affected } = ok(dir, ['ledger', 'affected', UNIT]);
    assert.strictEqual(affected.length, 1, 'the finding resting on the replaced decision is affected');
    assert.strictEqual(brief, `Brief ${res.id} — the task writer's, for pay phase 3\n\n${filledTemplate('task-writer', {
      'cut-phase': 'Phase 3 of pay: Refund receipts\n\nA refund gets its receipt.\n\nIt relies on phase 2.',
      'phase-sections': [`\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\``, '- §2.1, first built in phase 2\n- §1.2, first built in phase 1', PART_2_1, PART_1_2].join('\n\n'),
      'phase-scenarios': '- 2.S2: Given a refund, when it lands, then a receipt follows. (2.1.1)',
      'held-notes': '## Note 2\n\nA refund screen wants its own receipt.',
      'written-tasks': 'The phase is not written in the tracker yet.',
      'earlier-tasks': '- 1.2 Show a receipt, in progress\n- 1.4 Check the number, not started\n- 2.1 Refund a charge, not started',
      'build-calls': [
        `- ${calls.builder}, Claude's, for task 1.2: The receipt is a PDF.\n  It is kept a year.\n  Why: Customers print it.`,
        `- ${calls.api}, the person's, replacing ${calls.byHand}: Refunds through the API.\n  Why: They come weekly now.`,
      ].join('\n'),
      'affected-entries': `\`\`\`json\n${JSON.stringify(affected, null, 2)}\n\`\`\``,
      'task-files-to': pathDrawn('.cache/pay/build/phase-3/task-writer'),
    })}`);
  });

  it('12.S9, 11.S17: a brief reads the sections its phase names and never the rest of the spec — the first phase\'s, which builds its area first, drawing a part the third never does', () => {
    const first = issued(['task-writer', UNIT, '1']).brief;
    const third = issued(['task-writer', UNIT, '3']).brief;

    assert.ok(first.includes(`# Its sections\n\n\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\`\n\n- §1, first built in this phase\n\n${AREA_1}\n\n# Its scenarios\n`), first);
    assert.ok(!third.includes('1.1.1 A card is taken once.') && !third.includes('## 1. Cards'), 'a phase naming neither the area nor the part draws neither');
  });

  it('a phase written already draws its tasks so far, and a first phase relies on nothing, has no earlier tasks and none of the note held for another phase', () => {
    const { brief } = issued(['task-writer', UNIT, '1']);

    assert.ok(brief.includes('# Notes held for this phase\n\nNone recorded.\n'), brief);
    assert.ok(brief.includes('# The phase\n\nPhase 1 of pay: Cards\n\nA customer pays by card.\n\nIt relies on nothing.\n'), brief);
    assert.ok(brief.includes('# Its tasks written so far\n\n- 1.1 Take a card, done\n- 1.2 Show a receipt, in progress\n- 1.3 Store a card, closed\n- 1.4 Check the number, not started\n\n# Earlier phases\' unfinished tasks\n\nNone recorded.\n'), brief);
  });

  it('11.5.2: an area a later phase names whole was first built where an earlier phase built a part of it', () => {
    const manifest = JSON.parse(readState(dir, layout.manifest(UNIT)));
    const phases = [{ ...CUT.phases[0], sections: ['1.2'] }, { ...CUT.phases[1], sections: ['1'], relies_on: [1] }, CUT.phases[2]];
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, cut: { phases } }));
    commitAll(dir, 'a part before its area');

    assert.ok(issued(['task-writer', UNIT, '2']).brief.includes('# Its sections\n\n' + `\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\`` + '\n\n- §1, first built in phase 1\n'));
  });

  it('a phase naming an area and a part of it draws the area once, the part within it', () => {
    const { brief } = issued(['task-writer', UNIT, '2']);

    assert.ok(brief.includes(`- §2, first built in this phase\n- §2.1, first built in this phase\n\n${AREA_2}\n\n# Its scenarios\n`), brief);
  });
});

describe('the consolidation agent\'s brief (12.10.3, 13.8.3, 12.S23, 13.S12)', () => {
  useWorld((at) => { dir = at; });

  it('the notes the phase takes — never one held for another phase — its tasks whole, its range to the stack\'s tip in each repository, a closed task\'s branch beside it read in none, where its report goes and where its task files go', () => {
    const { res, brief, whose } = issued(['consolidation', UNIT, '1', '--base', 'main']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'consolidation', agent: 'leeway-consolidation', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'consolidation', agent: 'leeway-consolidation', unit: UNIT, task: null, topic: null });
    const whole = (/** @type {number} */ n, /** @type {string} */ stands) => {
      const [name, reference] = TASKS[1][n - 1];
      return taskText(name, reference).replace(/^#/gm, '##').replace(`## ${name}\n`, `## 1.${n} ${name}\n\n${stands}\n`);
    };
    assert.strictEqual(brief, `Brief ${res.id} — the consolidation agent's, for pay phase 1\n\n${filledTemplate('consolidation', {
      'phase-notes': '## Note 1\n\nReading a card back never checks its expiry.\n\n## Note 3\n\nTwo card helpers do the same.',
      'phase-tasks': [
        whole(1, 'It is done.'), `${whole(2, 'It is in progress.')}\n\n### Added by the person\n\nThe receipt is emailed.`, whole(3, 'It was closed: folded into 1.1'), whole(4, 'It is not started.'),
      ].join('\n\n'),
      'phase-diff-range': [
        rangeDrawn('the project\'s repository', branchOf(1, 4), ['src/card.js', 'src/check.js', 'src/receipt.js']), rangeDrawn(`\`${NESTED}\``, branchOf(1, 1), ['card/token.js']),
      ].join('\n\n'),
      'consolidation-to': pathDrawn('pay/build/phases/phase-1/consolidation.md'),
      'task-files-to': pathDrawn('.cache/pay/build/phase-1/consolidation'),
    })}`);
  });

  it('a note another phase\'s report took is not this phase\'s to take', () => {
    writeState(dir, 'pay/build/phases/phase-2/consolidation.md', '## The notes\n\n- Note 3: dropped — the helpers were merged.\n');

    const { brief } = issued(['consolidation', UNIT, '1', '--base', 'main']);

    assert.ok(brief.includes('# The notes\n\n## Note 1\n\nReading a card back never checks its expiry.\n\n# The phase\'s tasks\n'), brief);
  });
});

describe('the build\'s templates', () => {
  it('7.S3, 15.S12: the template gives the six principles, the task template — whose example reads by its grammar — one task create per task with its links as it goes, every scenario given to a task, shared design settled while writing, and an invariant\'s check in the phase that first builds it', () => {
    const words = template('task-writer');
    const example = /\n```markdown\n([\s\S]*?)\n```\n/.exec(words)?.[1] ?? '';

    assert.deepStrictEqual([...words.matchAll(/^([1-6])\. /gm)].map(([, n]) => n).slice(0, 6), ['1', '2', '3', '4', '5', '6']);
    assert.strictEqual(readTaskText(example.replace(/\{feat[^}]*\}/, 'feat').replace(/\{[^}]*\}/g, 'x')).type, 'feat');
    for (const line of [
      'A task likely to run past about 10,000 changed lines is probably two. There is no lower bound.',
      'Tasks are written at the phase\'s start against the code, at product altitude, naming no mechanism the record did not decide.',
      '`task create {unit} {N} --file {file}`, one call per task, as you go.',
      '`task link {unit} {N}.{n} --after {task}`',
      'Each of the phase\'s scenarios goes to the task that makes it true, and every one of them goes to a task.',
      'Settle a design several tasks touch as you write them, never leaving it to two builders',
      'An invariant in a section first built in this phase gets the task that adds its check',
    ]) assert.ok(words.includes(line), line);
  });

  it('the template\'s report example reads by the consolidation report\'s grammar, and its task example by the task template\'s', () => {
    const [report, task] = [...template('consolidation').matchAll(/\n```markdown\n([\s\S]*?)\n```\n/g)].map(([, example]) => example);

    assert.deepStrictEqual(readConsolidation(report).map(({ notes, kind }) => [notes, kind]), [[[1], 'dropped'], [[2, 4], 'task']]);
    assert.strictEqual(readTaskText(task.replace(/\{feat[^}]*\}/, 'fix').replace(/\{[^}]*\}/g, 'x')).type, 'fix');
  });

  it('15.S5, 15.S9, 15.S10, 13.S9: the template makes a scenario not proven at the phase\'s tips and a mutant that survived in a criterion\'s code findings, breaks the riskiest line in a scratch worktree where no tool exists, and carries the task reviewer\'s stance, call, report, comment and reference rules word for word', () => {
    const words = template('phase-review');
    const from = (/** @type {string} */ text) => text.slice(text.indexOf('# A failed review'));

    for (const rule of [
      'A mutant that survived in code a criterion covers is a finding.',
      'Where the verify setup names no mutation tool, break the riskiest line of each criterion\'s code in that scratch worktree, never the phase\'s: a break the tests do not catch is a finding.',
      'A scenario its runs leave "not proven", or "named, not run", at the phase\'s tips is a finding, and reads so in your report, in those words.',
    ]) assert.ok(words.includes(rule), rule);
    assert.ok(words.includes('where the phase meets what it relies on from earlier phases'), words);
    assert.strictEqual(from(words), from(template('reviewer')).replace('Review the task as a professional would', 'Review the phase as a professional would'));
  });

  it('13.S11: a wrong result in what the work does is a finding even where its fix reaches beyond the task, only an improvement or a hole beyond it a note — told to the task\'s reviewers and the phase\'s, never left to read the notes rule as taking it', () => {
    const line = 'A wrong result in what the work does is always a finding, even when its fix reaches beyond the task. Only an improvement, or a hole or edge case beyond the task, is a note for later.';

    for (const role of ['reviewer', 'phase-review']) assert.ok(template(role).includes(`goes to the notes for later or through the ask rule; the orchestrator lands it.\n\n${line}\n`), role);
  });

  it('13.S7: the template has the builder decide against the brief and the design where the reviewers disagree, and its ask rule keeps every question for the person off the builder', () => {
    const words = template('builder');

    for (const line of [
      'Where the two reviewers disagree, or you reject a finding, decide against this brief and the design, and say why in the round\'s summary. The next round reads the whole task again.',
      'A feasible way the person would leave to you — how the code does what the record decided — is yours: take it, and report it as your call with why',
      'A question the person would want to answer — what the product does, or a decision the record holds that the work shows wrong — is never yours.',
      'A problem you cannot build past: stop, and report what you met and where the work stands.',
      'You never ask the person.',
    ]) assert.ok(words.includes(line), line);
  });

  it('13.5.9, 12.10.1: each reviewer\'s template has the report written whole to its file, its notes for later in a section of their own before its findings, and the final message carry only the nits, the notes for later and the verdict', () => {
    for (const [role, slot] of [['reviewer', 'round-report-to'], ['phase-review', 'phase-report-to']]) {
      const words = template(role);
      assert.ok(words.includes(`# Where your report goes\n\n{{${slot}}}\n`), role);
      assert.ok(words.includes('Your report ends in its notes for later, then its findings, then its verdict. The notes for later are the section just before the findings, `## Notes for later`: each note an item naming what lies beyond the task and where it is; or `None.` where there is none.'), role);
      assert.ok(words.includes('Write the whole report to the file under "Where your report goes". Your final message then holds only the report\'s nits, then its notes for later, each as the report words it, and its verdict line, and nothing else.'), role);
    }
  });

  it('12.7.10: the builder lays its task out with task worktree before anything else, and builds, runs and commits only there', () => {
    const words = template('builder');

    assert.ok(words.includes('Before anything else, lay the task out in the worktree you were started in: from its root, run the engine\'s `task worktree {unit} {task}`'), words);
    assert.ok(words.includes('Build, run and commit only there.'), words);
    assert.ok(words.indexOf('# Where you work') < words.indexOf('# Where the task leaves a call open'), 'laying the task out comes before the work');
  });

  it('15.S15: no builder\'s or reviewer\'s template names a project skill\'s path — the engine\'s alone, as installed', () => {
    for (const role of ['builder', 'fix', 'reviewer', 'phase-review']) assert.doesNotMatch(template(role), /\.claude\/skills\/(?!leeway-engine\/scripts\/engine\.cjs )|SKILL\.md/, role);
  });

  it('12.7.10: the builder runs the engine by the absolute path of the checkout the orchestrator runs in, never the one its worktree holds, which starts at the remote\'s default branch', () => {
    const words = template('builder');

    assert.ok(words.indexOf('# The engine\n\n{{engine}}') === 0, words);
    assert.doesNotMatch(words, /node \.claude\//);
  });

  it('12.7.10: the orchestrator\'s own commit from a task\'s worktree — a nit it fixes — runs the engine by the absolute path its entry names, never the worktree\'s', () => {
    const build = path.join(__dirname, '../../skills/leeway-implementation-process');
    const skill = fs.readFileSync(path.join(build, 'SKILL.md'), 'utf8');
    const loop = fs.readFileSync(path.join(build, 'references/the-task-loop.md'), 'utf8');

    assert.ok(skill.includes('each verb under **Doors**; one made from a task\'s worktree runs as the entry\'s `engine`.'), skill);
    assert.ok(skill.includes('`commit --paths {file}… --task {work_unit} {task} -m "{message}"`, from the task\'s worktree, yours run as the entry\'s `engine`.'), skill);
    assert.ok(loop.includes('commit the fixes from there through the door, the entry\'s `engine` running `commit --paths {file}… --task {work_unit} {task} -m "{message}"`'), loop);
  });

  it('15.2.14, 15.S18, 22.5.1, 15.4.2: once its work is committed the builder records again the verify setup its task builds or changes, from the file its brief names, starting from the setup that stands, and runs each of its task\'s scenarios through verify from its worktree, a timeout to match; its account names what it ran and never what the runs prove', () => {
    const words = template('builder');

    for (const rule of [
      'Once the work is committed through the door, run each acceptance scenario of the task from your task\'s worktree, one at a time: the engine\'s `verify run {unit} {scenario}`. A drive can run for minutes: give the Bash call a timeout to match.',
      'Where your task builds the verify setup or changes any part of it, record it again once it is committed, from your task\'s worktree, before running: write the setup to the file under "Where the verify setup goes", starting from the setup recorded there where there is one, then run the engine\'s `verify setup {unit} --file {that file} --scenario {scenario}`.',
      '## What the tests prove\n\n{each scenario you ran through `verify`, and what its drive does}\n',
      'In your account, under `## What the tests prove`, name each scenario you ran through `verify` and what its drive does. What the runs prove is the engine\'s to say, never the account\'s.',
      'Where the project has no verify setup recorded yet and your task does not build it, say so there instead of running.',
      '# Where the verify setup goes\n\n{{setup-to}}\n',
    ]) assert.ok(words.includes(rule), rule);
  });

  it('13.2.2: the reviewer and the test reader test in the scratch worktree their brief lays out, taking it apart after, and never move another checkout; the phase review\'s template points to it and never repeats it', () => {
    const rule = 'Run the tests, and make any break, in the scratch worktree your brief lays out under "Laying out your scratch worktree": lay it out with its first call, work in the folder its answer names, and take it apart with its second once your report is written. Never check out, detach or switch anything in another checkout.';
    for (const agent of ['leeway-reviewer', 'leeway-test-surface']) assert.ok(fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8').includes(rule), agent);
    for (const role of ['reviewer', 'phase-review']) assert.ok(!template(role).includes('Run the tests, and make any break'), role);
    assert.ok(template('reviewer').includes('# Laying out your scratch worktree\n\n{{scratch-layout}}\n'));
    assert.ok(template('phase-review').includes('# Laying out your scratch worktree\n\n{{phase-scratch-layout}}\n'));
  });

  it('12.14: the builder writes its account to the file its brief names', () => {
    assert.ok(template('builder').includes('As the task lands, write its account to the file under "Where your account goes"'));
  });

  it('12.3.2–12.3.5, 12.10.3, 15.8.5: the task writer\'s principles and the consolidation\'s rules, each in the words that carry it', () => {
    const writer = template('task-writer');
    for (const rule of [
      '1. Every phase ends with the product running and its new behaviour reachable, proven by running it. No task leaves work unwired for a later one to join up.',
      '2. The first phase gets the product running and drivable — it launches, a smoke check passes, the verify setup exists — and sets the pattern later work copies.',
      '3. Shared ground first, then parallel: a design several tasks touch is settled, and the code they share is built by one task, before work fans out. Tasks that run side by side each own their files; work on a shared file runs one task at a time, each linked after the one before.',
      '4. Cut by what someone can do, not by layer, as far as the product allows; where it is too interconnected, cut so the pieces meet as early as they can.',
      'after each task it waits on: one of this phase, or an unfinished one of an earlier phase. A task waiting on none is linked after none, and runs beside the rest.',
    ]) assert.ok(writer.includes(rule), rule);
    const consolidation = template('consolidation');
    for (const rule of [
      'Drop each note the code already settled, saying how; what remains becomes tasks of this phase, built and reviewed as any task is.',
      'A note proposing a check — a finding the reviews raised in two tasks — becomes the task that adds that check',
      'Take every note below, each once.',
      'A report already at the path is this phase\'s: read it first. Its items stand as they are; add an item for each note below that none of them takes.',
    ]) assert.ok(consolidation.includes(rule), rule);
  });

  it('12.3.8: none tells an agent to break a task down, keep a to-do list, check its own work or leave no stubs, nor names a model or an effort', () => {
    const steering = /break (?:it|the task|this task) down|to-?do list|check (?:your|its) (?:own )?work|verify your (?:own )?work|\bstubs?\b|\beffort\b|\bopus\b|\bsonnet\b/i;
    assert.match('Keep a to-do list, and check your own work.', steering, 'the rule catches what it forbids');

    for (const role of ['builder', 'fix', 'reviewer', 'task-writer', 'consolidation', 'phase-review']) assert.doesNotMatch(template(role), steering, role);
  });
});

describe('the refusals, nothing written and no brief stored', () => {
  useWorld((at) => { dir = at; });

  it('arguments of another shape, a unit the project lacks, a unit whose build has not begun, and a phase its cut lacks', () => {
    for (const args of [['task-writer', UNIT], ['task-writer', UNIT, '1', 'more'], ['consolidation', UNIT, '1', '--base'], ['phase-review', UNIT, '--base', 'main', '--letter', 'a'], ['phase-review', UNIT, '1', '--base', 'main']]) refusedUnissued(args, /^Usage: /);
    refusedUnissued(['task-writer', UNIT, 'one'], /^task-id: "one" is not a phase/);
    refusedUnissued(['task-writer', 'nope', '1'], /^Work unit "nope" not found$/);
    refusedUnissued(['task-writer', 'draft', '1'], /^brief: draft's build has not begun — a phase is briefed once ready to build's yes begins it$/);
    refusedUnissued(['task-writer', UNIT, '4'], /^brief: pay's cut has no phase 4 — its phases are 1 to 3$/);
  });

  it('a phase not written, whose tasks and range the consolidation and the phase review draw', () => {
    for (const args of [['consolidation', UNIT, '3', '--base', 'main'], ['phase-review', UNIT, '3', '--base', 'main', '--letter', 'a']]) refusedUnissued(args, /^phase 3 of pay is not written — its tasks are written as it starts$/);
  });

  it('a cut naming a section or a scenario the spec lacks', () => {
    const manifest = JSON.parse(readState(dir, layout.manifest(UNIT)));
    const named = (/** @type {object} */ first) => writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, cut: { phases: [{ ...CUT.phases[0], ...first }, ...CUT.phases.slice(1)] } }));
    named({ sections: ['1', '5'] });
    commitAll(dir, 'a section the spec lacks');
    refusedUnissued(['task-writer', UNIT, '1'], /^phase 1 of the cut names §5, which the spec lacks$/);
    named({ scenarios: ['1.S9'] });
    commitAll(dir, 'a scenario the spec lacks');
    refusedUnissued(['task-writer', UNIT, '1'], /^phase 1 of the cut holds 1\.S9, which the spec lacks$/);
  });

  it('a range\'s base no repository holding the phase\'s work has, tasks that are no one stack, and a phase no repository holds work on', () => {
    refusedUnissued(['phase-review', UNIT, '1', '--base', 'trunk', '--letter', 'a'], /^the base trunk is no local branch in any repository holding phase 1 of pay's tasks$/);
    git(dir, ['branch', '-f', branchOf(1, 4), 'main']);
    commitFile(dir, 'src/aside.js');
    git(dir, ['branch', '-f', branchOf(1, 4), 'HEAD']);
    git(dir, ['reset', '-q', '--hard', 'HEAD~1']);
    refusedUnissued(['consolidation', UNIT, '1', '--base', 'main'], new RegExp(`^phase 1 of pay's tasks are no one stack in the project's repository — ${branchOf(1, 1)}, ${branchOf(1, 2)}, ${branchOf(1, 4)} each hold work another lacks`));
    git(dir, ['branch', '-D', branchOf(2, 1)]);
    refusedUnissued(['phase-review', UNIT, '2', '--base', 'main', '--letter', 'a'], /^no repository of the project holds work on phase 2 of pay's tasks$/);
  });

  it('a mutation tool not yet run over the phase at its tips, and no verify setup recorded', () => {
    const phaseReview = ['phase-review', UNIT, '2', '--base', 'main', '--letter', 'a'];
    const tip = tipOf(dir, branchOf(2, 1));
    refusedUnissued(phaseReview, new RegExp(`^the mutation tool has not run over phase 2 of pay at its tips — the project's repository at ${tip} — engine verify mutants pay 2 runs it$`));
    const project = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS } }, null, 2));
    commitAll(dir, 'no verify setup');
    refusedUnissued(phaseReview, /^the project has no verify setup recorded — /);
  });
});

describe('the build\'s agents (26.4, 26.5.3, 15.10.6)', () => {
  /** An agent's definition's frontmatter, by key. @param {string} agent @returns {Record<string, string>} */
  const frontmatter = (agent) => {
    const head = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8'))?.[1] ?? '';
    return Object.fromEntries(head.split('\n').map((line) => /^(\w+): (.*)$/.exec(line)).filter((match) => match !== null).map((match) => [match[1], match[2]]));
  };
  const BUILD = ['leeway-builder', 'leeway-reviewer', 'leeway-task-writer', 'leeway-consolidation'];

  it('15.S22: the builder\'s and the reviewer\'s definitions give each the Skill tool', () => {
    for (const agent of ['leeway-builder', 'leeway-reviewer']) assert.ok(frontmatter(agent).tools.split(', ').includes('Skill'), agent);
  });

  it('26.S7, 26.S8, 26.S11, 27.S7: each build agent runs Opus at medium, fixed in its definition; the roster names no variant of one — a definition named for it — and no agent of it runs another model or above medium but the root-cause validation', () => {
    for (const agent of BUILD) assert.deepStrictEqual([frontmatter(agent).model, frontmatter(agent).effort], ['opus', 'medium'], agent);
    const roster = fs.readdirSync(AGENTS).filter((file) => file.endsWith('.md')).map((file) => file.slice(0, -'.md'.length));
    assert.deepStrictEqual(roster.filter((agent) => BUILD.some((build) => agent !== build && agent.startsWith(build))), []);
    for (const agent of roster) {
      const { model, effort } = frontmatter(agent);
      assert.strictEqual(model, 'opus', agent);
      if (agent !== 'leeway-investigation-root-cause-validation') assert.ok(effort === undefined || effort === 'medium', `${agent}: ${effort}`);
    }
  });
});
