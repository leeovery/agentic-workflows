'use strict';

// The user docs (23.4) and the README, read as they ship. The book is the
// chapters 23.4.2 lists and nothing else, so no planning.md and no
// collaboration chapter apart from trust stand in it, and its index links
// each (23.S11, 23.S17); history covers the reshape, and the tracker is met
// in the configuration and build chapters (23.S11). The main session's
// recommended minimum effort, medium, is stated (23.S13). The README's
// pipeline table is the engine's own pipelines, so it names no retired
// phase (23.S14). None of the author's own products and projects is named
// in the docs or the README (23.S12, 23.4.6). The docs, help and the
// glossary call the product Ledger, and never the name it was built under,
// but where history tells of it (23.S19, 23.1.4).
//
// Layer: unit. World: the repository's own files, read.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES } = require('../../skills/ledger-engine/scripts/kernel/manifest-schema.cjs');
const { helpFiles, REPO } = require('./tool-names.cjs');

const DOCS = path.join(REPO, 'docs');
const GLOSSARY = path.join('skills', 'ledger-shared', 'references', 'glossary.md');

/** Each chapter 23.4.2 lists, by its file; the index is the book's README. */
const CHAPTERS = {
  'an introduction': 'introduction.md',
  'how it fits together': 'how-it-fits-together.md',
  'work types': 'work-types.md',
  discovery: 'discovery.md',
  discussion: 'discussion.md',
  experiments: 'experiments.md',
  investigation: 'investigation.md',
  specification: 'specification.md',
  'the build': 'the-build.md',
  review: 'review.md',
  trust: 'trust.md',
  verification: 'verification.md',
  'state and git': 'state-and-git.md',
  tracking: 'tracking.md',
  'the knowledge base': 'knowledge-base.md',
  'the engine': 'engine.md',
  reliability: 'reliability.md',
  configuration: 'configuration.md',
  lifecycle: 'lifecycle-operations.md',
  agents: 'agents.md',
  contributing: 'contributing.md',
  history: 'history.md',
};
const INDEX = 'README.md';

/** The author's own products and projects (23.4.6): the distinctive names in any case, those that are also words capitalised. */
const OWN_NAMES = [/\b(?:SitRep|Switchboard|Turnstile|DocMan|Folio|Portal|rootshell)\b/i, /\b(?:Harness|Fabric|Kit|Stitch|Mint)\b/];
/** The name the product was built under (23.1.4). */
const BUILT_AS = /\bLeeway\b/i;
const PRODUCT = /\bLedger\b/;

/** @param {string} rel from the repository's root */
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/** Every markdown file the book holds, from the repository's root. */
const bookFiles = () => fs.readdirSync(DOCS).filter((name) => name.endsWith('.md')).map((name) => path.join('docs', name));

/** Each line of `files` that `pattern` finds, as `{file}:{line}: {match}`. @param {string[]} files @param {RegExp} pattern */
function linesNaming(files, pattern) {
  return files.flatMap((rel) => read(rel).split('\n').flatMap((line, i) => {
    const found = pattern.exec(line);
    return found ? [`${rel}:${i + 1}: ${found[0]}`] : [];
  }));
}

/**
 * The README's pipeline table: each row's work type and its phases, lowercased, an
 * aside in brackets dropped. @param {string} text @returns {{type: string, phases: string[]}[]}
 */
function pipelineTable(text) {
  const table = /^\| Type \| Pipeline \|\n\|[-| ]+\|\n((?:\|.*\|\n?)+)/m.exec(text);
  assert.ok(table, 'the README has its pipeline table, | Type | Pipeline |');
  return table[1].trim().split('\n').map((row) => {
    const [type, pipeline] = row.split('|').slice(1, 3).map((cell) => cell.trim().toLowerCase());
    return { type, phases: pipeline.split('→').map((phase) => phase.replace(/\(.*?\)/g, '').trim()) };
  });
}

describe('the user docs (23.4)', () => {
  it('23.S11, 23.S17: the book is the chapters 23.4.2 lists and its index, nothing else — no planning.md, no collaboration chapter apart from trust', () => {
    assert.deepStrictEqual(bookFiles().map((rel) => path.basename(rel)).sort(), [...Object.values(CHAPTERS), INDEX].sort());
  });

  it('23.S17: the index links every chapter', () => {
    const index = read(path.join('docs', INDEX));
    assert.deepStrictEqual(Object.entries(CHAPTERS).filter(([, file]) => !index.includes(`](${file})`)).map(([chapter]) => chapter), []);
  });

  it('23.S11: history covers the reshape', () => {
    assert.match(read('docs/history.md'), /^## The reshape$/m);
  });

  it('23.S11: the tracker is met in the configuration and the build chapters', () => {
    for (const file of ['configuration.md', 'the-build.md']) assert.match(read(path.join('docs', file)), /\btracker\b/, `${file} covers the tracker`);
  });

  it('23.S13: the docs state the main session\'s recommended minimum effort, medium', () => {
    assert.match(read('docs/configuration.md'), /\brecommends a minimum of \*\*medium\*\*/);
  });

  it('23.S12: none of the author\'s own products and projects is named in the docs or the README', () => {
    assert.deepStrictEqual(OWN_NAMES.flatMap((names) => linesNaming([...bookFiles(), 'README.md'], names)), []);
  });

  it('23.S19: the docs, help and the glossary call the product Ledger, never the name it was built under but where history tells of it', () => {
    const surfaces = { docs: bookFiles(), help: helpFiles().filter((rel) => rel !== GLOSSARY), glossary: [GLOSSARY] };
    for (const [surface, files] of Object.entries(surfaces)) assert.ok(files.some((rel) => PRODUCT.test(read(rel))), `${surface} names Ledger`);
    assert.deepStrictEqual(linesNaming(Object.values(surfaces).flat().filter((rel) => rel !== path.join('docs', 'history.md')), BUILT_AS), []);
  });
});

describe('the README (23.4.8)', () => {
  it('23.S14: its pipeline table is the engine\'s own pipelines, every work type once, naming no retired phase', () => {
    const rows = pipelineTable(read('README.md'));
    assert.deepStrictEqual(rows.map(({ type }) => type), VALID_WORK_TYPES);
    for (const { type, phases } of rows) {
      const pipeline = ['discovery', ...WORK_TYPE_PIPELINES[type]].filter((phase) => phase !== 'experiment' || phases.includes(phase));
      assert.deepStrictEqual(phases, pipeline, `${type}'s row`);
    }
  });
});
