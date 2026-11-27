"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import logger from "@/lib/logger"
import { useToast } from "@/hooks/useToast"

export interface RoundRule {
  priority: number
  condition: { type: string; value?: number; skillId?: number }
  action: { skillId?: number; itemId?: number; targetPos: string; targetType: string }
}

export interface PrelimRule {
  skillId?: number
  itemId?: number
}

export interface CombatProfile {
  id: string; heroId: string
  name: string; dungeonLevel: number | null
  position: string
  initiativeSkill?: string
  defenseSkills: Record<string, number | null>
  prelimRules: PrelimRule[]
  roundRules: RoundRule[]
}

export interface HeroSkillDef {
  id: number; name: string; icon: string
  slug?: string; effect?: string
  type: string; timing: string; tier: number
  goldCost: number; manaCost: number
  multiplier: number; unlocked: boolean
  defenseCategory?: string | null
  formula?: any
  rank?: number
}

export interface ConsumableItemDef {
  heroItemId: string
  itemId: number
  name: string
  icon: string
  description: string
  stats: Record<string, number>
}

export interface DefenseSkillDef {
  id: number; name: string; icon: string
  defenseCategory?: string | null
  rank: number; formula: any
}

export function useTactics() {
  const router = useRouter()
  const { toast, show } = useToast()
  const [profiles, setProfiles] = useState<CombatProfile[]>([])
  const [selectedDungeonLevel, setSelectedDungeonLevel] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [heroSkills, setHeroSkills] = useState<HeroSkillDef[]>([])
  const [consumableItems, setConsumableItems] = useState<ConsumableItemDef[]>([])
  const [heroAttrs, setHeroAttrs] = useState<Record<string, number>>({})
  const [heroLevel, setHeroLevel] = useState(1)
  const [defenseSkillDetails, setDefenseSkillDetails] = useState<DefenseSkillDef[]>([])

  const currentProfile = profiles.find(p => p.dungeonLevel === selectedDungeonLevel)
  const generalProfile = profiles.find(p => p.dungeonLevel === null)
  const unlockedSkills = heroSkills.filter(s => s.unlocked)
  const profile = selectedDungeonLevel === null ? generalProfile : currentProfile

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/tactics")
      if (res.status === 401) return router.push("/api/auth/signin")
      const data = await res.json()
      setProfiles(data.profiles ?? data)
      if (data.attrs) {
        setHeroAttrs(data.attrs)
        setHeroLevel(data.heroLevel ?? 1)
        setDefenseSkillDetails(data.skills ?? [])
      }
    } catch (e) { logger.error('tactics', 'Failed to load data', e) }
  }, [router])

  useEffect(() => { void Promise.resolve().then(fetchProfiles) }, [fetchProfiles])

  useEffect(() => {
    fetch("/api/hero/skills").then(r => r.json()).then(setHeroSkills).catch(e => logger.error("useTactics", "Failed to fetch data", e))
    fetch("/api/hero/consumables").then(r => r.json()).then(setConsumableItems).catch(e => logger.error("useTactics", "Failed to fetch data", e))
  }, [])

  function updateProfile(field: string, value: any) {
    if (!profile) return
    setProfiles(profiles.map(p =>
      p.id === profile.id ? { ...p, [field]: value } : p
    ))
  }

  function updateRoundRule(index: number, field: string, value: any) {
    if (!profile) return
    const rules = [...profile.roundRules]
    if (field.startsWith('condition.')) {
      const condField = field.split('.')[1]
      rules[index] = { ...rules[index], condition: { ...rules[index].condition, [condField]: value } }
    } else if (field.startsWith('action.')) {
      const actField = field.split('.')[1]
      rules[index] = { ...rules[index], action: { ...rules[index].action, [actField]: value } }
    }
    updateProfile('roundRules', rules)
  }

  function addRoundRule(defaultSkillId: number) {
    if (!profile) return
    const maxPriority = Math.max(...profile.roundRules.map(r => r.priority), 0)
    const newRule: RoundRule = {
      priority: maxPriority + 1,
      condition: { type: 'always' },
      action: { skillId: defaultSkillId, targetPos: 'front', targetType: 'weakest' },
    }
    updateProfile('roundRules', [...profile.roundRules, newRule])
  }

  function removeRoundRule(index: number) {
    if (!profile) return
    updateProfile('roundRules', profile.roundRules.filter((_, i) => i !== index))
  }

  function addPrelimRule(defaultSkillId: number) {
    if (!profile) return
    updateProfile('prelimRules', [...profile.prelimRules, { skillId: defaultSkillId }])
  }

  function updatePrelimRuleAction(index: number, combinedId: string) {
    if (!profile) return
    const rules = [...profile.prelimRules]
    if (combinedId.startsWith('skill:')) {
      rules[index] = { skillId: Number(combinedId.slice(6)), itemId: undefined }
    } else if (combinedId.startsWith('item:')) {
      rules[index] = { itemId: Number(combinedId.slice(5)), skillId: undefined }
    }
    updateProfile('prelimRules', rules)
  }

  function removePrelimRule(index: number) {
    if (!profile) return
    updateProfile('prelimRules', profile.prelimRules.filter((_, i) => i !== index))
  }

  function updateRoundRuleActionSkill(index: number, combinedId: string) {
    if (!profile) return
    const rules = [...profile.roundRules]
    if (combinedId.startsWith('skill:')) {
      rules[index] = { ...rules[index], action: { ...rules[index].action, skillId: Number(combinedId.slice(6)), itemId: undefined } }
    } else if (combinedId.startsWith('item:')) {
      rules[index] = { ...rules[index], action: { ...rules[index].action, itemId: Number(combinedId.slice(5)), skillId: undefined } }
    }
    updateProfile('roundRules', rules)
  }

  async function save() {
    setSaving(true)
    try {
      for (const p of profiles) {
        const response = await fetch("/api/tactics", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dungeonLevel: p.dungeonLevel,
            position: p.position,
            initiativeSkill: p.initiativeSkill ?? '',
            defenseSkills: p.defenseSkills,
            prelimRules: p.prelimRules,
            roundRules: p.roundRules,
          }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          const reason = typeof data.error === "string" ? data.error : `HTTP ${response.status}`
          throw new Error(`No se pudo guardar el perfil "${p.name}": ${reason}. Los perfiles anteriores podrían haberse guardado.`)
        }
      }
      show("Tácticas guardadas")
    } catch (error) {
      show(error instanceof Error ? error.message : "Error de red al guardar tácticas")
    } finally {
      setSaving(false)
    }
  }

  return {
    toast,
    profiles,
    selectedDungeonLevel,
    setSelectedDungeonLevel,
    saving,
    heroSkills,
    consumableItems,
    heroAttrs,
    heroLevel,
    defenseSkillDetails,
    currentProfile,
    generalProfile,
    unlockedSkills,
    profile,
    updateProfile,
    updateRoundRule,
    addRoundRule,
    removeRoundRule,
    addPrelimRule,
    updatePrelimRuleAction,
    removePrelimRule,
    updateRoundRuleActionSkill,
    save,
  }
}
