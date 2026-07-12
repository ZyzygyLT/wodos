import db from '@/lib/db'
import type { AttributeDefinition } from '@/generated/prisma'
import type { CreateAttributeInput, UpdateAttributeInput } from '@/lib/models/attribute'

export async function findAllAttributes(includeArchived = false): Promise<AttributeDefinition[]> {
  const where = includeArchived ? {} : { archivedAt: null }
  return db.attributeDefinition.findMany({ where, orderBy: { name: 'asc' } })
}

export async function findAttributeById(id: string): Promise<AttributeDefinition | null> {
  return db.attributeDefinition.findUnique({ where: { id } })
}

export async function createAttribute(data: CreateAttributeInput): Promise<AttributeDefinition> {
  return db.attributeDefinition.create({
    data: {
      name: data.name,
      abbreviation: data.abbreviation,
      description: data.description ?? null,
      minValue: data.minValue ?? 1,
      maxValue: data.maxValue ?? 100,
    },
  })
}

export async function updateAttribute(id: string, data: UpdateAttributeInput): Promise<AttributeDefinition> {
  return db.attributeDefinition.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.abbreviation !== undefined && { abbreviation: data.abbreviation }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.minValue !== undefined && { minValue: data.minValue }),
      ...(data.maxValue !== undefined && { maxValue: data.maxValue }),
    },
  })
}

export async function archiveAttribute(id: string): Promise<AttributeDefinition> {
  return db.attributeDefinition.update({
    where: { id },
    data: { archivedAt: new Date() },
  })
}

export async function reactivateAttribute(id: string): Promise<AttributeDefinition> {
  return db.attributeDefinition.update({
    where: { id },
    data: { archivedAt: null },
  })
}
