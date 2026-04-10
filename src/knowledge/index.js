// Entry point for the knowledge CLI. Later Phase 1 tasks replace the
// trivial Orama/MsgPack round-trip below with real store, provider, and
// persistence code.

const { create, insert, search } = require('@orama/orama');
const { encode, decode } = require('@msgpack/msgpack');
const { StubProvider } = require('./embeddings');
const store = require('./store');

async function selfCheck() {
  const db = await create({
    schema: {
      text: 'string',
    },
  });
  await insert(db, { text: 'hello knowledge base' });
  const results = await search(db, { term: 'knowledge' });

  const packed = encode({ hits: results.count });
  const unpacked = decode(packed);

  return {
    scriptDir: __dirname,
    oramaHits: results.count,
    msgpackRoundtripHits: unpacked.hits,
  };
}

async function main() {
  const info = await selfCheck();
  process.stdout.write(JSON.stringify(info) + '\n');
}

module.exports = { selfCheck, main, StubProvider, store };

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
}
