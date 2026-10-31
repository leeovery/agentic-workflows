'use strict';

// ---------------------------------------------------------------------------
// Discussion's briefs (leeway-engine/scripts/domain/brief.cjs, the records
// domain/brief-records.cjs, the templates content/briefs/): `engine brief
// <role> <unit> <topic> [--question <id>] [--kind <kind> [--path <file>]]
// [--agent <id>]` for the deep dive, the perspective, the synthesis, the
// discussion reviewer and the closing-pass reader, each named for its topic
// on its first line, its record saying whose it is; its slots filled from
// the ledger's reads and the topic's agent store, never the conversation
// (9.8.13, 13.11.1, 26.1.5): the topic's record and the product record as
// their read verbs answer them — the product record for the topic, drawn
// where what discovery found is all it holds (9.3.12) — the log's path,
// each other live topic's record and none of a topic set aside (5.8.17,
// 5.S40), the open question by any wording — its dispatch bound to it, and
// a synthesis briefed on its pair's — a dive's kind and a read's file,
// whether a gap review has run since the topic's last decision (9.9.6), the
// dispatch's report, a perspective's lens and a synthesis's perspectives
// verbatim. The plain search, `engine brief plain-search`, is briefed from
// the conversation's last knowledge query alone (22.6.10). Every refusal
// stores no brief. The templates carry no tie-break, no cap, and no model
// or effort, which each role's agent's definition fixes (its roster is
// test-engine-brief.cjs's); the perspective's definition names the engine's
// polarity pairs, the deep dive's its kinds, the closing-pass reader's its
// product lane.
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
const { ok, callAsync, refusedPristine, statePath, layout, writeState, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, MADE, NOTE, SPACE, MENU, row, writtenWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { DIVE_KINDS } = require(path.join(SCRIPTS, 'domain/brief-records.cjs'));
const { POLARITY_PAIRS } = require(path.join(SCRIPTS, 'domain/lenses.cjs'));
const { keepQuery } = require(path.join(SCRIPTS, 'domain/knowledge/last-query.cjs'));
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
  const before = stored();
  const { error } = refusedPristine(dir, ['brief', ...args], { env: SESSION });
  assert.match(error, pattern);
  assert.deepStrictEqual(stored(), before);
}

/** A deep dive's brief arguments, on the open question. @param {string} id @param {string[]} flags */
const diveArgs = (id, ...flags) => ['deep-dive', UNIT, TOPIC, '--question', WORLD.made.open, '--agent', id, ...flags];

/** A perspective's brief arguments. @param {string} id @param {string} question */
const perspectiveArgs = (id, question) => ['perspective', UNIT, TOPIC, '--question', question, '--agent', id];

/** The record of whose a brief is. @param {string} id */
const issuedRecord = (id) => JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, id), 'utf8'));

describe('9.S40: the deep dive\'s brief (9.1.5)', () => {
  it('named for its topic, the open question in its current wording, its kind, the topic\'s record as `ledger record` answers it — each answer with what it replaced — the product record as `ledger product` answers it, and the dispatch\'s report; its record naming the topic', () => {
    const dive = dispatch('deep-dive');

    const { res, brief } = issued(diveArgs(dive.id, '--kind', 'survey'));

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'deep-dive', agent: 'leeway-deep-dive', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the deep dive's, for ${UNIT} topic ${TOPIC}\n\n${filledTemplate('deep-dive', {
      question: `${WORLD.made.open}: ${OPEN_TEXT}`,
      'dive-kind': 'survey',
      'topic-record': readJson(['record', UNIT, TOPIC]),
      'product-record': readJson(['product', UNIT, TOPIC]),
      'report-to': `\`${dive.file}\``,
    })}`);
    assert.ok(section(brief, 'This topic\'s record').includes('"text": "A window."'), 'the replaced answer is folded beneath the answer that replaced it (9.2.5)');
    assert.deepStrictEqual(issuedRecord(res.id), { role: 'deep-dive', agent: 'leeway-deep-dive', unit: UNIT, task: null, topic: TOPIC });
  });

  it('a question named by an earlier wording is drawn in its current one', () => {
    const reworded = write('replace', NOTE, ['--replaces', WORLD.made.open, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Which Space opens a new note?' }).id;
    const dive = dispatch('deep-dive');

    const { brief } = issued(diveArgs(dive.id, '--kind', 'survey'));

    assert.strictEqual(section(brief, 'Your question'), `${reworded}: Which Space opens a new note?`);
  });

  it('9.3.12: the product record drawn for the topic holds what discovery found where the record holds nothing else — of the product as a whole, and of the topic', () => {
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    const read = write('find', 'product.discovery', [], { ...MADE, text: 'Notes are kept in Core Data.', how: 'read Store/Notes.swift', known: 'read' }).id;
    const spiked = write('find', `${UNIT}.discovery.${TOPIC}`, [], { ...MADE, text: 'A panel can float over full-screen apps.', how: 'spiked a panel', known: 'spike' }).id;
    const dive = dispatch('deep-dive');

    const slot = section(issued(diveArgs(dive.id, '--kind', 'survey')).brief, 'The product record');

    const { findings, decisions, discovery } = JSON.parse(slot.slice('```json\n'.length, -'\n```'.length));
    assert.deepStrictEqual([findings, decisions, discovery.map((/** @type {{id: string}} */ e) => e.id)], [[], [], [read, spiked]]);
  });

  it('a read names the file it reads, by its path, and no other kind names one; a kind that is none, or none given, refused', () => {
    const dive = dispatch('deep-dive');
    fs.writeFileSync(path.join(dir, 'NOTES.md'), '# Notes\n');

    refusedUnissued(diveArgs(dive.id, '--kind', 'read'), /^brief: a read dive names the file it reads — --path <file>$/);
    refusedUnissued(diveArgs(dive.id, '--kind', 'read', '--path', 'GONE.md'), /^brief: --path names no file — .*GONE\.md$/);
    refusedUnissued(diveArgs(dive.id, '--kind', 'survey', '--path', 'NOTES.md'), /^brief: --path names the file a read dive reads, and a survey dive reads none$/);
    refusedUnissued(diveArgs(dive.id, '--kind', 'guess'), /^brief: "guess" is no kind of dive — --kind takes survey, read, feasibility, landscape, verify$/);
    refusedUnissued(diveArgs(dive.id), /^Usage: /);

    assert.strictEqual(section(issued(diveArgs(dive.id, '--kind', 'read', '--path', 'NOTES.md')).brief, 'Your kind of dive'), `read — \`${path.join(dir, 'NOTES.md')}\``);
  });
});

describe('the perspective\'s and the synthesis\'s briefs', () => {
  /** A pair dispatched and each lens briefed on `question`: the pair. @param {string} question @param {string[]} [lenses] */
  function briefedPair(question, lenses = ['ship-now', 'strategic-timing']) {
    const pair = dispatch('perspective', lenses.flatMap((lens) => ['--label', lens]));
    for (const { id } of pair.agents) issued(perspectiveArgs(id, question));
    return pair;
  }

  /** A pair's reports written and read, and its synthesis dispatched: the synthesis. @param {{set: string, agents: {file: string}[]}} pair @param {string[]} reports */
  function synthesised(pair, reports) {
    pair.agents.forEach(({ file }, i) => fs.writeFileSync(file, reports[i]));
    ok(dir, ['agent', 'scan', UNIT, 'discussion', TOPIC]);
    return dispatch('synthesis', ['--set', pair.set]);
  }

  it('each lens of a pair briefed with its own label', () => {
    const pair = dispatch('perspective', ['--label', 'ship-now', '--label', 'strategic-timing']);

    const lenses = pair.agents.map((/** @type {{id: string}} */ { id }) => section(issued(perspectiveArgs(id, WORLD.made.open)).brief, 'Your lens'));

    assert.deepStrictEqual(lenses, ['`ship-now`', '`strategic-timing`']);
  });

  it('a synthesis is briefed on the question its pair was briefed on, in its current wording, with its set\'s perspectives verbatim, in the order they were dispatched, and nothing of another set', () => {
    const pair = briefedPair(WORLD.made.open);
    const other = dispatch('perspective', ['--label', 'common-path', '--label', 'tail-risk']);
    for (const { file } of other.agents) fs.writeFileSync(file, '# Perspective: Common Path\n\nThe usual case.\n');
    const reworded = write('replace', NOTE, ['--replaces', WORLD.made.open, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Which Space opens a new note?' }).id;
    const synthesis = synthesised(pair, ['# Perspective: Ship Now\n\nShip it.\n', '# Perspective: Strategic Timing\n\nWait for 2.0.\n\n']);

    const { res, brief } = issued(['synthesis', UNIT, TOPIC, '--agent', synthesis.id]);

    assert.strictEqual(brief.split('\n')[0], `Brief ${res.id} — the synthesis's, for ${UNIT} topic ${TOPIC}`);
    assert.strictEqual(section(brief, 'The decision'), `${reworded}: Which Space opens a new note?`);
    assert.ok(brief.includes('\n# The perspectives\n\n# Perspective: Ship Now\n\nShip it.\n\n# Perspective: Strategic Timing\n\nWait for 2.0.\n\n# This topic\'s record\n'), brief);
  });

  it('a synthesis refused where a perspective of its set has no report, was briefed on no question, or the two were briefed on different questions, or on one no longer current; a perspective refused another question than it was first briefed on', () => {
    const other = write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Does a note follow the cursor?' }).id;
    const reportless = briefedPair(WORLD.made.open);
    fs.writeFileSync(reportless.agents[0].file, '# Perspective: Ship Now\n');
    ok(dir, ['agent', 'scan', UNIT, 'discussion', TOPIC]);
    ok(dir, ['agent', 'incorporate', UNIT, 'discussion', TOPIC, reportless.agents[1].id]);
    const unbriefed = dispatch('perspective', ['--label', 'common-path', '--label', 'tail-risk']);
    const split = dispatch('perspective', ['--label', 'classifier', '--label', 'emergence']);
    issued(perspectiveArgs(split.agents[0].id, WORLD.made.open));
    issued(perspectiveArgs(split.agents[1].id, other));

    refusedUnissued(perspectiveArgs(split.agents[0].id, other), /^brief: perspective-003-classifier was briefed on another question — a dispatch argues the one question it was first briefed on$/);
    refusedUnissued(['synthesis', UNIT, TOPIC, '--agent', dispatch('synthesis', ['--set', reportless.set]).id], /^brief: perspective-001-strategic-timing's report, .*, is not written — a synthesis reads every perspective of its set$/);
    refusedUnissued(['synthesis', UNIT, TOPIC, '--agent', synthesised(unbriefed, ['# A\n', '# B\n']).id], /^brief: perspective-002-common-path was briefed on no question — each perspective of a set is briefed before its synthesis$/);
    refusedUnissued(['synthesis', UNIT, TOPIC, '--agent', synthesised(split, ['# A\n', '# B\n']).id], /^brief: the perspectives of set 003 were briefed on different questions — a synthesis reconciles a pair argued on one$/);
    const gone = synthesised(briefedPair(other, ['direct-fix', 'systems-thinker']), ['# A\n', '# B\n']);
    write('move', NOTE, ['--question', other, '--to', 'menu-bar'], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    refusedUnissued(['synthesis', UNIT, TOPIC, '--agent', gone.id], /^brief: the question set 004 argued is no longer current$/);
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
      'product-record': readJson(['product', UNIT, TOPIC]),
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

describe('22.S23: the plain search\'s brief (22.6.10, 22.6.17)', () => {
  /** A knowledge query run in the conversation: its answer. @param {string[]} args */
  const query = (args) => callAsync(dir, ['knowledge', 'query', ...args], { env: SESSION });

  it('the conversation\'s last knowledge query — its terms, its filters, and what it returned — and nothing of a unit, a topic or the ledger', async () => {
    await query(['menu', 'bar']);
    const ran = await query(['note', 'window', '--phase', 'discussion', '--boost:topic', TOPIC]);

    const { res, brief } = issued(['plain-search']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'plain-search', agent: 'leeway-plain-search', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the plain search's\n\n# The knowledge query you follow\n\nTerms: \`note\` \`window\`\nFilters: \`--phase discussion\`, \`--boost:topic ${TOPIC}\`\n\nIt returned:\n\n\`\`\`\n${ran.stdout.replace(/\n+$/, '')}\n\`\`\`\n`);
    assert.deepStrictEqual(issuedRecord(res.id), { role: 'plain-search', agent: 'leeway-plain-search', unit: null, task: null, topic: null });
  });

  it('a query that failed is drawn with why, one that never finished as such; a conversation that has run none refuses the brief', async () => {
    refusedUnissued(['plain-search'], /^brief: this conversation has run no knowledge query — a plain search follows the `engine knowledge query` it carries on from$/);
    refusedUnissued(['plain-search', UNIT, TOPIC], /^Usage: /);

    await query(['  ']);
    const failed = section(issued(['plain-search']).brief, 'The knowledge query you follow');
    keepQuery(SESSION_ID, ['note'], []);
    const unfinished = section(issued(['plain-search']).brief, 'The knowledge query you follow');

    assert.deepStrictEqual([failed, unfinished], [
      'Terms: `  `\nFilters: none\n\nIt failed: Empty search term. `engine knowledge query` requires at least one non-empty positional term. If you intended to list everything indexed, use `node .claude/skills/leeway-engine/scripts/engine.cjs knowledge status` instead.',
      'Terms: `note`\nFilters: none\n\nIt never finished.',
    ]);
  });
});

describe('the refusals, no brief stored', () => {
  it('a unit or a topic the project lacks, and a topic set aside', () => {
    refusedUnissued(['discussion-reviewer', 'nope', TOPIC, '--agent', 'review-001'], /^Work unit "nope" not found$/);
    refusedUnissued(['discussion-reviewer', UNIT, 'tray', '--agent', 'review-001'], /^brief: fumi has no topic "tray"$/);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', TOPIC]);
    refusedUnissued(['discussion-reviewer', UNIT, TOPIC, '--agent', 'review-001'], /^brief: fumi\/note-window is set aside — its topic, note-window, is cancelled$/);
  });

  it('a question that is none, is no longer current, stands on another topic, or no ledger entry\'s id begins', () => {
    const dive = dispatch('deep-dive');
    write('move', NOTE, ['--question', WORLD.made.open, '--to', 'menu-bar'], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    /** @param {string} question */
    const asking = (question) => ['deep-dive', UNIT, TOPIC, '--question', question, '--kind', 'survey', '--agent', dive.id];

    refusedUnissued(asking(WORLD.made.open), /^brief: question \w+ is no longer current$/);
    refusedUnissued(asking(WORLD.made.measured), /^brief: \w+ names no question — --question takes a question on fumi\/note-window's map$/);
    refusedUnissued(asking(WORLD.made.homing), /^brief: question \w+ stands on fumi\/space-homing, not fumi\/note-window$/);
    refusedUnissued(asking('zzzz'), /^no ledger entry's id begins "zzzz"$/);
  });

  it('a deep dive or a perspective refuses a question no longer open', () => {
    const dive = dispatch('deep-dive');
    const pair = dispatch('perspective', ['--label', 'ship-now', '--label', 'strategic-timing']);
    write('decide', NOTE, ['--answers', WORLD.made.open], { by: 'person', who_moved_whom: 'none', text: 'The current Space.', why: 'Where they are.' });

    refusedUnissued(diveArgs(dive.id, '--kind', 'survey'), /^brief: question \w+ is answered — a deep dive or a perspective is briefed on an open question$/);
    refusedUnissued(perspectiveArgs(pair.agents[0].id, WORLD.made.open), /^brief: question \w+ is answered — a deep dive or a perspective is briefed on an open question$/);
  });

  it('a dispatch the topic\'s store lacks, of another kind than the role is briefed for, or no longer in flight', () => {
    const review = dispatch('review');
    const dive = dispatch('deep-dive');
    ok(dir, ['agent', 'incorporate', UNIT, 'discussion', TOPIC, dive.id]);

    refusedUnissued(['discussion-reviewer', UNIT, TOPIC, '--agent', 'review-009'], /^brief: fumi\/note-window has no agent review-009 — `engine agent dispatch` records one, and --agent names the id it answers$/);
    refusedUnissued(['closing-pass-reader', UNIT, TOPIC, '--agent', review.id], /^brief: review-001 is a review dispatch, and the closing-pass-reader's brief is for a closing-pass$/);
    refusedUnissued(diveArgs(dive.id, '--kind', 'survey'), /^brief: deep-dive-001 is incorporated — a brief is issued for a dispatch still in flight$/);
  });
});

describe('discussion\'s agents and templates (26.1, 26.5)', () => {
  it('no template names a model or an effort — the definitions hold them', () => {
    for (const role of DISCUSSION_ROLES) assert.doesNotMatch(template(role), /\bmodel\b|\beffort\b|\bopus\b/i, role);
  });

  it('the perspective\'s definition names the polarity pairs the engine holds, each lens beside its counter-lens', () => {
    const definition = fs.readFileSync(path.join(AGENTS, 'leeway-discussion-perspective.md'), 'utf8');

    const named = [...definition.matchAll(/^\| [^|]+ \(`([a-z-]+)`\) \| [^|]+ \(`([a-z-]+)`\) \|/gm)].map(([, lens, counter]) => [lens, counter]);

    assert.deepStrictEqual(named, POLARITY_PAIRS.map((pair) => [...pair]));
  });

  it('the deep dive\'s definition names each kind of dive the brief takes', () => {
    const definition = fs.readFileSync(path.join(AGENTS, 'leeway-deep-dive.md'), 'utf8');

    assert.deepStrictEqual([...definition.matchAll(/^- \*\*([a-z]+)\*\* — /gm)].map(([, kind]) => kind), [...DIVE_KINDS]);
  });

  it('the closing-pass reader marks a line for the product record as a lane of its own', () => {
    const definition = fs.readFileSync(path.join(AGENTS, 'leeway-closing-pass-reader.md'), 'utf8');

    assert.deepStrictEqual([...definition.matchAll(/^- \*\*`([a-z]+)`\*\* — /gm)].map(([, lane]) => lane), ['apply', 'call', 'route', 'product']);
  });
});
