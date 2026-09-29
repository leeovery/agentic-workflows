'use strict';

// A file's outline, as a query places a chunk in it: the chunk's lines in
// the file as it stands, frontmatter counted, and the headings enclosing a
// line — fenced headings and frontmatter never among them.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { chunk } = require('../../skills/workflow-engine/scripts/kernel/knowledge/chunker.cjs');
const { outline } = require('../../skills/workflow-engine/scripts/kernel/knowledge/outline.cjs');

const CHUNKING = path.join(__dirname, '..', '..', 'skills', 'workflow-engine', 'content', 'knowledge', 'chunking');

/** @param {string[]} lines */
const fileOf = (lines) => lines.join('\n') + '\n';

const DOCUMENT = [
  '# Discussion: Auth',       // 1
  '',                          // 2
  '## Context',                // 3
  '',                          // 4
  'Tokens refresh hourly.',    // 5
  '',                          // 6
  '## Decision',               // 7
  '',                          // 8
  '### Rotation',              // 9
  '',                          // 10
  'Refresh tokens rotate.',    // 11
  '```md',                     // 12
  '# not a heading',           // 13
  '```',                       // 14
  'After the fence.',          // 15
  '',                          // 16
  '## Open Questions',         // 17
  '',                          // 18
  'None yet.',                 // 19
];

describe('outline — locate', () => {
  it("gives a chunk's first and last lines, counted from 1", () => {
    const file = outline(fileOf(DOCUMENT));
    assert.deepStrictEqual(file.locate('## Context\n\nTokens refresh hourly.'), { first: 3, last: 5 });
    assert.deepStrictEqual(file.locate('None yet.'), { first: 19, last: 19 });
  });

  it('counts the frontmatter and the blank lines after it', () => {
    const file = outline(fileOf(['---', 'status: completed', '# yaml comment', '---', '', '', ...DOCUMENT]));
    assert.deepStrictEqual(file.locate('## Context\n\nTokens refresh hourly.'), { first: 9, last: 11 });
  });

  it('finds a chunk only where its text starts a line, never inside a longer one', () => {
    const file = outline(fileOf([
      '# Discussion: Auth',       // 1
      '',                          // 2
      '## Context',                // 3
      '',                          // 4
      '### Notes',                 // 5
      '',                          // 6
      'Tokens refresh hourly.',    // 7
      '',                          // 8
      '## Notes',                  // 9
      '',                          // 10
      'Tokens refresh hourly.',    // 11
    ]));
    const where = /** @type {{first: number, last: number}} */ (file.locate('## Notes\n\nTokens refresh hourly.'));
    assert.deepStrictEqual(where, { first: 9, last: 11 });
    assert.deepStrictEqual(file.headingsAt(where.last), ['Discussion: Auth', 'Notes']);

    const summarised = outline(fileOf(['---', 'summary: Tokens refresh hourly.', '---', '', 'Tokens refresh hourly.']));
    assert.deepStrictEqual(summarised.locate('Tokens refresh hourly.'), { first: 5, last: 5 });
  });

  it('places a slice of an over-long line inside the line it was cut from', () => {
    const file = outline(fileOf(['# Title', '', 'Opening words of one very long line, then its closing words.']));
    assert.deepStrictEqual(file.locate('then its closing words.'), { first: 3, last: 3 });
    assert.deepStrictEqual(file.headingsAt(3), ['Title']);
  });

  it('finds a chunk cut with its frontmatter, and reads no heading there', () => {
    const markdown = fileOf(['---', '# yaml comment', '---', '', '# Title', '', 'Body.']);
    const [{ content }] = chunk(markdown, { strip_frontmatter: false, keep_whole_below: 50 });
    const file = outline(markdown);
    assert.deepStrictEqual(file.locate(content), { first: 1, last: 7 });
    assert.deepStrictEqual(file.headingsAt(2), []);
    assert.deepStrictEqual(file.headingsAt(7), ['Title']);
  });

  it('reads a CRLF file as the chunker does', () => {
    const file = outline(['---', 'a: b', '---', '# Title', '', 'Body line.', 'Second line.'].join('\r\n'));
    assert.deepStrictEqual(file.locate('Body line.\nSecond line.'), { first: 6, last: 7 });
    assert.deepStrictEqual(file.headingsAt(6), ['Title']);
  });

  it('finds nothing the file no longer holds', () => {
    assert.strictEqual(outline(fileOf(DOCUMENT)).locate('Tokens refresh daily.'), null);
  });

  it('finds every chunk the chunker cuts from a file, at the lines holding its text', () => {
    const config = JSON.parse(fs.readFileSync(path.join(CHUNKING, 'discussion.json'), 'utf8'));
    const sections = Array.from({ length: 30 }, (_, n) => [`## Section ${n}`, '', `Body of section ${n}.`, '']);
    const markdown = ['---', 'topic: auth', '---', '', ...DOCUMENT, '', ...sections.flat()].join('\r\n');
    const lines = markdown.split('\r\n');
    const file = outline(markdown);
    const chunks = chunk(markdown, config);
    assert.ok(chunks.length > 1);
    for (const { content } of chunks) {
      const where = /** @type {{first: number, last: number}} */ (file.locate(content));
      assert.strictEqual(lines.slice(where.first - 1, where.last).join('\n'), content);
    }
  });
});

describe('outline — headingsAt', () => {
  const file = outline(fileOf(DOCUMENT));

  it('gives the chain of headings enclosing a line, title first', () => {
    assert.deepStrictEqual(file.headingsAt(5), ['Discussion: Auth', 'Context']);
    assert.deepStrictEqual(file.headingsAt(11), ['Discussion: Auth', 'Decision', 'Rotation']);
    assert.deepStrictEqual(file.headingsAt(19), ['Discussion: Auth', 'Open Questions']);
  });

  it('counts a heading line as enclosed by itself', () => {
    assert.deepStrictEqual(file.headingsAt(7), ['Discussion: Auth', 'Decision']);
  });

  it('ignores a heading-shaped line inside a fence', () => {
    assert.deepStrictEqual(file.headingsAt(15), ['Discussion: Auth', 'Decision', 'Rotation']);
  });

  it('closes a deeper heading at a shallower one, however many levels it skipped', () => {
    const skipped = outline(fileOf(['# Title', '#### Deep', 'text', '## Next', 'more']));
    assert.deepStrictEqual(skipped.headingsAt(3), ['Title', 'Deep']);
    assert.deepStrictEqual(skipped.headingsAt(5), ['Title', 'Next']);
  });

  it('gives none above the first heading, and none in a file without one', () => {
    assert.deepStrictEqual(outline(fileOf(['Intro.', '# Title'])).headingsAt(1), []);
    assert.deepStrictEqual(outline(fileOf(['Plain text.'])).headingsAt(1), []);
  });

  it('never reads a frontmatter line as a heading', () => {
    assert.deepStrictEqual(outline(fileOf(['---', '# yaml comment', '---', 'Body.'])).headingsAt(4), []);
  });
});
