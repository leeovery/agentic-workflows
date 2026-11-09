'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a specification (leeway-engine/scripts/domain/
// projections/board-spec.cjs, 20.9): the spec's sections, each with the
// passes that changed it and whether a pass running reads it; the review's
// passes newest first, each with its calls and the person's as its findings
// stand, a running one with its clock and what it reads, and the banner
// between passes; Claude's calls since the list was last drawn — read
// without looking (5.8.14); LATELY (20.15.1); a section's page, a pass's and
// a finding's (D23); and the mod's fixtures held to the engine's shape. What
// waits on the person: test-engine-board-spec-waits.cjs.
//
// Layer: verb. World: spec-review-world.cjs's — the epic `payments`, its two
// topics decided — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { ok } = require('./engine-harness.cjs');
const { datedAt } = require('./discovery-test-utils.cjs');
const { fixture, misfits, emptyLists, place } = require('./board-world.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION, MADE, PERSON, AT_SPEC, LANED, OWNER, made, useSpecReviewWorld, specReviewHelpers,
} = require('./spec-review-world.cjs');
const { fact, gap, RADIUS, specBoard } = require('./spec-board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { passesInFlight } = require(path.join(SCRIPTS, 'domain/agent-state.cjs'));
const { titlecase } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

const dir = useSpecReviewWorld();
const { write, entries } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, dispatchReview, reportIn, acked, cleanPass,
} = specReviewHelpers(dir);
const { board, lastAt, dispatchedAt, landed, lanedPass, askedAs } = specBoard(dir);

describe('a specification on the board (20.9)', () => {
  it('before the spec is written: no section, no pass, nothing waiting; the banner says it is being written; the view names the project, as the drawing does', () => {
    assert.deepStrictEqual(board(), {
      view: {
        kind: 'spec', unit: UNIT, title: 'Payments', type: 'epic', project: titlecase(path.basename(dir())), sections: [], passes: [], waiting: [], since: [RADIUS()], cut: [], given: false,
      },
      banner: { name: 'Payments', state: 'running', facts: [place('epic'), place('specification'), fact('being written')] },
    });
  });

  it('the spec\'s areas in its order, each with the passes that changed it and whether a pass running reads it; a pass running numbered after those reported, newest first, since it was dispatched, with what it reads; the banner names the pass reading (20.9.1)', () => {
    landed();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const running = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', running.id]);
    const [{ created }] = passesInFlight(dir(), UNIT);
    const { view, banner } = board();
    const epic = board(['--tab', 'unit', '--unit', UNIT]).view.spec;
    const all = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ line) => line.unit === UNIT).standing;

    assert.deepStrictEqual([epic, all], [{ state: 'running', words: 'pass 2 reading', session: 'this' }, 'pass 2 reading'], 'N4: the epic\'s page says what the spec is doing as All work and the banner do');
    assert.deepStrictEqual({ sections: view.sections, passes: view.passes, facts: banner.facts.slice(2) }, {
      sections: [{ number: '1', title: 'Cards', changed_by: [], reading: false }, { number: '2', title: 'Refunds', changed_by: [1], reading: true }],
      passes: [
        { pass: 2, found: 0, calls: 0, yours: 0, state: 'running', since: created, reads: ['2'] },
        { pass: 1, found: 0, calls: 0, yours: 0, state: 'read', since: null, reads: null },
      ],
      facts: [fact('pass 2 reading')],
    });
  });

  it('a section is changed by each pass after whose report a land changed it, and by none before — Refunds after pass 1, Cards only after pass 2 (20.9.1)', () => {
    const instant = '2.1.2 Refunds are instant, always.';
    landed();
    cleanPass();
    writeSpec(spec({ instant }));
    land();
    cleanPass();
    writeSpec(spec({ instant, charge: `1.2.1 A charge is one request, and takes 200 ms. [${made.one}, ${made.speed}]` }));
    land();
    cleanPass();

    assert.deepStrictEqual(board().view.sections.map(({ changed_by: by }) => by), [[2], [1]]);
  });

  it('20.15.1 LATELY: each reported pass, when it was dispatched, with what it found as its findings stand — the first reading the whole spec — each question a pass asked the person, when it was asked, and the spec landed with its sections', () => {
    const first = lanedPass();
    const asked = askedAs(first, 'Is a refund ever split?');
    write('decide', AT_SPEC, ['--answers', asked], { ...PERSON, given: 'own', text: 'Never split.', why: 'A refund returns the whole charge.' });
    const askedOn = entries().find(({ id }) => id.startsWith(asked) || id === asked)?.at;
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    const later = (/** @type {number} */ s) => new Date(Date.parse(lastAt()) + s * 1000).toISOString();
    dispatchedAt(first, later(1));
    datedAt(later(2), land);
    const second = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', second.id]);
    reportIn(second, LANED);
    acked(second, ['F1', 'F2']);
    dispatchedAt(second, later(3));
    const { lately } = board(['--tab', 'unit']).view;

    assert.deepStrictEqual(lately.filter(({ kind }) => kind === 'pass' || kind === 'spec-landed' || kind === 'asked').map(({ kind, at, detail }) => [kind, kind === 'spec-landed' ? null : at, detail]), [
      ['pass', later(3), '2 found 2 · 2 calls, 0 yours'],
      ['spec-landed', null, '2 sections'],
      ['pass', later(1), '1 read the whole specification · found 2'],
      ['asked', askedOn, '1 asked you about is a refund split?'],
      ['spec-landed', null, '2 sections'],
    ]);
  });

  it('a pass out is shown by where the agent store stands it — lost once the conversation that sent it is gone, its report in once written, not yet taken — and the banner says so (20.9.1, 20.2.4)', () => {
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    const lost = board();
    reportIn(pass);
    const landedIn = board();
    const shown = (/** @type {{view: any, banner: any}} */ { view, banner }) => [view.passes.map(({ pass: k, state }) => [k, state]), banner.facts.at(-1)];

    assert.deepStrictEqual([shown(lost), shown(landedIn)], [[[[1, 'lost']], fact('pass 1 lost')], [[[1, 'landed']], fact('pass 1\'s report in')]]);
  });

  it('D25: between passes, after a pass that found something, the banner says the spec is being written, never that a pass changed nothing (20.2.4)', () => {
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    const { view, banner } = board();

    assert.deepStrictEqual([view.passes.map(({ state, found }) => [state, found]), view.waiting, banner.facts], [[['read', 2]], [], [place('epic'), place('specification'), fact('being written')]]);
  });

  it('5.8.14: Claude\'s calls on the unit since the list was last drawn stay listed however often the board is drawn, and none once it is', () => {
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever partial?' }).id;
    const call = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never.', why: 'A refund returns the whole charge.' }).id;
    const drawn = [board().view.since, board().view.since];
    ok(dir(), ['ledger', 'shown', UNIT], { env: SESSION });
    const calls = [RADIUS(), { id: call, text: 'Never.', question: 'Is a refund ever partial?', pass: null, finding: null, sections: [] }];

    assert.deepStrictEqual([...drawn, board().view.since], [calls, calls, []]);
  });

  it('20.9.2: a section opens on its own page, with the passes that changed it, its words its statements\' alone — no heading, number, cite or scenario; one the spec lacks is unavailable, saying why', () => {
    landed();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const { title, kind, changed_by: by, text } = board(['--page', 'section:2']).view;

    assert.deepStrictEqual([[title, kind, by, text], board(['--page', 'section:1']).view, board(['--page', 'section:9']).view], [
      ['Refunds', 'section', [1], 'A refund goes back to the card.\n\nRefunds are instant, always.'],
      {
        kind: 'section', unit: UNIT, number: '1', title: 'Cards', changed_by: [],
        text: 'Visa and Mastercard are taken, as the [charge flow](assets/flow.md) shows.\n\nCorners are ten points.\n\nA charge is one request, and takes 300 ms.',
      },
      { kind: 'unavailable', reason: 'payments\'s spec holds no section 9' },
    ]);
  });

  it('20.9.2, D23: a pass opens on its own page — what it read, the whole spec for the first and what the pass before changed for the next, what it changed, and each finding by its label as it stands; one not reported is unavailable, saying why', () => {
    const first = lanedPass();
    askedAs(first, 'Is a refund ever split?');
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    cleanPass();

    assert.deepStrictEqual([board(['--page', 'pass:1']).view, board(['--page', 'pass:2']).view, board(['--page', 'pass:3']).view], [
      {
        kind: 'pass', unit: UNIT, title: 'Payments', pass: 1, reads: null, changed: ['2'],
        found: [{ finding: 'F1', label: 'is a refund split?', standing: 'waits' }, { finding: 'F2', label: 'a charge is slower', standing: 'claude' }],
      },
      { kind: 'pass', unit: UNIT, title: 'Payments', pass: 2, reads: ['2'], changed: [], found: [] },
      { kind: 'unavailable', reason: 'payments\'s review holds no reported pass 3' },
    ]);
  });

  it('20.9.2, D23: a finding opens on its own page — its label and lane, where it stands, the sections the question it was asked as touches, and its text in the report; one the pass lacks is unavailable, saying why', () => {
    askedAs(lanedPass(), 'Is a refund ever split?');

    assert.deepStrictEqual([board(['--page', 'pass:1:F1']).view, board(['--page', 'pass:1:F2']).view.sections, board(['--page', 'pass:1:F3']).view], [
      { kind: 'spec-finding', unit: UNIT, title: 'Payments', pass: 1, finding: 'F1', label: 'is a refund split?', lane: 'gap', standing: 'waits', sections: ['2'], text: 'No entry decides it.' },
      [],
      { kind: 'unavailable', reason: 'payments\'s pass 1 holds no finding F3' },
    ]);
  });
});

describe('the views the mod draws, shaped as the engine answers them (N8)', () => {
  it('the specification with its sections and the passes that changed them, a pass that found a gap still waiting, Claude\'s calls since and the phase cut; and a pass\'s page, what it changed and each finding as it stands', async () => {
    lanedPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const second = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', second.id]);
    reportIn(second, LANED);
    acked(second, ['F1', 'F2']);
    askedAs(second, 'Is a refund ever split?');
    const cut = path.join(dir(), '.leeway', '.cache', 'cut.json');
    fs.mkdirSync(path.dirname(cut), { recursive: true });
    fs.writeFileSync(cut, JSON.stringify({ phases: [{ name: 'Cards', goal: 'A card is charged.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }] }));
    ok(dir(), ['cut', UNIT, '--file', cut]);
    const fits = (/** @type {any} */ held, /** @type {any} */ view) => ({ misfits: misfits(held, view), fixture: emptyLists(held), engine: emptyLists(view) });
    const FITS = { misfits: [], fixture: [], engine: [] };

    assert.deepStrictEqual(
      [fits(await fixture('board-spec.mjs'), board().view), fits(await fixture('board-pass.mjs'), board(['--page', 'pass:1']).view)],
      [FITS, FITS],
    );
  });
});
