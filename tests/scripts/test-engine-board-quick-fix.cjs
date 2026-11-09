'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14), its fixes: This session in its one session —
// the change its note pins, each fix as the build draws a task with its
// pair's rounds, Claude's calls and the earlier decision the change
// replaces; a fix's builder's question parking it, and the fixes stopped;
// its tab's row and All work; a fix's page; and every phase a session can
// be in drawing a view of its own (27.S8). What waits on the person and the
// close: -waits.cjs; the record and where it came from: -record.cjs.
//
// Layer: verb. The world `working` (quick-fix-board-world.cjs), copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { writeState, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, DESCRIPTION, FLAG, HELP } = require('./quick-fix-world.cjs');
const { place } = require('./board-world.cjs');
const { EARLIER, RULED, CALL_TEXT, made, working, fix, quickFixBoard } = require('./quick-fix-board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { phaseViewOf } = require(path.join(SCRIPTS, 'domain/board.cjs'));
const { roundReportPath, settlementPath } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { WORK_TYPE_PIPELINES, EPIC_PHASES } = require(path.join(SCRIPTS, 'kernel/manifest-schema.cjs'));

let dir = ''; // the project
const { run, board, refOf, atTheFixes, issued, reported, briefedRound, parkedOn, rows, replaced } = quickFixBoard(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('a quick-fix\'s fixes on the board (20.14)', () => {
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

  it('its tab\'s row runs once its fixes have begun, counting them done of all and reading building, and All work says how far it has come (20.15.2, 20.15.3, 20.16.1)', () => {
    dir = working();
    atTheFixes();
    const { row, line } = rows();

    assert.deepStrictEqual([row.state, row.words, row.doing, line.standing], ['running', '0 of 2 done', 'building', '0 of 2 done']);
  });

  it('a fix\'s rounds are those reported whole — a round with one report in is the one being read — and a review the orchestrator settled says so', () => {
    dir = working();
    atTheFixes();
    reported('1.1', 1, false);
    briefedRound('1.1', 2);
    writeState(dir, roundReportPath(refOf('1.1'), 2, 'a'), '## Findings\n\nNone.\n\nVerdict: pass\n');
    const half = board();
    writeState(dir, settlementPath(refOf('1.1'), 1), '# Settled\n');

    assert.deepStrictEqual([half.view.fixes[0].rounds, half.warnings], [{ sent_back: 1, reading: 2, passed: null, settled: false }, []]);
    assert.deepStrictEqual(board().view.fixes[0].rounds, { sent_back: 0, reading: 2, passed: 1, settled: true });
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
