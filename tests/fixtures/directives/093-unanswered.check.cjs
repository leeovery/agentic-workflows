'use strict';

// A fixture directive's check answering something other than its pieces.

module.exports = {
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  partWay: 'A record it was in the middle of is amended from where it stood.',
  check() {
    return [{ name: 'fumi/licensing', problems: 'no entry for trial-length' }];
  },
};
