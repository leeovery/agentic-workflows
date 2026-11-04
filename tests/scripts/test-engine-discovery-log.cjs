'use strict';

// ---------------------------------------------------------------------------
// `engine discovery-log not-taken|view|spike <epic> …` (leeway-engine/
// scripts/domain/discovery-log.cjs, 20.11.1, 20.11.3): each entry put in its
// fixed shape under its fixed heading in the log of the epic's open session
// — after the last entry of the last heading of its name, or under the
// heading added at the log's end — and every refusal writing nothing. How
// the board reads the lists is test-engine-board-discovery.cjs's.
//
// Layer: verb. World: discovery's gate suites' epic to shape, its first
// session open (discovery-gates-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refusedPristine, writeState, readState, layout } = require('./engine-harness.cjs');
const { EPIC, useGatesWorld } = require('./discovery-gates-world.cjs');

const dir = useGatesWorld('epic');
const LOG = layout.session(EPIC, '001');

/** A call of the verb. @param {string[]} args */
const log = (args) => ok(dir(), ['discovery-log', ...args]);

describe('discovery-log (20.11.1, 20.11.3)', () => {
  it('each entry under its heading, in its shape, the heading added at the log\'s end where the log lacks it; the answer names the log, the heading and the line', () => {
    const [frame] = ['frame', 'sync'].map((slug) => ok(dir(), ['asset', 'spike', EPIC, slug]).spike);
    const before = readState(dir(), LOG);

    const answers = [
      log(['not-taken', EPIC, '--direction', 'The Mac App Store', '--why', 'the private Spaces APIs are an automatic rejection']),
      log(['view', EPIC, '--text', 'Clean, well-structured, beautiful, and it just works']),
      log(['spike', EPIC, frame, '--tool', 'Paper', '--showed', 'Luminous glass reads at a glance — even small', '--link', 'https://paper.design/f/1']),
      log(['spike', EPIC, '002-sync', '--tool', 'Swift', '--showed', 'Sync holds across two Macs']),
    ];

    assert.deepStrictEqual({ answers, log: readState(dir(), LOG) }, {
      answers: [
        { ok: true, log: LOG, heading: 'Not taken', line: '- The Mac App Store — the private Spaces APIs are an automatic rejection' },
        { ok: true, log: LOG, heading: 'Views of the product', line: '- Clean, well-structured, beautiful, and it just works' },
        { ok: true, log: LOG, heading: 'Spikes', line: '- 001-frame · [Paper](https://paper.design/f/1) — Luminous glass reads at a glance — even small' },
        { ok: true, log: LOG, heading: 'Spikes', line: '- 002-sync · Swift — Sync holds across two Macs' },
      ],
      log: `${before}${before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'}${[
        '## Not taken', '', '- The Mac App Store — the private Spaces APIs are an automatic rejection', '',
        '## Views of the product', '', '- Clean, well-structured, beautiful, and it just works', '',
        '## Spikes', '', '- 001-frame · [Paper](https://paper.design/f/1) — Luminous glass reads at a glance — even small', '- 002-sync · Swift — Sync holds across two Macs', '',
      ].join('\n')}`,
    });
  });

  it('a heading written before takes each next entry after its last entry and the lines indented beneath it, wherever it stands and whatever follows — a closing line directly beneath it among them — under the last heading of its name outside a fence; a heading with no entry beneath takes it as its first', () => {
    ok(dir(), ['asset', 'spike', EPIC, 'frame']);
    writeState(dir(), LOG, [
      '## 2026-07-18 · session sess-1', '',
      '## Not taken', '', '- Importing Stickies — nobody asked', '',
      '## Spikes', '', 'Nothing spiked yet.', '',
      '## Not taken', '', 'Written again by a later conversation.', '', '- Pinned notes — later', '',
      '## Views of the product', '', '- One-time pricing', '  - [pricing.md](../imports/pricing.md)', 'Got to: the map is drafted.', '',
      '```text', '## Views of the product', '```', '',
    ].join('\n'));

    log(['view', EPIC, '--text', 'Modern Swift']);
    log(['view', EPIC, '--text', 'Correctness over speed']);
    log(['not-taken', EPIC, '--direction', 'A billing backend', '--why', 'the Merchant of Record covers checkout']);
    log(['spike', EPIC, '001-frame', '--tool', 'Paper', '--showed', 'Glass reads at a glance']);

    assert.strictEqual(readState(dir(), LOG), [
      '## 2026-07-18 · session sess-1', '',
      '## Not taken', '', '- Importing Stickies — nobody asked', '',
      '## Spikes', '', '- 001-frame · Paper — Glass reads at a glance', '', 'Nothing spiked yet.', '',
      '## Not taken', '', 'Written again by a later conversation.', '', '- Pinned notes — later', '- A billing backend — the Merchant of Record covers checkout', '',
      '## Views of the product', '', '- One-time pricing', '  - [pricing.md](../imports/pricing.md)', '- Modern Swift', '- Correctness over speed', 'Got to: the map is drafted.', '',
      '```text', '## Views of the product', '```', '',
    ].join('\n'));
  });

  it('refuses, writing nothing: an entry of no kind, arguments out of shape, a unit the project lacks or no epic, a value missing, empty or past one line, one holding what its line keeps for itself, a live link that is no web address, and a spike the epic lacks', () => {
    ok(dir(), ['asset', 'spike', EPIC, 'frame']);
    const usage = 'Usage: engine discovery-log not-taken <epic> --direction "<direction>" --why "<why>"';
    const refusals = /** @type {[string[], string|RegExp][]} */ ([
      [[], /^Usage: engine discovery-log <not-taken\|view\|spike> …\ndiscovery-log not-taken/],
      [['aside', EPIC], /^Usage: engine discovery-log <not-taken\|view\|spike> …/],
      [['not-taken', EPIC, '--direction', 'Stickies'], usage],
      [['not-taken', EPIC, '--direction', 'Stickies', '--why', 'no', '--text', 'x'], usage],
      [['not-taken', EPIC, 'extra', '--direction', 'Stickies', '--why', 'no'], usage],
      [['spike', EPIC, '--tool', 'Paper', '--showed', 'x'], 'Usage: engine discovery-log spike <epic> <spike> --tool "<tool>" --showed "<what it showed>" [--link <live link>]'],
      [['view', 'nowhere', '--text', 'x'], 'discovery-log: there is no work unit "nowhere"'],
      [['view', 'atlas', '--text', 'x'], 'discovery-log: atlas is a feature — the fixed lists are an epic\'s discovery\'s'],
      [['view', EPIC, '--text'], 'discovery-log: --text is one line of words, not empty'],
      [['view', EPIC, '--text', '  '], 'discovery-log: --text is one line of words, not empty'],
      [['view', EPIC, '--text', 'one\ntwo'], 'discovery-log: --text is one line of words, not empty'],
      [['not-taken', EPIC, '--direction', 'Stickies — imported', '--why', 'no'], 'discovery-log: --direction holds "—", which its line\'s shape keeps for itself'],
      [['spike', EPIC, '001-frame', '--tool', 'Paper — glass', '--showed', 'x'], 'discovery-log: --tool holds "—", which its line\'s shape keeps for itself'],
      [['spike', EPIC, '001-frame', '--tool', '[Paper]', '--showed', 'x'], 'discovery-log: --tool holds "[", which its line\'s shape keeps for itself'],
      [['spike', EPIC, '001-frame', '--tool', 'Paper', '--showed', 'x', '--link', 'paper.design/f/1'], 'discovery-log: --link is the spike\'s live link, a web address, not "paper.design/f/1"'],
      [['spike', EPIC, '001-frame', '--tool', 'Paper', '--showed', 'x', '--link', 'https://paper.design/f/(1)'], 'discovery-log: --link is the spike\'s live link, a web address, not "https://paper.design/f/(1)"'],
      [['spike', EPIC, '002-sync', '--tool', 'Paper', '--showed', 'x'], 'discovery-log: fumi has no spike "002-sync" — name it as asset spike answered it, its spike'],
      [['spike', EPIC, `${EPIC}/spikes/001-frame`, '--tool', 'Paper', '--showed', 'x'], `discovery-log: fumi has no spike "${EPIC}/spikes/001-frame" — name it as asset spike answered it, its spike`],
      [['spike', EPIC, '001-frame/', '--tool', 'Paper', '--showed', 'x'], 'discovery-log: fumi has no spike "001-frame/" — name it as asset spike answered it, its spike'],
    ]);

    for (const [args, refusal] of refusals) {
      const { error } = refusedPristine(dir(), ['discovery-log', ...args]);
      if (typeof refusal === 'string') assert.strictEqual(error, refusal, args.join(' '));
      else assert.match(error, refusal, args.join(' '));
    }
  });

  it('refuses an epic with no session open, writing nothing', () => {
    ok(dir(), ['discovery-session', 'close', EPIC, '-m', 'discovery(fumi): end session 001']);

    assert.strictEqual(refusedPristine(dir(), ['discovery-log', 'view', EPIC, '--text', 'Modern Swift']).error,
      'discovery-log: no discovery session is open for fumi — enter discovery fumi opens one');
  });
});
