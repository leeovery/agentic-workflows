#!/bin/bash
#
# Migration 046: Remove the dead Write(.workflows/**) permission rule
#
# Claude Code changed permission-rule matching: file permission checks match
# only Edit(path) rules, which now cover all file-editing tools (Edit, Write,
# NotebookEdit). The Write(.workflows/**) rule added by migration 042 is no
# longer matched and produces a warning at launch. Edit(.workflows/**) alone
# covers the sub-agent writes, so the Write rule is dropped.
#
# Idempotent: skips when the rule is absent.
#

SETTINGS_FILE="${PROJECT_DIR:-.}/.claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ] || ! node -e "
  const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const allow = (s.permissions && s.permissions.allow) || [];
  process.exit(allow.includes('Write(.workflows/**)') ? 0 : 1);
" "$SETTINGS_FILE" 2>/dev/null; then
  return 0
fi

node -e "
  const fs = require('fs');
  const settings = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  settings.permissions.allow = settings.permissions.allow.filter(r => r !== 'Write(.workflows/**)');
  fs.writeFileSync(process.argv[1], JSON.stringify(settings, null, 2) + '\n');
" "$SETTINGS_FILE"

report_update
