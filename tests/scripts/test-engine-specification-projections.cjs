'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { discover } = require('../../skills/workflow-specification-entry/scripts/gateway.cjs');
const { specificationDetail } = require('../../skills/workflow-engine/scripts/domain/specification.cjs');
const {
  specificationDisplay, specificationMenu, specificationCompletedMenu,
} = require('../../skills/workflow-engine/scripts/domain/projections/specification.cjs');

const ADAPTER = path.resolve(__dirname, '../../skills/workflow-specification-entry/scripts/gateway.cjs');

// Golden tests: byte-exact expected strings for the specification-entry
// scenario displays and menus. Fixtures go through real manifests in temp
// dirs and the adapter's own discover(), so the goldens cover the full
// derivation path (discovery result → detail → projection).

/** @param {string} title */
function boxOf(title) {
  return [
    '●───────────────────────────────────────────────●',
    `  ${title}`,
    '●───────────────────────────────────────────────●',
    '',
  ];
}

function detailOf(dir, workUnit, opts) {
  return specificationDetail(workUnit, discover(dir, workUnit), opts);
}

// Two actionable groupings (one proposed, one in-progress with a pending
// source and a pending consult ref), one concluded spec, one in-progress
// discussion — the plural fixture the menus and trees must handle.
function groupingsFixture(dir) {
  createManifest(dir, 'v1', {
    work_type: 'epic',
    phases: {
      discussion: {
        items: {
          'auth-design': { status: 'completed' },
          'session-model': { status: 'completed' },
          'data-model': { status: 'completed' },
          'billing': { status: 'in-progress' },
        },
      },
      specification: {
        items: {
          'done-spec': {
            status: 'completed',
            sources: { 'auth-design': { status: 'incorporated' } },
          },
          'auth-flow': {
            status: 'proposed',
            sources: { 'auth-design': { status: 'pending' }, 'session-model': { status: 'pending' } },
          },
          'data-spec': {
            status: 'in-progress',
            sources: { 'data-model': { status: 'pending' }, 'session-model': { status: 'incorporated' } },
            consult_references: { 'billing': { status: 'pending' } },
          },
        },
      },
    },
  });
  createFile(dir, '.workflows/v1/specification/done-spec/specification.md', '# Done');
  createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# Data');
}

describe('specification detail: scenario derivation', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('no discussions → blocked-no-discussions', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    assert.strictEqual(detailOf(dir, 'v1').scenario, 'blocked-no-discussions');
  });

  it('discussions but none completed → blocked-none-completed', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { a: { status: 'in-progress' }, b: { status: 'in-progress' } } } },
    });
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.scenario, 'blocked-none-completed');
    assert.deepStrictEqual(d.in_progress_discussions, ['a', 'b']);
  });

  it('one completed discussion → single, even when proposed groupings exist', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { solo: { status: 'completed' } } },
        specification: { items: { grp: { status: 'proposed', sources: { solo: { status: 'pending' } } } } },
      },
    });
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.scenario, 'single');
    // A proposed grouping has no file — it never covers the discussion.
    assert.strictEqual(d.single.variant, 'no-spec');
    assert.strictEqual(d.single.verb, 'Creating');
    assert.strictEqual(d.single.proceed_name, 'v1');
  });

  it('proposed groupings → groupings', () => {
    groupingsFixture(dir);
    assert.strictEqual(detailOf(dir, 'v1').scenario, 'groupings');
  });

  it('valid cache with no proposed and no specs → analysis-rerun, no display', () => {
    const crypto = require('crypto');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          analysis_cache: { checksum: crypto.createHash('md5').update('# A# B').digest('hex'), generated: '2026-01-01' },
          items: { a: { status: 'completed' }, b: { status: 'completed' } },
        },
      },
    });
    createFile(dir, '.workflows/v1/discussion/a.md', '# A');
    createFile(dir, '.workflows/v1/discussion/b.md', '# B');
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.scenario, 'analysis-rerun');
    assert.strictEqual(d.cache_status, 'valid');
    assert.strictEqual(specificationDisplay(d), '');
    assert.deepStrictEqual(specificationMenu(d), { keys: [], rendered: '' });
  });

  it('no specs and no cache → analyze', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } } },
    });
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.scenario, 'analyze');
    assert.strictEqual(d.cache_status, 'none');
  });

  it('materialized specs with no proposed → specs-menu', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: { items: { 'a-spec': { status: 'in-progress', sources: { a: { status: 'pending' } } } } },
      },
    });
    createFile(dir, '.workflows/v1/specification/a-spec/specification.md', '# A');
    assert.strictEqual(detailOf(dir, 'v1').scenario, 'specs-menu');
  });

  it('sources with a deleted discussion item are skipped from rows', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: {
            's': {
              status: 'in-progress',
              sources: { a: { status: 'incorporated' }, ghost: { status: 'incorporated' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/s/specification.md', '# S');
    const row = detailOf(dir, 'v1').actionable[0];
    assert.deepStrictEqual(row.sources, [{ name: 'a', tag: 'extracted' }]);
    assert.strictEqual(row.total, 1);
    assert.strictEqual(row.extracted, 1);
  });

  it('consult hints enrich proposed rows as pending consult entries', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: { items: { 'auth-flow': { status: 'proposed', sources: { a: { status: 'pending' } } } } },
      },
    });
    const d = detailOf(dir, 'v1', {
      consultHints: { 'auth-flow': [{ name: 'b', hint: 'session slice' }] },
    });
    assert.deepStrictEqual(d.actionable[0].consult, [{ name: 'b', status: 'pending', hint: 'session slice' }]);
    assert.strictEqual(d.actionable[0].consult_pending, 1);
  });
});

describe('specification projections: display goldens', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('groupings: plural trees with positional branches, ⚑ block, key, and tip', () => {
    groupingsFixture(dir);
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      'Recommended breakdown for specifications with their source discussions.',
      '',
      '1. Auth Flow',
      '   ├─ Spec: [no spec]',
      '   └─ Discussions:',
      '      ├─ auth-design [ready]',
      '      └─ session-model [ready]',
      '',
      '2. Data Spec',
      '   ├─ Spec: in-progress (1 of 2 sources extracted)',
      '   ├─ Discussions:',
      '   │  ├─ data-model [pending]',
      '   │  └─ session-model [extracted]',
      '   └─ Consult:',
      '      └─ billing [pending]',
      '',
      '⚑ Discussions not ready for specification:',
      '  These discussions are still in progress and must be completed',
      '  before they can be included in a specification.',
      '',
      '  • billing',
      '',
      'Key:',
      '',
      '  Discussion status:',
      '    extracted — content has been incorporated into the specification',
      '    pending   — listed as source but content not yet extracted',
      '    ready     — completed and available to be specified',
      '',
      '  Consult status:',
      '    pending — sibling correction not yet read in and reconciled',
      '',
      '  Spec status:',
      '    in-progress — specification work is ongoing',
      '',
      'Tip: To restructure groupings or pull a discussion into its own',
      'specification, choose "Re-analyze" and provide guidance.',
      '',
    ].join('\n'));
  });

  it('specs-menu: plural trees, unassigned list, reopened tag, stale cache message', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          analysis_cache: { checksum: 'stale-hash', generated: '2026-01-01' },
          items: {
            'auth-design': { status: 'in-progress' },
            'data-model': { status: 'completed' },
            'billing': { status: 'completed' },
            'reports': { status: 'completed' },
          },
        },
        specification: {
          items: {
            'auth-spec': {
              status: 'in-progress',
              sources: { 'auth-design': { status: 'incorporated' } },
            },
            'data-spec': {
              status: 'completed',
              sources: { 'data-model': { status: 'incorporated' }, 'billing': { status: 'pending' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/discussion/data-model.md', '# Data');
    createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# Auth');
    createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# Data');
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      '3 completed discussions found. 2 specifications exist.',
      '',
      'Existing specifications:',
      '',
      '1. Auth Spec',
      '   ├─ Spec: in-progress (1 of 1 sources extracted)',
      '   └─ Discussions:',
      '      └─ auth-design [extracted, reopened]',
      '',
      '2. Data Spec',
      '   ├─ Spec: completed (1 of 2 sources extracted)',
      '   └─ Discussions:',
      '      ├─ data-model [extracted]',
      '      └─ billing [pending]',
      '',
      'Completed discussions not in a specification:',
      '  • reports',
      '',
      '⚑ Discussions not ready for specification:',
      '  These discussions are still in progress and must be completed',
      '  before they can be included in a specification.',
      '',
      '  • auth-design',
      '',
      'Key:',
      '',
      '  Discussion status:',
      '    extracted — content has been incorporated into the specification',
      '    pending   — listed as source but content not yet extracted',
      '    reopened  — was extracted but discussion has regressed to in-progress',
      '',
      '  Spec status:',
      '    in-progress — specification work is ongoing',
      '    completed   — specification is done',
      '',
      'A previous grouping analysis exists but is outdated — discussions',
      'have changed since it was created. Re-analysis is required.',
      '',
    ].join('\n'));
  });

  it('specs-menu: all concluded renders the completed pointer and no-cache message', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: {
            's1': { status: 'completed', sources: { a: { status: 'incorporated' } } },
            's2': { status: 'completed', sources: { b: { status: 'incorporated' } } },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/s1/specification.md', '# S1');
    createFile(dir, '.workflows/v1/specification/s2/specification.md', '# S2');
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      '2 completed discussions found. 2 specifications exist.',
      '',
      'All specifications are completed — see Manage completed specifications.',
      '',
      'No grouping analysis exists.',
      '',
    ].join('\n'));
  });

  it('specs-menu: a single spec renders with singular agreement — "1 specification exists"', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: {
            's1': { status: 'completed', sources: { a: { status: 'incorporated' }, b: { status: 'incorporated' } } },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/s1/specification.md', '# S1');
    const out = specificationDisplay(detailOf(dir, 'v1'));
    assert.ok(out.includes('\n2 completed discussions found. 1 specification exists.\n'), out);
    assert.ok(!out.includes('1 specifications'), out);
  });

  it('single no-spec: ready row, no spec line, ready-only key', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { solo: { status: 'completed' }, wip: { status: 'in-progress' } } } },
    });
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.single.variant, 'no-spec');
    assert.strictEqual(specificationDisplay(d), [
      ...boxOf('Specification Overview'),
      'Single completed discussion found.',
      '',
      '1. V1',
      '   ├─ Spec: [no spec]',
      '   └─ Discussions:',
      '      └─ solo [ready]',
      '',
      '⚑ Discussions not ready for specification:',
      '  These discussions are still in progress and must be completed',
      '  before they can be included in a specification.',
      '',
      '  • wip',
      '',
      'Key:',
      '',
      '  Discussion status:',
      '    ready — completed and available to be specified',
      '',
    ].join('\n'));
  });

  it('single has-spec: extraction count and Continuing verb', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { solo: { status: 'completed' } } },
        specification: {
          items: { solo: { status: 'in-progress', sources: { solo: { status: 'incorporated' } } } },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/solo/specification.md', '# Solo');
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.single.variant, 'has-spec');
    assert.strictEqual(d.single.verb, 'Continuing');
    assert.strictEqual(d.single.proceed_name, 'v1');
    assert.strictEqual(specificationDisplay(d), [
      ...boxOf('Specification Overview'),
      'Single completed discussion found with existing specification.',
      '',
      '1. V1',
      '   ├─ Spec: in-progress (1 of 1 sources extracted)',
      '   └─ Discussions:',
      '      └─ solo [extracted]',
      '',
      'Key:',
      '',
      '  Discussion status:',
      '    extracted — content has been incorporated into the specification',
      '',
      '  Spec status:',
      '    in-progress — specification work is ongoing',
      '',
    ].join('\n'));
  });

  it('single grouped: spec name as title, all sources shown, Refining when concluded', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: { solo: { status: 'completed' }, other: { status: 'in-progress' } },
        },
        specification: {
          items: {
            'combined-spec': {
              status: 'completed',
              sources: { solo: { status: 'incorporated' }, other: { status: 'incorporated' } },
            },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/combined-spec/specification.md', '# C');
    const d = detailOf(dir, 'v1');
    assert.strictEqual(d.single.variant, 'grouped');
    assert.strictEqual(d.single.verb, 'Refining');
    assert.strictEqual(d.single.proceed_name, 'combined-spec');
    assert.strictEqual(specificationDisplay(d), [
      ...boxOf('Specification Overview'),
      'Single completed discussion found with existing multi-source specification.',
      '',
      '1. Combined Spec',
      '   ├─ Spec: completed (2 of 2 sources extracted)',
      '   └─ Discussions:',
      '      ├─ solo [extracted]',
      '      └─ other [extracted, reopened]',
      '',
      '⚑ Discussions not ready for specification:',
      '  These discussions are still in progress and must be completed',
      '  before they can be included in a specification.',
      '',
      '  • other',
      '',
      'Key:',
      '',
      '  Discussion status:',
      '    extracted — content has been incorporated into the specification',
      '    reopened  — was extracted but discussion has regressed to in-progress',
      '',
      '  Spec status:',
      '    completed — specification is done',
      '',
    ].join('\n'));
  });

  it('analyze: completed bullets and ⚑ block, no key', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: { a: { status: 'completed' }, b: { status: 'completed' }, c: { status: 'in-progress' } },
        },
      },
    });
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      '2 completed discussions found. No specifications exist yet.',
      '',
      'Completed discussions:',
      '  • a',
      '  • b',
      '',
      '⚑ Discussions not ready for specification:',
      '  These discussions are still in progress and must be completed',
      '  before they can be included in a specification.',
      '',
      '  • c',
      '',
    ].join('\n'));
  });

  it('blocked-no-discussions: verbatim terminal block', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      'No discussions found.',
      '',
      'The specification phase requires completed discussions to work from.',
      'Discussions capture the technical decisions, edge cases, and rationale',
      'that specifications are built upon.',
      '',
    ].join('\n'));
  });

  it('blocked-none-completed: in-progress bullets in the terminal block', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { a: { status: 'in-progress' }, b: { status: 'in-progress' } } } },
    });
    assert.strictEqual(specificationDisplay(detailOf(dir, 'v1')), [
      ...boxOf('Specification Overview'),
      'No completed discussions found.',
      '',
      'The following discussions are still in progress:',
      '',
      '  • a',
      '  • b',
      '',
      'Specifications can only be created from completed discussions.',
      'Conclude at least one discussion before proceeding.',
      '',
    ].join('\n'));
  });
});

describe('specification projections: menu goldens', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('groupings: numbered rows, unify + re-analyze descriptions, completed command', () => {
    groupingsFixture(dir);
    const menu = specificationMenu(detailOf(dir, 'v1'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '- **`1`** — Start "Auth Flow" — 2 ready discussion(s)',
      '- **`2`** — Continue "Data Spec" — 1 source(s) pending extraction — 1 consult ref(s) pending',
      '- **`3`** — Unify all into single specification',
      '   `All discussions are combined into one specification. Existing`',
      '   `specifications are incorporated and superseded.`',
      '- **`4`** — Re-analyze groupings',
      '   `Current groupings are discarded and rebuilt. Existing`',
      '   `specification names are preserved. You can provide guidance`',
      '   `in the next step.`',
      '',
      '- **`c`/`completed`** — Manage completed specifications — 1 completed',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.topic, k.verb]),
      [
        ['1', 'start_spec', 'auth-flow', 'Creating'],
        ['2', 'continue_spec', 'data-spec', 'Continuing'],
        ['3', 'unify', null, 'Creating'],
        ['4', 'reanalyze', null, null],
        ['c', 'completed_menu', null, null],
      ]
    );
  });

  it('groupings: one grouping and no materialized specs — no unify, plain re-analyze', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: {
            'only-grp': {
              status: 'proposed',
              sources: { a: { status: 'pending' }, b: { status: 'pending' } },
            },
          },
        },
      },
    });
    const menu = specificationMenu(detailOf(dir, 'v1'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '- **`1`** — Start "Only Grp" — 2 ready discussion(s)',
      '- **`2`** — Re-analyze groupings',
      '   `Current groupings are discarded and rebuilt. You can provide`',
      '   `guidance in the next step.`',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
  });

  it('specs-menu: analyze first with description, continue rows, completed command', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          items: { a: { status: 'completed' }, b: { status: 'completed' }, c: { status: 'completed' } },
        },
        specification: {
          items: {
            'auth-spec': { status: 'in-progress', sources: { a: { status: 'incorporated' } } },
            'data-spec': {
              status: 'completed',
              sources: { b: { status: 'incorporated' }, c: { status: 'pending' } },
              consult_references: { a: { status: 'pending' } },
            },
            'done-spec': { status: 'completed', sources: { b: { status: 'incorporated' } } },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth-spec/specification.md', '# A');
    createFile(dir, '.workflows/v1/specification/data-spec/specification.md', '# D');
    createFile(dir, '.workflows/v1/specification/done-spec/specification.md', '# X');
    const menu = specificationMenu(detailOf(dir, 'v1'));
    assert.strictEqual(menu.rendered, [
      '· · · · · · · · · · · ·',
      '- **`1`** — Analyze for groupings (recommended)',
      '   `All discussions are analyzed for natural groupings. Existing`',
      '   `specification names are preserved. You can provide guidance`',
      '   `in the next step.`',
      '- **`2`** — Continue "Auth Spec" — in-progress',
      '- **`3`** — Continue "Data Spec" — 1 new source(s) to extract — 1 consult ref(s) pending',
      '',
      '- **`c`/`completed`** — Manage completed specifications — 1 completed',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      menu.keys.map((k) => [k.key, k.action, k.topic, k.verb]),
      [
        ['1', 'analyze', null, null],
        ['2', 'continue_spec', 'auth-spec', 'Continuing'],
        ['3', 'continue_spec', 'data-spec', 'Continuing'],
        ['c', 'completed_menu', null, null],
      ]
    );
  });

  it('completed sub-view: plural refine entries and back', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: {
            'auth-flow': { status: 'completed', sources: { a: { status: 'incorporated' } } },
            'data-model': { status: 'completed', sources: { b: { status: 'incorporated' } } },
          },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/auth-flow/specification.md', '# A');
    createFile(dir, '.workflows/v1/specification/data-model/specification.md', '# D');
    const sub = specificationCompletedMenu(detailOf(dir, 'v1'));
    assert.strictEqual(sub.display, [
      'Completed Specifications',
      '  ├─ Auth Flow [completed]',
      '  └─ Data Model [completed]',
      '',
    ].join('\n'));
    assert.strictEqual(sub.rendered, [
      '· · · · · · · · · · · ·',
      'Which completed specification would you like to refine?',
      '',
      '- **`1`** — Refine "Auth Flow" — completed',
      '- **`2`** — Refine "Data Model" — completed',
      '- **`b`/`back`** — Return to the specifications menu',
      '',
      'Select an option:',
      '· · · · · · · · · · · ·',
    ].join('\n'));
    assert.deepStrictEqual(
      sub.keys.map((k) => [k.key, k.action, k.topic, k.verb]),
      [
        ['1', 'refine_spec', 'auth-flow', 'Refining'],
        ['2', 'refine_spec', 'data-model', 'Refining'],
        ['b', 'back', null, null],
      ]
    );
  });
});

describe('specification adapter: gateway verbs', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @param {string[]} args */
  function run(args) {
    const res = spawnSync('node', [ADAPTER, ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    return res.stdout;
  }

  it('view emits DATA + DISPLAY + MENU with scenario, ACTIONS, and doc-parsed consult hints', () => {
    groupingsFixture(dir);
    createFile(dir, '.workflows/v1/.state/discussion-consolidation-analysis.md', [
      '# Discussion Consolidation Analysis',
      '',
      '## Recommended Groupings',
      '',
      '### Auth Flow',
      '- **auth-design**: core auth',
      '',
      '**Coupling**: auth surface',
      '**Consult**: billing — pricing slice supersedes the auth draft',
      '',
    ].join('\n'));
    const out = run(['view', 'v1']);
    assert.ok(out.includes('=== DATA (reason from this — never display or parse the sections below) ==='));
    assert.ok(out.includes('=== DISPLAY (emit verbatim as a code block) ==='));
    assert.ok(out.includes('=== MENU (emit verbatim as markdown) ==='));
    assert.ok(out.includes('scenario: groupings\n'));
    assert.ok(out.includes('discussions_checksum: (none)'));
    assert.ok(out.includes('    consult: billing (pending — pricing slice supersedes the auth draft)'));
    assert.ok(out.includes('ACTIONS (key  action  topic  verb):'));
    assert.ok(out.includes('  1  start_spec  auth-flow  Creating'));
    assert.ok(out.includes('- **`1`** — Start "Auth Flow" — 2 ready discussion(s) — 1 consult ref(s) pending'));
  });

  it('view for a blocked work unit emits DATA + DISPLAY and no MENU', () => {
    createManifest(dir, 'v1', { work_type: 'epic' });
    const out = run(['view', 'v1']);
    assert.ok(out.includes('scenario: blocked-no-discussions'));
    assert.ok(out.includes('=== DISPLAY (emit verbatim as a code block) ==='));
    assert.ok(!out.includes('=== MENU'));
    assert.ok(!out.includes('ACTIONS'));
  });

  it('view for analysis-rerun emits DATA only', () => {
    const crypto = require('crypto');
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: {
          analysis_cache: { checksum: crypto.createHash('md5').update('# A# B').digest('hex'), generated: '2026-01-01' },
          items: { a: { status: 'completed' }, b: { status: 'completed' } },
        },
      },
    });
    createFile(dir, '.workflows/v1/discussion/a.md', '# A');
    createFile(dir, '.workflows/v1/discussion/b.md', '# B');
    const out = run(['view', 'v1']);
    assert.ok(out.includes('scenario: analysis-rerun'));
    assert.ok(out.includes('cache_status: valid'));
    assert.ok(!out.includes('=== DISPLAY'));
    assert.ok(!out.includes('=== MENU'));
  });

  it('view for the single scenario carries the verb flags and no MENU', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: { discussion: { items: { solo: { status: 'completed' } } } },
    });
    const out = run(['view', 'v1']);
    assert.ok(out.includes('scenario: single'));
    assert.ok(out.includes('single_variant: no-spec'));
    assert.ok(out.includes('verb: Creating'));
    assert.ok(out.includes('proceed_name: v1'));
    assert.ok(out.includes('=== DISPLAY'));
    assert.ok(!out.includes('=== MENU'));
  });

  it('completed-menu emits the sub-view sections', () => {
    createManifest(dir, 'v1', {
      work_type: 'epic',
      phases: {
        discussion: { items: { a: { status: 'completed' }, b: { status: 'completed' } } },
        specification: {
          items: { 'done-spec': { status: 'completed', sources: { a: { status: 'incorporated' } } } },
        },
      },
    });
    createFile(dir, '.workflows/v1/specification/done-spec/specification.md', '# X');
    const out = run(['completed-menu', 'v1']);
    assert.ok(out.includes('  1  refine_spec  done-spec  Refining'));
    assert.ok(out.includes('Completed Specifications'));
    assert.ok(out.includes('- **`1`** — Refine "Done Spec" — completed'));
    assert.ok(out.includes('- **`b`/`back`** — Return to the specifications menu'));
  });

  it('no-arg and positional forms emit the thin state line, not sectioned output', () => {
    groupingsFixture(dir);
    const noArg = run([]);
    const scoped = run(['v1']);
    for (const out of [noArg, scoped]) {
      assert.ok(out.includes('=== STATE ==='));
      assert.ok(out.includes('counts: discussions='));
      assert.ok(!out.includes('=== DISCUSSIONS ==='));
      assert.ok(!out.includes('=== SPECIFICATIONS ==='));
      assert.ok(!out.includes('=== CACHE ==='));
      assert.ok(!out.includes('=== DATA'));
    }
  });
});
