'use strict';

// ---------------------------------------------------------------------------
// The entry (leeway-engine/scripts/domain/enter.cjs): `engine enter <phase>
// <unit> [<topic>] [--take]`, the one call a phase is entered by, discussion
// its first row. What it refuses, each refusal naming its way on and writing
// nothing — a unit this project lacks or has closed, a phase the work type
// has no place for, and at a topic-level row a topic missing, unknown or
// standing closed, and any topic once the unit has its spec (4.11.2); a
// unit-level row entered at no topic, its spec no bar; a place another live
// session holds asked about first, nothing written, and taken over by
// `--take` (18.4.21, 18.S57); the start of a topic not yet started, nothing
// written ahead of its opening (9.3.1) and the start committed, under the
// writer lock, while a resume takes no lock; where the conversation is
// working, recorded — one topic at a time (9.S42) — with its presence; and
// the answer: any question before the DATA naming what to read (2.S13), the
// reads as paths and engine calls (9.3.2–9.3.6, 8.7.7), the topic's own
// record on a resume (9.S13, 24.S11), the agents the topic was left with
// landed or lost by whether the process that dispatched them still runs
// (9.7.8), and the log with the line the conversation opens its first write
// with, owed until the log names it (8.14.8, 9.S67). The label the entry
// applies is `session label`'s own (test-engine-session-label.cjs), and the
// recovery note test-engine-position.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds a topic for each standing — `onboarding` with its brief and not yet
// started, `licence` under way with agents a process now gone dispatched,
// `sync` decided, `export` promoted, `removal` cancelled, `widgets` postponed
// with its roadmap item waiting, `reports` postponed with its item gone to
// another epic, `dead-end` closed as one, `importer` routed to research — and
// a spike; a feature, `quick-sync`, with discovery's log and a seed; a
// feature with its spec; a bugfix; and a cancelled and a completed unit. Each
// test's conversation has its own system config, and its own Claude Code
// config holding its transcript.
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
const { enterThrough } = require('../../skills/leeway-engine/scripts/domain/enter.cjs');

const EPIC = 'fumi';
const FEATURE = 'quick-sync';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const TODAY = FROZEN_AT.slice(0, 10);

// A process that no longer runs, and one that does that is not this suite's.
const GONE = '2147483646';
const PEER = String(process.ppid);

/** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery', ...marks });

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
        items: {
          onboarding: row(1), licence: row(2), sync: row(3), export: row(4),
          removal: row(5, { cancelled: true }), widgets: row(6, { postponed: true }), reports: row(7, { postponed: true }),
          'dead-end': row(8, { handled: true }), importer: row(9, { routing: 'research' }),
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
  createManifest(dir, 'retired', { work_type: 'epic', status: 'cancelled' });
  createManifest(dir, 'shipped', { status: 'completed' });
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

/** A topic's presence record as it stands, or null. @param {string} unit @param {string} topic */
function presence(unit, topic) {
  try { return JSON.parse(fs.readFileSync(at(layout.cache(unit, 'discussion', topic, 'presence')), 'utf8')); } catch { return null; }
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
  it('a call that is no entry: a phase not entered through it, a missing unit, an empty topic, a flag it lacks, an extra argument', () => {
    for (const args of [['research', EPIC, 'onboarding'], ['discussion'], ['discussion', EPIC, ''], ['discussion', EPIC, '--force'], ['discussion', EPIC, 'onboarding', 'more']]) {
      assert.strictEqual(refused(args), 'Usage: engine enter <discussion> <work-unit> [<topic>] [--take]', args.join(' '));
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

  it('a topic standing closed: cancelled, postponed — its roadmap item waiting or gone to another epic — closed as a dead end, promoted out of the unit, decided', () => {
    const through = 'the epic menu\'s discovery row';
    assert.deepStrictEqual(['removal', 'widgets', 'reports', 'dead-end', 'export', 'sync'].map((topic) => refused(['discussion', EPIC, topic])), [
      `the topic "removal" is cancelled — reactivating it goes through ${through}`,
      `the topic "widgets" is postponed to the roadmap — pulling it forward goes through ${through}`,
      'the topic "reports" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back',
      `the topic "dead-end" is closed as a dead end — reopening it goes through ${through}`,
      'the topic "export" was promoted to "portability" — it carries on there',
      `the topic "sync" is decided — it reopens through a message sent to it, or through ${through}`,
    ]);
  });

  it('a start the topic\'s own rules refuse leaves no position and no presence behind', () => {
    refused(['discussion', EPIC, 'importer']);
    assert.strictEqual(presence(EPIC, 'importer'), null, 'no presence beat');
  });
});

describe('a phase entered at the work unit', () => {
  /** A unit-level row, in this suite alone: it starts by marking the unit's manifest. */
  const UNIT = Object.freeze({
    specification: {
      level: /** @type {'unit'} */ ('unit'),
      standing: () => null,
      unstarted: (/** @type {Record<string, any>} */ manifest) => manifest.description !== 'started',
      start: (/** @type {string} */ cwd, /** @type {string} */ unit) => {
        writeState(cwd, layout.manifest(unit), JSON.stringify({ ...readManifest(cwd, unit), description: 'started' }, null, 2));
      },
      questions: () => [],
      reads: () => [],
      log: (/** @type {string} */ unit) => `${unit}/log.md`,
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
    assert.ok(!fs.existsSync(at(layout.topic(EPIC, 'onboarding'))), 'nothing under the topic\'s folder');
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

  it('an opening reads the brief, the record of each topic decided so far, the product record and the unit\'s spikes, then names the log', () => {
    transcript('sess-1');
    const { sections } = withFrozenClock(() => enter(['discussion', EPIC, 'onboarding']));
    assert.strictEqual(sections, data([
      `brief: ${at(layout.brief(EPIC, 'onboarding'))}`,
      `decided: \`${ENGINE} ledger record ${EPIC} export\``,
      `decided: \`${ENGINE} ledger record ${EPIC} sync\``,
      `product: \`${ENGINE} ledger product\``,
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
      `product: \`${ENGINE} ledger product\``,
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
      `product: \`${ENGINE} ledger product\``,
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

  it('the log\'s header line is owed until the log names the conversation, and each conversation is owed its own (9.S67)', () => {
    const header = (/** @type {string|null} */ sessionId) => enter(['discussion', EPIC, 'licence'], sessionId).sections.match(/^log header: (.*)$/m)?.[1] ?? null;
    const first = withFrozenClock(() => header('sess-1'));
    assert.strictEqual(first, `## ${TODAY} · session sess-1`);
    writeState(dir, layout.topic(EPIC, 'licence', 'log.md'), `${first}\n\nWhat we talked about.\n`);
    assert.strictEqual(header('sess-1'), null, 'the log names the conversation');
    assert.strictEqual(withFrozenClock(() => header('sess-2')), `## ${TODAY} · session sess-2`);
    assert.strictEqual(header(null), null, 'no session id names none');
  });
});
