'use strict';

// ---------------------------------------------------------------------------
// The replay (leeway-engine/scripts/domain/replay.cjs, its screen
// domain/projections/matrix.cjs): `render matrix-replay`, the trust log
// replayed against a proposed setting over its period, each question decided
// again as the rule did at its raise, over the counts as they stood then,
// and the learned gates' showings beside them (16.15.2, 16.15.3, 16.20.2,
// P14) — and what a replay of a busy year costs. The matrix and the
// settings: test-engine-matrix.cjs.
//
// Layer: verb. World: matrix-world.cjs's — each test's folder and, in it,
// `fumi`, the trust log's events written in each test as it needs them.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { screenOf, FROZEN_MS } = require('./engine-harness.cjs');
const { idOf, DRAWN, NARROW, UNDRAWN, DAY, lines, history } = require('./trust-world.cjs');
const { OTHER, engine, CARRY_ON, render, run, refused, pick, screen, useMatrixWorld } = require('./matrix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { replay } = require(path.join(SCRIPTS, 'domain/replay.cjs'));
const { DEFAULTS } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));
const { MODEL_LINES } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));

const { logHolding, settingsHolding, fumi, careHeld } = useMatrixWorld('engine-matrix-replay-');

const AT_25 = Object.freeze({ ...DEFAULTS, threshold: 0.25 });
const AT_15 = Object.freeze({ ...DEFAULTS, threshold: 0.15 });
// Showings of the plan gate its blind ask never draws, and one it draws.
const SHOWINGS = Object.freeze(['0000000000000000', '0000000000000001', '0000000000000002', '0000000000000003', '0000000000000005', '0000000000000006', '0000000000000007',
  '0000000000000008', '0000000000000009', '000000000000000a', '000000000000000b', '000000000000000c', '000000000000000d']);
const DRAWN_SHOWING = '0000000000000012';
// What a replay finds at the learned gates where it replays no showing.
const NO_GATES = Object.freeze({ showings: 0, changed: 0, overruled: 0 });
// The CPU a replay of a busy year may take.
const REPLAY_BUDGET_S = 3;

/**
 * The history 16.15.3's replay draws, in `project`, every question in the
 * last day: twelve behaviour questions taking Claude's lean, then one the
 * person changed, not yet judged, then three more taking it; and four on
 * contract. At 20% behaviour asks until its thirteenth question and again
 * after the change; at 25% it goes quiet after its eleventh and stays so.
 * @param {string} project
 */
function replayedHistory(project) {
  const h = history({ project });
  h.agree(12, 'behaviour');
  h.depart(null, 'behaviour');
  h.agree(3, 'behaviour');
  h.agree(4, 'contract');
  return h;
}

/**
 * `fn` run in the time zone `zone`, the person's own day read there: its
 * answer.
 * @template T @param {string} zone @param {() => T} fn
 * @returns {T}
 */
function inZone(zone, fn) {
  const held = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (held === undefined) delete process.env.TZ;
    else process.env.TZ = held;
  }
}

/** The replay's found line, in the time zone UTC. @param {string} dir @param {string[]} args */
const found = (dir, args) => inZone('UTC', () => screenOf(render(dir, ['matrix-replay', ...args]), 'DISPLAY: matrix replay').slice(1).join(' ').replace(/ {2,}/g, ' ').trim());

describe('the replay (16.15.2, 16.15.3, P14)', () => {
  it('16.15.3: 25% in place of the 20% — last month\'s questions decided again by the rule at 25%, each over the counts as they stood before it: 6 skipped, 1 of them overruled; the lines it moves; y/yes sets it, n/no keeps 20%, Comment tries another number', () => {
    const { dir, id } = fumi();
    logHolding(replayedHistory(id).events);

    const out = render(dir, ['matrix-replay', '--threshold', '25']);

    assert.deepStrictEqual(screen(out, ['TITLE', 'DISPLAY: matrix replay', 'MENU: matrix replay']), [
      '■ Matrix · Fumi · Replay',
      '25% IN PLACE OF YOUR 20%',
      '  Last month 25% would have skipped 6 questions; you\'d have',
      '  overruled 1 of them.',
      '· · · · · · · · · · · ·',
      'At 25%, the line where a change would be hard to undo moves to',
      '12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold?',
      '',
      'y/yes   → Use 25% from now on',
      'n/no    → Keep 20%',
      'Comment → Try another number',
    ]);
    assert.deepStrictEqual(pick(dir, 'matrix replay', 'y').next, engine('trust', 'threshold', '25'));
    render(dir, ['matrix-replay', '--threshold', '25']);
    assert.deepStrictEqual(pick(dir, 'matrix replay', 'n').next, engine('render', 'matrix'));
    render(dir, ['matrix-replay', '--threshold', '25']);
    assert.deepStrictEqual(run(dir, ['gate', 'matrix replay', '--typed', 'comment']).next, CARRY_ON);
  });

  it('P14: the period is the last 30 days while they hold 20 questions or more, else the whole log, the line naming it; a question counts once its answer landed; overruled counts a reversal since as it counts a departure', () => {
    const project = { id: OTHER, name: 'Aircon' };
    const at = { project, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false };
    const old = history({ project: OTHER, start: FROZEN_MS - 40 * DAY });
    old.agree(10, 'behaviour');
    const reversed = old.agree(1, 'behaviour')[0];
    old.unfollowed('several');
    const recent = history({ project: OTHER });
    recent.agree(19, null);
    recent.reverse(reversed);
    const whole = replay([...old.events, ...recent.events], at);

    recent.agree(1, null);
    const month = replay([...old.events, ...recent.events], at);

    assert.deepStrictEqual(whole, { since: Date.parse(/** @type {string} */ (old.events[0].at)), whole: true, more: false, questions: 30, changed: 1, overruled: 1, gates: NO_GATES });
    assert.deepStrictEqual(month, { since: FROZEN_MS - 30 * DAY, whole: false, more: false, questions: 20, changed: 0, overruled: 0, gates: NO_GATES });
  });

  it('16.4.7: a raise mid-build replays the questions that blocked build work alone, against the threshold used elsewhere where none is picked; and the whole log names its first day', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    h.agree(12, 'look');
    logHolding(h.events);

    assert.deepStrictEqual(inZone('UTC', () => screen(render(dir, ['matrix-replay', '--build', '25']), ['DISPLAY: matrix replay', 'MENU: matrix replay'])).slice(0, 8), [
      '25% MID-BUILD IN PLACE OF THE 20%',
      '  Since 31 Dec 2025, 25% mid-build would have skipped 1 question',
      '  that blocked build work; you\'d have overruled none of them.',
      '· · · · · · · · · · · ·',
      'At 25% mid-build, the line where a change would be hard to undo',
      'moves to 12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold mid-build?',
    ]);
  });

  it('refuses a setting as it stands, a raise mid-build not above the threshold, a number that is no percent between 0 and 100, and both settings or neither', () => {
    const { dir } = fumi();
    settingsHolding(JSON.stringify({ trust: { build_threshold: 0.3 } }));
    /** @type {[string[], string][]} */
    const refusals = [
      [['--threshold', '20'], 'render matrix-replay: 20% is your threshold already'],
      [['--build', '30%'], 'render matrix-replay: 30% is your threshold mid-build already'],
      [['--build', '15'], 'render matrix-replay: mid-build the threshold rises over your 20%, never to 15% — a lower one is your threshold\'s own pick'],
      [['--build', '20'], 'render matrix-replay: mid-build the threshold rises over your 20%, never to 20% — a lower one is your threshold\'s own pick'],
      [['--threshold', '100'], 'render matrix-replay: "100" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '0'], 'render matrix-replay: "0" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', 'a lot'], 'render matrix-replay: "a lot" is no threshold — a percent above 0 and below 100, as 25 or 12.5'],
      [['--threshold', '25', '--build', '30'], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
      [[], 'render matrix-replay: --threshold <percent> or --build <percent>, one and not both'],
    ];
    for (const [args, error] of refusals) assert.strictEqual(refused(dir, ['render', 'matrix-replay', ...args]), error, args.join(' '));
  });
});

describe('the replay decides each question as the rule did (16.15.2, 16.15.3)', () => {
  const at = Object.freeze({ project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });

  it('16.S63: questions parked mid-build together and answered in turn are each decided at their raise, over the counts before any of them was answered — none skipped', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(9);
    h.parked(4);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '25']), 'Since 31 Dec 2025, 25% mid-build would have skipped none of the 13 questions that blocked build work you answered.');
  });

  it('a question raised, others answered while it waits, then it answered: it is decided over what came before its raise alone', () => {
    const h = history({ project: OTHER });
    h.agree(9, 'behaviour');
    const raised = h.now() + 500;
    h.agree(3, 'behaviour');
    h.raise('behaviour', '1', { raised });

    assert.deepStrictEqual(replay(h.events, at), { since: Date.parse(/** @type {string} */ (h.events[0].at)), whole: true, more: false, questions: 13, changed: 2, overruled: 0, gates: NO_GATES });
  });

  it('N3: skipped counts the questions the setting proposed lets go ahead where the person\'s own asks, never those both let go ahead', () => {
    const h = history({ project: OTHER });
    h.agree(20, 'behaviour');

    assert.deepStrictEqual([replay(h.events, at).changed, replay(h.events, { ...at, settings: { ...DEFAULTS, threshold: 0.22 } }).changed], [3, 2]);
  });

  it('each question is decided from what its event holds — its model, its sort, a decision of the person\'s it would replace, Claude\'s mark, the experiment still running that measured it — in its own project alone; a reversal after the clock is none yet; and the period holds a question decided as it opens', () => {
    /**
     * Twelve behaviour answers taking Claude's lean in Aircon, then `then`:
     * the replay at 25% as of the clock `nowOf` reads — its questions, those
     * it changed and those overruled.
     * @param {(h: ReturnType<typeof history>) => void} then @param {(h: ReturnType<typeof history>) => number} [nowOf]
     */
    const changedAfter = (then, nowOf = () => FROZEN_MS) => {
      const h = history({ project: OTHER });
      h.agree(12, 'behaviour');
      then(h);
      const { changed, overruled, questions } = replay(h.events, { ...at, now: nowOf(h) });
      return [questions, changed, overruled];
    };
    const month = history({ project: OTHER, start: FROZEN_MS - 30 * DAY - 1000 });
    month.agree(20, null);

    assert.deepStrictEqual([
      changedAfter((h) => h.raise('behaviour', '1')),
      changedAfter((h) => h.raise('behaviour', '1', {}, { model: MODEL_LINES[0][1] })),
      changedAfter((h) => h.raise('behaviour', '1', { sort: 'one' })),
      changedAfter((h) => h.raise('behaviour', '1', { replacedBy: 'person' })),
      changedAfter((h) => h.raise('behaviour', '1', { always: 'live-server' })),
      changedAfter((h) => h.raise('behaviour', '1', { measured: 'E1' })),
      changedAfter((h) => h.raise('behaviour', '1', {}, { project: idOf('Pay') })),
      changedAfter((h) => h.reverse(h.raise('behaviour', '1')), (h) => h.now() - 500),
      replay(month.events, at).whole,
    ], [[13, 3, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [13, 2, 0], [12, 2, 0], [13, 3, 0], false]);
  });

  it('a care entry dropped since stands for the questions decided while it stood — 16 behaviour answers under it, then dropped: none skipped, where read as never standing 3 were — the drop paired with its entry by its project, its kind and when it was added, one dropped part way through standing for those before it alone, and one added again since standing from then (16.5.2)', () => {
    /** 16 behaviour answers in Aircon under a care entry added before them, then `drop`: those 25% skips. @param {(h: ReturnType<typeof history>, added: number) => void} drop */
    const skipped = (drop) => {
      const h = history({ project: OTHER });
      const added = h.now();
      h.agree(16, 'behaviour');
      drop(h, added);
      return replay(h.events, at).changed;
    };
    const partWay = history({ project: OTHER });
    const added = partWay.now();
    partWay.agree(12, 'behaviour');
    partWay.careDrop('behaviour', added);
    const readded = partWay.now() + 500;
    partWay.agree(4, 'behaviour');

    assert.deepStrictEqual([
      skipped(() => {}),
      skipped((h, at16) => h.careDrop('behaviour', at16)),
      skipped((h, at16) => h.careDrop('behaviour', at16, { project: idOf('Pay') })),
      skipped((h, at16) => h.careDrop('look', at16)),
      skipped((h) => h.careDrop('behaviour', h.now())),
      replay(partWay.events, at).changed,
      replay(partWay.events, { ...at, care: [{ project: OTHER, kind: 'behaviour', added: new Date(readded).toISOString() }] }).changed,
    ], [3, 0, 3, 3, 3, 1, 0]);
  });

  it('a question the rule lets go ahead is drawn again by the blind draw on its question\'s id, at the share as it stood: drawn, it is asked, never skipped — one drawn at the wide share alone drawn while its kind held fewer than 20 of the project\'s own answers, however many it holds since (16.17.4, 16.17.9)', () => {
    /** Twelve behaviour answers in Aircon, then a question on `chain`, then `more` answers: the questions and those 25% skips. @param {string} chain @param {number} [more] */
    const skippedOn = (chain, more = 0) => {
      const h = history({ project: OTHER });
      h.agree(12, 'behaviour');
      h.raise('behaviour', '1', { chain });
      h.agree(more, 'behaviour');
      const { questions, changed } = replay(h.events, at);
      return [questions, changed];
    };
    const wide = history({ project: OTHER });
    wide.agree(20, 'behaviour');
    wide.raise('behaviour', '1', { chain: NARROW });

    assert.deepStrictEqual([skippedOn(UNDRAWN), skippedOn(DRAWN), skippedOn(NARROW), skippedOn(NARROW, 10), replay(wide.events, { ...at, settings: { ...DEFAULTS, threshold: 0.1 } }).changed], [[13, 3], [13, 2], [13, 2], [23, 2], 11]);
  });

  it('a question is drawn again at the share its count gave as it was raised: an answer of the project\'s own a reversal cancelled by then gone from it, one cancelled since still in it; a one-answer question at the one-answer calls\' share, never its kind\'s — drawn at the wide share alone, asked where an undrawn one is skipped (16.17.9)', () => {
    /** Those `proposed` skips over the person's `own` in Aircon, the history `build` makes with a last question on `chain`. @param {(h: ReturnType<typeof history>, chain: string) => void} build @param {string} chain @param {number} own @param {number} proposed */
    const skipped = (build, chain, own, proposed) => {
      const h = history({ project: OTHER });
      build(h, chain);
      return replay(h.events, { ...at, settings: { ...DEFAULTS, threshold: own }, proposed: { ...DEFAULTS, threshold: proposed } }).changed;
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const cancelledBefore = (h, chain) => {
      h.reverse(h.agree(19, 'behaviour')[0]);
      h.raise('behaviour', '1', { chain });
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const cancelledSince = (h, chain) => {
      const [first] = h.agree(20, 'behaviour');
      h.raise('behaviour', '1', { chain });
      h.reverse(first);
    };
    /** @type {(h: ReturnType<typeof history>, chain: string) => void} */
    const oneAnswer = (h, chain) => {
      for (let i = 0; i < 20; i += 1) h.call('one', 'behaviour');
      h.raise('look', '2', { sort: 'one' });
      h.raise('behaviour', '1', { sort: 'one', chain });
    };

    assert.deepStrictEqual([UNDRAWN, NARROW].map((chain) => [skipped(cancelledBefore, chain, 0.15, 0.25), skipped(cancelledSince, chain, 0.1, 0.25), skipped(oneAnswer, chain, 0.15, 0.2)]), [[9, 11, 1], [8, 11, 1]]);
  });

  it('below the person\'s threshold, a call that went ahead mid-build while the blind question drawn on it waited is overruled where the person answered that question otherwise than the call, never where they kept it or did not care; and a call of Claude\'s it proposed to replace itself, the person keeping it, is no overrule (16.17.6)', () => {
    const h = history({ project: OTHER });
    h.agree(13, 'behaviour');
    const [kept, overturned, shrugged, proposed] = [newId(), newId(), newId(), newId()];
    for (const entry of [kept, overturned, shrugged]) {
      h.call('several', 'behaviour', {}, { blocksBuild: true, entry });
      h.blindDraw(entry);
    }
    h.call('several', 'behaviour', {}, { entry: proposed });
    h.raise('behaviour', '1', { entry: kept, replaces: kept, blind: true, blocksBuild: true, chain: DRAWN });
    h.raise('behaviour', '2', { replaces: overturned, blind: true, blocksBuild: true, chain: DRAWN });
    h.raise('behaviour', '1', { replaces: shrugged, blind: true, blocksBuild: true, chain: DRAWN, dontCare: true });
    h.raise('behaviour', '2', { replaces: proposed, replacedBy: 'claude' });

    const { questions, changed, overruled } = replay(h.events, { ...at, proposed: AT_15 });

    assert.deepStrictEqual({ questions, changed, overruled }, { questions: 4, changed: 4, overruled: 1 });
  });

  it('a care entry stands for the questions decided after it was added alone, as the record holds it', () => {
    const { dir, id } = fumi();
    const h = replayedHistory(id);
    logHolding(h.events);
    careHeld(['behaviour', id, Date.parse(/** @type {string} */ (h.events[12].at)) + 500]);

    assert.strictEqual(found(dir, ['--threshold', '25']), 'Last month 25% would have skipped 3 questions; you\'d have overruled 1 of them.');
  });

  it('16.15.3 below the person\'s threshold: Claude\'s calls that went ahead, each decided again as it landed — those the lower setting would have asked, and those the person overruled since; a call no raise decided is none of them', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(13, 'behaviour');
    const calls = Array.from({ length: 4 }, () => h.call('several', 'behaviour'));
    h.call(null, 'behaviour');
    h.reverse(calls[1]);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'Since 31 Dec 2025, 15% would have asked you 4 more questions; you overruled 1 of those calls.');
  });

  it('below the person\'s threshold on a history from before the rule let a call go ahead, every question asked: there is nothing to replay', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(20, 'behaviour');
    h.call(null, 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'No call of mine has gone ahead in Fumi yet, so a replay has nothing to show.');
  });

  it('N5: a raise mid-build where no question has blocked build work yet says so, however many others were answered', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(30, 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '25']), 'No question has blocked build work in Fumi yet, so a replay mid-build has nothing to show.');
  });

  it('N9: the whole log\'s first day is the person\'s own, in their time zone, with its year', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.blocking(11);
    logHolding(h.events);

    const opens = inZone('America/Los_Angeles', () => screenOf(render(dir, ['matrix-replay', '--build', '25']), 'DISPLAY: matrix replay')[1]);

    assert.match(opens, /^ {2}Since 30 Dec 2025, 25% mid-build/);
  });

  it('a kind corrected after a question was raised reaches none of the questions decided before it, and every question decided after it: each is read over the counts of its own stretch between corrections', () => {
    const h = history({ project: OTHER });
    const agreed = h.agree(12, 'behaviour');
    const raised = h.now() + 500;
    for (const entry of agreed.slice(0, 8)) h.correct(entry, { kind: 'look' });
    h.raise('behaviour', '1', { raised });
    h.raise('behaviour', '1');

    assert.strictEqual(replay(h.events, at).changed, 3);
  });

  it('the whole log opens at the first of what it replays, a showing of a learned gate before any question among it', () => {
    const h = history({ project: OTHER });
    h.gate('plan gate', { picked: 'y', showing: SHOWINGS[0] });
    h.agree(13, 'behaviour');
    const { since, whole } = replay(h.events, at);

    assert.deepStrictEqual({ since, whole }, { since: Date.parse(/** @type {string} */ (h.events[0].at)), whole: true });
  });

  it('the period and the whole log\'s first day go by when each question was raised, never when its answer came', () => {
    const opened = FROZEN_MS - 31 * DAY;
    const h = history({ project: OTHER, start: FROZEN_MS - 20 * DAY });
    h.raise('behaviour', '1', { raised: opened });
    h.agree(19, 'behaviour');

    const { since, whole, questions } = replay(h.events, at);

    assert.deepStrictEqual({ since, whole, questions }, { since: opened, whole: true, questions: 20 });
  });

  it('a pick mid-build lowered below the person\'s own replays Claude\'s calls that went ahead in the build alone, each decided again against the pick mid-build, never the threshold used elsewhere', () => {
    const { dir, id } = fumi();
    const settings = { ...DEFAULTS, threshold: 0.2, build_threshold: 0.3 };
    settingsHolding(JSON.stringify({ trust: { threshold: 0.2, build_threshold: 0.3 } }));
    const h = history({ project: id });
    h.blocking(9);
    const calls = Array.from({ length: 4 }, () => h.call('several', 'behaviour', {}, { blocksBuild: true }));
    h.call('several', 'behaviour');
    h.reverse(calls[3]);
    logHolding(h.events);

    const { questions, changed, overruled } = replay(h.events, { project: { id, name: 'Fumi' }, settings, proposed: { ...settings, build_threshold: 0.25 }, care: [], now: FROZEN_MS, blocking: true });

    assert.deepStrictEqual({ questions, changed, overruled }, { questions: 4, changed: 4, overruled: 1 });
    assert.deepStrictEqual(inZone('UTC', () => screen(render(dir, ['matrix-replay', '--build', '25']), ['DISPLAY: matrix replay', 'MENU: matrix replay'])), [
      '25% MID-BUILD IN PLACE OF YOUR 30%',
      '  Since 31 Dec 2025, 25% mid-build would have asked you 4 more',
      '  questions in the build; you overruled 1 of those calls.',
      '· · · · · · · · · · · ·',
      'At 25% mid-build, the line where a change would be hard to undo',
      'moves to 12.5%, and a quiet kind asks again over 31.25%.',
      '',
      '◆ Use 25% as your threshold mid-build?',
      '',
      'y/yes   → Use 25% from now on',
      'n/no    → Keep 30%',
      'Comment → Try another number',
    ]);
  });

  it('a pick mid-build lowered below the person\'s own where no call of mine has gone ahead in the build says so, however many questions blocked it', () => {
    const { dir, id } = fumi();
    settingsHolding(JSON.stringify({ trust: { threshold: 0.2, build_threshold: 0.35 } }));
    const h = history({ project: id });
    h.blocking(7);
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--build', '30']), 'No call of mine has gone ahead in the build in Fumi yet, so a replay mid-build has nothing to show.');
  });

  it('a setting below the person\'s that would have asked none of the calls that went ahead says so', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    h.agree(30, 'behaviour');
    h.call('several', 'behaviour');
    h.call('several', 'behaviour');
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '15']), 'Since 31 Dec 2025, 15% would have asked you none of the 2 calls that went ahead as mine.');
  });
});

describe('the replay at the learned gates (16.20.2, 3.2.7)', () => {
  const at = Object.freeze({ project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });

  /**
   * Ten answers of y at the plan gate in Aircon, each on a showing of its
   * own, then one on `third`, then y and n on two showings more.
   * @param {string} third
   */
  function answeredAt(third) {
    const h = history({ project: OTHER });
    for (const showing of SHOWINGS.slice(0, 10)) h.gate('plan gate', { picked: 'y', showing });
    h.gate('plan gate', { picked: 'y', showing: third });
    h.gate('plan gate', { picked: 'y', showing: SHOWINGS[10] });
    h.gate('plan gate', { picked: 'n', showing: SHOWINGS[11] });
    return h;
  }

  it('above the person\'s threshold: the showings they answered, each decided again over the gate\'s count as it stood before it — those it would have run as a step, and those among them the person picked otherwise at; one its blind ask draws shows at any threshold; a gate off the list, a step run, and a raise mid-build replay no showing', () => {
    const offList = answeredAt(SHOWINGS[12]);
    offList.gate('state lost gate', { picked: 'y' });
    const stepped = answeredAt(SHOWINGS[12]);
    stepped.step('plan gate', 'y', DRAWN_SHOWING);

    assert.deepStrictEqual([replay(answeredAt(SHOWINGS[12]).events, at).gates, replay(answeredAt(DRAWN_SHOWING).events, at).gates, replay(offList.events, at).gates, replay(stepped.events, at).gates], [
      { showings: 13, changed: 3, overruled: 1 },
      { showings: 13, changed: 2, overruled: 1 },
      { showings: 13, changed: 3, overruled: 1 },
      { showings: 13, changed: 3, overruled: 1 },
    ]);
    assert.deepStrictEqual(replay(answeredAt(SHOWINGS[12]).events, { ...at, settings: { ...DEFAULTS, build_threshold: 0.2 }, proposed: { ...DEFAULTS, build_threshold: 0.25 }, blocking: true }).gates, NO_GATES);
  });

  it('below the person\'s threshold: the steps run, each decided again over the gate\'s count as it stood before it — those it would have shown, none where the setting proposed steps it too', () => {
    const h = history({ project: OTHER });
    for (let i = 0; i < 13; i += 1) h.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) h.step('plan gate', 'y', showing);

    assert.deepStrictEqual([replay(h.events, { ...at, proposed: AT_15 }).gates, replay(h.events, { ...at, proposed: { ...DEFAULTS, threshold: 0.195 } }).gates], [
      { showings: 3, changed: 3, overruled: 0 },
      { showings: 3, changed: 0, overruled: 0 },
    ]);
  });

  it('a showing answered in words the separate call read as the step\'s row is no pick otherwise; one read as another row is', () => {
    const h = history({ project: OTHER });
    for (const showing of SHOWINGS.slice(0, 10)) h.gate('plan gate', { picked: 'y', showing });
    h.gate('plan gate', { reading: 'y', showing: SHOWINGS[10] });
    h.gate('plan gate', { reading: 'n', showing: SHOWINGS[11] });

    assert.deepStrictEqual(replay(h.events, at).gates, { showings: 12, changed: 2, overruled: 1 });
  });

  it('each showing is decided over the gate\'s count for the model of the session it came in: steps on a model before the newest, its answers given on it, read in full (16.4.4)', () => {
    const h = history({ project: OTHER, model: MODEL_LINES[0][1] });
    for (let i = 0; i < 13; i += 1) h.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) h.step('plan gate', 'y', showing);

    assert.deepStrictEqual(replay(h.events, { ...at, proposed: AT_15 }).gates, { showings: 3, changed: 3, overruled: 0 });
  });

  it('over the last month, its showings alone: a gate\'s showings from before it replay none (P14)', () => {
    const old = history({ project: OTHER, start: FROZEN_MS - 70 * DAY });
    for (const showing of SHOWINGS) old.gate('plan gate', { picked: 'y', showing });
    const recent = history({ project: OTHER, start: FROZEN_MS - 10 * DAY });
    recent.agree(20, 'behaviour');
    recent.gate('plan gate', { picked: 'y', showing: DRAWN_SHOWING });
    const { whole, gates } = replay([...old.events, ...recent.events], at);

    assert.deepStrictEqual({ whole, gates }, { whole: false, gates: { showings: 1, changed: 0, overruled: 0 } });
  });

  it('the replay screen says what the threshold would have changed at the gates — above the person\'s, the stops it would have gone on past and those they picked otherwise at; below, the stops it would have made, opening with the period where no question opens it', () => {
    const { dir, id } = fumi();
    const above = history({ project: id });
    above.agree(13, 'behaviour');
    for (const showing of SHOWINGS.slice(0, 10)) above.gate('plan gate', { picked: 'y', showing });
    above.gate('plan gate', { picked: 'y', showing: SHOWINGS[10] });
    above.gate('plan gate', { picked: 'n', showing: SHOWINGS[11] });
    logHolding(above.events);
    const less = inZone('UTC', () => screenOf(render(dir, ['matrix-replay', '--threshold', '25']), 'DISPLAY: matrix replay'));
    const below = history({ project: id });
    for (let i = 0; i < 13; i += 1) below.gate('plan gate', { picked: 'y' });
    for (const showing of SHOWINGS.slice(0, 3)) below.step('plan gate', 'y', showing);
    logHolding(below.events);
    const more = inZone('UTC', () => screenOf(render(dir, ['matrix-replay', '--threshold', '15']), 'DISPLAY: matrix replay'));

    assert.deepStrictEqual([less, more], [[
      '25% IN PLACE OF YOUR 20%',
      '  Since 31 Dec 2025, 25% would have skipped 3 questions; you\'d',
      '  have overruled none of them.',
      '  At the gates that learn from your answers, it would have gone',
      '  on past 2 of the 12 stops you answered; you\'d have picked',
      '  otherwise at 1 of them.',
    ], [
      '15% IN PLACE OF YOUR 20%',
      '  No call of mine has gone ahead in Fumi yet.',
      '  Since 31 Dec 2025, at the gates that learn from your answers,',
      '  15% would have stopped at 3 of the 3 stops I went on past.',
    ]]);
  });

  it('the replay screen says the threshold would have gone on past none of the stops answered where it changes none, naming no pick otherwise', () => {
    const { dir, id } = fumi();
    const h = history({ project: id });
    for (const showing of SHOWINGS.slice(0, 3)) h.gate('plan gate', { picked: 'y', showing });
    logHolding(h.events);

    assert.strictEqual(found(dir, ['--threshold', '25']), 'You haven\'t answered a question in Fumi yet. Since 31 Dec 2025, at the gates that learn from your answers, 25% would have gone on past none of the 3 stops you answered.');
  });
});

describe('the replay\'s cost', () => {
  it('a busy year across three projects — twenty questions and twenty calls a day each — ended over a month ago, so the whole log replays, in one walk through it, each count walked once', () => {
    const kinds = /** @type {const} */ (['behaviour', 'look', 'words', 'scope', 'process', 'internals', 'contract']);
    const opened = FROZEN_MS - 396 * DAY;
    const events = [OTHER, idOf('Pay'), idOf('Docs')].flatMap((project, p) => {
      const h = history({ project, start: opened });
      for (let d = 0; d < 7300; d += 1) {
        const when = opened + (d * DAY) / 20 + p;
        h.agree(1, kinds[d % kinds.length], { at: when });
        h.call('several', kinds[d % kinds.length], { at: when + DAY / 40 });
      }
      return h.events;
    });

    const started = process.cpuUsage();
    const { questions } = replay(events, { project: { id: OTHER, name: 'Aircon' }, settings: DEFAULTS, proposed: AT_25, care: [], now: FROZEN_MS, blocking: false });
    const { user, system } = process.cpuUsage(started);

    assert.strictEqual(questions, 7300);
    // About 0.7 s of CPU here; walking each question's counts afresh cost
    // 12 s. CPU, not wall time, so load does not move it.
    assert.ok((user + system) / 1e6 < REPLAY_BUDGET_S, `the replay took ${(user + system) / 1e6} s of CPU, over ${REPLAY_BUDGET_S} s`);
  });
});
