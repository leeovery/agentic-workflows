'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the brief hook — Claude Code's hook before Agent and
// SendMessage, which hands one of the workflows' own agents the brief the
// engine issued for it, and refuses a dispatch of one, or a message to one,
// carrying anything else (6.5.7, 13.11.11). Boot installs it in the
// project's settings beside the layout hook, so it holds with or without
// the mod (6.3.10).
//
// The workflows' agents are those named `leeway-*`: an Agent call's
// `subagent_type`, or the type a SendMessage's recipient was dispatched as,
// from its record beside the conversation's transcript (conversation.cjs).
// Any other call it leaves alone, saying nothing and recording nothing
// (6.5.8): Claude's own subagents, a message to one, a message to a
// recipient with no record, and a call it cannot read.
//
// One of the workflows' agents takes its brief by the pointer `brief:{id}`,
// alone in every field that carries the call's text — Agent's `prompt`,
// SendMessage's `message` and `content` (brief-names.cjs). The hook finds
// the brief, and what it was issued as, in the folder of the conversation
// stdin's `session_id` names — a subagent's own call carries the
// conversation's — and answers with the tool's input whole, the stored
// brief in place of each pointer, as PreToolUse's `updatedInput`, deciding
// no permission: the person's own rules still hold.
//
// It refuses, on stderr with exit 2, the code Claude Code blocks on: an
// agent no role is dispatched as (`no-template`); a call naming no brief
// (`no-brief`); a brief this conversation never issued, either of its files
// missing (`never-issued`); a pointer with anything beside it (`altered`);
// a brief issued for another agent (`other-agent`); and any failure
// checking one of the workflows' agents (`error`). Each refusal appends a
// line to `{config}/brief-refusals.jsonl`, across the person's projects
// (6.5.9, 6.5.12) — one append of one short line, so the hook never waits
// on a lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { isoNow } = require('./dates.cjs');
const { subagentType } = require('./conversation.cjs');
const { projectOf } = require('./trust-log.cjs');
const { ROLES, BRIEF_REFUSALS, briefPath, issuedPath, pointerOf, pointedId } = require('./brief-names.cjs');

/** How the workflows' agents are named. */
const OURS = 'leeway-';

/** @typedef {Record<string, unknown>} HookInput */
/** @typedef {{reason: string, brief: string|null, detail: string}} Refusal */

/**
 * The type a message's recipient was dispatched as; null where the call
 * names no recipient, or its record cannot be found.
 * @param {HookInput} input @returns {string|null}
 */
function recipientType({ session_id: session, transcript_path: transcript, tool_input: toolInput }) {
  const { to } = /** @type {Record<string, unknown>} */ (toolInput);
  const named = [session, transcript, to].every((value) => typeof value === 'string' && value !== '');
  return named ? subagentType(/** @type {string} */ (transcript), /** @type {string} */ (session), /** @type {string} */ (to)) : null;
}

/**
 * Each tool the hook stands before: the agent a call of it reaches, and the
 * fields that carry its text.
 * @type {Readonly<Record<string, {agentOf: (input: HookInput) => unknown, carriers: readonly string[]}>>}
 */
const DISPATCHES = Object.freeze({
  Agent: { agentOf: (input) => /** @type {Record<string, unknown>} */ (input.tool_input).subagent_type, carriers: ['prompt'] },
  SendMessage: { agentOf: recipientType, carriers: ['message', 'content'] },
});

/** The tools the hook stands before, as the settings' matcher names them. */
const BRIEF_HOOK_TOOLS = Object.keys(DISPATCHES);

/**
 * The workflows' agent a call reaches; null where it reaches none of
 * theirs, or the call cannot be read.
 * @param {HookInput} input @returns {string|null}
 */
function oursReached(input) {
  const { tool_name: tool, tool_input: toolInput } = input;
  if (typeof tool !== 'string' || !Object.hasOwn(DISPATCHES, tool) || toolInput === null || typeof toolInput !== 'object') return null;
  const agent = DISPATCHES[tool].agentOf(input);
  return typeof agent === 'string' && agent.startsWith(OURS) ? agent : null;
}

/** A file of a stored brief; null where there is none. @param {string} file @returns {string|null} */
function storedText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return null;
    throw err;
  }
}

/** @param {string} reason @param {string|null} brief @param {string} detail @returns {Refusal} */
const refusal = (reason, brief, detail) => ({ reason, brief, detail });

/** The refusal of a call of `agent` that could not be checked. @param {string} agent @param {string|null} brief @param {unknown} err */
const unchecked = (agent, brief, err) => refusal('error', brief, `the brief for ${agent} could not be checked: ${messageOf(err)}`);

/** The roles dispatched as `agent`. @param {string} agent */
const rolesOf = (agent) => Object.keys(ROLES).filter((role) => ROLES[role].agent === agent);

/**
 * The pointer a call of `agent` carries, and the fields carrying it; or why
 * it is refused, where no field names a brief or any holds more than the
 * pointer.
 * @param {HookInput} input @param {string} agent
 * @returns {{id: string, carriers: string[]}|Refusal}
 */
function carriedPointer(input, agent) {
  const toolInput = /** @type {Record<string, unknown>} */ (input.tool_input);
  const carriers = DISPATCHES[/** @type {string} */ (input.tool_name)].carriers.filter((field) => typeof toolInput[field] === 'string');
  const id = carriers.map((field) => pointedId(/** @type {string} */ (toolInput[field]))).find((pointed) => pointed !== null) ?? null;
  if (id === null) {
    return refusal('no-brief', null, `a call of ${agent} carries the pointer to its brief, brief:{id}, as \`engine brief\` answers it — this one names no brief`);
  }
  const loose = carriers.filter((field) => toolInput[field] !== pointerOf(id));
  if (loose.length > 0) {
    return refusal('altered', id, `the ${loose.join(' and ')} ${loose.length > 1 ? 'carry' : 'carries'} more than brief ${id}'s pointer — a call of ${agent} carries the pointer alone, and the hook hands over the brief as issued`);
  }
  return { id, carriers };
}

/**
 * The brief `id` as the conversation `session` stored it for `agent`; or
 * why it is refused, where the conversation holds no such brief or issued
 * it for another agent. Throws where it cannot be read.
 * @param {string} session @param {string} id @param {string} agent
 * @returns {{brief: string}|Refusal}
 */
function issuedBrief(session, id, agent) {
  const [issued, brief] = [storedText(issuedPath(session, id)), storedText(briefPath(session, id))];
  if (issued === null || brief === null) {
    return refusal('never-issued', id, `brief ${id} was never issued in this conversation — \`engine brief\` issues one, and the call carries the pointer it answers`);
  }
  const { agent: issuedFor } = JSON.parse(issued);
  if (typeof issuedFor !== 'string') throw new Error(`what brief ${id} was issued as names no agent`);
  if (issuedFor === agent) return { brief };
  const issuing = rolesOf(agent).map((role) => `\`engine brief ${role}\``).join(' or ');
  return refusal('other-agent', id, `brief ${id} was issued for ${issuedFor}, not ${agent} — ${issuing} issues one for ${agent}`);
}

/**
 * The brief a call of one of the workflows' agents carries, checked: the
 * tool's input with the brief in place of each pointer, or why it is
 * refused. Throws where the brief cannot be read.
 * @param {HookInput} input @param {string} agent
 * @returns {{updatedInput: Record<string, unknown>}|Refusal}
 */
function checkedBrief(input, agent) {
  if (rolesOf(agent).length === 0) {
    return refusal('no-template', null, `${agent} is named as one of the workflows' agents, and no role is dispatched as ${agent} — there is no template to brief it from`);
  }
  const session = input.session_id;
  if (typeof session !== 'string' || session === '') throw new Error('the hook was handed no session id');
  const carried = carriedPointer(input, agent);
  if ('reason' in carried) return carried;
  /** @type {{brief: string}|Refusal} */
  let issued;
  try {
    issued = issuedBrief(session, carried.id, agent);
  } catch (err) {
    return unchecked(agent, carried.id, err);
  }
  if ('reason' in issued) return issued;
  return { updatedInput: { .../** @type {object} */ (input.tool_input), ...Object.fromEntries(carried.carriers.map((field) => [field, issued.brief])) } };
}

/**
 * A refusal appended to the refusals' file, one line written whole; one
 * that cannot be written costs the refusal nothing.
 * @param {string} cwd @param {HookInput} input @param {string} agent @param {Refusal} refused
 */
function recordRefusal(cwd, input, agent, { reason, brief, detail }) {
  const session = typeof input.session_id === 'string' ? input.session_id : null;
  try {
    const { project, project_name: name } = projectOf(cwd);
    const line = { v: 1, at: isoNow(), project_id: project, project: name, session, tool: input.tool_name, agent, brief, reason, detail };
    fs.mkdirSync(systemConfigDir(), { recursive: true });
    fs.appendFileSync(path.join(systemConfigDir(), BRIEF_REFUSALS), `${JSON.stringify(line)}\n`);
  } catch { /* the refusal stands without its line */ }
}

/**
 * The hook's answer to the call `input` describes: null where it lets the
 * call through untouched; the hook's output where it hands the agent its
 * brief; why, where it refuses the call, the refusal recorded.
 * @param {string} cwd the conversation's folder @param {HookInput} input the hook's stdin JSON
 * @returns {{answer: object}|{refused: string}|null}
 */
function guardDispatch(cwd, input) {
  const agent = oursReached(input);
  if (agent === null) return null;
  /** @type {{updatedInput: Record<string, unknown>}|Refusal} */
  let checked;
  try {
    checked = checkedBrief(input, agent);
  } catch (err) {
    checked = unchecked(agent, null, err);
  }
  if ('updatedInput' in checked) {
    return { answer: { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: checked.updatedInput } } };
  }
  recordRefusal(cwd, input, agent, checked);
  return { refused: checked.detail };
}

module.exports = { BRIEF_HOOK_TOOLS, guardDispatch };
