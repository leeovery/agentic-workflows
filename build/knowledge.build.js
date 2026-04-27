// esbuild config for bundling the knowledge CLI into a single self-contained
// CJS file. The bundled output is committed to the repo — AGNTC installs
// from git tags with no build step, so the bundle must be present at tag
// time.

const path = require('path');
const esbuild = require('esbuild');

const entryPoint = path.resolve(__dirname, '..', 'src', 'knowledge', 'index.js');
const outfile = path.resolve(
  __dirname,
  '..',
  'skills',
  'workflow-knowledge',
  'scripts',
  'knowledge.cjs'
);

esbuild
  .build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    minify: true,
    // Force ESM resolution for dependencies even though we emit CJS output.
    // Orama and @msgpack/msgpack both ship ESM dists with sideEffects: false;
    // ESM resolution lets esbuild tree-shake in a way CJS barrel files block.
    // Net effect measured: ~22 KB shaved off the bundle with no behaviour change.
    conditions: ['node', 'import'],
    mainFields: ['module', 'main'],
    logLevel: 'info',
  })
  .catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
