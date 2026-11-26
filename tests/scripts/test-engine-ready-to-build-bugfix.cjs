'use strict';

// ---------------------------------------------------------------------------
// A bugfix's one screen, its investigation's conclude and ready to build
// (ledger-engine/scripts/domain/ready-to-build.cjs, its close's half
// investigation-conclude.cjs, drawn by projections/ready-to-build.cjs): its
// investigation closed into its spec with no gate, `render ready-to-build`
// draws the recap — the hunt, the symptoms, the root cause and the fix
// direction — before the outline and the cut, asking no verdict of a call the
// person changed in the hunt (19.4.23, 11.8.5, 16.10.5); it stands on the
// close and the recap its mark keeps, so a cancel and a reactivate keep it; a
// root cause or a fix the person changes there is the spec's replacement, the
// recap staged again over it with the investigation frozen, and the spec's
// writer briefed with it (11.8.5); its yes concludes the investigation with
// the build begun: the item completed and its close stamped, what the bug is
// in kept as staged, with whether that unit's review had ended — kept from an
// earlier conclude naming the same unit — and the close recorded as taken
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
const path = require('path');
const { ok, output, sectionOf, layout, readState, writeState, readManifest, commitAll, lastMessage } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { unwrap } = require('./render-surfaces-world.cjs');
const { BUGFIX, FIXES, RECAP, SESSION, made, bugfix, stageRecap, worldConfig, useReadyWorld, readyHelpers, write, answered, written, cut, closeReady, landReviewed } = require('./ready-to-build-world.cjs');

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

/** The person's change to `decision` at the spec, in `text`: the replacement's id. @param {string} decision @param {string} text */
const changedAtTheSpec = (decision, text) => write(dir(), 'replace', `${BUGFIX}.specification`, ['--replaces', decision, '--reason', 'changed-mind'], { drops: ['an empty capture'], text, why: 'The person said so.', by: 'person' });

/** The spec written again over the replacement `cited`, cut and its checklist closed again. @param {string} cited */
function specAgain(cited) {
  written(dir(), [
    '# Restore', '', '## 1. Saving', '', '### 1.1 The capture', '',
    `1.1.1 A capture is checked before it is saved. [${cited}]`, '',
    '## 1-S. Scenarios for §1', '', '1.S1 Given a full save, when an empty capture is taken, then the save is kept. (1.1.1)', '',
  ].join('\n'), BUGFIX);
  cut(dir(), [{ name: 'Saving', goal: 'A save is never emptied.', scenarios: ['1.S1'], sections: ['1'], relies_on: [] }], BUGFIX);
  closeReady(dir(), BUGFIX);
}

/** The screen's recap, the outline and what follows it left off. */
const recapShown = () => sectionOf(screen(), 'DISPLAY: ready to build').split('\n\nTHE OUTLINE')[0];

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
      'Restore — ready to build',
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
    assert.match(screen(), /^Restore — ready to build$/m);
  });

  it('stands on the recap its close keeps: cancelled at ready to build and reactivated, its spec landed and reviewed and its checklist closed again, as the purge of its cache asks, the screen draws it again, and the yes concludes the investigation', () => {
    const before = recapShown();
    ok(dir(), ['workunit', 'cancel', BUGFIX], { env: SESSION });
    ok(dir(), ['workunit', 'reactivate', BUGFIX], { env: SESSION });
    landReviewed(dir(), BUGFIX);
    closeReady(dir(), BUGFIX);

    const after = recapShown();
    const { concluded } = yes(['--position', 'auto']);

    assert.deepStrictEqual([after, readManifest(dir(), BUGFIX).phases.investigation.items[BUGFIX].concluded_at], [before, concluded]);
  });
});

describe('a root cause or a fix the person changes at ready to build (11.8.5, 19.4.23)', () => {
  for (const [what, decision, heading, text] of /** @type {const} */ ([
    ['the fix', 'fix', 'FIX DIRECTION', 'Check a capture before saving it.'],
    ['the root cause', 'cause', 'ROOT CAUSE', 'A save trusts a capture taken mid-shutdown.'],
  ])) {
    it(`${what} replaced at the spec refuses the screen until the recap is staged again, which takes the replacement with the investigation frozen — no validation asked again, nor any verdict — and the yes concludes the investigation`, () => {
      const replacement = changedAtTheSpec(made[decision], text);
      specAgain(replacement);
      const stale = refused(['render', 'ready-to-build', BUGFIX]);
      const restaged = stageRecap(dir());

      assert.strictEqual(stale, `render ready-to-build: the root cause or the fix has been replaced since the recap was staged — engine investigation stage ${BUGFIX} --file <recap.json> stages it again`);
      assert.deepStrictEqual(restaged.next, { kind: 'continue' });
      assert.match(recapShown(), new RegExp(`^${heading}\n  ${text}$`, 'm'));
      const answer = yes(['--position', 'auto']);
      assert.deepStrictEqual(readManifest(dir(), BUGFIX).phases.investigation.items[BUGFIX], { status: 'completed', concluded_at: answer.concluded });
    });
  }

  it('the fix merged into another unit\'s decision refuses the restage, naming the replacement at the spec that makes it the unit\'s again; made, the restage takes it', () => {
    createManifest(dir(), 'other', { phases: { discussion: { items: { other: { status: 'in-progress' } } } } });
    commitAll(dir(), 'another unit');
    const into = answered(dir(), 'other.discussion.other', 'How is a capture saved?', { by: 'claude', who_moved_whom: 'none', text: 'Only once it is checked.' });
    const asked = JSON.parse(output(dir(), ['ledger', 'record', BUGFIX, BUGFIX])).questions.find((/** @type {{text: string}} */ q) => q.text === 'How should restore stop losing sessions?').id;
    write(dir(), 'merge', `${BUGFIX}.specification`, ['--question', asked, '--into', into, '--duplicate', made.fix], { by: 'claude', who_moved_whom: 'none' });
    const recap = writeState(dir(), layout.cache('scratch', 'recap.json'), JSON.stringify(RECAP));
    const stale = refused(['investigation', 'stage', BUGFIX, '--file', recap]);
    specAgain(changedAtTheSpec(into, 'Check a capture before saving it.'));
    stageRecap(dir());

    assert.strictEqual(stale, `investigation stage: ${BUGFIX}'s fix, ${made.fix}, now stands as ${into}, another unit's entry — make it ${BUGFIX}'s at its spec: engine ledger replace ${BUGFIX}.specification --replaces ${into}`);
    assert.match(recapShown(), /^FIX DIRECTION\n {2}Check a capture before saving it\.$/m);
  });

  it('the root cause replaced at the spec reaches the spec\'s writer as the root cause, never as a rule the fix keeps', () => {
    const replacement = changedAtTheSpec(made.cause, 'A save trusts a capture taken mid-shutdown.');
    const { id } = ok(dir(), ['brief', 'spec-writer', BUGFIX], { env: SESSION });

    const brief = fs.readFileSync(path.join(/** @type {string} */ (process.env.LEDGER_CONFIG_DIR), 'conversations', SESSION.CLAUDE_CODE_SESSION_ID, 'briefs', `${id}.md`), 'utf8');
    assert.strictEqual(brief.split('# The investigation\n\n')[1].split('\n\n# ')[0], [
      `- The root cause, ${replacement}: A save trusts a capture taken mid-shutdown.`,
      `- The fix, ${made.fix}: Never save an empty capture over a full one.`,
      `- A rule it keeps, ${made.inHunt}: It names what it lost.`,
    ].join('\n'));
  });
});

describe('a call the person changed in the hunt (16.10.5, 16.10.11)', () => {
  it('asks no verdict at the conclusion: its verdict was owed as it was changed, and the screen draws its gate', () => {
    process.env.LEDGER_CONFIG_DIR = worldConfig(dir());
    const out = screen();

    assert.deepStrictEqual([out.includes('VERDICT'), /^=== MENU: ready to build /m.test(out)], [false, true]);
  });
});

describe('the one screen\'s yes (17.1.9, 17.S4)', () => {
  it('concludes the investigation with the build begun: the item completed and its close stamped, the close recorded as taken, in the yes\'s own commit', () => {
    const answer = yes(['--position', 'auto']);

    const manifest = readManifest(dir(), BUGFIX);
    assert.deepStrictEqual(manifest.phases.investigation.items[BUGFIX], { status: 'completed', concluded_at: answer.concluded });
    assert.deepStrictEqual([manifest.checklists.conclusion[BUGFIX].taken, manifest.build], [answer.concluded, { position: 'auto' }]);
    assert.strictEqual(lastMessage(dir()), `ready-to-build(${BUGFIX}): auto`);
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
