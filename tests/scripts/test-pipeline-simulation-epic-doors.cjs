'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's doors on and off the epic's menu: every change
// of the map made through its discovery row, as discovery's
// changing-the-map.md makes it — each asked in the person's words done in a
// line, only a cancel confirmed — a cancelled topic's mail moved to the
// inbox, a postponed topic's waiting for its return; a decided topic an
// answer it relied on, replaced since, holds, waiting first and opened by
// its door to confirm or replace, then decided again; and a feature
// cancelled inside its own session moving to the start menu. A topic left
// inside its own session is test-pipeline-simulation-epic-topics.cjs's.
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
  Sim, mappedEpic, startUnit, enterEntry, handoff, follow, answerGate, askedOn, briefDraft, decideTopic, discussed, send, epicKey, epicMenuAt, epicPick,
  epicSetAside, startMenu,
} = require('./pipeline-world.cjs');
const { screenOf } = require('./engine-harness.cjs');

const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });

describe('pipeline simulation: the epic menu\'s doors', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  /** What a verb or a render drew: its one DISPLAY line. @param {string} out */
  const oneLine = (out) => {
    const shown = screenOf(out, out.match(/^=== (DISPLAY: .+?) \(/m)?.[1] ?? '').filter((line) => line.trim() !== '');
    assert.strictEqual(shown.length, 1, out);
    return shown[0];
  };

  /** A topic's receipt, `flags` given. @param {string} wu @param {string} topic @param {string[]} flags */
  const receipt = (wu, topic, flags) => oneLine(sim.render(['topic-receipt', `${wu}.discovery.${topic}`, ...flags], { expect: 'content' }));

  /** A message sent from one topic to another, and the sending session's report of it. @param {string} wu @param {string} to @param {string} from @param {string} slug */
  function sent(wu, to, from, slug) {
    const res = send(sim, wu, to, from, slug);
    return { res, report: sim.render(['send-report', `${wu}.${to}`, '--sent', res.message_path ?? res.inbox_path], { expect: 'content' }) };
  }

  it('18.S15, 18.S45, 8.S11, 8.S20, 18.S18, 10.S13: every change of the map goes through the discovery row — none has a row of its own; each asked in words is done in a line, only a cancel confirming; a cancel moves the waiting mail to the inbox, and a postponed topic\'s waits for its return', () => {
    const wu = 'doors';
    mappedEpic(sim, wu, ['alpha', 'beta', 'gamma']);
    discussed(sim, wu, 'beta');
    sim.handOver();
    for (const slug of ['first-word', 'second-word']) send(sim, wu, 'gamma', 'alpha', slug);

    const rows = screenOf(epicMenuAt(sim, wu), 'MENU: epic menu').slice(3).join('\n').split(/\n(?=\S)/).map((row) => row.replace(/\s+/g, ' '));
    assert.deepStrictEqual(rows.filter((row) => /new topic|cancel|postpone|pull forward|reactivate|reopen/i.test(row)),
      ['d/discovery → Change the map — a new topic, cancel, postpone, pull forward, reactivate, or reopen a decided topic'],
      'the discovery row alone, saying what it is for');
    assert.strictEqual(epicPick(sim, wu, 'd').line, `→ Discovery · ${wu}`);
    sim.handOver();
    sim.run(['enter', 'discovery', wu]);

    sim.run(['topic', 'add', wu, 'delta', '--summary', 'Delta', '--brief', briefDraft(sim, wu, 'delta')]);
    assert.strictEqual(oneLine(sim.sections), 'Added "Delta" to the map.');

    sim.run(['topic', 'postpone', wu, 'alpha', '--horizon', 'next']);
    assert.match(receipt(wu, 'alpha', ['--verb', 'postpone']), /^Postponed "Alpha" → next\.$/);
    const held = sent(wu, 'alpha', 'gamma', 'while-away');
    assert.ok(held.res.message_path.includes(`/${wu}/topics/alpha/mail/`), '10.S13: a postponed topic\'s message waits in its mailbox');
    assert.ok(screenOf(held.report, 'DISPLAY: send report').includes('  ↳ Postponed — waiting in its mailbox for its return'), held.report);
    const back = sim.run(['roadmap', 'pull-forward', 'alpha', '--into', wu]);
    assert.deepStrictEqual(back.restored, [], 'never started, it returns to the map alone');
    assert.match(receipt(wu, 'alpha', ['--verb', 'restore']), /^Pulled "Alpha" forward\.$/);

    assert.match(sim.render(['cancel-gate', `${wu}.discovery.gamma`], { expect: 'content' }), /^=== MENU: cancel gate /m);
    const { next } = answerGate(sim, 'cancel gate', '--pick', 'y');
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['topic', 'cancel', wu, 'discovery', 'gamma'] });
    const cancelled = sim.run(next.argv);
    assert.deepStrictEqual([cancelled.inbox.length, JSON.parse(sim.read(['topic', 'mailbox', wu, 'gamma'])).count], [2, 0], '18.S18: both waiting messages land in the inbox');
    assert.match(receipt(wu, 'gamma', ['--verb', 'cancel', '--inbox', '2']), /^Cancelled "Gamma"\. Its 2 waiting messages went to the inbox as ideas\.$/);
    assert.strictEqual(oneLine(sent(wu, 'gamma', 'beta', 'too-late').report), 'Gamma is cancelled, so the message went to the inbox as an idea',
      '10.S13: a cancelled topic\'s message goes to the inbox, the sending session saying so in a line');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'gamma']);
    assert.match(receipt(wu, 'gamma', ['--verb', 'reactivate']), /^Reactivated "Gamma"\./);

    const reopened = sent(wu, 'beta', 'gamma', 'think-again');
    assert.strictEqual(reopened.res.reopened, true, 'a decided topic is reopened by a message');
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): change the map`]);

    assert.deepStrictEqual(epicSetAside(sim, wu), [], 'nothing set aside: gamma came back, alpha was pulled forward');
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.match(sim.sections, /^=== DISPLAY: waiting mail [^\n]*\n1 message waiting — raised before anything else\n/, '10.S13: the waiting message is raised first on its return');
  });

  it('18.S52, 10.2.6: a decided topic an answer it relied on, replaced since, holds waits first on the epic\'s menu; its door opens it, still decided, and once each such entry still holds it is decided again with no key', () => {
    const wu = 'relies';
    mappedEpic(sim, wu, ['alpha', 'beta']);
    enterEntry(sim, wu, 'discussion', 'beta');
    const homes = askedOn(sim, wu, 'beta', 'Does a space remember its notes?');
    const homed = sim.run(['ledger', 'decide', `${wu}.discussion.beta`, '--answers', homes], null, JSON.stringify({ ...CLAUDE, text: 'It does.', why: 'Spaces remember.' })).id;
    enterEntry(sim, wu, 'discussion', 'alpha');
    const opens = askedOn(sim, wu, 'alpha', 'Where does a note open?');
    const relying = sim.run(['ledger', 'decide', `${wu}.discussion.alpha`, '--answers', opens, '--relies-on', homed], null, JSON.stringify({ ...CLAUDE, text: 'In its space.', why: 'Spaces remember.' })).id;
    decideTopic(sim, wu, 'alpha');
    enterEntry(sim, wu, 'discussion', 'beta');
    const replaced = sim.run(['ledger', 'replace', `${wu}.discussion.beta`, '--replaces', homed, '--reason', 'changed-mind'], null,
      JSON.stringify({ by: 'person', drops: ['the old answer'], text: 'It does not.', why: 'The person wants it so.' })).id;

    sim.handOver();
    const row = epicKey(sim, wu, 'alpha');
    assert.deepStrictEqual([row.key, row.recommended, row.head], ['1', true, '"Alpha": a decision it relies on changed']);
    follow(sim, answerGate(sim, 'epic menu', '--pick', row.key).next);
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.match(sim.sections, /^stays decided: entered for its affected entries alone$/m);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'completed', 'the topic stays decided');

    sim.run(['ledger', 'hold', `${wu}.discussion.alpha`, '--entry', relying, '--after', replaced], null, JSON.stringify(CLAUDE));
    handoff(sim, `/leeway-continue-epic ${wu}`);
    assert.match(epicMenuAt(sim, wu), /^DECIDED\n {2}└─ Alpha$/m);
    sim.refuses(['handoff', 'topic', wu, 'alpha'], /^the topic "alpha" is decided — it reopens through a message sent to it, or through the epic menu's discovery row$/);
  });

  it('18.S56: a feature cancelled inside its own session is confirmed, cancelled as manage cancels it, and the session moves to the start menu', () => {
    const wu = 'called-off';
    startUnit(sim, 'feature', wu, 'A feature called off');
    enterEntry(sim, wu, 'discussion', wu);
    sim.render(['cancel-gate', wu], { expect: 'content' });
    const { next } = answerGate(sim, 'cancel gate', '--pick', 'y');
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['workunit', 'cancel', wu] });
    const cancelled = sim.run(next.argv);

    assert.deepStrictEqual(cancelled.next, { kind: 'handoff', skill: 'leeway', args: [] });
    assert.strictEqual(follow(sim, cancelled.next).line, '→ Start');
    assert.ok(!startMenu(sim).some((row) => row.next?.kind === 'engine' && row.next.argv.join(' ') === `handoff unit ${wu}`), 'the unit is no longer in progress');
  });
});
