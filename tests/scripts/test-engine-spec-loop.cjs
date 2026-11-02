'use strict';

// ---------------------------------------------------------------------------
// The spec's loop, walked (leeway-engine/scripts/domain/spec-passes.cjs, the
// loop's states; agent-state.cjs, the store a pass's report is taken in by;
// brief-records.cjs, the briefs that read them): seeded walks of the loop's
// events — the writer's brief, alone or landed; spec.md edited, a statement,
// the introduction, an area added, removed or moved, and landed or left
// written; a pass dispatched, briefed and reported, clean or with findings
// in each lane, its findings' text quoting headings in fenced blocks or not,
// or code inline, its report malformed — a fence among them left open as its
// block quote ends — or abandoned in flight and reporting late with gap and
// fact findings; a pass left running, its owner alive or lost, then
// reporting or abandoned, or its agent returned without writing its report,
// then abandoned; its report acknowledged with its findings,
// acknowledged clean though it holds some or incorporated before its
// acknowledgement, each refused; incorporated once acknowledged; a finding
// surfaced; an entry made at the spec, an asset linked to one, a gap asked
// and answered; the way on taken — each walk then following the way on until
// the review settles. After every step the invariants, each read from the
// events the walk performed and what the briefs carried, never from the
// store's status:
//
// - Never settled with something unread: where ready to build's
//   `review-settled` is done, no pass the walk briefed is still in flight;
//   every entry the walk made at the spec was carried by a writer's brief a
//   land followed; every finding of a pass whose report the walk wrote in
//   the grammar, and did not abandon, is dealt with: a `rewrite` finding's
//   report carried by a writer's brief a land followed, a `gap` or `fact`
//   finding acknowledged by id and then surfaced, or its pass incorporated
//   after that acknowledgement; and the latest such pass reviewed the spec as
//   it stands.
// - A report is refused exactly where the walk wrote it outside the grammar,
//   and neither the way on nor a writer's brief names a pass the walk wrote
//   so, or abandoned.
// - What waits is what the writer is shown: the entries the way on counts,
//   and the passes it names, are those the writer's next brief carries.
// - Never stuck: where it is open, the way on names an action the walk
//   takes, and taken, the store accepts it; followed, it settles. A pass in
//   flight it names as running is one the walk left running with its owner
//   alive — its way out taken where its agent returned without its report —
//   and one it names as lost, one whose owner is not.
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
/** The Claude process a dispatch names as its owner: this one, which runs, or none, never verified alive. */
const OWNERS = Object.freeze({ alive: Object.freeze({ CLAUDE_PID: String(process.pid) }), lost: Object.freeze({ CLAUDE_PID: undefined }) });
/** A finding's lines: its heading, its lane line and its text. @param {string} heading @param {string} lane @param {string[]} [text] */
const finding = (heading, lane, text = ['The spec and the records part here.']) => [heading, '', lane, '', ...text];
/** Each way a report's finding is written in the grammar: plainly, with a measurement and a section quoted, fenced, or with code inline. @type {readonly ((id: string, lane: string) => string[])[]} */
const WELL_FORMED = Object.freeze([
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`, ['Re-run:', '', '```sh', '# count the tables', 'ls tables | wc -l', '```', '', '```markdown', '## 2. Refunds', '', '### 2.1 Where', '```']),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`, ['```npm test```', '', '```ls``` is run']),
]);
/** Each way a report's finding is written outside the grammar. @type {readonly ((id: string, lane: string) => string[])[]} */
const MALFORMED = Object.freeze([
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** \`${lane}\``),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane[0].toUpperCase()}${lane.slice(1)}`),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane**: ${lane}`),
  (id, lane) => finding(`#### ${id}: a ${lane} finding`, `**Lane:** ${lane}`),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`, ['The spec reads:', '', '## 2. Refunds']),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`, ['Re-run:', '', '```sh', '# count the tables']),
  (id, lane) => finding(`### ${id}: a ${lane} finding`, `**Lane:** ${lane}`, ['Re-run:', '', '> ```sh', '> # count the tables']),
]);
/** Every event a walk takes, pinned to occur across the seeds. */
const EVENTS = Object.freeze([
  'writer brief', 'writer brief, landed', 'land', 'spec: a statement edited', 'spec: the introduction edited', 'spec: an area added',
  'spec: an area removed', 'spec: areas moved', 'pass', 'pass, its report malformed', 'pass abandoned, reporting late', 'pass left running',
  'pass lost with its owner', 'pass returned without its report', 'a pass in flight reports', 'a pass in flight abandoned', 'ack', 'ack --clean, refused',
  'incorporate before its ack, refused', 'incorporate', 'surface', 'entry at the spec', 'asset linked to an entry at the spec', 'gap asked',
  'gap answered', 'the way on taken',
]);
/**
 * The walks' seeds, chosen among sixty: together they take every event, one settles before it is drained, and each of the
 * loop's holes put back fails one — a fence opened at inline code (2, 5), one closed unrefused as its block quote ends (42),
 * a finding's fenced text read as headings (30), the section ended at one (10, 42), a running pass with no way out (1, 5,
 * 42), a pass in flight holding nothing (2, 5), a report outside the grammar taken in (1, 42), a take marked at the land
 * (10), every event at the spec counted (30), a surfaced finding waiting still (2, 30, 42), a pass closed in flight taken in
 * as it reports (1, 42), an acknowledgement before the report's ids or none (2). No five do. Since a pass's brief is
 * refused while another runs on its land, a pass in flight is abandoned by 3 alone among them, so 3 joins them.
 */
const SEEDS = Object.freeze([1, 2, 3, 5, 10, 30, 42]);
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
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ candidates: [], builder_calls: [] }));
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
  ...(lanes.length === 0 ? ['None identified.'] : lanes.flatMap((lane, at) => [...form(`F${at + 1}`, lane), ''])),
].join('\n');

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
 * A pass as the walk performed it: its report's file; its findings' lanes;
 * `running` while the walk left it in flight, its owner alive or lost, and
 * whether its agent returned without writing its report; `taken` once the
 * walk wrote its report in the grammar, `ignored` once it wrote it outside
 * or abandoned the pass; the ids the walk acknowledged it with, null before,
 * and surfaced; whether it is closed, and whether the walk closed it after
 * its acknowledgement, declining what it did not surface; and the spec it
 * reviewed.
 * @typedef {{id: string, file: string, lanes: string[], state: 'running'|'taken'|'ignored', owner: 'alive'|'lost', returned: boolean, acknowledged: Set<string>|null, surfaced: Set<string>, closed: boolean, declined: boolean, reviewed: string}} Pass
 */

/** @typedef {'pass'|'malformed'|'abandoned'|'running'|'lost'|'returned'} Dispatch how the walk dispatches a pass, and what becomes of its report */

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
    for (const pass of carried.passes) this.passNamed(pass);
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

  /** @param {Dispatch} kind @param {readonly string[]} [lanes] */
  review(kind, lanes) {
    const owner = kind === 'running' || kind === 'returned' ? 'alive' : 'lost';
    const { id, file } = ok(dir, ['agent', 'dispatch', ...STORE, '--kind', 'spec-review'], { env: OWNERS[owner] });
    ok(dir, ['brief', 'spec-reviewer', UNIT, '--agent', id], { env: SESSION });
    const given = [...(lanes ?? this.pick(kind === 'malformed' ? LANES.slice(2) : kind === 'abandoned' ? LATE : LANES))];
    /** @type {Pass} */
    const pass = {
      id, file, lanes: given, state: 'running', owner, returned: kind === 'returned', acknowledged: null, surfaced: new Set(), closed: false, declined: false, reviewed: this.landed,
    };
    this.passes.push(pass);
    if (kind === 'running' || kind === 'lost' || kind === 'returned') return;
    if (kind === 'abandoned') this.abandon(pass);
    this.report(pass, kind === 'malformed');
  }

  /** A pass's report written, in the grammar or outside it, and a scan, which refuses it exactly where it is written outside. @param {Pass} pass @param {boolean} [malformed] */
  report(pass, malformed = false) {
    fs.writeFileSync(pass.file, `${reportOf(pass.id, pass.lanes, this.pick(malformed ? MALFORMED : WELL_FORMED))}\n`);
    const { refused = [] } = ok(dir, ['agent', 'scan', ...STORE]);
    const isRefused = refused.some((/** @type {{id: string}} */ refusal) => refusal.id === pass.id);
    assert.strictEqual(isRefused, malformed, `the scan ${isRefused ? 'refused' : 'did not refuse'} ${pass.id}, its report written ${malformed ? 'outside' : 'in'} the grammar, ${this.after}`);
    if (pass.state === 'running') pass.state = malformed ? 'ignored' : 'taken';
  }

  /** A pass in flight incorporated, which abandons it. @param {Pass} pass */
  abandon(pass) {
    ok(dir, ['agent', 'incorporate', ...STORE, pass.id]);
    pass.state = 'ignored';
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

  /** The pass in flight a way on names, where the walk left it running with its owner as `owner`; undefined where it did not. @param {string} id @param {'alive'|'lost'} owner */
  inFlight(id, owner) {
    const pass = this.passes.find((left) => left.id === id && left.state === 'running');
    assert.ok(pass === undefined || pass.owner === owner, `the way on names ${id}, whose owner is ${pass?.owner}, as ${owner === 'alive' ? 'running' : 'lost'}, ${this.after}`);
    return pass;
  }

  /** The pass the engine names, never one the walk abandoned or wrote outside the grammar. @param {string} id */
  passNamed(id) {
    const pass = this.passes.find((named) => named.id === id);
    assert.notStrictEqual(pass?.state, 'ignored', `the engine names ${id}, which the walk abandoned or wrote outside the grammar, ${this.after}`);
    return pass;
  }

  /**
   * The step the way on names, read from the engine as it stands: the land
   * of spec.md as written; else what `waitingOn` names — the person's
   * answer, a pass in flight's report or its abandoning, a pass acknowledged
   * or a finding surfaced, the writer's turn; else a pass; null where it
   * names nothing the walk can take.
   * @param {boolean} issuable whether a pass's brief is issuable @returns {Step|null}
   */
  wayOn(issuable) {
    if (this.written !== this.landed) return ['land', () => this.land()];
    const named = waitingOn(dir, UNIT, []);
    if (named === null) return issuable ? ['pass', () => this.review('pass', [])] : null;
    if (/waits? on the person/.test(named)) return this.gap === null ? null : ['gap answered', () => this.answer()];
    const running = /^(\S+) is still running, and the review waits for its report — if its agent has returned without writing its report, agent incorporate abandons it, and another pass is dispatched(?:;|$)/.exec(named);
    const awaited = running === null ? undefined : this.inFlight(running[1], 'alive');
    if (awaited?.returned) return ['a pass in flight abandoned', () => this.abandon(awaited), awaited.id];
    if (running !== null) return awaited === undefined ? null : ['a pass in flight reports', () => this.report(awaited), awaited.id];
    const lost = /^(\S+) was lost with the process that dispatched it, and agent incorporate abandons it(?:;|$)/.exec(named);
    const left = lost === null ? undefined : this.inFlight(lost[1], 'lost');
    if (lost !== null) return left === undefined ? null : ['a pass in flight abandoned', () => this.abandon(left), left.id];
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
    const running = this.passes.filter((pass) => pass.state === 'running');
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
      issuable ? ['pass left running', () => this.review('running')] : null,
      issuable ? ['pass lost with its owner', () => this.review('lost')] : null,
      issuable ? ['pass returned without its report', () => this.review('returned')] : null,
      ...running.flatMap((pass) => /** @type {Step[]} */ ([
        ...(pass.returned ? [] : /** @type {Step[]} */ ([['a pass in flight reports', () => this.report(pass), pass.id]])),
        ['a pass in flight abandoned', () => this.abandon(pass), pass.id],
      ])),
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
    assert.deepStrictEqual(this.passes.filter((pass) => pass.state === 'running').map(({ id }) => id), [], `settled with a pass in flight, ${this.after}`);
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
