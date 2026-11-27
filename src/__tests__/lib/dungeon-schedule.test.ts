import { describe, expect, it } from 'vitest'
import { DUNGEON_SCHEDULE_TIMES, hasScheduledTimePassed } from '@/lib/dungeon-schedule'

describe('hasScheduledTimePassed', () => {
  it('recognizes a slot that passed today after registration', () => {
    expect(hasScheduledTimePassed(
      ['19:00'],
      new Date('2026-11-27T18:00:00.000Z'),
      0,
      new Date('2026-11-27T20:00:00.000Z'),
    )).toBe(true)
  })

  it('does not treat a later slot today as already passed', () => {
    expect(hasScheduledTimePassed(
      ['19:00'],
      new Date('2026-11-27T09:00:00.000Z'),
      0,
      new Date('2026-11-27T10:00:00.000Z'),
    )).toBe(false)
  })

  it('recovers a run registered several days before the cron resumes', () => {
    expect(hasScheduledTimePassed(
      ['19:00'],
      new Date('2026-11-23T18:00:00.000Z'),
      0,
      new Date('2026-11-27T20:00:00.000Z'),
    )).toBe(true)
  })

  it('uses the latest previous occurrence when today’s slot is still ahead', () => {
    expect(hasScheduledTimePassed(
      ['19:00'],
      new Date('2026-11-24T18:00:00.000Z'),
      0,
      new Date('2026-11-27T10:00:00.000Z'),
    )).toBe(true)
  })

  it('keeps the fixed four-hour departure slots regardless of clan timer bonuses', () => {
    expect(DUNGEON_SCHEDULE_TIMES).toEqual(['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'])
    expect(hasScheduledTimePassed(
      DUNGEON_SCHEDULE_TIMES,
      new Date('2026-11-27T10:01:00.000Z'),
      new Date('2026-11-27T14:00:00.000Z'),
    )).toBe(true)
  })

  it('does not execute a slot that occurred before registration', () => {
    expect(hasScheduledTimePassed(
      ['19:00'],
      new Date('2026-11-27T19:30:00.000Z'),
      0,
      new Date('2026-11-27T20:00:00.000Z'),
    )).toBe(false)
  })
})
