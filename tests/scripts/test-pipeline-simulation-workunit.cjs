'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's work-unit lifecycle, through manage as the start
// skill runs it (manage-work-unit.md): a cancel through its confirm and the
// unit brought back from the closed units, a completed unit with nothing to
// do to it; a feature pivoted to an epic; a feature absorbed into an epic,
// its epic picked and the absorb confirmed; shared files re-homed by absorb;
// a decision changed mid-build, settled in the build; and the guards holding
// mid-pipeline.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario, and the named world
// `worlds.specToBuild` for the build's; each replays the engine calls the
// skill prose makes, in prose order, and the oracle (pipeline-oracle.cjs)
// audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stateGit, sectionOf, completeUnit, startItem } = require('./engine-harness.cjs');
const {
  Sim, worlds, SPEC_TO_BUILD_UNIT, sessionLog, continueUnit, continueInto, enterEntry, discussed, askedOn, epicRow, startMenu, answerGate, buildEntry,
} = require('./pipeline-world.cjs');
const { leaningCall } = require('./ledger-world.cjs');

const { SHOWN } = require(path.join(__dirname, '../../skills/leeway-engine/scripts/domain/gate.cjs'));

/** @typedef {import('./pipeline-world.cjs').Sim} SimT */
/** @typedef {{kind: string, argv?: string[]}} Next */

// A screen the start skill draws, and the rows of the gate it states, each
// with where it leads.
/** @param {SimT} sim @param {string[]} argv @returns {{out: string, rows: Record<string, Next>}} */
function drawn(sim, argv) {
  const out = sim.render(argv, { expect: 'content' });
  const { options } = JSON.parse(fs.readFileSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, SHOWN), 'utf8'));
  return { out, rows: Object.fromEntries(options.map((/** @type {{key: string, next: Next}} */ { key, next }) => [key, next])) };
}

// A row picked at the gate drawn, and the screen its next draws.
/** @param {SimT} sim @param {string} gate @param {string} key */
function picked(sim, gate, key) {
  const { next } = answerGate(sim, gate, '--pick', key);
  assert.strictEqual(next.argv?.[0], 'render', `${gate}'s ${key} draws another screen`);
  return drawn(sim, next.argv.slice(1));
}

// The unit's row on a list of units picked, its own screen in manage drawn.
/** @param {SimT} sim @param {string} gate @param {{rows: Record<string, Next>}} list @param {string} wu */
function unitPicked(sim, gate, { rows }, wu) {
  const key = Object.keys(rows).find((k) => rows[k].argv?.join(' ') === `render manage-unit ${wu}`);
  assert.ok(key, `${gate} lists ${wu}`);
  return picked(sim, gate, key);
}

// A unit in manage, from the start menu's m (start-menu.md): manage drawn,
// the unit picked. Answers the unit's screen.
/** @param {SimT} sim @param {string} wu */
function managed(sim, wu) {
  assert.ok(startMenu(sim).some(({ key }) => key === 'm'), 'the start menu offers manage');
  return unitPicked(sim, 'manage', picked(sim, 'start menu', 'm'), wu);
}

// A unit among the closed units, from the start menu's v. Answers the
// unit's screen in manage.
/** @param {SimT} sim @param {string} wu */
function closedPicked(sim, wu) {
  assert.ok(startMenu(sim).some(({ key }) => key === 'v'), 'the start menu offers the closed units once a unit has closed');
  return unitPicked(sim, 'closed units', picked(sim, 'start menu', 'v'), wu);
}

// A lifecycle row's verb run as its next names it.
/** @param {SimT} sim @param {Next} next */
const ran = (sim, next) => sim.run(/** @type {string[]} */ (next.argv));

// The pivot as manage-work-unit.md runs it (pivot-to-epic.md): p carries on,
// the topic's words drafted, the verb run, and its receipt.
/** @param {SimT} sim @param {string} wu */
function pivoted(sim, wu) {
  assert.deepStrictEqual(managed(sim, wu).rows.p, { kind: 'continue' }, 'pivot carries on in the conversation');
  answerGate(sim, 'manage unit', '--pick', 'p');
  const res = sim.run(['workunit', 'pivot', wu, '--summary', 'Outgrew a feature', '--description', 'The work grew past one topic.']);
  assert.match(sim.render(['workunit-receipt', wu, '--verb', 'pivot'], { expect: 'content' }), /is an epic now, its discussion the first topic on its map\./);
  return res;
}

describe('pipeline simulation: workunit', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('8.8.8, 18.3.4, 18.3.6: the lifecycle through manage — cancel through its confirm, the unit brought back from the closed units; once complete, nothing to do to it there', () => {
    const wu = 'flip';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Lifecycle', '--session-log-file', log]);
    discussed(sim, wu, wu);

    assert.ok(managed(sim, wu).rows.c, 'manage offers the unit in progress its cancel');
    assert.match(picked(sim, 'manage unit', 'c').out, /Cancelling \*\*Flip\*\* calls off the whole feature/);
    ran(sim, answerGate(sim, 'cancel gate', '--pick', 'y').next);
    assert.strictEqual(sim.manifest(wu).status, 'cancelled');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'cancel'], { expect: 'content' }), /marked as cancelled/);

    assert.deepStrictEqual(Object.keys(closedPicked(sim, wu).rows), ['r', 'h', 'b'], 'a cancelled unit is brought back from the closed units');
    ran(sim, answerGate(sim, 'manage unit', '--pick', 'r').next);
    assert.strictEqual(sim.manifest(wu).status, 'in-progress');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'reactivate'], { expect: 'content' }), /reactivated/);

    completeUnit(sim.dir, wu);
    assert.ok(sim.manifest(wu).completed_at, 'complete stamps completed_at');
    assert.deepStrictEqual(Object.keys(closedPicked(sim, wu).rows), ['h', 'b'], 'a completed unit offers nothing to do to it until its reopen is built');
  });

  it('pivot: a feature with a discussion becomes an epic and its topic keeps working', () => {
    const wu = 'bigger';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Outgrew itself', '--session-log-file', log]);
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, '# Discussion\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);

    pivoted(sim, wu);
    assert.strictEqual(sim.manifest(wu).work_type, 'epic');
    const board = (/** @type {string[]} */ args) => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, ...args])).view;
    const page = board(['--tab', 'unit', '--unit', wu]);
    const row = board(['--tab', 'all']).units.find((/** @type {{unit: string}} */ { unit }) => unit === wu);
    assert.deepStrictEqual([page.kind, page.now, row.phase], ['epic', { phase: 'discussion', since: sim.manifest(wu).phases.discovery.approved_at }, 'discussion'],
      'S1, 18.3.5: the pivot approves the map it lands, so the epic stands past its discovery on its page and in All work, its discovery closed at the pivot');
    assert.deepStrictEqual(Object.keys(managed(sim, wu).rows), ['c', 'h', 'b'], '18.3.5: manage offers the epic a pivot made cancel alone');

    // The pivoted epic's map and phases still derive; the topic is decided
    // as any epic topic is, and, the epic's last, the yes goes into its spec.
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['epic', wu] });
  });

  it('pivot: the map it lands is approved in its order, so its first re-shape marks a topic added as new (8.8.21, 8.S48)', () => {
    const wu = 'bigger';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Outgrew itself', '--session-log-file', sessionLog(sim, wu)]);
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, '# Discussion\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);
    pivoted(sim, wu);
    sim.run(['enter', 'discovery', wu]);
    const brief = sim.write('.leeway/.cache/briefs/extra.md', '# Extra\n\nWhat it is.\n');
    const map = sim.write('.leeway/.cache/scratch/approve-map.json', { topics: [{ name: wu }, { name: 'extra', summary: 'An extra point', brief }], parks: [] });

    const screen = sectionOf(sim.render(['approve-map', wu, '--file', map], { expect: 'content' }), 'DISPLAY: approve the map');
    assert.deepStrictEqual(screen.split('\n').filter((line) => /─ \d\./.test(line)), ['  ├─ 1. Bigger', '  └─ 2. Extra    [new]']);
  });

  it('absorption: a feature folds into an epic as a new topic and disappears', () => {
    const epic = 'umbrella';
    const feat = 'stray';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'The umbrella', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'A stray feature', '--session-log-file', sessionLog(sim, feat)]);
    enterEntry(sim, feat, 'discussion', feat);
    sim.write(`.leeway/${feat}/topics/${feat}/log.md`, '# Discussion — Stray\n');
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`, '--topic', `discussion/${feat}`]);
    // The discussion decides one question, linking the file the person
    // shared, moves another to the roadmap as later, and spawns an
    // experiment measuring a third, still awaiting its evidence: the series
    // travels with the topic, wait and all, and every line the feature made
    // goes with them, the link following its file (5.8.18).
    const at = `${feat}.discussion.${feat}`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    const owner = askedOn(sim, feat, feat, 'Who owns the cutover?');
    const owned = sim.run(['ledger', 'decide', at, '--answers', owner], null, JSON.stringify({ ...made, text: 'The platform team.', why: 'They run the switch.' })).id;
    sim.write(`.leeway/${feat}/assets/runbook.png`, 'the runbook the person shared\n');
    sim.run(['asset', 'add', feat, `${feat}/assets/runbook.png`, '--entry', owned, '--status', 'reference']);
    const rollback = askedOn(sim, feat, feat, 'Can a cutover roll back part way?');
    sim.run(['roadmap', 'add', 'rollback', '--horizon', 'v2', '--summary', 'Rolling a cutover back']);
    sim.run(['ledger', 'move', at, '--question', rollback, '--to', 'roadmap:rollback'], null, JSON.stringify(made));
    const cost = askedOn(sim, feat, feat, 'What does a cutover cost?');
    const spawned = sim.run(['experiment', 'create', feat, feat, '--slug', 'cutover-cost', '--from', 'discussion', '--question', cost,
      '--problem', sim.write(`.leeway/.cache/${feat}/discussion/${feat}/problem.md`, '# Problem — what a cutover actually costs\n')]);
    assert.ok(fs.existsSync(path.join(spawned.dir, 'problem.md')), 'the spawn installs the problem statement');
    // A peer sends a message to the topic — it waits in the topic's
    // mailbox, and the mailbox follows the topic.
    const scratch = sim.write(`.leeway/.cache/${feat}/discussion/${feat}/message-rollback-owner.md`,
      'Rollback owner\n\nWho owns a rollback once the cutover starts?\n');
    const landed = sim.run(['topic', 'send', feat, feat, '--from', feat, '--content', scratch, '--slug', 'rollback-owner']);
    assert.strictEqual(landed.message_path, path.join(sim.dir, `.leeway/${feat}/topics/${feat}/mail/001-rollback-owner.md`));

    // Manage's absorb (absorb-into-epic.md): the epic picked, the topic
    // named as the feature and its words drafted, the confirm over what
    // moves, and its yes.
    assert.ok(managed(sim, feat).rows.o, 'manage offers the feature before its spec its absorb');
    assert.match(picked(sim, 'manage unit', 'o').out, new RegExp(`epic 1: ${epic}`));
    assert.deepStrictEqual(answerGate(sim, 'absorb target', '--pick', '1').next, { kind: 'continue' });
    const words = ['--summary', 'Cutting over', '--description', 'Who runs a cutover, and what it costs.'];
    assert.match(drawn(sim, ['absorb-confirm-gate', feat, '--into', epic, '--topic', feat, ...words]).out, /Experiments: {2}1 experiment\(s\)/,
      'the summary over the confirm derives from the feature manifest — top-level records only');
    const absorbed = ran(sim, answerGate(sim, 'absorb confirm gate', '--pick', 'y').next);
    assert.ok(!fs.existsSync(path.join(sim.dir, '.leeway', feat)), 'feature directory removed');
    assert.deepStrictEqual(absorbed.mail_moved, { path: path.join(sim.dir, `.leeway/${epic}/topics/${feat}/mail`), count: 1 });
    assert.deepStrictEqual(sim.run(['topic', 'mailbox', epic, feat]).files,
      [path.join(sim.dir, `.leeway/${epic}/topics/${feat}/mail/001-rollback-owner.md`)],
      'the waiting message waits on the epic topic — its session raises it');
    assert.match(epicRow(sim, epic, 'Stray') ?? '', /mail waiting/, 'the epic\'s menu cues the waiting message');
    const m = sim.manifest(epic);
    assert.deepStrictEqual(m.phases.discovery.items[feat], { source: 'discovery', summary: 'Cutting over', description: 'Who runs a cutover, and what it costs.' },
      '18.3.7: the topic lands on the map with the words drafted');
    assert.strictEqual(m.phases.discussion.items[feat].status, 'in-progress');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'topics', feat, 'log.md')),
      'the discussion\'s log moved into the epic');

    // The series audits whole at its epic identity — item, record, wait,
    // directory — and its register renders at the epic address.
    const series = m.phases.experiment.items[feat];
    assert.deepStrictEqual([series.status, series.experiments.E1.slug, series.experiments.E1.status], ['in-progress', 'cutover-cost', 'conceived'],
      'the series travels whole — records and derived status intact');
    assert.deepStrictEqual(m.phases.discussion.items[feat].awaiting_experiments, ['E1'], 'the evidence wait rides the moved discussion item');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'topics', feat, 'experiments', 'E1-cutover-cost', 'problem.md')),
      'the record directory moved under the topic name');
    assert.match(sim.render(['experiment-register', `${epic}.experiment.${feat}`], { expect: 'content' }),
      /E1 cutover-cost/, 'the register renders the moved series at the epic address');

    // The feature's lines are the epic topic's: its decision current there,
    // its question moved to the roadmap still later, and the question its
    // experiment measures held from Claude's answer while it runs.
    const read = (/** @type {string[]} */ args) => JSON.parse(sim.read(['ledger', ...args]));
    const shown = () => ({ record: read(['record', epic, feat]), map: read(['map', epic, feat]) });
    const absorbedReads = shown();
    assert.deepStrictEqual(absorbedReads.record.decisions.map((/** @type {{id: string, assets: {path: string}[]}} */ d) => [d.id, d.assets.map((a) => a.path)]),
      [[owned, [`${epic}/assets/runbook.png`]]], 'the feature\'s decision is current at the epic topic, linking its file where it went');
    const rows = new Map(absorbedReads.map.questions.map((/** @type {{id: string}} */ q) => [q.id, q]));
    assert.deepStrictEqual([rows.get(owner).stands, rows.get(rollback).stands, rows.get(rollback).moved_to], ['answered', 'later', 'roadmap:rollback'],
      'the move the feature made holds at the epic topic');
    const epicAt = `${epic}.discussion.${feat}`;
    sim.refuses(['ledger', 'decide', epicAt, '--answers', cost], /is measured by experiment E1, still running/, null,
      JSON.stringify({ ...made, text: 'A day.', why: 'A guess.' }));

    assert.match(sim.render(['absorb-receipt', epic, '--topic', feat, '--experiments', '1'], { expect: 'content' }),
      /• Experiments: 1 moved/, 'absorb receipt renders from the epic post-state and names the moved series');

    // A feature made again under the absorbed one's name holds none of it,
    // and the epic topic keeps it all.
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'A stray feature, again', '--session-log-file', sessionLog(sim, feat)]);
    enterEntry(sim, feat, 'discussion', feat);
    assert.deepStrictEqual([read(['record', feat, feat]).questions, read(['map', feat, feat]).questions], [[], []],
      'the name made again holds none of the carried lines');
    assert.deepStrictEqual(shown(), absorbedReads);

    // The release edge survives the move: walking E1 to its verdict at the
    // epic address releases the wait, and the epic topic answers the
    // question it measured.
    for (const step of ['advance', 'approve', 'advance']) sim.run(['experiment', step, epic, feat, 'E1']);
    const settled = sim.run(['experiment', 'conclude', epic, feat, 'E1', '--verdict', 'cutover costs a week — staged rollout adopted']);
    assert.deepStrictEqual(settled.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    const costed = sim.run(['ledger', 'decide', epicAt, '--answers', cost], null, JSON.stringify({ ...made, text: 'A week, staged.', why: 'E1 measured it.' })).id;
    assert.deepStrictEqual(read(['record', epic, feat]).decisions.map((/** @type {{id: string}} */ d) => d.id), [owned, costed]);
  });

  it('shared files: a discussion lands them in its assets, absorb re-homes them over a collision', () => {
    const feat = 'ledger';
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'Ledger', '--session-log-file', sessionLog(sim, feat)]);

    // The discussion lands what the user shared mid-session — a binary and a
    // markdown source — and its log links them.
    continueUnit(sim, feat);
    enterEntry(sim, feat, 'discussion', feat);
    sim.write('shared/Dockset 05.PNG', 'png bytes\n');
    sim.write('shared/Onboarding.txt', 'the walkthrough\n');
    const landed = sim.run(['asset', 'import', feat, 'shared/Dockset 05.PNG', 'shared/Onboarding.txt']);
    assert.deepStrictEqual(landed.imports, [`${feat}/assets/dockset-05.png`, `${feat}/assets/onboarding.md`]);
    sim.write(`.leeway/${feat}/topics/${feat}/log.md`,
      `# Discussion — ${feat}\n\n![the fifth onboarding screen](../../assets/dockset-05.png)\n`);
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`, '--topic', `discussion/${feat}`]);

    // The epic already holds a file of the same name from its own opener.
    const epic = 'platform';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'Platform', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['discovery-session', 'close', epic, '-m', `discovery(${epic}): shape`]);
    sim.write('shared/dockset-05.png', "the epic's own shot\n");
    sim.run(['asset', 'import', epic, 'shared/dockset-05.png']);

    // Absorb re-homes the material: the collision suffixes, and the links the
    // rename broke are rewritten in the documents absorb moved.
    const topic = 'ledger-work';
    const absorbed = sim.run(['workunit', 'absorb', feat, '--into', epic, '--topic', topic, '--summary', 'The ledger\'s work']);
    assert.deepStrictEqual(absorbed.renamed_assets, [{ from: 'dockset-05.png', to: 'dockset-05-2.png' }]);
    const read = (rel) => fs.readFileSync(path.join(sim.dir, rel), 'utf8');
    assert.match(read(`.leeway/${epic}/topics/${topic}/log.md`), /\.\.\/\.\.\/assets\/dockset-05-2\.png/);
    assert.deepStrictEqual(fs.readdirSync(path.join(sim.dir, `.leeway/${epic}/assets`)).sort(), ['dockset-05-2.png', 'dockset-05.png', 'onboarding.md']);
    const renamedArg = absorbed.renamed_assets.map((r) => `${r.from}:${r.to}`).join(',');
    assert.match(sim.render(['absorb-receipt', epic, '--topic', topic, '--moved', 'assets',
      '--renamed', renamedArg], { expect: 'content' }),
    /• Renamed: dockset-05\.png → dockset-05-2\.png \(links rewritten\)/);
  });

  it('guards hold mid-pipeline: shadow fields, empty segments, a name already taken, bad statuses', () => {
    const wu = 'guarded';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Guard rails', '--session-log-file', sessionLog(sim, wu)]);
    enterEntry(sim, wu, 'discussion', wu);

    sim.refuses(['manifest', 'set', wu, 'specification.foo', 'bar'], /is a phase/);
    sim.refuses(['manifest', 'set', `${wu}.`, 'field', 'x'], /empty segments/);
    sim.refuses(['manifest', 'set', `${wu}.discussion.${wu}`, 'status', 'concluded'], /Must be one of/);
    sim.refuses(['commit', '', '-m', 'nope'], /./);
    assert.throws(() => startItem(sim.dir, wu, 'cooking', wu), { message: /unknown or non-lifecycle phase "cooking"/ });

    // A taken name refuses whatever type the second call names, over an
    // untouched world.
    const takenManifest = JSON.stringify(sim.manifest(wu));
    const head = stateGit(sim.dir, ['rev-parse', 'HEAD']).trim();
    const taken = /work unit "guarded" already exists — pick a different name/;
    const draft = sim.write('.leeway/.cache/guarded/discovery/session-001.md', '# Discovery Session 001\n');
    sim.refuses(['workunit', 'create', wu, 'feature', '--description', 'Again', '--session-log-file', draft], taken);
    sim.refuses(['workunit', 'create', wu, 'bugfix', '--description', 'Reuse', '--session-log-file', draft], taken);
    assert.strictEqual(JSON.stringify(sim.manifest(wu)), takenManifest, 'a refused create rewrote the manifest');
    assert.strictEqual(stateGit(sim.dir, ['rev-parse', 'HEAD']).trim(), head, 'a refused create landed a commit');

    // Reserved names never mint a work unit — `project` routes dot-paths to
    // the project manifest, `roadmap` is the project's own place.
    sim.refuses(['workunit', 'create', 'project', 'feature', '--description', 'Nope', '--session-log-file', draft], /is reserved/);
    sim.refuses(['workunit', 'create', 'roadmap', 'feature', '--description', 'Nope', '--session-log-file', draft], /is reserved/);

    // Start's gates render at any state, each at its own moment.
    assert.match(sim.render(['migration-gate'], { expect: 'content' }), /Ready to continue\?/);
    assert.match(sim.render(['label-gate'], { expect: 'content' }), /Label your tmux session/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'reuse', '--provider', 'openai', '--model', 'text-embedding-3-small'], { expect: 'content' }), /Use the existing configuration for this project\?[\s\S]*openai ·\s+text-embedding-3-small/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'reuse'], { expect: 'content' }), /keyword-only/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'deviate'], { expect: 'content' }), /How should this project deviate\?/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'mode'], { expect: 'content' }), /How should this project's knowledge base work\?/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'retry', '--provider', 'openai'], { expect: 'content' }), /No OpenAI API key was found[\s\S]*Ready to retry\?/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'retry', '--provider', 'openai-compatible'], { expect: 'content' }), /The endpoint requires an API key[\s\S]*Ready to retry\?/);
    sim.refuses(['render', 'knowledge-gate', '--variant', 'retry'], /the retry variant needs --provider openai\|openai-compatible/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'wizard'], { expect: 'content' }), /engine\.cjs knowledge setup[\s\S]*Has the wizard completed\?/);
    sim.refuses(['render', 'knowledge-gate'], /--variant must be one of reuse, deviate, mode, retry/);
    assert.match(sim.render(['knowledge-gate', '--variant', 'reuse', '--provider', 'openai'], { expect: 'content' }), /\(openai\)/);
    sim.refuses(['render', 'knowledge-gate', '--variant', 'reuse', '--model', 'x'], /names nothing without --provider/);
    sim.refuses(['render', 'knowledge-gate', '--variant', 'retry', '--provider', 'openai', '--model', 'x'], /--model does not belong to the retry variant/);
    // The archived sub-view's gates resolve the selected item by its store
    // path — the title on the label is the file's own; a missing path, a live
    // path, and a path the store does not hold each refuse.
    const archived = sim.write('.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    assert.match(sim.render(['archived-actions', '--path', archived], { expect: 'content' }), /Selected: \*\*Old Idea\*\* \(idea, archived\)[\s\S]*What would you like to do with it\?/);
    assert.match(sim.render(['archived-delete-gate', '--path', archived], { expect: 'content' }), /Permanently deleting "Old Idea" removes the file from the repo and cannot be undone\.[\s\S]*Delete it\?/);
    sim.refuses(['render', 'archived-actions'], /--path is required/);
    sim.refuses(['render', 'archived-delete-gate', '--path', '.leeway/.inbox/ideas/2026-05-01--old-idea.md'], /not an archived inbox path/);
    sim.refuses(['render', 'archived-actions', '--path', '.leeway/.inbox/.archived/ideas/2026-05-02--ghost.md'], /not in the archived store/);

    // The walkthrough is a one-time record of the project's, and the same
    // shape: refuse anything but the two answers, write once, and stay
    // recorded. Its offer and screens are content, so they render at any
    // state; the offer stands before the walk, so its yes records before
    // the first screen renders.
    assert.match(sim.render(['walkthrough-offer'], { expect: 'content' }), /Take the walkthrough\?/);
    assert.match(sim.render(['walkthrough-offer', '--menu-only'], { expect: 'content' }), /y\/yes/);
    sim.refuses(['walkthrough', 'record', 'bananas'], /one of walked, skipped/);
    const answer = sim.run(['walkthrough', 'record', 'walked']);
    assert.match(answer.committed, /^[0-9a-f]+$/, 'the answer commits in the same call');
    assert.strictEqual(sim.read(['manifest', 'get', 'project.walkthrough.status']), 'walked');
    sim.refuses(['walkthrough', 'record', 'skipped'], /recorded once/);
    assert.match(sim.render(['walkthrough-screen', '--screen', '1', '--from', 'first-run'], { expect: 'content' }), /How the workflows work · 1 of 8/);
    // Screen 2 draws the start menu as its sample; the gate it stops at is its own.
    assert.match(sim.render(['walkthrough-screen', '--screen', '2', '--from', 'help'], { expect: 'content' }), /n\/next/);
    assert.match(sim.render(['walkthrough-home'], { expect: 'content' }), /What would you like to do\?/);
    // A card is also shown mid-conversation, so it carries no gate; the help
    // flow fetches the card's menu beneath it.
    assert.doesNotMatch(sim.render(['walkthrough-topic', '--name', 'the-inbox'], { expect: 'content' }), /^=== MENU/m);
    assert.match(sim.render(['walkthrough-topic', '--name', 'the-inbox', '--menu-only'], { expect: 'content' }), /t\/topics/);
    sim.refuses(['render', 'walkthrough-screen', '--screen', '9', '--from', 'help'], /--screen is 1–8/);
    assert.match(sim.render(['walkthrough-screen', '--screen', '8', '--from', 'help', '--menu-only'], { expect: 'content' }), /d\/done/);

    // After every refusal the unit still derives and is decided normally.
    assert.deepStrictEqual(discussed(sim, wu, wu).next, { kind: 'handoff', skill: 'leeway-specification-process', args: ['feature', wu] });
  });
});

describe('pipeline simulation: a decision changed mid-build', () => {
  /** @type {SimT} */
  let sim;
  beforeEach(() => { sim = new Sim(worlds.specToBuild); });
  afterEach(() => { sim.destroy(); });

  it('18.S68, 12.15.4, 18.3.1: a decision a feature\'s build rests on changes there — the replacement asked of the person and recorded at the build\'s place, the unit\'s record holding the new answer; the feature never goes back to its discussion, and manage offers it cancel alone', async () => {
    const wu = SPEC_TO_BUILD_UNIT;
    buildEntry(sim, wu);
    const [decision] = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions;
    const proposal = { ...leaningCall('An entry is kept a year.', 'An entry is kept for ever.'), question: 'How long is an entry kept?' };
    const raised = await sim.runAsync(['raise', `${wu}.implementation`, '--replaces', decision.id, '--reason', 'changed-mind'], null, JSON.stringify(proposal));
    assert.strictEqual(raised.decision, 'ask', 'a replacement in the build is asked of the person');

    const asked = sim.run(['raise', 'draw', wu, raised.parked]);
    sim.run(['raise', 'answer', asked.raise, '--pick', '1'], null, JSON.stringify({ why: 'A year is enough.' }));
    const replaced = fs.readFileSync(path.join(sim.dir, '.leeway/.ledger.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((event) => event.event === 'replaced');
    assert.deepStrictEqual(replaced.map((event) => [event.phase, event.replaces.startsWith(decision.id)]), [['implementation', true]], 'the replacement lands at the build\'s place');
    const current = JSON.parse(sim.read(['ledger', 'record', wu, wu])).decisions;
    assert.deepStrictEqual([current.some((/** @type {{id: string}} */ d) => d.id === decision.id), JSON.stringify(current).includes('An entry is kept a year.')], [false, true],
      'the unit\'s record holds the new answer, the old one replaced — what the build\'s task writer reworks against');

    assert.strictEqual(sim.manifest(wu).phases.discussion.items[wu].status, 'completed', 'the discussion stays decided');
    assert.deepStrictEqual(Object.keys(managed(sim, wu).rows), ['c', 'h', 'b'], 'manage offers a build under way its cancel alone');
    continueInto(sim, wu, 'implementation');
  });
});
