# Open the picker with a filter already applied

The most common way I actually use Portal is: type `x`, wait for the picker, press `/`, type three or four characters, press Enter, then `Space` through the two or three survivors to see which one is which, then Enter to attach. Every one of those steps except the last two is pure ceremony — I already know the shape of what I want before the picker has even painted.

What I want is to collapse that into a single command at the shell: something like `x /port` (or `x/port` if a no-space form is possible), which launches straight into the sessions list with `port` already in the filter box, the list already narrowed to matching sessions, and the cursor sitting on the first one. From there I carry on exactly as I do today — `Space` to quick-preview each candidate, Enter to attach.

The key property is that the search term must be **forced as a filter**, not fed into the resolution grammar. Portal's bare-positional chain (exact session → glob → path → alias → zoxide) is too eager and too fuzzy for this: it'll happily decide `port` means a zoxide directory or an alias and mint me something new, when what I actually want is "show me the live sessions whose names contain this, and let me pick". The `/` prefix is the natural way to signal "this is filter text, don't guess".

The scenario that drives it: I have three sessions running for Portal. One or two might be custom-named, the rest are `portal-<nanoid>`. I genuinely don't know which is which by name — only that the one I want is among them. So the goal isn't to resolve to a single session, it's to *narrow to the right handful fast* and then use the preview to choose.

`portal open` already has `-f/--filter <text>` for opening the picker pre-filtered, so the underlying behaviour may already exist — the missing piece is the ergonomic shell-level form. It has to be short enough to be muscle memory, which is what `x /term` is going for.
