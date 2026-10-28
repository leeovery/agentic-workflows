'use strict';

// ---------------------------------------------------------------------------
// The render kernel: the surface primitives
// (domain/projections/surfaces.cjs), the worklist
// (domain/projections/worklist.cjs), the catalogue's dispatch
// (domain/render.cjs), the single-source invariants that keep the menu
// grammar and the render forms in surfaces.cjs alone, and the CLI boundary:
// `engine render` through the argv entry. Each phase's surfaces are in
// test-engine-render-surfaces-{phase}.cjs.
//
// Layer: unit, and verb for a surface rendered, through `engine render` in
// process (engine-harness.cjs). World: the project world (setupFixture), its
// manifests and payloads written per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { DOTS, section, timedInstruction, STOP_CLAUSE, CONTINUE_CLAUSE, AUTO_GATE_CLAUSE, menuFrame, menu, cmdOption, bareOption, promptOption, rangeOption, callout, indentedBody, bulletRow, subDetail, treeList } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('surfaces primitives', () => {
  it('a timed instruction is built from its parts — the form, the moment, then the behaviour clause where there is one', () => {
    assert.strictEqual(timedInstruction('text', 'after the result summary', AUTO_GATE_CLAUSE),
      'emit verbatim as a text code block (```text fence) after the result summary — the user set this gate to auto: do not stop; continue as the workflow instructs');
    assert.strictEqual(timedInstruction('text', 'only at an analysis deferral', CONTINUE_CLAUSE),
      'emit verbatim as a text code block (```text fence) only at an analysis deferral — do not stop; continue as the workflow instructs');
    assert.strictEqual(timedInstruction('markdown', 'after the response', STOP_CLAUSE),
      "emit verbatim as markdown (not a code block) after the response, then STOP for the user's response");
    assert.strictEqual(timedInstruction('text', 'after the response'),
      'emit verbatim as a text code block (```text fence) after the response');
  });

  it('menu opens on the rule, glyphs a short label, and never closes the frame', () => {
    assert.strictEqual(
      menu('Approve?', ['**`y/yes`**', '**`n/no`**']),
      [DOTS, '**`◆ Approve?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('leaves a long or marked-up label as prose — the glyph span cannot nest markup', () => {
    const long = 'Whether the pipeline can expose **click windows** belongs to a different topic entirely';
    const out = menu(long, ['**`y/yes`**'], { question: 'Move it there?' });
    assert.strictEqual(out, [DOTS, long, '', '**`◆ Move it there?`**', '', '**`y/yes`**'].join('\n'));
  });

  it('refuses a y/yes row under a statement — a consent gate asks its question', () => {
    const yes = ['**`y/yes`**', '**`n/no`**'];
    assert.throws(() => menu('Proceed.', yes), /"Proceed\." is not one/);
    assert.throws(() => menu('The tree is dirty.', yes, { question: 'Carry on.' }), /"Carry on\." is not one/);
    assert.throws(() => menu('', ['**`y/yes`** → Apply it']), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses a y/yes row under a question the label cannot glyph — the split is the fix', () => {
    const long = 'Does the pipeline exposing **click windows** belong to a different topic entirely?';
    assert.throws(() => menu(long, ['**`y/yes`**']), /no `◆ …\?` line stands above the rows/);
    assert.throws(() => menu('The tree is dirty.', ['**`y/yes`**'], { question: long }), /"Does the pipeline exposing .*" is not one/);
  });

  it('holds a projection-composed frame to the same rule — the check reads the composed lines', () => {
    const rows = ['**`y/yes`** → Proceed anyway', '**`b/back`** → Return to menu'];
    const lines = menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', '', ...rows]).split('\n');
    assert.deepStrictEqual(lines.slice(0, 5), [DOTS, 'Two topics sit ahead.', '', '**`◆ Proceed anyway?`**', ''], 'a glyphed line makes the leading statement context');
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', '**`◆ Proceed anyway.`**', '', ...rows]), /"Proceed anyway\." is not one/);
    assert.throws(() => menuFrame(['Two topics sit ahead.', '', ...rows]), /"Two topics sit ahead\." is not one/);
    assert.throws(() => menuFrame(['Two topics sit ahead:', ...rows]), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses an n/no row without a y/yes row — a refusal answers yes, never a verb synonym', () => {
    assert.throws(() => menu('Proceed?', ['**`p/proceed`** → Carry on', '**`n/no`** → Stop here']), /an n\/no row answers a y\/yes row/);
  });

  it('a y/yes row passes under a glyphable question — the label itself, or one split beneath a statement', () => {
    assert.strictEqual(menu('Proceed?', ['**`y/yes`** → Carry on', '**`n/no`** → Stop here']).split('\n')[1], '**`◆ Proceed?`**');
    assert.strictEqual(
      menu('The tree is dirty.', ['**`y/yes`**', '**`n/no`**'], { question: 'Carry on?' }),
      [DOTS, 'The tree is dirty.', '', '**`◆ Carry on?`**', '', '**`y/yes`**', '**`n/no`**'].join('\n'),
    );
  });

  it('every menu asks — a route menu under a statement is refused, and passes once a question rides beneath it', () => {
    const rows = ['**`d/discussion`** → Discuss it', '**`r/research`** → Research it'];
    assert.throws(() => menu('Where this belongs.', rows), /every menu asks a glyphed question — "Where this belongs\." is not one/);
    assert.throws(() => menu('', rows), /no `◆ …\?` line stands above the rows/);
    assert.throws(() => menu('', rows, { question: 'Which one' }), /"Which one" is not one/);
    assert.deepStrictEqual(
      menu('Where this belongs.', rows, { question: 'Where should it go?' }).split('\n').slice(1, 4),
      ['Where this belongs.', '', '**`◆ Where should it go?`**'],
    );
  });

  it('the question stands above the rows — one beneath them asks nothing', () => {
    assert.throws(() => menuFrame(['**`1`** → A', '', '**`◆ Which one?`**']), /no `◆ …\?` line stands above the rows/);
  });

  it('refuses a menu with no row to press — plain lines and prompt options alone are no menu', () => {
    assert.throws(() => menu('Which one?', ['a plain line']), /no row to press/);
    assert.throws(() => menu('Which one?', ['**Comment** → Tell me what you think']), /no row to press/);
    assert.throws(() => menuFrame(['**`◆ Which one?`**']), /no row to press/);
  });

  it('refuses a menu whose only keyed rows are ranges — a range is typed, never pressed', () => {
    const typedOnly = [rangeOption(1, 3, 'Select item(s)'), promptOption('Comment', 'Tell me what you think')];
    assert.throws(() => menu('Which items?', typedOnly), /no row to press — a menu offers at least one single key .*; a range row is typed, never pressed/);
    assert.throws(() => menu('Which items?', [rangeOption(1, 3, 'Select item(s)')]), /no row to press/);
  });

  it('a range row passes beside a single key — the ask still stands above the range', () => {
    const rows = [rangeOption(1, 3, 'Select item(s)'), cmdOption('b', 'back', 'Return to menu')];
    assert.match(menu('Which items?', rows), /◆ Which items\?/);
    assert.throws(() => menuFrame([rows[0], '', '**`◆ Which items?`**', '', rows[1]]), /no `◆ …\?` line stands above the rows/);
  });

  it('command and bare option builders make a row to press', () => {
    assert.match(menu('Which one?', [cmdOption('1', null, 'A'), promptOption('Ask', 'Ask about it')]), /◆ Which one\?/);
    assert.match(menu('Proceed?', [bareOption('y', 'yes'), bareOption('n', 'no')]), /◆ Proceed\?/);
  });

  it('aligns option arrows into one column, leaving non-option lines alone', () => {
    const out = menu('Which one?', ['**`c/continue`** → Carry on', '**`q`** → Quit', 'a plain line']);
    const lines = out.split('\n');
    const arrows = lines.filter((l) => l.includes(' → ')).map((l) => l.indexOf(' → '));
    assert.strictEqual(new Set(arrows).size, 1, 'arrows share a column');
    assert.ok(lines.includes('a plain line'), 'non-option lines pass through untouched');
  });

  // Every frame asks; its rows start three lines down, under the question.
  const ASK = ['Which one?', ''];

  it('wraps a long option label under the label column with NBSP continuations', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → ' + 'alpha '.repeat(12).trim(),
      '**`i/discovery`** → Continue discovery',
    ], { width: 40 });
    const lines = out.split('\n');
    // column = 11 (i/discovery) → label column 14; every rendered line ≤ 40.
    assert.strictEqual(lines[3], '**`1`**           → alpha alpha alpha alpha');
    assert.strictEqual(lines[4], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[5], `${NB(14)}alpha alpha alpha alpha`);
    assert.strictEqual(lines[6], '**`i/discovery`** → Continue discovery');
  });

  it('closes and reopens spans at a wrap break — every emitted line is self-contained markdown', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → Continue "Roles" — *implementation (Phase 5, Task roles-5-44)*',
      '**`i/discovery`** → Continue discovery',
    ], { width: 55 });
    const lines = out.split('\n');
    assert.strictEqual(lines[3], '**`1`**           → Continue "Roles" — *implementation (Phase*');
    assert.strictEqual(lines[4], `${NB(14)}*5, Task roles-5-44)*`);
  });

  it('an escaped marker is text, never a span — a break adds no closing marker', () => {
    const out = menuFrame([...ASK, '**`1`** → Fix 2\\*3 so every one of the pipeline stages agrees'], { width: 40 });
    const [first, ...continuations] = out.split('\n').slice(3);
    assert.ok(continuations.length > 0, 'the label wraps');
    for (const line of [first, ...continuations]) {
      assert.ok(!/(^|[^\\])\*$/.test(line), `no closing marker at the break: ${line}`);
    }
    for (const line of continuations) {
      assert.ok(!line.replace(/^ +/, '').startsWith('*'), `no reopened marker on the continuation: ${line}`);
    }
  });

  it('a struck in-session row and a code span both survive the break balanced', () => {
    const struck = menuFrame([
      ...ASK,
      '**`1`** → ~~Continue "Topic" — *discussion*~~ · in session (last active 2m ago)',
    ], { width: 55 });
    // the ~~…~~ closes before the break here; each line carries balanced markers
    for (const line of struck.split('\n')) {
      assert.strictEqual((line.match(/~~/g) || []).length % 2, 0, line);
    }
    const code = menuFrame([
      ...ASK,
      '**`1`** → Run `one two three four five six seven` now',
    ], { width: 40 });
    const codeLines = code.split('\n');
    assert.ok(codeLines[3].endsWith('`'), 'code span closes at the break');
    assert.ok(codeLines[4].startsWith(NB(4) + '`'), 'and reopens on the continuation');
  });

  it('an escaped marker is the character it escapes — it opens no span for a break to close', () => {
    const out = menuFrame([...ASK, '**`1`** → Fix \\*auth tokens across every service\\* now'], { width: 40 });
    const lines = out.split('\n');
    assert.strictEqual(lines[3], '**`1`** → Fix \\*auth tokens across every');
    assert.strictEqual(lines[4], `${NB(4)}service\\* now`);
  });

  it('keeps the line whole when the label budget falls below the floor', () => {
    const out = menuFrame([
      ...ASK,
      '**`x/extraordinarily-wide-key-column`** → Continue',
      '**`1`** → A long label that would wrap at any sane width but must stay whole here',
    ], { width: 40 });
    assert.ok(!out.includes(NB(1)), 'no continuation lines at a degenerate budget');
  });

  it('leaves a single oversized token whole rather than splitting markup', () => {
    const out = menuFrame([
      ...ASK,
      '**`1`** → See supercalifragilistic-hyphenated-identifier-that-cannot-fit for details',
    ], { width: 40 });
    const lines = out.split('\n');
    assert.strictEqual(lines[4], `${NB(4)}supercalifragilistic-hyphenated-identifier-that-cannot-fit`);
    assert.strictEqual(lines[5], `${NB(4)}for details`);
  });

  it('section wraps body in a named, instruction-carrying marker and strips trailing newlines', () => {
    assert.strictEqual(section('MENU: x', 'emit verbatim', 'body\n\n'), '=== MENU: x (emit verbatim) ===\nbody\n');
  });

  it('callout flags the first line and aligns continuations', () => {
    assert.strictEqual(callout(['first line', 'second line']), '  ⚑ first line\n    second line');
  });

  it('menuFrame opens its lines with the canonical rule and does not close them', () => {
    assert.strictEqual(menuFrame(['Which one?', '', '**`b`** → B']), [DOTS, '**`◆ Which one?`**', '', '**`b`** → B'].join('\n'));
  });

  it('menuFrame glyphs only a leading short label — no blank beneath means no glyph, so no question', () => {
    assert.throws(() => menuFrame(['Which one?', '**`b`** → B']), /no `◆ …\?` line stands above the rows/);
  });

  it('callout wraps a string to the width with the flag gutter subtracted', () => {
    const out = callout('word '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('  ⚑ ') && lines[1].startsWith('    '));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('subDetail glyphs the first line and aligns continuations under the text', () => {
    const out = subDetail('alpha '.repeat(30).trim(), { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('   · alpha') && lines[1].startsWith('     alpha'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });

  it('treeList branches each item, gutters continuations, blanks under the last', () => {
    const out = treeList(['one '.repeat(12).trim(), 'two '.repeat(12).trim()], { width: 40 });
    const lines = out.split('\n');
    assert.ok(lines[0].startsWith('     ├─ one'));
    assert.ok(lines[1].startsWith('     │  one'), 'non-last continuation carries the gutter');
    const lastBranch = lines.findIndex((l) => l.startsWith('     └─ two'));
    assert.ok(lastBranch > 0);
    assert.ok(lines[lastBranch + 1].startsWith('        two'), 'last continuation is blank-guttered');
  });

  it('indentedBody wraps each paragraph two columns in; indent moves the column and the budget with it', () => {
    assert.deepStrictEqual(indentedBody(['short', 'lines'], { width: 40 }), ['  short', '  lines']);
    assert.deepStrictEqual(indentedBody(['x'.repeat(50)], { width: 40 }), [`  ${'x'.repeat(38)}`, `  ${'x'.repeat(12)}`], 'the default budget is the width less two columns');
    const deep = indentedBody(['beta '.repeat(20).trim()], { indent: '      ', width: 40 });
    assert.ok(deep.length > 1 && deep.every((l) => l.startsWith('      beta') && [...l].length <= 40));
  });

  it('bulletRow glyphs at the callout indent by default; indent shifts the glyph, continuations stay under the text', () => {
    assert.deepStrictEqual(bulletRow('short row', { width: 40 }), ['  • short row']);
    assert.deepStrictEqual(bulletRow('x'.repeat(50), { width: 40 }), [`  • ${'x'.repeat(36)}`, `    ${'x'.repeat(14)}`], 'the default budget reserves the indent and the glyph');
    const lines = bulletRow('gamma '.repeat(20).trim(), { indent: '    ', width: 40 });
    assert.ok(lines[0].startsWith('    • gamma') && lines[1].startsWith('      gamma'));
    assert.ok(lines.every((l) => [...l].length <= 40));
  });
});

describe('worklist shape', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { implementation: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  // Rendered width: escapes and code-span backticks are zero-width, `~~` is
  // consumed — byte length over-counts a correct row, so width properties
  // are asserted on the rendered measure, against the resolved width.
  const renderedLen = (line) => line.replace(/\\(.)/g, '$1').replace(/~~/g, '').replace(/`/g, '').length;
  const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');

  it('a tag that cannot fit the last title line drops to its own line at the title column', () => {
    const file = writePayload(dir, 't.json', { label: 'Cycle', tasks: [
      { title: 'The traceability matrix omits three acceptance criteria', severity: 'Important' },
    ] });
    const out = harness.output(dir, ['render', 'tasks-overview', 'pay.implementation.portal', '--file', file]);
    const body = out.split('===\n')[1].split('\n');
    assert.ok(body.some((l) => l === `${NB(5)}\`[Important]\``), `tag line missing: ${JSON.stringify(body)}`);
    for (const line of body) assert.ok(renderedLen(line) <= displayWidth(), `overflowing row: ${line}`);
  });

  it('every worklist surface holds the rendered width, tags and escapes included', () => {
    const long = 'Collapse the *duplicated* retry_budget into one constant shared by both callers';
    const width = displayWidth();
    const holdWidth = (out) => {
      // Rows, continuations, and notes hold the width; the header and a
      // batch intro are prose lines left to soft-wrap, so they are exempt.
      for (const line of out.split('===\n')[1].split('\n')) {
        if (!/^[○✓⊘\d ]/.test(line)) continue;
        assert.ok(renderedLen(line) <= width, `overflowing row: ${line}`);
      }
    };
    holdWidth(harness.output(dir, ['render', 'tasks-overview', 'pay.implementation.portal', '--file', writePayload(dir, 'w.json', { label: 'Cycle', tasks: [
      { title: long, severity: 'Important' },
      { title: 'Short', severity: 'low' },
    ] })]));
    writeManifest(dir, 'wu3', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    holdWidth(harness.output(dir, ['render', 'findings-summary', 'wu3.planning.portal', '--file', writePayload(dir, 'w2.json', { review_label: 'Integrity Review', items: [
      { title: long, tag: 'Important', summary: 'A summary long enough to wrap beneath the arrow and hold its hang.' },
    ] })]));
    holdWidth(harness.output(dir, ['render', 'finding-batch', 'wu3.discussion.checkout', '--file', writePayload(dir, 'w3.json', { lane: 'route', items: [
      { title: long, target: 'payments-reconciliation-storage', detail: 'Their subtopic owns the claim.' },
    ] })]));
  });

  it('the tag-fit boundary is exact — at budget it stays inline, one over it drops', () => {
    // Walked 1-digit head is 5 columns; budget 60 at width 65. Tag
    // `Important` costs 12 rendered (space + brackets + 9 letters). A
    // 48-char title fits inline at exactly the width; 49 forces the drop.
    const at = harness.output(dir, ['render', 'tasks-overview', 'pay.implementation.portal', '--file', writePayload(dir, 'fit.json', { label: 'C', tasks: [
      { title: 'x'.repeat(48), severity: 'Important' },
    ] })]);
    assert.ok(at.includes('x'.repeat(48) + ' `[Important]`'), `expected inline tag: ${at}`);
    const over = harness.output(dir, ['render', 'tasks-overview', 'pay.implementation.portal', '--file', writePayload(dir, 'over.json', { label: 'C', tasks: [
      { title: 'x'.repeat(49), severity: 'Important' },
    ] })]);
    assert.ok(over.includes(`${NB(5)}\`[Important]\``), `expected dropped tag: ${over}`);
    assert.ok(!over.includes('x `[Important]`'), 'tag not inline past the boundary');
  });

  it('rows pad 10+ numbering with NBSP, never a leading space', () => {
    writeManifest(dir, 'wu2', { phases: { planning: { items: { portal: { status: 'in-progress' } } }, discussion: { items: { checkout: { status: 'in-progress' } } } } });
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `Item ${i + 1}`, tag: 'low', summary: `Detail ${i + 1}` }));
    const out = harness.output(dir, ['render', 'findings-summary', 'wu2.planning.portal', '--file', writePayload(dir, 'b.json', { review_label: 'Rev', items })]);
    assert.ok(out.includes(`○ ${NB(1)}1. Item 1`), 'single-digit row pads with NBSP');
    assert.ok(out.includes('○ 11. Item 11'), 'two-digit row unpadded');
    // Batch rows are capped below padding range, but the leading column must
    // still never open on a real space — a markdown renderer would strip it.
    const batch = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i + 1}`, detail: `Detail ${i + 1}` }));
    const bout = harness.output(dir, ['render', 'finding-batch', 'wu2.discussion.checkout', '--file', writePayload(dir, 'b2.json', { lane: 'apply', items: batch })]);
    assert.ok(bout.includes('1\\. Item 1'), 'unglyphed row opens on its number');
    for (const line of [...out.split('\n'), ...bout.split('\n')]) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('escapes markdown-active characters in the label, title, and note', () => {
    const file = writePayload(dir, 'e.json', {
      review_label: 'Rev *2* [beta]',
      items: [{ title: 'Escape <script> and ~tilde~', tag: 'low', summary: 'see foo_bar and [link] and \\slash' }],
    });
    writeManifest(dir, 'pay2', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const out = harness.output(dir, ['render', 'findings-summary', 'pay2.planning.portal', '--file', file]);
    assert.ok(out.includes('**Rev \\*2\\* \\[beta\\]**'), 'label escaped');
    assert.ok(out.includes('Escape \\<script\\> and \\~tilde\\~'), 'title escaped, angle brackets included');
    assert.ok(out.includes('↳ see foo\\_bar and \\[link\\] and \\\\slash'), 'note escaped');
  });

  it('a wrapped note hangs its continuation two columns past the arrow', () => {
    writeManifest(dir, 'pay3', { phases: { planning: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', {
      review_label: 'Rev',
      items: [{ title: 'T', tag: 'low', summary: 'This note is deliberately long enough that the wrap point lands inside it and produces a continuation line beneath the arrow.' }],
    });
    const out = harness.output(dir, ['render', 'findings-summary', 'pay3.planning.portal', '--file', file]);
    const lines = out.split('\n');
    const noteAt = lines.findIndex((l) => l.includes('↳ '));
    assert.ok(noteAt > 0, 'note rendered');
    assert.ok(lines[noteAt].startsWith(`${NB(7)}↳ `), 'note at title column + 2');
    assert.ok(lines[noteAt + 1].startsWith(NB(9)), 'continuation hangs past the arrow');
  });

  it('worklist fails loudly on shape errors its callers cannot reach', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    assert.throws(() => worklist({ items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ heading: { label: 'H', noun: 'x' }, intro: 'I', items: [{ title: 'x' }] }), /exactly one of "heading"\/"intro"/);
    assert.throws(() => worklist({ intro: 'I', items: [] }), /"items" must be a non-empty array/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', state: 'banana' }] }), /unknown state "banana"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'has`tick' }] }), /a tag must not contain backticks/);
    assert.throws(() => worklist({ intro: 'I', items: [{ detail: 'no title' }] }), /item 1 needs a non-empty string "title"/);
    assert.throws(() => worklist({ intro: 'I', items: [{ title: 'x', tag: 'y'.repeat(70) }] }), /cannot fit the display width/);
  });

  it('walked rows pad 10+ numbering with NBSP too', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items, walked: true });
    assert.ok(out.includes(`○ ${NB(1)}1. T1`), `walked pad is NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('○ 11. T11'), 'two-digit walked row unpadded');
  });

  it('unglyphed rows pad 10+ numbering with a leading NBSP, never a space', () => {
    // No production surface reaches an unglyphed list past the batch cap;
    // the mechanism is pinned directly so an uncapped future caller
    // inherits it working.
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const items = Array.from({ length: 11 }, (_, i) => ({ title: `T${i + 1}` }));
    const out = worklist({ intro: 'I', items });
    assert.ok(out.includes(`${NB(1)}1\\. T1`), `unglyphed pad is a leading NBSP: ${out.split('\n')[2]}`);
    assert.ok(out.includes('11\\. T11'), 'two-digit unglyphed row unpadded');
    for (const line of out.split('\n')) {
      assert.ok(!/^ /.test(line), `line leads with a real space: ${JSON.stringify(line)}`);
    }
  });

  it('an unwalked heading never counts remaining', () => {
    const { worklist } = require('../../skills/workflow-engine/scripts/domain/projections/worklist.cjs');
    const out = worklist({ heading: { label: 'H', noun: 'item' }, items: [{ title: 'a', state: 'approved' }, { title: 'b' }] });
    assert.ok(out.startsWith('**H** — 2 items\n'), `unexpected header: ${out.split('\n')[0]}`);
  });
});

describe('CLI boundary — engine render through the argv entry', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: {
        discussion: { items: { pay: { status: 'in-progress' } } },
        planning: { items: { pay: { status: 'in-progress', task_list_gate_mode: 'auto' } } },
        specification: { items: { pay: { status: 'superseded', superseded_by: 'core' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  const run = (/** @type {string[]} */ args) => harness.output(dir, ['render', ...args]);

  it('flags survive argv: --mail, --variant, --approve, --gate, scalar flags', () => {
    assert.ok(run(['resume-gate', 'pay.discussion.pay', '--mail', '2']).includes('2 message(s)'));
    const tl = writePayload(dir, 'tl.json', { phase: 1, phase_name: 'X', tasks: [{ name: 'A', summary: 's' }] });
    assert.ok(run(['task-list', 'pay.planning.pay', '--file', tl, '--variant', 'existing']).includes('task list confirmed'));
    const pt = writePayload(dir, 'pt.json', { phases: [{ name: 'P' }] });
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--file', pt, '--approve']).includes('MENU: phase structure gate'));
    assert.ok(run(['phase-tree', 'pay.planning.pay', '--menu-only']).startsWith('=== MENU: phase structure gate'));
    const task = writePayload(dir, 'task.json', { current: 1, total: 1, title: 'T', severity: 'Minor', sources: 's', problem: 'p', solution: 's', outcome: 'o', steps: ['1'], criteria: ['c'] });
    assert.ok(run(['proposed-task', 'pay.planning.pay', '--file', task, '--gate', 'auto']).includes('approved [auto]'));
    const detail = writePayload(dir, 'at.json', { content: 'The task.' });
    assert.ok(run(['author-task-gate', 'pay.planning.pay', '--m', '1', '--total', '2', '--title', 'T', '--file', detail]).includes('**Task 1 of 2: T**'));
    const gate = run(['next-phase-gate', 'pay', '--prev', 'implementation', '--next', 'review']);
    assert.ok(gate.includes('Implementation completed for "Pay".') && gate.includes('Complete without review'), gate);
    assert.ok(run(['phase-completed', 'pay', '--phase', 'discussion']).includes('Discussion completed for "Pay".'));
    assert.ok(run(['phase-paused', 'pay', '--phase', 'discussion']).includes('Discussion paused for "Pay".'));
    assert.ok(run(['epic-all-done-gate', 'pay']).includes('Mark this epic as completed'));
    assert.ok(run(['entry-gate', 'pay.specification.pay', '--own']).includes('was consolidated into'),
      '--own must survive boolean-flag registration through argv');
    assert.ok(run(['phase-completed', 'pay', '--phase', 'scoping', '--paths']).includes(`  Spec: ${dir}/.leeway/pay/specification/pay/specification.md`),
      '--paths must survive boolean-flag registration through argv');
  });

  it('surface errors surface as failJson on stderr with exit 1', () => {
    assert.match(harness.refuses(dir, ['render', 'proposed-task', 'pay.planning.pay', '--file', 'missing.json', '--gate', 'nope']).error,
      /--gate must be "gated" or "auto"/);
  });
});

describe('catalogue dispatch', () => {
  it('the CLI usage banner lists every registered surface', () => {
    // A surface reachable from the catalogue but absent from the banner is
    // invisible to anyone who mistypes a command — the way finding-batch was.
    let catalogue;
    try {
      renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' });
    } catch (err) {
      catalogue = String(err.message).match(/surfaces: ([^)]+)\)/)[1].split(', ');
    }
    const engineSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts', 'engine.cjs'), 'utf8');
    const banner = [...engineSrc.matchAll(/^ {2}render (\S+)/gm)].map((m) => m[1]);
    const missing = catalogue.filter((n) => !banner.includes(n));
    assert.deepStrictEqual(missing, [], `surfaces missing from the usage banner: ${missing.join(', ')}`);
  });

  it('unknown surface errors with the catalogue listing', () => {
    assert.throws(() => renderSurface('/tmp', 'nope', { dotpath: 'a.b.c' }), /unknown surface "nope" \(surfaces: resume-gate, task-list, plan-progress, findings-summary, finding-announce, finding-batch, finding, review-presentation, review-gate, spec-review-gate, spec-completion-gate, convergence-diagnostic, carry-note-gate, hypothesis-board, findings-signoff-gate, fix-direction, validation-gate, validation-report, project-skills, linters, mail-announce, mail-offer, mail-block, forward-offer, send-offer, research-threads, research-conclude-gate, deep-dive-offer, perspective-offer, in-flight-agents-gate, review-findings-gate, send-candidates, off-topic-offer, backlog-gate, map-op-gate, candidate-gate, dismissed-topics, send-closed-target, conclude-gate, closing-gate, defer-gate, experiment-register, experiment-approval-gate, experiment-pick, experiment-next-gate, experiment-spawn-gate, wait-gate, summary-backfill-gate, external-dependency-gate, checkpoint-files-gate, change-set-tree, executor-block-gate, dependency-approval-gate, task-count-gate, plan-context-gate, cross-cutting-gate, cross-cutting-references, plan-format-gate, plan-review-gate, scoping-questions, complexity-gate, first-phase-gate, correction-gate, analysis-proceed-gate, spec-confirm-gate, proposed-task, incoherence-gate, resurface-gate, construction-gate, tasks-overview, author-task-gate, phase-tree, phase-completed, phase-paused, phase-note, step-opening, format-version-check, entry-gate, direct-entry-gate, code-gate, next-phase-gate, cancel-gate, postpone-gate, epic-all-done-gate, epic-soft-gate, task-brief, task-result, task-gate, fix-gate, blocked-tasks, cycle-limit, cycle-gate, workunit-receipt, topic-receipt, absorb-summary, absorb-receipt, absorb-continuation, promote-receipt, import-reprompt, pivot-continuation, session-receipt, absorb-target, absorb-confirm-gate, plan-topics, plan-summary, archived-actions, archived-delete-gate, inbox-content, inbox-restore-receipt, inbox-delete-receipt, completed-actions, revisit-phases, roadmap-view, roadmap-add-gate, horizon-pick, park-gate, inbox-roadmap-gate, roadmap-session-receipt, roadmap-harvest-gate, roadmap-parks-gate, roadmap-shape-gate, shape-gate, opener, synthesis-gate, query-failure-gate, baseline-progress, baseline-area-gate, baseline-paused, baseline-receipt, baseline-scope-gate, baseline-area, baseline-round, baseline-doc-gate, baseline-manage-gate, baseline-doc-pick, baseline-offer-gate, walkthrough-offer, walkthrough-screen, walkthrough-home, walkthrough-topics, walkthrough-topic, migrations-applied, migration-gate, state-lost-gate, github-rule-gate, label-gate, knowledge-gate, knowledge-ready, legacy-split-gate, legacy-split-display, state-merge-gate, ledger-stop\)/);
  });
});

describe('single-source invariants', () => {
  it('the menu dot rule literal exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && fs.readFileSync(p, 'utf8').includes('· · · · · · · · · · · ·')) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'menus must frame through surfaces.menuFrame — inline dot rules reintroduce the pre-consolidation drift class');
  });

  it('the option-line grammar exists in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs') && /\*\*\\?`[^`]+\\?`\*\* →/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    assert.deepStrictEqual(offenders, [path.join('domain', 'projections', 'surfaces.cjs')],
      'option lines must build through cmdOption/rangeOption — hand-formatted options reintroduce the drift class');
  });

  it('the render forms, the menu\'s stop and the continuation exist in exactly one module — surfaces.cjs', () => {
    const scriptsRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'scripts');
    const { RENDER_FORMS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
    const phrases = ['emit verbatim as', ...Object.values(RENDER_FORMS), "then STOP for the user's response", 'do not stop; continue as the workflow instructs'];
    /** @type {Record<string, string[]>} */
    const homes = Object.fromEntries(phrases.map((phrase) => [phrase, []]));
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.endsWith('.cjs')) {
          const src = fs.readFileSync(p, 'utf8');
          for (const phrase of phrases) if (src.includes(phrase)) homes[phrase].push(path.relative(scriptsRoot, p));
        }
      }
    })(scriptsRoot);
    const surfaces = [path.join('domain', 'projections', 'surfaces.cjs')];
    assert.deepStrictEqual(homes, Object.fromEntries(phrases.map((phrase) => [phrase, surfaces])),
      'a marker instruction is composed from surfaces.cjs (emitAs, timedInstruction, MENU_INSTRUCTION, the clauses) — a second literal drifts on the next reword');
  });

  // No equivalent invariant for the ⚑ callout: the glyph legitimately appears
  // in inline one-line display headers (arrivals lines, not-ready blocks), so
  // a content grep cannot isolate the wrapped-callout idiom without false
  // positives. Single-sourcing there is enforced structurally — flaggedCallout
  // delegates to surfaces.callout — and guarded by review.

  it('every drawn walkthrough diagram fits the pinned width — an untagged fence cannot re-flow (D8)', () => {
    const contentRoot = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'walkthrough');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        if (!entry.isFile() || !p.endsWith('.md')) continue;
        // A tagged fence is notation, not a drawing: the engine lays it out
        // at the pane's width, and its own suite drives it at the floor and
        // the cap. Only what emits as drawn is measured here.
        let fence = null;
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (line.startsWith('```')) { fence = fence === null ? line.slice(3).trim() : null; return; }
          // Characters, not bytes: the diagrams are drawn with arrows and
          // box-drawing glyphs, each of which is several bytes wide.
          if (fence === '' && [...line].length > 65) offenders.push(`${path.relative(contentRoot, p)}:${i + 1}`);
        });
      }
    })(contentRoot);
    assert.deepStrictEqual(offenders, [],
      'a fenced line renders as drawn — past the narrowest pane it wraps and the diagram breaks');
  });

  it('box-glyph frames are retired everywhere — drawn borders never frame content', () => {
    const skillsRoot = path.join(__dirname, '..', '..', 'skills');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && (p.endsWith('.cjs') || p.endsWith('.md')) && /[╭╰]/.test(fs.readFileSync(p, 'utf8'))) {
          offenders.push(path.relative(skillsRoot, p));
        }
      }
    })(skillsRoot);
    assert.deepStrictEqual(offenders, [],
      'drawn borders never frame content — a box glyph reintroduces a fixed-width commitment the terminal cannot honour');
  });
});
