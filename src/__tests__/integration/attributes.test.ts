import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {
  attributeDefinition: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ default: mockDb }))

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'admin-1', isAdmin: true } })),
}))

const { findAllAttributes, findAttributeById, createAttribute, updateAttribute, archiveAttribute, reactivateAttribute } = await import('@/services/attribute-service')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Attribute CRUD (integration)', () => {
  const now = new Date()
  const mockAttr = {
    id: 'attr-1',
    name: 'Strength',
    abbreviation: 'st',
    description: 'Physical power',
    minValue: 1,
    maxValue: 100,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  it('lists active attributes by default', async () => {
    mockDb.attributeDefinition.findMany.mockResolvedValue([mockAttr])
    const attrs = await findAllAttributes()
    expect(attrs).toHaveLength(1)
    expect(attrs[0].name).toBe('Strength')
    expect(mockDb.attributeDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null } }))
  })

  it('includes archived attributes when requested', async () => {
    mockDb.attributeDefinition.findMany.mockResolvedValue([mockAttr])
    await findAllAttributes(true)
    expect(mockDb.attributeDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('finds attribute by ID', async () => {
    mockDb.attributeDefinition.findUnique.mockResolvedValue(mockAttr)
    const attr = await findAttributeById('attr-1')
    expect(attr).not.toBeNull()
    expect(attr!.name).toBe('Strength')
    expect(attr!.abbreviation).toBe('st')
  })

  it('returns null for non-existent attribute', async () => {
    mockDb.attributeDefinition.findUnique.mockResolvedValue(null)
    const attr = await findAttributeById('nonexistent')
    expect(attr).toBeNull()
  })

  it('creates a new attribute', async () => {
    mockDb.attributeDefinition.create.mockResolvedValue(mockAttr)
    const attr = await createAttribute({ name: 'Strength', abbreviation: 'st', description: 'Physical power', minValue: 1, maxValue: 100 })
    expect(attr.name).toBe('Strength')
    expect(mockDb.attributeDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Strength', abbreviation: 'st' }),
    }))
  })

  it('creates attribute with default min/max values', async () => {
    mockDb.attributeDefinition.create.mockResolvedValue(mockAttr)
    await createAttribute({ name: 'Agility', abbreviation: 'ag' })
    expect(mockDb.attributeDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ minValue: 1, maxValue: 100 }),
    }))
  })

  it('updates an attribute', async () => {
    const updated = { ...mockAttr, name: 'Might', description: 'Raw force' }
    mockDb.attributeDefinition.update.mockResolvedValue(updated)
    const attr = await updateAttribute('attr-1', { name: 'Might', description: 'Raw force' })
    expect(attr.name).toBe('Might')
    expect(attr.description).toBe('Raw force')
    expect(mockDb.attributeDefinition.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'attr-1' } }))
  })

  it('archives an attribute', async () => {
    const archived = { ...mockAttr, archivedAt: new Date() }
    mockDb.attributeDefinition.update.mockResolvedValue(archived)
    const attr = await archiveAttribute('attr-1')
    expect(attr.archivedAt).not.toBeNull()
  })

  it('reactivates an attribute', async () => {
    const reactivated = { ...mockAttr, archivedAt: null }
    mockDb.attributeDefinition.update.mockResolvedValue(reactivated)
    const attr = await reactivateAttribute('attr-1')
    expect(attr.archivedAt).toBeNull()
  })
})
