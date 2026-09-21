'use strict';

// A pool of verifying threads. Worlds are independent — each rebuilds in its
// own temp directory from synchronous recipe code — so the only thing a
// rebuild shares with its siblings is the machine, and a corpus-wide rebuild
// costs what one core's share of it costs.
//
// Threads are spawned on demand up to the pool's size and kept for its
// lifetime: requiring the harness is paid once per thread, never per world.

const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const WORKER = path.join(__dirname, 'verify-worker.cjs');

/** Every core but the one running the tests. */
const POOL_SIZE = Math.max(1, os.availableParallelism() - 1);

/** A failure a worker reported, as an Error again. */
function reported({ message, stack }) {
  const error = new Error(message);
  if (stack) error.stack = stack;
  return error;
}

/**
 * A pool that verifies snapshots. `submit({caseId, which})` answers a promise
 * of the verdict `verifySnapshot` gives; `close()` ends the threads once the
 * last verdict has settled.
 * @param {number} [size]
 */
function createVerifyPool(size = POOL_SIZE) {
  /** @typedef {{job: {caseId: string, which: string}, resolve: Function, reject: Function}} Entry */
  /** @type {Entry[]} */
  const queue = [];
  /** @type {Worker[]} */
  const idle = [];
  /** @type {Map<Worker, Entry>} */
  const running = new Map();
  /** @type {Set<Worker>} */
  const workers = new Set();

  function start(worker, entry) {
    running.set(worker, entry);
    worker.postMessage(entry.job);
  }

  /** The next queued world, or the thread back on the bench. */
  function next(worker) {
    const entry = queue.shift();
    if (entry) start(worker, entry);
    else idle.push(worker);
  }

  function settle(worker, settleEntry) {
    const entry = running.get(worker);
    running.delete(worker);
    if (entry) settleEntry(entry);
  }

  function spawn() {
    const worker = new Worker(WORKER);
    workers.add(worker);
    worker.on('message', (message) => {
      settle(worker, (entry) => (message.ok
        ? entry.resolve(message.result)
        : entry.reject(reported(message))));
      next(worker);
    });
    // A thread that dies takes its world and its slot with it — a queue left
    // behind gets a fresh thread rather than a hung gate.
    worker.on('error', (error) => {
      workers.delete(worker);
      settle(worker, (entry) => entry.reject(error));
      if (queue.length) next(spawn());
    });
    worker.on('exit', () => {
      workers.delete(worker);
      settle(worker, (entry) => entry.reject(new Error('the verifying thread exited before answering')));
    });
    return worker;
  }

  return {
    submit(job) {
      return new Promise((resolve, reject) => {
        const entry = { job, resolve, reject };
        const worker = idle.pop() ?? (workers.size < size ? spawn() : null);
        if (worker) start(worker, entry);
        else queue.push(entry);
      });
    },
    async close() {
      const ending = [...workers];
      workers.clear();
      idle.length = 0;
      await Promise.all(ending.map((w) => w.terminate()));
    },
  };
}

/**
 * Every job across one pool, answered in the order given. A world whose
 * recipe cannot run rejects, as it does in a single thread.
 * @param {{caseId: string, which: string}[]} jobs
 */
async function verifyAll(jobs) {
  const pool = createVerifyPool();
  try {
    return await Promise.all(jobs.map(async (job) => ({ ...job, result: await pool.submit(job) })));
  } finally {
    await pool.close();
  }
}

module.exports = { POOL_SIZE, createVerifyPool, verifyAll };
