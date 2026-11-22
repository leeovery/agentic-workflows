'use strict';

module.exports = require('../../../fixture-driver.cjs')({ kind: 'task', name: 'lacking', isDefault: false }, { lacking: ['ready', 'done'] });
