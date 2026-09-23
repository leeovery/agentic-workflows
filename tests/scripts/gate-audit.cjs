'use strict';

// The gate payload held against the MENU it states. A surface that draws the
// gate from the payload shows the person the payload and nothing else, so
// every line the MENU draws has to have its home there, and the payload has
// to state nothing the MENU does not draw.

const assert = require('node:assert');

const GATE_MARKER = '=== GATE (json for a gate surface — never display) ===';
const MENU_RULE = '· · · · · · · · · · · ·';
const NBSP = ' ';
const GLYPHED_LINE = /^\*\*`◆ (.*)`\*\*$/;

/** @typedef {{key: string, word: string|null, head: string, tail: string|null, detail: string|null, struck: boolean, recommended: boolean}} GateOption */
/** @typedef {{label: string, description: string, detail: string|null}} GateTyped */
/** @typedef {{gate: string, question: string, statement: string, options: GateOption[], typed: GateTyped[]}} GatePayload */
/** @typedef {{typed: boolean, name: string, text: string|null, detail: string|null}} DrawnRow */

/** Menu text as the payload states it: markup off, whitespace as one space. @param {string} text */
function plainText(text) {
  return text.replace(/\*\*|~~|[`*]/g, '').replace(/\s+/g, ' ').trim();
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
  if (code) return { typed: code[1].includes('–'), name: code[1], text: code[2] === undefined ? null : plainText(code[2]), detail: null };
  const prompt = /^\*\*([^*`]+)\*\*\s+→ (.*)$/.exec(line);
  return prompt ? { typed: true, name: prompt[1], text: plainText(prompt[2]), detail: null } : null;
}

/** The label an option draws, rebuilt from its payload row; null for a bare key. @param {GateOption} o */
function optionText(o) {
  if (o.head === o.word && o.tail === null) return null;
  return plainText([o.head, o.tail].filter((part) => part !== null).join(' — ') + (o.recommended ? ' (recommended)' : ''));
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
      assert.ok(under, `[${label}] "${line}" is indented as a continuation but follows no row`);
      under.text = `${under.text} ${plainText(line)}`;
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
  assert.deepStrictEqual(gate.options.map((o) => [optionText(o), detailText(o.detail)]), keys.map((r) => [r.text, r.detail]),
    `[${label}] the payload's option labels and details are not the menu's`);
  assert.deepStrictEqual(gate.typed.map((t) => [t.label, plainText(t.description), detailText(t.detail)]), typed.map((r) => [r.name, r.text, r.detail]),
    `[${label}] the payload's typed rows are not the menu's`);
}

/**
 * The GATE payload in an announced response, held against its MENU: it sits
 * directly above the first MENU and states the whole of it. Null when the
 * response carries no menu, which then carries no gate either.
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
  assert.strictEqual(lines[menuAt - 2], GATE_MARKER, `[${label}] the payload does not sit directly above its menu`);
  const gate = JSON.parse(lines[menuAt - 1]);
  const end = lines.findIndex((l, i) => i > menuAt && l.startsWith('=== '));
  assertPayloadDrawsMenu(gate, lines.slice(menuAt + 1, end === -1 ? lines.length : end), label);
  return gate;
}

module.exports = { GATE_MARKER, auditGate };
