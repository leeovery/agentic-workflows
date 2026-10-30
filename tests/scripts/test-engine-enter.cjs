'use strict';

// ---------------------------------------------------------------------------
// The entry (leeway-engine/scripts/domain/enter.cjs): `engine enter <phase>
// <unit> [<topic>]`, the one call a phase is entered by, discussion its
// first row. What it refuses, each refusal naming its way on and writing
// nothing — a unit this project lacks or has closed, a phase the work type
// has no place for, a topic missing, unknown or standing closed, and any
// topic once the unit has its spec (4.11.2); the start of a topic not yet
// started, nothing written ahead of its opening (9.3.1) and the start
// committed, under the writer lock, while a resume takes no lock; where the
// conversation is working, recorded — one topic at a time (9.S42) — with
// its presence; and the answer: any question before the DATA naming what to
// read (2.S13), the reads as paths and engine calls (9.3.2–9.3.6, 8.7.7),
// the topic's own record on a resume (9.S13, 24.S11), agents an earlier
// conversation left landed or lost (9.7.8), and the log with the line the
// conversation opens its first write with, owed until the log names it
// (8.14.8, 9.S67). The label the entry applies is `session label`'s own
// (test-engine-session-label.cjs), and the recovery note
// test-engine-position.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds a topic for each standing — `onboarding` with its brief and not yet
// started, `licence` under way with agents an earlier conversation
// dispatched, `sync` decided, `export` promoted, `removal` cancelled,
// `widgets` postponed, `dead-end` closed as one, `importer` routed to
// research — and a spike; a feature, `quick-sync`, with discovery's log and a
// seed; a feature with its spec; a bugfix; and a cancelled and a completed
// unit. Each test's conversation has its own system config, and its own
// Claude Code config holding its transcript.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, refusedPristine, statePath, layout, writeState, readManifest, commitAll, stateGit, lastMessage, fixtureFrom, cleanupFixture,
  lockAttempts, holdLock, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { entrySections } = require('../../skills/leeway-engine/scripts/domain/projections/enter.cjs');

const EPIC = 'fumi';
const FEATURE = 'quick-sync';
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const TODAY = FROZEN_AT.slice(0, 10);

/** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery', ...marks });

const world = fixtureFrom('engine-enter-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: {
        items: {
          onboarding: row(1), licence: row(2), sync: row(3), export: row(4),
          removal: row(5, { cancelled: true }), widgets: row(6, { postponed: true }), 'dead-end': row(7, { handled: true }),
          importer: row(8, { routing: 'research' }),
        },
      },
      discussion: {
        items: {
          licence: { status: 'in-progress' }, sync: { status: 'completed' }, export: { status: 'promoted', promoted_to: 'portability' },
          removal: { status: 'cancelled' }, widgets: { status: 'postponed' },
        },
      },
    },
  });
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
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-build-'));
  try {
    for (const label of ['landed', 'lost']) ok(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', label], { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'earlier' } });
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
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
  it('a call that is no entry: a phase not entered through it, a missing unit, an empty topic, an extra argument', () => {
    for (const args of [['research', EPIC, 'onboarding'], ['discussion'], ['discussion', EPIC, ''], ['discussion', EPIC, 'onboarding', 'more']]) {
      assert.strictEqual(refused(args), 'Usage: engine enter <discussion> <work-unit> [<topic>]', args.join(' '));
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
    assert.deepStrictEqual([refused(['discussion', EPIC]), refused(['discussion', EPIC, 'a.b']), refused(['discussion', EPIC, 'nowhere']), refused(['discussion', FEATURE, 'other'])], [
      `an epic enters discussion at one of its topics — name the topic: engine enter discussion ${EPIC} <topic>`,
      '"a.b" is not a legal topic name — dots and slashes break manifest addressing',
      `${EPIC} has no topic "nowhere" — the epic's map holds its topics, and a new one comes through its discovery`,
      `${FEATURE} has no topic "other" — a feature's topic is the unit itself`,
    ]);
  });

  it('any topic once the unit has its spec — a topic exists only before it (4.11.2)', () => {
    assert.strictEqual(refused(['discussion', 'specced']), 'specced has its spec — a topic exists only before it, and a change is settled in the spec from here');
  });

  it('a topic standing closed: cancelled, postponed, closed as a dead end, promoted out of the unit, decided', () => {
    const through = 'the epic menu\'s discovery row';
    assert.deepStrictEqual(['removal', 'widgets', 'dead-end', 'export', 'sync'].map((topic) => refused(['discussion', EPIC, topic])), [
      `the topic "removal" is cancelled — reactivating it goes through ${through}`,
      'the topic "widgets" is postponed and waits on the roadmap — pulling it forward brings it back',
      `the topic "dead-end" is closed as a dead end — reopening it goes through ${through}`,
      'the topic "export" was promoted to "portability" — it carries on there',
      `the topic "sync" is decided — it reopens through a message sent to it, or through ${through}`,
    ]);
  });

  it('a start the topic\'s own rules refuse leaves no position and no presence behind', () => {
    refused(['discussion', EPIC, 'importer']);
    assert.ok(!fs.existsSync(at(layout.cache(EPIC, 'discussion', 'importer', 'presence'))), 'no presence beat');
  });
});

describe('a topic not yet started', () => {
  it('starts it and commits the start, writing nothing ahead of its opening (9.3.1)', () => {
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res } = enter(['discussion', EPIC, 'onboarding']);
    assert.deepStrictEqual(res, {
      ok: true, phase: 'discussion', unit: EPIC, topic: 'onboarding', started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(),
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
    assert.deepStrictEqual(enter(['discussion', FEATURE, FEATURE]).res, { ok: true, phase: 'discussion', unit: FEATURE, topic: FEATURE, started: false });
  });
});

describe('a topic under way', () => {
  it('resumes it, taking no lock and committing nothing', (t) => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const attempts = lockAttempts(t, holdLock(at(layout.lock)), () => {
      throw new Error('the resume tried the writer lock');
    });
    assert.deepStrictEqual(enter(['discussion', EPIC, 'licence']).res, { ok: true, phase: 'discussion', unit: EPIC, topic: 'licence', started: false });
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

  it('a resume adds the topic\'s own record, and the agents an earlier conversation left: the report landed since, the agent lost with it (9.S13, 24.S11, 9.7.8)', () => {
    ok(dir, ['agent', 'dispatch', EPIC, 'discussion', 'licence', '--kind', 'deep-dive', '--label', 'mine'], { env: env() });
    const { sections } = withFrozenClock(() => enter(['discussion', EPIC, 'licence']));
    assert.strictEqual(sections, data([
      `decided: \`${ENGINE} ledger record ${EPIC} export\``,
      `decided: \`${ENGINE} ledger record ${EPIC} sync\``,
      `product: \`${ENGINE} ledger product\``,
      `spike: ${at(layout.unit(EPIC, 'spikes', '001-first-run'))}`,
      `record: \`${ENGINE} ledger record ${EPIC} licence\``,
      `landed: ${at(layout.cache(EPIC, 'discussion', 'licence', 'deep-dive-001-landed.md'))}`,
      'lost: deep-dive-002-lost',
      `log: ${at(layout.topic(EPIC, 'licence', 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1`,
    ]));
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
