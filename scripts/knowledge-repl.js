#!/usr/bin/env node
'use strict';

// Dev scratchpad for the knowledge base library.
//
// NOT shipped by AGNTC — lives at project root, outside skills/. Run:
//
//   node scripts/knowledge-repl.js
//   npm run knowledge:repl
//
// Drops you into a Node REPL with the built bundle pre-loaded, a fresh
// in-memory store, a StubProvider, and a handful of helpers. Top-level
// await works in the REPL on Node 18+, so you can type `await ...`
// directly at the prompt.

const os = require('os');
const path = require('path');
const repl = require('repl');

const bundle = require('../skills/workflow-knowledge/scripts/knowledge.cjs');
const { StubProvider, store } = bundle;

const DIMS = 128;

// Same fixture corpus the integration test uses — realistic enough to
// exercise BM25 ranking, enum filtering, and vector search.
const FIXTURE_DOCS = [
  {
    id: 'auth-discussion-1',
    content: 'Token refresh intervals should mirror the upstream rate limiting window.',
    work_unit: 'auth-flow', work_type: 'feature', phase: 'discussion', topic: 'auth-flow',
    confidence: 'medium',
    source_file: '.workflows/auth-flow/discussion/auth-flow.md',
    timestamp: 1700000000000,
  },
  {
    id: 'auth-spec-1',
    content: 'User identity uses UUID v7.',
    work_unit: 'auth-flow', work_type: 'feature', phase: 'specification', topic: 'auth-flow',
    confidence: 'high',
    source_file: '.workflows/auth-flow/specification/auth-flow/specification.md',
    timestamp: 1700000010000,
  },
  {
    id: 'data-research-1',
    content: 'Postgres partitioning strategies reviewed: range, list, hash.',
    work_unit: 'data-model', work_type: 'epic', phase: 'research', topic: 'data-model',
    confidence: 'low-medium',
    source_file: '.workflows/data-model/research/partitioning.md',
    timestamp: 1700000030000,
  },
  {
    id: 'data-disc-1',
    content: 'Rate limiting decision deferred to the edge gateway layer.',
    work_unit: 'data-model', work_type: 'epic', phase: 'discussion', topic: 'data-model',
    confidence: 'low',
    source_file: '.workflows/data-model/discussion/data-model.md',
    timestamp: 1700000040000,
  },
  {
    id: 'data-spec-1',
    content: 'Persist rate limiting counters in Redis with per-tenant prefixes.',
    work_unit: 'data-model', work_type: 'epic', phase: 'specification', topic: 'data-model',
    confidence: 'high',
    source_file: '.workflows/data-model/specification/data-model/specification.md',
    timestamp: 1700000050000,
  },
];

const TMP = os.tmpdir();

async function seed(targetDb) {
  if (!targetDb) throw new Error('seed(db): pass the store as the first argument');
  for (const doc of FIXTURE_DOCS) {
    await store.insertDocument(targetDb, {
      ...doc,
      embedding: provider.embed(doc.content),
    });
  }
  return `seeded ${FIXTURE_DOCS.length} documents`;
}

async function fresh() {
  return store.createStore(DIMS);
}

const BANNER = `
knowledge-base dev REPL — in-memory store, StubProvider(${DIMS})

Context:
  db                     fresh Orama store (reassignable: db = await fresh())
  provider               StubProvider(${DIMS})
  store                  { createStore, insertDocument, removeByIdentity,
                           searchFulltext, searchVector, searchHybrid,
                           saveStore, loadStore, writeMetadata, readMetadata, ... }
  StubProvider           class — build other providers
  FIXTURE_DOCS           the 5-doc sample corpus
  TMP                    ${TMP} (use for save/load paths)
  seed(db)               insert the fixture corpus into db
  fresh()                returns a new empty store

Top-level await works. Try:

  > await seed(db)
  > (await store.searchFulltext(db, { term: 'rate' })).map(h => h.id)
  > await store.searchVector(db, { vector: provider.embed('rate limiting'), similarity: 0 })
  > await store.searchHybrid(db, { term: 'rate', vector: provider.embed('rate'), similarity: 0 })
  > await store.saveStore(db, path.join(TMP, 'dev.msp'))
  > db = await store.loadStore(path.join(TMP, 'dev.msp'))
  > await store.removeByIdentity(db, { work_unit: 'auth-flow', phase: 'specification', topic: 'auth-flow' })

.exit or Ctrl-D to quit.
`;

let db;
let provider;

(async () => {
  provider = new StubProvider({ dimensions: DIMS });
  db = await store.createStore(DIMS);

  process.stdout.write(BANNER + '\n');

  const server = repl.start({ prompt: 'knowledge> ', useGlobal: false });

  // Expose everything on the REPL context. `db` is writable so users
  // can reassign it (e.g. after loadStore).
  server.context.db = db;
  server.context.provider = provider;
  server.context.store = store;
  server.context.StubProvider = StubProvider;
  server.context.FIXTURE_DOCS = FIXTURE_DOCS;
  server.context.TMP = TMP;
  server.context.path = path;
  server.context.seed = seed;
  server.context.fresh = fresh;
})().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
