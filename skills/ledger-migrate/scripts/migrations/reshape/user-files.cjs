'use strict';

//
// The user-level folder's settings and credentials copied into the
// engine's, which the move (078) runs (21.5.19, P7). Released with it, it
// is frozen with it.
//
// The old folder, `WORKFLOWS_CONFIG_DIR` or `~/.config/workflows/`, gives
// its `config.json` and `credentials.json` to `LEDGER_CONFIG_DIR` or
// `~/.config/ledger/`, either folder read through a link where it is one,
// and is left exactly as it was, so a project on the machine still on
// today's skills keeps its own, never sharing the engine's files. Each is
// copied only where the old folder holds it as a file of its own that
// reads, opened never through a link and never waiting on a pipe, and the
// engine's folder holds nothing of its name, not even a link to nothing:
// the engine's copy wins, never written over, so a later project's
// migration copies only what the engine's folder still lacks. Where the
// engine's folder is the old one, or inside it, nothing is copied. One left
// behind unreadable goes unsaid: the engine's setup asks for what it lacks.
// An engine's folder that cannot hold a file — a link to nothing, a disk
// with no hard links — stops the run, as it would stop the engine's own
// first write, and a run again once it is set right completes the copy.
// Nothing else in the old folder is copied — its conversations' state has
// no use to the engine.
//
// Known edges, not built: a kill while a file is copied leaves its scratch
// beside it in the engine's folder, as private as the file it copies.
//

const fs = require('fs');
const path = require('path');
const { writeNew } = require('./shared.cjs');

/** The files of today's user-level folder the engine reads: its settings and its credentials. */
const USER_FILES = ['config.json', 'credentials.json'];

/** `at`'s real path where it is there, else `at`. @param {string} at */
function realOr(at) {
  try {
    return fs.realpathSync(at);
  } catch {
    return at;
  }
}

/** Whether anything holds `at`'s name, a link to nothing among it. @param {string} at */
function held(at) {
  try {
    fs.lstatSync(at);
    return true;
  } catch {
    return false;
  }
}

/** Whether `at` is `root` or inside it. @param {string} at @param {string} root */
function within(at, root) {
  const rel = path.relative(root, at);
  return rel === '' || !(rel.startsWith('..') || path.isAbsolute(rel));
}

/**
 * What `file` holds and its mode, where it is a file of its own that reads,
 * else null: opened never through a link, never waiting on a pipe.
 * @param {string} file @returns {{bytes: Buffer, mode: number}|null}
 */
function fileOf(file) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  } catch {
    return null;
  }
  try {
    const stats = fs.fstatSync(fd);
    return stats.isFile() ? { bytes: fs.readFileSync(fd), mode: stats.mode & 0o777 } : null;
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * The settings and credentials of the old user-level folder `from` copied
 * into the engine's, `to`, each where `from` holds it as a file of its own
 * that reads and `to` holds nothing of its name, nothing written where it
 * does.
 * @param {string} from @param {string} to
 */
function copyUserFiles(from, to) {
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) return;
  const into = realOr(to);
  if (within(into, realOr(from))) return;
  for (const name of USER_FILES) {
    if (held(path.join(into, name))) continue;
    const source = fileOf(path.join(from, name));
    if (source === null) continue;
    fs.mkdirSync(into, { recursive: true });
    writeNew(path.join(into, name), source.bytes, source.mode);
  }
}

module.exports = { copyUserFiles };
