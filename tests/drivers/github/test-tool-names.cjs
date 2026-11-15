'use strict';

// ---------------------------------------------------------------------------
// The forms the tool-name scan finds GitHub's CLI in (tests/scripts/
// tool-names.cjs, as tool-names.cjs here declares them; 7.1.10): a command
// or a flag, a spawn of its binary, run onto the next line or not, its
// binary quoted bare — in a constant, an argument list or a code span — an
// install, and its packages; and a unit's name that says gh in passing,
// passed; and in help, its name as a word, which that name says (23.1.3).
//
// Layer: unit. World: texts, read.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { toolNamesIn, helpNamesIn } = require('../../scripts/tool-names.cjs');

/** The forms a text names GitHub's CLI in, each once. @param {string} text */
const formsIn = (text) => [...new Set(toolNamesIn(text).filter(({ driver }) => driver === 'github').map(({ form }) => form))];

describe('GitHub\'s CLI as the tool-name scan finds it (7.1.10)', () => {
  it('finds each form GitHub\'s CLI is named in', () => {
    const cases = [
      ['gh pr view 12', ['a command']],
      ['gh --version', ['a command']],
      ['gh -R o/r pr list', ['a command']],
      ['gh --repo o/r issue list', ['a command']],
      ...['workflow run', 'browse', 'label list', 'ruleset list', 'search prs', 'secret set', 'status', 'project list', 'gist create'].map((rest) => [`gh ${rest}`, ['a command']]),
      ['gh extension install github/gh-stack', ['a command', 'its package']],
      ['updates at https://cli.github.com', ['its package']],
      ['execFileSync("gh", args)', ['a spawn of its binary', 'its binary quoted']],
      ["execa('gh', ['pr', 'list'])", ['a spawn of its binary', 'its binary quoted']],
      ["const BIN = 'gh';", ['a constant holding its binary', 'its binary quoted']],
      ["run(['gh','pr','view'])", ['its binary quoted']],
      ['needs `gh` installed', ['its binary quoted']],
      ['brew install gh', ['an install']],
    ];
    assert.deepStrictEqual(cases.map(([text]) => formsIn(String(text))), cases.map(([, forms]) => forms));
  });

  it('finds a spawn run onto the next line on the line it opens', () => {
    assert.deepStrictEqual(formsIn('spawnSync(\n  "gh",\n  args)'), ['a spawn of its binary', 'its binary quoted']);
    assert.deepStrictEqual([...new Set(toolNamesIn('spawnSync(\n  "gh",\n  args)').map(({ line, form }) => `${line} ${form}`))], ['1 a spawn of its binary', '2 its binary quoted']);
  });

  it('passes a unit\'s name that says gh in passing', () => {
    for (const text of ['Publish failure swallows gh stderr', 'the gh-pages branch', 'a high road']) assert.deepStrictEqual(formsIn(text), [], text);
  });

  it('finds GitHub\'s CLI by its name in help', () => {
    const named = (/** @type {string} */ text) => helpNamesIn(text).some(({ driver, form }) => driver === 'github' && form === 'its name');

    assert.deepStrictEqual(['Publish failure swallows gh stderr', 'the GitHub CLI opens the pull request', 'a high road', 'see github.com/leeovery'].map(named), [true, true, false, false]);
  });
});
