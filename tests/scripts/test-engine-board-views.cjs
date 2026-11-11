'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a discussion and an experiment (leeway-engine/scripts/
// domain/projections/board-discussion.cjs, board-experiment.cjs; 20.7,
// 20.13): a topic's progress, what is open, its messages, Claude's calls
// since the person last looked — read without looking (5.8.14) — its
// review rounds, what is decided and everything it sent; a message's and a
// review report's pages; an experiment, its design and its report. The
// epic's page is test-engine-board-epic.cjs's, other units'
// test-engine-board-units.cjs's.
//
// Layer: verb. World: the decided suites' (decided-world.cjs) — the epic
// `fumi`, its note window's map written, its two topics under discussion —
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, readManifest, withFrozenClock, FROZEN_AT } = require('./engine-harness.cjs');
const { useDecidedWorld, decidedHelpers, decidedBoardHelpers, writeIn, answeredIn, NOTE_MAP } = require('./decided-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { place } = require('./board-world.cjs');

const dir = useDecidedWorld();
const { answer, run } = decidedHelpers(dir);
const { board, at, made, sent, spawned } = decidedBoardHelpers(dir);

/** A dispatch's owner, this test's own process, which runs while it reads. */
const OWNED = Object.freeze({ CLAUDE_PID: String(process.pid) });

/** The map shown in the conversation: the person has looked (5.8.14). */
const looked = () => output(dir(), ['render', 'map', `${UNIT}.note-window`], { env: SESSION });

/** The note window's calls of Claude's as the world wrote them: each its answer's id, its words and its question. */
const CALLS = () => [
  [NOTE_MAP.title, 'Welcome.', 'What is the screen titled?'],
  [NOTE_MAP.sync, 'On, once a folder is picked.', 'Is sync on at first run?'],
  [NOTE_MAP.price, 'Not in first run.', 'Is pricing mentioned?'],
  [NOTE_MAP.banner, 'No banner.', 'Is there a login item banner?'],
  [NOTE_MAP.corner, 'Top left.', 'Which corner does a note open in?'],
].map(([{ answer }, text, question]) => ({ id: answer, text, question }));

describe('a discussion on the board (20.7)', () => {
  it('This session in a discussion: the person\'s questions decided of theirs and Claude\'s calls, what is open, the calls since the person last looked, every decision with whose it is; the banner names the topic', () => {
    at([UNIT, 'discussion', 'note-window']);
    const { view, banner } = board();

    assert.deepStrictEqual({ view, banner }, {
      view: {
        kind: 'discussion',
        unit: UNIT,
        title: 'Fumi',
        type: 'epic',
        topic: 'note-window',
        topic_title: 'Note Window',
        summary: readManifest(dir(), UNIT).phases.discovery.items['note-window'].summary,
        live: true,
        progress: { decided: 1, yours: 1, calls: 5 },
        closing: false,
        open: [],
        messages: [],
        since: CALLS(),
        reviews: [],
        decided: [
          { id: view.decided[0].id, text: 'How does first run open?', who: 'yours' },
          ...CALLS().map(({ question }, k) => ({ id: view.decided[k + 1].id, text: question, who: 'claude' })),
        ],
        sent: [],
      },
      banner: { name: 'Fumi', state: 'running', facts: [place('epic'), place('discussion'), ...['Note Window', 'nothing of yours open'].map((text) => ({ text, needs: false }))] },
    });
  });

  it('a question of the person\'s still open, and a message waiting, each counted on the banner, the messages as waiting unflagged (D40); what the topic sent, and nothing another sent, waits in the other\'s mailbox', () => {
    at([UNIT, 'discussion', 'note-window']);
    writeIn(dir(), 'ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Does a note float?' });
    sent('space-homing', 'note-window', 'Notes open on their Space');
    sent('note-window', 'space-homing', 'The tour opens first');
    sent('fumi.specification', 'space-homing', 'The spec asks a question');
    const { view, banner } = board();

    assert.deepStrictEqual({ open: view.open.map(({ text, from, experiment }) => ({ text, from, experiment })), messages: view.messages.map(({ title, from }) => ({ title, from })), sent: view.sent.map(({ title, to, stands }) => ({ title, to, stands })), facts: banner.facts.slice(3) }, {
      open: [{ text: 'Does a note float?', from: null, experiment: null }],
      messages: [{ title: 'Notes open on their Space', from: 'Space Homing' }],
      sent: [{ title: 'The tour opens first', to: 'Space Homing', stands: 'waiting' }],
      facts: [{ text: '1 of yours open', needs: false }, { text: '1 message waiting', needs: false, waits: true }],
    });
  });

  it('what the topic sent stays listed once taken in, no longer waiting, read from the day before the unit was made — a unit stamped as made an hour from now, by a clock running ahead, still finding what it sent; a message waiting opens in full (20.7.1, 20.7.3)', () => {
    createManifest(dir(), UNIT, { ...readManifest(dir(), UNIT), created: new Date(Date.now() + 3600e3).toISOString() });
    at([UNIT, 'discussion', 'note-window']);
    sent('note-window', 'space-homing', 'The tour opens first');
    sent('space-homing', 'note-window', 'Notes open on their Space');
    const [delivered] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'space-homing', 'mail'));
    const raised = writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Does the tour open first?' });
    ok(dir(), ['topic', 'answered', UNIT, 'space-homing', delivered.replace(/\.md$/, ''), '--entry', raised], { env: SESSION });
    const { view } = board();
    const [{ file }] = view.messages;

    assert.deepStrictEqual({ sent: view.sent.map(({ title, to, stands }) => ({ title, to, stands })), page: board(['--page', `message:note-window:${file}`]).view }, {
      sent: [{ title: 'The tour opens first', to: 'Space Homing', stands: 'taken' }],
      page: { kind: 'message', unit: UNIT, topic: 'note-window', file, title: 'Notes open on their Space', from: 'Space Homing', when: view.messages[0].when, text: 'It bears on you.' },
    });
  });

  it('a message the topic sent that left its mailbox untaken — its topic cancelled, its mail to the inbox — stands moved to the inbox, never taken in (20.7.1)', () => {
    at([UNIT, 'discussion', 'note-window']);
    sent('note-window', 'space-homing', 'The tour opens first');
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'space-homing'], { env: SESSION });

    assert.deepStrictEqual(board().view.sent.map(({ title, stands }) => [title, stands]), [['The tour opens first', 'inbox']]);
  });

  it('its review rounds, newest first, each since it was dispatched: one running while the conversation that sent it runs, a read one with its findings taken in and waiting; a report opens in full (20.7.1, 20.7.3)', () => {
    at([UNIT, 'discussion', 'note-window']);
    const first = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: SESSION });
    fs.writeFileSync(first.file, '# Review\n\n- F1: the corner is unexplained.\n- F2: the banner is unexplained.\n');
    ok(dir(), ['agent', 'scan', UNIT, 'discussion', 'note-window'], { env: SESSION });
    ok(dir(), ['agent', 'ack', UNIT, 'discussion', 'note-window', first.id, '--findings', 'F1,F2'], { env: SESSION });
    ok(dir(), ['agent', 'surface', UNIT, 'discussion', 'note-window', first.id, 'F1'], { env: SESSION });
    const second = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: { ...SESSION, ...OWNED } });
    const { reviews } = board().view;

    const { text, topic_title: of } = board(['--page', `review:note-window:${first.id}`]).view;

    assert.deepStrictEqual({ reviews, page: [text, of] }, {
      reviews: [
        { id: second.id, round: 2, state: 'running', since: reviews[0].since, findings: 0, taken: 0, waiting: 0 },
        { id: first.id, round: 1, state: 'read', since: reviews[1].since, findings: 2, taken: 1, waiting: 1 },
      ],
      page: [fs.readFileSync(first.file, 'utf8'), 'Note Window'],
    });
  });

  it('N2, 20.7.1: the closing pass runs while its agent runs, and not once the conversation that sent it is gone', () => {
    at([UNIT, 'discussion', 'note-window']);
    const before = board().view.closing;
    ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'closing-pass'], { env: { ...SESSION, ...OWNED } });
    const running = board().view.closing;
    ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'space-homing', '--kind', 'closing-pass'], { env: { ...SESSION, CLAUDE_PID: undefined } });

    assert.deepStrictEqual([before, running, board(['--page', 'topic:space-homing']).view.closing], [false, true, false]);
  });

  it('a round in flight stands where the agent store stands it: lost once the conversation that sent it is gone, and its report in, not yet taken, once written (20.7.1)', () => {
    at([UNIT, 'discussion', 'note-window']);
    const sent = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: { ...SESSION, CLAUDE_PID: undefined } });
    const lost = board().view.reviews.map(({ state }) => state);
    fs.writeFileSync(sent.file, '# Review\n\n- F1: the corner is unexplained.\n');

    assert.deepStrictEqual([lost, board().view.reviews.map(({ state }) => state)], [['lost'], ['landed']]);
  });

  it('5.S30, 9.S57: opening the board is not looking — the calls since the map last showed in the conversation stay listed however often the board is drawn, and only those made since that look list after it', () => {
    at([UNIT, 'discussion', 'note-window']);
    const before = [board().view.since, board().view.since];
    looked();
    const afterLook = board().view.since;
    const late = answeredIn(dir(), NOTE, 'Does a note snap to the grid?', { ...MADE, text: 'It snaps.' });

    assert.deepStrictEqual({ before, afterLook, later: board().view.since }, {
      before: [CALLS(), CALLS()],
      afterLook: [],
      later: [{ id: late.answer, text: 'It snaps.', question: 'Does a note snap to the grid?' }],
    });
  });
});

describe('an experiment on the board (20.13)', () => {
  it('20.S21: This session in an experiment shows its id, the question it measures, the topic it serves and where it stands; the topic\'s row on the epic\'s page names it waiting', () => {
    spawned();
    at([UNIT, 'experiment', 'note-window']);
    const { view, banner } = board();

    const [row] = board(['--tab', 'unit']).view.topics;

    assert.deepStrictEqual({ view, banner, row: { experiment: row.experiment, session: row.session } }, {
      view: {
        kind: 'experiment',
        unit: UNIT,
        title: 'Fumi',
        type: 'epic',
        id: 'E1',
        question: 'How fast does a note open?',
        topic: 'note-window',
        topic_title: 'Note Window',
        status: 'conceived',
        approved: null,
        verdict: null,
        reason: null,
        problem: '# Problem — note-open',
        design: [],
        runs: [],
        report: false,
      },
      banner: { name: 'Fumi', state: 'running', facts: [place('epic'), place('experiment E1'), { text: 'conceived', needs: false }] },
      row: { experiment: { id: 'E1', running: true }, session: 'this' },
    });
  });

  it('20.13.1: its design by its sections once written, the report opening in full once written; 20.13.2: concluded, the topic\'s row says its report waits', () => {
    spawned();
    const record = path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'experiments', 'E1-note-open');
    fs.writeFileSync(path.join(record, 'design.md'), '# E1: Note open\n\n## Question\n\nHow fast does a note open?\n\n## Decision rule\n\nUnder 100 ms wins.\n\n## Notes\n');
    for (const step of ['advance', 'approve', 'advance']) ok(dir(), ['experiment', step, UNIT, 'note-window', 'E1'], { env: SESSION });
    fs.writeFileSync(path.join(record, 'report.md'), '# Report\n\nIt opens in 80 ms.\n');
    ok(dir(), ['experiment', 'conclude', UNIT, 'note-window', 'E1', '--verdict', 'rule held'], { env: SESSION });
    at([UNIT, 'experiment', 'note-window']);
    const { view } = board();
    at([UNIT]);

    assert.deepStrictEqual({ design: view.design, report: view.report, page: board(['--page', 'report:note-window:E1']).view, row: board().view.topics[0].experiment }, {
      design: [{ heading: 'Question', text: 'How fast does a note open?' }, { heading: 'Decision rule', text: 'Under 100 ms wins.' }],
      report: true,
      page: { kind: 'experiment-report', unit: UNIT, topic: 'note-window', topic_title: 'Note Window', id: 'E1', status: 'concluded', text: '# Report\n\nIt opens in 80 ms.\n' },
      row: { id: 'E1', running: false },
    });
  });

  it('20.13.1: the day it was approved, and its runs by condition, each with its runs done of the runs its design gives it and their median; 20.2.4: the banner counts them while it runs, and says concluded once its verdict is in', () => {
    spawned();
    ok(dir(), ['experiment', 'advance', UNIT, 'note-window', 'E1'], { env: SESSION });
    withFrozenClock(() => ok(dir(), ['experiment', 'approve', UNIT, 'note-window', 'E1'], { env: SESSION }));
    ok(dir(), ['experiment', 'advance', UNIT, 'note-window', 'E1'], { env: SESSION });
    const tally = '.leeway/.cache/fumi/experiment/note-window/runs.json';
    fs.mkdirSync(path.join(dir(), path.dirname(tally)), { recursive: true });
    fs.writeFileSync(path.join(dir(), tally), JSON.stringify([
      { condition: '16 bare windows', of: 2, values: [0.24, 0.26], unit: 's' },
      { condition: '25 real fumis', of: 3, values: [0.67] },
    ]));
    ok(dir(), ['experiment', 'runs', UNIT, 'note-window', 'E1', '--file', tally], { env: SESSION });
    at([UNIT, 'experiment', 'note-window']);
    const running = board();
    ok(dir(), ['experiment', 'conclude', UNIT, 'note-window', 'E1', '--verdict', 'rule held'], { env: SESSION });
    const concluded = board();

    assert.deepStrictEqual({ approved: running.view.approved, runs: running.view.runs, facts: [running, concluded].map(({ banner }) => banner.facts.map(({ text }) => text)) }, {
      approved: FROZEN_AT.slice(0, 10),
      runs: [
        { condition: '16 bare windows', of: 2, done: 2, median: 0.25, unit: 's' },
        { condition: '25 real fumis', of: 3, done: 1, median: 0.67, unit: null },
      ],
      facts: [['epic', 'experiment E1', '3 of 5 runs'], ['epic', 'experiment E1', 'concluded']],
    });
  });

  it('an experiment abandoned stands so, with its reason, the banner done', () => {
    spawned();
    ok(dir(), ['experiment', 'abandon', UNIT, 'note-window', 'E1', '--reason', 'The bench is gone.'], { env: SESSION });
    at([UNIT, 'experiment', 'note-window']);
    const { view, banner } = board();

    assert.deepStrictEqual([view.status, view.reason, banner.state], ['abandoned', 'The bench is gone.', 'done']);
  });
});
