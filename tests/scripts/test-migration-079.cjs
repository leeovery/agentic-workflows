'use strict';

// ---------------------------------------------------------------------------
// Tests for directive 079, the records (21.6, 21.10.7): its check
// (079-records.check.cjs), run through `engine migrate check`, and the rules
// it holds a topic's record to, which `ledger carry` holds the record to
// before it writes. One piece for each topic of each unit, completed,
// cancelled, building and never-started ones among them, but a topic
// promoted to a cross-cutting unit, carried there, its research's threads
// read where it was promoted from; each done once its record is carried —
// an entry at least where its log holds anything, and every import come in
// from it whose file the state holds linked, a unit of one topic's from its
// discovery among them and an epic's from its discovery as a whole asked of
// none; a record of none keeping every rule but the cites; every entry
// citing a heading its file holds once, in a file of its topic's own or the
// unit's — its log and the reviews the move folded into it, its brief, an
// experiment's record, the unit's assets, or its spec.md as the code
// branch's HEAD holds its specs, where its building started — never the
// cache, another topic's or its mail; every subtopic its old map shows
// decided carried, one entry settling several, every one still undecided
// and every thread still open carried by an open question. A record
// breaking a rule is refused at the carry, the refusal written beside the
// record and nothing else, and leaves nothing in the way of the record
// mended. Once it passes, the check lists each point marked to raise on a
// live topic until the conversation raises it. `.workflows/` is read in the
// main checkout, and the record where the state keeps it, from a linked
// worktree too. The check rests on the record the carry kept and its ids in
// the ledger, and reads what the real move (078) writes. The directive's
// own example record carries, and the directive spells no path from the
// session's folder. The directive's head is linted with every directive's
// (test-migration-directives.cjs); the carry's mechanics are
// test-engine-ledger-carry.cjs's.
//
// Layer: migration. World: the records directive's (migration-world.cjs),
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
const { ok, okSectionsAsync, git, statePath, layout, writeState, readState, createFile, initRepo, commitAll, cleanupFixture } = harness;
const { SESSION, recordsMigration, refusedKeeping, refusedUntouched } = require('./migration-world.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { composedPath, carriedPath, findingsPath, refusedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));
const DIRECTIVE = path.join(__dirname, '../../skills/leeway-migrate/scripts/migrations/079-records.md');
const MOVE = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');

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
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Thirty days, the tokens renewed with each session.', why: 'The log settles it.', by: 'claude', given: 'carried', map_item: ['sessions', 'tokens'],
      cites: [logCite('platform', 'auth', 'Sessions')], assets: [{ path: layout.assets('platform', 'sso.md'), status: 'reference' }],
    },
    { ref: 'q2', event: 'asked', text: 'When do tokens expire?', by: 'claude', thread: 'token-expiry', cites: [logCite('platform', 'auth', 'Sessions')] },
  ],
  'shop.discussion.weights': [
    { ref: 'q1', event: 'asked', text: 'How do ties break?', by: 'claude', map_item: 'tie-break', cites: [logCite('shop', 'weights', 'Tie Break')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By price.', why: 'The spec\'s corrigendum replaced by name.', by: 'claude', given: 'carried', map_item: 'tie-break', cites: [{ path: 'shop/spec.md', section: 'Corrigenda' }] },
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

/** The ledger carry of a topic's record, composed where the directive keeps it. @param {string} at @param {string} dotpath @param {unknown[]} entries */
function carryArgs(at, dotpath, entries) {
  const [unit, , topic] = dotpath.split('.');
  writeState(at, composedPath(unit, topic), JSON.stringify({ entries }));
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
  const [unit, , topic] = dotpath.split('.');
  return refusedKeeping(dir, carryArgs(dir, dotpath, entries), refusedPath(unit, topic));
}

/** The refusal of a record breaking the rules, its problems listed. @param {string} unit @param {string} topic @param {string[]} problems */
const breaks = (unit, topic, problems) => `ledger carry: ${unit}'s ${topic} breaks the records directive's rules, so nothing is carried — ${problems.join('; ')}`;

/** search's record with neither its map items nor its thread named. */
const bareSearch = () => GOOD['fumi.discussion.search'].map(({ map_item: _, thread: __, ...entry }) => entry);

/** What search's bare record leaves uncarried. */
const SEARCH_UNCARRIED = Object.freeze([
  'ranking is decided on its map, and no entry carries it', 'typo-tolerance is still open on its map, and no open question carries it',
  'synonyms is deferred on its map, and no open question carries it', 'the thread index-size is still digging in its research, and no open question carries it',
]);

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

  it('an entry citing nothing, a file the state lacks, a heading its file lacks, or one its file holds more than once (21.12.7)', () => {
    assert.strictEqual(refused('gone.discussion.gone', [
      { ...GOOD['gone.discussion.gone'][0], cites: [] },
      { ref: 'q2', event: 'asked', text: 'Was it a timeout?', by: 'claude', cites: [{ path: 'gone/topics/gone/experiments/E9-load/report.md', section: 'Cause' }] },
      { ref: 'q3', event: 'asked', text: 'Was it the network?', by: 'claude', cites: [logCite('gone', 'gone', 'Causes')] },
    ]), breaks('gone', 'gone', [
      'entry q1 cites nothing', 'entry q2 cites gone/topics/gone/experiments/E9-load/report.md, which the state does not hold', 'entry q3 cites "Causes" in gone/topics/gone/log.md, which has no such heading',
    ]));
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    assert.strictEqual(refused('fumi.discussion.search', [{ ...q1, cites: [logCite('fumi', 'search', 'Context')] }, ...rest]),
      breaks('fumi', 'search', ['entry q1 cites "Context" in fumi/topics/search/log.md, which holds that heading 2 times — a cite names a heading its file holds once']));
  });

  it('a cite of a file neither the topic\'s own nor the unit\'s: the cache, another topic\'s log, its own mail', () => {
    writeState(dir, findingsPath('fumi', 'search'), '## Ranking\n\nDropped.\n');
    writeState(dir, layout.topic('fumi', 'search', 'mail', '001-seats.md'), '### Seats\n');
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    const citing = (/** @type {string} */ cited, /** @type {string} */ section) => ({ ...q1, cites: [{ path: cited, section }] });
    const none = (/** @type {string} */ cited) => `entry q1 cites ${cited}, which is none of its topic's log, brief or experiments, nor the unit's assets or spec.md`;

    assert.deepStrictEqual([
      refused('fumi.discussion.search', [citing(findingsPath('fumi', 'search'), 'Ranking'), ...rest]),
      refused('fumi.discussion.search', [citing(layout.topic('fumi', 'licensing', 'log.md'), 'Trial Length'), ...rest]),
      refused('fumi.discussion.search', [citing(layout.topic('fumi', 'search', 'mail', '001-seats.md'), 'Seats'), ...rest]),
    ], [
      breaks('fumi', 'search', [none(findingsPath('fumi', 'search'))]),
      breaks('fumi', 'search', [none(layout.topic('fumi', 'licensing', 'log.md'))]),
      breaks('fumi', 'search', [none(layout.topic('fumi', 'search', 'mail', '001-seats.md'))]),
    ]);
  });

  it('21.S36: a subtopic its old map shows decided that no entry names, and one still open or deferred, and a thread still digging, that no open question names', () => {
    const answered = [...GOOD['fumi.discussion.search'], { ref: 'd2', event: 'decided', answers: 'q2', text: 'Off by one letter.', why: 'The log says so.', by: 'claude', given: 'carried', map_item: 'typo-tolerance', cites: [logCite('fumi', 'search', 'Typo Tolerance')] }];

    assert.strictEqual(refused('fumi.discussion.search', answered), breaks('fumi', 'search', ['typo-tolerance is still open on its map, and no open question carries it']));
  });

  it('one decision settles two subtopics by naming both; naming one leaves the other uncarried', () => {
    const [q1, d1, q2] = GOOD['platform.discussion.auth'];

    assert.strictEqual(refused('platform.discussion.auth', [{ ...q1, map_item: 'sessions' }, { ...d1, map_item: 'sessions' }, q2]),
      breaks('platform', 'auth', ['tokens is decided on its map, and no entry carries it']));
  });

  it('a topic promoted to a cross-cutting unit: its research\'s threads, which stayed with the epic, asked of the unit it went to; the epic refused it', () => {
    const [q1, d1] = GOOD['platform.discussion.auth'];

    assert.strictEqual(refused('platform.discussion.auth', [q1, d1]), breaks('platform', 'auth', ['the thread token-expiry is still open in its research, and no open question carries it']));
    assert.strictEqual(refusedUntouched(dir, carryArgs(dir, 'fumi.discussion.auth', GOOD['platform.discussion.auth']), { env: SESSION }, harness),
      'ledger carry: fumi\'s auth was promoted to platform, which carries its record');
  });

  it('reads the old map as the code branch\'s HEAD holds it, not as the working tree does', () => {
    const manifest = path.join(dir, '.workflows/shop/manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, 'utf8')), phases: {} }));

    assert.strictEqual(refused('shop.discussion.weights', GOOD['shop.discussion.weights'].map(({ map_item: _, ...entry }) => entry)),
      breaks('shop', 'weights', ['tie-break is decided on its map, and no entry carries it']));
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
    assert.strictEqual(refused('shop.discussion.weights', []), breaks('shop', 'weights', ['its record is empty, and its log is not', 'tie-break is decided on its map, and no entry carries it']));
    carry('fumi.discovery.support', []);
  });

  it('an empty record of a topic with no log still carries its old map and its threads (21.12.7, 21.6.7)', () => {
    fs.rmSync(statePath(dir, layout.topic('fumi', 'search', 'log.md')));

    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', SEARCH_UNCARRIED));
  });

  it('the unit\'s spec.md where its building never started; where it started, a heading its specs on HEAD lack, or hold more than once', () => {
    const licensing = GOOD['fumi.discussion.licensing'];
    assert.strictEqual(refused('fumi.discussion.licensing', [...licensing.slice(0, 3), { ...licensing[3], cites: [{ path: 'fumi/spec.md', section: 'Corrigenda' }] }]),
      breaks('fumi', 'licensing', ['entry d2 cites fumi/spec.md, which the state does not hold']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...GOOD['shop.discussion.weights'][0], cites: [{ path: 'shop/spec.md', section: 'Pricing' }, { path: 'shop/spec.md', section: 'Detail' }] }]),
      breaks('shop', 'weights', ['entry q1 cites "Pricing" in shop/spec.md, which has no such heading', 'entry q1 cites "Detail" in shop/spec.md, which holds that heading 2 times — a cite names a heading its file holds once']));
  });
});

describe('the points to raise (21.6.10, 21.S25)', () => {
  it('once the check passes, it lists each open question marked to raise on a live topic, until this conversation raises it; none on a cancelled unit\'s', async () => {
    dir = world();
    const point = { ref: 'q3', event: 'asked', text: 'Does the trial need a card?', by: 'claude', raise: true, cites: [logCite('fumi', 'licensing', 'Trial Length')] };
    const [cause] = GOOD['gone.discussion.gone'];
    for (const [dotpath, entries] of Object.entries(GOOD)) {
      if (dotpath === 'fumi.discussion.licensing') carry(dotpath, [...entries, point]);
      else if (dotpath === 'gone.discussion.gone') carry(dotpath, [{ ...cause, raise: true }]);
      else carry(dotpath, entries);
    }
    const id = JSON.parse(readState(dir, carriedPath('fumi', 'licensing'))).entries.find((/** @type {{ref: string}} */ entry) => entry.ref === 'q3').id;

    const [listed] = checked().raise;
    assert.deepStrictEqual([listed.place, id.startsWith(listed.answers), listed.text, checked().raise.length], ['fumi.discussion.licensing', true, point.text, 1]);

    await okSectionsAsync(dir, ['raise', listed.place, '--answers', listed.answers, '--fact'], {
      env: SESSION, stdin: JSON.stringify({ question: point.text, rows: [], mechanism: 'The log says nothing of a card.', product_wide: false }),
    });

    assert.deepStrictEqual(checked().raise, []);
  });
});

describe('from a linked worktree (4.1.4)', () => {
  it('the carry reads the record where the state keeps it, and with the check reads `.workflows/` in the main checkout — its old map on HEAD — not the worktree\'s branch, whose map differs; carried, what was said beside the record is cleared', () => {
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
      'shop/weights': ['its record is empty, and its log is not', 'tie-break is decided on its map, and no entry carries it'],
    });
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
    assert.ok(readState(dir, layout.topic('fumi', 'search', 'log.md')).endsWith('\n## Review review-001, never folded in\n\n### F1: Ranking ties\n\nTwo results of one age have no order.\n'));
    assert.strictEqual(refused('fumi.discussion.search', []), breaks('fumi', 'search', [
      'its record is empty, and its log is not', 'ranking is decided on its map, and no entry carries it', 'typo-tolerance is still open on its map, and no open question carries it',
      'the thread index-size is still digging in its research, and no open question carries it', 'fumi/assets/notes.md came in from discussion/search, and no entry links it',
    ]));
  });
});

describe('the directive\'s example record, frozen with 079', () => {
  it('carries as the directive writes it, its placeholders filled, and its topic is done', () => {
    dir = world();
    const fills = {
      unit: 'fumi', topic: 'licensing', subtopic: 'trial-length', heading: 'Trial Length', file: 'pricing.md', experiment: 'E2-trial', 'report heading': 'Result',
      question: 'How long is the trial?', answer: 'Fourteen days.', why: 'The log settles it.', fact: 'A week converts as well.', how: 'measured by the trial experiment', command: 'npm run trial', result: 'as well',
    };
    const example = /```json\n([^]*?)\n```/.exec(fs.readFileSync(DIRECTIVE, 'utf8'))?.[1] ?? '';
    const { entries } = JSON.parse(example.replace(/\{([a-z ]+)\}/g, (whole, name) => fills[/** @type {keyof typeof fills} */ (name)] ?? whole));

    carry('fumi.discussion.licensing', entries);

    assert.strictEqual(unfinished()['fumi/licensing'], undefined);
  });

  it('spells no path from the session\'s folder: every state path is the brief\'s or the engine\'s, the carry naming the topic alone', () => {
    const text = fs.readFileSync(DIRECTIVE, 'utf8');

    assert.deepStrictEqual([text.includes('.leeway/'), /ledger carry \{unit\}\.\{phase\}\.\{topic\}\n/.test(text)], [false, true]);
  });
});
