'use strict';

// The fixture plus what the walk should add: the implementation item
// from task init and its start commit, then the two confirms' copies —
// each project default landing verbatim at the topic level. The project
// defaults themselves are untouched.

const fixture = require('./fixture-state.cjs');

function build(h) {
  fixture.build(h);
  h.engine('task', 'init', 'pay', 'pay');
  h.engine('commit', 'pay', '-m', 'impl(pay): start implementation');
  h.engine('manifest', 'set', 'pay.implementation.pay', 'project_skills', fixture.SKILLS);
  h.engine('manifest', 'set', 'pay.implementation.pay', 'linters', fixture.LINTERS);
}

module.exports = { build };
