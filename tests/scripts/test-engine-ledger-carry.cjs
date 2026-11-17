'use strict';

// ---------------------------------------------------------------------------
// `engine ledger carry` (ledger-engine/scripts/domain/ledger-carry.cjs; 21.6,
// 21.10.9): a topic's record carried into the ledger while the migration
// runs, read where it is composed in the state — the whole record appended
// as one, each entry its event's content with its links by id, moving no
// one, a decision unchecked, an asset link after its entry; what was
// carried kept in the state's cache, ahead of the append; the verifier's
// findings and a refusal beside the record cleared; the commit held for the
// migration's. A cancelled unit's topic
// carried as any other; sibling decisions answering one question (5.3.13),
// and a map item and a thread on any entry, carried; a topic carried once,
// a session killed as the ledger is renamed in leaving none of its entries,
// so the redo holds each once; every refusal of the verb's own writing
// nothing, and what the record's composer must answer writing nothing but
// the refusal beside the record, every fault of the record named in one
// refusal — each entry's, each check of an entry whichever others break,
// and the directive's rules; a map item and a thread a name or a list of
// names. The dry run answers the same faults, none for a record the carry
// takes, writing nothing, and needs no session. The rules the records
// directive holds a record to are test-migration-079.cjs's.
//
// Layer: verb, the kill spawned. World: the records directive's
// (migration-world.cjs), made once and copied for each test that writes,
// and once for the refusals and the dry runs, which write nothing.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, refuses, git, statePath, layout, writeState, readState, cleanupFixture, ledgerEntries, killedAt, treeSnapshot } = harness;
const { SESSION, recordsMigration, stateUnborn, refusedUntouched, refusedKeeping, passedBeside } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { carriedPath, composedPath, findingsPath, rulingsPath, handbackPath, checkedPath, verifyingPath, roundsPath, refusedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

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

/** A topic's record composed where the directive keeps it, and passed by its verifier, the carry's argv. @param {string} dotpath @param {unknown} record */
function composed(dotpath, record) {
  const [unit, , topic] = dotpath.split('.');
  writeState(dir, composedPath(unit, topic), typeof record === 'string' ? record : JSON.stringify(record));
  const entries = typeof record === 'object' && record !== null && Array.isArray(/** @type {{entries?: unknown}} */ (record).entries) ? /** @type {unknown[]} */ (/** @type {{entries: unknown[]}} */ (record).entries) : [];
  for (const [rel, text] of passedBeside(unit, topic, entries)) writeState(dir, rel, text);
  return ['ledger', 'carry', dotpath];
}

/** A file licensing's composer must mend, refused, nothing written but the refusal beside it: the refusal. @param {unknown} record */
const mendFile = (record) => refusedKeeping(dir, composed(LICENSING, record), refusedPath('fumi', 'licensing'));

/**
 * An entry that keeps licensing's rules: its old map's item named, and the
 * import come in from it linked, so a record ending on it is refused for
 * its other entries alone.
 */
const KEEPS = Object.freeze({
  ref: 'f0', event: 'found', text: 'The trial is priced in the notes.', how: 'read in the log', known: 'read', by: 'claude', map_item: 'trial-length',
  cites: [{ path: 'fumi/topics/licensing/log.md', section: 'Trial Length' }], assets: [{ path: 'fumi/assets/pricing.md', status: 'reference' }],
});

/** Licensing's entries, ending on one that keeps its rules, refused: the refusal. @param {unknown[]} entries */
const mend = (entries) => mendFile({ entries: [...entries, KEEPS] });

/** The refusal of licensing's record, naming every fault. @param {string[]} faults */
const broken = (...faults) => `ledger carry: fumi's licensing breaks the records directive's rules, so nothing is carried — ${faults.join('; ')}`;

/** @param {string} dotpath @param {unknown[]} entries */
const carry = (dotpath, entries) => ok(dir, composed(dotpath, { entries }), { env: SESSION });

/**
 * The note a verifier's brief writes beside licensing's record of its
 * question and decision: the refs it asks a verdict of, and the entries it
 * reads, none passed before.
 * @param {string[]} asked @param {string[]} held
 */
const noted = (asked, held) => JSON.stringify({
  hash: crypto.createHash('sha256').update(JSON.stringify({ entries: [QUESTION, DECISION] })).digest('hex'),
  refs: asked, entries: Object.fromEntries(held.map((ref) => [ref, `${ref}-hash`])), sections: {}, before: { entries: null, passed: {}, walked: {} },
});

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
    const tags = { v: 1, unit: 'fumi', topic: 'licensing', phase: 'discussion', session: SESSION.CLAUDE_CODE_SESSION_ID };

    assert.deepStrictEqual(res, { ok: true, carried: 3, ids: { q1: q.id.slice(0, res.ids.q1.length), d1: d.id.slice(0, res.ids.d1.length), f1: f.id.slice(0, res.ids.f1.length) }, committed: null, note: 'held for the migration\'s commit' });
    assert.deepStrictEqual(lines(), [
      { ...tags, event: 'asked', by: 'person', who_moved_whom: 'none', text: QUESTION.text, part_of: null, relies_on: [], cites: QUESTION.cites, task: null },
      {
        ...tags, event: 'decided', by: 'claude', who_moved_whom: 'none', answers: q.id, text: 'Fourteen days.', why: 'The person set it.', rules_out: [], relies_on: [], product_wide: false,
        sealed: null, alternatives: [], evidence: [], kind: null, hard_to_undo: null, unchecked: true, given: 'carried', cites: DECISION.cites, task: null,
      },
      { ...tags, event: 'asset', entry: d.id, path: 'fumi/assets/pricing.md', status: 'reference', into: null },
      {
        ...tags, event: 'found', by: 'claude', who_moved_whom: 'none', text: FINDING.text, how: FINDING.how, relies_on: [d.id], product_wide: true, known: 'read', command: null, result: null, cites: FINDING.cites, task: null,
      },
    ]);
    assert.deepStrictEqual(kept('fumi', 'licensing'), {
      unit: 'fumi', phase: 'discussion', topic: 'licensing', entries: [{ ref: 'q1', id: q.id }, { ref: 'd1', id: d.id }, { ref: 'f1', id: f.id }], record: { entries: [QUESTION, DECISION, FINDING] },
    });
    assert.ok(stateUnborn(dir));
  });

  it('21.S44: a cancelled unit\'s topic is carried as any other, its entries in the ledger', () => {
    carry('gone.discussion.gone', [{ ref: 'q1', event: 'asked', text: 'What caused it?', by: 'claude', map_item: 'cause', cites: [{ path: 'gone/topics/gone/log.md', section: 'Cause' }], assets: [{ path: 'gone/assets/notes.md', status: 'reference' }] }]);

    assert.deepStrictEqual(lines().map(({ unit, topic, text, path: file }) => [unit, topic, text ?? file]), [['gone', 'gone', 'What caused it?'], ['gone', 'gone', 'gone/assets/notes.md']]);
  });

  it('5.3.13: sibling decisions, each answering one question, carried; a map item and a thread on any entry, a finding\'s and a decision\'s among them', () => {
    const { assets: _, ...decision } = DECISION;
    const sibling = { ...decision, ref: 'd2', text: 'Extended once, by a week.', map_item: undefined, thread: 'trial-extension' };
    const mapped = { ...FINDING, relies_on: [], map_item: ['trial-length', 'seat-count'] };

    const { ids } = carry(LICENSING, [QUESTION, DECISION, sibling, mapped]);
    const [q, d1, , d2] = ledgerEntries(statePath(dir));

    assert.deepStrictEqual([d1.answers, d2.answers, q.id.startsWith(ids.q1)], [q.id, q.id, true]);
  });

  it('a record of no entries, for a topic with no log and nothing come in from it, is kept, the ledger left as it was', () => {
    assert.deepStrictEqual(carry('fumi.discovery.support', []), { ok: true, carried: 0, ids: {}, committed: null });
    assert.deepStrictEqual([kept('fumi', 'support').entries, fs.existsSync(statePath(dir, layout.ledger))], [[], false]);
  });

  it('a record its verifier has not passed — no findings beside it, or findings standing — refused, nothing written, nor anything beside the record: the carry clears them, and a record is carried once', () => {
    const args = composed(LICENSING, { entries: [QUESTION, DECISION] });
    const findings = findingsPath('fumi', 'licensing');
    const why = 'a record is carried once its verifier passes it, its findings file empty, for the carry clears the findings beside it and a record is carried once, so a finding left standing would never be answered';
    fs.rmSync(statePath(dir, findings));
    const unverified = untouched(args);
    writeState(dir, findings, '## Trial Length\n\nDropped.\n');
    const standing = untouched(args);

    assert.deepStrictEqual([unverified, standing], [
      `ledger carry: fumi's licensing has not passed its verifier — ${findings} is no file: ${why}`,
      `ledger carry: fumi's licensing has not passed its verifier — its findings stand in ${findings}: ${why}`,
    ]);
  });

  it('a record whose composer handed findings back to the session refused, nothing written, until the session settles them and removes the file', () => {
    const args = composed(LICENSING, { entries: [QUESTION, DECISION] });
    const handback = handbackPath('fumi', 'licensing');
    writeState(dir, handback, '- Carry the CLI framework: round 1 ruled it replaced.\n');

    assert.strictEqual(untouched(args), `ledger carry: fumi's licensing has findings handed back to the session in ${handback}: settle each into .cache/migrate/records/fumi/licensing.settled.md, replace it in ${findingsPath('fumi', 'licensing')} with \`Settled: {point}, amend to agree\` where the record changes, or take it out where it stands, then remove ${handback}`);
  });

  it('once carried, the verifier\'s passing round, its rulings and verdicts with it, kept after the rounds before it, and all beside the record cleared', () => {
    const RULED = '- The session\'s pricing is not this record\'s: fumi/discovery/session-001.md "Pricing".';
    writeState(dir, refusedPath('fumi', 'licensing'), 'ledger carry: refused.\n');
    writeState(dir, roundsPath('fumi', 'licensing'), '## Round 1\n\nThe trial is wrong.\n');
    writeState(dir, verifyingPath('fumi', 'licensing'), noted(['q1', 'd1'], ['q1', 'd1']));
    writeState(dir, rulingsPath('fumi', 'licensing'), `${RULED}\n`);

    carry(LICENSING, [QUESTION, DECISION]);

    assert.strictEqual(readState(dir, roundsPath('fumi', 'licensing')), `## Round 1\n\nThe trial is wrong.\n\n## Round 2\n\nNone: the verifier passed it.\n\n### Rulings\n\n${RULED}\n\n### Checked\n\nq1: ok\nd1: ok\n`);
    assert.deepStrictEqual([findingsPath, rulingsPath, checkedPath, verifyingPath, refusedPath].map((rel) => fs.existsSync(statePath(dir, rel('fumi', 'licensing')))), [false, false, false, false, false]);
  });

  it('the seam whole: the verifier\'s brief issued on the record, what a verifier writes beside it, then the carry — an empty record with no verdict to give, and one with entries, each verdict a list item or its ref in backticks; a record changed after the brief refused', () => {
    const brief = (/** @type {string} */ place) => ok(dir, ['brief', 'migration-verifier', '--topic', place, '--directive', '079-records'], { env: SESSION });
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');
    writeState(dir, composedPath('fumi', null), '{"entries": []}\n');
    writeState(dir, composedPath('fumi', 'licensing'), JSON.stringify({ entries: [QUESTION, DECISION] }));
    brief('fumi.discovery');
    brief(LICENSING);
    writeState(dir, findingsPath('fumi', null), '');
    writeState(dir, findingsPath('fumi', 'licensing'), '');
    writeState(dir, checkedPath('fumi', 'licensing'), '- `q1`: ok\n1. d1: ok\n');
    writeState(dir, composedPath('fumi', 'licensing'), `${JSON.stringify({ entries: [QUESTION, DECISION] })}\n`);
    const changed = untouched(['ledger', 'carry', LICENSING]);
    writeState(dir, composedPath('fumi', 'licensing'), JSON.stringify({ entries: [QUESTION, DECISION] }));

    assert.deepStrictEqual([ok(dir, ['ledger', 'carry', 'fumi.discovery'], { env: SESSION }).carried, ok(dir, ['ledger', 'carry', LICENSING], { env: SESSION }).carried], [0, 2]);
    assert.strictEqual(changed, 'ledger carry: fumi\'s licensing has changed since its verifier was briefed on it: a record is carried as its verifier read it — brief a fresh verifier');
  });

  it('a record whose verifier gave no verdict on every entry its brief asked one of refused, nothing written: one missing, one it never read, or none at all — asked as its brief recorded them, an entry it read but was not asked of given one or not, else as the record holds them', () => {
    const args = composed(LICENSING, { entries: [QUESTION, DECISION] });
    const checked = checkedPath('fumi', 'licensing');
    const way = `: a verifier writes a line for each entry its walk sheet does not mark passed, \`{ref}: ok\` or \`{ref}: see finding\`, and one that does not has given no verdict — remove ${findingsPath('fumi', 'licensing')}, ${rulingsPath('fumi', 'licensing')} and ${checked}, and brief a fresh verifier`;
    const told = (said) => `ledger carry: fumi's licensing has no verdict from its last verifier on every entry its brief asked one of — ${said}${way}`;
    writeState(dir, checked, 'q1: ok\n');
    const missing = untouched(args);
    writeState(dir, checked, 'q1: ok\nd1: ok\nf9: ok\n');
    const unknown = untouched(args);
    fs.rmSync(statePath(dir, checked));
    const none = untouched(args);
    writeState(dir, checked, 'q1: ok\nf9: ok\n');
    writeState(dir, verifyingPath('fumi', 'licensing'), noted(['d1'], ['q1', 'd1']));
    const briefed = untouched(args);

    assert.deepStrictEqual([missing, unknown, none, briefed], [
      told('it names no verdict on d1'), told('it names f9, which the record it read does not hold'),
      told(`${checked} is no file; it names no verdict on q1, d1`), told('it names no verdict on d1; it names f9, which the record it read does not hold'),
    ]);
  });

  it('outside the migration: once the state branch has its first commit, refused, nothing written', () => {
    git(statePath(dir), ['add', '-A']);
    git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);
    const head = git(statePath(dir), ['rev-parse', 'HEAD']);

    const { error } = refuses(dir, composed(LICENSING, { entries: [QUESTION, DECISION] }), { env: SESSION });

    assert.strictEqual(error, 'ledger carry: a topic\'s record is carried into the ledger only while the migration runs — the state branch has its first commit, so the migration is done');
    assert.deepStrictEqual([fs.existsSync(statePath(dir, layout.ledger)), fs.existsSync(statePath(dir, carriedPath('fumi', 'licensing'))), git(statePath(dir), ['rev-parse', 'HEAD'])], [false, false, head]);
  });
});

describe('a redo never duplicates (21.10.9)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('a topic\'s record is carried once: carried again, its verifier\'s pass gone with the carry, it is refused as carried, nothing written', () => {
    carry(LICENSING, [QUESTION, DECISION]);

    assert.strictEqual(untouched(['ledger', 'carry', LICENSING]),
      'ledger carry: the ledger holds entries on fumi\'s licensing already — a record is carried once');
    assert.strictEqual(lines().length, 3);
  });

  it('killed as the ledger is renamed in, the topic has none of its entries and its record is kept; carried again, the ledger holds each once', () => {
    const args = composed(LICENSING, { entries: [QUESTION, DECISION] });
    killedAt({ method: 'renameSync', file: layout.ledger, when: 'before' }, dir, args, { env: SESSION });

    assert.deepStrictEqual([fs.existsSync(statePath(dir, layout.ledger)), kept('fumi', 'licensing').entries.length], [false, 2]);
    ok(dir, args, { env: SESSION });
    assert.deepStrictEqual(lines().map(({ event, text, path: file }) => text ?? file ?? event), ['How long is the trial?', 'Fourteen days.', 'fumi/assets/pricing.md']);
  });

  it('killed once the ledger is renamed in, the topic has all of its entries, and is never carried again', () => {
    const args = composed(LICENSING, { entries: [QUESTION, DECISION] });
    killedAt({ method: 'renameSync', file: layout.ledger, when: 'after' }, dir, args, { env: SESSION });

    const landed = readState(dir, layout.ledger);

    assert.strictEqual(landed.split('\n').filter(Boolean).length, 3);
    assert.match(refuses(dir, args, { env: SESSION }).error, /a record is carried once$/);
    assert.strictEqual(readState(dir, layout.ledger), landed);
  });
});

describe('the refusals, nothing written', () => {
  before(() => { dir = world(); });
  after(() => cleanupFixture(path.dirname(dir)));

  it('no session, argv of another shape, and a place naming no topic, writing nothing; no record composed, or a file holding none, writing its refusal beside the record', () => {
    const usage = 'Usage: engine ledger carry <work-unit>.<phase>.<topic>|<work-unit>.discovery [--dry-run]   (the record as JSON, {"entries": [...]}, composed at .cache/migrate/records/{unit}/{topic}.json in the state, a unit\'s own at .cache/migrate/records/{unit}.json)';
    assert.deepStrictEqual([
      untouched(['ledger', 'carry', LICENSING], { env: {} }),
      untouched(['ledger', 'carry']),
      untouched(['ledger', 'carry', '--dry-run']),
      untouched(['ledger', 'carry', '--file', 'record.json']),
      untouched(['ledger', 'carry', LICENSING, '--file', 'record.json']),
      untouched(['ledger', 'carry', LICENSING, '--dry-run', 'more']),
      untouched(['ledger', 'carry', LICENSING, 'more']),
      untouched(['ledger', 'carry', 'fumi.discussion']),
      untouched(['ledger', 'carry', 'fumi.specification.licensing']),
      untouched(['ledger', 'carry', 'fumi.research.search']),
      untouched(['ledger', 'carry', 'nope.discussion.licensing']),
      untouched(['ledger', 'carry', 'gone.investigation.gone']),
      untouched(['ledger', 'carry', 'fumi.discussion.billing']),
      refusedKeeping(dir, ['ledger', 'carry', LICENSING], refusedPath('fumi', 'licensing')).replace(/: ENOENT[^]*$/, ''),
      mendFile({ entries: [QUESTION], more: true }),
      mendFile({ entries: ['q1'] }),
    ], [
      'ledger carry: no session to tag the entries with — CLAUDE_CODE_SESSION_ID is not set',
      usage,
      usage,
      usage,
      usage,
      usage,
      usage,
      'ledger carry: "fumi.discussion" names no topic — <work-unit>.<phase>.<topic>, or <work-unit>.discovery for a unit\'s own',
      'ledger carry: the records carry no topic in "specification" — one of discovery, discussion, investigation',
      'ledger carry: the records carry no topic in "research" — one of discovery, discussion, investigation',
      'ledger carry: there is no work unit "nope"',
      'ledger carry: gone has no topic "gone" in investigation',
      'ledger carry: fumi has no topic "billing" in discussion',
      'ledger carry: the record could not be read from .cache/migrate/records/fumi/licensing.json',
      'ledger carry: .cache/migrate/records/fumi/licensing.json holds no record — a record is {"entries": [...]}, each entry an object',
      'ledger carry: .cache/migrate/records/fumi/licensing.json holds no record — a record is {"entries": [...]}, each entry an object',
    ]);
  });

  it('a place at a phase before the one the topic\'s item is in — an epic\'s topic on its map and in discussion, named at discovery — writing nothing', () => {
    const manifest = readState(dir, layout.manifest('fumi'));
    const mapped = JSON.parse(manifest);
    mapped.phases.discovery.items.licensing = { source: 'discovery', summary: 'Licensing', order: 3 };
    writeState(dir, layout.manifest('fumi'), JSON.stringify(mapped));
    try {
      assert.strictEqual(untouched(['ledger', 'carry', 'fumi.discovery.licensing']), 'ledger carry: fumi\'s licensing is in discussion, past discovery — its record is carried there: fumi.discussion.licensing');
    } finally {
      writeState(dir, layout.manifest('fumi'), manifest);
    }
  });

  it('an entry of no ref, a ref twice, another event, who moved whom given, a link naming no earlier entry of its kind or given in another shape, a map item or a thread of another shape, a point to raise that is no open question or marked otherwise, and content its write refuses — the person\'s decision given other than own, a question product-wide among it', () => {
    const refused = (/** @type {unknown[]} */ entries) => mend(entries);
    const { assets: _, ...decision } = DECISION;
    assert.deepStrictEqual([
      refused([{ ...QUESTION, ref: undefined }]),
      refused([QUESTION, QUESTION]),
      refused([{ ...QUESTION, event: 'moved' }]),
      refused([{ ...QUESTION, who_moved_whom: 'none' }]),
      refused([{ ...QUESTION, ref: 'q2', part_of: 'q1' }, QUESTION]),
      refused([QUESTION, { ...decision, part_of: 'q1' }]),
      refused([QUESTION, { ...decision, answers: undefined }]),
      refused([QUESTION, { ...FINDING, relies_on: [], answers: 'q1' }]),
      refused([decision, QUESTION]),
      refused([QUESTION, { ...FINDING, relies_on: [] }, { ...decision, answers: 'f1' }]),
      refused([QUESTION, { ...decision, relies_on: ['d1'] }]),
      refused([QUESTION, { ...decision, relies_on: 'q1' }]),
      refused([{ ...QUESTION, ref: 'q2', part_of: 1 }, QUESTION]),
      refused([{ ...QUESTION, map_item: [] }]),
      refused([{ ...QUESTION, thread: ['index-size', ''] }]),
      refused([{ ...FINDING, relies_on: [], raise: true }]),
      refused([{ ...QUESTION, raise: 'yes' }]),
      refused([{ ...QUESTION, raise: true }, decision]),
      refused([{ ...QUESTION, text: '' }]),
      refused([{ ...QUESTION, why: 'Because.' }]),
      refused([QUESTION, { ...decision, by: 'person' }]),
      refused([QUESTION, { ...decision, by: 'person', given: 'your-call' }]),
      refused([{ ...QUESTION, product_wide: false }]),
      refused([{ ...FINDING, relies_on: [], known: 'measured' }]),
    ], [
      broken('entry 1: gives no ref, the name the record links it by'),
      broken('entry q1: its ref is given twice'),
      broken('entry q1: its event is none of asked, found, decided'),
      broken('entry q1: gives who_moved_whom — an entry the migration carries moves no one'),
      broken('entry q2: part_of names q1, and no entry before it is a question of that ref'),
      broken('entry d1: only a question is part of another'),
      broken('entry d1: a decision answers a question of the record'),
      broken('entry f1: only a decision answers'),
      broken('entry d1: answers names q1, and no entry before it is a question of that ref'),
      broken('entry d1: answers names f1, and no entry before it is a question of that ref'),
      broken('entry d1: relies_on names d1, and no entry before it is an entry of that ref'),
      broken('entry d1: relies_on is a list of refs, each an entry\'s before it'),
      broken('entry q2: part_of is the ref of an entry before it'),
      broken('entry q1: a map item is a name, or a list of names'),
      broken('entry q1: a thread is a name, or a list of names'),
      broken('entry f1: raise marks a question to raise, true'),
      broken('entry q1: raise marks a question to raise, true'),
      broken('entry q1: is marked to raise, and a decision of the record answers it — raise refuses a question answered already, so a point to raise is an open question'),
      broken('entry q1: the content\'s text is not non-empty text'),
      broken('entry q1: the content has no field why — it holds by, text, cites'),
      broken('entry d1: the person\'s decision is given carried — the person\'s own is given own, and what they hand over, or what is carried over, is Claude\'s line, by claude'),
      broken('entry d1: the person\'s decision is given your-call — the person\'s own is given own, and what they hand over, or what is carried over, is Claude\'s line, by claude'),
      broken('entry q1: the content has no field product_wide — it holds by, text, cites'),
      broken('entry f1: a measured finding records the command run and its result — the content needs command and result'),
    ]);
  });

  it('every fault at once: each entry\'s, each check of an entry whichever others break — within its content each field unknown, missing or of another type, and what it says of itself that cannot be — the entries after a broken one judged on their own, and the directive\'s rules', () => {
    const { assets: _, map_item: __, why: ___, ...decision } = DECISION;
    const { map_item: ____, ...question } = QUESTION;
    const { how: _____, ...finding } = FINDING;

    assert.strictEqual(mendFile({ entries: [
      { ...question, ref: undefined }, { ...question, text: '', raise: 'yes' }, { ...decision, answers: 'q9', relies_on: ['q1'], given: 'nope', rules_out: 'one' },
      { ...finding, relies_on: [], given: 'carried', known: 'measured' },
    ] }), broken(
      'entry 1: gives no ref, the name the record links it by',
      'entry q1: raise marks a question to raise, true',
      'entry q1: the content\'s text is not non-empty text',
      'entry d1: answers names q9, and no entry before it is a question of that ref',
      'entry d1: the content needs why',
      'entry d1: the content\'s rules_out is not a list of non-empty text',
      'entry d1: the content\'s given is not one of own, your-call, dont-care, carried',
      'entry f1: the content has no field given — it holds by, text, how, product_wide, known, command, result, cites',
      'entry f1: the content needs how',
      'entry f1: a measured finding records the command run and its result — the content needs command and result',
      'trial-length is on its old map, decided, and no entry names it as its map_item',
      'fumi/assets/pricing.md came in from discussion/licensing, and no entry links it',
    ));
  });

  it('what an entry says of itself is judged on the fields that passed their type: a field of another type is named once, as such', () => {
    const mistyped = (/** @type {Record<string, unknown>} */ entry) => mend([QUESTION, entry]);

    assert.deepStrictEqual([mistyped({ ...DECISION, by: 'person', given: 'mine' }), mistyped({ ...FINDING, relies_on: [], known: 'measured', command: 7, result: null })], [
      broken('entry d1: the content\'s given is not one of own, your-call, dont-care, carried'),
      broken('entry f1: the content\'s command is not non-empty text, or null'),
    ]);
  });

  it('an asset of another shape, or one the state holds no file at', () => {
    const refused = (/** @type {unknown} */ assets) => mend([{ ...QUESTION, assets }]);
    writeState(dir, 'fumi/assets/folder/inside.md', '# Inside\n');
    assert.deepStrictEqual([
      refused('fumi/assets/pricing.md'),
      refused([{ path: 'fumi/assets/pricing.md', status: 'primary' }]),
      refused([{ path: 'fumi/assets/pricing.md' }]),
      refused([{ path: 'fumi/assets/missing.md', status: 'reference' }]),
      refused([{ path: 'fumi/assets/folder', status: 'reference' }]),
      refused([{ path: '../fumi/assets/pricing.md', status: 'reference' }]),
    ], [
      broken('entry q1: assets is a list of {path, status}'),
      broken('entry q1: an asset is {path, status}, its status canonical or reference'),
      broken('entry q1: an asset is {path, status}, its status canonical or reference'),
      broken('entry q1: the asset fumi/assets/missing.md is no file the state holds — an asset\'s path is from the state root'),
      broken('entry q1: the asset fumi/assets/folder is no file the state holds — an asset\'s path is from the state root'),
      broken('entry q1: the asset ../fumi/assets/pricing.md is no file the state holds — an asset\'s path is from the state root'),
    ]);
  });
});

describe('the dry run, nothing written', () => {
  before(() => { dir = world(); });
  after(() => cleanupFixture(path.dirname(dir)));

  /** A dry run of licensing's record, with no session, the state as it was: its answer. @param {unknown[]} entries */
  function dryRun(entries) {
    const args = composed(LICENSING, { entries });
    const before = treeSnapshot(dir);
    const res = ok(dir, [...args, '--dry-run'], { env: {} });
    assert.deepStrictEqual(treeSnapshot(dir), before);
    return res;
  }

  it('answers every fault the carry would refuse the record for, its refusal never written, and none for a record the carry takes', () => {
    const { map_item: _, ...question } = QUESTION;

    assert.deepStrictEqual([dryRun([{ ...question, text: '' }]), dryRun([QUESTION, DECISION])], [
      { ok: true, faults: ['entry q1: the content\'s text is not non-empty text', 'trial-length is on its old map, decided, and no entry names it as its map_item', 'fumi/assets/pricing.md came in from discussion/licensing, and no entry links it'] },
      { ok: true, faults: [] },
    ]);
    assert.ok(stateUnborn(dir));
  });
});
