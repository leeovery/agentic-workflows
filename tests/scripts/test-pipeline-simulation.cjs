'use strict';

// ---------------------------------------------------------------------------
// Pipeline simulation — the engine driven end-to-end as a black box.
//
// Each scenario replays the engine-call sequence a real pipeline run issues
// (the calls the skill prose prescribes, in prose order), against a sandbox
// git repo. After EVERY mutation the full state is audited:
//   - every manifest parses and is schema-valid (statuses in vocabulary,
//     discovery items status-less, no phase-named shadow roots),
//   - every derivation (lifecycle, phaseStatus, next-phase) computes without
//     throwing for every item,
//   - every navigation gateway (start, continue-*, bridge) discovers AND
//     formats the state without throwing.
// This is the detector for the silent class of bug: state that writes fine,
// raises nothing, and only breaks a menu three phases later.
//
// Scenarios cover the happy paths AND the supported edges — reopen (going
// backwards), supersession, cancel/reactivate at topic and work-unit level,
// pivot, absorption, promotion, restarts. Add new permutations here as the
// system grows: a scenario is just an ordered list of sim.run() calls.
// ---------------------------------------------------------------------------

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const ENGINE = path.join(ROOT, 'skills/workflow-engine/scripts/engine.cjs');

const schema = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/manifest-schema.cjs'));
const derivations = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/derivations.cjs'));
const { WORK_UNIT_TYPES } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/workunit-detail.cjs'));

// The same per-type pipeline the start dashboard derives from (start.cjs
// pipelineOf): epics use the epic phase list minus discovery.
function pipelineOf(workType) {
  if (workType === 'epic') {
    return ['research', 'discussion', 'specification', 'planning', 'implementation', 'review'];
  }
  const cfg = WORK_UNIT_TYPES[workType];
  return cfg ? cfg.pipeline : schema.VALID_PHASES.filter((p) => p !== 'discovery');
}

const GATEWAYS = {
  start: require(path.join(ROOT, 'skills/workflow-start/scripts/gateway.cjs')),
  epic: require(path.join(ROOT, 'skills/workflow-continue-epic/scripts/gateway.cjs')),
  feature: require(path.join(ROOT, 'skills/workflow-continue-feature/scripts/gateway.cjs')),
  bugfix: require(path.join(ROOT, 'skills/workflow-continue-bugfix/scripts/gateway.cjs')),
  quickfix: require(path.join(ROOT, 'skills/workflow-continue-quickfix/scripts/gateway.cjs')),
  crosscutting: require(path.join(ROOT, 'skills/workflow-continue-cross-cutting/scripts/gateway.cjs')),
};
const BRIDGE = require(path.join(ROOT, 'skills/workflow-bridge/scripts/gateway.cjs'));

// Hermetic git: no user/system config leaks into the sandbox or the engine's
// spawned git subprocesses.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// State audit — the invariants run after every mutation
// ---------------------------------------------------------------------------

function listWorkUnits(dir) {
  const wf = path.join(dir, '.workflows');
  if (!fs.existsSync(wf)) return [];
  return fs.readdirSync(wf, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .filter((e) => fs.existsSync(path.join(wf, e.name, 'manifest.json')))
    .map((e) => e.name);
}

function auditState(dir, label) {
  const ctx = (msg) => `[${label}] ${msg}`;

  // Project manifest parses.
  const projPath = path.join(dir, '.workflows', 'manifest.json');
  if (fs.existsSync(projPath)) {
    JSON.parse(fs.readFileSync(projPath, 'utf8'));
  }

  for (const wu of listWorkUnits(dir)) {
    const raw = fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8');
    let manifest;
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      assert.fail(ctx(`${wu}/manifest.json does not parse: ${e.message}`));
    }

    // Root schema.
    assert.ok(schema.VALID_WORK_TYPES.includes(manifest.work_type),
      ctx(`${wu}: work_type "${manifest.work_type}" not in schema`));
    assert.ok(schema.VALID_WORK_UNIT_STATUSES.includes(manifest.status),
      ctx(`${wu}: status "${manifest.status}" not in schema`));

    // No phase-named shadow roots beside `phases`.
    for (const key of Object.keys(manifest)) {
      assert.ok(!schema.VALID_PHASES.includes(key),
        ctx(`${wu}: root key "${key}" shadows a phase — writes are landing outside phases.*`));
    }

    // Phase tree schema.
    const phases = manifest.phases || {};
    for (const [phase, data] of Object.entries(phases)) {
      assert.ok(schema.VALID_PHASES.includes(phase), ctx(`${wu}: unknown phase "${phase}"`));
      const items = (data && data.items) || {};
      for (const [topic, item] of Object.entries(items)) {
        assert.ok(item && typeof item === 'object' && !Array.isArray(item),
          ctx(`${wu}.${phase}.${topic}: item is not an object`));
        const vocab = schema.VALID_PHASE_STATUSES[phase];
        if (phase === 'discovery') {
          assert.ok(!('status' in item),
            ctx(`${wu}.discovery.${topic}: map items carry no status field`));
        } else if ('status' in item) {
          assert.ok(vocab.includes(item.status),
            ctx(`${wu}.${phase}.${topic}: status "${item.status}" not in ${phase} vocabulary`));
        }
      }
      // Derivation must hold for every phase present.
      derivations.phaseStatus(manifest, phase);
    }

    // Every discovery item derives a lifecycle and a next action.
    const mapItems = (phases.discovery && phases.discovery.items) || {};
    for (const topic of Object.keys(mapItems)) {
      const life = derivations.computeTopicLifecycle(manifest, topic);
      assert.ok(life && typeof life.lifecycle === 'string' && life.lifecycle.length > 0,
        ctx(`${wu}.discovery.${topic}: lifecycle did not derive`));
    }

    // Unit-level derivations never throw on legal state.
    derivations.computeNextPhase(manifest);
    derivations.computeUnitPhaseState(manifest, pipelineOf(manifest.work_type));

    // The agent-state store, when present, is always schema-valid.
    const storePath = path.join(dir, '.workflows', '.cache', wu, 'state.json');
    if (fs.existsSync(storePath)) {
      const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      for (const [key, row] of Object.entries(store.agents || {})) {
        assert.ok(['in-flight', 'pending', 'acknowledged', 'incorporated'].includes(row.status),
          ctx(`agent ${key}: status "${row.status}" not in vocabulary`));
        assert.ok(row.surfaced.every((f) => row.findings.includes(f)),
          ctx(`agent ${key}: surfaced ids must be recorded findings`));
      }
    }

    // The bridge can always read the unit.
    const bridged = BRIDGE.discover(dir, wu);
    assert.ok(!bridged.error, ctx(`${wu}: bridge gateway errored: ${bridged.error}`));
    BRIDGE.format(bridged);
  }

  // Every navigation surface discovers and formats without throwing — the
  // menus must render whatever state the pipeline is in.
  for (const [name, gw] of Object.entries(GATEWAYS)) {
    const result = gw.discover(dir);
    assert.ok(result && typeof result === 'object', ctx(`${name} gateway returned nothing`));
    gw.format(result);
  }
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

class Sim {
  constructor() {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-'));
    git(this.dir, ['init', '-q', '-b', 'main']);
    git(this.dir, ['config', 'user.email', 'sim@example.com']);
    git(this.dir, ['config', 'user.name', 'Sim']);
    git(this.dir, ['config', 'commit.gpgsign', 'false']);
    fs.mkdirSync(path.join(this.dir, '.workflows'), { recursive: true });
    this.step = 0;
  }

  destroy() {
    fs.rmSync(this.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  write(rel, content) {
    const full = path.join(this.dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    return rel;
  }

  /** Engine mutation: expect ok:true JSON, then audit the whole state. */
  run(args) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')}`;
    const res = spawnSync('node', [ENGINE, ...args], { cwd: this.dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0,
      `[${label}] expected success\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const nl = res.stdout.indexOf('\n');
    const first = (nl === -1 ? res.stdout : res.stdout.slice(0, nl)).trim();
    const parsed = JSON.parse(first);
    assert.strictEqual(parsed.ok, true, `[${label}] engine answered ok:false`);
    this.sections = nl === -1 ? '' : res.stdout.slice(nl + 1);
    auditState(this.dir, label);
    return parsed;
  }

  /** Engine call that must refuse loudly: exit 1, {ok:false} JSON on stderr. */
  refuses(args, pattern) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')} (expected refusal)`;
    const res = spawnSync('node', [ENGINE, ...args], { cwd: this.dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, `[${label}] expected exit 1, got ${res.status}\nstdout: ${res.stdout}`);
    const parsed = JSON.parse(res.stderr.trim());
    assert.strictEqual(parsed.ok, false, `[${label}] refusal is not clean {ok:false} JSON`);
    if (pattern) assert.match(parsed.error, pattern, `[${label}] refusal message drifted`);
    auditState(this.dir, `${label} — state untouched`);
    return parsed;
  }

  /** Bare-stdout read (manifest get / exists / resolve …). */
  read(args) {
    return execFileSync('node', [ENGINE, ...args], { cwd: this.dir, encoding: 'utf8' }).trim();
  }

  /** Render surface: must exit 0 (an entry-gate that passes renders empty). */
  render(args, { expect } = {}) {
    const res = spawnSync('node', [ENGINE, 'render', ...args], { cwd: this.dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0,
      `[render ${args.join(' ')}] crashed or refused\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    if (expect === 'content') {
      assert.ok(res.stdout.trim().length > 0, `[render ${args.join(' ')}] produced no output`);
    }
    if (expect === 'empty') {
      assert.strictEqual(res.stdout.trim(), '', `[render ${args.join(' ')}] expected a pass (empty render)`);
    }
    return res.stdout;
  }

  manifest(wu) {
    return JSON.parse(fs.readFileSync(path.join(this.dir, '.workflows', wu, 'manifest.json'), 'utf8'));
  }
}

/** Session-log helper — workunit create and discovery-session open need one. */
function sessionLog(sim, wu, n = 1) {
  return sim.write(`.workflows/${wu}/discovery/sessions/session-00${n}.md`,
    `# Discovery Session 00${n}\n\n## Conclusion\n\n(none)\n`);
}

// Shared phase walk used by the linear pipelines: specification → planning →
// implementation (→ review), with the bookkeeping each phase records.
function walkDeliveryPhasesToImplementation(sim, wu, topic) {
  sim.run(['topic', 'start', wu, 'specification', topic]);
  sim.run(['topic', 'complete', wu, 'specification', topic]);
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);
  sim.run(['topic', 'complete', wu, 'planning', topic]);
  sim.run(['topic', 'start', wu, 'implementation', topic]);
  sim.run(['task', 'init', wu, topic]);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--next-task', '~', '--phase-complete']);
  sim.run(['topic', 'complete', wu, 'implementation', topic]);
}

function walkDeliveryPhases(sim, wu, topic, { sources }) {
  // Specification.
  sim.run(['topic', 'start', wu, 'specification', topic]);
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'pending']);
  }
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'incorporated']);
  }
  sim.write(`.workflows/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
  sim.run(['commit', wu, '-m', `spec(${wu}): construct`]);
  sim.run(['topic', 'complete', wu, 'specification', topic]);

  // Planning.
  sim.render(['entry-gate', `${wu}.planning.${topic}`], { expect: 'empty' });
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.write(`.workflows/${wu}/planning/${topic}/planning.md`, `# Plan — ${topic}\n`);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);
  sim.run(['commit', wu, '-m', `plan(${wu}): author`, '--plan', topic]);
  sim.run(['topic', 'complete', wu, 'planning', topic]);

  // Implementation.
  sim.render(['entry-gate', `${wu}.implementation.${topic}`], { expect: 'empty' });
  sim.run(['topic', 'start', wu, 'implementation', topic]);
  sim.run(['task', 'init', wu, topic]);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--next-task', '~', '--phase-complete']);
  sim.run(['topic', 'complete', wu, 'implementation', topic]);

  // Review.
  sim.render(['entry-gate', `${wu}.review.${topic}`], { expect: 'empty' });
  sim.run(['topic', 'start', wu, 'review', topic]);
  sim.run(['manifest', 'push', `${wu}.review.${topic}`, 'reviewed_tasks', `${topic}-1-1`]);
  sim.render(['resume-gate', `${wu}.review.${topic}`, '--variant', 'review'], { expect: 'content' });
  sim.run(['topic', 'complete', wu, 'review', topic]);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('pipeline simulation', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('feature: discovery → discussion → spec → plan → implement → review → complete', () => {
    const wu = 'pay';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Payments feature', '--session-log-file', log]);

    // First phase: discussion (topic = work unit for single-topic types).
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.workflows/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    sim.render(['early-completion-gate', wu], { expect: 'content' });
    sim.render(['revisit-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    const done = sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`, '--pipeline']);
    assert.strictEqual(done.status, 'completed');
    assert.strictEqual(sim.manifest(wu).status, 'completed');
  });

  it('feature: review skipped at the early-completion gate', () => {
    const wu = 'quick-ship';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Ship it', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    walkDeliveryPhasesToImplementation(sim, wu, wu);
    sim.render(['early-completion-gate', wu], { expect: 'content' });
    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): complete feature pipeline (review skipped)`, '--pipeline', '--skipped-review']);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
  });

  it('bugfix: investigation → spec (source pinned to topic) → delivery → complete', () => {
    const wu = 'crash-fix';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'bugfix', '--description', 'Fix the crash', '--session-log-file', log]);

    sim.run(['topic', 'start', wu, 'investigation', wu]);
    sim.write(`.workflows/${wu}/investigation/${wu}.md`, `# Investigation — ${wu}\n`);
    sim.run(['commit', wu, '-m', `investigation(${wu}): root cause`]);
    sim.run(['topic', 'complete', wu, 'investigation', wu]);

    // The bugfix spec source name is pinned to the topic.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`, '--pipeline']);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
  });

  it('quick-fix: scoping registers spec+plan in one pass → verification → review → complete', () => {
    const wu = 'typo';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Rename a flag', '--session-log-file', log]);

    // Scoping writes spec + plan + task map in one batched pass (write-tasks).
    sim.write(`.workflows/${wu}/specification/${wu}/specification.md`, '# Spec\n');
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.write(`.workflows/${wu}/planning/${wu}/planning.md`, '# Plan\n');
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', 'task_list_gate_mode=auto', 'author_gate_mode=auto',
      'finding_gate_mode=auto', 'review_cycle=0', 'phase=1', 'task=~',
      `task_map.${wu}-1-1=${wu}-1-1`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['topic', 'start', wu, 'scoping', wu]);
    sim.run(['topic', 'complete', wu, 'scoping', wu]);
    sim.run(['commit', wu, '-m', `scoping(${wu}): spec and tasks`]);
    sim.render(['phase-completed', wu, '--phase', 'scoping', '--paths'], { expect: 'content' });

    // Implementation (verification workflow) + review.
    sim.run(['topic', 'start', wu, 'implementation', wu]);
    sim.run(['task', 'init', wu, wu]);
    sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    sim.run(['task', 'complete', wu, wu, `${wu}-1-1`, '--next-task', '~', '--phase-complete']);
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    sim.run(['topic', 'start', wu, 'review', wu]);
    sim.run(['topic', 'complete', wu, 'review', wu]);

    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`, '--pipeline']);
  });

  it('quick-fix promotion: work_type flips to feature and the pipeline continues', () => {
    const wu = 'grows';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Looked small', '--session-log-file', log]);

    // Complexity check promotes: both manifests flip, then commit.
    sim.run(['manifest', 'set', wu, 'work_type', 'feature']);
    sim.run(['manifest', 'set', `project.work_units.${wu}.work_type`, 'feature']);
    sim.run(['commit', '--workflows', '-m', `workflow(${wu}): promote quick-fix to feature`]);
    assert.strictEqual(sim.manifest(wu).work_type, 'feature');

    // The promoted feature runs its first phase normally.
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.workflows/${wu}/discussion/${wu}.md`, '# Discussion\n');
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });

  it('epic: map lifecycle, per-topic phases, grouping supersession, cancel/reactivate', () => {
    const wu = 'overhaul';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Payments overhaul', '--session-log-file', log]);

    // Harvest: three topics in one batch, briefs pointed.
    const topics = sim.write(`.workflows/.cache/${wu}/discovery/topics.json`, [
      { name: 'alpha', routing: 'research', summary: 'Alpha summary', brief_path: 'discovery/briefs/alpha.md' },
      { name: 'beta', routing: 'discussion', summary: 'Beta summary', brief_path: 'discovery/briefs/beta.md' },
      { name: 'gamma', routing: 'discussion', summary: 'Gamma summary' },
    ]);
    sim.write(`.workflows/${wu}/discovery/briefs/alpha.md`, '# Brief — Alpha\n');
    sim.write(`.workflows/${wu}/discovery/briefs/beta.md`, '# Brief — Beta\n');
    const batch = sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    assert.strictEqual(batch.map_total, 3);
    sim.run(['discovery-map', 'sequence', wu, 'alpha=1', 'beta=2', 'gamma=3']);

    // Map operations the session loop supports.
    sim.run(['discovery-map', 'edit', wu, 'gamma', '--summary', 'Gamma, sharpened']);
    sim.run(['discovery-map', 'rename', wu, 'gamma', 'gamma-prime']);
    sim.run(['discovery-map', 'reroute', wu, 'gamma-prime', 'research']);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): synthesise 3 topics`]);

    // Alpha: research then discussion; regenerated-brief reconcile flag rides.
    sim.run(['topic', 'start', wu, 'research', 'alpha']);
    sim.write(`.workflows/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['commit', wu, '-m', `research(${wu}): alpha`]);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    const ops = sim.write(`.workflows/.cache/${wu}/discovery/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.research.alpha`, fields: { reconcile_needed: true } }]);
    sim.run(['manifest', 'apply', wu, '--file', ops]);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.alpha`, 'reconcile_needed']), 'true');
    sim.run(['manifest', 'delete', `${wu}.research.alpha`, 'reconcile_needed']);
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    sim.write(`.workflows/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    // Beta discussed; gamma-prime cancelled mid-flight and reactivated later.
    sim.run(['topic', 'start', wu, 'discussion', 'beta']);
    sim.write(`.workflows/${wu}/discussion/beta.md`, '# Discussion — Beta\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
    sim.run(['topic', 'start', wu, 'research', 'gamma-prime']);
    sim.run(['topic', 'cancel', wu, 'research', 'gamma-prime']);
    const cancelled = sim.manifest(wu).phases.discovery.items['gamma-prime'];
    assert.ok(!('order' in cancelled), 'cancel stashes the map order');
    assert.strictEqual(cancelled.previous_order, 3);
    sim.run(['topic', 'reactivate', wu, 'research', 'gamma-prime']);
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].order, 3,
      'reactivate restores the map order');
    sim.run(['topic', 'cancel', wu, 'research', 'gamma-prime']);

    // Grouping: alpha and beta unify into one spec; sources gate, then the
    // per-topic spec items are superseded by the unified one.
    sim.run(['topic', 'start', wu, 'specification', 'alpha']);
    sim.write(`.workflows/${wu}/specification/alpha/specification.md`, '# Spec — Alpha\n');
    sim.run(['topic', 'complete', wu, 'specification', 'alpha']);
    sim.run(['topic', 'start', wu, 'specification', 'unified']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`,
      'sources.alpha.status=pending', 'sources.beta.status=pending']);
    sim.run(['topic', 'supersede', wu, 'specification', 'alpha', '--by', 'unified']);
    assert.strictEqual(sim.manifest(wu).phases.specification.items.alpha.superseded_by, 'unified');
    sim.run(['manifest', 'set', `${wu}.specification.unified`,
      'sources.alpha.status=incorporated', 'sources.beta.status=incorporated']);
    sim.write(`.workflows/${wu}/specification/unified/specification.md`, '# Spec — Unified\n');
    sim.run(['commit', wu, '-m', `spec(${wu}): unified`]);
    sim.run(['topic', 'complete', wu, 'specification', 'unified']);

    // Supersession is terminal: the absorbed spec cannot restart or complete.
    sim.refuses(['topic', 'start', wu, 'specification', 'alpha'], /superseded/);
    sim.refuses(['topic', 'complete', wu, 'specification', 'alpha'], /superseded/);

    // Spec-entry bookkeeping: the wildcard snapshot and the analysis cache
    // metadata (a phase-level write on discussion).
    const statuses = sim.read(['manifest', 'get', `${wu}.specification.*`, 'status']);
    assert.match(statuses, /superseded/);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.checksum', 'abc123']);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.generated', '2026-07-23']);

    // Bridge continuation surfaces render at every state.
    sim.render(['phase-completed', wu, '--phase', 'specification'], { expect: 'content' });
    sim.render(['epic-all-done-gate', wu], { expect: 'content' });
  });

  it('backwards: reopen a completed discussion, re-complete, and the map keeps deriving', () => {
    const wu = 'revisit';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Revisit flow', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.workflows/${wu}/discussion/${wu}.md`, '# Discussion\n');
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    // Going backwards: resuming is not starting — start refuses, reopen works.
    sim.refuses(['topic', 'start', wu, 'discussion', wu], /reopen/);
    sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    sim.render(['phase-note', `${wu}.discussion.${wu}`, '--verb', 'Reopening'], { expect: 'content' });
    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'in-progress');
    sim.render(['resume-gate', `${wu}.discussion.${wu}`], { expect: 'content' });
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    // Reopen after downstream exists: the spec keeps its state, derivations hold.
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    assert.strictEqual(sim.manifest(wu).phases.specification.items[wu].status, 'in-progress');
  });

  it('work-unit lifecycle: complete → reactivate → cancel → reactivate', () => {
    const wu = 'flip';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Lifecycle', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

    sim.run(['workunit', 'complete', wu, '-m', 'workflow(flip): done']);
    assert.ok(sim.manifest(wu).completed_at, 'complete stamps completed_at');
    sim.refuses(['workunit', 'complete', wu, '-m', 'again'], /./);
    sim.run(['workunit', 'reactivate', wu]);
    assert.strictEqual(sim.manifest(wu).completed_at, undefined, 'reactivate clears the stamp');
    sim.run(['workunit', 'cancel', wu]);
    assert.strictEqual(sim.manifest(wu).status, 'cancelled');
    sim.run(['workunit', 'reactivate', wu]);
    assert.strictEqual(sim.manifest(wu).status, 'in-progress');
  });

  it('pivot: a feature with a discussion becomes an epic and its topic keeps working', () => {
    const wu = 'bigger';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Outgrew itself', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.workflows/${wu}/discussion/${wu}.md`, '# Discussion\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`]);

    sim.run(['workunit', 'pivot', wu]);
    assert.strictEqual(sim.manifest(wu).work_type, 'epic');

    // The pivoted epic's map and phases still derive; the topic completes.
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });

  it('absorption: a feature folds into an epic as a new topic and disappears', () => {
    const epic = 'umbrella';
    const feat = 'stray';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'The umbrella', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'A stray feature', '--session-log-file', sessionLog(sim, feat)]);
    sim.run(['topic', 'start', feat, 'discussion', feat]);
    sim.write(`.workflows/${feat}/discussion/${feat}.md`, '# Discussion — Stray\n');
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`]);

    sim.run(['workunit', 'absorb', feat, '--into', epic, '--topic', 'stray-topic']);
    assert.ok(!fs.existsSync(path.join(sim.dir, '.workflows', feat)), 'feature directory removed');
    const m = sim.manifest(epic);
    assert.ok(m.phases.discovery.items['stray-topic'], 'absorbed topic lands on the map');
    assert.strictEqual(m.phases.discussion.items['stray-topic'].status, 'in-progress');
    assert.ok(fs.existsSync(path.join(sim.dir, '.workflows', epic, 'discussion', 'stray-topic.md')),
      'discussion file moved into the epic');
  });

  it('spec promotion: a cross-cutting concern leaves the epic and the spec item goes terminal', () => {
    const wu = 'host';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Hosts a cc concern', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.workflows/.cache/${wu}/discovery/topics.json`,
      [{ name: 'logging', routing: 'discussion', summary: 'Logging everywhere' }]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): one topic`]);
    sim.run(['topic', 'start', wu, 'discussion', 'logging']);
    sim.write(`.workflows/${wu}/discussion/logging.md`, '# Discussion — Logging\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'logging']);
    sim.run(['topic', 'start', wu, 'specification', 'logging']);
    sim.write(`.workflows/${wu}/specification/logging/specification.md`, '# Spec — Logging\n');
    sim.run(['commit', wu, '-m', `spec(${wu}): logging`]);
    sim.run(['topic', 'complete', wu, 'specification', 'logging']);

    sim.run(['workunit', 'promote', wu, 'logging', '--to', 'logging-cc', '--description', 'Logging, project-wide']);
    assert.strictEqual(sim.manifest('logging-cc').work_type, 'cross-cutting');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.logging.status, 'promoted');

    // Promotion is terminal on the source item.
    sim.refuses(['topic', 'start', wu, 'specification', 'logging'], /promoted/);
    sim.refuses(['topic', 'complete', wu, 'specification', 'logging'], /promoted/);
    sim.refuses(['topic', 'supersede', wu, 'specification', 'logging', '--by', 'other'], /promoted|not found/);
  });

  it('implementation loop: fix cycles, analysis cycles, and gate-mode bookkeeping survive resume', () => {
    const wu = 'loop';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Task loop', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
      'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
      `task_map.${wu}-1-1=${wu}-1-1`, `task_map.${wu}-1-2=${wu}-1-2`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);

    sim.run(['topic', 'start', wu, 'implementation', wu]);
    const init = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(init.gates.task_gate_mode, 'gated');
    sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    const findings = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/findings.json`,
      { findings: [{ title: 'Loose end', severity: 'minor' }] });
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    sim.run(['task', 'complete', wu, wu, `${wu}-1-1`, '--next-task', `${wu}-1-2`]);
    sim.run(['task', 'analysis-cycle', wu, wu]);
    sim.run(['task', 'start', wu, wu, `${wu}-1-2`]);
    sim.run(['task', 'complete', wu, wu, `${wu}-1-2`, '--next-task', '~', '--phase-complete']);

    // A resumed session resets gate modes to gated (session-scoped auto).
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'task_gate_mode', 'auto']);
    const resumed = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(resumed.gates.task_gate_mode, 'gated', 'resume resets auto to gated');
    const completed = sim.manifest(wu).phases.implementation.items[wu].completed_tasks;
    assert.deepStrictEqual([...new Set(completed)].sort(), [`${wu}-1-1`, `${wu}-1-2`],
      'completed_tasks carries each id once');
  });

  it('background agents: dispatch → completion scan → ack → surface → incorporate', () => {
    const wu = 'agents';
    sim.run(['workunit', 'create', wu, 'epic', '--description', 'Agent lifecycle', '--session-log-file', sessionLog(sim, wu)]);
    const topics = sim.write(`.workflows/.cache/${wu}/discovery/topics.json`,
      [{ name: 'alpha', routing: 'research', summary: 'Alpha' }]);
    sim.run(['discovery-map', 'add-batch', wu, '--file', topics]);
    sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): one topic`]);
    sim.run(['topic', 'start', wu, 'research', 'alpha']);

    // Dispatch two agents; no files exist until the sub-agents write them.
    const review = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review']);
    sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    let scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.strictEqual(scan.next, null, 'nothing actionable while agents run');

    // The review agent finishes (writes content); the deep-dive is still out.
    sim.write(review.file, '# Review findings\n\n## F1\n\n## F2\n');
    scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.next, { action: 'acknowledge', id: 'review-001' });
    sim.run(['agent', 'ack', wu, 'research', 'alpha', 'review-001', '--findings', 'F1,F2']);
    sim.run(['agent', 'announce', wu, 'research', 'alpha', 'review-001']);
    sim.run(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F1']);
    const last = sim.run(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F2']);
    assert.strictEqual(last.status, 'incorporated', 'last finding auto-incorporates');

    // Guards hold mid-lifecycle, and the conclusion gate still sees the straggler.
    sim.refuses(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F1'], /incorporated/);
    sim.refuses(['agent', 'ack', wu, 'research', 'alpha', 'deep-dive-001-auth', '--clean'], /in-flight/);
    scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight, ['deep-dive-001-auth']);

    // The straggler lands clean; the phase can conclude.
    sim.write(`.workflows/.cache/${wu}/research/alpha/deep-dive-001-auth.md`, '# Nothing novel\n');
    sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    const clean = sim.run(['agent', 'ack', wu, 'research', 'alpha', 'deep-dive-001-auth', '--clean']);
    assert.strictEqual(clean.status, 'incorporated');
    sim.write(`.workflows/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
  });

  it('guards hold mid-pipeline: shadow fields, empty segments, cross-type reuse, bad statuses', () => {
    const wu = 'guarded';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Guard rails', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);

    sim.refuses(['manifest', 'set', wu, 'specification.foo', 'bar'], /is a phase/);
    sim.refuses(['manifest', 'set', `${wu}.`, 'field', 'x'], /empty segments/);
    sim.refuses(['manifest', 'set', `${wu}.discussion.${wu}`, 'status', 'concluded'], /Must be one of/);
    sim.refuses(['commit', '', '-m', 'nope'], /./);
    sim.refuses(['workunit', 'create', wu, 'bugfix', '--description', 'Reuse', '--no-session-log'], /work type/);
    sim.refuses(['topic', 'start', wu, 'cooking', wu], /Invalid phase|unknown/);

    // After every refusal the unit still derives and completes normally.
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });
});
