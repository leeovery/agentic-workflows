'use strict';

// ---------------------------------------------------------------------------
// A bugfix's investigation's close: its validations' briefs, `brief
// root-cause-validation|fix-validation` (ledger-engine/scripts/domain/
// brief-records.cjs), both always run (19.4.7) — each from the hunt's log,
// the record, what the hunt rests on and the code, the fix's carrying the
// root cause and the fix it rests on, the root cause's no fix (19.S10) —
// and what they refuse, issuing nothing; and its conclude
// (domain/investigation-conclude.cjs): the conclude gate, `render
// conclude`, a verdict owed asked first — none where the gate runs as an
// automatic step, each waiting in the verdict queue (16.10.11), its showing
// told by when its recap was staged, a recap staged again only to respell
// its area keeping it, and a conclude set aside held at the investigation
// through the raises and the verdicts asked meanwhile — and its yes,
// `investigation conclude`, standing only once the root cause and the fix rest on current
// entries, both validated since, nothing of the person's open and no mail
// waiting, which completes the item, stamps its close, releases its place
// and hands off into the spec (19.S15, 19.S34, 24.S17, 16.10.5); and what the
// bug is in, the unit whose code it fixes and the feature map's area,
// staged with the recap on no line of the screen, and kept by the yes on the
// item with whether that unit's review had ended then, for the bugs found
// after review (17.1.9, 17.S4). Its entry, log and gates are
// test-engine-investigation.cjs's.
//
// Layer: verb. World: investigation-world.cjs's, copied for each test, each
// test's conversation with a system config of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, layout, okSectionsAsync, writeState, readState, readManifest, commitAll, stateGit, lastMessage, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { auditGate } = require('./gate-audit.cjs');
const decisionPoint = require('../../skills/ledger-engine/scripts/domain/decision-point.cjs');
const { TRUST_LOG } = require('../../skills/ledger-engine/scripts/domain/trust-log.cjs');
const { history, lines, DAY, shownIn, showingAnswers } = require('./trust-world.cjs');
const {
  HUNT, RIPE, AT, CLAUDE, made, ripe, useInvestigationWorld, BUG, FEATURE, RIPE_AT, ENGINE, PERSON, GONE, validated, data,
} = require('./investigation-world.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversation's folder
const {
  env, run, refused, log, at, drawn, rendered, payload,
} = useInvestigationWorld((copy) => ({ dir, config } = copy));

/** The investigation item as its conclude leaves it, completed. @param {string} unit */
function concludedItem(unit) {
  const manifest = readManifest(dir, unit);
  manifest.phases.investigation.items[unit].status = 'completed';
  writeState(dir, layout.manifest(unit), JSON.stringify(manifest, null, 2) + '\n');
}

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

    assert.deepStrictEqual([issued.role, issued.agent], ['fix-validation', 'ledger-investigation-fix-validation']);
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
    assert.deepStrictEqual(whose, { role: 'fix-validation', agent: 'ledger-investigation-fix-validation', unit: RIPE, task: null, topic: null });
  });

  it('the root cause\'s brief carries no fix: the root cause is validated before the fix is set out', () => {
    const issued = run(['brief', 'root-cause-validation', RIPE, '--agent', dispatched('root-cause-validation')]);

    assert.strictEqual(issued.agent, 'ledger-investigation-root-cause-validation');
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
    concludedItem(RIPE);
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
      '=== DISPLAY: investigation conclude (emit verbatim as a text code block (```text fence) — do not stop; continue as the skill instructs) ===',
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
    // A permission for the hunt, asked at the investigation's own level, is
    // never a rule the fix keeps (19.4.20).
    const { write } = ledgerHelpers(() => dir);
    const live = write('ask', `${RIPE}.investigation`, [], { ...CLAUDE, text: 'May I run the save against the live server?' }, env()).id;
    write('decide', `${RIPE}.investigation`, ['--answers', live], { ...PERSON, text: 'Never run it against the live server.', why: 'Live data is the customers\'.' }, env());
    conclude();
    writeState(dir, layout.topic(RIPE, RIPE, 'log.md'), `${readState(dir, layout.topic(RIPE, RIPE, 'log.md'))}\nThe conversation's last words.\n`);

    const res = withFrozenClock(() => run(['investigation', 'conclude', RIPE]));

    assert.deepStrictEqual(res, {
      ok: true, unit: RIPE, concluded_at: FROZEN_AT, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'ledger-specification-process', args: ['bugfix', RIPE] },
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
    assert.deepStrictEqual([['investigation', 'conclude'], ['investigation', 'conclude', RIPE, '--fixes', FEATURE], ['investigation', 'conclude', RIPE, '--area', 'session restore'], ['investigation', 'close', RIPE]].map((args) => refused(args)), Array(4).fill('Usage: engine investigation conclude <bugfix>'));
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

  /** The verify setup taken off the project. */
  function verifyGone() {
    const { environment, ...project } = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify(project, null, 2));
    commitAll(dir, 'no verify setup');
  }

  /** `ripe`'s investigation reopened as the product reopens it: a message to the topic, the question it raised answered. */
  function reopened() {
    writeState(dir, '.cache/scratch/also.md', 'Also on reboot\n\nIt happens on a reboot too.\n');
    run(['topic', 'send', RIPE, RIPE, '--from', RIPE, '--content', at('.cache/scratch/also.md'), '--slug', 'also-on-reboot']);
    const asked = wrote('ask', [], { ...CLAUDE, text: 'Does a reboot lose sessions too?' });
    wrote('decide', ['--answers', asked], { ...PERSON, text: 'Yes, the same way.', why: 'The person saw it.' });
    run(['topic', 'answered', RIPE, RIPE, '001-also-on-reboot', '--entry', asked]);
  }

  /** `unit`'s review phase ended by Claude settling its failing round, none passing. @param {string} unit */
  function reviewSettled(unit) {
    const round = (/** @type {string|null} */ settled) => JSON.stringify({ reports: [], passed: false, can_now: [], findings: [], settled, scenarios: [] });
    writeState(dir, `${unit}/review/round-1.json`, round(null));
    writeState(dir, `${unit}/review/round-2.json`, round('The finding was a nit at heart.'));
  }

  /** `ripe` concluded at its gate's yes, its recap naming `bug`: what its item keeps of the bug. @param {Record<string, string>} bug */
  function closedWith(bug) {
    conclude(RIPE, { ...RECAP, ...bug });
    run(run(['gate', 'conclude gate', '--pick', 'y']).next.argv);
    const { fixes, area, after_review: after } = readManifest(dir, RIPE).phases.investigation.items[RIPE];
    return { fixes, area, after };
  }

  it('17.1.9: what the bug is in is the recap\'s, on no line of the screen, and the yes keeps it on the investigation\'s item with whether the unit\'s review had ended — judged at the first conclude naming it, kept by a later one naming it again, judged afresh for another unit or after none, dropped with none — counted only where it had (17.S4)', () => {
    const plain = conclude();
    verifySetUp();
    const named = conclude(RIPE, { ...RECAP, fixes: FEATURE, area: ' Session restore ' });

    assert.strictEqual(named, plain, 'the person sees no flag for it (17.2.2)');
    const { next } = run(['gate', 'conclude gate', '--pick', 'y']);
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['investigation', 'conclude', RIPE] });
    withFrozenClock(() => run(next.argv));
    assert.deepStrictEqual(readManifest(dir, RIPE).phases.investigation.items[RIPE], {
      status: 'completed', concluded_at: FROZEN_AT, fixes: FEATURE, area: 'Session restore', after_review: false,
    });
    reviewSettled(FEATURE);
    reviewSettled(BUG);
    assert.deepStrictEqual(run(['measures', 'bugs']).bugs, [], 'a bug concluded while its unit was still building is not counted once that unit\'s review ends');

    reopened();
    assert.deepStrictEqual(closedWith({ fixes: FEATURE }), { fixes: FEATURE, area: undefined, after: false }, 'the same unit named again keeps when the bug was found');
    reopened();
    assert.deepStrictEqual(closedWith({ fixes: BUG }), { fixes: BUG, area: undefined, after: true }, 'another unit judged afresh, its review settled');
    reopened();
    assert.deepStrictEqual(closedWith({}), { fixes: undefined, area: undefined, after: undefined }, 'none named drops it with the unit');
    reopened();
    assert.deepStrictEqual(closedWith({ fixes: FEATURE }), { fixes: FEATURE, area: undefined, after: true }, 'after none, judged afresh');
    assert.deepStrictEqual(run(['measures', 'bugs']).bugs, [{ project: dir, area: null, count: 1, fixed: [{ unit: FEATURE, bugfixes: [RIPE] }] }]);
  });

  it('the conclude\'s DATA names every area the project\'s bugfixes have recorded, with or without a unit, folded for case and spacing, each as first spelt, in name order — so Claude names an area alike; a recap staged again only to spell its area as the DATA does keeps the time the one it replaces was staged, so its gate is asked on the same showing, and one that says more is staged anew (N3)', (t) => {
    verifySetUp();
    const recorded = (/** @type {string} */ unit, /** @type {string} */ day, /** @type {Record<string, string>} */ fields) => {
      for (const [field, value] of Object.entries({ concluded_at: `2026-10-${day}T09:00:00.000Z`, ...fields })) run(['manifest', 'set', `${unit}.investigation.${unit}`, field, value]);
    };
    recorded('fixed', '01', { area: 'session  restore' });
    createManifest(dir, 'later', { work_type: 'bugfix', phases: { investigation: { items: { later: { status: 'completed' } } } } });
    recorded('later', '02', { fixes: FEATURE, area: 'Session Restore' });
    createManifest(dir, 'boot', { work_type: 'bugfix', phases: { investigation: { items: { boot: { status: 'completed' } } } } });
    recorded('boot', '03', { fixes: FEATURE, area: 'Boot' });

    const sections = conclude();
    assert.strictEqual(sections.slice(0, sections.indexOf('=== DISPLAY')), data(['area: Boot', 'area: session  restore']));

    const asked = t.mock.method(decisionPoint, 'gateStep', () => ({ step: 'automatic', gate: 'conclude gate', row: 'y', showing: '47e5a17f3cac2787' }));
    for (const recap of [{ area: 'Session Restore' }, { area: 'session  restore' }, { hunt: 'Two hypotheses; the save trusted an empty capture.', area: 'session  restore' }]) conclude(RIPE, { ...RECAP, ...recap });
    const keys = asked.mock.calls.map(({ arguments: [, { key }] }) => key);
    assert.deepStrictEqual(keys.map((key) => key === keys[0]), [true, true, false]);
  });

  it('refuses what the bug is in, writing nothing — a unit the project lacks or this one, an area where no verify setup is recorded or past a line — at the gate, and at the yes once it no longer holds; an area with no unit is kept, a bug in code no unit built', () => {
    const recap = (/** @type {Record<string, string>} */ bug) => concludeRefused(RIPE, { ...RECAP, ...bug });
    assert.deepStrictEqual([
      recap({ fixes: 'nowhere' }),
      recap({ fixes: '.' }),
      recap({ fixes: RIPE }),
      recap({ area: 'session restore' }),
    ], [
      'render conclude: there is no work unit "nowhere" to fix — the recap\'s fixes names the unit whose code the bug is in, left out where no unit built it',
      'render conclude: there is no work unit "." to fix — the recap\'s fixes names the unit whose code the bug is in, left out where no unit built it',
      `render conclude: ${RIPE} cannot fix its own code — the recap's fixes names the unit whose code the bug is in`,
      'render conclude: no verify setup is recorded, so no feature map names an area — leave the area out',
    ]);
    verifySetUp();
    assert.strictEqual(recap({ fixes: FEATURE, area: 'session\nrestore' }), 'render conclude: the area is one line of words, an area of the verify setup\'s feature map');

    conclude(RIPE, { ...RECAP, area: 'session restore' });
    verifyGone();
    assert.strictEqual(refused(['investigation', 'conclude', RIPE]), `investigation conclude: no verify setup is recorded, so no feature map names an area — leave the area out — engine render conclude ${RIPE} --file <recap.json> stages it again`);
    verifySetUp();
    run(['investigation', 'conclude', RIPE]);
    const { fixes, area, after_review: after } = readManifest(dir, RIPE).phases.investigation.items[RIPE];
    assert.deepStrictEqual([fixes, area, after], [undefined, 'session restore', undefined]);
  });

  /** A call the person changed in the investigation, answering against Claude's lean: its decision's short id. */
  async function departed() {
    return raised('2');
  }

  /** A call raised in the investigation, the person picking `pick` where Claude leans to 1: its decision's short id. @param {string} pick */
  async function raised(pick) {
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
    return ok(dir, ['raise', 'answer', res.raise, '--pick', pick], { env: env(), stdin: JSON.stringify({ why: 'The person wants to know.' }) }).id;
  }

  it('16.10.5: a call the person changed in the investigation is asked its verdict first, at the conclusion, and the yes waits for it; none changed, none asked — and where the conclude ran as its step but the decision point no longer would by the yes, the yes, checking it on the showing staged, refuses and opens no hold, so the next conclude is drawn, asking the verdict', async (t) => {
    await departed();
    const { gateStep } = decisionPoint;
    let calls = 0;
    t.mock.method(decisionPoint, 'gateStep', (/** @type {string} */ name, /** @type {any} */ gateAt) => (calls++ === 0 ? { step: 'automatic', gate: 'conclude gate', row: 'y', showing: '47e5a17f3cac2787' } : gateStep(name, gateAt)));
    const held = () => fs.existsSync(at(layout.cache(RIPE, 'investigation', RIPE, path.join('.showings', 'conclude-gate.json'))));
    const owed = `investigation conclude: a verdict is still to ask — engine render conclude ${RIPE} asks each before the yes`;

    const stepped = conclude();
    assert.deepStrictEqual([/YOUR VERDICT/.test(stepped), refused(['investigation', 'conclude', RIPE]), held()], [false, owed, false]);

    const sections = conclude(RIPE, null);

    assert.match(sections, /^YOUR VERDICT \(1 of 1 call you changed\)$/m);
    assert.match(sections, /^=== MENU: verdict /m);
    assert.deepStrictEqual([refused(['investigation', 'conclude', RIPE]), held()], [owed, true]);
    const { next } = run(['gate', 'verdict', '--pick', 'n']);
    assert.deepStrictEqual(next.argv.slice(-2), ['--at', 'conclusion']);
    run(next.argv);
    const after = conclude(RIPE, null);
    assert.doesNotMatch(after, /YOUR VERDICT/);
    assert.match(after, /^=== MENU: conclude gate /m);
    assert.strictEqual(run(['investigation', 'conclude', RIPE]).unit, RIPE);
  });

  it('16.10.11: stepped by the decision point at the investigation, its showing told by when its recap was staged, the conclude run as a step on its yes asks no verdict there — its report stands in its menu\'s place, its DATA carrying the yes\'s next — and the yes, asking the decision point again on that showing, concludes, the departure waiting in the verdict queue', async (t) => {
    const changed = await departed();
    const asked = t.mock.method(decisionPoint, 'gateStep', () => ({ step: 'automatic', gate: 'conclude gate', row: 'y', showing: '47e5a17f3cac2787' }));

    const sections = conclude();
    const concluded = run(['investigation', 'conclude', RIPE]).unit;

    const calls = asked.mock.calls.map(({ arguments: [name, { place, key }] }) => [name, place, key]);
    assert.deepStrictEqual(calls.map(([name, place]) => [name, place]), [['conclude gate', { unit: RIPE, phase: 'investigation', topic: RIPE }], ['conclude gate', { unit: RIPE, phase: 'investigation', topic: RIPE }]]);
    assert.match(String(calls[0][2]), /^\d{4}-\d\d-\d\dT/);
    assert.strictEqual(calls[1][2], calls[0][2], 'the yes asks on the showing the conclude was drawn on');
    assert.doesNotMatch(sections, /YOUR VERDICT|^=== MENU/m);
    assert.deepStrictEqual(sections.slice(sections.indexOf('=== DATA')).split('\n').slice(1, 4), ['automatic step: conclude gate', 'ran: y', `next: {"kind":"engine","argv":["investigation","conclude","${RIPE}"]}`]);
    assert.strictEqual(concluded, RIPE);
    assert.deepStrictEqual(run(['verdict', 'queue']).departures.map((/** @type {{id: string}} */ d) => d.id), [changed]);
  });

  it('a conclude set aside stays held at the investigation through what comes meanwhile — a call the person changed, its raise drawn, then its verdict asked first on the conclude\'s own screen; then a raise drawn and answered, and the recap staged again: drawn again after each, it shows on its hold, never drawn, and its answers are one event (S1)', async () => {
    const h = history({ project: JSON.parse(readState(dir, layout.projectManifest)).project_id, start: Date.now() - DAY });
    for (let i = 0; i < 12; i += 1) h.gate('conclude gate', { picked: 'y' });
    fs.writeFileSync(path.join(config, TRUST_LOG), lines(...h.events));
    const gated = (/** @type {string} */ out) => /^=== MENU: conclude gate /m.test(out);

    const first = gated(conclude());
    const { opened } = shownIn(config, 'sess-1');
    /** Whether `out` shows the conclude gate on the showing first drawn. @param {string} out */
    const held = (out) => gated(out) && shownIn(config, 'sess-1').opened === opened;
    ok(dir, ['gate', 'conclude gate', '--typed'], { env: { ...env(), CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { row: 'y' } }) }, stdin: 'Yes, that is the bug.' });
    await departed();
    assert.match(conclude(RIPE, null), /^=== MENU: verdict /m);
    run(run(['gate', 'verdict', '--pick', 'n']).next.argv);
    const afterVerdict = held(conclude(RIPE, null));
    await raised('1');
    const afterRaise = held(conclude(RIPE, { hunt: 'Three hypotheses; the save trusted an empty capture at shutdown.' }));
    run(['gate', 'conclude gate', '--pick', 'y']);

    assert.deepStrictEqual([first, afterVerdict, afterRaise, showingAnswers(config, 'conclude gate')], [true, true, true, [[null, 'y'], [0, 0]]]);
  });
});
