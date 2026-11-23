# art: still
# art: from-last #373737
# A topic's map mid-discussion: `/ledger carry on with the billing
# discussion` takes the session into Launch Core's Billing topic, Claude
# opens the conversation, and asked to show the map, draws it: what is open,
# what is decided, and the calls Claude made since the person last looked.
# The still is cut from the last prompt sent, the ask for the map.
#
# A real session: it signs in as you, and spends two turns: the opening and
# the map.
#
# Record it, and make art/discussion.webp:
#   demo/record.sh discussion

Output "demo/out/discussion/"
Source "demo/look.tape"
# 46 rows, as the start menu's: the map whole under the ask for it.
# 46 × 37 + 64.
Set Height 1766

Hide
Type 'demo/world.sh discussion && source "${DEMO_WORLD:-/tmp/ledger-demo}/profile.sh"' Enter
Wait@60s
Type 'claude --setting-sources project --permission-mode manual --model opus' Enter
# The trust question, where it is asked: Down and Enter say yes.
Wait+Screen@60s /Quick safety check|for shortcuts|shift\+tab to cycle/
Sleep 2s
Down
Sleep 500ms
Enter
Wait+Screen@60s /for shortcuts|shift\+tab to cycle/
Sleep 3s
Type "/ledger carry on with the billing discussion"
Sleep 1s
Enter
# The line Claude Code writes as a turn ends: the opening is over.
Wait+Screen@480s /(Baked|Brewed|Churned|Cogitated|Cooked|Crunched|Sautéed|Worked) for [0-9]/
Sleep 3s
Type "show me the map"
Sleep 1s
Enter
# The map under the ask for it, and the turn's end after it.
Wait+Screen@300s /(?s)show me the map.*Map — Billing.*(Baked|Brewed|Churned|Cogitated|Cooked|Crunched|Sautéed|Worked) for [0-9]/
Sleep 4s
Show
Sleep 2s
