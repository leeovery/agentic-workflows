'use strict';

// The feature exists and nothing has been started. The project manifest
// holds a baseline object with nothing recorded — the never-judged state
// boot reports as `none` — so the walk meets workflow-start's one-time
// judgment instead of the harness's pinned verdict.

const fs = require('fs');
const path = require('path');
const m = require('../../mainlines/feature.cjs');

function clearVerdict(h) {
  const file = path.join(h.dir, '.workflows', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.baseline = {};
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}

module.exports = {
  clearVerdict,
  build(h) {
    m.init(h);
    m.create(h);
    clearVerdict(h);
  },
};
