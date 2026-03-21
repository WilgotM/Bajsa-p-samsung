import {
  HEARTBEAT_INTERVAL_MS,
  LOBBY_LABELS,
  POSE_SEND_INTERVAL_MS,
  createSpawnPose,
  isValidLobbyId,
} from "../shared/multiplayer.js";

function toWebSocketUrl(origin, lobbyId) {
  const url = new URL(`/connect/${lobbyId}`, origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function poseChangedEnough(previousPose, nextPose) {
  if (!previousPose) {
    return true;
  }

  return (
    Math.abs(previousPose.x - nextPose.x) > 0.02 ||
    Math.abs(previousPose.y - nextPose.y) > 0.02 ||
    Math.abs(previousPose.z - nextPose.z) > 0.02 ||
    Math.abs(previousPose.yaw - nextPose.yaw) > 0.025 ||
    Math.abs(previousPose.moveAmount - nextPose.moveAmount) > 0.08
  );
}

export function resolveMultiplayerOrigin() {
  const configuredOrigin = import.meta.env.VITE_MULTIPLAYER_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:8787";
  }

  return window.location.origin;
}

export class MultiplayerClient {
  constructor({
    origin = resolveMultiplayerOrigin(),
    onLobbySnapshot = () => {},
    onStateChange = () => {},
    onWelcome = () => {},
    onPresence = () => {},
    onMatchState = () => {},
    onPose = () => {},
    onAction = () => {},
    onWorldEvent = () => {},
    onError = () => {},
  } = {}) {
    this.origin = origin;
    this.onLobbySnapshot = onLobbySnapshot;
    this.onStateChange = onStateChange;
    this.onWelcome = onWelcome;
    this.onPresence = onPresence;
    this.onMatchState = onMatchState;
    this.onPose = onPose;
    this.onAction = onAction;
    this.onWorldEvent = onWorldEvent;
    this.onError = onError;

    this.ws = null;
    this.lobbyId = null;
    this.lastPose = createSpawnPose();
    this.lastPoseSentAt = 0;
    this.lastHeartbeatAt = 0;
    this.connectionState = "idle";
  }

  setState(connectionState, details = {}) {
    this.connectionState = connectionState;
    this.onStateChange({
      connectionState,
      lobbyId: this.lobbyId,
      lobbyLabel: this.lobbyId ? LOBBY_LABELS[this.lobbyId] : "",
      ...details,
    });
  }

  async fetchLobbies() {
    const response = await fetch(new URL("/api/lobbies", this.origin), {
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Lobby request failed: ${response.status}`);
    }

    const payload = await response.json();
    this.onLobbySnapshot(payload);
    return payload;
  }

  async connect(lobbyId) {
    if (!isValidLobbyId(lobbyId)) {
      throw new Error(`Invalid lobby: ${lobbyId}`);
    }

    this.disconnect(false);
    this.lobbyId = lobbyId;
    this.lastPose = createSpawnPose();
    this.lastPoseSentAt = 0;
    this.lastHeartbeatAt = 0;
    this.setState("connecting");

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(toWebSocketUrl(this.origin, lobbyId));
      this.ws = socket;

      socket.addEventListener("open", () => {
        this.setState("connected");
        socket.send(
          JSON.stringify({
            type: "hello",
          }),
        );
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(event.data);
      });

      socket.addEventListener("close", (event) => {
        const wasExpected = this.ws !== socket;
        if (wasExpected) {
          return;
        }

        this.ws = null;
        this.setState("disconnected", {
          reason: event.reason || "Anslutningen stängdes.",
        });
      });

      socket.addEventListener("error", () => {
        this.onError("WebSocket-anslutningen misslyckades.");
      });

      socket.addEventListener("close", (event) => {
        if (socket.readyState === WebSocket.CLOSING && event.code === 1006) {
          reject(new Error("WebSocket closed unexpectedly."));
        }
      });

      socket.addEventListener("error", () => {
        reject(new Error("Unable to open WebSocket connection."));
      });
    });
  }

  disconnect(resetLobby = true) {
    const activeSocket = this.ws;
    this.ws = null;
    if (activeSocket && activeSocket.readyState < WebSocket.CLOSING) {
      activeSocket.close(1000, "Client disconnect");
    }

    if (resetLobby) {
      this.lobbyId = null;
      this.setState("idle");
    }
  }

  handleMessage(rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === "welcome") {
      this.onWelcome(message);
      return;
    }

    if (message.type === "presence") {
      this.onPresence(message);
      return;
    }

    if (message.type === "match-state") {
      this.onMatchState(message);
      return;
    }

    if (message.type === "pose") {
      this.onPose(message);
      return;
    }

    if (message.type === "action") {
      this.onAction(message);
      return;
    }

    if (message.type === "world-event") {
      this.onWorldEvent(message);
      return;
    }

    if (message.type === "error") {
      this.onError(message.message ?? "Servern rapporterade ett fel.");
      return;
    }
  }

  sendAction(kind, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "action",
        action: {
          kind,
          ...data,
        },
      }),
    );
  }

  sendReady(ready) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "ready",
        ready: Boolean(ready),
      }),
    );
  }

  sendPlayerState(playerPhase) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "player-state",
        playerPhase,
      }),
    );
  }

  sendWorldEvent(kind, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "world-event",
        event: {
          kind,
          ...data,
        },
      }),
    );
  }

  tick(now, pose) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const changed = poseChangedEnough(this.lastPose, pose);
    if (changed && now - this.lastPoseSentAt >= POSE_SEND_INTERVAL_MS) {
      this.ws.send(
        JSON.stringify({
          type: "pose",
          pose,
        }),
      );
      this.lastPose = { ...pose };
      this.lastPoseSentAt = now;
      this.lastHeartbeatAt = now;
      return;
    }

    if (now - this.lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
      this.ws.send(
        JSON.stringify({
          type: "ping",
          now,
        }),
      );
      this.lastHeartbeatAt = now;
    }
  }
}
