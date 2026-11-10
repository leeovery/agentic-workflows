'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover, format } = require('../../skills/leeway-bridge/scripts/gateway.cjs');

const GATEWAY = path.resolve(__dirname, '../../skills/leeway-bridge/scripts/gateway.cjs');

describe('leeway-bridge discovery', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns error for missing manifest', () => {
    const r = discover(dir, 'nonexistent');
    assert.ok(r.error);
  });

  it('returns basic feature state', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.work_unit, 'auth');
    assert.strictEqual(r.work_type, 'feature');
    assert.strictEqual(r.next_phase, 'specification');
    assert.strictEqual(r.phases.discussion.status, 'completed');
  });

  it('detects file existence', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    createFile(dir, '.leeway/auth/topics/auth/log.md', '# Discussion');
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.phases.specification.exists, false);
  });

  it('finds an experiment by a record in a topic\'s own folder, and none in the old phase folder', () => {
    createManifest(dir, 'pay', { work_type: 'feature', phases: { discussion: { items: { pay: { status: 'in-progress' } } } } });
    createFile(dir, '.leeway/pay/topics/pay/log.md', '# Pay');
    createFile(dir, '.leeway/pay/experiment/pay/E1-window/problem.md', '# Problem');
    assert.strictEqual(discover(dir, 'pay').phases.experiment.exists, false);
    createFile(dir, '.leeway/pay/topics/pay/experiments/E1-window/problem.md', '# Problem');
    assert.strictEqual(discover(dir, 'pay').phases.experiment.exists, true);
  });

  it('returns done for completed pipeline', () => {
    createManifest(dir, 'done', {
      work_type: 'feature',
      phases: {
        discussion: { items: { done: { status: 'completed' } } },
        specification: { items: { done: { status: 'completed' } } },
        planning: { items: { done: { status: 'completed' } } },
        implementation: { items: { done: { status: 'completed' } } },
        review: { items: { done: { status: 'completed' } } },
      },
    });
    const r = discover(dir, 'done');
    assert.strictEqual(r.next_phase, 'done');
  });

  it('a conversation paused on experiment evidence routes the bridge to the experiment', () => {
    createManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        experiment: { items: { pay: { status: 'in-progress', experiments: { E1: { slug: 'window', status: 'conceived' } } } } },
        discussion: { items: { pay: { status: 'in-progress', awaiting_experiments: ['E1'] } } },
      },
    });
    assert.strictEqual(discover(dir, 'pay').next_phase, 'experiment');
  });

  it('computes next_phase for epic same as other types', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: { 'auth-design': { status: 'completed' }, 'data-model': { status: 'in-progress' } },
        },
      },
    });
    const r = discover(dir, 'v1');
    assert.strictEqual(r.next_phase, 'discussion');
    assert.strictEqual(r.epic_detail, undefined);
  });

  it('computes bugfix pipeline correctly', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'completed' } } } },
    });
    const r = discover(dir, 'crash');
    assert.strictEqual(r.next_phase, 'specification');
  });

  it('detects all phase file types', () => {
    createManifest(dir, 'full', {
      work_type: 'feature',
      phases: {
        discussion: { items: { full: { status: 'completed' } } },
        specification: { items: { full: { status: 'completed' } } },
        implementation: { items: { full: { status: 'completed' } } },
        review: { items: { full: { status: 'completed' } } },
      },
    });
    createFile(dir, '.leeway/full/topics/full/log.md', '');
    createFile(dir, '.leeway/full/spec.md', '');
    const r = discover(dir, 'full');
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.phases.specification.exists, true);
    assert.strictEqual(r.phases.implementation.exists, true);
  });

  it('detects implementation existence from manifest not files', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'completed' } } },
        implementation: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.implementation.exists, true);
  });

  it('returns status from manifest', () => {
    createManifest(dir, 'auth', { work_type: 'feature', status: 'in-progress' });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.status, 'in-progress');
  });

  it('detects the investigation by its log', () => {
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: { investigation: { items: { crash: { status: 'in-progress' } } } },
    });
    createFile(dir, '.leeway/crash/topics/crash/log.md', '# Investigation');
    const r = discover(dir, 'crash');
    assert.strictEqual(r.phases.investigation.exists, true);
    assert.strictEqual(r.phases.investigation.status, 'in-progress');
  });

  it('ignores flat phase status (returns null)', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { status: 'completed' } },
    });
    const r = discover(dir, 'auth');
    assert.strictEqual(r.phases.discussion.status, 'none');
    assert.strictEqual(r.next_phase, 'discussion');
  });

  it('epic returns phases and next_phase without epic_detail', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: {
            'exploration': { status: 'completed' },
            'architecture': { status: 'in-progress' },
          },
        },
      },
    });
    createFile(dir, '.leeway/v1/topics/exploration/log.md', '# Exploration');
    const r = discover(dir, 'v1');
    assert.strictEqual(r.epic_detail, undefined);
    assert.strictEqual(r.phases.discussion.exists, true);
    assert.strictEqual(r.work_type, 'epic');
  });
});

describe('leeway-bridge format', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('returns error string for missing manifest', () => {
    const out = format(discover(dir, 'nonexistent'));
    assert.ok(out.startsWith('Error: '));
  });

  it('fresh feature pins the full dump byte-exactly — no revisit section', () => {
    createManifest(dir, 'auth', { work_type: 'feature' });
    const out = format(discover(dir, 'auth'));
    assert.strictEqual(out, [
      '=== auth (feature) ===',
      'next_phase: discussion',
      'completed_phases: (none)',
      'revisitable_phases: (none)',
      'next_route: /leeway-discussion-process feature auth',
      'revisit_routes: (none)',
      '',
    ].join('\n'));
  });

  it('a unit built under the old plan pins the full dump byte-exactly — no route into its build, nothing to revisit (P12)', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: {
        discussion: { items: { auth: { status: 'completed' } } },
        specification: { items: { auth: { status: 'completed' } } },
        planning: { items: { auth: { status: 'completed' } } },
        implementation: { items: { auth: { status: 'in-progress' } } },
      },
    });
    const out = format(discover(dir, 'auth'));
    assert.strictEqual(out, [
      '=== auth (feature) ===',
      'next_phase: implementation',
      'completed_phases: discussion, specification',
      'revisitable_phases: (none)',
      'next_route: (none)',
      'revisit_routes: (none)',
      '',
    ].join('\n'));
  });

  it('a build by its cut routes into the build, then into its review phase, with nothing to revisit and no completing past its review (24.1.6, 14.6.1)', () => {
    const cut = { phases: [{ name: 'One', scenarios: [], sections: ['1'], relies_on: [] }] };
    const built = { work_type: 'feature', build: { position: 'auto' }, cut, phases: { discussion: { items: { auth: { status: 'completed' } } } } };
    const dump = (next, completed) => [
      '=== auth (feature) ===',
      `next_phase: ${next}`,
      `completed_phases: ${completed}`,
      'revisitable_phases: (none)',
      `next_route: /leeway-${next}-process feature auth`,
      'revisit_routes: (none)',
      '',
    ].join('\n');
    createManifest(dir, 'auth', built);
    assert.strictEqual(format(discover(dir, 'auth')), dump('implementation', 'discussion, specification'));
    createManifest(dir, 'auth', { ...built, checklists: { 'phase-1-close': { items: {}, closed: '2026-11-01T00:00:00.000Z' } } });
    assert.strictEqual(format(discover(dir, 'auth')), dump('review', 'discussion, specification, implementation'));
  });

  it('completed pipeline reports next_phase done — nothing revisitable, no section', () => {
    createManifest(dir, 'rename-api', {
      work_type: 'quick-fix',
      phases: {
        planning: { items: { 'rename-api': { status: 'completed' } } },
        implementation: { items: { 'rename-api': { status: 'completed' } } },
        review: { items: { 'rename-api': { status: 'completed' } } },
      },
    });
    const out = format(discover(dir, 'rename-api'));
    assert.strictEqual(out, [
      '=== rename-api (quick-fix) ===',
      'next_phase: done',
      'completed_phases: implementation, review',
      'revisitable_phases: (none)',
      'next_route: (none)',
      'revisit_routes: (none)',
      '',
    ].join('\n'));
  });

  it('a quick-fix routes into its own skill, and into its review once the person asked for it at its close, revisiting nothing (19.5.14)', () => {
    const dumpOf = (/** @type {object} */ fixes) => {
      createManifest(dir, 'rename-api', { work_type: 'quick-fix', fixes });
      return format(discover(dir, 'rename-api')).split('\n').filter((line) => /^(next_phase|revisitable_phases|next_route): /.test(line));
    };
    const began = '2026-06-03T09:00:00Z';

    assert.deepStrictEqual([dumpOf({ began }), dumpOf({ began, review_asked: '2026-06-03T10:00:00Z' })], [
      ['next_phase: implementation', 'revisitable_phases: (none)', 'next_route: /leeway-quick-fix-process quick-fix rename-api'],
      ['next_phase: review', 'revisitable_phases: (none)', 'next_route: /leeway-review-process quick-fix rename-api'],
    ]);
  });

  it('epic dump carries no revisitable line, no routes and no section', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { 'auth-design': { status: 'completed' } } } },
    });
    const out = format(discover(dir, 'v1'));
    assert.ok(!out.includes('revisitable_phases'));
    assert.ok(!out.includes('_route'));
    assert.ok(!out.includes('MENU: revisit phases'));
  });

  it('a bugfix\'s routes name the skill each phase is entered through — the concluded spec never a revisit', () => {
    const investigated = { work_type: 'bugfix', phases: { investigation: { items: { stall: { status: 'completed' } } } } };
    createManifest(dir, 'stall', investigated);
    const concluded = format(discover(dir, 'stall'));
    createManifest(dir, 'stall', { ...investigated, build: { position: 'auto' }, cut: { phases: [{ name: 'One', scenarios: [], sections: ['1'], relies_on: [] }] } });
    const built = format(discover(dir, 'stall'));

    assert.match(concluded, /^next_route: \/leeway-specification-process bugfix stall$/m);
    assert.match(concluded, /^revisit_routes: \/leeway-investigation-process bugfix stall$/m);
    assert.match(built, /^next_route: \/leeway-implementation-process bugfix stall$/m);
    assert.match(built, /^revisit_routes: \(none\)$/m);
  });

  it('carries no per-phase status or file-existence lines — completed_phases is the surface', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const out = format(discover(dir, 'auth'));
    assert.ok(!out.includes('(no files)'));
    assert.ok(!out.includes('  discussion:'));
    assert.ok(!out.includes(': none'));
  });
});

describe('leeway-bridge gateway script', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const run = (/** @type {string[]} */ args) => spawnSync('node', [GATEWAY, ...args], { cwd: dir, encoding: 'utf8' });

  it('with no work unit, prints its usage on stderr and exits 1', () => {
    const res = run([]);
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stderr, 'Error: work unit name required\nUsage: gateway.cjs <work_unit>\n');
    assert.strictEqual(res.stdout, '');
  });

  it('with a work unit, prints its dump', () => {
    createManifest(dir, 'auth', {
      work_type: 'feature',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    });
    const res = run(['auth']);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, format(discover(dir, 'auth')));
  });
});
