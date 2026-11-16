'use strict';

// The whole migration's world (21.S1, 21.S3): a project on today's shape,
// its `.workflows/` committed on its code branch as the chain up to 072 left
// it, so the bash fleet before it never runs — an epic in discussion, its
// topic promoted to a cross-cutting unit, a cancelled topic holding mail, a
// decided topic whose old map decided nine subtopics, with a link already
// dead and an import its words name outside a link; a feature being built, its plan in the tracker, its
// first phase built and its second still to build; a completed epic of two
// specs, its build's report with no place; the cross-cutting unit; a
// cancelled feature; a completed quick-fix; the roadmap with a note and a
// session; and in the old cache, ignored, a report of the epic's, one of the
// cross-cutting unit's and a draft of no unit's — beside the hooks today's
// product leaves. `oldProject` makes
// it; `migrateWhole` takes it through the whole sequence as the start skill
// runs it, boot by boot: the guard and the chain to the records directive,
// whose work is scripted — each topic's record the fixture's, carried —
// then the cut and the merges', scripted too — the cross-cutting unit
// retired, the feature's phase still to build composed and joined into its
// cut — then the finish, the review's summary and gate, and the yes's
// commit. The user-level folder of today's skills is none: the move carries
// nothing from the machine. `migratedProject` is the project so migrated,
// made once per run (run-worlds.cjs) and copied, with the old state's
// listing the migration audit reads, taken before it (migration-audit.cjs),
// the state each boot answered, and the system config folder the migration
// ran under.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, initRepo, createFile, layout, writeState } = harness;
const { copyFolder } = require('./discovery-test-utils.cjs');
const { worldOfTheRun } = require('./run-worlds.cjs');
const { TODAYS_HOOKS, MIGRATED_TO_070 } = require('./boot-world.cjs');
const { SIDE } = require('./migrated-world.cjs');
const { listOld } = require('./migration-audit.cjs');

const SCRIPTS = path.dirname(harness.ENGINE);
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { composedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));

const PROJECT = 'fumi';
const LISTING = 'old-state.json';
const STATES = 'boots.json';
const CONFIG = 'leeway-config';
const RECORDS = '079-records';
const CUT_AND_MERGES = '080-cut-and-merges';
const DONE = Object.freeze({ status: 'completed' });
const TALKING = Object.freeze({ status: 'in-progress' });

/** @param {string} title @param {Record<string, string>} sections */
const doc = (title, sections) => `# ${title}\n\n${Object.entries(sections).map(([heading, body]) => `## ${heading}\n\n${body}\n`).join('\n')}`;

// The auth topic's old map, each of its subtopics decided.
const AUTH_MAP = Object.freeze(['tokens', 'expiry', 'refresh', 'scopes', 'revocation', 'rotation', 'storage', 'transport', 'lockout']);

// The feature's old plan, its phases' titles and tasks, and the first phase's tasks done.
const MEMO_PLAN = Object.freeze([{ title: 'Memos', tasks: ['Write a memo', 'Pin a memo'] }, { title: 'Sharing', tasks: ['Share a memo'] }]);

/**
 * The project's old files (the header's), its old plan's task map the
 * tracker's own ids, by `ids`.
 * @param {{root: string, phases: string[]}} plan @param {(title: string) => string} idOf
 * @returns {Record<string, string>}
 */
function oldFiles(plan, idOf) {
  const memoMap = Object.fromEntries(MEMO_PLAN.flatMap(({ tasks }, at) => [[`memo-${at + 1}`, plan.phases[at]], ...tasks.map((title, n) => [`memo-${at + 1}-${n + 1}`, idOf(title)])]));
  return {
    'README.md': '# Fumi\n',
    '.claude/settings.json': TODAYS_HOOKS,
    '.workflows/.gitignore': '.cache/\n',
    '.workflows/.cache/gateway/discussion/errors/review-001.md': '### F1: Error codes\n\nTwo errors share a code.\n',
    '.workflows/.cache/caching/discussion/invalidation/review-001.md': '### F1: Stale reads\n\nA read races its purge.\n',
    '.workflows/.cache/spec-draft.md': '# Draft\n\nA section never joined.\n',
    '.workflows/.state/migrations': [...MIGRATED_TO_070, '071', '072'].map((id) => `${id}\n`).join(''),
    '.workflows/manifest.json': jsonText({
      work_units: { gateway: { work_type: 'epic' }, caching: { work_type: 'cross-cutting' }, memo: { work_type: 'feature' }, shop: { work_type: 'epic' }, exports: { work_type: 'feature' }, typo: { work_type: 'quick-fix' } },
      roadmap: { horizons: ['next'], items: { 'dark-mode': { horizon: 'next', summary: 'Dark mode', kind: 'idea', origin: 'harvest', sources: ['.roadmap/notes/ideas/2026-01-07--dark-mode.md'] } } },
    }),
    '.workflows/.roadmap/sessions/session-001.md': doc('Roadmap Session 001', { Themes: 'Dark mode comes after the gateway.' }),
    '.workflows/.roadmap/notes/ideas/2026-01-07--dark-mode.md': '# Dark mode\n\nA dark theme for the dashboard.\n',
    '.workflows/gateway/manifest.json': jsonText({
      name: 'gateway', work_type: 'epic', status: 'in-progress', description: 'The public API', created: '2026-01-01',
      phases: {
        discovery: { items: { auth: { source: 'discovery', summary: 'Auth', order: 1 }, errors: { source: 'discovery', summary: 'Errors', order: 2 }, limits: { source: 'discovery', summary: 'Limits', order: 3, cancelled: true } } },
        discussion: { items: { auth: { ...DONE, subtopics: Object.fromEntries(AUTH_MAP.map((item) => [item, { status: 'decided' }])) }, errors: TALKING, limits: { status: 'cancelled' }, invalidation: { status: 'promoted', promoted_to: 'caching' } } },
      },
    }),
    '.workflows/gateway/discussion/auth.md': doc('Discussion: Auth', { Tokens: 'Bearer tokens, as the [old RFC](../research/rfc.md) had it. The flow is drawn at ../imports/flow.png.' }),
    '.workflows/gateway/imports/flow.png': 'PNG the token flow',
    '.workflows/gateway/discussion/errors.md': doc('Discussion: Errors', { Shape: 'Still open.' }),
    '.workflows/gateway/discussion/limits.md': doc('Discussion: Limits', { Burst: 'Cancelled: the gateway sets no limits.' }),
    '.workflows/gateway/discussion/.mailbox/limits/001-burst.md': 'Burst\n\n*From: errors · discussion · 2026-01-05*\n\nMay a client burst past the limit?\n',
    '.workflows/caching/manifest.json': jsonText({
      name: 'caching', work_type: 'cross-cutting', status: 'in-progress', description: 'Caching across the product', created: '2026-01-02',
      phases: { discussion: { items: { invalidation: DONE } }, specification: { items: { caching: { status: 'completed', sources: { invalidation: { status: 'incorporated' } } } } } },
    }),
    '.workflows/caching/discussion/invalidation.md': doc('Discussion: Invalidation', { Purging: 'Every write purges its keys.' }),
    '.workflows/caching/specification/caching/specification.md': doc('Specification: Caching', { Invalidation: 'Every write purges its keys.' }),
    '.workflows/memo/manifest.json': jsonText({
      name: 'memo', work_type: 'feature', status: 'in-progress', description: 'Memos', created: '2026-01-03',
      phases: {
        discussion: { items: { memo: DONE } },
        specification: { items: { memo: DONE } },
        planning: { items: { memo: { status: 'completed', format: 'sample-format', external_id: plan.root, task_map: memoMap } } },
        implementation: { items: { memo: { status: 'in-progress', completed_phases: [1], completed_tasks: ['memo-1-1', 'memo-1-2'] } } },
      },
    }),
    '.workflows/memo/discussion/memo.md': doc('Discussion: Memo', { Writing: 'One line, pinned or not.' }),
    '.workflows/memo/specification/memo/specification.md': doc('Specification: Memo', { Writing: 'A memo is one line.', Sharing: 'A memo is shared by link.' }),
    '.workflows/memo/planning/memo/planning.md': doc('Plan: Memo', { Phases: 'Memos, then sharing.' }),
    '.workflows/shop/manifest.json': jsonText({
      name: 'shop', work_type: 'epic', status: 'completed', description: 'The shop', created: '2026-01-04',
      phases: {
        discovery: { items: { cart: { source: 'discovery', summary: 'Cart', order: 1 }, pay: { source: 'discovery', summary: 'Pay', order: 2 } } },
        discussion: { items: { cart: DONE, pay: DONE } },
        specification: { items: { cart: { ...DONE, order: 1 }, pay: { ...DONE, order: 2 } } },
        implementation: { items: { cart: DONE, pay: DONE } },
      },
    }),
    '.workflows/shop/discussion/cart.md': doc('Discussion: Cart', { Adding: 'One tap.' }),
    '.workflows/shop/discussion/pay.md': doc('Discussion: Pay', { Cards: 'Visa and more.' }),
    '.workflows/shop/specification/cart/specification.md': doc('Specification: Cart', { Adding: 'One tap adds an item.' }),
    '.workflows/shop/specification/pay/specification.md': doc('Specification: Pay', { Cards: 'Visa and more are taken.' }),
    '.workflows/shop/implementation/cart/report.md': doc('Build report: Cart', { Built: 'Every task landed.' }),
    '.workflows/exports/manifest.json': jsonText({
      name: 'exports', work_type: 'feature', status: 'cancelled', description: 'Exports', created: '2026-01-05',
      phases: { discussion: { items: { exports: TALKING } } },
    }),
    '.workflows/exports/discussion/exports.md': doc('Discussion: Exports', { Format: 'CSV, perhaps.' }),
    '.workflows/typo/manifest.json': jsonText({
      name: 'typo', work_type: 'quick-fix', status: 'completed', description: 'A typo', created: '2026-01-06',
      phases: { scoping: { items: { typo: DONE } }, specification: { items: { typo: DONE } }, implementation: { items: { typo: DONE } } },
    }),
    '.workflows/typo/specification/typo/specification.md': '# Typo\n\nFix the header\'s spelling.\n',
  };
}

/**
 * The project on today's shape at `{folder}/fumi` (the header's), committed,
 * its old plan in its tracker: the project's folder.
 * @param {string} folder
 */
function oldProject(folder) {
  const dir = initRepo(path.join(folder, PROJECT));
  SIDE.projectStore(dir);
  const plan = SIDE.oldPlan(dir, 'memo', MEMO_PLAN);
  for (const title of ['Write a memo', 'Pin a memo']) SIDE.taskByHand(dir, 'done', title);
  for (const [rel, text] of Object.entries(oldFiles(plan, (title) => SIDE.idOf(dir, title)))) createFile(dir, rel, text);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  return dir;
}

/** @param {string} unit @param {string} topic @param {string} section */
const logCite = (unit, topic, section) => ({ path: layout.topic(unit, topic, 'log.md'), section });

// Each topic's record, as the records directive's agents would compose it.
const RECORDS_COMPOSED = Object.freeze({
  'gateway.discussion.auth': AUTH_MAP.flatMap((item, at) => [
    { ref: `q${at + 1}`, event: 'asked', text: `How does the gateway settle ${item}?`, by: 'claude', map_item: item, cites: [logCite('gateway', 'auth', 'Tokens')] },
    { ref: `d${at + 1}`, event: 'decided', answers: `q${at + 1}`, text: `Bearer tokens settle ${item}.`, why: 'The log settles it.', by: 'claude', given: 'carried', map_item: item, cites: [logCite('gateway', 'auth', 'Tokens')] },
  ]),
  'gateway.discussion.errors': [{ ref: 'q1', event: 'asked', text: 'What shape is an error?', by: 'claude', cites: [logCite('gateway', 'errors', 'Shape')] }],
  'gateway.discussion.limits': [{ ref: 'q1', event: 'asked', text: 'Does the gateway limit calls?', by: 'claude', cites: [logCite('gateway', 'limits', 'Burst')] }],
  'caching.discussion.invalidation': [
    { ref: 'q1', event: 'asked', text: 'When is a cached key purged?', by: 'claude', cites: [logCite('caching', 'invalidation', 'Purging')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'Every write purges its keys.', why: 'The log settles it.', by: 'claude', given: 'carried', product_wide: true, cites: [logCite('caching', 'invalidation', 'Purging')] },
  ],
  'memo.discussion.memo': [
    { ref: 'q1', event: 'asked', text: 'How long is a memo?', by: 'claude', cites: [logCite('memo', 'memo', 'Writing')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'One line.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [logCite('memo', 'memo', 'Writing')] },
  ],
  'shop.discussion.cart': [
    { ref: 'q1', event: 'asked', text: 'How is an item added?', by: 'claude', cites: [logCite('shop', 'cart', 'Adding')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'One tap.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [logCite('shop', 'cart', 'Adding')] },
  ],
  'shop.discussion.pay': [
    { ref: 'q1', event: 'asked', text: 'Which cards are taken?', by: 'claude', cites: [logCite('shop', 'pay', 'Cards')] },
    { ref: 'd1', event: 'decided', answers: 'q1', text: 'Visa and more.', why: 'The log settles it.', by: 'claude', given: 'carried', cites: [logCite('shop', 'pay', 'Cards')] },
  ],
  'exports.discussion.exports': [{ ref: 'q1', event: 'asked', text: 'What format do exports take?', by: 'claude', cites: [logCite('exports', 'exports', 'Format')] }],
});

// The feature's phase still to build, as the cut and the merges' per-phase agent would compose it.
const SHARING_PIECE = Object.freeze({
  phase: { name: 'Sharing', goal: 'A memo shared by link.', sections: ['1'], relies_on: [1] },
  scenarios: ['Given a memo, when it is shared, then a link opens it.'],
  notes: [],
  corrections: [],
});

/**
 * The directive boot stopped at, worked as its session would: the check's
 * pieces done by the fixture's work, then the check passing and its
 * checklist closed.
 * @param {string} dir @param {Record<string, string>} env @param {string} directive
 */
function workDirective(dir, env, directive) {
  const opts = { env };
  if (directive === RECORDS) {
    const { unfinished } = harness.ok(dir, ['migrate', 'check', RECORDS], opts);
    assert.deepStrictEqual(unfinished.map(({ name }) => name).sort(), Object.keys(RECORDS_COMPOSED).map((place) => place.replace('.discussion.', '/')).sort(), 'the records\' check names each topic');
    for (const [place, entries] of Object.entries(RECORDS_COMPOSED)) {
      const [unit, , topic] = place.split('.');
      writeState(dir, composedPath(unit, topic), JSON.stringify({ entries }));
      harness.ok(dir, ['ledger', 'carry', place], opts);
    }
  } else {
    harness.ok(dir, ['workunit', 'retire', 'caching'], opts);
    writeState(dir, layout.cache('migrate', 'cut-and-merges', 'memo', 'phases', '2.json'), JSON.stringify(SHARING_PIECE));
    writeState(dir, layout.cache('migrate', 'cut-and-merges', 'memo', 'phases', '2.findings.txt'), '');
    const { plan } = harness.ok(dir, ['migrate', 'join', 'memo', '--directive', CUT_AND_MERGES], opts);
    harness.ok(dir, ['cut', 'memo', '--migrating', '--file', plan], opts);
  }
  assert.strictEqual(harness.ok(dir, ['migrate', 'check', directive], opts).passed, true, `${directive}'s check passes`);
  harness.ok(dir, ['checklist', 'close', 'directive', directive], opts);
}

/**
 * The migration's review and gate as the start skill works them, then the
 * yes's commit.
 * @param {string} dir @param {Record<string, string>} env
 */
function reviewAndCommit(dir, env) {
  const opts = { env };
  const { state, reshape } = harness.ok(dir, ['migrate', 'review'], opts);
  assert.ok(reshape, 'the review answers the migration into Leeway');
  const summary = path.join(state, '.cache', 'migrations-applied.json');
  fs.writeFileSync(summary, JSON.stringify({ summary: 'Moved the project into Leeway.' }));
  harness.output(dir, ['render', 'migrations-applied', '--file', summary], opts);
  harness.output(dir, ['render', 'migration-gate'], opts);
  harness.ok(dir, ['commit', '--migrations', '-m', 'chore: apply workflow migrations'], opts);
}

/**
 * The project at `dir` taken through the whole sequence (the header's),
 * boot by boot, to the migration's commit: each boot's state, in order.
 * @param {string} dir @param {Record<string, string>} [extra] over the session and the user-level folder's pin
 */
function migrateWhole(dir, extra = {}) {
  const env = { CLAUDE_CODE_SESSION_ID: 'migrating', WORKFLOWS_CONFIG_DIR: path.join(path.dirname(dir), 'no-workflows-config'), ...extra };
  /** @type {string[]} */
  const states = [];
  for (let boots = 0; boots < 6; boots += 1) {
    const res = harness.ok(dir, ['boot'], { env });
    states.push(res.state === 'directive' ? `directive ${res.id}` : res.state);
    if (res.state === 'directive') workDirective(dir, env, res.id);
    else if (res.state === 'finish') reviewAndCommit(dir, env);
    else return states;
  }
  return assert.fail(`the migration never reached the start: ${states.join(', ')}`);
}

/** @param {string} folder */
function buildMigrated(folder) {
  const dir = oldProject(folder);
  fs.writeFileSync(path.join(folder, LISTING), JSON.stringify(listOld(dir)));
  fs.mkdirSync(path.join(folder, CONFIG));
  fs.writeFileSync(path.join(folder, STATES), JSON.stringify(migrateWhole(dir, { LEEWAY_CONFIG_DIR: path.join(folder, CONFIG) })));
}

/**
 * The project migrated whole at `{root}/fumi` (the header's): its folder,
 * the old state's listing, the boots' states and the system config folder
 * the migration ran under.
 * @param {string} root
 * @returns {{dir: string, old: import('./migration-audit.cjs').Listing, boots: string[], configDir: string}}
 */
function migratedProject(root) {
  const folder = copyFolder(worldOfTheRun('migrated-whole', buildMigrated).dir, root);
  const read = (/** @type {string} */ name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
  return { dir: path.join(folder, PROJECT), old: read(LISTING), boots: read(STATES), configDir: path.join(folder, CONFIG) };
}

module.exports = { PROJECT, SIDE, AUTH_MAP, oldProject, migrateWhole, migratedProject };
