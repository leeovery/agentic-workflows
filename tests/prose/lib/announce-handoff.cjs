#!/usr/bin/env node
'use strict';

// Every command a walker runs in a world announces the handoff stand-in.
//
// A live session with the gate mod loaded carries `WORKFLOWS_HANDOFF=1`, so
// `engine handoff` answers `mod`: the prose ends the turn at the handoff and
// the mod carries the work into a fresh conversation. A walk runs inside the
// developer's own session, whose environment no switch reaches, and the
// unannounced answer has the prose invoke the next skill in place — a walk
// that took it would run on into a skill its case never meant to walk. So
// this hook — a PreToolUse hook on `Bash` in the walker's own frontmatter —
// prefixes each command a walker runs in a world with the announcement: the
// engine answers `mod`, and the walk ends at the recorded handoff call, where
// the prose ends it.
//
// It rewrites and decides nothing: normal permission handling applies to the
// command it hands back. record-action strips the prefix, so the record holds
// each command as the walker wrote it.

const fs = require('fs');

const WALKER = 'prose-walker';
const ANNOUNCEMENT = 'export WORKFLOWS_HANDOFF=1; ';

function read() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** A command as the walker wrote it, the announcement taken off. @param {string} command */
function unannounced(command) {
  return command.startsWith(ANNOUNCEMENT) ? command.slice(ANNOUNCEMENT.length) : command;
}

function main() {
  const payload = read();
  if (!payload || payload.agent_type !== WALKER || payload.tool_name !== 'Bash') return;
  const input = payload.tool_input || {};
  if (typeof input.command !== 'string' || input.command.startsWith(ANNOUNCEMENT)) return;
  const { worldIn } = require('./transcripts.cjs');
  if (!worldIn(JSON.stringify(payload))) return;
  const decision = { hookEventName: 'PreToolUse', updatedInput: { ...input, command: ANNOUNCEMENT + input.command } };
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: decision })}\n`);
}

if (require.main === module) main();

module.exports = { ANNOUNCEMENT, unannounced };
