'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14), its fixes: This session in its one session —
// the change its note pins, each fix as the build draws a task with its
// pair's rounds, Claude's calls and the earlier decision the change
// replaces, whose it was as it stood decided; a fix's builder's question
// parking it, a fix its blind question holds open, and the fixes stopped;
// its tab's row and All work; a fix's page, its reviews and its scenarios'
// pages; and every phase a session can be in drawing a view of its own
// (27.S8). What waits on the person and the close: -waits.cjs; the record
// and where it came from: -record.cjs; its review: -review.cjs.
//
// Layer: verb. The world `working` (quick-fix-board-world.cjs), copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { writeState, cleanupFixture, layout, git, FROZEN_AT, statePath } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers, ledgerHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, DESCRIPTION, FLAG, HELP, BRANCH } = require('./quick-fix-world.cjs');
const { place } = require('./board-world.cjs');
const { SESSION, RULED, CALL_TEXT, CALL, made, working, fix, quickFixBoard } = require('./quick-fix-board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BOARD_VERSION } = require(path.join(SCRIPTS, 'domain/board-model.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
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
      progress: { done: 0, total: 2, written: true },
      waiting: [],
      fixes: [
        fix('1.1', FLAG, 'in-review', { since: '2026-07-15T10:20:00.000Z', rounds: { sent_back: 1, reading: 2 } }),
        fix('1.2', HELP, 'not-started'),
      ],
      calls: [{ id: made.call, text: CALL_TEXT }],
      replaces: [{ id: made.ruled, text: RULED, by: 'person', unit_title: 'Restore' }],
      record: null,
    });
    assert.deepStrictEqual([answer.version, answer.place.phase, answer.questions], [BOARD_VERSION, 'implementation', []]);
  });

  it('20.S23: a fix\'s builder parks its task on a question while the next goes on — WAITING ON YOU holds it, a press queueing it, the parked fix waits on Q1, and the banner keeps running, counting it; once every fix left is parked it has stopped, flagged (19.5.25, 20.2.4)', async () => {
    dir = working();
    atTheFixes();
    await parkedOn('1.1', 'Should the flag keep --color?');
    run(['task', 'start', UNIT, '1.2']);
    const goingOn = board();
    await parkedOn('1.2', 'Should the help name both spellings?');
    const stopped = board();
    const { row, line } = rows();

    assert.deepStrictEqual([goingOn.view.waiting, goingOn.questions.map(({ question, parks }) => [question, parks])], [
      [{ kind: 'question', id: 'Q1', text: 'Q1 Should the flag keep --color?', page: 'task:1.1' }],
      [['Q1', [{ task: '1.1', title: FLAG }]]],
    ]);
    assert.deepStrictEqual(goingOn.view.fixes[0], fix('1.1', FLAG, 'waits', { on: ['Q1'] }));
    assert.deepStrictEqual(goingOn.banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([stopped.banner, row.state, line.standing], [{ name: 'Typo', state: 'needs', facts: [place('quick-fix'), place('stopped'), { text: '0 of 2 done', needs: false }, { text: '2 waiting on you', needs: true }] }, 'stopped', 'stopped · 0 of 2 done']);
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
    replaced(replaced(replaced(claudes, 'claude', 'The palette is cool.'), 'claude', 'The palette is grey.'), 'claude', 'The palette is slate.');
    decide(PLACE, ask(PLACE, 'Is --colour the only spelling?'), 'It is the only one.', [], { by: 'person' });
    replaced(made.replacing, 'person', 'Pressing m marks the row and selects it.');
    const { calls, replaces } = board().view;

    assert.deepStrictEqual([calls, replaces], [
      [{ id: made.call, text: CALL_TEXT }],
      [
        { id: claudes, text: 'The palette is warm.', by: 'claude', unit_title: 'Palette' },
        { id: made.ruled, text: RULED, by: 'person', unit_title: 'Restore' },
      ],
    ]);
  });

  it('REPLACES reads whose the decision was as it stood decided: Claude\'s call in another unit the person kept is theirs', () => {
    dir = working();
    atTheFixes();
    const { ask, decide, full } = ledgerReadHelpers(() => dir);
    createManifest(dir, 'palette', { phases: { discussion: { items: { palette: { status: 'in-progress' } } } } });
    const at = 'palette.discussion.palette';
    const claudes = decide(at, ask(at, 'Which palette?'), 'The palette is warm.');
    appendEntry(statePath(dir), {
      event: 'kept', unit: 'palette', topic: 'palette', phase: 'discussion', session: SESSION,
      by: 'person', who_moved_whom: 'none', entry: full(claudes), reason: 'was-wrong', cause: null, why: 'Warm suits it.', sealed: 'The palette is cool.', given: 'own',
    }, []);
    replaced(claudes, 'claude', 'The palette is slate.');

    assert.deepStrictEqual(board().view.replaces.find((/** @type {{id: string}} */ row) => row.id === claudes), { id: claudes, text: 'The palette is warm.', by: 'person', unit_title: 'Palette' });
  });

  /**
   * A question parked on Claude's call in the quick-fix, proposing to
   * replace it, as `how` has it.
   * @param {{reason: string, task: string|null, went_ahead: string|null, blind: boolean}} how
   */
  const parkedOnTheCall = (how) => appendEntry(statePath(dir), {
    event: 'parked', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    question: null, replaces: ledgerHelpers(() => dir).full(made.call), cause: null, relies_on: [], number: 1,
    call: { ...CALL, question: 'What does the README say entering does?' }, rows_judged: [], why_asking: 'Asked cold.', label: null, model: null, blocks_build: true, replaced_by: null, always: null,
    measured: null, chain: ledgerHelpers(() => dir).full(made.asked), ...how,
  }, []);

  it('16.17.2: a call of Claude\'s a blind question waits on, gone ahead for its fix, is held back from Claude\'s calls while the question waits', () => {
    dir = working();
    atTheFixes();
    parkedOnTheCall({ reason: 'asked-blind', task: null, went_ahead: '1.1', blind: true });

    assert.deepStrictEqual(board().view.calls, []);
  });

  it('16.17.6: a fix whose blind question\'s call went ahead for it waits on that question once its pair has passed it, held open, never before', () => {
    dir = working();
    atTheFixes();
    parkedOnTheCall({ reason: 'asked-blind', task: null, went_ahead: '1.1', blind: true });
    const reading = board().view.fixes[0].state;
    reported('1.1', 1, true);
    const held = board();

    assert.deepStrictEqual([reading, held.view.fixes[0], held.questions.map(({ question, parks }) => [question, parks])], [
      'building', fix('1.1', FLAG, 'waits', { on: ['Q1'], rounds: { passed: 1 } }), [['Q1', [{ task: '1.1', title: FLAG }]]],
    ]);
  });

  /** The person's keep of Claude's call in the quick-fix, given `given`, as a blind question's answer lands it. @param {'own'|'dont-care'} given */
  const keptBy = (given) => appendEntry(statePath(dir), {
    event: 'kept', unit: UNIT, topic: null, phase: 'implementation', session: SESSION,
    by: 'person', who_moved_whom: 'none', entry: ledgerHelpers(() => dir).full(made.call), reason: 'asked-blind', cause: null, why: 'It reads plainer.', sealed: CALL_TEXT, given,
  }, []);

  it('16.5.7, 9.2.16: a call of Claude\'s the person\'s "don\'t care" kept stays Claude\'s, handed over, among Claude\'s calls; once they keep it by their pick or own words it is theirs, never among them', () => {
    dir = working();
    atTheFixes();
    keptBy('dont-care');
    const handed = board().view.calls;

    keptBy('own');

    assert.deepStrictEqual([handed, board().view.calls], [[{ id: made.call, text: CALL_TEXT }], []]);
  });

  it('21.1.5: a decision of Claude\'s a migration carried over without its maker, made in the quick-fix, is never among Claude\'s calls', () => {
    dir = working();
    atTheFixes();
    const { ask } = ledgerReadHelpers(() => dir);
    ledgerHelpers(() => dir).carriedOver(PLACE, ask(PLACE, 'Does --colour take a value?'), 'It takes none.');

    assert.deepStrictEqual(board().view.calls, [{ id: made.call, text: CALL_TEXT }]);
  });

  it('a question proposing to replace Claude\'s call, parking its fix, holds nothing back: the call stands among Claude\'s calls while it waits', () => {
    dir = working();
    atTheFixes();
    parkedOnTheCall({ reason: 'was-wrong', task: '1.1', went_ahead: null, blind: false });

    assert.deepStrictEqual(board().view.calls, [{ id: made.call, text: CALL_TEXT }]);
  });

  it('a fix\'s page names its phase the fixes and, with no account, shows its rounds reported whole as its reviews (20.5.6); a scenario of it opens at the quick-fix\'s one branch, as running the product proved it there, and one of a fix not yet started opens not proven', () => {
    dir = working();
    atTheFixes();
    reported('1.1', 1, false);
    reported('1.1', 2, true);
    writeState(dir, layout.unit(UNIT, 'build', 'runs', '1.S1', 'run-001.json'), JSON.stringify({
      verdict: 'pass', unfixed: false, at: FROZEN_AT, checkout: dir, commits: [{ repo: '.', commit: git(dir, ['rev-parse', BRANCH]).trim() }], task: null, evidence: [], recordings: [],
    }));
    const page = board(['--page', 'task:1.1']).view;
    const scenario = (/** @type {string} */ ref) => (({ kind, standing, at }) => ({ kind, standing, at }))(board(['--page', ref]).view);

    assert.deepStrictEqual([page.phase_name, page.account, page.reviews], ['the fixes', null, [{ round: 'Round 1', summary: '2 findings, sent back' }, { round: 'Round 2', summary: 'passed' }]]);
    assert.deepStrictEqual([scenario('task:1.1:scenario:1.S1'), scenario('task:1.2:scenario:2.S1')], [{ kind: 'scenario', standing: 'proven', at: FROZEN_AT }, { kind: 'scenario', standing: 'not proven', at: null }]);
  });
});

describe('27.S8: every phase a session can be in draws a view of its own', () => {
  const places = Object.entries(WORK_TYPE_PIPELINES).flatMap(([type, pipeline]) => (type === 'epic' ? EPIC_PHASES : pipeline).map((phase) => [type, phase]));

  it('This session draws each type\'s every phase by a view of that phase, a quick-fix\'s one session by its own (27.2.9)', () => {
    const unviewed = places.filter(([type, phase]) => phaseViewOf(type, phase) === null);

    assert.deepStrictEqual(unviewed, []);
    assert.notStrictEqual(phaseViewOf('quick-fix', 'implementation'), phaseViewOf('feature', 'implementation'));
  });
});
