'use strict';

// ---------------------------------------------------------------------------
// The line on decisions from before Ledger (ledger-engine/scripts/domain/
// decisions-from-before.cjs, `fromBeforeLines`): at an entry into a phase
// whose work reads the code against the record's decisions — discussion,
// investigation, specification, the build, a quick-fix's arm among it, and
// review — the DATA names the shared reference on them, with what it covers
// and when to load it, where the work holds a current decision from before
// Ledger, its line the migration's whoever made it: the unit's own, or one
// product-wide in any live unit. None at discovery or the laboratory, and
// none where the work holds no such decision: its decisions made in Ledger,
// the one from before replaced since, or only a question and a finding the
// migration carried. The phase's note after a compaction carries the same
// line where the entry would (position.cjs). The entry's other reads are
// test-engine-enter.cjs's; the note's, test-engine-position.cjs's.
//
// Layer: verb. World, built once and copied: a feature, `memo`, holding a
// decision from before Ledger, the person's by its line; a bugfix, `crash`,
// and a quick-fix, `tweak`, each holding one too; a feature, `fresh`, whose
// one decision was made in Ledger; a feature, `moved-on`, whose decision
// from before was replaced in Ledger since; and a feature, `asked`, holding
// a question and a finding the migration carried, and no decision; with the
// skills the notes name installed. Each test's conversation has its own
// system config. The phases past discussion and investigation are entered
// through a table of rows that start and read nothing, named for each
// phase, the build's handing a quick-fix to an arm of its own: the line is
// the entry's, whatever its row reads.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { okSections, output, sectionOf, commitAll, fixtureFrom, cleanupFixture, withEnv, statePath } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { enterThrough } = require('../../skills/ledger-engine/scripts/domain/enter.cjs');
const { appendEntry } = require('../../skills/ledger-engine/scripts/domain/ledger.cjs');
const { newId } = require('../../skills/ledger-engine/scripts/domain/ledger-ids.cjs');
const { CARRIED_SESSION } = require('../../skills/ledger-engine/scripts/domain/ledger-events.cjs');

const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'sess-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const REFERENCE = path.resolve(__dirname, '../../skills/ledger-shared/references/decisions-from-before.md');
const NAMED = `decisions from before: ${REFERENCE} — how to settle code built otherwise than a decision from before Ledger, which the migration never checked against the code; load it when the work meets code one of the record's decisions from before bears on`;

/** A line the migration carried at `address`, its own `content` over its tags. @param {string} dir @param {string} address @param {Record<string, unknown>} content */
function carriedLine(dir, address, content) {
  const [unit, phase, topic] = address.split('.');
  appendEntry(statePath(dir), { unit, topic, phase, session: CARRIED_SESSION, ...MADE, relies_on: [], cites: [], task: null, ...content }, [], newId());
}

const world = fixtureFrom('engine-enter-from-before-', (dir) => {
  for (const unit of ['memo', 'fresh', 'moved-on', 'asked']) createManifest(dir, unit, { phases: { discussion: { items: { [unit]: { status: 'in-progress' } } } } });
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  createManifest(dir, 'tweak', { work_type: 'quick-fix' });
  for (const skill of ['ledger-discussion-process', 'ledger-quick-fix-process']) {
    fs.mkdirSync(path.join(dir, '.claude/skills', skill), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude/skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  commitAll(dir, 'the units');
  const { write, carriedOver } = ledgerHelpers(() => dir);
  /** A question asked at `at`: its short id. @param {string} at @param {string} text */
  const asked = (at, text) => write('ask', at, [], { ...MADE, text }).id;
  carriedOver('memo.discussion.memo', asked('memo.discussion.memo', 'How long is a memo?'), 'One line.', 'person');
  carriedOver('crash.investigation.crash', asked('crash.investigation.crash', 'Does a crash keep the draft?'), 'It keeps it.');
  carriedOver('tweak.implementation', asked('tweak.implementation', 'Does --colour take a value?'), 'It takes none.');
  write('decide', 'fresh.discussion.fresh', ['--answers', asked('fresh.discussion.fresh', 'How is a memo shared?')], { ...MADE, text: 'By link.', why: 'Links travel.' });
  const replaced = carriedOver('moved-on.discussion.moved-on', asked('moved-on.discussion.moved-on', 'Is a memo pinned?'), 'Never.');
  write('replace', 'moved-on.discussion.moved-on', ['--replaces', replaced, '--reason', 'changed-mind'], { ...MADE, drops: ['Never.'], text: 'On request.', why: 'People asked.' });
  carriedLine(dir, 'asked.discussion.asked', { event: 'asked', text: 'Is a memo ever archived?', part_of: null, from_before: null });
  carriedLine(dir, 'asked.discussion.asked', { event: 'found', text: 'Memos are kept a year.', how: 'read in the old spec', product_wide: false, known: 'read', command: null, result: null });
  commitAll(dir, 'the records');
});

/** A row that starts and reads nothing, entered at the unit. */
const ROW = Object.freeze({ level: /** @type {'unit'} */ ('unit'), standing: () => null, unstarted: () => false, start: () => {}, questions: () => [], reads: () => [] });

/** The quick-fix's arm of the build's row: a row of its own, reading that it is. */
const ARM = Object.freeze({ ...ROW, reads: () => [/** @type {[string, string]} */ (['arm', 'quick-fix'])] });

/** A row for each phase, the build's handing a quick-fix to its arm. */
const ROWS = Object.freeze({
  discussion: ROW, discovery: ROW, specification: ROW, review: ROW, investigation: ROW, experiment: ROW,
  implementation: { ...ROW, arm: (/** @type {Record<string, any>} */ manifest) => (manifest.work_type === 'quick-fix' ? ARM : null) },
});

let dir; // the project
let config; // the system config: the conversation's folder

/** The engine as this test's conversation runs it. */
const env = () => ({ ...SESSION, LEDGER_CONFIG_DIR: config, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** The lines naming the reference, from text. @param {string} text */
const named = (text) => text.split('\n').filter((line) => line.startsWith('decisions from before: '));

/** The real entry, through the engine: the DATA's lines naming the reference. @param {string[]} args */
const entered = (args) => named(sectionOf(okSections(dir, ['enter', ...args], { env: env() }).sections, 'DATA'));

/** An entry through the table of rows, in this process as the conversation runs it: the DATA's lines naming the reference, and the arm's. @param {string} phase @param {string} unit */
function enteredAt(phase, unit) {
  const data = sectionOf(withEnv(env(), () => enterThrough(ROWS, dir, [phase, unit])).sections, 'DATA');
  return [...named(data), ...data.split('\n').filter((line) => line.startsWith('arm: '))];
}

/** The note after a compaction where the conversation is now: its lines naming the reference. */
const noted = () => named(output(dir, ['conversation', 'position'], { env: env() }));

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-from-before-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('the line on decisions from before Ledger', () => {
  it('names the shared reference, which is there, with what it covers and when to load it, at an entry into a unit holding a decision from before Ledger — the person\'s by its line among them', () => {
    assert.deepStrictEqual([entered(['discussion', 'memo']), entered(['investigation', 'crash'])], [[NAMED], [NAMED]]);
    assert.ok(fs.existsSync(REFERENCE), `${REFERENCE} is not there`);
  });

  it('is on the entry of every phase whose work reads the code against the decisions — a quick-fix\'s arm of the build among them — and on neither discovery\'s nor the laboratory\'s', () => {
    assert.deepStrictEqual(['discussion', 'specification', 'implementation', 'review', 'discovery', 'experiment'].map((phase) => [phase, enteredAt(phase, 'memo')]), [
      ['discussion', [NAMED]], ['specification', [NAMED]], ['implementation', [NAMED]], ['review', [NAMED]], ['discovery', []], ['experiment', []],
    ]);
    assert.deepStrictEqual([enteredAt('investigation', 'crash'), enteredAt('implementation', 'tweak'), enteredAt('review', 'tweak')], [[NAMED], [NAMED, 'arm: quick-fix'], [NAMED]]);
  });

  it('names none where the work holds no current decision from before Ledger: its decisions made in Ledger, the one from before replaced since, or only a question and a finding the migration carried', () => {
    assert.deepStrictEqual([entered(['discussion', 'fresh']), entered(['discussion', 'moved-on']), entered(['discussion', 'asked'])], [[], [], []]);
  });

  it('names it at a unit holding none of its own where another live unit holds a product-wide decision from before Ledger', () => {
    const { write, carriedOver } = ledgerHelpers(() => dir);
    carriedOver('crash.investigation.crash', write('ask', 'crash.investigation.crash', [], { ...MADE, text: 'Is every draft kept a week?' }).id, 'Every draft is kept a week.', 'claude', true);
    commitAll(dir, 'a product-wide decision from before');

    assert.deepStrictEqual(entered(['discussion', 'fresh']), [NAMED]);
  });

  it('rides in the phase\'s note after a compaction where the entry names it — a quick-fix\'s build among them — and in none where it names none', () => {
    entered(['discussion', 'memo']);
    const discussion = noted();
    enteredAt('implementation', 'tweak');
    const build = noted();
    entered(['discussion', 'fresh']);

    assert.deepStrictEqual([discussion, build, noted()], [[NAMED], [NAMED], []]);
  });
});
