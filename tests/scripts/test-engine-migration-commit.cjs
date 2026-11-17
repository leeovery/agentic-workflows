'use strict';

// ---------------------------------------------------------------------------
// The migration's commit while the reshape finishes
// (ledger-engine/scripts/domain/migration-commit.cjs, with boot's `finish`
// stop in domain/boot.cjs, `migrate review` in domain/directives.cjs and
// the state branch's first commit in domain/state-worktree.cjs): boot
// answering `finish` with nothing committed and no conversation stamped,
// the review, its gate and the yes going through in one boot never stamped
// (`BOOT_EXEMPT` in engine.cjs), and the environment setup's read and write
// the review's linters check makes there, and nowhere else (`FINISH_EXEMPT`),
// a field write around them refused, the ledger's copies rendered and the
// records indexed (21.9.1, 21.S24, 21.S47 — its other half, the store the
// move left never read, is test-migration-078.cjs's: the knowledge config
// carried, never the store); the yes making the state branch's first
// commit, the layout whole with the held writes and none of the tools'
// sidecars, pushed where there is a remote, then the code branch's, taking
// the drops out through its own index, and the drops going from the
// person's index and disk once both land (21.9.2, 21.S18, P5); a commit of
// the person's own before the yes taking none of the migration's changes,
// one taking `.workflows/` off the code branch by hand leaving the
// migration under way, and a `git add -A` or `git reset` between the stop
// and the yes leaving no drop on the branch; the project folder moved
// meanwhile, boot relinking the state worktree, and the yes refusing,
// nothing committed, where the relink failed, until the next boot relinks
// it, a kill between the relink's writes carried on by the next boot, and a
// copy made meanwhile relinked as its own, the original untouched; a kill
// before and between the two commits, the next boot answering `finish` and
// the yes making what is left, and after the code commit, the next boot
// taking the drops out of the index and off disk itself and answering
// `ready` (21.9.5); the refusals, nothing committed (21.9.3); the review's
// read, once the code commit has landed among it (21.9.4); a project nested
// in its repository, its commit called from a code worktree; the board
// reading the project meanwhile; a code migration after the reshape handing
// back its check and notice as today (21.10.13, 21.S48), and a directive
// after it leaving the migration's row for boot to drop once it reaches the
// work; and, through the real chain, the stop before the move for the checks
// the chain before the guard handed back, stamping no conversation, its
// screen and its record going through without the stamp, the session hooks
// synced from that stop on, labels off, each naming the installed engine, a
// second live session meeting it going no further, the fix made in
// `.workflows/` carried by the move and the check marked made (21.10.13),
// and a directive recorded unrun left out of the review's directives, the move's
// linters check made through the calls it names, the code commit taking the
// settings boot synced, and a linked worktree's first boot after it
// committing its hooks there, each naming the installed engine. The
// ordinary `commit --migrations` is test-engine-commit-door-state.cjs's.
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
const { git, stateGit, statePath, layout, writeState, readState, killedAt, keywordOnlyKnowledge, indexedFiles, bareRepo, remoteTip, cleanupFixture, hooked, LEDGER_HOOKS } = harness;
const { createFile, useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, SESSION, ALL_RECORDED, OLD_STORE, OLD_LOCAL, directiveEngine, finishedMigration, nestedFinished, stateUnborn, codeHead, refusedUntouched,
} = require('./migration-world.cjs');
const { legacyProject, real, LABELS_ON, TODAYS_HOOKS_UNLABELLED, sessionEndAsInstalled } = require('./boot-world.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH, commitFirst } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const engine = directiveEngine();
const MESSAGE = "chore: apply Ledger's migrations";
const COMMIT = ['commit', '--migrations', '-m', MESSAGE];
const JOURNALS = '.cache/migrate';

// What boot answers where the migration waits on its commit and the runner
// had nothing left to run: the start skill's review loaded, then boot again.
const AT_FINISH = { marker: 'Migration', next: { kind: 'load', reference: 'migration-review' } };
const FINISH = { ok: true, state: 'finish', migrations: { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [], notices: [] }, stop: AT_FINISH, warnings: [] };
const NOTHING_RAN = { ok: true, state: 'finish', migrations: { changed: false, ran: 0, output: '', verify: [], notices: [] }, stop: AT_FINISH, warnings: [] };

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

  it('stamps no conversation at the finish stop: in one boot has not stamped, the review, its gate and the yes go through, and so do the environment setup\'s read and write the review\'s linters check makes, which the state branch\'s first commit takes; a field write around them refuses, as does a verb that touches the work, and once the yes has made the commits, so do they', () => {
    const unstamped = { env: { CLAUDE_CODE_SESSION_ID: 'never-stamped' }, unbooted: true };
    const linters = [{ name: 'eslint', command: 'npm run lint' }];
    const record = ['environment', 'set', 'linters'];

    assert.strictEqual(engine.ok(dir, ['boot'], unstamped).state, 'finish');
    assert.deepStrictEqual(engine.ok(dir, ['migrate', 'review'], unstamped).reshape.commits, ['state', 'code']);
    assert.match(engine.output(dir, ['render', 'migration-gate'], unstamped), /^=== MENU: migration gate/m);
    assert.deepStrictEqual(engine.ok(dir, ['environment', 'show'], unstamped).linters, []);
    engine.ok(dir, record, { ...unstamped, stdin: JSON.stringify(linters) });
    assert.match(engine.refuses(dir, ['manifest', 'push', 'project.environment.linters', '{"name": "tsc", "command": "npx tsc"}'], unstamped).error, /has not booted Ledger/);
    assert.match(engine.refuses(dir, ['manifest', 'get', UNIT, 'status'], unstamped).error, /has not booted Ledger/);

    engine.ok(dir, COMMIT, unstamped);

    assert.deepStrictEqual([stateCommits().length, onDisk('.workflows')], [1, false]);
    assert.deepStrictEqual(JSON.parse(stateGit(dir, ['show', `${STATE_BRANCH}:${layout.projectManifest}`])).environment.linters, linters);
    for (const argv of [['environment', 'show'], record]) assert.match(engine.refuses(dir, argv, { ...unstamped, stdin: '[]' }).error, /has not booted Ledger/);
  });

  it('21.S24: boot renders the ledger\'s copies before it answers — the product record holds the entries the records marked product-wide, its file in .knowledge/', () => {
    engine.ok(dir, ['ledger', 'find', `${UNIT}.discussion.search`], {
      env: SESSION, stdin: JSON.stringify({ text: 'Search runs offline.', how: 'read from the discussion\'s map', known: 'read', by: 'claude', who_moved_whom: 'none', product_wide: true }),
    });
    fs.rmSync(statePath(dir, layout.knowledge()), { recursive: true });

    ok(['boot']);

    assert.match(readState(dir, layout.knowledge('product.md')), /^## Finding: Search runs offline\.$/m);
  });

  it('21.S47: boot indexes the records into the checkout\'s store', () => {
    keywordOnlyKnowledge(dir);

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
        directives: ['079-records', '085-logs', '090-unchecked', '091-shapeless', '092-failing', '093-unanswered'],
        files: ['.gitignore', '.workflows', OLD_STORE],
        corrections: [],
      },
    });

    ok(COMMIT);

    assert.deepStrictEqual(ok(['migrate', 'review']), { ok: true, state: statePath(dir), code: dir });
  });
});

describe('the migration\'s commit (21.9.2, 21.9.5)', () => {
  it('21.S18: the yes makes the state branch\'s first commit, the layout whole with the decision the ledger held, then the code branch\'s, dropping .workflows/ and the tracker\'s store and ignoring .ledger/ — and once both land, the drops go from disk with what git ignores in them, and the journals with them', () => {
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

  it('the state branch\'s first commit takes none of the tools\' sidecars in the state, which stay on disk', () => {
    writeState(dir, '.DS_Store', 'Finder\n');
    writeState(dir, `${UNIT}/.notes.md.swp`, 'Vim\n');

    ok(COMMIT);

    assert.deepStrictEqual(stateGit(dir, ['ls-tree', '-r', '--name-only', STATE_BRANCH]).trim().split('\n'), FIRST_COMMIT);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, '.DS_Store')), fs.existsSync(statePath(dir, `${UNIT}/.notes.md.swp`))], [true, true]);
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
    assert.match(committed.warnings[0], /^ledger-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: /);
    assert.strictEqual(stateCommits().length, 1);
  });

  it('killed before either commit: nothing committed — boot answers finish again, and the yes makes both', () => {
    const code = codeHead(dir);

    killedAt({ method: 'rmSync', file: 'ledger-commit.index', when: 'after' }, dir, COMMIT, { env: SESSION });

    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir), onDisk('.workflows')], [true, code, true]);
    assert.deepStrictEqual(ok(['boot']), FINISH);
    assert.deepStrictEqual(Object.keys(ok(COMMIT)), ['ok', 'committed', 'code_committed']);
    assert.deepStrictEqual([stateCommits().length, codeCommit(dir).parent], [1, code]);
  });

  it('killed between the two: the state branch born, the code branch untouched — boot answers finish again, running nothing, its gate saying only the code commit remains, and the yes makes the code commit alone', () => {
    const code = codeHead(dir);

    killedAt({ method: 'openSync', file: 'ledger-commit.lock', when: 'before' }, dir, COMMIT, { env: SESSION });
    const first = stateGit(dir, ['rev-parse', STATE_BRANCH]).trim();

    assert.deepStrictEqual([stateCommits().length, codeHead(dir), onDisk('.workflows')], [1, code, true]);
    assert.deepStrictEqual(ok(['boot']), NOTHING_RAN);
    assert.match(engine.output(dir, ['render', 'migration-gate']), /^The state branch's first commit is made: only the code branch's commit remains\.$/m);
    assert.deepStrictEqual(ok(['migrate', 'review']).reshape.commits, ['code']);

    const committed = ok(COMMIT);

    assert.deepStrictEqual(committed, { ok: true, committed: null, code_committed: git(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), codeCommit(dir).parent, onDisk('.workflows')], [first, code, false]);
  });

  it('killed once the code commit lands, before the drops: the review reads no commit left and no file to take, and boot takes the drops off disk and clears the journals itself, answering ready', () => {
    killedAt({ method: 'rmSync', file: '.workflows', when: 'before' }, dir, COMMIT, { env: SESSION });
    const tip = stateGit(dir, ['rev-parse', STATE_BRANCH]).trim();

    assert.deepStrictEqual(ok(['migrate', 'review']).reshape, { commits: [], units: 1, topics: 3, directives: ['079-records', '085-logs', '090-unchecked', '091-shapeless', '092-failing', '093-unanswered'], files: [], corrections: [] });

    assert.strictEqual(ok(['boot']).state, 'ready');

    assert.strictEqual(stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), tip);
    assert.deepStrictEqual([onDisk('.workflows'), onDisk(OLD_STORE), onDisk(OLD_LOCAL), fs.existsSync(statePath(dir, JOURNALS))], [false, false, false, false]);
  });

  it('killed partway through the drops: boot takes the rest off disk and clears the journals itself, answering ready', () => {
    killedAt({ method: 'rmSync', file: OLD_STORE, when: 'before' }, dir, COMMIT, { env: SESSION });

    assert.deepStrictEqual([onDisk('.workflows'), onDisk(OLD_STORE)], [false, true]);

    assert.strictEqual(ok(['boot']).state, 'ready');

    assert.deepStrictEqual([onDisk(OLD_STORE), onDisk(OLD_LOCAL), onDisk(path.dirname(OLD_STORE)), fs.existsSync(statePath(dir, JOURNALS))], [false, false, false, false]);
  });

  it('killed as the code commit lands, the person\'s index still holding the drops: boot takes them out of it as it takes them off disk, answering ready, and git reads nothing of them', () => {
    const drops = ['.workflows', OLD_STORE];
    killedAt({ method: 'rmSync', file: path.join('.git', 'ledger-commit.index'), when: 'before' }, dir, COMMIT, { env: SESSION });

    assert.deepStrictEqual([git(dir, ['ls-tree', '--name-only', 'HEAD', '--', ...drops]), git(dir, ['diff', '--cached', '--name-only', '--', ...drops]) !== ''], ['', true]);

    assert.strictEqual(ok(['boot']).state, 'ready');

    assert.deepStrictEqual([git(dir, ['ls-files', '--', ...drops]), git(dir, ['status', '--porcelain', '--', ...drops])], ['', '']);
  });

  it('the state branch\'s first commit is made on a state branch with no commit alone: on one born it refuses, committing nothing', () => {
    ok(COMMIT);
    const tip = stateGit(dir, ['rev-parse', STATE_BRANCH]).trim();

    assert.throws(() => commitFirst(statePath(dir), MESSAGE), /is not on a ledger-state with no commit yet, so it takes no first commit — nothing committed$/);
    assert.strictEqual(stateGit(dir, ['rev-parse', STATE_BRANCH]).trim(), tip);
  });
});

describe('the person\'s own git between the finish stop and the yes', () => {
  it('a commit of the person\'s own takes none of the migration\'s changes; boot answers finish after it, and the yes makes both commits over it', () => {
    ok(['boot']);
    createFile(dir, 'src/app.js', 'code\n');
    git(dir, ['add', '--', 'src/app.js']);
    git(dir, ['commit', '-q', '-m', 'my own work']);
    const own = codeHead(dir);

    assert.deepStrictEqual(codeCommit(dir).changes, ['A\tsrc/app.js']);
    assert.deepStrictEqual(ok(['boot']), FINISH);

    ok(COMMIT);

    assert.deepStrictEqual(codeCommit(dir), { parent: own, changes: ['A\t.gitignore', `D\t${OLD_STORE}`, `D\t.workflows/${UNIT}/manifest.json`].sort() });
    assert.deepStrictEqual([stateCommits().length, onDisk('.workflows'), git(dir, ['status', '--porcelain'])], [1, false, '']);
  });

  it('a commit of the person\'s own taking .workflows/ off the code branch by hand leaves the migration under way: every boot answers finish with the handbacks journaled, and the yes makes both commits', () => {
    const notice = { id: '078', description: 'move the project', notice: 'The user-level folder moved.' };
    writeState(dir, `${JOURNALS}/pending-notices.json`, `${JSON.stringify([notice])}\n`);
    git(dir, ['rm', '-r', '-q', '--cached', '--', '.workflows']);
    git(dir, ['commit', '-q', '-m', 'the old state off the branch']);
    const own = codeHead(dir);

    assert.deepStrictEqual([ok(['boot']), ok(['boot'])].map((booted) => [booted.state, booted.migrations.notices]), [['finish', [notice]], ['finish', [notice]]]);

    ok(COMMIT);

    assert.deepStrictEqual(codeCommit(dir), { parent: own, changes: ['A\t.gitignore', `D\t${OLD_STORE}`].sort() });
    assert.deepStrictEqual([stateCommits().length, onDisk('.workflows'), onDisk(OLD_STORE), git(dir, ['status', '--porcelain'])], [1, false, false, '']);
  });

  for (const [what, args] of /** @type {[string, string[]][]} */ ([['git add -A', ['add', '-A']], ['git reset', ['reset', '-q']]])) {
    it(`a ${what} between the stop and the yes: the code commit takes every drop off the branch, and none goes from disk out of step`, () => {
      git(dir, args);

      ok(COMMIT);

      assert.deepStrictEqual(git(dir, ['ls-tree', '--name-only', 'HEAD', '--', '.workflows', OLD_STORE, OLD_LOCAL]), '');
      assert.deepStrictEqual([onDisk('.workflows'), onDisk(OLD_STORE), onDisk(OLD_LOCAL), git(dir, ['status', '--porcelain'])], [false, false, false, '']);
    });
  }
});

describe('the project folder moved while the migration waits on its commit', () => {
  /** The project's folder renamed, its state worktree's links naming where it was. */
  const rename = () => {
    const to = path.join(path.dirname(dir), 'renamed');
    fs.renameSync(dir, to);
    dir = to;
  };

  it('boot relinks the state worktree; the review and the gate read the state branch\'s first commit still owed, and the yes makes both commits', () => {
    rename();
    const code = codeHead(dir);

    assert.strictEqual(ok(['boot']).state, 'finish');
    assert.deepStrictEqual(ok(['migrate', 'review']).reshape.commits, ['state', 'code']);
    assert.doesNotMatch(engine.output(dir, ['render', 'migration-gate']), /first commit is made/);

    ok(COMMIT);

    assert.deepStrictEqual([stateCommits().length, codeCommit(dir).parent, onDisk('.workflows'), git(dir, ['status', '--porcelain'])], [1, code, false, '']);
  });

  it('where boot\'s relink fails, the review still reads the first commit owed, and the yes refuses, committing nothing and taking nothing from disk, naming /ledger as the way on; the next boot relinks it, sweeping the temp file the killed write left, and the yes makes both commits', () => {
    rename();
    killedAt({ method: 'renameSync', file: path.join('.ledger', '.git'), when: 'before' }, dir, ['boot'], { env: SESSION });
    const code = codeHead(dir);

    assert.deepStrictEqual(ok(['migrate', 'review']).reshape.commits, ['state', 'code']);
    assert.match(refusedUntouched(dir, COMMIT), /^git cannot open the state worktree at .+ — nothing committed\. Start \/ledger again: its boot relinks the state worktree where the project folder moved, and the migration gate is drawn again$/);
    assert.deepStrictEqual([codeHead(dir), onDisk('.workflows'), onDisk(OLD_STORE), fs.existsSync(statePath(dir, JOURNALS, 'finish.json'))], [code, true, true, true]);

    assert.strictEqual(ok(['boot']).state, 'finish');
    ok(COMMIT);

    assert.deepStrictEqual([stateCommits().length, codeCommit(dir).parent, onDisk('.workflows'), fs.readdirSync(statePath(dir)).filter((name) => name.startsWith('..git.'))], [1, code, false, []]);
  });

  it('a boot killed between the relink\'s two writes, the folder\'s link rewritten and the registration\'s not: the next boot relinks the rest, the yes makes both commits, and the boot after is ready', () => {
    rename();
    killedAt({ method: 'renameSync', file: path.join('.ledger', '.git'), when: 'after' }, dir, ['boot'], { env: SESSION });

    assert.strictEqual(ok(['boot']).state, 'finish');
    ok(COMMIT);

    assert.deepStrictEqual([stateCommits().length, onDisk('.workflows')], [1, false]);
    assert.strictEqual(ok(['boot']).state, 'ready');
  });

  it('a copy made while the migration waits relinks its state worktree as its own, with a warning naming the original, and finishes; the original is untouched', () => {
    const original = dir;
    const link = fs.readFileSync(statePath(original, '.git'), 'utf8');
    dir = path.join(path.dirname(original), 'copy');
    fs.cpSync(original, dir, { recursive: true });

    assert.deepStrictEqual(ok(['boot']).warnings, [`this project is a copy of ${original}: its state worktree was linked to that project's, and is now this one's own — ${original} is untouched`]);
    ok(COMMIT);

    assert.deepStrictEqual([stateCommits().length, onDisk('.workflows')], [1, false]);
    assert.deepStrictEqual([fs.readFileSync(statePath(original, '.git'), 'utf8'), stateUnborn(original), fs.existsSync(path.join(original, '.workflows'))], [link, true, true]);
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

  it('a directive past the reshape stamps the migration\'s row for the session it stops, where no commit clears it, and boot drops the row once it reaches the work', () => {
    const carrying = { env: { CLAUDE_CODE_SESSION_ID: 'carrying', CLAUDE_PID: String(process.pid) } };
    const row = () => fs.existsSync(statePath(dir, layout.cache('migrate', 'presence')));
    ok(COMMIT);
    writeState(dir, layout.migrations, ALL_RECORDED.filter((id) => id !== '092').map((id) => `${id}\n`).join(''));

    assert.deepStrictEqual([engine.ok(dir, ['boot'], carrying).state, row()], ['directive', true]);

    writeState(dir, layout.migrations, ALL_RECORDED.map((id) => `${id}\n`).join(''));

    assert.deepStrictEqual([engine.ok(dir, ['boot'], carrying).state, row()], ['ready', false]);
  });
});

describe('the reshape\'s real sequence through its commit (21.S18)', () => {
  const folder = useTempFolder('migration-commit-real-');

  it('a project at 070, labels off, whose discussion parks a concern in its triage section stops before the move for 071\'s check, every boot until it is recorded made, stamping no conversation, its session hooks synced from that stop on, uncommitted — the guards live, each hook naming the installed engine; a second live session meeting the stop goes no further, writing nothing, and the environment setup\'s write refuses; the fix made in .workflows/, uncommitted, and recorded in a conversation boot has not stamped, the next boot carries on, marking the check made, and the move carries the fixed files (21.10.13)', () => {
    const project = legacyProject(folder());
    const config = { WORKFLOWS_CONFIG_DIR: path.join(folder(), 'no-workflows-config') };
    const unstamped = { env: { ...config, CLAUDE_CODE_SESSION_ID: 'never-stamped', CLAUDE_PID: String(process.pid) }, unbooted: true };
    const another = { env: { ...config, CLAUDE_CODE_SESSION_ID: 'another', CLAUDE_PID: String(process.ppid) }, unbooted: true };
    const discussion = '.workflows/payments/discussion/payments.md';
    createFile(project, discussion, '# Payments\n\nHow refunds settle.\n\n## Triage\n\n### Refund timing\n\nBilling asks when refunds settle.\n');
    createFile(project, '.claude/settings.json', TODAYS_HOOKS_UNLABELLED);
    git(project, ['commit', '-q', '-am', 'a concern parked in triage; labels off']);

    const stopped = [real.ok(project, ['boot'], unstamped), real.ok(project, ['boot'], unstamped)];

    const atChecks = { marker: 'Migration', surface: 'migration-checks-stop', next: { kind: 'load', reference: 'migration-checks', with: { folder: project } } };
    assert.deepStrictEqual(stopped.map(({ state, folder: at, verify, stop }) => ({ state, at, checks: verify.map((entry) => entry.id), stop })), [1, 2].map(() => ({ state: 'checks', at: project, checks: ['071'], stop: atChecks })));
    assert.match(real.output(project, ['render', atChecks.surface], unstamped), /^⚑ The migration stopped before its move, for checks earlier migrations handed back$/m);
    assert.match(real.refuses(project, ['manifest', 'get', 'payments', 'status'], unstamped).error, /has not booted Ledger/);
    assert.match(real.refuses(project, ['environment', 'set', 'linters'], { ...unstamped, stdin: '[{"name": "eslint", "command": "npm run lint"}]' }).error, /has not booted Ledger/);
    assert.ok(!fs.existsSync(path.join(project, '.ledger/payments')), 'nothing moved yet');
    assert.deepStrictEqual([fs.readFileSync(path.join(project, '.claude/settings.json'), 'utf8'), git(project, ['status', '--porcelain', '--', '.claude']).trim()], [hooked(LEDGER_HOOKS), 'M .claude/settings.json']);
    assert.deepStrictEqual(sessionEndAsInstalled(project, 'ending'), [0, 0]);

    const written = () => [readState(project, layout.migrations), git(project, ['status', '--porcelain', '--', '.workflows'])];
    const before = written();
    const taken = real.ok(project, ['boot'], another);
    const stop = { marker: 'Migration', surface: 'migration-taken-stop', args: ['--at', 'checks', '--active', String(taken.active)], next: null };
    assert.deepStrictEqual(taken, { ok: true, state: 'taken', at: 'checks', active: taken.active, stop, warnings: [] });
    assert.match(real.output(project, ['render', stop.surface, ...stop.args], another), /^> Another session is carrying the migration on from its checks, last active /m);
    assert.deepStrictEqual(written(), before);

    createFile(project, discussion, '# Payments\n\nHow refunds settle.\n\n## Triage\n\n(none)\n');
    createFile(project, '.workflows/payments/discussion/.mailbox/payments/001-refund-timing.md', '### Refund timing\n\nBilling asks when refunds settle.\n');
    assert.deepStrictEqual(real.ok(project, ['migrate', 'checked'], unstamped), { ok: true });

    assert.strictEqual(real.ok(project, ['boot'], unstamped).state, 'directive');
    assert.deepStrictEqual(JSON.parse(readState(project, `${JOURNALS}/pending-verify.json`)).filter((entry) => entry.id === '071').map((entry) => entry.made), [true]);
    assert.match(readState(project, 'payments/topics/payments/log.md'), /^### Triage\n\n\(none\)\n$/m);
    assert.strictEqual(readState(project, 'payments/topics/payments/mail/001-refund-timing.md'), '### Refund timing\n\nBilling asks when refunds settle.\n');
  });

  it('a project at 070 with no units, the tracker\'s store beside its .workflows/ and a linter the move cannot carry, boots through the guard, the chain, the move and finish to the migration waiting on its commit, nothing committed, the linters check made in a conversation boot has not stamped through the calls it names; the yes makes the two commits, the code commit taking the settings boot synced, and the next boot is ready — and a linked worktree\'s, its branch\'s settings as today\'s product left them, commits its session hooks there, each naming the installed engine', () => {
    const project = legacyProject(folder());
    const env = { WORKFLOWS_CONFIG_DIR: path.join(folder(), 'no-workflows-config'), TMUX: undefined };
    const unstamped = { env: { ...env, CLAUDE_CODE_SESSION_ID: 'never-stamped' }, unbooted: true };
    git(project, ['rm', '-r', '-q', '--', '.workflows/payments']);
    createFile(project, OLD_STORE, '{"id":"a1"}\n');
    const manifest = JSON.parse(fs.readFileSync(path.join(project, '.workflows/manifest.json'), 'utf8'));
    createFile(project, '.workflows/manifest.json', JSON.stringify({ ...manifest, defaults: { ...manifest.defaults, linters: [{ name: 'eslint', command: 'npm run lint' }, 42] } }, null, 2) + '\n');
    git(project, ['add', '--', OLD_STORE, '.workflows/manifest.json']);
    git(project, ['commit', '-q', '-m', 'no units; the tracker\'s store; a linter of no shape']);
    const code = codeHead(project);
    const worktree = path.join(folder(), 'feature');
    git(project, ['worktree', 'add', '-q', '-b', 'feature', worktree]);

    const booted = real.ok(project, ['boot'], unstamped);

    assert.deepStrictEqual([booted.state, booted.migrations.changed, stateUnborn(project), codeHead(project)], ['finish', true, true, code]);
    assert.deepStrictEqual(real.ok(project, ['migrate', 'review'], unstamped).reshape.directives, [], 'the records directive found no unit, so no session carried it out');
    const check = /`node \.claude\/skills\/ledger-engine\/scripts\/engine\.cjs (environment show)`.*`node \.claude\/skills\/ledger-engine\/scripts\/engine\.cjs (environment set linters)`, its JSON on stdin/.exec(booted.migrations.verify.map((entry) => entry.verify).join(' '));
    assert.ok(check !== null, 'the check names the calls that make it');
    const { linters } = real.ok(project, check[1].split(' '), unstamped);
    real.ok(project, check[2].split(' '), { ...unstamped, stdin: JSON.stringify([...linters, { name: 'tsc', command: 'npx tsc' }]) });

    real.ok(project, COMMIT, unstamped);

    const committed = codeCommit(project);
    assert.deepStrictEqual({ ...committed, changes: committed.changes.sort() }, {
      parent: code,
      changes: ['M\t.claude/settings.json', 'A\t.gitignore', `D\t${OLD_STORE}`, 'D\t.workflows/.gitignore', 'D\t.workflows/.state/migrations', 'D\t.workflows/manifest.json'].sort(),
    });
    assert.deepStrictEqual(JSON.parse(stateGit(project, ['show', `${STATE_BRANCH}:${layout.projectManifest}`])).environment.linters, [{ name: 'eslint', command: 'npm run lint' }, { name: 'tsc', command: 'npx tsc' }]);
    assert.deepStrictEqual([fs.existsSync(path.join(project, '.workflows')), fs.existsSync(path.join(project, OLD_STORE)), real.ok(project, ['boot'], { env }).state], [false, false, 'ready']);

    assert.strictEqual(real.ok(worktree, ['boot'], { env }).state, 'ready');
    assert.deepStrictEqual([git(worktree, ['log', '-1', '--format=%s']).trim(), git(worktree, ['show', 'HEAD:.claude/settings.json'])], ['chore: install Ledger session hooks', LABELS_ON]);
    assert.deepStrictEqual(sessionEndAsInstalled(worktree, 'ending'), [0, 0, 0]);
  });
});
