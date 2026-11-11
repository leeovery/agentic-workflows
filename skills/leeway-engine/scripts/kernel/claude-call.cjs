'use strict';

// ---------------------------------------------------------------------------
// Kernel: the separate Claude call (16.19) — one question the engine itself
// puts to Claude, raw, never through a subagent, so nothing of the person's
// session, project or settings reaches it but the question (16.19.3).
//
// - The command (16.19.4): `claude -p` with the fixed system prompt, no
//   tools, no MCP servers, no settings sources, hooks and auto-memory off,
//   no slash commands or skills, nothing kept of the session, and the JSON
//   schema the answer must fit; then the model, the effort and a JSON result.
//   Never `--bare`, which reads an API key alone and so never a subscription
//   or setup-token login (16.19.5).
// - Where: a fresh empty folder, removed after; the question goes on stdin.
// - Its environment: the engine's own with auto-memory off, cleared of what
//   would carry the calling session or project in — the session's id, the
//   project's folder, what Claude Code gives every command its session runs,
//   the person's plugin folders, the gate mod's harness, and Leeway's own
//   variables. The login is left as it is: its variables pass through.
// - The binary: `claude` on PATH, or the one LEEWAY_CLAUDE names — the test
//   suite pins it to a stub, so no test reaches a real Claude.
// - Its answer: the structured output, where it fits the schema, what the
//   call cost, and the model that answered — the full id Claude Code's result
//   names in `modelUsage`, the one of the asked model's family where it names
//   several, null where it names none it can tell; or why the call cannot run
//   — no login serves it, a rate limit, a timeout, an answer that does not
//   fit the schema, or another failure, no folder to run from among them,
//   said. A call past its time is killed outright, so nothing it does holds
//   its caller longer. Only a schema an answer cannot be checked against —
//   the caller's mistake — is refused, before any call.
// - Generic: the prompt, the schema, the model, the effort, the input and the
//   time it may take are the caller's.
// - Bounded whatever ends its caller: the call runs detached, in a process
//   group of its own through one shell, its input, its answer and its exit
//   status in files of their own beside its empty folder. The shell bounds
//   itself: at the call's limit it removes both folders and kills its group,
//   and a call that ends once its caller is gone — pressed to stop, or
//   killed — removes them then, so nothing of it runs past its limit and
//   no folder outlives it.
// - Three forms, that one call: `askClaude` waits on it; `askClaudeAsync`
//   answers later, so a caller with several questions puts them at once and
//   waits about one call's time (raise.cjs, a raise's rows); and
//   `startClaude` starts it and lets its caller block on something else
//   meanwhile — another call made with `askClaude` — then waits on it, or
//   cancels it where that other work refused (ledger-write.cjs, a decision
//   labelled beside its one-decision check). Its files need nothing of the
//   event loop the blocked caller holds, so a synchronous verb can wait on
//   two calls at once. A wait polls for the status, and once the answer is
//   in, the limit passes or the call is cancelled, kills the group and
//   removes the folders itself.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { isObject } = require('./manifest-io.cjs');
const { messageOf } = require('./call.cjs');
const { sleepSync } = require('./process.cjs');
const { dropReads } = require('./git-reads.cjs');

/** The variable naming the binary, where it is not `claude` on PATH. */
const BINARY_VAR = 'LEEWAY_CLAUDE';

/**
 * The calling session's id and project folder; what else Claude Code gives
 * every command its session runs — the marks of a child of that session, its
 * process, effort, trace and skills; the session's entrypoint, its channel
 * to its peers and its link to an IDE; the person's plugin folders, which
 * Claude Code loads whatever the settings sources say; and the harness the
 * gate mod sets in a workflow session.
 */
const CLEARED = Object.freeze([
  'CLAUDE_CODE_SESSION_ID', 'CLAUDE_PROJECT_DIR',
  'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ATTENDED', 'CLAUDE_PID', 'AI_AGENT', 'CLAUDE_EFFORT', 'TRACEPARENT',
  'CLAUDE_CODE_EXECPATH', 'CLAUDE_CODE_INVOKED_SKILLS',
  'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_CODE_PLUGIN_DIRS',
  'CLAUDE_CODE_PEWTER_OWL_TOOL', 'CLAUDE_CODE_THINKING_DISPLAY_UPDATES', 'CLAUDE_CODE_SILENT_TURN_REMINDER',
]);

/** Leeway's own variables. */
const CLEARED_PREFIXES = Object.freeze(['LEEWAY_']);

/**
 * How a call runs, in a shell of its own given its files' folder, its empty
 * folder, its limit in seconds and its caller's process: a watch that, at
 * the limit, removes both folders and kills the shell's group; then the
 * call, its input from its file, its answer and what it said to theirs, its
 * exit status a line a wait reads as written once it ends; and, its caller
 * gone, both folders removed and the group killed, the watch among it.
 */
const STARTED = [
  'io=$1 dir=$2 limit=$3 caller=$4; shift 4',
  '(sleep "$limit"; rm -rf "$io" "$dir"; kill -KILL 0) &',
  '"$@" < "$io/in" > "$io/out" 2> "$io/err"; echo $? > "$io/status"',
  'kill -0 "$caller" 2> /dev/null || { rm -rf "$io" "$dir"; kill -KILL 0; }',
].join('\n');

/** The exit statuses of a shell that could not run the binary: not executable, or not found. */
const UNRUN = Object.freeze([126, 127]);

/** How often a wait on a call looks for its status. */
const POLL_MS = 5;

/** Hooks and auto-memory off, whatever any settings file says. */
const SETTINGS = JSON.stringify({ disableAllHooks: true, autoMemoryEnabled: false });

/**
 * A question for the separate call: the fixed system prompt, the JSON schema
 * its answer must fit, the model and effort it runs at, the input on stdin,
 * and how long it may take.
 * @typedef {{system: string, schema: Record<string, unknown>, model: string, effort: string, input: string, timeoutMs: number}} Ask
 */

/** Why the call cannot run. @typedef {'no-login'|'rate-limit'|'timeout'|'misfit'|'failed'} CannotRun */

/**
 * The call's answer: the structured output, the cost Claude Code reported
 * and the model that answered, each null where it reported none; or why it
 * cannot run, said.
 * @typedef {{answer: unknown, cost: number|null, model: string|null}|{cannot: CannotRun, detail: string}} Answer
 */

/** @type {Readonly<Record<string, (value: unknown) => boolean>>} */
const TYPES = Object.freeze({
  object: isObject,
  array: Array.isArray,
  string: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  integer: Number.isInteger,
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  null: (value) => value === null,
});

/** @param {unknown} value */
function isCount(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 0;
}

/**
 * The schema keywords a fit is checked against, each with what its value
 * must be for the check to read it; `description` is for the model alone.
 * @type {Readonly<Record<string, {is: string, test: (value: unknown) => boolean}>>}
 */
const KEYWORDS = Object.freeze({
  type: { is: `one of ${Object.keys(TYPES).join(', ')}`, test: (value) => typeof value === 'string' && Object.hasOwn(TYPES, value) },
  properties: { is: 'an object of schemas', test: (value) => isObject(value) && Object.values(value).every(isObject) },
  required: { is: 'a list of names', test: (value) => Array.isArray(value) && value.every((name) => typeof name === 'string') },
  additionalProperties: { is: 'true or false', test: (value) => typeof value === 'boolean' },
  items: { is: 'a schema', test: isObject },
  minItems: { is: 'a count', test: isCount },
  maxItems: { is: 'a count', test: isCount },
  minLength: { is: 'a count', test: isCount },
  enum: { is: 'a list', test: Array.isArray },
  description: { is: 'text', test: (value) => typeof value === 'string' },
});

/**
 * Where an array does not fit its schema, said; null where it fits.
 * @param {unknown[]} value @param {Record<string, any>} schema @param {string} at
 * @returns {string|null}
 */
function arrayMisfit(value, schema, at) {
  if (schema.minItems !== undefined && value.length < schema.minItems) return `${at} holds fewer than ${schema.minItems} items`;
  if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${at} holds more than ${schema.maxItems} items`;
  if (schema.items === undefined) return null;
  for (const [i, item] of value.entries()) {
    const found = misfit(item, schema.items, `${at}[${i}]`);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Where an object does not fit its schema, said; null where it fits.
 * @param {Record<string, unknown>} value @param {Record<string, any>} schema @param {string} at
 * @returns {string|null}
 */
function objectMisfit(value, schema, at) {
  const properties = schema.properties ?? {};
  const missing = (schema.required ?? []).find((/** @type {string} */ key) => !Object.hasOwn(value, key));
  if (missing !== undefined) return `${at} has no ${missing}`;
  const stray = schema.additionalProperties === false ? Object.keys(value).find((key) => !Object.hasOwn(properties, key)) : undefined;
  if (stray !== undefined) return `${at} has ${stray}, which the schema does not`;
  for (const [key, inner] of Object.entries(properties)) {
    const found = Object.hasOwn(value, key) ? misfit(value[key], inner, `${at}.${key}`) : null;
    if (found !== null) return found;
  }
  return null;
}

/**
 * Refuse a schema an answer cannot be checked against, at any depth — a
 * keyword the check does not read, or one whose value it cannot read — the
 * caller's mistake, so no part of a schema goes unchecked.
 * @param {Record<string, any>} schema
 */
function assertCheckable(schema) {
  for (const [key, value] of Object.entries(schema)) {
    if (!Object.hasOwn(KEYWORDS, key)) throw new Error(`the call's schema uses ${key}, which the engine cannot check an answer against`);
    if (!KEYWORDS[key].test(value)) throw new Error(`the call's schema gives ${key} as ${JSON.stringify(value)}, and the engine checks an answer against ${KEYWORDS[key].is}`);
  }
  for (const inner of Object.values(schema.properties ?? {})) assertCheckable(inner);
  if (schema.items !== undefined) assertCheckable(schema.items);
}

/**
 * Where `value` does not fit `schema`, said; null where it fits.
 * @param {unknown} value @param {Record<string, any>} schema @param {string} [at]
 * @returns {string|null}
 */
function misfit(value, schema, at = 'the answer') {
  if (schema.type !== undefined && !TYPES[schema.type](value)) return `${at} is not ${/^[aeiou]/.test(schema.type) ? 'an' : 'a'} ${schema.type}`;
  if (schema.enum !== undefined && !schema.enum.includes(value)) return `${at} is none of ${schema.enum.join(', ')}`;
  if (typeof value === 'string' && schema.minLength !== undefined && value.length < schema.minLength) return `${at} is shorter than ${schema.minLength}`;
  if (Array.isArray(value)) return arrayMisfit(value, schema, at);
  if (isObject(value)) return objectMisfit(value, schema, at);
  return null;
}

/** The binary the call runs. */
function binary() {
  return process.env[BINARY_VAR] || 'claude';
}

/**
 * The command line after the binary: 16.19.4's flags, then the model, the
 * effort and a JSON result.
 * @param {Ask} ask
 * @returns {string[]}
 */
function argsOf({ system, schema, model, effort }) {
  return [
    '-p', '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--settings', SETTINGS,
    '--disable-slash-commands', '--no-session-persistence', '--json-schema', JSON.stringify(schema),
    '--model', model, '--effort', effort, '--output-format', 'json',
  ];
}

/** The engine's environment, cleared of the calling session and project, auto-memory off. @returns {NodeJS.ProcessEnv} */
function envOf() {
  /** @type {NodeJS.ProcessEnv} */
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (CLEARED.includes(key) || CLEARED_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    env[key] = value;
  }
  return { ...env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
}

/** @param {CannotRun} reason @param {string} detail @returns {Answer} */
function cannot(reason, detail) {
  return { cannot: reason, detail };
}

/**
 * Why a call Claude Code reports failed cannot run, read from its result:
 * its HTTP status where it gives one, else what it says.
 * @param {Record<string, unknown>} result @param {string} said
 * @returns {CannotRun}
 */
function failureOf(result, said) {
  const status = result.api_error_status;
  if (status === 401 || status === 403 || /\/login|not logged in/i.test(said)) return 'no-login';
  if (status === 429 || /rate limit|usage limit|hit your limit/i.test(said)) return 'rate-limit';
  if (result.subtype === 'error_max_structured_output_retries') return 'misfit';
  return 'failed';
}

/** What a result says of itself, one line. @param {Record<string, unknown>} result */
function saidBy(result) {
  const errors = Array.isArray(result.errors) ? result.errors.join('; ') : '';
  const said = typeof result.result === 'string' && result.result !== '' ? result.result : errors;
  return said.replace(/\s+/g, ' ').trim() || `${result.subtype ?? 'a result'} with nothing said`;
}

/** The JSON result a run printed, or null where it printed none. @param {string} stdout @returns {Record<string, unknown>|null} */
function resultOf(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The model that answered, as the result's `modelUsage` names it by its full
 * id: the one it names, or among several the one `asked` names — the id
 * itself, or an alias of its family (`opus` in `claude-opus-5-5`); null
 * where it names none, or none of those.
 * @param {Record<string, unknown>} result @param {string} asked
 * @returns {string|null}
 */
function answeringModel(result, asked) {
  const ids = isObject(result.modelUsage) ? Object.keys(result.modelUsage) : [];
  if (ids.length === 1) return ids[0];
  return ids.find((id) => id === asked || id.split('-').includes(asked)) ?? null;
}

/**
 * The answer a finished run gives: the structured output where the result
 * holds one that fits; else why not.
 * @param {Record<string, unknown>} result @param {Ask} ask
 * @returns {Answer}
 */
function answerOfResult(result, { schema, model }) {
  if (result.is_error !== false || result.subtype !== 'success') return cannot(failureOf(result, saidBy(result)), saidBy(result));
  if (!Object.hasOwn(result, 'structured_output')) return cannot('misfit', 'the result holds no structured output');
  const found = misfit(result.structured_output, schema);
  if (found !== null) return cannot('misfit', found);
  return { answer: result.structured_output, cost: typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null, model: answeringModel(result, model) };
}

/**
 * A finished run of the binary: what it printed and how it exited; or
 * `timeout`, its limit passed first.
 * @typedef {{stdout: string, stderr: string, status: number}|'timeout'} Run
 */

/**
 * The answer a run gives: a timeout, a binary that would not run, output
 * that is no result — its stderr read for what it says — or the result's.
 * @param {Run} run @param {Ask} ask
 * @returns {Answer}
 */
function answerOf(run, ask) {
  if (run === 'timeout') return cannot('timeout', `no answer within ${ask.timeoutMs / 1000} s`);
  const result = resultOf(run.stdout);
  if (result !== null) return answerOfResult(result, ask);
  const said = (run.stderr || run.stdout || `exit ${run.status}`).replace(/\s+/g, ' ').trim();
  if (UNRUN.includes(run.status)) return cannot('failed', `${binary()} did not run: ${said}`);
  return cannot(failureOf({}, said), said);
}

/**
 * The call's own empty folder, fresh in the temp folder; or, where none can
 * be made, why the call cannot run. Refuses a schema an answer cannot be
 * checked against first.
 * @param {Ask} ask
 * @returns {string|Answer}
 */
function freshFolder(ask) {
  assertCheckable(ask.schema);
  try {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-call-'));
  } catch (err) {
    return cannot('failed', `no empty folder to run the call from: ${messageOf(err)}`);
  }
}

/** @param {string} folder */
function removeFolder(folder) {
  try {
    fs.rmSync(folder, { recursive: true, force: true });
  } catch { /* a folder that will not go stays in the temp folder, and the answer stands */ }
}

/**
 * A call started: `wait()` blocks until it answers and `answered()` answers
 * later without blocking — either once, the answer kept, as `askClaude`
 * answers; `cancel()` ends it unanswered, its group killed and its folders
 * removed, and does nothing once it has answered.
 * @typedef {{wait: () => Answer, answered: () => Promise<Answer>, cancel: () => void}} Started
 */

/** A call that cannot run, `answer` its why. @param {Answer} answer @returns {Started} */
function startedAs(answer) {
  return { wait: () => answer, answered: async () => answer, cancel: () => {} };
}

/** Wait `ms` without holding the event loop. @param {number} ms @returns {Promise<void>} */
function later(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/** A file's text, '' where it holds none. @param {string} file */
function textOf(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The run a call's files hold once its status is written; `timeout` once
 * `deadline` passes first; else null, not yet.
 * @param {string} io @param {number} deadline
 * @returns {Run|null}
 */
function ranBy(io, deadline) {
  const exited = textOf(path.join(io, 'status'));
  if (exited.endsWith('\n')) return { stdout: textOf(path.join(io, 'out')), stderr: textOf(path.join(io, 'err')), status: Number(exited) };
  return Date.now() < deadline ? null : 'timeout';
}

/**
 * The call the shell runs in `group`, its folders `io` and `folder`,
 * answering by `deadline`: its run read as it ends, then the group killed,
 * the watch among it, and both folders removed.
 * @param {number} group @param {{io: string, folder: string}} folders @param {number} deadline @param {Ask} ask
 * @returns {Started}
 */
function running(group, { io, folder }, deadline, ask) {
  /** @type {Answer|null} */
  let answer = null;
  const ended = (/** @type {Answer} */ given) => {
    if (answer !== null) return answer;
    dropReads();
    try {
      process.kill(-group, 'SIGKILL');
    } catch { /* a group gone already has nothing left to kill */ }
    removeFolder(folder);
    removeFolder(io);
    answer = given;
    return answer;
  };
  /** Whether the call has answered, its answer taken once its run ends. */
  const settled = () => {
    const run = answer === null ? ranBy(io, deadline) : null;
    if (run !== null) ended(answerOf(run, ask));
    return answer !== null;
  };
  return {
    wait() {
      while (!settled()) sleepSync(POLL_MS);
      return /** @type {Answer} */ (answer);
    },
    async answered() {
      while (!settled()) await later(POLL_MS);
      return /** @type {Answer} */ (answer);
    },
    cancel() {
      ended(cannot('failed', 'cancelled before it answered'));
    },
  };
}

/**
 * Start one question to the separate Claude call (the header's), from a
 * fresh empty folder, without waiting on it. Refuses a schema an answer
 * cannot be checked against, before any call; every other failure is an
 * answer, never a throw.
 * @param {Ask} ask
 * @returns {Started}
 */
function startClaude(ask) {
  const folder = freshFolder(ask);
  if (typeof folder !== 'string') return startedAs(folder);
  /** @type {string} */
  let io;
  try {
    io = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-call-io-'));
    fs.writeFileSync(path.join(io, 'in'), ask.input);
  } catch (err) {
    removeFolder(folder);
    return startedAs(cannot('failed', `no folder to keep the call's answer in: ${messageOf(err)}`));
  }
  dropReads();
  const child = spawn('/bin/sh', ['-c', STARTED, 'sh', io, folder, String(ask.timeoutMs / 1000), String(process.pid), binary(), ...argsOf(ask)], {
    cwd: folder, env: envOf(), stdio: 'ignore', detached: true,
  });
  child.on('error', () => { /* a shell that never started has no pid, answered below */ });
  child.unref();
  if (child.pid === undefined) {
    removeFolder(folder);
    removeFolder(io);
    return startedAs(cannot('failed', 'the shell the call runs in did not start'));
  }
  return running(child.pid, { io, folder }, Date.now() + ask.timeoutMs, ask);
}

/**
 * Put one question to the separate Claude call and wait on its answer.
 * Refuses a schema an answer cannot be checked against, before any call;
 * every other failure is an answer, never a throw.
 * @param {Ask} ask
 * @returns {Answer}
 */
function askClaude(ask) {
  return startClaude(ask).wait();
}

/**
 * `askClaude` without blocking, so several calls run at once: the same
 * call, the same answers, the same refusal.
 * @param {Ask} ask
 * @returns {Promise<Answer>}
 */
async function askClaudeAsync(ask) {
  return startClaude(ask).answered();
}

module.exports = { askClaude, askClaudeAsync, startClaude };
