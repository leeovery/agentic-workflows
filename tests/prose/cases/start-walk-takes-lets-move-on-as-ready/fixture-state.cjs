'use strict';

// A set-up project with no work in it. The baseline verdict is recorded
// through its own verb, so the one thing left unanswered is the
// walkthrough: the project manifest holds a walkthrough object with
// nothing recorded (boot reports `none`), which wins over the harness's
// pinned `skipped` and puts the walk's first screen in front of the walk.

const fs = require('fs');
const path = require('path');
const m = require('../../mainlines/feature.cjs');

module.exports = {
  build(h) {
    m.init(h);
    h.engine('baseline', 'record', 'native');
    const file = path.join(h.dir, '.workflows', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.walkthrough = {};
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  },
};
