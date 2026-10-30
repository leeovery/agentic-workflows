'use strict';

// ---------------------------------------------------------------------------
// A question's wordings read as one line (leeway-engine/scripts/domain/
// ledger-fold.cjs, through every read and write that names a question): the
// live wordings of its chain in the ledger's order, a wording set aside
// dropping out, one whose predecessor is set aside rewording the nearest
// live one before it, the later of two rewordings of one wording replacing
// the earlier; an answer recording a wording set aside read as recording the
// nearest live wording it grew from, the whole line where none is.
// - A fork, its rewordings set aside and back: the map's one row and its
//   answers, what is affected and a confirmation clearing it, the product
//   record's heading over each answer, a refusal, what a replacement
//   records, and where the question stands.
// - A wording between set aside, and a first wording set aside with its
//   unit: each question's row, what is affected, a refusal before the unit
//   is cancelled and after, and what a replacement records.
// - A walk down several set-aside wordings, past a fork, to a line set aside
//   whole: what is affected, and what a replacement records.
// - Two clones' rewordings laid by a merge: the map's one row, what is
//   affected, what a replacement records, and a merge across the two.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there, and two features, mint
// and sage, whose rewordings are set aside and brought back.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, refuses, statePath, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, ids, ledgerWorld, ledgerReadHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { shortId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { PRODUCT_FILE } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));

const MINT = 'mint.discussion.mint';
const SAGE = 'sage.discussion.sage';
const ASKED = 'What is a note?';

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-wordings-');
  mint();
  createManifest(dir, 'sage', { work_type: 'feature', phases: { discussion: { items: { sage: { status: 'in-progress' } } } } });
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ask, decide, change, read, entries, full, line, answered, assertAgree, changeFromSpec, reword, mint } = ledgerReadHelpers(() => dir);

/** A product-wide answer to `question` on the note window: its short id. @param {string} question @param {string} text */
function productWide(question, text) {
  return write('decide', NOTE, ['--answers', question], { ...MADE, text, why: 'Furniture.', product_wide: true }).id;
}

/** What each affected entry is held against, and the wordings that changed it. */
function changes() {
  return Object.fromEntries(read('affected', UNIT).affected.map((/** @type {{id: string, changed: {held_against: string, replacements: {id: string}[]}[]}} */ e) => [
    e.id, e.changed.map((c) => [c.held_against, ids(c.replacements)]),
  ]));
}

/** The note window's map, and what is affected. */
function state() {
  return { map: answered('note-window'), changes: changes() };
}

/** The question each answer is headed by in the product record's file, by the answer's short id. */
function headings() {
  const sections = fs.readFileSync(statePath(dir, PRODUCT_FILE), 'utf8').split(/^## /m).slice(1);
  return Object.fromEntries(sections.flatMap((section) => [...section.matchAll(/Entry (\w+)\.$/gm)].map((m) => [m[1], section.split('\n')[0]])));
}

/** `text` heading each of `answers`. @param {string} text @param {...string} answers */
function headed(text, ...answers) {
  return Object.fromEntries(answers.map((answer) => [answer, text]));
}

/** The ids of the note window's questions, and of what is folded beneath its first. */
function recorded() {
  const { questions } = read('record', UNIT, 'note-window');
  return [ids(questions), ids(questions[0].replaced)];
}

/** Why a decision naming `wording` is refused. @param {string} wording */
function refusedAnswer(wording) {
  return refuses(dir, ['ledger', 'decide', NOTE, '--answers', wording], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'A sheet.', why: 'Furniture.' }) }).error;
}

/** The question an answer's line records, by its short id. @param {string} answer */
function records(answer) {
  return line(answer).answers;
}

describe('a question\'s wordings, read as one line (5.8.20, 5.3.13, 5.6.10, 5.8.17)', () => {
  it('keeps a question answered by every answer to any wording, on one row in the last live wording: a rewording set aside drops out, an answer recording it read as recording the wording it grew from; two rewordings of one wording fork the line, the later replacing the earlier, each answer held against the wordings after the one it records — a confirmation after the last clearing it, set aside or back — and a replacement recording the last; and the question stands where the first live wording was made', () => {
    const question = ask(NOTE, ASKED);
    const first = productWide(question, 'A panel.');
    const inMint = reword(MINT, question, 'What is a note in Mint?');
    const mintAnswer = productWide(inMint, 'A Mint panel.');

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(state(), { map: [[question, 'answered', [first, mintAnswer]]], changes: {} });
    assert.deepStrictEqual(headings(), headed(ASKED, first, mintAnswer));
    assert.deepStrictEqual(ids(read('since', UNIT, 'note-window').calls), [first, mintAnswer]);
    assertAgree('note-window');

    const inSage = reword(SAGE, question, 'What is a note in Sage?');
    const sageAnswer = productWide(inSage, 'A Sage window.');
    const answers = [first, mintAnswer, sageAnswer];
    assert.deepStrictEqual(state(), { map: [[inSage, 'answered', answers]], changes: { [first]: [[question, [inSage]]], [mintAnswer]: [[inMint, [inSage]]] } });
    write('hold', NOTE, ['--entry', mintAnswer, '--after', inSage], MADE);
    assert.deepStrictEqual(changes(), { [first]: [[question, [inSage]]] });

    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual(state(), { map: [[inSage, 'answered', answers]], changes: { [first]: [[question, [inMint, inSage]]] } });
    assert.deepStrictEqual(headings(), headed('What is a note in Sage?', ...answers));
    assert.deepStrictEqual(recorded(), [[inSage], [inMint, question]]);
    assert.strictEqual(refusedAnswer(inMint), `ledger decide --answers names ${inMint}, which ${inSage} replaced — the current one is ${inSage}`);
    const replacement = change(NOTE, first, 'A frameless panel.');
    assert.strictEqual(records(replacement), inSage);

    ok(dir, ['workunit', 'cancel', 'sage']);

    assert.deepStrictEqual(state(), {
      map: [[inMint, 'answered', [mintAnswer, sageAnswer, replacement]]], changes: { [sageAnswer]: [[inSage, [inMint]]], [replacement]: [[inSage, [inMint]]] },
    });

    ok(dir, ['workunit', 'reactivate', 'sage']);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    const rows = (/** @type {string} */ unit) => read('map', unit, unit).questions.map((/** @type {{id: string, stands: string, stands_in: object|null}} */ r) => [r.id, r.stands, r.stands_in]);
    assert.deepStrictEqual([rows('mint'), rows('sage')], [[[inSage, 'open', null]], [[inSage, 'elsewhere', { unit: 'mint', topic: 'mint' }]]]);
    assert.deepStrictEqual(ids(read('record', 'mint', 'mint').questions[0].replaced), [inMint]);
  });

  it('reads a wording whose own predecessor is set aside as rewording the nearest live one before it, and an answer recording a wording set aside as recording the nearest live wording it grew from, down its own chain, or the whole line where none is: one row each, answered, each answer held against the wordings after that one alone, a decision naming an earlier wording refused for the next one on the line, and a replacement records the last', () => {
    const question = ask(NOTE, ASKED);
    const middle = reword(MINT, question, 'What is a note in Mint?');
    const last = reword(NOTE, middle, 'What is a note, in either?');
    const tail = reword(MINT, last, 'What is a note in Mint, again?');
    const answer = decide(NOTE, tail, 'A window.');
    const card = ask(MINT, 'What is a Mint card?');
    const replacement = change(NOTE, decide(MINT, card, 'A card is a sheet.'), 'A card is a panel.');
    const reworded = reword(NOTE, card, 'What is a card?');
    const refused = (/** @type {string} */ next, /** @type {string} */ standing) => `ledger decide --answers names ${question}, which ${next} replaced — the current one is ${standing}`;
    assert.strictEqual(refusedAnswer(question), refused(middle, tail));

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(state(), { map: [[last, 'answered', [answer]], [reworded, 'answered', [replacement]]], changes: { [replacement]: [[card, [reworded]]] } });
    assert.deepStrictEqual(recorded(), [[last, reworded], [question]]);
    assert.deepStrictEqual([refusedAnswer(question), records(replacement), records(change(NOTE, answer, 'A frameless window.'))], [refused(last, last), card, last]);
  });

  it('holds an answer whose recorded wording is set aside against the wordings after the nearest live one it grew from, however many steps down its own chain, or, where none is, against the whole line, a fork laid before it included; a replacement records the last, or, every wording set aside, the wording the answer it replaces named', () => {
    const question = ask(NOTE, ASKED);
    const inSage = reword(SAGE, question, 'What is a note in Sage?');
    ok(dir, ['workunit', 'cancel', 'sage']);
    const inMint = reword(MINT, question, 'What is a note in Mint?');
    const again = reword(MINT, inMint, 'What is a note in Mint, again?');
    const answer = decide(`${UNIT}.specification`, again, 'A panel.');
    ok(dir, ['workunit', 'reactivate', 'sage']);

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(changes(), { [answer]: [[again, [inSage]]] });
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(changes(), { [answer]: [[again, [inSage]]] });
    const replacement = changeFromSpec(answer, { text: 'A frameless panel.', why: 'Furniture.' });
    assert.strictEqual(records(replacement), inSage);
    ok(dir, ['workunit', 'cancel', 'sage']);
    assert.deepStrictEqual(changes(), {});
    assert.strictEqual(records(changeFromSpec(replacement, { text: 'A borderless panel.', why: 'Furniture.' })), inSage);
  });

  it('reads two clones\' rewordings of one wording, as a merge lays them — the remote\'s, then this clone\'s own — as one line: the one laid last stands, on one row with every answer, each held against the wordings after its own; a replacement records it, and a merge of it takes a duplicate answering the other', () => {
    const question = ask(NOTE, ASKED);
    const first = decide(NOTE, question, 'A panel.');
    const remote = reword(NOTE, question, 'What is a note on the laptop?');
    const remoteAnswer = decide(NOTE, remote, 'A laptop panel.');
    const laid = (/** @type {string} */ like, /** @type {Record<string, unknown>} */ fields) => {
      const { v, id, at, ...event } = /** @type {Record<string, unknown>} */ (entries().find((e) => e.id === full(like)));
      const entry = appendEntry(statePath(dir), { ...event, ...fields }, []);
      return shortId(/** @type {string} */ (entry.id), entries().map((e) => e.id));
    };
    const own = laid(remote, { text: 'What is a note on the desktop?', replaces: full(question) });
    const ownAnswer = laid(remoteAnswer, { text: 'A desktop window.', answers: full(own) });

    assert.deepStrictEqual(state(), {
      map: [[own, 'answered', [first, remoteAnswer, ownAnswer]]], changes: { [first]: [[question, [remote, own]]], [remoteAnswer]: [[remote, [own]]] },
    });
    assert.strictEqual(records(change(NOTE, first, 'A frameless panel.')), own);
    const elsewhere = decide(SPACE, ask(SPACE, 'Does a note stay on its Space?'), 'Notes float above every Space.');
    write('merge', NOTE, ['--question', own, '--into', elsewhere, '--duplicate', remoteAnswer], MADE);
  });
});
