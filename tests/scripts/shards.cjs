'use strict';

// A suite too long for one process, run as several side by side so the
// run's pool spreads it. The suite is its own first shard; each further
// shard is a file beside it, `{suite}-shard-{n}.cjs`, that runs the suite as
// shard n. The suite registers its tests through `shardedIt`, which deals
// them round the shards in the order they are registered, each to exactly
// one. The shard count is the files there are, numbered 2 on without a gap,
// and every one of them must be in the `npm test` script — a suite whose
// shards break either rule refuses to load, so no share of it goes unrun.

const fs = require('fs');
const path = require('path');
const { it } = require('node:test');

/** @type {{suite: string, shard: number}|null} the shard this process runs, where a shard file started it */
let running = null;

/**
 * The suite's shard count, its shard files checked against the folder they
 * sit in and the `npm test` script that must run each.
 * @param {string} suite absolute path @param {string} script the `npm test` script
 * @returns {number}
 */
function shardCount(suite, script) {
  const named = new RegExp(`^${path.basename(suite, '.cjs')}-shard-(\\d+)\\.cjs$`);
  const files = fs.readdirSync(path.dirname(suite)).filter((name) => named.test(name));
  const numbers = files.map((name) => Number(/** @type {RegExpExecArray} */ (named.exec(name))[1])).sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 2)) {
    throw new Error(`${path.basename(suite)}'s shards are numbered ${numbers.join(', ')} — they run from 2 on, with no gap`);
  }
  const run = script.split(/\s+/);
  const unrun = files.filter((name) => !run.includes(path.posix.join('tests/scripts', name)));
  if (unrun.length > 0) throw new Error(`the npm test script does not run ${unrun.join(', ')}`);
  return files.length + 1;
}

/**
 * Whether the test registered `dealt`-th (from 0) is shard `shard`'s of `count`.
 * @param {number} dealt @param {number} count @param {number} shard from 1
 */
function dealtTo(dealt, count, shard) {
  return dealt % count === shard - 1;
}

/**
 * The suite's `it`, registering only the tests the running shard holds.
 * @param {string} suite the suite's own `__filename`
 * @returns {typeof it}
 */
function shardedIt(suite) {
  const script = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')).scripts.test;
  const count = shardCount(suite, script);
  const shard = running !== null && running.suite === suite ? running.shard : 1;
  let dealt = 0;
  return /** @type {typeof it} */ ((...args) => {
    const mine = dealtTo(dealt, count, shard);
    dealt += 1;
    return mine ? it(...args) : undefined;
  });
}

/**
 * Run the suite a shard file names as that shard.
 * @param {string} shardFile the shard file's own `__filename`
 */
function runShard(shardFile) {
  const named = /^(.*)-shard-(\d+)\.cjs$/.exec(shardFile);
  if (named === null) throw new Error(`${shardFile} is not named {suite}-shard-{n}.cjs`);
  running = { suite: `${named[1]}.cjs`, shard: Number(named[2]) };
  require(running.suite);
}

module.exports = { shardCount, dealtTo, shardedIt, runShard };
