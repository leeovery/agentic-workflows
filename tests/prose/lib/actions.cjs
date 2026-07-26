'use strict';

// What the walk actually did, read out of the harness's own record.
//
// Every subagent session is written to a JSONL transcript as it runs:
// one record per message, tool calls included, verbatim. That file is
// the only account of a walk the walker has no hand in — it cannot
// omit from it, compress it, or write it late, which is exactly the
// failure this exists to defeat. Walkers were repeatedly found doing a
// full walk and reporting only its tail.
//
// (A PostToolUse hook declared in the walker's agent frontmatter would
// have been tidier, and does not fire in this environment — verified
// with a bare `echo` probe that produced nothing. Hooks in settings.json
// do fire, but would run for every tool call in the project rather than
// just a walker's, so the transcript is both cheaper and better scoped.)

const fs = require('fs');

/** The salient argument per tool — whatever a claim would be about. */
function detailOf(input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command || input.file_path || input.pattern || input.path || '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

/**
 * Transcript JSONL → ordered tool calls. Paths inside the world are
 * shortened to `.` so the log reads as the walk rather than as a wall
 * of temp directories.
 * @param {string} file transcript path
 * @param {string} [worldDir] world root, elided from output when given
 */
function extractActions(file, worldDir) {
  if (!fs.existsSync(file)) return null;
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // a partial trailing write is not worth failing over
    }
    const content = record?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part.type !== 'tool_use') continue;
      let detail = detailOf(part.input);
      if (worldDir) detail = detail.split(worldDir).join('.');
      out.push({ tool: part.name, detail });
    }
  }
  return out;
}

function formatActions(actions) {
  if (!actions || !actions.length) return null;
  return actions
    .map((a, i) => `${String(i + 1).padStart(3)}. ${a.tool.padEnd(10)} ${a.detail}`)
    .join('\n');
}

module.exports = { extractActions, formatActions };
