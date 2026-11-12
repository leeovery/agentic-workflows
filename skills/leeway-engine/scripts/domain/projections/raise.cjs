'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a raise's screen (16.9.2) — one MENU, drawn from the raise's
// seal alone (raise.cjs), read cold and product first: where the question
// stands — for a question waiting in the build, its number and the tasks it
// parks besides (16.9.5, 12.12.5) — the question, what Claude found stepping
// back from the problem where its call says (19.4.21), Claude's lean, what
// the person would notice with each row, why it asks, and, with the toggle
// on, the mechanism; then the rows, the lean recommended, the toggle, "I
// don't follow" and a comment.
// A raise on a replacement draws Claude's proposals, then the row its seal
// holds for keeping the entry as it stands, never recommended — but where a
// row of Claude's holds the entry's answer, which only a blind question
// drawn on Claude's own call mid-build does (raise.cjs), that row stands for
// keeping it. A fact draws no lean and recommends no row, asks for the
// answer, and draws what the person would notice only where it has rows;
// its comment takes the answer in the person's own words.
// A blind question (16.17.2) draws the question cold: no lean, no row
// recommended and no WHY I'M ASKING, the mechanism behind its toggle drawn
// as Claude wrote it, its rows in the order and the keys its seal holds —
// the question's id's (raise.cjs, `inBlindOrder`) — Claude's answer held
// in the seal alone until the person's is given (16.1.2), and every
// surface reading the seal shows no lean until then (`leanShown`). Once
// answered, the reveal (16.17.7): what the person picked, what Claude would
// have picked, and, on the question's kind in the project, how often Claude
// has picked as the person did (P9), a text display Claude carries on
// past.
// Every line above the rows is the menu's statement, so a surface drawing
// the gate payload draws it all. Claude's words are escaped, so they read
// as written, never as markup; the mechanism keeps its lines, each drawn
// from its first word: a leading indent in a menu is a row's continuation.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, MENU_INSTRUCTION, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { escapeMarkdown } = require('./worklist.cjs');
const { titlecase, TREE_WIDTH } = require('../conventions.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { titled } = require('../derivations.cjs');
const { numbered, parkedTasks } = require('../questions.cjs');

/** @typedef {import('../raise.cjs').Seal} Seal */
/** @typedef {import('./surfaces.cjs').Next} Next */

/** An engine command a row leads to. @param {string[]} argv @returns {Next} */
function engine(argv) {
  return { kind: 'engine', argv };
}

/** The mechanism's lines as written, each escaped, from its first word. @param {string} mechanism */
function mechanismLines(mechanism) {
  return mechanism.split(/\r?\n/).map((line) => escapeMarkdown(line.trimStart()));
}

/**
 * The row keeping the entry a raise on a replacement would replace, as it
 * stands: a row of Claude's holding its answer, else the seal's own; null
 * on a question.
 * @param {Seal} seal
 * @returns {import('../raise.cjs').Row|null}
 */
function keepingRow({ call, replaces }) {
  if (replaces === null) return null;
  return call.rows.find((row) => row.text === replaces.keep.text) ?? replaces.keep;
}

/**
 * The rows a raise draws: Claude's, then the row keeping the entry it would
 * replace, where none of Claude's is it.
 * @param {Seal} seal
 * @returns {import('../raise.cjs').Row[]}
 */
function drawnRows(seal) {
  const keeps = keepingRow(seal);
  return keeps === null || seal.call.rows.includes(keeps) ? seal.call.rows : [...seal.call.rows, keeps];
}

/**
 * The lean's key as a surface may show it: null on a fact, and on a blind
 * question until the person has answered it.
 * @param {Seal} seal @returns {string|null}
 */
function leanShown(seal) {
  return seal.fact || (seal.blind && seal.answered === null) ? null : seal.call.lean;
}

/**
 * What the screen asks, and its prompt row's label: a fact's answer comes
 * in the person's own words.
 * @param {Seal} seal
 */
function asking({ fact }) {
  return fact
    ? { question: 'What\'s the answer?', prompt: 'Tell me in your own words, or ask about it' }
    : { question: 'Which way?', prompt: 'Ask about it, or tell me what I\'ve missed' };
}

/**
 * Where the question stands: its unit, and its topic where it has one of its
 * own, by the name it goes by; a question waiting in the build, by its
 * number before them and the tasks it parks after, where it parks any: the
 * first, and how many more (12.12.5).
 * @param {Seal} seal @param {Record<string, string>} titles
 */
function header({ place: { unit, topic }, parks }, titles) {
  return [
    ...(parks === null ? [] : [numbered(parks.number)]),
    titlecase(unit),
    ...(topic === null || topic === unit ? [] : [titled(titles, topic)]),
    ...(parks === null || parks.tasks.length === 0 ? [] : [`parks ${parkedTasks(parks.tasks)}`]),
  ].join(' · ');
}

/** What Claude found stepping back, where its call says; a fact's says none. @param {Seal['call']} call @returns {string[]} */
function steppedBack(call) {
  const found = 'stepped_back' in call ? call.stepped_back : undefined;
  return found === undefined ? [] : ['WHAT I FOUND STEPPING BACK', '', ...found.map((line) => `- ${escapeMarkdown(line)}`)];
}

/**
 * The lines above the rows, each block apart: the header, the question,
 * what the step back found, the lean as shown, what the person would
 * notice, why it asks — none on a blind question — and the mechanism where
 * it is shown.
 * @param {Seal} seal @param {boolean} technical @param {Record<string, string>} titles
 * @returns {string[]}
 */
function statement(seal, technical, titles) {
  const { call, reason } = seal;
  const lean = call.rows.find((row) => row.key === leanShown(seal));
  const rows = drawnRows(seal);
  const blocks = [
    [header(seal, titles)],
    [escapeMarkdown(call.question)],
    steppedBack(call),
    lean === undefined ? [] : [`I lean: ${escapeMarkdown(lean.text)}`],
    rows.length === 0 ? [] : ['WHAT YOU\'D NOTICE', '', ...rows.map((row) => `- ${escapeMarkdown(row.name)}: ${escapeMarkdown(row.notice)}`)],
    seal.blind ? [] : ['WHY I\'M ASKING', '', escapeMarkdown(reason)],
    technical ? ['THE MECHANISM', '', ...mechanismLines(call.mechanism)] : [],
  ];
  return blocks.filter((block) => block.length > 0).flatMap((block, i) => (i === 0 ? block : ['', ...block]));
}

/**
 * The raise's MENU, declared as its seal names it; `titles` the place's
 * unit's topic titles.
 * @param {Seal} seal @param {{technical?: boolean, titles: Record<string, string>}} opts
 * @returns {string}
 */
function raiseScreen(seal, { technical = false, titles }) {
  const { id } = seal;
  const { question, prompt } = asking(seal);
  const rows = [
    ...drawnRows(seal).map((row) => cmdOption(row.key, null, { head: escapeMarkdown(row.text), recommended: row.key === leanShown(seal) }, { next: engine(['raise', 'answer', id, '--pick', row.key]) })),
    cmdOption('t', 'technical', technical ? 'Hide the mechanism' : 'Show the mechanism', { next: engine(['raise', 'show', id, ...(technical ? [] : ['--technical'])]) }),
    cmdOption('e', 'explain', 'I don\'t follow — explain it again', { next: engine(['raise', 'answer', id, '--didnt-follow']) }),
    promptOption('Comment', prompt),
  ];
  return section(`MENU: ${seal.menu}`, MENU_INSTRUCTION, menu(statement(seal, technical, titles).join('\n'), rows, { question }));
}

/**
 * What the person answered and Claude's answer as the reveal says each, as
 * written — a name opening it keeps its capital — ending on a full stop.
 * @param {string} text
 */
function revealed(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * How often Claude has picked as the person did on the question's kind in
 * the project, `alike` of the last `of` (P9); none where the question has
 * no kind.
 * @param {string|null} kind @param {string} project @param {number} alike @param {number} of
 * @returns {string[]}
 */
function alikeSaid(kind, project, alike, of) {
  if (kind === null || of === 0) return [];
  return [of === 1 ? `On ${kind} in ${project}, that's the first answer you've given.` : `On ${kind} in ${project}, I've picked the same as you ${alike} of the last ${of} times.`];
}

/**
 * The reveal of a blind question answered (16.17.7, 16.17.2): what the
 * person picked — a row's answer, or their own words — what Claude would
 * have picked, the same where they took its sealed answer, and how often
 * Claude has picked as they did on its kind in the project.
 * @param {{yours: import('../raise.cjs').Yours, lean: string, took: boolean, kind: string|null, project: string, alike: number, of: number}} reveal
 * @returns {string}
 */
function revealScreen({ yours, lean, took, kind, project, alike, of }) {
  const mine = took ? 'I\'d have picked the same.' : `I'd have picked: ${revealed(lean)}`;
  const lines = [
    ...wrapWithPrefix(`${yours.own ? 'You said' : 'You picked'}: ${revealed(yours.text)}`, { width: TREE_WIDTH }),
    ...wrapWithPrefix([mine, ...alikeSaid(kind, project, alike, of)].join(' '), { width: TREE_WIDTH }),
  ];
  return section('DISPLAY: blind question revealed', CONTINUE_INSTRUCTION, lines.join('\n'));
}

module.exports = { drawnRows, keepingRow, leanShown, raiseScreen, revealScreen };
