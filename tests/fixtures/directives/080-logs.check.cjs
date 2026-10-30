'use strict';

// A fixture directive's check: one piece for each unit in the state, done
// once each topic of its discussion has its log.

const fs = require('fs');
const path = require('path');

module.exports = {
  counts: { one: 'unit', many: 'units' },
  done: 'have their logs',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ stateDir }) {
    return fs.readdirSync(stateDir).filter((name) => fs.existsSync(path.join(stateDir, name, 'manifest.json'))).map((unit) => {
      const { phases } = JSON.parse(fs.readFileSync(path.join(stateDir, unit, 'manifest.json'), 'utf8'));
      return {
        name: unit,
        problems: Object.keys(phases.discussion.items)
          .filter((topic) => !fs.existsSync(path.join(stateDir, unit, 'topics', topic, 'log.md')))
          .map((topic) => `${topic} has no log`),
      };
    });
  },
};
