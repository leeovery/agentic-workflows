'use strict';

// `engine knowledge` as a real process: what only the CLI shows — the exit
// code a verb's answer sets once the process ends, a waiting verb's among
// them, which stream each answer goes to, and the terminal the process hands
// the setup wizard only when stdin is one. Process layer: the engine
// spawned, over the project world, keyword-only. Every verb's answer is its
// verb suite's (test-engine-knowledge-*.cjs, in process); that the two doors
// answer alike is test-engine-run.cjs's.

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');

const { ENGINE } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture } = require('./discovery-test-utils.cjs');
const { configureKnowledge } = require('./knowledge-harness.cjs');

describe('engine knowledge, spawned', () => {
  let root;

  /** The CLI's answer to `engine knowledge <args>`, `input` piped to its stdin. @param {string[]} args @param {string} [input] */
  function knowledge(args, input = '') {
    const { status, stdout, stderr } = spawnSync('node', [ENGINE, 'knowledge', ...args], { cwd: root, input, encoding: 'utf8', timeout: 30000 });
    return { code: status, stdout, stderr };
  }

  before(() => {
    root = setupFixture('kb-door-');
    configureKnowledge(root, { provider: null });
  });

  after(() => cleanupFixture(root));

  it('exits 1 with its usage on stderr alone when no command is given, and names an unknown one before the usage', () => {
    const bare = knowledge([]);
    assert.strictEqual(bare.code, 1);
    assert.strictEqual(bare.stdout, '');
    assert.match(bare.stderr, /^Usage: engine knowledge <command> \[options\]\n/);
    const unknown = knowledge(['foobar']);
    assert.deepStrictEqual({ ...unknown, stderr: '' }, { code: 1, stdout: '', stderr: '' });
    assert.ok(unknown.stderr.startsWith(`Unknown command "foobar".\n\n${bare.stderr}`), unknown.stderr);
  });

  it('exits with a waiting verb\'s own code once it settles: 0 with its answer on stdout, 1 with its error on stderr alone', () => {
    const answered = knowledge(['query', 'anything']);
    assert.deepStrictEqual(answered, { code: 0, stdout: '[0 results]\n', stderr: '' });
    const refused = knowledge(['query', '']);
    assert.strictEqual(refused.code, 1);
    assert.strictEqual(refused.stdout, '');
    assert.match(refused.stderr, /^Error: Empty search term\. /);
  });

  it('hands the setup wizard no terminal when stdin is piped, so it refuses before it asks anything', () => {
    assert.deepStrictEqual(knowledge(['setup'], '\n'), {
      code: 1,
      stdout: '',
      stderr: 'engine knowledge setup requires an interactive terminal. Run it directly, not through Claude or a pipe.\n',
    });
  });
});
