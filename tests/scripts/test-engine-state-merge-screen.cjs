'use strict';

// ---------------------------------------------------------------------------
// The stop's screen and the pick
// (workflow-engine/scripts/domain/projections/state-merge.cjs, the merge's
// pick): the shown choice, its account and its gate; and the pick and the
// screen through the engine's argv, the screen answering while a peer holds
// the writer lock, the pick waiting for it and reading the waiting merge
// again once it holds the lock.
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
const { holdLock, lockAttempts, ok, output, refuses, remoteTip, layout, commitOnState } = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { openGate } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { catchUpState, stateMergeGateSurface, stateMergeCommand } = require(MERGE);
const { choiceId, conflictLabel } = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));
const { stateMergeGate } = require(path.join(SCRIPTS, 'domain/projections/state-merge.cjs'));

const { readFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, commitUnpushed, projectManifest, keptStopFile, shownChoice } = require('./state-merge-world.cjs');

useWorld();

describe('the stop\'s screen (4.7.6)', () => {
  /** A stop as the merge keeps it. @param {object[]} conflicts */
  function stopOf(...conflicts) {
    return {
      conflicts: conflicts.map((c) => ({
        manifest: layout.projectManifest,
        uncommitted: false,
        field: ['roadmap', 'items', 'a-lifetime-tier', 'horizon'],
        local: { set: true, value: 'next' },
        remote: { set: true, value: 'someday' },
        pick: null,
        label: conflictLabel(layout.projectManifest, ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'),
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
    const stop = stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel(layout.projectManifest, ['defaults', 'plan_format'], 'Fumi'), local: { set: false }, remote: { set: true, value: { nested: ['a*b'] } } });
    const out = stateMergeGate(stop);

    assert.match(out, new RegExp(`^choice: ${choiceId(stop.conflicts[1])}$`, 'm'));
    assert.match(out, /^⚑ The state merge stopped: 2 fields changed on both machines$/m);
    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed on each machine since they last agreed:$/m);
    assert.match(out, /^> - this machine: removed$/m);
    assert.match(out, /^> - the remote: \{"nested":\\\["a\\\*b"\\\]\}$/m);
    assert.match(out, /^\*\*`◆ Which plan format does Fumi's project manifest keep\?`\*\*$/m);
  });

  it('asks the working tree\'s fields as a step of their own, naming the uncommitted copy and the update', () => {
    const planFormat = { field: ['defaults', 'plan_format'], label: conflictLabel(layout.projectManifest, ['defaults', 'plan_format'], 'Fumi'), local: { set: true, value: 'tick' }, remote: { set: true, value: 'linear' } };
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
    const out = stateMergeGate(stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel(layout.projectManifest, ['defaults', 'plan_format'], 'Fumi'), pick: 'remote' }));

    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed/m);
    auditMarkers(out, 'state merge gate');
  });

  it('asks a shorter question where the specific one would not fit the menu\'s glyph', () => {
    const name = 'an-item-whose-name-runs-long-enough-to-crowd-the-question';
    const field = ['roadmap', 'items', name, 'horizon'];
    const out = stateMergeGate(stopOf({ field, label: conflictLabel(layout.projectManifest, field, 'Fumi') }));

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
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    assert.throws(() => stateMergeGateSurface(here.main, {}), /render state-merge-gate: no state merge is waiting on a pick/);
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(stateMergeGateSurface(here.main, {}), stateMergeGate(stopOf({})));
  });
});

describe('the pick\'s command', () => {
  it('takes `pick <1|2> <choice>`; a pick leaving nothing of this clone\'s lands on the remote\'s tip with no commit', () => {
    const { here, there, bare } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    catchUpState(here.root);

    for (const argv of [['pick'], ['pick', '2'], ['choose', '1', shownChoice(here)], ['pick', '2', shownChoice(here), 'more']]) {
      assert.throws(() => stateMergeCommand(here.main, argv), /^Error: Usage: engine state-merge pick <1\|2> <choice>$/, argv.join(' '));
    }
    const out = stateMergeCommand(here.main, ['pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('someday'));
  });

  it('answers `engine state-merge pick` and `engine render state-merge-gate`, refusing where no stop waits and a pick that is none', () => {
    const { here, there, bare } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    assert.match(refuses(here.main, ['render', 'state-merge-gate']).error, /no state merge is waiting on a pick/);
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick', '1', 'a-choice']).error, 'no state merge is waiting on a pick');
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(output(here.main, ['render', 'state-merge-gate']), stateMergeGateSurface(here.main, {}));
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick']).error, 'Usage: engine state-merge pick <1|2> <choice>');
    assert.match(refuses(here.main, ['state-merge', 'pick', '3', shownChoice(here)]).error, /is 1 \(this machine's value\) or 2 \(the remote's\), got "3"/);
    const out = ok(here.main, ['state-merge', 'pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('someday'));
  });

  it('renders the stop\'s screen at once while a peer holds the writer lock, never touching the peer\'s merge files; the pick waits for the peer, then lands', (t) => {
    const { here, there, bare } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    catchUpState(here.root);
    const screen = stateMergeGateSurface(here.main, {});
    const choice = shownChoice(here);
    const lock = holdLock(path.join(here.root, layout.lock));
    const gitDir = path.dirname(keptStopFile(here.root));
    const peers = [path.join(gitDir, 'leeway-merge-files', 'blobs'), path.join(gitDir, 'leeway-merge.index')];
    fs.mkdirSync(path.dirname(peers[0]));
    for (const file of peers) fs.writeFileSync(file, 'the peer\'s merge');
    /** @type {string[]} */
    const whileHeld = [];
    // The peer lets go at the pick's second attempt: it found the lock held, and waited.
    const attempts = lockAttempts(t, lock, (taken) => {
      whileHeld.push(readFile(here.root, layout.projectManifest));
      if (taken === 2) fs.unlinkSync(lock);
    });

    assert.strictEqual(output(here.main, ['render', 'state-merge-gate']), screen);
    assert.deepStrictEqual(attempts, [], 'the screen tried the lock');
    assert.deepStrictEqual(peers.map((file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8')), ['the peer\'s merge', 'the peer\'s merge']);
    const out = ok(here.main, ['state-merge', 'pick', '2', choice]);

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.deepStrictEqual(whileHeld, [projectManifest('next'), projectManifest('next')], 'the pick landed while the peer held the lock');
    assert.deepStrictEqual([out.action, out.commit], ['fast-forwarded', remoteTip(bare)]);
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('someday'));
  });

  it('reads the waiting merge again under the lock: one a peer finished while the pick waited takes no pick', (t) => {
    const { here, there } = machinesSharing({ [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    catchUpState(here.root);
    const choice = shownChoice(here);
    const stop = keptStopFile(here.root);
    const lock = holdLock(path.join(here.root, layout.lock));
    // The peer finishes the merge, its stop gone, and lets go once the pick has found the lock held and tried again.
    const attempts = lockAttempts(t, lock, (taken) => {
      if (taken < 2) return;
      fs.rmSync(stop);
      fs.unlinkSync(lock);
    });

    // Called below the engine's entry, which takes the writer lock for every command before the pick runs.
    assert.throws(() => stateMergeCommand(here.main, ['pick', '2', choice]), { message: 'no state merge is waiting on a pick' });

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made']);
    assert.ok(!fs.existsSync(stop), 'the pick wrote back the stop the peer finished');
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('next'));
  });
});
