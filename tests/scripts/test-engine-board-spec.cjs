'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a specification (leeway-engine/scripts/domain/
// projections/board-spec.cjs, 20.9): the spec's sections, each with the
// passes that changed it and whether a pass running reads it; the review's
// passes newest first, each with its calls and the person's as its findings
// stand, a running one with its clock and what it reads; each gap waiting on
// the person by its entry, its words, the pass and finding that raised it
// and its sections; Claude's calls since the list was last drawn — read
// without looking (5.8.14) — each with its question, pass and sections; the
// cut, and whose ready to build waits on, counted wherever what waits is
// (20.16, 20.15.1); a section's page, a pass's and a finding's (D23).
//
// Layer: verb. World: spec-review-world.cjs's — the epic `payments`, its two
// topics decided — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { ok, readState, writeState, readManifest, layout } = require('./engine-harness.cjs');
const { fixture, misfits, emptyLists, standingOn } = require('./board-world.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION_ID, SESSION, MADE, PERSON, AT_SPEC, LANED, OWNER, STORE, made, useSpecReviewWorld, specReviewHelpers,
} = require('./spec-review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { passesInFlight } = require(path.join(SCRIPTS, 'domain/agent-state.cjs'));
const { titlecase } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

const dir = useSpecReviewWorld();
const { write, entries } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, dispatchReview, reportIn, acked, cleanPass,
} = specReviewHelpers(dir);

/** The board's view and banner for the world's conversation, at the unit's specification. @param {string[]} [args] */
function board(args = []) {
  ok(dir(), ['session', 'label', UNIT, 'specification', UNIT], { env: SESSION });
  const { view, banner } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
  return { view, banner };
}

/** A banner fact. @param {string} text @param {boolean} [needs] */
const fact = (text, needs = false) => ({ text, needs });

/** Claude's call the world made on a topic of the unit, which no look has shown: no pass asked its question. */
const RADIUS = () => ({ id: made.radius, text: 'Ten points.', question: 'What radius are the corners?', pass: null, finding: null, sections: [] });

/**
 * The ledger's last entry's time, to the second, moved on by `ms`, and a
 * pass's dispatch put then in the agent store.
 */
const lastAt = (ms = 0) => new Date(Date.parse(entries().at(-1).at) + ms).toISOString();
/** @param {{id: string}} pass @param {string} created */
function dispatchedAt({ id }, created) {
  const store = JSON.parse(readState(dir(), STORE));
  store.agents[id].created = created;
  writeState(dir(), STORE, JSON.stringify(store));
}

/** The spec written and landed. */
function landed() {
  writeSpec(spec());
  land();
}

/** A pass reported with LANED's two findings and acknowledged with them, the spec written and landed. */
function lanedPass() {
  landed();
  const pass = dispatchReview();
  issued(['spec-reviewer', UNIT, '--agent', pass.id]);
  reportIn(pass, LANED);
  acked(pass, ['F1', 'F2']);
  return pass;
}

/** A question asked at the spec citing Refunds, and the pass's finding F1 surfaced as it. @param {{id: string}} pass @param {string} text */
function askedAs(pass, text) {
  const asked = write('ask', AT_SPEC, [], { ...MADE, by: 'review', text, cites: [{ path: `${UNIT}/spec.md`, section: '2. Refunds' }] }).id;
  ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--question', asked]);
  return asked;
}

/**
 * A question asked at the spec before it was written, and a replacement the
 * first pass, dispatched after it, raised. @returns {string} the question's id
 */
function bothWaiting() {
  const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
  landed();
  const pass = dispatchReview();
  issued(['spec-reviewer', UNIT, '--agent', pass.id]);
  reportIn(pass, LANED);
  acked(pass, ['F1', 'F2']);
  ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--replaces', made.where, '--reason', 'changed-mind']);
  dispatchedAt(pass, lastAt(1000));
  return asked;
}

describe('a specification on the board (20.9)', () => {
  it('before the spec is written: no section, no pass, nothing waiting; the banner says it is being written; the view names the project, as the drawing does', () => {
    assert.deepStrictEqual(board(), {
      view: {
        kind: 'spec', unit: UNIT, title: 'Payments', type: 'epic', project: titlecase(path.basename(dir())), sections: [], passes: [], waiting: [], since: [RADIUS()], cut: [], ready: 'review',
      },
      banner: { name: 'Payments', state: 'running', facts: [fact('epic'), fact('specification'), fact('being written')] },
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

  it('20.9.1: a question asked at the spec and a replacement the review raised each wait on the person by its entry and words, the pass that raised it and the sections citing what it is about; the pass\'s finds split into Claude\'s calls and the person\'s; the banner says the next pass waits on them, plain, the count waiting flagged (20.2.4)', () => {
    const asked = bothWaiting();
    const { view, banner } = board();

    assert.deepStrictEqual({ passes: view.passes, waiting: view.waiting, banner }, {
      passes: [{ pass: 1, found: 2, calls: 1, yours: 1, state: 'read', since: null, reads: null }],
      waiting: [
        { id: asked, text: 'Is a refund ever split?', pass: null, finding: null, sections: [] },
        { id: made.where, text: 'Back to the card.', pass: 1, finding: 'F1', sections: ['2'] },
      ],
      banner: { name: 'Payments', state: 'needs', facts: [fact('epic'), fact('specification'), fact('pass 2 waits on you'), fact('2 waiting on you', true)] },
    });
  });

  it('All work counts what waits in the unit as its banner does — the question asked at the spec and the replacement raised — the project\'s total summing each unit\'s (20.16, 20.2.4)', () => {
    bothWaiting();
    const { view } = board(['--tab', 'all']);

    assert.deepStrictEqual({ units: view.units.map(({ unit, waiting }) => [unit, waiting]), total: view.waiting }, { units: [['billing', 0], [UNIT, 2]], total: 2 });
  });

  it('D23: a question a pass\'s finding was asked as is that pass\'s and that finding\'s, with the sections it cites, and stays theirs once reworded; one no finding was asked as is no pass\'s, however soon after a pass it was asked', () => {
    const pass = lanedPass();
    const asked = askedAs(pass, 'Is a refund ever split?');
    const loose = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever late?' }).id;
    dispatchedAt(pass, lastAt(-1000));
    const linked = board().view.waiting;
    const reworded = write('replace', AT_SPEC, ['--replaces', asked, '--reason', 'was-wrong'], { ...MADE, drops: [], text: 'Is a refund ever split in two?', cites: [{ path: `${UNIT}/spec.md`, section: '2. Refunds' }] }).id;

    assert.deepStrictEqual([linked, board().view.waiting], [
      [{ id: asked, text: 'Is a refund ever split?', pass: 1, finding: 'F1', sections: ['2'] }, { id: loose, text: 'Is a refund ever late?', pass: null, finding: null, sections: [] }],
      [{ id: loose, text: 'Is a refund ever late?', pass: null, finding: null, sections: [] }, { id: reworded, text: 'Is a refund ever split in two?', pass: 1, finding: 'F1', sections: ['2'] }],
    ]);
  });

  it('D23: a finding asked as a question waits on the person while it is open, is theirs once they answer it and Claude\'s once Claude does; any other finding is Claude\'s — the pass\'s count of the person\'s and of Claude\'s calls as they stand, and Claude\'s answer since the person last looked carries its pass, finding and sections (20.9.1)', () => {
    const pass = lanedPass();
    const asked = askedAs(pass, 'Is a refund ever split?');
    const waits = board();
    const call = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never split.', why: 'A refund returns the whole charge.', cites: [{ path: `${UNIT}/spec.md`, section: '2. Refunds' }] }).id;
    const claudes = board();
    write('decide', AT_SPEC, ['--answers', asked], { ...PERSON, given: 'own', text: 'Split when asked.', why: 'A shop may refund part.' });
    const yours = board();
    const found = (/** @type {{view: any}} */ { view }) => view.passes.map(({ found: all, calls, yours: theirs }) => [all, calls, theirs]);
    const standings = () => board(['--page', 'pass:1']).view.found.map(({ standing }) => standing);
    const page = board(['--page', 'pass:1']).view;

    assert.deepStrictEqual([found(waits), found(claudes), found(yours)], [[[2, 1, 1]], [[2, 2, 0]], [[2, 1, 1]]]);
    assert.deepStrictEqual(claudes.view.since.at(-1), { id: call, text: 'Never split.', question: 'Is a refund ever split?', pass: 1, finding: 'F1', sections: ['2'] });
    assert.deepStrictEqual([standings(), page.reads, page.changed], [['yours', 'claude'], null, []]);
  });

  it('D23: a finding asked as a question stands with whoever answered the question it grew into — waiting while it is open once reworded, Claude\'s once Claude answers it, the person\'s once it is merged into their decision', () => {
    const pass = lanedPass();
    const asked = askedAs(pass, 'Is a refund ever split?');
    const reworded = write('replace', AT_SPEC, ['--replaces', asked, '--reason', 'was-wrong'], { ...MADE, drops: [], text: 'Is a refund ever split in two?' }).id;
    const standing = () => board(['--page', 'pass:1']).view.found[0].standing;
    const open = standing();
    const other = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever partial?' }).id;
    const into = write('decide', AT_SPEC, ['--answers', other], { ...PERSON, given: 'own', text: 'Only when asked.', why: 'A shop may refund part.' }).id;
    const duplicate = write('decide', AT_SPEC, ['--answers', reworded], { ...MADE, given: 'own', text: 'Never split.', why: 'A refund returns the whole charge.' }).id;
    const claudes = standing();
    write('merge', AT_SPEC, ['--question', reworded, '--into', into, '--duplicate', duplicate], MADE);

    assert.deepStrictEqual([open, claudes, standing()], ['waits', 'claude', 'yours']);
  });

  it('20.15.1 LATELY: each reported pass, when it was dispatched, with what it found as its findings stand — the first reading the whole spec — and the spec landed with its sections', () => {
    const first = lanedPass();
    const asked = askedAs(first, 'Is a refund ever split?');
    write('decide', AT_SPEC, ['--answers', asked], { ...PERSON, given: 'own', text: 'Never split.', why: 'A refund returns the whole charge.' });
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    // A commit is dated to the second: the land waits for the next one, so it stands after the first pass, dated to the millisecond.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000 - (Date.now() % 1000));
    land();
    const second = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', second.id]);
    reportIn(second, LANED);
    acked(second, ['F1', 'F2']);
    const created = (/** @type {{id: string}} */ { id }) => new Date(JSON.parse(readState(dir(), STORE)).agents[id].created).toISOString();
    const { lately } = board(['--tab', 'unit']).view;

    assert.deepStrictEqual(lately.filter(({ kind }) => kind === 'pass' || kind === 'spec-landed').map(({ kind, at, detail }) => [kind, kind === 'pass' ? at : null, detail]), [
      ['pass', created(second), '2 found 2 · 2 calls, 0 yours'],
      ['spec-landed', null, '2 sections'],
      ['pass', created(first), '1 read the whole specification · found 2'],
      ['spec-landed', null, '2 sections'],
    ]);
  });

  it('20.2.4: while a pass runs with a question waiting, the banner says where the review stands, then the count waiting flagged — never the next pass waiting on the person', () => {
    write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' });
    landed();
    issued(['spec-reviewer', UNIT, '--agent', dispatchReview(OWNER.running).id]);

    assert.deepStrictEqual(board().banner.facts.slice(2), [fact('pass 1 reading'), fact('1 waiting on you', true)]);
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

    assert.deepStrictEqual([view.passes.map(({ state, found }) => [state, found]), view.ready, banner.facts], [[['read', 2]], 'review', [fact('epic'), fact('specification'), fact('being written')]]);
  });

  it('D39: once the review settles, ready to build waits on the person, the banner counting its yes as waiting on them (20.2.4)', () => {
    landed();
    cleanPass();
    const { view, banner } = board();

    assert.deepStrictEqual([view.ready, banner], ['person', { name: 'Payments', state: 'needs', facts: [fact('epic'), fact('specification'), fact('ready to build'), fact('1 waiting on you', true)] }]);
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

  it('S1: a gap waiting stands on every view that reads the unit — the epic\'s DEFINITION waiting on the person\'s answer, All work\'s count and total — as the banner has it (20.16, 20.8.2, 20.2.4)', () => {
    askedAs(lanedPass(), 'Is a refund ever split?');

    assert.deepStrictEqual(standingOn(board, UNIT), {
      tab: { now: 'specification', spec: 'asking', build: 'waits', waiting: [] },
      all: { phase: 'specification', standing: '2 of 2 topics decided', waiting: 1, total: 1 },
      banner: { state: 'needs', flagged: ['1 waiting on you'] },
    });
  });

  it('S1, N1: ready to build\'s yes stands on every view that reads the unit — the epic\'s DEFINITION waiting on it, All work\'s count and total, no other unit counted — as the banner has it (20.16, 20.8.2, 20.2.4)', () => {
    landed();
    cleanPass();

    assert.deepStrictEqual([standingOn(board, UNIT), board(['--tab', 'all']).view.units.map(({ unit, waiting }) => [unit, waiting])], [
      {
        tab: { now: 'specification', spec: 'ready', build: 'waits', waiting: [] },
        all: { phase: 'specification', standing: '2 of 2 topics decided', waiting: 1, total: 1 },
        banner: { state: 'needs', flagged: ['1 waiting on you'] },
      },
      [['billing', 0], [UNIT, 1]],
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
