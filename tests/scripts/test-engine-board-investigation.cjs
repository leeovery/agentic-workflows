'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a bug's investigation (leeway-engine/scripts/domain/
// projections/board-investigation.cjs; 20.12): This session drawn from the
// hunt's log, the ledger at its place, its validations' rows and the raises
// this conversation sealed there — what waits on the person with what
// raised it, the validation being read with its clock (20.S18); the
// person's ruling theirs, a hypothesis it made intended, and the fix
// direction's step back and options, Claude's lean marked (20.S19); nothing
// of earlier fixes (20.S20); the investigation dated by its close on the
// unit's tab, and the hunt's pages (20.12.2). The mod's fixtures are held to
// the engine's answers here.
//
// Layer: verb. World, built once and copied: a bugfix, `kill-all`, its
// investigation entered, two symptoms, three hypotheses, an experiment on
// its finding, a root cause logged on its decision with a body, and a
// question of Claude's waiting to be raised; an earlier bugfix, complete,
// that fixed the same area. Each test's conversation has its own system
// config, where its raises are sealed.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, okSectionsAsync, readManifest, writeState, commitAll, fixtureFrom, cleanupFixture, layout } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { fixture, misfits, emptyLists, place, standingOn } = require('./board-world.cjs');

const BUG = 'kill-all';
const EARLIER = 'empty-save';
const AT = `${BUG}.investigation.${BUG}`;
const STARTED = '2026-08-16T09:00:00.000Z';
const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const EVERY_CALL_ASKS = 'Every call comes to you for now: the counts that would let me decide aren\'t built yet.';

/** The ledger entries the hunt rests on, by short id. */
const made = { cause: '', rootCause: '', kill: '', keep: '', fix: '', call: '' };

const world = fixtureFrom('engine-board-investigation-', (dir) => {
  createManifest(dir, BUG, { work_type: 'bugfix', created: STARTED, description: 'Killing every session wipes the saved state' });
  createManifest(dir, EARLIER, {
    work_type: 'bugfix', status: 'completed', area: 'session restore', phases: { investigation: { items: { [EARLIER]: { status: 'completed', concluded_at: '2026-07-01T10:00:00.000Z', area: 'session restore' } } } },
  });
  writeState(dir, layout.topic(BUG, BUG, 'log.md'), '# Kill All\n\n## Earlier fixes\n\nempty-save fixed session restore before; the guard it added holds.\n');
  commitAll(dir, 'the world');
  ok(dir, ['enter', 'investigation', BUG], { env: { CLAUDE_PID: undefined } });
  const { write } = ledgerHelpers(() => dir);
  const hunted = (/** @type {string} */ kind, /** @type {string[]} */ args) => ok(dir, ['investigation-log', kind, BUG, ...args]);
  hunted('symptom', ['--text', 'sessions.json is overwritten with an empty index']);
  hunted('symptom', ['--text', 'Every saved scrollback file is removed']);
  hunted('hypothesis', ['--title', 'Killing every session empties the state', '--state', 'confirmed']);
  hunted('hypothesis', ['--title', 'kill-server saves an empty state', '--state', 'ruled-out']);
  hunted('hypothesis', ['--title', 'A dying tmux reads as zero sessions']);
  made.kill = write('find', AT, [], { ...CLAUDE, text: 'Killing every session leaves an empty save.', how: 'Killed them on a throwaway tmux.', known: 'read' }).id;
  const body = path.join(dir, '.body.md');
  fs.writeFileSync(body, '3 sessions saved, each kill shrank the save.\n');
  hunted('experiment', ['--title', 'Kill every session, hook on', '--showed', 'each kill shrank it', '--entry', made.kill, '--body', body]);
  made.cause = write('ask', AT, [], { ...CLAUDE, text: 'What empties the saved state?' }).id;
  made.rootCause = write('decide', AT, ['--answers', made.cause], { ...CLAUDE, text: 'Every save takes the session list as the whole truth. Whatever it does not see is dropped.', why: 'The capture is all it reads.' }).id;
  fs.writeFileSync(body, 'The housekeeping pass deletes every file the index no longer names.\n');
  hunted('root-cause', ['--entry', made.rootCause, '--body', body]);
  fs.rmSync(body);
  made.keep = write('ask', AT, [], { ...CLAUDE, text: 'A session you kill yourself: should it ever come back?' }).id;
  made.fix = write('ask', AT, [], { ...CLAUDE, text: 'How should a save stop losing sessions?' }).id;
});

let dir; // the project
let config; // the system config: the conversation's folder

/** The engine as the conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** A call that must succeed: its response. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** The board's answer for the conversation, its `ok` dropped. @param {string[]} [args] */
function board(args = []) {
  const { ok: _ok, ...answer } = run(['board', 'sess-1', ...args]);
  return answer;
}

/** The conversation at the investigation, as its labelling records it. */
const atTheHunt = () => run(['session', 'label', BUG, 'investigation', BUG]);

const { write: wrote } = ledgerHelpers(() => dir);

/** A ledger write at the investigation. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
const write = (verb, flags, content) => wrote(verb, AT, flags, content);

/** An entry's full id. @param {string} short */
const full = (short) => ledgerHelpers(() => dir).full(short);

/**
 * A validation of `kind` dispatched by this conversation, its report in and
 * acknowledged with the findings given: its row, being acted on.
 * @param {string} kind @param {string[]} findings
 */
function dispatched(kind, findings) {
  const row = run(['agent', 'dispatch', BUG, 'investigation', BUG, '--kind', kind]);
  fs.writeFileSync(row.file, `# Validation — ${row.id}\n\n## Findings\n\n${findings.map((id) => `### ${id}: it does not hold\n`).join('\n') || 'None identified.\n'}`);
  const { pending } = run(['agent', 'scan', BUG, 'investigation', BUG]);
  run(['agent', 'ack', BUG, 'investigation', BUG, row.id, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]);
  return { id: row.id, created: pending.find((/** @type {{id: string}} */ held) => held.id === row.id).created };
}

/** A validation taken in, acted on. @param {string} id */
const takenIn = (id) => run(['agent', 'incorporate', BUG, 'investigation', BUG, id]);

/** The validator's question, as Claude raises it: two rows, the first its lean. */
const KEEP_CALL = Object.freeze({
  question: 'A session you kill yourself: should it ever come back? Killing every one today empties the saved state.',
  rows: [
    { key: 'gone', name: 'Never', text: 'A session you kill never comes back', notice: 'a kill is final' },
    { key: 'back', name: 'Back', text: 'A session you kill comes back at the next restore', notice: 'nothing is final' },
  ],
  lean: 'gone', why: 'Killing it is the person saying so.', sort: 'one', mechanism: 'The kill hook drops it from the save.', product_wide: false,
});

/** The fix direction, as Claude sets it out after stepping back. */
const FIX_CALL = Object.freeze({
  question: 'How should a save stop losing sessions?',
  rows: [
    { key: '1', name: 'Harden the reads, outlast the shutdown', text: 'Stop reading a dying tmux as no sessions, and log every drop', notice: 'a reboot keeps every session' },
    { key: '2', name: 'Read hardening alone', text: 'Only stop reading a dying tmux as no sessions', notice: 'sessions dying first are still lost' },
  ],
  lean: '1', why: 'It covers both routes.', sort: 'one', mechanism: 'The capture refuses an empty read.', product_wide: false,
  stepped_back: ['Other tools that save tmux state snapshot every 15 minutes.', 'None promises a kill is final.'],
});

/** A raise drawn at the investigation in this conversation: its id. @param {Record<string, unknown>} call @param {string} question */
async function raised(call, question) {
  return (await okSectionsAsync(dir, ['raise', AT, '--answers', question], { env: env(), stdin: JSON.stringify(call) })).res.raise;
}

/** The person's pick of a raise: the decision it landed, by its full id. @param {string} raise @param {string} key */
function picked(raise, key) {
  ok(dir, ['raise', 'answer', raise, '--pick', key], { env: env(), stdin: JSON.stringify({ why: 'Killing it is the person saying so.' }) });
  return ledgerHelpers(() => dir).entries().at(-1).id;
}

/** A wait by its words, its id the raise's short form. @param {{id: string}} wait @param {string} raise */
function byRaise(wait, raise) {
  assert.ok(raise.startsWith(wait.id) && wait.id.length > 0, `${wait.id} is the short form of ${raise}`);
  return { ...wait, id: raise };
}

/** The view's lists, each by what tells its entries apart. @param {any} view */
const listsOf = (view) => ({
  hypotheses: view.hypotheses.map((/** @type {{name: string, state: string}} */ { name, state }) => `${name} ${state}`),
  validations: view.validations.map((/** @type {{validation: string, state: string}} */ { validation, state }) => `${validation} ${state}`),
});

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-board-investigation-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('This session in an investigation (20.12.1)', () => {
  it('20.S18: a question the root-cause validation raised waits on the person, asked in the conversation, with what raised it and why it reached them; the validation reads with its clock from its dispatch; the banner flags it', async () => {
    const validation = dispatched('root-cause-validation', ['F1', 'F2']);
    const raise = await raised(KEEP_CALL, made.keep);
    atTheHunt();
    const { view, banner } = board();

    assert.deepStrictEqual({ ...view, waiting: view.waiting.map((/** @type {{id: string}} */ wait) => byRaise(wait, raise)) }, {
      kind: 'investigation',
      unit: BUG,
      title: 'Kill All',
      type: 'bugfix',
      project: view.project,
      started: STARTED,
      standing: 'validating-root-cause',
      waiting: [{ kind: 'raise', id: raise, text: KEEP_CALL.question, page: null, raised_by: 'root-cause', why: EVERY_CALL_ASKS, options: null }],
      decided: [],
      symptoms: ['sessions.json is overwritten with an empty index', 'Every saved scrollback file is removed'],
      hypotheses: [
        { name: 'H1', title: 'Killing every session empties the state', state: 'confirmed' },
        { name: 'H2', title: 'kill-server saves an empty state', state: 'ruled-out' },
        { name: 'H3', title: 'A dying tmux reads as zero sessions', state: 'suspected' },
      ],
      experiments: [{ name: 'E1', title: 'Kill every session, hook on', showed: 'each kill shrank it' }],
      root_cause: { text: 'Every save takes the session list as the whole truth. Whatever it does not see is dropped.', validated: false },
      validations: [
        { validation: 'root-cause', effort: 'xhigh', state: 'running', since: validation.created, found: 0 },
        { validation: 'fix', effort: 'medium', state: 'after', since: null, found: 0 },
      ],
      since: [],
      fix_direction: { state: 'after', stepped_back: [], options: [], pick: null, fix: null },
    });
    assert.strictEqual(typeof view.project, 'string');
    assert.deepStrictEqual(banner, { name: 'Kill All', state: 'needs', facts: [place('bugfix'), place('investigation'), { text: 'validating the root cause', needs: false }, { text: '1 waiting on you', needs: true }] });
  });

  it('a raise at the place drawn while no validation runs says nothing of what raised it; one answered waits no longer', async () => {
    const raise = await raised(KEEP_CALL, made.keep);
    atTheHunt();

    assert.deepStrictEqual(board().view.waiting.map((/** @type {{raised_by: string|null}} */ { raised_by: by }) => by), [null]);
    picked(raise, 'gone');
    assert.deepStrictEqual(board().view.waiting, []);
  });

  it('20.S19: the person\'s answer is DECIDED, theirs; the hypothesis their ruling made intended reads so; once the root cause is validated the fix direction sets out what stepping back found and its options, Claude\'s lean marked, and waits on them', async () => {
    const validation = dispatched('root-cause-validation', ['F1']);
    const ruling = picked(await raised(KEEP_CALL, made.keep), 'gone');
    run(['investigation-log', 'hypothesis', BUG, 'H1', '--state', 'intended', '--by', ruling]);
    takenIn(validation.id);
    const fix = await raised(FIX_CALL, made.fix);
    atTheHunt();
    const { view, banner } = board();

    assert.deepStrictEqual({
      decided: view.decided.map((/** @type {{id: string, text: string}} */ { id, text }) => ({ id: full(id), text })),
      lists: listsOf(view),
      root: view.root_cause.validated,
      standing: view.standing,
      waiting: view.waiting.map((/** @type {{id: string}} */ wait) => byRaise(wait, fix)),
      fix: view.fix_direction,
    }, {
      decided: [{ id: ruling, text: 'A session you kill never comes back' }],
      lists: { hypotheses: ['H1 intended', 'H2 ruled-out', 'H3 suspected'], validations: ['root-cause done', 'fix after'] },
      root: true,
      standing: 'fix-waits',
      waiting: [{ kind: 'raise', id: fix, text: FIX_CALL.question, page: null, raised_by: 'fix-direction', why: EVERY_CALL_ASKS, options: 2 }],
      fix: {
        state: 'asking',
        stepped_back: FIX_CALL.stepped_back,
        options: [{ key: '1', name: 'Harden the reads, outlast the shutdown', lean: true }, { key: '2', name: 'Read hardening alone', lean: false }],
        pick: null,
        fix: null,
      },
    });
    assert.strictEqual(view.validations[0].found, 1, 'the validation found one, acted on');
    assert.deepStrictEqual(banner.facts.map((/** @type {{text: string}} */ { text }) => text), ['bugfix', 'investigation', 'fix direction', '1 waiting on you']);
  });

  it('once picked, the fix direction holds the person\'s pick and the fix in its words, and the fix validation runs; the fix logged, its validation is what it waits on', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    const decision = picked(await raised(FIX_CALL, made.fix), '2');
    run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
    atTheHunt();
    const before = board().view;
    const validation = dispatched('fix-validation', ['F1']);
    const after = board().view;

    assert.deepStrictEqual([before.fix_direction, before.standing, before.validations[1].state], [
      { state: 'picked', stepped_back: FIX_CALL.stepped_back, options: [{ key: '1', name: 'Harden the reads, outlast the shutdown', lean: true }, { key: '2', name: 'Read hardening alone', lean: false }], pick: '2', fix: 'Only stop reading a dying tmux as no sessions' },
      'validating-fix',
      'not-started',
    ]);
    assert.deepStrictEqual([after.validations[1], after.decided], [{ validation: 'fix', effort: 'medium', state: 'running', since: validation.created, found: 0 }, []], `the fix ${decision} is the fix direction's, never DECIDED`);
  });

  it('Claude\'s calls since the calls list was last drawn, read without looking (5.8.14); the root cause, Claude\'s too, is its own section, never among them', () => {
    const asked = write('ask', [], { ...CLAUDE, text: 'Does restore keep reading no tmux as no sessions?' }).id;
    const call = write('decide', ['--answers', asked], { ...CLAUDE, text: 'Restore keeps reading it so; only saving stops trusting it', why: 'One failure at start would skip every session.' }).id;
    atTheHunt();
    const since = () => board().view.since.map((/** @type {{id: string, text: string}} */ { id, text }) => [full(id), text]);

    assert.deepStrictEqual(since(), [[full(call), 'Restore keeps reading it so; only saving stops trusting it']]);
    assert.deepStrictEqual(since(), [[full(call), 'Restore keeps reading it so; only saving stops trusting it']], 'the board never looks');
  });

  it('20.S20: an area fixed before shows nothing of the earlier fix and counts none — the earlier bugfix stands on All work, the log\'s prose on it is Claude\'s alone', () => {
    atTheHunt();
    const { view } = board();
    const all = board(['--tab', 'all']).view;

    assert.ok(all.complete.some((/** @type {{unit: string}} */ { unit }) => unit === EARLIER), 'All work lists the earlier fix');
    assert.deepStrictEqual(Object.keys(view).sort(), ['decided', 'experiments', 'fix_direction', 'hypotheses', 'kind', 'project', 'root_cause', 'since', 'standing', 'started', 'symptoms', 'title', 'type', 'unit', 'validations', 'waiting']);
    assert.doesNotMatch(JSON.stringify(view), new RegExp(`${EARLIER}|session restore|guard it added`));
  });
});

describe('the investigation concluded, and the unit\'s tab (20.12.4, 20.15)', () => {
  it('concluded: This session says the specification is next, the banner done; the tab dates the investigation by its close and its row counts the hypotheses', () => {
    const manifest = readManifest(dir, BUG);
    manifest.phases.investigation.items[BUG] = { status: 'completed', concluded_at: '2026-08-20T15:00:00.000Z' };
    writeState(dir, layout.manifest(BUG), JSON.stringify(manifest, null, 2));
    atTheHunt();
    const { view, banner } = board();
    const tab = board(['--tab', 'unit']).view;

    assert.deepStrictEqual([view.standing, view.waiting, banner.state, banner.facts.at(-1).text], ['concluded', [], 'done', 'concluded · the specification next']);
    assert.deepStrictEqual(tab.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'investigation'), {
      phase: 'investigation', state: 'complete', words: '3 hypotheses', doing: '', on: '2026-08-20T15:00:00.000Z', session: 'this', page: false,
    });
  });

  it('under way, the tab says it validates while a validation runs and waits on the person while a raise does, the raise on its one list', async () => {
    atTheHunt();
    const row = () => board(['--tab', 'unit']).view.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'investigation');
    const investigating = row();
    dispatched('root-cause-validation', ['F1']);
    const validating = row();
    const raise = await raised(KEEP_CALL, made.keep);

    assert.deepStrictEqual([investigating.state, investigating.doing, validating.state, validating.doing], ['running', 'validating', 'running', 'validating']);
    const { tab } = standingOn(board, BUG);
    assert.deepStrictEqual({ ...tab, waiting: tab.waiting.map((/** @type {string} */ line) => line.split(' ')[0]) }, { now: 'investigation', state: 'waits', words: '3 hypotheses', waiting: ['raise'] });
    assert.ok(raise.startsWith(tab.waiting[0].split(' ')[1]), 'the raise by its short id, opening no page');
  });
});

describe('the hunt\'s pages (20.12.2)', () => {
  it('each hypothesis, experiment, the root cause, what stepping back found and an option opens on its own page; a part the hunt lacks is refused', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    await raised(FIX_CALL, made.fix);
    atTheHunt();
    const page = (/** @type {string} */ ref) => board(['--page', ref]).view;

    assert.deepStrictEqual(['hunt:H3', 'hunt:E1', 'hunt:root-cause', 'hunt:stepped-back', 'option:1', 'option:2'].map(page), [
      { kind: 'hunt', unit: BUG, item: 'hypothesis', name: 'H3', title: 'A dying tmux reads as zero sessions', state: 'suspected', text: '' },
      { kind: 'hunt', unit: BUG, item: 'experiment', name: 'E1', title: 'Kill every session, hook on', state: 'each kill shrank it', text: '3 sessions saved, each kill shrank the save.' },
      {
        kind: 'hunt', unit: BUG, item: 'root-cause', name: null, title: '', state: 'validated',
        text: 'Every save takes the session list as the whole truth. Whatever it does not see is dropped.\n\nThe housekeeping pass deletes every file the index no longer names.',
      },
      { kind: 'hunt', unit: BUG, item: 'stepped-back', name: null, title: '', state: null, text: FIX_CALL.stepped_back.join('\n\n') },
      { kind: 'hunt', unit: BUG, item: 'option', name: '1', title: FIX_CALL.rows[0].name, state: 'lean', text: `${FIX_CALL.rows[0].text}\n\n${FIX_CALL.rows[0].notice}` },
      { kind: 'hunt', unit: BUG, item: 'option', name: '2', title: FIX_CALL.rows[1].name, state: 'option', text: `${FIX_CALL.rows[1].text}\n\n${FIX_CALL.rows[1].notice}` },
    ]);
    assert.deepStrictEqual(['hunt:H9', 'option:3'].map((ref) => board(['--page', ref]).view), [
      { kind: 'unavailable', reason: `${BUG}'s investigation holds no H9 — a hunt's page is a hypothesis or an experiment by its name, the root cause, or what stepping back found` },
      { kind: 'unavailable', reason: `${BUG}'s fix direction holds no option 3 in this conversation` },
    ]);
  });
});

describe('the views the mod draws, shaped as the engine answers them (N8)', () => {
  it('the investigation and a page of its hunt fit the mod\'s fixtures', async () => {
    dispatched('root-cause-validation', ['F1']);
    await raised(KEEP_CALL, made.keep);
    const rule = write('ask', [], { ...PERSON, text: 'Should a detached session come back?' }).id;
    write('decide', ['--answers', rule], { ...PERSON, text: 'A session you detach from comes back.', why: 'Detaching is not ending it.' });
    const call = write('ask', [], { ...CLAUDE, text: 'Does restore keep reading no tmux as no sessions?' }).id;
    write('decide', ['--answers', call], { ...CLAUDE, text: 'Restore keeps reading it so.', why: 'One failure at start would skip every session.' });
    await raised(FIX_CALL, made.fix);
    atTheHunt();
    const { view } = board();
    const page = board(['--page', 'hunt:H1']).view;

    assert.deepStrictEqual([misfits(await fixture('board-investigation.mjs'), view), misfits(await fixture('board-hunt.mjs'), page)], [[], []]);
    assert.deepStrictEqual(emptyLists(view), [], 'every list the shape is held to holds an entry');
  });
});
