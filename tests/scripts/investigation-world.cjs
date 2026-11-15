'use strict';

// ---------------------------------------------------------------------------
// The investigation suites' world and helpers (test-engine-investigation.cjs:
// its entry, its log, its plan and check-in gates; and
// test-engine-investigation-conclude.cjs: its validations' briefs and its
// conclude). The world, built once per process and copied
// for each test: a bugfix, `crash`, from two seeds, with its brief and
// discovery's log, not yet started; a bugfix, `hunt`, its investigation
// entered, with the ledger entries its hunt rests on — the root cause
// answering the cause, a finding, the person's ruling, a question for the
// fix (`made`); a feature under discussion with a question of its own; a
// bugfix with its spec, and one whose investigation has concluded; and a
// bugfix, `ripe`, hunted to its close — two symptoms, the root cause and the
// fix logged on their decisions, both validated and taken in (`ripe`).
// Each test's conversation has its own system config, and its calls are
// made as that conversation makes them (`useInvestigationWorld`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { beforeEach, afterEach } = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, output, refusedPristine, statePath, layout, writeState, readState, commitAll, fixtureFrom, cleanupFixture, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');

const BUG = 'crash';
const HUNT = 'hunt';
const FEATURE = 'quick-sync';
const RIPE = 'ripe';
const AT = `${HUNT}.investigation.${HUNT}`;
const RIPE_AT = `${RIPE}.investigation.${RIPE}`;
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const TODAY = FROZEN_AT.slice(0, 10);
const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
// A process that no longer runs.
const GONE = '2147483646';

/** The ledger entries the hunt rests on, by short id. */
const made = { cause: '', rootCause: '', kill: '', keep: '', ruling: '', fix: '', other: '' };

/** The ledger entries `ripe`'s hunt rests on, by short id. */
const ripe = { cause: '', rootCause: '', asked: '', fix: '', keep: '', ruling: '' };

/**
 * A validation of `kind` dispatched at the bugfix's investigation, its report
 * written clean, and taken in: its id.
 * @param {string} dir @param {string} unit @param {string} kind @param {Record<string, string|undefined>} [env]
 */
function validated(dir, unit, kind, env = { CLAUDE_PID: undefined }) {
  const row = ok(dir, ['agent', 'dispatch', unit, 'investigation', unit, '--kind', kind], { env });
  fs.writeFileSync(row.file, `# Validation — ${row.id}\n\n## Summary\n\nIt holds.\n\n## Findings\n\nNone identified.\n`);
  ok(dir, ['agent', 'scan', unit, 'investigation', unit], { env });
  ok(dir, ['agent', 'ack', unit, 'investigation', unit, row.id, '--clean'], { env });
  return row.id;
}

const world = fixtureFrom('engine-investigation-', (dir) => {
  createManifest(dir, BUG, {
    work_type: 'bugfix',
    seeds: ['report', 'trace'].map((name) => ({ path: `seeds/${name}.md`, source: `inbox:${name}`, seeded_at: '2026-01-01T00:00:00Z' })),
  });
  writeState(dir, layout.brief(BUG, BUG), '# Crash\n');
  writeState(dir, layout.session(BUG, '001'), '# Discovery Session 001\n');
  writeState(dir, layout.unit(BUG, 'seeds', 'report.md'), '# The report\n');
  writeState(dir, layout.unit(BUG, 'seeds', 'trace.md'), '# The trace\n');
  createManifest(dir, HUNT, { work_type: 'bugfix' });
  createManifest(dir, FEATURE, { phases: { discussion: { items: { [FEATURE]: { status: 'in-progress' } } } } });
  createManifest(dir, 'specced', { work_type: 'bugfix' });
  writeState(dir, layout.unit('specced', 'spec.md'), '# Spec\n');
  createManifest(dir, 'fixed', { work_type: 'bugfix', phases: { investigation: { items: { fixed: { status: 'completed' } } } } });
  createManifest(dir, RIPE, { work_type: 'bugfix' });
  commitAll(dir, 'the world');
  ok(dir, ['enter', 'investigation', HUNT], { env: { CLAUDE_PID: undefined } });
  const { write } = ledgerHelpers(() => dir);
  made.cause = write('ask', AT, [], { ...CLAUDE, text: 'What empties the saved state?' }).id;
  made.rootCause = write('decide', AT, ['--answers', made.cause], { ...CLAUDE, text: 'Every save takes the session list\nas the whole truth.', why: 'The capture is all it reads.' }).id;
  made.kill = write('find', AT, [], { ...CLAUDE, text: 'Killing every session leaves an empty save.', how: 'Killed them on a throwaway tmux.', known: 'read' }).id;
  made.keep = write('ask', AT, [], { ...CLAUDE, text: 'Should a session you kill come back?' }).id;
  made.ruling = write('decide', AT, ['--answers', made.keep], { ...PERSON, text: 'A session you kill never comes back.', why: 'Killing it is the person saying so.' }).id;
  made.fix = write('ask', AT, [], { ...CLAUDE, text: 'How should restore stop losing sessions?' }).id;
  made.other = write('find', `${FEATURE}.discussion.${FEATURE}`, [], { ...CLAUDE, text: 'Sync runs hourly.', how: 'Read the scheduler.', known: 'read' }).id;

  ok(dir, ['enter', 'investigation', RIPE], { env: { CLAUDE_PID: undefined } });
  const hunted = (/** @type {string} */ kind, /** @type {string[]} */ args) => ok(dir, ['investigation-log', kind, RIPE, ...args]);
  hunted('symptom', ['--text', 'I killed every session and restore brought nothing back']);
  hunted('symptom', ['--text', 'After a reboot the sessions were gone too']);
  ripe.cause = write('ask', RIPE_AT, [], { ...CLAUDE, text: 'What empties the saved state?' }).id;
  ripe.rootCause = write('decide', RIPE_AT, ['--answers', ripe.cause], { ...CLAUDE, text: 'Every save takes the session list as the whole truth, so an empty list empties the save.', why: 'The capture is all it reads.' }).id;
  ripe.keep = write('ask', RIPE_AT, [], { ...CLAUDE, text: 'Should a session you kill come back?' }).id;
  ripe.ruling = write('decide', RIPE_AT, ['--answers', ripe.keep], { ...PERSON, text: 'A session you kill never comes back.', why: 'Killing it is the person saying so.' }).id;
  hunted('root-cause', ['--entry', ripe.rootCause]);
  validated(dir, RIPE, 'root-cause-validation');
  ripe.asked = write('ask', RIPE_AT, [], { ...CLAUDE, text: 'How should restore stop losing sessions?' }).id;
  ripe.fix = write('decide', RIPE_AT, ['--answers', ripe.asked], { ...CLAUDE, text: 'Never save an empty capture over a full one.', why: 'The empty capture is the cause.' }).id;
  hunted('fix-direction', ['--question', ripe.asked]);
  validated(dir, RIPE, 'fix-validation');
});

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/**
 * Each test of the calling suite in a copy of the world, its conversation's
 * system config a folder of its own — `use` told both as the test begins —
 * and the calls the test makes as that conversation makes them.
 * @param {(at: {dir: string, config: string}) => void} use
 */
function useInvestigationWorld(use) {
  let dir = '';
  let config = '';
  beforeEach(() => {
    dir = world();
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-investigation-config-'));
    use({ dir, config });
  });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** The engine as the conversation runs it. */
  const env = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });
  /** A call that must succeed: its response. @param {string[]} args */
  const run = (args) => ok(dir, args, { env: env() });
  /** A file of Claude's, absolute, holding `text`. @param {string} name @param {string} text */
  const staged = (name, text) => {
    const file = path.join(config, name);
    fs.writeFileSync(file, text);
    return file;
  };
  return {
    env,
    run,
    /** A call that must succeed: its response and its sections. @param {string[]} args */
    drawn: (/** @type {string[]} */ args) => okSections(dir, args, { env: env() }),
    /** A render that must succeed: what it draws, with the gate mod announced where `announced`. @param {string[]} args @param {boolean} [announced] */
    rendered: (/** @type {string[]} */ args, announced = false) => output(dir, ['render', ...args], { env: { ...env(), ...(announced ? { LEEWAY_GATE_SURFACE: '1' } : {}) } }),
    /** A call that must refuse, writing and committing nothing: its error. @param {string[]} args */
    refused: (/** @type {string[]} */ args) => refusedPristine(dir, args, { env: env() }).error,
    /** An entry of the hunt's log. @param {string} kind @param {string[]} args */
    log: (/** @type {string} */ kind, /** @type {string[]} */ args) => run(['investigation-log', kind, HUNT, ...args]),
    staged,
    /** A payload of Claude's, absolute. @param {string} name @param {unknown} value */
    payload: (/** @type {string} */ name, /** @type {unknown} */ value) => staged(name, JSON.stringify(value)),
    /** An entry's full id. @param {string} short */
    full: (/** @type {string} */ short) => ledgerHelpers(() => dir).full(short),
    /** The hunt's log, as written. */
    huntLog: () => readState(dir, layout.topic(HUNT, HUNT, 'log.md')),
    /** A path in the state, absolute. @param {string} rel */
    at: (/** @type {string} */ rel) => statePath(dir, rel),
  };
}

module.exports = {
  BUG, HUNT, FEATURE, RIPE, AT, RIPE_AT, ENGINE, TODAY, CLAUDE, PERSON, GONE, made, ripe, validated, data, useInvestigationWorld,
};
