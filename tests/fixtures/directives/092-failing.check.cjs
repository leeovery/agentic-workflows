'use strict';

// A fixture directive's check that fails as it runs.

module.exports = {
  counts: 'topic',
  check() {
    throw new Error('the old manifests could not be read');
  },
};
