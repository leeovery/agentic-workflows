'use strict';

// The gate payload held against the MENU it states. A surface that draws the
// gate from the payload shows the person the payload and nothing else, so
// every line the MENU draws has to have its home there, the payload has to
// state nothing the MENU does not draw, and what it states is the text the
// person reads — never the markup that draws it.

const assert = require('node:assert');

const SURFACE_ENV = 'WORKFLOWS_GATE_SURFACE';
const GATE_MARKER = '=== GATE (json for a gate surface — never display) ===';
const MENU_RULE = '· · · · · · · · · · · ·';
const CONTINUATION = /^ +/;
const GLYPHED_LINE = /^\*\*`◆ (.*)`\*\*$/;
const MARKUP = /`([^`]*)`|\\([!-/:-@[-`{-~])|\*\*|~~|[`*]/g;

// The same markup one token at a time: a code span and an escape carry their
// text, a strike or an italic marker toggles its span, bold and a stray
// backtick drop, and everything else is text.
const LABEL_TOKEN = /`([^`]*)`|\\([!-/:-@[-`{-~])|\*\*|~~|[`*]|[^`\\*~]+|[\s\S]/g;

const TAIL_SEPARATOR = ' — ';
const NOTE_SEPARATOR = ' · ';
const RECOMMENDED_MARKER = ' (recommended)';

/** @typedef {{key: string, word: string|null, head: string, tail: string|null, cue: string|null, holder: string|null, detail: string|null, struck: boolean, recommended: boolean}} GateOption */
/** @typedef {{label: string, description: string, detail: string|null}} GateTyped */
/** @typedef {{gate: string, question: string, statement: string, options: GateOption[], typed: GateTyped[]}} GatePayload */
/** @typedef {{typed: boolean, name: string, label: string|null, detail: string|null}} DrawnRow */
/** @typedef {{ch: string, struck: boolean, italic: boolean}} Glyph */
/** @typedef {{text: string, struck: string, italic: string}} LabelReading */

/**
 * Run an in-process render with the gate surface announced, the environment
 * put back as it was.
 * @template T @param {() => T} render @returns {T}
 */
function announced(render) {
  const was = process.env[SURFACE_ENV];
  process.env[SURFACE_ENV] = '1';
  try {
    return render();
  } finally {
    if (was === undefined) delete process.env[SURFACE_ENV];
    else process.env[SURFACE_ENV] = was;
  }
}

/** Whitespace runs as one space — line breaks and wraps are layout the MENU cannot show. @param {string} text */
function squash(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** A payload value as the MENU can show it. @param {string|null} text */
function squashed(text) {
  return text === null ? null : squash(text);
}

/**
 * Menu text read plain, as the payload has to state it: a code span's
 * content and an escaped character stay as text, every other marker comes
 * off.
 * @param {string} text
 */
function plainText(text) {
  return squash(text.replace(MARKUP, (_, code, escaped) => code ?? escaped ?? ''));
}

// A MENU line read back as the row it draws: a code span is a key the user
// types (an en dash in it makes it a span, typed rather than pressed), bare
// bold before an arrow is a prompt row. A bare key row draws no label.
/** @param {string} line @returns {DrawnRow|null} */
function drawnRow(line) {
  const code = /^\*\*`([^`]+)`\*\*(?:\s*→ (.*)|$)/.exec(line);
  if (code) return { typed: code[1].includes('–'), name: code[1], label: code[2] ?? null, detail: null };
  const prompt = /^\*\*([^*`]+)\*\*\s+→ (.*)$/.exec(line);
  return prompt ? { typed: true, name: prompt[1], label: prompt[2], detail: null } : null;
}

/** @param {Glyph[]} glyphs @returns {Glyph[]} */
function squashGlyphs(glyphs) {
  /** @type {Glyph[]} */
  const out = [];
  for (const glyph of glyphs) {
    const space = /\s/.test(glyph.ch);
    if (space && (out.length === 0 || out[out.length - 1].ch === ' ')) continue;
    out.push(space ? { ...glyph, ch: ' ' } : glyph);
  }
  if (out.length > 0 && out[out.length - 1].ch === ' ') out.pop();
  return out;
}

/**
 * A drawn label read as the characters it shows, each marked with the spans
 * it sits in. Whitespace runs read as one space, so a span a wrap closed and
 * reopened reads whole.
 * @param {string|null} label @returns {Glyph[]}
 */
function drawnGlyphs(label) {
  /** @type {Glyph[]} */
  const glyphs = [];
  let struck = false;
  let italic = false;
  for (const [token, code, escaped] of (label ?? '').matchAll(LABEL_TOKEN)) {
    if (token === '~~') struck = !struck;
    else if (token === '*') italic = !italic;
    else if (token !== '**' && token !== '`') for (const ch of code ?? escaped ?? token) glyphs.push({ ch, struck, italic });
  }
  return squashGlyphs(glyphs);
}

/**
 * The characters a payload row's parts show, each marked where the option
 * grammar draws it (CONVENTIONS.md: Menus): the tail italic after a dash, the
 * cue plain after a dot, the strike over all of it when a holder stands
 * plain after the strike, the recommendation last. The parts are read as the
 * text they state, so a part still carrying markup or an escape shows
 * characters the drawn row does not. Emphasis inside the head is the head's
 * own text, so the head takes the drawn row's.
 * @param {GateOption} o @param {Glyph[]} drawn @returns {Glyph[]}
 */
function partsGlyphs(o, drawn) {
  const held = o.holder !== null;
  /** @param {string} text @param {boolean|null} italic @param {boolean} [struck] */
  const run = (text, italic, struck = held) => [...text].map((ch) => ({ ch, struck, italic }));
  const glyphs = run(o.head, null);
  if (o.tail !== null) glyphs.push(...run(TAIL_SEPARATOR, false), ...run(o.tail, true));
  if (o.cue !== null) glyphs.push(...run(NOTE_SEPARATOR, false), ...run(o.cue, false));
  if (held) glyphs.push(...run(`${NOTE_SEPARATOR}${o.holder}`, false, false));
  if (o.recommended) glyphs.push(...run(RECOMMENDED_MARKER, false, false));
  return squashGlyphs(glyphs).map((g, i) => ({ ...g, italic: g.italic ?? drawn[i]?.italic ?? false }));
}

/**
 * Glyphs as three aligned lines: the text, a mark under each struck
 * character, a mark under each italic one. A space carries no mark — a wrap
 * may leave it outside the span it sits in.
 * @param {Glyph[]} glyphs @returns {LabelReading}
 */
function reading(glyphs) {
  /** @param {(g: Glyph) => boolean} marked @param {string} mark */
  const mask = (marked, mark) => glyphs.map((g) => (g.ch !== ' ' && marked(g) ? mark : ' ')).join('').trimEnd();
  return { text: glyphs.map((g) => g.ch).join(''), struck: mask((g) => g.struck, '~'), italic: mask((g) => g.italic, '*') };
}

// A row is an option or a typed row, in order and with its whole label; a
// wrapped label's continuation belongs to the row above it, and so does any
// other line directly beneath it, as its detail; the line the menu asks on —
// its glyphed line — is the question; every other line is the statement, in
// order. Every value the payload states is held as it stands against the menu
// read plain.
/** @param {GatePayload} gate @param {string[]} body @param {string} label @returns {void} */
function assertPayloadDrawsMenu(gate, body, label) {
  /** @type {DrawnRow[]} */ const rows = [];
  /** @type {{text: string, glyphed: boolean}[]} */ const prose = [];
  /** @type {DrawnRow|null} */ let under = null;
  for (const line of body) {
    if (line === MENU_RULE || line.trim() === '') { under = null; continue; }
    if (CONTINUATION.test(line)) {
      assert.ok(under?.label, `[${label}] "${line}" is indented as a continuation but follows no row`);
      under.label = `${under.label} ${line.replace(CONTINUATION, '')}`;
      continue;
    }
    const glyphed = GLYPHED_LINE.exec(line);
    const row = glyphed ? null : drawnRow(line);
    if (row) {
      rows.push(row);
      under = row;
    } else if (under !== null && !glyphed) {
      under.detail = plainText(`${under.detail ?? ''} ${line}`);
    } else {
      prose.push({ text: plainText(glyphed?.[1] ?? line), glyphed: glyphed !== null });
    }
  }
  const askAt = prose.findIndex((p) => p.glyphed);
  assert.strictEqual(gate.question, askAt === -1 ? '' : prose[askAt].text,
    `[${label}] the payload's question is not the line the menu asks on`);
  assert.deepStrictEqual(gate.statement === '' ? [] : gate.statement.split('\n'), prose.filter((_, i) => i !== askAt).map((p) => p.text),
    `[${label}] the payload's statement is not every other line the menu draws`);

  const keys = rows.filter((r) => !r.typed);
  const typed = rows.filter((r) => r.typed);
  assert.deepStrictEqual(gate.options.map((o) => (o.word ? `${o.key}/${o.word}` : o.key)), keys.map((r) => r.name),
    `[${label}] the payload's keys are not the menu's`);
  const drawn = keys.map((r) => drawnGlyphs(r.label));
  assert.deepStrictEqual(
    gate.options.map((o, i) => [reading(partsGlyphs(o, drawn[i])), o.struck, squashed(o.detail)]),
    keys.map((r, i) => [reading(drawn[i]), drawn[i].some((g) => g.struck), r.detail]),
    `[${label}] the payload's option parts are not what the menu's rows draw — text, strike, italics, detail`);
  assert.deepStrictEqual(gate.typed.map((t) => [t.label, squash(t.description), squashed(t.detail)]),
    typed.map((r) => [plainText(r.name), plainText(r.label ?? ''), r.detail]),
    `[${label}] the payload's typed rows are not the menu's`);
}

/**
 * The GATE payload in an announced response, held against its MENU: it sits
 * directly above the first MENU and states the whole of it. Null when the
 * response carries no menu, which then carries no gate either, and when the
 * menu draws nothing, which leaves nothing to state.
 * @param {string} out  the response's stdout
 * @param {string} label  what the assertion messages name
 * @returns {GatePayload|null}
 */
function auditGate(out, label) {
  const lines = out.split('\n');
  const menuAt = lines.findIndex((l) => l.startsWith('=== MENU'));
  if (menuAt === -1) {
    assert.ok(!lines.includes(GATE_MARKER), `[${label}] a response with no menu carries no gate`);
    return null;
  }
  const end = lines.findIndex((l, i) => i > menuAt && l.startsWith('=== '));
  const body = lines.slice(menuAt + 1, end === -1 ? lines.length : end);
  if (lines[menuAt - 2] !== GATE_MARKER) {
    assert.ok(!lines.includes(GATE_MARKER), `[${label}] the payload does not sit directly above its menu`);
    assert.ok(body.every((l) => l === MENU_RULE || l.trim() === ''), `[${label}] a menu that draws rows or prose carries no payload`);
    return null;
  }
  const gate = JSON.parse(lines[menuAt - 1]);
  assertPayloadDrawsMenu(gate, body, label);
  return gate;
}

/**
 * A render-surface caller that audits as it renders: every render that draws
 * a menu is drawn again with the gate surface announced, and its payload held
 * against that menu.
 * @param {(dir: string, surface: string, args: object) => string} renderSurface
 * @returns {(dir: string, surface: string, args: object) => string}
 */
function auditingRender(renderSurface) {
  return (dir, surface, args) => {
    const out = renderSurface(dir, surface, args);
    if (out.includes('=== MENU')) auditGate(announced(() => renderSurface(dir, surface, args)), `render ${surface}`);
    return out;
  };
}

module.exports = { GATE_MARKER, announced, auditGate, auditingRender };
