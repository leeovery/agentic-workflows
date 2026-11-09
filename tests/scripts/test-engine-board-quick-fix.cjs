'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14): This session in its one session — the
// change its note pins, each fix as the build draws a task with its pair's
// rounds, Claude's calls and the earlier decision the change replaces;
// what waits on the person — a fix's builder's question, Claude's raise and
// the close — on the view and the banner; the record once the fixes are
// done; before the first fix is written; the session followed to All work
// once it closes; and every phase a session can be in drawing a view of its
// own (27.S8).
//
// Layer: verb. Worlds (quick-fix-world.cjs), each copied for each test,
// `typo` entered by a conversation gone since: made from its inbox note,
// fixes 1.1 and 1.2 written and 1.1 started, a call of Claude's made in it
// and a person's decision of the completed `restore` replaced there by
// Claude; fix 1.1 built, recorded and finish's checklist closed; fix 1.1
// built and recorded, 1.2 written; fixes 1.1 and 1.2 built, recorded and
// the checklist closed; and made from no note, no fix written. The
// conversation's records sit in a config folder of each test's own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, okSectionsAsync, writeState, statePath, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder, withEnv } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, DESCRIPTION, FLAG, HELP, SET, RECORDS, quickFix, createFix, fixBuilt, recordFile, twoFixesBuilt, fixesRecorded, asGone, entered } = require('./quick-fix-world.cjs');
const { fixture, misfits, emptyLists, place } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { phaseViewOf } = require(path.join(SCRIPTS, 'domain/board.cjs'));
const { storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { roundReportPath, settlementPath, recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { ROADMAP_SEED } = require(path.join(SCRIPTS, 'domain/inbox.cjs'));
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

/** The entries the world made, by short id: Claude's call, the earlier unit's decision, and Claude's replacing it. */
const made = { call: '', ruled: '', replacing: '' };

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
    made.replacing = ok(dir, ['ledger', 'replace', PLACE, '--replaces', made.ruled, '--reason', 'changed-mind'], {
      ...as, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Pressing m marks the highlighted row.', why: 'The note pins it.', drops: ['the empty set'] }),
    }).id;
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

const oneBuilt = fixtureFrom('engine-board-quick-fix-one-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    entered(dir, as);
    fixBuilt(dir, 1, SET[0].title, SET[0].file, SET[0].text, as);
    ok(dir, ['quick-fix', 'record', UNIT, '1.1', '--file', recordFile(dir, 1, RECORDS[1])], as);
    createFix(dir, 2, HELP, as);
  });
});

const bothRecorded = fixtureFrom('engine-board-quick-fix-both-', (dir) => {
  twoFixesBuilt(dir);
  asGone((as) => fixesRecorded(dir, 2, as));
});

const unwritten = fixtureFrom('engine-board-quick-fix-unwritten-', (dir) => {
  quickFix(dir, { seeded: false });
  asGone((as) => entered(dir, as));
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
const fix = (task, title, state, { since = null, on = [], rounds = {} } = {}) => ({ task, title, state, since, on, rounds: { sent_back: 0, reading: null, passed: null, settled: false, ...rounds } });

/** Its row in the unit's tab and its line in All work. */
function rows() {
  const row = board(['--tab', 'unit']).view.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'implementation');
  const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);
  return { row, line };
}

/** A decision `by` makes at the quick-fix replacing `old`: its short id. @param {string} old @param {'person'|'claude'} by @param {string} text */
const replaced = (old, by, text) => ledgerReadHelpers(() => dir).write('replace', PLACE, ['--replaces', old, '--reason', 'changed-mind'], { by, ...(by === 'claude' ? { who_moved_whom: 'none' } : {}), text, why: `Why: ${text}`, drops: ['the old wording'] }, env()).id;

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
      progress: { done: 0, total: 2, written: true },
      waiting: [],
      fixes: [
        fix('1.1', FLAG, 'in-review', { since: '2026-07-15T10:20:00.000Z', rounds: { sent_back: 1, reading: 2 } }),
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
    const { line } = rows();

    assert.deepStrictEqual([goingOn.view.waiting, goingOn.questions.map(({ question, parks }) => [question, parks])], [
      [{ kind: 'question', id: 'Q1', text: 'Q1 Should the help name both spellings?', page: 'task:1.2' }],
      [['Q1', [{ task: '1.2', title: HELP }]]],
    ]);
    assert.deepStrictEqual([goingOn.view.fixes[1], goingOn.view.stopped], [fix('1.2', HELP, 'waits', { on: ['Q1'] }), false]);
    assert.deepStrictEqual(goingOn.banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([stopped.view.stopped, stopped.banner, line.standing], [true, { name: 'Typo', state: 'needs', facts: [place('quick-fix'), place('stopped'), { text: '0 of 2 done', needs: false }, { text: '2 waiting on you', needs: true }] }, 'stopped · 0 of 2 done']);
  });

  it('a question Claude raised in the quick-fix\'s conversation waits asked there, parking nothing — counted on the banner, which keeps running (19.5.25)', async () => {
    dir = working();
    atTheFixes();
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, CALL.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: env(), stdin: JSON.stringify(CALL) });
    const { view, banner, questions } = board();
    ledgerReadHelpers(() => dir).decide(PLACE, asked, 'Keep --color as an alias');
    const answered = board();

    assert.deepStrictEqual([view.waiting.map(({ kind, text, page }) => ({ kind, text, page })), questions, view.stopped], [[{ kind: 'raised', text: CALL.question, page: null }], [], false]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([answered.view.waiting, answered.banner.facts], [[], [place('quick-fix'), { text: '0 of 2 done', needs: false }]]);
  });

  it('its tab\'s row runs once its fixes have begun, counting them done of all and reading building, and All work says how far it has come (20.15.2, 20.15.3, 20.16.1)', () => {
    dir = working();
    atTheFixes();
    const { row, line } = rows();

    assert.deepStrictEqual([row.state, row.words, row.doing, line.standing], ['running', '0 of 2 done', 'building', '0 of 2 done']);
  });

  it('while its close waits: what was proven and that no verdict is owed, flagged on the banner; each fix done with the round its pair passed it in; its record from summary.md (20.14.1, 16.10.4, 19.5.17)', () => {
    dir = closable();
    atTheFixes();
    reported('1.1', 1, false);
    reported('1.1', 2, true);
    const { view, banner } = board();
    const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);

    assert.deepStrictEqual([view.standing, view.stopped, view.progress, view.waiting], ['close', false, { done: 1, total: 1, written: true }, [{ kind: 'finish', id: 'close', text: NONE_CHANGED, page: null }]]);
    assert.deepStrictEqual(view.fixes, [fix('1.1', FLAG, 'done', { rounds: { sent_back: 1, passed: 2 } })]);
    assert.deepStrictEqual(view.record, [{ title: FLAG, changed: 'The flag parser reads --colour.', why: 'The flag was spelt the American way.', leaves: 'Old scripts passing --color.' }]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'needs', facts: [place('quick-fix'), { text: '1 of 1 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.strictEqual(line.standing, 'close waits on you');
  });

  it('16.10.4: the close says a verdict is owed on a call the person changed in it, and once given, that each is', () => {
    dir = closable();
    atTheFixes();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    replaced(decide(PLACE, ask(PLACE, 'Does --color still work?'), 'It stays as an alias.'), 'person', 'It is dropped.');
    const owed = board().view.waiting;
    output(dir, ['render', 'finish', UNIT], { env: env() });
    run(run(['gate', 'verdict', '--pick', 'n']).next.argv);

    assert.deepStrictEqual([owed, board().view.waiting.map(({ text }) => text)], [
      [{ kind: 'finish', id: 'close', text: 'Close: what was proven; you changed 1 call of Claude\'s, so there is a verdict to give', page: null }],
      ['Close: what was proven; you changed 1 call of Claude\'s and gave each its verdict'],
    ]);
  });

  it('a fix\'s rounds are those reported whole — a round with one report in is the one being read — and a review the orchestrator settled says so', () => {
    dir = working();
    atTheFixes();
    reported('1.1', 1, false);
    briefedRound('1.1', 2);
    writeState(dir, roundReportPath({ unit: UNIT, phase: 1, n: 1 }, 2, 'a'), '## Findings\n\nNone.\n\nVerdict: pass\n');
    const half = board();
    cleanupFixture(dir);
    dir = closable();
    atTheFixes();
    reported('1.1', 1, false);
    writeState(dir, settlementPath({ unit: UNIT, phase: 1, n: 1 }, 1), '# Settled\n');

    assert.deepStrictEqual([half.view.fixes[0].rounds, half.warnings], [{ sent_back: 1, reading: 2, passed: null, settled: false }, []]);
    assert.deepStrictEqual(board().view.fixes[0].rounds, { sent_back: 0, reading: null, passed: 1, settled: true });
  });

  it('REPLACES reaches past the quick-fix\'s own replacements to the decision of another unit its chain goes back to, whose it was read from that decision — the person replacing Claude\'s call there, Claude replacing its own; the person\'s decisions never among Claude\'s calls', () => {
    dir = working();
    atTheFixes();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    createManifest(dir, 'palette', { phases: { discussion: { items: { palette: { status: 'in-progress' } } } } });
    const at = 'palette.discussion.palette';
    const claudes = decide(at, ask(at, 'Which palette?'), 'The palette is warm.');
    replaced(replaced(claudes, 'claude', 'The palette is cool.'), 'claude', 'The palette is grey.');
    decide(PLACE, ask(PLACE, 'Is --colour the only spelling?'), 'It is the only one.', [], { by: 'person' });
    replaced(made.replacing, 'person', 'Pressing m marks the row and selects it.');
    const { calls, replaces } = board().view;

    assert.deepStrictEqual([calls, replaces], [
      [{ id: made.call, text: CALL_TEXT }],
      [
        { id: claudes, text: 'The palette is warm.', by: 'claude', unit: 'palette', unit_title: 'Palette' },
        { id: made.ruled, text: RULED, by: 'person', unit: EARLIER, unit_title: 'Restore' },
      ],
    ]);
  });

  it('the fix\'s page names its phase the fixes', () => {
    dir = working();
    atTheFixes();

    assert.strictEqual(board(['--page', 'task:1.1']).view.phase_name, 'the fixes');
  });

  it('its record waits until every fix has ended; a fix closed without being done counts in neither its done nor its total, and with no fix left nothing has stopped (20.14.1, 20.2.4)', () => {
    dir = oneBuilt();
    atTheFixes();
    const open = board().view;
    run(['task', 'close', UNIT, '1.2', '--reason', 'Folded into 1.1.']);
    const { view, banner } = board();

    assert.deepStrictEqual([open.record, open.progress], [null, { done: 1, total: 2, written: true }]);
    assert.deepStrictEqual([view.standing, view.stopped, view.progress, view.record], ['working', false, { done: 1, total: 1, written: true }, [{ title: FLAG, ...RECORDS[1] }]]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '1 of 1 done', needs: false }] });
  });

  it('its record holds each fix\'s by its title, every line of an item kept (19.5.17)', () => {
    dir = bothRecorded();
    atTheFixes();

    assert.deepStrictEqual(board().view.record, [{ title: FLAG, ...RECORDS[1] }, { title: HELP, ...RECORDS[2] }]);
  });

  it('a quick-fix made from no note says nothing of where it came from, one from the roadmap says so; before its first fix is written its banner, tab and All work say so', () => {
    dir = unwritten();
    atTheFixes();
    const { view, banner } = board();
    const { row, line } = rows();
    cleanupFixture(dir);
    dir = working();
    atTheFixes();
    const file = statePath(dir, UNIT, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    // As start this work seeds a unit from a roadmap item's note (workunit-create.cjs).
    fs.writeFileSync(file, JSON.stringify({ ...manifest, seeds: manifest.seeds.map((/** @type {object} */ seed) => ({ ...seed, source: `${ROADMAP_SEED}colour-flag` })) }));

    assert.deepStrictEqual([view.from, view.progress, view.fixes], [null, { done: 0, total: 0, written: false }, []]);
    assert.deepStrictEqual([banner.facts, row.words, line.standing], [[place('quick-fix'), { text: 'no fix written yet', needs: false }], 'no fix written yet', 'no fix written yet']);
    assert.strictEqual(board().view.from, 'roadmap');
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
