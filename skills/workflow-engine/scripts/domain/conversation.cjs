'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the conversation's folder — what belongs to one Claude Code
// conversation rather than to a work unit. A conversation visits several
// work units, or none (the start menu, the roadmap), so its records cannot
// live in a unit's cache, which goes when the unit closes. Each conversation
// that runs the workflows has one folder,
// `.workflows/.cache/.conversations/{session-id}/`, keyed by the session id
// Claude Code hands every command it runs, and each concern writes a file of
// its own there, so no two writers ever share one:
//
//   workflow       the mark that the conversation runs the workflows, which
//                  the gate mod reads to set the workflow harness — written
//                  by every engine and gateway call that carries a session id
//   transcript     the conversation's transcript path, written as it ends by
//                  the SessionEnd hook
//   position.json  the tmux label's resume position (session-label.cjs)
//   gate.json      the gate the mod keeps for a resume (the mod's own)
//   rows.json      each answer row the rows mod redrew, by message id (its own)
//
// A folder goes at boot once the transcript it names is gone: Claude Code
// has deleted the conversation, so nothing can resume it, and whatever
// retention the person set is the retention these records keep. A folder
// whose conversation ended without the hook names no transcript and stays.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const MARKER = 'workflow';
const TRANSCRIPT = 'transcript';

/** @param {string} cwd */
function conversationsRoot(cwd) {
  return path.join(cwd, '.workflows', '.cache', '.conversations');
}

/**
 * A conversation's folder, named by the session id's safe characters alone
 * — a hook hands the id over on stdin, and it never escapes the root.
 * @param {string} cwd @param {string} sessionId
 */
function conversationDir(cwd, sessionId) {
  return path.join(conversationsRoot(cwd), sessionId.replace(/[^A-Za-z0-9_-]/g, ''));
}

/**
 * Mark the calling conversation as one that runs the workflows — once, and
 * only where Claude Code handed the command a session id. A mark that
 * cannot be written costs the command nothing.
 * @param {string} cwd
 */
function markConversation(cwd) {
  const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
  if (!sessionId) return;
  const marker = path.join(conversationDir(cwd, sessionId), MARKER);
  if (fs.existsSync(marker)) return;
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '');
  } catch { /* the command stands without it */ }
}

/**
 * Record the ending conversation's transcript path — `conversation end`,
 * the SessionEnd hook's target — in its folder, and only where the folder
 * exists: a conversation that never ran the workflows gets nothing. Never
 * throws: a hook must exit clean.
 * @param {string} cwd @param {unknown} sessionId @param {unknown} transcriptPath
 * @returns {{recorded: boolean}}
 */
function endConversation(cwd, sessionId, transcriptPath) {
  if (typeof sessionId !== 'string' || !sessionId || typeof transcriptPath !== 'string' || !transcriptPath) {
    return { recorded: false };
  }
  const dir = conversationDir(cwd, sessionId);
  if (!fs.existsSync(dir)) return { recorded: false };
  try {
    fs.writeFileSync(path.join(dir, TRANSCRIPT), transcriptPath);
    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}

/**
 * Boot's tidy-up: delete every folder whose transcript names a file that no
 * longer exists. A folder naming none stays, and one that cannot be deleted
 * waits for the next boot.
 * @param {string} cwd
 */
function tidyConversations(cwd) {
  const root = conversationsRoot(cwd);
  /** @type {string[]} */
  let folders = [];
  try {
    folders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return; }
  for (const folder of folders) {
    const dir = path.join(root, folder);
    let transcript = '';
    try { transcript = fs.readFileSync(path.join(dir, TRANSCRIPT), 'utf8'); } catch { continue; }
    if (!transcript || fs.existsSync(transcript)) continue;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* the next boot tries again */ }
  }
}

module.exports = { conversationDir, markConversation, endConversation, tidyConversations };
