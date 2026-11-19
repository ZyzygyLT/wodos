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

1. Integrate the current dynamic attribute definitions through an adapter.
2. Extract equipment and effect aggregation into a pure stat pipeline.
3. Inject randomness into combat formulas without changing default outcomes.
4. Extract requirements, domain events, progression, inventory, quests, and AI in separate increments.
