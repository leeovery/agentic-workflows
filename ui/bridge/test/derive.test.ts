import { describe, it, expect } from 'vitest';
import { deriveEvents, type Ctx } from '../src/derive.js';
import type { Snapshot } from '../src/snapshot.js';

const ctx: Ctx = { project: 'demo', epoch: 'e', ts: '2026-08-26T10:00:00Z', disc: 'sha1' };

function snap(partial: Partial<Snapshot>): Snapshot {
  return { registry: null, units: {}, artifacts: {}, triage: {}, inbox: {}, ...partial };
}

function unit(manifest: Record<string, unknown>) {
  return { manifest };
}

describe('deriveEvents — the EVENTS.md table', () => {
  it('emits workunit.created when a unit appears', () => {
    const next = snap({ units: { 'auth-flow': unit({ work_type: 'feature', status: 'in-progress' }) } });
    const events = deriveEvents(snap({}), next, ctx);
    const e = events.find((x) => x.type === 'workunit.created');
    expect(e?.payload).toEqual({ workType: 'feature', name: 'auth-flow' });
    expect(e?.address.workUnit).toBe('auth-flow');
  });

  it('emits workunit.status-changed on status diff', () => {
    const prev = snap({ units: { a: unit({ status: 'in-progress' }) } });
    const next = snap({ units: { a: unit({ status: 'completed' }) } });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'workunit.status-changed');
    expect(e?.payload).toEqual({ from: 'in-progress', to: 'completed' });
  });

  it('emits workunit.removed with an absorb successor (epic topic appearing in the same diff)', () => {
    const prev = snap({
      units: {
        feat: unit({ work_type: 'feature', status: 'in-progress' }),
        epic1: unit({ work_type: 'epic', phases: { discussion: { items: {} } } }),
      },
    });
    const next = snap({
      units: {
        epic1: unit({ work_type: 'epic', phases: { discussion: { items: { feat: { status: 'in-progress' } } } } }),
      },
    });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'workunit.removed');
    expect(e?.payload.successor).toBe('epic1/feat');
  });

  it('emits phase.completed when an item reaches completed, phase.item-changed otherwise', () => {
    const prev = snap({
      units: { e1: unit({ phases: { discussion: { items: { t1: { status: 'in-progress' }, t2: { status: 'pending' } } } } }) },
    });
    const next = snap({
      units: { e1: unit({ phases: { discussion: { items: { t1: { status: 'completed' }, t2: { status: 'in-progress' } } } } }) },
    });
    const events = deriveEvents(prev, next, ctx);
    const done = events.find((x) => x.type === 'phase.completed');
    expect(done?.payload).toEqual({ phase: 'discussion', topic: 't1' });
    const changed = events.find((x) => x.type === 'phase.item-changed');
    expect(changed?.payload).toEqual({ phase: 'discussion', topic: 't2', from: 'pending', to: 'in-progress' });
  });

  it('reopen → recomplete yields DISTINCT ids (occurrence-unique via +sha)', () => {
    const completedSnap = snap({ units: { e1: unit({ phases: { discussion: { items: { t1: { status: 'completed' } } } } }) } });
    const reopenedSnap = snap({ units: { e1: unit({ phases: { discussion: { items: { t1: { status: 'in-progress' } } } } }) } });
    const first = deriveEvents(reopenedSnap, completedSnap, { ...ctx, disc: 'sha-A' }).find((x) => x.type === 'phase.completed');
    const second = deriveEvents(reopenedSnap, completedSnap, { ...ctx, disc: 'sha-B' }).find((x) => x.type === 'phase.completed');
    expect(first?.id).not.toBe(second?.id);
  });

  it('emits flag.input-moved / flag.cleared for reconcile_needed', () => {
    const prev = snap({ units: { e1: unit({ phases: { specification: { items: { t1: { status: 'completed' } } } } }) } });
    const next = snap({
      units: { e1: unit({ phases: { specification: { items: { t1: { status: 'completed', reconcile_needed: 'discussion' } } } } }) },
    });
    const moved = deriveEvents(prev, next, ctx).find((x) => x.type === 'flag.input-moved');
    expect(moved?.payload).toEqual({ phase: 'specification', topic: 't1', kind: 'reconcile', upstream: 'discussion' });
    const cleared = deriveEvents(next, prev, ctx).find((x) => x.type === 'flag.cleared');
    expect(cleared?.payload).toMatchObject({ kind: 'reconcile' });
  });

  it('emits source.state-changed and stale-source flags for source rows', () => {
    const prev = snap({
      units: {
        e1: unit({
          phases: { specification: { items: { spec1: { status: 'in-progress', sources: { d1: { status: 'incorporated' } } } } } },
        }),
      },
    });
    const next = snap({
      units: {
        e1: unit({
          phases: { specification: { items: { spec1: { status: 'in-progress', sources: { d1: { status: 'stale' } } } } } },
        }),
      },
    });
    const events = deriveEvents(prev, next, ctx);
    expect(events.find((x) => x.type === 'source.state-changed')?.payload).toEqual({
      topic: 'spec1',
      source: 'd1',
      to: 'stale',
    });
    expect(events.find((x) => x.type === 'flag.input-moved')?.payload).toMatchObject({ kind: 'stale-source', upstream: 'd1' });
  });

  it('emits consult-reference state changes', () => {
    const prev = snap({
      units: {
        e1: unit({
          phases: { specification: { items: { s: { consult_references: { other: { status: 'pending' } } } } } },
        }),
      },
    });
    const next = snap({
      units: {
        e1: unit({
          phases: { specification: { items: { s: { consult_references: { other: { status: 'addressed' } } } } } },
        }),
      },
    });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'source.state-changed');
    expect(e?.payload).toEqual({ topic: 's', source: 'other', to: 'addressed' });
  });

  it('emits buildorder.changed from order-field diffs', () => {
    const prev = snap({
      units: { e1: unit({ phases: { specification: { items: { a: { order: 1 }, b: { order: 2 } } } } }) },
    });
    const next = snap({
      units: { e1: unit({ phases: { specification: { items: { a: { order: 2 }, b: { order: 1 } } } } }) },
    });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'buildorder.changed');
    expect(e?.payload.ordering).toEqual([
      { topic: 'b', order: 1 },
      { topic: 'a', order: 2 },
    ]);
  });

  it('emits derived.spec-blocked from engine-attached derived views, never re-derived', () => {
    const prev = snap({ units: { e1: { manifest: {}, derived: { specBlocked: [], depBlocked: [] } } } });
    const next = snap({
      units: { e1: { manifest: {}, derived: { specBlocked: [{ name: 's1', by: ['d1'] }], depBlocked: [] } } },
    });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'derived.spec-blocked');
    expect(e?.payload).toEqual({ topic: 's1', holders: ['d1'] });
  });

  it('emits artifact.updated with path.hash discriminant (content-idempotent)', () => {
    const prev = snap({});
    const next = snap({ artifacts: { 'e1/discussion/t1.md': 'h1' } });
    const a = deriveEvents(prev, next, { ...ctx, disc: 'sha-A' }).find((x) => x.type === 'artifact.updated');
    const b = deriveEvents(prev, next, { ...ctx, disc: 'sha-B' }).find((x) => x.type === 'artifact.updated');
    expect(a?.id).toBe(b?.id); // discriminant is path.hash, no commit sha
    expect(a?.payload).toEqual({ path: 'e1/discussion/t1.md', hash: 'h1' });
  });

  it('emits triage.changed for queue listing diffs and for triaged stubs', () => {
    const prev = snap({});
    const next = snap({ triage: { 'e1/discussion/t1': 2 } });
    const e = deriveEvents(prev, next, ctx).find((x) => x.type === 'triage.changed');
    expect(e?.payload).toEqual({ phase: 'discussion', topic: 't1', count: 2 });
    expect(e?.address).toEqual({ workUnit: 'e1', topic: 't1', phase: 'discussion' });
  });

  it('emits inbox.changed and roadmap.changed', () => {
    const prev = snap({ inbox: { ideas: 1 }, registry: { roadmap: { items: { x: {} } } } });
    const next = snap({ inbox: { ideas: 2 }, registry: { roadmap: { items: { x: {}, y: {} } } } });
    const events = deriveEvents(prev, next, ctx);
    expect(events.find((x) => x.type === 'inbox.changed')?.payload).toEqual({ counts: { ideas: 2 } });
    expect(events.find((x) => x.type === 'roadmap.changed')?.payload).toEqual({ items: 2 });
  });

  it('marks live events live and never durable ones', () => {
    const next = snap({ units: { a: unit({ work_type: 'feature' }) } });
    const durable = deriveEvents(snap({}), next, ctx);
    const live = deriveEvents(snap({}), next, { ...ctx, live: true, disc: 'nonce-1' });
    expect(durable.every((e) => e.live === undefined)).toBe(true);
    expect(live.every((e) => e.live === true)).toBe(true);
  });

  it('is silent on identical snapshots', () => {
    const s = snap({ units: { a: unit({ status: 'in-progress', phases: { discussion: { items: { a: { status: 'in-progress' } } } } }) } });
    expect(deriveEvents(s, s, ctx)).toEqual([]);
  });
});
