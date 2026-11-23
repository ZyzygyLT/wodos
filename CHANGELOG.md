# Changelog

## v1.0.0 — 2026-07-07

### Code Quality
- **S3358**: Eliminados 12 ternarios anidados (ActionCard, DungeonMap, SkillTree, dungeon-runner)
- **S107**: Reducidos parámetros en 17 funciones usando `CombatCtx`, `DetailOptions`, `ActionMeta`
- **S3776**: Reducida complejidad cognitiva en 31 funciones mediante extracción de helpers
- **S6853**: 71 labels de accesibilidad corregidos
- **S1874**: 22 deprecaciones corregidas
- **S7748**: Literales numéricos normalizados
- **S4325**: 16 type assertions innecesarias eliminadas
- **S1128/S1854/S2681/S1871/S6571**: 17 issues varios corregidos

### Infraestructura
- Pipeline CI/CD con GitHub Actions (lint, tsc, test, SonarQube)
