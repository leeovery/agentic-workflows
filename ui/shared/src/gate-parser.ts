// The gate parser — Phase 2's shared/gate-parser (plan §2), implementing
// specs 1–2 against the engine's verified rendering (surfaces.cjs):
//   section:      `=== NAME (instruction) ===` + body, no closing delimiter
//   STOP:         instruction contains uppercase STOP ("…then STOP for the
//                 user's response"); auto/continue instructions carry
//                 "do not stop" and are context, never asks
//   glyph line:   **`◆ question`**
//   cmd option:   **`k/word`** → label   |   **`k`** → label
//   range option: **`a–b`** → label      (en-dash)
//   prompt row:   **label** → description
//   frame line:   `· · · · · · · · · · · ·`
//   wrapping:     continuation lines are NBSP-indented (U+00A0)
// Pure and environment-free: hashing is injected (node:crypto bridge-side).
import { GateOption, GateKind, NEVER_AUTO_SURFACES, NEVER_AUTO_LABEL_PATTERNS, NEVER_AUTO_SUSPICION, SURFACE_GATE_TYPES } from './gate-card.js';

export type Section = { name: string; instruction: string; body: string };

const SECTION_HEADER = /^=== (.+?) \((.+?)\) ===$/;
const FRAME_LINE = /^[·\s ]+$/;
const GLYPH_LINE = /^\*\*`◆ (.+)`\*\*$/;
const CMD_OPTION = /^\*\*`([^`]+)`\*\*\s*→\s*(.*)$/;
const PROMPT_OPTION = /^\*\*([^`*]+)\*\*\s*→\s*(.*)$/;
const CONTINUATION = /^[\u00a0 ]/;

/** Split a tool-result text into demarcated sections (in order). */
export function extractSections(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  let body: string[] = [];
  const flush = () => {
    if (current) {
      current.body = body.join('\n').replace(/\n+$/, '');
      sections.push(current);
    }
    body = [];
  };
  for (const line of lines) {
    const m = SECTION_HEADER.exec(line);
    if (m) {
      flush();
      current = { name: m[1]!, instruction: m[2]!, body: '' };
    } else if (current) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Ask eligibility, per the measured instruction vocabulary (Phase 2 sweep):
 * render gate surfaces (`MENU: {name}`) say "then STOP for the user's
 * response"; auto-bypassed gates say "do not stop; continue" and are context,
 * never asks (the phantom-gate rule); the GATEWAY's navigation menus are the
 * bare name `MENU` with "emit verbatim as markdown" — no STOP in the
 * instruction, but always a stop in practice. An unrecognised combination is
 * NOT an ask (mis-carding injects a stray key later; the turn-final relay
 * still surfaces it as a prose card or pass-through — the safe direction).
 */
export function isStopSection(s: Section): boolean {
  // Measured against the engine (surfaces.cjs's own doctrine: "Two facts,
  // never blurred"): the ONLY menus a session sails past carry the explicit
  // auto instruction "do not stop; continue". Every other MENU section —
  // whether its instruction says "then STOP for the user's response"
  // (render gates), or just "emit verbatim as markdown" (gateway navigation
  // menus, finding announce) — is a genuine session stop.
  return !/do not stop/i.test(s.instruction);
}

export type ParsedMenu = {
  question?: string;
  options: GateOption[];
  context: string;
  /** The contiguous option block + glyph line — identity input for
   *  grammar-parsed menus (spec 1). */
  optionBlock: string;
};

function parseOptionInner(inner: string, label: string): GateOption | null {
  const range = inner.match(/^(\d+)–(\d+)$/);
  if (range) {
    return {
      key: inner,
      label,
      recommended: false,
      form: 'range',
      range: [Number(range[1]), Number(range[2])],
    };
  }
  const slash = inner.match(/^([^/\s]+)\/(\S+)$/);
  if (slash) return { key: slash[1]!, word: slash[2]!, label, recommended: false, form: 'cmd' };
  if (/^\S+$/.test(inner)) return { key: inner, label, recommended: false, form: 'cmd' };
  return null;
}

/**
 * Parse a section body (or turn-final text) under the option grammar.
 * Strict: structural deviation inside the option block → null (fallback).
 */
export function parseMenu(body: string): ParsedMenu | null {
  const rawLines = body.split('\n');
  const options: GateOption[] = [];
  let question: string | undefined;
  const contextLines: string[] = [];
  const optionBlockLines: string[] = [];
  let inOptions = false;
  let optionsEnded = false;

  for (const raw of rawLines) {
    const line = raw.replace(/ /g, ' ').trimEnd();
    if (FRAME_LINE.test(line) && line.includes('·')) continue; // the dots frame
    if (CONTINUATION.test(raw) && options.length > 0 && !optionsEnded) {
      // NBSP continuation of the previous option's wrapped label.
      const prev = options[options.length - 1]!;
      prev.label = `${prev.label} ${line.trim()}`.trim();
      optionBlockLines.push(raw);
      continue;
    }
    const glyph = GLYPH_LINE.exec(line.trim());
    if (glyph) {
      if (question !== undefined) return null; // two glyph lines: not this grammar
      question = glyph[1]!;
      optionBlockLines.push(raw);
      continue;
    }
    const cmd = CMD_OPTION.exec(line.trim());
    if (cmd) {
      if (optionsEnded) return null; // options resumed after prose: deviation
      const opt = parseOptionInner(cmd[1]!, cmd[2]!.trim());
      if (!opt) return null;
      inOptions = true;
      options.push(opt);
      optionBlockLines.push(raw);
      continue;
    }
    // A line that LOOKS like an option row but fails the grammar (truncated,
    // malformed) is a structural deviation — strict parse refuses the menu.
    if (line.trim().startsWith('**`')) return null;
    const prompt = PROMPT_OPTION.exec(line.trim());
    if (prompt && inOptions) {
      // A prompt option amid the block.
      options.push({ key: prompt[1]!.trim(), label: prompt[2]!.trim(), recommended: false, form: 'prompt' });
      optionBlockLines.push(raw);
      continue;
    }
    if (line.trim() === '') {
      if (inOptions) optionsEnded = true;
      continue;
    }
    if (inOptions) optionsEnded = true;
    contextLines.push(line);
  }

  if (options.length === 0) return null;
  // Mark the recommended row (the engine writes "(recommended)" into labels).
  let recommendedSeen = false;
  for (const o of options) {
    if (/\(recommended\)/i.test(o.label) && !recommendedSeen) {
      o.recommended = true;
      recommendedSeen = true;
    }
  }
  return {
    question,
    options,
    context: contextLines.join('\n').trim(),
    optionBlock: optionBlockLines.join('\n'),
  };
}

/**
 * normalizedBody (spec 1, operational): collapse ALL Unicode whitespace
 * (NBSP included) to single spaces, trim each line, drop frame lines, join
 * with \n, keep markdown markers verbatim.
 */
export function normalizedBody(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l !== '' && !(FRAME_LINE.test(l) && l.includes('·')))
    .join('\n');
}

export type HashFn = (input: string) => string; // hex sha256

export function computeGateId(
  bridgeSessionId: string,
  askOrdinal: number,
  normalized: string,
  sha256hex: HashFn,
): string {
  return sha256hex(`${bridgeSessionId}\n${askOrdinal}\n${normalized}`).slice(0, 16);
}

// --- classification ---------------------------------------------------------

export function classifyKind(section: Section | null, menu: ParsedMenu | null): GateKind {
  if (section && /^MENU: finding batch$/.test(section.name)) return 'batch-screen';
  if (!menu || menu.options.length === 0) {
    return section ? 'stop-notice' : 'pass-through';
  }
  const cmds = menu.options.filter((o) => o.form === 'cmd');
  if (cmds.some((o) => o.key === 'y' || o.word === 'yes') && cmds.length <= 3) return 'confirm';
  if (cmds.length >= 2) return 'menu';
  return 'menu';
}

/** Never-auto recognition (spec 1): direction of error is toward ceremony. */
export function confirmMode(section: Section | null, menu: ParsedMenu | null): 'tap' | 'typed' {
  if (section) {
    if ((NEVER_AUTO_SURFACES as readonly string[]).includes(section.name)) return 'typed';
    const known =
      section.name in SURFACE_GATE_TYPES ||
      (NEVER_AUTO_SURFACES as readonly string[]).includes(section.name);
    if (!known && NEVER_AUTO_SUSPICION.test(`${section.name}\n${menu?.context ?? ''}`)) return 'typed';
  }
  const labels = (menu?.options ?? []).map((o) => o.label).join('\n');
  if (NEVER_AUTO_LABEL_PATTERNS.some((p) => p.test(labels))) return 'typed';
  if (menu && NEVER_AUTO_SUSPICION.test(labels)) return 'typed';
  return 'tap';
}

// --- ask detection (spec 2 precedence) --------------------------------------

export type TurnView = {
  /** Tool-result texts, in order of arrival within the turn. */
  toolResults: string[];
  /** The turn-final assistant text. */
  finalText: string;
  /** True when the SDK result message indicates completion/error. */
  ended: boolean;
};

export type Detection =
  | {
      kind: GateKind;
      source: 'tool-result' | 'relay' | 'prose';
      surface?: string;
      question?: string;
      options: GateOption[];
      context: string;
      confirm: 'tap' | 'typed';
      gateType?: string;
      /** Identity input: section extent (tool-result) or option block (grammar). */
      identityBody: string;
      /** For tool-result cards: the model's relay diverged from the section. */
      relayDiverged?: boolean;
    }
  | { kind: 'pass-through'; source: 'prose'; options: []; context: string; confirm: 'tap'; identityBody: string }
  | null;

export function detectAsk(turn: TurnView): Detection {
  if (turn.ended) return null;

  // 1. Demarcated STOP sections in tool results — the LAST is the ask
  //    (earlier ones render as context; two-menus-per-turn is valid input).
  const stopSections: Section[] = [];
  for (const tr of turn.toolResults) {
    for (const s of extractSections(tr)) {
      if (s.name.startsWith('MENU') && isStopSection(s)) stopSections.push(s);
    }
  }
  const last = stopSections.at(-1) ?? null;
  if (last) {
    const menu = parseMenu(last.body);
    const kind = classifyKind(last, menu);
    const identityBody = normalizedBody(last.body);
    const relayDiverged =
      menu !== null && turn.finalText.trim() !== '' && !relayMatches(turn.finalText, menu);
    return {
      kind,
      source: 'tool-result',
      surface: last.name,
      question: menu?.question,
      options: menu?.options ?? [],
      context: menu?.context ?? last.body,
      confirm: confirmMode(last, menu),
      gateType: SURFACE_GATE_TYPES[last.name],
      identityBody,
      relayDiverged,
    };
  }

  // 2. No engine section — turn-final text under the option grammar.
  if (turn.finalText.trim() !== '') {
    const menu = parseMenu(turn.finalText);
    if (menu) {
      return {
        kind: classifyKind(null, menu),
        source: 'prose',
        question: menu.question,
        options: menu.options,
        context: menu.context,
        confirm: confirmMode(null, menu),
        identityBody: normalizedBody(menu.optionBlock),
      };
    }
    // 3. Anything else turn-final → pass-through open ask.
    return {
      kind: 'pass-through',
      source: 'prose',
      options: [],
      context: turn.finalText,
      confirm: 'tap',
      identityBody: normalizedBody(turn.finalText),
    };
  }

  return null;
}

/** Loose relay check: every option key from the section appears in the relay. */
function relayMatches(relay: string, menu: ParsedMenu): boolean {
  const norm = relay.replace(/ /g, ' ');
  return menu.options.every((o) => norm.includes(`\`${o.word ? `${o.key}/${o.word}` : o.key}\``) || norm.includes(`**${o.key}**`) || norm.includes(o.label.slice(0, 24)));
}
