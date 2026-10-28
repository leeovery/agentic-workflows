'use strict';

// A stand-in driver for the driver seam's suite: what it declares, and every
// method of its kind but those it is to lack.

const { METHODS } = require('../../../skills/workflow-engine/scripts/domain/drivers.cjs');

/**
 * @param {{kind: 'task'|'landing', name: string, isDefault: boolean}} declared
 * @param {{lacking?: string[]}} [opts]
 */
module.exports = function fixtureDriver(declared, { lacking = [] } = {}) {
  const methods = METHODS[declared.kind]
    .filter((method) => !lacking.includes(method))
    .map((method) => [method, () => method]);
  return { ...declared, needs: [], ...Object.fromEntries(methods) };
};
