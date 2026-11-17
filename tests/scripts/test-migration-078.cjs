'use strict';

//
// Tests for migration 078: reshape-move (.cjs)
//
// The reshape's move (21.5) driven in process against a git project whose
// `.workflows/` is today's shape, committed: an epic mid-discussion, an epic
// whose building started, a feature, a bugfix, a completed quick-fix, a
// quick-fix built with its review owed, two reopened after their review —
// one's implementation, the other's scoping — two whose old pipeline
// completed, one in progress and one cancelled, a cross-cutting unit
// holding a topic the first epic promoted, and a cancelled unit, with the
// project's inbox, environment setup, knowledge config and store, cache —
// its old agent stores holding reviews never folded in — old migrations
// record, roadmap and baseline beside them, the tracker's store, settings
// hooks and `.worktreeinclude` in its code tree, and today's user-level
// folder holding its config, credentials and a conversation. The move runs
// once over that project, and each test reads one rule off what it left:
// the state worktree on an unborn `ledger-state`, locked, with nothing
// committed, nothing staged, and `.workflows/` and the store untouched;
// each
// unit's files in the layout, each review never folded in folded into its
// topic's log, a person's files named for tracking or
// analysis placed as any other; nothing in a
// topic's folder no topic owns; its manifest less research and the retired
// state, the dead end off every topic — one whose work concluded keeping its
// close, any other cancelled with its mail sent to the inbox; the project's manifest with its id, the baseline's skip its
// brownfield answer, its retired defaults gone and the roadmap's sources
// following their files; the roadmap as the product, the baseline's docs its
// assets; the store and the knowledge config, never the knowledge store, in
// the state; the hooks naming the engine's new path and the workflows' lines
// gone from `.worktreeinclude`; the user-level folder moved and linked;
// every file written in a place the layout holds; every file the layout has
// no other place for — implementation folders and the reviews' tracking
// files, a research folder of its own as evvi's sessions kept one, a unit's
// design images as portal's — kept byte for byte as legacy, in its unit's
// assets or the product's, and named; the old cache's reports, folded in or
// not, of a topic, of none, with no agent row or of no unit, copied byte for
// byte into the state's ignored cache, a unit's into its `earlier/` and any
// other into the cache's, and never named as legacy; the old cache's other
// files, the old ignore file and the tools' sidecars kept nowhere; the
// links and embeds of each kind of moved document to them, a folder and an
// encoded name among them, as portal's, evvi's and pigeon's, followed, and
// to the documents the move placed elsewhere, a built unit's spec at its
// area of spec.md; and an experiment record's instruments, a folder and a loose
// file, under its data/, its problem, design and report as they are, and a
// file of no record kept as legacy. A small project of its own
// covers the runner's record and journals already in `.ledger/`, the
// `.ledger/` ignore line written with hooks off and the caller's git
// environment cleared, the move run again over one cut short, over one
// whose `.ledger/` the person removed and over one killed writing each file
// it reads back, a project nested in its repository, the specs past their
// gate of a unit whose building started joined into its spec, its fences
// read as the spec's reader reads them, the topics joined named, a spec
// still being written left out with its item — a completed one's too, it
// and a cancelled one keeping no item of the old plan and waiting on no
// cut — and the join killed at each write and run again, a unit whose
// name breaks the kebab-case rule by its case alone carried under its
// lowercase name, as portal's quick-fix was, every reference following,
// a merge stopped in the main checkout, an epic's topics never started,
// each on the map given its row's description as its brief where none came
// to it, whatever its items,
// the projects with nothing to move, a native baseline, a completed one and
// one under way, defaults of the plan's format and the project skills alone,
// read for its task driver after, a task driver's folder whose declaration
// does not read, a `.worktreeinclude` of the workflows' lines alone,
// settings that do not parse, a user-level folder the engine's holds a
// different copy of a file in, and one that is a link elsewhere. The
// tracker's store is where its driver's frozen declaration says a project
// from before Ledger keeps it, read as the move reads it. The mail holds
// messages as today's sessions wrote them, the sender's line under the title
// and under a blank line after it. The linters' carry (reshape/linters.cjs)
// is driven alone over a state of its own, with the linters' entries of a
// project's own.
// Each test that runs the move points both user-level folders at its own,
// never the machine's.
//
// Layer: migration. Budget: 8 s — each run of the move adds a worktree on an
// unborn branch in a real repository and reads git's status of it, and the
// suite runs it over the whole project once and over a repository of its
// own for each edge.
//

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/ledger-migrate/scripts/migrations/078-reshape-move.cjs');
const { carryLinters } = require('../../skills/ledger-migrate/scripts/migrations/reshape/linters.cjs');
const { layoutPlace } = require('../../skills/ledger-engine/scripts/domain/layout.cjs');
const { huntIn, HUNT_HEADINGS } = require('../../skills/ledger-engine/scripts/domain/investigation-log.cjs');
const { heardIn } = require('../../skills/ledger-engine/scripts/domain/discovery-log.cjs');
const { withEntry } = require('../../skills/ledger-engine/scripts/domain/log-lists.cjs');
const { knowledgeFiles } = require('../../skills/ledger-engine/scripts/kernel/knowledge/files.cjs');
const { chosenDriver, listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');
const { specReading } = require('../../skills/ledger-engine/scripts/domain/spec-sections.cjs');

const TODAY = new Date().toISOString().slice(0, 10);
const json = (/** @type {unknown} */ value) => JSON.stringify(value, null, 2) + '\n';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
const STATE_GITIGNORE = '/.knowledge/\n/.cache/\n/.lock\n/.lock.*\n.manifest.json.*.tmp\n/.ledger.jsonl.*.tmp\n';

// Where a project from before Ledger keeps the tracker's store, as the task
// driver's folder declares it, read from its declaration as the move reads
// it; and one file its tool keeps local, named from the first pattern.
const TASK_DRIVERS = path.join(__dirname, '../../skills/ledger-engine/scripts/drivers/task');
const [PRE_LEDGER] = fs.readdirSync(TASK_DRIVERS).map((name) => path.join(TASK_DRIVERS, name, 'pre-ledger-store.json')).filter((file) => fs.existsSync(file))
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const [STORE] = PRE_LEDGER.files;
const LOCAL = PRE_LEDGER.localFiles[0].replace(/^\//, '').replace(/\*.*$/, '');
const STORE_LINES = '{"id":"a1","title":"Ranking"}\n{"id":"a2","title":"Ranking, phase 2"}\n';

const OLD_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs"';
const NEW_ENGINE = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/ledger-engine/scripts/engine.cjs"';
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
  const current = path.join(HOMES, name, 'ledger');
  for (const [rel, content] of Object.entries(files)) write(old, rel, content);
  for (const [rel, content] of Object.entries(fresh)) write(current, rel, content);
  process.env.WORKFLOWS_CONFIG_DIR = old;
  process.env.LEDGER_CONFIG_DIR = current;
  return { old, current };
}

// Today's user-level folder: its config, its credentials and a conversation's folder.
const USER_FOLDER = {
  'config.json': '{"provider":"openai"}\n',
  'credentials.json': '{"openai":"sk-test"}\n',
  'conversations/s1/position.json': '{"at":"workflows"}\n',
  '.DS_Store': 'sidecar\n',
};

// The checkout's knowledge config, naming a provider whose key this machine
// resolves: per checkout, as today.
const KNOWLEDGE_CONFIG = '{"knowledge":{"provider":"openai","model":"text-embedding-3-small"}}\n';

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

// A bugfix's investigation as today's template lays it out, a fenced block
// in it; and a discovery session with a heading of `discovery-log`'s name.
const STALL_INVESTIGATION = [
  '# Investigation: Stall', '', '## Symptoms', '', '### Manifestation', '', '- Jobs pile up in the queue', '',
  '### Reproduction Steps', '', '1. Queue a thousand jobs', '', '### Impact', '', '- **Severity:** High', '', '---', '',
  '## Analysis', '', '### Hypotheses', '', '- **H1: The worker dies** [confirmed]', '', '### Root Cause', '',
  'The worker exits on a full disk.', '', '```text', '## Symptoms', '- a log line, kept as it is', '```', '', '## Fix Direction', '', '- Free the disk first', '',
].join('\n');
const CORE_SESSION = '# Discovery Session 001\n\n## Not taken\n\n- Sharding — too early, the person said.\n';
// Research whose headings and fences reach the edges of what is demoted: a
// sixth-level heading, a `#` opening no heading, a tilde fence, a fence a
// shorter run never closes, one a longer run closes, and one a run with
// words after it never closes.
const EDGES = [
  '# Research: Epsilon', '', '###### Deepest', '', '#123 is an issue, not a heading.', '',
  '~~~', '## Inside a tilde fence', '~~~', '', '````text', '## Inside a long fence', '```', '## Still inside: a shorter run closes nothing', '````', '',
  '```', '## Inside a fence a longer run closes', '`````', '', '## Between the fences', '',
  '```', '## Inside a fence', '```sh', '## Still inside: a run with words after it closes nothing', '```', '',
  '## After the fences', '',
].join('\n');
// A review never marked incorporated whose report, of two headings, the
// discussion holds already, word for word.
const FOLDED_REPORT = '### F1: Two saves\n\nOne wins.\n\n### F2: No lock\n\nNothing orders them.\n';

/** A message as today's send writes it. @param {string} title @param {string} from */

const message = (title, from) => `### ${title}\n*From: ${from} · discussion · 2026-01-01*\n\nDetails of ${title.toLowerCase()}.\n`;

/** A message as the move leaves it, its sender line as the waiting mail heads it. @param {string} title @param {string} sender */
const moved = (title, sender) => `### ${title}\nFrom ${sender} · 1 Jan\n\nDetails of ${title.toLowerCase()}.\n`;

// Messages as today's sessions wrote them, taken from a project's own: the
// sender's line under the title, and under a blank line after it.
const SUPPORT_ADDRESS = '### The website carries the support address\n*From: support-and-diagnostics · discussion · 2026-10-25*\n\n**The case.** An update leaves Fumi crashing at launch.\n';
const STORAGE_FRAMING = '### The "storage location is yours" framing is formally retired\n\n*From: storage-and-sync · discussion · 2026-08-04*\n\nDiscovery framed Fumi\'s storage posture as **"no hosted cloud"**.\n';
const EGRESS_CHANNEL = '### The MCP server is a content-egress channel\n\n*From: agent-surface · discussion · 2026-09-13*\n\n**The channel.** A user connects Fumi to Claude.\n';

// Each report of the old cache, by its path below the old cache, and where
// the move copies it, by its path below the state's cache.
const EARLIER = new Map([
  ['core/discussion/alpha/review-001.md', 'core/earlier/discussion/alpha/review-001.md'],
  ['core/discussion/alpha/review-002.md', 'core/earlier/discussion/alpha/review-002.md'],
  ['core/discussion/alpha/review-004.md', 'core/earlier/discussion/alpha/review-004.md'],
  ['core/discussion/gamma/review-003.md', 'core/earlier/discussion/gamma/review-003.md'],
  ['core/research/exploration/deep-dive-001.md', 'core/earlier/research/exploration/deep-dive-001.md'],
  ['tally/discussion/tally/research-dedup.md', 'tally/earlier/discussion/tally/research-dedup.md'],
  ['retired/discussion/rates/review-001.md', 'earlier/retired/discussion/rates/review-001.md'],
]);

// A discussion as portal's, evvi's and pigeon's hold them: an embed of a
// unit's design image, a link into a research folder of its own, to the
// folder, and to a report of the old cache, a link to the web beside them;
// an image of an encoded name; and links to the documents the move places
// elsewhere, as fumi's, tick's and evvi's hold them — its own research, now
// in its log, a sibling's discussion, its brief, a discovery session, a seed,
// and a built unit's spec, joined into its spec.md, and the spec's folder.
const TALLY_DISCUSSION = '# Discussion: Tally\n\nCounting is hard, the research said.\n\n![Active](../design/sessions-multi-select-active.png "Active")\n\n'
  + 'See [the plan](../research/counting/plan.md), [the dedup dive](../../.cache/tally/discussion/tally/research-dedup.md#findings) and [the docs](https://example.com/plan.md).\n\n'
  + 'All [the counting](../research/counting/), and ![the flow](../design/flow%20chart.png).\n\n'
  + 'Per [the research](../research/tally.md), [its ties](../research/tally.md#ties), [ranking](../../shop/discussion/ranking.md), [the brief](../discovery/briefs/tally.md), '
  + '[the session](../discovery/sessions/session-001.md), [the seed](../seeds/2026-01-01--tally.md), [the idea](../../.inbox/ideas/2026-02-01--dark-mode.md), [its manifest](../manifest.json), [the spec](../../shop/specification/ranking/specification.md) and [its folder](../../shop/specification/ranking/).\n';

const PROJECT_MANIFEST = {
  work_units: {
    core: { work_type: 'epic' }, shop: { work_type: 'epic' }, tally: { work_type: 'feature' }, stall: { work_type: 'bugfix' },
    typo: { work_type: 'quick-fix' }, patch: { work_type: 'quick-fix' }, redo: { work_type: 'quick-fix' }, rescope: { work_type: 'quick-fix' },
    stale: { work_type: 'quick-fix' }, dropped: { work_type: 'quick-fix' },
    gone: { work_type: 'feature' }, shared: { work_type: 'cross-cutting' },
  },
  defaults: { plan_format: 'sample-format', project_skills: ['.claude/skills/house-style'], linters: [{ name: 'eslint', command: 'npx eslint .' }, { name: 'swiftformat', lint_command: 'swiftformat . --lint', fix_command: 'swiftformat .' }], tmux_labels: true },
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
      drafts: { horizon: 'v1', summary: 'Drafts', kind: 'idea', origin: 'harvest', sources: ['.roadmap/draft.txt', 'core/notes.txt'] },
    },
  },
  baseline: { status: 'skipped' },
};

/** An epic mid-discussion, nothing built: research, mail, experiments, a spec under way and a plan, imports. */
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
      gap_topics: ['error-handling'],
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
    planning: {
      items: {
        search: { status: 'in-progress', format: 'sample-format', phase: 1, task: 1 },
        old: { status: 'completed', format: 'sample-format' },
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
    specification: { items: { ranking: { status: 'completed', order: 1, construction_gate_mode: 'auto', finding_gate_mode: 'gated', sources: { ranking: { status: 'incorporated' } } } } },
    planning: {
      items: {
        ranking: {
          status: 'completed', format: 'sample-format', phase: 2, task: 1, review_cycle: 1, review_baseline_words: 900, reconcile_needed: 'specification',
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
  w('.knowledge/config.json', KNOWLEDGE_CONFIG);
  w('.knowledge/store.bin', 'the checkout\'s store\n');
  w('.knowledge/metadata.json', '{"provider":null}\n');
  w('.cache/core/discussion/alpha/session.json', '{"live":true}\n');
  w('.cache/core/discussion/alpha/state.json', json({ agents: {
    'review-001': { id: 'review-001', kind: 'review', status: 'acknowledged' },
    'review-002': { id: 'review-002', kind: 'review', status: 'incorporated' },
    'review-004': { id: 'review-004', kind: 'review', status: 'acknowledged' },
  } }));
  w('.cache/core/discussion/alpha/review-004.md', FOLDED_REPORT);
  w('.cache/core/discussion/alpha/review-001.md', '### F1: Ranking ties\n\nTwo results of one age have no order.\n');
  w('.cache/core/discussion/alpha/review-002.md', '### F1: Stale\n\nFolded in long ago.\n');
  w('.cache/core/discussion/gamma/state.json', json({ agents: { 'review-003': { id: 'review-003', kind: 'review', status: 'acknowledged' } } }));
  w('.cache/core/discussion/gamma/review-003.md', '### F1: Token reuse\n\nA token outlives its session.\n');
  w('.cache/core/research/exploration/deep-dive-001.md', '# Deep dive: caching\n\nA topic the split superseded.\n');
  w('.cache/tally/discussion/tally/research-dedup.md', '# Dedup\n\nNo agent row holds it.\n');
  w('.cache/tally/discussion/tally/session.json', '{"live":false}\n');
  w('.cache/retired/discussion/rates/review-001.md', '# Review of a unit no longer here\n');
  w('.gitignore', '.cache/\n.manifest.json.*.tmp\n.lock\n.knowledge/\n');
  w('README.md', '# Notes on our workflow\n');
  w('scratch/notes.txt', 'a folder that is no unit\n');
  w('Thumbs.db', 'sidecar\n');

  w('.roadmap/sessions/session-001.md', '# Roadmap Session 001\n\n## Imports (as of session)\n\n- imports/market.md\n- imports/gone.md\n\nSee [market](../imports/market.md), the brief in hand (imports/market.md).\n');
  w('.roadmap/sessions/session-002.md', '# Roadmap Session 002\n\nSee [the draft](../draft.txt).\n');
  w('.roadmap/notes/bugs/2026-01-03--points-expiry.md', '# Points expiry\n\nPer [market](../../imports/market.md) and [alpha](../../../core/discussion/alpha.md).\n');
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
  w('core/discovery/sessions/session-001.md', CORE_SESSION);
  w('core/discovery/sessions/session-002.md', '# Discovery Session 002\n\nSee [notes](../../imports/notes.md).\n');
  w('core/discovery/briefs/alpha.md', '# Alpha brief\n\nFrom [notes](../../imports/notes.md).\n');
  w('core/discovery/briefs/zeta.md', '# Zeta brief, its topic never mapped\n');
  w('core/discussion/stray.md', '# Discussion: Stray, no item\'s\n');
  w('core/research/.mailbox/exploration-superseded-2026-01-01-1200/001-cache-sizes.md', message('Cache sizes', 'alpha'));
  w('core/experiment/exploration-superseded-2026-01-01-1200/E3-cache-size/report.md', '# Report\n');
  w('core/research/alpha.md', '# Research: Alpha\n\nRead [notes](../imports/notes.md) and ![d](../imports/diagram.png), not [code](../imports/util.js).\n');
  w('core/research/epsilon.md', EDGES);
  w('core/research/exploration-superseded-2026-01-01-1200.md', '# Research: Exploration\n\nSee ../imports/notes.md.\n');
  w('core/research/overview.md', '# Research: Overview\n\nSee ../imports/notes.md.\n');
  w('core/discussion/alpha.md', `# Discussion: Alpha\n\nThe research said so, and so do we.\n\n${FOLDED_REPORT}`);
  w('core/research/.mailbox/beta/001-first.md', message('First', 'alpha'));
  w('core/research/.mailbox/beta/002-second.md', message('Second', 'alpha'));
  w('core/discussion/.mailbox/beta/001-third.md', message('Third', 'gamma'));
  w('core/discussion/.mailbox/gamma/004-late.md', message('Late', 'alpha'));
  w('core/discussion/.mailbox/gamma/005-support-address.md', SUPPORT_ADDRESS);
  w('core/discussion/.mailbox/gamma/006-storage-framing.md', STORAGE_FRAMING);
  w('core/discussion/.mailbox/delta/001-a-dropped-thought.md', message('A dropped thought', 'alpha'));
  w('core/discussion/.mailbox/delta/002-egress-channel.md', EGRESS_CHANNEL);
  w('core/experiment/alpha/E1-frame-budget/problem.md', '# Problem\n\nAgainst [notes](../../../imports/notes.md).\n');
  w('core/experiment/alpha/E1-frame-budget/report.md', '# Report\n');
  w('core/experiment/alpha/E1-frame-budget/design.md', '# Design\n');
  w('core/experiment/alpha/notes.md', 'a loose file in a topic\'s experiments\n');
  w('core/experiment/alpha/scratch/try.txt', 'a folder of no record\n');
  w('core/experiment/alpha/E1-frame-budget/rubric.md', '# Rubric\n');
  w('core/experiment/alpha/E1-frame-budget/harness/run.sh', '#!/bin/sh\necho harness\n');
  w('core/experiment/alpha/E1-frame-budget/data/run.csv', 'ms\n12\n');
  w('core/experiment/alpha/E1-frame-budget/data/run.sh', '#!/bin/sh\necho 12\n');
  fs.chmodSync(path.join(dir, '.workflows/core/experiment/alpha/E1-frame-budget/data/run.sh'), 0o755);
  w('core/research/gamma.md', '# Research: Gamma\n\nSee [notes](../imports/notes.md) and [the stray](../discussion/stray.md).\n');
  w('core/research/theta.md', '# Research: Theta\n');
  w('core/research/multi-tenancy/overview.md', '# Multi-tenancy\n\nSee [the case](TenantTestCase.php) and [notes](../../imports/notes.md).\n');
  w('core/research/multi-tenancy/TenantTestCase.php', '<?php\n\nabstract class TenantTestCase extends TestCase {}\n');
  w('core/research/.mailbox/theta/001-theta-note.md', message('Theta note', 'alpha'));
  w('core/experiment/alpha/E1-frame-budget/E1.1-one-monitor/problem.md', '# Sub-problem\n');
  w('core/experiment/alpha/E1-frame-budget/E1.1-one-monitor/sample.tsv', 'a\tb\n');
  w('core/specification/search/specification.md', '# Specification: Search\n\n[n](../../imports/notes.md) and [its notes](order-tracking-notes.md)\n');
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
  w('shop/specification/ranking/review-input-tracking-c1.md', 'tracking\n');
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
  w('tally/design/sessions-multi-select-active.png', PNG);
  w('tally/discussion/tally.md', TALLY_DISCUSSION);
  w('tally/research/counting/plan.md', '# Counting plan\n');
  w('tally/design/flow chart.png', PNG);
  w('tally/discovery/briefs/tally.md', '# Tally brief\n');
  w('tally/discovery/sessions/session-001.md', '# Discovery Session 001\n');
  w('tally/seeds/2026-01-01--tally.md', '# Tally\n');

  w('stall/manifest.json', json(unit('stall', 'bugfix', 'in-progress', { investigation: { items: { stall: { status: 'in-progress' } } } })));
  w('stall/investigation/stall.md', STALL_INVESTIGATION);
  w('stall/investigation/.mailbox/stall/001-retry-window.md', message('Retry window', 'pay'));
  w('stall/investigation/.mailbox/stall/002-disk-graph.md', '### Disk graph\n*From: pay · discussion · 2026-01-01*\n\nSee ![the graph](../../disk.png).\n');
  w('stall/investigation/disk.png', PNG);

  w('typo/manifest.json', json(unit('typo', 'quick-fix', 'completed', quickFixPhases('typo', 'completed'))));
  w('typo/specification/typo/specification.md', '# Typo\n\nFix the typo in the header.\n');
  w('typo/planning/typo/planning.md', '# Plan: Typo\n');

  w('patch/manifest.json', json(unit('patch', 'quick-fix', 'in-progress', quickFixPhases('patch', 'completed'))));
  w('patch/specification/patch/specification.md', '# Patch\n');
  w('patch/planning/patch/planning.md', '# Plan: Patch\n');

  for (const [wu, scoping, building] of [['redo', 'completed', 'in-progress'], ['rescope', 'in-progress', 'completed']]) {
    w(`${wu}/manifest.json`, json(unit(wu, 'quick-fix', 'in-progress', {
      ...quickFixPhases(wu, building), scoping: { items: { [wu]: { status: scoping } } }, review: { items: { [wu]: { status: 'completed' } } },
    })));
    w(`${wu}/specification/${wu}/specification.md`, `# ${wu}\n`);
    w(`${wu}/planning/${wu}/planning.md`, `# Plan: ${wu}\n`);
  }

  for (const [wu, status] of [['stale', 'in-progress'], ['dropped', 'cancelled']]) {
    w(`${wu}/manifest.json`, json(unit(wu, 'quick-fix', status, { ...quickFixPhases(wu, 'completed'), review: { items: { [wu]: { status: 'completed' } } } })));
    w(`${wu}/specification/${wu}/specification.md`, `# ${wu}\n\nFixed.\n`);
    w(`${wu}/planning/${wu}/planning.md`, `# Plan: ${wu}\n`);
  }

  w('shared/manifest.json', json(unit('shared', 'cross-cutting', 'in-progress', {
    discussion: { items: { gamma: { status: 'completed' } } },
    specification: { items: { shared: { status: 'completed', sources: { gamma: { status: 'incorporated' } } } } },
  })));
  w('shared/discussion/gamma.md', '# Discussion: Gamma\n');
  w('shared/specification/shared/specification.md', '# Specification: Shared\n');

  w('gone/manifest.json', json(unit('gone', 'feature', 'cancelled', { discussion: { items: { gone: { status: 'in-progress' } } } })));
  w('gone/discussion/gone.md', '# Discussion: Gone\n');
}

describe('migration 078: the move into the layout in .ledger/', () => {
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
    user = homes('today', USER_FOLDER, { 'conversations/s1/position.json': USER_FOLDER['conversations/s1/position.json'], 'conversations/s2/position.json': '{"at":"ledger"}\n', '.DS_Store': 'the engine side\'s own sidecar\n' });
    fs.chmodSync(path.join(user.old, 'credentials.json'), 0o600);
    result = run(dir);
    state = path.join(dir, '.ledger');
  });
  after(() => { cleanupFixture(dir); });

  describe('where it writes (E2, 21.9.3)', () => {
    it('adds the state worktree at .ledger/ on ledger-state, unborn, and locked as the engine locks it', () => {
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/ledger-state');
      assert.throws(() => git(dir, ['rev-parse', '--verify', '--quiet', 'refs/heads/ledger-state']), 'the branch has no commit');
      assert.strictEqual(lockOf(dir, state), 'Ledger state, do not remove');
    });

    it('commits nothing, stages nothing in the state or the code, and leaves the default branch\'s .workflows/ as it was', () => {
      assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), headBefore);
      assert.strictEqual(git(state, ['ls-files']).trim(), '', 'nothing staged in the state worktree');
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '', 'nothing staged in the code');
      assert.strictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all', '--', '.workflows', STORE]).trim(), '', '.workflows/ and the tracker\'s store as they were');
    });

    it('writes every file into a place the layout holds', () => {
      assert.deepStrictEqual(tree(state).filter((rel) => layoutPlace(rel) === null), []);
    });

    it('reports an update for the project and one for each unit, and hands back each file it kept as legacy at its place, and each experiment instrument it moved under its record\'s data/', () => {
      assert.deepStrictEqual({ updates: result.updates, skips: result.skips }, { updates: 13, skips: 0 });
      assert.deepStrictEqual(result.returned, {
        verify: 'These had no place of their own in .ledger/, so each is kept, as it was, as legacy, under its unit\'s assets/legacy/ or the product\'s, .product/assets/legacy/: '
          + '.ledger/.product/assets/legacy/.inbox/ideas/rough-notes.md, .ledger/.product/assets/legacy/.roadmap/draft.txt, '
          + '.ledger/.product/assets/legacy/.roadmap/notes/ideas/2026-01-03--points-expiry.md, .ledger/.product/assets/legacy/.baseline/.state/dossier-auth.md, '
          + '.ledger/.product/assets/legacy/README.md, .ledger/.product/assets/legacy/scratch/notes.txt, '
          + '.ledger/core/assets/legacy/discovery/briefs/zeta.md, .ledger/core/assets/legacy/discussion/stray.md, '
          + '.ledger/core/assets/legacy/experiment/alpha/notes.md, .ledger/core/assets/legacy/experiment/alpha/scratch/try.txt, '
          + '.ledger/core/assets/legacy/experiment/exploration-superseded-2026-01-01-1200/E3-cache-size/report.md, .ledger/core/assets/legacy/notes.txt, '
          + '.ledger/core/assets/legacy/research/multi-tenancy/TenantTestCase.php, .ledger/core/assets/legacy/research/multi-tenancy/overview.md, '
          + '.ledger/core/assets/legacy/specification/search/order-tracking-notes.md, .ledger/core/assets/legacy/specification/search/review-input-tracking-c1.md, '
          + '.ledger/dropped/assets/legacy/planning/dropped/planning.md, '
          + '.ledger/shop/assets/legacy/implementation/ranking/analysis-tasks-c1.md, .ledger/shop/assets/legacy/implementation/ranking/fix-tracking-ranking-1-1.md, '
          + '.ledger/shop/assets/legacy/planning/ranking/review-integrity-tracking-c1.md, .ledger/shop/assets/legacy/specification/ranking/review-input-tracking-c1.md, .ledger/stale/assets/legacy/planning/stale/planning.md, '
          + '.ledger/stall/assets/legacy/investigation/disk.png, .ledger/tally/assets/legacy/design/flow chart.png, '
          + '.ledger/tally/assets/legacy/design/sessions-multi-select-active.png, .ledger/tally/assets/legacy/research/counting/plan.md, '
          + '.ledger/typo/assets/legacy/planning/typo/planning.md. '
          + 'Move any into a better place in its unit\'s assets/, or the product\'s, as wanted. '
          + 'These files of experiment records, neither a record\'s problem, design or report nor in its data/, were moved under its data/, at their paths from the record\'s folder: '
          + '.ledger/core/topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/data/sample.tsv, .ledger/core/topics/alpha/experiments/E1-frame-budget/data/harness/run.sh, '
          + '.ledger/core/topics/alpha/experiments/E1-frame-budget/data/rubric.md. A path a record\'s text or script spells out is left as written. '
          + 'The linters were carried into environment.linters as a name and a command, which leaves out swiftformat\'s fix_command ("swiftformat ."). '
          + 'Change a linter\'s command where any is still wanted, when ready to build asks to confirm the project\'s setup, or now: read the linters recorded with '
          + '`node .claude/skills/ledger-engine/scripts/engine.cjs environment show`, then record the whole list, those changed, with '
          + '`node .claude/skills/ledger-engine/scripts/engine.cjs environment set linters`, its JSON on stdin.',
      });
    });
  });

  describe('nothing that may hold knowledge lost', () => {
    it('keeps every file it names as legacy byte for byte at its place, a file the state\'s first commit takes — a research folder of its own, as evvi\'s sessions kept one, and a unit\'s design images, as portal\'s, among them — so finish, dropping .workflows/, leaves none of them in git\'s history alone', () => {
      const named = /legacy\/: (.*?)\. Move any/.exec(String(result.returned && result.returned.verify));
      const legacy = (named === null ? '' : named[1]).split(', ').map((rel) => rel.replace(/^\.ledger\//, ''));
      const oldOf = (/** @type {string} */ rel) => {
        const [, owner, kept] = /^(.+?)\/assets\/legacy\/(.*)$/.exec(rel) ?? [];
        return owner === '.product' ? kept : `${owner}/${kept}`;
      };
      assert.ok([
        'core/research/multi-tenancy/overview.md', 'core/research/multi-tenancy/TenantTestCase.php', 'tally/design/sessions-multi-select-active.png', 'README.md',
      ].every((rel) => legacy.map(oldOf).includes(rel)));
      for (const rel of legacy) assert.deepStrictEqual(fs.readFileSync(path.join(state, rel)), fs.readFileSync(path.join(dir, '.workflows', oldOf(rel))), rel);
      assert.throws(() => git(state, ['check-ignore', '--', ...legacy]), 'none is ignored in the state');
    });

    it('copies the old cache\'s reports, folded in or not, of a topic or of none, with no agent row, or of no unit, byte for byte into the state\'s ignored cache — a unit\'s into its earlier/ at its path below the unit\'s folder in the old cache, any other into the cache\'s own at its path below the old cache — naming none of them as legacy, so the unit\'s ending purges them with the rest of its cache', () => {
      assert.deepStrictEqual(tree(state, '.cache'), [...EARLIER].map(([, to]) => to).sort(), 'the reports alone, no scratch file left');
      for (const [was, to] of EARLIER) assert.deepStrictEqual(fs.readFileSync(path.join(state, '.cache', to)), fs.readFileSync(path.join(dir, '.workflows/.cache', was)), to);
      const copies = [...EARLIER].map(([, to]) => `.cache/${to}`);
      assert.deepStrictEqual(git(state, ['check-ignore', '--', ...copies]).trim().split('\n'), copies, 'every one ignored in the state');
      assert.ok(!String(result.returned && result.returned.verify).includes('earlier/'), 'none named for the review');
    });

    it('drops the old cache\'s session state and data, and the old ignore file, keeping and naming neither', () => {
      const verify = String(result.returned && result.returned.verify);
      assert.deepStrictEqual([verify.includes('.workflows/.gitignore'), verify.includes('session.json'), verify.includes('state.json')], [false, false, false]);
      assert.deepStrictEqual(tree(state).filter((rel) => /(^|\/)\.gitignore$|session\.json$|state\.json$/.test(rel)), ['.gitignore']);
    });

    it('points a moved document\'s links and embeds at the files kept as legacy, from where it now sits — a design image, a research folder\'s file and the folder, a name encoded — and at a report of the old cache where its unit\'s cache keeps it, its anchor kept; a link to the web as written', () => {
      assert.strictEqual(read('tally/topics/tally/log.md').split('## Discussion: Tally\n\n')[1].split('\n\nPer ')[0], 'Counting is hard, the research said.\n\n'
        + '![Active](../../assets/legacy/design/sessions-multi-select-active.png "Active")\n\n'
        + 'See [the plan](../../assets/legacy/research/counting/plan.md), [the dedup dive](../../../.cache/tally/earlier/discussion/tally/research-dedup.md#findings) and [the docs](https://example.com/plan.md).\n\n'
        + 'All [the counting](../../assets/legacy/research/counting/), and ![the flow](../../assets/legacy/design/flow%20chart.png).');
    });

    it('points a moved document\'s links at the documents the move placed elsewhere — research folded into a log at its heading, a link\'s own anchor kept, a sibling\'s discussion, a brief, a session, a seed, an inbox item and its unit\'s manifest, as portal\'s — a built unit\'s spec joined into its spec.md at its area\'s heading — and leaves the spec\'s folder, its tracking file kept as legacy, as written', () => {
      assert.strictEqual(read('tally/topics/tally/log.md').split('\n\nPer ')[1], '[the research](log.md#research), [its ties](log.md#ties), [ranking](../../../shop/topics/ranking/log.md#discussion), '
        + '[the brief](brief.md), [the session](../../discovery/session-001.md), [the seed](../../seeds/2026-01-01--tally.md), [the idea](../../../.inbox/ideas/2026-02-01--dark-mode.md), [its manifest](../../manifest.json), [the spec](../../../shop/spec.md#1-ranking) and [its folder](../../shop/specification/ranking/).\n');
    });

    it('points the links of every kind of document it moves at the files kept as legacy: promoted research, a message, a roadmap session, a spec', () => {
      assert.match(read('core/assets/specs/search.md'), /\[its notes\]\(\.\.\/legacy\/specification\/search\/order-tracking-notes\.md\)/);
      assert.match(read('shared/topics/gamma/log.md'), /and \[the stray\]\(\.\.\/\.\.\/\.\.\/core\/assets\/legacy\/discussion\/stray\.md\)\./);
      assert.strictEqual(read('stall/topics/stall/mail/002-disk-graph.md'), '### Disk graph\nFrom Pay · 1 Jan\n\nSee ![the graph](../../../assets/legacy/investigation/disk.png).\n');
      assert.strictEqual(read('.product/sessions/session-002.md'), '## Roadmap Session 002\n\nSee [the draft](../assets/legacy/.roadmap/draft.txt).\n');
    });
  });

  describe('the project (21.5.20, 21.11.2)', () => {
    it('8.S51, 21.S38, 21.S50: carries the manifest with the project\'s id minted first, the linters on its environment, each by its check command, the baseline\'s status gone, its skip the brownfield offer\'s answer, the plan\'s format and the project skills gone from its defaults, the rest kept, and the roadmap\'s open session the product\'s conversation\'s (22.3.1, 22.3.2)', () => {
      const project = JSON.parse(read('manifest.json'));
      assert.match(project.project_id, /^[0-9A-Za-z]{21}$/);
      const { items } = PROJECT_MANIFEST.roadmap;
      assert.deepStrictEqual(project, {
        project_id: project.project_id,
        work_units: PROJECT_MANIFEST.work_units,
        defaults: { tmux_labels: true },
        roadmap: {
          horizons: ['v1'],
          items: {
            loyalty: { ...items.loyalty, sources: ['.product/sessions/session-001.md', '.product/assets/market.md'] },
            'points-expiry': { ...items['points-expiry'], sources: ['.product/notes/2026-01-03--points-expiry.md'] },
            alpha: { ...items.alpha, sources: ['core/topics/alpha/brief.md', 'core/topics/alpha/log.md', 'core/implementation/gone.md'] },
            exploration: { ...items.exploration, sources: ['core/assets/research/exploration-superseded-2026-01-01-1200.md', 'shared/topics/gamma/log.md', 'core/topics/beta/mail/003-third.md'] },
            drafts: { ...items.drafts, sources: ['.product/assets/legacy/.roadmap/draft.txt', 'core/assets/legacy/notes.txt'] },
          },
        },
        brownfield_offer: 'skipped',
        environment: { linters: [{ name: 'eslint', command: 'npx eslint .' }, { name: 'swiftformat', command: 'swiftformat . --lint' }] },
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
      assert.strictEqual(read('.gitignore'), `${STATE_GITIGNORE}${PRE_LEDGER.localFiles.join('\n')}\n`);
    });

    it('carries the tracker\'s store, found where the task driver says it lives, as it is, and none of its tool\'s local files (21.5.18)', () => {
      assert.strictEqual(read(STORE), STORE_LINES);
      assert.ok(!fs.existsSync(path.join(state, LOCAL)));
      assert.strictEqual(fs.readFileSync(path.join(dir, STORE), 'utf8'), STORE_LINES, 'the code tree\'s store left for finish to drop');
    });

    it('carries the checkout\'s knowledge config as it is, where the engine reads it, so the next boot builds the store with no setup question, and never the store or its metadata (P6, 21.9.6)', () => {
      const files = knowledgeFiles(state);
      assert.deepStrictEqual([fs.readFileSync(files.config, 'utf8'), fs.existsSync(files.store), fs.existsSync(files.metadata)], [KNOWLEDGE_CONFIG, false, false]);
    });

    it('leaves the old cache and the old migrations record where they were, carrying neither but the cache\'s reports (21.S17)', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/.cache/core/discussion/alpha/session.json'), 'utf8'), '{"live":true}\n');
      assert.ok(!fs.existsSync(path.join(state, '.state/migrations')));
    });
  });

  describe('the product (21.5.7, 21.11.1)', () => {
    it('8.S51, 21.S38: makes .roadmap/ .product/: its sessions as they are but for their headings, one level deeper, each note out of its kind\'s folder, its imports as assets, and the baseline\'s docs and its interview agendas, holding the person\'s answers, as reference there, and every file of none, its dossiers among them, as legacy, its path from .workflows/ kept', () => {
      assert.deepStrictEqual(tree(state, '.product'), [
        'assets/baseline/agenda-auth.md',
        'assets/baseline/auth.md',
        'assets/baseline/billing.md',
        'assets/chart.png',
        'assets/legacy/.baseline/.state/dossier-auth.md',
        'assets/legacy/.inbox/ideas/rough-notes.md',
        'assets/legacy/.roadmap/draft.txt',
        'assets/legacy/.roadmap/notes/ideas/2026-01-03--points-expiry.md',
        'assets/legacy/README.md',
        'assets/legacy/scratch/notes.txt',
        'assets/market.md',
        'notes/2026-01-03--points-expiry.md',
        'sessions/session-001.md',
        'sessions/session-002.md',
      ]);
      assert.deepStrictEqual(fs.readFileSync(path.join(state, '.product/assets/chart.png')), PNG);
      assert.strictEqual(read('.product/assets/baseline/auth.md'), '# Auth\n\nSee [billing](billing.md).\n');
      assert.strictEqual(read('.product/assets/baseline/agenda-auth.md'), '# Agenda: Auth\n\n- Why sessions expire: the person said an hour, for the auditors.\n');
    });

    it('points the product\'s documents\' links into its imports at the assets, and to a unit\'s document at its place, from where each now sits, a session\'s headings one level deeper and each import it names in words from the product\'s folder named as its asset, a name of no import as written', () => {
      assert.strictEqual(read('.product/sessions/session-001.md'), '## Roadmap Session 001\n\n### Imports (as of session)\n\n- assets/market.md\n- imports/gone.md\n\nSee [market](../assets/market.md), the brief in hand (assets/market.md).\n');
      assert.strictEqual(read('.product/notes/2026-01-03--points-expiry.md'), '# Points expiry\n\nPer [market](../assets/market.md) and [alpha](../../core/topics/alpha/log.md#discussion).\n');
    });

    it('points each roadmap item\'s sources at the new places, a unit\'s files and the files kept as legacy among them, once each (21.S15)', () => {
      const { roadmap } = JSON.parse(read('manifest.json'));
      assert.deepStrictEqual(Object.fromEntries(Object.entries(roadmap.items).map(([name, item]) => [name, item.sources])), {
        loyalty: ['.product/sessions/session-001.md', '.product/assets/market.md'],
        'points-expiry': ['.product/notes/2026-01-03--points-expiry.md'],
        alpha: ['core/topics/alpha/brief.md', 'core/topics/alpha/log.md', 'core/implementation/gone.md'],
        exploration: ['core/assets/research/exploration-superseded-2026-01-01-1200.md', 'shared/topics/gamma/log.md', 'core/topics/beta/mail/003-third.md'],
        drafts: ['.product/assets/legacy/.roadmap/draft.txt', 'core/assets/legacy/notes.txt'],
      });
      for (const source of [...roadmap.items.loyalty.sources, ...roadmap.items.alpha.sources.slice(0, 2), ...roadmap.items.exploration.sources, ...roadmap.items.drafts.sources]) assert.ok(fs.existsSync(path.join(state, source)), source);
    });
  });

  describe('the project\'s own files (21.5.19, 21.S52)', () => {
    it('names the engine by its new path in each settings hook and the state as .ledger/ in each permission rule, every other hook, rule and key as it was', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), json(settings(NEW_ENGINE, '.ledger')));
    });

    it('takes the workflows\' lines out of .worktreeinclude, the person\'s kept', () => {
      assert.strictEqual(fs.readFileSync(path.join(dir, '.worktreeinclude'), 'utf8'), '.env.local\n');
    });
  });

  describe('the user-level folder (21.5.19, P7, 21.S52)', () => {
    it('moves today\'s folder\'s contents into the engine\'s unchanged, beside what the engine already wrote there — a folder both hold merged where nothing in it differs — and leaves a link to it in its place', () => {
      assert.deepStrictEqual(tree(user.current), ['.DS_Store', 'config.json', 'conversations/s1/position.json', 'conversations/s2/position.json', 'credentials.json']);
      for (const [rel, content] of Object.entries(USER_FOLDER)) if (rel !== '.DS_Store') assert.strictEqual(fs.readFileSync(path.join(user.current, rel), 'utf8'), content, rel);
      assert.strictEqual(fs.statSync(path.join(user.current, 'credentials.json')).mode & 0o777, 0o600, 'the credentials kept private');
      assert.strictEqual(fs.readlinkSync(user.old), user.current);
      assert.strictEqual(fs.readFileSync(path.join(user.old, 'credentials.json'), 'utf8'), USER_FOLDER['credentials.json'], 'read through the link as today\'s skills read it');
    });

    it('finds the link already there for the machine\'s next project, and leaves it', () => {
      const next = tempProject('migration-078-next-');
      try {
        write(next, '.workflows/manifest.json', json({ work_units: {} }));
        commitAll(next);
        const { returned } = run(next);
        assert.strictEqual(returned, undefined);
        assert.strictEqual(fs.readlinkSync(user.old), user.current);
        assert.deepStrictEqual(tree(user.current), ['.DS_Store', 'config.json', 'conversations/s1/position.json', 'conversations/s2/position.json', 'credentials.json']);
      } finally {
        cleanupFixture(next);
      }
    });
  });

  describe('topics: logs, mail and experiments', () => {
    it('makes a topic\'s log its research then its discussion, each under its own heading, its words kept and its headings one level deeper (21.S10)', () => {
      assert.strictEqual(read('tally/topics/tally/log.md').split('Counting is hard, the research said.')[0],
        '## Research\n\n## Research: Tally\n\nCounting is hard.\n\n## Discussion\n\n## Discussion: Tally\n\n');
    });

    it('joins a promoted topic\'s research to its log in the cross-cutting unit, ahead of its discussion, its links to the imports it came with (21.5.2)', () => {
      assert.strictEqual(read('shared/topics/gamma/log.md'),
        '## Research\n\n## Research: Gamma\n\nSee [notes](../../../core/assets/notes.md) and [the stray](../../../core/assets/legacy/discussion/stray.md).\n\n## Discussion\n\n## Discussion: Gamma\n\n## Review review-003, never folded in\n\n#### F1: Token reuse\n\nA token outlives its session.\n');
      assert.ok(!fs.existsSync(path.join(state, 'core/topics/gamma/log.md')), 'not in the epic');
    });

    it('folds each review the old agent store holds that landed and was never folded in into its topic\'s log, demoted under a heading of its own, a promoted topic\'s from the unit it came from; one incorporated is not (21.5.12, 21.S19)', () => {
      const log = read('core/topics/alpha/log.md');

      assert.ok(log.endsWith('\n\n## Review review-001, never folded in\n\n#### F1: Ranking ties\n\nTwo results of one age have no order.\n'), log);
      assert.ok(!log.includes('Folded in long ago.'), log);
      assert.ok(!log.includes('review-004'), 'a report the discussion holds word for word is not folded in again');
      assert.strictEqual(log.split('One wins.').length, 2, log);
    });

    it('makes a bugfix\'s investigation its topic\'s log, every heading outside a fenced block one level deeper (21.S11)', () => {
      assert.strictEqual(read('stall/topics/stall/log.md'), [
        '## Investigation', '', '## Investigation: Stall', '', '### Symptoms', '', '#### Manifestation', '', '- Jobs pile up in the queue', '',
        '#### Reproduction Steps', '', '1. Queue a thousand jobs', '', '#### Impact', '', '- **Severity:** High', '', '---', '',
        '### Analysis', '', '#### Hypotheses', '', '- **H1: The worker dies** [confirmed]', '', '#### Root Cause', '',
        'The worker exits on a full disk.', '', '```text', '## Symptoms', '- a log line, kept as it is', '```', '', '### Fix Direction', '', '- Free the disk first', '',
      ].join('\n'));
    });

    it('leaves none of an old investigation\'s headings read as the hunt\'s: its lists read empty, and a symptom logged lands under the log\'s own ## Symptoms', () => {
      const log = read('stall/topics/stall/log.md');
      const warnings = [];
      const hunt = huntIn(log, 'stall/topics/stall/log.md', warnings);
      assert.deepStrictEqual([hunt.symptoms, hunt.hypotheses, hunt.experiments, hunt.rootCause, hunt.fixDirection, warnings], [[], [], [], null, null, []]);

      const logged = withEntry(log, Object.values(HUNT_HEADINGS), HUNT_HEADINGS.symptoms, 'The queue stalls at noon');
      assert.strictEqual(logged, `${log}\n## Symptoms\n\n- The queue stalls at noon\n`);
      assert.deepStrictEqual(huntIn(logged, 'stall/topics/stall/log.md', []).symptoms, [{ text: 'The queue stalls at noon', body: [] }]);
    });

    it('leaves a sixth-level heading at six, a # opening no heading, and every line of a tilde fence or of a fence only a bare run as long or longer closes, as they are', () => {
      assert.strictEqual(read('core/topics/epsilon/log.md'), [
        '## Research', '', '## Research: Epsilon', '', '###### Deepest', '', '#123 is an issue, not a heading.', '',
        '~~~', '## Inside a tilde fence', '~~~', '', '````text', '## Inside a long fence', '```', '## Still inside: a shorter run closes nothing', '````', '',
        '```', '## Inside a fence a longer run closes', '`````', '', '### Between the fences', '',
        '```', '## Inside a fence', '```sh', '## Still inside: a run with words after it closes nothing', '```', '',
        '### After the fences', '',
      ].join('\n'));
    });

    it('leaves none of an old discovery session\'s headings read as discovery-log\'s: its list reads empty, and a direction logged lands under the log\'s own ## Not taken', () => {
      const log = read('core/discovery/session-001.md');
      const warnings = [];
      assert.strictEqual(log, '## Discovery Session 001\n\n### Not taken\n\n- Sharding — too early, the person said.\n');
      assert.deepStrictEqual(heardIn([{ rel: 'core/discovery/session-001.md', text: log }], [], warnings).notTaken, []);

      const logged = withEntry(log, ['Not taken', 'Views of the product', 'Spikes'], 'Not taken', 'Replicas — the cost');
      assert.deepStrictEqual(heardIn([{ rel: 'core/discovery/session-001.md', text: logged }], [], warnings).notTaken, [{ direction: 'Replicas', why: 'the cost' }]);
      assert.deepStrictEqual(warnings, []);
    });

    it('joins research feeding one topic to its log, sends research feeding several to a discovery session of its own after the last, and keeps a legacy split\'s superseded copy as a reference asset, its name kept and its links pointed from there (21.S12, F10)', () => {
      assert.match(read('core/topics/alpha/log.md'), /^## Research\n\n## Research: Alpha\n[\s\S]*\n## Discussion\n\n## Discussion: Alpha\n/);
      assert.strictEqual(read('core/discovery/session-003.md'), [
        '# Discovery Session 003', '', `Date: ${TODAY}`, 'Work unit: core', '',
        'Written by the migration: the research below fed several topics, so it is kept here, on the unit\'s discovery log, until the cut and the merges place it where it bears.',
        '', '## Research: overview', '', '## Research: Overview', '', 'See ../assets/notes.md.', '',
      ].join('\n'));
      assert.strictEqual(read('core/assets/research/exploration-superseded-2026-01-01-1200.md'), '# Research: Exploration\n\nSee ../notes.md.\n', 'a legacy split\'s superseded copy is reference, never research to place: the split topics hold it');
    });

    it('moves a topic\'s mail from both its boxes into one sequence, renumbered, and keeps a single box\'s names (21.S13)', () => {
      assert.deepStrictEqual(
        ['001-first', '002-second', '003-third'].map((name) => read(`core/topics/beta/mail/${name}.md`)),
        [moved('First', 'Alpha'), moved('Second', 'Alpha'), moved('Third', 'Gamma')],
      );
      assert.strictEqual(read('core/topics/gamma/mail/004-late.md'), moved('Late', 'Alpha'));
    });

    it('heads each message moved with who sent it as the waiting mail does, its second line, the sender the topic titled and the phase gone, whether today\'s sender line sat under the title or under a blank line after it (10.4.2)', () => {
      assert.deepStrictEqual(
        ['core/topics/gamma/mail/005-support-address.md', 'core/topics/gamma/mail/006-storage-framing.md', 'stall/topics/stall/mail/001-retry-window.md'].map(read),
        [
          '### The website carries the support address\nFrom Support And Diagnostics · 25 Oct\n\n**The case.** An update leaves Fumi crashing at launch.\n',
          '### The "storage location is yours" framing is formally retired\nFrom Storage And Sync · 4 Aug\n\nDiscovery framed Fumi\'s storage posture as **"no hosted cloud"**.\n',
          moved('Retry window', 'Pay'),
        ],
      );
    });

    it('sends a cancelled topic\'s mail to the inbox as an idea, its first line the title, who sent it under it as the waiting mail heads it, wherever today\'s sender line sat (21.S14, P5, 10.4.2)', () => {
      assert.deepStrictEqual(tree(state, '.inbox/ideas').filter((rel) => rel.startsWith(TODAY)), [
        `${TODAY}--a-dropped-thought.md`, `${TODAY}--cache-sizes.md`, `${TODAY}--the-mcp-server-is-a-content-egress-channel.md`, `${TODAY}--theta-note.md`,
      ]);
      assert.deepStrictEqual([`${TODAY}--a-dropped-thought.md`, `${TODAY}--the-mcp-server-is-a-content-egress-channel.md`].map((name) => read(`.inbox/ideas/${name}`)), [
        '# A dropped thought\nFrom Alpha · 1 Jan\n\nDetails of a dropped thought.\n',
        '# The MCP server is a content-egress channel\nFrom Agent Surface · 13 Sep\n\n**The channel.** A user connects Fumi to Claude.\n',
      ]);
    });

    it('sends the mail of a name no topic holds to the inbox as ideas, the same way', () => {
      assert.strictEqual(read(`.inbox/ideas/${TODAY}--cache-sizes.md`), '# Cache sizes\nFrom Alpha · 1 Jan\n\nDetails of cache sizes.\n');
    });

    it('keeps a brief, experiment records and a discussion under a name no topic holds as legacy, in no topic\'s folder, the experiments\' items gone', () => {
      assert.deepStrictEqual(tree(state, 'core/topics').map((rel) => rel.split('/')[0]).filter((name, i, all) => all.indexOf(name) === i), ['alpha', 'beta', 'epsilon', 'gamma', 'theta']);
      assert.strictEqual(read('core/assets/legacy/discussion/stray.md'), '# Discussion: Stray, no item\'s\n');
      assert.deepStrictEqual(Object.keys(manifestOf('core').phases.experiment.items), ['alpha']);
    });

    it('moves a topic\'s experiment records, sub-experiments and data, into the topic\'s own folder, a record\'s problem, design and report as they are, each record\'s instruments — a folder and a loose file — under its data/, and a file or a folder of no record in the topic\'s experiments kept as legacy (21.S43, 4.11.15)', () => {
      assert.deepStrictEqual(['problem.md', 'design.md', 'report.md'].map((name) => fs.existsSync(path.join(state, 'core/topics/alpha/experiments/E1-frame-budget', name))), [true, true, true]);
      assert.deepStrictEqual(['experiment/alpha/notes.md', 'experiment/alpha/scratch/try.txt'].map((rel) => read(`core/assets/legacy/${rel}`)), ['a loose file in a topic\'s experiments\n', 'a folder of no record\n']);
      assert.deepStrictEqual(['data/harness/run.sh', 'data/rubric.md', 'E1.1-one-monitor/data/sample.tsv'].map((rel) => read(`core/topics/alpha/experiments/E1-frame-budget/${rel}`)), ['#!/bin/sh\necho harness\n', '# Rubric\n', 'a\tb\n']);
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/data/run.csv'), 'ms\n12\n');
      assert.strictEqual(fs.statSync(path.join(state, 'core/topics/alpha/experiments/E1-frame-budget/data/run.sh')).mode & 0o777, 0o755, 'a script kept executable');
      assert.strictEqual(read('core/topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/problem.md'), '# Sub-problem\n');
    });
  });

  describe('an epic mid-discussion', () => {
    it('places every file it has a place for, keeps each it has none for as legacy at its path from the unit\'s old folder, and drops its analysis', () => {
      assert.deepStrictEqual(tree(state, 'core'), [
        'assets/diagram.png',
        'assets/legacy/discovery/briefs/zeta.md',
        'assets/legacy/discussion/stray.md',
        'assets/legacy/experiment/alpha/notes.md',
        'assets/legacy/experiment/alpha/scratch/try.txt',
        'assets/legacy/experiment/exploration-superseded-2026-01-01-1200/E3-cache-size/report.md',
        'assets/legacy/notes.txt',
        'assets/legacy/research/multi-tenancy/TenantTestCase.php',
        'assets/legacy/research/multi-tenancy/overview.md',
        'assets/legacy/specification/search/order-tracking-notes.md',
        'assets/legacy/specification/search/review-input-tracking-c1.md',
        'assets/notes.md',
        'assets/research/exploration-superseded-2026-01-01-1200.md',
        'assets/specs/search.md',
        'discovery/session-001.md',
        'discovery/session-002.md',
        'discovery/session-003.md',
        'manifest.json',
        'seeds/2026-01-01--search.md',
        'topics/alpha/brief.md',
        'topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/data/sample.tsv',
        'topics/alpha/experiments/E1-frame-budget/E1.1-one-monitor/problem.md',
        'topics/alpha/experiments/E1-frame-budget/data/harness/run.sh',
        'topics/alpha/experiments/E1-frame-budget/data/rubric.md',
        'topics/alpha/experiments/E1-frame-budget/data/run.csv',
        'topics/alpha/experiments/E1-frame-budget/data/run.sh',
        'topics/alpha/experiments/E1-frame-budget/design.md',
        'topics/alpha/experiments/E1-frame-budget/problem.md',
        'topics/alpha/experiments/E1-frame-budget/report.md',
        'topics/alpha/log.md',
        'topics/beta/mail/001-first.md',
        'topics/beta/mail/002-second.md',
        'topics/beta/mail/003-third.md',
        'topics/epsilon/log.md',
        'topics/gamma/mail/004-late.md', 'topics/gamma/mail/005-support-address.md', 'topics/gamma/mail/006-storage-framing.md',
        'topics/theta/log.md',
      ]);
    });

    it('moves its brief into its topic, its sessions numbers kept and their headings demoted, its seeds and imports as they are, an unbuilt spec as a reference asset', () => {
      assert.strictEqual(read('core/topics/alpha/brief.md'), '# Alpha brief\n\nFrom [notes](../../assets/notes.md).\n');
      assert.strictEqual(read('core/discovery/session-001.md'), '## Discovery Session 001\n\n### Not taken\n\n- Sharding — too early, the person said.\n');
      assert.strictEqual(read('core/seeds/2026-01-01--search.md'), '# Search\n');
      assert.deepStrictEqual(fs.readFileSync(path.join(state, 'core/assets/diagram.png')), PNG);
      assert.strictEqual(read('core/assets/specs/search.md'), '# Specification: Search\n\n[n](../notes.md) and [its notes](../legacy/specification/search/order-tracking-notes.md)\n');
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
            approved_at: '2026-01-01T00:00:00.000Z',
            items: {
              alpha: { source: 'discovery', summary: 'Alpha', order: 1 },
              beta: { source: 'message:alpha', summary: 'Beta', order: 2 },
              gamma: { source: 'discovery', summary: 'Gamma', order: 5 },
              delta: { source: 'discovery', summary: 'Delta', cancelled: true, previous_order: 4 },
              epsilon: { source: 'discovery', summary: 'Epsilon', order: 6 },
              eta: { source: 'discovery', summary: 'Eta', postponed: true, previous_order: 7 },
              theta: { source: 'discovery', summary: 'Theta', order: 8 },
              iota: { source: 'discovery', summary: 'Iota', order: 9 },
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
        },
      });
      assert.strictEqual(read('core/manifest.json'), json(manifestOf('core')), 'in the engine\'s serialisation');
    });

    it('drops every item\'s reconcile flag, whatever it holds and whatever phase holds it, and carries none from research', () => {
      const flagged = (/** @type {string} */ unit) => Object.entries(manifestOf(unit).phases)
        .flatMap(([phase, entry]) => Object.entries(entry.items || {}).filter(([, item]) => 'reconcile_needed' in item).map(([topic]) => `${phase}/${topic}`));
      assert.deepStrictEqual([flagged('core'), flagged('shop')], [[], []]);
    });

    it('keeps no spec or planning items where nothing is built, its specs and plans reference assets and its one spec written fresh (21.8.2, 21.8.3)', () => {
      assert.deepStrictEqual(['specification', 'planning'].filter((phase) => phase in manifestOf('core').phases), [], 'a planned epic, nothing built');
      assert.ok(!('specification' in manifestOf('shared').phases), 'a cross-cutting unit builds nothing');
    });
  });

  describe('an epic whose building started (21.S49)', () => {
    it('keeps its sessions, puts its plans and review folders in its assets with their files\' names, joins its built spec into spec.md, and keeps its implementation folders and tracking files as legacy', () => {
      assert.deepStrictEqual(tree(state, 'shop'), [
        'assets/legacy/implementation/ranking/analysis-tasks-c1.md',
        'assets/legacy/implementation/ranking/fix-tracking-ranking-1-1.md',
        'assets/legacy/planning/ranking/review-integrity-tracking-c1.md',
        'assets/legacy/specification/ranking/review-input-tracking-c1.md',
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
        'spec.md',
        'topics/event-tracking/log.md',
        'topics/ranking/log.md',
      ]);
      assert.deepStrictEqual([read('shop/spec.md'), manifestOf('shop').spec], ['# Shop\n\n## 1. Ranking\n', { joined: ['ranking'] }]);
    });

    it('drops staging, review cycles, the spec\'s gate modes, plan review tracking and dependencies, keeping the build\'s standing and its spec items for the cut; its topics off the map put on it, every topic in the order', () => {
      assert.deepStrictEqual(manifestOf('shop').phases, {
        discovery: {
          items: { ranking: { source: 'discovery', summary: 'Ranking', order: 1 }, 'event-tracking': { source: 'migration-seeded', order: 2 }, 'usage-analysis': { source: 'migration-seeded', order: 3 } },
          approved_at: '2026-01-01T00:00:00.000Z',
        },
        discussion: { items: { ranking: { status: 'completed' }, 'event-tracking': { status: 'completed' }, 'usage-analysis': { status: 'completed' } } },
        specification: { items: { ranking: { status: 'completed', sources: { ranking: { status: 'incorporated' } } } } },
        planning: { items: { ranking: { status: 'completed', format: 'sample-format', phase: 2, task: 1, task_map: { 'ranking-1-1': 'ext-a1' }, storage_paths: ['.tracker'] } } },
        implementation: { items: { ranking: { status: 'in-progress', current_phase: 2, current_task: 'ranking-2-1', completed_tasks: ['ranking-1-1'], bank: [{ finding: 'later' }] } } },
        review: { items: { ranking: { status: 'in-progress', reviewed_tasks: ['ranking-1-1'] } } },
      });
    });
  });

  describe('quick-fixes, and a cancelled unit', () => {
    it('makes a completed quick-fix\'s spec its summary, its plan legacy, and its scoping and every item past the topics\' gone — its spec\'s, its plan\'s and its implementation\'s, which today\'s engine never reads (21.S45)', () => {
      assert.deepStrictEqual(tree(state, 'typo'), ['assets/legacy/planning/typo/planning.md', 'manifest.json', 'summary.md']);
      assert.strictEqual(read('typo/summary.md'), '# Typo\n\nFix the typo in the header.\n');
      assert.deepStrictEqual(manifestOf('typo').phases, {});
    });

    it('keeps a quick-fix whose old pipeline is not done — built with its review still owed, or its implementation or its scoping reopened after its review — as one being built: its spec and plan reference assets, and their items less the retired state', () => {
      const built = (/** @type {string} */ wu, /** @type {string} */ building, /** @type {boolean} */ reviewed) => [
        [`assets/plans/${wu}/planning.md`, `assets/specs/${wu}.md`, 'manifest.json'], 'in-progress', {
          specification: { items: { [wu]: { status: 'completed' } } },
          planning: { items: { [wu]: quickFixPlan(wu) } },
          implementation: { items: { [wu]: { status: building } } },
          ...(reviewed ? { review: { items: { [wu]: { status: 'completed' } } } } : {}),
        },
      ];
      assert.deepStrictEqual(['patch', 'redo', 'rescope'].map((wu) => [tree(state, wu), manifestOf(wu).status, manifestOf(wu).phases]), [
        built('patch', 'completed', false),
        built('redo', 'in-progress', true),
        built('rescope', 'completed', true),
      ]);
    });

    it('moves a quick-fix whose old pipeline completed — its scoping, implementation and review — as a completed one, whatever its status reads: its spec its summary, its plan legacy and every item of its old pipeline gone; in progress, it is completed; cancelled, it stays so (21.5.15, 21.5.14)', () => {
      assert.deepStrictEqual(['stale', 'dropped'].map((wu) => [tree(state, wu), read(`${wu}/summary.md`), manifestOf(wu).status, manifestOf(wu).phases]), [
        [['assets/legacy/planning/stale/planning.md', 'manifest.json', 'summary.md'], '# stale\n\nFixed.\n', 'completed', {}],
        [['assets/legacy/planning/dropped/planning.md', 'manifest.json', 'summary.md'], '# dropped\n\nFixed.\n', 'cancelled', {}],
      ]);
    });

    it('keeps every tracking and analysis file as legacy, known by its whole name, the review reports and the person\'s files named for tracking or analysis placed as any other (21.S46)', () => {
      const moved = tree(state).filter((rel) => !rel.startsWith('.'));
      assert.deepStrictEqual(moved.filter((rel) => /tracking|analysis/.test(rel)), [
        'core/assets/legacy/specification/search/order-tracking-notes.md',
        'core/assets/legacy/specification/search/review-input-tracking-c1.md',
        'shop/assets/legacy/implementation/ranking/analysis-tasks-c1.md',
        'shop/assets/legacy/implementation/ranking/fix-tracking-ranking-1-1.md',
        'shop/assets/legacy/planning/ranking/review-integrity-tracking-c1.md',
        'shop/assets/legacy/specification/ranking/review-input-tracking-c1.md',
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
  const movedProject = () => JSON.parse(fs.readFileSync(path.join(dir, '.ledger/manifest.json'), 'utf8'));

  it('21.S50: keeps a native or completed baseline as the brownfield offer\'s answer, in today\'s words, and none for a baseline under way, the status fields gone either way (21.11.2, 8.12.11)', () => {
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

  it('7.S6: sets no driver, so the task driver its settings read is the default, the plan\'s format and the project skills gone and the defaults with them (7.1.11, 22.3.1, 22.3.2, 22.4.3)', () => {
    dir = tempProject('migration-078-drivers-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: {}, defaults: { plan_format: 'local-markdown', project_skills: [] } }));
      commitAll(dir);
      run(dir);
      const { project_id: _id, ...project } = movedProject();
      const { driver, set } = chosenDriver(dir, 'task');
      assert.deepStrictEqual([project, driver.name, set], [{ work_units: {} }, listDrivers('task').find(({ isDefault }) => isDefault)?.name, false]);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('writes a topic on the map its row\'s description as its brief, under its name, where no brief came to it, whatever its items — never started, a discussion a message opened and no one began, research cancelled before it was written, a discussion under way; one a brief came to keeps its own', () => {
    dir = tempProject('migration-078-described-');
    try {
      const row = (/** @type {string} */ name) => ({ routing: 'discussion', source: 'discovery', summary: name, description: `What ${name} covers.\n\nAnd why.` });
      write(dir, '.workflows/manifest.json', json({ work_units: { atlas: { work_type: 'epic' } } }));
      write(dir, '.workflows/atlas/manifest.json', json(unit('atlas', 'epic', 'in-progress', {
        discovery: { items: { 'deep-links': row('deep links'), lambda: row('lambda'), mu: row('mu'), pricing: row('pricing'), scale: row('scale') } },
        discussion: { items: { mu: { status: 'in-progress' }, pricing: { status: 'unstarted' } } },
        research: { items: { scale: { status: 'cancelled' } } },
      })));
      write(dir, '.workflows/atlas/discovery/briefs/lambda.md', '# Lambda brief\n');
      write(dir, '.workflows/atlas/discussion/mu.md', '# Discussion: Mu\n');
      commitAll(dir);
      run(dir);
      const brief = (/** @type {string} */ topic) => {
        const file = path.join(dir, '.ledger/atlas/topics', topic, 'brief.md');
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      };

      const described = (/** @type {string} */ name) => `# ${name}\n\nWhat ${name.toLowerCase()} covers.\n\nAnd why.\n`;
      assert.deepStrictEqual(['deep-links', 'lambda', 'mu', 'pricing', 'scale'].map(brief), [described('Deep Links'), '# Lambda brief\n', described('Mu'), described('Pricing'), described('Scale')]);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('removes a .worktreeinclude that held only the workflows\' lines; renames the permission rules of settings holding no hook of the engine\'s; ignores no tracker\'s files where there is no store; and makes no user-level folder or link where today\'s skills left none', () => {
    dir = tempProject('migration-078-include-');
    const user = homes('none');
    try {
      write(dir, '.worktreeinclude', '.workflows/.knowledge/store.bin\n\n.workflows/.knowledge/config.json\n');
      write(dir, '.claude/settings.json', json({ permissions: { allow: ['Edit(.workflows/**)'] } }));
      feature();
      run(dir);
      assert.ok(!fs.existsSync(path.join(dir, '.worktreeinclude')));
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), json({ permissions: { allow: ['Edit(.ledger/**)'] } }));
      assert.deepStrictEqual(git(dir, ['status', '--porcelain']).split('\n').filter(Boolean).sort(), [' D .worktreeinclude', ' M .claude/settings.json', '?? .gitignore']);
      assert.strictEqual(fs.readFileSync(path.join(dir, '.ledger/.gitignore'), 'utf8'), STATE_GITIGNORE);
      assert.deepStrictEqual([fs.existsSync(user.old), fs.existsSync(user.current)], [false, false]);
    } finally {
      cleanupFixture(dir);
    }
  });

  /**
   * A building epic's specs as today's layout keeps them: three live, in
   * build order 2, none and 1 — the one with none after — two of them
   * reopened as the building went on, so in progress, with an item at
   * implementation or at planning; with headings at every level, fenced
   * blocks holding headings, one a longer run closes, one a run with words
   * after it does not, one left open, a link to an import and a title of
   * its own or none; a superseded and a cancelled one, one still being
   * written and one only proposed; and a live item with no spec.
   * @param {string} at
   */
  const buildingSpecs = (at) => {
    write(at, '.workflows/manifest.json', json({ work_units: { store: { work_type: 'epic' } } }));
    write(at, '.workflows/store/manifest.json', json(unit('store', 'epic', 'in-progress', {
      discussion: { items: Object.fromEntries(['cart', 'pay', 'stock', 'old-cart', 'dropped'].map((topic) => [topic, { status: 'completed' }])) },
      specification: {
        items: {
          pay: { status: 'in-progress', order: 2 },
          stock: { status: 'in-progress' },
          'old-cart': { status: 'superseded', order: 3 },
          cart: { status: 'completed', order: 1 },
          dropped: { status: 'cancelled' },
          later: { status: 'postponed' },
          ship: { status: 'in-progress' },
          unwritten: { status: 'in-progress', order: 4 },
          drafted: { status: 'proposed' },
        },
      },
      planning: { items: { ship: { status: 'completed', format: 'sample-format' } } },
      implementation: { items: { cart: { status: 'completed' }, pay: { status: 'in-progress' } } },
    })));
    write(at, '.workflows/store/specification/cart/specification.md', '# Specification: Cart\n\nThe cart holds items.\n\n## Adding\n\nOne tap.\n\n### Limits\n\nTen at most.\n\n#### Deep\n\nAs deep as it goes.\n\n##### Deeper\n\nStill.\n\n~~~\n## Not a heading\n~~~\n\n- a step:\n\n    ```\n## nor this\n    ```\n\n```\n## Fenced\n`````\n\n## After a longer close\n\n```\n## Fenced too\n```sh\n## Still fenced\n```\n');
    write(at, '.workflows/store/specification/pay/specification.md', '# Specification: Pay\r\n\r\n## Cards\r\n\r\nSee [the sketch](../../imports/sketch.md).\r\n\r\n```text\r\n## not a heading\r\n```\r\n\r\n# A second title\r\n');
    write(at, '.workflows/store/specification/stock/specification.md', '# Specification: Stock\n\nCounts stock.\n');
    write(at, '.workflows/store/specification/later/specification.md', '# Specification: Later\n');
    write(at, '.workflows/store/specification/ship/specification.md', 'Ships it.\n\n## Sending\n\n~~~sh\n```\n# a comment\n');
    write(at, '.workflows/store/specification/old-cart/specification.md', '# Specification: Old Cart\n');
    write(at, '.workflows/store/specification/dropped/specification.md', '# Specification: Dropped\n');
    write(at, '.workflows/store/imports/sketch.md', '# Sketch\n');
  };

  /** The joined spec `buildingSpecs` leaves, as 078 writes it. */
  const STORE_SPEC = [
    '# Store', '',
    '## 1. Cart', '', 'The cart holds items.', '', '#### Adding', '', 'One tap.', '', '##### Limits', '', 'Ten at most.', '', '###### Deep', '', 'As deep as it goes.', '', '###### Deeper', '', 'Still.', '',
    '~~~', '## Not a heading', '~~~', '', '- a step:', '', '    ```', '## nor this', '    ```', '',
    '```', '## Fenced', '`````', '', '#### After a longer close', '', '```', '## Fenced too', '```sh', '## Still fenced', '```', '',
    '## 2. Pay', '', '#### Cards', '', 'See [the sketch](assets/sketch.md).', '', '```text', '## not a heading', '```', '', '#### A second title', '',
    '## 3. Ship', '', 'Ships it.', '', '#### Sending', '', '~~~sh', '```', '# a comment', '~~~', '',
  ].join('\n');

  it('joins the specs past their gate of a unit whose building started into its spec.md — concluded, or reopened as it built, in progress with its topic at planning or implementation — one area each in build order — the old order, then those with none as the manifest lists them — its words kept but for its headings, demoted below the parts\' level outside a fenced block of backticks or tildes at any indent, a list item\'s among them, closed only by a bare run of its mark as long or longer, a fence left open closed by its own mark and its links to the imports pointed from spec.md; the spec titled with the unit\'s name, read with no fault as joined, the manifest marking it joined; its other specs reference assets — a spec still being written among them, its item gone, its topic decided in no spec — and a proposed one\'s item gone (21.8.5, 21.8.9, E5)', () => {
    dir = tempProject('migration-078-join-');
    try {
      buildingSpecs(dir);
      commitAll(dir);
      run(dir);
      const at = (/** @type {string} */ rel) => fs.readFileSync(path.join(dir, '.ledger/store', rel), 'utf8');
      const reading = specReading(at('spec.md'), true);
      assert.deepStrictEqual([at('spec.md'), reading.faults, reading.headings.map(({ kind, title }) => `${kind} ${title}`)], [STORE_SPEC, [], ['area Cart', 'area Pay', 'area Ship']]);
      const { spec, phases } = JSON.parse(at('manifest.json'));
      assert.deepStrictEqual([spec, Object.keys(phases.specification.items).sort(), phases.discussion.items.stock], [{ joined: ['cart', 'pay', 'ship'] }, ['cart', 'dropped', 'later', 'old-cart', 'pay', 'ship'], { status: 'completed' }]);
      assert.deepStrictEqual(tree(path.join(dir, '.ledger/store'), 'assets'), ['sketch.md', 'specs/dropped.md', 'specs/later.md', 'specs/old-cart.md', 'specs/stock.md']);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('21.S32: joins a completed unit\'s specs, its two concluded discussions that never reached a spec still decided topics of the finished unit; it and a cancelled unit keep no item of the old plan or its review, history waiting on no cut (21.8.11)', () => {
    dir = tempProject('migration-078-completed-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { done: { work_type: 'epic' }, gone: { work_type: 'feature' } } }));
      write(dir, '.workflows/gone/manifest.json', json(unit('gone', 'feature', 'cancelled', {
        discussion: { items: { gone: { status: 'completed' } } },
        specification: { items: { gone: { status: 'completed' } } },
        planning: { items: { gone: { status: 'completed', format: 'sample-format' } } },
        implementation: { items: { gone: { status: 'in-progress' } } },
        review: { items: { gone: { status: 'in-progress' } } },
      })));
      write(dir, '.workflows/gone/discussion/gone.md', '# Discussion: Gone\n');
      write(dir, '.workflows/gone/specification/gone/specification.md', '# Specification: Gone\n\nNone of it.\n');
      write(dir, '.workflows/done/manifest.json', json(unit('done', 'epic', 'completed', {
        discussion: { items: Object.fromEntries(['cart', 'pay', 'loyalty', 'gifts'].map((topic) => [topic, { status: 'completed' }])) },
        specification: { items: { cart: { status: 'completed', order: 1 }, pay: { status: 'completed', order: 2 } } },
        implementation: { items: { cart: { status: 'completed' }, pay: { status: 'completed' } } },
        review: { items: { cart: { status: 'completed' } } },
      })));
      for (const topic of ['cart', 'pay', 'loyalty', 'gifts']) write(dir, `.workflows/done/discussion/${topic}.md`, `# Discussion: ${topic}\n`);
      write(dir, '.workflows/done/specification/cart/specification.md', '# Specification: Cart\n\nOne tap.\n');
      write(dir, '.workflows/done/specification/pay/specification.md', '# Specification: Pay\n\nBy card.\n');
      commitAll(dir);
      run(dir);
      const at = (/** @type {string} */ rel, of = 'done') => fs.readFileSync(path.join(dir, '.ledger', of, rel), 'utf8');
      const { status, phases, spec } = JSON.parse(at('manifest.json'));
      assert.deepStrictEqual([at('spec.md'), spec, status], ['# Done\n\n## 1. Cart\n\nOne tap.\n\n## 2. Pay\n\nBy card.\n', { joined: ['cart', 'pay'] }, 'completed']);
      const gone = JSON.parse(at('manifest.json', 'gone'));
      assert.deepStrictEqual([Object.keys(phases).sort(), Object.keys(gone.phases), gone.spec, gone.status], [['discovery', 'discussion'], ['discussion'], { joined: ['gone'] }, 'cancelled']);
      assert.deepStrictEqual([phases.discussion.items.loyalty, phases.discussion.items.gifts, Object.keys(phases.discovery.items)], [{ status: 'completed' }, { status: 'completed' }, ['cart', 'pay', 'loyalty', 'gifts']]);
      assert.ok(['loyalty', 'gifts'].every((topic) => fs.existsSync(path.join(dir, '.ledger/done/topics', topic, 'log.md'))));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('drops each registry entry naming no unit — no folder of its name, or one with no manifest, as portal\'s config-homedir-error-test — and names it for the review, the folder\'s files kept as legacy', () => {
    dir = tempProject('migration-078-unregistered-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' }, ghost: { work_type: 'bugfix' }, husk: { work_type: 'quick-fix' } } }));
      write(dir, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: 'in-progress' } } } })));
      write(dir, '.workflows/tally/discussion/tally.md', '# Discussion: Tally\n');
      write(dir, '.workflows/husk/notes.md', '# Husk\n');
      commitAll(dir);
      const { returned } = run(dir);
      const state = path.join(dir, '.ledger');
      assert.deepStrictEqual([Object.keys(JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8')).work_units), tree(state, '.product')], [['tally'], ['assets/legacy/husk/notes.md']]);
      assert.match(String(returned?.verify), /^The registry named these units, and \.workflows\/ held no folder of theirs with a manifest, so the registry drops their entries: ghost, husk\./);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('types each registry entry as its unit\'s manifest types it, where a change of type rewrote the manifest alone, as mint\'s pivot to an epic did — journaling each correction for the review — and journals none where every entry agrees', () => {
    dir = tempProject('migration-078-mistyped-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' }, mint: { work_type: 'feature' } } }));
      write(dir, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: 'in-progress' } } } })));
      write(dir, '.workflows/mint/manifest.json', json(unit('mint', 'epic', 'completed', { discussion: { items: { release: { status: 'completed' } } } })));
      commitAll(dir);
      run(dir);
      const state = path.join(dir, '.ledger');
      const journal = path.join(state, '.cache/migrate/move.json');
      assert.deepStrictEqual([JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8')).work_units, JSON.parse(fs.readFileSync(journal, 'utf8'))], [
        { tally: { work_type: 'feature' }, mint: { work_type: 'epic' } },
        {
          corrections: [{
            unit: 'mint',
            was: 'The registry typed it "feature", and its manifest "epic".',
            found: 'Its manifest is its own record of its type, which a change of type rewrote and the registry missed.',
            changed: 'The registry types it "epic".',
          }],
        },
      ]);

      write(dir, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' }, mint: { work_type: 'epic' } } }));
      run(dir);
      assert.ok(!fs.existsSync(journal), 'a run again finding every entry agreeing journals none');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('carries a unit whose name breaks the kebab-case rule by its case alone under its lowercase name — its folder, its registry entry, its items and every reference the move wrote to it following, its legacy files kept byte for byte at their renamed paths, its old cache\'s report copied into its cache under the new name, its archived inbox item in the archive under the new name — and names the rename for the review; a name breaking the rule otherwise carried as it stands', () => {
    dir = tempProject('migration-078-case-');
    const FIX = 'drop-A-flag';
    const LEGACY_ANALYSIS = `# Analysis: ${FIX}\n`;
    try {
      write(dir, '.workflows/manifest.json', json({
        work_units: { [FIX]: { work_type: 'quick-fix' }, tally: { work_type: 'feature' }, Old_Tally: { work_type: 'feature' } },
        roadmap: { horizons: ['v1'], items: { 'flag-docs': { horizon: 'v1', summary: 'docs', kind: 'idea', origin: `park:${FIX}`, sources: [`${FIX}/specification/${FIX}/specification.md`] } } },
      }));
      write(dir, `.workflows/${FIX}/manifest.json`, json(unit(FIX, 'quick-fix', 'completed', quickFixPhases(FIX, 'completed'))));
      write(dir, `.workflows/${FIX}/specification/${FIX}/specification.md`, '# Drop the flag\n\nAttach without -A.\n');
      write(dir, `.workflows/${FIX}/planning/${FIX}/planning.md`, `# Plan: ${FIX}\n`);
      write(dir, `.workflows/${FIX}/implementation/${FIX}/analysis-tasks-c1.md`, LEGACY_ANALYSIS);
      write(dir, `.workflows/.cache/${FIX}/implementation/${FIX}/review-001.md`, '# Review\n');
      write(dir, '.workflows/tally/manifest.json', json(unit('tally', 'feature', 'in-progress', { discussion: { items: { tally: { status: 'in-progress' } } } })));
      write(dir, '.workflows/tally/discussion/tally.md', `# Discussion: Tally\n\nCorrected by \`${FIX}\`: [its spec](../../${FIX}/specification/${FIX}/specification.md).\n`);
      write(dir, `.workflows/.inbox/.archived/quickfixes/2026-01-01--${FIX}.md`, `# Drop the -A flag\n\nPromoted to ${FIX}.\n`);
      write(dir, '.workflows/Old_Tally/manifest.json', json(unit('Old_Tally', 'feature', 'in-progress', { discussion: { items: { Old_Tally: { status: 'in-progress' } } } })));
      write(dir, '.workflows/Old_Tally/discussion/Old_Tally.md', '# Discussion: Old Tally\n');
      commitAll(dir);
      const { returned } = run(dir);
      const state = path.join(dir, '.ledger');
      const read = (/** @type {string} */ rel) => fs.readFileSync(path.join(state, rel), 'utf8');
      const { work_units: units, roadmap } = JSON.parse(read('manifest.json'));
      const fix = JSON.parse(read('drop-a-flag/manifest.json'));
      assert.deepStrictEqual([Object.keys(units).sort(), roadmap.items['flag-docs'].origin, roadmap.items['flag-docs'].sources], [['Old_Tally', 'drop-a-flag', 'tally'], 'park:drop-a-flag', ['drop-a-flag/summary.md']]);
      assert.deepStrictEqual([tree(state, '.inbox'), read('.inbox/.archived/quickfixes/2026-01-01--drop-a-flag.md')], [['.archived/quickfixes/2026-01-01--drop-a-flag.md'], '# Drop the -A flag\n\nPromoted to drop-a-flag.\n']);
      assert.deepStrictEqual(fs.readdirSync(state).filter((name) => name.toLowerCase() === 'old_tally'), ['Old_Tally']);
      assert.deepStrictEqual([fix.name, fix.phases], ['drop-a-flag', {}]);
      assert.strictEqual(read('tally/topics/tally/log.md').split('\n\n').slice(-1)[0], 'Corrected by `drop-a-flag`: [its spec](../../../drop-a-flag/summary.md).\n');
      assert.deepStrictEqual(tree(state, 'drop-a-flag'), ['assets/legacy/implementation/drop-a-flag/analysis-tasks-c1.md', 'assets/legacy/planning/drop-a-flag/planning.md', 'manifest.json', 'summary.md']);
      assert.deepStrictEqual([read('drop-a-flag/assets/legacy/implementation/drop-a-flag/analysis-tasks-c1.md'), fs.readdirSync(state).filter((name) => name.toLowerCase() === 'drop-a-flag')], [LEGACY_ANALYSIS, ['drop-a-flag']]);
      assert.deepStrictEqual([tree(state, '.cache'), fs.readdirSync(path.join(state, '.cache'))], [['drop-a-flag/earlier/implementation/drop-a-flag/review-001.md'], ['drop-a-flag']]);
      assert.ok(tree(state).every((rel) => !rel.includes(FIX) && (rel.includes('/assets/legacy/') || !fs.readFileSync(path.join(state, rel)).includes(FIX))), 'no path names the old name, and no word but a legacy file\'s');
      assert.match(String(returned?.verify), /^This unit's name broke the rule a unit's name keeps .* by case alone, so it is carried under its lowercase name.*: drop-A-flag is drop-a-flag\./);
      assert.match(String(returned?.verify), /\.ledger\/drop-a-flag\/assets\/legacy\/planning\/drop-a-flag\/planning\.md/);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('joins a building unit\'s specs whole however a run is killed — writing the spec, part of it written or none, or writing the manifest marking it joined — a run again leaving what a whole run leaves', () => {
    dir = tempProject('migration-078-join-torn-');
    const realWrite = fs.writeFileSync;
    try {
      buildingSpecs(dir);
      commitAll(dir);
      for (const [holding, torn] of /** @type {const} */ ([['## 2. Pay', 'part'], ['## 1. Cart', 'none'], ['"joined"', 'part']])) {
        fs.writeFileSync = (/** @type {any} */ file, /** @type {any} */ content, /** @type {any[]} */ ...rest) => {
          if (!String(content).includes(holding)) return realWrite(file, content, ...rest);
          realWrite(file, torn === 'part' ? String(content).slice(0, Math.floor(String(content).length / 2)) : '');
          throw new Error('killed mid-write');
        };
        assert.throws(() => run(dir), /killed mid-write/, holding);
        fs.writeFileSync = realWrite;
      }
      run(dir);
      const at = (/** @type {string} */ rel) => fs.readFileSync(path.join(dir, '.ledger/store', rel), 'utf8');
      assert.deepStrictEqual([at('spec.md'), JSON.parse(at('manifest.json')).spec], [STORE_SPEC, { joined: ['cart', 'pay', 'ship'] }]);
    } finally {
      fs.writeFileSync = realWrite;
      cleanupFixture(dir);
    }
  });

  it('records the map of an epic with topics on it approved at the earliest moment the old record shows, the day the unit was made — no old manifest stamps its discovery\'s close or a discussion\'s start; an epic with no topic yet still shapes its map', () => {
    dir = tempProject('migration-078-approved-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { mapped: { work_type: 'epic' }, blank: { work_type: 'epic' } } }));
      write(dir, '.workflows/mapped/manifest.json', json({ ...unit('mapped', 'epic', 'in-progress', {
        discovery: { items: { first: { source: 'discovery', summary: 'First', order: 1 } } },
        discussion: { items: { first: { status: 'in-progress' } } },
      }), created: '2026-03-04' }));
      write(dir, '.workflows/blank/manifest.json', json(unit('blank', 'epic', 'in-progress', {})));
      commitAll(dir);
      run(dir);
      const approved = (/** @type {string} */ name) => JSON.parse(fs.readFileSync(path.join(dir, `.ledger/${name}/manifest.json`), 'utf8')).phases?.discovery?.approved_at ?? null;
      assert.deepStrictEqual([approved('mapped'), approved('blank')], ['2026-03-04T00:00:00.000Z', null]);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('puts on its map the topics of an epic that was not in progress when 038 seeded the maps, in the order its discussions stand, a cancelled one marked with its order stashed, and records the map approved the day the unit was made: completed, and cancelled', () => {
    dir = tempProject('migration-078-unmapped-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { done: { work_type: 'epic' }, dropped: { work_type: 'epic' } } }));
      write(dir, '.workflows/done/manifest.json', json({ ...unit('done', 'epic', 'completed', {
        discussion: { items: { intake: { status: 'completed' }, billing: { status: 'completed' } } },
      }), created: '2025-06-01' }));
      write(dir, '.workflows/dropped/manifest.json', json({ ...unit('dropped', 'epic', 'cancelled', {
        discussion: { items: { scope: { status: 'in-progress' }, extras: { status: 'cancelled' }, rollout: { status: 'in-progress' } } },
      }), created: '2025-07-02' }));
      commitAll(dir);
      run(dir);
      const discovery = (/** @type {string} */ name) => JSON.parse(fs.readFileSync(path.join(dir, `.ledger/${name}/manifest.json`), 'utf8')).phases.discovery;
      assert.deepStrictEqual([discovery('done'), discovery('dropped')], [
        {
          items: { intake: { source: 'migration-seeded', order: 1 }, billing: { source: 'migration-seeded', order: 2 } },
          approved_at: '2025-06-01T00:00:00.000Z',
        },
        {
          items: {
            scope: { source: 'migration-seeded', order: 1 },
            extras: { source: 'migration-seeded', cancelled: true, previous_order: 2 },
            rollout: { source: 'migration-seeded', order: 3 },
          },
          approved_at: '2025-07-02T00:00:00.000Z',
        },
      ]);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('orders every topic on an old epic\'s map that holds none after the highest it uses, in the order the old record lists them — a closed one stashing its number — each that holds one keeping it', () => {
    dir = tempProject('migration-078-ordered-');
    try {
      write(dir, '.workflows/manifest.json', json({ work_units: { mixed: { work_type: 'epic' } } }));
      write(dir, '.workflows/mixed/manifest.json', json(unit('mixed', 'epic', 'in-progress', {
        discovery: {
          items: {
            seeded: { source: 'migration-seeded' },
            second: { source: 'discovery', summary: 'Second', order: 2 },
            parked: { source: 'discovery', summary: 'Parked', postponed: true },
            stashed: { source: 'discovery', summary: 'Stashed', cancelled: true, previous_order: 4 },
            first: { source: 'discovery', summary: 'First', order: 1 },
          },
        },
        discussion: { items: { seeded: { status: 'in-progress' }, second: { status: 'in-progress' }, first: { status: 'in-progress' }, later: { status: 'in-progress' } } },
      })));
      commitAll(dir);
      run(dir);
      const { items } = JSON.parse(fs.readFileSync(path.join(dir, '.ledger/mixed/manifest.json'), 'utf8')).phases.discovery;
      assert.deepStrictEqual(Object.fromEntries(Object.entries(items).map(([topic, { order, previous_order: stashed }]) => [topic, [order ?? null, stashed ?? null]])), {
        seeded: [5, null], second: [2, null], parked: [null, 6], stashed: [null, 4], first: [1, null], later: [7, null],
      });
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
      const { phases } = JSON.parse(fs.readFileSync(path.join(dir, '.ledger/lab/manifest.json'), 'utf8'));
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
      assert.strictEqual(fs.readFileSync(path.join(dir, `.ledger/.inbox/ideas/${TODAY}--late-word.md`), 'utf8'), '# Late word\nFrom Spun · 1 Jan\n\nDetails of late word.\n');
      assert.deepStrictEqual(tree(path.join(dir, '.ledger'), 'lab/topics/stalled'), ['log.md']);
    } finally {
      cleanupFixture(dir);
    }
  });

  it('names in its notice each task driver\'s folder whose declaration does not read, carrying no store of it', () => {
    dir = tempProject('migration-078-unread-');
    const skills = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-078-skills-')));
    try {
      const migrations = path.join(skills, 'ledger-migrate/scripts/migrations');
      const drivers = path.join(skills, 'ledger-engine/scripts/drivers/task');
      fs.cpSync(path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations'), migrations, { recursive: true });
      fs.cpSync(TASK_DRIVERS, drivers, { recursive: true });
      write(drivers, 'broken/pre-ledger-store.json', '{"files": ".broken/store", "localFiles": []}\n');
      feature();
      const copy = require(path.join(migrations, '078-reshape-move.cjs'));
      const returned = copy.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
      assert.deepStrictEqual(returned, {
        notice: `The task driver folder ${path.join(drivers, 'broken')} holds no pre-ledger-store.json that reads, so the move carried no store declared there into the state: a store this project kept for such a tracker stays where it is.`,
      });
    } finally {
      cleanupFixture(dir);
      fs.rmSync(skills, { recursive: true, force: true });
    }
  });

  it('leaves settings that do not parse as they are, and says so', () => {
    dir = tempProject('migration-078-settings-');
    try {
      write(dir, '.claude/settings.json', `{ "hooks": ${OLD_ENGINE}`);
      feature();
      const { returned } = run(dir);
      assert.strictEqual(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8'), `{ "hooks": ${OLD_ENGINE}`);
      assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '?? .gitignore');
      assert.deepStrictEqual(returned, {
        verify: `${dir}/.claude/settings.json does not parse, so it was left naming the engine at .claude/skills/workflow-engine/scripts/engine.cjs and the state at .workflows/: `
          + 'once it parses, name .claude/skills/ledger-engine/scripts/engine.cjs in each hook and .ledger/ in each permission rule.',
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
      assert.deepStrictEqual(Object.fromEntries(tree(user.current).map((rel) => [rel, fs.readFileSync(path.join(user.current, rel), 'utf8')])), fresh);
      assert.deepStrictEqual(returned, {
        verify: `Nothing in ${user.old} was moved: ${user.current} already holds a different config.json, conversations/s1/position.json. `
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
      assert.deepStrictEqual([fs.readlinkSync(user.old), tree(dotfiles), fs.existsSync(user.current)], [dotfiles, ['config.json'], false]);
      assert.deepStrictEqual(returned, {
        verify: `${user.old} is a link to ${dotfiles}, not a folder of its own, so nothing in it was moved to ${user.current}: move what the workflows keep there into ${user.current} yourself.`,
      });
    } finally {
      homes('none');
      cleanupFixture(dir);
    }
  });


  it('puts the runner\'s record and journals, written in a plain .ledger/ before the move, inside the state worktree, the journals ignored, and keeps on the project\'s manifest the checklist a directive closed there', () => {
    dir = tempProject('migration-078-record-');
    try {
      feature();
      const checklists = { directive: { '076-legacy-split': { items: {}, closed: '2026-01-01T00:00:00Z' } } };
      write(dir, '.ledger/.state/migrations', '001\n073\n076\n');
      write(dir, '.ledger/.cache/migrate/pending-tally.json', '{"ran":["073"]}\n');
      write(dir, '.ledger/manifest.json', json({ checklists }));
      run(dir);
      const state = path.join(dir, '.ledger');
      const { project_id: _id, ...project } = movedProject();
      assert.deepStrictEqual(project, { work_units: { tally: { work_type: 'feature' } }, checklists });
      assert.strictEqual(fs.readFileSync(path.join(state, '.state/migrations'), 'utf8'), '001\n073\n076\n');
      assert.strictEqual(fs.readFileSync(path.join(state, '.cache/migrate/pending-tally.json'), 'utf8'), '{"ran":["073"]}\n');
      assert.doesNotThrow(() => git(state, ['check-ignore', '--quiet', '.cache/migrate/pending-tally.json']), 'the journal ignored in the state');
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/ledger-state');
      assert.ok(!fs.existsSync(path.join(dir, '.ledger-set-aside')));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('run again over a move cut short — the worktree added but not locked, part written, its knowledge config among it — writes the whole state, locked, its project id, idea and ignore line kept', () => {
    dir = tempProject('migration-078-again-');
    try {
      write(dir, '.workflows/.knowledge/config.json', KNOWLEDGE_CONFIG);
      feature(dir, 'cancelled');
      const state = path.join(dir, '.ledger');
      git(dir, ['worktree', 'add', '--quiet', '--detach', '--no-checkout', '.ledger', 'HEAD']);
      git(state, ['switch', '--quiet', '--orphan', 'ledger-state']);
      write(state, 'manifest.json', json({ project_id: 'CutShort0123456789abc', work_units: {} }));
      write(state, `.inbox/ideas/${TODAY}--dropped.md`, DROPPED_IDEA);
      write(state, '.knowledge/config.json', KNOWLEDGE_CONFIG.slice(0, 12));
      write(state, 'tally/topics/tally/log.md', '## Disc');
      write(dir, '.gitignore', '.ledger/\n');
      run(dir);
      assert.deepStrictEqual(tree(state).filter((rel) => rel !== '.git'), [
        '.gitignore', `.inbox/ideas/${TODAY}--dropped.md`, '.knowledge/config.json', 'manifest.json', 'tally/manifest.json', 'tally/topics/tally/log.md',
      ]);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(state, 'manifest.json'), 'utf8')),
        { project_id: 'CutShort0123456789abc', work_units: { tally: { work_type: 'feature' } } });
      assert.strictEqual(fs.readFileSync(path.join(state, '.knowledge/config.json'), 'utf8'), KNOWLEDGE_CONFIG);
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n## Discussion: Tally\n');
      assert.strictEqual(fs.readFileSync(path.join(state, `.inbox/ideas/${TODAY}--dropped.md`), 'utf8'), DROPPED_IDEA);
      assert.strictEqual(lockOf(dir, state), 'Ledger state, do not remove');
      assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.ledger/\n', 'the ignore line written once');
      const whole = Object.fromEntries(tree(state).map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')]));
      run(dir);
      assert.deepStrictEqual(Object.fromEntries(tree(state).map((rel) => [rel, fs.readFileSync(path.join(state, rel), 'utf8')])), whole, 'run again over a whole move, its worktree locked, the same state');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('moves a project nested in its repository from its own folder, the state at the main checkout and the ignore line in the project\'s .gitignore', () => {
    dir = tempProject('migration-078-nested-');
    try {
      write(dir, 'README.md', 'the repository\n');
      const app = path.join(dir, 'app');
      feature(app);
      const { updates, skips } = run(app);
      const state = path.join(dir, '.ledger');
      assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/ledger-state');
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n## Discussion: Tally\n');
      assert.ok(!fs.existsSync(path.join(app, '.ledger')), 'no state in the project folder');
      assert.strictEqual(fs.readFileSync(path.join(app, '.gitignore'), 'utf8'), '.ledger/\n');
      assert.ok(!fs.existsSync(path.join(dir, '.gitignore')), 'the repository\'s top untouched');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('run again after the person removed a cut-short .ledger/, clears the registration it left and adds the worktree again', () => {
    dir = tempProject('migration-078-removed-');
    try {
      feature();
      run(dir);
      fs.rmSync(path.join(dir, '.ledger'), { recursive: true, force: true });
      write(dir, '.ledger/.state/migrations', '001\n073\n');
      run(dir);
      const state = path.join(dir, '.ledger');
      assert.strictEqual(git(state, ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/ledger-state');
      assert.strictEqual(lockOf(dir, state), 'Ledger state, do not remove');
      assert.strictEqual(fs.readFileSync(path.join(state, '.state/migrations'), 'utf8'), '001\n073\n');
      assert.strictEqual(fs.readFileSync(path.join(state, 'tally/topics/tally/log.md'), 'utf8'), '## Discussion\n\n## Discussion: Tally\n');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('writes each file a run again reads back whole or not at all — the project\'s own files, its manifest, and the linters carried onto it — so a run killed writing each, part of it written or none, is run again to what a whole run leaves', () => {
    dir = tempProject('migration-078-torn-');
    const realWrite = fs.writeFileSync;
    const part = (/** @type {string} */ text) => text.slice(0, Math.floor(text.length / 2));
    const none = () => '';
    try {
      write(dir, '.gitignore', 'node_modules/\n');
      write(dir, '.claude/settings.json', json({ permissions: { allow: ['Edit(.workflows/**)'] } }));
      write(dir, '.worktreeinclude', '.env.local\n.workflows/.knowledge/store.bin\n');
      feature();
      write(dir, '.workflows/manifest.json', json({ work_units: { tally: { work_type: 'feature' } }, defaults: { linters: ['eslint'] } }));
      commitAll(dir);
      for (const { holding, torn } of [
        { holding: 'node_modules/', torn: part },
        { holding: '.ledger/**', torn: none },
        { holding: '.env.local', torn: part },
        { holding: '"defaults"', torn: part },
        { holding: '"environment"', torn: none },
      ]) {
        fs.writeFileSync = (/** @type {any} */ file, /** @type {any} */ content, /** @type {any[]} */ ...rest) => {
          if (!String(content).includes(holding)) return realWrite(file, content, ...rest);
          realWrite(file, torn(String(content)));
          throw new Error('killed mid-write');
        };
        assert.throws(() => run(dir), /killed mid-write/, holding);
        fs.writeFileSync = realWrite;
      }
      run(dir);
      assert.deepStrictEqual(
        ['.gitignore', '.claude/settings.json', '.worktreeinclude'].map((rel) => fs.readFileSync(path.join(dir, rel), 'utf8')),
        ['node_modules/\n.ledger/\n', json({ permissions: { allow: ['Edit(.ledger/**)'] } }), '.env.local\n'],
      );
      const project = JSON.parse(fs.readFileSync(path.join(dir, '.ledger/manifest.json'), 'utf8'));
      assert.deepStrictEqual([Object.keys(project), project.environment], [['project_id', 'work_units', 'environment'], { linters: [{ name: 'eslint', command: 'eslint' }] }]);
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
      assert.ok(!fs.existsSync(path.join(dir, '.ledger')));
      assert.ok(!fs.existsSync(path.join(dir, '.gitignore')));
    } finally {
      cleanupFixture(dir);
    }
  });

  it('ignores .ledger/ in the code tree\'s .gitignore, staging nothing, with hooks off and the caller\'s git environment cleared', () => {
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
      try {
        counts = run(dir);
      } finally {
        if (held === undefined) delete process.env.GIT_DIR;
        else process.env.GIT_DIR = held;
      }
      assert.deepStrictEqual({ updates: counts.updates, skips: counts.skips }, { updates: 2, skips: 0 });
      assert.strictEqual(git(path.join(dir, '.ledger'), ['symbolic-ref', 'HEAD']).trim(), 'refs/heads/ledger-state');
      assert.ok(!fs.existsSync(marker), 'no hook ran');
      assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules/\n.ledger/\n');
      assert.deepStrictEqual(git(dir, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).sort(), [' M .gitignore', ' M src/app.js']);
    } finally {
      cleanupFixture(dir);
      cleanupFixture(decoy);
    }
  });

  it('skips a project whose ledger-state has a commit already, its state written over by nothing', () => {
    dir = tempProject('migration-078-born-');
    try {
      feature();
      run(dir);
      const state = path.join(dir, '.ledger');
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

describe('migration 078: the linters carried onto the project\'s environment (reshape/linters.cjs)', () => {
  const help = (/** @type {string} */ those) => `read the linters recorded with \`node .claude/skills/ledger-engine/scripts/engine.cjs environment show\`, then record the whole list, ${those}, with \`node .claude/skills/ledger-engine/scripts/engine.cjs environment set linters\`, its JSON on stdin.`;
  /** @type {string} */
  let state;
  const writeState = (/** @type {string} */ rel, /** @type {object|string} */ value) => write(state, rel, typeof value === 'string' ? value : json(value));
  const readState = (/** @type {string} */ rel) => JSON.parse(fs.readFileSync(path.join(state, rel), 'utf8'));
  /** A unit whose implementation topics carry `linters` by topic. @param {string} name @param {Record<string, unknown>} linters */
  const unitWith = (name, linters) => writeState(`${name}/manifest.json`, {
    name, work_type: 'epic', status: 'in-progress',
    phases: {
      discussion: { items: { cards: { status: 'completed' } } },
      implementation: { items: Object.fromEntries(Object.entries(linters).map(([topic, held]) => [topic, { status: 'in-progress', linters: held, current_task: null }])) },
    },
  });

  beforeEach(() => { state = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-078-linters-'))); });
  afterEach(() => { fs.rmSync(state, { recursive: true, force: true }); });

  it('carries the default\'s linters and each topic\'s onto environment.linters, by name, a name carried already with another command named for the review, and removes the old fields, every other field kept', () => {
    writeState('manifest.json', { project_id: 'p1', work_units: { pay: {}, cards: {} }, defaults: { project_skills: ['go'], linters: [{ name: 'eslint', detail: 'npx eslint .' }] } });
    unitWith('pay', { checkout: ['tsc', { name: 'eslint', command: 'eslint src' }] });
    unitWith('cards', { form: [{ name: 'prettier', command: 'npx prettier --check .' }], store: [{ name: 'vet' }] });

    assert.strictEqual(carryLinters(state), `These linters were not carried into environment.linters, a linter of the same name being carried already with another command: eslint (eslint src). Add each still wanted: ${help('those added')}`);
    assert.deepStrictEqual(readState('manifest.json'), {
      project_id: 'p1', work_units: { pay: {}, cards: {} }, defaults: { project_skills: ['go'] },
      environment: { linters: [
        { name: 'eslint', command: 'npx eslint .' },
        { name: 'prettier', command: 'npx prettier --check .' },
        { name: 'vet', command: 'vet' },
        { name: 'tsc', command: 'tsc' },
      ] },
    });
    assert.deepStrictEqual(readState('pay/manifest.json').phases.implementation.items, { checkout: { status: 'in-progress', current_task: null } });
    assert.deepStrictEqual(readState('cards/manifest.json').phases, {
      discussion: { items: { cards: { status: 'completed' } } },
      implementation: { items: { form: { status: 'in-progress', current_task: null }, store: { status: 'in-progress', current_task: null } } },
    });
  });

  it('carries each linter\'s check command, a lint command beside its fix command among them, and names for the review what the environment\'s linter has no room for — the fix command, a scope — once each', () => {
    const swiftformat = { name: 'swiftformat', lint_command: 'swiftformat Sources Tests Package.swift --lint --swiftversion 6.0', fix_command: 'swiftformat Sources Tests Package.swift --swiftversion 6.0' };
    const pint = { name: 'pint', command: 'cd api && composer pint', scope: 'api' };
    const eslint = { name: 'eslint', command: 'cd app && npm run lint -- --fix', scope: 'app' };
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: [swiftformat, pint, eslint] } });
    unitWith('pay', { checkout: [swiftformat, pint] });

    assert.strictEqual(carryLinters(state), 'The linters were carried into environment.linters as a name and a command, which leaves out '
      + 'swiftformat\'s fix_command ("swiftformat Sources Tests Package.swift --swiftversion 6.0"), pint\'s scope ("api"), eslint\'s scope ("app"). '
      + `Change a linter's command where any is still wanted, when ready to build asks to confirm the project's setup, or now: ${help('those changed')}`);
    assert.deepStrictEqual(readState('manifest.json').environment.linters, [
      { name: 'swiftformat', command: 'swiftformat Sources Tests Package.swift --lint --swiftversion 6.0' },
      { name: 'pint', command: 'cd api && composer pint' },
      { name: 'eslint', command: 'cd app && npm run lint -- --fix' },
    ]);
  });

  it('carries an entry whose command a linter carried already runs, under another name, as that linter, and names it for the review — portal\'s and tick\'s entries', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: [{ name: 'golangci-lint', command: 'golangci-lint run ./...' }, { name: 'go vet', command: 'go vet ./...' }] } });
    unitWith('pay', { checkout: ['golangci-lint run ./...'], ledger: [{ name: 'go-vet', command: 'go vet ./...' }] });

    assert.strictEqual(carryLinters(state), 'These linters were carried into environment.linters as the linter carried already that runs their command, under its name: '
      + 'golangci-lint run ./... as golangci-lint, go-vet as go vet.');
    assert.deepStrictEqual(readState('manifest.json').environment.linters, [{ name: 'golangci-lint', command: 'golangci-lint run ./...' }, { name: 'go vet', command: 'go vet ./...' }]);
  });

  it('empty arrays, a confirmed none, carry as an empty list, the defaults object going once empty', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: [] } });
    unitWith('pay', { checkout: [] });

    assert.strictEqual(carryLinters(state), null);
    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { linters: [] } });
  });

  it('a project whose environment records its linters keeps them, the old fields removed all the same', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: ['eslint'] }, environment: { run: 'npm start', linters: [{ name: 'tsc', command: 'npx tsc' }] } });

    carryLinters(state);

    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { run: 'npm start', linters: [{ name: 'tsc', command: 'npx tsc' }] } });
  });

  it('an entry of no linter\'s shape is left out and named for the review; a topic\'s linters that are no array carry nothing', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: ['eslint', 7, { detail: 'npx tsc' }] } });
    unitWith('pay', { checkout: 'eslint' });

    assert.strictEqual(carryLinters(state), `These linter entries were not carried into environment.linters, being of no shape a linter was recorded in: 7, {"detail":"npx tsc"}. Add each still wanted: ${help('those added')}`);
    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { linters: [{ name: 'eslint', command: 'eslint' }] } });
    assert.deepStrictEqual(readState('pay/manifest.json').phases.implementation.items.checkout, { status: 'in-progress', current_task: null });
  });

  it('leaves a project with no old field as it is, a unit manifest that cannot be read among it', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { project_skills: [] } });
    writeState('pay/manifest.json', '{ not json');
    unitWith('cards', {});

    assert.strictEqual(carryLinters(state), null);
    assert.strictEqual(fs.readFileSync(path.join(state, 'pay/manifest.json'), 'utf8'), '{ not json');
    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', defaults: { project_skills: [] } });
  });
});
