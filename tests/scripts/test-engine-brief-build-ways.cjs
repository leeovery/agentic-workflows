'use strict';

// ---------------------------------------------------------------------------
// The way on from a task's round (leeway-engine/scripts/domain/
// round-report.cjs, brief-records.cjs, task-account.cjs; 12.1.4, 12.14,
// 24.2.4): a round not reported whole names each reviewer's way on, the
// builder's brief waiting on it; a failed round's fix brief refused with no
// builder briefed in this conversation, or the task changed after the
// round's reports, naming the builder's brief first; and a task landing
// nowhere with no account taken over its review as it stands, its reviewer
// told the account is owed again — a parked task its pair passed owing
// none, and its reviewer given no way on.
//
// Layer: verb. World: brief-build-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { refuses, accountTaken } = require('./engine-harness.cjs');
const {
  UNIT,
  SESSION_ID,
  useWorld,
  issued,
  ok,
  statePath,
  writeState,
  conversationDir,
  PASSED,
  reported,
  briefedFor,
  added,
  BUILDING,
  builderBrief,
  notWhole,
  briefedEarlier,
  fixOfRound1,
  ADDED,
  fixRefused,
  over,
  reviewerRefused,
} = require('./brief-build-world.cjs');

const { appendEntry } = require('../../skills/leeway-engine/scripts/domain/ledger.cjs');

/** @type {string} */
let dir;

/** Why a report holding neither its findings' heading nor a verdict does not read, as round-report.cjs says it. */
const NOT_READ = 'its last heading at level one or two is not `## Findings`; its last line is not `Verdict: pass` or `Verdict: fail`';

describe('the way on from a round (12.1.4, 12.14, 24.2.4)', () => {
  useWorld((at) => { dir = at; });

  it('S1 (12.1.4): a round not reported whole names each reviewer\'s way on — one an earlier conversation briefed is briefed for the round, one whose report does not read goes back to it — and once each reads, the builder goes back', () => {
    briefedFor(1);
    const earlier = builderBrief();
    reported(1, 'a', 'Half a report.\n');
    reported(1, 'b', PASSED);
    const unread = builderBrief();
    reported(1, 'a', PASSED);

    assert.strictEqual(earlier, notWhole(1, [briefedEarlier('a'), briefedEarlier('b')]));
    assert.strictEqual(unread, notWhole(1, [`reviewer a's report does not read — ${NOT_READ}: it goes back to its reviewer, engine brief reviewer pay 1.2 --letter a`]));
    assert.ok(issued(['builder', UNIT, '1.2']).brief.includes('Your reviewers passed the task in round 1: it has landed, so write its account now.'));
  });

  it('N1 (24.2.4): a round failing with no builder of the task briefed in this conversation — a /clear while its pair read it — refuses the fix brief, naming the builder\'s brief to send a new builder first; then the fix brief goes', () => {
    ok(dir, ['brief', 'builder', UNIT, '1.2'], { env: { CLAUDE_CODE_SESSION_ID: BUILDING } });
    fs.rmSync(conversationDir(BUILDING), { recursive: true, force: true });
    briefedFor(1);
    reported(1, 'a');
    reported(1, 'b', PASSED);

    const refusal = fixRefused();
    issued(['builder', UNIT, '1.2']);
    const { res, brief } = issued(['fix', UNIT, '1.2']);

    assert.strictEqual(refusal, 'task 1.2 of pay has no builder briefed in this conversation, so none to send the round back to: send a new builder its brief first, engine brief builder pay 1.2, which carries the task, the engine and where it builds, then this fix brief');
    assert.strictEqual(brief, fixOfRound1(res.id));
  });

  it('S2 (12.14): an account taken over fewer rounds than the review now holds lands nothing — a Comment after the account, then a passing round — land open and task done refused until it is taken again, and its reviewer told its account is owed, never to land it', () => {
    briefedFor(1);
    reported(1, 'a', PASSED);
    reported(1, 'b', PASSED);
    accountTaken(dir, UNIT, '1.2');
    writeState(dir, 'pay/build/tasks/1.2/addition.md', 'Show the amount.\n');
    ok(dir, ['task', 'add', UNIT, '1.2', '--file', statePath(dir, 'pay/build/tasks/1.2/addition.md'), '--by', 'person']);
    briefedFor(2);
    reported(2, 'a', PASSED);
    reported(2, 'b', PASSED);

    const owed = /: task 1\.2 of pay has no account taken of its review as it stands — once its builder writes it from its brief, engine brief builder pay 1\.2, take it: engine task account pay 1\.2$/;
    for (const verb of [['land', 'open'], ['task', 'done']]) assert.match(refuses(dir, [...verb, UNIT, '1.2']).error, owed, verb.join(' '));
    reviewerRefused(over(2));
  });

  it('13.4.6, 12.14: a task its pair passed while a question waiting parks it owes no account: its builder\'s brief says it waits, nothing lands it, and its reviewer is given no way on', () => {
    reported(1, 'a', PASSED);
    reported(1, 'b', PASSED);
    const tags = { unit: UNIT, topic: null, phase: 'implementation', session: SESSION_ID };
    const { id: question } = appendEntry(statePath(dir), { event: 'asked', ...tags, by: 'claude', who_moved_whom: 'none', text: 'Does a receipt show the tax?', part_of: null, relies_on: [], cites: [], task: '1.2' }, []);
    const rows = [{ key: '1', name: 'Shown', text: 'The receipt shows the tax', notice: 'a line for tax' }, { key: '2', name: 'Folded', text: 'The total holds the tax', notice: 'no tax line' }];
    appendEntry(statePath(dir), {
      event: 'parked', ...tags, question, replaces: null, reason: null, cause: null, relies_on: [], task: '1.2', number: 1,
      call: { question: 'Should a receipt show the tax?', rows, lean: '1', why: 'Customers ask.', sort: 'one', mechanism: 'A line.', product_wide: false }, rows_judged: [], why_asking: 'Every call asks.',
    }, []);

    const { brief } = issued(['builder', UNIT, '1.2']);

    assert.ok(brief.includes('Your reviewers passed the task, and it waits on Q1, a question for the person: write no account while it waits — the answer decides whether the task lands as they passed it, or changes.'), brief);
    assert.ok(!brief.includes('it has landed'), brief);
    for (const verb of [['land', 'open'], ['task', 'done']]) assert.match(refuses(dir, [...verb, UNIT, '1.2']).error, /waits on Q1, parked for the person/);
    reviewerRefused('round 1 of task 1.2 of pay passed — its review is over');
  });

  it('S2 (12.14): a task its pair passed, its account not taken, lands nowhere — land open, land chain and task done each refused, naming its builder\'s brief', () => {
    reported(1, 'a', PASSED);
    reported(1, 'b', PASSED);
    const owed = new RegExp(`: task 1\\.2 of ${UNIT} has no account taken of its review as it stands — once its builder writes it from its brief, engine brief builder ${UNIT} 1\\.2, take it: engine task account ${UNIT} 1\\.2$`);
    for (const verb of [['land', 'open'], ['land', 'chain'], ['task', 'done']]) assert.match(refuses(dir, [...verb, UNIT, '1.2']).error, owed, verb.join(' '));
  });

  it('N2 (6.5.10): something added after a failed round\'s reports and before its fix — the builder\'s brief again first, then the fix brief holding nothing but the reports', () => {
    issued(['builder', UNIT, '1.2']);
    briefedFor(1);
    reported(1, 'a');
    reported(1, 'b', PASSED);
    added('The receipt names the amount.');

    const refused = fixRefused();
    const builder = issued(['builder', UNIT, '1.2']).brief;
    const { res, brief } = issued(['fix', UNIT, '1.2']);

    assert.match(refused, /^task 1\.2 of pay changed since its builder's last brief — /);
    assert.ok(builder.includes(ADDED), builder);
    assert.strictEqual(brief, fixOfRound1(res.id));
  });
});
