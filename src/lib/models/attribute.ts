import type { AttributeDefinition } from '@/generated/prisma'

export interface CreateAttributeInput {
  name: string
  abbreviation: string
  description?: string | null
  minValue?: number
  maxValue?: number
}

export interface UpdateAttributeInput {
  name?: string
  abbreviation?: string
  description?: string | null
  minValue?: number
  maxValue?: number
}

export function validateAttributeDefinition(input: CreateAttributeInput): string[] {
  const errors: string[] = []
  if (!input.name || input.name.trim().length === 0) errors.push('Name is required')
  if (input.name && input.name.length > 50) errors.push('Name must be at most 50 characters')
  if (!input.abbreviation || input.abbreviation.trim().length === 0) errors.push('Abbreviation is required')
  if (input.abbreviation && input.abbreviation.length > 10) errors.push('Abbreviation must be at most 10 characters')
  const min = input.minValue ?? 1
  const max = input.maxValue ?? 100
  if (max <= min) errors.push('maxValue must be greater than minValue')
  return errors
}

export function isArchived(attr: AttributeDefinition): boolean {
  return attr.archivedAt !== null
}

export function filterActive(attrs: AttributeDefinition[]): AttributeDefinition[] {
  return attrs.filter(a => !isArchived(a))
}
