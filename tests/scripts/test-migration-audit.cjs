'use strict';

// ---------------------------------------------------------------------------
// The migration audit (migration-audit.cjs; 21.1.1): a project the whole
// sequence migrated passes it, its counts read, the link already dead
// before the migration listed apart, an import its words name outside a
// link placed as the move rewrote it, the old cache's reports in the
// cache's earlier/ folders but the retired unit's, purged with its cache;
// and it writes nothing — its boot's
// late one-decision check making no call and no commit, its boot marking no
// conversation though its caller runs in one, the command refusing
// to run with a user-level folder unpinned. Each check refuses a world made
// to fail it, naming what it found. One world fails every check of what the
// state holds at once, each fault its own check's and none another's — the
// old state left, a manifest of another shape, a decided topic with no
// decision, a unit waiting on a cut, a cut short of the tracker's tasks and
// of the old plan's phases, old files neither placed nor kept — an old
// cache's report at another earlier/ place, and one changed — and a link,
// citation and roadmap source naming nothing; and the rest each have one of
// their own: a field of a manifest no engine module names, the project's,
// a unit's, a phase's or an item's; a build's fix-tracking report 051 moved
// out of the old cache placed where the move kept it, and no other report
// so; a link broken where it was live, its words dead in another
// document; the links dead
// before excused wherever their old documents went, one kept byte for
// byte in one place and rewritten in another among them, counted over the
// same documents before and after, those of the legacy files apart; a
// tracker the cut cannot be read against, its parent or its store gone,
// the rest of the report kept; and boot's two — a
// migration the record lacks, which boot runs and commits, and a migration
// cut short at a directive, where boot stops.
//
// Layer: verb. World: the project migrated whole (migration-sequence-
// world.cjs), made once per run and copied for each test; each mutant
// committed, so the boot the audit runs finds nothing of its own to do.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { statePath, stateGit, layout, commitAll, treeSnapshot } = harness;
const { SIDE, AUTH_MAP, oldProject, migratedProject } = require('./migration-sequence-world.cjs');
const { listOld, audit } = require('./migration-audit.cjs');

const AUDIT = path.join(__dirname, 'migration-audit.cjs');
// The link dead before the migration, in auth's discussion.
const OLD_RFC = '[old RFC](../research/rfc.md)';
// How long the late check boot launches detached may take to start and end.
const DETACHED_MS = 5000;

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

/** The state's file at `rel` with `line` added at its end. @param {string} rel @param {string} line */
const appendState = (rel, line) => fs.appendFileSync(statePath(world.dir, rel), `${line}\n`);

/** The listing's old document at `rel` with `line` added at its end, as if the old state had held it. @param {import('./migration-audit.cjs').Listing} old @param {string} rel @param {string} line */
function appendOld(old, rel, line) {
  const file = old.files[rel];
  file.text = `${file.text}${line}\n`;
  file.sha = crypto.createHash('sha256').update(file.text).digest('hex');
}

/** The audit's faults once the world's change is committed, each as `{check}: {found}`. @param {import('./migration-audit.cjs').Listing} [old] */
function faults(old = world.old) {
  commitAll(world.dir, 'the mutant');
  return audit(world.dir, old).faults.map(({ check, found }) => `${check}: ${found}`);
}

describe('a project the whole sequence migrated', () => {
  it('passes, writing nothing, its counts read, the link dead before the migration listed apart, an import its words name outside a link placed as the move rewrote it, and the old cache\'s reports in the cache\'s earlier/ folders but the retired unit\'s, purged with its cache', () => {
    const before = treeSnapshot(world.dir);
    const report = audit(world.dir, world.old);

    assert.deepStrictEqual(report, {
      ok: true,
      faults: [],
      counts: {
        units: { epic: { 'in-progress': 1, completed: 1 }, feature: { 'in-progress': 1, cancelled: 1 }, 'quick-fix': { completed: 1 } },
        decisions: 4 + AUTH_MAP.length,
        legacy_files: 1,
        earlier: 2,
        dead_links: { before: 1, after: 1, after_already_dead: 1, legacy: 0 },
      },
      already_dead: [`gateway/topics/auth/log.md: ${OLD_RFC}`],
    });
    assert.match(fs.readFileSync(statePath(world.dir, layout.topic('gateway', 'auth', 'log.md')), 'utf8'), /drawn at \.\.\/\.\.\/assets\/flow\.png\./, 'the move rewrote the import\'s path');
    assert.ok(!fs.existsSync(statePath(world.dir, '.cache/caching')), 'the retired unit\'s cache purged, its report with it');
    const kept = (/** @type {Record<string, string>} */ tree) => Object.entries(tree).filter(([rel]) => !rel.startsWith(layout.cache()) && !rel.startsWith(layout.knowledge()));
    assert.deepStrictEqual(kept(treeSnapshot(world.dir)), kept(before));
  });

  it('as a command, makes no Claude call, no commit and no conversation mark, though its caller runs in a conversation: the late one-decision check its boot launches finds the stub it pins, a claude on PATH never called, the state\'s head unmoved once the check is done; and it refuses to run with either user-level folder unpinned or in ~/.config', async () => {
    const bin = path.join(root, 'bin');
    const calls = path.join(root, 'calls.log');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho called >> '${calls}'\nexit 1\n`, { mode: 0o755 });
    const listing = path.join(root, 'old-state.json');
    fs.writeFileSync(listing, JSON.stringify(world.old));
    const config = path.join(root, 'config');
    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, LEDGER_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'the-callers' };
    delete env.LEDGER_CLAUDE;
    const head = stateGit(world.dir, ['rev-parse', 'HEAD']);
    const owed = fs.readFileSync(statePath(world.dir, layout.ledger), 'utf8').split('\n').filter((line) => line.includes('"unchecked":true')).length;

    const run = spawnSync(process.execPath, [AUDIT, 'audit', world.dir, listing], { env, encoding: 'utf8' });
    const claim = statePath(world.dir, layout.cache('.late-check'));
    const deadline = Date.now() + DETACHED_MS;
    let claimed = false;
    while (Date.now() < deadline && !fs.existsSync(calls) && !(claimed && !fs.existsSync(claim))) {
      claimed ||= fs.existsSync(claim);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.deepStrictEqual([run.status, JSON.parse(run.stdout).ok], [0, true]);
    assert.ok(owed > 0, 'the world holds decisions owed a check, so boot launches it');
    assert.deepStrictEqual([fs.existsSync(calls), stateGit(world.dir, ['rev-parse', 'HEAD']), fs.existsSync(path.join(config, 'conversations'))], [false, head, false]);

    const refused = (/** @type {Record<string, string|undefined>} */ pins) => spawnSync(process.execPath, [AUDIT, 'list', world.dir], { env: { ...process.env, ...pins }, encoding: 'utf8' });
    const unset = refused({ LEDGER_CONFIG_DIR: '' });
    const home = refused({ WORKFLOWS_CONFIG_DIR: path.join(os.homedir(), '.config', 'workflows') });
    assert.deepStrictEqual([unset.status, unset.stdout, home.status], [2, '', 2]);
    assert.match(unset.stderr, /^Refused: pin LEDGER_CONFIG_DIR to a folder outside ~\/\.config/);
    assert.match(home.stderr, /^Refused: pin WORKFLOWS_CONFIG_DIR to a folder outside ~\/\.config/);
  });
});

describe('each check refuses a world made to fail it', () => {
  it('the old state left, a manifest of another shape, a decided topic with no decision, a unit waiting on a cut, a cut short of the tracker\'s tasks and the old plan\'s phases, old files neither placed nor kept — an old cache\'s report moved to another unit\'s earlier/ and one changed among them — and names naming nothing — each check naming its own and no other', () => {
    fs.mkdirSync(path.join(world.dir, '.workflows'));
    fs.writeFileSync(path.join(world.dir, '.workflows/stray.md'), '# Stray\n');
    changeManifest(layout.projectManifest, (project) => {
      project.work_units.ghost = { work_type: 'feature' };
      project.roadmap.items['dark-mode'].sources = ['.product/notes/gone.md'];
    });
    changeManifest(layout.manifest('gateway'), (manifest) => { manifest.phases.discussion.items.errors.status = 'promoted'; });
    changeManifest(layout.manifest('shop'), (manifest) => {
      manifest.status = 'in-progress';
      manifest.phases.review = { items: { cart: { status: 'completed' } } };
    });
    changeManifest(layout.manifest('typo'), (manifest) => { manifest.phases.implementation = { items: { typo: { status: 'completed' } } }; });
    changeManifest(layout.manifest('exports'), (manifest) => { manifest.phases.discussion.items.exports.status = 'completed'; });
    SIDE.childOf(statePath(world.dir), 'Revoke a link', 'Phase 2: Sharing');
    fs.rmSync(statePath(world.dir, 'shop/assets/legacy/implementation/cart/report.md'));
    fs.mkdirSync(statePath(world.dir, '.cache/earlier/gateway/discussion/errors'), { recursive: true });
    fs.renameSync(statePath(world.dir, '.cache/gateway/earlier/discussion/errors/review-001.md'), statePath(world.dir, '.cache/earlier/gateway/discussion/errors/review-001.md'));
    fs.appendFileSync(statePath(world.dir, '.cache/earlier/spec-draft.md'), 'Joined since.\n');
    const log = statePath(world.dir, layout.topic('gateway', 'errors', 'log.md'));
    fs.writeFileSync(log, `${fs.readFileSync(log, 'utf8').replace('Still open.', '')}\nSee [the spec](../../spec.md).\n`);
    fs.renameSync(statePath(world.dir, layout.topic('exports', 'exports', 'log.md')), statePath(world.dir, layout.topic('exports', 'exports', 'kept.md')));
    const old = structuredClone(world.old);
    const memo = JSON.parse(/** @type {string} */ (old.files['memo/manifest.json'].text));
    memo.phases.planning.items.memo.task_map['memo-3'] = 'tracker-gone';
    old.files['memo/manifest.json'].text = JSON.stringify(memo);
    commitAll(world.dir, 'the mutant');
    const exportsLine = JSON.parse(fs.readFileSync(statePath(world.dir, layout.ledger), 'utf8').split('\n').find((line) => line.includes('"topic":"exports"')) ?? '{}').id;

    assert.deepStrictEqual(audit(world.dir, old).faults.map(({ check, found }) => `${check}: ${found}`), [
      'old-state-gone: .workflows/ is still in the project\'s folder',
      'manifests-valid: ghost is registered and has no manifest',
      'manifests-valid: gateway: its discussion item errors reads "promoted"',
      'manifests-valid: shop: it keeps review items, which no phase past the topics\' keeps',
      'manifests-valid: typo: it keeps implementation items, which no phase past the topics\' keeps',
      'decisions-carried: exports/exports is decided and the ledger holds no decision of it',
      'no-cut-waiting: shop has its specs joined and no cut',
      'cut-holds-tracker: memo\'s phase 2 lacks "Revoke a link", open in the tracker',
      'cut-holds-tracker: memo\'s cut lacks the old plan\'s phase tracker-gone',
      'files-placed: .workflows/.cache/gateway/discussion/errors/review-001.md is not in the cache\'s earlier/ as it was',
      'files-placed: .workflows/.cache/spec-draft.md is not in the cache\'s earlier/ as it was',
      'files-placed: .workflows/gateway/discussion/errors.md is neither placed nor kept as legacy',
      'files-placed: .workflows/shop/implementation/cart/report.md is neither placed nor kept as legacy',
      'names-resolve: gateway/topics/errors/log.md links [the spec](../../spec.md), which names nothing',
      `names-resolve: ledger line ${exportsLine} names exports/topics/exports/log.md, which is not there`,
      'names-resolve: roadmap item dark-mode names .product/notes/gone.md, which is not there',
    ]);
  });

  it('manifests-valid: a field no engine module names — the project\'s, a unit\'s, a phase\'s or an item\'s, each an old one 078 never knew — a fault of its own where it is', () => {
    changeManifest(layout.projectManifest, (project) => { project.plan_format = 'markdown'; });
    changeManifest(layout.manifest('gateway'), (manifest) => {
      manifest.fix_attempts = 2;
      manifest.phases.discussion.gap_topics = [];
      manifest.phases.discussion.items.errors.subtopics = {};
    });

    assert.deepStrictEqual(faults(), [
      'manifests-valid: the project\'s manifest holds plan_format, which no engine module names',
      'manifests-valid: gateway: it holds fix_attempts, which no engine module names',
      'manifests-valid: gateway: its discussion phase holds gap_topics, which no engine module names',
      'manifests-valid: gateway: its discussion item errors holds subtopics, which no engine module names',
    ]);
  });

  it('files-placed: a build\'s fix-tracking report of the old cache, which 051 moved into the unit\'s implementation folder in a project behind it, placed byte for byte where the move kept it; any other report of the old cache so kept is not', () => {
    const old = structuredClone(world.old);
    const { sha } = old.files['shop/implementation/cart/report.md'];
    old.files['.cache/shop/implementation/cart/fix-tracking-cart-1-1.md'] = { sha };
    old.files['.cache/shop/implementation/cart/review-001.md'] = { sha };

    assert.deepStrictEqual(audit(world.dir, old).faults.map(({ check, found }) => `${check}: ${found}`), [
      'files-placed: .workflows/.cache/shop/implementation/cart/review-001.md is not in the cache\'s earlier/ as it was',
    ]);
  });

  it('files-placed: a topic\'s old document a released migration took part of into the topic\'s mail — 054\'s triage, by way of 071\'s mailbox, as codeintel\'s cost economics — placed where its log and its mail together hold every line; its lines in another topic\'s mail placed nowhere', () => {
    const old = structuredClone(world.old);
    appendOld(old, 'memo/discussion/memo.md', 'Claude subscription vs metered API billing.');
    appendOld(old, 'gateway/discussion/errors.md', 'Errors carry a code.');
    fs.mkdirSync(statePath(world.dir, layout.mailbox('memo', 'memo')), { recursive: true });
    fs.writeFileSync(statePath(world.dir, layout.mailbox('memo', 'memo', '001-triage.md')), '# Triage\n\nClaude subscription vs metered API billing.\n\nErrors carry a code.\n');

    assert.deepStrictEqual(faults(old), ['files-placed: .workflows/gateway/discussion/errors.md is neither placed nor kept as legacy']);
  });

  it('names-resolve: a link the migration left naming nothing where it was live, the same words dead in another old document excusing it nowhere else', () => {
    const old = structuredClone(world.old);
    appendOld(old, 'memo/discussion/memo.md', `See the ${OLD_RFC}.`);
    old.files['memo/research/rfc.md'] = { sha: old.files['shop/implementation/cart/report.md'].sha };
    appendState(layout.topic('memo', 'memo', 'log.md'), `See the ${OLD_RFC}.`);

    assert.deepStrictEqual(faults(old), [`names-resolve: memo/topics/memo/log.md links ${OLD_RFC}, which names nothing`]);
  });

  it('names-resolve: the links dead before excused in every document holding their old one — twice in one, in two, and in a document kept byte for byte in one place and rewritten in another, a roadmap import mailed to a topic, as portal\'s — counted over the same documents before and after, each occurrence, those landing in legacy apart, and each old one listed once', () => {
    const old = structuredClone(world.old);
    for (const [was, now] of [['gateway/discussion/auth.md', layout.topic('gateway', 'auth', 'log.md')], ['gateway/discussion/errors.md', layout.topic('gateway', 'errors', 'log.md')]]) {
      appendOld(old, was, `Again, the ${OLD_RFC}.`);
      appendState(now, `Again, the ${OLD_RFC}.`);
    }
    const mail = 'gateway/discussion/.mailbox/limits/001-burst.md';
    appendOld(old, mail, 'See [the burst notes](burst.md).');
    old.files['.roadmap/imports/001-burst.md'] = { ...old.files[mail] };
    fs.writeFileSync(statePath(world.dir, '.product/assets/001-burst.md'), /** @type {string} */ (old.files[mail].text));
    const idea = path.join('.inbox/ideas', /** @type {string} */ (fs.readdirSync(statePath(world.dir, '.inbox/ideas')).find((name) => name.endsWith('--burst.md'))));
    appendState(idea, 'See [the burst notes](burst.md).');
    appendOld(old, 'shop/implementation/cart/report.md', 'See [the notes](notes.md).');
    appendState('shop/assets/legacy/implementation/cart/report.md', 'See [the notes](notes.md).');
    commitAll(world.dir, 'the mutant');

    const report = audit(world.dir, old);

    assert.deepStrictEqual([report.faults, report.counts.dead_links, report.already_dead], [
      [],
      { before: 5, after: 5, after_already_dead: 5, legacy: 1 },
      [
        `${idea}: [the burst notes](burst.md)`,
        '.product/assets/001-burst.md: [the burst notes](burst.md)',
        `gateway/topics/auth/log.md: ${OLD_RFC}`,
        `gateway/topics/errors/log.md: ${OLD_RFC}`,
      ],
    ]);
  });

  it('cut-holds-tracker: a tracker the cut cannot be read against, a cut phase\'s parent gone or the tracker\'s store gone, a fault of its own, the rest of the report kept', () => {
    const second = migratedProject(path.join(root, 'second'));
    SIDE.removeTask(statePath(world.dir), 'Phase 2: Sharing');
    SIDE.breakStore(statePath(second.dir));
    for (const dir of [world.dir, second.dir]) {
      fs.rmSync(statePath(dir, 'shop/assets/legacy/implementation/cart/report.md'));
      commitAll(dir, 'the mutant');
    }

    for (const dir of [world.dir, second.dir]) {
      const report = audit(dir, world.old);
      assert.deepStrictEqual(report.faults.map(({ check }) => check), ['cut-holds-tracker', 'files-placed']);
      assert.match(report.faults[0].found, /^memo's cut cannot be read against the tracker: \S/);
      assert.strictEqual(report.counts.legacy_files, 0);
    }
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
