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
    logLevel: 'info',
  })
  .catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
