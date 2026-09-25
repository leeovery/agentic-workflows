'use strict';

// The knowledge base's retrieval, measured: the judged cases validate against
// the frozen corpus, and the keyword leg's measurements match the pinned
// baseline exactly. A move in either direction fails; a deliberate one is
// re-pinned by `node tests/scripts/knowledge-eval.cjs --pin`.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const knowledgeEval = require('./knowledge-eval.cjs');

const SOURCE = '.workflows/fumi/discussion/search-and-retrieval.md';

/** A sound fumi case, with `overrides` laid over it. */
function fumiCase(overrides = {}) {
  return {
    id: 'probe',
    project: 'fumi',
    origin: 'written',
    need: 'whether history is searchable',
    terms: ['version history search'],
    options: {},
    relevant: [{ source: SOURCE, anchor: 'A switch on the main search area', grade: 'primary', framing: 0 }],
    ...overrides,
  };
}

describe('knowledge eval — keyword leg', () => {
  it('the judged cases validate against the corpus', () => {
    assert.deepStrictEqual(knowledgeEval.validateCases(knowledgeEval.loadCases()), []);
  });

  it('validation names every broken case and judgment', () => {
    const problems = knowledgeEval.validateCases([
      fumiCase(),
      fumiCase(),
      fumiCase({ id: 'no-terms', terms: [] }),
      fumiCase({ id: 'bad-options', options: { boosts: [{ field: 'bogus', value: 'x' }], limit: 0, filter: 'x' } }),
      fumiCase({ id: 'negative-judged', origin: 'negative' }),
      fumiCase({
        id: 'bad-judgments',
        relevant: [
          { source: '.workflows/fumi/nowhere.md', anchor: 'x', grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'not a phrase in the file', grade: 'supporting', framing: 3 },
          { source: SOURCE, anchor: 'A switch on the main search area', grade: 'key', framing: 0 },
        ],
      }),
      fumiCase({ id: 'no-primary', relevant: [{ ...fumiCase().relevant[0], grade: 'supporting' }] }),
    ]);
    assert.deepStrictEqual(problems, [
      'probe: the id is not unique',
      'no-terms: terms must be a non-empty list of non-empty strings',
      'no-terms: relevant[0]: framing must index a term',
      'bad-options: unknown option "filter"',
      'bad-options: limit must be a positive integer',
      'bad-options: Unknown --boost field: "bogus". Valid fields: work-unit, work-type, phase, topic, confidence',
      'negative-judged: a negative case judges nothing relevant',
      'bad-judgments: relevant[0]: .workflows/fumi/nowhere.md is not in the fumi fixture',
      'bad-judgments: relevant[1]: framing must index a term',
      `bad-judgments: relevant[1]: the anchor is not in ${SOURCE}`,
      'bad-judgments: relevant[2]: grade must be one of primary, supporting',
      'no-primary: no primary judgment',
    ]);
  });

  it('a move names each metric and case that moved, and how to re-pin', () => {
    const pinned = {
      metrics: { overall: { 'hit@5': 0.5, bytes: 100 } },
      cases: { a: { first: 3, bytes: 100 }, gone: { first: 1, bytes: 10 } },
    };
    const run = {
      metrics: { overall: { 'hit@5': 0.75, bytes: 100 } },
      cases: { a: { first: 1, bytes: 90 }, added: { first: null, bytes: 5 } },
    };
    const moves = knowledgeEval.baselineMoves(pinned, run, true);
    assert.deepStrictEqual(moves, [
      'overall hit@5: 0.5 → 0.75',
      'case a: first 3 → 1, bytes 100 → 90',
      'case gone: pinned, no longer run',
      'case added: not pinned',
    ]);
    assert.match(knowledgeEval.movesMessage(moves, 'keyword'), /re-pin .*: node tests\/scripts\/knowledge-eval\.cjs --pin$/);
  });

  it('the keyword leg matches the pinned baseline exactly', async () => {
    const { moves } = await knowledgeEval.evaluate();
    assert.deepStrictEqual(moves, [], knowledgeEval.movesMessage(moves, 'keyword'));
  });
});
