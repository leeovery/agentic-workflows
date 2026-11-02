'use strict';

// ---------------------------------------------------------------------------
// The mutation tool over a phase's lines (leeway-engine/scripts/domain/
// verify.cjs, `verify mutants`): the tool is handed the lines the phase's
// commits changed in every repository of the checkout, as they stand at HEAD,
// and the verb answers what survived on them, read whatever the tool's exit
// code, each survivor's path read as the project's, a survivor on none of the
// changed files refused — writing nothing (15.S9, 15.6.3, 15.6.6).
//
// Layer: git. World: verify-world.cjs's, the setup recorded.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, refusedPristine, commitCode, initRepo, cleanupFixture, createFile, treeSnapshot, head } = require('./engine-harness.cjs');
const { UNIT, SETUP, steer, steering, setupArgs, world } = require('./verify-world.cjs');

/** @type {string} */ let dir;
afterEach(() => cleanupFixture(dir));

describe('verify mutants: the mutation tool over a phase\'s lines (15.6.3, 15.6.6)', () => {
  beforeEach(() => { dir = world(); });

  /** A code commit of `files` in `repo`, its message closing on `trailer`. @param {string} repo @param {Record<string, string>} files @param {string} trailer */
  function commitWith(repo, files, trailer) {
    for (const [file, text] of Object.entries(files)) createFile(repo, file, text);
    commitCode(repo, `feat(pay): work\n\n${trailer}`);
  }

  /** The phase's commits — its own, another unit's of a like name, and the next phase's — in the root and in a nested repository. */
  function phaseWork() {
    commitWith(dir, { 'src/card.js': 'const card = 1;\nconst brand = "visa";\nconst cvc = 3;\n' }, 'Leeway-Task: pay-1-1');
    commitWith(dir, { 'src/other.js': 'other\n' }, 'Leeway-Task: pay-1-2-1');
    commitWith(dir, { 'src/form.js': 'a\nb\n', 'src/card.js': 'const card = 1;\nconst brand = "visa";\nconst cvc = 4;\n' }, 'Leeway-Task: pay-1-2');
    commitWith(dir, { 'src/refund.js': 'refund\n' }, 'Leeway-Task: pay-2-1');
    const lib = initRepo(path.join(dir, 'lib'));
    createFile(lib, 'x.js', 'x\n');
    commitCode(lib, 'init');
    commitWith(lib, { 'x.js': 'x\ny\n' }, 'Leeway-Task: pay-1-1');
  }

  /** The survivors the tool reports, written for it. @param {unknown} survivors */
  const surviving = (survivors) => steering(dir, 'survivors.json', JSON.stringify(survivors));

  it('15.S9: the tool is handed the lines the phase\'s commits changed in every repository, as they stand at HEAD, and the verb answers the survivors on them alone — a path given from `./`, absolute or nested read as the project\'s — writing nothing, whatever the tool\'s exit code', () => {
    phaseWork();
    surviving([
      { path: './src/card.js', line: 2, mutant: 'string "visa" → ""' },
      { path: path.join(dir, 'src', 'form.js'), line: 1, mutant: 'removed' },
      { path: 'lib/x.js', line: 2, mutant: 'y → z' },
      { path: 'src/card.js', line: 1, mutant: '1 → 0' },
    ]);
    steering(dir, 'fail-mutate', '3');
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    const res = ok(dir, ['verify', 'mutants', UNIT, '1']);

    assert.deepStrictEqual(res, { ok: true, unit: UNIT, phase: 1, survivors: [
      { path: 'src/card.js', line: 2, mutant: 'string "visa" → ""' },
      { path: 'src/form.js', line: 1, mutant: 'removed' },
      { path: 'lib/x.js', line: 2, mutant: 'y → z' },
    ] });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(steer(dir), 'changed.json'), 'utf8')), [
      { path: 'src/card.js', lines: [[2, 3]] },
      { path: 'src/form.js', lines: [[1, 2]] },
      { path: 'lib/x.js', lines: [[2, 2]] },
    ]);
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before);
  });

  it('a survivor naming none of the files the phase changed — another phase\'s, or a nested repository\'s path from its own root — is refused, naming each and the path\'s form', () => {
    phaseWork();
    surviving([{ path: 'src/refund.js', line: 1, mutant: 'removed' }, { path: 'x.js', line: 2, mutant: 'y → z' }, { path: 'src/card.js', line: 2, mutant: 'kept' }]);

    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the mutation tool named src/refund.js, x.js, none of the files the phase changed — a survivor\'s path is the project\'s, from its root, as $LEEWAY_CHANGED names each file');
  });

  it('survivors the tool did not write are refused with its exit code and output, and survivors not of their shape are refused', () => {
    phaseWork();
    steering(dir, 'fail-mutate', '2');
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the mutation tool wrote no $LEEWAY_RUN/survivors.json — it writes what survived there, [] where nothing did; it exited 2. The last of its output, 40 lines at most:\nmutants survived');
    for (const written of ['not json', JSON.stringify([{ path: 'src/card.js', line: '2', mutant: 'x' }]), JSON.stringify({ survivors: [] })]) {
      steering(dir, 'survivors.json', written);
      assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error, 'verify mutants: the mutation tool\'s survivors.json is not a list of {path, line, mutant}');
    }
  });

  it('refused: a setup naming no mutation tool, a phase beyond the cut, and a phase with no commit in the checkout', () => {
    const { mutation: _mutation, ...without } = SETUP;
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '3']).error, 'verify mutants: "3" is no phase of pay\'s cut — it has 2 phases');
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error, `verify mutants: no commit of phase 1 of pay changes a line in the checkout at ${dir} — run it from the checkout holding the phase's work`);
    steering(dir, 'verdict', 'pass\n');
    ok(dir, setupArgs(dir, without));
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the verify setup names no mutation tool — where the language has none, each reviewer breaks the riskiest line of a criterion\'s code in a scratch worktree (15.6.5)');
  });
});
