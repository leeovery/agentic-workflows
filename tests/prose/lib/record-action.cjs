#!/usr/bin/env node
'use strict';

// The hook that records what prose-test agents actually do.
//
// Declared in the frontmatter of prose-walker and prose-asserter, so it
// fires only while one of them is active. The
// agents play no part in it: they cannot forget an entry, summarise one
// away, or write it late — which is the whole point. Walkers were
// repeatedly found doing a full walk and reporting only its tail, and
// once produced a specific, plausible, false claim about what a command
// had returned. A narrative can do that; a record cannot.
//
// Every event is captured, not just the call: the intent before it
// (PreToolUse), the result after it (PostToolUse, with output), the
// failures (PostToolUseFailure), and the finish (SubagentStop, carrying
// the model the walk actually ran on). Logs are throwaway — they live in
// the disposable world and die with it — so there is no reason to record
// less than everything.
//
// The model matters because an edited agent definition does not reach a
// running session until its plugins are reloaded. A walk can therefore
// run on a model nobody intended, and a verdict trusted at the wrong one
// is worse than no verdict. Recording it makes that visible in the
// result rather than something to remember.
//
// Self-scoping: a prose world lives at a temp path containing
// `prose-world-`. The payload is scanned for one, and anything happening
// outside a world is ignored. A stop event names no file, so its world
// and its model both come from the agent transcript the payload points
// at. The asserter is the exception: it is contracted to use NO tools,
// so any tool call it makes is a contract violation and lands in a
// repo-local log instead of a world.
//
// The log is written to <world>/.walk-actions.log, which collectTree()
// excludes, so recording never shows up as a world difference.

const fs = require('fs');
const path = require('path');
const { fromTranscript, worldIn } = require('./transcripts.cjs');

const LOG = '.walk-actions.log';
const WALK = '.walk-transcript.log';
// Written by the dispatch hold (lib/hold-dispatch.cjs), one line per
// Agent call it held — read here to find a dispatch it never saw.
const DISPATCHES = '.walk-dispatches.jsonl';
const VIOLATIONS = 'tests/prose/.agent-tool-use.log';
// These caps exist to protect the asserter's prompt, never to save disk —
// every recorded action is read into it, and a walk makes twenty-odd file
// reads whose bodies are whole skill files.
//
// Only a read is incidental. Nothing is ever claimed about the bytes a
// walker read back out of a file, so those are trimmed hard. Everything a
// walk *produces* is evidence and is kept: what a command returned settles
// whether a gate rendered empty or a menu had entries, and what a write
// put in a file settles every claim about the artifact a phase leaves
// behind. Trimming a write was a read's rule applied to the wrong thing —
// it left a claim about a written file unprovable, because the only copy
// of that content lived in the response being cut.
const MAX_OUTPUT = 400;
const MAX_PRODUCED_OUTPUT = 10000;
// The detail column is the substrate the deterministic checks match
// against — a call that ran must be findable in it. It is truncated only
// after the world path collapses to `.`, and generously: every cap that
// bit into a real command has produced a false never-ran — four includes
// at the original cap (the world prefix ate the budget), then a two-seed
// `workunit create` at 600 whose second `--seed` fell off the end. The
// cap exists only to bound pathological blobs (heredoc scripts, inline
// payloads), so it sits far above any real engine call.
const MAX_DETAIL = 4000;
const WRITE_RESPONSE_TOOLS = new Set(['Bash', 'Write', 'Edit', 'NotebookEdit']);

function read() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function flatten(value, limit) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > limit ? `${oneLine.slice(0, limit)}…[truncated]` : oneLine;
}

/** The salient argument, per tool, untruncated — callers flatten it. */
function summarise(input) {
  if (!input || typeof input !== 'object') return '';
  return input.command || input.file_path || input.pattern || input.path || '';
}

/**
 * What a tool actually gave back. The payload field is `tool_response`,
 * and its shape is the tool's own: a shell reports `{stdout, stderr}`,
 * everything else answers in whatever form suits it. Reading a shell's
 * streams directly keeps a command's output legible as output rather
 * than as a JSON envelope around it.
 */
function responseText(response, limit) {
  if (response === null || response === undefined) return '';
  if (typeof response === 'object') {
    const { stdout, stderr } = response;
    if (typeof stdout === 'string' || typeof stderr === 'string') {
      return flatten([stdout, stderr].filter(Boolean).join('\n'), limit);
    }
  }
  return flatten(response, limit);
}

/**
 * The walk as it was actually told, turn by turn.
 *
 * An agent returns one final message, and a walk runs across dozens of
 * turns — so a caller who reads only the return value sees a summary the
 * walker wrote after the fact, and every step compressed out of it looks
 * like a step never taken. The turns are all in the runtime's transcript
 * already; this lifts them into the world beside the action log, where
 * the judging is done. Nothing is asked of the walker, which is what
 * makes it dependable.
 *
 * The final turn comes from the payload rather than the transcript. This
 * hook runs inside the stop sequence, not after it, and the last thing
 * the agent said is still being appended to the transcript as we read it
 * — verified: the same extraction over the settled file returns the turn
 * this misses. That turn is where a flow's closing emission lives, a
 * handoff block among them, so losing it costs exactly the evidence a
 * final claim rests on. `last_assistant_message` is the runtime handing
 * it over directly, at the one moment it is not yet on disk.
 *
 * It is appended only when it is not already the closing turn — the race
 * does not always fire. That is not deduplication: two identical turns
 * genuinely in the transcript still both appear, because a step that ran
 * twice is something the asserter must see.
 */
function writeWalk(world, turns, closing) {
  const all = turns ? turns.slice() : [];
  const tail = (closing || '').trim();
  if (tail && all[all.length - 1] !== tail) all.push(tail);
  if (!all.length) return;
  try {
    fs.writeFileSync(
      path.join(world, WALK),
      `${all.join('\n\n---\n\n').split(world).join('.')}\n`,
    );
  } catch { /* a hook must never break what it observes */ }
}

/** The ids of every dispatch the hold recorded in this world. */
function heldIds(world) {
  let raw;
  try {
    raw = fs.readFileSync(path.join(world, DISPATCHES), 'utf8');
  } catch {
    return new Set();
  }
  const ids = new Set();
  for (const line of raw.split('\n')) {
    try {
      const { tool_use_id: id } = JSON.parse(line);
      if (id) ids.add(id);
    } catch { /* an unreadable line holds no id — its dispatch reads unheld */ }
  }
  return ids;
}

/**
 * The backstop behind the dispatch hold. Every Agent call a walker makes
 * is meant to be recorded and refused by lib/hold-dispatch.cjs before it
 * runs; one the transcript holds with no held record is a call that hook
 * never saw — a real agent may have run inside the world — or one it
 * could not record. Either way the walk cannot be judged: one UNHELD row
 * per call says so, and `run.cjs assert` refuses a world carrying any.
 * The row carries what came back for the call, which is where a harness
 * that refused the call before any hook ran says why.
 */
function writeUnheld(world, dispatches) {
  if (!dispatches || !dispatches.length) return;
  const held = heldIds(world);
  const rows = dispatches.filter((d) => !held.has(d.id)).map((d) => [
    'UNHELD',
    'Agent',
    flatten(`${d.input.subagent_type || '-'} — ${d.input.description || ''}`.split(world).join('.'), MAX_DETAIL),
    d.id,
    flatten(d.result === null ? 'no result recorded' : d.result, MAX_OUTPUT).split(world).join('.'),
  ].join('\t'));
  if (!rows.length) return;
  try {
    fs.appendFileSync(path.join(world, LOG), `${rows.join('\n')}\n`);
  } catch { /* a hook must never break what it observes */ }
}

function main() {
  const payload = read();
  if (!payload) return;

  const event = payload.hook_event_name || '?';
  const tool = payload.tool_name || '-';
  const agent = payload.agent_type || 'main';

  // The asserter judges from its prompt alone. A tool call from it is a
  // breach of that contract and must be visible even though it happens
  // nowhere near a world.
  if (agent.includes('asserter') && event !== 'Stop' && event !== 'SubagentStop') {
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    if (projectDir) {
      try {
        const file = path.join(projectDir, VIOLATIONS);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file,
          `${agent}\t${event}\t${tool}\t${flatten(summarise(payload.tool_input), MAX_DETAIL)}\n`);
      } catch { /* a hook must never break what it observes */ }
    }
    return;
  }

  // A stop event carries no tool input, so the world path that scopes
  // every other event is absent from it — and a path its payload does name
  // can be a peer walker's. Resolve it from the transcript, which names the
  // world it walked.
  const stop = event === 'Stop' || event === 'SubagentStop';
  const traced = stop ? fromTranscript(payload.agent_transcript_path) : null;
  // The world log is the walker's record. The orchestrator shares this
  // hook, and its own commands carry world paths in their payloads — the
  // world it just built, the prompt it just emitted — so without this
  // gate its rows land in the walker's log ahead of the walk itself,
  // padding the record and handing the checks substrings no walk ran.
  if (!agent.includes('walker')) return;

  const world = (traced && traced.world) || worldIn(JSON.stringify(payload));
  if (!world || !fs.existsSync(world)) return;

  const parts = [
    event,
    tool,
    stop
      ? traced.model || 'model-unknown'
      : flatten(summarise(payload.tool_input).split(world).join('.'), MAX_DETAIL),
  ];

  if (event === 'PostToolUse') {
    // A call that failed never arrives here — it raises PostToolUseFailure
    // instead — so reaching this point is itself the success signal.
    parts.push('ok');
    parts.push(
      responseText(
        payload.tool_response,
        WRITE_RESPONSE_TOOLS.has(tool) ? MAX_PRODUCED_OUTPUT : MAX_OUTPUT,
      ).split(world).join('.'),
    );
  } else if (event === 'PostToolUseFailure') {
    parts.push('FAILED');
    parts.push(
      responseText(payload.tool_response ?? payload.tool_output ?? payload.error,
        MAX_PRODUCED_OUTPUT).split(world).join('.'),
    );
  } else if (stop) {
    parts.push(flatten(payload.last_assistant_message, MAX_OUTPUT).split(world).join('.'));
    writeWalk(world, traced.turns, payload.last_assistant_message);
    writeUnheld(world, traced.dispatches);
  }

  try {
    fs.appendFileSync(path.join(world, LOG), `${parts.join('\t')}\n`);
  } catch { /* a hook must never break what it observes */ }
}

main();
