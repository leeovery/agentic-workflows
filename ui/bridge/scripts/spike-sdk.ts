// Phase 2 week-one SDK spike (specs/session-lifecycle.md [spike] items).
// Verifies, against the real SDK:
//   S1: env propagation — WORKFLOWS_DISPLAY_WIDTH / CLAUDE_PID /
//       CLAUDE_CODE_SESSION_ID / BRIDGE_ID reach the session's Bash tools
//   S2: sdk session id capture from the init message + resume continuity
//   S3: allowedTools fallout — a disallowed tool is denied, not hung
//   S4: presence identity — a presence record written by an in-session
//       engine call carries a pid the bridge can verify/clean up
// Results print as a table; fold into the spec either way.
//
//   pnpm --filter @workflow-ui/bridge exec tsx scripts/spike-sdk.ts <scratch-world>
import fs from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

const world = process.argv[2];
if (!world || !fs.existsSync(world)) {
  console.error('usage: spike-sdk.ts <scratch-world-with-product-installed>');
  process.exit(2);
}

const results: Record<string, string> = {};
const bridgeSessionId = `spike-${Date.now().toString(36)}`;

function extractText(msg: any): string {
  if (msg.type !== 'assistant') return '';
  const content = msg.message?.content;
  if (!Array.isArray(content)) return '';
  return content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}

async function run(prompt: string, opts: Record<string, unknown> = {}): Promise<{ text: string; sdkSessionId: string | null; denied: string[] }> {
  let text = '';
  let sdkSessionId: string | null = null;
  const denied: string[] = [];
  const q = query({
    prompt,
    options: {
      cwd: world,
      model: 'claude-haiku-4-5-20251001',
      permissionMode: 'default',
      allowedTools: ['Bash', 'Read'],
      env: {
        ...process.env,
        WORKFLOWS_DISPLAY_WIDTH: '65',
        CLAUDE_PID: String(process.pid),
        CLAUDE_CODE_SESSION_ID: bridgeSessionId,
        BRIDGE_ID: 'spike-bridge',
      },
      settingSources: ['project'],
      ...opts,
    },
  });
  for await (const msg of q as AsyncIterable<any>) {
    if (msg.type === 'system' && msg.subtype === 'init') sdkSessionId = msg.session_id ?? null;
    if (msg.type === 'assistant') text += extractText(msg);
    if (msg.type === 'user') {
      const blocks = msg.message?.content;
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b.type === 'tool_result' && b.is_error && /permission|denied|not allowed|requested permissions/i.test(String(JSON.stringify(b.content)))) {
            denied.push(String(JSON.stringify(b.content)).slice(0, 120));
          }
        }
      }
    }
  }
  return { text, sdkSessionId, denied };
}

// --- S1: env propagation ----------------------------------------------------
const envProbe = await run(
  'Run this exact bash command and show me its raw output: echo "W=$WORKFLOWS_DISPLAY_WIDTH PID=$CLAUDE_PID SID=$CLAUDE_CODE_SESSION_ID BID=$BRIDGE_ID". Then stop.',
);
results['S1 env: WORKFLOWS_DISPLAY_WIDTH'] = envProbe.text.includes('W=65') ? 'PASS' : `FAIL (${envProbe.text.slice(0, 120)})`;
results['S1 env: CLAUDE_PID'] = envProbe.text.includes(`PID=${process.pid}`) ? 'PASS' : 'FAIL — SDK overrides or strips it';
results['S1 env: CLAUDE_CODE_SESSION_ID'] = envProbe.text.includes(`SID=${bridgeSessionId}`)
  ? 'PASS'
  : 'FAIL — harness assigns its own id';
results['S1 env: BRIDGE_ID'] = envProbe.text.includes('BID=spike-bridge') ? 'PASS' : 'FAIL';

// --- S2: session id + resume ------------------------------------------------
const first = await run('Remember the word "pomegranate". Reply only: remembered.');
results['S2 sdk session id captured'] = first.sdkSessionId ? `PASS (${first.sdkSessionId.slice(0, 8)}…)` : 'FAIL';
if (first.sdkSessionId) {
  const resumed = await run('What word did I ask you to remember? Reply with only that word.', {
    resume: first.sdkSessionId,
  });
  results['S2 resume continuity'] = /pomegranate/i.test(resumed.text) ? 'PASS' : `FAIL (${resumed.text.slice(0, 80)})`;
  results['S2 resume mints new sdk id'] =
    resumed.sdkSessionId && resumed.sdkSessionId !== first.sdkSessionId
      ? `CONFIRMED — bridgeSessionId must be ours (${resumed.sdkSessionId.slice(0, 8)}…)`
      : 'not observed — id stable across resume';
}

// --- S3: allowedTools fallout ----------------------------------------------
const deny = await run('Create a file called spike-deny.txt containing "x" using the Write tool. If you cannot, say CANNOT-WRITE and stop.', {
  allowedTools: ['Read'],
});
const wroteAnyway = fs.existsSync(path.join(world, 'spike-deny.txt'));
results['S3 disallowed tool'] = wroteAnyway
  ? 'FAIL — wrote despite allowlist'
  : deny.denied.length > 0 || /CANNOT-WRITE/i.test(deny.text)
    ? 'PASS — denied, no hang'
    : `UNCLEAR (${deny.text.slice(0, 100)})`;

// --- S4: presence identity --------------------------------------------------
const presenceCmd =
  'WORKFLOWS_DISPLAY_WIDTH=65 node .claude/skills/workflow-engine/scripts/engine.cjs presence beat rate-limiting discussion rate-limiting';
await run(`Run this exact bash command from the project root, then stop: ${presenceCmd}`);
const presencePath = path.join(world, '.workflows', '.cache', 'rate-limiting', 'discussion', 'rate-limiting', 'presence');
let presenceRaw: string | null = null;
try {
  presenceRaw = fs.readFileSync(presencePath, 'utf8');
} catch {
  /* absent */
}
if (presenceRaw) {
  results['S4 presence record written'] = 'PASS';
  results['S4 presence fields'] = presenceRaw.slice(0, 160).replace(/\n/g, ' | ');
} else {
  results['S4 presence record written'] = 'FAIL — no record at expected path';
}

console.log('\n=== SPIKE RESULTS ===');
for (const [k, v] of Object.entries(results)) console.log(`${k}: ${v}`);
