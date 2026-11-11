'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's build of a phase of four tasks, as its skill's
// prose runs it, measuring what a task's own calls cost by where it sits:
// each task chained on the one before it, every second one touching the
// project's ignored clone too. The git commands a task's worktree laid
// out, its reviewer's brief, its builder's brief once it has landed and its
// account each run are no more for the fourth task than for the second — each reads the chain below it once,
// never a read per task beneath it (12.7.10, 12.14). The first task is no
// measure: nothing is below it, and it touches the project's repository
// alone.
//
// Layer: simulation. World: this file's own, built once on the named world
// `worlds.specToBuild`, itself built once per run (pipeline-world.cjs) — a
// feature through its spec to ready to build's pick in auto — its one phase
// of four tasks written and started; a copy per scenario, which replays the
// engine calls the build's prose makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { traced, git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, worlds, SPEC_TO_BUILD_UNIT, buildEntry, startPhase, writeTasks, landed, placeIn, buildLoop, builders, VERIFY_FILES, PASSED_REPORT,
} = require('./pipeline-world.cjs');
const engine = require('../../skills/leeway-engine/scripts/engine.cjs');

const WU = SPEC_TO_BUILD_UNIT;
const TASKS = 4;

/** A feature in auto, its one phase of four tasks written and started, the first proving 1.S1. */
const fourWorld = worldFrom('pipeline-build-scale-', (sim) => {
  buildEntry(sim, WU);
  sim.run(['task', 'phase', WU, '1', '--title', 'Writing']);
  sim.run(['brief', 'task-writer', WU, '1']);
  writeTasks(sim, WU, 1, Array.from({ length: TASKS }, (_, at) => ({ title: `Write part ${at + 1}`, scenarios: at === 0 ? ['1.S1'] : undefined })));
  startPhase(sim, WU, 1);
}, worlds.specToBuild);

describe('pipeline simulation: a task\'s cost by where it sits in its phase', () => {
  let sim;
  /** @type {ReturnType<typeof buildLoop>} */ let loop;
  /** Each builder's worktree, made as its isolation makes it. @type {string[]} */ let trees;
  beforeEach(() => {
    sim = new Sim(fourWorld);
    loop = buildLoop(sim, WU);
    trees = [];
  });
  afterEach(() => {
    trees.forEach((tree) => builders.remove(sim, tree));
    sim.destroy();
  });

  it('12.7.10, 12.14: task 1.4\'s worktree, its reviewer\'s brief, its builder\'s brief once it has landed and its account run no more git commands than task 1.2\'s', () => {
    /** The git commands each measured call ran, by the call, a count a task. @type {Record<string, number[]>} */
    const ran = {};
    /** An engine call from `cwd`, the git commands it ran counted under `call`, then audited as the sim audits each: its answer. @param {string} call @param {string[]} args @param {string} [cwd] */
    const counted = (call, args, cwd = sim.dir) => {
      const { result, commands } = traced(() => engine.run(args, { cwd, env: sim.env, stdin: '' }));
      (ran[call] ??= []).push(commands.length);
      return sim.audited(args, result);
    };

    for (let n = 1; n <= TASKS; n += 1) {
      const task = `1.${n}`;
      sim.run(['task', 'start', WU, task]);
      const builder = loop.brief(['builder', WU, task]);
      const tree = builders.make(`agent-${task}`);
      trees.push(tree);
      git(sim.dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${task}`, tree, 'main']);
      counted('task worktree', ['task', 'worktree', WU, task], tree);
      const files = { [`src/part-${n}.js`]: `export const part = ${n};\n`, ...(n % 2 === 0 ? { [`api/part-${n}.js`]: `export const part = ${n};\n` } : {}) };
      loop.committed(tree, task, n === 1 ? { ...VERIFY_FILES, ...files } : files);
      if (n === 1) loop.setUp(tree, builder, '1.S1');
      landed(placeIn(sim, counted('brief reviewer', ['brief', 'reviewer', WU, task, '--letter', 'a']), 'Where your report goes'), PASSED_REPORT);
      landed(placeIn(sim, loop.brief(['reviewer', WU, task, '--letter', 'b']), 'Where your report goes'), PASSED_REPORT);
      const back = counted('brief builder', ['brief', 'builder', WU, task]);
      landed(placeIn(sim, back, 'Where your account goes'), [
        '## What was done', `Task ${task} is built.`, '## Where in the code', '- src/', '## What the tests prove', '- Its scenario.', '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
      ].join('\n\n'));
      counted('task account', ['task', 'account', WU, task]);
      loop.landedTask(task);
    }

    assert.deepStrictEqual(Object.keys(ran).filter((call) => ran[call][3] > ran[call][1]), [], `the git commands each call ran, a count a task: ${JSON.stringify(ran)}`);
  });
});
