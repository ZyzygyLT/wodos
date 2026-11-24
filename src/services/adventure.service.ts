import db from '@/lib/db'
import { applyLevelUpInTransaction, publishLevelUpEffects } from '@/lib/level-up'
import { runDungeon } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, mergeHeroAttrs } from '@/lib/dungeon-helpers'
import { createAdventureCombatDungeon, mapAdventureCombatResult } from '@/lib/adventures/combat-adapter'
import type { AdventureRewardTable, AdventureStep, StepResult, StepRewards, AdventureChoice } from '@/lib/adventures/types'
import {
  adventureRequiresCombat, calcEnergyRecharge, getNextEnergyRechargeAt, resolveAdventureChoice, rollAdventureRewards,
  ADVENTURE_STATUSES_BLOCKING_NEW_START, isAdventureBlockingNewStart, markAdventureAbandoned, combineAdventureRewards,
  canClaimAdventureRewards, withAdventureChoicePreviews, getAdventureChoiceCosts, canAffordAdventureChoice,
  isAdventureStepTerminal,
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
    const rechargedAt = getNextEnergyRechargeAt(
      hero.lastEnergyRechargeAt, energyRechargeAmount, newEnergy, hero.adventureEnergyMax,
    )
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

  const adventureCandidates = await db.heroAdventure.findMany({
    where: { heroId, status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, result: true },
  })
  const activeAdventure = adventureCandidates.find(entry =>
    isAdventureBlockingNewStart(entry.status, entry.result)
  )

  return {
    adventures: adventures.map(a => {
      const rewardTable = a.rewards as unknown as AdventureRewardTable | null
      return {
        id: a.id, name: a.name, slug: a.slug, icon: a.icon, description: a.description,
        lore: a.lore, levelReq: a.levelReq, maxLevel: a.maxLevel, duration: a.duration, energyCost: a.energyCost,
        faction: a.faction, canAfford: hero.adventureEnergy >= a.energyCost,
        requiresCombat: adventureRequiresCombat(a.steps as unknown as AdventureStep[]),
        canStart: !adventureRequiresCombat(a.steps as unknown as AdventureStep[]) || hero.hpCurrent > 0,
        startBlockReason: adventureRequiresCombat(a.steps as unknown as AdventureStep[]) && hero.hpCurrent <= 0
          ? 'Tu héroe no tiene salud. Recupera HP antes de iniciar una aventura con combates.'
          : null,
        completionRewards: rewardTable ? {
          goldMin: rewardTable.goldMin,
          goldMax: rewardTable.goldMax,
          ep: rewardTable.ep,
          fame: rewardTable.fame,
        } : null,
      }
    }),
    energy: hero.adventureEnergy,
    energyMax: hero.adventureEnergyMax,
    heroResources: { hpCurrent: hero.hpCurrent, hpMax: hero.hpMax, mpCurrent: hero.mpCurrent, mpMax: hero.mpMax },
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
      select: { id: true, level: true, adventureEnergy: true, hpCurrent: true },
    })
    const adventure = await tx.adventure.findUnique({ where: { id: adventureId } })
    const existingCandidates = await tx.heroAdventure.findMany({
      where: { heroId, status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, result: true },
    })
    const existing = existingCandidates.find(entry =>
      isAdventureBlockingNewStart(entry.status, entry.result)
    )

    if (!hero) throw new Error("Héroe no encontrado")
    if (!adventure) throw new Error("Aventura no encontrada")
    if (!adventure.isActive) throw new Error("Aventura no disponible")
    if (hero.level < adventure.levelReq) throw new Error("Nivel insuficiente")
    if (hero.level > adventure.maxLevel) throw new Error("Nivel demasiado alto")
    if (existing) {
      throw new Error(existing.status === 'completed'
        ? "Debes reclamar las recompensas de tu aventura completada"
        : existing.status === 'failed'
          ? "Debes reclamar el botín recuperado antes de iniciar otra aventura"
          : "Ya tienes una aventura activa")
    }
    if (hero.adventureEnergy < adventure.energyCost) throw new Error("Energía insuficiente")

    const steps = adventure.steps as unknown as AdventureStep[]
    if (steps.length === 0) throw new Error("La aventura no tiene pasos configurados")
    if (adventureRequiresCombat(steps) && hero.hpCurrent <= 0) {
      throw new Error("Tu héroe no tiene salud. Recupera HP antes de iniciar una aventura con combates.")
    }

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
  // Prefer the newest run that still needs player action. A claimed newer run
  // must not hide older unclaimed rewards left by pre-fix adventure flows.
  const candidates = await db.heroAdventure.findMany({
    where: { heroId, status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
    orderBy: { startedAt: 'desc' },
    include: { adventure: true },
  })
  const ha = candidates.find(entry =>
    entry.status === 'active' || entry.status === 'completed' ||
    (entry.status === 'failed' && canClaimAdventureRewards(entry.status, entry.result))
  )
  if (!ha) return null

  const steps = ha.adventure.steps as unknown as AdventureStep[]
  const result = (ha.result as any) ?? { steps: [], rewards: null }
  type HistoryStep = {
    type?: unknown
    nextStep?: unknown
    nextStepName?: unknown
    nextStepDescription?: unknown
    rewards?: unknown
    [key: string]: unknown
  }
  const historyEntries: HistoryStep[] = Array.isArray(result.steps)
    ? result.steps.filter((entry: unknown): entry is HistoryStep =>
        entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    : []
  const historySteps = historyEntries.map((entry: HistoryStep) => {
    if (entry.type !== 'choice' || typeof entry.nextStep !== 'number' || !Number.isInteger(entry.nextStep)) return entry
    const destination = steps[entry.nextStep]
    return {
      ...entry,
      nextStepName: entry.nextStepName ?? destination?.name ?? null,
      nextStepDescription: entry.nextStepDescription ?? destination?.description ?? null,
    }
  })
  const currentStep = steps[ha.currentStep]
  const currentStepData = withAdventureChoicePreviews(currentStep, steps)

  // Resolve reward IDs to player-facing names without changing the persisted reward record.
  type RewardLookup = { items?: unknown; materials?: unknown }
  type RewardStep = { type?: unknown; rewards?: unknown }
  type AdventureResultForCatalog = { rewards?: unknown; steps?: unknown }
  const catalogResult = ha.result as AdventureResultForCatalog | null
  const catalogSteps: RewardStep[] = Array.isArray(catalogResult?.steps)
    ? catalogResult.steps.filter((entry: unknown): entry is RewardStep =>
        entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    : []
  const isRewardRecord = (value: unknown): value is RewardLookup =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  const rewardSources: RewardLookup[] = [
    ...(isRewardRecord(catalogResult?.rewards) ? [catalogResult.rewards] : []),
    ...catalogSteps
      .filter((entry) => (entry.type === 'reward' || entry.type === 'choice') && isRewardRecord(entry.rewards))
      .flatMap((entry) => isRewardRecord(entry.rewards) ? [entry.rewards] : []),
  ]
  const itemIds = [...new Set(rewardSources.flatMap((rewards) =>
    (Array.isArray(rewards.items) ? rewards.items : [])
      .map((item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
        ? (item as { itemId?: unknown }).itemId
        : undefined)
      .filter((value): value is number => typeof value === 'number' && Number.isInteger(value))
  ))]
  const materialIds = [...new Set(rewardSources.flatMap((rewards) =>
    (Array.isArray(rewards.materials) ? rewards.materials : [])
      .map((material: unknown) => material !== null && typeof material === 'object' && !Array.isArray(material)
        ? (material as { materialId?: unknown }).materialId
        : undefined)
      .filter((value): value is number => typeof value === 'number' && Number.isInteger(value))
  ))]
  const [rewardItems, rewardMaterials] = await Promise.all([
    itemIds.length ? db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, icon: true } }) : [],
    materialIds.length ? db.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, name: true, icon: true } }) : [],
  ])
  const hero = await db.hero.findUnique({
    where: { id: heroId },
    include: {
      combatProfiles: { where: { dungeonLevel: null }, take: 1 },
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
  const heroAttributes = hero
    ? Array.isArray(hero.skills) && Array.isArray(hero.items)
      ? mergeHeroAttrs(await buildHeroData(hero, hero.combatProfiles?.[0] ?? null))
      : hero.attrs as Record<string, number> | undefined
    : undefined

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
    result: { ...result, steps: historySteps },
    rewardCatalog: {
      items: Object.fromEntries(rewardItems.map(item => [item.id, { name: item.name, icon: item.icon }])),
      materials: Object.fromEntries(rewardMaterials.map(material => [material.id, { name: material.name, icon: material.icon }])),
    },
    currentStepData,
    heroAttributes,
    heroResources: hero ? {
      hpCurrent: hero.hpCurrent,
      hpMax: hero.hpMax,
      mpCurrent: hero.mpCurrent,
      mpMax: hero.mpMax,
    } : null,
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
        combatProfiles: { where: { dungeonLevel: null }, take: 1 },
        skills: { include: { skill: true } },
        items: { include: { item: true } },
      },
    })
    if (!hero) throw new Error("Héroe no encontrado")

    let heroResources = {
      hpCurrent: hero.hpCurrent,
      hpMax: hero.hpMax,
      mpCurrent: hero.mpCurrent,
      mpMax: hero.mpMax,
    }
    const steps = ha.adventure.steps as unknown as AdventureStep[]
    const currentStep = steps[ha.currentStep]
    if (!currentStep) throw new Error("Paso de aventura no encontrado")

    const resultData = (ha.result as any) ?? { steps: [], rewards: null }
    if (!Array.isArray(resultData.steps)) resultData.steps = []
    const nextStepIndex = ha.currentStep + 1

    let stepResult: StepResult
    switch (currentStep.type) {
      case "narrative": {
        stepResult = { type: "narrative", description: currentStep.description, stepName: currentStep.name }
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

        stepResult = {
          ...mapAdventureCombatResult(combatRun, enemies.length, {
            hp: hero.hpCurrent,
            mp: hero.mpCurrent,
          }),
          stepName: currentStep.name,
        }
        await tx.hero.update({
          where: { id: heroId },
          data: {
            hpCurrent: finalHeroState.hp,
            mpCurrent: finalHeroState.mp,
          },
        })
        heroResources = {
          hpCurrent: finalHeroState.hp,
          hpMax: hero.hpMax,
          mpCurrent: finalHeroState.mp,
          mpMax: hero.mpMax,
        }

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
          resultData.outcome = 'defeated'
          const failed = await tx.heroAdventure.updateMany({
            where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
            data: { status: "failed", completedAt: new Date(), result: resultData },
          })
          if (failed.count !== 1) throw new Error("AVENTURA_STEP_STALE")
          return { completed: true, victory: false, stepResult, rewards: null, totalSteps: ha.totalSteps, heroResources }
        }
        break
      }
      case "reward": {
        stepResult = { type: "reward", rewards: currentStep.rewards ?? {}, stepName: currentStep.name }
        break
      }
      default: {
        stepResult = { type: "narrative", description: currentStep.description, stepName: currentStep.name }
      }
    }

    resultData.steps.push(stepResult)
    const isLastStep = isAdventureStepTerminal(currentStep, nextStepIndex, ha.totalSteps)
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

      return { completed: true, victory: true, stepResult, rewards, totalSteps: ha.totalSteps, heroResources }
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
      nextStep: withAdventureChoicePreviews(steps[nextStepIndex], steps),
      heroResources,
    }
  })
}

export async function makeChoice(
  heroId: string, heroAdventureId: string, choiceIndex: number, expectedCurrentStep: number
) {
  return await db.$transaction(async tx => {
    // Keep the same hero → adventure lock order used by step execution.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${heroId} FOR UPDATE`
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
    const hero = await tx.hero.findUnique({
      where: { id: heroId },
      include: {
        combatProfiles: { where: { dungeonLevel: null }, take: 1 },
        skills: { include: { skill: true } },
        items: { include: { item: true } },
      },
    })
    if (!hero) throw new Error("Héroe no encontrado")
    const combatHero = await buildHeroData(hero, hero.combatProfiles[0] ?? null)
    const resolution = resolveAdventureChoice(
      chosen,
      mergeHeroAttrs(combatHero),
      steps.length,
    )
    const costs = getAdventureChoiceCosts(chosen)
    if (!canAffordAdventureChoice(costs, hero)) {
      throw new Error("No tienes suficiente salud o maná para elegir esta opción")
    }
    if (costs.hp > 0 || costs.mp > 0) {
      const resourceUpdate = await tx.hero.updateMany({
        where: {
          id: heroId,
          ...(costs.hp > 0 ? { hpCurrent: { gt: costs.hp } } : {}),
          mpCurrent: { gte: costs.mp },
        },
        data: {
          hpCurrent: { decrement: costs.hp },
          mpCurrent: { decrement: costs.mp },
        },
      })
      if (resourceUpdate.count !== 1) {
        throw new Error("No tienes suficiente salud o maná para elegir esta opción")
      }
    }
    const heroResources = {
      hpCurrent: hero.hpCurrent - costs.hp,
      hpMax: hero.hpMax,
      mpCurrent: hero.mpCurrent - costs.mp,
      mpMax: hero.mpMax,
    }

    const resultData = (ha.result as any) ?? { steps: [], rewards: null }
    if (!Array.isArray(resultData.steps)) resultData.steps = []
    const stepResult = {
      type: "choice" as const,
      stepName: currentStep.name,
      chosenIndex: choiceIndex,
      chosen: chosen.text,
      nextStep: resolution.nextStep,
      nextStepName: steps[resolution.nextStep]?.name ?? null,
      nextStepDescription: steps[resolution.nextStep]?.description ?? null,
      flavor: chosen.flavor ?? undefined,
      skillCheck: resolution.skillCheck,
      costs: costs.hp > 0 || costs.mp > 0 ? costs : undefined,
      rewards: chosen.rewards ?? undefined,
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
      nextStep: withAdventureChoicePreviews(steps[resolution.nextStep], steps),
      totalSteps: ha.totalSteps,
      heroResources,
    }
  })
}

export async function claimRewards(heroId: string, heroAdventureId: string) {
  const claim = await db.$transaction(async tx => {
    // Serialize reward claims for this adventure before reading its current state.
    await tx.$queryRaw`SELECT id FROM hero_adventures WHERE id = ${heroAdventureId} FOR UPDATE`
    const ha = await tx.heroAdventure.findUnique({
      where: { id: heroAdventureId },
      include: { adventure: { select: { factionId: true, factionRep: true } } },
    })
    if (!ha || ha.heroId !== heroId) throw new Error('Aventura no encontrada')
    if (ha.status === 'claimed') throw new Error('Recompensas ya reclamadas')

    const result = ha.result as any
    const isDefeatClaim = ha.status === 'failed' && canClaimAdventureRewards(ha.status, result)
    if (ha.status !== 'completed' && !isDefeatClaim) {
      throw new Error('Solo se pueden reclamar recompensas de aventuras completadas o botín obtenido antes de una derrota')
    }

    // Defeat grants only explicitly earned step rewards, never the adventure completion roll.
    const rewards = combineAdventureRewards(isDefeatClaim ? undefined : result?.rewards, result?.steps ?? [])
    const totalGold = rewards.gold ?? 0
    const totalEp = rewards.ep ?? 0
    const totalFame = rewards.fame ?? 0
    await tx.hero.update({
      where: { id: heroId },
      data: {
        gold: { increment: totalGold },
        epTotal: { increment: totalEp },
        fame: { increment: totalFame },
      },
    })

    for (const item of rewards.items ?? []) {
      await tx.heroItem.createMany({
        data: Array.from({ length: item.qty }, () => ({
          heroId, itemId: item.itemId, equipped: false,
        })),
      })
    }

    for (const mat of rewards.materials ?? []) {
      await tx.heroMaterial.upsert({
        where: { heroId_materialId: { heroId, materialId: mat.materialId } },
        create: { heroId, materialId: mat.materialId, quantity: mat.qty },
        update: { quantity: { increment: mat.qty } },
      })
    }

    if (!isDefeatClaim && ha.adventure.factionId && ha.adventure.factionRep > 0) {
      await tx.heroFactionRep.upsert({
        where: { heroId_factionId: { heroId, factionId: ha.adventure.factionId } },
        create: { heroId, factionId: ha.adventure.factionId, rep: ha.adventure.factionRep },
        update: { rep: { increment: ha.adventure.factionRep } },
      })
    }

    // Apply progression before marking the adventure claimed. Any failure rolls
    // back EP, inventory, currency and claim status together.
    const levelUp = totalEp > 0
      ? await applyLevelUpInTransaction(tx, heroId)
      : null

    const claimed = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: ha.status },
      data: { status: 'claimed' },
    })
    if (claimed.count !== 1) throw new Error('AVENTURA_CLAIM_STALE')

    return { claimed: true, rewards, partial: isDefeatClaim, levelUp }
  })

  if (claim.levelUp) publishLevelUpEffects(heroId, claim.levelUp)
  return claim
}

export async function abandonAdventure(heroId: string, heroAdventureId: string) {
  return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "hero_adventures" WHERE "id" = ${heroAdventureId} FOR UPDATE`

    const ha = await tx.heroAdventure.findUnique({ where: { id: heroAdventureId } })
    if (!ha || ha.heroId !== heroId) throw new Error("Aventura no encontrada")
    if (ha.status !== "active") throw new Error("Aventura no activa")

    const abandoned = await tx.heroAdventure.updateMany({
      where: { id: heroAdventureId, heroId, status: "active", currentStep: ha.currentStep },
      data: { status: "failed", completedAt: new Date(), result: markAdventureAbandoned(ha.result) },
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
