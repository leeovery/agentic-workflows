'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the worklist — the one shape for a transient list the session
// works through and throws away (proposed-task cycles, review findings, the
// surfacing batches, the triage agenda). Emitted as markdown, never fenced:
// the register needs strikethrough for decided rows and code-span state
// tags, and a flat list has no indentation for a fence to protect.
//
// Layout is engine-owned all the same: every line is wrapped here to
// displayWidth(), continuations aligned under the text column. Leading
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

const NBSP = '\u00a0';

// Walk-state vocabulary — the item-state glyph family (never chrome squares).
const WORKLIST_GLYPH = { pending: '○', approved: '✓', skipped: '⊘' };
const DECIDED = new Set(['approved', 'skipped']);

/** Backslash-escape markdown-active characters in plain prose. @param {string} text */
function escapeMarkdown(text) {
  return String(text).replace(/[\\`*_~[\]]/g, (c) => `\\${c}`);
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
  const width = displayWidth();
  const lines = [];

  const states = items.map((it) => {
    const state = it.state || 'pending';
    if (walked && !(state in WORKLIST_GLYPH)) {
      throw new Error(`worklist: unknown state "${state}" (expected ${Object.keys(WORKLIST_GLYPH).join('/')})`);
    }
    return state;
  });

  if (heading) {
    const n = items.length;
    let head = `**${escapeMarkdown(heading.label)}** — ${n} ${heading.noun}${n === 1 ? '' : 's'}`;
    const remaining = states.filter((s) => !DECIDED.has(s)).length;
    if (remaining < n) head += ` · ${remaining} remaining`;
    lines.push(head, '');
  } else {
    lines.push(intro || '', '');
  }

  const numWidth = String(items.length).length;
  items.forEach((it, i) => {
    const state = states[i];
    const struck = walked && DECIDED.has(state);
    const num = String(i + 1).padStart(numWidth);
    // `1\.` — the escaped dot keeps an unglyphed row from parsing as a
    // markdown ordered-list item; the backslash renders at zero width.
    const head = walked ? `${WORKLIST_GLYPH[state]} ${num}. ` : `${num}\\. `;
    const headWidth = walked ? 2 + numWidth + 2 : numWidth + 2;

    const segs = wrapEscaped(it.title, width - headWidth).map((s) => (struck ? `~~${s}~~` : s));
    if (it.tag) {
      if (it.tag.includes('`')) throw new Error('worklist: a tag must not contain backticks');
      segs[segs.length - 1] += ` \`[${it.tag}]\``;
    }
    lines.push(head + segs[0]);
    for (const seg of segs.slice(1)) lines.push(NBSP.repeat(headWidth) + seg);

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

module.exports = { worklist, escapeMarkdown, WORKLIST_GLYPH };
