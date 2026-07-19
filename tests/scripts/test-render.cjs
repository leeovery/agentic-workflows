'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  WIDTH,
  fillTo,
  wrap,
  wrapWithPrefix,
  signpost,
  box,
  renderTree,
} = require('../../skills/workflow-engine/scripts/kernel/render.cjs');

const {
  capitalise,
  tag,
  derivedFrom,
  title,
  discoveryGlyph,
} = require('../../skills/workflow-engine/scripts/domain/conventions.cjs');

// A realistic discovery-map fixture, composed via the conventions layer (proving
// the split: conventions builds the strings, the renderer lays them out).
const MAP = [
  {
    title: title({ glyph: discoveryGlyph('researching'), label: 'Ai Content Engine', tag: 'researching' }),
    body: [
      'AI imagery (enhancement-only v1), description generation, per-tenant tone / base-knowledge primitive, allowance + overage cost shape',
      derivedFrom('from exploration'),
    ],
  },
  {
    title: title({ glyph: discoveryGlyph('ready_for_discussion'), label: 'Legal And Regulatory', tag: 'research complete · ready for discussion' }),
    body: ['Data residency, GDPR, age-gating for the competition flows', derivedFrom('from research-analysis')],
  },
  {
    title: title({ glyph: discoveryGlyph('researching'), label: 'Menu And Admin', tag: 'researching' }),
    body: ['Business-side menu modelling, admin shell (Filament vs custom Vue/Nuxt), JustEat import, staff/roles', derivedFrom('from exploration')],
  },
];

// A discussion-map fixture exercising nesting (children).
const DISCUSSION = [
  { title: '✓ Subsystem Prefix Taxonomy [decided]' },
  {
    title: '→ Decision-Point INFO Line Shape [converging]',
    children: [
      { title: '✓ Field Order [decided]' },
      { title: '◐ Truncation Rules [exploring]' },
    ],
  },
  { title: '○ Rollout Sequencing [pending]' },
];

describe('render core: fillTo', () => {
  it('pads a head out to the target width', () => {
    const out = fillTo('── Name ', '─', 49);
    assert.strictEqual(out.length, 49);
    assert.ok(out.startsWith('── Name '));
    assert.ok(out.endsWith('─'));
  });

  it('returns the head unchanged when it already meets the width', () => {
    assert.strictEqual(fillTo('exactly-ten', '─', 5), 'exactly-ten');
  });

  it('never produces a negative repeat — the over-long head is returned unchanged', () => {
    const head = 'x'.repeat(60);
    let out;
    assert.doesNotThrow(() => { out = fillTo(head, '─', 49); });
    assert.strictEqual(out, head);
  });
});

describe('render core: wrap', () => {
  it('wraps greedily within the budget', () => {
    const lines = wrap('the quick brown fox jumps', 10);
    assert.deepStrictEqual(lines, ['the quick', 'brown fox', 'jumps']);
    for (const l of lines) assert.ok(l.length <= 10);
  });

  it('hard-splits a token longer than the budget', () => {
    const lines = wrap('fastest-cumulative-time wins', 10);
    for (const l of lines) assert.ok(l.length <= 10, `"${l}" exceeds budget`);
    assert.strictEqual(lines[0], 'fastest-cu'); // oversized token broken at the budget
    assert.ok(lines.length >= 3);
  });

  it('returns a single empty segment for empty text', () => {
    assert.deepStrictEqual(wrap('', 10), ['']);
  });

  it('rejects a non-positive budget', () => {
    assert.throws(() => wrap('x', 0));
    assert.throws(() => wrap('x', -3));
  });
});

describe('render core: wrapWithPrefix (the budget bug lives here)', () => {
  it('subtracts the prefix width from the budget so total width is respected', () => {
    const prefix = '  │      '; // 9-char discovery-map gutter
    const lines = wrapWithPrefix(
      'AI imagery enhancement-only v1 description generation primitive',
      { width: 49, prefix }
    );
    for (const l of lines) {
      assert.ok(l.startsWith(prefix), 'every line carries the gutter');
      assert.ok(l.length <= 49, `"${l}" (${l.length}) overruns width 49`);
    }
  });

  it('keeps the gutter on every continuation line (tree never breaks)', () => {
    const lines = wrapWithPrefix('one two three four five six seven', {
      width: 20,
      prefix: '│  ',
    });
    assert.ok(lines.length > 1);
    for (const l of lines) assert.ok(l.startsWith('│  '));
  });

  it('throws when the prefix leaves no room within the width', () => {
    assert.throws(() => wrapWithPrefix('x', { width: 5, prefix: '      ' }));
  });
});

describe('render shape: signpost', () => {
  it('renders a step marker at the canonical width', () => {
    const out = signpost('Construct Specification');
    assert.strictEqual(out.length, WIDTH);
    assert.strictEqual(out, '── Construct Specification ' + '─'.repeat(WIDTH - 27));
    assert.ok(out.startsWith('── Construct Specification '));
  });

  it('renders a sub-step marker with middle dots', () => {
    const out = signpost('Extract Sources', { style: 'substep' });
    assert.strictEqual(out.length, WIDTH);
    assert.ok(out.startsWith('·· Extract Sources '));
    assert.ok(out.endsWith('·'));
  });

  it('honours a custom width', () => {
    assert.strictEqual(signpost('X', { width: 20 }).length, 20);
  });

  it('supports loop-iteration labels verbatim', () => {
    const out = signpost('Task Execution (3 of 12)');
    assert.ok(out.startsWith('── Task Execution (3 of 12) '));
    assert.strictEqual(out.length, WIDTH);
  });

  it('rejects an empty label and an unknown style', () => {
    assert.throws(() => signpost('   '));
    assert.throws(() => signpost('X', { style: 'bogus' }));
  });
});

describe('render shape: box (phase title)', () => {
  it('renders a 49-wide bullet-bordered box with a trailing blank line', () => {
    const out = box('Planning Overview');
    const lines = out.split('\n');
    // border, title, border, <visible blank>, "" (final terminator)
    assert.strictEqual(lines[0], '●' + '─'.repeat(WIDTH - 2) + '●');
    assert.strictEqual(lines[0].length, WIDTH);
    assert.strictEqual(lines[1], '  Planning Overview');
    assert.strictEqual(lines[2], lines[0]);
    assert.strictEqual(lines[3], ''); // the breathing-room blank line
    assert.ok(out.endsWith('\n\n'));
  });

  it('rejects an empty title', () => {
    assert.throws(() => box(''));
  });
});

describe('render shape: renderTree (discovery map)', () => {
  it('reproduces the documented row lines byte-for-byte', () => {
    const lines = renderTree(MAP, { width: 65 }).split('\n');
    assert.strictEqual(lines[0], '  ├─ ◐ Ai Content Engine [researching]');
    assert.strictEqual(
      lines.find((l) => l.includes('Legal And Regulatory')),
      '  ├─ → Legal And Regulatory [research complete · ready for discussion]'
    );
    assert.strictEqual(
      lines.find((l) => l.includes('Menu And Admin')),
      '  └─ ◐ Menu And Admin [researching]'
    );
  });

  it('hangs off the header — first row ├─, last └─, never ┌─', () => {
    const out = renderTree(MAP, { width: 65 });
    assert.ok(out.startsWith('  ├─ '));
    assert.ok(!out.includes('┌─'));
    const rows = out.split('\n').filter((l) => /^ {2}[├└]─ /.test(l));
    assert.strictEqual(rows.length, 3);
    assert.ok(rows[rows.length - 1].startsWith('  └─ '));
  });

  it('keeps every BODY line within the width (gutter-orphan bug is impossible)', () => {
    // Header rows (`├─ glyph Name [tag]`) are single-line and data-determined —
    // they can't wrap without breaking glyph alignment, so they're exempt (the
    // hand-drawn version overruns identically). Only the wrappable body lines
    // are guaranteed to fit — that's where the bug was.
    for (const width of [49, 58, 72]) {
      for (const l of renderTree(MAP, { width }).split('\n')) {
        if (/^ {2}[├└]─ /.test(l) || l === '') continue; // header row / trailing
        assert.ok(l.length <= width, `width ${width}: body "${l}" (${l.length}) overruns`);
      }
    }
  });

  it('renders provenance as a distinct ↳ -marked, capitalised line', () => {
    const out = renderTree(MAP, { width: 72 });
    assert.ok(out.includes('  │     ↳ From exploration'), 'non-last provenance: gutter + arrow + capitalised');
    assert.ok(out.includes('        ↳ From exploration'), 'last provenance: 8-space gutter + arrow + capitalised');
    assert.ok(out.includes('↳ From research-analysis'), 'capitalises whatever the provenance is');
    assert.ok(!out.includes('from exploration'), 'no lowercase provenance leaks through');
  });

  it('runs the │ unbroken under non-last topics, drops it under the last', () => {
    const lines = renderTree(MAP, { width: 65 }).split('\n').filter(Boolean);
    let currentIsLast = false;
    for (const l of lines) {
      const m = l.match(/^ {2}([├└])─ /);
      if (m) { currentIsLast = m[1] === '└'; continue; }
      // body sub-line — aligns one level in (8-wide gutter)
      if (currentIsLast) {
        assert.ok(/^ {8}\S/.test(l), `last-topic sub-line should be 8 spaces then text: "${l}"`);
        assert.ok(!l.includes('│'), `last topic must not carry the bar: "${l}"`);
      } else {
        assert.strictEqual(l[2], '│', `non-last sub-line must carry the bar at col 2: "${l}"`);
        assert.ok(l.startsWith('  │     '), `non-last gutter must be 2sp │ 5sp: "${l}"`);
      }
    }
  });

  it('single node uses a sole └─', () => {
    const out = renderTree([{ title: '○ Only One [fresh]' }], { width: 49 });
    assert.ok(out.startsWith('  └─ ○ Only One [fresh]'));
    assert.ok(!out.includes('├─') && !out.includes('┌─'));
  });

  it('nests children with an accumulating gutter (discussion-map shape)', () => {
    const lines = renderTree(DISCUSSION, { width: 72 }).split('\n');
    // Parent is a non-last sibling, so its children sit under a continued │.
    assert.ok(lines.includes('  ├─ → Decision-Point INFO Line Shape [converging]'));
    assert.ok(lines.includes('  │  ├─ ✓ Field Order [decided]'), 'non-last child branches under the parent bar');
    assert.ok(lines.includes('  │  └─ ◐ Truncation Rules [exploring]'), 'last child uses └─, parent bar still runs');
    // Last top-level sibling drops its own bar.
    assert.ok(lines.includes('  └─ ○ Rollout Sequencing [pending]'));
    assert.ok(!renderTree(DISCUSSION).includes('┌─'));
  });

  it('rejects an empty node list and a title-less node', () => {
    assert.throws(() => renderTree([]));
    assert.throws(() => renderTree([{ body: ['orphan'] }]));
  });
});

describe('conventions (domain composition layer)', () => {
  it('tag wraps in square brackets', () => {
    assert.strictEqual(tag('decided'), '[decided]');
  });

  it('capitalise upper-cases only the first character', () => {
    assert.strictEqual(capitalise('from exploration'), 'From exploration');
    assert.strictEqual(capitalise(''), '');
  });

  it('derivedFrom builds a capitalised ↳ line', () => {
    assert.strictEqual(derivedFrom('from research-analysis'), '↳ From research-analysis');
  });

  it('title composes glyph + label + [tag], omitting absent parts', () => {
    assert.strictEqual(title({ glyph: '◐', label: 'Menu And Admin', tag: 'researching' }), '◐ Menu And Admin [researching]');
    assert.strictEqual(title({ label: 'No Glyph', tag: 'pending' }), 'No Glyph [pending]');
    assert.strictEqual(title({ label: 'Bare' }), 'Bare');
  });

  it('clamps over-long labels with an ellipsis — glyph and tag survive', () => {
    const long = 'x'.repeat(100);
    const out = title({ glyph: '◐', label: long, tag: 'researching' });
    assert.strictEqual(out, `◐ ${'x'.repeat(39)}… [researching]`);
  });

  it('leaves a 40-char label unclamped', () => {
    const exact = 'y'.repeat(40);
    assert.strictEqual(title({ label: exact }), exact);
  });

  it('discoveryGlyph maps tiers to the canonical symbol set', () => {
    assert.strictEqual(discoveryGlyph('decided'), '✓');
    assert.strictEqual(discoveryGlyph('fresh'), '○');
    assert.strictEqual(discoveryGlyph('unknown-tier'), '');
  });
});
