'use strict';

//
// Tests for migration 074: reshape-guard (.cjs)
//
// The reshape's guard (21.3) driven in process against a git project whose
// `.workflows/` is today's shape, committed: where the reshape is not owed —
// no `.workflows/` on the main checkout's code branch, a `ledger-state` with
// a commit, no repository — it skips, writing nothing; where it is, it
// refuses, writing nothing, while another session holds one of the old
// skills' presence rows — its process still running, by pid and start time,
// or by pid alone where the row has no start time — in the project's folder
// in any checkout, naming the unit, phase and topic of the row written last
// and how long ago, or while `.workflows/` has uncommitted changes, naming
// each path from the project's folder (21.S5, 21.S6); a stale row, the
// calling session's own, a row naming no process, a change to a tool's
// sidecar, which the move never carries, and changes the old state ignores
// or outside it, refuse nothing. On a pass it puts the state worktree in
// place on an unborn `ledger-state`, locked, its `.gitignore` alone in it —
// a plain `.ledger/` set aside and put back inside — and a run killed at
// each of the placement's writes, its `.gitignore` part written among them,
// is finished by the next.
//
// The guard runs as a session in a time zone and locale of its own, the
// rows' start times taken in UTC and the C locale, as the old skills took
// them.
//
// Layer: migration. World: a project on today's layout, made once per
// process and copied for each test; a run killed at a write runs in a child.
// Budget: 6 s — the placement is killed at nine points, each in a child
// process of its own, and the run finished by the next.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { git, initRepo, commitCode, createFile, folderFrom, withEnv, cleanupFixture } = require('./engine-harness.cjs');
const GUARD = require.resolve('../../skills/ledger-migrate/scripts/migrations/074-reshape-guard.cjs');
const MIGRATION = require(GUARD);
const { migrationRuns } = require('../../skills/ledger-engine/scripts/domain/state-worktree.cjs');

const STATE = '.ledger';
const SET_ASIDE = '.ledger-set-aside';
const LOCK_REASON = 'Ledger state, do not remove';
const STATE_GITIGNORE = '/.knowledge/\n/.cache/\n/.lock\n/.lock.*\n.manifest.json.*.tmp\n/.ledger.jsonl.*.tmp\n';
const NOW = Date.parse('2026-11-13T12:00:00Z');

/** The calling session, in a time zone and locale of its own: the rows' start times are UTC's and the C locale's all the same. */
const THIS_SESSION = { CLAUDE_CODE_SESSION_ID: 'this-session', CLAUDE_PID: undefined, TZ: 'Asia/Tokyo', LANG: 'en_GB.UTF-8', LC_ALL: undefined, LC_TIME: undefined };

/** A process's start time as the old skills recorded it: `ps`, in UTC and the C locale. @param {number} pid */
const startOf = (pid) => execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } }).trim();

/** The row another session, this live process, keeps. */
const LIVE = { pid: process.pid, pid_start: startOf(process.pid), session_id: 'another-session' };

/**
 * Fumi on today's layout: `.workflows/` committed on `main`, its cache
 * ignored by its own `.gitignore`, and no state branch.
 */
const fumiWorld = folderFrom('migration-074-', (folder) => {
  const main = initRepo(path.join(folder, 'fumi'));
  createFile(main, 'README.md', '# Fumi\n');
  createFile(main, '.workflows/.gitignore', '.cache/\n');
  createFile(main, '.workflows/fumi/manifest.json', '{"name":"fumi","work_type":"epic"}\n');
  commitCode(main, 'the old layout');
});

/** @type {string} */
let world;
/** @type {string} */
let main;
beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-074-')));
  main = path.join(fumiWorld(world), 'fumi');
});
afterEach(() => cleanupFixture(world));

/**
 * The guard run in process over `dir`, as the calling session: what it
 * reported, or the facts of its refusal.
 * @param {string} dir @param {Record<string, string|undefined>} [env]
 */
function guard(dir, env = THIS_SESSION) {
  const reported = { updates: 0, skips: 0 };
  try {
    withEnv(env, () => MIGRATION.run({ projectDir: dir, reportUpdate: () => { reported.updates += 1; }, reportSkip: () => { reported.skips += 1; } }));
  } catch (err) {
    if (!(err instanceof Error) || !('refused' in err)) throw err;
    return { refused: err.refused };
  }
  return reported;
}

/**
 * A presence row of the old skills at `{unit}/{phase}/{topic}` in the cache
 * of `.workflows/` in `dir`, last written `ago` seconds before NOW.
 * @param {string} dir @param {string} at @param {unknown} row @param {number} [ago]
 */
function presence(dir, at, row, ago = 0) {
  const file = path.join(dir, '.workflows/.cache', at, 'presence');
  createFile(path.dirname(file), 'presence', typeof row === 'string' ? row : JSON.stringify(row));
  const when = new Date(NOW - ago * 1000);
  fs.utimesSync(file, when, when);
}

/** What a run that writes nothing leaves as it was: the repository's refs and checkouts, and the project's folder. @param {string} dir */
function untouched(dir) {
  const top = git(dir, ['rev-parse', '--show-toplevel']).trim();
  return {
    refs: git(dir, ['for-each-ref']),
    worktrees: git(dir, ['worktree', 'list', '--porcelain']),
    folders: fs.readdirSync(top).sort(),
    status: git(dir, ['status', '--porcelain', '--ignored']),
  };
}

/** The state worktree at `root` as git registers it, and what its folder holds. @param {string} top @param {string} root */
function placed(top, root) {
  const entry = git(top, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${root}\n`)) ?? '';
  return {
    registered: entry.split('\n').filter((line) => !line.startsWith('HEAD ')),
    unborn: migrationRuns(root),
    holds: fs.readdirSync(root).sort(),
    gitignore: fs.readFileSync(path.join(root, '.gitignore'), 'utf8'),
  };
}

/** The state worktree as the guard puts it in place at `root`, holding `others` beside its own files. @param {string} root @param {string[]} [others] */
const IN_PLACE = (root, others = []) => ({
  registered: [`worktree ${root}`, 'branch refs/heads/ledger-state', `locked ${LOCK_REASON}`],
  unborn: true,
  holds: ['.git', '.gitignore', ...others].sort(),
  gitignore: STATE_GITIGNORE,
});

describe('migration 074: the reshape\'s guard', () => {
  describe('where the reshape is not owed', () => {
    it('skips a project with no .workflows/ on its code branch — one on disk alone, uncommitted, included — writing nothing', () => {
      const bare = initRepo(path.join(world, 'shop'));
      createFile(bare, 'README.md', '# Shop\n');
      commitCode(bare, 'code');
      createFile(bare, '.workflows/scratch.md', 'never committed\n');
      const before = untouched(bare);

      assert.deepStrictEqual(guard(bare), { updates: 0, skips: 1 });
      assert.deepStrictEqual(untouched(bare), before);
    });

    it('skips a project whose ledger-state has a commit, and a folder in no repository, writing nothing', () => {
      git(main, ['update-ref', 'refs/heads/ledger-state', git(main, ['commit-tree', '-m', 'state', 'HEAD^{tree}']).trim()]);
      const before = untouched(main);
      const loose = fs.mkdtempSync(path.join(world, 'loose-'));

      assert.deepStrictEqual([guard(main), guard(loose)], [{ updates: 0, skips: 1 }, { updates: 0, skips: 1 }]);
      assert.deepStrictEqual(untouched(main), before);
      assert.deepStrictEqual(fs.readdirSync(loose), []);
    });
  });

  describe('another session live in the project (21.3.1, 21.3.3, 21.S5)', () => {
    it('refuses while another session\'s process runs, by its pid and start time, naming the unit, phase and topic of its row and how long ago it was written — writing nothing', (t) => {
      t.mock.method(Date, 'now', () => NOW);
      presence(main, 'fumi/discussion/licensing', LIVE, 180);
      const before = untouched(main);

      assert.deepStrictEqual(guard(main), { refused: { cause: 'live', unit: 'fumi', phase: 'discussion', topic: 'licensing', active: 180, paths: null } });
      assert.deepStrictEqual(untouched(main), before);
    });

    it('refuses on a row with no start time while its pid runs, and names the row written last, in whichever checkout of the repository it was kept', (t) => {
      t.mock.method(Date, 'now', () => NOW);
      presence(main, 'fumi/discussion/licensing', { pid: process.pid, session_id: 'another-session' }, 600);

      assert.deepStrictEqual(guard(main), { refused: { cause: 'live', unit: 'fumi', phase: 'discussion', topic: 'licensing', active: 600, paths: null } });

      const linked = path.join(world, 'fumi-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);
      presence(linked, 'fumi/specification/search', LIVE, 42);
      presence(main, 'fumi/research/onboarding', LIVE, 3600);

      assert.deepStrictEqual(guard(main), { refused: { cause: 'live', unit: 'fumi', phase: 'specification', topic: 'search', active: 42, paths: null } });
    });

    it('reads a nested project\'s rows from its own folder, never another project\'s in the repository', (t) => {
      t.mock.method(Date, 'now', () => NOW);
      const mono = initRepo(path.join(world, 'mono'));
      createFile(mono, 'app/.workflows/app/manifest.json', '{"name":"app"}\n');
      createFile(mono, 'site/.workflows/site/manifest.json', '{"name":"site"}\n');
      createFile(mono, '.gitignore', '.cache/\n');
      commitCode(mono, 'two projects');
      presence(path.join(mono, 'site'), 'site/discussion/site', LIVE, 5);

      assert.strictEqual('refused' in guard(path.join(mono, 'app')), false, 'the other project\'s session refuses nothing');

      presence(path.join(mono, 'app'), 'app/discussion/app', LIVE, 7);
      assert.deepStrictEqual(guard(path.join(mono, 'app')), { refused: { cause: 'live', unit: 'app', phase: 'discussion', topic: 'app', active: 7, paths: null } });
    });

    it('passes over a stale row — its process gone, or another now holding its pid — the calling session\'s own, by its session or its process, a row naming no process, and one that does not read', () => {
      const gone = spawnSync(process.execPath, ['-e', '']).pid;
      presence(main, 'fumi/discussion/licensing', { pid: gone, pid_start: LIVE.pid_start, session_id: 'gone' });
      presence(main, 'fumi/discussion/search', { pid: gone, session_id: 'gone' });
      presence(main, 'fumi/discussion/onboarding', { ...LIVE, pid_start: 'Thu Jan  1 00:00:00 1970' });
      presence(main, 'fumi/discussion/pricing', { ...LIVE, session_id: 'this-session' });
      presence(main, 'fumi/discussion/billing', { session_id: 'another-session' });
      presence(main, 'fumi/discussion/support', 'not a row');

      assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
      presence(main, 'fumi/discussion/pricing', { ...LIVE, session_id: 'a session of its own' });
      assert.deepStrictEqual(guard(main, { ...THIS_SESSION, CLAUDE_CODE_SESSION_ID: undefined, CLAUDE_PID: String(process.pid) }), { updates: 1, skips: 0 }, 'the calling process\'s own row');
    });
  });

  describe('uncommitted changes under .workflows/ (21.3.2, 21.S6)', () => {
    /** The guard's refusal over uncommitted changes, naming `paths`. @param {string[]} paths */
    const dirty = (paths) => ({ refused: { cause: 'dirty', unit: null, phase: null, topic: null, active: null, paths } });

    it('refuses over a change to a tracked file, and over files git does not track, naming each path from the project\'s folder, an untracked folder\'s by each file in it and a rename by both its paths, so one to a sidecar\'s name is named by its source, writing nothing', () => {
      for (const [change, paths] of /** @type {[() => void, string[]][]} */ ([
        [() => createFile(main, '.workflows/fumi/manifest.json', '{"name":"fumi","work_type":"feature"}\n'), ['.workflows/fumi/manifest.json']],
        [() => {
          createFile(main, '.workflows/fumi/discussion/new.md', '# New\n');
          createFile(main, '.workflows/fumi/discussion/notes/one.md', '# One\n');
        }, ['.workflows/fumi/discussion/new.md', '.workflows/fumi/discussion/notes/one.md']],
        [() => git(main, ['mv', '.workflows/fumi/manifest.json', '.workflows/fumi/moved.json']), ['.workflows/fumi/manifest.json', '.workflows/fumi/moved.json']],
        [() => git(main, ['mv', '.workflows/fumi/manifest.json', '.workflows/fumi/.DS_Store']), ['.workflows/fumi/manifest.json']],
      ])) {
        git(main, ['reset', '-q']);
        git(main, ['checkout', '-q', '--', '.workflows']);
        git(main, ['clean', '-q', '-fd', '--', '.workflows']);
        change();
        const before = untouched(main);

        assert.deepStrictEqual(guard(main), dirty(paths));
        assert.deepStrictEqual(untouched(main), before);
      }
      assert.throws(() => withEnv(THIS_SESSION, () => MIGRATION.run({ projectDir: main, reportUpdate() {}, reportSkip() {} })), {
        message: 'the reshape\'s guard refused: .workflows/ has uncommitted changes: .workflows/fumi/manifest.json',
      });
    });

    it('names a nested project\'s paths from its own folder', () => {
      const mono = initRepo(path.join(world, 'mono'));
      createFile(mono, 'app/.workflows/app/manifest.json', '{"name":"app"}\n');
      commitCode(mono, 'a nested project');
      createFile(mono, 'app/.workflows/app/new.md', '# New\n');

      assert.deepStrictEqual(guard(path.join(mono, 'app')), dirty(['.workflows/app/new.md']));
    });

    it('passes over the files the person\'s tools leave beside theirs, a .DS_Store tracked or not, which the move never carries, naming only the change beside them', () => {
      createFile(main, '.workflows/fumi/.DS_Store', 'tracked\n');
      commitCode(main, 'a sidecar committed');
      createFile(main, '.workflows/fumi/.DS_Store', 'changed\n');
      createFile(main, '.workflows/.DS_Store', 'untracked\n');
      createFile(main, '.workflows/fumi/discussion/.DS_Store', 'in a folder of its own\n');
      createFile(main, '.workflows/fumi/discussion/new.md', '# New\n');

      assert.deepStrictEqual(guard(main), dirty(['.workflows/fumi/discussion/new.md']));

      fs.rmSync(path.join(main, '.workflows/fumi/discussion/new.md'));

      assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
    });

    it('passes over what the old state ignores, and over changes outside it', () => {
      createFile(main, '.workflows/.cache/fumi/scratch.md', 'scratch\n');
      createFile(main, 'README.md', '# Fumi, edited\n');

      assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
    });
  });

  describe('a pass: the state in place (21.2.1, E1)', () => {
    it('puts the state worktree at .ledger/ on an unborn ledger-state, locked, its .gitignore alone in it — the code branch and .workflows/ as they were — and finds it there when run again', () => {
      const before = { refs: git(main, ['for-each-ref']), head: git(main, ['rev-parse', 'HEAD']), workflows: git(main, ['status', '--porcelain', '--', '.workflows']) };
      const root = path.join(main, STATE);

      assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
      assert.deepStrictEqual(placed(main, root), IN_PLACE(root));
      assert.deepStrictEqual({ refs: git(main, ['for-each-ref']), head: git(main, ['rev-parse', 'HEAD']), workflows: git(main, ['status', '--porcelain', '--', '.workflows']) }, before);

      assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
      assert.deepStrictEqual(placed(main, root), IN_PLACE(root));
    });

    it('sets a plain .ledger/ aside while the worktree is added, and puts what it held back inside', () => {
      createFile(main, `${STATE}/.knowledge/config.json`, '{}\n');
      const root = path.join(main, STATE);

      guard(main);

      assert.deepStrictEqual(placed(main, root), IN_PLACE(root, ['.knowledge']));
      assert.strictEqual(fs.readFileSync(path.join(root, '.knowledge/config.json'), 'utf8'), '{}\n');
      assert.ok(!fs.existsSync(path.join(main, SET_ASIDE)));
    });
  });

  describe('a run killed at each of the placement\'s writes, finished by the next', () => {
    // The guard in a child that exits, status 9, at one of its file calls —
    // `method` on a path ending `file`, a rename by its destination —
    // `before` or `after` it runs, `mid` a write with part of it written, or
    // as one of its git commands finishes.
    const KILLED = [
      'const [method, file, when, dir] = process.argv.slice(1);',
      "const fs = require('fs');",
      "if (method !== '-') {",
      '  const real = fs[method];',
      "  const hits = (a) => String(a[method === 'renameSync' ? 1 : 0]).endsWith(file);",
      "  fs[method] = (...a) => { if (when === 'before' && hits(a)) process.exit(9); if (when === 'mid' && hits(a)) { real.call(fs, a[0], String(a[1]).slice(0, 9)); process.exit(9); } const done = real.apply(fs, a); if (when === 'after' && hits(a)) process.exit(9); return done; };",
      '}',
      `require(${JSON.stringify(GUARD)}).run({ projectDir: dir, reportUpdate() {}, reportSkip() {} });`,
    ].join('\n');

    /** A git on the PATH that kills its caller once a command naming `args` has run. @param {string} args */
    function killingGit(args) {
      const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
      const bin = fs.mkdtempSync(path.join(world, 'git-'));
      createFile(bin, 'git', `#!/bin/sh\n"${real}" "$@"\nstatus=$?\ncase "$*" in *"${args}"*) kill -9 "$PPID" ;; esac\nexit $status\n`);
      fs.chmodSync(path.join(bin, 'git'), 0o755);
      return `${bin}:${process.env.PATH}`;
    }

    /** @typedef {{method?: string, file?: string, when?: 'before'|'after'|'mid', git?: string}} KillPoint */

    /** @param {KillPoint} at */
    const named = ({ method, file, when = 'after', git: args }) => (args === undefined ? `${when} ${method} ${file}` : `after git ${args}`);

    /** @param {KillPoint} at */
    function killedAt(at) {
      const { method = '-', file = '', when = 'after', git: args } = at;
      const env = { ...process.env, ...(args === undefined ? {} : { PATH: killingGit(args) }) };
      const run = spawnSync(process.execPath, ['-e', KILLED, method, file, when, main], { cwd: main, env, encoding: 'utf8' });
      assert.ok(run.status === 9 || run.signal === 'SIGKILL', `the guard was not killed ${named(at)}: ${run.stderr}`);
    }

    for (const at of /** @type {KillPoint[]} */ ([
      { git: 'worktree add' },
      { git: 'switch' },
      { git: 'worktree lock' },
      { method: 'writeFileSync', file: '.gitignore', when: 'mid' },
      { method: 'renameSync', file: `${STATE}/.gitignore`, when: 'before' },
    ])) {
      it(`killed ${named(at)}`, () => {
        const root = path.join(main, STATE);

        killedAt(at);

        assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
        assert.deepStrictEqual(placed(main, root), IN_PLACE(root));
      });
    }

    for (const at of /** @type {KillPoint[]} */ ([
      { method: 'renameSync', file: SET_ASIDE },
      { git: 'worktree add' },
      { method: 'renameSync', file: `${STATE}/a.md` },
      { method: 'rmdirSync', file: SET_ASIDE },
    ])) {
      it(`over a plain .ledger/, killed ${named(at)}`, () => {
        const root = path.join(main, STATE);
        createFile(main, `${STATE}/a.md`, 'a\n');
        createFile(main, `${STATE}/b.md`, 'b\n');

        killedAt(at);

        assert.deepStrictEqual(guard(main), { updates: 1, skips: 0 });
        assert.deepStrictEqual(placed(main, root), IN_PLACE(root, ['a.md', 'b.md']));
        assert.deepStrictEqual(['a.md', 'b.md'].map((name) => fs.readFileSync(path.join(root, name), 'utf8')), ['a\n', 'b\n']);
        assert.ok(!fs.existsSync(path.join(main, SET_ASIDE)));
      });
    }
  });
});
