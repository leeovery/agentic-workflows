#!/bin/bash
#
# Migration 042: Allow workflow sub-agents to write under .workflows/
#
# Parallel-dispatched sub-agents (analysis trio, review verifiers, discussion
# perspectives, spec review) run as background sub-agents that cannot surface
# permission prompts — any Write/Edit that would prompt is auto-denied, so they
# fail to persist their artifact files. A path-scoped allow-rule resolves before
# that auto-deny, letting them write to the workflow tree without a prompt.
#
# Idempotent: skips when both rules already present.
#

SETTINGS_DIR="${PROJECT_DIR:-.}/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ] && node -e "
  const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const allow = (s.permissions && s.permissions.allow) || [];
  const need = ['Write(.workflows/**)', 'Edit(.workflows/**)'];
  process.exit(need.every(r => allow.includes(r)) ? 0 : 1);
" "$SETTINGS_FILE" 2>/dev/null; then
  return 0
fi

mkdir -p "$SETTINGS_DIR"
[ -f "$SETTINGS_FILE" ] || echo '{}' > "$SETTINGS_FILE"

node -e "
  const fs = require('fs');
  const settings = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  settings.permissions = settings.permissions || {};
  settings.permissions.allow = settings.permissions.allow || [];
  for (const rule of ['Write(.workflows/**)', 'Edit(.workflows/**)']) {
    if (!settings.permissions.allow.includes(rule)) settings.permissions.allow.push(rule);
  }
  fs.writeFileSync(process.argv[1], JSON.stringify(settings, null, 2) + '\n');
" "$SETTINGS_FILE"

report_update
