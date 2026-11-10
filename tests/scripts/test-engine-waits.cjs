'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a unit before its build, with no conversation of
// their own: what waits on the person there (leeway-engine/scripts/domain/
// waits.cjs; 18.2.3, 18.2.4) — approve the map staged, an epic's topic's
// decided staged against its standing close, the spec's gaps and else ready
// to build, a raise sealed in any conversation at a bug's investigation
// (E4), the decided topics an answer replaced since holds (10.2.6), and,
// asked for, the verdicts waiting on the unit's departures — each with its
// door; and how far the unit has come, as a menu's row says it
// (domain/progress.cjs; 7.4.1). The build's, a quick-fix's and the cut's:
// test-engine-waits-build.cjs.
//
// Layer: verb, the reads called in process. Worlds: the decided suites'
// (decided-world.cjs) and the spec writer's (spec-review-world.cjs), each
// copied for each test; and a bug entered at its investigation in the
// fixture library's project.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, okSectionsAsync, output, readManifest, commitAll, cleanupFixture } = require('./engine-harness.cjs');
const { setupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { ledgerHelpers, leaningCall, UNIT: FUMI, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { SOLO, SOLO_AT, NO_PAYLOAD, NOTE_MAP, writeIn, answeredIn, markAllButTheClosingPass, useDecidedWorld, decidedHelpers, decidedBoardHelpers } = require('./decided-world.cjs');
const { UNIT: PAYMENTS, AT_SPEC, made: specMade, useSpecReviewWorld, specReviewHelpers } = require('./spec-review-world.cjs');
const { specBoard } = require('./spec-board-world.cjs');
const { waitsIn, progress, door, wait } = require('./waits-world.cjs');

describe('an epic\'s gates, the topics a changed answer holds, and the verdicts waiting (18.2.3, 10.2.6)', () => {
  const dir = useDecidedWorld();
  const { close, payload, staged, reverse } = decidedHelpers(dir);
  const { made } = decidedBoardHelpers(dir);
  const intoNote = door('leeway-discussion-process', 'epic', FUMI, 'note-window');
  const DECIDED = wait('decided', 'note-window', 'Decided: Note Window', intoNote, 'note-window');

  it('approve the map waits while a map is staged for the epic, its door the epic\'s own discovery', () => {
    const before = waitsIn(dir(), [FUMI]);
    output(dir(), ['render', 'approve-map', FUMI, '--file', payload({ topics: [{ name: 'note-window' }, { name: 'space-homing' }], parks: [] })], { env: SESSION });

    assert.deepStrictEqual([before, waitsIn(dir(), [FUMI])], [
      { [FUMI]: [] },
      { [FUMI]: [wait('map', 'approve-the-map', 'Approve the map', { kind: 'handoff', skill: 'leeway-discovery', args: ['none', FUMI] })] },
    ]);
  });

  it('a topic\'s decided waits while its close stands and Claude\'s payload is staged against it, its door the topic\'s discussion — not closed with nothing staged, nor once the topic is postponed', () => {
    close();
    const unstaged = waitsIn(dir(), [FUMI]);
    staged(NO_PAYLOAD);
    const waiting = waitsIn(dir(), [FUMI]);
    ok(dir(), ['topic', 'postpone', FUMI, 'note-window', '--horizon', 'later'], { env: SESSION });

    assert.deepStrictEqual([unstaged, waiting, waitsIn(dir(), [FUMI])], [{ [FUMI]: [] }, { [FUMI]: [DECIDED] }, { [FUMI]: [] }]);
  });

  it('a payload staged against a close that no longer stands waits for nothing: the discussion gone on since, or the topic closed anew', () => {
    close();
    staged(NO_PAYLOAD);
    answeredIn(dir(), NOTE, 'Does a note keep its size?', { ...MADE, text: 'It does.' });
    const voided = waitsIn(dir(), [FUMI]);
    markAllButTheClosingPass(dir(), FUMI, 'note-window');
    close();

    assert.deepStrictEqual([voided, waitsIn(dir(), [FUMI])], [{ [FUMI]: [] }, { [FUMI]: [] }]);
  });

  it('10.2.6: a decided topic holding an entry that relies on an answer replaced since waits, its door the topic\'s discussion; a topic still under discussion holds its own', () => {
    const homing = answeredIn(dir(), SPACE, 'Does a space remember its notes?', { ...MADE, text: 'It does.' });
    const asked = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Where does a note open?' });
    writeIn(dir(), 'decide', NOTE, ['--answers', asked, '--relies-on', homing.answer], { ...MADE, text: 'In the space that made it.', why: 'Spaces remember.' });
    writeIn(dir(), 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'It does not.', why: 'The person wants it so.' });
    const discussing = waitsIn(dir(), [FUMI]);
    const manifest = readManifest(dir(), FUMI);
    manifest.phases.discussion.items['note-window'].status = 'completed';
    createManifest(dir(), FUMI, manifest);

    assert.deepStrictEqual([discussing, waitsIn(dir(), [FUMI])], [
      { [FUMI]: [] },
      { [FUMI]: [wait('affected', 'note-window', '"Note Window": a decision it relies on changed', intoNote, 'note-window')] },
    ]);
  });

  it('asked for, each verdict waiting on a departure standing in the unit, by its entry and words, its door the verdict page — never unasked, and never another unit\'s', () => {
    const sync = reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const tally = answeredIn(dir(), SOLO_AT, 'Does a tally show a total?', { ...MADE, text: 'It does.' });
    const total = writeIn(dir(), 'replace', SOLO_AT, ['--replaces', tally.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the total'], text: 'No total.', why: 'The person wants it so.' });
    const VERDICTS = { kind: 'engine', argv: ['render', 'verdicts'] };

    assert.deepStrictEqual([waitsIn(dir(), [FUMI, SOLO]), waitsIn(dir(), [FUMI, SOLO], { verdicts: true })], [
      { [FUMI]: [], [SOLO]: [] },
      { [FUMI]: [wait('verdict', sync, 'Off until you turn it on.', VERDICTS)], [SOLO]: [wait('verdict', total, 'No total.', VERDICTS)] },
    ]);
  });

  it('7.4.1: an epic in discovery says its topics on the map, in discussion its topics decided of all; a feature\'s discussion has no measure', () => {
    made('atlas', 'epic');

    assert.deepStrictEqual([progress(dir(), 'atlas'), progress(dir(), FUMI), progress(dir(), SOLO)], ['discovery, 0 topics on the map', 'discussion, 0 of 2 topics decided', 'discussion']);
  });
});

describe('a spec\'s gaps and ready to build (18.2.3)', () => {
  const dir = useSpecReviewWorld();
  const { cleanPass } = specReviewHelpers(dir);
  const { tracedLanded, readyClosed, bothWaiting } = specBoard(dir);
  const { write } = ledgerHelpers(dir);
  const intoSpec = door('leeway-specification-process', 'epic', PAYMENTS);

  it('each gap waits while the spec is under way, by its entry and words, its door the specification: a question asked at the spec and a replacement a pass raised', () => {
    const asked = bothWaiting();

    assert.deepStrictEqual(waitsIn(dir(), [PAYMENTS]), { [PAYMENTS]: [wait('question', asked, 'Is a refund ever split?', intoSpec), wait('question', specMade.where, 'Back to the card.', intoSpec)] });
  });

  it('ready to build waits once its screen draws, its door the specification, and not while a gap waits, its screen refusing then; the unit is in its specification', () => {
    tracedLanded();
    cleanPass();
    readyClosed();
    const ready = waitsIn(dir(), [PAYMENTS]);
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;

    assert.deepStrictEqual([ready, waitsIn(dir(), [PAYMENTS]), progress(dir(), PAYMENTS)], [
      { [PAYMENTS]: [wait('ready', 'ready-to-build', 'Ready to build', intoSpec)] },
      { [PAYMENTS]: [wait('question', asked, 'Is a refund ever split?', intoSpec)] },
      'specification',
    ]);
  });
});

describe('a bug\'s investigation (18.2.3, E4)', () => {
  const BUGS = ['kill-all', 'empty-save'];
  /** @type {string} */
  let dir;
  /** @type {string} */
  let config;
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(config, { recursive: true, force: true });
  });

  /** The conversation the raises are sealed in. */
  const as = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-hunt', TMUX: undefined, TMUX_PANE: undefined });

  /** Claude's question at a bug's investigation, at its topic or its own level, raised in the conversation: the question's short id and the raise's id. @param {string} bug @param {string} at */
  async function raisedAt(bug, at) {
    const question = `What does ${bug} lose?`;
    const asked = ledgerHelpers(() => dir).write('ask', at, [], { ...MADE, text: question }).id;
    const { raise } = (await okSectionsAsync(dir, ['raise', at, '--answers', asked], { env: as(), stdin: JSON.stringify({ ...leaningCall('Every session.', 'The last one.'), question }) })).res;
    return { asked, raise };
  }

  it('a raise sealed at a bug\'s investigation, at its topic or its own level, waits there until answered, read with no conversation, each bug its own; its door the investigation; the unit is in its investigation', async () => {
    dir = setupFixture('waits-bug-');
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'waits-bug-config-'));
    for (const bug of BUGS) createManifest(dir, bug, { work_type: 'bugfix', description: `${bug} loses the saved state` });
    commitAll(dir, 'the bugs');
    for (const bug of BUGS) ok(dir, ['enter', 'investigation', bug], { env: { CLAUDE_PID: undefined } });
    const killAll = await raisedAt(BUGS[0], `${BUGS[0]}.investigation.${BUGS[0]}`);
    const emptySave = await raisedAt(BUGS[1], `${BUGS[1]}.investigation`);
    const waiting = waitsIn(dir, BUGS, { config });
    ok(dir, ['raise', 'answer', killAll.raise, '--pick', '1'], { env: as(), stdin: JSON.stringify({ why: 'Every session is lost.' }) });
    /** The question raised at `bug`, waiting. @param {string} bug @param {string} id */
    const raised = (bug, id) => wait('question', id, `What does ${bug} lose?`, door('leeway-investigation-process', 'bugfix', bug));

    assert.deepStrictEqual([waiting, waitsIn(dir, BUGS, { config }), progress(dir, BUGS[0])], [
      { [BUGS[0]]: [raised(BUGS[0], killAll.asked)], [BUGS[1]]: [raised(BUGS[1], emptySave.asked)] },
      { [BUGS[0]]: [], [BUGS[1]]: [raised(BUGS[1], emptySave.asked)] },
      'investigation',
    ]);
  });
});
