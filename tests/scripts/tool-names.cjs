'use strict';

// ---------------------------------------------------------------------------
// The tool-name scan (7.1.10, 7.2.13): where a file names a tool a driver
// wraps, in the forms only the tool itself takes, never a bare word, so the
// prose and code that use its name for other things pass. Each driver's
// test fixtures say how its tool is named (`tests/drivers/{name}/
// tool-names.cjs`): its binary, its commands and flags, whether its binary
// quoted bare collides with nothing, and the forms only it takes — its
// package, its store, its ids. From those the scan finds a command, a spawn
// of the binary, whether or not it runs onto the next line, a constant
// holding it, an install of it and, where it collides with nothing, the
// binary quoted bare. `toolNamesIn` reads one text; `shippedFiles` lists
// every file of the workflows the rule holds over: the skills, the
// references, the agent definitions, the engine's code and the migrations,
// outside the drivers and test fixtures, the places 7.1.10 names. 7.1.10
// lets a released migration name a tool too, but none does in a form the
// scan finds, so every migration is scanned, the reshape's among them
// (21.5.18). test-tool-names.cjs runs it over the repository; each
// driver's test-tool-names.cjs pins its forms.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const DRIVER_FIXTURES = path.join(__dirname, '..', 'drivers');

/**
 * How a driver's tool is named, as its test fixtures declare it.
 * @typedef {{binary: string, commands: string[], quoted: boolean, forms: {form: string, pattern: RegExp}[]}} ToolNaming
 */

/** @param {string} text */
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Each form a tool is named in: the forms every binary takes, then its own.
 * @param {ToolNaming} naming @returns {{form: string, pattern: RegExp}[]}
 */
function formsOf({ binary, commands, quoted, forms }) {
  const name = escaped(binary);
  const said = `['"\`]${name}['"\`]`;
  return [
    { form: 'a command', pattern: new RegExp(`\\b${name}[ \\t]+(?:${commands.map(escaped).join('|')})(?![\\w-])`) },
    { form: 'a spawn of its binary', pattern: new RegExp(`\\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|execa)\\(\\s*${said}`) },
    { form: 'a constant holding its binary', pattern: new RegExp(`\\b(?:const|let|var)\\s+\\w+\\s*=\\s*${said}`) },
    { form: 'an install', pattern: new RegExp(`\\bbrew[ \\t]+install[ \\t]+(?:[\\w.-]+\\/)*${name}(?![\\w-])`) },
    ...(quoted ? [{ form: 'its binary quoted', pattern: new RegExp(said) }] : []),
    ...forms,
  ];
}

/** Each driver's forms, by the driver's name. */
const DRIVER_FORMS = Object.freeze(fs.readdirSync(DRIVER_FIXTURES)
  .filter((driver) => fs.existsSync(path.join(DRIVER_FIXTURES, driver, 'tool-names.cjs')))
  .map((driver) => ({ driver, forms: formsOf(require(path.join(DRIVER_FIXTURES, driver, 'tool-names.cjs'))) })));

/**
 * Each line of `text` naming a tool, once for each form, with its driver
 * and the form; a form run onto the next line is found on the line it
 * opens.
 * @param {string} text
 * @returns {{line: number, driver: string, form: string, text: string}[]}
 */
function toolNamesIn(text) {
  const lines = text.split('\n');
  const lineAt = (/** @type {number} */ index) => text.slice(0, index).split('\n').length;
  const found = DRIVER_FORMS.flatMap(({ driver, forms }) => forms.flatMap(({ form, pattern }) => [...text.matchAll(new RegExp(pattern.source, 'g'))]
    .map((m) => ({ line: lineAt(/** @type {number} */ (m.index)), driver, form }))));
  const seen = new Set();
  return found
    .filter(({ line, driver, form }) => !seen.has(`${line} ${driver} ${form}`) && seen.add(`${line} ${driver} ${form}`))
    .sort((a, b) => a.line - b.line)
    .map((at) => ({ ...at, text: lines[at.line - 1].trim() }));
}

/** The drivers, the one place under `skills/` 7.1.10 lets name a tool, from the repository's root. */
const DRIVERS = path.join('skills', 'leeway-engine', 'scripts', 'drivers');

/** Whether a path from the repository's root is a test fixture: a file under a skill's own tests. @param {string} rel */
const fixture = (rel) => rel.split(path.sep).includes('tests');

/**
 * Every file the rule holds over, from the repository's root: under
 * `skills/` and `agents/`, but in the drivers and a skill's own tests.
 * @param {string} [repo] @returns {string[]}
 */
function shippedFiles(repo = REPO) {
  return ['skills', 'agents']
    .flatMap((top) => fs.readdirSync(path.join(repo, top), { recursive: true, encoding: 'utf8' }).map((rel) => path.join(top, rel)))
    .filter((rel) => !rel.startsWith(`${DRIVERS}${path.sep}`) && !fixture(rel))
    .filter((rel) => fs.statSync(path.join(repo, rel)).isFile())
    .sort();
}

module.exports = { DRIVER_FORMS, DRIVERS, toolNamesIn, shippedFiles, REPO };
