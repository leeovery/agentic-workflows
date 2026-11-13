'use strict';

// ---------------------------------------------------------------------------
// Tests for directive 076, the legacy split (21.4, 21.10.7): its check
// (076-legacy-split.check.cjs), run through `engine migrate check` before
// the move, over the state the reshape's guard placed: one piece for each
// source the detection (075) staged, in its order, each not done named with
// its source's file and the folder its plan goes in — read in the main
// checkout's working tree, from a linked worktree too — research staged
// with no plan read as no plan; done once its plan keeps it whole or
// validates — read, its themes listed, each named once by a name a topic
// can take with a summary, a description and its research staged beside
// it, none taking a name another item of the epic's map holds, a research
// file or item of the epic has, or a theme of another of its plans, its
// source's own name and a name the map dismissed free — each rule broken
// named, or once the apply marked it applied; and the directive's checklist
// closing on it, recording it. Through the real runner: where nothing
// qualifies the directive is recorded unrun, the run going on past it to
// the move (21.S7); where something does, the run stops at it, and once its
// plans are staged and it is closed, the next run applies them and moves
// the project, the records directive's check naming each of the split's
// topics, and the split's check passing still, after the move, with
// `.workflows/` gone and with its staging gone (21.S8). The installed skills
// hold no split skill: the split lives in the
// migrations alone (21.S9). The directive spells no path from the session's
// folder. Its head is linted with every directive's
// (test-migration-directives.cjs); detection and the apply are
// test-migration-075.cjs's and -077.cjs's.
//
// Layer: migration. World: codeintel as the reshape's guard leaves it
// (migration-world.cjs, `splitMigration`), made once per process and copied
// for each test; the runner, the real one over the real migrations, spawned.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ok, git, createFile, statePath, layout, cleanupFixture } = require('./engine-harness.cjs');
const { SESSION, SPLIT_EPIC, SPLIT_SOURCES, SPLIT_PLANS, GUARDED, themeOf, splitMigration, stateUnborn, recorded } = require('./migration-world.cjs');

const MIGRATE_SCRIPTS = path.join(__dirname, '../../skills/leeway-migrate/scripts');
const DIRECTIVE = path.join(MIGRATE_SCRIPTS, 'migrations/076-legacy-split.md');
const SKILLS = path.join(__dirname, '../../skills');
const DETECTION = require(path.join(MIGRATE_SCRIPTS, 'migrations/075-split-detect.cjs'));
const APPLY = require(path.join(MIGRATE_SCRIPTS, 'migrations/077-split-apply.cjs'));

const SPLIT = '076-legacy-split';
const SOURCES = { one: 'source', many: 'sources' };
const EPIC = `.workflows/${SPLIT_EPIC}`;

/** @type {string} */
let world;
/** @type {string} */
let main;
beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-076-')));
  main = path.join(splitMigration(world), SPLIT_EPIC);
});
afterEach(() => cleanupFixture(world));

/** The detection run over the project, as the runner runs it before the directive. */
function detect() {
  DETECTION.run({ projectDir: main, reportUpdate: () => {}, reportSkip: () => {} });
}

/** A map item `charter` the chain left in the epic's manifest in the main checkout, uncommitted. */
function charterOnTheMap() {
  const manifest = path.join(main, EPIC, 'manifest.json');
  const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  old.phases.discovery.items.charter = { routing: 'discussion', source: 'discovery' };
  fs.writeFileSync(manifest, JSON.stringify(old, null, 2) + '\n');
}

/** Plans staged in the state, by path from it. @param {Record<string, string>} plans */
function stage(plans) {
  for (const [rel, text] of Object.entries(plans)) createFile(statePath(main), rel, text);
}

/** The directive's check run. */
const checked = () => ok(main, ['migrate', 'check', SPLIT], { env: SESSION });

/** The real runner over the real migrations, run in the project's folder: what it printed. */
function runner() {
  const res = spawnSync(process.execPath, [path.join(MIGRATE_SCRIPTS, 'migrate.cjs'), '--record', statePath(main, layout.migrations), '--journals', statePath(main, '.cache/migrate')], {
    cwd: main, encoding: 'utf8', env: { ...process.env, WORKFLOWS_CONFIG_DIR: path.join(world, 'no-workflows-config') }, timeout: 60000,
  });
  assert.strictEqual(res.status, 0, res.stderr);
  return res.stdout;
}

/** @param {string} source */
const staging = (source) => statePath(main, `.cache/migrate/split/${SPLIT_EPIC}/${source}`);

/** Where a source not done and its plan are, as the check names them. @param {string} source */
const whereOf = (source) => `its source is ${path.join(main, EPIC, 'research', `${source}.md`)}, and its plan goes in ${staging(source)}`;

const PASSED = { ok: true, directive: SPLIT, passed: true, done: 6, of: 6, counts: SOURCES, unfinished: [] };

/** A plan for the exploration: `plan.json` as given, and research staged for each theme named. @param {unknown} plan @param {string[]} [researched] */
const explorationPlan = (plan, researched = []) => ({
  [`.cache/migrate/split/${SPLIT_EPIC}/exploration/plan.json`]: typeof plan === 'string' ? plan : JSON.stringify(plan),
  ...Object.fromEntries(researched.map((name) => [`.cache/migrate/split/${SPLIT_EPIC}/exploration/${name}.md`, `## ${name}\n\nNotes.\n`])),
});

describe('engine migrate check 076-legacy-split (21.10.7)', () => {
  it('names one piece for each source the detection found, in its order, each with no plan yet named with its source\'s file and the folder its plan goes in', () => {
    detect();

    assert.deepStrictEqual(checked(), {
      ok: true, directive: SPLIT, passed: false, done: 0, of: 6, counts: SOURCES,
      unfinished: SPLIT_SOURCES.map((source) => ({ name: `${SPLIT_EPIC}/${source}`, problems: [`has no plan yet: ${whereOf(source)}`] })),
    });
  });

  it('reads a source whose themes\' research is staged beside no plan as having no plan yet: the plan is written only once the person takes it, or keeps the source whole', () => {
    detect();
    stage(SPLIT_PLANS);
    fs.rmSync(path.join(staging('exploration'), 'plan.json'));

    assert.deepStrictEqual(checked().unfinished, [{ name: `${SPLIT_EPIC}/exploration`, problems: [`has no plan yet: ${whereOf('exploration')}`] }]);
  });

  it('21.S8: passes once each source\'s plan is staged — five split into themes, one kept whole — and the directive\'s checklist closes on it, recording it and committing nothing', () => {
    detect();
    stage(SPLIT_PLANS);

    assert.deepStrictEqual(checked(), PASSED);
    ok(main, ['checklist', 'close', 'directive', SPLIT], { env: SESSION });
    assert.deepStrictEqual(recorded(main), [...GUARDED, '076']);
    assert.ok(stateUnborn(main), 'nothing committed before the migration\'s commit');
  });

  it('passes each source the apply marked applied, before reading its epic, whose map and research now hold the themes the apply wrote', () => {
    detect();
    stage(SPLIT_PLANS);
    APPLY.run({ projectDir: main, reportUpdate: () => {}, reportSkip: () => {} });

    assert.deepStrictEqual(checked(), PASSED);
  });

  it('reads .workflows/ in the main checkout\'s working tree from a session in a linked worktree, a map item the chain left there uncommitted taking its name from a theme', () => {
    detect();
    stage(SPLIT_PLANS);
    charterOnTheMap();
    stage(explorationPlan({ themes: [themeOf('charter')] }, ['charter']));
    const linked = path.join(world, 'session');
    git(main, ['worktree', 'add', '--quiet', '-b', 'session', linked]);

    assert.deepStrictEqual(ok(linked, ['migrate', 'check', SPLIT], { env: SESSION }).unfinished, [
      { name: `${SPLIT_EPIC}/exploration`, problems: [whereOf('exploration'), `its theme charter is the name of another item on ${SPLIT_EPIC}'s map`] },
    ]);
  });

  it('names each rule a plan breaks, with its source\'s file and its plan\'s folder: one that does not read, holds neither themes nor whole or both, or lists none; a theme no object, unnamed, named twice, with no summary or description, named as no topic can be, or with its research missing or empty', () => {
    detect();
    stage(SPLIT_PLANS);
    const cases = [
      ['{"themes": [', ['its plan does not read as JSON: Unexpected end of JSON input']],
      [{ split: true }, ['its plan holds neither its themes nor "whole": true']],
      [{ whole: 'true' }, ['its plan holds neither its themes nor "whole": true']],
      [[themeOf('product-vision')], ['its plan holds neither its themes nor "whole": true']],
      [{ whole: true, themes: [themeOf('product-vision')] }, ['its plan keeps its source whole and splits it into themes too']],
      [{ themes: [] }, ['its plan has no themes']],
      [{ themes: ['product-vision'] }, ['its theme 1 is no object']],
      [{ themes: [{ summary: 'A line.', description: 'What it covers.' }] }, ['its theme 1 has no kebab_name']],
      [{ themes: [themeOf('product-vision'), themeOf('product-vision')] }, ['two of its themes are named product-vision']],
      [{ themes: [{ kebab_name: 'product-vision', summary: ' ', description: '' }] }, ['its theme product-vision has no summary', 'its theme product-vision has no description']],
      [{ themes: [themeOf('Product.Vision')] }, ['its theme Product.Vision is no name a topic can take, which is lowercase letters, digits and hyphens, from a letter or digit']],
      [{ themes: [themeOf('product-vision'), themeOf('content-layers')] }, ['its theme content-layers has no research beside its plan, content-layers.md']],
    ];
    for (const [plan, problems] of cases) {
      stage(explorationPlan(plan, ['product-vision']));
      assert.deepStrictEqual(checked().unfinished, [{ name: `${SPLIT_EPIC}/exploration`, problems: [whereOf('exploration'), ...problems] }], JSON.stringify(plan));
    }
    stage({ ...explorationPlan({ themes: [themeOf('product-vision')] }), [`.cache/migrate/split/${SPLIT_EPIC}/exploration/product-vision.md`]: '\n  \n' });
    assert.deepStrictEqual(checked().unfinished, [{ name: `${SPLIT_EPIC}/exploration`, problems: [whereOf('exploration'), 'its theme product-vision\'s research, product-vision.md, is empty'] }]);
  });

  it('names a theme that takes a name another item of the epic\'s map holds, a research file or item of the epic has, or a theme of another of its plans takes — its source\'s own name and a name the map dismissed free', () => {
    detect();
    stage(SPLIT_PLANS);
    createFile(main, `${EPIC}/research/orphan.md`, '# Research: Orphan\n');
    charterOnTheMap();
    const manifest = path.join(main, EPIC, 'manifest.json');
    const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    old.phases.research.items.stale = { status: 'in-progress' };
    fs.writeFileSync(manifest, JSON.stringify(old, null, 2) + '\n');
    const names = ['exploration', 'tech-stack', 'charter', 'orphan', 'stale', 'cost-economics', 'competitive-landscape'];

    stage(explorationPlan({ themes: names.map(themeOf) }, names));

    assert.deepStrictEqual(checked().unfinished, [
      { name: `${SPLIT_EPIC}/competitive-landscape`, problems: [whereOf('competitive-landscape'), 'its theme competitive-landscape is a theme of exploration\'s plan too'] },
      { name: `${SPLIT_EPIC}/cost-economics`, problems: [whereOf('cost-economics'), 'its theme cost-economics is a theme of exploration\'s plan too'] },
      {
        name: `${SPLIT_EPIC}/exploration`,
        problems: [
          whereOf('exploration'),
          `its theme charter is the name of another item on ${SPLIT_EPIC}'s map`,
          `its theme orphan would overwrite ${SPLIT_EPIC}'s research file orphan.md`,
          `its theme stale is the name of a research item ${SPLIT_EPIC} holds already`,
          `its theme cost-economics is the name of another item on ${SPLIT_EPIC}'s map`,
          `its theme cost-economics would overwrite ${SPLIT_EPIC}'s research file cost-economics.md`,
          `its theme cost-economics is the name of a research item ${SPLIT_EPIC} holds already`,
          'its theme cost-economics is a theme of cost-economics\'s plan too',
          `its theme competitive-landscape is the name of another item on ${SPLIT_EPIC}'s map`,
          `its theme competitive-landscape would overwrite ${SPLIT_EPIC}'s research file competitive-landscape.md`,
          `its theme competitive-landscape is the name of a research item ${SPLIT_EPIC} holds already`,
          'its theme competitive-landscape is a theme of competitive-landscape\'s plan too',
        ],
      },
    ]);
  });
});

describe('the runner meets the legacy split (21.4.3)', () => {
  it('21.S7: where no epic holds a source, records the directive unrun with the detection and the apply, the person seeing no interview, and runs on past it to the move', () => {
    const manifest = path.join(main, EPIC, 'manifest.json');
    const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    for (const source of SPLIT_SOURCES) old.phases.research.items[source].status = 'completed';
    fs.writeFileSync(manifest, JSON.stringify(old, null, 2) + '\n');

    const out = runner();

    assert.deepStrictEqual([out.match(/^---DIRECTIVE: (.*)---$/m)?.[1], recorded(main)], ['079-records', [...GUARDED, '075', '076', '077', '078']]);
    assert.ok(!fs.existsSync(statePath(main, '.cache/migrate/split')), 'nothing staged');
  });

  it('21.S8: where an epic holds sources, stops at the directive with them staged; once their plans are staged and it is closed, the next run applies them and moves the project, the records directive\'s check naming each of the split\'s topics, and the split\'s check passing still — after the move, with .workflows/ gone from disk as finish leaves it, and with its staging gone', () => {
    const stopped = runner();
    assert.deepStrictEqual([stopped.match(/^---DIRECTIVE: (.*)---$/m)?.[1], recorded(main)], [SPLIT, [...GUARDED, '075']]);
    stage(SPLIT_PLANS);
    ok(main, ['checklist', 'close', 'directive', SPLIT], { env: SESSION });

    const moved = runner();

    assert.deepStrictEqual([moved.match(/^---DIRECTIVE: (.*)---$/m)?.[1], recorded(main)], ['079-records', [...GUARDED, '075', '076', '077', '078']]);
    const records = ok(main, ['migrate', 'check', '079-records'], { env: SESSION });
    assert.deepStrictEqual(records.unfinished.map((/** @type {{name: string}} */ piece) => piece.name).filter((name) => name.startsWith(`${SPLIT_EPIC}/`)), [
      'api.v2', 'competitive-landscape', 'cost-economics', 'glossary', 'knowledge-model', 'multi-repo-architecture', 'onboarding', 'pricing', 'prior-art', 'product-vision', 'roadmap', 'session-capture', 'tech-stack', 'telemetry',
    ].map((topic) => `${SPLIT_EPIC}/${topic}`));
    assert.match(fs.readFileSync(statePath(main, layout.topic(SPLIT_EPIC, 'tech-stack', 'log.md')), 'utf8'), /^Tech Stack notes\.$/m);
    assert.ok(stateUnborn(main), 'nothing committed before the migration\'s commit');
    assert.deepStrictEqual(checked(), PASSED, 'after the move');
    fs.rmSync(path.join(main, '.workflows'), { recursive: true });
    assert.deepStrictEqual(checked(), PASSED, 'with .workflows/ gone');
    fs.rmSync(statePath(main, '.cache/migrate/split'), { recursive: true });
    assert.deepStrictEqual(checked(), { ...PASSED, done: 0, of: 0 }, 'with its staging gone');
  });
});

describe('the split\'s place (21.4.2)', () => {
  it('21.S9: the installed skills hold no legacy split skill — the split is the migrations\' detection, directive and apply alone', () => {
    const installed = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const steps = ['075-split-detect.cjs', '076-legacy-split.md', '076-legacy-split.check.cjs', '077-split-apply.cjs'];

    assert.deepStrictEqual([installed.filter((name) => /split/.test(name)), steps.filter((step) => fs.existsSync(path.join(MIGRATE_SCRIPTS, 'migrations', step)))], [[], steps]);
  });

  it('spells no path from the session\'s folder: every path into the state is the check\'s', () => {
    assert.ok(!fs.readFileSync(DIRECTIVE, 'utf8').includes('.leeway/'));
  });
});
