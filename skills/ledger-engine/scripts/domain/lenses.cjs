'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the perspectives' polarity pairs (9.8.13) — each pair a lens
// and its counter-lens, a deliberate counterweight, so the two angles a
// decision is argued from never overlap. A perspective dispatch is one pair,
// and the lens a perspective's brief draws is its dispatch's label (6.5.6):
// a label that is no lens would carry free text into the brief. The
// perspective agent's definition names the same pairs, held equal to these
// by its test. Pure.
// ---------------------------------------------------------------------------

/** Each polarity pair, a lens and its counter-lens. @type {ReadonlyArray<ReadonlyArray<string>>} */
const POLARITY_PAIRS = Object.freeze([
  ['formal-systems', 'incentive-realist'],
  ['ship-now', 'strategic-timing'],
  ['direct-fix', 'systems-thinker'],
  ['common-path', 'tail-risk'],
  ['user-centric', 'capability-first'],
  ['classifier', 'emergence'],
  ['assumption-destroyer', 'first-principles'],
]);

/** A lens's counter-lens; null for a label that is no lens. @param {string} lens @returns {string|null} */
function counterLens(lens) {
  const pair = POLARITY_PAIRS.find((each) => each.includes(lens));
  return pair === undefined ? null : pair[pair[0] === lens ? 1 : 0];
}

/**
 * Why `labels` are not one polarity pair — two lenses, each the other's
 * counter-lens — or null where they are.
 * @param {readonly string[]} labels @returns {string|null}
 */
function pairProblem(labels) {
  const named = POLARITY_PAIRS.map(([lens, counter]) => `${lens}/${counter}`).join(', ');
  const strange = labels.find((label) => counterLens(label) === null);
  if (strange !== undefined) return `${JSON.stringify(strange)} is no lens — a perspective argues one of the polarity pairs: ${named}`;
  if (labels.length !== 2 || counterLens(labels[0]) !== labels[1]) {
    return `a perspective dispatch is one polarity pair, a lens and its counter-lens, as two --label — ${labels.length === 0 ? 'none was given' : `${labels.join(' and ')} ${labels.length === 1 ? 'is one lens' : 'are no pair'}`}: ${named}`;
  }
  return null;
}

module.exports = { POLARITY_PAIRS, counterLens, pairProblem };
