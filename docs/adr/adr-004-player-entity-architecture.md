# ADR-004: Player Entity Architecture and Character State Management

## Status

Proposed

## Context

Nookstead is introducing its first interactive game entity: the player character. This requires three foundational technical decisions that will shape how all future entities (NPCs, multiplayer characters) are implemented:

1. **Entity Architecture Pattern**: How to structure the player character as a Phaser game object. The choice affects code organization, testability, and reusability for the NPC system planned in M0.2.

2. **Character State Machine Pattern**: How to manage character behavioral states (idle, walk, sit, hit, punch, hurt) and their transitions. The MVP uses only idle and walk, but the architecture must register all 7 states and scale to NPC autonomous behavior.

3. **Sprite Sheet Loading Strategy**: The LimeZu character sprite sheet (`scout_6.png`, 927x656 pixels) uses 16x32 frame cells with an irregular layout -- different animation rows have different frame counts (3-6 frames), different direction orders (LEFT/UP/RIGHT/DOWN vs LEFT/DOWN/RIGHT/UP), and the sheet width (927px) does not divide evenly by the 16px frame width (927/16 = 57.9375). The loading strategy must handle this reliably while supporting the multi-skin architecture.

### Constraints

- **Phaser.js 3** is the game engine (already integrated)
- **pixelArt mode** is enabled (`pixelArt: true, roundPixels: true` in game config)
- **TypeScript strict mode** is enforced
- Frame cell size is 16x32 (one tile wide, two tiles tall)
- The sprite system must be reusable for NPCs and multiplayer characters in M0.2
- The current codebase has no existing entity/character code (greenfield)

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Use Phaser.Sprite subclass for entity architecture, a lightweight class-based finite state machine for state management, and Phaser's built-in spritesheet loader with explicit frame index arrays for sprite loading. |
| **Why now** | The player character is the first game entity and establishes patterns that all future entities (NPCs, remote players) will follow. Getting the foundation right avoids costly refactoring in M0.2. |
| **Why this** | Sprite subclass is idiomatic Phaser for entities that ARE sprites; class-based FSM balances simplicity with extensibility for 7+ states; spritesheet loader with frame arrays avoids external tooling while handling the irregular sheet layout. |
| **Known unknowns** | Whether the 927px sheet width causes off-by-one issues in Phaser's frame indexing at row boundaries; whether the FSM pattern scales adequately for NPC daily planning behavior in M0.2. |
| **Kill criteria** | If more than 3 entity types need fundamentally different game object compositions (e.g., multi-sprite entities, particle-emitting entities), the Sprite subclass approach should be reconsidered in favor of a Container or ECS pattern. |

## Rationale

### Decision 1: Entity Architecture

#### Options Considered

1. **Option A: Extend Phaser.Sprite** (Selected)
   - The player character IS fundamentally a single animated sprite. Extending `Phaser.Sprite` provides direct access to all sprite methods (play, setVelocity, setFrame, etc.) without wrapper boilerplate.
   - Pros:
     - Idiomatic Phaser pattern, well-documented and widely used
     - Direct access to position, animation, physics, depth, and rendering APIs
     - Minimal abstraction overhead -- no delegation needed
     - Works natively with `scene.add.existing()` and Phaser's update loop
     - TypeScript class syntax integrates naturally with strict mode
   - Cons:
     - Tight coupling to Phaser's Sprite API (migration cost if engine changes)
     - Cannot compose multiple visual elements (e.g., sprite + nameplate) without refactoring
     - Inheritance hierarchy can become rigid if entity types diverge significantly

2. **Option B: Phaser.Container with child Sprite**
   - A Container groups game objects and provides a shared transform. The character would be a Container with a Sprite child, allowing future addition of health bars, nameplates, or shadow sprites.
   - Pros:
     - Supports multi-child composition (sprite + health bar + shadow)
     - Single transform for all children
     - Clean separation between container logic and visual representation
   - Cons:
     - Container has a performance cost (Phaser docs warn against overuse)
     - Adds indirection for every sprite method call (`this.sprite.play()` instead of `this.play()`)
     - Overkill for MVP where the entity is a single sprite
     - Containers don't support physics bodies directly; the body must be on the container or a child

3. **Option C: Plain TypeScript class wrapping a Sprite (Composition)**
   - A custom class that owns a `Phaser.Sprite` instance and delegates method calls. This is the "favor composition over inheritance" approach.
   - Pros:
     - Maximum flexibility -- class can own any combination of game objects
     - Not tied to Phaser's inheritance hierarchy
     - Easier to mock in unit tests (no Phaser scene dependency)
   - Cons:
     - Requires manual delegation for every Phaser API used (position, animation, depth, etc.)
     - Does not participate in Phaser's scene graph natively (must manually add sprite to scene)
     - Does not receive `preUpdate()` calls unless registered manually
     - Significantly more boilerplate for equivalent functionality

4. **Option D: Entity-Component-System (ECS) library (e.g., Phatty)**
   - Use a third-party ECS framework designed for Phaser to compose entities from reusable components.
   - Pros:
     - Maximum reusability and decoupling
     - Components can be mixed and matched across entity types
     - Popular pattern in game development
   - Cons:
     - Adds an external dependency for a problem that does not yet exist (only 1 entity type)
     - Learning curve and integration cost
     - Over-engineered for MVP with 1-2 entity types
     - YAGNI -- premature abstraction before entity diversity is established

#### Comparison: Entity Architecture

| Evaluation Axis | A: Sprite Subclass | B: Container | C: Composition | D: ECS Library |
|---|---|---|---|---|
| Implementation effort | 1 day | 2 days | 2 days | 3+ days |
| Phaser integration | Native | Native | Manual | Plugin |
| Multi-child support | No | Yes | Manual | Yes |
| Performance overhead | Minimal | Moderate | Minimal | Varies |
| Testability | Medium | Medium | High | High |
| YAGNI compliance | High | Medium | Medium | Low |
| NPC reuse (M0.2) | Subclass again | Subclass again | Instantiate | Compose |

**Selected: Option A (Sprite Subclass)**. For MVP with a single-sprite entity, inheritance is the simplest correct solution. The migration path to Container (Option B) is straightforward if multi-child entities are needed later: extract the sprite into a Container child and move the logic to the Container class.

### Decision 2: State Machine Pattern

#### Options Considered

1. **Option A: Enum + switch statement**
   - Define character states as a TypeScript enum and use a switch statement in the `preUpdate()` method to dispatch behavior based on the current state.
   - Pros:
     - Simplest possible implementation
     - No additional classes or abstractions
     - Easy to read for small state counts (2-3 states)
     - Zero runtime overhead
   - Cons:
     - Switch statement grows linearly with state count (7 states in PRD)
     - Enter/exit logic requires manual tracking of previous state
     - Difficult to test individual states in isolation
     - State-specific data must be stored in the parent class

2. **Option B: Class-based Finite State Machine** (Selected)
   - A lightweight `StateMachine` class manages state transitions. Each state is an object with `enter()`, `update()`, and `exit()` hooks. The state machine enforces single-state invariance and handles transitions.
   - Pros:
     - Each state is isolated and independently testable
     - Enter/exit hooks are explicit and automatic
     - State-specific data is encapsulated within the state object
     - Scales cleanly to 7+ states without growing a single method
     - Reusable for NPC state management in M0.2
     - Well-documented pattern in Phaser community (Ourcade, GameDev Academy tutorials)
   - Cons:
     - More classes/files than enum+switch
     - Slight indirection (state machine dispatches to state objects)
     - Marginally more complex for the 2-state MVP

3. **Option C: Phaser Animation Events**
   - Use Phaser's built-in animation events (`animationcomplete`, `animationstart`) to drive state transitions. State is implicitly determined by which animation is currently playing.
   - Pros:
     - Zero custom code for state tracking -- Phaser manages it
     - Animation and state are always in sync by definition
     - No additional state machine infrastructure
   - Cons:
     - State is implicit, making it hard to reason about and debug
     - Cannot represent non-visual states (e.g., stunned, interacting)
     - Animation events don't fire during held-key movement (no transition event)
     - Cannot enforce transition rules (any animation can be played at any time)
     - Not suitable for NPC behavioral states (planning, reflecting, conversing)

#### Comparison: State Machine Pattern

| Evaluation Axis | A: Enum+Switch | B: Class-based FSM | C: Animation Events |
|---|---|---|---|
| Implementation effort | 0.5 days | 1 day | 0.5 days |
| Testability | Low | High | Very Low |
| State isolation | None | Full | None |
| Extensibility (7+ states) | Poor | Excellent | Poor |
| NPC reuse potential | Low | High | None |
| Enter/exit hooks | Manual | Automatic | Partial |
| Non-visual states | Yes | Yes | No |

**Selected: Option B (Class-based FSM)**. The PRD registers 7 animation states and the GDD plans NPC agents with daily plans, reflections, and autonomous behavior. A class-based FSM provides the right level of structure: simple enough for 2 MVP states, extensible enough for future growth, and independently testable.

### Decision 3: Sprite Sheet Loading Strategy

#### Options Considered

1. **Option A: Phaser spritesheet loader with explicit frame arrays** (Selected)
   - Load the sprite sheet using `this.load.spritesheet()` with `frameWidth: 16, frameHeight: 32`. Phaser creates frames in left-to-right, top-to-bottom order, computing `floor(sheetWidth / frameWidth)` columns per row. Define animations using `generateFrameNumbers()` with explicit `frames: [index1, index2, ...]` arrays rather than sequential `start/end` ranges.
   - Pros:
     - Uses Phaser's built-in loader -- no external tools or files needed
     - Frame indices are deterministic: `rowIndex * columnsPerRow + columnIndex`
     - Explicit frame arrays handle irregular layouts (different frame counts, direction orders per row)
     - The 927px width issue is handled naturally: `floor(927/16) = 57` columns, last 15px is ignored
     - Animation definitions can be expressed as a pure data structure mapping `{state, direction} -> frame[]`
     - No JSON atlas file to maintain in sync with the PNG
   - Cons:
     - Frame indices are computed from sheet geometry (must be documented carefully)
     - If the sprite sheet PNG changes layout, frame indices must be recomputed
     - The 57-column assumption must be verified against the actual sheet

2. **Option B: JSON Texture Atlas**
   - Create a JSON atlas file that defines each frame by name and pixel coordinates. Load using `this.load.atlas()`.
   - Pros:
     - Named frames (e.g., `idle_left_0`, `idle_left_1`) are self-documenting
     - Frame coordinates are explicit in the JSON -- no index computation
     - Handles any sprite sheet layout without assumptions
     - `generateFrameNames()` with prefix-based naming is clean
   - Cons:
     - Requires creating and maintaining a JSON atlas file per skin (currently manual, no automated tool)
     - JSON file must stay in sync with the PNG -- a maintenance burden
     - Adds a second file per skin to the asset pipeline
     - Overkill for sheets with a consistent frame cell size (which this sheet has -- 16x32)

3. **Option C: Programmatic frame definition via Texture API**
   - Load the image as a plain image, then use `this.textures.get(key).add()` to manually define frame rectangles at exact pixel coordinates.
   - Pros:
     - Maximum control over frame coordinates
     - No assumptions about grid regularity
     - Frames can be named
   - Cons:
     - Verbose -- each of 120+ frames must be defined individually
     - Bypasses Phaser's spritesheet infrastructure
     - More error-prone (manual coordinate specification)
     - No community examples or documentation for this approach at scale

#### Comparison: Sprite Sheet Loading

| Evaluation Axis | A: Spritesheet + Frame Arrays | B: JSON Atlas | C: Programmatic Frames |
|---|---|---|---|
| Implementation effort | 0.5 days | 1.5 days | 2 days |
| External files needed | 0 (just PNG) | 1 JSON per skin | 0 |
| Maintenance burden | Low (data-driven) | Medium (JSON sync) | High (manual coords) |
| Handles irregular layout | Yes (via explicit arrays) | Yes (via coordinates) | Yes (via coordinates) |
| Phaser idiom | Standard | Standard | Non-standard |
| Multi-skin scalability | Good (same indices for all skins) | Good (same JSON template) | Poor (verbose per skin) |

**Selected: Option A (Spritesheet + Frame Arrays)**. Since all skins share the same frame layout (per PRD assumption), frame indices are computed once and reused across all skins. The spritesheet loader is the simplest approach that handles the irregular layout correctly. The animation definition becomes a pure data structure that maps `(animationName, direction) -> frameIndex[]`, which is easy to test and maintain.

## Consequences

### Positive Consequences

- **Simple, idiomatic foundation**: Sprite subclass + spritesheet loader follows the most common Phaser patterns, reducing onboarding friction for new developers
- **Testable state management**: Class-based FSM allows unit testing individual states without a Phaser scene
- **Data-driven animations**: Animation frame mappings are pure data, separable from Phaser runtime, enabling validation without rendering
- **Reusable for NPCs**: The FSM and animation systems are entity-agnostic; NPCs can use the same infrastructure with different states
- **No external tooling**: No texture packer or atlas generator needed in the asset pipeline

### Negative Consequences

- **Frame index fragility**: If the sprite sheet layout changes, frame index arrays must be recomputed. Mitigated by centralizing the mapping in a single configuration file
- **Sprite subclass coupling**: The player entity is coupled to Phaser's Sprite class. Migration to Container requires refactoring if multi-child entities become necessary
- **FSM overhead for MVP**: Two functional states (idle, walk) could be implemented more simply with a boolean. The FSM investment pays off when additional states are activated

### Neutral Consequences

- The 57-column-per-row spritesheet geometry becomes a documented constant that all skin definitions depend on
- The FSM pattern introduces a well-known architectural boundary between input handling and state behavior

## Implementation Guidance

- **Entity classes should extend `Phaser.GameObjects.Sprite`** and register with the scene via `scene.add.existing(this)`
- **Use dependency injection for the state machine**: Pass the FSM instance to the entity rather than hardcoding it, enabling different state configurations for players vs NPCs
- **Animation frame mappings should be expressed as declarative data structures** (e.g., a configuration object or registry), not embedded in imperative code
- **The spritesheet column count (57) must be derived from the actual PNG dimensions at load time** rather than hardcoded, to prevent silent breakage if the asset changes
- **State transitions should be explicit**: States declare which transitions they allow, preventing invalid state sequences

## Related Information

- [PRD-003: Player Character System](../prd/prd-003-player-character-system.md) -- Functional requirements and acceptance criteria
- [ADR-001: Procedural Island Map Generation Architecture](adr-001-map-generation-architecture.md) -- Establishes the map rendering pattern this entity renders on top of
- [Phaser 3 Animation Manager API](https://docs.phaser.io/api-documentation/class/animations-animationmanager) -- `generateFrameNumbers()` with explicit frame arrays
- [Phaser 3 Camera.startFollow API](https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera) -- Camera follow with lerp
- [Create a State Machine for Character Logic in TypeScript (Ourcade)](https://blog.ourcade.co/posts/2021/character-logic-state-machine-typescript/) -- FSM pattern reference for Phaser 3
- [State Pattern for Character Movement in Phaser 3 (Ourcade)](https://blog.ourcade.co/posts/2020/state-pattern-character-movement-phaser-3/) -- Movement-specific FSM patterns
- [Phaser FSM Tutorial Series (osmose.ceo)](https://osmose.ceo/blog/phaser-finite-state-machine/) -- Comprehensive FSM implementation guide
- [Phatty: Unity-inspired ECS for Phaser (rejected option)](https://phaser.io/news/2025/04/phatty) -- ECS alternative considered but deferred
- [Phaser Textures Documentation](https://docs.phaser.io/phaser/concepts/textures) -- Spritesheet vs Atlas concepts

## Date

2026-02-15
