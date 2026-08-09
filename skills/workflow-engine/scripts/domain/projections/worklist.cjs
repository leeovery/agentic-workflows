'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the worklist — the one shape for a transient list the session
// works through and throws away (the analysis and review synthesis cycles,
// review-findings overviews, the surfacing batches, the triage agenda).
// Emitted as markdown, never fenced:
// the register needs strikethrough for decided rows and code-span state
// tags, and a flat list has no indentation for a fence to protect.
//
// Layout is engine-owned all the same: rows and notes are wrapped here to
// displayWidth(), continuations aligned under the text column; the header
// and a batch intro are prose lines left to soft-wrap in the display. Leading
// indents are non-breaking spaces — four leading real spaces is a code
// block to a markdown renderer, and a soft-wrapped line would restart at
// column zero. Do not "fix" them back to spaces.
//
// Row text is markdown-escaped; a title may legitimately contain `*` or
// `~`. Strikethrough marks a decided row — struck means done here, while
// the epic menu's struck option means held by another live session; the
// two never share a surface.
// ---------------------------------------------------------------------------

const { wrap } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { WORKLIST_GLYPH } = require('../conventions.cjs');

const NBSP = '\u00a0';

const DECIDED = new Set(['approved', 'skipped']);

// Angle brackets are escaped alongside the markdown set: a renderer that
// passes raw HTML through would swallow an unescaped `<!-- -->` whole.
/** Backslash-escape markdown-active characters in plain prose. @param {string} text */
function escapeMarkdown(text) {
  return String(text).replace(/[\\`*_~[\]<>]/g, (c) => `\\${c}`);
}

/**
 * Wrap raw text to the given budget, then escape each segment — escaping
 * first would make the budget count backslashes that render at zero width.
 * @param {string} text @param {number} budget @returns {string[]}
 */
function wrapEscaped(text, budget) {
  return wrap(text, budget).map(escapeMarkdown);
}

/**
 * One worklist body. Exactly one of `heading`/`intro` opens it.
 * @param {{
 *   heading?: {label: string, noun: string},
 *   intro?: string,
 *   items: Array<{title: string, tag?: string, state?: string, note?: string}>,
 *   walked?: boolean,
 *   walkLine?: boolean,
 * }} spec
 * @returns {string}
 */
function worklist({ heading, intro, items, walked = false, walkLine = false }) {
  if (!heading === !intro) {
    throw new Error('worklist: exactly one of "heading"/"intro" must open the list');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('worklist: "items" must be a non-empty array');
  }
  const width = displayWidth();
  const lines = [];

  // States are validated wherever they appear — a wrong value on an
  // unwalked list is a caller bug, not a value to count silently.
  const states = items.map((it, i) => {
    if (typeof it.title !== 'string' || !it.title) {
      throw new Error(`worklist: item ${i + 1} needs a non-empty string "title"`);
    }
    const state = it.state || 'pending';
    if (!(state in WORKLIST_GLYPH)) {
      throw new Error(`worklist: unknown state "${state}" (expected ${Object.keys(WORKLIST_GLYPH).join('/')})`);
    }
    return state;
  });

  if (heading) {
    const n = items.length;
    let head = `**${escapeMarkdown(heading.label)}** — ${n} ${heading.noun}${n === 1 ? '' : 's'}`;
    // Only a walked list owns walk-state; an unwalked heading never counts.
    const remaining = states.filter((s) => !DECIDED.has(s)).length;
    if (walked && remaining < n) head += ` · ${remaining} remaining`;
    lines.push(head, '');
  } else {
    lines.push(intro || '', '');
  }

  const numWidth = String(items.length).length;
  items.forEach((it, i) => {
    const state = states[i];
    const struck = walked && DECIDED.has(state);
    // Number padding is NBSP on both row forms — it leads an unglyphed row
    // (a real leading space is stripped by a markdown renderer and the
    // column dies) and sits interior on a glyphed one, where NBSP renders
    // identically to a space and cannot be collapsed.
    const num = String(i + 1).padStart(numWidth, NBSP);
    // `1\.` — the escaped dot keeps an unglyphed row from parsing as a
    // markdown ordered-list item; the backslash renders at zero width.
    const head = walked ? `${WORKLIST_GLYPH[state]} ${num}. ` : `${num}\\. `;
    const headWidth = walked ? 2 + numWidth + 2 : numWidth + 2;
    const budget = width - headWidth;

    // Wrap raw, then escape — budgets count rendered columns, and escapes
    // render at zero width. The tag joins the last segment only when its
    // rendered width (brackets and a space; backticks are zero) still fits
    // the budget; otherwise it takes its own line at the title column.
    const rawSegs = wrap(it.title, budget);
    const segs = rawSegs.map(escapeMarkdown).map((s) => (struck ? `~~${s}~~` : s));
    let tagLine = null;
    if (it.tag) {
      if (it.tag.includes('`')) throw new Error('worklist: a tag must not contain backticks');
      if (headWidth + it.tag.length + 2 > width) {
        throw new Error(`worklist: tag "[${it.tag}]" cannot fit the display width — tags are one short term`);
      }
      if (rawSegs[rawSegs.length - 1].length + it.tag.length + 3 <= budget) {
        segs[segs.length - 1] += ` \`[${it.tag}]\``;
      } else {
        tagLine = NBSP.repeat(headWidth) + `\`[${it.tag}]\``;
      }
    }
    lines.push(head + segs[0]);
    for (const seg of segs.slice(1)) lines.push(NBSP.repeat(headWidth) + seg);
    if (tagLine) lines.push(tagLine);

    // A decided row sheds its note — the list collapses toward what's left.
    if (it.note && !struck) {
      const noteIndent = headWidth + 2;
      const noteSegs = wrapEscaped(it.note, width - noteIndent - 2);
      lines.push(NBSP.repeat(noteIndent) + `↳ ${noteSegs[0]}`);
      for (const seg of noteSegs.slice(1)) lines.push(NBSP.repeat(noteIndent + 2) + seg);
    }
  });

  if (walkLine) lines.push('', "Let's work through these one at a time.");
  return lines.join('\n');
}

module.exports = { worklist };
