import {
  ACTION_KINDS,
  COUNTDOWN_DURATION_MS,
  GUEST_PREFIXES,
  GUEST_SUFFIXES,
  LOBBY_IDS,
  MATCH_PHASES,
  MAX_PACKET_TELEPORT_DISTANCE,
  MAX_PLAYERS_PER_LOBBY,
  MIN_PLAYERS_TO_START,
  PLAYER_COLOR_PALETTE,
  WORLD_EVENT_KINDS,
  clampPose,
  createActionState,
  createMatchState,
  createSpawnPose,
  getBusSchedule,
  getTeleportDistance,
  isValidLobbyId,
  isValidMatchPhase,
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

function serializePlayerSnapshot(player) {
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
  };
}

function applyProfile(player, profile = {}) {
  player.name = sanitizePlayerName(profile.name, player.name);
  player.skinDataUrl = sanitizeSkinDataUrl(profile.skinDataUrl, player.skinDataUrl ?? "");
}

function sanitizeVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z,
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
        skinDataUrl: attachment.skinDataUrl ?? "",
        pose: attachment.pose ?? createSpawnPose(attachment.playerPhase),
        actionState: attachment.actionState ?? createActionState(),
        websocket,
        joined: attachment.joined ?? false,
        guestIndex: attachment.guestIndex ?? 0,
        ready: attachment.ready ?? false,
        playerPhase: attachment.playerPhase ?? MATCH_PHASES.staging,
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
        countdownEndsAt: this.matchState.countdownEndsAt,
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
        skinDataUrl: "",
        pose: createSpawnPose(playerPhase),
        actionState: createActionState(),
        websocket: server,
        joined: false,
        guestIndex,
        ready: false,
        playerPhase,
      };

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
      websocket.send(
        JSON.stringify({
          type: "pong",
          now: Date.now(),
        }),
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
    applyProfile(player, profile);
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

    this.broadcast(
      {
        type: "presence",
        action: "join",
        playerCount: this.getJoinedPlayerCount(),
        player: serializePlayerSnapshot(player),
      },
      player.id,
    );

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
    this.broadcast({
      type: "presence",
      action: "update",
      playerCount: this.getJoinedPlayerCount(),
      player: serializePlayerSnapshot(player),
    });
    this.broadcastMatchState();
  }

  handleReady(player, ready) {
    if (!player.joined) {
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

  handlePlayerState(player, nextPhase) {
    if (!player.joined || !isValidMatchPhase(nextPhase) || nextPhase === MATCH_PHASES.countdown) {
      return;
    }

    if (
      nextPhase === MATCH_PHASES.staging &&
      this.matchState.phase !== MATCH_PHASES.staging &&
      this.matchState.phase !== MATCH_PHASES.countdown
    ) {
      return;
    }

    if (nextPhase === MATCH_PHASES.bus && this.matchState.phase !== MATCH_PHASES.bus) {
      return;
    }

    if (
      nextPhase === MATCH_PHASES.glide &&
      this.matchState.phase !== MATCH_PHASES.bus &&
      this.matchState.phase !== MATCH_PHASES.active
    ) {
      return;
    }

    if (
      nextPhase === MATCH_PHASES.active &&
      this.matchState.phase !== MATCH_PHASES.bus &&
      this.matchState.phase !== MATCH_PHASES.active
    ) {
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
        at: Date.now(),
      },
      player.id,
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
          at: actionAt,
        },
      },
      player.id,
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
          velocity: sanitizeVector3(event.velocity),
        },
      },
      player.id,
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
        player: serializePlayerSnapshot(player),
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

    if (
      this.matchState.phase === MATCH_PHASES.countdown &&
      Number.isFinite(this.matchState.countdownEndsAt) &&
      now >= this.matchState.countdownEndsAt
    ) {
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

    if (
      this.matchState.phase === MATCH_PHASES.bus &&
      Number.isFinite(this.matchState.busEndsAt) &&
      now >= this.matchState.busEndsAt
    ) {
      this.enterActivePhase();
      return;
    }

    this.schedulePhaseTimer();
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

    if (this.matchState.phase === MATCH_PHASES.bus || this.matchState.phase === MATCH_PHASES.active) {
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
      phase: MATCH_PHASES.active,
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
      players: this.getJoinedPlayers().map(serializePlayerSnapshot),
    };
  }

  broadcastMatchState() {
    this.broadcast({
      type: "match-state",
      ...this.serializeMatchState(),
    });
  }

  schedulePhaseTimer() {
    this.clearPhaseTimer();

    const targetTime =
      this.matchState.phase === MATCH_PHASES.countdown
        ? this.matchState.countdownEndsAt
        : this.matchState.phase === MATCH_PHASES.bus
          ? this.matchState.busEndsAt
          : null;

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
      skinDataUrl: player.skinDataUrl ?? "",
      pose: player.pose,
      actionState: player.actionState,
      joined: player.joined,
      ready: player.ready,
      playerPhase: player.playerPhase,
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
