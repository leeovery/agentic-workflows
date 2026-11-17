'use strict';

// ---------------------------------------------------------------------------
// The migration's directives (21.10): a directive's head, linted over every
// directive the migrations hold (21.S34; the format is the header of
// ledger-migrate/scripts/migrate.cjs, the lint directive-lint.cjs); `engine
// migrate check`, its check run (domain/directives.cjs); `engine migrate
// checked`, the checks before the reshape's move recorded made; its checklist,
// whose one item is the check, the engine's, and whose close records the
// directive (domain/checklist.cjs; 6.4.11, 21.S36); boot's stop at a
// directive not yet done, and past it once it is, one start meeting several,
// at one whose every piece is done, and at one whose check fails on what a
// session left, the runner recording one whose check answers no piece
// unrun, its unrun line beside it (domain/boot.cjs; 21.4.3, 21.10.9,
// 21.10.10, 21.S37, and the machinery of 21.S33, which 29.17 proves on the
// real sequence); a second session meeting a directive another live
// session carries on, stopping there, and carrying it on once that one's
// row at the migration's place is gone or stale, and `migrate checked`
// re-stamping only that one's row (domain/presence.cjs; P7); the stop's
// screen, this session carrying the step on, and the taken stop's, another
// carrying the step on, a directive or the checks before the move
// (21.10.11); and, while the migration
// runs, a verb's commit held, held to the layout all the same (21.9.3), and
// nothing told the trust log (21.1.5). The runner's side is
// test-migration-orchestrator.cjs's.
//
// Layer: verb, boot spawning the runner. World: the migration's harness
// (migration-world.cjs) — the engine copied beside the real runner and the
// fixture directives, and a project the migration is under way in, made
// once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { git, statePath, layout, readState, writeState, cleanupFixture, ledgerEntries, holdLock, lockAttempts } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { headProblems, modelProblems, briefedProblems, lintDirectives } = require('./directive-lint.cjs');
const {
  UNIT, SESSION, RECORDED, FIXTURES, directiveEngine, midMigration, stateUnborn, codeHead, enter, enterTopic, refusedUntouched, recorded,
} = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const MIGRATIONS = path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations');
const { TRUST_LOG, PENDING } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { directiveStop } = require(path.join(SCRIPTS, 'domain/projections/boot.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));

const engine = directiveEngine();
const RECORDS = '079-records';
const LOGS = '085-logs';
const FAILING = '092-failing';
const TOPICS = { one: 'topic', many: 'topics' };

// Each test's project is Fumi, the name the stop's screen says.
/** @type {string} */
let dir;
beforeEach(() => { dir = midMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-directives-')), 'fumi')); });
afterEach(() => cleanupFixture(path.dirname(dir)));

/** @param {string[]} args */
const ok = (args) => engine.ok(dir, args, { env: SESSION });

/** The fixture records directive's check run. */
const checked = () => ok(['migrate', 'check', RECORDS]);

describe('a directive\'s head (21.S34)', () => {
  it('every directive the migrations hold opens on its title, then the files it may touch and what it asks the person, each a list, with its check beside it — the lint naming what any lacks', () => {
    assert.deepStrictEqual(lintDirectives(MIGRATIONS), []);
    assert.deepStrictEqual(lintDirectives(FIXTURES), [
      '090-unchecked.md: no check sits beside it',
      '091-shapeless.md: its check exports no check() beside what it counts',
    ]);
  });

  it('a head with no title, either list missing, empty, out of order or holding more than its list is refused', () => {
    const head = (/** @type {string} */ touches, /** @type {string} */ asks) => `# Records\n\n${touches}\n\n${asks}\n\n## Instructions\n\nCarry it out.\n`;
    const TOUCHES = '## Touches\n\n- The ledger.';
    const ASKS = '## Asks\n\n- Nothing.';
    assert.deepStrictEqual([
      headProblems(head(TOUCHES, ASKS)),
      headProblems(head('## Touches\n\n- The ledger, through\n  `ledger find`.\n- Each topic\'s log.', ASKS)),
      headProblems(head(TOUCHES, ASKS).replace('# Records\n\n', '')),
      headProblems(head(TOUCHES, '')),
      headProblems(head(ASKS, TOUCHES)),
      headProblems(head('## Touches', ASKS)),
      headProblems(head(TOUCHES, `${ASKS}\nAnd anything else it judges fit.`)),
    ], [
      [],
      [],
      ['it opens on no title', 'its head\'s first section is not ## Touches', 'its head\'s second section is not ## Asks'],
      ['its head\'s second section is not ## Asks'],
      ['its head\'s first section is not ## Touches', 'its head\'s second section is not ## Asks'],
      ['## Touches lists nothing'],
      ['## Asks holds more than its list'],
    ]);
  });
});

describe('the sections a directive\'s agents\' briefs draw (21.10.5)', () => {
  it('each a heading the directive holds, with what nests beneath it, none calling the engine; a check naming none has none to lint', () => {
    const text = '# Records\n\n## The Record\n\nCompose it.\n\n### Its Shape\n\nOne object.\n\n## Carrying\n\n```bash\nnode .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {place}\n```\n';
    assert.deepStrictEqual([
      briefedProblems(text, undefined),
      briefedProblems(text, ['The Record']),
      briefedProblems(text, ['Its Shape', 'The Record']),
      briefedProblems(text, []),
      briefedProblems(text, ['The Records']),
      briefedProblems(text, ['Carrying']),
    ], [
      [],
      [],
      [],
      ['the directive\'s check names no section its agents\' briefs draw — briefed, a list of its headings'],
      ['the directive heads no section "The Records", which its check names briefed'],
      ['its section Carrying, which its agents\' briefs draw, calls the engine — the session\'s work'],
    ]);
  });
});

describe('a directive names no model or effort (21.10.5)', () => {
  it('a directive naming a model or an effort is refused, an agent\'s definition fixing its own', () => {
    assert.deepStrictEqual([
      modelProblems('Dispatch each brief\'s agent with its pointer alone.'),
      modelProblems('Dispatch the agent on Opus.'),
      modelProblems('Run it at high effort.'),
      modelProblems('Pick the model that fits.'),
    ], [
      [],
      ['it names "Opus" — an agent\'s model and effort are its definition\'s'],
      ['it names "effort" — an agent\'s model and effort are its definition\'s'],
      ['it names "model" — an agent\'s model and effort are its definition\'s'],
    ]);
  });
});

describe('engine migrate check (21.10.7)', () => {
  it('answers whether the directive passes: its pieces done of all of them, what a piece is, and each piece not done with what it lacks', () => {
    assert.deepStrictEqual(checked(), {
      ok: true, directive: RECORDS, passed: false, done: 0, of: 3, counts: TOPICS,
      unfinished: [
        { name: 'fumi/licensing', problems: ['no entry for trial-length, decided on its map', 'no entry for seat-count, decided on its map'] },
        { name: 'fumi/search', problems: ['no entry for ranking, decided on its map'] },
        { name: 'fumi/onboarding', problems: ['no entry for permissions, decided on its map'] },
      ],
    });

    enterTopic(dir, 'licensing');
    enterTopic(dir, 'search');
    enterTopic(dir, 'onboarding');

    assert.deepStrictEqual(checked(), { ok: true, directive: RECORDS, passed: true, done: 3, of: 3, counts: TOPICS, unfinished: [] });
  });

  it('reads without the writer lock: it answers while another holds it, never trying it', (t) => {
    const lock = holdLock(statePath(dir, layout.lock));
    const attempts = lockAttempts(t, lock, () => { throw new Error('waited on the writer lock'); });

    assert.strictEqual(checked().of, 3);
    assert.deepStrictEqual(attempts, []);
  });

  it('refuses an id of another shape, a directive the migrations lack, and a check that will not load, exports another shape, fails, or answers no pieces', () => {
    assert.deepStrictEqual([
      refusedUntouched(dir, ['migrate', 'check', '../079']),
      refusedUntouched(dir, ['migrate', 'check', '078-move']),
      refusedUntouched(dir, ['migrate', 'check', '090-unchecked']),
      refusedUntouched(dir, ['migrate', 'check', '091-shapeless']),
      refusedUntouched(dir, ['migrate', 'check', '092-failing']),
      refusedUntouched(dir, ['migrate', 'check', '093-unanswered']),
      refusedUntouched(dir, ['migrate', 'check']),
      refusedUntouched(dir, ['migrate', 'run', RECORDS]),
    ].map((error) => error.replace(engine.migrations, '{migrations}').replace(/: Cannot find module[^]*$/, ': Cannot find module')), [
      'migrate check: "../079" is no directive\'s id — a directive\'s id is its file\'s name, NNN-{slug}',
      'migrate check: there is no directive 078-move',
      'migrate check: 090-unchecked\'s check could not be loaded from {migrations}/090-unchecked.check.cjs: Cannot find module',
      'migrate check: 091-shapeless\'s check exports no check() beside what it counts — it exports { counts: { one, many }, done, check({ projectDir, stateDir }) }',
      'migrate check: 092-failing\'s check failed: the old manifests could not be read',
      'migrate check: 093-unanswered\'s check answered no list of { name, problems }',
      'Usage: engine migrate check <id> | engine migrate checked | engine migrate review | engine migrate join <work-unit> --directive <id> [--phase <N> --dry-run]',
      'Usage: engine migrate check <id> | engine migrate checked | engine migrate review | engine migrate join <work-unit> --directive <id> [--phase <N> --dry-run]',
    ]);
  });
});

describe('engine migrate checked (21.10.13)', () => {
  it('records the checks before the reshape\'s move made, the line once however often it is called, committing nothing', () => {
    const code = codeHead(dir);

    assert.deepStrictEqual([ok(['migrate', 'checked']), ok(['migrate', 'checked'])], [{ ok: true }, { ok: true }]);

    assert.deepStrictEqual(recorded(dir), [...RECORDED, 'old-chain-checks']);
    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir)], [true, code]);
  });
});

describe('a directive\'s checklist (6.4.5, 6.4.11, 6.S23)', () => {
  it('holds one item, its check, the engine\'s: open while the check fails, done once it passes', () => {
    const show = () => ok(['checklist', 'show', 'directive', RECORDS]);
    const item = (/** @type {string} */ state) => ({ ok: true, checklist: `directive.${RECORDS}`, closed: null, items: [{ key: 'check', text: 'its check', by: 'engine', state }], skips: [] });

    assert.deepStrictEqual(show(), item('open'));
    for (const topic of /** @type {const} */ (['licensing', 'search', 'onboarding'])) enterTopic(dir, topic);
    assert.deepStrictEqual(show(), item('done'));
  });

  it('never marks the check, nor skips it — it must pass — and refuses a directive the migrations lack', () => {
    assert.deepStrictEqual([
      refusedUntouched(dir, ['checklist', 'done', 'directive', RECORDS, 'check']),
      refusedUntouched(dir, ['checklist', 'skip', 'directive', RECORDS, 'check', '--reason', 'Checked by eye.']),
      refusedUntouched(dir, ['checklist', 'show', 'directive', '078-move']),
    ], [
      'checklist done: check is the engine\'s to check, never marked — it reads done once it holds',
      'checklist skip: check is the engine\'s to check, never marked — it reads done once it holds',
      'checklist show: there is no directive 078-move',
    ]);
  });

  it('21.S36: a topic missing an entry for a decided map item fails the check — the close is refused, and the directive is not recorded', () => {
    enterTopic(dir, 'licensing');
    enterTopic(dir, 'search');
    enter(dir, 'onboarding', 'first-run');

    assert.deepStrictEqual(checked().unfinished, [{ name: 'fumi/onboarding', problems: ['no entry for permissions, decided on its map'] }]);
    assert.strictEqual(refusedUntouched(dir, ['checklist', 'close', 'directive', RECORDS]), `checklist close: directive.${RECORDS} has items open: check`);
    assert.deepStrictEqual(recorded(dir), RECORDED);
  });

  it('closes once the check passes: the close on the project manifest, the directive recorded, its commit held for the migration\'s', () => {
    for (const topic of /** @type {const} */ (['licensing', 'search', 'onboarding'])) enterTopic(dir, topic);

    const closed = ok(['checklist', 'close', 'directive', RECORDS]);

    assert.deepStrictEqual(closed, { ok: true, checklist: `directive.${RECORDS}`, closed: closed.closed, committed: null, note: 'held for the migration\'s commit' });
    assert.deepStrictEqual(JSON.parse(readState(dir, layout.projectManifest)).checklists, { directive: { [RECORDS]: { items: {}, closed: closed.closed } } });
    assert.deepStrictEqual(recorded(dir), [...RECORDED, '079']);
    assert.ok(stateUnborn(dir));
  });
});

/**
 * Boot's answer at the directive `id`'s stop, its pieces `done` of all of
 * them where its check counts them: the start skill's directive reference
 * loaded with the directive and its file, then boot again.
 * @param {string} id @param {{done?: number, of?: number}} [counts]
 */
const atDirective = (id, counts = {}) => {
  const file = path.join(engine.migrations, `${id}.md`);
  return { ok: true, state: 'directive', id, file, ...counts, stop: { next: { kind: 'load', reference: 'migration-directive', with: { directive: id, file } } }, warnings: [] };
};

describe('boot at a directive (21.10.4, 21.10.9, 21.10.10)', () => {
  it('21.S37: a session died with two topics done and one half done — boot goes no further than the directive, stamping the conversation for its steps, the two pass its check, the third is redone and the ledger holds each of its entries once; recorded, the directive lets boot on to the next, and past both to the migration waiting on its commit, with nothing committed', () => {
    enterTopic(dir, 'licensing');
    enterTopic(dir, 'search');
    writeState(dir, layout.cache('migration', 'onboarding.md'), '# Onboarding\n\nPermissions: decided, a half-written entry.\n');
    const code = codeHead(dir);
    const resumed = { env: { CLAUDE_CODE_SESSION_ID: 'resumed' }, unbooted: true };

    assert.deepStrictEqual(engine.ok(dir, ['boot'], resumed), atDirective(RECORDS, { done: 2, of: 3 }));
    assert.deepStrictEqual(engine.ok(dir, ['migrate', 'check', RECORDS], resumed).unfinished.map((piece) => piece.name), ['fumi/onboarding']);

    enterTopic(dir, 'onboarding');
    engine.ok(dir, ['checklist', 'close', 'directive', RECORDS], resumed);

    assert.deepStrictEqual(ledgerEntries(statePath(dir)).filter((entry) => entry.topic === 'onboarding').map((entry) => entry.text), ['permissions']);
    assert.deepStrictEqual(ok(['boot']), atDirective(LOGS, { done: 0, of: 1 }));

    for (const topic of ['licensing', 'search', 'onboarding']) writeState(dir, layout.topic(UNIT, topic, 'log.md'), `# ${topic}\n`);
    ok(['checklist', 'close', 'directive', LOGS]);
    const finished = ok(['boot']);

    assert.deepStrictEqual([finished.state, finished.migrations.ran, recorded(dir)], ['finish', 0, [...RECORDED, '079', '085']]);
    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir)], [true, code], 'nothing was committed before the migration\'s commit');
  });

  it('a boot stopping at a directive carries its warnings, for the start to surface ahead of the stop as at any other — a copy made while the migration runs relinked as its own, naming the original', () => {
    const original = dir;
    dir = path.join(path.dirname(original), 'copy');
    fs.cpSync(original, dir, { recursive: true });

    const res = ok(['boot']);

    assert.deepStrictEqual([res.state, res.id, res.warnings], ['directive', RECORDS, [`this project is a copy of ${original}: its state worktree was linked to that project's, and is now this one's own — ${original} is untouched`]]);
  });

  it('records a directive whose check answers no piece at all unrun, its unrun line beside it, never stopping at it: the session has nothing to do (21.4.3)', () => {
    writeState(dir, layout.migrations, ['079', ...RECORDED].map((id) => `${id}\n`).join(''));
    fs.rmSync(statePath(dir, UNIT), { recursive: true });

    const finished = ok(['boot']);

    assert.deepStrictEqual([finished.state, recorded(dir)], ['finish', ['079', ...RECORDED, '085', '085 unrun']]);
  });

  it('stops at a directive whose every piece is done all the same, for the session to close', () => {
    writeState(dir, layout.migrations, ['079', ...RECORDED].map((id) => `${id}\n`).join(''));
    for (const topic of ['licensing', 'search', 'onboarding']) writeState(dir, layout.topic(UNIT, topic, 'log.md'), `# ${topic}\n`);

    assert.deepStrictEqual(ok(['boot']), atDirective(LOGS, { done: 1, of: 1 }));
    assert.deepStrictEqual(recorded(dir), ['079', ...RECORDED]);
  });

  it('stops at a directive whose check fails on what a session left, saying nothing of what is done — the check names why', () => {
    writeState(dir, layout.migrations, ['079', '085', '090', '091', '093'].map((id) => `${id}\n`).join(''));

    assert.deepStrictEqual(ok(['boot']), atDirective(FAILING));
    assert.deepStrictEqual(engine.output(dir, ['render', 'directive-stop', '--directive', FAILING]).split('\n').filter((line) => line.startsWith('>')), [
      '> No session works in this project until the migration is done.',
      '>',
      '> This session carries the migration on from its failing step; the start menu follows once the migration is done and committed.',
    ]);
    assert.strictEqual(refusedUntouched(dir, ['migrate', 'check', FAILING]), `migrate check: ${FAILING}'s check failed: the old manifests could not be read`);
  });
});

describe('a second session at a directive (21.10.10, P7)', () => {
  // Each session a conversation of a live Claude process of its own: the
  // first this test's process, the second its parent.
  const FIRST = { CLAUDE_CODE_SESSION_ID: 'first', CLAUDE_PID: String(process.pid) };
  const SECOND = { CLAUDE_CODE_SESSION_ID: 'second', CLAUDE_PID: String(process.ppid) };
  const row = () => statePath(dir, layout.cache('migrate', 'presence'));
  /** Boot in the conversation `env` names. @param {Record<string, string>} env */
  const bootAs = (env) => engine.ok(dir, ['boot'], { env, unbooted: true });
  const carriedOn = atDirective(RECORDS, { done: 0, of: 3 });

  it('stops while another live session carries the directive on, naming when that one last checked it — unstamped, going no further — and the session carrying it on carries on', () => {
    assert.deepStrictEqual(bootAs(FIRST), carriedOn);
    const checked = Date.now() - 300 * 1000;
    fs.utimesSync(row(), new Date(checked), new Date(checked));

    const taken = bootAs(SECOND);

    const stop = { marker: 'Migration', surface: 'migration-taken-stop', args: ['--at', RECORDS, '--active', String(taken.active)], next: null };
    assert.deepStrictEqual(taken, { ok: true, state: 'taken', at: RECORDS, active: taken.active, stop, warnings: [] });
    assert.ok(taken.active >= 300 && taken.active < 330, `last active ${taken.active}s ago`);
    assert.ok(!fs.existsSync(path.join(conversationDir('second'), 'booted.json')), 'nothing may touch the work at the stop (22.1.7)');
    assert.deepStrictEqual(recorded(dir), RECORDED);

    engine.ok(dir, ['migrate', 'check', RECORDS], { env: SECOND });
    assert.ok(bootAs(SECOND).active >= 300, 'a check by another session stamps nothing');
    engine.ok(dir, ['migrate', 'check', RECORDS], { env: FIRST });
    assert.ok(bootAs(SECOND).active < 300, 'the carrying session\'s check stamps its row again');
    assert.deepStrictEqual(bootAs(FIRST), carriedOn);
  });

  it('migrate checked re-stamps the row of the session carrying the migration on, and only that session\'s', () => {
    bootAs(FIRST);
    const checked = Date.now() - 300 * 1000;
    fs.utimesSync(row(), new Date(checked), new Date(checked));

    engine.ok(dir, ['migrate', 'checked'], { env: SECOND });
    assert.ok(bootAs(SECOND).active >= 300, 'another session\'s record stamps nothing');
    engine.ok(dir, ['migrate', 'checked'], { env: FIRST });
    assert.ok(bootAs(SECOND).active < 300, 'the carrying session\'s record stamps its row again');
  });

  it('carries the directive on where the first session\'s row is gone, the exit sweep having taken it — the row this session\'s from then on', () => {
    bootAs(FIRST);

    assert.deepStrictEqual(engine.ok(dir, ['presence', 'cleanup', 'first']).cleared, [{ place: 'migration' }]);
    assert.deepStrictEqual(bootAs(SECOND), carriedOn);
    assert.strictEqual(bootAs(FIRST).state, 'taken');
  });

  it('carries the directive on where the first session was killed, its row stale', async () => {
    const killed = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore', timeout: 30000, killSignal: 'SIGKILL' });
    const gone = new Promise((resolve) => killed.on('exit', resolve));
    bootAs({ CLAUDE_CODE_SESSION_ID: 'killed', CLAUDE_PID: String(killed.pid) });
    assert.strictEqual(bootAs(SECOND).state, 'taken', 'held while it runs');

    killed.kill('SIGKILL');
    await gone;

    assert.deepStrictEqual(bootAs(SECOND), carriedOn);
  });
});

describe('the stop\'s screen (21.10.11)', () => {
  it('names the step the migration stopped at, keeps what it finished, each piece checked, and says this session carries it on', () => {
    enterTopic(dir, 'licensing');
    enterTopic(dir, 'search');

    assert.strictEqual(engine.output(dir, ['render', 'directive-stop', '--directive', RECORDS]), [
      '=== DISPLAY: directive stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The migration stopped part-way: its records step isn\'t done',
      '',
      '=== DISPLAY: directive account (emit verbatim as markdown (not a code block)) ===',
      '> No session works in this project until the migration is done. What it finished is kept: 2 of Fumi\'s 3 topics have their records, each checked. Any topic it was in the middle of is redone from the start.',
      '>',
      '> This session carries the migration on from its records step; the start menu follows once the migration is done and committed.',
      '',
    ].join('\n'));
  });

  it('the taken stop, where another session carries the step on, draws that step\'s stop naming when it was last active and saying this session stops there — nothing of a piece redone — refusing a step or an --active missing, and an --active that is no whole number', () => {
    enterTopic(dir, 'licensing');
    enterTopic(dir, 'search');
    const taken = (/** @type {string} */ at) => engine.output(dir, ['render', 'migration-taken-stop', '--at', at, '--active', '180']).split('\n').filter((line) => line.startsWith('>'));

    assert.deepStrictEqual(taken(RECORDS), [
      '> No session works in this project until the migration is done. What it finished is kept: 2 of Fumi\'s 3 topics have their records, each checked.',
      '>',
      '> Another session is carrying the migration on from its records step, last active 3m ago, so this one stops here.',
      '>',
      '> Run `/ledger` here again once that session has finished the migration, or has ended.',
    ]);
    assert.deepStrictEqual(taken('checks'), [
      "> Earlier migrations of this project left checks their code couldn't make. Some fix files the move carries into Ledger, so they come first. No session works in this project until the migration is done.",
      '>',
      '> Another session is carrying the migration on from its checks, last active 3m ago, so this one stops here.',
      '>',
      '> Run `/ledger` here again once that session has finished the migration, or has ended.',
    ]);
    assert.deepStrictEqual([['--active', '180'], ['--at', RECORDS], ['--at', RECORDS, '--active', '3m']].map((args) => refusedUntouched(dir, ['render', 'migration-taken-stop', ...args])), [
      'render migration-taken-stop: --at <step> names the step another session carries the migration on from, a directive\'s id or checks',
      'render migration-taken-stop: --active takes the seconds since the session carrying the migration on was last active',
      'render migration-taken-stop: --active takes the seconds since the session carrying the migration on was last active, got "3m"',
    ]);
  });

  it('says nothing of work kept where the directive has none done yet, and refuses without the directive it is for', () => {
    const account = engine.output(dir, ['render', 'directive-stop', '--directive', LOGS]).split('\n').filter((line) => line.startsWith('>'));

    assert.deepStrictEqual(account, [
      '> No session works in this project until the migration is done.',
      '>',
      '> This session carries the migration on from its logs step; the start menu follows once the migration is done and committed.',
    ]);
    assert.strictEqual(refusedUntouched(dir, ['render', 'directive-stop']), 'render directive-stop: --directive <id> names the directive boot stopped at');
  });

  it('counts the pieces as the check names them, one and many, and says what a piece done has in its words', () => {
    const screen = directiveStop({ project: 'Fumi', step: 'cut', progress: { done: 1, of: 4, counts: { one: 'branch', many: 'branches' }, says: 'are cut' } });

    assert.strictEqual(screen.split('\n').filter((line) => line.startsWith('> No session'))[0],
      '> No session works in this project until the migration is done. What it finished is kept: 1 of Fumi\'s 4 branches are cut, each checked. Any branch it was in the middle of is redone from the start.');
  });

  it('says the step is ready to close where every piece is done and the close has not run', () => {
    for (const topic of /** @type {const} */ (['licensing', 'search', 'onboarding'])) enterTopic(dir, topic);

    assert.deepStrictEqual(engine.output(dir, ['render', 'directive-stop', '--directive', RECORDS]).split('\n').filter((line) => line.startsWith('>'))[0],
      '> No session works in this project until the migration is done. What it finished is kept: 3 of Fumi\'s 3 topics have their records, each checked. The step is ready to close.');
  });
});

describe('while the migration runs (21.1.5, 21.9.3)', () => {
  const config = useTempFolder('migration-trust-');

  it('a ledger write holds its commit: the entry in the ledger, nothing committed', () => {
    const written = enter(dir, 'search', 'ranking');

    assert.deepStrictEqual(written, { ok: true, id: written.id, committed: null, note: 'held for the migration\'s commit' });
    assert.deepStrictEqual(ledgerEntries(statePath(dir)).map((entry) => [entry.topic, entry.text]), [['search', 'ranking']]);
    assert.ok(stateUnborn(dir));
  });

  it('takes Claude\'s decision carried over, which outside the migration is refused (test-engine-ledger-provenance.cjs)', () => {
    const at = `${UNIT}.discussion.licensing`;
    const asked = engine.ok(dir, ['ledger', 'ask', at], { env: SESSION, stdin: JSON.stringify({ text: 'How long is the trial?', by: 'claude', who_moved_whom: 'none' }) }).id;

    engine.ok(dir, ['ledger', 'decide', at, '--answers', asked], { env: SESSION, stdin: JSON.stringify({ text: 'Fourteen days.', why: 'The log says so.', by: 'claude', who_moved_whom: 'none', given: 'carried' }) });

    assert.deepStrictEqual(ledgerEntries(statePath(dir)).map((entry) => [entry.event, entry.given ?? null]), [['asked', null], ['decided', 'carried']]);
  });

  it('holds a commit to the layout all the same: a file outside it refuses the commit at once, named', () => {
    writeState(dir, `${UNIT}/tmp/notes.md`, 'A stray.\n');

    const written = enter(dir, 'search', 'ranking');

    assert.deepStrictEqual([written.committed, written.note], [null, 'commit pending — the entry is in the ledger, and the next ledger write or boot commits it']);
    assert.match(String(written.warnings), /holds fumi\/tmp\/notes\.md, outside Ledger's layout/);
  });

  it('nothing reaches the trust log — not Claude\'s decision, not a gate\'s answer, nothing kept waiting in the conversation — until the migration\'s commit makes the state branch\'s first', () => {
    const env = { ...SESSION, LEDGER_CONFIG_DIR: config() };
    const tell = () => {
      const question = engine.ok(dir, ['ledger', 'ask', `${UNIT}.discussion.licensing`], { env, stdin: JSON.stringify({ text: 'How long is the trial?', by: 'person', who_moved_whom: 'none' }) }).id;
      engine.ok(dir, ['ledger', 'decide', `${UNIT}.discussion.licensing`, '--answers', question], { env, stdin: JSON.stringify({ text: 'Fourteen days.', why: 'Long enough to try a release.', by: 'claude', who_moved_whom: 'none' }) });
      engine.output(dir, ['render', 'migration-gate'], { env });
      engine.ok(dir, ['gate', 'migration gate', '--pick', 'y'], { env });
    };
    const log = path.join(config(), TRUST_LOG);
    const conversations = path.join(config(), 'conversations');
    const waiting = () => (fs.existsSync(conversations) ? fs.readdirSync(conversations, { recursive: true }) : []).filter((name) => path.basename(String(name)) === PENDING);

    tell();
    assert.deepStrictEqual([fs.existsSync(log), waiting()], [false, []]);

    git(statePath(dir), ['add', '-A']);
    git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);
    tell();

    assert.deepStrictEqual(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line).type), ['call', 'gate']);
  });

  it('a task verb holds its commit: the tracker\'s store written in the state, nothing committed on either branch (21.5.21)', () => {
    const code = codeHead(dir);

    const written = ok(['task', 'phase', UNIT, '1', '--title', 'The licence']);

    assert.deepStrictEqual([written.phase, written.committed, written.note], [1, null, 'held for the migration\'s commit']);
    assert.ok(listDrivers('task').find((driver) => driver.isDefault).storeFiles().every((file) => fs.existsSync(statePath(dir, file))));
    assert.deepStrictEqual([stateUnborn(dir), codeHead(dir)], [true, code]);
  });
});
