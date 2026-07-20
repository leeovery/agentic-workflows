'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const os = require('os');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

/** Run a discovery-map command expecting success; returns the parsed JSON line. */
function runOk(dir, args) {
  return JSON.parse(execFileSync('node', [ENGINE, 'discovery-map', ...args], { cwd: dir, encoding: 'utf8' }).trim());
}

/** Run a discovery-map command expecting failure; returns the parsed stderr JSON. */
function runFail(dir, args) {
  const res = spawnSync('node', [ENGINE, 'discovery-map', ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected failure for: ${args.join(' ')}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

describe('engine CLI: discovery-map sequence', () => {
  // Hermetic git: no user/system config leaks into the engine's spawned git.
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';

  /** @param {string} dir @param {string[]} args */
  function git(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  }

  /** A temp-dir git repo holding one epic with a two-topic discovery map. */
  function setupGitFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-seq-'));
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'auth-flow': { routing: 'discussion', source: 'discovery' },
            'session-model': { routing: 'research', source: 'discovery', order: 1 },
          },
        },
      },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
    return dir;
  }

  function readManifest(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'));
  }

  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets every order, commits scoped with the sequence message, reports the assignment', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = JSON.parse(execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());

    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.ordered, { 'auth-flow': 1, 'session-model': 2 });
    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'discovery(payments): sequence topic map');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    const items = readManifest(dir).phases.discovery.items;
    assert.strictEqual(items['auth-flow'].order, 1);
    assert.strictEqual(items['session-model'].order, 2);
  });

  it('re-applying the same orders is a no-op commit: committed null, note, exit 0', () => {
    execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' });
    const res = JSON.parse(execFileSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'session-model=2'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.deepStrictEqual(res, { ok: true, ordered: { 'auth-flow': 1, 'session-model': 2 }, committed: null, note: 'nothing to commit' });
  });

  it('rejects unknown topics before writing anything', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8');
    const res = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'ghost=2'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(JSON.parse(res.stderr.trim()).error, /no discovery item "ghost"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'), before);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('rejects bad orders and malformed assignments — loud and specific', () => {
    for (const pair of ['auth-flow=0', 'auth-flow=-1', 'auth-flow=abc', 'auth-flow=1.5', 'auth-flow']) {
      const res = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', pair], { cwd: dir, encoding: 'utf8' });
      assert.strictEqual(res.status, 1, pair);
      assert.match(JSON.parse(res.stderr.trim()).error, /bad assignment/, pair);
    }
    const dup = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments', 'auth-flow=1', 'auth-flow=2'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(dup.stderr.trim()).error, /assigned twice/);
    const usage = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'payments'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(usage.stderr.trim()).error, /Usage: engine discovery-map sequence/);
    const noMap = spawnSync('node', [ENGINE, 'discovery-map', 'sequence', 'ghost-unit', 'auth-flow=1'], { cwd: dir, encoding: 'utf8' });
    assert.match(JSON.parse(noMap.stderr.trim()).error, /manifest not found/);
  });
});

describe('engine CLI: discovery-map operations', () => {
  // One item per lifecycle, joined at render time from the per-phase items —
  // the same computation the epic detail builder uses.
  const RICH_FRESH = {
    routing: 'research',
    source: 'discovery,research-analysis',
    order: 3,
    brief_path: 'discovery/briefs/rich-fresh.md',
    brief_incorporated: false,
    legacy_split_state: 'applied',
    summary: 'about rich',
    description: 'longer text about rich',
  };

  function opsFixture() {
    const dir = setupFixture();
    createManifest(dir, 'payments', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            'fresh-topic': { routing: 'discussion', source: 'discovery' },
            'rich-fresh': { ...RICH_FRESH },
            'researching-topic': { routing: 'research', source: 'discovery' },
            'ready-topic': { routing: 'research', source: 'discovery' },
            'discussing-topic': { routing: 'discussion', source: 'discovery' },
            'decided-topic': { routing: 'discussion', source: 'discovery' },
            'handled-topic': { routing: 'research', source: 'discovery', handled: true },
            'cancelled-topic': { routing: 'research', source: 'discovery' },
          },
          dismissed: ['dismissed-name'],
        },
        research: {
          items: {
            'researching-topic': { status: 'in-progress' },
            'ready-topic': { status: 'completed' },
            'cancelled-topic': { status: 'cancelled' },
          },
        },
        discussion: {
          items: {
            'discussing-topic': { status: 'in-progress' },
            'decided-topic': { status: 'completed' },
            'cancelled-topic': { status: 'cancelled' },
          },
        },
      },
    });
    return dir;
  }

  function readManifest(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), 'utf8'));
  }

  let dir;
  beforeEach(() => { dir = opsFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  describe('add', () => {
    it('creates the item as {routing, source, summary} — no status field — and reports map_total', () => {
      const res = runOk(dir, ['add', 'payments', 'menu-management', 'research', '--summary', 'owner-managed menus']);
      assert.deepStrictEqual(res, {
        ok: true, work_unit: 'payments', name: 'menu-management', op: 'add',
        routing: 'research', source: 'discovery', summary: 'owner-managed menus',
        lifecycle: 'fresh', map_total: 9,
      });
      // Exact shape: never a `status` field — lifecycle is computed at render
      // time, not stored (the create-discovery-topic defect this op corrects).
      assert.deepStrictEqual(readManifest(dir).phases.discovery.items['menu-management'], {
        routing: 'research', source: 'discovery', summary: 'owner-managed menus',
      });
    });

    it('writes description when given, and honours an explicit --source tag', () => {
      const res = runOk(dir, ['add', 'payments', 'menu-management', 'discussion', '--summary', 's', '--description', 'two paragraphs', '--source', 'gap-analysis']);
      assert.strictEqual(res.description, 'two paragraphs');
      assert.strictEqual(res.source, 'gap-analysis');
      assert.deepStrictEqual(readManifest(dir).phases.discovery.items['menu-management'], {
        routing: 'discussion', source: 'gap-analysis', summary: 's', description: 'two paragraphs',
      });
    });

    it('creates the discovery scaffolding on a manifest with no discovery phase', () => {
      createManifest(dir, 'bare', { work_type: 'epic', phases: {} });
      const res = runOk(dir, ['add', 'bare', 'first-topic', 'research', '--summary', 's']);
      assert.strictEqual(res.map_total, 1);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'bare', 'manifest.json'), 'utf8'));
      assert.deepStrictEqual(manifest.phases.discovery.items['first-topic'], {
        routing: 'research', source: 'discovery', summary: 's',
      });
    });

    it('reports the joined lifecycle when phase work already exists under the name', () => {
      // A legacy manifest can hold a research item with no map anchor; the add
      // re-anchors it and the response reflects the real lifecycle.
      const file = path.join(dir, '.workflows', 'payments', 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      manifest.phases.research.items['orphan-topic'] = { status: 'in-progress' };
      fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
      const res = runOk(dir, ['add', 'payments', 'orphan-topic', 'research', '--summary', 's']);
      assert.strictEqual(res.lifecycle, 'researching');
    });

    it('refuses an active duplicate, leaving the manifest untouched', () => {
      const before = JSON.stringify(readManifest(dir));
      const err = runFail(dir, ['add', 'payments', 'fresh-topic', 'research', '--summary', 's']);
      assert.match(err.error, /"fresh-topic" is already on the map/);
      assert.strictEqual(JSON.stringify(readManifest(dir)), before);
    });

    it('refuses a dismissed name without --force-dismissed, naming the recovery', () => {
      const before = JSON.stringify(readManifest(dir));
      const err = runFail(dir, ['add', 'payments', 'dismissed-name', 'research', '--summary', 's']);
      assert.match(err.error, /"dismissed-name" was previously dismissed.*--force-dismissed/);
      assert.strictEqual(JSON.stringify(readManifest(dir)), before);
    });

    it('--force-dismissed adds the item and pulls the name off the dismissed list', () => {
      const res = runOk(dir, ['add', 'payments', 'dismissed-name', 'discussion', '--summary', 'back again', '--force-dismissed']);
      assert.strictEqual(res.undismissed, true);
      const discovery = readManifest(dir).phases.discovery;
      assert.deepStrictEqual(discovery.items['dismissed-name'], {
        routing: 'discussion', source: 'discovery', summary: 'back again',
      });
      assert.deepStrictEqual(discovery.dismissed, []);
    });

    it('--force-dismissed on a non-dismissed name is a plain add — no undismissed flag', () => {
      const res = runOk(dir, ['add', 'payments', 'brand-new', 'research', '--summary', 's', '--force-dismissed']);
      assert.strictEqual('undismissed' in res, false);
    });

    it('--backfill lands the item without summary/description — keys absent for summary-backfill', () => {
      const res = runOk(dir, ['add', 'payments', 'absorbed-topic', 'discussion', '--backfill']);
      assert.strictEqual(res.backfill, true);
      assert.strictEqual('summary' in res, false);
      assert.deepStrictEqual(readManifest(dir).phases.discovery.items['absorbed-topic'], {
        routing: 'discussion', source: 'discovery',
      });
    });

    it('--backfill is mutually exclusive with --summary/--description', () => {
      assert.match(
        runFail(dir, ['add', 'payments', 'x', 'research', '--summary', 's', '--backfill']).error,
        /--backfill lands the item without summary\/description/);
      assert.match(
        runFail(dir, ['add', 'payments', 'x', 'research', '--description', 'd', '--backfill']).error,
        /--backfill lands the item without summary\/description/);
    });

    it('refuses names that break manifest addressing', () => {
      assert.match(runFail(dir, ['add', 'payments', 'a.b', 'research', '--summary', 's']).error, /not a legal topic name/);
      assert.match(runFail(dir, ['add', 'payments', 'a/b', 'research', '--summary', 's']).error, /not a legal topic name/);
    });

    it('rejects a routing outside the enum, and missing required args with usage', () => {
      assert.match(runFail(dir, ['add', 'payments', 'x', 'planning', '--summary', 's']).error, /unknown routing "planning" \(research\|discussion\)/);
      assert.match(runFail(dir, ['add', 'payments', 'x', '--summary', 's']).error, /Usage: engine discovery-map add/);
      assert.match(runFail(dir, ['add', 'payments', 'x', 'research']).error, /Usage: engine discovery-map add/);
      // An unquoted payload spills into positionals — refused, not truncated.
      assert.match(runFail(dir, ['add', 'payments', 'x', 'research', '--summary', 'two', 'words']).error, /Usage: engine discovery-map add/);
    });
  });

  describe('edit', () => {
    it('sets summary, echoes it with the lifecycle', () => {
      const res = runOk(dir, ['edit', 'payments', 'fresh-topic', '--summary', 'new blurb']);
      assert.deepStrictEqual(res, { ok: true, work_unit: 'payments', name: 'fresh-topic', op: 'edit', lifecycle: 'fresh', summary: 'new blurb' });
      assert.strictEqual(readManifest(dir).phases.discovery.items['fresh-topic'].summary, 'new blurb');
    });

    it('sets description alone, or both fields in one call', () => {
      const one = runOk(dir, ['edit', 'payments', 'fresh-topic', '--description', 'full detail']);
      assert.strictEqual(one.description, 'full detail');
      assert.strictEqual(one.summary, undefined);
      const both = runOk(dir, ['edit', 'payments', 'fresh-topic', '--summary', 's2', '--description', 'd2']);
      assert.strictEqual(both.summary, 's2');
      assert.strictEqual(both.description, 'd2');
      const item = readManifest(dir).phases.discovery.items['fresh-topic'];
      assert.strictEqual(item.summary, 's2');
      assert.strictEqual(item.description, 'd2');
    });

    it('is allowed at any lifecycle — an in-flight item takes the edit', () => {
      const res = runOk(dir, ['edit', 'payments', 'researching-topic', '--summary', 'still editable']);
      assert.strictEqual(res.lifecycle, 'researching');
      assert.strictEqual(readManifest(dir).phases.discovery.items['researching-topic'].summary, 'still editable');
    });

    it('requires at least one flag', () => {
      const err = runFail(dir, ['edit', 'payments', 'fresh-topic']);
      assert.match(err.error, /at least one flag required/);
    });

    it('errors loudly on a missing item', () => {
      const err = runFail(dir, ['edit', 'payments', 'ghost', '--summary', 'x']);
      assert.match(err.error, /no discovery item "ghost"/);
    });
  });

  describe('remove', () => {
    it('hard-deletes a fresh item and pushes its name onto the dismissed list', () => {
      const res = runOk(dir, ['remove', 'payments', 'fresh-topic']);
      assert.deepStrictEqual(res, { ok: true, work_unit: 'payments', name: 'fresh-topic', op: 'remove', dismissed: true, lifecycle: 'fresh' });
      const discovery = readManifest(dir).phases.discovery;
      assert.strictEqual(discovery.items['fresh-topic'], undefined);
      assert.deepStrictEqual(discovery.dismissed, ['dismissed-name', 'fresh-topic']);
    });

    it('does not duplicate a name already on the dismissed list', () => {
      runOk(dir, ['rename', 'payments', 'fresh-topic', 'dismissed-name']);
      runOk(dir, ['remove', 'payments', 'dismissed-name']);
      assert.deepStrictEqual(readManifest(dir).phases.discovery.dismissed, ['dismissed-name']);
    });
  });

  describe('rename', () => {
    it('moves the item preserving every field and its map position', () => {
      const res = runOk(dir, ['rename', 'payments', 'rich-fresh', 'menu-admin']);
      assert.strictEqual(res.op, 'rename');
      assert.strictEqual(res.name, 'menu-admin');
      assert.strictEqual(res.renamed_from, 'rich-fresh');
      assert.strictEqual(res.lifecycle, 'fresh');
      assert.strictEqual(res.matches_dismissed, false);
      // No brief file on disk — nothing moved, no marker.
      assert.ok(!('brief_moved' in res));
      assert.deepStrictEqual(res.preserved_fields.sort(), Object.keys(RICH_FRESH).sort());

      const items = readManifest(dir).phases.discovery.items;
      assert.strictEqual(items['rich-fresh'], undefined);
      // Every field — order, brief_incorporated, the accumulated source, and
      // the legacy_split_state sentinel — carries across intact; brief_path is
      // rewritten to the new name (briefs are keyed by topic name).
      assert.deepStrictEqual(items['menu-admin'], { ...RICH_FRESH, brief_path: 'discovery/briefs/menu-admin.md' });
      // Map position holds: the renamed key sits where the old one did.
      assert.strictEqual(Object.keys(items)[1], 'menu-admin');
    });

    it('moves the brief file with the topic and reports brief_moved', () => {
      const briefsDir = path.join(dir, '.workflows', 'payments', 'discovery', 'briefs');
      fs.mkdirSync(briefsDir, { recursive: true });
      fs.writeFileSync(path.join(briefsDir, 'rich-fresh.md'), '# Brief: Rich Fresh\n\nsoft decisions\n');

      const res = runOk(dir, ['rename', 'payments', 'rich-fresh', 'menu-admin']);
      assert.strictEqual(res.brief_moved, true);
      assert.ok(!fs.existsSync(path.join(briefsDir, 'rich-fresh.md')));
      assert.strictEqual(
        fs.readFileSync(path.join(briefsDir, 'menu-admin.md'), 'utf8'),
        '# Brief: Rich Fresh\n\nsoft decisions\n');
      assert.strictEqual(
        readManifest(dir).phases.discovery.items['menu-admin'].brief_path,
        'discovery/briefs/menu-admin.md');
    });

    it('refuses when a brief already exists at the new name — manifest and files untouched', () => {
      const briefsDir = path.join(dir, '.workflows', 'payments', 'discovery', 'briefs');
      fs.mkdirSync(briefsDir, { recursive: true });
      fs.writeFileSync(path.join(briefsDir, 'rich-fresh.md'), 'the brief\n');
      fs.writeFileSync(path.join(briefsDir, 'menu-admin.md'), 'an unrelated brief\n');
      const before = JSON.stringify(readManifest(dir));

      const err = runFail(dir, ['rename', 'payments', 'rich-fresh', 'menu-admin']);
      assert.match(err.error, /a brief already exists at discovery\/briefs\/menu-admin\.md/);
      assert.strictEqual(JSON.stringify(readManifest(dir)), before);
      assert.strictEqual(fs.readFileSync(path.join(briefsDir, 'rich-fresh.md'), 'utf8'), 'the brief\n');
      assert.strictEqual(fs.readFileSync(path.join(briefsDir, 'menu-admin.md'), 'utf8'), 'an unrelated brief\n');
    });

    it('refuses a collision with an active map item', () => {
      const before = JSON.stringify(readManifest(dir));
      const err = runFail(dir, ['rename', 'payments', 'fresh-topic', 'decided-topic']);
      assert.match(err.error, /"decided-topic" is already on the map — pick a different name/);
      assert.strictEqual(JSON.stringify(readManifest(dir)), before);
    });

    it('allows a match against the dismissed list, leaving the entry alone', () => {
      const res = runOk(dir, ['rename', 'payments', 'fresh-topic', 'dismissed-name']);
      assert.strictEqual(res.matches_dismissed, true);
      const discovery = readManifest(dir).phases.discovery;
      assert.ok(discovery.items['dismissed-name']);
      assert.deepStrictEqual(discovery.dismissed, ['dismissed-name']);
    });

    it('refuses names that break manifest addressing, and the identity rename', () => {
      assert.match(runFail(dir, ['rename', 'payments', 'fresh-topic', 'a.b']).error, /not a legal topic name/);
      assert.match(runFail(dir, ['rename', 'payments', 'fresh-topic', 'a/b']).error, /not a legal topic name/);
      assert.match(runFail(dir, ['rename', 'payments', 'fresh-topic', 'fresh-topic']).error, /must differ/);
    });
  });

  describe('reroute', () => {
    it('records the new routing', () => {
      const res = runOk(dir, ['reroute', 'payments', 'fresh-topic', 'research']);
      assert.deepStrictEqual(res, { ok: true, work_unit: 'payments', name: 'fresh-topic', op: 'reroute', routing: 'research', lifecycle: 'fresh' });
      assert.strictEqual(readManifest(dir).phases.discovery.items['fresh-topic'].routing, 'research');
    });

    it('rejects a routing outside the enum', () => {
      const err = runFail(dir, ['reroute', 'payments', 'fresh-topic', 'planning']);
      assert.match(err.error, /unknown routing "planning" \(research\|discussion\)/);
    });
  });

  describe('lifecycle gates on destructive ops', () => {
    // Every non-fresh lifecycle refuses remove/rename/reroute, naming the
    // blocking lifecycle and the recovery path — identical to the prose gate.
    const BLOCKED = {
      'researching-topic': /research is in flight on it.*cancel from the epic menu instead/,
      'ready-topic': /research has completed and discussion is queued.*cancel from the epic menu instead/,
      'discussing-topic': /discussion is in flight on it.*cancel from the epic menu instead/,
      'decided-topic': /discussion has concluded.*cancel from the epic menu instead/,
      // handled-topic has no research item — no fan-out to claim.
      'handled-topic': /it is marked handled and stays on the map as historical anchor.*unhandle it to make it actionable again/,
      'cancelled-topic': /phase work in cancelled state.*cancel from the epic menu instead/,
    };

    it('remove refuses every non-fresh lifecycle, leaving the manifest untouched', () => {
      const before = JSON.stringify(readManifest(dir));
      for (const [topic, message] of Object.entries(BLOCKED)) {
        const err = runFail(dir, ['remove', 'payments', topic]);
        assert.match(err.error, new RegExp(`"${topic}" can't be removed`), topic);
        assert.match(err.error, message, topic);
      }
      assert.strictEqual(JSON.stringify(readManifest(dir)), before);
    });

    it('rename refuses every non-fresh lifecycle', () => {
      for (const [topic, message] of Object.entries(BLOCKED)) {
        const err = runFail(dir, ['rename', 'payments', topic, 'anything-else']);
        assert.match(err.error, new RegExp(`"${topic}" can't be renamed`), topic);
        assert.match(err.error, message, topic);
      }
    });

    it('reroute refuses every non-fresh lifecycle', () => {
      for (const [topic, message] of Object.entries(BLOCKED)) {
        const err = runFail(dir, ['reroute', 'payments', topic, 'discussion']);
        assert.match(err.error, new RegExp(`"${topic}" can't be re-routed`), topic);
        assert.match(err.error, message, topic);
      }
    });

    it('names superseded research honestly in the refusal — never as completed', () => {
      const m = readManifest(dir);
      m.phases.research.items['ready-topic'].status = 'superseded';
      fs.writeFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

      const err = runFail(dir, ['remove', 'payments', 'ready-topic']);
      assert.match(err.error, /its research was superseded and discussion is queued/);
      assert.ok(!/research has completed/.test(err.error), 'superseded research must not read as completed');
    });

    it('a handled topic with completed research keeps the fan-out phrasing', () => {
      const m = readManifest(dir);
      m.phases.research.items['handled-topic'] = { status: 'completed' };
      fs.writeFileSync(path.join(dir, '.workflows', 'payments', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

      const err = runFail(dir, ['rename', 'payments', 'handled-topic', 'anything-else']);
      assert.match(err.error, /it has fanned out into discussions and stays on the map as historical anchor/);
    });
  });

  describe('handle', () => {
    it('marks an item handled from any actionable lifecycle', () => {
      for (const topic of ['fresh-topic', 'researching-topic', 'ready-topic', 'discussing-topic', 'decided-topic']) {
        const res = runOk(dir, ['handle', 'payments', topic]);
        assert.deepStrictEqual(res, { ok: true, work_unit: 'payments', name: topic, op: 'handle', handled: true, lifecycle: 'handled' }, topic);
        assert.strictEqual(readManifest(dir).phases.discovery.items[topic].handled, true, topic);
      }
    });

    it('refuses an already-handled item', () => {
      const err = runFail(dir, ['handle', 'payments', 'handled-topic']);
      assert.match(err.error, /"handled-topic" can't be marked handled — it's already marked handled/);
    });

    it('refuses a cancelled item, pointing at phase-work reactivation', () => {
      const err = runFail(dir, ['handle', 'payments', 'cancelled-topic']);
      assert.match(err.error, /it's cancelled; reactivate the phase work from the epic menu first/);
    });
  });

  describe('unhandle', () => {
    it('clears the marker and reports the name-matched lifecycle', () => {
      const res = runOk(dir, ['unhandle', 'payments', 'handled-topic']);
      assert.deepStrictEqual(res, { ok: true, work_unit: 'payments', name: 'handled-topic', op: 'unhandle', handled: false, lifecycle: 'fresh' });
      assert.strictEqual('handled' in readManifest(dir).phases.discovery.items['handled-topic'], false);
    });

    it('reports the recomputed lifecycle when phase work exists under the name', () => {
      runOk(dir, ['handle', 'payments', 'researching-topic']);
      const res = runOk(dir, ['unhandle', 'payments', 'researching-topic']);
      assert.strictEqual(res.lifecycle, 'researching');
    });

    it('refuses any non-handled item', () => {
      for (const topic of ['fresh-topic', 'researching-topic', 'decided-topic', 'cancelled-topic']) {
        const err = runFail(dir, ['unhandle', 'payments', topic]);
        assert.match(err.error, /isn't marked handled, so there's nothing to unhandle/, topic);
      }
    });
  });

  describe('argument validation', () => {
    it('rejects unknown verbs and malformed arg counts with usage errors', () => {
      assert.match(runFail(dir, ['frobnicate', 'payments', 'x']).error, /Usage: engine discovery-map <sequence\|add\|edit\|remove\|rename\|reroute\|handle\|unhandle>/);
      assert.match(runFail(dir, ['remove', 'payments']).error, /Usage: engine discovery-map remove/);
      assert.match(runFail(dir, ['remove', 'payments', 'fresh-topic', 'extra']).error, /Usage: engine discovery-map remove/);
      assert.match(runFail(dir, ['rename', 'payments', 'fresh-topic']).error, /Usage: engine discovery-map rename/);
      assert.match(runFail(dir, ['reroute', 'payments', 'fresh-topic']).error, /Usage: engine discovery-map reroute <work-unit> <name> <research\|discussion>/);
      assert.match(runFail(dir, ['handle', 'payments']).error, /Usage: engine discovery-map handle/);
      // An unquoted payload spills into positionals — refused, not truncated.
      assert.match(runFail(dir, ['edit', 'payments', 'fresh-topic', '--summary', 'two', 'words']).error, /Usage: engine discovery-map edit/);
    });
  });

  describe('commit cadence', () => {
    it('map operations never commit — the session picks the change up', () => {
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir, encoding: 'utf8' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
      execFileSync('git', ['add', '-A'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });

      runOk(dir, ['add', 'payments', 'brand-new', 'research', '--summary', 'no commit']);
      runOk(dir, ['edit', 'payments', 'fresh-topic', '--summary', 'no commit']);
      runOk(dir, ['remove', 'payments', 'fresh-topic']);
      runOk(dir, ['rename', 'payments', 'rich-fresh', 'renamed-rich']);
      runOk(dir, ['reroute', 'payments', 'renamed-rich', 'discussion']);
      runOk(dir, ['handle', 'payments', 'renamed-rich']);
      runOk(dir, ['unhandle', 'payments', 'renamed-rich']);

      assert.strictEqual(execFileSync('git', ['log', '--pretty=%s'], { cwd: dir, encoding: 'utf8' }).trim(), 'init');
      assert.match(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }), / M \.workflows\/payments\/manifest\.json/);
    });
  });
});
