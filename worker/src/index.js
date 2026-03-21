import {
  ACTION_KINDS,
  GUEST_PREFIXES,
  GUEST_SUFFIXES,
  LOBBY_IDS,
  MAX_PACKET_TELEPORT_DISTANCE,
  MAX_PLAYERS_PER_LOBBY,
  PLAYER_COLOR_PALETTE,
  clampPose,
  createActionState,
  createSpawnPose,
  getTeleportDistance,
  isValidLobbyId,
  WORLD_EVENT_KINDS,
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

function serializePoseMessage(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    pose: player.pose,
    actionState: player.actionState,
  };
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
    this.restorePlayers();
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
        pose: attachment.pose ?? createSpawnPose(),
        actionState: attachment.actionState ?? createActionState(),
        websocket,
        joined: attachment.joined ?? false,
        guestIndex: attachment.guestIndex ?? 0,
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

      this.ctx.acceptWebSocket(server);

      const player = {
        id: playerId,
        name: profile.name,
        color: profile.color,
        pose: createSpawnPose(),
        actionState: createActionState(),
        websocket: server,
        joined: false,
        guestIndex,
      };

      server.serializeAttachment({
        lobbyId,
        playerId,
        guestIndex,
        name: player.name,
        color: player.color,
        pose: player.pose,
        actionState: player.actionState,
        joined: false,
      });

      this.players.set(playerId, player);
      this.guestCounter += 1;

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
      this.handleHello(player);
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

  handleHello(player) {
    player.joined = true;
    this.updateAttachment(player);

    const others = [];
    for (const existingPlayer of this.players.values()) {
      if (existingPlayer.id === player.id || !existingPlayer.joined) {
        continue;
      }
      others.push(serializePoseMessage(existingPlayer));
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
      }),
    );

    this.broadcast(
      {
        type: "presence",
        action: "join",
        playerCount: this.getJoinedPlayerCount(),
        player: serializePoseMessage(player),
      },
      player.id,
    );
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
        player: serializePoseMessage(player),
      });
    }

    if (this.players.size === 0) {
      this.guestCounter = 0;
      this.lobbyId = null;
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
