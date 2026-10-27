'use strict';

// ---------------------------------------------------------------------------
// What a replacement affects (workflow-engine/scripts/domain/ledger-affected.cjs),
// `engine ledger affected`, read through the ledger's fold
// (domain/ledger-fold.cjs): every current question, finding and decision
// relying on an entry a live replacement changed since it was last
// confirmed, leaving the list on a live "still holds" or on its own
// replacement; a chain passing on through replacements alone, and past a
// merge that holds; in a unit under way, waiting on the topic it stands on,
// however closed; in a finished unit, flagged in the work that made the
// change and never reopening it.
//
// Real repositories in temp folders, each with its state worktree, the work
// units' manifests written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, refuses, statePath, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const MINT = 'mint.discussion.mint';

/** A discovery map row a topic's cancel takes. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-affected-');
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
      discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
    },
  });
  createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
});

afterEach(() => {
  cleanupFixture(dir);
});

/** One ledger write that must succeed: its short id. @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content */
function write(verb, address, flags, content) {
  return ok(dir, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** @param {string} address @param {string} text @param {string[]} [flags] */
function ask(address, text, flags = []) {
  return write('ask', address, flags, { ...MADE, text });
}

/** @param {string} address @param {string} text @param {string[]} [flags] */
function find(address, text, flags = []) {
  return write('find', address, flags, { ...MADE, text, how: 'seen in a spike' });
}

/** A decision answering a question asked with it. @param {string} address @param {string} text @param {string[]} [flags] */
function decide(address, text, flags = []) {
  return write('decide', address, ['--answers', ask(address, `${text}?`), ...flags], { ...MADE, text, why: `Why: ${text}` });
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

/** An entry's line as a read shows it, from the record of where it stands. @param {string} id @param {string} unit @param {string} topic */
function shown(id, unit, topic) {
  const record = ok(dir, ['ledger', 'record', unit, topic]);
  const { holds: _holds, replaced: _replaced, ...line } = [...record.questions, ...record.findings, ...record.decisions].find((e) => e.id === id);
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
    find(SPACE, 'A frameless window takes focus.', ['--relies-on', relied]);

    const res = affected(UNIT);
    assert.deepStrictEqual(res.waiting, ['space-homing']);
    const replacing = shown(replacement, UNIT, 'note-window');
    assert.deepStrictEqual(res.affected[0], {
      ...shown(decision, UNIT, 'space-homing'),
      standing: { unit: UNIT, topic: 'space-homing' },
      waits: ['space-homing'],
      changed: [{ relied_on: relied, replacements: [replacing] }],
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
    const res = affected(UNIT);
    assert.deepStrictEqual(res.affected.map((/** @type {{id: string}} */ e) => e.id), [question]);
    assert.deepStrictEqual(res.affected[0].changed.map((/** @type {{relied_on: string, replacements: {id: string}[]}} */ c) => [c.relied_on, c.replacements.map((r) => r.id)]), [[second, [secondNow]]]);

    hold(SPACE, question, secondNow);
    assert.deepStrictEqual(listed(UNIT).ids, []);
  });

  it('follows what an entry relies on past a merge that holds: the merge changes nothing, and a replacement of the entry the duplicate went into does', () => {
    const into = decide(NOTE, 'Notes float above every Space.');
    const merged = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = write('decide', SPACE, ['--answers', merged], { ...MADE, text: 'Notes float.', why: 'Furniture.' });
    const relying = find(SPACE, 'A floating note is on every display.', ['--relies-on', duplicate]);
    write('merge', SPACE, ['--question', merged, '--into', into, '--duplicate', duplicate], MADE);
    assert.deepStrictEqual(listed(UNIT).ids, []);

    const replacement = change(NOTE, into, 'Notes float above the Space they were made on.');

    const [entry] = affected(UNIT).affected;
    assert.deepStrictEqual([entry.id, entry.changed.map((/** @type {{relied_on: string, replacements: {id: string}[]}} */ c) => [c.relied_on, c.replacements.map((r) => r.id)])], [relying, [[duplicate, [replacement]]]]);
  });

  it('counts a replacement, and a confirmation that an entry still holds, only while each is live', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const relying = find(SPACE, 'A panel takes no focus.', ['--relies-on', relied]);
    change(MINT, relied, 'A note is a sheet.');
    assert.deepStrictEqual(listed(UNIT).ids, [relying]);
    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(listed(UNIT).ids, [], 'a cancelled unit\'s replacement still changed what relies on it');
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(listed(UNIT).ids, [relying]);
    ok(dir, ['workunit', 'cancel', 'mint']);

    const replacement = change(NOTE, relied, 'A note is a frameless window.');
    ok(dir, ['workunit', 'reactivate', 'mint']);
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

  it('flags a finished unit\'s entry in the work that made the change, which confirms it, never in the finished unit, which stays finished (5.S10)', () => {
    const relied = decide(NOTE, 'A note is a panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', relied]);
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);

    const replacement = change(MINT, relied, 'A note is a sheet.');

    assert.deepStrictEqual(listed(UNIT), { ids: [], waiting: [] });
    const res = affected('mint');
    assert.deepStrictEqual([res.waiting, res.affected.map((/** @type {Record<string, unknown>} */ e) => [e.id, e.standing, e.waits])], [['mint'], [[relying, { unit: UNIT, topic: 'note-window' }, ['mint']]]]);
    assert.deepStrictEqual(listed('mint', 'mint').ids, [relying]);
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, UNIT, 'manifest.json'), 'utf8')).status, 'completed', 'the flag reopened the finished unit');

    hold(MINT, relying, replacement);
    assert.deepStrictEqual(listed('mint').ids, []);
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, UNIT, 'manifest.json'), 'utf8')).status, 'completed');
  });

  it('refuses a read naming no unit, a unit there is none of, or a topic the unit does not have', () => {
    assert.match(refuses(dir, ['ledger', 'affected']).error, /^Usage: engine ledger affected <work-unit> \[<topic>\]$/);
    assert.match(refuses(dir, ['ledger', 'affected', 'dock']).error, /^ledger affected: there is no work unit "dock"$/);
    assert.match(refuses(dir, ['ledger', 'affected', UNIT, 'menu-bar']).error, /^ledger affected: fumi has no topic "menu-bar"$/);
  });
});
