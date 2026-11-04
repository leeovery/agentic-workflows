'use strict';

// ---------------------------------------------------------------------------
// The notes a fix task's builder banks (leeway-engine/scripts/domain/
// review-phase.cjs, review-round.cjs, review-entry.cjs; `task note`,
// notes.cjs): a fix phase has no consolidation, so the review phase answers
// each, as it answers a reader's note — out of scope, filed or dropped by
// Claude's call, listed in the round's report (14.3.5). A note no phase's
// report took and no round answered stands: the entry names it, `notes#{k}`,
// with the notes' file; the next round recorded answers it among its items,
// of the area `notes`; where the round that ended the phase made the fix
// task, `engine review notes <unit> --file <notes.json>` answers it once
// that round's fix tasks are done, its findings joining that round's record
// and report; and finish's checklist holds the review open, naming each
// note, until every one is answered.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const {
  UNIT, EVERY, useWorld, env, enter, payload, reported, recorded, refusedRound, fixPhaseWritten, fixBuilt, secondRoundReady, firstRoundFailed,
  reviewCall, filed, stateText, lastStateCommit, writeState, statePath, ok, refusedPristine, assert,
} = require('./review-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });

/** A note for later banked by `task note`, as a builder banks one: its number. @param {string} text */
const banked = (text) => ok(dir, ['task', 'note', UNIT, '--file', payload('note.md', text)], { env: env() }).number;

/** The entry's DATA lines that open on `key`. @param {string} key */
const linesOf = (key) => enter().sections.split('\n').filter((line) => line.startsWith(`${key}: `));

/** A builder's note answered out of scope, filed by Claude's call: the finding. @param {string} item @param {string} title */
function filedNote(item, title) {
  const call = reviewCall(`Filed: ${title}.`, 'It lies beside the change.');
  const { filed: inbox } = filed({ kind: 'bug', text: `# ${title}\n\nA builder met it.`, call });
  return { area: 'notes', scope: 'out', call: 'bug', text: `${title}.`, from: [item], inbox, ledger: call };
}

/** `review notes`, which must succeed: its response. @param {object} answers */
const answered = (answers) => ok(dir, ['review', 'notes', UNIT, '--file', payload('notes.json', answers)], { env: env() });

/** `review notes` refused, nothing written: its error. @param {object} answers */
const refusedNotes = (answers) => refusedPristine(dir, ['review', 'notes', UNIT, '--file', payload('notes.json', answers)], { env: env() }).error;

/** Finish's review item, as its checklist shows it. */
const reviewItem = () => {
  const [item] = ok(dir, ['checklist', 'show', 'finish', UNIT], { env: env() }).items;
  return `${item.state}${item.way === undefined ? '' : ` — ${item.way}`}`;
};

/** Round 1, entered, recorded passing on a nit its fix task 3.1 fixes, the task built and done. */
function passedOnAFix() {
  reported(1, EVERY, { '2-refunds-a': ['nit: A refund\'s label is terse.'] });
  fixPhaseWritten(3, [['Word the label', '§2.1']]);
  recorded({ can_now: ['Pay by card.'], findings: [{ area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-a#1'], fix: '3.1' }] });
  fixBuilt(3, 1, 'Word the label', 'main', 'src/label.js');
}

describe('the notes a fix task\'s builder banks, answered by the review phase (14.3.5)', () => {
  it('review notes names the next round\'s way on while the round before\'s fix tasks wait, its round answering the notes once it opens', () => {
    firstRoundFailed();
    banked('The export skips refunds, at src/export.js.');

    assert.strictEqual(refusedNotes({ findings: [] }), 'review notes: round 2 is read once every fix task of round 1 is done — task 3.1 not started');
  });

  it('a note banked in a fix phase is an item of the next round, notes#{k}, named by the entry with the notes\' file — one a phase\'s consolidation took is not — answered out of scope by a finding of the area notes, and listed in the round\'s report', () => {
    banked('The cut\'s own note.');
    writeState(dir, `${UNIT}/build/phases/phase-2/consolidation.md`, '# Consolidation\n\n## The notes\n\n- Note 1: dropped — the code settled it\n');
    secondRoundReady();
    const note = banked('The export skips refunds, at src/export.js.');
    const lines = [...linesOf('builder note'), ...linesOf('notes')];
    const unanswered = refusedRound({ can_now: [], findings: [] });
    const finding = filedNote(`notes#${note}`, 'Export skips refunds');
    const inScope = refusedRound({ can_now: [], findings: [{ ...finding, scope: 'in', fix: '4.1', inbox: undefined, ledger: undefined }] });
    const wrongArea = refusedRound({ can_now: [], findings: [{ ...finding, area: '3-reports' }] });
    const notesArea = refusedRound({ can_now: [], findings: [finding, { ...finding, from: ['1-cards-a#1'] }] });
    const res = recorded({ can_now: [], findings: [finding] });

    assert.deepStrictEqual(lines, [`builder note: notes#${note}`, `notes: ${statePath(dir, `${UNIT}/build/notes.md`)}`]);
    assert.strictEqual(unanswered, `review round: notes#${note} is answered by no finding — every item of every report lands in the round's record (14.3.1)`);
    assert.match(inScope, /finding 1 answers a note for later, which lies beyond the change — its scope is out, and it is filed or dropped, never fixed/);
    assert.strictEqual(wrongArea, 'review round: finding 1 is of "3-reports", which the round does not read — it reads 1-cards; a finding answering builders\' notes alone is of notes');
    assert.ok(notesArea.includes('finding 2 is of "notes", which the round does not read — it reads 1-cards;'), notesArea);
    assert.strictEqual(res.round, 2);
    assert.ok(stateText(`${UNIT}/review/round-2.md`).includes('Export skips refunds (bug)'));
    assert.deepStrictEqual(linesOf('builder note'), []);
  });

  it('where the round that ended the phase made the fix task, its builder\'s note holds finish open, named, until review notes answers it — its finding joining that round\'s record and report — refused while a round is under review, while the fix tasks wait, and where none stands', () => {
    enter();
    const underReview = refusedNotes({ findings: [] });
    passedOnAFix();
    const note = banked('The ledger export skips refunds, at src/export.js.');
    const round = enter().sections.split('\n').find((line) => line.startsWith('round: '));
    const open = reviewItem();
    const drop = reviewCall('Dropped: the export\'s refunds.', 'The export is rewritten next month.');
    const res = answered({ findings: [{ area: 'notes', scope: 'out', call: 'nit', text: 'The export skips refunds.', from: [`notes#${note}`], drop: 'The export is rewritten next month.', ledger: drop }] });
    const commit = lastStateCommit();

    assert.strictEqual(underReview, `review notes: round 1 is under review, and answers the builders' notes standing among its items — review round ${UNIT} --file <round.json>`);
    assert.strictEqual(round, 'round: the review phase passed in round 1 — the notes its fix tasks\' builders left are answered, then finish');
    assert.strictEqual(open, `open — ${UNIT}'s review phase passed in round 1 — the notes its fix tasks' builders left are answered, then finish: notes#${note} — review notes ${UNIT} --file <notes.json>`);
    assert.deepStrictEqual([res.round, res.answered], [1, [`notes#${note}`]]);
    assert.deepStrictEqual(JSON.parse(stateText(`${UNIT}/review/round-1.json`)).findings.map((/** @type {{from: string[]}} */ { from }) => from), [['2-refunds-a#1'], [`notes#${note}`]]);
    assert.deepStrictEqual(commit, { subject: `review(${UNIT}): round 1's builders' notes`, files: [`${UNIT}/review/round-1.json`, `${UNIT}/review/round-1.md`] });
    assert.strictEqual(reviewItem(), 'done');
    assert.strictEqual(refusedNotes({ findings: [] }), `review notes: no builder's note stands unanswered — ${UNIT}'s review phase passed in round 1, and finish is next`);
  });

  it('review notes is refused while the round that ended the phase waits on its fix tasks, and where the notes are not each answered once', () => {
    enter();
    reported(1, EVERY, { '2-refunds-a': ['nit: A refund\'s label is terse.'] });
    fixPhaseWritten(3, [['Word the label', '§2.1']]);
    recorded({ can_now: ['Pay by card.'], findings: [{ area: '2-refunds', scope: 'in', call: 'nit', text: 'A refund\'s label is terse.', from: ['2-refunds-a#1'], fix: '3.1' }] });
    const note = banked('The ledger export skips refunds, at src/export.js.');
    const waiting = refusedNotes({ findings: [] });
    fixBuilt(3, 1, 'Word the label', 'main', 'src/label.js');

    assert.strictEqual(waiting, `review notes: ${UNIT}'s review phase passed in round 1 — its fix tasks are built first, then the notes their builders left are answered: task 3.1 not started`);
    assert.strictEqual(refusedNotes({ findings: [] }), `review notes: notes#${note} is answered by no finding — every item of every report lands in the round's record (14.3.1)`);
  });
});
