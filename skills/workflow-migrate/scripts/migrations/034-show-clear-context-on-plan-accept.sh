#!/bin/bash
#
# Migration 034: Enable showClearContextOnPlanAccept
#
# Claude Code 2.1.81 hides the "clear context and approve" plan-mode button
# by default. The workflows rely on this button to clear context between
# phases via the bridge skill. This migration ensures the setting is present
# in the consumer project's .claude/settings.json.
#
# Idempotent: skips if the setting already exists with value true.
#

SETTINGS_DIR="${PROJECT_DIR:-.}/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ] && node -e "
  const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  process.exit(s.showClearContextOnPlanAccept === true ? 0 : 1);
" "$SETTINGS_FILE" 2>/dev/null; then
  return 0
fi

# Treat an unparseable settings.json as a skip rather than crash the migration
# chain over a hand-edited file (e.g. a trailing comma) — mirrors migration 046.
if [ -f "$SETTINGS_FILE" ] && ! node -e "
  JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
" "$SETTINGS_FILE" 2>/dev/null; then
  return 0
fi

mkdir -p "$SETTINGS_DIR"

if [ -f "$SETTINGS_FILE" ]; then
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    settings.showClearContextOnPlanAccept = true;
    fs.writeFileSync(process.argv[1], JSON.stringify(settings, null, 2) + '\n');
  " "$SETTINGS_FILE"
else
  printf '{\n  "showClearContextOnPlanAccept": true\n}\n' > "$SETTINGS_FILE"
fi

report_update
