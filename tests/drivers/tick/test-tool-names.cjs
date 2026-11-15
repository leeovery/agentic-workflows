'use strict';

// ---------------------------------------------------------------------------
// The forms the tool-name scan finds Tick in (tests/scripts/tool-names.cjs,
// as tool-names.cjs here declares them; 7.1.10): a command or a flag, a
// spawn of its binary, run onto the next line or not, a constant holding
// it, an install, its package, its store and its ids — and the words prose
// and code use for other things, the spec page's "Tick a line" and its
// review marks among them, passed.
//
// Layer: unit. World: texts, read.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { toolNamesIn } = require('../../scripts/tool-names.cjs');

/** The forms a text names Tick in, each once. @param {string} text */
const formsIn = (text) => [...new Set(toolNamesIn(text).filter(({ driver }) => driver === 'tick').map(({ form }) => form))];

describe('Tick as the tool-name scan finds it (7.1.10)', () => {
  it('finds each form Tick is named in', () => {
    const cases = [
      ['run `tick create "Title"` in the store', ['a command']],
      ['tick --json list', ['a command']],
      ['tick --toon list', ['a command']],
      ['tick --pretty show tick-a1b2c3', ['a command', 'its ids']],
      ['tick -q ready', ['a command']],
      ['tick --version', ['a command']],
      ['tick help create', ['a command']],
      ['brew install leeovery/tick', ['an install', 'its package']],
      ['brew install tick', ['an install']],
      ['the store at .tick/tasks.jsonl', ['its store']],
      ['closed tick-a1b2c3 by hand', ['its ids']],
      ["spawnSync('tick', ['version'])", ['a spawn of its binary']],
      ['execa(`tick`, args)', ['a spawn of its binary']],
      ["const TOOL = 'tick';", ['a constant holding its binary']],
    ];
    assert.deepStrictEqual(cases.map(([text]) => formsIn(String(text))), cases.map(([, forms]) => forms));
  });

  it('finds a spawn run onto the next line on the line it opens', () => {
    assert.deepStrictEqual(toolNamesIn("const a = 1;\nconst ran = spawnSync(\n  'tick',\n  ['version'],\n);").map(({ line, form }) => [line, form]), [[2, 'a spawn of its binary']]);
  });

  it('passes the words prose and code use for other things', () => {
    for (const text of [
      'Tick a line you agree with, or comment on it.',
      'a tick closes the line\'s conversation',
      "if (mark.s === 'tick') state = 'approved';",
      "const STATUSES = ['tick', 'comment', ''];",
      '--tick: #1b7a4e;',
      'next tick saved 0',
      'the ticket at tick-box.md',
      'a tick\ncreates nothing',
    ]) assert.deepStrictEqual(formsIn(text), [], text);
  });
});
