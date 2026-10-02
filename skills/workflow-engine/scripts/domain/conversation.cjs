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
// runs, and each concern writes a file of its own there, so no two writers
// ever share one:
//
//   workflow       the mark that the conversation runs the workflows, which
//                  the gate mod reads to set the workflow harness — written
//                  by every engine and gateway call that carries a session
//                  id, run in a project whose `.workflows/` already exists
//   transcript     the conversation's transcript path, written as it ends by
//                  the SessionEnd hook
//   position.json  where in the workflows the conversation is working, the
//                  task in flight with it in implementation (position.cjs) —
//                  what the tmux label's resume re-applies, the gate mod's
//                  spinner says, and `conversation position` names files for
//   gate.json      the gate the mod keeps for a resume (the mod's own)
//   sent.json      what the mod last sent from a press (the mod's own)
//   compacted.json the message the mod last handed up for a compaction, with
//                  the place and the points it kept (the mod's own)
//   rows.json      each row the rows mod redrew, by message id (its own)
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
// directory) or a projects directory that cannot be read.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');

const MARKER = 'workflow';
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
  return path.join(conversationsRoot(), sessionId.replace(/[^A-Za-z0-9_-]/g, ''));
}

/**
 * Mark the calling conversation as one that runs the workflows — once, only
 * where Claude Code handed the command a session id, and only for a command
 * run inside a workflows project: one run where no `.workflows/` exists
 * marks nothing. A mark that cannot be written costs the command nothing.
 * @param {string} cwd
 */
function markConversation(cwd) {
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  if (!sessionId || !fs.existsSync(path.join(cwd, '.workflows'))) return;
  const marker = path.join(conversationDir(sessionId), MARKER);
  if (fs.existsSync(marker)) return;
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '');
  } catch { /* the command stands without it */ }
}

/**
 * Whether the engine has marked the conversation `sessionId` as one that
 * runs the workflows — what every other writer of the folder waits on, so a
 * conversation the engine never marked gets no folder from them.
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

/**
 * Boot's tidy-up: delete every folder whose transcript no project folder
 * holds, reading each projects directory once. A folder naming none stays,
 * and one that cannot be deleted waits for the next boot.
 */
function tidyConversations() {
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
    if (!names || names.has(path.basename(recorded))) continue;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* the next boot tries again */ }
  }
}

module.exports = { conversationDir, isMarked, markConversation, endConversation, tidyConversations };
