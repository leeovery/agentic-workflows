'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the convergence offer (16.8.2) — one MENU, under the gate
// `convergence offer`, from what `render convergence` read
// (convergence.cjs): the run it comes after, "8 agreements in a row on
// {Topic}.", or the person's word that brought it; how many points are
// open, how many Claude would settle and which still come to the person by
// the rule, by kind, the most first, kinds tied in the order the labeller
// composes them and a question of no kind last; then `y/yes`, settling the
// rest — `convergence accept` — and `n/no`, not yet — `convergence
// decline`. Its DATA, for Claude alone: that the forecast is the rule's as
// the counts stand now, so at settle time a point may still be drawn blind
// and come to the person, its reveal saying why; and each open question by
// its short id, with what the rule forecasts for it and its kind.
// ---------------------------------------------------------------------------

const { section, dataSection, menu, cmdOption, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { KINDS } = require('../event-fields.cjs');

/** @typedef {import('../event-fields.cjs').Kind} Kind */
/** @typedef {import('../convergence.cjs').Forecast} Forecast */
/** @typedef {import('./surfaces.cjs').Next} Next */

const OFFER_GATE = 'convergence offer';

// The kinds a count of questions names in the plural; the rest read as they are.
/** @type {Readonly<Partial<Record<Kind, string>>>} */
const PLURAL = Object.freeze({ contract: 'contracts', look: 'looks' });

const NO_KIND = 'of a kind I couldn\'t tell';

/** An engine command a row leads to. @param {...string} argv @returns {Next} */
const engine = (...argv) => ({ kind: 'engine', argv });

/** `one` or `many`, as a count of `n` takes. @param {number} n @param {string} one @param {string} many */
const agreeing = (n, one, many) => (n === 1 ? one : many);

/** `n` questions of `kind` as the forecast names them. @param {Kind|null} kind @param {number} n */
function ofKind(kind, n) {
  if (kind === null) return `${n} ${NO_KIND}`;
  return `${n} ${n === 1 ? kind : PLURAL[kind] ?? kind}`;
}

/** The order the forecast names kinds in, a question of no kind last. @param {Kind|null} kind */
const kindOrder = (kind) => (kind === null ? KINDS.length : KINDS.indexOf(kind));

/** The questions coming to the person, by kind, the most first. @param {Forecast[]} yours */
function byKind(yours) {
  /** @type {Map<Kind|null, number>} */
  const tally = new Map();
  for (const { kind } of yours) tally.set(kind, (tally.get(kind) ?? 0) + 1);
  return [...tally].sort(([a, m], [b, n]) => n - m || kindOrder(a) - kindOrder(b)).map(([kind, n]) => ofKind(kind, n)).join(', ');
}

/**
 * The forecast's line: how many are open, how many Claude would settle, and
 * which come to the person, by kind.
 * @param {number} open @param {number} mine @param {Forecast[]} yours
 */
function forecastLine(open, mine, yours) {
  const all = open === 1 ? 'it' : `all ${open}`;
  if (yours.length === 0) return `${open} open: I'd settle ${all}.`;
  const come = `${agreeing(yours.length, 'comes', 'come')} to you — ${byKind(yours)}`;
  return mine === 0 ? `${open} open: ${all} ${come}.` : `${open} open: I'd settle ${mine}; ${yours.length} ${come}.`;
}

/** What settling the rest does, as its row says. @param {number} mine @param {number} yours */
function settled(mine, yours) {
  const parts = [
    ...(mine === 0 ? [] : [`my ${mine} ${agreeing(mine, 'goes', 'go')} in the ledger`]),
    ...(yours === 0 ? [] : [`your ${yours} ${agreeing(yours, 'comes', 'come')} one at a time`]),
    'then the decided screen',
  ];
  return `Settle the rest — ${parts.join(', ')}`;
}

/**
 * The offer's DATA (the header's): why it comes, what the forecast is, each
 * open question's forecast, and what the reads said.
 * @param {number|null} run @param {Forecast[]} forecast @param {string[]} warnings
 */
function offerData(run, forecast, warnings) {
  return dataSection([
    `offer: ${run === null ? 'on the person\'s word' : `after ${run} agreements in a row`}`,
    'forecast: the ask rule\'s as the counts stand now, never binding — settling raises each open question as any call, and the rule decides each; at settle time a point may still be drawn blind and come to the person, its reveal saying why',
    ...forecast.map(({ short, kind, mine }) => `open ${short}: ${mine ? 'mine' : 'yours'}, ${kind ?? 'no kind'}`),
    ...warnings.map((warning) => `warning: ${warning}`),
  ]);
}

/**
 * The convergence offer (the header's): the topic by its title, the unit
 * and the topic's key its rows name, the run it comes after — null on the
 * person's word — each open question's forecast, and what the reads said.
 * @param {{title: string, unit: string, topic: string, run: number|null, forecast: Forecast[], warnings: string[]}} offer
 * @returns {string}
 */
function offerScreen({ title, unit, topic, run, forecast, warnings }) {
  const yours = forecast.filter(({ mine }) => !mine);
  const mine = forecast.length - yours.length;
  const why = run === null ? `You've asked me to settle the rest of ${title}.` : `${run} agreements in a row on ${title}.`;
  const rows = [
    cmdOption('y', 'yes', settled(mine, yours.length), { next: engine('convergence', 'accept', unit, topic) }),
    cmdOption('n', 'no', 'Not yet — keep going point by point; I\'ll offer again after the next run', { next: engine('convergence', 'decline', unit, topic) }),
  ];
  return offerData(run, forecast, warnings)
    + section(`MENU: ${OFFER_GATE}`, MENU_INSTRUCTION, menu([why, '', forecastLine(forecast.length, mine, yours)].join('\n'), rows, { question: 'Settle the rest?' }));
}

module.exports = { OFFER_GATE, offerScreen };
