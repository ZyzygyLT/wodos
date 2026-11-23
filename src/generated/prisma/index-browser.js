
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  emailVerified: 'emailVerified',
  name: 'name',
  passwordHash: 'passwordHash',
  image: 'image',
  isAdmin: 'isAdmin',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  currentHeroId: 'currentHeroId',
  maxHeroes: 'maxHeroes'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId',
  expires: 'expires'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  expires_at: 'expires_at',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state'
};

exports.Prisma.ClassScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  tier: 'tier',
  role: 'role',
  position: 'position',
  difficulty: 'difficulty',
  description: 'description',
  lore: 'lore',
  baseAttrs: 'baseAttrs',
  primaryAttr: 'primaryAttr',
  secondaryAttr: 'secondaryAttr',
  unlockCondition: 'unlockCondition',
  createdAt: 'createdAt'
};

exports.Prisma.RaceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  flavor: 'flavor',
  lore: 'lore',
  attrMods: 'attrMods',
  racialTraits: 'racialTraits',
  bestForClasses: 'bestForClasses',
  createdAt: 'createdAt'
};

exports.Prisma.SkillScalarFieldEnum = {
  id: 'id',
  classId: 'classId',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  type: 'type',
  tier: 'tier',
  timing: 'timing',
  description: 'description',
  effect: 'effect',
  epCost: 'epCost',
  goldCost: 'goldCost',
  manaCost: 'manaCost',
  multiplier: 'multiplier',
  cooldownRounds: 'cooldownRounds',
  requiresSkills: 'requiresSkills',
  formula: 'formula',
  tags: 'tags',
  createdAt: 'createdAt',
  attackCategory: 'attackCategory',
  defenseCategory: 'defenseCategory',
  maxRank: 'maxRank',
  raceReq: 'raceReq'
};

exports.Prisma.DungeonScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  region: 'region',
  description: 'description',
  lore: 'lore',
  levelReq: 'levelReq',
  recommendedLevel: 'recommendedLevel',
  difficulty: 'difficulty',
  difficultyLabel: 'difficultyLabel',
  scheduledTimes: 'scheduledTimes',
  isInstant: 'isInstant',
  epReward: 'epReward',
  goldReward: 'goldReward',
  fameReward: 'fameReward',
  levels: 'levels',
  lootTable: 'lootTable',
  isEventOnly: 'isEventOnly',
  createdAt: 'createdAt',
  clanId: 'clanId'
};

exports.Prisma.EnemyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  icon: 'icon',
  hp: 'hp',
  mp: 'mp',
  atk: 'atk',
  def: 'def',
  dx: 'dx',
  ag: 'ag',
  level: 'level',
  baseLevel: 'baseLevel',
  growthFactor: 'growthFactor',
  position: 'position',
  lootTable: 'lootTable',
  conditions: 'conditions',
  ai: 'ai',
  createdAt: 'createdAt',
  damageType: 'damageType',
  skillIds: 'skillIds',
  faction: 'faction'
};

exports.Prisma.ItemScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  category: 'category',
  rarity: 'rarity',
  description: 'description',
  stats: 'stats',
  classReq: 'classReq',
  raceReq: 'raceReq',
  levelReq: 'levelReq',
  attrReq: 'attrReq',
  skillReq: 'skillReq',
  runeSlots: 'runeSlots',
  price: 'price',
  isCraftable: 'isCraftable',
  recipe: 'recipe',
  createdAt: 'createdAt',
  slot: 'slot',
  twoHanded: 'twoHanded'
};

exports.Prisma.MaterialScalarFieldEnum = {
  id: 'id',
  name: 'name',
  icon: 'icon',
  rarity: 'rarity',
  description: 'description',
  dropSources: 'dropSources',
  createdAt: 'createdAt'
};

exports.Prisma.HeroScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  description: 'description',
  classId: 'classId',
  raceId: 'raceId',
  level: 'level',
  epTotal: 'epTotal',
  epSpent: 'epSpent',
  gold: 'gold',
  fame: 'fame',
  attrs: 'attrs',
  freeAttrPoints: 'freeAttrPoints',
  hpCurrent: 'hpCurrent',
  hpMax: 'hpMax',
  mpCurrent: 'mpCurrent',
  mpMax: 'mpMax',
  dungeonRegisteredId: 'dungeonRegisteredId',
  eloRating: 'eloRating',
  arenaWins: 'arenaWins',
  arenaLosses: 'arenaLosses',
  adventureEnergy: 'adventureEnergy',
  adventureEnergyMax: 'adventureEnergyMax',
  lastEnergyRechargeAt: 'lastEnergyRechargeAt',
  onboardingDone: 'onboardingDone',
  pushToken: 'pushToken',
  lastLoginAt: 'lastLoginAt',
  loginStreak: 'loginStreak',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  inventoryMaxSize: 'inventoryMaxSize'
};

exports.Prisma.HeroSkillScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  skillId: 'skillId',
  rank: 'rank',
  unlockedAt: 'unlockedAt'
};

exports.Prisma.HeroItemScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  itemId: 'itemId',
  equipped: 'equipped',
  runesIn: 'runesIn',
  upgradeLevel: 'upgradeLevel',
  statOverrides: 'statOverrides',
  obtainedAt: 'obtainedAt',
  slot: 'slot'
};

exports.Prisma.HeroMaterialScalarFieldEnum = {
  heroId: 'heroId',
  materialId: 'materialId',
  quantity: 'quantity'
};

exports.Prisma.CombatProfileScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  name: 'name',
  dungeonLevel: 'dungeonLevel',
  position: 'position',
  initiativeSkill: 'initiativeSkill',
  prelimRules: 'prelimRules',
  roundRules: 'roundRules',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  defenseSkills: 'defenseSkills'
};

exports.Prisma.DungeonRunScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  dungeonId: 'dungeonId',
  profileId: 'profileId',
  startedAt: 'startedAt',
  completesAt: 'completesAt',
  registeredAt: 'registeredAt',
  executedAt: 'executedAt',
  status: 'status',
  result: 'result',
  report: 'report',
  levelsCleared: 'levelsCleared',
  epGained: 'epGained',
  goldGained: 'goldGained',
  fameGained: 'fameGained',
  loot: 'loot',
  createdAt: 'createdAt',
  groupId: 'groupId',
  levelReports: 'levelReports'
};

exports.Prisma.BazarListingScalarFieldEnum = {
  id: 'id',
  sellerId: 'sellerId',
  heroItemId: 'heroItemId',
  itemId: 'itemId',
  listingType: 'listingType',
  price: 'price',
  startPrice: 'startPrice',
  buyNowPrice: 'buyNowPrice',
  expiresAt: 'expiresAt',
  status: 'status',
  views: 'views',
  createdAt: 'createdAt'
};

exports.Prisma.BazarPurchaseScalarFieldEnum = {
  id: 'id',
  listingId: 'listingId',
  buyerId: 'buyerId',
  pricePaid: 'pricePaid',
  purchasedAt: 'purchasedAt'
};

exports.Prisma.ClanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  tag: 'tag',
  icon: 'icon',
  description: 'description',
  gold: 'gold',
  fame: 'fame',
  level: 'level',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClanMemberScalarFieldEnum = {
  heroId: 'heroId',
  clanId: 'clanId',
  role: 'role',
  goldContributed: 'goldContributed',
  joinedAt: 'joinedAt',
  groupId: 'groupId',
  groupRole: 'groupRole'
};

exports.Prisma.ClanGroupScalarFieldEnum = {
  id: 'id',
  clanId: 'clanId',
  name: 'name',
  icon: 'icon',
  leaderId: 'leaderId',
  createdAt: 'createdAt'
};

exports.Prisma.GroupMemberScalarFieldEnum = {
  id: 'id',
  groupId: 'groupId',
  heroId: 'heroId',
  role: 'role',
  joinedAt: 'joinedAt'
};

exports.Prisma.GroupInviteScalarFieldEnum = {
  id: 'id',
  groupId: 'groupId',
  heroId: 'heroId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClanUpgradeScalarFieldEnum = {
  id: 'id',
  clanId: 'clanId',
  upgradeId: 'upgradeId',
  tier: 'tier',
  unlockedAt: 'unlockedAt'
};

exports.Prisma.WeeklyEventScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  type: 'type',
  dungeonId: 'dungeonId',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  isActive: 'isActive',
  rewards: 'rewards',
  createdAt: 'createdAt'
};

exports.Prisma.ClanEventParticipationScalarFieldEnum = {
  clanId: 'clanId',
  eventId: 'eventId',
  score: 'score',
  updatedAt: 'updatedAt',
  claimed: 'claimed'
};

exports.Prisma.HeroEventParticipationScalarFieldEnum = {
  heroId: 'heroId',
  eventId: 'eventId',
  progress: 'progress',
  target: 'target',
  completed: 'completed',
  claimedAt: 'claimedAt',
  createdAt: 'createdAt'
};

exports.Prisma.TournamentScalarFieldEnum = {
  id: 'id',
  name: 'name',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  status: 'status',
  minElo: 'minElo',
  maxPlayers: 'maxPlayers',
  rewards: 'rewards',
  createdAt: 'createdAt'
};

exports.Prisma.TournamentParticipantScalarFieldEnum = {
  id: 'id',
  tournamentId: 'tournamentId',
  heroId: 'heroId',
  seed: 'seed',
  eliminated: 'eliminated'
};

exports.Prisma.TournamentMatchScalarFieldEnum = {
  id: 'id',
  tournamentId: 'tournamentId',
  round: 'round',
  matchNumber: 'matchNumber',
  hero1Id: 'hero1Id',
  hero2Id: 'hero2Id',
  winnerId: 'winnerId',
  log: 'log',
  playedAt: 'playedAt'
};

exports.Prisma.QuestScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  name: 'name',
  type: 'type',
  description: 'description',
  npcName: 'npcName',
  npcDialog: 'npcDialog',
  objectives: 'objectives',
  rewards: 'rewards',
  chainNext: 'chainNext',
  levelReq: 'levelReq',
  isRepeatable: 'isRepeatable',
  resetHours: 'resetHours',
  createdAt: 'createdAt'
};

exports.Prisma.HeroQuestScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  questId: 'questId',
  status: 'status',
  progress: 'progress',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.AchievementScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  name: 'name',
  description: 'description',
  icon: 'icon',
  category: 'category',
  condition: 'condition',
  rewards: 'rewards',
  order: 'order',
  createdAt: 'createdAt'
};

exports.Prisma.HeroAchievementScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  achievementId: 'achievementId',
  progress: 'progress',
  completed: 'completed',
  completedAt: 'completedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ForumCategoryScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  name: 'name',
  description: 'description',
  icon: 'icon',
  clanId: 'clanId',
  order: 'order',
  createdAt: 'createdAt'
};

exports.Prisma.ForumTopicScalarFieldEnum = {
  id: 'id',
  categoryId: 'categoryId',
  authorId: 'authorId',
  title: 'title',
  content: 'content',
  isPinned: 'isPinned',
  isLocked: 'isLocked',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ForumReplyScalarFieldEnum = {
  id: 'id',
  topicId: 'topicId',
  authorId: 'authorId',
  content: 'content',
  createdAt: 'createdAt'
};

exports.Prisma.AttributeDefinitionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  abbreviation: 'abbreviation',
  description: 'description',
  minValue: 'minValue',
  maxValue: 'maxValue',
  archivedAt: 'archivedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DuelHistoryScalarFieldEnum = {
  id: 'id',
  hero1Id: 'hero1Id',
  hero2Id: 'hero2Id',
  winnerId: 'winnerId',
  eloChange1: 'eloChange1',
  eloChange2: 'eloChange2',
  rounds: 'rounds',
  log: 'log',
  goldCost: 'goldCost',
  foughtAt: 'foughtAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  type: 'type',
  title: 'title',
  body: 'body',
  data: 'data',
  readAt: 'readAt',
  createdAt: 'createdAt'
};

exports.Prisma.FactionScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  name: 'name',
  description: 'description',
  icon: 'icon',
  color: 'color',
  createdAt: 'createdAt'
};

exports.Prisma.FactionShopScalarFieldEnum = {
  id: 'id',
  factionId: 'factionId',
  name: 'name',
  icon: 'icon',
  minRep: 'minRep',
  items: 'items',
  createdAt: 'createdAt'
};

exports.Prisma.AdventureScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  icon: 'icon',
  description: 'description',
  lore: 'lore',
  levelReq: 'levelReq',
  maxLevel: 'maxLevel',
  duration: 'duration',
  energyCost: 'energyCost',
  steps: 'steps',
  rewards: 'rewards',
  factionId: 'factionId',
  factionRep: 'factionRep',
  isActive: 'isActive',
  minGoldReward: 'minGoldReward',
  maxGoldReward: 'maxGoldReward',
  epReward: 'epReward',
  fameReward: 'fameReward',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.HeroAdventureScalarFieldEnum = {
  id: 'id',
  heroId: 'heroId',
  adventureId: 'adventureId',
  status: 'status',
  currentStep: 'currentStep',
  totalSteps: 'totalSteps',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  energySpent: 'energySpent',
  result: 'result'
};

exports.Prisma.HeroFactionRepScalarFieldEnum = {
  heroId: 'heroId',
  factionId: 'factionId',
  rep: 'rep',
  title: 'title',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.ClassRole = exports.$Enums.ClassRole = {
  tank: 'tank',
  dps: 'dps',
  healer: 'healer',
  support: 'support',
  hybrid: 'hybrid'
};

exports.CombatPosition = exports.$Enums.CombatPosition = {
  front: 'front',
  center: 'center',
  rear: 'rear',
  left_flank: 'left_flank',
  right_flank: 'right_flank',
  flexible: 'flexible'
};

exports.Difficulty = exports.$Enums.Difficulty = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced'
};

exports.SkillType = exports.$Enums.SkillType = {
  active: 'active',
  passive: 'passive',
  basic: 'basic'
};

exports.SkillTiming = exports.$Enums.SkillTiming = {
  pre_round: 'pre_round',
  round: 'round',
  both: 'both',
  passive: 'passive'
};

exports.ItemCategory = exports.$Enums.ItemCategory = {
  weapon: 'weapon',
  armor: 'armor',
  accessory: 'accessory',
  consumable: 'consumable',
  rune: 'rune',
  material: 'material'
};

exports.ItemRarity = exports.$Enums.ItemRarity = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'epic',
  unique: 'unique'
};

exports.EquipmentSlot = exports.$Enums.EquipmentSlot = {
  head: 'head',
  face: 'face',
  neck: 'neck',
  shoulders: 'shoulders',
  back: 'back',
  chest: 'chest',
  arms: 'arms',
  hands: 'hands',
  mainHand: 'mainHand',
  offHand: 'offHand',
  belt: 'belt',
  legs: 'legs',
  feet: 'feet',
  backpack: 'backpack'
};

exports.RunStatus = exports.$Enums.RunStatus = {
  registered: 'registered',
  running: 'running',
  done: 'done',
  failed: 'failed'
};

exports.RunResult = exports.$Enums.RunResult = {
  victory: 'victory',
  defeat: 'defeat'
};

exports.ListingType = exports.$Enums.ListingType = {
  fixed: 'fixed',
  auction: 'auction'
};

exports.ListingStatus = exports.$Enums.ListingStatus = {
  active: 'active',
  sold: 'sold',
  expired: 'expired',
  cancelled: 'cancelled'
};

exports.ClanRole = exports.$Enums.ClanRole = {
  leader: 'leader',
  officer: 'officer',
  member: 'member'
};

exports.GroupRole = exports.$Enums.GroupRole = {
  leader: 'leader',
  member: 'member'
};

exports.InviteStatus = exports.$Enums.InviteStatus = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected'
};

exports.TournamentStatus = exports.$Enums.TournamentStatus = {
  registration: 'registration',
  active: 'active',
  completed: 'completed'
};

exports.QuestType = exports.$Enums.QuestType = {
  main: 'main',
  daily: 'daily',
  clan: 'clan',
  lore: 'lore'
};

exports.QuestStatus = exports.$Enums.QuestStatus = {
  active: 'active',
  completed: 'completed',
  failed: 'failed'
};

exports.AdventureStatus = exports.$Enums.AdventureStatus = {
  active: 'active',
  completed: 'completed',
  failed: 'failed',
  claimed: 'claimed'
};

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  Account: 'Account',
  Class: 'Class',
  Race: 'Race',
  Skill: 'Skill',
  Dungeon: 'Dungeon',
  Enemy: 'Enemy',
  Item: 'Item',
  Material: 'Material',
  Hero: 'Hero',
  HeroSkill: 'HeroSkill',
  HeroItem: 'HeroItem',
  HeroMaterial: 'HeroMaterial',
  CombatProfile: 'CombatProfile',
  DungeonRun: 'DungeonRun',
  BazarListing: 'BazarListing',
  BazarPurchase: 'BazarPurchase',
  Clan: 'Clan',
  ClanMember: 'ClanMember',
  ClanGroup: 'ClanGroup',
  GroupMember: 'GroupMember',
  GroupInvite: 'GroupInvite',
  ClanUpgrade: 'ClanUpgrade',
  WeeklyEvent: 'WeeklyEvent',
  ClanEventParticipation: 'ClanEventParticipation',
  HeroEventParticipation: 'HeroEventParticipation',
  Tournament: 'Tournament',
  TournamentParticipant: 'TournamentParticipant',
  TournamentMatch: 'TournamentMatch',
  Quest: 'Quest',
  HeroQuest: 'HeroQuest',
  Achievement: 'Achievement',
  HeroAchievement: 'HeroAchievement',
  ForumCategory: 'ForumCategory',
  ForumTopic: 'ForumTopic',
  ForumReply: 'ForumReply',
  AttributeDefinition: 'AttributeDefinition',
  DuelHistory: 'DuelHistory',
  Notification: 'Notification',
  Faction: 'Faction',
  FactionShop: 'FactionShop',
  Adventure: 'Adventure',
  HeroAdventure: 'HeroAdventure',
  HeroFactionRep: 'HeroFactionRep'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
