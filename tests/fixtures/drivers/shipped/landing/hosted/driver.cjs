'use strict';

const { githubRepository } = require('../../../../../../skills/workflow-engine/scripts/domain/remote.cjs');

module.exports = require('../../../fixture-driver.cjs')(
  { kind: 'landing', name: 'hosted', isDefault: false },
  { methods: { serves: (/** @type {string} */ url) => githubRepository(url) !== null } },
);
