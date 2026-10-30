'use strict';

// ---------------------------------------------------------------------------
// Discussion's briefs (leeway-engine/scripts/domain/brief.cjs, the records
// domain/brief-records.cjs, the templates content/briefs/): `engine brief
// <role> <unit> <topic> [--question <id>] [--agent <id>]` for the deep
// dive, the perspective, the synthesis, the discussion reviewer, the
// closing-pass reader and the plain search (9.8.13, 13.11.1, 22.6.10). Each
// brief is named for its topic on its first line, its record saying whose
// it is; its slots filled from the ledger's reads and the topic's agent
// store, never the conversation (26.1.5): the topic's record and the
// product record as their read verbs answer them, the log's path, each
// other live topic's record and none of a topic set aside (5.8.17, 5.S40),
// the question by any wording, whether a gap review has run since the
// topic's last decision (9.9.6), the dispatch's report, a perspective's
// lens and a synthesis's perspectives verbatim. Every refusal stores no
// brief. The templates carry no tie-break, no cap, and no model or effort;
// each role's agent is a definition fixing Opus at medium (26.4.1).
//
// Layer: verb. World: an epic with three topics under discussion, written
// once through the ledger's verbs — on the note window a decision replaced,
// a measured finding and the person's open question, and its log; on space
// homing Claude's product-wide call; on the menu bar a decision the note
// window's contradicts.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, refusedPristine, statePath, layout, writeState, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, MADE, NOTE, SPACE, MENU, row, writtenWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ROLES, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');
const AGENTS = path.join(__dirname, '../../agents');

const SESSION_ID = 'brief-discussion-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const TOPIC = 'note-window';
const LOG = layout.unit(UNIT, `topics/${TOPIC}/log.md`);

/** Discussion's six roles. */
const DISCUSSION_ROLES = Object.freeze(['deep-dive', 'perspective', 'synthesis', 'discussion-reviewer', 'closing-pass-reader', 'plain-search']);

/** The unit's three topics, each mapped and under discussion. */
const PHASES = Object.freeze({
  discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open'), 'menu-bar': row(3, 'The menu bar') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' }, 'menu-bar': { status: 'in-progress' } } },
});

const OPEN_TEXT = 'Which Space does a new note open on?';
const MENU_TEXT = 'A note is a window.';

const WORLD = writtenWorld('brief-discussion-', PHASES, (write) => {
  const person = { by: 'person', who_moved_whom: 'none' };
  const asked = write('ask', NOTE, [], { ...person, text: 'Is a note a window?' }).id;
  const measured = write('find', NOTE, [], {
    ...MADE, text: 'A panel opens in 4 ms.', how: 'timed the open', known: 'measured', command: 'swift run bench open', result: 'median 4.1 ms',
  }).id;
  const first = write('decide', NOTE, ['--answers', asked], { ...person, text: 'A window.', why: 'It is familiar.' }).id;
  write('replace', NOTE, ['--replaces', first, '--reason', 'changed-mind'], { ...person, drops: ['a window'], text: 'A floating panel.', why: 'It follows the person.' });
  const open = write('ask', NOTE, [], { ...person, text: OPEN_TEXT }).id;
  const homing = write('ask', SPACE, [], { ...MADE, text: 'Does a note follow its Space?' }).id;
  write('decide', SPACE, ['--answers', homing], { ...MADE, text: 'Notes stay on their Space.', why: 'Spaces are places.', product_wide: true });
  const menu = write('ask', MENU, [], { ...person, text: 'What is a note on the menu bar?' }).id;
  write('decide', MENU, ['--answers', menu], { ...person, text: MENU_TEXT, why: 'The menu bar opens windows.' });
  return { measured, first, open, homing };
});

/** @type {string} */
let dir;
beforeEach(() => {
  dir = WORLD.world();
  writeState(dir, LOG, '## 2026-10-30 · session s1\n\nWe weighed a window against a panel.\n');
});
afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
});
const { write } = ledgerHelpers(() => dir);

/** The files the conversation's briefs folder holds. */
const stored = () => {
  const folder = path.dirname(briefPath(SESSION_ID, 'x'));
  return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
};

/** A dispatch recorded on a topic of the unit: its response. @param {string} kind @param {string[]} [flags] @param {string} [topic] */
const dispatch = (kind, flags = [], topic = TOPIC) => ok(dir, ['agent', 'dispatch', UNIT, 'discussion', topic, '--kind', kind, ...flags]);

/** A brief issued: its response, and the brief as stored. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

/** A role's template as shipped. @param {string} role */
const template = (role) => fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8');

/** A role's template, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return template(role).split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** A ledger read's answer as a brief draws it: fenced as JSON. @param {string[]} args */
function readJson(args) {
  const { ok: _ok, ...answer } = ok(dir, ['ledger', ...args]);
  return `\`\`\`json\n${JSON.stringify(answer, null, 2)}\n\`\`\``;
}

/** The section a heading opens in a brief, to the next top-level heading. @param {string} brief @param {string} heading */
function section(brief, heading) {
  const from = brief.indexOf(`\n# ${heading}\n\n`);
  assert.ok(from >= 0, `no section ${heading}`);
  const body = brief.slice(from + heading.length + 5);
  const end = body.indexOf('\n# ');
  return (end < 0 ? body : body.slice(0, end)).trimEnd();
}

/** A refusal storing no brief: its error. @param {string[]} args @param {RegExp} pattern */
function refusedUnissued(args, pattern) {
  const { error } = refusedPristine(dir, ['brief', ...args], { env: SESSION });
  assert.match(error, pattern);
  assert.deepStrictEqual(stored(), []);
}

/** The record of whose a brief is. @param {string} id */
const issuedRecord = (id) => JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, id), 'utf8'));

describe('9.S40: the deep dive\'s brief (9.1.5)', () => {
  it('named for its topic, the question in its current wording, the topic\'s record as `ledger record` answers it — each answer with what it replaced — the product record as `ledger product` answers it, and the dispatch\'s report; its record naming the topic', () => {
    const dive = dispatch('deep-dive');

    const { res, brief } = issued(['deep-dive', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', dive.id]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'deep-dive', agent: 'leeway-deep-dive', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the deep dive's, for ${UNIT} topic ${TOPIC}\n\n${filledTemplate('deep-dive', {
      question: `${WORLD.made.open}: ${OPEN_TEXT}`,
      'topic-record': readJson(['record', UNIT, TOPIC]),
      'product-record': readJson(['product']),
      'report-to': `\`${dive.file}\``,
    })}`);
    assert.ok(section(brief, 'This topic\'s record').includes('"text": "A window."'), 'the replaced answer is folded beneath the answer that replaced it (9.2.5)');
    assert.deepStrictEqual(issuedRecord(res.id), { role: 'deep-dive', agent: 'leeway-deep-dive', unit: UNIT, task: null, topic: TOPIC });
  });

  it('a question named by an earlier wording is drawn in its current one', () => {
    const reworded = write('replace', NOTE, ['--replaces', WORLD.made.open, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Which Space opens a new note?' }).id;
    const dive = dispatch('deep-dive');

    const { brief } = issued(['deep-dive', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', dive.id]);

    assert.strictEqual(section(brief, 'Your question'), `${reworded}: Which Space opens a new note?`);
  });
});

describe('the perspective\'s and the synthesis\'s briefs', () => {
  it('each lens of a pair briefed with its own label', () => {
    const pair = dispatch('perspective', ['--label', 'ship-now', '--label', 'strategic-timing']);

    const lenses = pair.agents.map((/** @type {{id: string}} */ { id }) => section(issued(['perspective', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', id]).brief, 'Your lens'));

    assert.deepStrictEqual(lenses, ['`ship-now`', '`strategic-timing`']);
  });

  it('a synthesis is briefed with its set\'s perspectives verbatim, in the order they were dispatched, and nothing of another set', () => {
    const pair = dispatch('perspective', ['--label', 'ship-now', '--label', 'strategic-timing']);
    const other = dispatch('perspective', ['--label', 'common-path']);
    const reports = ['# Perspective: Ship Now\n\nShip it.\n', '# Perspective: Strategic Timing\n\nWait for 2.0.\n\n'];
    pair.agents.forEach((/** @type {{file: string}} */ { file }, i) => fs.writeFileSync(file, reports[i]));
    fs.writeFileSync(other.file, '# Perspective: Common Path\n\nThe usual case.\n');
    ok(dir, ['agent', 'scan', UNIT, 'discussion', TOPIC]);
    const synthesis = dispatch('synthesis', ['--set', pair.set]);

    const { res, brief } = issued(['synthesis', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', synthesis.id]);

    const perspectives = '# Perspective: Ship Now\n\nShip it.\n\n# Perspective: Strategic Timing\n\nWait for 2.0.';
    assert.ok(brief.includes(`\n# The perspectives\n\n${perspectives}\n\n# This topic's record\n`), brief);
    assert.strictEqual(brief.split('\n')[0], `Brief ${res.id} — the synthesis's, for ${UNIT} topic ${TOPIC}`);
  });

  it('a perspective of the set with no report refuses the synthesis\'s brief, as a perspective dispatched with no lens refuses its own', () => {
    const pair = dispatch('perspective', ['--label', 'ship-now', '--label', 'strategic-timing']);
    fs.writeFileSync(pair.agents[0].file, '# Perspective: Ship Now\n');
    ok(dir, ['agent', 'scan', UNIT, 'discussion', TOPIC]);
    ok(dir, ['agent', 'incorporate', UNIT, 'discussion', TOPIC, pair.agents[1].id]);
    const synthesis = dispatch('synthesis', ['--set', pair.set]);
    const unlabelled = dispatch('perspective');

    refusedUnissued(['synthesis', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', synthesis.id], /^brief: perspective-001-strategic-timing's report, .*, is not written — a synthesis reads every perspective of its set$/);
    refusedUnissued(['perspective', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', unlabelled.id], /^brief: perspective-002 names no lens — a perspective is dispatched with --label <lens>$/);
  });
});

describe('the discussion reviewer\'s brief (9.8.13)', () => {
  it('the topic\'s record, its log\'s path, every other live topic\'s record under its name, the product record and the dispatch\'s report', () => {
    const review = dispatch('review');

    const { res, brief } = issued(['discussion-reviewer', UNIT, TOPIC, '--agent', review.id]);

    assert.strictEqual(brief, `Brief ${res.id} — the discussion reviewer's, for ${UNIT} topic ${TOPIC}\n\n${filledTemplate('discussion-reviewer', {
      'topic-record': readJson(['record', UNIT, TOPIC]),
      'topic-log': `\`${statePath(dir, LOG)}\``,
      'other-records': `## menu-bar\n\n${readJson(['record', UNIT, 'menu-bar'])}\n\n## space-homing\n\n${readJson(['record', UNIT, 'space-homing'])}`,
      'product-record': readJson(['product']),
      'report-to': `\`${review.file}\``,
    })}`);
  });

  it('a topic with no log yet, and no other topic holding anything, draws each as none recorded', () => {
    fs.rmSync(statePath(dir, LOG));
    for (const topic of ['space-homing', 'menu-bar']) ok(dir, ['topic', 'cancel', UNIT, 'discovery', topic]);
    const review = dispatch('review');

    const { brief } = issued(['discussion-reviewer', UNIT, TOPIC, '--agent', review.id]);

    assert.deepStrictEqual([section(brief, 'This topic\'s log'), section(brief, 'Other topics\' records')], ['None recorded.', 'None recorded.']);
  });

  it('9.S46: the reviewer\'s template carries no "it is `ask`" tie-break, and neither does its agent\'s definition, whose lanes leave the call to the matrix', () => {
    const definition = fs.readFileSync(path.join(AGENTS, 'leeway-discussion-reviewer.md'), 'utf8');

    for (const text of [template('discussion-reviewer'), definition]) assert.doesNotMatch(text, /either way|it is `ask`|is `ask`/);
    assert.match(definition, /whether it reaches the person is the matrix's to decide, never yours/);
  });

  it('9.S28: no template of the reviews sets a cap on findings, and each review\'s definition says there is none', () => {
    for (const role of ['discussion-reviewer', 'closing-pass-reader']) assert.doesNotMatch(template(role), /\bat most\b|\bno more than\b|\bup to \d|\bcap\b|\blimit\b/i, role);
    for (const agent of ['leeway-discussion-reviewer', 'leeway-closing-pass-reader']) {
      assert.match(fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8'), /there is no cap on how many/i, agent);
    }
  });
});

describe('the closing-pass reader\'s brief (9.9)', () => {
  /** The closing pass's brief for `id`: its gap review, and its other topics' records. @param {string} id */
  const pass = (id) => {
    const { brief } = issued(['closing-pass-reader', UNIT, TOPIC, '--agent', id]);
    return { gap: section(brief, 'The gap review'), others: section(brief, 'Other topics\' records') };
  };

  it('5.S40: a cancelled topic\'s contradicting decision is not read; once reactivated, it is', () => {
    const reader = dispatch('closing-pass');
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    const cancelled = pass(reader.id).others;
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'menu-bar']);
    const reactivated = pass(reader.id).others;

    assert.deepStrictEqual([cancelled.includes(MENU_TEXT), cancelled.startsWith('## space-homing'), reactivated.includes(MENU_TEXT)], [false, true, true]);
  });

  it('9.9.6: the gap review — owed with none run; run once a review dispatched after the topic\'s last decision has reported, a closing pass among them; owed again after a later decision, however many reviews are left without a report', () => {
    const first = dispatch('closing-pass');
    const none = pass(first.id).gap;
    const review = dispatch('review');
    fs.writeFileSync(review.file, '# Findings\n');
    const reviewed = pass(first.id).gap;
    write('decide', NOTE, ['--answers', WORLD.made.open], { by: 'person', who_moved_whom: 'none', text: 'The current Space.', why: 'Where they are.' });
    dispatch('review');
    fs.writeFileSync(first.file, '# Closing Pass\n');
    const decided = pass(first.id).gap;
    const second = dispatch('closing-pass');
    fs.writeFileSync(second.file, '# Closing Pass\n');
    const passed = pass(dispatch('closing-pass').id).gap;

    assert.deepStrictEqual([none, reviewed, decided, passed], [
      'No gap review has run since this topic\'s last decision.',
      `A gap review has run since this topic's last decision: ${review.id}.`,
      'No gap review has run since this topic\'s last decision.',
      `A gap review has run since this topic's last decision: ${second.id}.`,
    ]);
  });
});

describe('22.S23: the plain search\'s brief (22.6.10)', () => {
  it('the question alone, named for its topic, with no dispatch in the store', () => {
    const { res, brief } = issued(['plain-search', UNIT, TOPIC, '--question', WORLD.made.open]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'plain-search', agent: 'leeway-plain-search', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the plain search's, for ${UNIT} topic ${TOPIC}\n\n# What to find\n\n${WORLD.made.open}: ${OPEN_TEXT}\n`);
  });
});

describe('the refusals, no brief stored', () => {
  it('a unit or a topic the project lacks, and a topic set aside', () => {
    refusedUnissued(['plain-search', 'nope', TOPIC, '--question', WORLD.made.open], /^Work unit "nope" not found$/);
    refusedUnissued(['plain-search', UNIT, 'tray', '--question', WORLD.made.open], /^brief: fumi has no topic "tray"$/);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', TOPIC]);
    refusedUnissued(['plain-search', UNIT, TOPIC, '--question', WORLD.made.open], /^brief: fumi\/note-window is set aside — its topic, note-window, is cancelled$/);
  });

  it('a question that is none, is no longer current, stands on another topic, or no ledger entry\'s id begins', () => {
    write('move', NOTE, ['--question', WORLD.made.open, '--to', 'menu-bar'], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);

    refusedUnissued(['plain-search', UNIT, TOPIC, '--question', WORLD.made.open], /^brief: question \w+ is no longer current$/);
    refusedUnissued(['plain-search', UNIT, TOPIC, '--question', WORLD.made.measured], /^brief: \w+ names no question — --question takes a question on fumi\/note-window's map$/);
    refusedUnissued(['plain-search', UNIT, TOPIC, '--question', WORLD.made.homing], /^brief: question \w+ stands on fumi\/space-homing, not fumi\/note-window$/);
    refusedUnissued(['plain-search', UNIT, TOPIC, '--question', 'zzzz'], /^no ledger entry's id begins "zzzz"$/);
  });

  it('a dispatch the topic\'s store lacks, of another kind than the role is briefed for, or no longer in flight', () => {
    const review = dispatch('review');
    const dive = dispatch('deep-dive');
    ok(dir, ['agent', 'incorporate', UNIT, 'discussion', TOPIC, dive.id]);

    refusedUnissued(['discussion-reviewer', UNIT, TOPIC, '--agent', 'review-009'], /^brief: fumi\/note-window has no agent review-009 — `engine agent dispatch` records one, and --agent names the id it answers$/);
    refusedUnissued(['closing-pass-reader', UNIT, TOPIC, '--agent', review.id], /^brief: review-001 is a review dispatch, and the closing-pass-reader's brief is for a closing-pass$/);
    refusedUnissued(['deep-dive', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', dive.id], /^brief: deep-dive-001 is incorporated — a brief is issued for a dispatch still in flight$/);
  });
});

describe('discussion\'s agents and templates (26.1, 26.5)', () => {
  it('each role is dispatched as a named agent whose definition is on the roster, fixing Opus at medium', () => {
    for (const role of DISCUSSION_ROLES) {
      const { agent } = ROLES[role];
      const definition = fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8');
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(definition)?.[1] ?? '';
      assert.deepStrictEqual([/^name: (.*)$/m.exec(frontmatter)?.[1], /^model: (.*)$/m.exec(frontmatter)?.[1], /^effort: (.*)$/m.exec(frontmatter)?.[1]], [agent, 'opus', 'medium'], role);
    }
  });

  it('no template names a model or an effort — the definitions hold them', () => {
    for (const role of DISCUSSION_ROLES) assert.doesNotMatch(template(role), /\bmodel\b|\beffort\b|\bopus\b/i, role);
  });
});
