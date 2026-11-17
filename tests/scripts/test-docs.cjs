'use strict';

// The user docs (23.4) and the README, read as they ship. The book is the
// chapters 23.4.2 lists and nothing else, so no planning.md and no
// collaboration chapter apart from trust stand in it, and its index links
// each (23.S11, 23.S17); history covers the reshape, and the tracker is met
// in the configuration and build chapters (23.S11). The main session's
// recommended minimum effort, medium, is stated (23.S13). The README's
// pipeline table is the engine's own pipelines, so it names no retired
// phase (23.S14). None of the author's own products and projects is named
// in the docs or the README (23.S12, 23.4.6). The docs, the README, help
// and the glossary call the product Ledger, never the name it was built
// under or "the workflows", but where history tells of it or the
// glossary's avoid line names it (23.S19, 23.1.4); so do the skills, the
// briefs, the agents and the engine. In those, the book and the README, no
// form of the workflows names the product, even split across a line, but
// in history and a migration. Every link of the book's and the README's
// resolves, to its file and the heading it names.
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

/**
 * The author's own products and projects (23.4.6, O9), those on his board and
 * those the design record's rehearsal names: the distinctive names in any
 * case, those that are also words capitalised. Tick and agntc, which the docs
 * present, are not among them.
 */
const OWN_NAMES = [
  /\b(?:SitRep|Switchboard|Turnstile|DocMan|Folio|Portal|rootshell|Fumi|Evvi|Codeintel|quiz-biz|Goosemates)\b/i,
  /\b(?:Harness|Fabric|Kit|Stitch|Mint|Pigeon|Galley|Nod)\b/,
];
/** The names the product had before (23.1.4): the one it was built under, and the workflows, as the glossary's avoid line keeps it. */
const OLD_NAMES = /\bLeeway\b|\bthe workflows\b/i;
const PRODUCT = /\bLedger\b/;
/** Where an old name may stand: history, telling of it, and the glossary's avoid lines, naming it. */
const TELLS_OF_IT = (/** @type {string} */ rel, /** @type {string} */ line) => rel === path.join('docs', 'history.md') || line.startsWith('_Avoid_:');

/** What may part two words of a name: whitespace, a line break, and a comment's, a quote's or a heading's marker. */
const PARTS = String.raw`(?:\s|\/\/|\*|>|#)+`;
/**
 * The workflows as the product's name, even where a line break and a marker
 * part the words: "the workflows", "workflows'", "Workflows" opening a
 * sentence or a line, a workflow(s) state or project, and the singular before
 * a word that only the product takes ("the workflow harness", "a workflow
 * conversation"). The singular as an ordinary word — "the workflow around
 * it" — passes, and so does any phrase this list does not name.
 */
const WORKFLOWS_NAMED = [
  new RegExp(String.raw`\bthe${PARTS}workflows\b`, 'gi'),
  new RegExp(String.raw`(?<![\w./'"\x60-])workflows'`, 'gi'),
  new RegExp(String.raw`(?<=^[ \t>#*/]*|[.!?]\s+)Workflows\b`, 'gm'),
  new RegExp(String.raw`\bworkflows?${PARTS}(?:state|project)\b`, 'gi'),
  new RegExp(String.raw`\bworkflow${PARTS}(?:engine|harness|conversation|session|skill|prose|position|ontology|vocabulary|content|render|artifact|file|value)s?\b`, 'gi'),
];
/** Where it stands in what ships: every migration, the released ones never edited and 072–081's sweep still to come, and a file whose change is in flight elsewhere. */
const NAMES_IT_STILL = [
  path.join('skills', 'ledger-migrate', 'scripts', 'migrations') + path.sep,
  path.join('skills', 'ledger-engine', 'scripts', 'domain', 'brief-names.cjs'),
];

/** @param {string} rel from the repository's root */
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

/** Every file under `skills/` and `agents/`, from the repository's root, but those `NAMES_IT_STILL` lets stand. */
const productFiles = () => ['skills', 'agents']
  .flatMap((top) => fs.readdirSync(path.join(REPO, top), { recursive: true, encoding: 'utf8' }).map((rel) => path.join(top, rel)))
  .filter((rel) => !NAMES_IT_STILL.some((skip) => rel.startsWith(skip)) && fs.statSync(path.join(REPO, rel)).isFile());

/**
 * Each place of `rel`'s that names the product the workflows: where, as
 * `{file}:{line}: {match}`, and whether it stands, as the glossary's avoid
 * line names it.
 * @param {string} rel @returns {{at: string, stands: boolean}[]}
 */
function workflowsNamed(rel) {
  const text = read(rel);
  return WORKFLOWS_NAMED.flatMap((pattern) => [...text.matchAll(pattern)]).map((found) => {
    const start = text.lastIndexOf('\n', found.index) + 1;
    return {
      at: `${rel}:${text.slice(0, found.index).split('\n').length}: ${found[0]}`,
      stands: rel === GLOSSARY && text.startsWith('_Avoid_:', start),
    };
  });
}

/** Every markdown file the book holds, from the repository's root. */
const bookFiles = () => fs.readdirSync(DOCS).filter((name) => name.endsWith('.md')).map((name) => path.join('docs', name));

/**
 * Each line of `files` that `pattern` finds, as `{file}:{line}: {match}`, but
 * those `passes` lets stand.
 * @param {string[]} files @param {RegExp} pattern @param {(rel: string, line: string) => boolean} [passes]
 */
function linesNaming(files, pattern, passes = () => false) {
  return files.flatMap((rel) => read(rel).split('\n').flatMap((line, i) => {
    const found = pattern.exec(line);
    return found && !passes(rel, line) ? [`${rel}:${i + 1}: ${found[0]}`] : [];
  }));
}

/** A chapter's section under `heading`, to the next heading of its level. @param {string} text @param {string} heading */
function sectionOf(text, heading) {
  const start = text.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `the chapter has ${heading}`);
  const level = /^#+ /.exec(heading)?.[0] ?? '## ';
  const end = text.indexOf(`\n${level}`, start + heading.length + 1);
  return text.slice(start, end < 0 ? undefined : end);
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

/** A heading's anchor, as GitHub makes it. @param {string} heading */
const anchorOf = (heading) => heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-');

/**
 * Each link of `rel`'s that goes nowhere: a file of the repository missing,
 * or a heading of it, by its anchor, absent. A web address is passed over.
 * @param {string} rel from the repository's root
 */
function brokenLinks(rel) {
  const text = read(rel);
  const targets = [...text.matchAll(/\]\(([^)\s]+)\)/g), ...text.matchAll(/<a href="([^"]+)"/g)].map(([, target]) => target);
  return targets.filter((target) => !/^[a-z]+:/.test(target)).filter((target) => {
    const [file, anchor] = target.split('#');
    const linked = file === '' ? rel : path.join(path.dirname(rel), file);
    if (!fs.existsSync(path.join(REPO, linked))) return true;
    return anchor !== undefined && ![...read(linked).matchAll(/^#+ (.+)$/gm)].some(([, heading]) => anchorOf(heading) === anchor);
  }).map((target) => `${rel}: ${target}`);
}

describe('the user docs (23.4)', () => {
  it('every link of the book\'s and the README\'s goes somewhere, to the heading it names', () => {
    assert.deepStrictEqual([...bookFiles(), 'README.md'].flatMap(brokenLinks), []);
  });

  it('23.S11, 23.S17: the book is the chapters 23.4.2 lists and its index, nothing else — no planning.md, no collaboration chapter apart from trust', () => {
    assert.deepStrictEqual(bookFiles().map((rel) => path.basename(rel)).sort(), [...Object.values(CHAPTERS), INDEX].sort());
  });

  it('23.S17: the index links every chapter', () => {
    const index = read(path.join('docs', INDEX));
    assert.deepStrictEqual(Object.entries(CHAPTERS).filter(([, file]) => !index.includes(`](${file})`)).map(([chapter]) => chapter), []);
  });

  it('23.S11: history covers the reshape: its three strands, the state branch, the release, and the name it was built under', () => {
    const reshape = sectionOf(read('docs/history.md'), '## The reshape');
    for (const told of [/\bcontracts\b/, /\btrust\b/, /\bverification\b/, /\bbranch of its own\b/, /\bone release\b/, /\bLeeway\b/]) assert.match(reshape, told);
  });

  it('23.S11: the tracker is met in the configuration and the build chapters, where the task driver keeps the build\'s tasks in it', () => {
    for (const file of ['configuration.md', 'the-build.md']) assert.match(read(path.join('docs', file)), /\btask driver\b[^.\n]*\bkeeps the build's tasks in your tracker\b/, `${file} covers the tracker`);
  });

  it('23.S13: the docs state the main session\'s recommended minimum effort, medium', () => {
    assert.match(read('docs/configuration.md'), /\brecommends a minimum of \*\*medium\*\*/);
  });

  it('23.S12: none of the author\'s own products and projects is named in the docs or the README', () => {
    assert.deepStrictEqual(OWN_NAMES.flatMap((names) => linesNaming([...bookFiles(), 'README.md'], names)), []);
  });

  it('23.S19: the docs, the README, help and the glossary call the product Ledger, never an old name but where history tells of it or the glossary\'s avoid line names it', () => {
    const surfaces = { docs: bookFiles(), readme: ['README.md'], help: helpFiles().filter((rel) => rel !== GLOSSARY), glossary: [GLOSSARY] };
    for (const [surface, files] of Object.entries(surfaces)) assert.ok(files.some((rel) => PRODUCT.test(read(rel))), `${surface} names Ledger`);
    assert.deepStrictEqual(linesNaming(Object.values(surfaces).flat(), OLD_NAMES, TELLS_OF_IT), []);
  });

  it('the skills, the briefs, the agents, the engine, the docs and the README call the product Ledger, never the workflows, but the glossary\'s avoid line naming it', () => {
    const files = [...productFiles(), ...bookFiles().filter((rel) => rel !== path.join('docs', 'history.md')), 'README.md'];
    const named = files.flatMap(workflowsNamed);

    assert.ok(files.includes(GLOSSARY) && files.length > 100, 'the guard reads what ships');
    assert.ok(named.some(({ stands }) => stands), 'the guard meets the glossary\'s avoid line');
    assert.deepStrictEqual(named.filter(({ stands }) => !stands).map(({ at }) => at), []);
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
