'use strict';

// ---------------------------------------------------------------------------
// `engine board` on a unit's page (leeway-engine/scripts/domain/projections/
// board-unit.cjs, board-all.cjs; 20.15, 20.16): other units' pages than the
// epic's, This session that cannot be drawn, how far All work says an epic
// has come; and the views the mod draws, shaped as the engine answers them.
// The epic's page is test-engine-board-epic.cjs's.
//
// Layer: verb. World: the decided suites' (decided-world.cjs) — the epic
// `fumi`, its note window's map written, its two topics under discussion —
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, writeState, readManifest, layout } = require('./engine-harness.cjs');
const { useDecidedWorld, decidedHelpers, decidedBoardHelpers, writeIn, NO_PAYLOAD, SOLO } = require('./decided-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { fixture, fixtureModule, misfits, emptyLists, place } = require('./board-world.cjs');

const dir = useDecidedWorld();
const { close, staged, payload, answer } = decidedHelpers(dir);
const { board, at, made, sent, spawned } = decidedBoardHelpers(dir);

/** The solo feature's topic closed into its spec, staged with nothing for the record: when its checklist closed. */
function soloClosed() {
  close(SOLO, SOLO);
  ok(dir(), ['decided', 'stage', SOLO, SOLO, '--file', payload(NO_PAYLOAD)], { env: SESSION });
  return readManifest(dir(), SOLO).checklists.decided[SOLO].closed;
}

/** The solo feature's spec written, one section on the cart. */
const soloSpec = () => writeState(dir(), `${SOLO}/spec.md`, '# Solo\n\n## 1. Tally\n\n### 1.1 Reset\n\n1.1.1 A tally resets at midnight.\n');

describe('other units\' pages (20.15)', () => {
  it('20.15.2: an epic whose map was never approved shows its phases, discovery shaping and each after it with what it waits on', () => {
    made('atlas', 'epic');

    const later = { doing: '', on: null, session: null, page: false };

    assert.deepStrictEqual(board(['--tab', 'unit', '--unit', 'atlas']).view.phases, [
      { phase: 'discovery', state: 'running', words: '', ...later, doing: 'shaping' },
      { phase: 'discussion', state: 'later', words: 'once the map is approved', ...later },
      { phase: 'specification', state: 'later', words: 'once every topic is decided', ...later },
      { phase: 'build', state: 'later', words: '', ...later },
      { phase: 'review', state: 'later', words: '', ...later },
    ]);
  });

  it('20.15.1, 20.8.2: a unit started the day its manifest was made, as the manifest stamps it — an epic\'s page and any other unit\'s tab alike — and none is said where it holds no stamp', () => {
    const created = made('atlas', 'epic');
    const started = (/** @type {string} */ unit) => {
      const { kind, started: day } = board(['--tab', 'unit', '--unit', unit]).view;
      return [kind, day];
    };

    assert.deepStrictEqual([UNIT, 'atlas'].map(started), [['epic', null], ['unit', created]]);
  });

  it('20.15.2: a quick-fix\'s one session is its implementation, its row on its tab later until its fixes begin, as its entry records them (test-engine-board-quick-fix.cjs reads it running)', () => {
    createManifest(dir(), 'tidy', { work_type: 'quick-fix' });
    at(['tidy', 'implementation', 'tidy']);

    assert.deepStrictEqual(board(['--tab', 'unit']).view.phases.map(({ phase, state }) => [phase, state]), [['discovery', 'complete'], ['implementation', 'later']]);
  });

  it('20.15.1: a unit\'s tab, its spec written and its build not begun, lists each gap its spec\'s review waits on the person for, opening its entry where no pass raised it', () => {
    soloClosed();
    soloSpec();
    const asked = writeIn(dir(), 'ask', `${SOLO}.specification`, [], { ...MADE, text: 'Is a tally ever shared?' });

    assert.deepStrictEqual(board(['--tab', 'unit', '--unit', SOLO]).view.waiting, [{ kind: 'gap', id: asked, text: 'Is a tally ever shared?', page: `entry:${asked}` }]);
  });

  it('S3, 20.15.1: a unit\'s tab says whether it is the unit the session is in, whose questions the board holds', () => {
    at([UNIT]);

    assert.deepStrictEqual([board(['--tab', 'unit', '--unit', SOLO]).view.here, board(['--tab', 'unit', '--unit', UNIT]).view.kind], [false, 'epic']);
    at([SOLO]);
    assert.strictEqual(board(['--tab', 'unit']).view.here, true);
  });

  it('N1: a feature\'s specification is the phase it is in from the spec\'s entry, its topic closed into it, before its spec is written — under way, as its banner says it — and its tab\'s row says where the spec stands once written', () => {
    const closed = soloClosed();
    const before = board(['--tab', 'unit', '--unit', SOLO]).view;
    soloSpec();
    at([SOLO, 'specification', SOLO]);
    const { view, banner } = board(['--tab', 'unit']);
    const row = (/** @type {any} */ tab) => tab.phases.find(({ phase }) => phase === 'specification');

    assert.deepStrictEqual({ before: [before.now, row(before)], written: [row(view), banner.facts.at(-1).text] }, {
      before: [{ phase: 'specification', since: closed }, { phase: 'specification', state: 'running', words: '', doing: 'being written', on: null, session: null, page: false }],
      written: [{ phase: 'specification', state: 'running', words: '1 section · 0 passes', doing: 'being written', on: null, session: 'this', page: false }, 'being written'],
    });
  });

  it('20.15.1, 20.15.3: a linear unit\'s phases each finished with the day it closed and what it produced — the discussion its decisions — each opening in full; the phase it is in since the one before it closed; a phase that is not finished opens on no page', () => {
    const closed = soloClosed();
    soloSpec();
    const { view } = board(['--tab', 'unit', '--unit', SOLO]);
    const phase = (/** @type {string} */ name) => board(['--tab', 'unit', '--unit', SOLO, '--page', `phase:${name}`]).view;

    assert.deepStrictEqual([view.now, view.phases.slice(1, 3)], [{ phase: 'specification', since: closed }, [
      { phase: 'discussion', state: 'complete', words: '1 decision', doing: '', on: closed, session: null, page: true },
      { phase: 'specification', state: 'running', words: '1 section · 0 passes', doing: 'being written', on: null, session: null, page: false },
    ]]);
    assert.deepStrictEqual([phase('discussion'), phase('specification')], [
      { kind: 'phase', unit: SOLO, title: 'Solo', phase: 'discussion', on: closed, words: '1 decision', sections: [{ heading: 'Decisions', text: 'Does a tally reset daily?: At midnight.' }] },
      { kind: 'unavailable', reason: 'solo has no finished specification that opens in full — a linear unit\'s discovery, discussion and investigation do, once complete' },
    ]);
  });

  it('20.16.1: All work says how far an epic has come by its topics decided of all, and nothing of a unit it reads no further', () => {
    at([UNIT]);

    assert.deepStrictEqual(board(['--tab', 'all']).view.units.map(({ unit, standing }) => [unit, standing]), [[UNIT, '0 of 2 topics decided'], ['solo', '']]);
  });

  it('This session that cannot be drawn says why in its tab and among the warnings, the banner at the session\'s place, while the unit\'s tab still draws', () => {
    at([SOLO, 'implementation', SOLO]);
    const { view, banner, warnings } = board();

    assert.deepStrictEqual({ view, banner, warnings, tab: board(['--tab', 'unit']).view.kind }, {
      view: { kind: 'unavailable', reason: 'solo\'s build has not begun' },
      banner: { name: 'Solo', state: 'running', facts: [place('feature'), place('implementation')] },
      warnings: ['This session cannot be drawn — solo\'s build has not begun'],
      tab: 'unit',
    });
  });
});

describe('the views the mod draws, shaped as the engine answers them (N8)', () => {
  /** Where a fixture and the engine's answer part, and each list either holds no entry of. @param {any} held @param {any} view */
  const fits = (held, view) => ({ misfits: misfits(held, view), fixture: emptyLists(held), engine: emptyLists(view) });
  const FITS = { misfits: [], fixture: [], engine: [] };

  it('a discussion with its review round, what is open, the messages each way and the calls since; the epic\'s page with a topic set aside and an intake lately; and All work with the roadmap, the inbox and a unit complete', async () => {
    at([UNIT, 'discussion', 'note-window']);
    ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: SESSION });
    writeIn(dir(), 'ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Does a note float?' });
    sent('space-homing', 'note-window', 'Notes open on their Space');
    sent('note-window', 'space-homing', 'The tour opens first');
    const discussion = board().view;
    const [delivered] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'space-homing', 'mail'));
    ok(dir(), ['topic', 'answered', UNIT, 'space-homing', delivered.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Does the tour open first?' })], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later'], { env: SESSION });
    writeState(dir(), '.inbox/ideas/2026-10-30--fumi-stacks.md', '# Fumi stacks\n\nNotes stacked on a Space.\n');
    createManifest(dir(), 'tag-signing', { status: 'completed' });
    ok(dir(), ['enter', 'discovery', UNIT], { env: SESSION });
    output(dir(), ['render', 'approve-map', UNIT, '--file', writeState(dir(), layout.cache('scratch', 'map.json'), JSON.stringify({ topics: [{ name: 'note-window' }], parks: [] }))], { env: SESSION });
    at([UNIT]);
    const [epic, all] = [board().view, board(['--tab', 'all']).view];
    const held = await fixtureModule('board-epic.mjs');

    assert.deepStrictEqual(
      [fits(await fixture('board-discussion.mjs'), discussion), fits({ ...held.default, waiting: [held.restaged] }, epic), fits(await fixture('board-all.mjs'), all)],
      [FITS, FITS, FITS],
    );
  });

  it('an experiment approved with its design and its runs by condition', async () => {
    spawned();
    const record = path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'experiments', 'E1-note-open');
    fs.writeFileSync(path.join(record, 'design.md'), '# E1: Note open\n\n## Question\n\nHow fast does a note open?\n\n## Decision rule\n\nUnder 100 ms wins.\n');
    for (const step of ['advance', 'approve', 'advance']) ok(dir(), ['experiment', step, UNIT, 'note-window', 'E1'], { env: SESSION });
    const tally = '.leeway/.cache/fumi/experiment/note-window/runs.json';
    fs.mkdirSync(path.join(dir(), path.dirname(tally)), { recursive: true });
    fs.writeFileSync(path.join(dir(), tally), JSON.stringify([{ condition: '16 bare windows', of: 2, values: [0.24, 0.26], unit: 's' }]));
    ok(dir(), ['experiment', 'runs', UNIT, 'note-window', 'E1', '--file', tally], { env: SESSION });
    at([UNIT, 'experiment', 'note-window']);

    assert.deepStrictEqual(fits(await fixture('board-experiment.mjs'), board().view), FITS);
  });

  it('a linear unit\'s tab, its discussion closed into its spec, a gap of its spec waiting and its moments lately', async () => {
    soloClosed();
    soloSpec();
    ok(dir(), ['spec', 'land', SOLO]);
    writeIn(dir(), 'ask', `${SOLO}.specification`, [], { ...MADE, text: 'Is a tally ever shared?' });

    assert.deepStrictEqual(fits(await fixture('board-unit.mjs'), board(['--tab', 'unit', '--unit', SOLO]).view), FITS);
  });
});
