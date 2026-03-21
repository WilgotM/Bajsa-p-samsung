export const LOBBY_IDS = ["main", "secondary"];

export const LOBBY_LABELS = {
  main: "Huvudlobby",
  secondary: "Sekundär lobby",
};

export const ARENA_RADIUS = 66;
export const MAX_PLAYERS_PER_LOBBY = 8;
export const REMOTE_INTERPOLATION_BACKTIME_MS = 100;
export const POSE_SEND_INTERVAL_MS = 1000 / 15;
export const HEARTBEAT_INTERVAL_MS = 250;
export const MAX_PACKET_TELEPORT_DISTANCE = 4;
export const PLAYER_MIN_Y = -2;
export const PLAYER_MAX_Y = 12;

export const PLAYER_SPAWN = Object.freeze({
  x: 0,
  y: 0,
  z: 17.8,
  yaw: Math.PI,
});

export const ACTION_KINDS = Object.freeze({
  poopStart: "poop-start",
  poopStop: "poop-stop",
  strike: "strike",
});

export const WORLD_EVENT_KINDS = Object.freeze({
  targetHit: "target-hit",
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

export function createSpawnPose() {
  return {
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    z: PLAYER_SPAWN.z,
    yaw: PLAYER_SPAWN.yaw,
    moveAmount: 0,
  };
}

export function createActionState() {
  return {
    poopActive: false,
    strikeAt: 0,
  };
}

export function isValidLobbyId(lobbyId) {
  return LOBBY_IDS.includes(lobbyId);
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
