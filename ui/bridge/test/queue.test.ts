import { describe, it, expect } from 'vitest';
import { buildQueue, stageOf } from '../src/queue.js';
import type { DurableRow } from '../src/durable.js';

const durable = (kind: DurableRow['kind'], wu: string, phase?: string): DurableRow => ({
  kind,
  address: { workUnit: wu, topic: wu, phase },
  detail: kind,
});

const fakeSessions = (gates: { id: string; kind: string; address: any; openedAt: string }[]) =>
  ({
    list: () =>
      gates.map((g, i) => ({
        bridgeSessionId: `bs-${i}`,
        openGate: {
          id: g.id,
          kind: g.kind,
          address: g.address,
          openedAt: g.openedAt,
          state: 'open',
          context: 'ctx',
          options: [],
        },
      })),
  }) as any;

describe('the needs-you queue', () => {
  it('stage maps the three D’s; addressless rows are stage 0', () => {
    expect(stageOf({})).toBe(0);
    expect(stageOf({ workUnit: 'x', phase: 'discussion' })).toBe(0);
    expect(stageOf({ workUnit: 'x', phase: 'specification' })).toBe(1);
    expect(stageOf({ workUnit: 'x', phase: 'review' })).toBe(2);
  });

  it('orders live before durable, stage ascending, oldest first', () => {
    const rows = buildQueue(
      [durable('reconcile', 'b', 'specification'), durable('triage-waiting', 'a', 'discussion')],
      fakeSessions([
        { id: 'a'.repeat(16), kind: 'menu', address: { workUnit: 'c', phase: 'implementation' }, openedAt: '2026-08-27T10:00:00Z' },
        { id: 'b'.repeat(16), kind: 'confirm', address: { workUnit: 'd', phase: 'discussion' }, openedAt: '2026-08-27T09:00:00Z' },
      ]),
      null,
    );
    expect(rows.map((r) => [r.tier, r.stage])).toEqual([
      ['live', 0],
      ['live', 2],
      ['durable', 0],
      ['durable', 1],
    ]);
    // The two live rows: stage asc beats age.
    expect(rows[0]!.kind).toBe('confirm');
  });

  it('a resolved/absent gate never rows; durable rows carry a flag, not an ask', () => {
    const rows = buildQueue([durable('spec-blocked', 'e', 'specification')], fakeSessions([]), null);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tier).toBe('durable');
    expect(rows[0]!.gateId).toBeUndefined();
    expect(rows[0]!.askPreview).toBeUndefined();
  });
});
