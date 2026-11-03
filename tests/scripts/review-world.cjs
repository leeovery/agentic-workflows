'use strict';

// ---------------------------------------------------------------------------
// The review phase's suites' world and helpers (test-engine-review-*.cjs,
// test-engine-brief-review.cjs): a project, built once per process and
// copied for each test, with a feature, `pay`, whose build has finished —
// its spec of two areas, each with its scenarios, its statements citing
// the ledger so the second area relies on the first; its cut of two
// phases, each closed, their tasks done in the tracker through the default
// driver, one closed, and landed on main, each commit naming its task —
// between them a commit naming none and another unit's landing, and another
// of that unit's after them, the unit named `pay-shop` so its trailers open
// as this unit's do; runs of its scenarios at main, 1.S1 passing, 1.S2
// failing, 2.S1 only skipped; its calls across the unit —
// Claude's two at the spec, each labelled, and two in the build, one
// labelled, which the person handed over as "your call", one unlabelled;
// the person's at the spec, one replaced and so no longer current, one
// relying on Claude's call on the receipt; and the project's linters.
// Beside it a quick-fix, a unit built under the old plan, a unit whose
// build has not begun, one whose second phase has not closed, one with no
// phase closed, one of one area and one of five, each its one phase closed.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, git, initRepo, stateGit, fixtureFrom, cleanupFixture, withEnv, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { readTaskText } = require(path.join(SCRIPTS, 'domain/task-file.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { runsRel } = require(path.join(SCRIPTS, 'domain/runs.cjs'));
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));

const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);
const UNIT = 'pay';
const SESSION_ID = 'review-session';
const MADE = Object.freeze({ who_moved_whom: 'none' });
const LINTERS = Object.freeze([{ name: 'eslint', command: 'npx eslint .' }]);
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';

/**
 * A spec of two areas, each its scenarios, each statement citing the entry
 * `cites` gives it, where it gives one.
 * @param {{token?: string, copy?: string, refund?: string}} [cites]
 */
function specOf(cites = {}) {
  const cited = (/** @type {string|undefined} */ id) => (id === undefined ? '' : ` [${id}]`);
  return [
    '# Payments', '',
    '## 1. Cards', '', '### 1.1 The form', '', `1.1.1 A card is taken once.${cited(cites.token)}`, '',
    '### 1.2 The receipt', '', `1.2.1 A receipt follows every charge.${cited(cites.copy)}`, '',
    '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when the number is typed, then it is checked. (1.1.1)', '',
    '1.S2 Given a charge, when it lands, then a receipt follows. (1.2.1)', '',
    '## 2. Refunds', '', '### 2.1 The charge', '', `2.1.1 A refund names its charge.${cited(cites.refund)}`, '',
    '## 2-S. Scenarios for §2', '', '2.S1 Given a charge, when it is refunded whole, then the card is credited. (2.1.1)', '',
  ].join('\n');
}
/** An area of a spec, its heading to its last part. @param {string} spec @param {number} area */
const areaText = (spec, area) => spec.slice(spec.indexOf(`## ${area}. `), spec.indexOf(`\n\n## ${area}-S.`));
/** The areas by their names in the layout. */
const AREAS = Object.freeze(['1-cards', '2-refunds']);
/** Round 1's reads: every area and the test surface. */
const EVERY = Object.freeze([...AREAS, 'tests']);

/** The five-area spec's area titles, in its order. */
const FIVE = Object.freeze(['Cards', 'Refunds', 'Receipts', 'Disputes', 'Payouts']);
/** A spec of five areas, each with one part and one scenario. */
const fiveSpec = () => ['# Payments', '', ...FIVE.flatMap((title, at) => [
  `## ${at + 1}. ${title}`, '', `### ${at + 1}.1 The ${title.toLowerCase()}`, '', `${at + 1}.1.1 ${title} work.`, '',
  `## ${at + 1}-S. Scenarios for §${at + 1}`, '', `${at + 1}.S1 Given a charge, when ${title.toLowerCase()} run, then they work. (${at + 1}.1.1)`, '',
])].join('\n');

/** The unit's cut: two phases. */
const CUT = Object.freeze({
  phases: [
    { name: 'Cards', goal: 'A customer pays by card.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'A customer is refunded.', scenarios: ['2.S1'], sections: ['2'], relies_on: [1] },
  ],
});

/** Each phase's checklists closed, as their closes record them. @param {number[]} phases */
const closedChecklists = (phases) => Object.fromEntries(phases.flatMap((phase) => ['start', 'close'].map((at) => [`phase-${phase}-${at}`, { items: {}, closed: FROZEN_AT }])));

/** A task file's text. @param {string} title @param {string} reference */
function taskText(title, reference) {
  return [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a card, when ${title.toLowerCase()} runs, then it answers.`, '',
    '## Spec reference', reference,
  ].join('\n');
}

/** The cut's tasks, by phase, each landed but the closed one. */
const TASKS = Object.freeze({
  1: [['Take a card', '§1.1'], ['Show a receipt', '§1.2'], ['Store a card', '§1.1']],
  2: [['Refund a charge', '§2.1']],
});

/** Another unit, its name opening as this one's, whose landings sit beside this one's. */
const OTHER = `${UNIT}-shop`;

/** One file added in a repository and committed on the branch checked out, its message naming the task `trailer` names. @param {string} dir @param {string} file @param {string} [trailer] */
function commitFile(dir, file, trailer) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), `export const ${path.basename(file, '.js')} = 1;\n`);
  git(dir, ['add', file]);
  git(dir, ['commit', '-q', '-m', trailer === undefined ? `add ${file}` : `feat(${trailer.split('-').slice(0, -2).join('-')}): add ${file}\n\nTask: ${trailer}`]);
}

/** The scenarios' runs at main: `[scenario, verdict]`. */
const RUNS = Object.freeze([['1.S1', 'pass'], ['1.S2', 'fail'], ['2.S1', 'skipped']]);

/** A ledger write that must succeed: its short id. @param {string} dir @param {string} verb @param {string} address @param {string[]} flags @param {object} content */
const write = (dir, verb, address, flags, content) => ok(dir, ['ledger', verb, address, ...flags], { env: { CLAUDE_CODE_SESSION_ID: SESSION_ID }, stdin: JSON.stringify({ ...MADE, ...content }) }).id;

/**
 * A decision answering a question asked at `address`, both made for `task`
 * where one is named: its short id.
 * @param {string} dir @param {string} address @param {string} question @param {object} decision
 * @param {{flags?: string[], task?: string}} [made]
 */
function decided(dir, address, question, decision, { flags = [], task } = {}) {
  const forTask = task === undefined ? [] : ['--task', task];
  const asked = write(dir, 'ask', address, forTask, { by: 'claude', text: question });
  return write(dir, 'decide', address, ['--answers', asked, ...forTask, ...flags], decision);
}

/** The world's entries, by name, as their short ids. @type {Record<string, string>} */
const calls = {};

const world = fixtureFrom('review-', (dir) => {
  createManifest(dir, UNIT, { build: { position: 'auto' }, cut: CUT, checklists: closedChecklists([1, 2]) });
  createManifest(dir, 'half', { build: { position: 'auto' }, cut: CUT, checklists: closedChecklists([1]) });
  createManifest(dir, 'open', { build: { position: 'auto' }, cut: CUT });
  createManifest(dir, 'solo', { build: { position: 'auto' }, cut: { phases: [CUT.phases[0]] }, checklists: closedChecklists([1]) });
  createManifest(dir, 'five', {
    build: { position: 'auto' },
    cut: { phases: [{ name: 'All', goal: 'A customer pays.', scenarios: FIVE.map((_, at) => `${at + 1}.S1`), sections: FIVE.map((_, at) => String(at + 1)), relies_on: [] }] },
    checklists: closedChecklists([1]),
  });
  createManifest(dir, 'fresh', { cut: CUT });
  createManifest(dir, 'tweak', { work_type: 'quick-fix' });
  createManifest(dir, 'old', { phases: { planning: { items: { old: { status: 'completed' } } } }, build: { position: 'auto' } });
  for (const unit of ['half', 'fresh']) writeState(dir, layout.unit(unit, SPEC_FILE), specOf());
  writeState(dir, layout.unit('solo', SPEC_FILE), specOf().slice(0, specOf().indexOf('## 2. Refunds')));
  writeState(dir, layout.unit('five', SPEC_FILE), fiveSpec());
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS } }, null, 2));
  commitAll(dir, 'init');
  const root = statePath(dir);
  for (const [phase, title] of [[1, 'Cards'], [2, 'Refunds']]) {
    ok(dir, ['task', 'phase', UNIT, String(phase), '--title', String(title)]);
    TASKS[/** @type {1|2} */ (phase)].forEach(([name, reference], i) => DRIVER.createTask(root, { unit: UNIT, phase: Number(phase), n: i + 1 }, readTaskText(taskText(name, reference))));
  }
  for (const [phase, n] of [[1, 1], [1, 2], [2, 1]]) DRIVER.done(root, { unit: UNIT, phase, n });
  DRIVER.close(root, { unit: UNIT, phase: 1, n: 3 }, 'folded into 1.1');
  commitAll(dir, 'the phases written');
  commitFile(dir, 'src/card.js', `${UNIT}-1-1`);
  commitFile(dir, 'docs/readme.js');
  commitFile(dir, 'src/receipt.js', `${UNIT}-1-2`);
  commitFile(dir, 'src/coupon.js', `${OTHER}-1-1`);
  commitFile(dir, 'src/refund.js', `${UNIT}-2-1`);
  commitFile(dir, 'src/banner.js', `${OTHER}-1-2`);
  const main = git(dir, ['rev-parse', 'main']).trim();
  RUNS.forEach(([scenario, verdict], i) => writeState(dir, `${runsRel(UNIT, scenario)}/run-001.json`, JSON.stringify({
    verdict, unfixed: false, at: `2026-11-01T1${i}:00:00.000Z`, checkout: dir, commits: [{ repo: '.', commit: main }], task: null, evidence: [], recordings: [],
  })));
  commitAll(dir, 'the runs');
  const atSpec = `${UNIT}.specification`;
  const atBuild = `${UNIT}.implementation`;
  calls.token = decided(dir, atSpec, 'How is a card kept?', { by: 'claude', text: 'A card is tokenised.', why: 'No number is kept.', kind: 'danger' });
  calls.copy = decided(dir, atSpec, 'What does the receipt say?', { by: 'claude', text: 'The receipt names the shop.', why: 'Customers know it.', kind: 'words' });
  calls.pdf = decided(dir, atBuild, 'What form is the receipt?', { by: 'claude', text: 'The receipt is a PDF.', why: 'Customers print it.', kind: 'behaviour', given: 'your-call' }, { task: '1.2' });
  calls.retry = decided(dir, atBuild, 'How often is a charge retried?', { by: 'claude', text: 'A charge is retried twice.', why: 'The gateway drops one in a hundred.' }, { task: '1.1' });
  calls.byHand = decided(dir, atSpec, 'How are refunds made?', { by: 'person', text: 'Refunds by hand.', why: 'They are rare.' });
  calls.api = write(dir, 'replace', atSpec, ['--replaces', calls.byHand, '--reason', 'changed-mind'], {
    by: 'person', text: 'Refunds through the API.', why: 'They come weekly now.', drops: ['refunds by hand'],
  });
  calls.refund = decided(dir, atSpec, 'What does a refund\'s receipt say?', { by: 'person', text: 'A refund\'s receipt names the shop.', why: 'As its charge\'s did.' }, { flags: ['--relies-on', calls.copy] });
  writeState(dir, layout.unit(UNIT, SPEC_FILE), specOf({ token: calls.token, copy: calls.copy, refund: calls.refund }));
  commitAll(dir, 'the spec');
});

/** @type {string} */
let dir;
/** @type {string} */
let config;

/**
 * Each test of the calling `describe` in a copy of the world, handed to
 * `into`, its conversations' records in a config folder of its own.
 * @param {(dir: string) => void} into
 */
function useWorld(into) {
  beforeEach(() => {
    dir = world(path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'review-'))), 'project'));
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'review-config-'));
    into(dir);
  });
  afterEach(() => {
    cleanupFixture(path.dirname(dir));
    fs.rmSync(config, { recursive: true, force: true });
  });
}

/** The engine as the world's conversation runs it. @param {string} [sessionId] */
const env = (sessionId = SESSION_ID) => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: sessionId, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** `enter review`, which must succeed: its response and its sections. @param {string[]} [args] */
const enter = (args = [UNIT]) => okSections(dir, ['enter', 'review', ...args], { env: env() });

/** A payload file beside the project, outside its working tree. @param {string} name @param {unknown} payload */
function payload(name, payload) {
  const file = path.join(path.dirname(dir), name);
  fs.writeFileSync(file, typeof payload === 'string' ? payload : JSON.stringify(payload));
  return file;
}

/** A reviewer's report of the round, its findings each `- {call}: {text}`, failing where one is more than a nit. @param {string[]} findings */
function reportText(findings) {
  const listed = findings.length === 0 ? 'None.' : findings.map((finding) => `- ${finding}\n  Scenario: A customer pays.`).join('\n');
  return `# Review\n\n## Findings\n\n${listed}\n\nVerdict: ${findings.every((finding) => finding.startsWith('nit: ')) ? 'pass' : 'fail'}\n`;
}

/** Every report a round's reads ask for written — each area's pair, the test surface's one — each holding the findings `found` gives it by its name, else none. @param {number} round @param {readonly string[]} reads @param {Record<string, string[]>} [found] */
function reported(round, reads, found = {}) {
  for (const name of reads.flatMap((read) => (read === 'tests' ? ['tests-a'] : [`${read}-a`, `${read}-b`]))) {
    writeState(dir, `${UNIT}/review/round-${round}/${name}.md`, reportText(found[name] ?? []));
  }
}

/** `review reads`, naming a later round's reads, which must succeed: its response. @param {string[]} reads */
const named = (reads) => ok(dir, ['review', 'reads', UNIT, ...reads], { env: env() });

/** `review round`, which must succeed: its response. @param {object} account */
const recorded = (account) => ok(dir, ['review', 'round', UNIT, '--file', payload('round.json', account)], { env: env() });

/** `review round` refused, nothing written: its error. @param {object|string} account */
const refusedRound = (account) => refusedPristine(dir, ['review', 'round', UNIT, '--file', payload('round.json', account)], { env: env() }).error;

/** A task of the unit's — `unit`'s, where given — written in the tracker. @param {number} phase @param {string} title @param {string} reference @param {string} [unit] */
function taskMade(phase, title, reference, unit = UNIT) {
  const file = payload('task.md', taskText(title, reference));
  return ok(dir, ['task', 'create', unit, String(phase), '--file', file]);
}

/** A fix phase written, its tasks made. @param {number} phase @param {[string, string][]} tasks */
function fixPhaseWritten(phase, tasks) {
  ok(dir, ['task', 'phase', UNIT, String(phase), '--title', `Review fixes ${phase}`]);
  for (const [title, reference] of tasks) taskMade(phase, title, reference);
}

/** The unit switched to step. */
const inStep = () => createManifest(dir, UNIT, { ...readManifest(dir, UNIT), build: { position: 'step' } });

/** Task 2.2 written in the cut's last phase and done, its branch not landed: the phase's stack waits to merge — at its gate, in step. */
function cutUnmerged() {
  taskMade(2, 'Refund twice', '§2.1');
  fixBuilt(2, 2, 'Refund twice', 'main', 'src/twice.js');
}

/** A fix task's branch, as the landing names it. @param {number} phase @param {number} n @param {string} title */
const fixBranch = (phase, n, title) => taskBranch({ unit: UNIT, phase, n }, 'feat', title);

/** A task done in the tracker, its branch made from `from` with a commit adding `file` in the repository at `repo`, its checkout back on main. @param {number} phase @param {number} n @param {string} title @param {string} from @param {string} file @param {string} [repo] */
function fixBuilt(phase, n, title, from, file, repo = dir) {
  DRIVER.done(statePath(dir), { unit: UNIT, phase, n });
  commitAll(dir, `task ${phase}.${n} done`);
  git(repo, ['checkout', '-q', '-b', fixBranch(phase, n, title), from]);
  commitFile(repo, file, `${UNIT}-${phase}-${n}`);
  git(repo, ['checkout', '-q', 'main']);
}

/** A task closed in the tracker. @param {number} phase @param {number} n */
function fixClosed(phase, n) {
  DRIVER.close(statePath(dir), { unit: UNIT, phase, n }, 'not needed after all');
  commitAll(dir, `task ${phase}.${n} closed`);
}

/** A DATA section of `lines`, as an entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/** A state file's text. @param {string} rel */
const stateText = (rel) => fs.readFileSync(statePath(dir, rel), 'utf8');

/** The state branch's last commit: its subject and the files it touched. */
const lastStateCommit = () => {
  const [subject, ...files] = stateGit(dir, ['show', '--name-only', '--format=%s', 'HEAD']).trim().split('\n').filter(Boolean);
  return { subject, files: files.sort() };
};

/** A brief issued in the world's conversation, which must succeed: its response, the brief as stored, and the record of whose it is. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: env() });
  return withEnv({ LEEWAY_CONFIG_DIR: config }, () => ({
    res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8'), whose: JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')),
  }));
}

/** Claude's call at the review, filing or dropping a finding out of scope: its short id. @param {string} text @param {string} why */
const reviewCall = (text, why) => decided(dir, `${UNIT}.review`, 'Is this finding filed or dropped?', { by: 'claude', text, why });

/** An item filed through `inbox file`, which must succeed, under the frozen clock: its response. @param {object} item */
const filed = (item) => withFrozenClock(() => ok(dir, ['inbox', 'file', UNIT, '--file', payload('item.json', item)], { env: env() }));

/** Area 1's finding in scope; it answering round 1's first reviewer of area 1, fixed by task 3.1; and that report failing on it. */
const FOUND = Object.freeze({ area: '1-cards', scope: 'in', call: 'bug', text: 'The receipt is never sent.' });
const RECEIPT = Object.freeze({ ...FOUND, from: ['1-cards-a#1'], fix: '3.1' });
const FAILING = Object.freeze({ '1-cards-a': ['bug: The receipt is never sent.'] });

/** Round 1 under review: entered, its reports written, failing on area 1's receipt, its fix task 3.1 written. */
function firstRoundReady() {
  enter();
  reported(1, EVERY, FAILING);
  fixPhaseWritten(3, [['Send the receipt', '§1.2']]);
}

/** Round 1 recorded failing, area 1's finding fixed by task 3.1, not yet built. */
function firstRoundFailed() {
  firstRoundReady();
  recorded({ can_now: ['Pay by card.'], findings: [RECEIPT] });
}

/** Round 1 recorded failing, its fix task 3.1 built and done, and round 2 under review: entered, area 1 named its read, its reports written, `found` its findings. @param {Record<string, string[]>} [found] */
function secondRoundReady(found = {}) {
  firstRoundFailed();
  fixBuilt(3, 1, 'Send the receipt', 'main', 'src/send.js');
  enter();
  named(['1-cards']);
  reported(2, ['1-cards'], found);
}

/** The briefs stored for the world's conversation, by file name. */
function storedBriefs() {
  const folder = withEnv({ LEEWAY_CONFIG_DIR: config }, () => path.dirname(briefPath(SESSION_ID, 'x')));
  return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
}

module.exports = {
  UNIT, OTHER, ENGINE, SESSION_ID, areaText, AREAS, EVERY, FIVE, calls,
  useWorld, env, enter, inStep, payload, reportText, reported, named, recorded, refusedRound, taskMade, fixPhaseWritten, cutUnmerged, fixBranch, fixBuilt, fixClosed, commitFile, data, stateText, lastStateCommit, issued, storedBriefs,
  decided, reviewCall, filed, FOUND, RECEIPT, FAILING, firstRoundReady, firstRoundFailed, secondRoundReady,
  ok, okSections, refusedPristine, statePath, writeState, readManifest, git, stateGit, createManifest, initRepo, assert,
};
