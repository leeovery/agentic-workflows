'use strict';

// ---------------------------------------------------------------------------
// A quick-fix built beside the person and the other windows, in a worktree
// of its own (fix-branch.cjs, shell-guard.cjs, finish.cjs): two windows
// each running a quick-fix of its own at once, neither stopped at the code
// gate, each built in its own worktree on its own branch, one closing while
// the other's fix is in flight, both landing; a raw commit in a quick-fix's
// worktree, from another window or its own with no fix in flight, refused
// between its fixes and at its close gate, one in the person's checkout
// passing; the person on a branch of their own with changes not committed
// from the first fix's start to the close, their branch, its tip and what
// git names changed there never moved, the quick-fix's worktree kept out
// of it by the repository's exclude file; the conversation run from a
// worktree of the person's own, on their branch, the quick-fix's worktree
// laid out in the main checkout, and the branch it lands on, out there,
// brought up by the close; under the local landing driver, the close over
// the person's checkout with that branch out and changes the landing
// touches refused, nothing landed and the unit still in progress, then
// landing once the changes are out of the way; and a quick-fix named as a
// reader's scratch is, its worktree apart from that scratch and never
// taken apart by the sweep of its readers (project-layout.cjs,
// `kindName`); a cancel and a move made from inside the quick-fix's
// worktree, where the door's commits leave Claude's shell, each run from
// the project's own checkout and taking the worktree apart under it
// (engine.cjs, `placed`); and the close refused over a conflict with the
// branch it lands on, naming the way on — a one-line task merging that
// branch in the worktree, the merge committed through the door — which the
// shell guard lets through where it refuses a merge that commits, followed
// to the close, made from the worktree, landing. The close over the person's
// changes through a host, standing with their checkout left behind:
// tests/drivers/github/test-landing-quick-fix-pull.cjs.
//
// Layer: git. World: quick-fix-world.cjs's quick-fix and a second beside
// it, made through `workunit create`, under the default landing driver —
// built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  call, ok, okSections, refuses, GIT_TIMEOUT_MS, output, git, createFile, writeState, readManifest, layout, accountTaken, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, BRANCH, DESCRIPTION, SET, quickFix, fixFile, fixTree, createFix, fixChanged, fixBuilt, fixDone, fixesRecorded, recordFile, checklistClosed, onMain,
} = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { quickFixBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { layoutsFolder, layoutFolderName } = require(path.join(SCRIPTS, 'domain/project-layout.cjs'));
const { READERS, readersDone } = require(path.join(SCRIPTS, 'domain/scratch.cjs'));

/** The second quick-fix, built in the other window, and its one fix. */
const OTHER = Object.freeze({ unit: 'tidy', description: 'The readme spells colour the American way', title: 'Spell the readme colour', file: 'README.md', text: '# The project, in colour\n' });
const [FLAG] = SET;
/** What the person has in their checkout, not committed: an edit of the file fix 1.1 changes, and a note of their own. */
const MINE = Object.freeze({ [FLAG.file]: 'const flag = \'mine\';\n', 'notes/mine.md': 'my own note\n' });
/** The shell guard's refusal of a raw commit in typo's worktree. */
const RAW_REFUSED = `a raw git commit is refused here — ${BRANCH} is checked out for ${UNIT}, a quick-fix in progress, whose work goes through the commit door alone: a fix's change with \`engine commit --paths <file>… --task ${UNIT} <task> -m "<message>"\`, anything else from a checkout of your own`;

const world = fixtureFrom('quick-fix-windows-', (dir) => {
  quickFix(dir);
  const log = writeState(dir, layout.cache(OTHER.unit, 'session-001.md'), '# Discovery Session 001\n');
  ok(dir, ['workunit', 'create', OTHER.unit, 'quick-fix', '--description', OTHER.description, '--session-log-file', log]);
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-windows-config-');
const elsewhere = useTempFolder('quick-fix-windows-mine-');

afterEach(() => {
  cleanupFixture(dir);
});

/** A window's conversation, as a call's options: its session and its Claude's process. @param {string} session @param {number} pid */
const window = (session, pid) => ({ env: { LEDGER_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: session, CLAUDE_PID: String(pid), TMUX: undefined, TMUX_PANE: undefined } });
/** The window running typo. */
const one = () => window('sess-1', process.pid);
/** Another window, its Claude another process that runs. */
const two = () => window('sess-2', process.ppid);

/** The quick-fix entered in a window: its sections. @param {string} cwd @param {string} unit @param {{env: Record<string, string|undefined>}} as */
const entered = (cwd, unit, as) => okSections(cwd, ['enter', 'implementation', unit], as).sections;

/** The branch the checkout at `at` has out. @param {string} at */
const branchOut = (at) => git(at, ['branch', '--show-current']).trim();

/** The person's checkout at `at` as they left it: its branch, its tip, what git names changed there and the file fix 1.1 changes. @param {string} at */
const theirs = (at) => [branchOut(at), git(at, ['rev-parse', 'HEAD']).trim(), git(at, ['status', '--porcelain', '--untracked-files=all']), fs.readFileSync(path.join(at, FLAG.file), 'utf8')];

/** The person's changes written in their checkout at `at`. @param {string} at */
const mineWritten = (at) => Object.entries(MINE).forEach(([file, text]) => createFile(at, file, text));

/** A shell command asked of the shell guard from `cwd` in a window: its exit code and what it said. @param {string} cwd @param {string} command @param {{env: Record<string, string|undefined>}} as */
function guarded(cwd, command, as) {
  const { code, stderr } = call(cwd, ['shell', 'guard'], {
    env: as.env,
    stdin: JSON.stringify({ hook_event_name: 'PreToolUse', cwd, session_id: as.env.CLAUDE_CODE_SESSION_ID, tool_name: 'Bash', tool_input: { command } }),
  });
  return { code, said: stderr.trim() };
}

/** A raw `git commit` asked of the shell guard from `cwd` in a window. @param {string} cwd @param {{env: Record<string, string|undefined>}} as */
const rawCommit = (cwd, as) => guarded(cwd, 'git commit -am x', as);

/** The other quick-fix's fix built in window two up to its commit, through the door from its worktree. */
function otherCommitted() {
  ok(dir, ['task', 'create', OTHER.unit, '1', '--file', writeState(dir, layout.cache(`${OTHER.unit}-fix-1.md`), fixFile(1, OTHER.title))], two());
  const started = ok(dir, ['task', 'start', OTHER.unit, '1.1'], two());
  createFile(started.worktree, OTHER.file, OTHER.text);
  ok(started.worktree, ['commit', '--paths', OTHER.file, '--task', OTHER.unit, '1.1', '-m', `fix(${OTHER.unit}): ${OTHER.title.toLowerCase()}`], two());
  return started.worktree;
}

/** The other quick-fix's fix opened, done, recorded and closed in window two. */
function otherClosed() {
  ok(dir, ['land', 'open', OTHER.unit, '1.1'], two());
  accountTaken(dir, OTHER.unit, '1.1');
  ok(dir, ['task', 'done', OTHER.unit, '1.1'], two());
  ok(dir, ['quick-fix', 'record', OTHER.unit, '1.1', '--file', writeState(dir, layout.cache(`${OTHER.unit}-record-1.md`), '## What changed\nThe readme.\n\n## Why\nIt was spelt the American way.\n\n## Leaves out\nNothing.\n')], two());
  writeState(dir, layout.unit(OTHER.unit, 'build', 'log.md'), '# The fixes\n');
  ok(dir, ['checklist', 'done', 'finish', OTHER.unit, 'build-log-closed'], two());
  ok(dir, ['checklist', 'close', 'finish', OTHER.unit], two());
  ok(dir, ['finish', 'yes', OTHER.unit], two());
}

describe('a quick-fix built beside the other windows (12.7.8)', () => {
  it('two windows each run a quick-fix at once, neither stopped at the code gate, each built in a worktree of its own on its own branch; one closes while the other\'s fix is in flight, and both land, each worktree taken apart and the person\'s checkout left on its branch, clean', () => {
    dir = world();
    const entries = [entered(dir, UNIT, one()), entered(dir, OTHER.unit, two())];
    createFix(dir, 1, FLAG.title, one());
    const ours = ok(dir, ['task', 'start', UNIT, '1.1'], one()).worktree;
    const other = otherCommitted();
    const laid = [ours, branchOut(ours), other, branchOut(other)];
    createFile(ours, FLAG.file, FLAG.text);
    ok(ours, ['commit', '--paths', FLAG.file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${FLAG.title.toLowerCase()}`], one());
    ok(dir, ['land', 'open', UNIT, '1.1'], one());
    fixDone(dir, '1.1', one());
    fixesRecorded(dir, 1, one());
    ok(dir, ['finish', 'yes', UNIT], one());
    const otherLeft = [fs.existsSync(other), branchOut(other)];
    otherClosed();

    assert.deepStrictEqual(entries.map((sections) => /=== MENU: code gate /.test(sections)), [false, false]);
    assert.deepStrictEqual(laid, [fixTree(dir), BRANCH, path.join(layoutsFolder(dir), layoutFolderName(OTHER.unit)), quickFixBranch(OTHER.unit)]);
    assert.deepStrictEqual(otherLeft, [true, quickFixBranch(OTHER.unit)]);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, readManifest(dir, OTHER.unit).status, fs.existsSync(ours), fs.existsSync(other)], ['completed', 'completed', false, false]);
    assert.deepStrictEqual([git(dir, ['log', '-2', '--format=%s', 'main']).trim().split('\n'), branchOut(dir), git(dir, ['status', '--porcelain']).trim()], [
      [`fix(${OTHER.unit}): ${OTHER.description}`, `fix(${UNIT}): ${DESCRIPTION}`], 'main', '',
    ]);
  });

  it('a raw commit in its worktree is refused from another window, and from its own with no fix in flight, between its fixes and at its close gate, naming the door; one in the person\'s checkout passes', () => {
    dir = world();
    entered(dir, UNIT, one());
    fixBuilt(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    const asked = () => [rawCommit(fixTree(dir), two()), rawCommit(fixTree(dir), one()), rawCommit(dir, two())];
    const between = asked();
    fixesRecorded(dir, 1, one());
    output(dir, ['render', 'finish', UNIT], one());
    const atTheGate = asked();

    const refused = { code: 2, said: RAW_REFUSED };
    assert.deepStrictEqual([between, atTheGate], [[refused, refused, { code: 0, said: '' }], [refused, refused, { code: 0, said: '' }]]);
  });
});

describe('a quick-fix built beside the person\'s own work, their checkout never moved (19.5.3)', () => {
  it('the person on a branch of their own with changes not committed, one to a file the fix changes: the fix\'s start, its commit, its done and the close leave their branch, its tip and what git names changed there as they were, the quick-fix\'s worktree never among it, the fix landing on the branch it lands on', () => {
    dir = world();
    git(dir, ['switch', '-q', '-c', 'mine']);
    mineWritten(dir);
    const before = theirs(dir);
    const seen = [];
    entered(dir, UNIT, one());
    fixChanged(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    seen.push(theirs(dir));
    ok(dir, ['land', 'open', UNIT, '1.1'], one());
    fixDone(dir, '1.1', one());
    seen.push(theirs(dir));
    fixesRecorded(dir, 1, one());
    ok(dir, ['finish', 'yes', UNIT], one());
    seen.push(theirs(dir));

    assert.deepStrictEqual(seen, [before, before, before]);
    assert.deepStrictEqual([git(dir, ['show', `main:${FLAG.file}`]), readManifest(dir, UNIT).status, fs.existsSync(fixTree(dir))], [FLAG.text, 'completed', false]);
  });

  it('the conversation run from a worktree of the person\'s own, on their branch with changes not committed: the quick-fix\'s worktree is laid out in the main checkout, theirs left as it was, and the close brings the branch it lands on up where the main checkout has it out', () => {
    dir = world();
    const mine = path.join(elsewhere(), 'mine');
    git(dir, ['worktree', 'add', '-q', '-b', 'mine', mine]);
    mineWritten(mine);
    const before = theirs(mine);
    entered(mine, UNIT, one());
    createFix(mine, 1, FLAG.title, one());
    const { worktree } = ok(mine, ['task', 'start', UNIT, '1.1'], one());
    createFile(worktree, FLAG.file, FLAG.text);
    ok(worktree, ['commit', '--paths', FLAG.file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${FLAG.title.toLowerCase()}`], one());
    ok(mine, ['land', 'open', UNIT, '1.1'], one());
    fixDone(mine, '1.1', one());
    fixesRecorded(mine, 1, one());
    ok(mine, ['finish', 'yes', UNIT], one());

    assert.deepStrictEqual([worktree, theirs(mine), fs.existsSync(worktree)], [fixTree(dir), before, false]);
    assert.deepStrictEqual([branchOut(dir), fs.readFileSync(path.join(dir, FLAG.file), 'utf8'), git(dir, ['status', '--porcelain']).trim(), readManifest(dir, UNIT).status], ['main', FLAG.text, '', 'completed']);
  });

  it('under the local landing driver, the close over the person\'s checkout with the branch it lands on out and a change there to a file the landing changes is refused, nothing landed, the unit in progress and its worktree kept; once the change is out of the way, the close lands', () => {
    dir = world();
    entered(dir, UNIT, one());
    fixBuilt(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    createFile(dir, FLAG.file, MINE[FLAG.file]);
    fixesRecorded(dir, 1, one());
    const tip = git(dir, ['rev-parse', 'main']).trim();
    const { error } = refuses(dir, ['finish', 'yes', UNIT], one());
    const stood = [git(dir, ['rev-parse', 'main']).trim(), readManifest(dir, UNIT).status, fs.existsSync(fixTree(dir)), fs.readFileSync(path.join(dir, FLAG.file), 'utf8')];
    git(dir, ['checkout', '--', FLAG.file]);
    ok(dir, ['finish', 'yes', UNIT], one());

    assert.strictEqual(error, `finish yes: land: main is checked out at ${dir}, with changes not committed: ${FLAG.file}, so nothing moved — commit them, or detach your checkout from main with \`git switch --detach\`, which leaves it at ${tip.slice(0, 7)} with its edits, and land again; switching your checkout back to main is yours, when you're ready`);
    assert.deepStrictEqual(stood, [tip, 'in-progress', true, MINE[FLAG.file]]);
    assert.deepStrictEqual([git(dir, ['log', '-1', '--format=%s', 'main']).trim(), fs.readFileSync(path.join(dir, FLAG.file), 'utf8'), readManifest(dir, UNIT).status], [`fix(${UNIT}): ${DESCRIPTION}`, FLAG.text, 'completed']);
  });
});

describe('a cancel and a move made from inside the quick-fix\'s worktree, where its door\'s commits leave Claude\'s shell — its close made there, the conflict\'s below', () => {
  it('a cancel cancels the unit, its worktree taken apart and its branch kept', () => {
    dir = world();
    entered(dir, UNIT, one());
    fixChanged(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    ok(fixTree(dir), ['workunit', 'cancel', UNIT], one());

    assert.deepStrictEqual([readManifest(dir, UNIT).status, fs.existsSync(fixTree(dir)), git(dir, ['show', `${BRANCH}:${FLAG.file}`])], ['cancelled', false, FLAG.text]);
  });

  it('a move\'s yes moves the unit to a feature, its worktree taken apart and its fix\'s work kept on its branch', () => {
    dir = world();
    entered(dir, UNIT, one());
    fixChanged(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    const payload = writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
    ok(fixTree(dir), ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], one());
    const { next } = ok(fixTree(dir), ['gate', 'start this work', '--pick', 'y'], one());
    ok(fixTree(dir), next.argv, one());

    assert.deepStrictEqual([readManifest(dir, UNIT).work_type, fs.existsSync(fixTree(dir)), git(dir, ['show', `moved/${BRANCH}:${FLAG.file}`])], ['feature', false, FLAG.text]);
  });
});

describe('a quick-fix whose branch conflicts at the close with the branch it lands on', () => {
  it('the close is refused, nothing landed, naming the way on — a one-line task merging that branch in the worktree, the merge committed through the door — which the shell guard lets through where it refuses a merge that commits; followed, the close made from the worktree, where that commit left Claude\'s shell, lands the settled change and takes the worktree apart under it', () => {
    dir = world();
    const settled = 'const flag = \'colour\'; // settled\n';
    entered(dir, UNIT, one());
    fixBuilt(dir, 1, FLAG.title, FLAG.file, FLAG.text, one());
    fixesRecorded(dir, 1, one());
    onMain(dir, [{ file: FLAG.file, text: MINE[FLAG.file], subject: 'Spell the flag my way' }]);
    const tip = git(dir, ['rev-parse', 'main']).trim();
    const { error } = refuses(dir, ['finish', 'yes', UNIT], one());
    const stood = [git(dir, ['rev-parse', 'main']).trim(), readManifest(dir, UNIT).status];
    ok(dir, ['task', 'create', UNIT, '1', '--title', 'merge main', '--type', 'chore', '--why', 'a merge of main, its one conflict settled by hand'], one());
    ok(dir, ['task', 'start', UNIT, '1.2'], one());
    const merge = 'git merge --no-ff --no-commit main';
    const asked = [guarded(fixTree(dir), 'git merge main', two()).code, guarded(fixTree(dir), merge, one()).code];
    const merging = spawnSync('git', merge.split(' ').slice(1), { cwd: fixTree(dir), encoding: 'utf8', timeout: GIT_TIMEOUT_MS }).status;
    createFile(fixTree(dir), FLAG.file, settled);
    ok(fixTree(dir), ['commit', '--paths', FLAG.file, '--task', UNIT, '1.2', '-m', `chore(${UNIT}): merge main`], one());
    ok(dir, ['land', 'open', UNIT, '1.2'], one());
    ok(dir, ['task', 'done', UNIT, '1.2'], one());
    ok(dir, ['quick-fix', 'record', UNIT, '1.2', '--file', recordFile(dir, 2, { changed: 'The flag as both spell it.', why: 'Main spelt it another way meanwhile.', leaves: 'Nothing.' })], one());
    checklistClosed(dir, one());
    ok(fixTree(dir), ['finish', 'yes', UNIT], one());

    assert.strictEqual(error, `finish yes: land: ${BRANCH} conflicts with main at ${FLAG.file}, so nothing moved — start a one-line task, "merge main", and in ${UNIT}'s worktree run \`git merge --no-ff --no-commit main\`, settle the conflict, `
      + `then commit the merge through the door, naming each file you settled, which finishes it: \`engine commit --paths <file>… --task ${UNIT} <task> -m "<message>"\`, and land again`);
    assert.deepStrictEqual([stood, asked, merging], [[tip, 'in-progress'], [2, 0], 1]);
    assert.deepStrictEqual([git(dir, ['show', `main:${FLAG.file}`]), readManifest(dir, UNIT).status, git(dir, ['rev-parse', 'main^']).trim(), fs.existsSync(fixTree(dir))], [settled, 'completed', tip, false]);
    assert.deepStrictEqual([branchOut(dir), git(dir, ['status', '--porcelain']).trim()], ['main', '']);
  });
});

describe('a quick-fix\'s worktree beside the engine\'s other layouts', () => {
  it('a quick-fix named as a reader\'s scratch is, scratch-x-tests: its worktree and the scratch of unit x\'s test surface lie apart, and the sweep of x\'s readers takes that scratch apart alone, the worktree kept on the quick-fix\'s branch', () => {
    dir = world();
    const unit = 'scratch-x-tests';
    const log = writeState(dir, layout.cache(unit, 'session-001.md'), '# Discovery Session 001\n');
    ok(dir, ['workunit', 'create', unit, 'quick-fix', '--description', 'A fix named as a scratch is', '--session-log-file', log]);
    entered(dir, unit, one());
    ok(dir, ['task', 'create', unit, '1', '--file', writeState(dir, layout.cache(`${unit}-fix-1.md`), fixFile(1, FLAG.title))], one());
    const { worktree } = ok(dir, ['task', 'start', unit, '1.1'], one());
    const scratch = ok(dir, ['scratch', 'lay', 'x-tests', git(dir, ['rev-parse', 'HEAD']).trim()]).path;

    const swept = readersDone(dir, READERS.unit('x'));

    assert.deepStrictEqual([swept, fs.existsSync(scratch), fs.existsSync(worktree), branchOut(worktree)], [['x-tests'], false, true, quickFixBranch(unit)]);
  });
});
