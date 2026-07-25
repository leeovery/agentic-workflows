'use strict';

// Prose-test corpus: the deterministic perimeter (design/prose-tests.md
// P3). Every case parses, every scoped file and anchor resolves, every
// named world and stub exists, every case states an expected trace. The
// token-costing walks run on command via /prose-test — never here.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const cases = require('../prose/lib/cases.cjs');

describe('prose-test corpus', () => {
  const all = cases.loadAllCases();

  it('has at least one case', () => {
    assert.ok(all.length > 0, 'corpus is empty');
  });

  it('parses and validates cleanly', () => {
    const errors = cases.validateCorpus(all);
    assert.deepStrictEqual(errors, [],
      `corpus validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  });

  it('is flat: one case per file, filename equal to the id', () => {
    const seen = new Set();
    for (const c of all) {
      assert.ok(!seen.has(c.file), `${c.file}: more than one case in a file`);
      seen.add(c.file);
      assert.strictEqual(path.dirname(c.file), 'tests/prose',
        `${c.file}: cases are flat — nothing groups them but their files: scope`);
      assert.strictEqual(path.basename(c.file, '.md'), c.id,
        `${c.file}: filename must equal the case id`);
    }
  });

  it('every stub is named, triggered by its case, and readable', () => {
    for (const c of all) {
      for (const s of c.stubs) {
        assert.ok(s.trigger.length > 0,
          `${c.id}: stub "${s.name}" has no trigger — a stub without a moment is arrange in disguise`);
        const stub = cases.readStub(s.name);
        assert.ok(stub.content.length > 0, `stub "${s.name}" has no content below its --- fence`);
      }
    }
  });

  it('multi-line trace steps and notes join rather than truncate', () => {
    for (const c of all) {
      for (const t of c.trace) assert.ok(!/\s$/.test(t), `${c.id}: trace step has trailing whitespace`);
      for (const n of c.notes) assert.ok(n.length > 0, `${c.id}: empty note`);
    }
    const wrapped = all.flatMap((c) => c.notes).filter((n) => n.length > 70);
    assert.ok(wrapped.length > 0, 'expected at least one note long enough to have wrapped in source');
  });
});
