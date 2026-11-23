import { describe, expect, it } from 'vitest'
import { splitIntegerReward } from '@/lib/reward-distribution'

describe('integer reward distribution', () => {
  it('distributes the full reward without creating or losing units', () => {
    const shares = splitIntegerReward(5, 3)

    expect(shares).toEqual([2, 2, 1])
    expect(shares.reduce((total, share) => total + share, 0)).toBe(5)
  })

  it('supports rewards smaller than the recipient count', () => {
    expect(splitIntegerReward(2, 4)).toEqual([1, 1, 0, 0])
  })

  it('rejects invalid totals and recipient counts', () => {
    expect(() => splitIntegerReward(-1, 2)).toThrow(RangeError)
    expect(() => splitIntegerReward(1.5, 2)).toThrow(RangeError)
    expect(() => splitIntegerReward(1, 0)).toThrow(RangeError)
  })
})
