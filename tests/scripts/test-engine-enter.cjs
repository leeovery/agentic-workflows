'use strict';

// ---------------------------------------------------------------------------
// The entry (leeway-engine/scripts/domain/enter.cjs): `engine enter <phase>
// <unit> [<topic>] [--take] [--move]`, the one call a phase is entered by,
// discussion its first row and discovery its second. What it refuses, each
// refusal naming its way on and writing nothing — a unit this project lacks
// or has closed, a phase the work type has no place for, and at a
// topic-level row a topic missing, unknown or standing closed, and any topic
// once the unit has its spec (4.11.2); a unit-level row entered at no topic,
// its spec no bar; a place another live session holds asked about first,
// nothing written, and taken over by `--take` (18.4.21, 18.S57); the start
// of a topic not yet started, nothing written ahead of its opening (9.3.1)
// and the start committed, under the writer lock, while a resume takes no
// lock; where the conversation is working, recorded — one topic at a time
// (9.S42) — with its presence; and the answer: any question before the DATA
// naming what to read (2.S13), the reads as paths and engine calls
// (9.3.2–9.3.6, 8.7.7), the topic's own record on a resume (9.S13, 24.S11),
// the agents the topic was left with landed or lost by whether the process
// that dispatched them still runs (9.7.8), and the log with the line the
// conversation opens its first write with, owed until the log names it
// (8.14.8, 9.S67).
//
// Discovery's row (discovery-entry.cjs): the product's conversation and an
// epic's discovery entered with no question (8.S1), a feature, bugfix or
// quick-fix refused for manage (8.S12) and an epic past its spec for the
// product's conversation; the open log carried on, or the next opened and
// committed, the conversation's line written into it where the log's last
// such line is another's (8.S62, 8.S70, 8.S75); the reads — the product's two latest logs, the
// roadmap, the product record and the research owed (8.S69), an epic's older
// logs by their closing lines and two latest in full, its first log's
// pointers, its map and the product record (8.S53) — and a log another
// conversation left named for catch-up, or its transcript gone, and none
// where a level move left it on its pointer (8.S65, 8.S75); and the level move, from the product's conversation, an epic's
// discovery or a topic, its pointer, its sitting and its presence (8.S71,
// 8.S72, 24.S20). The label the entry applies is `session label`'s own
// (test-engine-session-label.cjs), and the recovery note
// test-engine-position.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds a topic for each standing — `onboarding` with its brief and not yet
// started, `licence` under way with agents a process now gone dispatched,
// `sync` decided, `export` promoted, `removal` cancelled, `widgets` postponed
// with its roadmap item waiting, `reports` postponed with its item gone to
// another epic — a spike, and four discovery logs, the fourth open, the
// first pointing into the product's sessions; an epic, `atlas`, with none;
// an epic past its spec; the product's conversation with two logs and none
// open; a feature, `quick-sync`, with discovery's log and a seed; a feature
// with its spec; a bugfix; a quick-fix; and a cancelled and a completed unit.
// Each test's conversation has its own system config, and its own Claude
// Code config holding its transcript.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, stateGit, lastMessage, fixtureFrom, cleanupFixture,
  lockAttempts, holdLock, withFrozenClock, withEnv, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { entrySections } = require('../../skills/leeway-engine/scripts/domain/projections/enter.cjs');
const { ENTRIES, enterThrough } = require('../../skills/leeway-engine/scripts/domain/enter.cjs');
const { SHAPED_BY } = require('../../skills/leeway-engine/scripts/domain/discovery-entry.cjs');

const EPIC = 'fumi';
const ATLAS = 'atlas';
const FEATURE = 'quick-sync';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const USAGE = 'Usage: engine enter <discussion|discovery> <work-unit|product> [<topic>] [--take] [--move]';
const TODAY = FROZEN_AT.slice(0, 10);

// A process that no longer runs, and one that does that is not this suite's.
const GONE = '2147483646';
const PEER = String(process.ppid);

/** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...marks });

/** A roadmap item a topic of the epic was postponed as. @param {string} topic @param {Record<string, unknown>} [marks] */
const postponedAs = (topic, marks = {}) => ({ horizon: 'next', summary: topic, origin: `postpone:${EPIC}`, postponed_from: { work_unit: EPIC, topic }, ...marks });

/** An engine call as the process `pid` and conversation `sessionId` run it. @param {string} dir @param {string[]} args @param {string} sessionId @param {string} pid */
function runAs(dir, args, sessionId, pid) {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-other-'));
  try {
    return ok(dir, args, { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: sessionId, CLAUDE_PID: pid, TMUX: undefined } });
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
}

const world = fixtureFrom('engine-enter-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: {
        active_session: '004',
        items: {
          onboarding: row(1), licence: row(2), sync: row(3), export: row(4),
          removal: row(5, { cancelled: true }), widgets: row(6, { postponed: true }), reports: row(7, { postponed: true }),
        },
      },
      discussion: {
        items: {
          licence: { status: 'in-progress' }, sync: { status: 'completed' }, export: { status: 'promoted', promoted_to: 'portability' },
          removal: { status: 'cancelled' }, widgets: { status: 'postponed' }, reports: { status: 'postponed' },
        },
      },
    },
  });
  const project = JSON.parse(readState(dir, layout.projectManifest));
  project.roadmap = { horizons: ['next'], items: { widgets: postponedAs('widgets'), reports: postponedAs('reports', { pulled_to: { work_unit: 'other', topic: 'reports' } }) } };
  writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
  writeState(dir, layout.brief(EPIC, 'onboarding'), '# Onboarding\n');
  writeState(dir, layout.unit(EPIC, 'spikes', '001-first-run', 'sketch.md'), '# Sketch\n');
  createManifest(dir, FEATURE, { seeds: [{ path: 'seeds/idea.md', source: 'inbox:idea', seeded_at: '2026-01-01T00:00:00Z' }] });
  writeState(dir, layout.session(FEATURE, '001'), '# Discovery Session 001\n');
  writeState(dir, layout.unit(FEATURE, 'seeds', 'idea.md'), '# Idea\n');
  createManifest(dir, 'specced');
  writeState(dir, layout.unit('specced', 'spec.md'), '# Spec\n');
  createManifest(dir, 'crash', { work_type: 'bugfix' });
  createManifest(dir, 'tweak', { work_type: 'quick-fix' });
  createManifest(dir, 'retired', { work_type: 'epic', status: 'cancelled' });
  createManifest(dir, 'shipped', { status: 'completed' });
  createManifest(dir, ATLAS, { work_type: 'epic' });
  createManifest(dir, 'built', { work_type: 'epic' });
  writeState(dir, layout.unit('built', 'spec.md'), '# Spec\n');
  writeState(dir, layout.session(EPIC, '001'), `${SHAPED_BY}[Pricing](../../.product/sessions/session-001.md#pricing)\n\n## 2026-01-02 · session one\n\nThe map took shape.\n\nLicensing comes first.\n`);
  writeState(dir, layout.session(EPIC, '002'), '## 2026-01-03 · session two\n\nSync came up.\n\nSync waits on licensing.\n\n→ Carried on in the product\'s conversation: [session-002.md](../../.product/sessions/session-002.md)\n');
  writeState(dir, layout.session(EPIC, '003'), '## 2026-01-04 · session three\n\nExports.\n');
  writeState(dir, layout.session(EPIC, '004'), '## 2026-01-05 · session four\n\nWhere it stands.\n');
  writeState(dir, layout.productSession('001'), '## 2026-01-01 · session first\n\nWhat the product is.\n');
  writeState(dir, layout.productSession('002'), '## 2026-01-02 · session second\n\nPricing.\n');
  commitAll(dir, 'the world');
  for (const label of ['landed', 'lost']) runAs(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', label], 'earlier', GONE);
  writeState(dir, layout.cache(EPIC, 'discussion', 'licence', 'deep-dive-001-landed.md'), '# Findings\n');
});

let dir; // the project
let config; // the system config: the conversations' folders
let claude; // Claude Code's config: the transcripts

/** The engine as the conversation `sessionId` runs it — null runs it with no id. @param {string|null} [sessionId] */
function env(sessionId = 'sess-1') {
  return {
    LEEWAY_CONFIG_DIR: config, CLAUDE_CONFIG_DIR: claude, CLAUDE_CODE_SESSION_ID: sessionId ?? undefined,
    CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined,
  };
}

/** An entry that must succeed: its response and its sections. @param {string[]} args @param {string|null} [sessionId] */
function enter(args, sessionId) {
  return okSections(dir, ['enter', ...args], { env: env(sessionId) });
}

/** An entry that must refuse, writing nothing: its error. @param {string[]} args */
function refused(args) {
  const { error } = refusedPristine(dir, ['enter', ...args], { env: env() });
  assert.strictEqual(position(), null, `engine enter ${args.join(' ')} recorded a position on refusing`);
  return error;
}

/** The position recorded for a conversation, or null. @param {string} [sessionId] */
function position(sessionId = 'sess-1') {
  try { return JSON.parse(fs.readFileSync(path.join(config, 'conversations', sessionId, 'position.json'), 'utf8')); } catch { return null; }
}

/** A conversation's transcript, where Claude Code keeps it. @param {string} sessionId */
function transcript(sessionId) {
  const file = path.join(claude, 'projects', '-Users-person-fumi', `${sessionId}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  return file;
}

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
function data(lines) {
  return `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;
}

/** A path in the state, absolute. @param {string} rel */
const at = (rel) => statePath(dir, rel);

/** A place's presence record as it stands, or null. @param {string} unit @param {string} topic @param {string} [phase] */
function presence(unit, topic, phase = 'discussion') {
  try { return JSON.parse(fs.readFileSync(at(layout.cache(unit, phase, topic, 'presence')), 'utf8')); } catch { return null; }
}

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-config-'));
  claude = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-claude-'));
});

afterEach(() => {
  cleanupFixture(dir);
  for (const d of [config, claude]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a call that is no entry: a phase not entered through it, a missing unit, an empty topic, a flag it lacks, an extra argument, a move into a row that takes none, a flag twice', () => {
    for (const args of [
      ['research', EPIC, 'onboarding'], ['discussion'], ['discussion', EPIC, ''], ['discussion', EPIC, '--force'], ['discussion', EPIC, 'onboarding', 'more'],
      ['discussion', EPIC, 'onboarding', '--move'], ['discovery', 'product', '--take', '--take'],
    ]) {
      assert.strictEqual(refused(args), USAGE, args.join(' '));
    }
  });

  it('a unit this project lacks, one cancelled and one completed', () => {
    assert.deepStrictEqual([refused(['discussion', 'nowhere']), refused(['discussion', 'retired', 'any']), refused(['discussion', 'shipped'])], [
      'there is no work unit "nowhere" — the start menu lists the work in progress',
      'retired is cancelled — reactivating it comes first',
      'shipped is completed — new work starts from the start menu',
    ]);
  });

  it('a phase the unit\'s work type has no place for', () => {
    assert.strictEqual(refused(['discussion', 'crash']), 'a bugfix has no discussion — its phases are investigation, specification, planning, implementation, review');
  });

  it('a topic missing from an epic, not a legal name, or not the unit\'s', () => {
    assert.deepStrictEqual([refused(['discussion', EPIC]), refused(['discussion', EPIC, 'a.b']), refused(['discussion', FEATURE, 'a.b']), refused(['discussion', EPIC, 'nowhere']), refused(['discussion', FEATURE, 'other'])], [
      `an epic enters discussion at one of its topics — name the topic: engine enter discussion ${EPIC} <topic>`,
      '"a.b" is not a legal topic name — dots and slashes break manifest addressing; the epic\'s map holds its topics, and a new one comes through its discovery',
      '"a.b" is not a legal topic name — dots and slashes break manifest addressing; a feature\'s topic is the unit itself',
      `${EPIC} has no topic "nowhere" — the epic's map holds its topics, and a new one comes through its discovery`,
      `${FEATURE} has no topic "other" — a feature's topic is the unit itself`,
    ]);
  });

  it('any topic once the unit has its spec — a topic exists only before it (4.11.2)', () => {
    assert.strictEqual(refused(['discussion', 'specced']), 'specced has its spec — a topic exists only before it, and a change is settled in the spec from here');
  });

  it('a topic standing closed: cancelled, postponed — its roadmap item waiting or gone to another epic — promoted out of the unit, decided', () => {
    const through = 'the epic menu\'s discovery row';
    assert.deepStrictEqual(['removal', 'widgets', 'reports', 'export', 'sync'].map((topic) => refused(['discussion', EPIC, topic])), [
      `the topic "removal" is cancelled — reactivating it goes through ${through}`,
      `the topic "widgets" is postponed to the roadmap — pulling it forward goes through ${through}`,
      'the topic "reports" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back',
      'the topic "export" was promoted to "portability" — it carries on there',
      `the topic "sync" is decided — it reopens through a message sent to it, or through ${through}`,
    ]);
  });

  it('a start the topic\'s own rules refuse leaves no position and no presence behind', () => {
    const refusing = { discussion: { ...ENTRIES.discussion, start: () => { throw new Error('the start refuses'); } } };
    assert.throws(() => withEnv(env(), () => enterThrough(refusing, dir, ['discussion', EPIC, 'onboarding'])), { message: 'the start refuses' });
    assert.strictEqual(position(), null, 'no position');
    assert.strictEqual(presence(EPIC, 'onboarding'), null, 'no presence beat');
  });
});

describe('a phase entered at the work unit', () => {
  /** A unit-level row, in this suite alone: it starts by marking the unit's manifest. */
  const UNIT = Object.freeze({
    specification: {
      level: /** @type {'unit'} */ ('unit'),
      standing: () => null,
      unstarted: (/** @type {{manifest: Record<string, any>}} */ { manifest }) => manifest.description !== 'started',
      start: (/** @type {string} */ cwd, /** @type {string} */ unit) => {
        writeState(cwd, layout.manifest(unit), JSON.stringify({ ...readManifest(cwd, unit), description: 'started' }, null, 2));
      },
      questions: () => [],
      reads: () => [],
      log: (/** @type {{unit: string}} */ { unit }) => `${unit}/log.md`,
    },
  });

  /** An entry through the unit-level table, in this process as the conversation runs it. @param {string[]} args */
  const enterUnit = (args) => withEnv(env(), () => enterThrough(UNIT, dir, args));

  it('enters at no topic once the spec exists, its start committed under the unit, the place the unit itself', () => {
    const { response } = enterUnit(['specification', 'specced']);
    assert.deepStrictEqual(response, { phase: 'specification', unit: 'specced', entered: true, started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(lastMessage(dir), 'specification(specced): start');
    assert.deepStrictEqual(position(), { name: 'specced', phase: 'specification', topic: 'specced' });
  });

  it('refuses a topic named, naming the call that enters it', () => {
    assert.throws(() => enterUnit(['specification', EPIC, 'onboarding']), { message: `specification is entered at the work unit — name no topic: engine enter specification ${EPIC}` });
    assert.strictEqual(position(), null);
  });
});

describe('a place another live session holds (18.4.21)', () => {
  it('asks first, naming when that session was last active, and writes nothing — no start, no position, its hold left as it stands', () => {
    runAs(dir, ['presence', 'beat', EPIC, 'discussion', 'onboarding'], 'peer', PEER);
    const held = presence(EPIC, 'onboarding');
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter(['discussion', EPIC, 'onboarding']);
    assert.deepStrictEqual(res, { ok: true, phase: 'discussion', unit: EPIC, topic: 'onboarding', entered: false });
    assert.match(sections, /^=== MENU: held topic gate /);
    assert.match(sections, /"Onboarding" is open in another session — last active \d+s ago\./);
    assert.doesNotMatch(sections, /=== DATA/);
    assert.deepStrictEqual([readManifest(dir, EPIC).phases.discussion.items.onboarding, stateGit(dir, ['rev-parse', 'HEAD']).trim(), position(), presence(EPIC, 'onboarding')], [undefined, head, null, held]);
  });

  it('proceeding is the entry again with --take, which takes the hold and enters; leaving it goes back to the epic\'s menu', () => {
    runAs(dir, ['presence', 'beat', EPIC, 'discussion', 'onboarding'], 'peer', PEER);
    enter(['discussion', EPIC, 'onboarding']);
    const { next } = ok(dir, ['gate', 'held topic gate', '--pick', 'y'], { env: env() });
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['enter', 'discussion', EPIC, 'onboarding', '--take'] });
    const { res } = enter(next.argv.slice(1));
    assert.deepStrictEqual([res.entered, res.started, presence(EPIC, 'onboarding')?.session_id, position()], [true, true, 'sess-1', { name: EPIC, phase: 'discussion', topic: 'onboarding' }]);
    enter(['discussion', EPIC, 'licence']);
    runAs(dir, ['presence', 'beat', EPIC, 'discussion', 'licence'], 'peer', PEER);
    enter(['discussion', EPIC, 'licence']);
    assert.deepStrictEqual(ok(dir, ['gate', 'held topic gate', '--pick', 'n'], { env: env() }).next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [EPIC] });
  });

  it('a single-topic unit has no menu to go back to: leaving it carries on, to the end of the turn', () => {
    runAs(dir, ['presence', 'beat', FEATURE, 'discussion', FEATURE], 'peer', PEER);
    assert.strictEqual(enter(['discussion', FEATURE]).res.entered, false);
    assert.deepStrictEqual(ok(dir, ['gate', 'held topic gate', '--pick', 'n'], { env: env() }).next, { kind: 'continue' });
  });

  it('a hold of this conversation\'s own, or of a process gone, asks nothing', () => {
    enter(['discussion', EPIC, 'licence']);
    assert.strictEqual(enter(['discussion', EPIC, 'licence']).res.entered, true);
    runAs(dir, ['presence', 'beat', EPIC, 'discussion', 'licence'], 'peer', GONE);
    assert.strictEqual(enter(['discussion', EPIC, 'licence']).res.entered, true);
  });
});

describe('a topic not yet started', () => {
  it('starts it and commits the start, writing nothing ahead of its opening (9.3.1)', () => {
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res } = enter(['discussion', EPIC, 'onboarding']);
    assert.deepStrictEqual(res, {
      ok: true, phase: 'discussion', unit: EPIC, topic: 'onboarding', entered: true, started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
    });
    assert.deepStrictEqual(readManifest(dir, EPIC).phases.discussion.items.onboarding, { status: 'in-progress' });
    assert.strictEqual(lastMessage(dir), `discussion(${EPIC}): start onboarding`);
    assert.deepStrictEqual(stateGit(dir, ['diff', '--name-only', before, 'HEAD']).trim().split('\n'), [layout.manifest(EPIC)]);
    assert.deepStrictEqual(fs.readdirSync(at(layout.topic(EPIC, 'onboarding'))), ['brief.md'], 'nothing under the topic\'s folder but its brief');
  });

  it('holds the writer lock around the start: a live holder keeps the topic unstarted until it lets go', (t) => {
    const lock = holdLock(at(layout.lock));
    /** @type {unknown[]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(readManifest(dir, EPIC).phases.discussion.items.onboarding);
      fs.unlinkSync(lock);
    });
    enter(['discussion', EPIC, 'onboarding']);
    assert.deepStrictEqual([attempts, whileHeld], [['taken', 'made'], [undefined]]);
  });

  it('a feature\'s topic is the unit itself, named or not', () => {
    assert.strictEqual(enter(['discussion', FEATURE]).res.topic, FEATURE);
    assert.deepStrictEqual(enter(['discussion', FEATURE, FEATURE]).res, { ok: true, phase: 'discussion', unit: FEATURE, topic: FEATURE, entered: true, started: false });
  });
});

describe('a topic under way', () => {
  it('resumes it, taking no lock and committing nothing', (t) => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const attempts = lockAttempts(t, holdLock(at(layout.lock)), () => {
      throw new Error('the resume tried the writer lock');
    });
    assert.deepStrictEqual(enter(['discussion', EPIC, 'licence']).res, { ok: true, phase: 'discussion', unit: EPIC, topic: 'licence', entered: true, started: false });
    assert.deepStrictEqual([attempts, stateGit(dir, ['rev-parse', 'HEAD']).trim()], [[], head]);
  });
});

describe('where the conversation is working', () => {
  it('records the position at the topic, and moves it when another topic is entered — one topic at a time (9.S42)', () => {
    enter(['discussion', EPIC, 'onboarding']);
    assert.deepStrictEqual(position(), { name: EPIC, phase: 'discussion', topic: 'onboarding' });
    enter(['discussion', EPIC, 'licence']);
    assert.deepStrictEqual(position(), { name: EPIC, phase: 'discussion', topic: 'licence' });
  });

  it('beats the topic\'s presence as this process\'s', () => {
    enter(['discussion', EPIC, 'licence']);
    assert.deepStrictEqual(ok(dir, ['presence', 'scan', EPIC], { env: env() }).sessions.map((s) => [s.phase, s.topic, s.held, s.session_id, s.pid]), [['discussion', 'licence', true, 'sess-1', process.pid]]);
  });
});

describe('the answer', () => {
  it('any question comes before the DATA naming what to read (2.S13)', () => {
    const question = '=== DISPLAY: mail (emit verbatim as markdown) ===\n1 message waiting\n';
    assert.strictEqual(entrySections([question], [['log', '/a/log.md']]), `${question}${data(['log: /a/log.md'])}`);
  });

  it('an opening reads the brief, the record of each topic decided so far, the product record with what discovery found of the product, the unit and the topic, and the unit\'s spikes, then names the log (9.3.6, 9.3.12)', () => {
    transcript('sess-1');
    const { sections } = withFrozenClock(() => enter(['discussion', EPIC, 'onboarding']));
    assert.strictEqual(sections, data([
      `brief: ${at(layout.brief(EPIC, 'onboarding'))}`,
      `decided: \`${ENGINE} ledger record ${EPIC} export\``,
      `decided: \`${ENGINE} ledger record ${EPIC} sync\``,
      `product: \`${ENGINE} ledger product ${EPIC} onboarding\``,
      `spike: ${at(layout.unit(EPIC, 'spikes', '001-first-run'))}`,
      `log: ${at(layout.topic(EPIC, 'onboarding', 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1 · transcript ${path.join(claude, 'projects', '-Users-person-fumi', 'sess-1.jsonl')}`,
    ]));
  });

  it('a unit\'s one topic reads discovery\'s log and the unit\'s seeds (8.7.7)', () => {
    const { sections } = withFrozenClock(() => enter(['discussion', FEATURE]));
    assert.strictEqual(sections, data([
      `discovery log: ${at(layout.session(FEATURE, '001'))}`,
      `seed: ${at(layout.unit(FEATURE, 'seeds', 'idea.md'))}`,
      `product: \`${ENGINE} ledger product ${FEATURE} ${FEATURE}\``,
      `log: ${at(layout.topic(FEATURE, FEATURE, 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1`,
    ]));
  });

  it('a resume adds the topic\'s own record, its map and the entries a replacement changed under it, and the agents a process now gone left: the report landed since, the agent lost with it — one of its own still running neither (9.S13, 24.S11, 9.3.6, 9.7.8)', () => {
    ok(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', 'mine'], { env: env() });
    const { sections } = withFrozenClock(() => enter(['discussion', EPIC, 'licence']));
    assert.strictEqual(sections, data([
      `decided: \`${ENGINE} ledger record ${EPIC} export\``,
      `decided: \`${ENGINE} ledger record ${EPIC} sync\``,
      `product: \`${ENGINE} ledger product ${EPIC} licence\``,
      `spike: ${at(layout.unit(EPIC, 'spikes', '001-first-run'))}`,
      `record: \`${ENGINE} ledger record ${EPIC} licence\``,
      `map: \`${ENGINE} ledger map ${EPIC} licence\``,
      `affected: \`${ENGINE} ledger affected ${EPIC} licence\``,
      `landed: ${at(layout.cache(EPIC, 'discussion', 'licence', 'deep-dive-001-landed.md'))}`,
      'lost: deep-dive-002-lost',
      `log: ${at(layout.topic(EPIC, 'licence', 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1`,
    ]));
  });

  it('a topic with mail waiting opens on it: each message headed by the line naming its sender, its title over the rest, raised before anything is read, and named first in what to read (10.S3, 10.4.2, 2.S18)', () => {
    writeState(dir, layout.mailbox(EPIC, 'licence', '001-lost-key.md'), '# The licence window carries a "Lost your key?" link\nFrom Commercialization · 16 Oct\n\n↳ Their reasoning: a new Mac has no key to hand.\n');
    writeState(dir, layout.mailbox(EPIC, 'licence', '002-trial.md'), 'A trial runs fourteen days\nFrom Onboarding · 17 Oct\n');
    const { sections } = enter(['discussion', EPIC, 'licence']);
    const [mail, reads] = sections.split(/(?==== DATA )/);
    assert.strictEqual(mail, [
      '=== DISPLAY: waiting mail (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '2 messages waiting — raised before anything else',
      '',
      'From Commercialization · 16 Oct',
      'The licence window carries a "Lost your key?" link',
      '  ↳ Their reasoning: a new Mac has no key to hand.',
      '',
      'From Onboarding · 17 Oct',
      'A trial runs fourteen days',
      '',
    ].join('\n'));
    assert.deepStrictEqual(reads.split('\n').slice(1, 3), [
      `mail: ${at(layout.mailbox(EPIC, 'licence', '001-lost-key.md'))}`, `mail: ${at(layout.mailbox(EPIC, 'licence', '002-trial.md'))}`,
    ]);
  });

  it('a conversation resumed under its own session id, the process that dispatched its agent gone: the agent is lost', () => {
    runAs(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', 'crashed'], 'sess-1', GONE);
    assert.match(enter(['discussion', EPIC, 'licence']).sections, /^lost: deep-dive-003-crashed$/m);
  });

  it('a live peer\'s agents are its own: neither landed nor lost', () => {
    for (const label of ['running', 'reported']) runAs(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', label], 'peer', PEER);
    writeState(dir, layout.cache(EPIC, 'discussion', 'licence', 'deep-dive-004-reported.md'), '# Findings\n');
    const { sections } = enter(['discussion', EPIC, 'licence', '--take']);
    assert.deepStrictEqual(sections.match(/^(landed|lost): .*$/gm), [`landed: ${at(layout.cache(EPIC, 'discussion', 'licence', 'deep-dive-001-landed.md'))}`, 'lost: deep-dive-002-lost']);
  });

  it('a report already read in is neither landed nor lost', () => {
    ok(dir, ['agent', 'scan', EPIC, 'discussion', 'licence'], { env: env() });
    ok(dir, ['agent', 'ack', EPIC, 'discussion', 'licence', 'deep-dive-001-landed', '--clean'], { env: env() });
    assert.doesNotMatch(enter(['discussion', EPIC, 'licence']).sections, /^landed:/m);
  });

  it('the log\'s header line is owed until the log\'s last conversation line is the conversation\'s own, again once another has written since, and each conversation is owed its own (9.S67)', () => {
    const header = (/** @type {string|null} */ sessionId) => enter(['discussion', EPIC, 'licence'], sessionId).sections.match(/^log header: (.*)$/m)?.[1] ?? null;
    const first = withFrozenClock(() => header('sess-1'));
    assert.strictEqual(first, `## ${TODAY} · session sess-1`);
    writeState(dir, layout.topic(EPIC, 'licence', 'log.md'), `${first}\n\nWhat we talked about.\n`);
    assert.strictEqual(header('sess-1'), null, 'the log names the conversation');
    const second = withFrozenClock(() => header('sess-2'));
    assert.strictEqual(second, `## ${TODAY} · session sess-2`);
    fs.appendFileSync(at(layout.topic(EPIC, 'licence', 'log.md')), `\n${second}\n\nMore of it.\n`);
    assert.strictEqual(withFrozenClock(() => header('sess-1')), `## ${TODAY} · session sess-1`, 'another conversation having written since, the line is owed again');
    assert.strictEqual(header(null), null, 'no session id names none');
  });
});

/** The project manifest, with `fields` set over what it holds. @param {Record<string, unknown>} fields */
function project(fields) {
  writeState(dir, layout.projectManifest, JSON.stringify({ ...JSON.parse(readState(dir, layout.projectManifest)), ...fields }, null, 2));
}

/** The files the state's last commit touched, sorted. */
function committedFiles() {
  return stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
}

/** The state's head, short. */
const shortHead = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

/** A level move that must refuse, writing nothing and leaving the position where it was: its error. @param {string[]} args */
function moveRefused(args) {
  const before = position();
  const { error } = refusedPristine(dir, ['enter', ...args], { env: env() });
  assert.deepStrictEqual(position(), before, `engine enter ${args.join(' ')} moved the position on refusing`);
  return error;
}

describe('discovery: what cannot be entered (8.6.5, 8.2.11)', () => {
  it('a feature, a bugfix or a quick-fix, whose discovery ended at start this work: manage is the way back (8.S12)', () => {
    const ended = 'its discovery ended at start this work, and reopening its decision goes through manage on the start menu';
    assert.deepStrictEqual([FEATURE, 'crash', 'tweak'].map((unit) => refused(['discovery', unit])), [
      `${FEATURE} is a feature — ${ended}`, `crash is a bugfix — ${ended}`, `tweak is a quick-fix — ${ended}`,
    ]);
  });

  it('an epic past its spec, entered or moved to: its talk belongs in the product\'s conversation (8.S71)', () => {
    const closed = 'built has its spec, so its map is closed — talk about it belongs in the product\'s conversation, where what comes of it lands as roadmap items: engine enter discovery product';
    assert.deepStrictEqual([refused(['discovery', 'built']), refused(['discovery', 'built', '--move'])], [closed, closed]);
  });

  it('a topic named, at the product or an epic; and a row the product does not enter reads it as no unit', () => {
    assert.deepStrictEqual([refused(['discovery', 'product', 'pricing']), refused(['discovery', EPIC, 'onboarding']), refused(['discussion', 'product', 'pricing'])], [
      'discovery is entered at the product — name no topic: engine enter discovery product',
      `discovery is entered at the work unit — name no topic: engine enter discovery ${EPIC}`,
      'there is no work unit "product" — the start menu lists the work in progress',
    ]);
  });
});

describe('discovery: the product\'s conversation (8.2.7–8.2.10)', () => {
  it('a first entry opens the next session and commits it, writes the conversation\'s line into its log, and reads the two latest logs, the roadmap, the product record and whether research is owed, with no question first (8.S1, 8.S69, 8.S75)', () => {
    const file = transcript('sess-1');
    const { res, sections } = withFrozenClock(() => enter(['discovery', 'product']));
    assert.deepStrictEqual(res, { ok: true, phase: 'discovery', unit: 'product', entered: true, started: true, committed: shortHead() });
    assert.deepStrictEqual([lastMessage(dir), committedFiles()], ['discovery(product): start', [layout.productSession('003'), layout.projectManifest].sort()]);
    assert.strictEqual(JSON.parse(readState(dir, layout.projectManifest)).product_session, '003');
    assert.strictEqual(readState(dir, layout.productSession('003')), `## ${TODAY} · session sess-1 · transcript ${file}\n`);
    assert.strictEqual(sections, data([
      `session log: ${at(layout.productSession('001'))}`,
      `session log: ${at(layout.productSession('002'))}`,
      `roadmap: \`${ENGINE} roadmap state\``,
      `product: \`${ENGINE} ledger product\``,
      'research owed: no',
      `log: ${at(layout.productSession('003'))}`,
    ]));
    assert.deepStrictEqual([position(), presence('product', 'product', 'discovery')?.session_id], [{ name: 'product' }, 'sess-1']);
    assert.ok(!fs.existsSync(at('product')), 'the product has no unit');
  });

  it('research is owed while the brownfield offer is accepted (8.12.13)', () => {
    project({ brownfield_offer: 'accepted' });
    assert.match(enter(['discovery', 'product']).sections, /^research owed: yes$/m);
  });

  it('a return carries on in the open log — nothing opened, committed or moved on — adding the new conversation\'s line, and names the conversation that left the log for catch-up from its transcript (8.S62, 8.S65, 8.S70)', () => {
    const first = transcript('sess-1');
    withFrozenClock(() => enter(['discovery', 'product']));
    fs.appendFileSync(at(layout.productSession('003')), '\nPricing tiers, leaning three.\n');
    const [head, manifest] = [stateGit(dir, ['rev-parse', 'HEAD']).trim(), readState(dir, layout.projectManifest)];
    const { res, sections } = withFrozenClock(() => enter(['discovery', 'product'], 'sess-2'));
    assert.deepStrictEqual(res, { ok: true, phase: 'discovery', unit: 'product', entered: true, started: false });
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), readState(dir, layout.projectManifest), fs.existsSync(at(layout.productSession('004')))], [head, manifest, false]);
    assert.strictEqual(readState(dir, layout.productSession('003')), `## ${TODAY} · session sess-1 · transcript ${first}\n\nPricing tiers, leaning three.\n\n## ${TODAY} · session sess-2\n`);
    assert.strictEqual(sections, data([
      `session log: ${at(layout.productSession('002'))}`,
      `session log: ${at(layout.productSession('003'))}`,
      `roadmap: \`${ENGINE} roadmap state\``,
      `product: \`${ENGINE} ledger product\``,
      'research owed: no',
      `catch up: read ${first} from the log's last write onward, and add to the log what it is missing`,
      `log: ${at(layout.productSession('003'))}`,
    ]));
  });

  it('the conversation that last wrote the log, entering again, writes no second line and has nothing to catch up', () => {
    enter(['discovery', 'product']);
    const log = readState(dir, layout.productSession('003'));
    assert.doesNotMatch(enter(['discovery', 'product']).sections, /^catch up:/m);
    assert.strictEqual(readState(dir, layout.productSession('003')), log);
  });

  it('a conversation entering again after another wrote takes its line again, so the log\'s last line names its last writer and the next conversation catches up from that one (8.14.8, 8.S65)', () => {
    const log = at(layout.productSession('003'));
    const turns = [['A', 'A wrote.'], ['B', 'B wrote.'], ['A', 'A wrote again, last.']];
    for (const [sessionId, line] of turns) {
      enter(['discovery', 'product'], sessionId);
      fs.appendFileSync(log, `\n${line}\n`);
    }
    const caughtUp = (/** @type {string} */ sessionId) => enter(['discovery', 'product'], sessionId).sections.match(/^catch up: the transcript of session (\S+),/m)?.[1];
    assert.deepStrictEqual([caughtUp('B'), caughtUp('C')], ['A', 'B']);
    assert.deepStrictEqual(readState(dir, layout.productSession('003')).match(/^## .* · session \S+/gm)?.map((line) => line.split(' ').at(-1)), ['A', 'B', 'A', 'B', 'C']);
  });

  it('a log left by a conversation whose transcript is gone: one line says so (8.S75)', () => {
    enter(['discovery', 'product'], 'sess-gone');
    assert.match(enter(['discovery', 'product']).sections,
      /^catch up: the transcript of session sess-gone, which last wrote the log, is gone — say so in one line, and carry on from the log$/m);
  });

  it('another live session holding it is asked about first; the yes is the entry again with --take, a move kept a move, and leaving it carries on, the product having no menu (18.4.21)', () => {
    runAs(dir, ['presence', 'beat', 'product', 'discovery', 'product'], 'peer', PEER);
    const { res, sections } = enter(['discovery', 'product']);
    assert.deepStrictEqual([res.entered, /^=== MENU: held topic gate /.test(sections), position()], [false, true, null]);
    assert.deepStrictEqual(ok(dir, ['gate', 'held topic gate', '--pick', 'y'], { env: env() }).next, { kind: 'engine', argv: ['enter', 'discovery', 'product', '--take'] });
    enter(['discovery', 'product']);
    assert.deepStrictEqual(ok(dir, ['gate', 'held topic gate', '--pick', 'n'], { env: env() }).next, { kind: 'continue' });
    enter(['discovery', EPIC]);
    enter(['discovery', 'product', '--move']);
    assert.deepStrictEqual(ok(dir, ['gate', 'held topic gate', '--pick', 'y'], { env: env() }).next.argv, ['enter', 'discovery', 'product', '--take', '--move']);
  });
});

describe('discovery: an epic\'s (8.6.7)', () => {
  it('four logs, the fourth open: the older two by their closing lines, the latest two in full, the first log\'s pointers into the product\'s sessions, the map and the product record; the open log carried on, and the conversation that last wrote it named for catch-up (8.S53, 8.S62)', () => {
    const four = transcript('four');
    const { res, sections } = withFrozenClock(() => enter(['discovery', EPIC]));
    assert.deepStrictEqual(res, { ok: true, phase: 'discovery', unit: EPIC, entered: true, started: false });
    assert.strictEqual(sections, data([
      `older log: ${at(layout.session(EPIC, '001'))} — Licensing comes first.`,
      `older log: ${at(layout.session(EPIC, '002'))} — Sync waits on licensing.`,
      `session log: ${at(layout.session(EPIC, '003'))}`,
      `session log: ${at(layout.session(EPIC, '004'))}`,
      `shaped by: ${at(layout.productSession('001'))}#pricing`,
      `map: \`${ENGINE} render discovery-map ${EPIC}\``,
      `product: \`${ENGINE} ledger product ${EPIC}\``,
      `catch up: read ${four} from the log's last write onward, and add to the log what it is missing`,
      `log: ${at(layout.session(EPIC, '004'))}`,
    ]));
    assert.match(readState(dir, layout.session(EPIC, '004')), new RegExp(`Where it stands\\.\\n\\n## ${TODAY} · session sess-1\\n$`));
    assert.deepStrictEqual([position(), presence(EPIC, EPIC, 'discovery')?.session_id], [{ name: EPIC, phase: 'discovery', topic: EPIC }, 'sess-1']);
  });

  it('an epic with no session open opens its first, committed under the unit', () => {
    const { res, sections } = enter(['discovery', ATLAS]);
    assert.deepStrictEqual([res.started, res.committed, lastMessage(dir), committedFiles()], [true, shortHead(), `discovery(${ATLAS}): start`, [layout.session(ATLAS, '001'), layout.manifest(ATLAS)].sort()]);
    assert.strictEqual(readManifest(dir, ATLAS).phases.discovery.active_session, '001');
    assert.strictEqual(sections, data([
      `map: \`${ENGINE} render discovery-map ${ATLAS}\``,
      `product: \`${ENGINE} ledger product ${ATLAS}\``,
      `log: ${at(layout.session(ATLAS, '001'))}`,
    ]));
  });
});

describe('discovery: a level move, in the same session (8.2.11, 8.2.12, 24.1.8)', () => {
  it('from the product\'s conversation into an epic\'s discovery: the product\'s log ends on a pointer to the epic\'s, which takes the conversation\'s line, the position and the presence move, and the move is committed, with no handoff (8.S71, 24.S20)', () => {
    withFrozenClock(() => enter(['discovery', 'product']));
    const { res } = withFrozenClock(() => enter(['discovery', EPIC, '--move']));
    assert.deepStrictEqual(res, { ok: true, phase: 'discovery', unit: EPIC, entered: true, started: false, committed: shortHead() });
    assert.deepStrictEqual([lastMessage(dir), committedFiles()], [`discovery(${EPIC}): carried on from product`, [layout.productSession('003')]]);
    assert.strictEqual(readState(dir, layout.productSession('003')),
      `## ${TODAY} · session sess-1\n\n→ Carried on in the discovery of "${EPIC}": [session-004.md](../../${EPIC}/discovery/session-004.md)\n`);
    assert.match(readState(dir, layout.session(EPIC, '004')), new RegExp(`\\n## ${TODAY} · session sess-1\\n$`));
    assert.deepStrictEqual([position(), presence('product', 'product', 'discovery'), presence(EPIC, EPIC, 'discovery')?.session_id],
      [{ name: EPIC, phase: 'discovery', topic: EPIC }, null, 'sess-1']);
  });

  it('from an epic\'s discovery out to the product\'s conversation, its session opened for it: the same move the other way', () => {
    enter(['discovery', EPIC]);
    const { res } = withFrozenClock(() => enter(['discovery', 'product', '--move']));
    assert.deepStrictEqual([res.started, res.committed, lastMessage(dir)], [true, shortHead(), `discovery(product): carried on from ${EPIC} › discovery`]);
    assert.deepStrictEqual(committedFiles(), [layout.session(EPIC, '004'), layout.productSession('003'), layout.projectManifest].sort());
    assert.match(readState(dir, layout.session(EPIC, '004')), /\n\n→ Carried on in the product's conversation: \[session-003\.md\]\(\.\.\/\.\.\/\.product\/sessions\/session-003\.md\)\n$/);
    assert.strictEqual(readState(dir, layout.productSession('003')), `## ${TODAY} · session sess-1\n`);
    assert.deepStrictEqual([position(), presence(EPIC, EPIC, 'discovery')], [{ name: 'product' }, null]);
  });

  it('a topic\'s talk moving up to its epic: the sitting committed and the topic\'s presence gone as the conversation carries on in the epic\'s discovery (8.S72, 24.S20)', () => {
    enter(['discussion', EPIC, 'licence']);
    writeState(dir, layout.topic(EPIC, 'licence', 'log.md'), '## 2026-01-06 · session sess-1\n\nThe sitting.\n');
    enter(['discovery', EPIC, '--move']);
    assert.deepStrictEqual([lastMessage(dir), committedFiles()], [`discovery(${EPIC}): carried on from ${EPIC} › discussion › licence`, [layout.topic(EPIC, 'licence', 'log.md')]]);
    assert.deepStrictEqual([position(), presence(EPIC, 'licence'), presence(EPIC, EPIC, 'discovery')?.session_id], [{ name: EPIC, phase: 'discovery', topic: EPIC }, null, 'sess-1']);
  });

  it('a topic\'s talk moving up to the product\'s conversation: the sitting committed, the topic\'s presence gone, the position the product\'s (8.2.12, 24.S20)', () => {
    enter(['discussion', EPIC, 'licence']);
    writeState(dir, layout.topic(EPIC, 'licence', 'log.md'), '## 2026-01-06 · session sess-1\n\nThe sitting.\n');
    enter(['discovery', 'product', '--move']);
    assert.strictEqual(lastMessage(dir), `discovery(product): carried on from ${EPIC} › discussion › licence`);
    assert.ok(committedFiles().includes(layout.topic(EPIC, 'licence', 'log.md')), 'the sitting is committed with the move');
    assert.deepStrictEqual([position(), presence(EPIC, 'licence'), presence('product', 'product', 'discovery')?.session_id], [{ name: 'product' }, null, 'sess-1']);
  });

  it('a log a level move left ends on its pointer, so the next conversation entering it has nothing to catch up, whichever way the move went', () => {
    enter(['discovery', 'product'], 'mover');
    enter(['discovery', EPIC, '--move'], 'mover');
    assert.doesNotMatch(enter(['discovery', 'product'], 'next').sections, /^catch up:/m, 'product to epic');
    enter(['discovery', EPIC], 'mover');
    enter(['discovery', 'product', '--move'], 'mover');
    assert.doesNotMatch(enter(['discovery', EPIC], 'after').sections, /^catch up:/m, 'epic to product');
    fs.appendFileSync(at(layout.productSession('003')), '\nThe mover talked on here.\n');
    assert.match(enter(['discovery', 'product'], 'later').sections, /^catch up: the transcript of session mover,/m, 'talk written after the pointer is caught up as any is');
  });

  it('refused, writing nothing, where the conversation holds no place, is in the home already, is a topic moving to another epic than its own, or works anywhere but discovery or a topic\'s discussion', () => {
    const errors = [moveRefused(['discovery', EPIC, '--move'])];
    enter(['discovery', EPIC]);
    errors.push(moveRefused(['discovery', EPIC, '--move']));
    enter(['discussion', EPIC, 'licence']);
    errors.push(moveRefused(['discovery', ATLAS, '--move']));
    ok(dir, ['session', 'label', EPIC], { env: env() });
    errors.push(moveRefused(['discovery', ATLAS, '--move']));
    assert.deepStrictEqual(errors, [
      `a level move carries this conversation on from where it is working, and it holds no place — enter without --move: engine enter discovery ${EPIC}`,
      `this conversation is in the discovery of "${EPIC}" already — carry on there`,
      `a topic's talk moves up to its own epic's discovery or the product's conversation — "licence" is a topic of "${EPIC}"`,
      `a level move carries the conversation on from discovery or a topic's discussion — this one is working in ${EPIC}; enter without --move`,
    ]);
  });
});
