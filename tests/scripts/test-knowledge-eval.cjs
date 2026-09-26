'use strict';

// The knowledge base's retrieval, measured: the judged cases validate against
// the frozen corpus, and the keyword mode's measurements match the pinned
// baseline exactly. A move in either direction fails; a deliberate one is
// re-pinned by `node tests/scripts/knowledge-eval.cjs --pin`.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const knowledgeEval = require('./knowledge-eval.cjs');

const SOURCE = '.workflows/fumi/discussion/search-and-retrieval.md';
const ANCHOR = 'A switch on the main search area';

/** A sound fumi case, with `overrides` laid over it. */
function fumiCase(overrides = {}) {
  return {
    id: 'probe',
    project: 'fumi',
    origin: 'written',
    asked: '2026-09-15',
    need: 'whether history is searchable',
    terms: ['version history search'],
    options: {},
    relevant: [{ source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 }],
    ...overrides,
  };
}

/** A sound negative asked in tick, with `overrides` laid over it. */
function negativeCase(overrides = {}) {
  return fumiCase({ origin: 'negative', from: 'tick', relevant: [], ...overrides });
}

describe('knowledge eval — keyword mode', () => {
  it('the judged cases validate against the corpus', () => {
    assert.deepStrictEqual(knowledgeEval.validateCases(knowledgeEval.loadCases()), []);
  });

  it('validation names every broken case, option and judgment', () => {
    const problems = knowledgeEval.validateCases([
      fumiCase(),
      fumiCase(),
      negativeCase({ id: 'sound-negative', options: { limit: 3 } }),
      fumiCase({ id: 'bad-shape', origin: 'found', asked: '2026-02-30', extra: true }),
      negativeCase({ id: 'negative-from-itself', from: 'fumi' }),
      fumiCase({ id: 'no-terms', terms: [] }),
      fumiCase({
        id: 'bad-options',
        options: { boosts: [{ field: 'bogus', value: 'x' }, { field: 'phase', value: null }], limit: 0, filter: 'x', phase: '' },
      }),
      fumiCase({ id: 'boosts-not-a-list', options: { boosts: 'work-unit' } }),
      negativeCase({ id: 'negative-filtered', options: { 'work-type': 'epic' } }),
      fumiCase({
        id: 'names-absent',
        options: { 'work-unit': 'fumi, nowhere', boosts: [{ field: 'phase', value: 'specification' }, { field: 'topic', value: 'note-model' }] },
      }),
      negativeCase({ id: 'negative-judged', relevant: fumiCase().relevant }),
      fumiCase({ id: 'relevant-not-a-list', relevant: {} }),
      fumiCase({
        id: 'bad-judgments',
        relevant: [
          { source: '.workflows/fumi/nowhere.md', anchor: 'x', grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'not a phrase in the file', grade: 'supporting', framing: 3 },
          { source: SOURCE, anchor: ANCHOR, grade: 'key', framing: 0 },
          { source: SOURCE, anchor: 'FTS5', grade: 'supporting', framing: 0 },
          { source: SOURCE, anchor: ANCHOR, grade: 'supporting', framing: 0 },
        ],
      }),
      fumiCase({ id: 'no-primary', relevant: [{ ...fumiCase().relevant[0], grade: 'supporting' }] }),
      fumiCase({
        id: 'primary-filtered-out',
        options: { topic: 'engine-architecture' },
        relevant: [
          { source: SOURCE, anchor: ANCHOR, grade: 'primary', framing: 0 },
          { source: SOURCE, anchor: 'Spotlight', grade: 'supporting', framing: 0 },
          { source: '.workflows/fumi/discussion/engine-architecture.md', anchor: '## Process Model', grade: 'primary', framing: 0 },
        ],
      }),
    ]);
    assert.deepStrictEqual(problems, [
      'probe: the id is not unique',
      'bad-shape: unknown key "extra"',
      'bad-shape: origin must be one of harvested, written, negative',
      'bad-shape: asked must be a YYYY-MM-DD date',
      'negative-from-itself: from must name another project',
      'no-terms: terms must be a non-empty list of non-empty strings',
      'no-terms: relevant[0]: framing must index a term',
      'bad-options: unknown option "filter"',
      'bad-options: phase must be a non-empty string',
      'bad-options: limit must be a positive integer',
      'bad-options: Unknown --boost field: "bogus". Valid fields: work-unit, work-type, phase, topic, confidence',
      'bad-options: --boost:phase requires a value',
      'boosts-not-a-list: boosts must be a list',
      'negative-filtered: a negative case carries no hard filter',
      'names-absent: no work-unit "nowhere" in the fumi fixture',
      'names-absent: no phase "specification" in the fumi fixture',
      'negative-judged: a negative case judges nothing relevant',
      'relevant-not-a-list: relevant must be a list',
      'bad-judgments: relevant[0]: .workflows/fumi/nowhere.md is not in the fumi fixture',
      'bad-judgments: relevant[1]: framing must index a term',
      `bad-judgments: relevant[1]: the anchor is not in ${SOURCE}`,
      'bad-judgments: relevant[2]: grade must be one of primary, supporting',
      `bad-judgments: relevant[3]: the anchor occurs 6 times in ${SOURCE}`,
      'bad-judgments: relevant[4]: judges a passage already judged',
      'no-primary: no primary judgment',
      'primary-filtered-out: relevant[0]: a primary passage outside the hard filters is unreachable',
    ]);
  });

  it('a judgment no chunk of the built store carries is named', () => {
    const chunks = [
      { source_file: SOURCE, content: `Before. ${ANCHOR} — include history. After.` },
      { source_file: '.workflows/fumi/discussion/note-model.md', content: 'A switch on the main search area, restated.' },
    ];
    const split = { source: SOURCE, anchor: 'include history — widens the query', grade: 'primary', framing: 0 };
    const elsewhere = { source: '.workflows/fumi/discussion/note-window.md', anchor: ANCHOR, grade: 'supporting', framing: 0 };
    const cases = [fumiCase(), fumiCase({ id: 'unmatched', relevant: [...fumiCase().relevant, split, elsewhere] }), negativeCase()];
    assert.deepStrictEqual(knowledgeEval.unmatchedJudgments(cases, chunks), [
      `unmatched: relevant[1]: no indexed chunk of ${SOURCE} carries the anchor`,
      'unmatched: relevant[2]: no indexed chunk of .workflows/fumi/discussion/note-window.md carries the anchor',
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
    assert.match(knowledgeEval.movesMessage(moves, 'hybrid'), /re-pin .*: node tests\/scripts\/knowledge-eval\.cjs --pin --hybrid$/);
  });

  it('a run embedded with another provider than the baseline refuses to compare', () => {
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536, base_url: null };
    const stub = { provider: 'stub', model: 'stub', dimensions: 128, base_url: null };
    const summary = { metrics: { overall: { 'hit@5': 1 } }, cases: {} };
    assert.throws(
      () => knowledgeEval.baselineMoves({ provider: openai, ...summary }, { provider: stub, ...summary }, true),
      { message: 'the baseline was pinned with provider=openai model=text-embedding-3-small dimensions=1536, and this '
        + 'run embeds with provider=stub model=stub dimensions=128 — run under the pinned provider, or re-pin under '
        + 'this one: node tests/scripts/knowledge-eval.cjs --pin --hybrid' },
    );
    assert.deepStrictEqual(knowledgeEval.baselineMoves({ provider: openai, ...summary }, { provider: openai, ...summary }, true), []);
  });

  it('the keyword mode matches the pinned baseline exactly', async () => {
    const { summary } = await knowledgeEval.evaluate();
    const moves = knowledgeEval.baselineMoves(knowledgeEval.readBaseline('keyword'), summary, true);
    assert.deepStrictEqual(moves, [], knowledgeEval.movesMessage(moves, 'keyword'));
  });
});
