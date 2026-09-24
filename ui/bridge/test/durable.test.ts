import { describe, it, expect } from 'vitest';
import { durableRows, durableCounts } from '../src/durable.js';
import type { Snapshot } from '../src/snapshot.js';

function snap(units: Snapshot['units'], triage: Record<string, number> = {}): Snapshot {
  return { registry: null, units, artifacts: {}, triage, inbox: {} };
}

describe('durableRows', () => {
  it('one staleness hop = one row: reconcile_needed suppresses the same item’s stale sources', () => {
    const rows = durableRows(
      snap({
        e1: {
          manifest: {
            phases: {
              specification: {
                items: {
                  t1: {
                    status: 'completed',
                    reconcile_needed: 'discussion',
                    sources: { t1: { status: 'stale' } },
                  },
                },
              },
            },
          },
        },
      }),
      '/nonexistent',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('reconcile');
  });

  it('stale sources on an unflagged item still count', () => {
    const rows = durableRows(
      snap({
        e1: {
          manifest: {
            phases: {
              specification: { items: { t1: { status: 'in-progress', sources: { d1: { status: 'stale' } } } } },
            },
          },
        },
      }),
      '/nonexistent',
    );
    expect(rows.map((r) => r.kind)).toEqual(['stale-source']);
  });

  it('engine-derived blocks and triage keys each yield rows; counts group by unit', () => {
    const rows = durableRows(
      snap(
        {
          e1: {
            manifest: { phases: {} },
            derived: { specBlocked: [{ name: 's1', by: ['d1'] }], depBlocked: [{ name: 'p1', holders: ['s2'] }] },
          },
        },
        { 'e1/discussion/t2': 2 },
      ),
      '/nonexistent',
    );
    expect(rows.map((r) => r.kind).sort()).toEqual(['dep-blocked-plan', 'spec-blocked', 'triage-waiting']);
    expect(durableCounts(rows)).toEqual({ e1: 3 });
  });
});
