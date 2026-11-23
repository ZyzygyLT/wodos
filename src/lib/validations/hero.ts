import { z } from 'zod'

export const createAdminHeroSchema = z.object({
  name: z.string().min(1, 'Hero name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500).optional().nullable(),
  classId: z.number().int().positive('Class is required'),
  raceId: z.number().int().positive('Race is required'),
  attrs: z.record(z.string(), z.number().int()).optional().default({}),
})

export const updateAdminHeroSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  attrs: z.record(z.string(), z.number().int()).optional(),
})
