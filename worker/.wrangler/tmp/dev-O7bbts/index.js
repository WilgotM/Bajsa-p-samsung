var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../shared/multiplayer.js
var LOBBY_IDS = ["solo", "main", "secondary"];
var ARENA_RADIUS = 66;
var MAX_PLAYERS_PER_LOBBY = 8;
var MIN_PLAYERS_TO_START = 1;
var POSE_SEND_INTERVAL_MS = 1e3 / 15;
var MAX_PACKET_TELEPORT_DISTANCE = 4;
var PLAYER_MIN_Y = -2;
var PLAYER_MAX_Y = 12;
var COUNTDOWN_DURATION_MS = 1e4;
var BUS_FLIGHT_DURATION_MS = 18e3;
var BUS_DOORS_OPEN_OFFSET_MS = 5200;
var BUS_AUTO_DROP_OFFSET_MS = 15400;
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
var WORLD_EVENT_KINDS = Object.freeze({
  targetHit: "target-hit"
});
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
function serializePlayerSnapshot(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    guestIndex: player.guestIndex,
    pose: player.pose,
    actionState: player.actionState,
    ready: Boolean(player.ready),
    playerPhase: player.playerPhase
  };
}
__name(serializePlayerSnapshot, "serializePlayerSnapshot");
function sanitizeVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z
  };
}
__name(sanitizeVector3, "sanitizeVector3");
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
    this.restorePlayers();
    this.schedulePhaseTimer();
  }
  restorePlayers() {
    for (const websocket of this.ctx.getWebSockets()) {
      const attachment = websocket.deserializeAttachment();
      if (!attachment?.playerId) {
        continue;
      }
      this.lobbyId = attachment.lobbyId;
      this.players.set(attachment.playerId, {
        id: attachment.playerId,
        name: attachment.name,
        color: attachment.color,
        pose: attachment.pose ?? createSpawnPose(attachment.playerPhase),
        actionState: attachment.actionState ?? createActionState(),
        websocket,
        joined: attachment.joined ?? false,
        guestIndex: attachment.guestIndex ?? 0,
        ready: attachment.ready ?? false,
        playerPhase: attachment.playerPhase ?? MATCH_PHASES.staging
      });
      this.guestCounter = Math.max(this.guestCounter, attachment.guestIndex + 1);
    }
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
      const player = {
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
      };
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
      this.handleHello(player);
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
    if (payload.type === "pose") {
      this.handlePose(player, payload.pose);
      return;
    }
    if (payload.type === "action") {
      this.handleAction(player, payload.action);
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
  handleHello(player) {
    player.joined = true;
    player.playerPhase = this.getInitialPlayerPhase();
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
        lobbyId: this.lobbyId,
        playerCount: this.getJoinedPlayerCount(),
        players: others,
        matchState: this.serializeMatchState()
      })
    );
    this.broadcast(
      {
        type: "presence",
        action: "join",
        playerCount: this.getJoinedPlayerCount(),
        player: serializePlayerSnapshot(player)
      },
      player.id
    );
    this.reconcileMatchState(true);
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
  handleWorldEvent(player, event) {
    if (!player.joined || !event?.kind) {
      return;
    }
    if (event.kind !== WORLD_EVENT_KINDS.targetHit) {
      return;
    }
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
  }
  removePlayer(websocket) {
    const player = this.findPlayerBySocket(websocket);
    if (!player) {
      return;
    }
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
      this.guestCounter = 0;
      this.lobbyId = null;
      this.matchState = createMatchState();
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
    this.applyPlayerPhaseToJoinedPlayers(MATCH_PHASES.bus);
    for (const player of this.getJoinedPlayers()) {
      player.ready = false;
      player.actionState.poopActive = false;
      this.updateAttachment(player);
    }
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
      pose: player.pose,
      actionState: player.actionState,
      joined: player.joined,
      ready: player.ready,
      playerPhase: player.playerPhase
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

// .wrangler/tmp/bundle-Nk03Zu/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-Nk03Zu/middleware-loader.entry.ts
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
