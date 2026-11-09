'use strict';

// ---------------------------------------------------------------------------
// A quick-fix in a submodule the project nests, its pull requests in the
// project and the submodule both merged by hand, the project's first
// (7.2.21, 7.2.24), shared by the conformance suites that run it
// (test-engine-landing-conformance-quick-fix-submodule-*.cjs): the
// project's default branch then points the submodule at the branch's own
// commit there, whose change the submodule's merge lands. On each shipped
// landing driver: the world with fix 1.1 built in the submodule and merged
// by hand by one of the side's ways (`mergedByHand`), and what the
// project's default branch points the submodule at (`pointer`); and the
// case of a later fix moving the submodule again (`movedAgain`). Names no
// driver and no tool.
// ---------------------------------------------------------------------------

const assert = require('node:assert');

const { git } = require('./engine-harness.cjs');
const { BRANCH, SET, DESCRIPTION, quickFixNestedConformance } = require('./quick-fix-world.cjs');
const { NESTED } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { folder: EXT, into: EXT_INTO } = NESTED.ext;

/** The commit the close lands to point the project at the submodule's landing, as a side reads it. */
const REPOINT = Object.freeze({ subject: 'chore(typo): point ext at its landing', task: null, paths: [EXT] });

/** @typedef {ReturnType<typeof quickFixNestedConformance>} NestedConformance */

/**
 * On each shipped landing driver, for each of the ways `pick` takes from
 * its side: the driver's conformance, the way, and the world readied —
 * fix 1.1 built in the submodule, its pull requests merged by hand that
 * way, the project's first — with the submodule's landing and how many
 * commits the project's default branch had landed.
 * @param {string} prefix the copies' temp-directory prefix @param {(ways: [string, (dir: string, branch: string, into?: string) => void][]) => [string, (dir: string, branch: string, into?: string) => void][]} pick
 */
function eachWay(prefix, pick) {
  return listDrivers('landing').flatMap(({ name }) => {
    const conf = quickFixNestedConformance(name, `${prefix}${name}-`);
    const { side, project, built } = conf;
    return pick(Object.entries(side.byHand)).map(([how, merge]) => ({
      name, how, conf,
      mergedByHand: () => {
        const at = project();
        built(at, 1, { 'ext/ext.txt': 'ext --colour\n' });
        merge(at.dir, BRANCH, 'main');
        merge(at.ext, BRANCH, EXT_INTO);
        return { at, landing: side.defaultTip(at.ext, EXT_INTO), before: side.landed(at.dir, 'main').length };
      },
      /** What the project's default branch points the submodule at. @param {{dir: string}} at */
      pointer: (at) => git(side.on(at.dir), ['rev-parse', `main:${EXT}`]).trim(),
    }));
  });
}

/**
 * A later fix moving the submodule again after the merges by hand, each
 * way `pick` takes on each shipped driver (`eachWay`): the close lands it
 * in the submodule, then in the project, its pointer at the submodule's
 * landing of the later fix's change, no re-point made. Run as a suite's
 * cases, `describe` and `it` its own.
 * @param {string} prefix @param {RegExp} pick the ways, by their names
 * @param {{describe: (name: string, fn: () => void) => void, it: (name: string, fn: () => void) => void}} test
 */
function movedAgain(prefix, pick, { describe, it }) {
  for (const { name, how, conf, mergedByHand, pointer } of eachWay(prefix, (ways) => ways.filter(([named]) => pick.test(named)))) {
    describe(`the ${name} landing driver's quick-fix in a submodule, its pull requests merged by hand by ${how}, the project's first, then a later fix moving the submodule again (7.2.21, 7.2.24)`, () => {
      it('the close lands the later fix, the project\'s pointer at the submodule\'s landing of its change, no re-point made', () => {
        const { at, before } = mergedByHand();
        conf.built(at, 2, { 'ext/ext-help.txt': 'help --colour\n', [SET[1].file]: SET[1].text });
        const answer = conf.closed(at);

        assert.deepStrictEqual(conf.side.landed(at.dir, 'main').slice(before), [{ subject: `fix(typo): ${DESCRIPTION}`, task: 'typo-1-2', paths: [EXT, SET[1].file].sort() }]);
        assert.deepStrictEqual(answer.landed.map((/** @type {{repointed?: unknown}} */ { repointed }) => repointed), answer.landed.map(() => undefined));
        assert.strictEqual(pointer(at), conf.side.defaultTip(at.ext, EXT_INTO));
      });
    });
  }
}

module.exports = { EXT, REPOINT, eachWay, movedAgain };
