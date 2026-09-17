'use strict';

// The bug is captured and the investigation has not begun — the same
// starting world the symptom interview uses, with the screenshot the user
// will offer sitting where they saved it.

const m = require('../../mainlines/bugfix.cjs');

// A real 16×16 PNG. The file type is the point: it keeps its extension, it
// is tracked on the manifest and never embedded, and nothing about it
// normalises to `.md`.
const SHOT_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGklEQVR42mNQIBEwAPEd'
  + 'osGohlENA62BJAAAaOgP73FPJbcAAAAASUVORK5CYII=',
  'base64',
);

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    h.write('notes/checkout-500.png', SHOT_BYTES);
  },
};
