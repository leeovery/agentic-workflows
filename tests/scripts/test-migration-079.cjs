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
const { SESSION, recordsMigration, refusedKeeping, refusedUntouched, passedBeside } = require('./migration-world.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { composedPath, carriedPath, findingsPath, rulingsPath, checkedPath, verifyingPath, refusedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

/** Where the session marks the sections of a unit's specs holding no topic's decision. @param {string} unit */
const sectionsMarked = (unit) => `.cache/migrate/records/${unit}.sections.json`;
const DIRECTIVE = path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations/079-records.md');
const MOVE = require('../../skills/ledger-migrate/scripts/migrations/078-reshape-move.cjs');

const RECORDS = '079-records';
const TOPICS = { one: 'topic', many: 'topics' };
const PIECES = ['fumi.discovery.billing', 'fumi.discussion.licensing', 'fumi.discussion.search', 'fumi.discovery.support', 'gone.discussion.gone', 'platform.discussion.auth', 'shop.discussion.weights'];

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
    { ref: 'q2', event: 'asked', text: 'How are items ranked?', by: 'claude', cites: [{ path: 'shop/spec.md', section: '1. Weights > Ranking' }] },
    { ref: 'd2', event: 'decided', answers: 'q2', text: 'Newest first, by day; a wishlist newest saved first.', why: 'The spec settles it.', by: 'claude', given: 'carried', cites: ['1. Weights > Ranking', '2. Wishlist > Ranking', 'Ranking > Detail'].map((section) => ({ path: 'shop/spec.md', section })) },
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
  for (const [rel, text] of passedBeside(unit, topic, entries)) writeState(at, rel, text);
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

/** The fault of an empty record of a topic with sources. */
const EMPTY = 'its record is empty, and it has sources — a spec it draws on, or its own markdown files holding text past their headings: compose it from them';

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

/** What a cite naming several headings breaks, naming each it reaches as one cite would name it alone. @param {string} name @param {string} at @param {string[]} names */
const tellApart = (name, at, names) => `cites "${name}" in ${at}, which holds ${names.length} headings so named — a cite names one, by the path that tells it apart, or, of headings sharing their path, by its place among them: ${names.map((each) => `"${each}"`).join(', ')}`;

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
      ok: true, directive: RECORDS, passed: false, done: 0, of: 7, counts: TOPICS, unfinished: PIECES.map((name) => ({ name, problems: ['has no record composed'] })),
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

    assert.strictEqual(unfinished()['fumi.discussion.search'], undefined);
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
    assert.strictEqual(refused('shop.discussion.weights', []), breaks('shop', 'weights', [EMPTY, unnamed('tie-break', 'decided')]));
    carry('fumi.discovery.support', []);
  });

  it('an empty record of a topic with no log nor experiment still carries its old map and its threads (21.12.7, 21.6.7)', () => {
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'log.md')));
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'experiments')), { recursive: true });

    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', SEARCH_UNCARRIED));
  });

  it('an empty record refused where any of its sources holds text, an experiment\'s record alone or a spec it draws on alone, the way on to compose it', () => {
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'log.md')));
    for (const file of ['log.md', 'brief.md']) fs.rmSync(statePath(dir, layout.topic('fumi', 'licensing', file)));
    fs.rmSync(statePath(dir, layout.topic('fumi', 'licensing', 'experiments')), { recursive: true });

    assert.deepStrictEqual(['fumi.discussion.search', 'fumi.discussion.licensing'].map((place) => refused(place, []).includes(EMPTY)), [true, true]);
  });

  it('an empty record of a topic whose own files holding text are no markdown, and which draws on no spec, carries: a data file is read through the record naming it', () => {
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'log.md')));
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'report.md')));
    writeState(dir, layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'data.json'), '{"p95": 12}\n');

    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', SEARCH_UNCARRIED));
  });

  it('the unit\'s spec.md where its building never started; where it started, a heading the spec the move joined lacks — whatever its specs under `.workflows/` hold now; a heading\'s path the spec\'s headings lack refused, and one they hold, a part\'s heading over it among them, taken', () => {
    fs.appendFileSync(path.join(dir, '.workflows/shop/specification/weights/specification.md'), '\n## Pricing\n\nBy price.\n');
    const licensing = GOOD['fumi.discussion.licensing'];
    const [question, decision] = GOOD['shop.discussion.weights'];
    assert.strictEqual(refused('fumi.discussion.licensing', [...licensing.slice(0, 3), { ...licensing[3], cites: [{ path: 'fumi/spec.md', section: 'Corrigenda' }] }]),
      breaks('fumi', 'licensing', ['entry d2 cites fumi/spec.md, which the state does not hold']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...question, cites: ['Pricing', 'Saving'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]),
      breaks('shop', 'weights', ['entry q1 cites "Pricing" in shop/spec.md, which has no such heading']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...question, cites: ['Saving > Detail', 'Corrigenda > Detail'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]),
      breaks('shop', 'weights', ['entry q1 cites "Saving > Detail" in shop/spec.md, which has no such heading path']));
    carryArgs(dir, 'shop.discussion.weights', [{ ...question, cites: ['2. Wishlist > Ranking', '1. Weights > Ranking > Detail'].map((section) => ({ path: 'shop/spec.md', section })) }, decision]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'carry', 'shop.discussion.weights', '--dry-run'], { env: SESSION }).faults, []);
  });

  it('a cite naming several headings refused, naming the paths that tell them apart — a log\'s, and a spec\'s among the parts its topic draws on, a bare heading two of them hold once each among them; a heading whose text holds the joint, and one atop a file of no one root, each named by its own text', () => {
    const log = layout.topic('fumi', 'licensing', 'log.md');
    fs.appendFileSync(statePath(dir, log), '\n### Seats\n\n#### Decision\n\nFive seats.\n\n### Cache > Disk\n\nOn disk.\n');
    const licensing = (/** @type {string[]} */ sections) => GOOD['fumi.discussion.licensing'].map((entry) => (entry.ref === 'd1' ? { ...entry, cites: [...sections.map((section) => logCite('fumi', 'licensing', section)), entry.cites[1]] } : entry));
    const [question, decision] = GOOD['shop.discussion.weights'];
    const weights = (/** @type {string[]} */ sections) => [{ ...question, cites: sections.map((section) => ({ path: 'shop/spec.md', section })) }, decision];
    const faults = (/** @type {string} */ dotpath, /** @type {unknown[]} */ entries) => ok(dir, [...carryArgs(dir, dotpath, entries), '--dry-run'], { env: SESSION }).faults;

    const logBare = refused('fumi.discussion.licensing', licensing(['Decision']));
    const specBare = refused('shop.discussion.weights', weights(['Detail', 'Ranking']));
    const told = [faults('fumi.discussion.licensing', licensing(['Trial Length > Decision', 'Seats > Decision', 'Cache > Disk'])), faults('shop.discussion.weights', weights(['1. Weights > Ranking', 'Corrigenda > Detail']))];
    fs.appendFileSync(statePath(dir, log), '\n## Decision\n\nKept.\n');
    const atop = faults('fumi.discussion.licensing', licensing(['Decision', 'Trial Length > Decision']));

    assert.deepStrictEqual([logBare, specBare, told, atop], [
      breaks('fumi', 'licensing', [`entry d1 ${tellApart('Decision', log, ['Trial Length > Decision', 'Seats > Decision'])}`]),
      breaks('shop', 'weights', [`entry q1 ${tellApart('Detail', 'shop/spec.md', ['Ranking > Detail', 'Corrigenda > Detail'])}`, `entry q1 ${tellApart('Ranking', 'shop/spec.md', ['1. Weights > Ranking', '2. Wishlist > Ranking'])}`]),
      [[], []],
      [],
    ]);
  });

  it('headings sharing their whole path, siblings of one heading, each cited by that path and its place among them, from one, as the walk sheet shows it — the path alone, or a place none holds, refused, naming each by its place', () => {
    const log = layout.topic('fumi', 'licensing', 'log.md');
    fs.appendFileSync(statePath(dir, log), '\n### Seats\n\n#### Decision\n\nFive seats.\n\n#### Decision\n\nSix seats.\n');
    const licensing = (/** @type {string} */ section) => GOOD['fumi.discussion.licensing'].map((entry) => (entry.ref === 'd1' ? { ...entry, cites: [logCite('fumi', 'licensing', section), entry.cites[1]] } : entry));
    const refusal = breaks('fumi', 'licensing', [`entry d1 ${tellApart('Seats > Decision', log, ['Seats > Decision [1]', 'Seats > Decision [2]'])}`]);

    assert.deepStrictEqual(['Seats > Decision', 'Seats > Decision [3]'].map((section) => refused('fumi.discussion.licensing', licensing(section))), [refusal, refusal.replace('cites "Seats > Decision"', 'cites "Seats > Decision [3]"')]);
    carry('fumi.discussion.licensing', licensing('Seats > Decision [2]'));
  });

  it('a spec\'s heading its topic\'s parts lack, cited, is named alone among every part\'s — two copies another part holds refused, one each of two parts too, where the topic draws on none of them — and taken by the path, or the place, that tells it apart', () => {
    const old = path.join(dir, '.workflows/shop/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(old, 'utf8'));
    manifest.phases.specification.items.wishlist.sources = {};
    fs.writeFileSync(old, JSON.stringify(manifest));
    fs.appendFileSync(statePath(dir, 'shop/spec.md'), '\n### Notes\n\nOne.\n\n### Notes\n\nTwo.\n');
    const [question, decision] = GOOD['shop.discussion.weights'];
    const weights = (/** @type {string} */ section) => [{ ...question, cites: [{ path: 'shop/spec.md', section }] }, decision];
    /** @param {string} section */
    const faults = (section) => ok(dir, [...carryArgs(dir, 'shop.discussion.weights', weights(section)), '--dry-run'], { env: SESSION }).faults;

    const otherPart = [faults('Notes'), faults('Notes [2]')];
    const { weights: drawn, ...others } = manifest.phases.specification.items;
    manifest.phases.specification.items = { ...others, pricing: drawn };
    fs.writeFileSync(old, JSON.stringify(manifest));
    const noPart = [faults('Ranking'), faults('2. Wishlist > Ranking')];

    assert.deepStrictEqual([otherPart, noPart], [
      [[`entry q1 ${tellApart('Notes', 'shop/spec.md', ['Notes [1]', 'Notes [2]'])}`], []],
      [[`entry q1 ${tellApart('Ranking', 'shop/spec.md', ['1. Weights > Ranking', '2. Wishlist > Ranking'])}`], []],
    ]);
  });
});

describe('a file an agent left beside the records', () => {
  it('named to remove, on the topic it is named for, else on the unit\'s own record, or each of its topics where it has none; a file a record is kept in, and the session\'s marks, never', () => {
    dir = world();
    const at = (/** @type {string} */ rel) => `.cache/migrate/records/${rel}`;
    for (const rel of ['fumi/licensing.json.tmp', 'fumi/notes/pn-refs.txt', 'fumi.brief-record.json', 'shop.aa-amend.py', 'fumi/search.findings.txt', 'fumi/search.rounds.md', 'fumi.sections.json']) writeState(dir, at(rel), '');
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Selling\n\nTo the trade.\n');
    const left = (/** @type {string[]} */ rels) => rels.map((rel) => `${at(rel)} is no file a record is kept in — an agent left it: remove it`);
    const loose = left(['fumi/notes/pn-refs.txt', 'fumi.brief-record.json']);

    assert.deepStrictEqual(Object.fromEntries(Object.entries(unfinished()).map(([name, problems]) => [name, problems.filter((problem) => problem.includes('an agent left it'))])), {
      'fumi.discovery.billing': loose, 'fumi.discussion.licensing': [...left(['fumi/licensing.json.tmp']), ...loose], 'fumi.discussion.search': loose, 'fumi.discovery.support': loose,
      'gone.discussion.gone': [], 'platform.discussion.auth': [], 'shop.discussion.weights': [], 'shop.discovery': left(['shop.aa-amend.py']),
    });
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
      { name: 'shop.discovery', problems: ['has no record composed'] },
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
  it('lists a started topic\'s points of a unit in progress alone, at its specification where it has its spec: a completed unit\'s none, its code settling what it built, nor a cancelled unit\'s', () => {
    dir = world();
    const raises = require('../../skills/ledger-migrate/scripts/migrations/079-records.check.cjs').raises;
    const point = (/** @type {string} */ unit, /** @type {string} */ topic) => {
      const record = { entries: [{ ref: 'q1', event: 'asked', text: `What of ${topic}?`, by: 'claude', raise: true, cites: [logCite(unit, topic, 'Discussion')] }] };
      writeState(dir, carriedPath(unit, topic), JSON.stringify({ unit, phase: 'discussion', topic, entries: [{ ref: 'q1', id: `${topic}-id` }], record }));
    };
    point('shop', 'weights');
    point('gone', 'gone');
    const building = raises({ projectDir: dir, stateDir: statePath(dir) });
    writeState(dir, layout.manifest('shop'), JSON.stringify({ ...JSON.parse(readState(dir, layout.manifest('shop'))), status: 'completed' }));

    assert.deepStrictEqual([building, raises({ projectDir: dir, stateDir: statePath(dir) })], [[{ place: 'shop.specification', answers: 'weights-id', text: 'What of weights?' }], []]);
  });

  it('a point marked to raise where nothing raises it refused at the carry, naming why — a topic never started, a unit\'s own record, a cross-cutting unit\'s, a completed unit\'s, a cancelled unit\'s and a topic set aside — its point an open question carried unmarked (21.6.11)', () => {
    dir = world();
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Selling\n\nWho sets the case size?\n');
    const vision = { ref: 'f1', event: 'found', text: 'The shop sells to the trade.', how: 'read in the discovery session', known: 'read', by: 'claude', cites: [{ path: 'shop/discovery/session-001.md', section: 'Selling' }], assets: [{ path: layout.assets('shop', 'vision.md'), status: 'reference' }] };
    const search = JSON.parse(readState(dir, layout.manifest('fumi')));
    search.phases.discussion.items.search.status = 'cancelled';
    writeState(dir, layout.manifest('fumi'), JSON.stringify(search));
    const shop = JSON.parse(readState(dir, layout.manifest('shop')));
    const open = (/** @type {unknown} */ cites) => ({ ref: 'q9', event: 'asked', text: 'Is it settled?', by: 'claude', raise: true, cites });
    const marked = (/** @type {string} */ dotpath) => refused(dotpath, [...GOOD[dotpath], open(GOOD[dotpath][0].cites)]);
    const why = (/** @type {string} */ reason) => [`entry q9 is marked to raise, and ${reason}: its point is an open question, carried unmarked`];

    const refusals = ['fumi.discovery.billing', 'platform.discussion.auth', 'gone.discussion.gone', 'fumi.discussion.search'].map(marked);
    const own = refusedKeeping(dir, carryArgs(dir, 'shop.discovery', [vision, open(vision.cites)]), refusedPath('shop', null));
    writeState(dir, layout.manifest('shop'), JSON.stringify({ ...shop, status: 'completed' }));
    const completed = marked('shop.discussion.weights');

    assert.deepStrictEqual([...refusals, own, completed], [
      breaks('fumi', 'billing', why('its topic never started, so is carried in discovery, where nothing is raised')),
      breaks('platform', 'auth', why('a cross-cutting unit\'s record is the product\'s')),
      breaks('gone', 'gone', why('its unit is cancelled, and only a unit in progress raises its points')),
      breaks('fumi', 'search', why('its topic is set aside')),
      `ledger carry: shop's own discovery breaks the records directive's rules, so nothing is carried — ${why('a unit\'s own record is carried in discovery, where nothing is raised')[0]}`,
      breaks('shop', 'weights', why('its unit is completed, and only a unit in progress raises its points')),
    ]);
  });

  it('says the raises at the end are of a started topic of a unit in progress alone, each a decision only the person can make, what a row\'s notice is, and a point two records carry raised once, its answer merged into the other', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      '- At the end, each point no source settles on a started topic of a unit\n  in progress, raised one at a time: answered, or left open.',
      'So is such a point where nothing raises it, and the carry refuses the mark there: on a topic never started, or a unit\'s own record, carried in discovery, where nothing is decided, for its first opening to read; of a cross-cutting unit, whose record is the product\'s, for the product\'s conversation; of a completed unit, whose code settled what it built; and of a cancelled or postponed unit, or a topic set aside, waiting with it.',
      'raise each, one at a time, as a decision only the person can make, at its `place`, answering its question. A point two records carry, listed twice, is raised once.',
      'each `{"key", "name", "text", "notice"}` — its key, a short name for the answer, the answer, and what the person would notice were it the one, each one line;',
      'node .claude/skills/ledger-engine/scripts/engine.cjs ledger merge {place} --question {answers} --into {answered}',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('once the check passes, it lists each open question marked to raise, at the topic, or at the unit\'s specification where the unit has its spec, until this conversation raises it there — drawn as a decision only the person can make — the person answering, and the directive closes; a topic never started reads its unmarked open questions at its first opening (8.3.4, 9.3.6)', async () => {
    dir = world();
    const point = { ref: 'q3', event: 'asked', text: 'Does the trial need a card?', by: 'claude', raise: true, cites: [logCite('fumi', 'licensing', 'Trial Length')] };
    const unsettled = { ref: 'q1', event: 'asked', text: 'Are rates set per seat or per team?', by: 'claude', cites: [{ path: layout.assets('fumi', 'rates.md'), section: 'Rates' }] };
    const unclear = { ref: 'q4', event: 'asked', text: 'Do ties break by price or by name?', by: 'claude', raise: true, cites: [logCite('shop', 'weights', 'Tie Break')] };
    for (const [dotpath, entries] of Object.entries(GOOD)) {
      if (dotpath === 'fumi.discussion.licensing') carry(dotpath, [...entries, point]);
      else if (dotpath === 'fumi.discovery.billing') carry(dotpath, [...entries, unsettled]);
      else if (dotpath === 'shop.discussion.weights') carry(dotpath, [...entries, unclear]);
      else carry(dotpath, entries);
    }
    /** The id the carry gave each of a topic's entries, by its ref. @param {string} topic @returns {Record<string, string>} */
    const carriedIds = (topic) => Object.fromEntries(JSON.parse(readState(dir, carriedPath('fumi', topic))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));

    const [listed, built] = checked().raise;
    const weights = Object.fromEntries(JSON.parse(readState(dir, carriedPath('shop', 'weights'))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));
    assert.deepStrictEqual([listed.place, carriedIds('licensing').q3.startsWith(listed.answers), listed.text], ['fumi.discussion.licensing', true, point.text]);
    assert.deepStrictEqual([built.place, weights.q4.startsWith(built.answers), built.text, checked().raise.length], ['shop.specification', true, unclear.text, 2]);

    /** @type {string[]} */
    const asking = [];
    for (const [{ place, answers }, mechanism] of [[listed, 'The log says nothing of a card.'], [built, 'The log weighs both.']]) {
      const { res, sections } = await okSectionsAsync(dir, ['raise', place, '--answers', answers, '--fact'], {
        env: SESSION, stdin: JSON.stringify({ question: place === built.place ? unclear.text : point.text, rows: [], mechanism, product_wide: false }),
      });
      asking.push(/WHY I'M ASKING\n\n(.*)\n/.exec(sections)?.[1] ?? sections);
      if (place === built.place) ok(dir, ['raise', 'answer', res.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'By price.', why: 'The person said so.' }) });
    }

    assert.deepStrictEqual(asking, Array(2).fill('Only you can decide this: nothing from before Ledger settles it.'), 'a decision only the person can make, never a fact');

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
      'gone.discussion.gone': ['entry q1 cites "Cause" in gone/topics/gone/log.md, which has no such heading'],
      'platform.discussion.auth': ['its record never reached the ledger'],
      'shop.discussion.weights': [EMPTY, unnamed('tie-break', 'decided'), ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail', 'Corrigenda', 'Corrigenda > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
    });
  });

  it('a record of no entries passes where its log and brief hold nothing past their headings, and fails where either holds text', () => {
    dir = carriedWorld();
    writeState(dir, layout.topic('gone', 'gone', 'log.md'), '# Gone\n\n## Discussion\n');
    writeState(dir, carriedPath('gone', 'gone'), JSON.stringify({ unit: 'gone', phase: 'discussion', topic: 'gone', entries: [], record: { entries: [] } }));
    const empty = () => (unfinished()['gone.discussion.gone'] ?? []).filter((problem) => problem.startsWith('its record is empty'));

    const titled = empty();
    writeState(dir, layout.topic('gone', 'gone', 'brief.md'), '# Gone\n\nWhy the queue drops jobs.\n');

    assert.deepStrictEqual([titled, empty()], [[], [EMPTY]]);
  });

  it('once every topic of a unit has a record, composed or carried, each section of its approved specs holding text that no record cites is named on the topics drawing on it — a joined spec\'s by its part, a heading two parts share once in each — asking no composer for an entry, until a record cites it or the session marks it, a mark in its part alone, as holding no topic\'s (21.6.4); the record named passed and waiting to be carried only once the carry\'s own guards hold, else what they name', () => {
    dir = world();
    const [q1, d1] = GOOD['shop.discussion.weights'];
    writeState(dir, composedPath('shop', 'weights'), JSON.stringify({ entries: [q1, d1] }));

    const composed = unfinished()['shop.discussion.weights'];
    writeState(dir, sectionsMarked('shop'), JSON.stringify({ 'shop/spec.md': { '2. Wishlist': ['Saving', 'Ranking'] } }));
    const marked = unfinished()['shop.discussion.weights'];
    writeState(dir, findingsPath('shop', 'weights'), '');
    const unchecked = unfinished()['shop.discussion.weights'][0];
    writeState(dir, checkedPath('shop', 'weights'), 'q1: ok\nd1: ok\n');
    const passed = unfinished()['shop.discussion.weights'];
    writeState(dir, verifyingPath('shop', 'weights'), JSON.stringify({ hash: 'another record', refs: ['q1', 'd1'], entries: {} }));
    const changed = unfinished()['shop.discussion.weights'][0];

    assert.deepStrictEqual([composed, marked, unchecked, passed, changed, ok(dir, ['ledger', 'carry', 'shop.discussion.weights', '--dry-run'], { env: SESSION }).faults], [
      [`has not passed its verifier — ${findingsPath('shop', 'weights')} is no file`, ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
      [`has not passed its verifier — ${findingsPath('shop', 'weights')} is no file`, ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail'])],
      `has no verdict from its last verifier on every entry its brief asked one of — ${checkedPath('shop', 'weights')} is no file; it names no verdict on q1, d1: a verifier writes a line for each entry its walk sheet does not mark passed, \`{ref}: ok\` or \`{ref}: see finding\`, and one that does not has given no verdict — remove ${findingsPath('shop', 'weights')}, ${rulingsPath('shop', 'weights')} and ${checkedPath('shop', 'weights')}, and brief a fresh verifier`,
      ['has passed its verifier, and waits to be carried', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail'])],
      'has changed since its verifier was briefed on it: a record is carried as its verifier read it — brief a fresh verifier',
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
      return unfinished()['shop.discussion.weights'].filter((problem) => problem.includes('Detail'));
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
    const named = () => unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes(commerce));

    const before = named();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [commerce]: ['Decision'] }));

    assert.deepStrictEqual([before, named()], [['Decision', 'Option A > Decision'].map((section) => uncited('fumi', commerce, section)), [uncited('fumi', commerce, 'Option A > Decision')]]);
  });

  it('21.6.3: a cite of an approved spec its topic draws no part of, the later answer to its point, gives that answer alone: it settles none of the spec\'s sections, which the topics drawing on it carry', () => {
    dir = world();
    const commerce = approvedCommerce((text) => text);
    const answered = { ref: 'd9', event: 'decided', answers: 'q1', text: 'Fourteen days, as the spec\'s corrigendum holds.', why: 'The approved spec answers it.', by: 'claude', given: 'carried', cites: [{ path: commerce, section: 'Corrigenda' }] };
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) {
      const topic = dotpath.split('.')[2];
      const record = topic === 'licensing' ? entries.filter(({ ref }) => !['q2', 'd2'].includes(ref)) : topic === 'search' ? [...entries, answered] : entries;
      writeState(dir, composedPath('fumi', topic), JSON.stringify({ entries: record }));
    }

    assert.deepStrictEqual(unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes(commerce)), [uncited('fumi', commerce, 'Corrigenda')]);
  });

  it('carries no topic of a unit drawing on an approved spec while any topic of it has no record its verifier passed, or a section of its specs goes uncited: the session\'s order, refused with nothing written, nor anything beside the record (21.10.9)', () => {
    dir = world();
    const commerce = approvedCommerce((text) => `${text}\n## Refunds\n\nWithin a week.\n`);
    const waits = (/** @type {string[]} */ reasons) => `ledger carry: fumi's licensing is carried once every topic of fumi has its record passed by its verifier and no section of its approved specs goes uncited — a topic carried takes no section found later: ${reasons.join('; ')}`;
    const licensing = () => refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.licensing', GOOD['fumi.discussion.licensing']), { env: SESSION }, harness);
    const others = ['billing', 'search', 'support'];

    const alone = licensing();
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) {
      writeState(dir, composedPath('fumi', dotpath.split('.')[2]), JSON.stringify({ entries }));
      writeState(dir, checkedPath('fumi', dotpath.split('.')[2]), entries.map(({ ref }) => `${ref}: ok\n`).join(''));
    }
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

    assert.deepStrictEqual(checked().unfinished, [{ name: 'fumi.discussion.search', problems: ['has no record composed'] }]);
    assert.ok(readState(dir, layout.topic('fumi', 'search', 'log.md')).endsWith('\n## Review review-001, never folded in\n\n#### F1: Ranking ties\n\nTwo results of one age have no order.\n'));
    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', [
      EMPTY, unnamed('ranking', 'decided'), unnamed('typo-tolerance', 'exploring'),
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

    assert.strictEqual(unfinished()['fumi.discussion.licensing'], undefined);
  });

  it('a reversal the session settles: a ruling that changes the record becomes a finding to amend to, one that keeps it takes the finding out — so an empty findings file is only ever a pass', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual(['Write what settles it, a line naming the point and the source or answer it rests on, into the settled file beside the record', 'Where it has the record change, replace the finding with `Settled: {point}, amend to agree`', 'Where it keeps the record as it stands, take the finding out of the findings file', 'An empty findings file is only ever a pass.'].filter((rule) => !text.includes(rule)), []);
  });

  it('one rule marks a point to raise: the points no source settles alone, every other open question carried unmarked', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      '- **Points no source settles** are open questions marked `raise` `true`, for the raises at the end, and they alone:',
      'Any other open question, one its sources leave for later work to answer, is carried unmarked.',
      '- **`raise`**: `true` on a point no source settles, as the rules above name them, an open question no decision of the record answers; on no other entry.',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('a ref is the record\'s alone: no entry\'s words name another by it', () => {
    assert.ok(fs.readFileSync(DIRECTIVE, 'utf8').includes('- **`ref`**: the entry\'s name in the record, given once; every link names an entry by it, and no entry\'s words do: say in words what the other entry holds.'));
  });

  it('a verifier\'s rulings are kept with its round, a reversal of one settled by the session as any, and every amend brief carries them', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      'and writes its findings beside the record, an empty file its pass; its rulings: each point of the sources it ruled is not this record\'s, or is replaced by a later answer, one line each, with its source; and its verdict on each entry the sheet does not mark passed unchanged, `{ref}: ok` or `{ref}: see finding`.',
      'keeps the last as a round in the rounds file beside the record, its rulings and verdicts with it, and clears them',
      'walking the sheet its brief draws: every section of every source, in order, with the entries citing each — from the second round, every section the sheet marks open, a closed one walked in an earlier round, nothing citing it changed since. It reads each section in its source, checks that what each entry beneath it takes from the section is what the section says, and each point the section makes is carried or not this record\'s — that a cited heading exists is no check —',
      'The next brief and the carry are refused while the last verifier\'s verdicts miss an entry its brief asked a verdict of, or name one the record it read does not hold: remove what it wrote, and brief a fresh verifier. The carry refuses a record changed since its verifier was briefed on it — brief a fresh verifier — and keeps the passing round with the rounds before it:',
      'Once every topic of a unit has its record composed, read each draft spec several of its topics draw on: a section of it bearing on no one topic\'s subject goes into the findings of one of the topics drawing on it, as below, for the check names an approved spec\'s sections alone.',
      '- **A record at least.** A topic that draws on a spec, or whose log, brief or experiments\' records — its markdown files — hold text past their headings, has an entry at least.',
      'A finding that opens `Reverses round {R}:` would undo what an earlier round had the record changed to, or carry a point an earlier round\'s rulings set aside: it goes to no agent, nor does a finding a per-topic agent handed back unanswered, asking for a point the rulings set aside, in the hand-back file beside the record, nor a finding the third round or a later one writes.',
      'a fresh verifier reads what changed since, until one passes it.',
      'A file an agent left beside the records, which the check names, is removed.',
      'Once it has returned, settle first each finding it handed back, as below: the verifier\'s brief and the carry are refused while its hand-back file stands. Then, where no `Settled:` finding stands, check the record as the carry would',
      'Settle every handed-back finding before anything else.',
      'Once every handed-back finding is settled, remove the hand-back file. Then, where a `Settled:` finding stands, a fresh per-topic agent amends the record to answer it, and a fresh verifier reads it again, its brief keeping it as a round — but where the findings settled are the third round\'s or a later one\'s, the session passes the record once it is amended, in the verifier\'s place, each finding of the round on stdin, `{"findings": [{"finding", "settled", "why"}]}`, `settled` `fixed` or `ruled-out`; the round and the session\'s after it are kept with the rounds, and the record goes to the carry as it stands:\n\n```bash\nnode .claude/skills/ledger-engine/scripts/engine.cjs ledger settle {place}\n```',
      'Where none stands after a hand-back, the findings left are those the agent answered: check the record, and a fresh verifier reads it next. Where none stands after a reversal, a finding left goes to a fresh per-topic agent, and where none is left, the file empty, the record has passed.',
      '- Nothing for any one entry, but a point the record\'s sources do not\n  settle that a verifier reverses, or that a finding of the third round or\n  a later one raises.',
      'Where that topic\'s rulings set the section aside, write what settles it into its settled file instead, a line naming the section as the topic\'s, and the finding as `Settled: {section}, amend to agree`.',
      'each brief carries the verifier\'s findings, every round\'s rulings, the carry\'s refusal and the points this session settled',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('a point of a shared source, a shared spec\'s among them, is the record\'s of the topic whose subject it bears on, named or not, one bearing on none the unit\'s own where it has one, else its one topic\'s; other topics are listed to judge by, never sources — each line the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const sources = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      'A point in a shared source — a discovery session, a spec several topics draw on, research that fed several topics — belongs to the record of the topic whose subject it bears on, whether or not it names the topic. A point of the discovery sessions or their research bearing on no topic\'s subject is the unit\'s own record\'s, `{unit}.discovery`, where the unit has one, an epic\'s; in a unit of one topic, it is that topic\'s. A spec section bearing on no one topic\'s subject is one of the topics\' drawing on the spec, the session choosing which once every record is composed.',
      'A record of no entries is one, where every point of the sessions bears on a topic\'s subject.',
      '- **A shared spec.** From a spec several topics draw on, carry each point bearing on this topic\'s subject, its log discussing it or not, and each section its findings send it.',
      'and the unit\'s other topics, each with what it is about, to judge whose a point is by: they are not sources. Each record is carried from its own sources alone, never another topic\'s log, brief or record',
    ].filter((rule) => !sources.includes(rule)), []);
  });

  it('product-wide is stated once, in the record\'s shape, with an example of what is and what is not', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const shape = text.slice(text.indexOf('### Its Shape'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([text.split('holds across the whole product').length - 1, shape.includes('- **`product_wide`**: `true` where the entry holds across the whole product — every command, every screen, every output — not only this topic\'s part of it'), shape.includes('A CLI\'s exit codes, its error stream and its global flags are product-wide; one command\'s options are not.'), text.includes('**Product-wide.**')], [1, true, true, false]);
  });

  it('a section no record cites goes to the topic it belongs to where it holds a decision, a finding or an open question, and a unit\'s topics are carried once its records are passed and its sections settled', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual(['Where it holds a decision, a finding or an open question of a topic\'s, write it into the findings of the topic its subject belongs to, one of those the check names it on', 'So a unit\'s topics are carried in order: compose every topic\'s record, have each verifier pass it, settle the sections the check names, then carry them.'].filter((rule) => !text.includes(rule)), []);
  });

  it('a record holds each current decision, finding and open question, and a spec section it cites is carried whole: citing it for one rule and leaving its others out is a gap', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.ok(text.includes('Each current decision, finding and open question the topic\'s sources hold, and nothing else:'));
    assert.ok(text.includes('- **A cited section, whole.** A section of a spec drawing on the topic, cited, is carried whole: each current decision, finding and open question it holds that concerns this topic is an entry. Citing a section for one of its rules and leaving its others out is a gap. A section cited as a later answer gives that answer alone.'));
  });

  it('21.6.3: every approved spec of the unit is the later answer to each of a topic\'s points, whether it draws on the topic or not: what it replaces left in the log, a question it answers answered by a decision citing its section — in discovery a finding — each in what the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const briefed = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      '- Its unit\'s approved specs it does not draw on, kept or joined the same way: the later answer to each of its points.',
      'An approved spec of its unit is the current answer where it and the log differ, whether it draws on the topic or not, its corrigenda and amendments among it: a decision or proposal it replaces is left in the log; a question it answers is answered by a decision citing its section, or, in a record carried in discovery, where nothing is decided, by a finding saying so.',
    ].filter((rule) => !briefed.includes(rule)), []);
  });

  it('a point a source leaves unmeasured is carried, set aside only where a later source measured it or made it moot; a contradiction no later source settles is named — each in what the record holds, which the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const holds = text.slice(text.indexOf('### What It Holds'), text.indexOf('### Its Shape'));

    assert.deepStrictEqual([
      '- **What no one measured.** A point a source names unmeasured, untested, unverified or left to check is carried: an open question, or a finding stating that it is unmeasured. A ruling sets it aside only where a later source measured it, or made it moot.',
      '- **Sources at odds.** Where the sources, or the sections of one, contradict each other on a point, and no later source settles it, the record says so: the entries carrying each side name the other, or an open question names the contradiction and cites both.',
    ].filter((rule) => !holds.includes(rule)), []);
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
