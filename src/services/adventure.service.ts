import db from '@/lib/db'
import { runDungeon } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData } from '@/lib/dungeon-helpers'
import { createAdventureCombatDungeon, mapAdventureCombatResult } from '@/lib/adventures/combat-adapter'
import type { AdventureRewardTable, AdventureStep, StepResult, StepRewards, AdventureChoice } from '@/lib/adventures/types'
import {
  calcEnergyRecharge, resolveAdventureChoice, rollAdventureRewards,
  ADVENTURE_STATUSES_BLOCKING_NEW_START, isAdventureBlockingNewStart,
} from '@/lib/adventures/adventure-helpers'
import {
  ENERGY_RECHARGE_COST_GOLD, ENERGY_RECHARGE_AMOUNT_GOLD,
} from '@/lib/adventures/types'

async function getHeroWithEnergy(heroId: string) {
  return db.$transaction(async tx => {
    // Serialize passive recharge with purchases, manual recharge and adventure starts.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`

    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      select: {
        id: true, level: true, adventureEnergy: true, adventureEnergyMax: true,
        lastEnergyRechargeAt: true, gold: true, hpCurrent: true, hpMax: true,
        mpCurrent: true, mpMax: true, attrs: true,
      },
    })
    if (!hero) throw new Error('Héroe no encontrado')

    const energyRechargeAmount = calcEnergyRecharge(hero.lastEnergyRechargeAt)
    if (energyRechargeAmount <= 0) return hero

    const newEnergy = Math.min(hero.adventureEnergyMax, hero.adventureEnergy + energyRechargeAmount)
    const rechargedAt = new Date()
    await tx.hero.update({
      where: { id: heroId },
      data: { adventureEnergy: newEnergy, lastEnergyRechargeAt: rechargedAt },
    })
    return { ...hero, adventureEnergy: newEnergy, lastEnergyRechargeAt: rechargedAt }
  })
}

export async function listAdventures(heroId: string) {
  const hero = await getHeroWithEnergy(heroId)
  const adventures = await db.adventure.findMany({
    where: {
      isActive: true,
      levelReq: { lte: hero.level },
      maxLevel: { gte: hero.level },
    },
    include: { faction: { select: { id: true, name: true, icon: true, color: true } } },
    orderBy: { levelReq: 'asc' },
  })

  const activeAdventure = await db.heroAdventure.findFirst({
    where: { heroId, status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
  })

  return {
    adventures: adventures.map(a => ({
      id: a.id, name: a.name, slug: a.slug, icon: a.icon, description: a.description,
      lore: a.lore, levelReq: a.levelReq, duration: a.duration, energyCost: a.energyCost,
      faction: a.faction, canAfford: hero.adventureEnergy >= a.energyCost,
    })),
    energy: hero.adventureEnergy,
    energyMax: hero.adventureEnergyMax,
    hasActiveAdventure: !!activeAdventure,
    blockingAdventureStatus: activeAdventure?.status ?? null,
  }
}

export async function startAdventure(heroId: string, adventureId: number) {
  // Apply passive recharge first; the hero row lock below serializes starts and energy spending.
  await getHeroWithEnergy(heroId)

  return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`

    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      select: { id: true, level: true, adventureEnergy: true },
    })
    const adventure = await tx.adventure.findUnique({ where: { id: adventureId } })
    const existing = await tx.heroAdventure.findFirst({
      where: { heroId, status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
      select: { id: true, status: true },
    })

    if (!hero) throw new Error("Héroe no encontrado")
    if (!adventure) throw new Error("Aventura no encontrada")
    if (!adventure.isActive) throw new Error("Aventura no disponible")
    if (hero.level < adventure.levelReq) throw new Error("Nivel insuficiente")
    if (hero.level > adventure.maxLevel) throw new Error("Nivel demasiado alto")
    if (existing && isAdventureBlockingNewStart(existing.status)) {
      throw new Error(existing.status === 'completed'
        ? "Debes reclamar las recompensas de tu aventura completada"
        : "Ya tienes una aventura activa")
    }
    if (hero.adventureEnergy < adventure.energyCost) throw new Error("Energía insuficiente")

    const steps = adventure.steps as unknown as AdventureStep[]
    if (steps.length === 0) throw new Error("La aventura no tiene pasos configurados")

    const energyUpdate = await tx.hero.updateMany({
      where: { id: heroId, adventureEnergy: { gte: adventure.energyCost } },
      data: {
        adventureEnergy: { decrement: adventure.energyCost },
        lastEnergyRechargeAt: new Date(),
      },
    })
    if (energyUpdate.count !== 1) throw new Error("Energía insuficiente o modificada por otra operación")

    const heroAdventure = await tx.heroAdventure.create({
      data: {
        heroId,
        adventureId,
        currentStep: 0,
        totalSteps: steps.length,
        energySpent: adventure.energyCost,
      },
    })

    return { heroAdventureId: heroAdventure.id, totalSteps: steps.length }
  })
}

export async function getActiveAdventure(heroId: string) {
  // Read the latest run regardless of status so a newer claimed run hides older failures.
  const ha = await db.heroAdventure.findFirst({
    where: { heroId },
    orderBy: { startedAt: 'desc' },
    include: { adventure: true },
  })
  if (!ha || ha.status === 'claimed') return null

  const steps = ha.adventure.steps as unknown as AdventureStep[]
  const result = (ha.result as any) ?? { steps: [], rewards: null }
  const currentStep = steps[ha.currentStep]

  return {
    id: ha.id,
    adventureId: ha.adventureId,
    adventureName: ha.adventure.name,
    adventureIcon: ha.adventure.icon,
    adventureDescription: ha.adventure.description,
    adventureLore: ha.adventure.lore,
    currentStep: ha.currentStep,
    totalSteps: ha.totalSteps,
    status: ha.status,
    startedAt: ha.startedAt,
    result,
    currentStepData: currentStep ?? null,
  }
}

export async function executeStep(heroId: string, heroAdventureId: string, expectedCurrentStep: number) {
  // Preserve the passive energy recharge behavior; adventure state itself is locked transactionally.
  await getHeroWithEnergy(heroId)

  return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`
    await tx.$queryRaw`SELECT "id" FROM "hero_adventures" WHERE "id" = ${heroAdventureId} FOR UPDATE`

    const ha = await tx.heroAdventure.findUnique({
      where: { id: heroAdventureId },
      include: { adventure: true },
    })
    if (!ha || ha.heroId !== heroId) throw new Error("Aventura no encontrada")
    if (ha.status !== "active") throw new Error("Aventura no activa")
    if (ha.currentStep !== expectedCurrentStep) throw new Error("AVENTURA_STEP_STALE")
    if (ha.currentStep >= ha.totalSteps) throw new Error("Aventura ya completada")

    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      include: {
        combatProfiles: { orderBy: { createdAt: 'asc' } },
        skills: { include: { skill: true } },
        items: { include: { item: true } },
      },
    })
    if (!hero) throw new Error("Héroe no encontrado")

    const steps = ha.adventure.steps as unknown as AdventureStep[]
    const currentStep = steps[ha.currentStep]
    if (!currentStep) throw new Error("Paso de aventura no encontrado")

    const resultData = (ha.result as any) ?? { steps: [], rewards: null }
    if (!Array.isArray(resultData.steps)) resultData.steps = []
    const nextStepIndex = ha.currentStep + 1

    let stepResult: StepResult
    switch (currentStep.type) {
      case "narrative": {
        stepResult = { type: "narrative", description: currentStep.description }
        break
      }
      case "choice": {
        throw new Error("Este paso requiere elegir una opción")
      }
      case "combat": {
        const enemies = currentStep.enemies ?? []
        const combatHero = await buildHeroData(hero, hero.combatProfiles[0] ?? null)
        const combatDungeon = createAdventureCombatDungeon(currentStep.name, enemies)
        const combatRun = await runDungeon([combatHero], combatDungeon)
        const finalHeroState = combatRun.heroesFinalState[0]
        if (!finalHeroState) throw new Error("El combate no devolvió el estado final del héroe")

        stepResult = mapAdventureCombatResult(combatRun, enemies.length, {
          hp: hero.hpCurrent,
          mp: hero.mpCurrent,
        })
        await tx.hero.update({
          where: { id: heroId },
          data: {
            hpCurrent: finalHeroState.hp,
            mpCurrent: finalHeroState.mp,
          },
        })

        const consumedItemIds = [...new Set((combatRun.consumedConsumables ?? [])
          .filter(item => item.heroId === heroId)
          .map(item => item.heroItemId))]
        if (consumedItemIds.length > 0) {
          const consumed = await tx.heroItem.deleteMany({
            where: { id: { in: consumedItemIds }, heroId },
          })
          if (consumed.count !== consumedItemIds.length) {
            throw new Error("El inventario cambió durante el combate")
          }
        }
        if (!combatRun.victory) {
          resultData.steps.push(stepResult)
          const failed = await tx.heroAdventure.updateMany({
            where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
            data: { status: "failed", completedAt: new Date(), result: resultData },
          })
          if (failed.count !== 1) throw new Error("AVENTURA_STEP_STALE")
          return { completed: true, victory: false, stepResult, rewards: null, totalSteps: ha.totalSteps }
        }
        break
      }
      case "reward": {
        stepResult = { type: "reward", rewards: currentStep.rewards ?? {} }
        break
      }
      default: {
        stepResult = { type: "narrative", description: currentStep.description }
      }
    }

    resultData.steps.push(stepResult)
    const isLastStep = nextStepIndex >= ha.totalSteps
    if (isLastStep) {
      const rewardsTable = ha.adventure.rewards as unknown as AdventureRewardTable
      const rewards = rollAdventureRewards(rewardsTable)
      resultData.rewards = rewards

      const completed = await tx.heroAdventure.updateMany({
        where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
        data: {
          status: "completed",
          currentStep: nextStepIndex,
          completedAt: new Date(),
          result: resultData,
        },
      })
      if (completed.count !== 1) throw new Error("AVENTURA_STEP_STALE")

      return { completed: true, victory: true, stepResult, rewards, totalSteps: ha.totalSteps }
    }

    const advanced = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
      data: { currentStep: nextStepIndex, result: resultData },
    })
    if (advanced.count !== 1) throw new Error("AVENTURA_STEP_STALE")

    return {
      completed: false,
      stepResult,
      currentStep: nextStepIndex,
      totalSteps: ha.totalSteps,
      nextStep: steps[nextStepIndex],
    }
  })
}

export async function makeChoice(
  heroId: string, heroAdventureId: string, choiceIndex: number, expectedCurrentStep: number
) {
  return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "hero_adventures" WHERE "id" = ${heroAdventureId} FOR UPDATE`

    const ha = await tx.heroAdventure.findUnique({
      where: { id: heroAdventureId },
      include: { adventure: true },
    })
    if (!ha || ha.heroId !== heroId) throw new Error("Aventura no encontrada")
    if (ha.status !== "active") throw new Error("Aventura no activa")
    if (ha.currentStep !== expectedCurrentStep) throw new Error("AVENTURA_CHOICE_STALE")

    const steps = ha.adventure.steps as unknown as AdventureStep[]
    const currentStep = steps[ha.currentStep]
    if (!currentStep || currentStep.type !== "choice") {
      throw new Error("Este paso no requiere decisión")
    }
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || !currentStep.choices || choiceIndex >= currentStep.choices.length) {
      throw new Error("Opción inválida")
    }

    const chosen = currentStep.choices[choiceIndex]
    const hero = await tx.hero.findUnique({ where: { id: heroId }, select: { attrs: true } })
    if (!hero) throw new Error("Héroe no encontrado")
    const resolution = resolveAdventureChoice(
      chosen,
      hero.attrs as Record<string, number>,
      steps.length,
    )

    const resultData = (ha.result as any) ?? { steps: [], rewards: null }
    if (!Array.isArray(resultData.steps)) resultData.steps = []
    const stepResult = {
      type: "choice" as const,
      chosenIndex: choiceIndex,
      nextStep: resolution.nextStep,
      flavor: chosen.flavor ?? undefined,
      skillCheck: resolution.skillCheck,
    }
    resultData.steps.push(stepResult)

    const advanced = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
      data: { currentStep: resolution.nextStep, result: resultData },
    })
    if (advanced.count !== 1) throw new Error("AVENTURA_CHOICE_STALE")

    return {
      chosen: chosen.text,
      nextStepIndex: resolution.nextStep,
      flavor: chosen.flavor ?? null,
      skillCheck: resolution.skillCheck ?? null,
      stepResult,
      nextStep: steps[resolution.nextStep] ?? null,
      totalSteps: ha.totalSteps,
    }
  })
}

export async function claimRewards(heroId: string, heroAdventureId: string) {
  return await db.$transaction(async tx => {
    // Serialize reward claims for this adventure before reading its current state.
    await tx.$queryRaw`SELECT id FROM hero_adventures WHERE id = ${heroAdventureId} FOR UPDATE`
    const ha = await tx.heroAdventure.findUnique({
      where: { id: heroAdventureId },
      include: { adventure: { select: { factionId: true, factionRep: true } } },
    })
    if (!ha || ha.heroId !== heroId) throw new Error('Aventura no encontrada')
    if (ha.status === 'claimed') throw new Error('Recompensas ya reclamadas')
    if (ha.status !== 'completed') throw new Error('Solo se pueden reclamar recompensas de aventuras completadas')

    const result = ha.result as any
    const rewards = result?.rewards
    if (rewards) {
      const stepRewards = (result?.steps ?? [])
        .filter((step: any) => step.type === 'reward' && step.rewards)
        .reduce((acc: any, step: any) => {
          if (step.rewards.gold) acc.gold = (acc.gold ?? 0) + step.rewards.gold
          if (step.rewards.ep) acc.ep = (acc.ep ?? 0) + step.rewards.ep
          if (step.rewards.fame) acc.fame = (acc.fame ?? 0) + step.rewards.fame
          if (step.rewards.items) acc.items = [...(acc.items ?? []), ...step.rewards.items]
          if (step.rewards.materials) acc.materials = [...(acc.materials ?? []), ...step.rewards.materials]
          return acc
        }, {})

      const totalGold = (rewards.gold ?? 0) + (stepRewards.gold ?? 0)
      const totalEp = (rewards.ep ?? 0) + (stepRewards.ep ?? 0)
      const totalFame = (rewards.fame ?? 0) + (stepRewards.fame ?? 0)

      await tx.hero.update({
        where: { id: heroId },
        data: {
          gold: { increment: totalGold },
          epTotal: { increment: totalEp },
          fame: { increment: totalFame },
        },
      })

      const allItems = [...(rewards.items ?? []), ...(stepRewards.items ?? [])]
      for (const item of allItems) {
        await tx.heroItem.createMany({
          data: Array.from({ length: item.qty }, () => ({
            heroId, itemId: item.itemId, equipped: false,
          })),
        })
      }

      const allMaterials = [...(rewards.materials ?? []), ...(stepRewards.materials ?? [])]
      for (const mat of allMaterials) {
        await tx.heroMaterial.upsert({
          where: { heroId_materialId: { heroId, materialId: mat.materialId } },
          create: { heroId, materialId: mat.materialId, quantity: mat.qty },
          update: { quantity: { increment: mat.qty } },
        })
      }

      if (ha.adventure.factionId && ha.adventure.factionRep > 0) {
        await tx.heroFactionRep.upsert({
          where: { heroId_factionId: { heroId, factionId: ha.adventure.factionId } },
          create: { heroId, factionId: ha.adventure.factionId, rep: ha.adventure.factionRep },
          update: { rep: { increment: ha.adventure.factionRep } },
        })
      }
    }

    const claimed = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: ha.status },
      data: { status: 'claimed' },
    })
    if (claimed.count !== 1) throw new Error('AVENTURA_CLAIM_STALE')

    return { claimed: true, rewards: result?.rewards }
  })
}

export async function abandonAdventure(heroId: string, heroAdventureId: string) {
  return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "hero_adventures" WHERE "id" = ${heroAdventureId} FOR UPDATE`

    const ha = await tx.heroAdventure.findUnique({ where: { id: heroAdventureId } })
    if (!ha || ha.heroId !== heroId) throw new Error("Aventura no encontrada")
    if (ha.status !== "active") throw new Error("Aventura no activa")

    const abandoned = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
      data: { status: "failed", completedAt: new Date() },
    })
    if (abandoned.count !== 1) throw new Error("AVENTURA_ABANDON_STALE")

    return { abandoned: true }
  })
}

export async function rechargeEnergy(heroId: string) {
  // Commit passive regeneration independently, then serialize the explicit recharge.
  await getHeroWithEnergy(heroId)

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`

    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      select: { id: true, adventureEnergy: true, adventureEnergyMax: true },
    })
    if (!hero) throw new Error('Héroe no encontrado')
    if (hero.adventureEnergy >= hero.adventureEnergyMax) {
      throw new Error('Energía ya está al máximo')
    }

    const newEnergy = Math.min(hero.adventureEnergyMax, hero.adventureEnergy + 1)
    await tx.hero.update({
      where: { id: heroId },
      data: { adventureEnergy: newEnergy, lastEnergyRechargeAt: new Date() },
    })

    return { energy: newEnergy, energyMax: hero.adventureEnergyMax }
  })
}

export async function buyEnergy(heroId: string, amount: number = ENERGY_RECHARGE_AMOUNT_GOLD) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Cantidad de energía inválida')

  // Persist passive regeneration even if the subsequent purchase is unaffordable.
  await getHeroWithEnergy(heroId)

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`

    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      select: { id: true, gold: true, adventureEnergy: true, adventureEnergyMax: true },
    })
    if (!hero) throw new Error('Héroe no encontrado')
    if (hero.adventureEnergy >= hero.adventureEnergyMax) throw new Error('Energía ya está al máximo')

    const available = hero.adventureEnergyMax - hero.adventureEnergy
    const toBuy = Math.min(amount, available)
    const cost = toBuy * ENERGY_RECHARGE_COST_GOLD

    const purchase = await tx.hero.updateMany({
      where: {
        id: heroId,
        gold: { gte: cost },
        adventureEnergy: { equals: hero.adventureEnergy },
      },
      data: {
        gold: { decrement: cost },
        adventureEnergy: { increment: toBuy },
      },
    })
    if (purchase.count !== 1) throw new Error('Oro insuficiente o energía modificada por otra operación')

    return { energyBought: toBuy, cost, energy: hero.adventureEnergy + toBuy }
  })
}
