'use strict';

// ---------------------------------------------------------------------------
// The spec's loop, walked (leeway-engine/scripts/domain/spec-passes.cjs, the
// loop's states; brief-records.cjs, the briefs that read them): seeded walks
// of the loop's events — the writer's brief, a land with the spec changed or
// not, a pass dispatched, briefed and reported (clean, or with findings in
// each lane, or abandoned before its report lands), its report acknowledged
// clean or with its findings, incorporated, a finding surfaced, an entry made
// at the spec, an asset linked to one, a gap asked and answered, the writer
// re-briefed before a land — and after every step the invariants, each read
// from what the briefs carried rather than from the loop's own records:
//
// - Never settled with something unread: where ready to build's
//   `review-settled` is done, every entry the walk made at the spec was
//   carried by a writer's brief a land followed, and every finding of every
//   reported pass is dealt with — the pass acknowledged clean; a `rewrite`
//   finding's report carried by a writer's brief a land followed; a `gap` or
//   `fact` finding surfaced, or declined by the pass's incorporation.
// - What waits is what the writer is shown: the entries the way on counts
//   are the entries the writer's next brief carries.
// - Never stuck: where it is open, the way on names what it waits for, or a
//   pass's brief is issuable, or `spec.md` reads otherwise than it landed,
//   its land the way on.
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
  ok, call, layout, statePath, writeState, commitAll, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { RECORDS } = require(path.join(SCRIPTS, 'domain/brief-records.cjs'));
const {
  waitingOn, lastLand, changedSince, reviewSettled,
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
const LANES = Object.freeze([[], ['rewrite'], ['gap'], ['fact'], ['rewrite', 'gap']]);
/** The walks' seeds, chosen among sixty so that each of these holes fails at least two: a take recorded at the brief (12, 38, 48) or marked at the land (38, 46), an event other than a current entry counted (38, 42, 46, 48), a gap or a fact finding left to the writer (12, 42). */
const SEEDS = Object.freeze([12, 38, 42, 46, 48]);
const STEPS = 12;

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

/** The spec, its first statement at `take`. @param {number} take */
const spec = (take) => [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '', `1.1.1 Cards take one kind, take ${take}. [${decided.cards}]`, '',
  '## 2. Refunds', '', '### 2.1 Where', '', `2.1.1 Refunds take one kind. [${decided.refunds}]`, '',
].join('\n');

/** A pass's report, its findings one per lane given. @param {string} id @param {string[]} lanes */
const reportOf = (id, lanes) => [
  `# Spec Review — ${id}`, '', '## Findings', '',
  ...(lanes.length === 0 ? ['None identified.'] : lanes.flatMap((lane, at) => [`### F${at + 1}: a ${lane} finding`, '', `**Lane:** ${lane}`, '', 'The spec and the records part here.', ''])),
].join('\n');

/** The section a heading opens in a brief, to the next heading at its level. @param {string} brief @param {string} heading */
function section(brief, heading) {
  const body = brief.slice(brief.indexOf(`\n# ${heading}\n\n`) + heading.length + 5);
  const end = body.search(/\n\n# (?!Spec Review)/);
  return end === -1 ? body : body.slice(0, end);
}

/** Whether `fill` draws a role's gate record without refusing. @param {string} record */
function draws(record) {
  try {
    RECORDS[record].draw({ cwd: dir, role: 'spec-writer', ref: null, task: null, place: null, unit: UNIT, given: {}, session: SESSION_ID }, []);
    return true;
  } catch {
    return false;
  }
}

/**
 * One walk: the world the briefs show, the loop driven through the engine.
 * @typedef {{id: string, file: string, lanes: string[], status: 'pending'|'acknowledged'|'incorporated', clean: boolean, surfaced: Set<string>}} Pass
 */
class Walk {
  /** @param {number} seed */
  constructor(seed) {
    this.random = seeded(seed);
    this.take = 0;
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
  }

  /** @template T @param {T[]} items @returns {T} */
  pick(items) {
    return items[Math.floor(this.random() * items.length)];
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
    assert.strictEqual(carried.entries.size, counted === null ? 0 : Number(counted[1]), `the writer's brief carries other entries than wait for it, after ${this.trail.join(' → ')}`);
    this.pending = carried;
  }

  /** @param {boolean} changed */
  land(changed) {
    if (changed) this.take += 1;
    writeState(dir, SPEC, spec(this.take));
    ok(dir, ['spec', 'land', UNIT]);
    if (this.pending === null) return;
    for (const short of this.pending.entries) this.seen.entries.add(short);
    for (const pass of this.pending.passes) this.seen.passes.add(pass);
    this.pending = null;
  }

  /** @param {boolean} abandoned */
  review(abandoned) {
    const { id, file } = ok(dir, ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'spec-review']);
    ok(dir, ['brief', 'spec-reviewer', UNIT, '--agent', id], { env: SESSION });
    const lanes = this.pick(LANES);
    /** @type {Pass} */
    const pass = { id, file, lanes, status: 'pending', clean: false, surfaced: new Set() };
    if (abandoned) {
      ok(dir, ['agent', 'incorporate', UNIT, 'specification', UNIT, id]);
      pass.status = 'incorporated';
    }
    fs.writeFileSync(file, `${reportOf(id, lanes)}\n`);
    ok(dir, ['agent', 'scan', UNIT, 'specification', UNIT]);
    this.passes.push(pass);
  }

  /** @param {Pass} pass */
  ack(pass) {
    const findings = pass.lanes.map((_, at) => `F${at + 1}`);
    ok(dir, ['agent', 'ack', UNIT, 'specification', UNIT, pass.id, ...(findings.length === 0 ? ['--clean'] : ['--findings', findings.join(',')])]);
    pass.clean = findings.length === 0;
    pass.status = pass.clean ? 'incorporated' : 'acknowledged';
  }

  /** @param {Pass} pass */
  incorporate(pass) {
    ok(dir, ['agent', 'incorporate', UNIT, 'specification', UNIT, pass.id]);
    pass.status = 'incorporated';
  }

  /** @param {Pass} pass */
  surface(pass) {
    const at = pass.lanes.findIndex((lane, i) => lane !== 'rewrite' && !pass.surfaced.has(`F${i + 1}`));
    ok(dir, ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, `F${at + 1}`]);
    pass.surfaced.add(`F${at + 1}`);
    if (pass.lanes.every((_, i) => pass.surfaced.has(`F${i + 1}`))) pass.status = 'incorporated';
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

  /** The events open to the walk now, each with its name. @param {boolean} reviewable whether a pass has a section to read @returns {[string, () => void][]} */
  events(reviewable) {
    const surfaceable = this.passes.filter((pass) => pass.status === 'acknowledged' && pass.lanes.some((lane, i) => lane !== 'rewrite' && !pass.surfaced.has(`F${i + 1}`)));
    return /** @type {[string, (() => void)|null][]} */ ([
      ['writer brief', () => this.brief()],
      ['writer brief, landed unchanged', () => { this.brief(); this.land(false); }],
      ['land changed', () => this.land(true)],
      ['land unchanged', () => this.land(false)],
      ['pass', reviewable ? () => this.review(false) : null],
      ['pass abandoned, reported late', reviewable ? () => this.review(true) : null],
      ...this.passes.filter((pass) => pass.status === 'pending').flatMap((pass) => /** @type {[string, () => void][]} */ ([
        [`ack ${pass.id}`, () => this.ack(pass)],
        [`incorporate ${pass.id}`, () => this.incorporate(pass)],
      ])),
      ...this.passes.filter((pass) => pass.status === 'acknowledged').map((pass) => /** @type {[string, () => void]} */ ([`incorporate ${pass.id}`, () => this.incorporate(pass)])),
      ...surfaceable.map((pass) => /** @type {[string, () => void]} */ ([`surface ${pass.id}`, () => this.surface(pass)])),
      ['entry at the spec', () => this.entry()],
      ['asset linked to an entry at the spec', this.made.size === 0 ? null : () => this.link()],
      ['gap asked', this.gap === null ? () => this.ask() : null],
      ['gap answered', this.gap === null ? null : () => this.answer()],
    ]).filter((event) => event[1] !== null);
  }

  /** Each finding of a reported pass not dealt with, as the briefs and the store show, `{pass} F{n} {lane}`. */
  undealt() {
    return this.passes.filter((pass) => !pass.clean).flatMap((pass) => pass.lanes.flatMap((lane, i) => {
      const dealt = lane === 'rewrite' ? this.seen.passes.has(pass.id) : pass.surfaced.has(`F${i + 1}`) || pass.status === 'incorporated';
      return dealt ? [] : [`${pass.id} F${i + 1} ${lane}`];
    }));
  }

  /** The invariants after a step, each breach named with the walk's trail. @param {boolean} reviewable */
  check(reviewable) {
    const settled = reviewSettled(dir, UNIT, []);
    const trail = this.trail.join(' → ');
    if (settled) {
      const unread = [...this.made].filter((short) => !this.seen.entries.has(short));
      assert.deepStrictEqual(unread, [], `settled with entries no landed brief carried, after ${trail}`);
      assert.deepStrictEqual(this.undealt(), [], `settled with findings not dealt with, after ${trail}`);
      return;
    }
    const land = lastLand(dir, UNIT);
    const since = land === null ? null : changedSince(land.sections, fs.readFileSync(statePath(dir, SPEC), 'utf8'));
    const written = since === null || since.changed.length + since.removed.length > 0;
    assert.ok(reviewable || written || waitingOn(dir, UNIT, []) !== null, `open with no way on, after ${trail}`);
  }

  run() {
    this.brief();
    this.land(true);
    this.trail.push('writer brief', 'land');
    let reviewable = draws('changed-sections');
    for (let step = 0; step < STEPS; step += 1) {
      const [name, event] = this.pick(this.events(reviewable));
      event();
      this.trail.push(name);
      reviewable = draws('changed-sections');
      this.check(reviewable);
    }
  }
}

describe('the spec\'s loop, walked (11.7.6, 11.S11, E3)', () => {
  for (const seed of SEEDS) {
    it(`walk ${seed}: never settled with something unread, never open with no way on`, () => {
      new Walk(seed).run();
    });
  }
});
