#!/usr/bin/env node
'use strict';

// PostToolUse hook for the prose-walker agent: records what the walker
// ACTUALLY did, as the harness sees it.
//
// Declared in .claude/agents/prose-walker.md frontmatter, so it fires
// only while a walker is active. The walker plays no part in it — it
// cannot forget an entry, summarise one away, or write the log late,
// which is exactly why the log exists. Walkers were repeatedly found
// doing a full walk and then reporting only its tail; the narrative is
// now evidence of reasoning alone, and this file is the evidence of
// action.
//
// Self-scoping: every prose world lives at a temp path containing
// `prose-world-`. The payload is scanned for that path, and anything
// happening outside a world is ignored. Nothing is configured per run.
//
// The log lands at <world>/.walk-actions.log, which collectTree()
// excludes, so recording never shows up as a world difference.

const fs = require('fs');
const path = require('path');

const LOG = '.walk-actions.log';
const WORLD = /(^|[\s"'`])(\/[^\s"'`]*\/prose-world-[A-Za-z0-9]+)/;

function read() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** The salient argument, per tool — what the claim will be about. */
function summarise(tool, input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command || input.file_path || input.pattern || input.path || '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function main() {
  const payload = read();
  if (!payload) return;

  const probe = JSON.stringify(payload);
  const found = probe.match(WORLD);
  // Not a prose world: this hook has nothing to say.
  if (!found) return;
  const world = found[2].replace(/\\+/g, '');

  if (!fs.existsSync(world)) return;

  const tool = payload.tool_name || '?';
  const detail = summarise(tool, payload.tool_input);
  const failed = payload.tool_output_is_error ? ' [ERROR]' : '';
  const line = `${tool}${failed}\t${detail.replace(world, '.')}\n`;

  try {
    fs.appendFileSync(path.join(world, LOG), line);
  } catch {
    // A hook must never break the walk it is observing.
  }
}

main();
