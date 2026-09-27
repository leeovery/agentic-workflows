'use strict';

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { stem } = require('../../src/knowledge/stemmer.js');

/** Words of Snowball's English vocabulary, each beside the stem its reference output gives. */
const SAMPLE = path.resolve(__dirname, '..', 'fixtures', 'knowledge', 'porter2', 'sample.txt');

describe('knowledge stemmer — Porter2', () => {
  it('stems every word of the Snowball vocabulary sample as the reference output does', () => {
    const pairs = fs.readFileSync(SAMPLE, 'utf8').split('\n').filter(Boolean).map((line) => line.split('\t'));
    assert.ok(pairs.length > 300, `${pairs.length} pairs`);
    const wrong = pairs
      .filter(([word, expected]) => stem(word) !== expected)
      .map(([word, expected]) => `${word} → ${stem(word)}, not ${expected}`);
    assert.deepStrictEqual(wrong, []);
  });

  it('stems the words the tokenizer keeps whole — hyphens, digits and underscores — as one word', () => {
    assert.strictEqual(stem('rate-limiting'), 'rate-limit');
    assert.strictEqual(stem('v2_final'), 'v2_final');
    assert.strictEqual(stem('__proto__'), '__proto__');
    assert.strictEqual(stem('2026'), '2026');
  });
});
