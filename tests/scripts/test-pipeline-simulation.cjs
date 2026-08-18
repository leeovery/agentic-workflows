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
const { roadmapState } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/roadmap.cjs'));

// The same per-type pipeline the start dashboard derives from (start.cjs
// pipelineOf): the schema's one home for pipeline order.
function pipelineOf(workType) {
  return schema.WORK_TYPE_PIPELINES[workType] || schema.VALID_PHASES.filter((p) => p !== 'discovery');
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
const SPEC_GATEWAY = require(path.join(ROOT, 'skills/workflow-specification-entry/scripts/gateway.cjs'));
const { specificationDetail } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/specification.cjs'));

// Spec-entry detail for one work unit — the spec boundary's derived view.
function specDetail(dir, workUnit) {
  return specificationDetail(workUnit, SPEC_GATEWAY.discover(dir, workUnit));
}

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

  // The roadmap always derives — every item's state lands in vocabulary
  // (lifecycle by join: never stored, so it must always be computable).
  const rm = roadmapState(dir);
  for (const row of rm.items) {
    assert.ok(['waiting', 'in-flight', 'shipped', 'orphaned'].includes(row.state),
      ctx(`roadmap item ${row.name}: state "${row.state}" not in vocabulary`));
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

    // Every agent-state store (one per topic, colocated) is schema-valid.
    const cacheRoot = path.join(dir, '.workflows', '.cache', wu);
    if (fs.existsSync(cacheRoot)) {
      for (const ph of fs.readdirSync(cacheRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const phDir = path.join(cacheRoot, ph.name);
        for (const tp of fs.readdirSync(phDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
          const storePath = path.join(phDir, tp.name, 'state.json');
          if (!fs.existsSync(storePath)) continue;
          const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
          for (const [key, row] of Object.entries(store.agents || {})) {
            assert.ok(['in-flight', 'pending', 'acknowledged', 'incorporated'].includes(row.status),
              ctx(`agent ${ph.name}/${tp.name}/${key}: status "${row.status}" not in vocabulary`));
            assert.ok(row.surfaced.every((f) => row.findings.includes(f)),
              ctx(`agent ${ph.name}/${tp.name}/${key}: surfaced ids must be recorded findings`));
          }
        }
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
    // Hermetic session-label environment: the config dir pins into the
    // sandbox and the tmux identity is stripped, so `session label` can
    // never read the developer's real opt-in or rename their real session.
    this.env = { ...process.env, WORKFLOWS_CONFIG_DIR: path.join(this.dir, '.wf-config') };
    delete this.env.TMUX;
    delete this.env.TMUX_PANE;
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

  // Transactions answer with pure JSON — display artifacts belong to render
  // surfaces fetched at their display point. The one section-bearing group
  // left is presence: its scan is a read-only snapshot whose deferral
  // advisory rides the dump, the view-family pattern.
  static SECTION_CARRYING = new Set(['presence']);

  /** Engine mutation: expect ok:true JSON, then audit the whole state. */
  run(args) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')}`;
    const res = spawnSync('node', [ENGINE, ...args], { cwd: this.dir, encoding: 'utf8', env: this.env });
    assert.strictEqual(res.status, 0,
      `[${label}] expected success\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const nl = res.stdout.indexOf('\n');
    const first = (nl === -1 ? res.stdout : res.stdout.slice(0, nl)).trim();
    const parsed = JSON.parse(first);
    assert.strictEqual(parsed.ok, true, `[${label}] engine answered ok:false`);
    this.sections = nl === -1 ? '' : res.stdout.slice(nl + 1);
    if (!Sim.SECTION_CARRYING.has(args[0])) {
      assert.strictEqual(this.sections, '',
        `[${label}] transaction verbs answer with pure JSON — display sections belong to render surfaces fetched at their display point`);
    }
    auditState(this.dir, label);
    return parsed;
  }

  /** Engine call that must refuse loudly: exit 1, {ok:false} JSON on stderr. */
  refuses(args, pattern) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')} (expected refusal)`;
    const res = spawnSync('node', [ENGINE, ...args], { cwd: this.dir, encoding: 'utf8', env: this.env });
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
// Every process skill's Step 0 refreshes the session label before anything
// else — mirrored at each phase entry below. The sim strips the tmux
// identity and pins an empty config dir, so the call is the disabled or
// no-tmux no-op; what the sim pins is the call sequence and that every
// phase literal the prose passes validates.
function label(sim, wu, phase, topic) {
  const res = sim.run(['session', 'label', wu, phase, topic]);
  assert.strictEqual(res.labelled, false, `session label is a no-op in the sim (${phase})`);
}

function walkDeliveryPhasesToImplementation(sim, wu, topic) {
  label(sim, wu, 'specification', topic);
  sim.run(['topic', 'start', wu, 'specification', topic]);
  sim.run(['topic', 'complete', wu, 'specification', topic]);
  label(sim, wu, 'planning', topic);
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);
  sim.run(['topic', 'complete', wu, 'planning', topic]);
  // Implementation is the one phase whose prose never issues `topic start`:
  // task init owns creation (implementation-process Step 0, created arm).
  label(sim, wu, 'implementation', topic);
  const init = sim.run(['task', 'init', wu, topic]);
  assert.strictEqual(init.mode, 'created', 'fresh implementation takes the created arm');
  sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`]);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  // Phase boundary: the completion defers its flag, the consolidation pass
  // finds nothing, and the re-record closes the phase (consolidation-pass.md F).
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--next-task', '~']);
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'consolidated_phases', '1']);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--phase-complete']);
  sim.run(['topic', 'complete', wu, 'implementation', topic]);
}

function walkDeliveryPhases(sim, wu, topic, { sources }) {
  // Specification. The source gate holds engine-side: completion refuses
  // while any row is still pending, then clears once every row incorporates.
  label(sim, wu, 'specification', topic);
  sim.run(['topic', 'start', wu, 'specification', topic]);
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'pending']);
  }
  sim.refuses(['topic', 'complete', wu, 'specification', topic], /unresolved source rows/);
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'incorporated']);
  }
  sim.write(`.workflows/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
  sim.run(['commit', wu, '-m', `spec(${wu}): construct`]);
  sim.run(['topic', 'complete', wu, 'specification', topic]);

  // Planning.
  sim.render(['entry-gate', `${wu}.planning.${topic}`], { expect: 'empty' });
  label(sim, wu, 'planning', topic);
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.write(`.workflows/${wu}/planning/${topic}/planning.md`, `# Plan — ${topic}\n`);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);

  // Approvals and authoring decisions are manifest state, vocabulary-guarded.
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'approvals.structure', '2026-07-23']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'approvals.tasks.p1', '2026-07-23']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'pending']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'rejected']);
  // The amendment resets a rejected row to pending only after the rewrite validates (author-tasks C).
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'pending']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'approved']);
  sim.refuses(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'maybe'], /Invalid staging task status/);
  // Guarded containers refuse the writes no prose ever makes — wholesale, pushed, or non-canonically spelt.
  sim.refuses(['manifest', 'set', `${wu}.planning.${topic}`, 'staging', '{}'], /guarded state container/);
  sim.refuses(['manifest', 'push', `${wu}.planning.${topic}`, 'staging.author-p1.tasks', 'x'], /guarded state container/);
  sim.refuses(['manifest', 'set', `${wu}.planning`, `items.${topic}.staging.author-p1.tasks.${topic}-1-1`, 'bogus'], /"items" is the topic tree/);
  sim.refuses(['manifest', 'set', wu, `phases.planning.items.${topic}.staging.author-p1.tasks.${topic}-1-1`, 'bogus'], /"phases" is the phase tree/);
  sim.run(['manifest', 'delete', `${wu}.planning.${topic}`, 'staging.author-p1']);

  sim.run(['commit', wu, '-m', `plan(${wu}): author`, '--plan', topic]);
  sim.run(['topic', 'complete', wu, 'planning', topic]);

  // Implementation — no `topic start` in prose; task init creates.
  sim.render(['entry-gate', `${wu}.implementation.${topic}`], { expect: 'empty' });
  label(sim, wu, 'implementation', topic);
  const implInit = sim.run(['task', 'init', wu, topic]);
  assert.strictEqual(implInit.mode, 'created', 'fresh implementation takes the created arm');
  sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`]);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  // Each executor and reviewer report's BANK entries deposit the moment the
  // report arrives (task-loop B/D) — durable on the manifest, drained at the
  // phase boundary.
  const bankPush = sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'bank',
    `{"task":"${topic}-1-1","source":"executor","summary":"helper duplicated from a sibling task","detail":"src/a.js:12 mirrors src/b.js:40","files":["src/a.js","src/b.js"]}`]);
  assert.strictEqual(bankPush.length, 1, 'first bank deposit creates the array');
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'bank',
    `{"task":"${topic}-1-1","source":"reviewer","summary":"dead scaffolding a later task orphaned","detail":"src/c.js:8 export unused","files":["src/c.js"]}`]);
  const bank = JSON.parse(sim.read(['manifest', 'get', `${wu}.implementation.${topic}`, 'bank']));
  assert.strictEqual(bank.length, 2, 'bank accumulates entries');
  assert.strictEqual(bank[0].source, 'executor', 'entries store as objects, not strings');
  // Phase boundary: the completion defers its flag, the consolidation pass
  // verdicts the banked entries residue (they ride to the end-of-implementation
  // analysis), and the re-record closes the phase (consolidation-pass.md F).
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--next-task', '~']);
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'consolidated_phases', '1']);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--phase-complete']);
  // The analysis loop's synthesizer consumes the residue (invoke-synthesizer.md);
  // conclude's hygiene covers a loop that never got its verdicts in.
  sim.run(['manifest', 'delete', `${wu}.implementation.${topic}`, 'bank']);
  sim.run(['topic', 'complete', wu, 'implementation', topic]);

  // Review — verification, then the prepped pipeline: out-of-scope
  // findings bank durably on the manifest, the report is produced from
  // the action list after the do-now apply, the outcome renders through
  // its surfaces, and the pass completes the phase. The offer at a pass
  // consumes the banked set and deletes the field.
  sim.render(['entry-gate', `${wu}.review.${topic}`], { expect: 'empty' });
  label(sim, wu, 'review', topic);
  sim.run(['topic', 'start', wu, 'review', topic]);
  sim.run(['manifest', 'push', `${wu}.review.${topic}`, 'reviewed_tasks', `${topic}-1-1`]);
  sim.render(['resume-gate', `${wu}.review.${topic}`, '--variant', 'review'], { expect: 'content' });
  sim.run(['manifest', 'push', `${wu}.review.${topic}`, 'out_of_scope',
    '{"id":"A3","kind":"quick-fix","summary":"a guard the spec never asked for"}']);
  sim.write(`.workflows/${wu}/review/${topic}/report.md`, `# Review — ${topic}\n`);
  sim.run(['commit', wu, '-m', `review(${wu}): complete review`, '--topic', `review/${topic}`]);
  const presentation = sim.write(`.workflows/.cache/${wu}/review/${topic}/presentation.json`, {
    topic,
    verdict: 'pass',
    corrected: { applied: 2, reverted: 0, suite: 'green' },
    out_of_scope: 1,
    discarded: 1,
  });
  sim.render(['review-presentation', `${wu}.review.${topic}`, '--file', presentation], { expect: 'content' });
  sim.render(['review-gate', `${wu}.review.${topic}`, '--verdict', 'pass', '--out-of-scope', '1'], { expect: 'content' });
  sim.run(['manifest', 'delete', `${wu}.review.${topic}`, 'out_of_scope']);
  sim.run(['topic', 'complete', wu, 'review', topic]);
  sim.run(['commit', wu, '-m', `review(${wu}): complete review phase`]);
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
    label(sim, wu, 'discussion', wu);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.workflows/${wu}/discussion/${wu}.md`, `# Discussion — ${wu}\n`);
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    sim.run(['commit', wu, '-m', `discussion(${wu}): complete ${wu} discussion`, '--topic', `discussion/${wu}`, '--kb']);

    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    sim.render(['early-completion-gate', wu], { expect: 'content' });
    sim.render(['revisit-gate', wu, '--prev', 'implementation', '--next', 'review'], { expect: 'content' });
    const done = sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
    assert.strictEqual(done.status, 'completed');
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline'], { expect: 'content' }),
      /Feature Completed/, 'pipeline completion renders the banner receipt');
  });

  it('feature: review skipped at the early-completion gate', () => {
    const wu = 'quick-ship';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Ship it', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    walkDeliveryPhasesToImplementation(sim, wu, wu);
    sim.render(['early-completion-gate', wu], { expect: 'content' });
    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): complete feature pipeline (review skipped)`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'complete', '--pipeline', '--skipped-review'], { expect: 'content' }),
      /review skipped/, 'skipped-review completion renders its banner');
  });

  it('bugfix: investigation → spec (source pinned to topic) → delivery → complete', () => {
    const wu = 'crash-fix';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'bugfix', '--description', 'Fix the crash', '--session-log-file', log]);

    label(sim, wu, 'investigation', wu);
    sim.run(['topic', 'start', wu, 'investigation', wu]);
    sim.write(`.workflows/${wu}/investigation/${wu}.md`, `# Investigation — ${wu}\n`);

    // A synchronous validation: dispatch, the foreground agent lands its
    // verdict, scan promotes, the row closes consumed — never surfaced.
    const val = sim.run(['agent', 'dispatch', wu, 'investigation', wu, '--kind', 'root-cause-validation']);
    sim.write(val.file, '# Verdict\n\nSTATUS: validated\n');
    sim.run(['agent', 'scan', wu, 'investigation', wu]);
    const closed = sim.run(['agent', 'incorporate', wu, 'investigation', wu, val.id]);
    assert.strictEqual(closed.status, 'incorporated');

    sim.run(['commit', wu, '-m', `investigation(${wu}): root cause`]);
    sim.run(['topic', 'complete', wu, 'investigation', wu]);

    // The bugfix spec source name is pinned to the topic.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    // The investigation hop takes the same reverse join as a discussion's: a
    // gap routed back reopens the investigation, stales the spec row naming
    // it, and the entry gate refuses until the investigation re-concludes.
    const invReopen = sim.run(['topic', 'reopen', wu, 'investigation', wu]);
    assert.deepStrictEqual(invReopen.sources_staled, [wu]);
    const bugSpec = sim.manifest(wu).phases.specification.items[wu];
    assert.strictEqual(bugSpec.sources[wu].status, 'stale');
    assert.strictEqual(bugSpec.reconcile_needed, 'investigation');
    sim.refuses(['topic', 'complete', wu, 'specification', wu], /unresolved source rows|completed/);
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);
    sim.render(['entry-gate', `${wu}.specification.${wu}`], { expect: 'empty' });

    // A spec-routed gap lands in the investigation's own triage queue: the
    // delivery reopens the item and stales the spec row; the queue answers;
    // absorb drains it and the pipeline re-concludes.
    sim.write('.workflows/.cache/scratch/gap-concern.md', '### Gap — retry semantics\n\nWhat the spec needs decided.\n');
    const gapLand = sim.run(['topic', 'triage', wu, 'investigation', wu,
      '--concern', '.workflows/.cache/scratch/gap-concern.md', '--slug', 'retry-semantics', '-m', `spec(${wu}): gap routed to ${wu}`]);
    assert.strictEqual(gapLand.reopened, true);
    assert.deepStrictEqual(gapLand.sources_staled, [wu]);
    const gapQueue = sim.run(['topic', 'queue', wu, 'investigation', wu]);
    assert.strictEqual(gapQueue.files.length, 1);
    sim.run(['topic', 'absorb', wu, 'investigation', wu,
      '--file', gapQueue.files[0].split('/').pop(), '-m', `investigation(${wu}/${wu}): absorb retry-semantics (from ${wu})`]);
    assert.strictEqual(sim.run(['topic', 'queue', wu, 'investigation', wu]).files.length, 0);
    sim.run(['topic', 'complete', wu, 'investigation', wu]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);

    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
    assert.strictEqual(sim.manifest(wu).status, 'completed');
  });

  it('quick-fix: scoping registers spec+plan in one pass → verification → review → complete', () => {
    const wu = 'typo';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'quick-fix', '--description', 'Rename a flag', '--session-log-file', log]);

    // Scoping (write-tasks): the spec commits BEFORE the baseline is captured,
    // so spec_commit always names a commit containing the specification.
    label(sim, wu, 'scoping', wu);
    sim.write(`.workflows/${wu}/specification/${wu}/specification.md`, '# Spec\n');
    sim.run(['topic', 'start', wu, 'specification', wu]);
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.write(`.workflows/${wu}/planning/${wu}/planning.md`, '# Plan\n');
    const baseline = sim.run(['commit', wu, '-m', `scoping(${wu}): specification baseline`]);
    assert.ok(baseline.committed, 'the baseline commit lands the spec');
    sim.run(['topic', 'start', wu, 'planning', wu]);
    sim.run(['manifest', 'set', 'project.defaults.plan_format', 'local-markdown']);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`,
      'format=local-markdown', `spec_commit=${baseline.committed}`,
      'task_list_gate_mode=auto', 'author_gate_mode=auto',
      'finding_gate_mode=auto', 'review_cycle=0', 'phase=1', 'task=~',
      `external_id=${wu}`, `task_map.${wu}-1=${wu}-1`,
      `task_map.${wu}-1-1=${wu}-1-1`, 'storage_paths=[]']);
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['topic', 'start', wu, 'scoping', wu]);
    sim.run(['topic', 'complete', wu, 'scoping', wu]);
    sim.run(['commit', wu, '-m', `scoping(${wu}): register plan`, '--plan', wu]);
    sim.render(['phase-completed', wu, '--phase', 'scoping', '--paths'], { expect: 'content' });

    // Implementation (verification workflow) + review — task init creates.
    const init = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(init.mode, 'created', 'fresh implementation takes the created arm');
    sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`]);
    sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    // Quick-fix takes no consolidation boundary (its plan never grows), so the
    // completion keeps the fused --phase-complete.
    sim.run(['task', 'complete', wu, wu, `${wu}-1-1`, '--phase', '1', '--next-task', '~', '--phase-complete']);
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    sim.run(['topic', 'start', wu, 'review', wu]);
    sim.run(['topic', 'complete', wu, 'review', wu]);

    sim.run(['workunit', 'complete', wu, '-m', `workflow(${wu}): pipeline complete`]);
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
    sim.run(['commit', wu, '-m', `research(${wu}): alpha`, '--topic', 'research/alpha']);
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    const ops = sim.write(`.workflows/.cache/${wu}/discovery/reconcile-ops.json`,
      [{ op: 'set', path: `${wu}.research.alpha`, fields: { reconcile_needed: true } }]);
    sim.run(['manifest', 'apply', wu, '--file', ops]);
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.research.alpha`, 'reconcile_needed']), 'true');
    sim.run(['manifest', 'delete', `${wu}.research.alpha`, 'reconcile_needed']);
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    sim.write(`.workflows/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);

    // The hop on a direct reopen: research alpha beneath alpha's decided
    // discussion — the same flag a triage landing sets.
    const reopenHop = sim.run(['topic', 'reopen', wu, 'research', 'alpha']);
    assert.deepStrictEqual(reopenHop.reconcile_flagged, [{ phase: 'discussion', topic: 'alpha' }]);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.alpha.reconcile_needed, 'research');
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);
    sim.run(['manifest', 'delete', `${wu}.discussion.alpha`, 'reconcile_needed']);

    // Beta discussed to a decided map; gamma-prime cancelled mid-flight and
    // reactivated later.
    sim.run(['topic', 'start', wu, 'discussion', 'beta']);
    sim.run(['discussion-map', 'add', wu, 'beta', 'retry-policy']);
    sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'decided']);
    sim.write(`.workflows/${wu}/discussion/beta.md`, '# Discussion — Beta\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
    sim.run(['topic', 'start', wu, 'research', 'gamma-prime']);
    sim.run(['topic', 'cancel', wu, 'research', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.research.gamma-prime`, '--verb', 'cancel'], { expect: 'content' }),
      /Cancelled "Gamma Prime" in research/, 'topic cancel receipt renders from the cancelled item');
    const cancelled = sim.manifest(wu).phases.discovery.items['gamma-prime'];
    assert.ok(!('order' in cancelled), 'cancel stashes the map order');
    assert.strictEqual(cancelled.previous_order, 3);
    sim.run(['topic', 'reactivate', wu, 'research', 'gamma-prime']);
    assert.match(sim.render(['topic-receipt', `${wu}.research.gamma-prime`, '--verb', 'reactivate'], { expect: 'content' }),
      /Reactivated "Gamma Prime" in research/, 'topic reactivate receipt renders from the restored item');
    assert.strictEqual(sim.manifest(wu).phases.discovery.items['gamma-prime'].order, 3,
      'reactivate restores the map order');
    sim.run(['topic', 'cancel', wu, 'research', 'gamma-prime']);

    // Delta: an off-topic concern rerouted from alpha parks on an unstarted
    // topic — the item is triaged, never in-progress; the delivery form is one
    // self-committing transaction (engine-numbered queue file, scratch
    // consumed, commit confined to concern + manifest).
    sim.run(['discovery-map', 'add', wu, 'delta', 'research', '--summary', 'Delta summary', '--source', 'reroute:alpha']);
    sim.write('.workflows/.cache/scratch/concern-scratch.md',
      '### Parked concern\n*From: alpha · discussion · 2026-07-23*\n\nDetails.\n');
    const parked = sim.run(['topic', 'triage', wu, 'research', 'delta',
      '--concern', '.workflows/.cache/scratch/concern-scratch.md', '--slug', 'parked-concern',
      '-m', `discussion(${wu}/alpha): reroute concern to delta`]);
    assert.strictEqual(parked.status, 'triaged');
    assert.strictEqual(parked.created, true);
    assert.strictEqual(parked.concern_path, `.workflows/${wu}/research/.triage/delta/001-parked-concern.md`);
    assert.ok(parked.committed, 'delivery self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, '.workflows/.cache/scratch/concern-scratch.md')), 'scratch consumed');
    const queue = sim.run(['topic', 'queue', wu, 'research', 'delta']);
    assert.strictEqual(queue.count, 1);
    assert.deepStrictEqual(queue.files, [parked.concern_path], 'the read verb lists the delivered concern');
    // The dispatch gate: a review never launches over a non-empty queue —
    // each queued concern is a pending change to the document a review
    // would read. Other kinds stay ungated.
    sim.refuses(['agent', 'dispatch', wu, 'research', 'delta', '--kind', 'review'], /review dispatch blocked/);
    sim.run(['agent', 'dispatch', wu, 'research', 'delta', '--kind', 'deep-dive', '--label', 'scope']);
    // topic absorb — the delivery's mirror: deliver a second concern, absorb
    // it, and the self-committing response answers what remains.
    sim.write('.workflows/.cache/scratch/concern-scratch.md',
      '### Second parked\n*From: alpha · discussion · 2026-07-23*\n\nMore.\n');
    sim.run(['topic', 'triage', wu, 'research', 'delta',
      '--concern', '.workflows/.cache/scratch/concern-scratch.md', '--slug', 'second-parked',
      '-m', `discussion(${wu}/alpha): reroute concern to delta`]);
    const absorbed = sim.run(['topic', 'absorb', wu, 'research', 'delta',
      '--file', '002-second-parked.md', '-m', `research(${wu}/delta): absorb 002-second-parked (from alpha)`]);
    assert.strictEqual(absorbed.absorbed, '002-second-parked.md');
    assert.strictEqual(absorbed.remaining, 1, 'the absorb answers the post-deletion count');
    assert.ok(absorbed.committed, 'absorb self-commits');
    assert.ok(!fs.existsSync(path.join(sim.dir, `.workflows/${wu}/research/.triage/delta/002-second-parked.md`)), 'queue file deleted');
    // The raise's display surfaces: the fresh-sitting notice, the offer gate
    // (agenda payload validated against the live queue), and the conclusion
    // blocker — the entry itself is read by the session, never rendered.
    sim.write('.workflows/.cache/scratch/triage-offer.json', JSON.stringify({
      items: [{ file: '001-parked-concern.md', title: 'Parked concern', origin: 'alpha', from_phase: 'discussion', from_date: '2026-07-23' }],
    }));
    sim.render(['triage-announce', `${wu}.research.delta`], { expect: 'content' });
    sim.render(['triage-offer', `${wu}.research.delta`, '--file', '.workflows/.cache/scratch/triage-offer.json'], { expect: 'content' });
    sim.render(['triage-block', `${wu}.research.delta`], { expect: 'content' });
    // Judgment landing: a research-side delivery beneath beta's completed
    // discussion parks the concern AND flags the discussion for
    // reconciliation — the discussion itself stays completed.
    sim.write('.workflows/.cache/scratch/concern-scratch.md', '### Feasibility question\n*From: alpha · discussion · 2026-07-23*\n\nIs this even possible?\n');
    const flagged = sim.run(['topic', 'triage', wu, 'research', 'beta',
      '--concern', '.workflows/.cache/scratch/concern-scratch.md', '--slug', 'feasibility-question',
      '-m', `discussion(${wu}/alpha): reroute concern to beta`]);
    assert.strictEqual(flagged.reconcile_flagged, true);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.reconcile_needed, 'research');
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'completed');
    // The dispatch gate clears the moment the queue drains.
    sim.refuses(['agent', 'dispatch', wu, 'research', 'beta', '--kind', 'review'], /review dispatch blocked/);
    sim.run(['topic', 'absorb', wu, 'research', 'beta',
      '--file', '001-feasibility-question.md', '-m', `research(${wu}/beta): absorb 001-feasibility-question (from alpha)`]);
    sim.run(['agent', 'dispatch', wu, 'research', 'beta', '--kind', 'review']);
    // Presence: a beat reads live and held (deferral territory for the
    // bridge, in-session territory for the epic view), the orderly clear
    // empties the scan.
    sim.run(['presence', 'beat', wu, 'research', 'alpha']);
    const present = sim.run(['presence', 'scan', wu]);
    assert.strictEqual(present.live, 1);
    assert.strictEqual(present.held, 1);
    assert.strictEqual(present.sessions[0].topic, 'alpha');
    assert.strictEqual(present.sessions[0].held, true);
    sim.run(['presence', 'clear', wu, 'research', 'alpha']);
    assert.strictEqual(sim.run(['presence', 'scan', wu]).live, 0);
    // The SessionEnd cleanup sweeps by owning session id — a peer session's
    // heartbeat survives.
    sim.write(`.workflows/.cache/${wu}/discussion/beta/presence`,
      JSON.stringify({ pid: null, pid_start: null, session_id: 'sim-sess' }) + '\n');
    sim.write(`.workflows/.cache/${wu}/discussion/gamma/presence`,
      JSON.stringify({ pid: null, pid_start: null, session_id: 'peer-sess' }) + '\n');
    const swept = sim.run(['presence', 'cleanup', 'sim-sess']);
    assert.deepStrictEqual(swept.cleared, [{ work_unit: wu, phase: 'discussion', topic: 'beta' }]);
    assert.deepStrictEqual(sim.run(['presence', 'scan', wu]).sessions.map((r) => r.topic), ['gamma']);
    sim.run(['presence', 'cleanup', 'peer-sess']);
    assert.strictEqual(sim.run(['presence', 'scan', wu]).sessions.length, 0);
    // Session labels, as every process skill's Step 0 issues them: an
    // unconfigured opt-in answers a disabled no-op — even on a bad argument,
    // since the enable check precedes validation; opted in but outside tmux
    // (the sim strips the identity) answers no-tmux; an unknown phase from
    // an enabled call site refuses; a project-manifest override beats the
    // system opt-in; the SessionEnd restore sweep answers with nothing to
    // restore.
    const label0 = sim.run(['session', 'label', wu, 'research', 'alpha']);
    assert.deepStrictEqual(label0, { ok: true, labelled: false, reason: 'disabled' });
    assert.deepStrictEqual(sim.run(['session', 'label', wu, 'deploying', 'alpha']),
      { ok: true, labelled: false, reason: 'disabled' });
    sim.run(['session', 'label-config', 'true']);
    const label1 = sim.run(['session', 'label', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(label1, { ok: true, labelled: false, reason: 'no-tmux' });
    sim.refuses(['session', 'label', wu, 'deploying', 'alpha'], /unknown phase/);
    sim.run(['manifest', 'set', 'project.defaults.tmux_labels', 'false']);
    assert.deepStrictEqual(sim.run(['session', 'label', wu, 'discussion', 'alpha']),
      { ok: true, labelled: false, reason: 'disabled' });
    sim.run(['manifest', 'delete', 'project.defaults.tmux_labels']);
    assert.deepStrictEqual(sim.run(['session', 'cleanup', 'sim-sess']), { ok: true, restored: false });
    sim.run(['session', 'label-config', 'false']);
    // Concurrent-session shape: a --topic commit slices out only its own
    // topic's paths — a peer topic's dirty file survives unstaged and
    // uncommitted, and the commit contains no path outside the topic + manifest.
    sim.write(`.workflows/${wu}/research/alpha.md`, '# Research: Alpha\n\nown progress\n');
    sim.write(`.workflows/${wu}/research/delta.md`,
      '# Research: Delta\n\n## Triage\n\n### Parked concern\n*From: alpha · discussion · 2026-07-23*\n\nDetails. Peer dirt.\n');
    sim.run(['commit', wu, '-m', `research(${wu}/alpha): progress`, '--topic', 'research/alpha']);
    const porcelain = git(sim.dir, ['status', '--porcelain']);
    assert.match(porcelain, /research\/delta\.md/, 'peer topic dirt survives a --topic commit');
    const headPaths = git(sim.dir, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    assert.ok(!headPaths.includes('research/delta.md'), 'peer topic path absent from the --topic commit');
    sim.run(['commit', wu, '-m', `research(${wu}): sweep delta dirt for the next steps`]);
    const reparked = sim.run(['topic', 'triage', wu, 'research', 'delta']);
    assert.strictEqual(reparked.created, false);
    assert.strictEqual(reparked.status, 'triaged');
    // A stub refuses the verbs that would bury or absorb never-worked concerns
    // — as the source and as the absorbing --by target alike.
    sim.refuses(['topic', 'complete', wu, 'research', 'delta'], /triaged/);
    sim.refuses(['topic', 'supersede', wu, 'research', 'delta', '--by', 'alpha'], /triaged/);
    sim.refuses(['topic', 'supersede', wu, 'research', 'alpha', '--by', 'delta'], /cannot absorb/);
    // Landing on a completed discussion reopens it to receive the entry. The
    // drain's fold-into-existing branch: the concern collides with a decided
    // subtopic, so the fold flips it back to exploring — re-arming the
    // conclusion gate — and the session re-decides before re-completing.
    const reopened = sim.run(['topic', 'triage', wu, 'discussion', 'beta']);
    assert.strictEqual(reopened.reopened, true);
    assert.strictEqual(reopened.status, 'in-progress');
    sim.refuses(['discussion-map', 'add', wu, 'beta', 'retry-policy'], /already exists/);
    const rearmed = sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'exploring']);
    assert.strictEqual(rearmed.all_decided, false, 'the fold re-arms the conclusion gate');
    const redecided = sim.run(['discussion-map', 'set', wu, 'beta', 'retry-policy', 'decided']);
    assert.strictEqual(redecided.all_decided, true);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);

    // Cancel/reactivate round-trips the stub; start is the one exit from triaged.
    sim.run(['topic', 'cancel', wu, 'research', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.previous_status, 'triaged');
    sim.run(['topic', 'reactivate', wu, 'research', 'delta']);
    assert.strictEqual(sim.manifest(wu).phases.research.items.delta.status, 'triaged');
    const drained = sim.run(['topic', 'start', wu, 'research', 'delta']);
    assert.strictEqual(drained.status, 'in-progress');
    assert.strictEqual(drained.created, false);
    sim.write(`.workflows/${wu}/research/delta.md`, '# Research — Delta\n\nDrained the parked concern.\n');
    sim.run(['commit', wu, '-m', `research(${wu}): delta`]);
    sim.run(['topic', 'complete', wu, 'research', 'delta']);

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

    // The discussion hop finds the grouped spec by reverse join: re-deciding
    // beta flags 'unified' (a spec named differently) and stales its beta row;
    // the superseded alpha spec is terminal — never flagged.
    const betaReopen = sim.run(['topic', 'reopen', wu, 'discussion', 'beta']);
    assert.deepStrictEqual(betaReopen.reconcile_flagged, [{ phase: 'specification', topic: 'unified' }]);
    assert.deepStrictEqual(betaReopen.sources_staled, ['unified']);
    const unified = sim.manifest(wu).phases.specification.items.unified;
    assert.strictEqual(unified.reconcile_needed, 'discussion');
    assert.strictEqual(unified.sources.beta.status, 'stale');
    assert.strictEqual(unified.sources.alpha.status, 'incorporated', 'sibling rows untouched');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.alpha.reconcile_needed, undefined);
    // While beta is back in-progress, the spec boundary hard-blocks the spec it
    // sources: the entry gate refuses direct entry, and the scoped view marks
    // the row blocked (unselectable until the discussion re-concludes).
    const gateWhileOpen = sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'content' });
    assert.match(gateWhileOpen, /Sources for "Unified" are back in-progress: beta/);
    const openView = specDetail(sim.dir, wu);
    assert.strictEqual(openView.scenario, 'blocked-discussions-open',
      'the single fast-path into an itself-blocked spec derives the terminal scenario');
    const openRow = openView.actionable.find((r) => r.name === 'unified');
    assert.strictEqual(openRow.blocked, true);
    assert.deepStrictEqual(openRow.open_sources, ['beta']);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
    sim.render(['entry-gate', `${wu}.specification.unified`], { expect: 'empty' });
    assert.strictEqual(specDetail(sim.dir, wu).actionable.find((r) => r.name === 'unified').blocked, false);
    // While stale, the spec boundary keeps the spec actionable — Continuing,
    // never Refining/concluded — and the stale row rides the detail.
    const staleView = specDetail(sim.dir, wu);
    const unifiedRow = staleView.actionable.find((r) => r.name === 'unified');
    assert.ok(unifiedRow, 'staled spec stays actionable');
    assert.strictEqual(unifiedRow.verb, 'Continuing');
    assert.strictEqual(unifiedRow.stale, 1);
    // Reconciliation: the advisory clears the flag at spec entry; the
    // diff-guided re-extraction re-incorporates the row.
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);

    // A BARE triage landing on the spec'd completed discussion takes the
    // same hop — no completed→in-progress transition skips it.
    const bareReopen = sim.run(['topic', 'triage', wu, 'discussion', 'beta']);
    assert.strictEqual(bareReopen.reopened, true);
    assert.strictEqual(bareReopen.reconcile_flagged, true);
    assert.deepStrictEqual(bareReopen.sources_staled, ['unified']);
    sim.run(['topic', 'complete', wu, 'discussion', 'beta']);
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);

    // The quiet-edit safety valve: a spec-side resolution amends beta's
    // document in place — `sources stale` runs the same reverse join with no
    // reopen, `--except` sparing the invoking spec whose extraction of the
    // resolution is current by construction.
    const quietSpared = sim.run(['sources', 'stale', wu, 'beta', '--except', 'unified']);
    assert.deepStrictEqual(quietSpared.staled, [], 'the invoking spec is spared');
    const quiet = sim.run(['sources', 'stale', wu, 'beta']);
    assert.deepStrictEqual(quiet.staled, ['unified']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'completed', 'no reopen — the discussion is untouched');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.unified.sources.beta.status, 'stale');
    sim.run(['manifest', 'delete', `${wu}.specification.unified`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'sources.beta.status', 'incorporated']);

    // Spec-entry bookkeeping: the wildcard snapshot and the analysis cache
    // metadata (a phase-level write on discussion).
    const statuses = sim.read(['manifest', 'get', `${wu}.specification.*`, 'status']);
    assert.match(statuses, /superseded/);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.checksum', 'abc123']);
    sim.run(['manifest', 'set', `${wu}.discussion`, 'analysis_cache.generated', '2026-07-23']);

    // Staging, candidate, and tracking state walks the manifest with
    // validated vocabularies at every step.
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'in-progress']);
    sim.run(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'complete']);
    sim.refuses(['manifest', 'set', `${wu}.specification.unified`, 'tracking.review-input-tracking-c1', 'done'], /Invalid tracking status/);
    sim.run(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.gate_mode=gated', 'staging.c1.tasks.1=pending', 'staging.c1.tasks.2=pending']);
    sim.run(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.tasks.1', 'approved']);
    sim.refuses(['manifest', 'set', `${wu}.review.unified`, 'staging.c1.tasks.2', 'later'], /Invalid staging task status/);
    // The approval overview joins the staging read to the render — the exact
    // sequence the loop prose prescribes: read statuses, build the payload
    // with them, render the worklist. A staging value the renderer rejects
    // would break here, not on the user's screen.
    const cycle = JSON.parse(sim.read(['manifest', 'get', `${wu}.review.unified`, 'staging.c1']));
    sim.write('.workflows/.cache/scratch/tasks-overview.json', JSON.stringify({
      label: 'Review synthesis cycle 1',
      tasks: Object.keys(cycle.tasks).map((n) => ({ title: `Task ${n}`, severity: 'Important', status: cycle.tasks[n] })),
    }));
    const overview = sim.render(['tasks-overview', `${wu}.review.unified`, '--file', '.workflows/.cache/scratch/tasks-overview.json'], { expect: 'content' });
    assert.match(overview, /1 remaining/, 'the approved row moves the remaining count');
    sim.write('.workflows/.cache/scratch/findings-summary.json', JSON.stringify({
      review_label: 'Integrity Review',
      items: [
        { title: 'Missing Outcome field', tag: 'Minor', summary: 'Task 1-1 lacks the Outcome field.', status: 'approved' },
        { title: 'Orphaned dependency', tag: 'Minor', summary: 'Task 2-3 depends on a removed task.' },
      ],
    }));
    const summary = sim.render(['findings-summary', `${wu}.specification.unified`, '--file', '.workflows/.cache/scratch/findings-summary.json'], { expect: 'content' });
    assert.match(summary, /~~Missing Outcome field~~/, 'the resolved finding renders struck');
    assert.match(summary, /1 remaining/, 'the pending finding moves the remaining count');
    // The review restart clears its staging subtree (exists-guarded delete) so a
    // stale cycle can never hijack the post-restart loop's crash-resume guards.
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.unified`, 'staging']).trim(), 'true');
    sim.run(['manifest', 'delete', `${wu}.review.unified`, 'staging']);
    assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.unified`, 'staging']).trim(), 'false');
    sim.refuses(['manifest', 'delete', `${wu}.review.unified`, 'staging'], /not found/);
    sim.run(['manifest', 'set', `${wu}.discovery`,
      'analysis_staging.research-analysis.gate_mode=gated',
      'analysis_staging.research-analysis.candidates.gamma-prime.status=pending',
      'analysis_staging.research-analysis.candidates.gamma-prime.fanout_offer=pending']);
    sim.run(['manifest', 'set', `${wu}.discovery`, 'analysis_staging.research-analysis.candidates.gamma-prime.status', 'approved']);
    sim.run(['manifest', 'delete', `${wu}.discovery`, 'analysis_staging.research-analysis']);

    // Bridge continuation surfaces render at every state.
    sim.render(['phase-completed', wu, '--phase', 'specification'], { expect: 'content' });
    sim.render(['epic-all-done-gate', wu], { expect: 'content' });

    // Cancelling a discussion a live spec sources collapses that spec: the
    // bare cancel refuses naming it; --cascade cancels both in one
    // transaction, and the epic detail reflects the collapse.
    sim.refuses(['topic', 'cancel', wu, 'discussion', 'beta'], /collapses the specification\(s\) sourcing it: unified/);
    const cascade = sim.run(['topic', 'cancel', wu, 'discussion', 'beta', '--cascade']);
    assert.deepStrictEqual(cascade.cascaded, ['unified']);
    assert.strictEqual(sim.manifest(wu).phases.discussion.items.beta.status, 'cancelled');
    assert.strictEqual(sim.manifest(wu).phases.specification.items.unified.status, 'cancelled');
    sim.run(['topic', 'reactivate', wu, 'specification', 'unified']);
    sim.run(['topic', 'reactivate', wu, 'discussion', 'beta']);
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

    // Run the pipeline out, then walk the hop family backwards: staleness
    // lands at each reopen, one hop downstream, value = the upstream phase.
    walkDeliveryPhases(sim, wu, wu, { sources: [wu] });

    // discussion → specification (reverse join): flag + stale source row.
    let ro = sim.run(['topic', 'reopen', wu, 'discussion', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'specification', topic: wu }]);
    assert.deepStrictEqual(ro.sources_staled, [wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
    // Re-completion clears nothing: the flag waits for the entry advisory,
    // the stale row for the spec's own reconciliation.
    let spec = sim.manifest(wu).phases.specification.items[wu];
    assert.strictEqual(spec.reconcile_needed, 'discussion');
    assert.strictEqual(spec.sources[wu].status, 'stale');
    // The read side never routes forward past the flag: the bridge's next
    // phase is the flagged spec, not done — the terminal branch stays untaken.
    const bridged = BRIDGE.discover(sim.dir, wu);
    assert.strictEqual(bridged.next_phase, 'specification');
    assert.deepStrictEqual(bridged.reconcile_pending, [`specification/${wu} (discussion)`]);
    sim.run(['manifest', 'delete', `${wu}.specification.${wu}`, 'reconcile_needed']);
    sim.run(['manifest', 'set', `${wu}.specification.${wu}`, `sources.${wu}.status`, 'incorporated']);

    // specification → planning: the pipeline hop, same-named item.
    ro = sim.run(['topic', 'reopen', wu, 'specification', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'planning', topic: wu }]);
    assert.strictEqual(ro.sources_staled, undefined);
    assert.strictEqual(sim.manifest(wu).phases.planning.items[wu].reconcile_needed, 'specification');
    sim.run(['topic', 'complete', wu, 'specification', wu]);
    sim.run(['manifest', 'delete', `${wu}.planning.${wu}`, 'reconcile_needed']);

    // planning → implementation.
    ro = sim.run(['topic', 'reopen', wu, 'planning', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'implementation', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.implementation.items[wu].reconcile_needed, 'planning');
    sim.run(['topic', 'complete', wu, 'planning', wu]);
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'reconcile_needed']);

    // implementation → review; a second reopen never clobbers the live flag.
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.deepStrictEqual(ro.reconcile_flagged, [{ phase: 'review', topic: wu }]);
    assert.strictEqual(sim.manifest(wu).phases.review.items[wu].reconcile_needed, 'implementation');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    ro = sim.run(['topic', 'reopen', wu, 'implementation', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined, 'existing flag never clobbered');
    sim.run(['topic', 'complete', wu, 'implementation', wu]);
    sim.run(['manifest', 'delete', `${wu}.review.${wu}`, 'reconcile_needed']);

    // review is the pipeline tail — reopening it flags nothing.
    ro = sim.run(['topic', 'reopen', wu, 'review', wu]);
    assert.strictEqual(ro.reconcile_flagged, undefined);
    sim.run(['topic', 'complete', wu, 'review', wu]);
    // Every flag cleared, every phase re-completed: the pipeline reads done.
    assert.strictEqual(BRIDGE.discover(sim.dir, wu).next_phase, 'done');
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
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'cancel', '--warn'], { expect: 'content' }),
      /marked as cancelled/, 'cancel receipt renders from the cancelled state');
    sim.run(['workunit', 'reactivate', wu]);
    assert.strictEqual(sim.manifest(wu).status, 'in-progress');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'reactivate'], { expect: 'content' }),
      /reactivated/, 'reactivate receipt renders from the restored state');
  });

  it('roadmap: JIT birth, harvest batch, horizon restructuring, lifecycle by join, pulled-item guards', () => {
    // The genesis conversation: a product-road session opens before any item
    // or work unit exists, its cadence commit is --roadmap, and imports land
    // at the product altitude.
    const roadmapDraft = sim.write('.workflows/.cache/roadmap-draft.md', '# Roadmap Session 001\n\nExploration.\n');
    sim.run(['roadmap', 'session', 'open', '--session-log-file', roadmapDraft]);
    const bridgeDoc = sim.write('app-idea.md', '# The idea, shaped outside\n');
    sim.run(['roadmap', 'import', bridgeDoc]);
    sim.run(['commit', '--roadmap', '-m', 'roadmap: exploration notes — session-001']);

    // Born lazily: the first park creates the node and its horizon — no
    // genesis ceremony, no prior state.
    sim.run(['roadmap', 'add', 'loyalty', '--horizon', 'v1',
      '--summary', 'repeat-customer rewards', '--origin', 'park:mvp',
      '--source', '.roadmap/sessions/session-001.md']);

    // The harvest's batch form: one transaction, horizons JIT in entry order.
    const items = sim.write('.workflows/.cache/roadmap-items.json', [
      { name: 'ordering', horizon: 'mvp', summary: 'customers order from a menu' },
      { name: 'menu-management', horizon: 'mvp', summary: 'operators maintain the menu' },
      { name: 'white-label', horizon: 'someday', summary: 'resell the platform' },
    ]);
    sim.run(['roadmap', 'add-batch', '--file', items]);
    let state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.horizons, ['v1', 'mvp', 'someday']);
    assert.strictEqual(state.totals.waiting, 4);

    // The map is loose left of the pull: reorder, re-bucket, split, remove.
    sim.run(['roadmap', 'horizon', 'reorder', 'mvp', 'v1', 'someday']);
    sim.run(['roadmap', 'move', 'white-label', '--horizon', 'v2']);
    sim.run(['roadmap', 'horizon', 'split', 'mvp', '--new', 'mvp-2', '--items', 'menu-management']);
    sim.run(['roadmap', 'horizon', 'merge', 'mvp-2', '--into', 'mvp']);
    sim.refuses(['roadmap', 'horizon', 'remove', 'v2'], /holds 1 item/);
    sim.run(['roadmap', 'remove', 'white-label']);
    sim.run(['roadmap', 'horizon', 'remove', 'v2']);
    // A positional insert lands the horizon where the release order says.
    sim.run(['roadmap', 'horizon', 'add', 'next', '--position', '2']);
    state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.horizons, ['mvp', 'next', 'v1', 'someday']);
    sim.run(['roadmap', 'horizon', 'remove', 'next']);

    // The harvest closes the session: marker cleared, log indexed, one
    // commit covering the session's dirt.
    const closed = sim.run(['roadmap', 'session', 'close', '-m', 'roadmap: session 001 — horizons sorted']);
    assert.strictEqual(closed.session, '001');
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.active_session, null);
    assert.strictEqual(state.next_session_number, 2);
    assert.deepStrictEqual(state.imports, [{ path: 'imports/app-idea.md' }]);

    // The pull is the commitment point: the join flips the derived state,
    // and the remainder is named at the moment of choice.
    const log = sessionLog(sim, 'mvp');
    sim.run(['workunit', 'create', 'mvp', 'epic', '--description', 'The MVP slice', '--session-log-file', log]);
    const pulled = sim.run(['roadmap', 'pull', 'ordering', '--into', 'mvp']);
    assert.deepStrictEqual(pulled.remainder, { mvp: 1 }, 'the remainder names what stays waiting');
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'ordering').state, 'in-flight');

    // Right of the pull the work unit is authoritative: re-bucket and remove
    // refuse; cosmetic edits and renames stay open, the join carried across.
    sim.refuses(['roadmap', 'move', 'ordering', '--horizon', 'v1'], /delivery decision/);
    sim.refuses(['roadmap', 'remove', 'ordering'], /joined to work unit "mvp"/);
    sim.run(['roadmap', 'edit', 'ordering', '--summary', 'guests order from a menu']);
    sim.run(['roadmap', 'rename', 'ordering', 'guest-ordering']);
    // Horizon restructuring is presentational for joins — rename cascades.
    sim.run(['roadmap', 'horizon', 'rename', 'mvp', 'launch']);
    state = sim.run(['roadmap', 'state']);
    const joined = state.items.find((i) => i.name === 'guest-ordering');
    assert.strictEqual(joined.horizon, 'launch');
    assert.strictEqual(joined.state, 'in-flight');

    // The epic harvest binds the item to the topic it crystallised as.
    sim.run(['discovery-map', 'add', 'mvp', 'guest-ordering', 'discussion', '--summary', 'guests order', '--source', 'roadmap']);
    sim.run(['roadmap', 'bind', 'guest-ordering', '--topic', 'guest-ordering']);

    // Pull-forward: a waiting item joins the in-flight epic as a map topic
    // in one composed transaction.
    sim.run(['roadmap', 'pull-forward', 'menu-management', '--into', 'mvp', '--routing', 'discussion']);
    assert.strictEqual(sim.manifest('mvp').phases.discovery.items['menu-management'].source, 'roadmap');

    // A product session that deepens pulled ground flags across the join —
    // a signal on the live phase item, never a rewrite.
    sim.run(['topic', 'start', 'mvp', 'discussion', 'guest-ordering']);
    const flag = sim.run(['roadmap', 'flag', 'guest-ordering']);
    assert.deepStrictEqual(flag.flagged, [{ phase: 'discussion', topic: 'guest-ordering' }]);
    assert.strictEqual(sim.manifest('mvp').phases.discussion.items['guest-ordering'].reconcile_needed, 'roadmap');
    sim.run(['manifest', 'delete', 'mvp.discussion.guest-ordering', 'reconcile_needed']);

    // The cancel-revert hop: cancelling the joined topic hands the item back
    // to waiting; reactivation does NOT re-join (the revert is one-way — a
    // re-pull re-binds deliberately).
    sim.run(['topic', 'start', 'mvp', 'discussion', 'menu-management']);
    const cancelled = sim.run(['topic', 'cancel', 'mvp', 'discussion', 'menu-management']);
    assert.deepStrictEqual(cancelled.roadmap_reverted, ['menu-management']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'menu-management').state, 'waiting');
    sim.run(['topic', 'reactivate', 'mvp', 'discussion', 'menu-management']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'menu-management').state, 'waiting',
      'reactivation never silently re-joins');

    // The un-pull for a never-started topic: removing the fresh map topic
    // hands the item back — and the dismissed name then needs the user's
    // confirmed re-add to pull forward again.
    sim.run(['roadmap', 'add', 'reporting', '--horizon', 'v1', '--summary', 'owners see the numbers']);
    sim.run(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion']);
    const removed = sim.run(['discovery-map', 'remove', 'mvp', 'reporting']);
    assert.deepStrictEqual(removed.roadmap_reverted, ['reporting']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'reporting').state, 'waiting');
    sim.refuses(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion'], /previously dismissed/);
    sim.run(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion', '--force-dismissed']);
    sim.run(['discovery-map', 'remove', 'mvp', 'reporting']);

    // The render surfaces hold over the live state: the map view and the
    // add-to-joined-horizon gate.
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /DISPLAY: roadmap/);
    assert.match(sim.render(['roadmap-add-gate', '--horizon', 'launch'], { expect: 'content' }),
      /MENU: roadmap add gate/);
    sim.render(['roadmap-session-receipt'], { expect: 'empty' });
    // The static gate menus render like every menu — engine-served.
    assert.match(sim.render(['roadmap-harvest-gate'], { expect: 'content' }), /MENU: roadmap harvest gate/);
    assert.match(sim.render(['roadmap-parks-gate'], { expect: 'content' }), /MENU: roadmap parks gate/);
    assert.match(sim.render(['roadmap-shape-gate'], { expect: 'content' }), /MENU: roadmap shape gate/);
    assert.match(sim.render(['roadmap-conclude-gate'], { expect: 'content' }), /MENU: roadmap conclude gate/);
    assert.match(sim.render(['name-gate'], { expect: 'content' }), /MENU: name gate/);
    assert.match(sim.render(['name-gate', '--variant', 'collision'], { expect: 'content' }), /Choose a different name/);
    assert.match(sim.render(['shape-gate'], { expect: 'content' }), /MENU: shape gate/);
    assert.match(sim.render(['synthesis-gate'], { expect: 'content' }), /MENU: synthesis gate/);
    assert.match(sim.render(['query-failure-gate'], { expect: 'content' }), /MENU: query failure gate/);

    // Shipping the unit flips the derived state to shipped — nothing stored.
    sim.run(['workunit', 'complete', 'mvp', '-m', 'workflow(mvp): pipeline complete']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'guest-ordering').state, 'shipped');
    assert.deepStrictEqual(state.totals, { items: 4, waiting: 3, in_flight: 0, shipped: 1, orphaned: 0 });
    // The view renders the shipped row from the join, after the completion.
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /✓ Guest Ordering/);

    // The reserved identity holds: no work unit may take the layer's name.
    sim.refuses(['workunit', 'create', 'roadmap', 'epic', '--description', 'x', '--no-session-log'], /is reserved/);
  });

  it('roadmap: work-unit cancel reverts every join into the unit', () => {
    sim.run(['roadmap', 'add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    sim.run(['roadmap', 'add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    const log = sessionLog(sim, 'mvp');
    sim.run(['workunit', 'create', 'mvp', 'epic', '--description', 'MVP', '--session-log-file', log]);
    sim.run(['roadmap', 'pull', 'ordering', 'menus', '--into', 'mvp']);
    const res = sim.run(['workunit', 'cancel', 'mvp']);
    assert.deepStrictEqual([...res.roadmap_reverted].sort(), ['menus', 'ordering']);
    const state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.totals, { items: 2, waiting: 2, in_flight: 0, shipped: 0, orphaned: 0 });
    // Pulling into the cancelled unit refuses; reactivation reopens the road.
    sim.refuses(['roadmap', 'pull', 'ordering', '--into', 'mvp'], /active work only/);
    sim.run(['workunit', 'reactivate', 'mvp']);
    sim.run(['roadmap', 'pull', 'ordering', '--into', 'mvp']);
  });

  it('roadmap: absorb re-aims a feature-held join at the epic topic — never an orphan', () => {
    sim.run(['roadmap', 'add', 'loyalty', '--horizon', 'v1', '--summary', 'repeat-customer rewards']);
    const flog = sessionLog(sim, 'loyalty-feat');
    sim.run(['workunit', 'create', 'loyalty-feat', 'feature', '--description', 'Loyalty', '--session-log-file', flog]);
    sim.run(['roadmap', 'pull', 'loyalty', '--into', 'loyalty-feat']);
    sim.run(['topic', 'start', 'loyalty-feat', 'discussion', 'loyalty-feat']);
    sim.write('.workflows/loyalty-feat/discussion/loyalty-feat.md', '# Loyalty discussion\n');
    const elog = sessionLog(sim, 'platform');
    sim.run(['workunit', 'create', 'platform', 'epic', '--description', 'Platform', '--session-log-file', elog]);

    const res = sim.run(['workunit', 'absorb', 'loyalty-feat', '--into', 'platform', '--topic', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reaimed, ['loyalty']);
    let state = sim.run(['roadmap', 'state']);
    const row = state.items.find((i) => i.name === 'loyalty');
    assert.strictEqual(row.state, 'in-flight');
    assert.strictEqual(row.work_unit, 'platform');
    assert.strictEqual(row.topic, 'loyalty');

    // The re-aimed join keeps the cancel-revert hop live at its new home.
    const cancelled = sim.run(['topic', 'cancel', 'platform', 'discussion', 'loyalty']);
    assert.deepStrictEqual(cancelled.roadmap_reverted, ['loyalty']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').state, 'waiting');
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
    assert.match(sim.render(['pivot-continuation', wu], { expect: 'content' }),
      /MENU: pivot continuation/, 'the manage flow can fetch the continuation menu post-pivot');

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
    assert.match(sim.render(['absorb-receipt', epic, '--topic', 'stray-topic'], { expect: 'content' }),
      /Absorbed into Epic/, 'absorb receipt renders from the epic post-state');
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
    assert.match(sim.render(['promote-receipt', `${wu}.specification.logging`, '--to', 'logging-cc'], { expect: 'content' }),
      /Promoted to Cross-Cutting/, 'promote receipt renders from the promoted item');

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

    // No `topic start` — task init creates, per implementation-process Step 0.
    const init = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(init.mode, 'created', 'fresh implementation takes the created arm');
    assert.strictEqual(init.gates.task_gate_mode, 'gated');
    assert.strictEqual(init.gates.consolidation_gate_mode, 'gated', 'the boundary walk gate ships gated');
    sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`]);
    sim.run(['task', 'start', wu, wu, `${wu}-1-1`]);
    // The brief announces the dispatch — the shared task header plus summary and watch.
    const briefPayload = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/task-brief.json`,
      { id: `${wu}-1-1`, title: 'Wire the auth entry point', current: 1, total: 2, phase: '1 — Core', position: '1 of 2 in phase', summary: 'Wire the auth entry point.', watch: ['the login redirect'] });
    const brief = sim.render(['task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload], { expect: 'content' });
    assert.match(brief, /DISPLAY: task brief/, 'pre-dispatch brief renders its section');
    assert.match(brief, /^\*\*`▪ Wire the auth entry point \(1 of 2\)`\*\*$/m,
      'the brief heads itself with the task marker — no prose-authored title above the call');
    assert.match(brief, /\*\*Watch\*\*:\n- the login redirect/, 'the brief carries its watch list');
    // Gates are fetched at their own stage — the task verbs answer with pure JSON.
    assert.match(sim.render(['task-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: task gate/, 'gated task gate renders its menu');
    assert.match(sim.render(['blocked-tasks'], { expect: 'content' }),
      /MENU: blocked tasks/, 'blocked-tasks stop renders its menu');
    const findings = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/findings.json`,
      { findings: [{ title: 'Loose end', severity: 'minor' }] });
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    assert.ok(fs.existsSync(path.join(sim.dir, '.workflows', wu, 'implementation', wu, `fix-tracking-${wu}-1-1.md`)),
      'fix history is committed history, not purgeable cache');
    assert.match(sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: fix gate/, 'gated fix gate renders its menu');
    // The result header is one surface for every presentation moment.
    const resultPayload = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/task-result.json`,
      { id: `${wu}-1-1`, title: 'Wire the auth entry point', current: 1, total: 2, phase: '1 — Core', position: '1 of 2 in phase' });
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'blocked'], { expect: 'content' }),
      /\*\*`▪ Wire the auth entry point \(1 of 2\)`\*\*\n\n\*\*⚑ Blocked\*\* — \*the executor stopped before completing this task\*/,
      'an executor block renders the marker above the alert verdict');
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'needs-changes'], { expect: 'content' }),
      /\*\*◐ Needs changes\*\* — \*attempt 1, escalates at 3\*/, 'below-threshold needs-changes renders the calm verdict');
    // Two more attempts reach the fix threshold — the verdict names it.
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-1`, '--findings-file', findings]);
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'needs-changes'], { expect: 'content' }),
      /\*\*◐ Needs changes\*\* — \*attempt 3, escalation threshold reached\*/,
      'threshold-forced needs-changes names the reached threshold');
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload, '--result', 'approved'], { expect: 'content' }),
      /\*\*✓ Approved\*\* — \*after 3 needs-changes rounds\*/, 'approval names the needs-changes round count');
    assert.match(sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' }),
      /MENU: fix gate/, 'threshold-forced fix gate renders its menu');
    sim.run(['task', 'complete', wu, wu, `${wu}-1-1`, '--phase', '1', '--next-task', `${wu}-1-2`]);
    sim.run(['task', 'analysis-cycle', wu, wu]);
    assert.match(sim.render(['cycle-gate'], { expect: 'content' }),
      /MENU: cycle gate/, 'cycle gate renders its menu');

    // Auto gates render a continuation artifact — the loop never ends a turn by silence.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'task_gate_mode=auto', 'fix_gate_mode=auto']);
    sim.run(['task', 'start', wu, wu, `${wu}-1-2`]);
    // Every task start gets its brief; the stale first-task payload refuses, the rewritten one renders.
    const staleBrief = spawnSync('node', [ENGINE, 'render', 'task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload],
      { cwd: sim.dir, encoding: 'utf8' });
    assert.strictEqual(staleBrief.status, 1, 'a stale brief payload refuses rather than rendering the previous task');
    assert.match(staleBrief.stderr, /stale task-brief\.json/, "the refusal names the previous task's payload as stale");
    const briefPayload2 = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/task-brief.json`,
      { id: `${wu}-1-2`, title: 'Close out the auth flow', current: 2, total: 2, phase: '1 — Core', position: '2 of 2 in phase', external: { label: 'tick', id: 'TCK-2' }, summary: 'Close out the auth flow.' });
    assert.match(sim.render(['task-brief', `${wu}.implementation.${wu}`, '--file', briefPayload2], { expect: 'content' }),
      new RegExp(`\\*\\*Id\\*\\*: \`${wu}-1-2\` · tick \`TCK-2\``), 'the brief carries the format display identifier');
    // The result payload is rewritten per task — the header refuses the previous task's id.
    const resultPayload2 = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/task-result.json`,
      { id: `${wu}-1-2`, title: 'Close out the auth flow', current: 2, total: 2, phase: '1 — Core', position: '2 of 2 in phase' });
    assert.match(sim.render(['task-result', `${wu}.implementation.${wu}`, '--file', resultPayload2, '--result', 'approved'], { expect: 'content' }),
      /\*\*✓ Approved\*\*\n/, 'a clean task renders the bare approved verdict');
    const taskGate = sim.render(['task-gate', `${wu}.implementation.${wu}`], { expect: 'content' });
    assert.match(taskGate, /DISPLAY: task gate auto-approved/, 'auto task gate renders its continuation line');
    assert.match(taskGate, /approved \[auto\]\. Committing and moving to the next task\./,
      'continuation line names the action that follows');
    sim.run(['task', 'fix-attempt', wu, wu, `${wu}-1-2`, '--findings-file', findings]);
    const fixGate = sim.render(['fix-gate', `${wu}.implementation.${wu}`], { expect: 'content' });
    assert.match(fixGate, /DISPLAY: fix gate auto-accepted/, 'auto fix gate renders its continuation line');
    assert.match(fixGate, /accepted \[auto\]\. Passing the findings to the executor\./,
      'continuation line names the dispatch that follows');
    // Phase 1's boundary: tasks done, the pass owed — the completion defers
    // its flag (task-loop H `boundary` disposition), the pass stages a
    // consolidation task in the still-open phase (consolidation-pass.md B–E),
    // and the phase records once it lands.
    const bankEntry = `{"task":"${wu}-1-2","source":"reviewer","summary":"near-miss helpers","detail":"src/x.js:3 vs src/y.js:9","files":["src/x.js","src/y.js"]}`;
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'bank', bankEntry]);
    sim.run(['task', 'complete', wu, wu, `${wu}-1-2`, '--phase', '1', '--next-task', '~']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.1=pending']);
    sim.refuses(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.1', 'perhaps'], /Invalid staging task status/);
    const overviewPayload = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/tasks-overview.json`,
      { label: 'Phase 1 consolidation', tasks: [{ title: 'Merge the near-miss helpers', severity: 'near-miss', status: 'pending' }] });
    assert.match(sim.render(['tasks-overview', `${wu}.implementation.${wu}`, '--file', overviewPayload], { expect: 'content' }),
      /Phase 1 consolidation/, 'the boundary walk renders the shared overview surface');
    const consolidationPayload = sim.write(`.workflows/.cache/${wu}/implementation/${wu}/proposed-task.json`, {
      current: 1, total: 1, title: 'Merge the near-miss helpers', severity: 'near-miss',
      placement: 'phase 1', problem: 'p', solution: 's', outcome: 'o',
      steps: ['1. x'], criteria: ['- c'], tests: ['- t'],
    });
    assert.match(sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', consolidationPayload, '--gate', 'gated', '--comment-hint', 'Provide feedback to adjust'], { expect: 'content' }),
      /Placement: phase 1/, 'the boundary walk renders the shared per-task surface');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.p1.tasks.1', 'approved']);
    // The pass marks itself landed before the plan write — a crash after this
    // point resumes at task creation, never a re-sweep.
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'consolidated_phases', '1']);
    sim.run(['manifest', 'set', `${wu}.planning.${wu}`, `task_map.${wu}-1-3`, `${wu}-1-3`]);
    // The folded bank entry is consumed once its task exists in the plan.
    sim.run(['manifest', 'pull', `${wu}.implementation.${wu}`, 'bank', bankEntry]);
    // The consolidation task runs through the ordinary loop; its completion
    // finds the phase consolidated and records it.
    sim.run(['task', 'start', wu, wu, `${wu}-1-3`]);
    sim.run(['task', 'complete', wu, wu, `${wu}-1-3`, '--phase', '1', '--next-task', '~', '--phase-complete']);
    const loopItem = sim.manifest(wu).phases.implementation.items[wu];
    assert.deepStrictEqual(loopItem.consolidated_phases, [1], 'the boundary marker survives');
    assert.deepStrictEqual(loopItem.completed_phases, [1], 'the phase records complete after consolidation');
    assert.deepStrictEqual(loopItem.bank, [], 'the folded entry left the bank');

    // An analysis cycle's staging walks the manifest; all-skipped is a legal exit.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.1=pending', 'staging.c1.tasks.2=pending']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.1', 'skipped']);
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.c1.tasks.2', 'skipped']);

    // The synthesizer's dispatch consumes the residual bank — verdicts land in
    // its report, then the field is deleted (invoke-synthesizer.md).
    sim.run(['manifest', 'push', `${wu}.implementation.${wu}`, 'bank',
      `{"task":"${wu}-1-2","source":"executor","summary":"pre-existing debt","detail":"src/legacy.js predates the phase","files":["src/legacy.js"]}`]);
    sim.run(['manifest', 'delete', `${wu}.implementation.${wu}`, 'bank']);

    // The ad hoc plan-changes gate stages under its own family key (ad-hoc-plan-changes.md E/F)
    // and renders the shared proposed-task surface without the synthesis-only fields.
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`,
      'staging.ad-hoc-1.gate_mode=gated', 'staging.ad-hoc-1.tasks.1=pending']);
    const adhocPayload = `.workflows/.cache/${wu}/implementation/${wu}/proposed-task.json`;
    fs.mkdirSync(path.dirname(path.join(sim.dir, adhocPayload)), { recursive: true });
    fs.writeFileSync(path.join(sim.dir, adhocPayload), JSON.stringify({
      current: 1, total: 1, title: 'Fix redirect', placement: 'phase 1', priority: '1',
      problem: 'p', solution: 's', outcome: 'o', steps: ['1. x'], criteria: ['- c'], tests: ['- t'],
    }));
    const adhocGate = sim.render(['proposed-task', `${wu}.implementation.${wu}`,
      '--file', adhocPayload, '--gate', 'gated'], { expect: 'content' });
    assert.match(adhocGate, /Placement: phase 1/, 'ad hoc payload renders its placement line');
    assert.match(adhocGate, /MENU: task approval/, 'ad hoc gate carries the shared approval menu');
    assert.ok(!/Sources:/.test(adhocGate), 'absent synthesis fields render nothing');
    assert.match(adhocGate, /\*\*`▪ Fix redirect`\*\*/,
      'head takes the task-header marker idiom, ordinal omitted for a batch of one');
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'staging.ad-hoc-1.tasks.1', 'approved']);

    // A resumed session resets gate modes to gated (session-scoped auto).
    sim.run(['manifest', 'set', `${wu}.implementation.${wu}`, 'task_gate_mode', 'auto']);
    const resumed = sim.run(['task', 'init', wu, wu]);
    assert.strictEqual(resumed.mode, 'resumed', 'second init is a genuine resume');
    assert.strictEqual(resumed.gates.task_gate_mode, 'gated', 'resume resets auto to gated');
    assert.strictEqual(resumed.gates.consolidation_gate_mode, 'gated', 'the boundary gate resets with the session');
    const completed = sim.manifest(wu).phases.implementation.items[wu].completed_tasks;
    assert.deepStrictEqual([...completed].sort(), [`${wu}-1-1`, `${wu}-1-2`, `${wu}-1-3`],
      'completed_tasks carries each id once — the boundary re-record must not double-count');
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
    // A traversal topic refuses at every verb — the colocation promise depends on it.
    sim.refuses(['agent', 'dispatch', wu, 'research', '../../../escape', '--kind', 'review'], /Invalid topic/);
    const review = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review']);
    sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'deep-dive', '--label', 'auth']);
    let scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.pending, [], 'nothing readable while agents run');

    // The review agent finishes (writes content); the deep-dive is still out.
    sim.write(review.file, '# Review findings\n\n## F1\n\n## F2\n');
    scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), ['review-001']);
    sim.run(['agent', 'ack', wu, 'research', 'alpha', 'review-001', '--findings', 'F1,F2']);
    sim.run(['agent', 'announce', wu, 'research', 'alpha', 'review-001']);
    sim.run(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F1']);
    const last = sim.run(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F2']);
    assert.strictEqual(last.status, 'incorporated', 'last finding auto-incorporates');

    // Skip-all from acknowledged: declined ids stay recorded unsurfaced.
    const skipAll = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review']);
    sim.write(skipAll.file, '# More findings\n\n### F9: x\n');
    sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    sim.run(['agent', 'ack', wu, 'research', 'alpha', skipAll.id, '--findings', 'F9']);
    const closedEarly = sim.run(['agent', 'incorporate', wu, 'research', 'alpha', skipAll.id]);
    assert.deepStrictEqual(closedEarly.remaining, ['F9'], 'skip-all keeps the declined record');

    // A surfacing lane: the batch renders from a payload, then drains in one
    // call — the apply/route screens' call sequence, not the walk's.
    const laned = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review']);
    sim.write(laned.file, '# Laned findings\n\n### F1: a\n\n### F2: b\n\n### F3: c\n');
    sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    sim.run(['agent', 'ack', wu, 'research', 'alpha', laned.id, '--findings', 'F1,F2,F3']);
    sim.run(['agent', 'announce', wu, 'research', 'alpha', laned.id]);
    const payload = `.workflows/.cache/${wu}/research/alpha/batch-apply.json`;
    sim.write(payload, JSON.stringify({
      lane: 'apply',
      items: [{ title: 'a', detail: 'follows from the tier decision' }, { title: 'b', detail: 'retracted rationale, unstruck' }],
    }));
    sim.render(['finding-batch', `${wu}.research.alpha`, '--file', payload], { expect: 'content' });
    // The decide lane carries the veto menu; a screen past the five-item cap
    // is refused whole — pagination is the prose's job, screens the engine's.
    const decidePayload = `.workflows/.cache/${wu}/research/alpha/batch-decide.json`;
    sim.write(decidePayload, JSON.stringify({
      lane: 'decide',
      items: [{ title: 'd', detail: 'determined by the tier decision' }],
    }));
    assert.match(sim.render(['finding-batch', `${wu}.research.alpha`, '--file', decidePayload], { expect: 'content' }),
      /\*\*Discuss\*\*/, 'the decide menu carries the discuss route');
    sim.write(decidePayload, JSON.stringify({
      lane: 'decide',
      items: Array.from({ length: 6 }, (_, i) => ({ title: `d${i}`, detail: 'x' })),
    }));
    sim.refuses(['render', 'finding-batch', `${wu}.research.alpha`, '--file', decidePayload], /at most 5 items/);
    // The route lane requires each item's title alongside its target — a
    // producer still writing the bare {target, detail} pair fails here.
    const routePayload = `.workflows/.cache/${wu}/research/alpha/batch-route.json`;
    sim.write(routePayload, JSON.stringify({
      lane: 'route',
      items: [{ title: 'c', target: 'beta', detail: 'their subtopic owns the claim' }],
    }));
    assert.match(sim.render(['finding-batch', `${wu}.research.alpha`, '--file', routePayload], { expect: 'content' }),
      /\[→ beta\]/, 'the destination rides the tag slot');
    sim.write(routePayload, JSON.stringify({ lane: 'route', items: [{ target: 'beta', detail: 'd' }] }));
    sim.refuses(['render', 'finding-batch', `${wu}.research.alpha`, '--file', routePayload], /item 1 is missing "title"/);
    const applied = sim.run(['agent', 'surface', wu, 'research', 'alpha', laned.id, 'F1,F2']);
    assert.deepStrictEqual(applied.remaining, ['F3'], 'a batch drains its lane and leaves the rest');
    const walked = sim.run(['agent', 'surface', wu, 'research', 'alpha', laned.id, 'F3']);
    assert.strictEqual(walked.status, 'incorporated', 'the walk finishes what the batch left');

    // A lane past the cap drains over screens: render at most five with the
    // remainder on the confirm, surface that screen, return for the next.
    const paged = sim.run(['agent', 'dispatch', wu, 'research', 'alpha', '--kind', 'review']);
    const ids = Array.from({ length: 11 }, (_, i) => `F${i + 1}`);
    sim.write(paged.file, `# Paged findings\n\n${ids.map((f) => `### ${f}: x\n`).join('\n')}`);
    sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    sim.run(['agent', 'ack', wu, 'research', 'alpha', paged.id, '--findings', ids.join(',')]);
    sim.run(['agent', 'announce', wu, 'research', 'alpha', paged.id]);
    const screen = (from, remaining) => {
      sim.write(payload, JSON.stringify({
        lane: 'apply',
        remaining,
        items: ids.slice(from, from + 5).map((f) => ({ title: f, detail: 'd' })),
      }));
      return sim.render(['finding-batch', `${wu}.research.alpha`, '--file', payload], { expect: 'content' });
    };
    assert.match(screen(0, 6), /\(6 more after this\)/, 'screen one names the remainder');
    let row = sim.run(['agent', 'surface', wu, 'research', 'alpha', paged.id, ids.slice(0, 5).join(',')]);
    assert.strictEqual(row.remaining.length, 6, 'first screen drains five');
    assert.match(screen(5, 1), /\(1 more after this\)/, 'screen two names the remainder');
    row = sim.run(['agent', 'surface', wu, 'research', 'alpha', paged.id, ids.slice(5, 10).join(',')]);
    assert.strictEqual(row.remaining.length, 1, 'second screen drains five more');
    assert.match(screen(10, 0), /Apply it, then move on\n/, 'the last screen is a singleton with no tail');
    row = sim.run(['agent', 'surface', wu, 'research', 'alpha', paged.id, 'F11']);
    assert.strictEqual(row.status, 'incorporated', 'the last screen incorporates the row');

    // Guards hold mid-lifecycle, and the conclusion gate still sees the straggler.
    sim.refuses(['agent', 'surface', wu, 'research', 'alpha', 'review-001', 'F1'], /incorporated/);
    sim.refuses(['agent', 'ack', wu, 'research', 'alpha', 'deep-dive-001-auth', '--clean'], /in-flight/);
    scan = sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    assert.deepStrictEqual(scan.in_flight.map((r) => r.id), ['deep-dive-001-auth']);

    // The straggler lands clean; the phase can conclude.
    sim.write(`.workflows/.cache/${wu}/research/alpha/deep-dive-001-auth.md`, '# Nothing novel\n');
    sim.run(['agent', 'scan', wu, 'research', 'alpha']);
    const clean = sim.run(['agent', 'ack', wu, 'research', 'alpha', 'deep-dive-001-auth', '--clean']);
    assert.strictEqual(clean.status, 'incorporated');
    sim.write(`.workflows/${wu}/research/alpha.md`, '# Research — Alpha\n');
    sim.run(['topic', 'complete', wu, 'research', 'alpha']);

    // A perspective council in discussion: the pair is one set, synthesis
    // joins it by number, and a half-landed council is never synthesisable.
    sim.run(['topic', 'start', wu, 'discussion', 'alpha']);
    const pair = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'perspective',
      '--label', 'user-centric', '--label', 'capability-first']);
    assert.strictEqual(pair.agents.length, 2);
    assert.ok(pair.agents.every((a) => a.id.includes(`-${pair.set}-`)), 'one shared set number');
    sim.write(pair.agents[0].file, '# The user-centric case\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(scan.pending.length + scan.in_flight.length, 2,
      'a half-landed council: one report in, one still out');
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set], /not complete/);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', '009'], /No perspective set/);

    sim.write(pair.agents[1].file, '# The capability-first case\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    const syn = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set]);
    assert.strictEqual(syn.id, `synthesis-${pair.set}`);
    sim.refuses(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'synthesis', '--set', pair.set], /already has a live synthesis/);
    for (const a of pair.agents) sim.run(['agent', 'incorporate', wu, 'discussion', 'alpha', a.id]);
    sim.write(syn.file, '# Landscape\n\n### T1: the tradeoff\n');
    scan = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.deepStrictEqual(scan.pending.map((/** @type {any} */ r) => r.id), [syn.id],
      'consumed perspectives never mask the synthesis');

    // The discussion closing sequence: the synthesis drains, the closing
    // probe classifies off the scan lists, the final review dispatches and
    // drains, and a satisfied probe precedes completion.
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', syn.id, '--findings', 'T1']);
    sim.run(['agent', 'announce', wu, 'discussion', 'alpha', syn.id]);
    const synDone = sim.run(['agent', 'surface', wu, 'discussion', 'alpha', syn.id, 'T1']);
    assert.strictEqual(synDone.status, 'incorporated');

    const reviewRows = (s) => [...s.in_flight, ...s.pending, ...s.acknowledged, ...s.incorporated]
      .filter((r) => r.kind === 'review');
    let probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(reviewRows(probe).length, 0, 'probe: no review row — the due classification');
    assert.deepStrictEqual(probe.pending, [], 'nothing else awaits surfacing');

    const fin = sim.run(['agent', 'dispatch', wu, 'discussion', 'alpha', '--kind', 'review']);
    sim.write(fin.file, '# Final review\n\n## G1\n');
    sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    sim.run(['agent', 'ack', wu, 'discussion', 'alpha', fin.id, '--findings', 'G1']);
    sim.run(['agent', 'announce', wu, 'discussion', 'alpha', fin.id]);
    const finDone = sim.run(['agent', 'surface', wu, 'discussion', 'alpha', fin.id, 'G1']);
    assert.strictEqual(finDone.status, 'incorporated');

    probe = sim.run(['agent', 'scan', wu, 'discussion', 'alpha']);
    assert.strictEqual(probe.in_flight.length + probe.pending.length + probe.acknowledged.length, 0,
      'probe: nothing owed — the satisfied classification');
    assert.strictEqual(reviewRows(probe)[0].status, 'incorporated');

    // The defer batch the closing gates use: one uniform write settles the
    // stragglers and answers with the map's convergence state once.
    sim.run(['discussion-map', 'add', wu, 'alpha', 'edge-a']);
    sim.run(['discussion-map', 'add', wu, 'alpha', 'edge-b']);
    const deferredBatch = sim.run(['discussion-map', 'set', wu, 'alpha', 'edge-a=deferred', 'edge-b=deferred']);
    assert.deepStrictEqual(deferredBatch.set, { 'edge-a': 'deferred', 'edge-b': 'deferred' });
    assert.strictEqual(deferredBatch.all_decided, true, 'the batch response carries convergence — no follow-up read');

    sim.write(`.workflows/${wu}/discussion/alpha.md`, '# Discussion — Alpha\n');
    sim.run(['topic', 'complete', wu, 'discussion', 'alpha']);
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

    // Reserved names never mint a work unit — `project` routes dot-paths to
    // the project manifest, `baseline` is the KB's project-baseline identity.
    sim.refuses(['workunit', 'create', 'project', 'feature', '--description', 'Nope', '--no-session-log'], /is reserved/);
    sim.refuses(['workunit', 'create', 'baseline', 'feature', '--description', 'Nope', '--no-session-log'], /is reserved/);
    sim.refuses(['workunit', 'create', 'roadmap', 'feature', '--description', 'Nope', '--no-session-log'], /is reserved/);

    // The project baseline walks its lifecycle on the project manifest, and
    // each render surface serves its prescribed moment: the progress map and
    // area gate mid-interview, the pause receipt, the doc list and completion
    // receipt once every area lands.
    sim.run(['manifest', 'set', 'project.baseline.status', 'in-progress']);
    assert.strictEqual(sim.read(['manifest', 'get', 'project.baseline.status']), 'in-progress');
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'pending']);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'pending']);
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'researched']);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'researched']);
    sim.write('.workflows/.cache/scratch/baseline-scope.json', JSON.stringify({
      mode: 'fresh',
      areas: [{ name: 'overview', detail: 'What the product is' }, { name: 'dispatcher', detail: 'The downstream push' }],
    }));
    assert.match(sim.render(['baseline-scope-gate', '--file', '.workflows/.cache/scratch/baseline-scope.json'], { expect: 'content' }), /Assess these areas\?/);
    sim.write('.workflows/.cache/scratch/baseline-round.json', JSON.stringify({
      area: 'dispatcher',
      questions: [{ text: 'Why polling over webhooks?', candidates: ['Decoupling from a flaky downstream'] }],
    }));
    assert.match(sim.render(['baseline-round', '--file', '.workflows/.cache/scratch/baseline-round.json'], { expect: 'content' }), /1\. Why polling over webhooks\?/);
    assert.match(sim.render(['baseline-doc-gate'], { expect: 'content' }), /Land it\?/);
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'completed']);
    assert.match(sim.render(['baseline-progress'], { expect: 'content' }), /1 area\(s\) remain/);
    assert.match(sim.render(['baseline-area-gate', '--area', 'overview'], { expect: 'content' }), /Keep going\?/);
    assert.match(sim.render(['baseline-paused'], { expect: 'content' }), /Paused — 1 of 2/);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'completed']);
    sim.run(['manifest', 'set', 'project.baseline.status', 'completed']);
    assert.match(sim.render(['baseline-progress'], { expect: 'content' }), /2 area\(s\) documented/);
    assert.match(sim.render(['baseline-receipt'], { expect: 'content' }), /Baseline complete — 2 area\(s\)/);
    assert.match(sim.render(['baseline-manage-gate'], { expect: 'content' }), /What would you like to do\?/);
    assert.match(sim.render(['baseline-doc-pick'], { expect: 'content' }), /Which doc\?/);

    // After every refusal the unit still derives and completes normally.
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });
});
