'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's work in the build (leeway-engine/scripts/domain/
// build-entry.cjs, its quick-fix arm, chosen where derivations.cjs's
// `quickFixBuild` says): `engine enter implementation <quick-fix>` —
// another session holding the checkout's code stopped at the code gate
// alone, nothing written (12.7.8, 19.5.18); no cut, no ready to build and no
// position, its one phase, the fixes, written into the tracker where it is
// missing and committed, and the tasks in progress put in flight (E4); and
// what it reads: the change, the fixes, the record once written, the
// unit's record, the build's log and the engine. Its fix through the doors
// any task takes (19.S20): the commit door running the tests then the
// linters (12.9.9), `land open` and `task done` owing no account, no pair
// reviewing it (19.5.3, 19.5.15). A raise at its place drawn in the
// conversation, `--parks` refused (19.5.3, E5); the review's fix phases
// numbered past the fixes (P14); and the cut's screens refusing it. The task
// file's rule is test-engine-task-verbs.cjs's, its verify run
// test-engine-verify.cjs's, and a quick-fix today's scoping made
// test-engine-build-entry.cjs's.
//
// Layer: git. World: a quick-fix made through `workunit create` from an
// inbox note, its code committed, and a feature beside it whose code a peer
// may hold; and the same with its fixes written as the entry writes them,
// fix 1.1 created and started by a conversation gone since, a question
// asked at its place and the checkout on the fix's branch — each built once
// and copied. Each test's conversations keep their records in a config
// folder of their own. The separate call is the stub binary, unarmed, so a
// raise's rows are drawn unjudged.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, refusesAsync, refusedPristine, git, stateGit, statePath, layout, writeState, readState, createFile, commitAll, fixtureFrom, cleanupFixture,
  head, lastMessage, readManifest,
} = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { isFixPhase } = require(path.join(SCRIPTS, 'domain/derivations.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { fixPhase } = require(path.join(SCRIPTS, 'domain/review-phase.cjs'));

const UNIT = 'typo';
const PLACE = `${UNIT}.implementation`;
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const DESCRIPTION = 'The --color flag is spelt --colour';
const NOTE = layout.inbox('quickfixes', '2026-06-03--colour-flag.md');
const TITLE = 'Spell the flag --colour';
const BRANCH = taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'fix', TITLE);
const MESSAGE = 'fix(typo): spell the flag --colour';
// A process that runs and is not this suite's.
const PEER = String(process.ppid);

const FIX = [
  `# ${TITLE}`, '', '## Type', 'fix', '', '## Problem', 'The flag reads --color.', '', '## Solution', 'Rename the flag.', '',
  '## Outcome', 'The flag reads --colour.', '', '## Acceptance scenarios', '- 1.S1 Given the help, when it is read, then it names --colour.', '', '## Spec reference', 'none',
].join('\n');

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

/** The quick-fix made from its inbox note, beside a feature, the code committed. @param {string} dir */
function quickFix(dir) {
  createFile(dir, 'src/flag.js', 'const flag = \'color\';\n');
  writeState(dir, NOTE, '# The colour flag\n');
  createManifest(dir, 'other', {});
  commitAll(dir, 'init');
  const log = writeState(dir, layout.cache(UNIT, 'session-001.md'), '# Discovery Session 001\n');
  ok(dir, ['workunit', 'create', UNIT, 'quick-fix', '--description', DESCRIPTION, '--session-log-file', log, '--seed', `.leeway/${NOTE}`]);
}

const fresh = fixtureFrom('quick-fix-', quickFix);

const entered = fixtureFrom('quick-fix-entered-', (dir) => {
  quickFix(dir);
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'the fixes']);
  ok(dir, ['task', 'create', UNIT, '1', '--file', writeState(dir, layout.cache('fix.md'), FIX)]);
  const gone = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-fix-world-'));
  try {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: { LEEWAY_CONFIG_DIR: gone, CLAUDE_CODE_SESSION_ID: 'gone' } });
  } finally {
    fs.rmSync(gone, { recursive: true, force: true });
  }
  asked.alias = ledgerHelpers(() => dir).write('ask', PLACE, [], { ...MADE, text: 'Does --color still work?' }).id;
  git(dir, ['checkout', '-q', '-b', BRANCH]);
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

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/** The entry's DATA, its fixes as `tasks` says them and the record where written. @param {string} tasks @param {boolean} [summary] */
const quickFixData = (tasks, summary = false) => data([
  `change: ${DESCRIPTION}`,
  `seed: ${statePath(dir, layout.unit(UNIT, 'seeds/2026-06-03-colour-flag.md'))}`,
  `tasks: ${tasks}`,
  ...(summary ? [`summary: ${statePath(dir, layout.unit(UNIT, 'summary.md'))}`] : []),
  `record: \`${ENGINE} ledger record ${UNIT}\``,
  `build log: ${statePath(dir, layout.unit(UNIT, 'build/log.md'))}`,
  `engine: \`node ${path.join(SCRIPTS, 'engine.cjs')}\` — the engine by its absolute path, for a call made from a task's worktree`,
]);

/** The fixes as the tracker lists them. */
const fixes = () => ok(dir, ['task', 'list', UNIT, '1']).tasks.map(({ task, title, status }) => ({ task, title, status }));

describe('enter implementation <quick-fix>: its fixes, with no cut, no ready to build and no position (19.5.1, 19.5.4, E4)', () => {
  it('a first entry writes its one phase, the fixes, into the tracker, the tracker committing it, and reads the change, no fix yet, the record\'s call, the build log and the engine', () => {
    dir = fresh();
    const { res, sections } = enter();

    assert.deepStrictEqual([res, lastMessage(dir), fixes()], [
      { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() },
      `task(${UNIT}): write phase 1`,
      [],
    ]);
    assert.strictEqual(sections, quickFixData('none yet'));
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT });
  });

  it('entered again, starts nothing and commits nothing', () => {
    dir = fresh();
    enter();
    const before = head(dir);
    const { res, sections } = enter();

    assert.deepStrictEqual([res, head(dir), sections], [{ ok: true, phase: 'implementation', unit: UNIT, entered: true, started: false }, before, quickFixData('none yet')]);
  });

  it('puts in flight the fix another conversation left in progress, reading each fix by its id, title and where it stands, and its record once written', () => {
    dir = entered();
    writeState(dir, layout.unit(UNIT, 'summary.md'), `## ${TITLE}\n`);
    const { res, sections } = enter();

    assert.deepStrictEqual(res, { ok: true, phase: 'implementation', unit: UNIT, entered: true, started: false });
    assert.strictEqual(sections, quickFixData(`1.1 "${TITLE}" in progress`, true));
    assert.deepStrictEqual(position(), { name: UNIT, phase: 'implementation', topic: UNIT, tasks: [{ task: '1.1', builder: null, reviewers: [] }] });
  });

  it('another session holding the checkout\'s code stops it at the code gate alone, nothing written and the fixes not written; --take enters all the same (12.7.8, 19.5.18)', () => {
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

  it('the review\'s fix phases, asked for at the close, number past the fixes (P14)', () => {
    dir = fresh();
    const manifest = readManifest(dir, UNIT);
    assert.deepStrictEqual([isFixPhase(manifest, 1), isFixPhase(manifest, 2), fixPhase(manifest, 1)], [false, true, 2]);
  });

  it('the screens of a build by its cut refuse it, naming its entry', () => {
    dir = fresh();
    assert.strictEqual(refusedPristine(dir, ['render', 'build-progress', UNIT]).error, `render build-progress: ${UNIT} is a quick-fix, whose fixes have no cut to build by — they are entered at enter implementation ${UNIT}`);
  });
});

describe('the quick-fix\'s fix through the doors any task takes (19.S20, 12.9.9, 19.5.15)', () => {
  /** The file each marking check appends to, out of the code's tree. */
  const marker = () => path.join(dir, '.git', 'checks.log');

  /** A check that marks its name. @param {string} name */
  const marking = (name) => `echo ${name} >> "${marker()}"`;

  /** The fix taken into this conversation and committed through the door. */
  function commitFix() {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    createFile(dir, 'src/flag.js', 'const flag = \'colour\';\n');
    return ok(dir, ['commit', '--paths', 'src/flag.js', '--task', UNIT, '1.1', '-m', MESSAGE], { env: env() });
  }

  it('19.S20: the commit door takes the fix in flight with no plan — its tests, then each linter, run first — the commit naming its task', () => {
    dir = entered();
    const project = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { run: { tests: marking('tests') }, linters: [{ name: 'eslint', command: marking('eslint') }] } }, null, 2));
    const res = commitFix();

    assert.deepStrictEqual([res.task, res.checks, fs.readFileSync(marker(), 'utf8')], [`${UNIT}-1-1`, [{ name: 'tests', exit: 0 }, { name: 'eslint', exit: 0 }], 'tests\neslint\n']);
    assert.strictEqual(git(dir, ['log', '-1', '--format=%B']).trim(), `${MESSAGE}\n\nLeeway-Task: ${UNIT}-1-1`);
  });

  it('land open opens the fix\'s pull request with no account, no pair having reviewed it, and task done ends it, owing none (19.5.3, 19.5.7)', () => {
    dir = entered();
    commitFix();
    const opened = ok(dir, ['land', 'open', UNIT, '1.1']);
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });

    assert.deepStrictEqual([opened.task, opened.branch, opened.repos.map(({ repo, base }) => ({ repo, base }))], ['1.1', BRANCH, [{ repo: '.', base: 'main' }]]);
    assert.deepStrictEqual(fixes(), [{ task: '1.1', title: TITLE, status: 'done' }]);
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
