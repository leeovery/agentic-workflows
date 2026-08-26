import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { convertTranscript } from '../src/convert.js';
import { JournalRecord } from '@workflow-ui/shared';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeSession(lines: unknown[]): string {
  const p = path.join(dir, 'session.jsonl');
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return p;
}

describe('convertTranscript', () => {
  it('maps a Claude Code session to journal records with correct turn accounting', () => {
    const p = writeSession([
      { type: 'user', timestamp: 't1', message: { role: 'user', content: '/workflow-start' } },
      {
        type: 'assistant',
        timestamp: 't2',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Booting.' },
            { type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'engine boot' } },
          ],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
      },
      {
        type: 'user',
        timestamp: 't3',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '=== MENU: start (STOP) ===\nrows' }] },
      },
      {
        type: 'assistant',
        timestamp: 't4',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Pick an option.' }] },
      },
      { type: 'user', timestamp: 't5', message: { role: 'user', content: '2' } },
      {
        type: 'assistant',
        timestamp: 't6',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Continuing.' }] },
      },
    ]);
    const journal = convertTranscript(p, {
      bridgeSessionId: 'bs1',
      width: 65,
      entryPrompt: '/workflow-start',
      productVersion: 'v0.7.13',
    });

    // Every record validates against the shared journal schema.
    for (const rec of journal) expect(() => JournalRecord.parse(rec)).not.toThrow();

    const kinds = journal.map((r: any) => r.record);
    expect(kinds[0]).toBe('meta');
    expect(kinds).toContain('tool-use');
    expect(kinds).toContain('tool-result');
    expect(kinds.filter((k: string) => k === 'user')).toHaveLength(2); // tool results are NOT user turns
    expect(kinds[kinds.length - 1]).toBe('result');

    // Tool result text arrives verbatim (demarcated sections preserved).
    const tr: any = journal.find((r: any) => r.record === 'tool-result');
    expect(tr.text).toContain('=== MENU: start (STOP) ===');
    expect(tr.tool).toBe('Bash');

    // turn-end closes the first turn before the second user record.
    const idxUser2 = journal.findIndex((r: any) => r.record === 'user' && r.text === '2');
    const before = journal[idxUser2 - 1] as any;
    expect(before.record).toBe('turn-end');
    expect(before.turn).toBe(1);
  });

  it('skips sidechain records', () => {
    const p = writeSession([
      { type: 'user', message: { role: 'user', content: 'main' } },
      { type: 'assistant', isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: 'sub' }] } },
    ]);
    const journal = convertTranscript(p, { bridgeSessionId: 'bs1', width: 65, entryPrompt: 'x' });
    expect(journal.some((r: any) => r.text === 'sub')).toBe(false);
  });
});
