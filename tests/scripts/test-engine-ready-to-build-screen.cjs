'use strict';

// ---------------------------------------------------------------------------
// Ready to build's screen (leeway-engine/scripts/domain/ready-to-build.cjs,
// its screen domain/projections/ready-to-build.cjs): `engine render
// ready-to-build <unit> [--page] [--calls]`, an epic's screen as 11.8.8
// draws it — Claude's calls at the spec counted by kind, the outline, the
// phase cut read from the manifest (11.S31), auto first and recommended
// (3.S18), the review row only where the session can publish a page
// (11.S22, 11.S27), and, while the page is open, its foot counting the
// review by the marks last stored (11.11.7); a verdict asked of each call
// the person changed among the spec's gap answers before the gate
// (16.10.11); no construction, finding, re-loop or sign-off gate left to
// raise before it (11.S12); and the units that never come to it — an old
// spec's items, a unit the spec's entry refuses. Every refusal writes and
// commits nothing.
//
// Layer: verb. World: the ready to build world closed
// (ready-to-build-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, sectionOf, statePath, layout, readState, readManifest, commitAll } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { MADE } = require('./ledger-world.cjs');
const { NB, unwrap } = require('./render-surfaces-world.cjs');
const { renderSurface } = require('../../skills/leeway-engine/scripts/domain/render.cjs');
const { UNIT, SESSION, SPEC_AT, READ_BACK, CARDS, REFUNDS, write, answered, written, cut, closeReady, closed, useReadyWorld, readyHelpers } = require('./ready-to-build-world.cjs');

const dir = useReadyWorld(closed);
const { screen, rowKeys, pick, refused, publish, readBack } = readyHelpers(dir);

describe('the screen (11.8.8, 3.S18)', () => {
  it('draws an epic\'s ready to build: its title, Claude\'s calls at the spec counted by kind, the outline, the phase cut read from the manifest, and the foot over auto first and recommended, step, the calls and a comment — no review row where the session cannot publish a page (11.S27, 11.S31)', () => {
    const out = screen();

    assert.strictEqual(sectionOf(out, 'DISPLAY: ready to build'), [
      'Payments — ready to build',
      '',
      'CLAUDE\'S CALLS (2)',
      '  1 behaviour · 1 unlabelled — the labeller gives each its kind',
      '',
      'THE OUTLINE (2 sections)',
      '  ├─ 1 Cards',
      '  └─ 2 Refunds',
      '',
      'THE PHASE CUT (2 phases · 3 scenarios)',
      '  ├─ 1 Cards',
      '  │     2 scenarios · draws on §1',
      '  └─ 2 Refunds',
      '        1 scenario · draws on §2.1',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: ready to build'), [
      '· · · · · · · · · · · ·',
      'Your pick approves the outline and the phase cut, and starts the build in that position.',
      '',
      '**`◆ Build it, and in which position?`**',
      '',
      '**`a/auto`**  → Auto — runs on its own; danger stops what it touches, a',
      `${NB(10)}question for you parks only what depends on it, and`,
      `${NB(10)}finish waits for you (recommended)`,
      '**`s/step`**  → Step — it also stops after each task, for you to review',
      `${NB(10)}and test it`,
      '**`c/calls`** → See Claude\'s 2 calls',
      '**Comment** → Ask for a change to the outline or the phase cut',
      '',
    ].join('\n'));
    assert.deepStrictEqual(pick('ready to build', 'a'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'auto'] });
    screen();
    assert.deepStrictEqual(pick('ready to build', 's'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'step'] });
  });

  it('offers the review on a page where the session can publish one, saying it is optional, the row building the page (11.S22, 11.11.11)', () => {
    const out = screen(['--page']);

    assert.deepStrictEqual(rowKeys(out), ['a/auto', 's/step', 'r/review', 'c/calls', 'Comment']);
    assert.match(unwrap(sectionOf(out, 'MENU: ready to build')), /^\*\*`r\/review`\*\* → Review the spec on a page first — all of it, the parts you care about, or none$/m);
    assert.deepStrictEqual(pick('ready to build', 'r'), { kind: 'engine', argv: ['spec', 'page', UNIT] });
  });

  it('lists Claude\'s calls at the spec with --calls, each under its question with its kind — never a call made in a topic — and draws no calls row', () => {
    const out = screen(['--calls', '--page']);

    assert.match(sectionOf(out, 'DISPLAY: ready to build'), /^CLAUDE'S CALLS \(2\)\n {2}1 behaviour · 1 unlabelled — the labeller gives each its kind\n {2}├─ ◇ What of an unknown brand\? +\[behaviour\]\n {2}│ {5}Refused\.\n {2}└─ ◇ How soon is a refund sent\? +\[unlabelled\]\n {8}Within a day\.\n$/m);
    assert.deepStrictEqual(rowKeys(out), ['a/auto', 's/step', 'r/review', 'Comment']);
  });

  it('opens the calls from their row, keeping the review row the session can offer', () => {
    screen(['--page']);

    assert.deepStrictEqual(pick('ready to build', 'c'), { kind: 'engine', argv: ['render', 'ready-to-build', UNIT, '--calls', '--page'] });
  });

  it('while the review page is open, counts in the foot the lines ticked, those carrying Claude\'s tick let stand and the rest, by the marks last stored; its review row reads the comments, and each pick takes the marks read back (11.11.7, 11.11.5)', () => {
    publish();
    ok(dir(), ['spec', 'marks', UNIT, '--file', readBack({ s1: { m: { '1-1-1': { s: 'tick' } } } })]);
    const out = screen(['--page']);

    assert.match(sectionOf(out, 'MENU: ready to build'), /^Your pick approves the outline and the phase cut, records the 1 line you ticked on the review page and the 2 carrying Claude's tick that you let stand \(the other 4 pass without review\), and starts the build in that position\.$/m);
    assert.match(unwrap(sectionOf(out, 'MENU: ready to build')), /^\*\*`r\/review`\*\* +→ Read the comments you've left on the page$/m);
    const file = statePath(dir(), READ_BACK);
    assert.deepStrictEqual(pick('ready to build', 'r'), { kind: 'engine', argv: ['spec', 'marks', UNIT, '--file', file] });
    screen(['--page']);
    assert.deepStrictEqual(pick('ready to build', 'a'), { kind: 'engine', argv: ['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', file] });
  });

  it('says the one line left passes without review', () => {
    publish();
    ok(dir(), ['spec', 'marks', UNIT, '--file', readBack({ s1: { m: Object.fromEntries(['1-1-1', '1-1-2', '1-S2', '2-1-2'].map((id) => [id, { s: 'tick' }])) } })]);

    assert.match(sectionOf(screen(), 'MENU: ready to build'), /^Your pick approves the outline and the phase cut, records the 4 lines you ticked on the review page and the 2 carrying Claude's tick that you let stand \(the other 1 passes without review\), and starts the build in that position\.$/m);
  });

  it('says so where the person ticked nothing on the open page', () => {
    publish();

    assert.match(sectionOf(screen(), 'MENU: ready to build'), /^Your pick approves the outline and the phase cut, records the 3 carrying Claude's tick that you let stand \(the other 4 pass without review\), and starts the build in that position\.$/m);
  });

  it('shows a skipped item with its reason (6.4.5)', () => {
    ok(dir(), ['checklist', 'done', 'ready-to-build', UNIT, 'replacements-checked']);
    ok(dir(), ['checklist', 'skip', 'ready-to-build', UNIT, 'invariants-checked', '--reason', 'The spec states no invariant.']);
    ok(dir(), ['checklist', 'close', 'ready-to-build', UNIT]);

    assert.match(sectionOf(screen(), 'DISPLAY: ready to build'), /\n\n {2}⚑ Skipped: every invariant names a check or says none can — The\n {4}spec states no invariant\.\n$/);
  });
});

describe('a verdict on each call the person changed among the spec\'s gap answers (16.10.11)', () => {
  it('asks it before the gate, one at a time, given at ready to build, the yes refused until each is asked — a change made in a topic never asked here', () => {
    const call = answered(dir(), SPEC_AT, 'Is a refund ever partial?', { ...MADE, text: 'Never.' });
    const changed = write(dir(), 'replace', SPEC_AT, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['never partial'], text: 'When the person asks.', why: 'The person wants it so.' });
    const spec = readState(dir(), layout.unit(UNIT, 'spec.md'));
    fs.rmSync(statePath(dir(), layout.unit(UNIT, 'spec.md')));
    const cards = (/** @type {string} */ status) => {
      const manifest = readManifest(dir(), UNIT);
      manifest.phases.discussion.items.cards.status = status;
      createManifest(dir(), UNIT, manifest);
    };
    cards('in-progress');
    const elsewhere = answered(dir(), `${UNIT}.discussion.cards`, 'Is a card saved?', { ...MADE, text: 'Never.' });
    write(dir(), 'replace', `${UNIT}.discussion.cards`, ['--replaces', elsewhere, '--reason', 'changed-mind'], { by: 'person', drops: ['never saved'], text: 'When asked.', why: 'The person wants it so.' });
    cards('completed');
    written(dir(), spec.replace('\n## 2-S.', `\n2.1.3 A refund is partial when the person asks. [${changed}]\n\n## 2-S.`));
    cut(dir(), [CARDS, REFUNDS]);
    closeReady(dir());
    const first = screen();

    assert.match(sectionOf(first, 'DISPLAY: ready to build'), /YOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Is a refund ever partial\?\n {8}My answer: Never\.\n {8}Yours: When the person asks\.\n$/);
    assert.ok(!first.includes('MENU: ready to build'), 'the gate waits on the verdict');
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), 'ready-to-build yes: a verdict is still to ask — render ready-to-build asks each before the yes');
    const { argv } = pick('verdict', 'f');
    assert.deepStrictEqual([argv[2].startsWith(changed), argv.filter((_, at) => at !== 2)], [true, ['verdict', 'give', 'fix', '--at', 'ready-to-build']]);
    ok(dir(), ['verdict', 'give', changed, 'fix', '--at', 'ready-to-build'], { env: SESSION });
    assert.match(screen(), /=== MENU: ready to build /);
  });
});

describe('nothing raised before it (11.8.4, 11.S12)', () => {
  it('leaves no construction, finding, re-loop or sign-off gate to raise at the spec', () => {
    const at = { dotpath: `${UNIT}.specification.${UNIT}`, file: 'finding.json' };
    for (const surface of ['construction-gate', 'finding', 'finding-batch', 'spec-review-gate', 'spec-completion-gate']) {
      assert.throws(() => renderSurface(dir(), surface, at), new RegExp(`^Error: render: unknown surface "${surface}"`), surface);
    }
  });
});

describe('what never comes to ready to build (11.8.1)', () => {
  it('refuses a unit keeping the old spec\'s items, naming the migration\'s cut', () => {
    createManifest(dir(), UNIT, { ...readManifest(dir(), UNIT), phases: { ...readManifest(dir(), UNIT).phases, specification: { items: { cards: { status: 'completed' } } } } });
    commitAll(dir(), 'an old spec item');

    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ${UNIT} keeps its spec in the old form, which never comes to ready to build — the migration's cut for built units carries it across (29.17)`);
  });

  it('refuses a unit the spec\'s entry refuses: one the project lacks, and a quick-fix, whose pipeline holds no spec', () => {
    createManifest(dir(), 'tidy', { work_type: 'quick-fix' });
    commitAll(dir(), 'a quick-fix');

    assert.match(refused(['render', 'ready-to-build', 'nowhere']), /^render ready-to-build: there is no work unit "nowhere"/);
    assert.strictEqual(refused(['ready-to-build', 'yes', 'tidy', '--position', 'auto']), 'ready-to-build yes: a quick-fix has no specification — its phases are scoping, implementation, review');
  });
});
