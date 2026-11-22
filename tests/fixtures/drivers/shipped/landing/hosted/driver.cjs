'use strict';

module.exports = require('../../../fixture-driver.cjs')(
  { kind: 'landing', name: 'hosted', isDefault: false },
  { methods: { serves: (/** @type {string} */ url) => /[@/]github\.com[:/]/i.test(url) } },
);
