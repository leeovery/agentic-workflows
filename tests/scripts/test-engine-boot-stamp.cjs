'use strict';

// ---------------------------------------------------------------------------
// Boot's stamp and the refusal until boot has run (22.1.7, 22.1.8, 18.6.8,
// 18.S74; leeway-engine/scripts/domain/boot-stamp.cjs, boot.cjs, and
// `BOOT_EXEMPT` in engine.cjs): boot stamps the calling conversation for the
// project's main checkout at the highest migration installed, beside every
// other project's entry; a command called with a session id refuses,
// writing nothing, until the stamp names its project at that version,
// wherever in the project it is called from — but what the one table lets
// through, every hook boot installs among it, and a call with no session
// id; a capture made from another project's conversation lands, and its
// commit's retry goes through; a boot killed as it stamps leaves the
// conversation refused, and the next boot stamps it.
//
// Layer: verb, with one process test, the boot killed as it stamps. World:
// the project fixture, a git repository with its state worktree and the
// workflows' hooks in its settings, made once per process and copied for
// each test, beside it a second project where a test needs one; each test
// under a system config of its own, every call made in a conversation the
// harness stamps nothing for (`unbooted`); boot runs the repo's real
// scripts.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  call, callAsync, ok, refusedPristine, fixtureFrom, git, commitAll, createFile, stateGit, stampBooted, killedAt,
  failingStateCommits, engineHook, WORKFLOW_HOOKS, GUARD_GROUPS, hooked,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { COMMANDS, BOOT_EXEMPT } = require('../../skills/leeway-engine/scripts/engine.cjs');
const { highestMigration } = require('../../skills/leeway-migrate/scripts/migration-ids.cjs');

const SESSION = 'stamp-session';

/** The refusal, for the project whose main checkout is `main`. @param {string} command @param {string} main */
const refusal = (command, main) => `${command}: this conversation has not booted Leeway for ${main} on this version — invoke the start skill, /leeway, which runs engine boot before anything else`;

/** Whether an answer is the refusal until boot has run. @param {{code: number, stderr: string}} res */
const refusedUnbooted = (res) => res.code === 1 && /has not booted Leeway/.test(res.stderr);

/** A verb that touches work: the brownfield offer's answer, written to the project manifest and committed. */
const WORK = Object.freeze(['brownfield', 'record', 'native']);

/**
 * A project: its state worktree, the workflows' hooks committed in its
 * settings, so boot writes nothing of its own there. Made once per process.
 */
const projectWorld = fixtureFrom('engine-boot-stamp-', (dir) => {
  createFile(dir, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  createFile(dir, 'src/app.js', '// the code\n');
  commitAll(dir, 'init');
});

const folder = useTempFolder('engine-boot-stamp-');

/** @type {string} */ let dir;
/** @type {string} */ let config;
/** @type {Record<string, string>} */ let env;
beforeEach(() => {
  dir = projectWorld(path.join(folder(), 'project'));
  config = fs.mkdtempSync(path.join(folder(), 'config-'));
  env = { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: SESSION };
});

/** The conversation `session`'s folder under this test's config. @param {string} [session] */
const conversation = (session = SESSION) => path.join(config, 'conversations', session);

/** What the conversation `session`'s stamp holds; null where it has none. @param {string} [session] */
function stamps(session = SESSION) {
  const file = path.join(conversation(session), 'booted.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** A second project beside the first, its own main checkout. */
const another = () => projectWorld(path.join(folder(), 'another'));

describe('boot\'s stamp (22.1.7)', () => {
  it('boot stamps the calling conversation for the project\'s main checkout at the highest migration installed, keeping every other project\'s entry', () => {
    createFile(conversation(), 'booted.json', `${JSON.stringify({ '/elsewhere': { migration: '070', at: '2026-01-01T00:00:00.000Z' } })}\n`);
    const before = Date.now();

    const answer = ok(dir, ['boot'], { env, unbooted: true });

    const at = stamps()?.[dir]?.at;
    assert.strictEqual(answer.state, 'ready');
    assert.deepStrictEqual(stamps(), {
      '/elsewhere': { migration: '070', at: '2026-01-01T00:00:00.000Z' },
      [dir]: { migration: highestMigration(), at },
    });
    assert.ok(Date.parse(at) >= before && Date.parse(at) <= Date.now() && new Date(at).toISOString() === at, `stamped at the instant boot ran, as an ISO instant: ${at}`);
  });

  it('boot from a linked worktree stamps the main checkout\'s entry, and a command from the main checkout, a folder inside it and the worktree goes on under it', () => {
    const linked = path.join(folder(), 'linked');
    git(dir, ['worktree', 'add', '-q', '-b', 'side', linked]);

    ok(linked, ['boot'], { env, unbooted: true });

    assert.deepStrictEqual(Object.keys(stamps() ?? {}), [dir]);
    for (const at of [dir, path.join(dir, 'src'), linked]) assert.strictEqual(refusedUnbooted(call(at, WORK, { env, unbooted: true })), false, at);
  });

  it('a stamp from before the installed migration is stale: the command refuses until boot stamps it again', () => {
    stampBooted(dir, SESSION, config);
    const stale = { ...stamps(), [dir]: { ...stamps()[dir], migration: String(Number(highestMigration()) - 1).padStart(3, '0') } };
    createFile(conversation(), 'booted.json', `${JSON.stringify(stale)}\n`);

    assert.strictEqual(refusedPristine(dir, WORK, { env, unbooted: true }).error, refusal('brownfield', dir));

    stampBooted(dir, SESSION, config);
    ok(dir, WORK, { env, unbooted: true });
  });
});

describe('the refusal until boot has run (18.S74)', () => {
  it('a command that touches work refuses in a conversation boot has not run in, naming the start skill and engine boot, writing nothing — the conversation unmarked — and once boot has run, it goes on', () => {
    assert.strictEqual(refusedPristine(dir, WORK, { env, unbooted: true }).error, refusal('brownfield', dir));
    assert.strictEqual(fs.existsSync(conversation()), false, 'the refusal made no folder for the conversation');

    ok(dir, ['boot'], { env, unbooted: true });
    ok(dir, WORK, { env, unbooted: true });
  });

  it('a call with no session id is no conversation\'s, and nothing refuses it', () => {
    ok(dir, WORK, { env: { LEEWAY_CONFIG_DIR: config }, unbooted: true });
  });

  it('a call from a folder in no repository is in no project, with no work to touch and no boot that could stamp it, and nothing refuses it', () => {
    const outside = fs.mkdtempSync(path.join(folder(), 'outside-'));

    assert.strictEqual(ok(outside, ['session', 'label', 'roadmap'], { env, unbooted: true }).ok, true);
  });

  it('one project\'s entry lets nothing through in another: each is refused until its own boot, and both stand once both have booted', () => {
    const other = another();
    stampBooted(other, SESSION, config);

    assert.strictEqual(refusedPristine(dir, WORK, { env, unbooted: true }).error, refusal('brownfield', dir));

    stampBooted(dir, SESSION, config);
    ok(dir, WORK, { env, unbooted: true });
    ok(other, WORK, { env, unbooted: true });
    assert.deepStrictEqual(Object.keys(stamps() ?? {}).sort(), [dir, other].sort());
  });
});

describe('what goes through before boot has run (BOOT_EXEMPT)', () => {
  it('the table names boot and what its stops run, the hooks\' and the gate mod\'s targets, the capture line and its retry, and the walkthrough\'s and help\'s screens — nothing else', () => {
    assert.deepStrictEqual(BOOT_EXEMPT, {
      boot: '*',
      'state-merge': ['pick'],
      render: [
        'git-floor-stop', 'repo-stop', 'state-lost-gate', 'migration-guard-stop', 'state-merge-gate', 'directive-stop', 'migrations-applied', 'migration-gate',
        'walkthrough-offer', 'walkthrough-screen', 'walkthrough-home', 'walkthrough-topics', 'walkthrough-topic', 'help',
      ],
      gate: ['state lost gate', 'state merge gate', 'migration gate'],
      commit: ['--migrations', '--inbox'],
      presence: ['cleanup'],
      session: ['cleanup', 'resume'],
      conversation: '*',
      layout: ['guard'],
      brief: ['guard'],
      shell: ['guard'],
      board: '*',
      inbox: ['capture'],
    });
  });

  it('every command the engine dispatches is refused before boot has run, but each form the table names, which goes through — a commit\'s scope flag wherever it stands, a gate\'s name quoted or not — and a command it does not dispatch is told so', async () => {
    let fresh = 0;
    /** Whether `argv` is refused in a conversation never booted, fresh for each call. @param {string[]} argv */
    const unbooted = async (argv) => refusedUnbooted(await callAsync(dir, argv, { env: { ...env, CLAUDE_CODE_SESSION_ID: `never-booted-${fresh++}` }, stdin: '{}', unbooted: true }));
    /** The calls of `argvs` whose refusal `unbooted` answers as `refused`, each as its words. @param {string[][]} argvs @param {boolean} refused */
    const answering = async (argvs, refused) => {
      /** @type {string[]} */
      const found = [];
      for (const argv of argvs) if ((await unbooted(argv)) === refused) found.push(argv.join(' '));
      return found;
    };
    /** Each call of a form the table lets through. @type {string[][]} */
    const through = Object.entries(BOOT_EXEMPT).flatMap(([command, exempt]) => {
      if (exempt === '*') return [command === 'board' ? [command, SESSION] : command === 'conversation' ? [command, 'position'] : [command]];
      if (command === 'gate') return exempt.flatMap((name) => [[command, name, '--pick', 'y'], [command, ...name.split(' '), '--pick', 'y']]);
      if (command === 'commit') return exempt.flatMap((flag) => [[command, flag, '-m', 'x'], [command, '-m', 'x', flag]]);
      return exempt.map((sub) => [command, sub]);
    });
    const refused = Object.keys(COMMANDS).filter((command) => BOOT_EXEMPT[command] !== '*').map((command) => [command]);

    assert.deepStrictEqual(await answering(refused, false), [], 'every command not wholly let through refuses its other forms');
    assert.deepStrictEqual(await answering(through, true), [], 'each form the table names goes through');
    assert.deepStrictEqual(await answering([['no-such-verb']], true), [], 'an unknown command answers as unknown');
  });

  it('every hook boot installs runs in a conversation boot has not run in, so a fresh conversation\'s first tool call meets no refusal', () => {
    const hooks = [...WORKFLOW_HOOKS, ...GUARD_GROUPS.flatMap((group) => group.hooks), engineHook('session cleanup'), engineHook('session resume')];
    const argvs = hooks.map(({ command }) => command.slice(command.indexOf('engine.cjs" ') + 'engine.cjs" '.length).split(' '));

    assert.deepStrictEqual(argvs.filter((argv) => refusedUnbooted(call(dir, argv, { env, stdin: JSON.stringify({ session_id: SESSION, cwd: dir }), unbooted: true }))).map((argv) => argv.join(' ')), []);
  });
});

describe('a capture from another project\'s conversation (22.1.8, 18.6.8)', () => {
  it('the capture line lands the item in the project it concerns, from a conversation booted in neither', () => {
    const other = another();

    const res = ok(dir, ['inbox', 'capture', 'idea', '--project', other], { env, stdin: '# Retry the sync\n', unbooted: true });

    assert.strictEqual(res.captured, path.join(other, '.leeway', '.inbox/ideas', path.basename(res.captured)));
    assert.strictEqual(fs.readFileSync(res.captured, 'utf8'), '# Retry the sync\n');
    assert.ok(res.committed, 'committed in the project it concerns');
    assert.strictEqual(stamps(), null, 'no boot ran');
  });

  it('a capture whose commit failed is retried by commit --inbox from the project it concerns, in a conversation never booted there', () => {
    const other = another();
    const captured = failingStateCommits(other, () => ok(dir, ['inbox', 'capture', 'idea', '--project', other], { env, stdin: '# Retry the sync\n', unbooted: true }));
    assert.match(String(captured.note), /retry with: engine commit --inbox -m "<message>", run from /);

    const retried = ok(other, ['commit', '--inbox', '-m', 'the retry'], { env, unbooted: true });

    assert.ok(retried.committed, 'the retry committed the capture');
    assert.strictEqual(stateGit(other, ['status', '--porcelain', '--untracked-files=all']), '');
  });
});

describe('a boot killed as it stamps', () => {
  it('leaves the conversation refused, and the next boot stamps it, taking over the lock the killed boot held', () => {
    killedAt({ method: 'renameSync', file: 'booted.json', when: 'before' }, dir, ['boot'], { env, unbooted: true });

    assert.strictEqual(refusedPristine(dir, WORK, { env, unbooted: true }).error, refusal('brownfield', dir));
    ok(dir, ['boot'], { env, unbooted: true });
    ok(dir, WORK, { env, unbooted: true });
  });
});
