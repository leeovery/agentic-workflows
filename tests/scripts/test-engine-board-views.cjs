'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a discussion and at an epic's menu (leeway-engine/
// scripts/domain/projections/board-discussion.cjs, board-unit.cjs; 20.7,
// 20.8, 20.13, 20.15): a topic's progress, what is open, its messages,
// Claude's calls since the person last looked — read without looking
// (5.8.14) — its review rounds, what is decided and everything it sent; a
// message's and a review report's pages; an experiment, its design and its
// report; the epic's page, its topics' experiments and what happened lately,
// and a topic's page from it — a started one's discussion, a cancelled one's
// once it started; other units' pages, the roadmap's topics postponed out of
// the epic, and This session that cannot be drawn.
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
const { ok, output, writeState, readManifest, stateGit, layout, withFrozenClock, FROZEN_AT } = require('./engine-harness.cjs');
const { useDecidedWorld, decidedHelpers, writeIn, answeredIn, NOTE_MAP, NO_PAYLOAD } = require('./decided-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, SESSION_ID, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { fixture, misfits, emptyLists } = require('./board-world.cjs');

const dir = useDecidedWorld();
const { close, staged, answer, run } = decidedHelpers(dir);

/** A dispatch's owner, this test's own process, which runs while it reads. */
const OWNED = Object.freeze({ CLAUDE_PID: String(process.pid) });

/** The board's answer for the world's conversation, its `ok` dropped. @param {string[]} [args] */
function board(args = []) {
  const { ok: _ok, ...answer } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
  return answer;
}

/** The conversation's position at a place, as its labelling records it. @param {string[]} place */
const at = (place) => ok(dir(), ['session', 'label', ...place], { env: SESSION });

/** The map shown in the conversation: the person has looked (5.8.14). */
const looked = () => output(dir(), ['render', 'map', `${UNIT}.note-window`], { env: SESSION });

/** A message sent from one topic of the epic to another, its title given. @param {string} from @param {string} to @param {string} title */
function sent(from, to, title) {
  const file = path.join(dir(), '.leeway', '.cache', `${from}-${to}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${title}\n\nIt bears on you.\n`);
  ok(dir(), ['topic', 'send', UNIT, to, '--from', from, '--content', file, '--slug', 'bears'], { env: SESSION });
}

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
      banner: { name: 'Fumi', state: 'running', facts: ['epic', 'discussion', 'Note Window', 'nothing of yours open'].map((text) => ({ text, needs: false })) },
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

/** An experiment, E1, spawned from the note window's discussion to measure a question of the person's. */
function spawned() {
  const question = writeIn(dir(), 'ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'How fast does a note open?' });
  const problem = '.leeway/.cache/fumi/scratch/note-open-problem.md';
  fs.mkdirSync(path.join(dir(), path.dirname(problem)), { recursive: true });
  fs.writeFileSync(path.join(dir(), problem), '# Problem — note-open\n');
  ok(dir(), ['experiment', 'create', UNIT, 'note-window', '--slug', 'note-open', '--from', 'discussion', '--problem', problem, '--question', question], { env: SESSION });
}

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
      banner: { name: 'Fumi', state: 'running', facts: ['epic', 'experiment E1', 'conceived'].map((text) => ({ text, needs: false })) },
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

describe('an epic\'s page (20.8)', () => {
  it('at the epic\'s menu, This session is its page: each topic with its state and its person\'s questions decided, the specification and build waiting; the banner counts its topics decided', () => {
    at([UNIT]);
    const { view, banner } = board();

    assert.deepStrictEqual({ view, banner }, {
      view: {
        kind: 'epic',
        unit: UNIT,
        title: 'Fumi',
        about: 'Test: fumi',
        started: null,
        now: { phase: 'discussion', since: null },
        at_menu: true,
        progress: { decided: 0, total: 2, discussing: 2 },
        topics: [
          { topic: 'note-window', title: 'Note Window', state: 'discussing', decided: 1, total: 1, session: null, messages: 0, experiment: null },
          { topic: 'space-homing', title: 'Space Homing', state: 'discussing', decided: 0, total: 0, session: null, messages: 0, experiment: null },
        ],
        spec: { state: 'waits', session: null },
        build: { state: 'waits', session: null },
        set_aside: [],
        lately: view.lately,
      },
      banner: { name: 'Fumi', state: 'running', facts: ['epic', 'at its menu', '0 of 2 topics decided'].map((text) => ({ text, needs: false })) },
    });
  });

  it('20.8.2 LATELY: what the state\'s history says happened in the epic, newest first, each topic by its title, a message sent with its sender', () => {
    at([UNIT]);
    sent('note-window', 'space-homing', 'The tour opens first');
    ok(dir(), ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later'], { env: SESSION });
    const { lately } = board().view;

    assert.deepStrictEqual(lately.slice(0, 2).map(({ kind, topic, detail }) => ({ kind, topic, detail })), [
      { kind: 'postponed', topic: 'Space Homing', detail: 'later' },
      { kind: 'sent', topic: 'Space Homing', detail: 'Note Window' },
    ]);
  });

  it('N8, 20.8.2: messages one topic took in one after another are one moment, counted — a message taken in alone names its sender — and the map approved says what it took in', () => {
    at([UNIT]);
    stateGit(dir(), ['commit', '-q', '--allow-empty', '-m', `discovery(${UNIT}): approve the map — 2 topics, 1 to the roadmap`]);
    sent('space-homing', 'note-window', 'Notes open on their Space');
    const [first] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'mail'));
    ok(dir(), ['topic', 'answered', UNIT, 'note-window', first.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Do notes open on their Space?' })], { env: SESSION });
    const alone = board().view.lately[0];
    sent('space-homing', 'note-window', 'A note keeps its Space');
    sent('space-homing', 'note-window', 'A note follows its window');
    for (const file of fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'mail'))) {
      ok(dir(), ['topic', 'answered', UNIT, 'note-window', file.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: `Is ${file} so?` })], { env: SESSION });
    }
    const said = (/** @type {any} */ { kind, topic, detail, count }) => ({ kind, topic, detail, count });
    const { lately } = board().view;

    assert.deepStrictEqual([said(alone), lately.slice(0, 2).map(said), said(lately.find(({ kind }) => kind === 'map-approved'))], [
      { kind: 'answered', topic: 'Note Window', detail: 'Space Homing', count: 1 },
      [{ kind: 'answered', topic: 'Note Window', detail: null, count: 2 }, { kind: 'sent', topic: 'Note Window', detail: 'Space Homing', count: undefined }],
      { kind: 'map-approved', topic: null, detail: '2 topics, 1 to the roadmap', count: undefined },
    ]);
  });

  it('20.8.2: the map approved before its subject carried its counts reads as approved, saying nothing of what it took in', () => {
    at([UNIT]);
    stateGit(dir(), ['commit', '-q', '--allow-empty', '-m', `discovery(${UNIT}): approve the map`]);
    const { kind, detail } = board().view.lately[0];

    assert.deepStrictEqual([kind, detail], ['map-approved', null]);
  });

  it('20.8.2 LATELY shows the latest ten of the epic\'s moments, newest first', () => {
    at([UNIT]);
    for (let k = 1; k <= 11; k += 1) stateGit(dir(), ['commit', '-q', '--allow-empty', '-m', `review(${UNIT}): round ${k}`]);
    const { lately } = board().view;

    assert.deepStrictEqual(lately.map(({ detail }) => detail), Array.from({ length: 10 }, (_, k) => `${11 - k}`));
  });

  it('S1, N4, 20.16.1: All work\'s roadmap lists a topic postponed out of an epic by its title, not its summary, with the epic\'s title', () => {
    at([UNIT]);
    const summary = 'Where someone meets Fumi before paying: the only place a prospective buyer sees it work, carrying Buy, the download and the terms';
    ok(dir(), ['topic', 'add', UNIT, 'website', '--summary', summary, '--brief', writeState(dir(), layout.cache('scratch', 'website.md'), '# Website\n')], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'website', '--horizon', 'later'], { env: SESSION });
    const item = board(['--tab', 'all']).view.roadmap.find(({ horizon }) => horizon === 'later').items.find(({ from }) => from !== null);

    assert.deepStrictEqual(item, { title: 'Website', from: 'Fumi' });
  });

  it('N5, D29: a topic decided, and one cancelled once its discussion started, open on the discussion\'s page; one cancelled before it started — though a message waited for it — and one postponed, on its brief', () => {
    at([UNIT]);
    close();
    staged(NO_PAYLOAD);
    run(answer('decided', 'y'));
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'space-homing'], { env: SESSION });
    for (const topic of ['tray-icon', 'dock-menu']) ok(dir(), ['topic', 'add', UNIT, topic, '--summary', `The ${topic}`, '--brief', writeState(dir(), layout.cache('scratch', `${topic}.md`), `# ${topic}\n`)], { env: SESSION });
    sent('note-window', 'tray-icon', 'The tray shows the note count');
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'tray-icon'], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'dock-menu', '--horizon', 'later'], { env: SESSION });
    const page = (/** @type {string} */ topic) => board(['--tab', 'unit', '--page', `topic:${topic}`]).view.kind;

    assert.deepStrictEqual(['note-window', 'space-homing', 'tray-icon', 'dock-menu'].map(page), ['discussion', 'discussion', 'brief', 'brief']);
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['tray-icon']?.previous_status, 'unstarted', 'the message parked an unstarted discussion item, which the cancel set aside');
  });

  it('20.8.3: a started topic\'s page, read over the session, carries its summary on the map and is no live discussion; the topic the session is in is', () => {
    at([UNIT, 'discussion', 'note-window']);
    const summary = readManifest(dir(), UNIT).phases.discovery.items['space-homing'].summary;
    const page = board(['--tab', 'unit', '--page', 'topic:space-homing']).view;

    assert.deepStrictEqual([page.summary, page.live, board().view.live], [summary, false, true]);
    assert.notStrictEqual(summary, '');
  });

  it('on the epic\'s tab the topic the session is in is this session\'s, and a topic opens on its own page (20.8.3, 20.15.2)', () => {
    at([UNIT, 'discussion', 'note-window']);
    const tab = board(['--tab', 'unit']).view;
    const page = board(['--tab', 'unit', '--page', 'topic:space-homing']).view;

    assert.deepStrictEqual([tab.kind, tab.topics.map(({ session }) => session), page.kind, page.topic], ['epic', ['this', null], 'discussion', 'space-homing']);
  });
});

describe('other units\' pages (20.15)', () => {
  it('20.15.2: an epic whose discovery runs before any topic exists shows its phases, each after discovery with what it waits on', () => {
    createManifest(dir(), 'atlas', { work_type: 'epic' });

    const later = { on: null, session: null, page: false };

    assert.deepStrictEqual(board(['--tab', 'unit', '--unit', 'atlas']).view.phases, [
      { phase: 'discovery', state: 'running', words: '', ...later },
      { phase: 'discussion', state: 'later', words: 'once the map is approved', ...later },
      { phase: 'specification', state: 'later', words: 'once every topic is decided', ...later },
      { phase: 'build', state: 'later', words: '', ...later },
      { phase: 'review', state: 'later', words: '', ...later },
    ]);
  });

  it('20.15.1, 20.8.2: a unit started the day its manifest was made, as the manifest stamps it — an epic\'s page and any other unit\'s tab alike — and none is said where it holds no stamp', () => {
    writeState(dir(), layout.manifest(UNIT), JSON.stringify({ ...readManifest(dir(), UNIT), created: '2026-07-15' }));
    createManifest(dir(), 'atlas', { work_type: 'epic', created: '2026-07-17' });
    createManifest(dir(), 'tidy', { work_type: 'feature' });
    const started = (/** @type {string} */ unit) => {
      const { kind, started: day } = board(['--tab', 'unit', '--unit', unit]).view;
      return [kind, day];
    };

    assert.deepStrictEqual([UNIT, 'atlas', 'tidy'].map(started), [['epic', '2026-07-15'], ['unit', '2026-07-17'], ['unit', null]]);
  });

  it('20.15.2: a quick-fix\'s one session is its implementation, which This session shows as the unit\'s page', () => {
    createManifest(dir(), 'tidy', { work_type: 'quick-fix', phases: { implementation: { items: { tidy: { status: 'in-progress' } } } } });
    at(['tidy', 'implementation', 'tidy']);
    const { view } = board();

    assert.deepStrictEqual([view.kind, view.phases.map(({ phase, state }) => [phase, state])], ['unit', [['discovery', 'complete'], ['implementation', 'running']]]);
  });

  it('20.15.1: a unit\'s tab, its spec written and its build not begun, lists each gap its spec\'s review waits on the person for', () => {
    createManifest(dir(), 'shop', { phases: { discussion: { items: { shop: { status: 'completed' } } } } });
    writeState(dir(), 'shop/spec.md', '# Shop\n\n## 1. Cart\n\n1.1.1 A cart holds items.\n');
    const asked = writeIn(dir(), 'ask', 'shop.specification', [], { ...MADE, text: 'Is a cart ever shared?' });

    assert.deepStrictEqual(board(['--tab', 'unit', '--unit', 'shop']).view.waiting, [{ kind: 'gap', id: asked, text: 'Is a cart ever shared?' }]);
  });

  it('S3, 20.15.1: a unit\'s tab says whether it is the unit the session is in, whose questions the board holds', () => {
    createManifest(dir(), 'shop', {});
    at([UNIT]);

    assert.deepStrictEqual([board(['--tab', 'unit', '--unit', 'shop']).view.here, board(['--tab', 'unit', '--unit', UNIT]).view.kind], [false, 'epic']);
    at(['shop']);
    assert.strictEqual(board(['--tab', 'unit']).view.here, true);
  });

  it('20.15.1, 20.15.3: a linear unit\'s phases each finished with the day it closed and what it produced — discovery the note it began from, the discussion its decisions — each opening in full; the phase it is in since the one before it closed; a phase that is not finished opens on no page', () => {
    createManifest(dir(), 'shop', {
      created: '2026-06-26',
      seeds: [{ path: 'seeds/cart.md', source: 'inbox:idea', seeded_at: '2026-06-26T09:00:00Z' }],
      phases: { discussion: { items: { shop: { status: 'completed' } } } },
      checklists: { decided: { shop: { items: {}, closed: '2026-10-17T12:00:00.000Z' } } },
    });
    writeState(dir(), 'shop/seeds/cart.md', '# A cart\n\nA cart holds what the shopper picks.\n\nIt keeps them a week.\n');
    writeState(dir(), 'shop/spec.md', '# Shop\n\n## 1. Cart\n\n1.1.1 A cart holds items.\n');
    const asked = writeIn(dir(), 'ask', 'shop.discussion.shop', [], { by: 'person', who_moved_whom: 'none', text: 'How long is a cart kept?' });
    writeIn(dir(), 'decide', 'shop.discussion.shop', ['--answers', asked], { by: 'person', who_moved_whom: 'none', given: 'own', text: 'A week.', why: 'Shoppers come back within days.' });
    const { view } = board(['--tab', 'unit', '--unit', 'shop']);
    const phase = (/** @type {string} */ name) => board(['--tab', 'unit', '--unit', 'shop', '--page', `phase:${name}`]).view;

    assert.deepStrictEqual([view.now, view.phases.slice(0, 3)], [{ phase: 'specification', since: '2026-10-17T12:00:00.000Z' }, [
      { phase: 'discovery', state: 'complete', words: 'from your inbox note', on: '2026-06-26', session: null, page: true },
      { phase: 'discussion', state: 'complete', words: '1 decision', on: '2026-10-17T12:00:00.000Z', session: null, page: true },
      { phase: 'specification', state: 'running', words: '1 section', on: null, session: null, page: false },
    ]]);
    assert.deepStrictEqual([phase('discovery'), phase('discussion'), phase('specification')], [
      { kind: 'phase', unit: 'shop', title: 'Shop', phase: 'discovery', on: '2026-06-26', words: 'from your inbox note', sections: [{ heading: 'Your note', text: '# A cart\n\nA cart holds what the shopper picks.\n\nIt keeps them a week.\n' }] },
      { kind: 'phase', unit: 'shop', title: 'Shop', phase: 'discussion', on: '2026-10-17T12:00:00.000Z', words: '1 decision', sections: [{ heading: 'Decisions', text: 'How long is a cart kept?: A week.' }] },
      { kind: 'unavailable', reason: 'shop has no finished specification that opens in full — a linear unit\'s discovery and discussion do, once complete' },
    ]);
  });

  it('20.16.1: All work says how far an epic has come by its topics decided of all, and nothing of a unit it reads no further', () => {
    at([UNIT]);

    assert.deepStrictEqual(board(['--tab', 'all']).view.units.map(({ unit, standing }) => [unit, standing]), [[UNIT, '0 of 2 topics decided'], ['solo', '']]);
  });

  it('This session that cannot be drawn says why in its tab and among the warnings, the banner at the session\'s place, while the unit\'s tab still draws', () => {
    createManifest(dir(), 'shop', {});
    at(['shop', 'implementation', 'shop']);
    const { view, banner, warnings } = board();

    assert.deepStrictEqual({ view, banner, warnings, tab: board(['--tab', 'unit']).view.kind }, {
      view: { kind: 'unavailable', reason: 'shop\'s build has not begun' },
      banner: { name: 'Shop', state: 'running', facts: ['feature', 'implementation'].map((text) => ({ text, needs: false })) },
      warnings: ['This session cannot be drawn — shop\'s build has not begun'],
      tab: 'unit',
    });
  });
});

describe('the views the mod draws, shaped as the engine answers them (N8)', () => {
  /** Where a fixture and the engine's answer part, and each list either holds no entry of. @param {any} held @param {any} view */
  const fits = (held, view) => ({ misfits: misfits(held, view), fixture: emptyLists(held), engine: emptyLists(view) });
  const FITS = { misfits: [], fixture: [], engine: [] };

  it('a discussion with its review round, what is open, the messages each way and the calls since; the epic\'s page with a topic set aside and an intake lately; and All work with the roadmap, the inbox and a unit complete', async () => {
    at([UNIT, 'discussion', 'note-window']);
    ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: SESSION });
    writeIn(dir(), 'ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Does a note float?' });
    sent('space-homing', 'note-window', 'Notes open on their Space');
    sent('note-window', 'space-homing', 'The tour opens first');
    const discussion = board().view;
    const [delivered] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'space-homing', 'mail'));
    ok(dir(), ['topic', 'answered', UNIT, 'space-homing', delivered.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Does the tour open first?' })], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later'], { env: SESSION });
    writeState(dir(), '.inbox/ideas/2026-10-30--fumi-stacks.md', '# Fumi stacks\n\nNotes stacked on a Space.\n');
    createManifest(dir(), 'tag-signing', { status: 'completed' });
    at([UNIT]);
    const [epic, all] = [board().view, board(['--tab', 'all']).view];

    assert.deepStrictEqual(
      [fits(await fixture('board-discussion.mjs'), discussion), fits(await fixture('board-epic.mjs'), epic), fits(await fixture('board-all.mjs'), all)],
      [FITS, FITS, FITS],
    );
  });

  it('an experiment approved with its design and its runs by condition', async () => {
    spawned();
    const record = path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'experiments', 'E1-note-open');
    fs.writeFileSync(path.join(record, 'design.md'), '# E1: Note open\n\n## Question\n\nHow fast does a note open?\n\n## Decision rule\n\nUnder 100 ms wins.\n');
    for (const step of ['advance', 'approve', 'advance']) ok(dir(), ['experiment', step, UNIT, 'note-window', 'E1'], { env: SESSION });
    const tally = '.leeway/.cache/fumi/experiment/note-window/runs.json';
    fs.mkdirSync(path.join(dir(), path.dirname(tally)), { recursive: true });
    fs.writeFileSync(path.join(dir(), tally), JSON.stringify([{ condition: '16 bare windows', of: 2, values: [0.24, 0.26], unit: 's' }]));
    ok(dir(), ['experiment', 'runs', UNIT, 'note-window', 'E1', '--file', tally], { env: SESSION });
    at([UNIT, 'experiment', 'note-window']);

    assert.deepStrictEqual(fits(await fixture('board-experiment.mjs'), board().view), FITS);
  });

  it('a linear unit\'s tab, its discussion decided, a gap of its spec waiting and its moments lately', async () => {
    createManifest(dir(), 'shop', {
      created: '2026-06-26',
      seeds: [{ path: 'seeds/cart.md', source: 'inbox:idea', seeded_at: '2026-06-26T09:00:00Z' }],
      phases: { discussion: { items: { shop: { status: 'completed' } } } },
      checklists: { decided: { shop: { items: {}, closed: '2026-10-17T12:00:00.000Z' } } },
    });
    writeState(dir(), 'shop/seeds/cart.md', '# A cart\n\nA cart holds what the shopper picks.\n');
    writeState(dir(), 'shop/spec.md', '# Shop\n\n## 1. Cart\n\n1.1.1 A cart holds items.\n');
    writeIn(dir(), 'ask', 'shop.specification', [], { ...MADE, text: 'Is a cart ever shared?' });
    stateGit(dir(), ['commit', '-q', '--allow-empty', '-m', 'discovery(shop): create work unit (feature)']);

    assert.deepStrictEqual(fits(await fixture('board-unit.mjs'), board(['--tab', 'unit', '--unit', 'shop']).view), FITS);
  });
});
