#!/usr/bin/env node
'use strict';

// Every dispatch a walker makes is held.
//
// Prose that dispatches an agent composes the dispatch — which agent,
// which inputs in its prompt, whether it runs in the background — and a
// case can claim any of that. A walker with no way to dispatch never
// composes one, so nothing recorded what a dispatch would have carried.
// So the walker makes the real Agent call, exactly as the prose asks, and
// this hook — a PreToolUse hook on `Agent|Task` in the walker's own
// frontmatter — records the call whole and refuses it. No agent runs in
// the world; the walker then applies the case's substitution, or plays
// the agent, just as it did before it could dispatch at all.
//
// The walker's frontmatter hooks see its caller's calls too — the
// orchestrator dispatching a walker or an asserter — so this acts only on
// a payload whose agent is the walker. Blocking the orchestrator would
// stop every run before it began.
//
// Recorded into the world: the call as one JSON line in
// .walk-dispatches.jsonl — tool_use_id, tool name and the whole
// tool_input, the prompt uncapped — and an ordering row in the action
// log, `PreToolUse  Agent  <agent> — <description>  held  <tool_use_id>`,
// so a dispatch sits in sequence with the commands around it.
//
// It fails closed. A walker's call is refused whether or not its world
// could be found and its record written: an agent let through would run
// for real inside a world the walk is meant to be judged on. A call held
// but not recorded is caught at the walker's stop, where record-action
// finds it in the transcript with no held record and writes an UNHELD
// row; `run.cjs assert` then refuses the world.
//
// The refusal's reason — what the walker reads next — is the
// `dispatch-held` section of prompts/walker.md, never words composed here.

const fs = require('fs');
const path = require('path');

const WALKER = 'prose-walker';
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);
const DISPATCHES = '.walk-dispatches.jsonl';
const LOG = '.walk-actions.log';

function read() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function oneLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * The world this walker walks: named in the payload — the dispatch's own
 * prompt, most often — or else read out of the walker's transcript, which
 * the runtime keeps by agent id and whose first turn names its world.
 */
function resolveWorld(payload, transcripts) {
  const named = transcripts.worldIn(JSON.stringify(payload));
  if (named && fs.existsSync(named)) return named;
  const found = transcripts.findAgentTranscript(payload.agent_id, { near: payload.transcript_path });
  if (!found.file) return null;
  const traced = transcripts.fromTranscript(found.file).world;
  return traced && fs.existsSync(traced) ? traced : null;
}

function record(payload) {
  const transcripts = require('./transcripts.cjs');
  const world = resolveWorld(payload, transcripts);
  if (!world) return;
  const input = payload.tool_input || {};
  let outcome = 'held';
  try {
    fs.appendFileSync(path.join(world, DISPATCHES), `${JSON.stringify({
      tool_use_id: payload.tool_use_id || null,
      tool_name: payload.tool_name,
      tool_input: input,
    })}\n`);
  } catch (e) {
    outcome = `held, unrecorded: ${oneLine(e.message)}`;
  }
  const row = [
    'PreToolUse',
    'Agent',
    oneLine(`${input.subagent_type || '-'} — ${input.description || ''}`).split(world).join('.'),
    outcome,
    payload.tool_use_id || '-',
  ];
  fs.appendFileSync(path.join(world, LOG), `${row.join('\t')}\n`);
}

function reason() {
  try {
    return require('./prompts.cjs').loadTemplate('walker')['dispatch-held'] || null;
  } catch {
    return null;
  }
}

function main() {
  const payload = read();
  if (!payload || payload.agent_type !== WALKER || !DISPATCH_TOOLS.has(payload.tool_name)) return;
  try {
    record(payload);
  } catch { /* fail closed: the refusal below goes out whatever happened here */ }
  const decision = { hookEventName: 'PreToolUse', permissionDecision: 'deny' };
  const text = reason();
  if (text) decision.permissionDecisionReason = text;
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: decision })}\n`);
}

main();
