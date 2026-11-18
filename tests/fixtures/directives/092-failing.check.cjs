'use strict';

// A fixture directive's check that fails as it runs.

module.exports = {
  does: 'This step writes a record of each topic.',
  counts: { one: 'topic', many: 'topics' },
  done: 'have their records',
  partWay: 'A record it was in the middle of is amended from where it stood.',
  check() {
    throw new Error('the old manifests could not be read');
  },
};
