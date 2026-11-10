'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's notes for later, answered at its close (R24;
// leeway-engine/scripts/domain/review-round.cjs's `quick-fix notes`,
// finish-checks.cjs, finish.cjs): a builder's note and a reviewer's, banked
// with `task note`, holding the close — its checklist's `notes-answered`
// open, naming each and the verb, and its screen refused — until each is
// filed to the inbox or dropped by Claude's call at its implementation, kept
// at `build/notes-answered.json` and committed; then the close standing,
// a filed note the build's log mentions holding no inbox item open.
// Refused: no note standing, a note left unanswered or answered in scope, a
// call made at another place, a unit that is no quick-fix, and a quick-fix
// whose review was asked for, which answers its notes instead — its
// `notes-answered` then applying no more. The review's own answer, `review
// notes`, is test-engine-review-builder-notes.cjs's.
//
// Layer: git. World: quick-fix-close-world.cjs — fixes 1.1 and 1.2 built
// and done — built once and copied. Each test's conversation keeps its
// records in a config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, stateGit, statePath, layout, writeState, readManifest, cleanupFixture,
} = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, checklistClosed } = require('./quick-fix-world.cjs');
const { world, closeHelpers } = require('./quick-fix-close-world.cjs');

let dir = ''; // the project
const {
  as, run, refused, record, screen, items,
} = closeHelpers(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

/** A payload file beside the project, outside its working tree. @param {string} name @param {unknown} content */
function payload(name, content) {
  const file = path.join(path.dirname(dir), name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

/** A note for later banked by `task note`, as a builder or a pair's note is: its number. @param {string} text */
const banked = (text) => run(['task', 'note', UNIT, '--file', payload('note.md', text)]).number;

/** Claude's file-or-drop call at `place`: its short id. @param {string} text @param {string} [place] */
function called(text, place = PLACE) {
  const { write } = ledgerHelpers(() => dir);
  const question = write('ask', place, [], { by: 'claude', who_moved_whom: 'none', text: 'Is this note filed or dropped?' }).id;
  return write('decide', place, ['--answers', question], { by: 'claude', who_moved_whom: 'none', text, why: 'It lies beside the change.' }).id;
}

/** A note answered by a finding filed to the inbox through `inbox file`: the finding. @param {string} item @param {string} title */
function filedNote(item, title) {
  const call = called(`Filed: ${title}.`);
  const { filed } = run(['inbox', 'file', UNIT, '--file', payload('item.json', { kind: 'idea', text: `# ${title}\n\nA builder met it.`, call })]);
  return { area: 'notes', scope: 'out', call: 'nit', text: `${title}.`, from: [item], inbox: filed, ledger: call };
}

/** A note answered by a finding dropped: the finding. @param {string} item @param {string} [place] */
const droppedNote = (item, place) => ({ area: 'notes', scope: 'out', call: 'nit', text: 'The man page could say it too.', from: [item], drop: 'The man page is generated from the help.', ledger: called('Dropped.', place) });

/** `quick-fix notes` refused, nothing written: its error. @param {object} answers */
const refusedNotes = (answers) => refused(['quick-fix', 'notes', UNIT, '--file', payload('notes.json', answers)]);

/** Finish's `notes-answered` item, as its checklist shows it, undefined where it does not apply. */
const notesItem = () => items().find((line) => line.startsWith('notes-answered'));

/** Both fixes recorded, a builder's note and a reviewer's banked. */
function notesBanked() {
  record(1);
  record(2);
  banked('The flag parser could warn on --color.\n');
  banked('The help could name the flag twice.\n');
}

describe('a quick-fix\'s notes for later, answered at its close (R24)', () => {
  it('holds the close while a note stands — its checklist\'s notes-answered open, naming each and the verb, and its screen refused — until each is filed to the inbox or dropped, kept and committed; then the close stands, the filed note the log mentions holding no inbox item open (6.4.10)', () => {
    dir = world();
    notesBanked();
    const open = [notesItem(), refused(['checklist', 'close', 'finish', UNIT]), refused(['render', 'finish', UNIT])];
    const filed = filedNote('notes#1', 'Warn on --color');
    const answered = run(['quick-fix', 'notes', UNIT, '--file', payload('notes.json', { findings: [filed, droppedNote('notes#2')] })]);
    const committed = stateGit(dir, ['log', '-1', '--format=%s']).trim();
    const kept = JSON.parse(fs.readFileSync(statePath(dir, layout.unit(UNIT, 'build/notes-answered.json')), 'utf8'));
    const way = `notes#1, notes#2 — each note for later is filed to the inbox or dropped before the close: quick-fix notes ${UNIT} --file <notes.json>`;
    writeState(dir, layout.unit(UNIT, 'build', 'log.md'), `# The fixes\n\nnotes#1 filed to the inbox, ${filed.inbox}.\n`);
    const inboxItem = items().find((line) => line.startsWith('inbox-closed'));
    checklistClosed(dir, as());

    assert.deepStrictEqual(open, [
      `notes-answered engine open — ${way}`,
      'checklist close: finish has items open: notes-answered, build-log-closed',
      `render finish: ${UNIT} closes once each note for later is filed to the inbox or dropped — notes#1, notes#2: quick-fix notes ${UNIT} --file <notes.json>`,
    ]);
    assert.deepStrictEqual([answered.answered, committed], [['notes#1', 'notes#2'], `quick-fix(${UNIT}): notes for later answered`]);
    assert.deepStrictEqual(kept.findings.map((/** @type {any} */ { from, inbox, drop }) => [from, inbox === undefined ? 'dropped' : 'filed', drop ?? null]), [
      [['notes#1'], 'filed', null], [['notes#2'], 'dropped', 'The man page is generated from the help.'],
    ]);
    assert.deepStrictEqual([notesItem(), inboxItem, fs.existsSync(filed.inbox), screen().includes('=== MENU: finish ')], ['notes-answered engine done', 'inbox-closed engine done', true, true]);
  });

  it('a note banked after the others were answered stands alone, answered on its own after them', () => {
    dir = world();
    notesBanked();
    run(['quick-fix', 'notes', UNIT, '--file', payload('notes.json', { findings: [droppedNote('notes#1'), droppedNote('notes#2')] })]);
    banked('The docs could link the help.\n');
    const later = notesItem();
    run(['quick-fix', 'notes', UNIT, '--file', payload('notes.json', { findings: [droppedNote('notes#3')] })]);

    assert.match(later, /^notes-answered engine open — notes#3 — /);
    assert.deepStrictEqual([notesItem(), JSON.parse(fs.readFileSync(statePath(dir, layout.unit(UNIT, 'build/notes-answered.json')), 'utf8')).findings.length], ['notes-answered engine done', 3]);
  });

  it('refuses no note standing, a note left unanswered, one answered in scope, a call made at another place and a unit that is no quick-fix, writing nothing', () => {
    dir = world();
    record(1);
    const none = refusedNotes({ findings: [] });
    banked('The flag parser could warn on --color.\n');
    banked('The help could name the flag twice.\n');
    const faults = [
      refusedNotes({ findings: [droppedNote('notes#1')] }),
      refusedNotes({ findings: [{ ...droppedNote('notes#1'), scope: 'in' }, droppedNote('notes#2')] }),
      refusedNotes({ findings: [droppedNote('notes#1', `${UNIT}.review`), droppedNote('notes#2')] }),
    ];
    const other = refused(['quick-fix', 'notes', 'nothing', '--file', payload('notes.json', { findings: [] })]);

    assert.strictEqual(none, `quick-fix notes: no note for later stands unanswered in ${UNIT}`);
    assert.match(faults[0], /^quick-fix notes: notes#2 is answered by no finding/);
    assert.match(faults[1], /^quick-fix notes: finding 1 answers a note for later, which lies beyond the change — its scope is out/);
    assert.match(faults[2], new RegExp(`^quick-fix notes: finding 1: \\S+ is no decision made at ${UNIT}\\.implementation — a file-or-drop call is Claude's, written there: ledger decide ${UNIT}\\.implementation`));
    assert.match(other, /^quick-fix notes: /);
  });

  it('with a review asked for, the review answers its notes: the verb refused, naming review notes, and notes-answered applying no more', () => {
    dir = world();
    notesBanked();
    const manifest = readManifest(dir, UNIT);
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, fixes: { ...manifest.fixes, review_asked: '2026-06-03T10:00:00Z' } }, null, 2));

    assert.strictEqual(refusedNotes({ findings: [droppedNote('notes#1'), droppedNote('notes#2')] }),
      `quick-fix notes: ${UNIT}'s review was asked for at its close, and answers its notes for later — review notes ${UNIT} --file <notes.json>`);
    assert.strictEqual(notesItem(), undefined);
  });
});
