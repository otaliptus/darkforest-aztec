# Contracts

Aztec Noir contracts for the Dark Forest port.

## Commands

```bash
yarn compile
yarn test:nr
```

Feature flags (public bytecode size):

```bash
# Disable admin-only public actions (6–9) for production builds.
DF_ENABLE_ADMIN_ACTIONS=0 yarn compile
# or
yarn compile:prod
```

Check public bytecode size:

```bash
yarn bytecode:size
```

## Local deploy (devnet)

```bash
yarn deploy:local --write-env
```

Small map (faster local play):

```bash
DF_SMALL_MAP=1 yarn deploy:local --write-env
```

Or explicit overrides:

```bash
DF_WORLD_RADIUS=2000 DF_PLANET_RARITY=1024 yarn deploy:local --write-env
```

Optional init/reveal overrides (use if you change rarity and the defaults stop working):

```bash
DF_INIT_X=400 DF_INIT_Y=0 DF_INIT_RADIUS=500 DF_REVEAL_X=123 DF_REVEAL_Y=456 yarn deploy:local --write-env
```
