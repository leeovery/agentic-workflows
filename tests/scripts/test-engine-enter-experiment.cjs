'use strict';

// ---------------------------------------------------------------------------
// The laboratory's entry (ledger-engine/scripts/domain/experiment-entry.cjs,
// its row of enter.cjs): `engine enter experiment <unit> [<topic>]
// [--record <id>]`. What it refuses, each refusal naming its way on and
// writing nothing — a topic with no experiment, one whose every experiment
// has ended, and a record named that is no live experiment of the series,
// a split among them; the questions it asks first, nothing written — the
// held-topic question, then the pick where several experiments are live,
// the register above it, each row the entry again naming its record and
// carrying any take, its back the epic's menu, or the next experiment's
// gate the conversation came from (6.1.21, 18.4.21); and what it reads, of
// the experiment named or the one live: its id, status and folder, its
// documents, its splits, and until the person approved its design, the
// spawning topic's record, its log and its brief (2.10.3). The entry's
// common machinery — the position, the presence, when the place was
// entered — is test-engine-enter.cjs's.
//
// Layer: verb. World, built once and copied: experiment-world.cjs's lab,
// whose topic `timing` holds its brief and its log and two experiments
// conceived, E1 and E2, and whose topic `layout` holds none. Each test's
// conversation has its own system config.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, output, refusedPristine, statePath, layout, writeState, commitAll, stateGit, sectionOf, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { writeManifest, readManifest, setup, problemScratch, SESSION, MADE } = require('./experiment-world.cjs');

const UNIT = 'lab';
const TOPIC = 'timing';
const ENGINE = 'node .claude/skills/ledger-engine/scripts/engine.cjs';
const USAGE = 'Usage: engine enter <discussion|discovery|specification|implementation|review|investigation|experiment> <work-unit|product> [<topic>] [--take] [--move] [--seeds <seeds>] [--record <record>]';
const PEER = String(process.ppid);

const world = fixtureFrom('engine-enter-experiment-', (dir) => {
  setup(dir);
  const manifest = readManifest(dir, UNIT);
  manifest.phases.discovery.items.layout = { summary: 'Layout behaviour', order: 2 };
  writeManifest(dir, UNIT, manifest);
  writeState(dir, layout.brief(UNIT, TOPIC), '# Timing\n');
  writeState(dir, layout.topic(UNIT, TOPIC, 'log.md'), '# Discussion — timing\n');
  commitAll(dir, 'the lab');
  for (const [slug, text] of [['window-placement', 'Where does a new window open?'], ['window-size', 'How big is a new window?']]) {
    const question = ok(dir, ['ledger', 'ask', `${UNIT}.discussion.${TOPIC}`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text }) }).id;
    ok(dir, ['experiment', 'create', UNIT, TOPIC, '--slug', slug, '--from', 'discussion', '--problem', problemScratch(dir, slug), '--question', question]);
  }
});

let dir; // the project
let config; // the system config: the conversation's folder

/** The engine as this test's conversation runs it. */
const env = () => ({ ...SESSION, LEDGER_CONFIG_DIR: config, CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined });

/** An entry that must succeed: its response and its sections. @param {string[]} args */
const enter = (args) => okSections(dir, ['enter', ...args], { env: env() });

/** An entry that must refuse, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['enter', ...args], { env: env() }).error;

/** The gate last shown answered `key`: the row's next. @param {string} gate @param {string} key */
const answered = (gate, key) => ok(dir, ['gate', gate, '--pick', key], { env: env() }).next;

/** The position recorded for the conversation, or null. */
function position() {
  try { return JSON.parse(fs.readFileSync(path.join(config, 'conversations', SESSION.CLAUDE_CODE_SESSION_ID, 'position.json'), 'utf8')); } catch { return null; }
}

/** A record's folder, absolute. @param {...string} records */
const folder = (...records) => statePath(dir, layout.experiment(UNIT, TOPIC, ...records));

/** A document written in E1's record. @param {string} file */
function written(file) {
  fs.writeFileSync(path.join(folder('E1-window-placement'), file), `# ${file}\n`);
}

/** A laboratory verb on timing, as this conversation runs it, the laboratory's hold its own. @param {string} verb @param {...string} args */
const lab = (verb, ...args) => ok(dir, ['experiment', verb, UNIT, TOPIC, ...args], { env: env() });

/** An experiment of timing abandoned. @param {string} id */
const abandoned = (id) => lab('abandon', id, '--reason', 'moot');

/** E1 walked to `status` through the legal steps. @param {'designed'|'running'} status */
function walked(status) {
  for (const verb of status === 'designed' ? ['advance'] : ['advance', 'approve', 'advance']) lab(verb, 'E1');
}

/** The DATA's lines. @param {string} sections */
const dataOf = (sections) => sectionOf(sections, 'DATA').trimEnd().split('\n');

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-enter-experiment-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('what cannot be entered is refused, naming the way on, and nothing is written', () => {
  it('a topic with no experiment, and one whose every experiment has ended: the next is spawned from its discussion', () => {
    const none = refused(['experiment', UNIT, 'layout']);
    abandoned('E1');
    abandoned('E2');
    assert.deepStrictEqual([none, refused(['experiment', UNIT, TOPIC]), position()], [
      'the topic "layout" has no experiment — one is spawned from its discussion',
      'every experiment of the topic "timing" has ended — the next is spawned from its discussion',
      null,
    ]);
  });

  it('a record named that is no live experiment of the series — unknown, ended, or a split worked inside its parent\'s run', () => {
    abandoned('E2');
    walked('running');
    lab('create', '--slug', 'part', '--parent', 'E1');
    const live = 'its live experiments are E1, a split worked inside its parent\'s run';
    assert.deepStrictEqual(['E9', 'E2', 'E1.1'].map((id) => refused(['experiment', UNIT, TOPIC, '--record', id])), [
      `"E9" is not a live experiment of the topic "timing" — ${live}`,
      `"E2" is not a live experiment of the topic "timing" — ${live}`,
      `"E1.1" is not a live experiment of the topic "timing" — ${live}`,
    ]);
  });

  it('a record into a row that takes none, a record missing, or named twice is no entry', () => {
    for (const args of [
      ['discussion', UNIT, TOPIC, '--record', 'E1'], ['experiment', UNIT, TOPIC, '--record'], ['experiment', UNIT, TOPIC, '--record', '--take'],
      ['experiment', UNIT, TOPIC, '--record', 'E1', '--record', 'E2'],
    ]) {
      assert.strictEqual(refused(args), USAGE, args.join(' '));
    }
  });
});

describe('several live: the pick, asked first and writing nothing (6.1.21)', () => {
  it('draws the register, then the pick, one row for each live experiment entering it again by its record, its back the epic\'s menu — no position, no presence, no entry recorded', () => {
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter(['experiment', UNIT, TOPIC]);
    const nexts = ['E2', 'b'].map((key) => {
      enter(['experiment', UNIT, TOPIC]);
      return answered('experiment pick', key);
    });
    assert.deepStrictEqual([res, sections.indexOf('=== DISPLAY: experiment register'), sectionOf(sections, 'MENU: experiment pick'), nexts], [
      { ok: true, phase: 'experiment', unit: UNIT, topic: TOPIC, entered: false },
      0,
      [
        '· · · · · · · · · · · ·',
        '**`◆ Which experiment?`**',
        '',
        '**`E1`**     → window-placement — *conceived*',
        '**`E2`**     → window-size — *conceived*',
        '**`b/back`** → Leave without picking one',
        '',
      ].join('\n'),
      [{ kind: 'engine', argv: ['enter', 'experiment', UNIT, TOPIC, '--record', 'E2'] }, { kind: 'handoff', skill: 'ledger-continue-epic', args: [UNIT] }],
    ]);
    const cache = statePath(dir, layout.cache(UNIT, 'experiment', TOPIC));
    assert.deepStrictEqual([position(), fs.existsSync(path.join(cache, 'presence')), fs.existsSync(path.join(cache, 'entered.json')), stateGit(dir, ['rev-parse', 'HEAD']).trim()], [null, false, false, head]);
  });

  it('a row picked enters the experiment it names', () => {
    enter(['experiment', UNIT, TOPIC]);
    const { res, sections } = enter(answered('experiment pick', 'E2').argv.slice(1));
    assert.deepStrictEqual([res.entered, dataOf(sections)[0], position()], [true, 'experiment: E2', { name: UNIT, phase: 'experiment', topic: TOPIC }]);
  });

  it('reached from the next experiment\'s gate, the pick\'s back puts that gate back, and keeps it there when the pick is drawn again', () => {
    output(dir, ['render', 'experiment-next-gate', `${UNIT}.experiment.${TOPIC}`], { env: env() });
    const again = answered('experiment next gate', 'y');
    enter(again.argv.slice(1));
    enter(again.argv.slice(1));
    assert.deepStrictEqual(answered('experiment pick', 'b'), { kind: 'engine', argv: ['render', 'experiment-next-gate', `${UNIT}.experiment.${TOPIC}`] });
  });

  it('held by another session, the held question comes before the pick; its yes takes the laboratory, and the pick then carries the take on each row (18.4.21)', () => {
    ok(dir, ['presence', 'beat', UNIT, 'experiment', TOPIC], { env: { LEDGER_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'peer', CLAUDE_PID: PEER } });
    const held = enter(['experiment', UNIT, TOPIC]);
    const take = answered('held topic gate', 'y');
    const picked = enter(take.argv.slice(1));
    assert.deepStrictEqual([held.res.entered, held.sections.startsWith('=== MENU: held topic gate'), take, picked.res.entered, answered('experiment pick', 'E1')], [
      false, true, { kind: 'engine', argv: ['enter', 'experiment', UNIT, TOPIC, '--take'] }, false,
      { kind: 'engine', argv: ['enter', 'experiment', UNIT, TOPIC, '--take', '--record', 'E1'] },
    ]);
  });
});

describe('what the laboratory reads (2.10.3)', () => {
  it('before the approval: the experiment, its status and folder, its problem and its design, then the spawning topic\'s record, its log and its brief — the place recorded, nothing committed or started', () => {
    abandoned('E2');
    written('design.md');
    walked('designed');
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    const { res, sections } = enter(['experiment', UNIT, TOPIC]);
    const record = folder('E1-window-placement');
    assert.deepStrictEqual([res, dataOf(sections), position(), stateGit(dir, ['rev-parse', 'HEAD']).trim()], [
      { ok: true, phase: 'experiment', unit: UNIT, topic: TOPIC, entered: true, started: false },
      [
        'experiment: E1', 'status: designed', `folder: ${record}`, `problem: ${record}/problem.md`, `design: ${record}/design.md`,
        `topic record: \`${ENGINE} ledger record ${UNIT} ${TOPIC}\``,
        `topic log: ${statePath(dir, layout.topic(UNIT, TOPIC, 'log.md'))}`,
        `brief: ${statePath(dir, layout.brief(UNIT, TOPIC))}`,
      ],
      { name: UNIT, phase: 'experiment', topic: TOPIC },
      head,
    ]);
  });

  it('from the approval: the record\'s own documents and each split with its status and folder, never the spawning topic', () => {
    abandoned('E2');
    written('design.md');
    walked('running');
    written('report.md');
    lab('create', '--slug', 'part', '--parent', 'E1');
    const record = folder('E1-window-placement');
    assert.deepStrictEqual(dataOf(enter(['experiment', UNIT, TOPIC]).sections), [
      'experiment: E1', 'status: running', `folder: ${record}`, `problem: ${record}/problem.md`, `design: ${record}/design.md`, `report: ${record}/report.md`,
      `split: E1.1 conceived ${folder('E1-window-placement', 'E1.1-part')}`,
    ]);
  });

  it('a record named among several live is the one entered', () => {
    assert.deepStrictEqual(dataOf(enter(['experiment', UNIT, TOPIC, '--record', 'E2']).sections).slice(0, 3), [
      'experiment: E2', 'status: conceived', `folder: ${folder('E2-window-size')}`,
    ]);
  });
});
