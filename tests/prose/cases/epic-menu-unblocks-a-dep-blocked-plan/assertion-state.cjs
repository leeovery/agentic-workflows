'use strict';

// The fixture plus the one thing the walk should have done: the
// blocked dependency marked satisfied externally. Nothing else moves.

const fixture = require('./fixture-state.cjs');
const e = require('../../mainlines/epic.cjs');

module.exports = {
  build(h) {
    fixture.build(h);
    h.engine('manifest', 'set', `${e.WU}.planning.synonym-handling`,
      'external_dependencies.behavioural-ranking.state', 'satisfied_externally');
    h.engine('commit', e.WU, '-m',
      `impl(${e.WU}): mark behavioural-ranking dependency as satisfied externally`);
  },
};
