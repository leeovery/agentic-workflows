'use strict';

// ---------------------------------------------------------------------------
// The brief filled and issued (leeway-engine/scripts/domain/brief.cjs, its
// records domain/brief-records.cjs, the templates content/briefs/): `engine
// brief <role> [<unit> <task>] [--{flag} <value> …]`. Its answer, the id,
// the role, the agent and the pointer; the brief stored in the calling
// conversation's folder under its id, its first line naming it, the
// template's slots filled with each record in its fixed form — the task
// whole, its headings a level down, with each addition under a heading
// saying whose it is, the sections its spec reference cites verbatim, the
// unit's current decisions at its own level, each one list item, the
// linters from the environment — and nothing of the project's CLAUDE.md or
// its skills (6.S15); beside it the record of whose it is; the reviewer's
// brief, the builder's records and, in each repository holding the task's
// branch, the diff's three-dot range and its stat, never its text, from
// the base given or, where a repository lacks it, its default, its template
// saying a wrong comment or a workflows reference in the work is returned
// as a nit (13.S20);
// the fix round's brief, the two reports verbatim under their labels and
// nothing else (6.S17); the product researcher's brief in a project with no
// unit; the fill under the writer lock; every refusal writing nothing, no
// brief and no record among it; a template's slots held to its role; a
// brief and its record never stored over another's.
//
// Layer: verb. World: a project with two work units, built once and copied:
// one with its first phase written in the tracker, its tasks made through
// the default driver — a task with two additions and a spec reference over
// two lines, a task done, a task closed, a task citing a section its spec
// lacks — its spec, decisions at its level, one over several lines, and on
// its topic, two reviewers' reports on its first task in its build folder,
// and that task's branch in the project's repository and in one nested in
// it, the project's default branch moved on past it; the other with its
// spec, a task whose branch holds work in the project's repository alone
// and is named in the nested one, and no decision; the project's linters, and
// a CLAUDE.md and a project skill in the code tree. And a project with no
// unit, from the fixture library.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, commitCode, git, initRepo, stateGit, lastMessage, fixtureFrom, cleanupFixture, lockAttempts, holdLock,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { templateOf, storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));
const { OURS, ROLES, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { readTaskText } = require(path.join(SCRIPTS, 'domain/task-file.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');

const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);
const UNIT = 'pay';
const SESSION_ID = 'brief-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const AT_UNIT = `${UNIT}.specification`;
const MADE = Object.freeze({ who_moved_whom: 'none' });
const LINTERS = Object.freeze([{ name: 'eslint', command: 'npx eslint .' }, { name: 'tsc', command: 'npx tsc --noEmit' }]);
const PROJECT_WORDS = 'Always answer in French.';

/** The unit's spec: two areas, the first with two parts, a heading in a fence. */
const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', 'A card is taken once.', '',
  '### 1.1 The form', '', 'The form asks for the number.', '', '```sh', '## 2. Not an area', 'pay --dry-run', '```', '',
  '### 1.2 The receipt', '', 'A receipt follows every charge.', '',
  '## 2. Refunds', '', 'A refund names its charge.', '',
].join('\n');
const FORM = ['### 1.1 The form', '', 'The form asks for the number.', '', '```sh', '## 2. Not an area', 'pay --dry-run', '```'].join('\n');
const REFUNDS = ['## 2. Refunds', '', 'A refund names its charge.'].join('\n');

/** The task branches the world holds, and the folder of the repository nested in the project. */
const PAY_BRANCH = taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'feat', 'Take a card');
const REFUND_BRANCH = taskBranch({ unit: 'refund', phase: 1, n: 1 }, 'feat', 'Refund');
const NESTED = 'lib';
/** The refund task's file: a path past the 80 columns git fits a stat to off a terminal. */
const DEEP = 'packages/payments-service/src/components/checkout/refund-form/validation/refund-amount-validator.test.ts';
/** The line each task branch adds, which no brief carries. */
const CHANGED = 'export const token = (card) => card.token;';

/** The two reviewers' reports on task 1.1 in the unit's build folder, their whitespace and line breaks their own. */
const REPORTS = Object.freeze({
  'report-a': {
    at: layout.unit(UNIT, 'build/tasks/1.1/round-1-a.md'),
    text: '\n## Verdict\n\nFail.  \n\n## Findings\n\n1. card.js keeps the token   in plain text,\n   which the spec forbids.\n\n```js\n    keep(token);\n```\n\n',
  },
  'report-b': {
    at: layout.unit(UNIT, 'build/tasks/1.1/round-1-b.md'),
    text: 'Verdict: fail\r\n\n- The receipt omits the amount.\n- Nit: a comment in card.js names task 1.1.\n',
  },
});

/** One file added in the repository at `repo`, committed alone on the branch checked out. @param {string} repo @param {string} file */
function commitFile(repo, file) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), `${CHANGED}\n`);
  git(repo, ['add', file]);
  git(repo, ['commit', '-q', '-m', `add ${file}`]);
}

/**
 * A task's branch cut from `main` in the repository at `repo`, adding one
 * file; its checkout left on `main`.
 * @param {string} repo @param {string} branch @param {string} file
 */
function branchWith(repo, branch, file) {
  git(repo, ['checkout', '-q', '-b', branch]);
  commitFile(repo, file);
  git(repo, ['checkout', '-q', 'main']);
}

/** A task file's text, its spec reference as given. @param {string} title @param {string} reference */
function taskText(title, reference) {
  return [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a card, when ${title.toLowerCase()} runs, then it answers.`, '',
    '## Spec reference', reference,
  ].join('\n');
}

/** A file beside the project, its path. @param {string} dir @param {string} name @param {string} text */
function besideFile(dir, name, text) {
  const file = path.join(dir, '..', name);
  fs.writeFileSync(file, text);
  return file;
}

/** One write that must succeed: its response. @param {string} dir @param {string[]} args @param {object} [content] */
const write = (dir, args, content) => ok(dir, args, { env: SESSION, stdin: content === undefined ? '' : JSON.stringify(content) });

/** A decision answering a question asked at `address`: its short id. @param {string} dir @param {string} address @param {object} decision */
function decided(dir, address, decision) {
  const question = write(dir, ['ledger', 'ask', address], { by: 'claude', ...MADE, text: 'What is asked?' }).id;
  return write(dir, ['ledger', 'decide', address, '--answers', question], { ...MADE, ...decision }).id;
}

/** What the world's decisions are, by name, as their short ids. @type {Record<string, string>} */
const calls = {};

/** Task 1.1's spec reference: an area and a part, over two lines. */
const TAKE_A_CARD = 'Refunds, §2;\nthe form, §1.1';

/**
 * The unit: its spec, its linters, a CLAUDE.md and a project skill; its
 * first phase written — 1.1 citing an area and a part with two additions,
 * 1.2 done, 1.3 closed, 1.4 citing a section the spec lacks; Claude's
 * decision over several lines and the person's at its own level, one
 * replaced, and one on its topic; two reports on 1.1 in its build folder,
 * and 1.1's branch in the project's repository and in `lib`, nested in it,
 * the project's `main` moved on past both task branches. Beside it a second
 * unit, `refund`, with its spec and a task, whose branch holds work in the
 * project's repository alone — `lib` names it at its `main`, as a task's
 * worktree makes it in every child — and no decision.
 */
const unitWorld = fixtureFrom('brief-', (dir) => {
  createManifest(dir, UNIT, { phases: { discussion: { items: { [UNIT]: { status: 'in-progress' } } } } });
  writeState(dir, layout.unit(UNIT, SPEC_FILE), SPEC);
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS } }, null, 2));
  for (const { at, text } of Object.values(REPORTS)) writeState(dir, at, text);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `# Rules\n\n${PROJECT_WORDS}\n`);
  fs.writeFileSync(path.join(dir, '.gitignore'), `${NESTED}/\n`);
  fs.mkdirSync(path.join(dir, '.claude', 'skills', 'x'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'skills', 'x', 'SKILL.md'), '---\nname: x\n---\n\nPrefer tabs.\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const root = statePath(dir);
  const task = (/** @type {number} */ n) => ({ unit: UNIT, phase: 1, n });
  [['Take a card', TAKE_A_CARD], ['Show a receipt', '§1.2'], ['Store a card', '§1'], ['Send a refund', '§2, §7.1']].forEach(([title, reference], i) => {
    DRIVER.createTask(root, task(i + 1), readTaskText(taskText(title, reference)));
  });
  DRIVER.add(root, task(1), { by: 'orchestrator', text: 'The form moved to checkout/.' });
  DRIVER.add(root, task(1), { by: 'person', text: 'Keep the old endpoint.' });
  DRIVER.done(root, task(2));
  DRIVER.close(root, task(3), 'folded into 1.1');
  createManifest(dir, 'refund', {});
  writeState(dir, layout.unit('refund', SPEC_FILE), SPEC);
  DRIVER.createUnit(root, 'refund');
  DRIVER.createPhase(root, 'refund', 1, 'Refunds');
  DRIVER.createTask(root, { unit: 'refund', phase: 1, n: 1 }, readTaskText(taskText('Refund', '§2')));
  commitAll(dir, 'the first phase written');
  branchWith(dir, PAY_BRANCH, 'src/card.js');
  branchWith(dir, REFUND_BRANCH, DEEP);
  commitFile(dir, 'src/main.js');
  const nested = initRepo(path.join(dir, NESTED));
  fs.writeFileSync(path.join(nested, 'README.md'), 'The card library.\n');
  commitCode(nested, 'init');
  branchWith(nested, PAY_BRANCH, 'card/token.js');
  git(nested, ['branch', REFUND_BRANCH]);
  calls.claude = decided(dir, AT_UNIT, { by: 'claude', text: 'A card is tokenised.\nIts number is never kept.', why: 'No card number is kept.\nThe audit stays small.' });
  const old = decided(dir, AT_UNIT, { by: 'person', text: 'Refunds by hand.', why: 'They are rare.' });
  calls.person = write(dir, ['ledger', 'replace', AT_UNIT, '--replaces', old, '--reason', 'changed-mind'], {
    by: 'person', ...MADE, text: 'Refunds through the API.', why: 'They come weekly now.', drops: ['refunds by hand'],
  }).id;
  calls.topic = decided(dir, `${UNIT}.discussion.${UNIT}`, { by: 'person', text: 'Cards only.', why: 'Wallets later.' });
});

/** @type {string} */
let dir;

/**
 * Each test of the calling `describe` in a copy of `world`, in a folder of
 * its own beside which files are written; the folder and the conversation's
 * briefs removed after it.
 * @param {(at: string) => string} world
 */
function useWorld(world) {
  beforeEach(() => {
    dir = world(path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brief-'))), 'project'));
  });
  afterEach(() => {
    cleanupFixture(path.dirname(dir));
    fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  });
}

/** The files the conversation's briefs folder holds, by name. */
const stored = () => {
  const folder = path.dirname(briefPath(SESSION_ID, 'x'));
  return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
};

/** A brief issued: its response, and the brief as stored. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

/** A role's template as shipped, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8').split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** Task 1.1's records as a brief draws them: the task with its additions, its sections, the unit's decisions, the linters. */
function drawnForTakeACard() {
  const task = [
    taskText('Take a card', TAKE_A_CARD).replace(/^#/gm, '##'), '## Added by the orchestrator', 'The form moved to checkout/.', '## Added by the person', 'Keep the old endpoint.',
  ].join('\n\n');
  const decisions = [
    `- ${calls.claude}, Claude's: A card is tokenised.\n  Its number is never kept.\n  Why: No card number is kept.\n  The audit stays small.`,
    `- ${calls.person}, the person's: Refunds through the API.\n  Why: They come weekly now.`,
  ].join('\n');
  return { task, 'spec-sections': `${REFUNDS}\n\n${FORM}`, 'decided-calls': decisions, linters: '- eslint: npx eslint .\n- tsc: npx tsc --noEmit' };
}

/**
 * The range drawn for a repository holding a task's branch, its one file added.
 * @param {string} where @param {string} branch @param {string} file @param {string} [base]
 */
const rangeDrawn = (where, branch, file, base = 'main') => `## In ${where}: \`${base}...${branch}\`\n\n\`\`\`\n ${file} | 1 +\n 1 file changed, 1 insertion(+)\n\`\`\``;

/** The project's and `lib`'s ranges for task 1.1, from the bases given. @param {string} own @param {string} nested */
const takeACardRanges = (own, nested) => [
  rangeDrawn('the project\'s repository', PAY_BRANCH, 'src/card.js', own), rangeDrawn(`\`${NESTED}\``, PAY_BRANCH, 'card/token.js', nested),
].join('\n\n');

/** The fix round's brief's labels: everything it holds beside the reports, under its first line. */
const LABELS = Object.freeze({ 'report-a': '# Reviewer A\'s report\n\n', 'report-b': '\n\n# Reviewer B\'s report\n\n' });

/** The fix round's arguments for task 1.1, each report by its path, the second relative to the project. */
const fixArgs = () => [
  'fix', UNIT, '1.1', '--report-a', statePath(dir, REPORTS['report-a'].at), '--report-b', path.relative(dir, statePath(dir, REPORTS['report-b'].at)),
];

/** A refusal leaving the state as it was and no brief stored: its error. @param {string[]} args @param {RegExp} pattern @param {Record<string, string|undefined>} [env] */
function refusedUnissued(args, pattern, env = SESSION) {
  const { error } = refusedPristine(dir, ['brief', ...args], { env });
  assert.match(error, pattern);
  assert.deepStrictEqual(stored(), []);
}

describe('the builder\'s brief (6.5.1–6.5.5, 6.S15)', () => {
  useWorld(unitWorld);

  it('6.S15: an id answered with the agent and the pointer, the brief stored under it — named on its first line, the task whole with its additions marked, its sections verbatim, the unit\'s current decisions, the linters — and no word of CLAUDE.md or a skill', () => {
    const { res, brief } = issued(['builder', UNIT, '1.1']);

    assert.match(res.id, /^[0-9A-Za-z]{21}$/);
    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'builder', agent: 'leeway-builder', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the builder's, for pay task 1.1\n\n${filledTemplate('builder', drawnForTakeACard())}`);
    assert.ok(!brief.includes(PROJECT_WORDS) && !brief.includes('Prefer tabs.'), 'nothing of CLAUDE.md or a skill reaches the brief');
    assert.deepStrictEqual(stored(), [`${res.id}.json`, `${res.id}.md`]);
  });

  it('beside the brief, a record of whose it is: its role, its agent, its unit, its task, and no topic', () => {
    const { res } = issued(['builder', UNIT, '1.1']);

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'builder', agent: 'leeway-builder', unit: UNIT, task: '1.1', topic: null });
  });

  it('a project with no linters and a unit with no decision of its own draw each as none recorded', () => {
    const project = JSON.parse(readState(dir, layout.projectManifest));
    delete project.environment;
    writeState(dir, layout.projectManifest, JSON.stringify(project));

    const { brief } = issued(['builder', 'refund', '1.1']);

    assert.ok(brief.includes('# The decided calls\n\nNone recorded.\n\n# The linters\n\nNone recorded.\n'), brief);
  });

  it('where reading the task sets the tracker up, the set-up is committed and the commit rides the answer', () => {
    const { drivers, ...project } = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
    commitAll(dir, 'the driver\'s setting gone');

    const { res } = issued(['builder', UNIT, '1.1']);

    assert.deepStrictEqual([res.committed, lastMessage(dir)], [stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), 'task(pay): set up the tracker']);
    assert.deepStrictEqual(JSON.parse(readState(dir, layout.projectManifest)).drivers, drivers);
  });

  it('every brief issued is stored under an id of its own, the pointer naming it', () => {
    const first = issued(['builder', UNIT, '1.1']).res;
    const second = issued(['builder', UNIT, '1.1']).res;

    assert.notStrictEqual(first.id, second.id);
    assert.deepStrictEqual(stored().sort(), [`${first.id}.json`, `${first.id}.md`, `${second.id}.json`, `${second.id}.md`].sort());
  });

  it('the fill runs under the writer lock: a live holder keeps the brief unstored until it lets go', (t) => {
    const lock = holdLock(statePath(dir, '.lock'));
    /** @type {string[][]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(stored());
      fs.unlinkSync(lock);
    });

    const { res } = issued(['builder', UNIT, '1.1']);

    assert.deepStrictEqual([attempts, whileHeld, stored()], [['taken', 'made'], [[]], [`${res.id}.json`, `${res.id}.md`]]);
  });

  it('the builder\'s template carries the stance on a failed review (13.5.7) and keeps the workflows\' references out of the product (13.11.14)', () => {
    const template = fs.readFileSync(path.join(TEMPLATES, 'builder.md'), 'utf8');

    for (const line of [
      'A failed review is met as a senior engineer would, between two extremes, taking neither',
      'The starting point is that the work stands',
      'Weigh each finding professionally: its cause, whether it is the symptom of a deeper fault',
      'before it lands check the edge cases around it and whether it disturbs the design',
      'A gap you find beyond the task goes to the notes for later or through the ask rule',
      'The reviewer reviews the task as a professional would, never one small thing.',
      'The workflows\' own references never go into the product\'s code or comments: task ids, phase numbers and spec sections.',
    ]) assert.ok(template.includes(line), line);
  });
});

describe('the reviewer\'s brief (13.2.2, 13.11.5)', () => {
  useWorld(unitWorld);

  it('a task whose branch is in two repositories: the builder\'s records, the task\'s additions among them, then the range and its stat in each, the project\'s own first — and no line of the diff', () => {
    const { res, brief } = issued(['reviewer', UNIT, '1.1', '--base', 'main']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'reviewer', agent: 'leeway-reviewer', pointer: `brief:${res.id}` });
    const ranges = takeACardRanges('main', 'main');
    assert.strictEqual(brief, `Brief ${res.id} — the reviewer's, for pay task 1.1\n\n${filledTemplate('reviewer', { ...drawnForTakeACard(), 'diff-range': ranges })}`);
    assert.ok(!brief.includes(CHANGED), 'the diff\'s text reaches no brief');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'reviewer', agent: 'leeway-reviewer', unit: UNIT, task: '1.1', topic: null });
  });

  it('a task whose branch holds work in the project\'s repository alone: its range there, a path past 80 columns drawn whole, and none in a repository naming the branch with nothing on it', () => {
    const { brief } = issued(['reviewer', 'refund', '1.1', '--base', 'main']);

    assert.ok(brief.includes(`# The diff's range\n\n${rangeDrawn('the project\'s repository', REFUND_BRANCH, DEEP)}\n\n# The linters\n`), brief);
  });

  it('a base a repository lacks is its own default branch there: a stack\'s base in the project\'s repository alone, and a nested repository whose default is master', () => {
    git(dir, ['branch', 'pay-stack', 'main']);
    const stacked = issued(['reviewer', UNIT, '1.1', '--base', 'pay-stack']).brief;
    git(path.join(dir, NESTED), ['branch', '-m', 'main', 'master']);
    const master = issued(['reviewer', UNIT, '1.1', '--base', 'main']).brief;

    assert.ok(stacked.includes(`# The diff's range\n\n${takeACardRanges('pay-stack', 'main')}\n\n`), stacked);
    assert.ok(master.includes(`# The diff's range\n\n${takeACardRanges('main', 'master')}\n\n`), master);
  });

  it('a range with nothing in it says so', () => {
    const { brief } = issued(['reviewer', 'refund', '1.1', '--base', REFUND_BRANCH]);

    assert.ok(brief.includes(`# The diff's range\n\n## In the project's repository: \`${REFUND_BRANCH}...${REFUND_BRANCH}\`\n\nNothing changed in the range.\n\n# The linters\n`), brief);
  });

  it('13.S20: the template carries the stance on a failed review (13.5.7), a call on every finding, when it is serious, with the edge list, and what a nit is (13.4.1, 13.4.5, 13.6), judges against the brief and the design, never the comments (13.9.1), returns a wrong comment as a nit (13.9.3), and a workflows reference in the work too (13.11.14)', () => {
    const template = fs.readFileSync(path.join(TEMPLATES, 'reviewer.md'), 'utf8');

    assert.match(template, /\nThe edge list:\n\n(- [^\n]+;\n){4,}- [^\n]+\.\n/, 'the edge list, an item a line');
    for (const line of [
      'Every finding you report carries a user scenario and a call: serious, a real bug that is not serious, or a nit.',
      'A finding is serious unless its scenario needs an item from the edge list and the report names that item.',
      'A scenario built only from ordinary use is serious, however many of its parts combine.',
      'A nit is mechanical with no ripple: a comment, a name, a test\'s wording.',
      'A failed review is met as a senior engineer would, between two extremes, taking neither',
      'The starting point is that the work stands',
      'The builder weighs each finding professionally: its cause, whether it is the symptom of a deeper fault',
      'before it lands the builder checks the edge cases around it and whether it disturbs the design',
      'A gap the builder finds beyond the task goes to the notes for later or through the ask rule',
      'Review the task as a professional would, never one small thing.',
      'Judge the code against this brief and the design, never against its comments.',
      'A wrong comment is not a finding and starts no review: point it out as a nit.',
      'The workflows\' own references never go into the product\'s code or comments: task ids, phase numbers and spec sections. Meeting one in the work, return it as a nit.',
    ]) assert.ok(template.includes(line), line);
  });
});

describe('6.S17: the fix round\'s brief (6.5.10, 13.11.6)', () => {
  useWorld(unitWorld);

  it('the pair\'s two reports, each under its label, verbatim and nothing else: less its labels, the brief under its first line is the two files byte for byte; it is the builder\'s to take', () => {
    const { res, brief } = issued(fixArgs());

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'fix', agent: 'leeway-builder', pointer: `brief:${res.id}` });
    const [a, b] = ['report-a', 'report-b'].map((flag) => REPORTS[flag].text);
    assert.strictEqual(brief,`Brief ${res.id} — the fix round's, for pay task 1.1\n\n${LABELS['report-a']}${a}${LABELS['report-b']}${b}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'fix', agent: 'leeway-builder', unit: UNIT, task: '1.1', topic: null });
  });

  it('a report whose name starts with two dots is in the build folder', () => {
    const draft = statePath(dir, layout.unit(UNIT, 'build/..draft.md'));
    fs.writeFileSync(draft, 'Verdict: pass\n');
    const [, , , ...reports] = fixArgs();

    const { brief } = issued(['fix', UNIT, '1.1', '--report-a', draft, ...reports.slice(2)]);

    assert.ok(brief.includes(`${LABELS['report-a']}Verdict: pass\n${LABELS['report-b']}`), brief);
  });
});

describe('the product researcher\'s brief', () => {
  useWorld(fixtureFrom('brief-bare-', () => {}));

  it('issued in a project with no unit: the template whole under its first line', () => {
    const { res, brief } = issued(['product-researcher']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'product-researcher', agent: 'leeway-product-researcher', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the product researcher's\n\n${filledTemplate('product-researcher', {})}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'product-researcher', agent: 'leeway-product-researcher', unit: null, task: null, topic: null });
  });
});

describe('the refusals, nothing written and no brief stored', () => {
  useWorld(unitWorld);

  it('no session id', () => {
    refusedUnissued(['builder', UNIT, '1.1'], /^brief: no conversation to issue it in/, {});
  });

  it('a role it does not know, and arguments of another shape for each role: a flag it takes missing, given twice or given no value', () => {
    const usage = new RegExp(`^Usage: ${[
      'builder <unit> <task>', 'reviewer <unit> <task> --base <branch>', 'fix <unit> <task> --report-a <path> --report-b <path>', 'product-researcher',
      'deep-dive <unit> <topic> --question <id> --agent <id>', 'perspective <unit> <topic> --question <id> --agent <id>',
      'synthesis <unit> <topic> --question <id> --agent <id>', 'discussion-reviewer <unit> <topic> --agent <id>',
      'closing-pass-reader <unit> <topic> --agent <id>', 'plain-search <unit> <topic> --question <id>',
    ].map((line) => `engine brief ${line}`).join(' \\| ')}$`);
    const [, , , ...reports] = fixArgs();
    for (const args of [
      [], ['scribe', UNIT, '1.1'], ['builder'], ['builder', UNIT], ['builder', UNIT, '1.1', 'more'], ['product-researcher', UNIT],
      ['reviewer', UNIT, '1.1'], ['reviewer', UNIT, '1.1', '--base'], ['reviewer', UNIT, '1.1', '--base', 'main', '--base', 'main'], ['reviewer', UNIT, '--base', 'main'],
      ['fix', UNIT, '1.1', ...reports.slice(0, 2)], ['fix', UNIT, '1.1', '--report-a', '--report-b', reports[3]],
    ]) {
      refusedUnissued(args, /^Usage: /);
    }
    assert.match(refusedPristine(dir, ['brief'], { env: SESSION }).error, usage);
  });

  it('every role refuses a flag it does not take — another role\'s among them — so no free text reaches a brief (6.5.6)', () => {
    /** @type {Record<string, string[]>} */
    const asked = [UNIT, UNIT, '--question', 'Q1234567'];
    const dispatched = [UNIT, UNIT, '--agent', 'review-001'];
    const taking = {
      builder: [UNIT, '1.1'],
      reviewer: [UNIT, '1.1', '--base', 'main'],
      fix: fixArgs().slice(1),
      'product-researcher': [],
      'deep-dive': [...asked, ...dispatched.slice(2)],
      perspective: [...asked, ...dispatched.slice(2)],
      synthesis: [...asked, ...dispatched.slice(2)],
      'discussion-reviewer': dispatched,
      'closing-pass-reader': dispatched,
      'plain-search': asked,
    };
    for (const role of Object.keys(ROLES)) {
      for (const [flag, value] of [['--note', 'be quick'], ...(role === 'reviewer' ? [] : [['--base', 'main']]), ...(role === 'fix' ? [] : [['--report-a', 'a.md']])]) {
        refusedUnissued([role, ...taking[role], flag, value], new RegExp(`^brief: the ${role}'s brief takes no ${flag} `));
      }
    }
    refusedUnissued(['builder', UNIT, '1.1', '--note=be quick'], /^brief: the builder's brief takes no --note /);
    refusedUnissued(['reviewer', UNIT, '1.1', '--base=main'], /^brief: --base takes its value after a space, `--base <branch>`$/);
  });

  it('a reviewer\'s base no repository holding the task\'s branch has as a local branch, and a task whose branch no repository holds', () => {
    const holding = `task 1\\.1 of pay's branch, ${PAY_BRANCH}`;
    refusedUnissued(['reviewer', UNIT, '1.1', '--base', 'trunk'], new RegExp(`^the base trunk is no local branch in any repository holding ${holding}$`));
    git(dir, ['branch', '-D', REFUND_BRANCH]);
    refusedUnissued(['reviewer', 'refund', '1.1', '--base', 'main'], new RegExp(`^no repository of the project holds work on task 1\\.1 of refund's branch, ${REFUND_BRANCH}$`));
  });

  it('a fix round\'s report missing, empty, or outside the unit\'s build folder', () => {
    const [, , , ...reports] = fixArgs();
    const fix = (/** @type {string} */ a) => ['fix', UNIT, '1.1', '--report-a', a, ...reports.slice(2)];
    const build = statePath(dir, layout.unit(UNIT, 'build'));
    fs.writeFileSync(path.join(build, 'blank.md'), '\n  \n');

    refusedUnissued(fix(path.join(build, 'tasks/1.1/round-2-a.md')), /^the --report-a report, .*round-2-a\.md, is no file$/);
    refusedUnissued(fix(path.join(build, 'tasks')), /^the --report-a report, .*tasks, is no file$/);
    refusedUnissued(fix(path.join(build, 'blank.md')), /^the --report-a report, .*blank\.md, is empty$/);
    for (const outside of [statePath(dir, layout.unit(UNIT, SPEC_FILE)), path.join(build, '..', '..', 'refund', 'build', 'round-1-a.md'), build]) {
      refusedUnissued(fix(outside), /^the --report-a report, .*, is not in pay's build folder, /);
    }
  });

  it('a unit or a task the project lacks', () => {
    refusedUnissued(['builder', 'nope', '1.1'], /^Work unit "nope" not found$/);
    refusedUnissued(['builder', UNIT, '1.9'], /^task 1\.9 of pay is not in the tracker$/);
    refusedUnissued(['builder', UNIT, 'one'], /^task-id: "one" is not a task/);
  });

  it('a task done or closed', () => {
    refusedUnissued(['builder', UNIT, '1.2'], /^brief: task 1\.2 of pay is done — a brief is issued for a task not yet ended$/);
    refusedUnissued(['builder', UNIT, '1.3'], /^brief: task 1\.3 of pay is closed — a brief is issued for a task not yet ended$/);
  });

  it('a spec reference citing a section the spec lacks, or none', () => {
    refusedUnissued(['builder', UNIT, '1.4'], /^the spec reference "§2, §7\.1" cites §7\.1, which the spec lacks$/);
    ok(dir, ['task', 'create', UNIT, '1', '--file', besideFile(dir, 'none.md', taskText('Uncited', 'the card form'))]);
    refusedUnissued(['builder', UNIT, '1.5'], /^the spec reference "the card form" cites no section/);
  });

  it('a unit with no spec', () => {
    fs.unlinkSync(statePath(dir, layout.unit(UNIT, SPEC_FILE)));
    refusedUnissued(['builder', UNIT, '1.1'], /^pay has no spec — its folder holds no spec\.md$/);
  });

  it('linters on the project manifest of another shape', () => {
    const project = JSON.parse(readState(dir, layout.projectManifest));
    for (const environment of [{ linters: [{ name: 'eslint' }] }, { linters: 'eslint' }, 'eslint']) {
      writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment }));
      refusedUnissued(['builder', UNIT, '1.1'], /^the project manifest's environment\.linters is not a list of \{name, command\}$/);
    }
  });
});

describe('the templates and the store', () => {
  afterEach(() => {
    fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  });

  it('every role is dispatched as an agent named as the workflows\' are, so the hook stands before each', () => {
    assert.strictEqual(OURS, 'leeway-');
    for (const [role, { agent }] of Object.entries(ROLES)) assert.ok(agent.startsWith(OURS) && agent.length > OURS.length, `${role}: ${agent}`);
  });

  it('a template is refused for a slot not alone on its line, one no record answers, one its role does not draw on, and a record\'s slot missing or twice', () => {
    const builder = '{{task}}\n{{spec-sections}}\n{{decided-calls}}\n{{linters}}\n';
    assert.strictEqual(templateOf('builder', builder), builder);
    assert.throws(() => templateOf('builder', `${builder}See {{task}} above.\n`), /"See \{\{task\}\} above\." holds a slot that is not alone on its line; task's slot is there 2 times$/);
    assert.throws(() => templateOf('builder', `${builder}{{diff}}\n`), /the builder's template is refused — \{\{diff\}\} is no record$/);
    assert.throws(() => templateOf('product-researcher', '{{linters}}\n'), /the product-researcher's brief draws on no linters$/);
    assert.throws(() => templateOf('builder', '{{task}}\n{{spec-sections}}\n{{linters}}\n'), /— no slot for decided-calls$/);
  });

  it('a brief and its record are never stored over another\'s', () => {
    const first = { role: 'builder', agent: 'leeway-builder', unit: UNIT, task: '1.1', topic: null };
    storeBrief(SESSION_ID, 'held', 'Brief held — the first\n', first);

    assert.throws(() => storeBrief(SESSION_ID, 'held', 'Brief held — the second\n', { ...first, task: '1.2' }), /^Error: brief: .*held\.json is stored already$/);
    const read = (/** @type {string} */ file) => fs.readFileSync(file, 'utf8');
    assert.deepStrictEqual([read(briefPath(SESSION_ID, 'held')), JSON.parse(read(issuedPath(SESSION_ID, 'held'))), stored()], ['Brief held — the first\n', first, ['held.json', 'held.md']]);
  });
});
