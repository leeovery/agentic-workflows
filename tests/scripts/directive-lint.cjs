'use strict';

// The lint over the migration's directives (21.S34; the format is the
// header of skills/leeway-migrate/scripts/migrate.cjs): each directive,
// `NNN-{slug}.md`, opens on its title, then its head — `## Touches`, the
// files it may touch, and `## Asks`, what it asks the person, each a list
// of one item or more and nothing else, an item wrapped onto lines indented
// beneath it — and its check sits beside it, `NNN-{slug}.check.cjs`,
// exporting the check's shape as the engine reads it (`isCheck`).

const fs = require('fs');
const path = require('path');
const { isCheck } = require('../../skills/leeway-engine/scripts/domain/directives.cjs');

const HEAD = ['Touches', 'Asks'];

/**
 * What a directive's text lacks of its title and its head, one sentence each.
 * @param {string} text
 * @returns {string[]}
 */
function headProblems(text) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const problems = [];
  if (!/^# \S/.test(lines[0])) problems.push('it opens on no title');
  const headings = lines.flatMap((line, at) => (at > 0 && /^#{1,6} /.test(line) ? [{ line, at }] : []));
  HEAD.forEach((name, place) => {
    const heading = headings[place];
    if (heading === undefined || heading.line.trimEnd() !== `## ${name}`) {
      problems.push(`its head's ${place === 0 ? 'first' : 'second'} section is not ## ${name}`);
      return;
    }
    const body = lines.slice(heading.at + 1, headings[place + 1]?.at ?? lines.length).filter((line) => line.trim() !== '');
    if (body.length === 0) problems.push(`## ${name} lists nothing`);
    else if (!/^- \S/.test(body[0]) || !body.every((line) => /^(- |\s+)\S/.test(line))) problems.push(`## ${name} holds more than its list`);
  });
  return problems;
}

/**
 * Every problem of every directive in a migrations folder, each named by
 * its file: its head, and its check beside it.
 * @param {string} folder
 * @returns {string[]}
 */
function lintDirectives(folder) {
  return fs.readdirSync(folder).filter((name) => /^[0-9]+-.+\.md$/.test(name)).sort().flatMap((name) => {
    const check = path.join(folder, name.replace(/\.md$/, '.check.cjs'));
    /** @type {string[]} */
    const problems = headProblems(fs.readFileSync(path.join(folder, name), 'utf8'));
    if (!fs.existsSync(check)) problems.push('no check sits beside it');
    else if (!isCheck(require(check))) problems.push('its check exports no check() beside what it counts');
    return problems.map((problem) => `${name}: ${problem}`);
  });
}

module.exports = { headProblems, lintDirectives };
