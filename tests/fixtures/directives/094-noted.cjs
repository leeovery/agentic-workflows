'use strict';

// A fixture code migration after the reshape (21.S48): it adds a line to
// the project's .gitignore and hands back a check and a notice, as a code
// migration does today.

const fs = require('fs');
const path = require('path');

module.exports = {
  id: '094',
  description: 'ignore the build folder',
  info: 'Adds the build folder to the project\'s .gitignore.',
  /** @param {{projectDir: string, reportUpdate: () => void}} ctx */
  run({ projectDir, reportUpdate }) {
    fs.appendFileSync(path.join(projectDir, '.gitignore'), '/build/\n');
    reportUpdate();
    return { verify: 'Check the build folder is ignored.', notice: 'The build folder is ignored now.' };
  },
};
