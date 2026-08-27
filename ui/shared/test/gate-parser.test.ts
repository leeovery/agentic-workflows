// Gate parser tests: unit coverage of the grammar and taxonomy, the authored
// adversarial corpus (spec 4), and a lane over the REAL recorded transcript's
// tool-result sections.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  extractSections,
  isStopSection,
  parseMenu,
  normalizedBody,
  computeGateId,
  classifyKind,
  confirmMode,
  detectAsk,
} from '../src/gate-parser.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADVERSARIAL = path.resolve(HERE, '..', '..', 'fixtures', 'adversarial');
const TRANSCRIPT = path.resolve(HERE, '..', '..', 'fixtures', 'mid-discussion', 'transcript.jsonl');

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const adv = (name: string) => fs.readFileSync(path.join(ADVERSARIAL, name), 'utf8');

const STOP = "emit verbatim as markdown, then STOP for the user's response";

describe('extractSections + eligibility', () => {
  it('splits demarcated sections and preserves bodies (no closing delimiter)', () => {
    const text = `=== DATA (reason from this — never display or parse the sections below) ===\nk: v\n\n=== MENU (emit verbatim as markdown) ===\nbody line\n`;
    const sections = extractSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[1]).toMatchObject({ name: 'MENU', body: 'body line' });
  });

  it('STOP instructions are eligible; auto-mode "do not stop" never is; bare gateway MENU is', () => {
    expect(isStopSection({ name: 'MENU: check-in gate', instruction: STOP, body: '' })).toBe(true);
    expect(
      isStopSection({
        name: 'MENU: task approval',
        instruction: 'emit verbatim as a code block — the user set this gate to auto: do not stop; continue as the workflow instructs',
        body: '',
      }),
    ).toBe(false);
    expect(isStopSection({ name: 'MENU', instruction: 'emit verbatim as markdown', body: '' })).toBe(true);
    // finding announce renders with the plain instruction and IS a stop —
    // the measured rule: everything without the auto bypass stops.
    expect(isStopSection({ name: 'MENU: finding announce', instruction: 'emit verbatim as markdown', body: '' })).toBe(true);
  });
});

describe('parseMenu — the option grammar', () => {
  const body = [
    '· · · · · · · · · · · ·',
    '**`◆ Which fits?`**',
    '',
    '**`1`** → Per-host buckets (recommended)',
    '**`2`** → Global bucket',
    '**`3–5`** → Pick a numbered variant',
    '**`o/other`** → Something else',
    '**Keep shaping** → Tell me more',
  ].join('\n');

  it('parses glyph, cmd, range and prompt rows; marks the recommended row', () => {
    const m = parseMenu(body)!;
    expect(m.question).toBe('Which fits?');
    expect(m.options).toHaveLength(5);
    expect(m.options[0]).toMatchObject({ key: '1', form: 'cmd', recommended: true });
    expect(m.options[2]).toMatchObject({ key: '3–5', form: 'range', range: [3, 5] });
    expect(m.options[3]).toMatchObject({ key: 'o', word: 'other', form: 'cmd' });
    expect(m.options[4]).toMatchObject({ form: 'prompt' });
  });

  it('never pre-selects: exactly one recommended, from the label text only', () => {
    const m = parseMenu(body)!;
    expect(m.options.filter((o) => o.recommended)).toHaveLength(1);
  });

  it('folds NBSP continuation lines into the previous label', () => {
    const m = parseMenu(adv('nbsp-variations.txt').split('\n').slice(1).join('\n'))!;
    const c = m.options.find((o) => o.key === 'c')!;
    expect(c.label).toContain('onto a continuation line');
  });

  it('normalizedBody collapses NBSP and drops the frame line', () => {
    const n = normalizedBody('· · · · · ·\n**`c/continue`**  → label here');
    expect(n).toBe('**`c/continue`** → label here');
  });

  it('gate ids are stable and 16 hex chars', () => {
    const id = computeGateId('bs1', 3, 'body', sha256);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(computeGateId('bs1', 3, 'body', sha256)).toBe(id);
    expect(computeGateId('bs1', 4, 'body', sha256)).not.toBe(id);
  });
});

describe('classification + never-auto', () => {
  it('finding batch surface → batch-screen; y/yes small menus → confirm', () => {
    expect(classifyKind({ name: 'MENU: finding batch', instruction: STOP, body: '' }, null)).toBe('batch-screen');
    const m = parseMenu('**`y/yes`** → Do it\n**`n/no`** → Skip')!;
    expect(classifyKind(null, m)).toBe('confirm');
  });

  it('never-auto surfaces and destructive labels take typed confirm', () => {
    const m = parseMenu('**`1`** → Keep mine\n**`2`** → Keep theirs')!;
    expect(confirmMode({ name: 'MENU: incoherence conflict', instruction: STOP, body: '' }, m)).toBe('typed');
    expect(confirmMode({ name: 'MENU: spec signoff gate', instruction: STOP, body: '' }, m)).toBe('typed');
    const destructive = parseMenu('**`d/delete`** → Permanently delete the archived item')!;
    expect(confirmMode(null, destructive)).toBe('typed');
    const tame = parseMenu('**`c/continue`** → Proceed\n**`p/park`** → Park it')!;
    expect(confirmMode({ name: 'MENU: check-in gate', instruction: STOP, body: '' }, tame)).toBe('tap');
  });

  it('an unrecognised surface RESEMBLING the never-auto set defaults to typed', () => {
    const m = parseMenu('**`1`** → Overwrite the approved content\n**`2`** → Leave it')!;
    expect(confirmMode({ name: 'MENU: novel gate', instruction: STOP, body: '' }, m)).toBe('typed');
  });

  it('a bare work-unit cancel confirm is typed (from surface AND from context text)', () => {
    const m = parseMenu('**`y/yes`** → Confirm cancellation\n**`n/no`** → Return to menu')!;
    expect(confirmMode({ name: 'MENU: cancel gate', instruction: STOP, body: '' }, m)).toBe('typed');
    // Even without the surface name, the confirmation sentence in context trips it.
    const ctx = { name: 'MENU: mystery', instruction: STOP, body: 'Cancelling **auth-flow** will mark it as cancelled.' };
    expect(confirmMode(ctx, m)).toBe('typed');
  });
});

describe('detectAsk — the finding batch pair', () => {
  it('pairs the DISPLAY: finding batch content into the batch-screen card context', () => {
    const tr = [
      '=== DISPLAY: finding batch (emit verbatim as markdown) ===',
      '1. Finding one — a real thing',
      '2. Finding two — another',
      '',
      "=== MENU: finding batch (emit verbatim as markdown, then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      '**`y/yes`** → Apply the batch',
      '**`d/discuss`** → Walk them',
    ].join('\n');
    const d = detectAsk({ toolResults: [tr], finalText: '', ended: false })!;
    expect(d.kind).toBe('batch-screen');
    expect(d.context).toContain('Finding one');
    expect(d.context).toContain('Finding two');
  });
});

describe('detectAsk — the adversarial corpus', () => {
  it('a truncated menu falls back to PASS-THROUGH, never a fabricated card (N3)', () => {
    const d = detectAsk({ toolResults: [adv('truncated-menu.txt')], finalText: 'relay text', ended: false });
    expect(d).not.toBeNull();
    // A section whose option markup failed to parse degrades to pass-through
    // (chat + reply box), not a gold decision card.
    expect(d!.kind).toBe('pass-through');
    expect(d!.options).toHaveLength(0);
  });

  it('reordered rows still parse (order is presentation, not validity)', () => {
    const d = detectAsk({ toolResults: [adv('reordered-rows.txt')], finalText: '', ended: false })!;
    expect(d.options.map((o: any) => o.key)).toEqual(['2', '1']);
  });

  it('paraphrased labels with no engine section → pass-through chat', () => {
    const d = detectAsk({ toolResults: [], finalText: adv('paraphrased-labels.txt'), ended: false })!;
    expect(d.kind).toBe('pass-through');
    expect(d.options).toHaveLength(0);
  });

  it('two menus in one turn is VALID input — the last is the ask', () => {
    const d = detectAsk({ toolResults: [adv('two-menus-one-turn.txt')], finalText: '', ended: false })!;
    expect(d.surface).toBe('MENU: check-in gate');
    expect(d.question).toBe('The real ask?');
    expect(d.options.map((o: any) => o.key)).toEqual(['c', 'w']);
  });

  it('an auto-mode menu is context, never a card (the phantom-gate rule)', () => {
    const d = detectAsk({ toolResults: [adv('auto-mode-menu.txt')], finalText: '', ended: false });
    expect(d?.kind ?? 'none').not.toBe('menu');
    expect(d?.surface).toBeUndefined();
  });

  it('a clean session end detects nothing', () => {
    expect(detectAsk({ toolResults: [adv('two-menus-one-turn.txt')], finalText: 'done', ended: true })).toBeNull();
  });
});

describe('the real recorded transcript', () => {
  const records = fs
    .readFileSync(TRANSCRIPT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  // Only Bash tool results carrying a real section header — a Read result
  // quoting section markup in docs is never a gate source.
  const menuResults = records.filter((r: any) => r.record === 'tool-result' && /^=== MENU/m.test(r.text));

  it('every recorded engine menu section parses to a structured card', () => {
    expect(menuResults.length).toBeGreaterThanOrEqual(3);
    for (const tr of menuResults) {
      const d = detectAsk({ toolResults: [tr.text], finalText: '', ended: false });
      expect(d).not.toBeNull();
      expect(d!.source).toBe('tool-result');
      expect(d!.options.length).toBeGreaterThan(0);
    }
  });

  it('re-parsing the journal yields byte-identical gate ids (the fixture golden property)', () => {
    const ids = menuResults.map((tr: any, i: number) =>
      computeGateId('mid-discussion', i, normalizedBody(extractSections(tr.text).at(-1)!.body), sha256),
    );
    const again = menuResults.map((tr: any, i: number) =>
      computeGateId('mid-discussion', i, normalizedBody(extractSections(tr.text).at(-1)!.body), sha256),
    );
    expect(again).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
