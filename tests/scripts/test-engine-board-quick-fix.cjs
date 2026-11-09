'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14): This session in its one session — the
// change its note pins, each fix as the build draws a task with its pair's
// rounds, Claude's calls and the earlier decision the change replaces;
// what waits on the person — a fix's builder's question, Claude's raise and
// the close — on the view and the banner; the record once the fixes are
// done; the session followed to All work once it closes; and every phase a
// session can be in drawing a view of its own (27.S8).
//
// Layer: verb. Worlds (quick-fix-world.cjs), each copied for each test:
// `typo` made from its inbox note, entered by a conversation gone since,
// fixes 1.1 and 1.2 written and 1.1 started, a call of Claude's made in it
// and a person's decision of the completed `restore` replaced there; and
// `typo` with fix 1.1 built, recorded and finish's checklist closed. The
// conversation's records sit in a config folder of each test's own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, okSectionsAsync, writeState, statePath, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder, withEnv } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, DESCRIPTION, FLAG, HELP, SET, quickFix, createFix, fixBuilt, fixesRecorded, asGone, entered } = require('./quick-fix-world.cjs');
const { fixture, misfits, emptyLists, place } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { phaseViewOf } = require(path.join(SCRIPTS, 'domain/board.cjs'));
const { storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { roundReportPath, recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { WORK_TYPE_PIPELINES, EPIC_PHASES } = require(path.join(SCRIPTS, 'kernel/manifest-schema.cjs'));

const SESSION = 'sess-qf';
const EARLIER = 'restore';
const RULED = 'm enters a real mode you can sit in with zero selected';
const CALL_TEXT = 'The README says entering marks the highlighted row';
const NONE_CHANGED = 'Close: what was proven; you changed none of Claude\'s calls, so there is no verdict to give';

/** Claude's raise in the quick-fix's conversation, as the raise suites make one. */
const CALL = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

/** The entries the world made, by short id. */
const made = { call: '', ruled: '' };

const working = fixtureFrom('engine-board-quick-fix-', (dir) => {
  quickFix(dir);
  createManifest(dir, EARLIER, { phases: { discussion: { items: { [EARLIER]: { status: 'in-progress' } } } } });
  const { ask, decide } = ledgerReadHelpers(() => dir);
  const at = `${EARLIER}.discussion.${EARLIER}`;
  made.ruled = decide(at, ask(at, 'Does m enter a real mode?'), RULED, [], { by: 'person' });
  createManifest(dir, EARLIER, { status: 'completed', phases: { discussion: { items: { [EARLIER]: { status: 'completed' } } } } });
  asGone((as) => {
    entered(dir, as);
    createFix(dir, 1, FLAG, as);
    createFix(dir, 2, HELP, as);
    ok(dir, ['task', 'start', UNIT, '1.1'], as);
    made.call = decide(PLACE, ask(PLACE, 'What does the README say entering does?'), CALL_TEXT);
    ok(dir, ['ledger', 'replace', PLACE, '--replaces', made.ruled, '--reason', 'changed-mind'], {
      ...as, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Pressing m marks the highlighted row.', why: 'The note pins it.', drops: ['the empty set'] }),
    });
  });
});

const closable = fixtureFrom('engine-board-quick-fix-close-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    entered(dir, as);
    fixBuilt(dir, 1, SET[0].title, SET[0].file, SET[0].text, as);
    fixesRecorded(dir, 1, as);
  });
});

let dir = ''; // the project
const config = useTempFolder('engine-board-quick-fix-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** The engine as this test's conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: SESSION, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** A verb run in the conversation. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** The board's answer, its `ok` dropped. @param {string[]} [args] */
function board(args = []) {
  const { ok: _ok, ...answer } = run(['board', SESSION, ...args]);
  return answer;
}

/** The conversation at the quick-fix's one session. */
const atTheFixes = () => run(['session', 'label', UNIT, 'implementation', UNIT]);

/** A brief the conversation issued for a fix, by its role, at `at`. @param {string} role @param {string} task @param {string} at */
function issued(role, task, at) {
  const id = `${role}${task.replace('.', '')}${Date.parse(at)}`;
  withEnv({ LEEWAY_CONFIG_DIR: config() }, () => {
    storeBrief(SESSION, id, 'a brief', { role, agent: 'leeway-builder', unit: UNIT, task, topic: null });
    fs.utimesSync(issuedPath(SESSION, id), new Date(at), new Date(at));
  });
}

/** A round of a fix's review reported by both its reviewers, passing or not. @param {string} task @param {number} round @param {boolean} passes */
function reported(task, round, passes) {
  const ref = { unit: UNIT, phase: 1, n: Number(task.split('.')[1]) };
  const text = passes ? '## Findings\n\nNone.\n\nVerdict: pass\n' : '## Findings\n\n- serious: the flag still reads --color\n  Scenario: a script passes --colour.\n\nVerdict: fail\n';
  for (const letter of ['a', 'b']) writeState(dir, roundReportPath(ref, round, letter), text);
}

/** A round of a fix's review briefed in this conversation, its reports not yet in. @param {string} task @param {number} round */
function briefedRound(task, round) {
  const ref = { unit: UNIT, phase: 1, n: Number(task.split('.')[1]) };
  for (const letter of ['a', 'b']) recordReviewer(dir, ref, round, letter, SESSION);
}

/**
 * A question a fix's builder parks its task on (19.5.25). `raise` refuses
 * `--parks` at a quick-fix today (15.6's E5), so the park is made as the
 * build makes one, the unit read as a build for the raise alone.
 * @param {string} task @param {string} question
 */
async function parkedOn(task, question) {
  const file = statePath(dir, UNIT, 'manifest.json');
  const held = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(held), work_type: 'feature', build: { position: 'auto' } }));
  try {
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked, '--parks', task], { env: env(), stdin: JSON.stringify({ ...CALL, question }) });
  } finally {
    fs.writeFileSync(file, held);
  }
}

/** A fix's line as the view holds it. @param {string} task @param {string} title @param {string} state @param {{since?: string|null, on?: string[], rounds?: object}} [more] */
const fix = (task, title, state, { since = null, on = [], rounds = { sent_back: 0, reading: null, passed: null } } = {}) => ({ task, title, state, since, on, rounds });

describe('a quick-fix on the board (20.14)', () => {
  it('20.S23: This session shows the change its note pins, each fix as the build draws a task — the one under way in review with its clock and its pair\'s rounds — Claude\'s calls and the earlier decision it replaces; the banner counts the fixes done (20.2.4)', () => {
    dir = working();
    atTheFixes();
    reported('1.1', 1, false);
    issued('reviewer', '1.1', '2026-07-15T10:20:00.000Z');
    briefedRound('1.1', 2);
    const answer = board();

    assert.deepStrictEqual(answer.banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }] });
    assert.deepStrictEqual({ ...answer.view, project: null, started: null }, {
      kind: 'quick-fix',
      unit: UNIT,
      title: 'Typo',
      type: 'quick-fix',
      project: null,
      started: null,
      from: 'inbox',
      change: DESCRIPTION,
      standing: 'working',
      stopped: false,
      progress: { done: 0, total: 2 },
      waiting: [],
      fixes: [
        fix('1.1', FLAG, 'in-review', { since: '2026-07-15T10:20:00.000Z', rounds: { sent_back: 1, reading: 2, passed: null } }),
        fix('1.2', HELP, 'not-started'),
      ],
      calls: [{ id: made.call, text: CALL_TEXT }],
      replaces: [{ id: made.ruled, text: RULED, by: 'person', unit: EARLIER, unit_title: 'Restore' }],
      record: null,
    });
    assert.deepStrictEqual([answer.version, answer.place.phase, answer.questions], [BOARD_VERSION, 'implementation', []]);
  });

  it('20.S23: a fix\'s builder parks its task on a question while another goes on — WAITING ON YOU holds it, a press queueing it, the parked fix waits on Q1, and the banner keeps running, counting it; once every fix left is parked it has stopped, flagged (19.5.25, 20.2.4)', async () => {
    dir = working();
    atTheFixes();
    run(['task', 'start', UNIT, '1.2']);
    await parkedOn('1.2', 'Should the help name both spellings?');
    const goingOn = board();
    await parkedOn('1.1', 'Should the flag keep --color?');
    const stopped = board();

    assert.deepStrictEqual([goingOn.view.waiting, goingOn.questions.map(({ question, parks }) => [question, parks])], [
      [{ kind: 'question', id: 'Q1', text: 'Q1 Should the help name both spellings?', page: 'task:1.2' }],
      [['Q1', [{ task: '1.2', title: HELP }]]],
    ]);
    assert.deepStrictEqual([goingOn.view.fixes[1], goingOn.view.stopped], [fix('1.2', HELP, 'waits', { on: ['Q1'] }), false]);
    assert.deepStrictEqual(goingOn.banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([stopped.view.stopped, stopped.banner], [true, { name: 'Typo', state: 'needs', facts: [place('quick-fix'), place('stopped'), { text: '0 of 2 done', needs: false }, { text: '2 waiting on you', needs: true }] }]);
  });

  it('a question Claude raised in the quick-fix\'s conversation waits asked there, parking nothing — counted on the banner, which keeps running (19.5.25)', async () => {
    dir = working();
    atTheFixes();
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, CALL.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: env(), stdin: JSON.stringify(CALL) });
    const { view, banner, questions } = board();

    assert.deepStrictEqual([view.waiting.map(({ kind, text, page }) => ({ kind, text, page })), questions, view.stopped], [[{ kind: 'raised', text: CALL.question, page: null }], [], false]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
  });

  it('its tab\'s row runs once its fixes have begun, counting them done of all and reading building, and All work says how far it has come (20.15.2, 20.15.3, 20.16.1)', () => {
    dir = working();
    atTheFixes();
    const row = board(['--tab', 'unit']).view.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'implementation');
    const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);

    assert.deepStrictEqual([row.state, row.words, row.doing, line.standing], ['running', '0 of 2 done', 'building', '0 of 2 done']);
  });

  it('while its close waits: what was proven and that no verdict is owed, flagged on the banner; each fix done with the round its pair passed it in; its record from summary.md (20.14.1, 16.10.4, 19.5.17)', () => {
    dir = closable();
    atTheFixes();
    reported('1.1', 1, false);
    reported('1.1', 2, true);
    const { view, banner } = board();
    const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);

    assert.deepStrictEqual([view.standing, view.stopped, view.progress, view.waiting], ['close', false, { done: 1, total: 1 }, [{ kind: 'finish', id: 'close', text: NONE_CHANGED, page: null }]]);
    assert.deepStrictEqual(view.fixes, [fix('1.1', FLAG, 'done', { rounds: { sent_back: 1, reading: null, passed: 2 } })]);
    assert.deepStrictEqual(view.record, [{ title: FLAG, changed: 'The flag parser reads --colour.', why: 'The flag was spelt the American way.', leaves: 'Old scripts passing --color.' }]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'needs', facts: [place('quick-fix'), { text: '1 of 1 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.strictEqual(line.standing, 'close waits on you');
  });

  it('16.10.4: the close says a verdict is owed on a call the person changed in it', () => {
    dir = closable();
    atTheFixes();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(PLACE, ask(PLACE, 'Does --color still work?'), 'It stays as an alias.');
    ok(dir, ['ledger', 'replace', PLACE, '--replaces', call, '--reason', 'changed-mind'], {
      env: env(), stdin: JSON.stringify({ by: 'person', text: 'It is dropped.', why: 'The person wants it so.', drops: ['the alias'] }),
    });

    assert.deepStrictEqual(board().view.waiting, [{ kind: 'finish', id: 'close', text: 'Close: what was proven; you changed 1 call of Claude\'s, so there is a verdict to give', page: null }]);
  });

  it('20.14.2: once closed, This session follows the session to All work at the start menu, the banner its close', () => {
    dir = closable();
    atTheFixes();
    run(['finish', 'yes', UNIT]);
    const { view, banner } = board();

    assert.deepStrictEqual([view.kind, view.complete.map(({ unit }) => unit)], ['all', [UNIT]]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'done', facts: [{ text: 'quick-fix', needs: false }, { text: 'complete', needs: false }, place('at the start menu')] });
  });

  it('the mod\'s quick-fix fixture holds the shape the engine answers, its parked and its closing states between them holding every list', async () => {
    dir = working();
    atTheFixes();
    run(['task', 'start', UNIT, '1.2']);
    await parkedOn('1.2', 'Should the help name both spellings?');
    const parked = board().view;
    cleanupFixture(dir);
    dir = closable();
    atTheFixes();
    const closing = board().view;
    const held = await fixture('board-quick-fix.mjs');

    assert.deepStrictEqual([misfits(held, parked), misfits(held, closing)], [[], []]);
    assert.deepStrictEqual(emptyLists([parked, closing]), [], 'every list the shape is held to holds an entry');
  });
});

describe('27.S8: every phase a session can be in draws a view of its own', () => {
  /** Today's scoping, which the reshape retires (15.14), and which no view draws. */
  const RETIRING = new Set(['scoping']);
  const places = Object.entries(WORK_TYPE_PIPELINES).flatMap(([type, pipeline]) => (type === 'epic' ? EPIC_PHASES : pipeline).filter((phase) => !RETIRING.has(phase)).map((phase) => [type, phase]));

  it('This session draws each type\'s every phase by a view of that phase, a quick-fix\'s one session by its own (27.2.9)', () => {
    const unviewed = places.filter(([type, phase]) => phaseViewOf(type, phase) === null);

    assert.deepStrictEqual(unviewed, []);
    assert.notStrictEqual(phaseViewOf('quick-fix', 'implementation'), phaseViewOf('feature', 'implementation'));
  });
});
