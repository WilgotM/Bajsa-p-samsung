import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MultiplayerClient } from "./multiplayer-client.js";
import { createRemotePlayerAvatar, updateRemotePlayerAvatar } from "./remote-player.js";
import {
  createMinecraftAvatar,
  getDefaultMinecraftSkinDataUrl,
  setMinecraftAvatarName,
  setMinecraftAvatarSkin,
} from "./minecraft-avatar.js";
import {
  ACTION_KINDS,
  ARENA_RADIUS,
  BUS_ROUTE,
  MATCH_PHASES,
  LOBBY_IDS,
  LOBBY_LABELS,
  MAX_PLAYERS_PER_LOBBY,
  MIN_PLAYERS_TO_START,
  PLAYER_SPAWN,
  REMOTE_INTERPOLATION_BACKTIME_MS,
  STAGING_SPAWN,
  WORLD_EVENT_KINDS,
  createActionState,
  createMatchState,
  getSpawnForPhase,
  sanitizePlayerName,
  sanitizeSkinDataUrl,
  PLAYER_NAME_MAX_LENGTH,
} from "../shared/multiplayer.js";

const canvas = document.querySelector("#scene");
const leaderboardEl = document.querySelector("#leaderboard");
const leaderboardEntriesEl = document.querySelector("#leaderboard-entries");
const leaderboardHeadCache = new Map();
const meterTextEl = document.querySelector("#meter-text");
const meterFillEl = document.querySelector("#meter-fill");
const gameOverEl = document.querySelector("#game-over");
const lobbyMenuEl = document.querySelector("#lobby-menu");
const lobbyMenuStatusEl = document.querySelector("#lobby-menu-status");
const profileToggleBtn = document.querySelector("#profile-toggle-btn");
const profileEditorEl = document.querySelector("#profile-editor");
const profileNameInputEl = document.querySelector("#profile-name-input");
const profileSkinInputEl = document.querySelector("#profile-skin-input");
const profileResetSkinBtn = document.querySelector("#profile-reset-skin-btn");
const profileStatusEl = document.querySelector("#profile-status");
const skinPreviewCanvas = document.querySelector("#skin-preview");
const matchPanelEl = document.querySelector("#match-panel");
const matchPanelTitleEl = document.querySelector("#match-panel-title");
const matchPanelSubtitleEl = document.querySelector("#match-panel-subtitle");
const matchPhaseLabelEl = document.querySelector("#match-phase-label");
const countdownChipEl = document.querySelector("#countdown-chip");
const readyBtn = document.querySelector("#ready-btn");
const lobbyPlayerListEl = document.querySelector("#lobby-player-list");
const announcementBannerEl = document.querySelector("#announcement-banner");
const announcementTextEl = document.querySelector("#announcement-text");
const jumpPromptEl = document.querySelector("#jump-prompt");

const pauseMenuEl = document.querySelector("#pause-menu");
const resumeBtn = document.querySelector("#resume-btn");
const quitBtn = document.querySelector("#quit-btn");
const leaveLobbyBtn = document.querySelector("#leave-lobby-btn");

let isPaused = false;

if (leaveLobbyBtn) {
  leaveLobbyBtn.addEventListener("click", () => {
    setMenuOpen(true);
    multiplayer.disconnect(true);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });
}

if (resumeBtn) {
  resumeBtn.addEventListener("click", () => {
    isPaused = false;
    pauseMenuEl.classList.add("hidden");
    canvas.requestPointerLock();
  });
}

if (quitBtn) {
  quitBtn.addEventListener("click", () => {
    isPaused = false;
    pauseMenuEl.classList.add("hidden");
    setMenuOpen(true);
    multiplayer.disconnect(true);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });
}

const loadingScreen = document.querySelector("#loading-screen");
setTimeout(() => {
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => loadingScreen.remove(), 500);
  }
}, 800);

const networkCardEl = document.querySelector("#network-card");
const networkLobbyNameEl = document.querySelector("#network-lobby-name");
const networkStatusTextEl = document.querySelector("#network-status-text");
const joinButtons = Array.from(lobbyMenuEl.querySelectorAll("[data-lobby-id]"));
const lobbyCountEls = {
  solo: document.querySelector("#lobby-count-solo"),
  main: document.querySelector("#lobby-count-main"),
  secondary: document.querySelector("#lobby-count-secondary"),
};
let pendingAutoReadyAfterJoin = false;
const PLAYER_PROFILE_STORAGE_KEY = "s25-ultra-player-profile-v1";
const DEFAULT_SKIN_DATA_URL = getDefaultMinecraftSkinDataUrl();

function createDefaultPlayerProfile() {
  return {
    name: "",
    skinDataUrl: DEFAULT_SKIN_DATA_URL,
  };
}

function sanitizePlayerProfile(profile = {}) {
  return {
    name: sanitizePlayerName(profile.name, ""),
    skinDataUrl: sanitizeSkinDataUrl(profile.skinDataUrl, DEFAULT_SKIN_DATA_URL),
  };
}

function loadStoredPlayerProfile() {
  const fallback = createDefaultPlayerProfile();

  try {
    const raw = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return sanitizePlayerProfile(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function saveStoredPlayerProfile(profile) {
  try {
    window.localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage write failures.
  }
}

const playerProfile = loadStoredPlayerProfile();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc9e6ff, 0.0075);
const textureLoader = new THREE.TextureLoader();
const daySkyTexture = textureLoader.load("/textures/sky-day.jpg");
daySkyTexture.colorSpace = THREE.SRGBColorSpace;
daySkyTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.background = daySkyTexture;
const gltfLoader = new GLTFLoader();
const groundTexture = textureLoader.load("/textures/ground-cover.jpg");
groundTexture.colorSpace = THREE.SRGBColorSpace;
groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
groundTexture.wrapS = THREE.ClampToEdgeWrapping;
groundTexture.wrapT = THREE.ClampToEdgeWrapping;
groundTexture.center.set(0.5, 0.5);
groundTexture.offset.set(-0.16, -0.1);

const GROUND_LAYERS = {
  base: 0,
  legacyMap: 1,
  biomeBase: 2,
  transition: 3,
  biomeDetail: 4,
  roads: 5,
  roadsOverlay: 6,
  sidewalks: 7,
  roadMarks: 8,
  water: 9,
  glow: 10,
};

const camera = new THREE.PerspectiveCamera(
  56,
  window.innerWidth / window.innerHeight,
  0.1,
 240,
);
camera.position.set(0, 3.5, 10);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const projectileRaycaster = new THREE.Raycaster();
const gravity = new THREE.Vector3(0, -19, 0);
const upVector = new THREE.Vector3(0, 1, 0);
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempVecC = new THREE.Vector3();
const tempVecD = new THREE.Vector3();
const tempVecE = new THREE.Vector3();
const tempVecF = new THREE.Vector3();
const tempVecG = new THREE.Vector3();
const tempVecH = new THREE.Vector3();
const tempVecI = new THREE.Vector3();
const tempVecJ = new THREE.Vector3();
const tempVecK = new THREE.Vector3();
const tempVecL = new THREE.Vector3();
const tempVecM = new THREE.Vector3();
const tempVecN = new THREE.Vector3();
const tempVecO = new THREE.Vector3();
const tempVecP = new THREE.Vector3();
const tempVecQ = new THREE.Vector3();
const cameraCenterRay = new THREE.Vector2(0, 0);
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
const phoneAimCenter = new THREE.Vector3();
const aimState = {
  point: new THREE.Vector3(),
  mode: "phone",
};

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};
const poopHoldState = {
  pointerId: null,
  isPointerDown: false,
  holdTime: 0,
  started: false,
};

const phoneMetrics = {
  width: 3.1,
  length: 6.8,
  thickness: 0.32,
};
const standingTargetMetrics = {
  swayBaseY: 1.88,
};

const poopConfig = {
  standX: phoneMetrics.width * 0.49,
  standZ: phoneMetrics.length * 0.49,
  targetX: phoneMetrics.width * 0.42,
  targetZ: phoneMetrics.length * 0.42,
  releaseDuration: 0.24,
  stringSegments: 6,
  holdThreshold: 0.18,
  chainRadius: 0.12,
  chainSegmentLength: 0.13,
  chainSpawnInterval: 0.045,
  chainConstraintIterations: 7,
  chainMaxSegments: 78,
  maxRopes: 8,
  tubeSides: 14,
  tubeOverlayScale: 1.12,
  backwardFlowSpeed: 1.75,
  backwardFlowFalloff: 0.82,
};
const strikeConfig = {
  duration: 0.34,
  cooldown: 0.42,
  range: 3.4,
  assistRange: 11,
  playerTurnSnap: 0.26,
};
const standingTargetPosition = new THREE.Vector3(36.4, 0, -1.8);

const world = {
  arenaRadius: ARENA_RADIUS,
  centralHubRadius: 17,
  legacyMapHalfSize: 26,
  biomeRadius: 15,
  dustRadius: 54,
  phoneCenter: new THREE.Vector3(0, phoneMetrics.thickness / 2 + 0.02, 0),
  forestCenter: new THREE.Vector3(0, 0, -46),
  desertCenter: new THREE.Vector3(47, 0, -6),
  snowCenter: new THREE.Vector3(-47, 0, -6),
  townCenter: new THREE.Vector3(0, 0, 46),
};
const TOWN_EXCLUSION_ZONE = Object.freeze({
  type: "box",
  x: world.townCenter.x,
  z: world.townCenter.z - 1,
  halfX: 28,
  halfZ: 19,
});
const worldColliders = [];
const groundSupports = [];
const heroMetrics = {
  scale: 0.34,
  moveSpeed: 6.5,
  jumpVelocity: 5.5,
  phoneCollisionHeight: 0.14,
  phoneJumpAssistHeight: 0.22,
  worldCollisionHeight: 1.05,
  cameraAnchorHeight: 0.58,
  cameraDistance: 4.5,
  cameraSide: 0.52,
  cameraLift: 0.9,
  cameraLookDistance: 18,
};
const stagingPlatform = {
  center: new THREE.Vector3(STAGING_SPAWN.x, STAGING_SPAWN.y - 0.26, STAGING_SPAWN.z),
  height: STAGING_SPAWN.y,
  halfX: 13,
  halfZ: 9,
};
const glideConfig = {
  airSpeed: 4.2,
  turnSpeed: 5.6,
  fallSpeed: 2.35,
  landingThreshold: 0.18,
};
const busConfig = {
  hoverLift: 0.7,
  lookAhead: 9,
};

const state = {
  playerPosition: new THREE.Vector3(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z),
  playerYaw: PLAYER_SPAWN.yaw,
  cameraYaw: PLAYER_SPAWN.yaw,
  cameraPitch: -0.2,
  moveAmount: 0,
  walkCycle: 0,
  cooldown: 0,
  verticalVelocity: 0,
  grounded: true,
  hemorrhoids: 0,
  totalPoopLength: 0,
  gameOver: false,
  resetTimer: 0,
  isOnPhone: false,
  poopAnimation: 0,
  strikeAnimation: 0,
  strikeResolved: true,
  playerPhase: MATCH_PHASES.staging,
  glideVelocity: new THREE.Vector3(),
  localReady: false,
  announcementKey: "",
  doorPromptSeen: false,
  autoDropTriggered: false,
};

const projectiles = [];
const poopRopes = [];
const splats = [];
const dustPuffs = [];
const impactBursts = [];
let activePoopRope = null;

const projectileMainGeometry = new THREE.CapsuleGeometry(0.11, 0.16, 5, 10);
const projectileNuggetAGeometry = new THREE.SphereGeometry(0.08, 10, 10);
const projectileNuggetBGeometry = new THREE.SphereGeometry(0.065, 10, 10);
const projectileStringGeometry = new THREE.SphereGeometry(0.058, 10, 10);
const splatBlobGeometry = new THREE.SphereGeometry(1, 18, 12);
const splatDropletGeometry = new THREE.SphereGeometry(0.12, 10, 10);
const splatFiberGeometry = new THREE.SphereGeometry(0.025, 7, 7);
const impactRingGeometry = new THREE.RingGeometry(0.12, 0.28, 28);
const impactSparkGeometry = new THREE.SphereGeometry(0.06, 8, 8);
const poopTubeMaterial = createPoopMaterial(0x5c3014, {
  roughness: 0.4,
  clearcoat: 0.3,
  clearcoatRoughness: 0.2,
});
const poopTubeSlimeMaterial = createPoopMaterial(0x7a4720, {
  roughness: 0.22,
  clearcoat: 0.5,
  clearcoatRoughness: 0.08,
  opacity: 0.52,
});

const phoneRig = createPhone();
const aimMarker = createAimMarker();
const dangerRing = createDangerRing();
const standingTarget = createStandingTarget();
const hero = buildHero();
const remotePlayersRoot = new THREE.Group();
const battleBus = createBattleBusRig();

scene.add(phoneRig);
scene.add(aimMarker);
scene.add(dangerRing);
scene.add(standingTarget.root);
scene.add(hero.root);
scene.add(remotePlayersRoot);
scene.add(battleBus.group);

const multiplayerState = {
  selfId: null,
  lobbyId: null,
  joined: false,
  selfName: "",
  selfColor: "#fcee0a",
  localActionState: createActionState(),
  matchState: createMatchState(),
  lobbyCounts: {
    solo: 0,
    main: 0,
    secondary: 0,
  },
  lobbyStatus: {
    solo: {
      playerCount: 0,
      readyCount: 0,
      phase: MATCH_PHASES.staging,
    },
    main: {
      playerCount: 0,
      readyCount: 0,
      phase: MATCH_PHASES.staging,
    },
    secondary: {
      playerCount: 0,
      readyCount: 0,
      phase: MATCH_PHASES.staging,
    },
  },
  remotePlayers: new Map(),
  playerRoster: new Map(),
  menuOpen: true,
};

const multiplayer = new MultiplayerClient({
  onLobbySnapshot: handleLobbySnapshot,
  onStateChange: handleMultiplayerStateChange,
  onWelcome: handleLobbyWelcome,
  onPresence: handleLobbyPresence,
  onMatchState: handleMatchStateMessage,
  onPose: handleLobbyPose,
  onAction: handleLobbyAction,
  onWorldEvent: handleLobbyWorldEvent,
  onError: handleMultiplayerError,
});

multiplayer.setProfile(playerProfile);
setMinecraftAvatarSkin(hero, playerProfile.skinDataUrl);
setMinecraftAvatarName(hero, playerProfile.name || "Du");

setupLights();
setupWorld();
resetRound(true);

window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("pointerlockchange", onPointerLockChange);
window.addEventListener("pointerlockerror", onPointerLockError);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerCancel);
window.addEventListener("blur", onWindowBlur);
document.addEventListener("visibilitychange", onVisibilityChange);
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerleave", onPointerLeave);
joinButtons.forEach((button) => {
  button.addEventListener("click", onLobbyButtonClick);
});
if (readyBtn) {
  readyBtn.addEventListener("click", onReadyButtonClick);
}
if (profileToggleBtn) {
  profileToggleBtn.addEventListener("click", () => {
    profileEditorEl?.classList.toggle("hidden");
  });
}
if (profileNameInputEl) {
  profileNameInputEl.maxLength = PLAYER_NAME_MAX_LENGTH;
  profileNameInputEl.addEventListener("input", onProfileNameInput);
}
if (profileSkinInputEl) {
  profileSkinInputEl.addEventListener("change", onProfileSkinInput);
}
if (profileResetSkinBtn) {
  profileResetSkinBtn.addEventListener("click", onProfileResetSkin);
}

initializeMultiplayerUi();
loadBattleBusModel();
animate();

function createBattleBusRig() {
  const group = new THREE.Group();
  const fallback = createBattleBusFallback();
  group.add(fallback);
  group.visible = false;
  return {
    group,
    fallback,
    model: null,
  };
}

function createBattleBusFallback() {
  const root = new THREE.Group();
  const balloonMaterial = new THREE.MeshStandardMaterial({
    color: 0x4fb2ff,
    roughness: 0.45,
    metalness: 0.08,
  });
  const busMaterial = new THREE.MeshStandardMaterial({
    color: 0x2755c8,
    roughness: 0.52,
    metalness: 0.18,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5df3d,
    roughness: 0.36,
    metalness: 0.2,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x22303f,
    roughness: 0.72,
    metalness: 0.06,
  });

  const balloon = new THREE.Mesh(new THREE.SphereGeometry(3.15, 20, 18), balloonMaterial);
  balloon.scale.set(1, 0.95, 1.14);
  balloon.position.set(0, 5.3, 0.2);
  balloon.castShadow = true;
  root.add(balloon);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.96, 1.1, 14), trimMaterial);
  crown.position.set(0, 8.4, 0.2);
  crown.castShadow = true;
  root.add(crown);

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.55, 2.05), busMaterial);
  body.position.set(0, 1.1, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.25, 1.85), darkMaterial);
  cabin.position.set(1.55, 1.48, 0);
  cabin.castShadow = true;
  root.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.3, 1.9), trimMaterial);
  roof.position.set(-0.08, 2.02, 0);
  roof.castShadow = true;
  root.add(roof);

  const harness = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 12), trimMaterial);
  harness.position.set(0, 3.1, 0.15);
  harness.castShadow = true;
  root.add(harness);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.74, 1.58), darkMaterial);
  engine.position.set(-2.8, 1.03, 0);
  engine.castShadow = true;
  root.add(engine);

  const cableGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4.1, 10);
  const cableOffsets = [
    [-1.42, 3.4, -0.7],
    [1.42, 3.4, -0.7],
    [-1.42, 3.4, 0.7],
    [1.42, 3.4, 0.7],
  ];
  cableOffsets.forEach(([x, y, z]) => {
    const cable = new THREE.Mesh(cableGeometry, darkMaterial);
    cable.position.set(x, y, z);
    cable.castShadow = true;
    root.add(cable);
  });

  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
  const wheelOffsets = [
    [-1.6, 0.42, -1.12],
    [1.4, 0.42, -1.12],
    [-1.6, 0.42, 1.12],
    [1.4, 0.42, 1.12],
  ];
  wheelOffsets.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, darkMaterial);
    wheel.position.set(x, y, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    root.add(wheel);
  });

  const thrusterGeometry = new THREE.CylinderGeometry(0.18, 0.25, 1.05, 12);
  [-0.58, 0.58].forEach((z) => {
    const thruster = new THREE.Mesh(thrusterGeometry, trimMaterial);
    thruster.position.set(-2.85, 1.22, z);
    thruster.rotation.z = Math.PI / 2;
    thruster.castShadow = true;
    root.add(thruster);
  });

  return root;
}

function loadBattleBusModel() {
  gltfLoader.load(
    "/models/battle-bus.glb",
    (gltf) => {
      const model = gltf.scene;
      pruneBattleBusModel(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(tempVecA);
      const maxSide = Math.max(size.x, size.y, size.z, 1);
      const scale = 8.2 / maxSide;
      model.scale.setScalar(scale);
      const normalizedBox = new THREE.Box3().setFromObject(model);
      const center = normalizedBox.getCenter(tempVecB).clone();
      const minY = normalizedBox.min.y;
      model.position.sub(center);
      model.position.y -= minY;
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      battleBus.group.add(model);
      battleBus.model = model;
      battleBus.fallback.visible = false;
    },
    undefined,
    () => {
      battleBus.fallback.visible = true;
    },
  );
}

function pruneBattleBusModel(model) {
  const meshEntries = [];
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const volume = size.x * size.y * size.z;
    const maxDim = Math.max(size.x, size.y, size.z);
    const minDim = Math.min(size.x, size.y, size.z);
    const ratio = minDim > 0 ? maxDim / minDim : Number.POSITIVE_INFINITY;

    meshEntries.push({
      object,
      size,
      volume,
      maxDim,
      ratio,
    });
  });

  if (meshEntries.length === 0) {
    return;
  }

  meshEntries.sort((first, second) => second.maxDim - first.maxDim);
  const largest = meshEntries[0];
  const secondLargest = meshEntries[1]?.maxDim ?? 0;
  const looksLikeHugeSphere =
    largest.ratio < 1.35 &&
    largest.maxDim > 100 &&
    largest.maxDim > secondLargest * 2.4;

  if (!looksLikeHugeSphere) {
    return;
  }

  largest.object.parent?.remove(largest.object);
}

function getSortedRosterPlayers() {
  return Array.from(multiplayerState.playerRoster.values()).sort(
    (first, second) => (first.guestIndex ?? 0) - (second.guestIndex ?? 0),
  );
}

function setRosterPlayers(players = []) {
  multiplayerState.playerRoster.clear();
  players.forEach((player) => {
    multiplayerState.playerRoster.set(player.id, {
      ...player,
      ready: Boolean(player.ready),
      playerPhase: player.playerPhase ?? MATCH_PHASES.staging,
    });
  });
  syncLocalRosterState();
  renderLobbyPlayerList();
}

function upsertRosterPlayer(player) {
  if (!player?.id) {
    return;
  }

  const previous = multiplayerState.playerRoster.get(player.id) ?? {};
  multiplayerState.playerRoster.set(player.id, {
    ...previous,
    ...player,
    ready: Boolean(player.ready ?? previous.ready),
    playerPhase: player.playerPhase ?? previous.playerPhase ?? MATCH_PHASES.staging,
  });
  syncLocalRosterState();
  renderLobbyPlayerList();
}

function removeRosterPlayer(playerId) {
  multiplayerState.playerRoster.delete(playerId);
  renderLobbyPlayerList();
}

function syncLocalRosterState() {
  const localPlayer = multiplayerState.playerRoster.get(multiplayerState.selfId);
  if (!localPlayer) {
    return;
  }

  state.localReady = Boolean(localPlayer.ready);
  multiplayerState.selfName = localPlayer.name ?? multiplayerState.selfName;
  setMinecraftAvatarName(hero, multiplayerState.selfName || playerProfile.name || "Du");
  if (localPlayer.skinDataUrl) {
    setMinecraftAvatarSkin(hero, localPlayer.skinDataUrl);
  }
}

function renderLobbyPlayerList() {
  if (!lobbyPlayerListEl) {
    return;
  }

  lobbyPlayerListEl.textContent = "";
  const roster = getSortedRosterPlayers();
  for (const player of roster) {
    const row = document.createElement("div");
    row.className = "lobby-player";

    const swatch = document.createElement("span");
    swatch.className = "lobby-player__swatch";
    swatch.style.background = player.color ?? "#fff";

    const name = document.createElement("span");
    name.className = "lobby-player__name";
    name.textContent = player.id === multiplayerState.selfId ? `${player.name} (du)` : player.name;

    const status = document.createElement("span");
    status.className = `lobby-player__status ${
      player.ready ? "lobby-player__status--ready" : "lobby-player__status--waiting"
    }`;
    status.textContent = player.ready ? "Ready" : "Väntar";

    row.append(swatch, name, status);
    lobbyPlayerListEl.append(row);
  }
}

function getMatchPhaseLabel(phase) {
  if (phase === MATCH_PHASES.countdown) {
    return "MATCH STARTAR";
  }
  if (phase === MATCH_PHASES.bus) {
    return "BATTLE BUS";
  }
  if (phase === MATCH_PHASES.glide) {
    return "GLIDER";
  }
  if (phase === MATCH_PHASES.active) {
    return "PÅ ÖN";
  }
  return "VÄNTELOBBY";
}

function syncMatchPanel(now = Date.now()) {
  if (!matchPanelEl) {
    return;
  }

  const lobbyPhase = multiplayerState.matchState.phase ?? MATCH_PHASES.staging;
  const playerCount = multiplayerState.matchState.playerCount ?? 0;
  const readyCount = multiplayerState.matchState.readyCount ?? 0;

  const isLobbyPhase = lobbyPhase === MATCH_PHASES.staging || lobbyPhase === MATCH_PHASES.countdown;
  matchPanelEl.classList.toggle("hidden", !multiplayerState.joined || multiplayerState.menuOpen || !isLobbyPhase);
  if (matchPhaseLabelEl) {
    matchPhaseLabelEl.textContent = getMatchPhaseLabel(
      state.playerPhase === MATCH_PHASES.glide ? MATCH_PHASES.glide : lobbyPhase,
    );
  }

  if (matchPanelTitleEl) {
    if (lobbyPhase === MATCH_PHASES.countdown) {
      matchPanelTitleEl.textContent = "Alla är redo. Bussen går snart.";
    } else if (lobbyPhase === MATCH_PHASES.bus) {
      matchPanelTitleEl.textContent = "Battle Bus över ön";
    } else if (state.playerPhase === MATCH_PHASES.glide) {
      matchPanelTitleEl.textContent = "Segla ner mot ön";
    } else if (lobbyPhase === MATCH_PHASES.active) {
      matchPanelTitleEl.textContent = "Matchen är live";
    } else {
      matchPanelTitleEl.textContent =
        playerCount <= 1 ? "Redo för solo-test" : "Vänta in squaden";
    }
  }

  if (matchPanelSubtitleEl) {
    if (lobbyPhase === MATCH_PHASES.staging || lobbyPhase === MATCH_PHASES.countdown) {
      if (playerCount <= 0) {
        matchPanelSubtitleEl.textContent = "Ansluter till lobbyn...";
      } else if (playerCount === 1) {
        matchPanelSubtitleEl.textContent =
          `${readyCount}/1 redo. Tryck Ready för att starta en solo-match med battle bussen.`;
      } else if (playerCount >= MIN_PLAYERS_TO_START) {
        matchPanelSubtitleEl.textContent =
          `${readyCount}/${playerCount} redo. Alla i lobbyn måste vara ready för att countdown ska fortsätta.`;
      } else {
        matchPanelSubtitleEl.textContent =
          `Minst ${MIN_PLAYERS_TO_START} spelare behövs för att kunna starta matchen.`;
      }
    } else if (lobbyPhase === MATCH_PHASES.bus) {
      matchPanelSubtitleEl.textContent = "Dörrarna öppnas först när bussen är över ön.";
    } else if (state.playerPhase === MATCH_PHASES.glide) {
      matchPanelSubtitleEl.textContent = "Du glider långsamt ner och kan styra lite lätt i luften.";
    } else {
      matchPanelSubtitleEl.textContent = "Landa och återgå till det vanliga kaoset.";
    }
  }

  if (countdownChipEl) {
    if (
      lobbyPhase === MATCH_PHASES.countdown &&
      Number.isFinite(multiplayerState.matchState.countdownEndsAt)
    ) {
      const secondsLeft = Math.max(
        0,
        Math.ceil((multiplayerState.matchState.countdownEndsAt - now) / 1000),
      );
      countdownChipEl.textContent = `${secondsLeft}s`;
      countdownChipEl.classList.remove("hidden");
    } else {
      countdownChipEl.classList.add("hidden");
    }
  }

  if (readyBtn) {
    const showReady =
      multiplayerState.joined &&
      !multiplayerState.menuOpen &&
      (lobbyPhase === MATCH_PHASES.staging || lobbyPhase === MATCH_PHASES.countdown);
    readyBtn.classList.toggle("hidden", !showReady);
    readyBtn.disabled = !showReady;
    readyBtn.textContent = state.localReady ? "UNREADY" : "READY";
    readyBtn.classList.toggle("is-ready", state.localReady);
  }

  if (leaveLobbyBtn) {
    const showLeave =
      multiplayerState.joined &&
      !multiplayerState.menuOpen &&
      (lobbyPhase === MATCH_PHASES.staging || lobbyPhase === MATCH_PHASES.countdown);
    leaveLobbyBtn.classList.toggle("hidden", !showLeave);
  }
}

function syncAnnouncementPrompts(now = Date.now()) {
  const lobbyPhase = multiplayerState.matchState.phase ?? MATCH_PHASES.staging;
  let bannerText = "";
  let showJumpPrompt = false;

  if (
    lobbyPhase === MATCH_PHASES.bus &&
    Number.isFinite(multiplayerState.matchState.doorsOpenAt) &&
    now >= multiplayerState.matchState.doorsOpenAt
  ) {
    bannerText = "DÖRRARNA ÖPPNAS";
    showJumpPrompt = state.playerPhase === MATCH_PHASES.bus;
  }

  if (announcementBannerEl) {
    announcementBannerEl.classList.toggle("hidden", !bannerText);
  }
  if (announcementTextEl && bannerText) {
    announcementTextEl.textContent = bannerText;
  }
  if (jumpPromptEl) {
    jumpPromptEl.classList.toggle("hidden", !showJumpPrompt);
  }
}

function getBusProgress(now = Date.now()) {
  const startedAt = multiplayerState.matchState.busStartedAt;
  const endsAt = multiplayerState.matchState.busEndsAt;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endsAt) || endsAt <= startedAt) {
    return 0;
  }

  return THREE.MathUtils.clamp((now - startedAt) / (endsAt - startedAt), 0, 1);
}

function getBusTransform(now = Date.now()) {
  const progress = getBusProgress(now);
  const position = tempVecA
    .set(BUS_ROUTE.start.x, BUS_ROUTE.start.y, BUS_ROUTE.start.z)
    .lerp(tempVecB.set(BUS_ROUTE.end.x, BUS_ROUTE.end.y, BUS_ROUTE.end.z), progress)
    .clone();
  const direction = tempVecC
    .set(
      BUS_ROUTE.end.x - BUS_ROUTE.start.x,
      BUS_ROUTE.end.y - BUS_ROUTE.start.y,
      BUS_ROUTE.end.z - BUS_ROUTE.start.z,
    )
    .normalize()
    .clone();
  position.y += Math.sin(progress * Math.PI * 6) * 0.24 + busConfig.hoverLift;

  return {
    position,
    direction,
    progress,
    yaw: Math.atan2(direction.x, direction.z),
  };
}

function getBusSeatLocalOffset(guestIndex = 0) {
  const lane = guestIndex % 2 === 0 ? -1 : 1;
  const row = Math.floor(guestIndex / 2) % 4;
  return tempVecD.set(lane * 1.25, 0.35, 1.55 - row * 0.9);
}

function getBusSeatWorldPosition(guestIndex = 0, now = Date.now(), target = new THREE.Vector3()) {
  const transform = getBusTransform(now);
  const localOffset = getBusSeatLocalOffset(guestIndex).clone();
  localOffset.applyAxisAngle(upVector, transform.yaw);
  return target.copy(transform.position).add(localOffset);
}

function updateBattleBusVisual(now = Date.now()) {
  const shouldShow =
    multiplayerState.joined &&
    !multiplayerState.menuOpen &&
    multiplayerState.matchState.phase === MATCH_PHASES.bus;
  battleBus.group.visible = shouldShow;
  if (!shouldShow) {
    return;
  }

  const transform = getBusTransform(now);
  battleBus.group.position.copy(transform.position);
  battleBus.group.rotation.set(0, transform.yaw, 0);
  battleBus.group.rotation.z = Math.sin(transform.progress * Math.PI * 4) * 0.02;
}

function setupLights() {
  const hemisphere = new THREE.HemisphereLight(0xdcecff, 0x5f6b56, 1.65);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffefd3, 2.75);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  const rim = new THREE.PointLight(0xe7a66a, 12, 32, 2);
  rim.position.set(-10, 7, -8);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xb9cfff, 1.15);
  fill.position.set(-10, 8, 12);
  scene.add(fill);
}

function setupWorld() {
  worldColliders.length = 0;
  groundSupports.length = 0;

  const baseGround = new THREE.Mesh(
    new THREE.PlaneGeometry(174, 174),
    new THREE.MeshStandardMaterial({
      color: 0x7b8d6b,
      roughness: 0.98,
      metalness: 0.02,
    }),
  );
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.position.y = -0.02;
  configureGroundSurface(baseGround, { layer: GROUND_LAYERS.base });
  baseGround.receiveShadow = true;
  scene.add(baseGround);

  addLegacyMapPlate();

  addBiomePatch({
    position: world.forestCenter,
    radius: world.biomeRadius + 3.4,
    color: 0x5f7a4f,
    opacity: 0.82,
    scaleX: 1.08,
    scaleZ: 1.22,
    rotation: 0.18,
  });
  addBiomePatch({
    position: world.desertCenter,
    radius: world.biomeRadius + 2.8,
    color: 0xcfb06d,
    opacity: 0.92,
    scaleX: 1.22,
    scaleZ: 1.08,
    rotation: -0.3,
  });
  addBiomePatch({
    position: world.snowCenter,
    radius: world.biomeRadius + 3.2,
    color: 0xdfe9ef,
    opacity: 0.9,
    scaleX: 1.16,
    scaleZ: 1.18,
    rotation: 0.12,
  });
  addBiomePatch({
    position: world.townCenter,
    radius: world.biomeRadius + 4.2,
    color: 0x81867e,
    opacity: 0.74,
    scaleX: 1.24,
    scaleZ: 1.1,
    rotation: -0.16,
  });
  addTransitionGround();

  const grassGlow = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 60),
    new THREE.MeshStandardMaterial({
      color: 0xbac28d,
      roughness: 1,
      transparent: true,
      opacity: 0.3,
    }),
  );
  grassGlow.rotation.x = -Math.PI / 2;
  grassGlow.position.set(world.phoneCenter.x, 0.012, world.phoneCenter.z);
  configureGroundSurface(grassGlow, { layer: GROUND_LAYERS.glow });
  scene.add(grassGlow);



  addRoadSegment({
    position: new THREE.Vector3(0, 0, -39.5),
    width: 5.2,
    length: 18,
    color: 0x7d715f,
  });
  addRoadSegment({
    position: new THREE.Vector3(40, 0, -6),
    width: 18,
    length: 5.4,
    color: 0xb79c6c,
    rotation: Math.PI / 2,
  });
  addRoadSegment({
    position: new THREE.Vector3(-40, 0, -5.4),
    width: 18,
    length: 5.2,
    color: 0xc5d0d8,
    rotation: Math.PI / 2,
  });
  addRoadSegment({
    position: new THREE.Vector3(0, 0, 40.2),
    width: 6.2,
    length: 16,
    color: 0x5d5e5d,
  });
  addRoadSegment({
    position: world.townCenter,
    width: 32,
    length: 7.2,
    color: 0x4f5050,
    rotation: Math.PI / 2,
    layer: GROUND_LAYERS.roads,
  });
  addRoadSegment({
    position: world.townCenter,
    width: 9.2,
    length: 30,
    color: 0x4d4f50,
    layer: GROUND_LAYERS.roadsOverlay,
  });
  addTownLaneMarks();

  addCentralLandmarks();
  addTransitionCover();
  addCozyConnectors();
  addForestBiome();
  addDesertBiome();
  addSnowBiome();
  addTownBiome();
  addPerimeterRidge();
  addStagingLobby();

  const dustGeometry = new THREE.SphereGeometry(0.05, 6, 6);
  for (let index = 0; index < 54; index += 1) {
    const particle = new THREE.Mesh(
      dustGeometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.12 + Math.random() * 0.06, 0.2, 0.84),
        transparent: true,
        opacity: 0.05 + Math.random() * 0.06,
      }),
    );
    particle.position.set(
      THREE.MathUtils.randFloatSpread(world.dustRadius * 1.7),
      1.4 + Math.random() * 6.6,
      THREE.MathUtils.randFloatSpread(world.dustRadius * 1.7),
    );
    particle.userData = {
      drift: new THREE.Vector3(
        THREE.MathUtils.randFloat(-0.16, 0.16),
        THREE.MathUtils.randFloat(0.01, 0.05),
        THREE.MathUtils.randFloat(-0.16, 0.16),
      ),
      phase: Math.random() * Math.PI * 2,
    };
    dustPuffs.push(particle);
    scene.add(particle);
  }

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffdf42,
    }),
  );
  sunDisc.position.set(-38, 18, -54);
  scene.add(sunDisc);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(2.7, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff3a6,
      transparent: true,
      opacity: 0.18,
    }),
  );
  sunHalo.position.copy(sunDisc.position);
  scene.add(sunHalo);

}

function addStagingLobby() {
  // Staging platform meshes removed so it's just a UI menu. The logic inside keepInsideStagingPlatform keeps players physically stable instead.
}

function addLegacyMapPlate() {
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(54.6, 0.32, 54.6),
    new THREE.MeshStandardMaterial({
      color: 0x7d786e,
      roughness: 0.94,
      metalness: 0.06,
    }),
  );
  plate.position.y = -0.11;
  plate.receiveShadow = true;
  scene.add(plate);
  registerRectGroundSupport({
    position: plate.position,
    width: 54.6,
    depth: 54.6,
    height: plate.position.y + 0.16,
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.055;
  configureGroundSurface(ground, { layer: GROUND_LAYERS.legacyMap });
  ground.receiveShadow = true;
  scene.add(ground);
  registerRectGroundSupport({
    position: ground.position,
    width: 52,
    depth: 52,
    height: ground.position.y,
  });
}

function addTransitionGround() {
  [
    {
      position: new THREE.Vector3(0, 0, -36),
      radius: 11.8,
      color: 0x6f845a,
      opacity: 0.3,
      scaleX: 1.4,
      scaleZ: 0.92,
      rotation: 0.08,
    },
    {
      position: new THREE.Vector3(33, 0, -18),
      radius: 11.4,
      color: 0xa49c70,
      opacity: 0.28,
      scaleX: 1.34,
      scaleZ: 0.86,
      rotation: -0.28,
    },
    {
      position: new THREE.Vector3(-33, 0, -18),
      radius: 11.2,
      color: 0xc5d3d8,
      opacity: 0.26,
      scaleX: 1.3,
      scaleZ: 0.86,
      rotation: 0.22,
    },
    {
      position: new THREE.Vector3(0, 0, 36),
      radius: 12.8,
      color: 0x7b8178,
      opacity: 0.24,
      scaleX: 1.24,
      scaleZ: 0.92,
      rotation: -0.12,
    },
    {
      position: new THREE.Vector3(26, 0, 30),
      radius: 10.8,
      color: 0x9b9d77,
      opacity: 0.18,
      scaleX: 1.18,
      scaleZ: 0.92,
      rotation: -0.22,
    },
    {
      position: new THREE.Vector3(-26, 0, 30),
      radius: 10.8,
      color: 0x9fb1a4,
      opacity: 0.18,
      scaleX: 1.18,
      scaleZ: 0.92,
      rotation: 0.26,
    },
  ].forEach((patch) => addBiomePatch({ ...patch, layer: GROUND_LAYERS.transition }));
}

function addTransitionCover() {
  addFlowerBeds();

  const forestEdgeTrees = scatterPoints({
    center: new THREE.Vector3(0, 0, -37),
    radius: 15.5,
    count: 18,
    seed: 421,
    minDistance: 3.2,
    avoid: [{ type: "box", x: 0, z: 0, halfX: 30, halfZ: 30 }],
  });
  addForestTrees(forestEdgeTrees, 0.8, 0.42);

  const snowEdgeTrees = scatterPoints({
    center: new THREE.Vector3(-35, 0, -20),
    radius: 13.8,
    count: 11,
    seed: 431,
    minDistance: 3.1,
    avoid: [{ type: "box", x: 0, z: 0, halfX: 30, halfZ: 30 }],
  });
  addPineTrees(snowEdgeTrees, 0.82, 0.34);

  addRockScatter({
    center: new THREE.Vector3(35, 0, -18),
    radius: 14,
    count: 12,
    seed: 443,
    color: 0x8d775a,
    minScale: 0.6,
    maxScale: 1.6,
  });

  const connectorShrubs = scatterPoints({
    center: new THREE.Vector3(0, 0, 36),
    radius: 18,
    count: 22,
    seed: 451,
    minDistance: 2.4,
    avoid: [
      { type: "box", x: 0, z: 0, halfX: 30, halfZ: 30 },
      TOWN_EXCLUSION_ZONE,
    ],
  });
  const shrubMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.56, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x6f8560,
      roughness: 0.96,
    }),
    connectorShrubs.length,
  );
  fillInstanceTransforms(shrubMesh, connectorShrubs, (dummy, index) => {
    dummy.position.set(connectorShrubs[index].x, 0.28, connectorShrubs[index].z);
    dummy.scale.set(
      1.3 + (index % 4) * 0.22,
      0.72 + (index % 3) * 0.08,
      1.1 + (index % 2) * 0.16,
    );
  });
  shrubMesh.receiveShadow = true;
  scene.add(shrubMesh);
  connectorShrubs.forEach((position, index) => {
    const size = 1.1 + (index % 4) * 0.14;
    registerCylinderCollider(position, 0.5 * size, 0.2);
  });

  [
    new THREE.Vector3(-40, 0, 13),
    new THREE.Vector3(40, 0, 13),
    new THREE.Vector3(-14, 0, -42),
    new THREE.Vector3(14, 0, -42),
    new THREE.Vector3(-22, 0, 40),
    new THREE.Vector3(22, 0, 40),
  ].forEach((position, index) => {
    addRock({
      position,
      scale: new THREE.Vector3(1.8, 1.4 + (index % 2) * 0.25, 1.5),
      color: index % 2 === 0 ? 0x7f7366 : 0x8f806d,
    });
    registerCylinderCollider(position, 1.55, 0.32);
  });
}

function addCozyConnectors() {
  const northLeftWall = buildPathPoints(
    [
      new THREE.Vector3(-10.5, 0, -31),
      new THREE.Vector3(-13.2, 0, -38),
      new THREE.Vector3(-10.8, 0, -48),
    ],
    2.8,
    0.75,
    601,
  );
  const northRightWall = buildPathPoints(
    [
      new THREE.Vector3(10.5, 0, -31),
      new THREE.Vector3(13.4, 0, -38),
      new THREE.Vector3(11.2, 0, -48),
    ],
    2.8,
    0.75,
    603,
  );
  addForestTrees(northLeftWall, 0.86, 0.42);
  addForestTrees(northRightWall, 0.88, 0.42);
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(-15, 0, -33),
        new THREE.Vector3(-18, 0, -42),
        new THREE.Vector3(-16, 0, -51),
      ],
      2.3,
      0.8,
      605,
    ),
    { color: 0x6d855c, scale: 1.15 },
  );
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(15, 0, -33),
        new THREE.Vector3(18, 0, -42),
        new THREE.Vector3(16, 0, -51),
      ],
      2.3,
      0.8,
      607,
    ),
    { color: 0x6d855c, scale: 1.15 },
  );

  const eastUpperWall = buildPathPoints(
    [
      new THREE.Vector3(31, 0, 7),
      new THREE.Vector3(39, 0, 8),
      new THREE.Vector3(49, 0, 4),
    ],
    2.9,
    0.8,
    611,
  );
  const eastLowerWall = buildPathPoints(
    [
      new THREE.Vector3(31, 0, -17),
      new THREE.Vector3(39, 0, -16),
      new THREE.Vector3(49, 0, -10),
    ],
    2.9,
    0.8,
    613,
  );
  addRockLine(eastUpperWall, { color: 0x927255, scale: 1.18, collider: 0.86 });
  addRockLine(eastLowerWall, { color: 0x8d6a49, scale: 1.14, collider: 0.82 });
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(34, 0, -4),
        new THREE.Vector3(42, 0, -2),
        new THREE.Vector3(50, 0, -2),
      ],
      2.4,
      0.45,
      617,
    ),
    { color: 0x829060, scale: 0.9 },
  );

  const westUpperWall = buildPathPoints(
    [
      new THREE.Vector3(-31, 0, 7),
      new THREE.Vector3(-39, 0, 8),
      new THREE.Vector3(-49, 0, 4),
    ],
    2.9,
    0.8,
    621,
  );
  const westLowerWall = buildPathPoints(
    [
      new THREE.Vector3(-31, 0, -17),
      new THREE.Vector3(-39, 0, -16),
      new THREE.Vector3(-49, 0, -10),
    ],
    2.9,
    0.8,
    623,
  );
  addPineTrees(westUpperWall, 0.88, 0.34);
  addRockLine(westLowerWall, { color: 0x8b9199, scale: 1.02, collider: 0.76 });
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(-34, 0, -5),
        new THREE.Vector3(-42, 0, -3),
        new THREE.Vector3(-49, 0, -2),
      ],
      2.5,
      0.4,
      625,
    ),
    { color: 0x79908a, scale: 0.86 },
  );

  const southLeftWall = buildPathPoints(
    [
      new THREE.Vector3(-10, 0, 31),
      new THREE.Vector3(-12, 0, 39),
      new THREE.Vector3(-10, 0, 50),
    ],
    2.8,
    0.7,
    631,
  );
  const southRightWall = buildPathPoints(
    [
      new THREE.Vector3(10, 0, 31),
      new THREE.Vector3(12, 0, 39),
      new THREE.Vector3(10, 0, 50),
    ],
    2.8,
    0.7,
    633,
  );
  addRockLine(southLeftWall, { color: 0x7b7467, scale: 1.02, collider: 0.8 });
  addRockLine(southRightWall, { color: 0x7b7467, scale: 1.02, collider: 0.8 });
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(-16, 0, 33),
        new THREE.Vector3(-18, 0, 42),
        new THREE.Vector3(-15, 0, 52),
      ],
      2.3,
      0.55,
      637,
    ),
    { color: 0x6d7961, scale: 1.12 },
  );
  addShrubLine(
    buildPathPoints(
      [
        new THREE.Vector3(16, 0, 33),
        new THREE.Vector3(18, 0, 42),
        new THREE.Vector3(15, 0, 52),
      ],
      2.3,
      0.55,
      639,
    ),
    { color: 0x6d7961, scale: 1.12 },
  );

  addRockScatter({
    center: new THREE.Vector3(29, 0, 28),
    radius: 10.5,
    count: 10,
    seed: 641,
    color: 0x84735f,
    minScale: 0.72,
    maxScale: 1.42,
  });
  addRockScatter({
    center: new THREE.Vector3(-29, 0, 28),
    radius: 10.5,
    count: 10,
    seed: 643,
    color: 0x7d8185,
    minScale: 0.72,
    maxScale: 1.32,
  });
  addForestTrees(
    buildPathPoints(
      [
        new THREE.Vector3(23, 0, -27),
        new THREE.Vector3(31, 0, -32),
        new THREE.Vector3(39, 0, -36),
      ],
      3.1,
      0.7,
      645,
    ),
    0.78,
    0.34,
  );
  addPineTrees(
    buildPathPoints(
      [
        new THREE.Vector3(-23, 0, -27),
        new THREE.Vector3(-31, 0, -32),
        new THREE.Vector3(-39, 0, -36),
      ],
      3.1,
      0.7,
      647,
    ),
    0.82,
    0.28,
  );
}

function addFlowerBeds() {
  const bedCenters = [
    new THREE.Vector3(-30.5, 0, -25.8),
    new THREE.Vector3(30.5, 0, -25.8),
    new THREE.Vector3(-30.5, 0, 25.8),
    new THREE.Vector3(30.5, 0, 25.8),
  ];
  const flowerPalette = [0xf6efe7, 0xf3d7bc, 0xe8d7ca, 0xf2ead1];

  bedCenters.forEach((center, bedIndex) => {
    const points = scatterPoints({
      center,
      radius: 4.2,
      count: 14,
      seed: 480 + bedIndex,
      minDistance: 0.78,
    });
    points.forEach((point, index) => {
      const flower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.22, 7),
        new THREE.MeshStandardMaterial({
          color: 0x76865f,
          roughness: 0.92,
        }),
      );
      flower.position.set(point.x, 0.05, point.z);
      flower.rotation.z = Math.sin(index * 1.8) * 0.18;
      flower.receiveShadow = true;

      const petals = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshStandardMaterial({
          color: flowerPalette[(index + bedIndex) % flowerPalette.length],
          roughness: 0.82,
        }),
      );
      petals.position.y = 0.13;
      petals.scale.set(1, 0.5, 1);
      flower.add(petals);

      const centerDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xd3b069,
          roughness: 0.78,
        }),
      );
      centerDot.position.y = 0.14;
      flower.add(centerDot);

      scene.add(flower);
    });
  });
}

function addBiomePatch({
  position,
  radius,
  color,
  y = 0.01,
  layer = GROUND_LAYERS.biomeBase,
  opacity = 1,
  scaleX = 1,
  scaleZ = 1,
  rotation = 0,
  map = null,
}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: 0.96,
    metalness: 0.02,
    transparent: opacity < 1,
    opacity,
  });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 56), material);
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = rotation;
  patch.position.set(position.x, y, position.z);
  patch.scale.set(scaleX, 1, scaleZ);
  configureGroundSurface(patch, { layer });
  patch.receiveShadow = true;
  scene.add(patch);
  return patch;
}

function configureGroundSurface(mesh, { layer, transparent = mesh.material.transparent } = {}) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.renderOrder = 10 + layer;
  mesh.position.y += layer * 0.0025;
  materials.forEach((material) => {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1 - layer * 2;
    material.polygonOffsetUnits = -1 - layer * 2;
    material.depthWrite = !transparent;
  });
}

function addRoadSegment({
  position,
  width,
  length,
  color,
  rotation = 0,
  y = 0.016,
  layer = GROUND_LAYERS.roads,
}) {
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.06,
    }),
  );
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = rotation;
  road.position.set(position.x, y, position.z);
  configureGroundSurface(road, { layer });
  road.receiveShadow = true;
  scene.add(road);
  registerRectGroundSupport({
    position: road.position,
    width,
    depth: length,
    height: road.position.y,
    rotation,
  });
  return road;
}

function addTownLaneMarks() {
  const markMaterial = new THREE.MeshBasicMaterial({
    color: 0xf1ead4,
    transparent: true,
    opacity: 0.84,
  });
  for (let index = -2; index <= 2; index += 1) {
    if (index === 0) {
      continue;
    }
    const horizontalMark = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), markMaterial);
    horizontalMark.rotation.x = -Math.PI / 2;
    horizontalMark.position.set(index * 5.6, 0.025, world.townCenter.z);
    configureGroundSurface(horizontalMark, { layer: GROUND_LAYERS.roadMarks, transparent: true });
    scene.add(horizontalMark);
  }
  for (let index = -3; index <= 3; index += 1) {
    if (index === 0) {
      continue;
    }
    const verticalMark = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.05), markMaterial);
    verticalMark.rotation.x = -Math.PI / 2;
    verticalMark.position.set(0, 0.025, world.townCenter.z + index * 4.4);
    configureGroundSurface(verticalMark, { layer: GROUND_LAYERS.roadMarks, transparent: true });
    scene.add(verticalMark);
  }
}

function addCentralLandmarks() {
  const outerCoverPositions = [
    new THREE.Vector3(-36, 0, -12),
    new THREE.Vector3(36, 0, -12),
    new THREE.Vector3(-30, 0, 34),
    new THREE.Vector3(30, 0, 34),
  ];
  outerCoverPositions.forEach((position, index) => {
    addRock({
      position,
      scale: new THREE.Vector3(1.45, 0.95 + (index % 2) * 0.24, 1.28),
      color: index % 2 === 0 ? 0x746a5d : 0x857968,
    });
    registerCylinderCollider(position, 1.35, 0.62);
  });

  const lookoutRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.12, 16, 60),
    new THREE.MeshStandardMaterial({
      color: 0xa19384,
      roughness: 0.9,
      metalness: 0.08,
    }),
  );
  lookoutRing.rotation.x = Math.PI / 2;
  lookoutRing.position.set(38.5, 0.16, 0.2);
  lookoutRing.castShadow = true;
  lookoutRing.receiveShadow = true;
  scene.add(lookoutRing);
  registerCylinderCollider(new THREE.Vector3(38.5, 0, 0.2), 1.3, 0.2);
}

function addForestBiome() {
  addBiomePatch({
    position: world.forestCenter,
    radius: 9,
    color: 0x425c34,
    layer: GROUND_LAYERS.biomeDetail,
    opacity: 0.32,
    scaleX: 1.18,
    scaleZ: 1.1,
    rotation: 0.44,
  });

  const treePositions = scatterPoints({
    center: world.forestCenter,
    radius: 13.2,
    count: 28,
    seed: 101,
    minDistance: 2.9,
    avoid: [
      { type: "box", x: 0, z: -24, halfX: 3.2, halfZ: 11.5 },
      { type: "circle", x: world.forestCenter.x, z: world.forestCenter.z, radius: 3 },
    ],
  });
  addForestTrees(treePositions, 1, 0.34);

  addRockScatter({
    center: world.forestCenter,
    radius: 12.8,
    count: 7,
    seed: 109,
    color: 0x605a4d,
    minScale: 0.55,
    maxScale: 1.3,
  });

  const shrubPoints = scatterPoints({
    center: world.forestCenter,
    radius: 11,
    count: 22,
    seed: 117,
    minDistance: 2.1,
    avoid: [{ type: "box", x: 0, z: -24, halfX: 2.8, halfZ: 11 }],
  });
  const shrubGeometry = new THREE.SphereGeometry(0.42, 8, 8);
  const shrubMesh = new THREE.InstancedMesh(
    shrubGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x6e8758,
      roughness: 0.95,
    }),
    shrubPoints.length,
  );
  fillInstanceTransforms(shrubMesh, shrubPoints, (dummy, index) => {
    dummy.position.set(shrubPoints[index].x, 0.22, shrubPoints[index].z);
    dummy.scale.set(1.1 + (index % 3) * 0.18, 0.66, 1 + (index % 2) * 0.1);
  });
  shrubMesh.receiveShadow = true;
  scene.add(shrubMesh);
  shrubPoints.forEach((position, index) => {
    const size = 1.1 + (index % 3) * 0.18;
    registerCylinderCollider(position, 0.36 * size, 0.16);
  });

  const logPositions = [
    new THREE.Vector3(-6.8, 0.26, -28.2),
    new THREE.Vector3(6.6, 0.22, -38.6),
    new THREE.Vector3(3.8, 0.2, -27.1),
  ];
  logPositions.forEach((position, index) => {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 2.6 + (index % 2) * 0.7, 9),
      new THREE.MeshStandardMaterial({
        color: 0x6c4f32,
        roughness: 0.92,
      }),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.45 + index * 0.4;
    log.position.copy(position);
    log.castShadow = true;
    log.receiveShadow = true;
    scene.add(log);
    registerCylinderCollider(position, 0.92 + (index % 2) * 0.16, 0.16);
  });
}

function addForestTrees(positions, baseScale = 1, colliderPadding = 0.3) {
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.26, 0.36, 3.9, 7),
    new THREE.MeshStandardMaterial({
      color: 0x705239,
      roughness: 0.95,
    }),
    positions.length,
  );
  const canopyLower = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.36, 2.9, 7),
    new THREE.MeshStandardMaterial({
      color: 0x4b6d35,
      roughness: 0.98,
    }),
    positions.length,
  );
  const canopyUpper = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.94, 2.05, 7),
    new THREE.MeshStandardMaterial({
      color: 0x628246,
      roughness: 0.98,
    }),
    positions.length,
  );
  fillInstanceTransforms(trunkMesh, positions, (dummy, index) => {
    const size = baseScale * (0.94 + (index % 4) * 0.12);
    dummy.position.set(positions[index].x, 1.7 * size, positions[index].z);
    dummy.rotation.y = index * 0.73;
    dummy.scale.set(size, size, size);
  });
  fillInstanceTransforms(canopyLower, positions, (dummy, index) => {
    const size = baseScale * (1 + (index % 5) * 0.08);
    dummy.position.set(positions[index].x, 3.1 * size, positions[index].z);
    dummy.rotation.y = index * 0.31;
    dummy.scale.set(size, size, size);
  });
  fillInstanceTransforms(canopyUpper, positions, (dummy, index) => {
    const size = baseScale * (0.9 + (index % 4) * 0.08);
    dummy.position.set(positions[index].x, 4.25 * size, positions[index].z);
    dummy.rotation.y = index * 0.51;
    dummy.scale.set(size, size, size);
  });
  trunkMesh.castShadow = true;
  canopyLower.castShadow = true;
  canopyUpper.castShadow = true;
  trunkMesh.receiveShadow = true;
  canopyLower.receiveShadow = true;
  canopyUpper.receiveShadow = true;
  scene.add(trunkMesh, canopyLower, canopyUpper);
  positions.forEach((position, index) => {
    const size = baseScale * (0.94 + (index % 4) * 0.12);
    registerCylinderCollider(position, 0.26 * size, colliderPadding);
  });
}

function addDesertBiome() {
  addBiomePatch({
    position: world.desertCenter,
    radius: 8.8,
    color: 0xe0c486,
    layer: GROUND_LAYERS.biomeDetail,
    opacity: 0.36,
    scaleX: 1.14,
    scaleZ: 1.02,
    rotation: 0.2,
  });

  const duneMaterial = new THREE.MeshStandardMaterial({
    color: 0xd2ae6d,
    roughness: 1,
  });
  const dunePositions = scatterPoints({
    center: world.desertCenter,
    radius: 11.8,
    count: 9,
    seed: 205,
    minDistance: 3.6,
    avoid: [{ type: "box", x: 18, z: -6, halfX: 11.5, halfZ: 2.8 }],
  });
  dunePositions.forEach((point, index) => {
    const scaleX = 1.8 + (index % 3) * 0.4;
    const scaleZ = 1.3 + (index % 4) * 0.18;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), duneMaterial);
    dune.position.set(point.x, 0.28, point.z);
    dune.scale.set(scaleX, 0.5 + (index % 2) * 0.12, scaleZ);
    dune.rotation.y = index * 0.42;
    dune.receiveShadow = true;
    scene.add(dune);
  });

  const cactusPositions = scatterPoints({
    center: world.desertCenter,
    radius: 12.4,
    count: 16,
    seed: 223,
    minDistance: 3,
    avoid: [{ type: "box", x: 18, z: -6, halfX: 12.5, halfZ: 2.8 }],
  });
  cactusPositions.forEach((point, index) => {
    createCactus(point, 0.85 + (index % 3) * 0.14);
  });

  const mesaPositions = [
    new THREE.Vector3(45, 0, -15),
    new THREE.Vector3(50, 0, -3),
    new THREE.Vector3(44, 0, 9),
  ];
  mesaPositions.forEach((position, index) => {
    const radiusTop = 2.6 + index * 0.3;
    const radiusBottom = 3.4 + index * 0.35;
    const mesa = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, 6.8 + index * 1.1, 6),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0x996f45 : 0xb48357,
        roughness: 0.94,
      }),
    );
    mesa.position.set(position.x, 3.2 + index * 0.4, position.z);
    mesa.rotation.y = index * 0.6;
    mesa.castShadow = true;
    mesa.receiveShadow = true;
    scene.add(mesa);
    registerCylinderCollider(position, Math.max(radiusTop, radiusBottom) * 0.82, 0.14);
  });

  addRockScatter({
    center: world.desertCenter,
    radius: 12,
    count: 8,
    seed: 243,
    color: 0x8a6747,
    minScale: 0.5,
    maxScale: 1.1,
  });
}

function createCactus(position, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);

  const material = new THREE.MeshStandardMaterial({
    color: 0x5c8f53,
    roughness: 0.92,
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.4, 7), material);
  trunk.position.y = 1.2 * scale;
  trunk.scale.setScalar(scale);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const armA = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.1, 7), material);
  armA.position.set(0.42 * scale, 1.35 * scale, 0);
  armA.rotation.z = -0.92;
  armA.castShadow = true;
  group.add(armA);

  const armB = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.92, 7), material);
  armB.position.set(-0.36 * scale, 0.96 * scale, 0);
  armB.rotation.z = 0.78;
  armB.castShadow = true;
  group.add(armB);

  scene.add(group);
  registerCylinderCollider(position, 0.2 * scale, 0.1);
}

function addSnowBiome() {
  addBiomePatch({
    position: world.snowCenter,
    radius: 8.6,
    color: 0xf6fbff,
    layer: GROUND_LAYERS.biomeDetail,
    opacity: 0.42,
    scaleX: 1.14,
    scaleZ: 1.2,
    rotation: -0.15,
  });

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 40),
    new THREE.MeshStandardMaterial({
      color: 0x9ec4de,
      roughness: 0.22,
      metalness: 0.18,
      transparent: true,
      opacity: 0.84,
    }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(world.snowCenter.x + 2, 0.024, world.snowCenter.z + 0.8);
  pond.scale.set(1.24, 1, 0.76);
  configureGroundSurface(pond, { layer: GROUND_LAYERS.water, transparent: true });
  scene.add(pond);

  const mountainPositions = [
    new THREE.Vector3(-48, 0, -15),
    new THREE.Vector3(-55, 0, -3),
    new THREE.Vector3(-50, 0, 11),
    new THREE.Vector3(-42, 0, 14),
  ];
  mountainPositions.forEach((position, index) => {
    createMountain(position, 1 + index * 0.08);
  });

  const pinePositions = scatterPoints({
    center: world.snowCenter,
    radius: 12.8,
    count: 22,
    seed: 311,
    minDistance: 3,
    avoid: [
      { type: "circle", x: world.snowCenter.x + 2, z: world.snowCenter.z + 0.8, radius: 4.8 },
      { type: "box", x: -18, z: -5.4, halfX: 12.5, halfZ: 2.6 },
    ],
  });
  addPineTrees(pinePositions, 1, 0.28);

  addRockScatter({
    center: world.snowCenter,
    radius: 11.6,
    count: 9,
    seed: 329,
    color: 0x889099,
    minScale: 0.55,
    maxScale: 1.12,
  });
}

function createMountain(position, scale = 1) {
  const base = new THREE.Mesh(
    new THREE.ConeGeometry(4.8 * scale, 12 * scale, 6),
    new THREE.MeshStandardMaterial({
      color: 0x7f8790,
      roughness: 0.96,
    }),
  );
  base.position.set(position.x, 6 * scale, position.z);
  base.rotation.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.6 * scale, 4.8 * scale, 6),
    new THREE.MeshStandardMaterial({
      color: 0xf2f8fc,
      roughness: 0.88,
    }),
  );
  cap.position.set(position.x, 9.8 * scale, position.z);
  cap.rotation.y = 0.45;
  cap.castShadow = true;
  scene.add(cap);

  registerCylinderCollider(position, 3.3 * scale, 0.7);
}

function addPineTrees(positions, baseScale = 1, colliderPadding = 0.24) {
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.26, 2.9, 6),
    new THREE.MeshStandardMaterial({
      color: 0x67503c,
      roughness: 0.95,
    }),
    positions.length,
  );
  const lowerMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.06, 2.3, 7),
    new THREE.MeshStandardMaterial({
      color: 0x47655a,
      roughness: 0.98,
    }),
    positions.length,
  );
  const upperMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.8, 1.7, 7),
    new THREE.MeshStandardMaterial({
      color: 0x5e8174,
      roughness: 0.98,
    }),
    positions.length,
  );
  fillInstanceTransforms(trunkMesh, positions, (dummy, index) => {
    const size = baseScale * (0.9 + (index % 4) * 0.08);
    dummy.position.set(positions[index].x, 1.25 * size, positions[index].z);
    dummy.scale.set(size, size, size);
  });
  fillInstanceTransforms(lowerMesh, positions, (dummy, index) => {
    const size = baseScale * (0.94 + (index % 4) * 0.08);
    dummy.position.set(positions[index].x, 2.55 * size, positions[index].z);
    dummy.rotation.y = index * 0.34;
    dummy.scale.set(size, size, size);
  });
  fillInstanceTransforms(upperMesh, positions, (dummy, index) => {
    const size = baseScale * (0.9 + (index % 5) * 0.06);
    dummy.position.set(positions[index].x, 3.55 * size, positions[index].z);
    dummy.rotation.y = index * 0.41;
    dummy.scale.set(size, size, size);
  });
  trunkMesh.castShadow = true;
  lowerMesh.castShadow = true;
  upperMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  lowerMesh.receiveShadow = true;
  upperMesh.receiveShadow = true;
  scene.add(trunkMesh, lowerMesh, upperMesh);
  positions.forEach((position, index) => {
    const size = baseScale * (0.9 + (index % 4) * 0.08);
    registerCylinderCollider(position, 0.2 * size, colliderPadding);
  });
}

function addTownBiome() {
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0xb2afa7,
    roughness: 0.95,
  });
  [
    { position: new THREE.Vector3(0, 0, world.townCenter.z + 11), width: 37, length: 3.6 },
    { position: new THREE.Vector3(0, 0, world.townCenter.z - 11), width: 37, length: 3.6 },
    { position: new THREE.Vector3(8.1, 0, world.townCenter.z + 4), width: 3.4, length: 31.4 },
    { position: new THREE.Vector3(-8.1, 0, world.townCenter.z + 4), width: 3.4, length: 31.4 },
    { position: new THREE.Vector3(-19.8, 0, world.townCenter.z - 10), width: 11.6, length: 9.2 },
    { position: new THREE.Vector3(19.8, 0, world.townCenter.z - 10), width: 11.6, length: 9.2 },
    { position: new THREE.Vector3(-20.2, 0, world.townCenter.z + 7.8), width: 12.4, length: 9.6 },
    { position: new THREE.Vector3(20.2, 0, world.townCenter.z + 7.8), width: 12.4, length: 9.6 },
    { position: new THREE.Vector3(-12.2, 0, world.townCenter.z + 11.2), width: 8.8, length: 7.8 },
    { position: new THREE.Vector3(12.2, 0, world.townCenter.z + 11.2), width: 8.8, length: 7.8 },
  ].forEach(({ position, width, length }) => {
    const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(width, length), sidewalkMaterial);
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(position.x, 0.02, position.z);
    configureGroundSurface(sidewalk, { layer: GROUND_LAYERS.sidewalks });
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);
    registerRectGroundSupport({
      position: sidewalk.position,
      width,
      depth: length,
      height: sidewalk.position.y,
    });
  });

  [
    { position: new THREE.Vector3(-19.8, 0, world.townCenter.z - 14.1), width: 9.2, length: 4.8 },
    { position: new THREE.Vector3(19.8, 0, world.townCenter.z - 14.1), width: 9.2, length: 4.8 },
  ].forEach(({ position, width, length }) => {
    addRoadSegment({
      position,
      width,
      length,
      color: 0x676868,
      y: 0.018,
      layer: GROUND_LAYERS.roadsOverlay,
    });
  });

  createHouse({
    position: new THREE.Vector3(-12.2, 0, 57.2),
    width: 6,
    depth: 5.6,
    height: 4.5,
    wallColor: 0xc98f68,
    roofColor: 0x6d473a,
  });
  createHouse({
    position: new THREE.Vector3(12.2, 0, 57.2),
    width: 6.2,
    depth: 5.8,
    height: 4.7,
    wallColor: 0x9fb6c1,
    roofColor: 0x45505f,
  });
  createHouse({
    position: new THREE.Vector3(-20.2, 0, 53.8),
    width: 6.4,
    depth: 5.8,
    height: 4.8,
    wallColor: 0xb7c482,
    roofColor: 0x596a42,
  });
  createHouse({
    position: new THREE.Vector3(20.2, 0, 53.8),
    width: 6,
    depth: 5.4,
    height: 4.4,
    wallColor: 0xd8c0a0,
    roofColor: 0x826552,
  });
  createShop({
    position: new THREE.Vector3(-19.8, 0, 36.2),
    width: 8.2,
    depth: 6.4,
    height: 3.8,
    bodyColor: 0x987359,
    trimColor: 0xe5c888,
  });
  createShop({
    position: new THREE.Vector3(19.8, 0, 36.2),
    width: 8.6,
    depth: 6.6,
    height: 3.6,
    bodyColor: 0x6e7d8b,
    trimColor: 0xe0c07d,
  });

  [
    new THREE.Vector3(-5.5, 0, 34.8),
    new THREE.Vector3(5.5, 0, 34.8),
    new THREE.Vector3(-5.5, 0, 57.2),
    new THREE.Vector3(5.5, 0, 57.2),
    new THREE.Vector3(-12.8, 0, 46),
    new THREE.Vector3(12.8, 0, 46),
  ].forEach((position) => createStreetLamp(position));

  [
    { position: new THREE.Vector3(-1.8, 0, 35.2), color: 0xc5463c, rotation: Math.PI / 2 },
    { position: new THREE.Vector3(1.8, 0, 53.2), color: 0x356792, rotation: Math.PI / 2 },
    { position: new THREE.Vector3(-19.8, 0, 31.9), color: 0xe7cf8d, rotation: Math.PI / 2 },
    { position: new THREE.Vector3(19.8, 0, 31.9), color: 0x4f6d4d, rotation: Math.PI / 2 },
  ].forEach(({ position, color, rotation }) => createCar(position, color, rotation));

  [
    new THREE.Vector3(-12.2, 0, 34.2),
    new THREE.Vector3(12.2, 0, 34.2),
    new THREE.Vector3(-11.4, 0, 58.6),
    new THREE.Vector3(11.4, 0, 58.6),
  ].forEach((position, index) => {
    createTownPlanter(position, 2.5, 1.5, index < 2 ? 0x70845f : 0x7a8d66);
  });
  [
    { position: new THREE.Vector3(-14.8, 0, 40.4), rotation: 0 },
    { position: new THREE.Vector3(14.8, 0, 40.4), rotation: Math.PI },
    { position: new THREE.Vector3(-14.2, 0, 49.8), rotation: 0 },
    { position: new THREE.Vector3(14.2, 0, 49.8), rotation: Math.PI },
  ].forEach(({ position, rotation }) => createTownBench(position, rotation));

  const cratePositions = [
    new THREE.Vector3(-24.2, 0.38, 33.2),
    new THREE.Vector3(-23.1, 0.38, 34.8),
    new THREE.Vector3(24.1, 0.38, 33.6),
    new THREE.Vector3(22.8, 0.38, 34.6),
  ];
  cratePositions.forEach((position, index) => {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.76, 0.9),
      new THREE.MeshStandardMaterial({
        color: index < 2 ? 0x835d39 : 0x7d6351,
        roughness: 0.94,
      }),
    );
    crate.position.copy(position);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
    registerBoxCollider(position, 0.56, 0.56, 0.12);
  });
}

function createTownPlanter(position, width = 2.4, depth = 1.4, shrubColor = 0x728560) {
  const group = new THREE.Group();
  group.position.copy(position);

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.26, depth),
    new THREE.MeshStandardMaterial({
      color: 0x8f8a80,
      roughness: 0.94,
    }),
  );
  curb.position.y = 0.13;
  curb.castShadow = true;
  curb.receiveShadow = true;
  group.add(curb);

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.78, 0.12, depth * 0.64),
    new THREE.MeshStandardMaterial({
      color: 0x6d5a43,
      roughness: 1,
    }),
  );
  soil.position.y = 0.24;
  group.add(soil);

  [-0.55, 0, 0.55].forEach((offset, index) => {
    const shrub = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 10),
      new THREE.MeshStandardMaterial({
        color: index === 1 ? 0x869b71 : shrubColor,
        roughness: 0.95,
      }),
    );
    shrub.position.set(offset, 0.44 + (index % 2) * 0.04, 0);
    shrub.scale.set(1 + (index % 2) * 0.12, 0.9, 1);
    shrub.castShadow = true;
    shrub.receiveShadow = true;
    group.add(shrub);
  });

  scene.add(group);
  registerBoxCollider(position, width / 2, depth / 2, 0.08);
}

function createTownBench(position, rotation = 0) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotation;

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a5b3f,
    roughness: 0.9,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d5258,
    roughness: 0.82,
    metalness: 0.18,
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.42), woodMaterial);
  seat.position.set(0, 0.54, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.36), woodMaterial);
  back.position.set(0, 0.92, -0.17);
  back.rotation.x = -0.26;
  back.castShadow = true;
  group.add(back);

  [-0.56, 0.56].forEach((x) => {
    const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.08), metalMaterial);
    legFront.position.set(x, 0.27, 0.14);
    legFront.castShadow = true;
    group.add(legFront);

    const legBack = legFront.clone();
    legBack.position.z = -0.14;
    group.add(legBack);
  });

  scene.add(group);
  registerBoxCollider(position, 0.86, 0.4, 0.06);
}

function createHouse({
  position,
  width,
  depth,
  height,
  wallColor,
  roofColor,
}) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.94,
    }),
  );
  base.position.y = height / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.72, height * 0.54, 4),
    new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.88,
    }),
  );
  roof.position.y = height + 0.72;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.18, height * 0.42, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0x50392a,
      roughness: 0.9,
    }),
  );
  door.position.set(0, height * 0.22, depth / 2 + 0.06);
  group.add(door);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xdfe7f3,
    emissive: 0xc3d7ea,
    emissiveIntensity: 0.1,
    roughness: 0.28,
  });
  [-0.26, 0.26].forEach((offset) => {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.18, height * 0.18, 0.08),
      windowMaterial,
    );
    window.position.set(width * offset, height * 0.56, depth / 2 + 0.05);
    group.add(window);
  });

  group.position.y = 0;
  scene.add(group);
  registerBoxCollider(position, width / 2 + 0.22, depth / 2 + 0.22, 0.55);
}

function createShop({
  position,
  width,
  depth,
  height,
  bodyColor,
  trimColor,
}) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.96,
    }),
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.05, 0.34, depth * 0.28),
    new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.88,
    }),
  );
  awning.position.set(0, height * 0.68, depth / 2 + 0.44);
  awning.castShadow = true;
  group.add(awning);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.54, 0.72, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xf3e4ba,
      roughness: 0.84,
    }),
  );
  sign.position.set(0, height + 0.2, depth / 2 + 0.08);
  group.add(sign);

  scene.add(group);
  registerBoxCollider(position, width / 2 + 0.2, depth / 2 + 0.2, 0.58);
}

function createStreetLamp(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f4348,
    roughness: 0.9,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.8, 8), poleMaterial);
  pole.position.y = 2.4;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.2), poleMaterial);
  arm.position.set(0, 4.5, 0.4);
  group.add(arm);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xf7e8b7,
      emissive: 0xf3cb74,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }),
  );
  lamp.position.set(0, 4.34, 0.92);
  group.add(lamp);

  scene.add(group);
  registerCylinderCollider(position, 0.22, 0.16);
}

function createCar(position, color, rotation = 0) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotation;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.72, 1.18),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.74,
      metalness: 0.2,
    }),
  );
  body.position.y = 0.58;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.54, 0.94),
    new THREE.MeshStandardMaterial({
      color: 0xd7dee5,
      roughness: 0.42,
      metalness: 0.22,
    }),
  );
  roof.position.set(0.1, 1.02, 0);
  roof.castShadow = true;
  group.add(roof);

  scene.add(group);
  if (Math.abs(Math.sin(rotation)) > 0.5) {
    registerBoxCollider(position, 0.72, 1.22, 0.16);
  } else {
    registerBoxCollider(position, 1.22, 0.72, 0.16);
  }
}

function addPerimeterRidge() {
  const ridgeCount = 22;
  const ridgeMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1.2, 0),
    new THREE.MeshStandardMaterial({
      color: 0x7f7464,
      roughness: 0.96,
    }),
    ridgeCount,
  );
  const dummy = new THREE.Object3D();
  for (let index = 0; index < ridgeCount; index += 1) {
    const angle = (index / ridgeCount) * Math.PI * 2;
    const radius = world.arenaRadius + 2.5 + (index % 3) * 1.4;
    dummy.position.set(Math.cos(angle) * radius, 2.2 + (index % 4) * 0.5, Math.sin(angle) * radius);
    dummy.rotation.set(0.22, index * 0.38, 0.18);
    dummy.scale.set(2.4 + (index % 3) * 0.45, 2.6 + (index % 4) * 0.52, 2.1 + (index % 2) * 0.38);
    dummy.updateMatrix();
    ridgeMesh.setMatrixAt(index, dummy.matrix);
  }
  ridgeMesh.castShadow = true;
  ridgeMesh.receiveShadow = true;
  scene.add(ridgeMesh);
}

function addRock({
  position,
  scale = new THREE.Vector3(1, 1, 1),
  color = 0x75695d,
}) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
    }),
  );
  rock.position.set(position.x, 0.72 * scale.y, position.z);
  rock.rotation.set(0.3, position.x * 0.08, 0.14);
  rock.scale.copy(scale);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  return rock;
}

function addRockScatter({
  center,
  radius,
  count,
  seed,
  color,
  minScale,
  maxScale,
}) {
  const points = scatterPoints({
    center,
    radius,
    count,
    seed,
    minDistance: 2.8,
  });
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
    }),
    points.length,
  );
  fillInstanceTransforms(rockMesh, points, (dummy, index) => {
    const blend = index / Math.max(points.length - 1, 1);
    const scale = THREE.MathUtils.lerp(minScale, maxScale, blend);
    dummy.position.set(points[index].x, 0.62 * scale, points[index].z);
    dummy.rotation.set(index * 0.31, index * 0.57, index * 0.19);
    dummy.scale.set(
      scale * (1 + (index % 3) * 0.16),
      scale * (0.76 + (index % 2) * 0.22),
      scale * (0.9 + (index % 4) * 0.1),
    );
  });
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  scene.add(rockMesh);
  points.forEach((point, index) => {
    const blend = index / Math.max(points.length - 1, 1);
    const scale = THREE.MathUtils.lerp(minScale, maxScale, blend);
    const widthScale = 1 + (index % 3) * 0.16;
    registerCylinderCollider(point, scale * widthScale, 0.18);
  });
}

function addRockLine(points, { color = 0x7e7164, scale = 1, collider = 0.78 } = {}) {
  points.forEach((point, index) => {
    const size = scale * (0.92 + (index % 4) * 0.12);
    addRock({
      position: point,
      scale: new THREE.Vector3(
        size * (1.12 + (index % 3) * 0.08),
        size * (0.9 + (index % 2) * 0.14),
        size,
      ),
      color,
    });
    registerCylinderCollider(point, collider * size, 0.18);
  });
}

function addShrubLine(points, { color = 0x73885f, scale = 1 } = {}) {
  const shrubMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.54, 8, 8),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.96,
    }),
    points.length,
  );
  fillInstanceTransforms(shrubMesh, points, (dummy, index) => {
    const size = scale * (0.96 + (index % 4) * 0.12);
    dummy.position.set(points[index].x, 0.24 * size, points[index].z);
    dummy.scale.set(
      size * (1.26 + (index % 3) * 0.12),
      size * (0.68 + (index % 2) * 0.08),
      size * (1 + (index % 4) * 0.08),
    );
  });
  shrubMesh.receiveShadow = true;
  scene.add(shrubMesh);
  points.forEach((point, index) => {
    const size = scale * (0.96 + (index % 4) * 0.12);
    const widthScale = 1.26 + (index % 3) * 0.12;
    registerCylinderCollider(point, 0.4 * size * widthScale, 0.14);
  });
}

function fillInstanceTransforms(mesh, positions, transformCallback) {
  const dummy = new THREE.Object3D();
  positions.forEach((_, index) => {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    transformCallback(dummy, index);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function buildPathPoints(nodes, spacing = 2.8, jitter = 0, seed = 1) {
  const points = [];
  const random = createSeededRandom(seed);

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const start = nodes[index];
    const end = nodes[index + 1];
    const segment = tempVecA.copy(end).sub(start);
    const distance = segment.length();
    const steps = Math.max(2, Math.ceil(distance / spacing));
    const direction = segment.normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

    for (let step = 0; step < steps; step += 1) {
      if (index > 0 && step === 0) {
        continue;
      }
      const t = steps === 1 ? 1 : step / (steps - 1);
      const point = start.clone().lerp(end, t);
      if (jitter > 0) {
        point.addScaledVector(perpendicular, (random() - 0.5) * jitter * 2);
      }
      points.push(point);
    }
  }

  return points;
}

function registerCylinderCollider(position, radius, padding = 0.72) {
  worldColliders.push({
    type: "cylinder",
    x: position.x,
    z: position.z,
    radius,
    padding,
  });
}

function registerBoxCollider(position, halfX, halfZ, padding = 0.6) {
  worldColliders.push({
    type: "box",
    x: position.x,
    z: position.z,
    halfX,
    halfZ,
    padding,
  });
}

function registerRectGroundSupport({
  position,
  width,
  depth,
  height,
  rotation = 0,
  padding = 0.08,
}) {
  groundSupports.push({
    type: "rect",
    x: position.x,
    z: position.z,
    halfX: width / 2 + padding,
    halfZ: depth / 2 + padding,
    rotation,
    height,
  });
}

function scatterPoints({
  center,
  radius,
  count,
  seed,
  minDistance = 2.6,
  avoid = [],
}) {
  const random = createSeededRandom(seed);
  const points = [];
  const maxAttempts = count * 40;
  for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const point = new THREE.Vector3(
      center.x + Math.cos(angle) * distance,
      0,
      center.z + Math.sin(angle) * distance,
    );
    if (Math.sqrt(point.x * point.x + point.z * point.z) > world.arenaRadius - 3) {
      continue;
    }
    if (avoid.some((zone) => isPointInsideZone(point, zone))) {
      continue;
    }
    if (points.some((otherPoint) => otherPoint.distanceToSquared(point) < minDistance * minDistance)) {
      continue;
    }
    points.push(point);
  }
  return points;
}

function isPointInsideZone(point, zone) {
  if (zone.type === "circle") {
    const dx = point.x - zone.x;
    const dz = point.z - zone.z;
    return dx * dx + dz * dz < zone.radius * zone.radius;
  }

  if (zone.type === "box") {
    return (
      Math.abs(point.x - zone.x) < zone.halfX &&
      Math.abs(point.z - zone.z) < zone.halfZ
    );
  }

  return false;
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

function buildHero() {
  const avatar = createMinecraftAvatar();
  avatar.root.scale.setScalar(heroMetrics.scale);
  avatar.motionTime = Math.random() * Math.PI * 2;
  return avatar;
}

function createPhone() {
  const texture = new THREE.TextureLoader().load("/models/s25-screen.png");
  texture.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.position.copy(world.phoneCenter);
  group.rotation.y = -0.32;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width, phoneMetrics.thickness, phoneMetrics.length),
    new THREE.MeshStandardMaterial({
      color: 0x24292f,
      roughness: 0.24,
      metalness: 0.56,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.97, phoneMetrics.thickness * 0.82, phoneMetrics.length * 0.98),
    new THREE.MeshStandardMaterial({
      color: 0x596573,
      roughness: 0.22,
      metalness: 0.72,
    }),
  );
  frame.position.y = 0.01;
  group.add(frame);

  const screenBase = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.9, 0.02, phoneMetrics.length * 0.92),
    new THREE.MeshStandardMaterial({
      color: 0x10161d,
      roughness: 0.14,
      metalness: 0.08,
    }),
  );
  screenBase.position.y = phoneMetrics.thickness / 2 + 0.004;
  group.add(screenBase);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(phoneMetrics.width * 0.84, phoneMetrics.length * 0.88),
    new THREE.MeshBasicMaterial({
      map: texture,
    }),
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = phoneMetrics.thickness / 2 + 0.016;
  group.add(screen);

  const cameraHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 18),
    new THREE.MeshBasicMaterial({
      color: 0x151a21,
    }),
  );
  cameraHole.rotation.x = -Math.PI / 2;
  cameraHole.position.set(0, phoneMetrics.thickness / 2 + 0.02, -phoneMetrics.length * 0.34);
  group.add(cameraHole);

  const speaker = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.22, 0.012, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0xa8b0b8,
      roughness: 0.3,
      metalness: 0.56,
    }),
  );
  speaker.position.set(0, phoneMetrics.thickness / 2 + 0.011, -phoneMetrics.length * 0.44);
  group.add(speaker);

  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x616d79,
    roughness: 0.28,
    metalness: 0.66,
  });
  const sideButtonA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.58), buttonMaterial);
  sideButtonA.position.set(phoneMetrics.width / 2 + 0.01, 0.01, -0.45);
  const sideButtonB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), buttonMaterial);
  sideButtonB.position.set(phoneMetrics.width / 2 + 0.01, 0.01, 0.32);
  group.add(sideButtonA, sideButtonB);

  return group;
}

function createAimMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.028, 12, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffc54f,
      transparent: true,
      opacity: 0.75,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }),
  );
  dot.position.y = 0.02;
  group.add(dot);
  group.userData = { ring, dot };

  return group;
}

function createDangerRing() {
  const group = new THREE.Group();
  group.position.copy(world.phoneCenter);
  group.position.y = 0.065;

  const outline = new THREE.Mesh(
    new THREE.TorusGeometry(9.2, 0.15, 32, 128),
    new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0xffb300,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.1
    })
  );
  outline.rotation.x = -Math.PI / 2;

  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(9.2, 128),
    new THREE.MeshBasicMaterial({
      color: 0xffea00, // Saturated yellow to prevent looking white
      transparent: true,
      blending: THREE.AdditiveBlending, // Gives a stronger glowing neon look
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  fill.rotation.x = -Math.PI / 2;

  // Use the new render layers system so the ring sits ON TOP of all other ground layers
  configureGroundSurface(fill, { layer: 10, transparent: true });
  configureGroundSurface(outline, { layer: 11 });

  group.add(outline, fill);
  group.userData = { fill, outline };
  return group;
}

function createStandingTarget() {
  const texture = textureLoader.load("/targets/standing-target.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const root = new THREE.Group();
  root.position.copy(standingTargetPosition);

  const baseShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 28),
    new THREE.MeshBasicMaterial({
      color: 0x2d2119,
      transparent: true,
      opacity: 0.18,
    }),
  );
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.position.y = 0.012;
  configureGroundSurface(baseShadow, { layer: GROUND_LAYERS.glow, transparent: true });
  root.add(baseShadow);

  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.98, 0.26, 28),
    new THREE.MeshStandardMaterial({
      color: 0x685446,
      roughness: 0.92,
      metalness: 0.08,
    }),
  );
  podium.position.y = 0.13;
  podium.castShadow = true;
  podium.receiveShadow = true;
  root.add(podium);

  const podiumTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.05, 12, 28),
    new THREE.MeshStandardMaterial({
      color: 0xe2b56d,
      roughness: 0.48,
      metalness: 0.18,
      emissive: 0x7b4a18,
      emissiveIntensity: 0.18,
    }),
  );
  podiumTrim.rotation.x = Math.PI / 2;
  podiumTrim.position.y = 0.27;
  root.add(podiumTrim);

  const billboardPivot = new THREE.Group();
  const swayPivot = new THREE.Group();
  const visualGroup = new THREE.Group();
  const targetHeight = 3.4;
  const targetWidth = targetHeight * (425 / 1331);

  billboardPivot.position.y = 0.27;
  swayPivot.position.y = standingTargetMetrics.swayBaseY;
  root.add(billboardPivot);
  billboardPivot.add(swayPivot);
  swayPivot.add(visualGroup);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.88, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffd17e,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  glow.position.set(0, 0.1, -0.05);
  visualGroup.add(glow);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.42, 4.2, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd37a,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beacon.position.set(0, 2.2, 0);
  root.add(beacon);

  const planeMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.02,
    emissive: 0xffb562,
    emissiveIntensity: 0,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(targetWidth, targetHeight),
    planeMaterial,
  );
  plane.castShadow = true;
  plane.receiveShadow = true;
  visualGroup.add(plane);

  const hitMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(targetWidth * 1.35, targetHeight * 0.94),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.001,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  hitMesh.position.y = -0.02;
  visualGroup.add(hitMesh);

  return {
    root,
    billboardPivot,
    swayPivot,
    visualGroup,
    hitMesh,
    glow,
    beacon,
    planeMaterial,
    baseShadow,
    state: {
      floatTime: Math.random() * Math.PI * 2,
      wobble: 0,
      wobbleVelocity: 0,
      recoil: 0,
      twist: 0,
      hitFlash: 0,
    },
  };
}

function createPoopMaterial(color, overrides = {}) {
  const opacity = overrides.opacity ?? 1;
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.6,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.36,
    transparent: opacity < 1 || Boolean(overrides.transparent),
    ...overrides,
  });
}

function createStainMaterial(color, overrides = {}) {
  const opacity = overrides.opacity ?? 1;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.03,
    transparent: opacity < 1 || Boolean(overrides.transparent),
    ...overrides,
  });
}

function setProfileStatus(text, isError = false) {
  if (!profileStatusEl) {
    return;
  }

  profileStatusEl.textContent = text;
  profileStatusEl.classList.toggle("profile-editor__status--error", isError);
}

function drawSkinPreview(skinDataUrl) {
  if (!skinPreviewCanvas) {
    return;
  }

  const context = skinPreviewCanvas.getContext("2d");
  const image = new Image();
  image.addEventListener("load", () => {
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, skinPreviewCanvas.width, skinPreviewCanvas.height);
    context.drawImage(image, 8, 8, 8, 8, 0, 0, skinPreviewCanvas.width, skinPreviewCanvas.height);
    context.drawImage(image, 40, 8, 8, 8, 0, 0, skinPreviewCanvas.width, skinPreviewCanvas.height);
  });
  image.src = skinDataUrl || DEFAULT_SKIN_DATA_URL;
}

function syncProfileUi() {
  if (profileNameInputEl) {
    profileNameInputEl.value = playerProfile.name;
  }

  drawSkinPreview(playerProfile.skinDataUrl);
}

function applyPlayerProfile(nextProfile, options = {}) {
  const normalizedProfile = sanitizePlayerProfile(nextProfile);
  playerProfile.name = normalizedProfile.name;
  playerProfile.skinDataUrl = normalizedProfile.skinDataUrl;

  saveStoredPlayerProfile(playerProfile);
  syncProfileUi();
  multiplayer.setProfile(playerProfile);
  setMinecraftAvatarSkin(hero, playerProfile.skinDataUrl);
  setMinecraftAvatarName(hero, playerProfile.name || multiplayerState.selfName || "Du");

  const localPlayer = multiplayerState.playerRoster.get(multiplayerState.selfId);
  if (localPlayer) {
    upsertRosterPlayer({
      ...localPlayer,
      name: playerProfile.name || localPlayer.name,
      skinDataUrl: playerProfile.skinDataUrl,
    });
  }

  if (!options.silent) {
    setProfileStatus(options.statusText || "Profilen sparades och synkas till lobbyn.");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("Filen kunde inte lasas.")));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("PNG-filen gick inte att lasa.")));
    image.src = dataUrl;
  });
}

async function normalizeUploadedMinecraftSkin(file) {
  if (!file) {
    throw new Error("Valj en PNG-fil for skinnen.");
  }

  const looksLikePng = file.type === "image/png" || file.name?.toLowerCase().endsWith(".png");
  if (!looksLikePng) {
    throw new Error("Bara Minecraft-skins i PNG-format fungerar.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  if (image.naturalWidth !== 64 || image.naturalHeight !== 64) {
    throw new Error("Just nu stods bara klassiska Minecraft-skins i 64x64 PNG.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function onProfileNameInput(event) {
  applyPlayerProfile(
    {
      ...playerProfile,
      name: event.target.value,
    },
    {
      silent: true,
    },
  );
  setProfileStatus(
    playerProfile.name
      ? "Namnet sparas direkt och visas over spelaren online."
      : "Tomt namn betyder att servern ger dig ett slumpnamn.",
  );
}

async function onProfileSkinInput(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  setProfileStatus("Laddar in skinnen...");

  try {
    const skinDataUrl = await normalizeUploadedMinecraftSkin(file);
    applyPlayerProfile(
      {
        ...playerProfile,
        skinDataUrl,
      },
      {
        statusText: "Minecraft-skinnet ar aktivt och synkas till andra spelare.",
      },
    );
  } catch (error) {
    setProfileStatus(error.message || "Skinnen gick inte att anvanda.", true);
  } finally {
    event.target.value = "";
  }
}

function onProfileResetSkin() {
  applyPlayerProfile(
    {
      ...playerProfile,
      skinDataUrl: DEFAULT_SKIN_DATA_URL,
    },
    {
      statusText: "Standard-skinnen ar tillbaka.",
    },
  );
}

function initializeMultiplayerUi() {
  syncProfileUi();
  setProfileStatus("Stodjer klassiska Minecraft-skins i 64x64 PNG.");
  setMenuOpen(true);
  updateLobbyCounts();
  syncNetworkCard();
  syncMatchPanel();
  refreshLobbySnapshot();
  window.setInterval(() => {
    refreshLobbySnapshot(true);
  }, 4000);
}

async function onLobbyButtonClick(event) {
  const lobbyId = event.currentTarget.dataset.lobbyId;
  pendingAutoReadyAfterJoin = event.currentTarget.dataset.autoReady === "true";
  if (!LOBBY_IDS.includes(lobbyId)) {
    pendingAutoReadyAfterJoin = false;
    return;
  }

  setLobbyButtonsDisabled(true);
  updateLobbyMenuStatus(`Ansluter till ${LOBBY_LABELS[lobbyId]}...`);

  try {
    await multiplayer.connect(lobbyId);
  } catch (error) {
    pendingAutoReadyAfterJoin = false;
    setLobbyButtonsDisabled(false);
    updateLobbyMenuStatus("Det gick inte att ansluta till lobbyn just nu.");
    setMessage("Multiplayer-servern svarade inte. Kolla Worker-URL och försök igen.");
  }
}

function onReadyButtonClick() {
  if (!multiplayerState.joined) {
    return;
  }

  const nextReady = !state.localReady;
  state.localReady = nextReady;
  multiplayer.sendReady(nextReady);
  const selfPlayer = multiplayerState.playerRoster.get(multiplayerState.selfId);
  if (selfPlayer) {
    upsertRosterPlayer({
      ...selfPlayer,
      ready: nextReady,
    });
  }
  syncMatchPanel();
}

function setLobbyButtonsDisabled(disabled) {
  joinButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function refreshLobbySnapshot(silent = false) {
  try {
    await multiplayer.fetchLobbies();
  } catch (error) {
    if (!silent || multiplayerState.menuOpen) {
      updateLobbyMenuStatus("Lobby-status kunde inte hamtas. Kontrollera Worker-URL:en.");
    }
  }
}

function handleLobbySnapshot(payload) {
  for (const lobby of payload.lobbies ?? []) {
    if (!LOBBY_IDS.includes(lobby.lobbyId)) {
      continue;
    }
    multiplayerState.lobbyCounts[lobby.lobbyId] = lobby.playerCount ?? 0;
    multiplayerState.lobbyStatus[lobby.lobbyId] = {
      playerCount: lobby.playerCount ?? 0,
      readyCount: lobby.readyCount ?? 0,
      phase: lobby.phase ?? MATCH_PHASES.staging,
      countdownEndsAt: lobby.countdownEndsAt ?? null,
    };
  }

  updateLobbyCounts();
  syncNetworkCard();
  syncMatchPanel();

  if (multiplayerState.menuOpen) {
    updateLobbyMenuStatus("Valj en lobby och klicka sedan i scenen for att lasa musen.");
  }
}

function handleMultiplayerStateChange({ connectionState, lobbyId, reason }) {
  if (connectionState === "connecting") {
    setLobbyButtonsDisabled(true);
    updateLobbyMenuStatus(`Ansluter till ${LOBBY_LABELS[lobbyId]}...`);
    return;
  }

  if (connectionState === "connected") {
    updateLobbyMenuStatus("WebSocket uppe. Vantar pa welcome-paket...");
    return;
  }

  if (connectionState === "disconnected") {
    pendingAutoReadyAfterJoin = false;
    multiplayerState.joined = false;
    multiplayerState.selfId = null;
    multiplayerState.lobbyId = null;
    multiplayerState.selfName = "";
    multiplayerState.localActionState = createActionState();
    multiplayerState.matchState = createMatchState();
    multiplayerState.playerRoster.clear();
    clearRemotePlayers();
    resetInputState();
    state.localReady = false;
    state.playerPhase = MATCH_PHASES.staging;
    setMinecraftAvatarSkin(hero, playerProfile.skinDataUrl);
    setMinecraftAvatarName(hero, playerProfile.name || "Du");
    syncNetworkCard();
    syncMatchPanel();
    renderLobbyPlayerList();
    setMenuOpen(true);
    setLobbyButtonsDisabled(false);
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    updateLobbyMenuStatus(reason || "Anslutningen tappades. Valj en lobby igen.");
  }
}

function handleLobbyWelcome(message) {
  multiplayerState.joined = true;
  multiplayerState.selfId = message.selfId;
  multiplayerState.lobbyId = message.lobbyId;
  multiplayerState.selfName = message.name;
  multiplayerState.selfColor = message.color;
  multiplayerState.localActionState = createActionState();
  multiplayerState.lobbyCounts[message.lobbyId] = message.playerCount ?? 1;
  clearRemotePlayers();
  resetRoundState();
  upsertRosterPlayer({
    id: message.selfId,
    name: message.name,
    color: message.color,
    skinDataUrl: message.skinDataUrl ?? playerProfile.skinDataUrl,
    guestIndex: message.guestIndex ?? 0,
    pose: message.pose ?? createLocalPosePacket(),
    ready: Boolean(message.ready),
    playerPhase: message.playerPhase ?? state.playerPhase,
  });
  setMinecraftAvatarSkin(hero, message.skinDataUrl ?? playerProfile.skinDataUrl);
  setMinecraftAvatarName(hero, message.name || playerProfile.name || "Du");

  for (const player of message.players ?? []) {
    upsertRosterPlayer(player);
    queueRemotePose(player.id, player, player.pose);
  }

  if (message.matchState) {
    applyMatchStateMessage(message.matchState);
  }

  setMenuOpen(false);
  setLobbyButtonsDisabled(false);
  networkCardEl.classList.remove("hidden");
  syncNetworkCard();
  syncMatchPanel();
  setMessage(
    pendingAutoReadyAfterJoin
      ? `Du är i ${LOBBY_LABELS[message.lobbyId]}. Solo-läget är redo och countdown startar nu.`
      : `Du är i ${LOBBY_LABELS[message.lobbyId]}. Vänta in de andra i staging-lobbyn och tryck Ready när du vill dra.`,
  );

  if (pendingAutoReadyAfterJoin) {
    pendingAutoReadyAfterJoin = false;
    state.localReady = true;
    multiplayer.sendReady(true);
    const selfPlayer = multiplayerState.playerRoster.get(multiplayerState.selfId);
    if (selfPlayer) {
      upsertRosterPlayer({
        ...selfPlayer,
        ready: true,
      });
    }
    syncMatchPanel();
  }
}

function handleLobbyPresence(message) {
  const lobbyId = multiplayerState.lobbyId;
  if (lobbyId) {
    multiplayerState.lobbyCounts[lobbyId] = message.playerCount ?? multiplayerState.lobbyCounts[lobbyId];
    updateLobbyCounts();
    syncNetworkCard();
  }

  if (!message.player || message.player.id === multiplayerState.selfId) {
    return;
  }

  if (message.action === "join") {
    upsertRosterPlayer(message.player);
    queueRemotePose(message.player.id, message.player, message.player.pose);
    syncMatchPanel();
    return;
  }

  if (message.action === "update") {
    upsertRosterPlayer(message.player);
    queueRemotePose(message.player.id, message.player, message.player.pose);
    syncMatchPanel();
    return;
  }

  if (message.action === "leave") {
    removeRosterPlayer(message.player.id);
    removeRemotePlayer(message.player.id);
    syncMatchPanel();
  }
}

function handleMatchStateMessage(message) {
  applyMatchStateMessage(message);
}

function applyMatchStateMessage(message) {
  const previousMatchState = multiplayerState.matchState;
  multiplayerState.matchState = {
    ...createMatchState(),
    ...message,
  };

  if (multiplayerState.lobbyId && Number.isFinite(message.playerCount)) {
    multiplayerState.lobbyCounts[multiplayerState.lobbyId] = message.playerCount;
    multiplayerState.lobbyStatus[multiplayerState.lobbyId] = {
      playerCount: message.playerCount,
      readyCount: message.readyCount ?? 0,
      phase: message.phase ?? MATCH_PHASES.staging,
      countdownEndsAt: message.countdownEndsAt ?? null,
    };
  }

  if (Array.isArray(message.players)) {
    setRosterPlayers(message.players);
  }

  const localPlayer = multiplayerState.playerRoster.get(multiplayerState.selfId);
  const desiredPlayerPhase =
    localPlayer?.playerPhase ??
    (message.phase === MATCH_PHASES.bus
      ? MATCH_PHASES.bus
      : message.phase === MATCH_PHASES.active
        ? MATCH_PHASES.active
        : MATCH_PHASES.staging);

  if (
    desiredPlayerPhase === MATCH_PHASES.bus &&
    (state.playerPhase !== MATCH_PHASES.bus ||
      previousMatchState.busStartedAt !== multiplayerState.matchState.busStartedAt)
  ) {
    enterLocalBusPhase(false);
  } else if (desiredPlayerPhase === MATCH_PHASES.glide && state.playerPhase !== MATCH_PHASES.glide) {
    enterLocalGlidePhase(false, false);
  } else if (desiredPlayerPhase === MATCH_PHASES.active && state.playerPhase !== MATCH_PHASES.active) {
    enterLocalActivePhase(false, state.playerPhase !== MATCH_PHASES.glide);
  } else if (
    desiredPlayerPhase !== MATCH_PHASES.bus &&
    desiredPlayerPhase !== MATCH_PHASES.glide &&
    desiredPlayerPhase !== MATCH_PHASES.active &&
    state.playerPhase !== MATCH_PHASES.staging
  ) {
    enterLocalStagingPhase(false);
  }

  syncNetworkCard();
  syncMatchPanel();
}

function resetRoundState() {
  stopPoopHold();
  clearProjectiles();
  clearPoopRopes();
  clearSplats();
  clearImpactBursts();
  multiplayerState.localActionState = createActionState();
  state.moveAmount = 0;
  state.walkCycle = 0;
  state.cooldown = 0;
  state.verticalVelocity = 0;
  state.grounded = true;
  state.hemorrhoids = 0;
  state.totalPoopLength = 0;
  state.gameOver = false;
  state.resetTimer = 0;
  state.isOnPhone = false;
  state.poopAnimation = 0;
  state.strikeAnimation = 0;
  state.strikeResolved = true;
  state.glideVelocity.set(0, 0, 0);
  state.autoDropTriggered = false;
  poopHoldState.pointerId = null;
  poopHoldState.isPointerDown = false;
  poopHoldState.holdTime = 0;
  poopHoldState.started = false;
  activePoopRope = null;
  gameOverEl.classList.add("hidden");
  updateHud();
}

function positionPlayerForPhase(phase, options = {}) {
  const now = options.now ?? Date.now();
  const isInitialEntry = !options._busFrameUpdate;
  if (phase === MATCH_PHASES.bus) {
    const seatPosition = getBusSeatWorldPosition(
      multiplayerState.playerRoster.get(multiplayerState.selfId)?.guestIndex ?? 0,
      now,
      tempVecL,
    );
    const busYaw = getBusTransform(now).yaw;
    state.playerPosition.copy(seatPosition);
    state.playerYaw = busYaw;
    if (isInitialEntry) {
      state.cameraYaw = busYaw;
      state.cameraPitch = -0.18;
    }
    hero.root.position.copy(state.playerPosition);
    hero.root.rotation.y = state.playerYaw;
    return;
  }

  const spawn = getSpawnForPhase(phase);
  state.playerPosition.set(spawn.x, spawn.y, spawn.z);
  state.playerYaw = spawn.yaw;
  state.cameraYaw = spawn.yaw;
  state.cameraPitch = phase === MATCH_PHASES.staging ? -0.1 : -0.2;
  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;
}

function enterLocalStagingPhase(broadcast = true) {
  resetRoundState();
  state.playerPhase = MATCH_PHASES.staging;
  positionPlayerForPhase(MATCH_PHASES.staging);
  if (broadcast && multiplayerState.joined) {
    multiplayer.sendPlayerState(MATCH_PHASES.staging);
  }
  syncMatchPanel();
}

function enterLocalBusPhase(broadcast = true) {
  if (state.playerPhase !== MATCH_PHASES.bus) {
    resetRoundState();
  }
  state.playerPhase = MATCH_PHASES.bus;
  state.localReady = false;
  positionPlayerForPhase(MATCH_PHASES.bus);
  if (broadcast && multiplayerState.joined) {
    multiplayer.sendPlayerState(MATCH_PHASES.bus);
  }
  syncMatchPanel();
  if (!isPointerLocked()) {
    canvas.requestPointerLock();
  }
}

function enterLocalGlidePhase(broadcast = true, isAutoDrop = false) {
  const now = Date.now();
  if (state.playerPhase === MATCH_PHASES.bus) {
    positionPlayerForPhase(MATCH_PHASES.bus, { now });
  }
  state.playerPhase = MATCH_PHASES.glide;
  state.grounded = false;
  state.verticalVelocity = -glideConfig.fallSpeed;
  state.glideVelocity.set(0, -glideConfig.fallSpeed, 0);
  state.playerPosition.y = Math.max(state.playerPosition.y - 1.1, 10);
  state.autoDropTriggered = isAutoDrop;
  if (broadcast && multiplayerState.joined) {
    multiplayer.sendPlayerState(MATCH_PHASES.glide);
  }
  syncMatchPanel();
}

function enterLocalActivePhase(broadcast = true, snapToIslandSpawn = false) {
  if (snapToIslandSpawn || state.playerPhase === MATCH_PHASES.staging || state.playerPhase === MATCH_PHASES.bus) {
    positionPlayerForPhase(MATCH_PHASES.active);
  }
  state.playerPhase = MATCH_PHASES.active;
  state.grounded = true;
  state.verticalVelocity = 0;
  state.playerPosition.y = getSupportHeight(state.playerPosition);
  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;
  if (broadcast && multiplayerState.joined) {
    multiplayer.sendPlayerState(MATCH_PHASES.active);
  }
  syncMatchPanel();
}

function canJumpFromBus(now = Date.now()) {
  return (
    Number.isFinite(multiplayerState.matchState.doorsOpenAt) &&
    now >= multiplayerState.matchState.doorsOpenAt &&
    (!Number.isFinite(multiplayerState.matchState.autoDropAt) ||
      now < multiplayerState.matchState.autoDropAt)
  );
}

function handleLobbyPose(message) {
  if (message.playerId === multiplayerState.selfId) {
    return;
  }

  queueRemotePose(message.playerId, null, message.pose);
}

function handleLobbyAction(message) {
  if (message.playerId === multiplayerState.selfId) {
    return;
  }

  const remotePlayer = ensureRemotePlayer(message.playerId);
  const actionKind = message.action?.kind;
  if (actionKind === ACTION_KINDS.poopStart) {
    remotePlayer.actionState.poopActive = true;
    ensureRemotePoopRope(remotePlayer);
    return;
  }

  if (actionKind === ACTION_KINDS.poopStop) {
    remotePlayer.actionState.poopActive = false;
    stopRemotePoopRope(remotePlayer);
    return;
  }

  if (actionKind === ACTION_KINDS.strike) {
    remotePlayer.actionState.strikeAt = message.action.at ?? performance.now();
    remotePlayer.strikeTimer = strikeConfig.duration;
  }
}

function handleLobbyWorldEvent(message) {
  if (message.event?.kind === WORLD_EVENT_KINDS.targetHit) {
    applyTargetHitVisuals(
      new THREE.Vector3(
        message.event.impactPoint?.x ?? 0,
        message.event.impactPoint?.y ?? 0,
        message.event.impactPoint?.z ?? 0,
      ),
      new THREE.Vector3(
        message.event.velocity?.x ?? 0,
        message.event.velocity?.y ?? 0,
        message.event.velocity?.z ?? 0,
      ),
    );
  }
}

function handleMultiplayerError(message) {
  if (multiplayerState.menuOpen) {
    updateLobbyMenuStatus(message);
  }
  setMessage(message);
}

function updateLobbyMenuStatus(text) {
  lobbyMenuStatusEl.textContent = text;
}

function setMenuOpen(isOpen) {
  multiplayerState.menuOpen = isOpen;
  lobbyMenuEl.classList.toggle("hidden", !isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  syncMatchPanel();
}

function updateLobbyCounts() {
  for (const lobbyId of LOBBY_IDS) {
    const snapshot = multiplayerState.lobbyStatus[lobbyId] ?? {
      playerCount: multiplayerState.lobbyCounts[lobbyId] ?? 0,
      readyCount: 0,
      phase: MATCH_PHASES.staging,
    };
    const label = `${snapshot.playerCount} / ${MAX_PLAYERS_PER_LOBBY} spelare · ${getMatchPhaseLabel(snapshot.phase)}`;
    if (lobbyCountEls[lobbyId]) {
      lobbyCountEls[lobbyId].textContent = label;
    }
  }
}

function syncNetworkCard() {
  const lobbyId = multiplayerState.lobbyId;
  if (!lobbyId) {
    networkCardEl.classList.add("hidden");
    networkLobbyNameEl.textContent = "Ingen lobby";
    networkStatusTextEl.textContent = "Inte ansluten";
    return;
  }

  networkCardEl.classList.remove("hidden");
  networkLobbyNameEl.textContent = LOBBY_LABELS[lobbyId];
  networkStatusTextEl.textContent = `${
    multiplayerState.lobbyCounts[lobbyId] ?? 0
  } / ${MAX_PLAYERS_PER_LOBBY} online · ${
    multiplayerState.matchState.readyCount ?? 0
  } ready · ${getMatchPhaseLabel(multiplayerState.matchState.phase ?? MATCH_PHASES.staging)}`;
}

function resetInputState() {
  input.forward = false;
  input.backward = false;
  input.left = false;
  input.right = false;
}

function clearRemotePlayers() {
  for (const remotePlayer of multiplayerState.remotePlayers.values()) {
    if (remotePlayer.rope) {
      const ropeIndex = poopRopes.indexOf(remotePlayer.rope);
      if (ropeIndex >= 0) {
        poopRopes.splice(ropeIndex, 1);
      }
      destroyPoopRope(remotePlayer.rope);
      remotePlayer.rope = null;
    }
    remotePlayersRoot.remove(remotePlayer.avatar.root);
    remotePlayer.avatar.root.traverse(disposeObject);
  }
  multiplayerState.remotePlayers.clear();
}

function removeRemotePlayer(playerId) {
  const remotePlayer = multiplayerState.remotePlayers.get(playerId);
  if (!remotePlayer) {
    return;
  }

  if (remotePlayer.rope) {
    const ropeIndex = poopRopes.indexOf(remotePlayer.rope);
    if (ropeIndex >= 0) {
      poopRopes.splice(ropeIndex, 1);
    }
    destroyPoopRope(remotePlayer.rope);
    remotePlayer.rope = null;
  }
  remotePlayersRoot.remove(remotePlayer.avatar.root);
  remotePlayer.avatar.root.traverse(disposeObject);
  multiplayerState.remotePlayers.delete(playerId);
}

function ensureRemotePlayer(playerId, playerMeta = null) {
  let remotePlayer = multiplayerState.remotePlayers.get(playerId);
  if (remotePlayer) {
    if (playerMeta && "name" in playerMeta) {
      remotePlayer.name = playerMeta.name;
      setMinecraftAvatarName(remotePlayer.avatar, remotePlayer.name);
    }
    if (playerMeta?.color) {
      remotePlayer.color = playerMeta.color;
    }
    if (playerMeta && "skinDataUrl" in playerMeta) {
      remotePlayer.skinDataUrl = playerMeta.skinDataUrl || DEFAULT_SKIN_DATA_URL;
      setMinecraftAvatarSkin(remotePlayer.avatar, remotePlayer.skinDataUrl);
    }
    if (playerMeta?.actionState) {
      remotePlayer.actionState = {
        ...remotePlayer.actionState,
        ...playerMeta.actionState,
      };
    }
    if (playerMeta?.playerPhase) {
      remotePlayer.playerPhase = playerMeta.playerPhase;
    }
    if (Number.isFinite(playerMeta?.guestIndex)) {
      remotePlayer.guestIndex = playerMeta.guestIndex;
    }
    return remotePlayer;
  }

  const avatar = createRemotePlayerAvatar({
    name: playerMeta?.name ?? "Gast",
    skinDataUrl: playerMeta?.skinDataUrl ?? DEFAULT_SKIN_DATA_URL,
  });
  remotePlayersRoot.add(avatar.root);
  remotePlayer = {
    id: playerId,
    name: playerMeta?.name ?? "Gast",
    color: playerMeta?.color ?? "#7d8da1",
    skinDataUrl: playerMeta?.skinDataUrl ?? DEFAULT_SKIN_DATA_URL,
    avatar,
    actionState: {
      ...createActionState(),
      ...(playerMeta?.actionState ?? {}),
    },
    samples: [],
    renderPose: null,
    rope: null,
    strikeTimer: 0,
    ready: Boolean(playerMeta?.ready),
    playerPhase: playerMeta?.playerPhase ?? MATCH_PHASES.staging,
    guestIndex: playerMeta?.guestIndex ?? 0,
  };
  multiplayerState.remotePlayers.set(playerId, remotePlayer);
  if (remotePlayer.actionState.poopActive) {
    ensureRemotePoopRope(remotePlayer);
  }
  return remotePlayer;
}

function queueRemotePose(playerId, playerMeta, pose) {
  const remotePlayer = ensureRemotePlayer(playerId, playerMeta);
  if (playerMeta?.actionState) {
    remotePlayer.actionState = {
      ...remotePlayer.actionState,
      ...playerMeta.actionState,
    };
    if (remotePlayer.actionState.poopActive) {
      ensureRemotePoopRope(remotePlayer);
    }
  }
  const sample = {
    time: performance.now(),
    pose: {
      x: pose?.x ?? getSpawnForPhase(remotePlayer.playerPhase).x,
      y: pose?.y ?? getSpawnForPhase(remotePlayer.playerPhase).y,
      z: pose?.z ?? getSpawnForPhase(remotePlayer.playerPhase).z,
      yaw: pose?.yaw ?? getSpawnForPhase(remotePlayer.playerPhase).yaw,
      moveAmount: pose?.moveAmount ?? 0,
    },
  };

  remotePlayer.samples.push(sample);
  if (remotePlayer.samples.length > 6) {
    remotePlayer.samples.shift();
  }

  if (!remotePlayer.renderPose) {
    remotePlayer.renderPose = { ...sample.pose };
    updateRemotePlayerAvatar(remotePlayer.avatar, remotePlayer.renderPose, 0);
  }
}

function interpolateRemotePose(firstPose, secondPose, t) {
  return {
    x: THREE.MathUtils.lerp(firstPose.x, secondPose.x, t),
    y: THREE.MathUtils.lerp(firstPose.y, secondPose.y, t),
    z: THREE.MathUtils.lerp(firstPose.z, secondPose.z, t),
    yaw: lerpAngle(firstPose.yaw, secondPose.yaw, t),
    moveAmount: THREE.MathUtils.lerp(firstPose.moveAmount, secondPose.moveAmount, t),
  };
}

function sampleRemotePose(samples, now) {
  if (samples.length === 0) {
    return null;
  }

  const targetTime = now - REMOTE_INTERPOLATION_BACKTIME_MS;
  while (samples.length > 2 && samples[1].time <= targetTime) {
    samples.shift();
  }

  if (samples.length === 1 || targetTime <= samples[0].time) {
    return { ...samples[0].pose };
  }

  const [first, second] = samples;
  const span = Math.max(1, second.time - first.time);
  const t = THREE.MathUtils.clamp((targetTime - first.time) / span, 0, 1);
  return interpolateRemotePose(first.pose, second.pose, t);
}

function setLocalPoopActive(isActive) {
  if (multiplayerState.localActionState.poopActive === isActive) {
    return;
  }

  multiplayerState.localActionState.poopActive = isActive;
  multiplayer.sendAction(isActive ? ACTION_KINDS.poopStart : ACTION_KINDS.poopStop);
}

function ensureRemotePoopRope(remotePlayer) {
  if (remotePlayer.rope) {
    remotePlayer.rope.isGrowing = true;
    return;
  }

  const anchorPosition = remotePlayer.avatar.buttAnchor.getWorldPosition(tempVecQ).clone();
  remotePlayer.rope = createPoopRope(anchorPosition, {
    anchorResolver: () => remotePlayer.avatar.buttAnchor.getWorldPosition(tempVecQ).clone(),
    yawResolver: () => remotePlayer.renderPose?.yaw ?? remotePlayer.avatar.root.rotation.y,
  });
  poopRopes.push(remotePlayer.rope);
  trimPoopRopes();
}

function stopRemotePoopRope(remotePlayer) {
  if (!remotePlayer.rope) {
    return;
  }

  remotePlayer.rope.isGrowing = false;
}

function updateRemotePlayers(delta, now) {
  for (const remotePlayer of multiplayerState.remotePlayers.values()) {
    const rosterPlayer = multiplayerState.playerRoster.get(remotePlayer.id);
    if (rosterPlayer) {
      remotePlayer.ready = Boolean(rosterPlayer.ready);
      remotePlayer.playerPhase = rosterPlayer.playerPhase ?? remotePlayer.playerPhase;
      remotePlayer.guestIndex = rosterPlayer.guestIndex ?? remotePlayer.guestIndex;
    }

    if (remotePlayer.playerPhase === MATCH_PHASES.bus) {
      remotePlayer.avatar.root.visible = false;
      const busPosition = getBusSeatWorldPosition(remotePlayer.guestIndex, Date.now(), tempVecO);
      remotePlayer.renderPose = {
        x: busPosition.x,
        y: busPosition.y,
        z: busPosition.z,
        yaw: getBusTransform(Date.now()).yaw,
        moveAmount: 0,
      };
      updateRemotePlayerAvatar(remotePlayer.avatar, remotePlayer.renderPose, delta);
      stopRemotePoopRope(remotePlayer);
      continue;
    }

    remotePlayer.avatar.root.visible = true;

    if (remotePlayer.actionState.poopActive && !remotePlayer.rope) {
      ensureRemotePoopRope(remotePlayer);
    }

    const sampledPose = sampleRemotePose(remotePlayer.samples, now);
    if (!sampledPose) {
      continue;
    }

    if (!remotePlayer.renderPose) {
      remotePlayer.renderPose = { ...sampledPose };
    } else {
      const followAmount = 1 - Math.exp(-delta * 14);
      remotePlayer.renderPose.x = THREE.MathUtils.lerp(
        remotePlayer.renderPose.x,
        sampledPose.x,
        followAmount,
      );
      remotePlayer.renderPose.y = THREE.MathUtils.lerp(
        remotePlayer.renderPose.y,
        sampledPose.y,
        followAmount,
      );
      remotePlayer.renderPose.z = THREE.MathUtils.lerp(
        remotePlayer.renderPose.z,
        sampledPose.z,
        followAmount,
      );
      remotePlayer.renderPose.yaw = lerpAngle(
        remotePlayer.renderPose.yaw,
        sampledPose.yaw,
        followAmount,
      );
      remotePlayer.renderPose.moveAmount = THREE.MathUtils.lerp(
        remotePlayer.renderPose.moveAmount,
        sampledPose.moveAmount,
        followAmount,
      );
    }

    remotePlayer.strikeTimer = Math.max(0, remotePlayer.strikeTimer - delta);
    updateRemotePlayerAvatar(
      remotePlayer.avatar,
      {
        ...remotePlayer.renderPose,
        poopAmount: remotePlayer.actionState.poopActive ? 1 : 0,
        strikeAmount:
          remotePlayer.strikeTimer > 0
            ? Math.sin((1 - remotePlayer.strikeTimer / strikeConfig.duration) * Math.PI)
            : 0,
      },
      delta,
    );
  }
}

function createLocalPosePacket() {
  return {
    x: state.playerPosition.x,
    y: state.playerPosition.y,
    z: state.playerPosition.z,
    yaw: state.playerYaw,
    moveAmount: state.moveAmount,
  };
}

function updateMultiplayer(now) {
  if (!multiplayerState.joined) {
    return;
  }

  multiplayer.tick(now, createLocalPosePacket());
}

function lerpAngle(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function resetRound(initial = false) {
  resetRoundState();
  if (!multiplayerState.joined) {
    state.playerPhase = MATCH_PHASES.staging;
    positionPlayerForPhase(MATCH_PHASES.active);
  } else if (multiplayerState.matchState.phase === MATCH_PHASES.staging || multiplayerState.matchState.phase === MATCH_PHASES.countdown) {
    enterLocalStagingPhase(false);
  } else {
    enterLocalActivePhase(false, true);
  }
  standingTarget.state.floatTime = Math.random() * Math.PI * 2;
  standingTarget.state.wobble = 0;
  standingTarget.state.wobbleVelocity = 0;
  standingTarget.state.recoil = 0;
  standingTarget.state.twist = 0;
  standingTarget.state.hitFlash = 0;
  standingTarget.swayPivot.rotation.set(0, 0, 0);
  standingTarget.visualGroup.scale.setScalar(1);

  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;

  updateHud();
  setMessage(
    !multiplayerState.joined
      ? "Valj en lobby i menyn for att ga in i multiplayerlaget."
      : initial
        ? "Klicka i scenen for att lasa musen. Tryck Ready i staging-lobbyn nar du vill att matchen ska dra igang."
        : "Ny runda. Glid ner pa on och borja sedan med det vanliga kaoset.",
  );
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  if (!multiplayerState.joined) {
    return;
  }

  if (event.code === "KeyW") {
    input.forward = true;
  }
  if (event.code === "KeyS") {
    input.backward = true;
  }
  if (event.code === "KeyA") {
    input.left = true;
  }
  if (event.code === "KeyD") {
    input.right = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (state.playerPhase === MATCH_PHASES.bus) {
      if (canJumpFromBus()) {
        enterLocalGlidePhase(true, false);
      }
      return;
    }
    if (state.playerPhase === MATCH_PHASES.active && !state.gameOver && state.grounded) {
      state.verticalVelocity = heroMetrics.jumpVelocity;
      state.grounded = false;
    }
  }
  if (event.code === "KeyF" && state.playerPhase === MATCH_PHASES.active) {
    performStrike();
  }
  if (event.code === "KeyR" && state.gameOver) {
    resetRound();
  }
}

function onKeyUp(event) {
  if (!multiplayerState.joined) {
    resetInputState();
    return;
  }

  if (event.code === "KeyW") {
    input.forward = false;
  }
  if (event.code === "KeyS") {
    input.backward = false;
  }
  if (event.code === "KeyA") {
    input.left = false;
  }
  if (event.code === "KeyD") {
    input.right = false;
  }
}

function onPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  if (multiplayerState.menuOpen) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(standingTarget.root, true);
    if (intersects.length > 0) {
      applyTargetHitVisuals(intersects[0].point, new THREE.Vector3(0, 5, -12));
      standingTarget.state.hitFlash = 3; // Huge squash/stretch flash
      standingTarget.state.wobbleVelocity += 12; // Extra wobble
      standingTarget.state.menuSpin = (standingTarget.state.menuSpin || 0) + Math.PI * 2; // Cartwheel!
    }
    return;
  }

  if (isPaused) return;

  if (!multiplayerState.joined) {
    setMessage("Välj en lobby i menyn innan du går in i spelet.");
    return;
  }

  if (!isPointerLocked()) {
    if (state.playerPhase === MATCH_PHASES.staging || state.playerPhase === MATCH_PHASES.countdown) {
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(standingTarget.root, true);
      if (intersects.length > 0) {
        applyTargetHitVisuals(intersects[0].point, new THREE.Vector3(0, 5, -12));
        standingTarget.state.hitFlash = 3;
        standingTarget.state.wobbleVelocity += 12;
        standingTarget.state.menuSpin = (standingTarget.state.menuSpin || 0) + Math.PI * 2;
      }
      return;
    }

    canvas.requestPointerLock();
    return;
  }

  if (state.playerPhase !== MATCH_PHASES.active) {
    if (state.playerPhase === MATCH_PHASES.staging) {
      setMessage("Du är i staging-lobbyn. Tryck Ready och vänta på battle bussen.");
    } else if (state.playerPhase === MATCH_PHASES.bus) {
      setMessage("Håll i dig. Space används för att hoppa när dörrarna öppnas.");
    } else if (state.playerPhase === MATCH_PHASES.glide) {
      setMessage("Ingen bajsning i luften. Segla ner och landa först.");
    }
    return;
  }

  if (!state.isOnPhone) {
    setMessage("Kliv upp pa telefonen och hall inne musen for att borja pressa.");
    return;
  }

  poopHoldState.pointerId = event.pointerId;
  poopHoldState.isPointerDown = true;
  poopHoldState.holdTime = 0;
  poopHoldState.started = false;
}

function onPointerMove(event) {
  if (!multiplayerState.joined || !isPointerLocked() || isPaused) {
    return;
  }

  const nextX = typeof event.movementX === "number" ? event.movementX : 0;
  const nextY = typeof event.movementY === "number" ? event.movementY : 0;
  state.cameraYaw -= nextX * 0.0052;
  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - nextY * 0.0038, -0.65, 0.22);
}

function onPointerUp(event) {
  if (poopHoldState.pointerId !== null && event.pointerId !== poopHoldState.pointerId) {
    return;
  }

  stopPoopHold();
}

function onPointerCancel(event) {
  if (poopHoldState.pointerId !== null && event.pointerId !== poopHoldState.pointerId) {
    return;
  }

  stopPoopHold();
}

function onPointerLeave(event) {
  if (!poopHoldState.isPointerDown) {
    return;
  }

  if (poopHoldState.pointerId !== null && event.pointerId !== poopHoldState.pointerId) {
    return;
  }

  stopPoopHold();
}

function onWindowBlur() {
  stopPoopHold();
}

function onVisibilityChange() {
  if (document.hidden) {
    stopPoopHold();
  }
}

function onPointerLockChange() {
  const locked = document.pointerLockElement === canvas;
  document.body.classList.toggle("pointer-locked", locked);

  if (locked) {
    isPaused = false;
    if (pauseMenuEl) pauseMenuEl.classList.add("hidden");
    setMessage("Musen är låst. Vrid runt och klicka!");
    return;
  }

  stopPoopHold();
  
  if (multiplayerState.joined && !multiplayerState.menuOpen && !state.gameOver) {
    isPaused = true;
    if (pauseMenuEl) pauseMenuEl.classList.remove("hidden");
  } else if (!isPaused) {
    setMessage("Klicka i scenen för att låsa musen igen.");
  }
}

function onPointerLockError() {
  setMessage("Det gick inte att låsa musen i den här webbläsaren.");
}

function isPointerLocked() {
  return document.pointerLockElement === canvas;
}

function stopPoopHold(reason = "release") {
  const shouldReportPhoneExit = reason === "left-phone" && poopHoldState.started;
  const wasPooping = Boolean(activePoopRope) || multiplayerState.localActionState.poopActive;

  poopHoldState.pointerId = null;
  poopHoldState.isPointerDown = false;
  poopHoldState.holdTime = 0;
  poopHoldState.started = false;

  if (activePoopRope) {
    activePoopRope.isGrowing = false;
    activePoopRope = null;
  }

  if (wasPooping) {
    setLocalPoopActive(false);
  }

  if (shouldReportPhoneExit) {
    setMessage("Korven slutade vaxa direkt nar du lamnade telefonen.");
  }
}

function updatePoopHold(delta) {
  if (!poopHoldState.isPointerDown) {
    return;
  }

  if (state.gameOver || state.playerPhase !== MATCH_PHASES.active || !isPointerLocked()) {
    stopPoopHold();
    return;
  }

  if (!state.isOnPhone) {
    stopPoopHold("left-phone");
    return;
  }

  poopHoldState.holdTime += delta;
  if (poopHoldState.started || poopHoldState.holdTime < poopConfig.holdThreshold) {
    return;
  }

  poopHoldState.started = true;
  activePoopRope = createPoopRope(hero.buttAnchor.getWorldPosition(tempVecA).clone());
  poopRopes.push(activePoopRope);
  trimPoopRopes();
  setLocalPoopActive(true);
  setMessage("Trycket slapper. Hall kvar sa vaxer bajskorven.");
}

function performStrike() {
  if (state.gameOver || state.cooldown > 0) {
    return;
  }

  tempVecH.copy(standingTarget.root.position).sub(state.playerPosition).setY(0);
  if (tempVecH.lengthSq() > 0.01) {
    const strikeYaw = Math.atan2(tempVecH.x, tempVecH.z);
    state.playerYaw = dampAngle(state.playerYaw, strikeYaw, strikeConfig.playerTurnSnap);
  }

  state.cooldown = strikeConfig.cooldown;
  state.strikeAnimation = strikeConfig.duration;
  state.strikeResolved = false;
  multiplayer.sendAction(ACTION_KINDS.strike);
  setMessage("Du laddar upp en rak höger mot öken-gubben.");
}

function getStrikeImpact() {
  const strikeOrigin = hero.strikeAnchor.getWorldPosition(tempVecA);
  const targetCenter = standingTarget.swayPivot.getWorldPosition(tempVecB);
  const toTarget = tempVecC.copy(targetCenter).sub(strikeOrigin);
  const distance = toTarget.length();
  if (distance > strikeConfig.range) {
    return null;
  }

  const impactPoint = tempVecF.copy(targetCenter);
  impactPoint.x += THREE.MathUtils.clamp(toTarget.x * 0.12, -0.18, 0.18);
  impactPoint.y += 0.08;
  impactPoint.z += THREE.MathUtils.clamp(toTarget.z * 0.12, -0.18, 0.18);
  const impactVelocity = tempVecG
    .copy(toTarget)
    .setY(0)
    .normalize()
    .multiplyScalar(18 + state.moveAmount * 5);

  return {
    impactPoint: impactPoint.clone(),
    impactVelocity: impactVelocity.clone(),
    distance,
  };
}

function updateStrike(delta) {
  if (state.strikeAnimation <= 0) {
    return;
  }

  state.strikeAnimation = Math.max(0, state.strikeAnimation - delta);
  const progress = 1 - state.strikeAnimation / strikeConfig.duration;
  if (!state.strikeResolved && progress >= 0.46) {
    state.strikeResolved = true;
    const impact = getStrikeImpact();
    if (impact) {
      registerTargetHit(impact.impactPoint, impact.impactVelocity);
      return;
    }

    registerMiss("Slaget ven bara ut i luften. Gubben står fortfarande ute i öknen.");
  }
}

function getTargetAimPosition() {
  return standingTarget.swayPivot.getWorldPosition(tempVecD);
}

function getPhoneTopY() {
  return phoneRig.position.y + phoneMetrics.thickness / 2;
}

function isInsidePhoneSupport(localPosition) {
  return (
    Math.abs(localPosition.x) <= poopConfig.standX &&
    Math.abs(localPosition.z) <= poopConfig.standZ
  );
}

function getSupportHeight(position) {
  let supportHeight = 0;
  const local = phoneRig.worldToLocal(tempVecA.copy(position));
  if (isInsidePhoneSupport(local)) {
    supportHeight = getPhoneTopY();
  }

  groundSupports.forEach((support) => {
    const offsetX = position.x - support.x;
    const offsetZ = position.z - support.z;
    const cosRotation = Math.cos(support.rotation);
    const sinRotation = Math.sin(support.rotation);
    const localX = offsetX * cosRotation + offsetZ * sinRotation;
    const localZ = -offsetX * sinRotation + offsetZ * cosRotation;

    if (Math.abs(localX) <= support.halfX && Math.abs(localZ) <= support.halfZ) {
      supportHeight = Math.max(supportHeight, support.height);
    }
  });

  return supportHeight;
}

function isStandingOnPhone(position) {
  const local = phoneRig.worldToLocal(tempVecH.copy(position));
  return isInsidePhoneSupport(local);
}

function clampWorldPointToPhoneScreen(point, surfaceOffset = 0.03) {
  const localPoint = phoneRig.worldToLocal(tempVecC.copy(point));
  localPoint.x = THREE.MathUtils.clamp(localPoint.x, -poopConfig.targetX, poopConfig.targetX);
  localPoint.z = THREE.MathUtils.clamp(localPoint.z, -poopConfig.targetZ, poopConfig.targetZ);
  localPoint.y = phoneMetrics.thickness / 2 + surfaceOffset;
  return phoneRig.localToWorld(localPoint);
}

function getMoveIntent() {
  const axisX = Number(input.right) - Number(input.left);
  const axisZ = Number(input.forward) - Number(input.backward);

  if (axisX === 0 && axisZ === 0) {
    return tempVecE.set(0, 0, 0);
  }

  const cameraForward = tempVecE.set(
    Math.sin(state.cameraYaw),
    0,
    Math.cos(state.cameraYaw),
  );
  const cameraRight = tempVecF.set(-cameraForward.z, 0, cameraForward.x);

  return cameraForward.multiplyScalar(axisZ).add(cameraRight.multiplyScalar(axisX)).normalize();
}

function updatePlayer(delta) {
  hero.root.visible = state.playerPhase !== MATCH_PHASES.bus;

  if (activePoopRope) {
    state.poopAnimation = Math.min(0.34, state.poopAnimation + delta * 1.8);
  } else {
    state.poopAnimation = Math.max(0, state.poopAnimation - delta);
  }

  if (state.gameOver) {
    state.isOnPhone = false;
    return;
  }

  const moveIntent = getMoveIntent();
  const isMoving = moveIntent.lengthSq() > 0;
  const speed = heroMetrics.moveSpeed;

  if (state.playerPhase === MATCH_PHASES.bus) {
    const busNow = Date.now();
    positionPlayerForPhase(MATCH_PHASES.bus, { now: busNow, _busFrameUpdate: true });
    state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0, 1 - Math.exp(-delta * 8));
    state.walkCycle += delta * 2.2;
    state.grounded = false;
    state.isOnPhone = false;

    if (
      !state.autoDropTriggered &&
      Number.isFinite(multiplayerState.matchState.autoDropAt) &&
      busNow >= multiplayerState.matchState.autoDropAt
    ) {
      enterLocalGlidePhase(true, true);
      setMessage("Bussen hann till slutet av ön. Du blev automatiskt avhoppad.");
    }
  }

  if (state.playerPhase === MATCH_PHASES.glide) {
    stopPoopHold();
    state.isOnPhone = false;
    state.grounded = false;
    state.verticalVelocity = -glideConfig.fallSpeed;

    if (isMoving) {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0.7, 1 - Math.exp(-delta * 7));
      state.walkCycle += delta * 6.4;
      state.playerYaw = dampAngle(state.playerYaw, Math.atan2(moveIntent.x, moveIntent.z), delta * glideConfig.turnSpeed);
      state.glideVelocity.x = THREE.MathUtils.lerp(
        state.glideVelocity.x,
        moveIntent.x * glideConfig.airSpeed,
        1 - Math.exp(-delta * 7),
      );
      state.glideVelocity.z = THREE.MathUtils.lerp(
        state.glideVelocity.z,
        moveIntent.z * glideConfig.airSpeed,
        1 - Math.exp(-delta * 7),
      );
    } else {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0.18, 1 - Math.exp(-delta * 4));
      state.glideVelocity.x = THREE.MathUtils.lerp(state.glideVelocity.x, 0, 1 - Math.exp(-delta * 4));
      state.glideVelocity.z = THREE.MathUtils.lerp(state.glideVelocity.z, 0, 1 - Math.exp(-delta * 4));
    }

    state.playerPosition.x += state.glideVelocity.x * delta;
    state.playerPosition.z += state.glideVelocity.z * delta;
    state.playerPosition.y += state.verticalVelocity * delta;
    keepInsideArena(state.playerPosition);

    const supportHeight = getSupportHeight(state.playerPosition);
    if (state.playerPosition.y <= supportHeight + glideConfig.landingThreshold) {
      state.playerPosition.y = supportHeight;
      enterLocalActivePhase(true, false);
      setMessage("Landa snyggt. Nu är du live på ön.");
    }
  } else if (state.playerPhase === MATCH_PHASES.staging) {
    stopPoopHold();
    if (isMoving) {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 1, 1 - Math.exp(-delta * 10));
      state.walkCycle += delta * 9.6;
      state.playerYaw = dampAngle(state.playerYaw, Math.atan2(moveIntent.x, moveIntent.z), delta * 12);
      const nextPosition = tempVecG.copy(state.playerPosition).addScaledVector(moveIntent, speed * delta * 0.78);
      keepInsideStagingPlatform(nextPosition);
      state.playerPosition.copy(nextPosition);
    } else {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0, 1 - Math.exp(-delta * 8));
    }
    state.grounded = true;
    state.playerPosition.y = stagingPlatform.height;
    state.isOnPhone = false;
  } else if (state.playerPhase === MATCH_PHASES.active) {
    if (isMoving) {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 1, 1 - Math.exp(-delta * 10));
      state.walkCycle += delta * 10.5;
      state.playerYaw = dampAngle(state.playerYaw, Math.atan2(moveIntent.x, moveIntent.z), delta * 14);

      const nextPosition = tempVecG.copy(state.playerPosition).addScaledVector(moveIntent, speed * delta);
      keepInsideArena(nextPosition);
      if (state.playerPosition.y < getPhoneTopY() + heroMetrics.phoneCollisionHeight) {
        resolvePhoneCollision(nextPosition);
      }
      if (state.playerPosition.y < heroMetrics.worldCollisionHeight) {
        resolveWorldCollisions(nextPosition);
      }
      keepInsideArena(nextPosition);
      state.playerPosition.copy(nextPosition);
    } else {
      state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0, 1 - Math.exp(-delta * 9));
    }

    if (!state.grounded) {
      state.verticalVelocity -= 19.5 * delta;
      state.playerPosition.y += state.verticalVelocity * delta;
      const supportHeight = getSupportHeight(state.playerPosition);
      if (state.playerPosition.y <= supportHeight) {
        state.playerPosition.y = supportHeight;
        state.verticalVelocity = 0;
        state.grounded = true;
      }
    }

    if (state.grounded) {
      state.playerPosition.y = getSupportHeight(state.playerPosition);
    }

    state.isOnPhone = state.grounded && isStandingOnPhone(state.playerPosition);
  }

  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;

  const walkSwing = Math.sin(state.walkCycle) * state.moveAmount;
  const counterSwing = Math.sin(state.walkCycle + Math.PI) * state.moveAmount;
  const jumpLean =
    state.playerPhase === MATCH_PHASES.glide
      ? 0.22
      : state.grounded
        ? 0
        : Math.min(0.28, Math.max(-0.18, state.verticalVelocity * 0.04));
  const poopPose =
    state.playerPhase === MATCH_PHASES.active && state.poopAnimation > 0
      ? Math.sin((1 - state.poopAnimation / 0.34) * Math.PI)
      : 0;
  const strikeProgress =
    state.playerPhase === MATCH_PHASES.active && state.strikeAnimation > 0
      ? 1 - state.strikeAnimation / strikeConfig.duration
      : 0;
  const strikePose = state.strikeAnimation > 0 ? Math.sin(strikeProgress * Math.PI) : 0;
  const strikeTwist = state.strikeAnimation > 0 ? Math.sin(strikeProgress * Math.PI * 0.9) : 0;

  hero.leftLeg.rotation.x = walkSwing * 0.55 - poopPose * 0.42;
  hero.rightLeg.rotation.x = counterSwing * 0.55 - poopPose * 0.42;
  hero.leftArm.rotation.x = counterSwing * 0.48 - 0.08 + poopPose * 0.08 + strikePose * 0.34;
  hero.rightArm.rotation.x = walkSwing * 0.28 + 0.1 + poopPose * 0.14 - strikePose * 1.75;
  hero.leftArm.rotation.z = 0.03 + poopPose * 0.02 - strikePose * 0.08;
  hero.rightArm.rotation.z = -0.03 - poopPose * 0.02 + strikePose * 0.22;
  hero.torso.rotation.x = -state.moveAmount * 0.08 - jumpLean + poopPose * 0.2;
  hero.torso.rotation.y = -strikeTwist * 0.34;
  hero.torso.position.y =
    Math.abs(Math.sin(state.walkCycle * 2)) * state.moveAmount * 0.08 +
    state.playerPosition.y * 0.08 -
    poopPose * 0.08;
  hero.headPivot.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.1 + strikeTwist * 0.18;
  hero.headPivot.rotation.x = -0.05 + Math.cos(clock.elapsedTime * 1.4) * 0.02 - poopPose * 0.04;

  if (state.playerPhase === MATCH_PHASES.bus) {
    hero.leftArm.rotation.x = -0.72;
    hero.rightArm.rotation.x = -0.72;
    hero.leftArm.rotation.z = 0.06;
    hero.rightArm.rotation.z = -0.06;
    hero.leftLeg.rotation.x = 0.34;
    hero.rightLeg.rotation.x = 0.34;
    hero.torso.rotation.x = -0.1;
    hero.torso.position.y = state.playerPosition.y * 0.08 + Math.sin(clock.elapsedTime * 3) * 0.02;
  } else if (state.playerPhase === MATCH_PHASES.glide) {
    hero.leftArm.rotation.x = -1.22;
    hero.rightArm.rotation.x = -1.22;
    hero.leftArm.rotation.z = 0.58;
    hero.rightArm.rotation.z = -0.58;
    hero.leftLeg.rotation.x = 0.16;
    hero.rightLeg.rotation.x = 0.16;
    hero.torso.rotation.x = -0.22;
    hero.torso.position.y = state.playerPosition.y * 0.08;
  }
}

function keepInsideStagingPlatform(position) {
  position.x = THREE.MathUtils.clamp(
    position.x,
    stagingPlatform.center.x - stagingPlatform.halfX + 0.75,
    stagingPlatform.center.x + stagingPlatform.halfX - 0.75,
  );
  position.z = THREE.MathUtils.clamp(
    position.z,
    stagingPlatform.center.z - stagingPlatform.halfZ + 0.75,
    stagingPlatform.center.z + stagingPlatform.halfZ - 0.75,
  );
  position.y = stagingPlatform.height;
}

function keepInsideArena(position) {
  tempVecA.copy(position);
  tempVecA.y = 0;
  if (tempVecA.length() > world.arenaRadius) {
    tempVecA.setLength(world.arenaRadius);
    position.x = tempVecA.x;
    position.z = tempVecA.z;
  }
}

function resolvePhoneCollision(position) {
  const local = phoneRig.worldToLocal(tempVecH.copy(position));
  if (isInsidePhoneSupport(local)) {
    return;
  }

  const phoneTopY = getPhoneTopY();
  const canJumpOntoPhone =
    position.y >= phoneTopY - heroMetrics.phoneJumpAssistHeight &&
    Math.abs(local.x) <= phoneMetrics.width / 2 + 0.08 &&
    Math.abs(local.z) <= phoneMetrics.length / 2 + 0.08;

  if (canJumpOntoPhone) {
    return;
  }

  const collisionX = phoneMetrics.width / 2 + 0.12;
  const collisionZ = phoneMetrics.length / 2 + 0.14;

  if (Math.abs(local.x) < collisionX && Math.abs(local.z) < collisionZ) {
    const pushX = collisionX - Math.abs(local.x);
    const pushZ = collisionZ - Math.abs(local.z);

    if (pushX < pushZ) {
      local.x = Math.sign(local.x || 1) * collisionX;
    } else {
      local.z = Math.sign(local.z || 1) * collisionZ;
    }

    const pushedWorld = phoneRig.localToWorld(local);
    position.x = pushedWorld.x;
    position.z = pushedWorld.z;
  }
}

function resolveWorldCollisions(position) {
  worldColliders.forEach((collider) => {
    if (collider.type === "cylinder") {
      const dx = position.x - collider.x;
      const dz = position.z - collider.z;
      const minDistance = collider.radius + collider.padding;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq >= minDistance * minDistance) {
        return;
      }

      if (distanceSq < 0.0001) {
        position.x += minDistance;
        return;
      }

      const distance = Math.sqrt(distanceSq);
      const push = minDistance - distance;
      position.x += (dx / distance) * push;
      position.z += (dz / distance) * push;
      return;
    }

    const paddedHalfX = collider.halfX + collider.padding;
    const paddedHalfZ = collider.halfZ + collider.padding;
    const offsetX = position.x - collider.x;
    const offsetZ = position.z - collider.z;

    if (Math.abs(offsetX) >= paddedHalfX || Math.abs(offsetZ) >= paddedHalfZ) {
      return;
    }

    const pushX = paddedHalfX - Math.abs(offsetX);
    const pushZ = paddedHalfZ - Math.abs(offsetZ);
    if (pushX < pushZ) {
      position.x = collider.x + Math.sign(offsetX || 1) * paddedHalfX;
    } else {
      position.z = collider.z + Math.sign(offsetZ || 1) * paddedHalfZ;
    }
  });
}

function updateCamera(delta) {
  if (multiplayerState.menuOpen) {
    const targetPos = standingTarget.root.position;
    // Camera approaches target from map center direction — cacti end up behind him
    const menuCamPos = tempVecA.set(targetPos.x - 14, 2.6, targetPos.z + 2);
    const menuLookAt = tempVecB.set(targetPos.x, 1.4, targetPos.z);
    camera.position.lerp(menuCamPos, 1 - Math.exp(-delta * 5));
    camera.lookAt(menuLookAt);
    return;
  }

  if (state.playerPhase === MATCH_PHASES.bus) {
    const transform = getBusTransform(Date.now());
    const busCamDistance = 9.5;
    const busCamLift = 3.2;
    const flatForwardBus = tempVecA.set(
      Math.sin(state.cameraYaw),
      0,
      Math.cos(state.cameraYaw),
    ).normalize();
    const desiredPosition = tempVecB
      .copy(transform.position)
      .addScaledVector(flatForwardBus, -busCamDistance)
      .add(tempVecC.set(0, busCamLift, 0));
    const lookDirection = tempVecD.set(
      Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch),
      Math.sin(state.cameraPitch),
      Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch),
    ).normalize();
    const lookTarget = tempVecE.copy(transform.position).addScaledVector(lookDirection, busConfig.lookAhead);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 4.8));
    camera.lookAt(lookTarget);
    return;
  }

  const flatForward = tempVecI.set(
    Math.sin(state.cameraYaw),
    0,
    Math.cos(state.cameraYaw),
  ).normalize();
  const cameraRight = tempVecJ.set(-flatForward.z, 0, flatForward.x);
  const lookDirection = tempVecK.set(
    Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch),
    Math.sin(state.cameraPitch),
    Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch),
  ).normalize();
  const anchor = tempVecL.copy(state.playerPosition).add(tempVecA.set(0, heroMetrics.cameraAnchorHeight, 0));
  const desiredPosition = tempVecB
    .copy(anchor)
    .addScaledVector(
      flatForward,
      state.playerPhase === MATCH_PHASES.glide ? -(heroMetrics.cameraDistance + 1.8) : -heroMetrics.cameraDistance,
    )
    .addScaledVector(cameraRight, heroMetrics.cameraSide)
    .add(
      tempVecC.set(
        0,
        (state.playerPhase === MATCH_PHASES.glide ? heroMetrics.cameraLift + 1.1 : heroMetrics.cameraLift) -
          state.cameraPitch * 0.9,
        0,
      ),
    );
  const lookAt = tempVecD
    .copy(anchor)
    .addScaledVector(
      lookDirection,
      state.playerPhase === MATCH_PHASES.glide ? heroMetrics.cameraLookDistance + 4 : heroMetrics.cameraLookDistance,
    );

  camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 13));
  camera.lookAt(lookAt);
}

function updateStandingTarget(delta) {
  const targetState = standingTarget.state;
  targetState.floatTime += delta;
  targetState.recoil = THREE.MathUtils.lerp(
    targetState.recoil,
    0,
    1 - Math.exp(-delta * 8),
  );
  targetState.twist = THREE.MathUtils.lerp(
    targetState.twist,
    0,
    1 - Math.exp(-delta * 7),
  );
  targetState.hitFlash = Math.max(0, targetState.hitFlash - delta * 2.8);
  targetState.wobbleVelocity +=
    (-targetState.wobble * 24 - targetState.wobbleVelocity * 7.8) * delta;
  targetState.wobble += targetState.wobbleVelocity * delta;

  tempVecN.copy(camera.position).sub(standingTarget.root.position).setY(0);
  if (tempVecN.lengthSq() > 0.001) {
    const targetYaw = Math.atan2(tempVecN.x, tempVecN.z);
    standingTarget.billboardPivot.rotation.y = dampAngle(
      standingTarget.billboardPivot.rotation.y,
      targetYaw,
      delta * 10,
    );
  }

  const idleBob = Math.sin(targetState.floatTime * 1.85) * 0.05;
  const idleSway = Math.sin(targetState.floatTime * 1.3) * 0.04;
  const hitSway = targetState.wobble * 0.24;
  standingTarget.swayPivot.position.y =
    standingTargetMetrics.swayBaseY + idleBob - targetState.recoil * 0.28;
  standingTarget.swayPivot.rotation.x = -targetState.recoil * 0.52;
  standingTarget.swayPivot.rotation.y = targetState.twist;
  standingTarget.swayPivot.rotation.z = idleSway + hitSway;

  const scalePunch = 1 + targetState.hitFlash * 0.08;
  standingTarget.visualGroup.scale.set(
    scalePunch,
    1 - targetState.hitFlash * 0.05,
    scalePunch,
  );

  if (targetState.menuSpin > 0) {
    const spinAmount = Math.min(targetState.menuSpin, delta * 12);
    targetState.menuSpin -= spinAmount;
    standingTarget.visualGroup.rotation.z += spinAmount;
  }
  standingTarget.glow.material.opacity = 0.16 + targetState.hitFlash * 0.34;
  standingTarget.beacon.material.opacity =
    0.14 + Math.sin(clock.elapsedTime * 4.5) * 0.04 + targetState.hitFlash * 0.18;
  standingTarget.beacon.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3.8) * 0.08);
  standingTarget.planeMaterial.emissiveIntensity = targetState.hitFlash * 0.68;
  standingTarget.baseShadow.material.opacity = 0.16 + targetState.hitFlash * 0.14;
  standingTarget.root.updateMatrixWorld(true);
}

function updateAimMarker() {
  if (state.playerPhase !== MATCH_PHASES.active) {
    aimMarker.visible = false;
    return;
  }

  const { ring, dot } = aimMarker.userData;
  tempVecA.copy(getTargetAimPosition()).sub(state.playerPosition);
  const distance = tempVecA.length();
  if (distance > strikeConfig.assistRange) {
    aimMarker.visible = false;
    return;
  }

  const impact = getStrikeImpact();
  const markerPoint = impact ? impact.impactPoint : tempVecB.copy(getTargetAimPosition());

  aimMarker.visible = true;
  aimMarker.position.copy(markerPoint);
  aimMarker.lookAt(camera.position);
  ring.rotation.x = 0;
  dot.position.set(0, 0, 0.03);
  ring.material.color.set(impact ? 0xfff4bf : 0xffc96b);
  dot.material.color.set(impact ? 0xff7f32 : 0xfff7dd);
  ring.scale.setScalar(impact ? 1.24 : 1.02);
  dot.scale.setScalar(impact ? 1.32 : 1.08);
  const pulse = impact
    ? 1.34 + Math.sin(clock.elapsedTime * 11) * 0.14
    : 1.02 + Math.sin(clock.elapsedTime * 8) * 0.08;
  aimMarker.scale.setScalar(pulse);
}

function updateProjectiles(delta) {
  const phoneTopY = getPhoneTopY();

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    const previousPosition = projectile.group.position.clone();
    projectile.age += delta;
    projectile.velocity.addScaledVector(gravity, delta);
    projectile.group.position.addScaledVector(projectile.velocity, delta);
    projectile.group.rotation.x += delta * 7;
    projectile.group.rotation.y += delta * 10;
    updateProjectileStream(projectile);

    const travelVector = tempVecN.copy(projectile.group.position).sub(previousPosition);
    const travelDistance = travelVector.length();
    if (travelDistance > 0.0001) {
      projectileRaycaster.set(previousPosition, travelVector.normalize());
      projectileRaycaster.far = travelDistance;
      const targetHit = projectileRaycaster.intersectObject(standingTarget.hitMesh, false)[0];
      if (targetHit) {
        registerTargetHit(targetHit.point, projectile.velocity);
        destroyProjectile(index);
        continue;
      }
    }

    const crossedPhonePlane =
      previousPosition.y > phoneTopY + 0.02 && projectile.group.position.y <= phoneTopY + 0.02;

    if (crossedPhonePlane) {
      const impactPoint = projectile.target.clone();
      const hitPhone = isPointOnPhone(impactPoint);
      if (hitPhone) {
        impactPoint.y = phoneTopY + 0.012 + splats.length * 0.0002;
        createSplat(impactPoint, true);
        if (isPointOnPhoneScreen(impactPoint)) {
          registerHit();
        } else {
          registerMiss("Det landade på ramen. Inget rent skott på glaset.");
        }
      } else {
        createSplat(
          new THREE.Vector3(projectile.group.position.x, 0.02, projectile.group.position.z),
          false,
        );
        registerMiss();
      }
      destroyProjectile(index);
      continue;
    }

    if (projectile.group.position.y <= 0.02 || projectile.age > 1.6) {
      createSplat(
        new THREE.Vector3(projectile.group.position.x, 0.02, projectile.group.position.z),
        false,
      );
      destroyProjectile(index);
      registerMiss();
    }
  }
}

function destroyProjectile(index) {
  const projectile = projectiles[index];
  scene.remove(projectile.group);
  projectile.group.traverse(disposeObject);
  if (projectile.streamGroup) {
    scene.remove(projectile.streamGroup);
    projectile.streamGroup.traverse(disposeObject);
  }
  projectiles.splice(index, 1);
}

function isPointOnPhone(point) {
  const local = phoneRig.worldToLocal(tempVecI.copy(point));
  return (
    Math.abs(local.x) <= phoneMetrics.width * 0.48 &&
    Math.abs(local.z) <= phoneMetrics.length * 0.48
  );
}

function isPointOnPhoneScreen(point) {
  const local = phoneRig.worldToLocal(tempVecM.copy(point));
  return (
    Math.abs(local.x) <= poopConfig.targetX &&
    Math.abs(local.z) <= poopConfig.targetZ
  );
}

function createPoopRope(anchorPosition, options = {}) {
  const baseMesh = new THREE.Mesh(undefined, poopTubeMaterial);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const slimeMesh = new THREE.Mesh(undefined, poopTubeSlimeMaterial);
  slimeMesh.castShadow = true;
  slimeMesh.receiveShadow = true;

  const rope = {
    group: new THREE.Group(),
    points: [],
    baseMesh,
    slimeMesh,
    anchorPosition: anchorPosition.clone(),
    anchorResolver: options.anchorResolver ?? null,
    yawResolver: options.yawResolver ?? null,
    spawnTimer: 0,
    isGrowing: true,
  };
  rope.group.add(baseMesh, slimeMesh);
  scene.add(rope.group);
  addPoopRopeSegment(rope, anchorPosition);
  return rope;
}

function addPoopRopeSegment(rope, position) {
  const point = {
    position: position.clone(),
    previousPosition: position.clone(),
    radius: poopConfig.chainRadius * THREE.MathUtils.randFloat(0.88, 1.12),
  };
  rope.points.push(point);
}

function updatePoopRopes(delta) {
  const gravityStep = delta * delta * 0.68;

  for (let ropeIndex = poopRopes.length - 1; ropeIndex >= 0; ropeIndex -= 1) {
    const rope = poopRopes[ropeIndex];
    if (rope.isGrowing) {
      if (rope.anchorResolver) {
        rope.anchorPosition.copy(rope.anchorResolver());
      } else {
        rope.anchorPosition.copy(hero.buttAnchor.getWorldPosition(tempVecA));
      }
      rope.spawnTimer += delta;
      while (
        rope.spawnTimer >= poopConfig.chainSpawnInterval &&
        rope.points.length < poopConfig.chainMaxSegments
      ) {
        rope.spawnTimer -= poopConfig.chainSpawnInterval;
        addPoopRopeSegment(rope, rope.anchorPosition);
      }

      // Keep feeding the rope backward from the player, even while standing still.
      const backwardDirection = tempVecD.set(
        -Math.sin(rope.yawResolver ? rope.yawResolver() : state.playerYaw),
        0,
        -Math.cos(rope.yawResolver ? rope.yawResolver() : state.playerYaw),
      );
      const backwardLength = backwardDirection.lengthSq();
      if (backwardLength > 0.0001) {
        backwardDirection.multiplyScalar(1 / Math.sqrt(backwardLength));
        for (let index = 1; index < rope.points.length; index += 1) {
          const point = rope.points[index];
          const influence = Math.pow(poopConfig.backwardFlowFalloff, Math.max(0, index - 1));
          const flowStep = poopConfig.backwardFlowSpeed * influence * delta;
          point.position.addScaledVector(backwardDirection, flowStep);
          point.previousPosition.addScaledVector(backwardDirection, flowStep * 0.35);
        }
      }
    }

    for (let index = 0; index < rope.points.length; index += 1) {
      if (rope.isGrowing && index === 0) {
        rope.points[index].position.copy(rope.anchorPosition);
        rope.points[index].previousPosition.copy(rope.anchorPosition);
        continue;
      }

      const point = rope.points[index];
      tempVecB.copy(point.position).sub(point.previousPosition).multiplyScalar(0.985);
      point.previousPosition.copy(point.position);
      point.position.add(tempVecB);
      point.position.addScaledVector(gravity, gravityStep);
    }

    for (let iteration = 0; iteration < poopConfig.chainConstraintIterations; iteration += 1) {
      if (rope.isGrowing && rope.points.length > 0) {
        rope.points[0].position.copy(rope.anchorPosition);
      }

      for (let index = 1; index < rope.points.length; index += 1) {
        const previousPoint = rope.points[index - 1];
        const point = rope.points[index];
        tempVecC.copy(point.position).sub(previousPoint.position);
        let distance = tempVecC.length();
        if (distance < 0.0001) {
          tempVecC.set(0, -1, 0);
          distance = 1;
        } else {
          tempVecC.divideScalar(distance);
        }

        const correction = distance - poopConfig.chainSegmentLength;
        if (rope.isGrowing && index === 1) {
          point.position.addScaledVector(tempVecC, -correction);
        } else {
          previousPoint.position.addScaledVector(tempVecC, correction * 0.5);
          point.position.addScaledVector(tempVecC, -correction * 0.5);
        }
      }

      for (let index = 0; index < rope.points.length; index += 1) {
        if (rope.isGrowing && index === 0) {
          continue;
        }

        resolvePoopPointCollision(rope.points[index]);
      }
    }

    updatePoopRopeMeshes(rope);
  }
}

function resolvePoopPointCollision(point) {
  const radius = point.radius * 0.6;
  let surfaceY = 0.02 + radius;
  if (isPointOnPhone(point.position)) {
    surfaceY = Math.max(surfaceY, getPhoneTopY() + radius * 0.92);
  }

  if (point.position.y < surfaceY) {
    const velocityX = point.position.x - point.previousPosition.x;
    const velocityZ = point.position.z - point.previousPosition.z;
    point.position.y = surfaceY;
    point.previousPosition.x = point.position.x - velocityX * 0.22;
    point.previousPosition.y = point.position.y;
    point.previousPosition.z = point.position.z - velocityZ * 0.22;
  }
}

function updatePoopRopeMeshes(rope) {
  if (rope.points.length < 2) {
    rope.baseMesh.visible = false;
    rope.slimeMesh.visible = false;
    return;
  }

  const curvePoints = rope.points.map((point) => point.position.clone());
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, "centripetal");
  const tubularSegments = Math.max(10, (rope.points.length - 1) * 4);
  const baseGeometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    poopConfig.chainRadius,
    poopConfig.tubeSides,
    false,
  );
  const slimeGeometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    poopConfig.chainRadius * poopConfig.tubeOverlayScale,
    poopConfig.tubeSides,
    false,
  );

  if (rope.baseMesh.geometry) {
    rope.baseMesh.geometry.dispose();
  }
  if (rope.slimeMesh.geometry) {
    rope.slimeMesh.geometry.dispose();
  }

  rope.baseMesh.geometry = baseGeometry;
  rope.slimeMesh.geometry = slimeGeometry;
  rope.baseMesh.visible = true;
  rope.slimeMesh.visible = true;
}

function trimPoopRopes() {
  while (poopRopes.length > poopConfig.maxRopes) {
    const rope = poopRopes.shift();
    if (!rope) {
      break;
    }

    destroyPoopRope(rope);
    if (activePoopRope === rope) {
      activePoopRope = null;
    }
  }
}

function destroyPoopRope(rope) {
  if (rope.baseMesh.geometry) {
    rope.baseMesh.geometry.dispose();
  }
  if (rope.slimeMesh.geometry) {
    rope.slimeMesh.geometry.dispose();
  }
  scene.remove(rope.group);
}

function createPoopProjectile(start) {
  const projectile = new THREE.Group();
  const coreMaterial = createPoopMaterial(0x55311a, {
    roughness: 0.66,
    clearcoat: 0.12,
  });
  const wetMaterial = createPoopMaterial(0x6a4423, {
    roughness: 0.46,
    clearcoat: 0.24,
  });
  const darkMaterial = createPoopMaterial(0x3f2413, {
    roughness: 0.74,
    clearcoat: 0.08,
  });
  const stringMaterial = createPoopMaterial(0x6a401e, {
    roughness: 0.38,
    clearcoat: 0.28,
    opacity: 0.95,
  });

  const mainBlob = new THREE.Mesh(projectileMainGeometry, wetMaterial);
  mainBlob.castShadow = true;
  mainBlob.scale.set(0.95, 1.15, 0.95);
  mainBlob.rotation.z = Math.PI / 2;

  const nuggetA = new THREE.Mesh(projectileNuggetAGeometry, coreMaterial);
  nuggetA.position.set(0.11, 0.04, 0.02);
  nuggetA.castShadow = true;

  const nuggetB = new THREE.Mesh(projectileNuggetBGeometry, darkMaterial);
  nuggetB.position.set(-0.1, -0.03, 0.05);
  nuggetB.castShadow = true;

  projectile.add(mainBlob, nuggetA, nuggetB);
  projectile.position.copy(start);
  scene.add(projectile);

  const streamGroup = new THREE.Group();
  const streamSegments = [];
  for (let index = 0; index < poopConfig.stringSegments; index += 1) {
    const segment = new THREE.Mesh(projectileStringGeometry, stringMaterial);
    segment.castShadow = true;
    streamSegments.push(segment);
    streamGroup.add(segment);
  }
  scene.add(streamGroup);

  return {
    group: projectile,
    streamGroup,
    streamSegments,
    releaseDuration: poopConfig.releaseDuration,
    wobble: Math.random() * Math.PI * 2,
  };
}

function updateProjectileStream(projectile) {
  if (!projectile.streamGroup) {
    return;
  }

  const fadeStart = projectile.releaseDuration * 0.72;
  if (projectile.age > projectile.releaseDuration * 1.2) {
    projectile.streamGroup.visible = false;
    return;
  }

  projectile.streamGroup.visible = true;
  const releaseProgress = THREE.MathUtils.clamp(
    projectile.age / projectile.releaseDuration,
    0.14,
    1,
  );
  const buttPosition = hero.buttAnchor.getWorldPosition(tempVecJ);
  const tipPosition = projectile.group.position;
  const streamDirection = tempVecK.copy(tipPosition).sub(buttPosition).normalize();
  const sideDirection = tempVecL.crossVectors(streamDirection, upVector);
  if (sideDirection.lengthSq() < 0.0001) {
    sideDirection.set(1, 0, 0);
  } else {
    sideDirection.normalize();
  }

  const opacity = THREE.MathUtils.mapLinear(
    projectile.age,
    fadeStart,
    projectile.releaseDuration * 1.2,
    0.95,
    0,
  );

  projectile.streamSegments.forEach((segment, index) => {
    const t = index / Math.max(projectile.streamSegments.length - 1, 1);
    const stretchT = t * releaseProgress;
    segment.position.copy(buttPosition).lerp(tipPosition, stretchT);
    const wobble = Math.sin(clock.elapsedTime * 20 + projectile.wobble + t * 6) * 0.03 * (1 - t);
    segment.position.addScaledVector(sideDirection, wobble);
    segment.scale.setScalar(1 - t * 0.44);
    segment.material.opacity = THREE.MathUtils.clamp(opacity, 0, 0.95);
  });
}

function createSplat(position, onPhone) {
  const radius = onPhone
    ? THREE.MathUtils.randFloat(0.28, 0.52)
    : THREE.MathUtils.randFloat(0.18, 0.36);
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = Math.random() * Math.PI * 2;

  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.12, 24),
    createStainMaterial(onPhone ? 0x4b2914 : 0x382014, {
      opacity: onPhone ? 0.94 : 0.82,
    }),
  );
  stain.rotation.x = -Math.PI / 2;
  stain.receiveShadow = true;
  group.add(stain);

  const mound = new THREE.Mesh(
    splatBlobGeometry,
    createPoopMaterial(onPhone ? 0x5e3519 : 0x482817, {
      roughness: 0.54,
      clearcoat: 0.18,
    }),
  );
  mound.scale.set(radius * 0.82, radius * 0.18, radius * 0.72);
  mound.position.y = 0.03;
  mound.castShadow = true;
  mound.receiveShadow = true;
  group.add(mound);

  const slime = new THREE.Mesh(
    splatBlobGeometry,
    createPoopMaterial(onPhone ? 0x7a4b22 : 0x5b331a, {
      roughness: 0.32,
      clearcoat: 0.32,
      opacity: 0.78,
    }),
  );
  slime.scale.set(radius * 0.62, radius * 0.08, radius * 0.46);
  slime.position.set(radius * 0.08, 0.048, -radius * 0.05);
  group.add(slime);

  for (let index = 0; index < 5; index += 1) {
    const droplet = new THREE.Mesh(
      splatDropletGeometry,
      createPoopMaterial(index % 2 === 0 ? 0x6a3e1e : 0x442310, {
        roughness: 0.5,
        clearcoat: 0.22,
      }),
    );
    droplet.scale.setScalar(radius * THREE.MathUtils.randFloat(0.45, 0.82));
    droplet.scale.y *= THREE.MathUtils.randFloat(0.35, 0.6);
    droplet.position.set(
      THREE.MathUtils.randFloatSpread(radius * 0.92),
      0.018 + Math.random() * 0.018,
      THREE.MathUtils.randFloatSpread(radius * 0.92),
    );
    droplet.castShadow = true;
    droplet.receiveShadow = true;
    group.add(droplet);
  }

  for (let index = 0; index < 4; index += 1) {
    const fiber = new THREE.Mesh(
      splatFiberGeometry,
      createStainMaterial(index % 2 === 0 ? 0xa88a3d : 0x8d7b4e, {
        roughness: 0.9,
      }),
    );
    fiber.scale.set(
      THREE.MathUtils.randFloat(0.8, 1.8),
      THREE.MathUtils.randFloat(0.45, 0.9),
      THREE.MathUtils.randFloat(0.8, 1.5),
    );
    fiber.position.set(
      THREE.MathUtils.randFloatSpread(radius * 0.72),
      0.032 + Math.random() * 0.016,
      THREE.MathUtils.randFloatSpread(radius * 0.72),
    );
    group.add(fiber);
  }

  scene.add(group);
  splats.push(group);
}

function registerHit() {
  setMessage("Rak träff på skärmen. Det blev vidrigt direkt.");
  updateHud();
}

function registerMiss(message = "Miss. Bara marken fick ta smallen.") {
  setMessage(message);
  updateHud();
}

function applyTargetHitVisuals(impactPoint, velocity) {
  const hitForce = THREE.MathUtils.clamp(velocity.length() * 0.06, 1.2, 2.4);
  const localImpact = standingTarget.swayPivot.worldToLocal(tempVecP.copy(impactPoint));
  const horizontalOffset = THREE.MathUtils.clamp(localImpact.x / 0.55, -1, 1);
  standingTarget.state.wobbleVelocity += hitForce + Math.abs(horizontalOffset) * 0.35;
  standingTarget.state.recoil = Math.min(
    standingTarget.state.recoil + 0.28 + hitForce * 0.05,
    0.48,
  );
  standingTarget.state.twist += horizontalOffset * 0.2;
  standingTarget.state.hitFlash = 1;
  createImpactBurst(impactPoint, velocity);
  return hitForce;
}

function registerTargetHit(impactPoint, velocity, options = {}) {
  const hitForce = applyTargetHitVisuals(impactPoint, velocity);
  if (options.broadcast !== false) {
    multiplayer.sendWorldEvent(WORLD_EVENT_KINDS.targetHit, {
      impactPoint,
      velocity,
    });
  }


  state.hemorrhoids = THREE.MathUtils.clamp(
    state.hemorrhoids - (6 + hitForce * 0.8),
    0,
    100,
  );
  setMessage(
    state.hemorrhoids > 0
      ? "Klockren smäll. Han gungar till där ute i öknen och hemorojdrisken sjunker."
      : "Perfekt smocka. All press släppte för stunden.",
  );
  updateHud();
}

function updateHemorrhoids(delta) {
  if (state.gameOver) {
    state.resetTimer -= delta;
    if (state.resetTimer <= 0) {
      resetRound();
    }
    return;
  }

  if (state.playerPhase !== MATCH_PHASES.active) {
    dangerRing.userData.fill.material.opacity = 0.18;
    dangerRing.userData.outline.material.emissiveIntensity = 0.62;
    dangerRing.scale.setScalar(1);
    return;
  }

  tempVecA.copy(state.playerPosition).setY(0);
  tempVecB.copy(world.phoneCenter).setY(0);
  const distanceToPhone = tempVecA.distanceTo(tempVecB);
  const nearbyPressure = THREE.MathUtils.clamp(
    THREE.MathUtils.mapLinear(distanceToPhone, 9.2, 2.8, 0, 0.4),
    0,
    0.4,
  );
  const pressure = state.isOnPhone ? 1 : nearbyPressure;

  if (state.isOnPhone) {
    state.hemorrhoids = THREE.MathUtils.clamp(
      state.hemorrhoids + delta * 17.0,
      0,
      100,
    );
  } else if (nearbyPressure > 0) {
    state.hemorrhoids = THREE.MathUtils.clamp(
      state.hemorrhoids + delta * (2.0 + nearbyPressure * 9.0),
      0,
      100,
    );
  }

  dangerRing.userData.fill.material.opacity = 0.35 + pressure * 0.2 + Math.sin(clock.elapsedTime * 4) * 0.05;
  dangerRing.userData.outline.material.emissiveIntensity = 0.8 + pressure * 0.4 + Math.sin(clock.elapsedTime * 4) * 0.15;
  dangerRing.scale.setScalar(1 + pressure * 0.06);

  if (state.hemorrhoids >= 100) {
    triggerGameOver();
  }
}

function createImpactBurst(position, velocity) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const ring = new THREE.Mesh(
    impactRingGeometry,
    new THREE.MeshBasicMaterial({
      color: 0xffcf7b,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    }),
  );
  group.add(ring);

  const sparks = [];
  const awayFromTarget = tempVecN
    .copy(position)
    .sub(standingTarget.root.position)
    .setY(0)
    .normalize();
  const projectileDirection = tempVecO.copy(velocity).normalize();

  for (let index = 0; index < 7; index += 1) {
    const spark = new THREE.Mesh(
      impactSparkGeometry,
      new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xffe3a4 : 0xffb04d,
        transparent: true,
        opacity: 0.9,
      }),
    );
    spark.scale.setScalar(0.42 + Math.random() * 0.28);
    group.add(spark);
    sparks.push({
      mesh: spark,
      velocity: projectileDirection
        .clone()
        .multiplyScalar(-0.25)
        .add(awayFromTarget.clone().multiplyScalar(0.4 + Math.random() * 0.45))
        .add(
          new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(0.6),
            THREE.MathUtils.randFloat(-0.04, 0.72),
            THREE.MathUtils.randFloatSpread(0.6),
          ),
        ),
    });
  }

  impactBursts.push({
    age: 0,
    duration: 0.42,
    group,
    ring,
    sparks,
  });
}

function updateImpactBursts(delta) {
  for (let index = impactBursts.length - 1; index >= 0; index -= 1) {
    const burst = impactBursts[index];
    burst.age += delta;
    const progress = THREE.MathUtils.clamp(burst.age / burst.duration, 0, 1);
    burst.ring.quaternion.copy(camera.quaternion);
    const ringScale = 1 + progress * 3.2;
    burst.ring.scale.setScalar(ringScale);
    burst.ring.material.opacity = (1 - progress) * 0.9;

    burst.sparks.forEach((spark) => {
      spark.mesh.position.addScaledVector(spark.velocity, delta);
      spark.velocity.y -= delta * 1.8;
      spark.mesh.scale.multiplyScalar(1 - delta * 1.4);
      spark.mesh.material.opacity = Math.max(0, 0.95 - progress * 1.1);
    });

    if (progress >= 1) {
      scene.remove(burst.group);
      burst.group.traverse(disposeObject);
      impactBursts.splice(index, 1);
    }
  }
}

function triggerGameOver() {
  state.gameOver = true;
  state.resetTimer = 2.6;
  setMessage("Game over. Du stod och tryckte för länge på telefonen och sprack upp helt.");
  gameOverEl.classList.remove("hidden");
}

function measureRopeLength(rope) {
  if (!rope || rope.points.length < 2) {
    return 0;
  }
  let length = 0;
  for (let i = 1; i < rope.points.length; i++) {
    length += rope.points[i].position.distanceTo(rope.points[i - 1].position);
  }
  return length;
}

function getLocalTotalPoopLength() {
  let total = 0;
  for (const rope of poopRopes) {
    if (rope === activePoopRope || !multiplayerState.remotePlayers.size) {
      let isRemote = false;
      for (const rp of multiplayerState.remotePlayers.values()) {
        if (rp.rope === rope) {
          isRemote = true;
          break;
        }
      }
      if (!isRemote) {
        total += measureRopeLength(rope);
      }
    } else {
      let isRemote = false;
      for (const rp of multiplayerState.remotePlayers.values()) {
        if (rp.rope === rope) {
          isRemote = true;
          break;
        }
      }
      if (!isRemote) {
        total += measureRopeLength(rope);
      }
    }
  }
  return total;
}

function getRemotePoopLength(remotePlayer) {
  if (!remotePlayer.rope) {
    return 0;
  }
  return measureRopeLength(remotePlayer.rope);
}

function getOrLoadSkinImage(skinDataUrl) {
  const url = skinDataUrl || DEFAULT_SKIN_DATA_URL;
  let img = leaderboardHeadCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    leaderboardHeadCache.set(url, img);
  }
  return img;
}

function renderLeaderboard() {
  if (!leaderboardEntriesEl || !leaderboardEl) {
    return;
  }

  const isActive = state.playerPhase === MATCH_PHASES.active ||
    state.playerPhase === MATCH_PHASES.glide;
  if (!isActive || !multiplayerState.joined) {
    leaderboardEl.classList.add("hidden");
    return;
  }
  leaderboardEl.classList.remove("hidden");

  const entries = [];

  const localLength = getLocalTotalPoopLength();
  state.totalPoopLength = localLength;
  const localSkin = playerProfile.skinDataUrl || DEFAULT_SKIN_DATA_URL;
  entries.push({
    id: multiplayerState.selfId || "_local",
    name: multiplayerState.selfName || playerProfile.name || "Du",
    skinDataUrl: localSkin,
    length: localLength,
    isSelf: true,
  });

  for (const [id, rp] of multiplayerState.remotePlayers) {
    entries.push({
      id,
      name: rp.name || "Spelare",
      skinDataUrl: rp.skinDataUrl || DEFAULT_SKIN_DATA_URL,
      length: getRemotePoopLength(rp),
      isSelf: false,
    });
  }

  entries.sort((a, b) => b.length - a.length);

  const existingChildren = leaderboardEntriesEl.children;
  while (existingChildren.length > entries.length) {
    leaderboardEntriesEl.removeChild(existingChildren[existingChildren.length - 1]);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let row = existingChildren[i];
    if (!row) {
      row = document.createElement("div");
      row.className = "lb-entry";
      row.innerHTML =
        '<span class="lb-rank"></span>' +
        '<canvas class="lb-head" width="32" height="32"></canvas>' +
        '<span class="lb-name"></span>' +
        '<span class="lb-length"></span>';
      leaderboardEntriesEl.appendChild(row);
    }

    const rankClasses = ["lb-entry"];
    if (entry.isSelf) rankClasses.push("lb-entry--self");
    if (i === 0) rankClasses.push("lb-entry--first");
    row.className = rankClasses.join(" ");

    const rankEl = row.children[0];
    const headCanvas = row.children[1];
    const nameEl = row.children[2];
    const lengthEl = row.children[3];

    const rankText = `#${i + 1}`;
    if (rankEl.textContent !== rankText) {
      rankEl.textContent = rankText;
    }

    const img = getOrLoadSkinImage(entry.skinDataUrl);
    const hctx = headCanvas.getContext("2d");
    hctx.imageSmoothingEnabled = false;
    hctx.clearRect(0, 0, 32, 32);
    if (img.complete && img.naturalWidth > 0) {
      hctx.drawImage(img, 8, 8, 8, 8, 0, 0, 32, 32);
      hctx.drawImage(img, 40, 8, 8, 8, 0, 0, 32, 32);
    }

    const displayName = entry.isSelf ? `${entry.name} (du)` : entry.name;
    if (nameEl.textContent !== displayName) {
      nameEl.textContent = displayName;
    }

    const lengthValue = entry.length < 10
      ? entry.length.toFixed(1)
      : Math.round(entry.length).toString();
    const lengthDisplay = `${lengthValue}m`;
    if (lengthEl.textContent !== lengthDisplay) {
      lengthEl.textContent = lengthDisplay;
    }
  }
}

function updateHud() {
  const hemorrhoidPercent = Math.round(state.hemorrhoids);
  const nextMeterText = `${hemorrhoidPercent}%`;
  if (meterTextEl.textContent !== nextMeterText) {
    meterTextEl.textContent = nextMeterText;
    meterFillEl.style.width = nextMeterText;
  }
  renderLeaderboard();
}

function setMessage() {}

function updateSmoke(delta) {
  dustPuffs.forEach((particle) => {
    particle.position.addScaledVector(particle.userData.drift, delta);
    particle.position.y += Math.sin(clock.elapsedTime + particle.userData.phase) * delta * 0.07;

    if (particle.position.y > 8) {
      particle.position.y = 1.2;
    }
    if (Math.abs(particle.position.x) > world.dustRadius) {
      particle.position.x *= -0.96;
    }
    if (Math.abs(particle.position.z) > world.dustRadius) {
      particle.position.z *= -0.96;
    }
  });
}

function clearProjectiles() {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    destroyProjectile(index);
  }
}

function clearPoopRopes() {
  for (let index = poopRopes.length - 1; index >= 0; index -= 1) {
    destroyPoopRope(poopRopes[index]);
    poopRopes.splice(index, 1);
  }
  activePoopRope = null;
  for (const remotePlayer of multiplayerState.remotePlayers.values()) {
    remotePlayer.rope = null;
  }
}

function clearSplats() {
  for (let index = splats.length - 1; index >= 0; index -= 1) {
    scene.remove(splats[index]);
    splats[index].traverse(disposeObject);
    splats.splice(index, 1);
  }
}

function clearImpactBursts() {
  for (let index = impactBursts.length - 1; index >= 0; index -= 1) {
    scene.remove(impactBursts[index].group);
    impactBursts[index].group.traverse(disposeObject);
    impactBursts.splice(index, 1);
  }
}

function dampAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * Math.min(amount, 1);
}

function disposeObject(object) {
  if (object.geometry) {
    object.geometry.dispose();
  }
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => {
        material.map?.dispose?.();
        material.dispose();
      });
    } else {
      object.material.map?.dispose?.();
      object.material.dispose();
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const now = performance.now();
  const nowDate = Date.now();
  if (state.cooldown > 0) {
    state.cooldown = Math.max(0, state.cooldown - delta);
  }

  updatePlayer(delta);
  updatePoopHold(delta);
  updateStrike(delta);
  updateCamera(delta);
  updateStandingTarget(delta);
  updateAimMarker();
  updatePoopRopes(delta);
  updateProjectiles(delta);
  updateRemotePlayers(delta, now);
  updateMultiplayer(now);
  updateSmoke(delta);
  updateImpactBursts(delta);
  updateHemorrhoids(delta);
  updateBattleBusVisual(nowDate);
  syncAnnouncementPrompts(nowDate);
  syncMatchPanel(nowDate);
  updateHud();

  const isMenuPhase = state.playerPhase === MATCH_PHASES.staging || state.playerPhase === MATCH_PHASES.countdown;
  hero.root.visible = !isMenuPhase && state.playerPhase !== MATCH_PHASES.bus;
  remotePlayersRoot.visible = !isMenuPhase;
  document.body.classList.toggle("staging-lobby", isMenuPhase && multiplayerState.joined);

  renderer.render(scene, camera);
}
