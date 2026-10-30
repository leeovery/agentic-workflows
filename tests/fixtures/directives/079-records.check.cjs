'use strict';

// A fixture directive's check: one piece for each topic of each unit's
// discussion in the manifests the code branch's HEAD holds under
// `.workflows/`, as they stood before the migration moved them, done once
// the ledger holds an entry on the topic whose text is each subtopic its
// map shows decided.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** @param {string} cwd @param {string[]} args */
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

/** The ledger's entries. @param {string} stateDir @returns {Record<string, any>[]} */
function entriesOf(stateDir) {
  const file = path.join(stateDir, '.ledger.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

module.exports = {
  counts: 'topic',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const entries = entriesOf(stateDir);
    return git(projectDir, ['ls-tree', '--name-only', 'HEAD', '.workflows/']).split('\n').filter(Boolean).flatMap((folder) => {
      const unit = path.basename(folder);
      const { phases } = JSON.parse(git(projectDir, ['show', `HEAD:${folder}/manifest.json`]));
      return Object.entries(phases.discussion.items).map(([topic, { subtopics }]) => ({
        name: `${unit}/${topic}`,
        problems: Object.entries(subtopics)
          .filter(([key, { status }]) => status === 'decided' && !entries.some((entry) => entry.unit === unit && entry.topic === topic && entry.text === key))
          .map(([key]) => `no entry for ${key}, decided on its map`),
      }));
    });
  },
};
