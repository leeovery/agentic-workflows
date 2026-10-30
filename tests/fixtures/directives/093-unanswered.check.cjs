'use strict';

// A fixture directive's check answering something other than its pieces.

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  check() {
    return [{ name: 'fumi/licensing', problems: 'no entry for trial-length' }];
  },
};
