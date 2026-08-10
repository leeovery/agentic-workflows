'use strict';

//
// Tests for migration 055: corrigenda-to-section (.cjs)
//
// Happy path (top blockquote → bottom section), the rich ⚠ multi-line form,
// multiple blocks, existing-section extension, specification layout,
// fence-awareness, below-first-H2 conservatism, no-op skip, idempotency,
// content preservation, CRLF normalisation, and the verify addendum.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/055-corrigenda-to-section.cjs');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-055-'));
  fs.mkdirSync(path.join(dir, '.workflows', 'pay', 'specification', 'billing'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.workflows', 'pay', 'research'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
function runMigration(dir) {
  const c = { updates: 0, skips: 0, verify: undefined };
  const result = MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { c.updates++; },
    reportSkip: () => { c.skips++; },
  });
  if (result && result.verify) c.verify = result.verify;
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

const ONE_LINER = '> **Corrigendum 2026-08-07** (from `spectrum-tui`): "themes are JSON" — corrected: themes are TOML.';

const RICH_BLOCK = `> **⚠ Corrigendum — 2026-08-07 (theming-system specification).**
> Token vocabulary renamed; sections revised to match.
> - **§4.2 Storage.** Superseded: "themes are JSON" Current: **themes are TOML** — format moved at implementation.
> Bodies below were edited in place to match; this block is the only annotation.`;

const SPEC = `# Billing Specification

${ONE_LINER}

Intro paragraph.

## Scope

Scope body.

## Storage

Storage body.
`;

describe('migration 055: corrigenda to bottom section', () => {
  it('happy path — top blockquote moves to a bottom ## Corrigenda section, body intact', () => {
    const dir = setup();
    write(dir, '.workflows/pay/specification/billing/specification.md', SPEC);

    const c = runMigration(dir);

    const doc = read(dir, '.workflows/pay/specification/billing/specification.md');
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n`), 'section appended at the bottom with the entry verbatim');
    assert.match(doc, /^# Billing Specification\n\nIntro paragraph\.\n/, 'top region clean, single blank collapse');
    assert.ok(doc.includes('## Scope\n\nScope body.'), 'body sections preserved');
    assert.ok(c.verify && c.verify.includes('pay/specification/billing/specification.md'), 'verify lists the moved file');
    assert.ok(c.verify.includes('knowledge.cjs index'), 'verify instructs the re-index');
    teardown(dir);
  });

  it('rich ⚠ multi-line block moves verbatim', () => {
    const dir = setup();
    write(dir, '.workflows/pay/research/tokens.md', `# Tokens\n\n${RICH_BLOCK}\n\nIntro.\n\n## Findings\n\nBody.\n`);

    const c = runMigration(dir);

    const doc = read(dir, '.workflows/pay/research/tokens.md');
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${RICH_BLOCK}\n`), 'rich block preserved byte-for-byte in the section');
    assert.ok(!doc.slice(0, doc.indexOf('## Findings')).includes('Corrigendum'), 'top region clean');
    teardown(dir);
  });

  it('multiple blocks move in order', () => {
    const dir = setup();
    const second = '> **Corrigendum 2026-08-08** (from `payments`): "retries are unbounded" — corrected: capped at 3.';
    write(dir, '.workflows/pay/research/tokens.md', `# Tokens\n\n${ONE_LINER}\n\n${second}\n\nIntro.\n\n## Findings\n\nBody.\n`);

    const c = runMigration(dir);

    const doc = read(dir, '.workflows/pay/research/tokens.md');
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n\n${second}\n`), 'both entries land in order');
    teardown(dir);
  });

  it('existing ## Corrigenda section is extended, not duplicated', () => {
    const dir = setup();
    const existing = '> **Corrigendum 2026-08-01** (from `auth`): "sessions are sticky" — corrected: stateless.';
    write(dir, '.workflows/pay/research/tokens.md', `# Tokens\n\n${ONE_LINER}\n\n## Findings\n\nBody.\n\n## Corrigenda\n\n${existing}\n`);

    const c = runMigration(dir);

    const doc = read(dir, '.workflows/pay/research/tokens.md');
    assert.strictEqual(c.updates, 1);
    assert.strictEqual(doc.match(/## Corrigenda/g).length, 1, 'one section');
    assert.ok(doc.endsWith(`## Corrigenda\n\n${existing}\n\n${ONE_LINER}\n`), 'moved entry appended after the existing one');
    teardown(dir);
  });

  it('a corrigendum quoted inside a code fence is not moved', () => {
    const dir = setup();
    const doc = `# Tokens\n\n\`\`\`markdown\n${ONE_LINER}\n\`\`\`\n\nIntro.\n\n## Findings\n\nBody.\n`;
    write(dir, '.workflows/pay/research/tokens.md', doc);

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, '.workflows/pay/research/tokens.md'), doc, 'file untouched');
    teardown(dir);
  });

  it('a corrigendum below the first H2 is left for the verify pass', () => {
    const dir = setup();
    const doc = `# Tokens\n\nIntro.\n\n## Findings\n\n${ONE_LINER}\n\nBody.\n`;
    write(dir, '.workflows/pay/research/tokens.md', doc);

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(read(dir, '.workflows/pay/research/tokens.md'), doc, 'file untouched');
    assert.ok(c.verify && c.verify.includes('below the first H2'), 'skip-path verify flags the possibility');
    teardown(dir);
  });

  it('no corrigenda anywhere — skip, and no verify without artifacts', () => {
    const dir = setup();

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(c.verify, undefined, 'no artifacts — nothing for the verify pass');
    teardown(dir);
  });

  it('idempotent — second run changes nothing', () => {
    const dir = setup();
    write(dir, '.workflows/pay/specification/billing/specification.md', SPEC);

    runMigration(dir);
    const after = read(dir, '.workflows/pay/specification/billing/specification.md');
    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, '.workflows/pay/specification/billing/specification.md'), after, 'converged');
    teardown(dir);
  });

  it('CRLF artifact converts', () => {
    const dir = setup();
    write(dir, '.workflows/pay/research/tokens.md', `# Tokens\r\n\r\n${ONE_LINER}\r\n\r\nIntro.\r\n\r\n## Findings\r\n\r\nBody.\r\n`);

    const c = runMigration(dir);

    const doc = read(dir, '.workflows/pay/research/tokens.md');
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n`), 'converted from CRLF and moved');
    teardown(dir);
  });

  it('missing .workflows — skip cleanly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-055-'));

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    teardown(dir);
  });
});
