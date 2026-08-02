'use strict';

//
// Tests for migration 054: triage-sections-to-queue (.cjs)
//
// Happy path (entries → queue files, section reset), multi-entry numbering,
// (none)/absent-section skips, idempotency, content preservation around the
// section, existing-queue numbering continuation, and slug derivation.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/054-triage-sections-to-queue.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-054-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay', 'discussion'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function runMigration(dir) {
  const c = { updates: 0, skips: 0 };
  MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { c.updates++; },
    reportSkip: () => { c.skips++; },
  });
  return c;
}
function write(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

const DOC = `# Discussion — alpha

## Summary

Things.

## Triage

### Rate limits
*From: beta · discussion · 2026-07-30*

Full context on rate limits.

### Retry Semantics!
*From: gamma · research · 2026-07-30*

Retry body.
`;

describe('migration 054: triage sections to queue', () => {
  it('happy path — entries become queue files, section resets to (none), surrounding content intact', () => {
    const dir = setup();
    write(dir, '.workflows/pay/discussion/alpha.md', DOC);

    const c = runMigration(dir);

    const q = path.join(dir, '.workflows/pay/discussion/.triage/alpha');
    assert.deepStrictEqual(fs.readdirSync(q).sort(), ['001-rate-limits.md', '002-retry-semantics.md']);
    const first = read(dir, '.workflows/pay/discussion/.triage/alpha/001-rate-limits.md');
    assert.match(first, /^### Rate limits\n\*From: beta · discussion · 2026-07-30\*\n\nFull context on rate limits\.\n$/);
    const doc = read(dir, '.workflows/pay/discussion/alpha.md');
    assert.match(doc, /## Triage\n\n\(none\)\n/);
    assert.ok(!doc.includes('### Rate limits'), 'entries removed from the document');
    assert.ok(doc.includes('## Summary\n\nThings.'), 'content before the section preserved');
    assert.strictEqual(c.updates, 1);
    teardown(dir);
  });

  it('content after the section survives the reset', () => {
    const dir = setup();
    write(dir, '.workflows/pay/discussion/alpha.md',
      '# D\n\n## Triage\n\n### One\n*From: x · discussion · d*\n\nBody.\n\n## Postscript\n\nKept.\n');

    runMigration(dir);

    const doc = read(dir, '.workflows/pay/discussion/alpha.md');
    assert.match(doc, /## Triage\n\n\(none\)\n\n## Postscript\n\nKept\.\n/);
    teardown(dir);
  });

  it('skip — (none) sections, absent sections, and no .workflows are all no-ops', () => {
    const dir = setup();
    write(dir, '.workflows/pay/discussion/clean.md', '# D\n\n## Triage\n\n(none)\n');
    write(dir, '.workflows/pay/discussion/legacyless.md', '# D\n\nNo section at all.\n');

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/pay/discussion/.triage')), 'no queue conjured');

    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-054-'));
    const c2 = runMigration(bare);
    assert.strictEqual(c2.skips, 1);
    teardown(dir);
    teardown(bare);
  });

  it('idempotency — a second run converts nothing and changes nothing', () => {
    const dir = setup();
    write(dir, '.workflows/pay/discussion/alpha.md', DOC);

    runMigration(dir);
    const doc = read(dir, '.workflows/pay/discussion/alpha.md');
    const files = fs.readdirSync(path.join(dir, '.workflows/pay/discussion/.triage/alpha')).sort();
    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, '.workflows/pay/discussion/alpha.md'), doc);
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.workflows/pay/discussion/.triage/alpha')).sort(), files);
    teardown(dir);
  });

  it('numbering continues after existing queue files', () => {
    const dir = setup();
    write(dir, '.workflows/pay/discussion/alpha.md', '# D\n\n## Triage\n\n### Late arrival\n*From: x · discussion · d*\n\nBody.\n');
    write(dir, '.workflows/pay/discussion/.triage/alpha/002-existing.md', '### Existing\n\nAlready queued.\n');

    runMigration(dir);

    const files = fs.readdirSync(path.join(dir, '.workflows/pay/discussion/.triage/alpha')).sort();
    assert.deepStrictEqual(files, ['002-existing.md', '003-late-arrival.md']);
    teardown(dir);
  });

  it('research phase converts too', () => {
    const dir = setup();
    write(dir, '.workflows/pay/research/topic.md', '# R\n\n## Triage\n\n### Feasibility flag\n*From: x · discussion · d*\n\nBody.\n');

    const c = runMigration(dir);

    assert.ok(fs.existsSync(path.join(dir, '.workflows/pay/research/.triage/topic/001-feasibility-flag.md')));
    assert.strictEqual(c.updates, 1);
    teardown(dir);
  });
});
