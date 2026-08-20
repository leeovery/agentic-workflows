'use strict';

const { applyRefund } = require('../payments');

module.exports = async function refund(event) {
  return applyRefund(event);
};
