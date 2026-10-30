'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's folder — what belongs to one Claude Code
// conversation rather than to a work unit. A conversation visits several
// work units, or none (the start menu, the roadmap), so its records cannot
// live in a unit's cache, which goes when the unit closes; nor in the
// project, since the directory a conversation runs in moves under it — a
// `cd` Claude runs moves it, and a conversation can be resumed from another
// directory. Each conversation that runs the workflows has one folder beside
// the system config, `{config}/conversations/{session-id}/`, found by the
// session id Claude Code hands every command it runs, wherever the command
// runs, and each concern writes a file of its own there — the one file two
// write is the mod's `sent.json`, which the rows mod spends:
//
//   workflow       the mark that the conversation runs the workflows, which
//                  the gate mod reads to set the workflow harness, to say the
//                  phase in its spinner, to answer a compaction and to
//                  record the task's executor — written by every engine and
//                  gateway call that carries a session id, run in a project
//                  whose state already exists
//   transcript     the conversation's transcript path, written as it ends by
//                  the SessionEnd hook
//   position.json  where in the workflows the conversation is working, the
//                  task in flight with it in implementation and that task's
//                  executor (position.cjs) — what the tmux label's resume
//                  re-applies, the gate mod's spinner says, and `conversation
//                  position` names files for
//   trust-pending.jsonl
//                  the trust log's events waiting in the conversation
//                  (trust-log.cjs): those it could not append, for its next
//                  record to append first, and each call and reversal a
//                  ledger write keeps ahead of its entry, for the landing
//                  after it — made where the folder is unmarked, so an
//                  event before the project has state waits too
//   gate-shown.json
//                  the gate the conversation was last shown, with what each
//                  of its rows leads to, and its answer once given — what
//                  `gate` answers against (gate.cjs); made where the folder
//                  is unmarked too, so a gate before the project has state
//                  is answered like any other
//   raise-shown.json
//                  each raise the conversation was drawn, sealed by its id
//                  before the person answers: Claude's call with its lean,
//                  where it was raised and the question it answers, and its
//                  answer once given — what `raise show` draws again
//                  (raise.cjs)
//   briefs/        each brief the conversation issued, `{id}.md`, as its
//                  template was filled, and beside it `{id}.json`, the
//                  record of whose it is (brief.cjs): what a dispatch of one of
//                  the workflows' agents carries by its pointer
//   gate.json      the gate the mod keeps for a resume (the mod's own)
//   sent.json      what the mod last sent from a press, or a handoff's
//                  continuation with its line (the mod's; the rows mod
//                  writes null over it once it has drawn the row)
//   pressed.json   the row the mod last sent from a press: the gate's name,
//                  the answer and when — what `gate` reads to log an answer
//                  pressed (the mod's own)
//   compacted.json every note the mod appended to a compaction, with the
//                  place it carries on in (the mod's own; the rows mod reads
//                  it)
//   rows.json      each row the rows mod redrew of what the mod sent, by
//                  message id (its own)
//
// A folder goes at any project's boot once its transcript is gone: Claude
// Code has deleted the conversation, so nothing can resume it, and whatever
// retention the person set is the retention these records keep. The recorded
// path does not say where the transcript is — a resume from another
// directory hands the hook a path under that directory's project key while
// Claude Code goes on writing where the conversation began — so the path is
// read only for the directory Claude Code keeps its projects in, and the
// transcript is looked for by its file name in every project folder there. A
// folder whose conversation ended without the hook names no transcript and
// stays, as does one naming a relative path (a leading `~` is the home
// directory) or a projects directory that cannot be read, and one still
// holding trust events boot could not append (trust-log.cjs).
//
// While the conversation runs, its transcript is found the same way, by its
// file name in every project folder of the projects directory Claude Code
// keeps in its config directory (`CLAUDE_CONFIG_DIR`, else `~/.claude`); a
// transcript's last assistant message names the model it runs on, which the
// trust log keys its evidence by (16.4.4) — read past the messages Claude
// Code writes itself, which name the model `<synthetic>`. A subagent's
// commands carry the conversation's session id and nothing naming the
// subagent, so the model of a command's caller is told by where the command
// runs: in the worktree of one of the conversation's subagents still at
// work — its record beside its own transcript,
// `{session-id}/subagents/agent-{id}.meta.json`, names it, and marks it
// `finished` once it is done, a mark a resumed subagent's record drops — it
// is that subagent's, the deepest where worktrees nest; and, before its
// transcript holds an assistant message, the model its record names, if
// any. Anywhere else it is the conversation's: every subagent that records
// runs in a worktree of its own (29.14).
//
// The same record names the agent type a subagent was dispatched as, which
// tells whose agent a message sent to it reaches (brief-guard.cjs).
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { findStateRoot } = require('../kernel/state-root.cjs');
const { fileLinesBackward } = require('../kernel/file-stream.cjs');
const { realpathOrSelf, within } = require('../kernel/isolated-git.cjs');
const { handedSession } = require('../kernel/process.cjs');

const MARKER = 'workflow';
// The model Claude Code names on the messages it writes itself.
const SYNTHETIC = '<synthetic>';
const TRANSCRIPT = 'transcript';

function conversationsRoot() {
  return path.join(systemConfigDir(), 'conversations');
}

/**
 * A conversation's folder, named by the session id's safe characters alone
 * — a hook hands the id over on stdin, and it never escapes the root.
 * @param {string} sessionId
 */
function conversationDir(sessionId) {
  return path.join(conversationsRoot(), safeId(sessionId));
}

/** A session id's safe characters alone. @param {string} sessionId */
function safeId(sessionId) {
  return sessionId.replace(/[^A-Za-z0-9_-]/g, '');
}

/** Where a conversation keeps its position (position.cjs). @param {string} sessionId */
function positionPath(sessionId) {
  return path.join(conversationDir(sessionId), 'position.json');
}

/**
 * The task in flight in the conversation `sessionId` — its unit and the
 * task's `{phase}.{n}` — as its position records it; null where none is, or
 * the position cannot be read. The one read of the position that loads
 * nothing of position.cjs's, for the hook before Bash, which stands before
 * every shell command (shell-guard.cjs).
 * @param {string} sessionId @returns {{unit: string, task: string}|null}
 */
function taskInFlight(sessionId) {
  try {
    const { name, task } = JSON.parse(fs.readFileSync(positionPath(sessionId), 'utf8'));
    return typeof name === 'string' && typeof task === 'string' && task !== '' ? { unit: name, task } : null;
  } catch {
    return null;
  }
}

/**
 * Mark the calling conversation as one that runs the workflows — once, only
 * where Claude Code handed the command a session id, and only for a command
 * run inside a workflows project — one whose repository holds the state, a
 * code worktree's included: one run anywhere else marks nothing. A mark
 * that cannot be written costs the command nothing.
 * @param {string} cwd
 */
function markConversation(cwd) {
  const sessionId = handedSession();
  if (sessionId === null || findStateRoot(cwd) === null) return;
  const marker = path.join(conversationDir(sessionId), MARKER);
  if (fs.existsSync(marker)) return;
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '');
  } catch { /* the command stands without it */ }
}

/**
 * Whether the engine has marked the conversation `sessionId` as one that
 * runs the workflows — what every other writer of the folder but the trust
 * log's and the gate shown's waits on, so a conversation the engine never
 * marked gets no folder from them.
 * @param {string} sessionId
 */
function isMarked(sessionId) {
  return fs.existsSync(path.join(conversationDir(sessionId), MARKER));
}

/**
 * Record the ending conversation's transcript path — `conversation end`,
 * the SessionEnd hook's target — in its folder, and only where the folder
 * exists: a conversation that never ran the workflows gets nothing. Never
 * throws: a hook must exit clean.
 * @param {unknown} sessionId @param {unknown} transcriptPath
 * @returns {{recorded: boolean}}
 */
function endConversation(sessionId, transcriptPath) {
  if (typeof sessionId !== 'string' || !sessionId || typeof transcriptPath !== 'string' || !transcriptPath) {
    return { recorded: false };
  }
  const dir = conversationDir(sessionId);
  if (!fs.existsSync(dir)) return { recorded: false };
  try {
    fs.writeFileSync(path.join(dir, TRANSCRIPT), transcriptPath);
    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}

/**
 * The directory Claude Code keeps its projects in, read off a recorded
 * transcript path — `<projects>/<project-key>/<id>.jsonl`: a leading `~` is
 * the home directory, and a path that is still not absolute names none.
 * @param {string} recorded @returns {string|null}
 */
function projectsDir(recorded) {
  const expanded = recorded.startsWith('~/') ? path.join(os.homedir(), recorded.slice(2)) : recorded;
  return path.isAbsolute(expanded) ? path.dirname(path.dirname(expanded)) : null;
}

/**
 * Every file name the project folders in `projects` hold — none where the
 * directory is gone, and null where it, or a folder in it, cannot be read.
 * @param {string} projects @returns {Set<string>|null}
 */
function transcriptNames(projects) {
  let keys;
  try {
    keys = fs.readdirSync(projects, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch (err) {
    return /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT' ? new Set() : null;
  }
  try {
    return new Set(keys.flatMap((e) => fs.readdirSync(path.join(projects, e.name))));
  } catch { return null; }
}

/** The projects directory Claude Code keeps in its config directory. */
function claudeProjectsDir() {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
}

/**
 * The running conversation's transcript: the file named by its session id
 * in a project folder of the projects directory Claude Code keeps — null
 * where none holds it, or the directory cannot be read.
 * @param {string} sessionId @returns {string|null}
 */
function runningTranscript(sessionId) {
  const projects = claudeProjectsDir();
  const name = `${safeId(sessionId)}.jsonl`;
  try {
    for (const key of fs.readdirSync(projects, { withFileTypes: true })) {
      const file = path.join(projects, key.name, name);
      if (key.isDirectory() && fs.existsSync(file)) return file;
    }
  } catch { /* none can be found */ }
  return null;
}

/**
 * The model of a transcript line's assistant message: null where it names
 * none, undefined where the line is no assistant message, or one Claude Code
 * wrote itself.
 * @param {string} line @returns {string|null|undefined}
 */
function assistantModel(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (entry === null || typeof entry !== 'object' || entry.type !== 'assistant') return undefined;
  const model = entry.message?.model;
  if (model === SYNTHETIC) return undefined;
  return typeof model === 'string' && model !== '' ? model : null;
}

/**
 * The model a transcript's last assistant message names, read from its end:
 * null where it cannot be read, or names none.
 * @param {string} transcript @returns {string|null}
 */
function lastModel(transcript) {
  try {
    for (const line of fileLinesBackward(transcript)) {
      const model = assistantModel(line);
      if (model !== undefined) return model;
    }
  } catch { /* unread, it names none */ }
  return null;
}

/** @typedef {{transcript: string, worktree: string, model: string|null}} Subagent */

/** The folder of a conversation's subagents, beside its transcript. @param {string} transcript the conversation's */
function subagentsDir(transcript) {
  return path.join(transcript.slice(0, -path.extname(transcript).length), 'subagents');
}

/**
 * A subagent's record, beside its transcript; null where it cannot be read
 * or holds no object.
 * @param {string} transcript the subagent's @returns {Record<string, unknown>|null}
 */
function subagentRecord(transcript) {
  try {
    const record = JSON.parse(fs.readFileSync(transcript.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
    return record !== null && typeof record === 'object' ? record : null;
  } catch {
    return null;
  }
}

/**
 * The agent type the subagent `agentId` of the conversation `sessionId` was
 * dispatched as, from its record beside the conversation's transcript in
 * the project folder `transcriptPath` is in; null where it has none, or the
 * record names none.
 * @param {string} transcriptPath @param {string} sessionId @param {string} agentId @returns {string|null}
 */
function subagentType(transcriptPath, sessionId, agentId) {
  const transcript = path.join(path.dirname(transcriptPath), `${safeId(sessionId)}.jsonl`);
  const { agentType } = subagentRecord(path.join(subagentsDir(transcript), `agent-${safeId(agentId)}.jsonl`)) ?? {};
  return typeof agentType === 'string' && agentType !== '' ? agentType : null;
}

/**
 * A subagent still at work in a worktree of its own, from its record: the
 * worktree, absolute and resolved, and the model it names — a model's own
 * name, never `inherit`; null where it is done, names no worktree of its
 * own, or cannot be read.
 * @param {string} transcript the subagent's @returns {Subagent|null}
 */
function workingSubagent(transcript) {
  const record = subagentRecord(transcript);
  if (record === null || record.finished === true) return null;
  const { worktreePath, model } = record;
  if (typeof worktreePath !== 'string' || !path.isAbsolute(worktreePath)) return null;
  return { transcript, worktree: realpathOrSelf(worktreePath), model: typeof model === 'string' && model !== '' && model !== 'inherit' ? model : null };
}

/**
 * The running conversation's subagent at work in the worktree that holds
 * `cwd`, the deepest where worktrees nest, from the folder beside the
 * conversation's transcript; null where none does.
 * @param {string} transcript @param {string} cwd @returns {Subagent|null}
 */
function subagentAt(transcript, cwd) {
  const dir = subagentsDir(transcript);
  let names;
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl'));
  } catch {
    return null;
  }
  const here = realpathOrSelf(cwd);
  /** @type {Subagent|null} */
  let deepest = null;
  for (const name of names) {
    const subagent = workingSubagent(path.join(dir, name));
    if (subagent === null || !within(here, subagent.worktree)) continue;
    if (deepest === null || subagent.worktree.length > deepest.worktree.length) deepest = subagent;
  }
  return deepest;
}

/**
 * The model the command calling from `cwd` in the conversation `sessionId`
 * runs on: the subagent's at work in the worktree that holds `cwd` — its
 * record's before its transcript names one — else the conversation's. Null
 * where a transcript cannot be found or read, or names none.
 * @param {string} sessionId @param {string} cwd @returns {string|null}
 */
function callerModel(sessionId, cwd) {
  const transcript = runningTranscript(sessionId);
  if (transcript === null) return null;
  const subagent = subagentAt(transcript, cwd);
  return subagent === null ? lastModel(transcript) : lastModel(subagent.transcript) ?? subagent.model;
}

/**
 * Boot's tidy-up: delete every folder whose transcript no project folder
 * holds, reading each projects directory once. A folder naming none stays,
 * as does one `keeps` holds on to — boot's, one a trust log event still
 * waits in — and one that cannot be deleted waits for the next boot.
 * @param {(dir: string) => boolean} [keeps]
 */
function tidyConversations(keeps = () => false) {
  const root = conversationsRoot();
  /** @type {string[]} */
  let folders = [];
  try {
    folders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return; }
  /** @type {Map<string, Set<string>|null>} */
  const held = new Map();
  for (const folder of folders) {
    const dir = path.join(root, folder);
    let recorded;
    try { recorded = fs.readFileSync(path.join(dir, TRANSCRIPT), 'utf8'); } catch { continue; }
    const projects = projectsDir(recorded);
    if (!projects) continue;
    if (!held.has(projects)) held.set(projects, transcriptNames(projects));
    const names = held.get(projects);
    if (!names || names.has(path.basename(recorded)) || keeps(dir)) continue;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* the next boot tries again */ }
  }
}

module.exports = { conversationsRoot, conversationDir, positionPath, taskInFlight, isMarked, markConversation, endConversation, claudeProjectsDir, callerModel, subagentType, tidyConversations };
