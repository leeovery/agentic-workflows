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
} = require('../../skills/workflow-render/scripts/render.cjs');

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
