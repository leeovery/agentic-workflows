'use strict';

//
// Tests for migration 063: retire-store-msp (.cjs)
//
// Happy path (the old store file deleted and its `.worktreeinclude` line
// renamed), each half alone, rename versus drop where the store is already
// listed, the trimmed comparison and a line merely naming the old file,
// several old lines, a missing `.worktreeinclude` or knowledge directory,
// other lines and the trailing-newline shape kept byte for byte, the skip on
// an install already current, and idempotency.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/063-retire-store-msp.cjs');

const KNOWLEDGE_DIR = '.workflows/.knowledge';
const RETIRED = `${KNOWLEDGE_DIR}/store.msp`;
const STORE = `${KNOWLEDGE_DIR}/store.bin`;
const METADATA = `${KNOWLEDGE_DIR}/metadata.json`;
const CONFIG = `${KNOWLEDGE_DIR}/config.json`;

let dir, updates, skips;

function run() {
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}
function write(rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function read(rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(dir, rel));
}
function include() {
  return read('.worktreeinclude');
}

describe('migration 063: retire the knowledge store\'s old file', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-063-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('deletes the old store file and renames its line, one update each — the other knowledge files left as they were', () => {
    write(RETIRED, 'an earlier version of the store');
    write(METADATA, '{}\n');
    write(CONFIG, '{"provider":null}\n');
    write('.worktreeinclude', `${RETIRED}\n${METADATA}\n${CONFIG}\n`);

    run();

    assert.strictEqual(exists(RETIRED), false);
    assert.strictEqual(read(METADATA), '{}\n');
    assert.strictEqual(read(CONFIG), '{"provider":null}\n');
    assert.strictEqual(include(), `${STORE}\n${METADATA}\n${CONFIG}\n`);
    assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
  });

  it('the old store file alone — deleted, the current store beside it kept, no `.worktreeinclude` made', () => {
    write(RETIRED, 'an earlier version of the store');
    write(STORE, 'the store');

    run();

    assert.strictEqual(exists(RETIRED), false);
    assert.strictEqual(read(STORE), 'the store');
    assert.strictEqual(exists('.worktreeinclude'), false);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('the line alone — renamed, one update, no knowledge directory made', () => {
    write('.worktreeinclude', `${RETIRED}\n`);

    run();

    assert.strictEqual(include(), `${STORE}\n`);
    assert.strictEqual(exists(KNOWLEDGE_DIR), false);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('drops the line where the store is already listed — never listing it twice', () => {
    write('.worktreeinclude', `node_modules/\n${RETIRED}\n.env\n${STORE}\n`);

    run();

    assert.strictEqual(include(), `node_modules/\n.env\n${STORE}\n`);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('drops the line where the store is listed after it, or indented', () => {
    write('.worktreeinclude', `${RETIRED}\n  ${STORE}\n`);

    run();

    assert.strictEqual(include(), `  ${STORE}\n`);
  });

  it('several old lines leave the store listed once, where the first stood', () => {
    write('.worktreeinclude', `.env\n${RETIRED}\n${METADATA}\n${RETIRED}\n`);

    run();

    assert.strictEqual(include(), `.env\n${STORE}\n${METADATA}\n`);
  });

  it('a line naming the old file with whitespace around it is renamed to the bare store line', () => {
    write('.worktreeinclude', `.env\n  ${RETIRED}  \n.env.local\n`);

    run();

    assert.strictEqual(include(), `.env\n${STORE}\n.env.local\n`);
  });

  it('a line merely containing the old file\'s path is left alone, and so is a store elsewhere', () => {
    const content = `# ${RETIRED}\n${RETIRED}.bak\n!${RETIRED}\nother/store.msp\n`;
    write('.worktreeinclude', content);
    write('other/store.msp', 'not the knowledge store');

    run();

    assert.strictEqual(include(), content);
    assert.strictEqual(read('other/store.msp'), 'not the knowledge store');
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('every other line stays byte for byte — comments, blank lines, trailing spaces, carriage returns', () => {
    write('.worktreeinclude', `# local env\r\n.env  \n\n\n${RETIRED}\n\t.env.local\n${CONFIG}\r\n`);

    run();

    assert.strictEqual(include(), `# local env\r\n.env  \n\n\n${STORE}\n\t.env.local\n${CONFIG}\r\n`);
  });

  it('a file with no trailing newline gains none — renamed or dropped as its last line', () => {
    write('.worktreeinclude', `.env\n${RETIRED}`);
    run();
    assert.strictEqual(include(), `.env\n${STORE}`);

    write('.worktreeinclude', `${STORE}\n${RETIRED}`);
    run();
    assert.strictEqual(include(), STORE);
  });

  it('a file with a trailing newline keeps it — renamed or dropped as its last line', () => {
    write('.worktreeinclude', `.env\n${RETIRED}\n`);
    run();
    assert.strictEqual(include(), `.env\n${STORE}\n`);

    write('.worktreeinclude', `${STORE}\n${RETIRED}\n`);
    run();
    assert.strictEqual(include(), `${STORE}\n`);
  });

  it('a missing `.worktreeinclude` and no knowledge directory — a skip, nothing made', () => {
    run();

    assert.strictEqual(exists('.worktreeinclude'), false);
    assert.strictEqual(exists(KNOWLEDGE_DIR), false);
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('an install already current — a skip, the store and the file as they were', () => {
    const content = `node_modules/\n${STORE}\n${METADATA}\n${CONFIG}\n`;
    write('.worktreeinclude', content);
    write(STORE, 'the store');

    run();

    assert.strictEqual(include(), content);
    assert.strictEqual(read(STORE), 'the store');
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('idempotency — a second run finds nothing to retire and leaves what the first left', () => {
    write(RETIRED, 'an earlier version of the store');
    write('.worktreeinclude', `.env\n${RETIRED}\n${METADATA}\n`);

    run();
    const after = include();
    updates = 0;
    skips = 0;
    run();

    assert.strictEqual(include(), after);
    assert.strictEqual(exists(RETIRED), false);
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });
});
