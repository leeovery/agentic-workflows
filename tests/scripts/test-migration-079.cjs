'use strict';

// ---------------------------------------------------------------------------
// Tests for directive 079, the records (21.6, 21.10.7): its check
// (079-records.check.cjs), run through `engine migrate check`, and the rules
// it holds a topic's record to, which `ledger carry` holds the record to
// before it writes. One piece for each topic of each unit, completed,
// cancelled and building units among them, but a topic promoted to a
// cross-cutting unit, carried there; each done once its record is carried —
// an entry at least where its log holds anything, every entry citing a
// heading its file holds once — its log, its brief, an experiment's record,
// a spec kept as an asset, or the unit's spec.md as the code branch's HEAD
// holds its specs, where its building started — every subtopic its old map
// shows decided carried, every one still undecided and every thread still
// open carried by an open question, every review never folded in in its
// log, and every import come in from it linked. A record breaking a rule is
// refused at the carry, nothing written, and carries once mended; the
// directive's own example record carries. The directive's head is linted
// with every directive's (test-migration-directives.cjs); the carry's
// mechanics are test-engine-ledger-carry.cjs's.
//
// Layer: migration. World: the records directive's (migration-world.cjs),
// made once and copied for each test, and that world with every topic's
// record carried, made once and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, statePath, layout, writeState, readState, cleanupFixture } = harness;
const { SESSION, OLD_REVIEWS, recordsMigration, refusedUntouched } = require('./migration-world.cjs');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { composedPath, carriedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));
const DIRECTIVE = path.join(__dirname, '../../skills/leeway-migrate/scripts/migrations/079-records.md');

const RECORDS = '079-records';
const TOPICS = { one: 'topic', many: 'topics' };
const PIECES = ['fumi/billing', 'fumi/licensing', 'fumi/search', 'gone/gone', 'platform/auth', 'shop/weights'];

/** @param {string} unit @param {string} topic @param {string} section */
const logCite = (unit, topic, section) => ({ path: layout.topic(unit, topic, 'log.md'), section });

// Each topic's record, carried whole, as the directive composes it.
const GOOD = Object.freeze({
  'fumi.discovery.billing': [],
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
    {
      ref: 'f1', event: 'found', text: 'A query takes 12ms at p95.', how: 'measured by the latency experiment', known: 'measured', command: 'npm run bench', result: '12ms at p95', by: 'claude',
      cites: [{ path: layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'report.md'), section: 'Result' }],
    },
  ],
  'platform.discussion.auth': [
    { ref: 'q1', event: 'asked', text: 'How long does a session last?', by: 'claude', map_item: 'sessions', cites: [logCite('platform', 'auth', 'Sessions')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Thirty days.', why: 'The log settles it.', by: 'claude', given: 'carried', map_item: 'sessions',
      cites: [logCite('platform', 'auth', 'Sessions')], assets: [{ path: layout.assets('platform', 'sso.md'), status: 'reference' }],
    },
  ],
  'shop.discussion.weights': [
    { ref: 'q1', event: 'asked', text: 'How do ties break?', by: 'claude', map_item: 'tie-break', cites: [logCite('shop', 'weights', 'Tie Break')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By price.', why: 'The spec\'s corrigendum replaced by name.', by: 'claude', given: 'carried', map_item: 'tie-break', cites: [{ path: 'shop/spec.md', section: 'Corrigenda' }] },
  ],
  'gone.discussion.gone': [
    { ref: 'q1', event: 'asked', text: 'What caused it?', by: 'claude', map_item: 'cause', cites: [logCite('gone', 'gone', 'Cause')] },
  ],
});

/** @type {string} */
let dir;
afterEach(() => cleanupFixture(path.dirname(dir)));

/** The directive's check run. */
const checked = () => ok(dir, ['migrate', 'check', RECORDS], { env: SESSION });

/** Each piece not done, by its name, with what it lacks. */
const unfinished = () => Object.fromEntries(checked().unfinished.map(({ name, problems }) => [name, problems]));

/** The ledger carry of a topic's record, composed where the directive keeps it. @param {string} at @param {string} dotpath @param {unknown[]} entries */
function carryArgs(at, dotpath, entries) {
  const [unit, , topic] = dotpath.split('.');
  writeState(at, composedPath(unit, topic), JSON.stringify({ entries }));
  return ['ledger', 'carry', dotpath, '--file', statePath(at, composedPath(unit, topic))];
}

/** A topic's record carried. @param {string} dotpath @param {unknown[]} entries @param {string} [at] */
const carry = (dotpath, entries, at = dir) => ok(at, carryArgs(at, dotpath, entries), { env: SESSION });

/** A topic's record refused at the carry, nothing written: the refusal. @param {string} dotpath @param {unknown[]} entries */
const refused = (dotpath, entries) => refusedUntouched(dir, carryArgs(dir, dotpath, entries), { env: SESSION }, harness);

/** fumi's search log with its review never folded in appended, as the directive folds it. @param {string} [at] */
function foldReview(at = dir) {
  const log = layout.topic('fumi', 'search', 'log.md');
  writeState(at, log, `${readState(at, log)}\n## Review review-001, never folded in\n\n${OLD_REVIEWS.reports['review-001']}`);
}

/** The refusal of a record breaking the rules, its problems listed. @param {string} unit @param {string} topic @param {string[]} problems */
const breaks = (unit, topic, problems) => `ledger carry: ${unit}'s ${topic} breaks the records directive's rules, so nothing is carried — ${problems.join('; ')}`;

/** @type {string|null} */
let carriedTemplate = null;

/** The world with its review folded in and every topic's good record carried, at a fresh folder. */
function carriedWorld() {
  if (carriedTemplate === null) {
    carriedTemplate = recordsMigration(path.join(templateFolder('records-carried-'), 'fumi'));
    foldReview(carriedTemplate);
    for (const [dotpath, entries] of Object.entries(GOOD)) carry(dotpath, entries, carriedTemplate);
  }
  return copyWorld(carriedTemplate, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi'));
}

describe('the pieces (21.6.2)', () => {
  it('every topic of every unit is a piece — completed, cancelled, building and never started among them, a topic promoted to a cross-cutting unit only there — none done before its record is carried', () => {
    dir = recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi'));

    assert.deepStrictEqual(checked(), {
      ok: true, directive: RECORDS, passed: false, done: 0, of: 6, counts: TOPICS, unfinished: PIECES.map((name) => ({ name, problems: ['has no record yet'] })),
    });
  });

  it('21.S20, 21.S21, 21.S22, 21.S23, 21.S44: passes once each topic\'s record is carried — citing its log, brief, experiment, grouped spec kept as an asset and the spec its building drew on, carried over where no one is shown deciding, a measurement with its command, the open map items and threads as open questions — with its review folded in', () => {
    dir = carriedWorld();

    assert.deepStrictEqual(checked(), { ok: true, directive: RECORDS, passed: true, done: 6, of: 6, counts: TOPICS, unfinished: [] });
  });
});

describe('a record breaking a rule is refused at the carry, nothing written, and carries once mended', () => {
  beforeEach(() => { dir = recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi')); });

  /** The piece carried and done. @param {string} dotpath */
  function mended(dotpath) {
    carry(dotpath, GOOD[dotpath]);
    const [unit, , topic] = dotpath.split('.');
    assert.strictEqual(unfinished()[`${unit}/${topic}`], undefined);
  }

  it('an entry citing nothing, a file the state lacks, a heading its file lacks, or one its file holds more than once (21.12.7)', () => {
    assert.strictEqual(refused('gone.discussion.gone', [
      { ...GOOD['gone.discussion.gone'][0], cites: [] },
      { ref: 'q2', event: 'asked', text: 'Was it a timeout?', by: 'claude', cites: [{ path: 'gone/topics/gone/notes.md', section: 'Cause' }] },
      { ref: 'q3', event: 'asked', text: 'Was it the network?', by: 'claude', cites: [logCite('gone', 'gone', 'Causes')] },
    ]), breaks('gone', 'gone', [
      'entry q1 cites nothing', 'entry q2 cites gone/topics/gone/notes.md, which the state does not hold', 'entry q3 cites "Causes" in gone/topics/gone/log.md, which has no such heading',
    ]));
    foldReview();
    const [q1, ...rest] = GOOD['fumi.discussion.search'];
    assert.strictEqual(refused('fumi.discussion.search', [{ ...q1, cites: [logCite('fumi', 'search', 'Context')] }, ...rest]),
      breaks('fumi', 'search', ['entry q1 cites "Context" in fumi/topics/search/log.md, which holds that heading 2 times — a cite names a heading its file holds once']));

    mended('gone.discussion.gone');
    mended('fumi.discussion.search');
  });

  it('21.S36: a subtopic its old map shows decided that no entry names, and one still open or deferred, and a thread still digging, that no open question names', () => {
    foldReview();
    const bare = GOOD['fumi.discussion.search'].map(({ map_item: _, thread: __, ...entry }) => entry);
    const answered = [...GOOD['fumi.discussion.search'], { ref: 'd2', event: 'decided', answers: 'q2', text: 'Off by one letter.', why: 'The log says so.', by: 'claude', given: 'carried', map_item: 'typo-tolerance', cites: [logCite('fumi', 'search', 'Typo Tolerance')] }];

    assert.deepStrictEqual([refused('fumi.discussion.search', bare), refused('fumi.discussion.search', answered)], [
      breaks('fumi', 'search', [
        'ranking is decided on its map, and no entry carries it', 'typo-tolerance is still open on its map, and no open question carries it',
        'synonyms is deferred on its map, and no open question carries it', 'the thread index-size is still digging in its research, and no open question carries it',
      ]),
      breaks('fumi', 'search', ['typo-tolerance is still open on its map, and no open question carries it']),
    ]);
    mended('fumi.discussion.search');
  });

  it('reads the old map as the code branch\'s HEAD holds it, not as the working tree does', () => {
    const manifest = path.join(dir, '.workflows/shop/manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, 'utf8')), phases: {} }));

    assert.strictEqual(refused('shop.discussion.weights', GOOD['shop.discussion.weights'].map(({ map_item: _, ...entry }) => entry)),
      breaks('shop', 'weights', ['tie-break is decided on its map, and no entry carries it']));
  });

  it('21.S19: a review the old agent store holds never folded in, until its report is in its log; one incorporated asks nothing', () => {
    assert.strictEqual(refused('fumi.discussion.search', GOOD['fumi.discussion.search']), breaks('fumi', 'search', ['review-001, a review never folded in, is not in its log']));
    foldReview();
    mended('fumi.discussion.search');
  });

  it('an import come in from the topic that no entry links', () => {
    assert.strictEqual(refused('fumi.discussion.licensing', GOOD['fumi.discussion.licensing'].map(({ assets: _, ...entry }) => entry)),
      breaks('fumi', 'licensing', ['fumi/assets/pricing.md came in from discussion/licensing, and no entry links it']));
    mended('fumi.discussion.licensing');
  });

  it('an empty record, where the topic\'s log holds anything; a topic with no log carries one', () => {
    assert.strictEqual(refused('shop.discussion.weights', []), breaks('shop', 'weights', ['its record is empty, and its log is not']));
    mended('shop.discussion.weights');
    mended('fumi.discovery.billing');
  });

  it('the unit\'s spec.md where its building never started; where it started, a heading its specs on HEAD lack, or hold more than once', () => {
    const licensing = GOOD['fumi.discussion.licensing'];
    assert.strictEqual(refused('fumi.discussion.licensing', [...licensing.slice(0, 3), { ...licensing[3], cites: [{ path: 'fumi/spec.md', section: 'Corrigenda' }] }]),
      breaks('fumi', 'licensing', ['entry d2 cites fumi/spec.md, which the state does not hold']));
    assert.strictEqual(refused('shop.discussion.weights', [{ ...GOOD['shop.discussion.weights'][0], cites: [{ path: 'shop/spec.md', section: 'Pricing' }, { path: 'shop/spec.md', section: 'Detail' }] }]),
      breaks('shop', 'weights', ['entry q1 cites "Pricing" in shop/spec.md, which has no such heading', 'entry q1 cites "Detail" in shop/spec.md, which holds that heading 2 times — a cite names a heading its file holds once']));

    mended('fumi.discussion.licensing');
    mended('shop.discussion.weights');
  });

  it('a topic promoted to a cross-cutting unit: the unit it went to carries it', () => {
    assert.strictEqual(refused('fumi.discussion.auth', GOOD['platform.discussion.auth']), 'ledger carry: fumi\'s auth was promoted to platform, which carries its record');
    mended('platform.discussion.auth');
  });
});

describe('what the check reads once a record is carried', () => {
  it('a section a later edit took from its file fails its entry; a record kept but not in the ledger, a session dying between the two (21.10.9), and a kept record of no entries beside a log that holds some, fail their topics', () => {
    dir = carriedWorld();
    writeState(dir, layout.topic('gone', 'gone', 'log.md'), '## Discussion\n\nA race.\n');
    writeState(dir, carriedPath('platform', 'auth'), JSON.stringify({ unit: 'platform', phase: 'discussion', topic: 'auth', entries: [{ ref: 'q1', id: 'aaaaaaaaaaaaaaaaaaaaa', map_item: 'sessions', thread: null }] }));
    writeState(dir, carriedPath('shop', 'weights'), JSON.stringify({ unit: 'shop', phase: 'discussion', topic: 'weights', entries: [] }));

    assert.deepStrictEqual(unfinished(), {
      'gone/gone': ['entry q1 cites "Cause" in gone/topics/gone/log.md, which has no such heading'],
      'platform/auth': ['its record never reached the ledger'],
      'shop/weights': ['its record is empty, and its log is not'],
    });
  });
});

describe('the directive\'s example record, frozen with 079', () => {
  it('carries as the directive writes it, its placeholders filled, and its topic is done', () => {
    dir = recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi'));
    const fills = {
      unit: 'fumi', topic: 'licensing', subtopic: 'trial-length', heading: 'Trial Length', file: 'pricing.md', experiment: 'E2-trial', 'report heading': 'Result',
      question: 'How long is the trial?', answer: 'Fourteen days.', why: 'The log settles it.', fact: 'A week converts as well.', how: 'measured by the trial experiment', command: 'npm run trial', result: 'as well',
    };
    const example = /```json\n([^]*?)\n```/.exec(fs.readFileSync(DIRECTIVE, 'utf8'))?.[1] ?? '';
    const { entries } = JSON.parse(example.replace(/\{([a-z ]+)\}/g, (whole, name) => fills[/** @type {keyof typeof fills} */ (name)] ?? whole));

    carry('fumi.discussion.licensing', entries);

    assert.strictEqual(unfinished()['fumi/licensing'], undefined);
  });
});
