# art: still
# art: from #373737
# The README's hero: a real Claude Code session in acme-app with `/ledger`
# typed, Ledger's banner and the inbox in the transcript, and its start menu
# drawn as buttons above the prompt: a feature mid-build, a bugfix in
# investigation, an epic in discussion. The still is cut from the row of the
# prompt Claude Code draws in #373737, so Claude Code's welcome header,
# above it, stays out of the art.
#
# A real session: it signs in as you, and spends one turn.
#
# Record it, and make art/start-menu.webp:
#   demo/record.sh start-menu

Output "demo/out/start-menu/"
Source "demo/look.tape"
# 46 rows: tall enough that Claude Code gives the band above the prompt room
# for the whole menu, every row on one page. 46 × 37 + 64.
Set Height 1766

Hide
Type 'demo/world.sh start && source "${DEMO_WORLD:-/tmp/ledger-demo}/profile.sh"' Enter
Wait@60s
Type 'claude --setting-sources project --permission-mode manual --model opus' Enter
# A first run in the world's folder asks whether to trust it, "No, exit"
# first, since the project's settings carry Ledger's hooks and permissions:
# Down and Enter say yes. Where it was trusted before, they meet an empty
# prompt and do nothing.
Wait+Screen@60s /Quick safety check|for shortcuts|shift\+tab to cycle/
Sleep 2s
Down
Sleep 500ms
Enter
Wait+Screen@60s /for shortcuts|shift\+tab to cycle/
Sleep 3s
Type "/ledger"
Sleep 1s
Enter
# The menu's question, drawn above the prompt once the start menu renders,
# then the inbox line Claude writes last, as its turn ends.
Wait+Screen@300s /What would you like to do/
Wait+Screen@120s /Inbox: 2 ideas/
Sleep 5s
Show
Sleep 2s
