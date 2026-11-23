import { z } from 'zod'

export const createAttributeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  abbreviation: z.string().min(1, 'Abbreviation is required').max(10, 'Abbreviation must be at most 10 characters'),
  description: z.string().max(300, 'Description must be at most 300 characters').optional().nullable(),
  minValue: z.number().int().min(0).default(1),
  maxValue: z.number().int().min(1).default(100),
}).refine(data => data.maxValue > data.minValue, {
  message: 'maxValue must be greater than minValue',
  path: ['maxValue'],
})

export const updateAttributeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  abbreviation: z.string().min(1).max(10).optional(),
  description: z.string().max(300).optional().nullable(),
  minValue: z.number().int().min(0).optional(),
  maxValue: z.number().int().min(1).optional(),
})

export const attributeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
  description: z.string().nullable(),
  minValue: z.number(),
  maxValue: z.number(),
  archivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/).nullable(),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
})
