'use strict';

// ---------------------------------------------------------------------------
// The environment setup's schema (ledger-engine/scripts/domain/
// environment.cjs; 22.5.1, 22.5.12): `environmentFaults`, what is amiss in
// a setup as the project manifest holds it, each fault naming its part —
// how to run the product, its build, tests and run; the steps that prepare
// the environment, each run before the first task, in each worktree or both,
// or a note never run; what cannot run at once, each record once; the
// linters, each name once; and the person's yes, an instant. The verify
// setup's own faults are test-engine-verify.cjs's.
//
// Layer: unit. The schema is read from values; no git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { environmentFaults } = require(path.join(SCRIPTS, 'domain/environment.cjs'));

const AT = '2026-06-03T09:00:00.000Z';

/** A setup holding every part, as the first ready to build records it. */
const WHOLE = Object.freeze({
  run: { build: 'go build ./...', tests: 'go test ./...', run: 'go run .' },
  prepare: [
    { name: 'Dependencies', when: 'both', command: 'go mod download' },
    { name: 'Env file', when: 'worktree', command: 'cp .env.example .env' },
    { name: 'Signing key', when: 'first', note: 'Ask for the key from the vault' },
  ],
  concurrency: [{ what: 'the tests share port 5432', at: AT, by: 'quiet-hours' }, { what: 'the e2e suite owns the browser', at: AT, by: null }],
  verify: {
    place: 'verify', feature_map: 'verify/features.md', launch: 'make up', health: 'make health', drive: 'make drive', evidence: 'make evidence', cleanup: 'make down',
    ran: { unit: 'quiet-hours', scenario: '1.S1', verdict: 'proven', commits: [{ repo: '.', commit: 'a'.repeat(40) }], at: AT },
  },
  linters: [{ name: 'go vet', command: 'go vet ./...' }, { name: 'gofmt', command: 'gofmt -l .' }],
  confirmed: AT,
});

describe('the environment setup\'s schema (22.5.12)', () => {
  it('reads a setup holding every part, and one holding none', () => {
    assert.deepStrictEqual([environmentFaults(WHOLE), environmentFaults({})], [[], []]);
  });

  it('refuses a part the setup does not take, naming its parts', () => {
    assert.deepStrictEqual(environmentFaults({ skills: [] }), ['"skills" is no part of the environment setup — its parts are run, prepare, concurrency, verify, linters and confirmed']);
  });

  it('how to run the product: build, tests and run, each a command', () => {
    assert.deepStrictEqual(environmentFaults({ run: { tests: ' ', lint: 'make lint' } }), [
      'run: "lint" is no command of run — its commands are build, tests and run',
      'run: tests is not a command',
    ]);
  });

  it('a step runs before the first task, in each worktree, or both, and holds a command or a note, one of them, its name once', () => {
    const prepare = [
      { name: 'Dependencies', when: 'both', command: 'npm ci' },
      { name: 'Env file', when: 'always', command: 'cp .env.example .env' },
      { name: 'Keys', when: 'first', command: 'make keys', note: 'or by hand' },
      { name: 'Database', when: 'first' },
      { name: 'Dependencies', when: 'worktree', note: 'npm ci, again' },
    ];
    assert.deepStrictEqual(environmentFaults({ prepare }), [
      'prepare: entry 2: its when is none of "first", "worktree" and "both"',
      'prepare: entry 3: it holds a command or a note, one of them',
      'prepare: entry 4: it holds a command or a note, one of them',
      'prepare: entry 5: its name "Dependencies" is an earlier entry\'s',
    ]);
  });

  it('what cannot run at once: each recorded at an instant, by the unit whose build learned it or by none, and each once', () => {
    const concurrency = [
      { what: 'port 5432', at: 'yesterday', by: '' },
      { what: 'port 5432', at: AT, by: null },
      { what: 'port 5432', at: AT, by: 'quiet-hours' },
    ];
    assert.deepStrictEqual(environmentFaults({ concurrency }), [
      'concurrency: entry 1: its at is not an instant',
      'concurrency: entry 1: its by is not a unit\'s name, nor null',
      'concurrency: entry 3: its what "port 5432" is an earlier entry\'s',
    ]);
  });

  it('a linter is its name and its command, and its fix where it has one, nothing else, each name once', () => {
    const linters = [{ name: 'eslint', command: 'eslint .', topic: 'auth' }, { name: 'eslint', command: 'npx eslint src' }];
    assert.deepStrictEqual(environmentFaults({ linters }), [
      'linters: entry 1: "topic" is no field of a linter',
    ]);
    assert.deepStrictEqual([environmentFaults({ linters: [{ name: 'gofmt', command: 'gofmt -l .', fix: 'gofmt -w .' }] }), environmentFaults({ linters: [{ name: 'gofmt', command: 'gofmt -l .', fix: '' }] })], [
      [], ['linters: entry 1: its fix is not text'],
    ]);
    assert.deepStrictEqual(environmentFaults({ linters: linters.map(({ name, command }) => ({ name, command })) }), [
      'linters: entry 2: its name "eslint" is an earlier entry\'s',
    ]);
  });

  it('the person\'s yes is the instant it was given', () => {
    assert.deepStrictEqual([environmentFaults({ confirmed: true }), environmentFaults({ confirmed: 'once' })], [['confirmed: it is not an instant'], ['confirmed: it is not an instant']]);
  });
});
