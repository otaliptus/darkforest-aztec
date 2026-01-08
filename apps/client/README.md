# Dark Forest Client (Aztec)

## Development Guide

### Core Dependencies

- Node (>=16)
- Yarn 1.x (Classic)
- Docker (only required for local Aztec devnet via `scripts/df-local.sh`)

Install deps from the repo root:

```sh
yarn install
```

### Running the client (local devnet)

Quick start (builds, deploys, mines blocks, runs client):

```sh
scripts/df-local.sh --run
```

Manual flow:

```sh
scripts/df-local.sh --deploy
scripts/df-local.sh --mine-blocks
yarn client:dev
```

The deploy step writes `apps/client/.env.local` with contract addresses. You can override the
defaults by editing that file or setting env vars.

### Client config

`apps/client/.env.local` (Vite-style):

```sh
VITE_AZTEC_NODE_URL=http://localhost:8080
VITE_DARKFOREST_ADDRESS=0x...
VITE_NFT_ADDRESS=0x...
VITE_SPONSORED_FPC_ADDRESS=0x...
```

Optional account selection (local devnet ships with test accounts 0-2):

```sh
ACCOUNT_INDEX=0
```

Optional perlin overrides:

```sh
VITE_PLANETHASH_KEY=42
VITE_SPACETYPE_KEY=43
VITE_PERLIN_LENGTH_SCALE=1024
VITE_PERLIN_MIRROR_X=false
VITE_PERLIN_MIRROR_Y=false
```

Optional init/reveal defaults:

```sh
VITE_INIT_X=990
VITE_INIT_Y=0
VITE_INIT_RADIUS=1000
VITE_REVEAL_X=123
VITE_REVEAL_Y=456
```

The config loader also accepts non-VITE variants (e.g. `AZTEC_NODE_URL`, `DARKFOREST_ADDRESS`).

### Detailed action logging

The Aztec client can emit high-detail gameplay logs to a local file for debugging.

- Enable from the client UI: `Settings` → `Detailed Action Logs` → toggle on, then click `Pick Log File`.
- Logs are written as NDJSON (one JSON object per line) and can be tailed while the game runs.
- Optional env flags (pre-populate the toggle on load):
  - `DF_DETAILED_LOGS=1` (enables detailed logging)
  - `DF_FILE_LOGS=1` (same as above, plus encourages file logging)
  - `DF_LOG_TO_CONSOLE=1` (mirror detailed logs to the browser console)

If your browser does not support the File System Access API, use `Download recent logs` to export the in-memory buffer.

### Plugin development

You can develop plugins for Dark Forest either inside this game client repository, or externally using something like https://github.com/Bind/my-first-plugin. In either case, you'll want to use the [`df-plugin-dev-server`](https://github.com/projectsophon/df-plugin-dev-server).

You can install it as a global command, using:

```sh
npm install -g @projectsophon/df-plugin-dev-server
```

Once it is installed, you can run it inside this project repository, using:

```sh
df-plugin-dev-server
```

You can then add or modify any plugins inside the [`plugins/`](./plugins) directory and they will be automatically bundled and served as plugins you can import inside the game!

And then load your plugin in the game client, like so:

```js
// Replace PluginTemplate.js with the name of your Plugin
// And `.ts` extensions become `.js`
export { default } from 'http://127.0.0.1:2222/PluginTemplate.js?dev';
```

### Embedded plugins

The Dark Forest client ships with some game "plugins" embedded in the game client. The source code for these plugins exists at [`embedded_plugins/`](./embedded_plugins). You are able to edit them inside the game and the changes will persist. If you change the source code directly, you must delete the plugin in-game and reload your browser to import the new code.
