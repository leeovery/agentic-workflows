'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared render-surface primitives — the single builder every engine-rendered
// menu, callout, and content frame flows through. The skill-visible formatting
// rules (CONVENTIONS.md: menu frames, option syntax, callout flags) exist in
// code exactly once, here; restyling a surface class is a one-place change.
// The one sibling: the worklist shape (CONVENTIONS.md: Worklists) lives in
// worklist.cjs — markdown-emitted, so none of the fenced primitives here
// serve it.
// Artefact content is framed by its emission fence, never by drawn borders
// (D8) — fences re-flow with the terminal; fixed-width borders cannot.
// ---------------------------------------------------------------------------

const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');

const DOTS = '· · · · · · · · · · · ·';

// The menu's label glyph. Squares are structure; a menu is a decision, so it
// takes the diamond — the one place the user must act.
const MENU_GLYPH = '◆';

// Option lines align their arrows into one column. The padding is measured
// against the widest key in the same block, never against the terminal, so
// the column itself is stable at any width — which is why prose may carry it
// by hand. The label after the arrow is the half that consults the terminal:
// a long label wraps at the display width with continuations aligned under
// the label column, so the key column and the label column never bleed into
// one another. Prose menus can't know the width, so theirs stay on one
// authored line and soft-wrap (CONVENTIONS.md: Menus).
const OPTION = /^(\*\*.+?\*\*) → (.*)$/;

// Continuation indents are non-breaking spaces — menus are markdown-emitted,
// four real leading spaces is a code block to a renderer, and lesser leading
// runs are stripped (the worklist rule). Do not "fix" them back to spaces.
const NBSP = '\u00a0';

// ` → ` renders three columns — the space each side of the arrow plus the
// arrow itself; the label column sits that far past the key column.
const ARROW_GAP = 3;

// Below this label budget wrapping stops paying for itself — only reachable
// when a pathologically wide key column meets the narrowest pane. The line
// stays whole and soft-wraps, exactly as an unwrapped menu always has.
const MIN_LABEL_BUDGET = 16;

// The column aligns as RENDERED, not as authored: `**` and backticks are
// markup the renderer consumes, and a cmdOption head carries two more markup
// characters than a promptOption head — measuring source length would land
// mixed blocks two columns apart on screen. Padding spaces sit outside the
// markup, so rendered pad equals source pad.
/** @param {string} head */
function renderedLen(head) {
  return head.replace(/\*\*/g, '').replace(/`/g, '').length;
}

// Wrapping a label needs its markup understood twice over: width is rendered
// width (markers are consumed by the renderer), and a break must never strand
// a span's closing marker on the next line — the MENU surface is markdown,
// so each emitted line has to stand alone. The scanner walks one word and
// carries the open-span state across it: a backtick opens a code span (inside
// one, only the closing backtick is markup), `**`/`~~`/`*` toggle emphasis
// spans tracked as a stack (a marker matching the innermost open span closes
// it; any other opens).

/** @typedef {{code: boolean, spans: string[]}} MarkupState */

/** @param {string[]} spans @param {string} marker */
function toggleSpan(spans, marker) {
  if (spans[spans.length - 1] === marker) spans.pop();
  else spans.push(marker);
}

/** @param {string} word @param {MarkupState} state @returns {{rendered: number, state: MarkupState}} */
function scanWord(word, state) {
  let code = state.code;
  const spans = state.spans.slice();
  let rendered = 0;
  for (let i = 0; i < word.length;) {
    if (code) {
      if (word[i] === '`') code = false; else rendered += 1;
      i += 1;
      continue;
    }
    if (word[i] === '`') { code = true; i += 1; continue; }
    const two = word.slice(i, i + 2);
    if (two === '**' || two === '~~') { toggleSpan(spans, two); i += 2; continue; }
    if (word[i] === '*') { toggleSpan(spans, '*'); i += 1; continue; }
    rendered += 1;
    i += 1;
  }
  return { rendered, state: { code, spans } };
}

// Innermost span closes first; the continuation reopens in original order.
/** @param {MarkupState} state */
function closeMarkers(state) {
  return (state.code ? '`' : '') + state.spans.slice().reverse().join('');
}

/** @param {MarkupState} state */
function openMarkers(state) {
  return state.spans.join('') + (state.code ? '`' : '');
}

/**
 * Greedy word-wrap an option label to `budget` rendered columns, each
 * segment self-contained markdown. A single word wider than the budget is
 * left whole to soft-wrap — hard-splitting could cut a marker in two.
 * @param {string} label @param {number} budget @returns {string[]}
 */
function wrapLabel(label, budget) {
  const words = String(label).trim().split(/\s+/).filter(Boolean);
  const segments = [];
  let line = '';
  let lineWidth = 0;
  let open = /** @type {MarkupState} */ ({ code: false, spans: [] });
  for (const word of words) {
    const next = scanWord(word, open);
    if (!line) {
      line = word;
    } else if (lineWidth + 1 + next.rendered <= budget) {
      line += ' ' + word;
      lineWidth += 1;
    } else {
      segments.push(line + closeMarkers(open));
      line = openMarkers(open) + word;
      lineWidth = 0;
    }
    lineWidth += next.rendered;
    open = next.state;
  }
  if (line) segments.push(line);
  return segments.length ? segments : [label];
}

/**
 * Pad option lines so their arrows share a rendered column, wrapping each
 * label at the display width with continuations aligned under the label
 * column. Non-option lines pass through untouched, so a block may mix
 * options with plain text. The first `skip` lines are head chrome and are
 * never scanned — a label carrying model-authored text may legitimately
 * contain an option-shaped `**…** → …` run without capturing the column.
 * @param {string[]} lines @param {{width?: number, skip?: number}} [opts] @returns {string[]}
 */
function alignOptions(lines, { width = displayWidth(), skip = 0 } = {}) {
  const widths = lines.map((l, i) => { if (i < skip) return -1; const m = OPTION.exec(l); return m ? renderedLen(m[1]) : -1; });
  const column = Math.max(-1, ...widths);
  if (column < 0) return lines.slice();
  const labelColumn = column + ARROW_GAP;
  const budget = width - labelColumn;
  /** @type {string[]} */
  const out = [];
  lines.forEach((l, i) => {
    if (widths[i] < 0) { out.push(l); return; }
    const m = /** @type {RegExpExecArray} */ (OPTION.exec(l));
    const segments = budget >= MIN_LABEL_BUDGET ? wrapLabel(m[2], budget) : [m[2]];
    out.push(`${m[1]}${' '.repeat(column - widths[i])} → ${segments[0]}`);
    for (const seg of segments.slice(1)) out.push(NBSP.repeat(labelColumn) + seg);
  });
  return out;
}

/**
 * One `=== NAME (instruction) ===` demarcated section.
 * @param {string} name @param {string} instruction @param {string} body
 * @returns {string}
 */
function section(name, instruction, body) {
  return `=== ${name} (${instruction}) ===\n${body.replace(/\n+$/, '')}\n`;
}

// The instructions for a DISPLAY that is the whole response: emitting it
// leaves the turn open, and the marker says so — a section whose response
// also carries a MENU needs none of this, because the menu's own
// instruction ends the turn. Two facts, never blurred:
// CONTINUE is for displays where no gate exists at all (the word "gate"
// never appears — naming one would imply something to skip); AUTO_GATE is
// for a real gate the user's a/auto choice bypasses, and says exactly
// that. Neither names a next step: where the flow goes is the prose's to
// own, and an engine string that duplicated it would be a second routing
// source to keep in sync. The markdown variant serves surfaces whose
// register cannot live in a fence — worklist strikethrough and code-span
// tags, the task brief's and result header's emphasis.
const CONTINUE_INSTRUCTION = 'emit verbatim as a code block — do not stop; continue as the workflow instructs';
const CONTINUE_MARKDOWN_INSTRUCTION = 'emit verbatim as markdown — do not stop; continue as the workflow instructs';
const AUTO_GATE_INSTRUCTION = 'emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs';

/**
 * The menu frame: an opening dot rule above the content. One-sided by
 * design — output stops while the user chooses, so their own input closes
 * the block more definitively than a drawn rule could. Projections with
 * bespoke option grouping build their lines and frame them here.
 *
 * A leading label (first line, blank line beneath it) takes the decision
 * glyph here rather than in `menu`, so a menu reads the same whether its
 * options were grouped by `menu` or composed by the projection itself.
 * `glyphLabel: false` suppresses that — a menu carrying an explicit question
 * line treats its leading statement as context, never a label.
 * `skip` exempts that many leading lines from the option scan: a caller
 * whose head chrome interpolates non-constant text must declare it, or an
 * option-shaped run in the text captures the arrow column.
 * @param {string[]} lines @param {{glyphLabel?: boolean, width?: number, skip?: number}} [opts] @returns {string}
 */
function menuFrame(lines, { glyphLabel = true, width, skip = 0 } = {}) {
  const body = alignOptions(lines, { width, skip });
  if (glyphLabel && body.length > 1 && body[1] === '' && isGlyphable(body[0])) {
    body[0] = `**\`${MENU_GLYPH} ${body[0]}\`**`;
  }
  return [DOTS, ...body].join('\n');
}

// A label earns the decision glyph only when it is a short plain phrase.
// Longer labels are context rather than a label — they carry their own
// emphasis, run to several lines, and would have to be nested inside a code
// span to take the glyph, which renders the markup literally. Those pass
// through as prose above the options, where they already read correctly.
const LABEL_MAX = 60;

/** @param {string} label */
function isGlyphable(label) {
  return Boolean(label) && label.length <= LABEL_MAX && !/[\n*`]/.test(label);
}

/**
 * Framed menu for the common shape: contextual label, blank line, options,
 * optional trailing prompt line separated by a blank line. A short plain
 * label carries the decision glyph; a longer one stays prose. An empty label
 * opens straight on the options — the label-less selection menu, for gates
 * whose context is carried by the display directly above them.
 * @param {string} label @param {string[]} options
 * @param {{prompt?: string, question?: string}} [opts]
 * @returns {string}
 */
function menu(label, options, { prompt, question } = {}) {
  const lines = label ? [label, ''] : [];
  // A yes/no gate whose label is a statement carries its ask separately: the
  // statement stays context, the short question takes the decision glyph.
  if (question) lines.push(`**\`${MENU_GLYPH} ${question}\`**`, '');
  // Everything above the options is head chrome — never scanned for the
  // arrow column, so a label quoting model text cannot shift the options.
  // The trailing prompt line IS scanned: it stays an engine-authored
  // constant by convention, and skip is a prefix count by shape.
  const skip = lines.length;
  lines.push(...options);
  if (prompt) lines.push('', prompt);
  return menuFrame(lines, { glyphLabel: !question, skip });
}

/**
 * Command option line — a discrete input the user types verbatim
 * (CONVENTIONS.md option grammar): key and word share one code span, the
 * arrow separates it from the label. The word is omitted for bare-key
 * options (numbered entries). Arrows are aligned by the enclosing frame.
 * @param {string} key @param {string | null | undefined} word @param {string} label
 * @returns {string}
 */
function cmdOption(key, word, label) {
  return `**\`${word ? `${key}/${word}` : key}\`** → ${label}`;
}

/**
 * Bare command option — key and word, no arrow and no label. The shape a
 * yes/no gate takes (CONVENTIONS.md: Yes/no prompt): the question above the
 * options already says what yes means, so a label would only repeat it.
 * Carries no arrow, so the enclosing frame passes it through unaligned.
 * @param {string} key @param {string} word
 * @returns {string}
 */
function bareOption(key, word) {
  return `**\`${key}/${word}\`**`;
}

/**
 * Prompt option line — the user responds naturally; the description directs
 * their response. Plain bold rather than a code span, because there is no
 * literal input to type.
 * @param {string} label @param {string} description
 * @returns {string}
 */
function promptOption(label, description) {
  return `**${label}** → ${description}`;
}

/**
 * Numbered-range option line — a span of selectable numbers, both bounds
 * inside one code span.
 * @param {number|string} first @param {number|string} last @param {string} label
 * @returns {string}
 */
function rangeOption(first, last, label) {
  return `**\`${first}–${last}\`** → ${label}`;
}

/**
 * `⚑` callout block: flag at 2-space indent, continuation lines aligned
 * beneath the text. A string wraps to `width` (flag gutter subtracted);
 * a pre-wrapped array renders as given.
 * @param {string | string[]} text
 * @param {{width?: number}} [opts]
 * @returns {string}
 */
function callout(text, { width = displayWidth() } = {}) {
  const segs = Array.isArray(text) ? text : wrap(text, width - 4);
  return segs.map((l, i) => (i === 0 ? `  ⚑ ${l}` : `    ${l}`)).join('\n');
}

/**
 * The indented explanation beneath a proposal's headline: each paragraph
 * wrapped at the display width, two columns in. A hand-picked column drifts
 * with the pane; a measured one cannot.
 * @param {string[]} paragraphs
 * @param {{width?: number}} [opts]
 * @returns {string[]}
 */
function indentedBody(paragraphs, { width = displayWidth() } = {}) {
  const budget = width - 2;
  return paragraphs.flatMap((p) => wrap(p, budget).map((line) => `  ${line}`));
}

/**
 * One `•` row at the callout indent, continuations aligned under the text.
 * @param {string} text
 * @param {{width?: number}} [opts]
 * @returns {string[]}
 */
function bulletRow(text, { width = displayWidth() } = {}) {
  return wrap(text, width - 4).map((s, i) => (i === 0 ? `  • ${s}` : `    ${s}`));
}

/**
 * Glyphed sub-detail (`· `) within a numbered item: quiet marker on the
 * first line, continuations aligned under the text — never column zero.
 * @param {string} text
 * @param {{indent?: string, width?: number}} [opts]
 * @returns {string}
 */
function subDetail(text, { indent = '   ', width = displayWidth() } = {}) {
  const segs = wrap(text, width - indent.length - 2);
  return segs.map((s, i) => (i === 0 ? `${indent}· ${s}` : `${indent}  ${s}`)).join('\n');
}

/**
 * Flat wrapped tree list (`├─`/`└─`): one item per branch, item text wrapped
 * with continuations aligned under the text column (gutter `│` while
 * siblings remain, blank under the last).
 * @param {string[]} items
 * @param {{indent?: string, width?: number}} [opts]
 * @returns {string}
 */
function treeList(items, { indent = '     ', width = displayWidth() } = {}) {
  const budget = width - indent.length - 3;
  const out = [];
  items.forEach((item, i) => {
    const isLast = i === items.length - 1;
    const segs = wrap(item, budget);
    out.push(`${indent}${isLast ? '└─' : '├─'} ${segs[0]}`);
    const cont = `${indent}${isLast ? '   ' : '│  '}`;
    for (const seg of segs.slice(1)) out.push(cont + seg);
  });
  return out.join('\n');
}

module.exports = { DOTS, MENU_GLYPH, section, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, AUTO_GATE_INSTRUCTION, menuFrame, alignOptions, menu, cmdOption, bareOption, promptOption, rangeOption, callout, indentedBody, bulletRow, subDetail, treeList };

