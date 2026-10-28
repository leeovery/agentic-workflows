'use strict';

// ---------------------------------------------------------------------------
// The ledger through a catch-up (workflow-engine/scripts/domain/state-merge.cjs
// with domain/ledger.cjs): a landing a kill cut short finished under the
// writer lock by a ledger read, an append or a ledger verb, which hands on
// what the landing said, and by boot's commit of the entries a killed write
// left uncommitted before it counts them; and the merge's own commit checked
// against the remote's ledger, one that fails landing nothing and pushing
// nothing.
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
const { execFileSync } = require('child_process');
const { git, ok, refuses, tip, remoteTip } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH, withStateLock } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { readLedger, appendEntry, ledgerChange, ledgerStopSurface, commitUncommitted } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { LedgerChanged } = require(path.join(SCRIPTS, 'domain/ledger-check.cjs'));
const { catchUpState } = require(MERGE);

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, blobId, commitOn, commitUnpushed, twoMachines, entry, ledger, json, mergeLeftovers, withPath, killedAfter } = require('./state-merge-world.cjs');

const world = useWorld();

describe('the ledger through a catch-up', () => {
  const ASKED = { event: 'asked', unit: 'fumi', topic: 'a', phase: 'discussion', session: 's1', by: 'claude', who_moved_whom: 'none', part_of: null, relies_on: [] };

  /** A ledger line of a question asked. @param {string} text */
  function askedLine(text) {
    return entry(validEvent({ ...ASKED, v: 1, id: newId(), at: '2026-10-27T09:00:00Z', text }));
  }

  const CHART = 'unit/assets/chart.png';
  const UNIT = { 'fumi/manifest.json': json({ name: 'fumi', work_type: 'epic', status: 'in-progress', phases: { discussion: { items: { a: { status: 'in-progress' } } } } }) };
  const ASKING = JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Asked after the kill?' });
  const DECIDING = JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Decided after the kill.', why: 'A reason.' });
  const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 's1' });

  /** What the landing says of the chart both machines changed. */
  function chartNote() {
    const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;
    return `${CHART} was changed on both machines and is not merged line by line: the remote's copy stays at ${CHART}, and this machine's is kept beside it as ${beside}`;
  }

  /**
   * A landing a kill cut short here, after it moved the files and before it
   * moved the branch: the chart changed on both machines, and the ledger too
   * where `ledgers` gives each machine's own line.
   * @param {{here: string, there: string}|null} ledgers
   */
  function killedLanding(ledgers) {
    const base = askedLine('Base?');
    const { here, there } = twoMachines({ '.ledger.jsonl': base, ...UNIT, [CHART]: 'png\0base' });
    commitUnpushed(here, { [CHART]: 'png\0here', ...(ledgers && { '.ledger.jsonl': `${base}${ledgers.here}` }) });
    commitOn(there, { [CHART]: 'png\0there', ...(ledgers && { '.ledger.jsonl': `${base}${ledgers.there}` }) });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');
    return { here, base };
  }

  for (const [what, act] of /** @type {[string, (root: string, notes: string[]) => unknown][]} */ ([
    ['a read', (root, notes) => [...readLedger(root, notes)]],
    ['an append', (root, notes) => appendEntry(root, { ...ASKED, text: 'Asked after the kill?' }, notes)],
    ['a ledger write, among its warnings', (root, notes) => notes.push(...ok(path.dirname(root), ['ledger', 'ask', 'fumi.discussion.a'], { env: SESSION, stdin: ASKING }).warnings)],
    ['a ledger write the fold under the lock then refuses, among its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'decide', 'fumi.discussion.a', '--answers', 'Zz9Zz9'], { env: SESSION, stdin: DECIDING });
      assert.strictEqual(res.error, 'ledger decide --answers: no ledger entry\'s id begins "Zz9Zz9"');
      notes.push(...res.warnings);
    }],
    ['a replacement the fold before the lock then refuses, among its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'replace', 'fumi.discussion.a', '--replaces', 'Zz9Zz9', '--reason', 'changed-mind'], { env: SESSION, stdin: DECIDING });
      assert.strictEqual(res.error, 'ledger replace --replaces: no ledger entry\'s id begins "Zz9Zz9"');
      notes.push(...res.warnings);
    }],
  ])) {
    it(`finishes a landing a kill cut short at ${what}, under the writer lock, so nothing the landing wrote reads as this machine's change, and hands on what the landing said`, () => {
      const [a1, b1] = ['Here?', 'There?'].map(askedLine);
      const { here, base } = killedLanding({ here: a1, there: b1 });
      assert.strictEqual(readFile(here.root, '.ledger.jsonl'), `${base}${b1}${a1}`, 'the kill left no merged ledger on disk');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]), `${base}${a1}`, 'the kill left the branch moved');
      /** @type {string[]} */
      const notes = [];

      act(here.root, notes);

      assert.ok(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]).startsWith(`${base}${b1}${a1}`));
      assert.ok(readFile(here.root, '.ledger.jsonl').startsWith(`${base}${b1}${a1}`));
      assert.deepStrictEqual(mergeLeftovers(here.root), []);
      assert.deepStrictEqual(notes, [chartNote()]);
    });
  }

  for (const [what, act] of /** @type {[string, (root: string, notes: string[]) => void][]} */ ([
    ['a read', (root, notes) => assert.throws(() => [...readLedger(root, notes)], LedgerChanged)],
    ['an append', (root, notes) => assert.throws(() => appendEntry(root, { ...ASKED, text: 'Asked after the kill?' }, notes), LedgerChanged)],
    ['a ledger write, in its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'ask', 'fumi.discussion.a'], { env: SESSION, stdin: ASKING });
      assert.deepStrictEqual([res.stop, res.error], ['ledger', '.ledger.jsonl changed outside the engine: line 1 is not the line committed there — the engine stops here']);
      notes.push(...res.warnings);
    }],
  ])) {
    it(`hands on what a landing it finished at ${what} said, though the engine then stops on a ledger changed outside it`, () => {
      const { here } = killedLanding(null);
      createFile(here.root, '.ledger.jsonl', askedLine('Changed by hand?'));
      /** @type {string[]} */
      const notes = [];

      act(here.root, notes);

      assert.deepStrictEqual(mergeLeftovers(here.root), [], 'the landing was not finished');
      assert.deepStrictEqual(notes, [chartNote()]);
    });
  }

  it('counts no entry of a fast-forward a kill cut short as one a write left uncommitted: the landing is finished first, and nothing else committed', () => {
    const base = askedLine('Base?');
    const there1 = askedLine('There?');
    const { here, there } = twoMachines({ '.ledger.jsonl': base, ...UNIT });
    const remote = commitOn(there, { '.ledger.jsonl': `${base}${there1}` }).commit;
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');
    assert.deepStrictEqual([readFile(here.root, '.ledger.jsonl'), git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`])], [`${base}${there1}`, base], 'the kill did not leave the remote\'s ledger written and the branch unmoved');

    assert.deepStrictEqual(withStateLock(here.root, () => commitUncommitted(here.root, 'state: the tail')), { entries: 0, warnings: [] });

    assert.strictEqual(tip(here.main, STATE_BRANCH), remote);
    assert.deepStrictEqual(mergeLeftovers(here.root), []);
  });

  it('checks the merge\'s own commit against the remote\'s ledger: one that fails lands nothing, pushes nothing, and the stop shows the line the check found', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const before = { tip: tip(here.main, STATE_BRANCH), remote: remoteTip(bare), disk: readFile(here.root, '.ledger.jsonl') };
    const tampered = JSON.stringify({ v: 1, id: 'tampered', event: 'decided' });
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    fs.writeFileSync(path.join(wrapper, 'git'), [
      '#!/bin/sh',
      'case "$*" in',
      `  *hash-object*union) for a; do f="$a"; done; printf '%s\\n' '${tampered}' > "$f" ;;`,
      'esac',
      `exec "${real}" "$@"`,
      '',
    ].join('\n'), { mode: 0o755 });

    assert.throws(() => withPath(wrapper, () => catchUpState(here.root)),
      (err) => err instanceof LedgerChanged && JSON.stringify(err.change) === JSON.stringify({ line: 1, found: tampered }) && /— nothing committed$/.test(err.message));

    assert.deepStrictEqual({ tip: tip(here.main, STATE_BRANCH), remote: remoteTip(bare), disk: readFile(here.root, '.ledger.jsonl') }, before);
    assert.strictEqual(ledgerChange(here.root), null, 'the disk is not as the branch committed it');
    assert.match(ledgerStopSurface(here.main, {}), /line 1 isn't the line the state branch last committed there\. The line it found:\n>   \{"v":1,"id":"tampered","event":"decided"\}\n/);
  });
});
