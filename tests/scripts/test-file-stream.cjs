'use strict';

// ---------------------------------------------------------------------------
// The kernel's file streams (workflow-engine/scripts/kernel/file-stream.cjs):
// a file's lines read from its end (`fdLinesBackward`, `fileLinesBackward`)
// are its lines read from its start, in the other order, each where it sits
// — whatever the file ends with, and however a line falls across the chunks
// it is read in.
//
// Unit layer: plain files in a temp folder.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { useTempFolder } = require('./discovery-test-utils.cjs');
const { fdLines, fdLinesBackward, fileLinesBackward } = require('../../skills/workflow-engine/scripts/kernel/file-stream.cjs');

/** A line longer than the chunk a file is read in, and one longer than two. */
const LONG = 'x'.repeat(70 * 1024);
const LONGER = 'y'.repeat(150 * 1024);

const folder = useTempFolder('file-stream-');

describe('lines read from the end', () => {
  it('are the lines read from the start, in the other order, each where it sits', () => {
    const files = {
      empty: '',
      'one unended': 'a',
      'one ended': 'a\n',
      'a blank line': '\n',
      'blank lines between': 'a\n\n\nb\n',
      'the last unended': 'a\nb',
      'long lines across chunks': `a\n${LONG}\n${LONGER}\nb`,
      'a long last line, unended': `${LONG}\n${LONGER}`,
      'a newline at a chunk\'s edge': `${'z'.repeat(64 * 1024 - 1)}\n${LONG}\n`,
    };
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(folder(), name);
      fs.writeFileSync(file, text);
      const fd = fs.openSync(file, 'r');
      try {
        assert.deepStrictEqual([...fdLinesBackward(fd)].reverse(), [...fdLines(fd)], name);
      } finally {
        fs.closeSync(fd);
      }
      assert.deepStrictEqual([...fileLinesBackward(file)].reverse(), text === '' ? [] : text.replace(/\n$/, '').split('\n'), `${name}, by its file`);
    }
  });
});
