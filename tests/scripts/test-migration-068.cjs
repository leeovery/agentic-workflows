'use strict';

//
// Tests for migration 068: remove-consult-references (.cjs)
//
// Happy path (the field deleted from every specification item, the rest of
// the manifest kept in the engine's serialisation), the analysis rewrite
// (only lines opening `**Consult**:` change), one update per changed unit
// whichever file changed, skip/no-op, idempotency, the malformed-manifest
// guard (skipped, never thrown on, its analysis left alone), shapes that are
// not objects, and a project with no work units.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/068-remove-consult-references.cjs');

const ANALYSIS = path.join('.state', 'discussion-consolidation-analysis.md');

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

const unitPath = (name, file) => path.join(dir, '.workflows', name, file);

function writeUnit(name, manifest) {
  fs.mkdirSync(path.join(dir, '.workflows', name), { recursive: true });
  fs.writeFileSync(unitPath(name, 'manifest.json'), typeof manifest === 'string' ? manifest : json(manifest));
}

function writeAnalysis(name, text) {
  fs.mkdirSync(path.dirname(unitPath(name, ANALYSIS)), { recursive: true });
  fs.writeFileSync(unitPath(name, ANALYSIS), text);
}

const readText = (name, file) => fs.readFileSync(unitPath(name, file), 'utf8');

/** An epic whose specifications carry consult references beside their other fields. */
function epic() {
  return {
    name: 'pay',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discussion: { items: { billing: { status: 'completed' }, ledger: { status: 'completed' } } },
      specification: {
        items: {
          core: {
            status: 'in-progress',
            sources: { billing: { status: 'incorporated' } },
            consult_references: { ledger: { status: 'pending' } },
            construction_gate_mode: 'gated',
          },
          posting: {
            status: 'proposed',
            sources: { ledger: { status: 'pending' } },
            order: 2,
          },
          refunds: {
            status: 'completed',
            sources: { refunds: { status: 'incorporated' } },
            consult_references: { billing: { status: 'addressed' }, ledger: {} },
          },
        },
      },
    },
  };
}

/** The epic as the migration leaves it — every consult_references gone, nothing else moved. */
function epicWithout() {
  const m = epic();
  delete m.phases.specification.items.core.consult_references;
  delete m.phases.specification.items.refunds.consult_references;
  return m;
}

const ANALYSIS_BEFORE = [
  '# Discussion Consolidation Analysis',
  '',
  '## Recommended Groupings',
  '',
  '### Core',
  '- **billing**: the pricing rules',
  '',
  '**Coupling**: one ledger of charges',
  '**Consult**: ledger — the posting rule supersedes the draft',
  '**Tension**: billing / refunds — the refund window disagrees',
  '**Consult**: refunds — the reversal hand-off',
  '',
  '## Analysis Notes',
  'A note that names **Consult**: mid-line stays as written.',
  '  **Consult**: an indented line is not one the analysis writes',
  '',
].join('\n');

const ANALYSIS_AFTER = [
  '# Discussion Consolidation Analysis',
  '',
  '## Recommended Groupings',
  '',
  '### Core',
  '- **billing**: the pricing rules',
  '',
  '**Coupling**: one ledger of charges',
  '**Tension**: ledger — the posting rule supersedes the draft',
  '**Tension**: billing / refunds — the refund window disagrees',
  '**Tension**: refunds — the reversal hand-off',
  '',
  '## Analysis Notes',
  'A note that names **Consult**: mid-line stays as written.',
  '  **Consult**: an indented line is not one the analysis writes',
  '',
].join('\n');

describe('migration 068: remove consult references', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-068-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    updates = 0;
    skips = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  it('describes itself and hands nothing back', () => {
    assert.strictEqual(MIGRATION.id, '068');
    assert.strictEqual(MIGRATION.description, 'remove consult references — a correction a sibling discussion owes a grouping is carried as a tension line');
    writeUnit('pay', epic());
    assert.strictEqual(run(), undefined);
  });

  it('deletes consult_references from every specification item, the rest of the manifest kept in the engine\'s serialisation', () => {
    writeUnit('pay', epic());
    run();
    assert.strictEqual(readText('pay', 'manifest.json'), json(epicWithout()));
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('retags only the lines that open **Consult**: in the grouping analysis', () => {
    writeUnit('pay', epicWithout());
    writeAnalysis('pay', ANALYSIS_BEFORE);
    run();
    assert.strictEqual(readText('pay', ANALYSIS), ANALYSIS_AFTER);
    assert.strictEqual(readText('pay', 'manifest.json'), json(epicWithout()), 'a manifest with nothing to remove is not rewritten');
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('counts one update per changed unit, whether its manifest, its analysis, or both changed', () => {
    writeUnit('both', epic());
    writeAnalysis('both', ANALYSIS_BEFORE);
    writeUnit('field', epic());
    writeUnit('lines', epicWithout());
    writeAnalysis('lines', ANALYSIS_BEFORE);
    const quiet = { name: 'quiet', work_type: 'feature', status: 'in-progress', phases: { specification: { items: { quiet: { status: 'in-progress' } } } } };
    writeUnit('quiet', quiet);
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 3, skips: 0 });
    assert.strictEqual(readText('both', 'manifest.json'), json(epicWithout()));
    assert.strictEqual(readText('both', ANALYSIS), ANALYSIS_AFTER);
    assert.strictEqual(readText('field', 'manifest.json'), json(epicWithout()));
    assert.strictEqual(readText('lines', ANALYSIS), ANALYSIS_AFTER);
    assert.strictEqual(readText('quiet', 'manifest.json'), json(quiet));
  });

  it('leaves the project manifest and every non-unit directory alone', () => {
    const project = json({ work_units: { pay: { work_type: 'epic' } }, defaults: { plan_format: 'local-markdown' } });
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), project);
    fs.mkdirSync(path.join(dir, '.workflows', '.inbox', 'ideas'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.workflows', 'notes'), { recursive: true });
    writeUnit('pay', epic());
    run();
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'), project);
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
  });

  it('skips when nothing carries a consult reference, every file byte-identical', () => {
    writeUnit('pay', epicWithout());
    writeAnalysis('pay', ANALYSIS_AFTER);
    writeUnit('plan', { name: 'plan', work_type: 'feature', status: 'in-progress', phases: { planning: { items: { plan: { status: 'in-progress' } } } } });
    const before = readText('pay', 'manifest.json');
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.strictEqual(readText('pay', 'manifest.json'), before);
    assert.strictEqual(readText('pay', ANALYSIS), ANALYSIS_AFTER);
  });

  it('skips a manifest that does not parse, never throwing, and leaves its analysis alone', () => {
    writeUnit('broken', 'not json');
    writeAnalysis('broken', ANALYSIS_BEFORE);
    assert.doesNotThrow(() => run());
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    assert.strictEqual(readText('broken', 'manifest.json'), 'not json');
    assert.strictEqual(readText('broken', ANALYSIS), ANALYSIS_BEFORE);
  });

  it('degrades to a skip over a manifest, phases, items, or item that is not an object', () => {
    writeUnit('nothing', 'null\n');
    writeUnit('list', '[]\n');
    writeUnit('odd', { name: 'odd', work_type: 'epic', status: 'in-progress', phases: 'nope' });
    writeUnit('odder', { name: 'odder', work_type: 'epic', status: 'in-progress', phases: { specification: { items: [] } } });
    writeUnit('oddest', { name: 'oddest', work_type: 'epic', status: 'in-progress', phases: { specification: { items: { a: ['consult_references'], b: null } } } });
    writeUnit('none', { name: 'none', work_type: 'epic', status: 'in-progress', phases: { specification: 'nope' } });
    assert.doesNotThrow(() => run());
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
  });

  it('skips a project with no work units, and one with no .workflows at all', () => {
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 2 });
  });

  it('is idempotent — a second run reports a skip and changes nothing', () => {
    writeUnit('pay', epic());
    writeAnalysis('pay', ANALYSIS_BEFORE);
    run();
    const manifest = readText('pay', 'manifest.json');
    const analysis = readText('pay', ANALYSIS);
    run();
    assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
    assert.strictEqual(readText('pay', 'manifest.json'), manifest);
    assert.strictEqual(readText('pay', ANALYSIS), analysis);
  });
});
