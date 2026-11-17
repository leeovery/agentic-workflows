'use strict';

// ---------------------------------------------------------------------------
// Tests for directive 079, the records (21.6, 21.10.7): its check
// (079-records.check.cjs), run through `engine migrate check`, and the rules
// it holds a topic's record to, which `ledger carry` holds the record to
// before it writes. One piece for each topic of each unit, completed,
// cancelled, building and never-started ones among them, but a topic promoted
// to a cross-cutting unit, carried there, its research's threads read where
// it was promoted from; each done once its record is carried — an entry at
// least where its log holds anything, and every import come in from it whose
// file the state holds linked, a unit of one topic's from its discovery among
// them and an epic's from its discovery as a whole asked of none; a record of
// none keeping every rule but the cites; every entry citing a heading its
// file holds, held twice or not, in a file that stays with the entry — its
// topic's own, its log and the reviews the move folded into it, its brief,
// an experiment's record, or the unit's beside its topics, its assets, its
// spec.md, its specs joined by the move where its building started, a
// discovery session — never the cache, another topic's, another unit's or
// its mail; every subtopic its old map holds named by an entry, one entry
// carrying several, and every thread still open, each by an open question
// or by the entry a later source settles it with. A record breaking a rule
// is refused at the carry, the refusal written beside the record and
// nothing else, and leaves nothing in the way of the record mended. Once it
// passes, the check lists each point marked to raise on a live topic until
// the conversation raises it — a completed unit's among them, and none on
// a topic never started, carried in discovery, whose first opening reads it
// with the rest of its record, nor of a cross-cutting unit, whose record is
// the product's, so the directive closes over it.
// `.workflows/` is read where the move read it, the working tree in the main
// checkout, the old chain's and the split's changes uncommitted there among
// it, and the record where the state keeps it, from a linked worktree too.
// The check rests on the record the carry kept and its ids in the ledger, and
// reads what the real move (078) writes. The directive's own example record
// carries, and the directive spells no path from the session's folder. The
// directive's head is linted with every directive's
// (test-migration-directives.cjs); the carry's mechanics are
// test-engine-ledger-carry.cjs's.
//
// Layer: migration. Budget: 8 s — every carry and check is the engine's
// over a copied repository with its state worktree, and one case runs the
// real move. World: the records directive's (migration-world.cjs),
// made once and copied for each test, and that world with every topic's
// record carried, made once and copied; and one small project in today's
// layout, moved by the real 078.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, okSections, okSectionsAsync, git, statePath, layout, writeState, readState, createFile, initRepo, commitAll, cleanupFixture } = harness;
const { SESSION, recordsMigration, refusedKeeping, refusedUntouched } = require('./migration-world.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { composedPath, carriedPath, findingsPath, refusedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

/** Where the session marks the sections of a unit's specs holding no topic's decision. @param {string} unit */
const sectionsMarked = (unit) => `.cache/migrate/records/${unit}.sections.json`;
const DIRECTIVE = path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations/079-records.md');
const MOVE = require('../../skills/ledger-migrate/scripts/migrations/078-reshape-move.cjs');

const RECORDS = '079-records';
const TOPICS = { one: 'topic', many: 'topics' };
const PIECES = ['fumi/billing', 'fumi/licensing', 'fumi/search', 'fumi/support', 'gone/gone', 'platform/auth', 'shop/weights'];

/** @param {string} unit @param {string} topic @param {string} section */
const logCite = (unit, topic, section) => ({ path: layout.topic(unit, topic, 'log.md'), section });

// Each topic's record, carried whole, as the directive composes it.
const GOOD = Object.freeze({
  'fumi.discovery.billing': [
    {
      ref: 'f1', event: 'found', text: 'Rates are set per seat.', how: 'read in the rates import', known: 'read', by: 'claude',
      cites: [{ path: layout.assets('fumi', 'rates.md'), section: 'Rates' }], assets: [{ path: layout.assets('fumi', 'rates.md'), status: 'reference' }],
    },
  ],
  'fumi.discovery.support': [],
  'fumi.discussion.licensing': [
    { ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person', map_item: 'trial-length', cites: [logCite('fumi', 'licensing', 'Trial Length')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Fourteen days.', why: 'The person set it.', by: 'person', map_item: 'trial-length',
      cites: [logCite('fumi', 'licensing', 'Decision'), { path: layout.topic('fumi', 'licensing', 'brief.md'), section: 'Licensing' }],
      assets: [{ path: layout.assets('fumi', 'pricing.md'), status: 'reference' }],
    },
    { ref: 'q2', event: 'asked', text: 'Does the spec hold the trial at thirty days?', by: 'claude', cites: [{ path: layout.assets('fumi', 'specs', 'commerce.md'), section: 'Corrigenda' }] },
    { ref: 'd2', event: 'decided', answers: 'q2', text: 'No: its corrigendum holds it at fourteen.', why: 'The corrigendum says so.', by: 'claude', given: 'carried', cites: [{ path: layout.assets('fumi', 'specs', 'commerce.md'), section: 'Corrigenda' }] },
  ],
  'fumi.discussion.search': [
    { ref: 'q1', event: 'asked', text: 'How are results ranked?', by: 'claude', map_item: 'ranking', cites: [logCite('fumi', 'search', 'Ranking')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By recency.', why: 'The log settles it, whoever said it.', by: 'claude', given: 'carried', map_item: 'ranking', cites: [logCite('fumi', 'search', 'Ranking')] },
    { ref: 'q2', event: 'asked', text: 'How tolerant of typos is search?', by: 'claude', map_item: 'typo-tolerance', cites: [logCite('fumi', 'search', 'Typo Tolerance')] },
    { ref: 'q3', event: 'asked', text: 'Should search match synonyms?', by: 'claude', map_item: 'synonyms', cites: [logCite('fumi', 'search', 'Synonyms')] },
    { ref: 'q4', event: 'asked', text: 'How big does the index grow?', by: 'claude', thread: 'index-size', cites: [logCite('fumi', 'search', 'Index Size')] },
    { ref: 'f2', event: 'found', text: 'Two results of one age have no order.', how: 'read in a review never folded in', known: 'read', by: 'claude', cites: [logCite('fumi', 'search', 'Review review-001, never folded in')] },
    {
      ref: 'f1', event: 'found', text: 'A query takes 12ms at p95.', how: 'measured by the latency experiment', known: 'measured', command: 'npm run bench', result: '12ms at p95', by: 'claude',
      cites: [{ path: layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'report.md'), section: 'Result' }],
    },
  ],
  'platform.discussion.auth': [
    { ref: 'q1', event: 'asked', text: 'How long do sessions and their tokens last?', by: 'claude', map_item: ['sessions', 'tokens'], cites: [logCite('platform', 'auth', 'Sessions')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Thirty days, the tokens renewed with each session.', why: 'The log settles it.', by: 'claude', given: 'carried', product_wide: true, map_item: ['sessions', 'tokens'],
      cites: [logCite('platform', 'auth', 'Sessions')], assets: [{ path: layout.assets('platform', 'sso.md'), status: 'reference' }],
    },
    { ref: 'q2', event: 'asked', text: 'When do tokens expire?', by: 'claude', thread: 'token-expiry', cites: [logCite('platform', 'auth', 'Sessions')] },
  ],
  'shop.discussion.weights': [
    { ref: 'q1', event: 'asked', text: 'How do ties break?', by: 'claude', map_item: 'tie-break', cites: [logCite('shop', 'weights', 'Tie Break')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By price.', why: 'The spec\'s corrigendum replaced by name.', by: 'claude', given: 'carried', map_item: 'tie-break', cites: ['Corrigenda', 'Corrigenda > Detail'].map((section) => ({ path: 'shop/spec.md', section })) },
    { ref: 'q2', event: 'asked', text: 'How are items ranked?', by: 'claude', cites: [{ path: 'shop/spec.md', section: 'Ranking' }] },
    { ref: 'd2', event: 'decided', answers: 'q2', text: 'Newest first, by day; a wishlist newest saved first.', why: 'The spec settles it.', by: 'claude', given: 'carried', cites: ['Ranking', 'Ranking > Detail'].map((section) => ({ path: 'shop/spec.md', section })) },
    { ref: 'q3', event: 'asked', text: 'How is an item saved to a wishlist?', by: 'claude', cites: [{ path: 'shop/spec.md', section: 'Saving' }] },
    { ref: 'd3', event: 'decided', answers: 'q3', text: 'One tap.', why: 'The spec settles it.', by: 'claude', given: 'carried', cites: [{ path: 'shop/spec.md', section: 'Saving' }] },
  ],
  'gone.discussion.gone': [
    { ref: 'q1', event: 'asked', text: 'What caused it?', by: 'claude', map_item: 'cause', cites: [logCite('gone', 'gone', 'Cause')], assets: [{ path: layout.assets('gone', 'notes.md'), status: 'reference' }] },
  ],
});

/** @type {string} */
let dir;
afterEach(() => cleanupFixture(path.dirname(dir)));

/** The records directive's world, at a fresh folder. */
const world = () => recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi'));

/** The directive's check run. @param {string} [at] */
const checked = (at = dir) => ok(at, ['migrate', 'check', RECORDS], { env: SESSION });

/** Each piece not done, by its name, with what it lacks. @param {string} [at] */
const unfinished = (at = dir) => Object.fromEntries(checked(at).unfinished.map(({ name, problems }) => [name, problems]));

/** The unit and the topic a record's dot-path names, the topic null for a unit's own. @param {string} dotpath @returns {[string, string|null]} */
function recordOf(dotpath) {
  const [unit, , topic = null] = dotpath.split('.');
  return [unit, topic];
}

/** The ledger carry of a record, composed where the directive keeps it and passed by its verifier. @param {string} at @param {string} dotpath @param {unknown[]} entries */
function carryArgs(at, dotpath, entries) {
  const [unit, topic] = recordOf(dotpath);
  writeState(at, composedPath(unit, topic), JSON.stringify({ entries }));
  writeState(at, findingsPath(unit, topic), '');
  return ['ledger', 'carry', dotpath];
}

/** A topic's record carried. @param {string} dotpath @param {unknown[]} entries @param {string} [at] @param {string} [cwd] */
const carry = (dotpath, entries, at = dir, cwd = at) => ok(cwd, carryArgs(at, dotpath, entries), { env: SESSION });

/**
 * A topic's record refused at the carry, nothing written but the refusal
 * beside the record: the refusal.
 * @param {string} dotpath @param {unknown[]} entries
 */
function refused(dotpath, entries) {
  const [unit, topic] = recordOf(dotpath);
  return refusedKeeping(dir, carryArgs(dir, dotpath, entries), refusedPath(unit, topic));
}

/** The refusal of a record breaking the rules, its problems listed. @param {string} unit @param {string} topic @param {string[]} problems */
const breaks = (unit, topic, problems) => `ledger carry: ${unit}'s ${topic} breaks the records directive's rules, so nothing is carried — ${problems.join('; ')}`;

/** search's record with neither its map items nor its thread named. */
const bareSearch = () => GOOD['fumi.discussion.search'].map(({ map_item: _, thread: __, ...entry }) => entry);

/** What search's bare record leaves uncarried. */
const SEARCH_UNCARRIED = Object.freeze([
  'ranking is on its old map, decided, and no entry names it as its map_item', 'typo-tolerance is on its old map, exploring, and no entry names it as its map_item',
  'synonyms is on its old map, deferred, and no entry names it as its map_item', 'the thread index-size is still digging in its research, and no entry names it as its thread',
]);

/**
 * What a section of an approved spec no record cites breaks, in its part of
 * a joined spec where it is in one.
 * @param {string} unit @param {string} at @param {string} section @param {string|null} [part]
 */
const uncited = (unit, at, section, part = null) => `"${section}" in ${part === null ? '' : `part "${part}" of `}${at}, an approved spec, holds text no record of ${unit} cites — what the spec stage decided, found or left open is carried by the topic it belongs to; a section holding none of it is marked in ${sectionsMarked(unit)} as ${JSON.stringify({ [at]: part === null ? [section] : { [part]: [section] } })}`;

/**
 * fumi's commerce spec approved in its old manifest, its text in the state
 * made anew from what it holds: its path.
 * @param {(text: string) => string} made
 */
function approvedCommerce(made) {
  const manifest = path.join(dir, '.workflows/fumi/manifest.json');
  const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  old.phases.specification.items.commerce.status = 'completed';
  fs.writeFileSync(manifest, JSON.stringify(old));
  const commerce = layout.assets('fumi', 'specs', 'commerce.md');
  writeState(dir, commerce, made(readState(dir, commerce)));
  return commerce;
}

/** What each section of shop's joined spec no record cites breaks, by its part. @param {'1. Weights'|'2. Wishlist'} part @param {string[]} sections */
const shopUncited = (part, sections) => sections.map((section) => uncited('shop', 'shop/spec.md', section, part));

/** What an old map's subtopic no entry names breaks. @param {string} item @param {string} status */
const unnamed = (item, status) => `${item} is on its old map, ${status}, and no entry names it as its map_item`;

/** @type {string|null} */
let carriedTemplate = null;

/** The world with every topic's good record carried, at a fresh folder. */
function carriedWorld() {
  if (carriedTemplate === null) {
    carriedTemplate = recordsMigration(path.join(templateFolder('records-carried-'), 'fumi'));
    for (const [dotpath, entries] of Object.entries(GOOD)) carry(dotpath, entries, carriedTemplate);
  }
  return copyWorld(carriedTemplate, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi'));
}

describe('the pieces (21.6.2)', () => {
  it('every topic of every unit is a piece — completed, cancelled, building and never started among them, a topic promoted to a cross-cutting unit only there — none done before its record is carried', () => {
    dir = world();

    assert.deepStrictEqual(checked(), {
      ok: true, directive: RECORDS, passed: false, done: 0, of: 7, counts: TOPICS, unfinished: PIECES.map((name) => ({ name, problems: ['has no record yet'] })),
    });
  });

  it('21.S20, 21.S21, 21.S22, 21.S23, 21.S44: passes once each topic\'s record is carried — citing its log and the review folded into it, its brief, an experiment, a grouped spec kept as an asset and the spec its building drew on, carried over where no one is shown deciding, a measurement with its command, the open map items and threads as open questions — with nothing to raise', () => {
    dir = carriedWorld();

    assert.deepStrictEqual(checked(), { ok: true, directive: RECORDS, passed: true, done: 7, of: 7, counts: TOPICS, unfinished: [], raise: [] });
  });
});

describe('a record breaking a rule is refused at the carry, its refusal kept beside it and nothing else written', () => {
  beforeEach(() => { dir = world(); });

  it('a refusal leaves nothing in the way: the record mended carries, and its topic is done', () => {
    assert.strictEqual(refused('fumi.discussion.search', bareSearch()), breaks('fumi', 'search', SEARCH_UNCARRIED));

    carry('fumi.discussion.search', GOOD['fumi.discussion.search']);

    assert.strictEqual(unfinished()['fumi/search'], undefined);
  });

  it('an entry citing nothing, a file the state lacks, or a heading its file lacks; one its file holds more than once named by the path that tells it apart', () => {
    assert.strictEqual(refused('gone.discussion.gone', [
      { ...GOOD['gone.discussion.gone'][0], cites: [] },
      { ref: 'q2', event: 'asked', text: 'Was it a timeout?', by: 'claude', cites: [{ path: 'gone/topics/gone/experiments/E9-load/report.md', section: 'Cause' }] },
      { ref: 'q3', event: 'asked', text: 'Was it the network?', by: 'claude', cites: [logCite('gone', 'gone', 'Causes')] },
    ]), breaks('gone', 'gone', [
      'entry q1 cites nothing', 'entry q2 cites gone/topics/gone/experiments/E9-load/report.md, which the state does not hold', 'entry q3 cites "Causes" in gone/topics/gone/log.md, which has no such heading',
    ]));
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    carry('fumi.discussion.search', [{ ...q1, cites: [logCite('fumi', 'search', 'Ranking > Context')] }, ...rest]);
  });

  it('a cite of a file that does not stay with the entry — the cache, another topic\'s log, another unit\'s asset, its own mail — refused; one of the unit\'s beside its topics carried', () => {
    writeState(dir, findingsPath('fumi', 'search'), '## Ranking\n\nDropped.\n');
    writeState(dir, layout.topic('fumi', 'search', 'mail', '001-seats.md'), '### Seats\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Ranking\n\nBy recency, the person said.\n');
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    const citing = (/** @type {string} */ cited, /** @type {string} */ section) => [{ ...q1, cites: [{ path: cited, section }] }, ...rest];
    const strays = (/** @type {string} */ cited) => breaks('fumi', 'search', [`entry q1 cites ${cited}, which is neither its topic's own, but its mail, nor the unit's beside its topics, nor a discovery session it draws on — a cite names a file that stays with its entry`]);

    assert.deepStrictEqual([
      refused('fumi.discussion.search', citing(findingsPath('fumi', 'search'), 'Ranking')),
      refused('fumi.discussion.search', citing(layout.topic('fumi', 'licensing', 'log.md'), 'Trial Length')),
      refused('fumi.discussion.search', citing(layout.assets('platform', 'sso.md'), 'SSO')),
      refused('fumi.discussion.search', citing(layout.topic('fumi', 'search', 'mail', '001-seats.md'), 'Seats')),
    ], [
      strays(findingsPath('fumi', 'search')),
      strays(layout.topic('fumi', 'licensing', 'log.md')),
      strays(layout.assets('platform', 'sso.md')),
      strays(layout.topic('fumi', 'search', 'mail', '001-seats.md')),
    ]);
    carry('fumi.discussion.search', citing(layout.unit('fumi', 'discovery', 'session-001.md'), 'Ranking'));
  });

  it('8.S23: a topic never started, carried in discovery where nothing is decided — a decision, or a finding marked product-wide, refused; what its research concluded is a finding (8.3.4, 8.9.6)', () => {
    const [found] = GOOD['fumi.discovery.billing'];
    const rates = [{ path: layout.assets('fumi', 'rates.md'), section: 'Rates' }];
    const asked = { ref: 'q1', event: 'asked', text: 'Are rates set per seat?', by: 'claude', cites: rates };
    const decided = { ref: 'd1', event: 'decided', answers: 'q1', text: 'Per seat.', why: 'The rates import says so.', by: 'claude', given: 'carried', cites: rates };

    assert.strictEqual(refused('fumi.discovery.billing', [{ ...found, product_wide: true }, asked, decided]), breaks('fumi', 'billing', [
      'entry f1 is product-wide, and nothing found in discovery is product-wide — a line for the product record is decided in the first topic it bears on',
      'entry d1 decides, and nothing is decided in discovery — what its sources settle is a finding, what they leave open a question',
    ]));
  });

  it('21.S26: a cross-cutting unit\'s finding or decision not marked product-wide refused — every one is the product\'s; its questions are no entry of the product record (21.7.3, 19.6.7)', () => {
    const [q1, d1, q2] = GOOD['platform.discussion.auth'];
    const f1 = { ref: 'f1', event: 'found', text: 'Sessions live in one store.', how: 'read in the log', known: 'read', by: 'claude', product_wide: true, cites: [logCite('platform', 'auth', 'Sessions')] };

    assert.strictEqual(refused('platform.discussion.auth', [q1, { ...d1, product_wide: false }, q2, { ...f1, product_wide: undefined }]), breaks('platform', 'auth', [
      'entry d1 is not product-wide, and a cross-cutting unit\'s findings and decisions all are — the reshape keeps the unit as the product\'s',
      'entry f1 is not product-wide, and a cross-cutting unit\'s findings and decisions all are — the reshape keeps the unit as the product\'s',
    ]));
    carry('platform.discussion.auth', [q1, d1, q2, f1]);
  });

  it('21.S36: every subtopic of its old map and every thread still digging named by an entry, whichever kind: a subtopic its map shows open that a later source settled carried by the decision, a thread a later source answers by the finding answering it', () => {
    const later = [
      ...GOOD['fumi.discussion.search'].map(({ thread: _, ...entry }) => entry),
      { ref: 'd2', event: 'decided', answers: 'q2', text: 'Off by one letter.', why: 'A later section settles it.', by: 'claude', given: 'carried', map_item: 'typo-tolerance', cites: [logCite('fumi', 'search', 'Typo Tolerance')] },
    ];
    const answer = { ref: 'f3', event: 'found', text: 'The index stays under a gigabyte.', how: 'read in the research', known: 'read', by: 'claude', thread: 'index-size', cites: [logCite('fumi', 'search', 'Index Size')] };

    assert.strictEqual(refused('fumi.discussion.search', later), breaks('fumi', 'search', ['the thread index-size is still digging in its research, and no entry names it as its thread']));
    carry('fumi.discussion.search', [...later, answer]);
  });

  it('one decision settles two subtopics by naming both; naming one leaves the other uncarried', () => {
    const [q1, d1, q2] = GOOD['platform.discussion.auth'];

    assert.strictEqual(refused('platform.discussion.auth', [{ ...q1, map_item: 'sessions' }, { ...d1, map_item: 'sessions' }, q2]),
      breaks('platform', 'auth', [unnamed('tokens', 'decided')]));
  });

  it('a topic promoted to a cross-cutting unit: its research\'s threads, which stayed with the epic, asked of the unit it went to; the epic refused it', () => {
    const [q1, d1] = GOOD['platform.discussion.auth'];

    assert.strictEqual(refused('platform.discussion.auth', [q1, d1]), breaks('platform', 'auth', ['the thread token-expiry is still open in its research, and no entry names it as its thread']));
    assert.strictEqual(refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.auth', GOOD['platform.discussion.auth']), { env: SESSION }, harness),
      'ledger carry: fumi\'s auth was promoted to platform, which carries its record');
  });

  it('F1: reads `.workflows/` where the move read it, the working tree in the main checkout, which holds what the old chain and the split changed in the same run, never committed — the old map and the research\'s threads (21.5.8)', () => {
    /** A unit's old manifest changed in the working tree alone. @param {string} unit @param {(manifest: any) => void} edit */
    const reshape = (unit, edit) => {
      const file = path.join(dir, '.workflows', unit, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      edit(manifest);
      fs.writeFileSync(file, JSON.stringify(manifest));
    };
    reshape('shop', (manifest) => { manifest.phases.discussion.items.weights.subtopics['by-price'] = { status: 'decided', parent: null }; });
    reshape('fumi', (manifest) => { manifest.phases.research.items.search.threads['stop-words'] = { question: 'Are stop words dropped?', status: 'open', origin: 'seed', parent: null }; });

    assert.deepStrictEqual([
      refused('shop.discussion.weights', GOOD['shop.discussion.weights']),
      refused('fumi.discussion.search', GOOD['fumi.discussion.search']),
    ], [
      breaks('shop', 'weights', [unnamed('by-price', 'decided')]),
      breaks('fumi', 'search', ['the thread stop-words is still open in its research, and no entry names it as its thread']),
    ]);
  });

  it('an import come in from the topic that no entry links, a record of no entries and a topic of no log among them, and in a unit of one topic one from its discovery; one whose file is gone, and an epic\'s from its discovery as a whole, asked of no topic', () => {
    const { assets: _, ...cause } = GOOD['gone.discussion.gone'][0];
    assert.deepStrictEqual([
      refused('fumi.discussion.licensing', GOOD['fumi.discussion.licensing'].map(({ assets: __, ...entry }) => entry)),
      refused('fumi.discovery.billing', []),
      refused('gone.discussion.gone', [cause]),
    ], [
      breaks('fumi', 'licensing', ['fumi/assets/pricing.md came in from discussion/licensing, and no entry links it']),
      breaks('fumi', 'billing', ['fumi/assets/rates.md came in from research/billing, and no entry links it']),
      breaks('gone', 'gone', ['gone/assets/notes.md came in from discovery, and no entry links it']),
    ]);
    carry('fumi.discussion.licensing', GOOD['fumi.discussion.licensing']);
    carry('shop.discussion.weights', GOOD['shop.discussion.weights']);
  });

  it('an import from the discovery of a unit no epic but holding several topics is asked of none of them', () => {
    const manifest = JSON.parse(readState(dir, layout.manifest('platform')));
    writeState(dir, layout.manifest('platform'), JSON.stringify({
      ...manifest, imports: [...manifest.imports, { path: 'assets/keys.md', imported_at: '2026-01-06T10:00:00Z', origin: 'discovery' }],
      phases: { discussion: { items: { ...manifest.phases.discussion.items, keys: { status: 'in-progress' } } } },
    }));
    writeState(dir, layout.assets('platform', 'keys.md'), '# Keys\n');

    carry('platform.discussion.auth', GOOD['platform.discussion.auth']);
  });

  it('an empty record, where the topic\'s log holds anything; a topic with no log and nothing come in from it carries one', () => {
    assert.strictEqual(refused('shop.discussion.weights', []), breaks('shop', 'weights', ['its record is empty, and its log or brief holds text past its headings', unnamed('tie-break', 'decided')]));
    carry('fumi.discovery.support', []);
  });

  it('an empty record of a topic with no log still carries its old map and its threads (21.12.7, 21.6.7)', () => {
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'log.md')));

    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', SEARCH_UNCARRIED));
  });

  it('the unit\'s spec.md where its building never started; where it started, a heading the spec the move joined lacks — whatever its specs under `.workflows/` hold now — and one two of its specs share citing either; a heading\'s path the spec\'s headings lack refused, and one they hold, a part\'s heading over it among them, taken', () => {
    fs.appendFileSync(path.join(dir, '.workflows/shop/specification/weights/specification.md'), '\n## Pricing\n\nBy price.\n');
    const licensing = GOOD['fumi.discussion.licensing'];
    const [question, decision] = GOOD['shop.discussion.weights'];
    assert.strictEqual(refused('fumi.discussion.licensing', [...licensing.slice(0, 3), { ...licensing[3], cites: [{ path: 'fumi/spec.md', section: 'Corrigenda' }] }]),
      breaks('fumi', 'licensing', ['entry d2 cites fumi/spec.md, which the state does not hold']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...question, cites: ['Pricing', 'Saving'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]),
      breaks('shop', 'weights', ['entry q1 cites "Pricing" in shop/spec.md, which has no such heading']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...question, cites: ['Saving > Detail', 'Corrigenda > Detail'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]),
      breaks('shop', 'weights', ['entry q1 cites "Saving > Detail" in shop/spec.md, which has no such heading path']));
    carryArgs(dir, 'shop.discussion.weights', [{ ...question, cites: ['Ranking', '1. Weights > Ranking > Detail'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'carry', 'shop.discussion.weights', '--dry-run'], { env: SESSION }).faults, []);
  });

  it('a cite naming several headings refused, naming the paths that tell them apart — a log\'s, and a spec\'s within the parts its topic draws on — a bare heading each part holds once taken; a heading whose text holds the joint, and one atop a file of no one root, each named by its own text', () => {
    const log = layout.topic('fumi', 'licensing', 'log.md');
    fs.appendFileSync(statePath(dir, log), '\n### Seats\n\n#### Decision\n\nFive seats.\n\n### Cache > Disk\n\nOn disk.\n');
    const licensing = (/** @type {string[]} */ sections) => GOOD['fumi.discussion.licensing'].map((entry) => (entry.ref === 'd1' ? { ...entry, cites: [...sections.map((section) => logCite('fumi', 'licensing', section)), entry.cites[1]] } : entry));
    const [question, decision] = GOOD['shop.discussion.weights'];
    const weights = (/** @type {string[]} */ sections) => [{ ...question, cites: sections.map((section) => ({ path: 'shop/spec.md', section })) }, decision];
    const faults = (/** @type {string} */ dotpath, /** @type {unknown[]} */ entries) => ok(dir, [...carryArgs(dir, dotpath, entries), '--dry-run'], { env: SESSION }).faults;
    const tellApart = (/** @type {string} */ at, /** @type {string} */ part, /** @type {string[]} */ paths) => `cites "${paths[0].split(' > ').at(-1)}" in ${at}, which holds ${paths.length} headings so named${part} — a cite names one, by the path that tells it apart: ${paths.map((each) => `"${each}"`).join(', ')}`;

    const logBare = refused('fumi.discussion.licensing', licensing(['Decision']));
    const specBare = refused('shop.discussion.weights', weights(['Detail', 'Ranking']));
    const told = [faults('fumi.discussion.licensing', licensing(['Trial Length > Decision', 'Seats > Decision', 'Cache > Disk'])), faults('shop.discussion.weights', weights(['Ranking', 'Corrigenda > Detail']))];
    fs.appendFileSync(statePath(dir, log), '\n## Decision\n\nKept.\n');
    const atop = faults('fumi.discussion.licensing', licensing(['Decision', 'Trial Length > Decision']));

    assert.deepStrictEqual([logBare, specBare, told, atop], [
      breaks('fumi', 'licensing', [`entry d1 ${tellApart(log, '', ['Trial Length > Decision', 'Seats > Decision'])}`]),
      breaks('shop', 'weights', [`entry q1 ${tellApart('shop/spec.md', ' in part "1. Weights"', ['Ranking > Detail', 'Corrigenda > Detail'])}`]),
      [[], []],
      [],
    ]);
  });
});

describe('a unit\'s own record, `{unit}.discovery` (21.6.2)', () => {
  const SESSION_LOG = '## Discovery Session 001\n\n### Selling\n\nThe shop sells to the trade alone, and its buyers order by the case.\n';
  const selling = { ref: 'f1', event: 'found', text: 'The shop sells to the trade alone.', how: 'read in the discovery session', known: 'read', by: 'claude', cites: [{ path: 'shop/discovery/session-001.md', section: 'Selling' }], assets: [{ path: layout.assets('shop', 'vision.md'), status: 'reference' }] };

  it('is a piece of each epic whose discovery holds a session, carried at the unit\'s discovery, no topic\'s: findings and open questions alone, cites that stay, the imports of the unit\'s discovery as a whole linked — once', () => {
    dir = world();
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), SESSION_LOG);
    const before = checked().unfinished.find(({ name }) => name === 'shop.discovery');

    const faults = refused('shop.discovery', [{ ...selling, assets: [] }, { ref: 'q1', event: 'asked', text: 'Who sets the case size?', by: 'claude', cites: [logCite('shop', 'weights', 'Tie Break')] }, { ref: 'd1', event: 'decided', answers: 'q1', text: 'The trade.', why: 'The session says so.', by: 'claude', given: 'carried', cites: selling.cites }]);
    const { ids } = carry('shop.discovery', [selling]);
    const line = JSON.parse(fs.readFileSync(statePath(dir, layout.ledger), 'utf8').split('\n').filter(Boolean).at(-2));
    const again = harness.refuses(dir, ['ledger', 'carry', 'shop.discovery'], { env: SESSION }).error;

    assert.deepStrictEqual([before, faults, Object.keys(ids), [line.unit, line.phase, line.topic], unfinished()['shop.discovery'], again], [
      { name: 'shop.discovery', problems: ['has no record yet'] },
      breaks('shop', 'own discovery', [
        'entry d1 decides, and nothing is decided in discovery — what its sources settle is a finding, what they leave open a question',
        'entry q1 cites shop/topics/weights/log.md, which is neither its topic\'s own, but its mail, nor the unit\'s beside its topics, nor a discovery session it draws on — a cite names a file that stays with its entry',
        'shop/assets/vision.md came in from discovery, and no entry links it',
      ]),
      ['f1'], ['shop', 'discovery', null], undefined,
      'ledger carry: the ledger holds entries on shop\'s own discovery already — a record is carried once',
    ]);
  });

  it('none for an epic whose discovery holds no session, nor for a unit of one topic, whose discovery is its topic\'s', () => {
    dir = world();
    writeState(dir, layout.unit('gone', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Going\n\nIt went.\n');
    const none = (/** @type {string} */ unit) => `ledger carry: ${unit} has no record of its own — an epic whose discovery holds a session has one, and a unit of one topic's discovery is its topic's`;

    assert.deepStrictEqual([checked().unfinished.some(({ name }) => name.endsWith('.discovery')), ...['shop', 'gone'].map((unit) => harness.refuses(dir, ['ledger', 'carry', `${unit}.discovery`], { env: SESSION }).error)],
      [false, none('shop'), none('gone')]);
  });

  it('a topic promoted to a cross-cutting unit draws on the discovery sessions of the unit it came from, which its entries may cite; another unit\'s they may not', () => {
    dir = world();
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Sign-in\n\nOne sign-in across the product.\n');
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), SESSION_LOG);
    const [q1, d1, ...rest] = GOOD['platform.discussion.auth'];
    const citing = (/** @type {string} */ at, /** @type {string} */ section) => [{ ...q1, cites: [...q1.cites, { path: at, section }] }, d1, ...rest];
    const dry = (/** @type {unknown[]} */ entries) => {
      carryArgs(dir, 'platform.discussion.auth', entries);
      return ok(dir, ['ledger', 'carry', 'platform.discussion.auth', '--dry-run'], { env: SESSION }).faults;
    };

    assert.deepStrictEqual([dry(citing('fumi/discovery/session-001.md', 'Sign-in')), dry(citing('shop/discovery/session-001.md', 'Selling'))], [[], [
      'entry q1 cites shop/discovery/session-001.md, which is neither its topic\'s own, but its mail, nor the unit\'s beside its topics, nor a discovery session it draws on — a cite names a file that stays with its entry',
    ]]);
  });
});

describe('the points to raise (21.6.10, 21.S25)', () => {
  it('lists a completed unit\'s points as any live unit\'s, its topics live, at its specification where it has its spec; a cancelled unit\'s none', () => {
    dir = world();
    const raises = require('../../skills/ledger-migrate/scripts/migrations/079-records.check.cjs').raises;
    writeState(dir, layout.manifest('shop'), JSON.stringify({ ...JSON.parse(readState(dir, layout.manifest('shop'))), status: 'completed' }));
    const point = (/** @type {string} */ unit, /** @type {string} */ topic) => {
      const record = { entries: [{ ref: 'q1', event: 'asked', text: `What of ${topic}?`, by: 'claude', raise: true, cites: [logCite(unit, topic, 'Discussion')] }] };
      writeState(dir, carriedPath(unit, topic), JSON.stringify({ unit, phase: 'discussion', topic, entries: [{ ref: 'q1', id: `${topic}-id` }], record }));
    };
    point('shop', 'weights');
    point('gone', 'gone');

    assert.deepStrictEqual(raises({ projectDir: dir, stateDir: statePath(dir) }), [{ place: 'shop.specification', answers: 'weights-id', text: 'What of weights?' }]);
  });

  it('once the check passes, it lists each open question marked to raise on a live topic, at the topic, or at the unit\'s specification where the unit has its spec, until this conversation raises it there, the person answering, and the directive closes; none on a cancelled unit\'s, nor on a topic never started, carried in discovery where nothing is decided, whose first opening reads it with the rest of its record (8.3.4, 9.3.6), nor of a cross-cutting unit, whose record is the product\'s (21.7.5)', async () => {
    dir = world();
    const point = { ref: 'q3', event: 'asked', text: 'Does the trial need a card?', by: 'claude', raise: true, cites: [logCite('fumi', 'licensing', 'Trial Length')] };
    const unsettled = { ref: 'q1', event: 'asked', text: 'Are rates set per seat or per team?', by: 'claude', raise: true, cites: [{ path: layout.assets('fumi', 'rates.md'), section: 'Rates' }] };
    const unclear = { ref: 'q4', event: 'asked', text: 'Do ties break by price or by name?', by: 'claude', raise: true, cites: [logCite('shop', 'weights', 'Tie Break')] };
    const [cause] = GOOD['gone.discussion.gone'];
    for (const [dotpath, entries] of Object.entries(GOOD)) {
      if (dotpath === 'fumi.discussion.licensing') carry(dotpath, [...entries, point]);
      else if (dotpath === 'fumi.discovery.billing') carry(dotpath, [...entries, unsettled]);
      else if (dotpath === 'gone.discussion.gone') carry(dotpath, [{ ...cause, raise: true }]);
      else if (dotpath === 'platform.discussion.auth') carry(dotpath, entries.map((entry) => (entry.ref === 'q2' ? { ...entry, raise: true } : entry)));
      else if (dotpath === 'shop.discussion.weights') carry(dotpath, [...entries, unclear]);
      else carry(dotpath, entries);
    }
    /** The id the carry gave each of a topic's entries, by its ref. @param {string} topic @returns {Record<string, string>} */
    const carriedIds = (topic) => Object.fromEntries(JSON.parse(readState(dir, carriedPath('fumi', topic))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));

    const [listed, built] = checked().raise;
    const weights = Object.fromEntries(JSON.parse(readState(dir, carriedPath('shop', 'weights'))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));
    assert.deepStrictEqual([listed.place, carriedIds('licensing').q3.startsWith(listed.answers), listed.text], ['fumi.discussion.licensing', true, point.text]);
    assert.deepStrictEqual([built.place, weights.q4.startsWith(built.answers), built.text, checked().raise.length], ['shop.specification', true, unclear.text, 2]);

    for (const [{ place, answers }, mechanism] of [[listed, 'The log says nothing of a card.'], [built, 'The log weighs both.']]) {
      const { res } = await okSectionsAsync(dir, ['raise', place, '--answers', answers, '--fact'], {
        env: SESSION, stdin: JSON.stringify({ question: place === built.place ? unclear.text : point.text, rows: [], mechanism, product_wide: false }),
      });
      if (place === built.place) ok(dir, ['raise', 'answer', res.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'By price.', why: 'The person said so.' }) });
    }

    assert.deepStrictEqual([checked().raise, checked().passed], [[], true]);
    ok(dir, ['checklist', 'close', 'directive', RECORDS], { env: SESSION });
    const { sections } = okSections(dir, ['enter', 'discussion', 'fumi', 'billing'], { env: SESSION });
    const call = /^product: `node \S+ (ledger product fumi billing)`$/m.exec(sections)?.[1];
    assert.strictEqual(call, 'ledger product fumi billing', sections);
    const billing = carriedIds('billing');
    const discovery = ok(dir, call.split(' ')).discovery.map((/** @type {{id: string, event: string}} */ { id, event }) => [event, Object.keys(billing).find((ref) => billing[ref].startsWith(id))]);
    assert.deepStrictEqual(discovery, [['found', 'f1'], ['asked', 'q1']]);
  });
});

describe('from a linked worktree (4.1.4)', () => {
  it('the carry reads the record where the state keeps it, and with the check reads `.workflows/` in the main checkout — its old map there — not the worktree\'s branch, whose map differs; carried, what was said beside the record is cleared', () => {
    dir = world();
    const side = path.join(path.dirname(dir), 'side');
    git(dir, ['worktree', 'add', '-q', '-b', 'side', side]);
    const manifest = path.join(side, '.workflows/fumi/manifest.json');
    const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    fs.writeFileSync(manifest, JSON.stringify({ ...old, phases: { ...old.phases, research: {}, discussion: { items: { ...old.phases.discussion.items, search: { status: 'in-progress', subtopics: {} } } } } }));
    git(side, ['commit', '-q', '-am', 'the side branch drops search\'s map']);

    const { error } = harness.refuses(side, carryArgs(dir, 'fumi.discussion.search', bareSearch()), { env: SESSION });

    assert.strictEqual(error, breaks('fumi', 'search', SEARCH_UNCARRIED));
    writeState(dir, findingsPath('fumi', 'search'), '## Ranking\n\nDropped.\n');
    carry('fumi.discussion.search', GOOD['fumi.discussion.search'], dir, side);
    assert.deepStrictEqual([findingsPath('fumi', 'search'), refusedPath('fumi', 'search')].map((rel) => fs.existsSync(statePath(dir, rel))), [false, false]);
    assert.deepStrictEqual(unfinished(side), unfinished(dir));
  });
});

describe('what the check reads once a record is carried', () => {
  it('a section a later edit took from its file fails its entry; a record kept but not in the ledger, a session dying between the two (21.10.9), and a kept record of no entries beside a log that holds some, fail their topics', () => {
    dir = carriedWorld();
    writeState(dir, layout.topic('gone', 'gone', 'log.md'), '## Discussion\n\nA race.\n');
    writeState(dir, carriedPath('platform', 'auth'), JSON.stringify({ unit: 'platform', phase: 'discussion', topic: 'auth', entries: [{ ref: 'q1', id: 'aaaaaaaaaaaaaaaaaaaaa' }], record: { entries: GOOD['platform.discussion.auth'] } }));
    writeState(dir, carriedPath('shop', 'weights'), JSON.stringify({ unit: 'shop', phase: 'discussion', topic: 'weights', entries: [], record: { entries: [] } }));

    assert.deepStrictEqual(unfinished(), {
      'gone/gone': ['entry q1 cites "Cause" in gone/topics/gone/log.md, which has no such heading'],
      'platform/auth': ['its record never reached the ledger'],
      'shop/weights': ['its record is empty, and its log or brief holds text past its headings', unnamed('tie-break', 'decided'), ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail', 'Corrigenda', 'Corrigenda > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
    });
  });

  it('a record of no entries passes where its log and brief hold nothing past their headings, and fails where either holds text', () => {
    dir = carriedWorld();
    writeState(dir, layout.topic('gone', 'gone', 'log.md'), '# Gone\n\n## Discussion\n');
    writeState(dir, carriedPath('gone', 'gone'), JSON.stringify({ unit: 'gone', phase: 'discussion', topic: 'gone', entries: [], record: { entries: [] } }));
    const empty = () => (unfinished()['gone/gone'] ?? []).filter((problem) => problem.startsWith('its record is empty'));

    const titled = empty();
    writeState(dir, layout.topic('gone', 'gone', 'brief.md'), '# Gone\n\nWhy the queue drops jobs.\n');

    assert.deepStrictEqual([titled, empty()], [[], ['its record is empty, and its log or brief holds text past its headings']]);
  });

  it('once every topic of a unit has a record, composed or carried, each section of its approved specs holding text that no record cites is named on the topics drawing on it — a joined spec\'s by its part, a heading two parts share once in each — asking no composer for an entry, until a record cites it or the session marks it, a mark in its part alone, as holding no topic\'s (21.6.4)', () => {
    dir = world();
    const [q1, d1] = GOOD['shop.discussion.weights'];
    writeState(dir, composedPath('shop', 'weights'), JSON.stringify({ entries: [q1, d1] }));

    const composed = unfinished()['shop/weights'];
    writeState(dir, sectionsMarked('shop'), JSON.stringify({ 'shop/spec.md': { '2. Wishlist': ['Saving', 'Ranking'] } }));
    const marked = unfinished()['shop/weights'];

    assert.deepStrictEqual([composed, marked, ok(dir, ['ledger', 'carry', 'shop.discussion.weights', '--dry-run'], { env: SESSION }).faults], [
      ['has no record yet', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
      ['has no record yet', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail'])],
      [],
    ]);
  });

  it('a heading its part holds more than once is each copy a section of its own, named by the path that tells it apart: a cite by that path counts for its copy alone, a bare cite for none of them, and a mark by its path silences its copy alone', () => {
    dir = world();
    const [q1, d1, q2, d2, ...rest] = GOOD['shop.discussion.weights'];
    const spec = (/** @type {string[]} */ sections) => sections.map((section) => ({ path: 'shop/spec.md', section }));
    /** The copies of Detail the check names, d2 citing `sections`. @param {string[]} sections */
    const details = (sections) => {
      writeState(dir, composedPath('shop', 'weights'), JSON.stringify({ entries: [q1, { ...d1, cites: spec(['Corrigenda']) }, q2, { ...d2, cites: spec(sections) }, ...rest] }));
      return unfinished()['shop/weights'].filter((problem) => problem.includes('Detail'));
    };

    const bare = details(['Ranking', 'Detail']);
    const byPath = details(['Ranking', 'Ranking > Detail']);
    writeState(dir, sectionsMarked('shop'), JSON.stringify({ 'shop/spec.md': { '1. Weights': ['Corrigenda > Detail'] } }));
    const marked = details(['Ranking', 'Detail']);

    assert.deepStrictEqual([bare, byPath, marked], [
      shopUncited('1. Weights', ['Ranking > Detail', 'Corrigenda > Detail']),
      shopUncited('1. Weights', ['Corrigenda > Detail']),
      shopUncited('1. Weights', ['Ranking > Detail']),
    ]);
  });

  it('a spec kept whole with no one root: a heading atop it named by its own heading, its copy under another by its path, each settled by its own mark', () => {
    dir = world();
    const commerce = approvedCommerce(() => '## Decision\n\nThirty days.\n\n## Option A\n\n### Decision\n\nFourteen days.\n');
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) writeState(dir, composedPath('fumi', dotpath.split('.')[2]), JSON.stringify({ entries }));
    const named = () => unfinished()['fumi/licensing'].filter((problem) => problem.includes(commerce));

    const before = named();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [commerce]: ['Decision'] }));

    assert.deepStrictEqual([before, named()], [['Decision', 'Option A > Decision'].map((section) => uncited('fumi', commerce, section)), [uncited('fumi', commerce, 'Option A > Decision')]]);
  });

  it('carries no topic of a unit drawing on an approved spec while any topic of it has no record its verifier passed, or a section of its specs goes uncited: the session\'s order, refused with nothing written, nor anything beside the record (21.10.9)', () => {
    dir = world();
    const commerce = approvedCommerce((text) => `${text}\n## Refunds\n\nWithin a week.\n`);
    const waits = (/** @type {string[]} */ reasons) => `ledger carry: fumi's licensing is carried once every topic of fumi has its record passed by its verifier and no section of its approved specs goes uncited — a topic carried takes no section found later: ${reasons.join('; ')}`;
    const licensing = () => refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.licensing', GOOD['fumi.discussion.licensing']), { env: SESSION }, harness);
    const others = ['billing', 'search', 'support'];

    const alone = licensing();
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) writeState(dir, composedPath('fumi', dotpath.split('.')[2]), JSON.stringify({ entries }));
    const unverified = licensing();
    for (const topic of others) writeState(dir, findingsPath('fumi', topic), topic === 'search' ? '## Ranking\n\nDropped.\n' : '');
    const standing = licensing();
    writeState(dir, findingsPath('fumi', 'search'), '');
    const uncitedRefunds = licensing();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [commerce]: ['Refunds'] }));
    carry('fumi.discussion.licensing', GOOD['fumi.discussion.licensing']);

    assert.deepStrictEqual([alone, unverified, standing, uncitedRefunds, fs.existsSync(statePath(dir, refusedPath('fumi', 'licensing')))], [
      waits(others.map((topic) => `fumi's ${topic} has no record composed`)),
      waits(others.map((topic) => `fumi's ${topic} has not passed its verifier — ${findingsPath('fumi', topic)} is no file`)),
      waits([`fumi's search has not passed its verifier — its findings stand in ${findingsPath('fumi', 'search')}`]),
      waits([uncited('fumi', commerce, 'Refunds')]),
      false,
    ]);
  });

  it('rests on the record the carry kept and on its ids in the ledger: a ledger line reshaped beyond its id changes nothing', () => {
    dir = carriedWorld();
    const ledger = statePath(dir, layout.ledger);
    fs.writeFileSync(ledger, fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean).map((line) => JSON.stringify({ id: JSON.parse(line).id, shape: 'a later version' })).join('\n') + '\n');

    assert.deepStrictEqual(checked().unfinished, []);
  });
});

// A project in today's layout for the real move (078): an epic whose search
// topic has a discussion with its map, research with a thread still
// digging, an import come in from its discussion, and a review the old
// agent store holds never folded in.
const TODAYS = Object.freeze({
  '.workflows/manifest.json': `${JSON.stringify({ work_units: { fumi: { work_type: 'epic' } } })}\n`,
  '.workflows/fumi/manifest.json': `${JSON.stringify({
    name: 'fumi', work_type: 'epic', status: 'in-progress', description: 'fumi', created: '2026-01-01',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-01-02T10:00:00Z', origin: 'discussion/search' }],
    phases: {
      research: { items: { search: { status: 'completed', threads: { 'index-size': { question: 'How big does the index grow?', status: 'digging', origin: 'seed', parent: null } } } } },
      discussion: { items: { search: { status: 'in-progress', subtopics: { ranking: { status: 'decided', parent: null }, 'typo-tolerance': { status: 'exploring', parent: null } } } } },
    },
  })}\n`,
  '.workflows/fumi/research/search.md': '# Research: Search\n\n## Index Size\n\nStill digging.\n',
  '.workflows/fumi/discussion/search.md': '# Discussion: Search\n\n## Ranking\n\nBy recency.\n',
  '.workflows/fumi/imports/notes.md': '# Notes\n',
  '.workflows/.cache/fumi/discussion/search/state.json': `${JSON.stringify({ agents: { 'review-001': { id: 'review-001', kind: 'review', status: 'acknowledged' } } })}\n`,
  '.workflows/.cache/fumi/discussion/search/review-001.md': '### F1: Ranking ties\n\nTwo results of one age have no order.\n',
});

describe('against what the real move writes (078)', () => {
  it('its topic a piece, its review folded into its log, and an empty record asked for its old map, its thread and its import', () => {
    dir = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-moved-'))), 'fumi');
    initRepo(dir);
    for (const [rel, text] of Object.entries(TODAYS)) createFile(dir, rel, text);
    commitAll(dir);
    MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });

    assert.deepStrictEqual(checked().unfinished, [{ name: 'fumi/search', problems: ['has no record yet'] }]);
    assert.ok(readState(dir, layout.topic('fumi', 'search', 'log.md')).endsWith('\n## Review review-001, never folded in\n\n#### F1: Ranking ties\n\nTwo results of one age have no order.\n'));
    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', [
      'its record is empty, and its log or brief holds text past its headings', unnamed('ranking', 'decided'), unnamed('typo-tolerance', 'exploring'),
      'the thread index-size is still digging in its research, and no entry names it as its thread', 'fumi/assets/notes.md came in from discussion/search, and no entry links it',
    ]));
  });
});

describe('the directive\'s example record, frozen with 079', () => {
  it('carries as the directive writes it, its placeholders filled, and its topic is done', () => {
    dir = world();
    const fills = {
      unit: 'fumi', topic: 'licensing', subtopic: 'trial-length', heading: 'Trial Length', 'repeated heading': 'Decision', file: 'pricing.md', experiment: 'E2-trial', 'report heading': 'Result',
      question: 'How long is the trial?', answer: 'Fourteen days.', 'second answer': 'Extended once, by a week.', why: 'The log settles it.', fact: 'A week converts as well.',
      how: 'measured by the trial experiment', command: 'npm run trial', result: 'as well', 'open question': 'Does the trial need a card?', thread: 'card-on-trial',
    };
    const example = /```json\n([^]*?)\n```/.exec(fs.readFileSync(DIRECTIVE, 'utf8'))?.[1] ?? '';
    const { entries } = JSON.parse(example.replace(/\{([a-z ]+)\}/g, (whole, name) => fills[/** @type {keyof typeof fills} */ (name)] ?? whole));

    carry('fumi.discussion.licensing', entries);

    assert.strictEqual(unfinished()['fumi/licensing'], undefined);
  });

  it('a reversal the session settles: a ruling that changes the record becomes a finding to amend to, one that keeps it takes the finding out — so an empty findings file is only ever a pass', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual(['Where the ruling has the record change, replace the finding with `Settled: {point}, amend to agree`', 'Where the ruling keeps the record as it stands, take the finding out of the findings file', 'An empty findings file is only ever a pass.'].filter((rule) => !text.includes(rule)), []);
  });

  it('a section no record cites goes to the topic it belongs to where it holds a decision, a finding or an open question, and a unit\'s topics are carried once its records are passed and its sections settled', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual(['Where it holds a decision, a finding or an open question of a topic\'s, write it into the findings of the topic its subject belongs to, one of those the check names it on', 'So a unit\'s topics are carried in order: compose every topic\'s record, have each verifier pass it, settle the sections the check names, then carry them.'].filter((rule) => !text.includes(rule)), []);
  });

  it('a spec section the record cites is carried whole: citing it for one rule and leaving its others out is a gap', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.ok(text.includes('- **A cited section, whole.** A spec section the record cites is carried whole: each current decision, finding and open question it holds that concerns this topic is an entry. Citing a section for one of its rules and leaving its others out is a gap.'));
  });

  it('carries nothing of a cancelled unit holding an approved spec and no topic: its spec the reference it is, governing nothing', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.ok(text.includes('Nor is anything of a cancelled unit holding an approved spec and no topic: its spec stays in its assets, the reference it is, and a cancelled unit\'s decisions govern nothing.'));
  });

  it('spells no path from the session\'s folder: every state path is the brief\'s or the engine\'s, the carry naming the record\'s place alone, a topic\'s or a unit\'s own', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([text.includes('.ledger/'), /ledger carry \{place\}\n/.test(text), text.includes('a topic\'s, `{unit}.{phase}.{topic}`, or a unit\'s own, `{unit}.discovery`')], [false, true, true]);
  });
});
