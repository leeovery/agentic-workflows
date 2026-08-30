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

/** An epic mid-experiment: timing's series is live, its discussion open. */
function epicManifest() {
  return {
    name: 'lab',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          timing: { routing: 'experiment', summary: 'Timing behaviour', order: 1 },
        },
      },
      experiment: {
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

/** Walk E{n} to `status` through the legal steps. */
function walkTo(dir, id, status) {
  const steps = { designed: 1, approved: 2, running: 3, concluded: 4 };
  const n = steps[status];
  if (n >= 1) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 2) engine(dir, ['experiment', 'approve', 'lab', 'timing', id]);
  if (n >= 3) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 4) engine(dir, ['experiment', 'conclude', 'lab', 'timing', id, '--verdict', 'rule held']);
}

describe('engine experiment create', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setup(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('conceives E1 with its slug and answers the record directory', () => {
    const res = engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement']);
    assert.strictEqual(res.id, 'E1');
    assert.strictEqual(res.status, 'conceived');
    assert.strictEqual(res.slug, 'window-placement');
    assert.strictEqual(res.dir, '.workflows/lab/experiment/timing/E1-window-placement');
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments,
      { E1: { slug: 'window-placement', status: 'conceived' } });
  });

  it('numbers the series per-topic: E2 after E1, whatever E1 became', () => {
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'first']);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'wrong question']);
    const res = engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'second']);
    assert.strictEqual(res.id, 'E2');
    const series = readManifest(dir, 'lab').phases.experiment.items.timing.experiments;
    assert.strictEqual(series.E1.status, 'abandoned');
    assert.strictEqual(series.E1.reason, 'wrong question');
    assert.strictEqual(series.E2.status, 'conceived');
  });

  it('refuses a non-kebab slug and a missing/terminal item', () => {
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'Bad Slug']).error, /kebab-case/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'ghost', '--slug', 'x']).error, /no experiment item "ghost"/);

    const m = readManifest(dir, 'lab');
    m.phases.experiment.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x']).error, /reopen it/);
    m.phases.experiment.items.timing.status = 'cancelled';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x']).error, /reactivate it/);
    m.phases.experiment.items.timing.status = 'triaged';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x']).error, /start the topic first/);
  });
});

describe('engine experiment advance / approve — design before data', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement']);
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
  });
});

describe('engine experiment conclude / abandon', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('conclude requires a running experiment and records the one-line verdict', () => {
    walkTo(dir, 'E1', 'approved');
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'x']).error, /only a running experiment concludes/);
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'two\nlines']).error, /one non-empty line/);
    assert.match(engineFails(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', '  ']).error, /one non-empty line/);
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'all six layouts placed correctly; adopted']);
    assert.strictEqual(res.status, 'concluded');
    assert.strictEqual(res.verdict, 'all six layouts placed correctly; adopted');
    const record = readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1;
    assert.strictEqual(record.status, 'concluded');
    assert.strictEqual(record.verdict, 'all six layouts placed correctly; adopted');
  });

  it('conclusion flags a completed same-topic discussion — evidence after the decision must surface', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'experiment');
  });

  it('abandon is legal from any pre-terminal status and keeps the row with its reason', () => {
    const res = engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'question dissolved in design']);
    assert.strictEqual(res.status, 'abandoned');
    assert.strictEqual(res.reason, 'question dissolved in design');
    const record = readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1;
    assert.strictEqual(record.status, 'abandoned');
    assert.strictEqual(record.reason, 'question dissolved in design');
    assert.match(engineFails(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'again']).error, /abandonment is terminal/);
  });
});

describe('the evidence wait — await, release edges, conclude gate', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('await records the marker on the same-topic in-progress discussion, once', () => {
    const res = engine(dir, ['experiment', 'await', 'lab', 'timing', 'E1']);
    assert.strictEqual(res.discussion, 'timing');
    assert.deepStrictEqual(res.awaiting, ['E1']);
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.awaiting_experiments, ['E1']);
    assert.match(engineFails(dir, ['experiment', 'await', 'lab', 'timing', 'E1']).error, /already awaits/);
  });

  it('await refuses a terminal record and a discussion that is not in-progress', () => {
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    assert.match(engineFails(dir, ['experiment', 'await', 'lab', 'timing', 'E1']).error, /nothing to wait for/);

    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'second']);
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'await', 'lab', 'timing', 'E2']).error, /placed mid-discussion/);
    delete m.phases.discussion.items.timing;
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'await', 'lab', 'timing', 'E2']).error, /no discussion item/);
  });

  it('a waiting discussion cannot conclude; the conclusion releases the wait and flags the entry', () => {
    engine(dir, ['experiment', 'await', 'lab', 'timing', 'E1']);
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'discussion', 'timing']).error,
      /awaits experiment evidence \(E1\)/);

    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.deepStrictEqual(res.released_wait, { discussion: 'timing', released: ['E1'], remaining: [] });
    const item = readManifest(dir, 'lab').phases.discussion.items.timing;
    assert.strictEqual(item.awaiting_experiments, undefined, 'the emptied marker is removed');
    assert.strictEqual(item.reconcile_needed, 'experiment', 'the next entry surfaces the evidence');

    engine(dir, ['manifest', 'delete', 'lab.discussion.timing', 'reconcile_needed']);
    const done = engine(dir, ['topic', 'complete', 'lab', 'discussion', 'timing']);
    assert.strictEqual(done.status, 'completed');
  });

  it('abandonment releases the wait the same way, reason on the response', () => {
    engine(dir, ['experiment', 'await', 'lab', 'timing', 'E1']);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'second']);
    engine(dir, ['experiment', 'await', 'lab', 'timing', 'E2']);
    const res = engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'harness broke']);
    assert.strictEqual(res.reason, 'harness broke');
    assert.deepStrictEqual(res.released_wait, { discussion: 'timing', released: ['E1'], remaining: ['E2'] });
    const item = readManifest(dir, 'lab').phases.discussion.items.timing;
    assert.deepStrictEqual(item.awaiting_experiments, ['E2'], 'other waits stand');
    assert.strictEqual(item.reconcile_needed, 'experiment');
  });

  it('a pending reconcile flag is never clobbered by the release', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.reconcile_needed = 'research';
    writeManifest(dir, 'lab', m);
    engine(dir, ['experiment', 'await', 'lab', 'timing', 'E1']);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'research');
  });
});

describe('the experiment phase conclude gate — the register stays truthful', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'first']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('topic complete refuses while any experiment is unfinished, naming it with its status', () => {
    walkTo(dir, 'E1', 'running');
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'experiment', 'timing']).error,
      /unfinished experiments \(E1: running\)/);
    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'second']);
    assert.match(engineFails(dir, ['topic', 'complete', 'lab', 'experiment', 'timing']).error,
      /unfinished experiments \(E2: conceived\)/);
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E2', '--reason', 'not needed']);
    const done = engine(dir, ['topic', 'complete', 'lab', 'experiment', 'timing']);
    assert.strictEqual(done.status, 'completed');
  });

  it('an item with no series concludes freely', () => {
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'lab', 'experiment', 'timing']).status, 'completed');
  });
});

describe('epic topic cancel on an experiment — the wait-release edge', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    setup(dir);
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'first']);
    engine(dir, ['experiment', 'await', 'lab', 'timing', 'E1']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('the bare cancel refuses naming the waiting discussion; --cascade releases in one transaction', () => {
    assert.match(engineFails(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing']).error,
      /releases the evidence wait on discussion "timing" \(awaiting E1\)/);
    const before = readManifest(dir, 'lab');
    assert.deepStrictEqual(before.phases.discussion.items.timing.awaiting_experiments, ['E1'], 'refusal writes nothing');
    assert.strictEqual(before.phases.experiment.items.timing.status, 'in-progress');

    const res = engine(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing', '--cascade']);
    assert.strictEqual(res.status, 'cancelled');
    assert.deepStrictEqual(res.released_wait, { discussion: 'timing', released: ['E1'], remaining: [] });
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.experiment.items.timing.status, 'cancelled');
    assert.strictEqual(after.phases.experiment.items.timing.previous_status, 'in-progress');
    assert.strictEqual(after.phases.discussion.items.timing.awaiting_experiments, undefined);
    assert.strictEqual(after.phases.discussion.items.timing.reconcile_needed, 'experiment');
  });

  it('an unawaited experiment cancels bare, stashing the discovery-map order like its siblings', () => {
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    // The abandon released the wait; a later cancel has nothing to release.
    const m = readManifest(dir, 'lab');
    delete m.phases.discussion.items.timing;
    writeManifest(dir, 'lab', m);
    const res = engine(dir, ['topic', 'cancel', 'lab', 'experiment', 'timing']);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.released_wait, undefined);
    const map = readManifest(dir, 'lab').phases.discovery.items.timing;
    assert.ok(!('order' in map), 'cancel stashes the map order');
    assert.strictEqual(map.previous_order, 1);
    engine(dir, ['topic', 'reactivate', 'lab', 'experiment', 'timing']);
    assert.strictEqual(readManifest(dir, 'lab').phases.discovery.items.timing.order, 1, 'reactivate restores it');
  });
});

describe('the staleness hop walks to the nearest downstream consumer', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a research reopen with no experiment item still flags the discussion one hop away', () => {
    writeManifest(dir, 'lab', {
      name: 'lab', work_type: 'epic', status: 'in-progress',
      phases: {
        research: { items: { timing: { status: 'completed' } } },
        discussion: { items: { timing: { status: 'completed' } } },
      },
    });
    commitAll(dir, 'init');
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'research');
  });

  it('with a completed experiment between, the hop stops there — one hop, not two', () => {
    writeManifest(dir, 'lab', {
      name: 'lab', work_type: 'epic', status: 'in-progress',
      phases: {
        research: { items: { timing: { status: 'completed' } } },
        experiment: { items: { timing: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } },
        discussion: { items: { timing: { status: 'completed' } } },
      },
    });
    commitAll(dir, 'init');
    const res = engine(dir, ['topic', 'reopen', 'lab', 'research', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'experiment', topic: 'timing' }]);
    const m = readManifest(dir, 'lab');
    assert.strictEqual(m.phases.experiment.items.timing.reconcile_needed, 'research');
    assert.strictEqual(m.phases.discussion.items.timing.reconcile_needed, undefined);
  });

  it('an experiment reopen flags the same-topic completed discussion', () => {
    writeManifest(dir, 'lab', {
      name: 'lab', work_type: 'epic', status: 'in-progress',
      phases: {
        experiment: { items: { timing: { status: 'completed', experiments: { E1: { slug: 'x', status: 'concluded', verdict: 'held' } } } } },
        discussion: { items: { timing: { status: 'completed' } } },
      },
    });
    commitAll(dir, 'init');
    const res = engine(dir, ['topic', 'reopen', 'lab', 'experiment', 'timing']);
    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'timing' }]);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, 'experiment');
  });
});

describe('experiment triage parity — queues, delivery, supersede refusal', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); setup(dir); });
  afterEach(() => { cleanupFixture(dir); });

  it('a concern parks on an unstarted experiment topic and its queue reads back', () => {
    fs.mkdirSync(path.join(dir, '.workflows/.cache/scratch'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows/.cache/scratch/concern.md'), '### Concern\n\nMeasure it.\n');
    const res = engine(dir, ['topic', 'triage', 'lab', 'experiment', 'probe',
      '--concern', '.workflows/.cache/scratch/concern.md', '--slug', 'measure-it',
      '-m', 'discussion(lab/timing): reroute concern to probe']);
    assert.strictEqual(res.status, 'triaged');
    assert.strictEqual(res.concern_path, '.workflows/lab/experiment/.triage/probe/001-measure-it.md');
    assert.ok(res.committed, 'delivery self-commits');
    const queue = engine(dir, ['topic', 'queue', 'lab', 'experiment', 'probe']);
    assert.strictEqual(queue.count, 1);
    const absorbed = engine(dir, ['topic', 'absorb', 'lab', 'experiment', 'probe',
      '--file', '001-measure-it.md', '-m', 'experiment(lab/probe): absorb 001-measure-it']);
    assert.strictEqual(absorbed.remaining, 0);
  });

  it('supersede stays illegal — the schema has no superseded experiment', () => {
    assert.match(engineFails(dir, ['topic', 'supersede', 'lab', 'experiment', 'timing', '--by', 'other']).error,
      /Invalid status "superseded" for phase "experiment"/);
  });
});
