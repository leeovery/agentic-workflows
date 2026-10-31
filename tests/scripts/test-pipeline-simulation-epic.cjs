'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's epic scenarios: a topic's discussion, with a
// message raised and answered through the topic's one mailbox; the d door
// naming the new topic; an arrival that backfills; and the last review
// handing off to the menu. The map's own lifecycle is
// test-pipeline-simulation-epic-map.cjs; a discussion walked backwards,
// test-pipeline-simulation-backwards.cjs.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const { epicMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { drawLabel } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/surfaces.cjs'));
const {
  Sim, sessionLog, send, decideTopic, discussed, mappedEpic, arrive, menuEntry, enterEntry, handoff, arriveAtEpicMenu, epicPick,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: epic', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('epic: a message lands in the topic\'s one mailbox, raised at the entry and answered by the question it raised; one to the decided topic sets it back in progress', () => {
    const wu = 'orbit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Orbit', '--session-log-file', log]);
    const topics = sim.write(`.leeway/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'discussion', summary: 'Alpha summary' },
      { name: 'beta', routing: 'discussion', summary: 'Beta summary' },
    ]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2']);
    const rows = (topic) => epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys
      .filter((k) => k.topic === topic).map((k) => [k.action, drawLabel(k.label)]);

    // Alpha's row hands off to its discussion, whose entry starts it.
    epicPick(sim, wu, 'start_discussion', 'alpha');
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.deepStrictEqual(rows('alpha').map((r) => r[0]), ['continue_discussion']);
    // A peer sitting in the discussion keeps its row on the menu, struck,
    // over the scan the gateway hands the projection; the hold released, the
    // row is free again.
    const peerInAlpha = sim.session('peer-in-alpha', 1);
    peerInAlpha.run(['presence', 'beat', wu, 'discussion', 'alpha']);
    const heldScan = sim.run(['presence', 'scan', wu]).sessions;
    assert.strictEqual(heldScan.find((r) => r.phase === 'discussion' && r.topic === 'alpha').held, true);
    assert.deepStrictEqual(
      epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu), { presence: heldScan }).keys
        .filter((k) => k.topic === 'alpha').map((k) => [k.action, k.in_session === true]),
      [['continue_discussion', true]]);
    peerInAlpha.run(['presence', 'clear', wu, 'discussion', 'alpha']);
    // A landing is the engine's own act — never held: it waits in the
    // topic's one mailbox, the discussion under way left as it stands, and
    // the mail rides alpha's row; the report ends with the way into it.
    const decision = send(sim, wu, 'alpha', 'beta', 'a-decision');
    assert.strictEqual(decision.message_path, path.join(sim.dir, `.leeway/${wu}/topics/alpha/mail/001-a-decision.md`));
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.deepStrictEqual(rows('alpha'), [['continue_discussion', 'Continue "Alpha" — *discussion* · mail waiting']]);
    assert.match(sim.render(['send-report', `${wu}.alpha`, '--sent', decision.message_path], { expect: 'content' }), /^\/leeway orbit alpha$/m);
    sim.refuses(['discovery-map', 'handle', wu, 'alpha'], /messages wait in its mailbox/);
    sim.render(['epic-soft-gate', wu, '--action', 'continue_discussion', '--topic', 'alpha'], { expect: 'empty' });
    // The entry raises the waiting message before anything is read; the
    // question it raised is asked, and the message answered by it leaves.
    enterEntry(sim, wu, 'discussion', 'alpha');
    assert.match(sim.sections, /^=== DISPLAY: waiting mail [^\n]*\n1 message waiting — raised before anything else\n\nFrom Beta · \d{1,2} [A-Z][a-z]{2}\na-decision\n/);
    const raised = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does a-decision change alpha?' }));
    assert.strictEqual(sim.run(['topic', 'answered', wu, 'alpha', '001-a-decision', '--entry', raised.id]).remaining, 0);
    assert.deepStrictEqual(rows('alpha'), [['continue_discussion', 'Continue "Alpha" — *discussion*']]);
    // Claude answers the question the message raised, and alpha closes at
    // the decided screen, its yes adding the candidate Claude staged to the
    // map.
    const claudes = (/** @type {string} */ question, /** @type {string} */ text) => sim.run(['ledger', 'decide', `${wu}.discussion.alpha`, '--answers', question], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, why: 'The message changes nothing alpha decided.' }));
    claudes(raised.id, 'It leaves alpha as it stands.');
    const decided = decideTopic(sim, wu, 'alpha', { lines: [], candidates: [{ name: 'gamma', reason: 'Alpha opened a question of its own.' }] });
    assert.deepStrictEqual(decided.candidates, ['gamma']);
    assert.deepStrictEqual(decided.next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [wu, 'discussion', 'completed'] });
    assert.strictEqual(sim.manifest(wu).phases.discovery.items.gamma.summary, 'Alpha opened a question of its own.');

    // A message to the decided topic sets it back in progress, its mail
    // waiting on its row; answered, it is decided again, its checklist
    // worked afresh.
    const late = send(sim, wu, 'alpha', 'beta', 'late-call');
    assert.strictEqual(late.reopened, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.status, 'in-progress');
    assert.deepStrictEqual(rows('alpha'), [['continue_discussion', 'Continue "Alpha" — *discussion* · mail waiting']]);
    const lateQuestion = sim.run(['ledger', 'ask', `${wu}.discussion.alpha`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Does the late call hold?' }));
    sim.run(['topic', 'answered', wu, 'alpha', '001-late-call', '--entry', lateQuestion.id]);
    claudes(lateQuestion.id, 'It holds.');
    sim.refuses(['render', 'decided', `${wu}.alpha`], /close was taken by the decided gate's yes, and the topic was set back in progress since/);
    decideTopic(sim, wu, 'alpha');
  });

  it('epic: the d door names the new topic and lands its map row before the handoff carries it — a name on the map puts the menu back', () => {
    const wu = 'lumen';
    mappedEpic(sim, wu, ['alpha']);
    handoff(sim, `/leeway-continue-epic ${wu}`);
    arrive(sim, wu);

    // The door is the menu's own flow: a row with no route, never handed to
    // the soft gate, and the handoff refuses an epic's discussion without a
    // topic.
    const doors = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys.filter((k) => k.action.startsWith('new_'));
    assert.deepStrictEqual(doors.map((k) => [k.key, k.action, k.route]), [['d', 'new_discussion', null]]);
    sim.refuses(['render', 'epic-soft-gate', wu, '--action', 'new_discussion'], /unknown --action "new_discussion"/);
    sim.refuses(['handoff', '/leeway-discussion-process', 'epic', wu], /^an epic enters discussion at a topic/);

    // A name already on the map is refused before anything lands.
    const before = JSON.stringify(sim.manifest(wu));
    assert.match(sim.render(['direct-entry-gate', `${wu}.discussion.alpha`], { expect: 'content' }), /Its row on the menu names the next step\./);
    assert.strictEqual(JSON.stringify(sim.manifest(wu)), before, 'a refused name writes nothing');

    // A new name passes, lands on the map started fresh, and hands off with the
    // topic — the route its own start row builds — whose entry starts it.
    const topic = 'omega';
    sim.render(['direct-entry-gate', `${wu}.discussion.${topic}`], { expect: 'empty' });
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discovery.${topic}`]), '');
    sim.run(['discovery-map', 'add', wu, topic, 'discussion', '--source', 'direct-start',
      '--summary', `What ${topic} covers`, '--description', `Why ${topic} matters now.`, '--force-dismissed']);
    const route = `/leeway-discussion-process epic ${wu} ${topic}`;
    assert.strictEqual(handoff(sim, route).args, `epic ${wu} ${topic}`);
    assert.strictEqual(epicPick(sim, wu, 'start_discussion', topic).text, `Invoke \`${route}\`.`);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.discovery.${topic}`, 'source']), 'direct-start');
    menuEntry(sim, wu);
    assert.strictEqual(enterEntry(sim, wu, 'discussion', topic).started, true);
  });

  it('an epic arrival that backfills hands the menu off to start afresh, carrying the banner', () => {
    // A discussion sends a message to a topic it opens (create-discovery-
    // topic B): the row lands with no summary or description for the next
    // epic entry to draft. The conclusion's arrival meets it at Step 2, the
    // backfill commits, and backfill-checks C hands the menu off with the
    // arguments it arrived with — the fresh menu recovers nothing and leads
    // with the banner.
    const wu = 'sends';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Sends', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
      [{ name: 'alpha', routing: 'discussion', summary: 'Alpha', description: 'What alpha settles.' }])]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
    const toRecover = () => EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu))
      .split('\n').filter((line) => /summary=absent|description=absent/.test(line));

    menuEntry(sim, wu);
    enterEntry(sim, wu, 'discussion', 'alpha');
    sim.write(`.leeway/${wu}/topics/alpha/log.md`, '# Discussion — Alpha\n');
    sim.run(['discovery-map', 'add', wu, 'beta', 'discussion', '--source', 'message:alpha', '--backfill', '--force-dismissed']);
    const message = sim.write('.leeway/.cache/scratch/message.md', 'Off-topic\n\nDetails.\n');
    sim.run(['topic', 'send', wu, 'beta', '--from', 'alpha', '--content', message, '--slug', 'off-topic']);
    const at = `${wu}.discussion.alpha`;
    const person = { by: 'person', who_moved_whom: 'none' };
    const scope = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: 'What does alpha settle?' })).id;
    sim.run(['ledger', 'decide', at, '--answers', scope], null, JSON.stringify({ ...person, text: 'Its own scope.', why: 'Beta takes the rest.' }));
    decideTopic(sim, wu, 'alpha');

    handoff(sim, `/leeway-continue-epic ${wu} discussion completed`);
    arrive(sim, wu);
    assert.deepStrictEqual(toRecover().map((line) => line.match(/^ {2}- \S+ (\S+) /)[1]), ['beta']);
    // The stub has no file to draft from: the batch, then the unsourced gate,
    // whose provide row lands the person's summary.
    assert.match(sim.render(['summary-backfill-gate', wu, '--variant', 'batch', '--file',
      sim.write(`.leeway/.cache/${wu}/discovery/summaries.json`, { summaries: { beta: null } })], { expect: 'content' }),
    /1\. Beta {2}\(discussion\)\n {7}\(source file missing — please provide\)[\s\S]*Accept these summaries\?/);
    sim.render(['summary-backfill-gate', wu, '--variant', 'unsourced', '--file',
      sim.write(`.leeway/.cache/${wu}/discovery/unsourced.json`, { names: ['beta'] })], { expect: 'content' });
    sim.run(['manifest', 'apply', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/backfill-ops.json`,
      [{ op: 'set', path: `${wu}.discovery.beta`, fields: { summary: 'Beta', description: 'What beta settles.' } }])]);
    sim.run(['commit', wu, '-m', `discovery(${wu}): backfill 2 discovery summary field(s)`, '--discovery']);

    assert.match(arriveAtEpicMenu(sim, wu, 'discussion'), /Discussion completed for "Sends"\./);
    assert.deepStrictEqual(toRecover(), [], 'the fresh menu finds nothing to recover');
  });

  it('epic: the last review hands off to the menu, which banners it and offers to complete the epic', () => {
    const wu = 'wrapup';
    mappedEpic(sim, wu, ['alpha']);
    discussed(sim, wu, 'alpha');
    sim.run(['topic', 'start', wu, 'specification', 'alpha']);
    sim.run(['manifest', 'set', `${wu}.specification.alpha`, 'sources.alpha.status', 'incorporated']);
    sim.write(`.leeway/${wu}/specification/alpha/specification.md`, '# Spec — Alpha\n');
    sim.run(['topic', 'complete', wu, 'specification', 'alpha']);
    sim.run(['build-order', 'sequence', wu, 'alpha=1']);
    sim.run(['topic', 'start', wu, 'planning', 'alpha']);
    sim.run(['manifest', 'set', `${wu}.planning.alpha`, 'format=local-markdown', 'task_map.alpha-1-1=alpha-1-1', 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', 'alpha']);
    sim.run(['task', 'init', wu, 'alpha']);
    sim.run(['task', 'start', wu, 'alpha', 'alpha-1-1']);
    sim.run(['task', 'complete', wu, 'alpha', 'alpha-1-1', '--phase', '1', '--next-task', '~']);
    sim.run(['manifest', 'push', `${wu}.implementation.alpha`, 'consolidated_phases', '1']);
    sim.run(['task', 'complete', wu, 'alpha', 'alpha-1-1', '--phase', '1', '--phase-complete']);
    sim.run(['topic', 'complete', wu, 'implementation', 'alpha']);
    // Short of the last review the menu shows the banner and no offer, and
    // its review row hands off to the review.
    assert.match(arriveAtEpicMenu(sim, wu, 'implementation'), /Implementation completed for "Wrapup"\./);
    assert.match(EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu)), /^all_done: false$/m);
    assert.strictEqual(epicPick(sim, wu, 'start_review', 'alpha').line, '→ Review · alpha');
    sim.run(['topic', 'start', wu, 'review', 'alpha']);
    sim.run(['topic', 'complete', wu, 'review', 'alpha']);

    assert.match(EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu)), /^all_done: true$/m);
    assert.match(arriveAtEpicMenu(sim, wu, 'review'), /Review completed for "Wrapup"\./);
    assert.match(sim.render(['epic-all-done-gate', wu], { expect: 'content' }), /◆ Mark it completed\?/);
    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): complete epic pipeline`]);
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline'], { expect: 'content' }), /Epic Completed/);
  });
});
