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

export const MATCH_PHASES = Object.freeze({
  staging: "staging",
  countdown: "countdown",
  bus: "bus",
  glide: "glide",
  active: "active",
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

export const WORLD_EVENT_KINDS = Object.freeze({
  targetHit: "target-hit",
  playerHit: "player-hit",
});

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

export function createMatchState() {
  return {
    phase: MATCH_PHASES.staging,
    countdownEndsAt: null,
    busStartedAt: null,
    doorsOpenAt: null,
    autoDropAt: null,
    busEndsAt: null,
  };
}

export function getBusSchedule(busStartedAt) {
  if (!Number.isFinite(busStartedAt)) {
    return createMatchState();
  }

  return {
    phase: MATCH_PHASES.bus,
    countdownEndsAt: null,
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
