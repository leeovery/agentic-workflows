#!/usr/bin/env node
'use strict';

// Every command a walker runs in a world announces the handoff stand-in.
//
// A live session with the gate mod loaded carries `WORKFLOWS_HANDOFF=1`, so
// `engine handoff` answers `mod`, and the mod cuts the answer's HANDOFF
// section from the result as it takes the handoff: the prose ends the turn
// there and the mod carries the work into a fresh conversation. A walk runs
// inside the developer's own session, whose environment no switch reaches,
// and an answer the mod did not take has the prose invoke the next skill in
// place — a walk that took it would run on into a skill its case never meant
// to walk. So this hook — a PreToolUse hook on `Bash` in the walker's own
// frontmatter — stands in for the mod: it prefixes each command a walker runs
// in a world with the announcement, and pipes a handoff call's output
// through the cut, its exit status kept. The engine answers `mod`, the
// section is gone, and the walk ends at the recorded handoff call, where the
// prose ends it.
//
// It decides nothing: normal permission handling applies to the command it
// hands back. record-action takes the stand-in back off, so the record holds
// each command as the walker wrote it.

const fs = require('fs');

const WALKER = 'prose-walker';
const ANNOUNCEMENT = 'export WORKFLOWS_HANDOFF=1; ';
const HANDOFF_CALL = /\bengine\.cjs\s+handoff\b/;
const TAKE_OPEN = 'set -o pipefail; { ';
const TAKE_CLOSE = "\n} | sed '/^=== HANDOFF /{N;d;}'";

function read() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** A command under the stand-in: announced, a handoff call's output cut. @param {string} command */
function announced(command) {
  return ANNOUNCEMENT + (HANDOFF_CALL.test(command) ? TAKE_OPEN + command + TAKE_CLOSE : command);
}

/** A command as the walker wrote it, the stand-in taken off. @param {string} command */
function unannounced(command) {
  if (!command.startsWith(ANNOUNCEMENT)) return command;
  const rest = command.slice(ANNOUNCEMENT.length);
  return rest.startsWith(TAKE_OPEN) && rest.endsWith(TAKE_CLOSE)
    ? rest.slice(TAKE_OPEN.length, -TAKE_CLOSE.length)
    : rest;
}

function main() {
  const payload = read();
  if (!payload || payload.agent_type !== WALKER || payload.tool_name !== 'Bash') return;
  const input = payload.tool_input || {};
  if (typeof input.command !== 'string' || input.command.startsWith(ANNOUNCEMENT)) return;
  const { worldIn } = require('./transcripts.cjs');
  if (!worldIn(JSON.stringify(payload))) return;
  const decision = { hookEventName: 'PreToolUse', updatedInput: { ...input, command: announced(input.command) } };
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: decision })}\n`);
}

if (require.main === module) main();

module.exports = { ANNOUNCEMENT, announced, unannounced };
