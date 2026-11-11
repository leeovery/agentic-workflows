'use strict';

// ---------------------------------------------------------------------------
// A raise decided by the ask rule (leeway-engine/scripts/domain/raise.cjs,
// over the decision point domain/decision-point.cjs and the rule
// domain/ask-rule.cjs): what the raise gives the decision point beside the
// call (E1), every call still asking until the rule is switched on; and,
// the decision point forced to the rule in process (`ruled`) as the switch
// will make it, a question Claude could find out sent to check and asked
// once raised again, a call with no label asked (16.S68), Claude's mark that
// always asks (`--always`), a danger question in a build in auto parking its
// task (3.S15), and a replacement mid-build asking where it would replace
// the person's decision and proceeding where Claude's (16.S72).
//
// Layer: verb. World: the ledger suites' epic in discussion, a question
// asked at its topic; and an epic beside it in its build, in auto,
// questions asked there and two decisions — the person's and Claude's —
// built once and copied for each test; each test keeps its conversation and
// the trust log in a config folder of its own, the log written with the
// answers the rule counts, as of now — and there too the transcript naming
// the session's model, where a test gives one. The world has no tracker, so
// the check that the tracker holds the task a raise parks is passed over
// here (test-engine-task-parks.cjs). The separate call is the stub binary,
// labelling the call's question where a test arms it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { okSectionsAsync, refusesAsync, treeSnapshot, head, statePath, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder, createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, MADE, NOTE, PHASES, ledgerHelpers } = require('./ledger-world.cjs');
const { SESSION, raiseHelpers } = require('./raise-world.cjs');
const { DAY, MODEL, lines, history } = require('./trust-world.cjs');
const { labelled, labelling } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const decisionPoint = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { TRUST_LOG } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));

mock.method(require(path.join(SCRIPTS, 'domain/task-parks.cjs')), 'checkParkable', () => {});

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */
/** @typedef {import('./labels.cjs').Marks} Marks */

const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';
// An epic in its build, in auto, beside the epic in discussion.
const BUILT = 'mint';
const BUILD = `${BUILT}.implementation`;
// The stub's labeller, as the label names it.
const LABELLER = 'claude-sonnet-stub';

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

/** What the world holds, by name: each question's and decision's short id. */
const made = { note: '', where: '', size: '', edge: '', yours: '', mine: '' };

const world = fixtureFrom('raise-rule-', (template) => {
  createManifest(template, UNIT, { work_type: 'epic', phases: PHASES });
  createManifest(template, BUILT, { work_type: 'epic', phases: PHASES, build: { position: 'auto' } });
  const { write } = ledgerHelpers(() => template);
  /** @param {string} at @param {string} text */
  const ask = (at, text) => write('ask', at, [], { ...MADE, text }).id;
  made.note = ask(NOTE, 'Where does a new note open?');
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

const { ledgerText, full } = ledgerHelpers(() => dir);
const { conversation, inFolder, seals, logText, project, lastEntry } = raiseHelpers(() => dir, config, CALL);

/** The decision point forced to the rule, as switching it on makes it, for test `t`. @param {import('node:test').TestContext} t */
const byTheRule = (t) => t.mock.method(decisionPoint, 'decide', decisionPoint.ruled);

/**
 * The trust log holding `clean` answers on `kind` in this project, each
 * taking Claude's lean, as of a day ago: its text.
 * @param {Kind} kind @param {number} clean
 */
function quietOn(kind, clean = 30) {
  const h = history({ project: project(), start: Date.now() - DAY });
  h.agree(clean, kind);
  fs.mkdirSync(config(), { recursive: true });
  fs.writeFileSync(path.join(config(), TRUST_LOG), lines(...h.events));
  return logText();
}

/** The conversation, the stub labelling `call`'s question `kind`, marked as `marks` says. @param {Record<string, unknown>} call @param {Kind} kind @param {Marks} [marks] */
const labelledAs = (call, kind, marks) => conversation(labelling(/** @type {string} */ (call.question), kind, marks));

/**
 * A raise of `call` at `at` with `flags`, in the conversation `env` names:
 * its response and whatever it drew.
 * @param {string} at @param {string[]} flags @param {Record<string, unknown>} call @param {Record<string, string|undefined>} env
 */
const raised = (at, flags, call, env) => okSectionsAsync(dir, ['raise', at, ...flags], { env, stdin: JSON.stringify(call) });

/** The conversation's record of what it sent to check. @returns {Record<string, string>|null} */
const sentToCheck = () => (fs.existsSync(inFolder('raise-checked.json')) ? JSON.parse(fs.readFileSync(inFolder('raise-checked.json'), 'utf8')) : null);

describe('what the decision point is given (E1)', () => {
  it('beside the call: its label, where it is made and whether it blocks build work, who decided the entry it would replace, Claude\'s mark, whether it was sent to check, the project, the session\'s model — none where its transcript names none — and the time; and every call still asks, as before the rule is switched on', async (t) => {
    const decide = t.mock.method(decisionPoint, 'decide');
    const claude = path.join(config(), 'claude');
    const transcript = path.join(claude, 'projects', '-Users-me-fumi', `${SESSION}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { model: MODEL } })}\n`);
    const before = Date.now();

    const topic = await raised(NOTE, ['--answers', made.note], CALL, { ...labelledAs(CALL, 'look'), CLAUDE_CONFIG_DIR: claude });
    const build = await raised(BUILD, ['--replaces', made.yours, '--reason', 'was-wrong', '--parks', '2.3', '--always', 'live-server'], FRAMED, labelledAs(FRAMED, 'contract', { hardToUndo: true }));

    const after = Date.now();
    const given = decide.mock.calls.map((called) => called.arguments);
    const at = given.map(([, at]) => /** @type {import('../../skills/leeway-engine/scripts/domain/decision-point.cjs').At} */ (at));
    assert.ok(at.every(({ now }) => now >= before && now <= after), 'the time given is not the raise\'s');
    const common = { checked: false, project: { root: statePath(dir), name: projectName(dir) } };
    assert.deepStrictEqual(given.map(([call, { now: _now, ...rest }]) => [call, rest]), [
      [CALL, { ...common, label: { labeller: LABELLER, answers: labelled('look').answers }, place: { unit: UNIT, phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, always: null, model: MODEL }],
      [FRAMED, { ...common, label: { labeller: LABELLER, answers: labelled('contract', { hardToUndo: true }).answers }, place: { unit: BUILT, phase: 'implementation', topic: null }, blocks_build: true, replaced_by: 'person', always: 'live-server', model: null }],
    ]);
    assert.deepStrictEqual([topic.res.decision, topic.res.reason, build.res.decision, build.res.parked], ['ask', EVERY_CALL_ASKS, 'ask', 'Q1']);
  });
});

describe('the rule\'s decisions as a raise meets them', () => {
  it('a question Claude could find out is sent to check — drawing, sealing, parking, landing and logging nothing, the conversation keeping it as sent — and raised again, asks: at a topic, and in the build (16.3.1, 16.11.7)', async (t) => {
    byTheRule(t);
    const log = quietOn('behaviour');
    const checkable = labelledAs(CALL, 'behaviour', { yes: ['checkable'] });
    const ledger = ledgerText();
    const check = { ok: true, decision: 'check', reason: 'You can find this out: check it — read the code or the record, or run something — and raise it again only if checking can\'t settle it.' };

    const sent = [await raised(NOTE, ['--answers', made.note], CALL, checkable), await raised(BUILD, ['--answers', made.size, '--parks', '2.3'], CALL, checkable)];

    assert.deepStrictEqual(sent.map(({ res, sections }) => [res, sections]), [[check, ''], [check, '']]);
    assert.deepStrictEqual([ledgerText(), logText(), seals(), Object.keys(sentToCheck() ?? {})], [ledger, log, null, [full(made.note), full(made.size)]]);
    const checked = 'Checking couldn\'t settle it, so it comes to you.';
    const again = await raised(NOTE, ['--answers', made.note], CALL, checkable);
    assert.deepStrictEqual([again.res.decision, again.res.reason, seals()?.[again.res.raise].reason], ['ask', checked, checked]);
    assert.match(again.sections, /^WHY I'M ASKING\n\nChecking couldn't settle it, so it comes to you\.$/m);
    const parked = (await raised(BUILD, ['--answers', made.size, '--parks', '2.3'], CALL, checkable)).res;
    assert.deepStrictEqual([parked.decision, parked.parked, lastEntry().why_asking], ['ask', 'Q1', checked]);
  });

  it('16.S68, the label\'s half: with no label — the stub serving no login — a call asks however quiet its kind, saying so', async (t) => {
    byTheRule(t);
    quietOn('behaviour');

    const { res } = await raised(NOTE, ['--answers', made.note], CALL, conversation());

    const unlabelled = 'I couldn\'t tell what kind of question this is, so it comes to you.';
    assert.deepStrictEqual([res.decision, res.reason, seals()?.[res.raise].label], ['ask', unlabelled, null]);
  });

  it('--always: Claude\'s mark asks however quiet the kind — a design problem at a topic, testing against a live server parking its task in the build (19.4.22, 19.4.20)', async (t) => {
    byTheRule(t);
    quietOn('behaviour');

    const design = (await raised(NOTE, ['--answers', made.note, '--always', 'design-problem'], CALL, labelledAs(CALL, 'behaviour'))).res;
    const server = (await raised(BUILD, ['--answers', made.where, '--parks', '2.3', '--always', 'live-server'], CALL, labelledAs(CALL, 'behaviour'))).res;

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

  it('3.S15: in a build in auto, a danger question parks its task for the person however quiet its kind — a question about the session whose option could lose data, composing process, among them (16.S62)', async (t) => {
    byTheRule(t);
    quietOn('process');

    const { res } = await raised(BUILD, ['--answers', made.where, '--parks', '2.3'], CALL, labelledAs(CALL, 'process', { yes: ['danger'] }));

    assert.deepStrictEqual([res.decision, res.parked, res.task, res.reason], ['ask', 'Q1', '2.3', 'An answer here could lose data or weaken security, so it always comes to you.']);
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
});
