'use strict';

// ---------------------------------------------------------------------------
// What only Tick's driver does as it merges Tick's store between two clones
// (`mergeStore`, drivers/task/tick/driver.cjs; 7.5, 29.14.9), beyond the
// contract the task conformance suite holds every driver to: the store's
// lines matched by Tick's id wherever Tick wrote them, the fields Tick keeps
// for itself settled without asking — dependencies taken away, the updated
// stamp, the transitions, the closed stamp — a task deleted on one side, a
// creation sequence for each task only this machine made, and a choice's
// values in the engine's words.
//
// Layer: unit. World: stores written as Tick writes them, called with values.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const DRIVER = require('../../../skills/leeway-engine/scripts/drivers/task/tick/driver.cjs');
const { FOREIGN_TASK } = require('../../../skills/leeway-engine/scripts/domain/task-id.cjs');

const AT = (/** @type {number} */ minute) => `2026-11-02T10:${String(minute).padStart(2, '0')}:00Z`;

/** A task as Tick writes it, by its engine name. @param {string} id @param {number} seq @param {string|null} name @param {object} [fields] */
function task(id, seq, name, fields = {}) {
  return { id, title: name ?? 'Mine', status: 'open', priority: 2, ...(name === null ? {} : { refs: [name] }), parent: 'tick-p1', seq, created: AT(0), updated: AT(0), ...fields };
}

const UNIT = task('tick-u', 1, 'unit:pay', { parent: undefined });
const PHASE = task('tick-p1', 2, 'phase:pay-1', { parent: 'tick-u' });
const BASE = [UNIT, PHASE, task('tick-a', 3, 'task:pay-1-1'), task('tick-b', 4, 'task:pay-1-2'), task('tick-c', 5, 'task:pay-1-3', { blocked_by: ['tick-a', 'tick-b'] })];

/** A store's text. @param {object[]} tasks */
const text = (tasks) => tasks.map((held) => `${JSON.stringify(held)}\n`).join('');

/** The base with tasks replaced by id, a replacement of null removing one. @param {Record<string, object|null>} changes @param {object[]} [added] */
function side(changes, added = []) {
  return [...BASE.flatMap((held) => (held.id in changes ? (changes[held.id] === null ? [] : [changes[held.id]]) : [held])), ...added];
}

/** The base, one side and the other merged, as tasks by id. @param {object[]} local @param {object[]} remote @param {any} [pickOf] */
function merged(local, remote, pickOf) {
  const result = DRIVER.mergeStore(text(BASE), text(local), text(remote), pickOf);
  assert.ok('text' in result, 'the store merged');
  return { tasks: result.text.trim().split('\n').map((line) => JSON.parse(line)), conflicts: result.conflicts };
}

/** @param {{id: string}[]} tasks @param {string} id */
const byId = (tasks, id) => tasks.find((held) => held.id === id);

describe('Tick\'s store merged between two clones', () => {
  it('matches tasks by Tick\'s id wherever each side wrote their lines, keeping the remote\'s order', () => {
    const done = { ...BASE[2], status: 'done', updated: AT(5), closed: AT(5) };
    const started = { ...BASE[3], status: 'in_progress', updated: AT(6) };
    const { tasks, conflicts } = merged(side({ 'tick-a': done }), side({ 'tick-b': started }).reverse());
    assert.deepStrictEqual(conflicts, []);
    assert.deepStrictEqual(tasks.map((held) => held.id), ['tick-c', 'tick-b', 'tick-a', 'tick-p1', 'tick-u']);
    assert.deepStrictEqual([byId(tasks, 'tick-a'), byId(tasks, 'tick-b')], [done, started]);
  });

  it('settles the fields Tick keeps for itself on a task both changed: a dependency taken away goes, the later updated stamp, the transitions in time order', () => {
    const local = { ...BASE[4], blocked_by: ['tick-b'], transitions: [{ from: 'open', to: 'in_progress', at: AT(1), auto: false }], status: 'in_progress', updated: AT(7) };
    const remote = { ...BASE[4], blocked_by: ['tick-a', 'tick-b', 'tick-x'], notes: [{ text: 'Added by the person:\nKeep it.', created: AT(3) }], transitions: [{ from: 'open', to: 'open', at: AT(2), auto: false }], updated: AT(3) };
    const { tasks, conflicts } = merged(side({ 'tick-c': local }), side({ 'tick-c': remote }));
    assert.deepStrictEqual(conflicts, []);
    const held = byId(tasks, 'tick-c');
    assert.deepStrictEqual([held?.status, held?.blocked_by, held?.updated, held?.notes, held?.transitions.map((/** @type {{at: string}} */ t) => t.at)], [
      'in_progress', ['tick-b', 'tick-x'], AT(7), remote.notes, [AT(1), AT(2)],
    ]);
  });

  it('keeps the closed stamp of a side whose status the task kept, and none where it is not ended', () => {
    const local = { ...BASE[2], status: 'done', updated: AT(4), closed: AT(4) };
    const remote = { ...BASE[2], status: 'cancelled', updated: AT(8), closed: AT(8) };
    const stamps = (/** @type {'local'|'remote'} */ pick) => byId(merged(side({ 'tick-a': local }), side({ 'tick-a': remote }), () => pick).tasks, 'tick-a')?.closed;
    assert.deepStrictEqual([stamps('local'), stamps('remote')], [AT(4), AT(8)]);
    const started = { ...BASE[2], status: 'in_progress', updated: AT(9) };
    const open = merged(side({ 'tick-a': local }), side({ 'tick-a': started }), () => 'remote');
    assert.deepStrictEqual(Object.keys(/** @type {object} */ (byId(open.tasks, 'tick-a'))).filter((key) => ['status', 'closed'].includes(key)), ['status']);
  });

  it('keeps a task deleted on one side and changed on the other, and drops one deleted on one side and left alone on the other', () => {
    const changed = { ...BASE[2], title: 'Write it', updated: AT(3) };
    const { tasks } = merged(side({ 'tick-a': null, 'tick-b': null }), side({ 'tick-a': changed }));
    assert.deepStrictEqual([byId(tasks, 'tick-a'), byId(tasks, 'tick-b')], [changed, undefined]);
  });

  it('gives each task only this machine made a creation sequence after the remote\'s highest, in this machine\'s order', () => {
    const { tasks } = merged(side({}, [task('tick-l1', 6, 'task:pay-1-4'), task('tick-l2', 7, 'task:pay-1-5')]), side({}, [task('tick-r1', 6, 'task:pay-2-1'), task('tick-r2', 7, null)]));
    assert.deepStrictEqual(tasks.map((held) => [held.id, held.seq]).slice(5), [['tick-r1', 6], ['tick-r2', 7], ['tick-l1', 8], ['tick-l2', 9]]);
  });

  it('shows a choice\'s values in the engine\'s words: the status as the engine names it, a parent by its name, a task of the person\'s own by its title', () => {
    const phase2 = task('tick-p2', 6, 'phase:pay-2', { parent: 'tick-u' });
    const mine = task('tick-m', 7, null);
    const base = [...BASE, phase2, mine];
    const local = [...side({ 'tick-a': { ...BASE[2], status: 'in_progress', parent: 'tick-p2', updated: AT(2) } }), phase2, { ...mine, status: 'done', updated: AT(2) }];
    const remote = [...side({ 'tick-a': { ...BASE[2], status: 'cancelled', parent: 'tick-gone', updated: AT(3) } }), phase2, { ...mine, status: 'cancelled', updated: AT(3) }];
    const result = DRIVER.mergeStore(text(base), text(local), text(remote));
    assert.ok('conflicts' in result);
    assert.deepStrictEqual(result.conflicts.map(({ field, local: here, remote: there, label }) => [field, here, there, label]), [
      [['tick-a', 'status'], { set: true, value: 'in-progress' }, { set: true, value: 'closed' }, { subject: 'task 1.1 of pay', name: 'task 1.1 of pay', field: 'status' }],
      [['tick-a', 'parent'], { set: true, value: 'phase 2 of pay' }, { set: true, value: FOREIGN_TASK }, { subject: 'task 1.1 of pay', name: 'task 1.1 of pay', field: 'parent' }],
      [['tick-m', 'status'], { set: true, value: 'done' }, { set: true, value: 'closed' }, { subject: `${FOREIGN_TASK}, "Mine"`, name: 'Mine', field: 'status' }],
    ]);
  });
});
