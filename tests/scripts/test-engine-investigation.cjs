'use strict';

// ---------------------------------------------------------------------------
// A bugfix's investigation: its entry, `engine enter investigation <bugfix>`
// (leeway-engine/scripts/domain/enter.cjs), its one topic the unit, started
// as a discussion's is and reading the brief, discovery's log and the seeds
// in full before it opens (8.S54, 8.7.7), refused where the unit cannot take
// it; its log, `engine investigation-log` (domain/investigation-log.cjs), the
// hunt under fixed headings in the topic's log, its experiments, root cause,
// fix direction and intended hypotheses resting on their ledger entries, the
// fix direction only after a current root cause and carrying what the step
// back found (19.S7, 19.4.1–19.4.3), every refusal writing nothing, a line
// passed over said where Claude reads; a raise setting out the fix refused
// before the root cause; its plan and check-in gates, `render
// investigation-plan|investigation-check-in` (domain/investigation.cjs,
// domain/projections/investigation.cjs), drawn from the log and Claude's
// payload, the revised plan back at the plan gate (19.S35, 19.4.19,
// 19.4.24); its validations' briefs, `brief root-cause-validation|fix-validation`
// (domain/brief-records.cjs), from the log, the record, what the hunt rests
// on and the code; and its close (domain/investigation-conclude.cjs), the
// conclude gate, `render conclude`, a verdict owed asked first, and its yes,
// `investigation conclude`, standing only once the root cause and the fix
// rest on current entries, both validated since, nothing of the person's
// open and no mail waiting, which completes the item, stamps its close,
// releases its place and hands off into the spec (19.S10, 19.S15, 19.S34,
// 24.S17, 16.10.5); and what the bug is in, the unit whose code it fixes and
// the feature map's area, carried from the recap to the yes on no line of
// the screen, and kept on the item for the bugs found after review
// (17.1.9, 17.S4's record).
//
// Layer: verb. World, built once and copied: a bugfix, `crash`, from two
// seeds, with its brief and discovery's log, not yet started; a bugfix,
// `hunt`, its investigation entered, with the ledger entries its hunt rests
// on — the root cause answering the cause, a finding, the person's ruling, a
// question for the fix; a feature under discussion with a question of its
// own; a bugfix with its spec, and one whose investigation has concluded;
// and a bugfix, `ripe`, hunted to its close — two symptoms, the root cause
// and the fix logged on their decisions, both validated and taken in.
// Each test's conversation has its own system config.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, refusesAsync, output, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, stateGit, lastMessage, head, fixtureFrom, cleanupFixture,
  withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { auditGate } = require('./gate-audit.cjs');
const { huntIn } = require('../../skills/leeway-engine/scripts/domain/investigation-log.cjs');

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

let dir; // the project
let config; // the system config: the conversation's folder

/** The engine as the conversation runs it. */
function env() {
  return { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined };
}

/** A call that must succeed: its response. @param {string[]} args */
const run = (args) => ok(dir, args, { env: env() });

/** A call that must succeed: its response and its sections. @param {string[]} args */
const drawn = (args) => okSections(dir, args, { env: env() });

/** A render that must succeed: what it draws, with the gate mod announced where `announced`. @param {string[]} args @param {boolean} [announced] */
const rendered = (args, announced = false) => output(dir, ['render', ...args], { env: { ...env(), ...(announced ? { LEEWAY_GATE_SURFACE: '1' } : {}) } });

/** A call that must refuse, writing and committing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: env() }).error;

/** An entry of the hunt's log. @param {string} kind @param {string[]} args */
const log = (kind, args) => run(['investigation-log', kind, HUNT, ...args]);

/** A file of Claude's, absolute, holding `text`. @param {string} name @param {string} text */
function staged(name, text) {
  const file = path.join(config, name);
  fs.writeFileSync(file, text);
  return file;
}

/** A payload of Claude's, absolute. @param {string} name @param {unknown} payload */
const payload = (name, value) => staged(name, JSON.stringify(value));

/** An entry's full id. @param {string} short */
const full = (short) => ledgerHelpers(() => dir).full(short);

/** The hunt's log, as written. */
const huntLog = () => readState(dir, layout.topic(HUNT, HUNT, 'log.md'));

/** A path in the state, absolute. @param {string} rel */
const at = (rel) => statePath(dir, rel);

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-investigation-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('enter investigation — the bugfix\'s one topic (6.1.21, 8.7.7)', () => {
  it('8.S54: the first opening starts the topic, the unit itself, committing the start, and reads the brief, discovery\'s log and both seeds in full, then the product record, naming the log — the investigation — with the line it opens with; nothing is written ahead of the opening', () => {
    const { res, sections } = withFrozenClock(() => drawn(['enter', 'investigation', BUG]));

    assert.deepStrictEqual(res, { ok: true, phase: 'investigation', unit: BUG, topic: BUG, entered: true, started: true, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(lastMessage(dir), `investigation(${BUG}): start ${BUG}`);
    assert.deepStrictEqual(readManifest(dir, BUG).phases.investigation, { items: { [BUG]: { status: 'in-progress' } } });
    assert.strictEqual(sections, data([
      `brief: ${at(layout.brief(BUG, BUG))}`,
      `discovery log: ${at(layout.session(BUG, '001'))}`,
      `seed: ${at(layout.unit(BUG, 'seeds', 'report.md'))}`,
      `seed: ${at(layout.unit(BUG, 'seeds', 'trace.md'))}`,
      `product: \`${ENGINE} ledger product ${BUG} ${BUG}\``,
      `log: ${at(layout.topic(BUG, BUG, 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1`,
    ]));
    assert.strictEqual(fs.existsSync(at(layout.topic(BUG, BUG, 'log.md'))), false, 'the log is the conversation\'s to write');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(config, 'conversations', 'sess-1', 'position.json'), 'utf8')), { name: BUG, phase: 'investigation', topic: BUG });
  });

  it('a resume starts nothing and reads the topic\'s record and map besides, then the agents a process now gone left: the validator\'s report landed since, and the one lost with it (9.7.8)', () => {
    const earlier = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-investigation-earlier-'));
    try {
      for (const kind of ['root-cause-validation', 'fix-validation']) {
        ok(dir, ['agent', 'dispatch', HUNT, 'investigation', HUNT, '--kind', kind, '--label', kind === 'fix-validation' ? 'lost' : 'landed'], {
          env: { LEEWAY_CONFIG_DIR: earlier, CLAUDE_CODE_SESSION_ID: 'earlier', CLAUDE_PID: GONE, TMUX: undefined },
        });
      }
    } finally {
      fs.rmSync(earlier, { recursive: true, force: true });
    }
    const report = layout.cache(HUNT, 'investigation', HUNT, 'root-cause-validation-001-landed.md');
    writeState(dir, report, '# The root cause holds\n');
    const before = head(dir);

    const { res, sections } = withFrozenClock(() => drawn(['enter', 'investigation', HUNT]));

    assert.deepStrictEqual([res.started, res.committed, head(dir)], [false, undefined, before]);
    assert.strictEqual(sections, data([
      `product: \`${ENGINE} ledger product ${HUNT} ${HUNT}\``,
      `record: \`${ENGINE} ledger record ${HUNT} ${HUNT}\``,
      `map: \`${ENGINE} ledger map ${HUNT} ${HUNT}\``,
      `landed: ${at(report)}`,
      'lost: fix-validation-001-lost',
      `log: ${at(layout.topic(HUNT, HUNT, 'log.md'))}`,
      `log header: ## ${TODAY} · session sess-1`,
    ]));
  });

  it('mail waiting is raised before anything is read, and named first in what to read (10.4.1)', () => {
    writeState(dir, layout.mailbox(BUG, BUG, '001-also-on-reboot.md'), 'It happens on a reboot too\nFrom Discovery · 2 Jan\n');

    const { sections } = drawn(['enter', 'investigation', BUG]);

    const [mail, reads] = sections.split(/(?==== DATA )/);
    assert.match(mail, /^=== DISPLAY: waiting mail /);
    assert.strictEqual(reads.split('\n')[1], `mail: ${at(layout.mailbox(BUG, BUG, '001-also-on-reboot.md'))}`);
  });

  it('refuses, writing nothing: a unit of another type, one past its spec, an investigation concluded, and a topic but the unit\'s own', () => {
    assert.deepStrictEqual([['investigation', FEATURE], ['investigation', 'specced'], ['investigation', 'fixed'], ['investigation', BUG, 'other']].map((args) => refused(['enter', ...args])), [
      'a feature has no investigation — its phases are experiment, discussion, specification, implementation, review',
      'specced has its spec — a topic exists only before it, and a change is settled in the spec from here',
      'the topic "fixed" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it',
      `${BUG} has no topic "other" — a bugfix's topic is the unit itself`,
    ]);
  });
});

describe('investigation-log — the hunt under its fixed headings (19.4.1–19.4.3, P1)', () => {
  it('19.S7: each entry goes under its own heading in the topic\'s log, after the conversation\'s words, each resting on its ledger entry by its full id, and the hunt reads back as logged; nothing is committed (6.3.2)', () => {
    writeState(dir, layout.topic(HUNT, HUNT, 'log.md'), '## 2026-01-02 · session sess-1\n\nThe person reported it.\n');
    const before = head(dir);

    const responses = [
      log('symptom', ['--text', 'sessions.json is overwritten with an empty index']),
      log('hypothesis', ['--title', 'Killing every session empties the state']),
      log('symptom', ['--text', 'No warning; the next restore has nothing']),
      log('hypothesis', ['--title', 'kill-server saves an empty state']),
      log('experiment', ['--title', 'Kill every session', '--showed', 'each kill shrank it · 3 → 0', '--entry', made.kill]),
      log('hypothesis', ['H1', '--state', 'confirmed']),
      log('hypothesis', ['H2', '--state', 'ruled-out']),
      log('root-cause', ['--entry', made.rootCause]),
      log('validation', ['root-cause', '--found', 'the capture can come back empty mid-shutdown', '--did', 'added the shutdown race to the cause']),
      log('fix-direction', ['--question', made.fix]),
    ];

    assert.deepStrictEqual(responses[4], { ok: true, log: layout.topic(HUNT, HUNT, 'log.md'), heading: 'Experiments', line: `- E1 · Kill every session — each kill shrank it · 3 → 0 [${full(made.kill)}]` });
    assert.strictEqual(huntLog(), [
      '## 2026-01-02 · session sess-1', '', 'The person reported it.', '',
      '## Symptoms', '', '- sessions.json is overwritten with an empty index', '- No warning; the next restore has nothing', '',
      '## Hypotheses', '', '- H1 · Killing every session empties the state · suspected', '- H2 · kill-server saves an empty state · suspected',
      '- H1 · Killing every session empties the state · confirmed', '- H2 · kill-server saves an empty state · ruled out', '',
      '## Experiments', '', `- E1 · Kill every session — each kill shrank it · 3 → 0 [${full(made.kill)}]`, '',
      '## Root cause', '', `- Every save takes the session list as the whole truth. [${full(made.rootCause)}]`, '',
      '## Validation', '', '- root cause · the capture can come back empty mid-shutdown — added the shutdown race to the cause', '',
      '## Fix direction', '', `- How should restore stop losing sessions? [${full(made.fix)}]`, '',
    ].join('\n'));
    assert.strictEqual(head(dir), before, 'the log rides the next state commit');
    const warnings = [];
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', warnings), {
      symptoms: [{ text: 'sessions.json is overwritten with an empty index', body: [] }, { text: 'No warning; the next restore has nothing', body: [] }],
      hypotheses: [
        { name: 'H1', title: 'Killing every session empties the state', state: 'confirmed', by: null, body: [] },
        { name: 'H2', title: 'kill-server saves an empty state', state: 'ruled-out', by: null, body: [] },
      ],
      experiments: [{ name: 'E1', title: 'Kill every session', showed: 'each kill shrank it · 3 → 0', entry: full(made.kill), body: [] }],
      rootCause: { text: 'Every save takes the session list as the whole truth.', entry: full(made.rootCause), body: [] },
      validations: [{ which: 'root-cause', found: 'the capture can come back empty mid-shutdown', did: 'added the shutdown race to the cause', body: [] }],
      fixDirection: { text: 'How should restore stop losing sessions?', entry: full(made.fix), body: [] },
    });
    assert.deepStrictEqual(warnings, []);
  });

  it('a hypothesis is intended on the person\'s ruling, its line naming the decision', () => {
    log('hypothesis', ['--title', 'A killed session should stay gone']);
    const { line } = log('hypothesis', ['H1', '--state', 'intended', '--by', made.ruling]);

    assert.strictEqual(line, `- H1 · A killed session should stay gone · intended [${full(made.ruling)}]`);
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).hypotheses, [{ name: 'H1', title: 'A killed session should stay gone', state: 'intended', by: full(made.ruling), body: [] }]);
  });

  it('a body goes beneath its entry, indented, and is read back with it — a hypothesis\'s across all its lines; each experiment numbered as it is logged (20.12.2)', () => {
    log('hypothesis', ['--title', 'The daemon saves a dying server', '--body', staged('first.md', 'The last save lands\n  as the server dies.\n')]);
    log('symptom', ['--text', 'Restore finds nothing', '--body', staged('symptom.md', 'Since Tuesday.')]);
    log('hypothesis', ['H1', '--state', 'confirmed', '--body', staged('then.md', 'E2 caught it.')]);
    log('experiment', ['--title', 'Kill every session', '--showed', 'the save empties', '--entry', made.kill]);
    log('experiment', ['--title', 'Kill the server', '--showed', 'the save empties too', '--entry', made.kill, '--body', staged('e2.md', 'On a throwaway tmux.')]);

    assert.strictEqual(huntLog(), [
      '## Hypotheses', '', '- H1 · The daemon saves a dying server · suspected', '    The last save lands', '      as the server dies.',
      '- H1 · The daemon saves a dying server · confirmed', '    E2 caught it.', '', '## Symptoms', '', '- Restore finds nothing', '    Since Tuesday.', '',
      '## Experiments', '', `- E1 · Kill every session — the save empties [${full(made.kill)}]`, `- E2 · Kill the server — the save empties too [${full(made.kill)}]`, '    On a throwaway tmux.', '',
    ].join('\n'));
    const hunt = huntIn(huntLog(), 'log.md', []);
    assert.deepStrictEqual(hunt.hypotheses[0].body, ['The last save lands', '  as the server dies.', 'E2 caught it.']);
    assert.deepStrictEqual(hunt.symptoms, [{ text: 'Restore finds nothing', body: ['Since Tuesday.'] }]);
    assert.deepStrictEqual(hunt.experiments.map(({ name, body }) => ({ name, body })), [{ name: 'E1', body: [] }, { name: 'E2', body: ['On a throwaway tmux.'] }]);
  });

  it('a hypothesis is reworded under its number, its state carried, and then read under its new title', () => {
    log('hypothesis', ['--title', 'The save races the shutdown']);
    log('hypothesis', ['H1', '--state', 'intended', '--by', made.ruling]);
    const { line } = log('hypothesis', ['H1', '--title', 'The save trusts a capture taken mid-shutdown']);

    assert.strictEqual(line, `- H1 · The save trusts a capture taken mid-shutdown · intended [${full(made.ruling)}]`);
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).hypotheses, [
      { name: 'H1', title: 'The save trusts a capture taken mid-shutdown', state: 'intended', by: full(made.ruling), body: [] },
    ]);
    assert.strictEqual(log('hypothesis', ['H1', '--title', 'The capture runs late', '--state', 'confirmed']).line, '- H1 · The capture runs late · confirmed');
  });

  it('19.4.1–19.4.3: the fix direction is refused while no root cause is logged, and again once the root cause\'s decision is replaced, until its replacement is', () => {
    const before = `investigation-log: the fix direction comes after the root cause, and no root cause is logged — log it first: engine investigation-log root-cause ${HUNT} --entry <decision>`;
    assert.strictEqual(refused(['investigation-log', 'fix-direction', HUNT, '--question', made.fix]), before);

    log('root-cause', ['--entry', made.rootCause]);
    log('fix-direction', ['--question', made.fix]);
    const { write } = ledgerHelpers(() => dir);
    const replaced = write('replace', AT, ['--replaces', made.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'E6 showed it.' }).id;

    assert.strictEqual(refused(['investigation-log', 'fix-direction', HUNT, '--question', made.fix]),
      `investigation-log: the fix direction comes after the root cause, and the root cause logged points at no current entry — log it first: engine investigation-log root-cause ${HUNT} --entry <decision>`);
    assert.strictEqual(refused(['investigation-log', 'root-cause', HUNT, '--entry', made.rootCause]), `investigation-log: --entry names ${made.rootCause}, which is no longer current — ${replaced} replaced it`);
    log('root-cause', ['--entry', replaced]);
    assert.strictEqual(log('fix-direction', ['--question', made.fix]).line, `- How should restore stop losing sessions? [${full(made.fix)}]`);
    log('fix-direction', ['--question', made.keep]);
    assert.strictEqual(huntIn(huntLog(), 'log.md', []).fixDirection?.entry, full(made.keep), 'the latest fix direction stands');
  });

  /**
   * A raise at the investigation's place, drawn in this conversation: of the
   * fix, or of what `target` names.
   * @param {Record<string, unknown>} call @param {string[]} [target]
   */
  const raised = (call, target = ['--answers', made.fix]) => okSectionsAsync(dir, ['raise', AT, ...target], { env: env(), stdin: JSON.stringify(call) });

  /** The person's pick of a raise drawn: the decision it landed, by its full id. @param {string} raise @param {string} pick */
  function picked(raise, pick) {
    ok(dir, ['raise', 'answer', raise, '--pick', pick], { env: env(), stdin: JSON.stringify({ why: 'It is the cause.' }) });
    return JSON.parse(readState(dir, '.ledger.jsonl').trim().split('\n').at(-1)).id;
  }

  const FIX_CALL = Object.freeze({
    question: 'How should restore stop losing sessions?',
    rows: [
      { key: '1', name: 'Refuse', text: 'Refuse to save an empty capture', notice: 'a kill never empties the save' },
      { key: '2', name: 'Keep', text: 'Keep the last good save beside it', notice: 'restore offers the one before' },
    ],
    lean: '1',
    why: 'The empty capture is the cause.',
    sort: 'one',
    mechanism: 'The save checks the capture before it writes.',
    product_wide: false,
  });
  const STEPPED_BACK = ['The capture is trusted whole wherever it is taken.', 'A kill and a shutdown are one case.'];

  it('the fix direction carries what the step back found as its body, copied from this conversation\'s raise of the question once the person picked — never another question\'s, drawn later; a body given besides passed over, said so', async () => {
    log('root-cause', ['--entry', made.rootCause]);
    picked((await raised({ ...FIX_CALL, stepped_back: STEPPED_BACK })).res.raise, '1');
    const { write } = ledgerHelpers(() => dir);
    const warn = write('ask', AT, [], { ...CLAUDE, text: 'Should restore say what it lost?' }).id;
    await raised({ ...FIX_CALL, question: 'Should restore say what it lost?', stepped_back: ['Not the fix\'s step back.'] }, ['--answers', warn]);

    const res = log('fix-direction', ['--question', made.fix, '--body', staged('fix.md', 'My own words.')]);

    assert.deepStrictEqual(res.warnings, [`--body ${path.join(config, 'fix.md')} is passed over: the fix direction's body is what the step back found, as this conversation's raise of the question sealed it`]);
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).fixDirection?.body, STEPPED_BACK);
  });

  it('a fix the person picked, then replaced in the same conversation, carries the replacement\'s step back, the latest down the question\'s chain', async () => {
    log('root-cause', ['--entry', made.rootCause]);
    const decided = picked((await raised({ ...FIX_CALL, stepped_back: ['The first step back.'] })).res.raise, '1');
    const replacing = await raised({
      ...FIX_CALL, rows: [FIX_CALL.rows[1], { key: '3', name: 'Both', text: 'Refuse it and keep the last good save', notice: 'both' }], lean: '3', stepped_back: STEPPED_BACK,
    }, ['--replaces', decided, '--reason', 'changed-mind']);
    picked(replacing.res.raise, '3');

    log('fix-direction', ['--question', made.fix]);

    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).fixDirection?.body, STEPPED_BACK);
  });

  it('where this conversation sealed no step back for the question, the fix direction takes --body, and goes without one where none is given', async () => {
    log('root-cause', ['--entry', made.rootCause]);
    await raised(FIX_CALL);

    assert.strictEqual(log('fix-direction', ['--question', made.fix, '--body', staged('fix.md', 'Found on a /clear.')]).warnings, undefined);
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).fixDirection?.body, ['Found on a /clear.']);
    log('fix-direction', ['--question', made.fix]);
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).fixDirection?.body, []);
  });

  it('19.S7: a raise at the investigation\'s place carrying a step back, the fix direction\'s screen, is refused while no root cause is logged, sealing nothing; one without is drawn', async () => {
    const { error } = await refusesAsync(dir, ['raise', AT, '--answers', made.fix], { env: env(), stdin: JSON.stringify({ ...FIX_CALL, stepped_back: STEPPED_BACK }) });

    assert.strictEqual(error, `raise: the fix direction comes after the root cause, and no root cause is logged — log it first: engine investigation-log root-cause ${HUNT} --entry <decision>`);
    assert.strictEqual(fs.existsSync(path.join(config, 'conversations', 'sess-1', 'raise-shown.json')), false, 'nothing sealed');
    assert.strictEqual((await raised(FIX_CALL)).res.decision, 'ask');
  });

  it('refuses, writing nothing: a call out of its shape, a place that cannot take it, words out of their line\'s shape, a state or a hypothesis it lacks, and an entry that is none of the unit\'s current ones of its kind', () => {
    log('hypothesis', ['--title', 'Killing every session empties the state']);
    const blank = staged('blank.md', 'One\n\nTwo\n');
    for (const [args, error] of /** @type {[string[], string|RegExp][]} */ ([
      [['what', HUNT], /^Usage: engine investigation-log <symptom\|hypothesis\|experiment\|root-cause\|validation\|fix-direction> …\n/],
      [['symptom', HUNT], 'Usage: engine investigation-log symptom <bugfix> --text "<the person\'s words>" [--body <file>]'],
      [['symptom', HUNT, '--text', 'x', '--entry', made.kill], 'Usage: engine investigation-log symptom <bugfix> --text "<the person\'s words>" [--body <file>]'],
      [['symptom', BUG, '--text', 'x'], `investigation-log: ${BUG}'s investigation has not started — engine enter investigation ${BUG} starts it`],
      [['symptom', FEATURE, '--text', 'x'], 'investigation-log: a feature has no investigation — its phases are experiment, discussion, specification, implementation, review'],
      [['symptom', 'fixed', '--text', 'x'], 'investigation-log: the topic "fixed" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it'],
      [['symptom', HUNT, '--text', 'one\ntwo'], 'investigation-log: --text is one line of words, not empty'],
      [['hypothesis', HUNT, '--title', 'One · two'], 'investigation-log: --title holds "·", which its line\'s shape keeps for itself'],
      [['hypothesis', HUNT, 'H1', '--state', 'likely'], 'investigation-log: --state is suspected, confirmed, ruled-out, intended, not "likely"'],
      [['hypothesis', HUNT, 'H1', '--state', 'intended'], 'investigation-log: an intended hypothesis rests on the person\'s ruling — name it: --by <decision>'],
      [['hypothesis', HUNT, 'H1', '--state', 'confirmed', '--by', made.ruling], 'investigation-log: --by names the person\'s ruling an intended hypothesis rests on — a confirmed one takes none'],
      [['hypothesis', HUNT, 'H1', '--state', 'intended', '--by', made.rootCause], `investigation-log: --by names ${made.rootCause}, a call of Claude's — a hypothesis is intended on the person's ruling`],
      [['hypothesis', HUNT, 'H9', '--state', 'confirmed'], 'investigation-log: the log holds no hypothesis "H9" — a new one is logged with --title'],
      [['hypothesis', HUNT, 'H1'], 'investigation-log: H1 reads so already — log it again with the --title or --state that changed'],
      [['hypothesis', HUNT, 'H1', '--state', 'suspected', '--title', 'Killing every session empties the state'], 'investigation-log: H1 reads so already — log it again with the --title or --state that changed'],
      [['hypothesis', HUNT, 'H1', '--by', made.ruling], 'investigation-log: --by names the person\'s ruling an intended hypothesis rests on — give it with --state intended'],
      [['hypothesis', HUNT, 'H1', '--title', 'One · two'], 'investigation-log: --title holds "·", which its line\'s shape keeps for itself'],
      [['experiment', HUNT, '--title', 'Kill — all', '--showed', 'x', '--entry', made.kill], 'investigation-log: --title holds "—", which its line\'s shape keeps for itself'],
      [['experiment', HUNT, '--title', 'Kill', '--showed', 'x', '--entry', made.rootCause], `investigation-log: --entry names ${made.rootCause}, which is not a finding`],
      [['experiment', HUNT, '--title', 'Kill', '--showed', 'x', '--entry', made.other], `investigation-log: --entry names ${made.other}, which stands in ${FEATURE}, not ${HUNT}`],
      [['experiment', HUNT, '--title', 'Kill', '--showed', 'x', '--entry', 'zz'], 'investigation-log: --entry: "zz" is too short to name a ledger entry — give at least 4 characters of its id'],
      [['root-cause', HUNT, '--entry', made.cause], `investigation-log: --entry names ${made.cause}, which is not a decision`],
      [['validation', HUNT, 'both', '--found', 'x', '--did', 'y'], 'investigation-log: a validation is the root-cause or the fix one, not "both"'],
      [['validation', HUNT, 'fix', '--found', 'x — y', '--did', 'z'], 'investigation-log: --found holds "—", which its line\'s shape keeps for itself'],
      [['symptom', HUNT, '--text', 'x', '--body', blank], `investigation-log: --body ${blank} holds a blank line, which would end the body beneath its entry — join its paragraphs`],
      [['symptom', HUNT, '--text', 'x', '--body', path.join(config, 'none.md')], new RegExp(`^investigation-log: --body ${path.join(config, 'none.md')} cannot be read — `)],
    ])) {
      const said = refused(['investigation-log', ...args]);
      if (typeof error === 'string') assert.strictEqual(said, error, args.join(' '));
      else assert.match(said, error, args.join(' '));
    }
  });

  it('a line under a fixed heading that does not read as its shape is passed over, said among the warnings', () => {
    const warnings = [];
    const hunt = huntIn([
      '## Hypotheses', '', '- H1 · No state', '- H2 · Intended on nothing · intended', '',
      '## Root cause', '', '- Points at nothing', '',
    ].join('\n'), 'hunt/topics/hunt/log.md', warnings);

    assert.deepStrictEqual([hunt.hypotheses, hunt.rootCause], [[], null]);
    assert.deepStrictEqual(warnings, [
      'hunt/topics/hunt/log.md: "H1 · No state" under ## Hypotheses does not read as a hypothesis, and is passed over',
      'hunt/topics/hunt/log.md: "H2 · Intended on nothing · intended" under ## Hypotheses does not read as a hypothesis, and is passed over',
      'hunt/topics/hunt/log.md: "Points at nothing" under ## Root cause does not read as a root cause, and is passed over',
    ]);
  });

  it('a line of the log passed over is said where Claude reads: on the verb\'s response, and ahead of a gate in its DATA', () => {
    writeState(dir, layout.topic(HUNT, HUNT, 'log.md'), '## Hypotheses\n\n- Traced the save through capture()\n');
    const passed = `${layout.topic(HUNT, HUNT, 'log.md')}: "Traced the save through capture()" under ## Hypotheses does not read as a hypothesis, and is passed over`;

    assert.deepStrictEqual(log('hypothesis', ['--title', 'The save races the shutdown']).warnings, [passed]);
    const sections = rendered(['investigation-plan', HUNT, '--file', payload('plan.json', { order: [{ hypothesis: 'H1', check: 'Kill it mid-save' }] })]);
    assert.ok(sections.startsWith(`${data([`warning: ${passed}`])}=== DISPLAY: investigation plan `), sections);
  });
});

describe('the plan and check-in gates — learned process gates (19.4.19)', () => {
  /** The hunt with three hypotheses, the first confirmed and an experiment. */
  function hunting() {
    for (const title of ['Killing every session empties the state', 'kill-server saves an empty state', 'A reboot finds the server gone']) log('hypothesis', ['--title', title]);
    log('experiment', ['--title', 'Kill every session', '--showed', 'each kill shrank it', '--entry', made.kill]);
    log('hypothesis', ['H1', '--state', 'confirmed']);
  }

  const PLAN = { order: [{ hypothesis: 'H3', check: 'Reboot a throwaway machine and read the save' }, { hypothesis: 'H2', check: 'Run kill-server with the runtime live' }] };

  it('the plan: the open hypotheses in the order given, each with how it is checked, those settled so far, then the plan gate, whose yes goes on', () => {
    hunting();

    const sections = rendered(['investigation-plan', HUNT, '--file', payload('plan.json', PLAN)]);

    assert.strictEqual(sections.slice(0, sections.indexOf('=== MENU')), [
      '=== DISPLAY: investigation plan (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Hunt · investigation plan',
      '',
      'IN THE ORDER I\'LL CHECK THEM (2)',
      '  ├─ ○ H3 A reboot finds the server gone',
      '  │     Reboot a throwaway machine and read the save',
      '  └─ ○ H2 kill-server saves an empty state',
      '        Run kill-server with the runtime live',
      '',
      'SETTLED SO FAR (1)',
      '  └─ ✓ H1 Killing every session empties the state    [confirmed]',
      '',
    ].join('\n'));
    const gate = auditGate(rendered(['investigation-plan', HUNT, '--file', payload('plan.json', PLAN)], true), 'investigation-plan');
    assert.strictEqual(gate?.gate, 'plan gate');
    assert.deepStrictEqual(run(['gate', 'plan gate', '--pick', 'y']).next, { kind: 'continue' });
  });

  it('19.S35: a revised plan comes back to the plan gate, saying first what the finding changed (19.4.24)', () => {
    hunting();

    const sections = rendered(['investigation-plan', HUNT, '--file', payload('plan.json', { ...PLAN, changed: 'E1 showed a kill alone empties it, so the reboot comes first' }), '--revised']);

    assert.match(sections, /^Hunt · revised plan\n\nWHAT THE FINDING CHANGED\n {2}E1 showed a kill alone empties it, so the reboot comes first\n\nIN THE ORDER I'LL CHECK THEM \(2\)\n/m);
    assert.match(sections, /^=== MENU: plan gate /m);
  });

  it('the plan refuses: an open hypothesis left out, a settled one ordered, one named twice or not held, none open at all, and what changed without --revised or missing with it', () => {
    hunting();
    const plan = (/** @type {unknown} */ value, /** @type {string[]} */ flags = []) => refused(['render', 'investigation-plan', HUNT, '--file', payload('plan.json', value), ...flags]);

    assert.deepStrictEqual([
      plan({ order: [PLAN.order[0]] }),
      plan({ order: [...PLAN.order, { hypothesis: 'H1', check: 'Again' }] }),
      plan({ order: [...PLAN.order, PLAN.order[0]] }),
      plan({ order: [...PLAN.order, { hypothesis: 'H7', check: 'Again' }] }),
      plan({ order: PLAN.order.map((row) => ({ ...row, check: 'two\nlines' })) }),
      plan({ ...PLAN, changed: 'A finding' }),
      plan(PLAN, ['--revised']),
    ], [
      'render investigation-plan: the plan leaves out H2, which the log holds open — order every open hypothesis, or log it ruled out',
      'render investigation-plan: the plan orders H1, which the log holds settled — a plan orders the hypotheses still open',
      'render investigation-plan: the plan names H3 twice',
      'render investigation-plan: the plan names H7, which the log holds no hypothesis as',
      'render investigation-plan: the plan\'s order[0] check is one line of words, not empty',
      'render investigation-plan: the plan must be {order}',
      'render investigation-plan: the plan must be {order, changed}',
    ]);
    log('hypothesis', ['H2', '--state', 'ruled-out']);
    log('hypothesis', ['H3', '--state', 'ruled-out']);
    assert.strictEqual(plan({ order: [] }), `render investigation-plan: the log holds no open hypothesis — log each one the plan checks first: engine investigation-log hypothesis ${HUNT} --title "<title>"`);
  });

  it('the check-in: every hypothesis, those just resolved marked, the experiments with what each showed and what comes next, then the check-in gate', () => {
    hunting();

    const sections = rendered(['investigation-check-in', HUNT, '--file', payload('check-in.json', { resolved: ['H1'], next: 'Run kill-server with the runtime live' })]);

    assert.strictEqual(sections.slice(0, sections.indexOf('=== MENU')), [
      '=== DISPLAY: investigation check-in (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Hunt · check-in',
      '',
      '3 hypotheses · 1 confirmed · 1 experiment',
      '',
      'HYPOTHESES (3)',
      '  ├─ ✓ H1 Killing every session empties the state [confirmed · just now]',
      '  ├─ ○ H2 kill-server saves an empty state        [open]',
      '  └─ ○ H3 A reboot finds the server gone          [open]',
      '',
      'EXPERIMENTS (1)',
      '  └─ ✓ E1 Kill every session',
      '        each kill shrank it',
      '',
      'NEXT',
      '  Run kill-server with the runtime live',
      '',
    ].join('\n'));
    const gate = auditGate(rendered(['investigation-check-in', HUNT, '--file', payload('check-in.json', { resolved: ['H1'], next: 'Run kill-server' })], true), 'investigation-check-in');
    assert.strictEqual(gate?.gate, 'check-in gate');
    assert.deepStrictEqual(run(['gate', 'check-in gate', '--pick', 'y']).next, { kind: 'continue' });
  });

  it('an intended hypothesis is drawn with the ruled-out glyph, as 20.12.1 draws it (19.4.13)', () => {
    hunting();
    log('hypothesis', ['H3', '--state', 'intended', '--by', made.ruling]);

    const sections = rendered(['investigation-check-in', HUNT, '--file', payload('check-in.json', { resolved: ['H3'], next: 'Run kill-server' })]);

    assert.match(sections, /^ {2}└─ – H3 A reboot finds the server gone +\[intended · just now\]$/m);
  });

  it('the check-in refuses one still open, none resolved, and its payload out of shape', () => {
    hunting();
    const checkIn = (/** @type {unknown} */ value) => refused(['render', 'investigation-check-in', HUNT, '--file', payload('check-in.json', value)]);

    assert.deepStrictEqual([checkIn({ resolved: ['H2'], next: 'x' }), checkIn({ resolved: [], next: 'x' }), checkIn({ resolved: ['H1'] })], [
      `render investigation-check-in: the check-in names H2, which the log holds open — log where it stands first: engine investigation-log hypothesis ${HUNT} H2 --state <state>`,
      'render investigation-check-in: the check-in names no hypothesis resolved — a check-in comes once one is',
      'render investigation-check-in: the check-in must be {resolved, next}',
    ]);
  });

  it('each gate refuses a place whose investigation is not open, and a call with no payload', () => {
    const file = payload('plan.json', PLAN);
    assert.deepStrictEqual([
      refused(['render', 'investigation-plan', BUG, '--file', file]),
      refused(['render', 'investigation-check-in', 'fixed', '--file', file]),
      refused(['render', 'investigation-plan', HUNT]),
      refused(['render', 'investigation-check-in', HUNT]),
    ], [
      `render investigation-plan: ${BUG}'s investigation has not started — engine enter investigation ${BUG} starts it`,
      'render investigation-check-in: the topic "fixed" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it',
      'render investigation-plan: Usage: engine render investigation-plan <bugfix> --file <plan.json> [--revised]',
      'render investigation-check-in: Usage: engine render investigation-check-in <bugfix> --file <check-in.json>',
    ]);
  });
});

describe('the validations\' briefs — both always run (19.4.7)', () => {
  /** A validation of `kind` dispatched at `unit`'s investigation, in flight: its id. @param {string} kind @param {string} [unit] */
  const dispatched = (kind, unit = RIPE) => run(['agent', 'dispatch', unit, 'investigation', unit, '--kind', kind]).id;

  /** The brief stored for `id`, and the record of whose it is. @param {string} id */
  const stored = (id) => {
    const file = (/** @type {string} */ ext) => path.join(config, 'conversations', 'sess-1', 'briefs', `${id}.${ext}`);
    return { text: fs.readFileSync(file('md'), 'utf8'), issued: JSON.parse(fs.readFileSync(file('json'), 'utf8')) };
  };

  it('19.S10: the fix\'s brief, for the unit, carries the investigation\'s log, its record, the root cause and the fix it rests on, the code, and the report\'s file in the investigation\'s store', () => {
    const agent = dispatched('fix-validation');

    const issued = run(['brief', 'fix-validation', RIPE, '--agent', agent]);

    assert.deepStrictEqual([issued.role, issued.agent], ['fix-validation', 'leeway-investigation-fix-validation']);
    const shown = JSON.parse(output(dir, ['ledger', 'record', RIPE, RIPE], { env: env() }));
    delete shown.ok;
    const record = JSON.stringify(shown, null, 2);
    const { text, issued: whose } = stored(issued.id);
    assert.strictEqual(text, [
      `Brief ${issued.id} — the fix validation's, for ${RIPE}`,
      '',
      '# The investigation\'s log',
      '',
      `\`${at(layout.topic(RIPE, RIPE, 'log.md'))}\``,
      '',
      '# The investigation\'s record',
      '',
      '```json', record, '```',
      '',
      '# The root cause',
      '',
      `${ripe.rootCause}: Every save takes the session list as the whole truth, so an empty list empties the save.`,
      '',
      '# The fix',
      '',
      `${ripe.fix}: Never save an empty capture over a full one.`,
      '',
      `It answers ${ripe.asked}: How should restore stop losing sessions?`,
      '',
      '# The code',
      '',
      `- \`${fs.realpathSync(dir)}\``,
      '',
      '# Your report',
      '',
      `\`${at(layout.cache(RIPE, 'investigation', RIPE, `${agent}.md`))}\``,
      '',
    ].join('\n'));
    assert.deepStrictEqual(whose, { role: 'fix-validation', agent: 'leeway-investigation-fix-validation', unit: RIPE, task: null, topic: null });
  });

  it('the root cause\'s brief carries no fix: the root cause is validated before the fix is set out', () => {
    const issued = run(['brief', 'root-cause-validation', RIPE, '--agent', dispatched('root-cause-validation')]);

    assert.strictEqual(issued.agent, 'leeway-investigation-root-cause-validation');
    assert.deepStrictEqual(stored(issued.id).text.split('\n').filter((line) => line.startsWith('# ')), ['# The investigation\'s log', '# The investigation\'s record', '# The root cause', '# The code', '# Your report']);
  });

  it('refuses, issuing nothing: a dispatch of another kind, or no longer in flight; an investigation not open; and a root cause or a fix resting on no current entry', () => {
    const fix = dispatched('fix-validation');
    run(['agent', 'incorporate', RIPE, 'investigation', RIPE, fix]);
    const rootCause = dispatched('root-cause-validation');
    const hunting = { rootCause: dispatched('root-cause-validation', HUNT), fix: dispatched('fix-validation', HUNT) };
    log('root-cause', ['--entry', made.rootCause]);
    log('fix-direction', ['--question', made.fix]);

    assert.deepStrictEqual([
      refused(['brief', 'fix-validation', RIPE, '--agent', rootCause]),
      refused(['brief', 'fix-validation', RIPE, '--agent', fix]),
      refused(['brief', 'fix-validation', HUNT, '--agent', hunting.fix]),
    ], [
      `brief: ${rootCause} is a root-cause-validation dispatch, and the fix-validation's brief is for a fix-validation`,
      `brief: ${fix} is incorporated — a brief is issued for a dispatch still in flight`,
      `brief: the fix direction's question ${made.fix} has no answer yet — the fix is its answer, raised: engine raise ${AT} --answers ${made.fix}`,
    ]);
    const { write } = ledgerHelpers(() => dir);
    write('replace', AT, ['--replaces', made.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'E6 showed it.' });
    assert.strictEqual(refused(['brief', 'root-cause-validation', HUNT, '--agent', hunting.rootCause]),
      `brief: the root cause logged points at no current entry — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`);
    ok(dir, ['topic', 'complete', RIPE, 'investigation', RIPE]);
    assert.strictEqual(refused(['brief', 'root-cause-validation', RIPE, '--agent', rootCause]),
      'brief: the topic "ripe" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it');
  });
});

describe('the conclude — a learned process gate, and its yes (19.4.23, 24.1.2)', () => {
  const RECAP = Object.freeze({ hunt: 'Three hypotheses; killing every session emptied the save each time, and the save trusted whatever it captured.' });

  /** The conclude drawn for `unit`, its recap staged where `recap` is given. @param {string} [unit] @param {unknown} [recap] @param {boolean} [announced] */
  const conclude = (unit = RIPE, recap = RECAP, announced = false) => rendered(['conclude', unit, ...(recap === null ? [] : ['--file', payload('recap.json', recap)])], announced);

  /** The conclude's refusal, writing nothing. @param {string} [unit] @param {unknown} [recap] */
  const concludeRefused = (unit = RIPE, recap = RECAP) => refused(['render', 'conclude', unit, ...(recap === null ? [] : ['--file', payload('recap.json', recap)])]);

  /** Where the recap is staged. */
  const stagedRecap = () => at(layout.cache(RIPE, 'investigation', RIPE, 'conclude.json'));

  /** A ledger write at `ripe`'s investigation: its short id. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
  const wrote = (verb, flags, content) => ledgerHelpers(() => dir).write(verb, RIPE_AT, flags, content, env()).id;

  it('19.S34: the recap of the hunt, the symptoms in the person\'s words, the root cause told against them and the fix direction, then the conclude gate — no sign-off before it', () => {
    const sections = conclude();

    assert.strictEqual(sections.slice(0, sections.indexOf('=== MENU')), [
      '=== DISPLAY: investigation conclude (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Ripe · conclude',
      '',
      'THE HUNT',
      '  Three hypotheses; killing every session emptied the save each',
      '  time, and the save trusted whatever it captured.',
      '',
      'SYMPTOMS (2)',
      '  • I killed every session and restore brought nothing back',
      '  • After a reboot the sessions were gone too',
      '',
      'ROOT CAUSE',
      '  Every save takes the session list as the whole truth, so an',
      '  empty list empties the save.',
      '',
      'FIX DIRECTION',
      '  Never save an empty capture over a full one.',
      '',
    ].join('\n'));
    const gate = auditGate(conclude(RIPE, RECAP, true), 'conclude');
    assert.strictEqual(gate?.gate, 'conclude gate');
    assert.deepStrictEqual(gate?.options.map(({ key, word }) => `${key}/${word}`), ['y/yes', 'k/keep going']);
    assert.deepStrictEqual(run(['gate', 'conclude gate', '--pick', 'k']).next, { kind: 'continue' });
    conclude();
    assert.deepStrictEqual(run(['gate', 'conclude gate', '--pick', 'y']).next, { kind: 'engine', argv: ['investigation', 'conclude', RIPE] });
  });

  it('24.S17, 19.S15: the yes completes the investigation, stamps its close and commits it, the log riding along, releases its place and hands off into the spec, whose entry reads the investigation and whose writer\'s brief draws the root cause, the fix and each rule the fix keeps — never the spec\'s own', () => {
    run(['enter', 'investigation', RIPE]);
    const held = () => run(['presence', 'scan', RIPE]).sessions.map(({ phase, topic }) => `${phase} ${topic}`);
    assert.deepStrictEqual(held(), [`investigation ${RIPE}`]);
    conclude();
    writeState(dir, layout.topic(RIPE, RIPE, 'log.md'), `${readState(dir, layout.topic(RIPE, RIPE, 'log.md'))}\nThe conversation's last words.\n`);

    const res = withFrozenClock(() => run(['investigation', 'conclude', RIPE]));

    assert.deepStrictEqual(res, {
      ok: true, unit: RIPE, concluded_at: FROZEN_AT, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway-specification-process', args: ['bugfix', RIPE] },
    });
    assert.deepStrictEqual(readManifest(dir, RIPE).phases.investigation.items[RIPE], { status: 'completed', concluded_at: FROZEN_AT });
    assert.strictEqual(lastMessage(dir), `investigation(${RIPE}): conclude`);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '', 'the log rode along');
    assert.strictEqual(fs.existsSync(stagedRecap()), false, 'the staged recap goes');
    assert.deepStrictEqual(held(), [], 'the conclude releases the investigation\'s place');
    assert.strictEqual(refused(['enter', 'investigation', RIPE]), `the topic "${RIPE}" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it`);
    const { sections } = drawn(['enter', 'specification', RIPE]);
    assert.deepStrictEqual(sections.split('\n').filter((line) => /^(record|topic log): /.test(line)), [
      `record: \`${ENGINE} ledger record ${RIPE} ${RIPE}\``,
      `record: \`${ENGINE} ledger record ${RIPE}\``,
      `topic log: ${at(layout.topic(RIPE, RIPE, 'log.md'))}`,
    ], 'the spec reads the investigation\'s record and its log (19.4.15, 11.1.6)');
    const { write } = ledgerHelpers(() => dir);
    const gap = write('ask', `${RIPE}.specification`, [], { ...CLAUDE, text: 'How many saves does restore keep?' }, env()).id;
    write('decide', `${RIPE}.specification`, ['--answers', gap], { ...PERSON, text: 'Three saves.', why: 'Enough to fall back on.' }, env());

    const { id } = run(['brief', 'spec-writer', RIPE]);

    const brief = fs.readFileSync(path.join(config, 'conversations', 'sess-1', 'briefs', `${id}.md`), 'utf8');
    assert.strictEqual(brief.split('# The investigation\n\n')[1].split('\n\n# ')[0], [
      `- The root cause, ${ripe.rootCause}: Every save takes the session list as the whole truth, so an empty list empties the save.`,
      `- The fix, ${ripe.fix}: Never save an empty capture over a full one.`,
      `- A rule it keeps, ${ripe.ruling}: A session you kill never comes back.`,
    ].join('\n'));
  });

  it('a root cause replaced is validated again, and so is the fix checked against it, kept or replaced; one dispatched since and not yet taken in is named where it stands, never dispatched again, and one of the other kind, or closed unread, never counts (19.4.7, 26.4.10)', () => {
    const store = `${RIPE} investigation ${RIPE}`;
    /** The refusal of what has not been validated since it was logged. @param {string} what @param {string} short @param {string} kind @param {string} logged */
    const unvalidated = (what, short, kind, logged) => `render conclude: the ${what} ${short} has not been validated since ${logged} — both validations always run: engine agent dispatch ${store} --kind ${kind}, its brief engine brief ${kind} ${RIPE} --agent <id>, and its report taken in`;
    /** The refusal of what is being validated, by where its validation stands. @param {string} what @param {string} short @param {string} stands */
    const being = (what, short, stands) => `render conclude: the ${what} ${short} is being validated — ${stands}`;
    const fixSince = 'it, or the root cause it rests on, was logged';
    const rootCause = wrote('replace', ['--replaces', ripe.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'The trace showed it.' });
    ok(dir, ['investigation-log', 'root-cause', RIPE, '--entry', rootCause]);
    assert.strictEqual(concludeRefused(), unvalidated('root cause', rootCause, 'root-cause-validation', 'it was logged'));

    const row = run(['agent', 'dispatch', RIPE, 'investigation', RIPE, '--kind', 'root-cause-validation']);
    assert.strictEqual(concludeRefused(), being('root cause', rootCause, `${row.id} is still running — the conclude waits for its report`));
    fs.writeFileSync(row.file, `# Validation — ${row.id}\n\n## Summary\n\nIt holds, but for one path.\n\n## Findings\n\n### F1: A reboot\n\nA reboot saves before the capture.\n`);
    assert.strictEqual(concludeRefused(), being('root cause', rootCause, `${row.id}'s report is in — engine agent scan ${store} reads it in, then engine agent ack ${store} ${row.id} with its findings, or --clean`));
    run(['agent', 'scan', RIPE, 'investigation', RIPE]);
    assert.strictEqual(concludeRefused(), being('root cause', rootCause, `${row.id}'s report is in — engine agent ack ${store} ${row.id} with its findings, or --clean`));
    run(['agent', 'ack', RIPE, 'investigation', RIPE, row.id, '--findings', 'F1']);
    assert.strictEqual(concludeRefused(), being('root cause', rootCause, `${row.id}'s findings are acknowledged — once each is acted on, engine agent incorporate ${store} ${row.id} takes it in`));
    run(['agent', 'incorporate', RIPE, 'investigation', RIPE, row.id]);
    assert.strictEqual(concludeRefused(), unvalidated('fix', ripe.fix, 'fix-validation', fixSince), 'the fix kept was validated against the root cause replaced');

    const lost = ok(dir, ['agent', 'dispatch', RIPE, 'investigation', RIPE, '--kind', 'fix-validation'], { env: { ...env(), CLAUDE_PID: GONE } }).id;
    assert.strictEqual(concludeRefused(), being('fix', ripe.fix, `${lost} was lost with the process that dispatched it — engine agent incorporate ${store} ${lost} abandons it, and another is dispatched`));
    run(['agent', 'incorporate', RIPE, 'investigation', RIPE, lost]);
    assert.strictEqual(concludeRefused(), unvalidated('fix', ripe.fix, 'fix-validation', fixSince), 'closed unread');
    validated(dir, RIPE, 'fix-validation', env());
    conclude();

    const fix = wrote('replace', ['--replaces', ripe.fix, '--reason', 'changed-mind'], { ...CLAUDE, drops: ['over a full one'], text: 'Keep the last few saves, and restore from the newest with sessions in it.', why: 'A save gone wrong falls back.' });
    assert.strictEqual(concludeRefused(), unvalidated('fix', fix, 'fix-validation', fixSince));
    validated(dir, RIPE, 'fix-validation', env());
    assert.match(conclude(), /^FIX DIRECTION\n {2}Keep the last few saves, and restore from the newest with\n {2}sessions in it\.$/m);
  });

  it('refuses, writing nothing: a place whose investigation is not open, a root cause or a fix resting on no current entry, a question of the person\'s open at the place, mail waiting, and a recap out of its shape', () => {
    const asked = wrote('ask', [], { ...PERSON, text: 'Should restore say what it lost?' });

    assert.deepStrictEqual([
      concludeRefused(BUG),
      concludeRefused('fixed'),
      concludeRefused(HUNT),
      concludeRefused(RIPE),
      refused(['render', 'conclude']),
    ], [
      `render conclude: ${BUG}'s investigation has not started — engine enter investigation ${BUG} starts it`,
      'render conclude: the topic "fixed" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it',
      `render conclude: no root cause is logged — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`,
      `render conclude: a question of the person's is open at the investigation — ${asked} "Should restore say what it lost?" — each is answered before it concludes`,
      'render conclude: Usage: engine render conclude <bugfix> [--file <recap.json>]',
    ]);
    wrote('decide', ['--answers', asked], { ...PERSON, text: 'Yes, in one line.', why: 'The person wants to know.' });
    assert.strictEqual(concludeRefused(RIPE, { hunt: 'two\nlines' }), 'render conclude: the recap\'s hunt is one paragraph of words, not empty');
    assert.strictEqual(concludeRefused(RIPE, { recap: 'x' }), 'render conclude: the recap must be {hunt, fixes?, area?}');

    log('root-cause', ['--entry', made.rootCause]);
    assert.strictEqual(concludeRefused(HUNT), `render conclude: no fix direction is logged — log it once its question is raised: engine investigation-log fix-direction ${HUNT} --question <question>`);
    log('fix-direction', ['--question', made.fix]);
    assert.strictEqual(concludeRefused(HUNT), `render conclude: the fix direction's question ${made.fix} has no answer yet — the fix is its answer, raised: engine raise ${AT} --answers ${made.fix}`);
    ledgerHelpers(() => dir).write('replace', AT, ['--replaces', made.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'The trace showed it.' });
    assert.strictEqual(concludeRefused(HUNT), `render conclude: the root cause logged points at no current entry — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`);

    writeState(dir, layout.mailbox(RIPE, RIPE, '001-also-on-reboot.md'), 'It happens on a reboot too\n');
    assert.strictEqual(concludeRefused(), `render conclude: 1 message(s) wait in its mailbox — raise and answer each first: engine topic mailbox ${RIPE} ${RIPE}`);
  });

  it('the yes stands on the screen as drawn: refused, writing nothing, with nothing staged, or what is staged drawn before the root cause or the fix changed, and as the gate refuses', () => {
    assert.strictEqual(refused(['investigation', 'conclude', RIPE]), `investigation conclude: nothing is staged for ${RIPE}'s conclude — engine render conclude ${RIPE} --file <recap.json> stages Claude's recap`);
    assert.strictEqual(refused(['render', 'conclude', RIPE]), `render conclude: nothing is staged for ${RIPE}'s conclude — engine render conclude ${RIPE} --file <recap.json> stages Claude's recap`);
    conclude();
    wrote('replace', ['--replaces', ripe.fix, '--reason', 'changed-mind'], { ...CLAUDE, drops: ['over a full one'], text: 'Keep the last few saves.', why: 'A save gone wrong falls back.' });
    validated(dir, RIPE, 'fix-validation', env());
    const stale = `the conclude was drawn before the root cause or the fix changed — it is staged again with engine render conclude ${RIPE} --file <recap.json>`;
    assert.deepStrictEqual([refused(['investigation', 'conclude', RIPE]), refused(['render', 'conclude', RIPE])], [`investigation conclude: ${stale}`, `render conclude: ${stale}`]);
    assert.deepStrictEqual([['investigation', 'conclude'], ['investigation', 'conclude', RIPE, '--unit', FEATURE], ['investigation', 'conclude', RIPE, '--fixes'], ['investigation', 'close', RIPE]].map((args) => refused(args)), Array(4).fill('Usage: engine investigation conclude <bugfix> [--fixes <unit> [--area <area>]]'));
    assert.strictEqual(refused(['investigation', 'conclude', HUNT]), `investigation conclude: no root cause is logged — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`);
  });

  /** The project's verify setup recorded, its feature map beside it. */
  function verifySetUp() {
    const project = JSON.parse(readState(dir, layout.projectManifest));
    const verify = {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      ran: { unit: FEATURE, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-11-01T09:00:00.000Z' },
    };
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { verify } }, null, 2));
    commitAll(dir, 'the verify setup');
  }

  it('17.1.9: what the bug is in rides the recap to the yes on no line of the screen, and the yes keeps it on the investigation\'s item — the unit whose code it fixes and the feature map\'s area — none kept from an earlier close', () => {
    const plain = conclude();
    verifySetUp();
    const named = conclude(RIPE, { ...RECAP, fixes: FEATURE, area: 'session restore' });

    assert.strictEqual(named.slice(0, named.indexOf('=== MENU')), plain.slice(0, plain.indexOf('=== MENU')), 'the person sees no flag for it (17.2.2)');
    const { next } = run(['gate', 'conclude gate', '--pick', 'y']);
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['investigation', 'conclude', RIPE, '--fixes', FEATURE, '--area', 'session restore'] });
    withFrozenClock(() => run(next.argv));
    assert.deepStrictEqual(readManifest(dir, RIPE).phases.investigation.items[RIPE], { status: 'completed', concluded_at: FROZEN_AT, fixes: FEATURE, area: 'session restore' });

    run(['manifest', 'set', `${RIPE}.investigation.${RIPE}`, 'status', 'in-progress']);
    conclude(RIPE, { ...RECAP, fixes: FEATURE });
    assert.deepStrictEqual(run(['gate', 'conclude gate', '--pick', 'y']).next.argv, ['investigation', 'conclude', RIPE, '--fixes', FEATURE]);
    run(['investigation', 'conclude', RIPE]);
    const { fixes, area } = readManifest(dir, RIPE).phases.investigation.items[RIPE];
    assert.deepStrictEqual([fixes, area], [undefined, undefined], 'a bug in code no unit built names none, and nothing is kept from the earlier close');
  });

  it('refuses what the bug is in, writing nothing: a unit the project lacks or this one, an area with no unit, an area where no verify setup is recorded, and one past a line', () => {
    const recap = (/** @type {Record<string, string>} */ bug) => concludeRefused(RIPE, { ...RECAP, ...bug });
    assert.deepStrictEqual([
      recap({ fixes: 'nowhere' }),
      recap({ fixes: RIPE }),
      recap({ area: 'session restore' }),
      recap({ fixes: FEATURE, area: 'session restore' }),
    ], [
      'render conclude: there is no work unit "nowhere" to fix — --fixes names the unit whose code the bug is in, and none where no unit built it',
      `render conclude: ${RIPE} cannot fix its own code — --fixes names the unit whose code the bug is in`,
      'render conclude: an area is named with the unit whose code the bug is in — --fixes <unit> --area <area>',
      'render conclude: no verify setup is recorded, so no feature map names an area — leave the area out',
    ]);
    verifySetUp();
    assert.strictEqual(recap({ fixes: FEATURE, area: 'session\nrestore' }), 'render conclude: the area is one line of words, an area of the verify setup\'s feature map');

    conclude();
    assert.deepStrictEqual([['--fixes', 'nowhere'], ['--area', 'session restore']].map((flags) => refused(['investigation', 'conclude', RIPE, ...flags])), [
      'investigation conclude: there is no work unit "nowhere" to fix — --fixes names the unit whose code the bug is in, and none where no unit built it',
      'investigation conclude: an area is named with the unit whose code the bug is in — --fixes <unit> --area <area>',
    ]);
  });

  it('16.10.5: a call the person changed in the investigation is asked its verdict first, at the conclusion, and the yes waits for it; none changed, none asked', async () => {
    const asked = wrote('ask', [], { ...CLAUDE, text: 'Should restore say what it lost?' });
    const call = {
      question: 'Should restore say what it lost?',
      rows: [
        { key: '1', name: 'Quiet', text: 'Restore says nothing', notice: 'nothing changes' },
        { key: '2', name: 'Say', text: 'Restore names what it could not bring back', notice: 'a line after restore' },
      ],
      lean: '1', why: 'Restore is quiet today.', sort: 'one', mechanism: 'Restore prints one line.', product_wide: false,
    };
    const { res } = await okSectionsAsync(dir, ['raise', RIPE_AT, '--answers', asked], { env: env(), stdin: JSON.stringify(call) });
    ok(dir, ['raise', 'answer', res.raise, '--pick', '2'], { env: env(), stdin: JSON.stringify({ why: 'The person wants to know.' }) });

    const sections = conclude();

    assert.match(sections, /^YOUR VERDICT \(1 of 1 call you changed\)$/m);
    assert.match(sections, /^=== MENU: verdict /m);
    assert.strictEqual(refused(['investigation', 'conclude', RIPE]), `investigation conclude: a verdict is still to ask — engine render conclude ${RIPE} asks each before the yes`);
    const { next } = run(['gate', 'verdict', '--pick', 'n']);
    assert.deepStrictEqual(next.argv.slice(-2), ['--at', 'conclusion']);
    run(next.argv);
    const after = conclude(RIPE, null);
    assert.doesNotMatch(after, /YOUR VERDICT/);
    assert.match(after, /^=== MENU: conclude gate /m);
    assert.strictEqual(run(['investigation', 'conclude', RIPE]).unit, RIPE);
  });
});
