'use strict';

// ---------------------------------------------------------------------------
// Finish's yes (leeway-engine/scripts/domain/finish.cjs): `engine finish yes
// <unit>`, landing what stands, completing the unit and naming where the
// work goes (24.1.2), a refusal of the landing leaving the unit in progress;
// what the unit stands on read once, the landing past it reading it no
// more than `land finish` alone does; a knowledge base set up but not
// reading said on the screen, in the yes and in a refusal of the landing,
// its records left unchecked. Every refusal writes and commits nothing. The
// fix phases' order at finish (7.S10) is test-engine-landing-conformance.cjs's,
// and a quick-fix's close test-engine-quick-fix-close.cjs's.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const { output, sectionOf, unreadableKnowledge, readState, layout, commitAll, traced } = require('./engine-harness.cjs');
const {
  UNIT, useWorld, env, finishClosed, readManifest, writeState, stateGit, refusedPristine, ok, assert,
} = require('./review-world.cjs');
const { reviewPassed, finishReady, finishHelpers } = require('./finish-world.cjs');

/** What finish says of a knowledge base set up over a store that does not load. */
const UNREAD = 'the knowledge base is set up but does not read, so the records indexed are not checked — knowledge status says why';

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { screen, refused } = finishHelpers(() => dir);

describe('finish yes (14.5.1, 24.1.2)', () => {
  it('lands every phase still standing and completes the unit, committed, a feature handed to the start menu — refused while its review phase goes on, and while finish\'s checklist is open', () => {
    const reviewing = refused(['finish', 'yes', UNIT]);
    reviewPassed();
    const open = refused(['finish', 'yes', UNIT]);
    finishClosed();
    const done = ok(dir, ['finish', 'yes', UNIT], { env: env() });

    assert.deepStrictEqual([reviewing, open], [
      `finish yes: ${UNIT} finishes once its review phase is over — ${UNIT}'s review phase is in round 1 — enter review ${UNIT}`,
      `finish yes: finish is open — its items are worked, then it is closed: checklist close finish ${UNIT}`,
    ]);
    assert.deepStrictEqual(done, {
      ok: true, unit: UNIT, landed: [], completed_at: readManifest(dir, UNIT).completed_at, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway', args: [] },
    });
    assert.match(output(dir, ['handoff', done.next.skill, ...done.next.args], { env: env() }), /^skill: leeway\nargs: $/m);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, stateGit(dir, ['log', '-1', '--format=%s']).trim()], ['completed', `finish(${UNIT}): completed`]);
    assert.strictEqual(refused(['render', 'finish', UNIT]), `render finish: ${UNIT} is completed — new work starts from the start menu`);
  });

  it('reads what the unit stands on once, its landing past it reading the tracker no more often than land finish alone does', () => {
    finishReady();
    /** How often the call read the tracker's state. @param {string[]} args */
    const trackerReads = (args) => traced(() => ok(dir, args, { env: env() })).commands.filter((command) => /^status --porcelain .* -- manifest\.json /.test(command)).length;

    assert.deepStrictEqual([trackerReads(['land', 'finish', UNIT]), trackerReads(['finish', 'yes', UNIT])], [2, 2]);
  });

  it('hands an epic back to its menu, its review completed — the handoff taking it once the epic is completed', () => {
    finishReady();
    writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...readManifest(dir, UNIT), work_type: 'epic' }, null, 2));
    commitAll(dir, 'pay an epic');

    const { next } = ok(dir, ['finish', 'yes', UNIT], { env: env() });

    assert.deepStrictEqual(next, { kind: 'handoff', skill: 'leeway-continue-epic', args: [UNIT, 'review', 'completed'] });
    assert.match(output(dir, ['handoff', next.skill, ...next.args], { env: env() }), /^skill: leeway-continue-epic\nargs: pay review completed$/m);
  });

  it('says, on the screen and in the yes, that a knowledge base set up but not reading leaves the records indexed unchecked', () => {
    finishReady();
    unreadableKnowledge(dir);
    const shown = sectionOf(screen(), 'DISPLAY: finish');
    const { warnings } = ok(dir, ['finish', 'yes', UNIT], { env: env() });

    assert.ok(shown.replace(/\s+/g, ' ').includes(`⚑ ${UNREAD}`), shown);
    assert.deepStrictEqual(warnings, [UNREAD]);
  });

  it('leaves the unit in progress where the landing refuses, its refusal the way on with what standing warned, writing nothing', () => {
    finishReady();
    unreadableKnowledge(dir);
    const project = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, drivers: { ...project.drivers, landing: 'carrier-pigeon' } }, null, 2));
    commitAll(dir, 'a landing driver the workflows lack');
    const { error, warnings } = refusedPristine(dir, ['finish', 'yes', UNIT], { env: env() });

    assert.match(error, /^finish yes: .*carrier-pigeon/);
    assert.deepStrictEqual(warnings, [UNREAD]);
    assert.strictEqual(readManifest(dir, UNIT).status, 'in-progress');
  });

  it('refuses arguments of another shape with the usage', () => {
    for (const args of [['finish', 'yes'], ['finish', 'no', UNIT], ['finish', 'yes', UNIT, 'more'], ['finish', 'yes', UNIT, '--force', 'x']]) {
      assert.strictEqual(refused(args), 'Usage: engine finish yes <work-unit>', args.join(' '));
    }
  });
});
