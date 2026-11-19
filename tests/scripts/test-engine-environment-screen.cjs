'use strict';

// ---------------------------------------------------------------------------
// The environment setup's screen (ledger-engine/scripts/domain/projections/
// environment-setup.cjs; 22.5.7, 22.5.8, 22.5.9): drawn at the project's
// first ready to build from what Claude found — how to run the product, the
// steps that prepare the environment, what cannot run at once so far and the
// linters, each as found, the verify setup never asked — its gate recording
// it; and from manage, as recorded, the verify setup shown read only, its
// gate keeping it. Where each row leads, drawn through the engine, is
// test-engine-environment.cjs's.
//
// Layer: unit. The screen is drawn from values; no git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { screenOf } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { environmentSetupScreen } = require(path.join(SCRIPTS, 'domain/projections/environment-setup.cjs'));

/** @typedef {import('../../skills/ledger-engine/scripts/domain/environment.cjs').Setup} Setup */

/** What Claude found in a Go project, the setup not yet asked. @type {Setup} */
const FOUND = Object.freeze({
  run: { build: 'go build ./...', tests: 'go test ./...', run: 'go run .' },
  prepare: [{ name: 'Dependencies', when: 'both', command: 'go mod download' }],
  concurrency: [],
  verify: null,
  linters: [{ name: 'go vet', command: 'go vet ./...' }, { name: 'gofmt', command: 'gofmt -l .', fix: 'gofmt -w .' }, { name: 'golangci-lint', command: 'golangci-lint run ./...' }],
  confirmed: null,
});

/** A verify setup, as the task that builds it records it. */
const VERIFY = Object.freeze({
  place: 'verify', feature_map: 'verify/features.md', launch: 'make up', health: 'make health', drive: 'make drive', evidence: 'make evidence', cleanup: 'make down',
  ran: { unit: 'quiet-hours', scenario: '1.S1', verdict: 'proven', commits: [], at: '2026-06-03T09:00:00.000Z' },
});

/** The screen drawn: its display and its gate, as they read. @param {Partial<Setup>} setup @param {boolean} manage @param {string} [project] */
function drawn(setup, manage, project = 'Lantern') {
  const out = environmentSetupScreen({ project, setup: { ...FOUND, ...setup }, manage });
  return { display: screenOf(out, 'DISPLAY: environment setup'), gate: screenOf(out, `MENU: ${manage ? 'manage setup' : 'environment setup'}`) };
}

/** A block of the display, by its heading: its rows. @param {string[]} display @param {string} heading */
function block(display, heading) {
  const at = display.indexOf(heading);
  assert.ok(at !== -1, `no ${heading} in:\n${display.join('\n')}`);
  const end = display.indexOf('', at);
  return display.slice(at + 1, end === -1 ? undefined : end);
}

describe('the environment setup\'s screen (22.5.7, 22.5.8)', () => {
  it('22.S13, 22.S35: at the first ready to build, how to run the product, the steps, what can\'t run at once so far and the linters, as found — no verify setup — and the gate recording it', () => {
    const { display, gate } = drawn({}, false);
    assert.deepStrictEqual(display, [
      'Environment setup — Lantern',
      '',
      'HOW TO RUN LANTERN',
      '  · Build: go build ./...',
      '  · Tests: go test ./...',
      '  · Run: go run .',
      '',
      'TO PREPARE THE ENVIRONMENT, AS FOUND',
      '  · Dependencies: go mod download — before the first task, and in',
      '    each worktree a task runs in',
      '',
      'WHAT CAN\'T RUN AT ONCE, SO FAR',
      '  · Nothing found yet — a build records it when it learns it',
      '',
      'LINTERS, AS FOUND',
      '  · go vet — go vet ./...',
      '  · gofmt — gofmt -l ., its fix gofmt -w .',
      '  · golangci-lint — golangci-lint run ./...',
    ]);
    assert.deepStrictEqual(gate, [
      '· · · · · · · · · · · ·',
      'Asked once, at the first ready to build.',
      '',
      '◆ Record this setup for Lantern?',
      '',
      'y/yes   → Record it — change it later from manage',
      'Comment → Tell me what\'s different',
    ]);
  });

  it('says when each step runs, a note never run, and each thing recorded that can\'t run at once; a part found empty says so', () => {
    const prepare = [
      { name: 'Env', when: 'worktree', command: 'cp .env.example .env' },
      { name: 'Test database', when: 'first', command: 'createdb lantern_test' },
      { name: 'Signing key', when: 'first', note: 'Copy it from the vault' },
    ];
    const { display } = drawn({ run: { tests: 'go test ./...' }, prepare, concurrency: [{ what: 'the tests share port 5432', at: '2026-06-03T09:00:00.000Z', by: null }], linters: [] }, false);
    assert.deepStrictEqual([block(display, 'HOW TO RUN LANTERN'), block(display, 'TO PREPARE THE ENVIRONMENT, AS FOUND'), block(display, 'WHAT CAN\'T RUN AT ONCE, SO FAR'), block(display, 'LINTERS, AS FOUND')], [
      ['  · Tests: go test ./...'],
      ['  · Env: cp .env.example .env — in each worktree a task runs in', '  · Test database: createdb lantern_test — before the first task', '  · Signing key: Copy it from the vault — a note, never run'],
      ['  · the tests share port 5432'],
      ['  · Nothing found'],
    ]);
  });

  it('draws a note of several lines under its row, line by line: each line\'s own indent kept, a long line wrapped at it, and its blank lines kept', () => {
    const note = [
      '## Prerequisites',
      '',
      '- Xcode 16 or later, its command line tools installed and selected, before anything else builds',
      '  - Swift 6',
      '',
      'Then open the workspace.',
    ].join('\n');
    const { display } = drawn({ prepare: [{ name: 'From before Ledger', when: 'first', note }] }, true);
    const at = display.indexOf('TO PREPARE THE ENVIRONMENT');
    assert.deepStrictEqual(display.slice(at + 1, display.indexOf('WHAT CAN\'T RUN AT ONCE, SO FAR') - 1), [
      '  · From before Ledger — a note, never run',
      '    ## Prerequisites',
      '',
      '    - Xcode 16 or later, its command line tools installed and',
      '    selected, before anything else builds',
      '      - Swift 6',
      '',
      '    Then open the workspace.',
    ]);
  });

  it('22.S14, 15.S3: from manage, the parts as recorded, the verify setup beside them read only, and the gate keeping it', () => {
    const { display, gate } = drawn({ verify: VERIFY }, true);
    assert.deepStrictEqual([display.filter((line) => /^[A-Z]/.test(line)), block(display, 'THE VERIFY SETUP, BUILT BY A TASK')], [
      ['Environment setup — Lantern', 'HOW TO RUN LANTERN', 'TO PREPARE THE ENVIRONMENT', 'WHAT CAN\'T RUN AT ONCE, SO FAR', 'LINTERS', 'THE VERIFY SETUP, BUILT BY A TASK'],
      ['  · In verify, its feature map verify/features.md', '  · Launch: make up', '  · Health check: make health', '  · Drive: make drive', '  · Evidence: make evidence', '  · Cleanup: make down'],
    ]);
    assert.deepStrictEqual(gate.slice(1), [
      'The verify setup changes only through the task that builds it.',
      '',
      '◆ Keep this setup for Lantern?',
      '',
      'y/yes   → Keep it — back to manage',
      'Comment → Tell me what\'s different',
    ]);
  });

  it('from manage, a part recorded empty reads none recorded, and a verify setup not yet built says the first phase\'s tasks build it', () => {
    const { display } = drawn({ run: {}, prepare: [], linters: [] }, true);
    assert.deepStrictEqual([block(display, 'HOW TO RUN LANTERN'), block(display, 'LINTERS'), block(display, 'THE VERIFY SETUP, BUILT BY A TASK')], [
      ['  · None recorded'], ['  · None recorded'], ['  · None yet — the first phase\'s tasks build it'],
    ]);
  });

  it('asks without the project\'s name where the name would take the question past the glyph\'s length', () => {
    const { gate } = drawn({}, false, 'A Project Named At Such Great Length It Runs On');
    assert.strictEqual(gate[3], '◆ Record this setup?');
  });
});
