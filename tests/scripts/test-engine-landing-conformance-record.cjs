'use strict';

// ---------------------------------------------------------------------------
// The landing record through the `land` verbs (landing-record.cjs, 7.2.22),
// against each shipped driver in turn: a phase landed records each task it
// lands, by the engine, at the commit on the default branch naming it, the
// tip its branch landed at, `first` its landing, dated as that commit was
// made, committed to the state branch, and landed again, merging nothing,
// records nothing; a task recorded stays landed, its branch moved onto its
// landing after, and is read by its record only on a revision whose
// first-parent line holds that landing. Each verb runs no more git commands than the
// driver's side names for it — opening each task, landing the phase,
// landing it again and finishing — the settle reusing the verb's own
// reads, git's own transport children left out, which a git release may
// add or drop. A recorded task's branch given a commit past its
// landing is changed after it, and land finish lands its change and reads
// it landed after, the record moved to that landing, `first` kept (R29,
// R30). A read for display records nothing. A verb that refuses, and a
// record that fails, are
// test-engine-landing-conformance-record-refusals.cjs's; a recorded task's
// branch moved with no change of its own,
// test-engine-land-local-record-moved.cjs's; one changed after its landing,
// landed again over its tip then,
// test-engine-landing-conformance-record-changed.cjs's; a task landed by
// hand, test-engine-landing-conformance-record-by-hand.cjs's; a chain
// whose later task rewrites the earlier's lines,
// test-engine-landing-conformance-record-chain.cjs's.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest, stateGit, statePath, traced } = harness;
const { UNIT, TASKS, TRACKER, openArgs, own, commitFiles, buildLanding, mergeBack, finishReady } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { card, total, rounding } = TASKS;

/** What git runs of its own to carry a fetch or a push, never the engine's command. */
const TRANSPORT = /^(upload-pack|receive-pack|pack-objects|unpack-objects|index-pack|rev-list --objects) /;

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, byHand: Record<string, (dir: string, branch: string) => void>, gitCalls: Record<'open'|'phase'|'again'|'finish', number>}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  const project = () => {
    dir = world();
    return dir;
  };
  /** The unit's landing records, each task's in the project's repository as `[by, the landing's subject — a host's pull request's number aside — its tip, first is its commit, it is dated at its commit's committer time]`. @param {string} at */
  const recorded = (at) => Object.fromEntries(Object.entries(readManifest(at, UNIT).landings ?? {}).map(([id, byRepo]) => {
    const { commit, tip: landedTip, first, by, at: when } = /** @type {any} */ (byRepo)['.'];
    const [subject, committed] = git(at, ['log', '-1', '--format=%s%n%cI', commit]).trim().split('\n');
    return [id, [by, subject.replace(/ \(#\d+\)$/, ''), landedTip, first === commit, when === new Date(committed).toISOString()]];
  }));
  /** The state branch's newest commit's subject. @param {string} at */
  const lastState = (at) => stateGit(at, ['log', '-1', '--format=%s']).trim();

  describe(`the ${name} landing driver's landing record (7.2.22)`, () => {
    it('records each task a phase lands, by the engine, at the commit naming it, dated as that commit was made, the tip its branch landed at, committed to the state branch, and landed again, merging nothing, records nothing; read by its record only on a revision whose first-parent line holds it, not landed on the commit before; its branch moved onto the landing after, a task stays landed; each verb within the git commands the driver names for it', () => {
      const at = project();
      /** @type {[string, 'open'|'phase'|'again'|'finish', number][]} */
      const ran = [];
      /** What `args` answers, the git commands it ran counted against `verb`'s ceiling. @param {string} call @param {'open'|'phase'|'again'|'finish'} verb @param {string[]} args */
      const counted = (call, verb, args) => {
        const { result, commands } = traced(() => ok(at, args));
        ran.push([call, verb, commands.filter((command) => !TRANSPORT.test(command)).length]);
        return result;
      };
      counted('open 1.2', 'open', openArgs(total));
      mergeBack(at, card.branch, total.branch);
      counted('open 1.1', 'open', openArgs(card));
      counted('open 2.1', 'open', openArgs(rounding));
      const tips = [card, total].map(({ branch }) => tip(at, branch));
      counted('phase', 'phase', ['land', 'phase', UNIT, '1']);
      const [repo] = projectRepos(at);
      const read = unitLanded(at, UNIT, [repo], null);
      const onLine = ['main~1', 'main'].map((rev) => read.on(repo, tip(at, rev)).task({ unit: UNIT, phase: 1, n: 1 }).landed);
      const state = stateGit(at, ['rev-parse', 'HEAD']).trim();
      const again = counted('phase again', 'again', ['land', 'phase', UNIT, '1']).already;
      const kept = [recorded(at), lastState(at), again, stateGit(at, ['rev-parse', 'HEAD']).trim()];
      finishReady(at);
      counted('finish', 'finish', ['land', 'finish', UNIT]);
      git(at, ['branch', '-f', card.branch, 'main']);
      const stays = unitLanded(at, UNIT, projectRepos(at), null).landed({ unit: UNIT, phase: 1, n: 1 });

      assert.deepStrictEqual([...kept, stays, onLine], [{
        [`${UNIT}-1-2`]: ['engine', 'feat(pay): Show total', tips[1], true, true],
        [`${UNIT}-1-1`]: ['engine', 'feat(pay): Add card', tips[0], true, true],
      }, `land(${UNIT}): record 1.2, 1.1 landed`, true, state, true, [false, true]]);
      assert.deepStrictEqual(ran.filter(([, verb, count]) => count > side.gitCalls[verb]), [], `the git commands each verb ran: ${JSON.stringify(ran)}`);
    });

    it('a recorded task\'s branch given a commit past its landing: changed after its landing, land finish lands its change and reads it landed after, the record moved to that landing by the engine at its branch\'s tip, its first landing kept (R29, R30)', () => {
      const at = project();
      ok(at, openArgs(card));
      ok(at, ['land', 'phase', UNIT, '1']);
      const subject = recorded(at)[`${UNIT}-1-1`][1];
      const first = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'].commit;
      commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      const landed = () => unitLanded(at, UNIT, projectRepos(at), null).landed({ unit: UNIT, phase: 1, n: 1 });
      const before = landed();
      finishReady(at);
      const finished = own(ok(at, ['land', 'finish', UNIT]));

      assert.deepStrictEqual([before, finished.phases.map((/** @type {{merged: string[]}} */ { merged }) => merged), git(at, ['show', 'main:card-more.txt']), recorded(at)[`${UNIT}-1-1`], readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'].first, landed()], [
        false, [['1.1']], 'more\n', ['engine', subject, tip(at, card.branch), false, true], first, true,
      ]);
    });

    it('a read for display writes nothing over a landing by hand no verb recorded: the phase close\'s checklist reads its phase landed — one task recorded by the verb after it, the other landed by hand since — leaving the record and the state branch as they were', () => {
      const at = project();
      ok(at, openArgs(card));
      Object.values(side.byHand)[0](at, card.branch);
      mergeBack(at, total.branch, 'main');
      ok(at, openArgs(total));
      Object.values(side.byHand)[0](at, total.branch);
      for (const n of [3, 9]) TRACKER.close(statePath(at), { unit: UNIT, phase: 1, n }, 'not needed');
      finishReady(at);
      const before = [Object.keys(recorded(at)), lastState(at)];
      const shown = ok(at, ['checklist', 'show', 'phase-close', UNIT, '1'], { env: { ...side.env, CLAUDE_CODE_SESSION_ID: 'record' } });

      assert.deepStrictEqual([shown.items.find((/** @type {{key: string}} */ { key }) => key === 'stack-merged').state, Object.keys(recorded(at)), lastState(at)], ['done', ...before]);
      assert.deepStrictEqual(before[0], [`${UNIT}-1-1`]);
    });
  });
}
