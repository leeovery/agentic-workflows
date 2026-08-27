'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
const { computeBuildOrderNeedsSequencing, buildOrderLive } = require('../../skills/workflow-engine/scripts/domain/build-order.cjs');
const { epicDetail } = require('../../skills/workflow-engine/scripts/domain/epic-detail.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-bo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function writeManifest(dir, wu, manifest) {
  const full = path.join(dir, '.workflows', wu, 'manifest.json');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(manifest, null, 2) + '\n');
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function lastMessage(dir) {
  return git(dir, ['log', '-1', '--pretty=%s']).trim();
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}

function engine(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  return JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
}

function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

/** An epic with three live spec topics and one terminal of each flavour. */
function epicManifest() {
  return {
    name: 'portal',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discussion: {
        items: {
          auth: { status: 'completed' },
          billing: { status: 'completed' },
          reports: { status: 'completed' },
        },
      },
      specification: {
        items: {
          auth: { status: 'in-progress', sources: { auth: { status: 'incorporated' } } },
          billing: { status: 'proposed', sources: { billing: { status: 'pending' } } },
          reports: { status: 'completed', sources: { reports: { status: 'incorporated' } } },
          legacy: { status: 'superseded', sources: {} },
          parked: { status: 'cancelled', previous_status: 'in-progress', sources: {} },
        },
      },
    },
  };
}

function setupEpic(dir) {
  writeManifest(dir, 'portal', epicManifest());
  commitAll(dir, 'init');
}

describe('engine build-order sequence', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setupEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('writes the whole live set, clears the stale flag, commits scoped', () => {
    const m0 = readManifest(dir, 'portal');
    m0.phases.specification.build_order_stale = true;
    writeManifest(dir, 'portal', m0);
    commitAll(dir, 'flag');

    const res = engine(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'reports=2', 'billing=3']);
    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.ordered, { auth: 1, reports: 2, billing: 3 });
    assert.ok(res.committed, 'committed');
    assert.strictEqual(lastMessage(dir), 'specification(portal): sequence build order');

    const spec = readManifest(dir, 'portal').phases.specification;
    assert.strictEqual(spec.items.auth.order, 1);
    assert.strictEqual(spec.items.reports.order, 2);
    assert.strictEqual(spec.items.billing.order, 3);
    assert.strictEqual(spec.build_order_stale, undefined, 'stale flag cleared');
    assert.strictEqual(spec.items.legacy.order, undefined, 'terminal untouched');
  });

  it('commits the manifest alone, leaving a live peer\'s document behind', () => {
    // The sequencing pass runs from the epic entry, beside sessions holding
    // the unit's topics. It wrote the manifest and nothing else.
    fs.mkdirSync(path.join(dir, '.workflows/portal/discussion'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows/portal/discussion/auth.md'), '# Discussion — Auth\n');
    commitAll(dir, 'a peer topic');
    fs.writeFileSync(path.join(dir, '.workflows/portal/discussion/auth.md'), '# Discussion — Auth\nhalf a turn\n');

    engine(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'reports=2', 'billing=3']);

    assert.deepStrictEqual(
      git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean),
      ['.workflows/portal/manifest.json']);
    assert.deepStrictEqual(
      git(dir, ['status', '--porcelain']).split('\n').filter(Boolean),
      [' M .workflows/portal/discussion/auth.md'], 'the peer keeps its dirt');
  });

  it('completed topics are live — they keep a number', () => {
    engine(dir, ['build-order', 'sequence', 'portal', 'reports=1', 'auth=2', 'billing=3']);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.items.reports.order, 1);
  });

  it('refuses a partial assignment, naming the missing topics', () => {
    const err = engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2']);
    assert.match(err.error, /missing: reports/);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.items.auth.order, undefined, 'nothing written');
  });

  it('refuses a terminal topic', () => {
    const err = engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2', 'reports=3', 'parked=4']);
    assert.match(err.error, /"parked" is cancelled — terminal topics carry no build order/);
  });

  it('refuses a non-contiguous permutation', () => {
    const err = engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2', 'reports=4']);
    assert.match(err.error, /contiguous 1\.\.3 permutation/);
  });

  it('refuses a duplicate order value', () => {
    const err = engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=1', 'reports=2']);
    assert.match(err.error, /contiguous/);
  });

  it('refuses an unknown topic, a double assignment, and bad pairs', () => {
    assert.match(engineFails(dir, ['build-order', 'sequence', 'portal', 'ghost=1']).error, /no specification item "ghost"/);
    assert.match(engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'auth=2']).error, /assigned twice/);
    assert.match(engineFails(dir, ['build-order', 'sequence', 'portal', 'auth=0']).error, /bad assignment/);
    assert.match(engineFails(dir, ['build-order', 'sequence', 'portal']).error, /Usage/);
  });

  it('refuses a non-epic work unit', () => {
    writeManifest(dir, 'feat', {
      name: 'feat', work_type: 'feature', status: 'in-progress',
      phases: { specification: { items: { feat: { status: 'in-progress' } } } },
    });
    commitAll(dir, 'feat');
    assert.match(engineFails(dir, ['build-order', 'sequence', 'feat', 'feat=1']).error, /epic-only/);
  });

  it('refuses when no live specification topics exist', () => {
    writeManifest(dir, 'empty', { name: 'empty', work_type: 'epic', status: 'in-progress', phases: {} });
    commitAll(dir, 'empty');
    assert.match(engineFails(dir, ['build-order', 'sequence', 'empty', 'x=1']).error, /no live specification topics/);
  });
});

// The caller computes an order from a read, then asks the engine to write it.
// Between those two moments a peer session can move the live set — a spec
// completed, a topic cancelled, a grouping added. The whole re-check runs
// inside the manifest lock's read-modify-write, so a write computed against a
// set that has since moved is refused, never silently applied.
describe('sequence re-checks the live set it writes against', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setupEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  /** The caller's compute step: read, derive the live set, propose 1..N. */
  function computeOrders(dir) {
    const items = readManifest(dir, 'portal').phases.specification.items;
    const orders = {};
    Object.entries(items)
      .filter(([, item]) => buildOrderLive(item))
      .forEach(([name], i) => { orders[name] = i + 1; });
    return orders;
  }

  const asArgs = (orders) => Object.entries(orders).map(([t, n]) => `${t}=${n}`);

  it('refuses a write whose live set gained a topic after the compute', () => {
    const computed = computeOrders(dir);
    // A peer's grouping analysis lands a new proposed topic.
    const m = readManifest(dir, 'portal');
    m.phases.specification.items.notifications = { status: 'proposed', sources: {} };
    writeManifest(dir, 'portal', m);

    const err = engineFails(dir, ['build-order', 'sequence', 'portal', ...asArgs(computed)]);
    assert.match(err.error, /missing: notifications/);
    const after = readManifest(dir, 'portal').phases.specification;
    assert.ok(Object.values(after.items).every((i) => i.order === undefined), 'nothing was written');
  });

  it('refuses a write whose live set lost a topic after the compute', () => {
    const computed = computeOrders(dir);
    // A peer cancels one of the topics the caller numbered.
    const m = readManifest(dir, 'portal');
    m.phases.specification.items.billing.status = 'cancelled';
    m.phases.specification.items.billing.previous_status = 'proposed';
    writeManifest(dir, 'portal', m);

    const err = engineFails(dir, ['build-order', 'sequence', 'portal', ...asArgs(computed)]);
    assert.match(err.error, /"billing" is cancelled — terminal topics carry no build order/);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.items.auth.order, undefined, 'nothing was written');
  });

  it('a flag raised after the pass wrote is not swallowed by it', () => {
    const m0 = readManifest(dir, 'portal');
    m0.phases.specification.build_order_stale = true;
    writeManifest(dir, 'portal', m0);

    engine(dir, ['build-order', 'sequence', 'portal', ...asArgs(computeOrders(dir))]);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.build_order_stale, undefined,
      'the flag this pass read is the flag it clears');

    // A completion landing after that hold sets the flag again; the finished
    // pass cannot have cleared a flag it never read.
    engine(dir, ['topic', 'complete', 'portal', 'specification', 'auth']);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.build_order_stale, true,
      'the later completion still asks for a re-sequence');
  });

  it('a status change that leaves the set intact still applies', () => {
    const computed = computeOrders(dir);
    // in-progress → completed keeps a topic live: same membership, same write.
    engine(dir, ['topic', 'complete', 'portal', 'specification', 'auth']);

    const res = engine(dir, ['build-order', 'sequence', 'portal', ...asArgs(computed)]);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.items.auth.order, computed.auth);
  });
});

describe('sequence idempotence', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setupEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('re-sequencing the same orders notes nothing to commit', () => {
    engine(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2', 'reports=3']);
    const res = engine(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2', 'reports=3']);
    assert.strictEqual(res.committed, null);
    assert.match(res.note || '', /nothing to commit/);
  });
});

describe('build_order_stale — set by spec completion, epic-only', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setupEpic(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('completing an epic specification sets the flag', () => {
    engine(dir, ['topic', 'complete', 'portal', 'specification', 'auth']);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.build_order_stale, true);
  });

  it('completing a feature specification does not', () => {
    writeManifest(dir, 'feat', {
      name: 'feat', work_type: 'feature', status: 'in-progress',
      phases: { specification: { items: { feat: { status: 'in-progress', sources: { feat: { status: 'incorporated' } } } } } },
    });
    commitAll(dir, 'feat');
    engine(dir, ['topic', 'complete', 'feat', 'specification', 'feat']);
    assert.strictEqual(readManifest(dir, 'feat').phases.specification.build_order_stale, undefined);
  });

  it('completing another epic phase does not', () => {
    const m = readManifest(dir, 'portal');
    m.phases.discussion.items.extra = { status: 'in-progress' };
    writeManifest(dir, 'portal', m);
    commitAll(dir, 'extra');
    engine(dir, ['topic', 'complete', 'portal', 'discussion', 'extra']);
    assert.strictEqual(readManifest(dir, 'portal').phases.specification.build_order_stale, undefined);
  });
});

describe('spec-side order stash on cancel / restore on reactivate', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setupEpic(dir);
    engine(dir, ['build-order', 'sequence', 'portal', 'auth=1', 'billing=2', 'reports=3']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('a direct spec cancel stashes the order; reactivate restores it', () => {
    engine(dir, ['topic', 'cancel', 'portal', 'specification', 'auth']);
    let auth = readManifest(dir, 'portal').phases.specification.items.auth;
    assert.strictEqual(auth.order, undefined);
    assert.strictEqual(auth.previous_order, 1);

    engine(dir, ['topic', 'reactivate', 'portal', 'specification', 'auth']);
    auth = readManifest(dir, 'portal').phases.specification.items.auth;
    assert.strictEqual(auth.order, 1);
    assert.strictEqual(auth.previous_order, undefined);
  });

  it('a taken number is not restored — the stash drops and the flag flips', () => {
    engine(dir, ['topic', 'cancel', 'portal', 'specification', 'auth']);
    // Live set renumbered contiguously while auth was out — billing now holds 1.
    engine(dir, ['build-order', 'sequence', 'portal', 'billing=1', 'reports=2']);
    engine(dir, ['topic', 'reactivate', 'portal', 'specification', 'auth']);

    const m = readManifest(dir, 'portal');
    const items = m.phases.specification.items;
    assert.strictEqual(items.auth.order, undefined, 'stale number not restored over billing');
    assert.strictEqual(items.auth.previous_order, undefined, 'stash dropped');
    assert.strictEqual(items.billing.order, 1, 'no collision');
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), true, 'flag catches the unordered live topic');
  });

  it('a terminal sibling squatting on the number does not veto the restore', () => {
    engine(dir, ['topic', 'cancel', 'portal', 'specification', 'auth']);
    engine(dir, ['topic', 'supersede', 'portal', 'specification', 'reports', '--by', 'billing']);
    const m0 = readManifest(dir, 'portal');
    m0.phases.specification.items.reports.order = 1;
    writeManifest(dir, 'portal', m0);
    commitAll(dir, 'squat');

    engine(dir, ['topic', 'reactivate', 'portal', 'specification', 'auth']);
    const items = readManifest(dir, 'portal').phases.specification.items;
    assert.strictEqual(items.auth.order, 1, 'restored over the terminal squatter');
  });

  it('a discussion cancel cascading into a spec stashes the spec order too', () => {
    // auth spec is in-progress and sources the auth discussion — cascade path.
    const res = engine(dir, ['topic', 'cancel', 'portal', 'discussion', 'auth', '--cascade']);
    assert.strictEqual(res.ok, true);
    const auth = readManifest(dir, 'portal').phases.specification.items.auth;
    assert.strictEqual(auth.status, 'cancelled');
    assert.strictEqual(auth.order, undefined);
    assert.strictEqual(auth.previous_order, 1);
  });
});

describe('computeBuildOrderNeedsSequencing / buildOrderLive', () => {
  it('false with no specification topics at all', () => {
    assert.strictEqual(computeBuildOrderNeedsSequencing({ work_type: 'epic', phases: {} }), false);
  });

  it('true when a live topic lacks an order', () => {
    const m = { phases: { specification: { items: { a: { status: 'in-progress', order: 1 }, b: { status: 'proposed' } } } } };
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), true);
  });

  it('false when every live topic is ordered — terminal topics need none', () => {
    const m = { phases: { specification: { items: {
      a: { status: 'in-progress', order: 1 },
      b: { status: 'completed', order: 2 },
      c: { status: 'cancelled' },
      d: { status: 'superseded' },
      e: { status: 'promoted' },
    } } } };
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), false);
  });

  it('true on the stale flag even with every topic ordered', () => {
    const m = { phases: { specification: { build_order_stale: true, items: { a: { status: 'completed', order: 1 } } } } };
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), true);
  });

  it('buildOrderLive excludes exactly the terminal statuses', () => {
    for (const status of ['proposed', 'in-progress', 'completed']) {
      assert.strictEqual(buildOrderLive({ status }), true, status);
    }
    for (const status of ['cancelled', 'superseded', 'promoted']) {
      assert.strictEqual(buildOrderLive({ status }), false, status);
    }
  });
});


describe('EpicDetail sorts the build phases by order', () => {
  it('spec entries sort by their own order; planning and implementation join by name; unordered trail in insertion order', () => {
    const m = {
      name: 'portal', work_type: 'epic', status: 'in-progress',
      phases: {
        specification: {
          items: {
            zeta: { status: 'completed', order: 3 },
            auth: { status: 'completed', order: 1 },
            mid: { status: 'completed', order: 2 },
            stray: { status: 'in-progress' },
          },
        },
        planning: { items: { zeta: { status: 'completed' }, auth: { status: 'in-progress' } } },
        implementation: { items: { zeta: { status: 'in-progress' }, auth: { status: 'in-progress' } } },
      },
    };
    const d = epicDetail('/nonexistent', m);
    assert.deepStrictEqual(d.phases.specification.map((e) => e.name), ['auth', 'mid', 'zeta', 'stray']);
    assert.deepStrictEqual(d.phases.planning.map((e) => e.name), ['auth', 'zeta']);
    assert.deepStrictEqual(d.phases.implementation.map((e) => e.name), ['auth', 'zeta']);
  });

  it('next_phase_ready start entries inherit the order', () => {
    const m = {
      name: 'portal', work_type: 'epic', status: 'in-progress',
      phases: {
        specification: {
          items: {
            zeta: { status: 'completed', order: 2 },
            auth: { status: 'completed', order: 1 },
          },
        },
        planning: { items: { zeta: { status: 'completed' }, auth: { status: 'completed' } } },
      },
    };
    const d = epicDetail('/nonexistent', m);
    const impls = d.next_phase_ready.filter((n) => n.action === 'start_implementation').map((n) => n.name);
    assert.deepStrictEqual(impls, ['auth', 'zeta'], 'the recommendation scan meets the lowest order first');
  });
});

describe('the spec tree trails terminal residue too', () => {
  it('a superseded spec with an inert number sorts after the live rows', () => {
    const m = {
      name: 'portal', work_type: 'epic', status: 'in-progress',
      phases: {
        specification: {
          items: {
            legacy: { status: 'superseded', order: 1 },
            live: { status: 'completed', order: 1 },
          },
        },
      },
    };
    const d = epicDetail('/nonexistent', m);
    assert.deepStrictEqual(d.phases.specification.map((e) => e.name), ['live', 'legacy']);
  });
});

describe('the sort join ignores terminal residue', () => {
  it('a superseded spec keeping a stale number cannot seat a live plan', () => {
    const m = {
      name: 'portal', work_type: 'epic', status: 'in-progress',
      phases: {
        specification: {
          items: {
            auth: { status: 'completed', order: 1 },
            legacy: { status: 'superseded', order: 1 },
          },
        },
        planning: { items: { legacy: { status: 'completed' }, auth: { status: 'completed' } } },
      },
    };
    const d = epicDetail('/nonexistent', m);
    assert.deepStrictEqual(d.phases.planning.map((e) => e.name), ['auth', 'legacy'],
      'the live spec order wins; the terminal twin trails unordered');
  });
});

describe('EpicDetail carries the flag', () => {
  it('the detail exposes build_order_needs_sequencing', () => {
    const m = epicManifest();
    m.phases.specification.items.auth.order = 2;
    m.phases.specification.items.billing.order = 1;
    m.phases.specification.items.reports.order = 3;
    const d = epicDetail('/nonexistent', m);
    assert.strictEqual(d.build_order_needs_sequencing, false);

    delete m.phases.specification.items.billing.order;
    assert.strictEqual(epicDetail('/nonexistent', m).build_order_needs_sequencing, true);
  });
});

describe('the flag reads the whole invariant back', () => {
  const base = () => ({
    phases: { specification: { items: {
      a: { status: 'in-progress', order: 1 },
      b: { status: 'completed', order: 2 },
      c: { status: 'proposed', order: 3 },
    } } },
  });

  it('a contiguous 1..N permutation is quiet', () => {
    assert.strictEqual(computeBuildOrderNeedsSequencing(base()), false);
  });

  it('a duplicate number flips it', () => {
    const m = base();
    m.phases.specification.items.c.order = 2;
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), true);
  });

  it('a hole flips it — the state a spec cancel leaves', () => {
    const m = base();
    m.phases.specification.items.b.status = 'cancelled';
    delete m.phases.specification.items.b.order;
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), true, 'live set {1,3} is not contiguous');
  });

  it('terminal residue with a stale number never counts', () => {
    const m = base();
    m.phases.specification.items.d = { status: 'superseded', order: 2 };
    assert.strictEqual(computeBuildOrderNeedsSequencing(m), false);
  });
});
