'use strict';

//
// Tests for migration 055: corrigenda-to-section (.cjs)
//
// Happy path (top blockquote → bottom section), the rich ⚠ multi-line form,
// blank-split and lazy-continuation blockquotes, preamble lines, multiple
// blocks, existing-section extension (bottom, mid-file, empty), non-spec
// artifacts untouched, fence-awareness (backtick and tilde), section-heading
// bounding, seam preservation, per-file update counts, unreadable-input
// degradation, no-op skip, idempotency, content preservation, CRLF
// normalisation, and the verify addendum.
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

const SPEC_PATH = '.workflows/pay/specification/billing/specification.md';

const ONE_LINER = '> **Corrigendum 2026-08-07** (from `spectrum-tui`): "themes are JSON" — corrected: themes are TOML.';

const RICH_BLOCK = `> **⚠ Corrigendum — 2026-08-07 (theming-system specification).**
> Token vocabulary renamed; sections revised to match.
> - **§4.2 Storage.** Superseded: "themes are JSON" Current: **themes are TOML** — format moved at implementation.
> Bodies below were edited in place to match; this block is the only annotation.`;

function spec(top) {
  return `# Billing Specification

${top}

Intro paragraph.

## Scope

Scope body.

## Storage

Storage body.
`;
}

describe('migration 055: corrigenda to bottom section', () => {
  it('happy path — top blockquote moves to a bottom ## Corrigenda section, body intact', () => {
    const dir = setup();
    write(dir, SPEC_PATH, spec(ONE_LINER));

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n`), 'section appended at the bottom with the entry verbatim');
    assert.match(doc, /^# Billing Specification\n\nIntro paragraph\.\n/, 'top region clean, single blank collapse');
    assert.ok(doc.includes('## Scope\n\nScope body.'), 'body sections preserved');
    assert.ok(c.verify && c.verify.includes('.workflows/pay/specification/billing/specification.md'), 'verify lists the moved file as a project-root-relative path');
    assert.ok(c.verify.includes('knowledge.cjs index'), 'verify instructs the re-index');
    assert.ok(c.verify.includes('not cancelled') && c.verify.includes('completed'), 'verify qualifies the re-index by owning status');
    teardown(dir);
  });

  it('exports info describing the migration', () => {
    assert.strictEqual(typeof MIGRATION.info, 'string');
    assert.ok(MIGRATION.info.includes('Corrigenda'));
  });

  it('rich ⚠ multi-line block moves verbatim', () => {
    const dir = setup();
    write(dir, SPEC_PATH, spec(RICH_BLOCK));

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${RICH_BLOCK}\n`), 'rich block preserved byte-for-byte in the section');
    assert.ok(!doc.slice(0, doc.indexOf('## Scope')).includes('Corrigendum'), 'top region clean');
    teardown(dir);
  });

  it('a blank-split blockquote family moves as one block — nothing orphaned', () => {
    const dir = setup();
    const split = `> **⚠ Corrigendum — 2026-08-07 (theming-system specification).**\n> Token vocabulary renamed.\n\n> - **§4.2 Storage.** Superseded: "JSON" Current: **TOML**.\n> Bodies were edited in place to match.`;
    write(dir, SPEC_PATH, spec(split));

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${split}\n`), 'whole family moved, blank gap preserved');
    assert.ok(!doc.slice(0, doc.indexOf('## Scope')).includes('§4.2'), 'no bullet residue at the top');
    teardown(dir);
  });

  it('a lazy-continuation entry moves whole — the correction is never amputated', () => {
    const dir = setup();
    const lazy = '> **Corrigendum 2026-08-07** (from `x`): "the store is JSON" —\ncorrected: the store is TOML and lives elsewhere.';
    write(dir, SPEC_PATH, spec(lazy));

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${lazy}\n`), 'wrapped entry moved with its continuation line');
    assert.match(doc, /^# Billing Specification\n\nIntro paragraph\.\n/, 'no orphan glued to the title');
    teardown(dir);
  });

  it('a preamble line inside the blockquote travels with the entry', () => {
    const dir = setup();
    const preambled = `> Note: this spec was revised after release.\n${ONE_LINER}`;
    write(dir, SPEC_PATH, spec(preambled));

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${preambled}\n`), 'whole blockquote run moved');
    assert.ok(!doc.slice(0, doc.indexOf('## Scope')).includes('Note:'), 'no preamble residue at the top');
    teardown(dir);
  });

  it('multiple blocks move in order', () => {
    const dir = setup();
    const second = '> **Corrigendum 2026-08-08** (from `payments`): "retries are unbounded" — corrected: capped at 3.';
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n\nIntro between.\n\n${second}\n\n## Scope\n\nScope body.\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n\n${second}\n`), 'both entries land in order');
    assert.ok(doc.includes('Intro between.'), 'intervening prose preserved');
    teardown(dir);
  });

  it('a block abutting the first heading keeps the blank line under the title', () => {
    const dir = setup();
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n## Scope\n\nScope body.\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.match(doc, /^# Billing Specification\n\n## Scope\n/, 'title separator survives; nothing glued to the H1');
    teardown(dir);
  });

  it('existing bottom ## Corrigenda section is extended, not duplicated', () => {
    const dir = setup();
    const existing = '> **Corrigendum 2026-08-01** (from `auth`): "sessions are sticky" — corrected: stateless.';
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n\n## Scope\n\nScope body.\n\n## Corrigenda\n\n${existing}\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.strictEqual(doc.match(/## Corrigenda/g).length, 1, 'one section');
    assert.ok(doc.endsWith(`## Corrigenda\n\n${existing}\n\n${ONE_LINER}\n`), 'moved entry appended after the existing one');
    teardown(dir);
  });

  it('a mid-file ## Corrigenda section receives the entry inside its bounds', () => {
    const dir = setup();
    const existing = '> **Corrigendum 2026-08-01** (from `auth`): "sessions are sticky" — corrected: stateless.';
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n\n## Corrigenda\n\n${existing}\n\n## Later\n\nLater body.\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.includes(`${existing}\n\n${ONE_LINER}\n\n## Later`), 'entry lands at the section end, before the next H2');
    teardown(dir);
  });

  it('an empty existing ## Corrigenda section receives the entry', () => {
    const dir = setup();
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n\n## Scope\n\nScope body.\n\n## Corrigenda\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.includes(`## Corrigenda\n\n${ONE_LINER}`), 'entry lands in the empty section');
    teardown(dir);
  });

  it('non-spec artifacts are never touched, even with a corrigendum at the top', () => {
    const dir = setup();
    const research = `# Tokens\n\n${ONE_LINER}\n\nIntro.\n\n## Findings\n\nBody.\n`;
    write(dir, '.workflows/pay/research/tokens.md', research);

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, '.workflows/pay/research/tokens.md'), research, 'research file untouched');
    teardown(dir);
  });

  it('corrigenda quoted inside backtick and tilde fences are not moved', () => {
    const dir = setup();
    const doc = `# Billing Specification\n\n\`\`\`markdown\n${ONE_LINER}\n\`\`\`\n\n~~~markdown\n${ONE_LINER}\n~~~\n\nIntro.\n\n## Scope\n\nScope body.\n`;
    write(dir, SPEC_PATH, doc);

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, SPEC_PATH), doc, 'file untouched');
    teardown(dir);
  });

  it('a fenced ## Corrigenda heading is not mistaken for the section', () => {
    const dir = setup();
    write(dir, SPEC_PATH, `# Billing Specification\n\n${ONE_LINER}\n\n## Scope\n\n\`\`\`markdown\n## Corrigenda\n\`\`\`\n\nScope body.\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
    assert.strictEqual(c.updates, 1);
    assert.ok(doc.endsWith(`## Corrigenda\n\n${ONE_LINER}\n`), 'a real section is appended at EOF');
    assert.ok(doc.includes('```markdown\n## Corrigenda\n```'), 'fenced example untouched');
    teardown(dir);
  });

  it('the scan is bounded at the first section heading of any level', () => {
    const dir = setup();
    const doc = `# Billing Specification\n\nIntro.\n\n### Sub-note\n\n${ONE_LINER}\n\nBody.\n`;
    write(dir, SPEC_PATH, doc);

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(read(dir, SPEC_PATH), doc, 'a corrigendum below a section heading is left for the verify pass');
    assert.ok(c.verify && c.verify.includes('sit elsewhere in the file'), 'skip-path verify flags the possibility');
    teardown(dir);
  });

  it('reports one update per converted file across work units', () => {
    const dir = setup();
    write(dir, SPEC_PATH, spec(ONE_LINER));
    write(dir, '.workflows/auth/specification/login/specification.md', spec(ONE_LINER));

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 2);
    assert.strictEqual(c.skips, 0);
    assert.ok(c.verify.includes('.workflows/pay/specification/billing/specification.md'));
    assert.ok(c.verify.includes('.workflows/auth/specification/login/specification.md'));
    teardown(dir);
  });

  it('a converting spec beside a clean one reports one update and no skip', () => {
    const dir = setup();
    write(dir, SPEC_PATH, spec(ONE_LINER));
    write(dir, '.workflows/auth/specification/login/specification.md', '# Login Specification\n\n## Scope\n\nClean.\n');

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 1);
    assert.strictEqual(c.skips, 0);
    teardown(dir);
  });

  it('an unreadable specification.md degrades to unconverted, never a throw', () => {
    const dir = setup();
    fs.mkdirSync(path.join(dir, '.workflows/pay/specification/billing/specification.md'), { recursive: true });

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    teardown(dir);
  });

  it('no corrigenda anywhere — skip, and no verify without artifacts', () => {
    const dir = setup();

    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(c.verify, undefined, 'no specifications — nothing for the verify pass');
    teardown(dir);
  });

  it('idempotent — second run changes nothing', () => {
    const dir = setup();
    write(dir, SPEC_PATH, spec(RICH_BLOCK));

    runMigration(dir);
    const after = read(dir, SPEC_PATH);
    const c = runMigration(dir);

    assert.strictEqual(c.updates, 0);
    assert.strictEqual(c.skips, 1);
    assert.strictEqual(read(dir, SPEC_PATH), after, 'converged');
    teardown(dir);
  });

  it('CRLF artifact converts', () => {
    const dir = setup();
    write(dir, SPEC_PATH, `# Billing Specification\r\n\r\n${ONE_LINER}\r\n\r\nIntro.\r\n\r\n## Scope\r\n\r\nScope body.\r\n`);

    const c = runMigration(dir);

    const doc = read(dir, SPEC_PATH);
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
