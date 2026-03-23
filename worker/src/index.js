import {
  ACTION_KINDS,
  COMBAT_EVENT_KINDS,
  COUNTDOWN_DURATION_MS,
  GROUND_LOOT_PICKUP_RANGE,
  GUEST_PREFIXES,
  GUEST_SUFFIXES,
  INTERACT_KINDS,
  LOBBY_IDS,
  MATCH_PHASES,
  MAX_PACKET_TELEPORT_DISTANCE,
  MAX_PLAYERS_PER_LOBBY,
  MIN_PLAYERS_TO_START,
  PHONE_HEMORRHOIDS_NEARBY_BASE_PER_SECOND,
  PHONE_HEMORRHOIDS_NEARBY_EXTRA_PER_SECOND,
  PHONE_HEMORRHOIDS_ON_PHONE_PER_SECOND,
  PHONE_PRESSURE_NEARBY_INNER_RADIUS,
  PHONE_PRESSURE_NEARBY_MAX,
  PHONE_PRESSURE_NEARBY_OUTER_RADIUS,
  PHONE_ROTATION_Y,
  PHONE_STAND_BOUNDS,
  PLAYER_COLOR_PALETTE,
  PLAYER_LIVES,
  PLAYER_RESPAWN_DELAY_MS,
  PLAYER_STATES,
  POOP_SCORE_METERS_PER_SECOND,
  ROUND_ACTIVE_DURATION_MS,
  ROUND_END_REASONS,
  ROUND_EVENT_KINDS,
  ROUND_OVERTIME_DURATION_MS,
  ROUND_RESULTS_DURATION_MS,
  TOILET_INTERACT_RANGE,
  TOILET_SEARCH_DURATION_MS,
  TOILET_SPAWNS,
  WEAPON_DEFINITIONS,
  WEAPON_RARITY_WEIGHTS,
  WEAPON_RARITIES,
  WEAPON_SLOT_COUNT,
  WEAPON_TYPES,
  WEAPON_TYPE_WEIGHTS,
  WORLD_EVENT_KINDS,
  clampPose,
  createActionState,
  createEmptyLoadout,
  createMatchState,
  createSpawnPose,
  getBusSchedule,
  getTeleportDistance,
  isValidLobbyId,
  isValidMatchPhase,
  isValidPlayerState,
  sanitizePlayerName,
  sanitizeSkinDataUrl,
} from "../../shared/multiplayer.js";

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function errorResponse(message, status = 400) {
  return json(
    {
      error: message,
    },
    { status },
  );
}

function createGuestProfile(index) {
  const color = PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length];
  const prefix = GUEST_PREFIXES[index % GUEST_PREFIXES.length];
  const suffix = GUEST_SUFFIXES[Math.floor(index / GUEST_PREFIXES.length) % GUEST_SUFFIXES.length];
  return {
    name: `${prefix} ${suffix}`,
    color,
  };
}

function sanitizeVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z,
  };
}

function sanitizeDirection(value, fallback = { x: 0, y: 0, z: 1 }) {
  const vector = sanitizeVector3(value, fallback);
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length < 0.0001) {
    return { ...fallback };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function mapLinear(value, fromMin, fromMax, toMin, toMax) {
  if (fromMax === fromMin) {
    return toMin;
  }
  return toMin + ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

function planarDistance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
}

function getTargetHitHemorrhoidRelief(velocity) {
  const hitForce = clampNumber(
    Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0, velocity?.z ?? 0) * 0.06,
    1.2,
    2.4,
    1.2,
  );
  return 18 + hitForce * 2.4;
}

function getPhonePressureState(pose) {
  const cosRotation = Math.cos(-PHONE_ROTATION_Y);
  const sinRotation = Math.sin(-PHONE_ROTATION_Y);
  const localX = (pose?.x ?? 0) * cosRotation + (pose?.z ?? 0) * sinRotation;
  const localZ = -(pose?.x ?? 0) * sinRotation + (pose?.z ?? 0) * cosRotation;
  const onPhone =
    Math.abs(localX) <= PHONE_STAND_BOUNDS.halfX &&
    Math.abs(localZ) <= PHONE_STAND_BOUNDS.halfZ;
  const distanceToPhone = Math.hypot(pose?.x ?? 0, pose?.z ?? 0);
  const nearbyPressure = clampNumber(
    mapLinear(
      distanceToPhone,
      PHONE_PRESSURE_NEARBY_OUTER_RADIUS,
      PHONE_PRESSURE_NEARBY_INNER_RADIUS,
      0,
      PHONE_PRESSURE_NEARBY_MAX,
    ),
    0,
    PHONE_PRESSURE_NEARBY_MAX,
    0,
  );

  return {
    onPhone,
    nearbyPressure,
  };
}

function createRedeployPose(player) {
  const fallback = createSpawnPose(PLAYER_STATES.glide);
  const nextPose = {
    x: Number.isFinite(player?.pose?.x) ? player.pose.x : fallback.x,
    y: 11.4,
    z: Number.isFinite(player?.pose?.z) ? player.pose.z : fallback.z,
    yaw: Number.isFinite(player?.pose?.yaw) ? player.pose.yaw : fallback.yaw,
    moveAmount: 0,
  };
  return clampPose(nextPose, player?.pose ?? fallback);
}

function copyWeaponStack(stack) {
  if (!stack?.type || !stack?.rarity) {
    return null;
  }
  return {
    id: stack.id ?? crypto.randomUUID(),
    type: stack.type,
    rarity: stack.rarity,
  };
}

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

const pickWeaponType = createWeightedPicker(WEAPON_TYPE_WEIGHTS);
const pickWeaponRarity = createWeightedPicker(WEAPON_RARITY_WEIGHTS);

function createRandomWeaponStack() {
  return {
    id: crypto.randomUUID(),
    type: pickWeaponType(),
    rarity: pickWeaponRarity(),
  };
}

function createStarterLoadout() {
  return [
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.assaultRifle,
      rarity: WEAPON_RARITIES.gray,
    },
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.shotgun,
      rarity: WEAPON_RARITIES.gray,
    },
    {
      id: crypto.randomUUID(),
      type: WEAPON_TYPES.smg,
      rarity: WEAPON_RARITIES.gray,
    },
  ];
}

function getEquippedWeapon(player) {
  const slot = clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0);
  return player.loadout?.[slot] ?? null;
}

function serializeLoadout(player) {
  return (player.loadout ?? createEmptyLoadout()).map(copyWeaponStack);
}

function serializeLoadoutState(player) {
  return {
    type: "loadout-state",
    equippedSlot: clampNumber(player.equippedSlot, 0, WEAPON_SLOT_COUNT - 1, 0),
    slots: serializeLoadout(player),
  };
}

function serializeGroundLoot(groundLoot) {
  return {
    id: groundLoot.id,
    type: groundLoot.weapon.type,
    rarity: groundLoot.weapon.rarity,
    position: sanitizeVector3(groundLoot.position),
    sourceToiletId: groundLoot.sourceToiletId ?? null,
  };
}

function serializeToilet(toilet) {
  return {
    id: toilet.id,
    position: sanitizeVector3(toilet.position),
    yaw: toilet.yaw,
    opened: Boolean(toilet.opened),
    glowActive: Boolean(toilet.glowActive),
    searchingPlayerId: toilet.searchingPlayerId ?? null,
    searchEndsAt: toilet.searchEndsAt ?? null,
    groundLootId: toilet.groundLootId ?? null,
  };
}

function serializeLootState(room) {
  return {
    type: "loot-state",
    toilets: Array.from(room.toilets.values()).map(serializeToilet),
    groundLoot: Array.from(room.groundLoot.values()).map(serializeGroundLoot),
  };
}

function applyProfile(player, profile = {}) {
  player.name = sanitizePlayerName(profile.name, player.name);
  player.skinDataUrl = sanitizeSkinDataUrl(profile.skinDataUrl, player.skinDataUrl ?? "");
}

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
    isSearching: Boolean(player.isSearching),
    scoreMeters: Number(player.scoreMeters ?? 0),
    livesRemaining: clampNumber(player.livesRemaining, 0, PLAYER_LIVES, PLAYER_LIVES),
    hemorrhoids: clampNumber(player.serverHemorrhoids, 0, 100, 0),
    roundParticipant: Boolean(player.roundParticipant),
    respawnAt: player.respawnAt ?? null,
    isEliminated: Boolean(player.isEliminated),
  };
}

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
  playerPhase = PLAYER_STATES.staging,
  loadout = createStarterLoadout(),
  equippedSlot = 0,
  isSearching = false,
  searchingToiletId = null,
  serverHemorrhoids = 0,
  lastWeaponFireAt = 0,
  scoreMeters = 0,
  livesRemaining = PLAYER_LIVES,
  roundParticipant = false,
  respawnAt = null,
  isEliminated = false,
  lastRoundTickAt = 0,
  lastDamagedByPlayerId = null,
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
    lastWeaponFireAt,
    scoreMeters,
    livesRemaining,
    roundParticipant,
    respawnAt,
    isEliminated,
    lastRoundTickAt,
    lastDamagedByPlayerId,
  };
}

const PLAYER_BODY_HIT_RADIUS = 0.78;
const PLAYER_BODY_CENTER_Y = 0.95;
const PLAYER_HEAD_HIT_RADIUS = 0.34;
const PLAYER_HEAD_CENTER_Y = 1.58;
const PLAYER_HEADSHOT_HEIGHT_Y = 1.36;
const HEADSHOT_DAMAGE_MULTIPLIER = 1.25;

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

function resolvePlayerHit(origin, direction, target, maxDistance) {
  const pose = target.pose ?? createSpawnPose(target.playerPhase);
  const bodyCenter = {
    x: pose.x,
    y: pose.y + PLAYER_BODY_CENTER_Y,
    z: pose.z,
  };
  const bodyDistance = raySphereDistance(
    origin,
    direction,
    bodyCenter,
    PLAYER_BODY_HIT_RADIUS,
    maxDistance,
  );
  if (!Number.isFinite(bodyDistance)) {
    return null;
  }

  const headCenter = {
    x: pose.x,
    y: pose.y + PLAYER_HEAD_CENTER_Y,
    z: pose.z,
  };
  const headDistance = raySphereDistance(
    origin,
    direction,
    headCenter,
    PLAYER_HEAD_HIT_RADIUS,
    maxDistance,
  );
  const explicitHeadHit =
    Number.isFinite(headDistance) && headDistance <= bodyDistance + PLAYER_HEAD_HIT_RADIUS * 1.2;
  const distance = explicitHeadHit ? Math.min(bodyDistance, headDistance) : bodyDistance;
  const impactPoint = {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance,
  };
  const headshot = explicitHeadHit || impactPoint.y >= pose.y + PLAYER_HEADSHOT_HEIGHT_Y;

  return {
    distance,
    impactPoint,
    headshot,
    hitRegion: headshot ? "head" : "body",
  };
}

function jitterDirection(direction, spread, random) {
  const jittered = {
    x: direction.x + (random() - 0.5) * spread,
    y: direction.y + (random() - 0.5) * spread,
    z: direction.z + (random() - 0.5) * spread,
  };
  return sanitizeDirection(jittered, direction);
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), value | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

async function fetchLobbyStatus(env, lobbyId) {
  const stub = env.LOBBY_ROOM.get(env.LOBBY_ROOM.idFromName(lobbyId));
  const response = await stub.fetch("https://lobby.internal/status");
  if (!response.ok) {
    throw new Error(`Failed to fetch status for ${lobbyId}`);
  }
  return response.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    if (url.pathname === "/api/lobbies") {
      const lobbies = await Promise.all(
        LOBBY_IDS.map(async (lobbyId) => ({
          lobbyId,
          ...(await fetchLobbyStatus(env, lobbyId)),
        })),
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
  },
};

export class LobbyRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.lobbyId = null;
    this.players = new Map();
    this.guestCounter = 0;
    this.matchState = createMatchState();
    this.phaseTimer = null;
    this.toilets = new Map();
    this.groundLoot = new Map();
    this.searchTimers = new Map();
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
          playerPhase: attachment.playerPhase ?? PLAYER_STATES.staging,
          loadout: attachment.loadout ?? createStarterLoadout(),
          equippedSlot: attachment.equippedSlot ?? 0,
          isSearching: false,
          searchingToiletId: null,
          serverHemorrhoids: attachment.serverHemorrhoids ?? 0,
          lastWeaponFireAt: attachment.lastWeaponFireAt ?? 0,
          scoreMeters: attachment.scoreMeters ?? 0,
          livesRemaining: attachment.livesRemaining ?? PLAYER_LIVES,
          roundParticipant: attachment.roundParticipant ?? false,
          respawnAt: attachment.respawnAt ?? null,
          isEliminated: attachment.isEliminated ?? false,
          lastRoundTickAt: attachment.lastRoundTickAt ?? 0,
          lastDamagedByPlayerId: attachment.lastDamagedByPlayerId ?? null,
        }),
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

  isSoloLobby() {
    return this.lobbyId === "solo";
  }

  isRoundJoinLocked() {
    return (
      this.matchState.phase !== MATCH_PHASES.staging &&
      this.matchState.phase !== MATCH_PHASES.countdown
    );
  }

  promoteBusToActiveIfDue(now = Date.now()) {
    if (this.matchState.phase !== MATCH_PHASES.bus) {
      return false;
    }
    if (!Number.isFinite(this.matchState.activeStartedAt) || now < this.matchState.activeStartedAt) {
      return false;
    }
    this.enterActivePhase(now);
    return true;
  }

  initializePlayerForRound(player, phase = PLAYER_STATES.staging, now = Date.now()) {
    this.cancelPlayerSearch(player);
    player.roundParticipant = true;
    player.livesRemaining = PLAYER_LIVES;
    player.scoreMeters = 0;
    player.serverHemorrhoids = 0;
    player.respawnAt = null;
    player.isEliminated = false;
    player.lastRoundTickAt = now;
    player.lastDamagedByPlayerId = null;
    player.ready = false;
    player.actionState.poopActive = false;
    player.playerPhase = phase;
    player.pose = createSpawnPose(phase);
    this.resetPlayerCombatState(player);
    this.updateAttachment(player);
  }

  initializePlayerAsSpectator(player, now = Date.now()) {
    this.cancelPlayerSearch(player);
    player.roundParticipant = false;
    player.livesRemaining = 0;
    player.scoreMeters = 0;
    player.serverHemorrhoids = 0;
    player.respawnAt = null;
    player.isEliminated = false;
    player.lastRoundTickAt = now;
    player.lastDamagedByPlayerId = null;
    player.ready = false;
    player.actionState.poopActive = false;
    player.playerPhase = PLAYER_STATES.spectating;
    player.pose = createSpawnPose(PLAYER_STATES.active);
    this.resetPlayerCombatState(player);
    this.updateAttachment(player);
  }

  broadcastRoundEvent(kind, event) {
    this.broadcast({
      type: "round-event",
      kind,
      event,
    });
  }

  getContenderPlayers() {
    return this.getJoinedPlayers().filter(
      (player) => player.roundParticipant && !player.isEliminated && player.livesRemaining > 0,
    );
  }

  getScoreboardPlayers() {
    return this.getJoinedPlayers()
      .filter((player) => player.roundParticipant && !player.isEliminated && player.livesRemaining > 0)
      .sort((first, second) => {
        if ((second.scoreMeters ?? 0) !== (first.scoreMeters ?? 0)) {
          return (second.scoreMeters ?? 0) - (first.scoreMeters ?? 0);
        }
        if ((second.livesRemaining ?? 0) !== (first.livesRemaining ?? 0)) {
          return (second.livesRemaining ?? 0) - (first.livesRemaining ?? 0);
        }
        if ((first.serverHemorrhoids ?? 0) !== (second.serverHemorrhoids ?? 0)) {
          return (first.serverHemorrhoids ?? 0) - (second.serverHemorrhoids ?? 0);
        }
        return (first.guestIndex ?? 0) - (second.guestIndex ?? 0);
      });
  }

  syncPlayerRoundState(player, now = Date.now()) {
    if (!player?.joined) {
      return {
        statsChanged: false,
        died: false,
      };
    }

    this.promoteBusToActiveIfDue(now);

    const previousTick =
      Number.isFinite(player.lastRoundTickAt) && player.lastRoundTickAt > 0
        ? player.lastRoundTickAt
        : now;
    player.lastRoundTickAt = now;

    if (
      !player.roundParticipant ||
      player.isEliminated ||
      player.playerPhase !== PLAYER_STATES.active ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
    ) {
      return {
        statsChanged: false,
        died: false,
      };
    }

    const deltaSeconds = Math.min(0.35, Math.max(0, (now - previousTick) / 1000));
    if (deltaSeconds <= 0) {
      return {
        statsChanged: false,
        died: false,
      };
    }

    let statsChanged = false;
    const pressureState = getPhonePressureState(player.pose);
    if (player.actionState.poopActive && pressureState.onPhone) {
      player.scoreMeters += deltaSeconds * POOP_SCORE_METERS_PER_SECOND;
      statsChanged = true;
    }

    let nextHemorrhoids = player.serverHemorrhoids;
    if (pressureState.onPhone) {
      nextHemorrhoids = Math.min(
        100,
        nextHemorrhoids + deltaSeconds * PHONE_HEMORRHOIDS_ON_PHONE_PER_SECOND,
      );
    } else if (pressureState.nearbyPressure > 0) {
      nextHemorrhoids = Math.min(
        100,
        nextHemorrhoids +
          deltaSeconds *
            (PHONE_HEMORRHOIDS_NEARBY_BASE_PER_SECOND +
              pressureState.nearbyPressure * PHONE_HEMORRHOIDS_NEARBY_EXTRA_PER_SECOND),
      );
    }

    if (nextHemorrhoids !== player.serverHemorrhoids) {
      player.serverHemorrhoids = nextHemorrhoids;
      statsChanged = true;
    }

    if (player.serverHemorrhoids >= 100) {
      this.resolvePlayerDeath(player, {
        attackerPlayerId: player.lastDamagedByPlayerId,
        cause: "pressure",
        now,
      });
      return {
        statsChanged: true,
        died: true,
      };
    }

    if (statsChanged) {
      this.updateAttachment(player);
    }

    return {
      statsChanged,
      died: false,
    };
  }

  resolvePlayerDeath(player, { attackerPlayerId = null, cause = "pressure", now = Date.now() } = {}) {
    if (
      !player?.joined ||
      !player.roundParticipant ||
      player.isEliminated ||
      (player.playerPhase === PLAYER_STATES.spectating && Number.isFinite(player.respawnAt))
    ) {
      return;
    }

    this.cancelPlayerSearch(player);
    player.ready = false;
    player.actionState.poopActive = false;
    player.scoreMeters = 0;
    player.serverHemorrhoids = 0;
    player.lastRoundTickAt = now;
    player.lastDamagedByPlayerId = attackerPlayerId;
    player.livesRemaining = Math.max(0, (player.livesRemaining ?? PLAYER_LIVES) - 1);

    let respawnAt = null;
    if (player.livesRemaining > 0) {
      player.playerPhase = PLAYER_STATES.spectating;
      player.respawnAt = now + PLAYER_RESPAWN_DELAY_MS;
      respawnAt = player.respawnAt;
    } else {
      player.playerPhase = PLAYER_STATES.eliminated;
      player.respawnAt = null;
      player.isEliminated = true;
    }

    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
    this.broadcastRoundEvent(ROUND_EVENT_KINDS.playerDied, {
      targetPlayerId: player.id,
      attackerPlayerId,
      cause,
      at: now,
      remainingLives: player.livesRemaining,
      respawnAt,
    });

    if (player.isEliminated) {
      this.broadcastRoundEvent(ROUND_EVENT_KINDS.playerEliminated, {
        targetPlayerId: player.id,
        attackerPlayerId,
        at: now,
      });
    }
  }

  respawnPlayer(player, now = Date.now()) {
    if (
      !player?.joined ||
      !player.roundParticipant ||
      player.isEliminated ||
      player.livesRemaining <= 0 ||
      !Number.isFinite(player.respawnAt) ||
      now < player.respawnAt
    ) {
      return false;
    }

    player.respawnAt = null;
    player.playerPhase = PLAYER_STATES.glide;
    player.serverHemorrhoids = 0;
    player.actionState.poopActive = false;
    player.lastRoundTickAt = now;
    player.pose = createRedeployPose(player);
    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
    this.broadcastRoundEvent(ROUND_EVENT_KINDS.playerRespawned, {
      targetPlayerId: player.id,
      at: now,
      pose: sanitizeVector3(player.pose),
    });
    return true;
  }

  startOvertimePhase(now = Date.now()) {
    this.matchState = {
      ...this.matchState,
      phase: MATCH_PHASES.overtime,
      overtimeEndsAt: now + ROUND_OVERTIME_DURATION_MS,
      resultsEndsAt: null,
      winnerPlayerId: null,
      winnerReason: "",
      remainingContenders: this.getContenderPlayers().length,
    };
    this.broadcastRoundEvent(ROUND_EVENT_KINDS.overtimeStarted, {
      at: now,
      overtimeEndsAt: this.matchState.overtimeEndsAt,
    });
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }

  endRound(winnerPlayerId, winnerReason, now = Date.now()) {
    this.matchState = {
      ...this.matchState,
      phase: MATCH_PHASES.results,
      resultsEndsAt: now + ROUND_RESULTS_DURATION_MS,
      winnerPlayerId: winnerPlayerId ?? null,
      winnerReason,
      remainingContenders: this.getContenderPlayers().length,
    };

    for (const player of this.getJoinedPlayers()) {
      player.ready = false;
      player.actionState.poopActive = false;
      player.respawnAt = null;
      player.lastRoundTickAt = now;
      this.updateAttachment(player);
    }

    this.broadcastRoundEvent(ROUND_EVENT_KINDS.matchEnded, {
      at: now,
      winnerPlayerId: winnerPlayerId ?? null,
      winnerReason,
      resultsEndsAt: this.matchState.resultsEndsAt,
    });
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }

  resetToStaging(now = Date.now()) {
    this.matchState = createMatchState();
    this.resetLootState();

    for (const player of this.getJoinedPlayers()) {
      this.initializePlayerForRound(player, PLAYER_STATES.staging, now);
      this.sendToPlayer(player, serializeLoadoutState(player));
    }

    this.broadcast(serializeLootState(this));
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }

  resolveActiveTimer(now = Date.now()) {
    const scoreboard = this.getScoreboardPlayers();
    if (scoreboard.length === 0) {
      this.endRound(null, this.isSoloLobby() ? ROUND_END_REASONS.soloLoss : ROUND_END_REASONS.samsungSurvived, now);
      return;
    }

    const topScore = scoreboard[0]?.scoreMeters ?? 0;
    if (topScore <= 0.01) {
      this.endRound(null, ROUND_END_REASONS.samsungSurvived, now);
      return;
    }

    const leaders = scoreboard.filter((player) => Math.abs((player.scoreMeters ?? 0) - topScore) < 0.01);
    if (leaders.length === 1) {
      this.endRound(leaders[0].id, ROUND_END_REASONS.time, now);
      return;
    }

    this.startOvertimePhase(now);
  }

  processScheduledState(now = Date.now()) {
    if (
      this.matchState.phase === MATCH_PHASES.results &&
      Number.isFinite(this.matchState.resultsEndsAt) &&
      now >= this.matchState.resultsEndsAt
    ) {
      this.resetToStaging(now);
      return true;
    }

    if (
      this.matchState.phase === MATCH_PHASES.countdown &&
      Number.isFinite(this.matchState.countdownEndsAt) &&
      now >= this.matchState.countdownEndsAt
    ) {
      if (this.canStartCountdown()) {
        this.startBusPhase(now);
      } else {
        this.matchState = createMatchState();
        this.applyPlayerPhaseToJoinedPlayers(PLAYER_STATES.staging);
        this.broadcastMatchState();
        this.schedulePhaseTimer();
      }
      return true;
    }

    if (
      this.matchState.phase === MATCH_PHASES.bus &&
      Number.isFinite(this.matchState.activeStartedAt) &&
      now >= this.matchState.activeStartedAt
    ) {
      this.enterActivePhase(now);
      return true;
    }

    let respawnedAnyPlayer = false;
    for (const player of this.getJoinedPlayers()) {
      if (this.respawnPlayer(player, now)) {
        respawnedAnyPlayer = true;
      }
    }

    if (
      this.matchState.phase === MATCH_PHASES.active &&
      Number.isFinite(this.matchState.activeEndsAt) &&
      now >= this.matchState.activeEndsAt
    ) {
      this.resolveActiveTimer(now);
      return true;
    }

    if (
      this.matchState.phase === MATCH_PHASES.overtime &&
      Number.isFinite(this.matchState.overtimeEndsAt) &&
      now >= this.matchState.overtimeEndsAt
    ) {
      this.endRound(null, ROUND_END_REASONS.samsungSurvived, now);
      return true;
    }

    return respawnedAnyPlayer;
  }

  evaluateRoundState(now = Date.now(), shouldBroadcast = false) {
    const wasUpdatedByTimer = this.processScheduledState(now);
    if (wasUpdatedByTimer && this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime) {
      return;
    }

    const contenders = this.getContenderPlayers();
    const contenderCount = contenders.length;
    const shouldBroadcastCount = this.matchState.remainingContenders !== contenderCount;
    this.matchState.remainingContenders = contenderCount;

    if (this.matchState.phase === MATCH_PHASES.active || this.matchState.phase === MATCH_PHASES.overtime) {
      if (contenderCount === 0) {
        this.endRound(null, this.isSoloLobby() ? ROUND_END_REASONS.soloLoss : ROUND_END_REASONS.samsungSurvived, now);
        return;
      }

      if (!this.isSoloLobby() && contenderCount === 1) {
        this.endRound(contenders[0].id, ROUND_END_REASONS.lastPlayer, now);
        return;
      }

      if (this.matchState.phase === MATCH_PHASES.overtime) {
        const scoreboard = this.getScoreboardPlayers();
        const topScore = scoreboard[0]?.scoreMeters ?? 0;
        if (topScore <= 0.01) {
          this.endRound(null, ROUND_END_REASONS.samsungSurvived, now);
          return;
        }

        const leaders = scoreboard.filter((player) => Math.abs((player.scoreMeters ?? 0) - topScore) < 0.01);
        if (leaders.length === 1) {
          this.endRound(leaders[0].id, ROUND_END_REASONS.overtime, now);
          return;
        }
      }
    }

    if (shouldBroadcast || shouldBroadcastCount || wasUpdatedByTimer) {
      this.broadcastMatchState();
    }
    this.schedulePhaseTimer();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return json({
        online: this.getJoinedPlayerCount() > 0,
        playerCount: this.getJoinedPlayerCount(),
        readyCount: this.getReadyCount(),
        phase: this.matchState.phase,
        countdownEndsAt: this.matchState.countdownEndsAt,
        activeEndsAt: this.matchState.activeEndsAt,
        overtimeEndsAt: this.matchState.overtimeEndsAt,
        resultsEndsAt: this.matchState.resultsEndsAt,
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
        playerPhase,
      });

      this.players.set(playerId, player);
      this.guestCounter += 1;
      this.updateAttachment(player);

      return new Response(null, {
        status: 101,
        webSocket: client,
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
          message: "Ogiltigt JSON-paket.",
        }),
      );
      return;
    }

    if (payload.type === "hello") {
      this.handleHello(player, payload.profile);
      return;
    }

    if (payload.type === "ping") {
      const now = Date.now();
      const { statsChanged, died } = this.syncPlayerRoundState(player, now);
      if (statsChanged && !died) {
        this.broadcastPresenceUpdate(player);
      }
      this.evaluateRoundState(now, statsChanged);
      websocket.send(
        JSON.stringify({
          type: "pong",
          now,
        }),
      );
      return;
    }

    if (payload.type === "ready") {
      this.handleReady(player, payload.ready);
      return;
    }

    if (payload.type === "player-state") {
      this.handlePlayerState(player, payload.playerPhase, payload.pose);
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
      websocket.close(code || 1000, "Socket closed");
    } catch {
      // Ignore repeated close attempts from the server half.
    }
  }

  webSocketError(websocket) {
    this.removePlayer(websocket);
    try {
      websocket.close(1011, "Socket error");
    } catch {
      // Ignore repeated close attempts from the server half.
    }
  }

  handleHello(player, profile) {
    const now = Date.now();
    applyProfile(player, profile);
    player.joined = true;
    if (this.isRoundJoinLocked()) {
      this.initializePlayerAsSpectator(player, now);
    } else {
      this.initializePlayerForRound(player, PLAYER_STATES.staging, now);
    }
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
        matchState: this.serializeMatchState(),
      }),
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

    if (!player.roundParticipant) {
      return;
    }

    if (
      this.matchState.phase !== MATCH_PHASES.staging &&
      this.matchState.phase !== MATCH_PHASES.countdown
    ) {
      return;
    }

    player.ready = Boolean(ready);
    this.updateAttachment(player);
    this.reconcileMatchState(true);
  }

  handlePlayerState(player, nextPhase, inputPose = null) {
    if (!player.joined || !isValidPlayerState(nextPhase)) {
      return;
    }

    const now = Date.now();
    this.promoteBusToActiveIfDue(now);

    if (!player.roundParticipant || player.isEliminated) {
      return;
    }

    if (
      nextPhase === PLAYER_STATES.staging &&
      this.matchState.phase !== MATCH_PHASES.staging &&
      this.matchState.phase !== MATCH_PHASES.countdown
    ) {
      return;
    }

    if (
      nextPhase === PLAYER_STATES.bus &&
      this.matchState.phase !== MATCH_PHASES.bus
    ) {
      return;
    }

    if (
      nextPhase === PLAYER_STATES.glide &&
      this.matchState.phase !== MATCH_PHASES.bus &&
      this.matchState.phase !== MATCH_PHASES.active &&
      this.matchState.phase !== MATCH_PHASES.overtime
    ) {
      return;
    }

    if (
      nextPhase === PLAYER_STATES.active &&
      this.matchState.phase !== MATCH_PHASES.active &&
      this.matchState.phase !== MATCH_PHASES.overtime
    ) {
      return;
    }

    this.cancelPlayerSearch(player);
    if (inputPose) {
      player.pose = clampPose(inputPose, player.pose);
    }
    player.playerPhase = nextPhase;
    player.ready = false;
    player.actionState.poopActive = false;
    player.lastRoundTickAt = now;
    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);
    this.evaluateRoundState(now, true);
  }

  handlePose(player, inputPose) {
    if (!player.joined) {
      return;
    }

    const now = Date.now();
    const nextPose = clampPose(inputPose, player.pose);
    if (getTeleportDistance(player.pose, nextPose) > MAX_PACKET_TELEPORT_DISTANCE) {
      return;
    }

    player.pose = nextPose;
    const { statsChanged, died } = this.syncPlayerRoundState(player, now);
    this.updateAttachment(player);
    if (statsChanged && !died) {
      this.broadcastPresenceUpdate(player);
    }
    if (died) {
      this.evaluateRoundState(now, false);
      return;
    }

    this.broadcast(
      {
        type: "pose",
        playerId: player.id,
        pose: nextPose,
        at: now,
      },
      player.id,
    );
    this.evaluateRoundState(now, false);
  }

  handleAction(player, action) {
    if (!player.joined || !action?.kind) {
      return;
    }

    const actionAt = Date.now();
    const { statsChanged, died } = this.syncPlayerRoundState(player, actionAt);
    if (statsChanged && !died) {
      this.broadcastPresenceUpdate(player);
    }
    if (died) {
      this.evaluateRoundState(actionAt, false);
      return;
    }

    if (action.kind === ACTION_KINDS.poopStart) {
      if (
        this.matchState.phase !== MATCH_PHASES.active &&
        this.matchState.phase !== MATCH_PHASES.overtime
      ) {
        return;
      }
      if (player.playerPhase !== PLAYER_STATES.active || !player.roundParticipant || player.isEliminated) {
        return;
      }
      player.actionState.poopActive = true;
    } else if (action.kind === ACTION_KINDS.poopStop) {
      player.actionState.poopActive = false;
    } else if (action.kind === ACTION_KINDS.strike) {
      if (player.playerPhase !== PLAYER_STATES.active || !player.roundParticipant || player.isEliminated) {
        return;
      }
      player.actionState.strikeAt = actionAt;
    } else {
      return;
    }

    this.updateAttachment(player);
    this.broadcastPresenceUpdate(player);

    this.broadcast(
      {
        type: "action",
        playerId: player.id,
        action: {
          kind: action.kind,
          at: actionAt,
        },
      },
      player.id,
    );
    this.evaluateRoundState(actionAt, false);
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
    if (
      !player.joined ||
      player.playerPhase !== PLAYER_STATES.active ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
    ) {
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
    const attackerTick = this.syncPlayerRoundState(player, now);
    if (attackerTick.died) {
      return;
    }
    if (attackerTick.statsChanged) {
      this.broadcastPresenceUpdate(player);
    }
    const minInterval = 1000 / definition.fireRate;
    if (now - player.lastWeaponFireAt < minInterval * 0.92) {
      return;
    }

    const fallbackOrigin = {
      x: player.pose.x,
      y: player.pose.y + 1.05,
      z: player.pose.z,
    };
    const origin = sanitizeVector3(payload.origin, fallbackOrigin);
    if (Math.hypot(origin.x - fallbackOrigin.x, origin.y - fallbackOrigin.y, origin.z - fallbackOrigin.z) > 4.2) {
      return;
    }

    const fallbackDirection = {
      x: Math.sin(player.pose.yaw),
      y: 0,
      z: Math.cos(player.pose.yaw),
    };
    const direction = sanitizeDirection(payload.direction, fallbackDirection);
    const random = createSeededRandom((payload.seed ?? now) >>> 0);
    const hitsByTarget = new Map();
    let furthestImpact = {
      x: origin.x + direction.x * definition.maxRange,
      y: origin.y + direction.y * definition.maxRange,
      z: origin.z + direction.z * definition.maxRange,
    };

    for (let pelletIndex = 0; pelletIndex < definition.pellets; pelletIndex += 1) {
      const pelletDirection =
        definition.pellets === 1
          ? direction
          : jitterDirection(direction, definition.spread[weapon.rarity], random);

      let bestHit = null;
      for (const target of this.getJoinedPlayers()) {
        if (
          target.id === player.id ||
          target.playerPhase !== PLAYER_STATES.active ||
          !target.roundParticipant ||
          target.isEliminated
        ) {
          continue;
        }

        const hit = resolvePlayerHit(origin, pelletDirection, target, definition.maxRange);
        if (!hit) {
          continue;
        }

        if (!bestHit || hit.distance < bestHit.distance) {
          bestHit = {
            target,
            distance: hit.distance,
            impactPoint: hit.impactPoint,
            headshot: hit.headshot,
            hitRegion: hit.hitRegion,
            pelletDirection,
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
        headshotPellets: 0,
        headshot: false,
        impactPoint: bestHit.impactPoint,
      };
      const pelletDamage = bestHit.headshot
        ? Math.round(definition.damage[weapon.rarity] * HEADSHOT_DAMAGE_MULTIPLIER)
        : definition.damage[weapon.rarity];
      existing.damage += pelletDamage;
      existing.pellets += 1;
      existing.headshotPellets += bestHit.headshot ? 1 : 0;
      existing.headshot = existing.headshot || bestHit.headshot;
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
        at: now,
      },
    }, player.id);

    for (const hit of hitsByTarget.values()) {
      const targetTick = this.syncPlayerRoundState(hit.target, now);
      if (targetTick.statsChanged && !targetTick.died) {
        this.broadcastPresenceUpdate(hit.target);
      }
      if (targetTick.died || hit.target.isEliminated || hit.target.playerPhase !== PLAYER_STATES.active) {
        continue;
      }

      hit.target.lastDamagedByPlayerId = player.id;
      const nextHemorrhoids = Math.min(100, hit.target.serverHemorrhoids + hit.damage);
      hit.target.serverHemorrhoids = nextHemorrhoids;
      this.updateAttachment(hit.target);
      this.broadcastPresenceUpdate(hit.target);

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
          headshot: hit.headshot,
          headshotPellets: hit.headshotPellets,
          impactPoint: sanitizeVector3(hit.impactPoint),
          at: now,
          nextHemorrhoids,
        },
      });

      if (nextHemorrhoids >= 100) {
        this.resolvePlayerDeath(hit.target, {
          attackerPlayerId: player.id,
          cause: "weapon",
          now,
        });
        this.broadcast({
          type: "combat-event",
          kind: COMBAT_EVENT_KINDS.playerEliminated,
          playerId: player.id,
          event: {
            targetPlayerId: hit.target.id,
            weaponType: weapon.type,
            weaponRarity: weapon.rarity,
            at: now,
          },
        });
      }
    }

    this.evaluateRoundState(now, false);
  }

  handleWorldEvent(player, event) {
    if (!player.joined || !event?.kind) {
      return;
    }

    if (event.kind === WORLD_EVENT_KINDS.targetHit) {
      if (
        player.playerPhase !== PLAYER_STATES.active ||
        !player.roundParticipant ||
        player.isEliminated ||
        (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
      ) {
        return;
      }

      const now = Date.now();
      const tick = this.syncPlayerRoundState(player, now);
      if (tick.statsChanged && !tick.died) {
        this.broadcastPresenceUpdate(player);
      }
      if (tick.died || player.isEliminated || player.playerPhase !== PLAYER_STATES.active) {
        return;
      }

      const previousHemorrhoids = player.serverHemorrhoids ?? 0;
      const nextHemorrhoids = Math.max(
        0,
        previousHemorrhoids - getTargetHitHemorrhoidRelief(event.velocity),
      );
      if (nextHemorrhoids !== previousHemorrhoids) {
        player.serverHemorrhoids = nextHemorrhoids;
        this.updateAttachment(player);
        this.broadcastPresenceUpdate(player);
      }

      this.broadcast(
        {
          type: "world-event",
          playerId: player.id,
          event: {
            kind: WORLD_EVENT_KINDS.targetHit,
            at: now,
            impactPoint: sanitizeVector3(event.impactPoint),
            velocity: sanitizeVector3(event.velocity),
            nextHemorrhoids,
          },
        },
        player.id,
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

    if (
      player.playerPhase !== PLAYER_STATES.active ||
      targetPlayer.playerPhase !== PLAYER_STATES.active ||
      !player.roundParticipant ||
      !targetPlayer.roundParticipant ||
      player.isEliminated ||
      targetPlayer.isEliminated ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
    ) {
      return;
    }

    const now = Date.now();
    const attackerTick = this.syncPlayerRoundState(player, now);
    if (attackerTick.statsChanged && !attackerTick.died) {
      this.broadcastPresenceUpdate(player);
    }
    if (attackerTick.died) {
      return;
    }

    const targetTick = this.syncPlayerRoundState(targetPlayer, now);
    if (targetTick.statsChanged && !targetTick.died) {
      this.broadcastPresenceUpdate(targetPlayer);
    }
    if (targetTick.died || targetPlayer.isEliminated || targetPlayer.playerPhase !== PLAYER_STATES.active) {
      return;
    }

    targetPlayer.lastDamagedByPlayerId = player.id;
    const nextHemorrhoids = Math.min(100, targetPlayer.serverHemorrhoids + 8.5);
    targetPlayer.serverHemorrhoids = nextHemorrhoids;
    targetPlayer.lastRoundTickAt = now;
    this.updateAttachment(targetPlayer);
    this.broadcastPresenceUpdate(targetPlayer);

    this.broadcast(
      {
        type: "world-event",
        playerId: player.id,
        event: {
          kind: WORLD_EVENT_KINDS.playerHit,
          at: now,
          targetPlayerId,
          impactPoint: sanitizeVector3(
            event.impactPoint,
            targetPlayer.pose ?? createSpawnPose(targetPlayer.playerPhase),
          ),
          velocity: sanitizeVector3(event.velocity),
          damage: 8.5,
          nextHemorrhoids,
        },
      },
      player.id,
    );

    if (nextHemorrhoids >= 100) {
      this.resolvePlayerDeath(targetPlayer, {
        attackerPlayerId: player.id,
        cause: "melee",
        now,
      });
    }

    this.evaluateRoundState(now, false);
  }

  startToiletSearch(player, toiletId) {
    if (
      !player.joined ||
      player.playerPhase !== PLAYER_STATES.active ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
    ) {
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
      playerId: player.id,
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
        playerId: player.id,
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

    if (
      !player.joined ||
      player.playerPhase !== PLAYER_STATES.active ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime) ||
      planarDistance(player.pose, toilet.position) > TOILET_INTERACT_RANGE
    ) {
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
        z: Math.cos(toilet.yaw ?? 0),
      };
      groundLoot = {
        id: crypto.randomUUID(),
        weapon: copyWeaponStack(searchedWeapon),
        position: {
          x: toilet.position.x + direction.x * 1.1,
          y: toilet.position.y + 0.16,
          z: toilet.position.z + direction.z * 1.1,
        },
        sourceToiletId: toilet.id,
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
      groundLoot: groundLoot ? serializeGroundLoot(groundLoot) : null,
    });
  }

  pickupGroundLoot(player, groundLootId) {
    if (
      !player.joined ||
      player.playerPhase !== PLAYER_STATES.active ||
      (this.matchState.phase !== MATCH_PHASES.active && this.matchState.phase !== MATCH_PHASES.overtime)
    ) {
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
        z: Math.cos(player.pose.yaw),
      };
      droppedGroundLoot = {
        id: crypto.randomUUID(),
        weapon: replaced,
        position: {
          x: player.pose.x + dropDirection.x * 1.1,
          y: player.pose.y + 0.16,
          z: player.pose.z + dropDirection.z * 1.1,
        },
        sourceToiletId: null,
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
      addedGroundLoot: droppedGroundLoot ? serializeGroundLoot(droppedGroundLoot) : null,
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
        player: serializePlayerSnapshot(player),
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
    this.evaluateRoundState(Date.now(), true);
  }

  onPhaseTimer() {
    const now = Date.now();
    this.evaluateRoundState(now, true);
  }

  canStartCountdown() {
    const joinedPlayers = this.getJoinedPlayers();
    return (
      joinedPlayers.length >= MIN_PLAYERS_TO_START &&
      joinedPlayers.every((player) => player.ready)
    );
  }

  reconcileMatchState(shouldBroadcast = false) {
    const joinedPlayers = this.getJoinedPlayers();

    if (joinedPlayers.length === 0) {
      this.matchState = createMatchState();
      this.clearPhaseTimer();
      return;
    }

    if (
      this.matchState.phase === MATCH_PHASES.bus ||
      this.matchState.phase === MATCH_PHASES.active ||
      this.matchState.phase === MATCH_PHASES.overtime ||
      this.matchState.phase === MATCH_PHASES.results
    ) {
      if (shouldBroadcast) {
        this.broadcastMatchState();
      }
      this.schedulePhaseTimer();
      return;
    }

    if (this.canStartCountdown()) {
      if (
        this.matchState.phase !== MATCH_PHASES.countdown ||
      !Number.isFinite(this.matchState.countdownEndsAt)
    ) {
      this.matchState = {
        ...createMatchState(),
        phase: MATCH_PHASES.countdown,
        countdownEndsAt: Date.now() + COUNTDOWN_DURATION_MS,
      };
    }
      this.applyPlayerPhaseToJoinedPlayers(PLAYER_STATES.staging);
      this.broadcastMatchState();
      this.schedulePhaseTimer();
      return;
    }

    this.matchState = createMatchState();
    this.applyPlayerPhaseToJoinedPlayers(PLAYER_STATES.staging);
    if (shouldBroadcast) {
      this.broadcastMatchState();
    }
    this.schedulePhaseTimer();
  }

  startBusPhase(now = Date.now()) {
    const busSchedule = getBusSchedule(now);
    const activeStartedAt = busSchedule.doorsOpenAt;
    this.matchState = {
      ...busSchedule,
      activeStartedAt,
      activeEndsAt: Number.isFinite(activeStartedAt)
        ? activeStartedAt + ROUND_ACTIVE_DURATION_MS
        : null,
      remainingContenders: this.getJoinedPlayerCount(),
    };
    this.resetLootState();
    for (const player of this.getJoinedPlayers()) {
      this.initializePlayerForRound(player, PLAYER_STATES.bus, now);
      this.sendToPlayer(player, serializeLoadoutState(player));
    }
    this.broadcast(serializeLootState(this));
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }

  enterActivePhase(now = Date.now()) {
    const activeStartedAt = Number.isFinite(this.matchState.activeStartedAt)
      ? this.matchState.activeStartedAt
      : now;
    const previousBusState = this.matchState;
    this.matchState = {
      ...createMatchState(),
      busStartedAt: previousBusState.busStartedAt ?? null,
      doorsOpenAt: previousBusState.doorsOpenAt ?? null,
      autoDropAt: previousBusState.autoDropAt ?? null,
      busEndsAt: previousBusState.busEndsAt ?? null,
      phase: MATCH_PHASES.active,
      activeStartedAt,
      activeEndsAt: Number.isFinite(this.matchState.activeEndsAt)
        ? this.matchState.activeEndsAt
        : activeStartedAt + ROUND_ACTIVE_DURATION_MS,
      remainingContenders: this.getContenderPlayers().length,
    };
    for (const player of this.getJoinedPlayers()) {
      if (player.roundParticipant) {
        player.lastRoundTickAt = now;
        this.updateAttachment(player);
      }
    }
    this.broadcastMatchState();
    this.schedulePhaseTimer();
  }

  getInitialPlayerPhase() {
    if (this.isRoundJoinLocked()) {
      return PLAYER_STATES.spectating;
    }

    return PLAYER_STATES.staging;
  }

  applyPlayerPhaseToJoinedPlayers(phase) {
    for (const player of this.getJoinedPlayers()) {
      player.playerPhase = phase;
      player.pose = createSpawnPose(phase);
      player.actionState.poopActive = false;
      player.lastRoundTickAt = Date.now();
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
      remainingContenders: this.getContenderPlayers().length,
      playerCount: this.getJoinedPlayerCount(),
      readyCount: this.getReadyCount(),
      players: this.getJoinedPlayers().map(serializePlayerSnapshot),
    };
  }

  broadcastMatchState() {
    this.broadcast({
      type: "match-state",
      ...this.serializeMatchState(),
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
        player: serializePlayerSnapshot(player),
      },
      excludedPlayerId,
    );
  }

  schedulePhaseTimer() {
    this.clearPhaseTimer();

    const targetTime =
      this.matchState.phase === MATCH_PHASES.countdown
        ? this.matchState.countdownEndsAt
        : this.matchState.phase === MATCH_PHASES.bus
          ? Number.isFinite(this.matchState.activeStartedAt)
            ? this.matchState.activeStartedAt
            : this.matchState.busEndsAt
          : this.matchState.phase === MATCH_PHASES.active
            ? this.matchState.activeEndsAt
            : this.matchState.phase === MATCH_PHASES.overtime
              ? this.matchState.overtimeEndsAt
              : this.matchState.phase === MATCH_PHASES.results
                ? this.matchState.resultsEndsAt
                : null;

    let nextTime = targetTime;
    for (const player of this.getJoinedPlayers()) {
      if (!Number.isFinite(player.respawnAt)) {
        continue;
      }
      nextTime = Number.isFinite(nextTime) ? Math.min(nextTime, player.respawnAt) : player.respawnAt;
    }

    if (!Number.isFinite(nextTime)) {
      return;
    }

    const waitMs = Math.max(0, nextTime - Date.now());
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
      lastWeaponFireAt: player.lastWeaponFireAt ?? 0,
      scoreMeters: player.scoreMeters ?? 0,
      livesRemaining: player.livesRemaining ?? PLAYER_LIVES,
      roundParticipant: Boolean(player.roundParticipant),
      respawnAt: player.respawnAt ?? null,
      isEliminated: Boolean(player.isEliminated),
      lastRoundTickAt: player.lastRoundTickAt ?? 0,
      lastDamagedByPlayerId: player.lastDamagedByPlayerId ?? null,
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
}
