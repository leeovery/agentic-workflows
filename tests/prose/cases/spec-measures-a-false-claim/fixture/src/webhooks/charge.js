'use strict';

const { withRetry } = require('../lib/retry');
const { applyCharge } = require('../payments');

module.exports = async function charge(event) {
  return withRetry(() => applyCharge(event));
};
