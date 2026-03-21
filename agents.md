# Codex Project Notes

Det här är ett litet 3D-webbspel byggt med Vite och Three.js.

## Vad projektet är

- Klienten ligger i `src/main.js`.
- UI och styling ligger i `index.html` och `src/style.css`.
- 3D-resurser ligger i `public/`.
- Bygget körs med Vite.

## Multiplayer

- Spelet har två fasta lobbys: `main` och `secondary`.
- Varje lobby drivs av en Cloudflare Durable Object.
- Klienten pratar med Workern via WebSocket.
- `GET /api/lobbies` används för att visa lobby-status i menyn.
- `GET /connect/:lobbyId` öppnar WebSocket-anslutningen till rätt lobby.

## Vad som synkas

- Spelarens position, yaw och rörelsehastighet synkas mellan datorer.
- Gameplay-händelser synkas också, till exempel:
  - `poop-start`
  - `poop-stop`
  - `strike`
  - `target-hit`

## Cloudflare

- Frontend ska deployas på Cloudflare Pages.
- Multiplayer-backenden ska deployas som Cloudflare Worker.
- Frontenden läser Worker-URL:en från `VITE_MULTIPLAYER_ORIGIN`.
- Lokalt används `http://127.0.0.1:8787`.

## Lokalt

- Frontend:

```bash
npm run dev
```

- Worker:

```bash
npm run worker:dev
```

## Viktigt

- `CODEX.md` är bara snabb kontext för Codex och andra som jobbar i repot.
- Om multiplayern ändras ska den här filen uppdateras så att nästa agent slipper gissa.
