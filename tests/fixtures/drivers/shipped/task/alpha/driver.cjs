'use strict';

module.exports = require('../../../fixture-driver.cjs')({
  kind: 'task',
  name: 'alpha',
  isDefault: true,
  needs: [{ tool: 'alpha-cli', floor: '1.0.0', update: 'https://example.invalid/alpha-cli', found: () => '1.2.0' }],
});
