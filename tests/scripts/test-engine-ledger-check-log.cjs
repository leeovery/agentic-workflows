'use strict';

// ---------------------------------------------------------------------------
// The one-decision check's log (leeway-engine/scripts/domain/ledger-one-
// decision.cjs, 5.5.9): every run of the check as a decision is written and
// in the late check (domain/ledger-late-check.cjs) appends one line to
// `{config}/decision-checks.jsonl` — its verb, unit, rule count, outcome and
// the model that answered, never the entry's text — and an append that fails
// is a warning the verb carries, the check standing. The raise's draw logs
// its rows' runs, pinned with the draw (test-engine-raise.cjs).
//
// Layer: verb. World: the ledger suites' unit with two questions on the note
// window, each answered by a decision that landed unchecked, built once and
// copied for each test. The separate call is the suite's stub binary
// (claude-stub.cjs), armed per call; the log sits in the pinned system config
// directory, emptied before each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, refusedPristine, cleanupFixture } = require('./engine-harness.cjs');
const { SESSION_ID, MADE, NOTE, PHASES, writtenWorld, ledgerHelpers } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { systemConfigDir } = require(path.join(SCRIPTS, 'kernel/system-config.cjs'));
const { DECISION_CHECKS } = require(path.join(SCRIPTS, 'domain/user-files.cjs'));

const CHECK_LOG = path.join(systemConfigDir(), DECISION_CHECKS);
const PANEL = 'A near-frameless floating panel.';
const SYNC = 'Notes sync between Macs through CloudKit.';
const BOTH = `${PANEL} ${SYNC}`;

const { world, made } = writtenWorld('ledger-check-log-', PHASES, (write) => {
  const where = write('ask', NOTE, [], { ...MADE, text: 'What is a note, at its most basic?' }).id;
  const sync = write('ask', NOTE, [], { ...MADE, text: 'How do notes reach a second Mac?' }).id;
  const decide = (/** @type {string} */ question, /** @type {string} */ text) => write('decide', NOTE, ['--answers', question], { ...MADE, text, why: 'Because.' }).id;
  return { where, sync, panel: decide(where, PANEL), both: decide(sync, BOTH) };
});

/** @type {string} */
let dir;

beforeEach(() => {
  dir = world();
  fs.rmSync(CHECK_LOG, { force: true });
});

afterEach(() => {
  cleanupFixture(dir);
});

const { checkRuns, checkRun } = ledgerHelpers(() => dir);

/** A call's environment: this session, the stub armed with `answers` by what the input holds, or with no login. @param {Record<string, unknown>} [answers] */
function armed(answers) {
  return { CLAUDE_CODE_SESSION_ID: SESSION_ID, CLAUDE_STUB_ANSWERS: answers === undefined ? undefined : JSON.stringify(answers) };
}

/** The rules the stub answers. @param {...string} rules */
const rules = (...rules) => ({ rules });

/** A ledger write: its argv, its stdin and the stub's answers. @param {string[]} argv @param {Record<string, unknown>} content @param {Record<string, unknown>} [answers] */
const writing = (argv, content, answers) => /** @type {const} */ ([dir, ['ledger', ...argv], { env: armed(answers), stdin: JSON.stringify({ ...MADE, why: 'Because.', ...content }) }]);

/** `ledger late-check`, the stub armed with `answers`. @param {Record<string, unknown>} [answers] */
const lateCheck = (answers) => ok(dir, ['ledger', 'late-check'], { env: armed(answers) });

describe('the check\'s log (5.5.9)', () => {
  it('logs every run as a decision is written — one, several with the write refused, unchecked where the call cannot run — with its verb, unit, rule count, outcome and the model that answered, never the entry\'s text; a write that makes no decision logs nothing', () => {
    ok(...writing(['decide', NOTE, '--answers', made.where], { text: SYNC }, { '': rules(SYNC) }));
    refuses(...writing(['decide', NOTE, '--answers', made.where], { text: BOTH }, { '': rules(PANEL, SYNC) }));
    ok(...writing(['decide', NOTE, '--answers', made.where], { text: 'A sheet.' }));
    ok(...writing(['replace', NOTE, '--replaces', made.panel, '--reason', 'changed-mind'], { drops: [], text: 'A frameless panel.' }, { '': rules('A frameless panel.') }));
    ok(...writing(['ask', NOTE], { text: 'Does a note snap to a grid?', why: undefined }));

    assert.deepStrictEqual(checkRuns(), [
      checkRun('decide', 'one', 1), checkRun('decide', 'several', 2), checkRun('decide', 'unchecked', null), checkRun('replace', 'one', 1),
    ]);
  });

  it('logs the late check\'s runs as `late-check`: a decision it cannot judge unchecked, then each it judges, one or several', () => {
    lateCheck();
    lateCheck({ [BOTH]: rules(PANEL, SYNC), [PANEL]: rules(PANEL) });

    assert.deepStrictEqual(checkRuns(), [checkRun('late-check', 'unchecked', null), checkRun('late-check', 'one', 1), checkRun('late-check', 'several', 2)]);
  });

  it('warns where a run cannot be appended, and the check it records stands: the decision lands, one holding several is refused, and the late check records its results, each carrying the warning', (t) => {
    const append = fs.appendFileSync;
    t.mock.method(fs, 'appendFileSync', (/** @type {any} */ file, /** @type {any} */ data) => {
      if (file === CHECK_LOG) throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
      return append(file, data);
    });
    const warning = `the one-decision check's run was not logged (${DECISION_CHECKS}): ENOSPC: no space left on device, write`;

    const landed = ok(...writing(['decide', NOTE, '--answers', made.where], { text: SYNC }, { '': rules(SYNC) }));
    const refused = refusedPristine(...writing(['decide', NOTE, '--answers', made.where], { text: BOTH }, { '': rules(PANEL, SYNC) }));
    const late = lateCheck({ [BOTH]: rules(PANEL, SYNC), [PANEL]: rules(PANEL) });

    assert.deepStrictEqual(landed.warnings, [warning]);
    assert.deepStrictEqual([refused.error.split(' — ')[0], refused.warnings], ['ledger decide: the decision holds 2 rules, and an entry holds one', [warning]]);
    assert.deepStrictEqual([late.checked, late.warnings], [2, [warning, warning]]);
    assert.ok(!fs.existsSync(CHECK_LOG), 'a run was logged through the failing append');
  });
});
