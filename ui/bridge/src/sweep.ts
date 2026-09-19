// The surface sweep (phase-2 §9) — enumerate the engine's rendered gate
// surfaces from its own source: every `section('MENU…')` call site, whether
// it can render the auto-override line, and the DISPLAY/MENU finding-batch
// pair. An exit artifact the attention phase builds on, regenerated against
// any product version.
import fs from 'node:fs';
import path from 'node:path';

export type SweepResult = {
  surfaces: { name: string; stopInstruction: boolean; overAuto: boolean }[];
  gatewayMenu: boolean;
  batchPair: boolean;
};

export function sweepSurfaces(enginePath: string): SweepResult {
  const domainDir = path.join(enginePath, 'domain');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.cjs')) files.push(path.join(d, e.name));
    }
  };
  walk(domainDir);

  const surfaces = new Map<string, { stopInstruction: boolean; overAuto: boolean }>();
  let batchDisplay = false;
  let batchMenu = false;

  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    // section('MENU…', INSTRUCTION_CONST | 'literal', …)
    const re = /section\(\s*['"`](MENU[^'"`]*)['"`]\s*,\s*([A-Z_]+|'[^']*'|"[^"]*")/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const name = m[1]!;
      const instr = m[2]!;
      const stopInstruction = /STOP|RESUME_MENU_INSTRUCTION|INCOHERENCE|MENU_INSTRUCTION/.test(instr);
      const prev = surfaces.get(name) ?? { stopInstruction, overAuto: false };
      prev.stopInstruction = prev.stopInstruction || stopInstruction;
      surfaces.set(name, prev);
    }
    if (/section\(\s*['"`]DISPLAY: finding batch/.test(text)) batchDisplay = true;
    if (/section\(\s*['"`]MENU: finding batch/.test(text)) batchMenu = true;
    // AUTO_OVERRIDE_LINE call sites: mark surfaces rendered in the same
    // function body. Approximation: a surface named within 40 lines above an
    // AUTO_OVERRIDE_LINE reference.
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!line.includes('AUTO_OVERRIDE_LINE') || line.includes('const AUTO_OVERRIDE_LINE')) return;
      for (let j = i; j >= Math.max(0, i - 40); j--) {
        const sm = lines[j]!.match(/section\(\s*['"`](MENU[^'"`]*)['"`]/);
        if (sm) {
          const prev = surfaces.get(sm[1]!) ?? { stopInstruction: true, overAuto: false };
          prev.overAuto = true;
          surfaces.set(sm[1]!, prev);
          break;
        }
      }
    });
  }

  const gatewayText = fs.readFileSync(path.join(enginePath, 'gateway.cjs'), 'utf8');
  const gatewayMenu = /=== MENU \(emit verbatim as markdown\) ===/.test(gatewayText);

  return {
    surfaces: [...surfaces.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    gatewayMenu,
    batchPair: batchDisplay && batchMenu,
  };
}
