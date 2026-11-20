'use strict';

// ---------------------------------------------------------------------------
// A bugfix's investigation's close: its validations' briefs, `brief
// root-cause-validation|fix-validation` (ledger-engine/scripts/domain/
// brief-records.cjs), both always run (19.4.7) — each from the hunt's log,
// the record, what the hunt rests on and the code, the fix's carrying the
// root cause and the fix it rests on, the root cause's no fix (19.S10) —
// and what they refuse, issuing nothing; and its close into its spec with no
// gate (domain/investigation-conclude.cjs), `investigation stage`, standing
// only once the root cause and the fix rest on current entries, both
// validated since, nothing of the person's open and no mail waiting: the
// recap staged, the close marked in the checklist store and committed, its
// place released and the work handed off into the spec (19.S15, 24.S17,
// 11.2.1), the close voided as the investigation goes on (9.7.9); and what
// the bug is in, the unit whose code it fixes and the feature map's area,
// staged with the recap in the spelling first recorded (17.1.9). Its
// conclude at ready to build is test-engine-ready-to-build-bugfix.cjs's; its
// entry, log and gates test-engine-investigation.cjs's.
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
  ok, output, refusedPristine, layout, writeState, readState, readManifest, commitAll, stateGit, lastMessage, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const {
  HUNT, RIPE, AT, CLAUDE, made, ripe, useInvestigationWorld, BUG, FEATURE, RIPE_AT, ENGINE, PERSON, GONE, validated,
} = require('./investigation-world.cjs');

let dir = ''; // the project
let config = ''; // the system config: the conversation's folder
const {
  env, run, refused, log, at, drawn, payload,
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

describe('the close into the spec, with no gate — `investigation stage` (19.4.23, 11.2.1)', () => {
  const RECAP = Object.freeze({ hunt: 'Three hypotheses; killing every session emptied the save each time, and the save trusted whatever it captured.' });

  /** The recap staged for `unit`: the stage's answer. @param {string} [unit] @param {unknown} [recap] */
  const stage = (unit = RIPE, recap = RECAP) => run(['investigation', 'stage', unit, '--file', payload('recap.json', recap)]);

  /** The stage's refusal, writing nothing. @param {string} [unit] @param {unknown} [recap] */
  const stageRefused = (unit = RIPE, recap = RECAP) => refused(['investigation', 'stage', unit, '--file', payload('recap.json', recap)]);

  /** Where the recap is staged. */
  const stagedRecap = () => at(layout.cache(RIPE, 'investigation', RIPE, 'conclude.json'));

  /** `ripe`'s close, as its manifest marks it. */
  const closeOf = () => readManifest(dir, RIPE).checklists?.conclusion?.[RIPE];

  /** Whether the spec can be entered, as its entry refuses it. */
  const specOpen = () => refusedPristine(dir, ['enter', 'specification', RIPE], { env: env() }).error ?? null;

  /** A ledger write at `ripe`'s investigation: its short id. @param {string} verb @param {string[]} flags @param {Record<string, unknown>} content */
  const wrote = (verb, flags, content) => ledgerHelpers(() => dir).write(verb, RIPE_AT, flags, content, env()).id;

  it('24.S17, 19.S15: stages the recap against the root cause and the fix, marks the close in the checklist store and commits it, the log riding along, releases its place and hands off into the spec — the item still in progress until ready to build concludes it — whose entry reads the investigation and whose writer\'s brief draws the root cause, the fix and each rule the fix keeps, never the spec\'s own', () => {
    run(['enter', 'investigation', RIPE]);
    const held = () => run(['presence', 'scan', RIPE]).sessions.map(({ phase, topic }) => `${phase} ${topic}`);
    assert.deepStrictEqual(held(), [`investigation ${RIPE}`]);
    // A permission for the hunt, asked at the investigation's own level, is
    // never a rule the fix keeps (19.4.20).
    const { write } = ledgerHelpers(() => dir);
    const live = write('ask', `${RIPE}.investigation`, [], { ...CLAUDE, text: 'May I run the save against the live server?' }, env()).id;
    write('decide', `${RIPE}.investigation`, ['--answers', live], { ...PERSON, text: 'Never run it against the live server.', why: 'Live data is the customers\'.' }, env());
    writeState(dir, layout.topic(RIPE, RIPE, 'log.md'), `${readState(dir, layout.topic(RIPE, RIPE, 'log.md'))}\nThe conversation's last words.\n`);

    const res = withFrozenClock(() => stage());

    assert.deepStrictEqual(res, {
      ok: true, unit: RIPE, closed: FROZEN_AT, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'ledger-specification-process', args: ['bugfix', RIPE] },
    });
    assert.deepStrictEqual([closeOf(), readManifest(dir, RIPE).phases.investigation.items[RIPE].status], [{ closed: FROZEN_AT }, 'in-progress']);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(stagedRecap(), 'utf8')), { ...RECAP, root_cause: ledgerHelpers(() => dir).full(ripe.rootCause), fix: ledgerHelpers(() => dir).full(ripe.fix) });
    assert.strictEqual(lastMessage(dir), `investigation(${RIPE}): close`);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']).trim(), '', 'the log rode along');
    assert.deepStrictEqual(held(), [], 'the close releases the investigation\'s place');
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

  it('9.7.9: the close is voided as the investigation goes on — entered again, a message delivered to it, a question opened there — the spec waiting until it closes again; staged once the spec is written, it carries on there', () => {
    const waits = `${RIPE}'s spec waits until its investigation closes, its root cause and fix validated and its recap staged — the investigation carries on, from the start menu`;
    const goesOn = [
      () => run(['enter', 'investigation', RIPE]),
      () => {
        const asked = wrote('ask', [], { ...CLAUDE, text: 'Does a reboot lose sessions too?' });
        wrote('decide', ['--answers', asked], { ...PERSON, text: 'Yes, the same way.', why: 'The person saw it.' });
      },
      () => {
        writeState(dir, '.cache/scratch/also.md', 'Also on reboot\n\nIt happens on a reboot too.\n');
        run(['topic', 'send', RIPE, RIPE, '--from', RIPE, '--content', at('.cache/scratch/also.md'), '--slug', 'also-on-reboot']);
      },
    ];
    const voided = goesOn.map((goOn) => {
      stage();
      goOn();
      return [typeof closeOf().voided, specOpen()];
    });

    assert.deepStrictEqual(voided, Array(3).fill(['string', waits]));
    assert.match(stageRefused(), /^investigation stage: 1 message\(s\) wait/);
    writeState(dir, layout.unit(RIPE, 'spec.md'), '# Ripe\n');
    commitAll(dir, 'the spec written');
    assert.strictEqual(refused(['enter', 'investigation', RIPE]), `${RIPE} has its spec — a topic exists only before it, and a change is settled in the spec from here`);
  });

  it('staged again once the spec is written, the close carries on to ready to build\'s screen', () => {
    stage();
    writeState(dir, layout.unit(RIPE, 'spec.md'), '# Ripe\n');
    commitAll(dir, 'the spec written');

    assert.deepStrictEqual(stage().next, { kind: 'continue' });
  });

  it('a root cause replaced is validated again, and so is the fix checked against it, kept or replaced; one dispatched since and not yet taken in is named where it stands, never dispatched again, and one of the other kind, or closed unread, never counts (19.4.7, 26.4.10)', () => {
    const store = `${RIPE} investigation ${RIPE}`;
    /** The refusal of what has not been validated since it was logged. @param {string} what @param {string} short @param {string} kind @param {string} logged */
    const unvalidated = (what, short, kind, logged) => `investigation stage: the ${what} ${short} has not been validated since ${logged} — both validations always run: engine agent dispatch ${store} --kind ${kind}, its brief engine brief ${kind} ${RIPE} --agent <id>, and its report taken in`;
    /** The refusal of what is being validated, by where its validation stands. @param {string} what @param {string} short @param {string} stands */
    const being = (what, short, stands) => `investigation stage: the ${what} ${short} is being validated — ${stands}`;
    const fixSince = 'it, or the root cause it rests on, was logged';
    const rootCause = wrote('replace', ['--replaces', ripe.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'The trace showed it.' });
    ok(dir, ['investigation-log', 'root-cause', RIPE, '--entry', rootCause]);
    assert.strictEqual(stageRefused(), unvalidated('root cause', rootCause, 'root-cause-validation', 'it was logged'));

    const row = run(['agent', 'dispatch', RIPE, 'investigation', RIPE, '--kind', 'root-cause-validation']);
    assert.strictEqual(stageRefused(), being('root cause', rootCause, `${row.id} is still running — the close waits for its report`));
    fs.writeFileSync(row.file, `# Validation — ${row.id}\n\n## Summary\n\nIt holds, but for one path.\n\n## Findings\n\n### F1: A reboot\n\nA reboot saves before the capture.\n`);
    assert.strictEqual(stageRefused(), being('root cause', rootCause, `${row.id}'s report is in — engine agent scan ${store} reads it in, then engine agent ack ${store} ${row.id} with its findings, or --clean`));
    run(['agent', 'scan', RIPE, 'investigation', RIPE]);
    assert.strictEqual(stageRefused(), being('root cause', rootCause, `${row.id}'s report is in — engine agent ack ${store} ${row.id} with its findings, or --clean`));
    run(['agent', 'ack', RIPE, 'investigation', RIPE, row.id, '--findings', 'F1']);
    assert.strictEqual(stageRefused(), being('root cause', rootCause, `${row.id}'s findings are acknowledged — once each is acted on, engine agent incorporate ${store} ${row.id} takes it in`));
    run(['agent', 'incorporate', RIPE, 'investigation', RIPE, row.id]);
    assert.strictEqual(stageRefused(), unvalidated('fix', ripe.fix, 'fix-validation', fixSince), 'the fix kept was validated against the root cause replaced');

    const lost = ok(dir, ['agent', 'dispatch', RIPE, 'investigation', RIPE, '--kind', 'fix-validation'], { env: { ...env(), CLAUDE_PID: GONE } }).id;
    assert.strictEqual(stageRefused(), being('fix', ripe.fix, `${lost} was lost with the process that dispatched it — engine agent incorporate ${store} ${lost} abandons it, and another is dispatched`));
    run(['agent', 'incorporate', RIPE, 'investigation', RIPE, lost]);
    assert.strictEqual(stageRefused(), unvalidated('fix', ripe.fix, 'fix-validation', fixSince), 'closed unread');
    validated(dir, RIPE, 'fix-validation', env());
    stage();

    const fix = wrote('replace', ['--replaces', ripe.fix, '--reason', 'changed-mind'], { ...CLAUDE, drops: ['over a full one'], text: 'Keep the last few saves, and restore from the newest with sessions in it.', why: 'A save gone wrong falls back.' });
    assert.strictEqual(stageRefused(), unvalidated('fix', fix, 'fix-validation', fixSince));
    validated(dir, RIPE, 'fix-validation', env());
    assert.strictEqual(stage().unit, RIPE);
  });

  it('refuses, writing nothing: a bugfix whose investigation is not open, a root cause or a fix resting on no current entry, a question of the person\'s open at the place, mail waiting, and a recap out of its shape', () => {
    const asked = wrote('ask', [], { ...PERSON, text: 'Should restore say what it lost?' });

    assert.deepStrictEqual([
      stageRefused(BUG),
      stageRefused('fixed'),
      stageRefused(FEATURE),
      stageRefused(HUNT),
      stageRefused(RIPE),
    ], [
      `investigation stage: ${BUG}'s investigation has not started — engine enter investigation ${BUG} starts it`,
      'investigation stage: fixed\'s investigation has concluded',
      'investigation stage: a feature has no investigation — its phases are experiment, discussion, specification, implementation, review',
      `investigation stage: no root cause is logged — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`,
      `investigation stage: a question of the person's is open at the investigation — ${asked} "Should restore say what it lost?" — each is answered before it closes`,
    ]);
    assert.deepStrictEqual([['investigation', 'stage', RIPE], ['investigation', 'stage'], ['investigation', 'conclude', RIPE]].map((args) => refused(args)), Array(3).fill('Usage: engine investigation stage <bugfix> --file <recap.json>'));
    wrote('decide', ['--answers', asked], { ...PERSON, text: 'Yes, in one line.', why: 'The person wants to know.' });
    assert.strictEqual(stageRefused(RIPE, { hunt: 'two\nlines' }), 'investigation stage: the recap\'s hunt is one paragraph of words, not empty');
    assert.strictEqual(stageRefused(RIPE, { recap: 'x' }), 'investigation stage: the recap must be {hunt, fixes?, area?}');

    log('root-cause', ['--entry', made.rootCause]);
    assert.strictEqual(stageRefused(HUNT), `investigation stage: no fix direction is logged — log it once its question is raised: engine investigation-log fix-direction ${HUNT} --question <question>`);
    log('fix-direction', ['--question', made.fix]);
    assert.strictEqual(stageRefused(HUNT), `investigation stage: the fix direction's question ${made.fix} has no answer yet — the fix is its answer, raised: engine raise ${AT} --answers ${made.fix}`);
    ledgerHelpers(() => dir).write('replace', AT, ['--replaces', made.rootCause, '--reason', 'was-wrong'], { ...CLAUDE, drops: ['the whole truth'], text: 'A save trusts a capture taken mid-shutdown.', why: 'The trace showed it.' });
    assert.strictEqual(stageRefused(HUNT), `investigation stage: the root cause logged points at no current entry — log it: engine investigation-log root-cause ${HUNT} --entry <decision>`);

    writeState(dir, layout.mailbox(RIPE, RIPE, '001-also-on-reboot.md'), 'It happens on a reboot too\n');
    assert.strictEqual(stageRefused(), `investigation stage: 1 message(s) wait in its mailbox — raise and answer each first: engine topic mailbox ${RIPE} ${RIPE}`);
  });

  /** The project's verify setup recorded, its feature map beside it. */
  function verifySetUp() {
    const project = JSON.parse(readState(dir, layout.projectManifest));
    const verify = {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      ran: { unit: FEATURE, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-11-01T09:00:00.000Z' },
    };
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { ...project.environment, verify } }, null, 2));
    commitAll(dir, 'the verify setup');
  }

  it('17.1.9: what the bug is in is the recap\'s, staged with it — its area in the spelling the project\'s bugfixes first recorded it by, folded for case and spacing, a new one as named (N3)', () => {
    verifySetUp();
    const recorded = (/** @type {string} */ unit, /** @type {string} */ day, /** @type {Record<string, string>} */ fields) => {
      for (const [field, value] of Object.entries({ concluded_at: `2026-10-${day}T09:00:00.000Z`, ...fields })) run(['manifest', 'set', `${unit}.investigation.${unit}`, field, value]);
    };
    recorded('fixed', '01', { area: 'session  restore' });
    createManifest(dir, 'later', { work_type: 'bugfix', phases: { investigation: { items: { later: { status: 'completed' } } } } });
    recorded('later', '02', { fixes: FEATURE, area: 'Session Restore' });

    const answers = [{ fixes: FEATURE, area: ' Session Restore ' }, { area: 'Boot' }].map((bug) => {
      const { fixes, area } = stage(RIPE, { ...RECAP, ...bug });
      return [fixes, area, JSON.parse(fs.readFileSync(stagedRecap(), 'utf8')).area];
    });

    assert.deepStrictEqual(answers, [[FEATURE, 'session  restore', 'session  restore'], [undefined, 'Boot', 'Boot']]);
  });

  it('refuses what the bug is in, writing nothing — a unit the project lacks or this one, an area where no verify setup is recorded or past a line', () => {
    const recap = (/** @type {Record<string, string>} */ bug) => stageRefused(RIPE, { ...RECAP, ...bug });
    assert.deepStrictEqual([
      recap({ fixes: 'nowhere' }),
      recap({ fixes: '.' }),
      recap({ fixes: RIPE }),
      recap({ area: 'session restore' }),
    ], [
      'investigation stage: there is no work unit "nowhere" to fix — the recap\'s fixes names the unit whose code the bug is in, left out where no unit built it',
      'investigation stage: there is no work unit "." to fix — the recap\'s fixes names the unit whose code the bug is in, left out where no unit built it',
      `investigation stage: ${RIPE} cannot fix its own code — the recap's fixes names the unit whose code the bug is in`,
      'investigation stage: no verify setup is recorded, so no feature map names an area — leave the area out',
    ]);
    verifySetUp();
    assert.strictEqual(recap({ fixes: FEATURE, area: 'session\nrestore' }), 'investigation stage: the area is one line of words, an area of the verify setup\'s feature map');
  });
});
