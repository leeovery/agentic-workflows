'use strict';

// A result's excerpt: the lines of its chunk sharing the most of the query's
// words, rarer words weighing more, widened while the budget holds — never a
// heading line, the opening lines where nothing matches, and an over-long
// line cut around its matching stretch.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { tokenize } = require('../../skills/workflow-engine/scripts/kernel/knowledge/keyword.cjs');
const { excerpt } = require('../../skills/workflow-engine/scripts/kernel/knowledge/excerpt.cjs');

/** The query's words, as the search tokenizes them. @param {string} query */
const wordsOf = (query) => new Set(tokenize(query));

/** Every word weighs 1 unless `weights` names it. @param {Record<string, number>} [weights] */
const rarity = (weights = {}) => (word) => weights[word] ?? 1;

/** @param {string[]} lines */
const chunkOf = (lines) => lines.join('\n');

describe('excerpt', () => {
  it('picks the line sharing the most of the query words', () => {
    const content = chunkOf(['Tokens are opaque.', 'Refresh tokens rotate hourly.', 'Sessions end at logout.']);
    assert.deepStrictEqual(excerpt(content, wordsOf('refresh token rotation'), rarity(), 30), {
      text: 'Refresh tokens rotate hourly.',
      line: 1,
    });
  });

  it('weighs a rare word over a common one', () => {
    const content = chunkOf(['The cache holds the cache.', 'A schema version guards it.']);
    const words = wordsOf('cache schema');
    assert.strictEqual(excerpt(content, words, rarity({ cache: 1, schema: 3 }), 30).text, 'A schema version guards it.');
    assert.strictEqual(excerpt(content, words, rarity({ cache: 3, schema: 1 }), 30).text, 'The cache holds the cache.');
  });

  it('counts each word once: lines covering more of the query outweigh one repeating a word', () => {
    const content = chunkOf(['Cache cache cache cache.', 'Other text here.', 'The cache', 'has a schema.']);
    assert.deepStrictEqual(excerpt(content, wordsOf('cache schema'), rarity(), 30), { text: 'The cache\nhas a schema.', line: 2 });
  });

  it('matches words as the search does: stemmed, stop words ignored', () => {
    const content = chunkOf(['It is what it is.', 'The hook is held behind a prompt.']);
    assert.strictEqual(excerpt(content, wordsOf('holding the hooks'), rarity(), 40).text, 'The hook is held behind a prompt.');
  });

  it('widens the stretch by the lines before and after it while the budget holds, blank lines kept', () => {
    const content = chunkOf(['one', 'two', '', 'match here', 'three', 'four']);
    assert.deepStrictEqual(excerpt(content, wordsOf('match'), rarity(), 22), { text: 'two\n\nmatch here\nthree', line: 1 });
    assert.deepStrictEqual(excerpt(content, wordsOf('match'), rarity(), 25), { text: 'one\ntwo\n\nmatch here\nthree', line: 0 });
  });

  it('never shows a heading line, and never widens across one', () => {
    const content = chunkOf(['# Title', '', 'Intro text.', '## Section', 'The answer is here.', '### Sub', 'Aside.']);
    assert.deepStrictEqual(excerpt(content, wordsOf('answer'), rarity(), 500), { text: 'The answer is here.', line: 4 });
    assert.deepStrictEqual(excerpt(content, wordsOf('section title'), rarity(), 500), { text: 'Intro text.', line: 2 });
  });

  it('reads a heading-shaped line inside a fence as text', () => {
    const content = chunkOf(['## Setup', '```sh', '# install the cli', 'make install', '```']);
    assert.deepStrictEqual(excerpt(content, wordsOf('install'), rarity(), 60), {
      text: '```sh\n# install the cli\nmake install\n```',
      line: 1,
    });
  });

  it('shows the opening lines of a chunk no line of which shares a word', () => {
    const content = chunkOf(['## Context', 'First line.', 'Second line.', 'Third line.']);
    assert.deepStrictEqual(excerpt(content, wordsOf('unrelated'), rarity(), 25), { text: 'First line.\nSecond line.', line: 1 });
  });

  it('weighs a word the store does not hold at nothing', () => {
    const content = chunkOf(['Opening line.', 'A ghost word.']);
    assert.strictEqual(excerpt(content, wordsOf('ghost'), rarity({ ghost: 0 }), 15).text, 'Opening line.');
  });

  it('cuts a line over the budget at word boundaries around its matching stretch, marking each cut', () => {
    const line = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma';
    const { text } = excerpt(line, wordsOf('iota kappa'), rarity(), 24);
    assert.strictEqual(text, '…eta theta iota kappa…');
    assert.ok(text.length <= 24);
  });

  it('marks only the end a cut falls at', () => {
    const line = 'alpha beta gamma delta epsilon zeta eta theta iota kappa';
    assert.strictEqual(excerpt(line, wordsOf('alpha'), rarity(), 20).text, 'alpha beta gamma…');
    assert.strictEqual(excerpt(line, wordsOf('kappa'), rarity(), 20).text, '…theta iota kappa');
  });

  it('cuts a single word over the budget within itself', () => {
    const word = `https://example.com/${'x'.repeat(60)}`;
    const { text } = excerpt(`See ${word} for more.`, wordsOf('example'), rarity(), 20);
    assert.strictEqual(text, `…${word.slice(0, 18)}…`);
  });

  it('gives an empty excerpt for a chunk of nothing but headings', () => {
    assert.deepStrictEqual(excerpt(chunkOf(['# Title', '## Section']), wordsOf('title'), rarity(), 100), { text: '', line: 0 });
  });

  it('never runs past the budget', () => {
    const content = chunkOf(Array.from({ length: 40 }, (_, n) => `Line ${n} carries ${'word '.repeat(n % 7)}and a token${n % 5}.`));
    for (const budget of [5, 20, 60, 200, 1000]) {
      for (const query of ['token3 word', 'carries', 'nothing matches']) {
        const { text } = excerpt(content, wordsOf(query), rarity(), budget);
        assert.ok(text.length <= budget, `${JSON.stringify(query)} at ${budget}: ${text.length} characters`);
      }
    }
  });
});
