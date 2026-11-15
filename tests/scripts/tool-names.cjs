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
// (21.5.18). Help is held closer (23.1.3): `helpNamesIn` finds a tool by
// its name as a word too, as each driver declares it, which no help screen,
// walkthrough fixture, help content file, glossary entry or the code that
// draws help's own screens says, and `helpFiles` lists them. test-tool-names.cjs runs both over the
// repository; each driver's test-tool-names.cjs pins its forms.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const DRIVER_FIXTURES = path.join(__dirname, '..', 'drivers');

/**
 * How a driver's tool is named, as its test fixtures declare it: its own
 * forms, and its name as a word, which only help is held to.
 * @typedef {{binary: string, commands: string[], quoted: boolean, forms: {form: string, pattern: RegExp}[], named: {form: string, pattern: RegExp}[]}} ToolNaming
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

/** How each driver's tool is named, by the driver's name. @type {{driver: string, naming: ToolNaming}[]} */
const NAMINGS = fs.readdirSync(DRIVER_FIXTURES)
  .filter((driver) => fs.existsSync(path.join(DRIVER_FIXTURES, driver, 'tool-names.cjs')))
  .map((driver) => ({ driver, naming: require(path.join(DRIVER_FIXTURES, driver, 'tool-names.cjs')) }));

/** Each driver's forms, by the driver's name. */
const DRIVER_FORMS = Object.freeze(NAMINGS.map(({ driver, naming }) => ({ driver, forms: formsOf(naming) })));

/** Each driver's forms in help (23.1.3): its forms anywhere, and its name as a word. */
const HELP_FORMS = Object.freeze(NAMINGS.map(({ driver, naming }) => ({ driver, forms: [...formsOf(naming), ...naming.named] })));

/**
 * Each line of `text` naming a tool, once for each form, with its driver
 * and the form; a form run onto the next line is found on the line it
 * opens.
 * @param {string} text @param {readonly {driver: string, forms: {form: string, pattern: RegExp}[]}[]} [driverForms]
 * @returns {{line: number, driver: string, form: string, text: string}[]}
 */
function toolNamesIn(text, driverForms = DRIVER_FORMS) {
  const lines = text.split('\n');
  const lineAt = (/** @type {number} */ index) => text.slice(0, index).split('\n').length;
  const found = driverForms.flatMap(({ driver, forms }) => forms.flatMap(({ form, pattern }) => [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
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

/** Each line of a help file's `text` naming a tool, its name as a word among the forms (`toolNamesIn`). @param {string} text */
const helpNamesIn = (text) => toolNamesIn(text, HELP_FORMS);

const WALKTHROUGH = path.join('skills', 'leeway-engine', 'content', 'walkthrough');
const PROJECTIONS = path.join('skills', 'leeway-engine', 'scripts', 'domain', 'projections');
const GLOSSARY = path.join('skills', 'leeway-shared', 'references', 'glossary.md');

/** The code that draws help's own screens: the help home's rows, each menu's help, the reference cards, and the walk's and the cards' menus. */
const HELP_CODE = [
  path.join('skills', 'leeway-engine', 'scripts', 'domain', 'menus.cjs'),
  path.join(PROJECTIONS, 'help.cjs'),
  path.join(PROJECTIONS, 'help-topics.cjs'),
  path.join(PROJECTIONS, 'walkthrough.cjs'),
];

/**
 * Every file help is held closer in, from the repository's root (the
 * header's; 23.1.3): every file under the walkthrough's content, its
 * fixtures among them, each menu's `*.help.md`, the glossary, and the code
 * that draws help's own screens.
 * @param {string} [repo] @returns {string[]}
 */
function helpFiles(repo = REPO) {
  const under = (/** @type {string} */ dir) => fs.readdirSync(path.join(repo, dir), { recursive: true, encoding: 'utf8' })
    .map((rel) => path.join(dir, rel))
    .filter((rel) => fs.statSync(path.join(repo, rel)).isFile());
  return [...under(WALKTHROUGH), ...under(PROJECTIONS).filter((rel) => rel.endsWith('.help.md')), GLOSSARY, ...HELP_CODE].sort();
}

module.exports = { DRIVER_FORMS, HELP_FORMS, HELP_CODE, DRIVERS, toolNamesIn, helpNamesIn, shippedFiles, helpFiles, REPO };
