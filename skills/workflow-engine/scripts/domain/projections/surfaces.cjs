'use strict';

// Shared render-surface primitives — the single builder every engine-rendered
// menu, callout, and content frame flows through. The skill-visible formatting
// rules (CONVENTIONS.md: dot frames, option syntax, callout flags, boxed
// frames) exist in code exactly once, here; restyling a surface class is a
// one-place change.

const { wrap } = require('../../kernel/render.cjs');

const DOTS = '· · · · · · · · · · · ·';

/**
 * One `=== NAME (instruction) ===` demarcated section.
 * @param {string} name @param {string} instruction @param {string} body
 * @returns {string}
 */
function section(name, instruction, body) {
  return `=== ${name} (${instruction}) ===\n${body.replace(/\n+$/, '')}\n`;
}

/**
 * The menu frame: content lines between the canonical dot rules. Projections
 * with bespoke option grouping build their lines and frame them here.
 * @param {string[]} lines @returns {string}
 */
function dotFrame(lines) {
  return [DOTS, ...lines, DOTS].join('\n');
}

/**
 * Dot-framed menu for the common shape: contextual label, blank line,
 * options, optional trailing prompt line separated by a blank line.
 * @param {string} label @param {string[]} options
 * @param {{prompt?: string}} [opts]
 * @returns {string}
 */
function menu(label, options, { prompt } = {}) {
  const lines = [label, '', ...options];
  if (prompt) lines.push('', prompt);
  return dotFrame(lines);
}

/**
 * Command option line — a discrete input the user types verbatim
 * (CONVENTIONS.md option grammar): `- **`k`/`word`** — label`, word omitted
 * for bare-key options (numbered entries).
 * @param {string} key @param {string | null | undefined} word @param {string} label
 * @returns {string}
 */
function cmdOption(key, word, label) {
  return word ? `- **\`${key}\`/\`${word}\`** — ${label}` : `- **\`${key}\`** — ${label}`;
}

/**
 * Prompt option line — the user responds naturally; the description directs
 * the user's response: `- **Label** — description`.
 * @param {string} label @param {string} description
 * @returns {string}
 */
function promptOption(label, description) {
  return `- **${label}** — ${description}`;
}

/**
 * `⚑` callout block: flag at 2-space indent, continuation lines aligned
 * beneath the text. A string wraps to `width` (flag gutter subtracted);
 * a pre-wrapped array renders as given.
 * @param {string | string[]} text
 * @param {{width?: number}} [opts]
 * @returns {string}
 */
function callout(text, { width = 72 } = {}) {
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
function subDetail(text, { indent = '   ', width = 72 } = {}) {
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
function treeList(items, { indent = '     ', width = 72 } = {}) {
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
 * Boxed content frame (`╭─ Title ──…──╮` / `╰──…──╯`): top and bottom rules
 * whose width is computed from the actual content, so the border always
 * reaches the frame's widest line — never a fixed-length rule stopping short.
 * Content lines render as-is between the rules (no side walls).
 * @param {string} title
 * @param {string[]} contentLines pre-wrapped content
 * @param {{minWidth?: number}} [opts]
 * @returns {string}
 */
function boxedFrame(title, contentLines, { minWidth = 53 } = {}) {
  const head = `╭─ ${title} `;
  const contentMax = contentLines.reduce((m, l) => Math.max(m, [...l].length), 0);
  const width = Math.max(minWidth, [...head].length + 1, contentMax);
  const top = head + '─'.repeat(Math.max(1, width - [...head].length - 1)) + '╮';
  const bottom = '╰' + '─'.repeat(width - 2) + '╯';
  return [top, ...contentLines, bottom].join('\n');
}

module.exports = { DOTS, section, dotFrame, menu, cmdOption, promptOption, callout, subDetail, treeList, boxedFrame };
