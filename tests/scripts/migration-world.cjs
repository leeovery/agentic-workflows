'use strict';

// The migration's harness (tests/README.md §9), what the suites of its
// directives share: the engine copied, once per process, beside the real
// runner and the fixture directives in tests/fixtures/directives/, so it
// finds them as it finds the migrations installed (`directiveEngine`); and
// a project the migration is under way in, made once per process and
// copied (`midMigration`) — its `.workflows/` committed on its code branch
// as today's layout leaves it, and its state worktree at `.leeway/`,
// locked, on a `leeway-state` with no commit yet, holding what the move
// writes: the state's `.gitignore`, the project's manifest and id, the
// unit's manifest with its three topics, and the migrations record, which
// holds the fixture directives the boot suites never reach. And the records
// directive's world (`recordsMigration`), made once and copied: four units
// as today's layout left them and as the move wrote them, with the old agent
// store the move leaves.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, initRepo, createFile, statePath, layout, treeSnapshot } = harness;
const { templateFolder, copyWorld, STATE_DIR_NAME } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_GITIGNORE, STATE_LOCK_REASON, BRANCH_REF } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const FIXTURES = path.join(__dirname, '../fixtures/directives');
const RUNNER = path.join(SCRIPTS, '../../leeway-migrate/scripts/migrate.cjs');

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

// The fixture directives whose checks are broken, recorded so no run stops at them.
const RECORDED = ['090', '091', '092', '093'];

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
  fs.copyFileSync(RUNNER, path.join(skills, 'leeway-migrate/scripts/migrate.cjs'));
  const at = path.join(skills, 'leeway-engine/scripts/engine.cjs');
  engine = { ...harness.harness(at), path: at, migrations };
  return engine;
}

/**
 * A repository at `dir` whose code branch holds `old`, its files by path,
 * committed as today's layout leaves them, and whose state worktree at
 * `.leeway/`, locked, is on a `leeway-state` with no commit yet, holding the
 * state's `.gitignore`, the project's manifest and id, and `moved`, its
 * files by path, as the move writes them.
 * @param {string} dir @param {Record<string, string>} old @param {Record<string, string>} moved
 */
function buildUnborn(dir, old, moved) {
  initRepo(dir);
  for (const [rel, text] of Object.entries(old)) createFile(dir, rel, text);
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
// too; an epic of one topic
// whose building started, its spec still on the code branch, an import
// come in from its discovery as a whole; and a cancelled feature, an import
// come in from its discovery.
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
      specification: { items: { weights: { status: 'completed', sources: { weights: { status: 'incorporated' } } } } },
      implementation: { items: { weights: { status: 'in-progress' } } },
    },
  }),
  '.workflows/shop/specification/weights/specification.md':
    '# Specification: Weights\n\n## Ranking\n\nNewest first.\n\n### Detail\n\nBy day.\n\n## Corrigenda\n\nTies break by price, not by name.\n\n### Detail\n\nPrice before name.\n',
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
  [layout.topic('fumi', 'licensing', 'log.md')]: '## Discussion\n\n# Discussion: Licensing\n\n## Trial Length\n\n### Decision\n\nFourteen days, the person said.\n',
  [layout.topic('fumi', 'licensing', 'brief.md')]: '# Licensing\n\nHow the trial works.\n',
  [layout.topic('fumi', 'licensing', 'experiments', 'E2-trial', 'report.md')]: '# Report\n\n## Result\n\nA week converts as well, from `npm run trial`.\n',
  [layout.topic('fumi', 'search', 'log.md')]: [
    '## Research\n\n# Research: Search\n\n## Index Size\n\nStill digging.\n',
    '## Discussion\n\n# Discussion: Search\n\n## Ranking\n\n### Context\n\nOld results flood the page.\n\nBy recency.\n',
    '## Typo Tolerance\n\n### Context\n\nPeople misspell names.\n\nStill open.\n\n## Synonyms\n\nSet aside for now.\n',
    '## Review review-001, never folded in\n\n### F1: Ranking ties\n\nTwo results of one age have no order.\n',
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
  [layout.topic('platform', 'auth', 'log.md')]: '## Discussion\n\n# Discussion: Auth\n\n## Sessions\n\nThirty days, then sign in again, with tokens renewed on each.\n\n## Review review-003, never folded in\n\n### F1: Token reuse\n\nA token outlives its session.\n',
  [layout.assets('platform', 'sso.md')]: '# SSO\n',
  [layout.manifest('shop')]: jsonText({
    name: 'shop', work_type: 'epic', status: 'in-progress',
    imports: [{ path: 'assets/vision.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: {
      discussion: { items: { weights: { status: 'completed' } } },
      specification: { items: { weights: { status: 'completed', sources: { weights: { status: 'incorporated' } } } } },
      implementation: { items: { weights: { status: 'in-progress' } } },
    },
  }),
  [layout.topic('shop', 'weights', 'log.md')]: '## Discussion\n\n# Discussion: Weights\n\n## Tie Break\n\nBy name.\n',
  [layout.assets('shop', 'vision.md')]: '# Vision\n',
  [layout.manifest('gone')]: jsonText({
    name: 'gone', work_type: 'feature', status: 'cancelled',
    imports: [{ path: 'assets/notes.md', imported_at: '2026-01-01T10:00:00Z', origin: 'discovery' }],
    phases: { discussion: { items: { gone: { status: 'in-progress' } } } },
  }),
  [layout.topic('gone', 'gone', 'log.md')]: '## Discussion\n\n# Discussion: Gone\n\n## Cause\n\nA race.\n',
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
  UNIT, SESSION, DECIDED, RECORDED, FIXTURES, directiveEngine, midMigration, recordsMigration, stateUnborn, codeHead, enter, enterTopic, refusedUntouched, refusedKeeping, recorded,
};
