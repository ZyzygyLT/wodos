import db from '@/lib/db'

export interface CreateAdminHeroData {
  userId: string
  name: string
  classId: number
  raceId: number
  attrs?: Record<string, number>
}

export async function findAllHeroes() {
  return db.hero.findMany({
    include: { class: true, race: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findHeroById(id: string) {
  return db.hero.findUnique({
    where: { id },
    include: { class: true, race: true, user: true },
  })
}

export async function findHeroByName(name: string) {
  return db.hero.findFirst({ where: { name } })
}

export async function createAdminHero(data: CreateAdminHeroData) {
  const existing = await findHeroByName(data.name)
  if (existing) {
    throw new Error('A hero with this name already exists')
  }
  return db.hero.create({
    data: {
      userId: data.userId,
      name: data.name,
      classId: data.classId,
      raceId: data.raceId,
      attrs: data.attrs ?? {},
      hpCurrent: 0,
      hpMax: 0,
      mpCurrent: 0,
      mpMax: 0,
    },
    include: { class: true, race: true },
  })
}

export async function updateHeroAttrs(id: string, attrs: Record<string, number>) {
  return db.hero.update({
    where: { id },
    data: { attrs },
    include: { class: true, race: true, user: true },
  })
}

export async function updateHeroName(id: string, name: string) {
  const existing = await findHeroByName(name)
  if (existing && existing.id !== id) {
    throw new Error('A hero with this name already exists')
  }
  return db.hero.update({
    where: { id },
    data: { name },
    include: { class: true, race: true, user: true },
  })
}

export async function deleteHero(id: string) {
  return db.hero.delete({ where: { id } })
}
