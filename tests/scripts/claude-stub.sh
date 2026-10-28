#!/bin/sh
#
# The `claude` binary hermetic-env.cjs pins LEEWAY_CLAUDE to. Armed — a test
# set CLAUDE_STUB_ANSWERS or CLAUDE_STUB_LOG — it is claude-stub.cjs, which
# answers by what the test set. Unarmed, it answers as claude-stub.cjs does
# unarmed, byte for byte — a Claude with no login — without starting node,
# so the decisions a suite records unchecked cost no node start each.
#

if [ -n "${CLAUDE_STUB_ANSWERS}${CLAUDE_STUB_LOG}" ]; then
  exec node "${0%/*}/claude-stub.cjs" "$@"
fi
while IFS= read -r _; do :; done
printf '%s\n' '{"type":"result","duration_ms":1,"num_turns":1,"total_cost_usd":0,"session_id":"stub","subtype":"success","is_error":true,"api_error_status":null,"terminal_reason":"api_error","result":"Not logged in · Please run /login"}'
exit 1
