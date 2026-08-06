'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared render-surface primitives — the single builder every engine-rendered
// menu, callout, and content frame flows through. The skill-visible formatting
// rules (CONVENTIONS.md: menu frames, option syntax, callout flags) exist in
// code exactly once, here; restyling a surface class is a one-place change.
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
// against the widest key in the same block, never against the terminal, so it
// is stable at any width — which is why prose may carry it by hand while
// terminal-width chrome may not.
const OPTION = /^(\*\*.+?\*\*) → (.*)$/;

// The column aligns as RENDERED, not as authored: `**` and backticks are
// markup the renderer consumes, and a cmdOption head carries two more markup
// characters than a promptOption head — measuring source length would land
// mixed blocks two columns apart on screen. Padding spaces sit outside the
// markup, so rendered pad equals source pad.
/** @param {string} head */
function renderedLen(head) {
  return head.replace(/\*\*/g, '').replace(/`/g, '').length;
}

/**
 * Pad option lines so their arrows share a rendered column. Non-option lines
 * pass through untouched, so a block may mix options with plain text.
 * @param {string[]} lines @returns {string[]}
 */
function alignOptions(lines) {
  const widths = lines.map((l) => { const m = OPTION.exec(l); return m ? renderedLen(m[1]) : -1; });
  const column = Math.max(-1, ...widths);
  if (column < 0) return lines.slice();
  return lines.map((l, i) => {
    if (widths[i] < 0) return l;
    const m = /** @type {RegExpExecArray} */ (OPTION.exec(l));
    return `${m[1]}${' '.repeat(column - widths[i])} → ${m[2]}`;
  });
}

/**
 * One `=== NAME (instruction) ===` demarcated section.
 * @param {string} name @param {string} instruction @param {string} body
 * @returns {string}
 */
function section(name, instruction, body) {
  return `=== ${name} (${instruction}) ===\n${body.replace(/\n+$/, '')}\n`;
}

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
 * @param {string[]} lines @param {{glyphLabel?: boolean}} [opts] @returns {string}
 */
function menuFrame(lines, { glyphLabel = true } = {}) {
  const body = alignOptions(lines);
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
  lines.push(...options);
  if (prompt) lines.push('', prompt);
  return menuFrame(lines, { glyphLabel: !question });
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

/**
 * Numbered tree list (`├─ N. text`): selection rows whose text is a sentence
 * rather than a name, so it wraps — under itself, past the number, never back
 * under the glyph. `note` renders as a `↳` line beneath the row, the demoted
 * register a fence can carry (markdown emphasis renders literally inside one,
 * so provenance and status take `↳` here and italics only in menus).
 * @param {{text: string, note?: string}[]} items
 * @param {{indent?: string, width?: number}} [opts]
 * @returns {string}
 */
function numberedTreeList(items, { indent = '  ', width = displayWidth() } = {}) {
  const out = [];
  items.forEach((item, i) => {
    const isLast = i === items.length - 1;
    const head = `${indent}${isLast ? '└─' : '├─'} ${i + 1}. `;
    // The gutter sits at the indent column; the rest pads out to the text
    // column, so a wrapped sentence and its note both hang under the title.
    const cont = `${indent}${isLast ? ' ' : '│'}${' '.repeat(head.length - indent.length - 1)}`;
    const segs = wrap(item.text, width - head.length);
    out.push(head + segs[0]);
    for (const seg of segs.slice(1)) out.push(cont + seg);
    if (item.note) {
      for (const seg of wrap(`↳ ${item.note}`, width - cont.length)) out.push(cont + seg);
    }
  });
  return out.join('\n');
}

module.exports = { DOTS, MENU_GLYPH, section, menuFrame, alignOptions, menu, cmdOption, promptOption, rangeOption, callout, subDetail, treeList, numberedTreeList };
