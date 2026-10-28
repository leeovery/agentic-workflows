'use strict';

// ---------------------------------------------------------------------------
// The rules each state file merges by
// (workflow-engine/scripts/domain/state-merge-rules.cjs): which rule a path
// takes, the ledger's lines added by id, the migrations record's ids, a
// manifest merged field by field against its ancestor, and how a choice is
// named and labelled.
//
// Layer: unit. The rules are called with values; no git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const {
  linesToAdd, entryId, migrationId, mergeManifest, choiceId, conflictLabel, ruleOf,
} = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));

describe('the rules each file merges by', () => {
  it('reads the ledger, the migrations record, each manifest and any other JSON file by its path', () => {
    assert.deepStrictEqual(
      ['.ledger.jsonl', '.state/migrations', 'manifest.json', 'auth-flow/manifest.json', '.tick/manifest.json', 'unit/topics/a/manifest.json', 'unit/data.json', 'unit/events.jsonl', 'unit/topics/a/log.md'].map(ruleOf),
      ['ledger', 'migrations', 'manifest', 'manifest', 'whole', 'whole', 'whole', 'whole', 'file'],
    );
  });

  /** The lines a line rule adds after the remote's. @param {string} remote @param {string} local @param {any} keyOf */
  const added = (remote, local, keyOf) => [...linesToAdd(remote.split('\n'), local.split('\n'), keyOf)];

  it('adds this clone\'s ledger lines whose ids the remote\'s lack, once each, in this clone\'s order, blank lines neither', () => {
    const remote = '{"id":"base", "spaced": true}\n{"id":"b1"}\n{"id":"both"}\n';
    assert.deepStrictEqual(added(remote, '{"id":"base"}\n{"id":"a1"}\n\n{"id":"both","x":1}\n{"id":"a2"}\n{"id":"a1"}\n', entryId), ['{"id":"a1"}', '{"id":"a2"}']);
    assert.deepStrictEqual(added('', '{"id":"l"}\n', entryId), ['{"id":"l"}']);
    assert.deepStrictEqual(added(remote, '', entryId), []);
  });

  it('refuses a ledger line that is not an entry with a string id, counting the lines that are not blank', () => {
    assert.throws(() => added('{"id":"r"}\n', '{"id":"a"}\n\nnot json\n', entryId), /line 2 of this machine's is not an entry with an id: not json/);
    assert.throws(() => added('{"id":7}\n', '{"id":"a"}\n', entryId), /line 1 of the remote's is not an entry with an id/);
  });

  it('adds the migration ids the remote\'s record lacks', () => {
    assert.deepStrictEqual(added('001\n073\n', '001\n073\n075\n', migrationId), ['075']);
    assert.deepStrictEqual(added('001\n074\n', '073\n001\n', migrationId), ['073']);
  });

  /** A unit's manifest merged. @param {unknown} base @param {any} local @param {any} remote @param {any} [pickOf] */
  const merged = (base, local, remote, pickOf) => mergeManifest('pay/manifest.json', base, local, remote, pickOf);

  it('recurses into nested objects, a field each side changed kept from that side', () => {
    const out = merged({ a: { x: 1, y: 1 }, b: 1 }, { a: { x: 2, y: 1 }, b: 1 }, { a: { x: 1, y: 3 }, b: 1 });
    assert.deepStrictEqual(out, { value: { a: { x: 2, y: 3 }, b: 1 }, conflicts: [] });
  });

  it('takes a field set alike on both sides, added or changed', () => {
    assert.deepStrictEqual(merged({ s: 'a' }, { s: 'b', n: { k: 1 } }, { s: 'b', n: { k: 1 } }), { value: { s: 'b', n: { k: 1 } }, conflicts: [] });
  });

  it('removes a key one side removed and the other left alone, and stops where the other changed it', () => {
    assert.deepStrictEqual(merged({ a: 1, b: 1 }, { a: 1 }, { a: 2, b: 1 }), { value: { a: 2 }, conflicts: [] });
    assert.deepStrictEqual(merged({ a: 1 }, {}, { a: 2 }).conflicts, [{ field: ['a'], local: { set: false }, remote: { set: true, value: 2 }, pick: null }]);
  });

  it('treats a list as one value, joining lists both sides only appended to the ancestor\'s, the remote\'s additions first', () => {
    assert.deepStrictEqual(merged({ l: [1] }, { l: [1, 2, 4] }, { l: [1, 3, 4] }).value, { l: [1, 3, 4, 2] });
    assert.deepStrictEqual(merged({ l: [1] }, { l: [1, 1] }, { l: [1, 2] }).value, { l: [1, 2, 1] }, 'an appended element equal to one the ancestor held was dropped');
    assert.deepStrictEqual(merged({ l: [] }, { l: ['x', 'x'] }, { l: ['x'] }).value, { l: ['x', 'x'] }, 'one element the remote appended took both of this clone\'s');
    assert.deepStrictEqual(merged({ l: [] }, { l: ['x', 'y', 'x'] }, { l: ['x', 'x'] }).value, { l: ['x', 'x', 'y'] });
    assert.deepStrictEqual(merged({ l: [1, 2] }, { l: [1] }, { l: [1, 2, 3] }).conflicts.map((c) => c.field), [['l']]);
    assert.deepStrictEqual(merged({ l: [1, 2] }, { l: [2, 1] }, { l: [1, 2, 3] }).conflicts.map((c) => c.field), [['l']]);
  });

  it('stops on lists both sides created differently, the ancestor holding none', () => {
    assert.deepStrictEqual(merged({}, { l: ['a'] }, { l: ['b'] }).conflicts,
      [{ field: ['l'], local: { set: true, value: ['a'] }, remote: { set: true, value: ['b'] }, pick: null }]);
    assert.deepStrictEqual(merged({ l: 'flat' }, { l: ['a'] }, { l: ['b'] }).conflicts.map((c) => c.field), [['l']]);
  });

  it('stops on a field both sides changed to different values, a change of type included', () => {
    assert.deepStrictEqual(merged({ a: { x: 1 } }, { a: { x: 2 } }, { a: 'flat' }).conflicts,
      [{ field: ['a'], local: { set: true, value: { x: 2 } }, remote: { set: true, value: 'flat' }, pick: null }]);
  });

  it('keeps the remote\'s project_id where the project manifests hold two, with or without an ancestor, never a choice; elsewhere the field is one like any other (4.7.12)', () => {
    const [here, there] = [{ project_id: 'here-id', a: 1 }, { project_id: 'there-id', b: 1 }];
    assert.deepStrictEqual(mergeManifest('manifest.json', undefined, here, there), { value: { project_id: 'there-id', b: 1, a: 1 }, conflicts: [] });
    assert.deepStrictEqual(mergeManifest('manifest.json', { project_id: 'old' }, here, there).conflicts, []);
    assert.deepStrictEqual(merged(undefined, here, there).conflicts.map((c) => c.field), [['project_id']]);
    assert.deepStrictEqual(mergeManifest('manifest.json', {}, { x: { project_id: 'a' } }, { x: { project_id: 'b' } }).conflicts.map((c) => c.field), [['x', 'project_id']]);
  });

  it('takes the picked side where a pick is given for the choice', () => {
    const pickOf = (choice) => (choice.field.join('.') === 'a' && choice.remote.set && choice.remote.value === 3 ? 'local' : null);
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 3 }, pickOf), { value: { a: 2 }, conflicts: [{ field: ['a'], local: { set: true, value: 2 }, remote: { set: true, value: 3 }, pick: 'local' }] });
    assert.deepStrictEqual(merged({ a: 1 }, {}, { a: 3 }, pickOf).value, {});
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 4 }, pickOf).conflicts.map((c) => c.pick), [null]);
  });

  it('names a choice by its manifest, its step, its field and both values, whatever the pick or the values\' key order', () => {
    const choice = { manifest: 'manifest.json', uncommitted: false, field: ['a', 'b'], local: { set: true, value: { x: [1], y: 2 } }, remote: { set: false } };
    const id = choiceId(choice);
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.strictEqual(choiceId({ ...choice, local: { set: true, value: { y: 2, x: [1] } }, pick: 'local' }), id);
    for (const other of [
      { manifest: 'auth-flow/manifest.json' }, { uncommitted: true }, { field: ['a', 'c'] },
      { local: { set: true, value: { x: [2], y: 2 } } }, { remote: { set: true, value: null } },
    ]) {
      assert.notStrictEqual(choiceId({ ...choice, ...other }), id, JSON.stringify(other));
    }
  });

  it('orders the merged keys as the remote has them, this clone\'s new ones after', () => {
    assert.deepStrictEqual(Object.keys(merged({}, { b: 1, a: 1, z: 1 }, { a: 1, c: 1, b: 1 }).value), ['a', 'c', 'b', 'z']);
  });

  it('writes a key named like a prototype property as data', () => {
    const out = merged(JSON.parse('{}'), JSON.parse('{"__proto__": {"x": 1}, "constructor": 2}'), JSON.parse('{"other": 1}'));
    assert.strictEqual(JSON.stringify(out.value), '{"other":1,"__proto__":{"x":1},"constructor":2}');
  });

  it('labels a field by the entry it belongs to and its meaning, else by its path', () => {
    assert.deepStrictEqual(conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: 'horizon', path: 'roadmap.items.a-lifetime-tier.horizon',
    });
    assert.deepStrictEqual(conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: null, path: 'roadmap.items.a-lifetime-tier',
    });
    assert.deepStrictEqual(conflictLabel('auth-flow/manifest.json', ['build', 'plan_format'], 'Fumi'), {
      owner: "Auth Flow's manifest", subject: null, name: null, field: 'plan format', path: 'build.plan_format',
    });
  });
});
