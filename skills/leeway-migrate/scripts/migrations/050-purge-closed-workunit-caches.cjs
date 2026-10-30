'use strict';

//
// Migration 050: Purge closed work units' scratch caches
//
// Work-unit close (complete / cancel / absorb) now removes the unit's
// `.workflows/.cache/{wu}/` scratch directory as part of the transaction.
// Existing installs closed work units before that behaviour existed, so
// their caches linger. Remove the cache directory of every work unit that
// is already `completed` or `cancelled`, and of every orphan cache whose
// work unit no longer exists (an absorbed feature's leftovers).
//
// Disk-only: cache is gitignored since migration 049. Files tracked from
// before 049 become staged deletions picked up by the boot migrations
// commit (`git add` stages deletions of tracked files regardless of
// ignore rules). In-progress units and unreadable manifests keep their
// caches — never delete scratch out from under live work.
//

const fs = require('fs');
const path = require('path');

module.exports = {
  id: '050',
  description: 'purge the scratch caches of completed/cancelled work units and orphaned cache dirs',
  run({ projectDir, reportUpdate, reportSkip }) {
    const cacheRoot = path.join(projectDir, '.workflows', '.cache');
    let entries;
    try {
      entries = fs.readdirSync(cacheRoot, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }
    let touched = false;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const workUnit = entry.name;
      const manifestPath = path.join(projectDir, '.workflows', workUnit, 'manifest.json');
      let status = null;
      let orphan = false;
      try {
        status = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).status;
      } catch (err) {
        if (err && err.code === 'ENOENT') orphan = true;
        else continue; // unreadable manifest — unknown state, keep the cache
      }
      if (!orphan && status !== 'completed' && status !== 'cancelled') continue;
      fs.rmSync(path.join(cacheRoot, workUnit), { recursive: true, force: true });
      reportUpdate();
      touched = true;
    }
    if (!touched) reportSkip();
  },
};
