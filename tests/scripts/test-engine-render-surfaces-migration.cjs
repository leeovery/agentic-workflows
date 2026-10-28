'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the legacy research
// split. They go with the rest of the migration (29.17), which removes their
// callers.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, unwrap, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render legacy-split-display', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const themes = [
    { kebab_name: 'auth', summary: 'Login, sessions, and token refresh' },
    { kebab_name: 'caching', summary: 'Response caching and invalidation' },
  ];

  it('candidates: the theme list as a batch worklist — the name per row, its summary beneath', () => {
    const file = writePayload(dir, 'candidates.json', { source: 'auth', themes });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file }), [
      '=== DISPLAY: legacy split candidates (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      'Candidate themes for auth.md:',
      '',
      '1\\. auth',
      `${NB(5)}↳ Login, sessions, and token refresh`,
      '2\\. caching',
      `${NB(5)}↳ Response caching and invalidation`,
      '',
    ].join('\n'));
  });

  // A cache row carries the absolute path, wrapped to the width wherever the
  // fixture's temp folder puts the breaks: the rows are pinned with the path
  // set aside, and each path is read back with its breaks taken out.
  const CACHE_ROW = /   └─ Cache:[^\n]*(?:\n {6}\S[^\n]*)*/g;
  const cachePaths = (out) => (out.match(CACHE_ROW) || [])
    .map((row) => row.replace(/^ {3}└─ Cache:\s*/, '').replace(/\n {6}/g, ''));
  const withoutCachePaths = (out) => out.replace(CACHE_ROW, '   └─ Cache: …');

  it('plan: each theme as a numbered summary/content/cache tree, then the rename footer naming the stamp apply mints', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at login' },
      { ...themes[1], paragraph_count: 2, content_preview: 'Responses are cached per route' },
    ] });
    const out = renderSurface(dir, 'legacy-split-display', { variant: 'plan', file });
    assert.deepStrictEqual(cachePaths(out), ['auth', 'caching']
      .map((name) => path.join(dir, `.leeway/.cache/pay/legacy-split/auth/${name}.md`)));
    assert.strictEqual(withoutCachePaths(out), [
      '=== DISPLAY: legacy split plan (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Plan for auth.md:',
      '',
      '1. auth',
      '   ├─ Summary: Login, sessions, and token refresh',
      '   ├─ Content: 4 para(s) — "The auth flow begins at login..."',
      '   └─ Cache: …',
      '',
      '2. caching',
      '   ├─ Summary: Response caching and invalidation',
      '   ├─ Content: 2 para(s) — "Responses are cached per route..."',
      '   └─ Cache: …',
      '',
      'Source file will be renamed to auth-superseded-<datetime>.md.',
      '',
    ].join('\n'));
  });

  it('plan: a long preview wraps under its text column with the rail intact, and no row overflows the width', () => {
    const file = writePayload(dir, 'plan-display.json', { source: 'auth', work_unit: 'pay', themes: [
      { ...themes[0], paragraph_count: 4, content_preview: 'The auth flow begins at the login form and hands a session to' },
    ] });
    const out = renderSurface(dir, 'legacy-split-display', { variant: 'plan', file });
    assert.ok(withoutCachePaths(out).includes([
      '   ├─ Content: 4 para(s) — "The auth flow begins at the login',
      '   │  form and hands a session to..."',
      '   └─ Cache: …',
    ].join('\n')), out);
    for (const line of out.split('\n').slice(1)) assert.ok(line.length <= 65, `overflowing row: ${line}`);
  });

  it('errors: the validator\'s lines as bullets under the source', () => {
    const file = writePayload(dir, 'errors.json', { source: 'auth', errors: [
      "theme 'auth' has empty summary",
      "theme 'caching' has no cache file at caching.md",
    ] });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'errors', file }), [
      '=== DISPLAY: legacy split errors (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Validation failed for auth:',
      '',
      "  • theme 'auth' has empty summary",
      "  • theme 'caching' has no cache file at caching.md",
      '',
    ].join('\n'));
  });

  it('refuses a missing or unknown variant, a missing or absent file, and a payload short of its variant\'s fields', () => {
    const bad = (name, variant, obj) => () => renderSurface(dir, 'legacy-split-display', { variant, file: writePayload(dir, name, obj) });
    assert.throws(() => renderSurface(dir, 'legacy-split-display', {}), /--variant must be one of sources, processing, complete, candidates, plan, errors, apply, got ""/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'themes' }), /--variant must be one of sources, processing, complete, candidates, plan, errors, apply, got "themes"/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates' }), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'candidates', file: 'nope.json' }), /payload file not found: nope\.json/);
    assert.throws(bad('s.json', 'candidates', { themes }), /"source" must be a non-empty string/);
    assert.throws(bad('e.json', 'candidates', { source: 'auth', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary\}/);
    assert.throws(bad('m.json', 'candidates', { source: 'auth', themes: [themes[0], { kebab_name: 'caching' }] }), /theme 2 is missing "summary"/);
    assert.throws(bad('w.json', 'plan', { source: 'auth', themes }), /"work_unit" must be a non-empty string/);
    assert.throws(bad('pe.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [] }), /"themes" must be a non-empty array of \{kebab_name, summary, content_preview, paragraph_count\}/);
    assert.throws(bad('pp.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: 1 }] }), /theme 1 is missing "content_preview"/);
    assert.throws(bad('pc.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: '3', content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('pn.json', 'plan', { source: 'auth', work_unit: 'pay', themes: [{ ...themes[0], paragraph_count: -1, content_preview: 'x' }] }), /theme 1 "paragraph_count" must be a non-negative integer/);
    assert.throws(bad('ee.json', 'errors', { source: 'auth', errors: [] }), /"errors" must be a non-empty array of strings/);
    assert.throws(bad('eb.json', 'errors', { source: 'auth', errors: ['ok', ''] }), /errors\[1\] must be a non-empty string/);
  });

  // An epic whose map holds a qualifying source, one a crashed apply left
  // mid-split, one whose name the split cannot process, and two that do not
  // qualify — a parked research item, and a source whose file is gone.
  const legacyEpic = () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: {
          auth: { routing: 'research', source: 'migration-seeded' },
          'bad.name': { routing: 'research', source: 'migration-seeded' },
          billing: { routing: 'research', source: 'discovery', legacy_split_state: 'in-progress' },
          parked: { routing: 'research', source: 'migration-seeded' },
          vanished: { routing: 'research', source: 'migration-seeded' },
        } },
        research: { items: {
          auth: { status: 'in-progress' },
          'bad.name': { status: 'in-progress' },
          parked: { status: 'unstarted' },
          vanished: { status: 'in-progress' },
        } },
      },
    });
    for (const name of ['auth', 'bad.name', 'parked']) writePayload(dir, `.leeway/pay/research/${name}.md`, '# Research\n');
  };

  it('sources: the scan read from the epic — the interrupted splits, the unsplittable sources, then the qualifying files', () => {
    legacyEpic();
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' }), [
      '=== DISPLAY: legacy split interrupted (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '  ⚑ Interrupted split(s) detected — a prior apply crashed',
      '    mid-flight.',
      '    Clear each, then reopen the epic via /workflow-start to',
      '    retry:',
      '',
      '    • billing',
      '',
      '    Per-item recovery is under "Recovery from Interrupted Apply"',
      '    at the end of this skill.',
      '',
      '=== DISPLAY: legacy split unsplittable (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '  ⚑ Unsplittable source(s) — rename each on the discovery map to',
      '    a kebab name, then reopen the epic to split:',
      '',
      '    • bad.name — name must match ^[a-z0-9][a-z0-9-]*$ (engine',
      '      dot-paths reject dots/slashes)',
      '',
      '=== DISPLAY: legacy split sources (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Qualifying source files (in-progress, migration-seeded):',
      '',
      '  • auth.md',
      '',
    ].join('\n'));
  });

  it('sources: each section stands only where the scan found its kind, and a scan that found nothing answers empty', () => {
    writeManifest(dir, 'pay', {
      phases: {
        discovery: { items: { auth: { routing: 'research', source: 'migration-seeded' } } },
        research: { items: { auth: { status: 'in-progress' } } },
      },
    });
    writePayload(dir, '.leeway/pay/research/auth.md', '# Auth\n');
    const out = renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' });
    assert.match(out, /^=== DISPLAY: legacy split sources /);
    assert.doesNotMatch(out, /interrupted|unsplittable/);

    writeManifest(dir, 'pay', { phases: { discovery: { items: { auth: { routing: 'research', source: 'discovery' } } } } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'sources' }), '');
  });

  it('processing: the sub-step a qualifying source opens on, and the signpost beneath it', () => {
    legacyEpic();
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing', source: 'auth' }), [
      '=== DISPLAY: legacy split processing (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**`▪ Processing auth`**',
      '',
      '> Working on auth.md.',
      '',
    ].join('\n'));
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing' }), /--source is required — the source the split takes up/);
  });

  describe('complete: the split\'s conclusion from the session\'s tallies, under its step marker', () => {
    const complete = (applied, abandoned, errored) => renderSurface(dir, 'legacy-split-display', {
      variant: 'complete', applied: String(applied), abandoned: String(abandoned), errored: String(errored),
    });
    const MARKER = '=== DISPLAY: legacy split complete (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===';
    const closing = (line) => [MARKER, '**`□ Legacy Split Complete`**', '', `> ${line}`, ''].join('\n');

    it('an aborted apply leads, whatever else the split did', () => {
      assert.strictEqual(complete(2, 1, 1), closing('1 source file(s) aborted mid-apply; 2 decomposed; 1 skipped. See "Recovery from Interrupted Apply" below to clear stuck sentinels before you reopen the epic via /workflow-start.'));
    });

    it('nothing done, everything decomposed, a mix, and everything skipped each close on their own line', () => {
      assert.strictEqual(complete(0, 0, 0), closing('No legacy source files needed decomposition.'));
      assert.strictEqual(complete(3, 0, 0), closing('Legacy broad research files decomposed. The discovery map now reflects topic-scoped items.'));
      assert.strictEqual(complete(2, 1, 0), closing('2 source file(s) decomposed; 1 skipped. Skipped files remain on the map and can be revisited next time you open the epic via /workflow-start.'));
      assert.strictEqual(complete(0, 2, 0), closing('No source files decomposed — every qualifying file was skipped. They remain on the map and can be revisited next time you open the epic via /workflow-start.'));
    });

    it('refuses a tally missing, negative, or not a whole number, by name', () => {
      assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'complete', abandoned: '0', errored: '0' }), /--applied must be a non-negative integer, got ""/);
      assert.throws(() => complete(1, -1, 0), /--abandoned must be a non-negative integer, got "-1"/);
      assert.throws(() => complete(1, 0, 1.5), /--errored must be a non-negative integer, got "1\.5"/);
    });
  });

  it('sources and processing refuse a non-bare address and an unknown unit; processing refuses a source the scan does not find qualifying', () => {
    legacyEpic();
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay.discovery.auth', variant: 'sources' }), /address must be a bare <work_unit>/);
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'ghost', variant: 'sources' }), /work unit "ghost" not found/);
    for (const source of ['billing', 'bad.name', 'parked', 'vanished', 'ghost']) {
      assert.throws(() => renderSurface(dir, 'legacy-split-display', { dotpath: 'pay', variant: 'processing', source }),
        new RegExp(`"${source.replace('.', '\\.')}" is not a qualifying source of "pay" — the split works through the qualifying sources alone`));
    }
  });

  it('apply: a landed split names its themes; knowledge-base cleanup warnings follow as a markdown advisory', () => {
    const applied = '=== DISPLAY: legacy split applied (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===\nApplied auth: 3 new file(s).\n';
    const clean = writePayload(dir, 'apply.json', { source: 'auth', result: { ok: true, applied: { themes: 3 } } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: clean }), applied);
    const empty = writePayload(dir, 'apply-empty.json', { source: 'auth', result: { ok: true, applied: { themes: 3 }, kb_warnings: [] } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: empty }), applied);

    const warned = writePayload(dir, 'apply-warned.json', { source: 'auth', result: {
      ok: true, applied: { themes: 3 }, kb_warnings: ['knowledge remove (research/auth) failed: store_locked', 'chunk *42* left'],
    } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: warned }), [
      applied,
      '=== DISPLAY: legacy split kb warnings (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '> ⚑ Knowledge-base cleanup reported warnings:',
      '> - knowledge remove (research/auth) failed: store\\_locked',
      '> - chunk \\*42\\* left',
      '>',
      '> The next start brings the knowledge base up to date.',
      '',
    ].join('\n'));
  });

  it('apply: a failed split names the stage it stopped at, its error, and the recovery', () => {
    const file = writePayload(dir, 'apply.json', { source: 'auth', result: {
      ok: false,
      stage: 'rename_source_file',
      error: "ENOENT: no such file or directory, rename 'auth.md'",
      recovery_hint: 'source file rename failed. Clear sentinel manually: engine manifest delete pay.discovery.auth legacy_split_state',
    } });
    assert.strictEqual(renderSurface(dir, 'legacy-split-display', { variant: 'apply', file }), [
      '=== DISPLAY: legacy split apply failed (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Apply failed for auth at stage "rename_source_file":',
      "  ENOENT: no such file or directory, rename 'auth.md'",
      '',
      'Recovery: source file rename failed. Clear sentinel manually:',
      'engine manifest delete pay.discovery.auth legacy_split_state',
      '',
    ].join('\n'));
  });

  it('apply: refuses a result that is not apply.cjs\'s answer — no ok, a landed split without its theme count or with blank warnings, a failure short of its stage, error or recovery', () => {
    const bad = (name, result) => () => renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: writePayload(dir, name, { source: 'auth', result }) });
    assert.throws(bad('a1.json', undefined), /"result" must be the JSON apply\.cjs answered, its "ok" a boolean/);
    assert.throws(bad('a2.json', { applied: { themes: 1 } }), /"result" must be the JSON apply\.cjs answered, its "ok" a boolean/);
    assert.throws(bad('a3.json', { ok: true }), /"result\.applied\.themes" must be a positive integer/);
    assert.throws(bad('a4.json', { ok: true, applied: { themes: 0 } }), /"result\.applied\.themes" must be a positive integer/);
    assert.throws(bad('a5.json', { ok: true, applied: { themes: 1 }, kb_warnings: ['ok', ' '] }), /"result\.kb_warnings" must be an array of non-empty strings when present/);
    assert.throws(bad('a6.json', { ok: true, applied: { themes: 1 }, kb_warnings: 'one' }), /"result\.kb_warnings" must be an array of non-empty strings when present/);
    for (const field of ['stage', 'error', 'recovery_hint']) {
      const result = { ok: false, stage: 'git_commit', error: 'hook failed', recovery_hint: 'commit by hand' };
      delete result[field];
      assert.throws(bad(`f-${field}.json`, result), new RegExp(`"result\\.${field}" must be a non-empty string — a failed apply names it`));
    }
    assert.throws(() => renderSurface(dir, 'legacy-split-display', { variant: 'apply', file: writePayload(dir, 'ns.json', { result: { ok: true, applied: { themes: 1 } } }) }),
      /"source" must be a non-empty string/);
  });
});

describe('render — the adopted cross-flow static gates', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('legacy-split-gate: three dialog gates keyed by what each asks; the remove confirm says what the removal drops, then asks on its diamond line', () => {
    assert.strictEqual(renderSurface(dir, 'legacy-split-gate', { variant: 'remove', theme: 'caching' }), [
      '=== DISPLAY: legacy split removal (emit verbatim as markdown (not a code block)) ===',
      '> Removing "caching" drops its drafted content — gone unless another theme has already reabsorbed it.',
      '',
      "=== MENU: legacy split remove gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Remove the theme?`**',
      '',
      '**`y/yes`** → Remove the theme and drop its content',
      '**`n/no`**  → Back out',
      '',
    ].join('\n'));

    const themes = renderSurface(dir, 'legacy-split-gate', { variant: 'themes' });
    assert.match(themes, /^=== MENU: legacy split themes gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(themes, /`◆ Proceed with these themes\?`/);
    assert.match(themes, /\*\*`y\/yes`\*\*\s+→ Proceed to draft cache files/);
    assert.match(themes, /\*\*`a\/abandon`\*\* → Skip this source file/);
    assert.match(unwrap(themes), /\*\*Redirect\*\*\s+→ Adjust the theme list \(rename, merge two, split one, add, remove\)/);

    const plan = renderSurface(dir, 'legacy-split-gate', { variant: 'plan' });
    assert.match(plan, /=== MENU: legacy split plan gate/);
    assert.match(plan, /`◆ Apply this plan\?`/);
    assert.match(plan, /\*\*`y\/yes`\*\*\s+→ Apply this plan/);
    assert.match(plan, /\*\*`a\/abandon`\*\* → Skip this source file/);
    assert.match(unwrap(plan), /\*\*Edit\*\*\s+→ Modify cache files or plan\.json \(rename, merge, split, add, remove\)\. To rewrite a draft, edit the cache file directly between renders\./);

    assert.throws(() => renderSurface(dir, 'legacy-split-gate', {}), /--variant must be one of themes, plan, remove, got ""/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'apply' }), /--variant must be one of themes, plan, remove, got "apply"/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'remove' }), /--theme is required with --variant remove — the theme the removal drops/);
    assert.throws(() => renderSurface(dir, 'legacy-split-gate', { variant: 'remove', theme: ' ' }), /--theme is required/);
  });
});
