'use strict';

// ---------------------------------------------------------------------------
// The spec writer's and reviewer's suites' world and helpers
// (test-engine-spec-review.cjs, test-engine-spec-review-settled.cjs,
// test-engine-spec-review-store.cjs): an epic, `payments`, its topics
// `cards` (titled "card form") and `refunds` decided, each with its log; on
// `cards` a decision linking a canonical asset, a "don't care" decision, a
// measured finding and a decision relying on it; on `refunds` a product-wide
// decision and a finding read in documentation; at the spec, a replacement
// of a decision of another unit, `billing`; and the sweep taken. Built once
// per process and copied for each test.
// ---------------------------------------------------------------------------

const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, layout, writeState, commitAll, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const SESSION_ID = 'spec-review-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const AT_SPEC = `${UNIT}.specification`;
const [CARDS, REFUNDS] = ['cards', 'refunds'].map((topic) => `${UNIT}.discussion.${topic}`);

const CLEAN = '# Spec Review\n\n## Findings\n\nNone identified.';
const FOUND = '# Spec Review\n\n## Findings\n\n### F1: refunds are not instant\n\n**Lane:** rewrite\n\n2.1.2 cites nothing.';
const LANED = [
  '# Spec Review', '', '## Findings', '',
  '### F1: is a refund split?', '', '**Lane:** gap', '', 'No entry decides it.', '',
  '### F2: a charge is slower', '', '**Lane:** fact', '', 'The bench gives 450 ms.',
].join('\n');

/** The way on where what waits is the writer's. */
const WRITER = 'the writer\'s brief carries what waits for it, and the spec\'s land takes it: ';

/** The Claude process a pass's dispatch names as its owner: this one, which runs, or none, never verified alive. */
const OWNER = Object.freeze({ running: Object.freeze({ CLAUDE_PID: String(process.pid) }), none: Object.freeze({ CLAUDE_PID: undefined }) });

/** The epic's manifest, each topic's discussion as `status` gives it. @param {string} dir @param {Record<string, string>} [status] @param {Record<string, unknown>} [more] */
function payments(dir, status = {}, more = {}) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { cards: { order: 1, summary: 'The form', source: 'discovery', title: 'card form' }, refunds: { order: 2, summary: 'Refunds', source: 'discovery' } } },
      discussion: { items: { cards: { status: status.cards ?? 'completed' }, refunds: { status: status.refunds ?? 'completed' } } },
    },
    ...more,
  });
}

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

const world = fixtureFrom('spec-review-', (dir) => {
  payments(dir, { cards: 'in-progress', refunds: 'in-progress' });
  createManifest(dir, 'billing', { phases: { discussion: { items: { invoices: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const ask = (/** @type {string} */ at, /** @type {string} */ text) => write('ask', at, [], { ...PERSON, text }).id;
  const decide = (/** @type {string} */ at, /** @type {string} */ question, /** @type {string} */ text, content = {}, flags = /** @type {string[]} */ ([])) => write('decide', at, ['--answers', question, ...flags], { ...PERSON, text, why: `Why: ${text}`, ...content }).id;
  made.taken = ask(CARDS, 'Which cards are taken?');
  made.cards = decide(CARDS, made.taken, 'Visa and Mastercard.');
  made.radiusAsked = ask(CARDS, 'What radius are the corners?');
  made.radius = decide(CARDS, made.radiusAsked, 'Ten points.', { ...MADE, given: 'dont-care' });
  made.speed = write('find', CARDS, [], { ...MADE, text: 'A charge takes 300 ms.', how: 'timed on the bench', known: 'measured', command: 'npm run bench -- charge', result: '300 ms' }).id;
  made.oneAsked = ask(CARDS, 'How many requests does a charge make?');
  made.one = decide(CARDS, made.oneAsked, 'One request a charge.', {}, ['--relies-on', made.speed]);
  made.whereAsked = ask(REFUNDS, 'Where does a refund go?');
  made.where = decide(REFUNDS, made.whereAsked, 'Back to the card.', { product_wide: true });
  made.posted = write('find', REFUNDS, [], { ...MADE, text: 'A refund posts within a day.', how: 'read in the bank\'s documentation', known: 'documented' }).id;
  const invoices = 'billing.discussion.invoices';
  made.taxOld = decide(invoices, ask(invoices, 'Is tax shown?'), 'As a total.');
  made.tax = write('replace', AT_SPEC, ['--replaces', made.taxOld, '--reason', 'was-wrong'], { ...PERSON, drops: ['a total'], text: 'Per line.', why: 'Each line is taxed apart.' }).id;
  writeState(dir, layout.assets(UNIT, 'flow.md'), '# The charge flow\n');
  ok(dir, ['asset', 'add', UNIT, layout.assets(UNIT, 'flow.md'), '--entry', made.cards, '--status', 'canonical'], { env: SESSION });
  writeState(dir, layout.topic(UNIT, 'cards', 'log.md'), '# Card form\n');
  writeState(dir, layout.topic(UNIT, 'refunds', 'log.md'), '# Refunds\n');
  payments(dir);
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ taken: '2026-11-01T00:00:00.000Z', messages: [], candidates: [] }));
  commitAll(dir, 'topics settled');
});

/**
 * The world for each test of the calling file, copied before it and
 * removed after it with the conversation's briefs.
 * @returns {() => string} the running test's project
 */
function useSpecReviewWorld() {
  /** @type {string} */
  let dir = '';
  beforeEach(() => { dir = world(); });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  });
  return () => dir;
}

/** The unit's records as both briefs draw them, the unit's own lines as given. @param {string[]} [own] */
const RECORDS = (own = []) => [
  '## Card Form (cards)', '',
  `- ${made.taken} question: Which cards are taken?`,
  `- ${made.cards} decision: Visa and Mastercard.`,
  `- ${made.radiusAsked} question: What radius are the corners?`,
  `- ${made.radius} decision, don't care: Ten points.`,
  `- ${made.speed} finding: A charge takes 300 ms.`,
  `- ${made.oneAsked} question: How many requests does a charge make?`,
  `- ${made.one} decision: One request a charge.`, '',
  '## Refunds (refunds)', '',
  `- ${made.whereAsked} question: Where does a refund go?`,
  `- ${made.where} decision: Back to the card.`,
  `- ${made.posted} finding: A refund posts within a day.`,
  '', '## The unit\'s own', '', ...(own.length === 0 ? ['None recorded.'] : own), '',
  '## Made here, standing on billing/invoices', '',
  `- ${made.tax} decision: Per line.`,
].join('\n');

/** A role's template as shipped, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8').split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** The section a heading opens in a brief, to the next top-level heading, or to `next` where given. @param {string} brief @param {string} heading @param {string} [next] */
function section(brief, heading, next) {
  const from = brief.indexOf(`\n# ${heading}\n\n`);
  assert.notStrictEqual(from, -1, `the brief has no "# ${heading}"`);
  const body = brief.slice(from + heading.length + 5);
  const end = next === undefined ? body.search(/\n\n# /) : body.indexOf(`\n\n# ${next}\n`);
  return (end === -1 ? body : body.slice(0, end)).trimEnd();
}

/** `text` with a second blank line before each heading but the title. @param {string} text */
const spaced = (text) => text.replace(/\n\n#/g, '\n\n\n#');

/**
 * The suites' helpers, over the project `dir()` names.
 * @param {() => string} dir
 */
function specReviewHelpers(dir) {
  /** The spec, its part 1.2's statement and part 2.1's last as given. @param {{charge?: string, instant?: string, more?: string[]}} [lines] */
  function spec({ charge = `1.2.1 A charge is one request, and takes 300 ms. [${made.one}, ${made.speed}]`, instant = '2.1.2 Refunds are instant.', more = [] } = {}) {
    return [
      '# Payments', '',
      '## 1. Cards', '',
      '### 1.1 The form', '',
      `1.1.1 Visa and Mastercard are taken, as the [charge flow](assets/flow.md) shows. [${made.cards}]`, '',
      `1.1.2 Corners are ten points. [builder: ${made.radius}]`, '',
      '### 1.2 The charge', '', charge, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given the form, when a Visa card is charged, then one request is made. (1.1.1, 1.2.1)', '',
      '## 2. Refunds', '',
      '### 2.1 Where', '', `2.1.1 A refund goes back to the card. [${made.where}]`, '', instant, '',
      ...more,
    ].join('\n');
  }

  /** @param {string} text */
  const writeSpec = (text) => writeState(dir(), SPEC, text);

  const land = () => ok(dir(), ['spec', 'land', UNIT]);

  /** A brief issued: its response, and the brief as stored. @param {string[]} args */
  function issued(args) {
    const res = ok(dir(), ['brief', ...args], { env: SESSION });
    return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
  }

  /** The conversation's stored briefs, by file. */
  const stored = () => {
    const folder = path.dirname(briefPath(SESSION_ID, 'x'));
    return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  };

  /** A brief refused, nothing written and no brief stored: its error. @param {string[]} args */
  function refusedUnissued(args) {
    const before = stored();
    const { error } = refusedPristine(dir(), ['brief', ...args], { env: SESSION });
    assert.deepStrictEqual(stored(), before);
    return error;
  }

  /** A spec review dispatched in the unit's agent store, naming `owner` as its owner: its id and its report's file. @param {Record<string, string|undefined>} [owner] */
  const dispatchReview = (owner = OWNER.none) => ok(dir(), ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'spec-review'], { env: owner });

  /** A pass's report written, so it is in. @param {{file: string}} pass @param {string} [report] */
  const reportIn = ({ file }, report = CLEAN) => fs.writeFileSync(file, `${report}\n`);

  /** The unit's store scanned, each report in taken in: the scan's answer. */
  const scan = () => ok(dir(), ['agent', 'scan', UNIT, 'specification', UNIT]);

  /** A pass's report scanned and acknowledged: clean, or with its findings. @param {{id: string}} pass @param {string[]} [findings] */
  function acked({ id }, findings = []) {
    scan();
    ok(dir(), ['agent', 'ack', UNIT, 'specification', UNIT, id, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]);
  }

  /** A pass dispatched, briefed, and its clean report in and acknowledged: the pass. */
  function cleanPass() {
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass);
    acked(pass);
    return pass;
  }

  /** Where ready to build's review-settled stands. */
  const reviewSettled = () => ok(dir(), ['checklist', 'show', 'ready-to-build', UNIT]).items.find((/** @type {{key: string}} */ item) => item.key === 'review-settled').state;

  /** A pass incorporated: abandoned in flight, or acknowledged and its findings declined. @param {{id: string}} pass */
  const unread = ({ id }) => ok(dir(), ['agent', 'incorporate', UNIT, 'specification', UNIT, id]);

  /** An agent verb on the unit's store refused, nothing written: its error. @param {string} verb @param {string[]} rest */
  const storeRefusal = (verb, ...rest) => refusedPristine(dir(), ['agent', verb, UNIT, 'specification', UNIT, ...rest]).error;

  /** The reviewer's brief refused for a new pass on the spec as it stands: its error. */
  const nothingToRead = () => refusedUnissued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]);

  return {
    spec, writeSpec, land, issued, refusedUnissued, dispatchReview, reportIn, scan, acked, cleanPass, reviewSettled, unread, storeRefusal, nothingToRead,
  };
}

/** The refusal of a pass on a spec unchanged since `pass` reported, naming the way on. @param {{id: string}} pass @param {string} way */
const unchangedSince = ({ id }, way) => `brief: ${UNIT}'s spec has not changed since pass ${id}, whose report is in, so a pass has nothing to read — ${way}`;

module.exports = {
  UNIT, SPEC, SESSION_ID, SESSION, PERSON, MADE, AT_SPEC, CARDS, FOUND, LANED, WRITER, OWNER, TEMPLATES,
  made, payments, useSpecReviewWorld, specReviewHelpers, RECORDS, filledTemplate, section, spaced, unchangedSince,
};
