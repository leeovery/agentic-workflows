'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite's quick-fix, a later fix laid on a fix
// merged by hand (R11, R12): the contract every landing driver meets, run
// through the engine's verbs against the driver its entry names — each
// driver's own (tests/drivers/{name}/test-landing-quick-fix-laid-on*.cjs),
// so each stays within a suite's time, its tests registered under that
// entry's `node:test` — and each way its side says a person merges a fix
// outside the engine. A fix opens alone where its phase was
// merged by hand, no stack for it — after each way its entry names — laid
// on the branch it lands on as the host has it: laid on a fix landed,
// whether in flight when it landed or begun after, its opening is refused,
// naming the merge back of that branch through the door under the fix;
// merged back so — any conflict with the fix below's lines settled — it
// opens there. Else it opens onto its phase's stack. Either way it is done,
// and the close lands its own change alone. A fix merged by hand before its
// done is test-engine-landing-conformance-quick-fix-by-hand.cjs's. A
// driver's side (tests/drivers/{name}/landing.cjs) readies the world, merges
// by hand and reads what landed where; this file names no driver and no
// tool. Conformance layer: the quick-fix of quick-fix-world.cjs
// (`quickFixConformance`), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const assert = require('node:assert');

const { ok, refuses, git, readManifest } = require('./engine-harness.cjs');
const { UNIT, CHAIN, fixChanged, mergedBack, checklistClosed, quickFixConformance } = require('./quick-fix-world.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

const BELOW = Object.freeze({ unit: UNIT, phase: 1, n: 1 });
/** Fix 1.2's own text where it changes the line the fix below changed. */
const SAME = Object.freeze({ title: 'Spell the flag in full', file: CHAIN[0].file, text: 'const flag = \'colour\'; // the British spelling\n' });

/** Fix `n`'s branch, titled `title`. @param {number} n @param {string} title */
const branchOf = (n, title) => taskBranch({ unit: UNIT, phase: 1, n }, 'fix', title);

/**
 * The refusal a day expects of fix 1.2's opening: where it opens alone, its
 * branch laid on what is not the branch it lands on as the host has it,
 * `back`, at the tip it names, the merge back named, through the door under
 * the fix; else none.
 * @param {boolean} alone @param {string} branch @param {string} back
 */
const expected = (alone, branch, back) => (alone
  ? `land: task 1.2's branch ${branch} does not descend from the chain's tip, ${back} ({tip}) — `
    + `merge ${back} back into ${branch} through the door, under the fix — with it out, \`git merge --no-ff --no-commit ${back}\`, settling any conflict, `
    + `then \`engine commit --paths <file>… --task ${UNIT} 1.2 -m "<message>"\`, and open it again`
  : null);

/**
 * The quick-fix's day: fix 1.1 opened and done, fix 1.2 laid on it, 1.1
 * merged by hand `when` 1.2 is in flight or before it begins; 1.2 opened —
 * where it opens `alone`, refused first, then merged back through the door
 * — done and recorded; and the close made. The project, and the refusal,
 * the tip it names put as `{tip}`; null where it opened onto its stack.
 * @param {ReturnType<typeof quickFixConformance>} conformance @param {(dir: string, ref: any, branch: string) => void} merge @param {boolean} alone
 * @param {'in flight'|'begun after'} when @param {{title: string, file: string, text: string}} fix 1.2's
 */
function laidOnDay({ side, as, project, record }, merge, alone, when, fix) {
  const at = project();
  fixChanged(at, 1, CHAIN[0].title, CHAIN[0].file, CHAIN[0].text, as());
  ok(at, ['land', 'open', UNIT, '1.1'], as());
  ok(at, ['task', 'done', UNIT, '1.1'], as());
  if (when === 'begun after') merge(at, BELOW, branchOf(1, CHAIN[0].title));
  fixChanged(at, 2, fix.title, fix.file, fix.text, as());
  if (when === 'in flight') merge(at, BELOW, branchOf(1, CHAIN[0].title));
  const refusal = alone ? refuses(at, ['land', 'open', UNIT, '1.2'], as()).error : null;
  const tip = git(at, ['rev-parse', side.back]).trim().slice(0, 7);
  if (alone) mergedBack(at, side.back, 2, as(), { [fix.file]: fix.text });
  ok(at, ['land', 'open', UNIT, '1.2'], as());
  ok(at, ['task', 'done', UNIT, '1.2'], as());
  record(at, 1);
  record(at, 2);
  checklistClosed(at, as());
  ok(at, ['finish', 'yes', UNIT], as());
  return { at, refusal: refusal?.replace(`(${tip})`, '({tip})') ?? null };
}

/** How a day opens fix 1.2, as a test names it. @param {boolean} alone */
const opening = (alone) => (alone ? 'alone, its opening refused first, naming the merge back of the branch it lands on through the door, then merged back' : 'onto its phase\'s stack');

/**
 * A later fix in flight when the fix below is merged by hand, for the
 * driver `name`, each way its side merges — opening alone after each way
 * `alone` names — its tests registered under its entry's `node:test`.
 * @param {typeof import('node:test')} test @param {string} name @param {string[]} alone
 */
function laidOnInFlight({ describe, it }, name, alone) {
  const conformance = quickFixConformance(name, `engine-landing-quick-fix-laid-on-${name}-`);
  const landing = `fix(${UNIT}): ${CHAIN[1].title}`;
  for (const [how, merge] of Object.entries(conformance.side.byHand)) {
    describe(`the ${name} landing driver's quick-fix, a later fix in flight when the fix below is merged by hand by ${how} (R11, R12)`, () => {
      it(`opens it ${opening(alone.includes(how))}, and the close lands its own change alone`, () => {
        const { at, refusal } = laidOnDay(conformance, merge, alone.includes(how), 'in flight', CHAIN[1]);

        assert.strictEqual(refusal, expected(alone.includes(how), branchOf(2, CHAIN[1].title), conformance.side.back));
        assert.deepStrictEqual([readManifest(at, UNIT).status, conformance.landed(at).filter(([subject]) => subject === landing)], ['completed', [[landing, [CHAIN[1].file]]]]);
      });
    });
  }
}

/**
 * A later fix begun once the fix below has been merged by hand, for the
 * driver `name`, opening alone after each way `alone` names: changing
 * another file, merged by the side's first way; and changing the fix
 * below's own line, merged by its second, which lands the fix below's
 * change alone, the merge back then conflicting, settled to the later
 * fix's text (`laid-on-landed` and `laid-on-landed-same`) — its tests
 * registered under its entry's `node:test`.
 * @param {typeof import('node:test')} test @param {string} name @param {string[]} alone
 */
function laidOnLanded({ describe, it }, name, alone) {
  const conformance = quickFixConformance(name, `engine-landing-quick-fix-laid-on-landed-${name}-`);
  const [[first, byFirst], [second, bySecond]] = Object.entries(conformance.side.byHand);
  describe(`the ${name} landing driver's quick-fix, a later fix begun once the fix below is merged by hand (R12)`, () => {
    it(`by ${first}: opens it ${opening(alone.includes(first))}, and the close lands its own change alone`, () => {
      const { at, refusal } = laidOnDay(conformance, byFirst, alone.includes(first), 'begun after', CHAIN[1]);
      const landing = `fix(${UNIT}): ${CHAIN[1].title}`;

      assert.strictEqual(refusal, expected(alone.includes(first), branchOf(2, CHAIN[1].title), conformance.side.back));
      assert.deepStrictEqual([readManifest(at, UNIT).status, conformance.landed(at).filter(([subject]) => subject === landing)], ['completed', [[landing, [CHAIN[1].file]]]]);
    });

    it(`by ${second}, the later fix changing the fix below's own line: opens it ${opening(alone.includes(second))}, the conflict settled to its own text, and the close lands its own change alone`, () => {
      const { at, refusal } = laidOnDay(conformance, bySecond, alone.includes(second), 'begun after', SAME);
      const landing = `fix(${UNIT}): ${SAME.title}`;

      assert.strictEqual(refusal, expected(alone.includes(second), branchOf(2, SAME.title), conformance.side.back));
      assert.deepStrictEqual([readManifest(at, UNIT).status, conformance.landed(at).filter(([subject]) => subject === landing), git(conformance.side.on(at), ['show', `main:${SAME.file}`])], [
        'completed', [[landing, [SAME.file]]], SAME.text,
      ]);
    });
  });
}

module.exports = { laidOnInFlight, laidOnLanded };
