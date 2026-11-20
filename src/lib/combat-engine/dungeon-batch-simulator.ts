import { createSeededRandom } from '../../engine/core/random/random-source'
import {
  runDungeon,
  type DungeonData,
  type HeroData,
  type RunResult,
  type DetailedAction,
  type TargetResult,
} from './dungeon-runner'

export interface DungeonBatchOptions {
  iterations: number
  seed: number
  firstOfDay?: boolean
  groupBonus?: boolean
  clanBonuses?: Record<string, number>
}

export interface CombatantDamageMetric {
  id: string
  name: string
  side: 'heroes' | 'enemies'
  actions: number
  hits: number
  criticals: number
  damage: number
}

export interface SkillDamageMetric {
  skillId: number
  skillName: string
  actions: number
  hits: number
  criticals: number
  damage: number
}

export interface DungeonBatchRunMetric {
  seed: number
  victory: boolean
  levelsCleared: number
  totalRounds: number
  heroDamage: number
  enemyDamage: number
  deaths: number
}

export interface DungeonBatchResult {
  iterations: number
  wins: number
  losses: number
  winRate: number
  averageLevelsCleared: number
  averageRounds: number
  averageHeroDamage: number
  averageEnemyDamage: number
  averageDeaths: number
  criticals: number
  misses: number
  dodges: number
  totalDeaths: number
  damageByCombatant: CombatantDamageMetric[]
  damageBySkill: SkillDamageMetric[]
  runs: DungeonBatchRunMetric[]
}

function validateOptions(options: DungeonBatchOptions): void {
  if (!Number.isSafeInteger(options.iterations) || options.iterations < 1 || options.iterations > 10000) {
    throw new RangeError('iterations must be an integer between 1 and 10000')
  }
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer')
  }
}

function actionOutcomes(action: DetailedAction): Array<{
  resultType?: TargetResult['resultType']
  damage: number
  defenseEffect?: string
}> {
  if (action.targetResults?.length) {
    return action.targetResults.map(target => ({
      resultType: target.resultType,
      damage: (target.damageBreakdown ?? []).reduce((sum, part) => sum + part.value, 0),
      defenseEffect: target.defenseEffect,
    }))
  }

  return [{
    resultType: action.resultType,
    damage: (action.damageBreakdown ?? []).reduce((sum, part) => sum + part.value, 0),
    defenseEffect: action.defenseEffect,
  }]
}

function collectActions(result: RunResult): DetailedAction[] {
  return result.levelReports.flatMap(level =>
    level.rounds.flatMap(round => round.actions),
  )
}

function mean(total: number, count: number): number {
  return count === 0 ? 0 : total / count
}

/**
 * Runs independent dungeon simulations using consecutive unsigned 32-bit seeds.
 * The caller's hero and dungeon snapshots are never mutated by runDungeon.
 */
export async function simulateDungeonBatch(
  heroes: HeroData[],
  dungeon: DungeonData,
  options: DungeonBatchOptions,
): Promise<DungeonBatchResult> {
  validateOptions(options)

  const heroIds = new Set(heroes.map(hero => hero.id))
  const combatants = new Map<string, CombatantDamageMetric>()
  const skills = new Map<number, SkillDamageMetric>()
  const runs: DungeonBatchRunMetric[] = []

  let wins = 0
  let totalRounds = 0
  let totalLevelsCleared = 0
  let totalHeroDamage = 0
  let totalEnemyDamage = 0
  let totalDeaths = 0
  let criticals = 0
  let misses = 0
  let dodges = 0

  for (let index = 0; index < options.iterations; index += 1) {
    const seed = (options.seed + index) >>> 0
    const result = await runDungeon(heroes, dungeon, {
      firstOfDay: options.firstOfDay,
      groupBonus: options.groupBonus,
      clanBonuses: options.clanBonuses,
      random: createSeededRandom(seed),
    })

    const actions = collectActions(result)
    let runHeroDamage = 0
    let runEnemyDamage = 0

    for (const action of actions) {
      const side = heroIds.has(action.actorId) ? 'heroes' : 'enemies'
      const outcomes = actionOutcomes(action)
      const damage = outcomes.reduce((sum, outcome) => sum + outcome.damage, 0)
      const successful = outcomes.filter(outcome => outcome.resultType !== 'failed')
      const actionCriticals = outcomes.filter(outcome => outcome.resultType === 'critical_success').length

      if (side === 'heroes') runHeroDamage += damage
      else runEnemyDamage += damage

      let combatant = combatants.get(action.actorId)
      if (!combatant) {
        combatant = {
          id: action.actorId,
          name: action.actorName,
          side,
          actions: 0,
          hits: 0,
          criticals: 0,
          damage: 0,
        }
        combatants.set(action.actorId, combatant)
      }
      combatant.actions += 1
      combatant.hits += successful.length
      combatant.criticals += actionCriticals
      combatant.damage += damage

      let skill = skills.get(action.skillId)
      if (!skill) {
        skill = {
          skillId: action.skillId,
          skillName: action.skillName,
          actions: 0,
          hits: 0,
          criticals: 0,
          damage: 0,
        }
        skills.set(action.skillId, skill)
      }
      skill.actions += 1
      skill.hits += successful.length
      skill.criticals += actionCriticals
      skill.damage += damage

      criticals += actionCriticals
      misses += outcomes.filter(outcome => outcome.resultType === 'failed').length
      dodges += outcomes.filter(outcome => {
        const effect = (outcome.defenseEffect ?? '').toLowerCase()
        return effect.includes('dodge') || effect.includes('esquiv')
      }).length
    }

    const deaths = result.log.filter(entry => entry.type === 'death').length
    wins += result.victory ? 1 : 0
    totalRounds += result.totalRounds
    totalLevelsCleared += result.levelsCleared
    totalHeroDamage += runHeroDamage
    totalEnemyDamage += runEnemyDamage
    totalDeaths += deaths

    runs.push({
      seed,
      victory: result.victory,
      levelsCleared: result.levelsCleared,
      totalRounds: result.totalRounds,
      heroDamage: runHeroDamage,
      enemyDamage: runEnemyDamage,
      deaths,
    })

  }

  const count = options.iterations
  return {
    iterations: count,
    wins,
    losses: count - wins,
    winRate: wins / count,
    averageLevelsCleared: mean(totalLevelsCleared, count),
    averageRounds: mean(totalRounds, count),
    averageHeroDamage: mean(totalHeroDamage, count),
    averageEnemyDamage: mean(totalEnemyDamage, count),
    averageDeaths: mean(totalDeaths, count),
    criticals,
    misses,
    dodges,
    totalDeaths,
    damageByCombatant: [...combatants.values()].sort((a, b) => b.damage - a.damage),
    damageBySkill: [...skills.values()].sort((a, b) => b.damage - a.damage),
    runs,
  }
}

export interface DungeonBatchComparison {
  baseline: DungeonBatchResult
  candidate: DungeonBatchResult
  winRateDelta: number
  averageRoundsDelta: number
  averageHeroDamageDelta: number
  averageEnemyDamageDelta: number
  averageDeathsDelta: number
}

/** Runs both configurations with identical seed ranges for a fair comparison. */
export async function compareDungeonConfigurations(
  heroes: HeroData[],
  dungeon: DungeonData,
  baseline: DungeonBatchOptions,
  candidate: Omit<DungeonBatchOptions, 'iterations' | 'seed'>,
): Promise<DungeonBatchComparison> {
  const baselineResult = await simulateDungeonBatch(heroes, dungeon, baseline)
  const candidateResult = await simulateDungeonBatch(heroes, dungeon, {
    ...candidate,
    iterations: baseline.iterations,
    seed: baseline.seed,
  })

  return {
    baseline: baselineResult,
    candidate: candidateResult,
    winRateDelta: candidateResult.winRate - baselineResult.winRate,
    averageRoundsDelta: candidateResult.averageRounds - baselineResult.averageRounds,
    averageHeroDamageDelta: candidateResult.averageHeroDamage - baselineResult.averageHeroDamage,
    averageEnemyDamageDelta: candidateResult.averageEnemyDamage - baselineResult.averageEnemyDamage,
    averageDeathsDelta: candidateResult.averageDeaths - baselineResult.averageDeaths,
  }
}
