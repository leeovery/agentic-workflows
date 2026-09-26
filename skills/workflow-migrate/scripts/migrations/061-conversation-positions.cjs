'use strict';

//
// Migration 061: Label positions move into the conversation folders
//
// A tmux label's resume position was recorded in the session-label store,
// `.workflows/.cache/.session-labels/positions/{session_id}.json`. What
// belongs to one conversation now lives in its own folder,
// `.workflows/.cache/.conversations/{session_id}/`, so each position moves
// there as `position.json`, its content unchanged, and the emptied
// `positions/` directory goes.
//
// Disk-only: the cache is gitignored. A folder already holding a position
// had it written by the engine after the legacy one, so the newer stands
// and the legacy file is dropped. Anything in `positions/` that is not a
// position file the engine wrote stays where it is, and so does the
// directory holding it.
//
// Idempotent: once moved, nothing is left to move.
//

const fs = require('fs');
const path = require('path');

const POSITION_FILE = /^[A-Za-z0-9_-]+\.json$/;

module.exports = {
  id: '061',
  description: 'move the tmux label positions into the conversation folders',
  run({ projectDir, reportUpdate, reportSkip }) {
    const cache = path.join(projectDir, '.workflows', '.cache');
    const legacy = path.join(cache, '.session-labels', 'positions');
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
      const to = path.join(cache, '.conversations', path.basename(entry.name, '.json'), 'position.json');
      if (fs.existsSync(to)) {
        fs.unlinkSync(from);
      } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
      }
      reportUpdate();
      moved++;
    }
    try { fs.rmdirSync(legacy); } catch { /* something other than a position stays in it */ }
    if (moved === 0) reportSkip();
  },
};
