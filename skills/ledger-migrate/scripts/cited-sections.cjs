'use strict';

//
// cited-sections.cjs — the section a record's cite names (079): the one
// resolver every reader of a cite takes, so the carry, the records' check,
// its count of the sections no record cites and the verifier's walk sheet
// read each cite alike. Frozen with 079, as the record-files beside it are.
//
// A cite names a heading of its file by the heading, or by the heading's
// path, `{heading} > {heading}`, the outermost first: the headings whose
// path ends with it, at a heading's start, or the one whose whole path it
// is. It names one alone or none — headings of several paths it reaches
// are refused, never taken by first match, nor by the topic citing — and
// headings sharing their whole path, siblings of one heading, are told
// apart by that path and their place among them, `{path} [2]`. In a spec
// joined into `spec.md`, a cite opening on a part's heading,
// `{part} > {heading}`, names a heading of that part alone, whatever
// headings stand between: so a heading several parts hold is cited by its
// part. A cite naming several is answered with the name of each it could
// mean, as a cite names it alone (`citeNameOf`).
//

const PATH_JOIN = ' > ';
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const LEVEL = /^ {0,3}(#+)/;
const FENCE = /^ {0,3}(```|~~~)/;
const PART = /^ {0,3}##[ \t]/;
const FRONT_MATTER = /^---[ \t]*$/;

/**
 * The indexes of a joined spec's lines but the front matter each part
 * opens on, the old spec's own: a block between two `---` lines first
 * under the part's heading.
 * @param {string[]} lines @returns {number[]}
 */
function withoutFrontMatter(lines) {
  /** @type {number[]} */
  const kept = [];
  for (let at = 0; at < lines.length; at += 1) {
    kept.push(at);
    if (!PART.test(lines[at])) continue;
    let next = at + 1;
    while (next < lines.length && lines[next].trim() === '') next += 1;
    const close = FRONT_MATTER.test(lines[next] ?? '') ? lines.findIndex((line, end) => end > next && FRONT_MATTER.test(line)) : -1;
    if (close !== -1) at = close;
  }
  return kept;
}

/**
 * A heading of a markdown text: its trail, the headings over it, the
 * outermost first, ending in its own, and its path, the trail joined; in a
 * joined spec the part it is in, the heading at level two over it, or its
 * own at that level, null in a spec kept whole and outside the parts; and
 * whether it holds text of its own, lines past it before the next heading,
 * fenced blocks among them; and the lines it spans, from its own to the
 * last before the next heading, counted from one.
 * @typedef {{trail: string[], path: string, part: string|null, text: boolean, line: number, end: number}} Heading
 */

/**
 * The headings of a markdown text, fenced blocks aside, and in a joined
 * spec the front matter each part opens on.
 * @param {string} text @param {boolean} joined @returns {Heading[]}
 */
function outlineOf(text, joined) {
  /** @type {Heading[]} */
  const headings = [];
  /** @type {{level: number, heading: string}[]} */
  const over = [];
  let fenced = false;
  /** @type {string|null} */
  let part = null;
  const lines = text.split('\n');
  for (const at of joined ? withoutFrontMatter(lines) : lines.keys()) {
    const line = lines[at];
    const fence = FENCE.test(line);
    const heading = fenced || fence ? null : HEADING.exec(line);
    if (fence) fenced = !fenced;
    if (heading === null) {
      if (line.trim() !== '' && headings.length > 0) headings[headings.length - 1].text = true;
      continue;
    }
    const level = /** @type {RegExpExecArray} */ (LEVEL.exec(line))[1].length;
    while (over.length > 0 && over[over.length - 1].level >= level) over.pop();
    over.push({ level, heading: heading[1] });
    if (joined && PART.test(line)) part = heading[1];
    const trail = over.map((each) => each.heading);
    if (headings.length > 0) headings[headings.length - 1].end = at;
    headings.push({ trail, path: trail.join(PATH_JOIN), part, text: false, line: at + 1, end: lines.at(-1) === '' ? lines.length - 1 : lines.length });
  }
  return headings;
}

/**
 * Whether a heading's path ends with `name`, a heading or a path of them —
 * at a heading's start, so one whose own text holds the joint is named too.
 * @param {Heading} heading @param {string} name
 */
const endsWith = ({ path: at }, name) => at === name || at.endsWith(`${PATH_JOIN}${name}`);

/**
 * The headings among `headings` a name names: each whose whole path it is
 * — a heading at the top of a file with no one root among them — else each
 * whose path ends with it, where all of them share one path; none where it
 * names headings of several paths.
 * @param {Heading[]} headings @param {string} name @returns {Heading[]}
 */
function namedBy(headings, name) {
  const whole = headings.filter(({ path: at }) => at === name);
  if (whole.length > 0) return whole;
  const named = headings.filter((heading) => endsWith(heading, name));
  return new Set(named.map(({ path: at }) => at)).size === 1 ? named : [];
}

/** A name telling apart headings that share their whole path: their name, and which of them, from one, in order. */
const ORDINAL = /^(.*) \[([1-9][0-9]*)\]$/;

/**
 * The heading among `headings` a name names alone, or none: one it names
 * by itself (`namedBy`), or, of the headings sharing a whole path, the one
 * a name of them followed by its place among them names.
 * @param {Heading[]} headings @param {string} name @returns {Heading|null}
 */
function namedAlone(headings, name) {
  const named = namedBy(headings, name);
  if (named.length > 0) return named.length === 1 ? named[0] : null;
  const [, shared, nth] = ORDINAL.exec(name) ?? [];
  const copies = shared === undefined ? [] : namedBy(headings, shared);
  return copies.length > 1 && Number(nth) <= copies.length ? copies[Number(nth) - 1] : null;
}

/**
 * The headings a cite of `name` is read among, and what it names there: a
 * part's, past the part's heading it opens on, the longest where several
 * do; else the file's, the whole cite.
 * @param {Heading[]} headings @param {string} name @returns {{among: Heading[], rest: string}}
 */
function scopeOf(headings, name) {
  const parts = [...new Set(headings.map(({ part }) => part))].filter((part) => part !== null && name.startsWith(`${part}${PATH_JOIN}`));
  const part = /** @type {string[]} */ (parts).sort((a, b) => b.length - a.length)[0];
  if (part === undefined) return { among: headings, rest: name };
  return { among: headings.filter((heading) => heading.part === part), rest: name.slice(part.length + PATH_JOIN.length) };
}

/**
 * The section a cite names: the one heading it names alone, or null.
 * @param {Heading[]} headings @param {string} name @returns {Heading|null}
 */
function citedSection(headings, name) {
  const { among, rest } = scopeOf(headings, name);
  return namedAlone(among, rest);
}

/**
 * The headings a cite reaches, alone or not: each whose path ends with it,
 * or with what a name of headings sharing their path names before their
 * place among them — what a cite naming none alone could mean.
 * @param {Heading[]} headings @param {string} name @returns {Heading[]}
 */
function couldMean(headings, name) {
  const { among, rest } = scopeOf(headings, name);
  const reached = among.filter((heading) => endsWith(heading, rest));
  const shared = ORDINAL.exec(rest)?.[1];
  return reached.length > 0 || shared === undefined ? reached : among.filter((heading) => endsWith(heading, shared));
}

/**
 * The shortest name naming a heading alone among `headings`: its own
 * heading, or with as many of those over it as tell it apart; where others
 * share its whole path, the shortest naming them, and its place among them.
 * @param {Heading[]} headings @param {Heading} heading
 */
function nameOf(headings, heading) {
  const { trail } = heading;
  const names = [...trail.keys()].reverse().map((at) => trail.slice(at).join(PATH_JOIN));
  const alone = names.find((name) => namedAlone(headings, name) === heading);
  if (alone !== undefined) return alone;
  const shared = /** @type {string} */ (names.find((name) => namedBy(headings, name).includes(heading)));
  return `${shared} [${namedBy(headings, shared).indexOf(heading) + 1}]`;
}

/**
 * The name a cite gives a heading, which `citedSection` reads back to it:
 * within a joined spec's part, the part's heading and the shortest name
 * naming it alone in its part; the part's heading itself, and any heading
 * outside the parts, the shortest naming it alone in the file.
 * @param {Heading[]} headings @param {Heading} heading
 */
function citeNameOf(headings, heading) {
  const part = heading.part === null ? [] : headings.filter((each) => each.part === heading.part);
  return part.length === 0 || part[0] === heading ? nameOf(headings, heading) : `${heading.part}${PATH_JOIN}${nameOf(part, heading)}`;
}

/**
 * A heading's path as a walk sheet shows it: where others share it, with
 * its place among them, as a cite names it.
 * @param {Heading[]} headings @param {Heading} heading
 */
function shownPath(headings, heading) {
  const copies = headings.filter(({ path: at }) => at === heading.path);
  return copies.length > 1 ? `${heading.path} [${copies.indexOf(heading) + 1}]` : heading.path;
}

module.exports = { PATH_JOIN, HEADING, FENCE, outlineOf, citedSection, couldMean, nameOf, citeNameOf, shownPath };
