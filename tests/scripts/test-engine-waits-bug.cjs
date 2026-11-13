'use strict';

// ---------------------------------------------------------------------------
// What the menus read of a bug in its investigation: what waits on the
// person there (leeway-engine/scripts/domain/waits.cjs; 18.2.3) — each
// raise sealed at its places, at its topic or its own level, counted in the
// conversation that drew it alone, where it can be shown and answered, and
// in no other nor in none (N1); its door the investigation; and how far the
// unit has come.
//
// Layer: verb, the reads called in process. World: two bugs entered at
// their investigation in the fixture library's project, built once and
// copied for each test, the conversation's seals in a config folder of the
// test's own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, okSectionsAsync, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { ledgerHelpers, leaningCall, MADE } = require('./ledger-world.cjs');
const { waitsIn, progress, door, wait, sealed } = require('./waits-world.cjs');

const BUGS = ['kill-all', 'empty-save'];
const HUNT = 'sess-hunt';

const hunting = fixtureFrom('waits-bug-', (dir) => {
  for (const bug of BUGS) createManifest(dir, bug, { work_type: 'bugfix', description: `${bug} loses the saved state` });
  commitAll(dir, 'the bugs');
  for (const bug of BUGS) ok(dir, ['enter', 'investigation', bug], { env: { CLAUDE_PID: undefined } });
});

describe('a bug\'s investigation (18.2.3, N1)', () => {
  const config = useTempFolder('waits-bug-config-');
  /** @type {string} */
  let dir;
  afterEach(() => cleanupFixture(dir));

  /** The conversation the raises are sealed in. */
  const as = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: HUNT, TMUX: undefined, TMUX_PANE: undefined });

  /** Claude's question at a bug's investigation, at its topic or its own level, raised in the conversation: the question's short id and the raise's id. @param {string} bug @param {string} at */
  async function raisedAt(bug, at) {
    const question = `What does ${bug} lose?`;
    const asked = ledgerHelpers(() => dir).write('ask', at, [], { ...MADE, text: question }).id;
    const { raise } = (await okSectionsAsync(dir, ['raise', at, '--answers', asked], { env: as(), stdin: JSON.stringify({ ...leaningCall('Every session.', 'The last one.'), question }) })).res;
    return { asked, raise };
  }

  it('a raise sealed at a bug\'s investigation, at its topic or its own level, waits in the conversation that drew it until answered, each bug its own, its door the investigation — and counts for nothing read in another conversation or in none; the unit is in its investigation', async () => {
    dir = hunting();
    const killAll = await raisedAt(BUGS[0], `${BUGS[0]}.investigation.${BUGS[0]}`);
    const emptySave = await raisedAt(BUGS[1], `${BUGS[1]}.investigation`);
    /** What waits in the bugs, read in the conversation `session`, or in none. @param {string} [session] */
    const waiting = (session) => waitsIn(dir, BUGS, { config: config(), session });
    const read = { here: waiting(HUNT), elsewhere: waiting('sess-cleared'), nowhere: waiting() };
    ok(dir, ['raise', 'answer', killAll.raise, '--pick', '1'], { env: as(), stdin: JSON.stringify({ why: 'Every session is lost.' }) });
    /** The question raised at `bug`, waiting as its raise. @param {string} bug @param {{asked: string, raise: string}} at */
    const raised = (bug, { asked, raise }) => sealed(wait('raise', asked, `What does ${bug} lose?`, door('leeway-investigation-process', 'bugfix', bug)), raise);
    const none = { [BUGS[0]]: [], [BUGS[1]]: [] };

    assert.deepStrictEqual([read, waiting(HUNT), progress(dir, BUGS[0])], [
      { here: { [BUGS[0]]: [raised(BUGS[0], killAll)], [BUGS[1]]: [raised(BUGS[1], emptySave)] }, elsewhere: none, nowhere: none },
      { [BUGS[0]]: [], [BUGS[1]]: [raised(BUGS[1], emptySave)] },
      'investigation',
    ]);
  });
});
