'use strict';

// ---------------------------------------------------------------------------
// The tracker and the code host's CLI named only in their drivers (7.1.10,
// 7.2.13, 7.S2), by the scan in tool-names.cjs: its forms find a tool's
// command, a spawn of its binary, its package, its store and its ids, and
// pass the bare words prose and code use for other things; run over the
// skills, the references, the agent definitions and the engine's code —
// released migrations, the drivers and test fixtures aside, and nothing
// else — it finds neither tool, where it finds both in the drivers.
//
// Layer: unit. World: the repository's own files, read.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { NAMED_HERE, toolNamesIn, shippedFiles, REPO } = require('./tool-names.cjs');

/** The forms a text names a tool in, each once. @param {string} text */
const formsIn = (text) => [...new Set(toolNamesIn(text).map(({ tool, form }) => `${tool}: ${form}`))];

describe('the tool-name scan (7.1.10, 7.2.13)', () => {
  it('finds each form a tool is named in', () => {
    assert.deepStrictEqual([
      'run `tick create "Title"` in the store',
      'tick --json list',
      'brew install leeovery/tick',
      'the store at .tick/tasks.jsonl',
      'closed tick-a1b2c3 by hand',
      'gh pr view 12',
      'gh --version',
      'gh extension install github/gh-stack',
      'updates at https://cli.github.com',
      "spawnSync('tick', ['version'])",
      'execFileSync("gh", args)',
    ].map(formsIn), [
      ['tracker: a command'],
      ['tracker: a command'],
      ['tracker: its package'],
      ['tracker: its store'],
      ['tracker: its ids'],
      ['code host: a command'],
      ['code host: a command'],
      ['code host: a command', 'code host: its package'],
      ['code host: its package'],
      ['either: a spawn of its binary'],
      ['either: a spawn of its binary'],
    ]);
  });

  it('passes the bare words prose and code use for other things', () => {
    for (const text of [
      'Tick a line you agree with, or comment on it.',
      'a tick closes the line\'s conversation',
      "if (mark.s === 'tick') state = 'approved';",
      '--tick: #1b7a4e;',
      'next tick saved 0',
      'Publish failure swallows gh stderr',
      'the ticket at tick-box.md',
    ]) assert.deepStrictEqual(toolNamesIn(text), [], text);
  });

  it('7.S2: names neither tool in the skills, the references, the agent definitions or the engine\'s code, released migrations aside', () => {
    const files = shippedFiles();
    const found = files.flatMap((rel) => toolNamesIn(fs.readFileSync(path.join(REPO, rel), 'utf8')).map(({ line, text }) => `${rel}:${line}: ${text}`));

    assert.ok(files.includes(path.join('agents', 'leeway-builder.md')) && files.includes(path.join('skills', 'leeway-engine', 'scripts', 'engine.cjs')), 'the scan reads the agents and the engine');
    assert.deepStrictEqual(found, []);
  });

  it('finds both tools in their drivers, which the rule lets name them', () => {
    const drivers = path.join(REPO, NAMED_HERE[0]);
    const forms = fs.readdirSync(drivers, { recursive: true, encoding: 'utf8' })
      .filter((rel) => rel.endsWith('.cjs'))
      .flatMap((rel) => toolNamesIn(fs.readFileSync(path.join(drivers, rel), 'utf8')).map(({ tool }) => tool));

    assert.deepStrictEqual([forms.includes('tracker'), forms.includes('code host')], [true, true]);
  });
});
