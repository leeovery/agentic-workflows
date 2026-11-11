'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's experiments in a feature: the spawn worked now
// or put off until the feature's Continue (24.S18), the laboratory's leave
// back into the conversation by the unit's Continue, decided over a concluded
// experiment and on to its specification; the question on the map an
// experiment measures, and its report reaching the topic as a message once
// that question closed, the topic held from its spec until it is read; and
// the laboratory left for the menu landing on the start menu, never the
// laboratory again. An epic's are test-pipeline-simulation-experiments.cjs's.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  Sim, sessionLog, continueUnit, startMenu, handoffEntry, enterEntry, handoffBy, follow, answerGate, waitAgents, decideTopic, askedOn, DECIDED_ITEMS,
} = require('./pipeline-world.cjs');

/**
 * The now-or-later gate after a spawn, answered `pick`: its next.
 * @param {Sim} sim @param {string} wu @param {string} id @param {'y'|'l'} pick
 */
function spawnGate(sim, wu, id, pick) {
  sim.render(['experiment-spawn-gate', `${wu}.discussion.${wu}`, '--id', id], { expect: 'content' });
  return answerGate(sim, 'experiment spawn gate', '--pick', pick).next;
}

/** The laboratory's leave once its series has nothing left to work (next-experiment.md): the unit's Continue. @param {Sim} sim @param {string} wu */
const leaveTheLab = (sim, wu) => handoffBy(sim, ['handoff', 'unit', wu]).invoked;

/** The feature's topic closed into its spec, and its `next` followed there. @param {Sim} sim @param {string} wu */
function intoTheSpec(sim, wu) {
  const { next } = decideTopic(sim, wu, wu);
  assert.deepStrictEqual(next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
  follow(sim, next);
}

/**
 * Claude's answer to a question on the topic's map, once nothing measures it.
 * @param {Sim} sim @param {string} wu @param {string} topic @param {string} question @param {string} text
 */
function claudeDecides(sim, wu, topic, question, text) {
  sim.run(['ledger', 'decide', `${wu}.discussion.${topic}`, '--answers', question], null,
    JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, why: 'The experiments settled it.' }));
}

describe('pipeline simulation: experiments, in a feature', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });
  it('a single-topic leave: the laboratory picker\'s back, and the next experiment\'s gate\'s menu row, land on the start menu, never the laboratory again', () => {
    const wu = 'frame-rate';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Frame pacing', '--session-log-file', sessionLog(sim, wu)]);
    continueUnit(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, `# Discussion — ${wu}\n`);
    for (const slug of ['vsync-cost', 'jank-budget']) {
      sim.run(['experiment', 'create', wu, wu, '--slug', slug, '--from', 'discussion', '--question', askedOn(sim, wu, wu, `What does ${slug} settle?`),
        '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, `# Problem — ${slug}\n`)]);
    }
    waitAgents(sim, wu, wu);
    assert.deepStrictEqual(spawnGate(sim, wu, 'E2', 'l'), { kind: 'continue' });
    // 24.S18: put off for later, the laboratory is reached by the feature's
    // Continue while a record waits unrun.
    assert.strictEqual(continueUnit(sim, wu).text, `Invoke \`/leeway-experiment-process feature ${wu} ${wu}\`.`);
    sim.handOver();

    // Two live records put the pick to the user; a back out of it, on a unit
    // whose Continue would hand straight back on, lands on the start menu —
    // no position, the state re-read, the unit still there.
    sim.render(['experiment-pick', `${wu}.experiment.${wu}`], { expect: 'content' });
    assert.strictEqual(follow(sim, answerGate(sim, 'experiment pick', '--pick', 'b').next).line, '→ Start');
    assert.ok(startMenu(sim).some(({ next }) => next?.kind === 'engine' && next.argv.join(' ') === `handoff unit ${wu}`),
      'the start menu lists the unit the laboratory was entered from');

    // One record ended and the other still live, the gate offering the next
    // experiment leads its menu row to the same start menu.
    continueUnit(sim, wu);
    sim.handOver();
    sim.run(['experiment', 'abandon', wu, wu, 'E1', '--reason', 'covered by jank-budget']);
    sim.render(['experiment-next-gate', `${wu}.experiment.${wu}`], { expect: 'content' });
    assert.deepStrictEqual(answerGate(sim, 'experiment next gate', '--pick', 'm').next, { kind: 'handoff', skill: 'leeway', args: [] });
  });

  it('feature experiments: the waiting conversation routes to the laboratory and back, and decided over them goes on to its specification', () => {
    const wu = 'render-path';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Rendering decisions', '--session-log-file', sessionLog(sim, wu)]);
    continueUnit(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, `# Discussion — ${wu}\n`);

    // The spawn holds the conversation behind its evidence: the unit's
    // Continue goes to the laboratory until the wait releases — the
    // now-and-later exits land on the same state.
    const budget = askedOn(sim, wu, wu, 'What frame budget do we hold to?');
    const e1 = sim.run(['experiment', 'create', wu, wu, '--slug', 'frame-budget', '--from', 'discussion', '--question', budget,
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — frame budget\n')]);
    assert.ok(fs.existsSync(path.join(e1.dir, 'problem.md')), 'the spawn installs the problem statement');
    sim.refuses(['ledger', 'decide', `${wu}.discussion.${wu}`, '--answers', budget], /is measured by experiment E1, still running/, null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: '60fps.', why: 'A guess.' }));

    // 24.S18: worked now, the pause fetches the wait for its agents, then
    // the spawn gate's yes hands off to the laboratory, which starts in a
    // fresh context.
    waitAgents(sim, wu, wu);
    follow(sim, spawnGate(sim, wu, 'E1', 'y'));
    handoffEntry(sim, wu, 'experiment', wu);
    sim.run(['experiment', 'advance', wu, wu, 'E1']);
    sim.run(['experiment', 'approve', wu, wu, 'E1']);
    sim.run(['experiment', 'advance', wu, wu, 'E1']);
    sim.run(['experiment', 'runs', wu, wu, 'E1', '--file', sim.write(`.leeway/.cache/${wu}/experiment/${wu}/E1-runs.json`,
      JSON.stringify([{ condition: 'a full scroll', of: 3, values: [16.1, 16.4, 15.9], unit: 'ms' }]))]);
    sim.run(['experiment', 'conclude', wu, wu, 'E1', '--verdict', 'budget holds at 60fps']);
    sim.run(['commit', wu, '-m', `experiment(${wu}): conclude E1`, '--topic', `experiment/${wu}`]);

    // The series has nothing left to work: the laboratory's leave is the
    // unit's Continue, back into the conversation.
    assert.strictEqual(leaveTheLab(sim, wu), `/leeway-discussion-process feature ${wu}`);
    handoffEntry(sim, wu, 'discussion', wu);

    // A second spawn holds the conversation again; the record's abandon is
    // the release — the wait closes and the series settles over its terminal
    // records. A feature's topic is its work unit, so the topic-level cancel
    // is the epic's; the work-unit cancel abandons a feature whole.
    const latency = askedOn(sim, wu, wu, 'What input latency do we hold to?');
    sim.run(['experiment', 'create', wu, wu, '--slug', 'input-latency', '--from', 'discussion', '--question', latency,
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — input latency\n')]);
    sim.refuses(['ledger', 'decide', `${wu}.discussion.${wu}`, '--answers', latency], /is measured by experiment E2, still running/, null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What 60fps leaves.', why: 'A guess.' }));
    const dropped = sim.run(['experiment', 'abandon', wu, wu, 'E2', '--reason', 'settled by E1']);
    assert.deepStrictEqual(dropped.released_waits, [{ phase: 'discussion', released: ['E2'], remaining: [] }]);
    assert.strictEqual(sim.manifest(wu).phases.experiment.items[wu].experiments.E2.reason, 'settled by E1');
    assert.strictEqual(sim.manifest(wu).phases.experiment.items[wu].status, 'completed',
      'every record terminal — the derived status settles');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].reconcile_needed, undefined, 'a release flags nothing');

    // The conversation writes what the experiments settled, then, decided
    // over them, the feature goes on to its specification — no conclusion
    // routes it back.
    for (const [question, text] of [[budget, '60fps.'], [latency, 'What 60fps leaves.']]) claudeDecides(sim, wu, wu, question, text);
    intoTheSpec(sim, wu);
  });

  it('the question an experiment measures: waiting on the map while it runs, held from Claude\'s close, and once the person closed it first, the topic held from its spec until the report, a message, is read', () => {
    const wu = 'cold-start';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Launch time', '--session-log-file', sessionLog(sim, wu)]);
    continueUnit(sim, wu);
    handoffEntry(sim, wu, 'discussion', wu);
    enterEntry(sim, wu, 'discussion', wu);
    const at = `${wu}.discussion.${wu}`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    const ledger = (/** @type {string[]} */ args, /** @type {Record<string, unknown>} */ content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;

    // The spawn names the map's question it measures; the oracle holds the
    // map's waiting mark to the record after every call.
    const budget = ledger(['ask', at], { ...made, text: 'What launch time do we hold to?' });
    const e1 = sim.run(['experiment', 'create', wu, wu, '--slug', 'launch-budget', '--from', 'discussion', '--question', budget,
      '--problem', sim.write(`.leeway/.cache/${wu}/discussion/${wu}/problem.md`, '# Problem — launch budget\n')]);
    sim.refuses(['ledger', 'decide', at, '--answers', budget], /is measured by experiment E1, still running/, null,
      JSON.stringify({ ...made, text: 'Under a second.', why: 'It feels instant.' }));

    // The laboratory runs while the person closes the question themselves:
    // the topic does not close into its spec while the experiment is out,
    // its report owed (11.2.1). Once concluded, the report reaches the topic
    // as a message; raised and answered there, the topic closes into its
    // spec.
    follow(sim, spawnGate(sim, wu, 'E1', 'y'));
    handoffEntry(sim, wu, 'experiment', wu);
    for (const step of ['advance', 'approve', 'advance']) sim.run(['experiment', step, wu, wu, 'E1']);
    ledger(['decide', at, '--answers', budget], { by: 'person', who_moved_whom: 'none', text: 'Under a second.', why: 'It feels instant.' });
    for (const item of DECIDED_ITEMS) sim.run(['checklist', 'done', 'decided', wu, wu, item]);
    sim.refuses(['checklist', 'close', 'decided', wu, wu], /^checklist close: cold-start's experiment E1 is still out — the topic closes once each has concluded or been abandoned/);
    sim.write(path.relative(sim.dir, path.join(e1.dir, 'report.md')), '# Report — E1\n\nCold launch lands at 0.8 s.\n');
    const concluded = sim.run(['experiment', 'conclude', wu, wu, 'E1', '--verdict', 'under a second holds']);
    assert.strictEqual(concluded.report_sent.topic, wu, 'the question closed where it was asked, so the report goes back there');
    assert.ok(fs.existsSync(concluded.report_sent.message_path), 'the report waits in the topic\'s mailbox');
    sim.run(['commit', wu, '-m', `experiment(${wu}): conclude E1`, '--topic', `experiment/${wu}`]);
    const report = path.basename(concluded.report_sent.message_path, '.md');
    const raised = ledger(['ask', at], { by: 'claude', who_moved_whom: 'none', text: 'Does the report change the budget?' });
    sim.run(['topic', 'answered', wu, wu, report, '--entry', raised]);
    ledger(['decide', at, '--answers', raised], { by: 'person', who_moved_whom: 'none', text: 'No — 0.8 s holds it.', why: 'The report measured it.' });
    intoTheSpec(sim, wu);
  });
});
