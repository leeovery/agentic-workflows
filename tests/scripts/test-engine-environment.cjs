'use strict';

// ---------------------------------------------------------------------------
// The environment setup's verbs (ledger-engine/scripts/domain/
// environment-verbs.cjs; 22.5, 12.7.4, 15.2.11): `environment show`, the
// setup whole, each part none where it holds none, the verify setup's place
// and parts among them (15.S3); `environment set <part>`, a part written
// whole from stdin, what cannot run at once keeping when and by whom each
// record held was made, never the verify setup nor the person's yes;
// `environment confirm`, the person's yes, kept once given; `environment
// concurrency add`, what a unit's build learned cannot run at once,
// recorded once (12.S18, 22.S27); each write committing the project
// manifest alone, run again after a kill committing what the kill left, and
// each refusal writing nothing; and `render environment-setup`, the setup's
// screen drawn from the manifest, its yes recording the setup at the first
// ready to build and keeping it from manage (22.S13, 22.S14). How the screen
// reads is test-engine-environment-screen.cjs's; the schema
// test-engine-environment-schema.cjs's.
//
// Layer: verb, each call in a conversation of the test's own. World: this
// file's own, built once and copied for each test — a project with two
// features under way and no environment setup.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  ok, output, refusedPristine, screenOf, stateGit, lastMessage, touched, commitAll, fixtureFrom, cleanupFixture, killedAt, setEnvironment,
  withFrozenClock, FROZEN_AT, STATE_DIR_NAME, layout, statePath,
} = require('./engine-harness.cjs');
const { createManifest, readManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'quiet-hours';
const OTHER = 'lazy-resume';
const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'environment-session' });
const HELD_AT = '2026-06-03T09:00:00.000Z';
/** The frozen instant as the engine stamps it, to the second. */
const NOW = FROZEN_AT.replace(/\.\d{3}Z$/, 'Z');

/** A verify setup, as the task that builds it records it. */
const VERIFY = Object.freeze({
  place: 'verify', feature_map: 'verify/features.md', launch: 'make up', health: 'make health', drive: 'make drive', evidence: 'make evidence', cleanup: 'make down',
  ran: { unit: UNIT, scenario: '1.S1', verdict: 'proven', commits: [{ repo: '.', commit: 'a'.repeat(40) }], at: HELD_AT },
});

const world = fixtureFrom('ledger-environment-', (dir) => {
  createManifest(dir, UNIT, {});
  createManifest(dir, OTHER, {});
  commitAll(dir, 'two features under way');
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => cleanupFixture(dir));

/** An `environment` call answered. @param {string[]} args @param {unknown} [stdin] */
const environment = (args, stdin) => ok(dir, ['environment', ...args], { env: ENV, ...(stdin === undefined ? {} : { stdin: JSON.stringify(stdin) }) });

/** The setup as the project manifest holds it. */
const recorded = () => readManifest(dir, '.').environment;

/** The setup recorded by hand, committed. @param {Record<string, unknown>} setup */
function holding(setup) {
  setEnvironment(dir, setup);
  commitAll(dir, 'a setup recorded');
}

/** What the last state commit touched, and its message. */
const lastCommit = () => ({ files: touched(statePath(dir), 'HEAD'), message: lastMessage(dir) });

/** A refusal's error, nothing written or committed. @param {string[]} args @param {string} [stdin] */
const refused = (args, stdin = '') => refusedPristine(dir, ['environment', ...args], { env: ENV, stdin }).error;

describe('environment show', () => {
  it('answers each part none where the setup holds none', () => {
    assert.deepStrictEqual(environment(['show']), { ok: true, run: {}, prepare: [], concurrency: [], verify: null, linters: [], confirmed: null });
  });

  it('15.S3: names where the verify setup is and how to call its five parts', () => {
    holding({ verify: VERIFY, linters: [{ name: 'eslint', command: 'npx eslint .' }] });
    const { verify, linters } = environment(['show']);
    assert.deepStrictEqual([verify, linters], [VERIFY, [{ name: 'eslint', command: 'npx eslint .' }]]);
  });

  it('refuses a setup that does not read, naming each fault', () => {
    holding({ linters: [{ name: 'eslint' }] });
    assert.strictEqual(refused(['show']), 'environment show: the project manifest\'s environment.linters does not read — entry 1: its command is not text');
  });
});

describe('environment set', () => {
  it('writes a part whole as stdin gives it, committing the project manifest alone', () => {
    const prepare = [{ name: 'Dependencies', when: 'both', command: 'go mod download' }, { name: 'Signing key', when: 'first', note: 'Copy it from the vault' }];
    const res = environment(['set', 'prepare'], prepare);

    assert.deepStrictEqual(res, { ok: true, part: 'prepare', value: prepare, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([recorded(), lastCommit()], [{ prepare }, { files: [`M\t${layout.projectManifest}`], message: 'environment: prepare set' }]);
  });

  it('22.S14: the linters changed, the other parts kept as they stand', () => {
    holding({ run: { tests: 'go test ./...' }, linters: [{ name: 'go vet', command: 'go vet ./...' }], confirmed: HELD_AT });
    const linters = [{ name: 'go vet', command: 'go vet ./...' }, { name: 'gofmt', command: 'gofmt -l .' }];
    environment(['set', 'linters'], linters);
    assert.deepStrictEqual(recorded(), { run: { tests: 'go test ./...' }, linters, confirmed: HELD_AT });
  });

  it('takes what cannot run at once by what it is: a record held keeps when and by whom it was made, a new one is recorded now, by no unit', () => {
    holding({ concurrency: [{ what: 'the tests share port 5432', at: HELD_AT, by: UNIT }, { what: 'the e2e suite owns the browser', at: HELD_AT, by: OTHER }] });
    withFrozenClock(() => environment(['set', 'concurrency'], [{ what: 'the tests share port 5432' }, { what: 'the fixtures share a bucket' }]));
    assert.deepStrictEqual(recorded().concurrency, [{ what: 'the tests share port 5432', at: HELD_AT, by: UNIT }, { what: 'the fixtures share a bucket', at: NOW, by: null }]);
  });

  it('refuses the verify setup, the person\'s yes, a part the setup does not hold, stdin that is no JSON and a part that does not read — writing nothing', () => {
    assert.deepStrictEqual([
      refused(['set', 'verify'], JSON.stringify(VERIFY)),
      refused(['set', 'confirmed'], JSON.stringify(HELD_AT)),
      refused(['set', 'skills'], '[]'),
      refused(['set', 'linters'], 'eslint'),
      refused(['set', 'prepare'], JSON.stringify([{ name: 'Dependencies', when: 'always', command: 'npm ci' }])),
      refused(['set', 'concurrency'], JSON.stringify([{ what: 'port 5432', at: HELD_AT, by: UNIT }])),
    ], [
      'environment set: the verify setup is recorded by the task that builds it, once it runs end to end: engine verify setup (15.2.11)',
      'environment set: the person\'s yes at the setup\'s screen records it: engine environment confirm',
      'environment set: there is no part "skills" to set — the parts are run, prepare, concurrency, linters',
      'environment set: the part\'s JSON on stdin does not read — Unexpected token \'e\', "eslint" is not valid JSON',
      'environment set: prepare does not read — entry 1: its when is none of "first", "worktree" and "both"',
      'environment set: concurrency does not read — entry 1: it is not {what} — when and by whom it was recorded are the engine\'s',
    ]);
  });
});

describe('environment confirm', () => {
  it('records the person\'s yes, the instant, committed — and run again keeps the instant held', () => {
    const first = withFrozenClock(() => environment(['confirm']));
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const again = environment(['confirm']);

    assert.deepStrictEqual([first.confirmed, recorded(), lastMessage(dir)], [NOW, { confirmed: NOW }, 'environment: confirmed']);
    assert.deepStrictEqual([again.confirmed, again.committed, stateGit(dir, ['rev-parse', 'HEAD']).trim()], [NOW, null, head]);
  });
});

describe('environment concurrency add (12.7.4, 22.5.13)', () => {
  it('12.S18, 22.S27: records what a unit\'s build learned cannot run at once, once — learned again by another build, it is answered as recorded', () => {
    const res = withFrozenClock(() => environment(['concurrency', 'add', UNIT, 'the tests share port 5432']));
    const again = environment(['concurrency', 'add', OTHER, 'the tests share port 5432']);
    const record = { what: 'the tests share port 5432', at: NOW, by: UNIT };

    assert.deepStrictEqual([res.unit, res.what, res.at, res.by, lastMessage(dir)], [UNIT, record.what, NOW, UNIT, 'environment: what can\'t run at once — the tests share port 5432']);
    assert.deepStrictEqual([again.already, again.by, again.committed, recorded()], [true, UNIT, null, { concurrency: [record] }]);
  });

  it('refuses a unit the project lacks and nothing said, writing nothing', () => {
    assert.deepStrictEqual([refused(['concurrency', 'add', 'ghost', 'port 5432']), refused(['concurrency', 'add', UNIT, ' '])], [
      'environment concurrency add: there is no work unit "ghost" — the start menu lists the work in progress',
      'environment concurrency add: what cannot run at once is said in words',
    ]);
  });
});

describe('a write killed before its commit is finished by the call again', () => {
  const AFTER_WRITE = Object.freeze({ method: 'renameSync', file: `${STATE_DIR_NAME}/${layout.projectManifest}`, when: 'after' });

  for (const [verb, args, stdin, holds] of /** @type {const} */ ([
    ['set', ['set', 'linters'], JSON.stringify([{ name: 'gofmt', command: 'gofmt -l .' }]), (/** @type {any} */ setup) => setup.linters.length === 1],
    ['confirm', ['confirm'], '', (/** @type {any} */ setup) => typeof setup.confirmed === 'string'],
    ['concurrency add', ['concurrency', 'add', UNIT, 'port 5432'], '', (/** @type {any} */ setup) => setup.concurrency.length === 1],
  ])) {
    it(`${verb}: the manifest written and not committed, the call again commits it`, () => {
      killedAt(AFTER_WRITE, dir, ['environment', ...args], { env: ENV, stdin });
      const left = stateGit(dir, ['status', '--porcelain']).trim();
      ok(dir, ['environment', ...args], { env: ENV, stdin });

      assert.deepStrictEqual([left, stateGit(dir, ['status', '--porcelain']), holds(recorded()), lastMessage(dir).startsWith('environment: ')], [`M ${layout.projectManifest}`, '', true, true]);
    });
  }
});

describe('render environment-setup (22.5.7, 22.5.8)', () => {
  /** The screen drawn in the conversation: its gate's lines. @param {string[]} flags @param {string} gate */
  const drawn = (flags, gate) => screenOf(output(dir, ['render', 'environment-setup', ...flags], { env: ENV }), `MENU: ${gate}`);

  it('22.S13, 15.S14: at the first ready to build, drawn from what Claude recorded as found — the linters among it — the verify setup never asked; its yes records the setup', () => {
    holding({ linters: [{ name: 'gofmt', command: 'gofmt -l .' }] });
    const out = output(dir, ['render', 'environment-setup'], { env: ENV });
    const { next } = ok(dir, ['gate', 'environment setup', '--pick', 'y'], { env: ENV });
    ok(dir, next.argv, { env: ENV });

    assert.ok(screenOf(out, 'DISPLAY: environment setup').includes('  · gofmt — gofmt -l .'));
    assert.ok(!out.includes('VERIFY SETUP'));
    assert.deepStrictEqual([next, typeof recorded().confirmed], [{ kind: 'engine', argv: ['environment', 'confirm'] }, 'string']);
  });

  it('22.S14: from manage, its yes keeps the setup, recording the person\'s yes where none is held, an instant held kept, and goes back to manage', () => {
    holding({ linters: [{ name: 'gofmt', command: 'gofmt -l .' }] });
    drawn(['--from', 'manage'], 'manage setup');
    const { next } = ok(dir, ['gate', 'manage setup', '--pick', 'y'], { env: ENV });
    const kept = withFrozenClock(() => ok(dir, next.argv, { env: ENV }));
    const again = ok(dir, next.argv, { env: ENV });

    assert.deepStrictEqual(next, { kind: 'engine', argv: ['environment', 'confirm', '--from', 'manage'] });
    assert.deepStrictEqual([kept.confirmed, kept.next, recorded()], [NOW, { kind: 'engine', argv: ['render', 'manage'] }, { linters: [{ name: 'gofmt', command: 'gofmt -l .' }], confirmed: NOW }]);
    assert.deepStrictEqual([again.confirmed, again.committed, again.next], [NOW, null, kept.next]);
    assert.match(refusedPristine(dir, ['environment', 'confirm', '--from', 'roadmap'], { env: ENV }).error, /^Usage: engine environment show \| /);
  });

  it('refuses drawing it from anywhere but manage, and a setup that does not read', () => {
    holding({ confirmed: 'yesterday' });
    assert.deepStrictEqual([
      refusedPristine(dir, ['render', 'environment-setup', '--from', 'roadmap'], { env: ENV }).error,
      refusedPristine(dir, ['render', 'environment-setup'], { env: ENV }).error,
    ], [
      'Usage: engine render environment-setup [--from manage]',
      'render environment-setup: the project manifest\'s environment.confirmed does not read — it is not an instant',
    ]);
  });
});
