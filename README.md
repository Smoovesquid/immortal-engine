# AI Dungeon Master (V2)

Offline-first, deterministic, narrative-first dungeon crawler intro.

## Run

```sh
npm install
npm run dev
```

Open: <http://localhost:5179>

## Reset

- In the browser DevTools → Application → Local Storage → delete keys starting with `ai-dm-v2:`

## Export / Import

- Toggle **Advanced** (unless Release mode is ON)
- Use **Export Save…** / **Import Save…**
- When a session ends, use **Export Chronicle** on the Session End screen

## Release mode

- Release mode hides all Advanced/dev UI and shows a friendly error screen.

## Online AI (server-side, optional)

- Copy `.env.example` → `.env` and set `OPENAI_API_KEY`.
- Restart the dev server.

The browser never sees the API key. If the key is missing, the app stays fully offline-first and silently falls back.

### Model selection

Server uses `OPENAI_MODEL` if set (default: `gpt-4.1-mini`).
