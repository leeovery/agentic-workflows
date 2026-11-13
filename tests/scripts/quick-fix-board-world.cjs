'use strict';

// ---------------------------------------------------------------------------
// What the quick-fix board suites share (test-engine-board-quick-fix*.cjs):
// the worlds, each built once per process and copied at every call, `typo`
// entered by a conversation gone since — made from its inbox note, fixes 1.1
// and 1.2 written and 1.1 started, a call of Claude's made in it and a
// person's decision of the completed `restore` replaced there by Claude
// (`working`); fix 1.1 built, recorded and finish's checklist closed
// (`closable`); fixes 1.1 and 1.2 built and recorded, 1.3 written
// (`recorded`); and made from no note, no fix written (`unwritten`) — the
// entries `working` made; Claude's raise there; and the board as a test's
// conversation reads it, its records in a config folder of each test's own
// (`quickFixBoard`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { ok, okSectionsAsync, writeState, fixtureFrom } = require('./engine-harness.cjs');
const { createManifest, useTempFolder, withEnv } = require('./discovery-test-utils.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, FLAG, HELP, SET, RECORDS, quickFix, createFix, fixBuilt, recordFile, twoFixesBuilt, fixesRecorded, asGone, entered } = require('./quick-fix-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { storeBrief } = require(path.join(SCRIPTS, 'domain/brief.cjs'));
const { issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { roundReportPath, recordReviewer } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));

const SESSION = 'sess-qf';
const EARLIER = 'restore';
const RULED = 'm enters a real mode you can sit in with zero selected';
const CALL_TEXT = 'The README says entering marks the highlighted row';

/** Claude's raise in the quick-fix's conversation, as the raise suites make one. */
const CALL = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

/** The entries `working` made, by short id: the question Claude's call answers and the call, the earlier unit's decision, and Claude's replacing it. */
const made = { asked: '', call: '', ruled: '', replacing: '' };

const working = fixtureFrom('engine-board-quick-fix-', (dir) => {
  quickFix(dir);
  createManifest(dir, EARLIER, { phases: { discussion: { items: { [EARLIER]: { status: 'in-progress' } } } } });
  const { ask, decide } = ledgerReadHelpers(() => dir);
  const at = `${EARLIER}.discussion.${EARLIER}`;
  made.ruled = decide(at, ask(at, 'Does m enter a real mode?'), RULED, [], { by: 'person' });
  createManifest(dir, EARLIER, { status: 'completed', phases: { discussion: { items: { [EARLIER]: { status: 'completed' } } } } });
  asGone((as) => {
    entered(dir, as);
    createFix(dir, 1, FLAG, as);
    createFix(dir, 2, HELP, as);
    ok(dir, ['task', 'start', UNIT, '1.1'], as);
    made.asked = ask(PLACE, 'What does the README say entering does?');
    made.call = decide(PLACE, made.asked, CALL_TEXT);
    made.replacing = ok(dir, ['ledger', 'replace', PLACE, '--replaces', made.ruled, '--reason', 'changed-mind'], {
      ...as, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Pressing m marks the highlighted row.', why: 'The note pins it.', drops: ['the empty set'] }),
    }).id;
  });
});

const closable = fixtureFrom('engine-board-quick-fix-close-', (dir) => {
  quickFix(dir);
  asGone((as) => {
    entered(dir, as);
    fixBuilt(dir, 1, SET[0].title, SET[0].file, SET[0].text, as);
    fixesRecorded(dir, 1, as);
  });
});

const recorded = fixtureFrom('engine-board-quick-fix-recorded-', (dir) => {
  twoFixesBuilt(dir);
  asGone((as) => {
    for (const n of [1, 2]) ok(dir, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n])], as);
    createFix(dir, 3, SET[2].title, as);
  });
});

const unwritten = fixtureFrom('engine-board-quick-fix-unwritten-', (dir) => {
  quickFix(dir, { seeded: false });
  asGone((as) => entered(dir, as));
});

/** A fix's line as the view holds it. @param {string} task @param {string} title @param {string} state @param {{since?: string|null, on?: string[], rounds?: object}} [more] */
const fix = (task, title, state, { since = null, on = [], rounds = {} } = {}) => ({ task, title, state, since, on, rounds: { sent_back: 0, reading: null, passed: null, settled: false, ...rounds } });

/**
 * The board as a suite's conversation reads it, in the project `dir`
 * names, the conversation `session`: the engine as it runs it, a verb run there, the board's answer,
 * the conversation put at the quick-fix's one session; a brief it issued
 * for a fix, a round reported, a round briefed, a question a fix's builder
 * parks its task on; its row in the unit's tab and its line in All work;
 * and a decision replacing another at the quick-fix.
 * @param {() => string} dir @param {string} [session]
 */
function quickFixBoard(dir, session = SESSION) {
  const config = useTempFolder('engine-board-quick-fix-config-');

  /** The engine as this test's conversation runs it. */
  const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: session, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

  /** A verb run in the conversation. @param {string[]} args */
  const run = (args) => ok(dir(), args, { env: env() });

  /** The board's answer, its `ok` dropped. @param {string[]} [args] */
  function board(args = []) {
    const { ok: _ok, ...answer } = run(['board', session, ...args]);
    return answer;
  }

  /** The task ref of fix `task`. @param {string} task */
  const refOf = (task) => ({ unit: UNIT, phase: 1, n: Number(task.split('.')[1]) });

  return {
    env,
    run,
    board,
    refOf,
    /** The conversation at the quick-fix's one session. */
    atTheFixes: () => run(['session', 'label', UNIT, 'implementation', UNIT]),
    /** A brief the conversation issued for a fix, by its role, at `at`. @param {string} role @param {string} task @param {string} at */
    issued(role, task, at) {
      const id = `${role}${task.replace('.', '')}${Date.parse(at)}`;
      withEnv({ LEEWAY_CONFIG_DIR: config() }, () => {
        storeBrief(SESSION, id, 'a brief', { role, agent: 'leeway-builder', unit: UNIT, task, topic: null });
        fs.utimesSync(issuedPath(SESSION, id), new Date(at), new Date(at));
      });
    },
    /** A round of a fix's review reported by both its reviewers, passing or not. @param {string} task @param {number} round @param {boolean} passes */
    reported(task, round, passes) {
      const text = passes ? '## Findings\n\nNone.\n\nVerdict: pass\n' : '## Findings\n\n- serious: the flag still reads --color\n  Scenario: a script passes --colour.\n\nVerdict: fail\n';
      for (const letter of ['a', 'b']) writeState(dir(), roundReportPath(refOf(task), round, letter), text);
    },
    /** A round of a fix's review briefed in this conversation, its reports not yet in. @param {string} task @param {number} round */
    briefedRound(task, round) {
      for (const letter of ['a', 'b']) recordReviewer(dir(), refOf(task), round, letter, SESSION);
    },
    /** A question a fix's builder parks its task on, raised for it (19.5.25). @param {string} task @param {string} question */
    async parkedOn(task, question) {
      const asked = ledgerReadHelpers(dir).ask(PLACE, question);
      await okSectionsAsync(dir(), ['raise', PLACE, '--answers', asked, '--parks', task], { env: env(), stdin: JSON.stringify({ ...CALL, question }) });
    },
    /** Its row in the unit's tab and its line in All work. */
    rows() {
      const row = board(['--tab', 'unit']).view.phases.find((/** @type {{phase: string}} */ held) => held.phase === 'implementation');
      const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);
      return { row, line };
    },
    /** A decision `by` makes at the quick-fix replacing `old`, in the conversation: its short id. @param {string} old @param {'person'|'claude'} by @param {string} text */
    replaced: (old, by, text) => ledgerReadHelpers(dir).write('replace', PLACE, ['--replaces', old, '--reason', 'changed-mind'], {
      by, ...(by === 'claude' ? { who_moved_whom: 'none' } : {}), text, why: `Why: ${text}`, drops: ['the old wording'],
    }, env()).id,
  };
}

module.exports = { SESSION, EARLIER, RULED, CALL_TEXT, CALL, made, working, closable, recorded, unwritten, fix, quickFixBoard };
