'use strict';

// ---------------------------------------------------------------------------
// The migration's commit while the reshape finishes
// (leeway-engine/scripts/domain/migration-commit.cjs, with boot's `finish`
// stop in domain/boot.cjs, `migrate review` in domain/directives.cjs and
// the state branch's first commit in domain/state-worktree.cjs): boot
// answering `finish` with nothing committed, the ledger's copies rendered
// and the records indexed (21.9.1, 21.S24, 21.S47); the yes making the state
// branch's first commit, the layout whole with the held writes, pushed
// where there is a remote, then the code branch's, and the drops going
// from disk once both land (21.9.2, 21.S18, P5); a kill before, between and
// after the two, the next boot answering `finish` and the yes making what
// is left (21.9.5); the refusals, nothing committed (21.9.3); the review's
// read (21.9.4); a project nested in its repository, its commit called
// from a code worktree; the board reading the project meanwhile; and a code
// migration after the reshape handing back its check and notice as today
// (21.10.13, 21.S48). The ordinary `commit --migrations` is
// test-engine-commit-door-state.cjs's.
//
// Layer: git. World: the migration's harness (migration-world.cjs) — the
// engine copied beside the real runner and the fixture migrations, and the
// project waiting on the migration's commit, made once and copied for each
// test; a bare remote where a test gives it one.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, stateGit, statePath, layout, writeState, readState, killedAt, keywordOnlyKnowledge, indexedFiles, bareRepo, remoteTip, cleanupFixture } = harness;
const { createFile, useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, SESSION, ALL_RECORDED, OLD_STORE, OLD_LOCAL, directiveEngine, finishedMigration, nestedFinished, stateUnborn, codeHead, refusedUntouched,
} = require('./migration-world.cjs');
const { legacyProject, real } = require('./boot-world.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, commitFirst } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));

const engine = directiveEngine();
const MESSAGE = 'chore: apply workflow migrations';
const COMMIT = ['commit', '--migrations', '-m', MESSAGE];
const JOURNALS = '.cache/migrate';

// What boot answers where the migration waits on its commit and the runner
// had nothing left to run.
const FINISH = { ok: true, state: 'finish', migrations: { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [], notices: [] }, warnings: [] };
const NOTHING_RAN = { ok: true, state: 'finish', migrations: { changed: false, ran: 0, output: '', verify: [], notices: [] }, warnings: [] };

// What the state branch's first commit holds: the layout the move wrote,
// and the decision the ledger held.
const FIRST_COMMIT = [layout.gitignore, layout.ledger, layout.projectManifest, layout.migrations, layout.manifest(UNIT)].sort();

/** @type {string} */
let dir;
beforeEach(() => { dir = finishedMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-commit-')), 'fumi')); });
afterEach(() => cleanupFixture(path.dirname(dir)));

/** @param {string[]} args @param {string} [at] */
const ok = (args, at = dir) => engine.ok(at, args, { env: SESSION });

/** Whether `rel`, named from the project's folder, is on disk. @param {string} rel */
const onDisk = (rel) => fs.existsSync(path.join(dir, rel));

/** The code commit's parent and its changes. @param {string} at @param {string} [ref] */
const codeCommit = (at, ref = 'HEAD') => {
  const [parent, ...changes] = git(at, ['show', '--name-status', '--format=%P', ref]).split('\n').filter(Boolean);
  return { parent, changes };
};

/** The state branch's commits, each with its parents. */
const stateCommits = () => stateGit(dir, ['rev-list', '--parents', STATE_BRANCH]).trim().split('\n');

describe('the migration waiting on its commit (21.9.1, 21.9.3)', () => {
  it('boot answers finish, every time, committing nothing on either branch', () => {
    const code = codeHead(dir);

    assert.deepStrictEqual([ok(['boot']), ok(['boot'])], [FINISH, FINISH]);

    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir)], [true, code]);
  });

  it('21.S24: boot renders the ledger\'s copies before it answers — the product record holds the entries the records marked product-wide, its file in .knowledge/', () => {
    engine.ok(dir, ['ledger', 'find', `${UNIT}.discussion.search`], {
      env: SESSION, stdin: JSON.stringify({ text: 'Search runs offline.', how: 'read from the discussion\'s map', known: 'read', by: 'claude', who_moved_whom: 'none', product_wide: true }),
    });
    fs.rmSync(statePath(dir, layout.knowledge()), { recursive: true });

    ok(['boot']);

    assert.match(readState(dir, layout.knowledge('product.md')), /^## Finding: Search runs offline\.$/m);
  });

  it('21.S47: boot indexes the records into the checkout\'s store, the store the move left in .workflows/ never read — none of its chunks comes back', () => {
    keywordOnlyKnowledge(dir);
    const old = store.createStore();
    store.insertDocument(old, {
      id: 'old-1', content: 'zebrawindow licensing', heading_path: '', work_unit: UNIT, work_type: 'epic', phase: 'discussion', topic: 'licensing', confidence: 'high', source_file: `${UNIT}/discussion/licensing.md`, timestamp: 1700000000000,
    });
    fs.mkdirSync(path.join(dir, '.workflows/.knowledge'));
    store.saveStore(old, path.join(dir, '.workflows/.knowledge/store.bin'));

    ok(['boot']);

    assert.deepStrictEqual(indexedFiles(dir), [layout.knowledge('records', UNIT, 'licensing.md')]);
  });

  it('the board reads the project meanwhile, the state on no commit yet read as no state lost', () => {
    const board = ok(['board', SESSION.CLAUDE_CODE_SESSION_ID, '--tab', 'all']);

    assert.deepStrictEqual([board.banner.name, board.view.units.map((/** @type {{unit: string}} */ unit) => unit.unit), board.warnings], ['Fumi', [UNIT], []]);
  });

  it('refuses the commit where the migration is not finished — no journal — committing nothing (21.9.3)', () => {
    fs.rmSync(statePath(dir, JOURNALS, 'finish.json'));
    const code = codeHead(dir);

    assert.strictEqual(refusedUntouched(dir, COMMIT), 'the migration is not finished, so nothing is committed before its commit — boot carries it on, and its commit is made at its end');
    assert.strictEqual(codeHead(dir), code);
  });

  it('refuses a file in the state the layout has no place for, committing nothing on either branch, the journal and the drops kept', () => {
    writeState(dir, `${UNIT}/tmp/notes.md`, 'A stray.\n');
    const code = codeHead(dir);

    assert.match(refusedUntouched(dir, COMMIT), /fumi\/tmp\/notes\.md/);
    assert.deepStrictEqual([codeHead(dir), onDisk('.workflows'), fs.existsSync(statePath(dir, JOURNALS, 'finish.json'))], [code, true, true]);
  });
});

describe('the review\'s read (21.9.4)', () => {
  it('answers the state\'s folder and the code side\'s, absolute, and what the summary is written from: the commits the yes makes, the units moved, their topics, the directives done and the code files the commit takes; once committed, the folders alone', () => {
    assert.deepStrictEqual(ok(['migrate', 'review']), {
      ok: true,
      state: statePath(dir),
      code: dir,
      reshape: {
        commits: ['state', 'code'],
        units: 1,
        topics: 3,
        directives: ['079-records', '080-logs', '090-unchecked', '091-shapeless', '092-failing', '093-unanswered'],
        staged: ['.gitignore', '.workflows', OLD_STORE],
      },
    });

    ok(COMMIT);

    assert.deepStrictEqual(ok(['migrate', 'review']), { ok: true, state: statePath(dir), code: dir });
  });
});

describe('the migration\'s commit (21.9.2, 21.9.5)', () => {
  it('21.S18: the yes makes the state branch\'s first commit, the layout whole with the decision the ledger held, then the code branch\'s, dropping .workflows/ and the tracker\'s store and ignoring .leeway/ — and once both land, the drops go from disk with what git ignores in them, and the journals with them', () => {
    const code = codeHead(dir);

    const committed = ok(COMMIT);

    assert.deepStrictEqual(committed, { ok: true, committed: stateGit(dir, ['rev-parse', '--short', STATE_BRANCH]).trim(), code_committed: git(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(stateCommits().length, 1);
    assert.strictEqual(stateCommits()[0].split(' ').length, 1, 'the state branch\'s first commit has no parent');
    assert.deepStrictEqual(stateGit(dir, ['ls-tree', '-r', '--name-only', STATE_BRANCH]).trim().split('\n'), FIRST_COMMIT);
    assert.deepStrictEqual(codeCommit(dir), { parent: code, changes: ['A\t.gitignore', `D\t${OLD_STORE}`, `D\t.workflows/${UNIT}/manifest.json`].sort() });
    assert.deepStrictEqual([onDisk('.workflows'), onDisk(OLD_STORE), onDisk(OLD_LOCAL), onDisk(path.dirname(OLD_STORE)), fs.existsSync(statePath(dir, JOURNALS))], [false, false, false, false, false]);
    assert.deepStrictEqual([git(dir, ['status', '--porcelain']), stateGit(dir, ['status', '--porcelain'])], ['', '']);
    assert.strictEqual(ok(['boot']).state, 'ready');
  });

  it('pushes the state branch\'s first commit where the project has a remote, which holds nothing of it before the yes', () => {
    const remote = bareRepo(path.join(path.dirname(dir), 'remote.git'));
    git(dir, ['remote', 'add', 'origin', remote]);
    git(dir, ['push', '-q', 'origin', 'main']);
    ok(['boot']);

    assert.strictEqual(remoteTip(remote), '', 'nothing pushed before the yes');

    const committed = ok(COMMIT);

    assert.deepStrictEqual([remoteTip(remote), committed.warnings], [stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), undefined]);
  });

  it('a push that fails is a warning: the first commit stands, and the code commit follows', () => {
    git(dir, ['remote', 'add', 'origin', path.join(path.dirname(dir), 'no-remote.git')]);

    const committed = ok(COMMIT);

    assert.deepStrictEqual([committed.warnings.length, typeof committed.code_committed], [1, 'string']);
    assert.match(committed.warnings[0], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: /);
    assert.strictEqual(stateCommits().length, 1);
  });

  it('killed before either commit: nothing committed — boot answers finish again, and the yes makes both', () => {
    const code = codeHead(dir);

    killedAt({ method: 'rmSync', file: 'leeway-commit.index', when: 'after' }, dir, COMMIT, { env: SESSION });

    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir), onDisk('.workflows')], [true, code, true]);
    assert.deepStrictEqual(ok(['boot']), FINISH);
    assert.deepStrictEqual(Object.keys(ok(COMMIT)), ['ok', 'committed', 'code_committed']);
    assert.deepStrictEqual([stateCommits().length, codeCommit(dir).parent], [1, code]);
  });

  it('killed between the two: the state branch born, the code branch untouched — boot answers finish again, running nothing, its gate saying only the code commit remains, and the yes makes the code commit alone', () => {
    const code = codeHead(dir);

    killedAt({ method: 'openSync', file: 'leeway-commit.lock', when: 'before' }, dir, COMMIT, { env: SESSION });
    const first = stateGit(dir, ['rev-parse', STATE_BRANCH]).trim();

    assert.deepStrictEqual([stateCommits().length, codeHead(dir), onDisk('.workflows')], [1, code, true]);
    assert.deepStrictEqual(ok(['boot']), NOTHING_RAN);
    assert.match(engine.output(dir, ['render', 'migration-gate']), /^The state branch's first commit is made: only the code branch's commit remains\.$/m);
    assert.deepStrictEqual(ok(['migrate', 'review']).reshape.commits, ['code']);

    const committed = ok(COMMIT);

    assert.deepStrictEqual(committed, { ok: true, committed: null, code_committed: git(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), codeCommit(dir).parent, onDisk('.workflows')], [first, code, false]);
  });

  it('killed once the code commit lands: boot answers finish again, and the yes commits nothing, taking the drops off disk', () => {
    killedAt({ method: 'rmSync', file: '.workflows', when: 'before' }, dir, COMMIT, { env: SESSION });
    const heads = [stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), codeHead(dir)];

    assert.deepStrictEqual(ok(['boot']), NOTHING_RAN);
    assert.deepStrictEqual(ok(COMMIT), { ok: true, committed: null, note: 'nothing to commit', code_committed: null });

    assert.deepStrictEqual([stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), codeHead(dir)], heads);
    assert.deepStrictEqual([onDisk('.workflows'), onDisk(OLD_STORE), fs.existsSync(statePath(dir, JOURNALS))], [false, false, false]);
  });

  it('the state branch\'s first commit is made on a state branch with no commit alone: on one born it refuses, committing nothing', () => {
    ok(COMMIT);
    const tip = stateGit(dir, ['rev-parse', STATE_BRANCH]).trim();

    assert.throws(() => commitFirst(statePath(dir), MESSAGE), /is not on a leeway-state with no commit yet, so it takes no first commit — nothing committed$/);
    assert.strictEqual(stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), tip);
  });
});

describe('a project nested in its repository, its commit called from a code worktree', () => {
  const folder = useTempFolder('migration-commit-nested-');

  it('takes the drops at its own folder in the main checkout: the code commit on the main checkout\'s branch, the worktree\'s branch and files untouched', () => {
    const app = nestedFinished(path.join(folder(), 'repo'));
    const top = path.dirname(app);
    const code = codeHead(top);
    const tree = path.join(folder(), 'feature');
    git(top, ['worktree', 'add', '-q', '-b', 'feature', tree]);

    assert.strictEqual(ok(['migrate', 'review'], path.join(tree, 'app')).code, app);

    const committed = ok(COMMIT, path.join(tree, 'app'));

    assert.deepStrictEqual(Object.keys(committed), ['ok', 'committed', 'code_committed']);
    assert.deepStrictEqual(codeCommit(top, 'main'), { parent: code, changes: ['A\tapp/.gitignore', `D\tapp/.workflows/${UNIT}/manifest.json`] });
    assert.deepStrictEqual([git(top, ['rev-parse', 'feature']).trim(), fs.existsSync(path.join(app, '.workflows')), fs.existsSync(path.join(tree, 'app/.workflows'))], [code, false, true]);
  });
});

describe('a code migration after the reshape (21.10.13)', () => {
  it('21.S48: run at a boot of the migrated project, hands back its check and its notice once, as today, and its review\'s commit is the ordinary one', () => {
    ok(COMMIT);
    ok(['boot']);
    writeState(dir, layout.migrations, ALL_RECORDED.filter((id) => id !== '094').map((id) => `${id}\n`).join(''));

    const booted = ok(['boot']);

    assert.deepStrictEqual([booted.state, booted.migrations], ['ready', {
      changed: true,
      ran: 1,
      output: '1 migration(s) applied, 1 file(s) updated.',
      verify: [{ id: '094', description: 'ignore the build folder', info: 'Adds the build folder to the project\'s .gitignore.', verify: 'Check the build folder is ignored.' }],
      notices: [{ id: '094', description: 'ignore the build folder', notice: 'The build folder is ignored now.' }],
    }]);

    const code = codeHead(dir);
    ok(COMMIT);

    assert.deepStrictEqual(codeCommit(dir), { parent: code, changes: ['M\t.gitignore'] });
    assert.deepStrictEqual(ok(['boot']).migrations, { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [], notices: [] });
  });
});

describe('the reshape\'s real sequence through its commit (21.S18)', () => {
  const folder = useTempFolder('migration-commit-real-');

  it('a project at 070 with no units, the tracker\'s store beside its .workflows/, boots through the guard, the chain, the move and finish to the migration waiting on its commit, nothing committed; the yes makes the two commits, and the next boot is ready', () => {
    const project = legacyProject(folder());
    const env = { WORKFLOWS_CONFIG_DIR: path.join(folder(), 'no-workflows-config') };
    git(project, ['rm', '-r', '-q', '--', '.workflows/payments']);
    createFile(project, OLD_STORE, '{"id":"a1"}\n');
    git(project, ['add', '--', OLD_STORE]);
    git(project, ['commit', '-q', '-m', 'no units; the tracker\'s store']);
    const code = codeHead(project);

    const booted = real.ok(project, ['boot'], { env });

    assert.deepStrictEqual([booted.state, booted.migrations.changed, stateUnborn(project), codeHead(project)], ['finish', true, true, code]);

    real.ok(project, COMMIT, { env });

    assert.deepStrictEqual(codeCommit(project), {
      parent: code,
      changes: ['A\t.gitignore', `D\t${OLD_STORE}`, 'D\t.workflows/.gitignore', 'D\t.workflows/.state/migrations', 'D\t.workflows/manifest.json'].sort(),
    });
    assert.deepStrictEqual([fs.existsSync(path.join(project, '.workflows')), fs.existsSync(path.join(project, OLD_STORE)), real.ok(project, ['boot'], { env }).state], [false, false, 'ready']);
  });
});
