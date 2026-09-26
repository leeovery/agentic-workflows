# Discovery Gap Analysis Cache

## Topics

### Commercialization
- **Summary**: What a user who has not paid meets across the product — which capabilities are held back, what the surface says when one is reached, and where the price is first stated.
- **Routing**: discussion
- **Source artifacts**: note-window.md, onboarding-and-permissions.md, agent-surface.md
- **Gap type**: cross-artifact

*(Already on the map as `commercialization`; provenance merged rather than staged. The theme arrives from three directions — note-window parked how version history presents when unentitled, onboarding-and-permissions handed back whether first run says anything about price, and the agent surface has no stated position on whether a CLI or MCP call is metered at all.)*

## Themes checked and not staged

- **Accessibility beyond colour** — VoiceOver, keyboard paths and motion preference on a frameless always-on-top note. Covered: `note-window` decided accessibility labels, a keyboard path and VoiceOver exposure for both custom controls, Reduce Transparency degradation, colour never as the sole signal, and CVD/achromatopsia swatches as first-class themes. Also on the dismissed list.
- **Performance and scale** — unmeasured assumptions under the index, fully-eager sync, the launch window burst and the projection re-derivation pass. The topic exists on the map and was cancelled; each assumption is carried explicitly into implementation by the topic that made it.
- **Egress and the engine as a confused deputy** — `agent-surface` holds the MCP server as an uncounted content-egress channel and `engine-architecture` parked the socket's confused-deputy exposure under a declared non-adversarial threat model. Both were addressed to `privacy-and-data-handling`, which the user cancelled; not re-proposed under another name.
- **Settings, diagnostics, release mechanics and the preference surface** — heavily rerouted, but every concern is queued on an existing map topic (`management-window`, `support-and-diagnostics`, `build-and-release`) rather than falling between them.
