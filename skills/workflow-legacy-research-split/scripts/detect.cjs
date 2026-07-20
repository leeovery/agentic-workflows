#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const engine = require('../../workflow-engine/scripts/lib.cjs');
const { loadManifest, fileExists } = engine.reads;
const { phaseItems } = engine.derivations;

// Theme/source names become engine dot-path segments and research filenames.
// The engine rejects dots/slashes; the canonical map name is kebab. A source
// whose name breaks this can never be split (apply fails at the sentinel set),
// so surface it as unsplittable rather than re-offering it every epic open.
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function detect(workUnit) {
  const cwd = process.cwd();
  const manifest = loadManifest(cwd, workUnit);
  if (!manifest) die(`Work unit "${workUnit}" not found`, 2);

  const discoveryItems = phaseItems(manifest, 'discovery');
  const researchItems = phaseItems(manifest, 'research');
  const researchByName = new Map(researchItems.map(it => [it.name, it]));

  const qualifying = [];
  const unsplittable = [];       // candidates blocked by an illegal name
  const strandedSentinels = [];  // items left mid-split by a crashed apply
  for (const item of discoveryItems) {
    // A set sentinel means a prior apply set it and never cleared it (only
    // possible via a hard crash between the sentinel write and the source-item
    // delete). Surface it so the skill can prompt recovery — otherwise the item
    // is invisible: excluded here and its file/research already renamed away.
    if (item.legacy_split_state) {
      strandedSentinels.push(item.name);
      continue;
    }
    const source = item.source || '';
    if (!source.includes('migration-seeded')) continue;
    if (item.routing !== 'research') continue;
    const research = researchByName.get(item.name);
    if (!research || research.status !== 'in-progress') continue;
    const filePath = path.join(cwd, '.workflows', workUnit, 'research', `${item.name}.md`);
    if (!fileExists(filePath)) continue;
    // Would otherwise qualify, but an illegal name would break apply. Report it
    // rather than silently dropping — the user renames the source to unblock it.
    if (!NAME_RE.test(item.name)) {
      unsplittable.push({ name: item.name, reason: `name must match ${NAME_RE.source} (engine dot-paths reject dots/slashes)` });
      continue;
    }
    qualifying.push(item.name);
  }

  qualifying.sort();
  unsplittable.sort((a, b) => a.name.localeCompare(b.name));
  strandedSentinels.sort();
  return { qualifying_sources: qualifying, unsplittable, stranded_sentinels: strandedSentinels };
}

const args = process.argv.slice(2);
if (args.length < 1) die('Usage: detect.cjs <work-unit>');

const result = detect(args[0]);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
