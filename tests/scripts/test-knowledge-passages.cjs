'use strict';

// What a query prints of each result: the excerpt the framing it kept picks,
// and — read from its file as it stands, under the project root — the
// headings enclosing that excerpt and the chunk's lines.

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { chunk } = require('../../skills/workflow-engine/scripts/kernel/knowledge/chunker.cjs');
const { withPassages } = require('../../skills/workflow-engine/scripts/domain/knowledge/passages.cjs');

const SOURCE = '.workflows/auth/discussion/auth.md';

const FILE = [
  '---',
  'status: completed',
  '---',
  '',
  '# Discussion: Auth',
  '',
  '## Tokens',
  '',
  'Access tokens last an hour.',
  '',
  '### Refresh',
  '',
  'Refresh tokens rotate on every use.',
  '',
  '## Sessions',
  '',
  'A session ends at logout.',
].join('\n') + '\n';

/** The file's chunk, as the store holds it. @param {string} content */
function chunkDoc(content) {
  return {
    id: 'auth-discussion-auth-001',
    content,
    work_unit: 'auth',
    work_type: 'feature',
    phase: 'discussion',
    topic: 'auth',
    confidence: 'low-medium',
    source_file: SOURCE,
    timestamp: 1700000000000,
  };
}

/** The chunk as a result ranked on framing `kept`. @param {string} content @param {number} kept */
function result(content, kept) {
  return { ...chunkDoc(content), score: 1, scoring: { framings: [], kept, cut: 20, decay: 1, boost: 0, tier: 0 } };
}

describe('withPassages', () => {
  let root;
  let db;
  let content;

  /** @param {string} text */
  function writeSource(text) {
    fs.mkdirSync(path.join(root, path.dirname(SOURCE)), { recursive: true });
    fs.writeFileSync(path.join(root, SOURCE), text);
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-passages-'));
    writeSource(FILE);
    [{ content }] = chunk(FILE, { keep_whole_below: 50 });
    db = store.createStore();
    store.insertDocument(db, chunkDoc(content));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('picks the excerpt by the framing the result kept, under the headings enclosing it, at the chunk\'s lines', () => {
    const terms = ['session logout', 'refresh rotation'];
    const [first, second] = withPassages(db, [result(content, 1), result(content, 2)], terms, root);
    assert.deepStrictEqual({ excerpt: first.excerpt, headings: first.headings, lines: first.lines }, {
      excerpt: 'A session ends at logout.',
      headings: ['Discussion: Auth', 'Sessions'],
      lines: { first: 5, last: 17 },
    });
    assert.deepStrictEqual({ excerpt: second.excerpt, headings: second.headings }, {
      excerpt: 'Refresh tokens rotate on every use.',
      headings: ['Discussion: Auth', 'Tokens', 'Refresh'],
    });
  });

  it('keeps every field the ranking gave the result', () => {
    const [{ excerpt, headings, lines, ...ranked }] = withPassages(db, [result(content, 1)], ['session'], root);
    assert.deepStrictEqual(ranked, result(content, 1));
  });

  it('gives no headings and no lines where the file was edited since the chunk was indexed', () => {
    writeSource(FILE.replace('A session ends at logout.', 'A session ends at logout or expiry.'));
    const [placed] = withPassages(db, [result(content, 1)], ['session logout'], root);
    assert.deepStrictEqual({ excerpt: placed.excerpt, headings: placed.headings, lines: placed.lines }, {
      excerpt: 'A session ends at logout.',
      headings: [],
      lines: null,
    });
  });

  it('gives no headings and no lines where the file is gone, or a directory on its path is no longer one', () => {
    const unplaced = { excerpt: 'A session ends at logout.', headings: [], lines: null };
    const placedOf = () => {
      const [placed] = withPassages(db, [result(content, 1)], ['session logout'], root);
      return { excerpt: placed.excerpt, headings: placed.headings, lines: placed.lines };
    };
    fs.rmSync(path.join(root, SOURCE));
    assert.deepStrictEqual(placedOf(), unplaced);
    const directory = path.join(root, path.dirname(SOURCE));
    fs.rmSync(directory, { recursive: true });
    fs.writeFileSync(directory, '');
    assert.deepStrictEqual(placedOf(), unplaced);
  });

  it('lets any other failure to read the file through', () => {
    fs.rmSync(path.join(root, SOURCE));
    fs.mkdirSync(path.join(root, SOURCE));
    assert.throws(() => withPassages(db, [result(content, 1)], ['session logout'], root), { code: 'EISDIR' });
  });

  it('reads each result file once, however many results it holds', () => {
    const read = fs.readFileSync;
    const reads = [];
    fs.readFileSync = (/** @type {any} */ file, /** @type {any} */ options) => {
      reads.push(file);
      return read(file, options);
    };
    try {
      withPassages(db, [result(content, 1), result(content, 2), result(content, 1)], ['session', 'refresh'], root);
    } finally {
      fs.readFileSync = read;
    }
    assert.deepStrictEqual(reads, [path.join(root, SOURCE)]);
  });
});
