# Devnet Deployment Plan (Aztec Dark Forest)

## Purpose
Provide a concise checklist for deploying Dark Forest + NFT to Aztec devnet,
enabling fee sponsorship, and hosting the client. Full details live in
`docs/devnet.md` (source of truth).

## Quick facts (from Aztec devnet docs)
- Devnet is version-dependent; keep CLI + SDK aligned with the devnet version.
- RPC + Sponsored FPC address are published in the devnet docs.
- No pre-deployed accounts; you must deploy an account.
- Transactions may take longer; timeouts can occur while still mining.

## Checklist (devnet)
1) `yarn install`
2) `yarn contracts:compile`
3) Export env vars (see `docs/devnet.md`):
   - `AZTEC_NODE_URL`
   - `SPONSORED_FPC_ADDRESS`
   - `PROVER_ENABLED=true`
   - `ACCOUNT_SECRET` + `ACCOUNT_SALT` + `ACCOUNT_SIGNING_KEY` (or `ACCOUNT_MODE=random`)
4) `node packages/contracts/scripts/deploy_devnet.js --write-env --overwrite-env`
5) `yarn client:build` and deploy `apps/client/dist` to a static host

## Notes
- Ticker is **local-only**. Devnet blocks advance automatically.
- The deploy script writes `apps/client/.env.local` for the client build.
- Sponsored FPC is recommended on devnet; Fee Juice is the fallback.

## References
- Devnet setup: https://docs.aztec.network/developers/getting_started_on_devnet
- Paying fees: https://docs.aztec.network/developers/docs/aztec-js/how_to_pay_fees
