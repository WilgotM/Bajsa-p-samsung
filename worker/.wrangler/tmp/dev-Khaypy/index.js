var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../shared/multiplayer.js
var LOBBY_IDS = ["solo", "main", "secondary"];
var PLAYER_NAME_MAX_LENGTH = 18;
var MAX_SKIN_DATA_URL_LENGTH = 12e4;
var ARENA_RADIUS = 66;
var MAX_PLAYERS_PER_LOBBY = 8;
var MIN_PLAYERS_TO_START = 1;
var POSE_SEND_INTERVAL_MS = 1e3 / 15;
var MAX_PACKET_TELEPORT_DISTANCE = 4;
var PLAYER_MIN_Y = -2;
var PLAYER_MAX_Y = 12;
var COUNTDOWN_DURATION_MS = 1e4;
var BUS_FLIGHT_DURATION_MS = 28e3;
var BUS_DOORS_OPEN_OFFSET_MS = 2500;
var BUS_AUTO_DROP_OFFSET_MS = 24e3;
var WEAPON_SLOT_COUNT = 3;
var TOILET_SEARCH_DURATION_MS = 850;
var TOILET_INTERACT_RANGE = 4.6;
var GROUND_LOOT_PICKUP_RANGE = 3.6;
var MATCH_PHASES = Object.freeze({
  staging: "staging",
  countdown: "countdown",
  bus: "bus",
  glide: "glide",
  active: "active"
});
var PLAYER_SPAWN = Object.freeze({
  x: 0,
  y: 0,
  z: 17.8,
  yaw: Math.PI
});
var STAGING_SPAWN = Object.freeze({
  x: 0,
  y: 6.4,
  z: 88,
  yaw: Math.PI
});
var BUS_ROUTE = Object.freeze({
  start: Object.freeze({
    x: -88,
    y: 28,
    z: 34
  }),
  end: Object.freeze({
    x: 88,
    y: 28,
    z: -24
  })
});
var ACTION_KINDS = Object.freeze({
  poopStart: "poop-start",
  poopStop: "poop-stop",
  strike: "strike"
});
var INTERACT_KINDS = Object.freeze({
  searchStart: "search-start",
  searchCancel: "search-cancel",
  pickupGroundLoot: "pickup-ground-loot"
});
var COMBAT_EVENT_KINDS = Object.freeze({
  weaponFired: "weapon-fired",
  weaponHit: "weapon-hit",
  playerEliminated: "player-eliminated"
});
var WORLD_EVENT_KINDS = Object.freeze({
  targetHit: "target-hit",
  playerHit: "player-hit"
});
var WEAPON_TYPES = Object.freeze({
  assaultRifle: "assault-rifle",
  shotgun: "pump-shotgun",
  smg: "smg"
});
var WEAPON_RARITIES = Object.freeze({
  gray: "gray",
  green: "green",
  blue: "blue",
  purple: "purple"
});
var WEAPON_RARITY_ORDER = Object.freeze([
  WEAPON_RARITIES.gray,
  WEAPON_RARITIES.green,
  WEAPON_RARITIES.blue,
  WEAPON_RARITIES.purple
]);
var WEAPON_RARITY_COLORS = Object.freeze({
  [WEAPON_RARITIES.gray]: "#8b939d",
  [WEAPON_RARITIES.green]: "#4caf50",
  [WEAPON_RARITIES.blue]: "#2f89ff",
  [WEAPON_RARITIES.purple]: "#b25cff"
});
var WEAPON_TYPE_LABELS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: "ASSAULT RIFLE",
  [WEAPON_TYPES.shotgun]: "PUMP SHOTGUN",
  [WEAPON_TYPES.smg]: "SMG"
});
var WEAPON_DEFINITIONS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: Object.freeze({
    fireRate: 6.5,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 22,
      [WEAPON_RARITIES.green]: 24,
      [WEAPON_RARITIES.blue]: 26,
      [WEAPON_RARITIES.purple]: 28
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.038,
      [WEAPON_RARITIES.green]: 0.034,
      [WEAPON_RARITIES.blue]: 0.03,
      [WEAPON_RARITIES.purple]: 0.026
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.014,
      [WEAPON_RARITIES.green]: 0.013,
      [WEAPON_RARITIES.blue]: 0.012,
      [WEAPON_RARITIES.purple]: 0.011
    }),
    maxRange: 78,
    impactScale: 1,
    pellets: 1
  }),
  [WEAPON_TYPES.shotgun]: Object.freeze({
    fireRate: 0.85,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 9,
      [WEAPON_RARITIES.green]: 10,
      [WEAPON_RARITIES.blue]: 11,
      [WEAPON_RARITIES.purple]: 12
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.16,
      [WEAPON_RARITIES.green]: 0.148,
      [WEAPON_RARITIES.blue]: 0.136,
      [WEAPON_RARITIES.purple]: 0.124
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.028,
      [WEAPON_RARITIES.green]: 0.026,
      [WEAPON_RARITIES.blue]: 0.024,
      [WEAPON_RARITIES.purple]: 0.022
    }),
    maxRange: 19,
    impactScale: 1.25,
    pellets: 8
  }),
  [WEAPON_TYPES.smg]: Object.freeze({
    fireRate: 10.5,
    damage: Object.freeze({
      [WEAPON_RARITIES.gray]: 15,
      [WEAPON_RARITIES.green]: 16,
      [WEAPON_RARITIES.blue]: 17,
      [WEAPON_RARITIES.purple]: 18
    }),
    spread: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.05,
      [WEAPON_RARITIES.green]: 0.046,
      [WEAPON_RARITIES.blue]: 0.042,
      [WEAPON_RARITIES.purple]: 0.038
    }),
    recoilKick: Object.freeze({
      [WEAPON_RARITIES.gray]: 0.012,
      [WEAPON_RARITIES.green]: 0.011,
      [WEAPON_RARITIES.blue]: 0.01,
      [WEAPON_RARITIES.purple]: 9e-3
    }),
    maxRange: 46,
    impactScale: 0.92,
    pellets: 1
  })
});
var WEAPON_RARITY_WEIGHTS = Object.freeze({
  [WEAPON_RARITIES.gray]: 46,
  [WEAPON_RARITIES.green]: 30,
  [WEAPON_RARITIES.blue]: 17,
  [WEAPON_RARITIES.purple]: 7
});
var WEAPON_TYPE_WEIGHTS = Object.freeze({
  [WEAPON_TYPES.assaultRifle]: 45,
  [WEAPON_TYPES.smg]: 35,
  [WEAPON_TYPES.shotgun]: 20
});
var TOILET_SPAWNS = Object.freeze([
  Object.freeze({ id: "toilet-town-west-shop", x: -26.8, y: 0, z: 40.6, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-east-shop", x: 26.8, y: 0, z: 40.6, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-northwest-house", x: -16.6, y: 0, z: 57.2, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-town-northeast-house", x: 16.6, y: 0, z: 57.2, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-forest-connector", x: 0, y: 0, z: -39.5, yaw: 0 }),
  Object.freeze({ id: "toilet-desert-roadside", x: 40, y: 0, z: -6, yaw: -Math.PI / 2 }),
  Object.freeze({ id: "toilet-snow-roadside", x: -40, y: 0, z: -5.4, yaw: Math.PI / 2 }),
  Object.freeze({ id: "toilet-south-town-connector", x: 0, y: 0, z: 40.4, yaw: Math.PI })
]);
var PLAYER_COLOR_PALETTE = [
  "#d9823f",
  "#d85d4c",
  "#5e8fc8",
  "#64a66d",
  "#b279bf",
  "#cfb06d",
  "#7d8da1",
  "#d96f8d"
];
var GUEST_PREFIXES = [
  "Rostig",
  "Sunkig",
  "Bister",
  "Skum",
  "Lurig",
  "Vresig",
  "Dimmig",
  "Seg"
];
var GUEST_SUFFIXES = [
  "R\xF6kare",
  "Gubbe",
  "Typ",
  "Lirare",
  "Vandrare",
  "Legend",
  "Kuf",
  "Kisare"
];
function getSpawnForPhase(phase = MATCH_PHASES.active) {
  if (phase === MATCH_PHASES.staging || phase === MATCH_PHASES.countdown) {
    return STAGING_SPAWN;
  }
  return PLAYER_SPAWN;
}
__name(getSpawnForPhase, "getSpawnForPhase");
function createSpawnPose(phase = MATCH_PHASES.active) {
  const spawn = getSpawnForPhase(phase);
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    moveAmount: 0
  };
}
__name(createSpawnPose, "createSpawnPose");
function createActionState() {
  return {
    poopActive: false,
    strikeAt: 0
  };
}
__name(createActionState, "createActionState");
function createEmptyLoadout() {
  return Array.from({ length: WEAPON_SLOT_COUNT }, () => null);
}
__name(createEmptyLoadout, "createEmptyLoadout");
function createMatchState() {
  return {
    phase: MATCH_PHASES.staging,
    countdownEndsAt: null,
    busStartedAt: null,
    doorsOpenAt: null,
    autoDropAt: null,
    busEndsAt: null
  };
}
__name(createMatchState, "createMatchState");
function getBusSchedule(busStartedAt) {
  if (!Number.isFinite(busStartedAt)) {
    return createMatchState();
  }
  return {
    phase: MATCH_PHASES.bus,
    countdownEndsAt: null,
    busStartedAt,
    doorsOpenAt: busStartedAt + BUS_DOORS_OPEN_OFFSET_MS,
    autoDropAt: busStartedAt + BUS_AUTO_DROP_OFFSET_MS,
    busEndsAt: busStartedAt + BUS_FLIGHT_DURATION_MS
  };
}
__name(getBusSchedule, "getBusSchedule");
function isValidLobbyId(lobbyId) {
  return LOBBY_IDS.includes(lobbyId);
}
__name(isValidLobbyId, "isValidLobbyId");
function isValidMatchPhase(phase) {
  return Object.values(MATCH_PHASES).includes(phase);
}
__name(isValidMatchPhase, "isValidMatchPhase");
function sanitizePlayerName(name, fallbackName = "") {
  if (typeof name !== "string") {
    return fallbackName;
  }
  const normalized = name.replace(/\s+/g, " ").trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  return normalized || fallbackName;
}
__name(sanitizePlayerName, "sanitizePlayerName");
function sanitizeSkinDataUrl(skinDataUrl, fallbackSkinDataUrl = "") {
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
__name(sanitizeSkinDataUrl, "sanitizeSkinDataUrl");
function normalizeYaw(yaw) {
  if (!Number.isFinite(yaw)) {
    return PLAYER_SPAWN.yaw;
  }
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}
__name(normalizeYaw, "normalizeYaw");
function clampPose(inputPose, previousPose = null) {
  const basePose = previousPose ?? createSpawnPose();
  const nextPose = {
    x: Number.isFinite(inputPose?.x) ? inputPose.x : basePose.x,
    y: Number.isFinite(inputPose?.y) ? inputPose.y : basePose.y,
    z: Number.isFinite(inputPose?.z) ? inputPose.z : basePose.z,
    yaw: normalizeYaw(inputPose?.yaw),
    moveAmount: Number.isFinite(inputPose?.moveAmount) ? inputPose.moveAmount : 0
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
__name(clampPose, "clampPose");
function getTeleportDistance(previousPose, nextPose) {
  if (!previousPose || !nextPose) {
    return 0;
  }
  return Math.hypot(
    nextPose.x - previousPose.x,
    nextPose.y - previousPose.y,
    nextPose.z - previousPose.z
  );
}
__name(getTeleportDistance, "getTeleportDistance");

// src/index.js
function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}
__name(json, "json");
function errorResponse(message, status = 400) {
  return json(
    {
      error: message
    },
    { status }
  );
}
__name(errorResponse, "errorResponse");
function createGuestProfile(index) {
  const color = PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length];
  const prefix = GUEST_PREFIXES[index % GUEST_PREFIXES.length];
  const suffix = GUEST_SUFFIXES[Math.floor(index / GUEST_PREFIXES.length) % GUEST_SUFFIXES.length];
  return {
    name: `${prefix} ${suffix}`,
    color
  };
}
__name(createGuestProfile, "createGuestProfile");
function sanitizeVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z
  };
}
__name(sanitizeVector3, "sanitizeVector3");
function sanitizeDirection(value, fallback = { x: 0, y: 0, z: 1 }) {
  const vector = sanitizeVector3(value, fallback);
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 1e-4) {
    return { ...fallback };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}
__name(sanitizeDirection, "sanitizeDirection");
function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}
__name(clampNumber, "clampNumber");
function planarDistance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
}
__name(planarDistance, "planarDistance");
function copyWeaponStack(stack) {
  if (!stack?.type || !stack?.rarity) {
    return null;
  }
  return {
    id: stack.id ?? crypto.randomUUID(),
    type: stack.type,
    rarity: stack.rarity
  };
}
__name(copyWeaponStack, "copyWeaponStack");
function createWeightedPicker(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return () => {
    let roll = Math.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        return key;
      }
    }
    return entries[entries.length - 1]?.[0] ?? "";
  };
}
__name(createWeightedPicker, "createWeightedPicker");
var pickWeaponType = createWeightedPicker(WEAPON_TYPE_WEIGHTS);
var pickWeaponRarity = createWeightedPicker(WEAPON_RARITY_WEIGHTS);
function createStarterLoadout() {
  return [
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.assaultRifle,
      rarity: WEAPON_RARITIES.gray
    },
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.shotgun,
      rarity: WEAPON_RARITIES.gray
    },
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.smg,
      rarity: WEAPON_RARITIES.gray
    }
  ];
}
__name(createStarterLoadout, "createStarterLoadout");
function getEquippedWeapon(player) {
  const slot = clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0);
  return player.loadout?.[slot] ?? null;
}
__name(getEquippedWeapon, "getEquippedWeapon");
function serializeLoadout(player) {
  return (player.loadout ?? createEmptyLoadout()).map(copyWeaponStack);
}
__name(serializeLoadout, "serializeLoadout");
function serializeLoadoutState(player) {
  return {
    type: "loadout-state",
    equippedSlot: clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0),
    slots: serializeLoadout(player)
  };
}
__name(serializeLoadoutState, "serializeLoadoutState");
function serializeGroundLoot(groundLoot) {
  return {
    id: groundLoot.id,
    type: groundLoot.weapon.type,
    rarity: groundLoot.weapon.rarity,
    position: sanitizeVector3(groundLoot.position),
    sourceToiletId: groundLoot.sourceToiletId ?? null
  };
}
__name(serializeGroundLoot, "serializeGroundLoot");
function serializeToilet(toilet) {
  return {
    id: toilet.id,
    position: sanitizeVector3(toilet.position),
    yaw: toilet.yaw,
    opened: Boolean(toilet.opened),
    glowActive: Boolean(toilet.glowActive),
    searchingPlayerId: toilet.searchingPlayerId ?? null,
    searchEndsAt: toilet.searchEndsAt ?? null,
    groundLootId: toilet.groundLootId ?? null
  };
}
__name(serializeToilet, "serializeToilet");
function serializeLootState(room) {
  return {
    type: "loot-state",
    toilets: Array.from(room.toilets.values()).map(serializeToilet),
    groundLoot: Array.from(room.groundLoot.values()).map(serializeGroundLoot)
  };
}
__name(serializeLootState, "serializeLootState");
function applyProfile(player, profile = {}) {
  player.name = sanitizePlayerName(profile.name, player.name);
  player.skinDataUrl = sanitizeSkinDataUrl(profile.skinDataUrl, player.skinDataUrl ?? "");
}
__name(applyProfile, "applyProfile");
function serializePlayerSnapshot(player) {
  const equippedWeapon = getEquippedWeapon(player);
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    skinDataUrl: player.skinDataUrl ?? "",
    guestIndex: player.guestIndex,
    pose: player.pose,
    actionState: player.actionState,
    ready: Boolean(player.ready),
    playerPhase: player.playerPhase,
    equippedSlot: clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0),
    equippedWeaponType: equippedWeapon?.type ?? "",
    equippedWeaponRarity: equippedWeapon?.rarity ?? "",
    isSearching: Boolean(player.isSearching)
  };
}
__name(serializePlayerSnapshot, "serializePlayerSnapshot");
function createPlayerState({
  id,
  name,
  color,
  skinDataUrl = "",
  pose,
  actionState,
  websocket,
  joined = false,
  guestIndex = 0,
  ready = false,
  playerPhase = MATCH_PHASES.staging,
  loadout = createStarterLoadout(),
  equippedSlot = 0,
  isSearching = false,
  searchingToiletId = null,
  serverHemorrhoids = 0,
  lastWeaponFireAt = 0
}) {
  return {
    id,
    name,
    color,
    skinDataUrl,
    pose,
    actionState,
    websocket,
    joined,
    guestIndex,
    ready,
    playerPhase,
    loadout: loadout.map(copyWeaponStack),
    equippedSlot,
    isSearching,
    searchingToiletId,
    serverHemorrhoids,
    lastWeaponFireAt
  };
}
__name(createPlayerState, "createPlayerState");
function raySphereDistance(origin, direction, center, radius, maxDistance) {
  const ocX = origin.x - center.x;
  const ocY = origin.y - center.y;
  const ocZ = origin.z - center.z;
  const b = ocX * direction.x + ocY * direction.y + ocZ * direction.z;
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) {
    return null;
  }
  const sqrt = Math.sqrt(discriminant);
  const near = -b - sqrt;
  const far = -b + sqrt;
  const distance = near >= 0 ? near : far >= 0 ? far : null;
  if (distance === null || distance > maxDistance) {
    return null;
  }
  return distance;
}
__name(raySphereDistance, "raySphereDistance");
function jitterDirection(direction, spread, random) {
  const jittered = {
    x: direction.x + (random() - 0.5) * spread,
    y: direction.y + (random() - 0.5) * spread,
    z: direction.z + (random() - 0.5) * spread
  };
  return sanitizeDirection(jittered, direction);
}
__name(jitterDirection, "jitterDirection");
function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 1831565813;
    let result = Math.imul(value ^ value >>> 15, value | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
__name(createSeededRandom, "createSeededRandom");
async function fetchLobbyStatus(env, lobbyId) {
  const stub = env.LOBBY_ROOM.get(env.LOBBY_ROOM.idFromName(lobbyId));
  const response = await stub.fetch("https://lobby.internal/status");
  if (!response.ok) {
    throw new Error(`Failed to fetch status for ${lobbyId}`);
  }
  return response.json();
}
__name(fetchLobbyStatus, "fetchLobbyStatus");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    }
    if (url.pathname === "/api/lobbies") {
      const lobbies = await Promise.all(
        LOBBY_IDS.map(async (lobbyId) => ({
          lobbyId,
          ...await fetchLobbyStatus(env, lobbyId)
        }))
      );
      return json({ lobbies });
    }
    const match = url.pathname.match(/^\/connect\/([^/]+)$/);
    if (match) {
      const lobbyId = match[1];
      if (!isValidLobbyId(lobbyId)) {
        return errorResponse("Unknown lobby.", 404);
      }
      if (request.headers.get("upgrade") !== "websocket") {
        return errorResponse("Expected a WebSocket upgrade request.", 426);
      }
      const stub = env.LOBBY_ROOM.get(env.LOBBY_ROOM.idFromName(lobbyId));
      const upstreamRequest = new Request(`https://lobby.internal/connect/${lobbyId}`, request);
      return stub.fetch(upstreamRequest);
    }
    return errorResponse("Not found.", 404);
  }
};
var LobbyRoom = class {
  static {
    __name(this, "LobbyRoom");
  }
  constructor(ctx) {
    this.ctx = ctx;
    this.lobbyId = null;
    this.players = /* @__PURE__ */ new Map();
    this.guestCounter = 0;
    this.matchState = createMatchState();
    this.phaseTimer = null;
    this.toilets = /* @__PURE__ */ new Map();
    this.groundLoot = /* @__PURE__ */ new Map();
    this.searchTimers = /* @__PURE__ */ new Map();
    this.restorePlayers();
    this.resetLootState();
    this.schedulePhaseTimer();
  }
  restorePlayers() {
    for (const websocket of this.ctx.getWebSockets()) {
      const attachment = websocket.deserializeAttachment();
      if (!attachment?.playerId) {
        continue;
      }
      this.lobbyId = attachment.lobbyId;
      this.players.set(
        attachment.playerId,
        createPlayerState({
          id: attachment.playerId,
          name: attachment.name,
          color: attachment.color,
          skinDataUrl: attachment.skinDataUrl ?? "",
          pose: attachment.pose ?? createSpawnPose(attachment.playerPhase),
          actionState: attachment.actionState ?? createActionState(),
          websocket,
          joined: attachment.joined ?? false,
          guestIndex: attachment.guestIndex ?? 0,
          ready: attachment.ready ?? false,
          playerPhase: attachment.playerPhase ?? MATCH_PHASES.staging,
          loadout: attachment.loadout ?? createStarterLoadout(),
          equippedSlot: attachment.equippedSlot ?? 0,
          isSearching: false,
          searchingToiletId: null,
          serverHemorrhoids: attachment.serverHemorrhoids ?? 0,
          lastWeaponFireAt: attachment.lastWeaponFireAt ?? 0
        })
      );
      this.guestCounter = Math.max(this.guestCounter, (attachment.guestIndex ?? 0) + 1);
    }
  }
  resetLootState() {
    this.clearSearchTimers();
    this.toilets.clear();
    this.groundLoot.clear();
  }
  resetPlayerCombatState(player) {
    player.loadout = createStarterLoadout();
    player.equippedSlot = 0;
    player.isSearching = false;
    player.searchingToiletId = null;
    player.serverHemorrhoids = 0;
    player.lastWeaponFireAt = 0;
    this.updateAttachment(player);
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/status") {
      return json({
        online: this.getJoinedPlayerCount() > 0,
        playerCount: this.getJoinedPlayerCount(),
        readyCount: this.getReadyCount(),
        phase: this.matchState.phase,
        countdownEndsAt: this.matchState.countdownEndsAt
      });
    }
    const connectMatch = url.pathname.match(/^\/connect\/([^/]+)$/);
    if (connectMatch) {
      const lobbyId = connectMatch[1];
      this.lobbyId = lobbyId;
      if (this.getJoinedPlayerCount() >= MAX_PLAYERS_PER_LOBBY) {
        return errorResponse("Lobby is full.", 503);
      }
      const guestIndex = this.guestCounter;
      const profile = createGuestProfile(guestIndex);
      const playerId = crypto.randomUUID();
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const playerPhase = this.getInitialPlayerPhase();
      this.ctx.acceptWebSocket(server);
      const player = createPlayerState({
        id: playerId,
        name: profile.name,
        color: profile.color,
        pose: createSpawnPose(playerPhase),
        actionState: createActionState(),
        websocket: server,
        joined: false,
        guestIndex,
        ready: false,
        playerPhase
      });
      this.players.set(playerId, player);
      this.guestCounter += 1;
      this.updateAttachment(player);
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }
    return errorResponse("Not found.", 404);
  }
  webSocketMessage(websocket, message) {
    const player = this.findPlayerBySocket(websocket);
    if (!player) {
      websocket.close(1011, "Unknown player.");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      websocket.send(
        JSON.stringify({
          type: "error",
          message: "Ogiltigt JSON-paket."
        })
      );
      return;
    }
    if (payload.type === "hello") {
      this.handleHello(player, payload.profile);
      return;
    }
    if (payload.type === "ping") {
      websocket.send(
        JSON.stringify({
          type: "pong",
          now: Date.now()
        })
      );
      return;
    }
    if (payload.type === "ready") {
      this.handleReady(player, payload.ready);
      return;
    }
    if (payload.type === "player-state") {
      this.handlePlayerState(player, payload.playerPhase);
      return;
    }
    if (payload.type === "profile") {
      this.handleProfile(player, payload.profile);
      return;
    }
    if (payload.type === "pose") {
      this.handlePose(player, payload.pose);
      return;
    }
    if (payload.type === "action") {
      this.handleAction(player, payload.action);
      return;
    }
    if (payload.type === "interact") {
      this.handleInteract(player, payload.interact);
      return;
    }
    if (payload.type === "equip-slot") {
      this.handleEquipSlot(player, payload.slot);
      return;
    }
    if (payload.type === "fire-weapon") {
      this.handleFireWeapon(player, payload);
      return;
    }
    if (payload.type === "world-event") {
      this.handleWorldEvent(player, payload.event);
    }
  }
  webSocketClose(websocket, code) {
    this.removePlayer(websocket);
    try {
      websocket.close(code || 1e3, "Socket closed");
    } catch {
    }
  }
  webSocketError(websocket) {
    this.removePlayer(websocket);
    try {
      websocket.close(1011, "Socket error");
    } catch {
    }
  }
  handleHello(player, profile) {
    applyProfile(player, profile);
    player.joined = true;
    player.playerPhase = this.getInitialPlayerPhase();
    if (!(player.loadout ?? []).some((weapon) => weapon?.type && weapon?.rarity)) {
      player.loadout = createStarterLoadout();
      player.equippedSlot = 0;
    }
    if (!player.pose) {
      player.pose = createSpawnPose(player.playerPhase);
    }
    this.updateAttachment(player);
    const others = [];
    for (const existingPlayer of this.players.values()) {
      if (existingPlayer.id === player.id || !existingPlayer.joined) {
        continue;
      }
      others.push(serializePlayerSnapshot(existingPlayer));
    }
    player.websocket.send(
      JSON.stringify({
        type: "welcome",
        selfId: player.id,
        name: player.name,
        color: player.color,
        skinDataUrl: player.skinDataUrl ?? "",
        guestIndex: player.guestIndex,
        ready: Boolean(player.ready),
        playerPhase: player.playerPhase,
        pose: player.pose,
        lobbyId: this.lobbyId,
        playerCount: this.getJoinedPlayerCount(),
        players: others,
        matchState: this.serializeMatchState()
      })
    );
    this.sendToPlayer(player, serializeLootState(this));
    this.sendToPlayer(player, serializeLoadoutState(player));
    this.broadcastPresenceUpdate(player, player.id === null ? null : player.id);
    this.reconcileMatchState(true);
  }
  handleProfile(player, profile) {
    if (!player.joined) {
      return;
    }
    const previousName = player.name;
    const previousSkinDataUrl = player.skinDataUrl ?? "";
    applyProfile(player, profile);
    if (player.name === previousName && (player.skinDataUrl ?? "") === previousSkinDataUrl) {
      return;
    }
    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
    this.broadcastMatchState();
  }
  handleReady(player, ready) {
    if (!player.joined) {
      return;
    }
    if (this.matchState.phase !== MATCH_PHASES.staging && this.matchState.phase !== MATCH_PHASES.countdown) {
      return;
    }
    player.ready = Boolean(ready);
    this.updateAttachment(player);
    this.reconcileMatchState(true);
  }
  handlePlayerState(player, nextPhase) {
    if (!player.joined || !isValidMatchPhase(nextPhase) || nextPhase === MATCH_PHASES.countdown) {
      return;
    }
    if (nextPhase === MATCH_PHASES.staging && this.matchState.phase !== MATCH_PHASES.staging && this.matchState.phase !== MATCH_PHASES.countdown) {
      return;
    }
    if (nextPhase === MATCH_PHASES.bus && this.matchState.phase !== MATCH_PHASES.bus) {
      return;
    }
    if (nextPhase === MATCH_PHASES.glide && this.matchState.phase !== MATCH_PHASES.bus && this.matchState.phase !== MATCH_PHASES.active) {
      return;
    }
    if (nextPhase === MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.bus && this.matchState.phase !== MATCH_PHASES.active) {
      return;
    }
    this.cancelPlayerSearch(player);
    player.playerPhase = nextPhase;
    player.ready = false;
    player.actionState.poopActive = false;
    this.updateAttachment(player);
    this.broadcastMatchState();
  }
  handlePose(player, inputPose) {
    if (!player.joined) {
      return;
    }
    const nextPose = clampPose(inputPose, player.pose);
    if (getTeleportDistance(player.pose, nextPose) > MAX_PACKET_TELEPORT_DISTANCE) {
      return;
    }
    player.pose = nextPose;
    this.updateAttachment(player);
    this.broadcast(
      {
        type: "pose",
        playerId: player.id,
        pose: nextPose,
        at: Date.now()
      },
      player.id
    );
  }
  handleAction(player, action) {
    if (!player.joined || !action?.kind) {
      return;
    }
    const actionAt = Date.now();
    if (action.kind === ACTION_KINDS.poopStart) {
      player.actionState.poopActive = true;
    } else if (action.kind === ACTION_KINDS.poopStop) {
      player.actionState.poopActive = false;
    } else if (action.kind === ACTION_KINDS.strike) {
      player.actionState.strikeAt = actionAt;
    } else {
      return;
    }
    this.updateAttachment(player);
    this.broadcast(
      {
        type: "action",
        playerId: player.id,
        action: {
          kind: action.kind,
          at: actionAt
        }
      },
      player.id
    );
  }
  handleInteract(player, interact) {
    if (!player.joined || !interact?.kind) {
      return;
    }
    if (interact.kind === INTERACT_KINDS.searchStart) {
      this.startToiletSearch(player, interact.toiletId);
      return;
    }
    if (interact.kind === INTERACT_KINDS.searchCancel) {
      this.cancelPlayerSearch(player);
      return;
    }
    if (interact.kind === INTERACT_KINDS.pickupGroundLoot) {
      this.pickupGroundLoot(player, interact.groundLootId);
    }
  }
  handleEquipSlot(player, slot) {
    if (!player.joined) {
      return;
    }
    const nextSlot = clampNumber(slot, 0, WEAPON_SLOT_COUNT - 1, -1);
    if (nextSlot < 0) {
      return;
    }
    player.equippedSlot = nextSlot;
    this.updateAttachment(player);
    this.sendToPlayer(player, serializeLoadoutState(player));
    this.broadcastPresenceUpdate(player);
  }
  handleFireWeapon(player, payload) {
    if (!player.joined || player.playerPhase !== MATCH_PHASES.active) {
      return;
    }
    const weapon = getEquippedWeapon(player);
    if (!weapon) {
      return;
    }
    const definition = WEAPON_DEFINITIONS[weapon.type];
    const rarityStats = definition?.damage?.[weapon.rarity];
    if (!definition || !Number.isFinite(rarityStats)) {
      return;
    }
    const now = Date.now();
    const minInterval = 1e3 / definition.fireRate;
    if (now - player.lastWeaponFireAt < minInterval * 0.92) {
      return;
    }
    const fallbackOrigin = {
      x: player.pose.x,
      y: player.pose.y + 1.05,
      z: player.pose.z
    };
    const origin = sanitizeVector3(payload.origin, fallbackOrigin);
    if (Math.hypot(origin.x - fallbackOrigin.x, origin.y - fallbackOrigin.y, origin.z - fallbackOrigin.z) > 4.2) {
      return;
    }
    const fallbackDirection = {
      x: Math.sin(player.pose.yaw),
      y: 0,
      z: Math.cos(player.pose.yaw)
    };
    const direction = sanitizeDirection(payload.direction, fallbackDirection);
    const random = createSeededRandom((payload.seed ?? now) >>> 0);
    const hitsByTarget = /* @__PURE__ */ new Map();
    let furthestImpact = {
      x: origin.x + direction.x * definition.maxRange,
      y: origin.y + direction.y * definition.maxRange,
      z: origin.z + direction.z * definition.maxRange
    };
    for (let pelletIndex = 0; pelletIndex < definition.pellets; pelletIndex += 1) {
      const pelletDirection = definition.pellets === 1 ? direction : jitterDirection(direction, definition.spread[weapon.rarity], random);
      let bestHit = null;
      for (const target of this.getJoinedPlayers()) {
        if (target.id === player.id || target.playerPhase !== MATCH_PHASES.active) {
          continue;
        }
        const center = {
          x: target.pose.x,
          y: target.pose.y + 0.95,
          z: target.pose.z
        };
        const hitDistance = raySphereDistance(origin, pelletDirection, center, 0.78, definition.maxRange);
        if (!Number.isFinite(hitDistance)) {
          continue;
        }
        if (!bestHit || hitDistance < bestHit.distance) {
          bestHit = {
            target,
            distance: hitDistance,
            impactPoint: {
              x: origin.x + pelletDirection.x * hitDistance,
              y: origin.y + pelletDirection.y * hitDistance,
              z: origin.z + pelletDirection.z * hitDistance
            },
            pelletDirection
          };
        }
      }
      if (!bestHit) {
        continue;
      }
      furthestImpact = bestHit.impactPoint;
      const existing = hitsByTarget.get(bestHit.target.id) ?? {
        target: bestHit.target,
        damage: 0,
        pellets: 0,
        impactPoint: bestHit.impactPoint
      };
      existing.damage += definition.damage[weapon.rarity];
      existing.pellets += 1;
      existing.impactPoint = bestHit.impactPoint;
      hitsByTarget.set(bestHit.target.id, existing);
    }
    player.lastWeaponFireAt = now;
    this.updateAttachment(player);
    this.broadcast({
      type: "combat-event",
      kind: COMBAT_EVENT_KINDS.weaponFired,
      playerId: player.id,
      event: {
        weaponType: weapon.type,
        weaponRarity: weapon.rarity,
        origin,
        impactPoint: furthestImpact,
        at: now
      }
    }, player.id);
    for (const hit of hitsByTarget.values()) {
      const nextHemorrhoids = Math.min(100, hit.target.serverHemorrhoids + hit.damage);
      hit.target.serverHemorrhoids = nextHemorrhoids;
      this.updateAttachment(hit.target);
      this.broadcast({
        type: "combat-event",
        kind: COMBAT_EVENT_KINDS.weaponHit,
        playerId: player.id,
        event: {
          targetPlayerId: hit.target.id,
          weaponType: weapon.type,
          weaponRarity: weapon.rarity,
          damage: hit.damage,
          pellets: hit.pellets,
          impactPoint: sanitizeVector3(hit.impactPoint),
          at: now,
          nextHemorrhoids
        }
      });
      if (nextHemorrhoids >= 100) {
        this.broadcast({
          type: "combat-event",
          kind: COMBAT_EVENT_KINDS.playerEliminated,
          playerId: player.id,
          event: {
            targetPlayerId: hit.target.id,
            weaponType: weapon.type,
            weaponRarity: weapon.rarity,
            at: now
          }
        });
      }
    }
  }
  handleWorldEvent(player, event) {
    if (!player.joined || !event?.kind) {
      return;
    }
    if (event.kind === WORLD_EVENT_KINDS.targetHit) {
      this.broadcast(
        {
          type: "world-event",
          playerId: player.id,
          event: {
            kind: WORLD_EVENT_KINDS.targetHit,
            at: Date.now(),
            impactPoint: sanitizeVector3(event.impactPoint),
            velocity: sanitizeVector3(event.velocity)
          }
        },
        player.id
      );
      return;
    }
    if (event.kind !== WORLD_EVENT_KINDS.playerHit) {
      return;
    }
    const targetPlayerId = typeof event.targetPlayerId === "string" ? event.targetPlayerId : "";
    if (!targetPlayerId || targetPlayerId === player.id) {
      return;
    }
    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer?.joined) {
      return;
    }
    if (player.playerPhase !== MATCH_PHASES.active || targetPlayer.playerPhase !== MATCH_PHASES.active) {
      return;
    }
    this.broadcast(
      {
        type: "world-event",
        playerId: player.id,
        event: {
          kind: WORLD_EVENT_KINDS.playerHit,
          at: Date.now(),
          targetPlayerId,
          impactPoint: sanitizeVector3(
            event.impactPoint,
            targetPlayer.pose ?? createSpawnPose(targetPlayer.playerPhase)
          ),
          velocity: sanitizeVector3(event.velocity)
        }
      },
      player.id
    );
  }
  startToiletSearch(player, toiletId) {
    if (!player.joined || player.playerPhase !== MATCH_PHASES.active) {
      return;
    }
    const toilet = this.toilets.get(toiletId);
    if (!toilet || toilet.opened || !toilet.weapon || toilet.searchingPlayerId) {
      return;
    }
    if (planarDistance(player.pose, toilet.position) > TOILET_INTERACT_RANGE) {
      return;
    }
    this.cancelPlayerSearch(player);
    player.isSearching = true;
    player.searchingToiletId = toilet.id;
    toilet.searchingPlayerId = player.id;
    toilet.searchEndsAt = Date.now() + TOILET_SEARCH_DURATION_MS;
    this.updateAttachment(player);
    const timerId = setTimeout(() => {
      this.searchTimers.delete(toilet.id);
      this.completeToiletSearch(toilet.id, player.id);
    }, TOILET_SEARCH_DURATION_MS);
    this.searchTimers.set(toilet.id, timerId);
    this.broadcastPresenceUpdate(player);
    this.broadcast({
      type: "loot-event",
      kind: "toilet-search-start",
      toilet: serializeToilet(toilet),
      playerId: player.id
    });
  }
  cancelPlayerSearch(player) {
    if (!player?.isSearching || !player.searchingToiletId) {
      return;
    }
    const toilet = this.toilets.get(player.searchingToiletId);
    if (toilet) {
      const timerId = this.searchTimers.get(toilet.id);
      if (timerId) {
        clearTimeout(timerId);
        this.searchTimers.delete(toilet.id);
      }
      toilet.searchingPlayerId = null;
      toilet.searchEndsAt = null;
      this.broadcast({
        type: "loot-event",
        kind: "toilet-search-cancel",
        toilet: serializeToilet(toilet),
        playerId: player.id
      });
    }
    player.isSearching = false;
    player.searchingToiletId = null;
    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
  }
  completeToiletSearch(toiletId, playerId) {
    const toilet = this.toilets.get(toiletId);
    const player = this.players.get(playerId);
    if (!toilet || !player || toilet.searchingPlayerId !== playerId || !toilet.weapon) {
      return;
    }
    if (!player.joined || player.playerPhase !== MATCH_PHASES.active || planarDistance(player.pose, toilet.position) > TOILET_INTERACT_RANGE) {
      this.cancelPlayerSearch(player);
      return;
    }
    const searchedWeapon = copyWeaponStack(toilet.weapon);
    let targetSlot = player.loadout.findIndex((entry) => !entry);
    let groundLoot = null;
    let autoCollected = false;
    if (targetSlot >= 0) {
      player.loadout[targetSlot] = copyWeaponStack(searchedWeapon);
      player.equippedSlot = targetSlot;
      autoCollected = true;
      this.sendToPlayer(player, serializeLoadoutState(player));
    } else {
      const direction = {
        x: Math.sin(toilet.yaw ?? 0),
        z: Math.cos(toilet.yaw ?? 0)
      };
      groundLoot = {
        id: crypto.randomUUID(),
        weapon: copyWeaponStack(searchedWeapon),
        position: {
          x: toilet.position.x + direction.x * 1.1,
          y: toilet.position.y + 0.16,
          z: toilet.position.z + direction.z * 1.1
        },
        sourceToiletId: toilet.id
      };
      this.groundLoot.set(groundLoot.id, groundLoot);
    }
    toilet.weapon = null;
    toilet.opened = true;
    toilet.glowActive = false;
    toilet.searchingPlayerId = null;
    toilet.searchEndsAt = null;
    toilet.groundLootId = groundLoot?.id ?? null;
    player.isSearching = false;
    player.searchingToiletId = null;
    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
    this.broadcast({
      type: "loot-event",
      kind: "toilet-search-complete",
      toilet: serializeToilet(toilet),
      playerId,
      autoCollected,
      targetSlot: targetSlot >= 0 ? targetSlot : null,
      pickedWeapon: searchedWeapon,
      groundLoot: groundLoot ? serializeGroundLoot(groundLoot) : null
    });
  }
  pickupGroundLoot(player, groundLootId) {
    if (!player.joined || player.playerPhase !== MATCH_PHASES.active) {
      return;
    }
    const groundLoot = this.groundLoot.get(groundLootId);
    if (!groundLoot) {
      return;
    }
    if (planarDistance(player.pose, groundLoot.position) > GROUND_LOOT_PICKUP_RANGE) {
      return;
    }
    let targetSlot = player.loadout.findIndex((entry) => !entry);
    if (targetSlot < 0) {
      targetSlot = clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0);
    }
    const replaced = copyWeaponStack(player.loadout[targetSlot]);
    player.loadout[targetSlot] = copyWeaponStack(groundLoot.weapon);
    if (!getEquippedWeapon(player)) {
      player.equippedSlot = targetSlot;
    } else if (targetSlot === player.equippedSlot || !player.loadout[player.equippedSlot]) {
      player.equippedSlot = targetSlot;
    }
    this.groundLoot.delete(groundLoot.id);
    if (groundLoot.sourceToiletId) {
      const toilet = this.toilets.get(groundLoot.sourceToiletId);
      if (toilet?.groundLootId === groundLoot.id) {
        toilet.groundLootId = null;
      }
    }
    let droppedGroundLoot = null;
    if (replaced) {
      const dropDirection = {
        x: Math.sin(player.pose.yaw),
        z: Math.cos(player.pose.yaw)
      };
      droppedGroundLoot = {
        id: crypto.randomUUID(),
        weapon: replaced,
        position: {
          x: player.pose.x + dropDirection.x * 1.1,
          y: player.pose.y + 0.16,
          z: player.pose.z + dropDirection.z * 1.1
        },
        sourceToiletId: null
      };
      this.groundLoot.set(droppedGroundLoot.id, droppedGroundLoot);
    }
    this.updateAttachment(player);
    this.sendToPlayer(player, serializeLoadoutState(player));
    this.broadcastPresenceUpdate(player);
    this.broadcast({
      type: "loot-event",
      kind: "ground-loot-picked-up",
      playerId: player.id,
      pickedWeapon: copyWeaponStack(player.loadout[targetSlot]),
      targetSlot,
      removedGroundLootId: groundLoot.id,
      addedGroundLoot: droppedGroundLoot ? serializeGroundLoot(droppedGroundLoot) : null
    });
  }
  removePlayer(websocket) {
    const player = this.findPlayerBySocket(websocket);
    if (!player) {
      return;
    }
    this.cancelPlayerSearch(player);
    this.players.delete(player.id);
    if (player.joined) {
      this.broadcast({
        type: "presence",
        action: "leave",
        playerCount: this.getJoinedPlayerCount(),
        player: serializePlayerSnapshot(player)
      });
    }
    if (this.players.size === 0) {
      this.clearPhaseTimer();
      this.clearSearchTimers();
      this.guestCounter = 0;
      this.lobbyId = null;
      this.matchState = createMatchState();
      this.resetLootState();
      return;
    }
    this.reconcileMatchState(true);
  }
  onPhaseTimer() {
    const now = Date.now();
    if (this.matchState.phase === MATCH_PHASES.countdown && Number.isFinite(this.matchState.countdownEndsAt) && now >= this.matchState.countdownEndsAt) {
      if (this.canStartCountdown()) {
        this.startBusPhase();
      } else {
        this.matchState = createMatchState();
        this.applyPlayerPhaseToJoinedPlayers(MATCH_PHASES.staging);
        this.broadcastMatchState();
        this.schedulePhaseTimer();
      }
      return;
    }
    if (this.matchState.phase === MATCH_PHASES.bus && Number.isFinite(this.matchState.busEndsAt) && now >= this.matchState.busEndsAt) {
      this.enterActivePhase();
      return;
    }
    this.schedulePhaseTimer();
  }
  canStartCountdown() {
    const joinedPlayers = this.getJoinedPlayers();
    return joinedPlayers.length >= MIN_PLAYERS_TO_START && joinedPlayers.every((player) => player.ready);
  }
  reconcileMatchState(shouldBroadcast = false) {
    const joinedPlayers = this.getJoinedPlayers();
    if (joinedPlayers.length === 0) {
      this.matchState = createMatchState();
      this.clearPhaseTimer();
      return;
    }
    if (this.matchState.phase === MATCH_PHASES.bus || this.matchState.phase === MATCH_PHASES.active) {
      if (shouldBroadcast) {
        this.broadcastMatchState();
      }
      this.schedulePhaseTimer();
      return;
    }
    if (this.canStartCountdown()) {
      if (this.matchState.phase !== MATCH_PHASES.countdown || !Number.isFinite(this.matchState.countdownEndsAt)) {
        this.matchState = {
          ...createMatchState(),
          phase: MATCH_PHASES.countdown,
          countdownEndsAt: Date.now() + COUNTDOWN_DURATION_MS
        };
      }
      this.applyPlayerPhaseToJoinedPlayers(MATCH_PHASES.staging);
      this.broadcastMatchState();
      this.schedulePhaseTimer();
      return;
    }
    this.matchState = createMatchState();
    this.applyPlayerPhaseToJoinedPlayers(MATCH_PHASES.staging);
    if (shouldBroadcast) {
      this.broadcastMatchState();
    }
    this.schedulePhaseTimer();
  }
  startBusPhase() {
    this.matchState = getBusSchedule(Date.now());
    this.resetLootState();
    this.applyPlayerPhaseToJoinedPlayers(MATCH_PHASES.bus);
    for (const player of this.getJoinedPlayers()) {
      this.cancelPlayerSearch(player);
      player.ready = false;
      player.actionState.poopActive = false;
      this.resetPlayerCombatState(player);
      this.sendToPlayer(player, serializeLoadoutState(player));
    }
    this.broadcast(serializeLootState(this));
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }
  enterActivePhase() {
    this.matchState = {
      ...createMatchState(),
      phase: MATCH_PHASES.active
    };
    for (const player of this.getJoinedPlayers()) {
      if (player.playerPhase === MATCH_PHASES.bus) {
        player.playerPhase = MATCH_PHASES.active;
        this.updateAttachment(player);
      }
    }
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }
  getInitialPlayerPhase() {
    if (this.matchState.phase === MATCH_PHASES.bus) {
      return MATCH_PHASES.bus;
    }
    if (this.matchState.phase === MATCH_PHASES.active) {
      return MATCH_PHASES.active;
    }
    return MATCH_PHASES.staging;
  }
  applyPlayerPhaseToJoinedPlayers(phase) {
    for (const player of this.getJoinedPlayers()) {
      player.playerPhase = phase;
      this.updateAttachment(player);
    }
  }
  getJoinedPlayers() {
    return Array.from(this.players.values()).filter((player) => player.joined);
  }
  getReadyCount() {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.joined && player.ready) {
        count += 1;
      }
    }
    return count;
  }
  serializeMatchState() {
    return {
      ...this.matchState,
      playerCount: this.getJoinedPlayerCount(),
      readyCount: this.getReadyCount(),
      players: this.getJoinedPlayers().map(serializePlayerSnapshot)
    };
  }
  broadcastMatchState() {
    this.broadcast({
      type: "match-state",
      ...this.serializeMatchState()
    });
  }
  sendToPlayer(player, message) {
    if (!player?.joined) {
      return;
    }
    player.websocket.send(JSON.stringify(message));
  }
  broadcastPresenceUpdate(player, excludedPlayerId = null) {
    this.broadcast(
      {
        type: "presence",
        action: "update",
        playerCount: this.getJoinedPlayerCount(),
        player: serializePlayerSnapshot(player)
      },
      excludedPlayerId
    );
  }
  schedulePhaseTimer() {
    this.clearPhaseTimer();
    const targetTime = this.matchState.phase === MATCH_PHASES.countdown ? this.matchState.countdownEndsAt : this.matchState.phase === MATCH_PHASES.bus ? this.matchState.busEndsAt : null;
    if (!Number.isFinite(targetTime)) {
      return;
    }
    const waitMs = Math.max(0, targetTime - Date.now());
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.onPhaseTimer();
    }, waitMs);
  }
  clearPhaseTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }
  clearSearchTimers() {
    for (const timerId of this.searchTimers.values()) {
      clearTimeout(timerId);
    }
    this.searchTimers.clear();
  }
  findPlayerBySocket(websocket) {
    for (const player of this.players.values()) {
      if (player.websocket === websocket) {
        return player;
      }
    }
    return null;
  }
  getJoinedPlayerCount() {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.joined) {
        count += 1;
      }
    }
    return count;
  }
  updateAttachment(player) {
    player.websocket.serializeAttachment({
      lobbyId: this.lobbyId,
      playerId: player.id,
      guestIndex: player.guestIndex,
      name: player.name,
      color: player.color,
      skinDataUrl: player.skinDataUrl ?? "",
      pose: player.pose,
      actionState: player.actionState,
      joined: player.joined,
      ready: player.ready,
      playerPhase: player.playerPhase,
      loadout: serializeLoadout(player),
      equippedSlot: clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0),
      serverHemorrhoids: player.serverHemorrhoids ?? 0,
      lastWeaponFireAt: player.lastWeaponFireAt ?? 0
    });
  }
  broadcast(message, excludedPlayerId = null) {
    const encodedMessage = JSON.stringify(message);
    for (const player of this.players.values()) {
      if (!player.joined || player.id === excludedPlayerId) {
        continue;
      }
      player.websocket.send(encodedMessage);
    }
  }
};

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-zCq8iL/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-zCq8iL/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  LobbyRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
