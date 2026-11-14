'use strict';

// ---------------------------------------------------------------------------
// The tool-name scan (7.1.10, 7.2.13): where a file names the tracker or the
// code host's CLI, in the forms only the tool itself takes — a command, a
// spawn of its binary, its package, its store, its ids — never a bare word,
// so the spec page's "Tick a line", a unit called "… swallows gh stderr" or
// a mark's 'tick' pass. `toolNamesIn` reads one text; `shippedFiles` lists
// every file of the workflows the rule holds over: the skills, the
// references, the agent definitions and the engine's code, outside the
// places 7.1.10 names — the drivers, test fixtures, and released migrations.
// test-tool-names.cjs runs it over the repository.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');

/** The tools' subcommands a command form names. */
const TRACKER_COMMANDS = 'create|update|list|show|ready|blocked|start|done|cancel|reopen|dep|note|init|version|stats|doctor|rebuild|migrate|remove|--json';
const HOST_COMMANDS = 'pr|api|auth|stack|extension|repo|issue|run|release|--version';

/** Each form a tool is named in, by the tool. */
const TOOL_FORMS = Object.freeze([
  { tool: 'tracker', form: 'a command', pattern: new RegExp(`\\btick\\s+(?:${TRACKER_COMMANDS})(?![\\w-])`) },
  { tool: 'tracker', form: 'its package', pattern: /\bleeovery\/tick\b/ },
  { tool: 'tracker', form: 'its store', pattern: /(?<![\w-])\.tick\// },
  { tool: 'tracker', form: 'its ids', pattern: /(?<![\w./-])tick-[0-9a-f]{6}\b/ },
  { tool: 'code host', form: 'a command', pattern: new RegExp(`\\bgh\\s+(?:${HOST_COMMANDS})(?![\\w-])`) },
  { tool: 'code host', form: 'its package', pattern: /\bgh-stack\b|\bcli\.github\.com\b|\bcli\/cli\b/ },
  { tool: 'either', form: 'a spawn of its binary', pattern: /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\(\s*['"`](?:tick|gh)['"`]/ },
]);

/**
 * Each line of `text` naming a tool, with the form it names it in.
 * @param {string} text
 * @returns {{line: number, tool: string, form: string, text: string}[]}
 */
function toolNamesIn(text) {
  return text.split('\n').flatMap((line, at) => TOOL_FORMS
    .filter(({ pattern }) => pattern.test(line))
    .map(({ tool, form }) => ({ line: at + 1, tool, form, text: line.trim() })));
}

/** The places 7.1.10 lets name a tool, from the repository's root. */
const NAMED_HERE = Object.freeze([
  path.join('skills', 'leeway-engine', 'scripts', 'drivers'),
  path.join('skills', 'leeway-migrate', 'scripts', 'migrations'),
]);

/** Whether a path from the repository's root is a test fixture: a file under a skill's own tests. @param {string} rel */
const fixture = (rel) => rel.split(path.sep).includes('tests');

/**
 * Every file the rule holds over, from the repository's root: under
 * `skills/` and `agents/`, but in the drivers, the released migrations and
 * a skill's own tests.
 * @param {string} [repo] @returns {string[]}
 */
function shippedFiles(repo = REPO) {
  return ['skills', 'agents']
    .flatMap((top) => fs.readdirSync(path.join(repo, top), { recursive: true, encoding: 'utf8' }).map((rel) => path.join(top, rel)))
    .filter((rel) => !NAMED_HERE.some((place) => rel === place || rel.startsWith(`${place}${path.sep}`)) && !fixture(rel))
    .filter((rel) => fs.statSync(path.join(repo, rel)).isFile())
    .sort();
}

module.exports = { TOOL_FORMS, NAMED_HERE, toolNamesIn, shippedFiles, REPO };
