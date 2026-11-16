'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a markdown file's relative links, rebased when it or a copy
// of it lands in another folder, so each resolves to the file it named.
//
// - Inline links and images, `[text](target "title")` and `<target>`, and
//   reference definitions, `[label]: target`, are rebased; a target naming a
//   scheme, an absolute path, or only an anchor is left as it is, and a
//   rebased target keeps its anchor, its query and a folder's trailing
//   slash.
// - Where the files it names moved too, each is followed to where it went,
//   and a link that resolves there already is left as written.
// - Fenced code blocks are left as they are: what they hold is code.
// - Both folders are posix paths relative to one root.
// ---------------------------------------------------------------------------

const path = require('path');

const INLINE = /(\]\(\s*)(<[^>\n]*>|[^)\s]+)/g;
const DEFINITION = /^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]*>|\S+)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const UNTOUCHED = /^(?:[a-z][a-z0-9+.-]*:|\/|#|$)/i;

/** Where a file named from the root is now. @typedef {(file: string) => string} Follow */

/**
 * `target`, relative to `fromDir`, made relative to `toDir`, the file it
 * names followed to where it is now.
 * @param {string} target @param {string} fromDir @param {string} toDir @param {Follow} follow
 */
function rebaseTarget(target, fromDir, toDir, follow) {
  const angled = target.startsWith('<');
  const bare = angled ? target.slice(1, -1) : target;
  if (UNTOUCHED.test(bare)) return target;
  const cut = bare.search(/[?#]/);
  const file = cut === -1 ? bare : bare.slice(0, cut);
  const named = follow(path.posix.join(fromDir, file));
  if (path.posix.join(toDir, file) === named) return target;
  const relative = path.posix.relative(toDir, named) || '.';
  const rebased = relative + (named.endsWith('/') ? '/' : '') + (cut === -1 ? '' : bare.slice(cut));
  return angled ? `<${rebased}>` : rebased;
}

/**
 * `text`, a markdown file in `fromDir`, with every relative link rebased to
 * resolve from `toDir`, each file it names followed by `follow` to where it
 * is now — where it was, unless said.
 * @param {string} text @param {string} fromDir @param {string} toDir @param {Follow} [follow]
 * @returns {string}
 */
function rebaseLinks(text, fromDir, toDir, follow = (file) => file) {
  /** @type {string|null} */
  let fence = null;
  /** @param {string} _ @param {string} lead @param {string} target */
  const rebase = (_, lead, target) => lead + rebaseTarget(target, fromDir, toDir, follow);
  return text.split('\n').map((line) => {
    const opens = FENCE.exec(line)?.[1];
    if (fence !== null) {
      if (opens !== undefined && opens[0] === fence[0] && opens.length >= fence.length) fence = null;
      return line;
    }
    if (opens !== undefined) {
      fence = opens;
      return line;
    }
    return line.replace(DEFINITION, rebase).replace(INLINE, rebase);
  }).join('\n');
}

module.exports = { rebaseLinks };
