/** Injectable random source. Implementations must return values in [0, 1). */
export interface RandomSource {
  next(): number
}

export function nextRandom(random: RandomSource): number {
  const value = random.next()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('RandomSource.next() must return a finite number in [0, 1)')
  }
  return value
}

export function randomIntInclusive(random: RandomSource, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError('Expected integer bounds with max >= min')
  }
  return min + Math.floor(nextRandom(random) * (max - min + 1))
}

/** Small deterministic PRNG for reproducible simulations and tests. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return {
    next(): number {
      state = (state + 0x6D2B79F5) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  }
}
