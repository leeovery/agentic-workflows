'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's quick-fix moves: a quick-fix moved mid-fix to a
// feature through start this work's screen, its pipeline carrying on to the
// build — ready to build showing the call its fix made among Claude's, the
// build's task writer's brief and task 1.1 meeting none of the quick-fix's
// calls — or to a bugfix, handed to its investigation (19.5.9).
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
  Sim, sessionLog, handoff, answerGate, discussed, briefDraft, specWritten, specReviewed, cutTheSpec, readyToBuild, intoTheBuild,
  linearBuildPick, buildEntry, briefOf, writePhaseTasks, startPhase,
} = require('./pipeline-world.cjs');

/**
 * The unit moved to `to` as the prose moves it (19.5.9): Claude's payload
 * staged on start this work's screen, the person's yes at its gate, and the
 * yes it leads to run. Answers the yes's answer.
 * @param {Sim} sim @param {string} wu @param {string} to
 */
function movedTo(sim, wu, to) {
  const file = sim.write(`.leeway/.cache/scratch/${wu}-move.json`, { description: `The ${wu} work, as ${to} work.`, reason: 'It needs a decision beyond a quick call.', brief: briefDraft(sim, wu, wu) });
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
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', log]);

    // Its fix 1.1 begun, and a call of Claude's made for it.
    sim.run(['enter', 'implementation', wu]);
    sim.run(['task', 'create', wu, '1', '--file', sim.write(`.leeway/.cache/${wu}-fix.md`, [
      '# Spell the flag', '', '## Type', 'fix', '', '## Problem', 'p', '', '## Solution', 's', '', '## Outcome', 'o', '',
      '## Acceptance scenarios', '- 1.S1 Given the help, when read, then spelt right.', '', '## Spec reference', 'none',
    ].join('\n'))]);
    sim.run(['task', 'start', wu, '1.1']);
    const made = { by: 'claude', who_moved_whom: 'none' };
    const asked = sim.run(['ledger', 'ask', `${wu}.implementation`], null, JSON.stringify({ ...made, text: 'Which spelling does the help use?' })).id;
    sim.run(['ledger', 'decide', `${wu}.implementation`, '--answers', asked, '--task', '1.1'], null, JSON.stringify({ ...made, text: 'QUICK-FIX CALL: the help says colour.', why: 'The flag is colour.' }));

    // Complexity check (complexity-check B): which criteria the change fails
    // is the session's read, so the messages ride a payload; the type is the
    // surface's to check. The move re-types the unit at start this work's yes.
    const concerns = sim.write(`.leeway/.cache/${wu}/scoping/${wu}/complexity.json`,
      { concerns: ['Requires design decisions about the new API surface'] });
    assert.match(sim.render(['complexity-gate', wu, '--file', concerns], { expect: 'content' }),
      /• Requires design decisions about the new API surface/);
    const { next } = movedTo(sim, wu, 'feature');
    sim.refuses(['render', 'complexity-gate', wu, '--file', concerns],
      /"grows" is a feature — the complexity check is the quick-fix's own/);

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
    linearBuildPick(sim, wu, 'implementation');
    buildEntry(sim, wu);
    assert.doesNotMatch(briefOf(sim, sim.run(['brief', 'task-writer', wu, '1'])), /QUICK-FIX CALL/);
    writePhaseTasks(sim, wu, 1, 'The work', [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
    startPhase(sim, wu, 1);
    sim.run(['task', 'start', wu, '1.1']);
    const page = JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--page', 'task:1.1'])).view;
    assert.deepStrictEqual([page.kind, page.calls], ['task', []]);
  });

  it('quick-fix moved to a bugfix hands straight to its investigation', () => {
    const wu = 'deeper';
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', sessionLog(sim, wu)]);
    const { next } = movedTo(sim, wu, 'bugfix');
    assert.strictEqual(handoff(sim, `/${next.skill} ${next.args.join(' ')}`).text, `Invoke \`/leeway-investigation-process bugfix ${wu}\`.`);
  });
});
