'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a bug's investigation (leeway-engine/scripts/domain/
// projections/board-investigation.cjs; 20.12): This session drawn from the
// hunt's log, the ledger at its place, its validations' rows and the raises
// this conversation sealed there — what waits on the person with the
// validation whose finding it was surfaced as, the validation being read
// with its clock (20.S18); the person's ruling theirs, a hypothesis it made
// intended, and the fix direction's step back and options, Claude's lean
// marked (20.S19); nothing of earlier fixes (20.S20); each decision read
// where its chain stands now; the investigation dated by its close on the
// unit's tab, opened there once concluded, the hunt's moments in its
// LATELY, and how far it has come on All work; the hunt's pages (20.12.2). The mod's fixtures are held to the
// engine's answers here.
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
const { ok, okSectionsAsync, refuses, readManifest, writeState, commitAll, fixtureFrom, cleanupFixture, layout } = require('./engine-harness.cjs');
const { createManifest, withEnv } = require('./discovery-test-utils.cjs');
const { boardOf } = require('../../skills/leeway-engine/scripts/domain/board.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { fixture, misfits, emptyLists, place, standingOn } = require('./board-world.cjs');

const BUG = 'kill-all';
const EARLIER = 'empty-save';
const AT = `${BUG}.investigation.${BUG}`;
const STARTED = '2026-08-16T09:00:00.000Z';
const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const ROOT_CAUSE = 'Every save takes the session list as the whole truth. Whatever it does not see is dropped.';

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
  made.rootCause = write('decide', AT, ['--answers', made.cause], { ...CLAUDE, text: ROOT_CAUSE, why: 'The capture is all it reads.' }).id;
  fs.writeFileSync(body, 'The housekeeping pass deletes every file the index no longer names.\n');
  hunted('root-cause', ['--entry', made.rootCause, '--body', body]);
  fs.rmSync(body);
  made.keep = write('ask', AT, [], { ...CLAUDE, text: 'A session you kill yourself: should it ever come back?' }).id;
  made.fix = write('ask', AT, [], { ...CLAUDE, text: 'How should a save stop losing sessions?' }).id;
});

let dir; // the project
let config; // the system config: the conversation's folder

/** The engine as the conversation runs it, `session` its id. @param {string} [session] */
const env = (session = 'sess-1') => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: session, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** A call that must succeed: its response. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** The board's answer for a conversation, its `ok` dropped. @param {string[]} [args] @param {string} [session] */
function board(args = [], session = 'sess-1') {
  const { ok: _ok, ...answer } = ok(dir, ['board', session, ...args], { env: env(session) });
  return answer;
}

/** A conversation at the investigation, as its labelling records it. @param {string} [session] */
const atTheHunt = (session = 'sess-1') => ok(dir, ['session', 'label', BUG, 'investigation', BUG], { env: env(session) });

const { write: wrote } = ledgerHelpers(() => dir);

/** A ledger write at the investigation. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
const write = (verb, flags, content) => wrote(verb, AT, flags, content);

/** An entry's full id. @param {string} short */
const full = (short) => ledgerHelpers(() => dir).full(short);

/**
 * A validation of `kind` dispatched by this conversation — by the process
 * `pid` names — its report in and acknowledged with the findings given:
 * its row, being acted on.
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

/** A validation's finding marked taken, surfaced as what it was raised as. @param {string} id @param {string} finding @param {string[]} [as] */
const surfaced = (id, finding, as = []) => run(['agent', 'surface', BUG, 'investigation', BUG, id, finding, ...as]);

/** A finding of a validation's, landed as Claude's: its short id. @param {string} text */
const found = (text) => write('find', [], { ...CLAUDE, text, how: 'Read the shutdown path.', known: 'read' }).id;

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

/** The fix as the fix validation changes it, raised replacing the person's pick: two proposals, the first its lean. */
const REPLACE_CALL = Object.freeze({
  question: 'Hardening the reads alone leaves pane programs exposed: should the fix also outlast the shutdown?',
  rows: [
    { key: 'both', name: 'Harden and outlast', text: 'Harden the reads and make panes outlast the shutdown', notice: 'panes survive a reboot' },
    { key: 'reads', name: 'Reads only, logged', text: 'Harden the reads and log every drop', notice: 'drops are logged' },
  ],
  lean: 'both', why: 'It closes the second route too.', sort: 'one', mechanism: 'Panes trap SIGTERM.', product_wide: false,
});

/** A raise drawn at the investigation in this conversation: its id. @param {Record<string, unknown>} call @param {string[]} target */
async function raisedOn(call, target) {
  return (await okSectionsAsync(dir, ['raise', AT, ...target], { env: env(), stdin: JSON.stringify(call) })).res.raise;
}

/** A raise answering `question`: its id. @param {Record<string, unknown>} call @param {string} question */
const raised = (call, question) => raisedOn(call, ['--answers', question]);

/** The person's pick of a raise: the last entry of the ledger, by its full id. @param {string} raise @param {string} key */
function picked(raise, key) {
  ok(dir, ['raise', 'answer', raise, '--pick', key], { env: env(), stdin: JSON.stringify({ why: 'Killing it is the person saying so.' }) });
  return ledgerHelpers(() => dir).entries().at(-1).id;
}

/**
 * The root cause validated, the fix picked and logged, and the fix
 * validation's finding changing it raised replacing the pick and surfaced
 * so: the decision it would replace and the replacement's raise.
 */
async function fixReplaced() {
  takenIn(dispatched('root-cause-validation', []).id);
  const fix = picked(await raised(FIX_CALL, made.fix), '1');
  run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
  const validation = dispatched('fix-validation', ['F1']);
  const finding = found('Hardening the reads alone leaves pane programs exposed.');
  const raise = await raisedOn(REPLACE_CALL, ['--replaces', fix, '--reason', 'new-fact', '--cause', finding]);
  surfaced(validation.id, 'F1', ['--replaces', fix, '--reason', 'new-fact']);
  atTheHunt();
  return { fix, raise };
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

/** What raised each wait on the view. @param {any} view */
const raisedBy = (view) => view.waiting.map((/** @type {{raised_by: string|null}} */ { raised_by: by }) => by);

/** The investigation's row on the unit's tab. */
const tabRow = () => board(['--tab', 'unit']).view.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'investigation');

/** How far the investigation has come, as All work says it. */
const howFar = () => board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ { unit }) => unit === BUG).standing;

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-board-investigation-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('This session in an investigation (20.12.1)', () => {
  it('a question reworded after a finding was surfaced as it, raised again in its new words, is still that validation\'s', async () => {
    const validation = dispatched('root-cause-validation', ['F1']);
    await raised(KEEP_CALL, made.keep);
    surfaced(validation.id, 'F1', ['--question', made.keep]);
    const words = 'A session you kill: should restore ever bring it back?';
    const reworded = write('replace', ['--replaces', made.keep, '--reason', 'changed-mind'], { ...CLAUDE, drops: ['the old wording'], text: words }).id;
    const again = await raised({ ...KEEP_CALL, question: words }, reworded);
    atTheHunt();

    assert.deepStrictEqual(board().view.waiting.filter((/** @type {{id: string}} */ { id }) => again.startsWith(id)).map((/** @type {{raised_by: string|null}} */ { raised_by: by }) => by), ['root-cause']);
  });

  it('20.S18: a question the root-cause validation\'s one finding was surfaced as waits on the person, asked in the conversation, with what raised it and nothing more; while it waits the validation reads with its clock from its dispatch, though its row is taken in, the root cause being validated, the tab validating and All work not yet confirmed; the banner flags it; answered, the validation is done with what it found', async () => {
    const validation = dispatched('root-cause-validation', ['F1']);
    found('A session you kill never comes back, by design or not.');
    const raise = await raised(KEEP_CALL, made.keep);
    surfaced(validation.id, 'F1', ['--question', made.keep]);
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
      waiting: [{ kind: 'raise', id: raise, text: KEEP_CALL.question, page: null, raised_by: 'root-cause', options: null, lean_first: null }],
      decided: [],
      symptoms: ['sessions.json is overwritten with an empty index', 'Every saved scrollback file is removed'],
      hypotheses: [
        { name: 'H1', title: 'Killing every session empties the state', state: 'confirmed' },
        { name: 'H2', title: 'kill-server saves an empty state', state: 'ruled-out' },
        { name: 'H3', title: 'A dying tmux reads as zero sessions', state: 'suspected' },
      ],
      experiments: [{ name: 'E1', title: 'Kill every session, hook on', showed: 'each kill shrank it' }],
      root_cause: { text: ROOT_CAUSE, validated: false },
      validations: [
        { validation: 'root-cause', effort: 'xhigh', state: 'running', since: validation.created, found: 0 },
        { validation: 'fix', effort: 'medium', state: 'after', since: null, found: 0 },
      ],
      since: [],
      fix_direction: { state: 'after', stepped_back: [], options: [], pick: null, fix: null },
    });
    assert.strictEqual(typeof view.project, 'string');
    assert.deepStrictEqual(banner, { name: 'Kill All', state: 'needs', facts: [place('bugfix'), place('investigation'), { text: 'validating the root cause', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([tabRow().doing, howFar()], ['validating', 'cause found, not yet confirmed']);
    picked(raise, 'gone');
    const answered = board().view;
    assert.deepStrictEqual([answered.validations[0], answered.root_cause.validated, answered.standing, howFar()], [
      { validation: 'root-cause', effort: 'xhigh', state: 'done', since: null, found: 1 }, true, 'investigating', 'cause confirmed, the fix not yet picked',
    ]);
  });

  it('what raised a question is the record\'s: one Claude raises while a validation runs, surfaced as none of its findings, says nothing of it, nor does one raised after a finding was surfaced as another; one surfaced as the validation\'s last finding says it still once its row is taken in; one answered, by its raise or not, waits no longer; the live server\'s permission, asked at the investigation\'s own level, waits as any other', async () => {
    const validation = dispatched('root-cause-validation', ['F1']);
    await raised(KEEP_CALL, made.keep);
    atTheHunt();
    const before = raisedBy(board().view);
    write('decide', ['--answers', made.keep], { ...PERSON, text: 'A session you kill never comes back', why: 'Killing it is saying so.' });
    const answeredElsewhere = board().view.waiting;
    const asked = write('ask', [], { ...CLAUDE, text: 'Does it also happen when you detach?' }).id;
    found('Detaching may drop sessions too.');
    await raised({ ...KEEP_CALL, question: 'Does it also happen when you detach?' }, asked);
    const live = 'May I run it against the live server?';
    const atItsLevel = wrote('ask', `${BUG}.investigation`, [], { ...CLAUDE, text: live }).id;
    const refused = refuses(dir, ['agent', 'surface', BUG, 'investigation', BUG, validation.id, 'F1', '--question', atItsLevel], { env: env() });
    surfaced(validation.id, 'F1', ['--question', asked]);
    await okSectionsAsync(dir, ['raise', `${BUG}.investigation`, '--answers', atItsLevel], { env: env(), stdin: JSON.stringify({ ...KEEP_CALL, question: live }) });
    const reboot = write('ask', [], { ...CLAUDE, text: 'Does a reboot do it too?' }).id;
    await raised({ ...KEEP_CALL, question: 'Does a reboot do it too?' }, reboot);
    const { view, banner } = board();

    assert.deepStrictEqual(refused.error, `--question names a question asked at ${AT}, and ${atItsLevel} is none`, 'a validation\'s finding is asked as a question at its own place');
    assert.deepStrictEqual([before, answeredElsewhere, view.waiting.map((/** @type {{text: string, raised_by: string|null}} */ { text, raised_by: by }) => [text, by]), view.validations[0].state, banner.facts.at(-1)], [
      [null],
      [],
      [['Does it also happen when you detach?', 'root-cause'], [live, null], ['Does a reboot do it too?', null]],
      'running',
      { text: '3 waiting on you', needs: true },
    ]);
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
      waiting: [{ kind: 'raise', id: fix, text: FIX_CALL.question, page: null, raised_by: 'fix-direction', options: 2, lean_first: true }],
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

  it('Claude\'s lean set out on any row but the first is said not to be first; the fix direction set out while the root cause\'s validation runs, the investigation validates it', async () => {
    dispatched('root-cause-validation', ['F1']);
    await raised({ ...FIX_CALL, lean: '2' }, made.fix);
    atTheHunt();
    const { view } = board();

    assert.deepStrictEqual([view.waiting[0].lean_first, view.fix_direction.options.map((/** @type {{lean: boolean}} */ { lean }) => lean), view.standing], [false, [false, true], 'validating-root-cause']);
  });

  it('once picked, the fix is the fix direction\'s and never DECIDED, its question logged or not; the fix validation not yet sent, nothing validates; sent, it is what the investigation does', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    picked(await raised(FIX_CALL, made.fix), '2');
    atTheHunt();
    const unlogged = board().view;
    const unloggedFar = howFar();
    run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
    const before = board().view;
    const pages = ['1', '2'].map((key) => board(['--page', `option:${key}`]).view.state);
    const validation = dispatched('fix-validation', ['F1']);
    const after = board().view;

    assert.deepStrictEqual([unlogged.decided, before.fix_direction, before.standing, before.validations[1].state], [
      [],
      { state: 'picked', stepped_back: FIX_CALL.stepped_back, options: [{ key: '1', name: 'Harden the reads, outlast the shutdown', lean: true }, { key: '2', name: 'Read hardening alone', lean: false }], pick: '2', fix: 'Only stop reading a dying tmux as no sessions' },
      'investigating',
      'not-started',
    ]);
    assert.deepStrictEqual([after.standing, after.validations[1], after.decided], ['validating-fix', { validation: 'fix', effort: 'medium', state: 'running', since: validation.created, found: 0 }, []]);
    assert.deepStrictEqual([unloggedFar, pages], ['fix picked, not yet confirmed', ['option', 'picked']], 'All work reads the pick as the fix direction does; once picked, the lean is an option');
  });

  it('after a /clear, a second conversation reads the pick in the fix\'s words and what stepping back found from the log, the options unknown', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    picked(await raised(FIX_CALL, made.fix), '2');
    run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
    atTheHunt('sess-2');

    const { view } = board([], 'sess-2');

    assert.deepStrictEqual([view.fix_direction, view.decided], [{ state: 'picked', stepped_back: FIX_CALL.stepped_back, options: [], pick: null, fix: 'Only stop reading a dying tmux as no sessions' }, []]);
  });

  it('a validation lost with its conversation is lost, and nothing validates', () => {
    ok(dir, ['agent', 'dispatch', BUG, 'investigation', BUG, '--kind', 'root-cause-validation'], { env: { ...env(), CLAUDE_PID: '999999' } });
    atTheHunt();
    const { view } = board();

    assert.deepStrictEqual([view.validations[0].state, view.standing, tabRow().doing], ['lost', 'investigating', 'investigating']);
  });

  it('Claude\'s calls since the calls list was last drawn, read without looking (5.8.14), gone once it is drawn; the root cause, Claude\'s too, is its own section, never among them', () => {
    const asked = write('ask', [], { ...CLAUDE, text: 'Does restore keep reading no tmux as no sessions?' }).id;
    const call = write('decide', ['--answers', asked], { ...CLAUDE, text: 'Restore keeps reading it so; only saving stops trusting it', why: 'One failure at start would skip every session.' }).id;
    atTheHunt();
    const since = () => board().view.since.map((/** @type {{id: string, text: string}} */ { id, text }) => [full(id), text]);
    const unread = since();
    const again = since();
    run(['ledger', 'shown', BUG, BUG]);

    assert.deepStrictEqual([unread, again, since()], [
      [[full(call), 'Restore keeps reading it so; only saving stops trusting it']],
      [[full(call), 'Restore keeps reading it so; only saving stops trusting it']],
      [],
    ]);
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

describe('each decision where its chain stands now', () => {
  it('S1: the fix the fix validation changes waits as the fix direction, raised by it, its rows as its screen draws them, the keep row among them, the fix validation still read and the fix not yet confirmed; picked, the pick and the fix are the replacement\'s, the first pick only an option, and the fix is validated again', async () => {
    const { raise } = await fixReplaced();
    const waiting = board().view;
    const waitingFar = howFar();
    picked(raise, 'both');
    const { view } = board();
    const page = (/** @type {string} */ key) => board(['--page', `option:${key}`]).view.state;

    assert.deepStrictEqual([waiting.validations[1].state, waitingFar], ['running', 'fix picked, not yet confirmed']);
    assert.deepStrictEqual([waiting.standing, waiting.waiting.map((/** @type {{id: string}} */ wait) => byRaise(wait, raise)), waiting.fix_direction], [
      'validating-fix',
      [{ kind: 'raise', id: raise, text: REPLACE_CALL.question, page: null, raised_by: 'fix', options: 3, lean_first: true }],
      {
        state: 'asking',
        stepped_back: FIX_CALL.stepped_back,
        options: [{ key: 'both', name: 'Harden and outlast', lean: true }, { key: 'reads', name: 'Reads only, logged', lean: false }, { key: 'keep', name: 'Keep it as it stands', lean: false }],
        pick: null,
        fix: null,
      },
    ]);
    assert.deepStrictEqual([view.fix_direction.state, view.fix_direction.pick, view.fix_direction.fix, view.decided, view.validations[1].state, ['both', 'keep'].map(page)], [
      'picked', 'both', 'Harden the reads and make panes outlast the shutdown', [], 'not-started', ['picked', 'option'],
    ]);
    assert.deepStrictEqual(board(['--page', 'option:1']).view.kind, 'unavailable', 'the first raise\'s options no longer stand');
  });

  it('the replacement kept, the first pick stands as the pick, on its page too; a replacement of another decision, raised after a finding was surfaced as the fix\'s, says nothing of what raised it', async () => {
    const { raise } = await fixReplaced();
    await raisedOn({ ...REPLACE_CALL, question: 'Should a save trust only a list read twice?', rows: [{ key: 'twice', name: 'Read twice', text: 'Every save reads the session list twice', notice: 'saves take longer' }] , lean: 'twice' }, ['--replaces', made.rootCause, '--reason', 'changed-mind']);
    const raisers = raisedBy(board().view);
    picked(raise, 'keep');
    const { fix_direction: fix } = board().view;

    assert.deepStrictEqual(raisers, ['fix', null]);
    assert.deepStrictEqual([fix.state, fix.pick, fix.fix, fix.options.map((/** @type {{key: string}} */ { key }) => key)], ['picked', '1', FIX_CALL.rows[0].text, ['1', '2']]);
    assert.deepStrictEqual(['1', 'keep'].map((key) => board(['--page', `option:${key}`]).view.state ?? 'none'), ['picked', 'none']);
  });

  it('the fix replaced twice, a raise replacing it again is the fix direction\'s, down its question\'s chain', async () => {
    const { raise } = await fixReplaced();
    const second = picked(raise, 'both');
    const one = (/** @type {string} */ key, /** @type {string} */ text) => ({ ...REPLACE_CALL, question: `${text}?`, rows: [{ key, name: key, text, notice: `a save does ${key}` }], lean: key });
    const third = picked(await raisedOn(one('log', 'Harden the reads and log every drop'), ['--replaces', second, '--reason', 'changed-mind']), 'log');
    const fourth = await raisedOn(one('out', 'Make panes outlast the shutdown alone'), ['--replaces', third, '--reason', 'changed-mind']);
    const { view } = board();

    assert.deepStrictEqual([view.waiting.map((/** @type {{id: string}} */ wait) => byRaise(wait, fourth).raised_by), view.fix_direction.state], [['fix-direction'], 'asking']);
  });

  it('the root cause replaced shows the replacement before it is logged again, being validated again, the old body not beneath it; the hypothesis a replaced ruling made intended stays so, DECIDED the ruling as it stands', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    const ruling = picked(await raised(KEEP_CALL, made.keep), 'gone');
    run(['investigation-log', 'hypothesis', BUG, 'H1', '--state', 'intended', '--by', ruling]);
    const finding = found('The capture also drops sessions whose server is still starting.');
    write('replace', ['--replaces', made.rootCause, '--reason', 'was-wrong', '--cause', finding], { ...CLAUDE, drops: ['only a dying server'], text: 'Every save trusts a session list taken mid-change.', why: 'A starting server reads empty too.' });
    const ruled = write('replace', ['--replaces', ruling, '--reason', 'changed-mind'], { ...PERSON, who_moved_whom: 'person-moved-claude', drops: ['never'], text: 'A session you kill comes back only if you ask', why: 'Undo is cheap.' }).id;
    atTheHunt();
    const { view } = board();

    assert.deepStrictEqual([view.root_cause, view.validations[0].state, listsOf(view).hypotheses[0], view.decided.map((/** @type {{id: string, text: string}} */ { id, text }) => [full(id), text])], [
      { text: 'Every save trusts a session list taken mid-change.', validated: false },
      'not-started',
      'H1 intended',
      [[full(ruled), 'A session you kill comes back only if you ask']],
    ]);
    assert.strictEqual(board(['--page', 'hunt:root-cause']).view.text, 'Every save trusts a session list taken mid-change.', 'the body logged beneath the old root cause is not the new one\'s');
  });
});

describe('the investigation concluded, the unit\'s tab and All work (20.12.4, 20.15, 20.16)', () => {
  it('concluded: This session says the specification is next, the banner done, a raise left unanswered no longer waiting, nor what waits on the unit since; the tab dates the investigation by its close, its row counts the hypotheses and opens the investigation, concluded, holding none of it either', async () => {
    await raised(KEEP_CALL, made.keep);
    const manifest = readManifest(dir, BUG);
    manifest.phases.investigation.items[BUG] = { status: 'completed', concluded_at: '2026-08-20T15:00:00.000Z' };
    manifest.phases.specification = { items: { [BUG]: { status: 'in-progress' } } };
    writeState(dir, layout.manifest(BUG), JSON.stringify(manifest, null, 2));
    wrote('ask', `${BUG}.specification`, [], { ...CLAUDE, text: 'Does a save retry once?' });
    atTheHunt();
    const { view, banner } = board();
    const opened = board(['--tab', 'unit', '--page', 'phase:investigation']).view;

    assert.deepStrictEqual(board(['--tab', 'unit']).view.waiting.map((/** @type {{kind: string}} */ { kind }) => kind), ['gap'], 'the spec\'s gap waits on the unit');
    assert.deepStrictEqual(opened.waiting, []);
    assert.deepStrictEqual([view.standing, view.waiting, banner.state, banner.facts.at(-2).text], ['concluded', [], 'needs', 'concluded · the specification next']);
    assert.deepStrictEqual(tabRow(), { phase: 'investigation', state: 'complete', words: '3 hypotheses', doing: '', on: '2026-08-20T15:00:00.000Z', session: 'this', page: true });
    assert.deepStrictEqual([opened.kind, opened.standing], ['investigation', 'concluded']);
  });

  it('under way, the tab says it investigates until a validation runs, validates while one does, and holds the raise on its one list with what raised it', async () => {
    atTheHunt();
    const investigating = tabRow();
    const validation = dispatched('root-cause-validation', ['F1', 'F2']);
    const validating = tabRow();
    const raise = await raised(KEEP_CALL, made.keep);
    surfaced(validation.id, 'F1', ['--question', made.keep]);
    const { tab } = standingOn(board, BUG);
    const listed = board(['--tab', 'unit']).view.waiting;

    assert.deepStrictEqual([investigating.state, investigating.doing, validating.state, validating.doing], ['running', 'investigating', 'running', 'validating']);
    assert.deepStrictEqual({ ...tab, waiting: tab.waiting.map((/** @type {string} */ line) => line.split(' ')[0]) }, { now: 'investigation', state: 'waits', words: '3 hypotheses', waiting: ['raise'] });
    assert.deepStrictEqual(listed.map((/** @type {{id: string}} */ wait) => byRaise(wait, raise)), [{ kind: 'raise', id: raise, text: KEEP_CALL.question, page: null, raised_by: 'root-cause', options: null, lean_first: null }]);
  });

  it('20.15.1: the tab\'s LATELY holds the hunt\'s moments, each when its record dates it: each experiment by its name and title and the root cause written at the entries they rest on, the fix direction picked at the person\'s pick, the investigation concluded at its stamp; a hypothesis confirmed or ruled out, which nothing dates, is none', async () => {
    takenIn(dispatched('root-cause-validation', []).id);
    const fix = picked(await raised(FIX_CALL, made.fix), '1');
    run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
    const manifest = readManifest(dir, BUG);
    manifest.phases.investigation.items[BUG] = { status: 'completed', concluded_at: '2026-08-20T15:00:00.000Z' };
    writeState(dir, layout.manifest(BUG), JSON.stringify(manifest, null, 2));
    atTheHunt();
    const madeAt = (/** @type {string} */ id) => new Date(ledgerHelpers(() => dir).entries().find((entry) => entry.id === id).at).toISOString();
    const hunt = new Set(['experiment', 'root-cause', 'fix-picked', 'concluded']);
    const lately = board(['--tab', 'unit']).view.lately.filter((/** @type {{kind: string}} */ { kind }) => hunt.has(kind));

    assert.deepStrictEqual(new Set(lately.map((/** @type {object} */ moment) => JSON.stringify(moment))), new Set([
      { kind: 'concluded', at: '2026-08-20T15:00:00.000Z', topic: null, detail: null },
      { kind: 'fix-picked', at: madeAt(fix), topic: null, detail: null },
      { kind: 'root-cause', at: madeAt(full(made.rootCause)), topic: null, detail: null },
      { kind: 'experiment', at: madeAt(full(made.kill)), topic: null, detail: 'E1 Kill every session, hook on' },
    ].map((moment) => JSON.stringify(moment))));
  });

  it('All work says how far the hunt has come: the cause found, then confirmed, the fix picked, then confirmed; finding the cause while none is logged', async () => {
    atTheHunt();
    const found = howFar();
    takenIn(dispatched('root-cause-validation', []).id);
    const confirmed = howFar();
    picked(await raised(FIX_CALL, made.fix), '1');
    run(['investigation-log', 'fix-direction', BUG, '--question', made.fix]);
    const fixed = howFar();
    takenIn(dispatched('fix-validation', []).id);
    const fixConfirmed = howFar();
    writeState(dir, layout.topic(BUG, BUG, 'log.md'), '# Kill All\n');

    assert.deepStrictEqual([found, confirmed, fixed, fixConfirmed, howFar()], [
      'cause found, not yet confirmed', 'cause confirmed, the fix not yet picked', 'fix picked, not yet confirmed', 'fix confirmed', 'finding the cause',
    ]);
  });

  it('one board call folds the ledger once however many bugfixes in their investigation it draws', (t) => {
    atTheHunt();
    let opened = 0;
    const open = fs.openSync;
    t.mock.method(fs, 'openSync', (/** @type {any[]} */ ...args) => {
      if (String(args[0]).endsWith('.ledger.jsonl')) opened += 1;
      return open(...args);
    });
    const opens = () => {
      opened = 0;
      withEnv(env(), () => boardOf(dir, ['sess-1'], { tab: 'all' }));
      return opened;
    };
    const one = opens();
    for (const unit of ['detach-drops', 'reboot-drops']) {
      createManifest(dir, unit, { work_type: 'bugfix' });
      commitAll(dir, unit);
      ok(dir, ['enter', 'investigation', unit], { env: { CLAUDE_PID: undefined } });
    }

    assert.ok(one > 0, 'the call reads the ledger');
    assert.strictEqual(opens(), one);
  });

  it('a unit that is not a bugfix in its investigation has none of the hunt read, its log\'s headings like the hunt\'s never read as it', () => {
    createManifest(dir, 'notes', { work_type: 'feature' });
    writeState(dir, layout.topic('notes', 'notes', 'log.md'), '# Notes\n\n## Experiments\n\n- not one of the hunt\'s lines\n');
    commitAll(dir, 'a feature');
    atTheHunt();

    assert.deepStrictEqual(board(['--tab', 'all']).warnings.filter((/** @type {string} */ line) => line.includes('notes')), []);
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
      { kind: 'hunt', unit: BUG, item: 'root-cause', name: null, title: '', state: 'validated', text: `${ROOT_CAUSE}\n\nThe housekeeping pass deletes every file the index no longer names.` },
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
    const validation = dispatched('root-cause-validation', ['F1', 'F2']);
    await raised(KEEP_CALL, made.keep);
    surfaced(validation.id, 'F1', ['--question', made.keep]);
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
