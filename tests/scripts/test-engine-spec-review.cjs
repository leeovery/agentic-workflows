'use strict';

// ---------------------------------------------------------------------------
// The spec's writer and its reviewer (leeway-engine/scripts/domain/
// brief-records.cjs, their records; domain/spec-passes.cjs, what changed; the
// templates content/briefs/spec-writer.md and spec-reviewer.md): `engine
// brief spec-writer <unit>`, the land's record and `engine brief
// spec-reviewer <unit> --agent <id>`.
//
// The writer's brief, for the unit (11.S2): where the spec goes, every live
// topic's entries under its title, then the unit's own, then those it made
// standing in another unit, each topic's log, the canonical assets, the
// sweep's calls, what waits for it — the entries made at the spec since the
// last take a land committed, a gap's answer among them (11.S20) — the lines
// that do not trace and what the land refuses of the spec as written; its
// template's example read by the spec's own grammar; refused for a unit the
// land refuses, and while a gap put to the person is open. The land keeps
// the print of what it landed — each section's own text hashed, the title
// and introduction one of them — a section's changing alone with it, and
// blank lines between sections changing none (E4). The reviewer's brief, for
// a pass dispatched in the unit's agent store: every section at the first
// pass, then only those changed since the last pass reported, and those gone
// (11.S11); the lines that do not trace, the measured findings (11.S21), the
// product-wide entries cited, the records and its report; its dispatch bound
// to the land it reviews; refused where this checkout holds no land, for a
// spec written since it landed, and a dispatch of another kind or bound to
// another landing. A fact the review shows wrong, replaced at the spec,
// stands on its topic and affects what relied on it (11.S21). What waits,
// and the reviewer's brief refused on a spec unchanged since a pass
// reported, are test-engine-spec-review-settled.cjs's; a pass's life in the
// store, test-engine-spec-review-store.cjs's.
//
// Layer: verb. World: spec-review-world.cjs's.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, statePath, readState, layout, writeState, commitAll,
} = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SPEC, SESSION_ID, PERSON, MADE, AT_SPEC, CARDS, TEMPLATES, made, payments, useSpecReviewWorld, specReviewHelpers, RECORDS, filledTemplate, section, spaced,
} = require('./spec-review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { specStatements } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { specEntryRefusal } = require(path.join(SCRIPTS, 'domain/spec-entry.cjs'));

const LANDED = layout.cache(UNIT, 'specification', 'landed.json');
const STORE = layout.cache(UNIT, 'specification', UNIT, 'state.json');

const dir = useSpecReviewWorld();
const { write, full, entries: ledgerLines } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, refusedUnissued, dispatchReview, reportIn, scan, unread,
} = specReviewHelpers(dir);

/** @param {string} text */
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

describe('the spec writer\'s brief (11.1.5, 11.3.2, 11.S2)', () => {
  it('11.S2: one brief for the unit, from its records alone — where the spec goes, each live topic\'s entries under its title, a "don\'t care" decision marked so, those made here standing on another unit under where they stand, each topic\'s log and the canonical assets — and nothing recorded to rewrite from or answer', () => {
    const { res, brief } = issued(['spec-writer', UNIT]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'spec-writer', agent: 'leeway-spec-writer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'spec-writer', agent: 'leeway-spec-writer', unit: UNIT, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the spec writer's, for ${UNIT}\n\n${filledTemplate('spec-writer', {
      'spec-to': `\`${statePath(dir(), SPEC)}\``,
      'unit-records': RECORDS(),
      'topic-logs': [`- \`${statePath(dir(), layout.topic(UNIT, 'cards', 'log.md'))}\``, `- \`${statePath(dir(), layout.topic(UNIT, 'refunds', 'log.md'))}\``].join('\n'),
      'canonical-assets': `- \`${statePath(dir(), layout.assets(UNIT, 'flow.md'))}\``,
      'builder-calls': 'None recorded.',
      'changed-entries': 'None recorded.',
      'review-findings': 'None recorded.',
      'invented-lines': 'None recorded.',
      'land-refusal': 'None recorded.',
    })}`);
  });

  it('the calls the sweep left to the builder, each with why — never its candidates or its messages', () => {
    writeState(dir(), layout.cache(UNIT, 'specification', 'sweep.json'), JSON.stringify({
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
    const { error } = refusedPristine(dir(), ['spec', 'land', UNIT]);
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
    payments(dir(), { refunds: 'in-progress' });
    commitAll(dir(), 'reopened');
    const open = specEntryRefusal(dir(), UNIT);
    const unsettled = refusedUnissued(['spec-writer', UNIT]);
    payments(dir(), {}, { build: { position: 'auto' } });
    commitAll(dir(), 'concluded');

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
    const first = JSON.parse(readState(dir(), LANDED));
    const mark = ledgerLines().at(-1).id;
    write('find', CARDS, [], { ...MADE, text: 'Amex is asked for.', how: 'read in the support tickets', known: 'documented' });
    writeSpec(spaced(spec({ charge: `1.2.1 A charge is one request, and takes 300 ms. [${made.one}]` })));
    const answer = land();
    const second = JSON.parse(readState(dir(), LANDED));
    writeSpec('# Payments\n');
    refusedPristine(dir(), ['spec', 'land', UNIT]);

    assert.deepStrictEqual(Object.keys(first.sections).sort(), ['1', '1.1', '1.2', '2', '2.1', 'introduction']);
    assert.deepStrictEqual([first.sections.introduction, first.sections['1.2']], [sha('# Payments'), sha(`### 1.2 The charge\n\n1.2.1 A charge is one request, and takes 300 ms. [${made.one}, ${made.speed}]`)]);
    assert.deepStrictEqual([first.first_mark, second.first_mark], [mark, mark]);
    assert.deepStrictEqual([Object.keys(first.sections).filter((address) => first.sections[address] !== second.sections[address]), answer.changed], [['1.2'], ['1.2']]);
    assert.notStrictEqual(first.digest, second.digest);
    assert.deepStrictEqual(JSON.parse(readState(dir(), LANDED)), second);
  });
});

describe('the spec reviewer\'s brief (11.7.1, 11.7.8, 11.7.9)', () => {
  it('the first pass: the spec\'s path and every section, the title and introduction first, an area\'s own text with its scenarios, the lines that do not trace, the measured findings, the product-wide entries cited, the records and its report — its dispatch bound to the land it reviews', () => {
    writeSpec(spec());
    land();
    const pass = dispatchReview();
    const { res, brief } = issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    const landed = JSON.parse(readState(dir(), LANDED));

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'spec-reviewer', agent: 'leeway-spec-reviewer', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the spec reviewer's, for ${UNIT}\n\n${filledTemplate('spec-reviewer', {
      'changed-sections': [
        `The spec: \`${statePath(dir(), SPEC)}\``,
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
    assert.deepStrictEqual(JSON.parse(readState(dir(), STORE)).agents[pass.id].land, landed);
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
      `The spec: \`${statePath(dir(), SPEC)}\``,
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
      `The spec: \`${statePath(dir(), SPEC)}\``,
      `The sections changed since ${first.id}, the last pass reported:`,
      `### 2.1 Where\n\n2.1.1 A refund goes back to the card. [${made.where}]\n\n2.1.2 Refunds are instant, to the card. [${made.where}]`,
      '§2.2 is no longer in the spec.',
    ].join('\n\n'));
  });

  it('11.S21: a fact the review shows wrong, replaced at the spec, stands on its topic and affects the decision relying on it', () => {
    const faster = write('replace', AT_SPEC, ['--replaces', made.speed, '--reason', 'was-wrong'], {
      ...MADE, drops: ['300 ms'], text: 'A charge takes 450 ms.', how: 'timed on the bench', known: 'measured', command: 'npm run bench -- charge', result: '450 ms',
    }).id;
    const affected = ok(dir(), ['ledger', 'affected', UNIT, 'cards']);
    const line = ledgerLines().find((entry) => entry.id === full(faster));

    assert.deepStrictEqual([line.topic, line.phase], [null, 'specification']);
    assert.deepStrictEqual(affected.affected.map((/** @type {{id: string}} */ entry) => entry.id), [made.one]);
    assert.ok(ok(dir(), ['ledger', 'record', UNIT, 'cards']).findings.some((/** @type {{id: string}} */ entry) => entry.id === faster), 'the replacement stands on its topic (5.6.16)');
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
    const other = ok(dir(), ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'review']);
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
