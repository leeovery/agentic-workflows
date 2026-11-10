'use strict';

// ---------------------------------------------------------------------------
// The ask rule's numbers (leeway-engine/scripts/domain/trust-counts.cjs,
// over trust-evidence.cjs's answers and trust-log.cjs's read of every
// project): each kind's count, the one-answer calls' and each gate's — what
// counts clean and what a loss, weighted by age and model, merged with the
// person's other projects capped at 10 answers' weight — the 95th
// percentile of Beta(1 + losses, 1 + clean) held to §16's worked values,
// and the state walked in time order at the threshold a question takes;
// derived from the log each time, as of the clock passed in, never stored;
// and what the release ships of them.
//
// Layer: unit. World: the events are built in memory, each a second after
// the last, a day before the frozen clock; the read's tests keep a log in a
// config folder of their own, a project a plain folder whose state root is
// pinned (trust-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { FROZEN_MS, statePath, layout } = require('./engine-harness.cjs');
const { idOf, PROJECT_ID, lines, waitingPath, useTrustWorld } = require('./trust-world.cjs');
const { labelAnswers } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ORDER } = require(path.join(SCRIPTS, 'domain/labeller.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { trustEvent, readTrustEvent } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));
const { TRUST_LOG } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { KINDS } = require(path.join(SCRIPTS, 'domain/event-fields.cjs'));
const {
  MODEL_GENERATIONS, upperBound, countsFrom, countsOf, gateCount, stateOf,
} = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */
/** @typedef {import('../../skills/leeway-engine/scripts/domain/trust-counts.cjs').Count} Count */

const DAY = 24 * 60 * 60 * 1000;
// The spec's figures: the 20% default (16.4.6), 10% where a change would be
// hard to undo (16.4.8), and an answer six months old at 183 days (16.12.6).
const AT_20 = 0.2;
const AT_10 = 0.1;
const SIX_MONTHS = 183 * DAY;
const HERE = PROJECT_ID;
const ELSEWHERE = idOf('Aircon');
const MODEL = MODEL_GENERATIONS[MODEL_GENERATIONS.length - 1];

/** A bound to nine places, as the spec's figures are compared. @param {number} bound */
const round = (bound) => Math.round(bound * 1e9) / 1e9;

/**
 * A history of the trust log's events in this project unless told another,
 * on the current model unless told another, each a second after the last
 * unless given its own time — the first a day before the clock.
 */
function history() {
  let clock = FROZEN_MS - DAY;
  /** @type {Record<string, unknown>[]} */
  const events = [];
  /**
   * @param {string} type @param {Record<string, unknown>} fields
   * @param {{project?: string|null, model?: string|null, at?: number}} [where]
   */
  const log = (type, fields, { project = HERE, model = MODEL, at } = {}) => {
    clock = at ?? clock + 1000;
    const header = { id: newId(), at: new Date(clock).toISOString(), project, project_name: project === null ? null : 'fumi', model, session: null };
    const event = trustEvent(type, header, fields);
    events.push(event);
    return event;
  };
  /** A label composing `kind`, null for none. @param {Kind|null} kind */
  const label = (kind) => (kind === null ? null : { labeller: 'claude-sonnet-5', answers: ORDER.map((key) => labelAnswers(kind)[key]) });
  /**
   * A raise on `kind` answered `answer`, Claude's lean row 1: its entry.
   * @param {Kind|null} kind @param {string} answer @param {{sort?: string}} [opts] @param {Parameters<typeof log>[2]} [where]
   */
  const raise = (kind, answer, { sort = 'several' } = {}, where = {}) => /** @type {string} */ (log('raise', {
    entry: newId(), kind, label: label(kind), sort, sealed: '1', answer, via: 'pressed', with_text: false, reading: null, didnt_follow: false, blocked_build: null,
  }, where).entry);
  const h = {
    events,
    /** The clock's time now, as the next event's is a second on. */
    now: () => clock,
    /** `n` answers on `kind` taking Claude's lean. @param {number} n @param {Kind|null} [kind] @param {Parameters<typeof log>[2]} [where] */
    agree: (n, kind = 'behaviour', where = {}) => Array.from({ length: n }, () => raise(kind, '1', {}, where)),
    /** A departure on `kind`, judged `verdict` where given: its entry. @param {string|null} [verdict] @param {Kind|null} [kind] @param {Parameters<typeof log>[2]} [where] */
    depart: (verdict = null, kind = 'behaviour', where = {}) => {
      const entry = raise(kind, '2', {}, where);
      if (verdict !== null) h.verdict(entry, verdict, where);
      return entry;
    },
    /** A raise Claude sorted `sort`, answered `answer`. @param {string} sort @param {string} answer @param {Kind} [kind] */
    sorted: (sort, answer, kind = 'behaviour') => raise(kind, answer, { sort }),
    /** Claude's call on `kind`, sorted `sort`: its entry. @param {string|null} sort @param {Kind} [kind] */
    call: (sort, kind = 'behaviour') => /** @type {string} */ (log('call', { entry: newId(), kind, label: label(kind), sort }).entry),
    /** The person's reversal of `entry`: its own. @param {string} entry */
    reverse: (entry) => /** @type {string} */ (log('reversal', { entry: newId(), reverses: entry }).entry),
    /** @param {string} entry @param {string} verdict @param {Parameters<typeof log>[2]} [where] */
    verdict: (entry, verdict, where = {}) => log('verdict', { entry, verdict, point: 'decided' }, { project: where.project }),
    /** @param {string} entry @param {{kind?: Kind|null, verdict?: string|null}} to */
    correct: (entry, { kind = null, verdict = null }) => log('correction', { entry, kind, verdict }),
    /**
     * An answer at gate `name`: a row pressed, or free text read as `reading`.
     * @param {string} name @param {{picked?: string, reading?: string|null}} answer @param {Parameters<typeof log>[2]} [where]
     */
    gate: (name, { picked, reading = null }, where = {}) => log('gate', picked === undefined
      ? { gate: name, recommended: 'y', picked: null, via: 'typed', with_text: true, reading }
      : { gate: name, recommended: 'y', picked, via: 'pressed', with_text: false, reading: null }, where),
    /** The other events of the log, which answer nothing. */
    others: () => {
      log('raise', { entry: null, kind: 'behaviour', label: label('behaviour'), sort: 'several', sealed: '1', answer: null, via: 'pressed', with_text: false, reading: null, didnt_follow: true, blocked_build: null });
      log('blind-draw', { entry: newId(), kind: 'behaviour' });
      log('position-switch', { unit: 'pay', to: 'step' });
      log('convergence', { unit: 'pay', topic: 'cards' });
    },
  };
  return h;
}

/**
 * The counts `h` holds for this project on `model`, as of `now`.
 * @param {ReturnType<typeof history>} h @param {{model?: string|null, now?: number}} [clock]
 */
const countsIn = (h, { model = MODEL, now = FROZEN_MS } = {}) => countsFrom(h.events, { project: HERE, model, now });

/**
 * Where `count` stands at `threshold`, its bound to nine places.
 * @param {Count} count @param {number} [threshold]
 */
function standing(count, threshold = AT_20) {
  const state = stateOf(count, threshold);
  return { ...state, bound: round(state.bound) };
}

/** A count's split. @param {Count} count */
function splitOf(count) {
  const { losses, clean } = stateOf(count, AT_20);
  return { losses, clean };
}

/** The behaviour count's split in `h`. @param {ReturnType<typeof history>} h @param {Parameters<typeof countsIn>[1]} [clock] */
const behaviour = (h, clock) => splitOf(countsIn(h, clock).kinds.behaviour);

describe('the bound: the 95th percentile of Beta(1 + losses, 1 + clean) (16.4.4)', () => {
  it('holds 16.4.5\'s worked values: with no loss, 13 answers bring it under 20%, 18 under 15% and 28 under 10%, one answer fewer leaving it over; one loss among 20 answers, 21%', () => {
    assert.deepStrictEqual(
      [[0, 12], [0, 13], [0, 17], [0, 18], [0, 27], [0, 28], [1, 19]].map(([losses, clean]) => round(upperBound({ losses, clean }))),
      [0.205816665, 0.192636176, 0.153317554, 0.145868503, 0.101465736, 0.098144628, 0.206725379],
    );
  });

  it('reads fractional weights through the regularised incomplete beta: held to the closed forms Beta(1, b) and Beta(a, 1) take at any b and a, and to the plan\'s own arithmetic where both are fractional', () => {
    assert.deepStrictEqual(
      [[0, 6.5], [2.5, 0], [0.5, 13], [2.5, 17.25]].map(([losses, clean]) => round(upperBound({ losses, clean }))),
      [round(1 - 0.05 ** (1 / 7.5)), round(0.95 ** (1 / 3.5)), 0.23995772, 0.303606622],
    );
  });
});

describe('what a kind counts (16.4.2, 16.4.3, 16.10.8, 16.12)', () => {
  it('16.S12: one loss among 20 answers on a kind, nothing from other projects, puts its bound at 21% (20.67%)', () => {
    const h = history();
    h.depart('loss');
    h.agree(19);

    assert.deepStrictEqual(standing(countsIn(h).kinds.behaviour), { asks: true, bound: 0.206725379, losses: 1, clean: 19 });
  });

  it('counts an answer taking Claude\'s lean clean, and a departure a real loss until it is judged no loss: not yet judged, skipped (16.S64) or judged a real loss, a loss; judged nothing or a fix later — a skip judged a fix later among them — clean (16.S13)', () => {
    const judged = [[], ['skip'], ['loss'], ['nothing'], ['fix'], ['skip', 'fix']].map((verdicts) => {
      const h = history();
      h.agree(3);
      const entry = h.depart();
      for (const verdict of verdicts) h.verdict(entry, verdict);
      return behaviour(h);
    });

    const [loss, clean] = [{ losses: 1, clean: 3 }, { losses: 0, clean: 4 }];
    assert.deepStrictEqual(judged, [loss, loss, loss, clean, clean, clean]);
  });

  it('counts nothing for an answer the person didn\'t follow, for Claude\'s own call standing, for a question with no label, nor for any event that is no answer — beside the answer that counts', () => {
    const h = history();
    h.others();
    for (const sort of ['one', 'several', null]) h.call(sort);
    h.agree(1, null);
    h.depart(null, null);
    h.agree(1);

    const { kinds } = countsIn(h);
    assert.deepStrictEqual(KINDS.map((kind) => [kind, splitOf(kinds[kind])]), KINDS.map((kind) => [kind, kind === 'behaviour' ? { losses: 0, clean: 1 } : { losses: 0, clean: 0 }]));
  });

  it('cancels the answer a reversal reverses, which counted until then, and counts the reversal a departure under its kind — the person\'s agreement reversed, and Claude\'s call — a loss until judged (16.12.1)', () => {
    const h = history();
    const agreed = h.agree(1)[0];
    const called = h.call('several');
    const before = h.now();
    const reversal = h.reverse(agreed);
    h.reverse(called);
    const reversed = h.now();
    h.verdict(reversal, 'fix');

    assert.deepStrictEqual(
      [behaviour(h, { now: before }), behaviour(h, { now: reversed }), behaviour(h)],
      [{ losses: 0, clean: 1 }, { losses: 2, clean: 0 }, { losses: 1, clean: 1 }],
    );
  });

  it('follows the person\'s corrections (16.15.4), once made: an entry\'s kind re-keyed takes its answer to the other kind, and a departure\'s verdict corrected moves it', () => {
    const h = history();
    const agreed = h.agree(1)[0];
    const lost = h.depart('loss');
    const before = h.now();
    h.correct(agreed, { kind: 'look' });
    h.correct(lost, { verdict: 'fix' });

    const { kinds: then } = countsIn(h, { now: before });
    const { kinds } = countsIn(h);
    assert.deepStrictEqual([[then.behaviour, then.look].map(splitOf), [kinds.behaviour, kinds.look].map(splitOf)], [
      [{ losses: 1, clean: 1 }, { losses: 0, clean: 0 }],
      [{ losses: 0, clean: 1 }, { losses: 0, clean: 1 }],
    ]);
  });
});

describe('the count of Claude\'s one-answer calls (16.4.10)', () => {
  it('holds the matrix\'s 64 calls · 1 overruled · 7%: each call and raise Claude sorted one, standing or taking the lean, clean, and one overruled a loss though judged nothing (16.4.2); a call sorted several, or by no raise, none of it', () => {
    const h = history();
    for (let i = 0; i < 62; i += 1) h.call('one');
    h.sorted('one', '1');
    h.call('several');
    h.call(null);
    h.verdict(h.reverse(h.call('one')), 'nothing');

    assert.deepStrictEqual(standing(countsIn(h).one), { asks: false, bound: 0.070914019, losses: 1, clean: 63 });
  });

  it('never asks with no overrule, however few its calls; first asks once an overrule lifts its bound over the threshold itself, then goes quiet under it and asks again only over a quarter above it (16.S71)', () => {
    const h = history();
    const asks = () => stateOf(countsIn(h, { now: h.now() }).one, AT_20).asks;
    const walked = [asks()];
    h.call('one');
    walked.push(asks());
    for (let i = 0; i < 15; i += 1) h.call('one');
    h.sorted('one', '2');
    walked.push(asks());
    for (let i = 0; i < 4; i += 1) h.call('one');
    walked.push(asks());
    h.reverse(h.call('one'));
    walked.push(asks());

    assert.deepStrictEqual(walked, [false, false, true, false, false]);
  });
});

describe('weights (16.12.4)', () => {
  it('16.S42: an answer counts half once it is 183 days old, a loss as a clean one, in full the day before', () => {
    const h = history();
    h.depart('loss', 'behaviour', { at: FROZEN_MS - SIX_MONTHS - DAY });
    h.agree(1, 'behaviour', { at: FROZEN_MS - SIX_MONTHS });
    h.agree(1, 'behaviour', { at: FROZEN_MS - SIX_MONTHS + DAY });

    assert.deepStrictEqual(behaviour(h), { losses: 0.5, clean: 1.5 });
  });

  it('16.S43: a new model starts from its predecessor\'s counts at half and earns the rest — the generation before that at a quarter, an answer logged with no model as the current model\'s, a model the list does not place, or a later one, not at all (E4)', () => {
    const h = history();
    const [first, second, third] = MODEL_GENERATIONS.slice(-3);
    h.agree(8, 'behaviour', { model: first });
    h.agree(8, 'behaviour', { model: second });
    h.agree(4, 'behaviour', { model: third });
    h.agree(1, 'behaviour', { model: null });
    h.agree(3, 'behaviour', { model: 'claude-sonnet-5' });

    assert.deepStrictEqual([third, second].map((model) => behaviour(h, { model }).clean), [2 + 4 + 4 + 1, 4 + 8 + 1]);
  });
});

describe('the merge with the person\'s other projects (16.14.3, 16.14.6)', () => {
  it('16.14.4\'s worked value: 30 clean answers elsewhere, capped at 10 answers\' weight, start a new project at 24% (23.84%) and it asks; three clean answers there take it under 20% (19.26%), quiet', () => {
    const h = history();
    h.agree(30, 'behaviour', { project: ELSEWHERE });
    const opening = standing(countsIn(h, { now: h.now() }).kinds.behaviour);
    h.agree(3);

    assert.deepStrictEqual([opening, standing(countsIn(h).kinds.behaviour)],
      [{ asks: true, bound: 0.23840419, losses: 0, clean: 10 }, { asks: false, bound: 0.192636176, losses: 0, clean: 13 }]);
  });

  it('weighs the other projects\' answers before the cap, then scales their losses and clean answers together (E5): 12 clean and 4 lost elsewhere, capped to 7.5 and 2.5, weigh 6 and 2 once six months old, under the cap', () => {
    const h = history();
    const old = FROZEN_MS - SIX_MONTHS - DAY;
    h.agree(12, 'behaviour', { project: ELSEWHERE, at: old });
    for (let i = 0; i < 4; i += 1) h.depart('loss', 'behaviour', { project: ELSEWHERE });

    assert.deepStrictEqual([behaviour(h, { now: old + DAY }), behaviour(h)], [{ losses: 2.5, clean: 7.5 }, { losses: 2, clean: 6 }]);
  });
});

describe('the state, walked in time order (16.6.1–16.6.3, 16.13.6)', () => {
  /**
   * The behaviour kind's state at `threshold` after `clean` clean answers,
   * then `then`'s answers.
   * @param {number} clean @param {(h: ReturnType<typeof history>) => void} then @param {number} [threshold]
   */
  function after(clean, then, threshold = AT_20) {
    const h = history();
    h.agree(clean);
    then(h);
    return standing(countsIn(h).kinds.behaviour, threshold);
  }

  it('asks with no answers at 95%, and until its bound falls under the threshold: 12 clean answers ask at 20.58%, the 13th takes it quiet at 19.26%', () => {
    assert.deepStrictEqual([after(0, () => {}), after(12, () => {}), after(13, () => {})], [
      { asks: true, bound: 0.95, losses: 0, clean: 0 },
      { asks: true, bound: 0.205816665, losses: 0, clean: 12 },
      { asks: false, bound: 0.192636176, losses: 0, clean: 13 },
    ]);
  });

  it('16.6.3 worked at 20%: a loss while quiet behaviour holds 13 to 15 clean answers takes its bound over 25% — 27.94%, 26.40%, 25.01% — and it asks until 20 clean answers outweigh the loss, still at 19 (20.67%), quiet at 20 (19.81%); from 16 clean answers a loss leaves it quiet at 23.77% (16.6.2)', () => {
    /** @param {number} more @returns {(h: ReturnType<typeof history>) => void} */
    const lossThen = (more) => (h) => {
      h.depart('loss');
      h.agree(more);
    };
    assert.deepStrictEqual([after(13, lossThen(0)), after(14, lossThen(0)), after(15, lossThen(0)), after(13, lossThen(6)), after(13, lossThen(7)), after(16, lossThen(0))], [
      { asks: true, bound: 0.279396194, losses: 1, clean: 13 },
      { asks: true, bound: 0.263957397, losses: 1, clean: 14 },
      { asks: true, bound: 0.250124452, losses: 1, clean: 15 },
      { asks: true, bound: 0.206725379, losses: 1, clean: 19 },
      { asks: false, bound: 0.198122132, losses: 1, clean: 20 },
      { asks: false, bound: 0.237660915, losses: 1, clean: 16 },
    ]);
  });

  it('walks at half for a question hard to undo: quiet under 10% at 28 clean answers (9.81%), asking at 27 (10.15%); a loss at 34 clean answers asks again at 12.51%, over 12.5%, at 35 leaves it quiet at 12.19% — the same counts quiet at 20% (16.6.2)', () => {
    /** @param {ReturnType<typeof history>} h */
    const loss = (h) => h.depart('loss');
    const asks = [after(27, () => {}, AT_10), after(28, () => {}, AT_10), after(34, loss, AT_10), after(35, loss, AT_10), after(34, loss)];

    assert.deepStrictEqual(asks.map(({ asks: asking, bound }) => [asking, bound]), [
      [true, 0.101465736], [false, 0.098144628], [true, 0.125116205], [false, 0.121904898], [false, 0.125116205],
    ]);
  });

  it('walks each moment as it stood: a departure counts a loss until its verdict, so one later judged a fix later reopened a quiet kind, which asks on until its bound falls under the threshold — and the clock reads the state as it was then', () => {
    const h = history();
    h.agree(16);
    h.depart('loss');
    const quiet = h.now();
    const waiting = h.depart();
    const reopened = h.now();
    h.verdict(waiting, 'fix');

    assert.deepStrictEqual([quiet, reopened, FROZEN_MS].map((now) => standing(countsIn(h, { now }).kinds.behaviour)), [
      { asks: false, bound: 0.237660915, losses: 1, clean: 16 },
      { asks: true, bound: 0.295802014, losses: 2, clean: 16 },
      { asks: true, bound: 0.226374249, losses: 1, clean: 17 },
    ]);
  });

  it('walks an answer turning six months old as a moment of its own: quiet behaviour whose 13 clean answers age asks again at 32.93%, over 25%, with nothing new answered', () => {
    const h = history();
    const answered = FROZEN_MS - SIX_MONTHS - 10 * DAY;
    h.agree(13, 'behaviour', { at: answered });

    assert.deepStrictEqual([answered + DAY, FROZEN_MS].map((now) => standing(countsIn(h, { now }).kinds.behaviour)), [
      { asks: false, bound: 0.192636176, losses: 0, clean: 13 },
      { asks: true, bound: round(1 - 0.05 ** (1 / 7.5)), losses: 0, clean: 6.5 },
    ]);
  });
});

describe('a gate\'s count (16.20.2)', () => {
  it('takes the row picked most often as the usual answer, a typed answer by the row read from it, and leaving it a loss, free text read as no row among them: a gate with no answers shows; 13 answers of y go automatic at 19.26%; a no and a typed answer naming no row bring it back', () => {
    const h = history();
    for (let i = 0; i < 12; i += 1) h.gate('plan gate', { picked: 'y' });
    h.gate('plan gate', { reading: 'y' });
    const usual = h.now();
    h.gate('plan gate', { picked: 'n' });
    h.gate('plan gate', { reading: null });

    assert.deepStrictEqual([gateCount(countsIn(h), 'conclude gate'), gateCount(countsIn(h, { now: usual }), 'plan gate'), gateCount(countsIn(h), 'plan gate')].map((count) => standing(count)), [
      { asks: true, bound: 0.95, losses: 0, clean: 0, usual: null },
      { asks: false, bound: 0.192636176, losses: 0, clean: 13, usual: 'y' },
      { asks: true, bound: 0.343825199, losses: 2, clean: 13, usual: 'y' },
    ]);
  });

  it('merges a gate\'s answers in other projects, and before any project, as a kind\'s are, capped at 10 answers\' weight (E14)', () => {
    const h = history();
    for (let i = 0; i < 20; i += 1) h.gate('plan gate', { picked: 'y' }, { project: ELSEWHERE });
    for (let i = 0; i < 20; i += 1) h.gate('plan gate', { picked: 'y' }, { project: null });
    for (let i = 0; i < 3; i += 1) h.gate('plan gate', { picked: 'y' });

    assert.deepStrictEqual(standing(gateCount(countsIn(h), 'plan gate')), { asks: false, bound: 0.192636176, losses: 0, clean: 13, usual: 'y' });
  });
});

describe('the counts read from the trust log (16.13.6, 16.S46)', () => {
  const { logPath, project, folder } = useTrustWorld('trust-counts-');

  /** Every file and folder under the test's folder, by its path, a file with its bytes. */
  const everything = () => Object.fromEntries(/** @type {string[]} */ (fs.readdirSync(folder(), { recursive: true }))
    .map((rel) => path.join(folder(), rel)).map((file) => [file, fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : 'a folder']));

  it('16.S46: are derived from the log each time they are read, an event appended counting at once, and reading them writes nothing — no count is stored', () => {
    const dir = project('fumi');
    const h = history();
    h.agree(2);
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(...h.events));
    const before = everything();
    const read = stateOf(countsOf(statePath(dir), { model: MODEL, now: FROZEN_MS }).kinds.behaviour, AT_20).clean;
    const unwritten = everything();
    h.depart();
    fs.appendFileSync(logPath(), lines(h.events[h.events.length - 1]));
    const { losses, clean } = stateOf(countsOf(statePath(dir), { model: MODEL, now: FROZEN_MS }).kinds.behaviour, AT_20);

    assert.deepStrictEqual([read, unwritten, { losses, clean }], [2, before, { losses: 1, clean: 2 }]);
  });

  it('read every project\'s events on the machine, the others\' the prior: logged, or waiting in a conversation after an append that failed; and this project\'s kept ahead of an entry its ledger holds — never one kept ahead of an entry another project\'s ledger awaits', () => {
    const dir = project('fumi');
    const aircon = project('aircon', { project_id: ELSEWHERE });
    const h = history();
    const [logged, waited] = [h.agree(1, 'look', { project: ELSEWHERE }), h.agree(1, 'look', { project: ELSEWHERE })];
    const [ours, theirs] = [h.agree(1, 'look'), h.agree(1, 'look', { project: ELSEWHERE })];
    const byEntry = (/** @type {string[]} */ [entry]) => /** @type {Record<string, unknown>} */ (h.events.find((event) => event.entry === entry));
    fs.writeFileSync(statePath(dir, layout.ledger), `${JSON.stringify({ id: ours[0] })}\n`);
    fs.mkdirSync(path.dirname(waitingPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(byEntry(logged)));
    fs.writeFileSync(waitingPath(), lines(
      byEntry(waited),
      { v: 1, awaits: { ledger: statePath(dir), entry: ours[0] }, event: byEntry(ours) },
      { v: 1, awaits: { ledger: statePath(aircon), entry: theirs[0] }, event: byEntry(theirs) },
    ));

    const look = countsOf(statePath(dir), { model: MODEL, now: FROZEN_MS }).kinds.look;
    assert.deepStrictEqual(look.changes.map(({ own, outcome, by }) => ({ own, outcome, by })), [
      { own: false, outcome: 'clean', by: 1 }, { own: false, outcome: 'clean', by: 1 }, { own: true, outcome: 'clean', by: 1 },
    ]);
  });
});

/**
 * The events of the trust log a data file holds: a JSON file's value, or
 * its list's, a JSON lines file's lines, each that reads as one.
 * @param {string} file
 */
function trustEventsIn(file) {
  const text = fs.readFileSync(file, 'utf8');
  /** @param {string} json */
  const parsed = (json) => {
    try {
      return [JSON.parse(json)].flat();
    } catch {
      return [];
    }
  };
  const values = file.endsWith('.jsonl') ? text.split('\n').flatMap(parsed) : parsed(text);
  return values.filter((value) => 'event' in readTrustEvent(value));
}

describe('what the release ships (16.16.1, 16.16.2)', () => {
  it('16.S51: holds the procedure and its defaults and no one\'s counts — no file it installs is a trust log, and none of its data holds an event of one — so with an empty log every kind asks at 95%, Claude\'s one-answer calls go ahead and every gate shows, where the author starts too (16.16.6)', () => {
    const release = ['skills', 'agents'].flatMap((top) => {
      const root = path.join(__dirname, '../..', top);
      return /** @type {string[]} */ (fs.readdirSync(root, { recursive: true })).map((rel) => path.join(root, rel));
    });
    const data = release.filter((file) => /\.jsonl?$/.test(file));
    const counted = [...release.filter((file) => path.basename(file) === TRUST_LOG), ...data.filter((file) => trustEventsIn(file).length > 0)];
    const empty = countsFrom([], { project: HERE, model: MODEL, now: FROZEN_MS });

    assert.deepStrictEqual([data.length > 0, counted], [true, []]);
    assert.deepStrictEqual(
      [...KINDS.map((kind) => standing(empty.kinds[kind]).asks), standing(empty.one).asks, standing(gateCount(empty, 'plan gate')).asks, round(upperBound({ losses: 0, clean: 0 }))],
      [...KINDS.map(() => true), false, true, 0.95],
    );
  });
});
