'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a discussion and at an epic's menu (leeway-engine/
// scripts/domain/projections/board-discussion.cjs, board-unit.cjs; 20.7,
// 20.8, 20.13, 20.15): a topic's progress, what is open, its messages,
// Claude's calls since the person last looked — read without looking
// (5.8.14) — its review rounds, what is decided and everything it sent; a
// message's and a review report's pages; an experiment, its design and its
// report; the epic's page, its topics' experiments and what happened lately,
// and a topic's page from it; other units' pages, and This session that
// cannot be drawn.
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
const { ok, output, writeState } = require('./engine-harness.cjs');
const { useDecidedWorld, writeIn, answeredIn, NOTE_MAP } = require('./decided-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, SESSION_ID, MADE, NOTE, SPACE } = require('./ledger-world.cjs');

const dir = useDecidedWorld();

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
        progress: { decided: 1, yours: 1, calls: 5 },
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

  it('a question of the person\'s still open, and a message waiting, each counted on the banner; what the topic sent, and nothing another sent, waits in the other\'s mailbox', () => {
    at([UNIT, 'discussion', 'note-window']);
    writeIn(dir(), 'ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Does a note float?' });
    sent('space-homing', 'note-window', 'Notes open on their Space');
    sent('note-window', 'space-homing', 'The tour opens first');
    sent('fumi.specification', 'space-homing', 'The spec asks a question');
    const { view, banner } = board();

    assert.deepStrictEqual({ open: view.open.map(({ text, from, experiment }) => ({ text, from, experiment })), messages: view.messages.map(({ title, from }) => ({ title, from })), sent: view.sent.map(({ title, to, waiting }) => ({ title, to, waiting })), facts: banner.facts.slice(3) }, {
      open: [{ text: 'Does a note float?', from: null, experiment: null }],
      messages: [{ title: 'Notes open on their Space', from: 'Space Homing' }],
      sent: [{ title: 'The tour opens first', to: 'Space Homing', waiting: true }],
      facts: [{ text: '1 of yours open', needs: false }, { text: '1 message waiting', needs: false }],
    });
  });

  it('what the topic sent stays listed once taken in, no longer waiting; a message waiting opens in full (20.7.1, 20.7.3)', () => {
    at([UNIT, 'discussion', 'note-window']);
    sent('note-window', 'space-homing', 'The tour opens first');
    sent('space-homing', 'note-window', 'Notes open on their Space');
    const [delivered] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'space-homing', 'mail'));
    const raised = writeIn(dir(), 'ask', SPACE, [], { ...MADE, text: 'Does the tour open first?' });
    ok(dir(), ['topic', 'answered', UNIT, 'space-homing', delivered.replace(/\.md$/, ''), '--entry', raised], { env: SESSION });
    const { view } = board();
    const [{ file }] = view.messages;

    assert.deepStrictEqual({ sent: view.sent.map(({ title, to, waiting }) => ({ title, to, waiting })), page: board(['--page', `message:note-window:${file}`]).view }, {
      sent: [{ title: 'The tour opens first', to: 'Space Homing', waiting: false }],
      page: { kind: 'message', unit: UNIT, topic: 'note-window', file, title: 'Notes open on their Space', from: 'Space Homing', when: view.messages[0].when, text: 'It bears on you.' },
    });
  });

  it('its review rounds, newest first: one running since it was dispatched, a finished one with its findings taken in and waiting; a report opens in full (20.7.1, 20.7.3)', () => {
    at([UNIT, 'discussion', 'note-window']);
    const first = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: SESSION });
    fs.writeFileSync(first.file, '# Review\n\n- F1: the corner is unexplained.\n- F2: the banner is unexplained.\n');
    ok(dir(), ['agent', 'scan', UNIT, 'discussion', 'note-window'], { env: SESSION });
    ok(dir(), ['agent', 'ack', UNIT, 'discussion', 'note-window', first.id, '--findings', 'F1,F2'], { env: SESSION });
    ok(dir(), ['agent', 'surface', UNIT, 'discussion', 'note-window', first.id, 'F1'], { env: SESSION });
    const second = ok(dir(), ['agent', 'dispatch', UNIT, 'discussion', 'note-window', '--kind', 'review', '--final'], { env: SESSION });
    const { reviews } = board().view;

    assert.deepStrictEqual({ reviews, page: board(['--page', `review:note-window:${first.id}`]).view.text }, {
      reviews: [
        { id: second.id, round: 2, running: true, since: reviews[0].since, findings: 0, taken: 0, waiting: 0 },
        { id: first.id, round: 1, running: false, since: reviews[1].since, findings: 2, taken: 1, waiting: 1 },
      ],
      page: fs.readFileSync(first.file, 'utf8'),
    });
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
        verdict: null,
        reason: null,
        problem: '# Problem — note-open',
        design: [],
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
      page: { kind: 'experiment-report', unit: UNIT, topic: 'note-window', id: 'E1', text: '# Report\n\nIt opens in 80 ms.\n' },
      row: { id: 'E1', running: false },
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
        at_menu: true,
        progress: { decided: 0, total: 2, discussing: 2 },
        topics: [
          { topic: 'note-window', title: 'Note Window', state: 'discussing', decided: 1, total: 1, session: null, messages: 0, experiment: null },
          { topic: 'space-homing', title: 'Space Homing', state: 'discussing', decided: 0, total: 0, session: null, messages: 0, experiment: null },
        ],
        spec: 'waits',
        build: 'waits',
        set_aside: [],
        lately: view.lately,
      },
      banner: { name: 'Fumi', state: 'running', facts: ['epic', 'at its menu', '0 of 2 topics decided'].map((text) => ({ text, needs: false })) },
    });
  });

  it('20.8.2 LATELY: what the state\'s history says happened in the epic, newest first, each topic by its title', () => {
    at([UNIT]);
    sent('note-window', 'space-homing', 'The tour opens first');
    ok(dir(), ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later'], { env: SESSION });
    const { lately } = board().view;

    assert.deepStrictEqual(lately.slice(0, 2).map(({ kind, topic, detail }) => ({ kind, topic, detail })), [
      { kind: 'postponed', topic: 'Space Homing', detail: 'later' },
      { kind: 'sent', topic: 'Space Homing', detail: '001-bears.md' },
    ]);
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

    assert.deepStrictEqual(board(['--tab', 'unit', '--unit', 'atlas']).view.phases, [
      { phase: 'discovery', state: 'running', words: '' },
      { phase: 'discussion', state: 'later', words: 'once the map is approved' },
      { phase: 'specification', state: 'later', words: 'once every topic is decided' },
      { phase: 'build', state: 'later', words: '' },
      { phase: 'review', state: 'later', words: '' },
    ]);
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
