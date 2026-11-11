'use strict';

// ---------------------------------------------------------------------------
// The experiment series (leeway-engine/scripts/domain/experiment.cjs,
// `engine experiment create|advance|approve|runs|conclude|abandon`): the
// spawn from a discussion, measuring a question on its map it must name, and
// its lock, the records in the topic's folder (4.11.15), its now-or-later
// gate, a learned one, the walk to verdict, the tally of a running
// experiment's runs, splits, the release edges, the topic's cancel, and the
// field surface's guards. The question on the map an
// experiment measures is test-engine-experiment-question.cjs's.
//
// Layer: verb. World: experiment-world.cjs's lab, built once and copied, its
// spawning discussion's map holding the questions spawns measure.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { cleanupFixture, commitAll, ok: engine, refuses: engineFails, refusedPristine, lastMessage, statePath, layout, withFrozenClock, FROZEN_AT, stateGit, output, fixtureFrom, startItem } = require('./engine-harness.cjs');
const { writeManifest, readManifest, setup, problemScratch, SESSION, MADE, walkTo } = require('./experiment-world.cjs');
const decisionPoint = require('../../skills/leeway-engine/scripts/domain/decision-point.cjs');

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

/** Spawn E{next} from the named phase, measuring the lab's first question no experiment measures yet. */
function spawn(dir, from, slug) {
  const items = readManifest(dir, 'lab').phases.experiment?.items ?? {};
  const taken = Object.values(items).flatMap((item) => Object.values(item.experiments ?? {}).map((record) => record.question));
  const question = measurable.find((short) => !taken.some((full) => full?.startsWith(short)));
  return engine(dir, ['experiment', 'create', 'lab', 'timing', '--slug', slug, '--from', from, '--problem', problemScratch(dir, slug), '--question', question]);
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
    mapped.phases.discovery.items.ghost = { summary: 'Ghost windows', order: 2 };
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

  it('the now-or-later gate is a learned one, stepped by the decision point at the spawning topic: run as a step on yes, its report stands in its menu\'s place and its DATA carries the handoff into the laboratory (24.1.2)', (t) => {
    spawn(dir, 'discussion', 'window-placement');
    const asked = t.mock.method(decisionPoint, 'gateStep', () => ({ step: 'automatic', row: 'y' }));
    const out = output(dir, ['render', 'experiment-spawn-gate', 'lab.discussion.timing', '--id', 'E1'], { env: SESSION });

    assert.deepStrictEqual(asked.mock.calls.map(({ arguments: [name, { place }] }) => [name, place]), [['experiment spawn gate', { unit: 'lab', phase: 'discussion', topic: 'timing' }]]);
    assert.deepStrictEqual(out.split('\n').slice(1, 4), ['automatic step: experiment spawn gate', 'ran: y', 'next: {"kind":"handoff","skill":"leeway-experiment-process","args":["epic","lab","timing"]}']);
    assert.match(out, /^=== DISPLAY: automatic step .*\nExperiment worked now \[auto\]\. Opening the laboratory\.\n$/m);
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

  it('approve holds the day the person approved the design on the record, as the unit holds its own (20.13.1)', () => {
    walkTo(dir, 'E1', 'designed');
    withFrozenClock(() => engine(dir, ['experiment', 'approve', 'lab', 'timing', 'E1']));

    assert.strictEqual(readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1.approved, FROZEN_AT.slice(0, 10));
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

describe('engine experiment runs — the tally of its runs (20.13.1)', () => {
  let dir;
  beforeEach(() => {
    dir = labWorld();
    spawn(dir, 'discussion', 'window-placement');
  });
  afterEach(() => { cleanupFixture(dir); });

  /** Claude's tally written into the cache: its project-relative path. @param {unknown} tally */
  function tallied(tally) {
    const rel = '.leeway/.cache/lab/experiment/timing/runs.json';
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(tally));
    return rel;
  }

  /** The tally recorded for E1, its record's runs. @param {unknown} tally */
  const record = (tally) => {
    const { runs } = engine(dir, ['experiment', 'runs', 'lab', 'timing', 'E1', '--file', tallied(tally)]);
    return { runs, held: readManifest(dir, 'lab').phases.experiment.items.timing.experiments.E1.runs };
  };

  it('keeps a running experiment\'s tally on its record, each condition\'s runs done and their median in place of its values — the middle one, or the mean of the two middles — and a later tally stands over it', () => {
    walkTo(dir, 'E1', 'running');
    const first = record([
      { condition: '16 bare windows', of: 20, values: [0.25, 0.23, 0.24], unit: 's' },
      { condition: '25 real fumis', of: 20, values: [0.7, 0.66, 0.69, 0.68] },
    ]);
    const later = record([{ condition: '16 bare windows', of: 20, values: [] }]);

    const bare = { condition: '16 bare windows', of: 20, done: 3, median: 0.24, unit: 's' };
    const real = { condition: '25 real fumis', of: 20, done: 4, median: 0.685 };
    const none = { condition: '16 bare windows', of: 20, done: 0, median: null };
    assert.deepStrictEqual([first, later], [{ runs: [bare, real], held: [bare, real] }, { runs: [none], held: [none] }]);
  });

  it('refuses, writing nothing, a unit, topic or experiment the project lacks, an experiment not running, and a tally outside the cache, no list, empty, naming a condition twice, or holding one whose runs, values or keys do not check', () => {
    walkTo(dir, 'E1', 'approved');
    const runs = (/** @type {string} */ file, at = ['lab', 'timing', 'E1']) => refusedPristine(dir, ['experiment', 'runs', ...at, '--file', file]).error;
    const one = { condition: 'bare', of: 2, values: [1] };
    const lacking = [['nowhere', 'timing', 'E1'], ['lab', 'nothing', 'E1'], ['lab', 'timing', 'E9']].map((at) => runs(tallied([one]), at));
    const approved = runs(tallied([one]));
    engine(dir, ['experiment', 'advance', 'lab', 'timing', 'E1']);
    const errors = [
      ...lacking,
      approved,
      runs('runs.json'),
      ...[{}, [], [one, one], [{ ...one, of: 0 }], [{ ...one, values: ['1'] }], [{ ...one, values: [1, 2, 3] }], [{ ...one, median: 1 }]].map((tally) => runs(tallied(tally))),
    ];

    assert.deepStrictEqual(errors.map((error) => error.split(' — ')[0]), [
      `manifest not found: ${statePath(dir, 'nowhere', 'manifest.json')}`,
      'no experiment series for "nothing"',
      `no experiment E9 in "timing"'s series`,
      'experiment E1 ("timing") is approved',
      `--file must point inside ${statePath(dir, '.cache')}/`,
      'the tally is a list',
      'the tally names no condition',
      'the tally names the condition "bare" twice',
      'condition 1\'s of is the runs its design gives it, a whole number above nought',
      'condition 1\'s values are the runs measured, each a number',
      'condition 1 has 3 runs measured of the 2 its design gives it',
      'condition 1 must be {condition, of, values, unit?}',
    ]);
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

describe('the experiment item is derived bookkeeping — no hand lifecycle', () => {
  let dir;
  beforeEach(() => { dir = labWorld(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a start refuses the experiment phase', () => {
    assert.throws(() => startItem(dir, 'lab', 'experiment', 'timing'), { message: /the spawn creates and reopens it \(experiment create\)/ });
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
        'cancel is topic-level — discovery, the map row with its discussion and experiments', phase);
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
    assert.deepStrictEqual(after.phases.discovery.items.timing, { summary: 'Timing behaviour', cancelled: true, previous_order: 1 });
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
      /^reactivate is topic-level — discovery/);
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
