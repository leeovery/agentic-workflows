#!/usr/bin/env node
'use strict';

// The hook that records what prose-test agents actually do.
//
// Declared in the frontmatter of prose-walker, prose-orchestrator and
// prose-asserter, so it fires only while one of them is active. The
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

const LOG = '.walk-actions.log';
const VIOLATIONS = 'tests/prose/.agent-tool-use.log';
const WORLD = /(^|[\s"'`])(\/[^\s"'`]*\/prose-world-[A-Za-z0-9]+)/;
const MAX_OUTPUT = 400;

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

/** The salient argument, per tool — what a claim will be about. */
function summarise(input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command || input.file_path || input.pattern || input.path || '';
  return flatten(raw, 200);
}

/**
 * The agent's own harness transcript — written by the runtime, not the
 * agent. Authority on the model it ran on, and on which world it walked,
 * neither of which a stop payload states.
 */
function fromTranscript(transcriptPath) {
  const blank = { world: null, model: '' };
  if (!transcriptPath) return blank;
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return blank;
  }
  const models = new Set();
  for (const line of raw.split('\n')) {
    try {
      const model = JSON.parse(line)?.message?.model;
      if (model) models.add(model);
    } catch { /* a partial line is not worth failing the record over */ }
  }
  const found = raw.match(WORLD);
  return {
    world: found ? found[2].replace(/\\+/g, '') : null,
    model: [...models].join(',') || '',
  };
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
          `${agent}\t${event}\t${tool}\t${summarise(payload.tool_input)}\n`);
      } catch { /* a hook must never break what it observes */ }
    }
    return;
  }

  // A stop event carries no tool input, so the world path that scopes
  // every other event is absent from it — resolve it from the transcript.
  const stop = event === 'Stop' || event === 'SubagentStop';
  const traced = stop ? fromTranscript(payload.agent_transcript_path) : null;
  const found = JSON.stringify(payload).match(WORLD);
  const world = found ? found[2].replace(/\\+/g, '') : traced && traced.world;
  if (!world || !fs.existsSync(world)) return;

  const parts = [
    event,
    tool,
    stop
      ? traced.model || 'model-unknown'
      : summarise(payload.tool_input).split(world).join('.'),
  ];

  if (event === 'PostToolUse') {
    parts.push(payload.tool_output_is_error ? 'ERROR' : 'ok');
    parts.push(flatten(payload.tool_output, MAX_OUTPUT).split(world).join('.'));
  } else if (event === 'PostToolUseFailure') {
    parts.push('FAILED');
    parts.push(flatten(payload.tool_output ?? payload.error, MAX_OUTPUT));
  } else if (stop) {
    parts.push(flatten(payload.last_assistant_message, MAX_OUTPUT).split(world).join('.'));
  }

  try {
    fs.appendFileSync(path.join(world, LOG), `${parts.join('\t')}\n`);
  } catch { /* a hook must never break what it observes */ }
}

main();
