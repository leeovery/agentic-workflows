'use strict';

// ---------------------------------------------------------------------------
// Discovery's sessions (leeway-engine/scripts/domain/discovery-session.cjs),
// `engine discovery-session close <work-unit|product>`, at either of its
// places (8.1.4): an epic's logs in `{unit}/discovery/session-NNN.md`, its
// marker on the unit's manifest; the product's conversation's in
// `.product/sessions/session-NNN.md`, its marker `product_session` on the
// project manifest. close clears the marker and commits the place's scope
// with the caller's message, indexing nothing (8.14.7); every refusal
// writes and commits nothing. The open is the entry's
// (test-engine-enter.cjs); what a commit takes with a log — the files it
// links — is test-engine-state-commit-layout.cjs's; `commit --discovery`
// and `--product` are test-engine-commit-door.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library holding an epic mid-session (logs 001 and 002, the marker on 002)
// and the product's logs 001 and 004, no session open — built once,
// committed, and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const {
  ok, refusedPristine, lastMessage, touched, stateGit, statePath, layout, readState, writeState, readManifest,
  fixtureFrom, cleanupFixture, commitAll, keywordOnlyKnowledge, hasStore,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const EPIC = 'payments';
const DISCOVERY = Object.freeze({ items: { fees: { source: 'discovery', summary: 'Fees' } }, dismissed: ['dead-idea'] });

const world = fixtureFrom('discovery-session-', (template) => {
  createManifest(template, EPIC, { work_type: 'epic', phases: { discovery: { ...DISCOVERY, active_session: '002' } } });
  writeState(template, layout.projectManifest, JSON.stringify({ work_units: { [EPIC]: { work_type: 'epic' } } }, null, 2));
  for (const n of ['001', '002']) writeState(template, layout.session(EPIC, n), `# Session ${n}\n`);
  for (const n of ['001', '004']) writeState(template, layout.productSession(n), `# Product session ${n}\n`);
  commitAll(template, 'init');
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

/** A call that must succeed: its response. @param {string[]} args */
const session = (args) => ok(dir, ['discovery-session', ...args]);

/** A call that must be refused, writing and committing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['discovery-session', ...args]).error;

/** The epic between sessions: its marker cleared, committed. */
function epicClosed() {
  createManifest(dir, EPIC, { work_type: 'epic', phases: { discovery: DISCOVERY } });
  commitAll(dir, 'between sessions');
}

/** The product's conversation with session 005 open, as the entry leaves it, committed. */
function productOpen() {
  writeState(dir, layout.productSession('005'), '');
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, product_session: '005' }, null, 2));
  commitAll(dir, 'the product open');
}

/** The files the state branch's last commit touched. */
const committed = () => touched(statePath(dir), 'HEAD');

describe('an epic\'s session (8.1.4, 8.S40)', () => {
  it('close clears the marker and commits the unit\'s discovery with the caller\'s message, the log with it — never a peer\'s topic, and nothing indexed (8.14.7)', () => {
    keywordOnlyKnowledge(dir);
    writeState(dir, layout.session(EPIC, '002'), '# Session 002\n\nThree topics found.\n');
    writeState(dir, layout.doc(EPIC, 'investigation', 'refunds'), '# A peer session mid-turn\n');

    const res = session(['close', EPIC, '-m', `discovery(${EPIC}): three topics`]);

    assert.deepStrictEqual(res, {
      ok: true, session: '002', session_log: statePath(dir, layout.session(EPIC, '002')), committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), warnings: [],
    });
    assert.deepStrictEqual(readManifest(dir, EPIC).phases.discovery, DISCOVERY);
    assert.strictEqual(lastMessage(dir), `discovery(${EPIC}): three topics`);
    assert.deepStrictEqual(committed(), [`M\t${layout.session(EPIC, '002')}`, `M\t${layout.manifest(EPIC)}`].sort());
    assert.strictEqual(fs.existsSync(statePath(dir, layout.doc(EPIC, 'investigation', 'refunds'))), true);
    assert.strictEqual(hasStore(dir), false, 'the close indexed the log');
  });

  it('refuses a close with no session open, and one whose marker names no log on disk', () => {
    createManifest(dir, EPIC, { work_type: 'epic', phases: { discovery: { ...DISCOVERY, active_session: '007' } } });
    commitAll(dir, 'a marker with no log');
    assert.strictEqual(refused(['close', EPIC, '-m', 'm']), `session log missing on disk: ${statePath(dir, layout.session(EPIC, '007'))} — the active-session marker names a session with no log`);
    epicClosed();
    assert.strictEqual(refused(['close', EPIC, '-m', 'm']), `no discovery session is open for "${EPIC}" — nothing to close`);
  });
});

describe('the product\'s conversation (8.1.4, 4.11.16, 8.14.3)', () => {
  it('close clears the marker and commits its logs and the project manifest with the caller\'s message — never a unit\'s brief', () => {
    productOpen();
    writeState(dir, layout.productSession('005'), '## 2026-01-06 · session five\n');
    writeState(dir, layout.topic(EPIC, 'fees', 'brief.md'), '# Fees\n');

    const res = session(['close', 'product', '-m', 'product: session 005']);

    assert.strictEqual(res.session, '005');
    assert.strictEqual('product_session' in JSON.parse(readState(dir, layout.projectManifest)), false);
    assert.strictEqual(lastMessage(dir), 'product: session 005');
    assert.deepStrictEqual(committed(), [`M\t${layout.productSession('005')}`, `M\t${layout.projectManifest}`].sort());
  });

  it('refuses a close with none open', () => {
    assert.strictEqual(refused(['close', 'product', '-m', 'm']), 'no discovery session is open for "product" — nothing to close');
  });
});

describe('the verb\'s argv', () => {
  it('refuses a missing message, a positional too many, and a subcommand it lacks — open among them, the entry\'s — each with its usage', () => {
    for (const [args, said] of [
      [['close', EPIC], 'Usage: engine discovery-session close <work-unit|product> -m <message>'],
      [['close', EPIC, 'extra', '-m', 'm'], 'unexpected argument "extra"'],
      [['open', EPIC], 'Usage: engine discovery-session close <work-unit|product> -m <message>'],
    ]) assert.strictEqual(refused(args), said);
  });
});
