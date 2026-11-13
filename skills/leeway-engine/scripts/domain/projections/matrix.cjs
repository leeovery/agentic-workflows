'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the matrix's screens (16.15.1, 16.15.3) — the matrix, as the
// menus' frame draws it (menus.cjs), and the replay of a proposed setting,
// from what `render matrix` and `render matrix-replay` read
// (trust-verbs.cjs).
//
// - The matrix: titled "Matrix · {Project}"; what the threshold does, at
//   the person's own, and what always asks; what the rate is, and overturned
//   and lost; whether anything is carried from the person's other projects,
//   and how much; then each kind's row, danger first and always asking —
//   overturned of answered, lost, the rate the rule runs on, and where it
//   stands: asking; quiet, and asking again over a quarter above the
//   threshold while its rate is between; quiet, where a question hard to
//   undo still asks; quiet; or asking under the person's care entry,
//   whatever its counts. Then Claude's one-answer calls, where they stand
//   and the line they ask over; the threshold mid-build, the person's pick
//   where it holds, else the threshold's own, saying so where the threshold
//   has risen past the pick; and how review findings split across their
//   lanes (17.1.3). A rate is shown to as few places as tell it from every
//   line the threshold draws (ask-rule.cjs). Its rows: `t/threshold` and `u/build`, each
//   carrying on for the person to name a number, whose replay comes first;
//   `c/care` to the care entries; and `b/back` to manage. The frame adds
//   `h/help`. No row edits a kind (16.15.4): a kind or a verdict is
//   corrected in words.
// - The replay: titled "Matrix · {Project} · Replay"; the setting proposed
//   in place of the person's, and what it would have changed over the
//   period replayed (replay.cjs) — above theirs, the questions it would
//   have skipped and those the person would have overruled; below it, the
//   questions it would have asked of Claude's calls, and those the person
//   overruled — the period's start the person's own day; or, with nothing
//   to replay, that there is nothing; for the threshold, where the period
//   holds a showing of a learned gate, what it would have changed there —
//   above theirs, the showings it would have gone on past and those the
//   person picked otherwise at; below it, the steps it would have stopped
//   at; the lines it moves with it; then whether to use it — `y/yes` to
//   `trust threshold` or `trust build-threshold`, `n/no` back to the
//   matrix, keeping theirs, and Comment carrying on for another number.
// ---------------------------------------------------------------------------

const { wrap, wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { titleSection, section, menu, cmdOption, promptOption, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { percent, against } = require('../ask-rule.cjs');
const { HARD_TO_UNDO, ASK_AGAIN, PRIOR_CAP, buildRaised, midBuild } = require('../trust-settings.cjs');
const { LANES } = require('../measures.cjs');
const { localDay } = require('../dates.cjs');

/** @typedef {import('../event-fields.cjs').Kind} Kind */
/** @typedef {import('../trust-counts.cjs').KindTally} KindTally */
/** @typedef {import('../trust-counts.cjs').OneTally} OneTally */
/** @typedef {import('../trust-settings.cjs').Settings} Settings */
/** @typedef {import('../replay.cjs').Replayed} Replayed */
/** @typedef {import('../measures.cjs').Lane} Lane */
/** @typedef {import('../menus.cjs').MenuScreen} MenuScreen */
/** @typedef {import('./surfaces.cjs').Next} Next */

/**
 * A kind's row as the matrix reads it: its tally, its rate, whether it asks
 * at the person's threshold and at half of it, and whether a care entry here
 * names it.
 * @typedef {{kind: Kind, tally: KindTally, bound: number, asks: boolean, hardAsks: boolean, cared: boolean}} KindRow
 */
/**
 * What the matrix shows: the project's name; the person's settings; the
 * weight carried in from their other projects; each kind's row, danger's
 * first; the one-answer calls, their rate and whether they ask; and how
 * review findings split.
 * @typedef {{project: string, settings: Settings, carried: number, kinds: KindRow[], one: OneRow, split: Record<Lane, number>}} MatrixView
 */
/**
 * Claude's one-answer calls as the matrix reads them: their tally, their
 * rate, whether they ask, the rate they ask over while quiet, and the
 * weight of the overrules the rate holds.
 * @typedef {{tally: OneTally, bound: number, asks: boolean, opens: number, losses: number}} OneRow
 */
/** Which setting a replay proposes. @typedef {'threshold'|'build'} Setting */
/**
 * What the replay shows: the project's name; the setting proposed, its
 * value and the person's now; and what the replay found.
 * @typedef {{project: string, setting: Setting, proposed: number, settings: Settings, replayed: Replayed}} ReplayView
 */

/** What each lane holds, as the matrix says it (16.2.2). @type {Readonly<Record<Lane, string>>} */
const LANE_SAYS = Object.freeze({
  apply: 'the record or a fact settles it',
  decide: 'Claude\'s call',
  walked: 'asked you',
  route: 'belongs to another topic',
});

const DASH = '—';
const GAP = '  ';
const CARRY_ON = /** @type {Next} */ (Object.freeze({ kind: 'continue' }));
const THE_MATRIX = /** @type {Next} */ (Object.freeze({ kind: 'engine', argv: ['render', 'matrix'] }));

/** A setting's lines: the threshold, where a quiet kind asks again, and half of each where a change would be hard to undo. @param {number} threshold */
const linesOf = (threshold) => ({ at: threshold, again: threshold * ASK_AGAIN, hard: threshold * HARD_TO_UNDO, hardAgain: threshold * HARD_TO_UNDO * ASK_AGAIN });

/**
 * A rate shown to as few places as tell it from each of `lines`.
 * @param {number} bound @param {number[]} lines
 */
function rateAgainst(bound, lines) {
  return lines.map((line) => against(bound, line)).reduce((a, b) => (b.length > a.length ? b : a));
}

/** A weight of answers, to two places at most. @param {number} weight */
const weighed = (weight) => String(Number(weight.toFixed(2)));

/**
 * Where a kind stands (the header's).
 * @param {KindRow} row @param {number} threshold
 */
function standing({ kind, bound, asks, hardAsks, cared }, threshold) {
  if (kind === 'danger') return 'always asks';
  if (cared) return 'asks · your care entry';
  if (asks) return 'asks';
  if (bound > threshold) return `quiet · asks over ${percent(threshold * ASK_AGAIN)}`;
  return hardAsks ? 'quiet · hard to undo asks' : 'quiet';
}

/**
 * Rows of cells in columns, each as wide as its widest cell — the first
 * left-aligned, the rest right — `gaps[i]` spaces before the column after
 * the i-th; a row's cells past them, its words, follow as they are.
 * @param {string[][]} rows @param {number[]} gaps
 */
function columns(rows, gaps) {
  const count = gaps.length + 1;
  const widths = Array.from({ length: count }, (_, i) => Math.max(...rows.map((cells) => cells[i].length)));
  return rows.map((cells) => {
    const aligned = cells.slice(0, count).map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : ' '.repeat(gaps[i - 1]) + cell.padStart(widths[i]))).join('');
    return GAP + [aligned, ...cells.slice(count)].join(GAP).trimEnd();
  });
}

/** What the threshold does, at the person's own. @param {number} threshold */
function thresholdSays(threshold) {
  const { again, hard, hardAgain } = linesOf(threshold);
  return `Your threshold is ${percent(threshold)}. A kind asks you until its rate falls under it, then goes quiet, and asks again only once its rate rises over ${percent(again)}. Where a change would be hard to undo, half: quiet under ${percent(hard)}, asking again over ${percent(hardAgain)}. Danger, a kind under your care entry, and replacing an answer you gave always ask.`;
}

const RATE_SAYS = 'Rate is the pessimistic bound: the high end of a 95% range on how often my answer would have cost the product, so a kind with few answers reads high.';
const COUNTS_SAY = 'Overturned counts the answers where you changed or overruled my lean; lost, those that cost or would have cost the product, one you haven\'t judged yet counting as lost.';

/** Whether anything is carried from the person's other projects, and how much. @param {string} project @param {number} carried */
function carriedSays(project, carried) {
  if (carried === 0) return `Nothing is carried from your other projects yet: every count here is ${project}'s own.`;
  return `Carried from your other projects: ${weighed(carried)} answers' weight, at most ${PRIOR_CAP} for each kind and for my one-answer calls. Each rate here starts from them and moves with ${project}'s own answers; the counts below are ${project}'s alone.`;
}

/** A rate shown to as few places as tell it from every line the threshold draws. @param {number} bound @param {number} threshold */
const rateAt = (bound, threshold) => rateAgainst(bound, Object.values(linesOf(threshold)));

/** The table of kinds. @param {MatrixView} view */
function kindsTable({ settings: { threshold }, kinds }) {
  return columns([
    ['kind', 'overturned', 'lost', 'rate'],
    ...kinds.map((row) => (row.kind === 'danger'
      ? [row.kind, DASH, DASH, DASH, standing(row, threshold)]
      : [row.kind, `${row.tally.overturned} of ${row.tally.answered}`, String(row.tally.lost), rateAt(row.bound, threshold), standing(row, threshold)])),
  ], [1, 2, 2]);
}

/**
 * Where Claude's one-answer calls stand: asking until the rate falls under
 * the threshold; or going ahead until it rises over the line they ask
 * over — the threshold itself until they first ask, a quarter above it
 * after they went quiet — and only once their overrules weigh one whole
 * overrule.
 * @param {number} threshold @param {OneRow} one
 */
function oneGoing(threshold, { asks, opens, losses }) {
  if (asks) return `Overrules have lifted the rate over your ${percent(threshold)}, so they ask you until it falls under it.`;
  const going = opens > threshold
    ? `They went quiet once the rate fell under your ${percent(threshold)}, and go ahead as mine until it rises over ${percent(opens)}`
    : `They go ahead as mine, and ask you once overrules lift the rate over your ${percent(threshold)}`;
  return losses > 0 && losses < 1 ? `${going}. They ask only once overrules weigh one whole overrule; these weigh ${weighed(losses)}.` : `${going}.`;
}

/** Claude's one-answer calls, and where they stand. @param {MatrixView} view */
function oneSays({ settings: { threshold }, one }) {
  return `${one.tally.calls} calls · ${one.tally.overruled} overruled · rate ${rateAt(one.bound, threshold)}. ${oneGoing(threshold, one)}`;
}

/** The threshold mid-build, where a question blocks work: the higher of the person's pick and the threshold. @param {Settings} settings */
function midBuildSays(settings) {
  const { threshold, build_threshold: build } = settings;
  if (build === null) return `${percent(threshold)}, the same as elsewhere, until a build's own answers show how much to raise it.`;
  if (build < threshold) return `${percent(threshold)}, the same as elsewhere: your ${percent(build)} pick sits below it.`;
  if (build === threshold) return `${percent(build)}, your pick, the same as elsewhere.`;
  return `${percent(build)}, your pick, where elsewhere it is ${percent(threshold)}.`;
}

/** How review findings split, a line a lane. @param {MatrixView} view */
function splitLines({ project, split }) {
  const total = LANES.reduce((sum, lane) => sum + split[lane], 0);
  const heading = `HOW REVIEW FINDINGS SPLIT (${total} across ${project}'s reviews)`;
  if (total === 0) return [heading, `${GAP}None settled yet.`];
  const counted = (/** @type {number} */ n) => String(n).padStart(String(total).length);
  return [heading, ...columns(LANES.map((lane) => [lane, counted(split[lane]), `${Math.round((split[lane] * 100) / total)}%`, LANE_SAYS[lane]]), [2, 2])];
}

/** An indented paragraph, wrapped to the pane. @param {string} text */
const indented = (text) => wrapWithPrefix(text, { width: displayWidth(), prefix: GAP });

/**
 * The matrix's screen, for the frame to draw (the header's).
 * @param {MatrixView} view
 * @returns {MenuScreen}
 */
function matrixScreen(view) {
  const width = displayWidth();
  const { project, settings } = view;
  return {
    title: `Matrix · ${project}`,
    shows: [
      ...[thresholdSays(settings.threshold), RATE_SAYS, COUNTS_SAY, carriedSays(project, view.carried)].flatMap((paragraph) => [...wrap(paragraph, width), '']),
      'OVERTURNED, AND WHAT IT COST, BY KIND',
      ...kindsTable(view),
      '',
      'CLAUDE\'S ONE-ANSWER CALLS',
      ...indented(oneSays(view)),
      '',
      'MID-BUILD, WHERE A QUESTION BLOCKS WORK',
      ...indented(midBuildSays(settings)),
      '',
      ...splitLines(view),
    ],
    rows: [
      { key: 't', word: 'threshold', label: 'Change your threshold — a replay first shows what it would have changed', next: CARRY_ON },
      { key: 'u', word: 'build', label: 'Raise the threshold mid-build — a replay first shows what it would have changed', next: CARRY_ON },
      { key: 'c', word: 'care', label: `Add or drop a care entry — a kind that always asks you in ${project}`, next: { kind: 'engine', argv: ['render', 'care'] } },
    ],
    back: { label: 'Back to manage', next: { kind: 'engine', argv: ['render', 'manage'] } },
  };
}

/** A percent as a command takes it: its number, to as many places as it holds. @param {number} rate */
const percentArg = (rate) => percent(rate).slice(0, -1);

/** The setting a replay proposes, as its screen names it, and the person's now. @param {ReplayView} view */
function settingOf({ setting, proposed, settings }) {
  const { threshold } = settings;
  if (setting === 'threshold') return { named: percent(proposed), current: threshold, heading: `${percent(proposed)} IN PLACE OF YOUR ${percent(threshold)}` };
  const current = midBuild(settings);
  return { named: `${percent(proposed)} mid-build`, current, heading: `${percent(proposed)} MID-BUILD IN PLACE OF ${buildRaised(settings) ? 'YOUR' : 'THE'} ${percent(current)}` };
}

/** When the period replayed starts, as its line opens: the person's own day. @param {Replayed} replayed */
function periodSays({ since, whole }) {
  return whole ? `Since ${localDay(/** @type {number} */ (since))},` : 'Last month';
}

/** `n` of `word`, a plural past one. @param {number} n @param {string} word */
const counted = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

/** No question to replay, said for the replay `view` shows: nothing to show, where no showing of a gate is replayed either. @param {ReplayView} view */
function nothingSays({ project, setting, replayed: { more, gates } }) {
  const build = setting === 'build';
  const none = more ? `No call of mine has gone ahead${build ? ' in the build' : ''} in ${project} yet`
    : build ? `No question has blocked build work in ${project} yet` : `You haven't answered a question in ${project} yet`;
  return gates.showings === 0 ? `${none}, so a replay${build ? ' mid-build' : ''} has nothing to show.` : `${none}.`;
}

/** What the replay found, in a sentence: skipped where it asks less, asked where it asks more. @param {ReplayView} view */
function foundSays(view) {
  const { replayed } = view;
  const { questions, changed, overruled, more } = replayed;
  if (questions === 0) return nothingSays(view);
  const opens = `${periodSays(replayed)} ${settingOf(view).named} would have`;
  const build = view.setting === 'build';
  const among = overruled === 0 ? 'none' : String(overruled);
  if (more) {
    if (changed === 0) return `${opens} asked you none of the ${counted(questions, 'call')} that went ahead as mine${build ? ' in the build' : ''}.`;
    return `${opens} asked you ${changed} more ${changed === 1 ? 'question' : 'questions'}${build ? ' in the build' : ''}; you overruled ${among} of those calls.`;
  }
  const blocking = build ? ' that blocked build work' : '';
  if (changed === 0) return `${opens} skipped none of the ${counted(questions, 'question')}${blocking} you answered.`;
  return `${opens} skipped ${counted(changed, 'question')}${blocking}; you'd have overruled ${among} of them.`;
}

/**
 * What the replay found at the learned gates, where it replayed a showing,
 * in a sentence: those it goes on past where it asks less, those it stops at
 * where it asks more; else null. It opens with the period where no question
 * was replayed to open it.
 * @param {ReplayView} view
 */
function gatesSays(view) {
  const { replayed } = view;
  const { questions, more, gates: { showings, changed, overruled } } = replayed;
  if (showings === 0) return null;
  const where = 'at the gates that learn from your answers';
  const at = questions === 0 ? `${periodSays(replayed)}${replayed.whole ? '' : ','} ${where}, ${settingOf(view).named} would have` : `${where[0].toUpperCase()}${where.slice(1)}, it would have`;
  const of = `${changed === 0 ? 'none' : changed} of the ${counted(showings, 'stop')}`;
  if (more) return `${at} stopped at ${of} I went on past.`;
  return `${at} gone on past ${of} you answered${changed === 0 ? '' : `; you'd have picked otherwise at ${overruled === 0 ? 'none' : overruled} of them`}.`;
}

/** The lines the proposed setting moves. @param {ReplayView} view */
function movesSays({ setting, proposed }) {
  const { hard, again } = linesOf(proposed);
  const where = setting === 'build' ? ' mid-build' : '';
  return `At ${percent(proposed)}${where}, the line where a change would be hard to undo moves to ${percent(hard)}, and a quiet kind asks again over ${percent(again)}.`;
}

/**
 * The replay's screen (the header's), drawn whole: its title, what it
 * found, and its menu under the gate `matrix replay`.
 * @param {ReplayView} view
 * @returns {string}
 */
function replayScreen(view) {
  const { setting, proposed } = view;
  const { heading, current } = settingOf(view);
  const yes = setting === 'threshold' ? ['trust', 'threshold', percentArg(proposed)] : ['trust', 'build-threshold', percentArg(proposed)];
  const question = setting === 'threshold' ? `Use ${percent(proposed)} as your threshold?` : `Use ${percent(proposed)} as your threshold mid-build?`;
  return titleSection(`Matrix · ${view.project} · Replay`)
    + section('DISPLAY: matrix replay', emitAs('text'), [heading, ...[foundSays(view), gatesSays(view)].flatMap((says) => (says === null ? [] : indented(says)))].join('\n'))
    + section('MENU: matrix replay', MENU_INSTRUCTION, menu(wrap(movesSays(view), displayWidth()).join('\n'), [
      cmdOption('y', 'yes', `Use ${percent(proposed)} from now on`, { next: { kind: 'engine', argv: yes } }),
      cmdOption('n', 'no', `Keep ${percent(current)}`, { next: THE_MATRIX }),
      promptOption('Comment', 'Try another number', { next: CARRY_ON }),
    ], { question }));
}

module.exports = { matrixScreen, replayScreen, percentArg };
