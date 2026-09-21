'use strict';

// Manual smoke test — the OpenAI provider against the real API. Outside the
// automated suite (which never reaches a provider) by name and by list; run
// by hand with a key in the environment:
//   OPENAI_API_KEY=… node --test tests/scripts/knowledge-openai-smoke.cjs

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { OpenAIProvider, DEFAULT_DIMENSIONS } = require('../../src/knowledge/providers/openai');

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
