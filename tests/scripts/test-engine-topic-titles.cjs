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

const { ok, output, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, readManifest, writeState, statePath, layout } = require('./discovery-test-utils.cjs');
const { SESSION, MADE, row } = require('./ledger-world.cjs');
const { markAllButTheClosingPass } = require('./decided-world.cjs');
const { renderSurface } = require('./render-surfaces-world.cjs');

const SKILLS = path.join(__dirname, '../../skills');
const DOMAIN = path.join(SKILLS, 'leeway-engine/scripts/domain');
const { raiseScreenOf } = require(path.join(DOMAIN, 'raise.cjs'));
const { epicDashboard, epicMenu, epicMenuKeys, epicInSessionGate } = require(path.join(DOMAIN, 'projections/epic.cjs'));
const epicGateway = require(path.join(SKILLS, 'leeway-continue-epic/scripts/gateway.cjs'));
const discoveryGateway = require(path.join(SKILLS, 'leeway-discovery/scripts/gateway.cjs'));

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

  /** The epic's detail as its menu reads it, and the peer's hold on the topic. */
  function epic() {
    const detail = epicGateway.discover(dir, UNIT);
    const presence = [{ phase: 'discussion', topic: KEY, age_seconds: 120, held: true, session_id: PEER.id }];
    return { detail, presence };
  }

  /** A raise drawn on the topic, as sealed. */
  const SEAL = Object.freeze({
    id: 'r1', menu: 'raise', fact: false, reason: 'It decides where a note opens.', replaces: null,
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
    ['a paused discussion', () => shown('phase-paused', { dotpath: UNIT, phase: 'discussion' }), `"${TITLE}" awaits experiment evidence (E1)`],
    ['a paused specification', () => shown('phase-paused', { dotpath: UNIT, phase: 'specification' }), `"Windows" awaits the ${NAME} discussion`],
    ['the direct-entry gate', () => shown('direct-entry-gate', { dotpath: `${UNIT}.discussion.${KEY}` }), `⚑ "${TITLE}" is already on the map`],
    ['the entry gate', () => shown('entry-gate', { dotpath: `${UNIT}.specification.windows` }), `Sources for "Windows" are not concluded: ${NAME}`],
    ['the resume gate', () => shown('resume-gate', { dotpath: `${UNIT}.discussion.${KEY}` }), `Found existing discussion for **${TITLE}**.`],
    ['the raise screen', () => raiseScreenOf(dir, /** @type {any} */ (SEAL)), `Fumi · ${TITLE}`],
    ['the epic dashboard\'s map', () => epicDashboard(UNIT, epic().detail), `├─ ◐ ${TITLE}`],
    ['the epic dashboard\'s specification', () => epicDashboard(UNIT, epic().detail), `├─ ${TITLE}    [stale]`],
    ['the epic menu', () => epicMenu(UNIT, epic().detail, epic()).rendered, `Continue "${TITLE}"`],
    ['the in-session gate', () => {
      const { detail, presence } = epic();
      const held = epicMenuKeys(UNIT, detail, { presence }).find((k) => k.topic === KEY && k.in_session);
      return epicInSessionGate(UNIT, /** @type {any} */ (held), detail.titles);
    }, `"${TITLE}" is open in another session`],
    ['enter\'s held question', () => output(dir, ['enter', 'discussion', UNIT, KEY], { env: SESSION }), `"${TITLE}" is open in another session`],
    ['the handoff line', () => output(dir, ['handoff', 'leeway-discussion-process', 'epic', UNIT, KEY]), `→ Discussion · ${NAME}`],
  ];

  for (const [surface, render, phrase] of SURFACES) {
    it(`${surface} names it "${phrase}", never by its key titlecased`, () => assertTitled(render(), phrase));
  }

  it('the readers Claude matches a name against carry the title beside the key', () => {
    const line = (dump) => dump.split('\n').find((l) => l.includes(` ${KEY} [`));
    assert.match(line(discoveryGateway.format(discoveryGateway.discover(dir, UNIT))), new RegExp(`^ {2}- \\S+ ${KEY} \\[discussing\\] goes_by=${NAME} `));
    assert.match(line(epicGateway.formatScoped(UNIT, epicGateway.discover(dir, UNIT))), new RegExp(`^ {2}- \\S+ ${KEY} \\[discussing\\] goes_by=${NAME} `));
  });
});

describe('a screen that writes as it shows, or over the unit changed, goes by the title too, on a copy of its own (8.8.17)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => { dir = world(); });
  afterEach(() => { cleanupFixture(dir); });

  /**
   * `phases` gone from the unit: a specification sourcing a topic holds its
   * cancel and its postpone shut, and a live experiment its postpone.
   * @param {string[]} phases
   */
  function gone(...phases) {
    const manifest = readManifest(dir, UNIT);
    for (const phase of phases) delete manifest.phases[phase];
    createManifest(dir, UNIT, manifest);
  }

  /** @type {[string, () => string, string][]} */
  const SURFACES = [
    ['the phase note, beating the topic\'s presence', () => renderSurface(dir, 'phase-note', { dotpath: `${UNIT}.discussion.${KEY}`, verb: 'Resuming' }), `Resuming discussion: ${TITLE}`],
    ['the cancel gate', () => {
      gone('specification');
      return renderSurface(dir, 'cancel-gate', { dotpath: `${UNIT}.discovery.${KEY}` });
    }, `Cancelling **${TITLE}**`],
    ['the postpone gate', () => {
      gone('specification', 'experiment');
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
    assert.match(output(dir, ['render', 'send-report', `${UNIT}.${KEY}`, '--sent', sent.message_path]), new RegExp(`^Sent to ${TITLE}, on Fumi$`, 'm'));
    const back = sendIn(dir, 'space-homing', KEY, 'frame');
    assert.match(fs.readFileSync(back.message_path, 'utf8'), new RegExp(`^From ${TITLE} · `, 'm'));
  });
});

describe('a specification sharing the renamed topic\'s key goes by its own name (8.8.17)', () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = world();
    const manifest = readManifest(dir, UNIT);
    manifest.phases.specification.items[KEY] = { status: 'in-progress', sources: { [KEY]: { status: 'incorporated' } } };
    createManifest(dir, UNIT, manifest);
  });
  afterEach(() => { cleanupFixture(dir); });

  /** The line a hand into `skill` at the topic shows. @param {string} skill */
  const handLine = (skill) => output(dir, ['handoff', skill, 'epic', UNIT, KEY]).split('\n').find((line) => line.startsWith('→ '));

  it('the hand into it names it by its key, the hand into the topic\'s discussion by the title', () => {
    assert.deepStrictEqual([handLine('leeway-specification-process'), handLine('leeway-discussion-process')], [`→ Specification · ${KEY}`, `→ Discussion · ${NAME}`]);
  });

  it('a message it sends names it by its own name', () => {
    const sent = sendIn(dir, 'space-homing', KEY, 'frame');
    assert.match(fs.readFileSync(sent.message_path, 'utf8'), /^From Note Window · /m);
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
      'leeway-continue-epic/scripts/gateway.cjs › view › workUnit',
      'mail.cjs › sendReportOf › unit',
      'mail.cjs › topicSender › unit',
      'projections/discovery-map.cjs › discoverySynthesisView › workUnit',
      'projections/discovery-map.cjs › discoveryTitle › workUnit',
      'projections/mail.cjs › sendReport › unit',
      'projections/raise.cjs › header › unit',
      'projections/start.cjs › absorbTargetMenu › name',
      'projections/start.cjs › completedActions › workUnit',
      'projections/start.cjs › completedView › r.work_unit',
      'projections/start.cjs › continueLabel › unit.name',
      'projections/start.cjs › manageListView › r.work_unit',
      'projections/start.cjs › manageUnitView › md.work_unit',
      'projections/start.cjs › startOverview › u.name',
      'projections/transactions.cjs › absorbContinuationMenu › epic',
      'projections/transactions.cjs › absorbContinuationMenu › feature',
      'projections/transactions.cjs › absorbReceipt › epic',
      'projections/transactions.cjs › absorbSummary › epic',
      'projections/transactions.cjs › absorbSummary › feature',
      'projections/transactions.cjs › pivotContinuationMenu › workUnit',
      'projections/transactions.cjs › workunitReceipt › workUnit',
      'projections/wait.cjs › phasePaused › workUnit',
      'projections/workunit.cjs › workUnitMenu › unit.name',
      'projections/workunit.cjs › workUnitTitle › unit.name',
      'render.cjs › entryGate › manifest.name || topic',
      'render.cjs › epicAllDoneGate › workUnit',
      'render.cjs › nextPhaseGate › workUnit',
      'render.cjs › phaseCompleted › workUnit',
      'render.cjs › resumeGate › workUnit',
      'render.cjs › scopingQuestions › workUnit',
      'render.cjs › workUnitCancel › workUnit',
      'state-checks.cjs › projectName › path.basename(path.dirname(stateRoot(cwd)))',
      'state-merge-landing.cjs › openMerge › path.basename(path.dirname(root))',
      'state-merge-rules.cjs › conflictLabel › unit',
      'topic-map.cjs › goneTo › where.unit',
    ],
    'a phase, or a work type': [
      'handoff.cjs › phaseTarget › phase',
      'projections/epic.cjs › groupOf › row.phase',
      'projections/transactions.cjs › workunitReceipt › String(workType || \'\')',
      'projections/wait.cjs › phasePaused › phase',
      'projections/workunit.cjs › pipelineNodes › phase',
      'projections/workunit.cjs › revisitPhasesSection › phase',
      'projections/workunit.cjs › workUnitMenu › phase',
      'projections/workunit.cjs › workUnitStatus › r.phase',
      'render.cjs › nextPhaseGate › prev',
      'render.cjs › phaseCompleted › phase',
      'render.cjs › resolveWorkUnit › String(manifest.work_type || \'\')',
    ],
    'a specification, a plan or a build, named for itself': [
      'epic-detail.cjs › discoveryLockReason › <passed>',
      'projections/epic.cjs › displayRecommendation › owner.name',
      'projections/epic.cjs › entryHoldClause › topic',
      'projections/epic.cjs › epicUnblockMenu › item.name',
      'projections/epic.cjs › plansNotReadyBlock › p.name',
      'projections/specification.cjs › itemBlock › row.name',
      'projections/specification.cjs › rowLabel › row.name',
      'projections/specification.cjs › specificationCompletedMenu › row.name',
      'projections/specification.cjs › specificationConfirmation › c.name',
      'projections/specification.cjs › specificationMenu › row.name',
      'projections/start.cjs › planTopicsPick › t.name',
      'projections/surfaces.cjs › autoSelectLine › name',
      'projections/transactions.cjs › promoteReceipt › topic',
      'render.cjs › aheadPhrase › a.name',
      'render.cjs › codeGate › h.topic',
      'render.cjs › constructionGate › topic',
      'render.cjs › discardedGroupingsClause › n',
      'render.cjs › entryGate › String(item.superseded_by || \'\')',
      'render.cjs › entryGate › String(spec.superseded_by || \'\')',
      'render.cjs › epicSoftGate › topic',
      'render.cjs › externalDependencyGate › dep.name',
      'render.cjs › externalDependencyGate › topic',
      'render.cjs › externalResolutions › name',
      'render.cjs › externalResolutions › topic',
      'render.cjs › missingDependencies › dep.name',
      'render.cjs › planSummary › topic',
      'render.cjs › reviewPresentation › p.topic',
      'render.cjs › specificationCancelStatement › spec',
    ],
    'a bugfix\'s investigation, the unit itself': [
      'render.cjs › fixDirection › topic',
      'render.cjs › hypothesisBoard › topic',
    ],
    'a name not on the map yet, or not on it any more': [
      'projections/decided.cjs › candidateTree › name',
      'projections/decided.cjs › strikePick › name',
      'projections/discovery-map.cjs › proposedNodes › t.name',
      'projections/transactions.cjs › absorbReceipt › topic',
      'projections/transactions.cjs › MAP_LINES › name',
      'render.cjs › candidateGate › p.name',
    ],
    'a roadmap item or an inbox item': [
      'projections/roadmap.cjs › roadmapNodes › row.name',
      'projections/roadmap.cjs › roadmapPullSetView › row.name',
      'projections/transactions.cjs › MAP_LINES › c.from_roadmap',
      'render.cjs › inboxRoadmapGate › item.name',
      'render.cjs › parkGate › name',
      'render.cjs › postponeStatement › target.name',
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
