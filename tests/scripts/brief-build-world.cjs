'use strict';

// ---------------------------------------------------------------------------
// The build briefs' suites' world and helpers (test-engine-brief-build.cjs,
// test-engine-brief-build-review.cjs, test-engine-brief-build-rounds.cjs,
// test-engine-brief-build-changes.cjs, test-engine-brief-build-ways.cjs,
// test-engine-brief-build-chain.cjs): a project, built once per process and
// copied for each test, with a unit past ready to build — its spec of two
// areas, its cut of three phases, the first two written in the tracker
// through the default driver, phase 1's tasks done, in progress, closed and
// not started, one added to; notes for later, one held for phase 3;
// decisions at the spec and in the build, one replacing a spec decision a
// finding relies on; the branches of phase 1's tasks stacked in the
// project's repository, each commit naming its task — the closed one's
// beside the stack — and the first in a repository nested in it, phase 2's
// in the project's; runs of the scenarios at the tasks' branches; the
// project's linters, and its verify setup, its mutation tool answering what
// each test steers it to — beside it a unit whose build has not begun.
// ---------------------------------------------------------------------------

const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refuses, refusedPristine, statePath, layout, writeState, readState, commitAll, commitCode, git, initRepo, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest, templateFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ENGINE_RUN } = require(path.join(SCRIPTS, 'kernel/call.cjs'));
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { readTaskText } = require(path.join(SCRIPTS, 'domain/task-file.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { readConsolidation } = require(path.join(SCRIPTS, 'domain/notes.cjs'));
const { runsRel } = require(path.join(SCRIPTS, 'domain/runs.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');
const AGENTS = path.join(__dirname, '../../agents');

const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);
const UNIT = 'pay';
const SESSION_ID = 'brief-build-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ who_moved_whom: 'none' });
const LINTERS = Object.freeze([{ name: 'eslint', command: 'npx eslint .' }]);
const NESTED = 'lib';

/** The unit's spec: two areas, each part a statement, each area its scenarios. */
const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 A card is taken once. [builder: call-1]', '',
  '### 1.2 The receipt', '', '1.2.1 A receipt follows every charge. [builder: call-1]', '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when the number is typed, then it is checked. (1.1.1)', '',
  '1.S2 Given a charge, when it lands, then a receipt follows. (1.2.1)', '',
  '## 2. Refunds', '', '### 2.1 The charge', '', '2.1.1 A refund names its charge. [builder: call-1]', '',
  '## 2-S. Scenarios for §2', '', '2.S1 Given a charge, when it is refunded whole, then the card is credited. (2.1.1)', '',
  '2.S2 Given a refund, when it lands, then a receipt follows. (2.1.1)', '',
].join('\n');
const AREA_1 = SPEC.slice(SPEC.indexOf('## 1. Cards'), SPEC.indexOf('\n\n## 1-S.'));
const AREA_2 = SPEC.slice(SPEC.indexOf('## 2. Refunds'), SPEC.indexOf('\n\n## 2-S.'));
const PART_1_2 = ['### 1.2 The receipt', '', '1.2.1 A receipt follows every charge. [builder: call-1]'].join('\n');
const PART_2_1 = ['### 2.1 The charge', '', '2.1.1 A refund names its charge. [builder: call-1]'].join('\n');

/** The unit's cut: three phases, the second relying on the first and another unit, the third on the second. */
const CUT = Object.freeze({
  phases: [
    { name: 'Cards', goal: 'A customer pays by card.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'A customer is refunded.', scenarios: ['2.S1'], sections: ['2', '2.1'], relies_on: [1, 'ledger'] },
    { name: 'Refund receipts', goal: 'A refund gets its receipt.', scenarios: ['2.S2'], sections: ['2.1', '1.2'], relies_on: [2] },
  ],
});

/** A task file's text. @param {string} title @param {string} reference */
function taskText(title, reference) {
  return [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a card, when ${title.toLowerCase()} runs, then it answers.`, '',
    '## Spec reference', reference,
  ].join('\n');
}

/** Phase 1's tasks, and phase 2's, as the world makes them. */
const TASKS = Object.freeze({
  1: [['Take a card', '§1.1'], ['Show a receipt', '§1.2'], ['Store a card', '§1.1'], ['Check the number', '§1.1']],
  2: [['Refund a charge', '§2.1']],
});

/** A task's branch, as the landing names it. @param {number} phase @param {number} n */
const branchOf = (phase, n) => taskBranch({ unit: UNIT, phase, n }, 'feat', TASKS[/** @type {1|2} */ (phase)][n - 1][0]);

/**
 * One file added in the repository at `repo`, committed on the branch checked out, for the task `trailer` names.
 * @param {string} repo @param {string} file @param {string} [trailer]
 */
function commitFile(repo, file, trailer) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), `export const ${path.basename(file, '.js')} = 1;\n`);
  git(repo, ['add', file]);
  git(repo, ['commit', '-q', '-m', `add ${file}${trailer === undefined ? '' : `\n\nLeeway-Task: ${trailer}`}`]);
}

/**
 * Task `phase`.`n`'s branch cut from `from` in the repository at `repo`, adding one file in a commit for the task; its checkout back on `main`.
 * @param {string} repo @param {[number, number]} task @param {string} from @param {string} file
 */
function branchWith(repo, [phase, n], from, file) {
  git(repo, ['checkout', '-q', '-b', branchOf(phase, n), from]);
  commitFile(repo, file, `${UNIT}-${phase}-${n}`);
  git(repo, ['checkout', '-q', 'main']);
}

/** The commit a branch of the project's repository is at. @param {string} repo @param {string} branch */
const tipOf = (repo, branch) => git(repo, ['rev-parse', branch]).trim();

/**
 * The project's verify setup as `verify setup` records it — its mutation tool
 * answering the survivors the test steers it to, none where it steers none.
 */
const VERIFY = Object.freeze({
  place: 'verify',
  feature_map: 'verify/features.md',
  ...Object.fromEntries(['launch', 'health', 'drive', 'evidence', 'cleanup'].map((part) => [part, 'true'])),
  mutation: 'sh verify/mutate.sh',
  ran: { unit: UNIT, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-11-01T09:00:00.000Z' },
});

const MUTATE = `steer="$(git rev-parse --path-format=absolute --git-common-dir)/mutants.json"
if [ -f "$steer" ]; then cp "$steer" "$LEEWAY_RUN/survivors.json"; else echo '[]' > "$LEEWAY_RUN/survivors.json"; fi
`;

/** The survivors the mutation tool answers, steered. @param {unknown[]} survivors */
const surviving = (survivors) => fs.writeFileSync(path.join(dir, '.git', 'mutants.json'), JSON.stringify(survivors));

/** The project's verify setup recorded again naming no mutation tool. */
function withoutMutationTool() {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  const { mutation: _mutation, ...without } = project.environment.verify;
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { ...project.environment, verify: without } }, null, 2));
  commitAll(dir, 'no mutation tool');
}

/** The scenarios' runs the world records, each `[scenario, verdict, the task whose branch it ran at, when]`, in that order. */
const RUNS = Object.freeze([
  ['1.S2', 'skipped', [1, 2], '2026-11-01T10:00:00.000Z'],
  ['2.S1', 'fail', [1, 4], '2026-11-01T11:00:00.000Z'],
  ['2.S1', 'pass', [2, 1], '2026-11-01T12:00:00.000Z'],
  ['2.S1', 'pass', [1, 3], '2026-11-01T13:00:00.000Z'],
]);

/** Each run's file, from the state root, in RUNS' order. */
const runFiles = RUNS.map(([scenario], at) => `${runsRel(UNIT, scenario)}/run-00${RUNS.slice(0, at + 1).filter(([other]) => other === scenario).length}.json`);

/** A ledger write that must succeed: its short id. @param {string} dir @param {string} verb @param {string} address @param {string[]} flags @param {object} content */
const write = (dir, verb, address, flags, content) => ok(dir, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify({ ...MADE, ...content }) }).id;

/** A decision answering a question asked at `address`: its short id. @param {string} dir @param {string} address @param {object} decision @param {string[]} [flags] */
function decided(dir, address, decision, flags = []) {
  const question = write(dir, 'ask', address, [], { by: 'claude', text: 'What is asked?' });
  return write(dir, 'decide', address, ['--answers', question, ...flags], decision);
}

/** The world's entries, by name, as their short ids. @type {Record<string, string>} */
const calls = {};

const world = fixtureFrom('brief-build-', (dir) => {
  createManifest(dir, UNIT, { build: { position: 'auto' }, cut: CUT });
  createManifest(dir, 'draft', { cut: CUT });
  for (const unit of [UNIT, 'draft']) writeState(dir, layout.unit(unit, SPEC_FILE), SPEC);
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS, verify: VERIFY } }, null, 2));
  fs.writeFileSync(path.join(dir, '.gitignore'), `${NESTED}/\n`);
  fs.mkdirSync(path.join(dir, 'verify'));
  fs.writeFileSync(path.join(dir, 'verify', 'mutate.sh'), MUTATE);
  commitAll(dir, 'init');
  const root = statePath(dir);
  for (const [phase, title] of [[1, 'Cards'], [2, 'Refunds']]) {
    ok(dir, ['task', 'phase', UNIT, String(phase), '--title', String(title)]);
    TASKS[/** @type {1|2} */ (phase)].forEach(([name, reference], i) => DRIVER.createTask(root, { unit: UNIT, phase: Number(phase), n: i + 1 }, readTaskText(taskText(name, reference))));
  }
  const task = (/** @type {number} */ n) => ({ unit: UNIT, phase: 1, n });
  DRIVER.done(root, task(1));
  DRIVER.start(root, task(2));
  DRIVER.add(root, task(2), { by: 'person', text: 'The receipt is emailed.' });
  DRIVER.close(root, task(3), 'folded into 1.1');
  const file = path.join(templateFolder('brief-build-files-'), 'note.md');
  for (const [text, phase] of [['Reading a card back never checks its expiry.'], ['A refund screen wants its own receipt.', '3'], ['Two card helpers do the same.']]) {
    fs.writeFileSync(file, `${text}\n`);
    ok(dir, ['task', 'note', UNIT, '--file', file, ...(phase === undefined ? [] : ['--phase', phase])]);
  }
  commitAll(dir, 'the phases written');
  branchWith(dir, [1, 1], 'main', 'src/card.js');
  branchWith(dir, [1, 2], branchOf(1, 1), 'src/receipt.js');
  branchWith(dir, [1, 4], branchOf(1, 2), 'src/check.js');
  branchWith(dir, [1, 3], 'main', 'src/store.js');
  branchWith(dir, [2, 1], branchOf(1, 4), 'src/refund.js');
  commitFile(dir, 'src/main.js');
  RUNS.forEach(([scenario, verdict, [phase, n], at], i) => writeState(dir, runFiles[i], JSON.stringify({
    verdict, unfixed: false, at, checkout: dir, commits: [{ repo: '.', commit: tipOf(dir, branchOf(phase, n)) }], task: `${phase}.${n}`, evidence: [], recordings: [],
  })));
  commitAll(dir, 'the runs');
  const nested = initRepo(path.join(dir, NESTED));
  fs.writeFileSync(path.join(nested, 'README.md'), 'The card library.\n');
  commitCode(nested, 'init');
  branchWith(nested, [1, 1], 'main', 'card/token.js');
  const atSpec = `${UNIT}.specification`;
  const atBuild = `${UNIT}.implementation`;
  calls.spec = decided(dir, atSpec, { by: 'claude', text: 'A card is tokenised.', why: 'No number is kept.' });
  calls.byHand = decided(dir, atSpec, { by: 'person', text: 'Refunds by hand.', why: 'They are rare.' });
  calls.slow = write(dir, 'find', atSpec, ['--relies-on', calls.byHand], { by: 'claude', text: 'A refund takes a day.', how: 'seen in a spike', known: 'spike' });
  calls.builder = decided(dir, atBuild, { by: 'claude', text: 'The receipt is a PDF.\nIt is kept a year.', why: 'Customers print it.' }, ['--task', '1.2']);
  calls.api = write(dir, 'replace', atBuild, ['--replaces', calls.byHand, '--reason', 'changed-mind'], {
    by: 'person', text: 'Refunds through the API.', why: 'They come weekly now.', drops: ['refunds by hand'],
  });
});

/** @type {string} */
let dir;

/**
 * Each test of the calling `describe` in a copy of the world, handed to
 * `into`, the conversation's briefs removed after it.
 * @param {(dir: string) => void} into
 */
function useWorld(into) {
  beforeEach(() => {
    dir = world(path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brief-build-'))), 'project'));
    into(dir);
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

/** A brief issued: its response, the brief as stored, and the record of whose it is. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8'), whose: JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')) };
}

/** A role's template as shipped. @param {string} role */
const template = (role) => fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8');

/** A role's template as shipped, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return template(role).split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/**
 * The calls a reviewer's brief lays its scratch worktree `name` out by, at
 * `own`, the project's repository's commit, and each child's `{folder}={commit}`,
 * and takes it apart by, drawn after the layout's list.
 * @param {string} name @param {string} own @param {string[]} [children]
 */
function scratchCalls(name, own, children = []) {
  return [
    'Lay it out from the project\'s checkout with the first call below, which prepares it as the project\'s own checkout is, its ignored files and linked folders among it; its answer\'s `path` is the project\'s folder there. Take it apart with the second once your report is written.',
    '',
    '```bash',
    `${ENGINE_RUN} scratch lay ${[name, own, ...children].join(' ')}`,
    `${ENGINE_RUN} scratch remove ${name}`,
    '```',
  ].join('\n');
}

/** The engine record as a brief draws it: the engine by the absolute path of the checkout briefing. */
const ENGINE_DRAWN = `\`${ENGINE_RUN}\` — the engine of the checkout the orchestrator runs in. Run every engine command this brief and your instructions name as that, from wherever you run it.`;

/** A refusal leaving the state as it was and no brief stored. @param {string[]} args @param {RegExp} pattern */
function refusedUnissued(args, pattern) {
  const { error } = refusedPristine(dir, ['brief', ...args], { env: SESSION });
  assert.match(error, pattern);
  assert.deepStrictEqual(stored(), []);
}

/** A path drawn as a brief draws it. @param {string} rel the path from the state root */
const pathDrawn = (rel) => `\`${statePath(dir, rel)}\``;

/** The range drawn for a repository, its files added. @param {string} where @param {string} tip @param {string[]} files */
function rangeDrawn(where, tip, files) {
  const width = Math.max(...files.map((file) => file.length));
  const lines = files.map((file) => ` ${file.padEnd(width)} | 1 +`);
  const total = files.length === 1 ? '1 file changed, 1 insertion(+)' : `${files.length} files changed, ${files.length} insertions(+)`;
  return `## In ${where}: \`main...${tip}\`\n\n\`\`\`\n${lines.join('\n')}\n ${total}\n\`\`\``;
}

/** The unit's decided calls as a brief draws them, the builder's own among them. */
const decidedDrawn = () => [
  `- ${calls.spec}, Claude's: A card is tokenised.\n  Why: No number is kept.`,
  `- ${calls.builder}, Claude's: The receipt is a PDF.\n  It is kept a year.\n  Why: Customers print it.`,
  `- ${calls.api}, the person's: Refunds through the API.\n  Why: They come weekly now.`,
].join('\n');

// Task 1.2's review rounds, for the suites of where a reviewer's report
// goes, a change under review and the way on from a round.

const REPORT = '## Findings\n\n- bug: The receipt is never sent.\n  Scenario: A customer pays and waits for a receipt.\n\nVerdict: fail\n';

const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** The reviewer's brief for task 1.2 by reviewer `letter`, in the conversation `session` names. @param {string} letter @param {string} [session] */
const reviewing = (letter, session = SESSION_ID) => ok(dir, ['brief', 'reviewer', UNIT, '1.2', '--base', 'main', '--letter', letter], { env: { CLAUDE_CODE_SESSION_ID: session } });

/** The report place a brief draws. @param {{id: string}} res @param {string} [session] */
const placeIn = (res, session = SESSION_ID) => /# Where your report goes\n\n(.*)\n/.exec(fs.readFileSync(briefPath(session, res.id), 'utf8'))?.[1];

/** A round's report written by reviewer `letter`. @param {number} round @param {string} letter @param {string} [text] */
const reported = (round, letter, text = REPORT) => writeState(dir, `pay/build/tasks/1.2/round-${round}-${letter}.md`, text);

/**
 * Why a reviewer of task 1.2 is refused once round `round` passed, or was
 * settled where `ended` says so, its account not taken and no worktree
 * having its branch out: the way on, its builder's brief laying one out,
 * where its reports are read for their notes for later and nits.
 * @param {number} round @param {'passed'|'was settled'} [ended]
 */
const over = (round, ended = 'passed') => `round ${round} of task 1.2 of pay ${ended} — its review is over: no worktree has its branch checked out, so send its builder its brief first, engine brief builder pay 1.2, which lays one out and asks for its account; read its reports, ${['a', 'b'].map((letter) => pathDrawn(`pay/build/tasks/1.2/round-${round}-${letter}.md`)).join(' and ')}, for their notes for later and the nits the task's commits do not yet fix, and fix those in that worktree before its account is taken`;

/** A reviewer's brief for task 1.2 refused, in the words `expected`, the state as it was and no brief stored. @param {string} expected */
function reviewerRefused(expected) {
  const before = stored();
  assert.strictEqual(refusedPristine(dir, ['brief', 'reviewer', UNIT, '1.2', '--letter', 'a'], { env: SESSION }).error, expected);
  assert.deepStrictEqual(stored(), before);
}

/** Round `round`'s pair briefed in a conversation of their own, `opening`. @param {number} round @param {string} [opening] */
function briefedFor(round, opening = `brief-build-round-${round}`) {
  try {
    for (const letter of ['a', 'b']) assert.strictEqual(placeIn(reviewing(letter, opening), opening), pathDrawn(`pay/build/tasks/1.2/round-${round}-${letter}.md`));
  } finally {
    fs.rmSync(conversationDir(opening), { recursive: true, force: true });
  }
}

/** Something added to task 1.2 by the orchestrator. @param {string} text */
function added(text) {
  writeState(dir, 'pay/build/tasks/1.2/addition.md', `${text}\n`);
  ok(dir, ['task', 'add', UNIT, '1.2', '--file', statePath(dir, 'pay/build/tasks/1.2/addition.md'), '--by', 'orchestrator']);
}

/** The conversation briefing task 1.2's builder in these tests. */
const BUILDING = 'brief-build-builder';

/** Why the builder's brief for task 1.2 is refused, asked in the conversation briefing it. */
const builderBrief = () => {
  const res = refuses(dir, ['brief', 'builder', UNIT, '1.2'], { env: { CLAUDE_CODE_SESSION_ID: BUILDING } });
  fs.rmSync(conversationDir(BUILDING), { recursive: true, force: true });
  return res.error;
};

/** Why round `round` of task 1.2 is not reported whole, each reviewer's way on given. @param {number} round @param {string[]} ways */
const notWhole = (round, ways) => `round ${round} of task 1.2 of pay is not yet reported whole — ${ways.join('; ')} — and its builder goes back once the round's reports are in`;

/** The way on for a reviewer of task 1.2 still to report, briefed in this conversation. @param {string} letter */
const stillReading = (letter) => `reviewer ${letter}, briefed in this conversation, is still to report: wait for it — or, where it stopped without writing its report, brief it again, engine brief reviewer pay 1.2 --letter ${letter}`;

/** The way on for a reviewer of task 1.2 an earlier conversation briefed. @param {string} letter */
const briefedEarlier = (letter) => `reviewer ${letter} was briefed in an earlier conversation, or not at all: brief it for the round, engine brief reviewer pay 1.2 --letter ${letter}`;

/** Why task 1.2 changed after round `round` passed, as the account and the chain refuse it, its builder briefed on the change. @param {number} round */
const changedAfter = (round) => `task 1.2 of pay changed after round ${round} passed — something was added to it, or a call of it decided against its lean — so its pair reads it again first: engine brief reviewer pay 1.2 --letter <letter>, each reviewer of round ${round + 1}`;

/** Why task 1.2 changed after round `round` passed while its builder is still to be briefed on the change, which round `next` reads. @param {number} round @param {number} next */
const changedUnbuilt = (round, next) => `task 1.2 of pay changed after round ${round} passed — something was added to it, or a call of it decided against its lean — so its builder builds it first, engine brief builder pay 1.2, then its pair reads it in round ${next}`;

/** Why a reviewer of task 1.2 is refused for round `round` while a change waits on its builder's brief. @param {number} round */
const unbuilt = (round) => `task 1.2 of pay changed since its builder's last brief — something was added to it, or one of its calls decided against its lean — so its builder builds it before its pair reads it: send its builder its brief first, engine brief builder pay 1.2, then each reviewer of round ${round}`;

/** The fix brief `id` of round 1 of task 1.2, its reports alone: a's failing, b's passing. @param {string} id */
const fixOfRound1 = (id) => `Brief ${id} — the fix round's, for pay task 1.2\n\n${filledTemplate('fix', { reports: `# Reviewer A's report\n\n${REPORT}\n\n# Reviewer B's report\n\n${PASSED}` })}`;

/** The change put onto task 1.2 in these tests, as a brief draws it. */
const ADDED = '## Added by the orchestrator\n\nThe receipt names the amount.';

/** Why the fix brief for task 1.2 is refused, asked in this conversation. */
const fixRefused = () => refuses(dir, ['brief', 'fix', UNIT, '1.2'], { env: { CLAUDE_CODE_SESSION_ID: SESSION_ID } }).error;

module.exports = {
  TEMPLATES,
  AGENTS,
  UNIT,
  SESSION_ID,
  SESSION,
  LINTERS,
  NESTED,
  VERIFY,
  SPEC,
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
  surviving,
  withoutMutationTool,
  RUNS,
  runFiles,
  calls,
  useWorld,
  issued,
  template,
  filledTemplate,
  scratchCalls,
  ENGINE_DRAWN,
  refusedUnissued,
  pathDrawn,
  rangeDrawn,
  decidedDrawn,
  REPORT,
  PASSED,
  reviewing,
  placeIn,
  reported,
  over,
  reviewerRefused,
  briefedFor,
  added,
  BUILDING,
  builderBrief,
  notWhole,
  stillReading,
  briefedEarlier,
  changedAfter,
  changedUnbuilt,
  unbuilt,
  fixOfRound1,
  ADDED,
  fixRefused,
  ok,
  refusedPristine,
  statePath,
  layout,
  writeState,
  readState,
  commitAll,
  git,
  briefPath,
  conversationDir,
  SPEC_FILE,
  readTaskText,
  readConsolidation,
};
