# ZX Spectrum-Inspired TUI Design

Portal's TUI currently has no visual identity — it's functional but personality-free. The idea is to redesign it with a ZX Spectrum aesthetic: bold saturated primaries on a black canvas, chunky block characters, retro typography, and genuine warmth. The inspiration comes from games like Manic Miner and Dizzy — information-dense but charming, colourful but readable.

The core visual language would be a block-character PORTAL logo with each letter in a different rainbow colour, rainbow gradient separator lines spanning the full width, a coloured block cursor (`▌`) that cycles through rainbow colours as you navigate, spaced uppercase headers for that 8-bit typography feel (`S E S S I O N S`), heavy/double ZX-style borders framing the entire TUI, and a Manic Miner-inspired status bar at the bottom — dense, colourful, tongue-in-cheek but functional (think "High Score" instead of "Session Count").

Modals would carry a small rainbow block accent. The loading interstitial (relevant to the auto-start-tmux-server work) could feature the logo centred with a progress bar that fills with rainbow-coloured blocks left to right. An animated cycling-colour border à la the Spectrum loading screen is noted as an option but probably overkill for a 2-5 second screen.

Lipgloss and BubbleTea already support everything needed — terminal colours, block characters, borders, tick-based animation. The main open question is whether the black background assumption holds across terminal themes (light/dark), which would need validation. This would be a significant visual identity shift and a separate initiative from the current bootstrap work — it emerged from discussing the loading interstitial but has much broader scope.
