'use strict';

// A walker's own harness transcript, and where to find it.
//
// Claude Code writes every subagent's transcript beside its session's —
// `<config>/projects/<project-key>/<session-id>/subagents/agent-<id>.jsonl`,
// nested subagents flat beside the rest — and the runtime writes it, not
// the agent. So it is the authority on what a payload does not state:
// which world a walk ran in, which model it ran on, the turns it told,
// and every agent it tried to dispatch.
//
// Shared by the recorder (a stop names no world), the dispatch hold (a
// dispatch's payload may name none), and `run.cjs stop` (a stop whose hook
// never fired), so the three read the same file the same way.

const fs = require('fs');
const os = require('os');
const path = require('path');

const WORLD = /(^|[\s"'`])(\/[^\s"'`]*\/prose-world-[A-Za-z0-9]+)/;
// The runtime's tool for a subagent to hand its report back. A walker
// that tells its walk through it leaves no text turn to lift, so the
// message it hands back is a turn of the walk like any other.
const HANDBACK = 'SubagentHandback';
// The dispatch tool, under its current name and the one it replaced.
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);
const AGENT_ID = /^[A-Za-z0-9]+$/;

/** The world a text names, or null. A JSON-escaped path loses its escapes. */
function worldIn(text) {
  const found = String(text || '').match(WORLD);
  return found ? found[2].replace(/\\+/g, '') : null;
}

/** What a transcript block told, or null for a block that told nothing. */
function turnText(block) {
  if (!block) return null;
  const told = block.type === 'text' ? block.text
    : block.type === 'tool_use' && block.name === HANDBACK && block.input ? block.input.message
      : null;
  return typeof told === 'string' && told.trim() ? told.trim() : null;
}

/** A tool result's content as text, whichever shape it arrived in. */
function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).filter(Boolean).join('\n');
}

/**
 * The transcript, read: the world it walked, the model(s) it ran on, the
 * turns it told, and every dispatch it made — each with what came back
 * for it, where anything did. A missing or unreadable file reads blank.
 */
function fromTranscript(transcriptPath) {
  const blank = { world: null, model: '', turns: [], dispatches: [] };
  if (!transcriptPath) return blank;
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return blank;
  }
  const models = new Set();
  const turns = [];
  const dispatches = new Map();
  const results = new Map();
  for (const line of raw.split('\n')) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch { continue; /* a partial line is not worth failing the read over */ }
    const message = entry && entry.message;
    if (!message) continue;
    if (message.model) models.add(message.model);
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      const text = turnText(block);
      if (text) turns.push(text);
      if (block && block.type === 'tool_use' && DISPATCH_TOOLS.has(block.name) && block.id && !dispatches.has(block.id)) {
        dispatches.set(block.id, { id: block.id, name: block.name, input: block.input || {} });
      }
      if (block && block.type === 'tool_result' && block.tool_use_id) {
        results.set(block.tool_use_id, resultText(block.content));
      }
    }
  }
  return {
    world: worldIn(raw),
    model: [...models].join(',') || '',
    turns,
    dispatches: [...dispatches.values()].map((d) => ({ ...d, result: results.get(d.id) ?? null })),
  };
}

/**
 * The transcript of the agent an id names — `{file}`, or `{error}` saying
 * why there is not exactly one. `near` is a session transcript the caller
 * already holds (a hook payload's `transcript_path`): the agent's file sits
 * in that session's subagents directory, so it is looked for there first
 * and the whole projects directory is searched only when it is not.
 */
function findAgentTranscript(agentId, { near = null } = {}) {
  if (!AGENT_ID.test(String(agentId || ''))) return { error: `"${agentId}" is not an agent id` };
  const name = `agent-${agentId}.jsonl`;
  if (near) {
    const beside = path.join(path.dirname(near), path.basename(near, '.jsonl'), 'subagents', name);
    if (fs.existsSync(beside)) return { file: beside };
  }
  const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const found = [];
  let keys = [];
  try { keys = fs.readdirSync(projects); } catch { /* no projects directory holds nothing */ }
  for (const project of keys) {
    const sessions = path.join(projects, project);
    let entries;
    try {
      if (!fs.statSync(sessions).isDirectory()) continue;
      entries = fs.readdirSync(sessions);
    } catch { continue; }
    for (const session of entries) {
      const file = path.join(sessions, session, 'subagents', name);
      if (fs.existsSync(file)) found.push(file);
    }
  }
  if (found.length === 1) return { file: found[0] };
  return { error: `${found.length ? 'several transcripts' : 'no transcript'} named ${name} under ${projects}` };
}

module.exports = { WORLD, HANDBACK, DISPATCH_TOOLS, worldIn, turnText, fromTranscript, findAgentTranscript };
