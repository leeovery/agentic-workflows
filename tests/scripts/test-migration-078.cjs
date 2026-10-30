'use strict';

//
// Tests for migration 078: reshape-move (.cjs)
//
// The reshape's move (21.5) driven in process against a git project whose
// `.workflows/` is today's shape, committed: an epic mid-discussion, an epic
// whose building started, a feature, a bugfix, a completed quick-fix, a
// quick-fix being built and a cancelled unit, with the project's inbox,
// environment setup, cache and old migrations record beside them. The move
// runs once over that project, and each test reads one rule off what it
// left: the state worktree on an unborn `leeway-state`, locked, with nothing
// committed, nothing staged but the code tree's `.gitignore`, and
// `.workflows/` untouched; each unit's files in the layout, a person's files
// named for tracking or analysis kept beside the reviews' tracking files
// dropped; its manifest less research and the retired state; the project's
// manifest with its id; the files the layout has no place for, named, the
// tools' sidecars not. A small project of its own covers the runner's record
// already in `.leeway/`, the `.leeway/` ignore line staged with hooks off and
// the caller's git environment cleared, the move run again, and the projects
// with nothing to move.
//

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');

const TODAY = new Date().toISOString().slice(0, 10);
const json = (/** @type {unknown} */ value) => JSON.stringify(value, null, 2) + '\n';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

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

/** @param {string} dir */
function run(dir) {
  const counts = { updates: 0, skips: 0 };
  const returned = MIGRATION.run({ projectDir: dir, reportUpdate: () => { counts.updates += 1; }, reportSkip: () => { counts.skips += 1; } });
  return { ...counts, returned };
}

/** A message as today's send writes it. @param {string} title @param {string} from */
const message = (title, from) => `### ${title}\n*From: ${from} · discussion · 2026-01-01*\n\nDetails of ${title.toLowerCase()}.\n`;

const PROJECT_MANIFEST = {
  work_units: {
    core: { work_type: 'epic' }, shop: { work_type: 'epic' }, tally: { work_type: 'feature' }, stall: { work_type: 'bugfix' },
    typo: { work_type: 'quick-fix' }, patch: { work_type: 'quick-fix' }, gone: { work_type: 'feature' },
  },
  defaults: { plan_format: 'tick', linters: [{ name: 'eslint', command: 'npx eslint .' }] },
  roadmap: { horizons: ['v1'], items: { loyalty: { horizon: 'v1', summary: 'rewards', kind: 'idea', origin: 'harvest' } } },
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
      },
    },
    research: {
      items: {
        alpha: { status: 'in-progress', reconcile_needed: 'experiment', threads: { why: { question: 'Why?', status: 'learned', origin: 'seed' } } },
        epsilon: { status: 'in-progress', awaiting_experiments: ['E2'] },
        eta: { status: 'postponed', previous_status: 'completed' },
        'exploration-superseded-2026-01-01-1200': { status: 'superseded' },
      },
    },
    discussion: {
      analysis_cache: { checksum: 'abc', generated: '2026-01-03' },
      items: {
        alpha: { status: 'completed' },
        beta: { status: 'unstarted' },
        gamma: { status: 'promoted', promoted_to: 'shared' },
        delta: { status: 'cancelled' },
      },
    },
    experiment: { items: { alpha: { status: 'completed', experiments: { E1: { slug: 'frame-budget', status: 'concluded', verdict: 'fits' } } } } },
    specification: {
      build_order_stale: true,
      items: {
        search: {
          status: 'in-progress', order: 1, review_cycle: 2, tracking: { 'review-input-tracking-c1.md': 'open' },
          sources: { alpha: { status: 'incorporated' } },
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
          status: 'completed', format: 'tick', phase: 2, task: 1, review_cycle: 1, review_baseline_words: 900,
          approvals: { structure: true }, tracking: { 'review-integrity-tracking-c1.md': 'done' },
          external_dependencies: { core: { state: 'resolved', description: 'search' } },
          staging: { 'author-p1': { tasks: { 1: 'approved' } } },
          task_map: { 'ranking-1-1': 'tick-a1' }, storage_paths: ['.tick'],
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

/** @param {string} dir */
function todaysProject(dir) {
  const w = (/** @type {string} */ rel, /** @type {string|Buffer} */ content) => write(dir, `.workflows/${rel}`, content);
  w('manifest.json', json(PROJECT_MANIFEST));
  w('.inbox/ideas/2026-02-01--dark-mode.md', '# Dark mode\n');
  w('.inbox/.archived/bugs/2026-01-02--old-crash.md', '# Old crash\n');
  w('.state/environment-setup.md', 'No special setup required.\n');
  w('.state/migrations', '001\n072\n');
  w('.cache/core/discussion/alpha/session.json', '{"live":true}\n');
  w('scratch/notes.txt', 'a folder that is no unit\n');
  w('Thumbs.db', 'sidecar\n');

  w('core/manifest.json', json(CORE));
  w('core/discovery/sessions/session-001.md', '# Discovery Session 001\n');
  w('core/discovery/sessions/session-002.md', '# Discovery Session 002\n\nSee [notes](../../imports/notes.md).\n');
  w('core/discovery/briefs/alpha.md', '# Alpha brief\n\nFrom [notes](../../imports/notes.md).\n');
  w('core/research/alpha.md', '# Research: Alpha\n\nRead [notes](../imports/notes.md) and ![d](../imports/diagram.png), not [code](../imports/util.js).\n');
  w('core/research/epsilon.md', '# Research: Epsilon\n');
  w('core/research/exploration-superseded-2026-01-01-1200.md', '# Research: Exploration\n\nSee ../imports/notes.md.\n');
  w('core/discussion/alpha.md', '# Discussion: Alpha\n\nThe research said so, and so do we.\n');
  w('core/research/.mailbox/beta/001-first.md', message('First', 'alpha'));
  w('core/research/.mailbox/beta/002-second.md', message('Second', 'alpha'));
  w('core/discussion/.mailbox/beta/001-third.md', message('Third', 'gamma'));
  w('core/discussion/.mailbox/gamma/004-late.md', message('Late', 'alpha'));
  w('core/discussion/.mailbox/delta/001-a-dropped-thought.md', message('A dropped thought', 'alpha'));
  w('core/experiment/alpha/E1-frame-budget/problem.md', '# Problem\n\nAgainst [notes](../../../imports/notes.md).\n');
  w('core/experiment/alpha/E1-frame-budget/report.md', '# Report\n');
  w('core/experiment/alpha/E1-frame-budget/data/run.csv', 'ms\n12\n');
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

  w('typo/manifest.json', json(unit('typo', 'quick-fix', 'completed', {
    scoping: { items: { typo: { status: 'completed' } } },
    implementation: { items: { typo: { status: 'completed' } } },
  })));
  w('typo/specification/typo/specification.md', '# Typo\n\nFix the typo in the header.\n');
  w('typo/planning/typo/planning.md', '# Plan: Typo\n');

  w('patch/manifest.json', json(unit('patch', 'quick-fix', 'in-progress', {
    scoping: { items: { patch: { status: 'completed' } } },
    implementation: { items: { patch: { status: 'in-progress' } } },
  })));
  w('patch/specification/patch/specification.md', '# Patch\n');
  w('patch/planning/patch/planning.md', '# Plan: Patch\n');

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
  const read = (/** @type {string} */ rel) => fs.readFileSync(path.join(state, rel), 'utf8');
  const manifestOf = (/** @type {string} */ name) => JSON.parse(read(`${name}/manifest.json`));

  before(() => {
    dir = tempProject('migration-078-');
    write(dir, 'src/app.js', 'code\n');
    todaysProject(dir);
    commitAll(dir);
    headBefore = git(dir, ['rev-parse', 'HEAD']).trim();
    result = run(dir);
    state = path.join(dir, '.leeway');
  });
  after(() => { cleanupFixture(dir); });

  describe('where it writes (E2, 21.9.3)', () => {
    it('adds the state worktree at .leeway/ on leeway-state, unborn, and locked as the engine locks it', () => {
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.throws(() => git(dir, ['rev-parse', '--verify', '--quiet', 'refs/heads/leeway-state']), 'the branch has no commit');
      const listed = git(dir, ['worktree', 'list', '--porcelain']).split('\n\n').find((block) => block.startsWith(`worktree ${state}\n`));
      assert.match(String(listed), /^locked leeway state, do not remove$/m);
    });

    it('commits nothing, stages nothing in the state, and leaves the default branch\'s .workflows/ as it was', () => {
      assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), headBefore);
      assert.strictEqual(git(state, ['ls-files']).trim(), '', 'nothing staged in the state worktree');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.gitignore', 'the code tree\'s one staged change');
      assert.strictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all', '--', '.workflows']).trim(), '');
    });

    it('reports an update for the project and one for each unit, and hands back what it could not carry', () => {
      assert.deepStrictEqual({ updates: result.updates, skips: result.skips }, { updates: 8, skips: 0 });
      assert.deepStrictEqual(result.returned, {
        verify: 'These were not carried into .leeway/, the layout having no place for them: .workflows/core/notes.txt, .workflows/core/specification/search/order-tracking-notes.md, .workflows/scratch. '
          + 'Each stays in .workflows/ until the migration\'s commit; move any still wanted into its unit\'s assets/.',
      });
    });
  });

  describe('the project (21.5.20)', () => {
    it('carries the manifest with the project\'s id minted first, the linters on its environment as 073 keeps them', () => {
      const project = JSON.parse(read('manifest.json'));
      assert.match(project.project_id, /^[0-9A-Za-z]{21}$/);
      assert.deepStrictEqual(project, {
        project_id: project.project_id,
        work_units: PROJECT_MANIFEST.work_units,
        defaults: { plan_format: 'tick' },
        roadmap: PROJECT_MANIFEST.roadmap,
        environment: { linters: [{ name: 'eslint', command: 'npx eslint .' }] },
      });
      assert.strictEqual(Object.keys(project)[0], 'project_id');
    });

    it('carries the inbox and the environment setup as they are, and writes the state\'s own ignore file', () => {
      assert.deepStrictEqual(tree(state, '.inbox').filter((rel) => !rel.startsWith('ideas/' + TODAY)), [
        '.archived/bugs/2026-01-02--old-crash.md', 'ideas/2026-02-01--dark-mode.md',
      ]);
      assert.strictEqual(read('.inbox/ideas/2026-02-01--dark-mode.md'), '# Dark mode\n');
      assert.strictEqual(read('.state/environment-setup.md'), 'No special setup required.\n');
      assert.strictEqual(read('.gitignore'), '/.knowledge/\n/.cache/\n/.lock\n/.lock.*\n.manifest.json.*.tmp\n/.ledger.jsonl.*.tmp\n');
    });

    it('leaves the old cache and the old migrations record where they were, carrying neither (21.S17)', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/.cache/core/discussion/alpha/session.json'), 'utf8'), '{"live":true}\n');
      assert.ok(!fs.existsSync(path.join(state, '.cache')));
      assert.ok(!fs.existsSync(path.join(state, '.state/migrations')));
    });
  });

  describe('topics: logs, mail and experiments', () => {
    it('makes a topic\'s log its research then its discussion, each verbatim under its own heading (21.S10)', () => {
      assert.strictEqual(read('tally/topics/tally/log.md'),
        '## Research\n\n# Research: Tally\n\nCounting is hard.\n\n## Discussion\n\n# Discussion: Tally\n\nCounting is hard, the research said.\n');
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
        [message('First', 'alpha'), message('Second', 'alpha'), message('Third', 'gamma')],
      );
      assert.strictEqual(read('core/topics/gamma/mail/004-late.md'), message('Late', 'alpha'));
    });

    it('sends a cancelled topic\'s mail to the inbox as an idea, its first line the title (21.S14, P5)', () => {
      assert.deepStrictEqual(tree(state, '.inbox/ideas').filter((rel) => rel.startsWith(TODAY)), [`${TODAY}--a-dropped-thought.md`]);
      assert.strictEqual(read(`.inbox/ideas/${TODAY}--a-dropped-thought.md`),
        '# A dropped thought\n*From: alpha · discussion · 2026-01-01*\n\nDetails of a dropped thought.\n');
    });

    it('moves a topic\'s experiment records, sub-experiments and data, into the topic\'s own folder (21.S43)', () => {
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/data/run.csv'), 'ms\n12\n');
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
        'topics/alpha/experiments/E1-frame-budget/problem.md',
        'topics/alpha/experiments/E1-frame-budget/report.md',
        'topics/alpha/log.md',
        'topics/beta/mail/001-first.md',
        'topics/beta/mail/002-second.md',
        'topics/beta/mail/003-third.md',
        'topics/epsilon/log.md',
        'topics/gamma/mail/004-late.md',
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
              alpha: { source: 'discovery', summary: 'Alpha', order: 1, brief_path: 'topics/alpha/brief.md' },
              beta: { source: 'message:alpha', summary: 'Beta', order: 2 },
              gamma: { source: 'discovery', summary: 'Gamma' },
              delta: { source: 'discovery', summary: 'Delta', cancelled: true, previous_order: 4 },
              epsilon: { source: 'discovery', summary: 'Epsilon' },
              eta: { source: 'discovery', summary: 'Eta', postponed: true },
            },
          },
          discussion: {
            items: {
              alpha: { status: 'completed', reconcile_needed: 'experiment' },
              beta: { status: 'unstarted' },
              gamma: { status: 'promoted', promoted_to: 'shared' },
              delta: { status: 'cancelled' },
              epsilon: { status: 'in-progress', awaiting_experiments: ['E2'] },
              eta: { status: 'postponed', previous_status: 'in-progress' },
            },
          },
          experiment: CORE.phases.experiment,
          specification: { items: { search: { status: 'in-progress', sources: { alpha: { status: 'incorporated' } } }, old: { status: 'cancelled', sources: {} } } },
        },
      });
      assert.strictEqual(read('core/manifest.json'), json(manifestOf('core')), 'in the engine\'s serialisation');
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
        planning: { items: { ranking: { status: 'completed', format: 'tick', phase: 2, task: 1, task_map: { 'ranking-1-1': 'tick-a1' }, storage_paths: ['.tick'] } } },
        implementation: { items: { ranking: { status: 'in-progress', current_phase: 2, current_task: 'ranking-2-1', completed_tasks: ['ranking-1-1'], bank: [{ finding: 'later' }] } } },
        review: { items: { ranking: { status: 'in-progress', reviewed_tasks: ['ranking-1-1'] } } },
      });
    });

    it('keeps a promoted topic and a roadmap item\'s kind on their manifest entries', () => {
      assert.deepStrictEqual(manifestOf('core').phases.discussion.items.gamma, { status: 'promoted', promoted_to: 'shared' });
      assert.strictEqual(JSON.parse(read('manifest.json')).roadmap.items.loyalty.kind, 'idea');
    });
  });

  describe('quick-fixes, and a cancelled unit', () => {
    it('makes a completed quick-fix\'s spec its summary, its plan and scoping gone (21.S45)', () => {
      assert.deepStrictEqual(tree(state, 'typo'), ['manifest.json', 'summary.md']);
      assert.strictEqual(read('typo/summary.md'), '# Typo\n\nFix the typo in the header.\n');
      assert.deepStrictEqual(manifestOf('typo').phases, { implementation: { items: { typo: { status: 'completed' } } } });
    });

    it('keeps a quick-fix being built\'s spec and plan as reference assets', () => {
      assert.deepStrictEqual(tree(state, 'patch'), ['assets/plans/patch/planning.md', 'assets/specs/patch.md', 'manifest.json']);
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
  const feature = () => {
    write(dir, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' } } }));
    write(dir, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: 'in-progress' } } } })));
    write(dir, '.workflows/tally/discussion/tally.md', '# Discussion: Tally\n');
    write(dir, '.workflows/tally/discussion/.mailbox/tally/001-dropped.md', message('Dropped', 'pay'));
    commitAll(dir);
  };

  it('puts the runner\'s migrations record, written in a plain .leeway/ before the move, inside the state worktree', () => {
    dir = tempProject('migration-078-record-');
    try {
      feature();
      write(dir, '.leeway/.state/migrations', '001\n073\n');
      run(dir);
      assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/.state/migrations'), 'utf8'), '001\n073\n');
      assert.strictEqual(git(path.join(dir, '.leeway'), ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/leeway-state');
      assert.ok(!fs.existsSync(path.join(dir, '.leeway-set-aside')));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('run again over a move cut short, writes the same state, its project id and inbox kept', () => {
    dir = tempProject('migration-078-again-');
    try {
      feature();
      write(dir, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: 'cancelled' } } } })));
      commitAll(dir);
      run(dir);
      const state = path.join(dir, '.leeway');
      const first = Object.fromEntries(tree(state).filter((rel) => rel !== '.git').map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')]));
      run(dir);
      const second = Object.fromEntries(tree(state).filter((rel) => rel !== '.git').map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')]));
      assert.deepStrictEqual(second, first);
      assert.deepStrictEqual(tree(state, '.inbox'), [`ideas/${TODAY}--dropped.md`]);
      assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.leeway/\n', 'the ignore line written once');
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
