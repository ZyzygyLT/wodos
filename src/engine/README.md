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

`core/stats/stat-pipeline.ts` composes base stats, explicit modifiers (for example equipped items), and modifiers from non-expired effects targeting the requested entity. It returns final values plus a per-stat breakdown and the IDs of applied/expired effects. The pipeline intentionally does not decide effect stacking, duration ticking, caps, or rounding: those are game/domain policies and must be supplied by the calling service. No Prisma or application imports are allowed in this module.

## First hero integration seam

`adapters/prisma/hero-stat-adapter.ts` provides a compatibility entry point for already-loaded hero read models: it takes base stats, `HeroItem` rows and optional engine effects, then delegates to the generic pipeline. It does not query Prisma. The dungeon/arena preparation path uses it for equipment totals; `computeDefenseForHero` remains a separate legacy path.

## Validation status

Unit tests are added for core contracts and adapter mapping. Run the repository test suite and `npx tsc --noEmit` before treating the migration as verified.
