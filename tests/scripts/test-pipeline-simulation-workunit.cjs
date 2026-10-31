'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's work-unit lifecycle: complete, reactivate,
// cancel and reactivate; a feature pivoted to an epic; a feature absorbed
// into an epic; reference imports re-homed by absorb and carried by
// promote; and the guards holding mid-pipeline.
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
const { stateGit } = require('./engine-harness.cjs');
const { Sim, sessionLog, carryOn, arrive, menuEntry, handoffEntry, handoff, literal, askedOn } = require('./pipeline-world.cjs');

describe('pipeline simulation: workunit', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('work-unit lifecycle: complete → reactivate → cancel → reactivate', () => {
    const wu = 'flip';
    const log = sessionLog(sim, wu);
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Lifecycle', '--session-log-file', log]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.run(['topic', 'complete', wu, 'discussion', wu]);

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
    sim.run(['topic', 'start', wu, 'discussion', wu]);
    sim.write(`.leeway/${wu}/discussion/${wu}.md`, '# Discussion\n');
    sim.run(['commit', wu, '-m', `discussion(${wu}): capture`, '--topic', `discussion/${wu}`]);

    sim.run(['workunit', 'pivot', wu]);
    assert.strictEqual(sim.manifest(wu).work_type, 'epic');
    assert.match(sim.render(['pivot-continuation', wu], { expect: 'content' }),
      /MENU: pivot continuation/, 'the manage flow can fetch the continuation menu post-pivot');

    // The pivoted epic's map and phases still derive; the topic completes.
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });

  it('absorption: a feature folds into an epic as a new topic and disappears', () => {
    const epic = 'umbrella';
    const feat = 'stray';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'The umbrella', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'A stray feature', '--session-log-file', sessionLog(sim, feat)]);
    // Research ran first and left a register — the absorb carries it whole.
    sim.run(['topic', 'start', feat, 'research', feat]);
    sim.write(`.leeway/${feat}/research/${feat}.md`, '# Research — Stray\n');
    sim.run(['research-threads', 'add', feat, feat, 'reach', '--question', 'How far does stray reach?', '--origin', 'seed']);
    sim.run(['research-threads', 'set', feat, feat, 'reach', 'parked', '--note', 'not this year']);
    sim.run(['commit', feat, '-m', `research(${feat}): capture`, '--topic', `research/${feat}`]);
    sim.run(['topic', 'complete', feat, 'research', feat]);
    sim.run(['topic', 'start', feat, 'discussion', feat]);
    sim.write(`.leeway/${feat}/discussion/${feat}.md`, '# Discussion — Stray\n');
    // The Discussion Map the feature built travels with it.
    sim.run(['discussion-map', 'add', feat, feat, 'cutover']);
    sim.run(['discussion-map', 'add', feat, feat, 'rollback', '--parent', 'cutover']);
    sim.run(['discussion-map', 'set', feat, feat, 'cutover=exploring', 'rollback=decided']);
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`, '--topic', `discussion/${feat}`]);
    // A standing do-not-report call on this topic's material.
    sim.run(['manifest', 'push', `${feat}.discussion.${feat}`, 'dismissed_grounds',
      'the migration path is settled and out of scope']);
    // The discussion spawned an experiment still awaiting its evidence — the
    // series travels with the topic, wait and all.
    const spawned = sim.run(['experiment', 'create', feat, feat, '--slug', 'cutover-cost', '--from', 'discussion', '--question', askedOn(sim, feat, feat, 'What does a cutover cost?'),
      '--problem', sim.write(`.leeway/.cache/${feat}/discussion/${feat}/problem.md`, '# Problem — what a cutover actually costs\n')]);
    assert.ok(fs.existsSync(path.join(spawned.dir, 'problem.md')), 'the spawn installs the problem statement');
    sim.run(['commit', feat, '-m', `experiment(${feat}/${feat}): E1 problem statement`, '--topic', `experiment/${feat}`, '--sweep']);
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
    assert.deepStrictEqual(m.phases.discussion.items['stray-topic'].dismissed_grounds,
      ['the migration path is settled and out of scope'],
      'dismissed grounds follow the material — the absorbed topic never re-raises what was turned down');
    assert.deepStrictEqual(m.phases.research.items['stray-topic'].threads,
      { reach: { question: 'How far does stray reach?', status: 'parked', origin: 'seed', parent: null, note: 'not this year' } },
      'the thread register follows the material to its new name');
    assert.deepStrictEqual(m.phases.discussion.items['stray-topic'].subtopics,
      { cutover: { status: 'exploring', parent: null }, rollback: { status: 'decided', parent: 'cutover' } },
      'the Discussion Map follows the material to its new name');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'discussion', 'stray-topic.md')),
      'discussion file moved into the epic');

    // The series sub-tree audits whole at its epic identity: item, record,
    // wait, directory — and the lock's edges keep holding after the move.
    assert.deepStrictEqual(m.phases.experiment.items['stray-topic'],
      { status: 'in-progress', experiments: { E1: { slug: 'cutover-cost', status: 'conceived' } } },
      'the series travels whole — records and derived status intact');
    assert.deepStrictEqual(m.phases.discussion.items['stray-topic'].awaiting_experiments, ['E1'],
      'the evidence wait rides the moved discussion item');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', epic, 'topics', 'stray-topic', 'experiments', 'E1-cutover-cost', 'problem.md')),
      'the record directory moved under the topic name');
    sim.refuses(['topic', 'complete', epic, 'discussion', 'stray-topic'], /awaits experiment evidence \(E1\)/);
    assert.match(sim.render(['experiment-register', `${epic}.experiment.stray-topic`], { expect: 'content' }),
      /E1 cutover-cost/, 'the register renders the moved series at the epic address');

    assert.match(sim.render(['absorb-receipt', epic, '--topic', 'stray-topic', '--experiments', '1'], { expect: 'content' }),
      /• Experiments: 1 moved/, 'absorb receipt renders from the epic post-state and names the moved series');
    assert.match(sim.render(['absorb-continuation', epic, '--feature', feat], { expect: 'content' }),
      /MENU: absorb continuation/, 'the continuation menu renders from the post-absorb state');

    // The release edge survives the move: walking E1 to its verdict at the
    // epic address releases the wait and the discussion can conclude.
    sim.run(['experiment', 'advance', epic, 'stray-topic', 'E1']);
    sim.run(['experiment', 'approve', epic, 'stray-topic', 'E1']);
    sim.run(['experiment', 'advance', epic, 'stray-topic', 'E1']);
    const settled = sim.run(['experiment', 'conclude', epic, 'stray-topic', 'E1', '--verdict', 'cutover costs a week — staged rollout adopted']);
    assert.deepStrictEqual(settled.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.strictEqual(sim.manifest(epic).phases.discussion.items['stray-topic'].awaiting_experiments, undefined);
  });

  it('reference imports: a research session lands files, absorb re-homes them over a collision, promote carries the linked one', () => {
    const feat = 'ledger';
    sim.run(['workunit', 'create', feat, 'feature', '--description', 'Ledger', '--session-log-file', sessionLog(sim, feat)]);

    // The research session lands what the user shared mid-session — a binary
    // and a markdown source — stamped with its own origin, and links them.
    menuEntry(sim, feat);
    handoffEntry(sim, feat, 'research', feat);
    sim.run(['topic', 'start', feat, 'research', feat]);
    sim.write('shared/Dockset 05.PNG', 'png bytes\n');
    sim.write('shared/Onboarding.txt', 'the walkthrough\n');
    const landed = sim.run(['workunit', 'import', feat, 'shared/Dockset 05.PNG', 'shared/Onboarding.txt', '--from', `research/${feat}`]);
    assert.deepStrictEqual(landed.imports, [
      { path: path.join(sim.dir, `.leeway/${feat}/imports/dockset-05.png`), origin: `research/${feat}` },
      { path: path.join(sim.dir, `.leeway/${feat}/imports/onboarding.md`), origin: `research/${feat}` },
    ]);
    sim.write(`.leeway/${feat}/research/${feat}.md`,
      `# Research — ${feat}\n\n![the fifth onboarding screen](../imports/dockset-05.png)\n`);
    sim.run(['commit', feat, '-m', `research(${feat}): capture`, '--topic', `research/${feat}`]);
    sim.run(['topic', 'complete', feat, 'research', feat]);
    sim.run(['commit', feat, '-m', `research(${feat}): complete`, '--topic', `research/${feat}`]);

    handoffEntry(sim, feat, 'discussion', feat);
    sim.run(['topic', 'start', feat, 'discussion', feat]);
    sim.write(`.leeway/${feat}/discussion/${feat}.md`,
      `# Discussion — ${feat}\n\n![the fifth onboarding screen](../imports/dockset-05.png)\n`);
    sim.run(['commit', feat, '-m', `discussion(${feat}): capture`, '--topic', `discussion/${feat}`]);
    sim.run(['topic', 'complete', feat, 'discussion', feat]);

    // The epic already holds a file of the same name from its own opener.
    const epic = 'platform';
    sim.run(['workunit', 'create', epic, 'epic', '--description', 'Platform', '--session-log-file', sessionLog(sim, epic)]);
    sim.run(['discovery-session', 'close', epic, '-m', `discovery(${epic}): shape`]);
    sim.write('shared/dockset-05.png', "the epic's own shot\n");
    sim.run(['workunit', 'import', epic, 'shared/dockset-05.png', '--from', 'discovery']);
    // The next session over the still-empty map opens on that material.
    sim.write(`.leeway/.cache/${epic}/discovery/opener.json`, JSON.stringify({ sketch: 'An onboarding screen.', questions: 'who lands on it first?' }));
    assert.match(sim.render(['opener', epic, '--variant', 'seeded', '--file', `.leeway/.cache/${epic}/discovery/opener.json`], { expect: 'content' }),
      /Read your import\. Here's the shape I'm picking up:/);

    // Absorb re-homes the material: the collision suffixes, the links the
    // rename broke are rewritten in the documents absorb moved, and the
    // feature-session origins follow the topic.
    const topic = 'ledger-work';
    const absorbed = sim.run(['workunit', 'absorb', feat, '--into', epic, '--topic', topic]);
    assert.deepStrictEqual(absorbed.renamed_imports, [{ from: 'dockset-05.png', to: 'dockset-05-2.png' }]);
    const read = (rel) => fs.readFileSync(path.join(sim.dir, rel), 'utf8');
    assert.match(read(`.leeway/${epic}/discussion/${topic}.md`), /\.\.\/imports\/dockset-05-2\.png/);
    assert.match(read(`.leeway/${epic}/research/${topic}.md`), /\.\.\/imports\/dockset-05-2\.png/);
    assert.deepStrictEqual(sim.manifest(epic).imports.map((e) => [e.path, e.origin]), [
      ['imports/dockset-05.png', 'discovery'],
      ['imports/dockset-05-2.png', `research/${topic}`],
      ['imports/onboarding.md', `research/${topic}`],
    ]);
    const renamedArg = absorbed.renamed_imports.map((r) => `${r.from}:${r.to}`).join(',');
    assert.match(sim.render(['absorb-receipt', epic, '--topic', topic, '--moved', 'research,imports',
      '--renamed', renamedArg], { expect: 'content' }),
    /• Renamed: dockset-05\.png → dockset-05-2\.png \(links rewritten\)/);

    // The spec links the material it rests on; promotion carries that import
    // into the cross-cutting unit and leaves the rest of the epic's behind.
    menuEntry(sim, epic);
    handoffEntry(sim, epic, 'specification', topic);
    sim.run(['topic', 'start', epic, 'specification', topic]);
    sim.run(['manifest', 'set', `${epic}.specification.${topic}`, `sources.${topic}.status`, 'incorporated']);
    sim.write(`.leeway/${epic}/specification/${topic}/specification.md`,
      `# Spec — ${topic}\n\n![the fifth onboarding screen](../../imports/dockset-05-2.png)\n`);
    sim.run(['commit', epic, '-m', `spec(${epic}): construct`, '--topic', `specification/${topic}`]);
    sim.run(['topic', 'complete', epic, 'specification', topic]);

    const promoted = sim.run(['workunit', 'promote', epic, topic, '--to', 'onboarding-cc', '--description', 'Onboarding, project-wide']);
    assert.deepStrictEqual(promoted.imports, [
      { path: path.join(sim.dir, '.leeway/onboarding-cc/imports/dockset-05-2.png'), origin: `research/${topic}` },
    ]);
    assert.deepStrictEqual(sim.manifest('onboarding-cc').imports.map((e) => e.path), ['imports/dockset-05-2.png']);
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway/onboarding-cc/imports/dockset-05-2.png')));
    // A copy, not a move — the epic keeps every file and entry it had.
    assert.strictEqual(sim.manifest(epic).imports.length, 3);
    assert.ok(fs.existsSync(path.join(sim.dir, `.leeway/${epic}/imports/dockset-05-2.png`)));
  });

  it('guards hold mid-pipeline: shadow fields, empty segments, a name already taken, bad statuses', () => {
    const wu = 'guarded';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Guard rails', '--session-log-file', sessionLog(sim, wu)]);
    sim.run(['topic', 'start', wu, 'discussion', wu]);

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
    // the project manifest, `baseline` is the KB's project-baseline identity.
    sim.refuses(['workunit', 'create', 'project', 'feature', '--description', 'Nope', '--session-log-file', draft], /is reserved/);
    sim.refuses(['workunit', 'create', 'baseline', 'feature', '--description', 'Nope', '--session-log-file', draft], /is reserved/);
    sim.refuses(['workunit', 'create', 'roadmap', 'feature', '--description', 'Nope', '--session-log-file', draft], /is reserved/);

    // The project baseline labels the terminal on arrival, then walks its
    // lifecycle on the project manifest, and each render surface serves its
    // prescribed moment: the offer only while
    // nothing is recorded, then the progress map and area gate mid-interview,
    // the pause receipt, the doc list and completion receipt once every area
    // lands. A native verdict is a recorded state like any other: the offer
    // refuses over it, and the mid-flight surfaces read it as never started.
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
    assert.match(sim.render(['legacy-split-gate', '--variant', 'themes'], { expect: 'content' }), /Proceed with these themes\?/);
    assert.match(sim.render(['legacy-split-gate', '--variant', 'plan'], { expect: 'content' }), /Apply this plan\?/);
    assert.match(sim.render(['legacy-split-gate', '--variant', 'remove', '--theme', 'caching'], { expect: 'content' }), /> Removing "caching" drops its drafted content[\s\S]*Remove the theme\?[\s\S]*Remove the theme and drop its content/);
    sim.refuses(['render', 'legacy-split-gate', '--variant', 'remove'], /--theme is required with --variant remove/);
    sim.refuses(['render', 'legacy-split-gate'], /--variant must be one of themes, plan, remove/);
    sim.refuses(['render', 'legacy-split-gate', '--variant', 'apply'], /got "apply"/);
    // The split's three displays over their payloads: the candidate list at
    // the sanity gate, the drafted plan with its cache paths, the validator's
    // refusals — each variant's fields validated, the file itself required.
    const splitDisplay = (variant, payload) => sim.render(
      ['legacy-split-display', '--variant', variant, '--file', sim.write(`.leeway/.cache/scratch/legacy-split-${variant}.json`, payload)],
      { expect: 'content' },
    );
    assert.match(splitDisplay('candidates', { source: 'auth', themes: [{ kebab_name: 'auth', summary: 'Login and sessions' }] }),
      /Candidate themes for auth\.md:[\s\S]*1\\\. auth[\s\S]*↳ Login and sessions/);
    // The cache path wraps at the display's width: joined, it reads whole.
    assert.match(splitDisplay('plan', { source: 'auth', work_unit: wu, themes: [{ kebab_name: 'auth', summary: 'Login and sessions', paragraph_count: 3, content_preview: 'The auth flow' }] }).replace(/\n {6}/g, ''),
      new RegExp(`Plan for auth\\.md:[\\s\\S]*└─ Cache:${literal(path.join(sim.dir, `.leeway/.cache/${wu}/legacy-split/auth/auth.md`))}[\\s\\S]*renamed to auth-superseded-<datetime>\\.md`));
    assert.match(splitDisplay('errors', { source: 'auth', errors: ["theme 'auth' has empty summary"] }),
      /Validation failed for auth:[\s\S]*• theme 'auth' has empty summary/);
    assert.match(splitDisplay('apply', { source: 'auth', result: { ok: true, applied: { themes: 2 }, kb_warnings: ['knowledge remove failed'] } }),
      /Applied auth: 2 new file\(s\)\.[\s\S]*> - knowledge remove failed/);
    assert.match(splitDisplay('apply', { source: 'auth', result: { ok: false, stage: 'git_commit', error: 'hook failed', recovery_hint: 'commit by hand' } }),
      /Apply failed for auth at stage "git_commit":\n {2}hook failed\n\nRecovery: commit by hand/);
    sim.refuses(['render', 'legacy-split-display', '--variant', 'plan'], /--file <payload\.json> is required/);
    sim.refuses(['render', 'legacy-split-display', '--variant', 'themes', '--file', '.leeway/.cache/scratch/legacy-split-plan.json'], /got "themes"/);
    sim.refuses(['render', 'legacy-split-display', '--variant', 'candidates', '--file', '.leeway/.cache/scratch/legacy-split-errors.json'], /"themes" must be a non-empty array/);
    // The split's conclusion is the session's tallies, rendered under its
    // step marker — the aborted apply leading whatever else happened.
    assert.match(sim.render(['legacy-split-display', '--variant', 'complete', '--applied', '1', '--abandoned', '0', '--errored', '1'], { expect: 'content' }),
      /□ Legacy Split Complete[\s\S]*> 1 source file\(s\) aborted mid-apply; 1 decomposed; 0 skipped\./);
    assert.match(sim.render(['legacy-split-display', '--variant', 'complete', '--applied', '0', '--abandoned', '0', '--errored', '0'], { expect: 'content' }),
      /> No legacy source files needed decomposition\./);
    sim.refuses(['render', 'legacy-split-display', '--variant', 'complete', '--applied', '1'], /--abandoned must be a non-negative integer/);
    // The archived sub-view's gates resolve the selected item by its store
    // path — the title on the label is the file's own; a missing path, a live
    // path, and a path the store does not hold each refuse.
    const archived = sim.write('.leeway/.inbox/.archived/ideas/2026-05-01--old-idea.md', '# Old Idea\n');
    assert.match(sim.render(['archived-actions', '--path', archived], { expect: 'content' }), /Selected: \*\*Old Idea\*\* \(idea, archived\)[\s\S]*What would you like to do with it\?/);
    assert.match(sim.render(['archived-delete-gate', '--path', archived], { expect: 'content' }), /Permanently deleting "Old Idea" removes the file from the repo and cannot be undone\.[\s\S]*Delete it\?/);
    sim.refuses(['render', 'archived-actions'], /--path is required/);
    sim.refuses(['render', 'archived-delete-gate', '--path', '.leeway/.inbox/ideas/2026-05-01--old-idea.md'], /not an archived inbox path/);
    sim.refuses(['render', 'archived-actions', '--path', '.leeway/.inbox/.archived/ideas/2026-05-02--ghost.md'], /not in the archived store/);
    assert.match(sim.render(['baseline-offer-gate'], { expect: 'content' }), /Run a baseline assessment\?/);
    // The offer's yes hands off to the assessment. Carried by the gate mod,
    // the handoff clears into a fresh conversation, whose first engine call
    // is the assessment's label: it marks the conversation and records the
    // place, so the conversation carries on there.
    assert.strictEqual(handoff(sim, '/leeway-baseline').line, '→ Baseline');
    sim.handOver();
    assert.ok(!fs.existsSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID)), 'no call has marked the fresh conversation');
    arrive(sim, 'baseline');
    assert.ok(fs.existsSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, 'workflow')), 'the label marked the fresh conversation');
    assert.match(carryOn(sim).text, /^The conversation was just compacted\. This conversation is working in the project's baseline\./);
    sim.refuses(['baseline', 'record', 'bananas'], /one of native, skipped/);
    const verdict = sim.run(['baseline', 'record', 'native']);
    assert.match(verdict.committed, /^[0-9a-f]+$/, 'the verdict commits in the same call');
    assert.strictEqual(sim.read(['manifest', 'get', 'project.baseline.status']), 'native');
    sim.refuses(['baseline', 'record', 'skipped'], /recorded once/);
    sim.refuses(['render', 'baseline-offer-gate'], /the offer fires once/);
    sim.refuses(['render', 'baseline-progress'], /no assessment has been started/);
    sim.run(['manifest', 'set', 'project.baseline.status', 'in-progress']);
    assert.strictEqual(sim.read(['manifest', 'get', 'project.baseline.status']), 'in-progress');
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'pending']);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'pending']);
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'researched']);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'researched']);
    sim.write('.leeway/.cache/scratch/baseline-scope.json', JSON.stringify({
      mode: 'fresh',
      areas: [{ name: 'overview', detail: 'What the product is' }, { name: 'dispatcher', detail: 'The downstream push' }],
    }));
    assert.match(sim.render(['baseline-scope-gate', '--file', '.leeway/.cache/scratch/baseline-scope.json'], { expect: 'content' }), /Assess these areas\?/);
    // Each area's interview opens on its marker, counted across the areas.
    const areaOpening = sim.write('.leeway/.cache/baseline/area.json', { area: 'overview', summary: 'What the product is and who it serves.' });
    assert.match(sim.render(['baseline-area', '--file', areaOpening], { expect: 'content' }),
      /□ Interviewing Overview \(1 of 2\)[\s\S]*> What the product is and who it serves\. Answer in your own words/);
    sim.write('.leeway/.cache/scratch/baseline-round.json', JSON.stringify({
      area: 'dispatcher',
      questions: [{ text: 'Why polling over webhooks?', candidates: ['Decoupling from a flaky downstream'] }],
    }));
    assert.match(sim.render(['baseline-round', '--file', '.leeway/.cache/scratch/baseline-round.json'], { expect: 'content' }), /1\. Why polling over webhooks\?/);
    assert.match(sim.render(['baseline-doc-gate'], { expect: 'content' }), /Land it\?/);
    // The landing (author-doc.md C): index the doc, mark the area, commit.
    sim.write('.leeway/.baseline/overview.md', '# Overview\n\n## What it is\n\nA dispatcher that pushes orders downstream.\n');
    const baselineIndexed = sim.engine(['knowledge', 'index', '.leeway/.baseline/overview.md']);
    assert.strictEqual(baselineIndexed.code, 0, baselineIndexed.stderr);
    assert.match(baselineIndexed.stdout, new RegExp(`^Indexed \\d+ chunks from ${literal(path.join(sim.dir, '.leeway/.baseline/overview.md'))}\\n$`));
    sim.run(['manifest', 'set', 'project.baseline.areas.overview', 'completed']);
    sim.run(['commit', '--workflows', '-m', 'baseline(overview): document the overview baseline']);
    assert.match(sim.render(['baseline-progress'], { expect: 'content' }), /1 area\(s\) remain/);
    sim.write('.leeway/.cache/baseline/area.json', { area: 'dispatcher', summary: 'The downstream push.' });
    assert.match(sim.render(['baseline-area', '--file', '.leeway/.cache/baseline/area.json'], { expect: 'content' }), /□ Interviewing Dispatcher \(2 of 2\)/);
    sim.write('.leeway/.cache/baseline/area.json', { area: 'overview', summary: 'Again.' });
    sim.refuses(['render', 'baseline-area', '--file', '.leeway/.cache/baseline/area.json'], /area "overview" is "completed", not researched/);
    assert.match(sim.render(['baseline-area-gate', '--area', 'overview'], { expect: 'content' }), /Keep going\?/);
    assert.match(sim.render(['baseline-paused'], { expect: 'content' }), /Paused — 1 of 2/);
    sim.run(['manifest', 'set', 'project.baseline.areas.dispatcher', 'completed']);
    sim.run(['manifest', 'set', 'project.baseline.status', 'completed']);
    assert.match(sim.render(['baseline-progress'], { expect: 'content' }), /2 area\(s\) documented/);
    assert.match(sim.render(['baseline-receipt'], { expect: 'content' }), /Baseline complete — 2 area\(s\)/);
    assert.match(sim.render(['baseline-manage-gate'], { expect: 'content' }), /What would you like to do\?/);
    const docPick = sim.render(['baseline-doc-pick'], { expect: 'content' });
    assert.match(docPick, /DOCS \(key {2}area\):\n {2}1 {2}overview\n {2}2 {2}dispatcher\n/);
    assert.match(docPick, /Which doc\?/);

    // The walkthrough is the project's other one-time record, and the same
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

    // After every refusal the unit still derives and completes normally.
    sim.run(['topic', 'complete', wu, 'discussion', wu]);
  });
});
