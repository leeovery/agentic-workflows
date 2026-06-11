#!/bin/bash
#
# Migration 044: Allow workflow sub-agents to rename files under .workflows/
#
# The harness blocks sub-agent Write calls for report-shaped .md files
# (anthropics/claude-code#13890), so artifact-writing sub-agents write their
# deliverable as .txt and rename it to .md with Bash. Background sub-agents
# cannot surface permission prompts — the mv needs a path-scoped allow rule,
# same rationale as the Write/Edit rules from migration 042.
#
# Idempotent: skips when the rule is already present.
#

SETTINGS_DIR="${PROJECT_DIR:-.}/.claude"
SETTINGS_FILE="$SETTINGS_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ] && node -e "
  const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const allow = (s.permissions && s.permissions.allow) || [];
  process.exit(allow.includes('Bash(mv .workflows/:*)') ? 0 : 1);
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
  const rule = 'Bash(mv .workflows/:*)';
  if (!settings.permissions.allow.includes(rule)) settings.permissions.allow.push(rule);
  fs.writeFileSync(process.argv[1], JSON.stringify(settings, null, 2) + '\n');
" "$SETTINGS_FILE"

report_update
