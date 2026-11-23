
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime
} = require('./runtime/wasm.js')


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

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

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
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "C:\\xampp\\htdocs\\OPENCODE\\WODOS\\ironhold\\src\\generated\\prisma",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "windows",
        "native": true
      }
    ],
    "previewFeatures": [
      "driverAdapters"
    ],
    "sourceFilePath": "C:\\xampp\\htdocs\\OPENCODE\\WODOS\\ironhold\\prisma\\schema.prisma",
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null,
    "schemaEnvPath": "../../../.env"
  },
  "relativePath": "../../../prisma",
  "clientVersion": "5.22.0",
  "engineVersion": "605197351a3c8bdd595af2d2a9bc3025bca48ea2",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "generator client {\n  provider        = \"prisma-client-js\"\n  output          = \"../src/generated/prisma\"\n  previewFeatures = [\"driverAdapters\"]\n}\n\ndatasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\nmodel User {\n  id            String    @id @default(uuid())\n  email         String    @unique\n  emailVerified DateTime?\n  name          String?\n  passwordHash  String?\n  image         String?\n  isAdmin       Boolean   @default(false)\n  createdAt     DateTime  @default(now())\n  updatedAt     DateTime  @updatedAt\n  currentHeroId String?   @unique\n  maxHeroes     Int?      @default(3)\n  accounts      Account[]\n  heroes        Hero[]\n  sessions      Session[]\n  currentHero   Hero?     @relation(\"CurrentHero\", fields: [currentHeroId], references: [id])\n\n  @@map(\"users\")\n}\n\nmodel Session {\n  id           String   @id @default(uuid())\n  sessionToken String   @unique\n  userId       String\n  expires      DateTime\n  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@map(\"sessions\")\n}\n\nmodel Account {\n  id                String  @id @default(uuid())\n  userId            String\n  type              String\n  provider          String\n  providerAccountId String\n  refresh_token     String?\n  access_token      String?\n  expires_at        Int?\n  token_type        String?\n  scope             String?\n  id_token          String?\n  session_state     String?\n  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@unique([provider, providerAccountId])\n  @@map(\"accounts\")\n}\n\nmodel Class {\n  id              Int            @id @default(autoincrement())\n  name            String         @unique\n  slug            String         @unique\n  icon            String\n  tier            Int            @default(1)\n  role            ClassRole\n  position        CombatPosition\n  difficulty      Difficulty\n  description     String\n  lore            String?\n  baseAttrs       Json\n  primaryAttr     String\n  secondaryAttr   String\n  unlockCondition Json?\n  createdAt       DateTime       @default(now())\n  heroes          Hero[]\n  skills          Skill[]\n\n  @@map(\"classes\")\n}\n\nmodel Race {\n  id             Int      @id @default(autoincrement())\n  name           String   @unique\n  slug           String   @unique\n  icon           String\n  flavor         String\n  lore           String\n  attrMods       Json\n  racialTraits   Json\n  bestForClasses Int[]\n  createdAt      DateTime @default(now())\n  heroes         Hero[]\n\n  @@map(\"races\")\n}\n\nmodel Skill {\n  id              Int         @id @default(autoincrement())\n  classId         Int?\n  name            String\n  slug            String\n  icon            String\n  type            SkillType\n  tier            Int         @default(1)\n  timing          SkillTiming @default(round)\n  description     String\n  effect          String\n  epCost          Int         @default(0)\n  goldCost        Int         @default(0)\n  manaCost        Int         @default(0)\n  multiplier      Float       @default(1.0)\n  cooldownRounds  Int         @default(0)\n  requiresSkills  Int[]       @default([])\n  formula         Json?\n  tags            String[]    @default([])\n  createdAt       DateTime    @default(now())\n  attackCategory  String?\n  defenseCategory String?\n  maxRank         Int         @default(10)\n  heroSkills      HeroSkill[]\n  class           Class?      @relation(fields: [classId], references: [id])\n  raceReq         Int[]       @default([])\n\n  @@unique([classId, slug])\n  @@map(\"skills\")\n}\n\nmodel Dungeon {\n  id               Int          @id @default(autoincrement())\n  name             String\n  slug             String       @unique\n  icon             String\n  region           String\n  description      String\n  lore             String\n  levelReq         Int          @default(1)\n  recommendedLevel Int          @default(1)\n  difficulty       Int\n  difficultyLabel  String\n  scheduledTimes   Json         @default(\"[\\\"02:00\\\", \\\"06:00\\\", \\\"10:00\\\", \\\"14:00\\\", \\\"18:00\\\", \\\"22:00\\\"]\")\n  isInstant        Boolean      @default(false)\n  epReward         Int\n  goldReward       Int\n  fameReward       Int          @default(5)\n  levels           Json\n  lootTable        Json\n  isEventOnly      Boolean      @default(false)\n  createdAt        DateTime     @default(now())\n  clanId           String?      @unique\n  runs             DungeonRun[]\n  clan             Clan?        @relation(fields: [clanId], references: [id])\n\n  @@map(\"dungeons\")\n}\n\nmodel Enemy {\n  id           Int            @id @default(autoincrement())\n  name         String\n  icon         String\n  hp           Int\n  mp           Int            @default(0)\n  atk          Int\n  def          Int\n  dx           Int            @default(10)\n  ag           Int            @default(10)\n  level        Int\n  baseLevel    Int?\n  growthFactor Float?\n  position     CombatPosition\n  lootTable    Json?\n  conditions   Json?\n  ai           Json           @default(\"{\\\"type\\\": \\\"weakest\\\"}\")\n  createdAt    DateTime       @default(now())\n  damageType   String?\n  skillIds     Int[]          @default([])\n  faction      String?\n\n  @@map(\"enemies\")\n}\n\nmodel Item {\n  id            Int            @id @default(autoincrement())\n  name          String\n  slug          String         @unique\n  icon          String\n  category      ItemCategory\n  rarity        ItemRarity\n  description   String\n  stats         Json\n  classReq      Int[]\n  raceReq       Int[]          @default([])\n  levelReq      Int            @default(1)\n  attrReq       Json?\n  skillReq      Int[]          @default([])\n  runeSlots     Int            @default(0)\n  price         Int?\n  isCraftable   Boolean        @default(false)\n  recipe        Json?\n  createdAt     DateTime       @default(now())\n  slot          EquipmentSlot?\n  twoHanded     Boolean        @default(false)\n  bazarListings BazarListing[]\n  heroItems     HeroItem[]\n\n  @@map(\"items\")\n}\n\nmodel Material {\n  id            Int            @id @default(autoincrement())\n  name          String         @unique\n  icon          String\n  rarity        ItemRarity\n  description   String\n  dropSources   String[]\n  createdAt     DateTime       @default(now())\n  heroMaterials HeroMaterial[]\n\n  @@map(\"materials\")\n}\n\nmodel Hero {\n  id                       String                   @id @default(uuid())\n  userId                   String\n  name                     String\n  description              String                   @default(\"\")\n  classId                  Int\n  raceId                   Int\n  level                    Int                      @default(1)\n  epTotal                  Int                      @default(0)\n  epSpent                  Int                      @default(0)\n  gold                     Int                      @default(100)\n  fame                     Int                      @default(0)\n  attrs                    Json\n  freeAttrPoints           Int                      @default(10)\n  hpCurrent                Int                      @default(0)\n  hpMax                    Int                      @default(0)\n  mpCurrent                Int                      @default(0)\n  mpMax                    Int                      @default(0)\n  dungeonRegisteredId      String?\n  eloRating                Int                      @default(1000)\n  arenaWins                Int                      @default(0)\n  arenaLosses              Int                      @default(0)\n  adventureEnergy          Int                      @default(100)\n  adventureEnergyMax       Int                      @default(100)\n  lastEnergyRechargeAt     DateTime?\n  onboardingDone           Boolean                  @default(false)\n  pushToken                String?\n  lastLoginAt              DateTime?\n  loginStreak              Int                      @default(0)\n  createdAt                DateTime                 @default(now())\n  updatedAt                DateTime                 @updatedAt\n  inventoryMaxSize         Int                      @default(20)\n  bazarListings            BazarListing[]\n  bazarPurchases           BazarPurchase[]\n  clanMember               ClanMember?\n  combatProfiles           CombatProfile[]\n  dungeonRuns              DungeonRun[]\n  forumReplies             ForumReply[]\n  forumTopics              ForumTopic[]\n  groupInvites             GroupInvite[]\n  groupMembers             GroupMember[]\n  heroAchievements         HeroAchievement[]\n  items                    HeroItem[]\n  materials                HeroMaterial[]\n  heroQuests               HeroQuest[]\n  skills                   HeroSkill[]\n  class                    Class                    @relation(fields: [classId], references: [id])\n  race                     Race                     @relation(fields: [raceId], references: [id])\n  user                     User                     @relation(fields: [userId], references: [id], onDelete: Cascade)\n  notifications            Notification[]\n  duelHistory1             DuelHistory[]            @relation(\"DuelHero1\")\n  duelHistory2             DuelHistory[]            @relation(\"DuelHero2\")\n  duelWins                 DuelHistory[]            @relation(\"DuelWinner\")\n  tournamentParticipations TournamentParticipant[]\n  heroEventParticipations  HeroEventParticipation[]\n  factionReps              HeroFactionRep[]\n  heroAdventures           HeroAdventure[]\n  currentUser              User?                    @relation(\"CurrentHero\")\n\n  @@index([userId])\n  @@map(\"heroes\")\n}\n\nmodel HeroSkill {\n  id         String   @id @default(uuid())\n  heroId     String\n  skillId    Int\n  rank       Int      @default(1)\n  unlockedAt DateTime @default(now())\n  hero       Hero     @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  skill      Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)\n\n  @@unique([heroId, skillId])\n  @@map(\"hero_skills\")\n}\n\nmodel HeroItem {\n  id            String         @id @default(uuid())\n  heroId        String\n  itemId        Int\n  equipped      Boolean        @default(false)\n  runesIn       Json           @default(\"[]\")\n  upgradeLevel  Int            @default(0)\n  statOverrides Json           @default(\"{}\")\n  obtainedAt    DateTime       @default(now())\n  slot          EquipmentSlot?\n  bazarListing  BazarListing?\n  hero          Hero           @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  item          Item           @relation(fields: [itemId], references: [id], onDelete: Cascade)\n\n  @@map(\"hero_items\")\n}\n\nmodel HeroMaterial {\n  heroId     String\n  materialId Int\n  quantity   Int      @default(0)\n  hero       Hero     @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)\n\n  @@id([heroId, materialId])\n  @@map(\"hero_materials\")\n}\n\nmodel CombatProfile {\n  id              String         @id @default(uuid())\n  heroId          String\n  name            String         @default(\"Estándar\")\n  dungeonLevel    Int?\n  position        CombatPosition @default(front)\n  initiativeSkill String         @default(\"organization\")\n  prelimRules     Json           @default(\"[]\")\n  roundRules      Json           @default(\"[]\")\n  createdAt       DateTime       @default(now())\n  updatedAt       DateTime       @updatedAt\n  defenseSkills   Json           @default(\"{\\\"magic\\\": null, \\\"melee\\\": null, \\\"ranged\\\": null}\")\n  hero            Hero           @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@unique([heroId, dungeonLevel])\n  @@map(\"combat_profiles\")\n}\n\nmodel DungeonRun {\n  id            String     @id @default(uuid())\n  heroId        String\n  dungeonId     Int\n  profileId     String?\n  startedAt     DateTime   @default(now())\n  completesAt   DateTime?\n  registeredAt  DateTime   @default(now())\n  executedAt    DateTime?\n  status        RunStatus  @default(registered)\n  result        RunResult?\n  report        Json?\n  levelsCleared Int        @default(0)\n  epGained      Int?\n  goldGained    Int?\n  fameGained    Int?\n  loot          Json?\n  createdAt     DateTime   @default(now())\n  groupId       String?\n  levelReports  Json?\n  dungeon       Dungeon    @relation(fields: [dungeonId], references: [id])\n  group         ClanGroup? @relation(fields: [groupId], references: [id])\n  hero          Hero       @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@index([heroId, status])\n  @@index([heroId, createdAt])\n  @@index([dungeonId, status])\n  @@index([groupId])\n  @@map(\"dungeon_runs\")\n}\n\nmodel BazarListing {\n  id          String          @id @default(uuid())\n  sellerId    String\n  heroItemId  String          @unique\n  itemId      Int\n  listingType ListingType     @default(fixed)\n  price       Int\n  startPrice  Int?\n  buyNowPrice Int?\n  expiresAt   DateTime\n  status      ListingStatus   @default(active)\n  views       Int             @default(0)\n  createdAt   DateTime        @default(now())\n  heroItem    HeroItem        @relation(fields: [heroItemId], references: [id], onDelete: Cascade)\n  item        Item            @relation(fields: [itemId], references: [id], onDelete: Cascade)\n  seller      Hero            @relation(fields: [sellerId], references: [id], onDelete: Cascade)\n  purchases   BazarPurchase[]\n\n  @@index([status, expiresAt])\n  @@index([itemId, status])\n  @@map(\"bazar_listings\")\n}\n\nmodel BazarPurchase {\n  id          String       @id @default(uuid())\n  listingId   String\n  buyerId     String\n  pricePaid   Int\n  purchasedAt DateTime     @default(now())\n  buyer       Hero         @relation(fields: [buyerId], references: [id], onDelete: Cascade)\n  listing     BazarListing @relation(fields: [listingId], references: [id], onDelete: Cascade)\n\n  @@map(\"bazar_purchases\")\n}\n\nmodel Clan {\n  id               String                   @id @default(uuid())\n  name             String                   @unique\n  tag              String                   @unique\n  icon             String\n  description      String?\n  gold             Int                      @default(0)\n  fame             Int                      @default(0)\n  level            Int                      @default(1)\n  createdAt        DateTime                 @default(now())\n  updatedAt        DateTime                 @updatedAt\n  events           ClanEventParticipation[]\n  groups           ClanGroup[]\n  members          ClanMember[]\n  upgrades         ClanUpgrade[]\n  exclusiveDungeon Dungeon?\n  forumCategories  ForumCategory[]\n\n  @@map(\"clans\")\n}\n\nmodel ClanMember {\n  heroId          String     @id\n  clanId          String\n  role            ClanRole   @default(member)\n  goldContributed Int        @default(0)\n  joinedAt        DateTime   @default(now())\n  groupId         String?\n  groupRole       GroupRole?\n  clan            Clan       @relation(fields: [clanId], references: [id], onDelete: Cascade)\n  group           ClanGroup? @relation(fields: [groupId], references: [id])\n  hero            Hero       @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@index([groupId])\n  @@map(\"clan_members\")\n}\n\nmodel ClanGroup {\n  id           String        @id @default(uuid())\n  clanId       String?\n  name         String\n  icon         String        @default(\"⚔️\")\n  leaderId     String\n  createdAt    DateTime      @default(now())\n  clan         Clan?         @relation(fields: [clanId], references: [id], onDelete: Cascade)\n  members      ClanMember[]\n  dungeonRuns  DungeonRun[]\n  invites      GroupInvite[]\n  groupMembers GroupMember[]\n\n  @@unique([clanId, name])\n  @@map(\"clan_groups\")\n}\n\nmodel GroupMember {\n  id       String    @id @default(uuid())\n  groupId  String\n  heroId   String\n  role     GroupRole @default(member)\n  joinedAt DateTime  @default(now())\n  group    ClanGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)\n  hero     Hero      @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@unique([groupId, heroId])\n  @@map(\"group_members\")\n}\n\nmodel GroupInvite {\n  id        String       @id @default(uuid())\n  groupId   String\n  heroId    String\n  status    InviteStatus @default(pending)\n  createdAt DateTime     @default(now())\n  updatedAt DateTime     @updatedAt\n  group     ClanGroup    @relation(fields: [groupId], references: [id], onDelete: Cascade)\n  hero      Hero         @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@unique([groupId, heroId])\n  @@map(\"group_invites\")\n}\n\nmodel ClanUpgrade {\n  id         String   @id @default(uuid())\n  clanId     String\n  upgradeId  String\n  tier       Int      @default(1)\n  unlockedAt DateTime @default(now())\n  clan       Clan     @relation(fields: [clanId], references: [id], onDelete: Cascade)\n\n  @@unique([clanId, upgradeId])\n  @@map(\"clan_upgrades\")\n}\n\nmodel WeeklyEvent {\n  id                 String                   @id @default(uuid())\n  name               String\n  description        String\n  type               String\n  dungeonId          Int?\n  startsAt           DateTime\n  endsAt             DateTime\n  isActive           Boolean                  @default(false)\n  rewards            Json\n  createdAt          DateTime                 @default(now())\n  participations     ClanEventParticipation[]\n  heroParticipations HeroEventParticipation[]\n\n  @@index([isActive, startsAt, endsAt])\n  @@map(\"weekly_events\")\n}\n\nmodel ClanEventParticipation {\n  clanId    String\n  eventId   String\n  score     Int         @default(0)\n  updatedAt DateTime    @updatedAt\n  claimed   Boolean     @default(false)\n  clan      Clan        @relation(fields: [clanId], references: [id], onDelete: Cascade)\n  event     WeeklyEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)\n\n  @@id([clanId, eventId])\n  @@map(\"clan_event_participations\")\n}\n\nmodel HeroEventParticipation {\n  heroId    String\n  eventId   String\n  progress  Int         @default(0)\n  target    Int\n  completed Boolean     @default(false)\n  claimedAt DateTime?\n  createdAt DateTime    @default(now())\n  hero      Hero        @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  event     WeeklyEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)\n\n  @@id([heroId, eventId])\n  @@map(\"hero_event_participations\")\n}\n\nmodel Tournament {\n  id           String                  @id @default(uuid())\n  name         String\n  startsAt     DateTime\n  endsAt       DateTime\n  status       TournamentStatus        @default(registration)\n  minElo       Int                     @default(0)\n  maxPlayers   Int                     @default(8)\n  rewards      Json\n  createdAt    DateTime                @default(now())\n  matches      TournamentMatch[]\n  participants TournamentParticipant[]\n\n  @@map(\"tournaments\")\n}\n\nmodel TournamentParticipant {\n  id           String     @id @default(uuid())\n  tournamentId String\n  heroId       String\n  seed         Int\n  eliminated   Boolean    @default(false)\n  hero         Hero       @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)\n\n  @@unique([tournamentId, heroId])\n  @@map(\"tournament_participants\")\n}\n\nmodel TournamentMatch {\n  id           String     @id @default(uuid())\n  tournamentId String\n  round        Int\n  matchNumber  Int\n  hero1Id      String?\n  hero2Id      String?\n  winnerId     String?\n  log          Json?\n  playedAt     DateTime?\n  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)\n\n  @@map(\"tournament_matches\")\n}\n\nmodel Quest {\n  id           String      @id @default(uuid())\n  slug         String      @unique\n  name         String\n  type         QuestType\n  description  String\n  npcName      String\n  npcDialog    String\n  objectives   Json\n  rewards      Json\n  chainNext    String?\n  levelReq     Int         @default(1)\n  isRepeatable Boolean     @default(false)\n  resetHours   Int?\n  createdAt    DateTime    @default(now())\n  heroQuests   HeroQuest[]\n\n  @@map(\"quests\")\n}\n\nmodel HeroQuest {\n  id          String      @id @default(uuid())\n  heroId      String\n  questId     String\n  status      QuestStatus @default(active)\n  progress    Json        @default(\"{}\")\n  startedAt   DateTime    @default(now())\n  completedAt DateTime?\n  hero        Hero        @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  quest       Quest       @relation(fields: [questId], references: [id], onDelete: Cascade)\n\n  @@unique([heroId, questId])\n  @@index([heroId, status])\n  @@map(\"hero_quests\")\n}\n\nmodel Achievement {\n  id          String            @id @default(uuid())\n  slug        String            @unique\n  name        String\n  description String\n  icon        String\n  category    String\n  condition   Json\n  rewards     Json\n  order       Int               @default(0)\n  createdAt   DateTime          @default(now())\n  heroes      HeroAchievement[]\n\n  @@map(\"achievements\")\n}\n\nmodel HeroAchievement {\n  id            String      @id @default(uuid())\n  heroId        String\n  achievementId String\n  progress      Json        @default(\"{}\")\n  completed     Boolean     @default(false)\n  completedAt   DateTime?\n  createdAt     DateTime    @default(now())\n  achievement   Achievement @relation(fields: [achievementId], references: [id])\n  hero          Hero        @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@unique([heroId, achievementId])\n  @@map(\"hero_achievements\")\n}\n\nmodel ForumCategory {\n  id          String       @id @default(uuid())\n  slug        String       @unique\n  name        String\n  description String\n  icon        String\n  clanId      String?\n  order       Int          @default(0)\n  createdAt   DateTime     @default(now())\n  clan        Clan?        @relation(fields: [clanId], references: [id])\n  topics      ForumTopic[]\n\n  @@map(\"forum_categories\")\n}\n\nmodel ForumTopic {\n  id         String        @id @default(uuid())\n  categoryId String\n  authorId   String\n  title      String\n  content    String\n  isPinned   Boolean       @default(false)\n  isLocked   Boolean       @default(false)\n  createdAt  DateTime      @default(now())\n  updatedAt  DateTime      @updatedAt\n  replies    ForumReply[]\n  author     Hero          @relation(fields: [authorId], references: [id], onDelete: Cascade)\n  category   ForumCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)\n\n  @@map(\"forum_topics\")\n}\n\nmodel ForumReply {\n  id        String     @id @default(uuid())\n  topicId   String\n  authorId  String\n  content   String\n  createdAt DateTime   @default(now())\n  author    Hero       @relation(fields: [authorId], references: [id], onDelete: Cascade)\n  topic     ForumTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)\n\n  @@map(\"forum_replies\")\n}\n\nmodel AttributeDefinition {\n  id           String    @id @default(uuid())\n  name         String    @unique\n  abbreviation String    @unique\n  description  String?\n  minValue     Int       @default(1)\n  maxValue     Int       @default(100)\n  archivedAt   DateTime?\n  createdAt    DateTime  @default(now())\n  updatedAt    DateTime  @updatedAt\n\n  @@map(\"attribute_definitions\")\n}\n\nmodel DuelHistory {\n  id         String   @id @default(uuid())\n  hero1Id    String\n  hero2Id    String\n  winnerId   String\n  eloChange1 Int\n  eloChange2 Int\n  rounds     Int\n  log        Json?\n  goldCost   Int      @default(0)\n  foughtAt   DateTime @default(now())\n  hero1      Hero     @relation(\"DuelHero1\", fields: [hero1Id], references: [id], onDelete: Cascade)\n  hero2      Hero     @relation(\"DuelHero2\", fields: [hero2Id], references: [id], onDelete: Cascade)\n  winner     Hero     @relation(\"DuelWinner\", fields: [winnerId], references: [id], onDelete: Cascade)\n\n  @@index([hero1Id, foughtAt])\n  @@index([hero2Id, foughtAt])\n  @@map(\"duel_history\")\n}\n\nmodel Notification {\n  id        String    @id @default(uuid())\n  heroId    String\n  type      String\n  title     String\n  body      String\n  data      Json?\n  readAt    DateTime?\n  createdAt DateTime  @default(now())\n  hero      Hero      @relation(fields: [heroId], references: [id], onDelete: Cascade)\n\n  @@index([heroId, readAt])\n  @@map(\"notifications\")\n}\n\nenum ClassRole {\n  tank\n  dps\n  healer\n  support\n  hybrid\n}\n\nenum CombatPosition {\n  front\n  center\n  rear\n  left_flank\n  right_flank\n  flexible\n}\n\nenum Difficulty {\n  beginner\n  intermediate\n  advanced\n}\n\nenum SkillTiming {\n  pre_round\n  round\n  both\n  passive\n}\n\nenum SkillType {\n  active\n  passive\n  basic\n}\n\nenum ItemCategory {\n  weapon\n  armor\n  accessory\n  consumable\n  rune\n  material\n}\n\nenum EquipmentSlot {\n  head\n  face\n  neck\n  shoulders\n  back\n  chest\n  arms\n  hands\n  mainHand\n  offHand\n  belt\n  legs\n  feet\n  backpack\n}\n\nenum ItemRarity {\n  common\n  uncommon\n  rare\n  epic\n  unique\n}\n\nenum RunStatus {\n  registered\n  running\n  done\n  failed\n}\n\nenum RunResult {\n  victory\n  defeat\n}\n\nenum ListingType {\n  fixed\n  auction\n}\n\nenum ListingStatus {\n  active\n  sold\n  expired\n  cancelled\n}\n\nenum InviteStatus {\n  pending\n  accepted\n  rejected\n}\n\nenum ClanRole {\n  leader\n  officer\n  member\n}\n\nenum GroupRole {\n  leader\n  member\n}\n\nenum TournamentStatus {\n  registration\n  active\n  completed\n}\n\nenum QuestType {\n  main\n  daily\n  clan\n  lore\n}\n\nenum QuestStatus {\n  active\n  completed\n  failed\n}\n\nmodel Faction {\n  id          Int              @id @default(autoincrement())\n  slug        String           @unique\n  name        String\n  description String\n  icon        String\n  color       String           @default(\"#6B7280\")\n  createdAt   DateTime         @default(now())\n  shops       FactionShop[]\n  adventures  Adventure[]\n  heroReps    HeroFactionRep[]\n\n  @@map(\"factions\")\n}\n\nmodel FactionShop {\n  id        Int      @id @default(autoincrement())\n  factionId Int\n  name      String\n  icon      String\n  minRep    Int      @default(0)\n  items     Json\n  createdAt DateTime @default(now())\n  faction   Faction  @relation(fields: [factionId], references: [id], onDelete: Cascade)\n\n  @@map(\"faction_shops\")\n}\n\nmodel Adventure {\n  id             Int             @id @default(autoincrement())\n  name           String\n  slug           String          @unique\n  icon           String\n  description    String\n  lore           String?\n  levelReq       Int             @default(1)\n  maxLevel       Int             @default(999)\n  duration       Int             @default(30)\n  energyCost     Int             @default(10)\n  steps          Json\n  rewards        Json\n  factionId      Int?\n  factionRep     Int             @default(0)\n  isActive       Boolean         @default(true)\n  minGoldReward  Int             @default(0)\n  maxGoldReward  Int             @default(50)\n  epReward       Int             @default(20)\n  fameReward     Int             @default(2)\n  createdAt      DateTime        @default(now())\n  updatedAt      DateTime        @updatedAt\n  faction        Faction?        @relation(fields: [factionId], references: [id])\n  heroAdventures HeroAdventure[]\n\n  @@map(\"adventures\")\n}\n\nmodel HeroAdventure {\n  id          String          @id @default(uuid())\n  heroId      String\n  adventureId Int\n  status      AdventureStatus @default(active)\n  currentStep Int             @default(0)\n  totalSteps  Int             @default(1)\n  startedAt   DateTime        @default(now())\n  completedAt DateTime?\n  energySpent Int             @default(0)\n  result      Json?\n  hero        Hero            @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  adventure   Adventure       @relation(fields: [adventureId], references: [id])\n\n  @@index([heroId, status])\n  @@index([heroId, adventureId])\n  @@map(\"hero_adventures\")\n}\n\nenum AdventureStatus {\n  active\n  completed\n  failed\n  claimed\n}\n\nmodel HeroFactionRep {\n  heroId    String\n  factionId Int\n  rep       Int      @default(0)\n  title     String?\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  hero      Hero     @relation(fields: [heroId], references: [id], onDelete: Cascade)\n  faction   Faction  @relation(fields: [factionId], references: [id], onDelete: Cascade)\n\n  @@id([heroId, factionId])\n  @@map(\"hero_faction_reps\")\n}\n",
  "inlineSchemaHash": "257126d57553be66840860c2146fa81670aabe2c5e7aad3ad236e9748cb3d6eb",
  "copyEngine": true
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"emailVerified\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"passwordHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"image\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"isAdmin\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"currentHeroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"maxHeroes\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"accounts\",\"kind\":\"object\",\"type\":\"Account\",\"relationName\":\"AccountToUser\"},{\"name\":\"heroes\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToUser\"},{\"name\":\"sessions\",\"kind\":\"object\",\"type\":\"Session\",\"relationName\":\"SessionToUser\"},{\"name\":\"currentHero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"CurrentHero\"}],\"dbName\":\"users\"},\"Session\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"sessionToken\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"expires\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"SessionToUser\"}],\"dbName\":\"sessions\"},\"Account\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"provider\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"providerAccountId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"refresh_token\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"access_token\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"expires_at\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"token_type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"scope\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"id_token\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"session_state\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"AccountToUser\"}],\"dbName\":\"accounts\"},\"Class\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tier\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"ClassRole\"},{\"name\":\"position\",\"kind\":\"enum\",\"type\":\"CombatPosition\"},{\"name\":\"difficulty\",\"kind\":\"enum\",\"type\":\"Difficulty\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"lore\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"baseAttrs\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"primaryAttr\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"secondaryAttr\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"unlockCondition\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroes\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"ClassToHero\"},{\"name\":\"skills\",\"kind\":\"object\",\"type\":\"Skill\",\"relationName\":\"ClassToSkill\"}],\"dbName\":\"classes\"},\"Race\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"flavor\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"lore\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"attrMods\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"racialTraits\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"bestForClasses\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroes\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToRace\"}],\"dbName\":\"races\"},\"Skill\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"classId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"SkillType\"},{\"name\":\"tier\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"timing\",\"kind\":\"enum\",\"type\":\"SkillTiming\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"effect\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"epCost\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"goldCost\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"manaCost\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"multiplier\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"cooldownRounds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"requiresSkills\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"formula\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"tags\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"attackCategory\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"defenseCategory\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"maxRank\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"heroSkills\",\"kind\":\"object\",\"type\":\"HeroSkill\",\"relationName\":\"HeroSkillToSkill\"},{\"name\":\"class\",\"kind\":\"object\",\"type\":\"Class\",\"relationName\":\"ClassToSkill\"},{\"name\":\"raceReq\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":\"skills\"},\"Dungeon\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"region\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"lore\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"levelReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"recommendedLevel\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"difficulty\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"difficultyLabel\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"scheduledTimes\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"isInstant\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"epReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"goldReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"fameReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"levels\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"lootTable\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"isEventOnly\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"runs\",\"kind\":\"object\",\"type\":\"DungeonRun\",\"relationName\":\"DungeonToDungeonRun\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToDungeon\"}],\"dbName\":\"dungeons\"},\"Enemy\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"hp\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"mp\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"atk\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"def\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"dx\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"ag\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"level\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"baseLevel\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"growthFactor\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"position\",\"kind\":\"enum\",\"type\":\"CombatPosition\"},{\"name\":\"lootTable\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"conditions\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"ai\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"damageType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"skillIds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"faction\",\"kind\":\"scalar\",\"type\":\"String\"}],\"dbName\":\"enemies\"},\"Item\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"category\",\"kind\":\"enum\",\"type\":\"ItemCategory\"},{\"name\":\"rarity\",\"kind\":\"enum\",\"type\":\"ItemRarity\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"stats\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"classReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"raceReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"levelReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"attrReq\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"skillReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"runeSlots\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"price\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"isCraftable\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"recipe\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"slot\",\"kind\":\"enum\",\"type\":\"EquipmentSlot\"},{\"name\":\"twoHanded\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"bazarListings\",\"kind\":\"object\",\"type\":\"BazarListing\",\"relationName\":\"BazarListingToItem\"},{\"name\":\"heroItems\",\"kind\":\"object\",\"type\":\"HeroItem\",\"relationName\":\"HeroItemToItem\"}],\"dbName\":\"items\"},\"Material\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"rarity\",\"kind\":\"enum\",\"type\":\"ItemRarity\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"dropSources\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroMaterials\",\"kind\":\"object\",\"type\":\"HeroMaterial\",\"relationName\":\"HeroMaterialToMaterial\"}],\"dbName\":\"materials\"},\"Hero\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"classId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"raceId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"level\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"epTotal\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"epSpent\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"gold\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"fame\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"attrs\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"freeAttrPoints\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"hpCurrent\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"hpMax\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"mpCurrent\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"mpMax\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"dungeonRegisteredId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eloRating\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"arenaWins\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"arenaLosses\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"adventureEnergy\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"adventureEnergyMax\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"lastEnergyRechargeAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"onboardingDone\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"pushToken\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"lastLoginAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"loginStreak\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"inventoryMaxSize\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"bazarListings\",\"kind\":\"object\",\"type\":\"BazarListing\",\"relationName\":\"BazarListingToHero\"},{\"name\":\"bazarPurchases\",\"kind\":\"object\",\"type\":\"BazarPurchase\",\"relationName\":\"BazarPurchaseToHero\"},{\"name\":\"clanMember\",\"kind\":\"object\",\"type\":\"ClanMember\",\"relationName\":\"ClanMemberToHero\"},{\"name\":\"combatProfiles\",\"kind\":\"object\",\"type\":\"CombatProfile\",\"relationName\":\"CombatProfileToHero\"},{\"name\":\"dungeonRuns\",\"kind\":\"object\",\"type\":\"DungeonRun\",\"relationName\":\"DungeonRunToHero\"},{\"name\":\"forumReplies\",\"kind\":\"object\",\"type\":\"ForumReply\",\"relationName\":\"ForumReplyToHero\"},{\"name\":\"forumTopics\",\"kind\":\"object\",\"type\":\"ForumTopic\",\"relationName\":\"ForumTopicToHero\"},{\"name\":\"groupInvites\",\"kind\":\"object\",\"type\":\"GroupInvite\",\"relationName\":\"GroupInviteToHero\"},{\"name\":\"groupMembers\",\"kind\":\"object\",\"type\":\"GroupMember\",\"relationName\":\"GroupMemberToHero\"},{\"name\":\"heroAchievements\",\"kind\":\"object\",\"type\":\"HeroAchievement\",\"relationName\":\"HeroToHeroAchievement\"},{\"name\":\"items\",\"kind\":\"object\",\"type\":\"HeroItem\",\"relationName\":\"HeroToHeroItem\"},{\"name\":\"materials\",\"kind\":\"object\",\"type\":\"HeroMaterial\",\"relationName\":\"HeroToHeroMaterial\"},{\"name\":\"heroQuests\",\"kind\":\"object\",\"type\":\"HeroQuest\",\"relationName\":\"HeroToHeroQuest\"},{\"name\":\"skills\",\"kind\":\"object\",\"type\":\"HeroSkill\",\"relationName\":\"HeroToHeroSkill\"},{\"name\":\"class\",\"kind\":\"object\",\"type\":\"Class\",\"relationName\":\"ClassToHero\"},{\"name\":\"race\",\"kind\":\"object\",\"type\":\"Race\",\"relationName\":\"HeroToRace\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"HeroToUser\"},{\"name\":\"notifications\",\"kind\":\"object\",\"type\":\"Notification\",\"relationName\":\"HeroToNotification\"},{\"name\":\"duelHistory1\",\"kind\":\"object\",\"type\":\"DuelHistory\",\"relationName\":\"DuelHero1\"},{\"name\":\"duelHistory2\",\"kind\":\"object\",\"type\":\"DuelHistory\",\"relationName\":\"DuelHero2\"},{\"name\":\"duelWins\",\"kind\":\"object\",\"type\":\"DuelHistory\",\"relationName\":\"DuelWinner\"},{\"name\":\"tournamentParticipations\",\"kind\":\"object\",\"type\":\"TournamentParticipant\",\"relationName\":\"HeroToTournamentParticipant\"},{\"name\":\"heroEventParticipations\",\"kind\":\"object\",\"type\":\"HeroEventParticipation\",\"relationName\":\"HeroToHeroEventParticipation\"},{\"name\":\"factionReps\",\"kind\":\"object\",\"type\":\"HeroFactionRep\",\"relationName\":\"HeroToHeroFactionRep\"},{\"name\":\"heroAdventures\",\"kind\":\"object\",\"type\":\"HeroAdventure\",\"relationName\":\"HeroToHeroAdventure\"},{\"name\":\"currentUser\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"CurrentHero\"}],\"dbName\":\"heroes\"},\"HeroSkill\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"skillId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"rank\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"unlockedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroSkill\"},{\"name\":\"skill\",\"kind\":\"object\",\"type\":\"Skill\",\"relationName\":\"HeroSkillToSkill\"}],\"dbName\":\"hero_skills\"},\"HeroItem\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"itemId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"equipped\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"runesIn\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"upgradeLevel\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"statOverrides\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"obtainedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"slot\",\"kind\":\"enum\",\"type\":\"EquipmentSlot\"},{\"name\":\"bazarListing\",\"kind\":\"object\",\"type\":\"BazarListing\",\"relationName\":\"BazarListingToHeroItem\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroItem\"},{\"name\":\"item\",\"kind\":\"object\",\"type\":\"Item\",\"relationName\":\"HeroItemToItem\"}],\"dbName\":\"hero_items\"},\"HeroMaterial\":{\"fields\":[{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"materialId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"quantity\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroMaterial\"},{\"name\":\"material\",\"kind\":\"object\",\"type\":\"Material\",\"relationName\":\"HeroMaterialToMaterial\"}],\"dbName\":\"hero_materials\"},\"CombatProfile\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"dungeonLevel\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"position\",\"kind\":\"enum\",\"type\":\"CombatPosition\"},{\"name\":\"initiativeSkill\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"prelimRules\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"roundRules\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"defenseSkills\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"CombatProfileToHero\"}],\"dbName\":\"combat_profiles\"},\"DungeonRun\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"dungeonId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"profileId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"completesAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"registeredAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"executedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"RunStatus\"},{\"name\":\"result\",\"kind\":\"enum\",\"type\":\"RunResult\"},{\"name\":\"report\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"levelsCleared\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"epGained\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"goldGained\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"fameGained\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"loot\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"groupId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"levelReports\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"dungeon\",\"kind\":\"object\",\"type\":\"Dungeon\",\"relationName\":\"DungeonToDungeonRun\"},{\"name\":\"group\",\"kind\":\"object\",\"type\":\"ClanGroup\",\"relationName\":\"ClanGroupToDungeonRun\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"DungeonRunToHero\"}],\"dbName\":\"dungeon_runs\"},\"BazarListing\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"sellerId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroItemId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"itemId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"listingType\",\"kind\":\"enum\",\"type\":\"ListingType\"},{\"name\":\"price\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startPrice\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"buyNowPrice\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"expiresAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"ListingStatus\"},{\"name\":\"views\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroItem\",\"kind\":\"object\",\"type\":\"HeroItem\",\"relationName\":\"BazarListingToHeroItem\"},{\"name\":\"item\",\"kind\":\"object\",\"type\":\"Item\",\"relationName\":\"BazarListingToItem\"},{\"name\":\"seller\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"BazarListingToHero\"},{\"name\":\"purchases\",\"kind\":\"object\",\"type\":\"BazarPurchase\",\"relationName\":\"BazarListingToBazarPurchase\"}],\"dbName\":\"bazar_listings\"},\"BazarPurchase\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"listingId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"buyerId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"pricePaid\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"purchasedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"buyer\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"BazarPurchaseToHero\"},{\"name\":\"listing\",\"kind\":\"object\",\"type\":\"BazarListing\",\"relationName\":\"BazarListingToBazarPurchase\"}],\"dbName\":\"bazar_purchases\"},\"Clan\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tag\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"gold\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"fame\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"level\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"ClanEventParticipation\",\"relationName\":\"ClanToClanEventParticipation\"},{\"name\":\"groups\",\"kind\":\"object\",\"type\":\"ClanGroup\",\"relationName\":\"ClanToClanGroup\"},{\"name\":\"members\",\"kind\":\"object\",\"type\":\"ClanMember\",\"relationName\":\"ClanToClanMember\"},{\"name\":\"upgrades\",\"kind\":\"object\",\"type\":\"ClanUpgrade\",\"relationName\":\"ClanToClanUpgrade\"},{\"name\":\"exclusiveDungeon\",\"kind\":\"object\",\"type\":\"Dungeon\",\"relationName\":\"ClanToDungeon\"},{\"name\":\"forumCategories\",\"kind\":\"object\",\"type\":\"ForumCategory\",\"relationName\":\"ClanToForumCategory\"}],\"dbName\":\"clans\"},\"ClanMember\":{\"fields\":[{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"ClanRole\"},{\"name\":\"goldContributed\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"joinedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"groupId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"groupRole\",\"kind\":\"enum\",\"type\":\"GroupRole\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToClanMember\"},{\"name\":\"group\",\"kind\":\"object\",\"type\":\"ClanGroup\",\"relationName\":\"ClanGroupToClanMember\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"ClanMemberToHero\"}],\"dbName\":\"clan_members\"},\"ClanGroup\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"leaderId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToClanGroup\"},{\"name\":\"members\",\"kind\":\"object\",\"type\":\"ClanMember\",\"relationName\":\"ClanGroupToClanMember\"},{\"name\":\"dungeonRuns\",\"kind\":\"object\",\"type\":\"DungeonRun\",\"relationName\":\"ClanGroupToDungeonRun\"},{\"name\":\"invites\",\"kind\":\"object\",\"type\":\"GroupInvite\",\"relationName\":\"ClanGroupToGroupInvite\"},{\"name\":\"groupMembers\",\"kind\":\"object\",\"type\":\"GroupMember\",\"relationName\":\"ClanGroupToGroupMember\"}],\"dbName\":\"clan_groups\"},\"GroupMember\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"groupId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"GroupRole\"},{\"name\":\"joinedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"group\",\"kind\":\"object\",\"type\":\"ClanGroup\",\"relationName\":\"ClanGroupToGroupMember\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"GroupMemberToHero\"}],\"dbName\":\"group_members\"},\"GroupInvite\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"groupId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"InviteStatus\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"group\",\"kind\":\"object\",\"type\":\"ClanGroup\",\"relationName\":\"ClanGroupToGroupInvite\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"GroupInviteToHero\"}],\"dbName\":\"group_invites\"},\"ClanUpgrade\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"upgradeId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tier\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"unlockedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToClanUpgrade\"}],\"dbName\":\"clan_upgrades\"},\"WeeklyEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"dungeonId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startsAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"endsAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"rewards\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"participations\",\"kind\":\"object\",\"type\":\"ClanEventParticipation\",\"relationName\":\"ClanEventParticipationToWeeklyEvent\"},{\"name\":\"heroParticipations\",\"kind\":\"object\",\"type\":\"HeroEventParticipation\",\"relationName\":\"HeroEventParticipationToWeeklyEvent\"}],\"dbName\":\"weekly_events\"},\"ClanEventParticipation\":{\"fields\":[{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eventId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"score\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"claimed\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToClanEventParticipation\"},{\"name\":\"event\",\"kind\":\"object\",\"type\":\"WeeklyEvent\",\"relationName\":\"ClanEventParticipationToWeeklyEvent\"}],\"dbName\":\"clan_event_participations\"},\"HeroEventParticipation\":{\"fields\":[{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eventId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"progress\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"target\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"completed\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"claimedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroEventParticipation\"},{\"name\":\"event\",\"kind\":\"object\",\"type\":\"WeeklyEvent\",\"relationName\":\"HeroEventParticipationToWeeklyEvent\"}],\"dbName\":\"hero_event_participations\"},\"Tournament\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"startsAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"endsAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"TournamentStatus\"},{\"name\":\"minElo\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"maxPlayers\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"rewards\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"matches\",\"kind\":\"object\",\"type\":\"TournamentMatch\",\"relationName\":\"TournamentToTournamentMatch\"},{\"name\":\"participants\",\"kind\":\"object\",\"type\":\"TournamentParticipant\",\"relationName\":\"TournamentToTournamentParticipant\"}],\"dbName\":\"tournaments\"},\"TournamentParticipant\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tournamentId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"seed\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"eliminated\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToTournamentParticipant\"},{\"name\":\"tournament\",\"kind\":\"object\",\"type\":\"Tournament\",\"relationName\":\"TournamentToTournamentParticipant\"}],\"dbName\":\"tournament_participants\"},\"TournamentMatch\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"tournamentId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"round\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"matchNumber\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"hero1Id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"hero2Id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"winnerId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"log\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"playedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"tournament\",\"kind\":\"object\",\"type\":\"Tournament\",\"relationName\":\"TournamentToTournamentMatch\"}],\"dbName\":\"tournament_matches\"},\"Quest\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"QuestType\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"npcName\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"npcDialog\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"objectives\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"rewards\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"chainNext\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"levelReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"isRepeatable\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"resetHours\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroQuests\",\"kind\":\"object\",\"type\":\"HeroQuest\",\"relationName\":\"HeroQuestToQuest\"}],\"dbName\":\"quests\"},\"HeroQuest\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"questId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"QuestStatus\"},{\"name\":\"progress\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"completedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroQuest\"},{\"name\":\"quest\",\"kind\":\"object\",\"type\":\"Quest\",\"relationName\":\"HeroQuestToQuest\"}],\"dbName\":\"hero_quests\"},\"Achievement\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"category\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"condition\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"rewards\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"order\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"heroes\",\"kind\":\"object\",\"type\":\"HeroAchievement\",\"relationName\":\"AchievementToHeroAchievement\"}],\"dbName\":\"achievements\"},\"HeroAchievement\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"achievementId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"progress\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"completed\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"completedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"achievement\",\"kind\":\"object\",\"type\":\"Achievement\",\"relationName\":\"AchievementToHeroAchievement\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroAchievement\"}],\"dbName\":\"hero_achievements\"},\"ForumCategory\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"clanId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"order\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"clan\",\"kind\":\"object\",\"type\":\"Clan\",\"relationName\":\"ClanToForumCategory\"},{\"name\":\"topics\",\"kind\":\"object\",\"type\":\"ForumTopic\",\"relationName\":\"ForumCategoryToForumTopic\"}],\"dbName\":\"forum_categories\"},\"ForumTopic\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"categoryId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"authorId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"content\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"isPinned\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"isLocked\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"replies\",\"kind\":\"object\",\"type\":\"ForumReply\",\"relationName\":\"ForumReplyToForumTopic\"},{\"name\":\"author\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"ForumTopicToHero\"},{\"name\":\"category\",\"kind\":\"object\",\"type\":\"ForumCategory\",\"relationName\":\"ForumCategoryToForumTopic\"}],\"dbName\":\"forum_topics\"},\"ForumReply\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"topicId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"authorId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"content\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"author\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"ForumReplyToHero\"},{\"name\":\"topic\",\"kind\":\"object\",\"type\":\"ForumTopic\",\"relationName\":\"ForumReplyToForumTopic\"}],\"dbName\":\"forum_replies\"},\"AttributeDefinition\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"abbreviation\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"minValue\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"maxValue\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"archivedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":\"attribute_definitions\"},\"DuelHistory\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"hero1Id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"hero2Id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"winnerId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eloChange1\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"eloChange2\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"rounds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"log\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"goldCost\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"foughtAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero1\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"DuelHero1\"},{\"name\":\"hero2\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"DuelHero2\"},{\"name\":\"winner\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"DuelWinner\"}],\"dbName\":\"duel_history\"},\"Notification\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"body\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"data\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"readAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToNotification\"}],\"dbName\":\"notifications\"},\"Faction\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"color\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"shops\",\"kind\":\"object\",\"type\":\"FactionShop\",\"relationName\":\"FactionToFactionShop\"},{\"name\":\"adventures\",\"kind\":\"object\",\"type\":\"Adventure\",\"relationName\":\"AdventureToFaction\"},{\"name\":\"heroReps\",\"kind\":\"object\",\"type\":\"HeroFactionRep\",\"relationName\":\"FactionToHeroFactionRep\"}],\"dbName\":\"factions\"},\"FactionShop\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"factionId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"minRep\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"items\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"faction\",\"kind\":\"object\",\"type\":\"Faction\",\"relationName\":\"FactionToFactionShop\"}],\"dbName\":\"faction_shops\"},\"Adventure\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"slug\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"icon\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"lore\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"levelReq\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"maxLevel\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"duration\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"energyCost\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"steps\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"rewards\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"factionId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"factionRep\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"minGoldReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"maxGoldReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"epReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"fameReward\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"faction\",\"kind\":\"object\",\"type\":\"Faction\",\"relationName\":\"AdventureToFaction\"},{\"name\":\"heroAdventures\",\"kind\":\"object\",\"type\":\"HeroAdventure\",\"relationName\":\"AdventureToHeroAdventure\"}],\"dbName\":\"adventures\"},\"HeroAdventure\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"adventureId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"AdventureStatus\"},{\"name\":\"currentStep\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"totalSteps\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"completedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"energySpent\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"result\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroAdventure\"},{\"name\":\"adventure\",\"kind\":\"object\",\"type\":\"Adventure\",\"relationName\":\"AdventureToHeroAdventure\"}],\"dbName\":\"hero_adventures\"},\"HeroFactionRep\":{\"fields\":[{\"name\":\"heroId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"factionId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"rep\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"hero\",\"kind\":\"object\",\"type\":\"Hero\",\"relationName\":\"HeroToHeroFactionRep\"},{\"name\":\"faction\",\"kind\":\"object\",\"type\":\"Faction\",\"relationName\":\"FactionToHeroFactionRep\"}],\"dbName\":\"hero_faction_reps\"}},\"enums\":{},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine 
  }
}

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

