'use strict';

// ---------------------------------------------------------------------------
// A raise decided by the ask rule (leeway-engine/scripts/domain/raise.cjs,
// over the decision point domain/decision-point.cjs and the rule
// domain/ask-rule.cjs): what the raise gives the decision point beside the
// call (E1), every call still asking until the rule is switched on — none
// given in discovery, where a raise is refused (16.S24) — and what it is
// decided from beyond its label riding with the call to its raise event;
// the model the call is decided under sealed with it, every event about it
// logged under that model and with Claude's mark, a builder's answered in
// the conversation among them (16.4.4); and, the decision point forced to
// the rule in process (`ruled`) as the switch will make it, on a question
// whose id draws no blind question (test-engine-raise-blind.cjs), a
// question Claude could find out
// sent to check and asked once the same raise is made again, in any
// words — another task's raise of it sent to check as any first is — a call
// with no label asked (16.S68), Claude's mark that
// always asks (`--always`), a danger question in a build in auto parking
// its task (3.S15) — neither sent to check — a replacement mid-build asking
// where it would replace the person's decision and proceeding where
// Claude's (16.S72), and a decision of Claude's the person kept asking as
// theirs.
//
// Layer: verb. World: the ledger suites' epic in discussion, a question
// asked at its topic and two decisions of Claude's there; and an epic beside
// it in its build, in auto, questions asked there and two decisions — the
// person's and Claude's — built once and copied for each test; each test
// keeps its conversation and the trust log in a config folder of its own,
// the log written with the answers the rule counts, as of now — and there
// too the transcript naming the session's model, and a builder's, where a
// test gives one. The world has no tracker, so the check that the tracker
// holds the task a raise parks is passed over here
// (test-engine-task-parks.cjs). The separate call is the stub binary,
// labelling the call's question where a test arms it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { okSections, okSectionsAsync, refusesAsync, treeSnapshot, head, statePath, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { MODEL, UNDRAWN } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));
const { MODEL_LINES, countsFrom, stateOf } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */

const EVERY_CALL_ASKS = 'Every call comes to you for now: I don\'t decide on my own yet.';
// An epic in its build, in auto, beside the epic in discussion.
const BUILT = 'mint';
const BUILD = `${BUILT}.implementation`;
// The stub's labeller, as the label names it.
const LABELLER = 'claude-sonnet-stub';
// The model before the newest on its line: one that never reads the newest's answers.
const PREDECESSOR = MODEL_LINES[0][MODEL_LINES[0].length - 2];

const CURSOR = Object.freeze({ key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' });
const MAIN = Object.freeze({ key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' });

/** Claude's call: where a new note opens, leaning to the cursor's screen. */
const CALL = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [CURSOR, MAIN],
  lean: '1',
  why: 'A note follows the person.',
  sort: 'several',
  mechanism: 'The screen under the pointer when the note is made.',
  product_wide: false,
});

/** Claude's call proposing a frame in place of a decision on the note's edge. */
const FRAMED = Object.freeze({
  ...CALL,
  question: 'Should a note have a thin frame after all?',
  rows: [{ key: '1', name: 'Thin', text: 'A thin frame', notice: 'notes stand out from the desk' }, { key: '2', name: 'Shadow', text: 'A shadow alone', notice: 'notes float with no edge' }],
});

/** The same proposal, its first row reworded. */
const REWORDED = Object.freeze({ ...FRAMED, rows: [{ ...FRAMED.rows[0], text: 'A thin frame round the note' }, FRAMED.rows[1]] });

/** What the world holds, by name: each question's and decision's short id. */
const made = { note: '', light: '', flat: '', where: '', size: '', edge: '', yours: '', mine: '' };

const world = fixtureFrom('raise-rule-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, BUILT, { work_type: 'epic', phases: PHASES, build: { position: 'auto' } });
  const { write } = ledgerHelpers(() => template);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }).id;
  made.note = ask(NOTE, 'Where does a new note open?');
  made.light = write('decide', NOTE, ['--answers', ask(NOTE, 'Does a note have an edge?')], { ...MADE, text: 'A frameless note.', why: 'Light reads calmer.' }).id;
  made.flat = write('decide', NOTE, ['--answers', ask(NOTE, 'Does a note cast a shadow?')], { ...MADE, text: 'No shadow.', why: 'Flat looks calmer.' }).id;
  made.where = ask(BUILD, 'Where does a new note open on a second screen?');
  made.size = ask(BUILD, 'How big is a new note?');
  made.edge = ask(BUILD, 'Does a note have an edge?');
  made.yours = write('decide', BUILD, ['--answers', made.edge], { by: 'person', text: 'A frameless note.', why: 'They want it light.' }).id;
  made.mine = write('decide', BUILD, ['--answers', ask(BUILD, 'Does a note cast a shadow?')], { ...MADE, text: 'No shadow.', why: 'Flat looks calmer.' }).id;
});

const config = useTempFolder('raise-rule-config-');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
});

afterEach(() => {
  cleanupFixture(dir);
});

const { ledgerText, full, entries } = ledgerHelpers(() => dir);
const { conversation, inFolder, seals, logText, project, lastEntry, answer, quietOn, labelledAs, raised } = raiseHelpers(() => dir, config, CALL);

/**
 * The decision point forced to the rule, as switching it on makes it, for
 * test `t`: on a question whose id draws no blind question, so a call the
 * rule lets proceed proceeds (test-engine-raise-blind.cjs).
 * @param {import('node:test').TestContext} t
 */
const byTheRule = (t) => t.mock.method(decisionPoint, 'decide', (/** @type {any} */ call, /** @type {any} */ at) => decisionPoint.ruled(call, { ...at, question: UNDRAWN }));

/** The conversation's record of what it sent to check. @returns {Record<string, string>|null} */
const sentToCheck = () => (fs.existsSync(inFolder('raise-checked.json')) ? JSON.parse(fs.readFileSync(inFolder('raise-checked.json'), 'utf8')) : null);


/**
 * The Claude Code folder of a session whose transcript last names `model`:
 * its path, given as CLAUDE_CONFIG_DIR.
 * @param {string} model
 */
function sessionOn(model) {
  const claude = path.join(config(), 'claude');
  const transcript = path.join(claude, 'projects', '-Users-me-fumi', `${SESSION}.jsonl`);
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.appendFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { model } })}\n`);
  return claude;
}

/**
 * A builder subagent of the session at `claude`, at work in its worktree,
 * a folder of the project, on `model`: the worktree.
 * @param {string} claude @param {string} model
 */
function builderOn(claude, model) {
  const worktree = path.join(dir, 'worktree-2-3');
  fs.mkdirSync(worktree);
  const agent = path.join(claude, 'projects', '-Users-me-fumi', SESSION, 'subagents', 'agent-b23.jsonl');
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, `${JSON.stringify({ type: 'assistant', message: { model } })}\n`);
  fs.writeFileSync(agent.replace(/\.jsonl$/, '.meta.json'), JSON.stringify({ agentType: 'leeway-builder', worktreePath: fs.realpathSync(worktree) }));
  return worktree;
}

/** The trust log's events, as written. @returns {Record<string, any>[]} */
const logEvents = () => logText().split('\n').slice(0, -1).map((line) => JSON.parse(line));

/** The clean answers `kind` holds in the project for `model`'s calls, its line's older models' at half. @param {Kind} kind @param {string} model */
const cleanFor = (kind, model) => stateOf(countsFrom(logEvents(), { project: project(), model, now: Date.now() }).kinds[kind], 0.2).clean;

describe('what the decision point is given (E1)', () => {
  it('beside the call: its label, where it is made and whether it blocks build work — made in the build for a task, never with none — whose the entry it would replace is, Claude\'s mark, whether it was sent to check, the project, the session\'s model — none where its transcript names none — the time, and the id a blind draw hashes, the question\'s, none on a replacement, which is never drawn blind (E3); and every call still asks, as before the rule is switched on', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const claude = path.join(config(), 'claude');
    const transcript = path.join(claude, 'projects', '-Users-me-fumi', `${SESSION}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { model: MODEL } })}\n`);
    const before = Date.now();

    const topic = await raised(NOTE, ['--answers', made.note], CALL, { ...labelledAs(CALL, 'look'), CLAUDE_CONFIG_DIR: claude });
    const build = await raised(BUILD, ['--replaces', made.yours, '--reason', 'was-wrong', '--parks', '2.3', '--always', 'live-server'], FRAMED, labelledAs(FRAMED, 'contract', { hardToUndo: true }));
    const taskless = await raised(BUILD, ['--answers', made.size], CALL, labelledAs(CALL, 'look'));

    const after = Date.now();
    const given = decide.mock.calls.map((called) => called.arguments);
    const at = given.map(([, at]) => /** @type {import('../../skills/leeway-engine/scripts/domain/decision-point.cjs').At} */ (at));
    assert.ok(at.every(({ now }) => now >= before && now <= after), 'the time given is not the raise\'s');
    const common = { checked: false, project: { root: statePath(dir), name: projectName(dir) } };
    const look = { labeller: LABELLER, answers: labelled('look').answers };
    const inBuild = { unit: BUILT, phase: 'implementation', topic: null };
    assert.deepStrictEqual(given.map(([call, { now: _now, ...rest }]) => [call, rest]), [
      [CALL, { ...common, label: look, place: { unit: UNIT, phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, always: null, model: MODEL, question: full(made.note) }],
      [FRAMED, { ...common, label: { labeller: LABELLER, answers: labelled('contract', { hardToUndo: true }).answers }, place: inBuild, blocks_build: true, replaced_by: 'person', always: 'live-server', model: null, question: null }],
      [CALL, { ...common, label: look, place: inBuild, blocks_build: false, replaced_by: null, always: null, model: null, question: full(made.size) }],
    ]);
    assert.deepStrictEqual([topic.res.decision, topic.res.reason, build.res.decision, build.res.parked, taskless.res.parked, taskless.res.task], ['ask', EVERY_CALL_ASKS, 'ask', 'Q1', 'Q2', null]);
  });

  it('16.S24: in discovery a call is never raised — refused in the engine\'s own words before the decision point is reached, nothing written or sealed (16.7.3)', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    const { error } = await refusesAsync(dir, ['raise', `${UNIT}.discovery.note-window`, '--answers', made.note], { env: conversation(), stdin: JSON.stringify(CALL) });

    assert.deepStrictEqual([error, decide.mock.callCount(), { tree: treeSnapshot(dir), head: head(dir) }, seals()], ['raise: nothing is decided in discovery — carry it as input', 0, before, null]);
  });

  it('what the call is decided from beyond its label rides with it to its raise event, so a replay of the rule decides as it did: whose the decision a replacement would replace is — Claude\'s at a topic, the person\'s parked in the build, sealed on its park — whether it blocks build work, and no mark where Claude gives none (16.5.7, 16.4.7)', async () => {
    const mine = await raised(NOTE, ['--replaces', made.light, '--reason', 'was-wrong'], FRAMED, conversation());
    answer(mine.res.raise, ['--pick', '1']);
    await raised(BUILD, ['--replaces', made.yours, '--reason', 'was-wrong', '--parks', '2.3'], FRAMED, conversation());
    answer(okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation() }).res.raise, ['--pick', '1']);

    assert.deepStrictEqual([
      entries().filter(({ event }) => event === 'parked').map(({ replaced_by: replacedBy }) => replacedBy),
      logEvents().map(({ replaced_by: replacedBy, blocks_build: blocks, always }) => [replacedBy, blocks, always]),
    ], [['person'], [['claude', false, null], ['person', true, null]]]);
  });
});

describe('the model the call is decided under (16.4.4)', () => {
  it('a builder\'s call is its model\'s, its mark beside it: decided under the builder\'s model, sealed on its park with Claude\'s mark and copied to a task joining it from the conversation on another model, its question drawn, not followed and answered from that conversation logs each event under the builder\'s model and with its mark — so its kind\'s count gains the answer, and the conversation\'s model\'s holds nothing of it', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const claude = sessionOn(PREDECESSOR);
    const worktree = builderOn(claude, MODEL);

    await okSectionsAsync(worktree, ['raise', BUILD, '--answers', made.size, '--parks', '2.3', '--always', 'design-problem'], { env: { ...labelledAs(CALL, 'look'), CLAUDE_CONFIG_DIR: claude }, stdin: JSON.stringify(CALL) });
    await raised(BUILD, ['--answers', made.size, '--parks', '2.4'], CALL, conversation({ CLAUDE_CONFIG_DIR: claude }));
    const { raise } = okSections(dir, ['raise', 'draw', BUILT, 'Q1'], { env: conversation({ CLAUDE_CONFIG_DIR: claude }) }).res;
    answer(raise, ['--didnt-follow'], null, { CLAUDE_CONFIG_DIR: claude });
    answer(raise, ['--pick', CURSOR.key], undefined, { CLAUDE_CONFIG_DIR: claude });

    const marked = [MODEL, 'design-problem'];
    assert.deepStrictEqual([decide.mock.calls.map(({ arguments: [, at] }) => at.model), entries().filter(({ event }) => event === 'parked').map(({ model, always }) => [model, always])], [[MODEL], [marked, marked]]);
    assert.deepStrictEqual(logEvents().map(({ didnt_follow: didntFollow, model, always }) => [didntFollow, model, always]), [[true, ...marked], [false, ...marked]]);
    assert.deepStrictEqual([cleanFor('look', MODEL), cleanFor('look', PREDECESSOR)], [1, 0]);
  });

  it('a raise drawn in the conversation is answered under the model it was decided under, the conversation\'s model changed since, its event logging Claude\'s mark as sealed, no decision replaced and no build work blocked', async () => {
    const claude = sessionOn(MODEL);
    const { res } = await raised(NOTE, ['--answers', made.note, '--always', 'live-server'], CALL, { ...labelledAs(CALL, 'look'), CLAUDE_CONFIG_DIR: claude });
    sessionOn(PREDECESSOR);

    answer(res.raise, ['--pick', CURSOR.key], undefined, { CLAUDE_CONFIG_DIR: claude });

    const { model, always } = seals()?.[res.raise] ?? {};
    assert.deepStrictEqual([[model, always], logEvents().map((e) => [e.model, e.always, e.replaced_by, e.blocks_build])], [[MODEL, 'live-server'], [[MODEL, 'live-server', null, false]]]);
  });
});

describe('the rule\'s decisions as a raise meets them', () => {
  it('a question Claude could find out is sent to check — drawing, sealing, parking, landing and logging nothing, the conversation keeping the raise as sent, by the question and the task raising it — and the same raise made again asks: at a topic, and in the build, where another task\'s raise of it, whose own check has not come back, is sent to check too (16.3.1, 16.11.7)', async (t) => {
    byTheRule(t);
    const log = quietOn('behaviour');
    const checkable = labelledAs(CALL, 'behaviour', { yes: ['checkable'] });
    const ledger = ledgerText();
    const check = { ok: true, decision: 'check', reason: 'You can find this out: check it — read the code or the record, or run something — and raise it again only if checking can\'t settle it.' };

    const sent = [
      await raised(NOTE, ['--answers', made.note], CALL, checkable), await raised(BUILD, ['--answers', made.size, '--parks', '2.3'], CALL, checkable),
      await raised(BUILD, ['--answers', made.size, '--parks', '2.4'], CALL, checkable),
    ];

    assert.deepStrictEqual(sent.map(({ res, sections }) => [res, sections]), [[check, ''], [check, ''], [check, '']]);
    assert.deepStrictEqual([ledgerText(), logText(), seals(), Object.keys(sentToCheck() ?? {})], [ledger, log, null, [`${full(made.note)} for no task`, `${full(made.size)} for 2.3`, `${full(made.size)} for 2.4`]]);
    const checked = 'Checking couldn\'t settle it, so it comes to you.';
    const again = await raised(NOTE, ['--answers', made.note], CALL, checkable);
    assert.deepStrictEqual([again.res.decision, again.res.reason, seals()?.[again.res.raise].reason], ['ask', checked, checked]);
    assert.match(again.sections, /^WHY I'M ASKING\n\nChecking couldn't settle it, so it comes to you\.$/m);
    const parked = (await raised(BUILD, ['--answers', made.size, '--parks', '2.3'], CALL, checkable)).res;
    assert.deepStrictEqual([parked.decision, parked.parked, lastEntry().why_asking], ['ask', 'Q1', checked]);
  });

  it('a replacement Claude could find out is sent to check by the decision it would replace and the task raising it: two decisions in one conversation are each sent their own, and one raised again in other words asks; in the build, another task\'s raise of the same proposal, whose own check has not come back, is sent to check too (16.11.7)', async (t) => {
    byTheRule(t);
    quietOn('behaviour');
    const checkable = labelledAs(FRAMED, 'behaviour', { yes: ['checkable'] });

    const light = await raised(NOTE, ['--replaces', made.light, '--reason', 'was-wrong'], FRAMED, checkable);
    const flat = await raised(NOTE, ['--replaces', made.flat, '--reason', 'was-wrong'], FRAMED, checkable);
    const reworded = await raised(NOTE, ['--replaces', made.light, '--reason', 'was-wrong'], REWORDED, checkable);
    /** Claude's call in the build replaced for `task`. @param {string} task */
    const replacingMine = (task) => raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', task], FRAMED, checkable);
    const mine = [await replacingMine('2.3'), await replacingMine('2.4')];

    assert.deepStrictEqual([light.res.decision, flat.res.decision, ...mine.map(({ res }) => res.decision), Object.keys(sentToCheck() ?? {})], [
      'check', 'check', 'check', 'check', [`${full(made.light)} for no task`, `${full(made.flat)} for no task`, `${full(made.mine)} for 2.3`, `${full(made.mine)} for 2.4`],
    ]);
    assert.deepStrictEqual([reworded.res.decision, reworded.res.reason], ['ask', 'Checking couldn\'t settle it, so it comes to you.']);
  });

  it('16.S68, the label\'s half: with no label — the stub serving no login — a call asks however quiet its kind, saying so', async (t) => {
    byTheRule(t);
    quietOn('behaviour');

    const { res } = await raised(NOTE, ['--answers', made.note], CALL, conversation());

    const unlabelled = 'I couldn\'t tell what kind of question this is, so it comes to you.';
    assert.deepStrictEqual([res.decision, res.reason, seals()?.[res.raise].label], ['ask', unlabelled, null]);
  });

  it('--always: Claude\'s mark asks however quiet the kind, and though Claude could find the answer out — a design problem at a topic, testing against a live server parking its task in the build (19.4.22, 19.4.20)', async (t) => {
    byTheRule(t);
    quietOn('behaviour');
    const checkable = labelledAs(CALL, 'behaviour', { yes: ['checkable'] });

    const design = (await raised(NOTE, ['--answers', made.note, '--always', 'design-problem'], CALL, checkable)).res;
    const server = (await raised(BUILD, ['--answers', made.where, '--parks', '2.3', '--always', 'live-server'], CALL, checkable)).res;

    assert.deepStrictEqual([[design.decision, design.reason], [server.decision, server.parked, server.reason]], [
      ['ask', 'The root cause is a design problem, so it always comes to you.'],
      ['ask', 'Q1', 'It means testing against a live server, so it always comes to you.'],
    ]);
  });

  it('refuses --always given twice, with no mark or one of none, and on a fact, which always asks — writing and sealing nothing', async () => {
    const refused = async (/** @type {string[]} */ flags, /** @type {unknown} */ call = CALL) => {
      const before = { tree: treeSnapshot(dir), head: head(dir) };
      const { error } = await refusesAsync(dir, ['raise', NOTE, '--answers', made.note, ...flags], { env: conversation(), stdin: JSON.stringify(call) });
      assert.deepStrictEqual([{ tree: treeSnapshot(dir), head: head(dir) }, seals()], [before, null], `raise ${flags.join(' ')} wrote or sealed on refusing`);
      return error;
    };
    const fact = { question: 'Which iCloud account does a new note sync to?', rows: [], mechanism: 'The sync container.', product_wide: false };

    assert.deepStrictEqual([
      await refused(['--always', 'live-server', '--always', 'design-problem']), await refused(['--always']), await refused(['--always', 'urgent']),
      (await refused(['--fact', '--always', 'live-server'], fact)).replace(/ — Usage: .*/, ''),
    ], [
      'raise takes --always once — Usage: engine raise <work-unit>.<phase>[.<topic>] --answers <id> [--relies-on <id> …] [--parks <phase>.<n>] [--always design-problem|live-server]   (the call as JSON on stdin)',
      'raise: --always takes design-problem or live-server — not nothing',
      'raise: --always takes design-problem or live-server — not "urgent"',
      'raise --fact takes no --always: a fact always asks',
    ]);
  });

  it('3.S15: in a build in auto, a danger question parks its task for the person however quiet its kind, and though Claude could find the answer out — a question about the session whose option could lose data, composing process, among them (16.S62, 16.5.1)', async (t) => {
    byTheRule(t);
    quietOn('process');

    const { res } = await raised(BUILD, ['--answers', made.where, '--parks', '2.3'], CALL, labelledAs(CALL, 'process', { yes: ['danger', 'checkable'] }));

    assert.deepStrictEqual([res.decision, res.parked, res.task, res.reason, sentToCheck()], ['ask', 'Q1', '2.3', 'An answer here could lose data or weaken security, so it always comes to you.', null]);
  });

  it('16.S72: mid-build, replacing the person\'s decision of a quiet kind asks, parking its task, whatever the counts; replacing Claude\'s call of the same kind follows the rule, and proceeds, landing Claude\'s replacement (16.5.7, 12.9.2)', async (t) => {
    byTheRule(t);
    quietOn('behaviour');
    const labelledFrame = labelledAs(FRAMED, 'behaviour');

    const yours = (await raised(BUILD, ['--replaces', made.yours, '--reason', 'was-wrong', '--parks', '2.4'], FRAMED, labelledFrame)).res;
    const mine = (await raised(BUILD, ['--replaces', made.mine, '--reason', 'was-wrong', '--parks', '2.5'], FRAMED, labelledFrame)).res;

    assert.deepStrictEqual([yours.decision, yours.parked, yours.reason], ['ask', 'Q1', 'You decided this yourself, so changing it always comes to you.']);
    assert.deepStrictEqual([mine.decision, lastEntry().event, lastEntry().replaces, lastEntry().by, lastEntry().task], ['proceed', 'replaced', full(made.mine), 'claude', '2.5']);
  });

  it('a decision of Claude\'s the person kept against its replacement is theirs: raised for replacement again, it asks whatever the counts, as their own decision would (16.5.7, 5.3.14)', async (t) => {
    quietOn('behaviour');
    const labelledFrame = labelledAs(FRAMED, 'behaviour');
    const first = (await raised(NOTE, ['--replaces', made.light, '--reason', 'was-wrong'], FRAMED, labelledFrame)).res;
    answer(first.raise, ['--pick', 'keep'], { why: 'They want a note light.' });
    byTheRule(t);

    const again = (await raised(NOTE, ['--replaces', made.light, '--reason', 'changed-mind'], FRAMED, labelledFrame)).res;

    assert.deepStrictEqual([again.decision, again.reason, lastEntry().event], ['ask', 'You decided this yourself, so changing it always comes to you.', 'kept']);
  });
});
