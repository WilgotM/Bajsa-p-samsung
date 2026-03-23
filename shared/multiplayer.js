export const LOBBY_IDS = ["solo", "main", "secondary"];
export const PLAYER_NAME_MAX_LENGTH = 18;
export const MAX_SKIN_DATA_URL_LENGTH = 120_000;

export const LOBBY_LABELS = {
  solo: "Solo-lobby",
  main: "Huvudlobby",
  secondary: "Sekundär lobby",
};

export const ARENA_RADIUS = 66;
export const MAX_PLAYERS_PER_LOBBY = 8;
export const MIN_PLAYERS_TO_START = 1;
export const REMOTE_INTERPOLATION_BACKTIME_MS = 100;
export const POSE_SEND_INTERVAL_MS = 1000 / 15;
export const HEARTBEAT_INTERVAL_MS = 250;
export const MAX_PACKET_TELEPORT_DISTANCE = 4;
export const PLAYER_MIN_Y = -2;
export const PLAYER_MAX_Y = 12;
export const COUNTDOWN_DURATION_MS = 10_000;
export const BUS_FLIGHT_DURATION_MS = 28_000;
export const BUS_DOORS_OPEN_OFFSET_MS = 2_500;
export const BUS_AUTO_DROP_OFFSET_MS = 24_000;
export const ROUND_ACTIVE_DURATION_MS = 180_000;
export const ROUND_OVERTIME_DURATION_MS = 20_000;
export const ROUND_RESULTS_DURATION_MS = 8_000;
export const PLAYER_RESPAWN_DELAY_MS = 2_500;
export const PLAYER_LIVES = 3;
export const WEAPON_SLOT_COUNT = 3;
export const TOILET_SEARCH_DURATION_MS = 850;
export const TOILET_INTERACT_RANGE = 4.6;
export const GROUND_LOOT_PICKUP_RANGE = 3.6;
export const POOP_SCORE_METERS_PER_SECOND = 2.88;
export const PHONE_PRESSURE_NEARBY_OUTER_RADIUS = 9.2;
export const PHONE_PRESSURE_NEARBY_INNER_RADIUS = 2.8;
export const PHONE_PRESSURE_NEARBY_MAX = 0.4;
export const PHONE_HEMORRHOIDS_ON_PHONE_PER_SECOND = 17;
export const PHONE_HEMORRHOIDS_NEARBY_BASE_PER_SECOND = 2;
export const PHONE_HEMORRHOIDS_NEARBY_EXTRA_PER_SECOND = 9;
export const PHONE_STAND_BOUNDS = Object.freeze({
  halfX: 3.1 * 0.49,
  halfZ: 6.8 * 0.49,
});

export const MATCH_PHASES = Object.freeze({
  staging: "staging",
  countdown: "countdown",
  bus: "bus",
  glide: "glide",
  active: "active",
  overtime: "overtime",
  results: "results",
});

export const PLAYER_STATES = Object.freeze({
  staging: MATCH_PHASES.staging,
  bus: MATCH_PHASES.bus,
  glide: MATCH_PHASES.glide,
  active: MATCH_PHASES.active,
  spectating: "spectating",
  eliminated: "eliminated",
});

export const ROUND_END_REASONS = Object.freeze({
  lastPlayer: "last-player",
  time: "time",
  overtime: "overtime",
  samsungSurvived: "samsung-survived",
  soloLoss: "solo-loss",
});

export const ROUND_EVENT_KINDS = Object.freeze({
  playerDied: "player-died",
  playerRespawned: "player-respawned",
  playerEliminated: "player-eliminated",
  overtimeStarted: "overtime-started",
  matchEnded: "match-ended",
});

export const PLAYER_SPAWN = Object.freeze({
  x: 0,
  y: 0,
  z: 17.8,
  yaw: Math.PI,
});

export const STAGING_SPAWN = Object.freeze({
  x: 0,
  y: 6.4,
  z: 88,
  yaw: Math.PI,
});

export const BUS_ROUTE = Object.freeze({
  start: Object.freeze({
    x: -88,
    y: 28,
    z: 34,
  }),
  end: Object.freeze({
    x: 88,
    y: 28,
    z: -24,
  }),
});

export const ACTION_KINDS = Object.freeze({
  poopStart: "poop-start",
  poopStop: "poop-stop",
  strike: "strike",
});

export const INTERACT_KINDS = Object.freeze({
  searchStart: "search-start",
  searchCancel: "search-cancel",
  pickupGroundLoot: "pickup-ground-loot",
});

export const COMBAT_EVENT_KINDS = Object.freeze({
  weaponFired: "weapon-fired",
  weaponHit: "weapon-hit",
  playerEliminated: "player-eliminated",
});

export const WORLD_EVENT_KINDS = Object.freeze({
  targetHit: "target-hit",
  playerHit: "player-hit",
});

export const WEAPON_TYPES = Object.freeze({
  assaultRifle: "assault-rifle",
  shotgun: "pump-shotgun",
  smg: "smg",
});

export const WEAPON_RARITIES = Object.freeze({
  gray: "gray",
  green: "green",
  blue: "blue",
  purple: "purple",
});

export const WEAPON_RARITY_ORDER = Object.freeze([
  WEAPON_RARITIES.gray,
  WEAPON_RARITIES.green,
  WEAPON_RARITIES.blue,
  WEAPON_RARITIES.purple,
]);

export const WEAPON_RARITY_COLORS = Object.freeze({
  [WEAPON_RARITIES.gray]: "#8b939d",
  [WEAPON_RARITIES.green]: "#4caf50",
  [WEAPON_RARITIES.blue]: "#2f89ff",
  [WEAPON_RARITIES.purple]: "#b25cff",
});

export const WEAPON_TYPE_LABELS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: "ASSAULT RIFLE",
  [WEAPON_TYPES.shotgun]: "PUMP SHOTGUN",
  [WEAPON_TYPES.smg]: "SMG",
});

export const WEAPON_DEFINITIONS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: Object.freeze({
    fireRate: 6.5,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 22,
      [WEAPON_RARITIES.green]: 24,
      [WEAPON_RARITIES.blue]: 26,
      [WEAPON_RARITIES.purple]: 28,
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.038,
      [WEAPON_RARITIES.green]: 0.034,
      [WEAPON_RARITIES.blue]: 0.03,
      [WEAPON_RARITIES.purple]: 0.026,
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.014,
      [WEAPON_RARITIES.green]: 0.013,
      [WEAPON_RARITIES.blue]: 0.012,
      [WEAPON_RARITIES.purple]: 0.011,
    }),
    maxRange: 78,
    impactScale: 1,
    pellets: 1,
  }),
  [WEAPON_TYPES.shotgun]: Object.freeze({
    fireRate: 0.85,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 12,
      [WEAPON_RARITIES.green]: 13,
      [WEAPON_RARITIES.blue]: 14,
      [WEAPON_RARITIES.purple]: 15,
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.12,
      [WEAPON_RARITIES.green]: 0.112,
      [WEAPON_RARITIES.blue]: 0.104,
      [WEAPON_RARITIES.purple]: 0.096,
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.028,
      [WEAPON_RARITIES.green]: 0.026,
      [WEAPON_RARITIES.blue]: 0.024,
      [WEAPON_RARITIES.purple]: 0.022,
    }),
    maxRange: 22,
    impactScale: 1.25,
    pellets: 8,
  }),
  [WEAPON_TYPES.smg]: Object.freeze({
    fireRate: 10.5,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 15,
      [WEAPON_RARITIES.green]: 16,
      [WEAPON_RARITIES.blue]: 17,
      [WEAPON_RARITIES.purple]: 18,
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.05,
      [WEAPON_RARITIES.green]: 0.046,
      [WEAPON_RARITIES.blue]: 0.042,
      [WEAPON_RARITIES.purple]: 0.038,
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.012,
      [WEAPON_RARITIES.green]: 0.011,
      [WEAPON_RARITIES.blue]: 0.01,
      [WEAPON_RARITIES.purple]: 0.009,
    }),
    maxRange: 46,
    impactScale: 0.92,
    pellets: 1,
  }),
});

export const WEAPON_RARITY_WEIGHTS = Object.freeze({
  [WEAPON_RARITIES.gray]: 46,
  [WEAPON_RARITIES.green]: 30,
  [WEAPON_RARITIES.blue]: 17,
  [WEAPON_RARITIES.purple]: 7,
});

export const WEAPON_TYPE_WEIGHTS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: 45,
  [WEAPON_TYPES.smg]: 35,
  [WEAPON_TYPES.shotgun]: 20,
});

export const TOILET_SPAWNS = Object.freeze([
  Object.freeze({ id: "toilet-town-west-shop", x: -26.8, y: 0, z: 40.6, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-east-shop", x: 26.8, y: 0, z: 40.6, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-northwest-house", x: -16.6, y: 0, z: 57.2, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-northeast-house", x: 16.6, y: 0, z: 57.2, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-forest-connector", x: 0, y: 0, z: -39.5, yaw: 0 }),
  Object.freeze({ id: "toilet-desert-roadside", x: 40, y: 0, z: -6, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-snow-roadside", x: -40, y: 0, z: -5.4, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-south-town-connector", x: 0, y: 0, z: 40.4, yaw: Math.PI }),
]);

export const PLAYER_COLOR_PALETTE = [
  "#d9823f",
  "#d85d4c",
  "#5e8fc8",
  "#64a66d",
  "#b279bf",
  "#cfb06d",
  "#7d8da1",
  "#d96f8d",
];

export const GUEST_PREFIXES = [
  "Rostig",
  "Sunkig",
  "Bister",
  "Skum",
  "Lurig",
  "Vresig",
  "Dimmig",
  "Seg",
];

export const GUEST_SUFFIXES = [
  "Rökare",
  "Gubbe",
  "Typ",
  "Lirare",
  "Vandrare",
  "Legend",
  "Kuf",
  "Kisare",
];

export function getSpawnForPhase(phase = MATCH_PHASES.active) {
  if (phase === MATCH_PHASES.staging || phase === MATCH_PHASES.countdown) {
    return STAGING_SPAWN;
  }

  return PLAYER_SPAWN;
}

export function createSpawnPose(phase = MATCH_PHASES.active) {
  const spawn = getSpawnForPhase(phase);
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    moveAmount: 0,
  };
}

export function createActionState() {
  return {
    poopActive: false,
    strikeAt: 0,
  };
}

export function createEmptyLoadout() {
  return Array.from({ length: WEAPON_SLOT_COUNT }, () => null);
}

export function createMatchState() {
  return {
    phase: MATCH_PHASES.staging,
    countdownEndsAt: null,
    busStartedAt: null,
    doorsOpenAt: null,
    autoDropAt: null,
    busEndsAt: null,
    activeStartedAt: null,
    activeEndsAt: null,
    overtimeEndsAt: null,
    resultsEndsAt: null,
    remainingContenders: 0,
    winnerPlayerId: null,
    winnerReason: "",
  };
}

export function getBusSchedule(busStartedAt) {
  if (!Number.isFinite(busStartedAt)) {
    return createMatchState();
  }

  return {
    ...createMatchState(),
    phase: MATCH_PHASES.bus,
    busStartedAt,
    doorsOpenAt: busStartedAt + BUS_DOORS_OPEN_OFFSET_MS,
    autoDropAt: busStartedAt + BUS_AUTO_DROP_OFFSET_MS,
    busEndsAt: busStartedAt + BUS_FLIGHT_DURATION_MS,
  };
}

export function isValidLobbyId(lobbyId) {
  return LOBBY_IDS.includes(lobbyId);
}

export function isValidMatchPhase(phase) {
  return Object.values(MATCH_PHASES).includes(phase);
}

export function isValidPlayerState(phase) {
  return Object.values(PLAYER_STATES).includes(phase);
}

export function sanitizePlayerName(name, fallbackName = "") {
  if (typeof name !== "string") {
    return fallbackName;
  }

  const normalized = name
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PLAYER_NAME_MAX_LENGTH);

  return normalized || fallbackName;
}

export function sanitizeSkinDataUrl(skinDataUrl, fallbackSkinDataUrl = "") {
  if (typeof skinDataUrl !== "string") {
    return fallbackSkinDataUrl;
  }

  const trimmed = skinDataUrl.trim();
  if (!trimmed) {
    return fallbackSkinDataUrl;
  }

  if (!trimmed.startsWith("data:image/png;base64,")) {
    return fallbackSkinDataUrl;
  }

  if (trimmed.length > MAX_SKIN_DATA_URL_LENGTH) {
    return fallbackSkinDataUrl;
  }

  return trimmed;
}

export function normalizeYaw(yaw) {
  if (!Number.isFinite(yaw)) {
    return PLAYER_SPAWN.yaw;
  }

  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

export function clampPose(inputPose, previousPose = null) {
  const basePose = previousPose ?? createSpawnPose();
  const nextPose = {
    x: Number.isFinite(inputPose?.x) ? inputPose.x : basePose.x,
    y: Number.isFinite(inputPose?.y) ? inputPose.y : basePose.y,
    z: Number.isFinite(inputPose?.z) ? inputPose.z : basePose.z,
    yaw: normalizeYaw(inputPose?.yaw),
    moveAmount: Number.isFinite(inputPose?.moveAmount) ? inputPose.moveAmount : 0,
  };

  const planarLength = Math.hypot(nextPose.x, nextPose.z);
  if (planarLength > ARENA_RADIUS) {
    const scale = ARENA_RADIUS / planarLength;
    nextPose.x *= scale;
    nextPose.z *= scale;
  }

  nextPose.y = Math.min(Math.max(nextPose.y, PLAYER_MIN_Y), PLAYER_MAX_Y);
  nextPose.moveAmount = Math.min(Math.max(nextPose.moveAmount, 0), 1);

  return nextPose;
}

export function getTeleportDistance(previousPose, nextPose) {
  if (!previousPose || !nextPose) {
    return 0;
  }

  return Math.hypot(
    nextPose.x - previousPose.x,
    nextPose.y - previousPose.y,
    nextPose.z - previousPose.z,
  );
}
