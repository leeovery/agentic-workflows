#!/bin/bash
#
# Migration 045: Move discovery session logs into discovery/sessions/
#
# Session logs relocated from .workflows/{wu}/discovery/session-NNN.md to
# .workflows/{wu}/discovery/sessions/session-NNN.md, so later epic-scoped
# discovery artifacts can live at the discovery/ level rather than alongside
# the logs.
#
# For every work unit, move each discovery/session-NNN.md file into
# discovery/sessions/. Single-phase work units (one session-001.md) move
# identically; non-session files in discovery/ (notes, future artifacts) are
# left in place.
#
# Idempotent: logs already under sessions/ are untouched, and a file whose
# destination already exists is left alone — a re-run finds nothing to move.
# No manifest rewrite: active_session holds only the NNN and discovery.cjs
# reconstructs the path.
#
# Direct node for fs — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

moved=$(node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
let moved = 0;

const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const discDir = path.join(wfDir, entry.name, 'discovery');
  let logs;
  try { logs = fs.readdirSync(discDir, { withFileTypes: true }); } catch { continue; }

  const sessionsDir = path.join(discDir, 'sessions');
  for (const log of logs) {
    if (!log.isFile() || !/^session-\d+\.md\$/.test(log.name)) continue;
    const src = path.join(discDir, log.name);
    const dest = path.join(sessionsDir, log.name);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(sessionsDir, { recursive: true });
    try { fs.renameSync(src, dest); moved++; } catch {}
  }
}

process.stdout.write(String(moved));
" 2>/dev/null) || moved=0

if [ "${moved:-0}" -gt 0 ]; then
  report_update
else
  report_skip
fi
