'use strict';

// ---------------------------------------------------------------------------
// The engine's own layouts as a call made from inside one meets them
// (ledger-engine/scripts/kernel/code-root.cjs): a folder of a layout by a
// name only the engine gives — a quick-fix's or a one-line task's, of a
// unit the state holds, or a kind's and a dot — stands for the same folder
// of the project's checkout, or, where the checkout lacks it or holds a
// file in its place, the nearest folder up it holds, its top at most
// (`outsideLayouts`); a file there has its
// copy at the same place in the checkout (`checkoutPath`); and a worktree
// of the person's own named like one — for no unit the state holds, and no
// kind — is none of the engine's. A call handed by a layout's own copy of
// the engine to the checkout's (ledger-engine/scripts/kernel/call.cjs,
// `handedToCheckout`) says why where that copy cannot start, exiting 1, and
// ends by the signal that ended it; a verb run there by the layout's own
// copy is test-engine-quick-fix-worktree-engine.cjs's.
//
// Layer: unit. World: a plain folder standing for the main checkout, the
// state holding one unit, each layout a folder beside the isolation
// worktrees; a hand-off's start stood in for.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const { useTempFolder } = require('./discovery-test-utils.cjs');
const { outsideLayouts, checkoutPath } = require('../../skills/ledger-engine/scripts/kernel/code-root.cjs');

const checkout = useTempFolder('code-root-');
const SCRIPTS = path.join('.claude', 'skills', 'ledger-engine', 'scripts');
const KERNEL = path.join(__dirname, '../../skills/ledger-engine/scripts/kernel');

/** A folder of the layout `name`, by its parts below it, made. @param {string} name @param {...string} parts */
function layoutFolder(name, ...parts) {
  const folder = path.join(checkout(), '.claude', 'worktrees', name, ...parts);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

beforeEach(() => {
  fs.mkdirSync(path.join(checkout(), '.ledger', 'typo'), { recursive: true });
  fs.writeFileSync(path.join(checkout(), '.ledger', 'typo', 'manifest.json'), '{}');
  fs.mkdirSync(path.join(checkout(), 'src'));
});

describe('a call made from inside one of the engine\'s own layouts', () => {
  it('from a folder of a layout the engine names — a quick-fix\'s and a one-line task\'s of a unit the state holds, a kind\'s — stands for the same folder of the checkout, and from the layout\'s top for the checkout\'s', () => {
    const made = ['ledger-typo', 'ledger-typo-1.2', 'ledger-scratch.typo-tests', 'ledger-mutants.typo-phase-1'].map((name) => outsideLayouts(layoutFolder(name, 'src')));

    assert.deepStrictEqual([...made, outsideLayouts(layoutFolder('ledger-typo'))], [...made.map(() => path.join(checkout(), 'src')), checkout()]);
  });

  it('from a folder the checkout lacks, or holds a file in the place of, stands for the nearest folder up it holds, the checkout\'s top at most', () => {
    const deep = layoutFolder('ledger-typo', 'pkg', 'new');
    const before = outsideLayouts(deep);
    fs.mkdirSync(path.join(checkout(), 'pkg'));
    fs.writeFileSync(path.join(checkout(), 'src', 'flags'), 'a file\n');

    assert.deepStrictEqual([before, outsideLayouts(deep), outsideLayouts(layoutFolder('ledger-typo', 'src', 'flags'))], [checkout(), path.join(checkout(), 'pkg'), path.join(checkout(), 'src')]);
  });

  it('from a worktree of the person\'s own named like the engine\'s — for no unit the state holds, a one-line task\'s of none, no kind — stands for itself', () => {
    const own = ['ledger-export', 'ledger-other-1.2', 'ledger-reports.q3'].map((name) => layoutFolder(name, 'src'));

    assert.deepStrictEqual(own.map(outsideLayouts), own);
  });

  it('a file of a layout the engine names has its copy at the same place in the checkout, there or not; one of no layout, or of the person\'s own, has none', () => {
    const engine = path.join('.claude', 'skills', 'ledger-engine', 'scripts', 'engine.cjs');

    assert.deepStrictEqual([
      checkoutPath(path.join(layoutFolder('ledger-typo'), engine)), checkoutPath(path.join(checkout(), engine)), checkoutPath(path.join(layoutFolder('ledger-export'), engine)),
    ], [path.join(checkout(), engine), null, null]);
  });
});

/**
 * A call handed by the engine's copy in a quick-fix's layout to the
 * checkout's, the checkout's copy's start answering `ran`: whether it was
 * handed, the exit code it left, what it said on stderr, and the signals it
 * raised on itself.
 * @param {import('node:test').TestContext} t @param {Partial<ReturnType<typeof childProcess.spawnSync>>} ran
 */
function handedAs(t, ran) {
  fs.cpSync(KERNEL, path.join(layoutFolder('ledger-typo', SCRIPTS), 'kernel'), { recursive: true });
  fs.mkdirSync(path.join(checkout(), SCRIPTS), { recursive: true });
  fs.writeFileSync(path.join(checkout(), SCRIPTS, 'engine.cjs'), '');
  const { handedToCheckout } = require(path.join(checkout(), '.claude', 'worktrees', 'ledger-typo', SCRIPTS, 'kernel', 'call.cjs'));
  /** @type {string[]} */
  const said = [];
  /** @type {(string|number|undefined)[]} */
  const raised = [];
  const before = process.exitCode;
  const mocks = [
    t.mock.method(childProcess, 'spawnSync', () => ({ status: null, signal: null, ...ran })),
    t.mock.method(process.stderr, 'write', (/** @type {string} */ text) => said.push(text) > 0),
    t.mock.method(process, 'kill', (/** @type {number} */ _pid, /** @type {string} */ signal) => raised.push(signal) > 0),
  ];
  try {
    const handed = handedToCheckout(['task', 'done', 'typo', '1.1']);
    return { handed, code: process.exitCode, said, raised };
  } finally {
    for (const mock of mocks) mock.mock.restore();
    process.exitCode = before;
  }
}

describe('a call handed to the checkout\'s copy of the engine', () => {
  it('where that copy cannot start, says why on stderr and exits 1; where a signal ends it, ends by the same signal', (t) => {
    const unstarted = handedAs(t, { error: new Error('spawn EAGAIN') });
    const signalled = handedAs(t, { signal: 'SIGTERM' });

    assert.deepStrictEqual([unstarted, signalled], [
      { handed: true, code: 1, said: ['spawn EAGAIN\n'], raised: [] },
      { handed: true, code: 1, said: [], raised: ['SIGTERM'] },
    ]);
  });
});
