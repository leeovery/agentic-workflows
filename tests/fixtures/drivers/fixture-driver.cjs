'use strict';

// A stand-in driver for the driver seam's suites: what it declares — its
// title `{name}'s driver` and no needs, unless it declares its own — and
// every required method of its kind, each answering its own name, but those
// it is to lack, with any it is given in their place.

const { METHODS } = require('../../../skills/leeway-engine/scripts/domain/drivers.cjs');

/**
 * @param {{kind: 'task'|'landing', name: string, isDefault?: unknown, title?: unknown, needs?: unknown}} declared
 * @param {{lacking?: string[], methods?: Record<string, Function>}} [opts]
 */
module.exports = function fixtureDriver(declared, { lacking = [], methods = {} } = {}) {
  const stubs = METHODS[declared.kind].required
    .filter((method) => !lacking.includes(method))
    .map((method) => [method, () => method]);
  return { needs: [], title: `${declared.name}'s driver`, ...declared, ...Object.fromEntries(stubs), ...methods };
};
