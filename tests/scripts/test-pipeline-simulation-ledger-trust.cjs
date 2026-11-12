'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's trust-log scenarios: Claude's calls, the
// person's answers to them through the ledger verbs, the verdicts and the
// raises, each landing a line of the trust log where it is a departure, each
// question labelled by the stub armed for the labeller (labels.cjs), and the
// person's own words read by it as the reader; and the record of the person
// — a care entry added on its screens, the "don't care" answers that cue its
// drop, the drop and a preference kept on the proposal screen.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { startItem } = require('./engine-harness.cjs');
const { Sim, mappedEpic, answerGate } = require('./pipeline-world.cjs');
const { trustLines } = require('./pipeline-oracle.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');

describe('pipeline simulation: the trust log', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the trust log: Claude\'s call, the person\'s reversal of it, the verdicts on that departure — skipped on the decided screen, a real loss from the verdict page — Claude\'s call replacing it, the person\'s answers to Claude\'s lean through a raise, one taking it, one standing over it and one in their own words read as it, owed no verdict, and their keep of a call Claude proposed to replace, each land as a line of the trust log in the command that writes it; the person\'s own decision, changed, lands none, nor does their answer to a fact or their not following one', async () => {
    const wu = 'fumi';
    sim.env = {
      ...sim.env,
      CLAUDE_STUB_ANSWERS: JSON.stringify({
        'The answer: ': 'no-login',
        'The reply: ': { row: '2' },
        'Is a note a window?': labelAnswers('look', { hardToUndo: true }),
        'What is a note?': labelAnswers('behaviour'),
        'Does a note have a title?': labelAnswers('words'),
        '': 'no-login',
      }),
    };
    mappedEpic(sim, wu, ['note-window']);
    startItem(sim.dir, wu, 'discussion', 'note-window');
    const note = `${wu}.discussion.note-window`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    /** One write, its content on stdin: its short id. @param {string[]} args @param {Record<string, unknown>} content */
    const ledger = (args, content) => sim.run(['ledger', ...args], null, JSON.stringify(content)).id;

    const question = ledger(['ask', note], { ...made, text: 'Is a note a window?' });
    const call = ledger(['decide', note, '--answers', question], { ...made, text: 'A floating panel.', why: 'It follows the person.' });
    const reversal = ledger(['replace', note, '--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['a panel'], text: 'A document window.', why: 'Notes are documents.' });
    sim.run(['verdict', 'give', reversal, 'skip', '--at', 'decided']);
    sim.run(['verdict', 'queue']);
    sim.render(['verdicts'], { expect: 'content' });
    sim.render(['verdicts', '--unit', wu], { expect: 'content' });
    sim.run(['verdict', 'give', reversal, 'loss', '--at', 'queue']);
    sim.render(['verdicts'], { expect: 'empty' });
    ledger(['replace', note, '--replaces', reversal, '--reason', 'changed-mind'], { ...made, drops: ['a document window'], text: 'A floating panel after all.', why: 'It follows the person.' });

    /** Claude's lean on a question of its own, raised, and the person's pick of row `key`. @param {string} text @param {'1'|'2'} key */
    const raised = async (text, key) => {
      const question = ledger(['ask', note], { ...made, text });
      const { raise } = await sim.runAsync(['raise', note, '--answers', question], null, JSON.stringify(leaningCall('It floats.', 'It stays put.')));
      sim.run(['raise', 'answer', raise, '--pick', key], null, JSON.stringify({ why: 'The person said why.' }));
    };
    await raised('Does a note float?', '1');
    await raised('Does a note take focus?', '2');

    // The person's own words, which the separate call reads as the lean's
    // row, the second: an agreement, owed no verdict.
    const stacking = ledger(['ask', note], { ...made, text: 'Does a note stay above other windows?' });
    const stacked = (await sim.runAsync(['raise', note, '--answers', stacking], null, JSON.stringify({ ...leaningCall('It stays put.', 'It floats.'), lean: '2' }))).raise;
    sim.run(['raise', 'answer', stacked, '--own'], null, JSON.stringify({ text: 'Keep it floating over the rest.', why: 'The person said why.' }));
    assert.ok(!sim.run(['verdict', 'queue']).departures.some((/** @type {{id: string}} */ d) => stacked.startsWith(d.id)), 'own words read as the lean wait on a verdict');

    // Claude proposing to change an earlier call of its own, and the person
    // keeping it as it stands: a keep at the raise's id, its raise event
    // naming it.
    const snapping = ledger(['ask', note], { ...made, text: 'Does a note snap to the grid?' });
    const snaps = ledger(['decide', note, '--answers', snapping], { ...made, text: 'Notes snap to the grid.', why: 'Tidy desks.' });
    const proposed = await sim.runAsync(['raise', note, '--replaces', snaps, '--reason', 'changed-mind'], null, JSON.stringify(leaningCall('Notes float free.', 'Notes snap to a coarse grid.')));
    sim.run(['raise', 'answer', proposed.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'The person likes the grid.' }));

    // A fact only the person holds, raised with no rows: the person's own
    // words land as their decision, and nothing reaches the trust log, their
    // "I don't follow" included.
    const signing = ledger(['ask', note], { ...made, text: 'Which team signs the beta?' });
    const fact = { question: 'Which team signs the beta?', rows: [], mechanism: 'Outside the code.', product_wide: false };
    const signs = (await sim.runAsync(['raise', note, '--answers', signing, '--fact'], null, JSON.stringify(fact))).raise;
    sim.run(['raise', 'answer', signs, '--didnt-follow']);
    sim.run(['raise', 'answer', signs, '--own'], null, JSON.stringify({ text: 'Team ABCDE12345.', why: 'It is their account.' }));

    // The person deciding unprompted, then changing their mind: Claude put
    // no lean on it, so it is no departure.
    const titled = ledger(['ask', note], { ...made, text: 'Does a note have a title?' });
    const untitled = ledger(['decide', note, '--answers', titled], { by: 'person', text: 'A note has no title.', why: 'Its first line is enough.' });
    const retitled = ledger(['replace', note, '--replaces', untitled, '--reason', 'changed-mind'], { by: 'person', drops: ['no title'], text: 'A note has a title.', why: 'Titles help search.' });
    assert.ok(!sim.run(['verdict', 'queue']).departures.some((/** @type {{id: string}} */ d) => d.id === retitled), 'the person\'s own decision, changed, waits on a verdict');
    const kinds = trustLines(sim).map((line) => JSON.parse(line)).filter(({ type }) => type === 'call' || type === 'raise').map(({ type, kind }) => `${type} ${kind}`);
    assert.deepStrictEqual(kinds, ['call look', 'call look', 'raise behaviour', 'raise behaviour', 'raise behaviour', 'call null', 'raise behaviour'], 'the calls and raises carry no labels for the oracle to hold');
  });

  it('the record of the person: a care entry on look added on the care entries\' screens; a look question raised three times, each answered "don\'t care" — Claude\'s lean landing as the builder\'s, its raise marked so — the third cueing the drop, proposed on the proposal screen and dropped on the person\'s yes; a preference proposed and kept, named at the next entry', async () => {
    const wu = 'kumo';
    sim.env = {
      ...sim.env,
      CLAUDE_STUB_ANSWERS: JSON.stringify({ 'The answer: ': 'no-login', 'a note\'s corner': labelAnswers('look'), '': 'no-login' }),
    };
    mappedEpic(sim, wu, ['note-window']);
    startItem(sim.dir, wu, 'discussion', 'note-window');
    const note = `${wu}.discussion.note-window`;

    sim.render(['care'], { expect: 'content' });
    sim.render(answerGate(sim, 'care entries', '--pick', 'n').next.argv.slice(1), { expect: 'content' });
    const added = sim.run(answerGate(sim, 'care kind', '--pick', '4').next.argv);
    sim.render(added.next.argv.slice(1), { expect: 'content' });

    /** @type {unknown[]} */
    const cues = [];
    for (const text of ['How round is a note\'s corner?', 'How thick is a note\'s corner?', 'How dark is a note\'s corner?']) {
      const question = sim.run(['ledger', 'ask', note], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text })).id;
      const { raise } = await sim.runAsync(['raise', note, '--answers', question], null, JSON.stringify({ ...leaningCall('Round.', 'Square.'), question: text }));
      cues.push(sim.run(['raise', 'answer', raise, '--dont-care']).care_drop ?? null);
    }
    assert.deepStrictEqual(cues, [null, null, { care: added.kept, kind: 'look', dont_cares: 3 }]);

    sim.run(['person', 'propose', '--drop'], null, JSON.stringify({ care: 'look', why: 'Your look questions here keep coming back "don\'t care".', examples: ['The corner\'s radius — don\'t care'] }));
    sim.run(answerGate(sim, 'record drop', '--pick', 'y').next.argv);
    sim.render(['care', '--dropped', 'look'], { expect: 'content' });
    sim.run(['person', 'propose'], null, JSON.stringify({ preference: 'Show the product first', why: 'People see what it does before it asks.', examples: ['The tour comes before the licence'] }));
    sim.run(answerGate(sim, 'record proposal', '--pick', 'y').next.argv);
    sim.run(['enter', 'discussion', wu, 'note-window']);
    assert.ok(sim.sections.includes(`\nperson: ${path.join(sim.configDir, 'person.md')}\n`), 'the entry names no record of the person');
  });
});
