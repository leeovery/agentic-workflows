'use strict';

// ---------------------------------------------------------------------------
// The migration audit (migration-audit.cjs; 21.1.1, 21.1.4, 21.1.5): a
// project the whole sequence migrated passes it, writing nothing, its
// counts read, the link already dead before the migration listed apart;
// and each check refuses a world made to fail it, naming what it found. One
// world fails every check of what the state holds at once, each fault its
// own check's and none another's — the old state left, a manifest of
// another shape, a decided topic with no decision, a unit waiting on a cut,
// a cut short of the tracker's tasks and of the old plan's phases, old
// files neither placed nor kept, and a link, citation and roadmap source
// naming nothing — a unit the old registry already lacked a manifest of
// listed apart; and boot's check has two of its own: a migration the
// record lacks, which boot runs and commits, and a migration cut short at
// a directive, where boot stops.
//
// Layer: verb. World: the project migrated whole (migration-sequence-
// world.cjs), made once per process and copied for each test; each mutant
// committed, so the boot the audit runs finds nothing of its own to do.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { statePath, layout, commitAll, treeSnapshot } = harness;
const { SIDE, oldProject, migratedProject } = require('./migration-sequence-world.cjs');
const { listOld, audit } = require('./migration-audit.cjs');

/** @type {string} */
let root;
/** @type {ReturnType<typeof migratedProject>} */
let world;
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-audit-')));
  world = migratedProject(root);
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

/** @param {string} rel @returns {any} */
const readManifest = (rel) => JSON.parse(fs.readFileSync(statePath(world.dir, rel), 'utf8'));
/** @param {string} rel @param {(manifest: any) => void} change */
function changeManifest(rel, change) {
  const manifest = readManifest(rel);
  change(manifest);
  fs.writeFileSync(statePath(world.dir, rel), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** The audit's faults once the world's change is committed, each as `{check}: {found}`. */
function faults() {
  commitAll(world.dir, 'the mutant');
  return audit(world.dir, world.old).faults.map(({ check, found }) => `${check}: ${found}`);
}

describe('a project the whole sequence migrated', () => {
  it('passes, writing nothing, its counts read and the link dead before the migration listed apart', () => {
    const before = treeSnapshot(world.dir);
    const report = audit(world.dir, world.old);

    assert.deepStrictEqual(report, {
      ok: true,
      faults: [],
      counts: {
        units: { epic: { 'in-progress': 1, completed: 1 }, feature: { 'in-progress': 1, cancelled: 1 }, 'quick-fix': { completed: 1 } },
        decisions: 5,
        legacy_files: 1,
        dead_links: { before: 1, after: 1, after_already_dead: 1 },
      },
      already_dead: ['gateway/topics/auth/log.md: [old RFC](../research/rfc.md)'],
      already_unregistered: [],
    });
    const kept = (/** @type {Record<string, string>} */ tree) => Object.entries(tree).filter(([rel]) => !rel.startsWith(layout.cache()) && !rel.startsWith(layout.knowledge()));
    assert.deepStrictEqual(kept(treeSnapshot(world.dir)), kept(before));
  });
});

describe('each check refuses a world made to fail it', () => {
  it('the old state left, a manifest of another shape, a decided topic with no decision, a unit waiting on a cut, a cut short of the tracker\'s tasks and the old plan\'s phases, old files neither placed nor kept, and names naming nothing — each check naming its own and no other; a unit the old registry already lacked a manifest of listed apart', () => {
    fs.mkdirSync(path.join(world.dir, '.workflows'));
    fs.writeFileSync(path.join(world.dir, '.workflows/stray.md'), '# Stray\n');
    changeManifest(layout.projectManifest, (project) => {
      Object.assign(project.work_units, { ghost: { work_type: 'feature' }, stray: { work_type: 'feature' } });
      project.roadmap.items['dark-mode'].sources = ['.product/notes/gone.md'];
    });
    changeManifest(layout.manifest('gateway'), (manifest) => { manifest.phases.discussion.items.errors.status = 'promoted'; });
    changeManifest(layout.manifest('shop'), (manifest) => {
      manifest.status = 'in-progress';
      manifest.phases.review = { items: { cart: { status: 'completed' } } };
    });
    changeManifest(layout.manifest('exports'), (manifest) => { manifest.phases.discussion.items.exports.status = 'completed'; });
    SIDE.childOf(statePath(world.dir), 'Revoke a link', 'Phase 2: Sharing');
    fs.rmSync(statePath(world.dir, 'shop/assets/legacy/implementation/cart/report.md'));
    const log = statePath(world.dir, layout.topic('gateway', 'errors', 'log.md'));
    fs.writeFileSync(log, `${fs.readFileSync(log, 'utf8').replace('Still open.', '')}\nSee [the spec](../../spec.md).\n`);
    fs.renameSync(statePath(world.dir, layout.topic('exports', 'exports', 'log.md')), statePath(world.dir, layout.topic('exports', 'exports', 'kept.md')));
    const old = structuredClone(world.old);
    const registry = JSON.parse(/** @type {string} */ (old.files['manifest.json'].text));
    registry.work_units.stray = { work_type: 'feature' };
    old.files['manifest.json'].text = JSON.stringify(registry);
    const memo = JSON.parse(/** @type {string} */ (old.files['memo/manifest.json'].text));
    memo.phases.planning.items.memo.task_map['memo-3'] = 'tracker-gone';
    old.files['memo/manifest.json'].text = JSON.stringify(memo);
    commitAll(world.dir, 'the mutant');
    const exportsLine = JSON.parse(fs.readFileSync(statePath(world.dir, layout.ledger), 'utf8').split('\n').find((line) => line.includes('"topic":"exports"')) ?? '{}').id;

    const report = audit(world.dir, old);

    assert.deepStrictEqual(report.faults.map(({ check, found }) => `${check}: ${found}`), [
      'old-state-gone: .workflows/ is still in the project\'s folder',
      'manifests-valid: ghost is registered and has no manifest',
      'manifests-valid: gateway: its discussion item errors reads "promoted"',
      'manifests-valid: shop: it keeps review items, which no phase past the topics\' keeps',
      'decisions-carried: exports/exports is decided and the ledger holds no decision of it',
      'no-cut-waiting: shop has its specs joined and no cut',
      'cut-holds-tracker: memo\'s phase 2 lacks "Revoke a link", open in the tracker',
      'cut-holds-tracker: memo\'s cut lacks the old plan\'s phase tracker-gone',
      'files-placed: .workflows/gateway/discussion/errors.md is neither placed nor kept as legacy',
      'files-placed: .workflows/shop/implementation/cart/report.md is neither placed nor kept as legacy',
      'names-resolve: gateway/topics/errors/log.md links [the spec](../../spec.md), which names nothing',
      `names-resolve: ledger line ${exportsLine} names exports/topics/exports/log.md, which is not there`,
      'names-resolve: roadmap item dark-mode names .product/notes/gone.md, which is not there',
    ]);
    assert.deepStrictEqual(report.already_unregistered, ['stray']);
  });

  it('migrations-recorded and boot-ready: a migration the record lacks, which boot then runs and commits', () => {
    const record = statePath(world.dir, layout.migrations);
    fs.writeFileSync(record, fs.readFileSync(record, 'utf8').replace('081\n', ''));
    assert.deepStrictEqual(faults(), ['migrations-recorded: migration 081 is not in the record', 'boot-ready: boot committed: the migration left work behind it']);
  });

  it('boot-ready: a migration cut short at its records directive, where boot stops again', () => {
    const dir = oldProject(path.join(root, 'cut-short'));
    const old = listOld(dir);
    harness.ok(dir, ['boot'], { env: { WORKFLOWS_CONFIG_DIR: path.join(root, 'no-workflows-config') } });
    assert.ok(audit(dir, old).faults.some(({ check, found }) => check === 'boot-ready' && found === 'boot answered directive'));
  });
});
