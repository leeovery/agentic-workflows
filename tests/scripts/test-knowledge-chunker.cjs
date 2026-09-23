'use strict';

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { chunk, MAX_TOKEN_LENGTH, MAX_CHUNK_CHARS } = require('../../src/knowledge/chunker.js');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'knowledge');
const CHUNKING_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'skills',
  'workflow-knowledge',
  'chunking'
);

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

function loadConfig(phase) {
  return JSON.parse(
    fs.readFileSync(path.join(CHUNKING_DIR, phase + '.json'), 'utf8')
  );
}

/**
 * Strip the opening YAML frontmatter block from a string so fixture tests
 * can compare chunk content against the post-frontmatter source. This
 * mirrors the chunker's own frontmatter stripping logic.
 */
function stripFrontmatter(markdown) {
  const lines = markdown.split('\n');
  if (!/^---\s*$/.test(lines[0] || '')) return markdown;
  for (let i = 1; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) {
      return lines.slice(i + 1).join('\n').replace(/^\n+/, '');
    }
  }
  return '';
}

// Default config — mirrors the shared phase defaults. Tests override fields
// as needed to target a specific behaviour. keep_whole_below is set low
// except in tests that specifically exercise the whole-file gate.
function baseConfig(overrides = {}) {
  return {
    phase: 'test',
    confidence: 'low',
    strategy: 'split-on-heading',
    primary_level: 2,
    fallback_level: 3,
    keep_whole_below: 0, // disable whole-file gate by default
    special_sections: {},
    strip_frontmatter: true,
    skip_empty_sections: true,
    ...overrides,
  };
}

describe('knowledge chunker', () => {
  it('splits markdown on H2 headings', () => {
    const md = [
      '# Title',
      '',
      'intro paragraph under the title',
      '',
      '## Section A',
      'body a',
      '',
      '## Section B',
      'body b',
      '',
      '## Section C',
      'body c',
      '',
    ].join('\n');
    const result = chunk(md, baseConfig());
    // H1-with-intro chunk + 3 H2 chunks.
    assert.strictEqual(result.length, 4);
    assert.match(result[0].content, /# Title/);
    assert.match(result[0].content, /intro paragraph/);
    assert.match(result[1].content, /## Section A/);
    assert.match(result[2].content, /## Section B/);
    assert.match(result[3].content, /## Section C/);
  });

  it('returns { content } objects, not bare strings', () => {
    const md = '## A\nbody a\n\n## B\nbody b';
    const result = chunk(md, baseConfig());
    for (const c of result) {
      assert.strictEqual(typeof c, 'object');
      assert.strictEqual(typeof c.content, 'string');
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(c, 'content'),
        true
      );
    }
  });

  it('includes heading text in each chunk content (semantic anchor)', () => {
    const md = '## Alpha\napple\n\n## Beta\nbanana';
    const result = chunk(md, baseConfig());
    assert.match(result[0].content, /## Alpha/);
    assert.match(result[0].content, /apple/);
    assert.match(result[1].content, /## Beta/);
    assert.match(result[1].content, /banana/);
  });

  it('splits an over-budget H2 at H3 and recurses into an over-budget H3', () => {
    const para = (tag) => tag + ' ' + 'x'.repeat(900);
    const md = [
      '## Big',
      'intro line',
      '',
      '### Small',
      para('small body'),
      '',
      '### Huge',
      'huge intro',
      '',
      '#### Deep A',
      ...Array.from({ length: 10 }, (_, i) => para('deep-a ' + i)),
      '',
      '#### Deep B',
      ...Array.from({ length: 10 }, (_, i) => para('deep-b ' + i)),
    ].join('\n');
    const result = chunk(md, baseConfig());
    const openers = result.map((c) => c.content.split('\n')[0]);
    assert.deepStrictEqual(openers, ['## Big', '### Small', '### Huge', '#### Deep A', '#### Deep B']);
    assert.match(result[0].content, /intro line/);
    assert.match(result[2].content, /huge intro/);
    for (const c of result) assert.ok(c.content.length <= MAX_CHUNK_CHARS);
  });

  it('keeps a section under the budget whole, however many lines it runs to', () => {
    const lines = ['## Long'];
    for (let j = 0; j < 400; j += 1) lines.push('body ' + j);
    lines.push('### Sub', 'sub body');
    const result = chunk(lines.join('\n'), baseConfig());
    assert.strictEqual(result.length, 1);
    assert.match(result[0].content, /body 399/);
    assert.match(result[0].content, /### Sub/);
  });

  it('falls back to H3 when no H2 headings exist', () => {
    const md = [
      '# Title',
      '',
      '### Sub A',
      'body a',
      '',
      '### Sub B',
      'body b',
    ].join('\n');
    const result = chunk(md, baseConfig());
    // Two H3 sections (the H1 + pre-first-H3 content may also form a chunk
    // with just the title — depends on content presence).
    const h3 = result.filter((c) => /^### Sub/.test(c.content.trimStart()));
    assert.strictEqual(h3.length, 2);
  });

  it('returns whole file when no headings at any configured level', () => {
    const md = 'just some text\n\nwith paragraphs\n\nand nothing else\n';
    // Use enough lines to bypass keep_whole_below = 0 by default, but this
    // hits the missing-headings fallback anyway.
    const result = chunk(md, baseConfig());
    assert.strictEqual(result.length, 1);
    assert.match(result[0].content, /just some text/);
    assert.match(result[0].content, /and nothing else/);
  });

  it('returns whole file when content is below keep_whole_below, bypassing heading parsing', () => {
    // This markdown has H2 headings that would normally split, but the
    // whole-file gate fires first and returns a single chunk.
    const md = [
      '## A',
      'body a',
      '## B',
      'body b',
    ].join('\n');
    const result = chunk(md, baseConfig({ keep_whole_below: 50 }));
    assert.strictEqual(result.length, 1);
    assert.match(result[0].content, /## A/);
    assert.match(result[0].content, /## B/);
  });

  it('strips YAML frontmatter', () => {
    const md = [
      '---',
      'title: something',
      'tag: foo',
      '---',
      '',
      '## Section',
      'body',
    ].join('\n');
    const result = chunk(md, baseConfig());
    for (const c of result) {
      assert.doesNotMatch(c.content, /title: something/);
      assert.doesNotMatch(c.content, /tag: foo/);
    }
    assert.strictEqual(result.length, 1);
  });

  it('skips empty sections', () => {
    const md = [
      '## Empty',
      '',
      '## With Body',
      'real content',
    ].join('\n');
    const result = chunk(md, baseConfig());
    assert.strictEqual(result.length, 1);
    assert.match(result[0].content, /## With Body/);
  });

  it('handles own-chunk special sections', () => {
    const md = [
      '## Regular',
      'regular body',
      '',
      '## Discussion Map',
      'map body',
      '',
      '## Another',
      'another body',
    ].join('\n');
    const result = chunk(
      md,
      baseConfig({ special_sections: { 'Discussion Map': 'own-chunk' } })
    );
    assert.strictEqual(result.length, 3);
    const mapChunk = result.find((c) => /## Discussion Map/.test(c.content));
    assert.ok(mapChunk);
    assert.match(mapChunk.content, /map body/);
  });

  it('handles skip special sections', () => {
    const md = [
      '## Keep',
      'keep body',
      '',
      '## Drop',
      'drop body',
      '',
      '## AlsoKeep',
      'also keep body',
    ].join('\n');
    const result = chunk(
      md,
      baseConfig({ special_sections: { Drop: 'skip' } })
    );
    assert.strictEqual(result.length, 2);
    for (const c of result) {
      assert.doesNotMatch(c.content, /drop body/);
      assert.doesNotMatch(c.content, /## Drop/);
    }
  });

  it('handles merge-up special sections', () => {
    const md = [
      '## Parent',
      'parent body',
      '',
      '## Footnote',
      'footnote body',
      '',
      '## Next',
      'next body',
    ].join('\n');
    const result = chunk(
      md,
      baseConfig({ special_sections: { Footnote: 'merge-up' } })
    );
    assert.strictEqual(result.length, 2);
    const parent = result[0];
    assert.match(parent.content, /## Parent/);
    assert.match(parent.content, /parent body/);
    assert.match(parent.content, /## Footnote/);
    assert.match(parent.content, /footnote body/);
    // No standalone Footnote chunk.
    assert.strictEqual(
      result.filter((c) => /^## Footnote/.test(c.content.trimStart())).length,
      0
    );
  });

  it('handles merge-up on the first section (promotes to its own chunk)', () => {
    const md = [
      '## Footnote',
      'footnote body',
      '',
      '## Parent',
      'parent body',
    ].join('\n');
    const result = chunk(
      md,
      baseConfig({ special_sections: { Footnote: 'merge-up' } })
    );
    assert.strictEqual(result.length, 2);
    assert.match(result[0].content, /## Footnote/);
    assert.match(result[0].content, /footnote body/);
    assert.match(result[1].content, /## Parent/);
  });

  it('treats H1 + pre-H2 content as the first chunk', () => {
    const md = [
      '# Document Title',
      '',
      'Intro paragraph describing the doc.',
      '',
      '## Section',
      'section body',
    ].join('\n');
    const result = chunk(md, baseConfig());
    assert.strictEqual(result.length, 2);
    assert.match(result[0].content, /# Document Title/);
    assert.match(result[0].content, /Intro paragraph/);
    assert.match(result[1].content, /## Section/);
  });

  it('ignores headings inside fenced code blocks (markdown parsing correctness)', () => {
    const md = [
      '## Real Section',
      '',
      '```',
      '## Not A Heading',
      '### Also Not',
      '```',
      '',
      'body text',
      '',
      '## Another Real Section',
      'more body',
    ].join('\n');
    const result = chunk(md, baseConfig());
    assert.strictEqual(result.length, 2);
    // The fake headings should be inside the first chunk as fenced content.
    assert.match(result[0].content, /## Not A Heading/);
    assert.match(result[0].content, /body text/);
    assert.match(result[1].content, /## Another Real Section/);
  });

  it('handles file with only frontmatter and no content (empty result)', () => {
    const md = ['---', 'title: empty', '---', ''].join('\n');
    const result = chunk(md, baseConfig());
    assert.deepStrictEqual(result, []);
  });

  it('handles markdown with no headings at all (missing-headings fallback)', () => {
    // Above keep_whole_below to prove we take the fallback path.
    const lines = [];
    for (let i = 0; i < 60; i += 1) lines.push('paragraph line ' + i);
    const md = lines.join('\n');
    const result = chunk(md, baseConfig({ keep_whole_below: 50 }));
    assert.strictEqual(result.length, 1);
    assert.match(result[0].content, /paragraph line 0/);
    assert.match(result[0].content, /paragraph line 59/);
  });

  it('only strips the opening frontmatter block, not later --- horizontal rules', () => {
    const md = [
      '---',
      'title: foo',
      '---',
      '',
      '## Section',
      'body',
      '',
      '---',
      '',
      'more body',
    ].join('\n');
    const result = chunk(md, baseConfig());
    const all = result.map((c) => c.content).join('\n');
    assert.doesNotMatch(all, /title: foo/);
    assert.match(all, /---/); // horizontal rule preserved
    assert.match(all, /more body/);
  });

  it('handles very large files correctly', () => {
    const lines = [];
    for (let s = 0; s < 10; s += 1) {
      lines.push('## Section ' + s);
      for (let j = 0; j < 100; j += 1) lines.push('body ' + s + '-' + j);
      lines.push('');
    }
    const md = lines.join('\n');
    const result = chunk(md, baseConfig());
    assert.strictEqual(result.length, 10);
  });

  it('exports a 16000-character budget', () => {
    assert.strictEqual(MAX_CHUNK_CHARS, 16000);
  });
});

// ---------------------------------------------------------------------------
// Character budget — every chunk fits, whatever the shape of the source
// ---------------------------------------------------------------------------

describe('knowledge chunker — character budget', () => {
  const discussion = loadConfig('discussion');
  const research = loadConfig('research');

  // A paragraph of `size` characters of words on one line, tagged so order
  // and survival can be checked.
  function paragraph(tag, size) {
    const words = 'lorem ipsum dolor sit amet ';
    return (tag + ' ' + words.repeat(Math.ceil(size / words.length))).slice(0, size).trimEnd();
  }

  // Budget, verbatim, and no loss: every chunk fits, every chunk is a slice
  // of the source, and the chunks carry all of the source's non-whitespace
  // content in order.
  function assertFaithful(chunks, source) {
    const body = stripFrontmatter(source);
    for (const c of chunks) {
      assert.ok(c.content.length <= MAX_CHUNK_CHARS, 'chunk of ' + c.content.length + ' chars exceeds the budget');
      assert.ok(body.includes(c.content), 'chunk is not a verbatim slice of the source');
    }
    const squash = (s) => s.replace(/\s+/g, '');
    assert.ok(squash(chunks.map((c) => c.content).join('')) === squash(body), 'the chunks lost or reordered source content');
  }

  it('splits an over-budget own-chunk Summary into paragraph groups, packed up to the budget', () => {
    const paras = Array.from({ length: 40 }, (_, i) => paragraph('summary-' + i, 1500));
    const src = ['# Topic', '', 'Intro.', '', '## Context', '', 'Some context.', '', '## Summary', '', paras.join('\n\n'), ''].join('\n');
    const chunks = chunk(src, discussion);
    const summary = chunks.filter((c) => c.content.includes('summary-'));
    assert.ok(summary.length >= 4, 'expected the Summary split into several groups');
    assert.ok(summary[0].content.startsWith('## Summary'), 'the first group carries the heading');
    assert.ok(summary.every((c) => c.content.length > MAX_CHUNK_CHARS - 1600), 'groups are packed, not one paragraph each');
    assertFaithful(chunks, src);
  });

  it('keeps an own-chunk Summary under the budget as one chunk', () => {
    const paras = Array.from({ length: 5 }, (_, i) => paragraph('summary-' + i, 1500));
    const context = Array.from({ length: 60 }, (_, i) => 'context line ' + i).join('\n');
    const src = ['## Context', '', context, '', '## Summary', '', paras.join('\n\n'), ''].join('\n');
    const chunks = chunk(src, discussion);
    const summary = chunks.filter((c) => c.content.startsWith('## Summary'));
    assert.strictEqual(summary.length, 1);
    assert.match(summary[0].content, /summary-4/);
  });

  it('recurses through H3, H4 and H5 until each piece fits', () => {
    const block = (tag, count) => Array.from({ length: count }, (_, i) => paragraph(tag + '-' + i, 1000)).join('\n\n');
    const src = [
      '## Deep',
      '',
      block('intro', 2),
      '',
      '### Level 3',
      '',
      block('l3', 3),
      '',
      '#### Level 4',
      '',
      block('l4', 3),
      '',
      '##### Level 5a',
      '',
      block('l5a', 12),
      '',
      '##### Level 5b',
      '',
      block('l5b', 12),
      '',
      '### Sibling 3',
      '',
      block('s3', 3),
      '',
    ].join('\n');
    const chunks = chunk(src, research);
    const openers = chunks.map((c) => c.content.split('\n')[0]);
    assert.deepStrictEqual(openers, ['## Deep', '### Level 3', '#### Level 4', '##### Level 5a', '##### Level 5b', '### Sibling 3']);
    assertFaithful(chunks, src);
  });

  it('packs one giant paragraph by lines', () => {
    const lines = Array.from({ length: 600 }, (_, i) => 'line ' + i + ' ' + 'z'.repeat(80));
    const src = ['## Wall', lines.join('\n'), ''].join('\n');
    const chunks = chunk(src, research);
    assert.ok(chunks.length >= 3);
    assert.ok(chunks[0].content.startsWith('## Wall'));
    assertFaithful(chunks, src);
  });

  it('splits a fenced block only when the fence alone exceeds the budget', () => {
    const code = Array.from({ length: 900 }, (_, i) => '  statement(' + i + ');' + ' '.repeat(2) + '// ' + 'c'.repeat(20)).join('\n');
    const src = ['## Code', '', 'Before the fence.', '', '```js', code, '```', '', 'After the fence.', ''].join('\n');
    const chunks = chunk(src, research);
    assert.ok(chunks.length >= 3, 'the over-budget fence is split');
    assertFaithful(chunks, src);
  });

  it('never splits inside a fence that fits the budget, blank lines inside it included', () => {
    const fenceBody = Array.from({ length: 40 }, (_, i) => (i % 5 === 4 ? '' : 'fenced ' + i + ' ' + 'f'.repeat(100))).join('\n');
    const fence = ['```', fenceBody, '```'].join('\n');
    const before = Array.from({ length: 10 }, (_, i) => paragraph('before-' + i, 1200)).join('\n\n');
    const after = Array.from({ length: 10 }, (_, i) => paragraph('after-' + i, 1200)).join('\n\n');
    const src = ['## Mixed', '', before, '', fence, '', after, ''].join('\n');
    const chunks = chunk(src, research);
    const holding = chunks.filter((c) => c.content.includes('fenced '));
    assert.strictEqual(holding.length, 1, 'the fence lands whole in one chunk');
    assert.ok(holding[0].content.includes(fence));
    assertFaithful(chunks, src);
  });

  it('slices a single line longer than the budget', () => {
    const giant = Array.from({ length: 5000 }, (_, i) => 'word' + i).join(' ');
    assert.ok(giant.length > MAX_CHUNK_CHARS * 2);
    const src = ['## One Line', '', giant, ''].join('\n');
    const chunks = chunk(src, research);
    assert.ok(chunks.length >= 3);
    assertFaithful(chunks, src);
  });

  it('splits a file under keep_whole_below lines when it is over the budget', () => {
    const src = Array.from({ length: 10 }, (_, i) => paragraph('short-file-' + i, 5000)).join('\n\n');
    assert.ok(src.split('\n').length < research.keep_whole_below);
    const chunks = chunk(src, research);
    assert.ok(chunks.length >= 4);
    assertFaithful(chunks, src);
  });

  it('keeps a file under keep_whole_below lines and under the budget as one chunk', () => {
    const src = ['## A', 'body a', '', '## B', 'body b'].join('\n');
    const chunks = chunk(src, research);
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].content, src);
  });

  it('holds the budget and the verbatim slice across every real fixture', () => {
    for (const [fixture, phase] of [
      ['discussion-fixture.md', 'discussion'],
      ['spec-folio-fixture.md', 'specification'],
      ['spec-deep-nested-fixture.md', 'specification'],
      ['specification-fixture.md', 'specification'],
      ['research-oversized-h3-fixture.md', 'research'],
    ]) {
      const src = loadFixture(fixture);
      const chunks = chunk(src, loadConfig(phase));
      for (const c of chunks) {
        assert.ok(c.content.length <= MAX_CHUNK_CHARS, fixture);
        assert.ok(stripFrontmatter(src).includes(c.content), fixture);
      }
    }
  });
});

describe('phase chunking configs', () => {
  const path = require('path');
  const fs = require('fs');

  const chunkingDir = path.resolve(
    __dirname,
    '..',
    '..',
    'skills',
    'workflow-knowledge',
    'chunking'
  );

  // Every indexable phase ships a validated config — driven from the source
  // of truth so a new phase cannot land without one.
  const { INDEXED_PHASES } = require('../../src/knowledge/index');
  const phases = INDEXED_PHASES;

  for (const phase of phases) {
    it('has a valid ' + phase + '.json config with required fields', () => {
      const file = path.join(chunkingDir, phase + '.json');
      assert.strictEqual(fs.existsSync(file), true, file + ' must exist');
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.strictEqual(cfg.phase, phase);
      assert.strictEqual(cfg.strategy, 'split-on-heading');
      assert.strictEqual(cfg.primary_level, 2);
      assert.strictEqual(cfg.fallback_level, 3);
      assert.strictEqual('max_lines' in cfg, false, 'the size gate is the chunker budget, not a config field');
      assert.strictEqual(cfg.keep_whole_below, 50);
      assert.strictEqual(cfg.strip_frontmatter, true);
      assert.strictEqual(cfg.skip_empty_sections, true);
      assert.strictEqual(typeof cfg.special_sections, 'object');
      assert.strictEqual(typeof cfg.confidence, 'string');
    });
  }

  it('discussion.json declares Discussion Map and Summary as own-chunk', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'discussion.json'), 'utf8')
    );
    assert.strictEqual(cfg.special_sections['Discussion Map'], 'own-chunk');
    assert.strictEqual(cfg.special_sections['Summary'], 'own-chunk');
  });

  it('specification.json declares Corrigenda as own-chunk — the only config that does', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'specification.json'), 'utf8')
    );
    assert.deepStrictEqual(cfg.special_sections, { Corrigenda: 'own-chunk' });
    for (const phase of ['research', 'discussion', 'investigation', 'imports', 'analysis', 'seeds', 'discovery']) {
      const other = JSON.parse(
        fs.readFileSync(path.join(chunkingDir, phase + '.json'), 'utf8')
      );
      assert.strictEqual(other.special_sections['Corrigenda'], undefined, phase);
    }
  });

  it('non-discussion, non-specification configs have empty special_sections', () => {
    for (const phase of ['research', 'investigation', 'imports', 'analysis']) {
      const cfg = JSON.parse(
        fs.readFileSync(path.join(chunkingDir, phase + '.json'), 'utf8')
      );
      assert.deepStrictEqual(cfg.special_sections, {});
    }
  });

  it('a bottom Corrigenda section chunks in isolation — whole under the budget, split past it', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'specification.json'), 'utf8')
    );
    const entries = (count) => Array.from({ length: count }, (_, i) => [
      '### 2026-08-0' + ((i % 9) + 1) + ' — batch ' + i,
      '',
      '> **Corrigendum 2026-08-0' + ((i % 9) + 1) + '** (from `other`): "claim ' + i + '" — corrected: truth ' + i + '.',
    ].join('\n')).join('\n');
    const spec = (count) => [
      '# Billing Specification',
      '',
      'Intro paragraph.',
      '',
      '## Scope',
      '',
      Array.from({ length: 60 }, (_, i) => 'scope line ' + (i + 1)).join('\n'),
      '',
      '## Corrigenda',
      '',
      entries(count),
      '',
    ].join('\n');

    const small = chunk(spec(70), cfg);
    const corrigenda = small.filter((c) => c.content.startsWith('## Corrigenda'));
    assert.strictEqual(corrigenda.length, 1, 'exactly one Corrigenda chunk');
    assert.ok(corrigenda[0].content.includes('claim 69'), 'the whole section in one chunk');
    assert.strictEqual(small.filter((c) => c.content.startsWith('### 2026')).length, 0);
    const intro = small.find((c) => c.content.startsWith('# Billing Specification'));
    assert.ok(intro && !intro.content.includes('Corrigendum'), 'title chunk free of corrigenda');

    const big = chunk(spec(400), cfg);
    assert.ok(big.filter((c) => c.content.startsWith('### 2026')).length > 1, 'an over-budget own-chunk splits');
    for (const c of big) assert.ok(c.content.length <= MAX_CHUNK_CHARS);
    assert.ok(big.some((c) => c.content.includes('claim 399')));
  });

  it('imports.json declares low confidence (matches research tier)', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'imports.json'), 'utf8')
    );
    assert.strictEqual(cfg.confidence, 'low');
  });

  it('imports config chunks a multi-section seed file into per-section chunks', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'imports.json'), 'utf8')
    );
    const src = [
      '# Seed Conversation',
      '',
      '## OAuth Notes',
      '',
      Array.from({ length: 60 }, (_, i) => 'oauth line ' + (i + 1)).join('\n'),
      '',
      '## Identity Strategy',
      '',
      Array.from({ length: 60 }, (_, i) => 'identity line ' + (i + 1)).join('\n'),
      '',
    ].join('\n');
    const chunks = chunk(src, cfg);
    assert.ok(chunks.length >= 2, 'expected at least one chunk per H2 section');
    const contents = chunks.map((c) => c.content);
    assert.ok(
      contents.some((c) => /## OAuth Notes/.test(c)),
      'expected an OAuth Notes chunk'
    );
    assert.ok(
      contents.some((c) => /## Identity Strategy/.test(c)),
      'expected an Identity Strategy chunk'
    );
  });

  it('analysis.json declares low confidence (analysis caches are surfacing aids, not source of truth)', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'analysis.json'), 'utf8')
    );
    assert.strictEqual(cfg.confidence, 'low');
  });

  it('analysis config preserves H3-section content under a single H2 (Topics)', () => {
    // Real analysis caches have one H2 (## Topics) with H3 subsections per theme.
    // The config's primary_level=2 keeps the Topics section whole when small;
    // assert chunks are emitted and the H3 content survives intact.
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'analysis.json'), 'utf8')
    );
    const src = [
      '# discovery-gap-analysis',
      '',
      '## Topics',
      '',
      '### Caching Layer',
      '',
      '- **Summary**: Recurring caching theme.',
      '- **Sources**: discussion/foo.md',
      '',
      '### Rate Limiting',
      '',
      '- **Summary**: Per-service vs edge gateway.',
      '- **Sources**: discussion/baz.md',
      '',
    ].join('\n');
    const chunks = chunk(src, cfg);
    assert.ok(chunks.length >= 1, 'expected at least one chunk emitted');
    const combined = chunks.map((c) => c.content).join('\n');
    assert.ok(/Caching Layer/.test(combined), 'expected Caching Layer content preserved');
    assert.ok(/Rate Limiting/.test(combined), 'expected Rate Limiting content preserved');
  });

  it('analysis config falls back to H3 splitting when the H2 section is over the budget', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(chunkingDir, 'analysis.json'), 'utf8')
    );
    const body = (tag) => Array.from({ length: 120 }, (_, i) => tag + ' line ' + (i + 1) + ' ' + 'y'.repeat(60)).join('\n');
    const src = [
      '# discovery-gap-analysis',
      '',
      '## Topics',
      '',
      '### Caching Layer',
      '',
      body('caching'),
      '',
      '### Rate Limiting',
      '',
      body('rate'),
      '',
    ].join('\n');
    const chunks = chunk(src, cfg);
    const openers = chunks.map((c) => c.content.split('\n')[0]);
    assert.ok(openers.includes('### Caching Layer'), 'expected a Caching Layer chunk');
    assert.ok(openers.includes('### Rate Limiting'), 'expected a Rate Limiting chunk');
  });
});

describe('knowledge chunker — real fixtures', () => {
  // Helper: every chunk's content must be a verbatim substring of the
  // source file (after frontmatter stripping). This is the content
  // preservation invariant from the design doc (no information loss,
  // line 74). We don't concatenate-and-compare because frontmatter,
  // skipped sections, and empty sections are legitimately dropped.
  function assertVerbatim(chunks, source) {
    const body = stripFrontmatter(source);
    for (const c of chunks) {
      assert.strictEqual(
        body.includes(c.content),
        true,
        'chunk content must appear verbatim in source:\n' +
          c.content.slice(0, 120) +
          (c.content.length > 120 ? '…' : '')
      );
    }
  }

  function assertWithinBudget(chunks) {
    for (const c of chunks) {
      assert.ok(
        c.content.length <= MAX_CHUNK_CHARS,
        'chunk exceeded the budget: ' + c.content.length + ' > ' + MAX_CHUNK_CHARS
      );
    }
  }

  it('chunks a research fixture into expected sections', () => {
    const src = loadFixture('research-fixture.md');
    const cfg = loadConfig('research');
    const chunks = chunk(src, cfg);

    // cc-tool-plan.md has 12 H2 sections plus an H1+intro chunk.
    // Expect at least the 12 H2s; intro chunk may be present depending
    // on whether the H1 section has body content.
    assert.ok(chunks.length >= 12, 'expected >= 12 chunks, got ' + chunks.length);

    const headingLines = chunks.map((c) => c.content.split('\n')[0]);
    for (const expected of [
      '## Vision',
      '## Core Concepts',
      '## CLI Interface',
      '## Configuration',
      '## Data Storage',
      '## Feature Details',
      '## Technical Architecture',
      '## Homebrew Distribution',
      '## Open Questions',
      '## Implementation Phases',
      '## Example Workflows',
      '## Notes for Implementation',
    ]) {
      assert.ok(
        headingLines.some((h) => h === expected),
        'missing chunk starting with: ' + expected
      );
    }

    assertWithinBudget(chunks);
    assertVerbatim(chunks, src);
  });

  it('chunks a discussion fixture with Discussion Map and Summary as own-chunks', () => {
    const src = loadFixture('discussion-fixture.md');
    const cfg = loadConfig('discussion');
    const chunks = chunk(src, cfg);

    // application-architecture.md: Context, Discussion Map, App Structure,
    // Module Architecture, Concurrency Model, State Management, App Lifecycle,
    // Error Handling Strategy, Configuration and Storage, Build and
    // Distribution, Summary = 11 H2s. Plus potentially the H1+intro chunk.
    assert.ok(chunks.length >= 11, 'expected >= 11 chunks, got ' + chunks.length);

    const mapChunk = chunks.find((c) =>
      /^## Discussion Map$/m.test(c.content.split('\n')[0])
    );
    const summaryChunk = chunks.find((c) =>
      /^## Summary$/m.test(c.content.split('\n')[0])
    );
    assert.ok(mapChunk, 'Discussion Map chunk missing');
    assert.ok(summaryChunk, 'Summary chunk missing');

    // Neither should have been merged into another section.
    assert.match(mapChunk.content, /^## Discussion Map/);
    assert.match(summaryChunk.content, /^## Summary/);

    assertVerbatim(chunks, src);
  });

  it('handles discussion without Discussion Map gracefully', () => {
    const src = loadFixture('discussion-no-map-fixture.md');
    const cfg = loadConfig('discussion');
    const chunks = chunk(src, cfg);

    // Chunker must not crash or produce weird output when the configured
    // special section isn't present. Expect the file to split on its H2s
    // normally.
    assert.ok(chunks.length >= 2);
    // No chunk should claim to be a Discussion Map.
    for (const c of chunks) {
      assert.doesNotMatch(c.content.split('\n')[0], /^## Discussion Map$/);
    }
    assertVerbatim(chunks, src);
  });

  it('chunks an investigation fixture into Symptoms, Analysis, Fix Direction sections', () => {
    const src = loadFixture('investigation-fixture.md');
    const cfg = loadConfig('investigation');
    const chunks = chunk(src, cfg);

    // 3 H2s (Symptoms, Analysis, Fix Direction) plus possibly an
    // H1+intro chunk if present.
    assert.ok(chunks.length >= 3);

    const headings = chunks.map((c) => c.content.split('\n')[0]);
    for (const expected of ['## Symptoms', '## Analysis', '## Fix Direction']) {
      assert.ok(
        headings.includes(expected),
        'missing ' + expected + ' chunk'
      );
    }

    assertWithinBudget(chunks);
    assertVerbatim(chunks, src);
  });

  it('chunks a specification fixture into expected sections', () => {
    const src = loadFixture('specification-fixture.md');
    const cfg = loadConfig('specification');
    const chunks = chunk(src, cfg);

    // 12 H2 sections in the portal spec (Overview through Dependencies).
    assert.ok(chunks.length >= 12, 'expected >= 12, got ' + chunks.length);

    const headings = chunks.map((c) => c.content.split('\n')[0]);
    for (const expected of [
      '## Overview',
      '## Core Model',
      '## TUI Design',
      '## Session Naming',
      '## Running Inside tmux',
      '## Project Memory',
      '## File Browser',
      '## Configuration & Storage',
      '## CLI Interface',
      '## Distribution',
      '## tmux Integration',
      '## Dependencies',
    ]) {
      assert.ok(
        headings.includes(expected),
        'missing chunk starting with: ' + expected
      );
    }

    assertWithinBudget(chunks);
    assertVerbatim(chunks, src);
  });

  it('keeps a long research section under the budget as one chunk', () => {
    // The single H2 runs to ~250 lines but well under the character budget,
    // so its three H3 observations stay together.
    const src = loadFixture('research-single-section-fixture.md');
    const cfg = loadConfig('research');
    const chunks = chunk(src, cfg);

    const section = chunks.filter((c) => /^## /.test(c.content.split('\n')[0]));
    assert.strictEqual(section.length, 1);
    for (const observation of ['### Observation A', '### Observation B', '### Observation C']) {
      assert.ok(section[0].content.includes(observation), observation);
    }
    assert.match(section[0].content, /body line 80/);

    assertVerbatim(chunks, src);
  });

  it('returns minimal spec as single chunk (below keep_whole_below)', () => {
    const src = loadFixture('spec-minimal-fixture.md');
    const cfg = loadConfig('specification');
    const chunks = chunk(src, cfg);

    assert.strictEqual(chunks.length, 1);
    // Frontmatter stripped.
    assert.doesNotMatch(chunks[0].content, /topic: minimal/);
    // Headings preserved.
    assert.match(chunks[0].content, /# Specification: Minimal Thing/);
    assert.match(chunks[0].content, /## Requirements/);
    assertVerbatim(chunks, src);
  });

  it('handles code blocks with headings without false splits', () => {
    const src = loadFixture('artifact-with-codeblocks-fixture.md');
    const cfg = loadConfig('specification');
    const chunks = chunk(src, cfg);

    // Exactly two real H2 sections. Anything matching the fake code-block
    // headings must remain inside Section One's chunk as literal content.
    const h2Chunks = chunks.filter((c) =>
      /^## /.test(c.content.split('\n')[0])
    );
    assert.strictEqual(h2Chunks.length, 2);

    const sectionOne = h2Chunks.find((c) =>
      c.content.startsWith('## Section One')
    );
    assert.ok(sectionOne);
    // Fake headings live inside the code blocks inside Section One.
    assert.match(sectionOne.content, /## Not A Real Heading One/);
    assert.match(sectionOne.content, /## Also Not A Heading/);

    // Section Two must NOT contain any of the fake headings (proves they
    // didn't leak across the boundary).
    const sectionTwo = h2Chunks.find((c) =>
      c.content.startsWith('## Section Two')
    );
    assert.ok(sectionTwo);
    assert.doesNotMatch(sectionTwo.content, /Not A Real Heading/);

    assertVerbatim(chunks, src);
  });

  it('returns no-headings fixture as single chunk', () => {
    const src = loadFixture('artifact-no-headings-fixture.md');
    const cfg = loadConfig('research');
    const chunks = chunk(src, cfg);

    assert.strictEqual(chunks.length, 1);
    assert.match(chunks[0].content, /Paragraph one/);
    assert.match(chunks[0].content, /Paragraph twelve/);
    assertVerbatim(chunks, src);
  });

  it('ensures each chunks content is a verbatim substring of the source (all fixtures)', () => {
    const cases = [
      ['research-fixture.md', 'research'],
      ['discussion-fixture.md', 'discussion'],
      ['discussion-no-map-fixture.md', 'discussion'],
      ['investigation-fixture.md', 'investigation'],
      ['specification-fixture.md', 'specification'],
      ['research-single-section-fixture.md', 'research'],
      ['spec-minimal-fixture.md', 'specification'],
      ['artifact-with-codeblocks-fixture.md', 'specification'],
      ['artifact-no-headings-fixture.md', 'research'],
    ];
    for (const [fixture, phase] of cases) {
      const src = loadFixture(fixture);
      const cfg = loadConfig(phase);
      const chunks = chunk(src, cfg);
      assertVerbatim(chunks, src);
    }
  });

  it('handles CRLF line endings', () => {
    const src = loadFixture('investigation-fixture.md').replace(/\n/g, '\r\n');
    const cfg = loadConfig('investigation');
    // Should not throw. CRLF is just LF preceded by a \r — headings still
    // parse because the regex is anchored by ^ and the \r sits at end of
    // line before the \n delimiter.
    const chunks = chunk(src, cfg);
    assert.ok(chunks.length >= 3);
  });

  it('does not produce an empty trailing chunk when file ends with blank lines', () => {
    const src = loadFixture('investigation-fixture.md') + '\n\n\n';
    const cfg = loadConfig('investigation');
    const chunks = chunk(src, cfg);
    for (const c of chunks) {
      assert.notStrictEqual(c.content.trim(), '');
    }
  });

  // -------------------------------------------------------------------------
  // Additional real fixtures — structural diversity beyond the initial set.
  // -------------------------------------------------------------------------

  it('chunks a deeply-nested spec (tick-core) where a single H2 contains all H3s', () => {
    // tick v1 tick-core/specification.md has only 2 H2s: "## Specification"
    // (754 lines, gets fallback-split at H3) and "## Dependencies" (27
    // lines, stays whole). Verifies that real artifacts with one huge
    // parent H2 do not break the flat fallback chain.
    const src = loadFixture('spec-deep-nested-fixture.md');
    const cfg = loadConfig('specification');
    const chunks = chunk(src, cfg);

    assert.ok(chunks.length >= 11, 'expected >= 11 chunks, got ' + chunks.length);

    // The final chunk must be the standalone "## Dependencies" H2.
    const last = chunks[chunks.length - 1];
    assert.match(last.content.split('\n')[0], /^## Dependencies/);

    // The other chunks must be H3 sub-sections (fallback fired on the
    // huge "## Specification" parent).
    const h3Count = chunks.filter((c) =>
      /^### /.test(c.content.split('\n')[0])
    ).length;
    assert.ok(h3Count >= 10, 'expected >= 10 H3 chunks, got ' + h3Count);

    assertVerbatim(chunks, src);
  });

  it('chunks a research fixture with a ~310-line H3 within the budget', () => {
    // tick v1 research exploration.md has an H3 "Session 1" under "Open
    // Questions to Explore" that runs to ~310 lines.
    const src = loadFixture('research-oversized-h3-fixture.md');
    const cfg = loadConfig('research');
    const chunks = chunk(src, cfg);

    assert.ok(chunks.length >= 2);
    assertWithinBudget(chunks);
    assertVerbatim(chunks, src);
  });

  it('chunks a Q-style discussion (Q1..Q6) where each question is an H2', () => {
    // tick v1 cli-command-structure-ux.md uses a "## Context" / "## Questions"
    // / "## Q1..Q6" / "## Summary" structure. No Discussion Map. Proves
    // the chunker copes with discussion variants that don't match the
    // design doc's canonical discussion shape.
    const src = loadFixture('discussion-q-style-fixture.md');
    const cfg = loadConfig('discussion');
    const chunks = chunk(src, cfg);

    assert.ok(chunks.length >= 8);
    const headings = chunks.map((c) => c.content.split('\n')[0]);
    assert.ok(headings.some((h) => /^## Context/.test(h)));
    assert.ok(headings.some((h) => /^## Summary/.test(h)));
    // At least 6 question chunks.
    const qCount = headings.filter((h) => /^## Q\d/.test(h)).length;
    assert.ok(qCount >= 6, 'expected >= 6 Q chunks, got ' + qCount);
    assertVerbatim(chunks, src);
  });

  it('chunks a folio spec with a mix of fallback-split H3s and regular H2s', () => {
    // folio template-authoring-system/specification.md has a wrapping H2
    // whose children are H3 sections. Chunker output is 16 chunks of
    // various sizes — structurally different from both portal and tick
    // specs.
    const src = loadFixture('spec-folio-fixture.md');
    const cfg = loadConfig('specification');
    const chunks = chunk(src, cfg);

    assert.ok(chunks.length >= 10);
    assertWithinBudget(chunks);
    assertVerbatim(chunks, src);
  });

  // -------------------------------------------------------------------------
  // Sub-level special_sections — "own-chunk: regardless of heading level"
  // -------------------------------------------------------------------------

  it('extracts a sub-level own-chunk section from inside a regular parent', () => {
    // The fixture puts "### Discussion Map" inside "## Plan" (a regular
    // H2 with its own intro content). The discussion config declares
    // Discussion Map as own-chunk. With sub-level matching, the H3
    // Discussion Map must be extracted from its parent even though the
    // split level is 2.
    const src = loadFixture('sub-level-special-fixture.md');
    const cfg = loadConfig('discussion');
    const chunks = chunk(src, cfg);

    const mapChunk = chunks.find((c) =>
      /^### Discussion Map/.test(c.content.split('\n')[0])
    );
    assert.ok(mapChunk, 'sub-level Discussion Map must be extracted as own-chunk');
    assert.match(mapChunk.content, /Option A/);
    assert.match(mapChunk.content, /Option C/);

    // The parent "## Plan" section should still emit as its own chunk,
    // containing its intro content but NOT the Discussion Map body.
    const planChunk = chunks.find((c) =>
      /^## Plan/.test(c.content.split('\n')[0])
    );
    assert.ok(planChunk, 'parent Plan section still emitted after extraction');
    assert.match(planChunk.content, /Plan intro paragraph one/);
    assert.doesNotMatch(planChunk.content, /Option A/);

    // "## Context" and "## Summary" must still be their own chunks — the
    // surrounding H2 boundaries are unaffected by sub-level extraction.
    const context = chunks.find((c) => /^## Context/.test(c.content.split('\n')[0]));
    const summary = chunks.find((c) => /^## Summary/.test(c.content.split('\n')[0]));
    assert.ok(context);
    assert.ok(summary);

    assertVerbatim(chunks, src);
  });

  it('preserves the parent-wins rule when a split-level heading matches special_sections', () => {
    // When the parent H2 itself matches special_sections (e.g. the
    // discussion fixture has "## Discussion Map" at H2), the parent's
    // action wins and no sub-carving happens. The real discussion fixture
    // already covers this — re-assert here to make the rule explicit.
    const src = loadFixture('discussion-fixture.md');
    const cfg = loadConfig('discussion');
    const chunks = chunk(src, cfg);

    // Only one Discussion Map chunk (the H2), not a carved-out H3 version.
    const mapChunks = chunks.filter((c) =>
      /^##+ Discussion Map/.test(c.content.split('\n')[0])
    );
    assert.strictEqual(mapChunks.length, 1);
    assert.match(mapChunks[0].content, /^## Discussion Map/);
  });

  // -------------------------------------------------------------------------
  // Merge-up verbatim invariant — Issue #1 fix validation
  // -------------------------------------------------------------------------

  it('merge-up chunks are verbatim source slices, even with non-empty separators', () => {
    // Craft a source where the gap between the parent section and the
    // merge-up section is NOT a plain "\n\n" — a blank line with trailing
    // spaces, then two newlines. Under the old implementation (join with
    // '\n\n'), the merged chunk content would not match the source
    // verbatim. Under the new implementation (source slice), it does.
    const md = [
      '## Parent',          // 0
      '',                   // 1
      'parent body line 1', // 2
      'parent body line 2', // 3
      '   ',                // 4  (trailing-whitespace blank line)
      '',                   // 5
      '## Footnote',        // 6
      'footnote body',      // 7
      '',                   // 8
      '## Other',           // 9
      'other body',         // 10
    ].join('\n');

    const cfg = {
      phase: 'test',
      strategy: 'split-on-heading',
      primary_level: 2,
      fallback_level: 3,
      keep_whole_below: 0,
      special_sections: { Footnote: 'merge-up' },
      strip_frontmatter: false,
      skip_empty_sections: true,
    };
    const chunks = chunk(md, cfg);

    assert.strictEqual(chunks.length, 2);

    // First chunk contains both Parent content and the merged Footnote —
    // and critically, every character must appear verbatim in the source.
    const merged = chunks[0];
    assert.match(merged.content, /## Parent/);
    assert.match(merged.content, /parent body line 1/);
    assert.match(merged.content, /## Footnote/);
    assert.match(merged.content, /footnote body/);

    // Verbatim invariant — merged chunk must be a substring of the source.
    assert.strictEqual(
      md.includes(merged.content),
      true,
      'merged chunk must be a verbatim substring of the source, got:\n' +
        merged.content
    );

    // Second chunk is the regular Other section.
    assert.match(chunks[1].content, /^## Other/);
  });

  it('merge-up from the first section promotes to its own chunk and stays verbatim', () => {
    const md = [
      '## Footnote',
      'footnote body',
      '',
      '## Parent',
      'parent body',
    ].join('\n');
    const cfg = {
      strategy: 'split-on-heading',
      primary_level: 2,
      fallback_level: 3,
      keep_whole_below: 0,
      special_sections: { Footnote: 'merge-up' },
      strip_frontmatter: false,
      skip_empty_sections: true,
    };
    const chunks = chunk(md, cfg);
    assert.strictEqual(chunks.length, 2);
    for (const c of chunks) {
      assert.strictEqual(
        md.includes(c.content),
        true,
        'chunk must be a verbatim substring of the source'
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Token-length cap — pathological whitespace-free runs
// ---------------------------------------------------------------------------

describe('knowledge chunker — token-length cap', () => {
  function capConfig(overrides = {}) {
    return {
      strategy: 'split-on-heading',
      primary_level: 2,
      fallback_level: 3,
      keep_whole_below: 0,
      special_sections: {},
      strip_frontmatter: true,
      skip_empty_sections: true,
      ...overrides,
    };
  }

  function longestToken(chunks) {
    let max = 0;
    for (const c of chunks) {
      for (const t of c.content.match(/\S+/g) || []) {
        if (t.length > max) max = t.length;
      }
    }
    return max;
  }

  it('splits a ~200k-char unbroken run so no token exceeds MAX_TOKEN_LENGTH', () => {
    // Un-capped, a run this long overflows the call stack inside Orama's
    // tokenizer (String.fromCharCode spreads one argument per character).
    const run = 'a'.repeat(200000);
    const md = `## Section\n\nBefore blob.\n\n${run}\n\nAfter blob.`;
    const chunks = chunk(md, capConfig());
    assert.ok(chunks.length >= 1);
    assert.ok(longestToken(chunks) <= MAX_TOKEN_LENGTH);
    for (const c of chunks) assert.ok(c.content.length <= MAX_CHUNK_CHARS);
    // Every byte of the run survives — split, not truncated.
    const joined = chunks.map((c) => c.content).join('\n');
    const runChars = (joined.match(/a/g) || []).length;
    assert.strictEqual(runChars, 200000);
    assert.match(joined, /Before blob\./);
    assert.match(joined, /After blob\./);
  });

  it('caps runs on every return path, including the whole-file gate', () => {
    const run = 'b'.repeat(MAX_TOKEN_LENGTH * 3);
    const md = `# Tiny\n\n${run}`;
    // keep_whole_below high — whole file returned as a single chunk.
    const chunks = chunk(md, capConfig({ keep_whole_below: 50 }));
    assert.strictEqual(chunks.length, 1);
    assert.ok(longestToken(chunks) <= MAX_TOKEN_LENGTH);
  });

  it('leaves content without over-long runs byte-for-byte untouched', () => {
    const md = [
      '## Alpha',
      '',
      'Normal prose with `code` and a ' + 'c'.repeat(MAX_TOKEN_LENGTH) + ' at-limit run.',
      '',
      '## Beta',
      '',
      'More prose.',
    ].join('\n');
    const chunks = chunk(md, capConfig());
    for (const c of chunks) {
      assert.strictEqual(
        md.includes(c.content),
        true,
        'chunk must be a verbatim substring when no run exceeds the cap'
      );
    }
  });
});
