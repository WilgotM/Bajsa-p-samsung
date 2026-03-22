# Codex Project Notes

Det här är ett litet 3D-webbspel byggt med Vite och Three.js.

## Vad projektet är

- Klienten ligger i `src/main.js`.
- UI och styling ligger i `index.html` och `src/style.css`.
- 3D-resurser ligger i `public/`.
- Bygget körs med Vite.

## Multiplayer

- Spelet har tre fasta lobbys: `solo`, `main` och `secondary`.
- Varje lobby drivs av en Cloudflare Durable Object.
- Klienten pratar med Workern via WebSocket.
- `GET /api/lobbies` används för att visa lobby-status i menyn.
- `GET /connect/:lobbyId` öppnar WebSocket-anslutningen till rätt lobby.
- Startmenyn har en `Spela solo`-knapp som går till `solo`-lobbyn och auto-sätter `Ready` för snabb teststart.
- Matchflödet är serverstyrt och går genom faserna `staging` -> `countdown` -> `bus` -> `glide` -> `active`.
- Countdown startar när minst en spelare är i samma lobby och alla anslutna spelare i den lobbyn har markerat `Ready` (så solo-test funkar).
- Workern skickar `match-state` till klienterna med `phase`, `readyCount`, `countdownEndsAt` och battle bus-tidsstämplar.
- Klienten kan skicka `ready` och `player-state` över WebSocket för att toggla redo-status och rapportera lokala fasbyten som glid/landning.

## Vad som synkas

- Spelarens position, yaw och rörelsehastighet synkas mellan datorer.
- Spelarens ready-status, namn, Minecraft-skin och nuvarande fas synkas också för väntelobbyn och battle bus-fasen.
- Gameplay-händelser synkas också, till exempel:
  - `poop-start`
  - `poop-stop`
  - `strike`
  - `target-hit`
  - `player-hit` (när en spelare träffar en annan med handslag)

## PvP (handslag)

- I aktiv fas kan spelaren slå med `F` eller vänsterklick (snabbt tryck).
- Håller man vänsterklick på telefonen fortsätter bajs-mekaniken som tidigare.
- Träff på annan spelare i samma lobby skickas som `player-hit` via Workern.
- Spelaren som blir träffad får ökad hemorojdrisk, men med låg handskada (förberett för framtida vapenbalans).

## Vapen

- V1 använder tre vapentyper: `assault-rifle`, `shotgun` och `smg`.
- Just nu spawnar alla spelare direkt med samma starter-loadout:
  - slot 1: grå `assault-rifle`
  - slot 2: grå `shotgun`
  - slot 3: grå `smg`
- Loadouten är server-auktoritativ och skickas till klienten som `loadout-state`.
- Klienten kan byta slot med `equip-slot` och skjuta med `fire-weapon`.
- Vapen är hitscan och valideras av Workern med fire rate, range och målträff innan skada delas ut.
- Vapenskada ökar samma hemorojdmätare som övrig gameplay. Vid `100` skickas `player-eliminated`.
- Toilet-loot och mark-loot är tillfälligt avstängt. Tanken är att uppgraderingar/loot kommer tillbaka senare i en enklare iteration.

## Spelarprofiler och skins

- Startmenyn har en `Skin + namn`-sektion där spelaren kan skriva eget namn.
- Spelaren kan ladda upp ett eget Minecraft-skin i `PNG`-format.
- Just nu stöds bara klassiska skins i standardstorleken `64x64`.
- Klienten skickar namn och skin till Workern via WebSocket och alla i samma lobby ser varandras namn och skins.
- Avatarerna renderas som Minecraft-liknande blockfigurer med skin-texturen applicerad på både lokal spelare och remote-spelare.

## Matchstart

- Spelarna väntar först i en separat 3D-staging-lobby i samma scen.
- När countdownen är klar flyttas alla till battle bussen.
- Dörrarna öppnas först när bussen är över ön, och då visas en tydlig `Space`-prompt.
- Spelare som inte hoppar själva auto-droppas nära slutet av bussrutten.
- Under `glide` sjunker spelaren långsamt och kan styra lite i luften innan vanlig gameplay tar vid på ön.

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
