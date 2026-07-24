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
    assert.ok(cases.parseStateAssertion('the manifest should look right').error);
    assert.ok(cases.parseStateAssertion('file exists').error);
  });
});
