'use strict';

// Prose-test corpus: the deterministic perimeter (design/prose-tests.md
// P3). Every case parses, every scoped file and anchor resolves, every
// referenced world has a recipe, every state assertion is grammatical.
// The token-costing walks run on command via /prose-test — never here.

const { describe, it } = require('node:test');
const assert = require('node:assert');

const cases = require('../prose/lib/cases.cjs');

describe('prose-test corpus', () => {
  it('has at least one case', () => {
    assert.ok(cases.loadAllCases().length > 0, 'corpus is empty');
  });

  it('parses and validates cleanly', () => {
    const errors = cases.validateCorpus(cases.loadAllCases());
    assert.deepStrictEqual(errors, [],
      `corpus validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  });

  it('state assertion grammar rejects garbage', () => {
    assert.ok(cases.parseStateAssertion('file exists .workflows/x').kind === 'file-exists');
    assert.ok(cases.parseStateAssertion('manifest equals wu.planning.t review_cycle 1').kind === 'manifest-equals');
    assert.ok(cases.parseStateAssertion('json .workflows/.cache/a/b/c/state.json agents.x-001.status incorporated').kind === 'json-equals');
    assert.ok(cases.parseStateAssertion('the manifest should look right').error);
    assert.ok(cases.parseStateAssertion('file exists').error);
    assert.ok(cases.parseStateAssertion('json only.json pointer').error);
  });

  it('parses the optional stub section as free text, defaulting empty', () => {
    const all = cases.loadAllCases();
    const stubbed = all.filter((c) => c.stub);
    assert.ok(stubbed.length > 0, 'expected at least one stubbed case in the corpus');
    for (const c of stubbed) {
      assert.ok(c.world !== null, `${c.id}: a stub without a world has nothing to stub`);
    }
    for (const c of all.filter((c) => !c.stub)) {
      assert.strictEqual(c.stub, '', `${c.id}: unstubbed cases carry an empty stub`);
    }
  });
});
