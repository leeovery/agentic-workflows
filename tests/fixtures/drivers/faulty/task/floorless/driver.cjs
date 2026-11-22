'use strict';

module.exports = require('../../../fixture-driver.cjs')({
  kind: 'task',
  name: 'floorless',
  isDefault: false,
  needs: [{ tool: 'floorless-cli', label: 'Floorless', floor: 'latest', update: 'https://example.invalid/floorless-cli', found: () => '1.0.0' }],
});
