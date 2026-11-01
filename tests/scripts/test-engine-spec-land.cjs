'use strict';

// ---------------------------------------------------------------------------
// The spec's land (leeway-engine/scripts/domain/spec-land.cjs): `engine spec
// land <unit>`, and the trace and the unit's entries it reads
// (spec-trace.cjs, unit-entries.cjs). A spec whose statements trace — each
// cite a current entry of the unit, on a decided topic or at its own level,
// or made there of another unit's; a builder's line citing a "don't care"
// decision, or none — is committed alone on the state branch with the files
// it links in the assets, answering its statements, none invented, and every
// section changed (11.S3); a statement that does not trace is listed with
// why and refuses nothing (11.S4's mechanical half, 11.4.2); a second land
// answers the sections changed since the first, and one with nothing changed
// commits nothing; and each refusal — no unit, a concluded spec (11.9.1), a
// unit `enter specification` refuses, a quick-fix, no `spec.md`, a spec its
// grammar refuses, an argv of another shape — writes and commits nothing,
// the file left as written (the grammar's own faults are
// test-spec-sections.cjs's). The unit's entries: the current entries placed
// in it, by id, each with its short id, kind, standing and line.
//
// Layer: verb. World, built once and copied: an epic, `payments`, its topics
// `cards` and `refunds` decided, `wallets` postponed and `disputes`
// cancelled, each with entries written through the ledger's verbs — on
// `cards` a decision replaced, a "don't care" decision and a finding; on
// `refunds` a question moved to `cards`; a gap decided at the spec and a
// finding at discovery, each at the unit's level; and a feature, `billing`,
// with two decisions, one replaced from the payments spec.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, stateGit, lastMessage, touched, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { unitEntries } = require(path.join(SCRIPTS, 'domain/unit-entries.cjs'));
const { specEntryRefusal } = require(path.join(SCRIPTS, 'domain/spec-entry.cjs'));

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });

/** A topic on the map, set aside as `aside` says. @param {number} order @param {Record<string, boolean>} [aside] */
const mapped = (order, aside = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...aside });

/** The epic's manifest, its topics' discussions each as `status` gives it, and set aside as `aside` gives. @param {string} dir @param {Record<string, string>} status @param {Record<string, Record<string, boolean>>} [aside] @param {Record<string, unknown>} [more] */
function payments(dir, status, aside = {}, more = {}) {
  const topics = ['cards', 'refunds', 'wallets', 'disputes'];
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: Object.fromEntries(topics.map((topic, at) => [topic, mapped(at + 1, aside[topic])])) },
      discussion: { items: Object.fromEntries(topics.map((topic) => [topic, { status: status[topic] ?? 'completed' }])) },
    },
    ...more,
  });
}

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

const world = fixtureFrom('spec-land-', (dir) => {
  payments(dir, { cards: 'in-progress', refunds: 'in-progress', wallets: 'in-progress', disputes: 'in-progress' });
  createManifest(dir, 'billing', { phases: { discussion: { items: { billing: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const ask = (/** @type {string} */ at, /** @type {string} */ text) => write('ask', at, [], { ...PERSON, text }).id;
  const decide = (/** @type {string} */ at, /** @type {string} */ question, /** @type {string} */ text, content = {}) => write('decide', at, ['--answers', question], { ...PERSON, text, why: `Why: ${text}`, ...content }).id;
  const find = (/** @type {string} */ at, /** @type {string} */ text) => write('find', at, [], { ...MADE, text, how: 'read in the code', known: 'read' }).id;
  const replace = (/** @type {string} */ at, /** @type {string} */ old, /** @type {string} */ text) => write('replace', at, ['--replaces', old, '--reason', 'changed-mind'], { ...PERSON, drops: ['the old answer'], text, why: `Why: ${text}` }).id;
  const [cards, refunds, wallets, disputes] = ['cards', 'refunds', 'wallets', 'disputes'].map((topic) => `${UNIT}.discussion.${topic}`);
  const [atSpec, atBilling] = [`${UNIT}.specification`, 'billing.discussion.billing'];
  made.cardsOld = decide(cards, ask(cards, 'Which cards are taken?'), 'Visa alone.');
  made.cards = replace(cards, made.cardsOld, 'Visa and Mastercard.');
  made.radius = decide(cards, ask(cards, 'What radius are the corners?'), 'Ten points.', { ...MADE, given: 'dont-care' });
  made.brand = find(cards, 'The form shows the card\'s brand.');
  made.refunds = decide(refunds, ask(refunds, 'Where does a refund go?'), 'Back to the card.');
  made.moved = write('move', refunds, ['--question', ask(refunds, 'Where do chargebacks go?'), '--to', 'cards'], MADE).id;
  made.wallets = decide(wallets, ask(wallets, 'Which wallets?'), 'Apple Pay.');
  made.disputes = decide(disputes, ask(disputes, 'Who answers a dispute?'), 'The bank.');
  made.gap = decide(atSpec, ask(atSpec, 'Is a card kept after the charge?'), 'Never.');
  made.found = find(`${UNIT}.discovery`, 'Charges go through the bank\'s API.');
  made.invoice = decide(atBilling, ask(atBilling, 'What does an invoice show?'), 'Each charge.');
  made.taxOld = decide(atBilling, ask(atBilling, 'Is tax shown?'), 'As a total.');
  made.tax = replace(atSpec, made.taxOld, 'Per line.');
  payments(dir, { wallets: 'in-progress', disputes: 'in-progress' }, { wallets: { postponed: true }, disputes: { cancelled: true } });
  commitAll(dir, 'topics settled');
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

const { full, entries: ledgerLines } = ledgerHelpers(() => dir);

/** An entry's line as the ledger holds it, but its schema version. @param {string} short */
function lineOf(short) {
  const { v, ...line } = ledgerLines().find((entry) => entry.id === full(short));
  return line;
}

/** A spec of two areas, its first part's statements as given. @param {string[]} statements @param {string[]} [more] the second area's part, as given */
function spec(statements, more = ['2.1.1 A refund goes back to the card. [builder]']) {
  return [
    '# Payments', '',
    '## 1. Cards', '', '### 1.1 The form', '', ...statements.flatMap((line) => [line, '']),
    '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when it is sent, then the card is charged. (1.1.1)', '',
    '## 2. Refunds', '', '### 2.1 Whole', '', ...more.flatMap((line) => [line, '']),
  ].join('\n');
}

/** @param {string} text */
const writeSpec = (text) => writeState(dir, SPEC, text);

const land = () => ok(dir, ['spec', 'land', UNIT]);

/** The files the last state commit touched. */
const stateTouched = () => touched(statePath(dir), 'HEAD');

/** The refusal's error, nothing written or committed. @param {string[]} [args] */
const refused = (args = [UNIT]) => refusedPristine(dir, ['spec', 'land', ...args]).error;

describe('a spec landed (11.4.1, 11.4.3, 11.S3)', () => {
  it('commits spec.md with the asset it links, answering its statements, none invented, and every section changed — each cite a current entry of the unit: a decided topic\'s, its own level\'s, or one made there of another unit\'s, and the builder\'s with a "don\'t care" decision or none', () => {
    writeState(dir, layout.unit(UNIT, 'assets', 'flow.md'), '# The charge flow\n');
    writeState(dir, layout.unit(UNIT, 'assets', 'unlinked.md'), '# Not linked\n');
    writeSpec(spec([
      `1.1.1 Visa and Mastercard are taken, as the [charge flow](assets/flow.md) shows. [${made.cards}, ${made.found}]`,
      `1.1.2 The form shows the card's brand. [${made.brand}]`,
      `1.1.3 A card is never kept. [${made.gap}, ${made.tax}]`,
      `1.1.4 Corners are ten points. [builder: ${made.radius}]`,
    ]));
    const answer = land();

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, statements: 5, invented: [], changed: ['1', '1.1', '2', '2.1'], committed: answer.committed });
    assert.deepStrictEqual([lastMessage(dir), stateTouched()], [`spec(${UNIT}): landed`, [`A\t${layout.unit(UNIT, 'assets', 'flow.md')}`, `A\t${SPEC}`]]);
    assert.strictEqual(stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), answer.committed);
  });

  it('11.S4: lists each statement that does not trace, with why, and lands the spec all the same', () => {
    writeSpec(spec([
      '1.1.1 Cards are charged once.',
      `1.1.2 Visa alone. [${made.cardsOld}]`,
      `1.1.3 Apple Pay is taken. [${made.wallets}, ${made.cards}]`,
      `1.1.4 The bank answers disputes. [${made.disputes}]`,
      `1.1.5 Invoices show each charge. [${made.invoice}]`,
      `1.1.6 Chargebacks go to cards. [${made.moved}]`,
      '1.1.7 Nothing names this. [Zz9Zz9Zz9, Ab]',
      `1.1.8 Visa and Mastercard, left to the builder. [builder: ${made.cards}]`,
    ]));
    const answer = land();

    assert.deepStrictEqual(answer.invented, [
      { statement: '1.1.1', why: 'cites no entry' },
      { statement: '1.1.2', why: `${made.cardsOld} was replaced by ${made.cards}` },
      { statement: '1.1.3', why: `${made.wallets} is not current — its topic, wallets, is postponed` },
      { statement: '1.1.4', why: `${made.disputes} is not current — its topic, disputes, is cancelled` },
      { statement: '1.1.5', why: `${made.invoice} belongs to billing` },
      { statement: '1.1.6', why: `${made.moved} names no entry` },
      { statement: '1.1.7', why: 'no ledger entry\'s id begins "Zz9Zz9Zz9"; "Ab" is too short to name a ledger entry — give at least 4 characters of its id' },
      { statement: '1.1.8', why: `${made.cards} is no "don't care" decision — a builder's line cites the one it rests on, or carries [builder] alone` },
    ]);
    assert.deepStrictEqual([answer.statements, typeof answer.committed, stateTouched()], [9, 'string', [`A\t${SPEC}`]]);
  });

  it('answers at a second land the sections changed since the last, and commits nothing where nothing changed', () => {
    writeSpec(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`]));
    land();
    const unchanged = land();
    writeSpec(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`], ['2.1.1 A refund goes back to the card. [builder]', '2.1.2 It names its charge. [builder]']));
    const changed = land();

    assert.deepStrictEqual([unchanged.committed, unchanged.note, unchanged.changed], [null, 'nothing to commit', []]);
    assert.deepStrictEqual([changed.changed, stateTouched()], [['2', '2.1'], [`M\t${SPEC}`]]);
  });
});

describe('a land refused, spec.md left as written and nothing committed (11.9.1)', () => {
  it('refuses a unit the project lacks, and an argv of another shape', () => {
    assert.strictEqual(refused(['ledger']), 'spec land: there is no work unit "ledger"');
    for (const args of [[], [UNIT, 'more'], [UNIT, '--force', 'yes']]) assert.strictEqual(refused(args), 'Usage: engine spec land <work-unit>', args.join(' '));
    assert.strictEqual(refusedPristine(dir, ['spec', 'show', UNIT]).error, 'Usage: engine spec land <work-unit>');
  });

  it('refuses a concluded spec — the build begun on it — which is never corrected', () => {
    writeSpec(spec(['1.1.1 Cards. [builder]']));
    payments(dir, { wallets: 'in-progress', disputes: 'in-progress' }, { wallets: { postponed: true }, disputes: { cancelled: true } }, { build: { position: 'auto' } });
    commitAll(dir, 'concluded');

    assert.strictEqual(refused(), `spec land: ${UNIT}'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger`);
  });

  it('refuses, in its words, a unit enter specification refuses: a topic not yet settled, and a quick-fix', () => {
    writeSpec(spec(['1.1.1 Cards. [builder]']));
    payments(dir, { refunds: 'in-progress', wallets: 'in-progress', disputes: 'in-progress' }, { wallets: { postponed: true }, disputes: { cancelled: true } });
    createManifest(dir, 'tidy', { work_type: 'quick-fix' });
    writeState(dir, layout.unit('tidy', 'spec.md'), spec(['1.1.1 Tidied. [builder]']));
    commitAll(dir, 'unsettled');
    const [unsettled, quickFix] = [specEntryRefusal(dir, UNIT), specEntryRefusal(dir, 'tidy')];

    assert.ok(unsettled !== null && quickFix !== null, 'enter specification refuses both');
    assert.deepStrictEqual([refused(), refused(['tidy'])], [`spec land: ${unsettled}`, `spec land: ${quickFix}`]);
  });

  it('refuses a unit with no spec.md, and a spec its grammar refuses, naming its faults', () => {
    const none = refused();
    writeSpec(spec(['1.1.1 Cards. [builder]', '1.1.1 Again. [see below]']));
    commitAll(dir, 'written');

    assert.deepStrictEqual([none, refused()], [
      `spec land: ${UNIT} has no spec — its folder holds no spec.md`,
      'spec land: the spec gives statement 1.1.1 twice, on lines 7 and 9; statement 1.1.1 on line 9 ends in [see below], which is no source bracket — [id, id, …], [builder: id] or [builder]',
    ]);
    assert.match(readState(dir, SPEC), /1\.1\.1 Again\. \[see below\]/);
  });
});

describe('a unit\'s entries (unitEntries)', () => {
  it('the current entries placed in the unit, by id, in the ledger\'s order: its decided topics\', its own level\'s, and one made there that stands in another unit — none replaced, set aside, another unit\'s alone, or no entry', () => {
    const entries = unitEntries(dir, UNIT);
    const shorts = [...entries.values()].map(({ short }) => short);
    const questions = shorts.filter((short) => !Object.values(made).includes(short));

    assert.deepStrictEqual(shorts.filter((short) => Object.values(made).includes(short)), [made.cards, made.radius, made.brand, made.refunds, made.gap, made.found, made.tax]);
    assert.strictEqual(questions.length, 5, 'and the questions on its live topics and its own level');
    assert.deepStrictEqual(entries.get(full(made.tax)), {
      short: made.tax,
      kind: 'decision',
      stands: { unit: 'billing', topic: 'billing' },
      line: lineOf(made.tax),
    });
  });
});
