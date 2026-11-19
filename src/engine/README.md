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
- Effects describe state; the combat/application layer owns ticking and stacking policy execution.
- Randomness is injected. Seeded randomness is for repeatable simulations, tests, and replay tooling; production callers may provide a secure or runtime-specific source.

## Next milestones

1. Connect the adapters to existing read services while keeping persistence outside the engine.
2. Compare legacy and engine-derived equipment/stat totals on representative heroes.
3. Introduce effect aggregation and explicit stacking/expiration policies.
4. Inject randomness into combat formulas without changing default outcomes.
5. Extract requirements, domain events, progression, inventory, quests, and AI in separate increments.

## Prisma adapters (compatibility boundary)

The engine must not import generated Prisma types or query the database. The first adapters live in `adapters/prisma` and accept small structural data contracts:

- `toEngineAttributeDefinition` maps persisted `AttributeDefinition` records to the configurable engine catalogue. The current schema has no default-value column, so the adapter uses `minValue` as the compatibility default; callers may provide an explicit default resolver.
- `toActiveEngineAttributes` excludes archived records before building the active catalogue.
- `itemStatsToModifiers` converts finite numeric item stats into flat modifiers. Healing keys (`healHp`, `healMp`) are excluded by default because they are consumable effects, not persistent character stats.

These adapters are deliberately one-way and do not change current Prisma models or combat calculations. The next migration should compare old and new stat totals on representative heroes before routing production combat through the engine.

## Validation status

Unit tests are added for core contracts and adapter mapping. They must be run in the repository environment with `npm test -- --run src/__tests__/engine-core.test.ts src/__tests__/engine-adapters.test.ts` and `npx tsc --noEmit` before treating the migration as verified.


## Pure stat pipeline

`core/stats/stat-pipeline.ts` composes base stats, explicit modifiers (for example equipped items), and modifiers from non-expired effects targeting the requested entity. It returns final values plus a per-stat breakdown and the IDs of applied/expired effects. The pipeline intentionally does not decide effect stacking, duration ticking, caps, or rounding: those are game/domain policies and must be supplied by the calling service. No Prisma or application imports are allowed in this module.


## First hero integration seam

`adapters/prisma/hero-stat-adapter.ts` provides a compatibility entry point for already-loaded hero read models: it takes base stats, equipped `HeroItem` rows and optional engine effects, then delegates to the generic pipeline. It does not query Prisma and does not replace `computeDefenseForHero`.

Scope limitation: this first adapter currently reads only `item.stats` from equipped rows. It intentionally does not interpret `statOverrides`, rune slots, `upgradeLevel`, class/race requirements, or combat-profile formulas. Those rules must be mapped explicitly and tested against current Wodos behavior before any production cutover.
