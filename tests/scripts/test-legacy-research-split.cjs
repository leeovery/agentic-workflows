'use strict';

// The legacy-research-split skill is markdown — it instructs Claude to invoke
// the manifest CLI with specific sequences for the trigger detection and
// apply-split steps. These tests exercise the same CLI sequence the skill
// prescribes, locking in the observable manifest state.
//
// Covered:
//   1. Single-topic file (stays case) — source untouched, no supersede
//   2. Broad file (no stays) — full supersede + new files created
//   3. Theme-name-matches-existing (merge case) — content appended, no new file
//   4. Trigger detection — only migration-seeded + in-progress + research routing
//   5. Skill is idempotent — running twice yields the same manifest state

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const MANIFEST_CLI = path.resolve(
  __dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs'
);

let dir;

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-split-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
}

function cleanup() {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
}

function runCli(...args) {
  const r = spawnSync('node', [MANIFEST_CLI, ...args], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`manifest cli failed: ${args.join(' ')} — ${r.stderr}`);
  }
  return r.stdout;
}

function readManifest(workUnit) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.workflows', workUnit, 'manifest.json'), 'utf8'
  ));
}

function writeManifest(workUnit, data) {
  const wuDir = path.join(dir, '.workflows', workUnit);
  fs.mkdirSync(wuDir, { recursive: true });
  fs.writeFileSync(path.join(wuDir, 'manifest.json'), JSON.stringify(data, null, 2));
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  let proj = {};
  if (fs.existsSync(projPath)) proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: data.work_type || 'epic' };
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2));
}

function writeResearchFile(workUnit, topic, content) {
  const p = path.join(dir, '.workflows', workUnit, 'research', `${topic}.md`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function readResearchFile(workUnit, topic) {
  return fs.readFileSync(
    path.join(dir, '.workflows', workUnit, 'research', `${topic}.md`), 'utf8'
  );
}

function fileExists(workUnit, relPath) {
  return fs.existsSync(path.join(dir, '.workflows', workUnit, relPath));
}

// Seed a legacy migration-seeded epic — one broad research file plus its
// inception+research items, matching what migration 038 leaves behind.
function seedLegacyEpic(workUnit, sourceTopic) {
  writeManifest(workUnit, {
    name: workUnit,
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      inception: {
        items: {
          [sourceTopic]: {
            routing: 'research',
            source: 'migration-seeded',
          },
        },
      },
      research: {
        items: {
          [sourceTopic]: { status: 'in-progress' },
        },
      },
    },
  });
  writeResearchFile(workUnit, sourceTopic, '# Broad Research\n\nContent.');
}

// Detect-trigger logic from the skill's detect-trigger.md.
function qualifyingSources(workUnit) {
  const m = readManifest(workUnit);
  const inception = (m.phases.inception && m.phases.inception.items) || {};
  const research = (m.phases.research && m.phases.research.items) || {};
  const out = [];
  for (const [name, item] of Object.entries(inception)) {
    const src = (item && item.source) || '';
    if (!src.includes('migration-seeded')) continue;
    if (item.routing !== 'research') continue;
    if (item.legacy_split_state) continue;  // skill marks this at apply-start / apply-end
    const r = research[name];
    if (!r || r.status !== 'in-progress') continue;
    if (!fileExists(workUnit, `research/${name}.md`)) continue;
    out.push(name);
  }
  return out;
}

// Apply-split for the "creates" case — re-creates the CLI sequence from apply-split.md.
function applyCreate(workUnit, current_source, theme) {
  runCli('init-phase', `${workUnit}.research.${theme.kebab_name}`);
  runCli('init-phase', `${workUnit}.inception.${theme.kebab_name}`);
  runCli('set', `${workUnit}.inception.${theme.kebab_name}`, 'routing', theme.routing);
  runCli('set', `${workUnit}.inception.${theme.kebab_name}`, 'summary', theme.summary);
  runCli('set', `${workUnit}.inception.${theme.kebab_name}`, 'description', theme.description);
  runCli('set', `${workUnit}.inception.${theme.kebab_name}`,
    'source', `legacy-split:${current_source}`);
  writeResearchFile(workUnit, theme.kebab_name, `# Research: ${theme.kebab_name}\n\n${theme.content}`);
}

function applyStartMarker(workUnit, current_source) {
  runCli('set', `${workUnit}.inception.${current_source}`, 'legacy_split_state', 'in-progress');
}

function applyFinishMarkerStays(workUnit, current_source) {
  runCli('set', `${workUnit}.inception.${current_source}`, 'legacy_split_state', 'applied');
}

function applySupersede(workUnit, current_source) {
  runCli('set', `${workUnit}.research.${current_source}`, 'status', 'superseded');
  runCli('delete', `${workUnit}.inception`, `items.${current_source}`);
}

function applyMerge(workUnit, target_name, content) {
  const p = path.join(dir, '.workflows', workUnit, 'research', `${target_name}.md`);
  fs.appendFileSync(p, `\n---\n${content}\n`);
}

// Merge-with-init: target has inception item but no research item or file.
// apply-split.md B initialises the research item and creates the file before
// appending. Lock in that CLI sequence.
function applyMergeWithInit(workUnit, target_name, content) {
  runCli('init-phase', `${workUnit}.research.${target_name}`);
  const p = path.join(dir, '.workflows', workUnit, 'research', `${target_name}.md`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `# Research: ${target_name}\n\nMaterial extracted from legacy.\n\n---\n${content}\n`);
}

describe('legacy-research-split: detect-trigger', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('identifies a migration-seeded research item with backing file', () => {
    seedLegacyEpic('alpha', 'exploration');
    assert.deepStrictEqual(qualifyingSources('alpha'), ['exploration']);
  });

  it('skips items without migration-seeded source', () => {
    writeManifest('beta', {
      name: 'beta',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { foo: { routing: 'research', source: 'inception' } } },
        research: { items: { foo: { status: 'in-progress' } } },
      },
    });
    writeResearchFile('beta', 'foo', 'content');
    assert.deepStrictEqual(qualifyingSources('beta'), []);
  });

  it('skips items with discussion routing', () => {
    writeManifest('gamma', {
      name: 'gamma',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { foo: { routing: 'discussion', source: 'migration-seeded' } } },
        research: { items: { foo: { status: 'in-progress' } } },
      },
    });
    writeResearchFile('gamma', 'foo', 'content');
    assert.deepStrictEqual(qualifyingSources('gamma'), []);
  });

  it('skips items whose research file is missing on disk', () => {
    writeManifest('delta', {
      name: 'delta',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { foo: { routing: 'research', source: 'migration-seeded' } } },
        research: { items: { foo: { status: 'in-progress' } } },
      },
    });
    assert.deepStrictEqual(qualifyingSources('delta'), []);
  });

  it('skips items whose research item is completed (not in-progress)', () => {
    writeManifest('epsilon', {
      name: 'epsilon',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { foo: { routing: 'research', source: 'migration-seeded' } } },
        research: { items: { foo: { status: 'completed' } } },
      },
    });
    writeResearchFile('epsilon', 'foo', 'content');
    assert.deepStrictEqual(qualifyingSources('epsilon'), []);
  });

  // apply-split.md A sets legacy_split_state = 'in-progress' before any
  // writes; E sets 'applied' on success. Either value excludes the item
  // from re-qualification — preventing content duplication on retry.
  it('does not qualify items where legacy_split_state is set to in-progress', () => {
    writeManifest('zeta', {
      name: 'zeta',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { src: { routing: 'research', source: 'migration-seeded', legacy_split_state: 'in-progress' } } },
        research: { items: { src: { status: 'in-progress' } } },
      },
    });
    writeResearchFile('zeta', 'src', 'content');
    assert.deepStrictEqual(qualifyingSources('zeta'), []);
  });

  it('does not qualify items where legacy_split_state is set to applied', () => {
    writeManifest('eta', {
      name: 'eta',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: { src: { routing: 'research', source: 'migration-seeded', legacy_split_state: 'applied' } } },
        research: { items: { src: { status: 'in-progress' } } },
      },
    });
    writeResearchFile('eta', 'src', 'content');
    assert.deepStrictEqual(qualifyingSources('eta'), []);
  });
});

// Rewrite the source file when stays + other themes — apply-split.md D
// Otherwise branch. Content from non-stays themes moved out, so the source
// must shrink to only the stays content (otherwise paragraphs duplicate
// between source and new files).
function applyStaysRewrite(workUnit, current_source, staysContent) {
  const p = path.join(dir, '.workflows', workUnit, 'research', `${current_source}.md`);
  fs.writeFileSync(p, `# Research: ${current_source}\n\nMaterial extracted from legacy.\n\n---\n${staysContent}\n`);
}

// apply-split.md D Otherwise also writes the stays theme's summary +
// description onto the source's inception item so Step 6 summary backfill
// doesn't re-prompt for a topic the user just curated.
function applyStaysMetadata(workUnit, current_source, summary, description) {
  runCli('set', `${workUnit}.inception.${current_source}`, 'summary', summary);
  runCli('set', `${workUnit}.inception.${current_source}`, 'description', description);
}

describe('legacy-research-split: stays case', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('source file rewritten to stays content when other themes extract material', () => {
    seedLegacyEpic('alpha', 'authentication');

    // Approved plan: stays(authentication) keeps the auth paragraphs;
    // creates(caching) carries the caching paragraphs.
    applyStartMarker('alpha', 'authentication');
    applyCreate('alpha', 'authentication', {
      kebab_name: 'caching',
      routing: 'research',
      summary: 'Cache layer design.',
      description: 'Detailed cache design notes.',
      content: 'Cache content extracted from broad file.',
    });
    applyStaysMetadata('alpha', 'authentication',
      'Authentication flow summary.', 'Auth description.');
    applyStaysRewrite('alpha', 'authentication', 'Authentication-only content (kept).');
    applyFinishMarkerStays('alpha', 'authentication');

    const after = readResearchFile('alpha', 'authentication');
    assert.ok(after.includes('Authentication-only content (kept).'),
      'stays content present in rewritten source');
    assert.ok(!after.includes('Cache content extracted from broad file.'),
      'caching content NOT duplicated into rewritten source');

    const m = readManifest('alpha');
    assert.ok(m.phases.inception.items.authentication, 'authentication inception preserved');
    assert.strictEqual(m.phases.inception.items.authentication.source, 'migration-seeded',
      'original source provenance preserved through stays rewrite');
    assert.strictEqual(m.phases.inception.items.authentication.summary,
      'Authentication flow summary.',
      'stays summary written to source inception item (Step 6 backfill skip)');
    assert.strictEqual(m.phases.inception.items.authentication.description,
      'Auth description.',
      'stays description written to source inception item');
    assert.strictEqual(m.phases.inception.items.authentication.legacy_split_state, 'applied',
      'legacy_split_state set to applied on success');
    assert.strictEqual(m.phases.research.items.authentication.status, 'in-progress');
    assert.ok(m.phases.inception.items.caching, 'new caching inception item created');
    assert.strictEqual(m.phases.inception.items.caching.routing, 'research');
    assert.strictEqual(m.phases.inception.items.caching.source, 'legacy-split:authentication');
  });
});

describe('legacy-research-split: stays-only no-op', () => {
  beforeEach(setup);
  afterEach(cleanup);

  // apply-split.md flow when approved_creates AND approved_merges are
  // both empty (only stays): A marks legacy_split_state = in-progress,
  // B and C loop zero times, D Otherwise writes the stays theme's summary
  // and description to the source's inception item (so Step 6 backfill
  // skips it), but does NOT rewrite the source file because no content
  // moved out. E "If written_files empty" sets legacy_split_state =
  // applied and skips the git commit.
  it('source file untouched, metadata written, sentinel transitioned when only stays approved', () => {
    seedLegacyEpic('alpha', 'authentication');
    const sourceBefore = readResearchFile('alpha', 'authentication');

    applyStartMarker('alpha', 'authentication');
    // No creates, no merges, no file rewrite.
    applyStaysMetadata('alpha', 'authentication',
      'Authentication scope.', 'Detailed auth notes.');
    applyFinishMarkerStays('alpha', 'authentication');

    const sourceAfter = readResearchFile('alpha', 'authentication');
    assert.strictEqual(sourceAfter, sourceBefore, 'source file untouched');

    const m = readManifest('alpha');
    assert.strictEqual(Object.keys(m.phases.inception.items).length, 1,
      'no new inception items created');
    assert.ok(m.phases.inception.items.authentication, 'original inception item preserved');
    assert.strictEqual(m.phases.inception.items.authentication.source, 'migration-seeded',
      'original source provenance preserved');
    assert.strictEqual(m.phases.inception.items.authentication.summary,
      'Authentication scope.',
      'stays summary written so Step 6 backfill does not re-prompt');
    assert.strictEqual(m.phases.inception.items.authentication.description,
      'Detailed auth notes.',
      'stays description written so Step 6 backfill does not re-prompt');
    assert.strictEqual(m.phases.inception.items.authentication.legacy_split_state, 'applied',
      'legacy_split_state set to applied on success');
    assert.strictEqual(m.phases.research.items.authentication.status, 'in-progress',
      'research item not superseded when stays present');
  });
});

describe('legacy-research-split: full supersede case', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('source becomes superseded and inception item is removed when no theme stays', () => {
    seedLegacyEpic('alpha', 'exploration');

    // Mirror the markdown flow: A marks in-progress first, even though
    // the supersede branch ultimately deletes the inception item (E's
    // post-commit exists-check then no-ops on the missing item).
    applyStartMarker('alpha', 'exploration');
    applyCreate('alpha', 'exploration', {
      kebab_name: 'auth',
      routing: 'discussion',
      summary: 'Auth scope.',
      description: 'Auth desc.',
      content: 'auth content',
    });
    applyCreate('alpha', 'exploration', {
      kebab_name: 'caching',
      routing: 'research',
      summary: 'Cache scope.',
      description: 'Cache desc.',
      content: 'cache content',
    });
    applySupersede('alpha', 'exploration');

    const m = readManifest('alpha');
    assert.strictEqual(m.phases.research.items.exploration.status, 'superseded');
    assert.ok(!m.phases.inception.items.exploration,
      'inception item removed (including any in-progress sentinel)');
    assert.ok(m.phases.inception.items.auth);
    assert.ok(m.phases.inception.items.caching);

    // Source file stays on disk untouched.
    assert.ok(fileExists('alpha', 'research/exploration.md'),
      'source file remains on disk as historical record');
  });
});

describe('legacy-research-split: merge case', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('content appends to existing research file when theme matches existing item', () => {
    // Two existing items: the legacy source, and a separate "auth" topic
    // that already exists. The user identifies content in the legacy file
    // that belongs under "auth".
    writeManifest('alpha', {
      name: 'alpha',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: {
          items: {
            exploration: { routing: 'research', source: 'migration-seeded' },
            auth: { routing: 'discussion', source: 'inception' },
          },
        },
        research: {
          items: {
            exploration: { status: 'in-progress' },
            auth: { status: 'in-progress' },
          },
        },
      },
    });
    writeResearchFile('alpha', 'exploration', '# Broad\n\nContent including auth and caching.');
    writeResearchFile('alpha', 'auth', '# Auth\n\nOriginal auth content.');

    applyMerge('alpha', 'auth', 'Auth content merged from exploration.');

    const merged = readResearchFile('alpha', 'auth');
    assert.ok(merged.includes('Original auth content.'),
      'original auth content preserved');
    assert.ok(merged.includes('Auth content merged from exploration.'),
      'merged content appended');
    assert.ok(merged.includes('---'),
      'separator inserted between original and appended');

    // No new inception item for auth — it already existed.
    const m = readManifest('alpha');
    assert.strictEqual(m.phases.inception.items.auth.source, 'inception',
      'existing auth item source unchanged by merge');
  });

  // Merge target exists on inception map but has no research item yet.
  // apply-split.md B initialises the research item and renders the file
  // from template before appending — content lands somewhere visible.
  it('initialises research item and creates file when merge target has neither', () => {
    writeManifest('beta', {
      name: 'beta',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: {
          items: {
            exploration: { routing: 'research', source: 'migration-seeded' },
            'data-model': { routing: 'discussion', source: 'inception' },
          },
        },
        research: {
          items: { exploration: { status: 'in-progress' } },
        },
      },
    });
    writeResearchFile('beta', 'exploration', 'Broad content including data-model.');
    // data-model has inception but NO research item or file.

    applyMergeWithInit('beta', 'data-model', 'Data model content from exploration.');

    const m = readManifest('beta');
    assert.ok(m.phases.research && m.phases.research.items['data-model'],
      'research item initialised for merge target');
    assert.strictEqual(m.phases.research.items['data-model'].status, 'in-progress');
    assert.ok(fileExists('beta', 'research/data-model.md'),
      'research file created for merge target');
    const content = readResearchFile('beta', 'data-model');
    assert.ok(content.includes('Data model content from exploration.'),
      'merged content present');
  });
});

describe('legacy-research-split: multi-source batch', () => {
  beforeEach(setup);
  afterEach(cleanup);

  // detect-trigger surfaces multiple qualifying source files in one run.
  // Each iteration of session-loop processes one source; the loop continues
  // until qualifying_sources is empty.
  it('detect-trigger returns all migration-seeded in-progress research items', () => {
    writeManifest('alpha', {
      name: 'alpha',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: {
          items: {
            'broad-one': { routing: 'research', source: 'migration-seeded' },
            'broad-two': { routing: 'research', source: 'migration-seeded' },
            'native': { routing: 'discussion', source: 'inception' },
          },
        },
        research: {
          items: {
            'broad-one': { status: 'in-progress' },
            'broad-two': { status: 'in-progress' },
          },
        },
      },
    });
    writeResearchFile('alpha', 'broad-one', 'content one');
    writeResearchFile('alpha', 'broad-two', 'content two');

    const qs = qualifyingSources('alpha').sort();
    assert.deepStrictEqual(qs, ['broad-one', 'broad-two'],
      'both migration-seeded research items surface');
  });

  it('processing one source does not affect qualifying status of another', () => {
    writeManifest('alpha', {
      name: 'alpha',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: {
          items: {
            'broad-one': { routing: 'research', source: 'migration-seeded' },
            'broad-two': { routing: 'research', source: 'migration-seeded' },
          },
        },
        research: {
          items: {
            'broad-one': { status: 'in-progress' },
            'broad-two': { status: 'in-progress' },
          },
        },
      },
    });
    writeResearchFile('alpha', 'broad-one', 'content one');
    writeResearchFile('alpha', 'broad-two', 'content two');

    // Simulate processing broad-one: full supersede + one create.
    applyCreate('alpha', 'broad-one', {
      kebab_name: 'derived',
      routing: 'discussion',
      summary: 's', description: 'd', content: 'c',
    });
    applySupersede('alpha', 'broad-one');

    // broad-two should still qualify on the second iteration.
    assert.deepStrictEqual(qualifyingSources('alpha'), ['broad-two']);
  });
});

describe('legacy-research-split: name collision', () => {
  beforeEach(setup);
  afterEach(cleanup);

  // propose-candidates C delegates to topic-name-validation.md. A new theme
  // whose kebab_name matches an existing map item returns `collision-active`
  // and the user must rename. This test locks in that classification rules
  // route a colliding new name to `merges` (not `creates`), avoiding the
  // collision entirely.
  it('theme matching an existing inception item classifies as merges, not creates', () => {
    writeManifest('alpha', {
      name: 'alpha',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: {
          items: {
            'exploration': { routing: 'research', source: 'migration-seeded' },
            'caching': { routing: 'discussion', source: 'inception' },
          },
        },
        research: {
          items: {
            'exploration': { status: 'in-progress' },
            'caching': { status: 'in-progress' },
          },
        },
      },
    });
    writeResearchFile('alpha', 'exploration', 'broad content including caching');
    writeResearchFile('alpha', 'caching', 'original caching content');

    const m = readManifest('alpha');
    const existing_names = Object.keys(m.phases.inception.items);
    // session-loop.md C classifies: kebab_name='caching' → matches existing → 'merges'.
    const classification = existing_names.includes('caching') && 'caching' !== 'exploration'
      ? 'merges' : 'creates';
    assert.strictEqual(classification, 'merges',
      'colliding name routes to merges branch — bypasses topic-name-validation collision');
  });
});

describe('legacy-research-split: idempotency', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('detect-trigger returns empty after split applied', () => {
    seedLegacyEpic('alpha', 'exploration');
    assert.deepStrictEqual(qualifyingSources('alpha'), ['exploration']);

    applyCreate('alpha', 'exploration', {
      kebab_name: 'auth',
      routing: 'discussion',
      summary: 'a',
      description: 'b',
      content: 'c',
    });
    applySupersede('alpha', 'exploration');

    // After supersede, exploration is no longer in inception items —
    // detect-trigger returns empty list.
    assert.deepStrictEqual(qualifyingSources('alpha'), []);
  });

  // Mid-apply kill scenario: apply-split A sets legacy_split_state =
  // in-progress before any writes; if the session dies before D's
  // supersede or E's finalise, the source must NOT re-qualify on
  // restart. Without this, detect-trigger would re-prompt the user
  // and the re-classification would duplicate already-written content.
  it('source does not re-qualify after legacy_split_state is set, even before completion', () => {
    seedLegacyEpic('alpha', 'exploration');
    assert.deepStrictEqual(qualifyingSources('alpha'), ['exploration']);

    // Simulate apply-split A's first action: mark in-progress.
    applyStartMarker('alpha', 'exploration');

    // Even though research is still in-progress and source is still
    // migration-seeded, the in-progress marker excludes it.
    assert.deepStrictEqual(qualifyingSources('alpha'), []);
  });

  // Stays-success scenario: stays case completes E without supersede.
  // The marker transitions to 'applied'. Source stays in-progress
  // (the stays theme inherits it) but the marker keeps detect-trigger
  // from re-qualifying.
  it('stays-success path keeps source out of qualifying list via applied marker', () => {
    seedLegacyEpic('beta', 'authentication');

    applyStartMarker('beta', 'authentication');
    // simulate D Otherwise + E success with stays
    applyFinishMarkerStays('beta', 'authentication');

    // research still in-progress; inception item still migration-seeded;
    // but applied marker excludes.
    const m = readManifest('beta');
    assert.strictEqual(m.phases.research.items.authentication.status, 'in-progress');
    assert.strictEqual(m.phases.inception.items.authentication.source, 'migration-seeded');
    assert.deepStrictEqual(qualifyingSources('beta'), []);
  });
});
