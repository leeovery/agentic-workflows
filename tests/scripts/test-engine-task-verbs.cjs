'use strict';

// ---------------------------------------------------------------------------
// The `task` verbs (workflow-engine/scripts/domain/task-verbs.cjs, the task
// template in domain/task-file.cjs): `engine task phase|create|add|type|
// link|ready|start|done|close|list|show`, through the project's task driver.
// Their answers, in the engine's words and names; the tracker set up by the
// first verb — the default driver written as the project's setting, the
// tool's local files ignored, its store made in the state worktree — the
// setting and the lines committed alone, whatever else the working files
// hold, by a write, a read or a refusal; every write one state commit,
// pushed, never a code commit (7.S17, 7.S21); a refusal writing nothing, or
// committing what setting up and the verb wrote before it, under a message
// saying so; a tool missing or failing named; a task numbered after its
// phase's highest; the task in flight on the conversation's position; and
// the writer lock around every verb, reads included. What a driver does
// with a task is the conformance suite's.
//
// Layer: verb. World: a project with its state worktree and one work unit,
// from the fixture library, and the same with the unit's first phase
// written — three tasks, the third after the first, the tracker set up by
// the phase's verb and the tasks made through the driver — each built once
// and copied. The default driver runs its real tool; its
// side of the suite (tests/drivers/{name}/task.cjs) does what a person
// might in that tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refuses, git, stateGit, statePath, layout, head, lastMessage, commitAll, fixtureFrom, cleanupFixture, lockAttempts, bareRepo, remoteTip,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { readPosition } = require(path.join(SCRIPTS, 'domain/position.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { FOREIGN_TASK } = require(path.join(SCRIPTS, 'domain/task-id.cjs'));
const { readTaskText } = require(path.join(SCRIPTS, 'domain/task-file.cjs'));
const UNIT = 'pay';
const SESSION_ID = 'task-verbs-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);
/** The default driver's side of the suite. */
const SIDE = require(path.join(__dirname, '..', 'drivers', DRIVER.name, 'task.cjs'));

/**
 * A task file holding the template, its fields as given over the defaults.
 * @param {string} title @param {Record<string, string>} [fields]
 */
function template(title, fields = {}) {
  const held = {
    Type: 'feat', Problem: `${title} is missing.`, Solution: `Add ${title.toLowerCase()}.`, Outcome: `${title} works.`,
    'Acceptance scenarios': `- Given a ledger, when ${title.toLowerCase()} runs, then it answers.`, 'Spec reference': '§7.1', ...fields,
  };
  return `# ${title}\n\n${Object.entries(held).map(([heading, body]) => `## ${heading}\n${body}\n`).join('\n')}`;
}

/** The file's path, written beside the project. @param {string} dir @param {string} name @param {string} text */
function taskFile(dir, name, text) {
  const file = path.join(dir, '..', `${name}.md`);
  fs.writeFileSync(file, text);
  return file;
}

/** A task created from a template file. @param {string} dir @param {string} title */
function create(dir, title, phase = '1') {
  return ok(dir, ['task', 'create', UNIT, phase, '--file', taskFile(dir, title.replace(/\W+/g, '-'), template(title))]);
}

/** The project and its unit, the state committed. */
const unitWorld = fixtureFrom('task-verbs-', (dir) => {
  createManifest(dir, UNIT, {});
  commitAll(dir, 'init');
});

/**
 * The unit's first phase written: three tasks, the third after the first —
 * the tracker set up by the phase's verb, the tasks and the link made
 * through the driver and committed at once.
 */
const phasedWorld = fixtureFrom('task-verbs-phased-', (dir) => {
  createManifest(dir, UNIT, {});
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'The ledger']);
  ['Write the ledger', 'Read the ledger', 'Fold the ledger'].forEach((title, i) => DRIVER.createTask(statePath(dir), { unit: UNIT, phase: 1, n: i + 1 }, readTaskText(template(title))));
  DRIVER.link(statePath(dir), { unit: UNIT, phase: 1, n: 3 }, { unit: UNIT, phase: 1, n: 1 });
  commitAll(dir, 'the first phase written');
});

/** @type {string} */
let dir;

afterEach(() => {
  cleanupFixture(path.dirname(dir));
});

/** A world copied into a folder of its own, beside which task files are written. @param {(at: string) => string} world */
function inFolder(world) {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(require('os').tmpdir(), 'task-verbs-')));
  return world(path.join(folder, 'project'));
}

/** The files the state's last commit changed. */
const lastFiles = () => stateGit(dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').sort();
const projectManifest = () => JSON.parse(fs.readFileSync(statePath(dir, layout.projectManifest), 'utf8'));

/** The state branch's tip, the store, and what the state's tree holds uncommitted. */
const written = () => ({
  tip: head(dir),
  store: DRIVER.storeFiles().map((file) => (fs.existsSync(statePath(dir, file)) ? fs.readFileSync(statePath(dir, file), 'utf8') : null)),
  uncommitted: stateGit(dir, ['status', '--porcelain']),
});

/**
 * Each refusal in its words, and between them all nothing written.
 * @param {[string[], string][]} refusals @param {Record<string, string>} [env]
 */
function refusePristine(refusals, env) {
  const before = written();
  for (const [args, error] of refusals) assert.strictEqual(refuses(dir, args, { env }).error, error, args.join(' '));
  assert.deepStrictEqual(written(), { ...before, uncommitted: '' }, 'nothing written');
}

/** A folder beside the project holding git and ps alone, for a PATH without the driver's tools. */
function toolless() {
  const bin = fs.mkdtempSync(path.join(path.dirname(dir), 'bin-'));
  for (const tool of ['git', 'ps']) {
    const found = (process.env.PATH ?? '').split(path.delimiter).map((folder) => path.join(folder, tool)).find((file) => fs.existsSync(file));
    if (found !== undefined) fs.symlinkSync(found, path.join(bin, tool));
  }
  return bin;
}

/** One refusal's words, nothing written. @param {string[]} args @param {Record<string, string>} [env] */
function refusesPristine(args, env) {
  const before = written();
  const { error } = refuses(dir, args, { env });
  assert.deepStrictEqual(written(), { ...before, uncommitted: '' }, 'nothing written');
  return error;
}

describe('the tracker set up by the first task verb (7.S17, 7.S21)', () => {
  beforeEach(() => { dir = inFolder(unitWorld); });

  it('task phase: the default driver set, its local files ignored and its store made in the state worktree, one state commit carrying them with the phase, pushed; a later write commits its store alone, another flow\'s change to the setting\'s file or the ignore file left uncommitted (7.S17)', () => {
    const codeTip = git(dir, ['rev-parse', 'HEAD']).trim();
    const bare = bareRepo(path.join(dir, '..', 'origin.git'));
    git(dir, ['remote', 'add', 'origin', bare]);
    git(dir, ['push', '-q', 'origin', STATE_BRANCH]);

    assert.deepStrictEqual(ok(dir, ['task', 'phase', UNIT, '1', '--title', 'The ledger']), {
      ok: true, phase: 1, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });

    assert.strictEqual(lastMessage(dir), 'task(pay): write phase 1');
    assert.deepStrictEqual(lastFiles(), [layout.gitignore, layout.projectManifest, ...DRIVER.storeFiles()].sort());
    assert.strictEqual(projectManifest().drivers.task, DRIVER.name);
    const ignored = fs.readFileSync(statePath(dir, '.gitignore'), 'utf8').split('\n');
    for (const pattern of DRIVER.localFiles()) assert.ok(ignored.includes(pattern), `the state ignores ${pattern}`);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain', '--ignored']).split('\n').filter((line) => line.startsWith('?? ')).length, 0, 'every file the tool keeps is committed or ignored');
    assert.deepStrictEqual([git(dir, ['rev-parse', 'HEAD']).trim(), git(dir, ['status', '--porcelain'])], [codeTip, ''], 'the code branch untouched');
    assert.strictEqual(remoteTip(bare), head(dir));
    const setUp = { manifest: projectManifest(), ignored: fs.readFileSync(statePath(dir, '.gitignore'), 'utf8') };
    ok(dir, ['manifest', 'set', 'project.defaults.plan_format', 'kept-out']);
    fs.appendFileSync(statePath(dir, '.gitignore'), '/scratch/\n');

    assert.deepStrictEqual(ok(dir, ['task', 'ready', UNIT]), { ok: true, tasks: [] }, 'a read with nothing of its setting up to commit answers no commit');
    ok(dir, ['task', 'phase', UNIT, '2', '--title', 'The screen']);

    assert.deepStrictEqual(lastFiles(), DRIVER.storeFiles());
    assert.deepStrictEqual({ setting: projectManifest().drivers, ignored: fs.readFileSync(statePath(dir, '.gitignore'), 'utf8') }, { setting: setUp.manifest.drivers, ignored: `${setUp.ignored}/scratch/\n` });
    assert.deepStrictEqual(stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean).sort(), [' M .gitignore', ' M manifest.json']);
  });

  it('a verb the tracker refuses after it wrote commits what it wrote under a message saying it was refused, and the next verb carries none of it', () => {
    refuses(dir, ['task', 'phase', UNIT, '1', '--title', SIDE.REFUSED_TITLE]);

    assert.strictEqual(lastMessage(dir), 'task(pay): write phase 1 refused — what it wrote kept');
    assert.deepStrictEqual(lastFiles(), [layout.gitignore, layout.projectManifest, ...DRIVER.storeFiles()].sort());
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']), '');
    createManifest(dir, 'tax', {});
    commitAll(dir, 'tax');

    refuses(dir, ['task', 'phase', 'tax', '1', '--title', SIDE.REFUSED_TITLE]);

    assert.deepStrictEqual([lastMessage(dir), lastFiles()], ['task(tax): write phase 1 refused — what it wrote kept', DRIVER.storeFiles()], 'set up already committed, the store alone');
  });

  for (const [first, args, message] of /** @type {const} */ ([
    ['a write', ['task', 'phase', UNIT, '1', '--title', 'The ledger'], 'task(pay): write phase 1'],
    ['a read', ['task', 'ready', UNIT], 'task(pay): set up the tracker'],
    ['a refusal', ['task', 'list', UNIT, '3'], 'task(pay): set up the tracker'],
  ])) {
    it(`${first} as the first verb commits the store, the setting and the ignore lines alone, onto the branch's own files, whatever the person's git config shows: another flow's change to either stays uncommitted`, () => {
      stateGit(dir, ['config', 'status.showUntrackedFiles', 'no']);
      ok(dir, ['manifest', 'set', 'project.defaults.plan_format', 'held']);
      commitAll(dir, 'a project manifest without the setting');
      ok(dir, ['manifest', 'set', 'project.defaults.plan_format', 'FOREIGN']);
      fs.appendFileSync(statePath(dir, '.gitignore'), '/scratch-by-hand/\n');

      if (first === 'a refusal') refuses(dir, [...args]);
      else ok(dir, [...args]);

      assert.deepStrictEqual([lastMessage(dir), lastFiles()], [message, [layout.gitignore, layout.projectManifest, ...DRIVER.storeFiles()].sort()]);
      const ignored = stateGit(dir, ['show', 'HEAD:.gitignore']).split('\n');
      assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.projectManifest}`]), fs.readFileSync(statePath(dir, layout.projectManifest), 'utf8').replace('"FOREIGN"', '"held"'), 'the setting placed as the setup writes it');
      assert.deepStrictEqual([DRIVER.localFiles().every((pattern) => ignored.includes(pattern)), ignored.includes('/scratch-by-hand/')], [true, false]);
      assert.deepStrictEqual(stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean).sort(), [' M .gitignore', ' M manifest.json']);
      assert.strictEqual(projectManifest().defaults.plan_format, 'FOREIGN');
    });
  }

  it('a setup commit lost, its files left staged: the next read carries it', () => {
    ok(dir, ['task', 'phase', UNIT, '1', '--title', 'The ledger']);
    stateGit(dir, ['reset', '-q', '--soft', 'HEAD~1']);

    ok(dir, ['task', 'ready', UNIT]);

    assert.deepStrictEqual([lastMessage(dir), lastFiles()], ['task(pay): set up the tracker', [layout.gitignore, layout.projectManifest, ...DRIVER.storeFiles()].sort()]);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']), '');
  });

  it('refuses where the state\'s ignore file is gone, saying how to bring it back, whatever tools are installed, the store not made', () => {
    fs.rmSync(statePath(dir, '.gitignore'));

    const { error } = refuses(dir, ['task', 'ready', UNIT], { env: { PATH: toolless() } });

    assert.strictEqual(error, `the state's .gitignore is gone from ${statePath(dir, '.')} — bring it back as ${STATE_BRANCH} holds it: git -C "${statePath(dir, '.')}" checkout HEAD -- .gitignore`);
    assert.ok(DRIVER.storeFiles().every((file) => !fs.existsSync(statePath(dir, file))), 'no store made');
  });

  it('a setting the branch\'s manifest cannot take, or cannot be read to take, is committed nowhere, the verb warning of it, naming the file and the commit', () => {
    fs.writeFileSync(statePath(dir, layout.projectManifest), '{oops\n');
    commitAll(dir, 'a project manifest that is not JSON');
    const broken = head(dir);
    fs.writeFileSync(statePath(dir, layout.projectManifest), '{}\n');

    const taking = ok(dir, ['task', 'ready', UNIT]).warnings.join('\n');

    assert.match(taking, new RegExp(`^commit failed: manifest\\.json as ${STATE_BRANCH} holds it at ${broken} cannot take the change — nothing committed; commit manifest\\.json mended to go on: `));
    assert.strictEqual(head(dir), broken);
    fs.writeFileSync(statePath(dir, layout.projectManifest), '{"defaults":{"plan_format":"held"}}\n');
    stateGit(dir, ['add', layout.projectManifest]);
    stateGit(dir, ['commit', '-q', '-m', 'a project manifest without the setting']);
    const before = head(dir);
    const object = stateGit(dir, ['rev-parse', `HEAD:${layout.projectManifest}`]).trim();
    fs.rmSync(path.join(dir, '.git', 'objects', object.slice(0, 2), object.slice(2)));

    const { warnings } = ok(dir, ['task', 'ready', UNIT]);

    assert.match(warnings.join('\n'), new RegExp(`^commit failed: manifest\\.json could not be read from ${STATE_BRANCH} at ${before} — nothing committed: `));
    assert.strictEqual(head(dir), before);
  });

  it('a refusal whose commit is not pushed carries the warning in its words, the commit standing', () => {
    git(dir, ['remote', 'add', 'origin', path.join(dir, '..', 'nowhere.git')]);

    const { error } = refuses(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'write', template('Write the ledger'))]);

    assert.match(error, new RegExp(`^phase 1 of pay is not written — and ${STATE_BRANCH} is committed here but was not pushed to origin`));
    assert.strictEqual(lastMessage(dir), 'task(pay): set up the tracker');
  });

  it('no verb reaches the tracker without the writer lock: a read waits on a live holder, the store made only once it is let go, and committed with the setting up (7.5.4)', (t) => {
    const lock = statePath(dir, '.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    /** @type {boolean[]} */
    const storeWhileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      storeWhileHeld.push(DRIVER.storeFiles().some((file) => fs.existsSync(statePath(dir, file))));
      fs.unlinkSync(lock);
    });

    assert.deepStrictEqual(ok(dir, ['task', 'ready', UNIT]), { ok: true, tasks: [], committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });

    assert.deepStrictEqual([attempts, storeWhileHeld], [['taken', 'made'], [false]]);
    assert.deepStrictEqual([lastMessage(dir), lastFiles()], ['task(pay): set up the tracker', [layout.gitignore, layout.projectManifest, ...DRIVER.storeFiles()].sort()]);
  });
});

describe('task phase and task create (7.1.3, 7.4.1, 12.4.1)', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  it('task create: one call per task from its file, numbered next in its phase, the tracker holding its text whole (7.S3)', () => {
    ok(dir, ['task', 'phase', UNIT, '2', '--title', 'The screen']);
    const text = template('Show the ledger', { Type: 'refactor' });

    const res = ok(dir, ['task', 'create', UNIT, '2', '--file', taskFile(dir, 'show', `\n${text}\n\n`)]);

    assert.deepStrictEqual(res, { ok: true, task: '2.1', id: 'pay-2-1', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(lastMessage(dir), 'task(pay): create 2.1');
    assert.deepStrictEqual(lastFiles(), DRIVER.storeFiles());
    assert.strictEqual(create(dir, 'Page the ledger', '2').task, '2.2');
    const shown = ok(dir, ['task', 'show', UNIT, '2.1']);
    assert.deepStrictEqual([shown.title, shown.type, shown.text], ['Show the ledger', 'refactor', text.trim()]);
  });

  it('task create numbers after the phase\'s highest: never a number a closed task or one below the highest held, though the highest, removed in the tracker, is held again', () => {
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Not needed.']);
    assert.strictEqual(create(dir, 'Page the ledger').task, '1.4');

    SIDE.removeTask(statePath(dir), 'Read the ledger');
    assert.strictEqual(create(dir, 'Sort the ledger').task, '1.5');

    SIDE.removeTask(statePath(dir), 'Sort the ledger');
    assert.strictEqual(create(dir, 'Sum the ledger').task, '1.5');
  });

  it('task create refuses a number the tracker already holds, made by hand, naming it, writing nothing', () => {
    SIDE.makeTask(statePath(dir), 'Made by hand', { unit: UNIT, phase: 1, n: 4 });
    commitAll(dir, 'by hand');

    assert.strictEqual(refusesPristine(['task', 'create', UNIT, '1', '--file', taskFile(dir, 'write', template('Page the ledger'))]),
      'the tracker already holds task 1.4 of pay');
  });

  it('refuses a task file the template does not hold, naming every fault; a phase already written or not yet written; a title breaking its line; a unit the project lacks; a task the tracker lacks; and any verb\'s arguments out of shape — writing nothing', () => {
    const file = taskFile(dir, 'write', template('Write the ledger'));
    const blank = taskFile(dir, 'blank', '\n \n');
    const faulty = template('Write the ledger', { Type: 'feature', Outcome: '' }).replace('## Problem', '## Context\nWhy.\n\n## Problem') + '## Problem\nAgain.\n';
    const broken = 'the task file does not hold the task template — the title breaks its line — a title is one line';
    const refusals = [
      [['task', 'create', UNIT, '1', '--file', taskFile(dir, 'faulty', faulty)],
        'the task file does not hold the task template — "Context" is not a field of the task template; Problem is written 2 times; Outcome is empty; the type "feature" is not one of feat, fix, refactor, perf, test, docs, build, ci, chore'],
      [['task', 'create', UNIT, '1', '--file', taskFile(dir, 'untitled', 'Write the ledger\n\n## Type\nfeat\n')],
        'the task file does not hold the task template — no title: the file opens with its "# " heading; no Problem; no Solution; no Outcome; no Acceptance scenarios; no Spec reference'],
      ...['Write\rthe ledger', 'Write\vthe ledger', 'Write\fthe ledger', 'Write the ledger\u2028', 'Write\u2028the ledger', 'Write\u2029the ledger']
        .map((title, i) => [['task', 'create', UNIT, '1', '--file', taskFile(dir, `broken-${i}`, template(title))], broken]),
      [['task', 'phase', UNIT, '1', '--title', 'Again'], 'phase 1 of pay is already written'],
      [['task', 'create', UNIT, '2', '--file', file], 'phase 2 of pay is not written'],
      [['task', 'list', UNIT, '2'], 'phase 2 of pay is not written'],
      [['task', 'ready', UNIT, '2'], 'phase 2 of pay is not written'],
      [['task', 'link', UNIT, '1.9', '--after', '1.1'], 'task 1.9 of pay is not in the tracker'],
      [['task', 'phase', UNIT, '2', '--title', 'The\vscreen'], 'the phase\'s title breaks its line — a title is one line'],
      [['task', 'phase', UNIT, '2', '--title', 'The screen\u2028'], 'the phase\'s title breaks its line — a title is one line'],
      [['task', 'phase', UNIT, '2', '--title', 'The\nscreen'], 'the phase\'s title breaks its line — a title is one line'],
      [['task', 'phase', UNIT, '2', '--title', 'The\u0085screen'], 'the phase\'s title breaks its line — a title is one line'],
      [['task', 'phase', 'billing', '1', '--title', 'The ledger'], 'Work unit "billing" not found'],
      [['task', 'start', 'billing', '1.1'], 'Work unit "billing" not found'],
      [['task', 'done', 'billing', '1.1'], 'Work unit "billing" not found'],
      [['task', 'close', 'billing', '1.1', '--reason', 'Gone.'], 'Work unit "billing" not found'],
      [['task', 'show', UNIT, '1.4'], 'task 1.4 of pay is not in the tracker'],
      [['task', 'phase', UNIT, '0', '--title', 'The ledger'], 'task-id: "0" is not a phase — it is a whole number from 1'],
      [['task', 'start', UNIT, '1-1'], 'task-id: "1-1" is not a task — it is {phase}.{n}'],
      [['task', 'phase', UNIT, '1'], 'Usage: engine task phase <unit> <N> --title <title>'],
      [['task', 'close', UNIT, '1.1', '--reason', ' '], 'Usage: engine task close <unit> <task> --reason <reason>'],
      [['task', 'ready', UNIT, '1', '2'], 'Usage: engine task ready <unit> [<N>]'],
      [['task', 'add', UNIT, '1.2', '--file', file], 'Usage: engine task add <unit> <task> --file <path> --by <orchestrator|person>'],
      [['task', 'add', UNIT, '1.2', '--file', file, '--by', 'builder'], 'an addition is the orchestrator or the person\'s — got "builder"'],
      [['task', 'add', UNIT, '1.2', '--file', blank, '--by', 'person'], `${blank} holds nothing to add`],
      [['task', 'type', UNIT, '1.2', 'feature'], 'the type "feature" is not one of feat, fix, refactor, perf, test, docs, build, ci, chore'],
      [['task', 'link', UNIT, '1.1', '--after', '2.1'], 'task 2.1 is in a later phase than 1.1 — a task is linked after one of its own phase\'s or an earlier phase\'s'],
    ];
    refusePristine(/** @type {[string[], string][]} */ (refusals));
  });
});

describe('task add and task type (13.11.3, 21.5.21)', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  it('task add: an addition onto the task from its file, marked as whose it is, committed', () => {
    const fact = 'The reader moved:\n\n- `ledger/read.go` is now `ledger/scan.go`';

    assert.deepStrictEqual(ok(dir, ['task', 'add', UNIT, '1.2', '--file', taskFile(dir, 'fact', `\n${fact}\n`), '--by', 'orchestrator']), {
      ok: true, task: '1.2', id: 'pay-1-2', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });
    assert.strictEqual(lastMessage(dir), 'task(pay): add to 1.2');
    assert.deepStrictEqual(lastFiles(), DRIVER.storeFiles());
    ok(dir, ['task', 'add', UNIT, '1.2', '--file', taskFile(dir, 'instruction', 'Keep the file format.'), '--by', 'person']);
    assert.deepStrictEqual(ok(dir, ['task', 'show', UNIT, '1.2']).additions, [{ by: 'orchestrator', text: fact }, { by: 'person', text: 'Keep the file format.' }]);
  });

  it('task type: a task not yet ended given another type the template allows, committed', () => {
    assert.deepStrictEqual(ok(dir, ['task', 'type', UNIT, '1.2', 'fix']), {
      ok: true, task: '1.2', id: 'pay-1-2', type: 'fix', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });
    assert.strictEqual(lastMessage(dir), 'task(pay): type 1.2 as fix');
    assert.deepStrictEqual(lastFiles(), DRIVER.storeFiles());
    assert.strictEqual(ok(dir, ['task', 'show', UNIT, '1.2']).type, 'fix');
  });

});

describe('task link, ready, list and show (7.1.5, 12.6.4)', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  it('task link: a task held after one of its own phase or an earlier one, committed', () => {
    ok(dir, ['task', 'phase', UNIT, '2', '--title', 'The screen']);
    create(dir, 'Show the ledger', '2');

    assert.deepStrictEqual(ok(dir, ['task', 'link', UNIT, '2.1', '--after', '1.2']), {
      ok: true, task: '2.1', after: '1.2', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });
    assert.strictEqual(lastMessage(dir), 'task(pay): link 2.1 after 1.2');
    assert.deepStrictEqual(ok(dir, ['task', 'show', UNIT, '2.1']).after, ['1.2']);
  });

  it('the tracker\'s refusal of a cycle reads in the engine\'s names — a task of a person\'s own named as one the workflows did not make — writing nothing', () => {
    const cycle = refusesPristine(['task', 'link', UNIT, '1.1', '--after', '1.3']);
    assert.match(cycle, /\b1\.1\b.*\b1\.3\b|\b1\.3\b.*\b1\.1\b/);
    SIDE.makeTask(statePath(dir), 'Mine');
    SIDE.linkBy(statePath(dir), 'Mine', 'Write the ledger');
    SIDE.linkBy(statePath(dir), 'Read the ledger', 'Mine');
    commitAll(dir, 'by hand');

    const through = refusesPristine(['task', 'link', UNIT, '1.1', '--after', '1.2']);

    assert.match(through, /\b1\.2\b/);
    assert.ok(through.includes(FOREIGN_TASK), through);
  });

  it('the reads answer what the tracker holds, and commit nothing — a store a person changed by hand among it', () => {
    const tip = head(dir);

    assert.deepStrictEqual(ok(dir, ['task', 'ready', UNIT, '1']), {
      ok: true, tasks: [{ task: '1.1', id: 'pay-1-1', title: 'Write the ledger' }, { task: '1.2', id: 'pay-1-2', title: 'Read the ledger' }],
    });
    assert.deepStrictEqual(ok(dir, ['task', 'list', UNIT, '1']).tasks.map((/** @type {any} */ row) => [row.task, row.id, row.status]),
      [['1.1', 'pay-1-1', 'open'], ['1.2', 'pay-1-2', 'open'], ['1.3', 'pay-1-3', 'open']]);
    assert.deepStrictEqual(ok(dir, ['task', 'show', UNIT, '1.3']), {
      ok: true, task: '1.3', id: 'pay-1-3', title: 'Fold the ledger', type: 'feat', status: 'open', text: template('Fold the ledger').trim(), additions: [], after: ['1.1'], reason: null,
    });
    SIDE.makeTask(statePath(dir), 'Mine');
    ok(dir, ['task', 'ready', UNIT]);
    assert.strictEqual(head(dir), tip);
    assert.deepStrictEqual(stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean), DRIVER.storeFiles().map((file) => ` M ${file}`));
  });
});

describe('task start, done and close: the task in flight (6.3.3, 7.1.12)', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  const position = () => readPosition(SESSION_ID);

  it('task start puts the task in flight on the conversation\'s position, the unit its topic, as often as it is run; task done takes it off', () => {
    assert.deepStrictEqual(ok(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION }), {
      ok: true, task: '1.1', id: 'pay-1-1', committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });
    assert.strictEqual(lastMessage(dir), 'task(pay): start 1.1');
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT, task: '1.1' });
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: SESSION });
    const started = head(dir);
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION });
    assert.deepStrictEqual([head(dir), position().task], [started, '1.1'], 'a task already started is put on the position again, nothing written');

    ok(dir, ['task', 'done', UNIT, '1.1'], { env: SESSION });

    assert.strictEqual(lastMessage(dir), 'task(pay): done 1.1');
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT });
    assert.deepStrictEqual(ok(dir, ['task', 'ready', UNIT]).tasks.map((/** @type {any} */ row) => row.task), ['1.3'], '1.2 started, so not waiting');
  });

  it('task close ends the task without it being done, its reason kept, and takes it off the position', () => {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION });

    ok(dir, ['task', 'close', UNIT, '1.1', '--reason', 'The old ledger already writes it.'], { env: SESSION });

    assert.strictEqual(lastMessage(dir), 'task(pay): close 1.1');
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT });
    const closed = ok(dir, ['task', 'show', UNIT, '1.1']);
    assert.deepStrictEqual([closed.status, closed.reason], ['closed', 'The old ledger already writes it.']);
  });
});

describe('a task already ended', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  it('done or closed, takes no addition, no new type, no link of its own or after it, no start, no done and no close, writing nothing', () => {
    ok(dir, ['task', 'done', UNIT, '1.1']);
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);
    const file = taskFile(dir, 'fact', 'The reader moved.');
    const refusals = [
      [['task', 'add', UNIT, '1.1', '--file', file, '--by', 'person'], 'task 1.1 is done — only a task not yet ended is added to'],
      [['task', 'type', UNIT, '1.2', 'fix'], 'task 1.2 is closed — only a task not yet ended is typed'],
      [['task', 'link', UNIT, '1.3', '--after', '1.1'], 'task 1.1 is done — a task is linked after an unfinished one'],
      [['task', 'link', UNIT, '1.1', '--after', '1.3'], 'task 1.1 is done — only a task not yet ended is linked after another'],
      [['task', 'link', UNIT, '1.2', '--after', '1.3'], 'task 1.2 is closed — only a task not yet ended is linked after another'],
      [['task', 'start', UNIT, '1.1'], 'task 1.1 is done — only a task not yet ended is started'],
      [['task', 'start', UNIT, '1.2'], 'task 1.2 is closed — only a task not yet ended is started'],
      [['task', 'done', UNIT, '1.1'], 'task 1.1 is done — only a task not yet ended is done'],
      [['task', 'done', UNIT, '1.2'], 'task 1.2 is closed — only a task not yet ended is done'],
      [['task', 'close', UNIT, '1.1', '--reason', 'Late.'], 'task 1.1 is done — only a task not yet ended is closed'],
      [['task', 'close', UNIT, '1.2', '--reason', 'Again.'], 'task 1.2 is closed — only a task not yet ended is closed'],
    ];
    refusePristine(/** @type {[string[], string][]} */ (refusals));
  });
});

describe('a driver whose tools are not installed', () => {
  beforeEach(() => { dir = inFolder(phasedWorld); });

  it('is refused in the engine\'s words, naming every tool missing and where its updates are, and passing through the error of one that runs and fails, writing nothing', { skip: DRIVER.needs.length === 0 }, () => {
    const bin = toolless();

    const error = refusesPristine(['task', 'ready', UNIT], { PATH: bin });

    assert.strictEqual(error.split(' — ')[0], `the task driver needs ${DRIVER.needs.map((need) => need.tool).join(' and ')}, not installed`);
    for (const need of DRIVER.needs) assert.ok(error.includes(need.update), `names where ${need.tool}'s updates are`);
    for (const need of DRIVER.needs) fs.writeFileSync(path.join(bin, need.tool), '#!/bin/sh\necho "broken here" >&2\nexit 3\n', { mode: 0o755 });

    const broken = refusesPristine(['task', 'ready', UNIT], { PATH: bin });

    assert.ok(broken.includes('broken here') && !broken.includes('not installed'), broken);
  });

  it('leaves a refusal the engine makes in its own words where the driver\'s tools fail as it looks for them, writing nothing', { skip: DRIVER.needs.length === 0 }, () => {
    const looked = DRIVER.needs.map((need) => need.found);
    for (const need of DRIVER.needs) need.found = () => { throw new Error('broken here'); };
    try {
      refusePristine([
        [['task', 'list', UNIT, '9'], 'phase 9 of pay is not written'],
        [['task', 'ready', UNIT, '9'], 'phase 9 of pay is not written'],
        [['task', 'create', UNIT, '9', '--file', taskFile(dir, 'write', template('Write the ledger'))], 'phase 9 of pay is not written'],
        [['task', 'phase', UNIT, '1', '--title', 'Again'], 'phase 1 of pay is already written'],
        [['task', 'show', UNIT, '1.9'], 'task 1.9 of pay is not in the tracker'],
      ]);
    } finally {
      DRIVER.needs.forEach((need, i) => { need.found = looked[i]; });
    }
  });
});
