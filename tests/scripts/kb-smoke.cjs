'use strict';
// Manual smoke test — exercises every Orama API path through the built
// bundle after the ESM-resolution change. Not wired into the automated
// suite — run ad hoc when verifying bundle-level changes.

const path = require('path');
const fs = require('fs');
const os = require('os');

const bundle = require(path.resolve(__dirname, '..', '..', 'skills', 'workflow-knowledge', 'scripts', 'knowledge.cjs'));
const { StubProvider, store } = bundle;
const {
  createStore, insertDocument, removeByFilter,
  searchFulltext, searchVector, searchHybrid,
  saveStore, loadStore, writeMetadata, readMetadata,
} = store;

const DIMS = 128;
const provider = new StubProvider({ dimensions: DIMS });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-smoke-'));
const storePath = path.join(dir, 'store.msp');
const metaPath = path.join(dir, 'metadata.json');

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log('  PASS:', label);
  } else {
    console.log('  FAIL:', label);
    failures++;
  }
}

async function main() {
  console.log('Smoke test: ESM-resolved bundle end-to-end\n');

  const db = await createStore(DIMS);
  check('create store with vector schema', db !== null);

  const workUnits = ['auth-flow', 'data-model', 'billing'];
  const phases = ['discussion', 'specification', 'research'];
  let inserted = 0;
  for (let i = 0; i < 100; i++) {
    const wu = workUnits[i % 3];
    const phase = phases[i % 3];
    const embedding = await provider.embed('content ' + i + ' ' + wu + ' ' + phase);
    await insertDocument(db, {
      id: wu + '-' + phase + '-t' + i + '-001',
      content: 'Document ' + i + ' about ' + phase + ' in ' + wu + '. Token refresh and rate limiting.',
      work_unit: wu,
      work_type: 'feature',
      phase: phase,
      topic: 't' + i,
      confidence: i % 4 === 0 ? 'high' : 'medium',
      source_file: '.workflows/' + wu + '/' + phase + '/t' + i + '.md',
      timestamp: Date.now() - i * 86400000,
      embedding: embedding,
    });
    inserted++;
  }
  check('inserted 100 docs', inserted === 100);

  const ftRes = await searchFulltext(db, {
    term: 'refresh',
    where: { work_unit: { eq: 'auth-flow' } },
    limit: 50,
  });
  check('fulltext search returns results', ftRes.length > 0);
  check('fulltext where filter honoured', ftRes.every(function (r) { return r.work_unit === 'auth-flow'; }));

  const qVec = await provider.embed('token refresh design');
  const vecRes = await searchVector(db, { vector: qVec, limit: 10, similarity: 0.1 });
  check('vector search returns results', vecRes.length > 0);

  const hybRes = await searchHybrid(db, {
    term: 'rate limiting',
    vector: qVec,
    limit: 10,
    similarity: 0.5,
  });
  check('hybrid search returns results', hybRes.length > 0);

  // Trigger the #15 fallback: term has matches but vector has none above threshold
  const gibberishVec = new Array(DIMS).fill(0.0001);
  const fallbackRes = await searchHybrid(db, {
    term: 'refresh',
    vector: gibberishVec,
    limit: 10,
    similarity: 0.99,
  });
  check('hybrid → fulltext fallback when no vector hits', fallbackRes.length > 0);

  const removed = await removeByFilter(db, { work_unit: { eq: 'billing' } });
  check('removeByFilter returned count > 0', removed > 0);
  const afterRemove = await searchFulltext(db, {
    term: '',
    where: { work_unit: { eq: 'billing' } },
    limit: 100,
  });
  check('removeByFilter actually removed docs', afterRemove.length === 0);

  await saveStore(db, storePath);
  const stat = fs.statSync(storePath);
  check('store saved to disk', stat.size > 0);
  console.log('    store size on disk: ' + (stat.size / 1024).toFixed(1) + ' KB');

  writeMetadata(metaPath, {
    provider: 'stub',
    model: 'stub',
    dimensions: DIMS,
    last_indexed: new Date().toISOString(),
    pending: [],
  });
  const meta = readMetadata(metaPath);
  check('metadata round-trip', meta.provider === 'stub' && meta.dimensions === DIMS);

  const db2 = await loadStore(storePath);
  const afterLoadFt = await searchFulltext(db2, { term: 'refresh', limit: 100 });
  check('loaded store serves fulltext', afterLoadFt.length > 0);

  // Vector search on the loaded store proves embeddings survived the round-trip
  // internally — Orama doesn't echo the embedding field back on hits by design,
  // so we can't assert on it directly; correct search results are the real signal.
  const afterLoadVec = await searchVector(db2, { vector: qVec, limit: 5, similarity: 0.1 });
  check('loaded store serves vector', afterLoadVec.length > 0);

  const afterLoadHyb = await searchHybrid(db2, {
    term: 'rate',
    vector: qVec,
    limit: 5,
    similarity: 0.3,
  });
  check('loaded store serves hybrid', afterLoadHyb.length > 0);

  console.log('\n' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'));
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(function (e) {
  console.error(e);
  process.exit(2);
});
