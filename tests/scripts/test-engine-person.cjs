'use strict';

// ---------------------------------------------------------------------------
// The record of the person (leeway-engine/scripts/domain/person.cjs, its
// verbs domain/person-verbs.cjs, its screens domain/projections/person.cjs
// and domain/projections/care.cjs): `person.md` in the system config
// directory, laid out as P5 says under its version line, the person's own
// hand edits kept, only its care entries read strictly, a newer release's
// record never written, and gone with its last entry (4.S27, 16.18.5,
// 16.18.8); Claude's proposal, `person propose [--drop]`, drawn and held in
// the conversation, steering nothing until the person's yes as the gate
// recorded it, `person keep` or `person drop`, and let go on their no,
// `person discard` (16.18.2, 16.18.3, 16.S54); the care entries' screens,
// `render care`, `render care-kind` and `render care-drop`, and the
// person's own picks on them, `person keep|drop --care <kind>` (16.5.6); the
// care entries keyed by the project's id and shown by its name, feeding the
// decision point's rule in their project alone (16.5.2, 16.5.3, 16.S18);
// the run of "don't care" answers since an entry was added that cues its
// drop, and the bound a dropped kind takes from the answers given while it
// stood (16.5.4, 16.5.5, 16.S19, P6); one record across the person's
// projects, empty for a new user (16.S55); and no verb reading another
// project's state (16.S56).
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
const { idOf, PROJECT_ID, SESSION, DAY, MODEL, UNDRAWN, lines, useTrustWorld, history } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { recordToRead, careEntries, dropCue, personPath } = require(path.join(SCRIPTS, 'domain/person.cjs'));
const { droppedLine } = require(path.join(SCRIPTS, 'domain/projections/care.cjs'));
const { ruled } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));

const { folder, logPath, project } = useTrustWorld('engine-person-');

const ENV = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION });
const OTHER = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'deadbeef-1234-4abc-8def-0123456789ab' });
const AIRCON = idOf('Aircon');
const VERSION_LINE = '<!-- leeway: the record of you, version 1 -->';
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

// When a care entry written for a test was added: before any history's
// first event, so its every answer counts towards the cue.
const BEFORE = new Date(FROZEN_MS - 2 * DAY).toISOString();

/** The preference 16.18.3 draws. */
const SHOW_FIRST = Object.freeze({
  preference: 'Show the product before asking for anything',
  why: 'you\'d rather people see what it does before it asks them for a key, a permission or an account.',
  examples: ['Fumi\'s first run: the tour first, then the licence as a wizard step', 'Fumi: sync stays off until you turn it on, so nothing asks for an account up front'],
});

/** SHOW_FIRST as the engine writes it in the record. */
const SHOW_FIRST_SECTION = [
  `## ${SHOW_FIRST.preference}`,
  '',
  `Why: ${SHOW_FIRST.why}`,
  '',
  'Examples:',
  ...SHOW_FIRST.examples.map((example) => `- ${example}`),
].join('\n');

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

/** The record's file holding `text`, as a hand or another release left it. @param {string} text */
function recordHolding(text) {
  fs.mkdirSync(path.dirname(recordFile()), { recursive: true });
  fs.writeFileSync(recordFile(), text);
}

/** The record holding the care entries `entries` alone, each `[name, kind, project id, added]`. @param {[string, string, string, string?][]} entries */
function careStanding(...entries) {
  recordHolding(`${VERSION_LINE}\n\n# The record of you\n\n## Care entries\n\n${entries.map(([name, kind, id, added = BEFORE]) => `- ${name}: ${kind} · ${id} · ${added}`).join('\n')}\n`);
}

/** A `person` verb that must succeed in the conversation: its response. @param {string} dir @param {string[]} args @param {Record<string, string>} [env] */
const person = (dir, args, env = ENV) => ok(dir, ['person', ...args], { env });

/** Claude's proposal, drawn: its response and its screen. @param {string} dir @param {Record<string, unknown>} given @param {string[]} [args] @param {Record<string, string>} [env] */
const propose = (dir, given, args = [], env = ENV) => okSections(dir, ['person', 'propose', ...args], { env, stdin: JSON.stringify(given) });

/** A surface drawn in the conversation. @param {string} dir @param {string[]} args */
const render = (dir, args) => output(dir, ['render', ...args], { env: ENV });

/** The person's pick of the row `key` at the gate `gate` shown: the gate's response. @param {string} dir @param {string} gate @param {string} key @param {Record<string, string>} [env] */
const pick = (dir, gate, key, env = ENV) => ok(dir, ['gate', gate, '--pick', key], { env });

/** An engine command a row leads to. @param {...string} argv */
const engine = (...argv) => ({ kind: 'engine', argv });

/**
 * Claude's proposal drawn, the person's yes on it, and the yes run: the
 * yes's response.
 * @param {string} dir @param {Record<string, unknown>} given @param {string[]} [args] @param {Record<string, string>} [env]
 */
function kept(dir, given, args = [], env = ENV) {
  const drop = args.includes('--drop');
  propose(dir, given, args, env);
  assert.deepStrictEqual(pick(dir, drop ? 'record drop' : 'record proposal', 'y', env).next, engine('person', drop ? 'drop' : 'keep'));
  return person(dir, [drop ? 'drop' : 'keep'], env);
}

/** The key the menu `gate`, drawn as `out`, gives the row whose label holds `words`. @param {string} out @param {string} gate @param {string} words */
function keyOf(out, gate, words) {
  const row = screenOf(out, `MENU: ${gate}`).find((line) => line.includes(words));
  assert.ok(row, `no row of ${gate} holds ${words}`);
  return row.split(' ')[0];
}

/** A care entry on `kind` added on the care entries' screens: the pick's response. @param {string} dir @param {string} kind */
function addCare(dir, kind) {
  render(dir, ['care']);
  assert.deepStrictEqual(pick(dir, 'care entries', 'n').next, engine('render', 'care-kind'));
  pick(dir, 'care kind', keyOf(render(dir, ['care-kind']), 'care kind', `→ ${kind} — `));
  return person(dir, ['keep', '--care', kind]);
}

/** The care entry on `kind` here dropped on the care entries' screens: the pick's response. @param {string} dir @param {string} kind */
function dropCare(dir, kind) {
  render(dir, ['care']);
  const { next } = pick(dir, 'care entries', 'd');
  if (next.argv[1] === 'care-drop') pick(dir, 'care drop', keyOf(render(dir, ['care-drop']), 'care drop', `: ${kind} — `));
  return person(dir, ['drop', '--care', kind]);
}

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

/** A call on look in the project at `dir` named `name`, as the decision point is given it, on a question never drawn blind. @param {string} dir @param {string} name */
function lookAt(dir, name) {
  return ruled(/** @type {any} */ ({ sort: 'several' }), {
    label: labelled('look'), place: { unit: 'fumi', phase: 'discussion', topic: 'note-window' }, blocks_build: false, replaced_by: null, measured: null, always: null, checked: false,
    project: { root: statePath(dir), name }, model: MODEL, now: FROZEN_MS, question: UNDRAWN,
  });
}

/** The record's preferences, by their words, and the kinds under its care entries, as its file reads now. */
function readRecordShape() {
  const text = recordText() ?? '';
  return {
    preferences: [...text.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading).filter((heading) => heading !== 'Care entries'),
    care: careEntries().map(({ kind }) => kind),
  };
}

/**
 * What each row of the pick `gate`, drawn by `render` afresh for each, leads
 * to: its rows 1 to `count`, then back.
 * @param {string} dir @param {string} gate @param {number} count
 */
function picksOf(dir, gate, count) {
  const surface = gate === 'care kind' ? 'care-kind' : 'care-drop';
  const keys = [...Array.from({ length: count }, (_, i) => String(i + 1)), 'b'];
  const nexts = keys.map((key) => {
    render(dir, [surface]);
    return pick(dir, gate, key).next;
  });
  assert.deepStrictEqual(nexts.pop(), engine('render', 'care'), `${gate}: back`);
  return nexts;
}

/** The refusal of care entries that do not read, at `line` for `why`. @param {number} line @param {string} why */
const careRefusal = (line, why) => `the record of the person, ${recordFile()}, does not read at line ${line}: ${why} — its care entries are one "Care entries" section, a line each, "- {project}: {kind} · {project id} · {when added}"; put the line right by hand`;

describe('the record\'s file (P5, 16.18.8, 4.S27)', () => {
  it('4.S27: kept in the system config directory, never under the project\'s state, laid out as P5 says — the version line, the title, a section a preference with its Why: and its Examples:, then the care entries, a line each, the project\'s name beside the id that keys it and when it was added', () => {
    const fumi = project('fumi');
    const from = new Date().toISOString();
    kept(fumi, SHOW_FIRST);
    addCare(fumi, 'look');
    addCare(project('aircon', { project_id: AIRCON }), 'words');

    const [look, words] = careEntries();
    assert.strictEqual(personPath(), recordFile());
    assert.strictEqual(recordText(), [
      VERSION_LINE,
      '',
      '# The record of you',
      '',
      SHOW_FIRST_SECTION,
      '',
      '## Care entries',
      '',
      `- Fumi: look · ${PROJECT_ID} · ${look.added}`,
      `- Aircon: words · ${AIRCON} · ${words.added}`,
      '',
    ].join('\n'));
    assert.deepStrictEqual([look, words], [{ project: PROJECT_ID, name: 'Fumi', kind: 'look', added: look.added }, { project: AIRCON, name: 'Aircon', kind: 'words', added: words.added }]);
    assert.ok(UTC.test(look.added) && from <= look.added && look.added <= words.added, `${from}, ${look.added}, ${words.added}`);
    assert.deepStrictEqual(filesUnder(statePath(fumi)).filter((file) => path.basename(file).startsWith('person')), []);
  });

  it('a record as the person edits it by hand reads — a title, notes and sections of their own, any list, a Why: run on or bold, CRLF and trailing spaces — and only the preference kept or dropped changes: the rest written back as written, under the version line a file naming none reads as', () => {
    const fumi = project('fumi');
    const care = `- Fumi: look · ${PROJECT_ID} · ${BEFORE}  `;
    const handmade = [
      '# Lee\'s record',
      '',
      'My notes on how I like to work.',
      '',
      '## Ask first',
      '**Why:** it is hard to undo.',
      '',
      'Examples:',
      '* A migration',
      '1. The sync column',
      '- The tour',
      '  - and the licence',
      '\tand its wizard',
      '',
      'I added this after a chat with Sam.',
      '',
      '---',
      '',
      '## Notes',
      '',
      'Some notes.',
      '### More',
      '',
      '## Keep words plain',
      '',
      'Why:',
      'people read them first.',
      '',
      'Examples: the menu labels',
      '',
      '## Care entries',
      '',
      care,
      '',
    ];
    const [, ...head] = handmade;
    const plainWords = handmade.indexOf('## Keep words plain');
    const careAt = handmade.indexOf('## Care entries');
    const after = [
      VERSION_LINE,
      '',
      handmade[0],
      ...head.slice(0, plainWords - 1),
      SHOW_FIRST_SECTION,
      '',
      ...handmade.slice(careAt),
    ].join('\n');

    for (const eol of ['\n', '\r\n']) {
      recordHolding(handmade.join(eol));
      assert.deepStrictEqual([careEntries(), recordToRead()], [[{ project: PROJECT_ID, name: 'Fumi', kind: 'look', added: BEFORE }], recordFile()]);

      kept(fumi, SHOW_FIRST);
      kept(fumi, { preference: 'Keep words plain', why: 'You stopped asking for it.', examples: ['The labels changed'] }, ['--drop']);

      assert.strictEqual(recordText(), after, JSON.stringify(eol));
      fs.rmSync(recordFile());
    }
  });

  it('only its care entries read strictly: a care section that does not read refuses each verb reading care entries, naming the file and the line for the person to put right, and is never written over — while a preference is kept beside it, written back as it was', () => {
    const fumi = project('fumi');
    careStanding(['Fumi', 'look', PROJECT_ID]);
    render(fumi, ['care']);
    pick(fumi, 'care entries', 'n');
    pick(fumi, 'care kind', keyOf(render(fumi, ['care-kind']), 'care kind', '→ words — '));
    const head = `${VERSION_LINE}\n\n# The record of you\n\n## Care entries\n\n`;
    const entry = (/** @type {string} */ name, /** @type {string} */ kind, /** @type {string} */ id, added = BEFORE) => `- ${name}: ${kind} · ${id} · ${added}`;
    /** @type {[string, number, string][]} */
    const broken = [
      [`${head}- Fumi: look · ${PROJECT_ID}\n`, 7, 'a care entry reads "- {project}: {kind} · {project id} · {when added}"'],
      [`${head}${entry('Fumi', 'Look', PROJECT_ID)}\n`, 7, 'a care entry reads "- {project}: {kind} · {project id} · {when added}"'],
      [`${head}${entry('Fumi', 'danger', PROJECT_ID)}\n`, 7, '"danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals'],
      [`${head}${entry('Fumi', 'look', 'fumi')}\n`, 7, '"fumi" is no project\'s id'],
      [`${head}${entry('Fumi', 'look', PROJECT_ID, 'yesterday')}\n`, 7, '"yesterday" is no time it was added'],
      [`${head}${entry('Fumi', 'look', PROJECT_ID)}\n\n## Care entries\n\n${entry('Fumi', 'scope', PROJECT_ID)}\n`, 9, 'it holds one "Care entries" section'],
      [`${head}${entry('Fumi', 'look', PROJECT_ID)}\n${entry('Fumi', 'look', PROJECT_ID)}\n`, 8, 'it holds Fumi: look twice'],
    ];
    for (const [text, line, why] of broken) {
      recordHolding(text);
      const refusal = careRefusal(line, why);
      assert.throws(() => careEntries(), { message: refusal }, why);
      assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'words']), refusal, why);
      assert.strictEqual(refusedPerson(fumi, ['propose'], { care: 'scope', why: 'It matters.', examples: ['A drop'] }), refusal, why);
      assert.strictEqual(refuses(fumi, ['render', 'care'], { env: ENV }).error, refusal, why);
      assert.throws(() => lookAt(fumi, 'Fumi'), { message: refusal }, why);
      assert.strictEqual(recordText(), text, why);
    }

    kept(fumi, SHOW_FIRST);

    assert.strictEqual(recordText(), `${VERSION_LINE}\n\n# The record of you\n\n${SHOW_FIRST_SECTION}\n\n${broken[broken.length - 1][0].slice(head.length - '## Care entries\n\n'.length)}`);
  });

  it('a record a newer release wrote is never written: its care entries read where their lines parse as this version\'s, the rest skipped, and a change refuses, telling the person to update Leeway', () => {
    const fumi = project('fumi');
    const newer = [
      '<!-- leeway: the record of you, version 2 -->',
      '',
      '# The record of you',
      '',
      '## Show first',
      '',
      'Why: people see it.',
      '',
      '## Care entries',
      '',
      `- Fumi: look · ${PROJECT_ID} · ${BEFORE}`,
      `- Fumi: words · ${PROJECT_ID} · ${BEFORE} · pinned`,
      `- Aircon: scope · ${AIRCON}`,
      '',
      '## Care entries',
      '',
      `- Fumi: look · ${PROJECT_ID} · ${BEFORE}`,
      '',
    ].join('\n');
    recordHolding(newer);
    const refusal = `the record of the person, ${recordFile()}, was written by a newer Leeway, in its layout version 2 — this one writes version 1, so it changes nothing there: update Leeway in this project to change the record; its care entries still count meanwhile`;

    assert.deepStrictEqual(careEntries(), [{ project: PROJECT_ID, name: 'Fumi', kind: 'look', added: BEFORE }]);
    assert.deepStrictEqual(screen(render(fumi, ['care']), ['DISPLAY: care']).slice(-2), ['YOURS IN FUMI (1)', '  └─ Fumi: look']);
    pick(fumi, 'care entries', 'n');
    pick(fumi, 'care kind', keyOf(render(fumi, ['care-kind']), 'care kind', '→ words — '));
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'words']), refusal);
    assert.strictEqual(refusedPerson(fumi, ['propose'], SHOW_FIRST), refusal);
    assert.deepStrictEqual(lookAt(fumi, 'Fumi'), { decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Fumi.' });
    assert.strictEqual(recordText(), newer);
  });

  it('goes with its last entry: the record emptied leaves no file, as it shipped (16.18.5) — unless the person wrote something of their own in it', () => {
    const fumi = project('fumi');
    addCare(fumi, 'look');
    assert.ok(fs.existsSync(recordFile()));

    dropCare(fumi, 'look');
    assert.strictEqual(recordText(), null);

    recordHolding(`# The record of you\n\nMy notes.\n\n## Care entries\n\n- Fumi: look · ${PROJECT_ID} · ${BEFORE}\n`);
    dropCare(fumi, 'look');
    assert.strictEqual(recordText(), `${VERSION_LINE}\n\n# The record of you\n\nMy notes.\n`);
  });
});

describe('Claude\'s proposal and the person\'s yes (16.18.2, 16.18.3, 16.S54)', () => {
  it('16.18.3: the proposal screen states the preference in words with its why and examples, what keeping it would change, and takes the person\'s yes to keep it, their no to let it go, or their comment to carry on', () => {
    const fumi = project('fumi');
    const { res, sections } = propose(fumi, SHOW_FIRST);

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
    assert.deepStrictEqual(pick(fumi, 'record proposal', 'n').next, engine('person', 'discard'));
    propose(fumi, SHOW_FIRST);
    assert.deepStrictEqual(ok(fumi, ['gate', 'record proposal', '--typed', 'comment'], { env: ENV }).next, { kind: 'continue' });
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
    pick(fumi, 'record proposal', 'y');
    person(fumi, ['keep']);
    assert.deepStrictEqual([recordToRead(), held(), lookAt(fumi, 'Fumi')], [recordFile(), null, before]);

    propose(fumi, { care: 'look', why: 'Look matters here.', examples: ['The corner radius'] });
    assert.deepStrictEqual([careEntries(), lookAt(fumi, 'Fumi')], [[], before]);
    pick(fumi, 'record proposal', 'y');
    assert.deepStrictEqual(person(fumi, ['keep']), { ok: true, kept: 'Fumi: look' });
    assert.deepStrictEqual(lookAt(fumi, 'Fumi'), { decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Fumi.' });
  });

  it('nothing is written without the person\'s yes: a no, a yes given to an earlier screen or in another conversation, and a care entry no screen picked are each refused; the no lets the proposal go', () => {
    const fumi = project('fumi');
    const noYes = `person keep: the person has not said yes to "${SHOW_FIRST.preference}" — only their y/yes on its screen keeps it, and nothing is written`;

    propose(fumi, SHOW_FIRST);
    const { next } = pick(fumi, 'record proposal', 'n');
    assert.strictEqual(refusedPerson(fumi, ['keep']), noYes);
    assert.deepStrictEqual(person(fumi, next.argv.slice(1)), { ok: true, discarded: SHOW_FIRST.preference });
    assert.deepStrictEqual([held(), refusedPerson(fumi, ['keep'])], [null, 'person keep: no proposal is held in this conversation — person propose draws one, for the person\'s answer']);

    propose(fumi, { care: 'words', why: 'Words matter here.', examples: ['The menu labels'] });
    pick(fumi, 'record proposal', 'y');
    propose(fumi, SHOW_FIRST);
    assert.strictEqual(refusedPerson(fumi, ['keep']), noYes);

    pick(fumi, 'record proposal', 'y');
    propose(fumi, { preference: 'Ask before a migration', why: 'It is hard to undo.', examples: ['The notes table'] }, [], OTHER);
    person(fumi, ['keep']);
    assert.strictEqual(refuses(fumi, ['person', 'keep'], { env: OTHER }).error, 'person keep: the person has not said yes to "Ask before a migration" — only their y/yes on its screen keeps it, and nothing is written');
    assert.strictEqual(refusedPerson(fumi, ['keep']), 'person keep: no proposal is held in this conversation — person propose draws one, for the person\'s answer');

    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'look']), 'person keep --care: the person has not picked "Fumi: look" to add — only their pick on the care entries\' screens, render care, leads here, and nothing is written');
    render(fumi, ['care']);
    pick(fumi, 'care entries', 'n');
    pick(fumi, 'care kind', keyOf(render(fumi, ['care-kind']), 'care kind', '→ look — '));
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'words']), 'person keep --care: the person has not picked "Fumi: words" to add — only their pick on the care entries\' screens, render care, leads here, and nothing is written');
    person(fumi, ['keep', '--care', 'look']);
    render(fumi, ['care']);
    pick(fumi, 'care entries', 'b');
    assert.strictEqual(refusedPerson(fumi, ['drop', '--care', 'look']), 'person drop --care: the person has not picked "Fumi: look" to drop — only their pick on the care entries\' screens, render care, leads here, and nothing is written');
    assert.deepStrictEqual(readRecordShape(), { preferences: [SHOW_FIRST.preference], care: ['look'] });
  });

  it('a yes counts for the proposal it was given to alone: a proposal held since — its screen\'s record lost — waits on a yes of its own', () => {
    const fumi = project('fumi');
    propose(fumi, SHOW_FIRST);
    pick(fumi, 'record proposal', 'y');
    const file = path.join(folder(), 'config', 'conversations', SESSION, 'person-proposal.json');
    fs.writeFileSync(file, JSON.stringify({ ...held(), at: new Date(Date.now() + 60000).toISOString() }));

    assert.strictEqual(refusedPerson(fumi, ['keep']), `person keep: the person has not said yes to "${SHOW_FIRST.preference}" — only their y/yes on its screen keeps it, and nothing is written`);
  });

  it('a proposal worded again on the person\'s comment is kept on their yes to its screen drawn again', () => {
    const fumi = project('fumi');
    propose(fumi, { ...SHOW_FIRST, preference: 'Show the product first' });
    ok(fumi, ['gate', 'record proposal', '--typed', 'comment'], { env: ENV });

    assert.deepStrictEqual(kept(fumi, SHOW_FIRST), { ok: true, kept: SHOW_FIRST.preference });
  });

  it('the yes checks the record again under its lock: an entry kept since the proposal is refused, the record left as it was', () => {
    const fumi = project('fumi');
    propose(fumi, SHOW_FIRST);
    pick(fumi, 'record proposal', 'y');
    const since = `${VERSION_LINE}\n\n# The record of you\n\n${SHOW_FIRST_SECTION}\n`;
    recordHolding(since);

    assert.strictEqual(refusedPerson(fumi, ['keep']), `person keep: the record of you holds "${SHOW_FIRST.preference}" already`);
    assert.strictEqual(recordText(), since);

    render(fumi, ['care']);
    pick(fumi, 'care entries', 'n');
    pick(fumi, 'care kind', keyOf(render(fumi, ['care-kind']), 'care kind', '→ look — '));
    careStanding(['Fumi', 'look', PROJECT_ID]);
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'look']), 'person keep --care: the record of you holds "Fumi: look" already');
  });

  it('16.5.4: the drop of a care entry, proposed on the same screen, drops it on the yes, and the kind follows the counts again', () => {
    const fumi = project('fumi');
    careStanding(['Fumi', 'look', PROJECT_ID]);

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
    assert.deepStrictEqual(pick(fumi, 'record drop', 'y').next, engine('person', 'drop'));
    assert.deepStrictEqual([person(fumi, ['drop']), careEntries(), held()], [{ ok: true, dropped: 'Fumi: look' }, [], null]);
  });

  it('a preference proposed for dropping is dropped on the yes; a proposal is answered as it proposes, and one let go by the no leaves the record as it was', () => {
    const fumi = project('fumi');
    kept(fumi, SHOW_FIRST);
    propose(fumi, { ...SHOW_FIRST, why: 'You let the tour run long.', examples: ['The tour asked for an account'] }, ['--drop']);
    person(fumi, pick(fumi, 'record drop', 'n').next.argv.slice(1));
    propose(fumi, { care: 'words', why: 'Words matter here.', examples: ['The menu labels'] });
    pick(fumi, 'record proposal', 'y');

    assert.strictEqual(refusedPerson(fumi, ['drop']), 'person drop: the proposal held keeps "Fumi: words" — its yes is person keep');
    person(fumi, ['keep']);

    assert.deepStrictEqual(readRecordShape(), { preferences: [SHOW_FIRST.preference], care: ['words'] });
    assert.deepStrictEqual(kept(fumi, { ...SHOW_FIRST, why: 'You let the tour run long.', examples: ['The tour asked for an account'] }, ['--drop']), { ok: true, dropped: SHOW_FIRST.preference });
    assert.deepStrictEqual(readRecordShape(), { preferences: [], care: ['words'] });
  });

  it('refuses, writing nothing: no conversation; a proposal of another shape — both entries or neither, a field it lacks or does not hold, a line that is several or spaced, the care entries\' heading as a preference, a kind no care entry names; an entry held already, or one to drop the record lacks; a yes with nothing held; and a pick naming no kind a care entry names', () => {
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
    assert.match(refusedPerson(fumi, ['propose'], SHOW_FIRST, { CLAUDE_CODE_SESSION_ID: undefined }), /^person propose: no conversation to answer in/);
    assert.strictEqual(refusedPerson(fumi, ['discard']), 'person discard: no proposal is held in this conversation — person propose draws one, for the person\'s answer');
    assert.strictEqual(refusedPerson(fumi, ['propose', '--drop'], SHOW_FIRST), `${said}: the record of you holds no "${SHOW_FIRST.preference}" to drop`);
    careStanding(['Fumi', 'look', PROJECT_ID]);
    assert.strictEqual(refusedPerson(fumi, ['propose'], { care: 'look', why: 'It matters.', examples: ['A radius'] }), `${said}: the record of you holds "Fumi: look" already`);
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care', 'danger']), 'person keep --care: "danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals; danger always asks');
    assert.strictEqual(refusedPerson(fumi, ['keep', '--care']), 'Usage: engine person keep [--care <kind>]');
    assert.strictEqual(refusedPerson(fumi, ['discard', '--care', 'look']), 'Usage: engine person discard');
  });
});

describe('the care entries\' screens (16.5.6)', () => {
  it('the care entries: what one does, this project\'s by its name now, a new row while a kind is left, the one entry dropped at once, help and back; the line reporting one added above them', () => {
    const fumi = project('fumi');
    const added = addCare(fumi, 'look');
    assert.deepStrictEqual(added, { ok: true, kept: 'Fumi: look', next: engine('render', 'care', '--added', 'look') });

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
    assert.deepStrictEqual(pick(fumi, 'care entries', 'd').next, engine('person', 'drop', '--care', 'look'));
  });

  it('the kind pick lists each kind with no entry here in the order drawn, look among them and danger never (F3), each keeping its entry; the drop pick, each entry here, each dropping it; with none, the screen says so and offers no drop, and with every kind taken, no new', () => {
    const fumi = project('fumi');
    const kinds = ['contract', 'scope', 'behaviour', 'look', 'words', 'process', 'internals'];
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
    assert.deepStrictEqual(picksOf(fumi, 'care kind', kinds.length), kinds.map((kind) => engine('person', 'keep', '--care', kind)));
    const none = screen(render(fumi, ['care']), ['DISPLAY: care', 'MENU: care entries']);
    assert.deepStrictEqual([none.includes('  None yet: every kind follows the counts.'), none.some((line) => line.startsWith('d/drop'))], [true, false]);
    careStanding(...kinds.map((kind) => /** @type {[string, string, string]} */ (['Fumi', kind, PROJECT_ID])));

    const all = screen(render(fumi, ['care']), ['MENU: care entries']);
    assert.deepStrictEqual(all.filter((line) => /^[a-z]\/[a-z]+ +→/.test(line)), ['d/drop → Drop a care entry — you pick which', 'h/help → What this screen is for, row by row', 'b/back → Back to the matrix']);
    assert.deepStrictEqual(pick(fumi, 'care entries', 'd').next, engine('render', 'care-drop'));
    assert.strictEqual(refuses(fumi, ['render', 'care-kind'], { env: ENV }).error, 'render care-kind: every kind a care entry names always asks in Fumi already');
    assert.deepStrictEqual(screen(render(fumi, ['care-drop']), ['MENU: care drop']).slice(1, 4), ['◆ Which care entry should I drop?', '', '1      → Fumi: contract — contract goes back to the counts']);
    assert.deepStrictEqual(picksOf(fumi, 'care drop', kinds.length), kinds.map((kind) => engine('person', 'drop', '--care', kind)));
  });

  it('a care entry is kept by the project\'s id and shown by its name now: a renamed folder keeps its entries, its screen naming it anew (16.13.5)', () => {
    addCare(project('fumi'), 'look');
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
    careStanding(['Fumi', 'look', PROJECT_ID]);
    /** @type {[string[], string][]} */
    const refusals = [
      [['care', '--added', 'words'], 'render care: no care entry on words stands in Fumi to report added'],
      [['care', '--dropped', 'look'], 'render care: the care entry on look still stands in Fumi — it was not dropped'],
      [['care', '--added', 'look', '--dropped', 'words'], 'render care: --added and --dropped each report one change — give one'],
      [['care', '--added', 'danger'], 'render care: "danger" is no kind a care entry names — contract, scope, behaviour, look, words, process, internals; danger always asks'],
    ];
    for (const [args, error] of refusals) assert.strictEqual(refuses(fumi, ['render', ...args], { env: ENV }).error, error, args.join(' '));
    dropCare(fumi, 'look');
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
    addCare(aircon, 'look');

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
    careStanding(['Fumi', 'look', PROJECT_ID]);
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

  it('counts the run by when each answer was given, in whatever order the log holds them, and from when the care entry was added alone', () => {
    const dir = project('fumi');
    careStanding(['Fumi', 'look', PROJECT_ID]);
    const h = history();
    const start = h.now();
    h.dontCare(2, 'look');
    h.agree(1, 'look', { at: start + 500 });
    h.dontCare(1, 'look', { at: start + 3000 });
    assert.deepStrictEqual(cueAfter(dir, h), CUED);

    const later = history();
    later.dontCare(2, 'look');
    careStanding(['Fumi', 'look', PROJECT_ID, new Date(later.now() + 500).toISOString()]);
    later.dontCare(1, 'look', { at: later.now() + 1000 });
    assert.strictEqual(cueAfter(dir, later), null);
    later.dontCare(2, 'look');
    assert.deepStrictEqual(cueAfter(dir, later), CUED);
  });

  it('cues nothing on a kind under no care entry here, however long the run', () => {
    const dir = project('fumi');
    careStanding(['Aircon', 'look', AIRCON]);
    const h = history();
    h.dontCare(3, 'look');

    assert.strictEqual(cueAfter(dir, h), null);
  });

  it('16.S19: once dropped, the kind\'s bound reflects the answers given while the entry stood — its "don\'t care" answers agreements — read at the person\'s own threshold', () => {
    const dir = project('fumi');
    careStanding(['Fumi', 'look', PROJECT_ID]);
    fs.writeFileSync(path.join(folder(), 'config', 'config.json'), JSON.stringify({ trust: { threshold: 0.1 } }));
    const h = history();
    h.dontCare(30, 'look');
    logHolding(h.events);
    dropCare(dir, 'look');

    const dropped = withFrozenClock(() => screen(render(dir, ['care', '--dropped', 'look']), ['DISPLAY: care']).slice(0, 2));

    assert.deepStrictEqual(dropped, ['Care entry dropped: Fumi: look — look follows the counts again:', '9%, under your 10%, so it goes quiet.']);
  });
});

describe('one record across the person\'s projects, and no other project read (16.18.5–16.18.7)', () => {
  it('16.S55: empty for a new user, no file at all; an entry kept in one project is there in the person\'s others', () => {
    const fumi = project('fumi');
    const aircon = project('aircon', { project_id: AIRCON });
    assert.deepStrictEqual([careEntries(), recordToRead(), recordText()], [[], null, null]);

    kept(fumi, SHOW_FIRST);

    assert.strictEqual(refusedPerson(aircon, ['propose'], SHOW_FIRST), `person propose: the record of you holds "${SHOW_FIRST.preference}" already`);
    assert.deepStrictEqual(propose(aircon, SHOW_FIRST, ['--drop']).res, { ok: true, proposed: 'drop', entry: SHOW_FIRST.preference });
  });

  it('16.S56: no verb reads another project\'s state — its ledger among them — and its "don\'t care" answers never cue this project\'s drop', (t) => {
    const fumi = project('fumi');
    const aircon = project('aircon', { project_id: AIRCON });
    fs.writeFileSync(statePath(aircon, '.ledger.jsonl'), '{"id":"x"}\n');
    careStanding(['Aircon', 'look', AIRCON]);
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

    kept(fumi, SHOW_FIRST);
    addCare(fumi, 'look');
    render(fumi, ['care', '--added', 'look']);
    render(fumi, ['care-kind']);
    render(fumi, ['care-drop']);
    kept(fumi, DROP_LOOK, ['--drop']);
    render(fumi, ['care', '--dropped', 'look']);
    addCare(fumi, 'look');
    dropCue(statePath(fumi), { id: PROJECT_ID, name: 'Fumi' }, 'look', careEntries());
    lookAt(fumi, 'Fumi');
    t.mock.restoreAll();
    careStanding(['Aircon', 'look', AIRCON], ['Fumi', 'look', PROJECT_ID]);

    assert.strictEqual(dropCue(statePath(fumi), { id: PROJECT_ID, name: 'Fumi' }, 'look', careEntries()), null);
    assert.deepStrictEqual(read.filter((file) => file.startsWith(aircon)), []);
    assert.ok(read.some((file) => file.startsWith(fumi)), 'the spy saw this project read');
    assert.deepStrictEqual(dropCue(statePath(aircon), { id: AIRCON, name: 'Aircon' }, 'look', careEntries()), { care: 'Aircon: look', kind: 'look', dont_cares: 3 });
  });
});

