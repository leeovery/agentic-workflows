'use strict';

// ---------------------------------------------------------------------------
// The inbox's close (leeway-engine/scripts/domain/inbox.cjs, engine `inbox
// close <work-unit|none> <path> …`, 6.1.15, 18.6.4–18.6.6, 18.6.10): live
// items archived under their names, the project manifest recording who
// closed each, `inbox_closed: {"{folder}/{file}": {unit, at}}` — the unit
// that resolved it, or null for an item fixed straight away (P4) — the
// moves and the record one commit; `restore` and `delete` dropping an
// item's record with it. Refused, nothing written: a unit the project
// lacks, a path no live item's, and a record that cannot be written, every
// file put back. Finish's reading of the record and of the build's log is
// test-engine-finish.cjs's.
//
// Layer: git. World: the project world with a unit, `pay`, and three
// inbox items, built once (`fixtureFrom`) and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
  ok, refusedPristine, fixtureFrom, cleanupFixture, commitAll, writeState, readState, statePath, layout, stateGit, touched, lastMessage, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'pay';
const ITEMS = Object.freeze({
  loop: layout.inbox('bugs', '2026-06-01--the-login-loops.md'),
  phone: layout.inbox('ideas', '2026-06-02--pay-by-phone.md'),
  button: layout.inbox('quickfixes', '2026-06-03--rename-the-pay-button.md'),
});
const AT = FROZEN_AT.replace(/\.\d{3}Z$/, 'Z');

const world = fixtureFrom('inbox-close-', (dir) => {
  createManifest(dir, UNIT, {});
  for (const rel of Object.values(ITEMS)) writeState(dir, rel, `# ${rel}\n`);
  commitAll(dir, 'a unit and the inbox');
});

/** @type {string} */
let dir;
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** A live item's path, absolute. @param {keyof typeof ITEMS} name */
const live = (name) => statePath(dir, ITEMS[name]);

/** Where a live item archives to, absolute. @param {keyof typeof ITEMS} name */
const archived = (name) => statePath(dir, ITEMS[name].replace(/^\.inbox\//, '.inbox/.archived/'));

/** An `inbox` verb on the frozen day, which must succeed. @param {string[]} args */
const inbox = (args) => withFrozenClock(() => ok(dir, ['inbox', ...args]));

/** The project manifest's record of closures. */
const record = () => JSON.parse(readState(dir, layout.projectManifest)).inbox_closed;

describe('inbox close (18.6.4, 18.6.6)', () => {
  it('18.S25, P4: archives an item fixed straight away under its name, recording it closed by none, the move and the record one commit', () => {
    const res = inbox(['close', 'none', live('loop')]);

    assert.deepStrictEqual(res, { ok: true, closed: [archived('loop')], unit: null, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([fs.existsSync(live('loop')), fs.existsSync(archived('loop'))], [false, true]);
    assert.deepStrictEqual(record(), { 'bugs/2026-06-01--the-login-loops.md': { unit: null, at: AT } });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['workflow(inbox): close the-login-loops', [
      `A\t${layout.archived('bugs', '2026-06-01--the-login-loops.md')}`, `D\t${ITEMS.loop}`, `M\t${layout.projectManifest}`,
    ]]);
  });

  it('18.6.4: closes a set for the unit that resolved it in one commit, each recorded beside what the record held', () => {
    inbox(['close', 'none', live('loop')]);
    const res = inbox(['close', UNIT, live('phone'), live('button')]);

    assert.deepStrictEqual([res.closed, res.unit, lastMessage(dir)], [[archived('phone'), archived('button')], UNIT, `workflow(inbox): close 2 items, resolved by ${UNIT}`]);
    assert.deepStrictEqual(record(), {
      'bugs/2026-06-01--the-login-loops.md': { unit: null, at: AT },
      'ideas/2026-06-02--pay-by-phone.md': { unit: UNIT, at: AT },
      'quickfixes/2026-06-03--rename-the-pay-button.md': { unit: UNIT, at: AT },
    });
  });

  it('18.6.9: restore and delete drop each item\'s record in their own commit, the record gone once it holds none', () => {
    inbox(['close', UNIT, live('loop'), live('phone')]);
    inbox(['restore', archived('loop')]);
    const restored = record();
    const restoreTouched = touched(statePath(dir), 'HEAD');
    inbox(['delete', archived('phone')]);

    assert.deepStrictEqual(restored, { 'ideas/2026-06-02--pay-by-phone.md': { unit: UNIT, at: AT } });
    assert.ok(restoreTouched.includes(`M\t${layout.projectManifest}`), 'the restore commits the record it dropped');
    assert.deepStrictEqual([record(), touched(statePath(dir), 'HEAD')], [undefined, [`D\t${layout.archived('ideas', '2026-06-02--pay-by-phone.md')}`, `M\t${layout.projectManifest}`]]);
  });

  it('refuses, writing nothing, a unit the project lacks, a path no live item\'s, and a close whose record cannot be written, every file put back', () => {
    inbox(['archive', live('button')]);
    const refused = (/** @type {string[]} */ args) => refusedPristine(dir, ['inbox', 'close', ...args]).error;
    const [nope, gone, filed] = [refused(['nope', live('loop')]), refused([UNIT, live('button')]), refused([UNIT, archived('button')])];
    writeState(dir, layout.projectManifest, '{not json');
    commitAll(dir, 'a broken project manifest');

    assert.deepStrictEqual([nope, gone, filed.startsWith('not a live inbox path'), refused([UNIT, live('loop'), live('phone')]).startsWith('project manifest at ')], [
      'inbox close: there is no work unit "nope" — name the unit whose work resolved the items, or none', `inbox file not found: "${live('button')}"`, true, true,
    ]);
    assert.deepStrictEqual([fs.existsSync(live('loop')), fs.existsSync(live('phone'))], [true, true]);
  });
});
