'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a markdown file's relative links, rebased when a copy of it
// lands in another folder, so each resolves to the file it named.
//
// - Inline links and images, `[text](target "title")` and `<target>`, and
//   reference definitions, `[label]: target`, are rebased; a target naming a
//   scheme, an absolute path, or only an anchor is left as it is, and a
//   rebased target keeps its anchor and query.
// - Fenced code blocks are left as they are: what they hold is code.
// - Both folders are posix paths relative to one root.
// ---------------------------------------------------------------------------

const path = require('path');

const INLINE = /(\]\(\s*)(<[^>\n]*>|[^)\s]+)/g;
const DEFINITION = /^( {0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]*>|\S+)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const UNTOUCHED = /^(?:[a-z][a-z0-9+.-]*:|\/|#|$)/i;

/**
 * `target`, relative to `fromDir`, made relative to `toDir`.
 * @param {string} target @param {string} fromDir @param {string} toDir
 */
function rebaseTarget(target, fromDir, toDir) {
  const angled = target.startsWith('<');
  const bare = angled ? target.slice(1, -1) : target;
  if (UNTOUCHED.test(bare)) return target;
  const cut = bare.search(/[?#]/);
  const file = cut === -1 ? bare : bare.slice(0, cut);
  const rebased = path.posix.relative(toDir, path.posix.join(fromDir, file)) + (cut === -1 ? '' : bare.slice(cut));
  return angled ? `<${rebased}>` : rebased;
}

/**
 * `text`, a markdown file in `fromDir`, with every relative link rebased to
 * resolve from `toDir`.
 * @param {string} text @param {string} fromDir @param {string} toDir
 * @returns {string}
 */
function rebaseLinks(text, fromDir, toDir) {
  /** @type {string|null} */
  let fence = null;
  /** @param {string} _ @param {string} lead @param {string} target */
  const rebase = (_, lead, target) => lead + rebaseTarget(target, fromDir, toDir);
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
