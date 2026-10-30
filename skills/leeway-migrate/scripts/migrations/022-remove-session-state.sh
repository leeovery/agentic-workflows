#!/bin/bash
#
# Migration 022: Remove session state system
#   The session state / compaction recovery hook system has been removed.
#   This migration cleans up:
#   1. .workflows/.cache/sessions/ directory (stale session YAML files)
#   2. .claude/settings.json dangling hook entries (session-env, compact-recovery, session-cleanup)
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"
SETTINGS_FILE="${PROJECT_DIR:-.}/.claude/settings.json"

# --- Step 1: Remove .workflows/.cache/sessions/ ---

SESSIONS_DIR="$WORKFLOWS_DIR/.cache/sessions"

if [ -d "$SESSIONS_DIR" ]; then
  rm -rf "$SESSIONS_DIR"
  report_update
fi

# --- Step 2: Clean up .claude/settings.json ---
# Remove our SessionStart and SessionEnd hook entries that reference the deleted scripts.
# Preserve any other user hooks and settings.

if [ -f "$SETTINGS_FILE" ] && grep -qE "workflows/session-env\.sh|workflows/compact-recovery\.sh|workflows/session-cleanup\.sh" "$SETTINGS_FILE" 2>/dev/null; then
  if command -v node >/dev/null 2>&1; then
    result=$(node -e "
      const fs = require('fs');
      const settings = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      let changed = false;

      if (settings.hooks) {
        // Remove our SessionStart entries (session-env.sh, compact-recovery.sh)
        if (Array.isArray(settings.hooks.SessionStart)) {
          const before = settings.hooks.SessionStart.length;
          settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
            const hooks = entry.hooks || [];
            return !hooks.some(h => h.command && (
              h.command.includes('workflows/session-env.sh') ||
              h.command.includes('workflows/compact-recovery.sh')
            ));
          });
          if (settings.hooks.SessionStart.length !== before) changed = true;
          if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
        }

        // Remove our SessionEnd entries (session-cleanup.sh)
        if (Array.isArray(settings.hooks.SessionEnd)) {
          const before = settings.hooks.SessionEnd.length;
          settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(entry => {
            const hooks = entry.hooks || [];
            return !hooks.some(h => h.command && h.command.includes('workflows/session-cleanup.sh'));
          });
          if (settings.hooks.SessionEnd.length !== before) changed = true;
          if (settings.hooks.SessionEnd.length === 0) delete settings.hooks.SessionEnd;
        }

        // Remove hooks key entirely if empty
        if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
      }

      if (changed) {
        if (Object.keys(settings).length === 0) {
          fs.unlinkSync(process.argv[1]);
          console.log('removed');
        } else {
          fs.writeFileSync(process.argv[1], JSON.stringify(settings, null, 2) + '\n');
          console.log('cleaned');
        }
      }
    " "$SETTINGS_FILE" 2>/dev/null) || true

    if [ "$result" = "removed" ]; then
      report_update
    elif [ "$result" = "cleaned" ]; then
      report_update
    fi
  fi
fi
