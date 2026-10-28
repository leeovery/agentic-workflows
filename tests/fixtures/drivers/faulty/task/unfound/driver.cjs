'use strict';

module.exports = require('../../../fixture-driver.cjs')({
  kind: 'task',
  name: 'unfound',
  isDefault: false,
  needs: [{ tool: 'unfound-cli', floor: '1.0.0', update: 'https://example.invalid/unfound-cli' }],
});
