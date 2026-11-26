'use strict';

// The gate payload held against the MENU it states. A surface that draws the
// gate from the payload shows the person the payload's question and rows in
// place of the menu, so every row the MENU draws has to have its home there,
// the payload's question and rows are the menu's and nothing else, and what
// it states is the text the person reads — never the markup that draws it.
// What the person reads before the question, the menu's statement, is the
// chat's: a DISPLAY directly above the payload, the MENU holding the question
// and the rows alone; the payload states that statement too, read plain, the
// gate's identity no surface draws. `auditingRender` also holds a render with
// the statement folded back under its rule to the one an unannounced surface
// reads. Beside it, every section a person is shown names how it renders in
// one of the four forms, so no older or reworded form comes back. The gate it
// states is named as the trust log keys it, so every gate a render draws, a
// templated name's every variant among them, is held to the gate event's rule
// wherever it renders.

const assert = require('node:assert');
const { RENDER_FORMS: FORMS, STATEMENT_INSTRUCTION, emitAs, openGate, statementSection } = require('../../skills/ledger-engine/scripts/domain/projections/surfaces.cjs');
const { SCHEMA } = require('../../skills/ledger-engine/scripts/domain/trust-events.cjs');

const SURFACE_ENV = 'LEDGER_GATE_SURFACE';
const GATE_MARKER = '=== GATE (json for a gate surface — never display) ===';
const MENU_RULE = '· · · · · · · · · · · ·';
const CONTINUATION = /^ +/;
const GLYPHED_LINE = /^\*\*`◆ (.*)`\*\*$/;
const MARKUP = /(?<!`)(`+)(?!`)(.*?[^`])\1(?!`)|\\([!-/:-@[-`{-~])|\*\*|~~|[`*]/g;
// The gates that draw another's words as written, each code span in them
// kept whole in the payload: the raise, Claude's (projections/raise.cjs,
// `wordsAsWritten`).
const LITERAL_GATES = new Set(['raise']);
// The gates whose payload asks a question of its own in the place of the
// menu's short one, a line of the statement: the raise, the call's question
// (projections/raise.cjs).
const OWN_QUESTION_GATES = new Set(['raise']);
const PAYLOAD_FIELDS = ['gate', 'question', 'statement', 'options', 'typed'];

// The same markup one token at a time: a code span and an escape carry their
// text, a strike or an italic marker toggles its span, bold and a stray
// backtick drop, and everything else is text.
const LABEL_TOKEN = /(?<!`)(`+)(?!`)(.*?[^`])\1(?!`)|\\([!-/:-@[-`{-~])|\*\*|~~|[`*]|[^`\\*~]+|[\s\S]/g;

const TAIL_SEPARATOR = ' — ';
const NOTE_SEPARATOR = ' · ';
const RECOMMENDED_MARKER = ' (recommended)';

const SHOWN_MARKER = /^=== (?:TITLE|DISPLAY|MENU)\b.*? \((.*)\) ===$/;
const RENDER_FORMS = Object.keys(FORMS).map((form) => emitAs(form));
// The gate event's rule for a gate's name, and where a declared entry's name ends.
const GATE_NAME = SCHEMA.events.gate.fields.find((/** @type {{name: string}} */ f) => f.name === 'gate')?.type;
const ENTRY_SEPARATOR = ' — ';

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
 * content — the span whole, in a gate drawing another's words as written —
 * and an escaped character stay as text, every other marker comes off.
 * @param {string} text @param {boolean} literal
 */
function plainText(text, literal) {
  return squash(text.replace(MARKUP, (whole, _run, code, escaped) => (code === undefined ? escaped ?? '' : literal ? whole : code)));
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
 * @param {string|null} label @param {boolean} literal @returns {Glyph[]}
 */
function drawnGlyphs(label, literal) {
  /** @type {Glyph[]} */
  const glyphs = [];
  let struck = false;
  let italic = false;
  for (const [token, , code, escaped] of (label ?? '').matchAll(LABEL_TOKEN)) {
    if (token === '~~') struck = !struck;
    else if (token === '*') italic = !italic;
    else if (token !== '**' && token !== '`') for (const ch of (literal && code !== undefined ? token : code) ?? escaped ?? token) glyphs.push({ ch, struck, italic });
  }
  return squashGlyphs(glyphs);
}

/**
 * The characters a payload row's parts show, each marked where the option
 * grammar draws it (domain/projections/surfaces.cjs, its header's Menus): the tail italic after a dash, the
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
// its glyphed line — is the question, the payload's, or a line of the
// statement where the gate asks its own; and no other line stands, the
// statement drawn apart. Every value the payload states is held as it
// stands against the menu read plain.
/**
 * @param {GatePayload} gate @param {string[]} body @param {string[]} statement the statement's lines, read plain
 * @param {string} label @param {{literal: boolean, ownQuestion: boolean}} reads how the gate draws its words and its question
 * @returns {void}
 */
function assertPayloadDrawsMenu(gate, body, statement, label, { literal, ownQuestion }) {
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
      under.detail = plainText(`${under.detail ?? ''} ${line}`, literal);
    } else {
      prose.push({ text: plainText(glyphed?.[1] ?? line, literal), glyphed: glyphed !== null });
    }
  }
  const askAt = prose.findIndex((p) => p.glyphed);
  assert.deepStrictEqual(prose.filter((_, i) => i !== askAt).map((p) => p.text), [],
    `[${label}] the menu draws a line beside its question and its rows — the statement is drawn apart, above the payload`);
  if (ownQuestion) {
    assert.ok(statement.includes(gate.question), `[${label}] the payload's own question is no line of the statement`);
  } else {
    assert.strictEqual(gate.question, askAt === -1 ? '' : prose[askAt].text,
      `[${label}] the payload's question is not the line the menu asks on`);
  }

  const keys = rows.filter((r) => !r.typed);
  const typed = rows.filter((r) => r.typed);
  assert.deepStrictEqual(gate.options.map((o) => (o.word ? `${o.key}/${o.word}` : o.key)), keys.map((r) => r.name),
    `[${label}] the payload's keys are not the menu's`);
  const drawn = keys.map((r) => drawnGlyphs(r.label, literal));
  assert.deepStrictEqual(
    gate.options.map((o, i) => [reading(partsGlyphs(o, drawn[i])), o.struck, squashed(o.detail)]),
    keys.map((r, i) => [reading(drawn[i]), drawn[i].some((g) => g.struck), r.detail]),
    `[${label}] the payload's option parts are not what the menu's rows draw — text, strike, italics, detail`);
  assert.deepStrictEqual(gate.typed.map((t) => [t.label, squash(t.description), squashed(t.detail)]),
    typed.map((r) => [plainText(r.name, literal), plainText(r.label ?? '', literal), r.detail]),
    `[${label}] the payload's typed rows are not the menu's`);
}

/**
 * Every TITLE, DISPLAY and MENU marker in a response opens its instruction on
 * one of the four forms, whatever behaviour follows.
 * @param {string} out  the response's stdout
 * @param {string} label  what the assertion messages name
 */
function auditMarkers(out, label) {
  for (const line of out.split('\n')) {
    const marker = SHOWN_MARKER.exec(line);
    if (marker) {
      assert.ok(RENDER_FORMS.some((form) => marker[1].startsWith(form)),
        `[${label}] "${line}" names no render form — its instruction opens on one of: ${RENDER_FORMS.join(' · ')}`);
    }
  }
}

/** The marker of the statement the gate `gate` draws apart. @param {string} gate */
function statementMarker(gate) {
  return `=== ${statementSection(gate)} (${STATEMENT_INSTRUCTION}) ===`;
}

/**
 * The statement an announced response draws apart from its menu, its
 * lines as the DISPLAY directly above the GATE holds them; none where it
 * draws none.
 * @param {string[]} lines  the response's lines @param {number} gateAt where its GATE marker stands
 * @returns {string[]}
 */
function statementAbove(lines, gateAt) {
  const opens = lines.lastIndexOf(statementMarker(JSON.parse(lines[gateAt + 1]).gate), gateAt);
  if (opens === -1 || lines.slice(opens + 1, gateAt).some((line) => line.startsWith('=== '))) return [];
  return lines.slice(opens + 1, gateAt);
}

/**
 * The statement an announced response draws apart from its menu, read
 * plain, a line apiece, as the person reads it in the chat.
 * @param {string} out @returns {string}
 */
function statementOf(out) {
  const lines = out.split('\n');
  const gateAt = lines.indexOf(GATE_MARKER);
  const literal = LITERAL_GATES.has(JSON.parse(lines[gateAt + 1]).gate.split(ENTRY_SEPARATOR)[0]);
  return statementAbove(lines, gateAt).map((line) => plainText(line, literal)).filter(Boolean).join('\n');
}

/**
 * An announced response as an unannounced surface reads it: the GATE
 * block gone, and the statement drawn apart folded back into the menu,
 * under its rule, a blank line beneath it.
 * @param {string} out @returns {string}
 */
function unannounced(out) {
  const lines = out.split('\n');
  const gateAt = lines.indexOf(GATE_MARKER);
  if (gateAt === -1) return out;
  const statement = statementAbove(lines, gateAt);
  const folded = statement.length === 0 ? [] : [...statement, ''];
  const [marker, rule, ...rest] = lines.slice(gateAt + 2);
  return [...lines.slice(0, gateAt - (statement.length === 0 ? 0 : statement.length + 1)), marker, rule, ...folded, ...rest].join('\n');
}

/**
 * The GATE payload in an announced response, held against its MENU — a
 * response carries one at most: it sits directly above the MENU, asks a
 * question over at least one row to press, and states every row of the
 * menu and nothing else, the statement drawn apart above it. Null when the
 * response carries no menu, which then carries no gate either, and when
 * the menu draws nothing, which leaves nothing to state.
 * @param {string} out  the response's stdout
 * @param {string} label  what the assertion messages name
 * @returns {GatePayload|null}
 */
function auditGate(out, label) {
  auditMarkers(out, label);
  const lines = out.split('\n');
  assert.ok(lines.filter((l) => l.startsWith('=== MENU')).length <= 1, `[${label}] a response carries one MENU at most`);
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
  const name = gate.gate.split(ENTRY_SEPARATOR)[0];
  assert.ok(GATE_NAME?.test(name), `[${label}] the gate "${name}" is no name the trust log keys — ${GATE_NAME?.is}`);
  assert.deepStrictEqual(Object.keys(gate), PAYLOAD_FIELDS, `[${label}] the payload states its gate, its question, its statement and its rows, and nothing else`);
  assert.notStrictEqual(gate.question, '', `[${label}] every menu asks — the payload states no question`);
  assert.ok(gate.options.length > 0, `[${label}] every menu has a row to press — the payload states none`);
  const literal = LITERAL_GATES.has(name);
  const statement = statementAbove(lines, menuAt - 2).map((line) => plainText(line, literal)).filter(Boolean);
  assert.strictEqual(gate.statement, statement.join('\n'), `[${label}] the payload's statement is not the one drawn apart above it, read plain`);
  assertPayloadDrawsMenu(gate, body, statement, label, { literal, ownQuestion: OWN_QUESTION_GATES.has(name) });
  return gate;
}

/**
 * A render-surface caller that audits as it renders: every render's markers
 * name their forms, and every render that draws a menu is drawn again with
 * the gate surface announced, opened as a command opens it, and its payload
 * held against that menu.
 * @param {(dir: string, surface: string, args: object) => string} renderSurface
 * @returns {(dir: string, surface: string, args: object) => string}
 */
function auditingRender(renderSurface) {
  return (dir, surface, args) => {
    const out = renderSurface(dir, surface, args);
    auditMarkers(out, `render ${surface}`);
    if (out.includes('=== MENU')) {
      const drawn = announced(() => {
        openGate();
        return renderSurface(dir, surface, args);
      });
      auditGate(drawn, `render ${surface}`);
      assert.strictEqual(unannounced(drawn), out, `[render ${surface}] the statement drawn apart is not the menu's own, folded back`);
    }
    return out;
  };
}

module.exports = { GATE_MARKER, announced, auditGate, auditMarkers, auditingRender, statementOf, unannounced };
