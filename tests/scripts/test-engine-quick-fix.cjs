'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's work in the build (leeway-engine/scripts/domain/
// build-entry.cjs, its quick-fix arm, chosen where derivations.cjs's
// `quickFixBuild` says; fix-branch.cjs): `engine enter implementation
// <quick-fix>` — another session holding the checkout's code stopped at the
// code gate alone, nothing written (12.7.8, 19.5.18); no cut, no ready to
// build and no position, its fixes begun — their one phase written into the
// tracker where it is missing, their beginning recorded on the manifest and
// committed — and the tasks in progress put in flight (E4); what it reads,
// its recovery note re-reading the same: the change, the fixes, the record
// once written, the unit's record, the build's log and the engine. Its fix
// built in the project's own checkout: `task start` putting the checkout on
// the fix's branch — the first laid from the branch it lands on, a later
// one on the fix before it — refused while the checkout holds changes not
// committed; and through the doors any task takes (19.S20): the commit door,
// refusing a commit on another branch, naming the fix's (12.9.9), `land
// open` and `task done` owing no account, no pair reviewing it (19.5.3,
// 19.5.15), and the last fix closed naming no mutation run, there being no
// phase review (15.6.3). A raise at its place drawn in the conversation,
// `--parks` refused (19.5.3, E5); the review's fix phases numbered past the
// fixes (P14); and the cut's screens refusing it. The task file's rules are
// test-engine-task-verbs.cjs's, its verify run test-engine-verify.cjs's, the
// board's row test-engine-board-units.cjs's, and a quick-fix today's scoping
// made test-engine-build-entry.cjs's and test-engine-legacy-build.cjs's.
//
// Layer: git. World: a quick-fix made through `workunit create` from an
// inbox note, its code and the build's skill committed, and a feature beside
// it whose code a peer may hold (quick-fix-world.cjs); and the same entered by a conversation gone
// since, its fix 1.1 created and started there, putting the checkout on its
// branch, and a question asked at its place — each built once and copied.
// Each test's conversations keep their records in a config folder of their
// own. The separate call is the stub binary, unarmed, so a raise's rows are
// drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, refusesAsync, refusedPristine, output, git, stateGit, statePath, layout, writeState, readState, createFile, fixtureFrom, cleanupFixture,
  head, readManifest,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { raiseHelpers } = require('./raise-world.cjs');
const { UNIT, PLACE, DESCRIPTION, quickFix, createFix, asGone, entered: enteredBy } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { isFixPhase } = require(path.join(SCRIPTS, 'domain/derivations.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { fixPhase } = require(path.join(SCRIPTS, 'domain/review-phase.cjs'));

const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const TITLE = 'Spell the flag --colour';
const SECOND = 'Spell the help --colour';
const BRANCH = taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'fix', TITLE);
const MESSAGE = 'fix(typo): spell the flag --colour';
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// A process that runs and is not this suite's.
const PEER = String(process.ppid);

/** Claude's call on what the old spelling does, as the raise suites make one. */
const CALL = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

/** The question the world asks at the quick-fix's place: its short id. */
const asked = { alias: '' };

const fresh = fixtureFrom('quick-fix-', quickFix);

const entered = fixtureFrom('quick-fix-entered-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    enteredBy(dir, as);
    createFix(dir, 1, TITLE);
    ok(dir, ['task', 'start', UNIT, '1.1'], as);
  });
  asked.alias = ledgerHelpers(() => dir).write('ask', PLACE, [], { ...MADE, text: 'Does --color still work?' }).id;
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The engine as this test's conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** An entry that must succeed: its response and its sections. @param {string[]} [flags] */
const enter = (flags = []) => okSections(dir, ['enter', 'implementation', UNIT, ...flags], { env: env() });

/** The conversation's position as recorded, or null. */
function position() {
  try { return JSON.parse(fs.readFileSync(path.join(config(), 'conversations', 'sess-1', 'position.json'), 'utf8')); } catch { return null; }
}

/** The state's last `count` commit subjects, newest first. @param {number} count */
const subjects = (count) => stateGit(dir, ['log', `-${count}`, '--format=%s']).trim().split('\n');

/** The branch the project's checkout has out. */
const branchOut = () => git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();

/** A commit's sha. @param {string} rev */
const sha = (rev) => git(dir, ['rev-parse', rev]).trim();

/** The project's environment, the parts given set. @param {Record<string, unknown>} parts */
function environment(parts) {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { ...project.environment, ...parts } }, null, 2));
}

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/** The change and its fixes, as the entry and the note read them, the record where written. @param {string} tasks @param {boolean} [summary] */
const fixesLines = (tasks, summary = false) => [
  `change: ${DESCRIPTION}`,
  `seed: ${statePath(dir, layout.unit(UNIT, 'seeds/2026-06-03-colour-flag.md'))}`,
  `tasks: ${tasks}`,
  ...(summary ? [`summary: ${statePath(dir, layout.unit(UNIT, 'summary.md'))}`] : []),
];

/** The entry's DATA, its fixes as `tasks` says them and the record where written. @param {string} tasks @param {boolean} [summary] */
const quickFixData = (tasks, summary = false) => data([
  ...fixesLines(tasks, summary),
  `record: \`${ENGINE} ledger record ${UNIT}\``,
  `build log: ${statePath(dir, layout.unit(UNIT, 'build/log.md'))}`,
  `engine: \`node ${path.join(SCRIPTS, 'engine.cjs')}\` — the engine by its absolute path, for a call made from a task's worktree`,
]);

/** The fixes as the tracker lists them. */
const fixes = () => ok(dir, ['task', 'list', UNIT, '1']).tasks.map(({ task, title, status }) => ({ task, title, status }));

describe('enter implementation <quick-fix>: its fixes, with no cut, no ready to build and no position (19.5.1, 19.5.4, E4)', () => {
  it('a first entry begins its fixes — their one phase written into the tracker, which commits it, and their beginning recorded on the manifest, which the entry commits — and reads the change, no fix yet, the record\'s call, the build log and the engine', () => {
    dir = fresh();
    const { res, sections } = enter();

    assert.deepStrictEqual([res, subjects(2), fixes()], [
      { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() },
      [`implementation(${UNIT}): start`, `task(${UNIT}): write phase 1`],
      [],
    ]);
    assert.match(readManifest(dir, UNIT).fixes.began, AT);
    assert.strictEqual(sections, quickFixData('none yet'));
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT });
  });

  it('entered again, starts nothing and commits nothing; its phase written with no beginning recorded, it records the beginning alone', () => {
    dir = fresh();
    enter();
    const before = head(dir);
    const again = enter();
    const unmoved = head(dir) === before;
    const read = quickFixData('none yet');
    cleanupFixture(dir);
    dir = fresh();
    ok(dir, ['task', 'phase', UNIT, '1', '--title', 'the fixes']);
    const recorded = enter().res.started;

    assert.deepStrictEqual([again.res, unmoved, again.sections], [{ ok: true, phase: 'implementation', unit: UNIT, entered: true, started: false }, true, read]);
    assert.deepStrictEqual([recorded, subjects(2)], [true, [`implementation(${UNIT}): start`, `task(${UNIT}): write phase 1`]]);
  });

  it('puts in flight the fix another conversation left in progress, reading each fix by its id, title and where it stands, and its record once written; its recovery note re-reads the same', () => {
    dir = entered();
    writeState(dir, layout.unit(UNIT, 'summary.md'), `## ${TITLE}\n`);
    const { res, sections } = enter();
    writeState(dir, layout.unit(UNIT, 'build', 'log.md'), '# The fixes\n');
    const note = output(dir, ['conversation', 'position'], { env: env() });

    assert.deepStrictEqual(res, { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: false });
    assert.strictEqual(sections, quickFixData(`1.1 "${TITLE}" in progress`, true));
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT, tasks: [{ task: '1.1', builder: null, reviewers: [] }] });
    for (const line of [
      path.join(dir, '.claude/skills/leeway-implementation-process/SKILL.md'), `\`${ENGINE} ledger record ${UNIT}\``, statePath(dir, `${UNIT}/build/log.md`), ...fixesLines(`1.1 "${TITLE}" in progress`, true),
    ]) {
      assert.ok(note.includes(line), `the note names ${line}\n${note}`);
    }
  });

  it('another session holding the checkout\'s code stops it at the code gate alone, nothing written and the fixes not begun; --take enters all the same (12.7.8, 19.5.18)', () => {
    dir = fresh();
    okSections(dir, ['presence', 'beat', 'other', 'implementation', 'other'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'peer', CLAUDE_PID: PEER } });
    const before = head(dir);
    const { res, sections } = enter();
    const stopped = [res, head(dir), position()];
    const taken = enter(['--take']).res;

    assert.deepStrictEqual(stopped, [{ ok: true, phase: 'implementation', unit: UNIT, entered: false }, before, null]);
    assert.match(sections, /=== MENU: code gate /);
    assert.deepStrictEqual(taken, { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: true, committed: taken.committed });
  });

  it('the screens of a build by its cut refuse it, naming its entry', () => {
    dir = fresh();
    assert.strictEqual(refusedPristine(dir, ['render', 'build-progress', UNIT]).error, `render build-progress: ${UNIT} is a quick-fix, whose fixes have no cut to build by — they are entered at enter implementation ${UNIT}`);
  });
});

describe('the review\'s fix phases, asked for at the close, number past the fixes (P14)', () => {
  it('phase 1 is the fixes, and the first round\'s fix phase is 2', () => {
    const manifest = { name: UNIT, work_type: 'quick-fix', status: 'in-progress', phases: {} };
    assert.deepStrictEqual([isFixPhase(manifest, 1), isFixPhase(manifest, 2), fixPhase(manifest, 1)], [false, true, 2]);
  });
});

describe('the quick-fix\'s fix, built in the project\'s own checkout (12.7.8, 19.5.3, 19.5.18)', () => {
  /** The fix taken into this conversation and its change committed through the door. */
  function commitFix() {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    createFile(dir, 'src/flag.js', 'const flag = \'colour\';\n');
    return ok(dir, ['commit', '--paths', 'src/flag.js', '--task', UNIT, '1.1', '-m', MESSAGE], { env: env() });
  }

  it('the first fix\'s start put the checkout on its branch, laid from the branch it lands on; a later fix of the set is laid on the fix before it, a checkout holding changes not committed refused first, naming them, nothing moved', () => {
    dir = entered();
    const laid = [branchOut(), sha(BRANCH) === sha('main')];
    commitFix();
    createFix(dir, 2, SECOND);
    createFile(dir, 'src/help.js', 'const help = 1;\n');
    const refused = refusedPristine(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).error;
    const unmoved = [branchOut(), fixes()[1].status];
    fs.rmSync(path.join(dir, 'src/help.js'));
    const second = ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).branch;

    assert.deepStrictEqual(laid, [BRANCH, true]);
    assert.strictEqual(refused, `task 1.2 of ${UNIT} is built in the project's own checkout, which holds changes not committed — src/help.js — so it was not put on the fix's branch: commit them or set them aside, then start the fix again`);
    assert.deepStrictEqual(unmoved, [BRANCH, 'open']);
    assert.deepStrictEqual([second, branchOut(), sha(second) === sha(BRANCH)], [taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'fix', SECOND), second, true]);
  });

  it('19.S20: the commit door takes the fix in flight with no plan, the tests and the linters run, the commit naming its task; one on another branch is refused, naming the fix\'s and the start that puts the checkout there (12.9.9)', () => {
    dir = entered();
    environment({ run: { tests: 'true' }, linters: [{ name: 'eslint', command: 'true' }] });
    const res = commitFix();
    git(dir, ['switch', '-q', 'main']);
    createFile(dir, 'src/flag.js', 'const flag = \'colour!\';\n');
    const { error } = refusedPristine(dir, ['commit', '--paths', 'src/flag.js', '--task', UNIT, '1.1', '-m', MESSAGE], { env: env() });

    assert.deepStrictEqual([res.task, res.checks.map(({ name }) => name).sort(), git(dir, ['log', '-1', '--format=%B', BRANCH]).trim()], [`${UNIT}-1-1`, ['eslint', 'tests'], `${MESSAGE}\n\nLeeway-Task: ${UNIT}-1-1`]);
    assert.strictEqual(error, `commit --task: this checkout has main out, not task 1.1 of ${UNIT}'s branch, so its commit would land on another branch — a quick-fix's fix is built in the project's own checkout, on its branch, ${BRANCH} — \`engine task start ${UNIT} 1.1\` puts the checkout on it`);
  });

  it('land open opens the fix\'s pull request with no account, no pair having reviewed it, and task done ends it, owing none (19.5.3, 19.5.7)', () => {
    dir = entered();
    commitFix();
    const opened = ok(dir, ['land', 'open', UNIT, '1.1']);
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });

    assert.deepStrictEqual([opened.task, opened.branch, opened.repos.map(({ repo, base }) => ({ repo, base }))], ['1.1', BRANCH, [{ repo: '.', base: 'main' }]]);
    assert.deepStrictEqual(fixes(), [{ task: '1.1', title: TITLE, status: 'done' }]);
  });

  it('the last of the fixes closed, another done, names no mutation run, there being no phase review (15.6.3)', () => {
    dir = entered();
    environment({ verify: {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true', mutation: 'true',
      ran: { unit: UNIT, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-06-03T09:00:00Z' },
    } });
    createFix(dir, 2, SECOND);
    commitFix();
    ok(dir, ['land', 'open', UNIT, '1.1']);
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    const closed = ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'the help was spelt right already'], { env: env() });

    assert.deepStrictEqual([closed.task, closed.next], ['1.2', undefined]);
  });
});

describe('a raise at the quick-fix\'s place (19.5.3, E5)', () => {
  const { conversation, seals } = raiseHelpers(() => dir, config, CALL);
  const { entries } = ledgerHelpers(() => dir);

  it('is drawn in the conversation, as anywhere else, parking nothing', async () => {
    dir = entered();
    const before = entries().length;
    const { res, sections } = await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked.alias], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.deepStrictEqual([res.decision, res.redrawn, Object.keys(seals() ?? {}).length > 0, entries().length], ['ask', false, true, before]);
    assert.match(sections, new RegExp(`=== MENU: raise — ${res.raise} `));
  });

  it('refuses --parks, there being no builder to park, drawing and writing nothing', async () => {
    dir = entered();
    const before = head(dir);
    const { error } = await refusesAsync(dir, ['raise', PLACE, '--answers', asked.alias, '--parks', '1.1'], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.deepStrictEqual([error, seals(), head(dir)], [
      `raise --parks parks a task in the build, and ${UNIT} is a quick-fix, whose fixes Claude builds in the conversation with no builder to park — raised without --parks, it is drawn here (19.5.3)`,
      null,
      before,
    ]);
  });
});
