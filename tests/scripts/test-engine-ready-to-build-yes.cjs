'use strict';

// ---------------------------------------------------------------------------
// Ready to build's yes and after (leeway-engine/scripts/domain/ready-to-build.cjs):
// `engine ready-to-build yes <unit> --position auto|step [--marks <file>]`,
// writing `build: {position}` and committing it, the review settled on fresh
// marks while the page is open and none written while it is not (11.S22,
// 11.S25, 11.S26), a failed commit retried in the unit's scope; no build
// before it — a phase may start only after it (11.S13) — no postpone after it
// (18.4.19), and its `next` a handoff into the build (24.S4); and `engine workunit
// position <unit> auto|step`, the switch logged as a `position-switch` event
// while the first pick is not (3.3.6, 3.3.7, E14). Every refusal writes and
// commits nothing.
//
// Layer: verb. World: the ready to build world closed
// (ready-to-build-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, refuses, statePath, layout, readState, readManifest, stateGit, head, lastMessage, touched, failingStateCommits, retried } = require('./engine-harness.cjs');
const { trustLogPath } = require('../../skills/leeway-engine/scripts/domain/trust-log.cjs');
const { UNIT, SESSION, READ_BACK, commented, closed, useReadyWorld, readyHelpers } = require('./ready-to-build-world.cjs');

const dir = useReadyWorld(closed);
const { refused, yes, events, publish, readBack } = readyHelpers(dir);

describe('the yes (11.8.1, 11.8.6, E11)', () => {
  it('begins the build in the position picked, its manifest holding it as `build`, committed alone, with no review written where no page is open, and hands off into the build (11.S22, 24.S4)', () => {
    const before = head(dir());
    const answer = yes(['--position', 'auto']);

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, position: 'auto', record: null, committed: stateGit(dir(), ['rev-parse', '--short', 'HEAD']).trim(), next: { kind: 'handoff', skill: 'leeway-implementation-process', args: ['epic', UNIT] } });
    assert.deepStrictEqual(readManifest(dir(), UNIT).build, { position: 'auto' });
    assert.deepStrictEqual([lastMessage(dir()), touched(statePath(dir()), 'HEAD'), stateGit(dir(), ['rev-parse', 'HEAD~1']).trim()], [`ready-to-build(${UNIT}): auto`, [`M\t${layout.manifest(UNIT)}`], before]);
    assert.ok(!fs.existsSync(statePath(dir(), layout.unit(UNIT, 'spec-review.json'))));
    assert.deepStrictEqual(events('position-switch'), [], 'the first pick is the gate\'s record, never a switch (E14)');
  });

  it('concludes the spec: ready to build passes once, the spec is never landed again, and a phase may start (11.8.1, 11.S13)', () => {
    yes(['--position', 'step']);

    assert.strictEqual(refused(['render', 'ready-to-build', UNIT]), `render ready-to-build: ready to build has passed for ${UNIT} — its build began in step, and its position switches through workunit position ${UNIT} auto|step`);
    assert.match(refused(['spec', 'land', UNIT]), /^spec land: payments's spec is concluded/);
    assert.strictEqual(ok(dir(), ['checklist', 'show', 'phase-start', UNIT, '1']).checklist, 'phase-1-start');
  });

  it('closes the map for good: no decided topic is postponed once the build has begun (18.4.19)', () => {
    yes(['--position', 'auto']);

    assert.strictEqual(refused(['topic', 'postpone', UNIT, 'refunds', '--horizon', 'next']), `postponing "refunds" is refused — ${UNIT}'s build has begun, so its map is closed: a decision that must change is settled in the build, and abandoning the work is the unit's cancel, through manage on the start menu`);
  });

  it('names the unit\'s own commit where its commit fails, which takes what the yes wrote, the review\'s record among it, and leaves nothing uncommitted', () => {
    publish();
    const answer = failingStateCommits(dir(), () => yes(['--position', 'auto', '--marks', readBack({ s1: { m: { '1-1-1': { s: 'tick' } } } })]));

    assert.deepStrictEqual([answer.committed, answer.note], [null, `commit pending — state saved; retry with: engine commit ${UNIT} --state -m "<message>"`]);
    assert.deepStrictEqual(retried(dir(), answer), { took: [`M\t${layout.manifest(UNIT)}`, `A\t${layout.unit(UNIT, 'spec-review.json')}`].sort(), left: '' });
  });

  it('takes no marks while no page is open, and refuses a position that is none of the build\'s and arguments of another shape, writing nothing', () => {
    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', statePath(dir(), READ_BACK)]), `ready-to-build yes: ${UNIT}'s review page is not open, so the yes takes no marks — the build starts with no review recorded`);
    for (const args of [['--position', 'bounded'], [], ['--position', 'auto', '--force', 'yes']]) {
      assert.match(refused(['ready-to-build', 'yes', UNIT, ...args]), /^Usage: engine ready-to-build yes <work-unit> --position auto\|step \[--marks <file>\]/, args.join(' '));
    }
  });
});

describe('the yes over an open review page (11.11.5, 11.11.8, 11.11.9)', () => {
  it('refuses without the page\'s marks, writing nothing', () => {
    publish();

    assert.strictEqual(refused(['ready-to-build', 'yes', UNIT, '--position', 'auto']), `ready-to-build yes: ${UNIT}'s review page is open, so the yes takes its marks — read them back from the page and give them as a file`);
  });

  it('refuses while a comment waits for Claude, listing each, the marks it was handed stored and nothing committed (11.S25)', () => {
    publish();
    const before = head(dir());
    const marks = { s1: { m: commented('1-1-2', 'Why refuse it?') } };

    assert.strictEqual(refuses(dir(), ['ready-to-build', 'yes', UNIT, '--position', 'auto', '--marks', readBack(marks)], { env: SESSION }).error,
      'ready-to-build yes: a comment on the review page waits for Claude, so the build does not start — Claude answers each beneath its line, then shows ready to build again:\n  1.1.2: "Why refuse it?"');
    assert.deepStrictEqual([head(dir()), readManifest(dir(), UNIT).build, JSON.parse(readState(dir(), layout.cache(UNIT, 'specification', 'marks.json')))], [before, undefined, marks]);
  });

  it('settles the review on the fresh marks, committing its record with the build, and counts no trust from it (11.S26, 11.11.10)', () => {
    publish();
    const before = head(dir());
    const trust = () => (fs.existsSync(trustLogPath()) ? fs.readFileSync(trustLogPath(), 'utf8') : '');
    const trusted = trust();
    const answered = { s: 'comment', t: { p1000: { by: 'p', x: 'Why refuse it?' }, c2000: { by: 'c', x: 'An unknown brand cannot be charged.' } } };
    const answer = yes(['--position', 'step', '--marks', readBack({ s1: { m: { '1-1-1': { s: 'tick' }, '1-1-2': answered } } })]);
    const { lines } = JSON.parse(readState(dir(), answer.record));

    assert.strictEqual(answer.record, layout.unit(UNIT, 'spec-review.json'));
    assert.deepStrictEqual(Object.fromEntries(Object.entries(lines).map(([number, { state }]) => [number, state])), {
      '1.1.1': 'approved', '1.1.2': 'open', '1.S1': 'claudes-tick', '1.S2': 'passed', '2.1.1': 'claudes-tick', '2.1.2': 'passed', '2.S1': 'passed',
    });
    assert.deepStrictEqual(lines['1.1.2'].conversation.map((/** @type {{by: string, text: string}} */ { by, text }) => ({ by, text })), [{ by: 'person', text: 'Why refuse it?' }, { by: 'claude', text: 'An unknown brand cannot be charged.' }]);
    assert.strictEqual(trust(), trusted, 'the yes logs nothing the trust counts read');
    assert.deepStrictEqual([touched(statePath(dir()), 'HEAD'), stateGit(dir(), ['rev-parse', 'HEAD~1']).trim()], [[`M\t${layout.manifest(UNIT)}`, `A\t${layout.unit(UNIT, 'spec-review.json')}`].sort(), before]);
  });
});

describe('the build\'s position switched (3.3.6, 3.3.7)', () => {
  it('writes the new position and logs the switch in the trust log, committed alone (3.S14, E14)', () => {
    yes(['--position', 'auto']);
    const before = head(dir());
    const answer = ok(dir(), ['workunit', 'position', UNIT, 'step'], { env: SESSION });

    assert.deepStrictEqual(answer, { ok: true, unit: UNIT, position: 'step', committed: stateGit(dir(), ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([readManifest(dir(), UNIT).build, lastMessage(dir()), touched(statePath(dir()), 'HEAD'), stateGit(dir(), ['rev-parse', 'HEAD~1']).trim()], [{ position: 'step' }, `build(${UNIT}): position step`, [`M\t${layout.manifest(UNIT)}`], before]);
    assert.deepStrictEqual(events('position-switch').map(({ unit, to }) => ({ unit, to })), [{ unit: UNIT, to: 'step' }]);
  });

  it('refuses before the build begins, a switch to the position it is in, a unit the project lacks, and a position that is none of the build\'s, writing nothing', () => {
    assert.strictEqual(refused(['workunit', 'position', UNIT, 'step']), `workunit position: ${UNIT}'s build has not begun — its position is chosen at ready to build`);
    yes(['--position', 'auto']);
    assert.deepStrictEqual([
      refused(['workunit', 'position', UNIT, 'auto']),
      refused(['workunit', 'position', 'nowhere', 'step']),
    ], [
      `workunit position: ${UNIT}'s build is in auto already`,
      'workunit position: there is no work unit "nowhere" — the start menu lists the work in progress',
    ]);
    assert.match(refused(['workunit', 'position', UNIT, 'bounded']), /^Usage: engine workunit position <work-unit> auto\|step — the position is auto or step$/);
    assert.deepStrictEqual(events('position-switch'), []);
  });
});
