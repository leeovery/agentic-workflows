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
} = require('../../skills/workflow-render/scripts/render.cjs');

// A realistic discovery-map fixture: three topics, mixed tiers, wrapped summaries.
const MAP = [
  {
    glyph: '◐', label: 'Ai Content Engine', tag: 'researching',
    summary: 'AI imagery (enhancement-only v1), description generation, per-tenant tone / base-knowledge primitive, allowance + overage cost shape',
    provenance: 'from exploration',
  },
  {
    glyph: '→', label: 'Legal And Regulatory', tag: 'research complete · ready for discussion',
    summary: 'Data residency, GDPR, age-gating for the competition flows',
    provenance: 'from research-analysis',
  },
  {
    glyph: '◐', label: 'Menu And Admin', tag: 'researching',
    summary: 'Business-side menu modelling, admin shell (Filament vs custom Vue/Nuxt), JustEat import, staff/roles',
    provenance: 'from exploration',
  },
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

  it('never produces a negative repeat', () => {
    assert.doesNotThrow(() => fillTo('x'.repeat(60), '─', 49));
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

  it('renders provenance as a distinct · -marked, capitalised line', () => {
    const out = renderTree(MAP, { width: 72 });
    assert.ok(out.includes('  │      · From exploration'), 'non-last provenance: gutter + marker + capitalised');
    assert.ok(out.includes('         · From exploration'), 'last provenance: 9-space gutter + marker + capitalised');
    assert.ok(out.includes('· From research-analysis'), 'capitalises whatever the provenance is');
    assert.ok(!out.includes('from exploration'), 'no lowercase provenance leaks through');
  });

  it('runs the │ unbroken under non-last topics, drops it under the last', () => {
    const lines = renderTree(MAP, { width: 65 }).split('\n').filter(Boolean);
    let currentIsLast = false;
    for (const l of lines) {
      const m = l.match(/^ {2}([├└])─ /);
      if (m) { currentIsLast = m[1] === '└'; continue; }
      // body sub-line
      if (currentIsLast) {
        assert.ok(/^ {9}\S/.test(l), `last-topic sub-line should be 9 spaces then text: "${l}"`);
        assert.ok(!l.includes('│'), `last topic must not carry the bar: "${l}"`);
      } else {
        assert.strictEqual(l[2], '│', `non-last sub-line must carry the bar at col 2: "${l}"`);
        assert.ok(l.startsWith('  │      '), `non-last gutter must be 2sp │ 6sp: "${l}"`);
      }
    }
  });

  it('single node uses a sole └─', () => {
    const out = renderTree([{ glyph: '○', label: 'Only One', tag: 'fresh' }], { width: 49 });
    assert.ok(out.startsWith('  └─ ○ Only One [fresh]'));
    assert.ok(!out.includes('├─') && !out.includes('┌─'));
  });

  it('rejects an empty node list and a label-less node', () => {
    assert.throws(() => renderTree([]));
    assert.throws(() => renderTree([{ glyph: '○' }]));
  });
});
