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
- Randomness is injected through `RandomSource`. `nextRandom` enforces the contract at runtime (finite values in `[0, 1)`), and `randomIntInclusive` centralizes inclusive integer rolls. Seeded randomness is for repeatable simulations, tests, and replay tooling; production callers may provide a runtime-specific source.

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

## Reproducible dungeon simulations

- `runDungeon` accepts an optional `RandomSource`. Pass a fresh generator initialized with the same seed to reproduce combat decisions, initiative, defense rolls, critical checks, random targeting and loot assignment.
- The runner clones the mutable hero and dungeon read models before applying clan bonuses, scaling enemies, and consuming preliminary items. Nested combat rules, skill formulas, equipment stats, consumables, enemy skills, passive definitions and loot entries are copied so simulation work does not mutate caller-owned input objects.
- Log timestamps are generated from wall-clock time and are intentionally not deterministic. Replay comparisons should normalize or omit `LogEntry.timestamp`; compare the remaining log fields, round reports, action outcomes, final HP/MP and loot.
- When no random source is supplied, legacy runtime randomness remains the default. Deterministic replay therefore requires callers to explicitly provide a seeded source.

## Replay records and divergence diagnostics

The app-layer replay helper lives in `src/lib/combat-engine/dungeon-replay.ts`:

- `createDungeonReplayRecord` captures the hero and dungeon read models, supported run options and an unsigned 32-bit seed in a JSON-serializable, versioned record.
- `runDungeonReplay` restores the simulation using a fresh seeded random source. A stored record can be serialized as JSON and replayed later.
- `compareDungeonReplayResults` compares gameplay output while excluding log timestamps, and reports the first differing field path with its expected and actual values.
- Replay schema versioning protects the record format. Callers should also retain the application/game build identifier alongside the record: schema compatibility alone cannot guarantee identical behavior after gameplay code or balance changes.
- Replay records contain the full supplied hero and dungeon snapshots. Store them with the same access controls and retention rules as other player/game state.

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

### HP damage and healing event integration

- The dungeon runner now emits `on_damage` from the shared HP mutation boundary with the actual HP removed (after mitigation, barriers, and the zero-HP floor), plus stable source and target IDs.
- Damage observers receive events for hero/enemy single-target attacks, area targets, reflected damage, counterattacks, periodic status damage, and passive damage to one or multiple units. A damage event is emitted only when HP was actually reduced.
- The runner emits `healing_applied` for combat HP healing from hero/enemy healing actions, consumable healing during combat, vampirism, passive healing, and the darkness-faction regeneration effect. The payload reports the effective amount after the max-HP cap; no event is emitted when HP does not change.
- Legacy `on_damage` passive execution remains a separate compatibility dispatch, so moving observer notifications to the HP mutation boundary does not execute legacy passive commands twice. The existing legacy passive trigger still runs at its original hero single-target attack call site; extending legacy passive gameplay semantics to every damage source remains a separate balance/compatibility decision.
- Periodic status damage currently uses a synthetic source ID (`status:<targetId>`) because the persisted legacy status shape retains a source name, not a stable source entity ID. Preliminary/pre-combat healing is outside the dungeon combat dispatcher. MP regeneration is not an HP healing event.
- Event IDs share the dungeon-level monotonic sequence used by round/death events. Handlers are synchronous observers and should remain lightweight and avoid mutating combat units.

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

### Passive event execution planning

- `core/combat/passive-execution.ts` converts a resolved legacy passive command into a pure execution plan containing stable target unit IDs.
- Target mapping is centralized for self, triggering attacker, all heroes, and all enemies. The planner does not mutate units or decide whether defeated units receive a particular effect; legacy handlers retain those effect-specific rules.
- The dungeon runner now creates this plan before dispatching each passive command. It continues to use the existing damage/heal/buff handlers for gameplay side effects and reporting, preserving combat behavior while moving target resolution into the engine.
- Current supported passive triggers remain the Wodos catalogue's `on_damage`, `on_death`, and `on_round_start`. This phase does not invent new triggers or change their timing.

### Shared effect lifecycle and legacy combat adapters

- Legacy status application and group-buff application now pass through the engine's `applyEffect` lifecycle policy before being translated back to Wodos combat records.
- The adapters deliberately retain Wodos-specific merge rules: statuses keep the strongest value and longest duration while preserving their original source; buffs retain source/type/side identity and the existing stronger-value/longer-duration behavior, including the permanent-to-finite refresh edge case.
- Duration advancement for statuses and buffs continues to use `advanceEffects`. Poison/burn/bleed ticks, stun/freeze turn suppression, strongest group-buff selection, and actual combat side effects remain in the legacy combat application.
- This is a compatibility-boundary integration, not a claim that all combat statuses, passive effects, and skill side effects have become generic engine effects. Passive triggers still resolve to commands through the dedicated adapter and are executed by the combat runner.

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


### Damage resolution strategies

- `core/combat/damage-resolution.ts` contains two explicit pure strategies and returns a structured breakdown: raw damage, effective defense, damage after defense, resistance percentage and final damage.
- `resolveFormulaDamage` preserves the formula-based Wodos order: group attack bonus, optional armor-penetration defense reduction, defense subtraction, then damage-type resistance. It retains the legacy minimum of 1 damage.
- `resolveEnemyFallbackDamage` preserves the distinct enemy-without-formula path: enemy attack × skill multiplier × critical multiplier, defense adjusted by group defense bonus, then resistance. It also retains the minimum of 1 damage.
- The legacy `calcActualDamage` API delegates to the formula strategy. Enemy fallback attacks delegate to the fallback strategy. Formula-backed enemy attacks continue through `calcActualDamage`.
- This extraction does not normalize resistance values, cap resistance, combine the two strategies, or change status-effect application. Those behaviors require separate characterization before any redesign.


### Reproducible combat randomness

- Combat formulas accept an optional `RandomSource` for skill dice, critical rolls, and initiative. Existing callers that omit it retain `Math.random()` behavior.
- The tactics layer accepts the same source for random target selection and turn-queue initiative.
- `runDungeon` accepts `options.random`; pass a seeded source such as `createSeededRandom(seed)` to make combat, enemy targeting, defensive reactions, critical side effects, loot rolls, and loot assignment reproducible. Random values are validated as finite numbers in `[0, 1)` before use, and integer dice/selection rolls share the inclusive helper.
- A random source is stateful: create a fresh seeded instance for each independent run. Reusing the same instance intentionally continues its sequence.
- `runDungeon` clones the hero attribute maps and dungeon level/enemy containers before applying clan bonuses or party scaling, so these simulation preparations do not mutate the caller's input objects. Loot assignment receives the same run-scoped random source explicitly.
- The default runtime path remains non-seeded. This extraction does not change probability thresholds, dice ranges, initiative rules, or loot chances.
- Log timestamps still use wall-clock time and are not part of the deterministic gameplay stream.


## Batch combat simulation and balance analysis

The application-layer helper `src/lib/combat-engine/dungeon-batch-simulator.ts` runs repeatable batches through the same `runDungeon` production simulation path:

- `simulateDungeonBatch(heroes, dungeon, options)` accepts 1–10,000 iterations and an unsigned 32-bit starting seed. Each run receives a fresh seeded generator and the next consecutive uint32 seed (wrapping at the uint32 boundary).
- Results include wins/losses, win rate, average levels cleared and rounds, average damage by side, average and total deaths, and per-combatant/per-skill action, hit, critical and damage aggregates.
- Attack, miss, critical and dodge rates are computed from attack outcomes only. Healing/support actions are excluded from the attack denominator. AOE outcomes are counted per target.
- `compareDungeonConfigurations` runs a baseline and candidate with the same iteration count and seed range, returning absolute deltas for win rate, rounds, damage and deaths. Keep the party, dungeon and seed range fixed when comparing balance changes.
- Batches run sequentially to keep execution predictable and avoid introducing concurrency effects into the simulation runner. The helper does not persist results or export files; callers can serialize the returned JSON.
- This is an observational tool, not an optimizer. It does not change gameplay values, infer class strength from a single sample, or guarantee statistical significance. Use larger batches and multiple seed ranges for consequential balance decisions.

Damage totals are derived from the damage breakdowns exposed by action reports. The simulator reports only what the current runner exposes; it does not reconstruct hidden damage, attribute damage to individual equipment pieces, or infer class identity. Death totals use the runner's `death` log events.


## Neutral skill contracts and formula evaluation

`core/skills/skill-definition.ts` introduces application-independent contracts for normalized skill definitions and formulas:

- `SkillDefinition` captures identity, display name, effect/timing identifiers, mana cost, multiplier, optional cooldown, prerequisite skill IDs, tags and optional formula.
- `SkillFormulaDefinition` captures attribute coefficients, rank coefficient, dice configuration, flat bonus and optional string-based damage/healing metadata. It does not import Wodos enums or Prisma types.
- `validateSkillDefinition` and `validateSkillFormula` return structured validation results rather than throwing for ordinary invalid catalogue data.
- `evaluateSkillFormula` and `applySkillDiceMultiplier` own the existing Wodos attribute/rank/dice calculations as pure engine operations. Random dice remain injectable through `RandomSource`.
- `src/lib/combat-engine/formulas.ts` retains its existing public `SkillFormula`, `evaluateFormula` and `applyDiceMultiplier` compatibility surface, delegating evaluation to the engine module. Existing callers therefore do not need to migrate at once.

This is the first skill-domain extraction, not yet a full skill executor. Skill ownership/unlock rules, status application and action reporting still belong to the existing application combat flow. MP cost/fallback decisions and cooldown lookup are extracted separately below; the runner still applies those decisions to mutable combat state. Remaining execution concerns must be migrated in separate characterized steps so the current combat sequence and balance remain unchanged.


## Skill availability and resource rules

`core/skills/skill-availability.ts` extracts pure rules used by the current combat runner:

- `calculateSkillManaCost` preserves Wodos' existing +20% of base mana per rank above rank 1.
- `resolveSkillMana` returns the selected skill, actual MP cost, resulting MP and any low-mana fallback without mutating the combat unit. It preserves the current preference for a free basic attack, then a non-free basic attack without further MP deduction, and finally the legacy forced-skill fallback that depletes MP.
- `isSkillOnCooldown` and `getSkillCooldownRemaining` centralize cooldown lookup; `normalizeSkillCooldown` treats absent, non-finite and non-positive durations as no cooldown.
- The dungeon runner delegates hero MP resolution and hero/enemy cooldown checks to these contracts. It still owns logs, state mutation, tactic overrides and the round-by-round cooldown clock.

This phase does not yet validate skill ownership or `requiresSkills`: the runner receives a pre-filtered hero skill list and does not currently carry the complete persisted skill catalogue/prerequisite state. It also does not change target selection or action resolution.


## Pure combat target selection

`core/skills/target-selection.ts` owns the target-picking rules without depending on the Wodos combat runner:

- `TargetableUnit` and `TargetSelectionInput` describe the minimum data needed for targeting; no Prisma or app types are imported.
- `selectCombatTarget` returns the selected unit, the candidate pool and a reason (`trap_priority`, `exact_position`, `position_priority`, `most_injured_ally`, fallback or no valid target).
- Living enemies are considered, traps retain their current priority, explicit positions fall back to all living enemies when empty, and automatic positions use the existing melee/ranged priority table.
- Weakest, strongest, random and most-injured-ally selection are deterministic when a `RandomSource` is supplied. Random selection requires an injected source in the pure contract.
- `getTargetPositionPriority` centralizes the positional priority table. The legacy export in `tactics-evaluator.ts` remains as a compatibility wrapper.
- `resolveTarget` in `tactics-evaluator.ts` now delegates to the engine contract and retains its existing public signature and default runtime randomness.

Compatibility note: the legacy `self` target type previously fell through to weakest-enemy selection in `resolveTarget`; this extraction deliberately preserves that behavior rather than silently changing existing tactic data. The engine contract exposes the candidate pool and resolution reason for later validation/UI diagnostics. It does not yet define AOE target groups or skill-specific ally/enemy target permissions.


## Centralized skill execution planning

- `core/skills/skill-execution.ts` resolves a hero skill into a neutral action plan: single-target attack, area attack, healing, or party buff.
- The planner centralizes target choice for single-target actions, the living target set for area attacks, the most-injured living ally for healing, and the legacy rank/multiplier arithmetic for party buffs.
- It returns data only. It does not mutate HP/MP, apply buffs or status effects, consume cooldowns, write logs, or process defeat/passive triggers.
- The dungeon runner now uses this plan to route hero skill actions into its existing damage, healing, buff and reporting handlers. Mana resolution remains in the existing availability contract and occurs before planning.
- The planner accepts an injected `RandomSource` for random target selection. No gameplay formulas, attack resolution, cooldown timing, or effect durations are changed by this extraction.
- Enemy skill execution and the full end-to-end lifecycle (ownership/prerequisites, cooldown assignment, and unified effect application) remain separate follow-up work.


## Enemy skill execution and shared cooldown lifecycle

- Enemy skills now use the same `resolveSkillExecution` planner as hero skills. The enemy is supplied as the actor, other living enemies as allies, and living heroes as opposing targets.
- Enemy self-healing is represented explicitly with `healTarget: 'self'`; hero healing continues to select the most-injured living party member.
- Enemy single-target selection now uses the shared target-selection contract. Explicit weakest/strongest AI preferences search the full opposing team without hero-style positional priority; the default enemy AI preserves its legacy 40% weakest preference and 70/30 front/rear weighting through an injectable random source. Area attacks receive the living opposing units from the planner.
- Enemy damage, criticals, defense, shields, thorns, counters, defeat processing, logs and reward-related side effects remain in the legacy combat handlers.
- Enemy attack formulas are evaluated before target selection, preserving the established random-consumption order. The previous enemy target heuristic has been moved into the shared selector without changing its decision probabilities or random-call sequence.
- Enemy attack and defense group buffs use the common buff plan. The enemy buff percentage keeps the legacy multiplier calculation (without hero skill-rank scaling).
- `setSkillCooldown` and `advanceSkillCooldowns` now own immutable cooldown assignment and round advancement for both heroes and enemies. The dungeon runner remains the state adapter.
- Formula-less area skills retain the legacy single-target fallback. Enemy healing remains self-only; no new ally-healing behavior is introduced.
- Tests cover enemy-perspective targeting, self-only healing, AOE filtering, seeded target choice, and immutable cooldown lifecycle. Execution remains unverified until tests and TypeScript checks can be run.


## Skill prerequisites and shared legacy effect lifecycle

- `core/skills/skill-requirements.ts` evaluates direct `requiresSkills` prerequisites against an entity's unlocked skill IDs without querying persistence or mutating state.
- `validateSkillPrerequisiteGraph` validates catalogue-wide prerequisite references, duplicate skill IDs, repeated prerequisite IDs, self-dependencies and cycles. `validateSkillDefinition` also rejects duplicate and self-referential prerequisite IDs.
- The Prisma `Skill.requiresSkills` field already matches this contract; no schema migration is required. The evaluator is intended for skill-unlock/progression services. Dungeon combat receives the hero's already-unlocked skill list, so this phase deliberately does not add a second runtime lock check to every combat action.
- Legacy status and group-buff adapters now convert their current entries to `GameEffect`, advance finite durations with `advanceEffects`, and map the remaining effects back to the existing combat read models.
- Legacy status application still preserves Wodos' one-per-type, max-value/max-duration/source-retention rule. Legacy buff application still preserves its source/type/side identity and max-value/max-duration rule. These are not replaced by generic `applyEffect` stacking policies because those policies are not semantically identical.
- The shared lifecycle owns duration decrement and expiry; combat adapters continue to own legacy application semantics, damage ticks, crowd-control behavior, buff aggregation, logs and combat timing.
- Tests cover prerequisite evaluation and graph validation, plus status/buff duration advancement, expiry, permanence, metadata preservation and immutability. Test execution and TypeScript validation remain pending.


## Combat event dispatch

`core/events/combat-events.ts` defines the engine event vocabulary for attack start/resolution, damage, healing, defeat, and round start. Existing Wodos passive triggers remain explicitly limited to `on_damage`, `on_death`, and `on_round_start`; adding event types does not silently activate new passive catalogue behavior.

- `CombatEventDispatcher` invokes matching handlers synchronously in registration order and queues nested events FIFO, avoiding recursive handler stacks.
- Explicit event IDs provide opt-in at-most-once dispatch within one dispatcher instance. Events without IDs are never deduplicated, because two identical damage events may be legitimate separate hits.
- A configurable per-drain event limit stops runaway reactive chains. If a handler throws, pending events are discarded and the error propagates to the caller.
- The one-shot `dispatchCombatEvent` helper remains available for compatibility. The current dungeon runner routes each existing passive trigger through `CombatEventDispatcher`; it still creates a local dispatcher per trigger because passive execution is synchronous and does not yet emit chained engine events. Stateful combat flows should retain one dispatcher instance across the desired combat/round lifecycle when they need cross-event deduplication and nested-event control.
- The event layer is an orchestration contract only. It does not apply damage/healing, mutate units, determine defeat, or decide when the runner emits events. Those call sites remain incremental migration work.

### Dungeon runner event integration

`runDungeon` accepts optional `combatEventHandlers`. One dispatcher is created for the entire dungeon run and shared by round, hero-action, and enemy-action contexts. Handlers therefore observe the existing `on_round_start`, `on_damage`, and `on_death` lifecycle notifications across the run. The current `on_damage` emission remains limited to the legacy hero single-target attack path; defeat notifications cover the centralized defeat transition. Each emitted notification receives a run-local, monotonically increasing event ID scoped with level and round, so accidental duplicate dispatches can be suppressed without conflating separate hits.

The runner keeps the legacy passive executor separate from observer handlers: existing passive effects still execute through their compatibility adapter and retain their prior order/semantics. Event observers are synchronous and should be lightweight; they must not mutate combat units if deterministic gameplay results are expected. Attack start/resolution and healing event types are defined in the core vocabulary but are not yet emitted by all runner paths. They remain a subsequent integration step rather than implying coverage that does not exist yet.
