'use strict';

// ---------------------------------------------------------------------------
// The experiment series (leeway-engine/scripts/domain/experiment.cjs,
// `engine experiment create|advance|approve|conclude|abandon`, with
// domain/experiment-question.cjs): the spawn from a discussion, measuring a
// question on its map it must name, and its lock,
// the records in the topic's folder (4.11.15), the walk to verdict, splits,
// the release edges, the question on the map an experiment measures and the
// report that reaches as a message the topic that question stands on once it
// has left the spawning topic's open questions, its relative links rebased
// (9.1.11), the topic's cancel, and the field surface's guards.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there, built once and copied:
// the lab, its spawning discussion's map holding the questions spawns
// measure; and the lab with nothing asked, for the map's own tests.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { cleanupFixture, commitAll, ok: engine, refuses: engineFails, refusedPristine, lastMessage, statePath, layout, withFrozenClock, stateGit, output, fixtureFrom } = harness;

const setupGitFixture = () => harness.setupGitFixture('engine-exp-');

function writeManifest(dir, wu, manifest) {
  const full = path.join(dir, '.leeway', wu, 'manifest.json');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(manifest, null, 2) + '\n');
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', wu, 'manifest.json'), 'utf8'));
}

/** An epic with timing's discussion open — the discussion spawns. */
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

/** Write a problem scratch into the cache and return its project-relative path. */
function problemScratch(dir, slug) {
  const rel = `.leeway/.cache/lab/scratch/${slug}-problem.md`;
  fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `# Problem — ${slug}\n`);
  return rel;
}

const SESSION = { CLAUDE_CODE_SESSION_ID: 'session-1' };
const MADE = { by: 'claude', who_moved_whom: 'none' };

/** A question asked on timing's map: its short id. */
function asked(dir, text) {
  return engine(dir, ['ledger', 'ask', 'lab.discussion.timing'], { env: SESSION, stdin: JSON.stringify({ ...MADE, text }) }).id;
}

/** The questions the lab world asks on timing's map, by short id: as many as one test spawns. @type {string[]} */
let measurable = [];

/** The lab, built once: its manifest committed, and the questions spawns measure asked. */
const labWorld = fixtureFrom('engine-exp-', (dir) => {
  setup(dir);
  measurable = ['Where does a new window open?', 'How big is a new window?', 'Which window stacks on top?', 'Which monitor takes it?'].map((text) => asked(dir, text));
});

/** The lab with nothing asked, built once. */
const plainWorld = fixtureFrom('engine-exp-plain-', setup);

/** Spawn E{next} from the named phase, measuring the lab's first question no experiment measures yet. */
function spawn(dir, from, slug) {
  const items = readManifest(dir, 'lab').phases.experiment?.items ?? {};
  const taken = Object.values(items).flatMap((item) => Object.values(item.experiments ?? {}).map((record) => record.question));
  const question = measurable.find((short) => !taken.some((full) => full?.startsWith(short)));
  return engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', slug, '--from', from, '--problem', problemScratch(dir, slug), '--question', question]);
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
  beforeEach(() => { dir = labWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  it('conceives E1, opens the item, installs the problem statement, and locks the spawning discussion', () => {
    const res = spawn(dir, 'discussion', 'window-placement');
    assert.strictEqual(res.id, 'E1');
    assert.strictEqual(res.status, 'conceived');
    assert.strictEqual(res.slug, 'window-placement');
    assert.strictEqual(res.dir, statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement')));
    assert.deepStrictEqual(res.awaiting, { phase: 'discussion', ids: ['E1'] });
    const m = readManifest(dir, 'lab');
    assert.strictEqual(m.phases.experiment.items.timing.status, 'in-progress', 'the spawn opens the item');
    const { question, ...record } = m.phases.experiment.items.timing.experiments.E1;
    assert.deepStrictEqual(record, { slug: 'window-placement', status: 'conceived' });
    assert.ok(question.startsWith(res.question), 'the record keeps the question it measures');
    assert.deepStrictEqual(m.phases.discussion.items.timing.awaiting_experiments, ['E1']);
    assert.strictEqual(fs.readFileSync(path.join(res.dir, 'problem.md'), 'utf8'),
      '# Problem — window-placement\n', 'the create installs the problem statement in the same transaction');
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/lab/scratch/window-placement-problem.md')),
      'the scratch is consumed');
  });

  it('numbers the series per-topic: E2 after E1, whatever E1 became', () => {
    spawn(dir, 'discussion', 'first');
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'wrong question']);
    const res = spawn(dir, 'discussion', 'second');
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
    const scratch = () => problemScratch(dir, 'x');
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'Bad Slug', '--from', 'discussion', '--problem', scratch()]).error, /kebab-case/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x']).error, /exactly one of --from/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--parent', 'E1']).error, /exactly one of --from/);
    for (const from of ['research', 'planning']) {
      assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', from, '--problem', scratch()]).error, /--from must be one of discussion —/);
    }
    const mapped = readManifest(dir, 'lab');
    mapped.phases.discovery.items.ghost = { routing: 'discussion', summary: 'Ghost windows', order: 2 };
    writeManifest(dir, 'lab', mapped);
    const homeless = asked(dir, 'Where does a ghost window open?');
    engine(dir, ['ledger', 'move', 'lab.discussion.timing', '--question', homeless, '--to', 'ghost'], { env: SESSION, stdin: JSON.stringify(MADE) });
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'ghost', '--slug', 'x', '--from', 'discussion', '--problem', scratch(), '--question', homeless]).error, /no discussion item "ghost" to spawn from/);

    const placement = asked(dir, 'Where does a new window open?');
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', scratch(), '--question', placement]).error,
      /discussion "timing" is completed — only an in-progress discussion spawns/);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.cache/lab/scratch/x-problem.md')),
      'a refused spawn leaves the problem scratch intact — nothing consumed, nothing conceived');
  });

  it('the problem statement and the question measured are required, the problem cache-confined, and neither rides a split', () => {
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion']).error,
      /--problem <file> is required on a spawn/);
    assert.strictEqual(refusedPristine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', problemScratch(dir, 'x')]).error,
      '--question <id> is required on a spawn — an experiment measures an open question on the topic\'s map, and its report reaches the topic through it');
    const unread = ['--question', 'abc'];
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', 'notes/problem.md', ...unread]).error,
      /--problem must point inside \S*\/\.leeway\/\.cache\//);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', '.leeway/.cache/lab/scratch/ghost.md', ...unread]).error,
      /problem file not found/);
    const empty = '.leeway/.cache/lab/scratch/empty.md';
    fs.mkdirSync(path.join(dir, path.dirname(empty)), { recursive: true });
    fs.writeFileSync(path.join(dir, empty), '  \n');
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', empty, ...unread]).error,
      /problem file is empty/);
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment, undefined, 'a refused spawn conceives nothing');

    spawn(dir, 'discussion', 'window-placement');
    walkTo(dir, 'E1', 'running');
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1', '--problem', problemScratch(dir, 'part')]).error,
      /--problem is refused with --parent — a split carries no spawn-side problem statement/);
    assert.match(engineFails(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1', '--question', 'abc']).error,
      /--question is refused with --parent — the parent measures the map's question/);
  });
});

describe('the spawn commits its record and hands the conversation on', () => {
  let dir;
  beforeEach(() => { dir = labWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  /** The spawn gate over `unit`'s `topic`, rendered, then `key` answered: the row's next. @param {string} unit @param {string} topic @param {string} key */
  function answered(unit, topic, key) {
    output(dir, ['render', 'experiment-spawn-gate', `${unit}.discussion.${topic}`, '--id', 'E1'], { env: SESSION });
    return engine(dir, ['gate', 'experiment spawn gate', '--pick', key], { env: SESSION }).next;
  }

  it('commits the problem statement and the manifest that names it, the spawning topic\'s log riding along', () => {
    const log = layout.topic('lab', 'timing', 'log.md');
    fs.mkdirSync(path.dirname(statePath(dir, log)), { recursive: true });
    fs.writeFileSync(statePath(dir, log), '# Timing\n\nA number would settle it.\n');
    const res = spawn(dir, 'discussion', 'window-placement');
    const changed = stateGit(dir, ['show', '--name-status', '--no-renames', '--format=', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual([res.committed, lastMessage(dir), changed], [
      stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
      'experiment(lab/timing): spawn E1 window-placement',
      [`A\t${layout.experiment('lab', 'timing', 'E1-window-placement', 'problem.md')}`, `A\t${log}`, `M\t${layout.manifest('lab')}`].sort(),
    ]);
  });

  it('a split commits nothing — its manifest change is the experiment session\'s', () => {
    spawn(dir, 'discussion', 'window-placement');
    walkTo(dir, 'E1', 'running');
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    assert.strictEqual(engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1']).committed, undefined);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), before);
  });

  it('yes takes an epic\'s discussion into the laboratory for its topic, later carries the conversation on', () => {
    spawn(dir, 'discussion', 'window-placement');
    assert.deepStrictEqual(answered('lab', 'timing', 'y'), { kind: 'handoff', skill: 'leeway-experiment-process', args: ['epic', 'lab', 'timing'] });
    assert.deepStrictEqual(answered('lab', 'timing', 'l'), { kind: 'continue' });
  });

  it('yes takes a single-topic unit\'s discussion straight into the laboratory for its topic', () => {
    writeManifest(dir, 'solo', { name: 'solo', work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { solo: { status: 'in-progress' } } } } });
    commitAll(dir, 'solo');
    const question = engine(dir, ['ledger', 'ask', 'solo.discussion.solo'], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'What does a tally cost?' }) }).id;
    engine(dir, ['experiment', 'create', 'solo', 'solo', '--slug', 'tally-cost', '--from', 'discussion', '--problem', problemScratch(dir, 'tally-cost'), '--question', question]);
    assert.deepStrictEqual(answered('solo', 'solo', 'y'), { kind: 'handoff', skill: 'leeway-experiment-process', args: ['feature', 'solo', 'solo'] });
  });
});

describe('engine experiment advance / approve — design before data', () => {
  let dir;
  beforeEach(() => {
    dir = labWorld();
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
    dir = labWorld();
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

  it('the conclusion releases the wait and flags nothing', () => {
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    const item = readManifest(dir, 'lab').phases.discussion.items.timing;
    assert.strictEqual(item.awaiting_experiments, undefined, 'the emptied lock is removed');
    assert.strictEqual(item.reconcile_needed, undefined, 'the result reaches the discussion on its map or as mail, never as a flag');
  });

  it('conclusion never flags a completed same-topic discussion', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    walkTo(dir, 'E1', 'running');
    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'rule held']);
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.reconcile_needed, undefined);
  });

  it('abandon keeps the row with its reason, releases the wait, and flags nothing', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    const res = engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'question dissolved in design']);
    assert.strictEqual(res.status, 'abandoned');
    assert.strictEqual(res.reason, 'question dissolved in design');
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.experiment.items.timing.experiments.E1.reason, 'question dissolved in design');
    assert.strictEqual(after.phases.discussion.items.timing.reconcile_needed, undefined);
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
});

describe('splits — sub-experiments under a running parent', () => {
  let dir;
  beforeEach(() => {
    dir = labWorld();
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('creates E1.1 under a running E1, nested in the parent record — no lock moves', () => {
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'single-monitor', '--parent', 'E1']);
    assert.strictEqual(res.id, 'E1.1');
    assert.strictEqual(res.parent, 'E1');
    assert.strictEqual(res.dir, statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'E1.1-single-monitor')));
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

describe('the question on the map an experiment measures (9.1.11)', () => {
  let dir;
  beforeEach(() => { dir = plainWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  /** A ledger write at timing's discussion: its short id. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
  function write(verb, flags, content) {
    return engine(dir, ['ledger', verb, 'lab.discussion.timing', ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
  }
  const ask = (/** @type {string} */ text) => write('ask', [], { ...MADE, text });
  /** The person's own answer to `question`. @param {string} question */
  const personDecides = (question) => write('decide', ['--answers', question], { by: 'person', who_moved_whom: 'none', text: 'Top left.', why: 'Where the eye lands.' });
  const map = () => engine(dir, ['ledger', 'map', 'lab', 'timing']).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.waiting_on]);
  /** Spawn E{next} measuring `question`. @param {string} question */
  const measure = (question) => engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'window-placement', '--from', 'discussion',
    '--problem', problemScratch(dir, 'window-placement'), '--question', question]);
  const ledgerIds = () => fs.readFileSync(statePath(dir, layout.ledger), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id);

  it('the spawn records the question by its full id, and the map shows it waiting on the experiment', () => {
    const placement = ask('Where does a new window open?');
    const sizing = ask('How big is a new window?');
    const res = measure(placement.slice(0, 4));
    assert.strictEqual(res.question, placement, 'the response names the question by its short id');
    const full = ledgerIds().find((id) => id.startsWith(placement));
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1,
      { slug: 'window-placement', status: 'conceived', question: full });
    assert.deepStrictEqual(map(), [[placement, 'open', { experiment: 'E1', running: true }], [sizing, 'open', null]]);
  });

  it('refuses a question that is no open question of the topic, writing nothing', () => {
    const placement = ask('Where does a new window open?');
    const finding = write('find', [], { ...MADE, text: 'Windows open centred today.', how: 'read the code', known: 'read' });
    const answered = ask('Does a window remember its place?');
    personDecides(answered);
    const cases = [
      ['zzzz', /--question: /],
      [finding, new RegExp(`--question names ${finding}, which is no question`)],
      [answered, new RegExp(`--question names ${answered}, which stands open on no row of "timing"'s map`)],
    ];
    for (const [prefix, refusal] of cases) {
      const args = ['experiment', 'create', 'lab', 'timing', '--slug', 'x', '--from', 'discussion', '--problem', problemScratch(dir, 'x'), '--question', /** @type {string} */ (prefix)];
      assert.match(refusedPristine(dir, args).error, /** @type {RegExp} */ (refusal));
    }
    assert.deepStrictEqual(map().map(([id, , waiting]) => [id, waiting]), [[placement, null], [answered, null]]);
  });

  it('a concluded experiment keeps its question waiting until the discussion writes the result', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.strictEqual(res.report_sent, undefined, 'an open question takes the report in the discussion, never as a message');
    assert.deepStrictEqual(map(), [[placement, 'open', { experiment: 'E1', running: false }]]);
    write('decide', ['--answers', placement], { ...MADE, text: 'Top left.', why: 'E1 measured it.' });
    assert.deepStrictEqual(map().map(([id, stands, waiting]) => [id, stands, waiting]), [[placement, 'answered', null]]);
  });

  it('a report concluding after the person closed its question reaches the topic as a message, reopening it if decided', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const m = readManifest(dir, 'lab');
    m.phases.discussion.items.timing.status = 'completed';
    writeManifest(dir, 'lab', m);
    const report = '# Report — E1\n\nTop left is found fastest.\n';
    fs.writeFileSync(statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'report.md')), report);
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    const message = statePath(dir, layout.mailbox('lab', 'timing', '001-e1-report.md'));
    assert.deepStrictEqual(res.report_sent, { topic: 'timing', message_path: message, reopened: true, committed: res.report_sent.committed });
    assert.strictEqual(fs.readFileSync(message, 'utf8'), '# Report — E1\nFrom Experiment E1 · 1 Jan\n\nTop left is found fastest.\n', 'the report reaches its own topic as written, from the experiment by its id');
    assert.strictEqual(lastMessage(dir), 'mail(lab): send 001-e1-report.md to timing');
    assert.strictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.status, 'in-progress', 'the decided topic reopens');
  });

  it('a report whose question the person moved to another topic reaches that topic, whose map waits on the experiment until it writes the result', () => {
    const m = readManifest(dir, 'lab');
    m.phases.discovery.items.sizing = { routing: 'discussion', summary: 'Window sizing', order: 2 };
    m.phases.discussion.items.sizing = { status: 'completed' };
    writeManifest(dir, 'lab', m);
    commitAll(dir, 'sizing');
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    engine(dir, ['ledger', 'move', 'lab.discussion.timing', '--question', placement, '--to', 'sizing'], { env: SESSION, stdin: JSON.stringify({ by: 'person', who_moved_whom: 'none' }) });
    const sizingMap = () => engine(dir, ['ledger', 'map', 'lab', 'sizing']).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.waiting_on]);
    assert.deepStrictEqual(sizingMap(), [[placement, 'open', { experiment: 'E1', running: true }]]);
    const record = layout.experiment('lab', 'timing', 'E1-window-placement');
    fs.writeFileSync(statePath(dir, `${record}/report.md`), '# Report — E1\n\nRuns in [the data](data/run.csv).\n');
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    assert.deepStrictEqual(res.report_sent, {
      topic: 'sizing', message_path: statePath(dir, layout.mailbox('lab', 'sizing', '001-e1-report.md')), reopened: true, committed: res.report_sent.committed,
    });
    const back = path.posix.relative(layout.mailbox('lab', 'sizing'), record);
    assert.strictEqual(
      fs.readFileSync(res.report_sent.message_path, 'utf8'), `# Report — E1\nFrom Experiment E1, on Timing · 1 Jan\n\nRuns in [the data](${back}/data/run.csv).\n`,
      'the moved question\'s topic hears from the experiment by the topic whose series holds it, each link rebased from its own mailbox',
    );
    assert.strictEqual(lastMessage(dir), 'mail(lab): send 001-e1-report.md to sizing');
    assert.ok(!fs.existsSync(statePath(dir, layout.mailbox('lab', 'timing'))), 'the topic the question left gets nothing');
    const items = readManifest(dir, 'lab').phases.discussion.items;
    assert.deepStrictEqual([items.timing.status, items.sizing.status], ['in-progress', 'in-progress'], 'the decided destination reopens');
    assert.deepStrictEqual(sizingMap(), [[placement, 'open', { experiment: 'E1', running: false }]], 'the result is the destination\'s to write');
    engine(dir, ['ledger', 'decide', 'lab.discussion.sizing', '--answers', placement], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Top left.', why: 'E1 measured it.' }) });
    assert.deepStrictEqual(sizingMap(), [[placement, 'answered', null]]);
  });

  it('a report whose question the person moved to the roadmap as later reaches the spawning topic', () => {
    engine(dir, ['roadmap', 'add', 'placement', '--horizon', 'v2', '--summary', 'Window placement']);
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    write('move', ['--question', placement, '--to', 'roadmap:placement'], { by: 'person', who_moved_whom: 'none' });
    fs.writeFileSync(statePath(dir, layout.experiment('lab', 'timing', 'E1-window-placement', 'report.md')), '# Report — E1\n');
    const res = engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.deepStrictEqual([res.report_sent.topic, res.report_sent.message_path], ['timing', statePath(dir, layout.mailbox('lab', 'timing', '001-e1-report.md'))]);
  });

  it('the report sent as a message has each relative link rebased to resolve from the mailbox, every other link and fenced code as written', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const record = layout.experiment('lab', 'timing', 'E1-window-placement');
    fs.mkdirSync(statePath(dir, `${record}/data`), { recursive: true });
    fs.writeFileSync(statePath(dir, `${record}/data/run.csv`), 'ms\n4\n');
    fs.writeFileSync(statePath(dir, `${record}/report.md`), [
      '# Report — E1', '',
      'Runs in [the data](data/run.csv#L2) and ![the chart](./data/run.csv "timings"), as [the problem](<problem.md>) set.',
      'See [the docs](https://example.com/a.md), [above](#method) and [the root](/abs/path.md).',
      '[raw]: data/run.csv',
      '```', '[kept](data/run.csv)', '```', '',
    ].join('\n'));
    const res = withFrozenClock(() => engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']));
    const back = path.posix.relative(layout.mailbox('lab', 'timing'), record);
    assert.strictEqual(fs.readFileSync(res.report_sent.message_path, 'utf8'), [
      '# Report — E1', 'From Experiment E1 · 1 Jan', '',
      `Runs in [the data](${back}/data/run.csv#L2) and ![the chart](${back}/data/run.csv "timings"), as [the problem](<${back}/problem.md>) set.`,
      'See [the docs](https://example.com/a.md), [above](#method) and [the root](/abs/path.md).',
      `[raw]: ${back}/data/run.csv`,
      '```', '[kept](data/run.csv)', '```', '',
    ].join('\n'));
    assert.ok(fs.existsSync(path.resolve(path.dirname(res.report_sent.message_path), `${back}/data/run.csv`)), 'a rebased link resolves to the file it named');
  });

  it('a report owed as a message and not written refuses the conclusion, writing nothing', () => {
    const placement = ask('Where does a new window open?');
    measure(placement);
    walkTo(dir, 'E1', 'running');
    personDecides(placement);
    const res = refusedPristine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'top left wins']);
    assert.match(res.error, /experiment E1 \("timing"\) has no report\.md — its question left the topic's open questions while it ran, so the report reaches "timing" as a message/);
  });
});

describe('the experiment item is derived bookkeeping — no hand lifecycle', () => {
  let dir;
  beforeEach(() => { dir = labWorld(); });
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

});

describe('epic topic cancel takes the series with its topic', () => {
  let dir;
  beforeEach(() => {
    dir = labWorld();
    spawn(dir, 'discussion', 'first');
    spawn(dir, 'discussion', 'second');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('no phase-level cancel: the series and the discussion each refuse with the stage rule, writing nothing', () => {
    for (const phase of ['experiment', 'discussion']) {
      assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'lab', phase, 'timing']).error,
        'cancel is topic-level per stage — discovery (the map row with its discussion and experiments) or specification (with its planning)', phase);
    }
    const before = readManifest(dir, 'lab');
    assert.deepStrictEqual(before.phases.discussion.items.timing.awaiting_experiments, ['E1', 'E2'], 'refusal writes nothing');
    assert.strictEqual(before.phases.experiment.items.timing.status, 'in-progress');
  });

  it("the topic's cancel releases every wait first, abandons every open record, and settles the series", () => {
    const res = engine(dir, ['topic', 'cancel', 'lab', 'discovery', 'timing']);
    assert.strictEqual(res.status, 'cancelled');
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1', 'E2'], remaining: [] }]);
    assert.deepStrictEqual(res.abandoned, ['E1', 'E2'], 'every open record ends abandoned — no zombie survives the cancel');
    assert.deepStrictEqual(res.cancelled, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    const after = readManifest(dir, 'lab');
    const series = after.phases.experiment.items.timing;
    assert.strictEqual(series.status, 'completed', 'every record terminal — the series settles, never a cancel');
    assert.strictEqual(series.previous_status, undefined);
    for (const id of ['E1', 'E2']) {
      assert.strictEqual(series.experiments[id].status, 'abandoned');
      assert.strictEqual(series.experiments[id].reason, 'topic cancelled');
    }
    const discussion = after.phases.discussion.items.timing;
    assert.strictEqual(discussion.status, 'cancelled');
    assert.strictEqual(discussion.awaiting_experiments, undefined);
    assert.strictEqual(discussion.reconcile_needed, undefined, 'the release flags nothing');
    assert.deepStrictEqual(after.phases.discovery.items.timing, { routing: 'discussion', summary: 'Timing behaviour', cancelled: true, previous_order: 1 });
  });

  it('a live sub-experiment is abandoned with its parent', () => {
    walkTo(dir, 'E1', 'running');
    engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'part', '--parent', 'E1']);
    const res = engine(dir, ['topic', 'cancel', 'lab', 'discovery', 'timing']);
    assert.deepStrictEqual(res.abandoned, ['E1', 'E1.1', 'E2'], 'the family never outlives its parent — register order, the split beneath its parent');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments['E1.1'].reason, 'topic cancelled');
  });

  it('a record already terminal keeps its own reason — the register reads honestly post-cancel', () => {
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E1', '--reason', 'moot']);
    const res = engine(dir, ['topic', 'cancel', 'lab', 'discovery', 'timing']);
    assert.deepStrictEqual(res.abandoned, ['E2']);
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E2'], remaining: [] }],
      'E1 released its wait when it was abandoned — only E2 was still held');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1.reason, 'moot');
  });

  it('the reactivate restores the conversation; the series is never reactivated on its own, and the next spawn revives it', () => {
    engine(dir, ['topic', 'cancel', 'lab', 'discovery', 'timing']);
    assert.match(engineFails(dir, ['topic', 'reactivate', 'lab', 'experiment', 'timing']).error,
      /^reactivate is topic-level per stage — discovery/);
    const res = engine(dir, ['topic', 'reactivate', 'lab', 'discovery', 'timing']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    const after = readManifest(dir, 'lab');
    assert.strictEqual(after.phases.experiment.items.timing.status, 'completed', 'the series stays where the cancel left it');
    const revived = spawn(dir, 'discussion', 'successor');
    assert.strictEqual(revived.id, 'E3', 'the revival allocates the next id, never reusing a closed row');
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.status, 'in-progress');
  });

  it('the derived item status refuses the hand-write the verbs make unnecessary', () => {
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'status', 'completed']).error,
      /derived bookkeeping the experiment verbs maintain/);
  });
});

describe('the field surface guards the series exactly as the verbs write it', () => {
  let dir;
  beforeEach(() => {
    dir = labWorld();
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
    engine(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '["E1"]']);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '["E1.1"]']).error,
      /the lock is only ever the parent id/);
    assert.match(engineFails(dir, ['manifest', 'push', 'lab.discussion.timing', 'awaiting_experiments', 'nope']).error,
      /Invalid awaiting_experiments/);
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '"E1"']).error,
      /Must be an array/);
  });

  it('every awaiting id must name a record the spawn allocated — set and push alike', () => {
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.discussion.timing', 'awaiting_experiments', '["E1","E9"]']).error,
      /awaiting_experiments cannot name E9/);
    assert.match(engineFails(dir, ['manifest', 'push', 'lab.discussion.timing', 'awaiting_experiments', 'E9']).error,
      /awaiting_experiments cannot name E9/);
    assert.deepStrictEqual(readManifest(dir, 'lab').phases.discussion.items.timing.awaiting_experiments, ['E1'],
      'the refusal writes nothing');
  });

  it('a leaf set on an id the series does not hold refuses — the surface repairs, never creates', () => {
    assert.match(engineFails(dir, ['manifest', 'set', 'lab.experiment.timing', 'experiments.E9.status', 'running']).error,
      /no experiment E9 in "timing"'s series — records are allocated by the spawn/);
    const ops = '.leeway/.cache/lab/scratch/ops.json';
    fs.mkdirSync(path.join(dir, path.dirname(ops)), { recursive: true });
    fs.writeFileSync(path.join(dir, ops), JSON.stringify([
      { op: 'set', path: 'lab.experiment.timing', fields: { 'experiments.E9.status': 'running' } },
    ]));
    assert.match(engineFails(dir, ['manifest', 'apply', 'lab', '--file', ops]).error,
      /no experiment E9 in "timing"'s series/);
    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E9, undefined,
      'no phantom record — a mint here would block the series ever settling');
  });
});

describe('presence rides the experiment verbs mechanically', () => {
  let dir;
  beforeEach(() => { dir = labWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  const presenceFile = (phase) => path.join(dir, '.leeway/.cache/lab', phase, 'timing/presence');

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

  it('a top-level close releases only its own session\'s slot, never a peer\'s working another record of the topic', () => {
    const [a, b] = [{ CLAUDE_CODE_SESSION_ID: 'lab-a', CLAUDE_PID: '101' }, { CLAUDE_CODE_SESSION_ID: 'lab-b', CLAUDE_PID: '202' }];
    spawn(dir, 'discussion', 'window-placement');
    spawn(dir, 'discussion', 'window-size');
    for (const step of ['advance', 'approve', 'advance']) engine(dir, ['experiment', step, 'lab', 'timing', 'E1'], { env: a });
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E2'], { env: b });
    const holder = () => JSON.parse(fs.readFileSync(presenceFile('experiment'), 'utf8')).session_id;
    assert.strictEqual(holder(), 'lab-b');

    engine(dir, ['experiment', 'conclude', 'lab', 'timing', 'E1', '--verdict', 'held'], { env: a });
    assert.strictEqual(holder(), 'lab-b', 'the peer keeps its slot');
    engine(dir, ['experiment', 'abandon', 'lab', 'timing', 'E2', '--reason', 'superseded'], { env: b });
    assert.ok(!fs.existsSync(presenceFile('experiment')), 'its own close releases it');
  });
});
