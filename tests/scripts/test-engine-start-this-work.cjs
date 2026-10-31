'use strict';

// ---------------------------------------------------------------------------
// Start this work (leeway-engine/scripts/domain/start-this-work.cjs): the
// authority gate at the work-type commit — `render start-this-work` staging
// Claude's payload and drawing the screen the spec draws, creating nothing
// (8.S16), with no name question (8.S21); `start-this-work yes` creating the
// unit from the staged copy as one transaction, its first log pointing into
// the product's sessions (8.S64), the product's session closed, and what
// comes next for each type (8.S47, 24.S1, 24.S2, 24.S15); and every refusal,
// at the screen and at a yes the project moved under, writing nothing —
// cross-cutting (8.S2), a taken or numbered name (8.S57), and a failure
// part-way leaving no unit. What a created unit holds, whatever door made
// it, is test-engine-workunit-create.cjs's.
//
// Layer: verb. World: discovery's gate suites' (discovery-gates-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, refusedPristine, readManifest, readState, statePath, lastMessage, touched, head, layout, writeState } = require('./engine-harness.cjs');
const { PRODUCT_LOG, IDEA, BUG, SESSION, useGatesWorld, gatesHelpers, failingWrites, manifestTemp, sectionOf } = require('./discovery-gates-world.cjs');

const dir = useGatesWorld();
const { scratch, payload, screen, answer, run } = gatesHelpers(dir);

const STAGED = layout.cache('product', 'discovery', 'product', 'start-this-work.json');

/** Fumi, as the spec draws its start: an epic from the product's notes. */
const FUMI = Object.freeze({
  type: 'epic',
  name: 'fumi',
  description: 'A smarter macOS Stickies alternative: notes assigned to specific macOS Spaces (returning to their Space on relaunch), remembering exact screen position, with titles and a full fumi CLI/MCP scripting surface.',
  reason: 'An epic: the note model, Spaces, the note window, the agent surface and selling it each need decisions of their own.',
  shaped_by: [`${PRODUCT_LOG}#notes`],
});

/** A one-topic unit's payload, its brief drafted. @param {string} type @param {string} name */
function oneTopic(type, name) {
  return { type, name, description: `The ${name} work.`, reason: `A ${type}: one piece of work.`, shaped_by: [`${PRODUCT_LOG}#pricing`], brief: scratch(`# ${name}\n\nWhat discovery heard.\n`) };
}

/** The yes the staged screen's gate leads to, run. @param {unknown} given */
function started(given) {
  screen(['start-this-work'], given);
  return run(answer('start this work', 'y'));
}

/** The stage refused, writing nothing: its error. @param {unknown} given */
function refusedStage(given) {
  return refusedPristine(dir(), ['render', 'start-this-work', '--file', payload(given)], { env: SESSION }).error;
}

describe('start this work, the screen (8.8.2, 8.S16, 8.S21)', () => {
  it('stages the payload and creates nothing; the screen shows the work, its type and the reason, then the one yes and Keep shaping — no name is asked', () => {
    const before = head(dir());
    const out = screen(['start-this-work'], FUMI);
    assert.strictEqual(sectionOf(out, 'DISPLAY: start this work'), [
      'Fumi (epic)',
      'A smarter macOS Stickies alternative: notes assigned to specific',
      'macOS Spaces (returning to their Space on relaunch), remembering',
      'exact screen position, with titles and a full fumi CLI/MCP',
      'scripting surface.',
      '↳ An epic: the note model, Spaces, the note window, the agent',
      '  surface and selling it each need decisions of their own.',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: start this work'), [
      '· · · · · · · · · · · ·',
      'Your yes creates the epic. We shape its topics next, and you approve the map.',
      '',
      '**`◆ Start this work?`**',
      '',
      '**`y/yes`**        → Start it — create the epic',
      '**Keep shaping** → Tell me what I\'m missing',
      '',
    ].join('\n'));
    assert.deepStrictEqual([head(dir()), fs.existsSync(statePath(dir(), 'fumi')), JSON.parse(readState(dir(), STAGED)).name], [before, false, 'fumi'],
      'nothing is created or committed before the yes; the payload waits in the product\'s cache');
    assert.deepStrictEqual(answer('start this work', 'y'), { kind: 'engine', argv: ['start-this-work', 'yes'] });
  });

  it('read again without --file, draws what is staged; with nothing staged, refuses', () => {
    assert.match(refusedPristine(dir(), ['render', 'start-this-work'], { env: SESSION }).error,
      /^render start-this-work: nothing is staged — render start-this-work --file <payload\.json> stages the work$/);
    screen(['start-this-work'], oneTopic('bugfix', 'login-loop'));
    assert.match(sectionOf(output(dir(), ['render', 'start-this-work'], { env: SESSION }), 'DISPLAY: start this work'), /^Login Loop \(bugfix\)$/m);
  });
});

describe('start this work, the yes (8.8.1, 8.14.3, 8.14.11)', () => {
  it('creates the epic in one commit — its seeds out of the inbox, its roadmap item joined, its first log pointing into the product\'s session, that session closed — and carries on into its discovery with no handoff (8.S16, 8.S64, 24.S15)', () => {
    const res = started({ ...FUMI, seeds: [statePath(dir(), IDEA)], roadmap: ['note-sync'] });
    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'fumi',
      work_type: 'epic',
      seeds: [{ path: statePath(dir(), 'fumi/seeds/2026-06-01-smart-retry.md'), source: 'inbox:idea' }],
      roadmap: ['note-sync'],
      session_log: statePath(dir(), layout.session('fumi', '001')),
      product_session_closed: '001',
      committed: head(dir()).slice(0, res.committed.length),
      next: { kind: 'engine', argv: ['enter', 'discovery', 'fumi', '--move'] },
    });
    assert.strictEqual(readState(dir(), layout.session('fumi', '001')),
      'Shaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n');
    assert.strictEqual(readManifest(dir(), 'fumi').phases.discovery.active_session, '001', 'the epic\'s first session is open for its shaping');
    const project = readManifest(dir(), '.');
    assert.deepStrictEqual([project.work_units.fumi, project.roadmap.items['note-sync'].pulled_to, project.product_session], [{ work_type: 'epic' }, { work_unit: 'fumi' }, undefined]);
    assert.strictEqual(lastMessage(dir()), 'discovery(fumi): start this work (epic)');
    assert.deepStrictEqual(touched(statePath(dir()), 'HEAD'), [
      `A\t${layout.session('fumi', '001')}`,
      `A\t${layout.manifest('fumi')}`,
      'A\tfumi/seeds/2026-06-01-smart-retry.md',
      `D\t${IDEA}`,
      'M\tmanifest.json',
    ]);
    assert.ok(!fs.existsSync(statePath(dir(), STAGED)), 'the staged payload goes');
  });

  it('lands a feature\'s one topic with its brief, the draft consumed, and hands off into its discussion — carried by the mod where it runs, inline where it does not (8.7.7, 8.S47, 24.S1, 24.S2)', () => {
    const given = oneTopic('feature', 'saved-filters');
    const res = started(given);
    assert.deepStrictEqual([res.brief, readState(dir(), layout.brief('saved-filters', 'saved-filters')), fs.existsSync(given.brief)],
      [statePath(dir(), layout.brief('saved-filters', 'saved-filters')), '# saved-filters\n\nWhat discovery heard.\n', false]);
    assert.deepStrictEqual(readManifest(dir(), 'saved-filters').phases, {}, 'a feature has no discovery session to carry on');
    assert.deepStrictEqual(res.next, { kind: 'handoff', skill: 'leeway-discussion-process', args: ['feature', 'saved-filters'] });
    const hand = (/** @type {Record<string, string>} */ env) => sectionOf(output(dir(), ['handoff', res.next.skill, ...res.next.args], { env }), 'DATA');
    assert.match(hand({ ...SESSION, LEEWAY_HANDOFF: '1' }), /^handoff: mod$/m);
    assert.match(hand(SESSION), /^handoff: inline$/m);
  });

  it('hands a bugfix into its investigation and a quick-fix, which takes no brief, into its scoping (24.1.2)', () => {
    assert.deepStrictEqual(started(oneTopic('bugfix', 'login-loop')).next, { kind: 'handoff', skill: 'leeway-investigation-process', args: ['bugfix', 'login-loop'] });
    const { brief, ...quick } = oneTopic('quick-fix', 'typo-fix');
    const res = started({ ...quick, seeds: [statePath(dir(), BUG)] });
    assert.deepStrictEqual([res.next, res.brief, fs.existsSync(statePath(dir(), layout.topic('typo-fix', 'typo-fix')))],
      [{ kind: 'handoff', skill: 'leeway-scoping-process', args: ['quick-fix', 'typo-fix'] }, undefined, false]);
  });

  it('points two units shaped in one session at their own sections of the same log (8.S64)', () => {
    started({ ...oneTopic('feature', 'prototype'), shaped_by: [`${PRODUCT_LOG}#notes`] });
    started({ ...oneTopic('feature', 'version-one'), shaped_by: [`${PRODUCT_LOG}#pricing`, `${PRODUCT_LOG}#notes`] });
    assert.deepStrictEqual([readState(dir(), layout.session('prototype', '001')), readState(dir(), layout.session('version-one', '001'))], [
      'Shaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n',
      'Shaped by: [.product/sessions/session-001.md#pricing](../../.product/sessions/session-001.md#pricing)\nShaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n',
    ]);
  });
});

describe('start this work, refused (8.2.4, 8.8.18)', () => {
  it('refuses cross-cutting: discovery calls only the four types (8.S2)', () => {
    assert.strictEqual(refusedStage({ ...FUMI, type: 'cross-cutting' }), 'render start-this-work: discovery never calls work cross-cutting — it is a feature, an epic, a bugfix or a quick-fix');
  });

  it('refuses a taken name, and a taken name numbered — a more specific one passes, never a number (8.S57)', () => {
    assert.strictEqual(refusedStage({ ...FUMI, name: 'atlas' }), 'render start-this-work: a work unit is named "atlas" already — derive a more specific name from the work, never a number');
    assert.strictEqual(refusedStage({ ...FUMI, name: 'atlas-2' }), 'render start-this-work: "atlas-2" numbers the taken name "atlas" — derive a more specific name from the work, never a number');
    assert.match(screen(['start-this-work'], { ...FUMI, name: 'atlas-offline' }), /^Atlas Offline \(epic\)$/m);
  });

  it('refuses shaped_by naming no place in the product\'s sessions, or none at all', () => {
    assert.match(refusedStage({ ...FUMI, shaped_by: [] }), /^render start-this-work: shaped_by names at least one place in \.product\/sessions\/ — /);
    assert.match(refusedStage({ ...FUMI, shaped_by: ['atlas/discovery/session-001.md'] }), /^render start-this-work: shaped_by: "atlas\/discovery\/session-001\.md" is no place in the product's sessions — /);
    assert.strictEqual(refusedStage({ ...FUMI, shaped_by: ['.product/sessions/session-009.md#x'] }), 'render start-this-work: shaped_by: .product/sessions/session-009.md#x names no log on disk');
  });

  it('refuses a one-topic unit without its brief, and a brief for an epic or a quick-fix', () => {
    const { brief, ...unbriefed } = oneTopic('feature', 'saved-filters');
    assert.strictEqual(refusedStage(unbriefed), 'render start-this-work: a feature\'s one topic lands with its brief — brief names its draft');
    assert.strictEqual(refusedStage({ ...FUMI, brief }), 'render start-this-work: an epic\'s topics get their briefs as the map is approved — drop the brief');
    assert.strictEqual(refusedStage({ ...unbriefed, type: 'quick-fix', brief }), 'render start-this-work: a quick-fix has no topic to brief — drop the brief');
  });

  it('refuses a roadmap item missing or joined to work already', () => {
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['no-such'] }), 'render start-this-work: roadmap: the roadmap has no item "no-such"');
    ok(dir(), ['roadmap', 'pull', 'note-sync', '--into', 'atlas']);
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['note-sync'] }), 'render start-this-work: roadmap: "note-sync" is joined to work unit "atlas" already');
  });

  it('checks the staged payload again at the yes: a name taken since refuses, writing nothing', () => {
    screen(['start-this-work'], FUMI);
    ok(dir(), ['workunit', 'create', 'fumi', 'feature', '--description', 'Taken meanwhile', '--session-log-file', writeState(dir(), layout.cache('fumi', 'log.md'), '# Fumi\n')]);
    assert.strictEqual(refusedPristine(dir(), ['start-this-work', 'yes'], { env: SESSION }).error,
      'start-this-work yes: a work unit is named "fumi" already — derive a more specific name from the work, never a number');
  });

  it('leaves no unit where the yes fails part-way: the seed back in the inbox, the brief\'s draft kept, nothing committed', () => {
    const given = { ...oneTopic('feature', 'saved-filters'), seeds: [statePath(dir(), IDEA)] };
    screen(['start-this-work'], given);
    const refused = failingWrites(manifestTemp(statePath(dir())), () => refusedPristine(dir(), ['start-this-work', 'yes'], { env: SESSION }));
    assert.strictEqual(refused.error, 'start-this-work yes: disk full');
    assert.ok(fs.existsSync(given.brief), 'the draft is kept, so the yes can run again');
  });
});
