'use strict';

// ---------------------------------------------------------------------------
// The setup gates due at a start (ledger-engine/scripts/domain/boot-route.cjs,
// `gatesDue`), in the order start works them: the migration review, the stop
// at an older Claude Code and the knowledge gate on every entry; the mod's
// notice, the effort notice and the one-time offers on the bare command
// alone, but the brownfield read on any entry once a lost state has started
// again.
//
// Layer: unit. World: none — boot's facts as values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { gatesDue } = require('../../skills/ledger-engine/scripts/domain/boot-route.cjs');

/** Boot's facts where no gate is due. */
const SETTLED = Object.freeze({
  migrations: { changed: false, verify: [], notices: [] },
  knowledge: 'ready', mod: 'running', effort: null, walkthrough: 'walked', tmux_labels: 'no-tmux',
  brownfield_offer: 'native', github_rule_offer: false, github_squash_offer: false,
});

/** Boot's facts where every gate is due. */
const ALL_DUE = Object.freeze({
  migrations: { changed: true, verify: [], notices: [] },
  knowledge: 'not-ready', mod: 'could', effort: 'low', walkthrough: 'none', tmux_labels: 'prompt',
  brownfield_offer: 'none', github_rule_offer: true, github_squash_offer: true,
});

/** Claude's entry, with the person's words. */
const CLAUDE = Object.freeze({ bare: false, outdated: false, restarted: false });
/** The bare command. */
const BARE = Object.freeze({ bare: true, outdated: false, restarted: false });

/** The gates due on both entries, `facts` over the settled ones. @param {Record<string, unknown>} facts @param {Record<string, boolean>} [entry] */
const onBoth = (facts, entry = {}) => [CLAUDE, BARE].map((on) => gatesDue(/** @type {any} */ ({ ...SETTLED, ...facts }), { ...on, ...entry }));

describe('engine boot: the setup gates due at a start (22.2.1, O3)', () => {
  it('none is due where nothing calls for one, on either entry', () => {
    assert.deepStrictEqual(onBoth({}), [[], []]);
  });

  it('22.S4: the migration review is due on each of its conditions alone — files changed, checks handed back, notices handed back — on either entry', () => {
    const conditions = [
      { changed: true, verify: [], notices: [] },
      { changed: false, verify: [{ id: '067' }], notices: [] },
      { changed: false, verify: [], notices: [{ id: '067' }] },
    ];

    assert.deepStrictEqual(conditions.map((migrations) => onBoth({ migrations })), conditions.map(() => [['migration-review'], ['migration-review']]));
  });

  it('the stop at a Claude Code older than the floor, and the knowledge gate while the project has no knowledge base, show on either entry', () => {
    assert.deepStrictEqual(onBoth({}, { outdated: true }), [['claude-code-floor'], ['claude-code-floor']]);
    assert.deepStrictEqual(onBoth({ knowledge: 'not-ready' }), [['knowledge'], ['knowledge']]);
  });

  it('O3: the mod\'s notice, the effort notice and the one-time offers wait for the bare command, after the gates every entry shows, in start\'s order — none of them offering a decision model (1.S3)', () => {
    assert.deepStrictEqual(gatesDue(ALL_DUE, { ...CLAUDE, outdated: true }), ['migration-review', 'claude-code-floor', 'knowledge']);
    assert.deepStrictEqual(gatesDue(ALL_DUE, { ...BARE, outdated: true }), [
      'migration-review', 'claude-code-floor', 'knowledge', 'mod-notice', 'effort', 'walkthrough', 'session-labels', 'brownfield', 'github-rule', 'github-squash',
    ]);
  });

  it('26.S4, 26.S5: the effort notice is due wherever the session\'s effort is known — whether it is below medium is the start\'s to say — and not where it is unknown', () => {
    const efforts = ['high', 'medium', 'low', null].map((effort) => gatesDue({ ...SETTLED, effort }, BARE));

    assert.deepStrictEqual(efforts, [['effort'], ['effort'], ['effort'], []]);
  });

  it('a lost state started again carries the read of the code on either entry, the yes having asked for it; otherwise the brownfield offer waits for the bare command', () => {
    assert.deepStrictEqual(onBoth({ brownfield_offer: 'none' }, { restarted: true }), [['brownfield'], ['brownfield']]);
    assert.deepStrictEqual(onBoth({ brownfield_offer: 'none' }), [[], ['brownfield']]);
  });
});
