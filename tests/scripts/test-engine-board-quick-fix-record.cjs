'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14), its record and where it came from: the
// record held back until every fix has ended, a fix closed without being
// done counted in neither its done nor its total; each fix's record by its
// title; and a quick-fix from no note, from the roadmap, and before its
// first fix is written. The fixes: test-engine-board-quick-fix.cjs.
//
// Layer: verb. The worlds `recorded` and `unwritten`
// (quick-fix-board-world.cjs), each copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { statePath, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT, FLAG, HELP, RECORDS } = require('./quick-fix-world.cjs');
const { place } = require('./board-world.cjs');
const { recorded, unwritten, quickFixBoard } = require('./quick-fix-board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ROADMAP_SEED } = require(path.join(SCRIPTS, 'domain/inbox.cjs'));

let dir = ''; // the project
const { run, board, atTheFixes, rows } = quickFixBoard(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

/** Fix 1.3 closed without being done. */
const thirdClosed = () => run(['task', 'close', UNIT, '1.3', '--reason', 'Folded into 1.2.']);

describe('a quick-fix\'s record, and where it came from, on the board (20.14)', () => {
  it('its record waits until every fix has ended; a fix closed without being done counts in neither its done nor its total, and with no fix left nothing has stopped (20.14.1, 20.2.4)', () => {
    dir = recorded();
    atTheFixes();
    const open = board().view;
    thirdClosed();
    const { view, banner } = board();

    assert.deepStrictEqual([open.record, open.progress], [null, { done: 2, total: 3, written: true }]);
    assert.deepStrictEqual([view.standing, view.stopped, view.progress], ['working', false, { done: 2, total: 2, written: true }]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '2 of 2 done', needs: false }] });
  });

  it('its record holds each fix\'s by its title, every line of an item kept (19.5.17)', () => {
    dir = recorded();
    atTheFixes();
    thirdClosed();

    assert.deepStrictEqual(board().view.record, [{ title: FLAG, ...RECORDS[1] }, { title: HELP, ...RECORDS[2] }]);
  });

  it('a quick-fix made from no note says nothing of where it came from, one from the roadmap says so; before its first fix is written its banner, tab and All work say so', () => {
    dir = unwritten();
    atTheFixes();
    const { view, banner } = board();
    const { row, line } = rows();
    cleanupFixture(dir);
    dir = recorded();
    atTheFixes();
    const file = statePath(dir, UNIT, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    // As start this work seeds a unit from a roadmap item's note (workunit-create.cjs).
    fs.writeFileSync(file, JSON.stringify({ ...manifest, seeds: manifest.seeds.map((/** @type {object} */ seed) => ({ ...seed, source: `${ROADMAP_SEED}colour-flag` })) }));

    assert.deepStrictEqual([view.from, view.progress, view.fixes], [null, { done: 0, total: 0, written: false }, []]);
    assert.deepStrictEqual([banner.facts, row.words, line.standing], [[place('quick-fix'), { text: 'no fix written yet', needs: false }], 'no fix written yet', 'no fix written yet']);
    assert.strictEqual(board().view.from, 'roadmap');
  });
});
