'use strict';

// ---------------------------------------------------------------------------
// `workunit absorb` and the ledger (domain/workunit-absorb.cjs,
// domain/ledger-rehomed.cjs; 5.8.15, 5.8.18, 18.3.5): the one `rehomed`
// line the absorb writes at the epic topic, listing every line the feature
// made and each file they name that the absorb moved; every read taking
// those lines as the epic topic's, their files where they went, the copies
// and the files every later ledger commit takes following; the calls seen
// in the feature staying seen at the epic; and the refusal where no
// conversation names the session the line is written in.
//
// Layer: verb. World: absorb-world.cjs's feature and epic, built once with
// the feature's lines written through the ledger's verbs and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, stateGit, commitAll, fixtureFrom, layout } = require('./engine-harness.cjs');
const { SESSION, SESSION_ID, MADE, ids, ledgerHelpers, copiesHelpers } = require('./ledger-world.cjs');
const {
  ABSORB, writeFile, featureManifest, epicManifest, fillFixture, copyFixture, removeFixture, engine, engineFails, headFiles, treeSnapshot,
} = require('./absorb-world.cjs');

const AT_FEATURE = 'auth-flow.discussion.auth-flow';
const LOG = 'auth-flow/topics/auth-flow/log.md';
const SHOT = 'auth-flow/assets/shot.png';
const DISCOVERY_LOG = 'auth-flow/discovery/session-001.md';
const TOPIC_COPY = layout.knowledge('records', 'payments', 'auth.md');
const FEATURE_COPIES = [layout.knowledge('records', 'auth-flow', 'auth-flow.md'), layout.knowledge('records', 'auth-flow.md')];

/** The short ids of the lines `linesWorld` made, filled as it is first built. */
const made = /** @type {Record<'found'|'question'|'decided'|'measured'|'own'|'ownCall', string>} */ ({});

/**
 * The world every test here starts from, built once and copied: the feature
 * running a series, a line made at each of its places — its unit's level,
 * its discussion, its experiment — the finding linking an asset whose name
 * one of the epic's holds, the decision citing the log and a discovery log
 * the absorb deletes; and a question and its answer of the epic's own.
 */
const linesWorld = fixtureFrom('engine-wu-absorb-lines-', (template) => {
  const feature = featureManifest({ phases: {
    discussion: { items: { 'auth-flow': { status: 'in-progress' } } },
    experiment: { items: { 'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'dup-rate', status: 'running' } } } } },
  } });
  const epic = epicManifest();
  epic.phases.discussion = { items: { 'fee-model': { status: 'in-progress' } } };
  fillFixture(template, { feature, epic });
  writeFile(template, `.leeway/${LOG}`, '# Discussion\n\n## Session 1\n');
  writeFile(template, `.leeway/${DISCOVERY_LOG}`, '# Discovery\n\n## Session 1\n');
  writeFile(template, '.leeway/auth-flow/topics/auth-flow/experiments/E1-dup-rate/problem.md', '# Problem\n');
  writeFile(template, `.leeway/${SHOT}`, 'feature shot\n');
  writeFile(template, '.leeway/payments/assets/shot.png', 'epic shot\n');
  commitAll(template, 'series');
  const { write } = ledgerHelpers(() => template);
  const { ask, decide } = copiesHelpers(() => template);
  const find = (/** @type {string} */ address, /** @type {string} */ text) => write('find', address, [], { ...MADE, text, how: 'seen in a spike', known: 'spike' }).id;
  const found = find('auth-flow.discovery', 'Logins fail at peak.');
  ok(template, ['asset', 'add', 'auth-flow', SHOT, '--entry', found, '--status', 'canonical'], { env: SESSION });
  const question = ask(AT_FEATURE, 'Does a session outlive its token?');
  const cites = [{ path: LOG, section: 'Session 1' }, { path: DISCOVERY_LOG, section: 'Session 1' }];
  Object.assign(made, {
    found,
    question,
    decided: decide(AT_FEATURE, question, 'No: it ends with its token.', [], { cites }),
    measured: find('auth-flow.experiment.auth-flow', 'A token expires mid-session one time in twenty.'),
    own: ask('payments.discussion.fee-model', 'Who pays the fee?'),
  });
  made.ownCall = decide('payments.discussion.fee-model', made.own, 'The buyer.');
});

describe('engine workunit absorb — the ledger follows the topic (5.8.18)', () => {
  /** @type {import('./absorb-world.cjs').Fixture} */
  let fix;
  afterEach(() => removeFixture(fix));

  const project = () => fix.project;
  const { rawLines, entries, full } = ledgerHelpers(project);
  const { ask, copy, indexedText } = copiesHelpers(project);
  /** @param {string[]} args */
  const ledger = (...args) => engine(fix, ['ledger', ...args], SESSION);

  /** A copy of `linesWorld` for the running test. */
  function setupWithLines() {
    fix = copyFixture(linesWorld);
  }

  it('carries every line the feature made — at its unit\'s level, its discussion, its experiment — in one line at the epic topic, with each file they name that the absorb moved, the epic\'s own left out, in the absorb\'s one commit', () => {
    setupWithLines();
    const before = rawLines();
    const commits = Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD']));
    engine(fix, ABSORB, SESSION);

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'every line before the carry is kept as written');
    const { v: _v, id: _id, at: _at, ...carry } = entries().at(-1);
    const link = entries().find((e) => e.event === 'asset');
    assert.deepStrictEqual(carry, {
      event: 'rehomed', unit: 'payments', topic: 'auth', phase: 'discussion', session: SESSION_ID,
      lines: [full(made.found), link.id, full(made.question), full(made.decided), full(made.measured)],
      files: [[SHOT, 'payments/assets/shot-2.png'], [LOG, 'payments/topics/auth/log.md']],
    }, 'a file the absorb deleted, the discovery log, is no file it moved');
    assert.strictEqual(Number(stateGit(fix.project, ['rev-list', '--count', 'HEAD'])), commits + 1);
    assert.ok(headFiles(fix).includes(layout.ledger), 'the carry rides the absorb\'s commit');
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain']), '');
  });

  it('every read takes the carried lines as the epic topic\'s, their files where the absorb moved them — its record and its map — and the copies follow: the feature\'s removed, the topic\'s written and indexed', () => {
    setupWithLines();
    assert.ok(FEATURE_COPIES.every((rel) => copy(rel) !== null));
    engine(fix, ABSORB, SESSION);

    const record = ledger('record', 'payments', 'auth');
    assert.deepStrictEqual([ids(record.questions), ids(record.findings), ids(record.decisions)], [[made.question], [made.found, made.measured], [made.decided]]);
    assert.deepStrictEqual([...record.questions, ...record.findings, ...record.decisions].map((e) => [e.unit, e.topic, e.phase]),
      [['payments', 'auth', 'discussion'], ['payments', 'auth', 'discovery'], ['payments', 'auth', 'experiment'], ['payments', 'auth', 'discussion']]);
    assert.deepStrictEqual([record.findings[0].assets, record.decisions[0].cites], [
      [{ path: 'payments/assets/shot-2.png', status: 'canonical', into: null }],
      [{ path: 'payments/topics/auth/log.md', section: 'Session 1' }, { path: DISCOVERY_LOG, section: 'Session 1' }],
    ]);
    assert.deepStrictEqual(ledger('map', 'payments', 'auth').questions.map((r) => [r.id, r.stands, ids(r.answers)]), [[made.question, 'answered', [made.decided]]]);
    assert.deepStrictEqual(ids(ledger('record', 'payments', 'fee-model').questions), [made.own]);
    assert.deepStrictEqual(FEATURE_COPIES.map(copy), [null, null]);
    assert.match(/** @type {string} */ (copy(TOPIC_COPY)), /No: it ends with its token\./);
    assert.match(indexedText(), /No: it ends with its token\./);
  });

  it('a later ledger commit takes a carried link\'s file where the absorb moved it, never the path it left — a file there since stays untracked', () => {
    setupWithLines();
    engine(fix, ABSORB, SESSION);
    writeFile(fix.project, '.leeway/payments/assets/shot-2.png', 'feature shot, edited\n');
    writeFile(fix.project, `.leeway/${SHOT}`, 'a shot imported under the name made again\n');

    ask('payments.discussion.auth', 'What does the shot show?');
    assert.deepStrictEqual(headFiles(fix), [layout.ledger, 'payments/assets/shot-2.png']);
    assert.strictEqual(stateGit(fix.project, ['status', '--porcelain', '--untracked-files=all']), `?? ${SHOT}\n`);
  });

  it('a call seen in the feature stays seen at the epic topic: the feature\'s last-looked mark joins the epic\'s, which keeps its own', () => {
    setupWithLines();
    const calls = (/** @type {string[]} */ ...args) => ledger(...args).calls.map((/** @type {{id: string}} */ c) => c.id);
    assert.deepStrictEqual([calls('shown', 'payments', 'fee-model'), calls('shown', 'auth-flow', 'auth-flow')], [[made.ownCall], [made.decided]]);
    engine(fix, ABSORB, SESSION);

    assert.deepStrictEqual([calls('since', 'payments', 'auth'), calls('since', 'payments', 'fee-model')], [[], []]);
    const marks = path.join(fix.project, '.leeway/.cache/.marks');
    assert.deepStrictEqual([fs.readdirSync(marks), JSON.parse(fs.readFileSync(path.join(marks, 'payments.json'), 'utf8'))],
      [['payments.json'], { shown: [full(made.ownCall), full(made.decided)] }]);
  });

  it('refuses a feature holding lines where no conversation names the session the carry is made in, both units pristine', () => {
    setupWithLines();
    const before = treeSnapshot(fix);
    assert.match(engineFails(fix, ABSORB).error,
      /^feature "auth-flow" holds ledger entries, which the absorb carries to the epic topic in this conversation — Claude Code hands every command it runs a session id, and this one has none$/);
    assert.deepStrictEqual(treeSnapshot(fix), before);
  });
});
