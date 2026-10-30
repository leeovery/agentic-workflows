'use strict';

// ---------------------------------------------------------------------------
// Tests for directive 079, the records (21.6, 21.10.7): its check
// (079-records.check.cjs), run through `engine migrate check`, over records
// carried through `ledger carry`. One piece for each topic of each unit,
// completed, cancelled and building units among them; each done once its
// record is carried, every entry citing a section that exists — its log,
// its brief, an experiment's record, its spec kept as an asset, or the
// unit's spec.md as the code branch's HEAD holds its specs — every subtopic
// its old map shows decided or still open carried, every review never
// folded in in its log, and every import come in from it linked. The
// directive's head is linted with every directive's
// (test-migration-directives.cjs); the carry is test-engine-ledger-carry.cjs's.
//
// Layer: migration. World: the records directive's (migration-world.cjs),
// made once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, statePath, layout, writeState, readState, cleanupFixture } = require('./engine-harness.cjs');
const { SESSION, OLD_REVIEWS, recordsMigration } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { composedPath, carriedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

const RECORDS = '079-records';
const TOPICS = { one: 'topic', many: 'topics' };

/** @param {string} unit @param {string} topic @param {string} section */
const logCite = (unit, topic, section) => ({ path: layout.topic(unit, topic, 'log.md'), section });

// Each topic's record, carried whole, as the directive composes it.
const GOOD = Object.freeze({
  'fumi.discussion.licensing': [
    { ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person', map_item: 'trial-length', cites: [logCite('fumi', 'licensing', 'Trial Length')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Fourteen days.', why: 'The person set it.', by: 'person', map_item: 'trial-length',
      cites: [logCite('fumi', 'licensing', 'Decision'), { path: layout.topic('fumi', 'licensing', 'brief.md'), section: 'Licensing' }],
      assets: [{ path: layout.assets('fumi', 'pricing.md'), status: 'reference' }],
    },
    { ref: 'q2', event: 'asked', text: 'Does the spec hold the trial at thirty days?', by: 'claude', cites: [{ path: layout.assets('fumi', 'specs', 'licensing.md'), section: 'Corrigenda' }] },
    { ref: 'd2', event: 'decided', answers: 'q2', text: 'No: its corrigendum holds it at fourteen.', why: 'The corrigendum says so.', by: 'claude', given: 'carried', cites: [{ path: layout.assets('fumi', 'specs', 'licensing.md'), section: 'Corrigenda' }] },
  ],
  'fumi.discussion.search': [
    { ref: 'q1', event: 'asked', text: 'How are results ranked?', by: 'claude', map_item: 'ranking', cites: [logCite('fumi', 'search', 'Ranking')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By recency.', why: 'The log settles it, whoever said it.', by: 'claude', given: 'carried', map_item: 'ranking', cites: [logCite('fumi', 'search', 'Ranking')] },
    { ref: 'q2', event: 'asked', text: 'How tolerant of typos is search?', by: 'claude', map_item: 'typo-tolerance', cites: [logCite('fumi', 'search', 'Typo Tolerance')] },
    {
      ref: 'f1', event: 'found', text: 'A query takes 12ms at p95.', how: 'measured by the latency experiment', known: 'measured', command: 'npm run bench', result: '12ms at p95', by: 'claude',
      cites: [{ path: layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'report.md'), section: 'Result' }],
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
beforeEach(() => { dir = recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-079-')), 'fumi')); });
afterEach(() => cleanupFixture(path.dirname(dir)));

/** The directive's check run. */
const checked = () => ok(dir, ['migrate', 'check', RECORDS], { env: SESSION });

/** Each piece not done, by its name, with what it lacks. */
const unfinished = () => Object.fromEntries(checked().unfinished.map(({ name, problems }) => [name, problems]));

/**
 * A topic's record composed where the directive keeps it, then carried.
 * @param {string} dotpath @param {Record<string, unknown>[]} entries
 */
function carry(dotpath, entries) {
  const [unit, , topic] = dotpath.split('.');
  writeState(dir, composedPath(unit, topic), JSON.stringify({ entries }));
  return ok(dir, ['ledger', 'carry', dotpath, '--file', statePath(dir, composedPath(unit, topic))], { env: SESSION });
}

/** fumi's search log with its review never folded in appended, as the directive folds it. */
function foldReview() {
  const log = layout.topic('fumi', 'search', 'log.md');
  writeState(dir, log, `${readState(dir, log)}\n## Review review-001, never folded in\n\n${OLD_REVIEWS.reports['review-001']}`);
}

/** Every topic's good record carried, but those named. @param {string[]} [but] */
function carryGood(but = []) {
  for (const [dotpath, entries] of Object.entries(GOOD)) if (!but.includes(dotpath)) carry(dotpath, entries);
}

describe('the pieces (21.6.2)', () => {
  it('every topic of every unit is a piece — completed, cancelled and building units among them — none done before its record is carried', () => {
    assert.deepStrictEqual(checked(), {
      ok: true, directive: RECORDS, passed: false, done: 0, of: 4, counts: TOPICS,
      unfinished: ['fumi/licensing', 'fumi/search', 'gone/gone', 'shop/weights'].map((name) => ({ name, problems: ['has no record yet'] })),
    });
  });

  it('21.S20, 21.S21, 21.S22, 21.S23, 21.S44: passes once each topic\'s record is carried — citing its log, brief, experiment, kept spec and the spec its building drew on, carried over where no one is shown deciding, a measurement with its command — with its review folded in', () => {
    foldReview();
    carryGood();

    assert.deepStrictEqual(checked(), { ok: true, directive: RECORDS, passed: true, done: 4, of: 4, counts: TOPICS, unfinished: [] });
  });
});

describe('what a topic lacks', () => {
  it('21.S36: a subtopic its old map shows decided, or still open, that no entry names fails its topic, each named; a deferred one asks nothing', () => {
    foldReview();
    carryGood(['fumi.discussion.search']);
    carry('fumi.discussion.search', GOOD['fumi.discussion.search'].map(({ map_item: _, ...entry }) => entry));

    assert.deepStrictEqual(unfinished(), {
      'fumi/search': ['ranking is decided on its map, and no entry carries it', 'typo-tolerance is still open on its map, and no entry carries it'],
    });
  });

  it('reads the old map as the code branch\'s HEAD holds it, not as the working tree does', () => {
    const manifest = path.join(dir, '.workflows/shop/manifest.json');
    fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, 'utf8')), phases: {} }));
    carryGood(['shop.discussion.weights']);
    carry('shop.discussion.weights', [{ ref: 'q1', event: 'asked', text: 'How do ties break?', by: 'claude', cites: [logCite('shop', 'weights', 'Tie Break')] }]);

    assert.deepStrictEqual(unfinished()['shop/weights'], ['tie-break is decided on its map, and no entry carries it']);
  });

  it('an entry citing nothing, a file the state lacks, or a heading its file lacks fails, each named by its ref', () => {
    foldReview();
    carryGood(['gone.discussion.gone']);
    carry('gone.discussion.gone', [
      { ...GOOD['gone.discussion.gone'][0], cites: [] },
      { ref: 'q2', event: 'asked', text: 'Was it a timeout?', by: 'claude', cites: [{ path: 'gone/topics/gone/notes.md', section: 'Cause' }] },
      { ref: 'q3', event: 'asked', text: 'Was it the network?', by: 'claude', cites: [logCite('gone', 'gone', 'Network')] },
    ]);

    assert.deepStrictEqual(unfinished(), {
      'gone/gone': ['entry q1 cites nothing', 'entry q2 cites gone/topics/gone/notes.md, which the state does not hold', 'entry q3 cites "Network" in gone/topics/gone/log.md, which has no such heading'],
    });
  });

  it('a section cited as the unit\'s spec.md, while the state holds none, is a heading of its specs on the code branch\'s HEAD — and of none where it has no spec there', () => {
    foldReview();
    carryGood(['shop.discussion.weights', 'gone.discussion.gone']);
    carry('shop.discussion.weights', [{ ...GOOD['shop.discussion.weights'][0], cites: [{ path: 'shop/spec.md', section: 'Pricing' }] }]);
    carry('gone.discussion.gone', [{ ...GOOD['gone.discussion.gone'][0], cites: [{ path: 'gone/spec.md', section: 'Cause' }] }]);

    assert.deepStrictEqual(unfinished(), {
      'gone/gone': ['entry q1 cites "Cause" in gone/spec.md, which has no such heading'],
      'shop/weights': ['entry q1 cites "Pricing" in shop/spec.md, which has no such heading'],
    });
  });

  it('21.S19: a review the old agent store holds never folded in fails its topic until its report is in its log; one incorporated asks nothing', () => {
    carryGood();

    assert.deepStrictEqual(unfinished(), { 'fumi/search': ['review-001, a review never folded in, is not in its log'] });
    foldReview();
    assert.strictEqual(checked().passed, true);
  });

  it('an import come in from the topic that no entry of its record links fails it', () => {
    foldReview();
    carryGood(['fumi.discussion.licensing']);
    carry('fumi.discussion.licensing', GOOD['fumi.discussion.licensing'].map(({ assets: _, ...entry }) => entry));

    assert.deepStrictEqual(unfinished(), { 'fumi/licensing': ['fumi/assets/pricing.md came in from discussion/licensing, and no entry links it'] });
  });

  it('21.10.9: a record kept but not in the ledger — a session died between the two — fails its topic', () => {
    foldReview();
    carryGood(['gone.discussion.gone']);
    writeState(dir, carriedPath('gone', 'gone'), JSON.stringify({ unit: 'gone', phase: 'discussion', topic: 'gone', entries: [{ ref: 'q1', id: 'aaaaaaaaaaaaaaaaaaaaa', map_item: 'cause' }] }));

    assert.deepStrictEqual(unfinished(), { 'gone/gone': ['its record never reached the ledger'] });
  });
});
