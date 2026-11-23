# The look every tape shares, sourced first: JetBrains Mono in Nordfox,
# 100 columns wide. Claude Code and Ledger's engine lay their
# screens out to the terminal's width, so at 100 the menus and their rows
# sit whole, as they would in any wider terminal. A tape sets a height of
# its own after it, for what it shows: 37 px a row, and 64 more, kept even
# for the MP4.
#
# 100 columns at 28px are 1600 px, twice the 800 the README shows a frame's
# screen at; with finalize.sh's 40 px margin a frame is 1680, twice 840.

Set Shell "bash"
Set FontFamily "JetBrains Mono"
Set FontSize 28
Set LetterSpacing 0
Set LineHeight 1
# 100 × 28 cells of 16 × 37 px, 1600 × 1036: C × 16 + 72 wide, R × 37 + 64 tall.
Set Width 1672
Set Height 1100
Set Padding 16
Set CursorBlink false
Set Framerate 30
Set TypingSpeed 45ms
# Nordfox, Ghostty's own values. The cursor takes the background, so stills
# show no block. termgrid.py theme nordfox prints this line.
Set Theme { "name": "Nordfox", "background": "#2E3440", "foreground": "#CDCECF", "cursor": "#2E3440", "selection": "#3E4A5B", "black": "#3B4252", "red": "#BF616A", "green": "#A3BE8C", "yellow": "#EBCB8B", "blue": "#81A1C1", "magenta": "#B48EAD", "cyan": "#88C0D0", "white": "#E5E9F0", "brightBlack": "#53648D", "brightRed": "#D06F79", "brightGreen": "#B1D196", "brightYellow": "#F0D399", "brightBlue": "#8CAFD2", "brightMagenta": "#C895BF", "brightCyan": "#93CCDC", "brightWhite": "#E7ECF4" }
# The world's prompt, as Wait looks for it on the cursor's line.
Set WaitPattern /❯/
Set WaitTimeout 1m
