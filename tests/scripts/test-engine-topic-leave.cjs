'use strict';

// ---------------------------------------------------------------------------
// A topic leaving the board from its own conversation — cancelled or
// postponed (leeway-engine/scripts/domain/topic-leave.cjs, with the gates in
// domain/render.cjs and the verbs in domain/transitions.cjs and
// domain/workunit-lifecycle.cjs). Each gate row's `next`, answered through
// `gate`: the postpone gate's yes running the postpone, the horizon pick
// addressed to a topic leading to its postpone gate, the cancel gate's yes
// running the cancel — an epic's unit through `topic cancel`, a single-topic
// unit through `workunit cancel` — and every other row carrying on. Each
// verb's `next`: the conversation sitting in the topic that left goes back
// to its epic's menu, naming the phase and how it left; from anywhere else
// the flow carries on. The verbs close the topic's agents still running, and
// their commit takes the topic's log.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its discussions
// of `licence` and `onboarding` under way, a specification of `licence` under
// way, and a roadmap with two horizons; and a feature, `solo`. Each test's
// conversation has its own system config.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, output, refusedPristine, writeState, readState, layout, commitAll, stateGit, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const EPIC = 'fumi';
const SOLO = 'solo';
const LOG = `${EPIC}/topics/licence/log.md`;

/** A map row. @param {number} order */
const row = (order) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery' });

const world = fixtureFrom('topic-leave-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: { items: { licence: row(1), onboarding: row(2) } },
      discussion: { items: { licence: { status: 'in-progress' }, onboarding: { status: 'in-progress' } } },
      specification: { items: { pricing: { status: 'in-progress', sources: {} } } },
    },
  });
  createManifest(dir, SOLO, { phases: { discussion: { items: { [SOLO]: { status: 'in-progress' } } } } });
  const project = JSON.parse(readState(dir, layout.projectManifest));
  project.roadmap = { horizons: ['next', 'later'], items: {} };
  writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
  commitAll(dir, 'the world');
});

/** @type {string} */ let dir;
/** @type {string} */ let config;

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-leave-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

const ENV = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** An engine call as this conversation runs it. @param {string[]} args */
const run = (args) => ok(dir, args, { env: ENV() });

/** The gate `render` draws, then `answer` given: the row's next. @param {string[]} render @param {string} name @param {string[]} answer */
function answered(render, name, answer) {
  output(dir, ['render', ...render], { env: ENV() });
  return run(['gate', name, ...answer]).next;
}

/** This conversation sitting in `topic`'s discussion. @param {string} topic */
const sitIn = (topic) => run(['enter', 'discussion', EPIC, topic]);

const CONTINUE = { kind: 'continue' };

describe('the gates lead to the verbs', () => {
  it('the postpone gate\'s yes runs the postpone; no and a Comment carry on', () => {
    const gate = ['postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'next'];
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'postpone', EPIC, 'licence', '--horizon', 'next'] });
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'n']), CONTINUE);
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--typed', 'comment']), CONTINUE);
  });

  it('the horizon pick addressed to a topic leads each horizon to its postpone gate, a new one carrying on; unaddressed it leads nowhere', () => {
    const pick = ['horizon-pick', `${EPIC}.discovery.licence`];
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', '2']), { kind: 'engine', argv: ['render', 'postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'later'] });
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', 'n']), CONTINUE);
    assert.strictEqual(answered(['horizon-pick'], 'horizon pick', ['--pick', '1']), null);
    assert.match(refusedPristine(dir, ['render', 'horizon-pick', `${EPIC}.discussion.licence`]).error, /address must be <work_unit>\.discovery\.<topic>, got phase "discussion"$/);
  });

  it('the cancel gate\'s yes runs the cancel of an epic\'s unit, at either stage; no carries on', () => {
    assert.deepStrictEqual(answered(['cancel-gate', `${EPIC}.discovery.licence`], 'cancel gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'cancel', EPIC, 'discovery', 'licence'] });
    assert.deepStrictEqual(answered(['cancel-gate', `${EPIC}.specification.pricing`], 'cancel gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'cancel', EPIC, 'specification', 'pricing'] });
    assert.deepStrictEqual(answered(['cancel-gate', `${EPIC}.discovery.licence`], 'cancel gate', ['--pick', 'n']), CONTINUE);
  });

  it('a single-topic unit\'s cancel gate confirms the whole unit, its yes the unit\'s cancel; an epic is addressed by its unit', () => {
    const gate = output(dir, ['render', 'cancel-gate', SOLO], { env: ENV() });
    assert.match(gate, /Cancelling \*\*Solo\*\* calls off the whole feature — it stops where it stands, and can be reactivated later\./);
    assert.deepStrictEqual(run(['gate', 'cancel gate', '--pick', 'y']).next, { kind: 'engine', argv: ['workunit', 'cancel', SOLO] });
    assert.deepStrictEqual(answered(['cancel-gate', SOLO], 'cancel gate', ['--pick', 'n']), CONTINUE);
    assert.match(refusedPristine(dir, ['render', 'cancel-gate', EPIC]).error, /"fumi" is an epic — address the unit to cancel/);
  });
});

describe('the verbs say what follows', () => {
  it('postponing the conversation\'s own topic goes back to the epic\'s menu; postponing another carries on', () => {
    sitIn('licence');
    assert.deepStrictEqual(run(['topic', 'postpone', EPIC, 'onboarding', '--horizon', 'next']).next, CONTINUE);
    assert.deepStrictEqual(run(['topic', 'postpone', EPIC, 'licence', '--horizon', 'next']).next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [EPIC, 'discussion', 'postponed'] });
  });

  it('cancelling the conversation\'s own topic goes back to the epic\'s menu; cancelling another carries on', () => {
    sitIn('licence');
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'onboarding']).next, CONTINUE);
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'licence']).next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [EPIC, 'discussion', 'cancelled'] });
  });

  it('a conversation sitting nowhere in the epic carries on', () => {
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'licence']).next, CONTINUE);
  });
});

describe('what the verbs take with the topic', () => {
  /** Two agents dispatched on licence's discussion, the first's report landed: their ids. */
  function dispatched() {
    const [landed, running] = ['landed', 'running'].map((label) => run(['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', label]).id);
    writeState(dir, layout.cache(EPIC, 'discussion', 'licence', `${landed}.md`), '# Findings\n');
    return { landed, running };
  }

  /** licence's discussion rows by status. */
  const rows = () => run(['agent', 'scan', EPIC, 'discussion', 'licence']);

  for (const [verb, args] of /** @type {const} */ ([['cancel', ['topic', 'cancel', EPIC, 'discovery', 'licence']], ['postpone', ['topic', 'postpone', EPIC, 'licence', '--horizon', 'next']]])) {
    it(`${verb} closes the topic's agents still running, a landed report kept, and commits the topic's log`, () => {
      sitIn('licence');
      const { landed, running } = dispatched();
      writeState(dir, LOG, '# Licence\n\nWhere we got to.\n');
      const res = run([...args]);
      assert.deepStrictEqual(res.closed_agents, [running]);
      const scan = rows();
      assert.deepStrictEqual([scan.incorporated.map((/** @type {{id: string}} */ r) => r.id), scan.pending.map((/** @type {{id: string}} */ r) => r.id)], [[running], [landed]]);
      assert.ok(stateGit(dir, ['show', '--name-only', '--format=', 'HEAD']).split('\n').includes(LOG), 'the log rides the commit');
    });
  }
});
