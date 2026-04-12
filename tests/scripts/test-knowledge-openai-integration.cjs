'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { OpenAIProvider, DEFAULT_DIMENSIONS } = require('../../src/knowledge/providers/openai');

// This test hits the real OpenAI API. Skipped unless OPENAI_API_KEY is set.

describe('OpenAIProvider integration (real API)', { skip: !process.env.OPENAI_API_KEY }, () => {
  const provider = process.env.OPENAI_API_KEY
    ? new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  it('embeds a single string and returns a vector of correct dimensions', async () => {
    const vec = await provider.embed('The quick brown fox jumps over the lazy dog');
    assert.ok(Array.isArray(vec));
    assert.strictEqual(vec.length, DEFAULT_DIMENSIONS);
    assert.ok(vec.every((v) => typeof v === 'number' && Number.isFinite(v)));
  });

  it('batch embeds multiple strings and returns correct count', async () => {
    const texts = ['hello world', 'knowledge base embeddings'];
    const vecs = await provider.embedBatch(texts);
    assert.strictEqual(vecs.length, 2);
    assert.strictEqual(vecs[0].length, DEFAULT_DIMENSIONS);
    assert.strictEqual(vecs[1].length, DEFAULT_DIMENSIONS);
  });
});
