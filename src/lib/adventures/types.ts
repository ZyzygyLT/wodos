export interface AdventureStepEnemy {
  name: string
  icon: string
  hp: number
  mp: number
  atk: number
  def: number
  dx: number
  ag: number
  level: number
  position?: string
  damageType?: string
}

export interface AdventureChoice {
  text: string
  nextStep: number
  flavor?: string
  skillCheck?: { attr: string; dc: number; passStep: number; failStep: number }
}

export interface StepRewards {
  gold?: number
  ep?: number
  fame?: number
  items?: Array<{ itemId: number; qty: number }>
  materials?: Array<{ materialId: number; qty: number }>
}

export interface AdventureStep {
  type: 'narrative' | 'choice' | 'combat' | 'reward'
  name: string
  description: string
  image?: string
  enemies?: AdventureStepEnemy[]
  choices?: AdventureChoice[]
  rewards?: StepRewards
}

export interface AdventureRewardTable {
  goldMin: number
  goldMax: number
  ep: number
  fame: number
  items?: Array<{ itemId: number; chance: number; qty: number }>
  materials?: Array<{ materialId: number; chance: number; qty: number }>
}

export interface CombatStepResult {
  type: 'combat'
  victory: boolean
  enemiesDefeated: number
  totalEnemies: number
  heroHpLost: number
  heroMpLost: number
  heroHpRemaining: number
  heroMpRemaining: number
  log: string[]
}

export interface NarrativeStepResult {
  type: 'narrative'
  description: string
}

export interface ChoiceStepResult {
  type: 'choice'
  chosenIndex: number
  chosen: string
  nextStep: number
  nextStepName?: string | null
  nextStepDescription?: string | null
  flavor?: string
  skillCheck?: { attr: string; dc: number; value: number; passed: boolean }
}

export interface RewardStepResult {
  type: 'reward'
  rewards: StepRewards
}

export type StepResult = (CombatStepResult | NarrativeStepResult | ChoiceStepResult | RewardStepResult) & { stepName?: string }

export type StepAction = 'continue' | 'choose' | 'fight' | 'claim'

export const ENERGY_RECHARGE_INTERVAL_MINUTES = 5
export const ENERGY_PER_RECHARGE = 1
export const ENERGY_RECHARGE_COST_GOLD = 50
export const ENERGY_RECHARGE_AMOUNT_GOLD = 20
