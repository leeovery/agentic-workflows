'use strict';

// ---------------------------------------------------------------------------
// The ledger's read verbs (workflow-engine/scripts/domain/ledger-read.cjs)
// and the fold they read through (domain/ledger-fold.cjs): `engine ledger
// record|map|product`, each a projection of the ledger answered as JSON —
// the current entries standing in a unit or a topic, each where the
// earliest entry of its chain in a live place was made, with the live
// answers it replaced folded beneath it and the confirmations that it still
// holds, its moves as history, its merges each with its duplicate and
// whether it holds, and the current entries standing elsewhere that it
// relies on, that a merge that holds went into, or that answer its
// questions, read from their own lines; a topic's questions, where each
// stands now and its answers, which its record shows too, a question moved
// in or away shown by a live move the map's own unit made alone; the entries
// marked product-wide. Siblings stand apart; a reworded question keeps its
// answers and its parts; a merged duplicate is no second entry; a finished
// unit stays finished when a later one replaces its decision; of merges
// crossing each other, the later holds, whichever entry is read first. A
// ledger past the 64 MiB a pipe holds is read without being held: each read
// answers under a heap a reader holding its lines cannot fit in.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ENGINE, ok, refuses, stateGit, statePath, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER, validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const {
  ID_FACTS, foldLedger, isCurrent, currentsOf, mergeHolds,
} = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { liveness } = require(path.join(SCRIPTS, 'domain/ledger-units.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));

const {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, MENU, HEAP_MB, PHASES, ids, ledgerReadHelpers,
} = require('./ledger-read-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-read-');
  createManifest(dir, UNIT, { work_type: 'epic', phases: PHASES });
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ask, find, decide, change, read, rawLines, events, full, line, current, shownMerge, answered, assertAgree, changeFromSpec, reword, menuBar, mint, dock, moves } = ledgerReadHelpers(() => dir);

describe('a record (5.6.5, 5.8.4)', () => {
  it('shows a decision replaced through `ledger replace` with "a changed mind" by the replacement, the decision folded beneath it, its line byte for byte unchanged (2.S11, 5.S8)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A near-frameless floating note.');
    const before = rawLines();

    const replacement = change(NOTE, old, 'A frameless surface.');

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the replacement edited a line before it');
    assert.deepStrictEqual([events().at(-1).event, events().at(-1).replaces, events().at(-1).reason], ['replaced', full(old), 'changed-mind']);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record, {
      ok: true, unit: UNIT, topic: 'note-window', live: true,
      questions: [current(question)], findings: [], decisions: [current(replacement, [old])], moved: [], merged: [], other_topics: [],
    });
  });

  it('shows a chain three deep with the current answer first and the answers it replaced beneath it, newest first and oldest last', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const first = decide(NOTE, question, 'A window.');
    const second = change(NOTE, first, 'A panel.');
    const third = change(NOTE, second, 'A frameless surface.');

    const { decisions } = read('record', UNIT, 'note-window');

    assert.deepStrictEqual(decisions, [current(third, [second, first])]);
    assert.deepStrictEqual([decisions[0].text, ...decisions[0].replaced.map((/** @type {{text: string}} */ e) => e.text)], ['A frameless surface.', 'A panel.', 'A window.']);
  });

  it('keeps siblings apart (5.3.13): one answer replaced leaves the other current, and the question\'s current answer is the untouched sibling and the replacement', () => {
    const question = ask(NOTE, 'How does a note look?');
    const frame = decide(NOTE, question, 'Near-frameless.');
    const hover = decide(NOTE, question, 'Its controls appear on hover.');

    const reframed = change(NOTE, frame, 'Frameless.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(hover), current(reframed, [frame])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([rowShown.stands, rowShown.answers.map((/** @type {{id: string}} */ a) => a.id)], ['answered', [hover, reframed]]);
  });

  it('shows each confirmation that an entry still holds beneath the entry it confirms (5.6.5)', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const relying = find(NOTE, 'A window takes focus.', ['--relies-on', old]);
    const replacement = change(NOTE, old, 'A panel.');

    const confirmed = write('hold', NOTE, ['--entry', relying, '--after', replacement], MADE).id;

    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);
    assert.strictEqual(line(confirmed).after, replacement);
  });

  it('shows another topic\'s current answer it relies on from that topic\'s own entry, and the new one once it is replaced (5.S20)', () => {
    const theirs = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person.');
    const ours = decide(NOTE, ask(NOTE, 'Does a note float?'), 'Notes float above every Space.', ['--relies-on', theirs]);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').other_topics, [{ ...line(theirs), named: [theirs] }]);

    const replaced = change(SPACE, theirs, 'A note follows the person, on every display.');

    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(record.other_topics, [{ ...line(replaced), named: [theirs] }]);
    assert.deepStrictEqual(record.decisions, [current(ours)], 'the record restated the other topic\'s answer');
  });

  it('shows a question moved to another topic in the old topic\'s record and on the new topic\'s map (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    assert.deepStrictEqual([events().at(-1).event, events().at(-1).question, events().at(-1).to], ['moved', full(question), 'space-homing']);
    const old = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([old.moved, old.questions], [[{ ...line(moved), text: 'Which Space does a new note open on?' }], []]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(question)]);
    const [movedIn] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([movedIn.id, movedIn.stands, movedIn.moved_from], [question, 'open', 'note-window']);
    const [movedAway] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([movedAway.id, movedAway.stands, movedAway.moved_to], [question, 'moved-away', 'space-homing']);
  });

  it('reads a unit\'s every current entry, its topics\' and those made at its level, the replaced ones only beneath what replaced them', () => {
    const asked = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, asked, 'A window.');
    const replacement = change(NOTE, old, 'A panel.');
    const elsewhere = ask(SPACE, 'Where does a note open?');
    const unitLevel = ask(`${UNIT}.specification`, 'Does the spec cover a second display?');

    const record = read('record', UNIT);

    assert.deepStrictEqual([record.topic, record.live, ids(record.questions), record.decisions], [null, true, [asked, elsewhere, unitLevel], [current(replacement, [old])]]);
    assert.deepStrictEqual(record.questions.map((/** @type {{topic: string|null}} */ q) => q.topic), ['note-window', 'space-homing', null]);
  });

  it('tags an entry with the unit whose session wrote it, and a session in a later unit reads that unit\'s entries directly (5.S28)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const question = write('ask', NOTE, [], { ...MADE, text: 'Is a note a window?' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A panel.', why: 'It floats.' }, { CLAUDE_CODE_SESSION_ID: 'fumi-session' }).id;
    assert.deepStrictEqual(events().map((e) => [e.unit, e.session]), [[UNIT, 'fumi-session'], [UNIT, 'fumi-session']]);

    write('ask', 'mint.discussion.mint', [], { ...MADE, text: 'Does Mint import Fumi\'s notes?' }, { CLAUDE_CODE_SESSION_ID: 'mint-session' });
    const fromMint = ok(dir, ['ledger', 'record', UNIT], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } });

    assert.deepStrictEqual([ids(fromMint.questions), fromMint.decisions], [[question], [current(decided)]]);
    assert.deepStrictEqual(ok(dir, ['ledger', 'record', UNIT, 'note-window'], { env: { CLAUDE_CODE_SESSION_ID: 'mint-session' } }).decisions, [current(decided)]);
  });

  it('leaves both replacements of one entry current where two clones each replaced it, each with the entry beneath it', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const old = decide(NOTE, question, 'A window.');
    const here = change(NOTE, old, 'A panel.');
    const fields = /** @type {Record<string, any>} */ (events().find((e) => e.id === full(here)));
    const { v: _v, id: _id, at: _at, ...replacement } = fields;
    const there = /** @type {string} */ (appendEntry(statePath(dir), { ...replacement, session: 'other-clone', text: 'A sheet.' }, []).id).slice(0, 6);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(here, [old]), current(there, [old])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [here, there]);
    const refusal = refuses(dir, ['ledger', 'replace', NOTE, '--replaces', old, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${old}, which ${here} replaced — the current ones are ${here}, ${there}$`));
  });
});

describe('a topic\'s map (5.8.5)', () => {
  it('shows each question with where it stands, who asked it, and its current answers with whose they are', () => {
    const open = ask(NOTE, 'Does a note snap to the grid?');
    const answered = write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Is a note a window?' }).id;
    const answer = decide(NOTE, answered, 'A panel.', [], { by: 'person' });

    const map = read('map', UNIT, 'note-window');

    assert.deepStrictEqual(map.questions, [
      { id: open, text: 'Does a note snap to the grid?', by: 'claude', at: line(open).at, stands: 'open', moved_from: null, moved_to: null, part_of: null, parts: [], answers: [] },
      {
        id: answered, text: 'Is a note a window?', by: 'person', at: line(answered).at, stands: 'answered', moved_from: null, moved_to: null, part_of: null, parts: [],
        answers: [{ id: answer, unit: UNIT, topic: 'note-window', by: 'person', text: 'A panel.' }],
      },
    ]);
    assert.deepStrictEqual([map.unit, map.topic, map.live], [UNIT, 'note-window', true]);
  });

  it('puts the unsettled part of a question an answer settles in part on the map as its own question, linked to the first (5.S15)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    decide(NOTE, whole, 'It looks frameless.');

    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.part_of, r.parts]), [
      [whole, 'answered', null, [part]],
      [part, 'open', whole, []],
    ]);
  });

  it('keeps one entry, the owner\'s, unchanged, where another topic reaches the same decision, and shows that topic\'s question answered by it (5.S17)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const before = rawLines();

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners], MADE).id;

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the merge edited a line before it');
    assert.deepStrictEqual(events().filter((e) => e.event === 'decided' || e.event === 'replaced').map((e) => e.id), [full(owners)], 'the ledger holds a second decision');
    const [rowShown] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([rowShown.id, rowShown.stands, rowShown.answers], [reached, 'merged', [{ id: owners, unit: UNIT, topic: 'note-window', by: 'claude', text: 'Notes float above every Space.' }]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[], [shownMerge(merged, null, true)], [{ ...line(owners), named: [reached, owners] }]]);
    assertAgree('space-homing');
  });

  it('takes a duplicate merged where it is found out of the current entries, so its question stands answered by the owner\'s entry alone, and no write names it as current (5.5.4, 5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;

    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged], [[], [shownMerge(merged, duplicate, true)]], 'the merge does not show the duplicate it set aside');
    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [owners]);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', duplicate, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${duplicate}, which ${merged} merged as a duplicate — the current one is ${owners}$`));
  });

  it('follows the entry a question was merged into down its chain to the current one', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const replaced = change(NOTE, owners, 'Notes float above every Space and display.');

    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [replaced]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replaced), named: [reached, owners] }]);
  });

  it('keeps a reworded question\'s answers: a decision naming any earlier wording answers the current one, beside one naming it (5.3.13)', () => {
    const first = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, first, 'A panel.', [], { product_wide: true });

    const reworded = reword(NOTE, first, 'Is a note a window or a panel?');

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided]]]);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.decisions], [[current(reworded, [first])], [current(decided)]]);
    assert.deepStrictEqual(read('product').decisions, [current(decided)]);
    const later = decide(NOTE, reworded, 'A panel, on every display.');
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided, later]]]);
    assertAgree('note-window');
  });

  it('keeps a reworded question merged: it stands answered by the entry an earlier wording was merged into (5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const reworded = reword(SPACE, reached, 'Does a note stay on the Space it opened on?');

    assert.deepStrictEqual(answered('space-homing'), [[reworded, 'merged', [owners]]]);
    assertAgree('space-homing');
  });

  it('lists a reworded question\'s parts, each shown part of the question\'s current wording (5.3.11)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const reworded = reword(NOTE, whole, 'How does a note look, behave and sound?');
    const later = ask(NOTE, 'How does a note sound?', ['--part-of', reworded]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.part_of, r.parts]), [
      [part, reworded, []],
      [reworded, null, [part, later]],
      [later, reworded, []],
    ]);
  });
});

describe('where an entry stands (5.3.3, 5.8.4)', () => {
  it('keeps a decision replaced from the spec on its topic\'s record and map, the replacement current with the decision beneath it, and once on the unit\'s record', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = changeFromSpec(decided, { text: 'A sheet.', why: 'Sheets stack.' });

    assert.strictEqual(line(replacement).topic, null);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rowShown.answers, [{ id: replacement, unit: UNIT, topic: null, by: 'claude', text: 'A sheet.' }]);
    assert.deepStrictEqual(read('record', UNIT).decisions, [current(replacement, [decided])]);
    assertAgree('note-window');
  });

  it('keeps another unit\'s replacement of a topic\'s decision on that topic\'s record and map, where its chain stands, and off the replacing unit\'s record (5.6.1)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = change('mint.discussion.mint', decided, 'A sheet.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers, [{ id: replacement, unit: 'mint', topic: 'mint', by: 'claude', text: 'A sheet.' }]);
    assert.deepStrictEqual(read('record', 'mint').decisions, []);
    assertAgree('note-window');
  });

  it('leaves a finished unit finished when a later unit replaces its decision: its entries stay current until replaced, and its record shows the new answer with the old beneath it (5.S10)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', decided]);
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);
    const finished = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([finished.questions, finished.findings, finished.decisions], [[current(question)], [current(relying)], [current(decided)]]);

    const minted = change('mint.discussion.mint', decided, 'A sheet.');

    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, UNIT, 'manifest.json'), 'utf8')).status, 'completed', 'the replacement reopened the finished unit');
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.findings, record.decisions], [[current(question)], [current(relying)], [current(minted, [decided])]]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [minted]]]);
    assertAgree('note-window');
  });

  it('keeps a question reworded from the spec on its topic\'s map and record, the old wording beneath it', () => {
    const first = ask(NOTE, 'Is a note a window?');

    const reworded = changeFromSpec(first, { text: 'Is a note a window or a panel?' });

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'open', []]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(ids(read('record', UNIT).questions), [reworded]);
  });

  it('shows a question moved after it was answered with its answer on the topic it moved to, read from the answer\'s own line where it was given (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const decided = decide(NOTE, question, 'The active one.');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    const there = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([there.questions, there.decisions, there.other_topics], [[current(question)], [], [{ ...line(decided), named: [question] }]]);
    assert.deepStrictEqual(answered('space-homing'), [[question, 'answered', [decided]]]);
    const here = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([here.questions, here.decisions, ids(here.moved)], [[], [current(decided)], [moved]]);
    assertAgree('space-homing');
    assertAgree('note-window');
  });

  it('moves a reworded question whole: its every wording stands where it moved, and the old topic\'s map shows it moved away', () => {
    const first = ask(NOTE, 'Which Space does a new note open on?');
    const reworded = reword(NOTE, first, 'Which Space, on which display, does a new note open on?');

    write('move', NOTE, ['--question', reworded, '--to', 'space-homing'], MADE);

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, []);
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'moved-away', []]]);
  });

  it('leads a question moved away to its current wording and the topic it stands on now, however often it moved on', () => {
    menuBar();
    const first = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', first, '--to', 'space-homing'], MADE);
    const reworded = reword(SPACE, first, 'Which Space, on which display, does a new note open on?');

    write('move', SPACE, ['--question', reworded, '--to', 'menu-bar'], MADE);

    const away = (/** @type {string} */ topic) => read('map', UNIT, topic).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.moved_to]);
    assert.deepStrictEqual([away('note-window'), away('space-homing')], [[[reworded, 'moved-away', 'menu-bar']], [[reworded, 'moved-away', 'menu-bar']]]);
    assert.deepStrictEqual(answered('menu-bar'), [[reworded, 'open', []]]);
  });
});

describe('a question moved, as its map shows it now (5.3.3, 5.8.5)', () => {
  it('shows no move another unit made: a question one unit moved and another reworded stands, while the first is cancelled, where the rewording was made, moved from nowhere', () => {
    mint();
    const question = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    const reworded = reword('mint.discussion.mint', question, 'Which Space, on which display, does a new note open on?');
    assert.deepStrictEqual([moves(UNIT, 'note-window'), moves(UNIT, 'space-homing'), moves('mint', 'mint')], [
      [[reworded, 'moved-away', null, 'space-homing']], [[reworded, 'open', 'note-window', null]], [],
    ]);

    ok(dir, ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual(moves('mint', 'mint'), [[reworded, 'open', null, null]]);
  });

  it('leads a question moved away only to a topic of the unit it stands in: another unit\'s move, made while the question stood there, shows on no map once it stands where it was asked again — the first unit\'s topic of the same name\'s included — and on its record as history', () => {
    dock();
    const question = ask(NOTE, 'Does a note show on the dock?');
    const reworded = reword('dock.discussion.space-homing', question, 'Does a note badge the dock icon?');
    ok(dir, ['workunit', 'cancel', UNIT]);
    const moved = write('move', 'dock.discussion.space-homing', ['--question', reworded, '--to', 'badge'], MADE).id;
    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge')], [[[reworded, 'moved-away', null, 'badge']], [[reworded, 'open', 'space-homing', null]]]);

    ok(dir, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge'), moves(UNIT, 'note-window'), moves(UNIT, 'space-homing')], [[], [], [[reworded, 'open', null, null]], []]);
    assert.deepStrictEqual(read('record', 'dock', 'space-homing').moved, [{ ...line(moved), text: 'Does a note badge the dock icon?' }]);
  });

  it('shows no row for a question moved to a topic set aside, the topic it moved from keeping the move on its record as history alone, until the topic it moved to is reactivated', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);

    assert.deepStrictEqual(moves(UNIT, 'note-window'), []);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').moved, [{ ...line(moved), text: 'Which Space does a new note open on?' }]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(moves(UNIT, 'note-window'), [[question, 'moved-away', null, 'space-homing']]);
  });

  it('places a question where the last move its unit made of it took it, a move outliving the topic it was made from: it stands there, set aside with that topic alone, and names where it moved from while that is live', () => {
    menuBar();
    const once = ask(NOTE, 'Does a note snap to the grid?');
    write('move', NOTE, ['--question', once, '--to', 'space-homing'], MADE);
    const twice = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', twice, '--to', 'space-homing'], MADE);
    write('move', SPACE, ['--question', twice, '--to', 'menu-bar'], MADE);
    const maps = () => ['note-window', 'space-homing', 'menu-bar'].map((topic) => moves(UNIT, topic));
    assert.deepStrictEqual(maps(), [
      [[once, 'moved-away', null, 'space-homing'], [twice, 'moved-away', null, 'menu-bar']],
      [[once, 'open', 'note-window', null], [twice, 'moved-away', null, 'menu-bar']],
      [[twice, 'open', 'space-homing', null]],
    ]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(maps(), [[], [[once, 'open', null, null], [twice, 'moved-away', null, 'menu-bar']], [[twice, 'open', 'space-homing', null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(maps(), [[[twice, 'moved-away', null, 'menu-bar']], [], [[twice, 'open', null, null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    assert.deepStrictEqual(maps(), [[[once, 'moved-away', null, 'space-homing']], [[once, 'open', 'note-window', null]], []]);
  });
});

describe('merges crossing each other (5.5.5)', () => {
  /**
   * Two questions on two topics, each answered there, the first moved to the
   * menu bar and merged into the second's answer, its own answer the
   * duplicate; the menu bar cancelled, so the second is merged the other way
   * while the first merge is set aside; the menu bar reactivated.
   */
  function crossed() {
    menuBar();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    write('move', NOTE, ['--question', first, '--to', 'menu-bar'], MADE);
    const earlier = write('merge', MENU, ['--question', first, '--into', stays, '--duplicate', floats], MADE).id;
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    const later = write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE).id;
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'menu-bar']);
    return { first, floats, second, stays, earlier, later };
  }

  it('lets the later merge hold and the earlier not, so the decision the later went into stays current, through a reactivate of the earlier', () => {
    const { first, floats, second, stays, earlier, later } = crossed();

    assert.deepStrictEqual([answered('menu-bar'), answered('space-homing')], [[[first, 'answered', [floats]]], [[second, 'merged', [floats]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(floats)]);
    const space = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([space.decisions, space.merged, space.other_topics], [[], [shownMerge(later, stays, true)], [{ ...line(floats), named: [second, floats] }]]);
    const menu = read('record', UNIT, 'menu-bar');
    assert.deepStrictEqual([menu.merged, menu.other_topics], [[shownMerge(earlier, floats, false)], [{ ...line(floats), named: [first] }]],
      'the record tied the entry a merge that does not hold went into');
    for (const topic of ['note-window', 'space-homing', 'menu-bar']) assertAgree(topic);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', stays, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${stays}, which ${later} merged as a duplicate — the current one is ${floats}$`));
    change(NOTE, floats, 'Notes float above every Space and display.');
  });

  it('works out which merge holds the same whichever entry or merge is read first', () => {
    const { floats, stays, earlier, later } = crossed();
    const facts = foldLedger(statePath(dir), ID_FACTS, []);
    const asked = [floats, stays, earlier, later].map(full);
    /** Each asked id's answers from a fresh read, the ids asked in `order`. @param {string[]} order */
    const readIn = (order) => {
      const folded = { facts, live: liveness(statePath(dir)) };
      const answers = new Map(order.map((id) => [id, [isCurrent(folded, id), currentsOf(folded, id), mergeHolds(folded, id)]]));
      return asked.map((id) => answers.get(id));
    };

    const forwards = readIn(asked);
    assert.deepStrictEqual(readIn([...asked].reverse()), forwards);
    assert.deepStrictEqual(readIn([asked[3], asked[1], asked[0], asked[2]]), forwards);
    assert.deepStrictEqual(forwards.map(([current_, currents, holds]) => [current_, currents, holds]), [
      [true, [full(floats)], false], [false, [full(floats)], false], [false, [], false], [false, [], true],
    ]);
  });

  it('takes a later merge whose entry leads on only through an earlier merge once the earlier is taken', () => {
    menuBar();
    const settled = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, settled, 'Notes float above every Space.');
    write('move', NOTE, ['--question', settled, '--to', 'menu-bar'], MADE);
    const owners = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person, floating.');
    const reached = ask(MENU, 'Does a note stay on its Space?');
    const stays = decide(MENU, reached, 'Notes float, and never stay.');
    write('merge', MENU, ['--question', settled, '--into', owners, '--duplicate', floats], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    write('merge', MENU, ['--question', reached, '--into', floats, '--duplicate', stays], MADE);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    assert.deepStrictEqual(answered('menu-bar'), [[settled, 'merged', [owners]], [reached, 'merged', [owners]]]);
    assert.deepStrictEqual(read('record', UNIT, 'menu-bar').decisions, []);
    assertAgree('menu-bar');
  });

  it('lets the later merge hold where the earlier set aside another unit\'s replacement, that unit cancelled while the later was made and reactivated since', () => {
    mint();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float.');
    const minted = change('mint.discussion.mint', floats, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    const earlier = write('merge', NOTE, ['--question', first, '--into', stays, '--duplicate', minted], MADE).id;
    ok(dir, ['workunit', 'cancel', 'mint']);
    write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').merged, [shownMerge(earlier, null, true)], 'a merge showed a duplicate that is not live');

    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual([answered('note-window'), answered('space-homing')], [[[first, 'answered', [minted]]], [[second, 'merged', [minted]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(minted, [floats])]);
    assertAgree('note-window');
    assertAgree('space-homing');
  });
});

describe('the product record (5.8.6)', () => {
  it('holds every current entry marked product-wide, from every unit and topic, each with the answers it replaced beneath it', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const finding = find(NOTE, 'Notes sync through iCloud.', [], { product_wide: true });
    find(NOTE, 'A spike floated a panel.');
    const old = decide(SPACE, ask(SPACE, 'Is Fumi a menu-bar app?'), 'Fumi lives in the menu bar.', [], { product_wide: true });
    const replaced = change(SPACE, old, 'Fumi lives in the menu bar and the dock.');
    const minted = decide('mint.discussion.mint', ask('mint.discussion.mint', 'Is Mint free?'), 'Mint is free.', [], { product_wide: true });

    const product = read('product');

    assert.deepStrictEqual(product, { ok: true, findings: [current(finding)], decisions: [current(replaced, [old]), current(minted)] });
    assert.strictEqual(line(replaced).product_wide, true, 'the replacement did not keep the mark');
  });
});

describe('a large ledger (5.7.6, 5.7.8)', () => {
  /**
   * `args` run by the engine in a process of its own, its heap held to
   * `HEAP_MB`: what it answered, or how it died.
   * @param {string[]} args
   */
  function underHeap(args) {
    const res = spawnSync(process.execPath, [`--max-old-space-size=${HEAP_MB}`, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 24 });
    return { status: res.status, signal: res.signal, out: res.status === 0 ? JSON.parse(res.stdout) : null, err: res.stderr.slice(0, 400) };
  }

  it('reads a ledger past the 64 MiB a pipe holds without holding it: each read answers under a heap that a reader holding its lines cannot fit in', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.', [], { product_wide: true });
    const file = statePath(dir, LEDGER);
    const fd = fs.openSync(file, 'a');
    let size = fs.statSync(file).size;
    try {
      while (size <= READ_BUDGET_BYTES) {
        const bulk = `${JSON.stringify(validEvent({
          v: 1, id: newId(), event: 'found', unit: UNIT, topic: 'space-homing', phase: 'discussion', session: SESSION_ID, at: '2026-10-27T09:00:00Z',
          ...MADE, text: 'x'.repeat(2000), how: 'measured', relies_on: [], product_wide: false,
        }))}\n`;
        fs.writeSync(fd, bulk);
        size += Buffer.byteLength(bulk);
      }
    } finally {
      fs.closeSync(fd);
    }
    stateGit(dir, ['add', LEDGER]);
    stateGit(dir, ['commit', '-q', '-m', 'state: a long ledger']);

    const record = underHeap([ENGINE, 'ledger', 'record', UNIT, 'note-window']);
    const map = underHeap([ENGINE, 'ledger', 'map', UNIT, 'note-window']);
    const product = underHeap([ENGINE, 'ledger', 'product']);
    const affected = underHeap([ENGINE, 'ledger', 'affected', UNIT]);
    const since = underHeap([ENGINE, 'ledger', 'since', UNIT, 'note-window']);
    const verdicts = underHeap([ENGINE, 'ledger', 'verdicts']);

    for (const [name, res] of Object.entries({ record, map, product, affected, since, verdicts })) assert.strictEqual(res.status, 0, `${name} did not answer under ${HEAP_MB} MB: ${res.signal} ${res.err}`);
    assert.deepStrictEqual([ids(record.out.questions), ids(record.out.decisions)], [[question], [decided]]);
    assert.deepStrictEqual(ids(map.out.questions), [question]);
    assert.deepStrictEqual([ids(product.out.decisions), product.out.findings], [[decided], []]);
    assert.deepStrictEqual([affected.out.affected, ids(since.out.calls), verdicts.out.departures], [[], [decided], []]);
    const holding = underHeap(['-e', `const lines = []; for (const l of require('fs').readFileSync(${JSON.stringify(file)}, 'utf8').split('\\n')) lines.push(l); console.log('{}')`]);
    assert.notStrictEqual(holding.status, 0, `a reader holding the ledger's lines fit in ${HEAP_MB} MB, so the heap proves nothing`);
  });
});

describe('refusals', () => {
  it('refuses a read naming no unit, a unit there is none of, a topic the unit does not have, or anything but its places', () => {
    assert.match(refuses(dir, ['ledger', 'record']).error, /^Usage: engine ledger record <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT]).error, /^Usage: engine ledger map <work-unit> <topic>$/);
    assert.match(refuses(dir, ['ledger', 'product', UNIT]).error, /^Usage: engine ledger product$/);
    assert.match(refuses(dir, ['ledger', 'record', UNIT, '--topic', 'note-window']).error, /^Usage: engine ledger record /);
    assert.match(refuses(dir, ['ledger', 'record', 'mint']).error, /^ledger record: there is no work unit "mint"$/);
    assert.match(refuses(dir, ['ledger', 'map', UNIT, 'menu-bar']).error, /^ledger map: fumi has no topic "menu-bar"$/);
  });

  it('answers a ledger with no entries yet with nothing current', () => {
    assert.deepStrictEqual(read('record', UNIT, 'note-window'), {
      ok: true, unit: UNIT, topic: 'note-window', live: true, questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [],
    });
    assert.deepStrictEqual(read('product'), { ok: true, findings: [], decisions: [] });
  });
});
