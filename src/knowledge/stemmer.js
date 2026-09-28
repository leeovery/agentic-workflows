'use strict';

// Porter2, the Snowball English stemmer (snowballstem.org/algorithms/english).
// Each step is the algorithm's step of the same name, and a word arrives
// lowercase, as the tokenizer gives it.

const VOWEL = /[aeiouy]/;
const VOWELS = new Set('aeiouy');
const VOWELS_WXY = new Set('aeiouywxY');
const VALID_LI = new Set('cdeghkmnrt');
const AEO = new Set('aeo');
const DOUBLES = ['bb', 'dd', 'ff', 'gg', 'mm', 'nn', 'pp', 'rr', 'tt'];

const EXCEPTIONS = new Map([
  ['skis', 'ski'], ['skies', 'sky'],
  ['idly', 'idl'], ['gently', 'gentl'], ['ugly', 'ugli'], ['early', 'earli'], ['only', 'onli'], ['singly', 'singl'],
  ...['sky', 'news', 'howe', 'atlas', 'cosmos', 'bias', 'andes'].map((word) => [word, word]),
]);
const REGION_PREFIXES = ['gener', 'commun', 'arsen', 'past', 'univers', 'later', 'emerg', 'organ', 'inter'];
const EED_KEPT = new Set(['proc', 'exc', 'succ']);
const ING_KEPT = new Set(['inn', 'out', 'cann', 'herr', 'earr', 'even']);

/**
 * @typedef {object} Regions
 * @property {number} p1  where R1 starts
 * @property {number} p2  where R2 starts
 */

/**
 * @typedef {[suffix: string, replacement: string, when?: (stem: string, regions: Regions) => boolean]} Rule
 *   a suffix, what replaces it, and any further condition on the word before it
 */

/** @param {Rule[]} rules @returns {Rule[]} longest suffix first */
function longestFirst(rules) {
  return [...rules].sort(([a], [b]) => b.length - a.length);
}

const STEP_2 = longestFirst([
  ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['abli', 'able'], ['entli', 'ent'],
  ['izer', 'ize'], ['ization', 'ize'], ['ational', 'ate'], ['ation', 'ate'], ['ator', 'ate'],
  ['alism', 'al'], ['aliti', 'al'], ['alli', 'al'], ['fulness', 'ful'], ['ousli', 'ous'], ['ousness', 'ous'],
  ['iveness', 'ive'], ['iviti', 'ive'], ['biliti', 'ble'], ['bli', 'ble'], ['ogist', 'og'],
  ['ogi', 'og', (stem) => stem.endsWith('l')],
  ['fulli', 'ful'], ['lessli', 'less'],
  ['li', '', (stem) => VALID_LI.has(stem[stem.length - 1])],
]);

const STEP_3 = longestFirst([
  ['tional', 'tion'], ['ational', 'ate'], ['alize', 'al'], ['icate', 'ic'], ['iciti', 'ic'], ['ical', 'ic'],
  ['ful', ''], ['ness', ''],
  ['ative', '', (stem, { p2 }) => stem.length >= p2],
]);

const STEP_4 = longestFirst([
  ...['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize']
    .map((suffix) => /** @type {Rule} */ ([suffix, ''])),
  ['ion', '', (stem) => /[st]$/.test(stem)],
]);

/**
 * The word with a leading apostrophe dropped, and each `y` that acts as a
 * consonant — first, or after a vowel — marked `Y`.
 * @param {string} word
 */
function prelude(word) {
  const letters = [...(word.startsWith("'") ? word.slice(1) : word)];
  if (letters[0] === 'y') letters[0] = 'Y';
  for (let i = 1; i < letters.length; i++) {
    if (letters[i] === 'y' && VOWELS.has(letters[i - 1])) letters[i] = 'Y';
  }
  return letters.join('');
}

/**
 * Where the region after the first vowel followed by a non-vowel, at or after
 * `from`, starts — the word's end where there is none.
 * @param {string} word @param {number} from
 */
function regionAfter(word, from) {
  const match = /[aeiouy][^aeiouy]/.exec(word.slice(from));
  return match ? from + match.index + 2 : word.length;
}

/** @param {string} word @returns {Regions} */
function regionsOf(word) {
  const prefix = REGION_PREFIXES.find((candidate) => word.startsWith(candidate));
  const p1 = prefix ? prefix.length : regionAfter(word, 0);
  return { p1, p2: regionAfter(word, p1) };
}

/**
 * Whether the word ends in a short syllable: a vowel between a non-vowel and
 * a non-vowel other than w, x and Y — or a vowel starting the word, then a
 * non-vowel — or `past`.
 * @param {string} word
 */
function endsShort(word) {
  const n = word.length;
  return (n >= 3 && !VOWELS.has(word[n - 3]) && VOWELS.has(word[n - 2]) && !VOWELS_WXY.has(word[n - 1]))
    || (n === 2 && VOWELS.has(word[0]) && !VOWELS.has(word[1]))
    || word.endsWith('past');
}

/**
 * The word with its longest suffix among the rules replaced — as it was when
 * that suffix starts before `from` or fails its rule's condition.
 * @param {string} word @param {Rule[]} rules  longest suffix first
 * @param {number} from @param {Regions} regions
 */
function replaceSuffix(word, rules, from, regions) {
  const rule = rules.find(([suffix]) => word.endsWith(suffix));
  if (!rule) return word;
  const [suffix, replacement, when] = rule;
  const stem = word.slice(0, word.length - suffix.length);
  return stem.length >= from && (!when || when(stem, regions)) ? stem + replacement : word;
}

/** @param {string} word */
function step1a(word) {
  const bare = word.replace(/'s'$|'s$|'$/, '');
  const suffix = ['sses', 'ied', 'ies', 'us', 'ss', 's'].find((candidate) => bare.endsWith(candidate));
  if (suffix === undefined) return bare;
  const stem = bare.slice(0, -suffix.length);
  switch (suffix) {
    case 'sses': return `${stem}ss`;
    case 'ied':
    case 'ies': return stem.length > 1 ? `${stem}i` : `${stem}ie`;
    case 's': return VOWEL.test(stem.slice(0, -1)) ? stem : bare;
    default: return bare;
  }
}

/** @param {string} word @param {Regions} regions */
function step1b(word, { p1 }) {
  const suffix = ['eedly', 'ingly', 'edly', 'eed', 'ing', 'ed'].find((candidate) => word.endsWith(candidate));
  if (suffix === undefined) return word;
  const stem = word.slice(0, -suffix.length);
  if (suffix === 'eed' || suffix === 'eedly') return stem.length >= p1 && !EED_KEPT.has(stem) ? `${stem}ee` : word;
  if (suffix === 'ing' && /^[^aeiouy]y$/.test(stem)) return `${stem[0]}ie`;
  if ((suffix === 'ing' && ING_KEPT.has(stem)) || !VOWEL.test(stem)) return word;
  if (/(at|bl|iz)$/.test(stem)) return `${stem}e`;
  if (DOUBLES.some((double) => stem.endsWith(double))) {
    return stem.length === 3 && AEO.has(stem[0]) ? stem : stem.slice(0, -1);
  }
  return stem.length === p1 && endsShort(stem) ? `${stem}e` : stem;
}

/** @param {string} word */
function step1c(word) {
  return /.[^aeiouy][yY]$/.test(word) ? `${word.slice(0, -1)}i` : word;
}

/** @param {string} word @param {Regions} regions */
function step2(word, regions) {
  return replaceSuffix(word, STEP_2, regions.p1, regions);
}

/** @param {string} word @param {Regions} regions */
function step3(word, regions) {
  return replaceSuffix(word, STEP_3, regions.p1, regions);
}

/** @param {string} word @param {Regions} regions */
function step4(word, regions) {
  return replaceSuffix(word, STEP_4, regions.p2, regions);
}

/** @param {string} word @param {Regions} regions */
function step5(word, { p1, p2 }) {
  const stem = word.slice(0, -1);
  if (word.endsWith('e') && (stem.length >= p2 || (stem.length >= p1 && !endsShort(stem)))) return stem;
  if (word.endsWith('l') && stem.length >= p2 && stem.endsWith('l')) return stem;
  return word;
}

const STEPS = [step1a, step1b, step1c, step2, step3, step4, step5];

/**
 * The word's Porter2 stem.
 * @param {string} word  lowercase
 * @returns {string}
 */
function stem(word) {
  const exception = EXCEPTIONS.get(word);
  if (exception !== undefined) return exception;
  if (word.length < 3) return word;
  const marked = prelude(word);
  const regions = regionsOf(marked);
  return STEPS.reduce((stemmed, step) => step(stemmed, regions), marked).replace(/Y/g, 'y');
}

module.exports = { stem };
