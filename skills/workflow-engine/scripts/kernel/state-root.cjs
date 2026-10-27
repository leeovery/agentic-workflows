'use strict';

// ---------------------------------------------------------------------------
// Kernel: where the workflows' state lives — the one module that decides it.
//
// Every path into the state is built here: absolute (`stateRoot`) for file
// access, project-relative (`stateRel`, tested by `isStatePath`) for git
// pathspecs, response paths and stored identities, and the directory's bare
// name (`STATE_DIR_NAME`) for code that searches for the state by name.
// ---------------------------------------------------------------------------

const path = require('path');

const STATE_DIR_NAME = '.workflows';

/**
 * The state's absolute directory for a project root.
 * @param {string} cwd  project root
 * @returns {string}
 */
function stateRoot(cwd) {
  return path.join(cwd, STATE_DIR_NAME);
}

/**
 * A path inside the state, project-relative: the segments joined with `/`
 * as given, never normalised; no segments names the state directory itself.
 * @param {...string} segments
 * @returns {string}
 */
function stateRel(...segments) {
  return [STATE_DIR_NAME, ...segments].join('/');
}

/**
 * Whether a project-relative path is the state directory or lies inside it.
 * @param {string} relPath
 * @returns {boolean}
 */
function isStatePath(relPath) {
  return relPath === STATE_DIR_NAME || relPath.startsWith(`${STATE_DIR_NAME}/`);
}

module.exports = { STATE_DIR_NAME, stateRoot, stateRel, isStatePath };
