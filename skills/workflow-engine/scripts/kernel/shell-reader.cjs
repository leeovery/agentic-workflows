'use strict';

// ---------------------------------------------------------------------------
// Kernel: a shell command's text read as the shell would run it, far enough
// to say which simple commands it runs, with which words, from which folder
// — running nothing. The text splits into simple commands at `;`, `&&`,
// `||`, `|`, `&`, a newline and a subshell's parentheses. A quoted word, a
// heredoc's body and a comment are data, never commands; a command
// substitution's own commands, `$(…)`, are read as the commands they are.
// Before each command's name, the assignments, the reserved words a list
// opens with (`if`, `then`, `do`, `{`, …), and `command` and `env` with
// their options, are passed over. A `cd` or `pushd` moves the folder the
// commands after it run in, within its own subshell, and a `popd` goes back
// to the folder its `pushd` left.
//
// A word is handed over as the shell hands it to the command: its quotes
// removed, its escapes read, and a leading `~` the home folder. A word that
// expands at run time — a parameter, a substitution, backquotes, an ANSI-C
// string — reads as null, since the text cannot say what it will be; so
// does the folder a `cd` to one leads to, or `cd -`, or a `popd` with no
// `pushd` before it.
// ---------------------------------------------------------------------------

const os = require('os');
const path = require('path');

/**
 * @typedef {object} SimpleCommand
 * @property {(string|null)[]} words the command's name and its arguments
 * @property {(string|null)[]} targets the words its redirections name
 * @property {string|null} cwd the folder it runs in
 */

/** @typedef {{raw: string, text: string|null}} Word  what the source spells, and what the command is handed */

/**
 * @typedef {object} Reader
 * @property {string} text
 * @property {number} at
 * @property {string|null} cwd the folder the next command runs in
 * @property {(string|null)[]} pushed the folders each `pushd` left, the last on top
 * @property {{delimiter: string, tabs: boolean}[]} heredocs those whose bodies start at the next newline
 * @property {SimpleCommand[]} commands
 */

/** The characters that end an unquoted word. */
const BREAKS = new Set([' ', '\t', '\n', ';', '&', '|', '(', ')', '<', '>']);

/** The control operators, the longer of two that share a start first. */
const CONTROLS = ['&&', '||', ';;', '|&', ';', '|', '&', '\n'];

/** A redirection operator, the descriptor before it apart. */
const REDIRECTION = /(?:\d+|&)?(<<<|<<-|<<|<&|<>|>>|>&|>\||<|>)/y;

/** The reserved words that may stand before a command's name. */
const RESERVED = new Set(['!', '{', '}', 'if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', 'time']);

/** A word that assigns a variable, as its source spells it. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;

/**
 * The words that run the command after them: the options of theirs that
 * take the next word as their value, and whether assignments come among
 * their options.
 * @type {Readonly<Record<string, {valued: ReadonlySet<string>, assigns: boolean}>>}
 */
const RUNNERS = Object.freeze({
  command: { valued: new Set(), assigns: false },
  env: { valued: new Set(['-u', '--unset', '-C', '--chdir']), assigns: true },
});

/** A parameter's name, or a special parameter's one character. */
const PARAMETER = /[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-]/y;

/**
 * Every simple command `text` runs, in the order it appears.
 * @param {string} text @param {string|null} cwd the folder the text runs in
 * @returns {SimpleCommand[]}
 */
function simpleCommands(text, cwd) {
  /** @type {Reader} */
  const reader = { text, at: 0, cwd, pushed: [], heredocs: [], commands: [] };
  readList(reader, false);
  return reader.commands;
}

/**
 * Read commands to the end of the text — or, `nested`, to the `)` that
 * closes a subshell or a substitution, whose folders go back on leaving.
 * @param {Reader} reader @param {boolean} nested
 */
function readList(reader, nested) {
  const entered = { cwd: reader.cwd, pushed: [...reader.pushed] };
  let command = openCommand();
  for (let token = nextToken(reader); token !== null; token = nextToken(reader)) {
    if (token.kind === 'word') placeWord(reader, command, token.word);
    else if (token.kind === 'redirection') command.redirection = token.op;
    else {
      settle(reader, command);
      command = openCommand();
      if (token.op === ')' && nested) break;
      if (token.op === '(') readList(reader, true);
      if (token.op === '\n') skipHeredocs(reader);
    }
  }
  settle(reader, command);
  if (nested) Object.assign(reader, entered);
}

/** @typedef {{words: Word[], targets: (string|null)[], redirection: string|null}} OpenCommand  a command still being read */

/** @returns {OpenCommand} */
function openCommand() {
  return { words: [], targets: [], redirection: null };
}

/**
 * A word read into the command being read: a heredoc's delimiter, a
 * redirection's target, or one of its own words.
 * @param {Reader} reader @param {OpenCommand} command @param {Word} word
 */
function placeWord(reader, command, word) {
  const { redirection } = command;
  command.redirection = null;
  if (redirection === '<<' || redirection === '<<-') reader.heredocs.push({ delimiter: word.text ?? word.raw, tabs: redirection === '<<-' });
  else if (redirection !== null) command.targets.push(word.text);
  else command.words.push(word);
}

/**
 * The token at the reader's place, taken, the blanks, line continuations
 * and comments before it passed over: a control operator or a parenthesis,
 * a redirection operator, or a word; null at the text's end.
 * @param {Reader} reader
 * @returns {{kind: 'control'|'redirection', op: string}|{kind: 'word', word: Word}|null}
 */
function nextToken(reader) {
  skipBlanks(reader);
  const { text, at } = reader;
  if (at >= text.length) return null;
  REDIRECTION.lastIndex = at;
  const redirection = REDIRECTION.exec(text);
  if (redirection !== null) {
    reader.at += redirection[0].length;
    return { kind: 'redirection', op: redirection[1] };
  }
  const control = text[at] === '(' || text[at] === ')' ? text[at] : CONTROLS.find((op) => text.startsWith(op, at));
  if (control === undefined) return { kind: 'word', word: readWord(reader) };
  reader.at += control.length;
  return { kind: 'control', op: control };
}

/** Past the blanks, line continuations and comments at the reader's place. @param {Reader} reader */
function skipBlanks(reader) {
  for (;;) {
    const c = reader.text[reader.at];
    if (c === ' ' || c === '\t') reader.at += 1;
    else if (c === '\\' && reader.text[reader.at + 1] === '\n') reader.at += 2;
    else if (c === '#') reader.at = closing(reader.text, '\n', reader.at);
    else return;
  }
}

/**
 * The bodies of the heredocs the line just ended opened, each to its
 * delimiter alone on a line — tabs before it stripped for `<<-` — or to the
 * end of the text.
 * @param {Reader} reader
 */
function skipHeredocs(reader) {
  while (reader.heredocs.length > 0 && reader.at < reader.text.length) {
    const end = reader.text.indexOf('\n', reader.at);
    const line = reader.text.slice(reader.at, end < 0 ? reader.text.length : end);
    reader.at = end < 0 ? reader.text.length : end + 1;
    const { delimiter, tabs } = reader.heredocs[0];
    if ((tabs ? line.replace(/^\t+/, '') : line) === delimiter) reader.heredocs.shift();
  }
  reader.heredocs = [];
}

/**
 * The word at the reader's place, to the first unquoted break.
 * @param {Reader} reader @returns {Word}
 */
function readWord(reader) {
  const { text } = reader;
  const start = reader.at;
  let handed = '';
  let expands = false;
  while (reader.at < text.length && !BREAKS.has(text[reader.at])) {
    const c = text[reader.at];
    if (c === '\\') {
      handed += text[reader.at + 1] === '\n' ? '' : (text[reader.at + 1] ?? '');
      reader.at += 2;
    } else if (c === '\'') {
      const end = closing(text, '\'', reader.at + 1);
      handed += text.slice(reader.at + 1, end);
      reader.at = end + 1;
    } else if (c === '"') {
      const quoted = readDoubleQuoted(reader);
      handed += quoted.text;
      expands ||= quoted.expands;
    } else if (expansionAt(reader, false)) {
      expands = true;
    } else {
      handed += c;
      reader.at += 1;
    }
  }
  const raw = text.slice(start, reader.at);
  const home = raw === '~' || raw.startsWith('~/') ? os.homedir() + handed.slice(1) : handed;
  return { raw, text: expands ? null : home };
}

/** Where a quote opened before `from` closes; the text's end where it never does. @param {string} text @param {string} quote @param {number} from */
function closing(text, quote, from) {
  const end = text.indexOf(quote, from);
  return end < 0 ? text.length : end;
}

/**
 * A double-quoted string, from its opening quote past its closing one: what
 * it hands over, and whether it expands.
 * @param {Reader} reader @returns {{text: string, expands: boolean}}
 */
function readDoubleQuoted(reader) {
  const { text } = reader;
  let handed = '';
  let expands = false;
  reader.at += 1;
  while (reader.at < text.length && text[reader.at] !== '"') {
    const c = text[reader.at];
    const escaped = text[reader.at + 1];
    if (c === '\\' && escaped !== undefined && '$`"\\\n'.includes(escaped)) {
      handed += escaped === '\n' ? '' : escaped;
      reader.at += 2;
    } else if (expansionAt(reader, true)) {
      expands = true;
    } else {
      handed += c;
      reader.at += 1;
    }
  }
  reader.at += 1;
  return { text: handed, expands };
}

/**
 * Pass over the expansion at the reader's place — a substitution, its
 * commands read; a parameter; backquotes; outside double quotes, an ANSI-C
 * or a locale string — answering whether one stood there. A `$` that opens
 * none is the character itself.
 * @param {Reader} reader @param {boolean} quoted inside double quotes
 * @returns {boolean}
 */
function expansionAt(reader, quoted) {
  const { text } = reader;
  const c = text[reader.at];
  const next = text[reader.at + 1];
  if (c === '`') {
    let at = reader.at + 1;
    while (at < text.length && text[at] !== '`') at += text[at] === '\\' ? 2 : 1;
    reader.at = at + 1;
  } else if (c !== '$') {
    return false;
  } else if (next === '(') {
    reader.at += 2;
    readList(reader, true);
  } else if (next === '{') {
    reader.at = braceEnd(text, reader.at + 2);
  } else if (next === '\'' && !quoted) {
    reader.at = closing(text, '\'', reader.at + 2) + 1;
  } else if (next === '"' && !quoted) {
    reader.at += 1;
    readDoubleQuoted(reader);
  } else {
    PARAMETER.lastIndex = reader.at + 1;
    const name = PARAMETER.exec(text);
    if (name === null) return false;
    reader.at += 1 + name[0].length;
  }
  return true;
}

/** Past the `}` that closes a `${` opened before `from`, its quotes and nested braces read. @param {string} text @param {number} from */
function braceEnd(text, from) {
  let depth = 1;
  let at = from;
  while (at < text.length && depth > 0) {
    const c = text[at];
    if (c === '\\') at += 2;
    else if (c === '\'') at = closing(text, '\'', at + 1) + 1;
    else {
      depth += c === '{' ? 1 : c === '}' ? -1 : 0;
      at += 1;
    }
  }
  return at;
}

/**
 * A finished simple command, kept where it holds a word or a redirection,
 * and the folder the commands after it run in.
 * @param {Reader} reader @param {OpenCommand} command
 */
function settle(reader, { words, targets }) {
  const run = commandWords(words);
  if (run.length === 0 && targets.length === 0) return;
  reader.commands.push({ words: run, targets, cwd: reader.cwd });
  const [name, ...args] = run;
  if (name === 'pushd') reader.pushed.push(reader.cwd);
  if (name === 'cd' || name === 'pushd') reader.cwd = folderAfter(reader.cwd, args);
  else if (name === 'popd') reader.cwd = reader.pushed.pop() ?? null;
}

/**
 * The words a command is run with: those before its name that only set it
 * up passed over — the assignments, the reserved words, and the words that
 * run the command after them with their own options.
 * @param {Word[]} words @returns {(string|null)[]}
 */
function commandWords(words) {
  let at = 0;
  for (let word = words[0]; word !== undefined; word = words[at]) {
    if (RESERVED.has(word.raw) || ASSIGNMENT.test(word.raw)) at += 1;
    else if (word.text !== null && Object.hasOwn(RUNNERS, word.text)) at = pastSetup(words, at + 1, RUNNERS[word.text]);
    else break;
  }
  return words.slice(at).map((word) => word.text);
}

/**
 * Past a runner's options from `at`, each valued one with its value, and
 * the assignments it takes among them.
 * @param {Word[]} words @param {number} at @param {{valued: ReadonlySet<string>, assigns: boolean}} runner
 * @returns {number}
 */
function pastSetup(words, at, { valued, assigns }) {
  let next = at;
  for (let text = words[next]?.text; typeof text === 'string'; text = words[next]?.text) {
    if (text.startsWith('-')) next += valued.has(text) ? 2 : 1;
    else if (assigns && ASSIGNMENT.test(text)) next += 1;
    else break;
  }
  return next;
}

/**
 * The folder a `cd` or `pushd` with these arguments leads to from `cwd`: its
 * first operand read from there, the home folder where it has none.
 * @param {string|null} cwd @param {(string|null)[]} args @returns {string|null}
 */
function folderAfter(cwd, args) {
  const target = args.find((arg) => arg === null || arg === '-' || !arg.startsWith('-'));
  if (target === undefined) return os.homedir();
  if (target === null || target === '-') return null;
  if (path.isAbsolute(target)) return path.resolve(target);
  return cwd === null ? null : path.resolve(cwd, target);
}

module.exports = { simpleCommands };
