'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios: the epic started and its map
// approved at discovery's gates; a topic's discussion, with a
// message raised and answered through the topic's one mailbox; and a topic
// landed in discovery started from its own row. The map's own lifecycle is
// test-pipeline-simulation-epic-map.cjs; the sweep before the spec,
// test-pipeline-simulation-epic-sweep.cjs; the spec's side, from its entry
// to ready to build, test-pipeline-simulation-epic-spec.cjs; a discussion walked
// backwards, test-pipeline-simulation-backwards.cjs.
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
const { readManifest } = require('./engine-harness.cjs');
const path = require('path');
const {
  Sim, mapTopics, sessionLog, send, decideTopic, mappedEpic, enterEntry, handoff, epicMenuAt, epicRow, epicKey, epicPick, startNew, shapedInTheProduct, briefDraft, startThisWork, approveTheMap, carryOn, presenceRow,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: epic', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: start this work creates the epic and carries its conversation into it; the map\'s yes lands the topics in order and hands off to the menu, which recommends the first', () => {
    const wu = 'fumi';
    startNew(sim);
    const started = startThisWork(sim, {
      type: 'epic', name: wu, description: 'Stickies, but smarter.', reason: 'Its parts each need decisions.',
      shaped_by: [shapedInTheProduct(sim, 'notes')],
    });
    assert.deepStrictEqual(started.next, { kind: 'engine', argv: ['enter', 'discovery', wu, '--move'] });
    // The product's session closed with the yes, so the move leaves no log
    // behind: the epic's first log, pointing back, takes the conversation.
    sim.run(started.next.argv);
    assert.deepStrictEqual(carryOn(sim).position, { name: wu, phase: 'discovery', topic: wu });
    const [pointer, ...rest] = fs.readFileSync(path.join(sim.dir, '.leeway', wu, 'discovery/session-001.md'), 'utf8').split('\n');
    assert.strictEqual(pointer, 'Shaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)');
    assert.match(rest.find((line) => line !== '') ?? '', /^## /, 'the conversation\'s line follows the pointer');
    assert.ok(presenceRow(sim.run(['presence', 'scan', wu]), 'discovery', wu)?.held, 'the presence is the epic\'s');
    assert.match(carryOn(sim).text, /render discovery-map fumi`/, 'a compaction re-reads the epic\'s map');
    const map = {
      topics: [
        { name: 'note-model', summary: 'What a note is', brief: briefDraft(sim, wu, 'note-model') },
        { name: 'sync', summary: 'Notes between Macs', brief: briefDraft(sim, wu, 'sync') },
      ],
    };
    sim.render(['approve-map', wu, '--file', sim.write('.leeway/.cache/scratch/staged-map.json', map)], { expect: 'content' });
    const drawn = (/** @type {string[]} */ args) => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, ...args])).view;
    const [shaping] = drawn(['--tab', 'unit']).phases;
    const { phase, standing } = drawn(['--tab', 'all']).units.find((/** @type {{unit: string}} */ { unit }) => unit === wu);
    assert.deepStrictEqual([shaping.phase, shaping.words, phase, standing], ['discovery', '2 topics', 'discovery', '2 topics on the map'],
      'N1, 20.15.2, 20.16.1: while the map waits, the epic\'s tab and All work say it is in discovery with the map\'s topics');
    const approved = approveTheMap(sim, wu, map);
    assert.deepStrictEqual(approved.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [wu] });
    handoff(sim, `/leeway-continue-epic ${wu}`);
    const first = epicKey(sim, wu, 'note-model');
    assert.deepStrictEqual([first.key, first.recommended], ['1', true]);
    const { now, lately: [moment] } = JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID])).view;
    const yes = readManifest(sim.dir, wu).phases.discovery.approved_at;
    assert.deepStrictEqual([now, moment.kind, moment.detail], [{ phase: 'discussion', since: yes }, 'map-approved', '2 topics, 0 to the roadmap'],
      'S2, N8, 20.11.4: at its menu, the epic\'s discovery closed when the map\'s yes recorded its approval, the moment saying what the map took in');
  });

  it('epic: a message lands in the topic\'s one mailbox, raised at the entry and answered by the question it raised; one to the decided topic sets it back in progress', () => {
    const wu = 'orbit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Orbit', '--session-log-file', log]);
    mapTopics(sim, wu, [
      { name: 'alpha', summary: 'Alpha summary' },
      { name: 'beta', summary: 'Beta summary' },
    ]);
    sim.run(['topic', 'order', wu, 'alpha=1', 'beta=2']);
    const row = (/** @type {string} */ title) => epicRow(sim, wu, title);

    // Alpha's row hands off to its discussion, whose entry starts it.
    epicPick(sim, wu, 'alpha');
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.strictEqual(row('Alpha'), '1 → Continue "Alpha" — in progress (recommended)');
    // A peer sitting in the discussion keeps its row on the menu, struck;
    // the hold released, the row is free again.
    const peerInAlpha = sim.session('peer-in-alpha', 1);
    peerInAlpha.run(['presence', 'beat', wu, 'discussion', 'alpha']);
    assert.match(row('Alpha') ?? '', /^2 → ~~Continue "Alpha" — in progress~~ · in session \(last active \d+s ago\)$/, 'struck, its place kept, the recommendation passing to Beta');
    peerInAlpha.run(['presence', 'clear', wu, 'discussion', 'alpha']);
    // A landing is the engine's own act — never held: it waits in the
    // topic's one mailbox, the discussion under way left as it stands, and
    // the mail rides alpha's row; the report ends with the way into it.
    const decision = send(sim, wu, 'alpha', 'beta', 'a-decision');
    assert.strictEqual(decision.message_path, path.join(sim.dir, `.leeway/${wu}/topics/alpha/mail/001-a-decision.md`));
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.strictEqual(row('Alpha'), '1 → Continue "Alpha" — in progress · mail waiting (recommended)');
    assert.match(sim.render(['send-report', `${wu}.alpha`, '--sent', decision.message_path], { expect: 'content' }), /^\/leeway orbit alpha$/m);
    // The entry raises the waiting message before anything is read; the
    // question it raised is asked, and the message answered by it leaves.
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.match(sim.sections, /^=== DISPLAY: waiting mail [^\n]*\n1 message waiting — raised before anything else\n\nFrom Beta · \d{1,2} [A-Z][a-z]{2}\na-decision\n/);
    const raised = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does a-decision change alpha?' }));
    assert.strictEqual(sim.run(['topic', 'answered', wu, 'alpha', '001-a-decision', '--entry', raised.id]).remaining, 0);
    assert.strictEqual(row('Alpha'), '1 → Continue "Alpha" — in progress (recommended)');
    // Claude answers the question the message raised, and alpha closes at
    // the decided screen, its yes adding the candidate Claude staged to the
    // map with the brief Claude drafted for it.
    const claudes = (/** @type {string} */ question, /** @type {string} */ text) => sim.run(['ledger', 'decide', `${wu}.discussion.alpha`, '--answers', question], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, why: 'The message changes nothing alpha decided.' }));
    claudes(raised.id, 'It leaves alpha as it stands.');
    const brief = sim.write('.leeway/.cache/scratch/brief-gamma.md', '# Gamma\n\nWhat alpha opened, where, why it matters, and what stays open.\n');
    const decided = decideTopic(sim, wu, 'alpha', { lines: [], candidates: [{ name: 'gamma', reason: 'Alpha opened a question of its own.', brief }] });
    assert.deepStrictEqual(decided.candidates, ['gamma']);
    assert.deepStrictEqual(decided.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [wu] });
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.gamma.summary, 'Alpha opened a question of its own.');
    assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/${wu}/topics/gamma/brief.md`)), 'the candidate lands with its brief');

    // A message to the decided topic sets it back in progress, its mail
    // waiting on its row; answered, it is decided again, its checklist
    // worked afresh.
    const late = send(sim, wu, 'alpha', 'beta', 'late-call');
    assert.strictEqual(late.reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.strictEqual(row('Alpha'), '1 → Continue "Alpha" — in progress · mail waiting (recommended)');
    const lateQuestion = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the late call hold?' }));
    sim.run(['topic', 'answered', wu, 'alpha', '001-late-call', '--entry', lateQuestion.id]);
    claudes(lateQuestion.id, 'It holds.');
    sim.refuses(['render', 'decided', `${wu}.alpha`], /close was taken by the decided gate's yes, and the topic was set back in progress since/);
    decideTopic(sim, wu, 'alpha');
  });

  it('epic: an epic enters discussion at a topic, and a topic landed in discovery has its own start row, whose entry starts it', () => {
    const wu = 'lumen';
    mappedEpic(sim, wu, ['alpha']);
    handoff(sim, `/leeway-continue-epic ${wu}`);
    epicMenuAt(sim, wu);
    sim.refuses(['handoff', '/leeway-discussion-process', 'epic', wu], /^an epic enters discussion at a topic/);

    const topic = 'omega';
    sim.run(['topic', 'add', wu, topic, '--summary', `What ${topic} covers`, '--description', `Why ${topic} matters now.`, '--brief', briefDraft(sim, wu, topic)]);
    const route = `/leeway-discussion-process epic ${wu} ${topic}`;
    assert.strictEqual(epicPick(sim, wu, topic).text, `Invoke \`${route}\`.`);
    assert.strictEqual(enterEntry(sim, wu, 'discussion', topic).started, true);
  });
});
