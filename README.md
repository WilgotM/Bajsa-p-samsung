# Bajsa pa Samsung S25 Ultra

Det har projektet kor nu med en enkel multiplayer-v1:

- Frontend: Vite + Three.js
- Hosting: Cloudflare Pages
- Realtime-backend: Cloudflare Worker + Durable Object
- Lobbys: tva fasta rum, `main` och `secondary`

## Lokalt

1. Installera beroenden:

```bash
npm install
```

2. Starta multiplayer-backenden:

```bash
npm run worker:dev
```

3. Starta frontenden i en ny terminal:

```bash
npm run dev
```

4. Frontenden letar efter `VITE_MULTIPLAYER_ORIGIN` i denna ordning:

- `import.meta.env.VITE_MULTIPLAYER_ORIGIN`
- annars `http://127.0.0.1:8787` lokalt
- annars samma origin som sidan

Om du vill vara explicit kan du skapa en `.env` fil utifran [`.env.example`](/Users/wilgotmagnusson/Bajsa%20pa%CC%8A%20samsung%20s25%20ultra/.env.example).

## Cloudflare Worker

Worker-koden ligger i `worker/` och Durable Object-bindningen finns i [worker/wrangler.toml](/Users/wilgotmagnusson/Bajsa%20pa%CC%8A%20samsung%20s25%20ultra/worker/wrangler.toml).

Deploy:

```bash
npx wrangler login
npm run worker:deploy
```

Efter deploy far du en Worker-URL i stil med:

```text
https://s25-ultra-poop-multiplayer.<ditt-subdomain>.workers.dev
```

API som frontenden anvander:

- `GET /api/lobbies`
- `GET /connect/main`
- `GET /connect/secondary`

## Cloudflare Pages

1. Lagg projektet i GitHub.
2. Skapa ett nytt Pages-projekt via Git integration.
3. Anvand dessa build-installningar:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repo-roten

4. Lagg till denna env-var i både `Preview` och `Production`:

```text
VITE_MULTIPLAYER_ORIGIN=https://s25-ultra-poop-multiplayer.<ditt-subdomain>.workers.dev
```

5. Spara och trigga en ny deploy.

Det viktiga ar ordningen:

1. Deploya Workern forst.
2. Kopiera Worker-URL:en.
3. Satt `VITE_MULTIPLAYER_ORIGIN` i Pages.
4. Deploya Pages igen.

## Vad som ar byggt

- Startmeny med `Huvudlobby` och `Sekundar lobby`
- Lobby-counts via `/api/lobbies`
- WebSocket-anslutning till Durable Object per lobby
- Fargkodade remote-spelare
- Minecraft-liknande spelare med egna namn och uppladdade klassiska 64x64-skins
- Realtime synk av position, yaw och move amount
- Interpolation av remote-spelare for mjukare rorelse
- Reset av lobby-state nar sista spelaren lamnar

## Verifiering som redan ar kord

- `npm run build`
- `npx wrangler deploy --dry-run --config worker/wrangler.toml`
- Lokalt test av `/api/lobbies`
- Lokalt WebSocket-test for `welcome`, pose-broadcast och clean disconnect

## Officiella Cloudflare-guider

- [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Workers get started](https://developers.cloudflare.com/workers/get-started/guide/)
- [Durable Objects with WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
