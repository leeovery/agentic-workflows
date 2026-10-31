'use strict';

//
// Tests for migration 078: reshape-move (.cjs)
//
// The reshape's move (21.5) driven in process against a git project whose
// `.workflows/` is today's shape, committed: an epic mid-discussion, an epic
// whose building started, a feature, a bugfix, a completed quick-fix, a
// quick-fix being built, a cross-cutting unit holding a topic the first epic
// promoted, and a cancelled unit, with the project's inbox,
// environment setup, cache — its old agent stores holding reviews never
// folded in — old migrations record, roadmap and baseline
// beside them, the tracker's store, settings hooks and `.worktreeinclude` in
// its code tree, and today's user-level folder holding its config,
// credentials and a conversation. The move runs once over that project, and
// each test reads one rule off what it left: the state worktree on an unborn
// `leeway-state`, locked, with nothing committed, nothing staged but the
// project's own files, and `.workflows/` and the store untouched; each
// unit's files in the layout, each review never folded in folded into its
// topic's log, a person's files named for tracking or
// analysis kept beside the reviews' tracking files dropped; nothing in a
// topic's folder no topic owns; its manifest less research and the retired
// state, the dead end off every topic — one whose work concluded keeping its
// close, any other cancelled with its mail sent to the inbox; the project's manifest with its id, the baseline's skip its
// brownfield answer and the roadmap's sources following their files; the
// roadmap as the product, the baseline's docs its assets; the store in the
// state; the hooks naming the engine's new path and the workflows' lines
// gone from `.worktreeinclude`; the user-level folder moved and linked;
// every file written in a place the layout holds; the files the layout has
// no place for, named, the tools' sidecars not. A small project of its own
// covers the runner's record and journals already in `.leeway/`, the
// `.leeway/` ignore line staged with hooks off and the caller's git
// environment cleared, the move run again over one cut short and over one
// whose `.leeway/` the person removed, a project nested in its repository,
// one run from a linked worktree, a merge stopped in the main checkout, the
// projects with nothing to move, a native baseline, a completed one and
// one under way, a `.worktreeinclude` of the workflows' lines alone,
// settings that do not parse, a user-level folder the engine's holds a
// different copy of a file in, and one that is a link elsewhere. The
// tracker's store is where its driver's frozen declaration says a project
// from before Leeway keeps it, read as the move reads it.
// Each test that runs the move points both user-level folders at its own,
// never the machine's.
//

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');
const { layoutPlace } = require('../../skills/leeway-engine/scripts/domain/layout.cjs');

const TODAY = new Date().toISOString().slice(0, 10);
const json = (/** @type {unknown} */ value) => JSON.stringify(value, null, 2) + '\n';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
const STATE_GITIGNORE = '/.knowledge/\n/.cache/\n/.lock\n/.lock.*\n.manifest.json.*.tmp\n/.ledger.jsonl.*.tmp\n';

// Where a project from before Leeway keeps the tracker's store, as the task
// driver that declares it says, read from its module as the move reads it;
// and one file its tool keeps local, named from the first pattern.
const TASK_DRIVERS = path.join(__dirname, '../../skills/leeway-engine/scripts/drivers/task');
const [PRE_LEEWAY] = fs.readdirSync(TASK_DRIVERS).map((name) => require(path.join(TASK_DRIVERS, name, 'driver.cjs')).preLeewayStore).filter(Boolean);
const [STORE] = PRE_LEEWAY.files;
const LOCAL = PRE_LEEWAY.localFiles[0].replace(/^\//, '').replace(/\*.*$/, '');
const STORE_LINES = '{"id":"a1","title":"Ranking"}\n{"id":"a2","title":"Ranking, phase 2"}\n';

const OLD_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const NEW_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/leeway-engine/scripts/engine.cjs"';
const FOREIGN_HOOK = { type: 'command', command: 'npx prettier --check .' };
/**
 * The project's settings, its hooks naming the engine at `engine` and its
 * permission rules the state at `state`.
 * @param {string} engine @param {string} state
 */
const settings = (engine, state) => ({
  permissions: { allow: ['Bash(npm test)', `Edit(${state}/**)`, `Bash(mv ${state}/:*)`], deny: [`Read(${state}/.cache/**)`] },
  hooks: {
    SessionEnd: [{ hooks: [{ type: 'command', command: `${engine} presence cleanup` }, { type: 'command', command: `${engine} conversation end` }, FOREIGN_HOOK] }],
    SessionStart: [{ matcher: 'resume', hooks: [{ type: 'command', command: `${engine} session resume` }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [FOREIGN_HOOK] }],
  },
});
const WORKTREE_INCLUDE = '.env.local\n.workflows/.knowledge/store.bin\n.workflows/.knowledge/metadata.json\n.workflows/.knowledge/config.json\n';

// The user-level folders the move reads, pinned for the whole file, never the
// machine's: each test that runs the move names its own pair first.
const HOMES = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-078-homes-')));
process.on('exit', () => fs.rmSync(HOMES, { recursive: true, force: true }));

/**
 * A pair of user-level folders the move reads from now on, the old one
 * holding `files` where any are given, the new one `fresh`.
 * @param {string} name @param {Record<string, string>} [files] @param {Record<string, string>} [fresh]
 */
function homes(name, files = {}, fresh = {}) {
  const old = path.join(HOMES, name, 'workflows');
  const leeway = path.join(HOMES, name, 'leeway');
  for (const [rel, content] of Object.entries(files)) write(old, rel, content);
  for (const [rel, content] of Object.entries(fresh)) write(leeway, rel, content);
  process.env.WORKFLOWS_CONFIG_DIR = old;
  process.env.LEEWAY_CONFIG_DIR = leeway;
  return { old, leeway };
}

// Today's user-level folder: its config, its credentials and a conversation's folder.
const USER_FOLDER = {
  'config.json': '{"provider":"openai"}\n',
  'credentials.json': '{"openai":"sk-test"}\n',
  'conversations/s1/position.json': '{"at":"workflows"}\n',
  '.DS_Store': 'sidecar\n',
};

/** @param {string} prefix */
const tempProject = (prefix) => initRepo(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))));

/** @param {string} dir @param {string} rel @param {string|Buffer} content */
function write(dir, rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** @param {string} dir */
function commitAll(dir) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'today\'s layout']);
}

/** Every file under `dir`'s folder `at`, relative to it. @param {string} dir @param {string} [at] @returns {string[]} */
function tree(dir, at = '') {
  const root = path.join(dir, at);
  /** @param {string} rel @returns {string[]} */
  const under = (rel) => fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((entry) => {
    const named = rel === '' ? entry.name : `${rel}/${entry.name}`;
    return entry.isDirectory() ? under(named) : [named];
  });
  return fs.existsSync(root) ? under('').sort() : [];
}

/** The reason git holds the worktree at `state` locked for, or null. @param {string} dir @param {string} state */
function lockOf(dir, state) {
  const listed = git(dir, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${state}\n`));
  const locked = /^locked ?(.*)$/m.exec(String(listed));
  return locked === null ? null : locked[1];
}

/** @param {string} dir */
function run(dir) {
  const counts = { updates: 0, skips: 0 };
  const returned = MIGRATION.run({ projectDir: dir, reportUpdate: () => { counts.updates += 1; }, reportSkip: () => { counts.skips += 1; } });
  return { ...counts, returned };
}

/** A message as today's send writes it. @param {string} title @param {string} from */
const message = (title, from) => `### ${title}\n*From: ${from} · discussion · 2026-01-01*\n\nDetails of ${title.toLowerCase()}.\n`;

/** A message as the move leaves it, its sender line as the waiting mail heads it. @param {string} title @param {string} sender */
const moved = (title, sender) => `### ${title}\nFrom ${sender} · 1 Jan\n\nDetails of ${title.toLowerCase()}.\n`;

const PROJECT_MANIFEST = {
  work_units: {
    core: { work_type: 'epic' }, shop: { work_type: 'epic' }, tally: { work_type: 'feature' }, stall: { work_type: 'bugfix' },
    typo: { work_type: 'quick-fix' }, patch: { work_type: 'quick-fix' }, gone: { work_type: 'feature' }, shared: { work_type: 'cross-cutting' },
  },
  defaults: { plan_format: 'sample-format', linters: [{ name: 'eslint', command: 'npx eslint .' }] },
  roadmap: {
    horizons: ['v1'],
    active_session: '002',
    imports: [{ path: 'imports/market.md', imported_at: '2026-01-04T10:00:00Z', origin: 'roadmap' }],
    items: {
      loyalty: { horizon: 'v1', summary: 'rewards', kind: 'idea', origin: 'harvest', sources: ['.roadmap/sessions/session-001.md', '.roadmap/imports/market.md'] },
      'points-expiry': { horizon: 'v1', summary: 'expiry', kind: 'bug', origin: 'inbox', sources: ['.roadmap/notes/bugs/2026-01-03--points-expiry.md'] },
      alpha: {
        horizon: 'v1', summary: 'Alpha', kind: 'idea', origin: 'postpone:core', postponed_from: { work_unit: 'core', topic: 'alpha' },
        sources: ['core/discovery/briefs/alpha.md', 'core/research/alpha.md', 'core/discussion/alpha.md', 'core/implementation/gone.md'],
      },
      exploration: {
        horizon: 'v1', summary: 'Exploration', kind: 'idea', origin: 'harvest',
        sources: ['core/research/exploration-superseded-2026-01-01-1200.md', 'core/research/gamma.md', 'core/discussion/.mailbox/beta/001-third.md'],
      },
    },
  },
  baseline: { status: 'skipped' },
};

/** An epic mid-discussion, nothing built: research, mail, experiments, a spec proposed, imports. */
const CORE = {
  name: 'core',
  work_type: 'epic',
  status: 'in-progress',
  description: 'The core',
  created: '2026-01-01',
  seeds: [{ path: 'seeds/2026-01-01--search.md', source: 'inbox' }],
  imports: [
    { path: 'imports/notes.md', imported_at: '2026-01-02T10:00:00Z', origin: 'discussion/alpha' },
    { path: 'imports/diagram.png', imported_at: '2026-01-02T10:00:00Z', origin: 'discovery' },
  ],
  phases: {
    discovery: {
      active_session: '002',
      gap_analysis_cache: { checksum: 'def', generated: '2026-01-03', input_files: ['research/alpha.md'] },
      analysis_staging: { 'discovery-gap-analysis': { gate_mode: 'gated', candidates: { zeta: { status: 'pending' } } } },
      items: {
        alpha: { routing: 'research', source: 'discovery', summary: 'Alpha', order: 1, brief_path: 'discovery/briefs/alpha.md' },
        beta: { routing: 'discussion', source: 'message:alpha', summary: 'Beta', order: 2 },
        gamma: { routing: 'discussion', source: 'discovery', summary: 'Gamma' },
        delta: { routing: 'discussion', source: 'discovery', summary: 'Delta', cancelled: true, previous_order: 4 },
        epsilon: { routing: 'research', source: 'discovery', summary: 'Epsilon' },
        eta: { routing: 'research', source: 'discovery', summary: 'Eta', postponed: true },
        theta: { routing: 'research', source: 'discovery', summary: 'Theta' },
        iota: { routing: 'research', source: 'discovery', summary: 'Iota' },
      },
    },
    research: {
      items: {
        gamma: { status: 'completed' },
        theta: { status: 'cancelled' },
        iota: { status: 'unstarted' },
        alpha: { status: 'in-progress', reconcile_needed: 'experiment', threads: { why: { question: 'Why?', status: 'learned', origin: 'seed' } } },
        epsilon: { status: 'in-progress', awaiting_experiments: ['E2'] },
        eta: { status: 'postponed', previous_status: 'completed' },
        'exploration-superseded-2026-01-01-1200': { status: 'superseded' },
      },
    },
    discussion: {
      analysis_cache: { checksum: 'abc', generated: '2026-01-03' },
      items: {
        alpha: { status: 'completed', reconcile_needed: 'roadmap', subtopics: { frames: { status: 'decided' }, monitors: { status: 'deferred' } } },
        beta: { status: 'unstarted', reconcile_needed: 'research' },
        gamma: { status: 'promoted', promoted_to: 'shared' },
        delta: { status: 'cancelled', reconcile_needed: 'experiment' },
      },
    },
    experiment: {
      items: {
        alpha: { status: 'completed', experiments: { E1: { slug: 'frame-budget', status: 'concluded', verdict: 'fits' } } },
        'exploration-superseded-2026-01-01-1200': { status: 'completed', experiments: { E3: { slug: 'cache-size', status: 'concluded', verdict: 'small' } } },
      },
    },
    specification: {
      build_order_stale: true,
      items: {
        search: {
          status: 'in-progress', order: 1, review_cycle: 2, review_baseline_words: 1200, tracking: { 'review-input-tracking-c1.md': 'open' },
          reconcile_needed: 'discussion', sources: { alpha: { status: 'incorporated' } },
        },
        old: { status: 'cancelled', previous_order: 2, sources: {} },
      },
    },
  },
};

/** An epic whose building started: plans, implementation and review, its spec built. */
const SHOP = {
  name: 'shop',
  work_type: 'epic',
  status: 'in-progress',
  description: 'The shop',
  created: '2026-01-01',
  phases: {
    discovery: { items: { ranking: { routing: 'discussion', source: 'discovery', summary: 'Ranking' } } },
    discussion: { items: { ranking: { status: 'completed' }, 'event-tracking': { status: 'completed' }, 'usage-analysis': { status: 'completed' } } },
    specification: { items: { ranking: { status: 'completed', order: 1, sources: { ranking: { status: 'incorporated' } } } } },
    planning: {
      items: {
        ranking: {
          status: 'completed', format: 'sample-format', phase: 2, task: 1, review_cycle: 1, review_baseline_words: 900,
          approvals: { structure: true }, tracking: { 'review-integrity-tracking-c1.md': 'done' },
          external_dependencies: { core: { state: 'resolved', description: 'search' } },
          staging: { 'author-p1': { tasks: { 1: 'approved' } } },
          task_map: { 'ranking-1-1': 'ext-a1' }, storage_paths: ['.tracker'],
        },
      },
    },
    implementation: {
      items: {
        ranking: {
          status: 'in-progress', current_phase: 2, current_task: 'ranking-2-1', completed_tasks: ['ranking-1-1'],
          staging: { c1: { gate_mode: 'gated', tasks: { 1: 'approved' } } }, bank: [{ finding: 'later' }],
        },
      },
    },
    review: { items: { ranking: { status: 'in-progress', reviewed_tasks: ['ranking-1-1'], staging: { c1: { tasks: { 1: 'approved' } } } } } },
  },
};

const unit = (name, workType, status, phases) => ({ name, work_type: workType, status, description: name, created: '2026-01-01', phases });

/** A quick-fix's plan item as scoping registers it. @param {string} wu */
const quickFixPlan = (wu) => ({
  status: 'completed', format: 'sample-format', spec_commit: 'abc1234', task_list_gate_mode: 'auto', author_gate_mode: 'auto',
  finding_gate_mode: 'auto', phase: 1, task: null, external_id: wu, task_map: { [`${wu}-1`]: `${wu}-1`, [`${wu}-1-1`]: `${wu}-1-1` }, storage_paths: [],
});

/** A quick-fix's phases, scoped and its building at `building`. @param {string} wu @param {string} building */
const quickFixPhases = (wu, building) => ({
  scoping: { items: { [wu]: { status: 'completed' } } },
  specification: { items: { [wu]: { status: 'completed' } } },
  planning: { items: { [wu]: { ...quickFixPlan(wu), review_cycle: 0 } } },
  implementation: { items: { [wu]: { status: building } } },
});

/** @param {string} dir */
function todaysProject(dir) {
  const w = (/** @type {string} */ rel, /** @type {string|Buffer} */ content) => write(dir, `.workflows/${rel}`, content);
  w('manifest.json', json(PROJECT_MANIFEST));
  w('.inbox/ideas/2026-02-01--dark-mode.md', '# Dark mode\n');
  w('.inbox/.archived/bugs/2026-01-02--old-crash.md', '# Old crash\n');
  w('.inbox/ideas/rough-notes.md', 'no item\'s name\n');
  w('.state/environment-setup.md', 'No special setup required.\n');
  w('.state/migrations', '001\n072\n');
  w('.cache/core/discussion/alpha/session.json', '{"live":true}\n');
  w('.cache/core/discussion/alpha/state.json', json({ agents: { 'review-001': { id: 'review-001', kind: 'review', status: 'acknowledged' }, 'review-002': { id: 'review-002', kind: 'review', status: 'incorporated' } } }));
  w('.cache/core/discussion/alpha/review-001.md', '### F1: Ranking ties\n\nTwo results of one age have no order.\n');
  w('.cache/core/discussion/alpha/review-002.md', '### F1: Stale\n\nFolded in long ago.\n');
  w('.cache/core/discussion/gamma/state.json', json({ agents: { 'review-003': { id: 'review-003', kind: 'review', status: 'acknowledged' } } }));
  w('.cache/core/discussion/gamma/review-003.md', '### F1: Token reuse\n\nA token outlives its session.\n');
  w('scratch/notes.txt', 'a folder that is no unit\n');
  w('Thumbs.db', 'sidecar\n');

  w('.roadmap/sessions/session-001.md', '# Roadmap Session 001\n\nSee [market](../imports/market.md).\n');
  w('.roadmap/sessions/session-002.md', '# Roadmap Session 002\n');
  w('.roadmap/notes/bugs/2026-01-03--points-expiry.md', '# Points expiry\n\nPer [market](../../imports/market.md).\n');
  w('.roadmap/notes/ideas/2026-01-03--points-expiry.md', '# Points expiry, an idea of the same name\n');
  w('.roadmap/imports/market.md', '# Market\n');
  w('.roadmap/imports/chart.png', PNG);
  w('.roadmap/imports/.DS_Store', 'sidecar\n');
  w('.roadmap/draft.txt', 'a file of no place\n');
  w('.baseline/auth.md', '# Auth\n\nSee [billing](billing.md).\n');
  w('.baseline/billing.md', '# Billing\n');
  w('.baseline/.state/dossier-auth.md', 'dossier\n');
  w('.baseline/.state/agenda-auth.md', '# Agenda: Auth\n\n- Why sessions expire: the person said an hour, for the auditors.\n');

  write(dir, STORE, STORE_LINES);
  write(dir, LOCAL, 'the tool\'s own\n');
  write(dir, '.claude/settings.json', json(settings(OLD_ENGINE, '.workflows')));
  write(dir, '.worktreeinclude', WORKTREE_INCLUDE);

  w('core/manifest.json', json(CORE));
  w('core/discovery/sessions/session-001.md', '# Discovery Session 001\n');
  w('core/discovery/sessions/session-002.md', '# Discovery Session 002\n\nSee [notes](../../imports/notes.md).\n');
  w('core/discovery/briefs/alpha.md', '# Alpha brief\n\nFrom [notes](../../imports/notes.md).\n');
  w('core/discovery/briefs/zeta.md', '# Zeta brief, its topic never mapped\n');
  w('core/discussion/stray.md', '# Discussion: Stray, no item\'s\n');
  w('core/research/.mailbox/exploration-superseded-2026-01-01-1200/001-cache-sizes.md', message('Cache sizes', 'alpha'));
  w('core/experiment/exploration-superseded-2026-01-01-1200/E3-cache-size/report.md', '# Report\n');
  w('core/research/alpha.md', '# Research: Alpha\n\nRead [notes](../imports/notes.md) and ![d](../imports/diagram.png), not [code](../imports/util.js).\n');
  w('core/research/epsilon.md', '# Research: Epsilon\n');
  w('core/research/exploration-superseded-2026-01-01-1200.md', '# Research: Exploration\n\nSee ../imports/notes.md.\n');
  w('core/discussion/alpha.md', '# Discussion: Alpha\n\nThe research said so, and so do we.\n');
  w('core/research/.mailbox/beta/001-first.md', message('First', 'alpha'));
  w('core/research/.mailbox/beta/002-second.md', message('Second', 'alpha'));
  w('core/discussion/.mailbox/beta/001-third.md', message('Third', 'gamma'));
  w('core/discussion/.mailbox/gamma/004-late.md', message('Late', 'alpha'));
  w('core/discussion/.mailbox/gamma/005-ranking-input.md', message('Ranking input', 'shop.ranking'));
  w('core/discussion/.mailbox/gamma/006-tally-input.md', message('Tally input', 'tally.tally'));
  w('core/discussion/.mailbox/delta/001-a-dropped-thought.md', message('A dropped thought', 'alpha'));
  w('core/experiment/alpha/E1-frame-budget/problem.md', '# Problem\n\nAgainst [notes](../../../imports/notes.md).\n');
  w('core/experiment/alpha/E1-frame-budget/report.md', '# Report\n');
  w('core/experiment/alpha/E1-frame-budget/data/run.csv', 'ms\n12\n');
  w('core/experiment/alpha/E1-frame-budget/data/run.sh', '#!/bin/sh\necho 12\n');
  fs.chmodSync(path.join(dir, '.workflows/core/experiment/alpha/E1-frame-budget/data/run.sh'), 0o755);
  w('core/research/gamma.md', '# Research: Gamma\n\nSee [notes](../imports/notes.md).\n');
  w('core/research/theta.md', '# Research: Theta\n');
  w('core/research/.mailbox/theta/001-theta-note.md', message('Theta note', 'alpha'));
  w('core/experiment/alpha/E1-frame-budget/E1.1-one-monitor/problem.md', '# Sub-problem\n');
  w('core/specification/search/specification.md', '# Specification: Search\n\n[n](../../imports/notes.md)\n');
  w('core/specification/search/review-input-tracking-c1.md', 'tracking\n');
  w('core/specification/search/order-tracking-notes.md', 'the person\'s own\n');
  w('core/imports/notes.md', '# Notes\n');
  w('core/imports/diagram.png', PNG);
  w('core/seeds/2026-01-01--search.md', '# Search\n');
  w('core/.state/discovery-gap-analysis.md', 'cache\n');
  w('core/notes.txt', 'a file of no place\n');

  w('shop/manifest.json', json(SHOP));
  w('shop/discovery/sessions/session-001.md', '# Discovery Session 001\n');
  w('shop/discussion/ranking.md', '# Discussion: Ranking\n');
  w('shop/specification/ranking/specification.md', '# Specification: Ranking\n');
  w('shop/planning/ranking/planning.md', '# Plan: Ranking\n');
  w('shop/planning/ranking/phase-1-tasks.md', '# Phase 1\n');
  w('shop/planning/ranking/tasks/ranking-1-1.md', '# Task 1.1\n');
  w('shop/planning/ranking/review-integrity-tracking-c1.md', 'tracking\n');
  w('shop/implementation/ranking/fix-tracking-ranking-1-1.md', 'tracking\n');
  w('shop/implementation/ranking/analysis-tasks-c1.md', 'analysis\n');
  w('shop/review/ranking/report.md', '# Review\n');
  w('shop/review/ranking/report-1-1.md', '# Task review\n');
  w('shop/review/ranking/change-set-c1-ranking.md', '# Change set\n');
  w('shop/review/ranking/change-set-c2-order-tracking.md', '# Change set: Order Tracking\n');
  w('shop/review/ranking/change-set-c3-cost-analysis.md', '# Change set: Cost Analysis\n');
  w('shop/discussion/event-tracking.md', '# Discussion: Event Tracking\n');
  w('shop/planning/event-tracking/planning.md', '# Plan: Event Tracking\n');
  w('shop/planning/event-tracking/tasks/event-tracking-1-1.md', '# Task 1.1\n');
  w('shop/planning/usage-analysis/usage-analysis-1-1.md', '# Task 1.1, as an older plan kept it\n');
  w('shop/review/usage-analysis/report-1-1.md', '# Task review\n');
  w('shop/imports/.DS_Store', 'sidecar\n');
  w('shop/imports/sketch.md', '# Sketch\n');
  w('shop/Thumbs.db', 'sidecar\n');

  w('tally/manifest.json', json(unit('tally', 'feature', 'in-progress', {
    research: { items: { tally: { status: 'completed' } } },
    discussion: { items: { tally: { status: 'in-progress' } } },
  })));
  w('tally/research/tally.md', '# Research: Tally\n\nCounting is hard.\n');
  w('tally/discussion/tally.md', '# Discussion: Tally\n\nCounting is hard, the research said.\n');

  w('stall/manifest.json', json(unit('stall', 'bugfix', 'in-progress', { investigation: { items: { stall: { status: 'in-progress' } } } })));
  w('stall/investigation/stall.md', '# Investigation: Stall\n\nThe queue stalls.\n');
  w('stall/investigation/.mailbox/stall/001-retry-window.md', message('Retry window', 'pay'));

  w('typo/manifest.json', json(unit('typo', 'quick-fix', 'completed', quickFixPhases('typo', 'completed'))));
  w('typo/specification/typo/specification.md', '# Typo\n\nFix the typo in the header.\n');
  w('typo/planning/typo/planning.md', '# Plan: Typo\n');

  w('patch/manifest.json', json(unit('patch', 'quick-fix', 'in-progress', quickFixPhases('patch', 'in-progress'))));
  w('patch/specification/patch/specification.md', '# Patch\n');
  w('patch/planning/patch/planning.md', '# Plan: Patch\n');

  w('shared/manifest.json', json(unit('shared', 'cross-cutting', 'in-progress', {
    discussion: { items: { gamma: { status: 'completed' } } },
    specification: { items: { shared: { status: 'completed', sources: { gamma: { status: 'incorporated' } } } } },
  })));
  w('shared/discussion/gamma.md', '# Discussion: Gamma\n');
  w('shared/specification/shared/specification.md', '# Specification: Shared\n');

  w('gone/manifest.json', json(unit('gone', 'feature', 'cancelled', { discussion: { items: { gone: { status: 'in-progress' } } } })));
  w('gone/discussion/gone.md', '# Discussion: Gone\n');
}

describe('migration 078: the move into the layout in .leeway/', () => {
  /** @type {string} */
  let dir;
  /** @type {string} */
  let state;
  /** @type {string} */
  let headBefore;
  /** @type {ReturnType<typeof run>} */
  let result;
  /** @type {ReturnType<typeof homes>} */
  let user;
  const read = (/** @type {string} */ rel) => fs.readFileSync(path.join(state, rel), 'utf8');
  const manifestOf = (/** @type {string} */ name) => JSON.parse(read(`${name}/manifest.json`));

  before(() => {
    dir = tempProject('migration-078-');
    write(dir, 'src/app.js', 'code\n');
    todaysProject(dir);
    commitAll(dir);
    headBefore = git(dir, ['rev-parse', 'HEAD']).trim();
    user = homes('today', USER_FOLDER, { 'conversations/s1/position.json': USER_FOLDER['conversations/s1/position.json'], 'conversations/s2/position.json': '{"at":"leeway"}\n', '.DS_Store': 'the engine side\'s own sidecar\n' });
    fs.chmodSync(path.join(user.old, 'credentials.json'), 0o600);
    result = run(dir);
    state = path.join(dir, '.leeway');
  });
  after(() => { cleanupFixture(dir); });

  describe('where it writes (E2, 21.9.3)', () => {
    it('adds the state worktree at .leeway/ on leeway-state, unborn, and locked as the engine locks it', () => {
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.throws(() => git(dir, ['rev-parse', '--verify', '--quiet', 'refs/heads/leeway-state']), 'the branch has no commit');
      assert.strictEqual(lockOf(dir, state), 'leeway state, do not remove');
    });

    it('commits nothing, stages nothing in the state, and leaves the default branch\'s .workflows/ as it was', () => {
      assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), headBefore);
      assert.strictEqual(git(state, ['ls-files']).trim(), '', 'nothing staged in the state worktree');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.claude/settings.json\n.gitignore\n.worktreeinclude', 'the project\'s own files, staged');
      assert.strictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all', '--', '.workflows', STORE]).trim(), '', '.workflows/ and the tracker\'s store as they were');
    });

    it('writes every file into a place the layout holds', () => {
      assert.deepStrictEqual(tree(state).filter((rel) => layoutPlace(rel) === null), []);
    });

    it('reports an update for the project and one for each unit, and hands back what it could not carry', () => {
      assert.deepStrictEqual({ updates: result.updates, skips: result.skips }, { updates: 9, skips: 0 });
      assert.deepStrictEqual(result.returned, {
        verify: 'These were not carried into .leeway/, the layout having no place for them: .workflows/.inbox/ideas/rough-notes.md, '
          + '.workflows/.roadmap/draft.txt, .workflows/.roadmap/notes/ideas/2026-01-03--points-expiry.md, '
          + '.workflows/core/discovery/briefs/zeta.md, .workflows/core/discussion/stray.md, '
          + '.workflows/core/experiment/exploration-superseded-2026-01-01-1200/E3-cache-size/report.md, '
          + '.workflows/core/notes.txt, .workflows/core/specification/search/order-tracking-notes.md, .workflows/scratch. '
          + 'Each stays in .workflows/ until the migration\'s commit; move any still wanted into its unit\'s assets/, or the product\'s.',
      });
    });
  });

  describe('the project (21.5.20, 21.11.2)', () => {
    it('carries the manifest with the project\'s id minted first, the linters on its environment as 073 keeps them, the baseline\'s status gone, its skip the brownfield offer\'s answer, and the roadmap\'s open session the product\'s conversation\'s', () => {
      const project = JSON.parse(read('manifest.json'));
      assert.match(project.project_id, /^[0-9A-Za-z]{21}$/);
      const { items } = PROJECT_MANIFEST.roadmap;
      assert.deepStrictEqual(project, {
        project_id: project.project_id,
        work_units: PROJECT_MANIFEST.work_units,
        defaults: { plan_format: 'sample-format' },
        roadmap: {
          horizons: ['v1'],
          items: {
            loyalty: { ...items.loyalty, sources: ['.product/sessions/session-001.md', '.product/assets/market.md'] },
            'points-expiry': { ...items['points-expiry'], sources: ['.product/notes/2026-01-03--points-expiry.md'] },
            alpha: { ...items.alpha, sources: ['core/topics/alpha/brief.md', 'core/topics/alpha/log.md', 'core/implementation/gone.md'] },
            exploration: { ...items.exploration, sources: ['core/discovery/session-003.md', 'shared/topics/gamma/log.md', 'core/topics/beta/mail/003-third.md'] },
          },
        },
        brownfield_offer: 'skipped',
        environment: { linters: [{ name: 'eslint', command: 'npx eslint .' }] },
        product_session: '002',
      });
      assert.strictEqual(Object.keys(project)[0], 'project_id');
    });

    it('carries the inbox and the environment setup as they are, and writes the state\'s own ignore file, ignoring the files the tracker\'s tool keeps local (7.5.4)', () => {
      assert.deepStrictEqual(tree(state, '.inbox').filter((rel) => !rel.startsWith('ideas/' + TODAY)), [
        '.archived/bugs/2026-01-02--old-crash.md', 'ideas/2026-02-01--dark-mode.md',
      ]);
      assert.strictEqual(read('.inbox/ideas/2026-02-01--dark-mode.md'), '# Dark mode\n');
      assert.strictEqual(read('.state/environment-setup.md'), 'No special setup required.\n');
      assert.strictEqual(read('.gitignore'), `${STATE_GITIGNORE}${PRE_LEEWAY.localFiles.join('\n')}\n`);
    });

    it('carries the tracker\'s store, found where the task driver says it lives, as it is, and none of its tool\'s local files (21.5.18)', () => {
      assert.strictEqual(read(STORE), STORE_LINES);
      assert.ok(!fs.existsSync(path.join(state, LOCAL)));
      assert.strictEqual(fs.readFileSync(path.join(dir, STORE), 'utf8'), STORE_LINES, 'the code tree\'s store left for finish to drop');
    });

    it('leaves the old cache and the old migrations record where they were, carrying neither (21.S17)', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/.cache/core/discussion/alpha/session.json'), 'utf8'), '{"live":true}\n');
      assert.deepStrictEqual(tree(state, '.cache'), [], 'no cache carried, no scratch file left');
      assert.ok(!fs.existsSync(path.join(state, '.state/migrations')));
    });
  });

  describe('the product (21.5.7, 21.11.1)', () => {
    it('makes .roadmap/ .product/: its sessions as they are, each note out of its kind\'s folder, its imports as assets, and the baseline\'s docs and its interview agendas, holding the person\'s answers, as reference there, its dossiers gone', () => {
      assert.deepStrictEqual(tree(state, '.product'), [
        'assets/baseline/agenda-auth.md',
        'assets/baseline/auth.md',
        'assets/baseline/billing.md',
        'assets/chart.png',
        'assets/market.md',
        'notes/2026-01-03--points-expiry.md',
        'sessions/session-001.md',
        'sessions/session-002.md',
      ]);
      assert.deepStrictEqual(fs.readFileSync(path.join(state, '.product/assets/chart.png')), PNG);
      assert.strictEqual(read('.product/assets/baseline/auth.md'), '# Auth\n\nSee [billing](billing.md).\n');
      assert.strictEqual(read('.product/assets/baseline/agenda-auth.md'), '# Agenda: Auth\n\n- Why sessions expire: the person said an hour, for the auditors.\n');
    });

    it('points the product\'s documents\' links into its imports at the assets, from where each now sits', () => {
      assert.strictEqual(read('.product/sessions/session-001.md'), '# Roadmap Session 001\n\nSee [market](../assets/market.md).\n');
      assert.strictEqual(read('.product/notes/2026-01-03--points-expiry.md'), '# Points expiry\n\nPer [market](../assets/market.md).\n');
    });

    it('points each roadmap item\'s sources at the new places, a unit\'s files among them, once each (21.S15)', () => {
      const { roadmap } = JSON.parse(read('manifest.json'));
      assert.deepStrictEqual(Object.fromEntries(Object.entries(roadmap.items).map(([name, item]) => [name, item.sources])), {
        loyalty: ['.product/sessions/session-001.md', '.product/assets/market.md'],
        'points-expiry': ['.product/notes/2026-01-03--points-expiry.md'],
        alpha: ['core/topics/alpha/brief.md', 'core/topics/alpha/log.md', 'core/implementation/gone.md'],
        exploration: ['core/discovery/session-003.md', 'shared/topics/gamma/log.md', 'core/topics/beta/mail/003-third.md'],
      });
      for (const source of [...roadmap.items.loyalty.sources, ...roadmap.items.alpha.sources.slice(0, 2), ...roadmap.items.exploration.sources]) assert.ok(fs.existsSync(path.join(state, source)), source);
    });
  });

  describe('the project\'s own files (21.5.19, 21.S52)', () => {
    it('names the engine by its new path in each settings hook and the state as .leeway/ in each permission rule, every other hook, rule and key as it was, staged', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), json(settings(NEW_ENGINE, '.leeway')));
      assert.strictEqual(git(dir, ['show', ':.claude/settings.json']), json(settings(NEW_ENGINE, '.leeway')));
    });

    it('takes the workflows\' lines out of .worktreeinclude, the person\'s kept, staged', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.worktreeinclude'), 'utf8'), '.env.local\n');
      assert.strictEqual(git(dir, ['show', ':.worktreeinclude']), '.env.local\n');
    });
  });

  describe('the user-level folder (21.5.19, P7, 21.S52)', () => {
    it('moves today\'s folder\'s contents into the engine\'s unchanged, beside what the engine already wrote there — a folder both hold merged where nothing in it differs — and leaves a link to it in its place', () => {
      assert.deepStrictEqual(tree(user.leeway), ['.DS_Store', 'config.json', 'conversations/s1/position.json', 'conversations/s2/position.json', 'credentials.json']);
      for (const [rel, content] of Object.entries(USER_FOLDER)) if (rel !== '.DS_Store') assert.strictEqual(fs.readFileSync(path.join(user.leeway, rel), 'utf8'), content, rel);
      assert.strictEqual(fs.statSync(path.join(user.leeway, 'credentials.json')).mode & 0o777, 0o600, 'the credentials kept private');
      assert.strictEqual(fs.readlinkSync(user.old), user.leeway);
      assert.strictEqual(fs.readFileSync(path.join(user.old, 'credentials.json'), 'utf8'), USER_FOLDER['credentials.json'], 'read through the link as today\'s skills read it');
    });

    it('finds the link already there for the machine\'s next project, and leaves it', () => {
      const next = tempProject('migration-078-next-');
      try {
        write(next, '.workflows/manifest.json', json({ work_units: {} }));
        commitAll(next);
        const { returned } = run(next);
        assert.strictEqual(returned, undefined);
        assert.strictEqual(fs.readlinkSync(user.old), user.leeway);
        assert.deepStrictEqual(tree(user.leeway), ['.DS_Store', 'config.json', 'conversations/s1/position.json', 'conversations/s2/position.json', 'credentials.json']);
      } finally {
        cleanupFixture(next);
      }
    });
  });

  describe('topics: logs, mail and experiments', () => {
    it('makes a topic\'s log its research then its discussion, each verbatim under its own heading (21.S10)', () => {
      assert.strictEqual(read('tally/topics/tally/log.md'),
        '## Research\n\n# Research: Tally\n\nCounting is hard.\n\n## Discussion\n\n# Discussion: Tally\n\nCounting is hard, the research said.\n');
    });

    it('joins a promoted topic\'s research to its log in the cross-cutting unit, ahead of its discussion, its links to the imports it came with (21.5.2)', () => {
      assert.strictEqual(read('shared/topics/gamma/log.md'),
        '## Research\n\n# Research: Gamma\n\nSee [notes](../../../core/assets/notes.md).\n\n## Discussion\n\n# Discussion: Gamma\n\n## Review review-003, never folded in\n\n### F1: Token reuse\n\nA token outlives its session.\n');
      assert.ok(!fs.existsSync(path.join(state, 'core/topics/gamma/log.md')), 'not in the epic');
    });

    it('folds each review the old agent store holds that landed and was never folded in into its topic\'s log, verbatim under a heading of its own, a promoted topic\'s from the unit it came from; one incorporated is not (21.5.12, 21.S19)', () => {
      const log = read('core/topics/alpha/log.md');

      assert.ok(log.endsWith('\n\n## Review review-001, never folded in\n\n### F1: Ranking ties\n\nTwo results of one age have no order.\n'), log);
      assert.ok(!log.includes('Folded in long ago.'), log);
    });

    it('makes a bugfix\'s investigation its topic\'s log (21.S11)', () => {
      assert.strictEqual(read('stall/topics/stall/log.md'), '## Investigation\n\n# Investigation: Stall\n\nThe queue stalls.\n');
    });

    it('joins research feeding one topic to its log, and sends research feeding several to a discovery session of its own after the last (21.S12, F10)', () => {
      assert.match(read('core/topics/alpha/log.md'), /^## Research\n\n# Research: Alpha\n[\s\S]*\n## Discussion\n\n# Discussion: Alpha\n/);
      assert.strictEqual(read('core/discovery/session-003.md'), [
        '# Discovery Session 003', '', `Date: ${TODAY}`, 'Work unit: core', '',
        'Written by the migration: the research below fed several topics, so it is kept here, on the unit\'s discovery log, until the cut and the merges place it where it bears.',
        '', '## Research: exploration-superseded-2026-01-01-1200', '', '# Research: Exploration', '', 'See ../assets/notes.md.', '',
      ].join('\n'));
    });

    it('moves a topic\'s mail from both its boxes into one sequence, renumbered, and keeps a single box\'s names (21.S13)', () => {
      assert.deepStrictEqual(
        ['001-first', '002-second', '003-third'].map((name) => read(`core/topics/beta/mail/${name}.md`)),
        [moved('First', 'Alpha'), moved('Second', 'Alpha'), moved('Third', 'Gamma')],
      );
      assert.strictEqual(read('core/topics/gamma/mail/004-late.md'), moved('Late', 'Alpha'));
    });

    it('heads each message moved with who sent it as the waiting mail does, the phase gone: a topic of the unit, another unit\'s topic with its unit, a single-topic unit by its name, any other origin as written (10.4.2)', () => {
      assert.deepStrictEqual(
        ['core/topics/gamma/mail/005-ranking-input.md', 'core/topics/gamma/mail/006-tally-input.md', 'stall/topics/stall/mail/001-retry-window.md'].map(read),
        [moved('Ranking input', 'Ranking, on Shop'), moved('Tally input', 'Tally'), moved('Retry window', 'Pay')],
      );
    });

    it('sends a cancelled topic\'s mail to the inbox as an idea, its first line the title, who sent it under it as the waiting mail heads it (21.S14, P5, 10.4.2)', () => {
      assert.deepStrictEqual(tree(state, '.inbox/ideas').filter((rel) => rel.startsWith(TODAY)), [`${TODAY}--a-dropped-thought.md`, `${TODAY}--cache-sizes.md`, `${TODAY}--theta-note.md`]);
      assert.strictEqual(read(`.inbox/ideas/${TODAY}--a-dropped-thought.md`),
        '# A dropped thought\nFrom Alpha · 1 Jan\n\nDetails of a dropped thought.\n');
    });

    it('sends the mail of a name no topic holds to the inbox as ideas, the same way', () => {
      assert.strictEqual(read(`.inbox/ideas/${TODAY}--cache-sizes.md`), '# Cache sizes\nFrom Alpha · 1 Jan\n\nDetails of cache sizes.\n');
    });

    it('leaves a brief, experiment records and a discussion under a name no topic holds behind, the experiments\' items with them', () => {
      assert.deepStrictEqual(tree(state, 'core/topics').map((rel) => rel.split('/')[0]).filter((name, i, all) => all.indexOf(name) === i), ['alpha', 'beta', 'epsilon', 'gamma', 'theta']);
      assert.deepStrictEqual(Object.keys(manifestOf('core').phases.experiment.items), ['alpha']);
    });

    it('moves a topic\'s experiment records, sub-experiments and data, into the topic\'s own folder (21.S43)', () => {
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/data/run.csv'), 'ms\n12\n');
      assert.strictEqual(fs.statSync(path.join(state, 'core/topics/alpha/experiments/E1-frame-budget/data/run.sh')).mode & 0o777, 0o755, 'a script kept executable');
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/problem.md'), '# Sub-problem\n');
    });
  });

  describe('an epic mid-discussion', () => {
    it('places every file it has a place for, and drops its analysis', () => {
      assert.deepStrictEqual(tree(state, 'core'), [
        'assets/diagram.png',
        'assets/notes.md',
        'assets/specs/search.md',
        'discovery/session-001.md',
        'discovery/session-002.md',
        'discovery/session-003.md',
        'manifest.json',
        'seeds/2026-01-01--search.md',
        'topics/alpha/brief.md',
        'topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/problem.md',
        'topics/alpha/experiments/E1-frame-budget/data/run.csv',
        'topics/alpha/experiments/E1-frame-budget/data/run.sh',
        'topics/alpha/experiments/E1-frame-budget/problem.md',
        'topics/alpha/experiments/E1-frame-budget/report.md',
        'topics/alpha/log.md',
        'topics/beta/mail/001-first.md',
        'topics/beta/mail/002-second.md',
        'topics/beta/mail/003-third.md',
        'topics/epsilon/log.md',
        'topics/gamma/mail/004-late.md', 'topics/gamma/mail/005-ranking-input.md', 'topics/gamma/mail/006-tally-input.md',
        'topics/theta/log.md',
      ]);
    });

    it('moves its brief into its topic, its sessions numbers kept, its seeds and imports as they are, an unbuilt spec as a reference asset', () => {
      assert.strictEqual(read('core/topics/alpha/brief.md'), '# Alpha brief\n\nFrom [notes](../../assets/notes.md).\n');
      assert.strictEqual(read('core/discovery/session-001.md'), '# Discovery Session 001\n');
      assert.strictEqual(read('core/seeds/2026-01-01--search.md'), '# Search\n');
      assert.deepStrictEqual(fs.readFileSync(path.join(state, 'core/assets/diagram.png')), PNG);
      assert.strictEqual(read('core/assets/specs/search.md'), '# Specification: Search\n\n[n](../notes.md)\n');
    });

    it('points every moved document\'s links into imports at the assets, from where the document now sits (21.5.7)', () => {
      assert.match(read('core/topics/alpha/log.md'), /Read \[notes\]\(\.\.\/\.\.\/assets\/notes\.md\) and !\[d\]\(\.\.\/\.\.\/assets\/diagram\.png\), not \[code\]\(\.\.\/imports\/util\.js\)\./, 'a link to a name no import holds left as written');
      assert.match(read('core/discovery/session-002.md'), /See \[notes\]\(\.\.\/assets\/notes\.md\)\./);
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/problem.md'), '# Problem\n\nAgainst [notes](../../../../assets/notes.md).\n');
    });

    it('writes today\'s manifest less research and the retired state, the carried-over fields kept (21.S16)', () => {
      assert.deepStrictEqual(manifestOf('core'), {
        name: 'core',
        work_type: 'epic',
        status: 'in-progress',
        description: 'The core',
        created: '2026-01-01',
        seeds: [{ path: 'seeds/2026-01-01--search.md', source: 'inbox' }],
        imports: [
          { path: 'assets/notes.md', imported_at: '2026-01-02T10:00:00Z', origin: 'discussion/alpha' },
          { path: 'assets/diagram.png', imported_at: '2026-01-02T10:00:00Z', origin: 'discovery' },
        ],
        phases: {
          discovery: {
            active_session: '002',
            items: {
              alpha: { source: 'discovery', summary: 'Alpha', order: 1 },
              beta: { source: 'message:alpha', summary: 'Beta', order: 2 },
              gamma: { source: 'discovery', summary: 'Gamma' },
              delta: { source: 'discovery', summary: 'Delta', cancelled: true, previous_order: 4 },
              epsilon: { source: 'discovery', summary: 'Epsilon' },
              eta: { source: 'discovery', summary: 'Eta', postponed: true },
              theta: { source: 'discovery', summary: 'Theta' },
              iota: { source: 'discovery', summary: 'Iota' },
            },
          },
          discussion: {
            items: {
              alpha: { status: 'completed' },
              beta: { status: 'unstarted' },
              gamma: { status: 'promoted', promoted_to: 'shared' },
              delta: { status: 'cancelled' },
              epsilon: { status: 'in-progress', awaiting_experiments: ['E2'] },
              eta: { status: 'postponed', previous_status: 'in-progress' },
              theta: { status: 'cancelled' },
              iota: { status: 'unstarted' },
            },
          },
          experiment: { items: { alpha: CORE.phases.experiment.items.alpha } },
          specification: { items: { search: { status: 'in-progress', reconcile_needed: 'discussion', sources: { alpha: { status: 'incorporated' } } }, old: { status: 'cancelled', sources: {} } } },
        },
      });
      assert.strictEqual(read('core/manifest.json'), json(manifestOf('core')), 'in the engine\'s serialisation');
    });

    it('drops every discussion\'s reconcile flag, whatever it holds, carries none from research, and keeps a later phase\'s', () => {
      assert.deepStrictEqual(
        Object.entries(manifestOf('core').phases.discussion.items).filter(([, item]) => 'reconcile_needed' in item).map(([topic]) => topic),
        [],
      );
      assert.strictEqual(manifestOf('core').phases.specification.items.search.reconcile_needed, 'discussion');
    });
  });

  describe('an epic whose building started (21.S49)', () => {
    it('keeps its sessions, puts its plans and review folders in its assets with their files\' names, leaves its built spec for the cut, and drops implementation and tracking', () => {
      assert.deepStrictEqual(tree(state, 'shop'), [
        'assets/plans/event-tracking/planning.md',
        'assets/plans/event-tracking/tasks/event-tracking-1-1.md',
        'assets/plans/ranking/phase-1-tasks.md',
        'assets/plans/ranking/planning.md',
        'assets/plans/ranking/tasks/ranking-1-1.md',
        'assets/plans/usage-analysis/usage-analysis-1-1.md',
        'assets/reviews/ranking/change-set-c1-ranking.md',
        'assets/reviews/ranking/change-set-c2-order-tracking.md',
        'assets/reviews/ranking/change-set-c3-cost-analysis.md',
        'assets/reviews/ranking/report-1-1.md',
        'assets/reviews/ranking/report.md',
        'assets/reviews/usage-analysis/report-1-1.md',
        'assets/sketch.md',
        'discovery/session-001.md',
        'manifest.json',
        'topics/event-tracking/log.md',
        'topics/ranking/log.md',
      ]);
    });

    it('drops staging, review cycles, plan review tracking and dependencies, keeping the build\'s standing', () => {
      assert.deepStrictEqual(manifestOf('shop').phases, {
        discovery: { items: { ranking: { source: 'discovery', summary: 'Ranking' } } },
        discussion: { items: { ranking: { status: 'completed' }, 'event-tracking': { status: 'completed' }, 'usage-analysis': { status: 'completed' } } },
        specification: { items: { ranking: { status: 'completed', sources: { ranking: { status: 'incorporated' } } } } },
        planning: { items: { ranking: { status: 'completed', format: 'sample-format', phase: 2, task: 1, task_map: { 'ranking-1-1': 'ext-a1' }, storage_paths: ['.tracker'] } } },
        implementation: { items: { ranking: { status: 'in-progress', current_phase: 2, current_task: 'ranking-2-1', completed_tasks: ['ranking-1-1'], bank: [{ finding: 'later' }] } } },
        review: { items: { ranking: { status: 'in-progress', reviewed_tasks: ['ranking-1-1'] } } },
      });
    });
  });

  describe('quick-fixes, and a cancelled unit', () => {
    it('makes a completed quick-fix\'s spec its summary, its plan, its spec and plan items and scoping gone (21.S45)', () => {
      assert.deepStrictEqual(tree(state, 'typo'), ['manifest.json', 'summary.md']);
      assert.strictEqual(read('typo/summary.md'), '# Typo\n\nFix the typo in the header.\n');
      assert.deepStrictEqual(manifestOf('typo').phases, { implementation: { items: { typo: { status: 'completed' } } } });
    });

    it('keeps a quick-fix being built\'s spec and plan as reference assets, and their items less the retired state', () => {
      assert.deepStrictEqual(tree(state, 'patch'), ['assets/plans/patch/planning.md', 'assets/specs/patch.md', 'manifest.json']);
      assert.deepStrictEqual(manifestOf('patch').phases, {
        specification: { items: { patch: { status: 'completed' } } },
        planning: { items: { patch: quickFixPlan('patch') } },
        implementation: { items: { patch: { status: 'in-progress' } } },
      });
    });

    it('drops every tracking and analysis file by its whole name, the review reports and the person\'s files named for tracking or analysis kept (21.S46)', () => {
      const moved = tree(state).filter((rel) => !rel.startsWith('.'));
      assert.deepStrictEqual(moved.filter((rel) => /tracking|analysis/.test(rel)), [
        'shop/assets/plans/event-tracking/planning.md',
        'shop/assets/plans/event-tracking/tasks/event-tracking-1-1.md',
        'shop/assets/plans/usage-analysis/usage-analysis-1-1.md',
        'shop/assets/reviews/ranking/change-set-c2-order-tracking.md',
        'shop/assets/reviews/ranking/change-set-c3-cost-analysis.md',
        'shop/assets/reviews/usage-analysis/report-1-1.md',
        'shop/topics/event-tracking/log.md',
      ]);
      assert.ok(moved.includes('shop/assets/reviews/ranking/report.md'));
    });

    it('neither carries nor names the files the person\'s tools leave beside theirs', () => {
      assert.ok(!fs.existsSync(path.join(state, 'shop/assets/.DS_Store')));
      assert.doesNotMatch(String(result.returned && result.returned.verify), /Thumbs\.db|\.DS_Store/);
    });

    it('moves a cancelled unit as any other, its status cancelled (21.5.14)', () => {
      assert.deepStrictEqual(tree(state, 'gone'), ['manifest.json', 'topics/gone/log.md']);
      assert.strictEqual(manifestOf('gone').status, 'cancelled');
    });
  });
});

describe('migration 078: a small project', () => {
  /** @type {string} */
  let dir;
  const feature = (at = dir, standing = 'in-progress') => {
    write(at, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' } } }));
    write(at, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: standing } } } })));
    write(at, '.workflows/tally/discussion/tally.md', '# Discussion: Tally\n');
    write(at, '.workflows/tally/discussion/.mailbox/tally/001-dropped.md', message('Dropped', 'pay'));
    commitAll(dir);
  };
  const DROPPED_IDEA = '# Dropped\nFrom Pay · 1 Jan\n\nDetails of dropped.\n';
  before(() => { homes('none'); });

  /** The project manifest the move wrote, from the project at `dir`. */
  const movedProject = () => JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'));

  it('keeps a native or completed baseline as the brownfield offer\'s answer, in today\'s words, and none for a baseline under way, the status fields gone either way (21.11.2, 8.12.11)', () => {
    const cases = /** @type {const} */ ([['native', { brownfield_offer: 'native' }], ['completed', { brownfield_offer: 'completed' }], ['in-progress', {}]]);
    for (const [status, answer] of cases) {
      dir = tempProject(`migration-078-baseline-${status}-`);
      try {
        write(dir, '.workflows/manifest.json', json({ work_units: {}, baseline: { status, areas: { auth: 'completed', billing: 'pending' } } }));
        commitAll(dir);
        run(dir);
        const { project_id: _id, ...project } = movedProject();
        assert.deepStrictEqual(project, { work_units: {}, ...answer }, status);
      } finally {
        cleanupFixture(dir);
      }
    }
  });

  it('removes a .worktreeinclude that held only the workflows\' lines, the removal staged; renames the permission rules of settings holding no hook of the engine\'s, staged; ignores no tracker\'s files where there is no store; and makes no user-level folder or link where today\'s skills left none', () => {
    dir = tempProject('migration-078-include-');
    const user = homes('none');
    try {
      write(dir, '.worktreeinclude', '.workflows/.knowledge/store.bin\n\n.workflows/.knowledge/config.json\n');
      write(dir, '.claude/settings.json', json({ permissions: { allow: ['Edit(.workflows/**)'] } }));
      feature();
      run(dir);
      assert.ok(!fs.existsSync(path.join(dir, '.worktreeinclude')));
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), json({ permissions: { allow: ['Edit(.leeway/**)'] } }));
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-status']).trim(), 'M\t.claude/settings.json\nA\t.gitignore\nD\t.worktreeinclude');
      assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/.gitignore'), 'utf8'), STATE_GITIGNORE);
      assert.deepStrictEqual([fs.existsSync(user.old), fs.existsSync(user.leeway)], [false, false]);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('takes the dead end off every topic: a decided one, and a research umbrella whose content went to other discussions (043), keep their conclusion; any other is cancelled, no decision written, its mail an idea in the inbox (21.5.22, P4)', () => {
    dir = tempProject('migration-078-dead-ends-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { lab: { work_type: 'epic' } } }));
      write(dir, '.workflows/lab/manifest.json', json(unit('lab', 'epic', 'in-progress', {
        discovery: {
          items: {
            settled: { routing: 'discussion', source: 'discovery', summary: 'Settled', order: 1, handled: true },
            umbrella: { routing: 'research', source: 'migration-seeded', summary: 'Umbrella', order: 2, handled: true },
            stalled: { routing: 'discussion', source: 'discovery', summary: 'Stalled', order: 3, handled: true },
            spun: { routing: 'discussion', source: 'discovery', summary: 'Spun', order: 4 },
          },
        },
        research: { items: { umbrella: { status: 'completed' } } },
        discussion: { items: { settled: { status: 'completed' }, stalled: { status: 'in-progress' }, spun: { status: 'completed' } } },
      })));
      write(dir, '.workflows/lab/research/umbrella.md', '# Research: Umbrella\n');
      for (const topic of ['settled', 'stalled', 'spun']) write(dir, `.workflows/lab/discussion/${topic}.md`, `# Discussion: ${topic}\n`);
      write(dir, '.workflows/lab/discussion/.mailbox/stalled/001-late-word.md', message('Late word', 'spun'));
      commitAll(dir);
      run(dir);
      const { phases } = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/lab/manifest.json'), 'utf8'));
      assert.deepStrictEqual(phases.discovery.items, {
        settled: { source: 'discovery', summary: 'Settled', order: 1 },
        umbrella: { source: 'migration-seeded', summary: 'Umbrella', order: 2 },
        stalled: { source: 'discovery', summary: 'Stalled', cancelled: true, previous_order: 3 },
        spun: { source: 'discovery', summary: 'Spun', order: 4 },
      });
      assert.deepStrictEqual(phases.discussion.items, {
        settled: { status: 'completed' },
        stalled: { status: 'cancelled', previous_status: 'in-progress' },
        spun: { status: 'completed' },
        umbrella: { status: 'completed' },
      });
      assert.strictEqual(fs.readFileSync(path.join(dir, `.leeway/.inbox/ideas/${TODAY}--late-word.md`), 'utf8'), '# Late word\nFrom Spun · 1 Jan\n\nDetails of late word.\n');
      assert.deepStrictEqual(tree(path.join(dir, '.leeway'), 'lab/topics/stalled'), ['log.md']);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('leaves settings that do not parse as they are, and says so', () => {
    dir = tempProject('migration-078-settings-');
    try {
      write(dir, '.claude/settings.json', `{ "hooks": ${OLD_ENGINE}`);
      feature();
      const { returned } = run(dir);
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), `{ "hooks": ${OLD_ENGINE}`);
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.gitignore');
      assert.deepStrictEqual(returned, {
        verify: `${dir}/.claude/settings.json does not parse, so it was left naming the engine at .claude/skills/workflow-engine/scripts/engine.cjs and the state at .workflows/: `
          + 'once it parses, name .claude/skills/leeway-engine/scripts/engine.cjs in each hook and .leeway/ in each permission rule.',
      });
    } finally {
      cleanupFixture(dir);
    }
  });

  it('moves nothing of the old user-level folder where the engine\'s holds a different copy of any file, even down a folder both hold, naming every clash; a copy the same byte for byte no clash', () => {
    dir = tempProject('migration-078-clash-');
    const fresh = { 'config.json': '{"provider":"ollama"}\n', 'credentials.json': USER_FOLDER['credentials.json'], 'conversations/s1/position.json': '{"at":"elsewhere"}\n' };
    const user = homes('clash', USER_FOLDER, fresh);
    try {
      feature();
      const { returned } = run(dir);
      assert.deepStrictEqual(Object.fromEntries(tree(user.old).map((rel) => [rel, fs.readFileSync(path.join(user.old, rel), 'utf8')])), USER_FOLDER, 'the old folder whole, and readable where it was');
      assert.ok(fs.lstatSync(user.old).isDirectory(), 'a folder still, never a link');
      assert.deepStrictEqual(Object.fromEntries(tree(user.leeway).map((rel) => [rel, fs.readFileSync(path.join(user.leeway, rel), 'utf8')])), fresh);
      assert.deepStrictEqual(returned, {
        verify: `Nothing in ${user.old} was moved: ${user.leeway} already holds a different config.json, conversations/s1/position.json. `
          + `${user.old} stays as it is, so a project still on today's skills reads it there; once each is settled, the next project's move compares them again.`,
      });
    } finally {
      homes('none');
      cleanupFixture(dir);
    }
  });

  it('moves nothing of an old user-level folder that is a link elsewhere, and says so', () => {
    dir = tempProject('migration-078-dotfiles-');
    const user = homes('dotfiles');
    const dotfiles = path.join(HOMES, 'dotfiles', 'dotfiles-workflows');
    try {
      write(dotfiles, 'config.json', USER_FOLDER['config.json']);
      fs.symlinkSync(dotfiles, user.old);
      feature();
      const { returned } = run(dir);
      assert.deepStrictEqual([fs.readlinkSync(user.old), tree(dotfiles), fs.existsSync(user.leeway)], [dotfiles, ['config.json'], false]);
      assert.deepStrictEqual(returned, {
        verify: `${user.old} is a link to ${dotfiles}, not a folder of its own, so nothing in it was moved to ${user.leeway}: move what the workflows keep there into ${user.leeway} yourself.`,
      });
    } finally {
      homes('none');
      cleanupFixture(dir);
    }
  });


  it('puts the runner\'s record and journals, written in a plain .leeway/ before the move, inside the state worktree, the journals ignored', () => {
    dir = tempProject('migration-078-record-');
    try {
      feature();
      write(dir, '.leeway/.state/migrations', '001\n073\n');
      write(dir, '.leeway/.cache/migrate/pending-tally.json', '{"ran":["073"]}\n');
      run(dir);
      const state = path.join(dir, '.leeway');
      assert.strictEqual(fs.readFileSync(path.join(state, '.state/migrations'), 'utf8'), '001\n073\n');
      assert.strictEqual(fs.readFileSync(path.join(state, '.cache/migrate/pending-tally.json'), 'utf8'), '{"ran":["073"]}\n');
      assert.doesNotThrow(() => git(state, ['check-ignore', '--quiet', '.cache/migrate/pending-tally.json']), 'the journal ignored in the state');
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.ok(!fs.existsSync(path.join(dir, '.leeway-set-aside')));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('run again over a move cut short — the worktree added but not locked, part written — writes the whole state, locked, its project id, idea and ignore line kept', () => {
    dir = tempProject('migration-078-again-');
    try {
      feature(dir, 'cancelled');
      const state = path.join(dir, '.leeway');
      git(dir, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', '.leeway', 'HEAD']);
      git(state, ['switch', '--quiet', '--orphan', 'leeway-state']);
      write(state, 'manifest.json', json({ project_id: 'CutShort0123456789abc', work_units: {} }));
      write(state, `.inbox/ideas/${TODAY}--dropped.md`, DROPPED_IDEA);
      write(state, 'tally/topics/tally/log.md', '## Disc');
      write(dir, '.gitignore', '.leeway/\n');
      run(dir);
      assert.deepStrictEqual(tree(state).filter((rel) => rel !== '.git'), [
        '.gitignore', `.inbox/ideas/${TODAY}--dropped.md`, 'manifest.json', 'tally/manifest.json', 'tally/topics/tally/log.md',
      ]);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8')),
        { project_id: 'CutShort0123456789abc', work_units: { tally: { work_type: 'feature' } } });
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n# Discussion: Tally\n');
      assert.strictEqual(fs.readFileSync(path.join(state, `.inbox/ideas/${TODAY}--dropped.md`), 'utf8'), DROPPED_IDEA);
      assert.strictEqual(lockOf(dir, state), 'leeway state, do not remove');
      assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.leeway/\n', 'the ignore line written once');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.gitignore');
      const whole = Object.fromEntries(tree(state).map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')]));
      run(dir);
      assert.deepStrictEqual(Object.fromEntries(tree(state).map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')])), whole, 'run again over a whole move, its worktree locked, the same state');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('moves a project nested in its repository from its own folder, the state at the main checkout and the ignore line in the project\'s .gitignore, staged', () => {
    dir = tempProject('migration-078-nested-');
    try {
      write(dir, 'README.md', 'the repository\n');
      const app = path.join(dir, 'app');
      feature(app);
      const { updates, skips } = run(app);
      const state = path.join(dir, '.leeway');
      assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n# Discussion: Tally\n');
      assert.ok(!fs.existsSync(path.join(app, '.leeway')), 'no state in the project folder');
      assert.strictEqual(fs.readFileSync(path.join(app, '.gitignore'), 'utf8'), '.leeway/\n');
      assert.ok(!fs.existsSync(path.join(dir, '.gitignore')), 'the repository\'s top untouched');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'app/.gitignore');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('run from a linked worktree, moves the main checkout\'s copy and stages the ignore line there, saying so where the worktree\'s copy differs (21.5.11)', () => {
    dir = tempProject('migration-078-linked-');
    const linked = `${dir}-wt`;
    const branchCopy = path.join(linked, 'app/.workflows/tally/discussion/tally.md');
    try {
      write(dir, 'README.md', 'the repository\n');
      feature(path.join(dir, 'app'));
      git(dir, ['worktree', 'add', '--quiet', '-b', 'feat', linked]);
      fs.writeFileSync(branchCopy, '# Discussion: Tally, as the branch has it\n');
      const { returned } = run(path.join(linked, 'app'));
      assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n# Discussion: Tally\n');
      assert.strictEqual(fs.readFileSync(path.join(dir, 'app/.gitignore'), 'utf8'), '.leeway/\n');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'app/.gitignore');
      assert.ok(!fs.existsSync(path.join(linked, 'app/.gitignore')), 'the worktree\'s branch untouched');
      assert.strictEqual(git(linked, ['diff', '--cached', '--name-only']).trim(), '');
      assert.deepStrictEqual(returned, {
        verify: `The move took .workflows/ from the main checkout, ${dir}/app, the copy it leaves the default branch from; the worktree it ran in, ${linked}/app, on feat, `
          + 'holds a .workflows/ that differs, and what differs there was not moved.',
      });
      fs.writeFileSync(branchCopy, '# Discussion: Tally\n');
      assert.strictEqual(run(path.join(linked, 'app')).returned, undefined, 'nothing to say where the copies match');
    } finally {
      cleanupFixture(linked);
      cleanupFixture(dir);
    }
  });

  it('run again after the person removed a cut-short .leeway/, clears the registration it left and adds the worktree again', () => {
    dir = tempProject('migration-078-removed-');
    try {
      feature();
      run(dir);
      fs.rmSync(path.join(dir, '.leeway'), { recursive: true, force: true });
      write(dir, '.leeway/.state/migrations', '001\n073\n');
      run(dir);
      const state = path.join(dir, '.leeway');
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.strictEqual(lockOf(dir, state), 'leeway state, do not remove');
      assert.strictEqual(fs.readFileSync(path.join(state, '.state/migrations'), 'utf8'), '001\n073\n');
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n# Discussion: Tally\n');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('writes the project manifest whole or not at all, so a run killed mid-write is run again', () => {
    dir = tempProject('migration-078-torn-');
    const realWrite = fs.writeFileSync;
    try {
      feature();
      fs.writeFileSync = (/** @type {any} */ file, /** @type {any} */ content, /** @type {any[]} */ ...rest) => {
        if (!String(content).includes('"project_id"')) return realWrite(file, content, ...rest);
        realWrite(file, String(content).slice(0, 12));
        throw new Error('killed mid-write');
      };
      assert.throws(() => run(dir), /killed mid-write/);
      fs.writeFileSync = realWrite;
      run(dir);
      assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'))), ['project_id', 'work_units']);
    } finally {
      fs.writeFileSync = realWrite;
      cleanupFixture(dir);
    }
  });

  it('aborts, writing nothing, while a merge is stopped in the main checkout, as boot waits these out', () => {
    dir = tempProject('migration-078-stopped-');
    try {
      write(dir, 'README.md', 'one\n');
      feature();
      const base = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      git(dir, ['switch', '--quiet', '-c', 'other']);
      write(dir, 'README.md', 'two\n');
      commitAll(dir);
      git(dir, ['switch', '--quiet', base]);
      write(dir, 'README.md', 'three\n');
      commitAll(dir);
      assert.throws(() => git(dir, ['merge', '--quiet', 'other']), 'the merge stops on its conflict');
      assert.throws(() => run(dir), /^Error: a merge \(MERGE_HEAD\) is stopped in .* — finish or abort it, then start again$/);
      assert.ok(!fs.existsSync(path.join(dir, '.leeway')));
      assert.ok(!fs.existsSync(path.join(dir, '.gitignore')));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('ignores .leeway/ in the code tree\'s .gitignore, staged alone, with hooks off and the caller\'s git environment cleared', () => {
    dir = tempProject('migration-078-code-');
    const decoy = tempProject('migration-078-decoy-');
    const marker = path.join(decoy, 'hook-ran');
    try {
      write(dir, '.gitignore', 'node_modules/');
      write(dir, 'src/app.js', 'code\n');
      feature();
      write(dir, 'src/app.js', 'code, edited\n');
      write(dir, '.git/hooks/post-checkout', `#!/bin/sh\ntouch "${marker}"\n`);
      fs.chmodSync(path.join(dir, '.git/hooks/post-checkout'), 0o755);
      write(decoy, 'README.md', 'decoy\n');
      commitAll(decoy);
      const held = process.env.GIT_DIR;
      process.env.GIT_DIR = path.join(decoy, '.git');
      let counts;
      let during;
      try {
        counts = run(dir);
        during = process.env.GIT_DIR;
      } finally {
        if (held === undefined) delete process.env.GIT_DIR;
        else process.env.GIT_DIR = held;
      }
      assert.deepStrictEqual({ updates: counts.updates, skips: counts.skips }, { updates: 2, skips: 0 });
      assert.strictEqual(during, path.join(decoy, '.git'), 'the caller\'s environment put back');
      assert.strictEqual(git(path.join(dir, '.leeway'), ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.ok(!fs.existsSync(marker), 'no hook ran');
      assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules/\n.leeway/\n');
      assert.deepStrictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).sort(), [' M src/app.js', 'M  .gitignore']);
    } finally {
      cleanupFixture(dir);
      cleanupFixture(decoy);
    }
  });

  it('skips a project whose leeway-state has a commit already, its state written over by nothing', () => {
    dir = tempProject('migration-078-born-');
    try {
      feature();
      run(dir);
      const state = path.join(dir, '.leeway');
      git(state, ['add', '-A']);
      git(state, ['commit', '-q', '-m', 'the migration\'s commit']);
      write(state, 'manifest.json', json({ project_id: 'kept' }));
      const { updates, skips } = run(dir);
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8')), { project_id: 'kept' });
    } finally {
      cleanupFixture(dir);
    }
  });

  it('skips a project with no .workflows/, writing nothing', () => {
    dir = tempProject('migration-078-none-');
    try {
      write(dir, 'src/app.js', 'code\n');
      commitAll(dir);
      const { updates, skips, returned } = run(dir);
      assert.deepStrictEqual({ updates, skips, returned }, { updates: 0, skips: 1, returned: undefined });
      assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['.git', 'src']);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('skips a folder in no repository, writing nothing', () => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-078-bare-')));
    try {
      write(dir, '.workflows/manifest.json', json({}));
      const { updates, skips } = run(dir);
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      assert.deepStrictEqual(fs.readdirSync(dir), ['.workflows']);
    } finally {
      cleanupFixture(dir);
    }
  });
});
