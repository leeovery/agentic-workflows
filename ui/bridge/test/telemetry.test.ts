import { describe, it, expect } from 'vitest';
import { buildTelemetry } from '../src/telemetry.js';
import { parseFrontmatter, readLocalMarkdownDag } from '../src/plan-dag.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ev = (type: string, payload: any): any => ({ type, payload, address: {}, id: 'x', seq: 0, epoch: 'e', ts: 't', project: 'p' });

describe('loop telemetry — manifest-sourced', () => {
  const manifest = {
    phases: {
      implementation: {
        items: {
          't1': {
            status: 'in-progress',
            current_phase: 2,
            current_task: 'add-delay',
            completed_phases: ['1'],
            completed_tasks: ['t1-1-1'],
            consolidation_gate_mode: 'gated',
            bank: [{ opportunity: 'x' }],
            // The real shape: staging.{cycle}.tasks.{n} = decision.
            staging: { c1: { tasks: { '1': 'approved' } } },
            consolidated_phases: ['1'],
          },
        },
      },
    },
  };

  it('maps every datum to its manifest field per the source inventory', () => {
    const t = buildTelemetry(
      'wu',
      't1',
      manifest,
      [{ topic: 'other', reason: 'unmet' }],
      [ev('commit.landed', { sha: 'deadbeefcafe', subject: 'feat: x', scope: ['wu'] })],
      2,
    )!;
    expect(t.status).toBe('in-progress');
    expect(t.currentPhase).toBe('2');
    expect(t.currentTask).toBe('add-delay');
    expect(t.completedPhases).toEqual(['1']);
    expect(t.consolidation.gated).toBe(true);
    expect(t.consolidation.bank).toHaveLength(1);
    expect(t.consolidation.staging.c1).toEqual([{ task: '1', decision: 'approved' }]);
    expect(t.depBlocked).toEqual([{ topic: 'other', reason: 'unmet' }]);
    expect(t.commitsLanded[0]!.subject).toBe('feat: x');
    expect(t.agentsActive).toBe(2);
  });

  it('current_phase "~" (none) reads as null; auto gate mode is not gated', () => {
    const m = { phases: { implementation: { items: { t: { status: 'in-progress', current_phase: '~', consolidation_gate_mode: 'auto' } } } } };
    const t = buildTelemetry('wu', 't', m, [], [], 0)!;
    expect(t.currentPhase).toBeNull();
    expect(t.consolidation.gated).toBe(false);
  });

  it('returns null for a topic with no implementation item', () => {
    expect(buildTelemetry('wu', 'nope', manifest, [], [], 0)).toBeNull();
  });
});

describe('plan DAG — local-markdown', () => {
  it('parses task frontmatter (id/phase/status/priority/depends_on)', () => {
    const fm = parseFrontmatter('---\nid: t-1-2\nphase: 1\nstatus: pending\npriority: 2\ndepends_on:\n  - t-1-1\n  - t-1-0\n---\n# Title\n');
    expect(fm).toMatchObject({ id: 't-1-2', phase: '1', status: 'pending', priority: '2' });
    expect(fm.depends_on).toEqual(['t-1-1', 't-1-0']);
  });

  it('reads a task directory into the lowest-common-denominator model', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-'));
    const tdir = path.join(dir, '.workflows', 'wu', 'planning', 'wu', 'tasks');
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'wu-1-1.md'), '---\nid: wu-1-1\nphase: 1\nstatus: completed\n---\n# First task\n');
    fs.writeFileSync(path.join(tdir, 'wu-1-2.md'), '---\nid: wu-1-2\nphase: 1\nstatus: pending\ndepends_on:\n  - wu-1-1\n---\n# Second task\n');
    try {
      const tasks = readLocalMarkdownDag(dir, 'wu', 'wu');
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({ id: 'wu-1-1', title: 'First task', status: 'completed' });
      expect(tasks[1]!.dependsOn).toEqual(['wu-1-1']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
