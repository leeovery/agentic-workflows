'use strict';

// ---------------------------------------------------------------------------
// The spec's writer and its reviewer (leeway-engine/scripts/domain/
// brief-records.cjs, their records; domain/spec-passes.cjs, the review's
// passes; the templates content/briefs/spec-writer.md and spec-reviewer.md):
// `engine brief spec-writer <unit>` and `engine brief spec-reviewer <unit>
// --agent <id>`, the land's record and ready to build's `review-settled`.
//
// The writer's brief, for the unit (11.S2): where the spec goes, every live
// topic's entries under its title, then the unit's own, then those it made
// standing in another unit, each topic's log, the canonical assets, the
// sweep's calls, what waits for it — the entries made at the spec since its
// last brief, a gap's answer among them (11.S20), and each report neither
// acknowledged clean nor taken — the lines that do not trace and what the
// land refuses of the spec as written; its template's example read by the
// spec's own grammar; refused for a unit the land refuses, and while a gap
// put to the person is open. The land keeps the print of what it landed —
// each section's own text hashed, the title and introduction one of them —
// a section's changing alone with it, and blank lines between sections or
// a section moved changing none (E4). The reviewer's brief, for a pass
// dispatched in the unit's agent store: every section at the first pass,
// then only those changed since the last pass reported, and those gone
// (11.S11); the lines that do not trace, the measured findings (11.S21),
// the product-wide entries cited, the records and its report; its dispatch
// bound to the land it reviews; refused where this checkout holds no land,
// for a spec written since it landed, one unchanged since a pass reported —
// naming what waits — and a dispatch of another kind or bound to another
// landing. The review settles (a) once the latest reported pass reviewed
// the spec as it stands, (c) with no gap waiting and (d) nothing waiting:
// for the writer, the entries made at the spec and the `rewrite` findings
// since the last take a land committed — a brief again before a land
// carrying all of it — and to be surfaced, each `gap` or `fact` finding,
// until surfaced or declined, its pass acknowledged with it and incorporated;
// an entry at another unit's spec, on a topic or replaced since, or an asset
// linked at the spec, waits for no one. A pass's report counts once a scan
// takes it in, and only as it reads: one that does not is refused at the
// scan, never reported, and the next pass's brief carries the refusal. A pass is read before any of
// its findings is declined: never incorporated between its report and its
// acknowledgement, which names exactly its report's findings. A pass
// abandoned in flight is ignored whole, whenever it reports. A fact the review shows wrong,
// replaced at the spec, stands on its topic and affects what relied on it
// (11.S21).
//
// Layer: verb. World, built once and copied: an epic, `payments`, its topics
// `cards` (titled "card form") and `refunds` decided, each with its log; on
// `cards` a decision linking a canonical asset, a "don't care" decision, a
// measured finding and a decision relying on it; on `refunds` a
// product-wide decision and a finding read in documentation; at the spec,
// a replacement of a decision of another unit, `billing`; and the sweep
// taken.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { specStatements } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { specEntryRefusal } = require(path.join(SCRIPTS, 'domain/spec-entry.cjs'));
const { reviewPasses } = require(path.join(SCRIPTS, 'domain/agent-state.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const LANDED = layout.cache(UNIT, 'specification', 'landed.json');
const SESSION_ID = 'spec-review-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const AT_SPEC = `${UNIT}.specification`;
const [CARDS, REFUNDS] = ['cards', 'refunds'].map((topic) => `${UNIT}.discussion.${topic}`);

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

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
});

const { write, full, entries: ledgerLines } = ledgerHelpers(() => dir);

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
const writeSpec = (text) => writeState(dir, SPEC, text);

const land = () => ok(dir, ['spec', 'land', UNIT]);

/** A brief issued: its response, and the brief as stored. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

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

/** The conversation's stored briefs, by file. */
const stored = () => {
  const folder = path.dirname(briefPath(SESSION_ID, 'x'));
  return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
};

/** A brief refused, nothing written and no brief stored: its error. @param {string[]} args */
function refusedUnissued(args) {
  const before = stored();
  const { error } = refusedPristine(dir, ['brief', ...args], { env: SESSION });
  assert.deepStrictEqual(stored(), before);
  return error;
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

/** A spec review dispatched in the unit's agent store: its id and its report's file. */
const dispatchReview = () => ok(dir, ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'spec-review']);

const CLEAN = '# Spec Review\n\n## Findings\n\nNone identified.';
const FOUND = '# Spec Review\n\n## Findings\n\n### F1: refunds are not instant\n\n**Lane:** rewrite\n\n2.1.2 cites nothing.';
const LANED = [
  '# Spec Review', '', '## Findings', '',
  '### F1: is a refund split?', '', '**Lane:** gap', '', 'No entry decides it.', '',
  '### F2: a charge is slower', '', '**Lane:** fact', '', 'The bench gives 450 ms.',
].join('\n');

/** The way on where what waits is the writer's. */
const WRITER = 'the writer\'s brief carries what waits for it, and the spec\'s land takes it: ';

/** A pass's report written, so it is in. @param {{file: string}} pass @param {string} [report] */
const reportIn = ({ file }, report = CLEAN) => fs.writeFileSync(file, `${report}\n`);

/** The unit's store scanned, each report in taken in: the scan's answer. */
const scan = () => ok(dir, ['agent', 'scan', UNIT, 'specification', UNIT]);

/** A pass's report scanned and acknowledged: clean, or with its findings. @param {{id: string}} pass @param {string[]} [findings] */
function acked({ id }, findings = []) {
  scan();
  ok(dir, ['agent', 'ack', UNIT, 'specification', UNIT, id, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]);
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
const reviewSettled = () => ok(dir, ['checklist', 'show', 'ready-to-build', UNIT]).items.find((/** @type {{key: string}} */ item) => item.key === 'review-settled').state;

/** @param {string} text */
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** `text` with a second blank line before each heading but the title. @param {string} text */
const spaced = (text) => text.replace(/\n\n#/g, '\n\n\n#');

/** `text` with the section `first` opens moved after the one `second` opens, to the next heading at its level or above. @param {string} text @param {string} first @param {string} second @param {string} end */
function moved(text, first, second, end) {
  const [a, b, c] = [text.indexOf(first), text.indexOf(second), end === '' ? text.length : text.indexOf(end)];
  return `${text.slice(0, a)}${text.slice(b, c).trimEnd()}\n\n${text.slice(a, b).trimEnd()}\n\n${text.slice(c)}`.trimEnd();
}

/** A pass incorporated: abandoned in flight, or acknowledged and its findings declined. @param {{id: string}} pass */
const unread = ({ id }) => ok(dir, ['agent', 'incorporate', UNIT, 'specification', UNIT, id]);

/** An agent verb on the unit's store refused, nothing written: its error. @param {string} verb @param {string[]} rest */
const storeRefusal = (verb, ...rest) => refusedPristine(dir, ['agent', verb, UNIT, 'specification', UNIT, ...rest]).error;

/** The reviewer's brief refused for a new pass on the spec as it stands: its error. */
const nothingToRead = () => refusedUnissued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]);

/** The refusal of a pass on a spec unchanged since `pass` reported, naming the way on. @param {{id: string}} pass @param {string} way */
const unchangedSince = ({ id }, way) => `brief: ${UNIT}'s spec has not changed since pass ${id}, whose report is in, so a pass has nothing to read — ${way}`;

describe('the spec writer\'s brief (11.1.5, 11.3.2, 11.S2)', () => {
  it('11.S2: one brief for the unit, from its records alone — where the spec goes, each live topic\'s entries under its title, a "don\'t care" decision marked so, those made here standing on another unit under where they stand, each topic\'s log and the canonical assets — and nothing recorded to rewrite from or answer', () => {
    const { res, brief } = issued(['spec-writer', UNIT]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'spec-writer', agent: 'leeway-spec-writer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'spec-writer', agent: 'leeway-spec-writer', unit: UNIT, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the spec writer's, for ${UNIT}\n\n${filledTemplate('spec-writer', {
      'spec-to': `\`${statePath(dir, SPEC)}\``,
      'unit-records': RECORDS(),
      'topic-logs': [`- \`${statePath(dir, layout.topic(UNIT, 'cards', 'log.md'))}\``, `- \`${statePath(dir, layout.topic(UNIT, 'refunds', 'log.md'))}\``].join('\n'),
      'canonical-assets': `- \`${statePath(dir, layout.assets(UNIT, 'flow.md'))}\``,
      'builder-calls': 'None recorded.',
      'changed-entries': 'None recorded.',
      'review-findings': 'None recorded.',
      'invented-lines': 'None recorded.',
      'land-refusal': 'None recorded.',
    })}`);
  });

  it('the calls the sweep left to the builder, each with why — never its candidates or its messages', () => {
    writeState(dir, layout.cache(UNIT, 'specification', 'sweep.json'), JSON.stringify({
      candidates: [{ name: 'wallets', reason: 'Nothing decides the wallets.', brief: '# Wallets\n' }],
      messages: [{ topic: 'cards', text: 'Refunds settled the card.' }],
      builder_calls: [{ call: 'The retry interval.', why: 'The person would leave it.' }],
    }));

    assert.strictEqual(section(issued(['spec-writer', UNIT]).brief, 'The builder\'s calls'), '- The retry interval.\n  Why: The person would leave it.');
  });

  it('its template\'s example is a spec the land\'s grammar reads: its statements, a screen and a scenario', () => {
    const template = fs.readFileSync(path.join(TEMPLATES, 'spec-writer.md'), 'utf8');
    const example = /\n````markdown\n([\s\S]*?)\n````\n/.exec(template)?.[1];

    assert.ok(example !== undefined, 'the template holds its example');
    assert.deepStrictEqual(specStatements(example).map(({ kind, number, cites, builder }) => [kind, number, cites, builder]), [
      ['statement', '1.1.1', ['Ab12Cd'], false],
      ['statement', '1.1.2', ['Ef34Gh', 'Ij56Kl'], false],
      ['screen', '1.1.2-scr1', ['Ef34Gh'], false],
      ['scenario', '1.S1', [], false],
    ]);
  });

  it('a spec the land refuses comes back in the next brief as the land says it, until the spec as written would land', () => {
    writeSpec(spec({ instant: '2.1.1 Again. [see; below]' }));
    const { error } = refusedPristine(dir, ['spec', 'land', UNIT]);
    const refusal = section(issued(['spec-writer', UNIT]).brief, 'The refusal');
    writeSpec(spec());

    assert.match(error, /^spec land: the spec gives statement 2\.1\.1 twice/);
    assert.deepStrictEqual([refusal, section(issued(['spec-writer', UNIT]).brief, 'The refusal')], [error, 'None recorded.']);
  });

  it('11.S20: a gap answered at the spec stands at the unit\'s own level, with no topic, and a rewrite\'s brief carries it — and a replacement made there, standing on its topic — as written since the first land, before any brief', () => {
    writeSpec(spec());
    land();
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Why is a refund never split?' }).id;
    const answer = write('decide', AT_SPEC, ['--answers', asked], { ...PERSON, text: 'A split refund confuses the bank.', why: 'The bank matches one refund to one charge.' }).id;
    const faster = write('replace', AT_SPEC, ['--replaces', made.speed, '--reason', 'was-wrong'], {
      ...MADE, drops: ['300 ms'], text: 'A charge takes 450 ms.', how: 'timed on the bench', known: 'measured', command: 'npm run bench -- charge', result: '450 ms',
    }).id;
    const { brief } = issued(['spec-writer', UNIT]);
    const line = ledgerLines().find((entry) => entry.id === full(answer));

    assert.deepStrictEqual([line.unit, line.topic, line.phase], [UNIT, null, 'specification']);
    assert.strictEqual(section(brief, 'Written since your last brief'), [
      `- ${asked} question, the unit's own: Why is a refund never split?`,
      `- ${answer} decision, the unit's own: A split refund confuses the bank.`,
      `- ${faster} finding, Card Form (cards), replacing ${made.speed}: A charge takes 450 ms.`,
    ].join('\n'));
    assert.strictEqual(section(brief, 'The records'), RECORDS([`- ${asked} question: Why is a refund never split?`, `- ${answer} decision: A split refund confuses the bank.`])
      .replace(`- ${made.speed} finding: A charge takes 300 ms.\n`, '')
      .replace(`- ${made.one} decision: One request a charge.`, `- ${made.one} decision: One request a charge.\n- ${faster} finding: A charge takes 450 ms.`));
  });
});

describe('the spec writer\'s brief refused, nothing stored', () => {
  it('a unit the land refuses: a topic not yet settled, and a concluded spec', () => {
    payments(dir, { refunds: 'in-progress' });
    commitAll(dir, 'reopened');
    const open = specEntryRefusal(dir, UNIT);
    const unsettled = refusedUnissued(['spec-writer', UNIT]);
    payments(dir, {}, { build: { position: 'auto' } });
    commitAll(dir, 'concluded');

    assert.match(String(open), /^payments's spec waits until every topic is decided, cancelled or postponed — still open: "refunds"/);
    assert.deepStrictEqual([unsettled, refusedUnissued(['spec-writer', UNIT])], [
      `brief: ${open}`,
      `brief: ${UNIT}'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger`,
    ]);
  });

  it('a rewrite while a gap put to the person waits, until it is answered', () => {
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
    const waiting = refusedUnissued(['spec-writer', UNIT]);
    write('decide', AT_SPEC, ['--answers', asked], { ...PERSON, text: 'Never.', why: 'The bank matches one refund to one charge.' });

    assert.strictEqual(waiting, `brief: ${UNIT}'s spec waits on the person — the gap ${asked}, asked at the spec, is open, and its rewrite waits for the answer`);
    assert.strictEqual(issued(['spec-writer', UNIT]).res.role, 'spec-writer');
  });
});

describe('the land\'s record (E4)', () => {
  it('each land keeps the print of the spec it landed — each section\'s own text hashed, the title and introduction one of them, and their digest — and the ledger\'s mark at the first land; a bracket\'s edit changes its section\'s print alone, blank lines between sections change none, and a refused land keeps the last', () => {
    writeSpec(spec());
    land();
    const first = JSON.parse(readState(dir, LANDED));
    const mark = ledgerLines().at(-1).id;
    write('find', CARDS, [], { ...MADE, text: 'Amex is asked for.', how: 'read in the support tickets', known: 'documented' });
    writeSpec(spaced(spec({ charge: `1.2.1 A charge is one request, and takes 300 ms. [${made.one}]` })));
    const answer = land();
    const second = JSON.parse(readState(dir, LANDED));
    writeSpec('# Payments\n');
    refusedPristine(dir, ['spec', 'land', UNIT]);

    assert.deepStrictEqual(Object.keys(first.sections).sort(), ['1', '1.1', '1.2', '2', '2.1', 'introduction']);
    assert.deepStrictEqual([first.sections.introduction, first.sections['1.2']], [sha('# Payments'), sha(`### 1.2 The charge\n\n1.2.1 A charge is one request, and takes 300 ms. [${made.one}, ${made.speed}]`)]);
    assert.deepStrictEqual([first.first_mark, second.first_mark], [mark, mark]);
    assert.deepStrictEqual([Object.keys(first.sections).filter((address) => first.sections[address] !== second.sections[address]), answer.changed], [['1.2'], ['1.2']]);
    assert.notStrictEqual(first.digest, second.digest);
    assert.deepStrictEqual(JSON.parse(readState(dir, LANDED)), second);
  });
});

describe('the spec reviewer\'s brief (11.7.1, 11.7.8, 11.7.9)', () => {
  it('the first pass: the spec\'s path and every section, the title and introduction first, an area\'s own text with its scenarios, the lines that do not trace, the measured findings, the product-wide entries cited, the records and its report — its dispatch bound to the land it reviews', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    const { res, brief } = issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    const landed = JSON.parse(readState(dir, LANDED));

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'spec-reviewer', agent: 'leeway-spec-reviewer', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the spec reviewer's, for ${UNIT}\n\n${filledTemplate('spec-reviewer', {
      'changed-sections': [
        `The spec: \`${statePath(dir, SPEC)}\``,
        'Every section — the review\'s first pass:',
        '# Payments',
        '## 1. Cards\n\n## 1-S. Scenarios for §1\n\n1.S1 Given the form, when a Visa card is charged, then one request is made. (1.1.1, 1.2.1)',
        `### 1.1 The form\n\n1.1.1 Visa and Mastercard are taken, as the [charge flow](assets/flow.md) shows. [${made.cards}]\n\n1.1.2 Corners are ten points. [builder: ${made.radius}]`,
        `### 1.2 The charge\n\n1.2.1 A charge is one request, and takes 300 ms. [${made.one}, ${made.speed}]`,
        '## 2. Refunds',
        `### 2.1 Where\n\n2.1.1 A refund goes back to the card. [${made.where}]\n\n2.1.2 Refunds are instant.`,
      ].join('\n\n'),
      'invented-lines': '- 2.1.2: cites no entry',
      'measured-findings': `- ${made.speed}: A charge takes 300 ms.\n  Its result: 300 ms\n  Its command:\n\n  \`\`\`\n  npm run bench -- charge\n  \`\`\``,
      'product-cites': `- ${made.where} decision: Back to the card.\n  Cited by 2.1.1`,
      'unit-records': RECORDS(),
      'report-refusal': 'None recorded.',
      'unit-report-to': `\`${pass.file}\``,
    })}`);
    assert.deepStrictEqual(reviewPasses(dir, UNIT), [{ id: pass.id, land: landed, file: pass.file, reported: false, findings: [], status: 'in-flight', acknowledged: [], surfaced: [] }]);
  });

  it('11.S11: once a pass has reported, the next reads only the two sections changed since, a bracket\'s edit among them', () => {
    writeSpec(spec());
    land();
    const first = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', first.id]);
    reportIn(first);
    scan();
    writeSpec(spec({ charge: `1.2.1 A charge is one request, and takes 300 ms. [${made.one}]`, instant: `2.1.2 Refunds are instant. [${made.where}]` }));
    land();
    const second = dispatchReview();

    assert.strictEqual(section(issued(['spec-reviewer', UNIT, '--agent', second.id]).brief, 'The sections to review'), [
      `The spec: \`${statePath(dir, SPEC)}\``,
      `The sections changed since ${first.id}, the last pass reported:`,
      `### 1.2 The charge\n\n1.2.1 A charge is one request, and takes 300 ms. [${made.one}]`,
      `### 2.1 Where\n\n2.1.1 A refund goes back to the card. [${made.where}]\n\n2.1.2 Refunds are instant. [${made.where}]`,
    ].join('\n\n'));
  });

  it('a pass whose report no scan has taken in is passed over, as is one abandoned in flight whose report lands after, and a section gone since the last pass reported is named', () => {
    writeSpec(spec({ more: ['### 2.2 Its charge', '', `2.2.1 A refund names its charge. [${made.where}]`, ''] }));
    land();
    const first = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', first.id]);
    reportIn(first);
    scan();
    writeSpec(spec({ instant: `2.1.2 Refunds are instant. [${made.where}]` }));
    land();
    const unscanned = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', unscanned.id]);
    const abandoned = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', abandoned.id]);
    unread(abandoned);
    reportIn(abandoned);
    scan();
    reportIn(unscanned);
    writeSpec(spec({ instant: `2.1.2 Refunds are instant, to the card. [${made.where}]` }));
    land();
    const third = dispatchReview();

    assert.strictEqual(section(issued(['spec-reviewer', UNIT, '--agent', third.id]).brief, 'The sections to review'), [
      `The spec: \`${statePath(dir, SPEC)}\``,
      `The sections changed since ${first.id}, the last pass reported:`,
      `### 2.1 Where\n\n2.1.1 A refund goes back to the card. [${made.where}]\n\n2.1.2 Refunds are instant, to the card. [${made.where}]`,
      '§2.2 is no longer in the spec.',
    ].join('\n\n'));
  });

  it('11.S21: a fact the review shows wrong, replaced at the spec, stands on its topic and affects the decision relying on it', () => {
    const faster = write('replace', AT_SPEC, ['--replaces', made.speed, '--reason', 'was-wrong'], {
      ...MADE, drops: ['300 ms'], text: 'A charge takes 450 ms.', how: 'timed on the bench', known: 'measured', command: 'npm run bench -- charge', result: '450 ms',
    }).id;
    const affected = ok(dir, ['ledger', 'affected', UNIT, 'cards']);
    const line = ledgerLines().find((entry) => entry.id === full(faster));

    assert.deepStrictEqual([line.topic, line.phase], [null, 'specification']);
    assert.deepStrictEqual(affected.affected.map((/** @type {{id: string}} */ entry) => entry.id), [made.one]);
    assert.ok(ok(dir, ['ledger', 'record', UNIT, 'cards']).findings.some((/** @type {{id: string}} */ entry) => entry.id === faster), 'the replacement stands on its topic (5.6.16)');
  });
});

describe('the spec reviewer\'s brief refused, nothing stored', () => {
  it('a spec this checkout holds no land of, and one written since it landed', () => {
    writeSpec(spec());
    const pass = dispatchReview();
    const unlanded = refusedUnissued(['spec-reviewer', UNIT, '--agent', pass.id]);
    land();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));

    assert.deepStrictEqual([unlanded, refusedUnissued(['spec-reviewer', UNIT, '--agent', pass.id])], [
      `brief: this checkout holds no land of ${UNIT}'s spec — a land is kept in the checkout's own cache, so engine spec land ${UNIT} lands it here before its review`,
      `brief: ${UNIT}'s spec.md has changed since it landed — engine spec land ${UNIT} lands it before its review`,
    ]);
  });

  it('a dispatch the unit\'s store lacks, one of another kind, and one bound to another landing of the spec', () => {
    writeSpec(spec());
    land();
    const other = ok(dir, ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'review']);
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();

    assert.deepStrictEqual([
      refusedUnissued(['spec-reviewer', UNIT, '--agent', 'spec-review-009']),
      refusedUnissued(['spec-reviewer', UNIT, '--agent', other.id]),
      refusedUnissued(['spec-reviewer', UNIT, '--agent', pass.id]),
    ], [
      `brief: ${UNIT}'s spec has no agent spec-review-009 — \`engine agent dispatch\` records one, and --agent names the id it answers`,
      `brief: ${other.id} is a review dispatch, and the spec-reviewer's brief is for a spec-review`,
      `brief: ${pass.id} was briefed on another landing of the spec — a pass reviews the spec it was first briefed on, so dispatch another`,
    ]);
  });
});

describe('review-settled (6.4.7, 11.7.6, 11.S11, E3)', () => {
  it('(a): holds once the latest reported pass reviewed the spec as it stands — open before any pass, while the first runs, once a section changes, landed or not, and while the pass on it was abandoned unreported; blank lines, and areas and parts moved, change nothing, a pass refused as having nothing to read; an entry made at another unit\'s spec, though it stands on this one, or on a topic, leaves it so', () => {
    const states = [reviewSettled()];
    writeSpec(spec());
    land();
    const first = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', first.id]);
    states.push(reviewSettled());
    reportIn(first);
    acked(first);
    states.push(reviewSettled());
    writeSpec(spaced(moved(spec(), '## 1. Cards', '## 2. Refunds', '')));
    states.push(reviewSettled());
    writeSpec(moved(spec(), '### 1.1 The form', '### 1.2 The charge', '## 1-S.'));
    const reordered = land().changed;
    states.push(reviewSettled());
    const refused = nothingToRead();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    states.push(reviewSettled());
    land();
    states.push(reviewSettled());
    const abandoned = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', abandoned.id]);
    unread(abandoned);
    states.push(reviewSettled());
    cleanPass();
    write('replace', 'billing.specification', ['--replaces', made.posted, '--reason', 'was-wrong'], { ...MADE, drops: ['a day'], text: 'A refund posts within two days.', how: 'read in the code', known: 'read' });
    write('find', CARDS, [], { ...MADE, text: 'Amex is asked for.', how: 'read in the support tickets', known: 'documented' });
    states.push(reviewSettled());

    assert.deepStrictEqual([reordered, refused], [[], unchangedSince(first, 'its review has settled')]);
    assert.deepStrictEqual(states, ['open', 'open', 'done', 'done', 'done', 'open', 'open', 'open', 'done']);
  });

  it('(a): an edit of the title or the introduction sends the spec to another pass, which reviews it alone', () => {
    writeSpec(spec());
    land();
    const first = cleanPass();
    writeSpec(spec().replace('# Payments\n', '# Payments\n\nThe card payments of the shop.\n'));
    const edited = reviewSettled();
    land();
    const second = dispatchReview();
    const { brief } = issued(['spec-reviewer', UNIT, '--agent', second.id]);
    reportIn(second);
    acked(second);

    assert.strictEqual(section(brief, 'The sections to review', 'Lines that do not trace'), [
      `The spec: \`${statePath(dir, SPEC)}\``,
      `The sections changed since ${first.id}, the last pass reported:`,
      '# Payments\n\nThe card payments of the shop.',
    ].join('\n\n'));
    assert.deepStrictEqual([edited, reviewSettled()], ['open', 'done']);
  });

  it('(c) and (d): a gap waiting holds it open though nothing waits for the writer, and its answer waits for the writer\'s brief and the land after it, a brief again before the land carrying it again; an entry made while the writer writes waits for its next brief, past the land and a clean pass', () => {
    const gap = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
    writeSpec(spec());
    land();
    const first = cleanPass();
    const waiting = [reviewSettled(), nothingToRead()];
    const answer = write('decide', AT_SPEC, ['--answers', gap], { ...PERSON, text: 'Never.', why: 'The bank matches one refund to one charge.' }).id;
    const answered = [reviewSettled(), nothingToRead()];
    const taken = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    const pending = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief')];
    land();
    const settled = reviewSettled();
    issued(['spec-writer', UNIT]);
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever partial?' }).id;
    const own = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never.', why: 'A refund returns the whole charge.' }).id;
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, and whole.' }));
    land();
    cleanPass();
    const writing = reviewSettled();
    const next = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    land();

    assert.deepStrictEqual(waiting, ['open', unchangedSince(first, `the gap ${gap}, asked at the spec, waits on the person, and the writer's brief follows the answer`)]);
    assert.deepStrictEqual(answered, ['open', unchangedSince(first, `${WRITER}1 entry made at the spec`)]);
    assert.strictEqual(taken, `- ${answer} decision, the unit's own: Never.`);
    assert.deepStrictEqual([pending, settled], [['open', taken], 'done']);
    assert.deepStrictEqual([writing, next, reviewSettled()], ['open', [`- ${asked} question, the unit's own: Is a refund ever partial?`, `- ${own} decision, the unit's own: Never.`].join('\n'), 'done']);
  });

  it('(d): only a current entry made at the spec waits — the writer shown what the way on counts, each with where it stands, never an entry replaced since or an asset linked', () => {
    writeSpec(spec());
    land();
    const first = cleanPass();
    const found = write('find', AT_SPEC, [], { ...MADE, text: 'A refund posts within a day.', how: 'read in the code', known: 'read' }).id;
    const later = write('replace', AT_SPEC, ['--replaces', found, '--reason', 'was-wrong'], { ...MADE, drops: ['a day'], text: 'A refund posts within two days.', how: 'read in the code', known: 'read' }).id;
    const tax = write('replace', AT_SPEC, ['--replaces', made.tax, '--reason', 'was-wrong'], { ...PERSON, drops: ['line'], text: 'Per invoice.', why: 'The invoice is taxed whole.' }).id;
    const waiting = nothingToRead();
    const drawn = section(issued(['spec-writer', UNIT]).brief, 'Written since your last brief');
    land();
    const taken = reviewSettled();
    writeState(dir, layout.assets(UNIT, 'posting.md'), '# Posting\n');
    ok(dir, ['asset', 'add', UNIT, layout.assets(UNIT, 'posting.md'), '--entry', later, '--status', 'canonical'], { env: SESSION });

    assert.strictEqual(waiting, unchangedSince(first, `${WRITER}2 entries made at the spec`));
    assert.strictEqual(drawn, [
      `- ${later} finding, the unit's own, replacing ${found}: A refund posts within two days.`,
      `- ${tax} decision, made here, standing on billing/invoices, replacing ${made.tax}: Per invoice.`,
    ].join('\n'));
    assert.deepStrictEqual([taken, reviewSettled()], ['done', 'done']);
  });

  it('(d): a gap or a fact finding waits to be surfaced, never for the writer, its brief and the land after it leaving it, until the store raises it or the pass\'s incorporation declines it', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    const brief = section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings');
    land();
    const surfacing = [reviewSettled(), nothingToRead()];
    ok(dir, ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1']);
    const raised = [reviewSettled(), nothingToRead()];
    unread(pass);

    assert.strictEqual(brief, 'None recorded.');
    assert.deepStrictEqual(surfacing, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: the gap F1 of ${pass.id} raised, the fact F2 of ${pass.id} replaced`)]);
    assert.deepStrictEqual(raised, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: the fact F2 of ${pass.id} replaced`)]);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('(d): every reported pass with a rewrite finding the last committed take did not carry waits for the writer — one acknowledged and incorporated beside a later clean one; the writer\'s brief carries each verbatim with the lines that do not trace, a brief again before a land settling nothing and carrying it again, a writer landing the spec unchanged settling it and one changing a section sending it to another pass', () => {
    writeSpec(spec());
    land();
    const [found, clean] = [dispatchReview(), dispatchReview()];
    issued(['spec-reviewer', UNIT, '--agent', found.id]);
    issued(['spec-reviewer', UNIT, '--agent', clean.id]);
    reportIn(found, FOUND);
    acked(found, ['F1']);
    unread(found);
    reportIn(clean);
    acked(clean);
    const beside = [reviewSettled(), nothingToRead()];
    const { brief } = issued(['spec-writer', UNIT]);
    const unlanded = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings')];
    land();
    const taken = reviewSettled();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();

    assert.deepStrictEqual(beside, ['open', unchangedSince(clean, `${WRITER}the report of ${found.id}`)]);
    assert.deepStrictEqual([section(brief, 'The review\'s findings'), section(brief, 'Lines that do not trace')], [FOUND, '- 2.1.2: cites no entry']);
    assert.deepStrictEqual(unlanded, ['open', FOUND]);
    assert.deepStrictEqual([taken, reviewSettled()], ['done', 'open']);
  });

  it('(d): a pass is read before any finding is declined — its incorporation refused once its report is in, scanned or not, until it is acknowledged, with exactly its report\'s findings, --clean refused while it holds any; the way on naming the acknowledgement first', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    const unscanned = storeRefusal('incorporate', pass.id);
    scan();
    const refusals = [storeRefusal('incorporate', pass.id), storeRefusal('ack', pass.id, '--clean'), storeRefusal('ack', pass.id, '--findings', 'F1')];
    const waiting = [reviewSettled(), nothingToRead()];
    ok(dir, ['agent', 'ack', UNIT, 'specification', UNIT, pass.id, '--findings', 'F2,F1']);
    const unread = `Agent "${pass.id}" is a spec review whose report is in, not yet acknowledged — agent ack records its findings first (agent scan takes the report in)`;
    const exactly = `Agent "${pass.id}" is a spec review whose report holds F1, F2 — it is acknowledged with exactly its report's findings`;

    assert.deepStrictEqual([unscanned, ...refusals], [unread, unread, exactly, exactly]);
    assert.deepStrictEqual(waiting, ['open', unchangedSince(pass, `the review's findings wait to be surfaced: ${pass.id} acknowledged, then the gap F1 of ${pass.id} raised, the fact F2 of ${pass.id} replaced`)]);
    assert.strictEqual(nothingToRead(), unchangedSince(pass, `the review's findings wait to be surfaced: the gap F1 of ${pass.id} raised, the fact F2 of ${pass.id} replaced`));
  });

  it('(a) and (d): a pass abandoned in flight is ignored whole when its report lands after — never taken in, never the pass that reviewed the spec, its findings neither waiting nor carried', () => {
    writeSpec(spec());
    land();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const late = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', late.id]);
    unread(late);
    reportIn(late, `${LANED}\n\n### F3: refunds are not instant\n\n**Lane:** rewrite\n\n2.1.2 cites nothing.`);
    const scanned = scan();
    const ignored = [reviewSettled(), section(issued(['spec-writer', UNIT]).brief, 'The review\'s findings')];
    land();
    cleanPass();

    assert.deepStrictEqual([scanned.pending, scanned.refused], [[], undefined]);
    assert.deepStrictEqual(ignored, ['open', 'None recorded.']);
    assert.strictEqual(reviewSettled(), 'done');
  });

  it('a report that does not read is refused at the scan, with what does not read and the way on — never reported, and each pass\'s brief carries the refusal until a pass\'s report is taken in', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED.replace('**Lane:** gap', '**Lane:** `gap`'));
    const { refused } = scan();
    const states = [reviewSettled(), reviewPasses(dir, UNIT)];
    const next = dispatchReview();
    const carried = section(issued(['spec-reviewer', UNIT, '--agent', next.id]).brief, 'Reports refused');
    reportIn(next);
    scan();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const after = section(issued(['spec-reviewer', UNIT, '--agent', dispatchReview().id]).brief, 'Reports refused');
    const fault = 'line 5: F1\'s next line is its lane, `**Lane:** rewrite`, `gap` or `fact`, the bare word';

    assert.deepStrictEqual(refused, [{ id: pass.id, refusal: `${pass.id}'s report does not read as a spec review: ${fault} — it is set aside unread; dispatch another pass, and its brief carries this refusal` }]);
    assert.deepStrictEqual(states, ['open', []]);
    assert.deepStrictEqual([carried, after], [`- ${pass.id}: ${fault}`, 'None recorded.']);
  });

});
