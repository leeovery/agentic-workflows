import { describe, it, expect } from 'vitest';
import { DomainEvent, GateCard, BridgeConfig, JournalRecord, FixtureMeta } from '../src/index.js';

const base = {
  id: 'a'.repeat(16),
  epoch: 'e1',
  ts: '2026-08-26T10:00:00Z',
  project: 'demo',
  address: { workUnit: 'auth-flow' },
};

describe('DomainEvent envelope', () => {
  it('accepts a durable event with seq and no live flag', () => {
    const e = DomainEvent.parse({
      ...base,
      seq: 4,
      type: 'phase.completed',
      payload: { phase: 'discussion', topic: 'auth-flow' },
    });
    expect(e.type).toBe('phase.completed');
  });

  it('accepts a live event with live:true and no seq', () => {
    const e = DomainEvent.parse({
      ...base,
      live: true,
      type: 'presence.changed',
      payload: { rows: [] },
    });
    expect(e.live).toBe(true);
  });

  it('rejects a live event carrying seq (live events are never sequence-numbered)', () => {
    expect(() =>
      DomainEvent.parse({
        ...base,
        live: true,
        seq: 9,
        type: 'presence.changed',
        payload: { rows: [] },
      }),
    ).toThrow();
  });

  it('rejects a durable event without seq', () => {
    expect(() =>
      DomainEvent.parse({
        ...base,
        type: 'phase.completed',
        payload: { phase: 'discussion', topic: 'auth-flow' },
      }),
    ).toThrow();
  });

  it('rejects an unknown type', () => {
    expect(() =>
      DomainEvent.parse({ ...base, seq: 1, type: 'nope.event', payload: {} }),
    ).toThrow();
  });

  it('rejects a malformed id', () => {
    expect(() =>
      DomainEvent.parse({
        ...base,
        id: 'not-hex',
        seq: 1,
        type: 'commit.landed',
        payload: { sha: 'abc', subject: 's', scope: [] },
      }),
    ).toThrow();
  });
});

describe('GateCard', () => {
  const card = {
    id: 'b'.repeat(16),
    kind: 'menu',
    source: 'tool-result',
    session: { bridgeSessionId: 'bs1', askOrdinal: 0 },
    address: { workUnit: 'auth-flow', topic: 'auth-flow', phase: 'discussion' },
    surface: 'MENU: discussion',
    context: 'ctx',
    options: [
      { key: '1', label: 'Continue', recommended: true, form: 'cmd' },
      { key: '2', label: 'Park', recommended: false, form: 'cmd' },
    ],
    freeText: true,
    confirm: 'tap',
    openedAt: '2026-08-26T10:00:00Z',
    state: 'open',
  };

  it('accepts a valid structured card', () => {
    expect(GateCard.parse(card).kind).toBe('menu');
  });

  it('rejects two recommended options', () => {
    expect(() =>
      GateCard.parse({
        ...card,
        options: card.options.map((o) => ({ ...o, recommended: true })),
      }),
    ).toThrow();
  });

  it('rejects a tool-result structured card without a surface name', () => {
    expect(() => GateCard.parse({ ...card, surface: undefined })).toThrow();
  });

  it('allows a tool-result pass-through without a surface', () => {
    expect(
      GateCard.parse({ ...card, surface: undefined, kind: 'pass-through', options: [] }).kind,
    ).toBe('pass-through');
  });
});

describe('BridgeConfig', () => {
  it('applies defaults including the width pin and quiet hours', () => {
    const c = BridgeConfig.parse({});
    expect(c.displayWidth).toBe(65);
    expect(c.notifications.quietHours.start).toBe('22:00');
    expect(c.port).toBe(4870);
  });
});

describe('Journal records', () => {
  it('parses each record shape', () => {
    const lines = [
      { record: 'meta', bridgeSessionId: 'bs1', width: 65, entryPrompt: '/workflow-start', recordedAt: 't' },
      { record: 'assistant', text: 'hello' },
      { record: 'tool-use', tool: 'Bash', input: { command: 'ls' } },
      { record: 'tool-result', text: '=== MENU: discussion (STOP) ===' },
      { record: 'user', text: '2' },
      { record: 'usage', inputTokens: 10, outputTokens: 5 },
      { record: 'turn-end', turn: 1 },
      { record: 'result', outcome: 'completed' },
    ];
    for (const l of lines) expect(JournalRecord.parse(l).record).toBe(l.record);
  });

  it('accepts turn-end with an ask marker', () => {
    const t = JournalRecord.parse({
      record: 'turn-end',
      turn: 3,
      ask: { gateId: 'c'.repeat(16), kind: 'menu' },
    });
    expect(t.record === 'turn-end' && t.ask?.kind).toBe('menu');
  });
});

describe('FixtureMeta', () => {
  it('parses the spec-4 layout with moment↔world pairing', () => {
    const m = FixtureMeta.parse({
      productVersion: 'v0.7.13',
      recordedAt: 't',
      width: 65,
      entryPrompt: '/workflow-start',
      description: 'mid-discussion',
      moments: [{ gateId: 'd'.repeat(16), world: '0' }],
    });
    expect(m.moments).toHaveLength(1);
  });
});
