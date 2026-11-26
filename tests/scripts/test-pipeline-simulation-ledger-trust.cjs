'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's trust-log scenarios: Claude's calls, the
// person's answers to them through the ledger verbs, the verdicts and the
// raises, each landing a line of the trust log where it is a departure, each
// question labelled by the stub armed for the labeller (labels.cjs), and the
// person's own words read by it as the reader; the record of the person —
// a care entry added on its screens, the "don't care" answers that cue its
// drop, the drop and a preference kept on the proposal screen; convergence
// — the run of answers cueing the offer, the person's yes, and the rest of
// the topic settled under the rule, one point Claude's and the rest asked
// one raise at a time; a quiet kind's calls proceeding — a discussion
// review's finding of intent and the spec review's contradiction, each
// settled as Claude's call where the rule lets it, the question's id
// pinned so no blind question is drawn; and the matrix —
// the threshold and its raise mid-build each picked from its replay, a
// lower threshold replayed and kept from, and the person's corrections of
// a kind and a verdict in words.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { startItem } = require('./engine-harness.cjs');
const { Sim, mappedEpic, answerGate, startPick, startUnit, handoff, enterEntry, decideTopic, specEntry, passTakenIn, passSurfaced } = require('./pipeline-world.cjs');
const { trustLines } = require('./pipeline-oracle.cjs');
const { leaningCall } = require('./ledger-world.cjs');
const { labelAnswers } = require('./labels.cjs');
const { DAY, idOf, lines, history } = require('./trust-world.cjs');
const { undrawn } = require('./raise-world.cjs');

const DOMAIN = path.join(__dirname, '../../skills/ledger-engine/scripts/domain');
const { TRUST_LOG } = require(path.join(DOMAIN, 'trust-log.cjs'));

/**
 * The trust log of `sim` holding the person's answers on behaviour in
 * another project of theirs, thirty taking Claude's lean, so three clean
 * answers in this one make the kind quiet here (16.S47).
 * @param {Sim} sim
 */
function trustedElsewhere(sim) {
  const elsewhere = history({ project: idOf('Aircon'), start: Date.now() - DAY });
  elsewhere.agree(30, 'behaviour');
  fs.mkdirSync(sim.configDir, { recursive: true });
  fs.appendFileSync(path.join(sim.configDir, TRUST_LOG), lines(...elsewhere.events));
}

describe('pipeline simulation: the trust log', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('the trust log: Claude\'s call, the person\'s reversal of it, the verdicts on that departure — skipped on the decided screen, a real loss from the verdict page the start menu\'s row opens (16.S37) — Claude\'s call replacing it on the person\'s word, the person\'s answers to Claude\'s lean through a raise, one taking it, one standing over it and one in their own words read as it, owed no verdict, and their keep of a call Claude proposed to replace, each land as a line of the trust log in the command that writes it; the person\'s own decision, changed, lands none, nor does their answer to a fact or their not following one; then the matrix, opened from manage (16.S49), the threshold and its raise mid-build each picked from its replay, a lower one replayed and kept from, and the person\'s corrections of a call\'s kind and of the verdict they gave', async () => {
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
    sim.render(['verdicts', '--unit', wu], { expect: 'content' });
    startPick(sim, 'e');
    const given = answerGate(sim, 'verdicts', '--pick', 'l').next;
    assert.deepStrictEqual(sim.run(given.argv).next, { kind: 'engine', argv: ['render', 'start-menu'] }, '16.S37: the verdict given from the start menu\'s row, the last waiting, goes back to the start menu');
    sim.render(['verdicts'], { expect: 'empty' });
    ledger(['replace', note, '--replaces', reversal, '--reason', 'changed-mind'], { ...made, given: 'your-call', drops: ['a document window'], text: 'A floating panel after all.', why: 'It follows the person.' });

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
    const stacked = (await sim.runAsync(['raise', note, '--answers', stacking], null, JSON.stringify({ ...leaningCall('It stays put.', 'It floats.'), lean: 'other' }))).raise;
    sim.run(['raise', 'answer', stacked, '--own'], null, JSON.stringify({ text: 'Keep it floating over the rest.', why: 'The person said why.' }));
    assert.ok(!sim.run(['verdict', 'queue']).departures.some((/** @type {{id: string}} */ d) => stacked.startsWith(d.id)), 'own words read as the lean wait on a verdict');

    // Claude proposing to change an earlier call of its own, and the person
    // keeping it as it stands: a keep at the raise's id, its raise event
    // naming it.
    const snapping = ledger(['ask', note], { ...made, text: 'Does a note snap to the grid?' });
    const snaps = ledger(['decide', note, '--answers', snapping], { ...made, text: 'Notes snap to the grid.', why: 'Tidy desks.' });
    const proposed = await sim.runAsync(['raise', note, '--replaces', snaps, '--reason', 'changed-mind'], null, JSON.stringify(leaningCall('Notes float free.', 'Notes snap to a coarse grid.')));
    sim.run(['raise', 'answer', proposed.raise, '--pick', 'keep'], null, JSON.stringify({ why: 'The person likes the grid.' }));

    // A fact only the person holds, raised with Claude's lean on its rows:
    // the person's own words land as their decision, and nothing reaches the
    // trust log, their "I don't follow" included.
    const signing = ledger(['ask', note], { ...made, text: 'Which team signs the beta?' });
    const teams = [{ key: 'own', name: 'Own team', text: 'The person\'s own team signs it.', notice: 'the beta ships under their name' }, { key: 'company', name: 'Company', text: 'The company team signs it.', notice: 'the beta ships under the company' }];
    const fact = { question: 'Which team signs the beta?', rows: teams, lean: 'company', why: 'A beta goes out under the company.', mechanism: 'Outside the code.', product_wide: false };
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

    startPick(sim, 'm');
    const matrix = answerGate(sim, 'manage', '--pick', 'm').next;
    assert.deepStrictEqual(matrix, { kind: 'engine', argv: ['render', 'matrix'] }, '16.S49: manage\'s m opens the matrix');
    sim.render(matrix.argv.slice(1), { expect: 'content' });
    /** The matrix's row `key` picked, carrying on for the person to name a number, whose replay comes first. @param {string} key @param {string[]} setting */
    const replayed = (key, setting) => {
      assert.deepStrictEqual(answerGate(sim, 'matrix', '--pick', key).next, { kind: 'continue' }, `the matrix's ${key} carries on for a number`);
      sim.render(['matrix-replay', ...setting], { expect: 'content' });
    };
    for (const [key, setting] of /** @type {[string, string[]][]} */ ([['t', ['--threshold', '25']], ['u', ['--build', '30']]])) {
      replayed(key, setting);
      const { next } = sim.run(answerGate(sim, 'matrix replay', '--pick', 'y').next.argv);
      assert.deepStrictEqual(next, matrix, 'the setting set, the matrix is drawn again');
      sim.render(next.argv.slice(1), { expect: 'content' });
    }
    replayed('t', ['--threshold', '15']);
    assert.deepStrictEqual(answerGate(sim, 'matrix replay', '--pick', 'n').next, { kind: 'engine', argv: ['render', 'matrix'] });
    sim.run(['trust', 'correct', call, '--kind', 'behaviour']);
    sim.run(['trust', 'correct', reversal, '--verdict', 'fix']);
    sim.render(['matrix'], { expect: 'content' });
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

  it('convergence: eight of the person\'s answers in a row taking Claude\'s lean on a topic with questions open, the eighth cueing the offer, a quick yes to a point from before before them counting for nothing; the offer drawn, its forecast the rule\'s, and accepted, its yes in the trust log; the last three of the run on behaviour, which the person\'s other projects trust, so it goes quiet here; then each open question raised as any call under the rule — a behaviour point settled as Claude\'s call and standing on the map and in the ledger, a danger point, a contract point and a behaviour point from before each coming to the person in a raise of its own (16.S25, 16.S29, 9.S45)', async (t) => {
    const wu = 'sora';
    const FLOAT = 'Does a note float over the rest?';
    const BIN = 'Does deleting a note skip the bin?';
    const SYNC = 'Does a note sync before it is saved?';
    const EXPIRES = 'Does a note expire after a year?';
    sim.env = {
      ...sim.env,
      CLAUDE_STUB_ANSWERS: JSON.stringify({
        [FLOAT]: labelAnswers('behaviour'),
        [BIN]: labelAnswers('danger'),
        [SYNC]: labelAnswers('contract'),
        [EXPIRES]: labelAnswers('behaviour'),
        ...Object.fromEntries([6, 7, 8].map((n) => [`Settled point ${n}`, labelAnswers('behaviour')])),
        'Settled point': labelAnswers('words'),
        '': 'no-login',
      }),
    };
    trustedElsewhere(sim);
    mappedEpic(sim, wu, ['note-window']);
    startItem(sim.dir, wu, 'discussion', 'note-window');
    const note = `${wu}.discussion.note-window`;
    /** Claude's question `text`, asked, a point from before where `fromBefore` names its id: its short id. @param {string} text @param {string|null} [fromBefore] */
    const ask = (text, fromBefore = null) => sim.run(['ledger', 'ask', note], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text, from_before: fromBefore })).id;
    /** Claude's lean on `question`, worded `text`, raised: the raise's answer. @param {string} question @param {string} text */
    const raise = (question, text) => sim.runAsync(['raise', note, '--answers', question], null, JSON.stringify({ ...leaningCall('It floats.', 'It stays put.'), question: text }));
    /** The person's pick of the lean on the raise `id`: the answer. @param {string} id */
    const lean = (id) => sim.run(['raise', 'answer', id, '--pick', '1'], null, JSON.stringify({ why: 'The person said why.' }));
    const open = { float: ask(FLOAT), bin: ask(BIN), sync: ask(SYNC), expires: ask(EXPIRES, 'D12') };
    const before = 'Does a note keep its colour? (from before)';

    /** @type {unknown[]} */
    const cues = [lean((await raise(ask(before, 'D3'), before)).raise).convergence ?? null];
    for (let n = 1; n <= 8; n += 1) {
      const text = `Settled point ${n}: does a note snap to the grid?`;
      cues.push(lean((await raise(ask(text), text)).raise).convergence ?? null);
    }
    assert.deepStrictEqual(cues, [...Array(8).fill(null), { unit: wu, topic: 'note-window', agreements: 8 }]);

    const offered = sim.render(['convergence', `${wu}.note-window`], { expect: 'content' });
    assert.ok(offered.includes('\n4 open: I\'d settle 1; 3 come to you — 1 danger, 1 contract, 1 behaviour.\n'), `the forecast is not the rule's:\n${offered}`);
    sim.run(answerGate(sim, 'convergence offer', '--pick', 'y').next.argv);
    assert.deepStrictEqual(trustLines(sim).map((line) => JSON.parse(line)).filter(({ type }) => type === 'convergence').map(({ unit, topic }) => `${unit}.${topic}`), [`${wu}.note-window`]);

    undrawn(t);
    const settled = await raise(open.float, FLOAT);
    const danger = await raise(open.bin, BIN);
    lean(danger.raise);
    const synced = await raise(open.sync, SYNC);
    lean(synced.raise);
    const expires = await raise(open.expires, EXPIRES);
    lean(expires.raise);
    assert.deepStrictEqual([settled.decision, danger.decision, synced.decision, expires.decision], ['proceed', 'ask', 'ask', 'ask']);
    assert.deepStrictEqual(sim.run(['ledger', 'since', wu, 'note-window']).calls.map((/** @type {{id: string}} */ { id }) => id), [settled.id]);
    assert.match(sim.render(['map', `${wu}.note-window`], { expect: 'content' }), /^SINCE YOU LAST LOOKED \(1 call by Claude\)\n.*Does a note float over the rest\?/m);
  });

  it('a quiet kind proceeding: behaviour quiet in the project — trusted in the person\'s other projects, and three answers here taking Claude\'s lean — a background review\'s finding of intent raised in the discussion lands as Claude\'s call, never drawn — in the ledger and on the map since the person last looked; and the spec review\'s finding of two decisions contradicting each other, raised at the unit\'s level, is settled there as Claude\'s, with no topic, the person not asked (16.S5, 9.S24, 11.S10)', async (t) => {
    const wu = 'yuki';
    const KEEPS = 'Does a note keep its place?';
    const CLASH = 'Which holds when a note is both pinned and archived?';
    sim.env = { ...sim.env, CLAUDE_STUB_ANSWERS: JSON.stringify({ [KEEPS]: labelAnswers('behaviour'), [CLASH]: labelAnswers('behaviour'), 'Agreed point': labelAnswers('behaviour'), '': 'no-login' }) };
    trustedElsewhere(sim);
    undrawn(t);
    startUnit(sim, 'feature', wu, 'Notes that stay put');
    handoff(sim, `/ledger-discussion-process feature ${wu}`);
    enterEntry(sim, wu, 'discussion', wu);
    const at = `${wu}.discussion.${wu}`;
    for (const n of [1, 2, 3]) {
      const text = `Agreed point ${n}: does a note keep its size?`;
      const asked = sim.run(['ledger', 'ask', at], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text })).id;
      const { raise } = await sim.runAsync(['raise', at, '--answers', asked], null, JSON.stringify({ ...leaningCall('It keeps it.', 'It resets.'), question: text }));
      sim.run(['raise', 'answer', raise, '--pick', '1'], null, JSON.stringify({ why: 'The person said why.' }));
    }
    const review = sim.run(['agent', 'dispatch', wu, 'discussion', wu, '--kind', 'review']);
    sim.write(review.file, '# Review findings\n\n## F1\n\nWhether a note keeps its place after a restart is left open.\n');
    sim.run(['agent', 'scan', wu, 'discussion', wu]);
    sim.run(['agent', 'ack', wu, 'discussion', wu, review.id, '--findings', 'F1']);
    const finding = sim.run(['ledger', 'ask', at], null, JSON.stringify({ by: 'review', who_moved_whom: 'none', text: KEEPS })).id;
    sim.run(['agent', 'surface', wu, 'discussion', wu, review.id, 'F1']);

    const kept = await sim.runAsync(['raise', at, '--answers', finding], null, JSON.stringify({ ...leaningCall('It keeps its place.', 'It opens centred.'), question: KEEPS }));

    assert.deepStrictEqual([kept.decision, kept.raise], ['proceed', undefined]);
    assert.deepStrictEqual(sim.run(['ledger', 'since', wu, wu]).calls.map((/** @type {{id: string}} */ { id }) => id), [kept.id]);
    assert.match(sim.render(['map', `${wu}.${wu}`], { expect: 'content' }), /^SINCE YOU LAST LOOKED \(1 call by Claude\)\n.*Does a note keep its place\?/m);
    sim.write(`.ledger/${wu}/topics/${wu}/log.md`, `# ${wu}\n\n${KEEPS} It keeps its place.\n`);
    const { next } = decideTopic(sim, wu, wu);
    handoff(sim, [`/${next.skill}`, ...next.args].join(' '));
    specEntry(sim, wu, [wu]);
    const decision = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions.find((/** @type {{id: string}} */ { id }) => id === kept.id);
    sim.run(['brief', 'spec-writer', wu]);
    sim.write(`.ledger/${wu}/spec.md`, [
      '# Yuki', '', '## 1. Placing', '', '### 1.1 After a restart', '', `1.1.1 A note keeps its place after a restart. [${decision.id}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given a note, when the app restarts, then the note is where it was. (1.1.1)', '',
    ].join('\n'));
    sim.run(['spec', 'land', wu]);
    const gap = /** @type {const} */ ([{ lane: 'gap' }]);
    const pass = passTakenIn(sim, wu, [...gap]);
    const clash = sim.run(['ledger', 'ask', `${wu}.specification`], null, JSON.stringify({ by: 'review', who_moved_whom: 'none', text: CLASH })).id;

    const settled = await sim.runAsync(['raise', `${wu}.specification`, '--answers', clash], null, JSON.stringify({ ...leaningCall('Pinned holds.', 'Archived holds.'), question: CLASH }));
    passSurfaced(sim, wu, pass, [...gap], { 0: clash });

    const entry = fs.readFileSync(path.join(sim.dir, '.ledger/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).find(({ id }) => id.startsWith(settled.id));
    assert.deepStrictEqual([settled.decision, settled.raise, entry.event, entry.by, entry.unit, entry.phase, entry.topic], ['proceed', undefined, 'decided', 'claude', wu, 'specification', null]);
  });
});
