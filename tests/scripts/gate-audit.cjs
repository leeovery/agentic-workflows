'use strict';

// The gate payload held against the MENU it states. A surface that draws the
// gate from the payload shows the person the payload and nothing else, so
// every line the MENU draws has to have its home there, and the payload has
// to state nothing the MENU does not draw.

const assert = require('node:assert');

const SURFACE_ENV = 'WORKFLOWS_GATE_SURFACE';
const GATE_MARKER = '=== GATE (json for a gate surface — never display) ===';
const MENU_RULE = '· · · · · · · · · · · ·';
const NBSP = ' ';
const GLYPHED_LINE = /^\*\*`◆ (.*)`\*\*$/;
const MARKUP = /`([^`]*)`|\\([!-/:-@[-`{-~])|\*\*|~~|[`*]/g;

const LABEL_TOKEN = /`([^`]*)`|\\([!-/:-@[-`{-~])|\*\*|~~|\*|[^`\\*~]+|[\s\S]/g;

/** @typedef {{key: string, word: string|null, head: string, tail: string|null, cue: string|null, holder: string|null, detail: string|null, struck: boolean, recommended: boolean}} GateOption */
/** @typedef {{label: string, description: string, detail: string|null}} GateTyped */
/** @typedef {{gate: string, question: string, statement: string, options: GateOption[], typed: GateTyped[]}} GatePayload */
/** @typedef {{typed: boolean, name: string, label: string|null, detail: string|null}} DrawnRow */
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

/**
 * Menu text as the payload states it: a code span's content and an escaped
 * character stay as text, every other marker comes off, whitespace runs as
 * one space.
 * @param {string} text
 */
function plainText(text) {
  return text.replace(MARKUP, (_, code, escaped) => code ?? escaped ?? '').replace(/\s+/g, ' ').trim();
}

/** A payload detail as text — its line breaks are layout the MENU cannot show. @param {string|null} detail */
function detailText(detail) {
  return detail === null ? null : plainText(detail);
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

// The label the option grammar draws from a payload row's parts
// (CONVENTIONS.md: Menus): the metadata tail italic after a dash, the cue
// plain after a dot, the strike over the row up to its holder, the holder
// plain after it, the recommendation last. Null for a bare key.
/** @param {GateOption} o @returns {string|null} */
function partsLabel(o) {
  let label = o.head;
  if (o.tail !== null) label += ` — *${o.tail}*`;
  if (o.cue !== null) label += ` · ${o.cue}`;
  if (o.holder !== null) label = `~~${label}~~ · ${o.holder}`;
  if (o.recommended) label += ' (recommended)';
  return label === '' ? null : label;
}

/**
 * A label read three ways no wrap can disturb — its words, the words under
 * its strike, the words in its italics — markers off and whitespace as one
 * space, so a span a wrap closed and reopened reads whole.
 * @param {string|null} label @returns {LabelReading|null}
 */
function readLabel(label) {
  if (label === null) return null;
  let text = '';
  let struck = '';
  let italic = '';
  let inStrike = false;
  let inItalic = false;
  for (const [token, code, escaped] of label.matchAll(LABEL_TOKEN)) {
    if (token === '~~') { inStrike = !inStrike; struck += ' '; continue; }
    if (token === '*') { inItalic = !inItalic; italic += ' '; continue; }
    if (token === '**') continue;
    const chars = code ?? escaped ?? token;
    text += chars;
    if (inStrike) struck += chars;
    if (inItalic) italic += chars;
  }
  const squash = (/** @type {string} */ s) => s.replace(/\s+/g, ' ').trim();
  return { text: squash(text), struck: squash(struck), italic: squash(italic) };
}

// A row is an option or a typed row, in order and with its whole label; a
// wrapped label's continuation belongs to the row above it, and so does any
// other line directly beneath it, as its detail; the line the menu asks on —
// its glyphed line, else the prose line it closes on — is the question;
// every other line is the statement, in order.
/** @param {GatePayload} gate @param {string[]} body @param {string} label @returns {void} */
function assertPayloadDrawsMenu(gate, body, label) {
  /** @type {DrawnRow[]} */ const rows = [];
  /** @type {{text: string, glyphed: boolean}[]} */ const prose = [];
  /** @type {DrawnRow|null} */ let under = null;
  let closesOnProse = false;
  for (const line of body) {
    if (line === MENU_RULE || line.trim() === '') { under = null; continue; }
    if (line.startsWith(NBSP)) {
      assert.ok(under?.label, `[${label}] "${line}" is indented as a continuation but follows no row`);
      under.label = `${under.label} ${line.replace(/^ +/, '')}`;
      continue;
    }
    const glyphed = GLYPHED_LINE.exec(line);
    const row = glyphed ? null : drawnRow(line);
    closesOnProse = false;
    if (row) {
      rows.push(row);
      under = row;
    } else if (under !== null && !glyphed) {
      under.detail = plainText(`${under.detail ?? ''} ${line}`);
    } else {
      prose.push({ text: plainText(glyphed?.[1] ?? line), glyphed: glyphed !== null });
      closesOnProse = true;
    }
  }
  const glyphAt = prose.findIndex((p) => p.glyphed);
  const askAt = glyphAt !== -1 ? glyphAt : closesOnProse ? prose.length - 1 : -1;
  assert.strictEqual(gate.question, askAt === -1 ? '' : prose[askAt].text,
    `[${label}] the payload's question is not the line the menu asks on`);
  assert.deepStrictEqual(gate.statement === '' ? [] : gate.statement.split('\n'), prose.filter((_, i) => i !== askAt).map((p) => p.text),
    `[${label}] the payload's statement is not every other line the menu draws`);

  const keys = rows.filter((r) => !r.typed);
  const typed = rows.filter((r) => r.typed);
  assert.deepStrictEqual(gate.options.map((o) => (o.word ? `${o.key}/${o.word}` : o.key)), keys.map((r) => r.name),
    `[${label}] the payload's keys are not the menu's`);
  assert.deepStrictEqual(
    gate.options.map((o) => [readLabel(partsLabel(o)), o.struck, detailText(o.detail)]),
    keys.map((r) => [readLabel(r.label), Boolean(readLabel(r.label)?.struck), r.detail]),
    `[${label}] the payload's option parts are not what the menu's rows draw — words, strike, italics, detail`);
  assert.deepStrictEqual(gate.typed.map((t) => [t.label, plainText(t.description), detailText(t.detail)]),
    typed.map((r) => [r.name, plainText(r.label ?? ''), r.detail]),
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
