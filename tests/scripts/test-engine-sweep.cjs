'use strict';

// ---------------------------------------------------------------------------
// The sweep before the spec (leeway-engine/scripts/domain/sweep.cjs, its
// brief's records in domain/brief-records.cjs, the map after it in
// domain/approve-map.cjs): `brief sweep <unit>`, the sweep's own named agent
// briefed for the unit with every live topic's entries and the unit's own,
// the product record, the names struck, the refusal and where its report
// goes (8.S43, 26.5.1); its report read whole or refused, naming every fault
// — a report of another shape, a message to a topic that is not live, a
// candidate as add-batch refuses one — and that refusal carried into the
// next brief; `render approve-map <unit> --sweep`, the map as it stands with
// every topic ticked and the sweep's candidates below it, each with its
// reason, and nothing of its messages or the calls it left to the builder
// (8.8.4, 8.S50); the strike, at once for one candidate and through a pick
// for several (P8), and its undoing; the yes landing the candidates standing
// as topics with their briefs and the struck names as the person's answer,
// then the epic's menu where a topic is no longer decided — a candidate
// taken, or a topic a message from the spec reopened — and the spec
// carrying on otherwise (P10); each refusal writing nothing, the map closed
// once spec.md is written among them (P3).
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its topics
// `note-model` and `storage-and-sync` decided, each with a question and its
// decision written through the ledger's verbs — storage's decision over two
// lines — `widgets` postponed, `dock-badge` struck from the map, and a
// finding at its discovery; a feature, `billing`, whose decision `fumi`
// replaced at its spec; the roadmap holding a waiting idea, `note-sync`.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, refusedPristine, statePath, layout, writeState, readState, readManifest, commitAll, sectionOf, lastMessage, touched, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE, SESSION, ledgerHelpers } = require('./ledger-world.cjs');
const { gatesHelpers } = require('./discovery-gates-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BRIEFS, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));

const UNIT = 'fumi';
const SESSION_ID = SESSION.CLAUDE_CODE_SESSION_ID;
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const REPORT = layout.cache(UNIT, 'specification', 'sweep.json');
const STAGED = layout.cache(UNIT, 'discovery', UNIT, 'approve-map.json');

/** A topic on the map, set aside as `aside` says. @param {number} order @param {Record<string, boolean>} [aside] */
const mapped = (order, aside = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...aside });

/** The epic's manifest, its topics' discussions each as `status` gives it. @param {string} dir @param {string} status */
function fumi(dir, status) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-model': mapped(1), 'storage-and-sync': mapped(2), widgets: mapped(3, { postponed: true }) }, dismissed: ['dock-badge'] },
      discussion: { items: { 'note-model': { status }, 'storage-and-sync': { status }, widgets: { status: 'in-progress' } } },
    },
  });
}

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

const world = fixtureFrom('sweep-', (dir) => {
  fumi(dir, 'in-progress');
  createManifest(dir, 'billing', { phases: { discussion: { items: { billing: { status: 'in-progress' } } } } });
  commitAll(dir, 'init');
  const { write } = ledgerHelpers(() => dir);
  const ask = (/** @type {string} */ topic, /** @type {string} */ text, unit = UNIT) => write('ask', `${unit}.discussion.${topic}`, [], { ...PERSON, text }).id;
  const decide = (/** @type {string} */ topic, /** @type {string} */ question, /** @type {string} */ text, unit = UNIT) => write('decide', `${unit}.discussion.${topic}`, ['--answers', question], { ...PERSON, text, why: 'Because.' }).id;
  made.kind = ask('note-model', 'What is a note?');
  made.text = decide('note-model', made.kind, 'Plain text with a title.');
  made.where = ask('storage-and-sync', 'Where do notes live?');
  made.folder = decide('storage-and-sync', made.where, 'A folder the person picks.\nEach note one file.');
  made.files = write('find', `${UNIT}.discovery`, [], { ...MADE, text: 'Notes are files on disk today.', how: 'read in the code', known: 'read' }).id;
  const billed = decide('billing', ask('billing', 'Is a note export billed?', 'billing'), 'Yes.', 'billing');
  made.billed = write('replace', `${UNIT}.specification`, ['--replaces', billed, '--reason', 'changed-mind'], { ...PERSON, drops: ['billed'], text: 'Never.', why: 'Because.' }).id;
  ok(dir, ['roadmap', 'add', 'note-sync', '--horizon', 'next', '--summary', 'Notes synced between Macs']);
  fumi(dir, 'completed');
  commitAll(dir, 'topics decided');
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
});

const { scratch, answer, run } = gatesHelpers(() => dir);

/** A candidate as the sweep writes it. @param {string} name @param {string} reason */
const candidate = (name, reason) => ({ name, reason, brief: `# ${name}\n\nWhat it is, where it was read, why it matters, its open questions.` });

const BACKUPS = candidate('backing-up-notes', 'Storage and sync keeps every note as a file in a folder you choose, and no topic decides what happens when that folder is lost or restored.');
const EXPORT = candidate('exporting-notes', 'No topic decides how notes leave Fumi.');

/** The sweep's report written, its parts as given. @param {Record<string, unknown>} [parts] */
function report(parts = {}) {
  writeState(dir, REPORT, JSON.stringify({
    candidates: [BACKUPS],
    messages: [{ topic: 'note-model', text: 'A title is required\n\nStorage names each file by its title.' }],
    builder_calls: [{ call: 'The file extension', why: 'The person would leave it.' }],
    ...parts,
  }));
}

/** The brief issued for the unit, as stored: its answer and its text. */
function briefed() {
  const res = ok(dir, ['brief', 'sweep', UNIT], { env: SESSION });
  return { res, text: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

/** A part of a brief, by its heading. @param {string} text @param {string} heading */
function part(text, heading) {
  const at = text.indexOf(`# ${heading}\n\n`);
  assert.ok(at >= 0, `the brief holds "# ${heading}"`);
  const body = text.slice(at + heading.length + 4);
  const next = body.search(/\n# /);
  return (next === -1 ? body : body.slice(0, next)).trimEnd();
}

/** The map after the sweep, staged and drawn. */
const swept = () => output(dir, ['render', 'approve-map', UNIT, '--sweep'], { env: SESSION });

/** The refusal of `args`, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: SESSION }).error;

describe('the sweep\'s brief (8.10.8, 8.S43, 26.5.1)', () => {
  it('names its agent, and fills its template for the unit: every live topic\'s entries under its title, then the unit\'s own, each by short id and kind, the product record, the names struck, no refusal, and where the report goes', () => {
    const { res, text } = briefed();

    assert.deepStrictEqual([res.role, res.agent, res.pointer], ['sweep', 'leeway-sweep', `brief:${res.id}`]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'sweep', agent: 'leeway-sweep', unit: UNIT, task: null, topic: null });
    assert.strictEqual(text.split('\n')[0], `Brief ${res.id} — the sweep's, for ${UNIT}`);
    assert.strictEqual(part(text, 'This work\'s records'), [
      '## Note Model (note-model)', '',
      `- ${made.kind} question: What is a note?`,
      `- ${made.text} decision: Plain text with a title.`, '',
      '## Storage And Sync (storage-and-sync)', '',
      `- ${made.where} question: Where do notes live?`,
      `- ${made.folder} decision: A folder the person picks.`,
      '  Each note one file.', '',
      '## The unit\'s own', '',
      `- ${made.files} finding: Notes are files on disk today.`, '',
      '## Made here, standing on billing/billing', '',
      `- ${made.billed} decision: Never.`,
    ].join('\n'));
    assert.match(part(text, 'The product record'), /^```json\n[\s\S]*"Notes are files on disk today\."[\s\S]*\n```$/);
    assert.strictEqual(part(text, 'What the person struck or removed'), '- dock-badge');
    assert.strictEqual(part(text, 'The refusal'), 'None recorded.');
    assert.strictEqual(part(text, 'Where the report goes'), `\`${statePath(dir, REPORT)}\``);
  });

  it('carries what the map after the sweep refuses of the last report into the next brief, as the map says it', () => {
    report({ candidates: [candidate('dock-badge', 'A badge on the dock.')] });
    const refusal = refused(['render', 'approve-map', UNIT, '--sweep']).replace(/^render approve-map: /, '');

    assert.strictEqual(part(briefed().text, 'The refusal'), refusal);
  });

  it('refuses a unit the project lacks, and a topic named, storing nothing', () => {
    assert.strictEqual(refused(['brief', 'sweep', 'kumo']), 'Work unit "kumo" not found');
    assert.match(refused(['brief', 'sweep', UNIT, 'note-model']), /^Usage: /);
    assert.strictEqual(fs.existsSync(path.join(conversationDir(SESSION_ID), BRIEFS)), false);
  });
});

describe('the sweep\'s report, taken in whole (8.10.5)', () => {
  it('refuses a report that does not read, naming every fault: another shape, a part missing or not a list, an item missing a field or holding another, an empty text, a message opening on a blank line', () => {
    writeState(dir, REPORT, JSON.stringify({
      candidates: [{ name: 'backups', reason: '' }, 'export'],
      messages: [{ topic: 'note-model', text: '\nNo title.', slug: 'x' }],
      builder_calls: {},
      extra: true,
    }));

    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), [
      `render approve-map: the sweep's report, ${statePath(dir, REPORT)}, does not read —`,
      'it holds extra, which the report has not — it is {candidates, messages, builder_calls}',
      'candidate 1 has no brief',
      'candidate 1\'s reason is a non-empty string',
      'candidate 2 is {name, reason, brief, from_roadmap?}',
      'message 1 holds slug, which a message has not — it is {topic, text}',
      'message 1\'s text opens on a blank line — a message\'s first line is its title',
      'builder_calls is a list',
    ].join('\n'));
    writeState(dir, REPORT, '{');
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), `render approve-map: the sweep's report, ${statePath(dir, REPORT)}, is not JSON`);
  });

  it('refuses a message to a topic that is not live — set aside or none of the unit\'s — naming each', () => {
    report({ messages: [{ topic: 'widgets', text: 'Widgets\n\nMore.' }, { topic: 'Note Model', text: 'Title\n\nBody.' }, { topic: 'sharing', text: 'Sharing\n\nBody.' }] });

    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), [
      'render approve-map: the sweep\'s messages do not hold —',
      'message 1 goes to "widgets", which is postponed — a message goes to a live topic',
      'message 2: no topic "Note Model" — the map\'s topics are note-model, storage-and-sync',
      'message 3: no topic "sharing" — the map\'s topics are note-model, storage-and-sync',
    ].join('\n'));
  });

  it('refuses a candidate as add-batch refuses one: a name that is no topic\'s, one on the map, one struck from it, the twin of a waiting roadmap item it does not take in, and a name twice', () => {
    const refusals = [
      candidate('Backups', 'Why.'), candidate('note-model', 'Why.'), candidate('dock-badge', 'Why.'), candidate('note-sync', 'Why.'),
    ].map((given) => {
      report({ candidates: [given] });
      return refused(['render', 'approve-map', UNIT, '--sweep']);
    });
    report({ candidates: [BACKUPS, BACKUPS] });

    assert.deepStrictEqual([...refusals, refused(['render', 'approve-map', UNIT, '--sweep'])], [
      'render approve-map: the sweep\'s candidates: "Backups" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic\'s folder',
      'render approve-map: the sweep\'s candidates: "note-model" is already on the map — nothing was added; edit it, or pick a different name',
      'render approve-map: the sweep\'s candidates: "dock-badge" was previously dismissed from this map — nothing was added; it is the person\'s answer, so the sweep never proposes it again (8.10.11)',
      'render approve-map: the sweep\'s candidates: "note-sync" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "note-sync", or name the topic apart',
      'render approve-map: the sweep\'s candidates: "backing-up-notes" appears more than once in the batch',
    ]);
  });
});

describe('approve the map after the sweep (8.8.4, 8.10.9, 8.S50)', () => {
  it('draws the map as it stands, every topic ticked, and the candidate below it with its reason — nothing of the messages or the builder\'s calls — staging it and changing nothing else', () => {
    report();
    const before = readManifest(dir, UNIT);
    const out = swept();

    assert.strictEqual(sectionOf(out, 'DISPLAY: approve the map'), [
      'THE MAP (2 topics, every one decided)',
      '  ├─ ✓ 1. Note Model',
      '  └─ ✓ 2. Storage And Sync',
      '',
      'FOUND BY THE SWEEP (1 candidate, yours to take or strike)',
      '  └─ ○ Backing Up Notes',
      '        Storage and sync keeps every note as a file in a folder',
      '        you choose, and no topic decides what happens when that',
      '        folder is lost or restored.',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: approve the map'), [
      '· · · · · · · · · · · ·',
      'Your yes puts the candidate on the map as a topic, and the specification waits until it is decided.',
      '',
      '**`◆ Approve the map?`**',
      '',
      '**`y/yes`**        → Approve it — the candidate becomes a topic',
      '**`s/strike`**     → Strike the candidate — it doesn\'t become a topic',
      '**Keep shaping** → Tell me what to change',
      '',
    ].join('\n'));
    assert.deepStrictEqual([readManifest(dir, UNIT), fs.existsSync(statePath(dir, STAGED))], [before, true]);
    const yes = answer('approve the map', 'y');
    output(dir, ['render', 'approve-map', UNIT], { env: SESSION });
    assert.deepStrictEqual([yes, answer('approve the map', 's')], [
      { kind: 'engine', argv: ['approve-map', 'yes', UNIT] }, { kind: 'engine', argv: ['approve-map', 'strike', UNIT, '1'] },
    ]);
  });

  it('strikes one of several through a pick, marks it struck, and keeps the strike through a restage; unstrike undoes it (P8)', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    swept();
    assert.deepStrictEqual(answer('approve the map', 's'), { kind: 'engine', argv: ['render', 'approve-map-strike', UNIT] });
    const pick = output(dir, ['render', 'approve-map-strike', UNIT], { env: SESSION });
    assert.strictEqual(sectionOf(pick, 'MENU: approve the map strike'), [
      '· · · · · · · · · · · ·',
      '**`◆ Which candidate should not become a topic?`**',
      '',
      '**`1`**      → Backing Up Notes',
      '**`2`**      → Exporting Notes',
      '**`b/back`** → Back to the map — nothing struck',
      '',
    ].join('\n'));

    const struck = run(answer('approve the map strike', '2'));
    assert.deepStrictEqual(struck, { ok: true, unit: UNIT, struck: 'exporting-notes', next: { kind: 'engine', argv: ['render', 'approve-map', UNIT] } });
    const again = swept();
    assert.match(sectionOf(again, 'DISPLAY: approve the map'), /^ {2}└─ ⊘ Exporting Notes +\[struck\]$/m);
    assert.match(sectionOf(again, 'MENU: approve the map'), /^Your yes puts the candidate on the map as a topic/m);
    assert.deepStrictEqual(ok(dir, ['approve-map', 'unstrike', UNIT, '2']).unstruck, 'exporting-notes');
    assert.match(sectionOf(output(dir, ['render', 'approve-map', UNIT], { env: SESSION }), 'MENU: approve the map'), /^Your yes puts the two candidates on the map as topics, and the specification waits until they are decided\.$/m);
  });

  it('the yes lands the candidate standing as a topic with its brief, after the map\'s topics, its reason its summary and its source the sweep, and the struck one as the person\'s answer — then the epic\'s menu, the map no longer every one decided', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    swept();
    ok(dir, ['approve-map', 'strike', UNIT, '2']);
    const res = run(answer('approve the map', 'y'));
    const { discovery } = readManifest(dir, UNIT).phases;

    assert.deepStrictEqual(res, {
      ok: true,
      unit: UNIT,
      topics: ['note-model', 'storage-and-sync', 'backing-up-notes'],
      added: [{ name: 'backing-up-notes', brief: statePath(dir, layout.topic(UNIT, 'backing-up-notes', 'brief.md')) }],
      parked: [],
      bound: [],
      candidates: ['backing-up-notes'],
      struck: ['exporting-notes'],
      session_closed: null,
      committed: res.committed,
      next: { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] },
    });
    assert.deepStrictEqual([discovery.items['backing-up-notes'], discovery.dismissed], [{ source: 'sweep', summary: BACKUPS.reason, order: 3 }, ['dock-badge', 'exporting-notes']]);
    assert.strictEqual(readState(dir, layout.topic(UNIT, 'backing-up-notes', 'brief.md')), `${BACKUPS.brief}\n`);
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD').sort()], [`discovery(${UNIT}): approve the map`, [`A\t${layout.topic(UNIT, 'backing-up-notes', 'brief.md')}`, `M\t${layout.manifest(UNIT)}`]]);
    assert.deepStrictEqual([fs.existsSync(statePath(dir, STAGED)), fs.existsSync(statePath(dir, REPORT))], [false, true], 'the report stays for the spec\'s writer');
  });

  it('the yes lands a candidate taking in a waiting roadmap item joined to it, its source the sweep and the item, the item leaving the waiting roadmap (8.1.6)', () => {
    report({ candidates: [{ ...candidate('note-sync', 'No topic decides how notes reach another Mac.'), from_roadmap: 'note-sync' }] });
    swept();
    const res = ok(dir, ['approve-map', 'yes', UNIT]);

    assert.deepStrictEqual([res.candidates, readManifest(dir, UNIT).phases.discovery.items['note-sync'].source, readManifest(dir, '.').roadmap.items['note-sync'].pulled_to],
      [['note-sync'], 'sweep,roadmap:note-sync', { work_unit: UNIT, topic: 'note-sync' }]);
  });

  it('the yes with every candidate struck adds nothing, and the spec carries on', () => {
    report();
    swept();
    run(answer('approve the map', 's'));
    assert.match(sectionOf(swept(), 'MENU: approve the map'), /^Your yes leaves the map as it is\.\n[\s\S]*→ Approve it — no candidate becomes a topic$/m);
    const res = ok(dir, ['approve-map', 'yes', UNIT]);

    assert.deepStrictEqual([res.candidates, res.struck, res.next, readManifest(dir, UNIT).phases.discovery.dismissed], [[], ['backing-up-notes'], { kind: 'continue' }, ['dock-badge', 'backing-up-notes']]);
  });

  it('a topic a message from the spec reopened stands undecided on the screen, and the yes then goes to the epic\'s menu (10.2.7, P10)', () => {
    report();
    const sent = ok(dir, ['topic', 'send', UNIT, 'note-model', '--from', `${UNIT}.specification`, '--content', scratch('A title is required\n\nStorage names each file by its title.\n'), '--slug', 'title-required']);
    assert.strictEqual(sent.reopened, true);
    assert.match(fs.readFileSync(sent.message_path, 'utf8'), /^A title is required\nFrom Specification · /);
    const out = sectionOf(swept(), 'DISPLAY: approve the map');
    assert.match(out, /^THE MAP \(2 topics, 1 decided\)\n {2}├─ ◐ 1\. Note Model\n {2}└─ ✓ 2\. Storage And Sync$/m);
    ok(dir, ['approve-map', 'strike', UNIT, '1']);

    assert.deepStrictEqual(ok(dir, ['approve-map', 'yes', UNIT]).next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] });
  });

  it('checks the candidates standing again at the yes: one a waiting roadmap item of its name now stands beside refuses, writing nothing; struck, it lands nothing and refuses nothing', () => {
    report();
    swept();
    ok(dir, ['roadmap', 'add', 'backing-up-notes', '--horizon', 'later', '--summary', 'Backups']);

    assert.strictEqual(refused(['approve-map', 'yes', UNIT]), 'approve-map yes: the sweep\'s candidates: "backing-up-notes" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "backing-up-notes", or name the topic apart');
    ok(dir, ['approve-map', 'strike', UNIT, '1']);
    assert.deepStrictEqual(ok(dir, ['approve-map', 'yes', UNIT]).struck, ['backing-up-notes']);
  });
});

describe('approve the map after the sweep, refused — nothing written', () => {
  it('refuses a unit with no sweep report, one whose report holds no candidate, and --file beside --sweep', () => {
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), `render approve-map: ${UNIT} has no sweep report — the sweep writes it, briefed by engine brief sweep ${UNIT}`);
    report({ candidates: [] });
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), 'render approve-map: the sweep found no candidate holding the person\'s call — nothing comes to the map, so there is nothing to approve');
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep', '--file', scratch('{}', 'json')]), 'render approve-map: --file stages Claude\'s map and --sweep the map after the sweep — one or the other');
  });

  it('keeps the map closed once spec.md is written: the after-sweep map refuses, its candidates landing nowhere (P3)', () => {
    report();
    writeState(dir, layout.unit(UNIT, 'spec.md'), '# Fumi\n');

    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), `render approve-map: ${UNIT} has its spec, so its map is closed — talk about it belongs in the product's conversation, where what comes of it lands as roadmap items: engine enter discovery product`);
  });

  it('refuses a strike with nothing staged, with no candidate staged, of a number there is not, and twice; and the pick with fewer than two standing', () => {
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '1']), `approve-map strike: nothing is staged for ${UNIT} — render approve-map ${UNIT} --file <payload.json> stages the map`);
    report();
    swept();
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '2']), 'approve-map strike: there is no candidate 2 — the candidates are 1 to 1');
    assert.strictEqual(refused(['approve-map', 'unstrike', UNIT, '1']), 'approve-map unstrike: "backing-up-notes" is not struck');
    assert.strictEqual(refused(['render', 'approve-map-strike', UNIT]), 'render approve-map-strike: the pick is for more than one candidate standing — the screen strikes a lone one itself');
    writeState(dir, STAGED, JSON.stringify({ topics: [{ name: 'note-model' }, { name: 'storage-and-sync' }], parks: [], binds: [] }));
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '1']), `approve-map strike: no candidate of the sweep's is staged for ${UNIT} — render approve-map ${UNIT} --sweep stages them`);
    assert.match(refused(['approve-map', 'strike', UNIT]), /^Usage: engine approve-map yes <work-unit> \| engine approve-map strike <work-unit> <n> \| engine approve-map unstrike <work-unit> <n>$/);
  });
});
