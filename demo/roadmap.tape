# art: still
# art: from-last #373737 +2
# The roadmap: `/ledger`, then `roadmap` typed at the start menu, which
# hands off into a fresh conversation where Ledger draws the product's
# roadmap, each item under its horizon, and its menu as buttons above the
# prompt. The still starts two rows under the handoff's continuation, the
# last prompt sent, at Claude invoking the roadmap's skill.
#
# A real session: it signs in as you, and spends three turns: the start
# menu, the answer, and the conversation the handoff starts.
#
# Record it, and make art/roadmap.webp:
#   demo/record.sh roadmap

Output "demo/out/roadmap/"
Source "demo/look.tape"
# 46 rows, as the start menu's, so nothing of the roadmap scrolls away.
# 46 × 37 + 64.
Set Height 1766

Hide
Type 'demo/world.sh roadmap && source "${DEMO_WORLD:-/tmp/ledger-demo}/profile.sh"' Enter
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
Type "/ledger"
Sleep 1s
Enter
Wait+Screen@300s /What would you like to do/
Wait+Screen@120s /Inbox: empty/
Sleep 3s
Type "roadmap"
Sleep 1s
Enter
# The handoff clears the conversation and sends its continuation. Where a
# send is dropped, it waits in the prompt box for Enter: one Enter well after
# the answer sends it, and meets an empty prompt otherwise.
Sleep 45s
Enter
# The roadmap's last horizon, which Claude writes as its turn ends.
Wait+Screen@300s /someday \(1\)/
Sleep 5s
Show
Sleep 2s
