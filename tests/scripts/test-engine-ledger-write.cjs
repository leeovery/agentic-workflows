'use strict';

// ---------------------------------------------------------------------------
// The ledger's write verbs (leeway-engine/scripts/domain/ledger-write.cjs)
// and the fold they read the ledger through (domain/ledger-fold.cjs):
// `engine ledger ask|find|decide|replace|hold|move|merge`, each appending one
// event, tagged with its unit, topic, phase and session, and committing the
// ledger to the state branch; its content as JSON on stdin and its links as
// flags, each naming an entry by a prefix of its id that the engine resolves
// to the full id; every refusal appending nothing and committing nothing;
// the writer lock taken by the verb itself, a refusal it needs no ledger for
// answering while a peer holds it; two processes appending at once; and a
// ledger changed outside the engine stopping the next write, showing the
// line found. What the writes tell the trust log is
// test-engine-ledger-trust.cjs's.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there. A `git` first on PATH
// plays a commit git refuses.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const {
  ENGINE, git, lockAttempts, ok, output, refuses, head, stateGit, statePath, stateRelative, layout, ledgerEntries, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { ID_FACTS, foldLedger } = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { withStateLock, commitState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));

const {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, ID, WRITE_PHASES, AT_NOTE, ledgerWriteHelpers, ledgerWorld,
} = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-write-', WRITE_PHASES);
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ledgerText, rawLines, entries, full, assertLast, assertAnswered, refused, ask, find, decide, change, oneOfEach } = ledgerWriteHelpers(() => dir);

describe('the write verbs (6.1.4)', () => {
  it('ask: a question on a topic\'s map, part of another and relying on what it names, the line written field by field', () => {
    const parent = ask().id;
    const finding = find().id;

    const res = write('ask', NOTE, ['--part-of', parent, '--relies-on', finding], { by: 'person', who_moved_whom: 'none', text: 'Does a note snap to the grid?' });

    const id = assertLast('asked', AT_NOTE, {
      by: 'person', who_moved_whom: 'none', text: 'Does a note snap to the grid?', part_of: full(parent), relies_on: [full(finding)],
    });
    assertAnswered(res, id);
  });

  it('find: a fact and how it is known, product-wide where marked, the line written field by field', () => {
    const res = write('find', NOTE, [], { by: 'claude', who_moved_whom: 'none', text: 'CKSyncEngine ships from macOS 14.', how: 'Apple\'s documentation', product_wide: true });

    const id = assertLast('found', AT_NOTE, {
      by: 'claude', who_moved_whom: 'none', text: 'CKSyncEngine ships from macOS 14.', how: 'Apple\'s documentation', relies_on: [], product_wide: true,
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
      product_wide: false, sealed: null, alternatives: [], evidence: [], kind: null, unchecked: true,
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
      text: 'Which display does a new note open on?', part_of: full(parent), relies_on: [],
    });

    write('replace', NOTE, ['--replaces', finding, '--reason', 'was-wrong', '--relies-on', parent], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike' });
    assertLast('replaced', AT_NOTE, {
      ...MADE, replaces: full(finding), reason: 'was-wrong', cause: null, drops: ['across restarts'], of: 'finding',
      text: 'Spaces keep their ids within a login.', how: 'a second spike', relies_on: [full(parent)], product_wide: false,
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

describe('tags (5.2.3)', () => {
  it('tags an entry made at the unit\'s level with its unit, phase and session, and no topic', () => {
    const res = write('ask', `${UNIT}.specification`, [], { ...MADE, text: 'Which macOS releases does the spec cover?' });

    const id = assertLast('asked', { phase: 'specification', topic: null }, { ...MADE, text: 'Which macOS releases does the spec cover?', part_of: null, relies_on: [] });
    assertAnswered(res, id);
  });

  it('refuses a write with no session id, appending nothing', () => {
    ask();
    refused('ask', NOTE, [], { ...MADE, text: 'Whose session?' }, /^ledger ask: no session to tag the entry with — CLAUDE_CODE_SESSION_ID is not set$/, { CLAUDE_CODE_SESSION_ID: undefined });
    refused('ask', NOTE, [], { ...MADE, text: 'Whose session?' }, /no session to tag the entry with/, { CLAUDE_CODE_SESSION_ID: '' });
  });

  it('names where a write is made in the engine\'s dot-path, refusing a unit that does not exist, a topic with no item in the phase, a phase that is none, and a path of another shape', () => {
    const content = { ...MADE, text: 'Where?' };
    refused('ask', 'mint.discussion.note-window', [], content, /^ledger ask: there is no work unit "mint"$/);
    refused('ask', `${UNIT}.discussion.menu-bar`, [], content, /^ledger ask: fumi has no topic "menu-bar" in discussion$/);
    refused('ask', `${UNIT}.research.note-window`, [], content, /^ledger ask: fumi has no topic "note-window" in research$/);
    refused('ask', `${UNIT}.discussion.__proto__`, [], content, /^ledger ask: fumi has no topic "__proto__" in discussion$/);
    refused('ask', `${UNIT}.talk.note-window`, [], content, /^ledger ask: "talk" is no phase — one of discovery, research, /);
    for (const address of [UNIT, `${UNIT}.discussion.note-window.x`, `${UNIT}..note-window`, `.discussion`]) {
      refused('ask', address, [], content, /names no place to write — <work-unit>\.<phase>\.<topic>, or <work-unit>\.<phase> at the unit's level$/);
    }
  });

  it('takes a phase the unit\'s work type has, or discovery, refusing another (4.11.2)', () => {
    createManifest(dir, 'mend', { work_type: 'bugfix', phases: { investigation: { items: { mend: { status: 'in-progress' } } } } });
    const content = { ...MADE, text: 'Which phase?' };

    for (const address of [`${UNIT}.investigation`, `${UNIT}.investigation.note-window`, `${UNIT}.scoping`]) {
      refused('ask', address, [], content,
        /^ledger ask: fumi has no (investigation|scoping) phase — its work type, epic, has discovery, research, experiment, discussion, specification, planning, implementation, review$/);
    }
    refused('ask', 'mend.discussion.mend', [], content, /^ledger ask: mend has no discussion phase — its work type, bugfix, has discovery, investigation, specification, planning, implementation, review$/);

    write('ask', 'mend.investigation.mend', [], content);
    assert.deepStrictEqual([entries().at(-1).unit, entries().at(-1).phase, entries().at(-1).topic], ['mend', 'investigation', 'mend']);
    write('ask', `${UNIT}.discovery.menu-bar`, [], content);
    write('ask', `${UNIT}.discovery`, [], content);
    assert.deepStrictEqual(entries().slice(-2).map((e) => [e.phase, e.topic]), [['discovery', 'menu-bar'], ['discovery', null]]);
  });

  it('refuses a topic from the spec on, where everything is the unit\'s (4.11.2, 5.2.3)', () => {
    createManifest(dir, UNIT, {
      work_type: 'epic',
      phases: {
        discussion: { items: { 'note-window': { status: 'completed' } } },
        specification: { items: { 'note-window': { status: 'in-progress' } } },
        review: { items: { 'note-window': { status: 'in-progress' } } },
      },
    });
    for (const phase of ['specification', 'review']) {
      refused('ask', `${UNIT}.${phase}.note-window`, [], { ...MADE, text: 'Which topic?' },
        new RegExp(`^ledger ask: a topic exists only before the spec, and ${phase} is the unit's — write at fumi\\.${phase}$`));
    }
  });
});

describe('content and links', () => {
  it('takes the content as one JSON object on stdin: refuses none, another value, a link, what the engine gives, a field the event does not hold, a field it needs left out, and a field of the wrong type', () => {
    const question = ask().id;
    const flags = ['--answers', question];
    const decision = { ...MADE, text: 'Floating.', why: 'Furniture.' };
    refused('decide', NOTE, flags, '', /^ledger decide: the entry's content comes on stdin as a JSON object, and stdin holds no JSON — /);
    refused('decide', NOTE, flags, '{"by":', /stdin holds no JSON/);
    refused('decide', NOTE, flags, '["Floating."]', /comes on stdin as a JSON object, not \["Floating\."\]$/);
    refused('decide', NOTE, flags, { ...decision, answers: question }, /^ledger decide: the content carries answers, a link — a link is given as a flag \(--answers\), never in the content$/);
    refused('decide', NOTE, flags, { ...decision, relies_on: [] }, /the content carries relies_on, a link — a link is given as a flag \(--relies-on\)/);
    refused('ask', NOTE, [], { ...MADE, text: 'Q?', replaces: question }, /^ledger ask: the content carries replaces, a link — a link is given as a flag, never in the content$/);
    for (const assigned of ['v', 'id', 'event', 'unit', 'topic', 'phase', 'session', 'at', 'of', 'unchecked']) {
      refused('decide', NOTE, flags, { ...decision, [assigned]: 'mine' }, new RegExp(`^ledger decide: the content carries ${assigned}, which the engine gives$`));
    }
    refused('decide', NOTE, flags, { ...decision, how: 'documented' }, /^ledger decide: the content has no field how — it holds by, who_moved_whom, text, why, rules_out, product_wide, sealed, alternatives, evidence, kind$/);
    refused('decide', NOTE, flags, { by: 'claude', who_moved_whom: 'none', text: 'Floating.' }, /^ledger decide: the content needs why$/);
    refused('decide', NOTE, flags, { who_moved_whom: 'none', text: 'Floating.', why: 'Furniture.' }, /^ledger decide: the content needs by$/);
    refused('find', NOTE, [], { ...MADE, text: 'A fact.' }, /^ledger find: the content needs how$/);
    refused('replace', NOTE, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, text: 'Q?' }, /^ledger replace: the content needs drops$/);
    refused('decide', NOTE, flags, { ...decision, rules_out: 'a title bar' }, /^ledger decide: the content's rules_out is not a list of non-empty text$/);
    refused('decide', NOTE, flags, { ...decision, by: 'review' }, /^ledger decide: the content's by is not one of person, claude$/);
    refused('decide', NOTE, flags, { ...decision, kind: 'mood' }, /the content's kind is not one of process, danger, contract, scope, look, words, behaviour, internals, or null$/);
    refused('replace', NOTE, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: [], text: 'Q?', why: 'A question has no why.' }, /^ledger replace: the content has no field why — it holds by, who_moved_whom, drops, text$/);
  });

  it('takes the links as flags: refuses a flag the verb does not take, one with no value, one given twice that takes one, a required one left out, and anything but one dot-path', () => {
    const question = ask().id;
    const content = { ...MADE, text: 'Q?' };
    refused('ask', NOTE, ['--answers', question], content, /^ledger ask takes no --answers — Usage: engine ledger ask <work-unit>\.<phase>\[\.<topic>\] \[--part-of <id>\] \[--relies-on <id> …\]/);
    refused('ask', NOTE, ['--part-of'], content, /^ledger ask: --part-of takes <id> — Usage: /);
    refused('ask', NOTE, ['--part-of', '--relies-on', question], content, /^ledger ask: --part-of takes <id>/);
    refused('ask', NOTE, ['--part-of', question, '--part-of', question], content, /^ledger ask takes one --part-of — Usage: /);
    refused('hold', NOTE, ['--entry', question], {}, /^ledger hold needs --after <id> — Usage: engine ledger hold <work-unit>\.<phase>\[\.<topic>\] --entry <id> --after <id>/);
    refuses(dir, ['ledger', 'ask'], { env: SESSION, stdin: JSON.stringify(content) });
    refused('ask', NOTE, [SPACE], content, /^Usage: engine ledger ask /);
    assert.match(refuses(dir, ['ledger', 'note'], { env: SESSION }).error, /^Usage: engine ledger <ask\|find\|decide\|replace\|hold\|move\|merge\|record\|map\|product\|affected\|since\|shown\|late-check> …\nledger ask [^]*\nledger record [^]*\nledger shown [^]*\nledger late-check /);
  });

  it('resolves each link from any prefix of four characters or more to the full id, and shows an id by its shortest prefix no other id shares', () => {
    const question = ask();
    assert.strictEqual(question.id.length, 6);
    const finding = find().id;
    const id = full(question.id);

    decide(id.slice(0, 4), {});
    assert.strictEqual(entries().at(-1).answers, id);
    write('decide', NOTE, ['--answers', id, '--relies-on', finding.slice(0, 5), '--relies-on', full(finding)], { ...MADE, text: 'Floating.', why: 'Furniture.' });
    assert.deepStrictEqual([entries().at(-1).answers, entries().at(-1).relies_on], [id, [full(finding)]], 'two prefixes of one id name it once');
  });

  it('refuses a link the ledger\'s ids do not resolve, naming the verb and the flag, and names an entry it refuses by its short form', () => {
    const twin = 'Tw1nTw1n';
    const [a, b] = [`${twin}a${newId().slice(0, 12)}`, `${twin}b${newId().slice(0, 12)}`];
    const lines = [a, b].map((id) => JSON.stringify(validEvent({
      v: 1, id, event: 'found', unit: UNIT, topic: 'note-window', phase: 'discussion', session: SESSION_ID, at: '2026-10-27T09:00:00Z',
      ...MADE, text: `Found ${id}.`, how: 'by hand', relies_on: [], product_wide: false,
    })));
    fs.writeFileSync(statePath(dir, layout.ledger), `${lines.join('\n')}\n`);
    withStateLock(statePath(dir), () => commitState(statePath(dir), [layout.ledger], 'state: two findings'));
    const content = { ...MADE, text: 'Floating.', why: 'Furniture.' };

    refused('decide', NOTE, ['--answers', 'Zz9Zz9'], content, /^ledger decide --answers: no ledger entry's id begins "Zz9Zz9"$/);
    refused('decide', NOTE, ['--answers', `${twin}a`], content, /^ledger decide --answers names Tw1nTw1na, a finding — it must name a question$/);
    refused('find', NOTE, ['--relies-on', a, '--relies-on', 'Zz9Zz9'], { ...MADE, text: 'A fact.', how: 'by hand' }, /^ledger find --relies-on: no ledger entry's id begins "Zz9Zz9"$/);
  });

  it('refuses a link to an entry of a kind it does not take, or to an event that is no entry', () => {
    const { q, f, d, r, m } = oneOfEach();
    const content = { ...MADE, text: 'Floating.', why: 'Furniture.' };
    refused('decide', NOTE, ['--answers', d], content, new RegExp(`^ledger decide --answers names ${d}, a decision — it must name a question$`));
    refused('ask', NOTE, ['--part-of', f], { ...MADE, text: 'Q?' }, new RegExp(`^ledger ask --part-of names ${f}, a finding — it must name a question$`));
    refused('find', NOTE, ['--relies-on', m], { ...MADE, text: 'A fact.', how: 'by hand' }, new RegExp(`^ledger find --relies-on names ${m}, a moved event — it must name an entry$`));
    refused('replace', NOTE, ['--replaces', m, '--reason', 'was-wrong'], { ...MADE, drops: [] }, new RegExp(`^ledger replace --replaces names ${m}, a moved event — it must name an entry$`));
    refused('replace', NOTE, ['--replaces', q, '--reason', 'was-wrong', '--cause', m], { ...MADE, drops: [], text: 'Q?' }, /--cause names \w+, a moved event — it must name an entry$/);
    refused('hold', NOTE, ['--entry', f, '--after', d], MADE, new RegExp(`^ledger hold --after names ${d}, a decision — it must name a replacement$`));
    refused('merge', NOTE, ['--question', q, '--into', q], MADE, new RegExp(`^ledger merge --into names ${q}, a question — it must name a decision$`));
    refused('merge', NOTE, ['--question', q, '--into', r, '--duplicate', f], MADE, new RegExp(`^ledger merge --duplicate names ${f}, a finding — it must name a decision$`));
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
    const row = (/** @type {number} */ order) => ({ order, summary: 'A topic', routing: 'discussion', source: 'discovery' });
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

  it('refuses a move to a topic the unit does not have, and a move made at the unit\'s level, from no topic', () => {
    const question = ask().id;
    refused('move', NOTE, ['--question', question, '--to', 'dock-icon'], MADE, /^ledger move: fumi has no topic "dock-icon" to move the question to$/);
    refused('move', NOTE, ['--question', question, '--to', '__proto__'], MADE, /^ledger move: fumi has no topic "__proto__" to move the question to$/);
    refused('move', `${UNIT}.discussion`, ['--question', question, '--to', 'space-homing'], MADE, /^ledger move: a question moves from a topic — name it: fumi\.discussion\.<topic>$/);
    refused('move', `${UNIT}.specification`, ['--question', question, '--to', 'space-homing'], MADE,
      /^ledger move: a question moves from a topic, and specification has none — a topic exists only before the spec$/);
  });
});

describe('scenarios', () => {
  it('replaces a finding shown wrong with the reason "it was wrong", and the person\'s own decision with the same reason (5.S12)', () => {
    const finding = find().id;
    write('replace', NOTE, ['--replaces', finding, '--reason', 'was-wrong'], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike' });
    assert.deepStrictEqual([entries().at(-1).replaces, entries().at(-1).reason, entries().at(-1).of], [full(finding), 'was-wrong', 'finding']);

    const question = ask().id;
    const persons = decide(question, { by: 'person', kind: 'look' }).id;
    write('replace', NOTE, ['--replaces', persons, '--reason', 'was-wrong'], { ...MADE, drops: ['near-frameless'], text: 'A plain window after all.', why: 'Frameless notes got lost.' });
    assert.deepStrictEqual([entries().at(-1).replaces, entries().at(-1).reason, entries().find((e) => e.id === full(persons)).by], [full(persons), 'was-wrong', 'person']);
  });

  it('names, in a change caused by another topic\'s decision, that decision by its short id, and refuses the change naming none (5.S13)', () => {
    const theirs = write('ask', SPACE, [], { ...MADE, text: 'Does a note follow the person across Spaces?' }).id;
    const cause = write('decide', SPACE, ['--answers', theirs], { ...MADE, text: 'A note follows the person.', why: 'Furniture moves with you.' }).id;
    const ours = decide(ask().id, { text: 'A note stays on its Space.' }).id;
    const content = { ...MADE, drops: ['stays on its Space'], text: 'A note floats above every Space.', why: 'space-homing decided it follows the person.' };

    refused('replace', NOTE, ['--replaces', ours, '--reason', 'other-topic'], content,
      /^ledger replace --reason other-topic needs --cause <id>: a decision on a topic other than the replaced entry's$/);
    write('replace', NOTE, ['--replaces', ours, '--reason', 'other-topic', '--cause', cause], content);

    assert.strictEqual(cause.length, 6, 'the cause was named by its short id');
    assert.deepStrictEqual([entries().at(-1).reason, entries().at(-1).cause], ['other-topic', full(cause)]);
  });

  it('records a review\'s finding as a question the review asked, and links the later answer to it (5.S14)', () => {
    const raised = write('ask', `${UNIT}.review`, [], { by: 'review', who_moved_whom: 'none', text: 'The note window leaks its frame on hover — is that intended?' });
    assertLast('asked', { phase: 'review', topic: null }, { by: 'review', who_moved_whom: 'none', text: 'The note window leaks its frame on hover — is that intended?', part_of: null, relies_on: [] });

    write('decide', `${UNIT}.review`, ['--answers', raised.id], { ...MADE, text: 'No: the frame stays hidden on hover.', why: 'The design is frameless.' });

    assert.strictEqual(entries().at(-1).answers, full(raised.id));
  });

  it('stops the next write on a line a shell command changed, showing the line found (5.S5)', () => {
    const question = ask().id;
    decide(question, { text: 'Floats above every Space.' });
    decide(question, { text: 'Its controls appear on hover.' });
    execFileSync('sh', ['-c', `sed '2s/"text":"[^"]*"/"text":"Changed by hand."/' ${layout.ledger} > .ledger.edit && mv .ledger.edit ${layout.ledger}`], { cwd: statePath(dir) });
    const tampered = ledgerText();

    const res = refuses(dir, ['ledger', 'ask', NOTE], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'After the edit?' }) });

    assert.deepStrictEqual([res.stop, res.error], ['ledger', `${layout.ledger} changed outside the engine: line 2 is not the line committed there — the engine stops here`]);
    assert.strictEqual(ledgerText(), tampered, 'the stop appended');
    const screen = output(dir, ['render', 'ledger-stop']);
    assert.match(screen, /line 2 isn't the line the state branch last committed there\. The line it found:\n> \s+\{"v":1,"id":"/);
    assert.ok(screen.includes(`{"v":1,"id":"${JSON.parse(tampered.split('\n')[1]).id.slice(0, 6)}`), `the screen does not show the line found\n${screen}`);
  });
});

describe('the writer lock and the commit', () => {
  it('commits the ledger alone to the state branch in the same verb, leaving the state\'s other changes uncommitted', () => {
    fs.writeFileSync(statePath(dir, layout.unit(UNIT, 'spec.md')), 'a session\'s own file\n');
    const before = stateGit(dir, ['status', '--porcelain']);

    const res = ask();

    assertAnswered(res, full(res.id));
    assert.strictEqual(stateGit(dir, ['log', '-1', '--format=%s']).trim(), `ledger(fumi): asked ${full(res.id)} in note-window`);
    assert.strictEqual(stateGit(dir, ['status', '--porcelain']), before, 'the commit swept up the state\'s other changes');
  });

  it('answers a push that fails as a warning, the entry and its commit standing', () => {
    git(dir, ['remote', 'add', 'origin', path.join(dir, 'nowhere.git')]);

    const res = ask();

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
  });

  it('answers a commit git refuses as a warning, the entry standing in the ledger, pending; the next write commits it with its own', () => {
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(dir, 'git-'));
    fs.writeFileSync(path.join(wrapper, 'git'), `#!/bin/sh\ncase "$*" in *commit-tree*) echo "fatal: refused here" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`, { mode: 0o755 });
    const tip = head(dir);

    const res = write('ask', NOTE, [], { ...MADE, text: 'Committed later?' }, { ...SESSION, PATH: `${wrapper}:${process.env.PATH}` });

    assert.deepStrictEqual(Object.keys(res), ['ok', 'id', 'committed', 'note', 'warnings']);
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note, 'commit pending — the entry is in the ledger, and the next ledger write or boot commits it');
    assert.match(res.warnings[0], /^commit failed: git commit-tree failed: fatal: refused here$/);
    assert.strictEqual(head(dir), tip);
    assert.strictEqual(entries().at(-1).text, 'Committed later?');

    ask('Committed with it?');

    assert.deepStrictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]).split('\n').slice(0, -1).map((line) => JSON.parse(line).text), ['Committed later?', 'Committed with it?']);
  });

  it('answers what it refuses without the lock — its argv, its place, its content in the shape of the kind it writes — at once, while a live peer holds it', (t) => {
    const question = ask().id;
    const lock = statePath(dir, layout.lock);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
    const stdin = JSON.stringify({ ...MADE, text: 'Answered at once?' });
    const attempts = lockAttempts(t, lock, () => { throw new Error('a refusal waited on the lock'); });

    for (const [args, env, refusal] of /** @type {[string[], Record<string, string>, RegExp][]} */ ([
      [['ledger', 'ask', NOTE], { CLAUDE_CODE_SESSION_ID: '' }, /no session to tag the entry with/],
      [['ledger', 'ask', 'mint.discussion.note-window'], SESSION, /there is no work unit "mint"/],
      [['ledger', 'decide', NOTE], SESSION, /needs --answers/],
      [['ledger', 'decide', NOTE, '--answers', question], SESSION, /the content needs why/],
      [['ledger', 'replace', NOTE, '--replaces', question, '--reason', 'new-fact'], SESSION, /--reason new-fact needs --cause/],
      [['ledger', 'replace', NOTE, '--replaces', question, '--reason', 'changed-mind'], SESSION, /the content needs drops/],
    ])) {
      assert.match(refuses(dir, args, { env, stdin }).error, refusal);
    }

    assert.deepStrictEqual(attempts, []);
    assert.deepStrictEqual(entries().map((e) => e.text), ['What is a note, at its most basic?']);
  });

  it('reads the place a write is made, and a move\'s destination, live again under the lock: a topic cancelled while the write waited takes nothing', (t) => {
    const question = ask().id;
    const lock = statePath(dir, layout.lock);
    const peer = JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) });
    let taken = 0;
    // The peer cancels space-homing and lets go once the write has found the lock held and tried again.
    const attempts = lockAttempts(t, lock, () => {
      taken += 1;
      if (taken < 2) return;
      createManifest(dir, UNIT, { work_type: 'epic', phases: { ...WRITE_PHASES, discovery: { items: { ...WRITE_PHASES.discovery.items, 'space-homing': { cancelled: true } } } } });
      fs.unlinkSync(lock);
    });

    for (const [args, stdin, refusal] of /** @type {[string[], Record<string, unknown>, string][]} */ ([
      [['ledger', 'ask', SPACE], { ...MADE, text: 'Asked on a topic cancelled meanwhile?' }, 'ledger ask: fumi.discussion.space-homing takes no writes — its topic, space-homing, is cancelled'],
      [['ledger', 'move', NOTE, '--question', question, '--to', 'space-homing'], MADE, 'ledger move: --to names space-homing, which takes no question — its topic, space-homing, is cancelled'],
    ])) {
      createManifest(dir, UNIT, { work_type: 'epic', phases: WRITE_PHASES });
      fs.writeFileSync(lock, peer);
      taken = 0;
      assert.strictEqual(refuses(dir, args, { env: SESSION, stdin: JSON.stringify(stdin) }).error, refusal);
    }

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made', 'taken', 'taken', 'made']);
    assert.deepStrictEqual(entries().map((e) => e.event), ['asked'], 'a write landed in a topic cancelled while it waited');
  });

  it('lands two processes\' appends made at once, under ids that differ and are no sequence, a read made meanwhile meeting whole lines only (5.S2)', async () => {
    const EACH = 6;
    const script = [
      'const engine = require(process.argv[1]);',
      'const [cwd, session] = process.argv.slice(2);',
      `for (let i = 0; i < ${EACH}; i += 1) {`,
      `  const res = engine.run(['ledger', 'ask', '${NOTE}'], { cwd, env: { CLAUDE_CODE_SESSION_ID: session }, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: session + ' asks ' + i }) });`,
      '  if (res.code !== 0) { process.stderr.write(res.stderr); process.exit(1); }',
      '}',
    ].join('\n');
    const WRITER_TIMEOUT_MS = 30000;
    const READS = 6000;
    const writers = ['session-a', 'session-b'].map((session) => {
      const child = spawn('node', ['-e', script, ENGINE, dir, session], { stdio: ['ignore', 'ignore', 'pipe'], timeout: WRITER_TIMEOUT_MS, killSignal: 'SIGKILL' });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      return new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, stderr: signal ? `killed after ${WRITER_TIMEOUT_MS}ms\n${stderr}` : stderr })));
    });
    let done = false;
    const landed = Promise.all(writers).finally(() => { done = true; });
    const file = statePath(dir, layout.ledger);
    let meanwhile = 0;
    let read = 0;

    for (let reads = 0; !done; reads += 1) {
      assert.ok(reads < READS, `the two writers had not both ended after ${READS} reads`);
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(text.endsWith('\n'), `a read met half a line: …${JSON.stringify(text.slice(-60))}`);
        const count = text.split('\n').slice(0, -1).map((line) => JSON.parse(line)).length;
        const through = ledgerEntries(statePath(dir)).length;
        assert.ok(through >= count, 'the engine\'s read met fewer entries than the file held before it');
        read = Math.max(read, through);
        if (count > 0 && count < 2 * EACH) meanwhile += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    for (const outcome of /** @type {{code: number, stderr: string}[]} */ (await landed)) assert.strictEqual(outcome.code, 0, outcome.stderr);
    assert.ok(meanwhile > 0, 'no read was made while the appends landed');
    const all = entries();
    const ids = all.map((e) => e.id);
    assert.strictEqual(all.length, 2 * EACH);
    assert.strictEqual(new Set(ids).size, ids.length, 'two appends took one id');
    assert.ok(ids.every((id) => ID.test(id) && !/^\d+$/.test(id)), `an id is a sequence number: ${ids.join(' ')}`);
    for (const session of ['session-a', 'session-b']) {
      assert.deepStrictEqual(all.filter((e) => e.session === session).map((e) => e.text), [...Array(EACH).keys()].map((i) => `${session} asks ${i}`));
    }
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
    assert.strictEqual(stateGit(dir, ['rev-list', '--merges', 'HEAD']), '');
  });
});
