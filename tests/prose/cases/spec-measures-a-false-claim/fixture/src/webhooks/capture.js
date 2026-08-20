'use strict';

const { withRetry } = require('../lib/retry');
const { applyCapture } = require('../payments');

module.exports = async function capture(event) {
  return withRetry(() => applyCapture(event));
};
