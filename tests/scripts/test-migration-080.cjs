'use strict';

// ---------------------------------------------------------------------------
// The cut and the merges (080; leeway-migrate/scripts/migrations/
// 080-cut-and-merges.md and .check.cjs, the engine's `render
// migration-leaving`, the corrections of `cut --migrating`, the mark of
// `task close-plan`, the per-unit agent's briefs and `migrate review`'s
// corrections; 21.7, 21.8, 21.10.5, 21.10.7, E7, E12, 13.S15). The check's
// pieces over a project moved by the real move: an epic being built, done
// once its topics in no spec it joined have left it and the cut has marked
// it, a dead end staying in it, decided; a unit nothing of which was built,
// done once its old plan is closed in the tracker; a cross-cutting unit,
// done once retired; a completed quick-fix, its building's item its own, no
// piece; research that fed several topics, done once its
// placement names where each source went and each topic's log holds it
// once, word for word, read where a split took the topic. The mixed unit's
// question as 21.8.10 draws it, its gate's rows carrying the directive on,
// and 21.S31's session through it: asked once, the answer kept with the
// unit's plan and read back by a session after, the topics postponed to the
// roadmap or split into a new epic, then the cut, the unit whole. The
// correcting step: a correction ending a task the manifest credits and the
// tracker holds open, read as ended before the cut's checks and ended after,
// a correction of another shape or naming a task otherwise than the tracker
// refused, every correction listed in the migration's review. The cut
// laid out phase by phase, the plans ordered by their dependencies; each
// phase's brief drawn from the directive's check, the tracker's tasks by
// the cut's names with the text of each still to build, what its plan
// depends on and where the manifest and the tracker disagree; the
// verifier's, the piece verbatim; the join of the pieces into the plan the
// cut takes, a missing or misshapen piece and an old dependency left
// unrelied refused; each record refused for a directive whose check carries
// no such piece; and an issued brief dispatched through the brief hook, a
// hand-written one refused and recorded (13.S15).
//
// Layer: verb. World: the cut and the merges' (migrated-world.cjs), built
// once per process and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, call, output, refuses, statePath, layout, readState, writeState, cleanupFixture } = harness;
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { SESSION, refusedUntouched } = require('./migration-world.cjs');
const { DRIVER, cutAndMergesProject } = require('./migrated-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { BRIEF_REFUSALS, briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { systemConfigDir } = require(path.join(SCRIPTS, 'kernel/system-config.cjs'));
const { NBSP } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));
const FINISH = require('../../skills/leeway-migrate/scripts/migrations/081-reshape-finish.cjs');
const { cutOrder } = require(path.join(SCRIPTS, 'domain/cut-merges.cjs'));

const DIRECTIVE = '080-cut-and-merges';
const STAGING = layout.cache('migrate', 'cut-and-merges', 'shop');
const REFUSALS = path.join(systemConfigDir(), BRIEF_REFUSALS);
const SESSION_ID = SESSION.CLAUDE_CODE_SESSION_ID;

/** @typedef {import('./migrated-world.cjs').OldPlan} OldPlan */
/** The tracker's ids of each old plan's root and phases, the same in every copy. @type {Record<'cart'|'pay'|'memo', OldPlan>} */
let PLANS;
/** @type {string|null} */
let template = null;
/** @type {string} */
let dir;

beforeEach(() => {
  if (template === null) {
    template = path.join(templateFolder('cut-and-merges-template-'), 'shop');
    PLANS = cutAndMergesProject(template);
  }
  dir = copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cut-and-merges-')), 'shop'));
});
afterEach(() => {
  cleanupFixture(path.dirname(dir));
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  fs.rmSync(REFUSALS, { force: true });
});
after(() => { if (template !== null) cleanupFixture(path.dirname(template)); });

/** @param {string[]} args */
const run = (args) => ok(dir, args, { env: SESSION });

/** Each piece the check names not done, with what it lacks. */
const unfinished = () => run(['migrate', 'check', DIRECTIVE]).unfinished;

/** What the check says the piece `name` lacks, or null where it is done. @param {string} name */
const lacks = (name) => unfinished().find((piece) => piece.name === name)?.problems ?? null;

/** The shop's manifest as the move left it in `.workflows/`, changed by `change`. @param {(before: Record<string, any>) => void} change */
function oldManifest(change) {
  const file = path.join(dir, '.workflows', 'shop', 'manifest.json');
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(before);
  fs.writeFileSync(file, JSON.stringify(before, null, 2));
}

/** The unit's plan staged where the directive keeps it. @param {Record<string, unknown>} plan */
const stage = (plan) => writeState(dir, `${STAGING}/plan.json`, JSON.stringify(plan, null, 2));

const LEFT = { leaving: { to: 'roadmap', horizon: 'later' } };

/** The disagreement phase 4's brief names: the manifest credits a task the tracker holds in progress. */
const REFUND_DISAGREES = 'pay-2-2, task 4.2, "Refund a charge": the manifest credits it done, and the tracker holds it in progress';

/** The correction settling it, as phase 4's agent composes it. */
const REFUND_CORRECTED = {
  was: REFUND_DISAGREES, found: 'Refunds, whole or part, are in the code.', changed: 'Task 4.2 made done.', task: '4.2', title: 'Refund a charge', to: 'done',
};

/** The shop's plan as the join leaves it, the correction among it. @param {Record<string, unknown>} [over] */
const shopPlan = (over = {}) => ({
  phases: [
    { name: 'The cart', goal: 'Items held.', sections: ['1'], built: true, tracker: PLANS.cart.phases[0] },
    { name: 'Saving', goal: 'Carts kept.', sections: ['1'], built: true, tracker: PLANS.cart.phases[1] },
    { name: 'Cards', goal: 'Cards taken.', sections: ['2'], built: true, tracker: PLANS.pay.phases[0] },
    { name: 'Charges', goal: 'Cards charged and refunded.', sections: ['2'], built: true, tracker: PLANS.pay.phases[1] },
    { name: 'Export', goal: 'Payments exported.', scenarios: ['2.S1'], sections: ['2'], relies_on: [4], tracker: PLANS.pay.phases[2] },
  ],
  scenarios: { 2: ['Given a month of payments, when they are exported, then a file holds each.'] },
  notes: [],
  corrections: [REFUND_CORRECTED],
  answers: LEFT,
  ...over,
});

/** The plan staged and cut, as the directive runs it. @param {Record<string, unknown>} plan */
function cutBy(plan) {
  stage(plan);
  return run(['cut', 'shop', '--migrating', '--file', statePath(dir, STAGING, 'plan.json')]);
}

/** The research placed on `topics`, appended to each log, and the placement written. @param {string[]} topics */
function placed(topics) {
  for (const topic of topics) {
    const log = statePath(dir, layout.topic('shop', topic, 'log.md'));
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.appendFileSync(log, `\n${PLACED_SECTION}`);
  }
  writeState(dir, `${STAGING}/placed.json`, JSON.stringify({ 'session-001.md': { exploration: topics } }));
}

/** The exploration research as the move headed it in the epic's session, a level down: its title one word, read as no source. */
const PLACED_TEXT = '## Research: Exploration\n\n### Buyers\n\nThey come back for reviews.\n\n### Gifts\n\nWrapped at the till.';
const PLACED_SECTION = `## Research: exploration, from discovery session 001\n\n${PLACED_TEXT}\n`;

describe('the pieces (21.7, 21.8)', () => {
  it('names each piece and what it lacks: the cross-cutting unit still a unit, the unit nothing of which was built with its plan open in the tracker, the building epic\'s topics in no spec — its dead end staying, decided — and its research not placed; the completed quick-fix no piece', () => {
    assert.deepStrictEqual(run(['migrate', 'check', DIRECTIVE]), {
      ok: true, directive: DIRECTIVE, passed: false, done: 0, of: 4, counts: { one: 'piece of work', many: 'pieces of work' },
      unfinished: [
        { name: 'caching', problems: ['is still a unit — retire it once its record is the product\'s'] },
        { name: 'memo', problems: [`its plan memo, in the tracker under ${PLANS.memo.root}, is not closed yet`] },
        { name: 'shop', problems: ['its topics reviews, gifts are in no spec it joined, so they leave it, and the person has not said where — ask once (21.8.10)', 'is not cut yet'] },
        { name: 'shop/research', problems: ['its research that fed several topics is not placed yet: session-001.md (exploration)'] },
      ],
    });
    assert.strictEqual(JSON.parse(readState(dir, layout.manifest('shop'))).phases.discussion.items.wrap.status, 'completed', 'the dead end stays, decided');
  });

  it('a unit nothing of which was built: done once its plan is closed in the tracker, the close marking it, a run again closing none (21.8.4, 21.8.12)', () => {
    assert.strictEqual(run(['task', 'close-plan', 'memo', '--parent', PLANS.memo.root]).closed, 2);
    const mark = JSON.parse(readState(dir, layout.cache('migrate', 'closed', 'memo', `${PLANS.memo.root}.json`)));

    assert.deepStrictEqual([lacks('memo'), mark.closed, typeof mark.at], [null, 2, 'string']);
    assert.strictEqual(run(['task', 'close-plan', 'memo', '--parent', PLANS.memo.root]).closed, 0);
    assert.strictEqual(lacks('memo'), null);
  });

  it('a cross-cutting unit: done once retired, its folder kept in the product\'s assets (21.7.3, 21.7.5)', () => {
    run(['workunit', 'retire', 'caching']);

    assert.deepStrictEqual([lacks('caching'), fs.existsSync(statePath(dir, layout.productAssets('caching')))], [null, true]);
    fs.rmSync(statePath(dir, layout.productAssets('caching')), { recursive: true });
    assert.deepStrictEqual(lacks('caching'), ['is off the registry, and .product/assets/caching does not hold it']);
  });

  it('a cross-cutting unit an epic still promotes a topic to is not done (21.7.3)', () => {
    run(['workunit', 'retire', 'caching']);
    const manifest = JSON.parse(readState(dir, layout.manifest('shop')));
    manifest.phases.discussion.items.reviews = { status: 'promoted', promoted_to: 'caching' };
    writeState(dir, layout.manifest('shop'), JSON.stringify(manifest, null, 2));

    assert.deepStrictEqual(lacks('caching'), ['shop\'s reviews is still promoted to it']);
  });

  it('a building unit whose plan is kept in plain files, with no tracker root, needs a migration of its own (21.8.13)', () => {
    oldManifest((before) => { delete before.phases.planning.items.cart.external_id; });

    assert.deepStrictEqual(lacks('shop'), ['its plans cart are kept in plain files, with no tracker root, and the cut adopts a plan from the tracker alone (21.8.13) — it needs a migration of its own']);
  });
});

describe('research that fed several topics, placed where it bears (21.7.2)', () => {
  it('done once the placement names each source\'s topics and each log holds the section once, under its heading, word for word; or the source left epic-wide', () => {
    placed(['reviews', 'gifts']);
    assert.strictEqual(lacks('shop/research'), null);

    writeState(dir, `${STAGING}/placed.json`, JSON.stringify({ 'session-001.md': { exploration: [] } }));
    assert.strictEqual(lacks('shop/research'), null, 'left epic-wide');
  });

  it('names a section missing from a log, held twice, or altered; a source placed nowhere; and a session or a source the migration wrote none of', () => {
    placed(['reviews', 'gifts']);
    const log = (/** @type {string} */ topic) => statePath(dir, layout.topic('shop', topic, 'log.md'));
    fs.appendFileSync(log('reviews'), `\n${PLACED_SECTION}`);
    fs.writeFileSync(log('gifts'), fs.readFileSync(log('gifts'), 'utf8').replace('Wrapped at the till.', 'Wrapped.'));
    writeState(dir, `${STAGING}/placed.json`, JSON.stringify({ 'session-001.md': { exploration: ['reviews', 'gifts', 'cart'], ghosts: [] }, 'session-009.md': {} }));

    assert.deepStrictEqual(lacks('shop/research'), [
      'its placement names session-009.md, which is no discovery session of the migration\'s',
      'its placement names ghosts in session-001.md, which holds no such research',
      'session-001.md\'s exploration: reviews\'s log holds "## Research: exploration, from discovery session 001" 2 times — the placed research goes under it once',
      'session-001.md\'s exploration: gifts\'s log holds "## Research: exploration, from discovery session 001" without the research beneath it as the session has it',
      'session-001.md\'s exploration: cart\'s log holds "## Research: exploration, from discovery session 001" nowhere — the placed research goes under it once',
    ]);
    writeState(dir, `${STAGING}/placed.json`, JSON.stringify({ 'session-001.md': {} }));
    assert.deepStrictEqual(lacks('shop/research'), ['session-001.md\'s research exploration is placed nowhere — name the topics it bears on, or none to leave it epic-wide']);
  });

  it('a topic a split took on to another epic is read there', () => {
    placed(['reviews']);
    const log = writeState(dir, layout.cache('scratch', 'storefront.md'), '# Discovery Session 001\n\nWhat buyers see.\n');
    run(['workunit', 'split', 'shop', '--topics', 'reviews', '--into', 'storefront', '--description', 'What buyers see', '--session-log-file', log]);

    assert.strictEqual(lacks('shop/research'), null);
  });
});

describe('the mixed unit\'s question (21.8.9, 21.8.10)', () => {
  it('draws the building unit, how many of its topics its specs cover, and those that leave it by where each stands, each by its title; then where they go, each row carrying the directive on', () => {
    assert.strictEqual(output(dir, ['render', 'migration-leaving', 'shop', '--directive', DIRECTIVE], { env: SESSION }), [
      '=== DISPLAY: migration leaving (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      '▪ Migration',
      '',
      'Shop is being built, and its specs cover 3 of its topics. A unit',
      'being built can\'t take a topic its specs don\'t cover, so these 2',
      'leave it:',
      '',
      'IN PROGRESS (1)',
      '  └─ Reviews',
      '',
      'NOT STARTED (1)',
      '  └─ Gifts',
      '',
      '=== MENU: migration leaving gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Once they go, Shop is whole: every topic decided, its specs joined, one build.',
      '',
      '**`◆ Where do these 2 topics go?`**',
      '',
      '**`n/new`**     → A new epic, which you name — they move whole and',
      `${NBSP.repeat(12)}start in discussion`,
      '**`r/roadmap`** → The roadmap, as postponed topics — I\'ll ask which',
      `${NBSP.repeat(12)}horizon next`,
      '',
    ].join('\n'));
    for (const key of ['n', 'r']) {
      output(dir, ['render', 'migration-leaving', 'shop', '--directive', DIRECTIVE], { env: SESSION });
      assert.deepStrictEqual(run(['gate', 'migration leaving gate', '--pick', key]).next, { kind: 'continue' });
    }
  });

  it('refuses without the unit or the directive, a directive whose check answers no unit\'s leaving topics, and a unit no topic leaves', () => {
    for (const [args, refusal] of [
      [['shop'], 'render migration-leaving: <unit> --directive <id> — the building unit, and the directive asking where its leaving topics go'],
      [['shop', '--directive', '079-records'], 'render migration-leaving: 079-records\'s check answers no unit\'s leaving topics'],
      [['memo', '--directive', DIRECTIVE], 'render migration-leaving: no topic leaves memo — the question is asked of a building unit with topics its specs do not cover'],
    ]) assert.strictEqual(refusedUntouched(dir, ['render', 'migration-leaving', ...args], { env: SESSION }, harness), refusal);
  });

  it('21.S31: asked once, the answer kept with the unit\'s plan, which a session after reads back; to the roadmap, the horizon asked next, each topic postponed; then the cut, and the unit is whole — every topic decided, its specs joined, one build (21.7.4)', () => {
    output(dir, ['render', 'migration-leaving', 'shop', '--directive', DIRECTIVE], { env: SESSION });
    run(['gate', 'migration leaving gate', '--pick', 'r']);
    assert.match(output(dir, ['render', 'horizon-pick', '--park', 'reviews,gifts'], { env: SESSION }), /^\*\*`1`\*\* +→ next — /m);
    stage({ answers: LEFT });

    assert.deepStrictEqual(lacks('shop'), ['its topics reviews, gifts are in no spec it joined and have not left it yet, where the person said they go', 'is not cut yet'], 'never asked again');
    for (const topic of ['reviews', 'gifts']) run(['topic', 'postpone', 'shop', topic, '--horizon', 'later']);
    assert.deepStrictEqual(lacks('shop'), ['is not cut yet']);

    cutBy(shopPlan());

    assert.strictEqual(lacks('shop'), null);
    const manifest = JSON.parse(readState(dir, layout.manifest('shop')));
    const live = Object.entries(manifest.phases.discussion.items).filter(([topic]) => manifest.phases.discovery.items[topic].postponed !== true);
    assert.deepStrictEqual([live.map(([topic, { status }]) => [topic, status]), manifest.spec.joined, manifest.cut.phases.length, manifest.build.position],
      [[['cart', 'completed'], ['pay', 'completed'], ['wrap', 'completed'], ['refunds', 'completed'], ['coupons', 'cancelled']], ['cart', 'pay'], 5, 'step']);
  });

  it('to a new epic the person names: the topics move whole and start in discussion there', () => {
    stage({ answers: { leaving: { to: 'epic', epic: 'storefront' } } });
    const log = writeState(dir, layout.cache('scratch', 'storefront.md'), '# Discovery Session 001\n\nThe shop\'s reviews and gifts, moved at the migration.\n');
    run(['workunit', 'split', 'shop', '--topics', 'reviews,gifts', '--into', 'storefront', '--description', 'What buyers see', '--session-log-file', log]);

    assert.deepStrictEqual(lacks('shop'), ['is not cut yet']);
    assert.deepStrictEqual(Object.keys(JSON.parse(readState(dir, layout.manifest('storefront'))).phases.discovery.items), ['reviews', 'gifts']);
  });
});

describe('the correcting step: where the manifest and the tracker disagree', () => {
  it('a correction ends the task the tracker held open, read as ended before the cut checks the phase built; the cut\'s mark keeps it, and the migration\'s review lists it by its unit', () => {
    const res = cutBy(shopPlan());

    assert.deepStrictEqual([res.corrections, res.ended, DRIVER.show(statePath(dir), { unit: 'shop', phase: 4, n: 2 })?.status], [1, ['4.2'], 'done']);
    assert.deepStrictEqual(JSON.parse(readState(dir, layout.cache('migrate', 'cut', 'shop.json'))).corrections, [REFUND_CORRECTED]);
    FINISH.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
    assert.deepStrictEqual(run(['migrate', 'review']).reshape.corrections, [{ unit: 'shop', ...REFUND_CORRECTED }]);
  });

  it('a task closed where the code shows its work is not wanted, what was found its reason; a correction ending nothing, or a task the tracker holds ended, changes nothing in the tracker', () => {
    const closing = { ...REFUND_CORRECTED, found: 'Refunds were dropped: the till refunds.', changed: 'Task 4.2 closed.', to: 'closed' };
    const standing = { was: 'phase 3 of pay\'s plan', found: 'The code holds it.', changed: 'Nothing: the tracker stands.' };
    const ended = { was: 'pay-2-1, task 4.1, "Charge the card"', found: 'Charges are in the code.', changed: 'Nothing: the tracker holds it done.', task: '4.1', title: 'Charge the card', to: 'closed' };
    const res = cutBy(shopPlan({ corrections: [closing, standing, ended] }));

    const refund = DRIVER.show(statePath(dir), { unit: 'shop', phase: 4, n: 2 });
    assert.deepStrictEqual([refund?.status, refund?.reason], ['closed', closing.found]);
    assert.deepStrictEqual([res.ended, DRIVER.show(statePath(dir), { unit: 'shop', phase: 4, n: 1 })?.status], [['4.2'], 'done'], 'a task the tracker holds ended is not ended again');
  });

  it('refuses, writing nothing to the tracker or the unit, the phase marked built with its task open and no correction — the tracker wins — a correction naming a task otherwise than the tracker or one no adopted phase holds, and one of another shape', () => {
    const held = () => [...DRIVER.storeFiles().map((file) => readState(dir, file)), readState(dir, layout.manifest('shop')), readState(dir, 'shop/spec.md'), fs.existsSync(statePath(dir, layout.cache('migrate', 'cut', 'shop.json')))];
    const cut = (/** @type {Record<string, unknown>[]} */ corrections) => {
      stage(shopPlan({ corrections }));
      const before = held();
      const { error } = refuses(dir, ['cut', 'shop', '--migrating', '--file', statePath(dir, STAGING, 'plan.json')], { env: SESSION });
      assert.deepStrictEqual(held(), before, 'nothing written to the tracker or the unit');
      return error;
    };

    assert.match(cut([]), /^cut: phase 4 is marked built, and the tracker holds task 4\.2 neither done nor closed — the tracker wins/);
    assert.match(cut([{ ...REFUND_CORRECTED, title: 'Refund' }]), /a correction names task 4\.2 "Refund", and the tracker titles it "Refund a charge"/);
    assert.match(cut([REFUND_CORRECTED, { ...REFUND_CORRECTED, task: '4.9' }]), /a correction names task 4\.9, which no phase the cut adopts holds/);
    assert.match(cut([{ was: REFUND_DISAGREES, found: 'Refunds are in the code.', task: '4.2', to: 'done' }, { ...REFUND_CORRECTED, task: '6.1' }, { ...REFUND_CORRECTED, note: 'x' }, { ...REFUND_CORRECTED, to: 'reopened' }]), new RegExp([
      'correction 1\'s changed is not one line of text',
      'correction 1 ends a task by its "task", the name its phase\'s adoption gives it, its "title" as the tracker holds it, and "to", done or closed — all three',
      'correction 2 ends task 6\\.1, of a phase that names no tracker parent — a correction ends a task of a phase the cut adopts',
      'correction 3 is not \\{"was", "found", "changed"\\}, with \\{"task", "title", "to"\\} where it ends a task',
      'correction 4 ends a task by its "task", the name its phase\'s adoption gives it, its "title" as the tracker holds it, and "to", done or closed — all three',
    ].join('.*'), 's'));
  });
});

describe('the per-phase agents and the join (21.10.5, E7)', () => {
  /** A phase's piece written where its agent writes it. @param {number} number @param {Record<string, unknown>} piece */
  const compose = (number, piece) => writeState(dir, `${STAGING}/phases/${number}.json`, JSON.stringify(piece, null, 2));

  /** Phase 4's piece, the charges: found built once the refund's correction is made. */
  const CHARGES = { phase: { name: 'Charges', goal: 'Cards charged and refunded.', sections: ['2'], built: true }, scenarios: [], notes: [], corrections: [REFUND_CORRECTED] };

  /** Phase 5's piece, the export, still to build. @param {Record<string, unknown>} [over] */
  const exported = (over = {}) => ({
    phase: { name: 'Export', goal: 'Payments exported.', sections: ['2'], relies_on: [4] },
    scenarios: ['Given a month of payments, when they are exported, then a file holds each.'], notes: [], corrections: [], ...over,
  });

  /** @param {string[]} args */
  const briefText = (args) => fs.readFileSync(briefPath(SESSION_ID, run(['brief', ...args]).id), 'utf8');

  it('lays the cut out phase by phase, each old plan\'s in its own order, the plans as their dependencies allow; a phase built where the manifest and the tracker agree is the join\'s, any other an agent\'s, its brief drawing its tasks by the cut\'s names, each still to build with its text, what its plan depends on and where the two disagree — the verifier\'s findings on it taken and cleared; the verifier\'s brief, its piece verbatim', () => {
    writeState(dir, `${STAGING}/phases/4.findings.md`, '- The refund\'s correction names no code.\n');
    const issued = run(['brief', 'migration-phase', 'shop', '--directive', DIRECTIVE, '--phase', '4']);
    const brief = fs.readFileSync(briefPath(SESSION_ID, issued.id), 'utf8');

    assert.strictEqual(issued.agent, 'leeway-migration-topic');
    for (const part of [
      '## Its joined spec\n\nshop/spec.md, an area for each spec joined, in build order:\n\n- §1 cart, joined from .workflows/shop/specification/cart/specification.md\n- §2 pay, joined from .workflows/shop/specification/pay/specification.md',
      [
        '- Phase 1: phase 1 of cart\'s plan, built — the join writes it',
        '- Phase 2: phase 2 of cart\'s plan, built — the join writes it',
        '- Phase 3: phase 1 of pay\'s plan, built — the join writes it',
        '- Phase 4: phase 2 of pay\'s plan, still to build',
        '- Phase 5: phase 3 of pay\'s plan, still to build',
      ].join('\n'),
      '## What its plan depends on\n\n- cart-2-1, which phase 2, phase 2 of cart\'s plan, builds\n\n## Your phase',
      `- Phase 4: phase 2 of pay's plan, its tracker parent ${PLANS.pay.phases[1]}\n- Its area: §2 pay of shop/spec.md`,
      '### Its tasks\n\n- 4.1, pay-2-1 — "Charge the card", done; the manifest credits it done\n\n- 4.2, pay-2-2 — "Refund a charge", in progress; the manifest credits it done\n\n```markdown\n**Problem**: A charge is kept for good.',
      `### Where the manifest and the tracker disagree\n\n- ${REFUND_DISAGREES}`,
      '## Where your piece goes\n\n- The piece composed: .cache/migrate/cut-and-merges/shop/phases/4.json\n- The verifier\'s findings on it: .cache/migrate/cut-and-merges/shop/phases/4.findings.md',
      '# The verifier\'s findings\n\n- The refund\'s correction names no code.\n\n# The directive',
    ]) assert.ok(brief.includes(part), `${part}\n\nin\n\n${brief}`);
    assert.ok(!fs.existsSync(statePath(dir, STAGING, 'phases/4.findings.md')), 'the findings taken are cleared');
    assert.ok(briefText(['migration-phase', 'shop', '--directive', DIRECTIVE, '--phase', '4']).includes('# The verifier\'s findings\n\nNone recorded.'));

    assert.deepStrictEqual(['1', '9'].map((phase) => refusedUntouched(dir, ['brief', 'migration-phase', 'shop', '--directive', DIRECTIVE, '--phase', phase], { env: SESSION }, harness)), [
      'brief: phase 1 of shop\'s cut is built, and the manifest and the tracker agree — the join writes it',
      'brief: shop\'s cut has no phase 9 — its phases are numbered 1 to 5',
    ]);
    assert.match(refusedUntouched(dir, ['brief', 'migration-phase-verifier', 'shop', '--directive', DIRECTIVE, '--phase', '5'], { env: SESSION }, harness), /^phase 5 of shop's cut has no piece composed — .*phases\/5\.json is no file$/);
    compose(5, exported());
    assert.ok(briefText(['migration-phase-verifier', 'shop', '--directive', DIRECTIVE, '--phase', '5']).includes(`# The piece\n\n\`\`\`json\n${JSON.stringify(exported(), null, 2)}\n\`\`\``));
  });

  it('names in a phase\'s brief where the manifest and the tracker disagree over its mark — built in one and not the other — and a task the tracker holds done the manifest does not credit; a phase so named an agent\'s', () => {
    oldManifest((before) => {
      before.phases.implementation.items.cart = { status: 'in-progress', completed_phases: [1], completed_tasks: ['cart-1-1', 'cart-1-2'] };
      before.phases.implementation.items.pay.completed_phases = [1, 2];
    });
    const disagree = (/** @type {string} */ phase) => briefText(['migration-phase', 'shop', '--directive', DIRECTIVE, '--phase', phase]).split('### Where the manifest and the tracker disagree\n\n')[1].split('\n\n')[0];

    assert.deepStrictEqual([disagree('2'), disagree('4')], [
      '- phase 2, phase 2 of cart\'s plan: the tracker holds every task of it ended, and the manifest does not count it built\n- cart-2-1, task 2.1, "Save the cart": the tracker holds it done, and the manifest does not credit it',
      `- phase 4, phase 2 of pay's plan: the manifest counts it built, and the tracker holds 1 of its tasks neither done nor closed\n- ${REFUND_DISAGREES}`,
    ]);
  });

  it('joins the pieces into the plan the cut takes — the phases the join writes, each naming its tracker parent, each phase\'s scenarios numbered on in its area — the person\'s answers kept, its path from the project\'s folder; the cut applies it', () => {
    stage({ answers: LEFT });
    compose(4, CHARGES);
    compose(5, exported());
    const joined = run(['migrate', 'join', 'shop', '--directive', DIRECTIVE]);

    assert.deepStrictEqual(joined, { ok: true, unit: 'shop', plan: '.leeway/.cache/migrate/cut-and-merges/shop/plan.json', phases: 5, built: 4, scenarios: 1, corrections: 1 });
    assert.deepStrictEqual(JSON.parse(readState(dir, `${STAGING}/plan.json`)), {
      phases: [
        { name: 'Cart, phase 1', goal: 'Phase 1 of the cart plan, built before the migration.', sections: ['1'], built: true, tracker: PLANS.cart.phases[0] },
        { name: 'Cart, phase 2', goal: 'Phase 2 of the cart plan, built before the migration.', sections: ['1'], built: true, tracker: PLANS.cart.phases[1] },
        { name: 'Pay, phase 1', goal: 'Phase 1 of the pay plan, built before the migration.', sections: ['2'], built: true, tracker: PLANS.pay.phases[0] },
        { name: 'Charges', goal: 'Cards charged and refunded.', sections: ['2'], built: true, tracker: PLANS.pay.phases[1] },
        { name: 'Export', goal: 'Payments exported.', sections: ['2'], scenarios: ['2.S1'], relies_on: [4], tracker: PLANS.pay.phases[2] },
      ],
      scenarios: { 2: ['Given a month of payments, when they are exported, then a file holds each.'] },
      notes: [],
      corrections: [REFUND_CORRECTED],
      answers: LEFT,
    });
    assert.deepStrictEqual(run(['cut', 'shop', '--migrating', '--file', joined.plan]).ended, ['4.2']);
  });

  it('refuses, writing no plan, a phase with no piece or a piece of another shape, and a phase relying on nothing for a phase still to build its plan depends on, naming both', () => {
    compose(4, { ...CHARGES, scenarios: ['A scenario.'] });
    const join = () => harness.refuses(dir, ['migrate', 'join', 'shop', '--directive', DIRECTIVE], { env: SESSION }).error;
    assert.strictEqual(join(), [
      'migrate join: phase 4\'s piece marks it built and gives it scenarios — a phase found built places no scenario and relies on nothing',
      `phase 5 has no piece that reads — .cache/migrate/cut-and-merges/shop/phases/5.json: ENOENT: no such file or directory, open '${statePath(dir, STAGING, 'phases/5.json')}'`,
    ].join('; '));
    compose(4, CHARGES);
    compose(5, exported({ phase: { name: 'Export', goal: 'Payments exported.', sections: ['2'] } }));
    assert.strictEqual(join(), 'migrate join: phase 5\'s piece gives no "relies_on" — a phase still to build names what it relies on, [] for nothing');

    oldManifest((before) => { before.phases.implementation.items.cart.completed_phases = [1]; });
    compose(2, { phase: { name: 'Saving', goal: 'Carts kept.', sections: ['1'], relies_on: [] }, scenarios: ['Given a cart, when it is saved, then it is kept a week.'], notes: [], corrections: [] });
    compose(4, { ...CHARGES, phase: { name: 'Charges', goal: 'Cards charged.', sections: ['2'], relies_on: [] }, scenarios: ['Given a card, when it is charged, then the charge is kept.'] });
    compose(5, exported());
    assert.strictEqual(join(), 'migrate join: phase 4, of pay\'s plan, relies on nothing for cart-2-1, which phase 2, of cart\'s plan, builds — it relies on phase 2; phase 5, of pay\'s plan, relies on nothing for cart-2-1, which phase 2, of cart\'s plan, builds — it relies on phase 2');
    assert.ok(!fs.existsSync(statePath(dir, STAGING, 'plan.json')));
  });

  it('orders the plans as their dependencies allow and otherwise as the spec joins their topics, each the first in the spec\'s order whose dependencies are placed, an area no plan holds where the spec joins it', () => {
    const plan = (/** @type {string} */ topic, /** @type {string[]} */ on) => ({ topic, files: [], root: null, phases: [], dependencies: on.map((name) => ({ on: name })) });
    const areas = ['shell', 'network', 'docs', 'radio'].map((topic) => ({ topic }));
    assert.deepStrictEqual(cutOrder([plan('shell', ['network', 'radio']), plan('network', []), plan('radio', ['network'])], areas).map(({ topic, plan: held }) => [topic, held !== null]), [
      ['network', true], ['docs', false], ['radio', true], ['shell', true],
    ]);
  });

  it('each migrated record drawn from the directive the brief names: refused for one whose check carries no such piece — a topic\'s record for the cut and the merges, a phase\'s for the records — and a unit whose building never started (PLAN 1104)', () => {
    assert.strictEqual(refusedUntouched(dir, ['brief', 'migration-topic', '--topic', 'shop.discussion.reviews', '--directive', DIRECTIVE], { env: SESSION }, harness),
      `brief: ${DIRECTIVE} carries no topic's work — its pieces are not topics`);
    assert.strictEqual(refusedUntouched(dir, ['brief', 'migration-phase', 'shop', '--directive', '079-records', '--phase', '4'], { env: SESSION }, harness),
      'brief: 079-records carries no unit\'s work — its pieces are not units');
    assert.strictEqual(refusedUntouched(dir, ['brief', 'migration-phase', 'memo', '--directive', DIRECTIVE, '--phase', '1'], { env: SESSION }, harness),
      'brief: memo is no unit whose building started — the cut and the merges cut a unit the move left an old plan\'s items on');
  });

  it('13.S15: the brief the engine issued goes through the brief hook as issued; one written by hand is refused and recorded', () => {
    const { id } = run(['brief', 'migration-phase', 'shop', '--directive', DIRECTIVE, '--phase', '5']);
    const hook = (/** @type {string} */ prompt) => call(dir, ['brief', 'guard'], {
      stdin: JSON.stringify({ session_id: SESSION_ID, cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'Compose the export', prompt, subagent_type: 'leeway-migration-topic' } }),
    });

    const issued = hook(`brief:${id}`);
    assert.deepStrictEqual([issued.code, JSON.parse(issued.stdout).hookSpecificOutput.updatedInput.prompt], [0, fs.readFileSync(briefPath(SESSION_ID, id), 'utf8')]);
    const written = hook('Compose the export\'s piece from its tasks.');
    assert.strictEqual(written.code, 2);
    assert.deepStrictEqual(fs.readFileSync(REFUSALS, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).map(({ agent, reason }) => [agent, reason]), [['leeway-migration-topic', 'no-brief']]);
  });
});
