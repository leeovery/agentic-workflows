'use strict';

// ---------------------------------------------------------------------------
// A topic leaving the board from its own conversation — cancelled or
// postponed (ledger-engine/scripts/domain/topic-leave.cjs, with the gates in
// domain/render.cjs and the verbs in domain/transitions.cjs and
// domain/workunit-lifecycle.cjs). Each gate row's `next`, answered through
// `gate`: the postpone gate's yes running the postpone, the horizon pick
// addressed to a topic leading to its postpone gate, the cancel gate's yes
// running the cancel — an epic's topic through `topic cancel`, a unit by its
// bare name, an epic among them, through `workunit cancel` — and every other
// row carrying on. Each
// verb's `next` (18.4.20): the conversation sitting in the discussion of the
// topic that left goes onto its epic's menu — sitting in its experiment, it
// carries on; one sitting in any phase of a unit it cancelled — any of its
// topics, its spec, its build, a bugfix's investigation, a quick-fix's
// session — carries on, no menu drawn, a line saying what waits but at a
// quick-fix; from anywhere else the flow carries on; and a cancel, or a
// removal of a topic not yet started, leads first through the horizon pick
// for each roadmap item it put back on a horizon removed meanwhile, and for
// nothing else. The verbs close the topic's agents still running, and their
// commit takes the topic's log. A unit's finish or cancel, from inside it,
// leaves the conversation's place and its tasks in flight there, so the
// hook before Bash no longer refuses a raw commit (24.1.2).
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
const { createManifest, withEnv } = require('./discovery-test-utils.cjs');
const { leftUnit } = require('../../skills/ledger-engine/scripts/domain/topic-leave.cjs');
const { readPosition, positionPath } = require('../../skills/ledger-engine/scripts/domain/conversation.cjs');
const { leavePosition } = require('../../skills/ledger-engine/scripts/domain/position.cjs');
const { shellRefusal } = require('../../skills/ledger-engine/scripts/domain/shell-guard.cjs');

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

const ENV = () => ({ LEDGER_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

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

/** Whether this conversation sits anywhere. */
const seated = () => fs.existsSync(path.join(config, 'conversations', 'sess-1', 'position.json'));

const CONTINUE = { kind: 'continue' };
const ONTO_MENU = { kind: 'handoff', skill: 'ledger-continue-epic', args: [EPIC] };

/** This conversation in the build of `unit`, the quick-fix's by default, `task start` having put its first task in flight there. @param {string} [unit] */
function building(unit = QUICK_FIX) {
  const file = withEnv(ENV(), () => positionPath('sess-1'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ name: unit, phase: 'implementation', topic: unit, tasks: [{ task: '1.1', builder: null, reviewers: [] }] }));
}

/** Why the hook before Bash refuses a raw commit in this conversation, or null where it lets it run. */
const rawCommit = () => withEnv(ENV(), () => shellRefusal(dir, { session_id: 'sess-1', tool_input: { command: 'git commit -m "tidy"' } }));

/** Where this conversation then stands: its position as read, and as stored under any place left. */
const standing = () => withEnv(ENV(), () => [readPosition('sess-1'), fs.existsSync(positionPath('sess-1'))]);

describe('the gates lead to the verbs', () => {
  it('the postpone gate\'s yes runs the postpone; no and a Comment carry on', () => {
    const gate = ['postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'next'];
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'y']), { kind: 'engine', argv: ['topic', 'postpone', EPIC, 'licence', '--horizon', 'next'] });
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--pick', 'n']), CONTINUE);
    assert.deepStrictEqual(answered(gate, 'postpone gate', ['--typed', 'comment']), CONTINUE);
  });

  it('the horizon pick addressed to a topic leads each horizon to its postpone gate, a new one carrying on; for a park of one item or several every row carries on; naming nothing going on the roadmap it is refused', () => {
    const pick = ['horizon-pick', `${EPIC}.discovery.licence`];
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', '2']), { kind: 'engine', argv: ['render', 'postpone-gate', `${EPIC}.discovery.licence`, '--horizon', 'later'] });
    assert.deepStrictEqual(answered(pick, 'horizon pick', ['--pick', 'n']), CONTINUE);
    for (const park of ['streak-freeze', 'streak-freeze,dark-mode']) {
      assert.deepStrictEqual([answered(['horizon-pick', '--park', park], 'horizon pick', ['--pick', '1']), answered(['horizon-pick', '--park', park], 'horizon pick', ['--pick', 'n'])], [CONTINUE, CONTINUE]);
    }
    assert.match(refusedPristine(dir, ['render', 'horizon-pick']).error, /name what is going on the roadmap/);
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

  it('a feature cancelled from inside its own session draws no menu unasked: the conversation leaves its position and carries on, a line after the receipt saying what waits on the person, the menu one `/ledger` away', () => {
    run(['enter', 'discussion', SOLO, SOLO]);

    const [json, ...receipt] = output(dir, ['workunit', 'cancel', SOLO], { env: ENV() }).split('\n');

    assert.deepStrictEqual([JSON.parse(json).next, seated()], [CONTINUE, false]);
    assert.deepStrictEqual(receipt.slice(receipt.findIndex((line) => line.startsWith('=== DISPLAY: ended'))).filter((line) => line !== ''), [
      '=== DISPLAY: ended (emit verbatim as markdown (not a code block) after the response) ===',
      'Nothing waits on you. The menu is one `/ledger` away.',
    ]);
  });

  it('18.4.20: a unit cancelled from inside any phase of it leaves the conversation\'s place and carries on, no menu drawn — an epic from one of its topics, a feature from its spec or its build, a bugfix from its investigation', () => {
    /** Each unit's cancel's `next`, the conversation sitting where `sit` puts it. @type {Array<[string, () => unknown]>} */
    const sittings = [
      [EPIC, () => sitIn('licence')],
      [SOLO, () => labelled(SOLO, 'specification', SOLO)],
      [SOLO, () => labelled(SOLO, 'implementation', SOLO)],
      [BUG, () => run(['enter', 'investigation', BUG])],
    ];
    const nexts = sittings.map(([unit, sit]) => {
      sit();
      const { next } = run(['workunit', 'cancel', unit]);
      const left = !seated();
      run(['workunit', 'reactivate', unit]);
      return [next, left];
    });

    assert.deepStrictEqual(nexts, sittings.map(() => [CONTINUE, true]));
  });

  it('a feature cancelled from inside its build, a task in flight there, leaves its place and the task, so a raw commit is no longer refused', () => {
    building(SOLO);
    const refusedBefore = rawCommit();
    run(['workunit', 'cancel', SOLO]);

    assert.match(String(refusedBefore), /a raw git commit is refused while task 1\.1 of /);
    assert.deepStrictEqual([rawCommit(), ...standing()], [null, null, false]);
  });

  it('19.5.1: a quick-fix cancelled carries on in the conversation, from its session or anywhere else; from its session, a fix in flight, the conversation leaves its place and the fix, so a raw commit is no longer refused', () => {
    building();
    const refusedBefore = rawCommit();
    const fromItsSession = run(['workunit', 'cancel', QUICK_FIX]).next;
    const after = [rawCommit(), ...standing()];
    run(['workunit', 'reactivate', QUICK_FIX]);
    sitIn('licence');
    const fromElsewhere = run(['workunit', 'cancel', QUICK_FIX]).next;

    assert.match(String(refusedBefore), /a raw git commit is refused while task 1\.1 of typo is in flight/);
    assert.deepStrictEqual([fromItsSession, after, fromElsewhere], [CONTINUE, [null, null, false], CONTINUE]);
    assert.deepStrictEqual(withEnv(ENV(), () => readPosition('sess-1'))?.topic, 'licence', 'a cancel from elsewhere leaves the conversation where it sits');
  });

  it('a quick-fix cancelled from another conversation, its fix in flight in this one, holds this one\'s raw commits no longer, its place there as it stands', () => {
    building();
    const refusedBefore = rawCommit();
    ok(dir, ['workunit', 'cancel', QUICK_FIX], { env: { ...ENV(), CLAUDE_CODE_SESSION_ID: 'sess-2' } });
    assert.match(String(refusedBefore), /a raw git commit is refused/);
    assert.deepStrictEqual([rawCommit(), withEnv(ENV(), () => readPosition('sess-1'))?.name], [null, QUICK_FIX]);
  });

  it('a feature cancelled from anywhere else — another unit\'s session, or none — carries on', () => {
    assert.deepStrictEqual(run(['workunit', 'cancel', SOLO]).next, CONTINUE);
    run(['workunit', 'reactivate', SOLO]);
    sitIn('licence');
    assert.deepStrictEqual(run(['workunit', 'cancel', SOLO]).next, CONTINUE);
  });

  it('18.8.20: a cancel putting a roadmap item back on a horizon removed meanwhile leads first through the horizon pick, then where the cancel goes — the conversation sitting in the topic onto the epic\'s menu, one sitting in a unit\'s spec carrying on, its position left', () => {
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
    assert.deepStrictEqual(run(answered(solo.next.argv.slice(1), 'horizon pick', ['--pick', '1']).argv).next, CONTINUE);
  });

  it('18.8.20: a quick-fix cancelled from its session, an item it took in put back on no horizon, leaves its place and its fix at the cancel itself, before the horizon pick, and carries on after it', () => {
    run(['roadmap', 'add', 'colours', '--horizon', 'gone', '--summary', 'The colours']);
    const project = JSON.parse(readState(dir, layout.projectManifest));
    project.roadmap.items.colours.pulled_to = { work_unit: QUICK_FIX };
    writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
    run(['roadmap', 'horizon', 'remove', 'gone']);
    commitAll(dir, 'an item in the quick-fix, its horizon removed');
    building();

    const cancelled = run(['workunit', 'cancel', QUICK_FIX]);
    const atThePick = [rawCommit(), ...standing()];
    const picked = run(answered(cancelled.next.argv.slice(1), 'horizon pick', ['--pick', '1']).argv).next;
    assert.deepStrictEqual([cancelled.next, atThePick, picked], [pickFor('colours', QUICK_FIX), [null, null, false], CONTINUE]);
  });

  /** `item` pulled forward into the epic as a topic, from a horizon removed since. @param {string} item */
  function pulledFromGone(item) {
    run(['roadmap', 'add', item, '--horizon', 'gone', '--summary', `The ${item}`]);
    run(['roadmap', 'pull-forward', item, '--into', EPIC]);
    run(['roadmap', 'horizon', 'remove', 'gone']);
  }

  /** The horizon pick for `item`, as what put it back leads to it. @param {string} item @param {string} from */
  const pickFor = (item, from) => ({ kind: 'engine', argv: ['render', 'horizon-pick', '--back', item, '--from', from] });

  it('18.8.20, 8.8.16: a removal of a topic not yet started leads through the horizon pick for the item it put back on none, then carries on', () => {
    pulledFromGone('tour');
    const removed = run(['topic', 'remove', EPIC, 'tour']);
    assert.deepStrictEqual([removed.roadmap_horizon_gone, removed.next], [[{ name: 'tour', horizon: 'gone' }], pickFor('tour', `${EPIC}.discovery.tour`)]);
    const moved = run(answered(removed.next.argv.slice(1), 'horizon pick', ['--pick', '2']).argv);
    assert.deepStrictEqual([moved.horizon, moved.next], ['later', CONTINUE]);
  });

  it('18.8.20: a cancel asks only about what it put back — an item another verb left on no horizon is no pick of its, at its start or along its chain', () => {
    pulledFromGone('tour');
    run(['topic', 'remove', EPIC, 'tour']);
    assert.deepStrictEqual(run(['workunit', 'cancel', BUG]).next, CONTINUE);

    pulledFromGone('seats');
    const cancelled = run(['topic', 'cancel', EPIC, 'discovery', 'seats']);
    assert.deepStrictEqual(cancelled.next, pickFor('seats', `${EPIC}.discovery.seats`));
    assert.deepStrictEqual(run(answered(cancelled.next.argv.slice(1), 'horizon pick', ['--pick', '1']).argv).next, CONTINUE);
    assert.strictEqual(run(['roadmap', 'state']).items.find((/** @type {{name: string}} */ { name }) => name === 'tour').horizon, null, 'left for its own way on');
  });
});

describe('a finish leaves the unit (24.1.2, 19.5.1, 24.1.8)', () => {
  /** Whether a finish of `unit` leaves it, from this conversation. @param {string} unit */
  const finished = (unit) => withEnv(ENV(), () => leftUnit(dir, unit));

  it('any unit\'s finish — an epic\'s, a feature\'s, a bugfix\'s, a quick-fix\'s close — leaves the conversation\'s place and the task in flight there, so a raw commit is no longer refused', () => {
    const left = [EPIC, SOLO, BUG, QUICK_FIX].map((unit) => {
      building(unit);
      const refusedBefore = rawCommit();
      return [String(refusedBefore).startsWith('a raw git commit is refused'), finished(unit), rawCommit(), ...standing()];
    });

    assert.deepStrictEqual(left, [EPIC, SOLO, BUG, QUICK_FIX].map(() => [true, true, null, null, false]));
  });

  it('a unit finished after its place was left, a task still in flight, takes the task off with the position', () => {
    building();
    withEnv(ENV(), () => leavePosition('sess-1'));
    const refusedBefore = rawCommit();
    assert.match(String(refusedBefore), /a raw git commit is refused/);
    assert.deepStrictEqual([finished(QUICK_FIX), rawCommit(), ...standing()], [true, null, null, false]);
  });

  it('a unit finished while the conversation sits in other work leaves that place alone', () => {
    sitIn('licence');
    assert.deepStrictEqual([finished(QUICK_FIX), withEnv(ENV(), () => readPosition('sess-1'))?.topic], [false, 'licence']);
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
