'use strict';

// ---------------------------------------------------------------------------
// The entry's catch-up (ledger-engine/scripts/domain/catch-up.cjs): each
// place keeps the conversations that entered it, `conversations.json`, and
// an entry names in its DATA's `catch up` lines, oldest first, each one not
// yet named, but its own and any still holding the place live, by its
// transcript or a line that it is gone; marks those it named; and records
// itself. So each conversation is named once, to the next that enters; an
// entry taking the place over (`--take`) names the one it takes from, live
// as it is. An entry that starts its place names none and marks every row;
// a type call names and records nothing, and an entry stopped by the held
// question writes nothing. A conversation arriving at another place — an
// entry, a level move, `session label`, the epic's menu or the roadmap
// drawn (session-label.cjs, `arriveAt`) — has its row where it was marked;
// one leaving by the start menu keeps its row, still named. A conversation
// resumed (`session resume`) is recorded again where it was. A conversation
// before this one in the same Claude process is no live peer (presence.cjs,
// `heldLive`). Discovery's other reads are test-engine-enter.cjs's; the
// review's entry is test-engine-review-entry.cjs's.
//
// Layer: verb. World, built once and copied: a feature, `memo`, its topic
// under discussion, and one, `settled`, its topic decided; a bugfix,
// `crash`, under investigation; an epic, `lab`, its topic `timing` under
// discussion with one experiment conceived. Each test's conversations share
// a system config, and a Claude Code config holding the transcripts.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, okSections, output, sectionOf, commitAll, fixtureFrom, cleanupFixture, statePath, layout, writeState } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { setup, problemScratch, SESSION, MADE } = require('./experiment-world.cjs');

const PEER = String(process.ppid);

const world = fixtureFrom('engine-enter-catch-up-', (dir) => {
  setup(dir);
  createManifest(dir, 'memo', { phases: { discussion: { items: { memo: { status: 'in-progress' } } } } });
  createManifest(dir, 'settled', { phases: { discussion: { items: { settled: { status: 'completed' } } } } });
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  commitAll(dir, 'the units');
  const question = ok(dir, ['ledger', 'ask', 'lab.discussion.timing'], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Where does a new window open?' }) }).id;
  ok(dir, ['experiment', 'create', 'lab', 'timing', '--slug', 'placement', '--from', 'discussion', '--problem', problemScratch(dir, 'placement'), '--question', question]);
});

let dir; // the project
let config; // the system config: the conversations' folders
let claude; // Claude Code's config: the transcripts

/** The engine as the conversation `session` runs it, in the process `pid`. @param {string} session @param {string} [pid] */
const env = (session, pid = String(process.pid)) => ({ LEDGER_CONFIG_DIR: config, CLAUDE_CONFIG_DIR: claude, CLAUDE_CODE_SESSION_ID: session, CLAUDE_PID: pid, TMUX: undefined, TMUX_PANE: undefined });

/** A conversation's transcript, where Claude Code keeps it. @param {string} session */
function transcript(session) {
  const file = path.join(claude, 'projects', '-Users-person-memo', `${session}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  return file;
}

/** An entry by the conversation `session`: its `catch up` lines' values. @param {string[]} args @param {string} session @param {string} [pid] */
function caughtUp(args, session, pid) {
  const { sections } = okSections(dir, ['enter', ...args], { env: env(session, pid) });
  return sectionOf(sections, 'DATA').split('\n').filter((line) => line.startsWith('catch up: ')).map((line) => line.slice('catch up: '.length));
}

/** The conversation `session` ending, its presence dropped as Claude Code's SessionEnd hook drops it. @param {string} session */
const ends = (session) => ok(dir, ['presence', 'cleanup', session], { env: env(session) });

/** The line saying a transcript is gone. @param {string} session */
const gone = (session) => `the transcript of session ${session} is gone — say so in one line, and carry on from what this place keeps`;

/** A place's rows as kept. @param {string} unit @param {string} phase @param {string} topic */
const rowsAt = (unit, phase, topic) => statePath(dir, layout.cache(unit, phase, topic, 'conversations.json'));

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-catch-up-config-'));
  claude = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-catch-up-claude-'));
});

afterEach(() => {
  cleanupFixture(dir);
  for (const folder of [config, claude]) fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('catching up on the conversations before this one', () => {
  it('names a conversation once, to the next that enters, and never again', () => {
    const [first, second] = [transcript('A'), transcript('B')];
    caughtUp(['discussion', 'memo'], 'A');
    ends('A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [first]);
    ends('B');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'C'), [second]);
  });

  it('passes over one still live in another process, and names it to the first entry after it ends: at the product\'s conversation, which several hold at once', () => {
    const [first, second] = [transcript('A'), transcript('B')];
    caughtUp(['discovery', 'product'], 'A', PEER);
    assert.deepStrictEqual(caughtUp(['discovery', 'product'], 'B'), []);
    ends('A');
    ends('B');
    assert.deepStrictEqual(caughtUp(['discovery', 'product'], 'C'), [first, second]);
  });

  it('an entry taking the place over names the conversation it takes from, live as it is, and the next entry is named the taker alone', () => {
    const [first, second] = [transcript('A'), transcript('B')];
    caughtUp(['discussion', 'memo'], 'A', PEER);
    assert.deepStrictEqual(caughtUp(['discussion', 'memo', '--take'], 'B'), [first]);
    ends('B');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'C'), [second]);
  });

  it('an entry stopped by the question where another session holds the place writes nothing to the rows', () => {
    caughtUp(['discussion', 'memo'], 'A', PEER);
    const before = fs.readFileSync(rowsAt('memo', 'discussion', 'memo'), 'utf8');
    const { res } = okSections(dir, ['enter', 'discussion', 'memo'], { env: env('B') });
    assert.deepStrictEqual([res.entered, fs.readFileSync(rowsAt('memo', 'discussion', 'memo'), 'utf8')], [false, before]);
  });

  it('names one before this one in the same Claude process, its row left behind by a /clear the sweep never saw', () => {
    const first = transcript('A');
    caughtUp(['discussion', 'memo'], 'A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [first]);
  });

  it('a conversation entering again keeps its one row and changes no other\'s mark: the one after it is named that one alone', () => {
    const [first, second] = [transcript('X'), transcript('R')];
    caughtUp(['investigation', 'crash'], 'X');
    ends('X');
    assert.deepStrictEqual(caughtUp(['investigation', 'crash'], 'R'), [first]);
    assert.deepStrictEqual(caughtUp(['investigation', 'crash'], 'R'), []);
    ends('R');
    assert.deepStrictEqual(caughtUp(['investigation', 'crash'], 'B'), [second]);
  });

  it('a conversation arriving elsewhere is not named where it was: a level move out of the product\'s conversation and out of a topic, a move to the unit\'s menu, the epic\'s menu drawn and the roadmap drawn', () => {
    caughtUp(['discovery', 'product'], 'A');
    caughtUp(['discovery', 'lab', '--move'], 'A');
    caughtUp(['discussion', 'lab', 'timing'], 'B');
    caughtUp(['discovery', 'lab', '--move'], 'B');
    caughtUp(['discussion', 'memo'], 'C');
    ok(dir, ['session', 'label', 'memo'], { env: env('C') });
    caughtUp(['experiment', 'lab', 'timing'], 'E');
    output(dir, ['render', 'epic-menu', 'lab'], { env: env('E') });
    caughtUp(['investigation', 'crash'], 'F');
    output(dir, ['render', 'roadmap'], { env: env('F') });
    for (const session of ['A', 'B', 'C', 'E', 'F']) ends(session);
    const places = [['discovery', 'product'], ['discussion', 'lab', 'timing'], ['discussion', 'memo'], ['experiment', 'lab', 'timing'], ['investigation', 'crash']];
    assert.deepStrictEqual(places.map((args) => caughtUp(args, 'D')), places.map(() => []));
  });

  it('a conversation leaving by the start menu keeps its row, still named to the next entry where it was', () => {
    const first = transcript('A');
    caughtUp(['discussion', 'memo'], 'A');
    output(dir, ['render', 'start-menu'], { env: env('A') });
    caughtUp(['investigation', 'crash'], 'A');
    ends('A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [first]);
  });

  it('a conversation resumed is recorded again where it was, so the entry after it is named it again, labels off as they are here', () => {
    const [first, second] = [transcript('A'), transcript('B')];
    caughtUp(['discussion', 'memo'], 'A');
    ends('A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [first]);
    ends('B');
    output(dir, ['session', 'resume', 'A'], { env: env('A') });
    ends('A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'C'), [second, first]);
  });

  it('an entry that starts its place names none and marks every row: the product\'s conversation opening its next session once the last closed', () => {
    const second = transcript('B');
    caughtUp(['discovery', 'product'], 'A');
    ok(dir, ['discovery-session', 'close', 'product', '-m', 'discovery(product): end the session'], { env: env('A') });
    ends('A');
    assert.deepStrictEqual(caughtUp(['discovery', 'product'], 'B'), []);
    ends('B');
    assert.deepStrictEqual(caughtUp(['discovery', 'product'], 'C'), [second]);
  });

  it('a type call names none and records none: the entry after it is named the conversation before', () => {
    const first = transcript('A');
    caughtUp(['discovery', 'product'], 'A');
    ends('A');
    const before = fs.readFileSync(rowsAt('product', 'discovery', 'product'), 'utf8');
    assert.deepStrictEqual(caughtUp(['discovery', 'product', '--type-call'], 'B'), []);
    assert.strictEqual(fs.readFileSync(rowsAt('product', 'discovery', 'product'), 'utf8'), before);
    assert.deepStrictEqual(caughtUp(['discovery', 'product'], 'B'), [first]);
  });

  it('keeps five rows, the oldest named going first, before one not yet named — at the product, a conversation live in another window — each with its transcript where one is found', () => {
    const sessions = ['A', 'B', 'C', 'D', 'E', 'F'];
    const transcripts = Object.fromEntries(sessions.slice(0, -1).map((session) => [session, transcript(session)]));
    caughtUp(['discovery', 'product'], 'A', PEER);
    for (const session of sessions.slice(1)) caughtUp(['discovery', 'product'], session);
    const { conversations } = JSON.parse(fs.readFileSync(rowsAt('product', 'discovery', 'product'), 'utf8'));
    assert.deepStrictEqual(conversations, ['A', 'C', 'D', 'E', 'F'].map((session) => ({ session, transcript: transcripts[session] ?? null, told: !['A', 'F'].includes(session) })));
  });

  it('passes over a row of another shape and a file that does not read; a transcript gone is named by a line saying so', () => {
    writeState(dir, layout.cache('memo', 'discussion', 'memo', 'conversations.json'), JSON.stringify({ conversations: [null, { session: 1 }, { session: 'A', transcript: null, told: false }] }));
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [gone('A')]);
    writeState(dir, layout.cache('crash', 'investigation', 'crash', 'conversations.json'), 'null');
    assert.deepStrictEqual(caughtUp(['investigation', 'crash'], 'B'), []);
  });

  it('names a conversation whose transcript was not found as it entered by the one Claude Code keeps under its id by now', () => {
    caughtUp(['discussion', 'memo'], 'A');
    const first = transcript('A');
    ends('A');
    assert.deepStrictEqual(caughtUp(['discussion', 'memo'], 'B'), [first]);
  });
});

describe('each phase\'s entry, as its row enters it', () => {
  it('discovery at an epic, the specification and the laboratory name the conversation before', () => {
    const entries = [['discovery', 'lab'], ['specification', 'settled'], ['experiment', 'lab', 'timing']];
    const named = entries.map((args, at) => {
      const [earlier, later] = [`a${at}`, `b${at}`];
      const file = transcript(earlier);
      caughtUp(args, earlier);
      ends(earlier);
      return [args[0], caughtUp(args, later), file];
    });
    assert.deepStrictEqual(named.map(([phase, lines]) => [phase, lines]), named.map(([phase, , file]) => [phase, [file]]));
  });
});
