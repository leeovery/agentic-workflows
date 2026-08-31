'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-exp-'));
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

/** An epic with timing's research and discussion both open — either can spawn. */
function epicManifest() {
  return {
    name: 'lab',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          timing: { routing: 'discussion', summary: 'Timing behaviour', order: 1 },
        },
      },
      research: {
        items: {
          timing: { status: 'in-progress' },
        },
      },
      discussion: {
        items: {
          timing: { status: 'in-progress' },
        },
      },
    },
  };
}

function setup(dir) {
  writeManifest(dir, 'lab', epicManifest());
  commitAll(dir, 'init');
}

/** Spawn E{next} from the named phase. */
function spawn(dir, from, slug) {
  return engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', slug, '--from', from]);
}

/** Walk an id to `status` through the legal steps. */
function walkTo(dir, id, status) {
  const steps = { designed: 1, approved: 2, running: 3, concluded: 4 };
  const n = steps[status];
  if (n >= 1) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 2) engine(dir, ['experiment', 'approve', 'lab', 'timing', id]);
  if (n >= 3) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 4) engine(dir, ['experiment', 'conclude', 'lab', 'timing', id, '--verdict', 'rule held']);
}

describe('engine experiment create — the spawn', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setup(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('conceives E1, opens the item, and locks the spawning discussion', () => {
    const res = spawn(dir, 'discussion', 'window-placement');
    assert.strictEqual(res.id, 'E1');
    assert.strictEqual(res.status, 'conceived');
    assert.strictEqual(res.slug, 'window-placement');
    assert.strictEqual(res.dir, '.workflows/lab/experiment/timing/E1-window-placement');
    assert.deepStrictEqual(res.awaiting, { phase: 'discussion', ids: ['E1'] });
    const m = readManifest(dir, 'lab');
    assert.strictEqual(m.phases.experiment.items.timing.status, 'in-progress', 'the spawn opens the item');
    assert.deepStrictEqual(m.phases.experiment.items.timing.experiments,
      { E1: { slug: 'window-placement', status: 'conceived' } });
    assert.deepStrictEqual(m.phases.discussion.items.timing.awaiting_experiments, ['E1']);
    assert.strictEqual(m.phases.research.items.timing.awaiting_experiments, undefined,
      'the lock lands on the spawning phase alone');
  });

  it('locks a research spawn identically — the phases are symmetric', () => {
    const res = spawn(dir, 'research', 'window-placement');
    assert.deepStrictEqual(res.awaiting, { phase: 'research', ids: ['E1'] });
    const m = readManifest(dir, 'lab');
    assert.deepStrictEqual(m.phases.research.items.timing.awaiting_experiments, ['E1']);
    assert.strictEqual(m.phases.discussion.items.timing.awaiting_experiments, undefined);
  });

  it('numbers the series per-topic: E2 after E1, whatever E1 became', () => {
    spawn(dir, 'discussion', 'first');
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'wrong question']);
    const res = spawn(dir, 'research', 'second');
    assert.strictEqual(res.id, 'E2');
    const series = readManifest(dir, 'lab').phases.experiment.items.timing.experiments;
    assert.strictEqual(series.E1.status, 'abandoned');
    assert.strictEqual(series.E1.reason, 'wrong question');
    assert.strictEqual(series.E2.status, 'conceived');
  });

  it('a spawn onto a completed series reopens it — the item is derived bookkeeping', () => {
    spawn(dir, 'discussion', 'first');
    walkTo(dir, 'E1', 'concluded');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.status, 'completed');
    const res = spawn(dir, 'discussion', 'second');
    assert.strictEqual(res.id, 'E2');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.status, 'in-progress');
  });

  it('refuses a bad slug, a bad or missing origin, and a spawner that cannot hold the lock', () => {
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'Bad Slug', '--from', 'discussion']).error, /kebab-case/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x']).error, /exactly one of --from/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--parent', 'E1']).error, /exactly one of --from/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'planning']).error, /--from must be one of research\|discussion/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'ghost', '--slug', 'x', '--from', 'discussion']).error, /no discussion item "ghost" to spawn from/);

    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion']).error,
      /discussion "timing" is completed — only an in-progress discussion spawns/);
  });

  it('refuses a spawn onto a cancelled item — reactivate is the recovery', () => {
    spawn(dir, 'discussion', 'first');
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    engine(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing']);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion']).error,
      /cancelled — reactivate it instead/);
  });
});

describe('engine experiment advance / approve — design before data', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('walks conceived → designed → approved → running, one deliberate freeze in the middle', () => {
    const designed = engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    assert.strictEqual(designed.status, 'designed');
    assert.strictEqual(designed.previous, 'conceived');
    const approved = engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']);
    assert.strictEqual(approved.status, 'approved');
    const running = engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    assert.strictEqual(running.status, 'running');
    assert.strictEqual(running.previous, 'approved');
  });

  it('advance never crosses the freeze: designed routes to approve, running to conclude/abandon', () => {
    walkTo(dir, 'E1', 'designed');
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']).error, /experiment approve/);
    engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']).error, /conclude it with its verdict/);
  });

  it('approve takes only a designed experiment', () => {
    assert.match(engineFails(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']).error, /only a designed experiment/);
    walkTo(dir, 'E1', 'running');
    assert.match(engineFails(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']).error, /only a designed experiment/);
  });

  it('terminal records refuse every further transition', () => {
    walkTo(dir, 'E1', 'concluded');
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']).error, /verdict stands/);
    assert.match(engineFails(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']).error, /verdict stands/);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'x']).error, /verdict stands/);
    assert.match(engineFails(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'x']).error, /verdict stands/);
  });

  it('unknown ids and malformed ids refuse loudly', () => {
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'timing', 'E9']).error, /no experiment E9/);
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'timing', 'X1']).error, /invalid experiment id/);
    assert.match(engineFails(dir, ['experiment', 'advance', 'lab', 'ghost', 'E1']).error, /no experiment series for "ghost"/);
  });
});

describe('engine experiment conclude / abandon — the release edges', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('conclude requires a running experiment and a one-line verdict, then settles the item', () => {
    walkTo(dir, 'E1', 'approved');
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'x']).error, /only a running experiment concludes/);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'two\nlines']).error, /one non-empty line/);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', '  ']).error, /one non-empty line/);
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'all six layouts placed correctly; adopted']);
    assert.strictEqual(res.status, 'concluded');
    assert.strictEqual(res.verdict, 'all six layouts placed correctly; adopted');
    assert.strictEqual(res.item_status, 'completed', 'the last record closes the item');
    const item = readManifest(dir, 'lab').phases.experiment.items.timing;
    assert.strictEqual(item.status, 'completed');
    assert.strictEqual(item.experiments.E1.verdict, 'all six layouts placed correctly; adopted');
  });

  it('the conclusion releases the wait and flags the spawning item for its next entry', () => {
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    const item = readManifest(dir, 'lab').phases.discussion.items.timing;
    assert.strictEqual(item.awaiting_experiments, undefined, 'the emptied lock is removed');
    assert.strictEqual(item.reconcile_needed, 'experiment', 'the next entry surfaces the evidence');
    const done = engine(dir, ['topic', 'complete', 'lab', 'discussion', 'timing']);
    assert.strictEqual(done.status, 'completed', 'the released conversation can conclude');
  });

  it('a waiting conversation cannot conclude — research and discussion identically', () => {
    spawn(dir, 'research', 'second');
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'discussion', 'timing']).error,
      /discussion "timing" awaits experiment evidence \(E1\)/);
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'research', 'timing']).error,
      /research "timing" awaits experiment evidence \(E2\)/);
  });

  it('conclusion flags a completed same-topic discussion — evidence after the decision must surface', () => {
    // A research-spawned experiment under a decided discussion: the release
    // flags the waiting research; the one-hop flag reaches the discussion.
    setup(dir);
    spawn(dir, 'research', 'late-evidence');
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.discussion.items.timing.reconcile_needed, 'experiment');
    assert.strictEqual(after.phases.research.items.timing.reconcile_needed, 'experiment', 'the release flagged the spawner too');
  });

  it('abandon keeps the row with its reason, releases the wait, and never hops downstream', () => {
    setup(dir);
    spawn(dir, 'research', 'late-evidence');
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    const res = engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'question dissolved in design']);
    assert.strictEqual(res.status, 'abandoned');
    assert.strictEqual(res.reason, 'question dissolved in design');
    assert.deepStrictEqual(res.released_waits, [{ phase: 'research', released: ['E1'], remaining: [] }]);
    assert.strictEqual(res.reconcile_flagged, undefined, 'no evidence landed — nothing hops downstream');
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.experiment.items.timing.experiments.E1.reason, 'question dissolved in design');
    assert.strictEqual(after.phases.research.items.timing.reconcile_needed, 'experiment', 'the waiting point reverts to open, surfaced at re-entry');
    assert.strictEqual(after.phases.discussion.items.timing.reconcile_needed, undefined, 'an abandonment never flags the decided record');
    assert.match(engineFails(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'again']).error, /abandonment is terminal/);
  });

  it('releasing one wait leaves the others standing', () => {
    spawn(dir, 'discussion', 'second');
    const res = engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'harness broke']);
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: ['E2'] }]);
    const item = readManifest(dir, 'lab').phases.discussion.items.timing;
    assert.deepStrictEqual(item.awaiting_experiments, ['E2'], 'the other wait stands');
    assert.strictEqual(res.item_status, 'in-progress', 'a live record keeps the item open');
  });

  it('a pending reconcile flag is never clobbered by the release', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.reconcile_needed = 'research';
    writeManifest(dir, 'lab', m);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'research');
  });
});

describe('splits — sub-experiments under a running parent', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('creates E1.1 under a running E1, nested in the parent record — no lock moves', () => {
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'single-monitor', '--parent', 'E1']);
    assert.strictEqual(res.id, 'E1.1');
    assert.strictEqual(res.parent, 'E1');
    assert.strictEqual(res.dir, '.workflows/lab/experiment/timing/E1-window-placement/E1.1-single-monitor');
    const second = engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'multi-monitor', '--parent', 'E1']);
    assert.strictEqual(second.id, 'E1.2');
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.awaiting_experiments, ['E1'],
      'the lock stays on the parent');
  });

  it('a split needs a running top-level parent', () => {
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--parent', 'E1']).error,
      /only a running experiment discovers its question decomposes/);
    walkTo(dir, 'E1', 'running');
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1']);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--parent', 'E1.1']).error,
      /a split never splits again/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--parent', 'E9']).error,
      /no experiment E9/);
  });

  it('a sub walks the same lifecycle in miniature; its terminal moves release nothing', () => {
    walkTo(dir, 'E1', 'running');
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'single-monitor', '--parent', 'E1']);
    walkTo(dir, 'E1.1', 'designed');
    engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1.1']);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1.1']);
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1.1', '--verdict', 'placed correctly']);
    assert.strictEqual(res.status, 'concluded');
    assert.strictEqual(res.released_waits, undefined, 'the lock is the parent\'s to release');
    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(res.item_status, 'in-progress', 'the parent still runs');
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.awaiting_experiments, ['E1']);
  });

  it('the parent refuses to end over live subs; once they settle it concludes and releases once', () => {
    walkTo(dir, 'E1', 'running');
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'single-monitor', '--parent', 'E1']);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'multi-monitor', '--parent', 'E1']);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'x']).error,
      /live sub-experiments \(E1\.1: conceived, E1\.2: conceived\) — its verdict synthesises them/);
    assert.match(engineFails(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'x']).error,
      /live sub-experiments/);
    walkTo(dir, 'E1.1', 'designed');
    engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1.1']);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1.1']);
    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1.1', '--verdict', 'held']);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1.2', '--reason', 'covered by E1.1']);
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'both parts held; adopted']);
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.strictEqual(res.item_status, 'completed', 'parent + subs all terminal closes the item');
  });
});

describe('the experiment item is derived bookkeeping — no hand lifecycle', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setup(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('topic start / complete / reopen refuse the experiment phase', () => {
    assert.match(engineFails(dir, ['topic', 'start', 'lab', 'experiment', 'timing']).error,
      /the spawn creates and reopens it \(experiment create\)/);
    spawn(dir, 'discussion', 'first');
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'experiment', 'timing']).error,
      /the item closes itself when the last record ends/);
    walkTo(dir, 'E1', 'concluded');
    assert.match(engineFails(dir, ['topic', 'reopen', 'lab', 'experiment', 'timing']).error,
      /a new spawn reopens the series/);
  });

  it('supersede stays illegal — the schema has no superseded experiment', () => {
    assert.match(engineFails(dir, ['topic', 'supersede', 'lab', 'experiment', 'timing', '--by', 'other']).error,
      /Invalid status "superseded" for phase "experiment"/);
  });

  it('triage never touches the phase — no triaged status, no queue', () => {
    assert.match(engineFails(dir, ['topic', 'triage', 'lab', 'experiment', 'timing']).error,
      /Invalid status "triaged" for phase "experiment"/);
    assert.match(engineFails(dir, ['topic', 'queue', 'lab', 'experiment', 'timing']).error,
      /research\|discussion\|investigation only/);
  });
});

describe('epic topic cancel on the experiments — the wait-release edge', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    spawn(dir, 'discussion', 'first');
    spawn(dir, 'research', 'second');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('the bare cancel refuses naming every waiting conversation; --cascade releases in one transaction', () => {
    assert.match(engineFails(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing']).error,
      /its research awaits E2; its discussion awaits E1/);
    const before = readManifest(dir, 'lab');
    assert.deepStrictEqual(before.phases.discussion.items.timing.awaiting_experiments, ['E1'], 'refusal writes nothing');
    assert.strictEqual(before.phases.experiment.items.timing.status, 'in-progress');

    const res = engine(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing', '--cascade']);
    assert.strictEqual(res.status, 'cancelled');
    assert.deepStrictEqual(res.released_waits, [
      { phase: 'research', released: ['E2'], remaining: [] },
      { phase: 'discussion', released: ['E1'], remaining: [] },
    ]);
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.experiment.items.timing.status, 'cancelled');
    assert.strictEqual(after.phases.experiment.items.timing.previous_status, 'in-progress');
    assert.strictEqual(after.phases.discussion.items.timing.awaiting_experiments, undefined);
    assert.strictEqual(after.phases.research.items.timing.reconcile_needed, 'experiment');
    assert.strictEqual(after.phases.discussion.items.timing.reconcile_needed, 'experiment');
  });

  it('an unawaited cancel proceeds bare, and reactivate restores the derived status', () => {
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E2', '--reason', 'moot']);
    const res = engine(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing']);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.released_waits, undefined);
    const map = readManifest(dir, 'lab').phases.discovery.items.timing;
    assert.strictEqual(map.order, 1, 'the map order belongs to the conversations, not the laboratory');
    const back = engine(dir, ['topic', 'reactivate', 'lab', 'experiment', 'timing']);
    assert.strictEqual(back.status, 'completed', 'reactivate restores the derived status');
  });
});

describe('the staleness hop walks to the nearest downstream consumer', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {object} phases */
  function world(phases) {
    writeManifest(dir, 'lab', { name: 'lab', work_type: 'epic', status: 'in-progress', phases });
    commitAll(dir, 'init');
  }

  it('a research reopen with no experiment item still flags the discussion one hop away', () => {
    world({
      research: { items: { timing: { status: 'completed' } } },
      discussion: { items: { timing: { status: 'completed' } } },
    });
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'research');
  });

  it('with a completed experiment between, the hop stops there — one hop, not two', () => {
    world({
      research: { items: { timing: { status: 'completed' } } },
      experiment: { items: { timing: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } },
      discussion: { items: { timing: { status: 'completed' } } },
    });
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'experiment', topic: 'timing' }]);
    const m = readManifest(dir, 'lab');
    assert.strictEqual(m.phases.experiment.items.timing.reconcile_needed, 'research');
    assert.strictEqual(m.phases.discussion.items.timing.reconcile_needed, undefined);
  });

  it('an item the flag cannot land on is walked past — an in-progress series never shadows the discussion', () => {
    world({
      research: { items: { timing: { status: 'completed' } } },
      experiment: { items: { timing: { status: 'in-progress', experiments: { E1: { slug: 'x', status: 'running' } } } } },
      discussion: { items: { timing: { status: 'completed' } } },
    });
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
  });

  it('the walk ends at discussion — a specification is never reached over an absent record', () => {
    world({
      research: { items: { timing: { status: 'completed' } } },
      specification: { items: { timing: { status: 'completed', sources: {} } } },
    });
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.strictEqual(res.reconcile_flagged, undefined, 'no consumer before the boundary — nothing is flagged');
    assert.strictEqual(readManifest(dir, 'lab').phases.specification.items.timing.reconcile_needed, undefined);
  });
});

describe('the field surface guards the series exactly as the verbs write it', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('takes valid leaf repairs and refuses off-vocabulary values', () => {
    engine(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.status', 'designed']);
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1.status, 'designed');
    engine(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.slug', 'renamed-slug']);
    engine(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.verdict', 'one line']);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.status', 'done']).error,
      /Invalid experiment status "done"/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.slug', 'Bad Slug']).error,
      /Must be kebab-case/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.reason', 'two\nlines']).error,
      /one non-empty line/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.X1.status', 'running']).error,
      /invalid experiment id "X1"/);
  });

  it('refuses wholesale and unknown-field writes — the container is vocabulary-guarded', () => {
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments', '{}']).error,
      /guarded state container/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1', '{"status":"running"}']).error,
      /"experiments\.E1" is a record — write its leaf fields/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.notes', 'x']).error,
      /Invalid experiment field "E1\.notes"/);
    assert.match(engineFails(dir, ['manifest', 'push', 'lab.experiment.timing', 'experiments.E1.status', 'x']).error,
      /guarded state container/);
  });

  it('refuses the dotted sub-id shape the path grammar cannot address', () => {
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.1.status', 'running']).error,
      /sub-experiment records key by their dotted id \("E1\.1"\)/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E1.1', '{}']).error,
      /sub-experiment records key by their dotted id/);
  });

  it('guards the lock: top-level ids only, on set and push alike', () => {
    engine(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '["E1","E2"]']);
    engine(dir, ['manifest', 'push', 'lab.research.timing', 'awaiting_experiments', 'E3']);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '["E1.1"]']).error,
      /the lock is only ever the parent id/);
    assert.match(engineFails(dir, ['manifest', 'push', 'lab.discussion.timing', 'awaiting_experiments', 'nope']).error,
      /Invalid awaiting_experiments/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '"E1"']).error,
      /Must be an array/);
  });
});

describe('presence rides the experiment verbs mechanically', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setup(dir); });
  afterEach(() => { cleanupFixture(dir); });

  const presenceFile = (phase) => path.join(dir, '.workflows/.cache/lab', phase, 'timing/presence');

  it('the spawn beats the spawning conversation; the walk beats the laboratory; the close releases it', () => {
    spawn(dir, 'discussion', 'window-placement');
    assert.ok(fs.existsSync(presenceFile('discussion')), 'the spawn is the conversation acting on its own item');
    assert.ok(!fs.existsSync(presenceFile('experiment')), 'no laboratory session exists yet');
    walkTo(dir, 'E1', 'running');
    assert.ok(fs.existsSync(presenceFile('experiment')), 'the walk is the laboratory working its topic');
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1']);
    walkTo(dir, 'E1.1', 'designed');
    engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1.1']);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1.1']);
    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1.1', '--verdict', 'held']);
    assert.ok(fs.existsSync(presenceFile('experiment')), 'a sub\'s close is not the session\'s end');
    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'held']);
    assert.ok(!fs.existsSync(presenceFile('experiment')), 'the top-level close releases the slot');
  });
});
