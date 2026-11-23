import { createSeededRandom } from '@/engine/core/random/random-source'
import {
  runDungeon,
  type DungeonData,
  type HeroData,
  type RunResult,
} from './dungeon-runner'

export const DUNGEON_REPLAY_SCHEMA_VERSION = 1 as const

export interface DungeonReplayOptions {
  firstOfDay?: boolean
  groupBonus?: boolean
  clanBonuses?: Record<string, number>
}

/**
 * Portable, JSON-serializable input required to replay a dungeon run.
 * Keep this record with the game/version metadata used by the caller.
 */
export interface DungeonReplayRecord {
  schemaVersion: typeof DUNGEON_REPLAY_SCHEMA_VERSION
  seed: number
  heroes: HeroData[]
  dungeon: DungeonData
  options: DungeonReplayOptions
}

export interface ReplayDifference {
  path: string
  expected: unknown
  actual: unknown
}

export interface ReplayComparison {
  matches: boolean
  difference: ReplayDifference | null
}

function cloneJsonData<T>(value: T): T {
  return structuredClone(value)
}

export function createDungeonReplayRecord(input: {
  seed: number
  heroes: HeroData[]
  dungeon: DungeonData
  options?: DungeonReplayOptions
}): DungeonReplayRecord {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) {
    throw new RangeError('Replay seed must be an unsigned 32-bit integer')
  }

  return {
    schemaVersion: DUNGEON_REPLAY_SCHEMA_VERSION,
    seed: input.seed,
    heroes: cloneJsonData(input.heroes),
    dungeon: cloneJsonData(input.dungeon),
    options: cloneJsonData(input.options ?? {}),
  }
}

export async function runDungeonReplay(record: DungeonReplayRecord): Promise<RunResult> {
  if (record.schemaVersion !== DUNGEON_REPLAY_SCHEMA_VERSION) {
    throw new Error(`Unsupported dungeon replay schema version: ${record.schemaVersion}`)
  }
  if (!Number.isSafeInteger(record.seed) || record.seed < 0 || record.seed > 0xffffffff) {
    throw new RangeError('Replay seed must be an unsigned 32-bit integer')
  }

  return runDungeon(
    cloneJsonData(record.heroes),
    cloneJsonData(record.dungeon),
    {
      ...cloneJsonData(record.options),
      random: createSeededRandom(record.seed),
    },
  )
}

function normalizeResult(result: RunResult): Omit<RunResult, 'log'> & {
  log: Array<Omit<RunResult['log'][number], 'timestamp'>>
} {
  return {
    ...result,
    // Wall-clock timestamps are metadata, not simulation outcomes.
    log: result.log.map(({ timestamp: _timestamp, ...entry }) => entry),
  }
}

function firstDifference(expected: unknown, actual: unknown, path: string): ReplayDifference | null {
  if (Object.is(expected, actual)) return null

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return { path: `${path}.length`, expected: expected.length, actual: actual.length }
    }
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`)
      if (difference) return difference
    }
    return null
  }

  if (
    expected !== null && actual !== null &&
    typeof expected === 'object' && typeof actual === 'object' &&
    !Array.isArray(expected) && !Array.isArray(actual)
  ) {
    const expectedObject = expected as Record<string, unknown>
    const actualObject = actual as Record<string, unknown>
    const keys = [...new Set([...Object.keys(expectedObject), ...Object.keys(actualObject)])].sort()
    for (const key of keys) {
      if (!(key in expectedObject) || !(key in actualObject)) {
        return {
          path: `${path}.${key}`,
          expected: expectedObject[key],
          actual: actualObject[key],
        }
      }
      const difference = firstDifference(expectedObject[key], actualObject[key], `${path}.${key}`)
      if (difference) return difference
    }
    return null
  }

  return { path, expected, actual }
}

/** Compare gameplay output while ignoring non-deterministic log timestamps. */
export function compareDungeonReplayResults(expected: RunResult, actual: RunResult): ReplayComparison {
  const difference = firstDifference(normalizeResult(expected), normalizeResult(actual), '$')
  return { matches: difference === null, difference }
}
