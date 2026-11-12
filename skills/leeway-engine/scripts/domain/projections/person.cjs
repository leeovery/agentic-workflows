'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the proposal screen of the record of the person (16.18.3,
// 16.5.6) — Claude's proposal, as it is held (person-verbs.cjs), for the
// person's yes. Above the rule, FOR THE RECORD OF YOU: the entry —
// a preference in its words, or a care entry by its project and kind, each
// headed "Drop" where the proposal drops it — Claude's why and its examples,
// wrapped to the pane. Under the rule, what keeping it, or dropping it,
// would change: a preference shapes what Claude picks in every project and
// never whether it asks (16.18.4); a care entry is the one way the record
// changes whether it asks (16.5.2); a care entry dropped leaves its kind to
// the counts, which kept counting while it stood (16.5.5). Then `y/yes`,
// leading to `person keep` or `person drop`; `n/no`, to `person discard`,
// which lets the proposal go; and a Comment, carrying on.
// ---------------------------------------------------------------------------

const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { section, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');

/** @typedef {import('../person-verbs.cjs').Proposal} Proposal */
/** @typedef {import('./surfaces.cjs').Next} Next */

const HEAD = 'FOR THE RECORD OF YOU';
const CARRY_ON = /** @type {Next} */ (Object.freeze({ kind: 'continue' }));
const DISCARD = /** @type {Next} */ (Object.freeze({ kind: 'engine', argv: ['person', 'discard'] }));

/** A kind as a sentence opens on it. @param {string} kind */
const opening = (kind) => kind.charAt(0).toUpperCase() + kind.slice(1);

/**
 * `text` wrapped to `width`, its first line after `first`, the rest after
 * `rest`, each wrapped to the room its prefix leaves.
 * @param {string} first @param {string} rest @param {string} text @param {number} width
 */
function hanging(first, rest, text, width) {
  const [head, ...tail] = wrap(text, width - first.length);
  const after = tail.length === 0 ? [] : wrap(tail.join(' '), width - rest.length);
  return [`${first}${head}`, ...after.map((line) => `${rest}${line}`)];
}

/** The entry as the screen heads it. @param {Proposal} proposal */
function entryLine({ drop, preference, care }) {
  if (care === null) return drop ? `Drop "${preference}"` : /** @type {string} */ (preference);
  const named = `"${care.name}: ${care.kind}"`;
  return drop ? `Drop the care entry ${named}` : `Care entry ${named}`;
}

/**
 * What the proposal would change, under the rule; the question; and the
 * labels of its no row and its Comment.
 * @param {Proposal} proposal
 * @returns {{statement: string, question: string, no: string, comment: string}}
 */
function asked({ drop, care }) {
  if (!drop) {
    const statement = care === null
      ? 'It would shape what I pick in every project, whether I decide or lean as I ask — never whether I ask.'
      : `${opening(care.kind)} would always ask you in ${care.name}, however well my calls have matched, and its answers would still count.`;
    return { statement, question: 'Keep it in the record of you?', no: 'Leave it out — nothing is kept', comment: 'Tell me how to word it' };
  }
  const left = care === null
    ? { statement: 'Dropped, it no longer shapes what I pick, in any project.', no: 'Keep it — it keeps shaping what I pick' }
    : { statement: `Dropped, ${care.kind} follows the counts, which kept counting while the entry stood: it asks you as any kind does, by its rate.`, no: `Keep it — ${care.kind} keeps asking you every time` };
  return { ...left, question: 'Drop it from the record of you?', comment: 'Tell me why it should stay' };
}

/**
 * The proposal screen (the header's).
 * @param {Proposal} proposal
 * @returns {string}
 */
function proposalScreen(proposal) {
  const width = displayWidth();
  const shown = [
    HEAD,
    ...wrap(entryLine(proposal), width),
    ...hanging('  ↳ Why: ', '    ', proposal.why, width),
    '  ↳ Examples:',
    ...proposal.examples.flatMap((example) => hanging('    · ', '      ', example, width)),
  ];
  const { statement, question, no, comment } = asked(proposal);
  const gate = proposal.drop ? 'record drop' : 'record proposal';
  const yes = proposal.drop ? { label: 'Drop it', argv: ['person', 'drop'] } : { label: 'Keep it', argv: ['person', 'keep'] };
  return section(`DISPLAY: ${gate}`, emitAs('text'), shown.join('\n'))
    + section(`MENU: ${gate}`, MENU_INSTRUCTION, menu(wrap(statement, width).join('\n'), [
      cmdOption('y', 'yes', yes.label, { next: { kind: 'engine', argv: yes.argv } }),
      cmdOption('n', 'no', no, { next: DISCARD }),
      promptOption('Comment', comment, { next: CARRY_ON }),
    ], { question }));
}

module.exports = { proposalScreen };
