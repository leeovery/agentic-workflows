'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's world (tests/README.md §11): the project every
// scenario starts from, made once per process and copied for each; `Sim`,
// which drives the engine through its in-process entry rather than a
// process per call — the same argv, the same answers (stdout, stderr and an
// exit code), a thousandth of the start-up — and has the oracle
// (pipeline-oracle.cjs) audit the whole state after every mutation; and the
// steps the skill prose takes, which the scenarios replay.
//
// A scenario is an ordered list of `sim.run()` calls, in the scenario file
// of its work type or its subject (`test-pipeline-simulation-*.cjs`).
// Together they cover the happy paths and the supported edges: reopening,
// supersession, cancel and reactivate at topic and work-unit level, pivot,
// absorption, promotion, restarts.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const engine = require(path.join(ROOT, 'skills/workflow-engine/scripts/engine.cjs'));
const schema = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/manifest-schema.cjs'));
const { KNOWLEDGE_DIR } = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/knowledge/files.cjs'));
const START_GATEWAY = require(path.join(ROOT, 'skills/workflow-start/scripts/gateway.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/workflow-continue-epic/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/workflow-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/workflow-engine/scripts/lib.cjs'));
const { epicMenu } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/projections/epic.cjs'));
const { startMenu } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/projections/start.cjs'));
const { skillAt } = require(path.join(ROOT, 'skills/workflow-engine/scripts/domain/position.cjs'));
const { initRepo, fixtureFrom, cleanupFixture, git, stateGit } = require('./engine-harness.cjs');
const { STATE_DIR_NAME, statePath } = require(path.join(ROOT, 'skills/workflow-engine/scripts/kernel/state-root.cjs'));

const { shellWords, auditState, auditGatePayload, auditTrust, trustLines, auditGateAnswer } = require('./pipeline-oracle.cjs');

// The project every scenario starts from, made once per process.
const simWorld = fixtureFrom('pipeline-sim-', (dir) => {
  // This checkout's knowledge setup: keyword-only, pinned as setup records
  // it, so the transactions' indexing builds a store as a set-up project's does.
  fs.mkdirSync(statePath(dir, KNOWLEDGE_DIR), { recursive: true });
  fs.writeFileSync(statePath(dir, KNOWLEDGE_DIR, 'config.json'), '{ "knowledge": { "provider": null } }\n');
  // The skills a conversation carries on in after a compaction, installed
  // as a project installs them — kept out of git's sight, so no commit or
  // dirt check ever meets them.
  const skills = [...schema.VALID_PHASES.map((phase) => skillAt('unit', phase)), ...schema.PROJECT_IDENTITIES.map((name) => skillAt(name))];
  for (const skill of /** @type {string[]} */ (skills)) {
    fs.mkdirSync(path.join(dir, '.claude/skills', skill), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), path.join(dir, '.claude/skills', skill, 'SKILL.md'));
  }
  fs.mkdirSync(path.join(dir, '.git/info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), '.claude/skills/\n');
  // Part of the project's code lives in an ignored clone: a repo of its own
  // that the project's git ignores. A code commit naming a path in it lands
  // in the clone's history, and every dirt read reaches into it.
  const api = initRepo(path.join(dir, 'api'));
  fs.writeFileSync(path.join(api, 'README.md'), '# API\n');
  git(api, ['add', '-A']);
  git(api, ['commit', '-q', '-m', 'init']);
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), 'api/\n');
});

class Sim {
  constructor() {
    // A project with its state worktree at `.leeway/`, which ignores the
    // cache and the checkout's own knowledge directory.
    this.dir = simWorld();
    // The system config directory sits beside the project, as a real one
    // does: the conversation folders the sim's calls mark live there.
    this.configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-config-'));
    this.api = path.join(this.dir, 'api');
    this.step = 0;
    this.conversations = 0;
    // Hermetic environment, as a delta from this process's — the engine runs
    // in-process and holds these keys for the call's duration: the system
    // config dir pins into the sandbox (the knowledge base reads it) and the
    // tmux identity is taken away, so `session label` can never rename the
    // developer's real session.
    // A real session always carries its identity, and presence reads it to
    // tell its own holds from a peer's — pin one so the sim never gates
    // against itself, whatever the host environment carries.
    // The sim's own identity: this process, alive with a real start time, so
    // the rows its verbs beat read `held`.
    this.env = {
      WORKFLOWS_CONFIG_DIR: this.configDir,
      CLAUDE_CODE_SESSION_ID: 'sim-session',
      CLAUDE_PID: String(process.pid),
      TMUX: undefined,
      TMUX_PANE: undefined,
    };
  }

  destroy() {
    cleanupFixture(this.dir);
    fs.rmSync(this.configDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  write(rel, content) {
    const full = path.resolve(this.dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    return rel;
  }

  // Transactions answer with pure JSON — display artifacts belong to render
  // surfaces fetched at their display point. The section-bearing commands
  // left are presence, whose scan is a read-only snapshot whose deferral
  // advisory rides the dump, the view-family pattern, and a raise's draw and
  // show — every raise command but its answer — whose sections are the
  // screen the raise is drawn as.
  /** @param {string[]} args */
  static carriesSections([group, verb]) {
    return group === 'presence' || (group === 'raise' && verb !== 'answer');
  }

  /**
   * The environment one call runs under: the sim's own, or a named session's.
   * @param {{CLAUDE_CODE_SESSION_ID: string, CLAUDE_PID: string}|null} [identity]
   */
  envOf(identity) {
    return identity ? { ...this.env, ...identity } : this.env;
  }

  /**
   * A handoff the gate mod carries: the conversation is cleared and the work
   * starts in a fresh one, in the same Claude process.
   */
  handOver() {
    this.conversations += 1;
    this.env = { ...this.env, CLAUDE_CODE_SESSION_ID: `sim-session-${this.conversations}` };
  }

  /**
   * A second (or third) session on the same checkout: identical sandbox,
   * distinct identity. Presence records the calling process's pid and session
   * id, and every consumer that asks whether a hold is mine or a peer's
   * compares against them — so concurrent sessions in the sim are exactly
   * that, two identities issuing calls into one project. `pid` defaults to
   * this process, which is alive and has a real start time, so the session's
   * rows read `held`; a session that must read as a stranger to another's
   * hold is given a pid of its own.
   * @param {string} sessionId @param {number} [pid]
   */
  session(sessionId, pid = process.pid) {
    const identity = { CLAUDE_CODE_SESSION_ID: sessionId, CLAUDE_PID: String(pid) };
    return {
      id: sessionId,
      run: (/** @type {string[]} */ args) => this.run(args, identity),
      refuses: (/** @type {string[]} */ args, /** @type {RegExp} */ pattern) => this.refuses(args, pattern, identity),
      read: (/** @type {string[]} */ args) => this.read(args, identity),
      render: (/** @type {string[]} */ args, /** @type {object} */ opts) => this.render(args, { ...opts, identity }),
      write: (/** @type {string} */ rel, /** @type {any} */ content) => this.write(rel, content),
    };
  }

  /**
   * One engine call, in this process: the CLI's argv contract without a
   * process per assertion. Answers what the spawned CLI answered.
   * @param {string[]} args @param {object|null} [identity] @param {string} [stdin] what a hook target reads
   */
  engine(args, identity = null, stdin = '') {
    return engine.run(args, { cwd: this.dir, env: this.envOf(identity), stdin });
  }

  /**
   * One engine call awaited — the door the knowledge verbs that wait on the
   * embedding provider take, which `engine` refuses.
   * @param {string[]} args @param {object|null} [identity] @param {string} [stdin]
   */
  engineAsync(args, identity = null, stdin = '') {
    return engine.runAsync(args, { cwd: this.dir, env: this.envOf(identity), stdin });
  }

  /** Engine mutation: expect ok:true JSON, then audit the whole state. */
  run(args, identity = null, stdin = '') {
    return this.audited(args, this.engine(args, identity, stdin));
  }

  /** Engine mutation awaited — the door a command that answers later takes — audited as `run`'s. */
  async runAsync(args, identity = null, stdin = '') {
    return this.audited(args, await this.engineAsync(args, identity, stdin));
  }

  /**
   * A mutation's answer `res` held to ok:true JSON, then the whole state
   * audited: its parsed answer.
   * @param {string[]} args @param {{code: number, stdout: string, stderr: string}} res
   */
  audited(args, res) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')}`;
    assert.strictEqual(res.code, 0,
      `[${label}] expected success\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const nl = res.stdout.indexOf('\n');
    const first = (nl === -1 ? res.stdout : res.stdout.slice(0, nl)).trim();
    const parsed = JSON.parse(first);
    assert.strictEqual(parsed.ok, true, `[${label}] engine answered ok:false`);
    this.sections = nl === -1 ? '' : res.stdout.slice(nl + 1);
    if (!Sim.carriesSections(args)) {
      assert.strictEqual(this.sections, '',
        `[${label}] transaction verbs answer with pure JSON — display sections belong to render surfaces fetched at their display point`);
    }
    auditState(this.dir, label);
    auditTrust(this, label, args);
    if (typeof parsed.committed === 'string' || (Array.isArray(parsed.committed) && parsed.committed.length > 0)) {
      assert.strictEqual(stateGit(this.dir, ['ls-files', '--', KNOWLEDGE_DIR]).trim(), '',
        `[${label}] the commit carried the knowledge directory — it is the checkout's own, never committed`);
      assert.strictEqual(git(this.dir, ['ls-files', '--', STATE_DIR_NAME]).trim(), '',
        `[${label}] the code tree carries the state — it lives on its own branch`);
    }
    return parsed;
  }

  /**
   * Engine call answering on stderr with stdout empty — the SessionStart
   * hook's target, whose stdout Claude Code would inject into the resumed
   * conversation. Exit 0, {ok:true} JSON on stderr, then audit.
   */
  runOnStderr(args, identity = null) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')} (stderr response)`;
    const res = this.engine(args, identity);
    assert.strictEqual(res.code, 0,
      `[${label}] expected success\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.strictEqual(res.stdout, '', `[${label}] a SessionStart hook target keeps stdout empty`);
    const parsed = JSON.parse(res.stderr.trim());
    assert.strictEqual(parsed.ok, true, `[${label}] engine answered ok:false`);
    auditState(this.dir, label);
    return parsed;
  }

  /** Engine call that must refuse loudly: exit 1, {ok:false} JSON on stderr. */
  refuses(args, pattern, identity = null, stdin = '') {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')} (expected refusal)`;
    const res = this.engine(args, identity, stdin);
    assert.strictEqual(res.code, 1, `[${label}] expected exit 1, got ${res.code}\nstdout: ${res.stdout}`);
    const parsed = JSON.parse(res.stderr.trim());
    assert.strictEqual(parsed.ok, false, `[${label}] refusal is not clean {ok:false} JSON`);
    if (pattern) assert.match(parsed.error, pattern, `[${label}] refusal message drifted`);
    auditState(this.dir, `${label} — state untouched`);
    auditTrust(this, `${label} — trust log untouched`);
    return parsed;
  }

  /** Bare-stdout read (manifest get / exists / resolve …). */
  read(args, identity = null) {
    const res = this.engine(args, identity);
    assert.strictEqual(res.code, 0,
      `[read engine ${args.join(' ')}] expected success, got ${res.code}\nstderr: ${res.stderr}`);
    return res.stdout.trim();
  }

  /** Render surface: must exit 0 (an entry-gate that passes renders empty). */
  render(args, { expect, identity = null } = {}) {
    const res = this.engine(['render', ...args], identity);
    assert.strictEqual(res.code, 0,
      `[render ${args.join(' ')}] crashed or refused\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    if (expect === 'content') {
      assert.ok(res.stdout.trim().length > 0, `[render ${args.join(' ')}] produced no output`);
    }
    if (expect === 'empty') {
      assert.strictEqual(res.stdout.trim(), '', `[render ${args.join(' ')}] expected a pass (empty render)`);
    }
    auditGatePayload(this, args, identity);
    return res.stdout;
  }

  manifest(wu) {
    return JSON.parse(fs.readFileSync(path.join(this.dir, '.leeway', wu, 'manifest.json'), 'utf8'));
  }
}

/** Session-log helper — workunit create and discovery-session open need one. */
function sessionLog(sim, wu, n = 1) {
  return sim.write(`.leeway/${wu}/discovery/sessions/session-00${n}.md`,
    `# Discovery Session 00${n}\n\n## Conclusion\n\n(none)\n`);
}

/** Write a message scratch and return the `topic send` argv delivering it. */
function sendArgv(sim, wu, phase, topic, slug = 'a-message') {
  const scratch = sim.write(`.leeway/.cache/scratch/${slug}.md`, `### ${slug}\n\nBody of ${slug}.\n`);
  return ['topic', 'send', wu, phase, topic, '--content', scratch, '--slug', slug, '-m', `send ${slug} to ${topic}`];
}

/** Send one message to a topic. */
function send(sim, wu, phase, topic, slug) {
  return sim.run(sendArgv(sim, wu, phase, topic, slug));
}

/** An epic whose map carries the named topics, each routed to discussion. */
function mappedEpic(sim, wu, names) {
  sim.run(['workunit', 'create', wu, 'epic', '--description', 'Cancel units', '--session-log-file', sessionLog(sim, wu)]);
  sim.run(['discovery-map', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
    names.map((name) => ({ name, routing: 'discussion', summary: name })))]);
  sim.run(['discovery-session', 'close', wu, '-m', `discovery(${wu}): shape the map`]);
}

/** One presence row from a scan, or undefined. */
function presenceRow(scan, phase, topic) {
  return scan.sessions.find((r) => r.phase === phase && r.topic === topic);
}

// What the sim's conversation re-reads to carry on from its position — the
// one line of JSON `conversation position` answers, its DATA the same
// message. A read: nothing to audit.
function carryOn(sim, identity = null) {
  const res = sim.engine(['conversation', 'position'], identity);
  assert.strictEqual(res.code, 0, `conversation position failed\nstderr: ${res.stderr}`);
  const marker = '=== POSITION (json for the gate mod — never display) ===\n';
  const at = res.stdout.indexOf(marker);
  assert.ok(at !== -1, `conversation position answered no POSITION section:\n${res.stdout}`);
  const answer = JSON.parse(res.stdout.slice(at + marker.length).trim());
  assert.ok(res.stdout.slice(0, at).endsWith(`${answer.text}\n`), 'the DATA section is the message the JSON carries');
  return answer;
}

// Shared phase walk used by the linear pipelines: specification → planning →
// implementation (→ review), with the bookkeeping each phase records.
// Every place labels itself on arrival: a navigation skill, the bridge, the
// roadmap, and the baseline label the place alone (`arrive`), and every
// phase skill's Step 0 records its place before anything else
// (`handoffEntry`). The sim strips the tmux identity and pins an empty config
// dir, so the tmux rename is the disabled or no-tmux no-op; what the sim pins
// is the call sequence, that every name and phase literal the prose passes
// validates, and the conversation's position each arrival records.
function arrive(sim, name) {
  const res = sim.run(['session', 'label', name]);
  assert.strictEqual(res.labelled, false, `the sim labels no tmux session (${name})`);
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name }, `the arrival records the place alone (${name})`);
  if (schema.PROJECT_IDENTITIES.includes(name)) {
    assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', `workflow-${name}`, 'SKILL.md'), `the ${name} carries on in its own skill`);
  } else {
    assert.strictEqual(here.skill, null, 'a work unit\'s menu carries nothing on');
    assert.match(here.text, /outside any phase, so there is nothing to carry on from\.$/);
  }
}

// The start menu, then a work unit's continue menu, as a conversation reaches
// them: boot's repair (the start menu is no position), then the unit's own
// label.
function menuEntry(sim, wu) {
  const repair = sim.run(['session', 'repair']);
  assert.strictEqual(repair.repaired, false, 'the sim has no tmux label to put back');
  assert.strictEqual(carryOn(sim).position, null, 'the start menu is no position');
  arrive(sim, wu);
}

// A move into a phase hands off — a menu's pick and a conclusion through the
// bridge alike: carried by the gate mod, the conversation is cleared and the
// phase skill starts in a fresh one, whose first engine call is its label —
// marking the conversation and recording the place, so a compaction there
// carries on in the phase's skill.
function handoffEntry(sim, wu, phase, topic) {
  sim.handOver();
  const res = sim.run(['session', 'label', wu, phase, topic]);
  assert.strictEqual(res.labelled, false, `the sim labels no tmux session (${phase})`);
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name: wu, phase, topic }, `the phase skill records its place (${phase})`);
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', /** @type {string} */ (skillAt(wu, phase)), 'SKILL.md'),
    `a compaction there carries on in the phase's skill (${phase})`);
}

// A move into work, as the prose makes it through handing-off.md: the route —
// the skill's slash command and its arguments — passes to the engine as it
// stands, which checks it against the handoff table and names where the work
// goes. Unannounced, the session invokes the DATA's skill with its args in
// place; announced, the gate mod carries the continuation the engine composed.
// Either way what is invoked is the route itself.
/** @param {Sim} sim @param {string} route */
function handoff(sim, route) {
  const argv = ['handoff', ...shellWords(route)];
  const inline = sim.engine(argv);
  assert.strictEqual(inline.code, 0, `[handoff ${route}] refused\n${inline.stderr}`);
  assert.match(inline.stdout, /^handoff: inline$/m);
  assert.ok(!inline.stdout.includes('=== HANDOFF'), 'the payload is the mod\'s, present only announced');
  const data = (/** @type {string} */ field) => inline.stdout.match(new RegExp(`^${field}: (.*)$`, 'm'))?.[1];
  assert.strictEqual([`/${data('skill')}`, data('args')].filter(Boolean).join(' '), route, 'invoked in place, the skill takes the route as it stands');
  const carried = engine.run(argv, { cwd: sim.dir, env: { ...sim.env, WORKFLOWS_HANDOFF: '1' } });
  assert.match(carried.stdout, /^handoff: mod$/m);
  const payload = JSON.parse(carried.stdout.split(/^=== HANDOFF .*$/m)[1].trim());
  assert.strictEqual(payload.text, `Invoke \`${route}\`.`, 'nothing travels but the route');
  return payload;
}

// The bridge's hop between a linear unit's phases: its gateway derives the
// next phase and the route it is entered by, and the continuation hands that
// route off.
/** @param {Sim} sim @param {string} wu @param {string} phase */
function bridgeTo(sim, wu, phase) {
  const dump = BRIDGE.format(BRIDGE.discover(sim.dir, wu));
  assert.match(dump, new RegExp(`^next_phase: ${phase}$`, 'm'), `the bridge derives ${phase}`);
  handoff(sim, /** @type {string} */ (dump.match(/^next_route: (.*)$/m)?.[1]));
}

// An epic phase's conclusion, pause or in-session exit hands off to the epic
// menu, which labels the work unit and leads with the banner for what just
// concluded or paused — none after a cancel or a postpone, whose receipt was
// the session's — and the completion offer wherever the scoped dump reads
// all done. Answers the banner rendered, empty when none is.
/** @param {Sim} sim @param {string} wu @param {string} phase @param {string} [outcome] @returns {string} */
function arriveAtEpicMenu(sim, wu, phase, outcome = 'completed') {
  handoff(sim, `/workflow-continue-epic ${wu} ${phase} ${outcome}`);
  arrive(sim, wu);
  const banner = { completed: 'phase-completed', paused: 'phase-paused' }[outcome];
  const shown = banner ? sim.render([banner, wu, '--phase', phase], { expect: 'content' }) : '';
  if (/^all_done: true$/m.test(EPIC_GATEWAY.formatScoped(wu, EPIC_GATEWAY.discover(sim.dir, wu)))) {
    sim.render(['epic-all-done-gate', wu], { expect: 'content' });
  }
  return shown;
}

// A research or discussion session pauses through the in-flight check: it
// scans the topic's agents, and where any are still running the gate, worded
// for the pause, asks whether to wait for them before the handoff. Answers
// the rows in flight.
/** @param {Sim} sim @param {string} wu @param {'research'|'discussion'} phase @param {string} topic */
function pauseCheck(sim, wu, phase, topic) {
  const running = sim.run(['agent', 'scan', wu, phase, topic]).in_flight;
  if (running.length) {
    assert.match(sim.render(['in-flight-agents-gate', `${wu}.${phase}.${topic}`, '--count', String(running.length), '--pause'], { expect: 'content' }),
      /\*\*`◆ Wait, or pause now\?`\*\*[\s\S]*Wait for results before pausing[\s\S]*Pause now/);
  }
  return running;
}

// A menu's pick into work hands off along the route the menu built for it, as
// it stands.
/** @param {Sim} sim @param {{action: string, topic?: string, route?: string|null}[]} keys @param {string} action @param {string} [topic] */
function pickRoute(sim, keys, action, topic) {
  const key = keys.find((k) => k.action === action && (topic === undefined || k.topic === topic));
  assert.ok(key && key.route, `the menu routes ${action}${topic === undefined ? '' : ` on ${topic}`} into work`);
  return handoff(sim, key.route);
}

/** The epic menu's pick into work. @param {Sim} sim @param {string} wu @param {string} action @param {string} [topic] */
function epicPick(sim, wu, action, topic) {
  return pickRoute(sim, epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys, action, topic);
}

/** The epic menu's entry for a command option. @param {Sim} sim @param {string} wu @param {string} action */
function epicKey(sim, wu, action) {
  const key = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu)).keys.find((k) => k.action === action);
  assert.ok(key, `the epic menu offers ${action}`);
  return key;
}

/** A linear unit's continue menu, its type read from its manifest. @param {Sim} sim @param {string} wu */
function linearMenu(sim, wu) {
  const found = LIB.detail.activeWorkUnit(sim.dir, wu);
  assert.ok(found, `${wu} is a linear unit in progress`);
  return LIB.project.workUnitMenu(found.type, found.unit);
}

// The person's answer at the gate shown, through `gate` as the prose gives
// it: one line of the trust log apiece, the oracle holds. Answers what
// `gate` answered.
/** @param {Sim} sim @param {string} name @param {...string} answer */
function answerGate(sim, name, ...answer) {
  const before = trustLines(sim);
  const answered = sim.run(['gate', name, ...answer]);
  auditGateAnswer(sim, answered, before, `gate ${name} ${answer.join(' ')}`);
  return answered;
}

/** A linear unit's continue menu, picked into work. @param {Sim} sim @param {string} wu @param {string} action */
function linearPick(sim, wu, action) {
  return pickRoute(sim, linearMenu(sim, wu).keys, action);
}

/** The start menu, or the empty state's, as the project stands. @param {Sim} sim */
function startKeys(sim) {
  const result = START_GATEWAY.discover(sim.dir);
  return (result.state.has_any_work ? startMenu(result) : LIB.project.emptyMenu(result)).keys;
}

// A menu's `b/back` (start-menu.md): an internal move, no route — the start
// menu records that the session is working nowhere first, then is re-rendered
// over the state the menu was entered from. Answers the start menu's keys.
/** @param {Sim} sim @param {{action: string, route?: string|null}[]} keys */
function backToStart(sim, keys) {
  const back = keys.find((k) => k.action === 'back');
  assert.ok(back, 'the menu offers its way back to the start menu');
  assert.strictEqual(back.route, null, 'back is a move between menus, never a handoff');
  assert.strictEqual(sim.run(['session', 'repair']).repaired, false, 'the sim has no tmux label to put back');
  assert.strictEqual(carryOn(sim).position, null, 'the start menu is no position');
  return startKeys(sim);
}

// route-to-discovery: new work goes to discovery with its work type's
// pre-seed, no work unit, and its inbox seeds quoted — `none` where it has none.
/** @param {Sim} sim @param {string} workType @param {string} seeds */
function toDiscovery(sim, workType, seeds) {
  return handoff(sim, `/workflow-discovery ${workType} none "${seeds}"`);
}

// The start menu's new-work row builds no route — it goes to discovery with
// the row's pre-seed and no seeds.
/** @param {Sim} sim @param {string} preSeed */
function startNew(sim, preSeed) {
  assert.ok(startKeys(sim).some((k) => k.action === 'start_new' && k.pre_seed === preSeed), `the start menu offers new ${preSeed} work`);
  return toDiscovery(sim, preSeed, 'none');
}

// The working set's w/work (inbox-working-set F): a set of any mix goes to
// discovery, the largest shape in it its pre-seed and the items' inbox paths
// its seeds.
/** @param {Sim} sim @param {string[]} paths */
function workTheSet(sim, paths) {
  const set = LIB.detail.workingSetDetail(sim.dir, paths);
  return toDiscovery(sim, set.set_type, set.items.map((/** @type {{path: string}} */ item) => item.path).join(','));
}

function walkToLiveImplementation(sim, wu, topic) {
  handoffEntry(sim, wu, 'specification', topic);
  sim.run(['topic', 'start', wu, 'specification', topic]);
  sim.run(['topic', 'complete', wu, 'specification', topic]);
  handoffEntry(sim, wu, 'planning', topic);
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);
  sim.run(['topic', 'complete', wu, 'planning', topic]);
  // Implementation is the one phase whose prose never issues `topic start`:
  // task init owns creation (implementation-process Step 0, created arm).
  handoffEntry(sim, wu, 'implementation', topic);
  const init = sim.run(['task', 'init', wu, topic]);
  assert.strictEqual(init.mode, 'created', 'fresh implementation takes the created arm');
}

function walkDeliveryPhasesToImplementation(sim, wu, topic) {
  walkToLiveImplementation(sim, wu, topic);
  sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`, '--topic', `implementation/${topic}`]);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  assert.deepStrictEqual(carryOn(sim).position, { name: wu, phase: 'implementation', topic, task: '1.1' },
    'task start puts the task in flight on the position');
  // Phase boundary: the completion defers its flag, the consolidation pass
  // finds nothing, and the re-record closes the phase (consolidation-pass.md F).
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--next-task', '~']);
  assert.deepStrictEqual(carryOn(sim).position, { name: wu, phase: 'implementation', topic },
    'the task\'s completion takes it off');
  assert.match(sim.render(['step-opening', `${wu}.implementation.${topic}`, '--step', 'consolidation'], { expect: 'content' }),
    /□ Consolidation Pass \(phase 1\)[\s\S]*> Phase 1's tasks are done\./);
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'consolidated_phases', '1']);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--phase-complete']);
  sim.run(['topic', 'complete', wu, 'implementation', topic]);
}

function walkDeliveryPhases(sim, wu, topic, { sources }) {
  // Specification. Its start fetches the source gate before any status read;
  // one already under way resumes, and over no file it initialises as a
  // first start does. Session setup and the completion each read what the
  // specification incorporates — nothing, for a single topic. The source
  // gate holds engine-side: completion refuses while any row is still
  // pending, then clears once every row incorporates.
  bridgeTo(sim, wu, 'specification');
  sim.render(['entry-gate', `${wu}.specification.${topic}`], { expect: 'empty' });
  handoffEntry(sim, wu, 'specification', topic);
  const status = sim.read(['manifest', 'get', `${wu}.specification.${topic}`, 'status']);
  if (status === 'in-progress') {
    sim.render(['phase-note', `${wu}.specification.${topic}`, '--verb', 'Resuming'], { expect: 'content' });
    assert.strictEqual(sim.read(['manifest', 'get', `${wu}.specification.${topic}`, 'reconcile_needed']), '', 'no input moved beneath it');
  } else {
    assert.strictEqual(status, '', 'no specification item — a first start');
  }
  sim.run(['topic', 'start', wu, 'specification', topic]);
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'pending']);
  }
  assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, topic]).incorporations, []);
  sim.refuses(['topic', 'complete', wu, 'specification', topic], /unresolved source rows/);
  for (const s of sources) {
    sim.run(['manifest', 'set', `${wu}.specification.${topic}`, `sources.${s}.status`, 'incorporated']);
  }
  sim.write(`.leeway/${wu}/specification/${topic}/specification.md`, `# Spec — ${topic}\n`);
  sim.run(['commit', wu, '-m', `spec(${wu}): construct`, '--topic', `specification/${topic}`]);
  assert.match(sim.render(['step-opening', `${wu}.specification.${topic}`, '--step', 'conclude'], { expect: 'content' }),
    /□ Conclude[\s\S]*> Wrapping up\. Final assessment, sign-off, and handover to the planning phase\./);
  sim.run(['topic', 'complete', wu, 'specification', topic]);
  assert.deepStrictEqual(sim.run(['topic', 'incorporations', wu, topic]).incorporations, []);

  // Planning. A fresh plan opens on the context offer (initialize-plan A),
  // which the plan's own birth closes — a plan under way reconciles instead.
  bridgeTo(sim, wu, 'planning');
  sim.render(['entry-gate', `${wu}.planning.${topic}`], { expect: 'empty' });
  handoffEntry(sim, wu, 'planning', topic);
  assert.strictEqual(sim.read(['manifest', 'get', `${wu}.planning.${topic}`, 'status']), '', 'no planning item — a first start');
  sim.render(['plan-context-gate', `${wu}.planning.${topic}`], { expect: 'content' });
  sim.run(['topic', 'start', wu, 'planning', topic]);
  sim.refuses(['render', 'plan-context-gate', `${wu}.planning.${topic}`],
    /planning item "[^"]+" is in-progress — the context offer opens a fresh plan/);
  sim.write(`.leeway/${wu}/planning/${topic}/planning.md`, `# Plan — ${topic}\n`);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`,
    'format=local-markdown', 'task_list_gate_mode=gated', 'author_gate_mode=gated',
    'finding_gate_mode=gated', 'review_cycle=0', 'phase=1', 'task=~',
    `task_map.${topic}-1-1=${topic}-1-1`, 'storage_paths=[]']);
  // Plan init records the project default (initialize-plan E); the offer the
  // next plan opens on reads it back rather than being told (initialize-plan C).
  sim.run(['manifest', 'set', 'project.defaults.plan_format', 'local-markdown']);
  sim.render(['plan-format-gate'], { expect: 'content' });
  // Declining that offer opens the catalogue (output-formats.md): which
  // formats a project ships is the planning skill's to name, so the rows ride
  // a payload and the surface numbers them in order.
  const formats = sim.write(`.leeway/.cache/${wu}/planning/${topic}/format-offer.json`, {
    formats: [{ name: 'sample-format', label: 'Sample Format — the row the payload named' }],
  });
  assert.match(sim.render(['plan-format-gate', '--variant', 'select', '--file', formats], { expect: 'content' }),
    /◆ Which output format\?[\s\S]*\*\*`1`\*\* → Sample Format/);

  // The phase structure gate (define-phases B) sits under its tree; a
  // `v/view full` shows the full structure in the tree's place and puts the
  // gate back alone beneath it.
  const phaseTree = sim.write(`.leeway/.cache/${wu}/planning/${topic}/phase-tree.json`,
    { phases: [{ name: 'Foundation', detail: [['Goal', 'the core lands']] }] });
  assert.match(sim.render(['phase-tree', `${wu}.planning.${topic}`, '--file', phaseTree, '--approve'], { expect: 'content' }),
    /=== DISPLAY: phase tree[\s\S]*=== MENU: phase structure gate/);
  const gateAlone = sim.render(['phase-tree', `${wu}.planning.${topic}`, '--menu-only'], { expect: 'content' });
  assert.match(gateAlone, /^=== MENU: phase structure gate/);
  assert.doesNotMatch(gateAlone, /DISPLAY: phase tree/);

  // Approvals and authoring decisions are manifest state, vocabulary-guarded.
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'approvals.structure', '2026-07-23']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'approvals.tasks.p1', '2026-07-23']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'pending']);
  // The gate-mode check over the phase answers empty while gated; each task
  // then shows its detail above its gate.
  sim.render(['author-task-gate', `${wu}.planning.${topic}`, '--phase', '1'], { expect: 'empty' });
  const authorTask = sim.write(`.leeway/.cache/${wu}/planning/${topic}/author-task.json`, { content: '### Task 1: Land the core' });
  assert.match(sim.render(['author-task-gate', `${wu}.planning.${topic}`, '--m', '1', '--total', '1', '--title', 'Land the core', '--file', authorTask], { expect: 'content' }),
    /=== DISPLAY: authored task[\s\S]*=== MENU: author task gate/);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'rejected']);
  // The amendment resets a rejected row to pending only after the rewrite
  // validates (author-tasks C) — the mismatch that never settles stops at its
  // own gate first, beneath the two lists that disagree.
  const counts = sim.write(`.leeway/.cache/${wu}/planning/${topic}/task-count.json`, { table: [`${topic}-1-1`], detail: [] });
  assert.match(sim.render(['task-count-gate', `${wu}.planning.${topic}`, '--file', counts], { expect: 'content' }),
    /Task detail file: {9}0 tasks — none[\s\S]*=== MENU: task count gate/);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'pending']);
  // Under auto the check answers the phase's line instead, and the rows are
  // approved together.
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'author_gate_mode', 'auto']);
  assert.match(sim.render(['author-task-gate', `${wu}.planning.${topic}`, '--phase', '1'], { expect: 'content' }),
    /Phase 1: 1 task authored\. Auto-approved\. Writing to plan\./);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'author_gate_mode', 'gated']);
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'approved']);
  sim.refuses(['manifest', 'set', `${wu}.planning.${topic}`, `staging.author-p1.tasks.${topic}-1-1`, 'maybe'], /Invalid staging task status/);
  // Guarded containers refuse the writes no prose ever makes — wholesale, pushed, or non-canonically spelt.
  sim.refuses(['manifest', 'set', `${wu}.planning.${topic}`, 'staging', '{}'], /guarded state container/);
  sim.refuses(['manifest', 'push', `${wu}.planning.${topic}`, 'staging.author-p1.tasks', 'x'], /guarded state container/);
  sim.refuses(['manifest', 'set', `${wu}.planning`, `items.${topic}.staging.author-p1.tasks.${topic}-1-1`, 'bogus'], /"items" is the topic tree/);
  sim.refuses(['manifest', 'set', wu, `phases.planning.items.${topic}.staging.author-p1.tasks.${topic}-1-1`, 'bogus'], /"phases" is the phase tree/);
  sim.run(['manifest', 'delete', `${wu}.planning.${topic}`, 'staging.author-p1']);
  // The construction's close counts the plan off task_map.
  assert.match(sim.render(['plan-progress', `${wu}.planning.${topic}`, '--variant', 'construction-complete'], { expect: 'content' }),
    /The plan has \*\*1 phase\*\* with \*\*1 task\*\* total\./);

  // The graph approval with the grapher's report beneath it, then the review
  // loop's two gates and the conclusion's consent, each fetched where the
  // flow displays it.
  const graph = sim.write(`.leeway/.cache/${wu}/planning/${topic}/task-graph.json`, {
    notes: 'One task — nothing to order.', dependencies: [], priorities: [],
  });
  assert.match(sim.render(['dependency-approval-gate', `${wu}.planning.${topic}`, '--variant', 'graph', '--file', graph], { expect: 'content' }),
    /I've analyzed all 1 task and the natural execution order is already correct[\s\S]*=== MENU: dependency approval gate/);
  assert.match(sim.render(['dependency-approval-gate', `${wu}.planning.${topic}`, '--variant', 'updated-graph', '--file', graph], { expect: 'content' }),
    /\*\*Dependencies\*\* \(0 relationships\):/);
  // Review opens: the cycle and the plan's word baseline land in one write,
  // the way plan-review stamps them.
  sim.run(['manifest', 'set', `${wu}.planning.${topic}`, 'review_cycle=1', 'review_baseline_words=63929']);
  assert.strictEqual(sim.read(['manifest', 'get', `${wu}.planning.${topic}`, 'review_baseline_words']), '63929',
    'the plan baseline survives as a number the growth diagnostic can read');
  sim.render(['plan-review-gate', `${wu}.planning.${topic}`, '--variant', 'continue'], { expect: 'content' });
  sim.render(['plan-review-gate', `${wu}.planning.${topic}`, '--variant', 'reloop'], { expect: 'content' });
  sim.write('.leeway/.cache/scratch/plan-findings-summary.json', JSON.stringify({
    review_label: 'Traceability Review',
    items: [{ title: 'Missing retry bound', tag: 'missing', summary: 'No task bounds the retries.', status: 'approved' }],
  }));
  sim.render(['findings-summary', `${wu}.planning.${topic}`, '--file', '.leeway/.cache/scratch/plan-findings-summary.json'], { expect: 'content' });
  sim.write('.leeway/.cache/scratch/plan-finding.json', JSON.stringify({
    n: 1, total: 1, title: 'Missing Retry Bound', meta: [['Type', 'Missing from plan']], move: 'settled',
    problem: 'Retries run unbounded.', proposal: 'The specification bounds them at four.',
    diff: { current: [], proposed: ['Retries stop after four attempts.'] },
  }));
  sim.render(['finding', `${wu}.planning.${topic}`, '--file', '.leeway/.cache/scratch/plan-finding.json'], { expect: 'content' });
  // The escalation diagnostic reads the plan's growth the way the spec loop
  // reads the construction's — same surface, the plan named as the document.
  sim.write('.leeway/.cache/scratch/plan-convergence.json', JSON.stringify({
    loop_type: 'planning-review', latest_cycle: 2, trend: 'churning',
    resolved: [{ title: 'Probe reads the wrong descriptor', last_seen_cycle: 1 }],
    recurring: [], new: [{ title: 'Escape byte dispatched as a keystroke' }],
    stream_counts: [{ label: 'traceability', count: 1 }, { label: 'integrity', count: 1 }],
    review_baseline_words: 63929, live_words: 90000,
  }));
  const planDiagnostic = sim.render(['convergence-diagnostic', `${wu}.planning.${topic}`, '--file', '.leeway/.cache/scratch/plan-convergence.json'], { expect: 'content' });
  assert.match(planDiagnostic, /\(\+26071 net across review\)/);
  assert.match(planDiagnostic.replace(/\n\s+/g, ' '), /the review is writing mechanism the specification never decided/,
    'the churn-growth warning reads for the plan');
  assert.match(planDiagnostic.replace(/\n\s+/g, ' '), /Review has added 26071 words to a 63929-word plan/,
    'the growth note names the plan, never a construction');
  // The conclusion asks the wait gate first: a settled specification holds
  // nothing, so the gate is empty and the conclude gate is what renders.
  sim.render(['wait-gate', `${wu}.planning.${topic}`], { expect: 'empty' });
  sim.render(['conclude-gate', `${wu}.planning.${topic}`], { expect: 'content' });

  sim.run(['commit', wu, '-m', `plan(${wu}): author`, '--plan', topic]);
  sim.run(['topic', 'complete', wu, 'planning', topic]);
  assert.match(sim.render(['plan-progress', `${wu}.planning.${topic}`, '--variant', 'concluded'], { expect: 'content' }),
    /Planning is complete for \*\*[^*]+\*\*\.[\s\S]*\*\*1 phase\*\* with \*\*1 task\*\* total/);

  // Implementation — no `topic start` in prose; task init creates. The
  // code-slot read comes first: nothing else in this sim holds implementation
  // or review, so the slot is free and the gate renders empty.
  bridgeTo(sim, wu, 'implementation');
  sim.render(['code-gate', `${wu}.implementation.${topic}`], { expect: 'empty' });
  sim.render(['entry-gate', `${wu}.implementation.${topic}`], { expect: 'empty' });
  handoffEntry(sim, wu, 'implementation', topic);
  assert.strictEqual(sim.read(['manifest', 'get', `${wu}.implementation.${topic}`, 'status']), '', 'no implementation item — a first start');
  const implInit = sim.run(['task', 'init', wu, topic]);
  assert.strictEqual(implInit.mode, 'created', 'fresh implementation takes the created arm');
  sim.run(['commit', wu, '-m', `impl(${wu}): start implementation`, '--topic', `implementation/${topic}`]);
  assert.strictEqual(sim.run(['task', 'start', wu, topic, `${topic}-1-1`]).do_banking, true,
    'the first plan task banks — the deposits below are made while its phase is still open');
  const onTask = carryOn(sim);
  assert.deepStrictEqual(onTask.position, { name: wu, phase: 'implementation', topic, task: '1.1' });
  assert.strictEqual(onTask.skill, path.join(sim.dir, '.claude/skills/workflow-implementation-process/SKILL.md'));
  assert.match(onTask.text, new RegExp(`^The conversation was just compacted\\. This conversation is working in the implementation of .*, on task 1\\.1 \\(internal id \`${topic}-1-1\`\\)\\.`));
  // The executor's dispatch: the gate mod hands the engine its agent id, which
  // rides on the position with the task — through the recovery steps' re-run
  // of `task start` — so the note names the agent the later rounds continue.
  assert.strictEqual(sim.run(['conversation', 'executor', sim.env.CLAUDE_CODE_SESSION_ID, 'aa76bd7f82a2ef3e4']).recorded, true);
  sim.run(['task', 'start', wu, topic, `${topic}-1-1`]);
  const withExecutor = carryOn(sim);
  assert.strictEqual(withExecutor.position.executor, 'aa76bd7f82a2ef3e4', 'the recovery re-run of task start keeps the executor');
  assert.match(withExecutor.text, new RegExp(`, on task 1\\.1 \\(internal id \`${topic}-1-1\`\\), its executor agent \`aa76bd7f82a2ef3e4\`\\.`));
  // The loop's two stops: an executor that comes back blocked or failed
  // (task-loop C), and the analysis loop's checkpoint over files
  // implementation never wrote.
  const sides = sim.write(`.leeway/.cache/${wu}/implementation/${topic}/block-sides.json`, {
    options: ['Restore the order as paid, refund behind it', { summary: 'Keep the cancellation, return the payment', recommended: true }],
  });
  const blockGate = sim.render(['executor-block-gate', `${wu}.implementation.${topic}`, '--result', 'blocked', '--file', sides], { expect: 'content' });
  assert.match(blockGate, /\*\*`1`\*\*\s+→ Keep the cancellation, return the payment \(recommended\)/, 'the recommended side renders first');
  sim.render(['executor-block-gate', `${wu}.implementation.${topic}`, '--result', 'failed'], { expect: 'content' });
  // The task's code commit: declared paths, validated and confined, with the
  // residual dirt answered back so nothing the task touched is left behind.
  // Code has no layout to derive a scope from — this is the one commit whose
  // paths Claude names. The task's code lives in the clone, so its commit
  // lands in the clone's history and the root takes none.
  sim.write(`api/src/${topic}.js`, `module.exports = ${JSON.stringify(topic)};\n`);
  // A framework's routing file names itself with brackets; the code commit
  // takes it literally.
  const routeFile = `routes/[${topic}].js`;
  sim.write(`api/${routeFile}`, '// a file this task did not write\n');
  // The product summary at the task gate (report-register.md) draws on the
  // task's uncommitted change: the clone's untracked files read as
  // additions, named from the project.
  assert.match(sim.read(['code', 'diff']), new RegExp(`^diff --git a/api/src/${topic}\\.js b/api/src/${topic}\\.js$`, 'm'),
    'the product summary reads the clone\'s new file');
  assert.match(sim.render(['task-gate', `${wu}.implementation.${topic}`], { expect: 'content' }), /MENU: task gate/);
  // The task commit's file list (task-loop.md H) and the analysis loop's
  // checkpoint (analysis-loop.md B) read the uncommitted code from every
  // repo, named from the project — each untracked file on its own, never
  // the clone's new folder.
  assert.deepStrictEqual(JSON.parse(sim.read(['code', 'status'])).files,
    [{ path: `api/${routeFile}`, status: '??' }, { path: `api/src/${topic}.js`, status: '??' }],
    'the clone\'s dirt is read from the project, file by file, .leeway/ held out');
  // Where code is dirty the checkpoint gate sorts it: nothing an `impl(…):`
  // commit touched yet, so both files are unexpected and the gate stands.
  assert.match(sim.render(['checkpoint-files-gate', `${wu}.implementation.${topic}`], { expect: 'content' }),
    new RegExp(`implementation_files \\(0\\):\\nunexpected_files \\(2\\):\\n {2}api/routes/\\[${topic}\\]\\.js\\n {2}api/src/${topic}\\.js\\n`
      + `[\\s\\S]*- api/routes/\\[${topic}\\]\\.js \\(untracked\\)\\n- api/src/${topic}\\.js \\(untracked\\)[\\s\\S]*MENU: checkpoint files gate`));
  const rootHead = git(sim.dir, ['rev-parse', 'HEAD']).trim();
  const taskBase = git(sim.api, ['rev-parse', 'HEAD']).trim();
  const codeCommit = sim.run(['commit', '--paths', `api/src/${topic}.js`, '-m', `impl(${wu}): T${topic}-1-1 — the task`,
    '--for', wu, `implementation/${topic}`]);
  assert.deepStrictEqual(codeCommit.committed, [{ repo: 'api', sha: git(sim.api, ['rev-parse', '--short', 'HEAD']).trim() }],
    'the commit lands in the clone that owns the file');
  assert.strictEqual(git(sim.api, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), `src/${topic}.js`);
  assert.strictEqual(git(sim.dir, ['rev-parse', 'HEAD']).trim(), rootHead, 'the root takes no code commit');
  assert.deepStrictEqual(codeCommit.left_dirty, [`api/${routeFile}`],
    'the forgotten path comes back as the reconcile signal, named from the project');
  sim.run(['commit', '--paths', `api/${routeFile}`, '-m', `chore(${topic}): the rest`,
    '--for', wu, `implementation/${topic}`]);
  assert.strictEqual(git(sim.api, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), routeFile);
  // Each executor and reviewer report's BANK entries deposit the moment the
  // report arrives (bank-deposit.md, loaded while `do_banking` is true) —
  // durable on the manifest, emptied at the phase boundary.
  const bankPush = sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'bank',
    `{"task":"${topic}-1-1","source":"executor","summary":"helper duplicated from a sibling task","failure":"a rule change lands in one copy and not the other — the two callers disagree silently","detail":"src/a.js:12 mirrors src/b.js:40","files":["src/a.js","src/b.js"]}`]);
  assert.strictEqual(bankPush.length, 1, 'first bank deposit creates the array');
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'bank',
    `{"task":"${topic}-1-1","source":"reviewer","summary":"dead scaffolding a later task orphaned","failure":"a reader wires the orphaned export into new code and ships a path nothing tests","detail":"src/c.js:8 export unused","files":["src/c.js"]}`]);
  const bank = JSON.parse(sim.read(['manifest', 'get', `${wu}.implementation.${topic}`, 'bank']));
  assert.strictEqual(bank.length, 2, 'bank accumulates entries');
  assert.strictEqual(bank[0].source, 'executor', 'entries store as objects, not strings');
  // Phase boundary: the completion defers its flag, the consolidation pass
  // empties the bank — every entry folded into a finding or dropped by the
  // finder — marks the boundary, and the re-record closes the phase
  // (consolidation-pass.md F). Nothing crosses the boundary.
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--next-task', '~']);
  assert.deepStrictEqual(carryOn(sim).position, { name: wu, phase: 'implementation', topic },
    'the task\'s completion takes it off, its executor with it');
  assert.match(sim.render(['step-opening', `${wu}.implementation.${topic}`, '--step', 'consolidation'], { expect: 'content' }),
    /□ Consolidation Pass \(phase 1\)/, 'the pass opens on the phase in flight');
  // The finder's scope is the phase's task commits (invoke-consolidation-
  // finder.md), and it reads their change: the clone's, named from the
  // project.
  assert.deepStrictEqual(JSON.parse(sim.read(['code', 'log', wu, topic, '--phase', '1'])).files, [`api/src/${topic}.js`],
    'the phase\'s files are the clone\'s, named from the project');
  assert.match(sim.read(['code', 'diff', wu, topic, '--phase', '1']),
    new RegExp(`^diff --git a/api/src/${topic}\\.js b/api/src/${topic}\\.js$`, 'm'));
  assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.${topic}`, 'bank']), 'true',
    'the guard reads the field before the delete — an absent bank refuses the delete');
  sim.run(['manifest', 'delete', `${wu}.implementation.${topic}`, 'bank']);
  sim.run(['manifest', 'push', `${wu}.implementation.${topic}`, 'consolidated_phases', '1']);
  sim.run(['task', 'complete', wu, topic, `${topic}-1-1`, '--phase', '1', '--phase-complete']);
  assert.strictEqual(sim.manifest(wu).phases.implementation.items[topic].current_task, null,
    'a closed phase leaves no task in flight');
  assert.strictEqual('bank' in sim.manifest(wu).phases.implementation.items[topic], false,
    'the boundary leaves no bank behind');
  // Conclude's backstop (conclude-implementation.md) guards the same way: the
  // field is gone, so the delete is never issued — and would refuse if it were.
  assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.implementation.${topic}`, 'bank']), 'false',
    'nothing for the backstop to delete');
  sim.refuses(['manifest', 'delete', `${wu}.implementation.${topic}`, 'bank'], /not found/);
  sim.render(['conclude-gate', `${wu}.implementation.${topic}`], { expect: 'content' });
  sim.run(['topic', 'complete', wu, 'implementation', topic]);

  // Review — verification, then the prepped pipeline: out-of-scope
  // findings bank durably on the manifest, the report is produced from
  // the action list after the do-now apply, the outcome renders through
  // its surfaces — naming the criteria the review could not measure — and
  // the pass completes the phase. The banked set is decided before the
  // gate renders, and the decision deletes the field.
  bridgeTo(sim, wu, 'review');
  sim.render(['code-gate', `${wu}.review.${topic}`], { expect: 'empty' });
  sim.render(['entry-gate', `${wu}.review.${topic}`], { expect: 'empty' });
  handoffEntry(sim, wu, 'review', topic);
  assert.strictEqual(sim.read(['manifest', 'get', `${wu}.review.${topic}`, 'status']), '', 'no review item — a first start');
  sim.run(['topic', 'start', wu, 'review', topic]);
  // The verifiers' scope is read across every repo before any task is
  // recorded reviewed — the task verifiers' files (invoke-task-verifiers.md
  // A): the topic's task commit landed in the clone, so its files are the
  // clone's, named from the project.
  assert.deepStrictEqual(JSON.parse(sim.read(['code', 'log', wu, topic])).files, [`api/src/${topic}.js`]);
  sim.run(['manifest', 'push', `${wu}.review.${topic}`, 'reviewed_tasks', `${topic}-1-1`]);
  sim.render(['resume-gate', `${wu}.review.${topic}`, '--variant', 'review'], { expect: 'content' });
  // The change-set verification reads the declared linter names for its brief
  // (invoke-change-set-verifiers.md B); each verifier it dispatches then reads
  // the commits, bases and change for itself — all of it the clone's.
  sim.read(['manifest', 'get', `${wu}.implementation.${topic}`, 'linters']);
  const taskLog = JSON.parse(sim.read(['code', 'log', wu, topic]));
  assert.deepStrictEqual(taskLog.commits.map((c) => [c.repo, c.subject]), [['api', `impl(${wu}): T${topic}-1-1 — the task`]]);
  assert.deepStrictEqual(taskLog.repos, [{ repo: 'api', base: taskBase }], 'the change set starts at the clone\'s parent of the task commit');
  assert.deepStrictEqual(sim.read(['code', 'diff', wu, topic]).split('\n').filter((l) => l.startsWith('diff --git ')),
    [`diff --git a/api/src/${topic}.js b/api/src/${topic}.js`]);
  // The verifiers write one file per section per cycle beside the per-task
  // reports; prep's checkpoint commit carries both classes under the review
  // topic's scope.
  sim.write(`.leeway/${wu}/review/${topic}/report-1-1.md`, 'TASK: 1-1\n\nFINDINGS:\n- None\n');
  sim.write(`.leeway/${wu}/review/${topic}/change-set-c1-specification.md`, 'SECTION: specification\n\nFINDINGS:\n- None\n');
  // The verifiers leave the tree as they found it: the check reads every
  // repo — a leftover in the clone stops the review until it is gone — and
  // answers empty, the review's own artifacts sitting under .leeway/.
  sim.write(`api/src/${topic}.probe.js`, '// a verifier\'s leftover\n');
  assert.match(sim.render(['change-set-tree', `${wu}.review.${topic}`], { expect: 'content' }),
    new RegExp(`modified or untracked: \`api/src/${topic}\\.probe\\.js\`\\.`));
  fs.rmSync(path.join(sim.api, `src/${topic}.probe.js`));
  sim.render(['change-set-tree', `${wu}.review.${topic}`], { expect: 'empty' });
  // Prep's synthesis writes the action list the rest of the review reads.
  sim.write(`.leeway/.cache/${wu}/review/${topic}/actions.json`, {
    verdict: 'pass',
    actions: [
      { id: 'A1', route: 'do-now', ids: ['1-1-1'], files: [`api/src/${topic}.js`] },
      { id: 'A2', route: 'do-now', ids: ['1-1-2'], files: [`api/src/${topic}.js`] },
      { id: 'A3', route: 'out-of-scope', kind: 'quick-fix', ids: ['9-2-1'] },
    ],
  });
  sim.run(['commit', wu, '-m', `review(${wu}): verification and prep`, '--topic', `review/${topic}`]);
  sim.run(['manifest', 'push', `${wu}.review.${topic}`, 'out_of_scope',
    '{"id":"A3","kind":"quick-fix","summary":"a guard the spec never asked for"}']);
  assert.match(sim.render(['step-opening', `${wu}.review.${topic}`, '--step', 'do-now'], { expect: 'content' }),
    /□ Apply Do-Now[\s\S]*> Applying 2 contained corrections — /);
  // The apply starts from a clean tree (apply-do-now.md B), read from every
  // repo — the review's own artifacts sit under .leeway/, held out.
  assert.deepStrictEqual(JSON.parse(sim.read(['code', 'status'])).files, [], 'nothing uncommitted before the first batch');
  // The apply lane writes code: in-scope, contained findings land in-session
  // as one commit, through the same declared-paths door the task loop uses —
  // beating the review topic, which is the code slot this session holds. The
  // fix verifier reads the applied work, and the commit is confirmed against
  // it (apply-do-now.md C–D): the uncommitted change, the clone's.
  sim.write(`api/src/${topic}.js`, `module.exports = ${JSON.stringify(topic)}; // guarded\n`);
  assert.deepStrictEqual(JSON.parse(sim.read(['code', 'status'])).files, [{ path: `api/src/${topic}.js`, status: ' M' }]);
  assert.match(sim.read(['code', 'diff']), new RegExp(`^\\+module\\.exports = "${topic}"; // guarded$`, 'm'));
  const applied = sim.run(['commit', '--paths', `api/src/${topic}.js`,
    '-m', `review(${wu}): ${topic} cycle 1 — apply do-now findings`, '--for', wu, `review/${topic}`]);
  assert.deepStrictEqual(applied.committed.map((c) => c.repo), ['api'], 'the fixes land where the code lives');
  assert.strictEqual(git(sim.api, ['log', '-1', '--format=%s']).trim(), `review(${wu}): ${topic} cycle 1 — apply do-now findings`);
  assert.deepStrictEqual(applied.left_dirty, [], 'the apply lane names everything it touched');
  // The report reads the apply commit back by its subject.
  assert.match(sim.read(['code', 'diff', '--subject', `review(${wu}): ${topic} cycle 1 — apply do-now findings`]),
    new RegExp(`^\\+module\\.exports = "${topic}"; // guarded$`, 'm'));
  sim.write(`.leeway/${wu}/review/${topic}/report.md`, `# Review — ${topic}\n`);
  sim.run(['commit', wu, '-m', `review(${wu}): complete review`, '--topic', `review/${topic}`]);
  const presentation = sim.write(`.leeway/.cache/${wu}/review/${topic}/presentation.json`, {
    topic,
    verdict: 'pass',
    corrected: { applied: 2, reverted: 0, suite: 'green' },
    out_of_scope: 1,
    discarded: 1,
    not_measured: 2,
  });
  assert.match(sim.render(['review-presentation', `${wu}.review.${topic}`, '--file', presentation], { expect: 'content' }),
    /Not measured: 2 criteria — named in the report\./, 'the presentation discloses what the review could not measure');
  assert.strictEqual(sim.read(['manifest', 'exists', `${wu}.review.${topic}`, 'out_of_scope']), 'true',
    'the banked set is still waiting on the user when the presentation lands');
  sim.run(['manifest', 'delete', `${wu}.review.${topic}`, 'out_of_scope']);
  const gate = sim.render(['review-gate', `${wu}.review.${topic}`, '--verdict', 'pass'], { expect: 'content' });
  assert.match(gate, /\*\*`c\/complete`\*\* → Complete the review and (return to the epic|finish the [a-z-]+)/,
    'the completion names where completing lands for this work type');
  assert.ok(!gate.includes('i/inbox'), 'the out-of-scope decision is never a gate option');
  sim.run(['topic', 'complete', wu, 'review', topic]);
  sim.run(['commit', wu, '-m', `review(${wu}): complete review phase`, '--topic', `review/${topic}`]);
}

// The task writer's calls for one phase (12.5.2–12.5.4): the phase written
// into the tracker, then each task from its file, one call per task, then
// the links between them. A task's `after` names the tasks it waits on, as
// `{phase}.{n}`.
/**
 * @param {Sim} sim @param {string} wu @param {number} phase @param {string} title
 * @param {{title: string, after?: string[]}[]} tasks
 * @returns {string[]} the tasks as created
 */
function writePhaseTasks(sim, wu, phase, title, tasks) {
  sim.run(['task', 'phase', wu, String(phase), '--title', title]);
  const created = tasks.map((task) => {
    const file = sim.write(`.leeway/.cache/${wu}/build/task.md`, [
      `# ${task.title}`, '', '## Type', 'feat', '', '## Problem', `${task.title} is missing.`, '', '## Solution', `Build ${task.title.toLowerCase()}.`, '',
      '## Outcome', `${task.title} works.`, '', '## Acceptance scenarios', `- Given a ledger, when ${task.title.toLowerCase()} runs, then it answers.`, '',
      '## Spec reference', '§1', '',
    ].join('\n'));
    return sim.run(['task', 'create', wu, String(phase), '--file', file]).task;
  });
  tasks.forEach((task, i) => {
    for (const after of task.after ?? []) sim.run(['task', 'link', wu, created[i], '--after', after]);
  });
  return created;
}

/** A string as the regular expression that matches it literally. @param {string} text */
function literal(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

module.exports = {
  Sim, sessionLog, handoffEntry, handoff, answerGate, linearMenu, linearPick, backToStart, startNew, walkDeliveryPhases, arrive, bridgeTo, send, mappedEpic, menuEntry, arriveAtEpicMenu, epicPick, epicKey, literal, sendArgv, presenceRow, carryOn, pauseCheck, startKeys, workTheSet, walkDeliveryPhasesToImplementation, pickRoute, walkToLiveImplementation, writePhaseTasks,
};
