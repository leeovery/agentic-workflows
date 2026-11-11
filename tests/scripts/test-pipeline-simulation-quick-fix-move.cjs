'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix moves: a quick-fix moved mid-fix to a
// feature through start this work's screen, its pipeline carrying on to the
// build — ready to build showing the call its fix made among Claude's, the
// build's task writer's brief and task 1.1 meeting none of the quick-fix's
// calls — or to a bugfix, handed to its investigation (19.5.9); and one
// moved mid-review, its closed finish checklist dropped with its fixes.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  Sim, startUnit, handoff, answerGate, discussed, specWritten, specReviewed, cutTheSpec, readyToBuild, intoTheBuild,
  continueInto, buildEntry, briefOf, writePhaseTasks, startPhase, writeTasks, finishClosed, fixBuilt, reviewNext,
} = require('./pipeline-world.cjs');

/**
 * The quick-fix started through the opener and carried on into its skill,
 * whose entry it makes (24.1.3).
 * @param {Sim} sim @param {string} wu
 */
function opened(sim, wu) {
  startUnit(sim, 'quick-fix', wu, 'Looked small');
  sim.run(['enter', 'implementation', wu]);
}

/**
 * The unit moved to `to` as the quick-fix's skill moves it (19.5.9): the new
 * type's brief drafted and Claude's payload staged on start this work's
 * screen, the person's yes at its gate, and the yes it leads to run. Answers
 * the yes's answer.
 * @param {Sim} sim @param {string} wu @param {string} to
 */
function movedTo(sim, wu, to) {
  const brief = sim.write(`.leeway/.cache/${wu}/build/brief.md`, `# ${wu}\n\nWhat the fixes showed.\n`);
  const file = sim.write(`.leeway/.cache/${wu}/build/move.json`, { description: `The ${wu} work, as ${to} work.`, reason: 'It needs a decision beyond a quick call.', brief });
  sim.run(['workunit', 'move', wu, '--to', to, '--file', file]);
  const { next } = answerGate(sim, 'start this work', '--pick', 'y');
  return sim.run(next.argv);
}

describe('pipeline simulation: quick-fix moves', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('quick-fix moved to a feature: start this work\'s screen, its yes re-typing the unit, and the pipeline carrying on — the call its fix made read on the topic\'s record and shown at ready to build among Claude\'s, and none of the feature\'s build\'s', () => {
    const wu = 'grows';
    opened(sim, wu);

    // Its fix 1.1 begun, and a call of Claude's made for it.
    sim.run(['task', 'create', wu, '1', '--file', sim.write(`.leeway/.cache/${wu}-fix.md`, [
      '# Spell the flag', '', '## Type', 'fix', '', '## Problem', 'p', '', '## Solution', 's', '', '## Outcome', 'o', '',
      '## Acceptance scenarios', '- 1.S1 Given the help, when read, then spelt right.', '', '## Spec reference', 'none',
    ].join('\n'))]);
    sim.run(['task', 'start', wu, '1.1']);
    const made = { by: 'claude', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', `${wu}.implementation`], null, JSON.stringify({ ...made, text: 'Which spelling does the help use?' })).id;
    sim.run(['ledger', 'decide', `${wu}.implementation`, '--answers', asked, '--task', '1.1'], null, JSON.stringify({ ...made, text: 'QUICK-FIX CALL: the help says colour.', why: 'The flag is colour.' }));

    // The work needs a decision beyond a quick call: the move re-types the
    // unit at start this work's yes.
    const { next } = movedTo(sim, wu, 'feature');
    assert.strictEqual(sim.manifest(wu).work_type, 'feature');

    // The move hands straight to the new type's first phase — a feature's
    // discussion, which it runs normally to its yes: moved mid-fix, it asks,
    // decides and closes at its topic as a unit before its spec.
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-discussion-process feature ${wu}\`.`);
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
    assert.deepStrictEqual(sim.run(['ledger', 'record', wu, wu]).decisions.map((d) => [d.text, d.phase]), [['QUICK-FIX CALL: the help says colour.', 'discussion'], ['This.', 'discussion']]);

    // Its spec to ready to build, which shows the call the fix made among
    // Claude's, one the person has not seen; the build begun in auto.
    specWritten(sim, wu, [wu]);
    specReviewed(sim, wu);
    cutTheSpec(sim, wu, [{ name: 'The work', goal: 'The work holds as decided.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
    assert.match(readyToBuild(sim, wu), /^\*\*`c\/calls`\*\* +→ See Claude's 1 call$/m);
    assert.match(sim.render(['ready-to-build', wu, '--calls'], { expect: 'content' }), /QUICK-FIX CALL: the help says colour\./);
    intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));

    // The feature's build: its task writer's brief and its own task 1.1
    // meet none of the quick-fix's calls.
    continueInto(sim, wu, 'implementation');
    buildEntry(sim, wu);
    assert.doesNotMatch(briefOf(sim, sim.run(['brief', 'task-writer', wu, '1'])), /QUICK-FIX CALL/);
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
    startPhase(sim, wu, 1);
    sim.run(['task', 'start', wu, '1.1']);
    const page = JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--page', 'task:1.1'])).view;
    assert.deepStrictEqual([page.kind, page.calls], ['task', []]);
  });

  it('quick-fix moved to a feature mid-review: its closed finish checklist dropped with its fixes, the feature handed to its discussion with a finish of its own to work', () => {
    const wu = 'reviewed';
    opened(sim, wu);
    const [fix] = writeTasks(sim, wu, 1, [{ title: 'Spell the flag --colour', type: 'fix', reference: 'none', scenarios: ['1.S1 Given the flag, when it is passed, then it reads --colour.'] }]);
    sim.run(['task', 'start', wu, fix]);
    fixBuilt(sim, wu, fix, ['src/flag.js'], { record: 'The flag.' });
    sim.write(`.leeway/${wu}/build/log.md`, '# The fixes\n');
    finishClosed(sim, wu);
    sim.render(['finish', wu], { expect: 'content' });
    sim.run(answerGate(sim, 'finish', '--pick', 'r').next.argv);
    sim.run(['enter', 'review', wu]);
    reviewNext(sim, wu);

    const { next } = movedTo(sim, wu, 'feature');
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-discussion-process feature ${wu}\`.`);
  });

  it('quick-fix moved to a bugfix hands straight to its investigation', () => {
    const wu = 'deeper';
    opened(sim, wu);
    const { next } = movedTo(sim, wu, 'bugfix');
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-investigation-process bugfix ${wu}\`.`);
  });
});
