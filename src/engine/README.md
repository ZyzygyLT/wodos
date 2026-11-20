# Wodos Game Engine

The engine is a domain layer for reusable game rules. It must remain independent of Next.js, Prisma, PostgreSQL, Redis, BullMQ, HTTP, and UI concerns.

## First foundation: Core

`src/engine/core` defines runtime-neutral contracts and pure functions for:

- entity identity;
- configurable attributes and validation;
- derived-stat modifiers;
- effects and their duration contracts;
- injectable randomness, including deterministic seeded simulations.

No module assumes Wodos-specific attribute abbreviations such as `st`, `co`, or `dx`. Game-specific catalogues define their own keys and ranges.

## Dependency direction

```text
app / UI / API
      |
   services
      |
 infrastructure adapters ---> Prisma / PostgreSQL / Redis
      |
   engine (pure domain rules)
```

The engine must never import from `app`, `services`, `generated/prisma`, or infrastructure packages. Adapters translate persisted records into engine contracts and back.

## Migration policy

1. Add and test a pure domain capability in `src/engine`.
2. Add an adapter around the existing Wodos model/service.
3. Migrate one call path at a time, preserving existing behavior.
4. Compare old and new outputs with characterization tests before removing legacy code.
5. Do not change Prisma schema or gameplay balance as part of a core extraction unless a separate migration explicitly requires it.

## Initial contracts

- Attribute keys are data, not a hard-coded enum.
- Unknown attributes are rejected by default; callers can explicitly allow them during controlled migration.
- Stat modifiers are deterministic: flat additions, then percentage points.
- Effects describe state; `core/effects/effect-lifecycle.ts` applies explicit stack/refresh/replace policies, advances finite durations and removes expired effects. The caller chooses when a turn/round advances.
- Randomness is injected. Seeded randomness is for repeatable simulations, tests, and replay tooling; production callers may provide a secure or runtime-specific source.

## Prisma adapters (compatibility boundary)

The engine must not import generated Prisma types or query the database. Adapters accept small structural data contracts:

- `toEngineAttributeDefinition` maps persisted `AttributeDefinition` records to the configurable engine catalogue. The current schema has no default-value column, so the adapter uses `minValue` as the compatibility default; callers may provide an explicit default resolver.
- `toActiveEngineAttributes` excludes archived records before building the active catalogue.
- `itemStatsToModifiers` converts finite numeric item stats into flat modifiers. Healing keys (`healHp`, `healMp`) are excluded by default because they are consumable effects, not persistent character stats.
- `equippedItemsToModifiers` reads only equipped inventory rows. Its default behavior remains identical to the legacy calculation: it applies `item.stats` and excludes healing keys.
- `resolveWodosStatOverrideBonus` adapts the legacy `buildHeroData` behavior: `statOverrides` replaces matching keys from `item.stats` (object spread), so the adapter emits the additive delta from the base value rather than adding the replacement twice. Supply it as `resolveStatOverrides`.
- `resolveWodosUpgradeBonus` adapts `src/lib/craft/upgrade-stats.ts`: each merged item stat is scaled by 20% per upgrade level and rounded. It accounts for overrides before applying the curve, matching the order in `buildHeroData`, and emits only the additive delta. Supply it as `resolveUpgrade`.
- `createWodosRuneResolver` resolves each persisted `{ slotIndex, itemId }` entry against a caller-loaded rune item catalogue and sums the rune stats. The socket endpoint consumes the separate rune inventory row and stores only its item ID on the host item, so the resolver must receive the catalogue map. Supply it as `resolveRunes`.
- Each source is preserved in modifier IDs and breakdown metadata.

These adapters are deliberately one-way and do not query Prisma. The dungeon/arena preparation path in `src/lib/dungeon-helpers.ts` now loads the rune catalogue and passes the persisted hero items through this adapter before combat. The adapter preserves the legacy calculation order: base stats, replacement overrides, upgrade scaling, then rune additions. `computeDefenseForHero` now delegates formula/rank/dice/fallback handling to `core/combat/defense.ts`. It accepts pre-resolved `equipStats` from the dungeon preparation path; callers that only provide inventory rows retain the prior base `item.stats` aggregation.

## Derived combat statistics and defense

- `core/stats/derived-stats.ts` owns the Wodos profile formulas for HP, MP, base defense and initiative. Existing exports in `lib/combat-engine/formulas.ts` delegate to these functions, preserving the public API and formula values.
- `core/combat/defense.ts` calculates configured defense skills, rank coefficients, dice and the DX fallback. It accepts an injectable `RandomSource` for deterministic simulations; when omitted it preserves runtime randomness.
- The current defense rule uses the selected profile (null dungeon level first), minimum 1 for formula-based defense, and no minimum for the DX fallback, matching the existing implementation.

## Pure stat pipeline

`core/stats/stat-pipeline.ts` composes base stats, explicit modifiers (for example equipped items), and modifiers from non-expired effects targeting the requested entity. It returns final values plus a per-stat breakdown and the IDs of applied/expired effects. The pipeline intentionally does not decide effect stacking, duration ticking, caps, or rounding. `core/effects/effect-lifecycle.ts` now provides pure lifecycle operations: `stack` preserves independent instances, `refresh` keeps the existing instance/modifiers and resets its duration, and `replace` removes same-target/same-kind instances before installing the incoming one. Finite durations advance only when the caller explicitly invokes `advanceEffects`; permanent effects remain unchanged. The combat/application layer still decides when to tick and which policy each effect should use. No Prisma or application imports are allowed in this module.

## First hero integration seam

`adapters/prisma/hero-stat-adapter.ts` provides a compatibility entry point for already-loaded hero read models: it takes base stats, `HeroItem` rows and optional engine effects, then delegates to the generic pipeline. It does not query Prisma. The dungeon/arena preparation path uses it for equipment totals; `computeDefenseForHero` remains a separate legacy path.

## Validation status

Unit tests are added for core contracts and adapter mapping. Run the repository test suite and `npx tsc --noEmit` before treating the migration as verified.


### Legacy combat status compatibility

- `adapters/combat/status-effect-adapter.ts` maps Wodos' legacy `StatusEffect` shape to/from the neutral `GameEffect` contract without importing the combat runner.
- The adapter preserves current behavior: one instance per status type and target, refresh by maximum value/duration while retaining original source, poison/burn/bleed damage at round start, stun/freeze turn skipping, and end-of-round duration decay.
- This is a compatibility boundary, not a combat-runner migration. Existing battle execution remains unchanged until differential integration tests can verify the complete turn sequence.


### Legacy group buff compatibility

- `adapters/combat/buff-effect-adapter.ts` maps Wodos' group `BuffEntry` values to neutral `GameEffect` records and back. Group buffs target a combat-side identity because they affect a whole side rather than an individual unit.
- The adapter preserves the existing identity key (source name + buff type + side), stronger-value replacement, longer finite-duration refresh, and the legacy permanent-to-finite refresh edge case.
- Finite group buffs tick at the beginning of each round, matching the current runner order. Group ATK/DEF bonuses remain the maximum active value, not a sum.
- The dungeon runner now delegates buff application, ticking and group-bonus aggregation to this adapter. Passive-effect trigger execution remains in the legacy runner for a later, separately characterized migration.

### Combat events and passive-effect compatibility

- `core/events/combat-events.ts` defines runtime-neutral `on_damage`, `on_death`, and `on_round_start` event contracts plus ordered handler dispatch.
- `adapters/combat/passive-effect-adapter.ts` resolves Wodos passive definitions into commands. It preserves trigger filtering, numeric and attribute-scaled values, legacy rounding/coefficient fallback, targets, damage type, buff type, and the legacy truthiness filter for zero/NaN values.
- The dungeon runner now dispatches the three legacy triggers through the engine event contract and executes the resolved commands using its existing damage/heal/buff handlers. Side-effect semantics and combat timing remain in the runner; this phase does not change damage formulas or target rules.
- Event dispatch is synchronous and ordered. The event contract allows the legacy damage trigger to omit an amount because the existing passive call site does not pass the resolved damage value.

### Shared combat HP changes

- `core/combat/health.ts` centralizes the arithmetic for HP damage and healing and reports requested/applied amounts, whether HP changed, and whether a unit crossed into defeat on this operation.
- Damage preserves the legacy zero floor; healing preserves the legacy maximum-HP ceiling. The helpers do not dispatch events or own combat logs, so callers retain control of timing, messages, passives, and death handling.
- The dungeon runner now routes its direct HP damage/healing assignments through these helpers, including attacks, periodic damage, passive damage/healing, thorns, counterattacks, vampirism, consumables, skill healing and faction healing. Trap deactivation remains a state transition rather than a damage operation.
- This is an arithmetic extraction only. Existing differences in when damage/death passives are triggered are intentionally not silently changed in this phase.


### Idempotent combat defeat processing

- `core/combat/defeat.ts` provides a small registry primitive that records each defeated unit once within a caller-defined combat scope.
- The dungeon runner creates one registry per dungeon level and shares it across all round contexts. A unit therefore triggers death processing at most once for the entire level, including deaths caused by chained passive effects.
- Normal hero/enemy attacks, enemy post-damage handling, damage-over-time, thorns, counterattacks, and passive damage paths now route defeat transitions through `processUnitDefeat`.
- The shared handler updates the dead condition, writes one death log entry, and dispatches the existing `on_death` passive effects with the available attacker context.
- This does not introduce resurrection behavior or change trap deactivation semantics. Trap units that are set to zero HP by the auto-win mechanic remain a separate encounter-state transition.

### Shared incoming damage resolution

- `core/combat/incoming-damage.ts` resolves the existing Wodos defensive reactions: dodge, block, barrier, and no configured reaction.
- The resolver is pure: it reports final damage, absorbed damage, dodge state, and MP expenditure without mutating a combat unit.
- Dodge requires an injected `RandomSource`; the current dungeon runner supplies its existing `Math.random` behavior through an adapter. This preserves runtime behavior while allowing deterministic engine tests and future seeded combat.
- The dungeon runner delegates its shared defense-reaction path to this resolver. Damage formulas, critical calculations, enemy hit rules, and attack selection are intentionally unchanged in this incremental extraction.


### Shared attack hit and critical resolution

- `core/combat/attack-resolution.ts` centralizes the hit threshold (attack total greater than or equal to defense) and Wodos' critical chance (5% + 0.5% per attacker DX, capped at 75%).
- Critical resolution accepts an injected `RandomSource` and supports explicitly forced critical attacks. Forced criticals do not consume a random value.
- The legacy `rollCrit` export remains available and delegates to the engine resolver through the existing runtime random source.
- The dungeon runner now uses the shared hit resolver for hero single-target attacks, hero/enemy area attacks, and enemy formula/fallback hit checks. Hero and enemy critical rolls use the shared critical resolver; automatic critical skills remain guaranteed.
- This phase deliberately does not merge hero and enemy damage formulas. In particular, the enemy no-formula fallback still rolls its legacy d10 attack bonus, and its damage calculation remains separate. Damage multipliers, armor penetration, resistances, defense dice and status-effect timing are unchanged.
