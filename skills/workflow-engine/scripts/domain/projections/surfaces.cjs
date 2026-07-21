'use strict';

// Shared render-surface primitives — the single builder every engine-rendered
// menu, callout, and content frame flows through. The skill-visible formatting
// rules (CONVENTIONS.md: dot frames, option syntax, callout flags, boxed
// frames) exist in code exactly once, here; restyling a surface class is a
// one-place change.

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
 * Dot-framed menu: contextual label, blank line, options, optional trailing
 * prompt line (`Select an option:`) separated by a blank line.
 * @param {string} label @param {string[]} options
 * @param {{prompt?: string}} [opts]
 * @returns {string}
 */
function menu(label, options, { prompt } = {}) {
  const lines = [DOTS, label, '', ...options];
  if (prompt) lines.push('', prompt);
  lines.push(DOTS);
  return lines.join('\n');
}

/**
 * `⚑` callout block: flag at 2-space indent, continuation lines aligned
 * beneath the text (4-space).
 * @param {string[]} lines pre-wrapped text lines
 * @returns {string}
 */
function callout(lines) {
  return lines.map((l, i) => (i === 0 ? `  ⚑ ${l}` : `    ${l}`)).join('\n');
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

module.exports = { DOTS, section, menu, callout, boxedFrame };
