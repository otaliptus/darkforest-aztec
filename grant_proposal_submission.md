# Dark Forest on Aztec — Grant Proposal (Submission Draft)

Title: Dark Forest on Aztec (solo build)

Contact: Talip (GitHub: otaliptus) — add email/Telegram before posting

Last updated: January 14, 2026

## Summary

This repo already contains a working Aztec port of Dark Forest v0.6 at the core
mechanics level: Noir contracts implementing init/reveal/move/upgrade/prospect/
find/trade/activate flows, arrivals resolution, ships, and artifact logic, plus
an Aztec-native NFT contract wired into artifact trading posts. The React client
is adapted to Aztec.js + PXE and reads public state directly (no event indexer),
with local and devnet deployment scripts and detailed internal docs.

Performance is being tracked with a bench script and notes; a local devnet run
(2026-01-08) measured init and move end-to-end with proofs enabled at ~37s after
warm-up, within the 60s turn-time target. The client currently defaults to
`PROVER_ENABLED=false`, so shipping a proof-enabled build is still a must. The
remaining work is about full v0.6 parity on missing features, tightening proof
flows, and hardening the UX and tests to meet the grant’s non-negotiables.

## Current status (Jan 14, 2026)

**Implemented / working (repo evidence)**
- Noir DarkForest contract with private-validate → public-apply (only_self).
- Core v0.6 loop: init, reveal, move, upgrade, prospect/find artifacts, trade
  (deposit/withdraw), activate/deactivate, ships, arrivals processing.
- Aztec-native NFT contract; artifacts mint on find and transfer via trading post.
- React client wired to Aztec.js + PXE; direct storage reads + polling model.
- Local + devnet deploy scripts and a devnet runbook under `docs/`.
- Contract tests in `packages/contracts/src/test/*` for key flows.

**Measured performance**
- Local devnet benchmark (2026-01-08): `init_player` ~36.9s, `move` ~37.5s
  end-to-end with proofs enabled (post warm-up).

**Known gaps / deviations vs v0.6**
- Missing or disabled: capture zones, planet transfer, hats/cosmetics, withdraw
  silver, rewards/score, whitelist, admin facets, global pause, mint period,
  debug helpers, planet createdAt.
- Client defaults to `PROVER_ENABLED=false` (dev convenience, not final).
- Arrivals require explicit `resolve_arrival` txs (client handles this).
- No event/indexer; client reads public storage directly.

## Start and end date

- Start: ASAP (active development underway)
- Functional MVP: March 22, 2026 (hard deadline)

## Team

Solo developer, full-time on this port.

## Technical approach

### Contract architecture

- Maintain private validation → public apply (only_self) for every transition.
- Private functions validate perlin/mimc/bounds with on-chain config; public
  apply functions enforce config hashes and mutate minimal public state.

### Circom → Noir parity

- Core Circom logic is already ported into Noir private validators for
  init/move/reveal/biomebase/perlin.
- Whitelist flow is still a gap; decision needed on zk whitelist vs admin list.
- Maintain and ship against the repo’s v0.6 gap checklist and crosswalk.

### NFT minting

- Aztec-native NFT contract is live; artifacts mint to DarkForest on discovery.
- Trading post deposit/withdraw transfers NFT ownership between player and
  contract in public (Aztec-native standard, minimal interface).

### Frontend integration

- Preserve the original DF client UX where possible; Aztec replaces web3.
- Client uses direct storage reads and local event synthesis for updates.
- Explicit arrival resolution is handled by the client to mirror v0.6 flow.

## Testing and documentation

- Noir contract tests already cover init/move/upgrade/prospect/find/activate.
- Add integration tests for full game flows and proof-enabled runs.
- Docs include: devnet runbook, performance notes, gap checklist, call graphs.

## Performance plan (<60s per turn)

- Treat turn time as a gated KPI. Local bench shows ~37s move with proofs on
  after warm-up (2026-01-08); keep this updated and reproducible.
- Optimize hot paths (move/reveal) and keep heavy work in discovery flows.
- Validate devnet performance and document the baseline machine + settings.

## Milestones

1) **Parity core (by Feb 2, 2026)**
   - Close core parity gaps with v0.6 (capture zones, planet transfer, hats,
     withdraw silver, whitelist decision).
   - Proof-enabled end-to-end flow in the client.

2) **Gameplay completeness (by Feb 23, 2026)**
   - Reward/score system, global pause, mint period enforcement.
   - Devnet playable build with documented known limitations.

3) **Performance + polish (by Mar 22, 2026)**
   - Maintain <60s turn-time on baseline machine.
   - Full docs + deployment runbook + public demo build.

## Stretch goals

- Plugin-ready API with 2–3 sample plugins (if time).
- Improved onboarding/tutorial flow.
- Additional performance tuning beyond the 60s target.

## Grant amount requested

$75,000

## Budget rationale

- Solo full-time development (contracts, client integration, tests): $55k
- QA + performance profiling + tooling: $10k
- Devnet hosting, CI, and docs: $10k

## Risks and mitigations

- **Prover disabled by default**: ship a proof-enabled build + benchmark.
- **Parity gaps vs v0.6**: track and close against the gap checklist.
- **Performance variance on devnet**: rely on local benchmarks, then validate
  on devnet with the same proof settings.
- **No event/indexer**: acceptable for MVP; document trade-offs.

## Questions

1) Do you want a specific baseline machine for the <60s KPI (or is the local
   devnet benchmark acceptable)?
2) For whitelist, should this stay as a zk key proof or can we ship an
   admin-managed allowlist for MVP?
3) Is the minimal Aztec-native NFT interface acceptable for the grant (no URI
   metadata), or should we target a specific standard now?
