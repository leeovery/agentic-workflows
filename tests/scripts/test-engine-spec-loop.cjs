'use strict';

// ---------------------------------------------------------------------------
// The spec's loop, walked (leeway-engine/scripts/domain/spec-passes.cjs, the
// loop's states; agent-state.cjs, the store a pass's report is taken in by;
// brief-records.cjs, the briefs that read them): seeded walks of the loop's
// events — the writer's brief, alone or landed; spec.md edited, a statement,
// the introduction, an area added, removed or moved, and landed or left
// written; a pass dispatched, briefed and reported, clean or with findings
// in each lane, its report malformed, or abandoned in flight and reporting
// late with gap and fact findings; its report acknowledged with its
// findings, acknowledged clean though it holds some or incorporated before
// its acknowledgement, each refused; incorporated once acknowledged; a
// finding surfaced; an entry made at the spec, an asset linked to one, a gap
// asked and answered; the way on taken — each walk then following the way
// on until the review settles. After every step the invariants, each read
// from the events the walk performed and what the briefs carried, never from
// the store's status:
//
// - Never settled with something unread: where ready to build's
//   `review-settled` is done, every entry the walk made at the spec was
//   carried by a writer's brief a land followed; every finding of a pass
//   taken in — neither abandoned nor refused — is dealt with: a `rewrite`
//   finding's report carried by a writer's brief a land followed, a `gap` or
//   `fact` finding acknowledged by id and then surfaced, or its pass
//   incorporated after that acknowledgement; and the latest pass taken in
//   reviewed the spec as it stands.
// - What waits is what the writer is shown: the entries the way on counts,
//   and the passes it names, are those the writer's next brief carries.
// - Never stuck: where it is open, the way on names an action the walk
//   takes, and taken, the store accepts it; followed, it settles.
//
// The walks' coverage is pinned: across the seeds, every event occurs, and
// the review settles before the walk is drained.
//
// Layer: verb. World, built once and copied for each walk: an epic,
// `payments`, its topics `cards` and `refunds` each decided, and the sweep
// taken.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, call, layout, writeState, commitAll, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { RECORDS } = require(path.join(SCRIPTS, 'domain/brief-records.cjs'));
const {
  waitingOn, printOf, changedSince, reviewSettled,
} = require(path.join(SCRIPTS, 'domain/spec-passes.cjs'));
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));

const UNIT = 'payments';
const SPEC = layout.unit(UNIT, 'spec.md');
const SESSION_ID = 'spec-loop-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const AT_SPEC = `${UNIT}.specification`;
const STORE = Object.freeze([UNIT, 'specification', UNIT]);
const LANES = Object.freeze([[], ['rewrite'], ['gap'], ['fact'], ['gap', 'fact'], ['rewrite', 'gap'], ['rewrite', 'gap', 'fact']]);
const LATE = Object.freeze([['gap', 'fact'], ['rewrite', 'gap', 'fact']]);
/** Each way a report's finding is written outside the grammar: its heading and its lane line. @type {readonly ((id: string, lane: string) => string[])[]} */
const MALFORMED = Object.freeze([
  (id, lane) => [`### ${id}: a ${lane} finding`, `**Lane:** \`${lane}\``],
  (id, lane) => [`### ${id}: a ${lane} finding`, `**Lane:** ${lane[0].toUpperCase()}${lane.slice(1)}`],
  (id, lane) => [`### ${id}: a ${lane} finding`, `**Lane**: ${lane}`],
  (id, lane) => [`#### ${id}: a ${lane} finding`, `**Lane:** ${lane}`],
]);
/** Every event a walk takes, pinned to occur across the seeds. */
const EVENTS = Object.freeze([
  'writer brief', 'writer brief, landed', 'land', 'spec: a statement edited', 'spec: the introduction edited', 'spec: an area added',
  'spec: an area removed', 'spec: areas moved', 'pass', 'pass, its report malformed', 'pass abandoned, reporting late', 'ack',
  'ack --clean, refused', 'incorporate before its ack, refused', 'incorporate', 'surface', 'entry at the spec',
  'asset linked to an entry at the spec', 'gap asked', 'gap answered', 'the way on taken',
]);
/** The walks' seeds, chosen among sixty so that together they take every event and each of the loop's past holes fails one: a pass read leniently (8, 17), abandoned and read when it reports (2), or incorporated or acknowledged clean unread (7, 33, 42); a take recorded at the brief (8) or marked at the land (33); a finding surfaced and waiting still (7); an acknowledgement taken with other ids than its report holds (33). */
const SEEDS = Object.freeze([2, 7, 8, 17, 33, 42]);
const STEPS = 12;
/** The most steps a drained walk follows the way on before it must have settled. */
const DRAIN = 16;

/** Each decision's short id by topic, filled as the world is built. @type {Record<string, string>} */
const decided = {};

const world = fixtureFrom('spec-loop-', (dir) => {
  const manifest = (/** @type {string} */ status) => createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { cards: { order: 1, summary: 'Cards', source: 'discovery' }, refunds: { order: 2, summary: 'Refunds', source: 'discovery' } } },
      discussion: { items: { cards: { status }, refunds: { status } } },
    },
  });
  manifest('in-progress');
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  for (const topic of ['cards', 'refunds']) {
    const at = `${UNIT}.discussion.${topic}`;
    const asked = write('ask', at, [], { ...PERSON, text: `What does ${topic} take?` }).id;
    decided[topic] = write('decide', at, ['--answers', asked], { ...PERSON, text: `${topic} take one kind.`, why: 'Kept simple.' }).id;
  }
  manifest('completed');
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ taken: '2026-11-01T00:00:00.000Z', messages: [], candidates: [] }));
  commitAll(dir, 'topics settled');
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
});

const { write } = ledgerHelpers(() => dir);

/** The events the walks took, and how many walks settled before they were drained. */
const covered = { events: new Set(), settled: 0 };

/** A seeded generator of numbers in [0, 1) (mulberry32). @param {number} seed */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The spec a walk's shape writes: its introduction's edition, its first
 * statement's take, the extra areas by number, and whether its two areas are
 * swapped.
 * @typedef {{take: number, intro: number, extras: number[], next: number, swapped: boolean}} Shape
 * @param {Shape} shape
 */
function specOf({ take, intro, extras, swapped }) {
  const cards = ['## 1. Cards', '', '### 1.1 The form', '', `1.1.1 Cards take one kind, take ${take}. [${decided.cards}]`, ''];
  const refunds = ['## 2. Refunds', '', '### 2.1 Where', '', `2.1.1 Refunds take one kind. [${decided.refunds}]`, ''];
  return [
    '# Payments', '', ...(intro === 0 ? [] : [`The payments of the shop, edition ${intro}.`, '']),
    ...(swapped ? [...refunds, ...cards] : [...cards, ...refunds]),
    ...extras.flatMap((n) => [`## ${n}. Extra ${n}`, '', `### ${n}.1 More`, '', `${n}.1.1 Refunds take one kind, in area ${n}. [${decided.refunds}]`, '']),
  ].join('\n');
}

/** A pass's report, one finding per lane given, each written as `form` writes it. @param {string} id @param {string[]} lanes @param {(id: string, lane: string) => string[]} form */
const reportOf = (id, lanes, form) => [
  `# Spec Review — ${id}`, '', '## Findings', '',
  ...(lanes.length === 0 ? ['None identified.'] : lanes.flatMap((lane, at) => {
    const [heading, laneLine] = form(`F${at + 1}`, lane);
    return [heading, '', laneLine, '', 'The spec and the records part here.', ''];
  })),
].join('\n');

/** A finding written as the grammar reads it. @param {string} id @param {string} lane */
const WELL_FORMED = (id, lane) => [`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`];

/** The section a heading opens in a brief, to the next heading at its level. @param {string} brief @param {string} heading */
function section(brief, heading) {
  const body = brief.slice(brief.indexOf(`\n# ${heading}\n\n`) + heading.length + 5);
  const end = body.search(/\n\n# (?!Spec Review)/);
  return end === -1 ? body : body.slice(0, end);
}

/** Whether a pass's brief is issuable: its sections draw. */
function reviewable() {
  try {
    RECORDS['changed-sections'].draw({ cwd: dir, role: 'spec-reviewer', ref: null, task: null, place: null, unit: UNIT, given: {}, session: SESSION_ID }, []);
    return true;
  } catch {
    return false;
  }
}

/**
 * A pass as the walk performed it: its findings' lanes; `taken` while the
 * store took it in, `ignored` once abandoned or refused; the ids the walk
 * acknowledged it with, null before, and surfaced; whether it is closed, and
 * whether the walk closed it after its acknowledgement, declining what it
 * did not surface; and the spec it reviewed.
 * @typedef {{id: string, lanes: string[], state: 'taken'|'ignored', acknowledged: Set<string>|null, surfaced: Set<string>, closed: boolean, declined: boolean, reviewed: string}} Pass
 */

/** @typedef {[string, () => void, string?]} Step an event's name, what it does, and the pass it is on */

class Walk {
  /** @param {number} seed */
  constructor(seed) {
    this.random = seeded(seed);
    /** @type {Shape} */
    this.shape = { take: 0, intro: 0, extras: [], next: 3, swapped: false };
    this.written = '';
    this.landed = '';
    this.assets = 0;
    /** @type {string[]} */
    this.trail = [];
    /** @type {Pass[]} */
    this.passes = [];
    /** Entries the walk made at the spec, by short id. @type {Set<string>} */
    this.made = new Set();
    /** What a writer's brief a land followed carried: entries and passes. */
    this.seen = { entries: new Set(), passes: new Set() };
    /** What the writer's last brief carried, until a land. @type {{entries: Set<string>, passes: Set<string>}|null} */
    this.pending = null;
    /** @type {string|null} */
    this.gap = null;
    /** Where the loop stood after the last step: a pass's brief issuable, the review settled, and the step the way on names. */
    this.issuable = false;
    this.settled = false;
    /** @type {Step|null} */
    this.way = null;
  }

  /** @template T @param {readonly T[]} items @returns {T} */
  pick(items) {
    return items[Math.floor(this.random() * items.length)];
  }

  get after() {
    return `after ${this.trail.join(' → ')}`;
  }

  brief() {
    const named = waitingOn(dir, UNIT, []) ?? '';
    const res = call(dir, ['brief', 'spec-writer', UNIT], { env: SESSION });
    if (res.code !== 0) return;
    const { id } = JSON.parse(res.stdout.split('\n')[0]);
    const text = fs.readFileSync(briefPath(SESSION_ID, id), 'utf8');
    const carried = {
      entries: new Set([...section(text, 'Written since your last brief').matchAll(/^- (\S+) /gm)].map(([, short]) => short)),
      passes: new Set([...section(text, 'The review\'s findings').matchAll(/^# Spec Review — (\S+)$/gm)].map(([, pass]) => pass)),
    };
    const counted = /(\d+) entr(?:y|ies) made at the spec/.exec(named);
    const reports = /the report of (.+?)(?:, and \d+ entr(?:y|ies) made at the spec)?(?:;|$)/.exec(named);
    assert.deepStrictEqual(
      { entries: carried.entries.size, passes: [...carried.passes] },
      { entries: counted === null ? 0 : Number(counted[1]), passes: reports === null ? [] : reports[1].split(', ') },
      `the writer's brief carries other than waits for it, ${this.after}`,
    );
    this.pending = carried;
  }

  land() {
    ok(dir, ['spec', 'land', UNIT]);
    this.landed = this.written;
    if (this.pending === null) return;
    for (const short of this.pending.entries) this.seen.entries.add(short);
    for (const pass of this.pending.passes) this.seen.passes.add(pass);
    this.pending = null;
  }

  /** @param {(shape: Shape) => void} change */
  edit(change) {
    change(this.shape);
    this.written = specOf(this.shape);
    writeState(dir, SPEC, this.written);
  }

  /** @param {'pass'|'malformed'|'abandoned'} kind @param {readonly string[]} [lanes] */
  review(kind, lanes) {
    const { id, file } = ok(dir, ['agent', 'dispatch', ...STORE, '--kind', 'spec-review']);
    ok(dir, ['brief', 'spec-reviewer', UNIT, '--agent', id], { env: SESSION });
    const given = [...(lanes ?? this.pick(kind === 'pass' ? LANES : kind === 'malformed' ? LANES.slice(2) : LATE))];
    /** @type {Pass} */
    const pass = { id, lanes: given, state: 'taken', acknowledged: null, surfaced: new Set(), closed: false, declined: false, reviewed: this.landed };
    if (kind === 'abandoned') {
      ok(dir, ['agent', 'incorporate', ...STORE, id]);
      pass.state = 'ignored';
    }
    fs.writeFileSync(file, `${reportOf(id, given, kind === 'malformed' ? this.pick(MALFORMED) : WELL_FORMED)}\n`);
    const { refused = [] } = ok(dir, ['agent', 'scan', ...STORE]);
    if (refused.some((/** @type {{id: string}} */ refusal) => refusal.id === id)) pass.state = 'ignored';
    this.passes.push(pass);
  }

  /** @param {Pass} pass */
  ack(pass) {
    const findings = pass.lanes.map((_, at) => `F${at + 1}`);
    ok(dir, ['agent', 'ack', ...STORE, pass.id, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]);
    pass.acknowledged = new Set(findings);
    pass.closed = findings.length === 0;
  }

  /** An off-path close of a pass not yet acknowledged — refused by the store; where it is not, the walk records what it did. @param {Pass} pass @param {string[]} args */
  offPath(pass, args) {
    if (call(dir, ['agent', ...args.slice(0, 1), ...STORE, pass.id, ...args.slice(1)]).code !== 0) return;
    pass.acknowledged = new Set();
    pass.closed = true;
  }

  /** @param {Pass} pass */
  incorporate(pass) {
    ok(dir, ['agent', 'incorporate', ...STORE, pass.id]);
    pass.closed = true;
    pass.declined = true;
  }

  /** @param {Pass} pass @param {string} id */
  surface(pass, id) {
    ok(dir, ['agent', 'surface', ...STORE, pass.id, id]);
    pass.surfaced.add(id);
    pass.closed = [...(pass.acknowledged ?? [])].every((acknowledged) => pass.surfaced.has(acknowledged));
  }

  /** The first gap or fact finding a pass was acknowledged with and has not surfaced, null where none. @param {Pass} pass */
  unsurfaced(pass) {
    const at = pass.lanes.findIndex((lane, i) => lane !== 'rewrite' && (pass.acknowledged?.has(`F${i + 1}`) ?? false) && !pass.surfaced.has(`F${i + 1}`));
    return at === -1 || pass.closed ? null : `F${at + 1}`;
  }

  entry() {
    this.made.add(write('find', AT_SPEC, [], { ...MADE, text: `A fact found at the spec, ${this.made.size}.`, how: 'read in the code', known: 'read' }).id);
  }

  link() {
    this.assets += 1;
    const file = layout.assets(UNIT, `asset-${this.assets}.md`);
    writeState(dir, file, '# An asset\n');
    ok(dir, ['asset', 'add', UNIT, file, '--entry', this.pick([...this.made]), '--status', 'canonical'], { env: SESSION });
  }

  ask() {
    this.gap = write('ask', AT_SPEC, [], { ...MADE, text: `Is a refund ever split, ${this.made.size}?` }).id;
    this.made.add(this.gap);
  }

  answer() {
    this.made.add(write('decide', AT_SPEC, ['--answers', /** @type {string} */ (this.gap)], { ...PERSON, text: 'Never.', why: 'One refund, one charge.' }).id);
    this.gap = null;
  }

  /** @param {string} id */
  passNamed(id) {
    return this.passes.find((pass) => pass.id === id);
  }

  /**
   * The step the way on names, read from the engine as it stands: the land
   * of spec.md as written; else what `waitingOn` names — the person's
   * answer, a pass acknowledged or a finding surfaced, the writer's turn;
   * else a pass; null where it names nothing the walk can take.
   * @param {boolean} issuable whether a pass's brief is issuable @returns {Step|null}
   */
  wayOn(issuable) {
    if (this.written !== this.landed) return ['land', () => this.land()];
    const named = waitingOn(dir, UNIT, []);
    if (named === null) return issuable ? ['pass', () => this.review('pass', [])] : null;
    if (/waits? on the person/.test(named)) return this.gap === null ? null : ['gap answered', () => this.answer()];
    const ack = /^the review's findings wait to be surfaced: (\S+) acknowledged, then/.exec(named);
    const ackPass = ack === null ? undefined : this.passNamed(ack[1]);
    if (ack !== null) return ackPass === undefined ? null : ['ack', () => this.ack(ackPass), ackPass.id];
    const surface = /^the review's findings wait to be surfaced: the (?:gap|fact) (F\d+) of (\S+)/.exec(named);
    const surfacePass = surface === null ? undefined : this.passNamed(surface[2]);
    if (surface !== null) return surfacePass === undefined ? null : ['surface', () => this.surface(surfacePass, surface[1]), surfacePass.id];
    return /^the writer's brief carries/.test(named) ? ['writer brief, landed', () => { this.brief(); this.land(); }] : null;
  }

  /** The events open to the walk now. @returns {Step[]} */
  events() {
    const { issuable, way } = this;
    const taken = this.passes.filter((pass) => pass.state === 'taken');
    const unacknowledged = taken.filter((pass) => pass.acknowledged === null);
    const acknowledged = taken.filter((pass) => pass.acknowledged !== null && !pass.closed);
    /** @type {(Step|null)[]} */
    const open = [
      ['writer brief', () => this.brief()],
      ['writer brief, landed', () => { this.brief(); this.land(); }],
      ['land', () => this.land()],
      ['spec: a statement edited', () => this.edit((shape) => { shape.take += 1; })],
      ['spec: the introduction edited', () => this.edit((shape) => { shape.intro += 1; })],
      ['spec: an area added', () => this.edit((shape) => { shape.extras.push(shape.next); shape.next += 1; })],
      this.shape.extras.length === 0 ? null : ['spec: an area removed', () => this.edit((shape) => { shape.extras.pop(); })],
      ['spec: areas moved', () => this.edit((shape) => { shape.swapped = !shape.swapped; })],
      issuable ? ['pass', () => this.review('pass')] : null,
      issuable ? ['pass, its report malformed', () => this.review('malformed')] : null,
      issuable ? ['pass abandoned, reporting late', () => this.review('abandoned')] : null,
      ...unacknowledged.flatMap((pass) => /** @type {Step[]} */ ([
        ['ack', () => this.ack(pass), pass.id],
        ...(pass.lanes.length === 0 ? [] : /** @type {Step[]} */ ([['ack --clean, refused', () => this.offPath(pass, ['ack', '--clean']), pass.id]])),
        ['incorporate before its ack, refused', () => this.offPath(pass, ['incorporate']), pass.id],
      ])),
      ...acknowledged.map((pass) => /** @type {Step} */ (['incorporate', () => this.incorporate(pass), pass.id])),
      ...acknowledged.flatMap((pass) => {
        const id = this.unsurfaced(pass);
        return id === null ? [] : [/** @type {Step} */ (['surface', () => this.surface(pass, id), pass.id])];
      }),
      ['entry at the spec', () => this.entry()],
      this.made.size === 0 ? null : ['asset linked to an entry at the spec', () => this.link()],
      this.gap === null ? ['gap asked', () => this.ask()] : ['gap answered', () => this.answer()],
      way === null ? null : ['the way on taken', way[1], way[2]],
    ];
    return /** @type {Step[]} */ (open.filter((step) => step !== null));
  }

  /** Each finding of a pass taken in not dealt with, as the walk's own events show, `{pass} F{n} {lane}`. */
  undealt() {
    return this.passes.filter((pass) => pass.state === 'taken').flatMap((pass) => pass.lanes.flatMap((lane, i) => {
      const id = `F${i + 1}`;
      const seen = pass.acknowledged?.has(id) ?? false;
      const dealt = lane === 'rewrite' ? this.seen.passes.has(pass.id) : seen && (pass.surfaced.has(id) || pass.declined);
      return dealt ? [] : [`${pass.id} ${id} ${lane}`];
    }));
  }

  /** Where the loop stands after a step, read once, and the invariants, each breach named with the walk's trail. */
  observe() {
    this.issuable = reviewable();
    this.settled = reviewSettled(dir, UNIT, []);
    this.way = this.wayOn(this.issuable);
    if (!this.settled) {
      assert.notStrictEqual(this.way, null, `open with no way on, ${this.after}`);
      return;
    }
    const latest = this.passes.filter((pass) => pass.state === 'taken').pop();
    const since = latest === undefined ? null : changedSince(printOf(latest.reviewed).sections, this.written);
    assert.deepStrictEqual([...this.made].filter((short) => !this.seen.entries.has(short)), [], `settled with entries no landed brief carried, ${this.after}`);
    assert.deepStrictEqual(this.undealt(), [], `settled with findings not dealt with, ${this.after}`);
    assert.ok(since !== null && since.changed.length + since.removed.length === 0, `settled on a spec the latest pass taken in did not review, ${this.after}`);
  }

  /** @param {Step} step @param {boolean} [drawn] whether the walk drew it at random */
  take([name, run, on], drawn = false) {
    run();
    this.trail.push(on === undefined ? name : `${name} ${on}`);
    if (drawn) covered.events.add(name);
    this.observe();
  }

  run() {
    this.edit(() => {});
    this.brief();
    this.land();
    this.trail.push('writer brief', 'land');
    this.observe();
    let settled = false;
    for (let step = 0; step < STEPS; step += 1) {
      this.take(this.pick(this.events()), true);
      settled ||= this.settled;
    }
    if (settled) covered.settled += 1;
    this.trail.push('| drained:');
    for (let step = 0; step < DRAIN && !this.settled; step += 1) this.take(/** @type {Step} */ (this.way));
    assert.ok(this.settled, `the way on followed did not settle, ${this.after}`);
  }
}

describe('the spec\'s loop, walked (11.7.6, 11.S11, E3)', () => {
  for (const seed of SEEDS) {
    it(`walk ${seed}: never settled with something unread, never open with no way on, settling once the way on is followed`, () => {
      new Walk(seed).run();
    });
  }

  it('the walks take every event, and settle before they are drained', () => {
    assert.deepStrictEqual(EVENTS.filter((event) => !covered.events.has(event)), []);
    assert.ok(covered.settled > 0, 'no walk settled before it was drained');
  });
});
