'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's short record (leeway-engine/scripts/domain/
// quick-fix-record.cjs; knowledge/artifacts.cjs): `engine quick-fix record
// <qf> <task> --file <record.md>` — each fix's short record under its title
// in `summary.md`, at its place in the order the fixes land, kept by its
// task — two fixes of one title each recorded, the close counting both —
// committed with the fix recorded on the manifest and indexed, a query for
// one fix finding its own (19.5.6, 19.5.11, 19.5.17, 19.S38, 22.6.9); a
// fix taken once it holds a commit of its own, in flight or done (R2); a
// section opening on a fenced block written beneath its item, so every
// record after it keeps its heading and its own chunk (R6); and every
// refusal writing nothing. A record taken out at its fix's close is
// test-engine-quick-fix-end.cjs's; the close test-engine-quick-fix-close.cjs's.
//
// Layer: git. World: quick-fix-world.cjs's `twoFixesBuilt` — fixes 1.1 and
// 1.2, 1.2 laid on 1.1, each built through the local driver and done —
// built once and copied. Each test's conversation keeps its records in a
// config folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const {
  ok, output, callAsync, refusedPristine, stateGit, statePath, layout, writeState, readState, readManifest, fixtureFrom, cleanupFixture, keywordOnlyKnowledge, touched,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const {
  UNIT, FLAG, HELP, RECORDS: BUILT, createFix, fixChanged, fixBuilt, recordFile, twoFixesBuilt, summaryChunks, checklistClosed,
} = require('./quick-fix-world.cjs');

const DOCS = 'Spell the docs --colour';
const MAN = 'Spell the man page --colour';

const RECORDS = Object.freeze({ ...BUILT, 3: { changed: 'The docs name --colour.', why: 'The docs matched the old flag.', leaves: 'Nothing.' } });

const world = fixtureFrom('quick-fix-record-', twoFixesBuilt);

let dir = ''; // the project
const config = useTempFolder('quick-fix-record-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** A call that must succeed, in this test's conversation. @param {string[]} args */
const run = (args) => ok(dir, args, as());

/** A call's refusal, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, as()).error;

/** Fix `n`'s record written through the verb, its sections as given, else `RECORDS`'. @param {number} n @param {{changed: string, why: string, leaves: string}} [record] */
const record = (n, record = RECORDS[n]) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, record)]);

/** The unit's `summary.md`. */
const summary = () => readState(dir, layout.unit(UNIT, 'summary.md'));

/** The records' headings in `summary.md`, in order. */
const headings = () => summary().split('\n').filter((line) => line.startsWith('## '));

describe('quick-fix record (19.5.6, 19.5.17)', () => {
  it('writes each fix\'s record into summary.md under its title, after the record before it, each section an item, and commits it with the fix recorded on the manifest', () => {
    dir = world();
    const first = record(1);
    const at = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const second = record(2);

    assert.deepStrictEqual(first, {
      ok: true, unit: UNIT, task: '1.1', id: `${UNIT}-1-1`, summary: statePath(dir, layout.unit(UNIT, 'summary.md')), committed: at.slice(0, first.committed.length),
    });
    assert.strictEqual(summary(), [
      `## ${FLAG}`, '', '- What changed: The flag parser reads --colour.', '- Why: The flag was spelt the American way.', '- Leaves out: Old scripts passing --color.', '',
      `## ${HELP}`, '', '- What changed: The help page names --colour.', '  Its example uses it too.', '- Why: The help matched the old flag.', '- Leaves out: The man page.', '',
    ].join('\n'));
    assert.deepStrictEqual([stateGit(dir, ['log', '-2', '--format=%s']).trim().split('\n'), touched(statePath(dir), 'HEAD'), second.task], [
      [`quick-fix(${UNIT}): record 1.2`, `quick-fix(${UNIT}): record 1.1`], [`M\t${layout.manifest(UNIT)}`, `M\t${layout.unit(UNIT, 'summary.md')}`], '1.2',
    ]);
  });

  it('writes a record at its fix\'s place in the set\'s order, a fix recorded after the one landing above it', () => {
    dir = world();
    record(2);
    record(1);

    assert.deepStrictEqual([headings(), readManifest(dir, UNIT).fixes.recorded], [[`## ${FLAG}`, `## ${HELP}`], [`${UNIT}-1-1`, `${UNIT}-1-2`]]);
  });

  it('R2: takes a fix in flight once it holds a commit of its own, as a done one', () => {
    dir = world();
    fixChanged(dir, 3, DOCS, 'docs/flags.md', '--colour\n', as());
    const res = record(3);

    assert.deepStrictEqual([res.task, run(['task', 'show', UNIT, '1.3']).status, headings().at(-1)], ['1.3', 'in-progress', `## ${DOCS}`]);
  });

  it('keeps each record by its fix\'s task, so two fixes of one title are each recorded, the close counting both', () => {
    dir = world();
    fixBuilt(dir, 3, FLAG, 'src/alias.js', 'const alias = \'colour\';\n', as());
    record(1);
    record(2);
    checklistClosed(dir, as());
    record(3);
    output(dir, ['render', 'finish', UNIT], as());

    assert.deepStrictEqual(headings(), [`## ${FLAG}`, `## ${HELP}`, `## ${FLAG}`]);
  });

  it('refuses a unit that is no quick-fix, a task none of its fixes, a fix closed, a second record of a fix, one holding no commit of its own — started or not — and a file that does not read as a record, every fault named, writing nothing', () => {
    dir = world();
    record(1);
    createFix(dir, 3, DOCS, as());
    run(['task', 'start', UNIT, '1.3']);
    createFix(dir, 4, MAN, as());
    createFix(dir, 5, 'Spell the readme --colour', as());
    run(['task', 'close', UNIT, '1.5', '--reason', 'The readme stays as it is.']);
    const file = recordFile(dir, 2, RECORDS[2]);
    const bad = writeState(dir, layout.cache('bad.md'), '# Docs\n\n## What changed\nThe docs.\n\n## Why\n\n## Leaves out\nNothing.\n');
    const shuffled = writeState(dir, layout.cache('shuffled.md'), '## Why\nBecause.\n\n## What changed\nThe docs.\n');

    assert.deepStrictEqual([
      refused(['quick-fix', 'record', 'other', '1.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '2.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.5', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.1', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.3', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.4', '--file', file]),
      refused(['quick-fix', 'record', UNIT, '1.2', '--file', bad]),
      refused(['quick-fix', 'record', UNIT, '1.2', '--file', shuffled]),
      refused(['quick-fix', 'record', UNIT, '1.2']),
    ], [
      'quick-fix record: other is a feature, and only a quick-fix keeps a short record of each fix',
      `quick-fix record: task 2.1 of ${UNIT} is none of its fixes — a quick-fix's fixes are its phase 1, 1.n`,
      `quick-fix record: task 1.5 of ${UNIT} is closed — a fix closed lands nothing, so it keeps no record`,
      `quick-fix record: task 1.1 of ${UNIT}'s record is written already — ${UNIT}/summary.md holds it, under \`## ${FLAG}\``,
      `quick-fix record: task 1.3 of ${UNIT} holds no commit of its own — a fix's record is written once its change is committed through the door`,
      `quick-fix record: task 1.4 of ${UNIT} holds no commit of its own — a fix's record is written once its change is committed through the door`,
      `quick-fix record: ${bad} does not read as a fix's record — it holds a level-one heading — the fix's title heads its record in summary.md; it opens with \`## What changed\`; ## Why is empty`,
      `quick-fix record: ${shuffled} does not read as a fix's record — its sections are \`## What changed\`, \`## Why\`, \`## Leaves out\`, in that order, and no other at level two`,
      'Usage: engine quick-fix record <work-unit> <task> --file <record.md>',
    ]);
  });
});

describe('summary.md in the knowledge base (19.S38, 22.6.9)', () => {
  it('19.S38: indexes summary.md where the knowledge base is set up, each fix\'s record its own chunk, so a query for one fix finds its record first', async () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    record(1);
    record(2);
    const res = await callAsync(dir, ['knowledge', 'query', 'help', 'page', '--phase', 'summary'], as());

    const passage = res.stdout.split('\n').slice(res.stdout.split('\n').findIndex((line) => line.startsWith('[summary | typo/.unit |')) + 1);

    assert.strictEqual(res.code, 0, res.stderr);
    assert.deepStrictEqual([summaryChunks(dir), res.stdout.match(/^\[(\d+) results?\]$/m)?.[1], passage.slice(0, 2)], [
      [FLAG, HELP], '1', [HELP, '- What changed: The help page names --colour.'],
    ]);
  });

  it('R6: writes a section opening on a fenced block beneath its item, the fence opening and closing as written, so each record after it keeps its heading, its place and a chunk of its own', () => {
    dir = world();
    keywordOnlyKnowledge(dir);
    fixChanged(dir, 3, DOCS, 'docs/flags.md', '--colour\n', as());
    record(1, { ...RECORDS[1], changed: '```diff\n- const flag = \'color\';\n## not a heading\n+ const flag = \'colour\';\n```\nThe parser follows.' });
    record(3);
    record(2);

    assert.strictEqual(summary().split(`## ${HELP}`)[0], [
      `## ${FLAG}`, '', '- What changed:', '  ```diff', '  - const flag = \'color\';', '  ## not a heading', '  + const flag = \'colour\';', '  ```', '  The parser follows.',
      '- Why: The flag was spelt the American way.', '- Leaves out: Old scripts passing --color.', '', '',
    ].join('\n'));
    assert.deepStrictEqual([headings(), summaryChunks(dir)], [[`## ${FLAG}`, `## ${HELP}`, `## ${DOCS}`], [FLAG, HELP, DOCS]]);
  });
});
