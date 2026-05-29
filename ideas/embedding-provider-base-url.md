# Embedding Provider `base_url` Override

> **✅ Done.** Shipped as a new selectable `openai-compatible` provider rather than an in-place `base_url` flag on `OpenAIProvider`. During discussion the scope grew from "add a flag" to a thin-driver split over a shared `OpenAIEmbeddingsEngine`, because three behaviours genuinely fork (dimensions param, optional auth, error remedies) and an in-place flag opened a correctness hole. `base_url` is consumed only by `openai-compatible` (ignored under `openai`); the key is optional (stored credentials only, no env var); zero migrations (existing `provider: openai` setups are byte-identical). See `src/knowledge/providers/openai-engine.js`, `openai-compatible.js`, and `tests/scripts/test-knowledge-openai-compatible.cjs`.

## The Idea

Add a `base_url` config option to `OpenAIProvider` so the knowledge base can talk to any OpenAI-compatible embeddings endpoint — LM Studio, Ollama (via its OpenAI-compat shim), vLLM, LiteLLM, Azure OpenAI, etc. — without a new provider class.

## Why This Matters

The knowledge base CLI is already driver-based: a four-method interface (`embed`, `embedBatch`, `dimensions`, `model`) in `src/knowledge/embeddings.js`, with `OpenAIProvider` as the only real implementation. Users who want local embeddings currently have no supported path — at least one user has resorted to patching the minified bundle to redirect requests to LM Studio.

A `base_url` override is the cheapest possible unlock. LM Studio and most local inference servers expose an OpenAI-compatible `/v1/embeddings` endpoint, so the existing provider class already speaks the right protocol — it just needs to be allowed to point somewhere other than `api.openai.com`.

## What It Would Look Like

Config:

```json
{
  "provider": "openai",
  "base_url": "http://localhost:1234/v1",
  "model": "nomic-embed-text-v1.5"
}
```

Changes:

1. `OpenAIProvider` accepts `base_url` in its constructor options; defaults to `https://api.openai.com/v1`
2. `resolveProvider()` in `config.js` passes `base_url` through from the merged config
3. API key becomes optional when `base_url` is non-default (local servers don't require one) — or accept any non-empty string for compatibility
4. `setup.js` prompts for `base_url` after provider choice (default empty → OpenAI cloud)
5. Validation embed call in setup uses the configured `base_url`

Zero bundle-size impact — same provider class, one extra config field.

## Design Tensions

- **Stored-vector compatibility**: `model` and `dimensions` are baked into the store at index time. Switching `base_url` to a different model invalidates existing vectors — same constraint that already exists for OpenAI model changes, so the existing "provider/model changed — run rebuild" guard covers it
- **Key handling**: Local servers don't need an API key. Either make key optional when `base_url` is set, or accept a placeholder. Avoid silently sending real OpenAI keys to non-OpenAI endpoints
- **Endpoint quirks**: Not every "OpenAI-compatible" server is fully compatible (batch limits, dimensions parameter support, response shape edge cases). Worth a setup-time validation call that surfaces the actual failure
- **Discoverability**: Users won't know this works unless we document it. Setup prompt + a line in the knowledge base reference

## Broader Application

If someone needs a genuinely different API (native Ollama `/api/embeddings`, Voyage, Cohere), the existing driver pattern still supports a dedicated provider class — ~5KB of bundle per provider, marginal. But `base_url` covers most "I want local embeddings" requests for free, and is the right first step before adding more provider classes.
