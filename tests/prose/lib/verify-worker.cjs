'use strict';

// One verifying thread: takes {caseId, which}, answers what
// `verifySnapshot` answered. A world is rebuilt in its own temp directory by
// synchronous recipe code, so the thread runs the harness unchanged — and
// requiring it here pins the same hermetic environment the parent pinned,
// reusing the empty config directory the thread inherits.
//
// An Error crosses a thread boundary with its prototype but not its stack's
// context, so the failure is sent as a message and rebuilt by the pool.

const { parentPort } = require('worker_threads');

const worlds = require('./worlds.cjs');

parentPort.on('message', ({ caseId, which }) => {
  try {
    parentPort.postMessage({ ok: true, result: worlds.verifySnapshot(caseId, which) });
  } catch (e) {
    parentPort.postMessage({ ok: false, message: e.message, stack: e.stack });
  }
});
