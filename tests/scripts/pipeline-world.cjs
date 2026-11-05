'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's world (tests/README.md §11): the project every
// scenario starts from, made once per process and copied for each, and a
// scenario file's own world built through the verbs once (`worldFrom`); `Sim`,
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
const engine = require(path.join(ROOT, 'skills/leeway-engine/scripts/engine.cjs'));
const schema = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/manifest-schema.cjs'));
const { KNOWLEDGE_DIR } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/knowledge/files.cjs'));
const START_GATEWAY = require(path.join(ROOT, 'skills/leeway/scripts/gateway.cjs'));
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const BRIDGE = require(path.join(ROOT, 'skills/leeway-bridge/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { epicMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { startMenu } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/start.cjs'));
const { skillAt } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/position.cjs'));
const { initRepo, fixtureFrom, cleanupFixture, git, stateGit, withEnv } = require('./engine-harness.cjs');
const { briefPath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/brief-names.cjs'));
const { copyWorld, templateFolder } = require('./discovery-test-utils.cjs');
const { STATE_DIR_NAME, statePath } = require(path.join(ROOT, 'skills/leeway-engine/scripts/kernel/state-root.cjs'));

const { shellWords, auditState, auditGatePayload, auditTrust, trustLines, auditGateAnswer } = require('./pipeline-oracle.cjs');

// The project every scenario starts from, made once per process.
// The topic family's map verbs, which answer their one-line report after
// their JSON (8.8.7).
const MAP_VERBS = Object.freeze(['add', 'add-batch', 'edit', 'rename', 'remove', 'order', 'brief']);
// The raise commands that draw nothing: an answer, a question set aside, the questions waiting.
const RAISE_ANSWERS = Object.freeze(['answer', 'aside', 'waiting']);

const simWorld = fixtureFrom('pipeline-sim-', (dir) => {
  // This checkout's knowledge setup: keyword-only, pinned as setup records
  // it, so the transactions' indexing builds a store as a set-up project's does.
  fs.mkdirSync(statePath(dir, KNOWLEDGE_DIR), { recursive: true });
  fs.writeFileSync(statePath(dir, KNOWLEDGE_DIR, 'config.json'), '{ "knowledge": { "provider": null } }\n');
  // The skills a conversation carries on in after a compaction, installed
  // as a project installs them — kept out of git's sight, so no commit or
  // dirt check ever meets them. Planning has none: its items are scoping's.
  const phases = schema.VALID_PHASES.filter((phase) => phase !== 'planning');
  const skills = [...phases.map((phase) => skillAt('unit', phase)), ...schema.PROJECT_IDENTITIES.map((name) => skillAt(name))];
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
  /** @param {() => string} [world] the project the sim starts from, copied for it: the one every scenario starts from, or a scenario file's own (`worldFrom`) */
  constructor(world = simWorld) {
    // A project with its state worktree at `.leeway/`, which ignores the
    // cache and the checkout's own knowledge directory.
    this.dir = world();
    // The system config directory sits beside the project, as a real one
    // does: the conversation folders the sim's calls mark live there.
    this.configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-config-'));
    this.api = path.join(this.dir, 'api');
    this.step = 0;
    this.conversations = 0;
    // Every handoff a call answered, `engine {args}` by its argv: a flow
    // that holds one conversation asserts none came between.
    /** @type {string[]} */
    this.handoffs = [];
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
      LEEWAY_CONFIG_DIR: this.configDir,
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
  // advisory rides the dump, the view-family pattern; a raise's draw and
  // show — every raise command but its answer, an aside and the questions
  // waiting — whose sections are the screen the raise is drawn as, none
  // where it parks its task or proceeds; and the entry, whose sections are what
  // the phase reads on arrival.
  /** @param {string[]} args */
  static carriesSections([group, verb]) {
    return group === 'presence' || group === 'enter' || (group === 'raise' && !RAISE_ANSWERS.includes(verb)) || (group === 'topic' && MAP_VERBS.includes(verb));
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
      run: (/** @type {string[]} */ args, /** @type {string} */ stdin = '') => this.run(args, identity, stdin),
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

  /**
   * Engine mutation run in another folder of the project — a builder's
   * worktree — audited as `run`'s.
   * @param {string} cwd @param {string[]} args @param {object|null} [identity]
   */
  runIn(cwd, args, identity = null) {
    return this.audited(args, engine.run(args, { cwd, env: this.envOf(identity), stdin: '' }));
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
    if (parsed.next?.kind === 'handoff') this.handoffs.push(`engine ${args.join(' ')}`);
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
    return this.refused(args, pattern, this.engine(args, identity, stdin));
  }

  /** Engine call awaited that must refuse loudly, held as `refuses` holds one. */
  async refusesAsync(args, pattern, identity = null, stdin = '') {
    return this.refused(args, pattern, await this.engineAsync(args, identity, stdin));
  }

  /**
   * A refusal's answer `res` held to exit 1 and clean {ok:false} JSON on
   * stderr matching `pattern`, then the whole state audited untouched: its
   * parsed answer.
   * @param {string[]} args @param {RegExp|null} pattern @param {{code: number, stdout: string, stderr: string}} res
   */
  refused(args, pattern, res) {
    this.step += 1;
    const label = `step ${this.step}: engine ${args.join(' ')} (expected refusal)`;
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

  /**
   * Render surface: must exit 0 (a surface with nothing to show renders
   * empty) — from the project, or from `cwd`, a folder the session opened.
   */
  render(args, { expect, identity = null, cwd = this.dir } = {}) {
    const res = engine.run(['render', ...args], { cwd, env: this.envOf(identity), stdin: '' });
    assert.strictEqual(res.code, 0,
      `[render ${args.join(' ')}] crashed or refused\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    if (expect === 'content') {
      assert.ok(res.stdout.trim().length > 0, `[render ${args.join(' ')}] produced no output`);
    }
    if (expect === 'empty') {
      assert.strictEqual(res.stdout.trim(), '', `[render ${args.join(' ')}] expected a pass (empty render)`);
    }
    auditGatePayload(this, args, identity, cwd);
    return res.stdout;
  }

  manifest(wu) {
    return JSON.parse(fs.readFileSync(path.join(this.dir, '.leeway', wu, 'manifest.json'), 'utf8'));
  }
}

/** Session-log helper — workunit create needs one. */
function sessionLog(sim, wu, n = 1) {
  return sim.write(`.leeway/.cache/${wu}/discovery/session-00${n}.md`,
    `# Discovery Session 00${n}\n\n## Conclusion\n\n(none)\n`);
}

/** Write a message scratch and return the `topic send` argv delivering it from `from`. */
function sendArgv(sim, wu, topic, from, slug = 'a-message') {
  const scratch = sim.write(`.leeway/.cache/scratch/${slug}.md`, `${slug}\n\nBody of ${slug}.\n`);
  return ['topic', 'send', wu, topic, '--from', from, '--content', scratch, '--slug', slug];
}

/** Send one message to a topic from `from`. */
function send(sim, wu, topic, from, slug) {
  return sim.run(sendArgv(sim, wu, topic, from, slug));
}

// A scenario file's own world (tests/README.md §3): built once per process
// through the verbs by `build`, on a sim of its own whose every presence it
// sweeps at the end, so the copies hold nothing a session holds; then
// copied for each sim made from it, `new Sim(world)`.
/** @param {string} prefix the template's temp-directory prefix @param {(sim: Sim) => void} build @returns {() => string} */
function worldFrom(prefix, build) {
  /** @type {string|null} */
  let made = null;
  return () => {
    if (made === null) {
      const sim = new Sim();
      build(sim);
      for (let n = 0; n <= sim.conversations; n += 1) sim.run(['presence', 'cleanup', n === 0 ? 'sim-session' : `sim-session-${n}`]);
      made = copyWorld(sim.dir, templateFolder(`${prefix}template-`));
      sim.destroy();
    }
    return copyWorld(made, fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  };
}

// An epic started at its gate and its map of the named topics, each with its
// brief, approved at its own. The yes hands off to the epic's menu, and the
// conversation the gate mod clears for it ends, SessionEnd sweeping the
// presence its discovery held.
/** @param {Sim} sim @param {string} wu @param {string[]} names */
function mappedEpic(sim, wu, names) {
  startUnit(sim, 'epic', wu, 'An epic of its own');
  const { next } = approveTheMap(sim, wu, { topics: names.map((name) => ({ name, summary: name, brief: briefDraft(sim, wu, name) })) });
  handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
  sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
  sim.handOver();
}

/** Topics landed on an epic's map in one batch, each with a brief drafted for it. @param {Sim} sim @param {string} wu @param {{name: string}[]} topics */
function mapTopics(sim, wu, topics) {
  return sim.run(['topic', 'add-batch', wu, '--file', sim.write(`.leeway/.cache/${wu}/discovery/topics.json`,
    topics.map((topic) => ({ ...topic, brief: briefDraft(sim, wu, topic.name) })))]);
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

// Every place labels itself on arrival: a navigation skill, the bridge and
// the roadmap label the place alone (`arrive`), and every
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
    assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', `leeway-${name}`, 'SKILL.md'), `the ${name} carries on in its own skill`);
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

// A move into a phase that enters through `enter`: handed off as above, the
// phase skill's first engine call is its entry — starting the topic where
// unstarted, recording the place, and answering what to read in its sections
// (`sim.sections`) — so a compaction there carries on in the phase's skill,
// re-reading the topic's record.
function enterEntry(sim, wu, phase, topic) {
  sim.handOver();
  const res = sim.run(['enter', phase, wu, topic]);
  assert.strictEqual(res.entered, true, `no other session holds the topic, so the entry asks nothing (${phase})`);
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name: wu, phase, topic }, `the entry records its place (${phase})`);
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', /** @type {string} */ (skillAt(wu, phase)), 'SKILL.md'),
    `a compaction there carries on in the phase's skill (${phase})`);
  assert.ok(here.text.includes(`ledger record ${wu} ${topic}\``), `a compaction there re-reads the topic's record (${phase})`);
  return res;
}

// The spec's entry, at the work unit: handed off as above, the spec skill's
// first engine call is its entry, which starts nothing and records the unit
// as its place, so a compaction there carries on in the spec's skill,
// re-reading each live topic's record.
/** @param {Sim} sim @param {string} wu @param {string[]} topics the unit's live topics */
function specEntry(sim, wu, topics) {
  sim.handOver();
  const res = sim.run(['enter', 'specification', wu]);
  assert.strictEqual(res.entered, true, 'no other session holds the spec, so the entry asks nothing');
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name: wu, phase: 'specification', topic: wu }, 'the entry records the unit as its place');
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', /** @type {string} */ (skillAt(wu, 'specification')), 'SKILL.md'),
    'a compaction there carries on in the spec\'s skill');
  for (const topic of topics) assert.ok(here.text.includes(`ledger record ${wu} ${topic}\``), `a compaction there re-reads ${topic}'s record`);
  return res;
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
  const carried = engine.run(argv, { cwd: sim.dir, env: { ...sim.env, LEEWAY_HANDOFF: '1' } });
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

// An epic phase's conclusion or in-session exit hands off to the epic menu,
// which labels the work unit and leads with the banner for what just
// concluded — none after a cancel or a postpone, whose receipt was the
// session's. Answers the banner rendered, empty when none is.
/** @param {Sim} sim @param {string} wu @param {string} phase @param {string} [outcome] @returns {string} */
function arriveAtEpicMenu(sim, wu, phase, outcome = 'completed') {
  handoff(sim, `/leeway-continue-epic ${wu} ${phase} ${outcome}`);
  arrive(sim, wu);
  return outcome === 'completed' ? sim.render(['phase-completed', wu, '--phase', phase], { expect: 'content' }) : '';
}

// A discussion leaving its topic — a pause, a postpone, a cancel or a
// spawn — fetches the wait for its agents: empty where none runs, else the
// gate asking whether to wait for them first. Answers what it drew.
/** @param {Sim} sim @param {string} wu @param {string} topic @param {boolean} [running] */
function waitAgents(sim, wu, topic, running = false) {
  const drawn = sim.render(['wait-agents', `${wu}.${topic}`], { expect: running ? 'content' : 'empty' });
  if (running) assert.match(drawn, /^=== MENU: wait for agents /m);
  return drawn;
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

// The epic menu's build row picked as epic-display-and-menu.md picks it
// (18.4.6): the menu reached and its row recommended, and the row's route
// handed off into the build or its review phase, whose skill starts in a fresh conversation. Answers the row.
/** @param {Sim} sim @param {string} wu @param {'enter_implementation'|'enter_review'} action */
function epicBuildPick(sim, wu, action) {
  menuEntry(sim, wu);
  const { keys } = epicMenu(wu, EPIC_GATEWAY.discover(sim.dir, wu));
  const row = keys.find((k) => k.action === action);
  assert.ok(row?.recommended, `the menu recommends ${action}`);
  pickRoute(sim, keys, action, wu);
  sim.handOver();
  return row;
}

// A linear unit built by its cut continued from its menu (24.1.6): its
// continue routes into the build, or into its review phase once every phase
// of its cut has closed, and hands off there.
/** @param {Sim} sim @param {string} wu @param {'implementation'|'review'} phase */
function linearBuildPick(sim, wu, phase) {
  menuEntry(sim, wu);
  const { keys } = linearMenu(sim, wu);
  assert.strictEqual(keys.find((k) => k.action === 'continue')?.route, `/${skillAt(wu, phase)} ${sim.manifest(wu).work_type} ${wu}`,
    `the menu continues the unit into its ${phase}`);
  pickRoute(sim, keys, 'continue');
  sim.handOver();
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

/** The gates the person answered, in order, as the trust log has them. @param {Sim} sim @returns {string[]} */
const gatesAnswered = (sim) => trustLines(sim).map((line) => JSON.parse(line)).filter(({ type }) => type === 'gate').map(({ gate }) => gate);

/** Claude's items of the decided checklist; the engine works out the rest. */
const DECIDED_ITEMS = Object.freeze(['closing-pass', 'decisions-entered', 'replacements-checked', 'conflicts-read', 'findings-rerun', 'product-lines-shown']);

/**
 * A discussion closed as the prose closes it (9.7): the map drawn, no agent
 * left to wait for, the decided checklist worked and closed, Claude's
 * payload staged on the decided screen, and the person's yes at its gate
 * run — a feature's topic closing into its spec with no gate, its payload
 * staged for ready to build's screen (11.2.1). Answers what the yes, or a
 * feature's stage, answered.
 * @param {Sim} sim @param {string} wu @param {string} topic
 * @param {{lines: object[], candidates: object[]}} [payload]
 */
function decideTopic(sim, wu, topic, payload = { lines: [], candidates: [] }) {
  assert.match(sim.render(['map', `${wu}.${topic}`], { expect: 'content' }), /^=== DISPLAY: map /m);
  waitAgents(sim, wu, topic);
  for (const item of DECIDED_ITEMS) sim.run(['checklist', 'done', 'decided', wu, topic, item]);
  sim.run(['checklist', 'close', 'decided', wu, topic]);
  const file = sim.write(`.leeway/.cache/scratch/decided-${topic}.json`, payload);
  if (sim.manifest(wu).work_type === 'feature') return sim.run(['decided', 'stage', wu, topic, '--file', file]);
  assert.match(sim.render(['decided', `${wu}.${topic}`, '--file', file], { expect: 'content' }), /^=== MENU: decided /m);
  const { next } = answerGate(sim, 'decided', '--pick', 'y');
  return sim.run(next.argv);
}

/**
 * A discussion worked from its entry to its close as the prose works it
 * (9.3, 9.7): the entry; the reads — every other decided topic's record and
 * the product record; each waiting message raised as a question and answered
 * off the mailbox; the opening question asked and the person's answer
 * decided, the log written; then the close — an epic's topic's through its
 * decided gate's yes, a feature's staged into its spec. Answers what the yes,
 * or the stage, answered.
 * @param {Sim} sim @param {string} wu @param {string} topic
 * @param {{question?: string, answer?: string, payload?: {lines: object[], candidates: object[]}}} [opts]
 */
function discussed(sim, wu, topic, { question = `What does ${topic} settle?`, answer = 'This.', payload } = {}) {
  enterEntry(sim, wu, 'discussion', topic);
  const items = sim.manifest(wu).phases?.discussion?.items ?? {};
  for (const [name, item] of Object.entries(items)) {
    if (name !== topic && item.status === 'completed') sim.read(['ledger', 'record', wu, name]);
  }
  sim.read(['ledger', 'product', wu, topic]);
  const at = `${wu}.discussion.${topic}`;
  const person = { by: 'person', who_moved_whom: 'none' };
  for (const file of JSON.parse(sim.read(['topic', 'mailbox', wu, topic])).files) {
    const message = path.basename(file, '.md');
    const raised = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: `What does ${message} ask?` })).id;
    sim.run(['topic', 'answered', wu, topic, message, '--entry', raised]);
    sim.run(['ledger', 'decide', at, '--answers', raised], null, JSON.stringify({ ...person, text: 'Answered.', why: 'The message said so.' }));
  }
  const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ ...person, text: question })).id;
  sim.run(['ledger', 'decide', at, '--answers', asked], null, JSON.stringify({ ...person, text: answer, why: 'The person said so.' }));
  const log = `.leeway/${wu}/topics/${topic}/log.md`;
  if (!fs.existsSync(path.join(sim.dir, log))) sim.write(log, `# ${topic}\n\n${question} ${answer}\n`);
  return decideTopic(sim, wu, topic, payload);
}

/**
 * A question Claude asks on the topic's discussion map, as a spawn measures
 * one: its short id. @param {Sim} sim @param {string} wu @param {string} topic @param {string} text
 */
function askedOn(sim, wu, topic, text) {
  return sim.run(['ledger', 'ask', `${wu}.discussion.${topic}`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text })).id;
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
// pre-seed, or `start` where it has none, no work unit, and its inbox seeds
// quoted — `none` where it has none.
/** @param {Sim} sim @param {string} workType @param {string} seeds */
function toDiscovery(sim, workType, seeds) {
  return handoff(sim, `/leeway-discovery ${workType === 'none' ? 'start' : workType} none "${seeds}"`);
}

// A handoff into `discovery none` landing: the product's conversation
// entered, as discovery's skill enters it, and its log written with the
// section the work's talk shaped. Answers the section, state-relative, as
// start this work points at it.
/** @param {Sim} sim @param {string} section */
function shapedInTheProduct(sim, section) {
  sim.handOver();
  sim.run(['enter', 'discovery', 'product']);
  const log = /** @type {string} */ (sim.sections.match(/^log: (.*)$/m)?.[1]);
  fs.appendFileSync(log, `\n## ${section} {#${section}}\n\nWhat the talk shaped.\n`);
  return `${path.relative(statePath(sim.dir), log)}#${section}`;
}

// Claude's draft of a topic's brief, in the cache.
/** @param {Sim} sim @param {string} wu @param {string} topic */
function briefDraft(sim, wu, topic) {
  return sim.write(`${STATE_DIR_NAME}/.cache/${wu}/briefs/${topic}.md`, `# ${topic}\n\nWhat discovery heard.\n`);
}

// One of discovery's authority gates as the prose works it (8.8.1, 8.8.3):
// Claude's payload staged on its screen, the person's yes at its gate, and
// what the yes leads to run. Answers the yes's answer.
/** @param {Sim} sim @param {string} gate @param {string[]} screen @param {object} given */
function atTheGate(sim, gate, screen, given) {
  const file = sim.write(`${STATE_DIR_NAME}/.cache/scratch/${screen[0]}.json`, given);
  sim.render([...screen, '--file', file], { expect: 'content' });
  const { next } = answerGate(sim, gate, '--pick', 'y');
  return sim.run(next.argv);
}

/** Start this work at its gate. @param {Sim} sim @param {object} given */
function startThisWork(sim, given) {
  return atTheGate(sim, 'start this work', ['start-this-work'], given);
}

/** Approve the map at its gate. @param {Sim} sim @param {string} wu @param {object} given */
function approveTheMap(sim, wu, given) {
  return atTheGate(sim, 'approve the map', ['approve-map', wu], given);
}

// A unit started as discovery starts one (8.8.1): shaped in the product's
// conversation, then started at start this work's gate — a feature or a
// bugfix with its one topic's brief — and an epic carried on into its own
// discovery. Answers the yes's answer.
/** @param {Sim} sim @param {string} type @param {string} wu @param {string} description */
function startUnit(sim, type, wu, description) {
  const started = startThisWork(sim, {
    type, name: wu, description, reason: `It is ${type} work.`,
    shaped_by: [shapedInTheProduct(sim, wu)],
    ...(['feature', 'bugfix'].includes(type) ? { brief: briefDraft(sim, wu, wu) } : {}),
  });
  if (type === 'epic') sim.run(started.next.argv);
  return started;
}

// The start menu's new-work row builds no route — it goes to discovery with
// the row's pre-seed and no seeds.
/** @param {Sim} sim @param {string} preSeed */
function startNew(sim, preSeed) {
  assert.ok(startKeys(sim).some((k) => k.action === 'start_new' && k.pre_seed === preSeed), `the start menu offers new ${preSeed} work`);
  return toDiscovery(sim, preSeed, 'none');
}

// The roadmap's pull (pull.md): the picked items handed to discovery as its
// seeds, their kinds giving the pre-seed — `start` where any is an idea.
/** @param {Sim} sim @param {string[]} items */
function pullFromRoadmap(sim, items) {
  const { items: rows } = LIB.roadmap.roadmapState(sim.dir);
  const kinds = items.map((name) => rows.find((/** @type {{name: string}} */ row) => row.name === name).kind);
  const wayIn = kinds.includes('idea') ? 'start' : (kinds.includes('bug') ? 'bugfix' : 'quick-fix');
  return handoff(sim, `/leeway-discovery ${wayIn} none "${items.map((name) => `roadmap:${name}`).join(',')}"`);
}

// The working set's w/work (inbox-working-set F): a set of any mix goes to
// discovery, the largest shape in it its pre-seed and the items' inbox paths
// its seeds.
/** @param {Sim} sim @param {string[]} paths */
function workTheSet(sim, paths) {
  const set = LIB.detail.workingSetDetail(sim.dir, paths);
  return toDiscovery(sim, set.set_type, set.items.map((/** @type {{path: string}} */ item) => item.path).join(','));
}

// The spec's corridor as the skill runs it (11.3–11.8): entered at the unit,
// written from the writer's brief citing a decision of each live topic,
// landed, reviewed and cut, and ready to build's pick beginning the build in
// the position picked and handing off into the build — no construction,
// finding, re-loop or sign-off gate on the way (11.8.4). Answers what the
// pick ran.
/** @param {Sim} sim @param {string} wu @param {string[]} topics @param {'s'|'a'} [position] */
function specToBuild(sim, wu, topics, position = 's') {
  specEntry(sim, wu, topics);
  sim.run(['brief', 'spec-writer', wu]);
  const statements = topics.map((topic, i) => {
    const [decision] = JSON.parse(sim.read(['ledger', 'record', wu, topic])).decisions;
    return `1.1.${i + 1} ${topic} holds as decided. [${decision.id}]`;
  });
  sim.write(`.leeway/${wu}/spec.md`, [
    `# ${wu}`, '', '## 1. The work', '', '### 1.1 As decided', '', ...statements.flatMap((s) => [s, '']),
    '## 1-S. Scenarios for §1', '', '1.S1 Given the work, when it runs, then it holds as decided. (1.1.1)', '',
  ].join('\n'));
  assert.deepStrictEqual(sim.run(['spec', 'land', wu]).invented, []);
  specReviewed(sim, wu);
  cutTheSpec(sim, wu, [{ name: 'The work', goal: 'The work holds as decided.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }]);
  const rows = readyToBuild(sim, wu).split('\n').flatMap((line) => {
    const row = line.match(/^\*\*`(\w+\/\w+)`\*\* +→ (.+?)(?: —|$)/);
    return row ? [`${row[1]} ${row[2]}`] : [];
  });
  assert.deepStrictEqual(rows, ['a/auto Auto', 's/step Step'], 'ready to build is the one gate: its rows are the position alone');
  return intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', position).next.argv));
}

// Ready to build's yes `begun` followed: its `next` hands off into the
// build, whatever the unit's type (24.1.2), and the conversation the gate
// mod clears for it ends, SessionEnd sweeping the presence the spec held.
// Answers the yes.
/** @param {Sim} sim @param {string} wu @param {Record<string, any>} begun */
function intoTheBuild(sim, wu, begun) {
  const route = `/leeway-implementation-process ${sim.manifest(wu).work_type} ${wu}`;
  assert.strictEqual([`/${begun.next.skill}`, ...begun.next.args].join(' '), route, 'the yes hands off into the build');
  handoff(sim, route);
  sim.run(['presence', 'cleanup', sim.env.CLAUDE_CODE_SESSION_ID]);
  sim.handOver();
  return begun;
}

// The review of the spec's last land (11.7), as writing-and-review.md runs
// it: a pass dispatched and briefed, its report written where the dispatch
// said — clean, or holding `findings`, each by its lane, a gap or a fact
// the record already answers declined — taken in by the scan and
// acknowledged with every finding it holds (`passTakenIn`); each finding but
// a rewrite or one declined surfaced — a gap asked as a question with the
// question it was asked as — and the pass incorporated, whatever closed it
// first (`passSurfaced`). A gap asked is asked between the two, as the
// prose asks it: on the ledger, then raised.
/**
 * @param {Sim} sim @param {string} wu @param {{lane: 'rewrite'|'gap'|'fact', declined?: boolean}[]} findings
 * @returns {{id: string, file: string}} the pass
 */
function passTakenIn(sim, wu, findings) {
  const pass = sim.run(['agent', 'dispatch', wu, 'specification', wu, '--kind', 'spec-review']);
  sim.run(['brief', 'spec-reviewer', wu, '--agent', pass.id]);
  const body = findings.length === 0 ? 'None identified.' : findings.map(({ lane }, at) => `### F${at + 1}: a ${lane} finding\n\n**Lane:** ${lane}\n\nWhat the pass found.`).join('\n\n');
  fs.writeFileSync(pass.file, `# Spec Review — ${pass.id}\n\n## Findings\n\n${body}\n`);
  sim.run(['agent', 'scan', wu, 'specification', wu]);
  const ids = findings.map((_, at) => `F${at + 1}`);
  sim.run(['agent', 'ack', wu, 'specification', wu, pass.id, ...(ids.length === 0 ? ['--clean'] : ['--findings', ids.join(',')])]);
  return pass;
}

/**
 * @param {Sim} sim @param {string} wu @param {{id: string}} pass @param {{lane: 'rewrite'|'gap'|'fact', declined?: boolean}[]} findings
 * @param {Record<number, string>} [asked] the question each gap was asked as, by its finding's place
 */
function passSurfaced(sim, wu, pass, findings, asked = {}) {
  for (const [at, { lane, declined }] of findings.entries()) {
    if (lane === 'rewrite' || declined) continue;
    sim.run(['agent', 'surface', wu, 'specification', wu, pass.id, `F${at + 1}`, ...(asked[at] === undefined ? [] : ['--question', asked[at]])]);
  }
  sim.run(['agent', 'incorporate', wu, 'specification', wu, pass.id]);
}

/**
 * A pass taken in and surfaced, with no gap asked.
 * @param {Sim} sim @param {string} wu @param {{lane: 'rewrite'|'gap'|'fact', declined?: boolean}[]} [findings]
 * @returns {{id: string, file: string}} the pass
 */
function specReviewed(sim, wu, findings = []) {
  const pass = passTakenIn(sim, wu, findings);
  passSurfaced(sim, wu, pass, findings);
  return pass;
}

// The cut's corridor (11.5.1): the phase cut's agent briefed from the unit's
// spec, its cut staged where the brief says it goes, and `cut` taking it, as
// the skill runs it, naming no file.
/**
 * @param {Sim} sim @param {string} wu
 * @param {{name: string, goal: string, scenarios: string[], sections: string[], relies_on: Array<number|string>}[]} phases
 * @returns {Record<string, any>} the cut's answer
 */
function cutTheSpec(sim, wu, phases) {
  assert.strictEqual(sim.run(['brief', 'phase-cut', wu]).agent, 'leeway-phase-cut');
  sim.write(`.leeway/.cache/${wu}/specification/cut.json`, { phases });
  return sim.run(['cut', wu]);
}

// Ready to build as the prose reaches it (11.8): its checklist worked —
// Claude's items marked done, the engine's holding — and closed, then the
// screen fetched, `flags` given. Answers what it drew.
/** @param {Sim} sim @param {string} wu @param {string[]} [flags] */
function readyToBuild(sim, wu, flags = []) {
  for (const { key, by, state } of JSON.parse(sim.read(['checklist', 'show', 'ready-to-build', wu])).items) {
    if (by === 'claude' && state === 'open') sim.run(['checklist', 'done', 'ready-to-build', wu, key]);
  }
  sim.run(['checklist', 'close', 'ready-to-build', wu]);
  return sim.render(['ready-to-build', wu, ...flags], { expect: 'content' });
}

// The build's entry, at the work unit: once ready to build's yes carries the
// conversation on, the build's first engine call is its entry, which starts
// nothing and records the unit as its place, answering where the build
// stands and what to read beside the ledger — the build's log among it; a
// compaction there carries on in the build's skill, re-reading the same
// (12.1.6, 24.2.2). Answers the entry's DATA lines.
/** @param {Sim} sim @param {string} wu @returns {string[]} */
function buildEntry(sim, wu) {
  const res = sim.run(['enter', 'implementation', wu]);
  assert.strictEqual(res.entered, true, 'no other session holds the code, so the entry asks nothing');
  const lines = sim.sections.split('\n').filter((line) => /^[a-z ]+: /.test(line));
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name: wu, phase: 'implementation', topic: wu }, 'the entry records the unit as its place');
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills', /** @type {string} */ (skillAt(wu, 'implementation')), 'SKILL.md'),
    'a compaction there carries on in the build\'s skill');
  for (const call of [`ledger affected ${wu}`, `ledger record ${wu}`]) assert.ok(here.text.includes(`${call}\``), `a compaction there re-reads ${call}`);
  assert.ok(lines.filter((line) => line.startsWith('phase: ')).every((line) => here.text.includes(line)), 'a compaction there says where each phase stands, as the entry does');
  return lines;
}

// A phase's start (6.4.8): its checklist shown, Claude's items marked done,
// the engine's holding, and closed.
/** @param {Sim} sim @param {string} wu @param {number} phase */
function startPhase(sim, wu, phase) {
  for (const { key, by, state } of JSON.parse(sim.read(['checklist', 'show', 'phase-start', wu, String(phase)])).items) {
    if (by === 'claude' && state === 'open') sim.run(['checklist', 'done', 'phase-start', wu, String(phase), key]);
  }
  sim.run(['checklist', 'close', 'phase-start', wu, String(phase)]);
}

// The task writer's calls for one phase (12.5.2–12.5.4): the phase written
// into the tracker, then each task from its file, one call per task, then
// the links between them. A task's `after` names the tasks it waits on, as
// `{phase}.{n}`; its `scenarios`, the phase's scenarios it takes from the
// cut (12.4.3), else a scenario of its own; its `type` and `reference`, a
// review's fix task's `fix` and the finding's area, else `feat` and §1.
/**
 * @param {Sim} sim @param {string} wu @param {number} phase @param {string} title
 * @param {{title: string, after?: string[], scenarios?: string[], type?: string, reference?: string}[]} tasks
 * @returns {string[]} the tasks as created
 */
function writePhaseTasks(sim, wu, phase, title, tasks) {
  sim.run(['task', 'phase', wu, String(phase), '--title', title]);
  return writeTasks(sim, wu, phase, tasks);
}

// A written phase's tasks as the task writer records them, as
// `writePhaseTasks` records them once the phase is written.
/**
 * @param {Sim} sim @param {string} wu @param {number} phase
 * @param {{title: string, after?: string[], scenarios?: string[]}[]} tasks
 * @returns {string[]} the tasks as created
 */
function writeTasks(sim, wu, phase, tasks) {
  const created = tasks.map((task) => {
    const scenarios = task.scenarios ?? [`Given a ledger, when ${task.title.toLowerCase()} runs, then it answers.`];
    const file = sim.write(`.leeway/.cache/${wu}/build/task.md`, [
      `# ${task.title}`, '', '## Type', task.type ?? 'feat', '', '## Problem', `${task.title} is missing.`, '', '## Solution', `Build ${task.title.toLowerCase()}.`, '',
      '## Outcome', `${task.title} works.`, '', '## Acceptance scenarios', ...scenarios.map((scenario) => `- ${scenario}`), '',
      '## Spec reference', task.reference ?? '§1', '',
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

/** A brief as the conversation stored it. @param {Sim} sim @param {{id: string}} res */
const briefOf = (sim, res) => withEnv({ LEEWAY_CONFIG_DIR: sim.configDir }, () => fs.readFileSync(briefPath(sim.env.CLAUDE_CODE_SESSION_ID, res.id), 'utf8'));

/** The engine calls a reader's brief names to lay out its scratch worktree and take it apart, each by its argv. @param {string} brief */
function scratchCalls(brief) {
  const calls = [...brief.matchAll(/^node (\S+) (scratch .*)$/gm)];
  assert.ok(calls.every(([, engine]) => path.isAbsolute(engine)), 'the brief runs the engine by its absolute path');
  return calls.map(([, , call]) => call.split(' '));
}

// A reader that lays out its scratch worktree by its brief's first call and
// dies, never taking it apart: the project's folder there.
/** @param {Sim} sim @param {{id: string}} res its brief */
const deadReader = (sim, res) => sim.run(scratchCalls(briefOf(sim, res))[0]).path;

// Another reader's layout, `name`, laid out beside it at the commits the
// brief `res` lays its own at: the project's folder there.
/** @param {Sim} sim @param {{id: string}} res @param {string} name */
const laidBeside = (sim, res, name) => sim.run(['scratch', 'lay', name, ...scratchCalls(briefOf(sim, res))[0].slice(3)]).path;

/** The file a brief names under its heading `heading`. @param {Sim} sim @param {{id: string}} res @param {string} heading */
function placeIn(sim, res, heading) {
  const brief = briefOf(sim, res);
  return /`([^`]+)`/.exec(brief.slice(brief.indexOf(`# ${heading}\n`)))?.[1] ?? '';
}

/** A file written as a build agent writes it: a `.txt` beside it, renamed to it. @param {string} file @param {string} text */
function landed(file, text) {
  const staged = `${file.slice(0, -'.md'.length)}.txt`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(staged, text);
  fs.renameSync(staged, file);
}

/** A reviewer's report that passes, as the agent writes it. */
const PASSED_REPORT = '## Findings\n\nNone.\n\nVerdict: pass\n';

/** The verify setup the first task's builder builds: its files, by path. */
const VERIFY_FILES = Object.freeze({
  'verify/features.md': '# Features\n',
  'verify/drive.sh': '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n',
});

// A worktree a builder's isolation makes, under a folder of its own; and
// that folder removed.
const builders = {
  /** @param {string} name */
  make: (name) => path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-builders-'))), name),
  /** @param {Sim} sim @param {string} tree */
  remove: (sim, tree) => {
    git(sim.dir, ['worktree', 'remove', '--force', tree]);
    fs.rmSync(path.dirname(tree), { recursive: true, force: true });
  },
};

// A task built as the build's loop builds it in the worktree at `tree`
// (12.7): started, its builder's worktree made by its isolation at the
// default branch and the task laid out there, its files committed there,
// the verify setup recorded and its scenario run where `setup` says so, its
// builder banking `note` for later where one is given (12.10.2), its pair
// passing it from where it was laid out, its account written once its
// builder's brief again says it landed, and taken, `accounted` run there
// where given, its step gate drawn and the person's yes given there where
// `gated` says so (12.7.9), chained into its phase's stack — the chain's
// `next`, the phase's mutation run once its last task chains — and done.
// Answers the note's number, null where none was banked.
/**
 * @param {Sim} sim @param {string} wu @param {string} task @param {string} tree
 * @param {Record<string, string>} files @param {boolean} setup @param {{gated?: boolean, note?: string, accounted?: () => void}} [opts]
 * @returns {number|null}
 */
function taskBuilt(sim, wu, task, tree, files, setup, { gated = false, note, accounted } = {}) {
  sim.run(['task', 'start', wu, task]);
  const builder = sim.run(['brief', 'builder', wu, task]);
  git(sim.dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${task}`, tree, 'main']);
  sim.runIn(tree, ['task', 'worktree', wu, task]);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    fs.writeFileSync(path.join(tree, file), text, { mode: 0o755 });
  }
  sim.runIn(tree, ['commit', '--paths', ...Object.keys(files), '--task', wu, task, '-m', `feat(${wu}): task ${task}`]);
  if (setup) {
    const at = placeIn(sim, builder, 'Where the verify setup goes');
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, JSON.stringify(VERIFY_SETUP));
    sim.runIn(tree, ['verify', 'setup', wu, '--file', at, '--scenario', '1.S1']);
    sim.runIn(tree, ['verify', 'run', wu, '1.S1']);
  }
  const banked = note === undefined ? null : sim.run(['task', 'note', wu, '--file', sim.write(`.leeway/.cache/${wu}/build/note.md`, `${note}\n`)]).number;
  for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', wu, task, '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
  const back = sim.run(['brief', 'builder', wu, task]);
  assert.match(briefOf(sim, back), /Your reviewers passed the task in round 1: it has landed, so write its account now\./);
  landed(placeIn(sim, back, 'Where your account goes'), [
    '## What was done', 'Built.', '## Where in the code', ...Object.keys(files).map((file) => `- ${file}`), '## What the tests prove', '- 1.S1, run through verify.',
    '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
  ].join('\n\n'));
  sim.run(['task', 'account', wu, task]);
  accounted?.();
  if (gated) {
    sim.render(['step-gate', wu, task], { expect: 'content' });
    answerGate(sim, 'step gate', '--pick', 'y');
  }
  sim.run(['land', 'open', wu, task]);
  const { next } = sim.run(['land', 'chain', wu, task]);
  sim.run(['task', 'done', wu, task]);
  if (next !== undefined) sim.run(next.argv);
  return banked;
}

// A unit's first phase, entered once ready to build's yes began its build,
// built as the loop builds it: written as `title`, its one task `task`
// building the verify setup and `file` and proving 1.S1, then its review
// passing, its stack merged and its close.
/** @param {Sim} sim @param {string} wu @param {string} title @param {string} task @param {string} file */
function firstPhaseBuilt(sim, wu, title, task, file) {
  buildEntry(sim, wu);
  writePhaseTasks(sim, wu, 1, title, [{ title: task, scenarios: ['1.S1'] }]);
  startPhase(sim, wu, 1);
  const tree = builders.make('agent-1');
  taskBuilt(sim, wu, '1.1', tree, { ...VERIFY_FILES, [file]: `export const ${path.basename(file, '.js')} = 1;\n` }, true);
  builders.remove(sim, tree);
  for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', wu, '1', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
  sim.run(['land', 'phase', wu, '1']);
  sim.run(['checklist', 'close', 'phase-close', wu, '1']);
}

// The build the review phase reviews: a feature through its spec to ready
// to build's pick, continued from its menu into the build, its cut's one
// phase — the verify setup and the code — built, reviewed, merged and
// closed, and continued from its menu into its review phase.
/** @param {Sim} sim @param {string} wu */
function cutClosed(sim, wu) {
  startUnit(sim, 'feature', wu, 'A ledger');
  discussed(sim, wu, wu);
  specToBuild(sim, wu, [wu], 'a');
  linearBuildPick(sim, wu, 'implementation');
  firstPhaseBuilt(sim, wu, 'The work', 'Write the ledger', 'src/ledger.js');
  linearBuildPick(sim, wu, 'review');
}

// The verify setup the first task's builder records, its mutation tool
// answering that nothing survived.
const VERIFY_SETUP = Object.freeze({
  place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
  mutation: 'echo "[]" > "$LEEWAY_RUN/survivors.json"',
});

// The build's task loop as its skill's prose runs it (the-task-loop.md), for
// the build's simulations: each brief issued, its agent kept by its role;
// a builder's worktree made by its isolation at the default branch, as
// Claude Code's starts at the remote's, whatever the checkout holds, and the
// task laid out there by `task worktree`; its commits through the door; a
// round of its pair; its account written once its brief again says it
// landed, and taken; and its landing, the chain's `next` run once the task
// is done.
/** @param {Sim} sim @param {string} wu */
function buildLoop(sim, wu) {
  /** @type {string[]} */
  const trees = [];
  /** The agent each brief went to, by its role. @type {Map<string, Set<string>>} */
  const agents = new Map();
  /** A brief issued. @param {string[]} args */
  const brief = (args) => {
    const res = sim.run(['brief', ...args]);
    agents.set(args[0], new Set([...(agents.get(args[0]) ?? []), res.agent]));
    return res;
  };
  return {
    agents,
    brief,
    /** The worktree a builder's isolation makes for `task`, the task laid out there: its path. @param {string} task @param {string} [agent] the builder, a later one's after a /clear */
    isolated(task, agent = `agent-${task}`) {
      const tree = builders.make(agent);
      trees.push(tree);
      git(sim.dir, ['worktree', 'add', '-q', '-b', `worktree-${agent}`, tree, 'main']);
      sim.runIn(tree, ['task', 'worktree', wu, task]);
      return tree;
    },
    /** A change committed through the door from the task's worktree. @param {string} tree @param {string} task @param {Record<string, string>} files @param {string} [message] */
    committed(tree, task, files, message = `feat(${wu}): task ${task}`) {
      for (const [file, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
        fs.writeFileSync(path.join(tree, file), text, { mode: 0o755 });
      }
      return sim.runIn(tree, ['commit', '--paths', ...Object.keys(files), '--task', wu, task, '-m', message]);
    },
    /** The verify setup recorded from the task's worktree, its scenario run there. @param {string} tree @param {{id: string}} builder its brief @param {string} scenario */
    setUp(tree, builder, scenario) {
      const at = placeIn(sim, builder, 'Where the verify setup goes');
      fs.mkdirSync(path.dirname(at), { recursive: true });
      fs.writeFileSync(at, JSON.stringify(VERIFY_SETUP));
      sim.runIn(tree, ['verify', 'setup', wu, '--file', at, '--scenario', scenario]);
      sim.runIn(tree, ['verify', 'run', wu, scenario]);
    },
    /** One round of the task's pair, each reviewer briefed and writing its report. @param {string} task @param {string} [a] @param {string} [b] */
    pairRound(task, a = PASSED_REPORT, b = PASSED_REPORT) {
      for (const [letter, report] of [['a', a], ['b', b]]) landed(placeIn(sim, brief(['reviewer', wu, task, '--letter', letter]), 'Where your report goes'), report);
    },
    /**
     * The builder's brief again saying the task landed in its last round, its account of `rounds` written and taken — the
     * builder a new one after a /clear where `agent` names it, its worktree laid out first.
     * @param {string} task @param {string[]} rounds each round's summary @param {string} [agent]
     */
    accounted(task, rounds, agent) {
      const back = brief(['builder', wu, task]);
      if (agent !== undefined) this.isolated(task, agent);
      assert.match(briefOf(sim, back), new RegExp(`Your reviewers passed the task in round ${rounds.length}: it has landed, so write its account now\\.`));
      landed(placeIn(sim, back, 'Where your account goes'), [
        '## What was done', `Task ${task} is built.`, '## Where in the code', '- src/', '## What the tests prove', '- Its scenario.',
        '## Differs from the task', 'None.', '## Reviews', ...rounds.flatMap((summary, at) => [`### Round ${at + 1}`, summary]),
      ].join('\n\n'));
      assert.strictEqual(sim.run(['task', 'account', wu, task]).rounds, rounds.length);
    },
    /** Into the phase's stack, then done, then the chain's `next`: the `next`. @param {string} task */
    landedTask(task) {
      sim.run(['land', 'open', wu, task]);
      const { next } = sim.run(['land', 'chain', wu, task]);
      sim.run(['task', 'done', wu, task]);
      if (next !== undefined) sim.run(next.argv);
      return next;
    },
    /** Every builder's worktree removed. */
    cleared: () => trees.splice(0).forEach((tree) => builders.remove(sim, tree)),
  };
}

// An epic of one topic through its spec to ready to build's pick in auto:
// its cut two phases, settling an entry and showing it, the second relying
// on the first.
/** @param {Sim} sim @param {string} wu */
function twoPhaseEpic(sim, wu) {
  mappedEpic(sim, wu, ['alpha']);
  const { next } = discussed(sim, wu, 'alpha');
  handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
  specEntry(sim, wu, ['alpha']);
  sim.run(['brief', 'spec-writer', wu]);
  const [decision] = JSON.parse(sim.read(['ledger', 'record', wu, 'alpha'])).decisions;
  sim.write(`.leeway/${wu}/spec.md`, [
    '# Ledgerly', '', '## 1. The ledger', '', '### 1.1 Settling', '', `1.1.1 An entry settles as alpha decided. [${decision.id}]`, '',
    '### 1.2 Showing', '', `1.2.1 A settled entry shows as alpha decided. [${decision.id}]`, '',
    '## 1-S. Scenarios for §1', '', '1.S1 Given an entry, when it settles, then it holds as alpha decided. (1.1.1)', '',
    '1.S2 Given a settled entry, when it is shown, then it reads as alpha decided. (1.2.1)', '',
  ].join('\n'));
  sim.run(['spec', 'land', wu]);
  specReviewed(sim, wu);
  cutTheSpec(sim, wu, [
    { name: 'Settling', goal: 'An entry settles.', scenarios: ['1.S1'], sections: ['1.1'], relies_on: [] },
    { name: 'Showing', goal: 'A settled entry shows.', scenarios: ['1.S2'], sections: ['1.2'], relies_on: [1] },
  ]);
  readyToBuild(sim, wu);
  intoTheBuild(sim, wu, sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv));
}

// The round under review's read of the spec's area `area`, the first by
// default, by its pair (14.2): the first's report `report`, the second's
// passing.
/** @param {Sim} sim @param {string} wu @param {string} [report] @param {number} [area] */
function areaRead(sim, wu, report = PASSED_REPORT, area = 1) {
  for (const letter of ['a', 'b']) {
    landed(placeIn(sim, sim.run(['brief', 'review-area', wu, '--area', String(area), '--base', 'main', '--letter', letter]), 'Where your report goes'), letter === 'a' ? report : PASSED_REPORT);
  }
}

// Claude's own call on a finding at the review, with its reason (14.3.7):
// the question, then the decision answering it. Answers the decision's id.
/** @param {Sim} sim @param {string} wu @param {string} question @param {string} text @param {string} why */
function reviewCall(sim, wu, question, text, why) {
  const claude = { by: 'claude', who_moved_whom: 'none' };
  const asked = sim.run(['ledger', 'ask', `${wu}.review`], null, JSON.stringify({ ...claude, text: question })).id;
  return sim.run(['ledger', 'decide', `${wu}.review`, '--answers', asked], null, JSON.stringify({ ...claude, text, why })).id;
}

// The round under review recorded from `account` once a stray file is found
// in the checkout (14.S13): the record refused, the gate over the tree drawn
// and answered `key`, and the round recorded again. Answers what the record
// answered.
/** @param {Sim} sim @param {string} wu @param {object} account @param {string} key */
function strayRound(sim, wu, account, key) {
  fs.writeFileSync(path.join(sim.dir, 'stray.txt'), 'left in the checkout\n');
  const file = sim.write(`.leeway/.cache/${wu}/review/round.json`, account);
  sim.refuses(['review', 'round', wu, '--file', file], null);
  sim.render(['review-tree', wu], { expect: 'content' });
  sim.run(answerGate(sim, 'review tree', '--pick', key).next.argv);
  return sim.run(['review', 'round', wu, '--file', file]);
}

// A task built as the build's loop builds it (`taskBuilt`), in a worktree
// its builder's isolation makes and removes once it is done, adding `file`.
/** @param {Sim} sim @param {string} wu @param {string} task @param {string} file */
function builtAside(sim, wu, task, file) {
  const tree = builders.make(`agent-${task}`);
  taskBuilt(sim, wu, task, tree, { [file]: 'export const fix = 1;\n' }, false);
  builders.remove(sim, tree);
}

// Round 1 of the review failing on a read that never checks its hash, its
// one fix task written into the fix phase the entry names: the fix task.
/** @param {Sim} sim @param {string} wu */
function failedHashRound(sim, wu) {
  const { fixPhase: phase } = reviewNext(sim, wu);
  areaRead(sim, wu, '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n');
  testsRead(sim, wu);
  writePhaseTasks(sim, wu, phase, 'The review\'s fixes', [{ title: 'Check the hash on read', type: 'fix', scenarios: ['an entry read back'], reference: '§1' }]);
  sim.run(['review', 'round', wu, '--file', sim.write(`.leeway/.cache/${wu}/review/round.json`, {
    can_now: ['Keep a ledger.'],
    findings: [{ area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-the-work-a#1'], fix: `${phase}.1` }],
  })]);
  return `${phase}.1`;
}

// A question only the person can answer, asked at the review's place and
// raised with `call`, Claude's lean among its rows, parking `task` where one
// is given (12.13.7): what the raise answered.
/** @param {Sim} sim @param {string} wu @param {string} asks @param {object} call @param {string} [task] */
function raisedAtReview(sim, wu, asks, call, task) {
  const onTask = task === undefined ? [] : ['--task', task];
  const asked = sim.run(['ledger', 'ask', `${wu}.review`, ...onTask], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: asks })).id;
  const parks = task === undefined ? [] : ['--parks', task];
  return sim.runAsync(['raise', `${wu}.review`, '--answers', asked, ...parks], null, JSON.stringify({ ...call, question: asks }));
}

// Nothing able to go on, the stop drawn; the person, ready, answering Q1
// through its raise with the lean (12.13.22).
/** @param {Sim} sim @param {string} wu */
function answeredAtStop(sim, wu) {
  sim.render(['build-stop', wu], { expect: 'content' });
  const drawn = sim.run(['raise', 'draw', wu, 'Q1']);
  sim.run(['raise', 'answer', drawn.raise, '--pick', '1'], null, JSON.stringify({ why: 'A read should not trust the disk.' }));
}

// The round under review's read of the test surface, by its one reader
// (14.2): its report `report`.
/** @param {Sim} sim @param {string} wu @param {string} [report] */
function testsRead(sim, wu, report = PASSED_REPORT) {
  landed(placeIn(sim, sim.run(['brief', 'test-surface', wu, '--base', 'main']), 'Where your report goes'), report);
}

// The review phase entered (14.6.1), and what its DATA says comes next, the
// first that applies in its skill's order: the last round's fix tasks
// built, their phase's merge at its gate, their builders' notes answered,
// finish, the next round's reads named, or the round read; and the fix
// phase its `fix phase` line names, null where it names none.
/**
 * @param {Sim} sim @param {string} wu
 * @returns {{move: 'fixes'|'merge'|'notes'|'closing'|'reads'|'round', data: Record<string, string[]>, fixPhase: number|null}}
 */
function reviewNext(sim, wu) {
  sim.run(['enter', 'review', wu]);
  /** @type {Record<string, string[]>} */
  const data = {};
  for (const [, key, value] of sim.sections.matchAll(/^([a-z ]+): (.*)$/gm)) (data[key] ??= []).push(value);
  const move = data['fix task waiting'] ? 'fixes'
    : data['merge waiting'] ? 'merge'
      : data.round[0].endsWith('builders left are answered, then finish') ? 'notes'
        : data.round[0].endsWith('finish is next') ? 'closing'
          : data.reads[0].startsWith('not yet named') ? 'reads' : 'round';
  const fixPhase = data['fix phase'] ? Number(/^phase (\d+),/.exec(data['fix phase'][0])?.[1]) : null;
  return { move, data, fixPhase };
}

// Finish's checklist (14.5): Claude's items marked, then closed, so its
// gate draws.
/** @param {Sim} sim @param {string} wu */
function finishClosed(sim, wu) {
  for (const { key, by, state } of JSON.parse(sim.read(['checklist', 'show', 'finish', wu])).items) {
    if (by === 'claude' && state === 'open') sim.run(['checklist', 'done', 'finish', wu, key]);
  }
  sim.run(['checklist', 'close', 'finish', wu]);
}

// Finish (14.5): its checklist closed where `closed` does not say it is
// already, its gate drawn, and the person's yes at it run. Answers the
// phases each landing landed, and where the yes goes next.
/** @param {Sim} sim @param {string} wu @param {{closed?: boolean}} [opts] @returns {{landed: number[][], next: Record<string, any>}} */
function finished(sim, wu, { closed = false } = {}) {
  if (!closed) finishClosed(sim, wu);
  sim.render(['finish', wu], { expect: 'content' });
  const yes = sim.run(answerGate(sim, 'finish', '--pick', 'y').next.argv);
  return { landed: yes.landed.map((/** @type {{phases: {phase: number}[]}} */ { phases }) => phases.map(({ phase }) => phase)), next: yes.next };
}

module.exports = {
  Sim, worldFrom, sessionLog, handoffEntry, enterEntry, specEntry, handoff, answerGate, gatesAnswered, shapedInTheProduct, briefDraft, startThisWork, approveTheMap, startUnit, mapTopics, pullFromRoadmap, decideTopic, discussed, askedOn, linearMenu, linearPick, backToStart, startNew, arrive, bridgeTo, send, mappedEpic, menuEntry, arriveAtEpicMenu, epicPick, epicBuildPick, linearBuildPick, epicKey, literal, sendArgv, presenceRow, carryOn, waitAgents, startKeys, workTheSet, pickRoute, buildEntry, startPhase, writePhaseTasks, writeTasks, specReviewed, passTakenIn, passSurfaced, cutTheSpec, readyToBuild, specToBuild, intoTheBuild, briefOf, scratchCalls, deadReader, laidBeside, placeIn, landed,
  DECIDED_ITEMS, builders, taskBuilt, builtAside, firstPhaseBuilt, cutClosed, areaRead, testsRead, failedHashRound, raisedAtReview, answeredAtStop, reviewNext, reviewCall, strayRound, finishClosed, finished, PASSED_REPORT, VERIFY_FILES, VERIFY_SETUP, buildLoop, twoPhaseEpic,
};
