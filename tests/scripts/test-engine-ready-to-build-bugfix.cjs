'use strict';

// ---------------------------------------------------------------------------
// A bugfix's one screen, its investigation's conclude and ready to build
// (ledger-engine/scripts/domain/ready-to-build.cjs, its close's half
// investigation-conclude.cjs, drawn by projections/ready-to-build.cjs): its
// investigation closed into its spec with no gate, `render ready-to-build`
// draws the recap — the hunt, the symptoms, the root cause and the fix
// direction — before the outline and the cut, and asks the investigation's
// verdicts at the conclusion before the spec's (19.4.23, 11.8.5, 16.10.5);
// its yes concludes the investigation with the build begun: the item
// completed and its close stamped, what the bug is in kept as staged, with
// whether that unit's review had ended — kept from an earlier conclude naming
// the same unit — and the close recorded as taken, the staged recap gone
// (17.1.9, 17.S4); what the bug is in no longer holding refuses it, naming
// the restage, writing nothing.
//
// Layer: verb. World: the ready to build world's bugfix
// (ready-to-build-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, sectionOf, statePath, layout, readState, writeState, readManifest, commitAll, lastMessage } = require('./engine-harness.cjs');
const { unwrap } = require('./render-surfaces-world.cjs');
const { BUGFIX, FIXES, SESSION, made, bugfix, stageRecap, worldConfig, useReadyWorld, readyHelpers } = require('./ready-to-build-world.cjs');

const dir = useReadyWorld(bugfix);
const { screen, pick, refused, yes } = readyHelpers(dir, BUGFIX);

/** The project's verify setup recorded. */
function verifySetUp() {
  const project = JSON.parse(readState(dir(), layout.projectManifest));
  const verify = {
    place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
    ran: { unit: FIXES, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-11-01T09:00:00.000Z' },
  };
  writeState(dir(), layout.projectManifest, JSON.stringify({ ...project, environment: { ...project.environment, verify } }, null, 2));
  commitAll(dir(), 'the verify setup');
}

/** `unit`'s review phase ended by Claude settling its failing round. @param {string} unit */
function reviewSettled(unit) {
  const round = (/** @type {string|null} */ settled) => JSON.stringify({ reports: [], passed: false, can_now: [], findings: [], settled, scenarios: [] });
  writeState(dir(), `${unit}/review/round-1.json`, round(null));
  writeState(dir(), `${unit}/review/round-2.json`, round('The finding was a nit at heart.'));
  commitAll(dir(), `${unit}'s review settled`);
}

/** The bugfix's manifest changed by `change`, and committed. @param {(manifest: Record<string, any>) => void} change @param {string} message */
function changed(change, message) {
  const manifest = readManifest(dir(), BUGFIX);
  change(manifest);
  writeState(dir(), layout.manifest(BUGFIX), JSON.stringify(manifest, null, 2) + '\n');
  commitAll(dir(), message);
}

describe('the one screen (19.4.23, 11.8.5)', () => {
  it('draws the recap — the hunt, the symptoms, the root cause and the fix direction — before the outline and the cut; its pick concludes the investigation, and a comment takes a change to the recap', () => {
    const out = screen();

    assert.strictEqual(sectionOf(out, 'DISPLAY: ready to build').split('\n\nTHE OUTLINE')[0], [
      'Restore — concluded, and ready to build',
      '',
      'THE HUNT',
      '  Two hypotheses; an empty capture saved over a full one each',
      '  time.',
      '',
      'SYMPTOMS (1)',
      '  • Restore brought nothing back',
      '',
      'ROOT CAUSE',
      '  Every save trusts an empty capture.',
      '',
      'FIX DIRECTION',
      '  Never save an empty capture over a full one.',
    ].join('\n'));
    const menu = unwrap(sectionOf(out, 'MENU: ready to build'));
    assert.match(menu, /^Your pick concludes the investigation, approves the outline and the phase cut, and starts the build in that position\.$/m);
    assert.match(menu, /^\*\*Comment\*\* → Ask for a change — to the recap, the outline or the phase cut$/m);
  });

  it('stands on the close: the investigation entered again voids it, and the screen is refused until it closes again; staged again once the spec is written, it carries on there', () => {
    changed((manifest) => { manifest.checklists.conclusion[BUGFIX].voided = new Date(Date.now() + 1000).toISOString(); }, 'the investigation went on');

    assert.strictEqual(refused(['render', 'ready-to-build', BUGFIX]), `render ready-to-build: ${BUGFIX}'s spec waits until its investigation closes, its root cause and fix validated and its recap staged — the investigation carries on, from the start menu`);
    assert.deepStrictEqual(stageRecap(dir()).next, { kind: 'continue' });
    assert.match(screen(), /— concluded, and ready to build/);
  });
});

describe('the one screen\'s verdicts (16.10.5, 16.10.11)', () => {
  it('asks the investigation\'s first, given at the conclusion, the yes refused until it is', () => {
    process.env.LEDGER_CONFIG_DIR = worldConfig(dir());
    const out = screen();

    assert.match(out, /^YOUR VERDICT \(1 of 1 call you changed\)$/m);
    assert.strictEqual(refused(['ready-to-build', 'yes', BUGFIX, '--position', 'auto']), 'ready-to-build yes: a verdict is still to ask — render ready-to-build asks each before the yes');
    const { argv } = pick('verdict', 'n');
    assert.deepStrictEqual([argv[2].startsWith(made.inHunt), argv.at(-1)], [true, 'conclusion']);
    ok(dir(), argv, { env: SESSION });
    assert.match(screen(), /^=== MENU: ready to build /m);
  });
});

describe('the one screen\'s yes (17.1.9, 17.S4)', () => {
  it('concludes the investigation with the build begun: the item completed and its close stamped, the close recorded as taken, the staged recap gone, in the yes\'s own commit', () => {
    const answer = yes(['--position', 'auto']);

    const manifest = readManifest(dir(), BUGFIX);
    assert.deepStrictEqual(manifest.phases.investigation.items[BUGFIX], { status: 'completed', concluded_at: answer.concluded });
    assert.deepStrictEqual([manifest.checklists.conclusion[BUGFIX].taken, manifest.build], [answer.concluded, { position: 'auto' }]);
    assert.strictEqual(lastMessage(dir()), `ready-to-build(${BUGFIX}): auto`);
    assert.strictEqual(fs.existsSync(statePath(dir(), layout.cache(BUGFIX, 'investigation', BUGFIX, 'conclude.json'))), false, 'the staged recap goes');
  });

  it('keeps what the bug is in, as staged, with whether that unit\'s review had ended — judged now, or kept from an earlier conclude naming the same unit — counted only where it had', () => {
    verifySetUp();
    reviewSettled(FIXES);
    stageRecap(dir(), { fixes: FIXES, area: ' Session restore ' });
    yes(['--position', 'auto']);

    const { fixes, area, after_review: after } = readManifest(dir(), BUGFIX).phases.investigation.items[BUGFIX];
    assert.deepStrictEqual([fixes, area, after], [FIXES, 'Session restore', true]);
    assert.deepStrictEqual(ok(dir(), ['measures', 'bugs']).bugs.map(({ fixed }) => fixed), [[{ unit: FIXES, bugfixes: [BUGFIX] }]]);
  });

  it('keeps the judgement of an earlier conclude naming the same unit, as a reopened investigation carries it', () => {
    reviewSettled(FIXES);
    changed((manifest) => Object.assign(manifest.phases.investigation.items[BUGFIX], { fixes: FIXES, after_review: false }), 'an earlier conclude');
    stageRecap(dir(), { fixes: FIXES });
    yes(['--position', 'auto']);

    assert.strictEqual(readManifest(dir(), BUGFIX).phases.investigation.items[BUGFIX].after_review, false);
  });

  it('refuses, writing nothing, what the bug is in no longer holding, naming the restage', () => {
    verifySetUp();
    stageRecap(dir(), { area: 'session restore' });
    const project = JSON.parse(readState(dir(), layout.projectManifest));
    delete project.environment.verify;
    writeState(dir(), layout.projectManifest, JSON.stringify(project, null, 2));
    commitAll(dir(), 'no verify setup');

    assert.strictEqual(refused(['ready-to-build', 'yes', BUGFIX, '--position', 'auto']),
      `ready-to-build yes: no verify setup is recorded, so no feature map names an area — leave the area out — engine investigation stage ${BUGFIX} --file <recap.json> stages it again`);
  });
});
