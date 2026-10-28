'use strict';

// ---------------------------------------------------------------------------
// The stop's screen and the pick
// (workflow-engine/scripts/domain/projections/state-merge.cjs, the merge's
// pick): the shown choice, its account and its gate; and the pick and the
// screen through the engine's CLI, the screen answering while a peer holds
// the writer lock.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine", each with
// its state worktree made through the machinery (state-merge-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ENGINE, ok, output, refuses } = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { openGate } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { catchUpState, stateMergeGateSurface, stateMergeCommand } = require(MERGE);
const { choiceId, conflictLabel } = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));
const { stateMergeGate } = require(path.join(SCRIPTS, 'domain/projections/state-merge.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));

const {
  useWorld, read, remoteTip, commitOn, commitUnpushed, twoMachines, projectManifest, keptStopFile, shownChoice,
} = require('./state-merge-world.cjs');

useWorld();

describe('the stop\'s screen (4.7.6)', () => {
  /** A stop as the merge keeps it. @param {object[]} conflicts */
  function stopOf(...conflicts) {
    return {
      conflicts: conflicts.map((c) => ({
        manifest: 'manifest.json',
        uncommitted: false,
        field: ['roadmap', 'items', 'a-lifetime-tier', 'horizon'],
        local: { set: true, value: 'next' },
        remote: { set: true, value: 'someday' },
        pick: null,
        label: conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'),
        ...c,
      })),
    };
  }

  it('draws the shown choice\'s identity, the title, the account with both values, the question and one numbered row per side', () => {
    const stop = stopOf({});
    const out = stateMergeGate(stop);

    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      `choice: ${choiceId(stop.conflicts[0])}`,
      '',
      '=== DISPLAY: state merge stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The state merge stopped: one field changed on both machines',
      '',
      '=== DISPLAY: state merge account (emit verbatim as markdown (not a code block)) ===',
      '> In Fumi\'s project manifest, the horizon of the roadmap item "A lifetime tier" changed on each machine since they last agreed:',
      '>',
      '> - this machine: next',
      '> - the remote: someday',
      '>',
      '> The engine takes a field from one side only where the other left it alone or set it the same, so it stops here for you to pick.',
      '',
      '=== MENU: state merge gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which horizon does "A lifetime tier" keep?`**',
      '',
      '**`1`** → next — *this machine\'s*',
      '**`2`** → someday — *the remote\'s*',
      '',
    ].join('\n'));
    auditMarkers(out, 'state merge gate');
  });

  it('states the gate for the gate surface, its rows the two sides', () => {
    const gate = announced(() => {
      openGate();
      return auditGate(stateMergeGate(stopOf({})), 'state merge gate');
    });

    assert.strictEqual(gate.gate, 'state merge gate');
    assert.strictEqual(gate.question, 'Which horizon does "A lifetime tier" keep?');
    assert.deepStrictEqual(gate.options.map((o) => [o.key, o.head, o.tail]), [['1', 'next', "this machine's"], ['2', 'someday', "the remote's"]]);
  });

  it('shows the first conflict still open, counted among them all', () => {
    const stop = stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), local: { set: false }, remote: { set: true, value: { nested: ['a*b'] } } });
    const out = stateMergeGate(stop);

    assert.match(out, new RegExp(`^choice: ${choiceId(stop.conflicts[1])}$`, 'm'));
    assert.match(out, /^⚑ The state merge stopped: 2 fields changed on both machines$/m);
    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed on each machine since they last agreed:$/m);
    assert.match(out, /^> - this machine: removed$/m);
    assert.match(out, /^> - the remote: \{"nested":\\\["a\\\*b"\\\]\}$/m);
    assert.match(out, /^\*\*`◆ Which plan format does Fumi's project manifest keep\?`\*\*$/m);
  });

  it('asks the working tree\'s fields as a step of their own, naming the uncommitted copy and the update', () => {
    const planFormat = { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), local: { set: true, value: 'tick' }, remote: { set: true, value: 'linear' } };
    const out = stateMergeGate(stopOf({ pick: 'remote' }, { uncommitted: true, local: { set: true, value: 'never' } }, { ...planFormat, uncommitted: true }));

    assert.match(out, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed 2 fields differently$/m);
    assert.match(out, /^> Field 1 of 2\. In Fumi's project manifest, the horizon of the roadmap item "A lifetime tier" changed in this machine's uncommitted copy, and differently in the update from the remote:$/m);
    assert.match(out, /^> - this machine's uncommitted copy: never$/m);
    assert.match(out, /^> - the update from the remote: someday$/m);
    assert.match(out, /^\*\*`1`\*\* → never — \*this machine's uncommitted copy\*$/m);
    assert.match(out, /^\*\*`2`\*\* → someday — \*the remote's\*$/m);
    assert.doesNotMatch(out, /since they last agreed/);

    const single = stateMergeGate(stopOf({ pick: 'remote' }, { uncommitted: true }));
    assert.match(single, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed one field differently$/m);
    assert.match(single, /^> In Fumi's project manifest, the horizon/m);
  });

  it('shows the last conflict of a stop with every one picked, never failing on it', () => {
    const out = stateMergeGate(stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), pick: 'remote' }));

    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed/m);
    auditMarkers(out, 'state merge gate');
  });

  it('asks a shorter question where the specific one would not fit the menu\'s glyph', () => {
    const name = 'an-item-whose-name-runs-long-enough-to-crowd-the-question';
    const field = ['roadmap', 'items', name, 'horizon'];
    const out = stateMergeGate(stopOf({ field, label: conflictLabel('manifest.json', field, 'Fumi') }));

    assert.match(out, /^\*\*`◆ Which horizon stays\?`\*\*$/m);
    assert.match(out, /the horizon of the roadmap item "An item whose name runs long enough to crowd the question" changed/);
  });

  it('clips a long value in its row, and shows it whole in the account', () => {
    const long = 'x'.repeat(60);
    const out = stateMergeGate(stopOf({ local: { set: true, value: long } }));

    assert.match(out, new RegExp(`^> - this machine: ${long}$`, 'm'));
    assert.match(out, new RegExp(`^\\*\\*\`1\`\\*\\* → ${'x'.repeat(39)}… — \\*this machine's\\*$`, 'm'));
  });

  it('renders through its surface, and refuses where no stop waits', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    assert.throws(() => stateMergeGateSurface(here.main, {}), /render state-merge-gate: no state merge is waiting on a pick/);
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(stateMergeGateSurface(here.main, {}), stateMergeGate(stopOf({})));
  });
});

describe('the pick\'s command', () => {
  it('takes `pick <1|2> <choice>`; a pick leaving nothing of this clone\'s lands on the remote\'s tip with no commit', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    for (const argv of [['pick'], ['pick', '2'], ['choose', '1', shownChoice(here)], ['pick', '2', shownChoice(here), 'more']]) {
      assert.throws(() => stateMergeCommand(here.main, argv), /^Error: Usage: engine state-merge pick <1\|2> <choice>$/, argv.join(' '));
    }
    const out = stateMergeCommand(here.main, ['pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });

  it('answers `engine state-merge pick` and `engine render state-merge-gate`, refusing where no stop waits and a pick that is none', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    assert.match(refuses(here.main, ['render', 'state-merge-gate']).error, /no state merge is waiting on a pick/);
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick', '1', 'a-choice']).error, 'no state merge is waiting on a pick');
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(output(here.main, ['render', 'state-merge-gate']), stateMergeGateSurface(here.main, {}));
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick']).error, 'Usage: engine state-merge pick <1|2> <choice>');
    assert.match(refuses(here.main, ['state-merge', 'pick', '3', shownChoice(here)]).error, /is 1 \(this machine's value\) or 2 \(the remote's\), got "3"/);
    const out = ok(here.main, ['state-merge', 'pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });

  it('renders the stop\'s screen at once while a peer holds the writer lock, never touching the peer\'s merge files; the pick waits for the peer, then lands', async () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);
    const screen = stateMergeGateSurface(here.main, {});
    const choice = shownChoice(here);
    const lock = path.join(here.root, '.lock');
    const live = JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) });
    fs.writeFileSync(lock, live);
    const gitDir = path.dirname(keptStopFile(here.root));
    const peers = [path.join(gitDir, 'leeway-merge-files', 'blobs'), path.join(gitDir, 'leeway-merge.index')];
    fs.mkdirSync(path.dirname(peers[0]));
    for (const file of peers) fs.writeFileSync(file, 'the peer\'s merge');

    const shown = spawnSync('node', [ENGINE, 'render', 'state-merge-gate'], { cwd: here.main, encoding: 'utf8', timeout: 10000 });
    assert.deepStrictEqual([shown.signal, shown.status, shown.stdout], [null, 0, screen], shown.stderr);
    assert.deepStrictEqual(peers.map((file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8')), ['the peer\'s merge', 'the peer\'s merge']);
    const picking = spawn('node', [ENGINE, 'state-merge', 'pick', '2', choice], { cwd: here.main });
    let answer = '';
    picking.stdout.on('data', (chunk) => { answer += chunk; });
    const exit = new Promise((resolve) => picking.on('close', resolve));
    const raced = await Promise.race([exit.then(() => 'exited'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 1500))]);
    assert.strictEqual(raced, 'waiting', 'the pick did not wait on the peer');
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next'));
    fs.unlinkSync(lock);

    assert.strictEqual(await exit, 0);
    assert.deepStrictEqual(JSON.parse(answer), { ...JSON.parse(answer), ok: true, action: 'fast-forwarded', commit: remoteTip(bare) });
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });
});
