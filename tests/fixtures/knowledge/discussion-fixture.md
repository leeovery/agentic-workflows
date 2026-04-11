# Discussion: Application Architecture

## Context

Overall application structure for Pigeon — the macOS menu bar app that switches Magic peripherals between Macs. This discussion covers module boundaries, dependency management, concurrency model, state management, app lifecycle, and distribution. It builds on decisions already made in prior discussions:

- **Bluetooth switching protocol** — Direct private API (`remove` selector) with async/await orchestration, event-driven coordination, retry with exponential backoff, RSSI pre-checks.
- **Peer networking** — Network framework with persistent full-mesh TCP connections, Bonjour discovery, NWProtocolFramer for message framing, UUID-based peer identity, TLS for public distribution, heartbeat-based liveness.

Research established that: the app must be non-sandboxed (private API requirement), distributed via notarization outside the App Store, needs Bluetooth + local network TCC permissions, and should be designed for N peers from the start.

### References

- [exploration.md](../research/exploration.md) — Feasibility, architecture overview, physical setup, naming
- [networking.md](../research/networking.md) — Network framework, connection lifecycle, recommended architecture
- [rule-engine.md](../research/rule-engine.md) — Event detection APIs, Combine event bus, rule storage and evaluation
- [blue-switch-review.md](../research/blue-switch-review.md) — Anti-patterns to avoid (singletons, missing DI, no error recovery)
- [bluetooth-pairing-behavior.md](../research/bluetooth-pairing-behavior.md) — Pairing constraints, timing, recovery
- [bluetooth-switching-protocol.md](../discussion/bluetooth-switching-protocol.md) — Switching protocol decisions
- [peer-networking.md](../discussion/peer-networking.md) — Networking layer decisions

## Discussion Map

### States

- **pending** — identified but not yet explored
- **exploring** — actively being discussed
- **converging** — narrowing toward a decision
- **decided** — decision reached with rationale documented

### Map

  App Structure and Entry Point [decided]
  ├─ SwiftUI App vs AppKit NSApplication lifecycle [decided]
  ├─ Menu bar app pattern [decided]
  └─ Login item / launch at startup [decided]

  Module Architecture [decided]
  ├─ Layer boundaries and dependency direction [decided]
  ├─ Dependency injection strategy [decided]
  └─ Protocol-driven interfaces [decided]

  Concurrency Model [decided]
  ├─ Actor isolation strategy [decided]
  ├─ Event system (Combine vs AsyncSequence) [decided]
  └─ MainActor scope [decided]

  State Management [decided]
  ├─ Domain modelling pattern [decided]
  ├─ State ownership and AppState [decided]
  ├─ Action pattern for domain logic [decided]
  ├─ Coordinator role (thin, not God object) [decided]
  └─ @Observable + protocol boundary [decided]

  App Lifecycle [decided]
  ├─ Sleep/wake and pairing persistence [decided]
  ├─ Wake-on-LAN fallback [decided]
  ├─ Login item / launch at startup [decided]
  └─ Graceful shutdown [decided]

  Configuration and Storage [decided]
  ├─ Rule storage format and location [decided]
  ├─ App settings persistence [decided]
  └─ Peer identity and credentials [decided]

  Error Handling Strategy [decided]
  ├─ Error propagation and domain messages [decided]
  └─ Dual-channel presentation (notifications + UI state) [decided]

  Build and Distribution [decided]
  ├─ Non-sandboxed + notarized build configuration [decided]
  ├─ Minimum macOS version target [decided]
  └─ Auto-update mechanism [decided]

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent.*

---

## App Structure and Entry Point

### Context
The foundational question: which application lifecycle owns the app, and how does the menu bar presence work? This determines the framework mix, boilerplate, and complexity ceiling.

### Options Considered

**Option A: SwiftUI `@main` App with `MenuBarExtra` (`.window` style)**
- Pure SwiftUI app lifecycle. `MenuBarExtra` provides the menu bar icon and popover. `Settings` scene for preferences window. macOS 13+ for `MenuBarExtra`, macOS 14+ for `@Observable`.
- Pros: Minimal boilerplate, Apple's intended modern path, no AppKit bridging for UI, reactive state binding via Observation framework.
- Cons: Less control over click behaviour (no left-click vs right-click distinction).

**Option B: AppKit `NSApplication` with SwiftUI views (Blue Switch approach)**
- Manual `NSStatusItem`, `NSApplicationDelegate`, SwiftUI hosted in `NSHostingView`.
- Pros: Full control over menu bar click behaviour.
- Cons: Two frameworks fighting each other. Blue Switch used this pattern and it contributed to significant bugs. More boilerplate, more bridging complexity.

**Option C: Pure AppKit**
- Everything in AppKit including settings UI.
- Pros: No framework bridging. Cons: Verbose UI code, against modern macOS direction.

### Journey
Initially assumed we'd need Option B because the exploration research mentioned left-click-to-switch / right-click-for-menu. But examining this closer: that pattern is non-standard macOS behaviour. Standard menu bar apps show a menu (or popover) on any click. Blue Switch implemented the left/right distinction and it added complexity without clear UX benefit — users expect a click to show the menu.

Dropping the left/right click requirement makes `MenuBarExtra` viable — and it's dramatically simpler. Apple introduced `MenuBarExtra` in macOS 13 specifically to make menu bar apps trivial in SwiftUI. The `.window` style gives a floating panel for richer UI (device cards, status indicators, colour) rather than a plain text menu.

Targeting macOS 14+ (Sonoma) unlocks the Observation framework (`@Observable`), which is significantly cleaner than the older `ObservableObject`/`@Published` pattern. It also aligns with TCC Bluetooth permission prompts that landed in Sonoma. User confirmed all machines are on Sonoma or later.

### Decision
**Option A: SwiftUI `@main` App with `MenuBarExtra` `.window` style.** Target macOS 14+ (Sonoma).

- `MenuBarExtra` with `.window` style for rich popover UI showing device status, peer status, switch actions
- `Settings` scene for preferences window
- `@Observable` for reactive state management
- No AppKit bridging for UI — IOBluetooth and IOKit remain as non-UI subsystem dependencies
- Standard single-click-opens-popover behaviour (no left/right click distinction)
- Detailed visual design deferred — architectural shape is: popover shows live device/peer state, actions trigger switching orchestration

## Module Architecture

### Context
How should Pigeon's four subsystems (BluetoothManager, NetworkService, RuleEngine, SwitchCoordinator) relate to each other, and how should dependencies flow? Blue Switch's architecture was a cautionary tale — singletons everywhere, no separation, race conditions from shared mutable state.

### Options Considered
Three approaches explored via perspective agents with synthesis:

**Option A: Actor-per-subsystem** — Each subsystem is its own Swift actor with compile-time isolation boundaries. Communication via async method calls, data crossing boundaries must be Sendable.
- Pros: Compile-time data race safety, enforced isolation.
- Cons: Actor reentrancy hazards (especially in SwitchCoordinator), Sendable friction with IOBluetooth's Objective-C types requiring `@unchecked Sendable` wrappers, double-dispatch when wrapping framework callbacks, state duplication at the UI boundary (actor state → MainActor observable state).

**Option B: @MainActor-centric** — All state and coordination on `@MainActor`. Background tasks only for genuinely blocking IOBluetooth calls.
- Pros: Simplest mental model, most Apple framework callbacks already arrive on main, zero reentrancy between subsystems, no Sendable friction, no state duplication for UI.
- Cons: No compile-enforced boundaries between subsystems, relies on developer discipline.

**Option C: Protocol-oriented with manual isolation** — Protocol interfaces for each subsystem, explicit dispatch queues matching each framework's threading model.
- Pros: Clean DI seams for testing, framework-aligned threading.
- Cons: Manual queue discipline, no compiler enforcement.

### Journey
Perspective agents researched each approach in depth, examining how IOBluetooth callbacks, Network framework queues, and CoreGraphics events actually behave at the threading level. Synthesis identified that all three perspectives agreed on the fundamentals: async/await for orchestration, no singletons, modest concurrency needs, `@Observable` for UI, value-type snapshots crossing boundaries.

The key tension was compiler enforcement vs practical complexity. For a 4-subsystem utility app with one developer, the actor reentrancy hazards and Sendable friction outweigh the compile-time safety benefit. Two natural hybrids emerged: actors+protocols and MainActor+protocols. The latter gives a single isolation domain (eliminating reentrancy hazards) plus protocol-based testability.

Protocols are orthogonal to the isolation choice — they layer on top of any approach. This makes them a clear win regardless.

### Decision
**MainActor + Protocols.** Single isolation domain with protocol-based dependency injection.

- All subsystems are `@MainActor` classes conforming to protocol interfaces
- Protocol interfaces (`BluetoothManaging`, `NetworkServicing`, `RuleEvaluating`, `SwitchCoordinating`) define the contracts
- Dependencies injected via constructors, registered in the SwiftUI environment
- Genuinely blocking IOBluetooth work (if any) pushed to `Task.detached`
- No singletons — subsystems created at app launch, injected downward
- IOBluetooth ObjC objects contained within BluetoothManager — only value-type snapshots flow outward

**In familiar terms:** A service layer with interface-based DI, single-threaded coordination, constructor injection. The same pattern as a well-structured Laravel app with Contracts and a service container — not microservices, not a God class.

**Layer structure:**
```
UI Layer (SwiftUI) — observes @Observable state, dispatches user actions
    ↓
Coordination Layer (SwitchCoordinator) — orchestrates switching, owns app state
    ↓
Subsystem Layer (BluetoothManager, NetworkService, RuleEngine) — framework wrappers
```

Subsystems don't know about each other. The coordinator wires them together.

**Update — refined after State Management discussion:** The layer structure evolved. See State Management section below for the final architecture, which splits the coordination layer into a thin coordinator + focused domain actions, with AppState as a separate observable state container.

## Concurrency Model

### Context
Two interrelated decisions: how should the app handle concurrency (isolation model), and what should power the event bus for the rule engine?

### Options Considered — Isolation
*(See Module Architecture above — decided together)*

### Options Considered — Event System
Explored via perspective agents with synthesis:

**Option A: Combine (PassthroughSubject)**
- Mature reactive framework with built-in operators (debounce, combineLatest, merge, filter, throttle).
- Pros: Zero custom infrastructure, tested operators, native multi-subscriber broadcasting.
- Cons: Separate mental model from async/await, every sink that triggers async work needs a `Task{}` bridge, no significant new API since 2019, known Sendable gaps.

**Option B: AsyncSequence/AsyncStream (via swift-async-algorithms)**
- Modern Swift concurrency primitives with operators from Apple-maintained SPM package.
- Pros: Unified concurrency model (same async/await used throughout), native actor/Sendable integration, structured Task cancellation, aligns with Swift's platform trajectory.
- Cons: Multi-consumer broadcasting requires ~20 lines of custom code, external package dependency (swift-async-algorithms), less mature than Combine's operator library.

### Journey
Synthesis revealed that both approaches cover Pigeon's actual operator needs (debounce, merge, combineLatest, filter). The real question was whether eliminating the Combine-to-async bridging seam at every action boundary outweighs the cost of a small external dependency and trivial broadcast infrastructure.

The deciding factors: the app already uses async/await for Bluetooth orchestration (decided in prior discussion). Every Combine sink triggering a switch would need a `Task{}` bridge. AsyncSequence eliminates this seam entirely — one programming model from event detection through to Bluetooth action. The swift-async-algorithms package is Apple-maintained and stable. And for a greenfield codebase expected to live years, aligning with Swift's trajectory (every new Apple API uses AsyncSequence, no new Combine API since 2019) has real weight.

A hybrid was considered (Combine operators consumed via `.values` as AsyncSequence) but rejected — if we're going to live in async/await, commit fully rather than maintaining two mental models.

### Decision
**AsyncSequence/AsyncStream with swift-async-algorithms.** One concurrency model throughout.

- System event monitors produce `AsyncStream<SystemEvent>` values
- Event bus broadcasts to multiple consumers via a lightweight `@MainActor` broadcaster class
- Rule engine consumes events with `for await event in eventStream`
- Operators from swift-async-algorithms: `.debounce()`, `.merge()`, `.combineLatest()` as needed
- All async code runs on `@MainActor` (per isolation decision above)
- `Task.detached` only for genuinely blocking IOBluetooth calls
- No Combine dependency — single concurrency paradigm

**In familiar terms:** Like choosing async iterators (`for await...of`) over RxJS in a TypeScript app. One programming model, no paradigm switching. The operators we need exist in a well-maintained utility library.

## State Management

### Context
How should domain state (devices, peers, rules, switch operations) be owned, mutated, and observed? This connects the module architecture (protocols + MainActor), concurrency model (async/await + @Observable), and the UI layer (SwiftUI observing state).

A background review agent flagged a critical tension: `@Observable` macro tracking doesn't work through protocol references. If the UI holds a `BluetoothManaging` (protocol) reference, SwiftUI won't observe property changes on the underlying `@Observable` class. This means protocols should define *actions* (methods), not *state* (properties).

### Options Considered — State Ownership

**Option A: Coordinator owns all state**
SwitchCoordinator holds DeviceState, PeerState, SwitchState as @Observable children. Subsystems report events to coordinator, which mutates state. Risk: coordinator becomes a God object.

**Option B: Subsystems own their domain state**
BluetoothManager owns DeviceState, NetworkService owns PeerState. More distributed. But cross-cutting state becomes awkward — "which peer owns this device?" spans both BT and network domains. This puts domain logic (ownership tracking) inside an infrastructure gateway, which is a separation-of-concerns violation.

**Option C: Separate state container + domain actions (Laravel-inspired)**
AppState is a standalone @Observable container — the "in-memory database." Domain actions are focused classes that contain business logic. The coordinator is thin — it routes events to actions, not a God object. Subsystems are stateless gateways.

### Journey
Initially explored subsystem-owned state (Option B) — seemed natural for each subsystem to own its domain. But when examining "which peer owns this device?", the state crosses subsystem boundaries. The BluetoothManager knows local connection status (from IOBluetooth callbacks), but device ownership comes from network messages (a peer announcing it claimed a device). Putting ownership tracking in the BluetoothManager would give it domain knowledge about peers and networking — breaking its role as a dumb gateway.

User identified the code smell: "The Bluetooth manager is responsible for reading and writing state in terms of Bluetooth... holding state that's domain logic, shouldn't we have some other entity for that?" This is exactly right. It's the same principle that keeps Eloquent models out of your Stripe gateway.

This led to Option C — separating state (AppState), logic (actions), and infrastructure (subsystems). The pattern maps directly from the user's Laravel architecture: thin controllers → domain actions → models → gateways. Each piece has one job.

The @Observable + protocol tension resolves naturally: protocols define the *action interface* (methods like `pair()`, `unpair()`, `send()`), while `AppState` is a concrete `@Observable` class that the UI observes directly. No protocol erasure problem because state isn't behind a protocol.

### Decision
**Separate state container + domain actions.** Laravel-inspired layered architecture.

**Entities (value types, represent real things):**
- `Device` — name, macAddress, localStatus (connected/disconnected/pairing), owner (PeerID?)
- `Peer` — name, uuid, isOnline
- `Rule` — trigger, action, isEnabled

**AppState (`@Observable`, the "database"):**
- `devices: [Device]`, `peers: [Peer]`, `rules: [Rule]`
- `activeSwitchOperation: SwitchOperation?`
- Simple accessors and lookups — no business logic
- Single source of truth for all domain state
- UI observes this directly via SwiftUI's Observation framework

**Domain Actions (focused business logic, one operation each):**
- `SwitchDeviceAction` — orchestrates full device switch (network release → BT pair → update state)
- `ClaimDeviceAction` — claims a device for this Mac
- `ReleaseDeviceAction` — releases a device from this Mac
- `RegisterDeviceAction` — adds a device to managed list
- Dependencies injected via constructor (protocols for subsystems, concrete AppState)
- Each action is independently testable

**Coordinator (thin, routes events to actions):**
- Receives events from UI (user tapped Switch), rule engine (display connected), network (peer claimed device)
- Dispatches to appropriate action
- Does NOT contain domain logic — that lives in actions
- Simple event-to-action routing, like a thin controller

**Subsystems (stateless gateways, coded to interfaces):**
- `BluetoothManaging` / `BluetoothManager` — pair/unpair/connect, reports BT events
- `NetworkServicing` / `NetworkService` — send/receive messages, reports peer events
- `SystemEventMonitoring` / `SystemEventMonitor` — wraps CoreGraphics, IOKit, NSWorkspace, NWPathMonitor, IOBluetooth notifications. Produces raw system events. No rule knowledge, no access to AppState.
- No domain knowledge, no state ownership
- Reports events to coordinator via async streams

**@Observable + Protocol boundary:**
- Protocols define *operations* (methods): `pair()`, `unpair()`, `send()`
- State lives in concrete `@Observable` class (`AppState`) — observed by UI directly
- No protocol erasure problem because UI never observes through a protocol reference

**Final architecture:**
```
UI Layer (SwiftUI)
  observes: AppState (@Observable)
  calls: Coordinator (thin event routing)
    ↓
Domain Layer
  Coordinator → dispatches to → Domain Actions
  Actions contain business logic, mutate AppState
    ↓
Infrastructure Layer
  BluetoothManaging (protocol) → BluetoothManager
  NetworkServicing (protocol) → NetworkService
  SystemEventMonitoring (protocol) → SystemEventMonitor
```

**In Laravel terms:** AppState = your Eloquent models/database. Actions = your domain action classes. Coordinator = thin controller. Subsystems = gateways (Stripe, mail, etc.) coded to interfaces and injected via DI.

## App Lifecycle

### Context
What happens when a Mac sleeps, wakes, starts up, or shuts down? The key question turned out to be: what happens to the trackpad when its owning Mac is asleep and another Mac wants it?

### Journey — Sleep/Wake and the Pairing Problem
Explored the sleep scenario in depth. Without Pigeon: when Mac A sleeps, the trackpad loses its active connection but *retains its pairing* to Mac A. The trackpad won't accept connections from Mac B (authentication failure 0x05). When Mac A wakes, the trackpad auto-reconnects. No user action needed.

This means switching requires Mac A to be awake to call `remove` (unpair). If Mac A is asleep, Mac B is stuck — it can't claim the trackpad without Mac A's cooperation.

Explored whether auto-releasing on sleep could solve this. It works technically but creates a cascade of complexity: who reclaims on wake? What if both Macs wake simultaneously? Do they need shared rule awareness to avoid conflicts? What about the scenario where sleep was momentary (user went to make coffee) — releasing the trackpad would be disruptive. Each edge case spawns more edge cases. The complexity is disproportionate to the problem.

Exhaustively explored every possible way to "backdoor" a trackpad paired to a sleeping Mac:

| Approach | Result |
|----------|--------|
| `remove` from the other Mac | No — `remove` only works on the locally paired Mac |
| USB-C cable to new Mac | Works but requires physical cable — can't automate |
| Power cycle trackpad | Works but requires physically pressing the power button |
| `IOBluetoothDevicePair.pair()` without unpairing | No — authentication failure 0x05 |
| Forge/brute-force pairing key | No — 128-bit, security vulnerability not a feature |
| Raw HCI command to reset remote pairing | No — no known HCI command for this |
| HCI inquiry while trackpad is in "waiting for host" state | No — trackpad is not discoverable in this state |
| Force connection via known MAC address | No — trackpad refuses unauthenticated connections |
| MDM remote unpair | No — MDM has no such command |

Every path is a dead end. The pairing key lives in the trackpad's firmware and only the paired Mac or a USB-C cable can overwrite it. This is a Bluetooth protocol constraint, not a software limitation.

This led to exploring Wake-on-LAN as a solution.

### Decision — Sleep/Wake

1. **Pairing survives sleep.** No auto-release on sleep. The trackpad reconnects to its paired Mac on wake. Switching is always an intentional act — manual or rule-triggered.

2. **Wake-on-LAN fallback.** When the owning Mac is asleep and the user wants to switch, Pigeon can attempt to wake it via a Wake-on-LAN magic packet over Ethernet. The woken Mac doesn't need to be unlocked — apps resume in the background before the lock screen is dismissed, so Pigeon can receive and execute the release command without user interaction at the sleeping Mac. FileVault doesn't block this (decryption keys are held in memory during normal sleep).

   **UX flow:**
   - User taps Switch, peer is sleeping
   - "Work MacBook is asleep. Would you like Pigeon to try waking it?"
   - User confirms
   - Pigeon sends magic packet, shows "Waking..." state
   - **Success:** peer reappears on network (NWBrowser `.added`), switch proceeds automatically
   - **Failure:** after ~15 seconds, "Couldn't wake Work MacBook. You may need to wake it manually or check that 'Wake for network access' is enabled in its Energy Saver settings."

3. **Peer info exchange includes WoL capability.** During normal peer communication, each Pigeon instance reports whether Wake-on-LAN is enabled on its Mac (detectable via IOKit power management APIs) and its Ethernet MAC address (needed to construct the magic packet). This lets the UI show the right option:
   - Peer reported WoL enabled → offer "Try to wake it?"
   - Peer reported WoL disabled → "Wake it manually, or enable 'Wake for network access'"
   - Unknown (never connected) → offer best-effort attempt

4. **No special coordinator logic on sleep/wake.** Subsystems handle their own lifecycle (NetworkService manages its listener per peer-networking discussion). Sleep/wake are system events that flow through the rule engine like any other trigger. No auto-claim, no auto-release, no conflict resolution needed.

**Note:** Wake-on-LAN is most reliable over Ethernet. Works over Wi-Fi in some configurations but not guaranteed. The user's setup (both Macs wired via Ethernet) is ideal.

### Review Refinements

Background review (review-002) flagged three gaps in the state management decision. Discussed and resolved:

**1. Event flow — single merged stream.** Subsystems each produce an `AsyncStream` of events. The coordinator merges them using swift-async-algorithms' `merge()` into a single stream with one routing loop. One place where all events arrive, one routing decision. Cleaner than separate listeners per subsystem since the coordinator's response pattern is the same regardless of source — check the event, decide what action to run, run it.

**2. RuleEngine split — gateway vs domain logic.** The "RuleEngine" was labelled a stateless gateway but needed to read AppState to evaluate rules — blurring the boundary. Split into two pieces to keep the pattern consistent:
- `SystemEventMonitor` (gateway) — wraps CoreGraphics, IOKit, NSWorkspace, NWPathMonitor, IOBluetooth. Produces `AsyncStream<SystemEvent>`. No knowledge of rules, no access to AppState. A dumb pipe like the other gateways.
- Rule evaluation (domain logic) — lives in the coordinator's routing logic or as an `EvaluateRulesAction`. Receives a system event, reads `AppState.rules` and current device/peer state, determines if any rules match, dispatches the appropriate action.

This keeps all gateways as dumb pipes and all domain logic in the domain layer. No exceptions.

**3. Concurrent switch prevention.** If a switch is in progress (`AppState.activeSwitchOperation` is non-nil), reject any new switch request — whether from a rule or the user. No queueing (a queued switch would be stale — the state has changed by the time it runs). No priority system between rules and manual actions — if rules are fighting manual actions, the user should fix their rules, not the architecture. UI shows the switch in progress (button disabled). Silently dropped rule triggers go unnoticed because the device is already moving.

### Decision — Login Item
**On by default, toggleable in Settings.** Use `SMAppService.mainApp.register()` (macOS 13+). One-liner, no helper app needed. macOS handles persistence across reboots. User can also manage it from System Settings > General > Login Items. Standard pattern for menu bar utilities.

### Decision — Graceful Shutdown
**Warn if mid-switch, otherwise quit cleanly.** If `AppState.activeSwitchOperation` is non-nil when the user quits, show a confirmation: "A device switch is in progress. Quitting now may leave your trackpad disconnected from both Macs. Quit anyway?" If they wait, the switch completes (3-7 seconds) and Pigeon quits. If they quit anyway, trackpad is recoverable via USB-C cable or power cycle.

Subsystems clean up their own resources on quit (NetworkService closes connections and stops listener, RuleEngine stops monitors, BluetoothManager unregisters notifications). Good practice, though macOS handles cleanup on process exit regardless.

## Error Handling Strategy

### Decision
**Dual-channel: notifications for events, UI for state.** Errors carry domain context from the action layer, presented by the coordinator/UI layer.

**Error flow:**
Actions throw typed errors with domain messages ("Bluetooth pairing timed out after 3 retries", "peer didn't acknowledge release within 10 seconds"). The coordinator catches errors, updates AppState (which drives the UI), and fires a macOS notification. Domain knowledge stays in the domain layer, presentation stays in the UI layer.

**Notifications (background events):**
- Switch succeeded: "Magic Trackpad switched to this Mac"
- Switch failed: "Switch failed — Work MacBook didn't respond"
- Peer events: "Work MacBook came online"
- Fire regardless of whether the popover is open
- User enables/disables in Settings

**Popover UI (live state):**
- Always reflects current state — device cards show connection status, error states, retry actions
- Errors are state, not modals or popups — a failed switch means the device card shows an error state until retried or resolved
- No transient messages — just the live picture

## Configuration and Storage

### Decision
Standard Mac utility conventions — no database, flat files and system APIs.

| Data | Storage | Rationale |
|------|---------|-----------|
| Rules | JSON file in `~/Library/Application Support/Pigeon/` | Structured, human-readable, easy to debug/backup. Codable structs serialised to JSON. Loaded at launch, kept in memory (AppState), saved on change. Same format works for peer-to-peer sync over the network. |
| App settings (launch at login, notifications, etc.) | UserDefaults via SwiftUI's `@AppStorage` | Built-in key-value store, trivial, SwiftUI-native. Standard for simple toggles and preferences. |
| Peer identity (UUID) | UserDefaults | Simple persistent value, generated once on first launch. |
| Registered devices list | JSON file (same file as rules, or its own) | Small structured data, same rationale as rules. |
| TLS certificates (future, public distribution) | Keychain | macOS's built-in secure credential storage. Not needed for MVP personal use. |

No Core Data, no SQLite, no database. For a few dozen rules and a handful of settings, flat files are the Mac convention. Even BetterTouchTool, Hammerspoon, and Keyboard Maestro use flat file configuration.

## Build and Distribution

### Decision
- **Non-sandboxed, notarized** — required for private `remove` API. Hardened Runtime enabled.
- **macOS 14+ (Sonoma)** — unlocks `MenuBarExtra`, `@Observable`, TCC Bluetooth prompts. User confirmed all machines compatible.
- **Auto-update via Sparkle** — the de facto standard for non-App Store Mac apps. Open source, well-maintained, 15+ years of use across the Mac ecosystem.

**Update behaviour:**
- Sparkle checks an appcast (XML feed) hosted on a server (GitHub Releases or similar)
- User controls in Settings:
  - Automatically check for updates (on/off)
  - Automatically download updates (on/off)
  - "Check for Updates Now" button
- **Always prompt before installing** — never auto-install. "Pigeon 1.2.0 is ready to install. Restart now?"
- Downloads are verified against the app's code signature before installation

**Settings window:**
- Accessible from the menu bar popover
- SwiftUI `Settings` scene (already decided)
- Contains: launch at login toggle, update preferences, notification preferences, registered devices, rules management

## Summary

### Key Insights
1. Dropping the left-click/right-click distinction eliminates the need for AppKit bridging and enables a pure SwiftUI app structure
2. `MenuBarExtra` `.window` style provides rich popover UI without framework complexity
3. macOS 14+ target unlocks the modern Observation framework alongside `MenuBarExtra`
4. MainActor + Protocols gives the safety/testability sweet spot for a utility app this size — actor-per-subsystem adds reentrancy complexity without proportional benefit
5. AsyncSequence over Combine unifies the concurrency model — one paradigm from event detection through to Bluetooth action, no bridging seams
6. Separating state (AppState), logic (domain actions), and infrastructure (subsystem gateways) produces a clean architecture where each piece has one job — directly inspired by the user's proven Laravel pattern of thin controllers + domain actions + models + gateway interfaces
7. The @Observable + protocol tension resolves naturally: protocols for operations, concrete @Observable for state. No conflict because they serve different purposes
8. The coordinator is explicitly NOT a God object — it routes events to actions, like a thin controller. Domain logic lives in focused, testable action classes

### Open Threads
- Composition root wiring — where/how objects are instantiated in the SwiftUI App struct (deferred to planning)
- AppState mutation boundaries — typed mutation methods vs direct property access (deferred to implementation)
- Action failure rollback and cancellation paths — how mid-flight switches recover or cancel (deferred to planning; Bluetooth switching protocol discussion covers retry/recovery)
- Network framework and IOBluetooth callback threading integration with MainActor — needs real-device validation (deferred to implementation)
- Specific Hardened Runtime entitlements for notarization with private API usage (deferred to implementation)
- Request-response patterns within domain actions — how actions wait for peer acknowledgments (deferred to planning)
- App name inconsistency — peer-networking and bluetooth-switching-protocol discussions still use "MagicPad" from before the naming decision

### Current State
- App structure and entry point decided (SwiftUI + MenuBarExtra)
- Module architecture decided (MainActor + Protocols, layered architecture)
- Concurrency model decided (async/await + AsyncSequence, single MainActor domain)
- State management decided (AppState + domain actions + thin coordinator + stateless gateways)
- App lifecycle decided (pairing survives sleep, Wake-on-LAN fallback, login item on by default, warn on quit mid-switch)
- Error handling decided (dual-channel — notifications for events, UI for state)
- Configuration decided (JSON for rules, UserDefaults for settings, Keychain for certs)
- Build and distribution decided (macOS 14+, non-sandboxed, notarized, Sparkle for auto-update)
