'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's work-unit lifecycle: complete, reactivate,
// cancel and reactivate; a feature pivoted to an epic; a feature absorbed
// into an epic; reference imports re-homed by absorb; and the guards
// holding mid-pipeline.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const EPIC_GATEWAY = require(path.join(ROOT, 'skills/leeway-continue-epic/scripts/gateway.cjs'));
const { epicDashboard } = require(path.join(ROOT, 'skills/leeway-engine/scripts/domain/projections/epic.cjs'));
const { stateGit, sectionOf } = require('./engine-harness.cjs');
const { Sim, sessionLog, menuEntry, enterEntry, discussed, askedOn } = require('./pipeline-world.cjs');

describe('pipeline simulation: workunit', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('work-unit lifecycle: complete → reactivate → cancel → reactivate', () => {
    const wu = 'flip';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Lifecycle', '--session-log-file', log]);
    discussed(sim, wu, wu);

    sim.run(['workunit', 'complete', wu, '-m', 'workflow(flip): done']);
    assert.ok(sim.manifest(wu).completed_at, 'complete stamps completed_at');
    sim.refuses(['workunit', 'complete', wu, '-m', 'again'], /./);
    // The completed & cancelled view's route back in: a number resolves to
    // the unit, its action menu renders over it, r/reactivate runs.
    assert.match(sim.render(['completed-actions', wu], { expect: 'content' }),
      /\*\*Flip\*\* \(completed\)[\s\S]*What would you like to do\?/);
    sim.run(['workunit', 'reactivate', wu]);
    sim.refuses(['render', 'completed-actions', wu],
      /"flip" is not completed or cancelled \(status: in-progress\)/);
    assert.strictEqual(sim.manifest(wu).completed_at, undefined, 'reactivate clears the stamp');
    sim.run(['workunit', 'cancel', wu]);
    assert.strictEqual(sim.manifest(wu).status, 'cancelled');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'cancel', '--warn'], { expect: 'content' }),
      /marked as cancelled/, 'cancel receipt renders from the cancelled state');
    sim.run(['workunit', 'reactivate', wu]);
    assert.strictEqual(sim.manifest(wu).status, 'in-progress');
    assert.match(sim.render(['workunit-receipt', wu, '--verb', 'reactivate'], { expect: 'content' }),
      /reactivated/, 'reactivate receipt renders from the restored state');
  });

  it('pivot: a feature with a discussion becomes an epic and its topic keeps working', () => {
    const wu = 'bigger';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Outgrew itself', '--session-log-file', log]);
    enterEntry(sim, wu, 'discussion', wu);
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, '# Discussion\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);

    sim.run(['workunit', 'pivot', wu]);
    assert.strictEqual(sim.manifest(wu).work_type, 'epic');
    const board = (/** @type {string[]} */ args) => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID, ...args])).view;
    const page = board(['--tab', 'unit', '--unit', wu]);
    const row = board(['--tab', 'all']).units.find((/** @type {{unit: string}} */ { unit }) => unit === wu);
    assert.deepStrictEqual([page.kind, page.now, row.phase], ['epic', { phase: 'discussion', since: sim.manifest(wu).phases.discovery.approved_at }, 'discussion'],
      'S1, 18.3.5: the pivot approves the map it lands, so the epic stands past its discovery on its page and in All work, its discovery closed at the pivot');
    assert.match(sim.render(['pivot-continuation', wu], { expect: 'content' }),
      /MENU: pivot continuation/, 'the manage flow can fetch the continuation menu post-pivot');

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
    sim.run(['workunit', 'pivot', wu]);
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
    // The discussion decides one question, moves another to the roadmap as
    // later, and spawns an experiment measuring a third, still awaiting its
    // evidence: the series travels with the topic, wait and all, and every
    // line the feature made goes with them (5.8.18).
    const at = `${feat}.discussion.${feat}`;
    const made = { by: 'claude', who_moved_whom: 'none' };
    const owner = askedOn(sim, feat, feat, 'Who owns the cutover?');
    const owned = sim.run(['ledger', 'decide', at, '--answers', owner], null, JSON.stringify({ ...made, text: 'The platform team.', why: 'They run the switch.' })).id;
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

    // The manage flow's absorb gates render from the pre-absorb state.
    assert.match(sim.render(['absorb-confirm-gate', feat], { expect: 'content' }),
      /MENU: absorb confirm gate/, 'the proceed consent renders for an absorbable feature');
    assert.match(sim.render(['absorb-summary', feat, '--into', epic, '--topic', 'stray-topic'], { expect: 'content' }),
      /Experiments: {2}1 experiment\(s\)/, 'the pre-confirm summary derives from the feature manifest — top-level records only');

    const absorbed = sim.run(['workunit', 'absorb', feat, '--into', epic, '--topic', 'stray-topic']);
    assert.ok(!fs.existsSync(path.join(sim.dir, '.leeway', feat)), 'feature directory removed');
    assert.deepStrictEqual(absorbed.mail_moved, { path: path.join(sim.dir, `.leeway/${epic}/topics/stray-topic/mail`), count: 1 });
    assert.deepStrictEqual(sim.run(['topic', 'mailbox', epic, 'stray-topic']).files,
      [path.join(sim.dir, `.leeway/${epic}/topics/stray-topic/mail/001-rollback-owner.md`)],
      'the waiting message waits on the epic topic — its session raises it');
    assert.match(epicDashboard(epic, EPIC_GATEWAY.discover(sim.dir, epic)).replace(/\n[ │]+/g, ' '),
      /Stray Topic[^\n]*mail waiting/, 'the epic tree cues the waiting message');
    const m = sim.manifest(epic);
    assert.ok(m.phases.discovery.items['stray-topic'], 'absorbed topic lands on the map');
    assert.strictEqual(m.phases.discussion.items['stray-topic'].status, 'in-progress');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'topics', 'stray-topic', 'log.md')),
      'the discussion\'s log moved into the epic');

    // The series audits whole at its epic identity — item, record, wait,
    // directory — and its register renders at the epic address.
    const series = m.phases.experiment.items['stray-topic'];
    assert.deepStrictEqual([series.status, series.experiments.E1.slug, series.experiments.E1.status], ['in-progress', 'cutover-cost', 'conceived'],
      'the series travels whole — records and derived status intact');
    assert.deepStrictEqual(m.phases.discussion.items['stray-topic'].awaiting_experiments, ['E1'], 'the evidence wait rides the moved discussion item');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'topics', 'stray-topic', 'experiments', 'E1-cutover-cost', 'problem.md')),
      'the record directory moved under the topic name');
    assert.match(sim.render(['experiment-register', `${epic}.experiment.stray-topic`], { expect: 'content' }),
      /E1 cutover-cost/, 'the register renders the moved series at the epic address');

    // The feature's lines are the epic topic's: its decision current there,
    // its question moved to the roadmap still later, and the question its
    // experiment measures held from Claude's answer while it runs.
    const shown = () => ({ record: sim.run(['ledger', 'record', epic, 'stray-topic']), map: sim.run(['ledger', 'map', epic, 'stray-topic']) });
    const absorbedReads = shown();
    assert.deepStrictEqual(absorbedReads.record.decisions.map((/** @type {{id: string}} */ d) => d.id), [owned], 'the feature\'s decision is current at the epic topic');
    const rows = new Map(absorbedReads.map.questions.map((/** @type {{id: string}} */ q) => [q.id, q]));
    assert.deepStrictEqual([rows.get(owner).stands, rows.get(rollback).stands, rows.get(rollback).moved_to], ['answered', 'later', 'roadmap:rollback'],
      'the move the feature made holds at the epic topic');
    const epicAt = `${epic}.discussion.stray-topic`;
    sim.refuses(['ledger', 'decide', epicAt, '--answers', cost], /is measured by experiment E1, still running/, null,
      JSON.stringify({ ...made, text: 'A day.', why: 'A guess.' }));

    assert.match(sim.render(['absorb-receipt', epic, '--topic', 'stray-topic', '--experiments', '1'], { expect: 'content' }),
      /• Experiments: 1 moved/, 'absorb receipt renders from the epic post-state and names the moved series');
    assert.match(sim.render(['absorb-continuation', epic, '--feature', feat], { expect: 'content' }),
      /MENU: absorb continuation/, 'the continuation menu renders from the post-absorb state');

    // A feature made again under the absorbed one's name holds none of it,
    // and the epic topic keeps it all.
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'A stray feature, again', '--session-log-file', sessionLog(sim, feat)]);
    enterEntry(sim, feat, 'discussion', feat);
    assert.deepStrictEqual([sim.run(['ledger', 'record', feat, feat]).questions, sim.run(['ledger', 'map', feat, feat]).questions], [[], []],
      'the name made again holds none of the carried lines');
    assert.deepStrictEqual(shown(), absorbedReads);

    // The release edge survives the move: walking E1 to its verdict at the
    // epic address releases the wait, and the epic topic answers the
    // question it measured.
    sim.run(['experiment', 'advance', epic, 'stray-topic', 'E1']);
    sim.run(['experiment', 'approve', epic, 'stray-topic', 'E1']);
    sim.run(['experiment', 'advance', epic, 'stray-topic', 'E1']);
    sim.run(['experiment', 'runs', epic, 'stray-topic', 'E1', '--file', sim.write(`.leeway/.cache/${epic}/experiment/stray-topic/E1-runs.json`,
      JSON.stringify([{ condition: 'a staged cutover', of: 3, values: [5, 6, 5], unit: 'days' }]))]);
    const settled = sim.run(['experiment', 'conclude', epic, 'stray-topic', 'E1', '--verdict', 'cutover costs a week — staged rollout adopted']);
    assert.deepStrictEqual(settled.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    const costed = sim.run(['ledger', 'decide', epicAt, '--answers', cost], null, JSON.stringify({ ...made, text: 'A week, staged.', why: 'E1 measured it.' })).id;
    assert.deepStrictEqual(sim.run(['ledger', 'record', epic, 'stray-topic']).decisions.map((/** @type {{id: string}} */ d) => d.id), [owned, costed]);
  });

  it('reference imports: a discussion lands files, absorb re-homes them over a collision', () => {
    const feat = 'ledger';
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'Ledger', '--session-log-file', sessionLog(sim, feat)]);

    // The discussion lands what the user shared mid-session — a binary and a
    // markdown source — stamped with its own origin, and its log links them.
    menuEntry(sim, feat);
    enterEntry(sim, feat, 'discussion', feat);
    sim.write('shared/Dockset 05.PNG', 'png bytes\n');
    sim.write('shared/Onboarding.txt', 'the walkthrough\n');
    const landed = sim.run(['workunit', 'import', feat, 'shared/Dockset 05.PNG', 'shared/Onboarding.txt', '--from', `discussion/${feat}`]);
    assert.deepStrictEqual(landed.imports, [
      { path: path.join(sim.dir, `.leeway/${feat}/imports/dockset-05.png`), origin: `discussion/${feat}` },
      { path: path.join(sim.dir, `.leeway/${feat}/imports/onboarding.md`), origin: `discussion/${feat}` },
    ]);
    sim.write(`.leeway/${feat}/topics/${feat}/log.md`,
      `# Discussion — ${feat}\n\n![the fifth onboarding screen](../../imports/dockset-05.png)\n`);
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`, '--topic', `discussion/${feat}`]);

    // The epic already holds a file of the same name from its own opener.
    const epic = 'platform';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'Platform', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['discovery-session', 'close', epic, '-m', `discovery(${epic}): shape`]);
    sim.write('shared/dockset-05.png', "the epic's own shot\n");
    sim.run(['workunit', 'import', epic, 'shared/dockset-05.png', '--from', 'discovery']);

    // Absorb re-homes the material: the collision suffixes, the links the
    // rename broke are rewritten in the documents absorb moved, and the
    // feature-session origins follow the topic.
    const topic = 'ledger-work';
    const absorbed = sim.run(['workunit', 'absorb', feat, '--into', epic, '--topic', topic]);
    assert.deepStrictEqual(absorbed.renamed_imports, [{ from: 'dockset-05.png', to: 'dockset-05-2.png' }]);
    const read = (rel) => fs.readFileSync(path.join(sim.dir, rel), 'utf8');
    assert.match(read(`.leeway/${epic}/topics/${topic}/log.md`), /\.\.\/\.\.\/imports\/dockset-05-2\.png/);
    assert.deepStrictEqual(sim.manifest(epic).imports.map((e) => [e.path, e.origin]), [
      ['imports/dockset-05.png', 'discovery'],
      ['imports/dockset-05-2.png', `discussion/${topic}`],
      ['imports/onboarding.md', `discussion/${topic}`],
    ]);
    const renamedArg = absorbed.renamed_imports.map((r) => `${r.from}:${r.to}`).join(',');
    assert.match(sim.render(['absorb-receipt', epic, '--topic', topic, '--moved', 'imports',
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
    sim.refuses(['topic', 'start', wu, 'cooking', wu], /Invalid phase|unknown/);

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
