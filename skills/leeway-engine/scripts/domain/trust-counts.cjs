'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ask rule's numbers (16.4, 16.6, 16.12, 16.14, 16.20) —
// the counts the engine decides from, derived from the trust log's events
// each time they are read and never stored (16.13.6). Pure, the clock passed
// in, so the same events and the same clock always give the same numbers
// (16.1.3); `countsOf` reads the log once for them. An event after the clock
// has not happened yet.
//
// - A kind's count (16.4.4), each question under the kind its label composed
//   (16.11), as the person last corrected it (16.15.4) — an unlabelled one
//   under none — holds the person's answers, read through the evidence
//   (trust-evidence.cjs):
//   - clean: an answer that took Claude's lean, and a departure judged
//     nothing or a fix later;
//   - a loss: a departure judged a real loss, and one not yet judged or
//     skipped (16.4.3, 16.10.8);
//   - nothing: an answer the person didn't follow (16.12.3), and Claude's
//     own call, which no one answered;
//   - a reversal cancels the answer it reverses and is a departure, Claude's
//     call reversed among them (16.12.1).
//   Verification never enters: only the trust log is read (15.12.1).
// - The count of Claude's one-answer calls (16.4.10) holds every call and
//   raise Claude sorted as having one defensible answer: one standing, or
//   answered with Claude's lean, clean; one overruled — a raise answered
//   against the lean, a reversal of one — a loss, whatever its verdict
//   (16.4.2).
// - A gate's count (16.20.2), by its name (16.11.9): each answer by the row
//   it picked, a typed one by the row the separate call read from it. The
//   usual answer is the row picked most often — on a tie, which leaves half
//   the answers or more a loss and so never goes automatic, the first
//   counted; leaving it is a loss, free text read as no row among them.
// - Weights (16.12.4): an answer counts half once 183 days old (16.12.6).
//   And per model (16.4.4), by the model whose call it answers — a
//   reversal's that of the call it reverses, its age its own: the current
//   model's answers, and those logged with none, in full; each generation
//   before it in its line of model ids at half the one after it, so a new
//   model starts from its predecessor's counts at half; any other model's
//   not at all. A model no line holds is the first line's next generation,
//   and a session whose model is unread that line's newest.
// - The merge (16.14.3, 16.14.6): the person's other projects' answers,
//   weighted, then scaled together to at most 10 answers' weight, are the
//   prior the project's own answers are added to; a gate's are merged so too.
// - The bound (16.4.4): the 95th percentile of Beta(1 + losses, 1 + clean)
//   over fractional weights, so the regularised incomplete beta, never the
//   integer closed form.
// - The state (16.6.1): walked through the count's changes in time order —
//   an answer, a verdict, a reversal, an answer turning six months old, in
//   any project — at the threshold the question takes (16.4.7, 16.4.8): a
//   kind asks until its bound falls below the threshold, then stays quiet
//   until the bound exceeds a quarter above it, a bound at either line
//   leaving the state as it was. The one-answer count starts quiet, and
//   asks once it holds at least one overrule's weight, its own and its
//   prior's together, and its bound exceeds the threshold itself the first
//   time, a quarter above it after (16.4.10). A gate shows, and goes
//   automatic and back as a kind goes quiet and asks again (16.20.2).
// - A count also tallies the answers it holds of the project's own at the
//   session's model, whatever their age, none cancelled — a one-answer
//   count's calls among them: the fewer, the wider its range, and the more
//   of its calls blind questions draw (16.17.9, decision-point.cjs).
// - A blind question's reveal (16.17.7) says how often Claude picked as the
//   person did on its kind in the project: of the kind's latest answers,
//   25 at most (P9) — the person's to a raise, blind or shown, and their
//   reversals, none cancelled — those that took Claude's lean (`alikeOn`).
// - What ships is this procedure and its defaults, never anyone's counts
//   (16.16.1). The defaults are 16.20.1's, held with the person's own
//   settings over them (trust-settings.cjs).
// ---------------------------------------------------------------------------

const { evidenceIn } = require('./trust-evidence.cjs');
const { readPersonEvents, projectId } = require('./trust-log.cjs');
const { KINDS } = require('./event-fields.cjs');
const { ASK_AGAIN, PERCENTILE, PRIOR_CAP, AGED_AFTER_MS, AGED_WEIGHT, INHERITED_WEIGHT, REVEAL_LAST } = require('./trust-settings.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./trust-evidence.cjs').Answer} Answer */
/** @typedef {import('./trust-evidence.cjs').Given} Given */

// The main session's models, each line oldest first (E4): a release on a
// new model adds it last to its line, or a line of its own for a model that
// inherits none of them.
const MODEL_LINES = Object.freeze([Object.freeze(['claude-opus-4-8', 'claude-opus-5', 'claude-opus-5-5', 'claude-fable-5-1'])]);

const CLEAN = 'clean';
const LOSS = 'loss';
// The verdicts that judge a departure no loss (16.10.1).
const NO_LOSS = new Set(['nothing', 'fix']);

/**
 * What an answer counts as: clean or a loss; or at a gate, the row it
 * picked, null for free text read as no row.
 * @typedef {string|null} Outcome
 */
/** A change to a count: at a time, on the project's own side or its prior's, an outcome's weight moved by `by`. @typedef {{at: number, own: boolean, outcome: Outcome, by: number}} Change */
/** How a count is walked. @typedef {'kind'|'one'|'gate'} Rule */
/**
 * A count: how it is walked, its changes in time order, and how many of the
 * answers it holds are the project's own at the session's model, none
 * cancelled — what tells its range wide (16.17.9).
 * @typedef {{rule: Rule, changes: Change[], own: number}} Count
 */
/**
 * The counts on a project: each kind's, the one-answer calls', and each
 * answered gate's by its name.
 * @typedef {{kinds: Record<Kind, Count>, one: Count, gates: Map<string, Count>}} Counts
 */
/** A count's split, at a gate with its usual answer. @typedef {{losses: number, clean: number, usual?: string|null}} Split */
/** Where a count stands: whether it asks, its bound, and its split. @typedef {Split & {asks: boolean, bound: number}} State */

// Lanczos' approximation, g = 7, n = 9.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(z), for z ≥ 1/2. @param {number} z */
function lnGamma(z) {
  const x = z - 1;
  const series = LANCZOS.slice(1).reduce((sum, c, i) => sum + c / (x + i + 1), LANCZOS[0]);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(series);
}

const TINY = 1e-300;
const EPSILON = 1e-16;
const MAX_TERMS = 10000;

/** @param {number} v */
const notTiny = (v) => (Math.abs(v) < TINY ? TINY : v);

/**
 * The continued fraction of the incomplete beta, by Lentz's method; it
 * converges fast for x below (a + 1) / (a + b + 2).
 * @param {number} x @param {number} a @param {number} b
 */
function betaFraction(x, a, b) {
  let c = 1;
  let d = 1 / notTiny(1 - ((a + b) * x) / (a + 1));
  let h = d;
  for (let m = 1; m <= MAX_TERMS; m += 1) {
    const even = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / notTiny(1 + even * d);
    c = notTiny(1 + even / c);
    h *= d * c;
    const odd = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / notTiny(1 + odd * d);
    c = notTiny(1 + odd / c);
    const step = d * c;
    h *= step;
    if (Math.abs(step - 1) < EPSILON) break;
  }
  return h;
}

/**
 * The regularised incomplete beta I_x(a, b): the chance that Beta(a, b)
 * falls below x.
 * @param {number} x @param {number} a @param {number} b
 */
function betaCdf(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2) ? (front * betaFraction(x, a, b)) / a : 1 - (front * betaFraction(1 - x, b, a)) / b;
}

const BISECTIONS = 64;

/**
 * The pessimistic rate (16.4.4): the 95th percentile of
 * Beta(1 + losses, 1 + clean).
 * @param {Split} split
 */
function upperBound({ losses, clean }) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < BISECTIONS; i += 1) {
    const mid = (low + high) / 2;
    if (betaCdf(mid, 1 + losses, 1 + clean) < PERCENTILE) low = mid;
    else high = mid;
  }
  return high;
}

/** Whether the bound falls below `rate`. @param {number} rate @param {Split} split */
const below = (rate, { losses, clean }) => betaCdf(rate, 1 + losses, 1 + clean) > PERCENTILE;

/** Whether the bound exceeds `rate`. @param {number} rate @param {Split} split */
const above = (rate, { losses, clean }) => betaCdf(rate, 1 + losses, 1 + clean) < PERCENTILE;

/**
 * The models whose answers `current` reads, nearest first: itself and the
 * generations before it in its line of `lines`; a model no line holds,
 * itself and then the first line's from its newest; a session whose model
 * is unread, the first line's from its newest.
 * @param {string|null} current @param {readonly (readonly string[])[]} [lines]
 * @returns {string[]}
 */
function ancestryOf(current, lines = MODEL_LINES) {
  const line = current === null ? undefined : lines.find((generations) => generations.includes(current));
  if (line !== undefined) return line.slice(0, line.indexOf(/** @type {string} */ (current)) + 1).reverse();
  const continued = [...lines[0]].reverse();
  return current === null ? continued : [current, ...continued];
}

/**
 * How much an answer to a call of the model `of` counts for a model reading
 * `ancestry`: in full where none is named; halved for each step back along
 * it; else nothing.
 * @param {string|null} of @param {string[]} ancestry
 */
function modelWeight(of, ancestry) {
  if (of === null) return 1;
  const back = ancestry.indexOf(of);
  return back < 0 ? 0 : INHERITED_WEIGHT ** back;
}

/**
 * An answer as a count holds it: when it was given, whether it is the
 * project's own, its weight in full, and when a reversal cancels it.
 * @typedef {{at: number, own: boolean, weight: number, end: number}} Held
 */

/** What an answer adds to a count: its outcome, at a weight. @typedef {{outcome: Outcome, by: number}} Counted */

/** Whether two of what an answer adds, none among them, are the same. @param {Counted|null} a @param {Counted|null} b */
const sameCounted = (a, b) => a?.outcome === b?.outcome && a?.by === b?.by;

/**
 * The changes an answer makes to a count up to `now`: from when it was
 * given, its outcome at each of `moments` as `outcomeAt` reads it, at its
 * weight, halved once it is 183 days old, until it is cancelled.
 * @param {Held} held @param {(at: number) => Outcome} outcomeAt @param {number[]} moments @param {number} now
 * @returns {Change[]}
 */
function changesOf({ at, own, weight, end }, outcomeAt, moments, now) {
  const aged = at + AGED_AFTER_MS;
  const times = [...new Set([at, ...moments, aged, end])].filter((t) => t >= at && t <= now).sort((x, y) => x - y);
  /** @type {Change[]} */
  const changes = [];
  /** @type {Counted|null} */
  let counted = null;
  for (const t of times) {
    /** @type {Counted|null} */
    const next = t >= end ? null : { outcome: outcomeAt(t), by: t >= aged ? weight * AGED_WEIGHT : weight };
    if (sameCounted(counted, next)) continue;
    if (counted !== null) changes.push({ at: t, own, outcome: counted.outcome, by: -counted.by });
    if (next !== null) changes.push({ at: t, own, ...next });
    counted = next;
  }
  return changes;
}

/**
 * A departure's outcome at time `t`: clean once its latest verdict by then
 * judges it no loss, else a loss.
 * @param {Given[]} given its verdicts, in the order given @param {number} t
 * @returns {Outcome}
 */
function judgedAt(given, t) {
  const latest = given.filter(({ at }) => at <= t).pop();
  return latest !== undefined && NO_LOSS.has(latest.verdict) ? CLEAN : LOSS;
}

/**
 * The changes an answer makes to its kind's count: an agreement clean, a
 * departure as judged at each moment a verdict is given on it; none for any
 * other.
 * @param {Answer} answer @param {Held} held @param {Map<string, Given[]>} verdicts @param {number} now
 * @returns {Change[]}
 */
function kindChanges({ event, standing }, held, verdicts, now) {
  if (standing === 'agreement') return changesOf(held, () => CLEAN, [], now);
  if (standing !== 'departure') return [];
  const given = verdicts.get(/** @type {string} */ (event.entry)) ?? [];
  return changesOf(held, (t) => judgedAt(given, t), given.map(({ at }) => at), now);
}

/** What each standing counts as in the one-answer calls' count. @type {Readonly<Record<string, Outcome>>} */
const ONE_ANSWER = Object.freeze({ agreement: CLEAN, call: CLEAN, departure: LOSS });

/** The standings a kind's count holds: the person's answers. */
const KIND_HOLDS = Object.freeze(['agreement', 'departure']);

/**
 * The changes an answer makes to the one-answer calls' count.
 * @param {Answer} answer @param {Held} held @param {number} now
 * @returns {Change[]}
 */
function oneAnswerChanges({ standing }, held, now) {
  return Object.hasOwn(ONE_ANSWER, standing) ? changesOf(held, () => ONE_ANSWER[standing], [], now) : [];
}

/** A count of `rule` with no changes yet. @param {Rule} rule @returns {Count} */
const emptyCount = (rule) => ({ rule, changes: [], own: 0 });

/**
 * An answer's changes added to `count`, and the answer to those it holds of
 * the project's own at the session's model where `here`.
 * @param {Count} count @param {Change[]} changes @param {boolean} here
 */
function counted(count, changes, here) {
  count.changes.push(...changes);
  if (here) count.own += 1;
}

/**
 * How often Claude's sealed answer was the person's on `kind` (the
 * header's): `alike` of the last `of` answers of it `answers` holds; none
 * of none for no kind.
 * @param {Answer[]} answers @param {Kind|null} kind
 * @returns {{alike: number, of: number}}
 */
function alikeOn(answers, kind) {
  const last = answers
    .filter((answer) => kind !== null && answer.kind === kind && answer.cancelled_by === null && KIND_HOLDS.includes(answer.standing))
    .map(({ event, standing }) => ({ at: Date.parse(/** @type {string} */ (event.at)), standing }))
    .sort((a, b) => a.at - b.at)
    .slice(-REVEAL_LAST);
  return { alike: last.filter(({ standing }) => standing === 'agreement').length, of: last.length };
}

/**
 * A gate's count, read from `counts` by its name; one with no answers where
 * it has none.
 * @param {Counts} counts @param {string} name
 */
function gateCount(counts, name) {
  return counts.gates.get(name) ?? emptyCount('gate');
}

/**
 * The counts `events` hold for the project `project` — every project's
 * events on the machine, as `readPersonEvents` reads them, the others' its
 * prior — for the model `model` as of the time `now`. Pure.
 * @param {Record<string, unknown>[]} events
 * @param {{project: string|null, model: string|null, now: number}} clock
 * @returns {Counts}
 */
function countsFrom(events, { project, model, now }) {
  const happened = events.filter(({ at }) => Date.parse(/** @type {string} */ (at)) <= now);
  const evidence = evidenceIn(happened);
  const timeOf = new Map(evidence.answers.map(({ event }) => [event.id, Date.parse(/** @type {string} */ (event.at))]));
  /** @type {Record<Kind, Count>} */
  const kinds = /** @type {Record<Kind, Count>} */ (Object.fromEntries(KINDS.map((kind) => [kind, emptyCount('kind')])));
  const one = emptyCount('one');
  /** @type {Map<string, Count>} */
  const gates = new Map();
  const ancestry = ancestryOf(model);
  /** @param {Record<string, unknown>} event @param {string|null} of @param {string|null} cancelledBy @returns {Held} */
  const held = (event, of, cancelledBy) => ({
    at: Date.parse(/** @type {string} */ (event.at)),
    own: event.project === project,
    weight: modelWeight(of, ancestry),
    end: cancelledBy === null ? Infinity : /** @type {number} */ (timeOf.get(cancelledBy)),
  });
  for (const answer of evidence.answers) {
    const answered = held(answer.event, answer.model, answer.cancelled_by);
    if (answered.weight === 0) continue;
    const here = answered.own && answered.weight === 1 && answer.cancelled_by === null;
    if (answer.kind !== null) counted(kinds[answer.kind], kindChanges(answer, answered, evidence.verdicts, now), here && KIND_HOLDS.includes(answer.standing));
    if (answer.sort === 'one') counted(one, oneAnswerChanges(answer, answered, now), here && Object.hasOwn(ONE_ANSWER, answer.standing));
  }
  for (const event of happened.filter(({ type }) => type === 'gate')) {
    const answered = held(event, /** @type {string|null} */ (event.model), null);
    if (answered.weight === 0) continue;
    const name = /** @type {string} */ (event.gate);
    const count = gates.get(name) ?? emptyCount('gate');
    gates.set(name, count);
    const row = /** @type {Outcome} */ (event.picked ?? event.reading);
    count.changes.push(...changesOf(answered, () => row, [], now));
  }
  for (const count of [...Object.values(kinds), one, ...gates.values()]) count.changes.sort((a, b) => a.at - b.at);
  return { kinds, one, gates };
}

/**
 * The counts on the project whose state is at `root`, for the model `model`
 * as of the time `now`: every project's events on this machine read once
 * (trust-log.cjs). Refuses a project whose manifest holds no project_id.
 * @param {string} root the project's state root
 * @param {{model: string|null, now: number}} clock
 * @returns {Counts}
 */
function countsOf(root, { model, now }) {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  readPersonEvents(root, (event) => events.push(event));
  return countsFrom(events, { project: projectId(root), model, now });
}

/**
 * The weights the project's own answers and its prior hold, merged: the
 * prior scaled to at most PRIOR_CAP answers' weight, then added.
 * @param {Map<Outcome, number>} own @param {Map<Outcome, number>} prior
 * @returns {Map<Outcome, number>}
 */
function merged(own, prior) {
  const total = [...prior.values()].reduce((sum, w) => sum + w, 0);
  const scale = total > PRIOR_CAP ? PRIOR_CAP / total : 1;
  const both = new Map(own);
  for (const [outcome, w] of prior) both.set(outcome, (both.get(outcome) ?? 0) + w * scale);
  return both;
}

/** A kind's or the one-answer calls' split: its losses and its clean answers. @param {Map<Outcome, number>} weights @returns {Split} */
const splitOf = (weights) => ({ losses: weights.get(LOSS) ?? 0, clean: weights.get(CLEAN) ?? 0 });

/**
 * A gate's split: its usual answer, the row picked most often — the first
 * counted on a tie — clean, and every other answer a loss.
 * @param {Map<Outcome, number>} weights @returns {Split}
 */
function usualSplit(weights) {
  let usual = null;
  let most = 0;
  let total = 0;
  for (const [row, w] of weights) {
    total += w;
    if (row !== null && w > most) [usual, most] = [row, w];
  }
  return { losses: total - most, clean: most, usual };
}

/**
 * How each rule is walked: its split, whether it asks before any change,
 * where it first asks again — times the threshold — and the losses' weight
 * asking needs: for the one-answer calls, one overrule's.
 * @type {Readonly<Record<Rule, {split: (weights: Map<Outcome, number>) => Split, asks: boolean, opensAt: number, needs: number}>>}
 */
const RULES = Object.freeze({
  kind: { split: splitOf, asks: true, opensAt: ASK_AGAIN, needs: 0 },
  one: { split: splitOf, asks: false, opensAt: 1, needs: 1 },
  gate: { split: usualSplit, asks: true, opensAt: ASK_AGAIN, needs: 0 },
});

/** Add `by` to `outcome`'s weight in `weights`. @param {Map<Outcome, number>} weights @param {Outcome} outcome @param {number} by */
function add(weights, outcome, by) {
  weights.set(outcome, (weights.get(outcome) ?? 0) + by);
}

/**
 * Where `count` stands at `threshold`: walked through its changes in time
 * order, each moment's changes taken together, then the state moved where
 * the bound crosses a line (16.6.1).
 * @param {Count} count @param {number} threshold the one the question takes
 * @returns {State}
 */
function stateOf({ rule, changes }, threshold) {
  const { split: splitBy, asks: asksFirst, opensAt, needs } = RULES[rule];
  /** @type {Map<Outcome, number>} */
  const own = new Map();
  /** @type {Map<Outcome, number>} */
  const prior = new Map();
  let asks = asksFirst;
  let opens = threshold * opensAt;
  let split = splitBy(new Map());
  changes.forEach((change, i) => {
    add(change.own ? own : prior, change.outcome, change.by);
    if (changes[i + 1]?.at === change.at) return;
    split = splitBy(merged(own, prior));
    if (asks && below(threshold, split)) {
      asks = false;
      opens = threshold * ASK_AGAIN;
    } else if (!asks && above(opens, split) && split.losses >= needs) {
      asks = true;
    }
  });
  return { asks, bound: upperBound(split), ...split };
}

module.exports = { MODEL_LINES, upperBound, ancestryOf, countsFrom, countsOf, gateCount, stateOf, alikeOn };
