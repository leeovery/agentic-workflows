'use strict';

// ---------------------------------------------------------------------------
// The record of the person (leeway-engine/scripts/domain/person.cjs, its
// verbs domain/person-verbs.cjs, its screens domain/projections/person.cjs
// and domain/projections/care.cjs): `person.md` in the system config
// directory, laid out as P5 says, refused loudly where it does not read and
// gone with its last entry (4.S27, 16.18.5, 16.18.8); Claude's proposal,
// `person propose [--drop]`, drawn and held in the conversation, steering
// nothing until the person's yes, `person keep` or `person drop` (16.18.2,
// 16.18.3, 16.S54); the care entries' screens, `render care`, `render
// care-kind` and `render care-drop`, and the person's own picks on them,
// `person keep|drop --care <kind>` (16.5.6); the care entries keyed by the
// project's id and shown by its name, feeding the decision point's rule in
// their project alone (16.5.2, 16.5.3, 16.S18); the run of "don't care"
// answers that cues the drop, and the bound a dropped kind takes from the
// answers given while it stood (16.5.4, 16.5.5, 16.S19, P6); one record
// across the person's projects, empty for a new user (16.S55); and no verb
// reading another project's state (16.S56).
//
// Layer: verb. World: trust-world.cjs's — each test's folder, its config
// folder holding the trust log, the record and the conversation, and its
// projects plain folders whose state roots are pinned, the engine run in
// process through the harness.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, output, refuses, screenOf, statePath, withFrozenClock, FROZEN_MS } = require('./engine-harness.cjs');
const { filesUnder } = require('./discovery-test-utils.cjs');
const { idOf, PROJECT_ID, SESSION, MODEL, lines, useTrustWorld, history } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { parseRecord, readRecord, recordToRead, careEntries, dropCue, personPath } = require(path.join(SCRIPTS, 'domain/person.cjs'));
const { droppedLine } = require(path.join(SCRIPTS, 'domain/projections/care.cjs'));
const { ruled } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));

const { folder, logPath, project } = useTrustWorld('engine-person-');

const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const AIRCON = idOf('Aircon');

/** The preference 16.18.3 draws. */
const SHOW_FIRST = Object.freeze({
  preference: 'Show the product before asking for anything',
  why: 'you\'d rather people see what it does before it asks them for a key, a permission or an account.',
  examples: ['Fumi\'s first run: the tour first, then the licence as a wizard step', 'Fumi: sync stays off until you turn it on, so nothing asks for an account up front'],
});

/** The drop of a care entry on look 16.5.6 draws. */
const DROP_LOOK = Object.freeze({
  care: 'look',
  why: 'your look questions in Fumi keep coming back "don\'t care", so look may not need to ask you every time.',
  examples: ['The note window\'s corner radius — don\'t care', 'The menu bar icon\'s weight — don\'t care', 'The colour of a fumi\'s title bar — don\'t care'],
});

/** The record's file in this test's config folder. */
const recordFile = () => path.join(folder(), 'config', 'person.md');

/** The proposal the conversation holds, null where none. */
function held() {
  const file = path.join(folder(), 'config', 'conversations', SESSION, 'person-proposal.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The record's text, null where it has no file. */
const recordText = () => (fs.existsSync(recordFile()) ? fs.readFileSync(recordFile(), 'utf8') : null);

/** A `person` verb that must succeed in the conversation: its response. @param {string} dir @param {string[]} args */
const person = (dir, args) => ok(dir, ['person', ...args], { env: ENV });

/** Claude's proposal, drawn: its response and its screen. @param {string} dir @param {Record<string, unknown>} given @param {string[]} [args] */
const propose = (dir, given, args = []) => okSections(dir, ['person', 'propose', ...args], { env: ENV, stdin: JSON.stringify(given) });

/** A surface drawn in the conversation. @param {string} dir @param {string[]} args */
const render = (dir, args) => output(dir, ['render', ...args], { env: ENV });

/**
 * A `person` verb refused, leaving the record and the proposal held as they
 * were: its error.
 * @param {string} dir @param {string[]} args @param {unknown} [given] @param {Record<string, string|undefined>} [env]
 */
function refusedPerson(dir, args, given, env = ENV) {
  const before = [recordText(), held()];
  const { error } = refuses(dir, ['person', ...args], { env, stdin: given === undefined ? '' : JSON.stringify(given) });
  assert.deepStrictEqual([recordText(), held()], before, `person ${args.join(' ')} refused, yet wrote`);
  return error;
}

/** The log holding `events`. @param {Record<string, unknown>[]} events */
function logHolding(events) {
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  fs.writeFileSync(logPath(), lines(...events));
}

/** A screen as read: its title, then each section's lines. @param {string} out @param {string[]} sections */
const screen = (out, sections) => sections.flatMap((name) => (name === 'TITLE' ? screenOf(out, name).map((line) => line.replace(/^# /, '')) : screenOf(out, name)));

/** A call on look in the project at `dir` named `name`, as the decision point is given it. @param {string} dir @param {string} name */
function lookAt(dir, name) {
  return ruled(/** @type {any} */ ({ sort: 'several' }), {
    label: labelled('look'), place: { unit: 'fumi', phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, always: null, checked: false,
    project: { root: statePath(dir), name }, model: MODEL, now: FROZEN_MS,
  });
}

describe('the record\'s file (P5, 16.18.8, 4.S27)', () => {
  it('4.S27: kept in the system config directory, never under the project\'s state, laid out as P5 says — the title, a section a preference with its Why: and its Examples:, then the care entries, a line each, the project\'s name beside the id that keys it — and read back as written', () => {
    const fumi = project('fumi');
    propose(fumi, SHOW_FIRST);
    person(fumi, ['keep']);
    person(fumi, ['keep', '--care', 'look']);
    person(project('aircon', { project_id: AIRCON }), ['keep', '--care', 'words']);

    assert.strictEqual(personPath(), recordFile());
    assert.strictEqual(recordText(), [
      '# The record of you',
      '',
      '## Show the product before asking for anything',
      '',
      'Why: you\'d rather people see what it does before it asks them for a key, a permission or an account.',
      '',
      'Examples:',
      '- Fumi\'s first run: the tour first, then the licence as a wizard step',
      '- Fumi: sync stays off until you turn it on, so nothing asks for an account up front',
      '',
      '## Care entries',
      '',
      `- Fumi: look · ${PROJECT_ID}`,
      `- Aircon: words · ${AIRCON}`,
      '',
    ].join('\n'));
    assert.deepStrictEqual(readRecord(), {
      preferences: [{ ...SHOW_FIRST }],
      care: [{ project: PROJECT_ID, name: 'Fumi', kind: 'look' }, { project: AIRCON, name: 'Aircon', kind: 'words' }],
    });
    assert.deepStrictEqual(filesUnder(statePath(fumi)).filter((file) => path.basename(file).startsWith('person')), []);
  });

  it('a line wrapped by hand reads joined — a Why: run on, an example run on by its indent — and the next change writes the record back in its layout', () => {
    const fumi = project('fumi');
    fs.mkdirSync(path.dirname(recordFile()), { recursive: true });
    fs.writeFileSync(recordFile(), '# The record of you\n\n## Ask before a migration\n\nWhy: a migration is\nhard to put back.\n\nExamples:\n- The notes table,\n  renamed\n- The sync column\n');

    person(fumi, ['keep', '--care', 'contract']);

    assert.strictEqual(recordText(), `# The record of you\n\n## Ask before a migration\n\nWhy: a migration is hard to put back.\n\nExamples:\n- The notes table, renamed\n- The sync column\n\n## Care entries\n\n- Fumi: contract · ${PROJECT_ID}\n`);
  });

  it('a file that does not read is refused wherever it is read, naming the file and the line, and is never written over: anything but the title before the first section, a preference with no Why: or no examples, a care entry of another shape, naming danger or no project\'s id, and anything held twice', () => {
    const fumi = project('fumi');
    const care = `## Care entries\n\n- Fumi: look · ${PROJECT_ID}\n`;
    /** @type {[string, number, string][]} */
    const broken = [
      ['Notes\n# The record of you\n', 1, 'only the title comes before the first section'],
      ['# The record of you\n\n## Ask first\n\nExamples:\n- A migration\n', 5, '"Ask first" opens on its Why:'],
      ['# The record of you\n\n## Ask first\n\nWhy: it is hard to undo.\n', 3, '"Ask first" gives no Examples:'],
      ['# The record of you\n\n## Ask first\n\nWhy: it is hard to undo.\n\nExamples:\nA migration\n', 8, '"Ask first"\'s examples are a list, a line each beginning "- "'],
      ['# The record of you\n\n## Care entries\n\n- Fumi: look\n', 5, 'a care entry reads "- {project}: {kind} · {project id}"'],
      [`# The record of you\n\n## Care entries\n\n- Fumi: danger · ${PROJECT_ID}\n`, 5, '"danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals'],
      ['# The record of you\n\n## Care entries\n\n- Fumi: look · fumi\n', 5, '"fumi" is no project\'s id'],
      [`# The record of you\n\n${care}\n${care}`, 7, 'the record holds one "Care entries" section'],
      [`# The record of you\n\n## Care entries\n\n- Fumi: look · ${PROJECT_ID}\n- Fumi: look · ${PROJECT_ID}\n`, 6, 'it holds Fumi: look twice'],
      ['# The record of you\n\n## Ask first\n\nWhy: a.\n\nExamples:\n- b\n\n## Ask first\n\nWhy: c.\n\nExamples:\n- d\n', 10, 'it holds "Ask first" twice'],
    ];
    fs.mkdirSync(path.dirname(recordFile()), { recursive: true });
    for (const [text, line, why] of broken) {
      fs.writeFileSync(recordFile(), text);
      const refusal = `the record of the person, ${recordFile()}, does not read at line ${line}: ${why} — it holds its title, a section a preference with its Why: and its Examples:, then a "Care entries" section, each "- {project}: {kind} · {project id}"; put it right by hand, or move it aside to start the record again`;
      assert.throws(() => parseRecord(text, recordFile()), { message: refusal }, why);
      assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'words']), refusal, why);
      assert.strictEqual(refuses(fumi, ['render', 'care'], { env: ENV }).error, refusal, why);
      assert.strictEqual(recordText(), text, why);
    }
  });

  it('goes with its last entry: the record emptied leaves no file, as it shipped (16.18.5)', () => {
    const fumi = project('fumi');
    person(fumi, ['keep', '--care', 'look']);
    assert.ok(fs.existsSync(recordFile()));

    person(fumi, ['drop', '--care', 'look']);

    assert.strictEqual(recordText(), null);
  });
});

describe('Claude\'s proposal and the person\'s yes (16.18.2, 16.18.3, 16.S54)', () => {
  it('16.18.3: the proposal screen states the preference in words with its why and examples, what keeping it would change, and takes the person\'s yes', () => {
    const { res, sections } = propose(project('fumi'), SHOW_FIRST);

    assert.deepStrictEqual(res, { ok: true, proposed: 'keep', entry: SHOW_FIRST.preference });
    assert.deepStrictEqual(screen(sections, ['DISPLAY: record proposal', 'MENU: record proposal']), [
      'FOR THE RECORD OF YOU',
      'Show the product before asking for anything',
      '  ↳ Why: you\'d rather people see what it does before it asks them',
      '    for a key, a permission or an account.',
      '  ↳ Examples:',
      '    · Fumi\'s first run: the tour first, then the licence as a',
      '      wizard step',
      '    · Fumi: sync stays off until you turn it on, so nothing asks',
      '      for an account up front',
      '· · · · · · · · · · · ·',
      'It would shape what I pick in every project, whether I decide or',
      'lean as I ask — never whether I ask.',
      '',
      '◆ Keep it in the record of you?',
      '',
      'y/yes   → Keep it',
      'n/no    → Leave it out — nothing is kept',
      'Comment → Tell me how to word it',
    ]);
  });

  it('16.S54: a proposal steers nothing until the yes — held in the conversation, the record as it was, the rule deciding and the entry reading as before; the yes writes it and lets it go: a preference shapes what Claude picks and leaves whether it asks, a care entry makes its kind ask', () => {
    const fumi = project('fumi');
    const h = history();
    h.agree(13, 'look');
    logHolding(h.events);
    const before = lookAt(fumi, 'Fumi');
    assert.strictEqual(before.decision, 'proceed');

    propose(fumi, SHOW_FIRST);
    assert.deepStrictEqual([recordText(), recordToRead(), held().preference], [null, null, SHOW_FIRST.preference]);
    person(fumi, ['keep']);
    assert.deepStrictEqual([recordToRead(), held(), lookAt(fumi, 'Fumi')], [recordFile(), null, before]);

    propose(fumi, { care: 'look', why: 'Look matters here.', examples: ['The corner radius'] });
    assert.deepStrictEqual([careEntries(), lookAt(fumi, 'Fumi')], [[], before]);
    assert.deepStrictEqual(person(fumi, ['keep']), { ok: true, kept: 'Fumi: look' });
    assert.deepStrictEqual(lookAt(fumi, 'Fumi'), { decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Fumi.' });
  });

  it('16.5.4: the drop of a care entry, proposed on the same screen, drops it on the yes, and the kind follows the counts again', () => {
    const fumi = project('fumi');
    person(fumi, ['keep', '--care', 'look']);

    const { res, sections } = propose(fumi, DROP_LOOK, ['--drop']);

    assert.deepStrictEqual(res, { ok: true, proposed: 'drop', entry: 'Fumi: look' });
    assert.deepStrictEqual(screen(sections, ['DISPLAY: record drop', 'MENU: record drop']), [
      'FOR THE RECORD OF YOU',
      'Drop the care entry "Fumi: look"',
      '  ↳ Why: your look questions in Fumi keep coming back "don\'t',
      '    care", so look may not need to ask you every time.',
      '  ↳ Examples:',
      '    · The note window\'s corner radius — don\'t care',
      '    · The menu bar icon\'s weight — don\'t care',
      '    · The colour of a fumi\'s title bar — don\'t care',
      '· · · · · · · · · · · ·',
      'Dropped, look follows the counts, which kept counting while the',
      'entry stood: it asks you as any kind does, by its rate.',
      '',
      '◆ Drop it from the record of you?',
      '',
      'y/yes   → Drop it',
      'n/no    → Keep it — look keeps asking you every time',
      'Comment → Tell me why it should stay',
    ]);
    assert.deepStrictEqual([person(fumi, ['drop']), careEntries(), held()], [{ ok: true, dropped: 'Fumi: look' }, [], null]);
  });

  it('a preference proposed for dropping is dropped on the yes; a proposal answered no is replaced by the next, and only the yes reads it', () => {
    const fumi = project('fumi');
    propose(fumi, SHOW_FIRST);
    person(fumi, ['keep']);
    propose(fumi, { ...SHOW_FIRST, why: 'You let the tour run long.', examples: ['The tour asked for an account'] }, ['--drop']);
    propose(fumi, { care: 'words', why: 'Words matter here.', examples: ['The menu labels'] });

    assert.strictEqual(refusedPerson(fumi, ['drop']), 'person drop: the proposal held keeps "Fumi: words" — its yes is person keep');
    person(fumi, ['keep']);

    assert.deepStrictEqual(readRecord(), { preferences: [{ ...SHOW_FIRST }], care: [{ project: PROJECT_ID, name: 'Fumi', kind: 'words' }] });
    propose(fumi, { ...SHOW_FIRST, why: 'You let the tour run long.', examples: ['The tour asked for an account'] }, ['--drop']);
    assert.deepStrictEqual(person(fumi, ['drop']), { ok: true, dropped: SHOW_FIRST.preference });
    assert.deepStrictEqual(readRecord().preferences, []);
  });

  it('refuses, writing nothing: no conversation; a proposal of another shape — both entries or neither, a field it lacks or does not hold, a line that is several or spaced, the care entries\' heading as a preference, a kind no care entry names; an entry held already, or one to drop the record lacks; and a yes with nothing held', () => {
    const fumi = project('fumi');
    const said = 'person propose';
    const usage = 'Usage: engine person propose [--drop]   (a preference or a care entry\'s kind, Claude\'s why and examples as JSON on stdin)';
    /** @type {[unknown, string, string[]?][]} */
    const refusals = [
      [{ ...SHOW_FIRST, care: 'look' }, `${said}: the proposal names a preference or a care entry's kind, one and not both`],
      [{ why: SHOW_FIRST.why, examples: SHOW_FIRST.examples }, `${said}: the proposal names a preference or a care entry's kind, one and not both`],
      [{ ...SHOW_FIRST, title: 'Show first' }, `${said}: the proposal has no field title — it holds a preference or a care entry's kind, why and examples`],
      [{ ...SHOW_FIRST, preference: 'Show first\nthen ask' }, `${said}: the proposal's preference is not one line of text, no space at either end`],
      [{ ...SHOW_FIRST, why: ' spaced' }, `${said}: the proposal's why is not one line of text, no space at either end`],
      [{ ...SHOW_FIRST, examples: [] }, `${said}: the proposal's examples are not a list of one line of text or more, each with no space at either end`],
      [{ ...SHOW_FIRST, preference: 'Care entries' }, `${said}: "Care entries" is the record's section of care entries, never a preference's words`],
      [{ care: 'danger', why: 'It matters.', examples: ['A drop'] }, `${said}: "danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals; danger always asks`],
      [SHOW_FIRST, usage, ['--keep']],
    ];
    for (const [given, error, args = []] of refusals) assert.strictEqual(refusedPerson(fumi, ['propose', ...args], given), error, JSON.stringify(given));
    assert.match(refusedPerson(fumi, ['propose']), /^person propose: the proposal comes on stdin as a JSON object, and stdin holds no JSON — /);
    assert.match(refusedPerson(fumi, ['propose'], SHOW_FIRST, { CLAUDE_CODE_SESSION_ID: undefined }), /^person propose: no conversation to hold the proposal in/);
    assert.strictEqual(refusedPerson(fumi, ['keep']), 'person keep: no proposal is held in this conversation — person propose draws one, and the person\'s yes on it keeps it');
    assert.strictEqual(refusedPerson(fumi, ['propose', '--drop'], SHOW_FIRST), `${said}: the record of you holds no "${SHOW_FIRST.preference}" to drop`);
    person(fumi, ['keep', '--care', 'look']);
    assert.strictEqual(refusedPerson(fumi, ['propose'], { care: 'look', why: 'It matters.', examples: ['A radius'] }), `${said}: the record of you holds "Fumi: look" already`);
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'look']), 'person keep --care: the record of you holds "Fumi: look" already');
    assert.strictEqual(refusedPerson(fumi, ['drop', '--care', 'words']), 'person drop --care: the record of you holds no "Fumi: words" to drop');
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care']), 'Usage: engine person keep [--care <kind>]');
  });
});

describe('the care entries\' screens (16.5.6)', () => {
  it('the care entries: what one does, this project\'s by its name now, a new row while a kind is left, the one entry dropped at once, help and back; the line reporting one added above them', () => {
    const fumi = project('fumi');
    const added = person(fumi, ['keep', '--care', 'look']);
    assert.deepStrictEqual(added, { ok: true, kept: 'Fumi: look', next: { kind: 'engine', argv: ['render', 'care', '--added', 'look'] } });

    const out = render(fumi, ['care', '--added', 'look']);

    assert.deepStrictEqual(screen(out, ['TITLE', 'DISPLAY: care', 'MENU: care entries']), [
      '■ Matrix · Fumi · Care entries',
      'Care entry added: Fumi: look — look always asks you in Fumi.',
      '',
      'A kind under a care entry always asks you in Fumi, however well',
      'my calls have matched. Its answers still count while it stands.',
      '',
      'YOURS IN FUMI (1)',
      '  └─ Fumi: look',
      '· · · · · · · · · · · ·',
      '◆ What would you like to do?',
      '',
      'n/new  → Add a care entry — you pick the kind',
      'd/drop → Drop "Fumi: look" — look goes back to the counts',
      'h/help → What this screen is for, row by row',
      'b/back → Back to the matrix',
    ]);
  });

  it('the kind pick lists each kind with no entry here in the order drawn, look among them and danger never (F3), each keeping its entry; the drop pick, each entry here; with none, the screen says so and offers no drop, and with every kind taken, no new', () => {
    const fumi = project('fumi');
    assert.deepStrictEqual(screen(render(fumi, ['care-kind']), ['MENU: care kind']), [
      '· · · · · · · · · · · ·',
      '◆ Which kind should always ask you in Fumi?',
      '',
      '1      → contract — what other code or saved data relies on',
      '2      → scope — whether something is in the work at all',
      '3      → behaviour — what a user sees it do',
      '4      → look — how it looks to a user',
      '5      → words — what a user reads or types',
      '6      → process — how the session runs, not the product',
      '7      → internals — what no user sees',
      'b/back → Back to the care entries',
    ]);
    const none = screen(render(fumi, ['care']), ['DISPLAY: care', 'MENU: care entries']);
    assert.deepStrictEqual([none.includes('  None yet: every kind follows the counts.'), none.some((line) => line.startsWith('d/drop'))], [true, false]);
    for (const kind of ['contract', 'scope', 'behaviour', 'look', 'words', 'process', 'internals']) person(fumi, ['keep', '--care', kind]);

    const all = screen(render(fumi, ['care']), ['MENU: care entries']);
    assert.deepStrictEqual(all.filter((line) => /^[a-z]\/[a-z]+ +→/.test(line)), ['d/drop → Drop a care entry — you pick which', 'h/help → What this screen is for, row by row', 'b/back → Back to the matrix']);
    assert.strictEqual(refuses(fumi, ['render', 'care-kind'], { env: ENV }).error, 'render care-kind: every kind a care entry names always asks in Fumi already');
    assert.deepStrictEqual(screen(render(fumi, ['care-drop']), ['MENU: care drop']).slice(1, 4), ['◆ Which care entry should I drop?', '', '1      → Fumi: contract — contract goes back to the counts']);
  });

  it('a care entry is kept by the project\'s id and shown by its name now: a renamed folder keeps its entries, its screen naming it anew (16.13.5)', () => {
    person(project('fumi'), ['keep', '--care', 'look']);
    const renamed = project('fumi-notes');

    assert.deepStrictEqual(screen(render(renamed, ['care']), ['DISPLAY: care']).slice(-2), ['YOURS IN FUMI NOTES (1)', '  └─ Fumi Notes: look']);
    assert.match(recordText() ?? '', /^- Fumi: look · /m);
  });

  it('the line reporting a drop says where the kind\'s count stands at the person\'s threshold: over it, still asking for now; under it, quiet; and between it and the quarter over it a quiet kind asks again at, quiet', () => {
    const line = (/** @type {boolean} */ asks, /** @type {number} */ bound) => droppedLine('Fumi', 'look', /** @type {any} */ ({ asks, bound }), 0.2);
    assert.deepStrictEqual([line(true, 0.39), line(false, 0.12), line(false, 0.22)], [
      'Care entry dropped: Fumi: look — look follows the counts again: 39%, over your 20%, so it still asks for now.',
      'Care entry dropped: Fumi: look — look follows the counts again: 12%, under your 20%, so it goes quiet.',
      'Care entry dropped: Fumi: look — look follows the counts again: 22%, under the 25% it asks again over, so it goes quiet.',
    ]);
  });

  it('refuses a report the record contradicts, both at once, and a kind no care entry names; and a pick with nothing to pick', () => {
    const fumi = project('fumi');
    person(fumi, ['keep', '--care', 'look']);
    /** @type {[string[], string][]} */
    const refusals = [
      [['care', '--added', 'words'], 'render care: no care entry on words stands in Fumi to report added'],
      [['care', '--dropped', 'look'], 'render care: the care entry on look still stands in Fumi — it was not dropped'],
      [['care', '--added', 'look', '--dropped', 'words'], 'render care: --added and --dropped each report one change — give one'],
      [['care', '--added', 'danger'], 'render care: "danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals; danger always asks'],
    ];
    for (const [args, error] of refusals) assert.strictEqual(refuses(fumi, ['render', ...args], { env: ENV }).error, error, args.join(' '));
    person(fumi, ['drop', '--care', 'look']);
    assert.strictEqual(refuses(fumi, ['render', 'care-drop'], { env: ENV }).error, 'render care-drop: no care entry stands in Fumi to drop');
  });
});

describe('the care entries in the rule (16.5.2, 16.5.3, 16.S18)', () => {
  it('16.S18: a care entry "Aircon: look", look quiet under the threshold — a look question in Aircon asks, naming it as it is named now; in another project the counts decide', () => {
    const aircon = project('aircon', { project_id: AIRCON });
    const fumi = project('fumi');
    const h = history({ project: AIRCON });
    h.agree(13, 'look');
    h.agree(13, 'look', { project: PROJECT_ID });
    logHolding(h.events);
    person(aircon, ['keep', '--care', 'look']);

    assert.deepStrictEqual([lookAt(aircon, 'Aircon'), lookAt(aircon, 'Aircon Two'), lookAt(fumi, 'Fumi').decision], [
      { decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Aircon.' },
      { decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Aircon Two.' },
      'proceed',
    ]);
  });
});

describe('"don\'t care" and the drop (16.5.4, 16.5.5, 16.S19, P6)', () => {
  /** The cue on look in Fumi, at `dir`, the log holding `h`'s events. @param {string} dir @param {ReturnType<typeof history>} h */
  function cueAfter(dir, h) {
    logHolding(h.events);
    return dropCue(statePath(dir), { id: PROJECT_ID, name: 'Fumi' }, 'look', careEntries());
  }

  const CUED = Object.freeze({ care: 'Fumi: look', kind: 'look', dont_cares: 3 });

  it('every third "don\'t care" in a row on a kind under a care entry cues its drop; another answer on the kind, or a reversal, breaks the run; one not followed, Claude\'s own call and another kind\'s answers do neither', () => {
    const dir = project('fumi');
    person(dir, ['keep', '--care', 'look']);
    const h = history();
    /** @type {unknown[]} */
    const cues = [];
    for (const n of [2, 1, 1, 2]) {
      h.dontCare(n, 'look');
      cues.push(cueAfter(dir, h));
    }
    assert.deepStrictEqual(cues, [null, CUED, null, { ...CUED, dont_cares: 6 }]);

    for (const breaks of [() => h.agree(1, 'look'), () => h.depart(null, 'look'), () => h.reverse(h.dontCare(1, 'look')[0])]) {
      breaks();
      h.dontCare(2, 'look');
      assert.strictEqual(cueAfter(dir, h), null);
      h.dontCare(1, 'look');
      assert.deepStrictEqual(cueAfter(dir, h), CUED);
    }
    h.agree(1, 'look');
    h.dontCare(2, 'look');
    h.unfollowed('several', 'look');
    h.call('several', 'look');
    h.dontCare(1, 'words');
    h.agree(1, 'words');
    h.dontCare(1, 'look');
    assert.deepStrictEqual(cueAfter(dir, h), CUED);
  });

  it('cues nothing on a kind under no care entry here, however long the run', () => {
    const dir = project('fumi');
    person(project('aircon', { project_id: AIRCON }), ['keep', '--care', 'look']);
    const h = history();
    h.dontCare(3, 'look');

    assert.strictEqual(cueAfter(dir, h), null);
  });

  it('16.S19: once dropped, the kind\'s bound reflects the answers given while the entry stood — its "don\'t care" answers agreements', () => {
    const dir = project('fumi');
    person(dir, ['keep', '--care', 'look']);
    const h = history();
    h.dontCare(30, 'look');
    logHolding(h.events);
    person(dir, ['drop', '--care', 'look']);

    const dropped = withFrozenClock(() => screen(render(dir, ['care', '--dropped', 'look']), ['DISPLAY: care']).slice(0, 2));

    assert.deepStrictEqual(dropped, ['Care entry dropped: Fumi: look — look follows the counts again:', '9%, under your 20%, so it goes quiet.']);
  });
});

describe('one record across the person\'s projects, and no other project read (16.18.5–16.18.7)', () => {
  it('16.S55: empty for a new user, no file at all; an entry kept in one project is there in the person\'s others', () => {
    const fumi = project('fumi');
    const aircon = project('aircon', { project_id: AIRCON });
    assert.deepStrictEqual([readRecord(), recordToRead(), recordText()], [{ preferences: [], care: [] }, null, null]);

    propose(fumi, SHOW_FIRST);
    person(fumi, ['keep']);

    assert.strictEqual(refusedPerson(aircon, ['propose'], SHOW_FIRST), `person propose: the record of you holds "${SHOW_FIRST.preference}" already`);
    assert.deepStrictEqual(propose(aircon, SHOW_FIRST, ['--drop']).res, { ok: true, proposed: 'drop', entry: SHOW_FIRST.preference });
  });

  it('16.S56: no verb reads another project\'s state — its ledger among them — and its "don\'t care" answers never cue this project\'s drop', (t) => {
    const fumi = project('fumi');
    const aircon = project('aircon', { project_id: AIRCON });
    fs.writeFileSync(statePath(aircon, '.ledger.jsonl'), '{"id":"x"}\n');
    person(aircon, ['keep', '--care', 'look']);
    const h = history({ project: AIRCON });
    h.dontCare(3, 'look');
    logHolding(h.events);
    /** @type {string[]} */
    const read = [];
    for (const method of /** @type {const} */ (['readFileSync', 'existsSync', 'statSync', 'lstatSync', 'openSync', 'readdirSync'])) {
      const real = fs[method];
      t.mock.method(fs, method, /** @type {any} */ (function spied(/** @type {any} */ target, /** @type {any[]} */ ...rest) {
        read.push(String(target));
        return /** @type {any} */ (real).call(fs, target, ...rest);
      }));
    }

    propose(fumi, SHOW_FIRST);
    person(fumi, ['keep']);
    person(fumi, ['keep', '--care', 'look']);
    render(fumi, ['care', '--added', 'look']);
    render(fumi, ['care-kind']);
    render(fumi, ['care-drop']);
    propose(fumi, DROP_LOOK, ['--drop']);
    person(fumi, ['drop']);
    render(fumi, ['care', '--dropped', 'look']);
    person(fumi, ['keep', '--care', 'look']);
    const cue = dropCue(statePath(fumi), { id: PROJECT_ID, name: 'Fumi' }, 'look', careEntries());
    lookAt(fumi, 'Fumi');
    t.mock.restoreAll();

    assert.strictEqual(cue, null);
    assert.deepStrictEqual(read.filter((file) => file.startsWith(aircon)), []);
    assert.ok(read.some((file) => file.startsWith(fumi)), 'the spy saw this project read');
    assert.deepStrictEqual(dropCue(statePath(aircon), { id: AIRCON, name: 'Aircon' }, 'look', careEntries()), { care: 'Aircon: look', kind: 'look', dont_cares: 3 });
  });
});
