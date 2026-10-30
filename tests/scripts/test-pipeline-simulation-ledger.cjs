'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's ledger scenario: an epic's questions, findings
// and decisions written through the ledger verbs, each committing the
// ledger alone on the state branch.
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
const ROOT = path.join(__dirname, '../..');
const { LEDGER } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/ledger-events.cjs'));
const { launcher } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/call.cjs'));
const { stateGit } = require('./engine-harness.cjs');
const { statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));
const { Sim, sessionLog, mappedEpic } = require('./pipeline-world.cjs');
const { auditState, ledgerAuditsOf } = require('./pipeline-oracle.cjs');
const { leaningCall } = require('./ledger-world.cjs');

describe('pipeline simulation: ledger', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the ledger: an epic\'s questions, findings and decisions go through the write verbs, each committing the ledger alone on the state branch, and read back as its records, its maps, the product record, what a replacement affects, Claude\'s calls since the person last looked and the departures waiting on a verdict, and rendered to the knowledge base\'s copies, the records indexed; a decision the one-decision check could not judge is checked at a later start', (t) => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window', 'space-homing']);
    sim.run(['topic', 'start', wu, 'discussion', 'note-window']);
    sim.run(['topic', 'start', wu, 'discussion', 'space-homing']);
    const made = { by: 'claude', who_moved_whom: 'none' };
    const note = `${wu}.discussion.note-window`;
    /** One write, its content on stdin: its short id. @param {string[]} args @param {Record<string, unknown>} content */
    const ledger = (args, content) => {
      const res = sim.run(['ledger', ...args], null, JSON.stringify(content));
      assert.strictEqual(res.committed, stateGit(sim.dir, ['rev-parse', '--short', 'HEAD']).trim());
      assert.strictEqual(stateGit(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
      return res.id;
    };

    const question = ledger(['ask', note], { ...made, text: 'Is a note a window?' });
    const finding = ledger(['find', note], { ...made, text: 'Panels float above every Space.', how: 'a spike', known: 'spike', product_wide: true });
    const decision = ledger(['decide', note, '--answers', question, '--relies-on', finding], { ...made, text: 'A floating panel.', why: 'It follows the person.' });
    const relying = ledger(['ask', note, '--relies-on', decision], { ...made, text: 'Does a floating panel take focus?' });
    const replacement = ledger(['replace', note, '--replaces', decision, '--reason', 'new-fact', '--cause', finding], { ...made, drops: ['a window'], text: 'A frameless panel.', why: 'Lighter on the desk.' });
    const affected = () => sim.run(['ledger', 'affected', wu]).affected.map((/** @type {{id: string}} */ e) => e.id);
    assert.deepStrictEqual(affected(), [relying], 'what the replacement affects is not what relies on the decision it replaced');
    sim.refuses(['ledger', 'hold', note, '--entry', finding, '--after', replacement], /which is held against nothing \w+ changed/, null, JSON.stringify(made));
    const held = ledger(['hold', note, '--entry', relying, '--after', replacement], made);
    assert.deepStrictEqual(affected(), [], 'a confirmation that it still holds left the entry affected');
    const moving = ledger(['ask', note], { ...made, text: 'Which Space does a new note open on?' });
    const moved = ledger(['move', note, '--question', moving, '--to', 'space-homing'], made);
    const merged = ledger(['merge', `${wu}.discussion.space-homing`, '--question', moving, '--into', replacement], made);
    const review = ledger(['ask', `${wu}.specification`], { by: 'review', who_moved_whom: 'none', text: 'Does the spec cover a second display?' });
    sim.refuses(['ledger', 'decide', note], /^ledger decide needs --answers <id>/, null, JSON.stringify({ ...made, text: 'Unanchored.', why: 'No question.' }));
    sim.refuses(['ledger', 'replace', note, '--replaces', decision, '--reason', 'changed-mind'], /the current one is/, null, JSON.stringify({ ...made, drops: [], text: 'Again.', why: 'Again.' }));

    const events = fs.readFileSync(statePath(sim.dir, LEDGER), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line));
    assert.deepStrictEqual(events.map((e) => [e.event, e.topic, e.session]), [
      ['asked', 'note-window', 'sim-session'], ['found', 'note-window', 'sim-session'], ['decided', 'note-window', 'sim-session'],
      ['asked', 'note-window', 'sim-session'], ['replaced', 'note-window', 'sim-session'], ['still-holds', 'note-window', 'sim-session'],
      ['asked', 'note-window', 'sim-session'], ['moved', 'note-window', 'sim-session'], ['merged', 'space-homing', 'sim-session'],
      ['asked', null, 'sim-session'],
    ]);
    assert.strictEqual(stateGit(sim.dir, ['show', `HEAD:${LEDGER}`]), fs.readFileSync(statePath(sim.dir, LEDGER), 'utf8'));

    /** @param {{id: string}[]} shown */
    const ids = (shown) => shown.map((e) => e.id);
    const record = sim.run(['ledger', 'record', wu, 'note-window']);
    assert.deepStrictEqual([ids(record.questions), ids(record.findings), ids(record.decisions)], [[question, relying], [finding], [replacement]]);
    assert.deepStrictEqual([ids(record.decisions[0].replaced), ids(record.questions[1].holds), ids(record.moved), record.moved[0].to], [[decision], [held], [moved], 'space-homing']);
    const homing = sim.run(['ledger', 'map', wu, 'space-homing']);
    assert.deepStrictEqual(homing.questions.map((/** @type {Record<string, any>} */ q) => [q.id, q.stands, q.moved_from, ids(q.answers)]), [[moving, 'merged', 'note-window', [replacement]]]);
    const there = sim.run(['ledger', 'record', wu, 'space-homing']);
    assert.deepStrictEqual([ids(there.merged), ids(there.other_topics)], [[merged], [replacement]]);
    const unit = sim.run(['ledger', 'record', wu]);
    assert.deepStrictEqual(ids(unit.questions), [question, relying, moving, review]);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'product']).findings), [finding]);

    // Claude's calls since the person last looked: a look moves the mark in
    // the cache, and commits nothing.
    const looked = stateGit(sim.dir, ['rev-parse', 'HEAD']);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'since', wu, 'note-window']).calls), [replacement]);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'shown', wu, 'note-window']).calls), [replacement]);
    const mark = statePath(sim.dir, '.cache', '.marks', `${wu}.json`);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'since', wu]).calls), [], `listed after the look, the mark reading ${fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8') : 'nothing'}`);
    assert.strictEqual(stateGit(sim.dir, ['rev-parse', 'HEAD']), looked, 'a look made a commit');

    const homingAt = `${wu}.discussion.space-homing`;
    const reached = ledger(['ask', homingAt], { ...made, text: 'Does a note stay on its Space?' });
    const duplicate = ledger(['decide', homingAt, '--answers', reached], { ...made, text: 'Notes float above every Space.', why: 'Furniture.' });
    ledger(['merge', homingAt, '--question', reached, '--into', replacement, '--duplicate', duplicate], made);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'map', wu, 'space-homing']).questions[1].answers), [replacement]);

    sim.run(['topic', 'cancel', wu, 'discovery', 'note-window']);
    const cancelledOwner = sim.run(['ledger', 'map', wu, 'space-homing']).questions;
    assert.deepStrictEqual([cancelledOwner[0].id, cancelledOwner[0].moved_from], [moving, null], 'a move did not outlive the topic it was made from');
    assert.deepStrictEqual(cancelledOwner[0].answers, [], 'a cancelled topic\'s entry answered a question');
    assert.deepStrictEqual(ids(cancelledOwner[1].answers), [duplicate], 'a duplicate merged into a cancelled topic\'s entry stayed set aside');
    assert.deepStrictEqual(sim.run(['ledger', 'product']).findings, []);
    sim.run(['topic', 'reactivate', wu, 'discovery', 'note-window']);
    assert.deepStrictEqual(sim.run(['ledger', 'record', wu, 'note-window']), record);

    // The world has no login for the separate call, so every decision landed
    // unchecked — the merged duplicate among them. The next start launches
    // the late check; the check, given a login, records what it finds beside
    // each — the replacement holding several rules, flagged where its record
    // is read — and a start after it launches none.
    const decisions = fs.readFileSync(statePath(sim.dir, LEDGER), 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line))
      .filter((e) => e.event === 'decided' || e.of === 'decision');
    assert.deepStrictEqual(decisions.map((e) => e.unchecked), [true, true, true]);
    /** @type {string[]} */
    const launched = [];
    t.mock.method(launcher, 'launch', (/** @type {string} */ root, /** @type {string[]} */ argv) => { if (argv.join(' ') === 'ledger late-check') launched.push(root); });
    sim.run(['boot']);
    assert.deepStrictEqual(launched, [fs.realpathSync(statePath(sim.dir))]);
    const withoutLogin = sim.env;
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ 'A frameless panel.': { rules: ['A frameless panel.', 'It takes no focus.'] }, '': { rules: ['One rule.'] } }) };
    assert.deepStrictEqual(sim.run(['ledger', 'late-check']), { ok: true, ran: true, checked: 3, several: 1, owed: 0 });
    sim.env = withoutLogin;
    const checked = sim.run(['ledger', 'record', wu, 'note-window']).decisions[0];
    assert.deepStrictEqual([checked.id, checked.late_check, checked.replaced.map((/** @type {{late_check: string}} */ d) => d.late_check)], [replacement, 'several', ['one']]);
    sim.run(['boot']);
    assert.strictEqual(launched.length, 1, 'a start launched the late check with no decision owed one');

    // Another unit's replacement counts while that unit is live, and of two
    // merges crossing each other the later holds: the note window's question
    // merged into space homing's answer, the other unit's replacement its
    // duplicate; that unit cancelled, so the entry it replaced stands again
    // and space homing's question is merged the other way, into it; the unit
    // reactivated, the later merge still holds.
    const mint = 'mint';
    sim.run(['workunit', 'create', mint, 'feature', '--description', 'Mint', '--session-log-file', sessionLog(sim, mint)]);
    sim.run(['topic', 'start', mint, 'discussion', mint]);
    const overruled = ledger(['replace', `${mint}.discussion.${mint}`, '--replaces', replacement, '--reason', 'changed-mind'],
      { ...made, drops: ['frameless'], text: 'A framed panel.', why: 'Mint frames its notes.' });
    const overruling = sim.run(['ledger', 'record', wu, 'note-window']);
    assert.deepStrictEqual([ids(overruling.decisions), ids(overruling.decisions[0].replaced)], [[overruled], [replacement, decision]]);
    const since = (/** @type {string[]} */ place) => ids(sim.run(['ledger', 'since', ...place]).calls);
    assert.deepStrictEqual([since([mint]), since([wu, 'note-window'])], [[overruled], [overruled]], 'a call made in one unit standing in another is not listed in both');
    assert.deepStrictEqual(ids(sim.run(['ledger', 'shown', mint, mint]).calls), [overruled]);
    assert.deepStrictEqual([since([wu]), since([mint])], [[], []], 'a look where a call shows left it listed where else it shows');
    const follows = ledger(['ask', homingAt], { ...made, text: 'Does a note follow the person across Spaces?' });
    const following = ledger(['decide', homingAt, '--answers', follows], { ...made, text: 'A note follows the person.', why: 'Furniture moves with you.' });
    ledger(['merge', note, '--question', question, '--into', following, '--duplicate', overruled], made);
    sim.run(['workunit', 'cancel', mint]);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'record', wu, 'note-window']).decisions), [replacement]);
    ledger(['merge', homingAt, '--question', follows, '--into', replacement, '--duplicate', following], made);
    sim.run(['workunit', 'reactivate', mint]);
    const answer = (/** @type {string} */ topic, /** @type {string} */ asked) => {
      const row = sim.run(['ledger', 'map', wu, topic]).questions.find((/** @type {{id: string}} */ q) => q.id === asked);
      return [row.stands, ids(row.answers)];
    };
    assert.deepStrictEqual([answer('note-window', question), answer('space-homing', follows)], [['answered', [overruled]], ['merged', [overruled]]]);

    // The unit whose decision mint replaced cancelled: the replacement, the
    // earliest entry of its chain in a live place, stands in mint meanwhile,
    // and back in the note window once the unit is reactivated.
    sim.run(['workunit', 'cancel', wu]);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'record', mint]).decisions), [overruled]);
    sim.run(['workunit', 'reactivate', wu]);
    assert.deepStrictEqual(ids(sim.run(['ledger', 'record', mint]).decisions), []);

    // A merge counts only while it is live: space homing, holding a merge
    // whose duplicate stands on the note window, cancelled, the duplicate
    // stands again; reactivated, the merge holds again.
    const sized = ledger(['decide', note, '--answers', ledger(['ask', note], { ...made, text: 'Is a note\'s size its own?' })], { ...made, text: 'A note keeps its own size.', why: 'Furniture keeps its shape.' });
    const keeps = ledger(['ask', note], { ...made, text: 'Does a note keep its size across Spaces?' });
    const kept = ledger(['decide', note, '--answers', keeps], { ...made, text: 'It keeps its size.', why: 'Furniture keeps its shape.' });
    ledger(['move', note, '--question', keeps, '--to', 'space-homing'], made);
    ledger(['merge', homingAt, '--question', keeps, '--into', sized, '--duplicate', kept], made);
    const decided = () => ids(sim.run(['ledger', 'record', wu, 'note-window']).decisions);
    assert.ok(!decided().includes(kept), 'a duplicate a holding merge took stayed current');
    sim.run(['topic', 'cancel', wu, 'discovery', 'space-homing']);
    assert.ok(decided().includes(kept), 'a merge on a cancelled topic still set its duplicate aside');
    sim.run(['topic', 'reactivate', wu, 'discovery', 'space-homing']);
    assert.ok(!decided().includes(kept), 'a reactivated merge no longer set its duplicate aside');

    // A replacement written while mint's rewording of a question is live
    // answers that wording; mint cancelled, the question stands again in its
    // first wording, still answered by it, and back with mint, reworded.
    const dimming = ledger(['ask', note], { ...made, text: 'Does a note dim when idle?' });
    const dims = ledger(['decide', note, '--answers', dimming], { ...made, text: 'It dims after a minute.', why: 'Quiet furniture.' });
    const unfocused = ledger(['replace', `${mint}.discussion.${mint}`, '--replaces', dimming, '--reason', 'changed-mind'], { ...made, drops: ['idle'], text: 'Does a note dim when unfocused?' });
    const dimmer = ledger(['replace', note, '--replaces', dims, '--reason', 'changed-mind'], { ...made, drops: ['a minute'], text: 'It dims at once.', why: 'Quieter.' });
    sim.run(['workunit', 'cancel', mint]);
    assert.deepStrictEqual(answer('note-window', dimming), ['answered', [dimmer]], 'a question answered by an answer to a wording set aside shows open');
    sim.run(['workunit', 'reactivate', mint]);
    assert.deepStrictEqual(answer('note-window', unfocused), ['answered', [dimmer]]);

    // A question's wordings read as one line: mint's rewording, set aside
    // while sage rewords the same question, reads once back as the earlier
    // of the two, and the question shows once, in sage's wording; of three
    // wordings, the middle set aside, the first is an earlier wording of the
    // last, never a row of its own.
    const sage = 'sage';
    sim.run(['workunit', 'create', sage, 'feature', '--description', 'Sage', '--session-log-file', sessionLog(sim, sage)]);
    sim.run(['topic', 'start', sage, 'discussion', sage]);
    const reword = (/** @type {string} */ unit, /** @type {string} */ wording, /** @type {string} */ text) => ledger(['replace', `${unit}.discussion.${unit}`, '--replaces', wording, '--reason', 'changed-mind'], { ...made, drops: ['the old wording'], text });
    const tilting = ledger(['ask', note], { ...made, text: 'Does a note tilt?' });
    const tilts = ledger(['decide', note, '--answers', tilting], { ...made, text: 'It tilts with the desk.', why: 'Furniture leans.' });
    reword(mint, tilting, 'Does a note tilt in Mint?');
    sim.run(['workunit', 'cancel', mint]);
    const sageTilting = reword(sage, tilting, 'Does a note tilt in Sage?');
    sim.run(['workunit', 'reactivate', mint]);
    assert.deepStrictEqual(answer('note-window', sageTilting), ['answered', [tilts]]);
    const glowing = ledger(['ask', note], { ...made, text: 'Does a note glow?' });
    const glows = ledger(['decide', note, '--answers', glowing], { ...made, text: 'It glows when new.', why: 'New furniture shines.' });
    const eitherGlowing = reword(sage, reword(mint, glowing, 'Does a note glow in Mint?'), 'Does a note glow in either?');
    sim.run(['workunit', 'cancel', mint]);
    assert.deepStrictEqual(answer('note-window', eitherGlowing), ['answered', [glows]]);
    sim.run(['workunit', 'reactivate', mint]);

    // The verdict queue: nothing waits while every answer is Claude's; the
    // person's replacement of Claude's own call, for a mistake, stands over
    // its lean and waits on a verdict.
    assert.deepStrictEqual(sim.run(['verdict', 'queue']).departures, []);
    const departed = ledger(['replace', note, '--replaces', sized, '--reason', 'was-wrong'],
      { by: 'person', who_moved_whom: 'person-moved-claude', drops: ['its own size'], text: 'A note fits its text.', why: 'A note is read, not placed.' });
    assert.deepStrictEqual(ids(sim.run(['verdict', 'queue']).departures), [departed]);
  });

  it('the trust log: Claude\'s call, the person\'s reversal of it, the verdicts on that departure — skipped on the decided screen, a real loss from the queue — Claude\'s call replacing it, the person\'s answers to Claude\'s lean through a raise, one taking it and one standing over it, and their keep of a call Claude proposed to replace, each land as a line of the trust log in the command that writes it; the person\'s own decision, changed, lands none, nor does their answer to a fact or their not following one', async () => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window']);
    sim.run(['topic', 'start', wu, 'discussion', 'note-window']);
    const note = `${wu}.discussion.note-window`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** One write, its content on stdin: its short id. @param {string[]} args @param {Record<string, unknown>} content */
    const ledger = (args, content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;

    const question = ledger(['ask', note], { ...made, text: 'Is a note a window?' });
    const call = ledger(['decide', note, '--answers', question], { ...made, text: 'A floating panel.', why: 'It follows the person.' });
    const reversal = ledger(['replace', note, '--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['a panel'], text: 'A document window.', why: 'Notes are documents.' });
    sim.run(['verdict', 'give', reversal, 'skip', '--at', 'decided']);
    sim.run(['verdict', 'queue']);
    sim.run(['verdict', 'give', reversal, 'loss', '--at', 'queue']);
    ledger(['replace', note, '--replaces', reversal, '--reason', 'changed-mind'], { ...made, drops: ['a document window'], text: 'A floating panel after all.', why: 'It follows the person.' });

    /** Claude's lean on a question of its own, raised, and the person's pick of row `key`. @param {string} text @param {'1'|'2'} key */
    const raised = async (text, key) => {
      const question = ledger(['ask', note], { ...made, text });
      const { raise } = await sim.runAsync(['raise', note, '--answers', question], null, JSON.stringify(leaningCall('It floats.', 'It stays put.')));
      sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'The person said why.' }));
    };
    await raised('Does a note float?', '1');
    await raised('Does a note take focus?', '2');

    // Claude proposing to change an earlier call of its own, and the person
    // keeping it as it stands: a keep at the raise's id, its raise event
    // naming it.
    const snapping = ledger(['ask', note], { ...made, text: 'Does a note snap to the grid?' });
    const snaps = ledger(['decide', note, '--answers', snapping], { ...made, text: 'Notes snap to the grid.', why: 'Tidy desks.' });
    const proposed = await sim.runAsync(['raise', note, '--replaces', snaps, '--reason', 'changed-mind'], null, JSON.stringify(leaningCall('Notes float free.', 'Notes snap to a coarse grid.')));
    sim.run(['raise', 'answer', proposed.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'The person likes the grid.' }));

    // A fact only the person holds, raised with no rows: the person's own
    // words land as their decision, and nothing reaches the trust log, their
    // "I don't follow" included.
    const signing = ledger(['ask', note], { ...made, text: 'Which team signs the beta?' });
    const fact = { question: 'Which team signs the beta?', rows: [], mechanism: 'Outside the code.', product_wide: false };
    const signs = (await sim.runAsync(['raise', note, '--answers', signing, '--fact'], null, JSON.stringify(fact))).raise;
    sim.run(['raise', 'answer', signs, '--didnt-follow']);
    sim.run(['raise', 'answer', signs, '--own'], null, JSON.stringify({ text: 'Team ABCDE12345.', why: 'It is their account.' }));

    // The person deciding unprompted, then changing their mind: Claude put
    // no lean on it, so it is no departure.
    const titled = ledger(['ask', note], { ...made, text: 'Does a note have a title?' });
    const untitled = ledger(['decide', note, '--answers', titled], { by: 'person', text: 'A note has no title.', why: 'Its first line is enough.' });
    const retitled = ledger(['replace', note, '--replaces', untitled, '--reason', 'changed-mind'], { by: 'person', drops: ['no title'], text: 'A note has a title.', why: 'Titles help search.' });
    assert.ok(!sim.run(['verdict', 'queue']).departures.some((/** @type {{id: string}} */ d) => d.id === retitled), 'the person\'s own decision, changed, waits on a verdict');
  });

  it('the ledger\'s second version: who decided each decision — the person\'s own scope call, and their "your call" and "don\'t care" Claude\'s calls — how each finding is known, a measurement with the command run and its result, the sections an entry cites, and a question moved to the roadmap as later, each written through the verbs and read back by the record, the map, `since`, the trust log and the copy', () => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window']);
    sim.run(['topic', 'start', wu, 'discussion', 'note-window']);
    const note = `${wu}.discussion.note-window`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** One write, its content on stdin: its short id. @param {string[]} args @param {Record<string, unknown>} content */
    const ledger = (args, content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;
    /** Claude's answer to a question of its own, given as `given` says. @param {string} text @param {string} answer @param {string} given */
    const call = (text, answer, given) => ledger(['decide', note, '--answers', ledger(['ask', note], { ...made, text })], { ...made, text: answer, why: 'Tidy.', given });
    const cites = [{ path: `${wu}/discussion/note-window.md`, section: 'Session 1' }];

    const scope = ledger(['ask', note], { ...made, text: 'What does the note window cover?', cites });
    const scoped = ledger(['decide', note, '--answers', scope], { by: 'person', who_moved_whom: 'none', text: 'The window and its frame.', why: 'Where it opens is space homing\'s.', kind: 'scope', cites });
    const handed = call('Does a note snap to the grid?', 'Notes snap to an 8-point grid.', 'your-call');
    const builders = call('What radius are a note\'s corners?', 'Ten points.', 'dont-care');
    const measured = ledger(['find', note], { ...made, text: 'A panel opens in 4 ms.', how: 'timed the open', known: 'measured', command: 'swift run bench open', result: 'median 4.1 ms', cites });
    const exploratory = ledger(['find', note], { ...made, text: 'A sheet opens in 9 ms.', how: 'timed once in the conversation', known: 'exploratory', command: 'swift run bench sheet', result: '9.3 ms' });
    const syncing = ledger(['ask', note], { ...made, text: 'Do notes sync across Macs?' });
    sim.run(['roadmap', 'add', 'sync', '--horizon', 'v2', '--summary', 'Notes sync across Macs']);
    ledger(['move', note, '--question', syncing, '--to', 'roadmap:sync'], made);

    const record = sim.run(['ledger', 'record', wu, 'note-window']);
    assert.deepStrictEqual(record.decisions.map((/** @type {Record<string, unknown>} */ d) => [d.id, d.by, d.given, d.kind]), [
      [scoped, 'person', 'own', 'scope'], [handed, 'claude', 'your-call', null], [builders, 'claude', 'dont-care', null],
    ]);
    assert.deepStrictEqual(record.findings.map((/** @type {Record<string, unknown>} */ f) => [f.id, f.known, f.command, f.result, f.cites]), [
      [measured, 'measured', 'swift run bench open', 'median 4.1 ms', cites], [exploratory, 'exploratory', 'swift run bench sheet', '9.3 ms', []],
    ]);
    assert.deepStrictEqual([record.questions[0].cites, record.decisions[0].cites], [cites, cites]);
    const later = sim.run(['ledger', 'map', wu, 'note-window']).questions.find((/** @type {{id: string}} */ q) => q.id === syncing);
    assert.deepStrictEqual([later.stands, later.moved_to, later.answers], ['later', 'roadmap:sync', []]);
    assert.deepStrictEqual(sim.run(['ledger', 'since', wu, 'note-window']).calls.map((/** @type {{id: string}} */ c) => c.id), [handed, builders]);
    const copy = fs.readFileSync(statePath(sim.dir, '.knowledge', 'records', wu, 'note-window.md'), 'utf8');
    for (const line of ['Decided by the person', 'Decided by Claude, the person\'s "your call"', 'Left to the builder, the person\'s "don\'t care"',
      'How it is known: measured, timed the open', 'Command: swift run bench open', 'Later: moved to the roadmap, roadmap:sync.']) {
      assert.ok(copy.includes(line), `the copy does not say "${line}"`);
    }
  });

  it('the oracle audits the ledger once per state it reads: a step that leaves every read as it was passes as it was, and a step that changes any of them — a copy, not the ledger or a manifest — is audited afresh, a stale copy failing', () => {
    const wu = 'fumi';
    mappedEpic(sim, wu, ['note-window']);
    sim.run(['topic', 'start', wu, 'discussion', 'note-window']);
    sim.run(['ledger', 'ask', `${wu}.discussion.note-window`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'What does the note window cover?' }));
    const before = ledgerAuditsOf(sim.dir);
    sim.run(['presence', 'beat', wu, 'discussion', 'note-window']);
    assert.deepStrictEqual(ledgerAuditsOf(sim.dir), { full: before.full, passed: before.passed + 1 }, 'a beat touches nothing the ledger audit reads');

    const copy = statePath(sim.dir, '.knowledge', 'records', wu, 'note-window.md');
    const kept = fs.readFileSync(copy, 'utf8');
    fs.writeFileSync(copy, '# A stale copy\n');
    assert.throws(() => auditState(sim.dir, 'a stale copy'), /does not name every entry its record shows/);
    assert.strictEqual(ledgerAuditsOf(sim.dir).full, before.full + 1, 'the changed copy is audited afresh');
    fs.writeFileSync(copy, kept);
    auditState(sim.dir, 'the copy restored');
    assert.deepStrictEqual(ledgerAuditsOf(sim.dir), { full: before.full + 1, passed: before.passed + 2 }, 'the copy restored is the state last audited');
  });
});
