'use strict';

// ---------------------------------------------------------------------------
// A bugfix's investigation: its entry, `engine enter investigation <bugfix>`
// (leeway-engine/scripts/domain/enter.cjs), its one topic the unit, started
// as a discussion's is and reading the brief, discovery's log and the seeds
// in full before it opens (8.S54, 8.7.7), refused where the unit cannot take
// it; its log, `engine investigation-log` (domain/investigation-log.cjs), the
// hunt under fixed headings in the topic's log, each line resting on its
// ledger entry, the fix direction only after a current root cause (19.S7,
// 19.4.1–19.4.3), every refusal writing nothing; and its plan and check-in
// gates, `render investigation-plan|investigation-check-in`
// (domain/investigation.cjs, domain/projections/investigation.cjs), drawn
// from the log and Claude's payload, the revised plan back at the plan gate
// (19.S35, 19.4.19, 19.4.24).
//
// Layer: verb. World, built once and copied: a bugfix, `crash`, from two
// seeds, with its brief and discovery's log, not yet started; a bugfix,
// `hunt`, its investigation entered, with the ledger entries its hunt rests
// on — the root cause answering the cause, a finding, the person's ruling, a
// question for the fix; a feature under discussion with a question of its
// own; a bugfix with its spec, and one whose investigation has concluded.
// Each test's conversation has its own system config.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, output, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, stateGit, lastMessage, head, fixtureFrom, cleanupFixture,
  withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { auditGate } = require('./gate-audit.cjs');
const { huntIn } = require('../../skills/leeway-engine/scripts/domain/investigation-log.cjs');

const BUG = 'crash';
const HUNT = 'hunt';
const FEATURE = 'quick-sync';
const AT = `${HUNT}.investigation.${HUNT}`;
const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const TODAY = FROZEN_AT.slice(0, 10);
const CLAUDE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });

/** The ledger entries the hunt rests on, by short id. */
const made = { cause: '', rootCause: '', kill: '', keep: '', ruling: '', fix: '', other: '' };

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

  it('a resume starts nothing and reads the topic\'s record and map besides', () => {
    const before = head(dir);
    const { res, sections } = drawn(['enter', 'investigation', HUNT]);

    assert.deepStrictEqual([res.started, res.committed, head(dir)], [false, undefined, before]);
    assert.deepStrictEqual(sections.split('\n').filter((line) => /^(product|record|map): /.test(line)), [
      `product: \`${ENGINE} ledger product ${HUNT} ${HUNT}\``, `record: \`${ENGINE} ledger record ${HUNT} ${HUNT}\``, `map: \`${ENGINE} ledger map ${HUNT} ${HUNT}\``,
    ]);
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

  it('a body goes beneath its entry, indented, and is read back with it — a hypothesis\'s across all its lines (20.12.2)', () => {
    log('hypothesis', ['--title', 'The daemon saves a dying server', '--body', staged('first.md', 'The last save lands\n  as the server dies.\n')]);
    log('symptom', ['--text', 'Restore finds nothing']);
    log('hypothesis', ['H1', '--state', 'confirmed', '--body', staged('then.md', 'E2 caught it.')]);

    assert.strictEqual(huntLog(), [
      '## Hypotheses', '', '- H1 · The daemon saves a dying server · suspected', '    The last save lands', '      as the server dies.',
      '- H1 · The daemon saves a dying server · confirmed', '    E2 caught it.', '', '## Symptoms', '', '- Restore finds nothing', '',
    ].join('\n'));
    assert.deepStrictEqual(huntIn(huntLog(), 'log.md', []).hypotheses[0].body, ['The last save lands', '  as the server dies.', 'E2 caught it.']);
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
    log('root-cause', ['--entry', replaced]);
    assert.strictEqual(log('fix-direction', ['--question', made.fix]).line, `- How should restore stop losing sessions? [${full(made.fix)}]`);
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

  it('a line under a fixed heading that does not read as its shape is passed over, said among the warnings; an old investigation\'s lists under ## Investigation are its prose', () => {
    const warnings = [];
    const hunt = huntIn([
      '## Investigation', '', '- H1 · An old hypothesis · confirmed', '',
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
    ], [
      `render investigation-plan: ${BUG}'s investigation has not started — engine enter investigation ${BUG} starts it`,
      'render investigation-check-in: the topic "fixed" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it',
      'render investigation-plan: Usage: engine render investigation-plan <bugfix> --file <plan.json>',
    ]);
  });
});
