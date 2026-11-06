'use strict';

// ---------------------------------------------------------------------------
// A feature's one screen, decided and ready to build
// (leeway-engine/scripts/domain/ready-to-build.cjs, its close's half
// decided.cjs, drawn by projections/ready-to-build.cjs over closing.cjs):
// its topic closed into its spec with no gate, `render ready-to-build`
// draws the topic's close — what the person decided, the product-record
// lines, the candidates parking on the roadmap and their strike — beside the
// outline and the cut, Claude's calls on the topic counted with those at the
// spec, decided's skips first, and decided's verdicts asked at decided
// before the spec's, counted across the whole close (3.S5, 9.S23, 11.S14,
// 9.7.3, 9.7.6, 11.8.2); a staged line whose decision changed at the spec
// refused until staged afresh; a strike draws it again, `--page` carried;
// and its yes takes the close as the decided gate's yes does — the line
// landed through the ledger, then in the yes's own commit the candidates
// parked, the struck recorded, the topic decided and its close taken, with
// the build begun — every line and candidate checked before anything is
// written, the review page's marks among it, and landed only once the
// review has settled (8.S31, 8.10.2, 8.10.11).
//
// Layer: verb. World: the ready to build world's feature, and the same with
// the person's changes of Claude's calls (ready-to-build-world.cjs), copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, output, refuses, refusedPristine, sectionOf, statePath, layout, readState, writeState, readManifest, stateGit, lastMessage } = require('./engine-harness.cjs');
const { DECIDED_ITEMS } = require('./pipeline-world.cjs');
const { FEATURE, FEATURE_PHASE, SESSION, write, written, cut, closeReady, made, feature, featureDeparted, worldConfig, useReadyWorld, readyHelpers, commented } = require('./ready-to-build-world.cjs');

/** Each block of the screen's display, by its first line. @param {string} out */
const blocks = (out) => sectionOf(out, 'DISPLAY: ready to build').split('\n\n').map((block) => block.split('\n')[0]);

describe('the one screen (3.S5, 9.S23, 11.S14)', () => {
  const dir = useReadyWorld(feature);
  const { screen, rowKeys, pick, refused } = readyHelpers(dir, FEATURE);

  it('draws the topic\'s close beside the outline and the cut, Claude\'s calls on the topic counted with the spec\'s; its pick marks the topic decided with what it covers, a candidate struck on x, and a comment takes a change to any of it', () => {
    const out = screen();

    assert.deepStrictEqual(blocks(out), ['Tally — decided, and ready to build', 'WHAT YOU DECIDED (1)', 'CLAUDE\'S CALLS (2)', 'FOR THE PRODUCT RECORD (1 line)', 'TO THE ROADMAP (2)', 'THE OUTLINE (1 section)', 'THE PHASE CUT (1 phase · 1 scenario)']);
    const display = sectionOf(out, 'DISPLAY: ready to build');
    assert.match(display, /\nWHAT YOU DECIDED \(1\)\n {2}└─ When does a tally reset\?\n\nCLAUDE'S CALLS \(2\)\n {2}1 look · 1 behaviour\n/);
    assert.match(display, /\n {2}· A tally resets at midnight, wherever it is shown\.\n/);
    assert.match(display, /\n {2}├─ ○ Streak Freeze +\[later\]\n/);
    const gate = sectionOf(out, 'MENU: ready to build');
    assert.match(gate, /^Your pick marks Tally decided, with the product-record line and the two roadmap items, approves the outline and the phase cut, and starts the build in that position\.$/m);
    assert.deepStrictEqual(rowKeys(out), ['a/auto', 's/step', 'c/calls', 'x/strike', 'Comment']);
    assert.match(gate.replace(/\n\s+/g, ' '), /^\*\*Comment\*\* +→ Ask for a change — to what you decided, a product-record line, the outline or the phase cut$/m);
  });

  it('stands on decided\'s close: closed again, the payload staged for the earlier close refuses it until staged again, which carries on in the spec; then decided\'s skips show before ready to build\'s', () => {
    for (const item of DECIDED_ITEMS.filter((key) => key !== 'findings-rerun')) ok(dir(), ['checklist', 'done', 'decided', FEATURE, FEATURE, item], { env: SESSION });
    ok(dir(), ['checklist', 'skip', 'decided', FEATURE, FEATURE, 'findings-rerun', '--reason', 'No finding was measured.'], { env: SESSION });
    ok(dir(), ['checklist', 'close', 'decided', FEATURE, FEATURE], { env: SESSION });
    assert.strictEqual(refused(['render', 'ready-to-build', FEATURE]), 'render ready-to-build: what is staged for tally was drawn for an earlier close — decided stage tally tally --file <payload.json> stages it again');
    const staged = ok(dir(), ['decided', 'stage', FEATURE, FEATURE, '--file', statePath(dir(), layout.cache('scratch', 'decided-payload.json'))], { env: SESSION });
    assert.deepStrictEqual(staged.next, { kind: 'continue' }, 'the spec is written, so the stage carries on where it is');
    ok(dir(), ['checklist', 'done', 'ready-to-build', FEATURE, 'replacements-checked']);
    ok(dir(), ['checklist', 'skip', 'ready-to-build', FEATURE, 'invariants-checked', '--reason', 'The spec states no invariant.']);
    ok(dir(), ['checklist', 'close', 'ready-to-build', FEATURE]);

    const display = sectionOf(screen(), 'DISPLAY: ready to build').replace(/\n {4}/g, ' ');
    assert.deepStrictEqual([...display.matchAll(/⚑ Skipped: (.*?) —/g)].map((m) => m[1]),
      ['each measured finding the topic\'s decisions rest on re-run', 'every invariant names a check or says none can']);
  });

  it('refuses to draw a staged line whose decision was changed at the spec since, naming the restage, and draws again once the line is staged afresh (9.7.6)', () => {
    const now = write(dir(), 'replace', `${FEATURE}.specification`, ['--replaces', made.resets, '--reason', 'changed-mind'], { by: 'person', who_moved_whom: 'none', drops: ['At midnight.'], text: 'At four in the morning.', why: 'A comment at ready to build.' });
    written(dir(), ['# Tally', '', '## 1. Counting', '', '### 1.1 The reset', '', `1.1.1 A tally resets at four in the morning. [${now}]`, '', `1.1.2 A reset is not logged. [${made.logged}]`, '',
      '## 1-S. Scenarios for §1', '', '1.S1 Given a tally at four, when the day turns, then it resets. (1.1.1, 1.1.2)', ''].join('\n'), FEATURE);
    cut(dir(), [FEATURE_PHASE], FEATURE);
    closeReady(dir(), FEATURE);
    assert.strictEqual(refused(['render', 'ready-to-build', FEATURE]),
      `render ready-to-build: line 1 cannot land — decided stage --relies-on names ${made.resets}, which ${now} replaced — the current one is ${now}; decided stage tally tally --file <payload.json> stages it again`);
    const payload = { lines: [{ text: 'A tally resets at four in the morning, wherever it is shown.', why: 'The reset holds for the whole product.', widens: now }], candidates: [] };
    ok(dir(), ['decided', 'stage', FEATURE, FEATURE, '--file', writeState(dir(), layout.cache('scratch', 'restaged.json'), JSON.stringify(payload))], { env: SESSION });
    assert.match(screen(), /MENU: ready to build/);
  });

  it('strikes a candidate on x, through the pick where two stand, drawing the screen again with the review page\'s flag carried', () => {
    screen();
    assert.deepStrictEqual(pick('ready to build', 'x'), { kind: 'engine', argv: ['render', 'decided-strike', `${FEATURE}.${FEATURE}`] });
    const out = output(dir(), ['render', 'decided-strike', `${FEATURE}.${FEATURE}`, '--page'], { env: SESSION });
    assert.match(out, /^\*\*`2`\*\* +→ Tally Widget$/m);
    assert.match(out, /^\*\*`b\/back`\*\* +→ Back to ready to build — nothing struck$/m);
    const struck = ok(dir(), ['decided', 'strike', FEATURE, FEATURE, '2', '--page'], { env: SESSION });
    assert.deepStrictEqual(struck.next, { kind: 'engine', argv: ['render', 'ready-to-build', FEATURE, '--page'] });

    const again = screen();
    assert.match(again, /└─ ⊘ Tally Widget +\[struck\]/);
    assert.match(sectionOf(again, 'MENU: ready to build'), /^Your pick marks Tally decided, with the product-record line and the roadmap item, approves/m);
    assert.deepStrictEqual(pick('ready to build', 'x'), { kind: 'engine', argv: ['decided', 'strike', FEATURE, FEATURE, '1'] });
  });
});

describe('the one screen\'s verdicts (16.10.2, 16.10.11)', () => {
  const dir = useReadyWorld(featureDeparted);
  const { screen, pick, refused } = readyHelpers(dir, FEATURE);
  beforeEach(() => {
    process.env.LEEWAY_CONFIG_DIR = worldConfig(dir());
  });

  it('asks decided\'s first, given at decided, then the spec\'s, given at ready to build, counted across the whole close, the yes refused until each is asked (9.7.3)', () => {
    const asked = [];
    const counts = [];
    for (let out = screen(); !out.includes('MENU: ready to build'); out = screen()) {
      counts.push(/YOUR VERDICT \((.*?) you changed\)/.exec(out)?.[1]);
      assert.strictEqual(refused(['ready-to-build', 'yes', FEATURE, '--position', 'auto']), 'ready-to-build yes: a verdict is still to ask — render ready-to-build asks each before the yes');
      const { argv } = pick('verdict', 'n');
      asked.push([argv[2], argv.at(-1)]);
      ok(dir(), argv, { env: SESSION });
    }
    assert.deepStrictEqual(asked.map(([entry, at]) => [[made.onTopic, made.atSpec].findIndex((id) => entry.startsWith(id)), at]), [[0, 'decided'], [1, 'ready-to-build']]);
    assert.deepStrictEqual(counts, ['1 of 2 calls', '2 of 2 calls']);
  });
});

describe('the one screen\'s yes (9.7.6, 8.S31)', () => {
  const dir = useReadyWorld(feature);
  const { screen, pick, publish, readBack } = readyHelpers(dir, FEATURE);

  /** The ledger's entries, by their event. */
  const ledgerEvents = () => readState(dir(), layout.ledger).trim().split('\n').map((line) => JSON.parse(line).event);

  it('lands the product-record line, parks each candidate standing on its horizon, records a struck one as the person\'s answer, marks the topic decided and its close taken, and begins the build: the line through the ledger, the rest in the yes\'s own commit', () => {
    ok(dir(), ['decided', 'strike', FEATURE, FEATURE, '2'], { env: SESSION });
    const before = ledgerEvents().length;
    screen();
    const answer = ok(dir(), pick('ready to build', 'a').argv, { env: SESSION });

    assert.deepStrictEqual([answer.position, answer.lines.length, answer.withdrawn, answer.candidates, answer.struck, answer.parked], ['auto', 1, [], ['streak-freeze'], ['tally-widget'], [{ name: 'streak-freeze', horizon: 'later' }]]);
    assert.deepStrictEqual(ledgerEvents().slice(before), ['asked', 'decided'], 'the line lands as its question and the person\'s product-wide decision');
    const manifest = readManifest(dir(), FEATURE);
    assert.deepStrictEqual([manifest.phases.discussion.items[FEATURE].status, manifest.build, manifest.phases.discovery, typeof manifest.checklists.decided[FEATURE].taken],
      ['completed', { position: 'auto' }, { dismissed: ['tally-widget'] }, 'string']);
    const { roadmap } = JSON.parse(readState(dir(), layout.projectManifest));
    assert.deepStrictEqual([roadmap.items['streak-freeze'], roadmap.items['tally-widget']],
      [{ horizon: 'later', summary: 'Nothing decides what a missed day costs.', kind: 'idea', origin: `topic:${FEATURE}/${FEATURE}`, sources: [layout.doc(FEATURE, 'discussion', FEATURE)] }, undefined]);
    const committed = stateGit(dir(), ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual([lastMessage(dir()), committed], [`ready-to-build(${FEATURE}): auto`, [layout.projectManifest, layout.manifest(FEATURE)].sort()]);
    assert.ok(!fs.existsSync(statePath(dir(), '.cache', FEATURE, 'discussion', FEATURE, 'decided.json')), 'the staged payload goes');
    ok(dir(), ['roadmap', 'add', 'tally-widget', '--horizon', 'next', '--summary', 'A widget.'], { env: SESSION });
  });

  it('checks every candidate before it writes anything: a twin on the roadmap since refuses it, writing nothing — with the review page open, not even its marks', () => {
    ok(dir(), ['roadmap', 'add', 'streak-freeze', '--horizon', 'later', '--summary', 'Freeze a streak.'], { env: SESSION });
    const twin = 'ready-to-build yes: the candidates: "streak-freeze" is already on the roadmap — edit it, or pick a different name';
    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', FEATURE, '--position', 'auto'], { env: SESSION }).error, twin);
    publish();
    const marks = readBack({ s1: { m: { '1-1-1': { s: 'tick' } } } });
    assert.strictEqual(refusedPristine(dir(), ['ready-to-build', 'yes', FEATURE, '--position', 'auto', '--marks', marks], { env: SESSION }).error, twin);
  });

  it('lands nothing while a comment on the review page waits for Claude', () => {
    publish();
    const before = ledgerEvents().length;
    const marks = readBack({ s1: { m: commented('1-1-1', 'Midnight where?') } });
    assert.match(refuses(dir(), ['ready-to-build', 'yes', FEATURE, '--position', 'auto', '--marks', marks], { env: SESSION }).error, /^ready-to-build yes: a comment on the review page waits for Claude/);
    assert.deepStrictEqual([ledgerEvents().length, readManifest(dir(), FEATURE).phases.discussion.items[FEATURE].status], [before, 'in-progress']);
  });
});
