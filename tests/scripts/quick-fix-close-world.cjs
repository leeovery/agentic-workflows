'use strict';

// ---------------------------------------------------------------------------
// The world a quick-fix's close suites share (test-engine-quick-fix-close,
// -close-yes and -close-notes): quick-fix-world.cjs's `twoFixesBuilt` —
// fixes 1.1 and 1.2 on the quick-fix's branch, each built through the local
// driver and done — built once and copied; Claude's call as a raise puts it;
// and the calls a test makes in its conversation, whose records it keeps in
// a config folder of its own.
// ---------------------------------------------------------------------------

const { ok, output, refusedPristine, sectionOf, git, fixtureFrom } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, RECORDS, recordFile, twoFixesBuilt, checklistClosed } = require('./quick-fix-world.cjs');

/** Claude's call raised in the quick-fix's conversation, as the raise suites make one. */
const RAISED = Object.freeze({
  question: 'Should --color still work?',
  rows: [
    { key: '1', name: 'Alias', text: 'Keep --color as an alias', notice: 'old scripts keep working' },
    { key: '2', name: 'Gone', text: 'Drop --color', notice: 'old scripts fail on the flag' },
  ],
  lean: '1',
  why: 'Scripts in the wild pass --color.',
  sort: 'several',
  mechanism: 'The flag parser maps --color onto --colour.',
  product_wide: false,
});

const world = fixtureFrom('quick-fix-close-', twoFixesBuilt);

/**
 * The calls a suite's tests make in their conversation, in the project
 * `at` names.
 * @param {() => string} at
 */
function closeHelpers(at) {
  const config = useTempFolder('quick-fix-close-config-');

  /** This test's conversation, as a call's options. */
  const as = () => ({ env: { LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

  /** A call that must succeed, in this test's conversation. @param {string[]} args */
  const run = (args) => ok(at(), args, as());

  /** A call's refusal, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(at(), args, as()).error;

  /** Fix `n`'s record written through the verb. @param {number} n */
  const record = (n) => run(['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(at(), n, RECORDS[n])]);

  /** Both fixes recorded and the close's checklist closed. */
  function closeable() {
    record(1);
    record(2);
    checklistClosed(at(), as());
  }

  /** The close as the conversation draws it. */
  const screen = () => output(at(), ['render', 'finish', UNIT], as());

  /** The yes's words, as the close's gate offers it. */
  const yesRow = () => sectionOf(screen(), 'MENU: finish').split('\n').find((line) => line.startsWith('**`y/yes`**'));

  /** The branch the project's checkout has out. */
  const branchOut = () => git(at(), ['symbolic-ref', '--short', 'HEAD']).trim();

  /** Finish's items, a line each: key, who checks it, where it stands, and its way on where it names one. */
  const items = () => run(['checklist', 'show', 'finish', UNIT]).items.map((/** @type {any} */ { key, by, state, way }) => `${key} ${by} ${state}${way === undefined ? '' : ` — ${way}`}`);

  return { config, as, run, refused, record, closeable, screen, yesRow, branchOut, items };
}

module.exports = { RAISED, world, closeHelpers };
