'use strict';

// ---------------------------------------------------------------------------
// A question's wordings read as one line (workflow-engine/scripts/domain/
// ledger-fold.cjs, through every read and write that names a question): the
// live wordings of its chain in the ledger's order, a wording set aside
// dropping out, one whose predecessor is set aside rewording the nearest
// live one before it, the later of two rewordings of one wording replacing
// the earlier. At each step of each shape — rewordings set aside and back,
// a fork, a wording between set aside, two clones' rewordings merged — the
// map's one row and its answers, what is affected and by what, the product
// record's heading over each answer, and what a replacement records.
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

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
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

const { write, ask, change, read, entries, full, line, answered, assertAgree, reword, mint } = ledgerReadHelpers(() => dir);

/** A product-wide answer to `question` on the note window: its short id. @param {string} question @param {string} text */
function decide(question, text) {
  return write('decide', NOTE, ['--answers', question], { ...MADE, text, why: 'Furniture.', product_wide: true }).id;
}

/** A decision on space homing, for a merge to go into: its short id. */
function elsewhere() {
  const question = ask(SPACE, 'Does a note stay on its Space?');
  return write('decide', SPACE, ['--answers', question], { ...MADE, text: 'Notes float above every Space.', why: 'Furniture.' }).id;
}

/** What each affected entry is held against, and the wordings that changed it. */
function changes() {
  return Object.fromEntries(read('affected', UNIT).affected.map((/** @type {{id: string, changed: {held_against: string, replacements: {id: string}[]}[]}} */ e) => [
    e.id, e.changed.map((c) => [c.held_against, ids(c.replacements)]),
  ]));
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

/** The note window's map, what is affected, and the product record's headings. */
function state() {
  return { map: answered('note-window'), changes: changes(), headings: headings() };
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

/** `entry` confirmed to hold after `replacement`. @param {string} entry @param {string} replacement */
function hold(entry, replacement) {
  write('hold', NOTE, ['--entry', entry, '--after', replacement], MADE);
}

/** The question an answer's line records, by its short id. @param {string} answer */
function records(answer) {
  return line(answer).answers;
}

describe('a question\'s wordings, read as one line (5.8, 5.3.13, 5.6.10, 5.8.17)', () => {
  it('keeps a question answered by every answer to any wording, on one row and with no row of an answer\'s own, while the rewording an answer records is set aside; a replacement records the wording that stands and is held against the wordings after it on the line, after the nearest live one it grew from while it is set aside', () => {
    const question = ask(NOTE, ASKED);
    const sibling = decide(question, 'A note keeps its size.');
    const answer = decide(question, 'A panel.');
    const reworded = reword(MINT, question, 'What is a note in Mint?');
    const replacement = change(NOTE, answer, 'A frameless window.');
    const live = { map: [[reworded, 'answered', [sibling, replacement]]], changes: { [sibling]: [[question, [reworded]]] }, headings: headed('What is a note in Mint?', sibling, replacement) };
    assert.strictEqual(records(replacement), reworded);
    assert.deepStrictEqual(state(), live);

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(state(), { map: [[question, 'answered', [sibling, replacement]]], changes: {}, headings: headed(ASKED, sibling, replacement) });
    assert.deepStrictEqual(ids(read('since', UNIT, 'note-window').calls), [sibling, replacement]);
    assertAgree('note-window');
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(state(), live);

    ok(dir, ['workunit', 'cancel', 'mint']);
    const again = change(NOTE, replacement, 'A borderless window.');
    assert.strictEqual(records(again), question);
    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual(state(), {
      map: [[reworded, 'answered', [sibling, again]]],
      changes: { [sibling]: [[question, [reworded]]], [again]: [[question, [reworded]]] },
      headings: headed('What is a note in Mint?', sibling, again),
    });
  });

  it('flags an answer whose rewording is set aside by a new rewording of the wording it grew from, a confirmation clearing it; the set-aside rewording back, one row stands in the last wording, the earlier ones folded beneath it, and a replacement records it', () => {
    const question = ask(NOTE, ASKED);
    const answer = decide(question, 'A panel.');
    const reworded = reword(MINT, question, 'What is a note in Mint?');
    const replacement = change(NOTE, answer, 'A frameless window.');
    ok(dir, ['workunit', 'cancel', 'mint']);

    const drawn = reword(NOTE, question, 'What is a note, drawn?');

    assert.deepStrictEqual(state(), { map: [[drawn, 'answered', [replacement]]], changes: { [replacement]: [[reworded, [drawn]]] }, headings: headed('What is a note, drawn?', replacement) });
    hold(replacement, drawn);
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(state(), { map: [[drawn, 'answered', [replacement]]], changes: {}, headings: headed('What is a note, drawn?', replacement) });
    assert.deepStrictEqual(recorded(), [[drawn], [reworded, question]]);
    assert.strictEqual(records(change(NOTE, replacement, 'A borderless window.')), drawn);
  });

  it('reads two rewordings of one wording as one line, the later replacing the earlier: one row with every answer, each answer held against the wordings after the one it records or grew from, the earlier refused as no longer current; the later set aside, the earlier stands, and an answer to the later is held against it', () => {
    const question = ask(NOTE, ASKED);
    const first = decide(question, 'A panel.');
    const inMint = reword(MINT, question, 'What is a note in Mint?');
    const mintAnswer = decide(inMint, 'A Mint panel.');
    ok(dir, ['workunit', 'cancel', 'mint']);
    const inSage = reword(SAGE, question, 'What is a note in Sage?');
    const sageAnswer = decide(inSage, 'A Sage window.');
    const answers = [first, mintAnswer, sageAnswer];
    assert.deepStrictEqual(state(), {
      map: [[inSage, 'answered', answers]], changes: { [first]: [[question, [inSage]]], [mintAnswer]: [[inMint, [inSage]]] }, headings: headed('What is a note in Sage?', ...answers),
    });

    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual(state(), {
      map: [[inSage, 'answered', answers]], changes: { [first]: [[question, [inMint, inSage]]], [mintAnswer]: [[inMint, [inSage]]] }, headings: headed('What is a note in Sage?', ...answers),
    });
    assert.deepStrictEqual(recorded(), [[inSage], [inMint, question]]);
    assert.strictEqual(refusedAnswer(inMint), `ledger decide --answers names ${inMint}, which ${inSage} replaced — the current one is ${inSage}`);
    const replacement = change(NOTE, first, 'A frameless panel.');
    assert.strictEqual(records(replacement), inSage);

    ok(dir, ['workunit', 'cancel', 'sage']);

    const standing = [mintAnswer, sageAnswer, replacement];
    assert.deepStrictEqual(state(), {
      map: [[inMint, 'answered', standing]], changes: { [sageAnswer]: [[inSage, [inMint]]], [replacement]: [[inSage, [inMint]]] }, headings: headed('What is a note in Mint?', ...standing),
    });
    write('merge', NOTE, ['--question', inMint, '--into', elsewhere(), '--duplicate', sageAnswer], MADE);
  });

  it('stands where the first wording of its line was made: the first wording set aside with its topic, the question stands where the earlier of two rewordings was made, in the later\'s wording, which shows where it was made as standing elsewhere', () => {
    const question = ask(NOTE, ASKED);
    const inMint = reword(MINT, question, 'What is a note in Mint?');
    ok(dir, ['workunit', 'cancel', 'mint']);
    const inSage = reword(SAGE, question, 'What is a note in Sage?');
    ok(dir, ['workunit', 'reactivate', 'mint']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    const rows = (/** @type {string} */ unit) => read('map', unit, unit).questions.map((/** @type {{id: string, stands: string, stands_in: object|null}} */ r) => [r.id, r.stands, r.stands_in]);
    assert.deepStrictEqual([rows('mint'), rows('sage')], [[[inSage, 'open', null]], [[inSage, 'elsewhere', { unit: 'mint', topic: 'mint' }]]]);
    assert.deepStrictEqual(ids(read('record', 'mint', 'mint').questions[0].replaced), [inMint]);
  });

  it('reads a wording whose own predecessor is set aside as rewording the nearest live one before it: the first wording is an earlier one, never a row of its own, its answers held against the wording after it, and a replacement records the wording that stands', () => {
    const question = ask(NOTE, ASKED);
    const first = decide(question, 'A panel.');
    const middle = reword(MINT, question, 'What is a note in Mint?');
    const last = reword(SAGE, middle, 'What is a note, in either?');
    const answer = decide(last, 'A window.');

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(state(), { map: [[last, 'answered', [first, answer]]], changes: { [first]: [[question, [last]]] }, headings: headed('What is a note, in either?', first, answer) });
    assert.deepStrictEqual(recorded(), [[last], [question]]);
    assert.strictEqual(refusedAnswer(question), `ledger decide --answers names ${question}, which ${last} replaced — the current one is ${last}`);
    const replacement = change(NOTE, answer, 'A frameless window.');
    assert.strictEqual(records(replacement), last);
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(state(), {
      map: [[last, 'answered', [first, replacement]]], changes: { [first]: [[question, [middle, last]]] }, headings: headed('What is a note, in either?', first, replacement),
    });
  });

  it('shows no row of the first wording, open or answered, once a rewording of a rewording set aside stands on its own topic, and a replacement records that one', () => {
    const question = ask(NOTE, ASKED);
    const reworded = reword(MINT, question, 'What is a note in Mint?');
    const again = reword(NOTE, reworded, 'What is a note, in either?');
    const answer = decide(again, 'A panel.');

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(state(), { map: [[again, 'answered', [answer]]], changes: {}, headings: headed('What is a note, in either?', answer) });
    assert.strictEqual(records(change(NOTE, answer, 'A frameless panel.')), again);
  });

  it('reads two clones\' rewordings of one wording, as a merge lays them — the remote\'s, then this clone\'s own — as one line: the one laid last stands, on one row with every answer, each held against the wordings after its own', () => {
    const question = ask(NOTE, ASKED);
    const first = decide(question, 'A panel.');
    const remote = reword(NOTE, question, 'What is a note on the laptop?');
    const remoteAnswer = decide(remote, 'A laptop panel.');
    const laid = (/** @type {string} */ like, /** @type {Record<string, unknown>} */ fields) => {
      const { v, id, at, ...event } = /** @type {Record<string, unknown>} */ (entries().find((e) => e.id === full(like)));
      const entry = appendEntry(statePath(dir), { ...event, ...fields }, []);
      return shortId(/** @type {string} */ (entry.id), entries().map((e) => e.id));
    };
    const own = laid(remote, { text: 'What is a note on the desktop?', replaces: full(question) });
    const ownAnswer = laid(remoteAnswer, { text: 'A desktop window.', answers: full(own) });
    const into = elsewhere();

    const answers = [first, remoteAnswer, ownAnswer];
    assert.deepStrictEqual(state(), {
      map: [[own, 'answered', answers]], changes: { [first]: [[question, [remote, own]]], [remoteAnswer]: [[remote, [own]]] }, headings: headed('What is a note on the desktop?', ...answers),
    });
    assert.strictEqual(records(change(NOTE, first, 'A frameless panel.')), own);
    write('merge', NOTE, ['--question', own, '--into', into, '--duplicate', remoteAnswer], MADE);
  });
});
