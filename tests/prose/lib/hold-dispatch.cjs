#!/usr/bin/env node
'use strict';

// Every dispatch a walker makes is held.
//
// Prose that dispatches an agent composes the dispatch — which agent,
// which inputs in its prompt, whether it runs in the background — and a
// case can claim any of that. A walker with no way to dispatch never
// composes one, so nothing recorded what a dispatch would have carried.
// So the walker makes the real Agent call, exactly as the prose asks, and
// this hook — a PreToolUse hook on `Agent|Task|SendMessage` in the
// walker's own frontmatter — records the call whole and refuses it. No
// agent runs in the world; the walker then applies the case's
// substitution, or plays the agent, just as it did before it could
// dispatch at all.
//
// Prose continues an agent it dispatched by sending to the id the dispatch
// returned, and a held dispatch starts no agent to return one. So the
// refusal names one — the call's own tool_use_id — and a SendMessage the
// walker makes is held exactly as a dispatch is: a continuation is then a
// recorded send to the id of the dispatch it continues, never a second
// fresh dispatch.
//
// The walker's frontmatter hooks see its caller's calls too — the
// orchestrator dispatching a walker or an asserter — so this acts only on
// a payload whose agent is the walker. Blocking the orchestrator would
// stop every run before it began.
//
// Recorded into the world: the call as one JSON line in
// .walk-dispatches.jsonl — tool_use_id, tool name and the whole
// tool_input, the prompt or message uncapped — and an ordering row in the
// action log, `PreToolUse  Agent  <agent> — <description>  held
// <tool_use_id>` (a send's `SendMessage  <to> — <summary>`), so a
// dispatch sits in sequence with the commands around it.
//
// It fails closed. A walker's call is refused whether or not its world
// could be found and its record written: an agent let through would run
// for real inside a world the walk is meant to be judged on. A call held
// but not recorded is caught at the walker's stop, where record-action
// finds it in the transcript with no held record and writes an UNHELD
// row; `run.cjs assert` then refuses the world.
//
// The refusal's reason — what the walker reads next — is a section of
// prompts/walker.md, `dispatch-held` or `send-held` by the tool, never
// words composed here.

const fs = require('fs');
const path = require('path');

const WALKER = 'prose-walker';
const HELD = new Map([['Agent', 'dispatch-held'], ['Task', 'dispatch-held'], ['SendMessage', 'send-held']]);
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
  const { tool, detail } = transcripts.dispatchRow(payload.tool_name, input);
  const row = ['PreToolUse', tool, oneLine(detail).split(world).join('.'), outcome, payload.tool_use_id || '-'];
  fs.appendFileSync(path.join(world, LOG), `${row.join('\t')}\n`);
}

/** The refusal's reason: the tool's section, naming the held call's id. */
function reason(payload) {
  try {
    const { loadTemplate, fill } = require('./prompts.cjs');
    return fill(loadTemplate('walker')[HELD.get(payload.tool_name)], { agent_id: payload.tool_use_id }) || null;
  } catch {
    return null;
  }
}

function main() {
  const payload = read();
  if (!payload || payload.agent_type !== WALKER || !HELD.has(payload.tool_name)) return;
  try {
    record(payload);
  } catch { /* fail closed: the refusal below goes out whatever happened here */ }
  const decision = { hookEventName: 'PreToolUse', permissionDecision: 'deny' };
  const text = reason(payload);
  if (text) decision.permissionDecisionReason = text;
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: decision })}\n`);
}

main();
