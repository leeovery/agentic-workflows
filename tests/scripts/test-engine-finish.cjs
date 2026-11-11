'use strict';

// ---------------------------------------------------------------------------
// Finish's checklist (leeway-engine/scripts/domain/finish.cjs, its engine
// items domain/finish-checks.cjs, 6.4.10): the review phase over, read from
// its rounds' records, only where the unit has a review phase, no question
// waiting on the person, and the unit's records indexed, only where the
// checkout's knowledge base is set up, each the engine's; Claude's item
// skipped, and the close (2.S2). The inbox item is
// test-engine-finish-inbox.cjs's, the screen test-engine-finish-screen.cjs's,
// the yes test-engine-finish-yes.cjs's, and a quick-fix's close
// test-engine-quick-fix-close.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { callAsync, keywordOnlyKnowledge, layout } = require('./engine-harness.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const {
  UNIT, EVERY, useWorld, env, enter, reported, recorded, fixPhaseWritten, taskMade, fixBuilt, fixClosed, reviewPassed, finishReady, readManifest, stateGit, ok, assert,
} = require('./review-world.cjs');
const { finishHelpers } = require('./finish-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { refused, checklist, items } = finishHelpers(() => dir);

describe('finish\'s checklist (6.4.10, 2.S2)', () => {
  it('reads the review phase passed from its rounds\' records — open in round 1 with the way in, open while a task of a passing round\'s fix phase waits, one written beyond its findings among them, done once each is built or closed — never marked', () => {
    const before = items();
    enter();
    reported(1, EVERY, { '2-refunds-a': ['nit: A refund\'s label is terse.'] });
    fixPhaseWritten(3, [['Word the label', '§2.1']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-a#1'], fix: '3.1' }] });
    taskMade(3, 'Mail the receipt', '§1.2');
    const waiting = items();
    fixBuilt(3, 1, 'Word the label', 'main', 'src/label.js');
    const beyond = items();
    fixClosed(3, 2);

    assert.deepStrictEqual([before, waiting, beyond, items()], [
      [`review-passed engine open — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`, 'questions-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
      [`review-passed engine open — ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.1 not started, task 3.2 not started`, 'questions-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
      [`review-passed engine open — ${UNIT}'s review phase passed in round 1 — its fix tasks are built, then finish: task 3.2 not started`, 'questions-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
      ['review-passed engine done', 'questions-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
    ]);
    assert.strictEqual(refused(['checklist', 'done', 'finish', UNIT, 'review-passed']), 'checklist done: review-passed is the engine\'s to check, never marked — it reads done once it holds');
  });

  it('12.13.22: holds the unit open while a question of it waits on the person, wherever it was raised, naming each and the stop — a close made before one was raised standing at neither the gate nor the yes', async () => {
    finishReady();
    const asks = 'Should a refund name its card?';
    const asked = ok(dir, ['ledger', 'ask', `${UNIT}.review`], { env: env(), stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: asks }) }).id;
    const raised = await callAsync(dir, ['raise', `${UNIT}.review`, '--answers', asked], { env: env(), stdin: JSON.stringify({ ...leaningCall('A refund names it.', 'A refund names none.'), question: asks }) });
    assert.strictEqual(raised.code, 0, raised.stderr);
    const { parked } = JSON.parse(raised.stdout.split('\n')[0]);

    assert.deepStrictEqual([items()[1], refused(['render', 'finish', UNIT]), refused(['finish', 'yes', UNIT]), refused(['land', 'finish', UNIT])], [
      `questions-answered engine open — ${parked}, ${asks} — the unit never finishes over a question waiting on the person: stop for them, render build-stop ${UNIT}, and take each once they are ready to discuss it`,
      'render finish: finish has items open since its close: questions-answered — they are worked, and it is closed again',
      'finish yes: finish has items open since its close: questions-answered — they are worked, and it is closed again',
      'land: finish has items open since its close: questions-answered — they are worked, and it is closed again',
    ]);
  });

  it('names the review\'s entry refusal as the way on where the review cannot be entered yet, and holds no review item for a quick-fix, but its notes answered', () => {
    assert.deepStrictEqual([items('half')[0], items('tweak')], [
      'review-passed engine open — half\'s review phase starts once every phase of its cut has closed — phase 2 of 2 has not: enter implementation half',
      ['questions-answered engine done', 'notes-answered engine done', 'inbox-closed engine done', 'build-log-closed claude open'],
    ]);
  });

  it('reads the records indexed only where the knowledge base is set up: open, naming each record the store does not hold as it stands, done once the unit is indexed', async () => {
    const unset = items();
    keywordOnlyKnowledge(dir);
    const open = checklist(['show', 'finish', UNIT]).items.at(-1);
    assert.strictEqual((await callAsync(dir, ['knowledge', 'index', '--work-unit', UNIT], { env: env() })).code, 0);

    assert.deepStrictEqual([unset.length, open, items().at(-1)], [4, {
      key: 'records-indexed', text: 'the records indexed', by: 'engine', state: 'open',
      way: `the knowledge base does not hold .knowledge/records/${UNIT}.md as it stands — knowledge index --work-unit ${UNIT}`,
    }, 'records-indexed engine done']);
  });

  it('ends Claude\'s item skipped with its reason, and the close recorded on the unit\'s manifest — Claude\'s mark and the close alone, each write committed alone', () => {
    reviewPassed();
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { state, reason, at } = checklist(['skip', 'finish', UNIT, 'build-log-closed', '--reason', 'The build kept no log.']);
    const closing = checklist(['close', 'finish', UNIT]);

    assert.deepStrictEqual(readManifest(dir, UNIT).checklists.finish, { items: { 'build-log-closed': { state, reason, at } }, closed: closing.closed });
    assert.deepStrictEqual(stateGit(dir, ['log', '--reverse', '--format=%s', `${before}..HEAD`]).trim().split('\n'), [
      `checklist(${UNIT}): finish build-log-closed skipped`, `checklist(${UNIT}): finish closed`,
    ]);
    assert.deepStrictEqual([...new Set(stateGit(dir, ['log', '--format=', '--name-only', `${before}..HEAD`]).trim().split('\n'))], [layout.manifest(UNIT)]);
  });
});
