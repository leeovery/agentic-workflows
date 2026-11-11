'use strict';

// ---------------------------------------------------------------------------
// A topic leaving the board from its own conversation — cancelled or
// postponed (leeway-engine/scripts/domain/topic-leave.cjs, with the gates in
// domain/render.cjs and the verbs in domain/transitions.cjs and
// domain/workunit-lifecycle.cjs). Each gate row's `next`, answered through
// `gate`: the postpone gate's yes running the postpone, the horizon pick
// addressed to a topic leading to its postpone gate, the cancel gate's yes
// running the cancel — an epic's topic through `topic cancel`, a unit by its
// bare name, an epic among them, through `workunit cancel` — and every other
// row carrying on. Each
// verb's `next` (18.4.20): the conversation sitting in the discussion of the
// topic that left goes onto its epic's menu — sitting in its experiment, it
// carries on; and one sitting in any phase of a unit it cancelled — any of
// its topics, its spec, its build, a bugfix's investigation, a quick-fix's
// session — onto the start menu; from anywhere else the flow carries on; and
// a cancel leads first through the horizon pick for each roadmap item it put
// back on a horizon removed meanwhile. The
// verbs close the topic's agents still running, and their commit takes the
// topic's log.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its discussions
// of `licence` and `onboarding` under way, and a roadmap with two horizons;
// a feature, `solo`; a bugfix, `crash`; and a quick-fix, `typo`. Each test's
// conversation has its own system config; it sits where `enter` puts it, or
// `session label` inside a phase its unit has not come to.
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
const BUG = 'crash';
const QUICK_FIX = 'typo';
const LOG = `${EPIC}/topics/licence/log.md`;

/** A map row. @param {number} order */
const row = (order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });

const world = fixtureFrom('topic-leave-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: { items: { licence: row(1), onboarding: row(2) } },
      discussion: { items: { licence: { status: 'in-progress' }, onboarding: { status: 'in-progress' } } },
    },
  });
  createManifest(dir, SOLO, { phases: { discussion: { items: { [SOLO]: { status: 'in-progress' } } } } });
  createManifest(dir, BUG, { work_type: 'bugfix', description: 'Saving drops the last edit' });
  createManifest(dir, QUICK_FIX, { work_type: 'quick-fix', description: 'The --color flag is spelt --colour' });
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

/** This conversation sitting in `unit`'s `phase`, at `topic`, without entering it. @param {string} unit @param {string} phase @param {string} topic */
const labelled = (unit, phase, topic) => run(['session', 'label', unit, phase, topic]);

const CONTINUE = { kind: 'continue' };
const ONTO_MENU = { kind: 'handoff', skill: 'leeway-continue-epic', args: [EPIC] };
const ONTO_START = { kind: 'handoff', skill: 'leeway', args: [] };

describe('the gates lead to the verbs', () => {
  it('the postpone gate\'s yes runs the postpone; no and a Comment carry on', () => {
    const gate = ['postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'next'];
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'postpone', EPIC, 'licence', '--horizon', 'next'] });
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'n']), CONTINUE);
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--typed', 'comment']), CONTINUE);
  });

  it('the horizon pick addressed to a topic leads each horizon to its postpone gate, a new one carrying on; for a park every row carries on; unaddressed it leads nowhere', () => {
    const pick = ['horizon-pick', `${EPIC}.discovery.licence`];
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', '2']), { kind: 'engine', argv: ['render', 'postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'later'] });
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', 'n']), CONTINUE);
    assert.deepStrictEqual([answered(['horizon-pick', '--park', 'streak-freeze'], 'horizon pick', ['--pick', '1']), answered(['horizon-pick', '--park', 'streak-freeze'], 'horizon pick', ['--pick', 'n'])], [CONTINUE, CONTINUE]);
    assert.strictEqual(answered(['horizon-pick'], 'horizon pick', ['--pick', '1']), null);
    assert.match(refusedPristine(dir, ['render', 'horizon-pick', `${EPIC}.discussion.licence`]).error, /address must be <work_unit>\.discovery\.<topic>, got phase "discussion"$/);
  });

  it('the cancel gate\'s yes runs the cancel of an epic\'s topic; no carries on', () => {
    assert.deepStrictEqual(answered(['cancel-gate', `${EPIC}.discovery.licence`], 'cancel gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'cancel', EPIC, 'discovery', 'licence'] });
    assert.deepStrictEqual(answered(['cancel-gate', `${EPIC}.discovery.licence`], 'cancel gate', ['--pick', 'n']), CONTINUE);
  });

  it('18.4.20: a unit\'s cancel gate by its bare name confirms the whole unit, an epic\'s as a feature\'s, its yes the unit\'s cancel', () => {
    const gate = output(dir, ['render', 'cancel-gate', SOLO], { env: ENV() });
    assert.match(gate, /Cancelling \*\*Solo\*\* calls off the whole feature — it stops where it stands, and can be reactivated later\./);
    assert.deepStrictEqual(run(['gate', 'cancel gate', '--pick', 'y']).next, { kind: 'engine', argv: ['workunit', 'cancel', SOLO] });
    assert.deepStrictEqual(answered(['cancel-gate', SOLO], 'cancel gate', ['--pick', 'n']), CONTINUE);
    assert.match(output(dir, ['render', 'cancel-gate', EPIC], { env: ENV() }), /Cancelling \*\*Fumi\*\* calls off the whole epic — it stops where it stands, and can be reactivated later\./);
    assert.deepStrictEqual(run(['gate', 'cancel gate', '--pick', 'y']).next, { kind: 'engine', argv: ['workunit', 'cancel', EPIC] });
  });
});

describe('the verbs say what follows', () => {
  it('postponing the conversation\'s own topic goes back to the epic\'s menu; postponing another carries on', () => {
    sitIn('licence');
    assert.deepStrictEqual(run(['topic', 'postpone', EPIC, 'onboarding', '--horizon', 'next']).next, CONTINUE);
    assert.deepStrictEqual(run(['topic', 'postpone', EPIC, 'licence', '--horizon', 'next']).next, ONTO_MENU);
  });

  it('cancelling the conversation\'s own topic goes back to the epic\'s menu; cancelling another carries on', () => {
    sitIn('licence');
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'onboarding']).next, CONTINUE);
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'licence']).next, ONTO_MENU);
  });

  it('a conversation sitting nowhere in the epic carries on', () => {
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'licence']).next, CONTINUE);
  });

  it('a topic postponed or cancelled while the conversation sits in its experiment carries on there', () => {
    labelled(EPIC, 'experiment', 'licence');
    assert.deepStrictEqual(run(['topic', 'postpone', EPIC, 'licence', '--horizon', 'next']).next, CONTINUE);
    labelled(EPIC, 'experiment', 'onboarding');
    assert.deepStrictEqual(run(['topic', 'cancel', EPIC, 'discovery', 'onboarding']).next, CONTINUE);
  });

  it('18.S56: a feature cancelled from inside its own session goes onto the start menu', () => {
    run(['enter', 'discussion', SOLO, SOLO]);
    assert.deepStrictEqual(run(['workunit', 'cancel', SOLO]).next, ONTO_START);
  });

  it('18.4.20: a unit cancelled from inside any phase of it goes onto the start menu — an epic from one of its topics, a feature from its spec or its build, a bugfix from its investigation, a quick-fix from its session', () => {
    /** Each unit's cancel's `next`, the conversation sitting where `sit` puts it. @type {Array<[string, () => unknown]>} */
    const sittings = [
      [EPIC, () => sitIn('licence')],
      [SOLO, () => labelled(SOLO, 'specification', SOLO)],
      [SOLO, () => labelled(SOLO, 'implementation', SOLO)],
      [BUG, () => run(['enter', 'investigation', BUG])],
      [QUICK_FIX, () => labelled(QUICK_FIX, 'implementation', QUICK_FIX)],
    ];
    const nexts = sittings.map(([unit, sit]) => {
      sit();
      const { next } = run(['workunit', 'cancel', unit]);
      run(['workunit', 'reactivate', unit]);
      return next;
    });

    assert.deepStrictEqual(nexts, sittings.map(() => ONTO_START));
  });

  it('a feature cancelled from anywhere else — another unit\'s session, or none — carries on', () => {
    assert.deepStrictEqual(run(['workunit', 'cancel', SOLO]).next, CONTINUE);
    run(['workunit', 'reactivate', SOLO]);
    sitIn('licence');
    assert.deepStrictEqual(run(['workunit', 'cancel', SOLO]).next, CONTINUE);
  });

  it('18.8.20: a cancel putting a roadmap item back on a horizon removed meanwhile leads first through the horizon pick, then where the cancel goes — the conversation sitting in the topic onto the epic\'s menu, one sitting in a unit\'s spec onto the start menu', () => {
    for (const [item, into] of [['seats', EPIC], ['badges', SOLO]]) {
      run(['roadmap', 'add', item, '--horizon', 'gone', '--summary', `The ${item}`]);
      const project = JSON.parse(readState(dir, layout.projectManifest));
      project.roadmap.items[item].pulled_to = into === EPIC ? { work_unit: EPIC, topic: 'licence' } : { work_unit: SOLO };
      writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
    }
    run(['roadmap', 'horizon', 'remove', 'gone']);
    commitAll(dir, 'two items in flight, their horizon removed');

    sitIn('licence');
    const cancelled = run(['topic', 'cancel', EPIC, 'discovery', 'licence']);
    assert.deepStrictEqual(cancelled.next, { kind: 'engine', argv: ['render', 'horizon-pick', '--back', 'seats', '--from', `${EPIC}.discovery.licence`] });
    const picked = answered(cancelled.next.argv.slice(1), 'horizon pick', ['--pick', '2']);
    assert.deepStrictEqual(picked, { kind: 'engine', argv: ['roadmap', 'move', 'seats', '--horizon', 'later', '--from', `${EPIC}.discovery.licence`] });
    assert.deepStrictEqual(run(picked.argv).next, ONTO_MENU);

    labelled(SOLO, 'specification', SOLO);
    const solo = run(['workunit', 'cancel', SOLO]);
    assert.deepStrictEqual(solo.next, { kind: 'engine', argv: ['render', 'horizon-pick', '--back', 'badges', '--from', SOLO] });
    assert.deepStrictEqual(run(answered(solo.next.argv.slice(1), 'horizon pick', ['--pick', '1']).argv).next, ONTO_START);
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
