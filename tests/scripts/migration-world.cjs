'use strict';

// The migration's harness (tests/README.md §9), what the suites of its
// directives and its commit share: the engine copied, once per process,
// beside the real runner and the fixture migrations in
// tests/fixtures/directives/ — the directives, and a code migration after
// the reshape — so it finds them as it finds the migrations installed
// (`directiveEngine`); and a project the migration is under way in, made
// once per process and copied (`midMigration`) — its `.workflows/`
// committed on its code branch as today's layout leaves it, beside the
// settings boot syncs while the migration runs, and its state worktree at
// `.leeway/`, locked, on a `leeway-state` with no commit yet, holding what
// the move writes: the state's `.gitignore`, the project's manifest and
// id, the unit's manifest with its three topics, and the migrations
// record, which holds the fixture migrations the boot suites never reach
// there. The records directive's world (`recordsMigration`),
// made once and copied: four units as today's layout left them and as the
// move wrote them, with the old agent store the move leaves. The legacy
// split's (`splitProject`, `splitMigration`), each made once and copied:
// an epic shaped as codeintel's was before its split, on today's layout
// with no state, and as the reshape's guard leaves it; with the plans its
// interview stages. The project waiting on the migration's commit
// (`finishedMigration`), made once and copied: the project the migration
// is under way in with every fixture migration recorded, the tracker's
// store on its code branch where a project from before Leeway kept it and
// a file its tool keeps local beside it, the state's ignore line in its
// `.gitignore`, unstaged, as the move writes it, a decision held in the
// ledger, and the reshape's finish (081) run over it — its drops
// journaled; and one nested in its repository, made for each call
// (`nestedFinished`). And the cut and the merges' world (`cutMigration`),
// made once and copied: three units in today's layout moved by the real
// move (078), each topic's record carried as the records directive
// carries it.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, initRepo, createFile, statePath, layout, treeSnapshot, hooked, WORKFLOW_HOOKS } = harness;
const { templateFolder, copyWorld, filesUnder, STATE_DIR_NAME } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_GITIGNORE, STATE_LOCK_REASON, BRANCH_REF } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const FIXTURES = path.join(__dirname, '../fixtures/directives');
const RUNNER = path.join(SCRIPTS, '../../leeway-migrate/scripts/migrate.cjs');
const GUARD = require(path.join(SCRIPTS, '../../leeway-migrate/scripts/migrations/074-reshape-guard.cjs'));
const FINISH = require(path.join(path.dirname(RUNNER), 'migrations/081-reshape-finish.cjs'));
const { preLeewayStores } = require(path.join(path.dirname(RUNNER), 'migrations/reshape/shared.cjs'));

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });

// The unit's discussion as today's layout keeps it, each topic's map of
// subtopics among it: the topics' decided subtopics are what the fixture
// records directive's check holds the ledger to.
const OLD_UNIT = {
  name: UNIT,
  work_type: 'epic',
  status: 'in-progress',
  phases: {
    discussion: {
      items: {
        licensing: { status: 'completed', subtopics: { 'trial-length': { status: 'decided', parent: null }, 'seat-count': { status: 'decided', parent: null } } },
        search: { status: 'completed', subtopics: { ranking: { status: 'decided', parent: null }, 'typo-tolerance': { status: 'deferred', parent: null } } },
        onboarding: { status: 'in-progress', subtopics: { permissions: { status: 'decided', parent: null }, 'first-run': { status: 'exploring', parent: null } } },
      },
    },
  },
};

// Each topic's decided subtopics, as the fixture check names them.
const DECIDED = Object.freeze({ licensing: ['trial-length', 'seat-count'], search: ['ranking'], onboarding: ['permissions'] });

// The unit as the move writes it.
const MOVED_UNIT = {
  name: UNIT,
  work_type: 'epic',
  status: 'in-progress',
  phases: { discussion: { items: { licensing: { status: 'in-progress' }, search: { status: 'in-progress' }, onboarding: { status: 'in-progress' } } } },
};

// The fixture migrations the project the migration is under way in has
// recorded: the directives whose checks are broken, so no run stops at
// them, and the code migration after the reshape, which never runs in it.
const RECORDED = ['090', '091', '092', '093', '094'];
const MOVE = require(path.join(path.dirname(RUNNER), 'migrations/078-reshape-move.cjs'));
const { composedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

/** @type {(ReturnType<typeof harness.harness> & {path: string, migrations: string})|null} */
let engine = null;

/**
 * The engine copied into a skills folder beside the real runner and the
 * fixture directives as its migrations: its path, its migrations folder,
 * and the shapes bound to it. Made once per process and never written to.
 */
function directiveEngine() {
  if (engine !== null) return engine;
  const skills = templateFolder('directive-engine-');
  fs.cpSync(path.dirname(SCRIPTS), path.join(skills, 'leeway-engine'), { recursive: true });
  const migrations = path.join(skills, 'leeway-migrate/scripts/migrations');
  fs.cpSync(FIXTURES, migrations, { recursive: true });
  for (const script of ['migrate.cjs', 'migration-ids.cjs', 'old-layout.cjs']) fs.copyFileSync(path.join(path.dirname(RUNNER), script), path.join(skills, 'leeway-migrate/scripts', script));
  const at = path.join(skills, 'leeway-engine/scripts/engine.cjs');
  engine = { ...harness.harness(at), path: at, migrations };
  return engine;
}

/**
 * A repository at `dir` whose code branch holds `old`, its files by path,
 * committed as today's layout leaves them, and in the project's folder,
 * `project` from `dir`, the settings boot syncs while the migration runs —
 * committed, so no boot of the world changes them — and whose state
 * worktree at `.leeway/`, locked, is on a `leeway-state` with no commit
 * yet, holding the state's `.gitignore`, the project's manifest and id, and
 * `moved`, its files by path, as the move writes them.
 * @param {string} dir @param {Record<string, string>} old @param {Record<string, string>} moved @param {string} [project]
 */
function buildUnborn(dir, old, moved, project = '') {
  initRepo(dir);
  for (const [rel, text] of Object.entries(old)) createFile(dir, rel, text);
  createFile(dir, path.join(project, '.claude/settings.json'), hooked(WORKFLOW_HOOKS));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), `/${STATE_DIR_NAME}/\n`);
  const root = path.join(dir, STATE_DIR_NAME);
  git(dir, ['worktree', 'add', '-q', '--detach', '--no-checkout', root]);
  git(root, ['symbolic-ref', 'HEAD', BRANCH_REF]);
  git(dir, ['worktree', 'lock', '--reason', STATE_LOCK_REASON, root]);
  createFile(root, layout.gitignore, STATE_GITIGNORE);
  createFile(root, layout.projectManifest, jsonText({ project_id: newId() }));
  for (const [rel, text] of Object.entries(moved)) createFile(root, rel, text);
}

/** @param {string} dir */
function buildMidMigration(dir) {
  buildUnborn(dir, { 'README.md': '# Fumi\n', [`.workflows/${UNIT}/manifest.json`]: jsonText(OLD_UNIT) }, {
    [layout.manifest(UNIT)]: jsonText(MOVED_UNIT),
    [layout.migrations]: RECORDED.map((id) => `${id}\n`).join(''),
  });
}

/** @type {string|null} */
let template = null;

/**
 * A project the migration is under way in, at `dir`.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved
 */
function midMigration(dir) {
  if (template === null) {
    template = templateFolder('mid-migration-template-');
    buildMidMigration(template);
  }
  return copyWorld(template, dir);
}

// The records directive's world (079): four units on the code branch as
// today's layout left them, and in the state as the move wrote them — an
// epic nothing of which is built: two topics never started, one of them
// with an import come in from its research, which holds nothing, two in
// discussion, one of them with its research's threads, and one promoted to
// a cross-cutting unit, its research's threads left behind; an import come
// in from a discussion, and another whose file is gone; a spec grouped under
// another name and kept as an asset, and a review never folded in that the
// move folded into its log; the cross-cutting unit the promoted topic went
// to, its import copied with it, one of its decisions settling two
// subtopics, its review left behind in the epic's store folded into its log
// too; an epic of one topic whose building started, its two specs joined
// into its spec.md by the move, one heading in both, an import come in from
// its discovery as a whole; and a cancelled feature, an import come in from its discovery.
const SHOP_SPECS = {
  weights: { status: 'completed', sources: { weights: { status: 'incorporated' } } },
  wishlist: { status: 'completed', sources: { weights: { status: 'incorporated' } } },
};

const RECORDS_OLD = Object.freeze({
  'README.md': '# Fumi\n',
  '.workflows/fumi/manifest.json': jsonText({
    name: 'fumi', work_type: 'epic', status: 'in-progress',
    imports: [
      { path: 'imports/pricing.md', imported_at: '2026-01-02T10:00:00Z', origin: 'discussion/licensing' },
      { path: 'imports/sso.md', imported_at: '2026-01-03T10:00:00Z', origin: 'discussion/auth' },
      { path: 'imports/rates.md', imported_at: '2026-01-04T10:00:00Z', origin: 'research/billing' },
      { path: 'imports/old.md', imported_at: '2026-01-05T10:00:00Z', origin: 'discussion/licensing' },
    ],
    phases: {
      discovery: { items: { billing: { status: 'pending' }, support: { status: 'pending' } } },
      research: {
        items: {
          billing: { status: 'in-progress' },
          auth: { status: 'completed', threads: { 'token-expiry': { question: 'When do tokens expire?', status: 'open', origin: 'seed', parent: null } } },
          search: {
            status: 'completed',
            threads: {
              'index-size': { question: 'How big does the index grow?', status: 'digging', origin: 'seed', parent: null },
              stemming: { question: 'Does stemming help?', status: 'learned', origin: 'seed', parent: null },
            },
          },
        },
      },
      discussion: {
        items: {
          licensing: { status: 'completed', subtopics: { 'trial-length': { status: 'decided', parent: null } } },
          search: {
            status: 'in-progress',
            subtopics: { ranking: { status: 'decided', parent: null }, 'typo-tolerance': { status: 'exploring', parent: null }, synonyms: { status: 'deferred', parent: null } },
          },
          auth: { status: 'promoted', promoted_to: 'platform', subtopics: { sessions: { status: 'decided', parent: null } } },
        },
      },
      specification: { items: { commerce: { status: 'in-progress', sources: { licensing: { status: 'incorporated' } } } } },
    },
  }),
  '.workflows/platform/manifest.json': jsonText({
    name: 'platform', work_type: 'cross-cutting', status: 'in-progress',
    imports: [{ path: 'imports/sso.md', imported_at: '2026-01-03T10:00:00Z', origin: 'discussion/auth' }],
    phases: { discussion: { items: { auth: { status: 'completed', subtopics: { sessions: { status: 'decided', parent: null }, tokens: { status: 'decided', parent: null } } } } } },
  }),
  '.workflows/shop/manifest.json': jsonText({
    name: 'shop', work_type: 'epic', status: 'in-progress',
    imports: [{ path: 'imports/vision.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: {
      discussion: { items: { weights: { status: 'completed', subtopics: { 'tie-break': { status: 'decided', parent: null } } } } },
      specification: { items: SHOP_SPECS },
      implementation: { items: { weights: { status: 'in-progress' } } },
    },
  }),
  '.workflows/shop/specification/weights/specification.md':
    '# Specification: Weights\n\n## Ranking\n\nNewest first.\n\n### Detail\n\nBy day.\n\n## Corrigenda\n\nTies break by price, not by name.\n\n### Detail\n\nPrice before name.\n',
  '.workflows/shop/specification/wishlist/specification.md': '# Specification: Wishlist\n\n## Saving\n\nOne tap.\n\n## Ranking\n\nNewest saved first.\n',
  '.workflows/gone/manifest.json': jsonText({
    name: 'gone', work_type: 'feature', status: 'cancelled',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: { discussion: { items: { gone: { status: 'in-progress', subtopics: { cause: { status: 'decided', parent: null } } } } } },
  }),
});

const RECORDS_MOVED = Object.freeze({
  [layout.manifest('fumi')]: jsonText({
    name: 'fumi', work_type: 'epic', status: 'in-progress',
    imports: [
      { path: 'assets/pricing.md', imported_at: '2026-01-02T10:00:00Z', origin: 'discussion/licensing' },
      { path: 'assets/sso.md', imported_at: '2026-01-03T10:00:00Z', origin: 'discussion/auth' },
      { path: 'assets/rates.md', imported_at: '2026-01-04T10:00:00Z', origin: 'research/billing' },
      { path: 'assets/old.md', imported_at: '2026-01-05T10:00:00Z', origin: 'discussion/licensing' },
    ],
    phases: {
      discovery: { items: { billing: { status: 'pending' }, support: { status: 'pending' } } },
      discussion: { items: { licensing: { status: 'completed' }, search: { status: 'in-progress' }, auth: { status: 'promoted', promoted_to: 'platform' } } },
      specification: { items: { commerce: { status: 'in-progress', sources: { licensing: { status: 'incorporated' } } } } },
    },
  }),
  [layout.topic('fumi', 'licensing', 'log.md')]: '## Discussion\n\n## Discussion: Licensing\n\n### Trial Length\n\n#### Decision\n\nFourteen days, the person said.\n',
  [layout.topic('fumi', 'licensing', 'brief.md')]: '# Licensing\n\nHow the trial works.\n',
  [layout.topic('fumi', 'licensing', 'experiments', 'E2-trial', 'report.md')]: '# Report\n\n## Result\n\nA week converts as well, from `npm run trial`.\n',
  [layout.topic('fumi', 'search', 'log.md')]: [
    '## Research\n\n## Research: Search\n\n### Index Size\n\nStill digging.\n',
    '## Discussion\n\n## Discussion: Search\n\n### Ranking\n\n#### Context\n\nOld results flood the page.\n\nBy recency.\n',
    '### Typo Tolerance\n\n#### Context\n\nPeople misspell names.\n\nStill open.\n\n### Synonyms\n\nSet aside for now.\n',
    '## Review review-001, never folded in\n\n#### F1: Ranking ties\n\nTwo results of one age have no order.\n',
  ].join('\n'),
  [layout.topic('fumi', 'search', 'experiments', 'E1-latency', 'report.md')]: '# Report\n\n## Result\n\n12ms at p95, from `npm run bench`.\n',
  [layout.assets('fumi', 'pricing.md')]: '# Pricing\n',
  [layout.assets('fumi', 'sso.md')]: '# SSO\n',
  [layout.assets('fumi', 'rates.md')]: '# Rates\n\nPer seat.\n',
  [layout.assets('fumi', 'specs', 'commerce.md')]: '# Specification: Commerce\n\n## Corrigenda\n\nThe trial is fourteen days, not thirty.\n',
  [layout.manifest('platform')]: jsonText({
    name: 'platform', work_type: 'cross-cutting', status: 'in-progress',
    imports: [{ path: 'assets/sso.md', imported_at: '2026-01-03T10:00:00Z', origin: 'discussion/auth' }],
    phases: { discussion: { items: { auth: { status: 'completed' } } } },
  }),
  [layout.topic('platform', 'auth', 'log.md')]: '## Discussion\n\n## Discussion: Auth\n\n### Sessions\n\nThirty days, then sign in again, with tokens renewed on each.\n\n## Review review-003, never folded in\n\n#### F1: Token reuse\n\nA token outlives its session.\n',
  [layout.assets('platform', 'sso.md')]: '# SSO\n',
  [layout.manifest('shop')]: jsonText({
    name: 'shop', work_type: 'epic', status: 'in-progress',
    imports: [{ path: 'assets/vision.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: {
      discussion: { items: { weights: { status: 'completed' } } },
      specification: { items: SHOP_SPECS },
      implementation: { items: { weights: { status: 'in-progress' } } },
    },
    spec: { joined: true },
  }),
  [layout.unit('shop', 'spec.md')]: [
    '# Shop', '', '## 1. Weights', '', '#### Ranking', '', 'Newest first.', '', '##### Detail', '', 'By day.', '',
    '#### Corrigenda', '', 'Ties break by price, not by name.', '', '##### Detail', '', 'Price before name.', '',
    '## 2. Wishlist', '', '#### Saving', '', 'One tap.', '', '#### Ranking', '', 'Newest saved first.', '',
  ].join('\n'),
  [layout.topic('shop', 'weights', 'log.md')]: '## Discussion\n\n## Discussion: Weights\n\n### Tie Break\n\nBy name.\n',
  [layout.assets('shop', 'vision.md')]: '# Vision\n',
  [layout.manifest('gone')]: jsonText({
    name: 'gone', work_type: 'feature', status: 'cancelled',
    imports: [{ path: 'assets/notes.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: { discussion: { items: { gone: { status: 'in-progress' } } } },
  }),
  [layout.topic('gone', 'gone', 'log.md')]: '## Discussion\n\n## Discussion: Gone\n\n### Cause\n\nA race.\n',
  [layout.assets('gone', 'notes.md')]: '# Notes\n\nIt fails under load.\n',
});

/** @param {string} dir */
function buildRecords(dir) {
  buildUnborn(dir, RECORDS_OLD, RECORDS_MOVED);
}

/** @type {string|null} */
let recordsTemplate = null;

/**
 * The records directive's world at `dir`, the migration under way in it.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved
 */
function recordsMigration(dir) {
  if (recordsTemplate === null) {
    recordsTemplate = templateFolder('records-migration-template-');
    buildRecords(recordsTemplate);
  }
  return copyWorld(recordsTemplate, dir);
}

// The legacy split's world (075–077): an epic shaped as codeintel's was
// before its split — six sources 038 seeded onto its map, still in
// progress, one naming the seeding among other sources, and beside them an
// item short of qualifying by each of the detection's rules in turn — with
// an epic not in progress and a feature that hold a source's shape, all on
// today's layout. And the plans the interview stages for the six: the
// exploration split into two themes, one of them a name the map dismissed;
// four kept on as one theme of their own name; and session capture kept
// whole.
const SPLIT_EPIC = 'codeintel';
const SPLIT_SOURCES = Object.freeze(['competitive-landscape', 'cost-economics', 'exploration', 'knowledge-model', 'multi-repo-architecture', 'session-capture']);
const SEEDED = Object.freeze({ routing: 'research', source: 'migration-seeded' });
const IN_PROGRESS = Object.freeze({ status: 'in-progress' });

/** @param {string} title @param {string[]} sections */
const researchDoc = (title, sections) => `# Research: ${title}\n\n${sections.map((section) => `## ${section}\n\n${section} notes.\n`).join('\n')}`;

const SPLIT_OLD = Object.freeze({
  'README.md': '# Codeintel\n',
  '.workflows/manifest.json': jsonText({ work_units: { codeintel: { work_type: 'epic' }, atlas: { work_type: 'epic' }, billing: { work_type: 'feature' } } }),
  '.workflows/codeintel/manifest.json': jsonText({
    name: SPLIT_EPIC, work_type: 'epic', status: 'in-progress', created: '2026-04-01',
    phases: {
      discovery: {
        items: {
          exploration: SEEDED,
          'competitive-landscape': SEEDED,
          'cost-economics': SEEDED,
          'knowledge-model': SEEDED,
          'multi-repo-architecture': SEEDED,
          'session-capture': { routing: 'research', source: 'discovery,migration-seeded' },
          pricing: { routing: 'research', source: 'discovery', summary: 'Pricing tiers' },
          glossary: { routing: 'discussion', source: 'migration-seeded' },
          'prior-art': SEEDED,
          roadmap: SEEDED,
          telemetry: SEEDED,
          'api.v2': SEEDED,
          onboarding: { ...SEEDED, legacy_split_state: 'in-progress' },
        },
        dismissed: ['tech-stack'],
      },
      research: {
        items: {
          exploration: IN_PROGRESS,
          'competitive-landscape': IN_PROGRESS,
          'cost-economics': IN_PROGRESS,
          'knowledge-model': { status: 'in-progress', threads: { 'graph-size': { question: 'How big does the graph grow?', status: 'open', origin: 'seed', parent: null } } },
          'multi-repo-architecture': IN_PROGRESS,
          'session-capture': IN_PROGRESS,
          pricing: IN_PROGRESS,
          glossary: IN_PROGRESS,
          'prior-art': { status: 'completed' },
          telemetry: IN_PROGRESS,
          'api.v2': IN_PROGRESS,
          onboarding: IN_PROGRESS,
        },
      },
      discussion: { items: { glossary: IN_PROGRESS } },
    },
  }),
  '.workflows/codeintel/discovery/sessions/session-001.md': '# Initial Framing — Pre-Inception Migration\n',
  '.workflows/codeintel/research/exploration.md': researchDoc('Exploration', ['Product Vision', 'Tech Stack']),
  '.workflows/codeintel/research/competitive-landscape.md': researchDoc('Competitive Landscape', ['Rivals']),
  '.workflows/codeintel/research/cost-economics.md': researchDoc('Cost Economics', ['Tokens']),
  '.workflows/codeintel/research/knowledge-model.md': researchDoc('Knowledge Model', ['Graph']),
  '.workflows/codeintel/research/multi-repo-architecture.md': researchDoc('Multi Repo Architecture', ['Workspaces']),
  '.workflows/codeintel/research/session-capture.md': researchDoc('Session Capture', ['Transcripts']),
  '.workflows/codeintel/research/pricing.md': researchDoc('Pricing', ['Tiers']),
  '.workflows/codeintel/research/glossary.md': researchDoc('Glossary', ['Terms']),
  '.workflows/codeintel/research/prior-art.md': researchDoc('Prior Art', ['Tools']),
  '.workflows/codeintel/research/roadmap.md': researchDoc('Roadmap', ['Milestones']),
  '.workflows/codeintel/research/api.v2.md': researchDoc('Api V2', ['Endpoints']),
  '.workflows/codeintel/research/onboarding.md': researchDoc('Onboarding', ['First Run']),
  '.workflows/codeintel/discussion/glossary.md': '# Discussion: Glossary\n',
  '.workflows/atlas/manifest.json': jsonText({
    name: 'atlas', work_type: 'epic', status: 'completed', created: '2026-01-01',
    phases: { discovery: { items: { notes: SEEDED } }, research: { items: { notes: IN_PROGRESS } } },
  }),
  '.workflows/atlas/research/notes.md': researchDoc('Notes', ['Findings']),
  '.workflows/billing/manifest.json': jsonText({
    name: 'billing', work_type: 'feature', status: 'in-progress', created: '2026-02-01',
    phases: { discovery: { items: { billing: SEEDED } }, research: { items: { billing: IN_PROGRESS } } },
  }),
  '.workflows/billing/research/billing.md': researchDoc('Billing', ['Invoices']),
});

/** A theme of a plan, its summary and description its name's. @param {string} name */
const themeOf = (name) => ({ kebab_name: name, summary: `${name} in a line.`, description: `What ${name} covers.` });

/** A source's plan staged, its themes' research beside it, by path from the state. @param {string} source @param {Record<string, string>} themes @param {string} [epic] */
function stagedPlan(source, themes, epic = SPLIT_EPIC) {
  const at = `.cache/migrate/split/${epic}/${source}`;
  return {
    [`${at}/plan.json`]: jsonText({ themes: Object.keys(themes).map(themeOf) }),
    ...Object.fromEntries(Object.entries(themes).map(([name, research]) => [`${at}/${name}.md`, research])),
  };
}

const SPLIT_PLANS = Object.freeze({
  ...stagedPlan('exploration', { 'product-vision': '## Product Vision\n\nProduct Vision notes.\n', 'tech-stack': '## Tech Stack\n\nTech Stack notes.\n' }),
  ...stagedPlan('competitive-landscape', { 'competitive-landscape': '## Rivals\n\nRivals notes.\n' }),
  ...stagedPlan('cost-economics', { 'cost-economics': '## Tokens\n\nTokens notes.\n' }),
  ...stagedPlan('knowledge-model', { 'knowledge-model': '## Graph\n\nGraph notes.\n' }),
  ...stagedPlan('multi-repo-architecture', { 'multi-repo-architecture': '## Workspaces\n\nWorkspaces notes.\n' }),
  [`.cache/migrate/split/${SPLIT_EPIC}/session-capture/plan.json`]: jsonText({ whole: true }),
});

/** Codeintel's repository at `{folder}/codeintel`, its `.workflows/` committed on `main`. @param {string} folder */
function buildSplitProject(folder) {
  const main = initRepo(path.join(folder, SPLIT_EPIC));
  for (const [rel, text] of Object.entries(SPLIT_OLD)) createFile(main, rel, text);
  git(main, ['add', '-A']);
  git(main, ['commit', '-q', '-m', 'the old layout']);
  return main;
}

/** Codeintel on today's layout, with no state: the folder it is copied into, its repository `{dir}/codeintel`. */
const splitProject = harness.folderFrom('split-project-', buildSplitProject);

// The migrations a project the reshape's guard passed has recorded.
const GUARDED = [...new Set(fs.readdirSync(path.join(SCRIPTS, '../../leeway-migrate/scripts/migrations'))
  .filter((name) => /^[0-9]+-/.test(name) && !name.endsWith('.check.cjs'))
  .map((name) => name.slice(0, name.indexOf('-'))))].filter((id) => Number(id) <= 74).sort();

/**
 * Codeintel as the reshape's guard (074) leaves it, the chain before the
 * split run: its state worktree in place on an unborn `leeway-state`,
 * holding the state's `.gitignore` and the record through the guard. The
 * folder it is copied into; its repository `{dir}/codeintel`.
 */
const splitMigration = harness.folderFrom('split-migration-', (folder) => {
  const main = buildSplitProject(folder);
  fs.appendFileSync(path.join(main, '.git/info/exclude'), `/${STATE_DIR_NAME}/\n`);
  GUARD.run({ projectDir: main, reportUpdate: () => {}, reportSkip: () => assert.fail('the guard found no reshape owed') });
  createFile(path.join(main, STATE_DIR_NAME), layout.migrations, GUARDED.map((id) => `${id}\n`).join(''));
});

/**
 * Every file under `dir` but git's own, by its path from `dir`, with its
 * text: a project's tree as the migration leaves it, its state among it.
 * @param {string} dir @returns {Record<string, string>}
 */
function projectTree(dir) {
  return Object.fromEntries(filesUnder(dir).map((file) => path.relative(dir, file))
    .filter((rel) => !rel.split(path.sep).includes('.git'))
    .sort()
    .map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]));
}

// Where a project from before Leeway kept the tracker's store, as the task
// driver that declares it says, read as the finish reads it: its file, and
// a file its tool keeps local, named from the first pattern.
const [PRE_LEEWAY] = preLeewayStores().stores;
const [OLD_STORE] = PRE_LEEWAY.files;
const OLD_LOCAL = PRE_LEEWAY.localFiles[0].replace(/^\//, '').replace(/\*.*$/, '');

// Every fixture migration, recorded: the runner has nothing left to run.
const ALL_RECORDED = ['079', '080', ...RECORDED];

/** @param {string} dir */
function buildFinished(dir) {
  createFile(dir, OLD_STORE, '{"id":"a1"}\n');
  git(dir, ['add', '--', OLD_STORE]);
  git(dir, ['commit', '-q', '-m', 'the tracker\'s store']);
  createFile(dir, OLD_LOCAL, 'local\n');
  createFile(dir, '.gitignore', '.leeway/\n');
  createFile(statePath(dir), layout.migrations, ALL_RECORDED.map((id) => `${id}\n`).join(''));
  enter(dir, 'licensing', 'trial-length');
  FINISH.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
}

/** @type {string|null} */
let finishedTemplate = null;

/**
 * The project waiting on the migration's commit, at `dir`.
 * @param {string} dir
 * @returns {string} dir, symbolic links resolved
 */
function finishedMigration(dir) {
  if (finishedTemplate === null) {
    finishedTemplate = midMigration(templateFolder('finished-migration-template-'));
    buildFinished(finishedTemplate);
  }
  return copyWorld(finishedTemplate, dir);
}

/**
 * A project nested in its repository at `{dir}/app`, waiting on the
 * migration's commit: its `.workflows/` committed in its folder, the state
 * worktree at the repository's top as the move left it, the state's ignore
 * line in the project's own `.gitignore`, and the reshape's finish run
 * there. Made for each call.
 * @param {string} dir
 * @returns {string} the project's folder
 */
function nestedFinished(dir) {
  buildUnborn(dir, { 'README.md': '# The repository\n', [`app/.workflows/${UNIT}/manifest.json`]: jsonText(OLD_UNIT) }, {
    [layout.manifest(UNIT)]: jsonText(MOVED_UNIT),
    [layout.migrations]: ALL_RECORDED.map((id) => `${id}\n`).join(''),
  }, 'app');
  const app = path.join(dir, 'app');
  createFile(app, '.gitignore', '.leeway/\n');
  FINISH.run({ projectDir: app, reportUpdate: () => {}, reportSkip: () => {} });
  return app;
}

// The cut and the merges' world (080's verbs): in today's layout, an epic
// nothing of which is built, its three specs and a plan unbuilt, one topic
// still in discussion and one promoted to the cross-cutting unit; that
// unit, its spec unbuilt, its findings and decisions product-wide and one
// question open; and an epic whose building started, its spec covering one
// topic and none of three others — one in discussion with a brief, mail
// and a file its unit imported, which its log and brief link, one in
// discussion with a log alone, one never started, its research a finding.
// A roadmap item joined to the topic in discussion with mail, sourced from
// its log, and one waiting, sourced from the cross-cutting unit's log.
// Moved by the real move, and every topic's record carried.
const CUT_PROJECT = 'fumi';
const CUT_UNITS = Object.freeze({ gateway: 'epic', caching: 'cross-cutting', shop: 'epic' });
const CUT_DONE = Object.freeze({ status: 'completed' });
const CUT_TALKING = Object.freeze({ status: 'in-progress' });

/** @param {string} title @param {Record<string, string>} sections */
const cutDoc = (title, sections) => `# ${title}\n\n${Object.entries(sections).map(([heading, body]) => `## ${heading}\n\n${body}\n`).join('\n')}`;

/** A spec of one topic, incorporated. @param {string} topic @param {string} [status] */
const cutSpec = (topic, status = 'completed') => ({ status, sources: { [topic]: { status: 'incorporated' } } });

const CUT_OLD = Object.freeze({
  'README.md': '# Fumi\n',
  '.workflows/manifest.json': jsonText({
    work_units: Object.fromEntries(Object.entries(CUT_UNITS).map(([unit, type]) => [unit, { work_type: type }])),
    roadmap: {
      horizons: ['next'],
      items: {
        'star-ratings': { summary: 'Star ratings', kind: 'idea', origin: 'harvest', pulled_to: { work_unit: 'shop', topic: 'reviews' }, sources: ['shop/discussion/reviews.md'] },
        'edge-cache': { horizon: 'next', summary: 'Caching at the edge', kind: 'idea', origin: 'harvest', sources: ['caching/discussion/invalidation.md'] },
      },
    },
  }),
  '.workflows/gateway/manifest.json': jsonText({
    name: 'gateway', work_type: 'epic', status: 'in-progress', description: 'The public API', created: '2026-01-01',
    phases: {
      discussion: { items: { auth: CUT_DONE, limits: CUT_DONE, errors: CUT_TALKING, invalidation: { status: 'promoted', promoted_to: 'caching' } } },
      specification: { items: { auth: cutSpec('auth'), limits: cutSpec('limits'), errors: cutSpec('errors', 'in-progress') } },
      planning: { items: { auth: CUT_DONE } },
    },
  }),
  '.workflows/gateway/discussion/auth.md': cutDoc('Discussion: Auth', { Tokens: 'Bearer tokens.' }),
  '.workflows/gateway/discussion/limits.md': cutDoc('Discussion: Limits', { Rate: 'A hundred calls a minute.' }),
  '.workflows/gateway/discussion/errors.md': cutDoc('Discussion: Errors', { Shape: 'Still open.' }),
  '.workflows/gateway/specification/auth/specification.md': cutDoc('Specification: Auth', { Tokens: 'Bearer tokens on every call.' }),
  '.workflows/gateway/specification/limits/specification.md': cutDoc('Specification: Limits', { Rate: 'A hundred calls a minute.' }),
  '.workflows/gateway/specification/errors/specification.md': cutDoc('Specification: Errors', { Shape: 'A code and a message.' }),
  '.workflows/gateway/planning/auth/planning.md': cutDoc('Plan: Auth', { Tasks: 'Each task is in the tracker.' }),
  '.workflows/caching/manifest.json': jsonText({
    name: 'caching', work_type: 'cross-cutting', status: 'in-progress', description: 'Caching across the product', created: '2026-01-02',
    phases: {
      discussion: { items: { invalidation: CUT_DONE } },
      specification: { items: { caching: { status: 'completed', sources: { invalidation: { status: 'incorporated' } } } } },
    },
  }),
  '.workflows/caching/discussion/invalidation.md': cutDoc('Discussion: Invalidation', { Purging: 'Every write purges its keys.', Lifetimes: 'An hour at most.' }),
  '.workflows/caching/specification/caching/specification.md': cutDoc('Specification: Caching', { Invalidation: 'Every write purges its keys.', Lifetimes: 'An entry lives an hour at most.' }),
  '.workflows/shop/manifest.json': jsonText({
    name: 'shop', work_type: 'epic', status: 'in-progress', description: 'The shop', created: '2026-01-03',
    phases: {
      discovery: { items: { gifts: { routing: 'discussion', source: 'discovery', summary: 'Gifts', order: 1 } } },
      discussion: { items: { weights: CUT_DONE, reviews: CUT_TALKING, wishlist: CUT_TALKING } },
      specification: { items: { weights: cutSpec('weights') } },
      implementation: { items: { weights: CUT_TALKING } },
    },
    imports: [{ path: 'imports/stars.md', imported_at: '2026-01-06T10:00:00Z', origin: 'discussion/reviews' }],
  }),
  '.workflows/shop/discussion/weights.md': cutDoc('Discussion: Weights', { 'Tie Break': 'By price.' }),
  '.workflows/shop/discussion/reviews.md': cutDoc('Discussion: Reviews', { Who: 'Buyers alone, rated in [stars](../imports/stars.md).', Moderation: 'Still open.' }),
  '.workflows/shop/discussion/wishlist.md': cutDoc('Discussion: Wishlist', { Sharing: 'Still open.' }),
  '.workflows/shop/research/gifts.md': cutDoc('Research: Gifts', { Wrapping: 'Gift wrap is free.' }),
  '.workflows/shop/discussion/.mailbox/reviews/001-photos.md': 'Photos\n\nMay a review carry photos?\n',
  '.workflows/shop/discovery/briefs/reviews.md': '# Reviews\n\nWhat buyers say, in [stars](../../imports/stars.md).\n',
  '.workflows/shop/imports/stars.md': '# Stars\n\nFive at most.\n',
  '.workflows/shop/specification/weights/specification.md': cutDoc('Specification: Weights', { 'Tie Break': 'By price.' }),
});

/** @param {string} unit @param {string} topic @param {string} section */
const cutLogCite = (unit, topic, section) => ({ path: layout.topic(unit, topic, 'log.md'), section });

// Each topic's record, as the records directive composes it.
const CUT_RECORDS = Object.freeze({
  'gateway.discussion.auth': [
    { ref: 'q1', event: 'asked', text: 'How do clients authenticate?', by: 'claude', cites: [cutLogCite('gateway', 'auth', 'Tokens')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'Bearer tokens.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [cutLogCite('gateway', 'auth', 'Tokens')] },
  ],
  'gateway.discussion.limits': [
    { ref: 'q1', event: 'asked', text: 'How many calls a minute?', by: 'claude', cites: [cutLogCite('gateway', 'limits', 'Rate')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'A hundred.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [cutLogCite('gateway', 'limits', 'Rate')] },
  ],
  'gateway.discussion.errors': [
    { ref: 'q1', event: 'asked', text: 'What shape is an error?', by: 'claude', cites: [cutLogCite('gateway', 'errors', 'Shape')] },
  ],
  'caching.discussion.invalidation': [
    { ref: 'q1', event: 'asked', text: 'When is a cached key purged?', by: 'claude', cites: [cutLogCite('caching', 'invalidation', 'Purging')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Every write purges its keys.', why: 'The spec holds it.', by: 'claude', given: 'carried', product_wide: true,
      cites: [{ path: layout.assets('caching', 'specs', 'caching.md'), section: 'Invalidation' }], assets: [{ path: layout.assets('caching', 'specs', 'caching.md'), status: 'reference' }],
    },
    {
      ref: 'f1', event: 'found', text: 'An entry lives an hour at most.', how: 'read in the spec', known: 'read', by: 'claude', product_wide: true,
      cites: [{ path: layout.assets('caching', 'specs', 'caching.md'), section: 'Lifetimes' }, cutLogCite('caching', 'invalidation', 'Lifetimes')],
    },
    { ref: 'q2', event: 'asked', text: 'Do reads ever purge a key?', by: 'claude', cites: [cutLogCite('caching', 'invalidation', 'Purging')] },
  ],
  'shop.discussion.weights': [
    { ref: 'q1', event: 'asked', text: 'How do ties break?', by: 'claude', cites: [cutLogCite('shop', 'weights', 'Tie Break')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'By price.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [{ path: 'shop/spec.md', section: 'Tie Break' }] },
  ],
  'shop.discussion.reviews': [
    { ref: 'q1', event: 'asked', text: 'Who may leave a review?', by: 'claude', cites: [cutLogCite('shop', 'reviews', 'Who')] },
    {
      ref: 'd1', event: 'decided', answers: 'q1', text: 'Buyers alone.', why: 'The log settles it.', by: 'claude', given: 'carried',
      cites: [cutLogCite('shop', 'reviews', 'Who'), { path: layout.topic('shop', 'reviews', 'brief.md'), section: 'Reviews' }], assets: [{ path: layout.assets('shop', 'stars.md'), status: 'reference' }],
    },
    { ref: 'q2', event: 'asked', text: 'Who moderates reviews?', by: 'claude', cites: [cutLogCite('shop', 'reviews', 'Moderation')] },
  ],
  'shop.discussion.wishlist': [
    { ref: 'q1', event: 'asked', text: 'May a wishlist be shared?', by: 'claude', cites: [cutLogCite('shop', 'wishlist', 'Sharing')] },
  ],
  'shop.discovery.gifts': [
    { ref: 'f1', event: 'found', text: 'Gift wrap is free.', how: 'read in the research', known: 'read', by: 'claude', cites: [cutLogCite('shop', 'gifts', 'Wrapping')] },
  ],
});

/** @param {string} dir */
function buildCut(dir) {
  initRepo(dir);
  for (const [rel, text] of Object.entries(CUT_OLD)) createFile(dir, rel, text);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  for (const [place, entries] of Object.entries(CUT_RECORDS)) {
    const [unit, , topic] = place.split('.');
    createFile(statePath(dir), composedPath(unit, topic), JSON.stringify({ entries }));
    harness.ok(dir, ['ledger', 'carry', place], { env: SESSION });
  }
}

/** @type {string|null} */
let cutTemplate = null;

/**
 * The cut and the merges' world at `{dir}/fumi`, the migration under way in
 * it, every topic's record carried.
 * @param {string} dir
 * @returns {string} the project's folder, symbolic links resolved
 */
function cutMigration(dir) {
  if (cutTemplate === null) {
    cutTemplate = path.join(templateFolder('cut-migration-template-'), CUT_PROJECT);
    buildCut(cutTemplate);
  }
  return copyWorld(cutTemplate, path.join(dir, CUT_PROJECT));
}

/**
 * The state as a verb of the migration's leaves it, read so two runs
 * compare: the worktree's link, the cache and the copies' marks left out;
 * each carry's own id and time; and the instant the map of each epic in
 * `made`, the run's own, was approved at.
 * @param {string} dir @param {string[]} [made]
 */
function settledState(dir, made = []) {
  const kept = Object.entries(treeSnapshot(dir)).filter(([rel]) => rel !== '.git' && !rel.startsWith(layout.cache()) && !rel.startsWith(layout.knowledge('.copies')));
  /** @param {string} text */
  const lines = (text) => text.split('\n').filter(Boolean).map((line) => {
    const { id, at, ...event } = JSON.parse(line);
    return event.event === 'rehomed' ? event : { id, at, ...event };
  });
  /** @param {string} text */
  const unstamped = (text) => {
    const manifest = JSON.parse(text);
    delete manifest.phases.discovery.approved_at;
    return manifest;
  };
  const read = (/** @type {string} */ rel, /** @type {string} */ text) => {
    if (rel === layout.ledger) return lines(text);
    return made.some((unit) => rel === layout.manifest(unit)) ? unstamped(text) : text;
  };
  return Object.fromEntries(kept.map(([rel, text]) => [rel, read(rel, text)]));
}

/** Whether the project's `leeway-state` has no commit yet. @param {string} dir */
function stateUnborn(dir) {
  return git(dir, ['for-each-ref', BRANCH_REF]).trim() === '';
}

/** The code branch's tip. @param {string} dir */
function codeHead(dir) {
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

/**
 * The fixture records directive's entry for a decided subtopic, written
 * through the directive engine: its response.
 * @param {string} dir @param {string} topic @param {string} subtopic
 */
function enter(dir, topic, subtopic) {
  return directiveEngine().ok(dir, ['ledger', 'find', `${UNIT}.discussion.${topic}`], {
    env: SESSION,
    stdin: JSON.stringify({ text: subtopic, how: 'read from the discussion\'s map', known: 'read', by: 'claude', who_moved_whom: 'none' }),
  });
}

/** Each of a topic's decided subtopics entered. @param {string} dir @param {keyof typeof DECIDED} topic */
function enterTopic(dir, topic) {
  for (const subtopic of DECIDED[topic]) enter(dir, topic, subtopic);
}

/**
 * A call that must refuse, leaving every file of the state as it was and
 * the state branch with no commit yet: its error. The directive engine
 * makes it, but where another is named.
 * @param {string} dir @param {string[]} args @param {import('./engine-harness.cjs').CallOptions} [opts] @param {{refuses: typeof harness.refuses}} [engine]
 */
function refusedUntouched(dir, args, opts = { env: SESSION }, engine = directiveEngine()) {
  const before = treeSnapshot(dir);
  const { error } = engine.refuses(dir, args, opts);
  assert.deepStrictEqual(treeSnapshot(dir), before, `engine ${args.join(' ')} wrote on refusing`);
  assert.ok(stateUnborn(dir), `engine ${args.join(' ')} committed on refusing`);
  return error;
}

/** The migrations record's lines. @param {string} dir */
function recorded(dir) {
  return fs.readFileSync(statePath(dir, layout.migrations), 'utf8').split('\n').filter(Boolean);
}

/**
 * A call to the engine that must refuse, writing nothing but the refusal it
 * keeps at `kept`, state-relative, and the state branch with no commit yet:
 * its error, which the kept file holds.
 * @param {string} dir @param {string[]} args @param {string} kept @param {import('./engine-harness.cjs').CallOptions} [opts]
 */
function refusedKeeping(dir, args, kept, opts = { env: SESSION }) {
  const { [kept]: _, ...before } = treeSnapshot(dir);
  const { error } = harness.refuses(dir, args, opts);
  const { [kept]: refusal, ...after } = treeSnapshot(dir);
  assert.deepStrictEqual(after, before, `engine ${args.join(' ')} wrote beside its refusal`);
  assert.strictEqual(refusal, `${error}\n`);
  assert.ok(stateUnborn(dir), `engine ${args.join(' ')} committed on refusing`);
  return error;
}

module.exports = {
  UNIT, SESSION, DECIDED, RECORDED, ALL_RECORDED, FIXTURES, OLD_STORE, OLD_LOCAL,
  directiveEngine, midMigration, recordsMigration, finishedMigration, nestedFinished, stateUnborn, codeHead, enter, enterTopic, refusedUntouched, refusedKeeping, recorded,
  SPLIT_EPIC, SPLIT_SOURCES, SPLIT_OLD, SPLIT_PLANS, GUARDED, themeOf, stagedPlan, splitProject, splitMigration, projectTree,
  CUT_RECORDS, cutMigration, settledState,
};
