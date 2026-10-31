'use strict';

// ---------------------------------------------------------------------------
// The worlds and helpers of discovery's gate suites (test-engine-start-this-
// work.cjs, test-engine-approve-map.cjs, test-engine-workunit-create.cjs's
// creations through the gate). Each is built once per process through the
// verbs and copied for each test, its trust log in a config folder of the
// test's own:
// - before the work: the product's conversation open on its first session,
//   its log holding two sections; an idea and a bug in the inbox; the
//   roadmap holding three waiting ideas, `lifetime-tier`, `note-sync` and
//   `share-links`, and a waiting bug, `export-timeout`; a feature, `atlas`,
//   under way; and keyword-only knowledge;
// - an epic to shape: that world with the epic `fumi` started from
//   `share-links`, its first discovery session open and its map empty but
//   for `dock-badge`, struck from it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, output, fixtureFrom, cleanupFixture, statePath, writeState, layout, keywordOnlyKnowledge, commitOnState } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { SESSION } = require('./ledger-world.cjs');

const PRODUCT_LOG = layout.productSession('001');
const IDEA = layout.inbox('ideas', '2026-06-01--smart-retry.md');
const BUG = layout.inbox('bugs', '2026-06-02--login-loop.md');
const EPIC = 'fumi';

/** @param {string} dir */
function beforeTheWork(dir) {
  keywordOnlyKnowledge(dir);
  ok(dir, ['workunit', 'create', 'atlas', 'feature', '--description', 'Maps', '--session-log-file', writeState(dir, layout.cache('atlas', 'session-001.md'), '# Atlas\n')]);
  ok(dir, ['enter', 'discovery', 'product']);
  writeState(dir, PRODUCT_LOG, '# The product\n\n## Notes {#notes}\n\nStickies, but smarter.\n\n## Pricing {#pricing}\n\nOne-time.\n');
  commitOnState(statePath(dir), { [IDEA]: '# Smart Retry\n', [BUG]: '# Login Loop\n' }, 'inbox: two captures');
  ok(dir, ['roadmap', 'add', 'lifetime-tier', '--horizon', 'later', '--summary', 'A lifetime tier']);
  ok(dir, ['roadmap', 'add', 'note-sync', '--horizon', 'next', '--summary', 'Notes synced between Macs']);
  ok(dir, ['roadmap', 'add', 'share-links', '--horizon', 'next', '--summary', 'Share a note by a link']);
  ok(dir, ['roadmap', 'add', 'export-timeout', '--horizon', 'next', '--summary', 'Large exports time out', '--kind', 'bug']);
}

const worlds = {
  start: fixtureFrom('discovery-gates-', beforeTheWork),
  epic: fixtureFrom('discovery-epic-', (dir) => {
    beforeTheWork(dir);
    const start = { type: 'epic', name: EPIC, description: 'Stickies, but smarter.', reason: 'An epic: its parts each need decisions.', roadmap: ['share-links'], shaped_by: [`${PRODUCT_LOG}#notes`] };
    output(dir, ['render', 'start-this-work', '--file', writeState(dir, layout.cache('scratch', 'start.json'), JSON.stringify(start))]);
    ok(dir, ['start-this-work', 'yes']);
    ok(dir, ['topic', 'add', EPIC, 'dock-badge', '--summary', 'A badge on the dock', '--brief', writeState(dir, layout.cache('scratch', 'dock-badge.md'), '# Dock badge\n')]);
    ok(dir, ['topic', 'remove', EPIC, 'dock-badge']);
  }),
};

/**
 * A world for each test of the calling file, copied before it and removed
 * after it, its trust log in a config folder of its own.
 * @param {keyof typeof worlds} [which]
 * @returns {() => string} the running test's project
 */
function useGatesWorld(which = 'start') {
  const config = useTempFolder('discovery-gates-config-');
  /** @type {string} */
  let dir;
  /** @type {string|undefined} */
  let pinned;
  beforeEach(() => {
    dir = worlds[which]();
    pinned = process.env.LEEWAY_CONFIG_DIR;
    process.env.LEEWAY_CONFIG_DIR = config();
  });
  afterEach(() => {
    process.env.LEEWAY_CONFIG_DIR = pinned;
    cleanupFixture(dir);
  });
  return () => dir;
}

/**
 * The gate suites' helpers, over the project `dir()` names.
 * @param {() => string} dir
 */
function gatesHelpers(dir) {
  let drafts = 0;

  /** A file of Claude's in the cache holding `content`: its path. @param {string} content @param {string} [ext] */
  function scratch(content, ext = 'md') {
    drafts += 1;
    const file = statePath(dir(), '.cache', 'scratch', `draft-${drafts}.${ext}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  }

  /** Claude's payload written to the cache: its path. @param {unknown} given */
  function payload(given) {
    return scratch(JSON.stringify(given), 'json');
  }

  /** A render of `surface`, its payload staged from `given` where one is. @param {string[]} args @param {unknown} [given] */
  function screen(args, given) {
    return output(dir(), ['render', ...args, ...(given === undefined ? [] : ['--file', payload(given)])], { env: SESSION });
  }

  /** The person's answer at the gate shown: what it leads to. @param {string} name @param {string} key */
  function answer(name, key) {
    return ok(dir(), ['gate', name, '--pick', key], { env: SESSION }).next;
  }

  /** What a gate's `next` of kind engine runs, answered. @param {{kind: string, argv: string[]}} next */
  function run(next) {
    assert.strictEqual(next.kind, 'engine');
    return ok(dir(), next.argv, { env: SESSION });
  }

  return { scratch, payload, screen, answer, run };
}

/**
 * Every write to `file` throwing as a full disk's does while `fn` runs: a
 * failure part-way through what `fn` writes.
 * @template T @param {string} file absolute @param {() => T} fn @returns {T}
 */
function failingWrites(file, fn) {
  const real = fs.writeFileSync;
  fs.writeFileSync = (/** @type {Parameters<typeof real>} */ ...args) => {
    if (args[0] === file) throw new Error('disk full');
    return real(...args);
  };
  try {
    return fn();
  } finally {
    fs.writeFileSync = real;
  }
}

/** The temp file an atomic write of a manifest in `folder` writes first. @param {string} folder absolute */
const manifestTemp = (folder) => path.join(folder, `.manifest.json.${process.pid}.tmp`);

module.exports = { PRODUCT_LOG, IDEA, BUG, EPIC, SESSION, useGatesWorld, gatesHelpers, failingWrites, manifestTemp };
