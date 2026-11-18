'use strict';

// ---------------------------------------------------------------------------
// The section a record's cite names (ledger-migrate/scripts/cited-sections.cjs,
// 21.6.3): the one resolver the carry, the records' check and the walk sheet
// read every cite by. A cite names one heading alone or none; in a joined
// spec a cite opening on a part's heading names a heading of that part,
// whatever headings stand between; a cite naming several is answered with
// each it could mean, as a cite names it alone, which reads back to it.
// How the carry, the check and the sheet take it is test-migration-079's
// and test-engine-brief-migration's.
//
// Layer: unit. World: none — texts in hand.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { outlineOf, citedSection, couldMean, citeNameOf } = require('../../skills/ledger-migrate/scripts/cited-sections.cjs');

// A joined spec shaped as the move joins old specs (078): a part whose old
// spec opened on its own heading, which every heading of the part sits under,
// beside one that did not, a heading both parts hold, and siblings sharing
// their whole path.
const JOINED = [
  '# Switcher', '',
  '## 1. Networking', '', '#### Dependencies', '', 'The socket layer.', '', '##### Required', '', 'A peer.', '',
  '## 2. Switching', '', '#### Specification', '', 'Moving the device.', '',
  '##### Dependencies', '', 'The pairing layer.', '', '###### Required', '', 'A paired device.', '',
  '##### Notes', '', 'One.', '', '##### Notes', '', 'Two.', '',
].join('\n');

/** The heading of `headings` at a path, the first of those sharing it. @param {import('../../skills/ledger-migrate/scripts/cited-sections.cjs').Heading[]} headings @param {string} at */
const at = (headings, at) => /** @type {import('../../skills/ledger-migrate/scripts/cited-sections.cjs').Heading} */ (headings.find(({ path }) => path === at));

describe('the section a cite names (21.6.3)', () => {
  const headings = outlineOf(JOINED, true);
  const named = (/** @type {string} */ name) => citedSection(headings, name)?.path ?? null;

  it('a heading several parts hold, cited bare or by a path both share, names none — never the first, nor any part\'s — and could mean each, named by its part', () => {
    assert.deepStrictEqual(['Dependencies', 'Dependencies > Required'].map((name) => [named(name), couldMean(headings, name).map((heading) => citeNameOf(headings, heading))]), [
      [null, ['1. Networking > Dependencies', '2. Switching > Dependencies']],
      [null, ['1. Networking > Required', '2. Switching > Required']],
    ]);
  });

  it('cited by its part, it names that part\'s copy, whatever headings stand between; by a path naming it alone, the same copy; a part none holds, nothing', () => {
    assert.deepStrictEqual(['1. Networking > Dependencies', '2. Switching > Dependencies', '2. Switching > Dependencies > Required', 'Specification > Dependencies', '3. Pairing > Dependencies'].map(named), [
      'Switcher > 1. Networking > Dependencies',
      'Switcher > 2. Switching > Specification > Dependencies',
      'Switcher > 2. Switching > Specification > Dependencies > Required',
      'Switcher > 2. Switching > Specification > Dependencies',
      null,
    ]);
  });

  it('siblings sharing their whole path, within a part, named by their place among them after the part', () => {
    const notes = headings.filter(({ path }) => path === 'Switcher > 2. Switching > Specification > Notes');

    assert.deepStrictEqual([notes.map((heading) => citeNameOf(headings, heading)), ['2. Switching > Notes [2]', 'Notes [1]'].map((name) => citedSection(headings, name))], [
      ['2. Switching > Notes [1]', '2. Switching > Notes [2]'],
      [notes[1], notes[0]],
    ]);
  });

  it('every heading of a joined spec, of a log, and of a file of no one root, its cite name reading back to it alone', () => {
    const texts = [
      [JOINED, true],
      ['## Discussion\n\n### Trial Length\n\n#### Decision\n\nFourteen days.\n\n### Seats\n\n#### Decision\n\nFive.\n\n#### Decision\n\nSix.\n', false],
      ['## Decision\n\nThirty days.\n\n## Option A\n\n### Decision\n\nFourteen days.\n', false],
    ];

    for (const [text, joined] of texts) {
      const outline = outlineOf(/** @type {string} */ (text), /** @type {boolean} */ (joined));
      assert.deepStrictEqual(outline.map((heading) => citedSection(outline, citeNameOf(outline, heading))), outline);
    }
    assert.strictEqual(citeNameOf(headings, at(headings, 'Switcher > 2. Switching')), '2. Switching');
  });
});
