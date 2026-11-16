'use strict';

//
// Migration 061: Label positions move into the conversation folders
//
// A tmux label's resume position was recorded in the session-label store,
// `.workflows/.cache/.session-labels/positions/{session_id}.json`. What
// belongs to one conversation now lives in its own folder beside the
// workflows' system config — `{config}/conversations/{session_id}/`, where
// `{config}` is `WORKFLOWS_CONFIG_DIR`, else `~/.config/workflows` — found by
// the session id from any directory, so each position moves there as
// `position.json`, its content unchanged, and the emptied `positions/`
// directory goes. The folder sits outside the project, on another file
// system where the home directory is on one, so a move that cannot rename
// copies and removes.
//
// A folder already holding a position had it written by the engine after
// the legacy one, so the newer stands and the legacy file is dropped.
// Anything in `positions/` that is not a position file the engine wrote
// stays where it is, and so does the directory holding it.
//
// Idempotent: once moved, nothing is left to move. Two boots running it at
// once never fail over a position: one the other moved first is left to it,
// counted by the run that moved it.
//

const fs = require('fs');
const os = require('os');
const path = require('path');

const POSITION_FILE = /^[A-Za-z0-9_-]+\.json$/;

function move(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

module.exports = {
  id: '061',
  description: 'move the tmux label positions into the conversation folders',
  run({ projectDir, reportUpdate, reportSkip }) {
    const legacy = path.join(projectDir, '.workflows', '.cache', '.session-labels', 'positions');
    const config = process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');
    let entries;
    try {
      entries = fs.readdirSync(legacy, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }
    let moved = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !POSITION_FILE.test(entry.name)) continue;
      const from = path.join(legacy, entry.name);
      const to = path.join(config, 'conversations', path.basename(entry.name, '.json'), 'position.json');
      try {
        if (fs.existsSync(to)) {
          fs.unlinkSync(from);
        } else {
          fs.mkdirSync(path.dirname(to), { recursive: true });
          move(from, to);
        }
      } catch (err) {
        if (fs.existsSync(from)) throw err;
        continue;
      }
      reportUpdate();
      moved++;
    }
    try { fs.rmdirSync(legacy); } catch { /* something other than a position stays in it */ }
    if (moved === 0) reportSkip();
  },
};
