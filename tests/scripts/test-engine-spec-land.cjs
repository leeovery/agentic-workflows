'use strict';

// ---------------------------------------------------------------------------
// The spec's land (leeway-engine/scripts/domain/spec-land.cjs): `engine spec
// land <unit>`, and the trace and the unit's entries it reads
// (spec-trace.cjs, unit-entries.cjs). A spec whose statements and screens
// trace — each cite a current decision or finding of the unit, on a decided
// topic or at its own level, or made there of another unit's; a builder's
// line citing a "don't care" decision, or none — is committed alone on the
// state branch with the files it links in the assets, answering its
// statements, none invented, and every section changed, the title and
// introduction among them (11.S3); a statement
// or a screen that does not trace — a question cited among the reasons — is
// listed with why and refuses nothing (11.S4's mechanical half, 11.4.2); a
// later land answers the sections changed since the last, each by its own
// text — an area's with its scenarios and without its parts, a part's
// alone, and those removed — and one with nothing changed commits
// nothing; and each refusal — no unit, a concluded spec (11.9.1), a unit
// `enter specification` refuses, a quick-fix, an epic whose sweep is not
// taken (8.10.3), no `spec.md`, a spec its
// grammar refuses, a commit git refuses, an argv of another shape — writes
// and commits nothing, the file left as written (the grammar's own faults
// are test-spec-sections.cjs's); a later change to an entry a concluded spec
// cites writes the ledger alone — no corrigendum, the spec never indexed,
// what relied on the old entry affected (11.S15). The unit's entries: the current entries
// placed in it, by id, each with its short id, kind, standing and line.
//
// Layer: verb. World, built once and copied: an epic, `payments`, its topics
// `cards` and `refunds` decided, `wallets` postponed and `disputes`
// cancelled, each with entries written through the ledger's verbs — on
// `cards` a decision replaced, a "don't care" decision and a finding; on
// `refunds` a question moved to `cards`; a gap decided at the spec and a
// finding at discovery, each at the unit's level; and a feature, `billing`,
// with two decisions, one replaced from the payments spec; payments' sweep
// taken.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, stateGit, lastMessage, touched, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { unitEntries } = require(path.join(SCRIPTS, 'domain/unit-entries.cjs'));
const { specEntryRefusal } = require(path.join(SCRIPTS, 'domain/spec-entry.cjs'));
const { discoverArtifacts, readManifests } = require(path.join(SCRIPTS, 'domain/knowledge/artifacts.cjs'));

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
  made.taken = ask(cards, 'Which cards are taken?');
  made.cardsOld = decide(cards, made.taken, 'Visa alone.');
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
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ taken: '2026-11-01T00:00:00.000Z', messages: [], candidates: [] }));
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
      `Screen: the form, its brand shown. [${made.brand}]`,
    ]));
    const answer = land();

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, statements: 5, invented: [], changed: ['introduction', '1', '1.1', '2', '2.1'], committed: answer.committed });
    assert.deepStrictEqual([lastMessage(dir), stateTouched()], [`spec(${UNIT}): landed`, [`A\t${layout.unit(UNIT, 'assets', 'flow.md')}`, `A\t${SPEC}`]]);
    assert.strictEqual(stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), answer.committed);
  });

  it('11.S4: lists each statement and screen that does not trace, with why, and lands the spec all the same', () => {
    writeSpec(spec([
      '1.1.1 Cards are charged once.',
      `1.1.2 Visa alone. [${made.cardsOld}]`,
      `1.1.3 Apple Pay is taken. [${made.wallets}, ${made.cards}]`,
      `1.1.4 The bank answers disputes. [${made.disputes}]`,
      `1.1.5 Invoices show each charge. [${made.invoice}]`,
      `1.1.6 Chargebacks go to cards. [${made.moved}]`,
      '1.1.7 Nothing names this. [Zz9Zz9Zz9, Ab]',
      `1.1.8 Visa and Mastercard, left to the builder. [builder: ${made.cards}]`,
      `1.1.9 Which cards are taken. [${made.taken}]`,
      'Screen: the form, drawn.',
    ]));
    const answer = land();

    assert.deepStrictEqual(answer.invented, [
      { number: '1.1.1', why: 'cites no entry' },
      { number: '1.1.2', why: `${made.cardsOld} was replaced by ${made.cards}` },
      { number: '1.1.3', why: `${made.wallets} is not current — its topic, wallets, is postponed` },
      { number: '1.1.4', why: `${made.disputes} is not current — its topic, disputes, is cancelled` },
      { number: '1.1.5', why: `${made.invoice} belongs to billing` },
      { number: '1.1.6', why: `${made.moved} names no entry` },
      { number: '1.1.7', why: 'no ledger entry\'s id begins "Zz9Zz9Zz9"; "Ab" is too short to name a ledger entry — give at least 4 characters of its id' },
      { number: '1.1.8', why: `${made.cards} is no "don't care" decision — a builder's line cites the one it rests on, or carries [builder] alone` },
      { number: '1.1.9', why: `${made.taken} is a question — cite its answer` },
      { number: '1.1.9-scr1', why: 'cites no entry' },
    ]);
    assert.deepStrictEqual([answer.statements, typeof answer.committed, stateTouched()], [10, 'string', [`A\t${SPEC}`]]);
  });

  it('answers at a later land the sections changed since the last — an area\'s with its scenarios, a part\'s alone, then those removed — and commits nothing where nothing changed', () => {
    const once = (/** @type {string} */ written) => written.replace('then the card is charged.', 'then the card is charged once.');
    writeSpec(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`]));
    land();
    const unchanged = land();
    writeSpec(once(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`])));
    const scenario = land();
    const added = once(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`], ['2.1.1 A refund goes back to the card. [builder]', '2.1.2 It names its charge. [builder]']));
    writeSpec(added);
    const [part, touchedByPart] = [land().changed, stateTouched()];
    writeSpec(added.slice(0, added.indexOf('## 2. Refunds')));
    const removed = land();

    assert.deepStrictEqual([unchanged.committed, unchanged.note, unchanged.changed], [null, 'nothing to commit', []]);
    assert.deepStrictEqual([scenario.changed, part, touchedByPart, removed.changed], [['1'], ['2.1'], [`M\t${SPEC}`], ['2', '2.1']]);
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

  it('a later change replacing an entry a concluded spec cites leaves spec.md as written, with no corrigendum and no index entry — the ledger holds the replacement, and what relied on the old entry is affected (11.S15)', () => {
    const { write } = ledgerHelpers(() => dir);
    const relying = write('find', `${UNIT}.discussion.cards`, ['--relies-on', made.cards], { ...MADE, text: 'Mastercard needs its own logo.', how: 'read in the code', known: 'read' }).id;
    writeSpec(spec([`1.1.1 Visa and Mastercard. [${made.cards}]`]));
    land();
    payments(dir, { wallets: 'in-progress', disputes: 'in-progress' }, { wallets: { postponed: true }, disputes: { cancelled: true } }, { build: { position: 'auto' } });
    commitAll(dir, 'concluded');
    const written = readState(dir, SPEC);

    const replacement = write('replace', 'billing.discussion.billing', ['--replaces', made.cards, '--reason', 'changed-mind'],
      { ...PERSON, drops: ['Mastercard'], text: 'Visa alone, again.', why: 'Why: Mastercard fees.' }).id;

    assert.strictEqual(refused(), `spec land: ${UNIT}'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger`);
    assert.deepStrictEqual([readState(dir, SPEC), stateTouched()], [written, ['M\t.ledger.jsonl']], 'the change wrote the ledger alone — spec.md as written, no corrigendum');
    const indexed = discoverArtifacts(statePath(dir), readManifests(statePath(dir))).filter(({ workUnit }) => workUnit === UNIT);
    assert.deepStrictEqual(indexed.map(({ phase }) => phase), ['record', 'record', 'record'], 'the unit\'s records are indexed, never its spec');
    assert.deepStrictEqual(lineOf(replacement).replaces, full(made.cards));
    assert.deepStrictEqual(ok(dir, ['ledger', 'affected', UNIT]).affected.map((/** @type {{id: string}} */ e) => e.id), [relying]);
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

  it('refuses an epic of more than one live topic whose sweep is not taken, naming the way on (8.10.3)', () => {
    writeSpec(spec(['1.1.1 Cards. [builder]']));
    fs.rmSync(statePath(dir, layout.unit(UNIT, 'sweep-taken.json')));
    commitAll(dir, 'sweep not taken');

    assert.strictEqual(refused(), `spec land: ${UNIT}'s sweep is not taken — it runs before the spec lands: engine brief sweep ${UNIT}, then engine sweep take ${UNIT}`);
  });

  it('refuses a unit with no spec.md, and a spec its grammar refuses, naming its faults one per line', () => {
    const none = refused();
    writeSpec(spec(['1.1.1 Cards. [builder]', '1.1.1 Again. [see; below]']));
    commitAll(dir, 'written');

    assert.deepStrictEqual([none, refused()], [
      `spec land: ${UNIT} has no spec — its folder holds no spec.md`,
      'spec land: the spec gives statement 1.1.1 twice, on lines 7 and 9\nstatement 1.1.1 on line 9 ends in [see; below], which is no source bracket — [id, id, …], [builder: id] or [builder]',
    ]);
    assert.match(readState(dir, SPEC), /1\.1\.1 Again\. \[see; below\]/);
  });

  it('refuses a commit git refuses, naming its fault', () => {
    writeSpec(spec(['1.1.1 Cards. [builder]']));
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(dir, 'git-'));
    fs.writeFileSync(path.join(wrapper, 'git'), `#!/bin/sh\ncase "$*" in *commit-tree*) echo "fatal: refused here" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`, { mode: 0o755 });

    assert.strictEqual(refusedPristine(dir, ['spec', 'land', UNIT], { env: { PATH: `${wrapper}:${process.env.PATH}` } }).error, 'spec land: git commit-tree failed: fatal: refused here');
  });
});

describe('a unit\'s entries (unitEntries)', () => {
  it('the current entries placed in the unit, by id, in the ledger\'s order: its decided topics\', its own level\'s, and one made there that stands in another unit — none replaced, set aside, another unit\'s alone, or no entry', () => {
    const entries = unitEntries(dir, UNIT);
    const shorts = [...entries.values()].map(({ short }) => short);
    const questions = shorts.filter((short) => !Object.values(made).includes(short));

    assert.deepStrictEqual(shorts.filter((short) => Object.values(made).includes(short)), [made.taken, made.cards, made.radius, made.brand, made.refunds, made.gap, made.found, made.tax]);
    assert.strictEqual(questions.length, 4, 'and the other questions on its live topics and its own level');
    assert.deepStrictEqual(entries.get(full(made.tax)), {
      short: made.tax,
      kind: 'decision',
      stands: { unit: 'billing', topic: 'billing' },
      line: lineOf(made.tax),
    });
  });
});
