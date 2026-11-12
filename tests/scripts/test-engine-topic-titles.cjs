'use strict';

// ---------------------------------------------------------------------------
// A started topic the person renamed goes by its title (8.8.17): every screen
// that names a topic names it so, the map's readers carry the title beside
// the key, and a send aimed at the title lands in the topic's own mailbox.
// Every screen names a topic through one helper (derivations.cjs: `titled`,
// `itemTitle`, `goesBy`), held by a guard over every titlecase in the
// engine's domain and the gateways.
//
// Layer: verb. World: a project with its state worktree, built once and
// copied, holding the epic `fumi`: its note window under discussion and
// renamed `quick-notes`, its checklist closed and an agent running on it, a
// question moved to it from where notes open, an experiment it awaits, the
// specification it sources gone back for it, and a peer session holding it.
// The screens render over one copy, in process where the catalogue has them;
// a send has a copy of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, output, refusedPristine, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, readManifest, writeState, statePath, layout } = require('./discovery-test-utils.cjs');
const { SESSION, MADE, row } = require('./ledger-world.cjs');
const { markAllButTheClosingPass } = require('./decided-world.cjs');
const { renderSurface } = require('./render-surfaces-world.cjs');

const SKILLS = path.join(__dirname, '../../skills');
const DOMAIN = path.join(SKILLS, 'leeway-engine/scripts/domain');
const { raiseScreenOf } = require(path.join(DOMAIN, 'raise.cjs'));

const UNIT = 'fumi';
const KEY = 'note-window';
const NAME = 'quick-notes';
const TITLE = 'Quick Notes';
const PEER = Object.freeze({ id: 'peer-session', pid: String(process.ppid) });

/** A ledger write in `dir` that must land: its short id. @param {string} dir @param {string} verb @param {string} topic @param {string[]} flags @param {Record<string, unknown>} content */
function write(dir, verb, topic, flags, content) {
  return ok(dir, ['ledger', verb, `${UNIT}.discussion.${topic}`, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** `args` run as another live session, from a config folder of its own. @param {string} dir @param {string[]} args */
function asPeer(dir, args) {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-titles-peer-'));
  try {
    return ok(dir, args, { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: PEER.id, CLAUDE_PID: PEER.pid, TMUX: undefined } });
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
}

/** A send in `dir` that must land: its response. @param {string} dir @param {string} to @param {string} from @param {string} slug */
function sendIn(dir, to, from, slug) {
  const content = writeState(dir, layout.cache('scratch', 'message.md'), 'Open it top left\n\nTheir reasoning: the eye lands there.\n');
  return ok(dir, ['topic', 'send', UNIT, to, '--from', from, '--content', content, '--slug', slug]);
}

/**
 * `phases` gone from the unit in `dir`: a specification sourcing a topic
 * holds its cancel and its postpone shut, and a live experiment its postpone.
 * @param {string} dir @param {string[]} phases
 */
function without(dir, ...phases) {
  const manifest = readManifest(dir, UNIT);
  for (const phase of phases) delete manifest.phases[phase];
  createManifest(dir, UNIT, manifest);
}

/** `out` names the topic as `phrase` does, and never by its key titlecased. @param {string} out @param {string} phrase */
function assertTitled(out, phrase) {
  assert.ok(out.includes(phrase), `no "${phrase}" in:\n${out}`);
  assert.ok(!out.includes('Note Window'), `the key titlecased in:\n${out}`);
}

const world = fixtureFrom('topic-titles-', (dir) => {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { [KEY]: row(1, 'The note window'), 'space-homing': row(2, 'Where notes open'), sync: row(3, 'Sync') } },
      discussion: { items: { [KEY]: { status: 'in-progress' }, 'space-homing': { status: 'in-progress' }, sync: { status: 'completed' } } },
    },
  });
  const corner = write(dir, 'ask', 'space-homing', [], { ...MADE, text: 'Which corner does a note open in?' });
  write(dir, 'move', 'space-homing', ['--question', corner, '--to', KEY], MADE);
  write(dir, 'decide', KEY, ['--answers', corner], { ...MADE, text: 'Top left.', why: 'Where the eye lands.' });
  markAllButTheClosingPass(dir, UNIT, KEY);
  ok(dir, ['checklist', 'done', 'decided', UNIT, KEY, 'closing-pass'], { env: SESSION });
  ok(dir, ['checklist', 'close', 'decided', UNIT, KEY], { env: SESSION });
  ok(dir, ['topic', 'rename', UNIT, KEY, NAME]);
  const manifest = readManifest(dir, UNIT);
  manifest.phases.discussion.items[KEY].awaiting_experiments = ['E1'];
  manifest.phases.experiment = { items: { [KEY]: { status: 'in-progress', experiments: { E1: { slug: 'open-time', status: 'designed', question: 'How long does a note take to open?' } } } } };
  manifest.phases.specification = { items: { windows: { status: 'in-progress', sources: { [KEY]: { status: 'stale' }, sync: { status: 'incorporated' } } } } };
  createManifest(dir, UNIT, manifest);
  ok(dir, ['agent', 'dispatch', UNIT, 'discussion', KEY, '--kind', 'deep-dive'], { env: { ...SESSION, CLAUDE_PID: String(process.pid) } });
  asPeer(dir, ['presence', 'beat', UNIT, 'discussion', KEY]);
});

describe('a started topic renamed goes by its title on every screen that names it (8.8.17)', () => {
  /** @type {string} */
  let dir;
  before(() => { dir = world(); });
  after(() => { cleanupFixture(dir); });

  /** A surface of the catalogue, rendered in process. @param {string} surface @param {Record<string, string>} args */
  const shown = (surface, args) => renderSurface(dir, surface, args);

  /** A raise drawn on the topic, as sealed. */
  const SEAL = Object.freeze({
    id: 'r1', menu: 'raise', fact: false, reason: 'It decides where a note opens.', replaces: null, parks: null,
    place: { unit: UNIT, phase: 'discussion', topic: KEY },
    call: { question: 'Which corner?', rows: [], lean: 'a', why: 'Habit.', sort: 'one', mechanism: 'The window frame.', product_wide: false },
  });

  /** @type {[string, () => string, string][]} */
  const SURFACES = [
    ['the topic\'s own map', () => shown('map', { dotpath: `${UNIT}.${KEY}` }), `Map — ${TITLE}`],
    ['the map a question moved from', () => shown('map', { dotpath: `${UNIT}.space-homing` }), `moved to ${TITLE}`],
    ['the decided screen', () => shown('decided', { dotpath: `${UNIT}.${KEY}`, file: writeState(dir, layout.cache('scratch', 'decided.json'), JSON.stringify({ lines: [], candidates: [] })) }), `Your yes marks ${TITLE} decided.`],
    ['the wait for agents', () => shown('wait-agents', { dotpath: `${UNIT}.${KEY}` }), `Still running on ${TITLE}: 1 deep dive.`],
    ['the experiment register', () => shown('experiment-register', { dotpath: `${UNIT}.experiment.${KEY}` }), `Experiments — ${TITLE} (1 experiment)`],
    ['the raise screen', () => raiseScreenOf(dir, /** @type {any} */ (SEAL)), `Fumi · ${TITLE}`],
    ['the epic menu', () => shown('epic-menu', { dotpath: UNIT }), `Close "${TITLE}" as decided`],
    ['enter\'s held question', () => output(dir, ['enter', 'discussion', UNIT, KEY], { env: SESSION }), `"${TITLE}" is open in another session`],
    ['the handoff line', () => output(dir, ['handoff', 'leeway-discussion-process', 'epic', UNIT, KEY]), `→ Discussion · ${NAME}`],
  ];

  for (const [surface, render, phrase] of SURFACES) {
    it(`${surface} names it "${phrase}", never by its key titlecased`, () => assertTitled(render(), phrase));
  }

});

describe('a screen that writes as it shows, or over the unit changed, goes by the title too, on a copy of its own (8.8.17)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });

  /** @type {[string, () => string, string][]} */
  const SURFACES = [
    ['the phase note, beating the topic\'s presence', () => renderSurface(dir, 'phase-note', { dotpath: `${UNIT}.discussion.${KEY}`, verb: 'Resuming' }), `Resuming discussion: ${TITLE}`],
    ['the cancel gate', () => {
      without(dir, 'specification');
      return renderSurface(dir, 'cancel-gate', { dotpath: `${UNIT}.discovery.${KEY}` });
    }, `Cancelling **${TITLE}**`],
    ['the postpone gate', () => {
      without(dir, 'specification', 'experiment');
      return renderSurface(dir, 'postpone-gate', { dotpath: `${UNIT}.discovery.${KEY}`, horizon: 'next' });
    }, `Postponing **${TITLE}**`],
  ];

  for (const [surface, render, phrase] of SURFACES) {
    it(`${surface} names it "${phrase}", never by its key titlecased`, () => assertTitled(render(), phrase));
  }
});

describe('a send by the title (8.8.17, 10.3.4)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });

  it('lands in the topic\'s own mailbox, under its key, and its report and sender line name it by its title', () => {
    const sent = sendIn(dir, NAME, 'space-homing', 'corner');
    assert.strictEqual(sent.message_path, statePath(dir, layout.mailbox(UNIT, KEY, '001-corner.md')));
    assert.strictEqual(sent.topic, KEY);
    assert.match(output(dir, ['render', 'send-report', `${UNIT}.${NAME}`, '--sent', sent.message_path]), new RegExp(`^Sent to ${TITLE}, on Fumi$`, 'm'));
    const back = sendIn(dir, 'space-homing', KEY, 'frame');
    assert.match(fs.readFileSync(back.message_path, 'utf8'), new RegExp(`^From ${TITLE} · `, 'm'));
  });
});

describe('every other verb, render and entry that names a topic takes its title, and acts on its key (8.8.17)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });

  /** The gate `render` draws, answered `pick`: the row's next argv. @param {string[]} render @param {string} gate @param {string} pick */
  function answered(render, gate, pick) {
    output(dir, ['render', ...render], { env: SESSION });
    return ok(dir, ['gate', gate, '--pick', pick], { env: SESSION }).next.argv;
  }

  /** The line of `out` that `pattern` opens. @param {string} out @param {RegExp} pattern */
  const lineOf = (out, pattern) => out.split('\n').find((line) => pattern.test(line)) ?? '';

  // Each call names the topic by its title: a verb answers the key it acted
  // on, a gate's row carries it, a render reads the topic under it. A topic
  // left from a conversation sitting in it hands that conversation to the
  // epic's menu.
  /** @type {[string, () => string, string][]} */
  const CALLS = [
    ['topic edit', () => ok(dir, ['topic', 'edit', UNIT, NAME, '--summary', 'Notes, quickly']).name, KEY],
    ['topic rename', () => ok(dir, ['topic', 'rename', UNIT, NAME, 'note-pane']).renamed_from, KEY],
    ['topic remove, refused for a started topic', () => refusedPristine(dir, ['topic', 'remove', UNIT, NAME]).error, `"${KEY}" can't be removed — discussion is in flight on it; cancel it instead: topic cancel ${UNIT} discovery ${KEY}`],
    ['topic order', () => Object.keys(ok(dir, ['topic', 'order', UNIT, `${NAME}=3`]).ordered).join(), KEY],
    ['topic brief, refused for a started topic', () => {
      const draft = writeState(dir, layout.cache('scratch', 'brief.md'), 'What notes are for.\n');
      return refusedPristine(dir, ['topic', 'brief', UNIT, NAME, '--brief', draft]).error;
    }, `topic brief: "${KEY}" started — what bears on it goes as a message`],
    ['topic cancel', () => {
      without(dir, 'specification');
      ok(dir, ['enter', 'discussion', UNIT, NAME, '--take'], { env: SESSION });
      const { topic, next } = ok(dir, ['topic', 'cancel', UNIT, 'discovery', NAME], { env: SESSION });
      return `${topic} ${next.kind}`;
    }, `${KEY} handoff`],
    ['topic reactivate', () => {
      without(dir, 'specification');
      ok(dir, ['topic', 'cancel', UNIT, 'discovery', KEY]);
      return ok(dir, ['topic', 'reactivate', UNIT, 'discovery', NAME]).topic;
    }, KEY],
    ['topic postpone', () => {
      without(dir, 'specification', 'experiment');
      ok(dir, ['enter', 'discussion', UNIT, NAME, '--take'], { env: SESSION });
      const { topic, next } = ok(dir, ['topic', 'postpone', UNIT, NAME, '--horizon', 'later'], { env: SESSION });
      return `${topic} ${next.kind}`;
    }, `${KEY} handoff`],
    ['topic postpone, its roadmap item and its return', () => {
      without(dir, 'specification', 'experiment');
      ok(dir, ['topic', 'postpone', UNIT, NAME, '--horizon', 'later']);
      const { roadmap } = JSON.parse(fs.readFileSync(statePath(dir, 'manifest.json'), 'utf8'));
      const back = ok(dir, ['roadmap', 'pull-forward', NAME, '--into', UNIT]);
      return [Object.keys(roadmap.items).join(), roadmap.items[NAME]?.postponed_from.topic, back.topic, readManifest(dir, UNIT).phases.discovery.items[KEY].postponed === true].join(' ');
    }, `${NAME} ${KEY} ${KEY} false`],
    ['render postpone-gate, beside a roadmap item of its title\'s name', () => {
      without(dir, 'specification', 'experiment');
      ok(dir, ['roadmap', 'add', NAME, '--horizon', 'later', '--summary', 'Not this topic']);
      return refusedPristine(dir, ['render', 'postpone-gate', `${UNIT}.discovery.${NAME}`, '--horizon', 'later']).error;
    }, `render postpone-gate: postponing "${KEY}" is refused — a roadmap item named "${NAME}" (horizon "later") is not this topic's: rename it on the roadmap, or rename the topic, first`],
    ['render approve-map, its yes', () => {
      const staged = writeState(dir, layout.cache('scratch', 'approve-map.json'), JSON.stringify({ topics: [{ name: NAME }, { name: 'space-homing' }, { name: 'sync' }] }));
      return ok(dir, answered(['approve-map', UNIT, '--file', staged], 'approve the map', 'y')).topics.join();
    }, `${KEY},space-homing,sync`],
    ['render cancel-gate, its yes', () => {
      without(dir, 'specification');
      return answered(['cancel-gate', `${UNIT}.discovery.${NAME}`], 'cancel gate', 'y').join(' ');
    }, `topic cancel ${UNIT} discovery ${KEY}`],
    ['render postpone-gate, its yes', () => {
      without(dir, 'specification', 'experiment');
      return answered(['postpone-gate', `${UNIT}.discovery.${NAME}`, '--horizon', 'later'], 'postpone gate', 'y').join(' ');
    }, `topic postpone ${UNIT} ${KEY} --horizon later`],
    ['render horizon-pick, a horizon\'s row', () => {
      ok(dir, ['roadmap', 'add', 'offline-notes', '--horizon', 'later', '--summary', 'Notes offline']);
      return answered(['horizon-pick', `${UNIT}.discovery.${NAME}`], 'horizon pick', '1').join(' ');
    }, `render postpone-gate ${UNIT}.discovery.${KEY} --horizon later`],
    ['render topic-receipt', () => {
      without(dir, 'specification');
      ok(dir, ['topic', 'cancel', UNIT, 'discovery', KEY]);
      return lineOf(output(dir, ['render', 'topic-receipt', `${UNIT}.discovery.${NAME}`, '--verb', 'cancel']), /^Cancelled /);
    }, `Cancelled "${TITLE}".`],
    ['render map', () => lineOf(output(dir, ['render', 'map', `${UNIT}.${NAME}`]), /^Map — /), `Map — ${TITLE}`],
    ['render convergence', () => refusedPristine(dir, ['render', 'convergence', `${UNIT}.${NAME}`, '--asked'], { env: SESSION }).error, `render convergence: nothing is open on ${TITLE} to settle`],
    ['enter discussion', () => ok(dir, ['enter', 'discussion', UNIT, NAME, '--take'], { env: SESSION }).topic, KEY],
    ['handoff topic', () => lineOf(output(dir, ['handoff', 'topic', UNIT, NAME]), /^args: /), `args: epic ${UNIT} ${KEY}`],
  ];

  for (const [named, act, expected] of CALLS) {
    it(`${named}: the title resolves to the topic's key`, () => assert.strictEqual(act(), expected));
  }

  it('a name no topic goes by is refused naming the map\'s topics, by the names they go by', () => {
    assert.strictEqual(refusedPristine(dir, ['topic', 'postpone', UNIT, 'ghost', '--horizon', 'later']).error,
      `no topic "ghost" — the map's topics are ${NAME}, space-homing, sync`);
  });
});

describe('the hand into the spec names the unit it is entered at (8.8.17)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });

  /** The line a hand into a skill shows. @param {string[]} args */
  const handLine = (...args) => output(dir, ['handoff', ...args]).split('\n').find((line) => line.startsWith('→ '));

  it('the hand into the spec names the unit it is entered at, the hand into the topic\'s discussion by the title', () => {
    assert.deepStrictEqual([handLine('leeway-specification-process', 'epic', UNIT), handLine('leeway-discussion-process', 'epic', UNIT, KEY)],
      [`→ Specification · ${UNIT}`, `→ Discussion · ${NAME}`]);
  });

});

describe('every screen names a topic through one helper', () => {
  // Every titlecase of a name no topic phase holds, by what it names:
  // `file › owner › argument`, the file under the engine's domain unless it
  // names its skill. A topic's name goes through `titled` or `itemTitle`,
  // which give a started topic its title.
  const NOT_A_TOPIC = {
    'the helpers a topic\'s name goes through': [
      'derivations.cjs › itemTitle › itemName(titles, phase, name)',
      'derivations.cjs › titled › goesBy(titles, topic)',
    ],
    'a work unit, or the project': [
      'board.cjs › unitAt › unit',
      'inbox-set.cjs › archivedItems › closure.unit',
      'projections/board-quick-fix.cjs › ledgerAt › unit',
      'mail.cjs › sendReportOf › unit',
      'mail.cjs › topicSender › unit',
      'projections/board-all.cjs › allView › name',
      'projections/board-all.cjs › roadmapLine › from.work_unit',
      'projections/discovery-gates.cjs › approveMapScreen › unit',
      'projections/discovery-gates.cjs › startDisplay › name',
      'projections/epic-menu.cjs › epicMenuScreen › epic',
      'projections/mail.cjs › sendReport › unit',
      'projections/raise.cjs › header › unit',
      'projections/manage.cjs › absorbTargetSurface › epic',
      'projections/manage.cjs › absorbTargetSurface › name',
      'projections/manage.cjs › manageUnitScreen › manifest.name',
      'projections/manage.cjs › unitRowOn › manifest.name',
      'projections/start-menu.cjs › unitRow › name',
      'projections/start.cjs › completedActions › workUnit',
      'projections/transactions.cjs › absorbContinuationMenu › epic',
      'projections/transactions.cjs › absorbContinuationMenu › feature',
      'projections/transactions.cjs › absorbReceipt › epic',
      'projections/transactions.cjs › absorbSummary › epic',
      'projections/transactions.cjs › absorbSummary › feature',
      'projections/transactions.cjs › inboxRestoreReceipt › unclaimedFrom',
      'projections/transactions.cjs › pivotContinuationMenu › workUnit',
      'projections/transactions.cjs › stayedLines › unit',
      'projections/transactions.cjs › workunitReceipt › workUnit',
      'render.cjs › phaseCompleted › workUnit',
      'render.cjs › workUnitCancel › workUnit',
      'state-checks.cjs › projectName › path.basename(path.dirname(stateRoot(cwd)))',
      'state-merge-landing.cjs › openMerge › path.basename(path.dirname(root))',
      'state-merge-rules.cjs › conflictLabel › unit',
      'topic-map.cjs › goneTo › where.unit',
      'verdict.cjs › placeName › unit',
    ],
    'a phase, or a work type': [
      'handoff.cjs › phaseTarget › phase',
      'projections/epic-menu.cjs › epicMenuScreen › phase',
      'projections/workunit.cjs › revisitPhasesSection › phase',
      'render.cjs › phaseCompleted › phase',
      'render.cjs › resolveWorkUnit › String(manifest.work_type || \'\')',
    ],
    'a build, named for itself': [
      'projections/enter.cjs › codeGate › h.topic',
    ],
    'a name not on the map yet, or not on it any more': [
      'projections/closing.cjs › candidateTree › name',
      'projections/decided.cjs › strikePick › name',
      'projections/discovery-map.cjs › struckBlock › name',
      'projections/transactions.cjs › absorbReceipt › topic',
      'render.cjs › candidateGate › p.name',
    ],
    'a roadmap item or an inbox item': [
      'projections/roadmap.cjs › horizonLines › row.name',
      'projections/roadmap.cjs › roadmapHarvestSurface › entry.name',
      'projections/roadmap.cjs › roadmapNodes › row.name',
      'projections/transactions.cjs › backOnTheRoadmap › name',
      'projections/transactions.cjs › stayedLines › name',
      'projections/transactions.cjs › MAP_LINES › c.from_roadmap',
      'render.cjs › horizonBack › name',
      'render.cjs › puttingLine › names[0]',
      'render.cjs › parkGate › name',
      'render.cjs › postponeStatement › target.name',
      'roadmap.cjs › addRoadmapItem › name',
    ],
    'an experiment, by its slug where the question it measures is not on the ledger': [
      'projections/board-experiment.cjs › experimentView › record.slug',
    ],
    'a spike, by its folder\'s slug': [
      "projections/board-discovery.cjs › spikesAt › spike.replace(/^\\d+-/, '')",
    ],
  };

  /** Every .cjs file under `dir`. @param {string} dir @returns {string[]} */
  const scripts = (dir) => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs'))
    .map((entry) => path.join(entry.parentPath, entry.name));

  /** What a call's parentheses hold, from just past its opening one. @param {string} line @param {number} from */
  function argumentAt(line, from) {
    let depth = 1;
    let at = from;
    while (at < line.length && depth > 0) {
      depth += line[at] === '(' ? 1 : line[at] === ')' ? -1 : 0;
      at += 1;
    }
    return line.slice(from, depth === 0 ? at - 1 : at);
  }

  /** Each titlecase in `file`, as `file › owner › argument`: its definition, its imports and its exports aside. @param {string} file */
  function titlecasesIn(file) {
    const name = path.relative(file.startsWith(DOMAIN) ? DOMAIN : SKILLS, file);
    /** @type {string[]} */
    const uses = [];
    let owner = '(top)';
    let exporting = false;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const opened = /^(?:async )?function (\w+)|^const (\w+) =/.exec(line);
      if (opened !== null) owner = opened[1] ?? opened[2];
      exporting ||= line.startsWith('module.exports');
      const aside = exporting || line.includes('require(') || /^\s*(\*|\/\/|\/\*)/.test(line) || line.startsWith('function titlecase(');
      if (exporting && /}\s*;?\s*$/.test(line)) exporting = false;
      if (aside) continue;
      for (const use of line.matchAll(/\btitlecase\b(\()?/g)) {
        uses.push(`${name} › ${owner} › ${use[1] ? argumentAt(line, /** @type {number} */ (use.index) + use[0].length) : '<passed>'}`);
      }
    }
    return uses;
  }

  it('titlecases no topic\'s name: each titlecase in the domain and the gateways names something no topic phase holds', () => {
    const gateways = fs.readdirSync(SKILLS).map((skill) => path.join(SKILLS, skill, 'scripts/gateway.cjs')).filter((file) => fs.existsSync(file));
    const found = [...new Set([...scripts(DOMAIN), ...gateways].flatMap(titlecasesIn))].sort();
    assert.deepStrictEqual(found, Object.values(NOT_A_TOPIC).flat().sort(),
      'a topic\'s name goes through titled or itemTitle (derivations.cjs), which give a started topic its title; list a titlecase here only for a name no topic phase holds');
  });
});
