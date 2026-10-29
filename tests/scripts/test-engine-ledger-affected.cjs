'use strict';

// ---------------------------------------------------------------------------
// What a replacement affects (workflow-engine/scripts/domain/ledger-affected.cjs),
// `engine ledger affected`, read through the ledger's fold
// (domain/ledger-fold.cjs): every current question, finding and decision
// relying on an entry whose way to its current form passes a live
// replacement — one written after it, or one set aside as it was written
// that has come back — and every answer to a question reworded since it
// was written, which a merge or a move of the question never flags; each
// entry it is held against cleared on its own by a live "still holds"
// naming the latest replacement on that way, and flagged again by a later
// one; leaving the list on its own replacement; a chain
// passing on through replacements alone, and past a merge that holds, which
// a confirmation follows too; in a unit under way, waiting on the topic it
// stands on, however closed; in a finished unit, flagged in the work that
// made the change and never reopening it.
//
// Real repositories in temp folders, each with its state worktree, the work
// units' manifests written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, refuses, refusedPristine, statePath, layout, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, ledgerWorld, ledgerHelpers, ledgerReadHelpers } = require('./ledger-world.cjs');

const MINT = 'mint.discussion.mint';

/** @type {string} */
let dir;
/** The question each place's decisions answer, asked once a test. @type {Map<string, string>} */
let asked;

beforeEach(() => {
  dir = ledgerWorld('ledger-affected-');
  asked = new Map();
  createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
});

afterEach(() => {
  cleanupFixture(dir);
});

const ledger = ledgerHelpers(() => dir);
const { reword, answered } = ledgerReadHelpers(() => dir);

/** One ledger write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ledger.write(verb, address, flags, content).id;
}

/** One ledger write that must refuse, writing and committing nothing: its error. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function refused(verb, address, flags, content) {
  return refusedPristine(dir, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).error;
}

/** @param {string} address @param {string} text @param {string[]} [flags] */
function ask(address, text, flags = []) {
  return write('ask', address, flags, { ...MADE, text });
}

/** @param {string} address @param {string} text @param {string[]} [flags] */
function find(address, text, flags = []) {
  return write('find', address, flags, { ...MADE, text, how: 'seen in a spike' });
}

/** A decision answering the place's question. @param {string} address @param {string} text @param {string[]} [flags] */
function decide(address, text, flags = []) {
  if (!asked.has(address)) asked.set(address, ask(address, 'What is a note?'));
  return write('decide', address, ['--answers', /** @type {string} */ (asked.get(address)), ...flags], { ...MADE, text, why: `Why: ${text}` });
}

/** `old` replaced at `address`, a changed mind. @param {string} address @param {string} old @param {string} text */
function change(address, old, text) {
  return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old answer'], text, why: `Why: ${text}` });
}

/** `entry` confirmed at `address` to hold after `replacement`. @param {string} address @param {string} entry @param {string} replacement */
function hold(address, entry, replacement) {
  return write('hold', address, ['--entry', entry, '--after', replacement], MADE);
}

/** @param {string[]} place */
function affected(...place) {
  return ok(dir, ['ledger', 'affected', ...place]);
}

/** The affected entries' ids, and the topics waiting on the person. @param {string[]} place */
function listed(...place) {
  const res = affected(...place);
  return { ids: res.affected.map((/** @type {{id: string}} */ e) => e.id), waiting: res.waiting };
}

/** What changed under an affected entry: each entry it is held against, and the replacements on its way, by id. @param {Record<string, any>} entry */
function changesOf(entry) {
  return entry.changed.map((/** @type {{held_against: string, replacements: {id: string}[]}} */ c) => [c.held_against, c.replacements.map((r) => r.id)]);
}

/** What changed under each affected entry in the unit, by the entry's id. */
function changes() {
  return Object.fromEntries(affected(UNIT).affected.map((/** @type {Record<string, any>} */ entry) => [entry.id, changesOf(entry)]));
}

/** An entry's line as a read shows it, from the record of where it stands. @param {string} id @param {string} unit @param {string} topic */
function shown(id, unit, topic) {
  const record = ok(dir, ['ledger', 'record', unit, topic]);
  const { holds: _holds, kept: _kept, replaced: _replaced, ...line } = [...record.questions, ...record.findings, ...record.decisions].find((e) => e.id === id);
  return line;
}

describe('what a replacement affects (5.6.10, 5.6.11, 5.8.8)', () => {
  it('lists a decision, a question and a finding relying on a replaced decision, their topic waiting on the person though it was closed, each leaving the list once it is confirmed to hold (5.S9)', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const decision = decide(SPACE, 'A note opens on the active Space.', ['--relies-on', relied]);
    const question = ask(SPACE, 'Does a panel follow the person?', ['--relies-on', relied]);
    const finding = find(SPACE, 'A panel takes no focus.', ['--relies-on', relied]);
    ok(dir, ['manifest', 'set', SPACE, 'status', 'completed']);
    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });

    const replacement = change(NOTE, relied, 'A note is a frameless window.');

    const res = affected(UNIT);
    assert.deepStrictEqual(res.waiting, ['space-homing']);
    const replacing = shown(replacement, UNIT, 'note-window');
    assert.deepStrictEqual(res.affected[0], {
      ...shown(decision, UNIT, 'space-homing'),
      standing: { unit: UNIT, topic: 'space-homing' },
      waits: ['space-homing'],
      changed: [{ held_against: relied, replacements: [replacing] }],
    });
    assert.deepStrictEqual(res.affected.map((/** @type {{id: string}} */ e) => e.id), [decision, question, finding]);
    assert.deepStrictEqual(listed(UNIT, 'space-homing'), { ids: [decision, question, finding], waiting: ['space-homing'] });
    assert.deepStrictEqual(listed(UNIT, 'note-window'), { ids: [], waiting: [] });

    hold(SPACE, question, replacement);
    assert.deepStrictEqual(listed(UNIT).ids, [decision, finding]);
    hold(SPACE, decision, replacement);
    hold(SPACE, finding, replacement);
    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });
  });

  it('passes a change on through replacements alone: D1 replaced lists D2, relying on it, and not Q, relying on D2, until D2 is replaced in its turn', () => {
    const first = decide(NOTE, 'A note is a panel.');
    const second = decide(SPACE, 'A note opens on the active Space.', ['--relies-on', first]);
    const question = ask(SPACE, 'Does a note open on a full-screen Space?', ['--relies-on', second]);

    change(NOTE, first, 'A note is a frameless window.');
    assert.deepStrictEqual(listed(UNIT).ids, [second]);

    const secondNow = change(SPACE, second, 'A note opens on the Space it was made on.');
    assert.deepStrictEqual(changes(), { [question]: [[second, [secondNow]]] });

    hold(SPACE, question, secondNow);
    assert.deepStrictEqual(listed(UNIT).ids, []);
  });

  it('follows what an entry relies on past a merge that holds: the merge changes nothing, a replacement of the entry the duplicate went into does, a confirmation after it clears the entry, and a later replacement flags it again', () => {
    const into = decide(NOTE, 'Notes float above every Space.');
    const merged = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = write('decide', SPACE, ['--answers', merged], { ...MADE, text: 'Notes float.', why: 'Furniture.' });
    const relying = find(SPACE, 'A floating note is on every display.', ['--relies-on', duplicate]);
    write('merge', SPACE, ['--question', merged, '--into', into, '--duplicate', duplicate], MADE);
    assert.deepStrictEqual(listed(UNIT).ids, []);

    const replacement = change(NOTE, into, 'Notes float above the Space they were made on.');
    assert.deepStrictEqual(changes(), { [relying]: [[duplicate, [replacement]]] });

    hold(SPACE, relying, replacement);
    assert.deepStrictEqual(listed(UNIT).ids, []);
    const again = change(NOTE, replacement, 'Notes float above the display they were made on.');
    assert.deepStrictEqual(changes(), { [relying]: [[duplicate, [replacement, again]]] });
  });

  it('clears each entry an entry relies on by its own confirmation, after the latest replacement on its way, a later replacement flagging that one again alone and a confirmation after an earlier one refused', () => {
    const panel = decide(NOTE, 'A note is a panel.');
    const sized = decide(NOTE, 'A note keeps its size.');
    const relying = find(SPACE, 'A panel keeps its frame on every Space.', ['--relies-on', panel, '--relies-on', sized]);
    const framed = change(NOTE, panel, 'A note is a frameless window.');
    const fitted = change(NOTE, sized, 'A note fits its text.');
    assert.deepStrictEqual(changes(), { [relying]: [[panel, [framed]], [sized, [fitted]]] });

    hold(SPACE, relying, framed);
    assert.deepStrictEqual(changes(), { [relying]: [[sized, [fitted]]] });
    hold(SPACE, relying, fitted);
    assert.deepStrictEqual(changes(), {});

    const clear = change(NOTE, framed, 'A note is a clear window.');
    assert.deepStrictEqual(changes(), { [relying]: [[panel, [framed, clear]]] });
    assert.strictEqual(refused('hold', SPACE, ['--entry', relying, '--after', framed], MADE),
      `ledger hold --after names ${framed}, an earlier change on the way of ${panel} — a hold names the latest: ${clear}`);
  });

  it('holds an answer against the question it answers: a rewording leaves it answering and affected, a confirmation naming the rewording clears it, a further rewording flags it again, and the answer\'s replacement clears it (5.S41)', () => {
    const question = ask(NOTE, 'What is a note?');
    const answer = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A note is a panel.', why: 'Furniture.' });
    const reworded = reword(NOTE, question, 'What is a note on screen?');
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [answer]]]);
    assert.deepStrictEqual(changes(), { [answer]: [[question, [reworded]]] });
    assert.deepStrictEqual(listed(UNIT, 'note-window').waiting, ['note-window']);

    hold(NOTE, answer, reworded);
    assert.deepStrictEqual(changes(), {});

    const again = reword(NOTE, reworded, 'What is a note on every display?');
    assert.deepStrictEqual(changes(), { [answer]: [[question, [reworded, again]]] });
    assert.strictEqual(refused('hold', NOTE, ['--entry', answer, '--after', reworded], MADE),
      `ledger hold --after names ${reworded}, an earlier change on the way of ${question} — a hold names the latest: ${again}`);

    const replacement = change(NOTE, answer, 'A note is a frameless window.');
    assert.deepStrictEqual([answered('note-window'), changes()], [[[again, 'answered', [replacement]]], {}]);
    const third = reword(NOTE, again, 'What is a note, drawn?');
    assert.deepStrictEqual(changes(), { [replacement]: [[again, [third]]] });
  });

  it('holds a replacement against the wording live as it was written: a rewording set aside then flags it each time it is back, as it does an answer written beside it (5.6.10)', () => {
    const question = ask(NOTE, 'What is a note?');
    const answer = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A note is a panel.', why: 'Furniture.' });
    const reworded = reword(MINT, question, 'What is a note in Mint?');
    ok(dir, ['workunit', 'cancel', 'mint']);
    const replacement = change(NOTE, answer, 'A note is a frameless window.');
    const beside = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A note keeps its size.', why: 'Furniture.' });
    assert.deepStrictEqual(changes(), {});

    ok(dir, ['workunit', 'reactivate', 'mint']);

    const flagged = { [replacement]: [[question, [reworded]]], [beside]: [[question, [reworded]]] };
    assert.deepStrictEqual(changes(), flagged);
    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(changes(), {});
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(changes(), flagged);
  });

  it('flags no answer to a question merged or moved, neither being a rewording (5.S41)', () => {
    const question = ask(NOTE, 'Does a note follow the person?');
    const answer = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A note stays put.', why: 'Furniture.' });
    const duplicate = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'Notes float.', why: 'Furniture.' });
    const into = decide(SPACE, 'Notes float above every Space.');
    write('merge', NOTE, ['--question', question, '--into', into, '--duplicate', duplicate], MADE);
    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    assert.deepStrictEqual(answered('space-homing')[0], [question, 'merged', [answer, into]]);
    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });
  });

  it('flags an entry relying on what a replacement set aside as it was written replaced, once that replacement is back — a postponed topic pulled back, a cancelled unit reactivated — its way in the ledger\'s order, the latest last', () => {
    const card = decide(MINT, 'A Mint note is a card.');
    const asFumi = change(NOTE, card, 'A Mint note is a panel, as a Fumi note is.');
    ok(dir, ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    const onCard = find(SPACE, 'A card takes focus.', ['--relies-on', card]);
    assert.deepStrictEqual(listed(UNIT).ids, []);
    ok(dir, ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.deepStrictEqual(changes(), { [onCard]: [[card, [asFumi]]] });
    hold(SPACE, onCard, asFumi);

    const panel = decide(NOTE, 'A note is a panel.');
    const sheet = change(MINT, panel, 'A note is a sheet.');
    const rolled = change(MINT, sheet, 'A note is a rolled sheet.');
    ok(dir, ['workunit', 'cancel', 'mint']);
    const onPanel = find(SPACE, 'A panel takes no focus.', ['--relies-on', panel]);
    assert.deepStrictEqual(listed(UNIT).ids, []);
    const framed = change(NOTE, panel, 'A note is a frameless window.');
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(changes(), { [onPanel]: [[panel, [sheet, rolled, framed]]] });
  });

  it('counts a confirmation that an entry still holds only while it is live', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const relying = find(SPACE, 'A panel takes no focus.', ['--relies-on', relied]);
    const replacement = change(NOTE, relied, 'A note is a frameless window.');
    hold(MINT, relying, replacement);
    assert.deepStrictEqual(listed(UNIT).ids, []);
    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(listed(UNIT).ids, [relying], 'a cancelled unit\'s confirmation still held the entry');
  });

  it('waits at the unit\'s level for an entry made there, on no topic\'s list', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const relying = find(`${UNIT}.specification`, 'The spec draws the note as a panel.', ['--relies-on', relied]);

    change(NOTE, relied, 'A note is a frameless window.');

    assert.deepStrictEqual(listed(UNIT), { ids: [relying], waiting: [null] });
    assert.deepStrictEqual(affected(UNIT).affected[0].waits, [null]);
    assert.deepStrictEqual(listed(UNIT, 'note-window').ids, []);
  });

  it('flags a finished unit\'s entry in the work that made the latest change, which confirms it, never in the finished unit, which stays finished (5.S10)', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', relied]);
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);

    const replacement = change(MINT, relied, 'A note is a sheet.');

    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });
    const res = affected('mint');
    assert.deepStrictEqual([res.waiting, res.affected.map((/** @type {Record<string, unknown>} */ e) => [e.id, e.standing, e.waits])], [['mint'], [[relying, { unit: UNIT, topic: 'note-window' }, ['mint']]]]);
    assert.deepStrictEqual(listed('mint', 'mint').ids, [relying]);
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, layout.manifest(UNIT)), 'utf8')).status, 'completed', 'the flag reopened the finished unit');

    hold(MINT, relying, replacement);
    assert.deepStrictEqual(listed('mint').ids, []);
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, layout.manifest(UNIT)), 'utf8')).status, 'completed');

    change('mint.specification', replacement, 'A note is a card.');
    assert.deepStrictEqual([listed('mint'), listed('mint', 'mint').ids], [{ ids: [relying], waiting: [null] }, []]);
  });

  it('refuses a read naming no unit, a unit there is none of, or a topic the unit does not have', () => {
    assert.match(refuses(dir, ['ledger', 'affected']).error, /^Usage: engine ledger affected <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'affected', 'dock']).error, /^ledger affected: there is no work unit "dock"$/);
    assert.match(refuses(dir, ['ledger', 'affected', UNIT, 'menu-bar']).error, /^ledger affected: fumi has no topic "menu-bar"$/);
  });
});
