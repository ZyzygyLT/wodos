import { describe, it, expect } from 'vitest'

const { totalEpForLevel } = await import('@/lib/level-up')

describe('totalEpForLevel', () => {
  it('level 1 requires 0 EP', () => {
    expect(totalEpForLevel(1)).toBe(0)
  })

  it('level 2 requires 200 EP', () => {
    expect(totalEpForLevel(2)).toBe(200)
  })

  it('level 3 requires 200 + 320 = 520 EP', () => {
    expect(totalEpForLevel(3)).toBe(200 + 320)
  })

  it('level 4 requires 200 + 320 + 512 = 1032 EP', () => {
    expect(totalEpForLevel(4)).toBe(200 + 320 + 512)
  })

  it('is monotonically increasing', () => {
    for (let i = 1; i < 50; i++) {
      expect(totalEpForLevel(i + 1)).toBeGreaterThan(totalEpForLevel(i))
    }
  })
})
