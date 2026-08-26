// Golden regeneration — the harness's job (spec 4: a fixture is regenerable,
// never hand-edited; goldens regenerate through the harness after upstream
// changes). For each fixture with a captured world: restore it, run the pure
// spine function, write the durable event list as the committed golden.
//
//   pnpm --filter @workflow-ui/bridge exec tsx scripts/regen-goldens.ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { restoreWorld } from '../src/convert.js';
import { buildSpine } from '../src/spine.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

for (const name of fs.readdirSync(FIXTURES)) {
  const fixture = path.join(FIXTURES, name);
  const worldsRoot = path.join(fixture, 'worlds');
  if (!fs.existsSync(worldsRoot)) continue;
  for (const world of fs.readdirSync(worldsRoot).sort()) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-'));
    try {
      const dir = restoreWorld(path.join(worldsRoot, world), path.join(tmp, 'w'));
      const spine = await buildSpine(dir, name);
      const golden = { epoch: spine.epoch, events: spine.events };
      const out = path.join(fixture, `spine-golden-${world}.json`);
      fs.writeFileSync(out, JSON.stringify(golden, null, 2) + '\n');
      console.log(`${name}/worlds/${world}: ${spine.events.length} events → ${path.relative(process.cwd(), out)}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
