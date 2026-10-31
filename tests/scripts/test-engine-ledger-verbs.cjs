'use strict';

// ---------------------------------------------------------------------------
// The ledger's write verbs (leeway-engine/scripts/domain/ledger-write.cjs),
// each verb's line and its refusals, and the fold they read the ledger
// through (domain/ledger-fold.cjs): `engine ledger ask|find|decide|replace|
// hold|move|merge`, each appending one event written field by field; a
// decision naming no question, a reason outside the four, a replacement of an
// entry already replaced, a move or a merge of anything but a question, a
// write on a topic set aside or a unit cancelled, and a move to a topic the
// unit does not have each refused, appending nothing; Claude's own close of a
// question its experiment still measures refused. The tags, links, lock and
// commit around every write are test-engine-ledger-write.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, statePath, stateRelative, layout, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ID_FACTS, foldLedger } = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));

const { UNIT, MADE, NOTE, SPACE, WRITE_PHASES, AT_NOTE, ledgerWriteHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-verbs-', WRITE_PHASES);
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, rawLines, entries, full, assertLast, assertAnswered, refused, ask, find, decide, change, oneOfEach } = ledgerWriteHelpers(() => dir);

describe('the write verbs (6.1.4)', () => {
  it('ask: a question on a topic\'s map, part of another and relying on what it names, the line written field by field', () => {
    const parent = ask().id;
    const finding = find().id;

    const res = write('ask', NOTE, ['--part-of', parent, '--relies-on', finding], { by: 'person', who_moved_whom: 'none', text: 'Does a note snap to the grid?' });

    const id = assertLast('asked', AT_NOTE, {
      by: 'person', who_moved_whom: 'none', text: 'Does a note snap to the grid?', part_of: full(parent), relies_on: [full(finding)], cites: [],
    });
    assertAnswered(res, id);
  });

  it('find: a fact and how it is known, product-wide where marked, the line written field by field', () => {
    const res = write('find', NOTE, [], { by: 'claude', who_moved_whom: 'none', text: 'CKSyncEngine ships from macOS 14.', how: 'Apple\'s documentation', known: 'documented', product_wide: true });

    const id = assertLast('found', AT_NOTE, {
      by: 'claude', who_moved_whom: 'none', text: 'CKSyncEngine ships from macOS 14.', how: 'Apple\'s documentation', relies_on: [], product_wide: true,
      known: 'documented', command: null, result: null, cites: [],
    });
    assertAnswered(res, id);
  });

  it('decide (5.S1): one line carrying its id, version, tags, time, who, why, what it rules out and relies on, and the link to the question it closes; the response shows its short id; the project holds this one ledger', () => {
    const question = ask().id;
    const finding = find().id;

    const res = write('decide', NOTE, ['--answers', question, '--relies-on', finding], {
      by: 'person', who_moved_whom: 'none', text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.',
      rules_out: ['a title bar', 'a dock icon'], kind: 'look',
    });

    const id = assertLast('decided', AT_NOTE, {
      by: 'person', who_moved_whom: 'none', answers: full(question), text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.',
      rules_out: ['a title bar', 'a dock icon'], relies_on: [full(finding)], product_wide: false, sealed: null, alternatives: [], evidence: [], kind: 'look', unchecked: true,
      given: 'own', cites: [],
    });
    assertAnswered(res, id);
    assert.strictEqual(entries().length, 3, 'one line appended per write');

    /** @param {string} at @returns {string[]} */
    const files = (at) => fs.readdirSync(at, { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(at, e.name);
      if (e.isDirectory()) return files(rel);
      return [stateRelative(dir, rel)];
    });
    assert.deepStrictEqual(files(statePath(dir)).filter((file) => /ledger/i.test(file)), [layout.ledger], 'the project has one ledger, and no other per unit or elsewhere');
  });

  it('decide: Claude\'s own call with its alternatives and evidence, the content it leaves out taking its defaults', () => {
    const question = ask().id;

    write('decide', NOTE, ['--answers', question], {
      ...MADE, text: 'Notes float above every Space.', why: 'A note follows the person.', alternatives: ['one Space per note'], evidence: ['the spike'],
    });

    assertLast('decided', AT_NOTE, {
      ...MADE, answers: full(question), text: 'Notes float above every Space.', why: 'A note follows the person.',
      rules_out: [], relies_on: [], product_wide: false, sealed: null, alternatives: ['one Space per note'], evidence: ['the spike'], kind: null, unchecked: true,
      given: 'own', cites: [],
    });
  });

  it('replace (5.S8): a new answer naming the old and its reason, in the shape of a decision answering the old one\'s question, the old line byte for byte unchanged', () => {
    const question = ask().id;
    const old = decide(question).id;
    const before = rawLines();

    const res = write('replace', NOTE, ['--replaces', old, '--reason', 'changed-mind'], {
      by: 'person', who_moved_whom: 'person-moved-claude', drops: ['a near-frameless window'], text: 'A frameless surface.', why: 'Lighter on the desk.', rules_out: ['a border'],
    });

    const id = assertLast('replaced', AT_NOTE, {
      by: 'person', who_moved_whom: 'person-moved-claude', replaces: full(old), reason: 'changed-mind', cause: null, drops: ['a near-frameless window'], of: 'decision',
      answers: full(question), text: 'A frameless surface.', why: 'Lighter on the desk.', rules_out: ['a border'], relies_on: [],
      product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null, unchecked: true, given: 'own', cites: [],
    });
    assertAnswered(res, id);
    assert.deepStrictEqual(rawLines().slice(0, -1), before);
  });

  it('replace: a question reworded stays part of the question the old one was, and a finding keeps a finding\'s shape', () => {
    const parent = ask('Where does a note live?').id;
    const child = write('ask', NOTE, ['--part-of', parent], { ...MADE, text: 'Which Space does a new note open on?' }).id;
    const finding = find().id;

    write('replace', NOTE, ['--replaces', child, '--reason', 'new-fact', '--cause', finding], { ...MADE, drops: ['Spaces'], text: 'Which display does a new note open on?' });
    assertLast('replaced', AT_NOTE, {
      ...MADE, replaces: full(child), reason: 'new-fact', cause: full(finding), drops: ['Spaces'], of: 'question',
      text: 'Which display does a new note open on?', part_of: full(parent), relies_on: [], cites: [],
    });

    write('replace', NOTE, ['--replaces', finding, '--reason', 'was-wrong', '--relies-on', parent], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike', known: 'spike' });
    assertLast('replaced', AT_NOTE, {
      ...MADE, replaces: full(finding), reason: 'was-wrong', cause: null, drops: ['across restarts'], of: 'finding',
      text: 'Spaces keep their ids within a login.', how: 'a second spike', relies_on: [full(parent)], product_wide: false, known: 'spike', command: null, result: null, cites: [],
    });
  });

  it('hold: a topic confirms an entry still holds after a replacement of what it relied on, the line written field by field', () => {
    const old = decide(ask().id).id;
    const finding = find(['--relies-on', old]).id;
    const replacement = change(old).id;

    const res = write('hold', NOTE, ['--entry', finding, '--after', replacement], { by: 'person', who_moved_whom: 'person-moved-claude' });

    const id = assertLast('still-holds', AT_NOTE, { by: 'person', who_moved_whom: 'person-moved-claude', entry: full(finding), after: full(replacement) });
    assertAnswered(res, id);
  });

  it('move: a question moved to another topic of the unit, the line written field by field', () => {
    const question = ask().id;

    const res = write('move', NOTE, ['--question', question, '--to', 'menu-bar'], MADE);

    const id = assertLast('moved', AT_NOTE, { ...MADE, question: full(question), to: 'menu-bar' });
    assertAnswered(res, id);
  });

  it('merge (5.5.5): a duplicate merged where it is found into the owner\'s entry, naming the duplicate where one landed, the line written field by field', () => {
    const owners = ask().id;
    const owned = decide(owners).id;
    const here = write('ask', SPACE, [], { ...MADE, text: 'Is a note a window?' }).id;
    const duplicate = write('decide', SPACE, ['--answers', here], { ...MADE, text: 'A near-frameless floating note.', why: 'The same call.' }).id;
    const atSpace = { phase: 'discussion', topic: 'space-homing' };

    write('merge', SPACE, ['--question', here, '--into', owned], MADE);
    assertLast('merged', atSpace, { ...MADE, question: full(here), into: full(owned), duplicate: null });

    const res = write('merge', SPACE, ['--question', here, '--into', owned, '--duplicate', duplicate], MADE);
    const id = assertLast('merged', atSpace, { ...MADE, question: full(here), into: full(owned), duplicate: full(duplicate) });
    assertAnswered(res, id);
    assert.strictEqual(entries().find((e) => e.id === full(owned)).text, 'A near-frameless floating note.', 'the owner\'s entry stands as it was');
  });
});

describe('refusals', () => {
  it('refuses a decision naming no question (5.S3), or naming an entry that is no question (5.5.1)', () => {
    const question = ask().id;
    const finding = find().id;
    const decision = decide(question).id;
    const content = { ...MADE, text: 'Floating.', why: 'Furniture.' };

    refused('decide', NOTE, [], content, /^ledger decide needs --answers <id> — Usage: /);
    refused('decide', NOTE, ['--answers', finding], content, new RegExp(`^ledger decide --answers names ${finding}, a finding — it must name a question$`));
    refused('decide', NOTE, ['--answers', decision], content, new RegExp(`^ledger decide --answers names ${decision}, a decision — it must name a question$`));
  });

  it('refuses a reason outside the four (5.6.2)', () => {
    const question = ask().id;
    const decision = decide(question).id;
    refused('replace', NOTE, ['--replaces', decision, '--reason', 'a-whim'], { ...MADE, drops: [], text: 'Framed.', why: 'Why not.' },
      /^ledger replace: --reason is one of new-fact, other-topic, changed-mind, was-wrong — not "a-whim"$/);
    refused('replace', NOTE, ['--replaces', decision], { ...MADE, drops: [], text: 'Framed.', why: 'Why not.' }, /^ledger replace needs --reason <new-fact\|other-topic\|changed-mind\|was-wrong>/);
  });

  it('refuses a replacement of an entry another replacement already names, naming the current one; a sibling answer stays replaceable (5.3.13)', () => {
    const question = ask().id;
    const first = decide(question, { text: 'Floats above every Space.' }).id;
    const sibling = decide(question, { text: 'Its controls appear on hover.' }).id;
    const reworded = (/** @type {string} */ old, /** @type {string} */ text) => change(old, { text, why: 'Clearer.' }).id;
    const replacement = reworded(first, 'Floats above every Space, on every display.');

    refused('replace', NOTE, ['--replaces', first, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Again.', why: 'Again.' },
      new RegExp(`^ledger replace --replaces names ${first}, which ${replacement} replaced — the current one is ${replacement}$`));
    const siblingReplacement = reworded(sibling, 'Its controls appear on hover, and on focus.');
    const current = reworded(replacement, 'Floats above every Space and display.');
    refused('replace', NOTE, ['--replaces', first, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Again.', why: 'Again.' },
      new RegExp(`^ledger replace --replaces names ${first}, which ${replacement} replaced — the current one is ${current}$`));

    const facts = foldLedger(statePath(dir), ID_FACTS, []);
    assert.deepStrictEqual([first, sibling, replacement, siblingReplacement, current].map((id) => facts.get(full(id)).replaced_by), [
      [full(replacement)], [full(siblingReplacement)], [full(current)], [], [],
    ]);
    assert.deepStrictEqual([current, siblingReplacement].map((id) => entries().find((e) => e.id === full(id)).answers), [full(question), full(question)]);
  });

  it('refuses a move or a merge of anything but a question', () => {
    const { f, d, r } = oneOfEach();
    refused('move', NOTE, ['--question', d, '--to', 'space-homing'], MADE, new RegExp(`^ledger move --question names ${d}, a decision — it must name a question$`));
    refused('move', NOTE, ['--question', f, '--to', 'space-homing'], MADE, new RegExp(`^ledger move --question names ${f}, a finding — it must name a question$`));
    refused('merge', SPACE, ['--question', r, '--into', r], MADE, new RegExp(`^ledger merge --question names ${r}, a decision — it must name a question$`));
    refused('merge', SPACE, ['--question', f, '--into', r], MADE, new RegExp(`^ledger merge --question names ${f}, a finding — it must name a question$`));
  });

  it('refuses a write on a topic set aside or a unit cancelled, and a move to a topic set aside, by the rule every read decides by (5.8.17)', () => {
    const row = (/** @type {number} */ order) => ({ order, summary: 'A topic', source: 'discovery' });
    createManifest(dir, UNIT, { work_type: 'epic', phases: { ...WRITE_PHASES, discovery: { items: { 'note-window': row(1), 'space-homing': row(2), 'menu-bar': row(3) } } } });
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const question = ask().id;
    const content = { ...MADE, text: 'Does a note open on the active Space?' };

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    refused('ask', SPACE, [], content, /^ledger ask: fumi\.discussion\.space-homing takes no writes — its topic, space-homing, is cancelled$/);
    refused('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE,
      /^ledger move: --to names space-homing, which takes no question — its topic, space-homing, is cancelled$/);
    ok(dir, ['topic', 'postpone', UNIT, 'menu-bar', '--horizon', 'later']);
    refused('move', NOTE, ['--question', question, '--to', 'menu-bar'], MADE, /^ledger move: --to names menu-bar, which takes no question — its topic, menu-bar, is postponed$/);

    ok(dir, ['workunit', 'cancel', 'mint']);
    refused('ask', 'mint.discussion.mint', [], content, /^ledger ask: mint\.discussion\.mint takes no writes — mint is cancelled$/);
    refused('find', 'mint.specification', [], { ...MADE, text: 'Notes sync.', how: 'the brief' }, /^ledger find: mint\.specification takes no writes — mint is cancelled$/);

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    write('ask', SPACE, [], content);
  });

  it('refuses Claude\'s own close of a question an experiment still running measures — a decision, a move or a merge — while the person closes it, their own answer or one handed over, a move or a merge, and once it concludes Claude writes the result (9.1.11)', () => {
    const [timing, placing, sizing, moving, merging, sharing] = ['How fast does a note open?', 'Where does a note open?', 'How big is a note?', 'Does a note follow its space?', 'Can a note be sent?', 'Is a note shared?']
      .map((text) => ask(text).id);
    const shared = decide(sharing).id;
    /** The unit's manifest, its experiments at `status`, measuring `questions`. @param {string} status @param {string[]} questions */
    const measuring = (status, ...questions) => createManifest(dir, UNIT, {
      work_type: 'epic',
      phases: { ...WRITE_PHASES, experiment: { items: { 'note-window': { status: 'in-progress', experiments: Object.fromEntries(questions.map((q, i) => [`E${i + 1}`, { slug: `e${i + 1}`, status, question: full(q) }])) } } } },
    });
    const held = (/** @type {string} */ verb) => new RegExp(`^ledger ${verb}: ${timing} is measured by experiment E1, still running — Claude never closes a question its experiment measures; the person may, and once it ends the discussion writes the result$`);

    measuring('running', timing, placing, sizing, moving, merging);
    refused('decide', NOTE, ['--answers', timing], { ...MADE, text: 'In 4 ms.', why: 'Measured.' }, held('decide'));
    refused('move', NOTE, ['--question', timing, '--to', 'space-homing'], MADE, held('move'));
    refused('merge', NOTE, ['--question', timing, '--into', shared], MADE, held('merge'));
    decide(placing, { by: 'person', given: 'own' });
    decide(sizing, { given: 'your-call' });
    write('move', NOTE, ['--question', moving, '--to', 'space-homing'], { by: 'person', who_moved_whom: 'none' });
    write('merge', NOTE, ['--question', merging, '--into', shared], { by: 'person', who_moved_whom: 'none' });
    measuring('concluded', timing);
    decide(timing, { text: 'In 4 ms.', why: 'E1 measured it.' });
  });

  it('refuses a move to a topic the unit does not have, and a move made at the unit\'s level, from no topic', () => {
    const question = ask().id;
    refused('move', NOTE, ['--question', question, '--to', 'dock-icon'], MADE, /^ledger move: fumi has no topic "dock-icon" to move the question to$/);
    refused('move', NOTE, ['--question', question, '--to', '__proto__'], MADE, /^ledger move: fumi has no topic "__proto__" to move the question to$/);
    refused('move', `${UNIT}.discussion`, ['--question', question, '--to', 'space-homing'], MADE, /^ledger move: a question moves from a topic — name it: fumi\.discussion\.<topic>$/);
    refused('move', `${UNIT}.specification`, ['--question', question, '--to', 'space-homing'], MADE,
      /^ledger move: a question moves from a topic, and specification has none — a topic exists only before the spec$/);
  });
});
