'use strict';

// A project that grew up on the workflows, Folio's shape: three scaffolding
// commits (initial, setup, a setup fix) and then the workflows, with the
// feature created in the first session and nothing started since. The
// project manifest holds a baseline object with nothing recorded — boot
// reports `none` — so the walk meets workflow-start's one-time judgment
// instead of the harness's pinned verdict. Every `.workflows/` file is
// layered through the world's history so the root commit holds the
// scaffold alone and the signal reads the scaffolding as commits before
// the arrival.

const fs = require('fs');
const path = require('path');
const m = require('../../mainlines/feature.cjs');

function scaffold(h) {
  h.write('README.md', '# App\n\nA small application, set up from a config file.\n');
  h.write('workspace.json', '{\n  "name": "app",\n  "services": ["api", "app"]\n}\n');
  h.write('setup/install.sh', '#!/bin/sh\n# Build the workspace from workspace.json.\necho "setting up"\n');
  h.write('setup/README.md', 'Run `setup/install.sh` once after cloning.\n');
}

function clearVerdict(h) {
  const file = path.join(h.dir, '.workflows', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.baseline = {};
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}

/** Every `.workflows/` file the snapshot will carry, in snapshot naming. */
function workflowsFiles(h) {
  const out = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(h.dir, rel), { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (child === path.join('.workflows', '.knowledge') || child === path.join('.workflows', '.cache')) continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) out.push(entry.name === '.gitignore' ? path.join(rel, '_gitignore.fixture') : child);
    }
  };
  walk('.workflows');
  return out.sort();
}

module.exports = {
  clearVerdict,
  workflowsFiles,
  build(h) {
    scaffold(h);
    m.init(h);
    m.create(h);
    clearVerdict(h);
    h.write('.world-history.json', JSON.stringify([
      { message: 'feat: config-driven project setup', files: ['setup/install.sh', 'workspace.json'] },
      { message: 'fix(setup): capture step output to show errors on failure', files: ['setup/README.md'] },
      { message: 'research(pay): initialize exploration research', files: workflowsFiles(h) },
    ], null, 2));
  },
};
