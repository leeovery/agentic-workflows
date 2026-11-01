'use strict';

// ---------------------------------------------------------------------------
// The sweep before the spec (leeway-engine/scripts/domain/sweep.cjs, its
// take domain/sweep-take.cjs, its brief's records in
// domain/brief-records.cjs, the map after it in domain/approve-map.cjs):
// `brief sweep <unit>`, the sweep's own named agent briefed for the unit
// with every live topic's entries and the unit's own, a "don't care"
// decision marked, the product record, the names struck, the refusal and
// where its report goes (8.S43, 26.5.1); `sweep take <unit>`, its report
// read whole and held to the unit before anything goes — a report of
// another shape, a message to a topic that is not live, a candidate as
// add-batch refuses one — that refusal carried into the next brief; its
// messages sent from the unit's spec, reopening the topics they reach and
// never sent twice, the sweep taken recorded and committed, its candidates
// staged, and what comes next: approve the map, the epic's menu, or the spec
// carrying on (8.10.3, 8.10.5, P10); refused past the spec (P3) and once
// taken; `render approve-map <unit> --sweep`, the map as it stands with
// every topic ticked and the candidates below it, each with its reason, and
// nothing of the messages or the builder's calls (8.8.4, 8.S50); the strike,
// at once for one candidate and through a pick for several (P8), and its
// undoing; Claude's map restaged after the take keeping the candidates; the
// yes landing the candidates standing as topics with their briefs and the
// struck names as the person's answer; the sweep's step held until approve
// the map answers every candidate — sweep-run open, the entry naming it, the
// land and the writer's brief refused naming it, as is the sweep's brief once
// taken — through a resume that lost the staged map; each refusal writing
// nothing.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its topics
// `note-model` and `storage-and-sync` decided, each with a question and its
// decision written through the ledger's verbs — storage's decision over two
// lines, a "don't care" decision of Claude's on note-model — `widgets`
// postponed, `dock-badge` struck from the map, and a finding at its
// discovery; a feature, `billing`, whose decision `fumi` replaced at its
// spec; the roadmap holding a waiting idea, `note-sync`.
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
const { builderCalls } = require(path.join(SCRIPTS, 'domain/sweep.cjs'));

const UNIT = 'fumi';
const SESSION_ID = SESSION.CLAUDE_CODE_SESSION_ID;
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const REPORT = layout.cache(UNIT, 'specification', 'sweep.json');
const TAKEN = layout.unit(UNIT, 'sweep-taken.json');
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
  const decide = (/** @type {string} */ topic, /** @type {string} */ question, /** @type {string} */ text, unit = UNIT, by = PERSON) => write('decide', `${unit}.discussion.${topic}`, ['--answers', question], { ...by, text, why: 'Because.' }).id;
  made.kind = ask('note-model', 'What is a note?');
  made.text = decide('note-model', made.kind, 'Plain text with a title.');
  made.font = ask('note-model', 'Which font does a note show?');
  made.system = decide('note-model', made.font, 'The system font.', UNIT, { ...MADE, given: 'dont-care' });
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
const TITLE_REQUIRED = Object.freeze({ topic: 'note-model', text: 'A title is required\n\nStorage names each file by its title.' });
const CALLS = Object.freeze([{ call: 'The file extension', why: 'The person would leave it.' }]);

/** The sweep's report written, its parts as given: one candidate, no message, by default. @param {Record<string, unknown>} [parts] */
function report(parts = {}) {
  writeState(dir, REPORT, JSON.stringify({ candidates: [BACKUPS], messages: [], builder_calls: CALLS, ...parts }));
}

/** The sweep taken: its answer. */
const take = () => ok(dir, ['sweep', 'take', UNIT], { env: SESSION });

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

/** The map after the sweep, staged from the sweep taken and drawn. */
const swept = () => output(dir, ['render', 'approve-map', UNIT, '--sweep'], { env: SESSION });

/** The refusal of `args`, nothing written or committed. @param {string[]} args */
const refused = (args) => refusedPristine(dir, args, { env: SESSION }).error;

/** The messages waiting in a topic's mailbox, by name. @param {string} topic */
const mailOf = (topic) => {
  const folder = statePath(dir, UNIT, 'topics', topic, 'mail');
  return fs.existsSync(folder) ? fs.readdirSync(folder).sort() : [];
};

describe('the sweep\'s brief (8.10.8, 8.S43, 26.5.1)', () => {
  it('names its agent, and fills its template for the unit: every live topic\'s entries under its title, a "don\'t care" decision marked, then the unit\'s own and what was made here on another unit\'s place, each by short id and kind, the product record, the names struck, no refusal, and where the report goes', () => {
    const { res, text } = briefed();

    assert.deepStrictEqual([res.role, res.agent, res.pointer], ['sweep', 'leeway-sweep', `brief:${res.id}`]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'sweep', agent: 'leeway-sweep', unit: UNIT, task: null, topic: null });
    assert.strictEqual(text.split('\n')[0], `Brief ${res.id} — the sweep's, for ${UNIT}`);
    assert.strictEqual(part(text, 'This work\'s records'), [
      '## Note Model (note-model)', '',
      `- ${made.kind} question: What is a note?`,
      `- ${made.text} decision: Plain text with a title.`,
      `- ${made.font} question: Which font does a note show?`,
      `- ${made.system} decision, don't care: The system font.`, '',
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

  it('carries what the take refuses of the last report into the next brief, as the take says it', () => {
    report({ candidates: [candidate('dock-badge', 'A badge on the dock.')] });
    const refusal = refused(['sweep', 'take', UNIT]).replace(/^sweep take: /, '');

    assert.strictEqual(part(briefed().text, 'The refusal'), refusal);
  });

  it('refuses a unit the project lacks, and a topic named, storing nothing', () => {
    assert.strictEqual(refused(['brief', 'sweep', 'kumo']), 'Work unit "kumo" not found');
    assert.match(refused(['brief', 'sweep', UNIT, 'note-model']), /^Usage: /);
    assert.strictEqual(fs.existsSync(path.join(conversationDir(SESSION_ID), BRIEFS)), false);
  });
});

describe('the builder\'s calls, for the spec\'s writer', () => {
  it('reads the calls the sweep left to the builder from its report alone, and none where no report is written', () => {
    const before = builderCalls(dir, UNIT);
    report({ messages: [TITLE_REQUIRED] });

    assert.deepStrictEqual([before, builderCalls(dir, UNIT)], [[], CALLS]);
  });
});

describe('sweep take: the report held to the unit before anything goes (8.10.5)', () => {
  it('refuses a report that does not read, naming every fault: another shape, a part missing or not a list, an item missing a field or holding another, an empty text, a message opening on a blank line', () => {
    writeState(dir, REPORT, JSON.stringify({
      candidates: [{ name: 'backups', reason: '' }, 'export'],
      messages: [{ topic: 'note-model', text: '\nNo title.', slug: 'x' }],
      builder_calls: {},
      extra: true,
    }));

    assert.strictEqual(refused(['sweep', 'take', UNIT]), [
      `sweep take: the sweep's report, ${statePath(dir, REPORT)}, does not read —`,
      'it holds extra, which the report has not — it is {candidates, messages, builder_calls}',
      'candidate 1 has no brief',
      'candidate 1\'s reason is a non-empty string',
      'candidate 2 is {name, reason, brief, from_roadmap?}',
      'message 1 holds slug, which a message has not — it is {topic, text, sent?}',
      'message 1\'s text opens on a blank line — a message\'s first line is its title',
      'builder_calls is a list',
    ].join('\n'));
    writeState(dir, REPORT, '{');
    assert.strictEqual(refused(['sweep', 'take', UNIT]), `sweep take: the sweep's report, ${statePath(dir, REPORT)}, is not JSON`);
  });

  it('refuses a message to a topic that is not live — postponed, or none of the unit\'s — naming each, before any message is sent', () => {
    report({ messages: [TITLE_REQUIRED, { topic: 'widgets', text: 'Widgets\n\nMore.' }, { topic: 'Note Model', text: 'Title\n\nBody.' }, { topic: 'sharing', text: 'Sharing\n\nBody.' }] });

    assert.strictEqual(refused(['sweep', 'take', UNIT]), [
      'sweep take: the sweep\'s messages do not hold —',
      'message 2 goes to "widgets", which is postponed — a message goes to a live topic',
      'message 3: no topic "Note Model" — the map\'s topics are note-model, storage-and-sync',
      'message 4: no topic "sharing" — the map\'s topics are note-model, storage-and-sync',
    ].join('\n'));
    assert.deepStrictEqual(mailOf('note-model'), []);
  });

  it('refuses a candidate as add-batch refuses one: a name that is no topic\'s, one on the map, one struck from it, the twin of a waiting roadmap item it does not take in, and a name twice', () => {
    const refusals = [
      candidate('Backups', 'Why.'), candidate('note-model', 'Why.'), candidate('dock-badge', 'Why.'), candidate('note-sync', 'Why.'),
    ].map((given) => {
      report({ candidates: [given] });
      return refused(['sweep', 'take', UNIT]);
    });
    report({ candidates: [BACKUPS, BACKUPS] });

    assert.deepStrictEqual([...refusals, refused(['sweep', 'take', UNIT])], [
      'sweep take: the sweep\'s candidates: "Backups" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic\'s folder',
      'sweep take: the sweep\'s candidates: "note-model" is already on the map — nothing was added; edit it, or pick a different name',
      'sweep take: the sweep\'s candidates: "dock-badge" was previously dismissed from this map — nothing was added; it is the person\'s answer, so the sweep never proposes it again (8.10.11)',
      'sweep take: the sweep\'s candidates: "note-sync" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "note-sync", or name the topic apart',
      'sweep take: the sweep\'s candidates: "backing-up-notes" appears more than once in the batch',
    ]);
  });
});

describe('sweep take: what it sends, records and stages, and where it goes next (8.10.3, 8.10.9, P10)', () => {
  it('takes the empty sweep: records it taken, committed, and the spec carries on', () => {
    report({ candidates: [], builder_calls: [] });
    const res = take();

    assert.deepStrictEqual(res, { ok: true, unit: UNIT, sent: [], reopened: [], candidates: [], committed: res.committed, next: { kind: 'continue' } });
    assert.deepStrictEqual(JSON.parse(readState(dir, TAKEN)), { taken: JSON.parse(readState(dir, TAKEN)).taken, messages: [], candidates: [] });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], [`sweep(${UNIT}): taken`, [`A\t${TAKEN}`]]);
    assert.strictEqual(fs.existsSync(statePath(dir, STAGED)), false);
  });

  it('sends each message from the unit\'s spec, reopening the decided topic it reaches, marks it sent in the report and records it — then the epic\'s menu, a topic no longer decided', () => {
    report({ candidates: [], messages: [TITLE_REQUIRED] });
    const res = take();
    const message = layout.unit(UNIT, 'topics', 'note-model', 'mail', '001-a-title-is-required.md');

    assert.deepStrictEqual(res, {
      ok: true, unit: UNIT, sent: [{ topic: 'note-model', message: statePath(dir, message) }], reopened: ['note-model'], candidates: [], committed: res.committed,
      next: { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] },
    });
    assert.match(readState(dir, message), /^A title is required\nFrom Specification · .*\n\nStorage names each file by its title\.\n$/);
    assert.deepStrictEqual([JSON.parse(readState(dir, REPORT)).messages, JSON.parse(readState(dir, TAKEN)).messages], [[{ ...TITLE_REQUIRED, sent: message }], [{ topic: 'note-model', message }]]);
    assert.strictEqual(readManifest(dir, UNIT).phases.discussion.items['note-model'].status, 'in-progress');
  });

  it('stages the candidates, recorded whole, and goes on to approve the map', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    const res = take();

    assert.deepStrictEqual([res.candidates, res.next], [['backing-up-notes', 'exporting-notes'], { kind: 'engine', argv: ['render', 'approve-map', UNIT, '--sweep'] }]);
    assert.deepStrictEqual(JSON.parse(readState(dir, TAKEN)).candidates, [BACKUPS, EXPORT]);
    assert.deepStrictEqual(JSON.parse(readState(dir, STAGED)).candidates, [{ ...BACKUPS, struck: false }, { ...EXPORT, struck: false }]);
  });

  it('never sends a message twice: one marked sent by a take killed part-way is passed over, and once taken the sweep is refused, sending nothing', () => {
    const marked = layout.unit(UNIT, 'topics', 'note-model', 'mail', '001-sent-before.md');
    report({ candidates: [], messages: [{ ...TITLE_REQUIRED, sent: marked }, { topic: 'storage-and-sync', text: 'Titles name files\n\nBody.' }] });
    const res = take();

    assert.deepStrictEqual([res.sent.map(({ topic }) => topic), mailOf('note-model'), mailOf('storage-and-sync')], [['storage-and-sync'], [], ['001-titles-name-files.md']]);
    assert.strictEqual(refused(['sweep', 'take', UNIT]), `sweep take: ${UNIT}'s sweep is taken already — one sweep for the spec (8.10.3)`);
  });

  it('refuses past the spec, whose map is closed (P3); with no report; before every live topic is decided; and for one live topic alone — sending nothing', () => {
    report({ messages: [TITLE_REQUIRED] });
    writeState(dir, layout.unit(UNIT, 'spec.md'), '# Fumi\n');
    const pastSpec = refused(['sweep', 'take', UNIT]);
    fs.rmSync(statePath(dir, layout.unit(UNIT, 'spec.md')));
    fs.rmSync(statePath(dir, REPORT));
    const unwritten = refused(['sweep', 'take', UNIT]);
    report({ messages: [TITLE_REQUIRED] });
    ok(dir, ['manifest', 'set', `${UNIT}.discussion.note-model`, 'status', 'in-progress']);
    const undecided = refused(['sweep', 'take', UNIT]);
    ok(dir, ['topic', 'postpone', UNIT, 'note-model', '--horizon', 'next']);
    const alone = refused(['sweep', 'take', UNIT]);

    assert.deepStrictEqual([pastSpec, unwritten, undecided, alone, refused(['sweep', 'run', UNIT])], [
      `sweep take: ${UNIT} has its spec, so its map is closed — the sweep runs before the spec is written, and what it would find now is settled in the spec`,
      `sweep take: ${UNIT} has no sweep report — the sweep writes it, briefed by engine brief sweep ${UNIT}`,
      `sweep take: ${UNIT}'s live topics are not every one decided — the sweep reads them once they are (8.10.3)`,
      `sweep take: ${UNIT} has one live topic — a sweep reads between topics, so there is none to take`,
      'Usage: engine sweep take <work-unit>',
    ]);
    assert.deepStrictEqual(mailOf('note-model'), []);
  });
});

describe('approve the map after the sweep (8.8.4, 8.10.9, 8.S50)', () => {
  it('draws the map as it stands, every topic ticked, and the candidate below it with its reason — nothing of the messages or the builder\'s calls — staging it and changing nothing else', () => {
    report();
    take();
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

  it('draws a topic a message from the spec reopened undecided, and the yes then goes to the epic\'s menu (10.2.7, P10)', () => {
    report({ messages: [TITLE_REQUIRED] });
    take();
    assert.match(sectionOf(swept(), 'DISPLAY: approve the map'), /^THE MAP \(2 topics, 1 decided\)\n {2}├─ ◐ 1\. Note Model\n {2}└─ ✓ 2\. Storage And Sync$/m);
    ok(dir, ['approve-map', 'strike', UNIT, '1']);

    assert.deepStrictEqual(ok(dir, ['approve-map', 'yes', UNIT]).next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT] });
  });

  it('strikes one of several through a pick, marks it struck, and keeps the strike through a restage; unstrike undoes it (P8)', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    take();
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

  it('keeps the candidates and their strikes when Keep shaping restages Claude\'s map, and refuses a topic of it named as a candidate', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    take();
    ok(dir, ['approve-map', 'strike', UNIT, '2']);
    const map = { topics: [{ name: 'storage-and-sync' }, { name: 'note-model' }] };
    const out = output(dir, ['render', 'approve-map', UNIT, '--file', scratch(JSON.stringify(map), 'json')], { env: SESSION });

    assert.match(sectionOf(out, 'DISPLAY: approve the map'), /^ {2}├─ ✓ 1\. Storage And Sync\n {2}└─ ✓ 2\. Note Model\n\nFOUND BY THE SWEEP \(2 candidates, yours to take or strike\)\n {2}├─ ○ Backing Up Notes\n[\s\S]* {2}└─ ⊘ Exporting Notes +\[struck\]$/m);
    assert.deepStrictEqual(JSON.parse(readState(dir, STAGED)).candidates, [{ ...BACKUPS, struck: false }, { ...EXPORT, struck: true }]);
    const clash = { topics: [...map.topics, { name: 'exporting-notes', summary: 'Export', brief: scratch('# Export\n') }] };
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--file', scratch(JSON.stringify(clash), 'json')]), 'render approve-map: "exporting-notes" is staged as a candidate of the sweep\'s — name the topic apart');
  });

  it('the yes lands the candidate standing as a topic with its brief, after the map\'s topics, its reason its summary and its source the sweep, and the struck one as the person\'s answer — then the epic\'s menu, the map no longer every one decided', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    take();
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

  it('the yes joins a candidate taking in a waiting roadmap item to it, its source the sweep and the item, the item leaving the waiting roadmap (8.1.6)', () => {
    report({ candidates: [{ ...candidate('note-sync', 'No topic decides how notes reach another Mac.'), from_roadmap: 'note-sync' }] });
    take();
    const res = ok(dir, ['approve-map', 'yes', UNIT]);

    assert.deepStrictEqual([res.candidates, readManifest(dir, UNIT).phases.discovery.items['note-sync'].source, readManifest(dir, '.').roadmap.items['note-sync'].pulled_to],
      [['note-sync'], 'sweep,roadmap:note-sync', { work_unit: UNIT, topic: 'note-sync' }]);
  });

  it('the yes leaves the roadmap item a struck candidate would take in waiting, its name the person\'s answer', () => {
    report({ candidates: [{ ...candidate('note-sync', 'No topic decides how notes reach another Mac.'), from_roadmap: 'note-sync' }] });
    take();
    ok(dir, ['approve-map', 'strike', UNIT, '1']);
    ok(dir, ['approve-map', 'yes', UNIT]);
    const { discovery } = readManifest(dir, UNIT).phases;

    assert.deepStrictEqual([readManifest(dir, '.').roadmap.items['note-sync'].pulled_to, discovery.items['note-sync'], discovery.dismissed], [undefined, undefined, ['dock-badge', 'note-sync']]);
  });

  it('the yes with every candidate struck adds nothing, and the spec carries on', () => {
    report();
    take();
    swept();
    run(answer('approve the map', 's'));
    assert.match(sectionOf(swept(), 'MENU: approve the map'), /^Your yes leaves the map as it is\.\n[\s\S]*→ Approve it — no candidate becomes a topic$/m);
    const res = ok(dir, ['approve-map', 'yes', UNIT]);

    assert.deepStrictEqual([res.candidates, res.struck, res.next, readManifest(dir, UNIT).phases.discovery.dismissed], [[], ['backing-up-notes'], { kind: 'continue' }, ['dock-badge', 'backing-up-notes']]);
  });

  it('checks the candidates standing again at the yes: one a waiting roadmap item of its name now stands beside refuses, writing nothing; struck, it lands nothing and refuses nothing', () => {
    report();
    take();
    ok(dir, ['roadmap', 'add', 'backing-up-notes', '--horizon', 'later', '--summary', 'Backups']);

    assert.strictEqual(refused(['approve-map', 'yes', UNIT]), 'approve-map yes: the sweep\'s candidates: "backing-up-notes" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "backing-up-notes", or name the topic apart');
    ok(dir, ['approve-map', 'strike', UNIT, '1']);
    assert.deepStrictEqual(ok(dir, ['approve-map', 'yes', UNIT]).struck, ['backing-up-notes']);
  });
});

describe('the sweep\'s step, held until approve the map answers its candidates (8.10.9)', () => {
  it('resumed with the candidates unanswered and the staged map gone with the cache: sweep-run open, the entry naming approve the map, the land and the writer\'s and the sweep\'s briefs refused naming it; drawn again from the record, its yes striking both lets the spec on', () => {
    report({ candidates: [BACKUPS, EXPORT] });
    take();
    fs.rmSync(statePath(dir, layout.cache(UNIT)), { recursive: true, force: true });
    const sweepRun = () => JSON.parse(output(dir, ['checklist', 'show', 'ready-to-build', UNIT], { env: SESSION })).items.find((/** @type {{key: string}} */ item) => item.key === 'sweep-run').state;
    const entered = () => output(dir, ['enter', 'specification', UNIT], { env: SESSION });
    const approve = `${UNIT}'s sweep found calls waiting on the person — backing-up-notes, exporting-notes — taken or struck at approve the map: engine render approve-map ${UNIT} --sweep`;
    const taken = `brief: ${UNIT}'s sweep is taken already — one sweep for the spec (8.10.3)`;

    assert.strictEqual(sweepRun(), 'open');
    assert.ok(entered().includes(`approve the map: \`node .claude/skills/leeway-engine/scripts/engine.cjs render approve-map ${UNIT} --sweep\``));
    assert.deepStrictEqual([refused(['spec', 'land', UNIT]), refused(['brief', 'spec-writer', UNIT]), refused(['brief', 'sweep', UNIT])], [`spec land: ${approve}`, `brief: ${approve}`, `${taken}; ${approve}`]);

    swept();
    for (const n of ['1', '2']) ok(dir, ['approve-map', 'strike', UNIT, n]);
    ok(dir, ['approve-map', 'yes', UNIT]);

    assert.strictEqual(sweepRun(), 'done');
    assert.ok(!entered().includes('approve the map'));
    assert.deepStrictEqual([refused(['brief', 'sweep', UNIT]), ok(dir, ['brief', 'spec-writer', UNIT], { env: SESSION }).role], [taken, 'spec-writer']);
  });
});

describe('approve the map after the sweep, refused — nothing written', () => {
  it('refuses a sweep not taken, one that found no candidate, and --file beside --sweep', () => {
    report();
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), `render approve-map: ${UNIT}'s sweep is not taken — engine sweep take ${UNIT} takes its report in`);
    report({ candidates: [] });
    take();
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), 'render approve-map: the sweep found no candidate holding the person\'s call — nothing comes to the map, so there is nothing to approve');
    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep', '--file', scratch('{}', 'json')]), 'render approve-map: --file stages Claude\'s map and --sweep the map after the sweep — one or the other');
  });

  it('keeps the map closed once spec.md is written: the after-sweep map refuses, its candidates landing nowhere (P3)', () => {
    report();
    take();
    writeState(dir, layout.unit(UNIT, 'spec.md'), '# Fumi\n');

    assert.strictEqual(refused(['render', 'approve-map', UNIT, '--sweep']), `render approve-map: ${UNIT} has its spec, so its map is closed — talk about it belongs in the product's conversation, where what comes of it lands as roadmap items: engine enter discovery product`);
  });

  it('refuses a strike with nothing staged, with no candidate staged, of a number there is not, and twice; and the pick with fewer than two standing', () => {
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '1']), `approve-map strike: nothing is staged for ${UNIT} — engine sweep take ${UNIT} stages the sweep's candidates`);
    report();
    take();
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '2']), 'approve-map strike: there is no candidate 2 — the candidates are 1 to 1');
    assert.strictEqual(refused(['approve-map', 'unstrike', UNIT, '1']), 'approve-map unstrike: "backing-up-notes" is not struck');
    assert.strictEqual(refused(['render', 'approve-map-strike', UNIT]), 'render approve-map-strike: the pick is for more than one candidate standing — the screen strikes a lone one itself');
    writeState(dir, STAGED, JSON.stringify({ topics: [{ name: 'note-model' }, { name: 'storage-and-sync' }], parks: [], binds: [] }));
    assert.strictEqual(refused(['approve-map', 'strike', UNIT, '1']), `approve-map strike: no candidate of the sweep's is staged for ${UNIT} — render approve-map ${UNIT} --sweep stages them`);
    assert.match(refused(['approve-map', 'strike', UNIT]), /^Usage: engine approve-map yes <work-unit> \| engine approve-map strike <work-unit> <n> \| engine approve-map unstrike <work-unit> <n>$/);
  });
});
