'use strict';

// ---------------------------------------------------------------------------
// `engine ledger carry` (leeway-engine/scripts/domain/ledger-carry.cjs; 21.6,
// 21.10.9): a topic's record carried into the ledger while the migration
// runs — the whole record appended as one, each entry its event's content
// with its links by id, moving no one, a decision unchecked, an asset link
// after its entry; what was carried kept in the state's cache, ahead of the
// append; the commit held for the migration's. A cancelled unit's topic
// carried as any other; a topic carried once, a session killed as the
// ledger is renamed in leaving none of its entries, so the redo holds each
// once; and every refusal of the verb's own writing nothing. The rules the
// records directive holds a record to are test-migration-079.cjs's.
//
// Layer: verb, the kill spawned. World: the records directive's
// (migration-world.cjs), made once and copied for each test that writes,
// and once for the refusals, which write nothing.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, refuses, git, statePath, layout, writeState, readState, cleanupFixture, ledgerEntries, killedAt } = harness;
const { SESSION, recordsMigration, stateUnborn, refusedUntouched } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { carriedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

const LICENSING = 'fumi.discussion.licensing';
const QUESTION = { ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person', map_item: 'trial-length', cites: [{ path: 'fumi/topics/licensing/log.md', section: 'Trial Length' }] };
const DECISION = {
  ref: 'd1', event: 'decided', answers: 'q1', text: 'Fourteen days.', why: 'The person set it.', by: 'claude', given: 'carried', map_item: 'trial-length',
  cites: [{ path: 'fumi/topics/licensing/log.md', section: 'Decision' }], assets: [{ path: 'fumi/assets/pricing.md', status: 'reference' }],
};
const FINDING = {
  ref: 'f1', event: 'found', text: 'Trials convert at 4%.', how: 'read in the pricing notes', known: 'read', relies_on: ['d1'], by: 'claude', product_wide: true,
  cites: [{ path: 'fumi/topics/licensing/brief.md', section: 'Licensing' }],
};

/** @type {string} */
let dir;

/** The records directive's world, at a fresh folder. */
const world = () => recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-carry-')), 'fumi'));

/** A call that must refuse, writing nothing: its error. @param {string[]} args @param {import('./engine-harness.cjs').CallOptions} [opts] */
const untouched = (args, opts = { env: SESSION }) => refusedUntouched(dir, args, opts, harness);

/** A record written beside the project, its path. @param {unknown} record */
function recordFile(record) {
  const file = path.join(path.dirname(dir), 'record.json');
  fs.writeFileSync(file, typeof record === 'string' ? record : JSON.stringify(record));
  return file;
}

/** @param {string} dotpath @param {unknown[]} entries */
const carry = (dotpath, entries) => ok(dir, ['ledger', 'carry', dotpath, '--file', recordFile({ entries })], { env: SESSION });

/** What was kept of a topic carried. @param {string} unit @param {string} topic */
const kept = (unit, topic) => JSON.parse(readState(dir, carriedPath(unit, topic)));

/** The ledger's entries, without what the engine mints. */
const lines = () => ledgerEntries(statePath(dir)).map(({ id: _, at: __, ...line }) => line);

describe('a topic\'s record carried (21.6, 21.10.9)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('appended as one: each entry tagged, its content and its links by id, moving no one, a decision unchecked, its asset links after it; what was carried kept; the commit held', () => {
    const res = carry(LICENSING, [QUESTION, DECISION, FINDING]);
    const entries = ledgerEntries(statePath(dir));
    const [q, d, , f] = entries;
    const tags = { v: 2, unit: 'fumi', topic: 'licensing', phase: 'discussion', session: SESSION.CLAUDE_CODE_SESSION_ID };

    assert.deepStrictEqual(res, { ok: true, carried: 3, ids: { q1: q.id.slice(0, res.ids.q1.length), d1: d.id.slice(0, res.ids.d1.length), f1: f.id.slice(0, res.ids.f1.length) }, committed: null, note: 'held for the migration\'s commit' });
    assert.deepStrictEqual(lines(), [
      { ...tags, event: 'asked', by: 'person', who_moved_whom: 'none', text: QUESTION.text, part_of: null, relies_on: [], cites: QUESTION.cites },
      {
        ...tags, event: 'decided', by: 'claude', who_moved_whom: 'none', answers: q.id, text: 'Fourteen days.', why: 'The person set it.', rules_out: [], relies_on: [], product_wide: false,
        sealed: null, alternatives: [], evidence: [], kind: null, unchecked: true, given: 'carried', cites: DECISION.cites,
      },
      { ...tags, event: 'asset', entry: d.id, path: 'fumi/assets/pricing.md', status: 'reference', into: null },
      {
        ...tags, event: 'found', by: 'claude', who_moved_whom: 'none', text: FINDING.text, how: FINDING.how, relies_on: [d.id], product_wide: true, known: 'read', command: null, result: null, cites: FINDING.cites,
      },
    ]);
    assert.deepStrictEqual(kept('fumi', 'licensing'), {
      unit: 'fumi',
      phase: 'discussion',
      topic: 'licensing',
      entries: [{ ref: 'q1', id: q.id, map_item: 'trial-length', thread: null }, { ref: 'd1', id: d.id, map_item: 'trial-length', thread: null }, { ref: 'f1', id: f.id, map_item: null, thread: null }],
    });
    assert.ok(stateUnborn(dir));
  });

  it('21.S44: a cancelled unit\'s topic is carried as any other, its entries in the ledger', () => {
    carry('gone.discussion.gone', [{ ref: 'q1', event: 'asked', text: 'What caused it?', by: 'claude', map_item: 'cause', cites: [{ path: 'gone/topics/gone/log.md', section: 'Cause' }] }]);

    assert.deepStrictEqual(lines().map(({ unit, topic, text }) => [unit, topic, text]), [['gone', 'gone', 'What caused it?']]);
  });

  it('a record of no entries, for a topic with no log, is kept, the ledger left as it was', () => {
    assert.deepStrictEqual(carry('fumi.discovery.billing', []), { ok: true, carried: 0, ids: {}, committed: null });
    assert.deepStrictEqual([kept('fumi', 'billing').entries, fs.existsSync(statePath(dir, layout.ledger))], [[], false]);
  });

  it('outside the migration: once the state branch has its first commit, refused, nothing written', () => {
    git(statePath(dir), ['add', '-A']);
    git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);
    const head = git(statePath(dir), ['rev-parse', 'HEAD']);

    const { error } = refuses(dir, ['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [QUESTION, DECISION] })], { env: SESSION });

    assert.strictEqual(error, 'ledger carry: a topic\'s record is carried into the ledger only while the migration runs — the state branch has its first commit, so the migration is done');
    assert.deepStrictEqual([fs.existsSync(statePath(dir, layout.ledger)), fs.existsSync(statePath(dir, carriedPath('fumi', 'licensing'))), git(statePath(dir), ['rev-parse', 'HEAD'])], [false, false, head]);
  });
});

describe('a redo never duplicates (21.10.9)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('a topic\'s record is carried once: carried again, it is refused, nothing written', () => {
    carry(LICENSING, [QUESTION, DECISION]);

    assert.strictEqual(untouched(['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [QUESTION, DECISION] })]),
      'ledger carry: the ledger holds entries on fumi\'s licensing already — a topic\'s record is carried once');
    assert.strictEqual(lines().length, 3);
  });

  it('killed as the ledger is renamed in, the topic has none of its entries and its record is kept; carried again, the ledger holds each once', () => {
    const args = ['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [QUESTION, DECISION] })];
    killedAt({ method: 'renameSync', file: layout.ledger, when: 'before' }, dir, args, { env: SESSION });

    assert.deepStrictEqual([fs.existsSync(statePath(dir, layout.ledger)), kept('fumi', 'licensing').entries.length], [false, 2]);
    ok(dir, args, { env: SESSION });
    assert.deepStrictEqual(lines().map(({ event, text, path: file }) => text ?? file ?? event), ['How long is the trial?', 'Fourteen days.', 'fumi/assets/pricing.md']);
  });

  it('killed once the ledger is renamed in, the topic has all of its entries, and is never carried again', () => {
    const args = ['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [QUESTION, DECISION] })];
    killedAt({ method: 'renameSync', file: layout.ledger, when: 'after' }, dir, args, { env: SESSION });

    const landed = readState(dir, layout.ledger);

    assert.strictEqual(landed.split('\n').filter(Boolean).length, 3);
    assert.match(refuses(dir, args, { env: SESSION }).error, /a topic's record is carried once$/);
    assert.strictEqual(readState(dir, layout.ledger), landed);
  });
});

describe('the refusals, nothing written', () => {
  before(() => { dir = world(); });
  after(() => cleanupFixture(path.dirname(dir)));

  it('no session, argv of another shape, a place naming no topic, and a file holding no record', () => {
    const file = recordFile({ entries: [QUESTION] });
    const usage = 'Usage: engine ledger carry <work-unit>.<phase>.<topic> --file <record>   (the topic\'s record as JSON, {"entries": [...]})';
    assert.deepStrictEqual([
      untouched(['ledger', 'carry', LICENSING, '--file', file], { env: {} }),
      untouched(['ledger', 'carry', LICENSING]),
      untouched(['ledger', 'carry', '--file', file]),
      untouched(['ledger', 'carry', LICENSING, 'more', '--file', file]),
      untouched(['ledger', 'carry', 'fumi.discussion', '--file', file]),
      untouched(['ledger', 'carry', 'fumi.specification.licensing', '--file', file]),
      untouched(['ledger', 'carry', 'nope.discussion.licensing', '--file', file]),
      untouched(['ledger', 'carry', 'gone.investigation.gone', '--file', file]),
      untouched(['ledger', 'carry', 'fumi.discussion.billing', '--file', file]),
      untouched(['ledger', 'carry', LICENSING, '--file', path.join(path.dirname(dir), 'missing.json')]).replace(/: ENOENT[^]*$/, ''),
      untouched(['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [QUESTION], more: true })]).replace(path.dirname(dir), '{dir}'),
      untouched(['ledger', 'carry', LICENSING, '--file', recordFile({ entries: ['q1'] })]).replace(path.dirname(dir), '{dir}'),
    ], [
      'ledger carry: no session to tag the entries with — CLAUDE_CODE_SESSION_ID is not set',
      usage,
      usage,
      usage,
      'ledger carry: "fumi.discussion" names no topic — <work-unit>.<phase>.<topic>',
      'ledger carry: no topic is in "specification" — one of discovery, research, experiment, discussion, investigation',
      'ledger carry: there is no work unit "nope"',
      'ledger carry: gone has no investigation phase',
      'ledger carry: fumi has no topic "billing" in discussion',
      `ledger carry: the record could not be read from ${path.join(path.dirname(dir), 'missing.json')}`,
      'ledger carry: {dir}/record.json holds no record — a record is {"entries": [...]}, each entry an object',
      'ledger carry: {dir}/record.json holds no record — a record is {"entries": [...]}, each entry an object',
    ]);
  });

  it('an entry of no ref, a ref twice, another event, who moved whom given, a link naming no earlier entry of its kind, a question answered twice, a map item of a finding, a thread of a decision, and content its write refuses', () => {
    const refused = (/** @type {unknown[]} */ entries) => untouched(['ledger', 'carry', LICENSING, '--file', recordFile({ entries })]);
    const { assets: _, ...decision } = DECISION;
    assert.deepStrictEqual([
      refused([{ ...QUESTION, ref: undefined }]),
      refused([QUESTION, QUESTION]),
      refused([{ ...QUESTION, event: 'moved' }]),
      refused([{ ...QUESTION, who_moved_whom: 'none' }]),
      refused([{ ...QUESTION, ref: 'q2', part_of: 'q1' }, QUESTION]),
      refused([QUESTION, { ...decision, part_of: 'q1' }]),
      refused([QUESTION, { ...decision, answers: undefined }]),
      refused([QUESTION, { ...FINDING, answers: 'q1' }]),
      refused([decision, QUESTION]),
      refused([QUESTION, { ...FINDING, relies_on: [] }, { ...decision, answers: 'f1' }]),
      refused([QUESTION, decision, { ...decision, ref: 'd2' }]),
      refused([QUESTION, { ...decision, relies_on: ['d1'] }]),
      refused([{ ...FINDING, relies_on: [], map_item: 'pricing' }]),
      refused([QUESTION, { ...decision, thread: 'index-size' }]),
      refused([{ ...QUESTION, text: '' }]),
      refused([{ ...QUESTION, why: 'Because.' }]),
      refused([QUESTION, { ...decision, by: 'person' }]),
      refused([{ ...FINDING, relies_on: [], known: 'measured' }]),
    ], [
      'ledger carry: entry 1: gives no ref, the name the record links it by',
      'ledger carry: entry q1: its ref is given twice',
      'ledger carry: entry q1: its event is none of asked, found, decided',
      'ledger carry: entry q1: gives who_moved_whom — an entry the migration carries moves no one',
      'ledger carry: entry q2: part_of names q1, and no entry before it is a question of that ref',
      'ledger carry: entry d1: only a question is part of another',
      'ledger carry: entry d1: a decision answers a question of the record',
      'ledger carry: entry f1: only a decision answers',
      'ledger carry: entry d1: answers names q1, and no entry before it is a question of that ref',
      'ledger carry: entry d1: answers names f1, and no entry before it is a question of that ref',
      'ledger carry: entry d2: answers q1, which another decision of the record answers — a question\'s current answer is one',
      'ledger carry: entry d1: relies_on names d1, and no entry before it is an entry of that ref',
      'ledger carry: entry f1: a map item is a question\'s or a decision\'s, named',
      'ledger carry: entry d1: a thread is a question\'s, named',
      'ledger carry: entry q1: the content\'s text is not non-empty text',
      'ledger carry: entry q1: the content has no field why — it holds by, who_moved_whom, text, cites',
      'ledger carry: entry d1: the person\'s decision is given carried — the person\'s own is given own, and what they hand over, or what is carried over, is Claude\'s line, by claude',
      'ledger carry: entry f1: a measured finding records the command run and its result — the content needs command and result',
    ]);
  });

  it('an asset of another shape, or one the state holds no file at', () => {
    const refused = (/** @type {unknown} */ assets) => untouched(['ledger', 'carry', LICENSING, '--file', recordFile({ entries: [{ ...QUESTION, assets }] })]);
    writeState(dir, 'fumi/assets/folder/inside.md', '# Inside\n');
    assert.deepStrictEqual([
      refused('fumi/assets/pricing.md'),
      refused([{ path: 'fumi/assets/pricing.md', status: 'primary' }]),
      refused([{ path: 'fumi/assets/pricing.md' }]),
      refused([{ path: 'fumi/assets/missing.md', status: 'reference' }]),
      refused([{ path: 'fumi/assets/folder', status: 'reference' }]),
      refused([{ path: '../fumi/assets/pricing.md', status: 'reference' }]),
    ], [
      'ledger carry: entry q1: assets is a list of {path, status}',
      'ledger carry: entry q1: an asset is {path, status}, its status canonical or reference',
      'ledger carry: entry q1: an asset is {path, status}, its status canonical or reference',
      'ledger carry: entry q1: the asset fumi/assets/missing.md is no file the state holds — an asset\'s path is from the state root',
      'ledger carry: entry q1: the asset fumi/assets/folder is no file the state holds — an asset\'s path is from the state root',
      'ledger carry: entry q1: the asset ../fumi/assets/pricing.md is no file the state holds — an asset\'s path is from the state root',
    ]);
  });
});
