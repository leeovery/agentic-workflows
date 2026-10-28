'use strict';

// ---------------------------------------------------------------------------
// Whose entries a ledger write's links name, and how they relate
// (workflow-engine/scripts/domain/ledger-write.cjs with domain/ledger-fold.cjs
// and domain/ledger-units.cjs): what follows from a link set by the engine;
// a write made on a live unit and topic alone, another unit's or topic's
// entries refused where they go to their owner; a question read where it was
// last moved, an entry where its chain's first entry stands; links taken
// only while their entries are current; a cause a reason cannot have
// refused; and the product-wide mark a replacement keeps.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { ok, statePath, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { ID_FACTS, foldLedger, standingOf } = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { liveness } = require(path.join(SCRIPTS, 'domain/ledger-units.cjs'));

const { UNIT, MADE, NOTE, SPACE, WRITE_PHASES, ledgerWriteHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-write-', WRITE_PHASES);
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, entries, full, refused, ask, find, decide, change } = ledgerWriteHelpers(() => dir);

describe('whose entries a link names, and how they relate', () => {
  const DECISION = Object.freeze({ ...MADE, text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.' });
  const CHANGE = Object.freeze({ ...MADE, drops: ['near-frameless'], text: 'A frameless surface.', why: 'Lighter.' });
  const BEFORE_THE_SPEC = 'before the spec a topic writes on its own entries alone, and another topic\'s change goes to it by message';

  /** A question space-homing asks, and the decision answering it there: their short ids. */
  function spaceHomings() {
    const question = write('ask', SPACE, [], { ...MADE, text: 'Does a note follow the person across Spaces?' }).id;
    return { question, decision: write('decide', SPACE, ['--answers', question], { ...MADE, text: 'A note follows the person.', why: 'Furniture moves with you.' }).id };
  }

  /** A second epic on the project, mint, with a question and the decision answering it on its own topic: their short ids. */
  function mints() {
    createManifest(dir, 'mint', { work_type: 'epic', phases: { discussion: { items: { 'dock-icon': { status: 'in-progress' } } } } });
    const question = write('ask', 'mint.discussion.dock-icon', [], { ...MADE, text: 'Does the app show in the dock?' }).id;
    return { question, decision: write('decide', 'mint.discussion.dock-icon', ['--answers', question], { ...MADE, text: 'No dock icon.', why: 'A menu-bar app.' }).id };
  }

  it('refuses a decision answering, and a move or a merge taking, another unit\'s question, and a move to a topic of another unit; another unit\'s decision is replaced, never recorded beside it (5.6.1)', () => {
    const mint = mints();
    const owned = decide(ask().id).id;
    const ours = ask('Does a note show in the dock?').id;
    const another = (/** @type {string} */ flag) => new RegExp(`^ledger \\w+ ${flag} names ${mint.question}, a question of mint — it must be fumi's own$`);

    refused('decide', NOTE, ['--answers', mint.question], DECISION, another('--answers'));
    refused('move', NOTE, ['--question', mint.question, '--to', 'space-homing'], MADE, another('--question'));
    refused('merge', NOTE, ['--question', mint.question, '--into', owned], MADE, another('--question'));
    refused('move', NOTE, ['--question', ours, '--to', 'dock-icon'], MADE, /^ledger move: fumi has no topic "dock-icon" to move the question to$/);

    write('replace', NOTE, ['--replaces', mint.decision, '--reason', 'changed-mind'], { ...CHANGE, drops: ['no dock icon'], text: 'A dock icon while a note is open.' });
    const replacement = entries().at(-1);
    assert.deepStrictEqual([replacement.unit, replacement.topic, replacement.replaces, replacement.answers], ['fumi', 'note-window', full(mint.decision), full(mint.question)]);
  });

  it('refuses, before the spec, a topic replacing or confirming another topic\'s entry, or answering its question, which goes to the owner by message (5.6.9, 10.S6); from the spec on, a change is settled where it is found (12.15.4)', () => {
    const theirs = spaceHomings();
    const unitLevel = write('find', `${UNIT}.discovery`, [], { ...MADE, text: 'Notes sync through iCloud.', how: 'the brief' }).id;
    const ours = decide(ask().id).id;
    const relying = write('find', SPACE, ['--relies-on', ours], { ...MADE, text: 'Homing reads the note\'s frame.', how: 'the spike' }).id;
    const replacement = change(ours).id;

    refused('replace', NOTE, ['--replaces', theirs.decision, '--reason', 'changed-mind'], CHANGE,
      new RegExp(`^ledger replace --replaces names ${theirs.decision}, a decision on space-homing — ${BEFORE_THE_SPEC}$`));
    refused('decide', NOTE, ['--answers', theirs.question], DECISION,
      new RegExp(`^ledger decide --answers names ${theirs.question}, a question on space-homing — ${BEFORE_THE_SPEC}$`));
    refused('replace', NOTE, ['--replaces', unitLevel, '--reason', 'was-wrong'], { ...MADE, drops: ['iCloud'], text: 'Notes stay local.', how: 'the brief, reread' },
      new RegExp(`^ledger replace --replaces names ${unitLevel}, a finding at the unit's level — ${BEFORE_THE_SPEC}$`));
    refused('hold', NOTE, ['--entry', relying, '--after', replacement], MADE,
      new RegExp(`^ledger hold --entry names ${relying}, a finding on space-homing — ${BEFORE_THE_SPEC}$`));

    write('hold', SPACE, ['--entry', relying, '--after', replacement], MADE);
    write('replace', `${UNIT}.specification`, ['--replaces', theirs.decision, '--reason', 'changed-mind'], CHANGE);
    write('decide', `${UNIT}.specification`, ['--answers', theirs.question], DECISION);
    assert.deepStrictEqual(entries().slice(-3).map((e) => [e.event, e.phase, e.topic]), [
      ['still-holds', 'discussion', 'space-homing'], ['replaced', 'specification', null], ['decided', 'specification', null],
    ]);
  });

  it('reads a question as standing on the topic it was last moved to: it is moved and answered from there alone, and moves to another topic of its unit (5.3.3)', () => {
    createManifest(dir, UNIT, { work_type: 'epic', phases: { ...WRITE_PHASES, specification: { items: { 'notes-spec': {} } } } });
    const question = ask().id;
    const staying = ask('Does a note remember its size?').id;

    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    refused('move', NOTE, ['--question', question, '--to', 'menu-bar'], MADE, new RegExp(`^ledger move --question names ${question}, a question on space-homing — ${BEFORE_THE_SPEC}$`));
    refused('decide', NOTE, ['--answers', question], DECISION, new RegExp(`^ledger decide --answers names ${question}, a question on space-homing — `));
    write('decide', SPACE, ['--answers', question], DECISION);
    write('move', SPACE, ['--question', question, '--to', 'menu-bar'], MADE);
    refused('move', SPACE, ['--question', question, '--to', 'note-window'], MADE, /a question on menu-bar — /);
    const folded = { facts: foldLedger(statePath(dir), ID_FACTS, []), live: liveness(statePath(dir)) };
    assert.deepStrictEqual(standingOf(folded, full(question)), { unit: UNIT, topic: 'menu-bar' });

    refused('move', NOTE, ['--question', staying, '--to', 'note-window'], MADE, /^ledger move: --to names note-window, the topic it moves from — a question moves to another topic$/);
    refused('move', NOTE, ['--question', staying, '--to', 'notes-spec'], MADE, /^ledger move: fumi has no topic "notes-spec" to move the question to$/);
  });

  it('reads an entry as standing where the first entry of its chain stands: one replaced, or a question reworded, from the spec is written on from its topic alone (5.6.9)', () => {
    const question = ask().id;
    const decision = decide(question).id;
    const fromSpec = write('replace', `${UNIT}.specification`, ['--replaces', decision, '--reason', 'changed-mind'], CHANGE).id;
    const reworded = write('replace', `${UNIT}.specification`, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: ['basic'], text: 'What is a note, at its simplest?' }).id;

    refused('replace', SPACE, ['--replaces', fromSpec, '--reason', 'changed-mind'], CHANGE, new RegExp(`^ledger replace --replaces names ${fromSpec}, a decision on note-window — ${BEFORE_THE_SPEC}$`));
    refused('decide', SPACE, ['--answers', reworded], DECISION, new RegExp(`^ledger decide --answers names ${reworded}, a question on note-window — ${BEFORE_THE_SPEC}$`));

    write('replace', NOTE, ['--replaces', fromSpec, '--reason', 'changed-mind'], { ...CHANGE, text: 'A frameless panel.' });
    write('decide', NOTE, ['--answers', reworded], DECISION);
  });

  it('answers a question, asks a part of it, relies on it, and moves and merges it only while current, naming the one that superseded it, so no stale question goes on a map (5.3.13)', () => {
    const asked = ask().id;
    const reworded = write('replace', NOTE, ['--replaces', asked, '--reason', 'changed-mind'], { ...MADE, drops: ['basic'], text: 'What is a note, at its simplest?' }).id;
    const owned = decide(ask('Is a note a window?').id).id;
    const superseded = (/** @type {string} */ verb, /** @type {string} */ flag) => new RegExp(`^ledger ${verb} ${flag} names ${asked}, which ${reworded} replaced — the current one is ${reworded}$`);

    refused('decide', NOTE, ['--answers', asked], DECISION, superseded('decide', '--answers'));
    refused('ask', NOTE, ['--part-of', asked], { ...MADE, text: 'Is a note a window?' }, superseded('ask', '--part-of'));
    refused('find', NOTE, ['--relies-on', asked], { ...MADE, text: 'A note is a window.', how: 'by hand' }, superseded('find', '--relies-on'));
    refused('move', NOTE, ['--question', asked, '--to', 'space-homing'], MADE, superseded('move', '--question'));
    refused('merge', NOTE, ['--question', asked, '--into', owned], MADE, superseded('merge', '--question'));

    write('decide', NOTE, ['--answers', reworded], DECISION);
    write('ask', NOTE, ['--part-of', reworded], { ...MADE, text: 'Is a note a window?' });
    write('find', NOTE, ['--relies-on', reworded], { ...MADE, text: 'A note is a window.', how: 'by hand' });
    write('move', NOTE, ['--question', reworded, '--to', 'space-homing'], MADE);
    write('merge', SPACE, ['--question', reworded, '--into', owned], MADE);
    assert.deepStrictEqual(entries().slice(-5).map((e) => [e.event, e.answers ?? e.part_of ?? e.relies_on?.[0] ?? e.question]), [
      ['decided', full(reworded)], ['asked', full(reworded)], ['found', full(reworded)], ['moved', full(reworded)], ['merged', full(reworded)],
    ]);
  });

  it('merges into a current decision, a duplicate being another current decision answering the question merged (5.5.4, 5.5.5)', () => {
    const owned = decide(ask().id).id;
    const here = write('ask', SPACE, [], { ...MADE, text: 'Is a note a window?' }).id;
    const duplicate = write('decide', SPACE, ['--answers', here], DECISION).id;
    const elsewhere = spaceHomings();
    const current = change(owned).id;
    const merge = (/** @type {string[]} */ flags, /** @type {RegExp} */ pattern) => refused('merge', SPACE, ['--question', here, ...flags], MADE, pattern);

    merge(['--into', owned], new RegExp(`^ledger merge --into names ${owned}, which ${current} replaced — the current one is ${current}$`));
    merge(['--into', current, '--duplicate', current], new RegExp(`^ledger merge --duplicate names ${current}, the decision --into names — a duplicate is another entry$`));
    merge(['--into', current, '--duplicate', elsewhere.decision],
      new RegExp(`^ledger merge --duplicate names ${elsewhere.decision}, which answers ${elsewhere.question} — a duplicate answers the question merged, ${here}, in any of its wordings$`));
    const reworded = write('replace', SPACE, ['--replaces', duplicate, '--reason', 'changed-mind'], CHANGE).id;
    merge(['--into', current, '--duplicate', duplicate], new RegExp(`^ledger merge --duplicate names ${duplicate}, which ${reworded} replaced — the current one is ${reworded}$`));

    write('merge', SPACE, ['--question', here, '--into', current, '--duplicate', reworded], MADE);
    assert.deepStrictEqual([entries().at(-1).into, entries().at(-1).duplicate], [full(current), full(reworded)]);
  });

  it('takes a duplicate answering an earlier wording of the question merged, as a reworded question keeps its answers (5.3.13, 5.5.5)', () => {
    const owned = decide(ask().id).id;
    const asked = write('ask', SPACE, [], { ...MADE, text: 'Is a note a window?' }).id;
    const duplicate = write('decide', SPACE, ['--answers', asked], DECISION).id;
    const reworded = write('replace', SPACE, ['--replaces', asked, '--reason', 'changed-mind'], { ...MADE, drops: ['window'], text: 'Is a note a window or a panel?' }).id;

    write('merge', SPACE, ['--question', reworded, '--into', owned, '--duplicate', duplicate], MADE);

    assert.deepStrictEqual([entries().at(-1).question, entries().at(-1).duplicate], [full(reworded), full(duplicate)]);
  });

  it('takes a duplicate answering a later wording another unit made, set aside since, as an answer to any wording answers the question (5.3.13, 5.8.17)', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const owned = decide(ask().id).id;
    const asked = write('ask', SPACE, [], { ...MADE, text: 'Is a note a window?' }).id;
    const reworded = write('replace', 'mint.discussion.mint', ['--replaces', asked, '--reason', 'changed-mind'], { ...MADE, drops: ['window'], text: 'Is a note a window in Mint?' }).id;
    const duplicate = write('decide', SPACE, ['--answers', reworded], DECISION).id;
    ok(dir, ['workunit', 'cancel', 'mint']);

    write('merge', SPACE, ['--question', asked, '--into', owned, '--duplicate', duplicate], MADE);

    assert.deepStrictEqual([entries().at(-1).question, entries().at(-1).duplicate], [full(asked), full(duplicate)]);
  });

  it('holds a current entry after the latest replacement on the way to its current form of an entry it relies on: what it replaced, or an earlier entry of its chain (5.6.10)', () => {
    const first = decide(ask().id).id;
    const relying = find(['--relies-on', first]).id;
    const unrelated = find().id;
    const second = change(first).id;
    const onSecond = find(['--relies-on', second]).id;
    const third = change(second, { text: 'A translucent surface.', why: 'Lighter still.' }).id;
    const nothingReplaced = (/** @type {string} */ entry, /** @type {string} */ after) => new RegExp(
      `^ledger hold --entry names ${entry}, which is held against nothing ${after} changed — it holds an entry relying on or answering one whose way to its current form the replacement is on$`);

    refused('hold', NOTE, ['--entry', unrelated, '--after', second], MADE, nothingReplaced(unrelated, second));
    refused('hold', NOTE, ['--entry', onSecond, '--after', second], MADE, nothingReplaced(onSecond, second));
    write('hold', NOTE, ['--entry', relying, '--after', third], MADE);
    write('hold', NOTE, ['--entry', onSecond, '--after', third], MADE);

    const corrected = write('replace', NOTE, ['--replaces', relying, '--reason', 'was-wrong', '--relies-on', third], { ...MADE, drops: ['across restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike' }).id;
    refused('hold', NOTE, ['--entry', relying, '--after', third], MADE, new RegExp(`^ledger hold --entry names ${relying}, which ${corrected} replaced — the current one is ${corrected}$`));
    const fourth = change(third, { text: 'A clear surface.', why: 'Clearer still.' }).id;
    write('hold', NOTE, ['--entry', corrected, '--after', fourth], MADE);
  });

  it('refuses a cause a reason cannot have: none for a new fact or another topic\'s decision, a new fact\'s that is no finding, another topic\'s that is no decision on another topic, and the entry replaced itself (5.3.8)', () => {
    const question = ask().id;
    const ours = decide(question).id;
    const sibling = decide(question, { text: 'Its controls appear on hover.' }).id;
    const finding = find().id;
    const theirs = spaceHomings().decision;
    const replace = (/** @type {string} */ reason, /** @type {string|null} */ cause, /** @type {RegExp} */ pattern) => refused(
      'replace', NOTE, ['--replaces', ours, '--reason', reason, ...(cause === null ? [] : ['--cause', cause])], CHANGE, pattern);
    const otherTopic = '--reason other-topic needs a decision on a topic other than the replaced entry\'s';

    replace('new-fact', null, /^ledger replace --reason new-fact needs --cause <id>: a finding$/);
    replace('new-fact', theirs, new RegExp(`^ledger replace --cause names ${theirs}, a decision on space-homing — --reason new-fact needs a finding$`));
    replace('other-topic', sibling, new RegExp(`^ledger replace --cause names ${sibling}, a decision on note-window — ${otherTopic}$`));
    replace('other-topic', finding, new RegExp(`^ledger replace --cause names ${finding}, a finding on note-window — ${otherTopic}$`));
    for (const reason of ['new-fact', 'other-topic', 'changed-mind', 'was-wrong']) {
      replace(reason, ours, new RegExp(`^ledger replace --cause names ${ours}, the entry it replaces — a cause is what made the change$`));
    }

    write('replace', NOTE, ['--replaces', ours, '--reason', 'new-fact', '--cause', finding], CHANGE);
    write('replace', NOTE, ['--replaces', sibling, '--reason', 'changed-mind', '--cause', theirs], CHANGE);
    assert.deepStrictEqual(entries().slice(-2).map((e) => [e.reason, e.cause]), [['new-fact', full(finding)], ['changed-mind', full(theirs)]]);
  });

  it('judges another topic\'s decision by where it and the replaced entry stand: another unit\'s replacement standing here is changed for a decision of its unit\'s topic, and one replaced from the spec never for a decision on the topic it stands on (5.3.8)', () => {
    const mint = mints();
    const ours = decide(ask().id).id;
    const minted = write('replace', 'mint.discussion.dock-icon', ['--replaces', ours, '--reason', 'changed-mind'], CHANGE).id;
    write('replace', NOTE, ['--replaces', minted, '--reason', 'other-topic', '--cause', mint.decision], { ...CHANGE, text: 'A frameless panel, as Mint has no dock icon.' });

    const here = decide(ask('Does a note snap?').id, { text: 'Notes snap to the grid.' }).id;
    const sibling = decide(ask('Does a note resize?').id, { text: 'Notes resize from any edge.' }).id;
    const fromSpec = write('replace', `${UNIT}.specification`, ['--replaces', here, '--reason', 'changed-mind'], CHANGE).id;
    refused('replace', NOTE, ['--replaces', fromSpec, '--reason', 'other-topic', '--cause', sibling], CHANGE,
      new RegExp(`^ledger replace --cause names ${sibling}, a decision on note-window — --reason other-topic needs a decision on a topic other than the replaced entry's$`));
    refused('replace', `${UNIT}.specification`, ['--replaces', fromSpec, '--reason', 'other-topic', '--cause', sibling], CHANGE, /a decision on note-window — --reason other-topic needs/);
  });

  it('keeps the replaced entry\'s product-wide mark where the replacement leaves it out, and takes the one it gives (5.2.5)', () => {
    const wide = decide(ask().id, { product_wide: true }).id;
    const kept = change(wide).id;
    const narrowed = change(kept, { text: 'Frameless, on this product alone.', why: 'Scoped.', product_wide: false }).id;
    const fact = write('find', NOTE, [], { ...MADE, text: 'CKSyncEngine ships from macOS 14.', how: 'Apple\'s documentation', product_wide: true }).id;
    const corrected = write('replace', NOTE, ['--replaces', fact, '--reason', 'was-wrong'], { ...MADE, drops: ['14'], text: 'CKSyncEngine ships from macOS 14.4.', how: 'the release notes' }).id;
    const plain = find().id;
    const reworded = write('replace', NOTE, ['--replaces', plain, '--reason', 'was-wrong'], { ...MADE, drops: ['restarts'], text: 'Spaces keep their ids within a login.', how: 'a second spike' }).id;

    assert.deepStrictEqual([kept, narrowed, corrected, reworded].map((id) => entries().find((e) => e.id === full(id)).product_wide), [true, false, true, false]);
  });
});
