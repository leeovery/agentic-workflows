#!/usr/bin/env node
'use strict';

//
// A stand-in for the `claude` binary, run through claude-stub.sh, which
// hermetic-env.cjs pins LEEWAY_CLAUDE to, so no test reaches a real Claude.
// It answers as `claude -p --output-format json` does, its result shaped as
// Claude Code's:
//
// - With nothing set, there is no login, as in the suite's world — its
//   Claude Code config directory is empty — and it answers as a real Claude
//   does there.
// - CLAUDE_STUB_ANSWERS, a JSON object, answers by what it is asked: the
//   first key the input holds — '' holds always — names the structured
//   output answered, or, as a string, a call that cannot run: 'no-login',
//   'rate-limit', 'failed' (an outage), 'misfit' (Claude Code giving up on
//   an answer that fits the schema), or 'timeout' (it waits past any
//   deadline, deaf to SIGTERM).
// - CLAUDE_STUB_LOG names a file each call appends one JSON line to: its
//   argv, its folder and what the folder held, its input, and its
//   environment's names — each name's value null but for the names
//   CLAUDE_STUB_LOG_VALUES lists, comma-separated, so no login the
//   environment holds is written down unasked.
// - CLAUDE_STUB_MEET, `<n>:<folder>`, holds each call at a barrier: it
//   leaves a mark in the folder and answers once the folder holds n marks,
//   so n calls made at once all answer. A call still waiting after 5 s
//   answers as an outage does: calls made one after another fail.
//

const fs = require('fs');
const path = require('path');

const input = fs.readFileSync(0, 'utf8');

if (process.env.CLAUDE_STUB_LOG) {
  const cwd = process.cwd();
  const shown = new Set((process.env.CLAUDE_STUB_LOG_VALUES ?? '').split(','));
  const env = Object.fromEntries(Object.keys(process.env).map((key) => [key, shown.has(key) ? process.env[key] : null]));
  fs.appendFileSync(process.env.CLAUDE_STUB_LOG, `${JSON.stringify({ argv: process.argv.slice(2), cwd, held: fs.readdirSync(cwd), env, input })}\n`);
}

/** What the stub answers this input: a structured output, or a failure's name. @returns {unknown} */
function answerFor() {
  if (!process.env.CLAUDE_STUB_ANSWERS) return 'no-login';
  const answers = JSON.parse(process.env.CLAUDE_STUB_ANSWERS);
  const key = Object.keys(answers).find((held) => input.includes(held));
  if (key === undefined) throw new Error(`claude stub: no answer for ${JSON.stringify(input.slice(0, 80))}`);
  return answers[key];
}

/** A result as Claude Code prints it. @param {Record<string, unknown>} fields @param {number} code */
function result(fields, code) {
  fs.writeSync(1, `${JSON.stringify({ type: 'result', duration_ms: 1, num_turns: 1, total_cost_usd: 0, session_id: 'stub', ...fields })}\n`);
  process.exitCode = code;
}

const FAILURES = {
  'no-login': () => result({ subtype: 'success', is_error: true, api_error_status: null, terminal_reason: 'api_error', result: 'Not logged in · Please run /login' }, 1),
  'rate-limit': () => result({ subtype: 'success', is_error: true, api_error_status: 429, terminal_reason: 'api_error', result: 'API Error: Request rejected (429) · rate limited' }, 1),
  failed: () => result({ subtype: 'success', is_error: true, api_error_status: 529, terminal_reason: 'api_error', result: 'API Error: 529 Overloaded' }, 1),
  misfit: () => result({ subtype: 'error_max_structured_output_retries', is_error: true, errors: ['Failed to provide valid structured output after 5 attempts'] }, 1),
  timeout: () => {
    process.on('SIGTERM', () => {});
    setTimeout(() => result({ subtype: 'success', is_error: false, result: '' }, 0), 600000);
  },
};

/** Whether this call met the others the barrier waits for; true where none is set. */
function met() {
  const meet = process.env.CLAUDE_STUB_MEET;
  if (!meet) return true;
  const at = meet.indexOf(':');
  const [count, folder] = [Number(meet.slice(0, at)), meet.slice(at + 1)];
  fs.writeFileSync(path.join(folder, String(process.pid)), '');
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (let waited = 0; waited < 5000; waited += 10) {
    if (fs.readdirSync(folder).length >= count) return true;
    Atomics.wait(nap, 0, 0, 10);
  }
  return false;
}

const answer = met() ? answerFor() : 'failed';
if (typeof answer === 'string') FAILURES[/** @type {keyof typeof FAILURES} */ (answer)]();
else result({ subtype: 'success', is_error: false, result: '', structured_output: answer, total_cost_usd: 0.01 }, 0);
