'use strict';

// ---------------------------------------------------------------------------
// Any other state file both sides changed, and how the merge reads and
// writes them (workflow-engine/scripts/domain/state-merge-paths.cjs,
// domain/state-merge-blobs.cjs): text merged by place or both sides' lines
// kept, a file that is not text kept whole beside, a file and a folder kept
// apart; the state byte for byte whatever line endings the person's git
// config names; and the git calls a merge makes under the writer lock, the
// blobs read in batches, no working-tree file read whole.
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
const { git } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH, withStateLock, commitState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, pickStateMerge } = require(MERGE);
const { isolatedGit } = require(path.join(SCRIPTS, 'kernel/isolated-git.cjs'));

const { readFile } = require('./discovery-test-utils.cjs');
const { useWorld, blobId, treeId, status, commitOn, pushFailing, commitUnpushed, twoMachines, ledger, projectManifest, traced, shownChoice } = require('./state-merge-world.cjs');

/** @typedef {import('./state-merge-world.cjs').Machine} Machine */

const world = useWorld();

describe('any other file both sides changed', () => {
  it('merges changes to different places in a text file, with no warning', () => {
    const { here, there } = twoMachines({ 'unit/spec.md': '# Spec\n\none\n\ntwo\n\nthree\n' });
    commitUnpushed(here, { 'unit/spec.md': '# Spec\n\nONE\n\ntwo\n\nthree\n' });
    commitOn(there, { 'unit/spec.md': '# Spec\n\none\n\ntwo\n\nTHREE\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    assert.strictEqual(readFile(here.root, 'unit/spec.md'), '# Spec\n\nONE\n\ntwo\n\nTHREE\n');
  });

  it('keeps both sides\' lines where both changed the same place, the remote\'s first, and says so', () => {
    const { here, there } = twoMachines({ 'unit/topics/a/log.md': '# a\n' });
    commitUnpushed(here, { 'unit/topics/a/log.md': '# a\n\n## here\n' });
    commitOn(there, { 'unit/topics/a/log.md': '# a\n\n## there\n' });

    const out = catchUpState(here.root);

    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a\n\n## there\n## here\n');
    assert.deepStrictEqual(out.warnings, [
      'unit/topics/a/log.md was changed in the same place on both machines: both machines\' lines are kept there, the remote\'s first — read it through',
    ]);
  });

  it('keeps the remote\'s copy of a file that is not text at its path, and this machine\'s beside it', () => {
    const { here, there } = twoMachines({ 'unit/assets/chart.png': 'png\0base' });
    commitUnpushed(here, { 'unit/assets/chart.png': 'png\0here' });
    commitOn(there, { 'unit/assets/chart.png': 'png\0there' });
    const mine = git(here.main, ['rev-parse', `${STATE_BRANCH}:unit/assets/chart.png`]).trim();

    const out = catchUpState(here.root);

    const beside = `unit/assets/chart.${mine.slice(0, 8)}.png`;
    assert.strictEqual(readFile(here.root, 'unit/assets/chart.png'), 'png\0there');
    assert.strictEqual(readFile(here.root, beside), 'png\0here');
    assert.deepStrictEqual(out.warnings, [
      `unit/assets/chart.png was changed on both machines and is not merged line by line: the remote's copy stays at unit/assets/chart.png, and this machine's is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('reads in one batch an empty file and a file of any bytes, LFs and lines like the batch\'s own headers in it, beside text files', () => {
    const header = `${'e'.repeat(40)} 7\n`;
    const binary = (/** @type {string} */ side) => Buffer.from(`\0\n${header}${side}\n\n${header}`);
    const { here, there } = twoMachines({ 'unit/empty.md': '', 'unit/blob.bin': binary('base'), 'unit/spec.md': 'one\n\ntwo\n' });
    commitUnpushed(here, { 'unit/empty.md': 'here\n', 'unit/blob.bin': binary('here'), 'unit/spec.md': 'ONE\n\ntwo\n' });
    commitOn(there, { 'unit/empty.md': 'there\n', 'unit/blob.bin': binary('there'), 'unit/spec.md': 'one\n\nTWO\n' });

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    const beside = `unit/blob.${blobId(binary('here')).slice(0, 8)}.bin`;
    assert.deepStrictEqual([out.action, commands.filter((c) => c.startsWith("cat-file '--batch=")).length], ['merged', 1]);
    assert.strictEqual(readFile(here.root, 'unit/empty.md'), 'there\nhere\n');
    assert.strictEqual(readFile(here.root, 'unit/spec.md'), 'ONE\n\nTWO\n');
    assert.ok(fs.readFileSync(path.join(here.root, 'unit/blob.bin')).equals(binary('there')), 'the remote\'s bytes are not at the path');
    assert.ok(fs.readFileSync(path.join(here.root, beside)).equals(binary('here')), 'this machine\'s bytes are not beside it');
  });

  it('keeps whole a file whose bytes are not UTF-8, though it holds no NUL', () => {
    const latin = (/** @type {string} */ text) => Buffer.from(text, 'latin1');
    const { here, there } = twoMachines({ 'unit/notes.txt': latin('café\n\none\n\ntwo\n') });
    commitUnpushed(here, { 'unit/notes.txt': latin('café\n\nONE\n\ntwo\n') });
    commitOn(there, { 'unit/notes.txt': latin('café\n\none\n\nTWO\n') });

    const out = catchUpState(here.root);

    const beside = `unit/notes.${blobId(latin('café\n\nONE\n\ntwo\n')).slice(0, 8)}.txt`;
    assert.ok(fs.readFileSync(path.join(here.root, 'unit/notes.txt')).equals(latin('café\n\none\n\nTWO\n')), 'the remote\'s bytes are not at the path');
    assert.ok(fs.readFileSync(path.join(here.root, beside)).equals(latin('café\n\nONE\n\ntwo\n')), 'this machine\'s bytes are not beside it');
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/notes.txt']);
  });

  it('keeps a JSON file both sides changed whole, the remote\'s at its path and this machine\'s beside it, never merged line by line', () => {
    const { here, there } = twoMachines({ 'unit/data.json': '{\n  "a": 1,\n  "b": 1\n}\n', 'unit/events.jsonl': '{"n":1}\n' });
    commitUnpushed(here, { 'unit/data.json': '{\n  "a": 2,\n  "b": 1\n}\n', 'unit/events.jsonl': '{"n":1}\n{"n":2}\n' });
    commitOn(there, { 'unit/data.json': '{\n  "a": 1,\n  "b": 3\n}\n', 'unit/events.jsonl': '{"n":1}\n{"n":3}\n' });

    const out = catchUpState(here.root);

    const data = `unit/data.${blobId('{\n  "a": 2,\n  "b": 1\n}\n').slice(0, 8)}.json`;
    const events = `unit/events.${blobId('{"n":1}\n{"n":2}\n').slice(0, 8)}.jsonl`;
    assert.strictEqual(out.action, 'merged');
    assert.strictEqual(readFile(here.root, 'unit/data.json'), '{\n  "a": 1,\n  "b": 3\n}\n');
    assert.strictEqual(readFile(here.root, data), '{\n  "a": 2,\n  "b": 1\n}\n');
    assert.strictEqual(readFile(here.root, 'unit/events.jsonl'), '{"n":1}\n{"n":3}\n');
    assert.strictEqual(readFile(here.root, events), '{"n":1}\n{"n":2}\n');
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/data.json', 'unit/events.jsonl']);
  });

  it('keeps a file on the remote and a folder here apart, the remote\'s file at the path and this machine\'s folder beside it', () => {
    const { here, there } = twoMachines({ 'unit/a.md': 'a\n' });
    commitUnpushed(here, { 'unit/z/inside.md': 'inside, here\n' });
    commitOn(there, { 'unit/z': 'z, a file there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/z.${treeId(here.root, { 'inside.md': 'inside, here\n' }).slice(0, 8)}`;
    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']), `unit/a.md\nunit/z\n${beside}/inside.md\n`);
    assert.strictEqual(readFile(here.root, 'unit/z'), 'z, a file there\n');
    assert.strictEqual(readFile(here.root, `${beside}/inside.md`), 'inside, here\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/z is a file on the remote and a folder on this machine: the remote's file stays at unit/z, and this machine's folder is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('keeps a folder on the remote and a file here apart, the remote\'s folder at the path and this machine\'s file beside it', () => {
    const { here, there } = twoMachines({ 'unit/a.md': 'a\n' });
    commitUnpushed(here, { 'unit/w': 'w, a file here\n' });
    commitOn(there, { 'unit/w/inside.md': 'inside, there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/w.${blobId('w, a file here\n').slice(0, 8)}`;
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']), `unit/a.md\n${beside}\nunit/w/inside.md\n`);
    assert.strictEqual(readFile(here.root, 'unit/w/inside.md'), 'inside, there\n');
    assert.strictEqual(readFile(here.root, beside), 'w, a file here\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/w is a folder on the remote and a file on this machine: the remote's folder stays at unit/w, and this machine's file is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('keeps the changed copy of a file deleted on one side and changed on the other', () => {
    const { here, there } = twoMachines({ 'unit/notes.md': 'n\n', 'unit/brief.md': 'b\n' });
    fs.rmSync(path.join(here.root, 'unit/notes.md'));
    pushFailing(here, () => withStateLock(here.root, () => commitState(here.root, ['unit/notes.md'], 'state: drop')));
    commitUnpushed(here, { 'unit/brief.md': 'b, changed here\n' });
    fs.rmSync(path.join(there.root, 'unit/brief.md'));
    commitOn(there, { 'unit/notes.md': 'n, changed there\n' });
    withStateLock(there.root, () => commitState(there.root, ['unit/brief.md'], 'state: drop'));

    const out = catchUpState(here.root);

    assert.strictEqual(readFile(here.root, 'unit/notes.md'), 'n, changed there\n');
    assert.strictEqual(readFile(here.root, 'unit/brief.md'), 'b, changed here\n');
    assert.deepStrictEqual(out.warnings.sort(), [
      'unit/brief.md was deleted on one machine and changed on the other: the changed copy is kept',
      'unit/notes.md was deleted on one machine and changed on the other: the changed copy is kept',
    ]);
  });
});

describe('the person\'s line-ending config', () => {
  it('leaves the state byte for byte through a checkout, a state commit and a merge, its status clean, under a global config converting line endings and a global attributes file naming CRLF', () => {
    const SPEC = 'unit/spec.md';
    const IMPORT = 'unit/imports/notes.txt';
    const attributes = path.join(world(), 'attributes');
    const config = path.join(world(), 'gitconfig');
    fs.writeFileSync(attributes, '* text eol=crlf\n');
    fs.writeFileSync(config, `[core]\n\tautocrlf = true\n\tattributesFile = ${attributes}\n`);
    const pinned = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = config;
    try {
      const base = { '.ledger.jsonl': ledger('base'), [SPEC]: 'ONE\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\n' };
      const { here, there } = twoMachines(base);
      const exact = (/** @type {Machine} */ machine, /** @type {Record<string, string>} */ files) => {
        const isolated = isolatedGit(machine.root);
        assert.deepStrictEqual(Object.keys(files).map((file) => [readFile(machine.root, file), isolated.run(['cat-file', 'blob', `HEAD:${file}`])]), Object.values(files).map((text) => [text, text]));
        assert.strictEqual(isolated.run(['status', '--porcelain', '--untracked-files=all']), '');
      };
      exact(there, base);

      commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), [SPEC]: 'ONE\n\ntwo\n' });
      commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1'), [SPEC]: 'one\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
      exact(here, { '.ledger.jsonl': ledger('base', 'a1'), [SPEC]: 'one\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
      const out = catchUpState(here.root);

      assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
      exact(here, { '.ledger.jsonl': ledger('base', 'b1', 'a1'), [SPEC]: 'one\n\ntwo\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
    } finally {
      process.env.GIT_CONFIG_GLOBAL = pinned;
    }
  });
});

describe('the git calls a merge makes, all under the writer lock', () => {
  const FILES = ['unit/a.md', 'unit/b.md', 'unit/c.md'];

  /** @param {string} text */
  function each(text) {
    return Object.fromEntries(FILES.map((file) => [file, text]));
  }

  /** How many traced git calls start with `prefix`. @param {string[]} commands @param {string} prefix */
  function calls(commands, prefix) {
    return commands.filter((command) => command.startsWith(prefix)).length;
  }

  it('lists each tree and reads the working tree once, reads the blobs in two calls, and spends two more on each text file both sides changed', () => {
    const { here, there } = twoMachines(each('one\n\ntwo\n\nthree\n'));
    commitUnpushed(here, each('ONE\n\ntwo\n\nthree\n'));
    commitOn(there, each('one\n\ntwo\n\nTHREE\n'));

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    for (const file of FILES) assert.strictEqual(readFile(here.root, file), 'ONE\n\ntwo\n\nTHREE\n');
    assert.deepStrictEqual(
      ['ls-tree ', 'read-tree ', "cat-file '--batch-check=", "cat-file '--batch=", 'cat-file blob ', 'merge-file ', 'hash-object ']
        .map((prefix) => calls(commands, prefix)),
      [3, 1, 1, 1, 0, FILES.length, FILES.length],
    );
  });

  it('works the whole merge out once, at the pick that finishes it, listing each tree once; the stop and its screen read the manifests alone', () => {
    const { here, there } = twoMachines({ ...each('one\n\ntwo\n\nthree\n'), 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { ...each('ONE\n\ntwo\n\nthree\n'), 'manifest.json': projectManifest('next') });
    commitOn(there, { ...each('one\n\ntwo\n\nTHREE\n'), 'manifest.json': projectManifest('someday') });

    const stop = traced(() => catchUpState(here.root));
    const screen = traced(() => shownChoice(here));
    const pick = traced(() => pickStateMerge(here.root, '2', screen.result));

    assert.deepStrictEqual([stop.result.action, pick.result.action], ['stopped', 'merged']);
    assert.deepStrictEqual([stop, screen, pick].map((run) => calls(run.traced, 'merge-file ')), [0, 0, FILES.length]);
    assert.deepStrictEqual(['ls-tree ', 'read-tree '].map((prefix) => calls(pick.traced, prefix)), [3, 1]);
  });

  it('reads no file in the working tree whole as it lands, the ledger included', () => {
    const LOG = 'unit/topics/a/log.md';
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base'), [LOG]: '# a\n' });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), [LOG]: '# a\n\n## there\n' });
    const readWhole = fs.readFileSync;
    /** @type {string[]} */
    const readInTree = [];
    // @ts-ignore a spy on every whole read
    fs.readFileSync = (/** @type {any} */ file, /** @type {any[]} */ ...rest) => {
      if (typeof file === 'string' && file.startsWith(`${here.root}${path.sep}`) && !path.basename(file).startsWith('.lock')) readInTree.push(path.relative(here.root, file));
      return readWhole(file, ...rest);
    };
    let out;
    try {
      out = catchUpState(here.root);
    } finally {
      fs.readFileSync = readWhole;
    }

    assert.deepStrictEqual([out.action, readInTree], ['merged', []]);
    assert.strictEqual(readFile(here.root, LOG), '# a\n\n## there\n');
  });

  it('leaves no file open where writing the ledger\'s union fails part-way', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1', 'a2') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const writeSync = fs.writeSync;
    // @ts-ignore a disk that fills on the first line the union adds
    fs.writeSync = (/** @type {number} */ fd, /** @type {any} */ data, /** @type {any[]} */ ...rest) => {
      if (typeof data === 'string' && data.includes('"id":"a1"')) throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
      return writeSync(fd, data, ...rest);
    };
    const opened = () => fs.readdirSync('/dev/fd').length;
    const before = opened();
    try {
      assert.throws(() => catchUpState(here.root), /no space left on device/);
    } finally {
      fs.writeSync = writeSync;
    }

    assert.strictEqual(opened(), before);
  });
});
