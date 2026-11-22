'use strict';

// ---------------------------------------------------------------------------
// The rules each state file merges by
// (ledger-engine/scripts/domain/state-merge-rules.cjs): which rule a path
// takes, the tracker's store its driver's among them, the ledger's lines
// added by id, the migrations record's ids, a manifest merged field by field
// against its ancestor, a build's run read by its number, and how a choice
// is named and labelled; and where this machine's runs go where both wrote
// runs under the same numbers (state-merge-paths.cjs, placeRuns).
//
// Layer: unit. The rules are called with values; no git.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { layout } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const {
  linesToAdd, entryId, migrationId, mergeManifest, choiceId, conflictLabel, ruleOf, storeDriverOf, runNumber, runRenumbered,
} = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));
const { placeRuns } = require(path.join(SCRIPTS, 'domain/state-merge-paths.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

describe('the rules each file merges by', () => {
  it('reads the ledger, the migrations record, each manifest and any other JSON file by its path', () => {
    assert.deepStrictEqual(
      [layout.ledger, layout.migrations, layout.projectManifest, layout.manifest('auth-flow'), '.tick/manifest.json', 'unit/topics/a/manifest.json', 'unit/data.json', 'unit/events.jsonl', 'unit/topics/a/log.md'].map(ruleOf),
      ['ledger', 'migrations', 'manifest', 'manifest', 'whole', 'whole', 'whole', 'whole', 'file'],
    );
  });

  it('reads each task driver\'s store as its driver\'s, and a build\'s run by its number and place, kept whole as JSON', () => {
    const drivers = listDrivers('task');
    const stores = drivers.flatMap((/** @type {any} */ driver) => driver.storeFiles());
    assert.deepStrictEqual(stores.map(ruleOf), stores.map(() => 'store'));
    assert.deepStrictEqual(stores.map(storeDriverOf), drivers.flatMap((/** @type {any} */ driver) => driver.storeFiles().map(() => driver)));
    const paths = ['pay/build/runs/2.S1/run-003.json', 'pay/build/runs/2.S1/run-1004.json', 'pay/build/runs/2.S1/run-3.json', 'pay/build/runs/run-003.json', 'pay/build/2.S1/run-003.json', 'pay/build/runs/2.S1/sub/run-003.json'];
    assert.deepStrictEqual([paths.map(runNumber), paths.map(ruleOf)], [[3, 1004, null, null, null, null], paths.map(() => 'whole')]);
    assert.deepStrictEqual([runRenumbered(paths[0], 8), runRenumbered(paths[0], 1000)], ['pay/build/runs/2.S1/run-008.json', 'pay/build/runs/2.S1/run-1000.json']);
  });

  it('moves this machine\'s new runs after the remote\'s highest only in a folder where a number is held twice, each move onto a number already emptied', () => {
    const at = (/** @type {string} */ folder, /** @type {number} */ n) => `pay/build/runs/${folder}/run-${String(n).padStart(3, '0')}.json`;
    const entry = (/** @type {string} */ oid) => ({ mode: '100644', oid });
    const base = new Map([[at('2.S1', 1), entry('b1')]]);
    const remote = new Map([...base, [at('2.S1', 2), entry('r2')], [at('3.S1', 1), entry('r31')]]);
    const local = new Map([...base, [at('2.S1', 2), entry('l2')], [at('2.S1', 5), entry('l5')], [at('2.S1', 100), entry('l100')], [at('3.S1', 2), entry('l32')]]);
    const placed = placeRuns(base, local, remote);
    assert.deepStrictEqual(placed.moves, [
      { from: at('2.S1', 2), to: at('2.S1', 3) },
      { from: at('2.S1', 5), to: at('2.S1', 4) },
      { from: at('2.S1', 100), to: at('2.S1', 5) },
    ]);
    assert.deepStrictEqual([...placed.entries].sort(), [
      [at('2.S1', 1), entry('b1')], [at('2.S1', 3), entry('l2')], [at('2.S1', 4), entry('l5')], [at('2.S1', 5), entry('l100')], [at('3.S1', 2), entry('l32')],
    ]);
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
    assert.throws(() => added('{"id":"r"}\n', '{"id":"a"}\n\nnot json\n', entryId), /^Error: cannot merge \.ledger\/\S+: line 2 of this machine's is not an entry with an id: not json$/);
    assert.throws(() => added('{"id":7}\n', '{"id":"a"}\n', entryId), /line 1 of the remote's is not an entry with an id/);
  });

  it('adds the migration ids the remote\'s record lacks', () => {
    assert.deepStrictEqual(added('001\n073\n', '001\n073\n075\n', migrationId), ['075']);
    assert.deepStrictEqual(added('001\n074\n', '073\n001\n', migrationId), ['073']);
  });

  /** A unit's manifest merged. @param {unknown} base @param {any} local @param {any} remote @param {any} [pickOf] */
  const merged = (base, local, remote, pickOf) => mergeManifest(layout.manifest('pay'), base, local, remote, pickOf);

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
    assert.deepStrictEqual(mergeManifest(layout.projectManifest, undefined, here, there), { value: { project_id: 'there-id', b: 1, a: 1 }, conflicts: [] });
    assert.deepStrictEqual(mergeManifest(layout.projectManifest, { project_id: 'old' }, here, there).conflicts, []);
    assert.deepStrictEqual(merged(undefined, here, there).conflicts.map((c) => c.field), [['project_id']]);
    assert.deepStrictEqual(mergeManifest(layout.projectManifest, {}, { x: { project_id: 'a' } }, { x: { project_id: 'b' } }).conflicts.map((c) => c.field), [['x', 'project_id']]);
  });

  describe('the environment setup, part by part (4.7.5, 22.5.12)', () => {
    const AT = '2026-06-03T09:00:00.000Z';
    /** The project manifests merged, each its environment setup alone. @param {unknown} base @param {unknown} local @param {unknown} remote */
    const setups = (base, local, remote) => mergeManifest(layout.projectManifest, base === undefined ? undefined : { environment: base }, { environment: local }, { environment: remote });
    const linter = (/** @type {string} */ name, command = name) => ({ name, command });
    const record = (/** @type {string} */ what, /** @type {string} */ by) => ({ what, at: AT, by });

    it('keeps both sides\' entries of each list, each keyed by the field naming it once — the remote\'s in its order, then this clone\'s new ones — never one side\'s list over the other\'s', () => {
      const base = { linters: [linter('vet')], concurrency: [], prepare: [] };
      const local = { linters: [linter('vet'), linter('fmt')], concurrency: [record('port 5432', 'a')], prepare: [{ name: 'Deps', when: 'both', command: 'npm ci' }] };
      const remote = { linters: [linter('lint'), linter('vet')], concurrency: [record('the browser', 'b')], prepare: [] };
      assert.deepStrictEqual(setups(base, local, remote), {
        value: { environment: { linters: [linter('lint'), linter('vet'), linter('fmt')], concurrency: [record('the browser', 'b'), record('port 5432', 'a')], prepare: [{ name: 'Deps', when: 'both', command: 'npm ci' }] } },
        conflicts: [],
      });
    });

    it('takes an entry one side changed or removed from that side, and stops on one both changed differently, naming it as written', () => {
      const base = { linters: [linter('vet', 'go vet'), linter('fmt', 'gofmt')] };
      assert.deepStrictEqual(setups(base, { linters: [linter('vet', 'go vet ./...'), linter('fmt', 'gofmt')] }, { linters: [linter('vet', 'go vet')] }).value, { environment: { linters: [linter('vet', 'go vet ./...')] } });
      const { conflicts } = setups(base, { linters: [linter('vet', 'go vet ./...')] }, { linters: [linter('vet', 'go vet -all')] });
      assert.deepStrictEqual(conflicts.map(({ field, local, remote }) => [field, local, remote]), [[['environment', 'linters', 'vet'], { set: true, value: linter('vet', 'go vet ./...') }, { set: true, value: linter('vet', 'go vet -all') }]]);
      assert.deepStrictEqual(conflictLabel(layout.projectManifest, ['environment', 'linters', 'go vet'], 'Fumi').subject, 'the linter "go vet"');
    });

    it('merges how to run the product command by command, and the verify setup as one value, never part by part', () => {
      const verify = { place: 'verify', launch: 'up', drive: 'drive' };
      assert.deepStrictEqual(setups({ run: { tests: 't' } }, { run: { tests: 't', build: 'b' }, confirmed: AT }, { run: { tests: 'u' } }), { value: { environment: { run: { tests: 'u', build: 'b' }, confirmed: AT } }, conflicts: [] });
      assert.deepStrictEqual(setups({ verify }, { verify: { ...verify, launch: 'start' } }, { verify: { ...verify, drive: 'go' } }).conflicts.map(({ field }) => field), [['environment', 'verify']]);
    });

    it('4.7.4: merges what means the same on both sides to one, unasked — the person\'s yes given on both, the earlier instant; a thing that cannot run at once learned on both in the same words, the earlier record with its unit', () => {
      const LATER = '2026-06-04T10:00:00Z';
      assert.deepStrictEqual([setups({}, { confirmed: LATER }, { confirmed: AT }), setups({}, { confirmed: AT }, { confirmed: LATER })], [
        { value: { environment: { confirmed: AT } }, conflicts: [] }, { value: { environment: { confirmed: AT } }, conflicts: [] },
      ]);
      const later = { what: 'port 5432', at: LATER, by: 'b' };
      assert.deepStrictEqual(setups({ concurrency: [] }, { concurrency: [record('port 5432', 'a')] }, { concurrency: [later] }), { value: { environment: { concurrency: [record('port 5432', 'a')] } }, conflicts: [] });
    });
  });

  it('keeps the remote\'s landing record where both clones recorded one task\'s landing in one repository differently, never a choice — either says it landed; records of other tasks or repositories joined; the project manifest\'s like any field (landing-record.cjs)', () => {
    const record = (/** @type {string} */ by) => ({ commit: 'c', tip: 't', first: 'c', by, at: 'a' });
    const here = { landings: { 'pay-1-1': { '.': record('engine'), ext: record('engine') }, 'pay-1-2': { '.': record('read') } } };
    const there = { landings: { 'pay-1-1': { '.': record('read') }, 'pay-1-3': { '.': record('engine') } } };

    assert.deepStrictEqual(merged(undefined, here, there), { value: { landings: { 'pay-1-1': { '.': record('read'), ext: record('engine') }, 'pay-1-3': { '.': record('engine') }, 'pay-1-2': { '.': record('read') } } }, conflicts: [] });
    assert.deepStrictEqual(mergeManifest(layout.projectManifest, undefined, here, there).conflicts.map((c) => c.field), [['landings', 'pay-1-1', '.', 'by']]);
  });

  it('keeps the remote\'s own branch of a unit where the clones recorded build.branch differently, never a choice, the build\'s other fields merged as any; the project manifest\'s like any field (unit-branch.cjs)', () => {
    const base = { build: { position: 'auto' } };
    const here = { build: { position: 'step', branch: 'feat/pay-here' } };
    const there = { build: { position: 'auto', branch: 'feat/pay' } };

    assert.deepStrictEqual(merged(base, here, there), { value: { build: { position: 'step', branch: 'feat/pay' } }, conflicts: [] });
    assert.deepStrictEqual(mergeManifest(layout.projectManifest, base, here, there).conflicts.map((c) => c.field), [['build', 'branch']]);
  });

  it('takes the picked side where a pick is given for the choice', () => {
    const pickOf = (choice) => (choice.field.join('.') === 'a' && choice.remote.set && choice.remote.value === 3 ? 'local' : null);
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 3 }, pickOf), { value: { a: 2 }, conflicts: [{ field: ['a'], local: { set: true, value: 2 }, remote: { set: true, value: 3 }, pick: 'local' }] });
    assert.deepStrictEqual(merged({ a: 1 }, {}, { a: 3 }, pickOf).value, {});
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 4 }, pickOf).conflicts.map((c) => c.pick), [null]);
  });

  it('names a choice by its file, its step, its field and both values, whatever the pick or the values\' key order', () => {
    const choice = { file: layout.projectManifest, uncommitted: false, field: ['a', 'b'], local: { set: true, value: { x: [1], y: 2 } }, remote: { set: false } };
    const id = choiceId(choice);
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.strictEqual(choiceId({ ...choice, local: { set: true, value: { y: 2, x: [1] } }, pick: 'local' }), id);
    for (const other of [
      { file: layout.manifest('auth-flow') }, { uncommitted: true }, { field: ['a', 'c'] },
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
    assert.deepStrictEqual(conflictLabel(layout.projectManifest, ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: 'horizon', path: 'roadmap.items.a-lifetime-tier.horizon',
    });
    assert.deepStrictEqual(conflictLabel(layout.projectManifest, ['roadmap', 'items', 'a-lifetime-tier'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: null, path: 'roadmap.items.a-lifetime-tier',
    });
    assert.deepStrictEqual(conflictLabel(layout.manifest('auth-flow'), ['build', 'plan_format'], 'Fumi'), {
      owner: "Auth Flow's manifest", subject: null, name: null, field: 'plan format', path: 'build.plan_format',
    });
  });
});
