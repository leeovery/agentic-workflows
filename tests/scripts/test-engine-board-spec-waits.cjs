'use strict';

// ---------------------------------------------------------------------------
// What waits on the person in a specification on the board (leeway-engine/
// scripts/domain/projections/board-spec.cjs, 20.9.1): each gap by its entry,
// its words, the pass and finding that raised it and its sections, and whose
// a finding asked as a question is as it stands (D23); ready to build's yes
// once its screen draws (D39), and once given; the banner while they wait
// (20.2.4); and each counted wherever what waits is — the epic's page, the
// unit's tab and All work (20.16, 20.8.2). The rest of the specification's
// view: test-engine-board-spec.cjs.
//
// Layer: verb. World: spec-review-world.cjs's — the epic `payments`, its two
// topics decided — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { ok, output, statePath } = require('./engine-harness.cjs');
const { standingOn, place } = require('./board-world.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION, MADE, PERSON, AT_SPEC, OWNER, made, useSpecReviewWorld, specReviewHelpers,
} = require('./spec-review-world.cjs');
const { fact, gap, READY, specBoard } = require('./spec-board-world.cjs');

const { appendEntry } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/ledger.cjs'));

const dir = useSpecReviewWorld();
const { write, full } = ledgerHelpers(dir);
const { spec, issued, dispatchReview, cleanPass } = specReviewHelpers(dir);
const {
  board, lastAt, dispatchedAt, landed, tracedLanded, readyClosed, lanedPass, askedAs, bothWaiting,
} = specBoard(dir);

describe('what waits on the person in a specification (20.9.1, 20.2.4, 20.16, D23, D39)', () => {
  it('20.9.1: a question asked at the spec and a replacement the review raised each wait on the person by its entry and words, the pass that raised it and the sections citing what it is about; the pass\'s finds split into Claude\'s calls and the person\'s; the banner says the next pass waits on them, plain, the count waiting flagged (20.2.4)', () => {
    const asked = bothWaiting();
    const { view, banner } = board();

    assert.deepStrictEqual({ passes: view.passes, waiting: view.waiting, banner }, {
      passes: [{ pass: 1, found: 2, calls: 1, yours: 1, state: 'read', since: null, reads: null }],
      waiting: [gap(asked, 'Is a refund ever split?'), gap(made.where, 'Back to the card.', 'F1', ['2'])],
      banner: { name: 'Payments', state: 'needs', facts: [place('epic'), place('specification'), fact('pass 2 waits on you'), fact('2 waiting on you', true)] },
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
      [gap(asked, 'Is a refund ever split?', 'F1', ['2']), gap(loose, 'Is a refund ever late?')],
      [gap(loose, 'Is a refund ever late?'), gap(reworded, 'Is a refund ever split in two?', 'F1', ['2'])],
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

  it('D23: a finding asked as a question stands with whose its answer is as it stands decided: Claude\'s answer the person kept is theirs; one they left to Claude stays Claude\'s', () => {
    const pass = lanedPass();
    const asked = askedAs(pass, 'Is a refund ever split?');
    const call = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never split.', why: 'A refund returns the whole charge.' }).id;
    /** The person's keep of Claude's answer, given `given`. @param {'own'|'dont-care'} given */
    const kept = (given) => appendEntry(statePath(dir()), {
      event: 'kept', unit: UNIT, topic: null, phase: 'specification', session: SESSION.CLAUDE_CODE_SESSION_ID,
      by: 'person', who_moved_whom: 'none', entry: full(call), reason: 'asked-blind', cause: null, why: 'It reads right.', sealed: 'Never split.', given,
    }, []);
    const standing = () => board(['--page', 'pass:1']).view.found[0].standing;
    kept('dont-care');
    const left = standing();
    kept('own');

    assert.deepStrictEqual([left, standing()], ['claude', 'yours']);
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

  it('20.2.4: while a pass runs with a question waiting, the banner says where the review stands, then the count waiting flagged — never the next pass waiting on the person', () => {
    write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' });
    landed();
    issued(['spec-reviewer', UNIT, '--agent', dispatchReview(OWNER.running).id]);

    assert.deepStrictEqual(board().banner.facts.slice(2), [fact('pass 1 reading'), fact('1 waiting on you', true)]);
  });

  it('D39: ready to build waits on the person once its screen draws — the review settled, the spec cut and its checklist closed — the banner counting its yes as waiting on them; never before, while its render refuses (20.2.4)', () => {
    tracedLanded();
    cleanPass();
    const settled = board();
    readyClosed();
    const { view, banner } = board();

    assert.deepStrictEqual([settled.view.waiting, settled.banner.facts.map(({ text }) => text)], [[], ['epic', 'specification', 'being written']]);
    assert.deepStrictEqual([view.waiting, banner], [[{ ...READY, pass: null, finding: null, sections: [] }], { name: 'Payments', state: 'needs', facts: [place('epic'), place('specification'), fact('ready to build'), fact('1 waiting on you', true)] }]);
  });

  it('the yes given at ready to build, before the session moves into the build: the view reads it as given and the banner says so, nothing waiting on the person', () => {
    tracedLanded();
    cleanPass();
    readyClosed();
    output(dir(), ['render', 'ready-to-build', UNIT], { env: SESSION });
    ok(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto'], { env: SESSION });
    const { view, banner } = board();

    assert.deepStrictEqual([view.given, view.waiting, banner.facts.map(({ text }) => text)], [true, [], ['epic', 'specification', 'ready to build, your yes given']]);
  });

  it('S1: a gap waiting stands on every view that reads the unit — the epic\'s DEFINITION waiting on the person\'s answer, its page listing it opening the finding that raised it, All work\'s row, count and total — as the banner has it (20.16, 20.8.2, 20.2.4)', () => {
    const asked = askedAs(lanedPass(), 'Is a refund ever split?');

    assert.deepStrictEqual(standingOn(board, UNIT), {
      tab: { now: 'specification', spec: 'asking', build: 'waits', waiting: [`gap ${asked} → pass:1:F1`] },
      all: { phase: 'specification', standing: 'pass 2 waits on you', waiting: 1, total: 1 },
      banner: { state: 'needs', waits: ['⚑ 1 waiting on you'] },
    });
  });

  it('S1, N1: ready to build\'s yes stands on every view that reads the unit — the epic\'s DEFINITION waiting on it, All work\'s count and total, no other unit counted — as the banner has it (20.16, 20.8.2, 20.2.4)', () => {
    tracedLanded();
    cleanPass();
    readyClosed();

    assert.deepStrictEqual([standingOn(board, UNIT), board(['--tab', 'all']).view.units.map(({ unit, waiting }) => [unit, waiting])], [
      {
        tab: { now: 'specification', spec: 'ready', build: 'waits', waiting: ['ready ready-to-build'] },
        all: { phase: 'specification', standing: 'ready to build', waiting: 1, total: 1 },
        banner: { state: 'needs', waits: ['⚑ 1 waiting on you'] },
      },
      [['billing', 0], [UNIT, 1]],
    ]);
  });
});
