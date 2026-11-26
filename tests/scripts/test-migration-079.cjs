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
// or by the entry a later source settles it with — of research under no
// topic's name, by the unit's own record, else by each topic; nothing
// decided on a topic never started, carried in discovery or its item
// unstarted. A spec the move joined is approved, one reopened during the
// build among them, its sections named where no record cites them. Each section of a
// discovery session or a walked asset holding text that no record cites,
// nor a topic walking it holds word for word in its own files, a copy
// ending where a line does and its text no one line under 40 characters,
// is named — on the topic an import came in from or a split's research
// bears the name of, else the unit's own record, else each topic — once
// every record walking it has one composed, and no topic of the unit is
// carried until every such record, its own and a topic it promoted among
// them, has passed, nor that promoted topic, the carry naming how many
// sections the check names. A record breaking a rule is refused at the
// carry, the refusal written beside the record and nothing else, and
// leaves nothing in the way of the record mended. Once it passes, the
// check lists each point marked to raise on a live topic of a unit in
// progress until the conversation raises it, at a building unit's
// specification titled with its topic — none on a topic never started,
// carried in discovery, whose first opening reads it with the rest of its
// record, nor on a topic leaving its building epic at the cut, nor of a
// completed unit or a cross-cutting one, whose record is the product's — so
// the directive closes over it.
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
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, okSections, okSectionsAsync, git, statePath, layout, writeState, readState, createFile, initRepo, commitAll, cleanupFixture } = harness;
const { SESSION, recordsMigration, refusedKeeping, refusedUntouched, passedBeside, recordText, DESCRIBED } = require('./migration-world.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { composedPath, carriedPath, findingsPath, checkedPath, verifyingPath, refusedPath, settledPath, roundsPath, handbackPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

/** Where the session marks the sections of a unit's specs holding no topic's decision. @param {string} unit */
const sectionsMarked = (unit) => `.cache/migrate/records/${unit}.sections.json`;
const DIRECTIVE = path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations/079-records.md');
const MOVE = require('../../skills/ledger-migrate/scripts/migrations/078-reshape-move.cjs');

const RECORDS = '079-records';
// A piece of the directive's work is a record: each topic's, and a unit's own.
const COUNTS = { one: 'record', many: 'records' };
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

/** Each piece not done, by its name, with the step the check names on it next. @param {string} [at] */
const nexts = (at = dir) => Object.fromEntries(checked(at).unfinished.map(({ name, next }) => [name, next]));

/** The unit and the topic a record's dot-path names, the topic null for a unit's own. @param {string} dotpath @returns {[string, string|null]} */
function recordOf(dotpath) {
  const [unit, , topic = null] = dotpath.split('.');
  return [unit, topic];
}

/** The ledger carry of a record, composed where the directive keeps it and passed by its verifier. @param {string} at @param {string} dotpath @param {unknown[]} entries */
function carryArgs(at, dotpath, entries) {
  const [unit, topic] = recordOf(dotpath);
  writeState(at, composedPath(unit, topic), recordText(entries));
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

/** The fault of a record that does not say what its topic is about, where no map row says it. */
const DESCRIBE = 'no map row says what its topic is about, and its record says it in no line: give it "description", beside its entries, one line saying what the topic is about';

/** search's record with neither its map items nor its thread named. */
const bareSearch = () => GOOD['fumi.discussion.search'].map(({ map_item: _, thread: __, ...entry }) => entry);

/** What search's bare record leaves uncarried. */
const SEARCH_UNCARRIED = Object.freeze([
  'ranking is on its old map, decided, and no entry names it as its map_item', 'typo-tolerance is on its old map, exploring, and no entry names it as its map_item',
  'synonyms is on its old map, deferred, and no entry names it as its map_item', 'the thread index-size is still digging in its research, and no entry names it as its thread',
]);

/**
 * Where a record the session amends is settled, as a message names it, by
 * whole paths: a line in its settled file, and the finding into its findings.
 * @param {string} unit @param {string|null} topic @param {string} finding
 */
const settledInto = (unit, topic, finding) => `a line in ${statePath(dir, settledPath(unit, topic))} naming`
  + ` %s, and into ${statePath(dir, findingsPath(unit, topic))} \`Settled: ${finding}\``;

/** What an uncited section named on `topic`'s record says goes to it, where it is its own. @param {string} unit @param {string|null} topic @param {string} name */
const ownsIt = (unit, topic, name) => `: where it is this record's, ${settledInto(unit, topic, `${name}, amend to agree`).replace('%s', 'the section and what of it the record misses')}`;

/**
 * What a section of an approved spec no record cites breaks, named on
 * `topic`'s record, in its part of a joined spec where it is in one: named
 * as a cite names it, its part's heading first, its file by its whole path,
 * and marked under its part by its name there and its file's path from the
 * state's folder.
 * @param {string} unit @param {string|null} topic @param {string} at @param {string} section @param {string|null} [part]
 */
const uncited = (unit, topic, at, section, part = null) => `"${part === null ? section : `${part} > ${section}`}" in ${statePath(dir, at)}, an approved spec, holds text no record of ${unit} cites — what the spec stage decided, found or left open, still current, is carried by the topic it belongs to${ownsIt(unit, topic, part === null ? section : `${part} > ${section}`)}; a section holding none, or only what a later answer replaced or a cancelled unit alone decided, is marked, once read, in ${statePath(dir, sectionsMarked(unit))} as ${JSON.stringify({ [at]: part === null ? [section] : { [part]: [section] } })}`;

/**
 * What a section no record cites breaks, named on `topic`'s record, of a
 * source the unit's records walk in common: a walked asset, or a discovery
 * session.
 * @param {string} unit @param {string|null} topic @param {string} at @param {string} section @param {string} [what]
 */
const sharedUncited = (unit, topic, at, section, what = 'an asset') => `"${section}" in ${statePath(dir, at)}, ${what}, holds text no record of ${unit} cites — a current point it makes, which no topic\'s own files hold word for word, is carried by the record its subject belongs to${ownsIt(unit, topic, section)}; a section holding none, or only what a later answer replaced or a cancelled unit alone decided, is marked, once read, in ${statePath(dir, sectionsMarked(unit))} as ${JSON.stringify({ [at]: [section] })}`;

/**
 * The carry's refusal of a record whose unit's records wait, framed on the
 * unit waited on, naming what on.
 * @param {string} unit @param {string} topic @param {string[]} reasons @param {string} [waited]
 */
const waitsOn = (unit, topic, reasons, waited = unit) => `ledger carry: ${unit}'s ${topic} is carried, for a record carried takes no section found later, once each record of ${waited} drawing on the sources its records share — its approved specs, its discovery sessions and the assets its records walk, its own record and a topic it promoted among them — has passed its verifier or the session's settlement, and no section of those sources goes uncited, nor a contradiction a record names between them unnamed on another citing it — ${reasons.join('; ')}`;

/**
 * What a carry waiting on the sections of a unit's sources no record cites
 * names: how many, and where the check names each.
 * @param {string} unit @param {number} count
 */
const counted = (unit, count) => `${count === 1 ? 'a section' : `${count} sections`} of ${unit}'s approved specs, discovery sessions and walked assets ${count === 1 ? 'holds' : 'hold'} text no record cites — \`migrate check 079-records\` names each where it is named`;

/** fumi's rates, two sections a record may judge at odds, each cited by its heading. */
const RATES = layout.assets('fumi', 'rates.md');
const rate = (/** @type {string} */ section) => ({ path: RATES, section });
const SIDES = Object.freeze([rate('Seats'), rate('Flat')]);

/** A question naming fumi's rates at odds, marked to raise or not. @param {string} ref @param {boolean} [raise] */
const ratesAtOdds = (ref, raise = false) => ({ ref, event: 'asked', text: 'Per seat, or a flat rate?', by: 'claude', ...(raise ? { raise } : {}), cites: SIDES, at_odds: SIDES });

/**
 * What a record citing a side of a contradiction another names, and naming
 * it nowhere, is told, in the directive's order.
 * @param {string} place the record's @param {string} by the record naming it @param {{path: string, section: string}[]} cited the sections it cites
 * @param {{path: string, section: string}[]} [sides] the sections at odds @param {string[]} [dated] each as the message names it, its date beside it
 */
const unshared = (place, by, cited, sides = SIDES, dated = sides.map(({ path: at, section }) => `"${section}" in ${statePath(dir, at)}`)) => [
  `${dated.join(' and ')} are at odds, as ${by} names them, and this record cites ${cited.map(({ path: at, section }) => `"${section}" in ${statePath(dir, at)}`).join(' and ')} without naming that contradiction — judge first whether it stands.`,
  `Where a later answer settles it — an approved spec, or a part of one, approved after the other side was written — it is settled on each record naming it, and on this one where it carries the side the later answer replaced, this record keeping its answer only where it is the later one: ${settledInto('fumi', place.split('.')[2] ?? null, '{sections} settled by {section}, amend to agree').replace('%s', 'the section that settles it')}.`,
  `Where this record's own log settled the point after the approval, its answer is its log's: it is marked in ${statePath(dir, '.cache/migrate/records/fumi.at-odds.json')} as ${JSON.stringify({ [place]: [{ log: sides }] })}, and each record naming the contradiction keeps naming what its own sources hold.`,
  `Where it stands and this record carries a side of the point at odds, it names the contradiction, an open question holding those sections as its at_odds, and carries neither side as settled: ${settledInto('fumi', place.split('.')[2] ?? null, '{sections} at odds, amend to agree').replace('%s', 'the sections at odds and the point')}.`,
  `Where what it cites of them is not that point, it is marked in ${statePath(dir, '.cache/migrate/records/fumi.at-odds.json')} as ${JSON.stringify({ [place]: [sides] })}`,
].join(' ');

/** A decision long enough to be held as a copy, and licensing's log deciding it. */
const DECIDED = 'Fourteen days from sign-up, the person said, then billed.';
const decidedLog = (/** @type {string} */ after = '') => `## Discussion\n\n## Discussion: Licensing\n\n### Trial Length\n\n#### Decision\n\n${DECIDED}${after}\n`;

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
const shopUncited = (part, sections) => sections.map((section) => uncited('shop', 'weights', 'shop/spec.md', section, part));

/** What a cite naming several headings breaks, naming each it reaches as one cite would name it alone. @param {string} name @param {string} at @param {string[]} names */
const tellApart = (name, at, names) => `cites "${name}" in ${at}, which holds ${names.length} headings so named — a cite names one, by its part in a joined spec, by the path that tells it apart, or, of headings sharing their path, by its place among them: ${names.map((each) => `"${each}"`).join(', ')}`;

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

/** shop completed, as the state holds it. */
function completeShop() {
  writeState(dir, layout.manifest('shop'), JSON.stringify({ ...JSON.parse(readState(dir, layout.manifest('shop'))), status: 'completed' }));
}

describe('the pieces (21.6.2)', () => {
  it('every topic of every unit is a piece — completed, cancelled, building and never started among them, a topic promoted to a cross-cutting unit only there — none done before its record is carried', () => {
    dir = world();
    completeShop();

    assert.deepStrictEqual(checked(), {
      ok: true, directive: RECORDS, passed: false, done: 0, of: 7, counts: COUNTS, unfinished: PIECES.map((name) => ({ name, problems: ['has no record composed'], next: 'compose its record: brief a per-topic agent' })),
    });
  });

  it('21.S20, 21.S21, 21.S22, 21.S23, 21.S44: passes once each topic\'s record is carried, a completed unit\'s and a cancelled one\'s among them — citing its log and the review folded into it, its brief, an experiment, a grouped spec kept as an asset and the spec its building drew on, carried over where no one is shown deciding, a measurement with its command, the open map items and threads as open questions — with nothing to raise', () => {
    dir = carriedWorld();
    completeShop();

    assert.deepStrictEqual(checked(), { ok: true, directive: RECORDS, passed: true, done: 7, of: 7, counts: COUNTS, unfinished: [], raise: [] });
  });
});

describe('a record breaking a rule is refused at the carry, its refusal kept beside it and nothing else written', () => {
  beforeEach(() => { dir = world(); });

  it('a refusal leaves nothing in the way: the record mended carries, and its topic is done', () => {
    assert.strictEqual(refused('fumi.discussion.search', bareSearch()), breaks('fumi', 'search', SEARCH_UNCARRIED));

    carry('fumi.discussion.search', GOOD['fumi.discussion.search']);

    assert.strictEqual(unfinished()['fumi.discussion.search'], undefined);
  });

  it('a topic no map row of its unit, nor of one that promoted it, says what it is about: its record says it in a line beside its entries, refused at the carry without one; a topic its map row says it of owes none, nor the one topic of a unit, which no other brief lists', () => {
    const faults = (/** @type {string} */ dotpath) => {
      const [unit, , topic] = dotpath.split('.');
      writeState(dir, composedPath(unit, topic), JSON.stringify({ entries: GOOD[dotpath], description: ' ' }));
      return ok(dir, ['ledger', 'carry', dotpath, '--dry-run'], { env: SESSION }).faults;
    };
    const unsaid = [faults('fumi.discovery.billing'), faults('platform.discussion.auth')];
    const alone = faults('gone.discussion.gone');
    const manifest = JSON.parse(readState(dir, layout.manifest('fumi')));
    manifest.phases.discovery.items.billing.summary = 'Invoices, refunds and seat billing.';
    manifest.phases.discovery.items.auth = { status: 'pending', summary: 'Who signs in, and for how long.' };
    writeState(dir, layout.manifest('fumi'), JSON.stringify(manifest));

    assert.deepStrictEqual([unsaid, [faults('fumi.discovery.billing'), faults('platform.discussion.auth')], alone], [[[DESCRIBE], [DESCRIBE]], [[], []], []]);
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

  it('a cite naming its file by its whole path, as a brief lists it, refused once, naming the path from the state\'s folder a cite takes', () => {
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    const log = layout.topic('fumi', 'search', 'log.md');

    assert.strictEqual(refused('fumi.discussion.search', [{ ...q1, cites: [{ path: statePath(dir, log), section: 'Ranking > Context' }] }, ...rest]),
      breaks('fumi', 'search', [`entry q1 cites ${statePath(dir, log)}, a whole path — a cite names its file by its path from the state's folder: ${log}`]));
  });

  it('a cite of a file that does not stay with the entry — the cache, another topic\'s log, another unit\'s asset, its own mail — refused; one of the unit\'s beside its topics carried', () => {
    writeState(dir, findingsPath('fumi', 'search'), '## Ranking\n\nDropped.\n');
    writeState(dir, layout.topic('fumi', 'search', 'mail', '001-seats.md'), '### Seats\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Ranking\n');
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

  it('21.6.12: a topic never started carried past discovery, its item unstarted, a message parked on it never opened, holds nothing decided either — a decision, or a finding marked product-wide, refused', () => {
    const fumi = JSON.parse(readState(dir, layout.manifest('fumi')));
    fumi.phases.discussion.items.licensing.status = 'unstarted';
    writeState(dir, layout.manifest('fumi'), JSON.stringify(fumi));
    const found = { ref: 'f9', event: 'found', text: 'A trial runs from sign-up.', how: 'read in the log', known: 'read', by: 'claude', product_wide: true, cites: [logCite('fumi', 'licensing', 'Trial Length')] };
    const never = 'on a topic never started';

    assert.strictEqual(refused('fumi.discussion.licensing', [...GOOD['fumi.discussion.licensing'], found]), breaks('fumi', 'licensing', [
      ...['d1', 'd2'].map((ref) => `entry ${ref} decides, and nothing is decided ${never} — what its sources settle is a finding, what they leave open a question`),
      `entry f9 is product-wide, and nothing found ${never} is product-wide — a line for the product record is decided in the first topic it bears on`,
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
      breaks('shop', 'weights', [`entry q1 ${tellApart('Detail', 'shop/spec.md', ['1. Weights > Ranking > Detail', '1. Weights > Corrigenda > Detail'])}`, `entry q1 ${tellApart('Ranking', 'shop/spec.md', ['1. Weights > Ranking', '2. Wishlist > Ranking'])}`]),
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

  it('a heading several parts of a joined spec hold, cited bare, refused naming each by its part — never read in the part its topic draws on — and each copy taken by its part, whatever headings stand between, or by a path naming it alone', () => {
    const old = path.join(dir, '.workflows/shop/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(old, 'utf8'));
    manifest.phases.specification.items.wishlist.sources = {};
    fs.writeFileSync(old, JSON.stringify(manifest));
    const spec = readState(dir, 'shop/spec.md');
    writeState(dir, 'shop/spec.md', `${spec.replace('## 2. Wishlist', '#### Dependencies\n\nThe ranking store.\n\n## 2. Wishlist')}\n#### Specification\n\n##### Dependencies\n\nThe saved list.\n`);
    const [question, decision] = GOOD['shop.discussion.weights'];
    /** @param {string} section */
    const faults = (section) => ok(dir, [...carryArgs(dir, 'shop.discussion.weights', [{ ...question, cites: [{ path: 'shop/spec.md', section }] }, decision]), '--dry-run'], { env: SESSION }).faults;

    assert.deepStrictEqual(['Dependencies', '1. Weights > Dependencies', '2. Wishlist > Dependencies', 'Specification > Dependencies'].map(faults), [
      [`entry q1 ${tellApart('Dependencies', 'shop/spec.md', ['1. Weights > Dependencies', '2. Wishlist > Dependencies'])}`], [], [], [],
    ]);
  });
});

describe('a file an agent left beside the records', () => {
  it('named to remove, on the topic it is named for, else on the unit\'s own record, or each of its topics where it has none; a file a record is kept in, and the session\'s marks, never', () => {
    dir = world();
    const at = (/** @type {string} */ rel) => `.cache/migrate/records/${rel}`;
    for (const rel of ['fumi/licensing.json.tmp', 'fumi/notes/pn-refs.txt', 'fumi.brief-record.json', 'shop.aa-amend.py', 'fumi/search.findings.txt', 'fumi/search.rounds.md', 'fumi.sections.json', 'fumi.at-odds.json']) writeState(dir, at(rel), '');
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Selling\n\nTo the trade.\n');
    const left = (/** @type {string[]} */ rels) => rels.map((rel) => `${statePath(dir, at(rel))} is no file a record is kept in — an agent left it: remove it`);
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

  it('is a piece of each epic whose discovery holds a session, carried at the unit\'s discovery, no topic\'s: findings and open questions alone, cites that stay, the imports of the unit\'s discovery as a whole linked — once, waiting as a topic does on the unit\'s records', () => {
    dir = world();
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), SESSION_LOG);
    const before = checked().unfinished.find(({ name }) => name === 'shop.discovery');

    const faults = refused('shop.discovery', [{ ...selling, assets: [] }, { ref: 'q1', event: 'asked', text: 'Who sets the case size?', by: 'claude', cites: [logCite('shop', 'weights', 'Tie Break')] }, { ref: 'd1', event: 'decided', answers: 'q1', text: 'The trade.', why: 'The session says so.', by: 'claude', given: 'carried', cites: selling.cites }]);
    const waiting = refusedUntouched(dir, carryArgs(dir, 'shop.discovery', [selling]), { env: SESSION }, harness);
    carry('shop.discussion.weights', GOOD['shop.discussion.weights']);
    const { ids } = carry('shop.discovery', [selling]);
    const line = JSON.parse(fs.readFileSync(statePath(dir, layout.ledger), 'utf8').split('\n').filter(Boolean).at(-2));
    const again = harness.refuses(dir, ['ledger', 'carry', 'shop.discovery'], { env: SESSION }).error;

    assert.deepStrictEqual([before, waiting.endsWith('— shop\'s weights has no record composed'), faults, Object.keys(ids), [line.unit, line.phase, line.topic], unfinished()['shop.discovery'], again], [
      { name: 'shop.discovery', problems: ['has no record composed'], next: 'compose its record: brief a per-topic agent' },
      true,
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

  it('21.6.7: each thread still open of research under no topic\'s name, which fed several topics, is named by an epic\'s own record, and by each of its topics where it has none; a feature\'s, by its one topic', () => {
    dir = world();
    /** A research item with an open thread put in a unit's old manifest. @param {string} unit @param {string} research @param {string} thread */
    const stray = (unit, research, thread) => {
      const old = path.join(dir, '.workflows', unit, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(old, 'utf8'));
      manifest.phases.research = { items: { ...manifest.phases.research?.items, [research]: { status: 'in-progress', threads: { [thread]: { question: 'Seats or usage?', status: 'open', origin: 'seed', parent: null } } } } };
      fs.writeFileSync(old, JSON.stringify(manifest));
      return `the thread ${thread} is still open in the research ${research}, and no entry names it as its thread`;
    };
    const thread = stray('fumi', 'exploration', 'pricing-model');
    const postmortem = stray('gone', 'postmortem', 'root-cause');
    const session = 'fumi/discovery/session-001.md';
    /** The records whose carry names `unnamed`, each dry run with `entries`, its good record by default. @param {string[]} dotpaths @param {unknown[]} [entries] @param {string} [unnamed] */
    const naming = (dotpaths, entries, unnamed = thread) => dotpaths.filter((dotpath) => {
      carryArgs(dir, dotpath, entries ?? GOOD[dotpath]);
      return ok(dir, ['ledger', 'carry', dotpath, '--dry-run'], { env: SESSION }).faults.includes(unnamed);
    });
    const topics = PIECES.filter((dotpath) => dotpath.startsWith('fumi.'));

    const without = naming(topics);
    writeState(dir, session, '## Discovery Session 001\n\n## Research: exploration\n\nSeats or usage?\n');
    const withOwn = [...naming(topics), ...naming(['fumi.discovery'], [])];
    const asked = { ref: 'q1', event: 'asked', text: 'Seats or usage?', by: 'claude', thread: 'pricing-model', cites: [{ path: session, section: 'Research: exploration' }] };

    assert.deepStrictEqual([without, withOwn, naming(['fumi.discovery'], [asked]), naming(['gone.discussion.gone'], undefined, postmortem)], [topics, ['fumi.discovery'], [], ['gone.discussion.gone']]);
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

  it('a point marked to raise where nothing raises it refused at the carry, naming why — a topic never started, carried in discovery or its item unstarted, a unit\'s own record, a cross-cutting unit\'s, a completed unit\'s, a cancelled unit\'s and a topic set aside — its point an open question carried unmarked (21.6.11)', () => {
    dir = world();
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n\n### Selling\n\nWho sets the case size?\n');
    const vision = { ref: 'f1', event: 'found', text: 'The shop sells to the trade.', how: 'read in the discovery session', known: 'read', by: 'claude', cites: [{ path: 'shop/discovery/session-001.md', section: 'Selling' }], assets: [{ path: layout.assets('shop', 'vision.md'), status: 'reference' }] };
    const search = JSON.parse(readState(dir, layout.manifest('fumi')));
    search.phases.discussion.items.search.status = 'cancelled';
    search.phases.discussion.items.licensing.status = 'unstarted';
    writeState(dir, layout.manifest('fumi'), JSON.stringify(search));
    const shop = JSON.parse(readState(dir, layout.manifest('shop')));
    const open = (/** @type {unknown} */ cites) => ({ ref: 'q9', event: 'asked', text: 'Is it settled?', by: 'claude', raise: true, cites });
    const marked = (/** @type {string} */ dotpath) => refused(dotpath, [...GOOD[dotpath], open(GOOD[dotpath][0].cites)]);
    const why = (/** @type {string} */ reason) => [`entry q9 is marked to raise, and ${reason}: its point is an open question, carried unmarked`];

    const refusals = ['fumi.discovery.billing', 'fumi.discussion.licensing', 'platform.discussion.auth', 'gone.discussion.gone', 'fumi.discussion.search'].map(marked);
    const own = refusedKeeping(dir, carryArgs(dir, 'shop.discovery', [vision, open(vision.cites)]), refusedPath('shop', null));
    writeState(dir, layout.manifest('shop'), JSON.stringify({ ...shop, status: 'completed' }));
    const completed = marked('shop.discussion.weights');

    assert.deepStrictEqual([...refusals, own, completed], [
      breaks('fumi', 'billing', why('its topic never started, and its first opening reads its open questions')),
      breaks('fumi', 'licensing', [
        ...['d1', 'd2'].map((ref) => `entry ${ref} decides, and nothing is decided on a topic never started — what its sources settle is a finding, what they leave open a question`),
        ...why('its topic never started, and its first opening reads its open questions'),
      ]),
      breaks('platform', 'auth', why('a cross-cutting unit\'s record is the product\'s')),
      breaks('gone', 'gone', why('its unit is cancelled, and only a unit in progress raises its points')),
      breaks('fumi', 'search', why('its topic is set aside')),
      `ledger carry: shop's own discovery breaks the records directive's rules, so nothing is carried — ${why('a unit\'s own record is carried in discovery, where nothing is raised')[0]}`,
      breaks('shop', 'weights', why('its unit is completed, and only a unit in progress raises its points')),
    ]);
  });

  it('21.8.9: a topic of a building epic that no spec joined into its spec.md draws on, by its name or among its sources, leaves the unit at the cut, so its point is raised nowhere, the mark refused at the carry — but a dead end the old map marked stays, its point raised at the unit\'s specification (21.8.15), as is a topic of a building unit no epic, which never leaves', () => {
    dir = world();
    const raises = require('../../skills/ledger-migrate/scripts/migrations/079-records.check.cjs').raises;
    const old = path.join(dir, '.workflows/shop/manifest.json');
    const before = JSON.parse(fs.readFileSync(old, 'utf8'));
    before.phases.discovery = { items: { gifts: { handled: true } } };
    before.phases.specification.items.wishlist.sources.ratings = { status: 'incorporated' };
    fs.writeFileSync(old, JSON.stringify(before));
    const shop = JSON.parse(readState(dir, layout.manifest('shop')));
    shop.phases.discussion.items = { ...shop.phases.discussion.items, reviews: { status: 'in-progress' }, gifts: { status: 'completed' }, ratings: { status: 'completed' } };
    writeState(dir, layout.manifest('shop'), JSON.stringify(shop));
    writeState(dir, layout.manifest('gone'), JSON.stringify({ ...JSON.parse(readState(dir, layout.manifest('gone'))), status: 'in-progress', spec: { joined: ['cause'] } }));
    const open = (/** @type {string} */ unit, /** @type {string} */ topic) => [{ ref: 'q1', event: 'asked', text: `Who moderates ${topic}?`, by: 'claude', raise: true, cites: [logCite(unit, topic, 'Moderation')] }];
    const topics = ['reviews', 'gifts', 'ratings'];
    const faults = topics.map((topic) => {
      writeState(dir, layout.topic('shop', topic, 'log.md'), '## Discussion\n\n### Moderation\n\nWho moderates?\n');
      carryArgs(dir, `shop.discussion.${topic}`, open('shop', topic));
      return ok(dir, ['ledger', 'carry', `shop.discussion.${topic}`, '--dry-run'], { env: SESSION }).faults;
    });
    for (const [unit, topic] of [...topics.map((each) => ['shop', each]), ['gone', 'gone']]) {
      writeState(dir, carriedPath(unit, topic), JSON.stringify({ unit, phase: 'discussion', topic, entries: [{ ref: 'q1', id: `${topic}-id` }], record: { entries: open(unit, topic) } }));
    }

    assert.deepStrictEqual([faults, raises({ projectDir: dir, stateDir: statePath(dir) })], [
      [['entry q1 is marked to raise, and its topic leaves its building unit, no spec joined into the unit\'s spec.md drawing on it, and its discussion where it goes reads its open questions: its point is an open question, carried unmarked'], [], []],
      [{ place: 'gone.specification', answers: 'gone-id', text: 'Who moderates gone?' }, ...['gifts', 'ratings'].map((topic) => ({ place: 'shop.specification', answers: `${topic}-id`, text: `Who moderates ${topic}?` }))],
    ]);
  });

  it('says the raises at the end are of a started topic of a unit in progress alone, each a decision only the person can make, what a row\'s notice is, and a point two records carry raised once, its answer merged into the other', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      '- The ledger, through `ledger carry`, one record at a time, and through\n  `raise`, `raise answer`, `ledger merge` and `ledger replace` for the\n  points raised at the end.',
      '- At the end, each point no source settles on a started topic of a unit\n  in progress that stays in its unit, raised one at a time: answered, or\n  left open.',
      'So is such a point where nothing raises it, and the carry refuses the mark there: on a topic never started, carried in discovery or its item `unstarted`, for its first opening to read; on a topic leaving its building unit, as its brief\'s topic line shows, for its discussion where it goes; on a unit\'s own record, carried in discovery, where nothing is decided; of a cross-cutting unit, whose record is the product\'s, for the product\'s conversation; of a completed unit, whose code settled what it built; and of a cancelled unit, or a topic set aside, waiting with it.',
      'raise each, one at a time, as a decision only the person can make, at its `place`, answering its question. Judge from the texts whether a candidate, or any other point listed, is the same point: the same sections at odds never say so alone. A point two records carry is raised once, its answer recorded on the other; where it was raised and left open, it stays open on the other record too, raised no further; a different point between the same sections is raised on its own.',
      'Where another record carries the point, record the answer on it too: merge its question, at its own `place` as listed, into the answer,',
      'each `{"key", "name", "text", "notice"}` — its key, a short name for the answer, the answer, and what the person would notice were it the one, each one line;',
      'node .claude/skills/ledger-engine/scripts/engine.cjs ledger merge {place} --question {answers} --into {answered}',
      'and, as `settled_on`, each record marked as its own log\'s for the same sections, `{"place", "decisions"}`, each decision of it citing a side still current, `{"id", "text"}`. A point with `settled_on` stays listed, once answered with its own `answered`, until each is done; one the person leaves open is raised, and listed no more.',
      'Where a point is `settled_on` a record, tell the person, as its mechanism, that that record\'s own log settled it after the approval, and how: its decisions\' texts.',
      'Where a point is `settled_on` a record, once the person answers it: where the answer agrees with that record\'s decisions, nothing changes on that record — mark it so, `"agrees": true` beside its `log` mark. Where it differs, the person\'s answer is the newer one: record it on that record too, replacing each of its decisions listed,',
      'node .claude/skills/ledger-engine/scripts/engine.cjs ledger replace {place} --replaces {id} --reason other-topic --cause {answered}',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('once the check passes, it lists each open question marked to raise, at the topic, or at the unit\'s specification where the unit has its spec, until this conversation raises it there — drawn as a decision only the person can make — the person answering, and the directive closes; a topic never started reads its unmarked open questions at its first opening (8.3.4, 9.3.6); beside a question naming sections at odds, each other record\'s naming the same, with its text, whether it was drawn and what answers it, for the session to judge: one point spelled apart merged at its listed place, another between the same sections raised on its own (21.6.10); and each record marked as its own log\'s, its decisions citing a side, until the person\'s answer agrees or replaces them', async () => {
    dir = world();
    writeState(dir, RATES, '# Rates\n\n## Seats\n\nPer seat.\n\n## Flat\n\nA flat rate.\n\n## Teams\n\nPer team.\n');
    const point = { ref: 'q3', event: 'asked', text: 'Does the trial need a card?', by: 'claude', raise: true, cites: [logCite('fumi', 'licensing', 'Trial Length')] };
    const unsettled = { ref: 'q1', event: 'asked', text: 'Are rates set per seat or per team?', by: 'claude', cites: [{ path: layout.assets('fumi', 'rates.md'), section: 'Rates' }] };
    const unclear = { ref: 'q4', event: 'asked', text: 'Do ties break by price or by name?', by: 'claude', raise: true, cites: [logCite('shop', 'weights', 'Tie Break')] };
    const spelledApart = [rate('Flat'), rate('Rates > Seats')];
    const same = { ...ratesAtOdds('q8', true), text: 'Is a seat billed per seat, or at the flat rate?', cites: spelledApart, at_odds: spelledApart };
    const other = { ...ratesAtOdds('q9', true), text: 'Which rate does a trial take?' };
    const teamSides = [rate('Seats'), rate('Teams')];
    const teams = { ...ratesAtOdds('q10', true), text: 'Is a team billed per seat, or per team?', cites: teamSides, at_odds: teamSides };
    const perTeam = [
      { ref: 'q10', event: 'asked', text: 'How is a team billed?', by: 'claude', cites: [rate('Teams')] },
      { ref: 'd10', event: 'decided', answers: 'q10', text: 'Per team.', why: 'The log settled it after the rates.', by: 'claude', given: 'carried', cites: [rate('Teams')] },
    ];
    const ownLog = (/** @type {Record<string, unknown>} */ also) => writeState(dir, '.cache/migrate/records/fumi.at-odds.json', JSON.stringify({ 'fumi.discussion.search': [{ log: teamSides, ...also }] }));
    ownLog({});
    const records = Object.entries(GOOD).map(([dotpath, entries]) => /** @type {[string, unknown[]]} */ ([dotpath, {
      'fumi.discussion.licensing': [...entries, point, ratesAtOdds('q9', true), teams], 'fumi.discussion.search': [...entries, same, other, ...perTeam],
      'fumi.discovery.billing': [...entries, unsettled], 'shop.discussion.weights': [...entries, unclear],
    }[dotpath] ?? entries]));
    for (const [dotpath, entries] of records) {
      const [unit, topic] = recordOf(dotpath);
      writeState(dir, composedPath(unit, topic), recordText(entries));
      for (const [rel, text] of passedBeside(unit, topic, entries)) writeState(dir, rel, text);
    }
    for (const [dotpath, entries] of records) carry(dotpath, entries);
    /** The id the carry gave each of a topic's entries, by its ref. @param {string} topic @returns {Record<string, string>} */
    const carriedIds = (topic) => Object.fromEntries(JSON.parse(readState(dir, carriedPath('fumi', topic))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));
    /** Each point naming sections at odds, by its text, with each candidate's text, whether it was drawn and its answers' texts. */
    const atOdds = () => checked().raise.filter((/** @type {{candidates?: unknown[]}} */ { candidates }) => candidates !== undefined)
      .map((/** @type {{text: string, candidates: {text: string, raised?: boolean, answered?: {text: string}[]}[]}} */ { text, candidates }) => [text, candidates.map((each) => [each.text, each.raised ?? false, (each.answered ?? []).map(({ text: said }) => said)])]);
    const raiseOf = (/** @type {string} */ text) => checked().raise.find((/** @type {{text: string}} */ each) => each.text === text);

    const apart = atOdds();
    const licensing = raiseOf('Per seat, or a flat rate?');
    const { res: drawn } = await okSectionsAsync(dir, ['raise', licensing.place, '--answers', licensing.answers, '--fact'], { env: SESSION, stdin: JSON.stringify({ question: licensing.text, rows: [], mechanism: 'The rates hold both.', product_wide: false }) });
    const raised = atOdds();
    ok(dir, ['raise', 'answer', drawn.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'A flat rate.', why: 'The person said so.' }) });
    const answered = atOdds();
    const merging = raiseOf(same.text);
    ok(dir, ['ledger', 'merge', merging.place, '--question', merging.answers, '--into', merging.candidates[0].answered[0].id], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none' }) });
    const trial = raiseOf(other.text);
    const { res: own } = await okSectionsAsync(dir, ['raise', trial.place, '--answers', trial.answers, '--fact'], { env: SESSION, stdin: JSON.stringify({ question: other.text, rows: [], mechanism: 'The rates hold both.', product_wide: false }) });
    ok(dir, ['raise', 'answer', own.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'The flat rate, waived.', why: 'The person said so.' }) });

    const asked = 'Per seat, or a flat rate?';
    assert.deepStrictEqual([apart, raised, answered], [
      [[asked, [[same.text, false, []], [other.text, false, []]]], [same.text, [[asked, false, []]]], [other.text, [[asked, false, []]]]],
      [[same.text, [[asked, true, []]]], [other.text, [[asked, true, []]]]],
      [[same.text, [[asked, true, ['A flat rate.']]]], [other.text, [[asked, true, ['A flat rate.']]]]],
    ]);

    /** The point naming teams at odds, as listed: its answers' texts and what each record settled on its own log still holds. */
    const settled = () => checked().raise.filter((/** @type {{text: string}} */ { text }) => text === teams.text)
      .map((/** @type {{answered?: {text: string}[], settled_on: {place: string, decisions: {id: string, text: string}[]}[]}} */ each) => [(each.answered ?? []).map(({ text }) => text), each.settled_on.map(({ place, decisions }) => [place, decisions.map(({ text }) => text)])]);
    const listedOn = settled();
    const teamPoint = raiseOf(teams.text);
    const { res: drawnTeams } = await okSectionsAsync(dir, ['raise', teamPoint.place, '--answers', teamPoint.answers, '--fact'], { env: SESSION, stdin: JSON.stringify({ question: teams.text, rows: [], mechanism: 'Search\'s own log settled it after the rates: per team.', product_wide: false }) });
    const leftOpen = settled();
    ok(dir, ['raise', 'answer', drawnTeams.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'Per seat, teams too.', why: 'The person said so.' }) });
    const answeredOn = settled();
    ownLog({ agrees: true });
    const agreed = settled();
    ownLog({});
    const [{ answered: [personal], settled_on: [{ place: on, decisions: [replacing] }] }] = checked().raise.filter((/** @type {{text: string}} */ { text }) => text === teams.text);
    ok(dir, ['ledger', 'replace', on, '--replaces', replacing.id, '--reason', 'other-topic', '--cause', personal.id], { env: SESSION, stdin: JSON.stringify({ text: 'Per seat, teams too.', why: 'The person said so.', by: 'person', given: 'own', who_moved_whom: 'none', drops: [replacing.text] }) });
    const current = ok(dir, ['ledger', 'record', 'fumi', 'search']).decisions.map((/** @type {{text: string}} */ { text }) => text).filter((/** @type {string} */ text) => text.startsWith('Per'));

    assert.deepStrictEqual([listedOn, leftOpen, answeredOn, agreed, settled(), current], [
      [[[], [['fumi.discussion.search', ['Per team.']]]]],
      [],
      [[['Per seat, teams too.'], [['fumi.discussion.search', ['Per team.']]]]],
      [],
      [],
      ['Per seat, teams too.'],
    ]);

    const [listed, built] = checked().raise;
    const weights = Object.fromEntries(JSON.parse(readState(dir, carriedPath('shop', 'weights'))).entries.map((/** @type {{ref: string, id: string}} */ { ref, id }) => [ref, id]));
    assert.deepStrictEqual([listed.place, carriedIds('licensing').q3.startsWith(listed.answers), listed.text], ['fumi.discussion.licensing', true, point.text]);
    assert.deepStrictEqual([built.place, weights.q4.startsWith(built.answers), built.text, checked().raise.length], ['shop.specification', true, unclear.text, 2]);

    /** @type {string[]} */
    const asking = [];
    /** @type {string[]} */
    const titled = [];
    for (const [{ place, answers }, mechanism] of [[listed, 'The log says nothing of a card.'], [built, 'The log weighs both.']]) {
      const { res, sections } = await okSectionsAsync(dir, ['raise', place, '--answers', answers, '--fact'], {
        env: SESSION, stdin: JSON.stringify({ question: place === built.place ? unclear.text : point.text, rows: [], mechanism, product_wide: false }),
      });
      asking.push(/WHY I'M ASKING\n\n(.*)\n/.exec(sections)?.[1] ?? sections);
      titled.push(/^(?:Fumi|Shop)\b.*$/m.exec(sections)?.[0] ?? sections);
      if (place === built.place) ok(dir, ['raise', 'answer', res.raise, '--own'], { env: SESSION, stdin: JSON.stringify({ text: 'By price.', why: 'The person said so.' }) });
    }

    assert.deepStrictEqual(asking, Array(2).fill('Only you can decide this: nothing from before Ledger settles it.'), 'a decision only the person can make, never a fact');
    assert.deepStrictEqual(titled, ['Fumi · Licensing', 'Shop · Weights'], 'a point raised at a unit\'s specification titled with its topic');

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
    writeState(dir, carriedPath('shop', 'weights'), JSON.stringify({ unit: 'shop', phase: 'discussion', topic: 'weights', entries: [], record: { entries: [], description: DESCRIBED } }));

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
    writeState(dir, composedPath('shop', 'weights'), recordText([q1, d1]));

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
      ['has not passed its verifier — no verifier has been briefed on it', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
      ['has not passed its verifier — no verifier has been briefed on it', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail'])],
      `has no verdict from its last verifier on every entry its brief asked one of — ${statePath(dir, checkedPath('shop', 'weights'))} is no file; it names no verdict on q1, d1: a verifier writes a line for each entry its walk sheet does not mark passed, \`{ref}: ok\` or \`{ref}: see finding\`, and one that does not has given no verdict — remove ${statePath(dir, findingsPath('shop', 'weights'))}, and brief a fresh verifier`,
      ['has passed its verifier, and waits to be carried', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail'])],
      'has changed since its verifier was briefed on it: a record is carried as its verifier read it — brief a fresh verifier',
      [],
    ]);
  });

  it('21.8.5: a spec the move joined is approved, one reopened during the build among them — where every joined spec of a unit was reopened, each section no record cites is named, and the unit\'s records wait on it', () => {
    dir = world();
    const old = path.join(dir, '.workflows/shop/manifest.json');
    const shop = JSON.parse(fs.readFileSync(old, 'utf8'));
    for (const spec of ['weights', 'wishlist']) shop.phases.specification.items[spec].status = 'in-progress';
    shop.phases.planning = { items: { weights: { status: 'completed' }, wishlist: { status: 'completed' } } };
    fs.writeFileSync(old, JSON.stringify(shop));
    const args = carryArgs(dir, 'shop.discussion.weights', GOOD['shop.discussion.weights'].slice(0, 2));

    assert.deepStrictEqual([unfinished()['shop.discussion.weights'], refusedUntouched(dir, args, { env: SESSION }, harness)], [
      ['has passed its verifier, and waits to be carried', ...shopUncited('1. Weights', ['Ranking', 'Ranking > Detail']), ...shopUncited('2. Wishlist', ['Saving', 'Ranking'])],
      waitsOn('shop', 'weights', [counted('shop', 4)]),
    ]);
  });

  it('a heading its part holds more than once is each copy a section of its own, named by the path that tells it apart: a cite by that path counts for its copy alone, a bare cite for none of them, and a mark by its path silences its copy alone', () => {
    dir = world();
    const [q1, d1, q2, d2, ...rest] = GOOD['shop.discussion.weights'];
    const spec = (/** @type {string[]} */ sections) => sections.map((section) => ({ path: 'shop/spec.md', section }));
    /** The copies of Detail the check names, d2 citing `sections`. @param {string[]} sections */
    const details = (sections) => {
      writeState(dir, composedPath('shop', 'weights'), recordText([q1, { ...d1, cites: spec(['Corrigenda']) }, q2, { ...d2, cites: spec(sections) }, ...rest]));
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
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) writeState(dir, composedPath('fumi', dotpath.split('.')[2]), recordText(entries));
    const named = () => unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes(commerce));

    const before = named();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [commerce]: ['Decision'] }));

    assert.deepStrictEqual([before, named()], [['Decision', 'Option A > Decision'].map((section) => uncited('fumi', 'licensing', commerce, section)), [uncited('fumi', 'licensing', commerce, 'Option A > Decision')]]);
  });

  it('21.6.3: a cite of an approved spec its topic draws no part of, the later answer to its point, gives that answer alone: it settles none of the spec\'s sections, which the topics drawing on it carry', () => {
    dir = world();
    const commerce = approvedCommerce((text) => text);
    const answered = { ref: 'd9', event: 'decided', answers: 'q1', text: 'Fourteen days, as the spec\'s corrigendum holds.', why: 'The approved spec answers it.', by: 'claude', given: 'carried', cites: [{ path: commerce, section: 'Corrigenda' }] };
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) {
      const topic = dotpath.split('.')[2];
      const record = topic === 'licensing' ? entries.filter(({ ref }) => !['q2', 'd2'].includes(ref)) : topic === 'search' ? [...entries, answered] : entries;
      writeState(dir, composedPath('fumi', topic), recordText(record));
    }

    assert.deepStrictEqual(unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes(commerce)), [uncited('fumi', 'licensing', commerce, 'Corrigenda')]);
  });

  it('21.6.14: once every record walking them has one composed, each section of a walked asset holding text that no record cites, nor the session marks, is named on the topic it came in from, else on each topic where the unit has no record of its own; no spec, legacy file or other file is', () => {
    dir = world();
    writeState(dir, layout.assets('fumi', 'rates.md'), '# Rates\n\nPer seat.\n\n## Discounts\n\nNone.\n');
    writeState(dir, layout.assets('fumi', 'sso.md'), '# SSO\n\nOne sign-in.\n');
    for (const rel of ['legacy/notes.md', 'specs/draft.md', 'notes.txt']) writeState(dir, layout.assets('fumi', ...rel.split('/')), '# Kept\n\nText.\n');
    const fumi = Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'));
    for (const [dotpath, entries] of [...fumi, ['platform.discussion.auth', GOOD['platform.discussion.auth']]].filter(([at]) => at !== 'fumi.discovery.support')) {
      const [unit, , topic] = dotpath.split('.');
      writeState(dir, composedPath(unit, topic), recordText(entries));
    }
    const named = () => {
      const left = unfinished();
      return Object.fromEntries(fumi.map(([at]) => [at, left[at].filter((problem) => problem.includes('an asset'))]));
    };
    const sso = (/** @type {string} */ topic) => sharedUncited('fumi', topic, layout.assets('fumi', 'sso.md'), 'SSO');

    const before = named();
    writeState(dir, composedPath('fumi', 'support'), recordText([]));
    const composed = named();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [layout.assets('fumi', 'rates.md')]: ['Discounts'] }));

    assert.deepStrictEqual([before, composed, named()], [
      { 'fumi.discovery.billing': [], 'fumi.discussion.licensing': [], 'fumi.discussion.search': [], 'fumi.discovery.support': [] },
      {
        'fumi.discovery.billing': [sharedUncited('fumi', 'billing', layout.assets('fumi', 'rates.md'), 'Discounts'), sso('billing')],
        'fumi.discussion.licensing': [sso('licensing')], 'fumi.discussion.search': [sso('search')], 'fumi.discovery.support': [sso('support')],
      },
      { 'fumi.discovery.billing': [sso('billing')], 'fumi.discussion.licensing': [sso('licensing')], 'fumi.discussion.search': [sso('search')], 'fumi.discovery.support': [sso('support')] },
    ]);
  });

  it('a walked asset\'s heading held twice, by paths that tell it apart: a bare cite or mark settles neither copy, never the first, and one by its path its own alone', () => {
    dir = world();
    const sso = layout.assets('fumi', 'sso.md');
    writeState(dir, sso, '# SSO\n\n## Seats\n\n### Notes\n\nBilled per seat.\n\n## Teams\n\n### Notes\n\nBilled per team.\n');
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') || at === 'platform.discussion.auth')) {
      const [unit, , topic] = dotpath.split('.');
      writeState(dir, composedPath(unit, topic), recordText(entries));
    }
    /** The sections of the asset named on licensing, `marks` marked. @param {string[]} marks */
    const named = (marks) => {
      writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [sso]: marks }));
      return unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes(sso));
    };

    assert.deepStrictEqual([named(['Notes']), named(['Seats > Notes'])], [
      ['Seats > Notes', 'Teams > Notes'].map((section) => sharedUncited('fumi', 'licensing', sso, section)),
      [sharedUncited('fumi', 'licensing', sso, 'Teams > Notes')],
    ]);
  });

  it('21.6.14: in a unit with a record of its own, a discovery session\'s section, or an asset\'s no topic came in with, is named on it, each source\'s once every record walking it has one composed — of a session, a topic the unit promoted among them; of a split\'s research bearing no topic\'s name, the unit\'s own alone; a cite of the unit\'s own record, or of the topic it promoted, settles a section as any record\'s does', () => {
    dir = world();
    const session = layout.unit('fumi', 'discovery', 'session-001.md');
    writeState(dir, session, '## Discovery Session 001\n\n### Teams\n\nFor teams.\n\n### Sign-in\n\nOne sign-in across the product.\n');
    const exploration = layout.assets('fumi', 'research', 'exploration-superseded-20260101.md');
    writeState(dir, exploration, '# Exploration\n\n## Seats\n\nPer seat.\n\n## Hosting\n\nOn our servers.\n');
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) writeState(dir, composedPath('fumi', dotpath.split('.')[2]), recordText(entries));
    const found = (/** @type {string} */ text, /** @type {string} */ at, /** @type {string} */ section) => ({ ref: 'f9', event: 'found', text, how: 'read', known: 'read', by: 'claude', product_wide: true, cites: [{ path: at, section }] });
    const own = (/** @type {Record<string, unknown>} */ entry) => writeState(dir, composedPath('fumi', null), recordText([entry]));
    const named = () => Object.fromEntries(Object.entries(unfinished()).filter(([at]) => at.startsWith('fumi.')).map(([at, problems]) => [at, problems.filter((problem) => problem.includes('holds text no record'))]).filter(([, problems]) => problems.length > 0));

    own(found('The product is for teams.', session, 'Teams'));
    const promotedUncomposed = named();
    writeState(dir, composedPath('platform', 'auth'), recordText([...GOOD['platform.discussion.auth'], found('One sign-in across the product.', session, 'Sign-in')]));
    const composed = named();
    own(found('Hosting is on our servers.', exploration, 'Hosting'));

    assert.deepStrictEqual([promotedUncomposed, composed, named()], [
      { 'fumi.discovery': ['Seats', 'Hosting'].map((section) => sharedUncited('fumi', null, exploration, section)) },
      { 'fumi.discovery': ['Seats', 'Hosting'].map((section) => sharedUncited('fumi', null, exploration, section)) },
      { 'fumi.discovery': [sharedUncited('fumi', null, session, 'Teams', 'a discovery session'), sharedUncited('fumi', null, exploration, 'Seats')] },
    ]);
  });

  it('21.6.14: a split\'s research bearing a topic\'s name is walked by that topic alone, and its sections named on it once its record is composed, but one its own files hold word for word, heading and text, which its verifier walks there — its text alone under another heading no such copy; research bearing no topic\'s name is walked by no record in a unit with none of its own', () => {
    dir = world();
    writeState(dir, layout.topic('fumi', 'licensing', 'log.md'), decidedLog());
    const copied = layout.assets('fumi', 'research', 'licensing-superseded-20260101.md');
    writeState(dir, copied, `# Licensing\n\n### Trial Length\n\n#### Decision\n\n${DECIDED}\n\n### Trial\n\n${DECIDED}\n\n### Refunds\n\nWithin a week.\n`);
    writeState(dir, layout.assets('fumi', 'research', 'exploration-superseded-20260101.md'), '# Exploration\n\n## Seats\n\nPer seat.\n');
    const named = () => Object.fromEntries(Object.entries(unfinished()).map(([at, problems]) => [at, problems.filter((problem) => problem.includes('holds text no record'))]).filter(([, problems]) => problems.length > 0));
    const compose = (/** @type {string} */ dotpath) => writeState(dir, composedPath('fumi', dotpath.split('.')[2]), recordText(GOOD[dotpath]));

    const before = named();
    compose('fumi.discussion.licensing');
    const alone = named();
    for (const dotpath of Object.keys(GOOD).filter((at) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) compose(dotpath);

    const refunds = { 'fumi.discussion.licensing': ['Trial', 'Refunds'].map((section) => sharedUncited('fumi', 'licensing', copied, section)) };
    assert.deepStrictEqual([before, alone, named()], [{}, refunds, refunds]);
  });

  it('21.6.14: a copy is held only where it ends where a line does or its file ends, and a section whose text is one line under 40 characters by none, whatever holds it', () => {
    dir = world();
    const sections = `### Seats\n\nPer seat.\nBilled monthly.\n\n### Hosting\n\nOn our servers, in the region it signs.\n\n### Refunds\n\nWithin a week, by card, to the payer too`;
    writeState(dir, layout.topic('fumi', 'licensing', 'log.md'), `${decidedLog(' Twice.')}\n${sections}`);
    const copied = layout.assets('fumi', 'research', 'licensing-superseded-20260101.md');
    writeState(dir, copied, `# Licensing\n\n### Trial Length\n\n#### Decision\n\n${DECIDED}\n\n${sections}\n`);
    writeState(dir, composedPath('fumi', 'licensing'), recordText(GOOD['fumi.discussion.licensing']));

    const named = unfinished()['fumi.discussion.licensing'].filter((problem) => problem.includes('holds text no record'));

    assert.deepStrictEqual(named, ['Decision', 'Hosting'].map((section) => sharedUncited('fumi', 'licensing', copied, section)));
  });

  it('21.6.14: a cite by any record of the unit settles a shared source\'s section, whichever records walk it; and a section any topic of the unit holds word for word in its own files is settled, of research the unit\'s own record walks too', () => {
    dir = world();
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');
    writeState(dir, layout.topic('fumi', 'licensing', 'log.md'), decidedLog());
    const copied = layout.assets('fumi', 'research', 'licensing-superseded-20260101.md');
    writeState(dir, copied, '# Licensing\n\n### Refunds\n\nWithin a week.\n');
    const exploration = layout.assets('fumi', 'research', 'exploration-superseded-20260101.md');
    writeState(dir, exploration, `# Exploration\n\n## Seats\n\nPer seat.\n\n## Hosting\n\nOn our servers.\n\n## Trial Length\n\n#### Decision\n\n${DECIDED}\n`);
    const found = (/** @type {string} */ ref, /** @type {string} */ text, /** @type {string} */ at, /** @type {string} */ section) => ({ ref, event: 'found', text, how: 'read', known: 'read', by: 'claude', product_wide: false, cites: [{ path: at, section }] });
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) {
      const topic = dotpath.split('.')[2];
      const extra = topic === 'search' ? [found('f8', 'Refunds come within a week.', copied, 'Refunds'), found('f9', 'Hosting is on our servers.', exploration, 'Hosting')] : [];
      writeState(dir, composedPath('fumi', topic), recordText([...entries, ...extra]));
    }
    writeState(dir, composedPath('fumi', null), recordText([]));

    const named = Object.fromEntries(Object.entries(unfinished()).map(([at, problems]) => [at, problems.filter((problem) => problem.includes('holds text no record'))]).filter(([, problems]) => problems.length > 0));

    assert.deepStrictEqual(named, { 'fumi.discovery': [sharedUncited('fumi', null, exploration, 'Seats')] });
  });

  it('21.6.20: once every record of a unit is composed, a contradiction one record names between sections of a source its records share, by its at_odds, is named on each other record citing a side of it and naming it nowhere, and the unit\'s records wait on it — until that record names it, its at_odds holding the same sections, or the session marks it as carrying no side; a record citing neither asked nothing', () => {
    dir = world();
    writeState(dir, RATES, '# Rates\n\n## Seats\n\nPer seat.\n\n## Flat\n\nA flat rate.\n');
    const teamSeats = [
      { ref: 'q9', event: 'asked', text: 'How many seats does a team start with?', by: 'claude', cites: [rate('Seats')] },
      { ref: 'd9', event: 'decided', answers: 'q9', text: 'Five.', why: 'The rates say so.', by: 'claude', given: 'carried', cites: [rate('Seats')] },
    ];
    const passed = (/** @type {string} */ topic, /** @type {unknown[]} */ entries) => {
      writeState(dir, composedPath('fumi', topic), JSON.stringify({ entries }));
      for (const [rel, text] of passedBeside('fumi', topic, entries)) writeState(dir, rel, text);
    };
    passed('billing', [...GOOD['fumi.discovery.billing'], ratesAtOdds('q9')]);
    passed('search', GOOD['fumi.discussion.search']);
    passed('licensing', [...GOOD['fumi.discussion.licensing'], ...teamSeats]);
    const named = () => Object.fromEntries(Object.entries(unfinished()).filter(([at]) => at.startsWith('fumi.')).map(([at, problems]) => [at, problems.filter((problem) => problem.includes('are at odds'))]).filter(([, problems]) => problems.length > 0));
    const licensing = () => refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.licensing', [...GOOD['fumi.discussion.licensing'], ...teamSeats]), { env: SESSION }, harness);

    const uncomposed = named();
    passed('support', []);
    const oneSided = [named(), licensing()];
    passed('licensing', [...GOOD['fumi.discussion.licensing'], { ...ratesAtOdds('q8', true), cites: [rate('Rates > Seats'), rate('Flat')], at_odds: [rate('Rates > Seats'), rate('Flat')] }]);
    const sharing = named();
    passed('licensing', [...GOOD['fumi.discussion.licensing'], ratesAtOdds('q8', true), { ...teamSeats[1], ref: 'd8', answers: 'q8', text: 'Per seat.' }]);
    const answered = named();
    passed('licensing', [...GOOD['fumi.discussion.licensing'], ...teamSeats]);
    writeState(dir, `.cache/migrate/records/fumi.at-odds.json`, JSON.stringify({ 'fumi.discussion.licensing': [{ log: [rate('Flat'), rate('Seats')] }] }));
    const logged = named();
    writeState(dir, `.cache/migrate/records/fumi.at-odds.json`, JSON.stringify({ 'fumi.discussion.licensing': [[rate('Flat'), rate('Seats')]] }));
    const marked = named();
    carry('fumi.discussion.licensing', [...GOOD['fumi.discussion.licensing'], ...teamSeats]);
    const old = path.join(dir, '.workflows', 'fumi', 'manifest.json');
    const fumi = JSON.parse(fs.readFileSync(old, 'utf8'));
    fumi.phases.specification.items.commerce = { status: 'completed', date: '2026-03-30', sources: {} };
    fs.writeFileSync(old, JSON.stringify(fumi));
    const session = layout.unit('fumi', 'discovery', 'session-001.md');
    writeState(dir, session, '# Discovery Session 001\n\nDate: 2026-03-01\n\n## Ranking\n\nBy day.\n');
    writeState(dir, composedPath('fumi', null), recordText([]));
    const corrigenda = { path: layout.assets('fumi', 'specs', 'commerce.md'), section: 'Corrigenda' };
    const ranking = { path: session, section: 'Ranking' };
    passed('billing', [...GOOD['fumi.discovery.billing'], { ...ratesAtOdds('q9'), cites: [corrigenda, ranking], at_odds: [corrigenda, ranking] }]);
    const dated = named();

    assert.deepStrictEqual([uncomposed, ...oneSided, sharing, answered, logged, marked, dated], [
      {},
      { 'fumi.discussion.licensing': [unshared('fumi.discussion.licensing', 'fumi.discovery.billing', [rate('Seats')])] },
      waitsOn('fumi', 'licensing', ['a contradiction a record of fumi names goes unnamed on another record citing a side of it — `migrate check 079-records` names each where it is named']),
      {},
      { 'fumi.discussion.licensing': [unshared('fumi.discussion.licensing', 'fumi.discovery.billing', [rate('Seats'), rate('Flat')])] },
      {},
      {},
      { 'fumi.discussion.licensing': [unshared('fumi.discussion.licensing', 'fumi.discovery.billing', [corrigenda], [corrigenda, ranking], [`"Corrigenda" in ${statePath(dir, corrigenda.path)} (approved on 2026-03-30)`, `"Ranking" in ${statePath(dir, session)} (written on 2026-03-01)`])] },
    ]);
  });

  it('21.6.20: no decision settles a point at odds while the migration runs, by any shape a record takes — holding at_odds, answering the question holding it, or answering a part of that question — one rule refusing each, and a decision answering the whole of an at-odds part left alone; only an open question holds at_odds, two headings at least as the one resolver reads them, each one its cites name, and marked to raise where its topic raises — unmarked where it may not', () => {
    dir = world();
    writeState(dir, RATES, '# Rates\n\n## Seats\n\nPer seat.\n\n## Flat\n\nA flat rate.\n');
    const odds = (/** @type {string} */ ref, /** @type {Record<string, unknown>} */ also = {}) => ({ ...ratesAtOdds(ref, true), text: `Per seat, or a flat rate (${ref})?`, ...also });
    const perSeat = (/** @type {string} */ ref, /** @type {string} */ answers, /** @type {Record<string, unknown>} */ also = {}) => ({ ref, event: 'decided', answers, text: 'Per seat.', why: 'The rates say so.', by: 'claude', given: 'carried', cites: [rate('Seats')], ...also });
    const asked = (/** @type {string} */ ref, /** @type {Record<string, unknown>} */ also = {}) => ({ ref, event: 'asked', text: `Is a seat billed alone (${ref})?`, by: 'claude', cites: [rate('Seats')], ...also });
    const record = [
      asked('q21'), perSeat('d21', 'q21', { cites: SIDES, at_odds: SIDES }),
      odds('q22', { raise: undefined }), perSeat('d22', 'q22'),
      odds('q23'), asked('q24', { part_of: 'q23' }), perSeat('d24', 'q24'),
      { ref: 'f25', event: 'found', text: 'The rates hold both.', how: 'read in the rates', known: 'read', by: 'claude', cites: SIDES, at_odds: SIDES },
      odds('q26', { at_odds: [rate('Seats'), rate('Rates > Seats')] }),
      odds('q27', { cites: [rate('Seats')] }),
      odds('q28', { raise: undefined }),
      odds('q29', { cites: [rate('Rates > Seats'), rate('Flat')] }),
      asked('q30'), perSeat('d30', 'q30'), odds('q31', { part_of: 'q30' }),
      odds('q32'), perSeat('d32', 'q32'),
    ];
    const settledWay = 'where a later answer settles the point, it is no point at odds: no entry holds at_odds for it, its question is not marked to raise, and the decision answers it';
    const settles = (/** @type {string} */ ref, /** @type {string} */ how) => `entry ${ref}: a decision settles no point at odds while the migration runs — ${how}: ${settledWay}; where none does, the question stays open, and the findings carrying each side name each other`;
    const shaped = (/** @type {string} */ ref, /** @type {string} */ how) => `entry ${ref}: ${how} — the sections at odds, [{path, section}, …], are two at least, each one a cite of it names`;
    const unmarked = (/** @type {string} */ ref) => `entry ${ref} names a point at odds, which no source settles, and is not marked to raise: mark it raise true`;

    assert.deepStrictEqual(ok(dir, [...carryArgs(dir, 'fumi.discussion.licensing', [...GOOD['fumi.discussion.licensing'], ...record]), '--dry-run'], { env: SESSION }).faults, [
      `entry q32: is marked to raise, and a decision of the record answers it — raise refuses a question answered already, so a point to raise is an open question; ${settledWay}`,
      settles('d21', 'it holds at_odds'),
      unmarked('q22'), settles('d22', 'it answers q22, which holds at_odds'),
      settles('d24', 'it answers q24, part of q23, which holds at_odds'),
      'entry f25: at_odds is an open question\'s — the findings carrying each side of a point at odds name each other in words',
      shaped('q26', 'its at_odds names one section'),
      shaped('q27', 'its at_odds names a section none of its cites names'),
      unmarked('q28'),
      settles('d32', 'it answers q32, which holds at_odds'),
    ]);
    assert.deepStrictEqual(ok(dir, [...carryArgs(dir, 'fumi.discovery.billing', [...GOOD['fumi.discovery.billing'], ratesAtOdds('q9')]), '--dry-run'], { env: SESSION }).faults, [], 'a topic that may not raise names a contradiction unmarked');
  });

  it('carries a record of a unit whose records wait on one the session settled in its verifier\'s place as on one its verifier passed (21.10.17)', () => {
    dir = world();
    writeState(dir, layout.assets('fumi', 'rates.md'), '# Rates\n\nPer seat.\n');
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [layout.assets('fumi', 'rates.md')]: ['Rates'] }));
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) {
      const topic = dotpath.split('.')[2];
      writeState(dir, composedPath('fumi', topic), recordText(entries));
      if (topic === 'search') {
        writeState(dir, verifyingPath('fumi', topic), JSON.stringify({ hash: crypto.createHash('sha256').update(readState(dir, composedPath('fumi', topic))).digest('hex'), refs: [], entries: {}, settled: true }));
      } else {
        writeState(dir, findingsPath('fumi', topic), '');
        writeState(dir, checkedPath('fumi', topic), entries.map(({ ref }) => `${ref}: ok\n`).join(''));
      }
    }

    const search = unfinished()['fumi.discussion.search'];
    carry('fumi.discussion.licensing', GOOD['fumi.discussion.licensing']);

    assert.deepStrictEqual([search, fs.existsSync(statePath(dir, carriedPath('fumi', 'licensing')))], [['was settled by the session, and waits to be carried'], true]);
  });

  it('carries no topic of a unit a topic was promoted to while a record of the unit it came from, whose discovery sessions it walks, has none its verifier passed, or a section of them goes uncited (21.10.17)', () => {
    dir = world();
    const session = layout.unit('fumi', 'discovery', 'session-001.md');
    writeState(dir, session, '## Discovery Session 001\n\n### Sign-in\n\nOne sign-in across the product.\n');
    const waits = (/** @type {string[]} */ reasons) => waitsOn('platform', 'auth', reasons, 'fumi');
    const signIn = { ref: 'f9', event: 'found', text: 'One sign-in across the product.', how: 'read', known: 'read', by: 'claude', product_wide: true, cites: [{ path: session, section: 'Sign-in' }] };
    const passed = (/** @type {string} */ unit, /** @type {string|null} */ topic, /** @type {Record<string, unknown>[]} */ entries) => {
      writeState(dir, composedPath(unit, topic), recordText(entries));
      writeState(dir, findingsPath(unit, topic), '');
      writeState(dir, checkedPath(unit, topic), entries.map(({ ref }) => `${ref}: ok\n`).join(''));
    };
    const auth = (/** @type {Record<string, unknown>[]} */ entries) => refusedUntouched(dir, carryArgs(dir, 'platform.discussion.auth', entries), { env: SESSION }, harness);
    const fumi = Object.keys(GOOD).filter((at) => at.startsWith('fumi.')).map((at) => at.split('.')[2]).sort();
    passed('platform', 'auth', GOOD['platform.discussion.auth']);

    const unpassed = auth(GOOD['platform.discussion.auth']);
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) passed('fumi', dotpath.split('.')[2], entries);
    passed('fumi', null, []);
    const uncitedSignIn = auth(GOOD['platform.discussion.auth']);
    passed('platform', 'auth', [...GOOD['platform.discussion.auth'], signIn]);
    carry('platform.discussion.auth', [...GOOD['platform.discussion.auth'], signIn]);

    assert.deepStrictEqual([unpassed, uncitedSignIn], [
      waits([...fumi.map((topic) => `fumi's ${topic} has no record composed`), 'fumi\'s own record has no record composed']),
      waits([counted('fumi', 1)]),
    ]);
  });

  it('carries no topic of a unit holding a discovery session or a walked asset of text while any record walking it, its own and a topic it promoted among them, has none its verifier passed, or a section of it goes uncited (21.10.17)', () => {
    dir = world();
    const session = layout.unit('fumi', 'discovery', 'session-001.md');
    writeState(dir, session, '## Discovery Session 001\n\n### Teams\n\nFor teams.\n');
    writeState(dir, layout.assets('fumi', 'rates.md'), '# Rates\n\nPer seat.\n\n## Discounts\n\nNone.\n');
    const waits = (/** @type {string[]} */ reasons) => waitsOn('fumi', 'licensing', reasons);
    const licensing = () => refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.licensing', GOOD['fumi.discussion.licensing']), { env: SESSION }, harness);
    const passed = (/** @type {string} */ unit, /** @type {string|null} */ topic, /** @type {unknown[]} */ entries) => {
      writeState(dir, composedPath(unit, topic), recordText(entries));
      writeState(dir, findingsPath(unit, topic), '');
      writeState(dir, checkedPath(unit, topic), entries.map((entry) => `${/** @type {{ref: string}} */ (entry).ref}: ok\n`).join(''));
    };
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) passed('fumi', dotpath.split('.')[2], entries);

    const unpassed = licensing();
    passed('fumi', null, []);
    passed('platform', 'auth', GOOD['platform.discussion.auth']);
    const uncitedTwo = licensing();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [layout.assets('fumi', 'rates.md')]: ['Discounts'] }));
    const uncitedOne = licensing();
    writeState(dir, sectionsMarked('fumi'), JSON.stringify({ [layout.assets('fumi', 'rates.md')]: ['Discounts'], [session]: ['Teams'] }));
    carry('fumi.discussion.licensing', GOOD['fumi.discussion.licensing']);

    assert.deepStrictEqual([unpassed, uncitedTwo, uncitedOne], [
      waits(['fumi\'s own record has no record composed', 'platform\'s auth has no record composed']),
      waits([counted('fumi', 2)]),
      waits([counted('fumi', 1)]),
    ]);
  });

  it('carries no topic of a unit drawing on an approved spec while any topic of it has no record its verifier passed, or a section of its specs goes uncited: the session\'s order, refused with nothing written, nor anything beside the record (21.10.9)', () => {
    dir = world();
    const commerce = approvedCommerce((text) => `${text}\n## Refunds\n\nWithin a week.\n`);
    const waits = (/** @type {string[]} */ reasons) => waitsOn('fumi', 'licensing', reasons);
    const licensing = () => refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.licensing', GOOD['fumi.discussion.licensing']), { env: SESSION }, harness);
    const others = ['billing', 'search', 'support'];

    const alone = licensing();
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.') && at !== 'fumi.discussion.licensing')) {
      writeState(dir, composedPath('fumi', dotpath.split('.')[2]), recordText(entries));
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
      waits(others.map((topic) => `fumi's ${topic} has not passed its verifier — no verifier has been briefed on it`)),
      waits([`fumi's search has not passed its verifier — its findings stand in ${statePath(dir, findingsPath('fumi', 'search'))}`]),
      waits([counted('fumi', 1)]),
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

describe('the next step the check names on each record, so the session learns a record\'s state from the check, never from a refusal', () => {
  const GONE = 'gone.discussion.gone';
  /** gone's record composed as `entries`, its text's hash, as a verifier's brief notes it. @param {unknown[]} entries */
  const composeGone = (entries) => {
    writeState(dir, composedPath('gone', 'gone'), recordText(entries));
    return crypto.createHash('sha256').update(readState(dir, composedPath('gone', 'gone'))).digest('hex');
  };
  /** gone's verifier briefed on the record hashed `hash`, asked a verdict of q1. @param {string} hash */
  const briefed = (hash) => writeState(dir, verifyingPath('gone', 'gone'), JSON.stringify({ hash, refs: ['q1'], entries: { q1: 'q1-hash' } }));
  /** gone's verifier's round written: its findings, and its verdicts. @param {string} findings @param {string} [verdicts] */
  const reported = (findings, verdicts = 'q1: see finding\n') => {
    writeState(dir, findingsPath('gone', 'gone'), findings);
    writeState(dir, checkedPath('gone', 'gone'), verdicts);
  };
  const next = () => nexts()[GONE];

  const UNREPORTED = 'its verifier has not reported yet: wait for it; once it has returned without writing its findings, brief a fresh verifier';

  it('through a record\'s rounds: its verifier briefed, awaited — and, once it returns without writing or its files are removed, briefed afresh — its findings answered by an agent, a reversal and a late round by the session, a verifier that gave no verdict replaced, naming only the files it wrote, a record changed since read again, what an agent left removed, findings handed back settled — then ready to carry; and once the carry refused it, its amend by a fresh per-topic agent next', () => {
    dir = world();
    const record = GOOD[GONE];
    const hash = composeGone(record);
    /** @type {(string|undefined)[]} */
    const walked = [];
    walked.push(next());
    briefed(hash);
    walked.push(next());
    reported('- The record drops what the log says caused it.\n');
    walked.push(next());
    reported('- Reverses round 1: the cause is the record\'s.\n');
    walked.push(next());
    writeState(dir, roundsPath('gone', 'gone'), '## Round 1\n\nNone: the verifier passed it.\n\n## Round 2\n\n- Dropped.\n');
    reported('- The cause is still dropped.\n');
    walked.push(next());
    reported('- Settled: Cause, amend to agree\n');
    walked.push(next());
    composeGone([{ ...record[0], text: 'What caused the drop?' }]);
    walked.push(next());
    composeGone(record);
    reported('- The cause is dropped.\n', '');
    walked.push(next());
    for (const rel of [findingsPath, checkedPath]) fs.rmSync(statePath(dir, rel('gone', 'gone')));
    walked.push(next());
    reported('', 'q1: ok\n');
    writeState(dir, `${composedPath('gone', 'gone')}.draft`, '{}');
    walked.push(next());
    fs.rmSync(statePath(dir, `${composedPath('gone', 'gone')}.draft`));
    writeState(dir, handbackPath('gone', 'gone'), '- Carry the second cause: round 1 ruled it replaced.\n');
    walked.push(next());
    fs.rmSync(statePath(dir, handbackPath('gone', 'gone')));
    walked.push(next());
    writeState(dir, refusedPath('gone', 'gone'), 'ledger carry: gone\'s gone breaks the records directive\'s rules, so nothing is carried — entry q1 cites a heading its log holds twice\n');
    walked.push(next());

    const dry = `\`ledger carry ${GONE} --dry-run\``;
    assert.deepStrictEqual(walked, [
      `check it with ${dry}, then brief its verifier`,
      UNREPORTED,
      'a fresh per-topic agent amends it, its brief carrying the findings; once it returns, a fresh verifier reads it',
      'a finding reverses an earlier ruling or the session: settle it from the record\'s sources, or ask the person',
      `round 3's findings are yours to settle: settle each, then pass it with \`ledger settle ${GONE}\``,
      'a fresh per-topic agent amends it, its brief carrying the findings; once it returns, a fresh verifier reads it',
      `it was amended since its verifier read it: check it with ${dry}, then brief a fresh verifier`,
      `its verifier gave no verdict on q1: remove ${statePath(dir, findingsPath('gone', 'gone'))} and ${statePath(dir, checkedPath('gone', 'gone'))}, and brief a fresh verifier`,
      UNREPORTED,
      `remove what an agent left beside its record: ${statePath(dir, `${composedPath('gone', 'gone')}.draft`)}`,
      `settle each finding its composer handed back, then remove ${statePath(dir, handbackPath('gone', 'gone'))}`,
      `ready to carry: \`ledger carry ${GONE}\``,
      `the carry refused it: a fresh per-topic agent amends it, its brief carrying the refusal in ${statePath(dir, refusedPath('gone', 'gone'))}`,
    ]);
  });

  it('a section no record cites, or a contradiction another record names, once the session settles it into the record — a `Settled:` finding naming it — is no longer to read — a word holding its name naming it not — what is left is read first, then the record is amended', () => {
    dir = world();
    const [q1, d1] = GOOD['shop.discussion.weights'];
    carryArgs(dir, 'shop.discussion.weights', [q1, d1]);
    const settle = (/** @type {string[]} */ sections) => writeState(dir, findingsPath('shop', 'weights'), sections.map((section) => `- Settled: ${section}, amend to agree\n`).join(''));
    settle(['1. Weights > Ranking > Detail']);
    const deeper = nexts()['shop.discussion.weights'];
    settle(['1. Weights > Ranking > Detail', '1. Weights > Ranking', '2. Wishlist > Saving']);
    const one = nexts()['shop.discussion.weights'];
    settle(['1. Weights > Ranking > Detail', '1. Weights > Ranking', '2. Wishlist > Saving', '2. Wishlist > Ranking']);
    const amend = nexts()['shop.discussion.weights'];

    writeState(dir, RATES, '# Rates\n\n## Seats\n\nPer seat.\n\n## Flat\n\nA flat rate.\n');
    const seats = [
      { ref: 'q9', event: 'asked', text: 'How many seats does a team start with?', by: 'claude', cites: [rate('Seats')] },
      { ref: 'd9', event: 'decided', answers: 'q9', text: 'Five.', why: 'The rates say so.', by: 'claude', given: 'carried', cites: [rate('Seats')] },
    ];
    for (const [topic, entries] of [['billing', [...GOOD['fumi.discovery.billing'], ratesAtOdds('q9')]], ['search', GOOD['fumi.discussion.search']], ['licensing', [...GOOD['fumi.discussion.licensing'], ...seats]], ['support', []]]) {
      carryArgs(dir, `fumi.discussion.${topic}`, /** @type {unknown[]} */ (entries));
    }
    const odds = nexts()['fumi.discussion.licensing'];
    writeState(dir, findingsPath('fumi', 'licensing'), '- Settled: ExtraSeats and Flats at odds, amend to agree\n');
    const inOtherWords = nexts()['fumi.discussion.licensing'];
    writeState(dir, findingsPath('fumi', 'licensing'), '- Settled: Seats and Flat at odds, amend to agree\n');

    assert.deepStrictEqual([deeper, one, amend, odds, inOtherWords, nexts()['fumi.discussion.licensing']], [
      '3 uncited sections to read: settle each into this record, or mark it',
      'an uncited section to read: settle each into this record, or mark it',
      'a fresh per-topic agent amends it, its brief carrying the findings; once it returns, a fresh verifier reads it',
      'a contradiction another record names to judge: settle each into this record, or mark it',
      'a contradiction another record names to judge: settle each into this record, or mark it',
      'a fresh per-topic agent amends it, its brief carrying the findings; once it returns, a fresh verifier reads it',
    ]);
  });

  it('once passed: the sections no record cites named on it to read; what its carry waits on, the records of another unit by their places, or the sections named on another record; a carried record never in the ledger carried again', () => {
    dir = world();
    const [q1, d1] = GOOD['shop.discussion.weights'];
    carryArgs(dir, 'shop.discussion.weights', [q1, d1]);
    const uncited = nexts()['shop.discussion.weights'];
    const session = layout.unit('fumi', 'discovery', 'session-001.md');
    writeState(dir, session, '## Discovery Session 001\n\n### Sign-in\n\nOne sign-in across the product.\n');
    carryArgs(dir, 'platform.discussion.auth', GOOD['platform.discussion.auth']);
    const unpassed = nexts()['platform.discussion.auth'];
    for (const [dotpath, entries] of Object.entries(GOOD).filter(([at]) => at.startsWith('fumi.'))) carryArgs(dir, dotpath, entries);
    carryArgs(dir, 'fumi.discovery', []);
    const sections = nexts();
    writeState(dir, carriedPath('gone', 'gone'), JSON.stringify({ unit: 'gone', phase: 'discussion', topic: 'gone', entries: [{ ref: 'q1', id: 'aaaaaaaaaaaaaaaaaaaaa' }], record: { entries: GOOD[GONE] } }));

    assert.deepStrictEqual([uncited, unpassed, sections['platform.discussion.auth'], sections['fumi.discovery'], nexts()[GONE]], [
      '4 uncited sections to read: settle each into this record, or mark it',
      `passed, and its carry waits on fumi's records ${['fumi.discovery.billing', 'fumi.discussion.licensing', 'fumi.discussion.search', 'fumi.discovery.support', 'fumi.discovery'].join(', ').replace(/, (?=[^,]+$)/, ' and ')}, until each passes`,
      'passed, and its carry waits on a section of fumi\'s sources no record cites',
      'an uncited section to read: settle each into this record, or mark it',
      `carry it again: \`ledger carry ${GONE}\``,
    ]);
  });
});

describe('against what the real move writes (078)', () => {
  it('its topic a piece, its review folded into its log, and an empty record asked for its old map, its thread and its import', () => {
    dir = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-moved-'))), 'fumi');
    initRepo(dir);
    for (const [rel, text] of Object.entries(TODAYS)) createFile(dir, rel, text);
    commitAll(dir);
    MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });

    assert.deepStrictEqual(checked().unfinished, [{ name: 'fumi.discussion.search', problems: ['has no record composed'], next: 'compose its record: brief a per-topic agent' }]);
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

  it('a reversal the session settles before the third round: a ruling that changes the record becomes a finding to amend to, one that keeps it takes the finding out; from the third, every finding stays as the verifier wrote it for the settlement — so an empty findings file is only ever a pass', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      'Write what settles it, a line naming the point and the source or answer it rests on, into the settled file beside the record, as its brief names it,',
      'Of a round before the third, where it has the record change, replace the finding with `Settled: {point}, amend to agree`, and where it keeps the record as it stands, take the finding out of the findings file.',
      'A finding of the third round or a later one stays in the findings file as the verifier wrote it.',
      'Then pass the record in the verifier\'s place, every finding of the round on stdin by its number, its list item\'s place in the findings file, one entry naming several settled alike: `{"findings": [{"numbers": [1, 3], "settled", "why"}]}`, `settled` `fixed` or `ruled-out`.',
      'A finding the session writes itself, a section the check names below among them, always goes to a fresh verifier once the record is amended, never to the settlement, which is refused while the session\'s pass is the last.',
      'An empty findings file is only ever a pass.',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('one rule marks a point to raise: the points no source settles alone, every other open question carried unmarked', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      '- **Points no source settles** are open questions marked `raise` `true`, for the raises at the end, and they alone:',
      'Any other open question, one its sources leave for later work to answer, is carried unmarked.',
      '- **`raise`**: `true` on a point no source settles, as the rules above name them, an open question no decision of the record answers; on no other entry.',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('every engine call runs from the project\'s folder, each file to read or write named whole by the briefs and the check; each kind a finding is known by said', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      'Run every engine call from the project\'s folder: a brief names each file its agent reads or writes by its whole path, and the check each file it asks the session to write.',
      'Every other finding says `documented`, where its source has it from documentation; `spike`, from a spike; or `read`, from reading the code or a file.',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('a ref is the record\'s alone: no entry\'s words name another by it', () => {
    assert.ok(fs.readFileSync(DIRECTIVE, 'utf8').includes('- **`ref`**: the entry\'s name in the record, given once; every link names an entry by it, and no entry\'s words do: say in words what the other entry holds.'));
  });

  it('a verifier\'s rulings are kept with its round, a reversal of one settled by the session as any, and every amend brief carries them', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      'and writes its findings beside the record, an empty file its pass; its rulings: each point of the sources it ruled is not this record\'s, or is replaced by a later answer, in whole or in part, naming what still stands, one line each, with its source; and its verdict on each entry the sheet does not mark passed unchanged, `{ref}: ok` or `{ref}: see finding`.',
      'keeps the last as a round in the rounds file beside the record, its rulings and verdicts with it, and clears them',
      'walking the sheet its brief draws: every section of every source, in order, with the entries citing each — from the second round, every section the sheet marks open, a closed one walked in an earlier round, every entry citing it passed unchanged, and none that cited it then gone from it — a section an entry stopped citing is open again. It reads each section in its source, checks that what each entry beneath it takes from the section is what the section says, and each point the section makes is carried or not this record\'s — that a cited heading exists is no check —',
      'The next brief and the carry are refused while the last verifier\'s verdicts miss an entry its brief asked a verdict of, or name one the record it read does not hold: remove what it wrote, and brief a fresh verifier. The carry refuses a record changed since its verifier was briefed on it — brief a fresh verifier — and keeps the passing round with the rounds before it:',
      'Once every record of a unit is composed, read each draft spec several of its topics draw on: a section of it bearing on no one topic\'s subject goes to one of the topics drawing on it, as below, for the check names an approved spec\'s sections alone.',
      '- **A record at least.** A topic that draws on a spec, or whose log, brief or experiments\' records — its markdown files — hold text past their headings, has an entry at least.',
      'A reversal is a finding against a point an earlier round\'s rulings set aside, opening `Reverses round {R}:`, R the round that ruled, or against one the session settled, opening `Reverses the session:`; a new point on what an earlier round passed, or on what its findings had the record changed to, is a finding as any other. A reversal goes to no agent, nor does a finding a per-topic agent handed back unanswered, asking for a point the rulings set aside, in the hand-back file beside the record, nor a finding the third round or a later one writes.',
      'a fresh verifier reads what changed since, until one passes it.',
      'A file an agent left beside the records, which the check names, is removed.',
      'Once the per-topic agent has returned, settle first each finding it handed back, as below: the verifier\'s brief and the carry are refused while its hand-back file stands. Then, where no `Settled:` finding stands, check the record as the carry would',
      'Settle every handed-back finding before anything else.',
      'Once every handed-back finding is settled, remove the hand-back file. Then, where a `Settled:` finding stands, a fresh per-topic agent amends the record to answer it, and a fresh verifier reads it again, its brief keeping it as a round.',
      'The verifier\'s round and the session\'s after it are kept with the rounds, and the record goes to the carry as it stands:\n\n```bash\nnode .claude/skills/ledger-engine/scripts/engine.cjs ledger settle {place}\n```',
      'Where none stands after a hand-back, the findings left are those the agent answered: check the record, and a fresh verifier reads it next. Where none stands after a reversal, a finding left goes to a fresh per-topic agent, and where none is left, the file empty, the record has passed.',
      '- Nothing for any one entry, but a point the record\'s sources do not\n  settle that a verifier reverses, that a composer hands back, or that a\n  finding of the third round or a later one raises.',
      'each brief carries the verifier\'s findings, every round\'s rulings, the carry\'s refusal and the points this session settled',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('a point of a shared source, a shared spec\'s among them, is the record\'s of the topic whose subject it bears on, named or not, one bearing on none the unit\'s own where it has one, else its one topic\'s; other topics are listed to judge by, never sources — each line the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const sources = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      'A point in a shared source — a discovery session, an asset of the unit, a spec several topics draw on, research that fed several topics — belongs to the record of the topic whose subject it bears on, whether or not it names the topic. A point of the discovery sessions, their research or the unit\'s assets bearing on no topic\'s subject is the unit\'s own record\'s, `{unit}.discovery`, where the unit has one, an epic\'s; in a unit of one topic, it is that topic\'s. A spec section bearing on no one topic\'s subject is one of the topics\' drawing on the spec, the session choosing which once every record is composed.',
      'A record of no entries is one, where every point of the sessions bears on a topic\'s subject.',
      '- **A shared spec.** From a spec several topics draw on, carry each point bearing on this topic\'s subject, its log discussing it or not, and each section its findings send it.',
      'and the unit\'s other topics, each with what it is about, to judge whose a point is by, and the unit\'s other assets, each with where it came from: they are not sources. Each record is carried from its own sources alone, never another topic\'s log, brief or record',
      '— and never the project\'s code: a record is what its sources decided.',
      '- Its unit\'s assets its brief lists to walk: each markdown file in `{unit}/assets/` but its specs and its legacy files — the documents the person shared; and the research a legacy split superseded, in `assets/research/`, a topic\'s where it bears the topic\'s name, else the unit\'s own record\'s alone. Its later answers decide what of an asset is current, as of any source.',
      'A unit\'s own record has the unit\'s discovery sessions, the assets its brief lists to walk, and the threads still open of research under no topic\'s name that its brief lists, as its sources.',
    ].filter((rule) => !sources.includes(rule)), []);
  });

  it('product-wide is stated once, in the record\'s shape, with an example of what is and what is not', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const shape = text.slice(text.indexOf('### Its Shape'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([text.split('holds across the whole product').length - 1, shape.includes('- **`product_wide`**: `true` where the entry holds across the whole product — every command, every screen, every output — not only this topic\'s part of it'), shape.includes('A CLI\'s exit codes, its error stream and its global flags are product-wide; one command\'s options are not.'), text.includes('**Product-wide.**')], [1, true, true, false]);
  });

  it('a section no record cites goes, by one rule, to the record it belongs to where it holds a current decision, finding or open question — settled as that record\'s, whatever its rulings said of whose the point is — and is marked where it holds none, or only what a later answer replaced or a cancelled unit alone decided; a unit\'s topics are carried once its records are passed and its sections settled', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.ok(!text.includes('Where that record\'s rulings set the section aside') && !text.includes('Where that topic\'s rulings set the section aside'), 'one path, whatever the rulings');
    assert.deepStrictEqual([
      'Where it holds a current decision, finding or open question, it goes to the record its subject belongs to — of a spec\'s section, one of the topics the check names it on: write into that record\'s settled file, as the check names it, a line naming the section as the record\'s and what of it the record misses, and into its findings `Settled: {section}, amend to agree`. That record is amended to carry it, whatever its rulings said of whose the point is, and verified again.',
      'Where it holds none — a section that frames the others, says again what a cited one holds, holds only what a later answer replaced, or is a corrigendum recording only what a cancelled unit decided — mark it',
      'mark it in `.cache/migrate/records/{unit}.sections.json`, only once you have read it and never by a script over the check\'s list, as the check names the mark:',
      'and of each of its discovery sessions and each asset its records walk, on the topic an asset came in from or a split\'s research bears the name of, else on the unit\'s own record, else on each of its topics — never a section any topic of the unit holds word for word in its own files, of a session a topic the unit promoted too, which that topic\'s verifier walks there with its log\'s later word, but for a section whose text is one line under 40 characters. A cite by any record of the unit settles a section of a session or an asset, whichever records walk it; of a session, a cite by a topic the unit promoted too.',
      'So a unit\'s records are carried in order: compose every record, have each verifier pass it, settle the sections and the contradictions the check names, then carry them. The carry of a record of a unit with an approved spec, or with a discovery session or an asset its records walk holding text, its own among them, waits until each record drawing on them has passed its verifier or the session\'s settlement — of a session, the unit\'s own and a topic it promoted among them — and the check names no such section nor contradiction, naming what it waits on, or how many of them the check names. Every record of a unit a topic was promoted to waits on the unit it came from in the same way.',
    ].filter((rule) => !text.includes(rule)), []);
  });

  it('a record holds each current decision, finding and open question, and a spec section it cites is carried whole: citing it for one rule and leaving its others out is a gap', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.ok(text.includes('Each current decision, finding and open question the topic\'s sources hold, and nothing else:'));
    assert.ok(text.includes('- **A cited section, whole.** A section of a spec drawing on the topic, cited, is carried whole: each current decision, finding and open question it holds that concerns this topic is an entry. Citing a section for one of its rules and leaving its others out is a gap. A section cited as a later answer gives that answer alone.'));
  });

  it('21.6.3: a later answer is an approved spec of the unit, whether it draws on the topic or not, to what the log settled before its approval — the log first where no date shows otherwise, but for a section appended after; one the log settles after it the log\'s, naming the section it departs from — or the log\'s own word, a scope note wherever it stands, setting material aside, delegating it or putting it out of scope; what it replaces left in the log, a question it answers answered by a decision citing its section — in discovery a finding; a cancelled unit\'s corrigendum none for what it decided, carried if at all as a finding naming that unit, one recording what a unit not cancelled changed still one; where an approved spec settles a point, raised none — each in what the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const briefed = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      '- Its unit\'s approved specs it does not draw on, kept or joined the same way: the later answer to each of its points.',
      'Two things are a later answer, where they and what came before them differ: an approved spec of its unit, whether it draws on the topic or not, its corrigenda and amendments among it, to what the log settled before the spec was approved; and the log\'s own word, a scope note, wherever it stands in the log, or a later section, that sets material aside, delegates it or puts it out of scope.',
      'Its brief dates each approved spec\'s approval where the old manifest does, to judge by against the dates the log\'s headings carry; where no date shows otherwise, the log came before the spec, but for a section appended after its approval, such as a review never folded in.',
      'unknown or unverified; a question it answers is answered by a decision citing its section, or, in a record carried in discovery, where nothing is decided, by a finding saying so.',
      'A point the log settled after the spec was approved, otherwise than the spec, is the log\'s, and current: its entry names the spec\'s section it departs from, and the two are not at odds.',
      'A corrigendum a cancelled unit wrote, one of the units its brief lists so, is no later answer for what that unit itself decided: a cancelled unit\'s decisions govern nothing, so the point stands as its other sources have it, and the corrigendum is carried, if at all, as a finding naming that unit, never as current. One recording what a unit not cancelled changed stays a later answer.',
      'Where an approved spec settles it, it is settled, unless the log settled it after the spec\'s approval, as above.',
    ].filter((rule) => !briefed.includes(rule)), []);
  });

  it('21.6.17: a finding a later answer overtakes is left in the log as a decision it replaces is, an entry it replaces in part carrying what still stands, and research and a topic set aside are held to their later answers too — each in what the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const briefed = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      'A decision or proposal a later answer replaces is left in the log, and so is a finding it overtakes — a figure, a behaviour or a fact it states otherwise, or a point it settles that the finding calls unknown or unverified;',
      'Where a later answer replaces part of a decision or a finding, the entry carries only what still stands.',
      'Research\'s findings and recommendations are held to their later answers as a discussion\'s decisions are, and so is a topic set aside, cancelled or postponed: its entries wait with it, current again once it returns.',
    ].filter((rule) => !briefed.includes(rule)), []);
  });

  it('21.6.5: a decision is given own only where a line shows who made the call, a recommendation, a proposal or a conclusion no line shows anyone taking up carried, and the line showing the person deciding or handing the call over quoted in its evidence — each in what the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const briefed = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      '`by` `claude`, `given` `own`, where a line shows Claude making the call itself;',
      'and where it shows no one deciding, `by` `claude`, `given` `carried`. A recommendation, a proposal or a conclusion no line shows anyone taking up — research\'s among them — shows no one deciding, whoever wrote it.',
      'The line showing the person deciding, or handing the call over, is quoted in the decision\'s `evidence`.',
    ].filter((rule) => !briefed.includes(rule)), []);
  });

  it('21.6.20: the entry naming sources at odds holds them as its at_odds, which the agents\' briefs draw; the session sends a contradiction the check names to the record citing a side of it, to name it and carry neither side as settled, or marks it where the record carries no side', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const briefed = text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics'));

    assert.deepStrictEqual([
      [
        'the record says so, and settles the point on neither side: an open question names the contradiction, cites both and holds the sections at odds as its `at_odds`, no decision answering it, nor any question part of it — and where each side is a finding, the findings name each other. It is a point no source settles, marked `raise` as the rules below say. A record naming a contradiction carries neither side of it as settled.',
        '- **`at_odds`**: on an open question naming sources at odds, never a finding or a decision, the sections at odds, `[{"path", "section"}, …]`, two at least, each one its cites name.',
      ].filter((rule) => !briefed.includes(rule)),
      [
        'on each other record citing one of those sections where no entry of it names the same, its `at_odds` holding those sections: the sections, each dated where its source shows when it was approved or written, those it cites and the records naming them.',
        'and judge first whether the contradiction stands. Where a later answer settles it — an approved spec, or a part of one, approved after the other side was written — it goes to each record naming it, and to the citing record where it carries the side the later answer replaced: a line in each one\'s settled file, as its brief names it, naming the section that settles it, and into its findings `Settled: {sections} settled by {section}, amend to agree` — the point is then no point at odds: no entry holds `at_odds` for it, its question is not marked `raise`, and the decision agreeing with the later answer answers it; the citing record keeps its answer only where it is the later one.',
        'Write every line a later answer owes, on each record naming the contradiction and on each record the check names it on that carries the replaced side, before any of them is amended: once no record names it, the check names it on none.',
        'Where the citing record\'s own log settled the point after the approval, its answer is its log\'s: mark it in `.cache/migrate/records/{unit}.at-odds.json` as its log\'s, as the check names the mark, and the record naming the contradiction keeps naming what its own sources hold.',
        'Where it stands and the citing record carries a side of the point at odds, write into its settled file, as the check names it, a line naming the sections at odds and the point, and that the record carries neither side as settled, and into its findings `Settled: {sections} at odds, amend to agree`. It is amended to carry neither side as settled, naming the contradiction as the record naming it does, its `at_odds` holding the same sections, and verified again. Where what it cites of them is not the point at odds, mark it there as the check names that mark.',
      ].filter((rule) => !text.includes(rule)),
    ], [[], []]);
  });

  it('a point a source leaves unmeasured is carried, set aside only where a later source measured it or made it moot, or a scope note, wherever it stands, puts it out of scope; a contradiction no later source settles is named — each in what the record holds, which the agents\' briefs draw', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');
    const holds = text.slice(text.indexOf('### What It Holds'), text.indexOf('### Its Shape'));

    assert.deepStrictEqual([
      '- **What no one measured.** A point a source names unmeasured, untested, unverified or left to check is carried: an open question, or a finding stating that it is unmeasured. A ruling sets it aside only where a later source measured it or made it moot, or a scope note of the log, wherever it stands, puts it out of scope.',
      '- **Sources at odds.** Where the sources, or the sections of one, contradict each other on a point, and no later source settles it, the record says so, and settles the point on neither side:',
    ].filter((rule) => !holds.includes(rule)), []);
  });

  it('the session runs the check after each agent returns, and takes the step it names on each record', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([
      'Run the check after each agent returns. It names each record\'s next step, `next`, as the rules below have it; take that step:\n\n```bash\nnode .claude/skills/ledger-engine/scripts/engine.cjs migrate check 079-records\n```',
    ].filter((rule) => !text.includes(rule)), []);
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
